#!/bin/sh
# Cadence auto-deploy for Synology.
# Run from DSM Task Scheduler as root, e.g. every 5 minutes:
#   REPO=owner/cadence TOKEN=github_pat_xxx APP_PASSWORD=secret sh /volume1/docker/cadence/deploy.sh
# Optional vars: APP_USERNAME, ANTHROPIC_API_KEY, TZ, BRANCH, HTTPS_PORT (default 8443). They're written to .env (never committed).
# HTTPS: tls.sh keeps a mkcert certificate in certs/ (HTTPS=off to skip, CERT_HOSTS="..." to set the names).
# - Pulls the latest commit from GitHub (read-only token)
# - Changes to public/ go live instantly (mounted into the container)
# - Changes to server.js / Dockerfile / docker-compose.yml trigger a rebuild
# - Never touches data/ or .env
set -eu
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
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

# settings passed from Task Scheduler -> .env (restart container if they changed)
write_env(){
  {
    echo "TZ=${TZ:-America/Toronto}"
    echo "APP_USERNAME=${APP_USERNAME:-cadence}"
    echo "APP_PASSWORD=${APP_PASSWORD:-}"
    echo "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}"
    echo "HTTPS_PORT=${HTTPS_PORT:-8443}"
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
  ensure_running
  exit 0
fi

if [ "$OLD" = none ]; then CHANGED="all"; else CHANGED="$(g diff --name-only "$OLD" "$NEW")"; fi
g reset -q --hard "$NEW"
rm -f "$DIR/index.html"                    # leftover from the manual install
[ -f .env ] || { cp .env.example .env; log "created .env from .env.example — set APP_PASSWORD"; }
mkdir -p data
ensure_tls

[ "$ENV_CHANGED" = yes ] && CHANGED="$CHANGED
docker-compose.yml"
if echo "$CHANGED" | grep -qE '^(all|server\.js|Dockerfile|docker-compose\.yml|deploy\.sh|tls\.sh)$'; then
  log "deploy $(echo "$NEW" | cut -c1-7): rebuilding container"
  dc up -d --build --remove-orphans >> "$LOG" 2>&1 && log "rebuild ok" || log "REBUILD FAILED — see above"
else
  log "deploy $(echo "$NEW" | cut -c1-7): $(echo $CHANGED) (live, no rebuild)"
fi
if [ "$TLS_NEW" = yes ]; then log "new certificate: restarting"; docker restart cadence >> "$LOG" 2>&1 || log "restart failed"; fi
ensure_running
# keep the log small
tail -n 300 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
