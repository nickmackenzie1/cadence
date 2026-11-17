'use strict';
// Starts the music side (server/music.js) as its own process, restarts it if it stops, and passes /api/radar/* and
// /api/radio/* to it (streams included). While it's starting or restarting, those requests wait up to 20 s and then
// get a plain "starting up" answer; nothing else in Cadence is affected. MUSIC_PROCESS=0 runs it in-process instead.
const { fork } = require('child_process');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { NEXT, send } = require('./http');
const problems = require('./problems');
const KEY = crypto.randomBytes(24).toString('hex');
let child = null, port = null, waiters = [], stopping = false, restarts = [];

function start() {
  port = null;
  child = fork(path.join(__dirname, '..', 'music.js'), [], {
    env: { ...process.env, MUSIC_KEY: KEY, MUSIC_CHILD: '1' },
    execArgv: ['--disable-warning=ExperimentalWarning', ...(process.env.MUSIC_MAX_MB ? [`--max-old-space-size=${+process.env.MUSIC_MAX_MB}`] : [])],
    stdio: 'inherit',
  });
  const me = child;
  me.on('message', m => { if (m && m.port && me === child) { port = m.port; for (const w of waiters.splice(0)) w(true); } });
  me.on('exit', (code, sig) => {
    if (me !== child) return;
    child = null; port = null;
    if (stopping) return;
    const why = sig ? `was stopped (${sig}${sig === 'SIGKILL' ? ', often running out of memory' : ''})` : `exited with code ${code}`;
    problems.record('stopped', `The music side (Radar, Radio, KEXP) ${why}; starting it again`, { code, signal: sig || null });
    restarts = restarts.filter(t => Date.now() - t < 10 * 60e3); restarts.push(Date.now());
    const wait = restarts.length <= 2 ? 1000 : Math.min(60e3, 5000 * restarts.length);   // don't spin if it keeps failing
    setTimeout(() => { if (!stopping) start(); }, wait).unref();
  });
}
const ready = ms => (port ? Promise.resolve(true) : new Promise(r => { waiters.push(r); setTimeout(() => r(!!port), ms).unref(); }));

async function route(req, res, { p }) {
  if (!(p.startsWith('/api/radar') || p.startsWith('/api/radio'))) return NEXT;
  if (!child && !stopping) start();
  if (!(await ready(20000))) return send(res, 503, { error: 'Music is starting up. Try again in a moment.' });
  return new Promise(resolve => {
    const up = http.request({ host: '127.0.0.1', port, method: req.method, path: req.url, headers: { ...req.headers, 'x-cadence-music': KEY } }, r => {
      res.writeHead(r.statusCode || 502, r.headers); r.pipe(res); r.on('end', resolve); r.on('error', () => { res.destroy(); resolve(); });
    });
    up.on('error', () => { if (!res.headersSent) send(res, 503, { error: 'Music is restarting. Try again in a moment.' }); else res.destroy(); resolve(); });
    res.on('close', () => { up.destroy(); resolve(); });   // a stream you stopped listening to
    req.pipe(up);
  });
}
function stop() { stopping = true; if (child) try { child.kill('SIGTERM'); } catch {} }
process.on('exit', stop);
module.exports = { route, start, stop };
