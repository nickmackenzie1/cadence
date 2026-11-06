FROM node:20-alpine
WORKDIR /app
COPY server.js ./
COPY public ./public
ENV PORT=8484 DATA_DIR=/data NODE_ENV=production
VOLUME /data
EXPOSE 8484
CMD ["node", "server.js"]
