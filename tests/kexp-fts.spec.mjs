// KEXP history's search index (FTS5): built in steps, then search finds word starts across artist, song and album;
// plays saved or removed afterwards are kept in step by triggers. Before it's built, search still works (full scan).
import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('the KEXP search index builds in steps, finds word starts, and stays in step with new and removed plays', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cadence-fts-'));
  try {
    const out = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '-e', `
      (async () => {
        const K = require('./server/services/kexp-log.js'), d = K.open();
        const ins = d.prepare('INSERT INTO kexp_plays VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'), mk = (id, artist, song, album) => K.row({ id, play_type: 'trackplay', airdate: new Date(Date.UTC(2020, 0, 1) + id * 6e4).toISOString(), artist, song, album });
        for (let i = 1; i <= 2500; i++) ins.run(...mk(i, 'Filler ' + (i % 50), 'Song ' + i, 'Record ' + (i % 30)));
        ins.run(...mk(3000, 'Big Thief', 'Not', 'Two Hands')); ins.run(...mk(3001, 'Björk', 'Jóga', 'Homogenic'));
        const before = (await K.search({ q: 'big thief' })).map(r => r.artist);            // not built yet: the full scan
        let steps = 0, r; do { r = K.ftsStep(); steps++; } while (!r.done && steps < 50);
        const after = { ready: K.ftsReady(), steps,
          prefix: (await K.search({ q: 'big thi' })).map(r => r.artist),
          album: (await K.search({ q: 'two hands', group: 'song' })).map(r => r.song),
          accents: (await K.search({ q: 'bjork' })).map(r => r.artist) };
        // after it's built: a new play is found straight away, a removed one is gone
        K._save([{ id: 5000, play_type: 'trackplay', airdate: new Date().toISOString(), artist: 'Alvvays', song: 'Belinda Says', album: 'Blue Rev' }]);
        const added = (await K.search({ q: 'belinda' })).map(r => r.artist);
        d.prepare('DELETE FROM kexp_plays WHERE id = 3000').run();
        const removed = (await K.search({ q: 'big thief' })).length;
        console.log(JSON.stringify({ before, after, added, removed }));
        process.exit(0);
      })().catch(e => { console.error(e); process.exit(1); });
    `], { env: { ...process.env, DATA_DIR: dir, KEXP_LOG: '1', KEXP_LOG_DELAY: '99999999', KEXP_FTS_CHUNK: '1000', KEXP_API: 'http://127.0.0.1:9' }, encoding: 'utf8' });
    expect(out.status, out.stderr).toBe(0);
    const r = JSON.parse(out.stdout.trim().split('\n').pop());
    expect(r.before).toEqual(['Big Thief']);
    expect(r.after.ready).toBe(true);
    expect(r.after.steps).toBe(3);                 // 2,502 plays, 1,000 at a time
    expect(r.after.prefix).toEqual(['Big Thief']);
    expect(r.after.album).toEqual(['Not']);
    expect(r.after.accents).toEqual(['Björk']);
    expect(r.added).toEqual(['Alvvays']);
    expect(r.removed).toBe(0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
