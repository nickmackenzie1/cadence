'use strict';
/* Moves KEXP history from cadence.db into kexp.db, in its own thread (kexp-log.js moveOld() starts it). It only reads
   cadence.db, so it never holds the lock your tasks need, and it never blocks the music side's main thread (2026-11-17:
   the first version did both, and on the NAS one step took 94 s). Plays are copied newest first, BATCH at a time, with
   a rest twice as long as each step took; kexp_meta move_cursor (the lowest id copied so far) means a restart carries
   on where it stopped. When it's done it writes the data/kexp-moved marker: storage.js drops the old tables from
   cadence.db and compacts it on a quiet night. Messages to the parent: { total }, { moved }, { slow: ms }, { done },
   { error }. */
const { workerData: W, parentPort } = require('worker_threads');
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const d = new DatabaseSync(W.file);
  d.exec('PRAGMA busy_timeout = 30000; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL');
  d.exec(`ATTACH DATABASE '${W.old.replace(/'/g, "''")}' AS old`);
  const meta = (k, v) => v === undefined ? (d.prepare('SELECT v FROM main.kexp_meta WHERE k = ?').get(k) || {}).v : d.prepare('INSERT OR REPLACE INTO main.kexp_meta (k, v) VALUES (?, ?)').run(k, String(v));
  const has = t => !!d.prepare("SELECT 1 FROM old.sqlite_master WHERE type = 'table' AND name = ?").get(t);
  const cols = (schema, t) => d.prepare(`PRAGMA ${schema}.table_info(${t})`).all().map(c => c.name);
  const common = t => { const mine = new Set(cols('main', t)); return cols('old', t).filter(x => mine.has(x)).join(', '); };

  // settings, shows and the artist summary: small, copied once
  if (!meta('moved_start')) {
    d.exec('BEGIN');
    try {
      for (const t of ['kexp_meta', 'kexp_shows', 'kexp_artists']) if (has(t)) { const c = common(t); d.exec(`INSERT OR ${t === 'kexp_meta' ? 'REPLACE' : 'IGNORE'} INTO main.${t} (${c}) SELECT ${c} FROM old.${t}`); }
      meta('moved_start', Date.now());
      d.exec('COMMIT');
    } catch (e) { try { d.exec('ROLLBACK'); } catch {} throw e; }
  }

  if (has('kexp_plays')) {
    const c = common('kexp_plays');
    // where it got to: its own place, else below the oldest play already here (an earlier version moved newest first too)
    let cursor = +meta('move_cursor') || (d.prepare('SELECT MIN(id) AS m FROM main.kexp_plays').get().m ?? Number.MAX_SAFE_INTEGER);
    let moved = d.prepare('SELECT COUNT(*) AS n FROM main.kexp_plays').get().n;
    parentPort.postMessage({ moved });
    // how many are left (reads the whole index once: fine here, off the main thread)
    parentPort.postMessage({ total: moved + d.prepare('SELECT COUNT(*) AS n FROM old.kexp_plays WHERE id < ?').get(cursor).n });
    const pick = d.prepare('SELECT MIN(id) AS lo, COUNT(*) AS n FROM (SELECT id FROM old.kexp_plays WHERE id < ? ORDER BY id DESC LIMIT ?)');
    const copy = d.prepare(`INSERT OR IGNORE INTO main.kexp_plays (${c}) SELECT ${c} FROM old.kexp_plays WHERE id >= ? AND id < ?`);
    let batch = Math.max(200, W.batch || 2000);
    for (;;) {
      const t0 = Date.now(), b = pick.get(cursor, batch);
      if (!b || !b.n) break;
      d.exec('BEGIN');
      try { copy.run(b.lo, cursor); meta('move_cursor', b.lo); d.exec('COMMIT'); } catch (e) { try { d.exec('ROLLBACK'); } catch {} throw e; }
      cursor = b.lo; moved += b.n;
      const took = Date.now() - t0;
      parentPort.postMessage({ moved, ...(took > 1500 ? { slow: took } : {}) });
      // a slow disk gets smaller steps and longer rests
      if (took > 3000) batch = Math.max(200, Math.round(batch / 2)); else if (took < 500 && batch < (W.batch || 2000)) batch *= 2;
      await sleep(Math.max(50, took * 2));
    }
  }
  meta('moved_done', Date.now());
  d.exec('DETACH DATABASE old');
  d.close();
  try { fs.writeFileSync(W.marker, String(Date.now())); } catch {}
  parentPort.postMessage({ done: true });
})().catch(e => parentPort.postMessage({ error: e.message }));
