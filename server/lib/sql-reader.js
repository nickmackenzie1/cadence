'use strict';
// A reader thread for big reports (2026-11-17): its own read-only connection to cadence.db, so a query that groups
// millions of KEXP plays runs here while the app keeps answering. Messages: { id, sql, params } → { id, rows | error }.
const { workerData, parentPort } = require('worker_threads');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(workerData.file, { readOnly: true });
require('./sqlite-tune').tune(db, { cacheMB: 48, mmapMB: 512, busyMs: 10000 });
const stmts = new Map();
parentPort.on('message', ({ id, sql, params }) => {
  try {
    let st = stmts.get(sql); if (!st) { st = db.prepare(sql); if (stmts.size > 100) stmts.clear(); stmts.set(sql, st); }
    parentPort.postMessage({ id, rows: st.all(...(params || [])) });
  } catch (e) { parentPort.postMessage({ id, error: e.message }); }
});
