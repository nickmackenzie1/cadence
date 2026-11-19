'use strict';
// Problems (user, 2026-11-17: "should i put some error logging and view it somewhere with these crashes?"):
// a plain file in the data folder (not the database, so it works when the database is what's struggling),
// newest last, 2 MB then rolled over. What lands here:
//   error    a server error, with where it came from (stack)
//   failed   a request answered with 5xx
//   slow     a request that took over 2 s
//   stuck    the whole app blocked for 3 s or more, and what it was doing
//   stopped  the previous run ended without shutting down (crash, out of memory, killed), found on the next start
//   browser  an error in the app in your browser
// A heartbeat file (every 20 s, with memory use; removed on a clean stop) is how an unexpected stop is noticed and dated.
const fs = require('fs'), path = require('path');
const { DATA_DIR } = require('../config');
const FILE = path.join(DATA_DIR, 'problems.jsonl'), OLD = FILE + '.1', BEAT = path.join(DATA_DIR, '.heartbeat');
const MAX = 2 * 1024 * 1024;
let last = { key: '', at: 0, n: 0 };
const mem = () => { const m = process.memoryUsage(); return Math.round(m.rss / 1048576); };
function record(kind, msg, extra = {}) {
  try {
    const key = kind + '|' + msg;
    if (key === last.key && Date.now() - last.at < 60e3) { last.n++; return; }   // the same thing again within a minute: once
    const repeats = last.n; last = { key, at: Date.now(), n: 0 };
    const row = { at: new Date().toISOString(), kind, msg: String(msg).slice(0, 500), mb: mem(), ...extra };
    if (repeats) row.before = `the previous problem repeated ${repeats} more time${repeats === 1 ? '' : 's'}`;
    if (row.stack) row.stack = String(row.stack).split('\n').slice(0, 12).join('\n');
    try { if (fs.statSync(FILE).size > MAX) fs.renameSync(FILE, OLD); } catch {}
    fs.appendFileSync(FILE, JSON.stringify(row) + '\n');
  } catch { /* never let logging break anything */ }
}
function list(limit = 300) {
  const out = [];
  for (const f of [FILE, OLD]) { try { for (const l of fs.readFileSync(f, 'utf8').split('\n')) if (l) try { out.push(JSON.parse(l)); } catch {} } catch {} }
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
function clear() { for (const f of [FILE, OLD]) try { fs.unlinkSync(f); } catch {} }

// on start: did the last run stop without saying goodbye?
function startWatch(version) {
  try {
    const b = JSON.parse(fs.readFileSync(BEAT, 'utf8'));
    if (b) record('stopped', `THING stopped unexpectedly, last seen ${b.at} (crash, out of memory, or the container was killed)`, { lastMb: b.mb, lastVersion: b.version, doing: b.doing || null });
  } catch {}
  // a clean stop removes the heartbeat (it never writes on the way out), so one left behind means it didn't stop cleanly
  const beat = () => { try { fs.writeFileSync(BEAT, JSON.stringify({ at: new Date().toISOString(), mb: mem(), version, doing: current() })); } catch {} };
  try { fs.unlinkSync(BEAT); } catch {}
  beat(); setInterval(beat, 20e3).unref();
  const bye = () => { try { fs.unlinkSync(BEAT); } catch {} };
  process.on('SIGTERM', bye); process.on('SIGINT', bye); process.on('exit', code => { if (code === 0) bye(); });
  watchCrashes('', beat);
}
// an uncaught error: logged with its stack, then the process ends (it's restarted); an unhandled promise: logged only
function watchCrashes(who = '', before = () => {}) {
  const pre = who ? who + ': ' : '';
  process.on('uncaughtException', e => { record('error', pre + 'Crashed: ' + (e && e.message), { stack: e && e.stack }); console.error(e); try { before(); } catch {} process.exit(1); });
  process.on('unhandledRejection', e => { record('error', pre + 'Unhandled: ' + (e && e.message || e), { stack: e && e.stack }); console.error('unhandled', e); });
}
// what the server is serving right now (server.js sets this), so "stopped" and "stuck" can say what was going on
let currentFn = () => null;
const current = () => { try { return currentFn(); } catch { return null; } };
const setCurrent = fn => { currentFn = fn; };
module.exports = { record, list, clear, startWatch, watchCrashes, setCurrent };
