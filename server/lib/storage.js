'use strict';
/* Storage: SQLite (node:sqlite, built into Node 22+) with per-record sync, history and conflicts; falls back to a
   JSON file. Daily backups of both. */
const fs = require('fs');
const path = require('path');
const { BACKUP_DIR, DATA_DIR, KEEP_BACKUPS, STATE_FILE } = require('../config');

// ---- storage: SQLite (node:sqlite, built into Node 22+); falls back to a JSON file ----
// Every task, client, meeting, plugin's data and the rest of the settings ("doc") is its own record with a revision.
// Devices sync records (GET/POST /api/sync) and edits merge field by field; a real clash (same field changed on two
// devices) keeps the newest edit and is logged in `conflicts` so you can pick the other one.
// /api/state (one document) still works for older tabs. state.json is no longer mirrored on every write (2026-11-09):
// a readable JSON snapshot goes to backups/ once a day, and any state.json found at startup is imported if newer, then retired.
const DB_FILE = path.join(DATA_DIR, 'cadence.db');
const SCHEMA = 2;
const ARRAYS = { task: 'tasks', client: 'clients', meeting: 'meetings' };
let db = null, storage = 'json', storageNote = '';
const J = v => JSON.stringify(v === undefined ? null : v);
function openDb() {
  if (/^json$/i.test(process.env.STORAGE || '')) { storageNote = 'STORAGE=json'; return; }
  let sqlite; try { sqlite = require('node:sqlite'); } catch (e) { storageNote = 'node:sqlite unavailable (' + process.version + ')'; return; }
  try {
    db = new sqlite.DatabaseSync(DB_FILE);
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=4000;
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL, updated_at INTEGER NOT NULL);`);
    const ver = +((db.prepare("SELECT value FROM meta WHERE key = 'schema'").get() || {}).value || 0);
    if (ver < 2) db.exec('DROP TABLE IF EXISTS records');   // phase-1 rows are rebuilt from the state document below
    db.exec(`CREATE TABLE IF NOT EXISTS records (
        kind TEXT NOT NULL, id TEXT NOT NULL, space TEXT NOT NULL DEFAULT 'work', data TEXT NOT NULL,
        pos REAL NOT NULL DEFAULT 0, rev INTEGER NOT NULL, edited_at INTEGER NOT NULL, device TEXT NOT NULL DEFAULT '',
        deleted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (kind, id));
      CREATE INDEX IF NOT EXISTS records_rev ON records (rev);
      CREATE TABLE IF NOT EXISTS history (kind TEXT NOT NULL, id TEXT NOT NULL, rev INTEGER NOT NULL, data TEXT NOT NULL,
        deleted INTEGER NOT NULL, device TEXT NOT NULL DEFAULT '', edited_at INTEGER NOT NULL, PRIMARY KEY (kind, id, rev));
      CREATE TABLE IF NOT EXISTS conflicts (cid INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, id TEXT NOT NULL, field TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '', kept TEXT, other TEXT, kept_device TEXT, other_device TEXT, kept_at INTEGER, other_at INTEGER,
        at INTEGER NOT NULL, resolved INTEGER NOT NULL DEFAULT 0);`);
    db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('created', ?), ('rev', '0')").run(String(Date.now()));
    storage = 'sqlite';
    const have = db.prepare('SELECT updated_at FROM state WHERE id = 1').get();
    if (ver < 2 && have) importDoc(readState(), 'migration');   // schema 1 -> 2
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema', ?)").run(String(SCHEMA));
    // bring in state.json on the first run, and again whenever it is newer than the database
    // (after running an older Cadence or STORAGE=json for a while): the newest copy always wins
    let old = null; try { old = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch {}
    const cur = db.prepare('SELECT updated_at FROM state WHERE id = 1').get();
    if (old && typeof old.json === 'string' && (!cur || (+old.updatedAt || 0) > cur.updated_at)) {
      if (!cur) try { fs.copyFileSync(STATE_FILE, path.join(BACKUP_DIR, `state-before-sqlite-${new Date().toISOString().slice(0, 10)}.json`)); } catch {}
      importDoc(old, 'state.json');
      if (!cur) db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('migrated_from_json', ?)").run(String(Date.now()));
      console.log(`storage: ${cur ? 'state.json was newer than the database: imported it' : 'imported state.json into SQLite'} (${(old.json.length / 1024).toFixed(0)} KB)`);
    }
    // the database is the only live copy now: move state.json aside so a stale copy can never win later
    if (fs.existsSync(STATE_FILE)) { try { fs.renameSync(STATE_FILE, path.join(BACKUP_DIR, `state-retired-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`)); console.log('storage: state.json retired to backups/'); } catch (e) { console.error('storage: could not retire state.json', e.message); } }
  } catch (e) {
    console.error('storage: SQLite failed, using JSON', e);
    try { db && db.close(); } catch {} db = null; storage = 'json'; storageNote = 'SQLite error: ' + e.message;
  }
}
// the document <-> records
function shred(S) {
  const out = [];
  for (const [kind, key] of Object.entries(ARRAYS)) (S[key] || []).forEach((x, i) => { if (x && x.id != null) out.push({ kind, id: String(x.id), data: x, pos: i }); });
  for (const [pid, d] of Object.entries(S.pluginData || {})) out.push({ kind: 'plugin', id: pid, data: d, pos: 0 });
  const root = {}; for (const [k, v] of Object.entries(S)) if (!['tasks', 'clients', 'meetings', 'pluginData', 'updatedAt'].includes(k)) root[k] = v;
  out.push({ kind: 'doc', id: 'root', data: root, pos: 0 });
  return out;
}
function assemble(space = 'work') {
  const S = { tasks: [], clients: [], meetings: [], pluginData: {} };
  for (const r of db.prepare('SELECT kind, id, data FROM records WHERE deleted = 0 AND space = ? ORDER BY pos, rev').all(space)) {
    const d = JSON.parse(r.data);
    if (ARRAYS[r.kind]) S[ARRAYS[r.kind]].push(d); else if (r.kind === 'plugin') S.pluginData[r.id.replace(/^life:/, '')] = d; else if (r.kind === 'doc') Object.assign(S, d);
  }
  return S;
}
const nextRev = () => { const r = +db.prepare("SELECT value FROM meta WHERE key = 'rev'").get().value + 1; db.prepare("UPDATE meta SET value = ? WHERE key = 'rev'").run(String(r)); return r; };
const curRev = () => db ? +db.prepare("SELECT value FROM meta WHERE key = 'rev'").get().value : 0;
function putRecord(kind, id, data, pos, deleted, at, device, space) {
  const rev = nextRev(), txt = J(data);
  space = space || (/^life:/.test(id) ? 'life' : (data && data.space) || 'work');
  db.prepare(`INSERT INTO records (kind, id, space, data, pos, rev, edited_at, device, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(kind, id) DO UPDATE SET space = excluded.space, data = excluded.data, pos = excluded.pos, rev = excluded.rev,
      edited_at = excluded.edited_at, device = excluded.device, deleted = excluded.deleted`).run(kind, id, space, txt, pos || 0, rev, at, device || '', deleted ? 1 : 0);
  db.prepare('INSERT OR REPLACE INTO history (kind, id, rev, data, deleted, device, edited_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(kind, id, rev, txt, deleted ? 1 : 0, device || '', at);
  return rev;
}
const titleOf = (kind, d) => (d && (d.title || d.name)) || (kind === 'doc' ? 'Settings' : kind === 'plugin' ? 'Plugin data' : kind);
// apply a batch of record changes from a device; 3-way merge per field against the version the device started from
function applyChanges(changes, device) {
  const conflicts = [];
  for (const c of changes) {
    if (!c || !c.kind || c.id == null) continue;
    const kind = String(c.kind), id = String(c.id), at = Math.min(+c.at || Date.now(), Date.now() + 60e3), base = +c.baseRev || 0;
    const sp = /^(work|life)$/.test(c.space) ? c.space : /^life:/.test(id) ? 'life' : 'work';
    const cur = db.prepare('SELECT * FROM records WHERE kind = ? AND id = ?').get(kind, id);
    if (!cur) { if (!c.deleted) putRecord(kind, id, c.data, c.pos, 0, at, device, sp); continue; }
    const curData = JSON.parse(cur.data);
    if (cur.rev === base) {                                         // nobody else touched it: just apply
      if (c.deleted ? !cur.deleted : (J(c.data) !== cur.data || cur.deleted || (c.pos != null && c.pos !== cur.pos))) putRecord(kind, id, c.deleted ? curData : c.data, c.pos ?? cur.pos, c.deleted, at, device, cur.space);
      continue;
    }
    // someone else changed it since this device last saw it
    const b = base && db.prepare('SELECT data, deleted FROM history WHERE kind = ? AND id = ? AND rev = ?').get(kind, id, base);
    const baseData = b ? JSON.parse(b.data) : null;
    // things you edit yourself are worth a look; plugin bookkeeping and internal fields are settled silently (newest wins)
    const quiet = kind === 'plugin';
    const log = (field, kept, other, keptDev, otherDev, keptAt, otherAt) => {
      const q = quiet || (kind === 'doc' && !['settings', 'disabled', 'userPlugins'].includes(field));
      const r = db.prepare(`INSERT INTO conflicts (kind, id, field, title, kept, other, kept_device, other_device, kept_at, other_at, at, resolved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(kind, id, field, String(titleOf(kind, curData)).slice(0, 200), J(kept), J(other), keptDev, otherDev, keptAt, otherAt, Date.now(), q ? 1 : 0);
      if (!q) conflicts.push(+r.lastInsertRowid);
    };
    if (c.deleted) {                                                 // deleted here, but edited elsewhere: keep the edit
      if (!cur.deleted && baseData && J(baseData) !== cur.data) log('(deleted)', 'kept', 'deleted', cur.device, device, cur.edited_at, at);
      else if (!cur.deleted) putRecord(kind, id, curData, cur.pos, 1, at, device, cur.space);
      continue;
    }
    if (cur.deleted) { putRecord(kind, id, c.data, c.pos ?? cur.pos, 0, at, device, cur.space); log('(deleted)', 'restored', 'deleted', device, cur.device, at, cur.edited_at); continue; }
    const mine = c.data || {}, theirs = curData || {}, was = baseData || {};
    if (typeof mine !== 'object' || typeof theirs !== 'object' || Array.isArray(mine)) {   // not an object: whole value
      if (J(mine) !== J(theirs)) { const newer = at >= cur.edited_at; putRecord(kind, id, newer ? mine : theirs, c.pos ?? cur.pos, 0, Math.max(at, cur.edited_at), newer ? device : cur.device, cur.space); log('(value)', newer ? mine : theirs, newer ? theirs : mine, newer ? device : cur.device, newer ? cur.device : device, Math.max(at, cur.edited_at), Math.min(at, cur.edited_at)); }
      continue;
    }
    const merged = { ...theirs };
    let changed = false;
    for (const k of new Set([...Object.keys(mine), ...Object.keys(theirs), ...Object.keys(was)])) {
      const m = J(mine[k]), t = J(theirs[k]), w = J(was[k]);
      if (m === t || m === w) continue;                              // same, or only they changed it
      if (t === w || !baseData && t === 'null') { if (k in mine) merged[k] = mine[k]; else delete merged[k]; changed = true; continue; }   // only this device changed it
      // both changed the same field differently: newest edit wins, the other is kept for review
      if (at >= cur.edited_at) { if (k in mine) merged[k] = mine[k]; else delete merged[k]; changed = true; log(k, mine[k], theirs[k], device, cur.device, at, cur.edited_at); }
      else log(k, theirs[k], mine[k], cur.device, device, cur.edited_at, at);
    }
    if (changed) putRecord(kind, id, merged, cur.pos, 0, Math.max(at, cur.edited_at), device, cur.space);
  }
  return conflicts;
}
// write the assembled document to the state table (for older tabs), plus a readable JSON snapshot once a day
function refreshDoc() {
  const S = assemble(), at = Date.now(); S.updatedAt = at;
  const doc = { json: JSON.stringify(S), updatedAt: at };
  db.prepare('INSERT INTO state (id, json, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at').run(doc.json, at);
  dailyJsonBackup(doc);
  dailyDbBackup();
  return doc;
}
// a whole document (first import, older tabs, migration): each record that differs is written, newest-wins per record
function importDoc(doc, device) {
  let S; try { S = JSON.parse(doc.json); } catch { return; }
  const at = +doc.updatedAt || Date.now(), recs = shred(S), seen = new Set();
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const r of recs) {
      seen.add(r.kind + '\u0000' + r.id);
      const cur = db.prepare('SELECT data, pos, deleted, space FROM records WHERE kind = ? AND id = ?').get(r.kind, r.id);
      if (cur && cur.space !== 'work') continue;                    // never let a Work document touch Life
      if (!cur || cur.deleted || cur.data !== J(r.data) || cur.pos !== r.pos) putRecord(r.kind, r.id, r.data, r.pos, 0, at, device, 'work');
    }
    for (const r of db.prepare("SELECT kind, id, data, pos FROM records WHERE deleted = 0 AND space = 'work'").all()) if (!seen.has(r.kind + '\u0000' + r.id)) putRecord(r.kind, r.id, JSON.parse(r.data), r.pos, 1, at, device, 'work');
    db.prepare('INSERT INTO state (id, json, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at').run(doc.json, at);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
function syncPull(since) {
  const rows = db.prepare('SELECT kind, id, space, data, pos, rev, deleted, device, edited_at FROM records WHERE rev > ? ORDER BY rev').all(+since || 0);
  return { cursor: curRev(), records: rows.map(r => ({ kind: r.kind, id: r.id, space: r.space, data: JSON.parse(r.data), pos: r.pos, rev: r.rev, deleted: !!r.deleted, device: r.device, at: r.edited_at })),
    docUpdatedAt: (db.prepare('SELECT updated_at FROM state WHERE id = 1').get() || {}).updated_at || 0, conflicts: db.prepare('SELECT COUNT(*) AS n FROM conflicts WHERE resolved = 0').get().n };
}
function syncPush(changes, device, since) {
  db.exec('BEGIN IMMEDIATE');
  let ids;
  try { ids = applyChanges(changes, device); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
  if (changes.length) refreshDoc();
  const out = syncPull(since);
  out.newConflicts = ids.length ? listConflicts(ids) : [];
  return out;
}
function listConflicts(ids) {
  const rows = ids ? db.prepare(`SELECT * FROM conflicts WHERE cid IN (${ids.map(() => '?').join(',')})`).all(...ids) : db.prepare('SELECT * FROM conflicts WHERE resolved = 0 ORDER BY cid DESC LIMIT 100').all();
  return rows.map(r => ({ cid: r.cid, kind: r.kind, id: r.id, field: r.field, title: r.title, kept: JSON.parse(r.kept), other: JSON.parse(r.other), keptDevice: r.kept_device, otherDevice: r.other_device, keptAt: r.kept_at, otherAt: r.other_at, at: r.at }));
}
function dailyDbBackup() {
  const day = new Date().toISOString().slice(0, 10), f = path.join(BACKUP_DIR, `cadence-${day}.db`);
  if (fs.existsSync(f)) return;
  try { db.exec(`VACUUM INTO '${f.replace(/'/g, "''")}'`); } catch (e) { console.error('backup failed', e.message); return; }
  const all = fs.readdirSync(BACKUP_DIR).filter(x => /^cadence-\d{4}-\d{2}-\d{2}\.db$/.test(x)).sort();
  while (all.length > KEEP_BACKUPS) fs.unlinkSync(path.join(BACKUP_DIR, all.shift()));
  // keep 60 days of record history (the newest version of every record always stays)
  try { db.prepare('DELETE FROM history WHERE edited_at < ? AND rev NOT IN (SELECT rev FROM records)').run(Date.now() - 60 * 864e5); } catch {}
}
function readState() {
  if (db) { const r = db.prepare('SELECT json, updated_at FROM state WHERE id = 1').get(); return r ? { json: r.json, updatedAt: r.updated_at } : { json: null, updatedAt: 0 }; }
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return { json: null, updatedAt: 0 }; }
}
function writeJsonMirror(obj) {
  const tmp = STATE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj));
  fs.renameSync(tmp, STATE_FILE);
  // one JSON backup per day (the database gets its own daily snapshot too)
  const day = new Date().toISOString().slice(0, 10);
  fs.copyFileSync(STATE_FILE, path.join(BACKUP_DIR, `state-${day}.json`));
  const all = fs.readdirSync(BACKUP_DIR).filter(f => /^state-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  while (all.length > KEEP_BACKUPS) fs.unlinkSync(path.join(BACKUP_DIR, all.shift()));
}
// one readable JSON copy per day in backups/ (SQLite mode); kept KEEP_BACKUPS days
function dailyJsonBackup(doc) {
  const f = path.join(BACKUP_DIR, `state-${new Date().toISOString().slice(0, 10)}.json`);
  if (fs.existsSync(f)) return;
  try { fs.writeFileSync(f + '.tmp', JSON.stringify(doc)); fs.renameSync(f + '.tmp', f);
    const all = fs.readdirSync(BACKUP_DIR).filter(x => /^state-\d{4}-\d{2}-\d{2}\.json$/.test(x)).sort();
    while (all.length > KEEP_BACKUPS) fs.unlinkSync(path.join(BACKUP_DIR, all.shift())); } catch (e) { console.error('backup: json snapshot failed', e.message); }
}
// whole-document write (older tabs, STORAGE=json)
function writeState(obj) {
  if (db) { importDoc(obj, 'older tab'); dailyJsonBackup(readState()); dailyDbBackup(); }
  else writeJsonMirror(obj);
}
function dbInfo() {
  if (!db) return { storage, note: storageNote };
  const n = k => db.prepare('SELECT COUNT(*) AS n FROM records WHERE kind = ? AND deleted = 0').get(k).n;
  const life = db.prepare("SELECT COUNT(*) AS n FROM records WHERE space = 'life' AND kind = 'task' AND deleted = 0").get().n;
  const size = f => { try { return fs.statSync(f).size; } catch { return 0; } };
  return { storage, file: 'cadence.db', bytes: size(DB_FILE) + size(DB_FILE + '-wal'), schema: SCHEMA, sqlite: db.prepare('SELECT sqlite_version() AS v').get().v,
    rows: { tasks: n('task'), clients: n('client'), meetings: n('meeting'), plugins: n('plugin') }, lifeTasks: life, rev: curRev(),
    deleted: db.prepare('SELECT COUNT(*) AS n FROM records WHERE deleted = 1').get().n,
    conflicts: db.prepare('SELECT COUNT(*) AS n FROM conflicts WHERE resolved = 0').get().n,
    devices: db.prepare("SELECT device, MAX(edited_at) AS at FROM records WHERE device != '' GROUP BY device ORDER BY at DESC LIMIT 10").all().map(r => ({ device: r.device, at: r.at })),
    migratedAt: +((db.prepare("SELECT value FROM meta WHERE key = 'migrated_from_json'").get() || {}).value || 0) || null };
}
openDb();
const closeDb = () => { try { if (db) { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); db.close(); db = null; } } catch {} };
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { closeDb(); process.exit(0); });

// for other modules: the live state of the store, read through functions (the variables above change at startup)
const hasDb = () => !!db;
const storageInfo = () => ({ storage, storageNote });
const resolveConflicts = (cids) => { if (db) for (const cid of cids) db.prepare('UPDATE conflicts SET resolved = 1 WHERE cid = ?').run(+cid); };
const allDocs = () => db ? [assemble('work'), assemble('life')] : [readState()];

// db/storage are set at startup, so other modules read them through hasDb() and storageInfo()
module.exports = { ARRAYS, DB_FILE, J, SCHEMA, allDocs, applyChanges, assemble, closeDb, curRev, dailyDbBackup, dailyJsonBackup, dbInfo, hasDb, importDoc, listConflicts, nextRev, openDb, putRecord, readState, refreshDoc, resolveConflicts, shred, storageInfo, syncPull, syncPush, titleOf, writeJsonMirror, writeState };
