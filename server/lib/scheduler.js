'use strict';
/* One place for background work (user, 2026-11-17: "build the scheduler"). Before this, each feature kept its own
   timers (KEXP backfill and artist summary, Radar scans, artist page warm-ups, Said the Gramophone, database upkeep,
   feed checks…), and when several heavy ones ran at once the NAS froze. Now each process (the main app and the music
   side) has one scheduler:
   - heavy jobs run one at a time, in the order they came due;
   - "quiet" jobs wait while you're using the app (any request in the last QUIET_MS, 2 minutes by default);
   - a job can be limited to some hours (e.g. 2–5 am), and can ask to run again sooner ({ again: ms }) or to stop
     ({ done: true }) when it has nothing left to do;
   - every job's last run, how long it took, its last error and when it runs next are kept for the Problems page.

   add(name, fn, { label, every, first, heavy, quiet, hours: [from, to], retry })
     every   ms between runs (or a function returning ms); first: ms before the first run (default: every)
     retry   ms before trying again after an error (default: every)
   touch()   call on every request that means "someone is using Cadence" (app.js, music.js)
   list()    for /api/jobs and /api/radar/jobs
   SCHEDULER_TICK (ms, default 1000) and QUIET_MS (default 120000) can be set in .env; tests set them low. */

const QUIET_MS = +process.env.QUIET_MS || +process.env.KEXP_QUIET_MS || 120e3;
const TICK = +process.env.SCHEDULER_TICK || 1000;
const jobs = new Map();
let lastUse = 0, heavyNow = null, timer = null;

const touch = () => { lastUse = Date.now(); };
const inUse = () => Date.now() - lastUse < QUIET_MS;
const ms = (v, d) => { const x = typeof v === 'function' ? v() : v; return Number.isFinite(+x) && +x >= 0 ? +x : d; };
const inHours = ([from, to], h = new Date().getHours()) => from <= to ? h >= from && h < to : h >= from || h < to;

function add(name, fn, o = {}) {
  const j = { name, label: o.label || name, fn, every: o.every ?? 3600e3, retry: o.retry, heavy: !!o.heavy, quiet: !!o.quiet, hours: o.hours || null,
    next: Date.now() + ms(o.first ?? o.every, 3600e3), running: false, waiting: null, runs: 0, fails: 0, last: null, stopped: false };
  jobs.set(name, j);
  if (!timer) { timer = setInterval(tick, TICK); timer.unref(); }
  return j;
}
function stop(name) { const j = jobs.get(name); if (j) { j.stopped = true; j.waiting = null; } }
// run a job at the next tick (the rules still apply: a heavy job waits for its turn, a quiet one for a quiet moment)
function soon(name, delay = 0) { const j = jobs.get(name); if (j) { j.stopped = false; j.next = Math.min(j.next, Date.now() + delay); } }

function tick() {
  const now = Date.now();
  for (const j of [...jobs.values()].sort((a, b) => a.next - b.next)) {
    if (j.stopped || j.running || now < j.next) continue;
    if (j.hours && !inHours(j.hours)) { j.waiting = `waits for ${j.hours[0]}:00–${j.hours[1]}:00`; j.next = now + 5 * 60e3; continue; }
    if (j.quiet && inUse()) { j.waiting = 'waits while you use Cadence'; continue; }
    if (j.heavy && heavyNow) { j.waiting = `waits for ${heavyNow.label}`; continue; }
    run(j);
  }
}
function run(j) {
  j.running = true; j.waiting = null; if (j.heavy) heavyNow = j;
  const t0 = Date.now();
  let p; try { p = Promise.resolve(j.fn()); } catch (e) { p = Promise.reject(e); }
  p.then(r => {
    j.runs++; j.last = { at: t0, ms: Date.now() - t0, ok: true, note: r && r.note ? String(r.note).slice(0, 200) : null };
    if (r && r.done) { j.stopped = true; j.finished = Date.now(); }
    j.next = Date.now() + (r && r.again != null ? ms(r.again, 0) : ms(j.every, 3600e3));
  }, e => {
    j.runs++; j.fails++; j.last = { at: t0, ms: Date.now() - t0, ok: false, error: String(e && e.message || e).slice(0, 300) };
    j.next = Date.now() + ms(j.retry ?? j.every, 60e3);
    console.error(`job ${j.label}: ${j.last.error}`);
    if (j.fails % 5 === 1) try { require('./problems').record('error', `Background job "${j.label}" failed: ${j.last.error}`, { stack: e && e.stack }); } catch {}
  }).finally(() => {
    j.running = false; if (heavyNow === j) heavyNow = null;
    // something asked to go again sooner than the next tick (or another heavy job was waiting): look now
    const wait = Math.max(0, Math.min(j.next - Date.now(), TICK));
    if (wait < TICK) setTimeout(tick, wait).unref(); else setImmediate(tick);
  });
}

function list(where = 'app') {
  const now = Date.now();
  return [...jobs.values()].map(j => ({ name: j.name, label: j.label, where, heavy: j.heavy, quiet: j.quiet, hours: j.hours,
    state: j.running ? 'running' : j.stopped ? (j.finished ? 'finished' : 'stopped') : (j.waiting && now >= j.next) ? 'waiting' : 'scheduled',
    waiting: j.running || j.stopped || now < j.next ? null : j.waiting, next: j.stopped || j.running ? null : j.next, runs: j.runs, fails: j.fails, last: j.last }));
}

module.exports = { add, stop, soon, touch, inUse, list, _tick: tick, QUIET_MS };
