'use strict';
/* The request pipeline: security checks, the sign-in gate, the API routes, then the app's static files. */
const fs = require('fs');
const path = require('path');
const { MIME, PASSWORD, PUBLIC_DIR } = require('./config');
const { OPEN, authorized, sameOrigin } = require('./lib/auth');
const { NEXT, send } = require('./lib/http');
const { TLS, sendCA } = require('./lib/tls');

const routes = {
  auth: require('./routes/auth'),
  system: require('./routes/system'),
  sync: require('./routes/sync'),
  lookup: require('./routes/lookup'),
  feeds: require('./routes/feeds'),
  push: require('./routes/push'),
  integrations: require('./routes/integrations'),
  files: require('./routes/files'),
  calendar: require('./routes/calendar'),
  radar: require('./routes/radar'),
};
const API = [routes.system, routes.sync, routes.lookup, routes.feeds, routes.push, routes.integrations, routes.files, routes.calendar, routes.radar];

// Every request goes through here, top to bottom:
//   1. the public CA download (so new devices can trust HTTPS before anything else)
//   2. refuse cross-site writes
//   3. sign in / sign out (allowed before signing in)
//   4. the sign-in gate
//   5. the API routes
//   6. static files
async function handle(req, res) {
  try {
    if (TLS && new URL(req.url, 'http://x').pathname.replace(/^.*\//, '/') === '/ca.crt') return sendCA(res);
    const url = new URL(req.url, 'http://x');
    const p = url.pathname.replace(/^.*?\/api\//, '/api/'); // works behind a sub-path reverse proxy
    const leaf = p.startsWith('/api/') ? p : '/' + url.pathname.split('/').slice(-1)[0];
    const iconish = /^\/icons\/icon-\d+\.png$/.test(url.pathname.replace(/^.*(\/icons\/)/, '/icons/'));
    if (req.method !== 'GET' && req.method !== 'HEAD' && !sameOrigin(req)) return send(res, 403, { error: 'Cross-site request refused' });

    const ctx = { url, p, leaf };
    // routes that work before signing in
    if (await routes.auth(req, res, ctx) !== NEXT) return;

    if (!authorized(req)) {
      if (OPEN.has(leaf) || iconish) { /* public asset */ }
      else if (p.startsWith('/api/')) return send(res, 401, { error: 'Sign in required' });
      else {
        const next = url.pathname + url.search;
        res.writeHead(302, { Location: 'login' + (next && next !== '/' ? '?next=' + encodeURIComponent(next) : ''), 'Cache-Control': 'no-store' });
        return res.end();
      }
    }
    if (leaf === '/login' && PASSWORD && authorized(req)) { res.writeHead(302, { Location: './', 'Cache-Control': 'no-store' }); return res.end(); }

    // the API, in order: the first route that answers wins
    for (const route of API) if (await route(req, res, ctx) !== NEXT) return;

    if (p.startsWith('/api/')) return send(res, 404, { error: 'Not found' });

    // anything else is a file of the app itself (public/); unknown paths get index.html so links into the app work
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    if (leaf === '/login') rel = '/login.html';
    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden', 'text/plain');
    fs.readFile(file, (err, buf) => {
      if (err) return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, idx) => e2 ? send(res, 404, 'Not found', 'text/plain') : send(res, 200, idx, MIME['.html']));
      send(res, 200, buf, MIME[path.extname(file)] || 'application/octet-stream');
    });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: e.message });
  }
}

module.exports = { handle };
