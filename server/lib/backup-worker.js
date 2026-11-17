'use strict';
// Runs the daily database backup off the main thread (see backup-copy.js).
const { workerData, parentPort } = require('worker_threads');
const { DatabaseSync } = require('node:sqlite');
const { copyInto } = require('./backup-copy');
try {
  const db = new DatabaseSync(workerData.file);
  db.exec('PRAGMA busy_timeout = 15000');
  try { copyInto(db, workerData.out); } finally { db.close(); }
  parentPort.postMessage({ ok: true });
} catch (e) { parentPort.postMessage({ error: e.message }); }
