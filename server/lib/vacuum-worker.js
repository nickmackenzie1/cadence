'use strict';
// VACUUMs cadence.db off the main thread (storage.js reclaim()): rewrites the file without its empty pages.
const { workerData, parentPort } = require('worker_threads');
const { DatabaseSync } = require('node:sqlite');
try {
  const db = new DatabaseSync(workerData.file);
  db.exec('PRAGMA busy_timeout = 30000');
  try { db.exec('VACUUM'); db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } finally { db.close(); }
  parentPort.postMessage({ ok: true });
} catch (e) { parentPort.postMessage({ error: e.message }); }
