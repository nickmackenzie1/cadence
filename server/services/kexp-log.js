'use strict';
/* KEXP play history (user, 2026-11-15): keep every song KEXP plays, so Radio can later search "when did KEXP last play
   this?", show the songs around it and the DJ's comments. Inspired by KSSE (github.com/geluso/kexp_song_search_engine),
   but from KEXP's own public API instead of scraping their pages.
   - New plays: checked every 5 minutes (one request; more only if it fell behind).
   - The past: filled in in the background, back KEXP_BACKFILL_DAYS (default: everything, to the end of 2000: ~3.6M
     plays, ~1–1.5 GB; the user asked for all of it 2026-11-16, then "aggressively"): one page of up to 1,000 plays
     every 1.5 s (KEXP_BACKFILL_PAGE, KEXP_BACKFILL_EVERY) plus its shows, so a few hours instead of two days. Still one
     request at a time, and it backs off by itself when KEXP answers 429 or 5xx. Stops on its own; resumes after a restart.
   Off with KEXP_LOG=0. Under CI it's off unless KEXP_LOG=1 (tests point KEXP_API at a fake). */
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config');
// KEXP history has its own database file (2026-11-17): millions of plays in cadence.db meant every backfill write took
// the lock your tasks, Radar and Radio also need. Earlier installs kept it in cadence.db: moveOld() below brings it over.
const FILE = path.join(DATA_DIR, 'kexp.db'), OLD_FILE = path.join(DATA_DIR, 'cadence.db');

const API = (process.env.KEXP_API || 'https://api.kexp.org').replace(/\/$/, '');
const ON = process.env.KEXP_LOG === '1' || (process.env.KEXP_LOG !== '0' && !process.env.CI);
const EVERY = +process.env.KEXP_LOG_EVERY || 5 * 60e3, STEP = +process.env.KEXP_BACKFILL_EVERY || 4000;
// KEXP_BACKFILL_DAYS=all keeps going until KEXP has nothing older (about 25–50 MB of database per year of plays)
const BD = process.env.KEXP_BACKFILL_DAYS;
const BACK_DAYS = BD == null || BD === '' || /^all$/i.test(BD) ? Infinity : +BD;
const PAGE = 200, BPAGE = Math.max(50, Math.min(1000, +process.env.KEXP_BACKFILL_PAGE || 1000));

let db = null, state = { running: false, error: null, lastCheck: 0, backfill: 'waiting' };
function open() {
  if (db) return db;
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(FILE);
  require('../lib/sqlite-tune').tune(db, { cacheMB: 32, mmapMB: 256 });
  try { db.exec('PRAGMA journal_mode=WAL'); } catch {}
  db.exec(`CREATE TABLE IF NOT EXISTS kexp_plays (
      id INTEGER PRIMARY KEY, airdate INTEGER NOT NULL, artist TEXT, song TEXT, album TEXT, label TEXT, release_date TEXT,
      rotation TEXT, comment TEXT, live INTEGER, local INTEGER, request INTEGER, image TEXT, show_id INTEGER);
    CREATE INDEX IF NOT EXISTS kexp_plays_air ON kexp_plays(airdate);
    CREATE INDEX IF NOT EXISTS kexp_plays_artist ON kexp_plays(artist COLLATE NOCASE);
    CREATE TABLE IF NOT EXISTS kexp_meta (k TEXT PRIMARY KEY, v TEXT);
    CREATE TABLE IF NOT EXISTS kexp_artists (key TEXT PRIMARY KEY, artist TEXT, plays INTEGER NOT NULL, first_at INTEGER, last_at INTEGER, first_heavy INTEGER);
    CREATE INDEX IF NOT EXISTS kexp_artists_heavy ON kexp_artists(first_heavy) WHERE first_heavy IS NOT NULL;
    CREATE INDEX IF NOT EXISTS kexp_artists_first ON kexp_artists(first_at);
    CREATE TABLE IF NOT EXISTS kexp_shows (id INTEGER PRIMARY KEY, program TEXT, tags TEXT, hosts TEXT, start INTEGER, tagline TEXT, image TEXT);
    CREATE INDEX IF NOT EXISTS kexp_plays_show ON kexp_plays(show_id);`);
  if (ON) try { adoptOld(db); } catch (e) { console.error('KEXP: reading the old history in cadence.db', e.message); }
  // 2026-11-16 (from kexp.fyi's write-up): KEXP's airdate_before includes that exact time, so asking for "before our
  // oldest play" returned it again and looked like the filter didn't work: undo that switch to offset paging once.
  try {
    // once: clear the airbreaks already saved
    if (!meta('fix_airbreak')) {
      db.prepare("DELETE FROM kexp_plays WHERE artist COLLATE NOCASE IN ('airbreak', 'air break', 'air-break', 'airbreaks', 'air breaks') OR (artist IS NULL AND song COLLATE NOCASE IN ('airbreak', 'air break'))").run();
      meta('fix_airbreak', 1);
    }
    if (!meta('fix_inclusive')) {
      if (meta('backfill_mode') === 'offset') { db.prepare("DELETE FROM kexp_meta WHERE k IN ('backfill_mode', 'backfill_next', 'backfill_done')").run(); }
      db.prepare("UPDATE OR IGNORE kexp_plays SET artist = trim(substr(artist, 19)) WHERE artist LIKE '(Various Artists) %' AND length(trim(substr(artist, 19))) > 0").run();
      meta('fix_inclusive', 1);
    }
  } catch (e) { console.error('kexp-log migration', e.message); }
  return db;
}
// ---- bringing the history over from cadence.db (installs before 0.29.0) ----
// open(): settings, shows and the artist summary are copied straight away (small). The plays move in moveOld(),
// newest first, 5,000 at a time: copied into kexp.db, then deleted from cadence.db only once they're safely here, so a
// restart part-way just carries on. Nothing else writes KEXP history until it's done (the artist summary's cursor
// stays right that way). Then the empty tables are dropped; cadence.db hands the space back at the next quiet night
// (storage.js reclaim()).
const MOVE = { pending: false, total: 0, moved: 0 };
const colsOf = (d, schema, table) => d.prepare(`PRAGMA ${schema}.table_info(${table})`).all().map(c => c.name);
function adoptOld(d) {
  if (!fs.existsSync(OLD_FILE)) return;
  d.exec(`ATTACH DATABASE '${OLD_FILE.replace(/'/g, "''")}' AS old`);
  const has = t => !!d.prepare("SELECT 1 FROM old.sqlite_master WHERE type = 'table' AND name = ?").get(t);
  if (!has('kexp_plays') && !has('kexp_meta')) { d.exec('DETACH DATABASE old'); return; }
  if (!d.prepare("SELECT v FROM kexp_meta WHERE k = 'moved_start'").get()) {
    d.exec('BEGIN');
    try {
      for (const t of ['kexp_meta', 'kexp_shows', 'kexp_artists']) {
        if (!has(t)) continue;
        const mine = new Set(colsOf(d, 'main', t)), c = colsOf(d, 'old', t).filter(x => mine.has(x)).join(', ');
        d.exec(`INSERT OR ${t === 'kexp_meta' ? 'REPLACE' : 'IGNORE'} INTO main.${t} (${c}) SELECT ${c} FROM old.${t}`);
      }
      d.prepare("INSERT OR REPLACE INTO kexp_meta (k, v) VALUES ('moved_start', ?)").run(String(Date.now()));
      d.exec('COMMIT');
    } catch (e) { try { d.exec('ROLLBACK'); } catch {} throw e; }
    console.log('KEXP: history is moving from cadence.db to its own file, kexp.db');
  }
  MOVE.pending = has('kexp_plays') || has('kexp_meta') || has('kexp_shows') || has('kexp_artists');
}
async function moveOld() {
  const d = open(); if (!MOVE.pending) return;
  state.moving = true;
  const BATCH = Math.max(500, +process.env.KEXP_MOVE_BATCH || 5000), hasPlays = !!d.prepare("SELECT 1 FROM old.sqlite_master WHERE name = 'kexp_plays'").get();
  if (hasPlays) {
    const mine = new Set(colsOf(d, 'main', 'kexp_plays')), c = colsOf(d, 'old', 'kexp_plays').filter(x => mine.has(x)).join(', ');
    MOVE.total = MOVE.moved + ((d.prepare('SELECT COUNT(*) AS n FROM old.kexp_plays').get() || {}).n || 0);
    const pick = d.prepare('SELECT MIN(id) AS lo, MAX(id) AS hi, COUNT(*) AS n FROM (SELECT id FROM old.kexp_plays ORDER BY id DESC LIMIT ?)');
    const copy = d.prepare(`INSERT OR IGNORE INTO main.kexp_plays (${c}) SELECT ${c} FROM old.kexp_plays WHERE id BETWEEN ? AND ?`);
    const drop = d.prepare('DELETE FROM old.kexp_plays WHERE id BETWEEN ? AND ? AND id IN (SELECT id FROM main.kexp_plays WHERE id BETWEEN ? AND ?)');
    for (;;) {
      const t0 = Date.now(), b = pick.get(BATCH);
      if (!b || !b.n) break;
      d.exec('BEGIN'); try { copy.run(b.lo, b.hi); d.exec('COMMIT'); } catch (e) { try { d.exec('ROLLBACK'); } catch {} throw e; }
      drop.run(b.lo, b.hi, b.lo, b.hi);   // only what kexp.db now has
      MOVE.moved += b.n;
      const took = Date.now() - t0; slowNote('move to kexp.db', took);
      await new Promise(r => setTimeout(r, Math.max(30, took * 2)));
    }
  }
  for (const t of ['kexp_plays', 'kexp_shows', 'kexp_artists', 'kexp_meta']) d.exec(`DROP TABLE IF EXISTS old.${t}`);
  d.exec('DETACH DATABASE old');
  meta('moved_done', Date.now()); MOVE.pending = false; state.moving = false; countCache = { at: 0, n: 0, shows: 0 };
  console.log(`KEXP: history moved to kexp.db (${MOVE.moved.toLocaleString('en-CA')} plays); cadence.db gives the space back on a quiet night`);
}
// ---- kexp_artists: one row per artist (plays, first and last play, first heavy rotation) ----
// So per-artist numbers never group over millions of plays (user, 2026-11-17: "is there a metrics table…?").
// Built once in the background, 10,000 plays at a time in play-id order (kexp_meta artists_cursor / artists_done),
// and kept up to date as plays are saved: save() adds a play only if the builder has already passed its id, so
// nothing is counted twice while it builds.
const AKEY = a => String(a || '').trim().toLowerCase();
const ART = { cursor: null, done: false, ready: false };
function artistsState() { if (!ART.ready) { ART.cursor = +(meta('artists_cursor') || 0); ART.done = meta('artists_done') === '1'; ART.ready = true; } return ART; }
const artistsCover = id => { const a = artistsState(); return a.done || id <= a.cursor; };
function addToArtists(rows) {
  const m = new Map();
  for (const r of rows) {
    if (!r.artist || AIRBREAK.test(r.artist)) continue;
    const k = AKEY(r.artist), x = m.get(k) || { artist: r.artist, plays: 0, first: r.airdate, last: r.airdate, heavy: null }; m.set(k, x);
    x.plays++; if (r.airdate < x.first) x.first = r.airdate; if (r.airdate >= x.last) { x.last = r.airdate; x.artist = r.artist; }
    if (r.rotation === 'Heavy' && (x.heavy == null || r.airdate < x.heavy)) x.heavy = r.airdate;
  }
  const up = open().prepare(`INSERT INTO kexp_artists (key, artist, plays, first_at, last_at, first_heavy) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET plays = plays + excluded.plays, first_at = MIN(first_at, excluded.first_at),
      artist = CASE WHEN excluded.last_at >= last_at THEN excluded.artist ELSE artist END, last_at = MAX(last_at, excluded.last_at),
      first_heavy = COALESCE(MIN(first_heavy, excluded.first_heavy), first_heavy, excluded.first_heavy)`);
  for (const [k, x] of m) up.run(k, x.artist, x.plays, x.first, x.last, x.heavy);
}
const ACHUNK = +process.env.KEXP_ARTISTS_CHUNK || 2000;
function buildArtistsStep() {
  try {
    if (MOVE.pending) return void setTimeout(buildArtistsStep, 30e3).unref();   // after the move to kexp.db
    const a = artistsState(); if (a.done) return;
    if (inUse()) return void setTimeout(buildArtistsStep, 15e3).unref();
    const t0 = Date.now(), d = open(), rows = d.prepare('SELECT id, artist, airdate, rotation FROM kexp_plays WHERE id > ? ORDER BY id LIMIT ?').all(a.cursor, ACHUNK);
    d.exec('BEGIN');
    try {
      addToArtists(rows);
      const last = rows.length ? rows[rows.length - 1].id : a.cursor, done = rows.length < ACHUNK;
      meta('artists_cursor', last); if (done) meta('artists_done', '1');
      d.exec('COMMIT'); a.cursor = last; a.done = done;
      if (done) console.log('KEXP: artist summary ready');
    } catch (e) { try { d.exec('ROLLBACK'); } catch {} throw e; }
    const took = Date.now() - t0; slowNote('artist summary step', took);
    if (!a.done) setTimeout(buildArtistsStep, Math.max(+process.env.KEXP_ARTISTS_GAP || 1000, took * 4)).unref();
  } catch (e) { console.error('KEXP artist summary', e.message); setTimeout(buildArtistsStep, 60e3).unref(); }
}
const summary = () => ON && artistsState().done;
// ---- stepping aside (user, 2026-11-17: "radar is still crashing and slow, is it the KEXP backlog?") ----
// The history backfill and the artist summary write to cadence.db from the same process that answers Radar and Radio.
// While you're using those pages (any request in the last two minutes), both wait; when they run, they write in small
// transactions and rest in proportion to how long the last write took, so a slow NAS disk gets slower pacing.
const QUIET_MS = +process.env.KEXP_QUIET_MS || 120e3;
let lastUse = 0;
const touch = () => { lastUse = Date.now(); };
const inUse = () => Date.now() - lastUse < QUIET_MS;
const slowNote = (what, ms) => { if (ms > 1500) try { require('../lib/problems').record('slow', `KEXP ${what} took ${(ms / 1000).toFixed(1)}s`, { ms }); } catch {} };
const meta = (k, v) => { const d = open(); if (v === undefined) return (d.prepare('SELECT v FROM kexp_meta WHERE k = ?').get(k) || {}).v; d.prepare('INSERT OR REPLACE INTO kexp_meta (k, v) VALUES (?, ?)').run(k, String(v)); };

// compilation tracks are often logged "(Various Artists) The English Beat": keep the band (kexp.fyi found ~15k of these)
// KEXP's older playlists list DJ talk as a track by "AIRBREAK" (user, 2026-11-16: it showed up as an artist)
const AIRBREAK = /^\s*air\s*-?\s*breaks?\s*$/i;
const realArtist = a => { const m = String(a || '').match(/^\(various artists?\)\s+(.+)$/i); return m ? m[1].trim() : a; };
// a bare compilation credit is a bucket, not a band: left on the plays, kept out of top-artist lists
const NOT_VA = `artist NOT IN ('Various Artists', 'Various', '(Various Artists)', 'Various Artist') COLLATE NOCASE`;

// one API play → a row (songs only; air breaks are skipped)
function row(p) {
  if (!p || p.play_type !== 'trackplay' || !p.id || !p.airdate) return null;
  if (AIRBREAK.test(p.artist || '') || (!p.artist && AIRBREAK.test(p.song || ''))) return null;   // older playlists log DJ talk as a song
  const t = Date.parse(p.airdate); if (!isFinite(t)) return null;
  const s = v => (v == null || v === '' ? null : String(v));
  return [p.id, Math.round(t / 1000), s(realArtist(p.artist)), s(p.song), s(p.album), s((p.labels || [])[0]), s(p.release_date), s(p.rotation_status),
    s(p.comment) && String(p.comment).slice(0, 4000), p.is_live ? 1 : 0, p.is_local ? 1 : 0, p.is_request ? 1 : 0, s(p.thumbnail_uri || p.image_uri), p.show || null];
}
function save(plays) {
  const d = open(), ins = d.prepare('INSERT OR IGNORE INTO kexp_plays VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  let n = 0; const added = []; d.exec('BEGIN');
  try {
    for (const p of plays) { const r = row(p); if (r && ins.run(...r).changes) { n++; if (artistsCover(r[0])) added.push({ artist: r[2], airdate: r[1], rotation: r[7] }); } }
    if (added.length) addToArtists(added);
    d.exec('COMMIT');
  } catch (e) { d.exec('ROLLBACK'); throw e; }
  if (countCache.at) countCache.n += n;   // keep the kept count right without recounting
  return n;
}
// the backfill's save: 200 plays per transaction with a pause between, so a request never waits behind a whole page
async function saveGently(plays, size = 200) {
  let n = 0;
  for (let i = 0; i < plays.length; i += size) { n += save(plays.slice(i, i + size)); await new Promise(r => setImmediate(r)); }
  return n;
}
// the API address is fixed config (not user input), so plain fetch; "next" links are only followed back to the same API
const get = async url => {
  if (new URL(url).origin !== new URL(API).origin) throw new Error('unexpected address ' + url);
  const r = await fetch(url, { headers: { 'User-Agent': 'Cadence/1 (self-hosted; keeps a personal KEXP play history)', Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error('HTTP ' + r.status); return r.json();
};
const iso = sec => new Date(sec * 1000).toISOString();

// the show (program + DJs) behind each play: one request per show, newest first, a little at a time
// which shows still need a name: the ones given (the page just saved), else those in a recent window (a whole-table
// scan gets slow with millions of plays), else, once the past is done, anything left anywhere
async function fillShows(max = 12, { ids: want = null, sinceSec = null } = {}) {
  const d = open(); let ids;
  if (want) { const has = d.prepare('SELECT 1 FROM kexp_shows WHERE id = ?'); ids = [...new Set(want)].filter(id => id && !has.get(id)).slice(0, max); }
  else ids = d.prepare(`SELECT p.show_id AS id FROM kexp_plays p LEFT JOIN kexp_shows s ON s.id = p.show_id
    WHERE p.show_id IS NOT NULL AND s.id IS NULL ${sinceSec ? 'AND p.airdate >= ' + Math.floor(sinceSec) : ''} GROUP BY p.show_id ORDER BY MAX(p.airdate) DESC LIMIT ?`).all(max).map(r => r.id);
  const ins = d.prepare('INSERT OR REPLACE INTO kexp_shows VALUES (?,?,?,?,?,?,?)');
  for (const id of ids) {
    try {
      const sh = await get(`${API}/v2/shows/${id}/?format=json`);
      const t = Date.parse(sh.start_time);
      ins.run(id, sh.program_name || null, sh.program_tags || null, (sh.host_names || []).join(', ') || null, isFinite(t) ? Math.round(t / 1000) : null,
        sh.tagline ? String(sh.tagline).slice(0, 1000) : null, sh.program_image_uri || sh.image_uri || null);
      showCache.delete(id);
    } catch (e) { if (/HTTP 404/.test(e.message)) ins.run(id, null, null, null, null, null, null); else throw e; }
    await new Promise(r => setTimeout(r, 300).unref());
  }
  return ids.length;
}

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
  const stopAt = BACK_DAYS === Infinity ? -Infinity : Date.now() / 1000 - BACK_DAYS * 86400;
  if (oldest <= stopAt || meta('backfill_floor')) { meta('backfill_done', 1); return 'done'; }
  let url = meta('backfill_next');
  if (url) url = url.replace(/([?&]limit=)\d+/, '$1' + BPAGE);   // pages saved under the old, smaller size
  // airdate_before is inclusive: ask for one second before our oldest play
  if (!url || meta('backfill_mode') !== 'offset') url = `${API}/v2/plays/?format=json&limit=${BPAGE}&ordering=-airdate&airdate_before=${encodeURIComponent(iso(oldest - 1))}`;
  const b = await get(url), list = b.results || [];
  if (!list.length) { meta('backfill_done', 1); meta('backfill_floor', 1); return 'done'; }   // nothing older at KEXP
  const first = Date.parse(list[0].airdate) / 1000;
  if (meta('backfill_mode') !== 'offset' && first >= oldest) {
    // the date filter didn't work: switch to offset paging, starting about where our history ends
    const have = (d.prepare('SELECT COUNT(*) AS n FROM kexp_plays').get() || {}).n || 0;
    meta('backfill_mode', 'offset'); meta('backfill_next', `${API}/v2/plays/?format=json&limit=${BPAGE}&ordering=-airdate&offset=${Math.max(0, have - BPAGE)}`);
    return 'running';
  }
  await saveGently(list); state.pageShows = list.map(p => p.show).filter(Boolean);
  if (meta('backfill_mode') === 'offset') { if (b.next) meta('backfill_next', b.next); else { meta('backfill_done', 1); meta('backfill_floor', 1); return 'done'; } }
  return 'running';
}

const fileBytes = () => { let b = 0; for (const f of [FILE, FILE + '-wal']) try { b += fs.statSync(f).size; } catch {} return b; };
// space on disk for the kexp_* tables and their indexes (SQLite's dbstat; null if this SQLite doesn't have it)
function kexpBytes(d) {
  try { return d.prepare("SELECT SUM(pgsize) AS b FROM dbstat WHERE name LIKE 'kexp\\_%' ESCAPE '\\' OR name IN (SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name LIKE 'kexp\\_%' ESCAPE '\\')").get().b || 0; }
  catch { return null; }
}
// Counting every play and measuring the table read the whole KEXP history (1 GB+ once all of it is in), and other
// features called this just to ask "is it on?" (2026-11-17: the NAS stopped answering its health check). Now: isOn()
// for that, the count kept 10 minutes, the size kept 6 hours; MIN/MAX use the airdate index.
const isOn = () => !!ON;
let countCache = { at: 0, n: 0, shows: 0 }, bytesCache = { at: 0, b: null };
async function status() {
  if (!ON) return { on: false };
  try {
    const d = open();
    if (!countCache.at) { try { const x = await rq1('SELECT COUNT(*) AS n FROM kexp_plays', []); countCache = { at: Date.now(), n: x.n, busy: false }; } catch (e) {} }   // the first time: wait for it (off the main thread)
    // the count is worked out on the reader thread; until then (and while it refreshes) the last known number shows
    if (Date.now() - countCache.at > 10 * 60e3 && !countCache.busy) {
      countCache.busy = true;
      rq1('SELECT COUNT(*) AS n FROM kexp_plays', []).then(x => { countCache = { at: Date.now(), n: x.n, busy: false }; }, () => { countCache.busy = false; });
    }
    // size: kexp.db's own file (and its write-ahead log) now that KEXP history has a file of its own
    bytesCache = { at: Date.now(), b: fileBytes() };
    const r = { since: (d.prepare('SELECT MIN(airdate) AS t FROM kexp_plays').get() || {}).t, latest: (d.prepare('SELECT MAX(airdate) AS t FROM kexp_plays').get() || {}).t };
    return { on: true, plays: countCache.n, since: r.since ? iso(r.since) : null, latest: r.latest ? iso(r.latest) : null, backfill: state.backfill, paused: !!state.paused, mode: meta('backfill_mode') || 'date', error: state.error, moving: state.moving ? { moved: MOVE.moved, total: MOVE.total } : null, file: 'kexp.db', backDays: BACK_DAYS === Infinity ? 'all' : BACK_DAYS,
      shows: (d.prepare('SELECT COUNT(*) AS n FROM kexp_shows').get() || {}).n || 0, bytes: bytesCache.b };
  } catch (e) { return { on: true, error: e.message }; }
}

function start() {
  if (!ON || state.running) return; state.running = true;
  const tickNew = async () => { try { await checkNew(); await fillShows(12, { sinceSec: Date.now() / 1000 - 14 * 86400 }); } catch (e) { state.error = 'KEXP: ' + e.message; } };
  const tickBack = async () => {
    if (state.backfill === 'done') return;
    if (inUse()) { state.paused = true; return void setTimeout(tickBack, 15e3).unref(); }
    state.paused = false;
    let wait = STEP; const t0 = Date.now();
    try { state.pageShows = null; state.backfill = await backfillStep(); if (state.pageShows) await fillShows(8, { ids: state.pageShows }); state.slow = 0; const took = Date.now() - t0; slowNote('history page', took); wait = Math.max(STEP, took * 3); }
    catch (e) { state.error = 'KEXP history: ' + e.message; if (/HTTP (429|5\d\d)/.test(e.message)) { state.slow = Math.min(6, (state.slow || 0) + 1); wait = STEP * 2 ** state.slow; } }
    // once the past is filled in, keep naming the shows of older plays a few at a time
    if (state.backfill === 'done') { try { if (await fillShows(6)) return void setTimeout(tickBack2, STEP).unref(); } catch {} }
    if (state.backfill !== 'done') setTimeout(tickBack, wait).unref();   // KEXP asked us to slow down: back off
  };
  const tickBack2 = async () => { try { if (await fillShows(6)) setTimeout(tickBack2, STEP).unref(); } catch {} };
  // the history moves out of cadence.db first (once; a few minutes); new plays and the backfill wait for it
  const go = async () => {
    try { open(); await moveOld(); }
    catch (e) { state.moving = false; state.error = 'KEXP: moving history to kexp.db: ' + e.message; console.error(state.error); return void setTimeout(go, 60e3).unref(); }
    await tickNew(); setInterval(tickNew, EVERY).unref(); setTimeout(tickBack, STEP).unref();
  };
  setTimeout(go, +process.env.KEXP_LOG_DELAY || 15e3).unref();
}

// ---------- search and stats over the saved plays (no AI: plain grouping and counts) ----------
const PERIODS = { week: 7, month: 30, year: 365, all: null };
const since = period => { const d = PERIODS[period] !== undefined ? PERIODS[period] : 30; return d == null ? 0 : Math.round(Date.now() / 1000) - d * 86400; };
const like = q => '%' + String(q || '').trim().replace(/[\\%_]/g, c => '\\' + c) + '%';
const showCache = new Map();
const showOf = id => { if (!id) return null; if (!showCache.has(id)) { const s = open().prepare('SELECT program, hosts, tags FROM kexp_shows WHERE id = ?').get(id); showCache.set(id, s && s.program ? { id, program: s.program, hosts: s.hosts, tags: s.tags } : null); } return showCache.get(id); };
const play = r => ({ id: r.id, at: iso(r.airdate), show: showOf(r.show_id), artist: r.artist, song: r.song, album: r.album, label: r.label, release: r.release_date,
  rotation: r.rotation, comment: r.comment || null, live: !!r.live, local: !!r.local, request: !!r.request, image: r.image });
const lim = (n, d, max) => Math.max(1, Math.min(max, +n || d));

// all-time and yearly lists group over every saved play (millions with the full archive): keep them a while
const topCache = new Map();
// ---- big reports run on a reader thread (lib/sql-reader.js) so the app keeps answering ----
let reader = null, rseq = 0; const rwait = new Map();
function rq(sql, params = []) {
  if (!reader) {
    const { Worker } = require('worker_threads');
    reader = new Worker(path.join(__dirname, '..', 'lib', 'sql-reader.js'), { workerData: { file: FILE } });
    reader.on('message', ({ id, rows, error }) => { const w = rwait.get(id); if (!w) return; rwait.delete(id); if (!rwait.size) reader.unref(); error ? w.no(new Error(error)) : w.ok(rows); });
    const fail = e => { for (const w of rwait.values()) w.no(e instanceof Error ? e : new Error('KEXP reader stopped')); rwait.clear(); reader = null; };
    reader.on('error', fail); reader.on('exit', () => fail(new Error('KEXP reader stopped')));
    reader.unref();
  }
  return new Promise((ok, no) => { const id = ++rseq; rwait.set(id, { ok, no }); reader.ref(); reader.postMessage({ id, sql, params }); });   // kept alive only while a query waits
}
const rq1 = async (sql, params) => (await rq(sql, params))[0];
function top(o = {}) {
  const k = JSON.stringify([o.by, o.period, o.limit]), c = topCache.get(k), ttl = o.period === 'all' || o.period === 'year' ? 30 * 60e3 : 3 * 60e3;
  if (c && Date.now() - c.at < ttl) return c.v;
  const v = topNow(o); topCache.set(k, { at: Date.now(), v }); if (topCache.size > 60) topCache.delete(topCache.keys().next().value);
  v.catch(() => topCache.delete(k));
  return v;
}
async function topNow({ by = 'artist', period = 'month', limit = 50 } = {}) {
  const d = open(), t = since(period), n = lim(limit, 50, 200);
  if (by === 'song') return (await rq(`SELECT MIN(artist) AS artist, MIN(song) AS song, COUNT(*) AS plays, MAX(airdate) AS last, MAX(image) AS image FROM kexp_plays
    WHERE airdate >= ? AND song IS NOT NULL GROUP BY artist COLLATE NOCASE, song COLLATE NOCASE ORDER BY plays DESC, last DESC LIMIT ?`, [t, n])).map(r => ({ ...r, last: iso(r.last) }));
  if (by === 'show') return (await rq(`SELECT s.program AS program, COUNT(*) AS plays, COUNT(DISTINCT p.show_id) AS shows, MAX(p.airdate) AS last, MAX(s.image) AS image FROM kexp_plays p JOIN kexp_shows s ON s.id = p.show_id
    WHERE p.airdate >= ? AND s.program IS NOT NULL GROUP BY s.program ORDER BY plays DESC LIMIT ?`, [t, n])).map(r => ({ ...r, last: iso(r.last) }));
  if (by === 'dj') return (await rq(`SELECT s.hosts AS hosts, COUNT(*) AS plays, COUNT(DISTINCT p.show_id) AS shows, MAX(p.airdate) AS last, GROUP_CONCAT(DISTINCT s.program) AS programs FROM kexp_plays p JOIN kexp_shows s ON s.id = p.show_id
    WHERE p.airdate >= ? AND s.hosts IS NOT NULL GROUP BY s.hosts ORDER BY plays DESC LIMIT ?`, [t, n])).map(r => ({ ...r, last: iso(r.last) }));
  if (by === 'album') return (await rq(`SELECT MIN(artist) AS artist, MIN(album) AS album, MAX(label) AS label, COUNT(*) AS plays, MAX(airdate) AS last, MAX(image) AS image FROM kexp_plays
    WHERE airdate >= ? AND album IS NOT NULL AND album NOT LIKE '%live on kexp%' AND ${NOT_VA} GROUP BY artist COLLATE NOCASE, album COLLATE NOCASE ORDER BY plays DESC, last DESC LIMIT ?`, [t, n])).map(r => ({ ...r, last: iso(r.last) }));
  return (await rq(`SELECT MIN(artist) AS artist, COUNT(*) AS plays, COUNT(DISTINCT song) AS songs, MAX(airdate) AS last, MAX(image) AS image FROM kexp_plays
    WHERE airdate >= ? AND artist IS NOT NULL AND ${NOT_VA} GROUP BY artist COLLATE NOCASE ORDER BY plays DESC, last DESC LIMIT ?`, [t, n])).map(r => ({ ...r, last: iso(r.last) }));
}
// winners (idea from kexp.fyi): the most-played artist, song or album of each month or year, for the whole station or
// one program / DJ, with the runner-up. Groups over every saved play, so it's cached like the top lists.
function winners(o = {}) {
  const k = 'w' + JSON.stringify([o.by, o.per, o.program, o.dj]), c = topCache.get(k);
  if (c && Date.now() - c.at < 30 * 60e3) return c.v;
  const v = winnersNow(o); topCache.set(k, { at: Date.now(), v }); if (topCache.size > 60) topCache.delete(topCache.keys().next().value);
  v.catch(() => topCache.delete(k));
  return v;
}
async function winnersNow({ by = 'artist', per = 'month', program = null, dj = null } = {}) {
  const d = open(), fmt = per === 'year' ? '%Y' : '%Y-%m';
  const key = by === 'song' ? 'p.artist COLLATE NOCASE, p.song COLLATE NOCASE' : by === 'album' ? 'p.artist COLLATE NOCASE, p.album COLLATE NOCASE' : 'p.artist COLLATE NOCASE';
  const notNull = by === 'song' ? 'p.song IS NOT NULL' : by === 'album' ? "p.album IS NOT NULL AND p.album NOT LIKE '%live on kexp%'" : 'p.artist IS NOT NULL';
  const who = program ? 'AND s.program = ?' : dj ? "AND (', ' || s.hosts || ', ') LIKE ? ESCAPE '\\'" : '';
  const args = program ? [String(program)] : dj ? [like(', ' + String(dj) + ', ').replace(/^%|%$/g, '%')] : [];
  const rows = (await rq(`WITH g AS (
      SELECT strftime('${fmt}', p.airdate, 'unixepoch', 'localtime') AS period, MIN(p.artist) AS artist, MIN(p.song) AS song, MIN(p.album) AS album, COUNT(*) AS plays
      FROM kexp_plays p ${program || dj ? 'JOIN kexp_shows s ON s.id = p.show_id' : ''}
      WHERE ${notNull} AND ${NOT_VA.replace('artist NOT IN', 'p.artist NOT IN')} ${who}
      GROUP BY period, ${key}),
    r AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY period ORDER BY plays DESC, artist) AS n, SUM(plays) OVER (PARTITION BY period) AS total FROM g)
    SELECT * FROM r WHERE n <= 2 ORDER BY period DESC, n`, [...args]));
  const out = [];
  for (const x of rows) {
    const it = { artist: x.artist, song: by === 'song' ? x.song : null, album: by === 'album' ? x.album : null, plays: x.plays };
    if (x.n === 1) out.push({ period: x.period, total: x.total, winner: it, runnerUp: null });
    else if (out.length && out[out.length - 1].period === x.period) out[out.length - 1].runnerUp = it;
  }
  return { by, per, program, dj, list: out };
}

// q matches artist, song or album; group: artist | song | play
async function search({ q, group = 'artist', limit = 100 } = {}) {
  q = String(q || '').trim(); if (q.length < 2) return [];
  const d = open(), L = like(q), n = lim(limit, 100, 500), W = `(artist LIKE ? ESCAPE '\\' OR song LIKE ? ESCAPE '\\' OR album LIKE ? ESCAPE '\\')`;
  if (group === 'play') return (await rq(`SELECT * FROM kexp_plays WHERE ${W} ORDER BY airdate DESC LIMIT ?`, [L, L, L, n])).map(play);
  if (group === 'song') return (await rq(`SELECT MIN(artist) AS artist, MIN(song) AS song, COUNT(*) AS plays, MIN(airdate) AS first, MAX(airdate) AS last, MAX(image) AS image FROM kexp_plays
    WHERE ${W} AND song IS NOT NULL GROUP BY artist COLLATE NOCASE, song COLLATE NOCASE ORDER BY plays DESC, last DESC LIMIT ?`, [L, L, L, n])).map(r => ({ ...r, first: iso(r.first), last: iso(r.last) }));
  return (await rq(`SELECT MIN(artist) AS artist, COUNT(*) AS plays, COUNT(DISTINCT song) AS songs, MIN(airdate) AS first, MAX(airdate) AS last, MAX(image) AS image FROM kexp_plays
    WHERE ${W} GROUP BY artist COLLATE NOCASE ORDER BY plays DESC, last DESC LIMIT ?`, [L, L, L, n])).map(r => ({ ...r, first: iso(r.first), last: iso(r.last) }));
}
function artist(name) {
  const d = open(), a = String(name || '');
  const sum = d.prepare('SELECT COUNT(*) AS plays, MIN(airdate) AS first, MAX(airdate) AS last, MAX(image) AS image FROM kexp_plays WHERE artist = ? COLLATE NOCASE').get(a);
  if (!sum.plays) return null;
  const songs = d.prepare(`SELECT MIN(song) AS song, MAX(album) AS album, COUNT(*) AS plays, MIN(airdate) AS first, MAX(airdate) AS last FROM kexp_plays
    WHERE artist = ? COLLATE NOCASE AND song IS NOT NULL GROUP BY song COLLATE NOCASE ORDER BY plays DESC, last DESC`).all(a).map(r => ({ ...r, first: iso(r.first), last: iso(r.last) }));
  const months = d.prepare(`SELECT strftime('%Y-%m', airdate, 'unixepoch') AS month, COUNT(*) AS plays FROM kexp_plays WHERE artist = ? COLLATE NOCASE GROUP BY month ORDER BY month`).all(a);
  const plays = d.prepare('SELECT * FROM kexp_plays WHERE artist = ? COLLATE NOCASE ORDER BY airdate DESC LIMIT 100').all(a).map(play);
  const name0 = (d.prepare('SELECT MIN(artist) AS artist FROM kexp_plays WHERE artist = ? COLLATE NOCASE').get(a) || {}).artist || a;
  // which shows and DJs play them most
  const djs = d.prepare(`SELECT s.hosts AS hosts, s.program AS program, COUNT(*) AS plays FROM kexp_plays p JOIN kexp_shows s ON s.id = p.show_id
    WHERE p.artist = ? COLLATE NOCASE AND s.hosts IS NOT NULL GROUP BY s.hosts, s.program ORDER BY plays DESC LIMIT 8`).all(a);
  return { artist: name0, plays: sum.plays, first: iso(sum.first), last: iso(sum.last), image: sum.image, songs, months, recent: plays, djs };
}
// one program (e.g. "The Morning Show") or one DJ: what they play most, and their recent plays
async function onAir({ program, dj, period = 'all' } = {}) {
  const d = open(), t = since(period), W = program ? 's.program = ?' : "(', ' || s.hosts || ', ') LIKE ? ESCAPE '\\'", v = program ? String(program) : like(', ' + String(dj || '') + ', ').replace(/^%|%$/g, '%');
  const sum = (await rq1(`SELECT COUNT(*) AS plays, COUNT(DISTINCT p.show_id) AS shows, MIN(p.airdate) AS first, MAX(p.airdate) AS last, GROUP_CONCAT(DISTINCT s.hosts) AS hosts, GROUP_CONCAT(DISTINCT s.program) AS programs, MAX(s.image) AS image, MAX(s.tags) AS tags
    FROM kexp_plays p JOIN kexp_shows s ON s.id = p.show_id WHERE ${W} AND p.airdate >= ?`, [v, t]));
  if (!sum.plays) return null;
  const artists = (await rq(`SELECT MIN(p.artist) AS artist, COUNT(*) AS plays, MAX(p.airdate) AS last FROM kexp_plays p JOIN kexp_shows s ON s.id = p.show_id
    WHERE ${W} AND p.airdate >= ? AND p.artist IS NOT NULL GROUP BY p.artist COLLATE NOCASE ORDER BY plays DESC, last DESC LIMIT 30`, [v, t])).map(r => ({ ...r, last: iso(r.last) }));
  const songs = (await rq(`SELECT MIN(p.artist) AS artist, MIN(p.song) AS song, COUNT(*) AS plays, MAX(p.airdate) AS last FROM kexp_plays p JOIN kexp_shows s ON s.id = p.show_id
    WHERE ${W} AND p.airdate >= ? AND p.song IS NOT NULL GROUP BY p.artist COLLATE NOCASE, p.song COLLATE NOCASE ORDER BY plays DESC, last DESC LIMIT 30`, [v, t])).map(r => ({ ...r, last: iso(r.last) }));
  const recent = (await rq(`SELECT p.* FROM kexp_plays p JOIN kexp_shows s ON s.id = p.show_id WHERE ${W} ORDER BY p.airdate DESC LIMIT 60`, [v])).map(play);
  return { program: program || null, dj: dj || null, ...sum, first: iso(sum.first), last: iso(sum.last), artists, songs, recent };
}

function song(artistName, title) {
  const d = open();
  const plays = d.prepare('SELECT * FROM kexp_plays WHERE artist = ? COLLATE NOCASE AND song = ? COLLATE NOCASE ORDER BY airdate DESC LIMIT 500').all(String(artistName || ''), String(title || '')).map(play);
  return plays.length ? { artist: plays[0].artist, song: plays[0].song, album: plays[0].album, plays } : null;
}
// the songs played just before and after one play (by air time)
function around(id, n = 6) {
  const d = open(), p = d.prepare('SELECT * FROM kexp_plays WHERE id = ?').get(+id); if (!p) return null;
  const k = lim(n, 6, 20);
  const before = d.prepare('SELECT * FROM kexp_plays WHERE airdate < ? ORDER BY airdate DESC LIMIT ?').all(p.airdate, k).reverse().map(play);
  const after = d.prepare('SELECT * FROM kexp_plays WHERE airdate > ? ORDER BY airdate ASC LIMIT ?').all(p.airdate, k).map(play);
  return { play: play(p), before, after };
}
// followed artists: their plays since a time (unix seconds), newest first, with the program
function playsSince(name, sinceSec, limit = 20) {
  if (!db && !open()) return [];
  return open().prepare(`SELECT p.airdate AS at, p.song, p.album, s.program FROM kexp_plays p LEFT JOIN kexp_shows s ON s.id = p.show_id
    WHERE p.artist = ? COLLATE NOCASE AND p.airdate > ? ORDER BY p.airdate DESC LIMIT ?`).all(String(name), Math.floor(sinceSec), limit);
}
function recent({ limit = 50, comments = false } = {}) {
  return open().prepare(`SELECT * FROM kexp_plays ${comments ? "WHERE comment IS NOT NULL AND comment != ''" : ''} ORDER BY airdate DESC LIMIT ?`).all(lim(limit, 50, 300)).map(play);
}
// artists KEXP started playing recently: first play within `days`, only once there's older history to compare with
async function newArtists({ days = 14, limit = 50 } = {}) {
  const d = open(), t = Math.round(Date.now() / 1000) - lim(days, 14, 90) * 86400;
  const oldest = (d.prepare('SELECT MIN(airdate) AS t FROM kexp_plays').get() || {}).t;   // airdate index: instant
  if (!oldest || oldest > t - 30 * 86400) return { ready: false, list: [] };
  if (summary()) return { ready: true, list: d.prepare(`SELECT artist, plays, first_at AS first, last_at AS last FROM kexp_artists WHERE first_at >= ? AND ${NOT_VA} ORDER BY plays DESC, last_at DESC LIMIT ?`).all(t, lim(limit, 50, 200)).map(r => ({ ...r, first: iso(r.first), last: iso(r.last) })) };
  const list = (await rq(`SELECT MIN(artist) AS artist, COUNT(*) AS plays, MIN(airdate) AS first, MAX(airdate) AS last, MAX(image) AS image FROM kexp_plays
    WHERE artist IS NOT NULL GROUP BY artist COLLATE NOCASE HAVING MIN(airdate) >= ? ORDER BY plays DESC, last DESC LIMIT ?`, [t, lim(limit, 50, 200)])).map(r => ({ ...r, first: iso(r.first), last: iso(r.last) }));
  return { ready: true, list };
}

start();
if (ON) setTimeout(buildArtistsStep, +process.env.KEXP_ARTISTS_DELAY || 60e3).unref();
// how many times KEXP has played someone (cheap: the artist index), for "where they've turned up"
function playCount(name) { try { if (summary()) return (open().prepare('SELECT plays FROM kexp_artists WHERE key = ?').get(AKEY(name)) || {}).plays || 0; return open().prepare('SELECT COUNT(*) AS n FROM kexp_plays WHERE artist = ? COLLATE NOCASE').get(String(name || '')).n; } catch (e) { return 0; } }
// when KEXP first put someone in heavy rotation (unix seconds), for Music Radar's "Called it"
function heavyFirst(name) { try { if (summary()) return (open().prepare('SELECT first_heavy AS t FROM kexp_artists WHERE key = ?').get(AKEY(name)) || {}).t || null; const r = open().prepare("SELECT MIN(airdate) AS t FROM kexp_plays WHERE artist = ? COLLATE NOCASE AND rotation = 'Heavy'").get(String(name || '')); return r && r.t ? r.t : null; } catch (e) { return null; } }
// first heavy-rotation play for every artist since a time (one pass over that stretch of the airdate index)
function heavySince(sinceSec) { try { if (summary()) return open().prepare('SELECT artist, first_heavy AS t FROM kexp_artists WHERE first_heavy >= ?').all(Math.floor(sinceSec)); return open().prepare("SELECT MIN(artist) AS artist, MIN(airdate) AS t FROM kexp_plays WHERE airdate >= ? AND rotation = 'Heavy' GROUP BY artist COLLATE NOCASE").all(Math.floor(sinceSec)); } catch (e) { return []; } }
// which KEXP DJs play these artists most (Mixcloud picks): one query on the reader thread
async function djsFor(names) {
  const list = [...new Set(names.map(n => String(n || '').trim()).filter(Boolean))].slice(0, 30); if (!list.length) return [];
  return rq(`SELECT MIN(p.artist) AS artist, s.hosts AS hosts, s.program AS program, COUNT(*) AS plays FROM kexp_plays p JOIN kexp_shows s ON s.id = p.show_id
    WHERE p.artist COLLATE NOCASE IN (${list.map(() => '?').join(',')}) AND s.hosts IS NOT NULL GROUP BY p.artist COLLATE NOCASE, s.hosts, s.program ORDER BY plays DESC LIMIT 200`, list);
}
// ---- read-only tables for the Database view (kexp.db) ----
async function tables() {
  if (!ON && !fs.existsSync(FILE)) return [];
  const d = open(), list = d.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'kexp\\_%' ESCAPE '\\' ORDER BY name").all();
  const out = [];
  for (const { name } of list) {
    let count = null;
    if (name === 'kexp_plays') { if (!countCache.at) try { countCache = { ...countCache, at: Date.now(), n: (await rq1('SELECT COUNT(*) AS n FROM kexp_plays', [])).n }; } catch {} count = countCache.n; }
    else count = d.prepare(`SELECT COUNT(*) AS n FROM ${name}`).get().n;
    out.push({ name, count, bytes: name === 'kexp_plays' ? fileBytes() : null, file: 'kexp.db', columns: d.prepare(`PRAGMA table_info(${name})`).all().map(c => c.name) });
  }
  return out;
}
async function tableRows(name, { offset = 0, limit = 50 } = {}) {
  const t = (await tables()).find(x => x.name === name); if (!t) return null;
  const order = t.columns.includes('airdate') ? 'ORDER BY airdate DESC' : t.columns.includes('start') ? 'ORDER BY start DESC' : '';
  const rows = await rq(`SELECT * FROM ${name} ${order} LIMIT ? OFFSET ?`, [limit, offset]);
  return { name, total: t.count, offset, columns: t.columns, rows: rows.map(r => t.columns.map(c => r[c])) };
}
module.exports = { FILE, tables, tableRows, moveOld, touch, inUse, djsFor, _save: save, buildArtistsStep, isOn, heavySince, heavyFirst, playCount, winners, playsSince, status, checkNew, backfillStep, fillShows, row, start, top, search, artist, song, around, recent, newArtists, onAir, open };
