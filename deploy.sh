#!/bin/sh
# Cadence auto-deploy for Synology.
# Run from DSM Task Scheduler as root, e.g. every 5 minutes:
#   REPO=owner/cadence TOKEN=github_pat_xxx APP_PASSWORD=secret sh /volume1/docker/cadence/deploy.sh
# Optional vars: APP_USERNAME, ANTHROPIC_API_KEY, TZ, BRANCH, HTTPS_PORT (default 8443). They're written to .env (never committed).
# HTTPS: tls.sh keeps a mkcert certificate in certs/ (HTTPS=off to skip, CERT_HOSTS="..." to set the names).
# - Pulls the latest commit from GitHub (read-only token)
# - Changes to public/ go live instantly (mounted into the container)
# - Changes to server.js / Dockerfile / docker-compose.yml trigger a rebuild
# - Builds the new image first; if the build fails or the new version doesn't start, the old one keeps running
# - Never touches data/; keeps your own lines in .env
set -eu
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
DIR="${CADENCE_DIR:-$(cd "$(dirname "$0")" && pwd)}"
cd "$DIR"
# `git reset --hard` below can rewrite this very file while sh is still reading it: run from a copy instead
if [ -z "${CADENCE_DEPLOY_COPY:-}" ]; then
  COPY="$(mktemp /tmp/cadence-deploy.XXXXXX)"; cp "$DIR/deploy.sh" "$COPY"
  CADENCE_DEPLOY_COPY="$COPY" CADENCE_DIR="$DIR" exec sh "$COPY" "$@"
fi
trap 'rm -f "$CADENCE_DEPLOY_COPY"' EXIT
REPO="${REPO:?set REPO=owner/name}"
BRANCH="${BRANCH:-}"   # empty = follow `stable` (only commits that passed the tests), else main
TOKEN="${TOKEN:-$(cat .deploy-token 2>/dev/null || true)}"
LOG="$DIR/deploy.log"
log(){ echo "$(date '+%F %T') $*" >> "$LOG"; }

if command -v git >/dev/null 2>&1; then
  g(){ git -c safe.directory='*' "$@"; }
else
  # no Git package installed: use a throwaway git container
  g(){ docker run --rm -v "$DIR:/repo" -w /repo alpine/git -c safe.directory='*' "$@"; }
fi
if docker compose version >/dev/null 2>&1; then dc(){ docker compose -p cadence "$@"; }
else dc(){ docker-compose -p cadence "$@"; }; fi

# make sure the app is up (self-heal if the container was stopped or deleted)
ensure_running(){
  if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -qx cadence; then
    [ -f .env ] || cp .env.example .env
    mkdir -p data
    log "container not running: starting it"
    dc up -d --build --remove-orphans >> "$LOG" 2>&1 && log "start ok" || log "START FAILED — see above"
  fi
}

# local HTTPS certificate (tls.sh exits 10 when it issued a new one)
TLS_NEW=no
ensure_tls(){
  [ -f "$DIR/tls.sh" ] || return 0
  rc=0; sh "$DIR/tls.sh" || rc=$?
  [ "$rc" = 10 ] && TLS_NEW=yes
  return 0
}

# the container runs as the unprivileged `node` user (uid 1000): it must own data/ and be able to read certs/
fix_owner(){
  mkdir -p data
  for d in data certs; do
    [ -d "$d" ] || continue
    if [ -n "$(find "$d" ! -user 1000 -print -quit 2>/dev/null)" ]; then chown -R 1000:1000 "$d" && log "gave $d/ to the app user"; fi
  done
}
# wait for the new container to answer (up to ~90s)
healthy(){
  i=0
  while [ $i -lt 45 ]; do
    docker exec cadence wget -qO- http://127.0.0.1:8484/healthz >/dev/null 2>&1 && return 0
    i=$((i+1)); sleep 2
  done
  return 1
}

URL="https://github.com/$REPO.git"
[ -n "$TOKEN" ] && URL="https://x-access-token:$TOKEN@github.com/$REPO.git"

[ -d .git ] || { g init -q; g remote add origin "$URL"; log "initialized repo"; }
g remote set-url origin "$URL"
if [ -z "$BRANCH" ]; then
  if g fetch -q origin stable 2>/dev/null; then BRANCH=stable; else BRANCH=main; fi
fi
g fetch -q origin "$BRANCH" || { log "fetch failed (check REPO/TOKEN)"; exit 1; }

OLD="$(g rev-parse -q --verify HEAD 2>/dev/null || echo none)"
NEW="$(g rev-parse "origin/$BRANCH")"
# a commit that failed to build or start is not retried every 5 minutes; the next push is
if [ "$NEW" = "$(cat .deploy-bad 2>/dev/null || true)" ]; then NEW="$OLD"; fi

# settings passed from Task Scheduler -> .env (restart container if they changed)
# Settings from the Task Scheduler command go into .env. A setting the command doesn't pass keeps whatever .env already
# has (so a key you only keep in .env, like ANTHROPIC_API_KEY, is never blanked), and lines you add by hand are kept.
write_env(){
  {
    [ -f .env ] && grep -vE '^(TZ|APP_USERNAME|APP_PASSWORD|ANTHROPIC_API_KEY|HTTPS_PORT)=' .env || true
    keep(){ v="$(grep -E "^$1=" .env 2>/dev/null | tail -n 1 | cut -d= -f2-)"; echo "$1=${2:-${v:-$3}}"; }
    keep TZ "${TZ:-}" America/Toronto
    keep APP_USERNAME "${APP_USERNAME:-}" cadence
    keep APP_PASSWORD "${APP_PASSWORD:-}" ""
    keep ANTHROPIC_API_KEY "${ANTHROPIC_API_KEY:-}" ""
    keep HTTPS_PORT "${HTTPS_PORT:-}" 8443
  } > .env.new
  if ! cmp -s .env.new .env 2>/dev/null; then mv .env.new .env; chmod 600 .env; return 0; fi
  rm -f .env.new; return 1
}
ENV_CHANGED=no
if [ -n "${APP_PASSWORD:-}" ] && write_env; then ENV_CHANGED=yes; fi

if [ "$OLD" = "$NEW" ]; then
  ensure_tls
  if [ "$ENV_CHANGED" = yes ] && [ "$OLD" != none ]; then log "settings changed: restarting"; dc up -d >> "$LOG" 2>&1 || log "restart failed"
  elif [ "$TLS_NEW" = yes ]; then log "new certificate: restarting"; docker restart cadence >> "$LOG" 2>&1 || log "restart failed"; fi
  fix_owner
  ensure_running
  exit 0
fi

if [ "$OLD" = none ]; then CHANGED="all"; else CHANGED="$(g diff --name-only "$OLD" "$NEW")"; fi
[ "$ENV_CHANGED" = yes ] && CHANGED="$CHANGED
docker-compose.yml"
REBUILD=no
echo "$CHANGED" | grep -qE '^(all|server\.js|server/.*|Dockerfile|docker-compose\.yml|deploy\.sh|tls\.sh)$' && REBUILD=yes

# build the new image from a clean copy BEFORE touching the live files, so a broken build changes nothing
if [ "$REBUILD" = yes ] && [ "$OLD" != none ]; then
  TRY="$(mktemp -d /tmp/cadence-build.XXXXXX)"
  if g archive "$NEW" | tar -x -C "$TRY" && docker build -q -t cadence-precheck "$TRY" >> "$LOG" 2>&1; then
    rm -rf "$TRY"
  else
    rm -rf "$TRY"; echo "$NEW" > .deploy-bad
    log "deploy $(echo "$NEW" | cut -c1-7): BUILD FAILED, still running $(echo "$OLD" | cut -c1-7) — see above"
    ensure_running; exit 1
  fi
fi

g reset -q --hard "$NEW"
rm -f "$DIR/index.html"                    # leftover from the manual install
[ -f .env ] || { cp .env.example .env; log "created .env from .env.example — set APP_PASSWORD"; }
mkdir -p data
ensure_tls
fix_owner

if [ "$REBUILD" = yes ]; then
  log "deploy $(echo "$NEW" | cut -c1-7): rebuilding container"
  if dc up -d --build --remove-orphans >> "$LOG" 2>&1 && healthy; then
    log "rebuild ok"; rm -f .deploy-bad
  elif [ "$OLD" != none ]; then
    # the new version didn't come up: put the previous one back (files and container) and don't retry this commit
    echo "$NEW" > .deploy-bad
    log "NEW VERSION DIDN'T START — rolling back to $(echo "$OLD" | cut -c1-7)"
    g reset -q --hard "$OLD"
    dc up -d --build --remove-orphans >> "$LOG" 2>&1 && healthy && log "rollback ok" || log "ROLLBACK FAILED — check docker logs cadence"
  else
    log "REBUILD FAILED — see above"
  fi
else
  log "deploy $(echo "$NEW" | cut -c1-7): $(echo $CHANGED) (live, no rebuild)"
fi
if [ "$TLS_NEW" = yes ]; then log "new certificate: restarting"; docker restart cadence >> "$LOG" 2>&1 || log "restart failed"; fi
ensure_running
# keep the log small
tail -n 300 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
