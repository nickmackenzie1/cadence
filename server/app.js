'use strict';
/* The request pipeline: security checks, the sign-in gate, the API routes, then the app's static files. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { MIME, PASSWORD, PUBLIC_DIR } = require('./config');
const { OPEN, authorized, sameOrigin } = require('./lib/auth');
const { NEXT, send } = require('./lib/http');
const { TLS, sendCA } = require('./lib/tls');
const bundle = require('./lib/bundle');

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
    // for the container healthcheck and deploy.sh: says only that the server answers, nothing else
    if (req.url === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); return res.end('ok'); }
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
    // vendored libraries (fonts, engines, Harper's 20 MB WebAssembly) don't change between deploys of the same build:
    // the browser keeps them and asks "still the same?" (304), and big ones go out gzipped (compressed once, kept in memory)
    if (rel.startsWith('/vendor/')) return sendVendor(req, res, file);
    // the app's own scripts go out as one gzipped bundle.js (server/lib/bundle.js); index.html points at it
    if (rel === '/bundle.js') return bundle.serve(req, res, url);
    fs.readFile(file, (err, buf) => {
      if (err) return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, idx) => e2 ? send(res, 404, 'Not found', 'text/plain') : sendApp(req, res, bundle.page(idx, url), MIME['.html']));
      sendApp(req, res, rel === '/index.html' ? bundle.page(buf, url) : buf, MIME[path.extname(file)] || 'application/octet-stream');
    });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: e.message });
  }
}

// the app's own files (core.css, the login page, icons, index.html): the browser keeps them and asks "still the
// same?" each time (ETag from the content, 304 when unchanged); text over 1 KB goes out gzipped
const appCache = new Map();
function sendApp(req, res, body, type) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  const etag = '"' + require('crypto').createHash('sha1').update(buf).digest('base64url').slice(0, 20) + '"';
  const head = { 'Content-Type': type, 'Cache-Control': 'no-cache', ETag: etag, 'X-Content-Type-Options': 'nosniff', Vary: 'Accept-Encoding' };
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, head); return res.end(); }
  if (buf.length > 1024 && /^(text\/|application\/(json|javascript|manifest)|image\/svg)/.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    let gz = appCache.get(etag); if (!gz) { gz = zlib.gzipSync(buf, { level: 6 }); if (appCache.size > 200) appCache.clear(); appCache.set(etag, gz); }
    res.writeHead(200, { ...head, 'Content-Encoding': 'gzip' }); return res.end(gz);
  }
  res.writeHead(200, head); res.end(buf);
}

const gzCache = new Map();
function sendVendor(req, res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found', 'text/plain');
    const etag = `"${st.size.toString(36)}-${Math.round(st.mtimeMs).toString(36)}"`;
    const type = MIME[path.extname(file)] || 'application/octet-stream';
    const head = { 'Content-Type': type, 'Cache-Control': 'no-cache', ETag: etag, 'X-Content-Type-Options': 'nosniff', Vary: 'Accept-Encoding' };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, head); return res.end(); }
    const gz = st.size > 256 * 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '') && !/woff2$/.test(file);
    if (!gz) return fs.readFile(file, (e, buf) => { if (e) return send(res, 404, 'Not found', 'text/plain'); res.writeHead(200, head); res.end(buf); });
    const hit = gzCache.get(file);
    if (hit && hit.etag === etag) { res.writeHead(200, { ...head, 'Content-Encoding': 'gzip' }); return res.end(hit.buf); }
    fs.readFile(file, (e, buf) => {
      if (e) return send(res, 404, 'Not found', 'text/plain');
      zlib.gzip(buf, { level: 6 }, (ze, out) => {
        if (ze) { res.writeHead(200, head); return res.end(buf); }
        gzCache.set(file, { etag, buf: out });
        res.writeHead(200, { ...head, 'Content-Encoding': 'gzip' }); res.end(out);
      });
    });
  });
}

module.exports = { handle };
