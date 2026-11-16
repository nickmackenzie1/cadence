'use strict';
/* KEXP play history (user, 2026-11-15): keep every song KEXP plays, so Radio can later search "when did KEXP last play
   this?", show the songs around it and the DJ's comments. Inspired by KSSE (github.com/geluso/kexp_song_search_engine),
   but from KEXP's own public API instead of scraping their pages.
   - New plays: checked every 5 minutes (one request; more only if it fell behind).
   - The past: filled in slowly in the background, one page (200 plays, about half a day) every 30 s, back
     KEXP_BACKFILL_DAYS (default 365). Stops on its own; resumes after a restart.
   Off with KEXP_LOG=0. Under CI it's off unless KEXP_LOG=1 (tests point KEXP_API at a fake). */
const path = require('path');
const { DATA_DIR } = require('../config');

const API = (process.env.KEXP_API || 'https://api.kexp.org').replace(/\/$/, '');
const ON = process.env.KEXP_LOG === '1' || (process.env.KEXP_LOG !== '0' && !process.env.CI);
const EVERY = +process.env.KEXP_LOG_EVERY || 5 * 60e3, STEP = +process.env.KEXP_BACKFILL_EVERY || 30e3;
const BACK_DAYS = process.env.KEXP_BACKFILL_DAYS != null ? +process.env.KEXP_BACKFILL_DAYS : 365;
const PAGE = 200;

let db = null, state = { running: false, error: null, lastCheck: 0, backfill: 'waiting' };
function open() {
  if (db) return db;
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(path.join(DATA_DIR, 'cadence.db'));
  db.exec('PRAGMA busy_timeout=5000');   // before anything that needs a lock (the app may be writing)
  db.exec(`CREATE TABLE IF NOT EXISTS kexp_plays (
      id INTEGER PRIMARY KEY, airdate INTEGER NOT NULL, artist TEXT, song TEXT, album TEXT, label TEXT, release_date TEXT,
      rotation TEXT, comment TEXT, live INTEGER, local INTEGER, request INTEGER, image TEXT, show_id INTEGER);
    CREATE INDEX IF NOT EXISTS kexp_plays_air ON kexp_plays(airdate);
    CREATE INDEX IF NOT EXISTS kexp_plays_artist ON kexp_plays(artist COLLATE NOCASE);
    CREATE TABLE IF NOT EXISTS kexp_meta (k TEXT PRIMARY KEY, v TEXT);`);
  return db;
}
const meta = (k, v) => { const d = open(); if (v === undefined) return (d.prepare('SELECT v FROM kexp_meta WHERE k = ?').get(k) || {}).v; d.prepare('INSERT OR REPLACE INTO kexp_meta (k, v) VALUES (?, ?)').run(k, String(v)); };

// one API play → a row (songs only; air breaks are skipped)
function row(p) {
  if (!p || p.play_type !== 'trackplay' || !p.id || !p.airdate) return null;
  const t = Date.parse(p.airdate); if (!isFinite(t)) return null;
  const s = v => (v == null || v === '' ? null : String(v));
  return [p.id, Math.round(t / 1000), s(p.artist), s(p.song), s(p.album), s((p.labels || [])[0]), s(p.release_date), s(p.rotation_status),
    s(p.comment) && String(p.comment).slice(0, 4000), p.is_live ? 1 : 0, p.is_local ? 1 : 0, p.is_request ? 1 : 0, s(p.thumbnail_uri || p.image_uri), p.show || null];
}
function save(plays) {
  const d = open(), ins = d.prepare('INSERT OR IGNORE INTO kexp_plays VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  let n = 0; d.exec('BEGIN');
  try { for (const p of plays) { const r = row(p); if (r && ins.run(...r).changes) n++; } d.exec('COMMIT'); } catch (e) { d.exec('ROLLBACK'); throw e; }
  return n;
}
// the API address is fixed config (not user input), so plain fetch; "next" links are only followed back to the same API
const get = async url => {
  if (new URL(url).origin !== new URL(API).origin) throw new Error('unexpected address ' + url);
  const r = await fetch(url, { headers: { 'User-Agent': 'Cadence/1 (self-hosted; keeps a personal KEXP play history)', Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error('HTTP ' + r.status); return r.json();
};
const iso = sec => new Date(sec * 1000).toISOString();

// newest plays; keeps paging back (up to 10 pages) until it reaches what's already saved
async function checkNew() {
  const d = open(), newest = (d.prepare('SELECT MAX(airdate) AS t FROM kexp_plays').get() || {}).t || 0;
  let url = `${API}/v2/plays/?format=json&limit=${PAGE}&ordering=-airdate`, added = 0;
  for (let i = 0; i < 10 && url; i++) {
    const b = await get(url), list = b.results || []; added += save(list);
    const oldest = list.length ? Date.parse(list[list.length - 1].airdate) / 1000 : 0;
    if (!newest || oldest <= newest || !list.length) break;
    url = b.next || null;
  }
  state.lastCheck = Date.now(); state.error = null;
  return added;
}

// one page older than the oldest saved play. Asks by date (airdate_before); if the API ignores that, it walks the
// offset pages instead (a few plays may shift between pages; duplicates are ignored, gaps are tiny).
async function backfillStep() {
  const d = open(), oldest = (d.prepare('SELECT MIN(airdate) AS t FROM kexp_plays').get() || {}).t;
  if (!oldest) return 'waiting';
  const stopAt = Date.now() / 1000 - BACK_DAYS * 86400;
  if (oldest <= stopAt || meta('backfill_done')) { meta('backfill_done', 1); return 'done'; }
  let url = meta('backfill_next');
  if (!url || meta('backfill_mode') !== 'offset') url = `${API}/v2/plays/?format=json&limit=${PAGE}&ordering=-airdate&airdate_before=${encodeURIComponent(iso(oldest))}`;
  const b = await get(url), list = b.results || [];
  if (!list.length) { meta('backfill_done', 1); return 'done'; }
  const first = Date.parse(list[0].airdate) / 1000;
  if (meta('backfill_mode') !== 'offset' && first >= oldest) {
    // the date filter didn't work: switch to offset paging, starting about where our history ends
    const have = (d.prepare('SELECT COUNT(*) AS n FROM kexp_plays').get() || {}).n || 0;
    meta('backfill_mode', 'offset'); meta('backfill_next', `${API}/v2/plays/?format=json&limit=${PAGE}&ordering=-airdate&offset=${Math.max(0, have - PAGE)}`);
    return 'running';
  }
  save(list);
  if (meta('backfill_mode') === 'offset') { if (b.next) meta('backfill_next', b.next); else { meta('backfill_done', 1); return 'done'; } }
  return 'running';
}

function status() {
  if (!ON) return { on: false };
  try {
    const d = open(), r = d.prepare('SELECT COUNT(*) AS n, MIN(airdate) AS since, MAX(airdate) AS latest FROM kexp_plays').get();
    return { on: true, plays: r.n, since: r.since ? iso(r.since) : null, latest: r.latest ? iso(r.latest) : null, backfill: state.backfill, error: state.error, backDays: BACK_DAYS };
  } catch (e) { return { on: true, error: e.message }; }
}

function start() {
  if (!ON || state.running) return; state.running = true;
  const tickNew = async () => { try { await checkNew(); } catch (e) { state.error = 'KEXP: ' + e.message; } };
  const tickBack = async () => {
    if (state.backfill === 'done') return;
    try { state.backfill = await backfillStep(); } catch (e) { state.error = 'KEXP history: ' + e.message; }
    if (state.backfill !== 'done') setTimeout(tickBack, STEP).unref();
  };
  setTimeout(async () => { await tickNew(); setInterval(tickNew, EVERY).unref(); setTimeout(tickBack, STEP).unref(); }, +process.env.KEXP_LOG_DELAY || 15e3).unref();
}

start();
module.exports = { status, checkNew, backfillStep, row, start };
