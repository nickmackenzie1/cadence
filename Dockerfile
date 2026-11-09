FROM node:22-alpine
WORKDIR /app
COPY server.js ./
COPY public ./public
ENV PORT=8484 HTTPS_PORT=8443 TLS_DIR=/certs DATA_DIR=/data NODE_ENV=production
VOLUME /data
EXPOSE 8484 8443
# node:sqlite is built in (Node 22+); it still prints an "experimental" notice, which we silence
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
