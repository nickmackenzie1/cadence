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
require('./server/lib/keys').load();   // keys pasted in Settings → Connections (data/keys.json) go into the environment first
const { aiKey, DATA_DIR, HTTPS_PORT, HTTPS_PUBLIC_PORT, PASSWORD, PORT } = require('./server/config');
const { storageInfo } = require('./server/lib/storage');
const { TLS, caFingerprint, sendCA } = require('./server/lib/tls');
const { handle } = require('./server/app');
require('./server/services/push');    // starts the reminder push timer
require('./server/services/feeds');   // starts the feed history checks
// the music side: its own process (Radar, Radio, KEXP history), started now so scans and KEXP logging run; MUSIC_PROCESS=0 keeps it in here
if (process.env.MUSIC_PROCESS !== '0') require('./server/lib/music-proxy').start(); else { require('./server/services/kexp-log'); require('./server/services/kexp-archive'); }

// Slow things say so in the log (2026-11-17: the NAS stopped answering and nothing said why). A request over 2 s
// is logged with its path; if the whole app is stuck for 3 s or more, the log says so and what it was serving.
const problems = require('./server/lib/problems');
const busy = new Map(); let seq = 0;
problems.setCurrent(() => (busy.size ? [...new Set(busy.values())].slice(0, 5).join(', ') : null));
problems.startWatch((() => { try { return require('./public/version.json').version; } catch { return '?'; } })());   // package.json isn't in the image
const timed = (req, res) => {
  const id = ++seq, t = Date.now(), path = String(req.url || '').split('?')[0].slice(0, 80);
  busy.set(id, path);
  res.on('close', () => {
    busy.delete(id); const ms = Date.now() - t;
    if (ms > 2000 && !/\/stream$|\/events$/.test(path)) { console.log(`slow: ${req.method} ${path} took ${(ms / 1000).toFixed(1)}s`); problems.record('slow', `${req.method} ${path} took ${(ms / 1000).toFixed(1)}s`, { path, ms }); }
    if (res.statusCode >= 500 && res.statusCode !== 502 && res.statusCode !== 504) problems.record('failed', `${req.method} ${path} answered ${res.statusCode}`, { path, status: res.statusCode, error: res.problem || null });
  });
  return handle(req, res);
};
let tick = Date.now();
setInterval(() => { const lag = Date.now() - tick - 1000; tick = Date.now(); if (lag >= 3000) { const m = `stuck for ${(lag / 1000).toFixed(1)}s${busy.size ? ' while serving ' + [...new Set(busy.values())].slice(0, 5).join(', ') : ' (background work)'}`; console.log('! ' + m); problems.record('stuck', m, { ms: lag }); } }, 1000).unref();

const { storage, storageNote } = storageInfo();
const tag = `data=${DATA_DIR}  storage=${storage}${storageNote ? ' (' + storageNote + ')' : ''}  ai=${aiKey() ? 'on' : 'off'}  auth=${PASSWORD ? 'on' : 'off'}`;
if (TLS) {
  require('https').createServer(TLS, timed).listen(HTTPS_PORT, () => console.log(`THING running on https :${HTTPS_PORT}  ${tag}  CA ${caFingerprint() || 'unknown'}`));
  // plain HTTP: nothing but a redirect (so a password is never sent unencrypted) and the public CA download
  http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname.replace(/^.*\//, '/') === '/ca.crt') return sendCA(res);
    if (req.url === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); return res.end('ok'); }   // container healthcheck
    const host = String(req.headers.host || 'localhost').replace(/:\d+$/, '').replace(/[^\w.\-\[\]:]/g, '');
    res.writeHead(307, { Location: `https://${host}:${HTTPS_PUBLIC_PORT}${u.pathname}${u.search}`, 'Cache-Control': 'no-store' });
    res.end();
  }).listen(PORT, () => console.log(`THING http :${PORT} redirects to https :${HTTPS_PORT}`));
} else {
  http.createServer(timed).listen(PORT, () => console.log(`THING running on :${PORT}  ${tag}  https=off`));
}

// compress the bundles this NAS's browsers use, right away, so the first visit after a release gets the small copy
setTimeout(() => { try { require('./server/lib/bundle').warm(); } catch {} }, 500).unref();
