#!/bin/sh
# Cadence local HTTPS with mkcert. Called by deploy.sh; safe to run on its own:
#   sh /volume1/docker/cadence/tls.sh
# - Makes a private certificate authority on the NAS (.mkcert-ca/, never mounted, never committed)
# - Issues a certificate for the NAS's LAN names and IPs into certs/ (mounted read-only at /certs)
# - Re-issues when the names/IPs change or the certificate is within 30 days of expiry
# Optional vars: CERT_HOSTS="cadence.lan 192.168.1.20" (extra names, added to the auto-detected ones), HTTPS=off (skip)
# Exit codes: 0 = nothing changed, 10 = new certificate (restart the container), 1 = error
set -eu
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
LOG="$DIR/deploy.log"
log(){ echo "$(date '+%F %T') tls: $*" >> "$LOG"; }
[ "${HTTPS:-on}" = off ] && exit 0
umask 077

VER=1.4.4
case "$(uname -m)" in
  x86_64|amd64)  ARCH=amd64; SUM=6d31c65b03972c6dc4a14ab429f2928300518b26503f58723e532d1b0a3bbb52 ;;
  aarch64|arm64) ARCH=arm64; SUM=b98f2cc69fd9147fe4d405d859c57504571adec0d3611c3eefd04107c7ac00d0 ;;
  armv7l|armv7*|armv6l) ARCH=arm; SUM=2f22ff62dfc13357e147e027117724e7ce1ff810e30d2b061b05b668ecb4f1d7 ;;
  *) log "unsupported CPU $(uname -m)"; exit 1 ;;
esac
MK="$DIR/.tools/mkcert-$VER-$ARCH"

# names and LAN IPs this NAS answers to (docker bridges and loopback-only names left out)
detect_hosts(){
  h="$(hostname 2>/dev/null | cut -d. -f1 | tr 'A-Z' 'a-z')"
  [ -n "$h" ] && echo "$h" && echo "$h.local"
  echo localhost; echo 127.0.0.1
  if command -v ip >/dev/null 2>&1; then
    ip -4 -o addr show 2>/dev/null | awk '$2 !~ /^(lo|docker|br-|veth|tun|tap)/ {split($4,a,"/"); print a[1]}'
  else
    ifconfig 2>/dev/null | awk '/^[a-z]/{i=$1} /inet addr:/{sub("addr:","",$2); if (i !~ /^(lo|docker|br-|veth|tun|tap)/) print $2}'
  fi
}
HOSTS="$( { detect_hosts; echo "${CERT_HOSTS:-}" | tr ' ,' '\n\n'; } | grep . | sort -u | tr '\n' ' ')"

mkdir -p certs .mkcert-ca .tools
chmod 700 .mkcert-ca .tools

need=no
[ -s certs/cert.pem ] && [ -s certs/key.pem ] || need=yes
[ "$(cat certs/hosts 2>/dev/null)" = "$HOSTS" ] || need=yes
if [ "$need" = no ] && command -v openssl >/dev/null 2>&1; then
  openssl x509 -checkend 2592000 -noout -in certs/cert.pem >/dev/null 2>&1 || need=yes
fi
[ "$need" = no ] && exit 0

# fetch mkcert once, pinned to a known checksum
if [ ! -x "$MK" ]; then
  URL="https://github.com/FiloSottile/mkcert/releases/download/v$VER/mkcert-v$VER-linux-$ARCH"
  if command -v curl >/dev/null 2>&1; then curl -fsSL -o "$MK.tmp" "$URL" || { log "mkcert download failed"; exit 1; }
  else wget -q -O "$MK.tmp" "$URL" || { log "mkcert download failed"; exit 1; }; fi
  if [ "$(sha256sum "$MK.tmp" | cut -d' ' -f1)" != "$SUM" ]; then rm -f "$MK.tmp"; log "mkcert checksum mismatch, not used"; exit 1; fi
  chmod 700 "$MK.tmp"; mv "$MK.tmp" "$MK"
fi

export CAROOT="$DIR/.mkcert-ca"
# shellcheck disable=SC2086
"$MK" -cert-file certs/cert.pem.new -key-file certs/key.pem.new $HOSTS >/dev/null 2>&1 || { log "mkcert failed"; rm -f certs/*.new; exit 1; }
mv certs/cert.pem.new certs/cert.pem; mv certs/key.pem.new certs/key.pem
cp "$CAROOT/rootCA.pem" certs/rootCA.pem          # public half only: this is what your devices trust
echo "$HOSTS" > certs/hosts
chmod 700 certs; chmod 600 certs/key.pem; chmod 644 certs/cert.pem certs/rootCA.pem certs/hosts
FP=""; command -v openssl >/dev/null 2>&1 && FP="$(openssl x509 -noout -fingerprint -sha256 -in certs/rootCA.pem | cut -d= -f2)"
log "issued certificate for: $HOSTS"
[ -n "$FP" ] && log "CA fingerprint SHA-256 $FP"
exit 10
