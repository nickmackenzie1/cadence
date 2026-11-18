'use strict';
// The music side in its own process (user, 2026-11-17: "radar should be its own thing"; it kept freezing or crashing
// the whole app): Music Radar, Radio and KEXP history run here, started and watched by the main server
// (lib/music-proxy.js), which passes /api/radar/* and /api/radio/* through after its own sign-in check. If this
// process stalls or crashes, tasks and everything else keep working, and it's started again.
// Listens on 127.0.0.1 only, on a port it reports back to the main server, and answers only requests carrying the
// main server's one-time key.
require('./lib/keys').watch();   // keys pasted in Settings → Connections reach this process too
const http = require('http');
const { NEXT, send } = require('./lib/http');
const problems = require('./lib/problems');
const KEY = process.env.MUSIC_KEY || '';
problems.watchCrashes('Music side');
const K = require('./services/kexp-log');             // keeps KEXP's play history (and steps aside while you use Radar)
require('./services/kexp-archive');                   // saves the KEXP shows you keep
const routes = [require('./routes/radar'), require('./routes/radio')];

const busy = new Map(); let seq = 0, tick = Date.now();
setInterval(() => { const lag = Date.now() - tick - 1000; tick = Date.now(); if (lag >= 3000) { const m = `music side stuck for ${(lag / 1000).toFixed(1)}s${busy.size ? ' while serving ' + [...new Set(busy.values())].slice(0, 5).join(', ') : ' (background work)'}`; console.log('! ' + m); problems.record('stuck', m, { ms: lag }); } }, 1000).unref();

const server = http.createServer(async (req, res) => {
  if (!KEY || req.headers['x-cadence-music'] !== KEY) { res.writeHead(403); return res.end(); }
  const id = ++seq, t = Date.now(), url = new URL(req.url, 'http://x'), p = url.pathname.replace(/^.*?\/api\//, '/api/');
  busy.set(id, p); if (req.headers['x-cadence-active'] || /\/stream$/.test(p)) require('./lib/scheduler').touch();   // you, not an open tab's automatic checks (see auth.js)
  res.on('close', () => {
    busy.delete(id); const ms = Date.now() - t;
    if (ms > 2000 && !/\/stream$/.test(p)) { console.log(`slow: ${req.method} ${p} took ${(ms / 1000).toFixed(1)}s`); problems.record('slow', `${req.method} ${p} took ${(ms / 1000).toFixed(1)}s`, { path: p, ms }); }
  });
  try {
    for (const route of routes) if (await route(req, res, { url, p, leaf: p }) !== NEXT) return;
    send(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error(e); problems.record('error', `${req.method} ${p}: ${e.message}`, { stack: e.stack });
    if (!res.headersSent) send(res, 500, { error: e.message }); else res.destroy();
  }
});
server.listen(0, '127.0.0.1', () => { if (process.send) process.send({ port: server.address().port }); console.log('Music side running (Radar, Radio, KEXP)'); });
// the main server went away: so do we
process.on('disconnect', () => process.exit(0));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => process.exit(0));
