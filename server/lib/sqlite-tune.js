'use strict';
// One setup for every connection to cadence.db (2026-11-17, "anything else to support the database?"):
//   busy_timeout   wait for another connection's write instead of failing
//   synchronous    NORMAL: safe with WAL (a power cut can lose the last moment, never corrupt), far fewer disk syncs
//   cache_size     pages kept in memory per connection (negative = KB)
//   mmap_size      read through the OS file cache instead of copying pages (big win on a NAS disk)
//   temp_store     sorts and temporary indexes in memory
//   optimize       refresh the planner's statistics where they're stale, sampling only (analysis_limit), so it
//                  keeps choosing the right index as tables grow; cheap, and again hourly from storage upkeep
function tune(db, { cacheMB = 16, mmapMB = 256, busyMs = 5000 } = {}) {
  try { db.exec(`PRAGMA busy_timeout=${busyMs | 0}`); } catch {}
  for (const p of ['synchronous=NORMAL', `cache_size=${-Math.round(cacheMB * 1024)}`, `mmap_size=${Math.round(mmapMB * 1024 * 1024)}`, 'temp_store=MEMORY', 'analysis_limit=400', 'optimize=0x10002']) {
    try { db.exec(`PRAGMA ${p}`); } catch (e) { /* an older SQLite without one of these: carry on */ }
  }
  return db;
}
const optimize = db => { try { db.exec('PRAGMA analysis_limit=400; PRAGMA optimize'); } catch {} };
module.exports = { tune, optimize };
