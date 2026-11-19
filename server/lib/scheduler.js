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
   touch()   call on every request that means "someone is using THING" (app.js, music.js)
   list()    for /api/jobs and /api/radar/jobs
   control(name, { action: 'run' | 'pause' | 'resume' | 'every', every })   the Background work page (user, 2026-11-18:
             "a place where we could view these jobs and control them"). Run now skips the waiting for a quiet moment
             or the right hours (heavy jobs still take turns). Pausing and a changed "how often" are kept in
             DATA_DIR/jobs-<app|music>.json, so they survive restarts.
   SCHEDULER_TICK (ms, default 1000) and QUIET_MS (default 120000) can be set in .env; tests set them low. */

const QUIET_MS = +process.env.QUIET_MS || +process.env.KEXP_QUIET_MS || 120e3;
const TICK = +process.env.SCHEDULER_TICK || 1000;
const jobs = new Map();
let lastUse = 0, heavyNow = null, timer = null;
// which process this is (each has its own scheduler and its own saved choices)
const ROLE = process.env.CADENCE_PROC || (/music\.js$/.test((require.main && require.main.filename) || '') ? 'music' : 'app');
const PREFS = () => require('path').join(process.env.DATA_DIR || '/data', `jobs-${ROLE}.json`);
let prefs = null;
const loadPrefs = () => { if (!prefs) { try { prefs = JSON.parse(require('fs').readFileSync(PREFS(), 'utf8')); } catch { prefs = {}; } prefs.paused = prefs.paused || []; prefs.every = prefs.every || {}; } return prefs; };
const savePrefs = () => { try { require('fs').writeFileSync(PREFS(), JSON.stringify(prefs, null, 1)); } catch (e) { console.error('jobs: could not save choices:', e.message); } };

const touch = () => { lastUse = Date.now(); };
const inUse = () => Date.now() - lastUse < QUIET_MS;
const ms = (v, d) => { const x = typeof v === 'function' ? v() : v; return Number.isFinite(+x) && +x >= 0 ? +x : d; };
const inHours = ([from, to], h = new Date().getHours()) => from <= to ? h >= from && h < to : h >= from || h < to;

function add(name, fn, o = {}) {
  const j = { name, label: o.label || name, fn, every: o.every ?? 3600e3, retry: o.retry, heavy: !!o.heavy, quiet: !!o.quiet, hours: o.hours || null,
    next: Date.now() + ms(o.first ?? o.every, 3600e3), running: false, waiting: null, runs: 0, fails: 0, last: null, stopped: false,
    base: o.every ?? 3600e3, paused: false, force: false, history: [] };
  const pf = loadPrefs();
  if (pf.paused.includes(name)) j.paused = true;
  if (pf.every[name] && typeof j.base === 'number' && j.base >= 60e3) { j.every = pf.every[name]; j.next = Math.min(j.next, Date.now() + j.every); }
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
    if (j.paused || j.stopped || j.running || now < j.next) continue;
    if (j.force) { if (j.heavy && heavyNow) { j.waiting = `waits for ${heavyNow.label}`; continue; } run(j); continue; }
    if (j.hours && !inHours(j.hours)) { j.waiting = `waits for ${j.hours[0]}:00–${j.hours[1]}:00`; j.next = now + 5 * 60e3; continue; }
    if (j.quiet && inUse()) { j.waiting = 'waits while you use THING'; continue; }
    if (j.heavy && heavyNow) { j.waiting = `waits for ${heavyNow.label}`; continue; }
    run(j);
  }
}
function run(j) {
  j.running = true; j.waiting = null; j.force = false; if (j.heavy) heavyNow = j;
  const t0 = Date.now();
  let p; try { p = Promise.resolve(j.fn()); } catch (e) { p = Promise.reject(e); }
  p.then(r => {
    j.runs++; j.last = { at: t0, ms: Date.now() - t0, ok: true, note: r && r.note ? String(r.note).slice(0, 200) : null }; keep(j);
    if (r && r.done) { j.stopped = true; j.finished = Date.now(); }
    j.next = Date.now() + (r && r.again != null ? ms(r.again, 0) : ms(j.every, 3600e3));
  }, e => {
    j.runs++; j.fails++; j.last = { at: t0, ms: Date.now() - t0, ok: false, error: String(e && e.message || e).slice(0, 300) }; keep(j);
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

// the last few runs, for the Background work page. Jobs that run every second in small steps (backfills, indexes)
// would push everything out, so a run within 10 s of the one before replaces it, and adds to its count
function keep(j) {
  const h = j.history, top = h[0], L = j.last;
  if (top && L.at - top.at < 10e3 && top.ok === L.ok) { top.n = (top.n || 1) + 1; top.ms += L.ms; top.at = L.at; top.note = L.note || top.note; top.error = L.error; }
  else { h.unshift({ ...L, n: 1 }); if (h.length > 8) h.length = 8; }
}
function item(j, where) {
  const now = Date.now();
  return { name: j.name, label: j.label, where, heavy: j.heavy, quiet: j.quiet, hours: j.hours,
    state: j.running ? 'running' : j.paused ? 'paused' : j.stopped ? (j.finished ? 'finished' : 'stopped') : (j.waiting && now >= j.next) ? 'waiting' : 'scheduled',
    waiting: j.running || j.stopped || j.paused || now < j.next ? null : j.waiting, next: j.stopped || j.running || j.paused ? null : j.next, runs: j.runs, fails: j.fails, last: j.last,
    every: typeof j.every === 'number' ? j.every : null, base: typeof j.base === 'number' ? j.base : null, changed: !!loadPrefs().every[j.name], soon: j.force, history: j.history };
}
function list(where = 'app') { return [...jobs.values()].map(j => item(j, where)); }
function control(name, { action, every } = {}, where = 'app') {
  const j = jobs.get(name); if (!j) return null;
  const pf = loadPrefs();
  if (action === 'run') { j.paused = false; j.stopped = false; j.finished = null; j.force = true; j.next = Date.now(); pf.paused = pf.paused.filter(n => n !== name); savePrefs(); setImmediate(tick); }
  else if (action === 'pause') { j.paused = true; j.force = false; j.waiting = null; if (!pf.paused.includes(name)) pf.paused.push(name); savePrefs(); }
  else if (action === 'resume') { j.paused = false; pf.paused = pf.paused.filter(n => n !== name); savePrefs(); if (j.next < Date.now()) setImmediate(tick); }
  else if (action === 'every') {
    if (typeof j.base !== 'number' || j.base < 60e3) throw Object.assign(new Error('This one runs in small steps; its pace is set by the work.'), { code: 400 });
    const v = +every;
    if (!v || v === j.base) { delete pf.every[name]; j.every = j.base; }
    else if (v < 60e3 || v > 30 * 86400e3) throw Object.assign(new Error('Pick between a minute and a month.'), { code: 400 });
    else { pf.every[name] = v; j.every = v; }
    savePrefs();
    // the next run moves to match (never later than it was due)
    const last = (j.last && j.last.at) || Date.now(); j.next = Math.max(Date.now() + 1000, Math.min(j.next, last + j.every));
  } else throw Object.assign(new Error('Unknown action'), { code: 400 });
  return item(j, where);
}

module.exports = { add, stop, soon, touch, inUse, list, control, _tick: tick, QUIET_MS };
