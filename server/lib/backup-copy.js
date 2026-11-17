'use strict';
// The daily database backup's copy (see storage.js): every table, index, trigger and view except what downloads or
// rebuilds by itself. Runs in a worker thread with its own connection (backup-worker.js), so a big copy never stops
// the app from answering (2026-11-17).
const fs = require('fs');
const BACKUP_SKIP = /^(kexp_|radar_artist_pages$)/;
function copyInto(db, f) {
  const tmp = f + '.tmp'; try { fs.unlinkSync(tmp); } catch {}
  const q = s => "'" + String(s).replace(/'/g, "''") + "'", id = s => '"' + String(s).replace(/"/g, '""') + '"';
  // CREATE TABLE x / CREATE INDEX x ON … → CREATE TABLE bk.x (indexes, triggers and views keep their unqualified table)
  const into = sql => sql.replace(/^(\s*CREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX|TRIGGER|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?)/i, '$1bk.');
  db.exec(`ATTACH ${q(tmp)} AS bk`);
  try {
    db.exec('BEGIN');
    try {
      const objs = db.prepare("SELECT type, name, tbl_name, sql FROM main.sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\'").all();
      for (const o of objs.filter(o => o.type === 'table' && !BACKUP_SKIP.test(o.name))) {
        if (/^\s*CREATE\s+VIRTUAL/i.test(o.sql)) { console.warn('backup: skipped virtual table', o.name); continue; }
        db.exec(into(o.sql)); db.exec(`INSERT INTO bk.${id(o.name)} SELECT * FROM main.${id(o.name)}`);
      }
      for (const o of objs.filter(o => o.type !== 'table' && !BACKUP_SKIP.test(o.tbl_name) && !BACKUP_SKIP.test(o.name))) db.exec(into(o.sql));
      db.exec('COMMIT');
    } catch (e) { try { db.exec('ROLLBACK'); } catch {} throw e; }
  } finally { db.exec('DETACH bk'); }
  fs.renameSync(tmp, f);
}
module.exports = { copyInto, BACKUP_SKIP };
