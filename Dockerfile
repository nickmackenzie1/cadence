FROM node:22-alpine
# ffmpeg pulls the audio out and writes the tags for Downloads (yt-dlp itself is a standalone program THING keeps
# up to date in data/bin, so no Python here)
RUN apk add --no-cache su-exec ffmpeg
WORKDIR /app
COPY entrypoint.sh /usr/local/bin/cadence-entrypoint
RUN chmod 755 /usr/local/bin/cadence-entrypoint
COPY server.js ./
COPY server ./server
COPY public ./public
ENV PORT=8484 HTTPS_PORT=8443 TLS_DIR=/certs DATA_DIR=/data NODE_ENV=production
VOLUME /data
EXPOSE 8484 8443
# Starts as root only to check permissions, then drops to the `node` user (see entrypoint.sh; RUN_AS_ROOT=1 to opt out)
ENTRYPOINT ["cadence-entrypoint"]
# /healthz answers on plain http in both modes (with https on, port 8484 only redirects, but /healthz still answers)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:8484/healthz >/dev/null || exit 1
# node:sqlite is built in (Node 22+); it still prints an "experimental" notice, which we silence
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
