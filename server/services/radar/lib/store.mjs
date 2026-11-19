// Music Radar storage. In Cadence it lives in the same SQLite database as everything else (cadence.db, radar_*
// tables), so it shows up in the Database view and in the NAS backups. If node:sqlite isn't available it falls
// back to the original files (state.json + *.jsonl + history.json) in the radar folder.
// Old files found on first start are imported once and renamed to *.imported.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { DATA, now, DAY } from "./config.mjs";
import { norm } from "./extract.mjs";

const STATE = path.join(DATA, "state.json");
const HISTORY = path.join(DATA, "history.json");
export const DB_FILE = process.env.RADAR_DB || path.join(process.env.DATA_DIR || path.dirname(DATA), "cadence.db");
const blank = () => ({
  subs: null,            // (unused: the old subreddit list)
  artists: {},           // key -> { name, firstSeen:{sub:ts}, genres:{g:n}, lastfm, listenersHistory }
  picks: [],             // everything ever put in your feed
  feedback: {},          // pickId -> 1 | -1
  edges: {},             // "a|||b" -> { a, b, n, ts }  ("sounds like" map)
  subMentions: {},       // r/xyz mentioned in comments -> count
  subSuggestions: [],
  alerts: {},            // key -> last alert ts
  seenPosts: {},         // postId -> ts (so trends count each post once)
  extractCache: {},      // postId -> extraction result
  digests: [],
});
const KV = ["subs", "feedback", "subMentions", "subSuggestions", "alerts", "seenPosts", "extractCache"];
const SERIES = {   // the time series (were *.jsonl): table columns besides ts + json
  snapshots: ["kind", "key", "artist", "score", "mentions"],
  genres: ["genre", "n"],
  terms: ["term", "n"],
};

// ---- open the database ----
let db = null;
export let storageNote = "";
function open() {
  if (db !== null) return db;
  let sqlite;
  try { sqlite = createRequire(import.meta.url)("node:sqlite"); } catch (e) { storageNote = "node:sqlite unavailable, using files"; return (db = false); }
  try {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    db = new sqlite.DatabaseSync(DB_FILE);
    db.exec(`PRAGMA busy_timeout=5000`);   // first: switching to WAL needs a lock the app may be holding
    try { createRequire(import.meta.url)("../../../lib/sqlite-tune.js").tune(db, { cacheMB: 32, mmapMB: 256 }); } catch (e) { console.error("radar store tune", e.message); }
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;
      CREATE TABLE IF NOT EXISTS radar_kv (key TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS radar_artists (key TEXT PRIMARY KEY, name TEXT, genres TEXT, subs TEXT, first_seen INTEGER, listeners INTEGER, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS radar_picks (id TEXT PRIMARY KEY, ts INTEGER, artist TEXT, song TEXT, type TEXT, score REAL, genres TEXT, subs TEXT, link TEXT, thread TEXT, json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS radar_picks_ts ON radar_picks(ts);
      CREATE TABLE IF NOT EXISTS radar_edges (id TEXT PRIMARY KEY, a TEXT, b TEXT, n INTEGER, ts INTEGER);
      CREATE TABLE IF NOT EXISTS radar_digests (id TEXT PRIMARY KEY, ts INTEGER, title TEXT, file TEXT, html TEXT);
      CREATE TABLE IF NOT EXISTS radar_history (sub TEXT NOT NULL, month TEXT NOT NULL, posts INTEGER, music INTEGER, top_genres TEXT, json TEXT NOT NULL, PRIMARY KEY (sub, month));
      CREATE TABLE IF NOT EXISTS radar_signals (id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, uid TEXT NOT NULL, first_seen INTEGER, last_seen INTEGER, seen INTEGER DEFAULT 1,
        artist TEXT, artist_key TEXT, title TEXT, type TEXT, feed TEXT, rank INTEGER, best_rank INTEGER, metric REAL, genres TEXT, date TEXT, url TEXT, image TEXT, json TEXT, UNIQUE (source, uid));
      CREATE INDEX IF NOT EXISTS radar_signals_artist ON radar_signals(artist_key);
      CREATE INDEX IF NOT EXISTS radar_signals_seen ON radar_signals(source, first_seen);
      CREATE TABLE IF NOT EXISTS radar_chart_points (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, source TEXT, uid TEXT, artist TEXT, title TEXT, feed TEXT, rank INTEGER, metric REAL);
      CREATE INDEX IF NOT EXISTS radar_chart_points_uid ON radar_chart_points(source, uid, ts);
      CREATE TABLE IF NOT EXISTS radar_source_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, source TEXT, ok INTEGER, n INTEGER, fresh INTEGER, ms INTEGER, error TEXT);
      CREATE TABLE IF NOT EXISTS radar_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, kind TEXT, ok INTEGER, ms INTEGER, errors INTEGER, problem TEXT, lines TEXT);
      CREATE INDEX IF NOT EXISTS radar_signals_last ON radar_signals(last_seen);
      CREATE INDEX IF NOT EXISTS radar_chart_points_ts ON radar_chart_points(ts);
      CREATE INDEX IF NOT EXISTS radar_picks_artist ON radar_picks(artist COLLATE NOCASE);
    `);
    for (const [name, cols] of Object.entries(SERIES)) {
      db.exec(`CREATE TABLE IF NOT EXISTS radar_${name} (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, ${cols.map((c) => `${c} ${c === "n" || c === "mentions" ? "INTEGER" : c === "score" ? "REAL" : "TEXT"}`).join(", ")}, json TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS radar_${name}_ts ON radar_${name}(ts);`);
    }
    importFiles();
  } catch (e) {
    console.error("radar store", e); try { db && db.close(); } catch {}
    // busy is temporary (the app was writing): try again next time instead of falling back to files for good
    if (/busy|locked/i.test(e.message)) { db = null; storageNote = "database busy, retrying"; return false; }
    storageNote = "database error, using files: " + e.message; db = false;
  }
  return db;
}
export const usingDb = () => !!open();
const tx = (fn) => { db.exec("BEGIN"); try { fn(); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; } };
const J = (v) => JSON.stringify(v ?? null);
const list = (v) => (Array.isArray(v) ? v.join(", ") : v && typeof v === "object" ? Object.keys(v).join(", ") : v ?? null);

// one-time import of the original files
function importFiles() {
  const done = (f) => { try { fs.renameSync(f, f + ".imported"); } catch {} };
  if (fs.existsSync(STATE) && !db.prepare("SELECT 1 FROM radar_kv LIMIT 1").get()) {
    try { writeState({ ...blank(), ...JSON.parse(fs.readFileSync(STATE, "utf8")) }); done(STATE); console.log("radar: imported state.json into cadence.db"); } catch (e) { console.error("radar import state", e); }
  }
  for (const name of Object.keys(SERIES)) {
    const f = path.join(DATA, name + ".jsonl");
    if (!fs.existsSync(f)) continue;
    try { insertSeries(name, fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))); done(f); } catch (e) { console.error("radar import", name, e); }
  }
  if (fs.existsSync(HISTORY) && !db.prepare("SELECT 1 FROM radar_history LIMIT 1").get()) {
    try { writeHistory(JSON.parse(fs.readFileSync(HISTORY, "utf8"))); done(HISTORY); } catch (e) { console.error("radar import history", e); }
  }
}

// ---- state ----
export function loadState() {
  if (!open()) { try { return { ...blank(), ...JSON.parse(fs.readFileSync(STATE, "utf8")) }; } catch { return blank(); } }
  const s = blank();
  for (const r of db.prepare("SELECT key, json FROM radar_kv").all()) if (r.key in s) s[r.key] = JSON.parse(r.json);
  for (const r of db.prepare("SELECT key, json FROM radar_artists").all()) s.artists[r.key] = JSON.parse(r.json);
  s.picks = db.prepare("SELECT json FROM radar_picks ORDER BY ts, rowid").all().map((r) => JSON.parse(r.json));
  for (const r of db.prepare("SELECT id, a, b, n, ts FROM radar_edges").all()) s.edges[r.id] = { a: r.a, b: r.b, n: r.n, ts: r.ts };
  s.digests = db.prepare("SELECT id, ts, title, file, html FROM radar_digests ORDER BY ts").all().map((r) => ({ ...r }));
  return s;
}

function writeState(s) {
  const t = Date.now();
  tx(() => {
    const kv = db.prepare("INSERT INTO radar_kv (key, json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at");
    for (const k of KV) kv.run(k, J(s[k]), t);
    db.exec("DELETE FROM radar_artists; DELETE FROM radar_picks; DELETE FROM radar_edges; DELETE FROM radar_digests;");
    const a = db.prepare("INSERT INTO radar_artists (key, name, genres, subs, first_seen, listeners, json) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const [key, v] of Object.entries(s.artists || {})) {
      const first = Object.values(v.firstSeen || {});
      a.run(key, v.name ?? key, Object.entries(v.genres || {}).sort((x, y) => y[1] - x[1]).map(([g]) => g).join(", ") || null,
        list(v.firstSeen), first.length ? Math.min(...first) : null, v.listeners ?? v.lastfm?.listeners ?? null, J(v));
    }
    const p = db.prepare("INSERT OR REPLACE INTO radar_picks (id, ts, artist, song, type, score, genres, subs, link, thread, json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    for (const x of s.picks || []) p.run(String(x.id), x.ts ?? null, x.artist ?? null, x.song ?? null, x.type ?? null, x.score ?? null, list(x.genres), list(x.subs), x.link ?? null, x.thread ?? null, J(x));
    const e = db.prepare("INSERT OR REPLACE INTO radar_edges (id, a, b, n, ts) VALUES (?, ?, ?, ?, ?)");
    for (const [id, v] of Object.entries(s.edges || {})) e.run(id, v.a ?? null, v.b ?? null, v.n ?? null, v.ts ?? null);
    const d = db.prepare("INSERT OR REPLACE INTO radar_digests (id, ts, title, file, html) VALUES (?, ?, ?, ?, ?)");
    for (const x of s.digests || []) d.run(String(x.id), x.ts ?? null, x.title ?? null, x.file ?? null, x.html ?? null);
  });
}

export function saveState(s) {
  const t = now();
  for (const [id, ts] of Object.entries(s.seenPosts)) if (t - ts > 10 * DAY) delete s.seenPosts[id];
  for (const [id, e] of Object.entries(s.extractCache)) if (t - e.ts > 5 * DAY) delete s.extractCache[id];
  if (open()) return writeState(s);
  fs.writeFileSync(STATE + ".tmp", JSON.stringify(s));
  fs.renameSync(STATE + ".tmp", STATE);
}

// ---- time series (snapshots, genres, terms) ----
function insertSeries(name, rows) {
  const cols = SERIES[name];
  if (!cols) throw new Error("unknown series " + name);
  const ins = db.prepare(`INSERT INTO radar_${name} (ts, ${cols.join(", ")}, json) VALUES (?, ${cols.map(() => "?").join(", ")}, ?)`);
  tx(() => { for (const r of rows) ins.run(r.ts ?? now(), ...cols.map((c) => (r[c] == null ? null : typeof r[c] === "object" ? J(r[c]) : r[c])), J(r)); });
}

export function appendJsonl(name, rows) {
  if (!rows.length) return;
  if (open() && SERIES[name]) return insertSeries(name, rows);
  fs.appendFileSync(path.join(DATA, name + ".jsonl"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
}

export function readJsonl(name, sinceTs = 0) {
  if (open() && SERIES[name]) return db.prepare(`SELECT json FROM radar_${name} WHERE ts >= ? ORDER BY ts, id`).all(sinceTs).map((r) => JSON.parse(r.json));
  try {
    return fs.readFileSync(path.join(DATA, name + ".jsonl"), "utf8").split("\n")
      .filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.ts >= sinceTs);
  } catch { return []; }
}

// ---- the old Reddit archive (no longer collected or shown since 2026-11-16; table kept, nothing deletes it) ----
function writeHistory(h) {
  tx(() => {
    db.exec("DELETE FROM radar_history");
    const ins = db.prepare("INSERT INTO radar_history (sub, month, posts, music, top_genres, json) VALUES (?, ?, ?, ?, ?, ?)");
    for (const [sub, months] of Object.entries(h || {})) for (const [month, m] of Object.entries(months || {}))
      ins.run(sub, month, m.posts ?? null, m.music ?? null, Object.entries(m.genres || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g, n]) => `${g} ${n}`).join(", ") || null, J(m));
  });
}
export function loadHistory() {
  if (!open()) { try { return JSON.parse(fs.readFileSync(HISTORY, "utf8")); } catch { return {}; } }
  const h = {};
  for (const r of db.prepare("SELECT sub, month, json FROM radar_history").all()) (h[r.sub] ||= {})[r.month] = JSON.parse(r.json);
  return h;
}
export function saveHistory(h) { if (open()) return writeHistory(h); fs.writeFileSync(HISTORY, JSON.stringify(h)); }

// ---- job log (Cadence) ----
export function addJob(j) {
  if (!open()) { fs.appendFileSync(path.join(DATA, "jobs.jsonl"), JSON.stringify(j) + "\n"); return; }
  db.prepare("INSERT INTO radar_jobs (ts, kind, ok, ms, errors, problem, lines) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(j.ts, j.kind, j.ok ? 1 : 0, j.ms, j.errors, j.problem ?? null, (j.lines || []).join("\n"));
}

// ---- other sources (lib/sources.mjs) ----
export function getKv(key, dflt = null) {
  if (!open()) return dflt;
  const r = db.prepare("SELECT json FROM radar_kv WHERE key = ?").get(key);
  return r ? JSON.parse(r.json) : dflt;
}
export function setKv(key, v) { if (open()) db.prepare("INSERT INTO radar_kv (key, json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at").run(key, J(v), Date.now()); }
// returns how many were new; anything already known gets last_seen/rank updated, charts get a point per run
export function upsertSignals(rows, ts) {
  if (!open()) throw new Error("other sources need the database (node:sqlite)");
  let fresh = 0;
  tx(() => {
    const get = db.prepare("SELECT id FROM radar_signals WHERE source = ? AND uid = ?");
    const ins = db.prepare(`INSERT INTO radar_signals (source, uid, first_seen, last_seen, seen, artist, artist_key, title, type, feed, rank, best_rank, metric, genres, date, url, image, json)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const upd = db.prepare("UPDATE radar_signals SET last_seen = ?, seen = seen + 1, rank = ?, best_rank = MIN(COALESCE(best_rank, ?), COALESCE(?, best_rank)), metric = COALESCE(?, metric) WHERE id = ?");
    alikeTable();
    const al = db.prepare("INSERT INTO radar_alike (a, b, feed, ts) VALUES (?, ?, ?, ?) ON CONFLICT(a, b, feed) DO UPDATE SET ts = excluded.ts");
    const pt = db.prepare("INSERT INTO radar_chart_points (ts, source, uid, artist, title, feed, rank, metric) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    for (const r of rows) {
      const g = list(r.genres), had = get.get(r.source, r.uid), rank = r.rank ?? null, metric = r.metric ?? null;
      if (had) upd.run(ts, rank, rank, rank, metric, had.id);
      else { ins.run(r.source, r.uid, ts, ts, r.artist, r.artist_key, r.title ?? null, r.type ?? null, r.feed ?? null, rank, rank, metric, g || null, r.date ?? null, r.url ?? null, r.image ?? null, J(r)); fresh++; }
      if (rank != null) pt.run(ts, r.source, r.uid, r.artist, r.title ?? null, r.feed ?? null, rank, metric);
      for (const o of r.soundsLike || []) { const b = norm(o); if (b && b !== r.artist_key) al.run(r.artist_key, b, r.feed || r.source, ts); }
    }
  });
  return fresh;
}
export function addSourceRun(r) { if (open()) db.prepare("INSERT INTO radar_source_runs (ts, source, ok, n, fresh, ms, error) VALUES (?, ?, ?, ?, ?, ?, ?)").run(r.ts, r.source, r.ok ? 1 : 0, r.n, r.fresh, r.ms, r.error ?? null); }
export function sourceRuns() { return open() ? db.prepare("SELECT r.* FROM radar_source_runs r JOIN (SELECT source, MAX(id) AS id FROM radar_source_runs GROUP BY source) l ON l.id = r.id").all() : []; }
export function signals({ since = 0, source = null, limit = 5000 } = {}) {
  if (!open()) return [];
  return db.prepare(`SELECT source, uid, first_seen, last_seen, seen, artist, artist_key, title, type, feed, rank, best_rank, metric, genres, date, url, image
    FROM radar_signals WHERE last_seen >= ? ${source ? "AND source = ?" : ""} ORDER BY first_seen DESC, id DESC LIMIT ?`).all(...(source ? [since, source, limit] : [since, limit]));
}
// everything any source has said about one artist (by normalised name), newest first
export function signalsFor(artistKey, limit = 300) {
  if (!open()) return [];
  // blog posts also bring their extras (listen links, release announcements), kept in the row's json
  return db.prepare(`SELECT source, uid, first_seen, last_seen, seen, artist, artist_key, title, type, feed, rank, best_rank, metric, genres, date, url, image,
    CASE WHEN source = 'blogs' THEN json END AS extra
    FROM radar_signals WHERE artist_key = ? ORDER BY last_seen DESC, id DESC LIMIT ?`).all(artistKey, limit).map(({ extra, ...r }) => {
      if (extra) try { const j = JSON.parse(extra); if (j.listen?.length) r.listen = j.listen; if (j.announce) r.announce = { release: j.release || null }; } catch {}
      return r;
    });
}
// ---- "sounds like" lines from blog posts (2026-11-17): a writer naming similar artists, one row per pair per blog ----
function alikeTable() { db.exec("CREATE TABLE IF NOT EXISTS radar_alike (a TEXT NOT NULL, b TEXT NOT NULL, feed TEXT NOT NULL, ts INTEGER, PRIMARY KEY (a, b, feed)); CREATE INDEX IF NOT EXISTS radar_alike_b ON radar_alike(b)"); }
export function alikeFor(key, limit = 12) {
  if (!open()) return [];
  alikeTable();
  return db.prepare(`SELECT CASE WHEN l.a = ? THEN l.b ELSE l.a END AS key, COUNT(*) AS n, GROUP_CONCAT(DISTINCT l.feed) AS feeds, a.name AS name
    FROM radar_alike l LEFT JOIN radar_artists a ON a.key = (CASE WHEN l.a = ? THEN l.b ELSE l.a END) WHERE l.a = ? OR l.b = ? GROUP BY 1 ORDER BY n DESC LIMIT ?`).all(key, key, key, key, limit);
}
// every pair (For you's taste links); small: a few per post
export function alikeAll() { if (!open()) return []; alikeTable(); return db.prepare("SELECT a, b, COUNT(*) AS n FROM radar_alike GROUP BY a, b").all(); }
export function chartPoints({ since = 0, uids = null } = {}) {
  if (!open()) return [];
  return db.prepare("SELECT ts, source, uid, artist, title, feed, rank, metric FROM radar_chart_points WHERE ts >= ? ORDER BY ts").all(since).filter((p) => !uids || uids.has(p.source + "|" + p.uid));
}

// ---- one artist without loading everything (artist pages, 2026-11-16: loadState() read the whole Radar every time) ----
// artists Radar knows whose name contains q (exact names first, then names starting with it), for search suggestions
export function findArtists(q, limit = 8) {
  q = String(q || "").trim(); if (!q || !open()) return [];
  const esc = q.replace(/[\\%_]/g, (c) => "\\" + c);
  return db.prepare(`SELECT key, name, listeners FROM radar_artists WHERE name LIKE ? ESCAPE '\\'
    ORDER BY CASE WHEN name = ? COLLATE NOCASE THEN 0 WHEN name LIKE ? ESCAPE '\\' THEN 1 ELSE 2 END, length(name) LIMIT ?`).all("%" + esc + "%", q, esc + "%", limit);
}
export function artistRecord(key) {
  if (!open()) return loadState().artists[key] || null;
  const r = db.prepare("SELECT json FROM radar_artists WHERE key = ?").get(key);
  return r ? JSON.parse(r.json) : null;
}
// their picks: by exact name, or by the stored key (covers spellings that normalise the same)
export function picksForArtist(key, name) {
  if (!open()) return loadState().picks.filter((p) => p.key === key);
  return db.prepare("SELECT json FROM radar_picks WHERE artist = ? COLLATE NOCASE OR json LIKE ? ESCAPE '\\' ORDER BY ts DESC LIMIT 200")
    .all(String(name || ""), '%"key":' + JSON.stringify(key).replace(/[\\%_]/g, (c) => "\\" + c) + "%").map((r) => JSON.parse(r.json));
}
// chart points for just these entries (pairs of "source|uid"), using the (source, uid, ts) index
export function chartPointsFor(pairs, since = 0) {
  if (!open()) return chartPoints({ since, uids: new Set(pairs) });
  const q = db.prepare("SELECT ts, source, uid, artist, title, feed, rank, metric FROM radar_chart_points WHERE source = ? AND uid = ? AND ts >= ? ORDER BY ts");
  const out = []; for (const id of pairs) { const i = id.indexOf("|"); out.push(...q.all(id.slice(0, i), id.slice(i + 1), since)); }
  return out;
}
// finished artist pages, served at once and rebuilt in the background when they get old
function pagesTable() { db.exec("CREATE TABLE IF NOT EXISTS radar_artist_pages (key TEXT PRIMARY KEY, json TEXT NOT NULL, at INTEGER NOT NULL, opened INTEGER NOT NULL)"); }
export function getPage(key) {
  if (!open()) return null; pagesTable();
  const r = db.prepare("SELECT json, at FROM radar_artist_pages WHERE key = ?").get(key);
  if (!r) return null;
  db.prepare("UPDATE radar_artist_pages SET opened = ? WHERE key = ?").run(Date.now(), key);
  return { d: JSON.parse(r.json), at: r.at };
}
export function setPage(key, d) {
  if (!open()) return; pagesTable();
  db.prepare("INSERT INTO radar_artist_pages (key, json, at, opened) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET json = excluded.json, at = excluded.at").run(key, JSON.stringify(d), Date.now(), Date.now());
}
// pages opened lately (kept fresh in the background), oldest-built first; anything not opened in 60 days is dropped
export function pagesToRefresh(olderThan, limit = 20) {
  if (!open()) return []; pagesTable();
  db.prepare("DELETE FROM radar_artist_pages WHERE opened < ?").run(Date.now() - 60 * 86400e3);
  return db.prepare("SELECT key, json_extract(json, '$.name') AS name FROM radar_artist_pages WHERE at < ? ORDER BY at LIMIT ?").all(Date.now() - olderThan, limit);
}

// first early sighting for just these artists (one grouped query)
export function firstEarlyFor(keys, sources) {
  if (!open() || !keys.length) return [];
  const out = [];
  for (let i = 0; i < keys.length; i += 500) {
    const k = keys.slice(i, i + 500);
    out.push(...db.prepare(`SELECT artist_key AS key, MIN(artist) AS artist, MIN(first_seen) AS ts, source, MIN(feed) AS feed FROM radar_signals WHERE artist_key IN (${k.map(() => "?").join(",")}) AND source IN (${sources.map(() => "?").join(",")}) GROUP BY artist_key, source`).all(...k, ...sources));
  }
  return out;
}
// just the artists (keyed), without picks, edges and digests
export function loadArtists() {
  if (!open()) return loadState().artists;
  const out = {}; for (const r of db.prepare("SELECT key, json FROM radar_artists").all()) { try { out[r.key] = JSON.parse(r.json); } catch {} }
  return out;
}
// first time each artist turned up, per kind of source (for "Called it"): grouped by the database, not loaded whole
export function firstSightings(sources) {
  if (!open()) return [];
  return db.prepare(`SELECT artist_key AS key, MIN(artist) AS artist, MIN(first_seen) AS ts, source, MIN(feed) AS feed FROM radar_signals WHERE source IN (${sources.map(() => "?").join(",")}) GROUP BY artist_key, source`).all(...sources);
}
// ---- artists mentioned together with this one (the "sounds like" graph), strongest first ----
export function neighbors(key, limit = 12) {
  if (!open()) return [];
  db.exec("CREATE INDEX IF NOT EXISTS radar_edges_a ON radar_edges(a); CREATE INDEX IF NOT EXISTS radar_edges_b ON radar_edges(b)");
  return db.prepare("SELECT CASE WHEN e.a = ? THEN e.b ELSE e.a END AS key, e.n AS n, a.name AS name FROM radar_edges e LEFT JOIN radar_artists a ON a.key = (CASE WHEN e.a = ? THEN e.b ELSE e.a END) WHERE e.a = ? OR e.b = ? ORDER BY e.n DESC LIMIT ?")
    .all(key, key, key, key, limit);
}
// ---- what you listened to (user, 2026-11-16: Radar learns your taste; Your year in music) ----
// one row per song heard: kind = preview | live (a station) | kexp; secs = how long it played; skipped = stopped early
function listensTable() { db.exec("CREATE TABLE IF NOT EXISTS radar_listens (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, artist TEXT, artist_key TEXT, title TEXT, kind TEXT, station TEXT, secs INTEGER, skipped INTEGER); CREATE INDEX IF NOT EXISTS radar_listens_ts ON radar_listens(ts); CREATE INDEX IF NOT EXISTS radar_listens_key ON radar_listens(artist_key)"); }
export function addListen(r) {
  if (!open()) return; listensTable();
  db.prepare("INSERT INTO radar_listens (ts, artist, artist_key, title, kind, station, secs, skipped) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(r.ts, r.artist, r.artist_key, r.title ?? null, r.kind, r.station ?? null, r.secs | 0, r.skipped ? 1 : 0);
}
export function listensSince(ts, limit = 20000) { if (!open()) return []; listensTable(); return db.prepare("SELECT ts, artist, artist_key, title, kind, station, secs, skipped FROM radar_listens WHERE ts >= ? ORDER BY ts DESC LIMIT ?").all(ts, limit); }

// ---- read-only table access for the Database view ----
export function tables() {
  if (!open()) return null;
  // Music Radar's tables, plus KEXP's play history (kexp_*) which lives in the same file
  return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND (name LIKE 'radar\\_%' ESCAPE '\\' OR name LIKE 'kexp\\_%' ESCAPE '\\') ORDER BY name").all()
    .map(({ name }) => ({ name, count: db.prepare(`SELECT COUNT(*) AS n FROM ${name}`).get().n, bytes: tableBytes(name),
      columns: db.prepare(`PRAGMA table_info(${name})`).all().map((c) => c.name) }));
}
// space a table (and its indexes) takes on disk: exact from dbstat when SQLite has it, else estimated from the data
function tableBytes(name) {
  try { return db.prepare("SELECT SUM(pgsize) AS b FROM dbstat WHERE name = ? OR name IN (SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ?)").get(name, name).b || 0; }
  catch {
    try { const cols = db.prepare(`PRAGMA table_info(${name})`).all().map((c) => `IFNULL(LENGTH(CAST(${c.name} AS BLOB)), 0)`).join(" + ") || "0";
      return Math.round((db.prepare(`SELECT SUM(${cols}) AS b FROM ${name}`).get().b || 0) * 1.3); } catch { return null; }
  }
}
export function tableRows(name, { offset = 0, limit = 50 } = {}) {
  const t = (tables() || []).find((x) => x.name === name);
  if (!t) return null;
  const order = t.columns.includes("ts") ? "ORDER BY ts DESC" : t.columns.includes("airdate") ? "ORDER BY airdate DESC" : t.columns.includes("start") ? "ORDER BY start DESC" : t.columns.includes("month") ? "ORDER BY month DESC, sub" : "";
  const rows = db.prepare(`SELECT * FROM ${name} ${order} LIMIT ? OFFSET ?`).all(limit, offset);
  return { name, total: t.count, offset, columns: t.columns, rows: rows.map((r) => t.columns.map((c) => r[c])) };
}
