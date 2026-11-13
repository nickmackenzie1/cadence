// Cadence self-hosted server — zero dependencies, Node 22+.
// Serves the app, stores your data in /data, keeps daily backups, and (optionally) proxies AI to the Anthropic API.
//
// Layout:
//   server/config.js        settings from the environment, data folder layout
//   server/app.js           the request pipeline (security, sign-in gate, routes, static files)
//   server/routes/*.js      the API, grouped by area (sync, feeds, push, calendar…)
//   server/services/*.js    the work behind the routes (feeds, push, calendar, company info, recipes…)
//   server/lib/*.js         shared building blocks (http helpers, auth, storage, safe fetch, TLS, build id)
'use strict';
const http = require('http');
const { API_KEY, DATA_DIR, HTTPS_PORT, HTTPS_PUBLIC_PORT, PASSWORD, PORT } = require('./server/config');
const { storageInfo } = require('./server/lib/storage');
const { TLS, caFingerprint, sendCA } = require('./server/lib/tls');
const { handle } = require('./server/app');
require('./server/services/push');    // starts the reminder push timer
require('./server/services/feeds');   // starts the feed history checks

const { storage, storageNote } = storageInfo();
const tag = `data=${DATA_DIR}  storage=${storage}${storageNote ? ' (' + storageNote + ')' : ''}  ai=${API_KEY ? 'on' : 'off'}  auth=${PASSWORD ? 'on' : 'off'}`;
if (TLS) {
  require('https').createServer(TLS, handle).listen(HTTPS_PORT, () => console.log(`Cadence running on https :${HTTPS_PORT}  ${tag}  CA ${caFingerprint() || 'unknown'}`));
  // plain HTTP: nothing but a redirect (so a password is never sent unencrypted) and the public CA download
  http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname.replace(/^.*\//, '/') === '/ca.crt') return sendCA(res);
    const host = String(req.headers.host || 'localhost').replace(/:\d+$/, '').replace(/[^\w.\-\[\]:]/g, '');
    res.writeHead(307, { Location: `https://${host}:${HTTPS_PUBLIC_PORT}${u.pathname}${u.search}`, 'Cache-Control': 'no-store' });
    res.end();
  }).listen(PORT, () => console.log(`Cadence http :${PORT} redirects to https :${HTTPS_PORT}`));
} else {
  http.createServer(handle).listen(PORT, () => console.log(`Cadence running on :${PORT}  ${tag}  https=off`));
}
