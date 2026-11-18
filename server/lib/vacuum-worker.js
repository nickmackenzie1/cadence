'use strict';
// VACUUMs cadence.db off the main thread (storage.js reclaim()): rewrites the file without its empty pages.
const { workerData, parentPort } = require('worker_threads');
const { DatabaseSync } = require('node:sqlite');
try {
  const db = new DatabaseSync(workerData.file);
  db.exec('PRAGMA busy_timeout = 30000');
  try {
    // KEXP history now lives in kexp.db: drop the copy the move left behind (only when storage.js says it's done)
    if (workerData.dropKexp) {
      const ts = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'kexp\\_%' ESCAPE '\\' AND name NOT LIKE 'kexp\\_fts\\_%' ESCAPE '\\'").all().map(r => r.name);
      db.exec('BEGIN IMMEDIATE'); try { for (const t of ts) db.exec(`DROP TABLE IF EXISTS "${t.replace(/"/g, '""')}"`); db.exec('COMMIT'); } catch (e) { try { db.exec('ROLLBACK'); } catch {} throw e; }
    }
    db.exec('VACUUM'); db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  } finally { db.close(); }
  parentPort.postMessage({ ok: true });
} catch (e) { parentPort.postMessage({ error: e.message }); }
