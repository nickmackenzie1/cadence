// KEXP history moves out of cadence.db into its own kexp.db (0.29.0): every play, show, setting and the artist
// summary arrive; cadence.db keeps everything else and loses its kexp_* tables; a second start does nothing.
import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, renameSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = (dir, code) => spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '-e', code], {
  env: { ...process.env, DATA_DIR: dir, KEXP_LOG: '1', KEXP_LOG_DELAY: '99999999', KEXP_ARTISTS_DELAY: '99999999', KEXP_MOVE_BATCH: '500', KEXP_API: 'http://127.0.0.1:9' },
  encoding: 'utf8' });

test('KEXP history moves from cadence.db to kexp.db in the background, and the old copy goes in the nightly cleanup', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cadence-kexpmove-'));
  try {
    // an install from before 0.29.0: KEXP history in cadence.db, next to the app's own tables
    let out = run(dir, `
      const K = require('./server/services/kexp-log.js'), d = K.open();
      const ins = d.prepare('INSERT INTO kexp_plays VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
      for (let i = 1; i <= 2600; i++) ins.run(...K.row({ id: i * 3, play_type: 'trackplay', airdate: new Date(Date.UTC(2015, 0, 1) + i * 36e5).toISOString(), artist: 'Artist ' + (i % 41), song: 's' + i, rotation: i % 97 ? null : 'Heavy', show: i % 5 }));
      d.prepare('INSERT INTO kexp_shows VALUES (?,?,?,?,?,?,?)').run(1, 'The Morning Show', 'Eclectic', 'John Richards', 0, null, null);
      d.prepare("INSERT OR REPLACE INTO kexp_meta (k, v) VALUES ('backfill_floor', '1'), ('artists_cursor', '0')").run();
      for (let i = 0; i < 40; i++) K.buildArtistsStep();
      d.exec("CREATE TABLE keepme (id TEXT PRIMARY KEY, data TEXT); INSERT INTO keepme VALUES ('t1', 'my task')");
      d.exec('PRAGMA wal_checkpoint(TRUNCATE)'); d.close();
    `);
    expect(out.status, out.stderr).toBe(0);
    renameSync(join(dir, 'kexp.db'), join(dir, 'cadence.db'));
    for (const x of ['-wal', '-shm']) if (existsSync(join(dir, 'kexp.db' + x))) rmSync(join(dir, 'kexp.db' + x));

    // the new version starts: open() takes the small tables, moveOld() the plays
    out = run(dir, `
      (async () => {
        const { DatabaseSync } = require('node:sqlite'), old = new DatabaseSync(require('path').join(process.env.DATA_DIR, 'cadence.db'));
        const before = { plays: old.prepare('SELECT COUNT(*) n FROM kexp_plays').get().n, sum: old.prepare('SELECT SUM(plays) n FROM kexp_artists').get().n,
          heavy: old.prepare("SELECT first_heavy t FROM kexp_artists WHERE key = 'artist 1'").get().t };
        const K = require('./server/services/kexp-log.js'), d = K.open();
        const t0 = Date.now(); let ticks = 0; const iv = setInterval(() => ticks++, 20);   // the main thread stays free while it moves
        await K.moveOld(); clearInterval(iv);
        const early = d.prepare("SELECT v FROM kexp_meta WHERE k = 'backfill_floor'").get();
        const after = { plays: d.prepare('SELECT COUNT(*) n FROM kexp_plays').get().n, sum: d.prepare('SELECT SUM(plays) n FROM kexp_artists').get().n,
          heavy: K.heavyFirst('Artist 1'), shows: d.prepare('SELECT COUNT(*) n FROM kexp_shows').get().n, done: !!d.prepare("SELECT v FROM kexp_meta WHERE k = 'moved_done'").get() };
        const left = old.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'kexp%'").all().map(r => r.name);
        const task = old.prepare("SELECT data FROM keepme WHERE id = 't1'").get().data;
        const status = await K.status();
        const marker = require('fs').existsSync(require('path').join(process.env.DATA_DIR, 'kexp-moved'));
        console.log(JSON.stringify({ before, after, early: early && early.v, left, task, file: status.file, moving: status.moving, marker, ticks, ms: Date.now() - t0 }));
      })().catch(e => { console.error(e); process.exit(1); });
    `);
    expect(out.status, out.stderr).toBe(0);
    const r = JSON.parse(out.stdout.trim().split('\n').pop());
    expect(r.before.plays).toBe(2600);
    expect(r.after.plays).toBe(2600);              // every play arrived, none twice
    expect(r.after.sum).toBe(r.before.sum);        // the artist summary came over as it was
    expect(r.after.heavy).toBe(r.before.heavy);
    expect(r.after.shows).toBe(1);
    expect(r.after.done).toBe(true);
    expect(r.early).toBe('1');
    expect(r.left).toContain('kexp_plays');        // cadence.db is only read during the move: its copy goes on a quiet night
    expect(r.marker).toBe(true);
    expect(r.ticks).toBeGreaterThan(r.ms / 20 / 3); // the main thread kept running while it moved
    expect(r.task).toBe('my task');                // and everything else is untouched
    expect(r.file).toBe('kexp.db');
    expect(r.moving).toBe(null);

    // the nightly cleanup (forced here) drops the old KEXP tables from cadence.db and compacts it; tasks stay
    out = run(dir, `
      const S = require('./server/lib/storage.js'), fs = require('fs'), path = require('path');
      S.reclaim(true);
      const f = path.join(process.env.DATA_DIR, 'cadence.db'), { DatabaseSync } = require('node:sqlite');
      const wait = () => setTimeout(() => {
        const o = new DatabaseSync(f, { readOnly: true }), left = o.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'kexp%'").all().map(r => r.name), task = o.prepare("SELECT data FROM keepme WHERE id = 't1'").get(); o.close();
        if (left.length) return wait();
        console.log(JSON.stringify({ left, task: task && task.data, marker: fs.existsSync(path.join(process.env.DATA_DIR, 'kexp-moved')) })); process.exit(0);
      }, 100);
      wait(); setTimeout(() => { console.log(JSON.stringify({ timeout: true })); process.exit(0); }, 15000);
    `);
    expect(out.status, out.stderr).toBe(0);
    const n = JSON.parse(out.stdout.trim().split('\n').pop());
    expect(n.left).toEqual([]); expect(n.task).toBe('my task'); await expect.poll(() => existsSync(join(dir, 'kexp-moved'))).toBe(false);

    // starting again: nothing to move, the history is still there
    out = run(dir, `
      (async () => { const K = require('./server/services/kexp-log.js'), d = K.open(); await K.moveOld();
        console.log(JSON.stringify({ plays: d.prepare('SELECT COUNT(*) n FROM kexp_plays').get().n })); })();
    `);
    expect(out.status, out.stderr).toBe(0);
    expect(JSON.parse(out.stdout.trim().split('\n').pop()).plays).toBe(2600);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a move stopped part-way carries on where it left off', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cadence-kexpmove2-'));
  try {
    let out = run(dir, `
      const K = require('./server/services/kexp-log.js'), d = K.open();
      const ins = d.prepare('INSERT INTO kexp_plays VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
      for (let i = 1; i <= 1200; i++) ins.run(...K.row({ id: i, play_type: 'trackplay', airdate: new Date(Date.UTC(2016, 0, 1) + i * 36e5).toISOString(), artist: 'A' + (i % 7), song: 's' + i }));
      d.exec('PRAGMA wal_checkpoint(TRUNCATE)'); d.close();
    `);
    expect(out.status, out.stderr).toBe(0);
    renameSync(join(dir, 'kexp.db'), join(dir, 'cadence.db'));
    for (const x of ['-wal', '-shm']) if (existsSync(join(dir, 'kexp.db' + x))) rmSync(join(dir, 'kexp.db' + x));
    // first start: one batch is copied, then the process stops before deleting it from cadence.db
    out = run(dir, `
      const K = require('./server/services/kexp-log.js'), d = K.open();
      d.exec("ATTACH DATABASE '" + require('path').join(process.env.DATA_DIR, 'cadence.db') + "' AS old");
      d.exec('INSERT INTO main.kexp_plays SELECT * FROM old.kexp_plays WHERE id > 700');   // as if an earlier start had copied the newest ones
      process.exit(0);
    `);
    expect(out.status, out.stderr).toBe(0);
    out = run(dir, `
      (async () => { const K = require('./server/services/kexp-log.js'), d = K.open(); await K.moveOld();
        console.log(JSON.stringify({ plays: d.prepare('SELECT COUNT(*) n FROM kexp_plays').get().n, distinct: d.prepare('SELECT COUNT(DISTINCT id) n FROM kexp_plays').get().n })); })();
    `);
    expect(out.status, out.stderr).toBe(0);
    const r = JSON.parse(out.stdout.trim().split('\n').pop());
    expect(r.plays).toBe(1200);
    expect(r.distinct).toBe(1200);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('cadence.db gives empty space back to the disk (the nightly reclaim, forced here)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cadence-reclaim-'));
  try {
    const out = run(dir, `
      const fs = require('fs'), S = require('./server/lib/storage.js'), { DatabaseSync } = require('node:sqlite');
      const f = require('path').join(process.env.DATA_DIR, 'cadence.db'), d = new DatabaseSync(f);
      d.exec('CREATE TABLE junk (x TEXT)'); const ins = d.prepare('INSERT INTO junk VALUES (?)'); const big = 'x'.repeat(4000);
      d.exec('BEGIN'); for (let i = 0; i < 3000; i++) ins.run(big); d.exec('COMMIT'); d.exec('DROP TABLE junk; PRAGMA wal_checkpoint(TRUNCATE)'); d.close();
      const before = fs.statSync(f).size, free = S.freeSpace().free;
      const started = S.reclaim(true);
      const wait = () => setTimeout(() => { const after = fs.statSync(f).size; if (after < before) { console.log(JSON.stringify({ before, after, free, started })); process.exit(0); } wait(); }, 100);
      wait(); setTimeout(() => { console.log(JSON.stringify({ before, after: fs.statSync(f).size, free, started })); process.exit(0); }, 15000);
    `);
    expect(out.status, out.stderr).toBe(0);
    const r = JSON.parse(out.stdout.trim().split('\n').pop());
    expect(r.started).toBe(true);
    expect(r.free).toBeGreaterThan(8 * 1048576);
    expect(r.after).toBeLessThan(r.before / 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
