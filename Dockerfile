FROM node:20-alpine
WORKDIR /app
COPY server.js ./
COPY public ./public
ENV PORT=8484 HTTPS_PORT=8443 TLS_DIR=/certs DATA_DIR=/data NODE_ENV=production
VOLUME /data
EXPOSE 8484 8443
CMD ["node", "server.js"]
