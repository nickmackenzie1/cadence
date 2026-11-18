// Making themes yours (2026-11-18): film pictures from TMDB (through the NAS, with credit), your own background, corner
// picture and finish sound per theme, and brand themes showing the brand's own logo.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { createServer as netServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = netServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
// a 2×2 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8DwnwEJMDKgCwAAJ6kD/ap+YmUAAAAASUVORK5CYII=', 'base64');
let fake, F, PORT, B, server, dir, asked = [];
test.beforeAll(async () => {
  fake = createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); asked.push(u.pathname + u.search);
    const json = o => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/3/search/movie') return json({ results: u.searchParams.get('query') === 'Jurassic Park' ? [{ id: 329, title: 'Jurassic Park', release_date: '1993-06-11' }] : [] });
    if (u.pathname === '/3/movie/329/images') return json({ backdrops: [{ file_path: '/withWords1.jpg', iso_639_1: 'en', vote_average: 9 }, { file_path: '/plainPic01.jpg', iso_639_1: null, vote_average: 5 }, { file_path: '/plainPic02.jpg', iso_639_1: null, vote_average: 7 }], posters: [{ file_path: '/poster001.jpg', iso_639_1: 'en', vote_average: 6 }] });
    if (u.pathname.startsWith('/t/p/')) { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
    // TheGamesDB
    if (u.pathname === '/v1/Games/ByGameName') return json({ data: { games: u.searchParams.get('name').includes('Breath of the Wild')
      ? [{ id: 9999, game_title: 'The Legend of Zelda: Breath of the Wild - Expansion Pass', release_date: '2017-06-30' }, { id: 4242, game_title: 'The Legend of Zelda: Breath of the Wild', release_date: '2017-03-03' }] : [] } });
    if (u.pathname === '/v1/Games/Images') return json({ data: { base_url: {}, images: { [u.searchParams.get('games_id')]: [{ type: 'fanart', filename: 'fanart/4242-1.jpg' }, { type: 'fanart', filename: 'fanart/4242-2.jpg' }, { type: 'clearlogo', filename: 'clearlogo/4242.png' }, { type: 'screenshot', filename: 'screenshots/4242-1.jpg' }] } } });
    if (u.pathname === '/v1/Platforms/Images') return json({ data: { images: { 7: [{ type: 'fanart', filename: 'platform/fanart/7-1.jpg' }] } } });
    if (u.pathname.startsWith('/images/')) { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
    res.writeHead(404); res.end();
  });
  await new Promise(r => fake.listen(0, '127.0.0.1', r)); F = `http://127.0.0.1:${fake.address().port}`;
  dir = mkdtempSync(join(tmpdir(), 'cadence-thx-')); PORT = await freePort(); B = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TMDB_API_KEY: 'k123', TMDB_API: F, TMDB_IMG: F, THEGAMESDB_API_KEY: 'g456', GAMESDB_API: F, GAMESDB_CDN: F }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); fake && fake.close(); rmSync(dir, { recursive: true, force: true }); });

test('TMDB: a title\'s pictures, plain ones first, asked once, served through the NAS', async () => {
  const a = await (await fetch(B + '/api/tmdb/art?type=movie&q=Jurassic%20Park&year=1993')).json();
  expect(a).toMatchObject({ title: 'Jurassic Park', year: '1993', link: 'https://www.themoviedb.org/movie/329', poster: 'api/tmdb/img/w500/poster001.jpg' });
  expect(a.backdrops).toEqual(['api/tmdb/img/w1280/plainPic02.jpg', 'api/tmdb/img/w1280/plainPic01.jpg', 'api/tmdb/img/w1280/withWords1.jpg']);
  expect(asked.find(x => x.startsWith('/3/search/movie'))).toContain('api_key=k123');
  const n = asked.length; await fetch(B + '/api/tmdb/art?type=movie&q=Jurassic%20Park&year=1993'); expect(asked.length).toBe(n);   // kept
  const r = await fetch(B + '/' + a.backdrops[0]); expect(r.status).toBe(200); expect(r.headers.get('content-type')).toBe('image/png');
  expect(existsSync(join(dir, 'tmdb-img', 'w1280_plainPic02.jpg'))).toBe(true);
  expect((await fetch(B + '/api/tmdb/img/w1280/..%2Fsecret.jpg')).status).toBe(404);
  expect((await (await fetch(B + '/api/tmdb/art?type=movie&q=Nothing%20Here')).json()).none).toBe(true);
});

test('in the app: the film picture with credit, colours on request, your own pictures and a brand logo', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(B + '/#view-themes'); await expect(page.locator('#sync')).toBeVisible({ timeout: 10000 });
  await page.evaluate(() => CadenceThemes.apply('jurassic'));
  await expect(page.locator('.th-credit')).toHaveText('Picture: Jurassic Park on TMDB');
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundImage)).toContain('api/tmdb/img/w1280/plainPic02.jpg');
  // Adjust: another picture, colours from it
  await page.reload(); await expect(page.locator('#sync')).toBeVisible({ timeout: 10000 });
  await page.locator('#thg-tw').click();
  const row = page.locator('[data-tmdb-row]'); await expect(row).toContainText('not endorsed or certified by TMDB');
  await row.locator('[data-tm=next]').click();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundImage)).toContain('plainPic01.jpg');
  await page.locator('[data-tmdb-row] [data-tm=colors]').check();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--accent'))).toMatch(/^hsl\(/);
  // your own background replaces the film's; the file is kept on the NAS
  await page.locator('input[data-mine=bg]').setInputFiles({ name: 'mine.png', mimeType: 'image/png', buffer: PNG });
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundImage)).toContain('api/theme-media/');
  await expect(page.locator('.th-credit')).toHaveCount(0);
  expect(readdirSync(join(dir, 'theme-media')).length).toBe(1);
  // a corner picture
  await page.locator('input[data-mine=corner]').setInputFiles({ name: 'c.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('img.th-corner')).toHaveCount(1);
  // other themes are untouched; a brand theme shows its site's logo, and stops when you leave it
  await page.evaluate(() => CadenceThemes.apply('github'));
  await expect(page.locator('img.th-corner')).toHaveCount(0);
  // (the test server can't reach the internet, so the logo image itself may fail and be dropped; what matters is that
  // the brand logo was put in place, asking for github.com's)
  await expect(page.locator('#side-head .brand .logo.th-brand')).toHaveCount(1);
  expect(await page.evaluate(() => { const l = document.querySelector('#side-head .brand .logo.th-brand'); return l.dataset.site || l.innerHTML; })).toMatch(/github\.com/);
  await page.evaluate(() => CadenceThemes.apply('calm'));
  await expect(page.locator('#side-head .brand .logo.th-brand')).toHaveCount(0);
  expect(errs).toEqual([]);
});

test('TheGamesDB: a game\'s fanart and title logo (the game itself, not an add-on), a console\'s pictures, through the NAS', async ({ page }) => {
  const a = await (await fetch(B + '/api/gdb/art?kind=game&q=' + encodeURIComponent('The Legend of Zelda: Breath of the Wild'))).json();
  expect(a).toMatchObject({ title: 'The Legend of Zelda: Breath of the Wild', link: 'https://thegamesdb.net/game.php?id=4242', logo: 'api/gdb/img/original/clearlogo/4242.png', source: 'TheGamesDB' });
  expect(a.backdrops).toEqual(['api/gdb/img/original/fanart/4242-1.jpg', 'api/gdb/img/original/fanart/4242-2.jpg']);
  expect(asked.find(x => x.startsWith('/v1/Games/ByGameName'))).toContain('apikey=g456');
  const n = asked.length; await fetch(B + '/api/gdb/art?kind=game&q=' + encodeURIComponent('The Legend of Zelda: Breath of the Wild')); expect(asked.length).toBe(n);   // kept a month
  expect((await fetch(B + '/' + a.logo)).status).toBe(200);
  expect(existsSync(join(dir, 'gamesdb-img', 'original_clearlogo_4242.png'))).toBe(true);
  expect((await fetch(B + '/api/gdb/img/original/..%2F..%2Fetc%2Fpasswd')).status).toBe(404);
  const nes = await (await fetch(B + '/api/gdb/art?kind=platform&q=7&platform=7')).json();
  expect(nes.backdrops).toEqual(['api/gdb/img/original/platform/fanart/7-1.jpg']);
  // in the app: Breath of the Wild gets the fanart, the title logo and the credit
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(B + '/#today'); await expect(page.locator('#sync')).toBeVisible({ timeout: 10000 });
  await page.evaluate(() => CadenceThemes.apply('botw'));
  await expect(page.locator('.th-credit')).toHaveText('Picture: The Legend of Zelda: Breath of the Wild on TheGamesDB');
  await expect(page.locator('img.th-gamelogo')).toHaveAttribute('src', 'api/gdb/img/original/clearlogo/4242.png');
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundImage)).toContain('fanart/4242-1.jpg');
  await page.evaluate(() => CadenceThemes.apply('calm'));
  await expect(page.locator('img.th-gamelogo, .th-credit')).toHaveCount(0);
  expect(errs).toEqual([]);
});
