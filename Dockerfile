FROM node:22-alpine
WORKDIR /app
COPY server.js ./
COPY server ./server
COPY public ./public
ENV PORT=8484 HTTPS_PORT=8443 TLS_DIR=/certs DATA_DIR=/data NODE_ENV=production
VOLUME /data
EXPOSE 8484 8443
# run as the image's unprivileged `node` user (uid 1000); deploy.sh hands data/ and certs/ to that user on the NAS
USER node
# /healthz answers on plain http in both modes (with https on, port 8484 only redirects, but /healthz still answers)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:8484/healthz >/dev/null || exit 1
# node:sqlite is built in (Node 22+); it still prints an "experimental" notice, which we silence
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
