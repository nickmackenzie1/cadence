#!/bin/sh
# Starts Cadence as the unprivileged `node` user when that's safe, otherwise stays root and says why in the log.
# (2026-11-13: switching to `node` blindly broke HTTPS and sign-in, because the key in certs/ was root-only.)
# RUN_AS_ROOT=1 in .env skips all of this.
set -u
[ "$(id -u)" = 0 ] && [ "${RUN_AS_ROOT:-}" != 1 ] || exec "$@"
U=node; why=""
as(){ su-exec "$U" "$@"; }

# certs/ is mounted read-only and root-only: copy it to a private folder only the app user can read
SRC="${TLS_DIR:-/certs}"
if [ -s "$SRC/key.pem" ]; then
  T=/run/cadence-certs; rm -rf "$T"; mkdir -p "$T"
  if cp "$SRC"/*.pem "$T"/ 2>/dev/null && chown -R "$U:$U" "$T" && chmod 700 "$T" && chmod 600 "$T"/*.pem; then
    export TLS_DIR="$T"
  fi
  as test -r "$TLS_DIR/key.pem" || why="can't make the certificate readable"
fi

# data/: give it to the app user, then prove every file is writable
D="${DATA_DIR:-/data}"; mkdir -p "$D"
[ -n "$(find "$D" ! -user "$U" -print -quit 2>/dev/null)" ] && chown -R "$U:$U" "$D" 2>/dev/null
if [ -z "$why" ]; then
  p="$D/.write-test-$$"
  if ! as sh -c "touch '$p' && rm -f '$p'" 2>/dev/null; then why="the data folder isn't writable by the app user (check the NAS folder permissions)"
  else
    bad="$(as sh -c 'find "$1" -type f | while read -r f; do [ -w "$f" ] || { echo "$f"; break; }; done' _ "$D")"
    [ -n "$bad" ] && why="$bad isn't writable by the app user"
  fi
fi

# the Downloads folders: new (empty) ones made by Docker belong to root; give those to the app user. A folder that
# already has your music in it is left as it is; THING says on its Downloads page if it can't write there.
for M in /music /slskd /usenet; do
  [ -d "$M" ] && [ -z "$(ls -A "$M" 2>/dev/null)" ] && [ "$(stat -c %u "$M")" = 0 ] && chown "$U:$U" "$M" 2>/dev/null
done

if [ -n "$why" ]; then
  echo "cadence: staying root — $why" >&2
  export TLS_DIR="$SRC"; exec "$@"
fi
echo "cadence: running as $U"
exec su-exec "$U" "$@"
