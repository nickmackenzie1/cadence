// Lyrics from LRCLIB (2026-11-19): looked up through the NAS and kept; synced lines light up in time.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { createServer as netServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = netServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
// made-up words for made-up songs
const SYNCED = '[00:00.50] First made-up line\n[00:02.00] Second made-up line\n[00:04.00] Third made-up line\n[00:30.00] Much later line';
let fake, F, B, server, dir, asked = [];
test.beforeAll(async () => {
  fake = createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); asked.push({ path: u.pathname, q: Object.fromEntries(u.searchParams), ua: req.headers['user-agent'] });
    const json = (o, st = 200) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    const t = (u.searchParams.get('track_name') || '').toLowerCase();
    if (u.pathname === '/api/get') return t === 'test song' ? json({ id: 7, trackName: 'Test Song', artistName: 'Test Band', albumName: 'LP', duration: 200, instrumental: false, plainLyrics: 'First made-up line\nSecond made-up line', syncedLyrics: SYNCED })
      : json({ message: 'Failed to find specified track', name: 'TrackNotFound', statusCode: 404 }, 404);
    if (u.pathname === '/api/search') return json(t === 'other song' ? [{ id: 9, trackName: 'Other Song (Remastered)', artistName: 'Test Band', albumName: 'X', duration: 180, instrumental: false, plainLyrics: 'Plain made-up words', syncedLyrics: null }] : []);
    res.writeHead(404); res.end();
  });
  await new Promise(r => fake.listen(0, '127.0.0.1', r)); F = `http://127.0.0.1:${fake.address().port}`;
  dir = mkdtempSync(join(tmpdir(), 'cadence-ly-')); const PORT = await freePort(); B = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x'), LRCLIB_API: F }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); fake && fake.close(); rmSync(dir, { recursive: true, force: true }); });

test('the NAS finds lyrics (exact, then by search), names the app, and keeps what it found', async () => {
  const a = await (await fetch(`${B}/api/lyrics?artist=Test%20Band&track=Test%20Song`)).json();
  expect(a).toMatchObject({ found: true, id: 7, source: 'LRCLIB' });
  expect(a.synced[1]).toEqual([2000, 'Second made-up line']);
  const b = await (await fetch(`${B}/api/lyrics?artist=Test%20Band&track=Other%20Song`)).json();
  expect(b).toMatchObject({ found: true, id: 9, plain: 'Plain made-up words', synced: null });
  const c = await (await fetch(`${B}/api/lyrics?artist=Nobody&track=Nothing`)).json();
  expect(c).toEqual({ found: false });
  expect(asked[0].ua).toMatch(/^THING\//);
  const n = asked.length;
  await fetch(`${B}/api/lyrics?artist=Test%20Band&track=Test%20Song`); await fetch(`${B}/api/lyrics?artist=Nobody&track=Nothing`);
  expect(asked.length).toBe(n);                                       // both answered from the NAS's copy
  expect((await fetch(`${B}/api/lyrics?artist=Test%20Band`)).status).toBe(400);
  await expect.poll(() => existsSync(join(dir, 'lyrics-cache.json'))).toBe(true);
  expect(Object.keys(JSON.parse(readFileSync(join(dir, 'lyrics-cache.json'), 'utf8'))).length).toBe(3);
});

test('the panel: lines light up in time, words to read for a listed song, and it closes', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(B + '/#today');
  await expect(page.locator('#qa')).toBeVisible({ timeout: 15000 });
  // as if live: the song started 2.5 s ago (and no stream delay for this one)
  await page.evaluate(() => { localStorage.setItem('cadence.ly.delay', JSON.stringify({ manual: 0 })); window.CadenceLyrics.open('Test Band', 'Test Song', '', Date.now() - 2500); });
  await expect(page.locator('#ly-panel .ly-l li.on')).toHaveText('Second made-up line', { timeout: 5000 });
  await expect(page.locator('#ly-panel .ly-l li.on')).toHaveText('Third made-up line', { timeout: 5000 });
  await expect(page.locator('#ly-panel')).toContainText('LRCLIB');
  // full screen, and Esc comes back
  await page.click('#ly-panel [data-ly-big]');
  await expect(page.locator('#ly-panel')).toHaveClass(/ly-big/);
  expect(await page.evaluate(() => { const r = document.getElementById('ly-panel').getBoundingClientRect(); return r.width >= innerWidth - 1 && r.height >= innerHeight - 1; })).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#ly-panel')).not.toHaveClass(/ly-big/);
  // a song's lyrics button (as on artist pages)
  await page.evaluate(() => { const d = document.createElement('div'); d.id = 'ly-t'; d.innerHTML = window.CadenceLyrics.button('Test Band', 'Other Song'); document.body.append(d); });
  await page.click('#ly-t [data-ly]');
  await expect(page.locator('#ly-panel .ly-plain')).toContainText('Plain made-up words');
  await page.click('#ly-panel [data-ly-close]');
  await expect(page.locator('#ly-panel')).toHaveCount(0);
  expect(errs).toEqual([]);
});
