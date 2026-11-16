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
// KEXP_BACKFILL_DAYS=all keeps going until KEXP has nothing older (about 25–50 MB of database per year of plays)
const BACK_DAYS = /^all$/i.test(process.env.KEXP_BACKFILL_DAYS || '') ? Infinity : process.env.KEXP_BACKFILL_DAYS != null ? +process.env.KEXP_BACKFILL_DAYS : 365;
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
    CREATE TABLE IF NOT EXISTS kexp_meta (k TEXT PRIMARY KEY, v TEXT);
    CREATE TABLE IF NOT EXISTS kexp_shows (id INTEGER PRIMARY KEY, program TEXT, tags TEXT, hosts TEXT, start INTEGER, tagline TEXT, image TEXT);
    CREATE INDEX IF NOT EXISTS kexp_plays_show ON kexp_plays(show_id);`);
  // 2026-11-16 (from kexp.fyi's write-up): KEXP's airdate_before includes that exact time, so asking for "before our
  // oldest play" returned it again and looked like the filter didn't work: undo that switch to offset paging once.
  try {
    if (!meta('fix_inclusive')) {
      if (meta('backfill_mode') === 'offset') { db.prepare("DELETE FROM kexp_meta WHERE k IN ('backfill_mode', 'backfill_next', 'backfill_done')").run(); }
      db.prepare("UPDATE OR IGNORE kexp_plays SET artist = trim(substr(artist, 19)) WHERE artist LIKE '(Various Artists) %' AND length(trim(substr(artist, 19))) > 0").run();
      meta('fix_inclusive', 1);
    }
  } catch (e) { console.error('kexp-log migration', e.message); }
  return db;
}
const meta = (k, v) => { const d = open(); if (v === undefined) return (d.prepare('SELECT v FROM kexp_meta WHERE k = ?').get(k) || {}).v; d.prepare('INSERT OR REPLACE INTO kexp_meta (k, v) VALUES (?, ?)').run(k, String(v)); };

// compilation tracks are often logged "(Various Artists) The English Beat": keep the band (kexp.fyi found ~15k of these)
const realArtist = a => { const m = String(a || '').match(/^\(various artists?\)\s+(.+)$/i); return m ? m[1].trim() : a; };
// a bare compilation credit is a bucket, not a band: left on the plays, kept out of top-artist lists
const NOT_VA = `artist NOT IN ('Various Artists', 'Various', '(Various Artists)', 'Various Artist') COLLATE NOCASE`;

// one API play → a row (songs only; air breaks are skipped)
function row(p) {
  if (!p || p.play_type !== 'trackplay' || !p.id || !p.airdate) return null;
  const t = Date.parse(p.airdate); if (!isFinite(t)) return null;
  const s = v => (v == null || v === '' ? null : String(v));
  return [p.id, Math.round(t / 1000), s(realArtist(p.artist)), s(p.song), s(p.album), s((p.labels || [])[0]), s(p.release_date), s(p.rotation_status),
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

// the show (program + DJs) behind each play: one request per show, newest first, a little at a time
async function fillShows(max = 12) {
  const d = open(), ids = d.prepare(`SELECT p.show_id AS id FROM kexp_plays p LEFT JOIN kexp_shows s ON s.id = p.show_id
    WHERE p.show_id IS NOT NULL AND s.id IS NULL GROUP BY p.show_id ORDER BY MAX(p.airdate) DESC LIMIT ?`).all(max).map(r => r.id);
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
  if (oldest <= stopAt || meta('backfill_done')) { meta('backfill_done', 1); return 'done'; }
  let url = meta('backfill_next');
  // airdate_before is inclusive: ask for one second before our oldest play
  if (!url || meta('backfill_mode') !== 'offset') url = `${API}/v2/plays/?format=json&limit=${PAGE}&ordering=-airdate&airdate_before=${encodeURIComponent(iso(oldest - 1))}`;
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

// space on disk for the kexp_* tables and their indexes (SQLite's dbstat; null if this SQLite doesn't have it)
function kexpBytes(d) {
  try { return d.prepare("SELECT SUM(pgsize) AS b FROM dbstat WHERE name LIKE 'kexp\\_%' ESCAPE '\\' OR name IN (SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name LIKE 'kexp\\_%' ESCAPE '\\')").get().b || 0; }
  catch { return null; }
}
function status() {
  if (!ON) return { on: false };
  try {
    const d = open(), r = d.prepare('SELECT COUNT(*) AS n, MIN(airdate) AS since, MAX(airdate) AS latest FROM kexp_plays').get();
    return { on: true, plays: r.n, since: r.since ? iso(r.since) : null, latest: r.latest ? iso(r.latest) : null, backfill: state.backfill, mode: meta('backfill_mode') || 'date', error: state.error, backDays: BACK_DAYS === Infinity ? 'all' : BACK_DAYS,
      shows: (d.prepare('SELECT COUNT(*) AS n FROM kexp_shows').get() || {}).n || 0, bytes: kexpBytes(d) };
  } catch (e) { return { on: true, error: e.message }; }
}

function start() {
  if (!ON || state.running) return; state.running = true;
  const tickNew = async () => { try { await checkNew(); await fillShows(); } catch (e) { state.error = 'KEXP: ' + e.message; } };
  const tickBack = async () => {
    if (state.backfill === 'done') return;
    let wait = STEP;
    try { state.backfill = await backfillStep(); await fillShows(6); state.slow = 0; }
    catch (e) { state.error = 'KEXP history: ' + e.message; if (/HTTP (429|5\d\d)/.test(e.message)) { state.slow = Math.min(6, (state.slow || 0) + 1); wait = STEP * 2 ** state.slow; } }
    // once the past is filled in, keep naming the shows of older plays a few at a time
    if (state.backfill === 'done') { try { if (await fillShows(6)) return void setTimeout(tickBack2, STEP).unref(); } catch {} }
    if (state.backfill !== 'done') setTimeout(tickBack, wait).unref();   // KEXP asked us to slow down: back off
  };
  const tickBack2 = async () => { try { if (await fillShows(6)) setTimeout(tickBack2, STEP).unref(); } catch {} };
  setTimeout(async () => { await tickNew(); setInterval(tickNew, EVERY).unref(); setTimeout(tickBack, STEP).unref(); }, +process.env.KEXP_LOG_DELAY || 15e3).unref();
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
function top(o = {}) {
  const k = JSON.stringify([o.by, o.period, o.limit]), c = topCache.get(k), ttl = o.period === 'all' || o.period === 'year' ? 30 * 60e3 : 3 * 60e3;
  if (c && Date.now() - c.at < ttl) return c.v;
  const v = topNow(o); topCache.set(k, { at: Date.now(), v }); if (topCache.size > 60) topCache.delete(topCache.keys().next().value);
  return v;
}
function topNow({ by = 'artist', period = 'month', limit = 50 } = {}) {
  const d = open(), t = since(period), n = lim(limit, 50, 200);
  if (by === 'song') return d.prepare(`SELECT MIN(artist) AS artist, MIN(song) AS song, COUNT(*) AS plays, MAX(airdate) AS last, MAX(image) AS image FROM kexp_plays
    WHERE airdate >= ? AND song IS NOT NULL GROUP BY artist COLLATE NOCASE, song COLLATE NOCASE ORDER BY plays DESC, last DESC LIMIT ?`).all(t, n).map(r => ({ ...r, last: iso(r.last) }));
  if (by === 'show') return d.prepare(`SELECT s.program AS program, COUNT(*) AS plays, COUNT(DISTINCT p.show_id) AS shows, MAX(p.airdate) AS last, MAX(s.image) AS image FROM kexp_plays p JOIN kexp_shows s ON s.id = p.show_id
    WHERE p.airdate >= ? AND s.program IS NOT NULL GROUP BY s.program ORDER BY plays DESC LIMIT ?`).all(t, n).map(r => ({ ...r, last: iso(r.last) }));
  if (by === 'dj') return d.prepare(`SELECT s.hosts AS hosts, COUNT(*) AS plays, COUNT(DISTINCT p.show_id) AS shows, MAX(p.airdate) AS last, GROUP_CONCAT(DISTINCT s.program) AS programs FROM kexp_plays p JOIN kexp_shows s ON s.id = p.show_id
    WHERE p.airdate >= ? AND s.hosts IS NOT NULL GROUP BY s.hosts ORDER BY plays DESC LIMIT ?`).all(t, n).map(r => ({ ...r, last: iso(r.last) }));
  if (by === 'album') return d.prepare(`SELECT MIN(artist) AS artist, MIN(album) AS album, MAX(label) AS label, COUNT(*) AS plays, MAX(airdate) AS last, MAX(image) AS image FROM kexp_plays
    WHERE airdate >= ? AND album IS NOT NULL AND album NOT LIKE '%live on kexp%' AND ${NOT_VA} GROUP BY artist COLLATE NOCASE, album COLLATE NOCASE ORDER BY plays DESC, last DESC LIMIT ?`).all(t, n).map(r => ({ ...r, last: iso(r.last) }));
  return d.prepare(`SELECT MIN(artist) AS artist, COUNT(*) AS plays, COUNT(DISTINCT song) AS songs, MAX(airdate) AS last, MAX(image) AS image FROM kexp_plays
    WHERE airdate >= ? AND artist IS NOT NULL AND ${NOT_VA} GROUP BY artist COLLATE NOCASE ORDER BY plays DESC, last DESC LIMIT ?`).all(t, n).map(r => ({ ...r, last: iso(r.last) }));
}
// q matches artist, song or album; group: artist | song | play
function search({ q, group = 'artist', limit = 100 } = {}) {
  q = String(q || '').trim(); if (q.length < 2) return [];
  const d = open(), L = like(q), n = lim(limit, 100, 500), W = `(artist LIKE ? ESCAPE '\\' OR song LIKE ? ESCAPE '\\' OR album LIKE ? ESCAPE '\\')`;
  if (group === 'play') return d.prepare(`SELECT * FROM kexp_plays WHERE ${W} ORDER BY airdate DESC LIMIT ?`).all(L, L, L, n).map(play);
  if (group === 'song') return d.prepare(`SELECT MIN(artist) AS artist, MIN(song) AS song, COUNT(*) AS plays, MIN(airdate) AS first, MAX(airdate) AS last, MAX(image) AS image FROM kexp_plays
    WHERE ${W} AND song IS NOT NULL GROUP BY artist COLLATE NOCASE, song COLLATE NOCASE ORDER BY plays DESC, last DESC LIMIT ?`).all(L, L, L, n).map(r => ({ ...r, first: iso(r.first), last: iso(r.last) }));
  return d.prepare(`SELECT MIN(artist) AS artist, COUNT(*) AS plays, COUNT(DISTINCT song) AS songs, MIN(airdate) AS first, MAX(airdate) AS last, MAX(image) AS image FROM kexp_plays
    WHERE ${W} GROUP BY artist COLLATE NOCASE ORDER BY plays DESC, last DESC LIMIT ?`).all(L, L, L, n).map(r => ({ ...r, first: iso(r.first), last: iso(r.last) }));
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
function onAir({ program, dj, period = 'all' } = {}) {
  const d = open(), t = since(period), W = program ? 's.program = ?' : "(', ' || s.hosts || ', ') LIKE ? ESCAPE '\\'", v = program ? String(program) : like(', ' + String(dj || '') + ', ').replace(/^%|%$/g, '%');
  const sum = d.prepare(`SELECT COUNT(*) AS plays, COUNT(DISTINCT p.show_id) AS shows, MIN(p.airdate) AS first, MAX(p.airdate) AS last, GROUP_CONCAT(DISTINCT s.hosts) AS hosts, GROUP_CONCAT(DISTINCT s.program) AS programs, MAX(s.image) AS image, MAX(s.tags) AS tags
    FROM kexp_plays p JOIN kexp_shows s ON s.id = p.show_id WHERE ${W} AND p.airdate >= ?`).get(v, t);
  if (!sum.plays) return null;
  const artists = d.prepare(`SELECT MIN(p.artist) AS artist, COUNT(*) AS plays, MAX(p.airdate) AS last FROM kexp_plays p JOIN kexp_shows s ON s.id = p.show_id
    WHERE ${W} AND p.airdate >= ? AND p.artist IS NOT NULL GROUP BY p.artist COLLATE NOCASE ORDER BY plays DESC, last DESC LIMIT 30`).all(v, t).map(r => ({ ...r, last: iso(r.last) }));
  const songs = d.prepare(`SELECT MIN(p.artist) AS artist, MIN(p.song) AS song, COUNT(*) AS plays, MAX(p.airdate) AS last FROM kexp_plays p JOIN kexp_shows s ON s.id = p.show_id
    WHERE ${W} AND p.airdate >= ? AND p.song IS NOT NULL GROUP BY p.artist COLLATE NOCASE, p.song COLLATE NOCASE ORDER BY plays DESC, last DESC LIMIT 30`).all(v, t).map(r => ({ ...r, last: iso(r.last) }));
  const recent = d.prepare(`SELECT p.* FROM kexp_plays p JOIN kexp_shows s ON s.id = p.show_id WHERE ${W} ORDER BY p.airdate DESC LIMIT 60`).all(v).map(play);
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
function recent({ limit = 50, comments = false } = {}) {
  return open().prepare(`SELECT * FROM kexp_plays ${comments ? "WHERE comment IS NOT NULL AND comment != ''" : ''} ORDER BY airdate DESC LIMIT ?`).all(lim(limit, 50, 300)).map(play);
}
// artists KEXP started playing recently: first play within `days`, only once there's older history to compare with
function newArtists({ days = 14, limit = 50 } = {}) {
  const d = open(), t = Math.round(Date.now() / 1000) - lim(days, 14, 90) * 86400;
  const oldest = (d.prepare('SELECT MIN(airdate) AS t FROM kexp_plays').get() || {}).t;
  if (!oldest || oldest > t - 30 * 86400) return { ready: false, list: [] };
  const list = d.prepare(`SELECT MIN(artist) AS artist, COUNT(*) AS plays, MIN(airdate) AS first, MAX(airdate) AS last, MAX(image) AS image FROM kexp_plays
    WHERE artist IS NOT NULL GROUP BY artist COLLATE NOCASE HAVING MIN(airdate) >= ? ORDER BY plays DESC, last DESC LIMIT ?`).all(t, lim(limit, 50, 200)).map(r => ({ ...r, first: iso(r.first), last: iso(r.last) }));
  return { ready: true, list };
}

start();
module.exports = { status, checkNew, backfillStep, fillShows, row, start, top, search, artist, song, around, recent, newArtists, onAir, open };
