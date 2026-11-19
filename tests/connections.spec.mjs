// Settings → Connections (user, 2026-11-18: "is there a better way to input the api keys instead of through the env?"),
// and credited free-licence photos from Wikimedia Commons for themes (against a fake Commons here).
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { createServer as netServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, statSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = netServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
// a 1×1 JPEG
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z', 'base64');
let fake, F, B, server, dir, asked = [];
test.beforeAll(async () => {
  fake = createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); asked.push(req.method + ' ' + u.pathname + ' ' + (u.searchParams.get('gsrsearch') || '') + ' ' + (req.headers['user-agent'] || ''));
    if (u.pathname === '/w/api.php') {
      const page = (i, lic, w, h, artist) => ({ pageid: i, index: i, title: `File:Photo ${i}.jpg`, imageinfo: [{ thumburl: `${F}/img/${i}.jpg`, url: `${F}/img/${i}.jpg`, width: w, height: h,
        descriptionurl: `https://commons.wikimedia.org/wiki/File:Photo_${i}.jpg`, extmetadata: { LicenseShortName: { value: lic }, Artist: { value: artist } } }] });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ query: { pages: {
        1: page(1, 'All rights reserved', 3000, 2000, 'Nope'),                                     // not free: skipped
        2: page(2, 'CC BY-SA 4.0', 800, 600, 'Too Small'),                                         // too small: skipped
        3: page(3, 'CC BY-SA 4.0', 3000, 2000, '<a href="//commons.wikimedia.org/wiki/User:Jane">Jane Doe</a>'),
        4: page(4, 'CC0', 2400, 1600, 'Sam Roe'),
        5: page(5, 'CC BY 2.0', 1600, 2400, 'Tall One'),                                           // portrait: skipped
      } } }));
    }
    if (u.pathname.startsWith('/img/')) { res.writeHead(200, { 'Content-Type': 'image/jpeg' }); return res.end(JPG); }
    res.writeHead(404); res.end();
  });
  await new Promise(r => fake.listen(0, '127.0.0.1', r)); F = `http://127.0.0.1:${fake.address().port}`;
  dir = mkdtempSync(join(tmpdir(), 'cadence-conn-')); const PORT = await freePort(); B = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, COMMONS_API: F, LASTFM_API_KEY: 'from-env-1234', TMDB_API_KEY: '', DISCOGS_TOKEN: '' }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); fake && fake.close(); rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); });

test('keys: saved on the NAS, never sent back, .env still counts, removing brings .env back', async () => {
  const list = async () => (await (await fetch(B + '/api/keys')).json());
  let l = await list();
  expect(l.find(k => k.id === 'LASTFM_API_KEY')).toMatchObject({ set: true, from: 'env', tail: '1234' });
  expect(l.find(k => k.id === 'DISCOGS_TOKEN')).toMatchObject({ set: false, from: null });
  const put = (id, value) => fetch(B + '/api/keys', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, value }) });
  expect((await put('NOT_A_KEY', 'x')).status).toBe(400);
  expect((await put('DISCOGS_TOKEN', 'has a space')).status).toBe(400);
  l = await (await put('DISCOGS_TOKEN', '  "dgTokenSecret9876"  ')).json();
  expect(l.find(k => k.id === 'DISCOGS_TOKEN')).toMatchObject({ set: true, from: 'page', tail: '9876' });
  expect(JSON.stringify(l)).not.toContain('dgTokenSecret');   // only the last four
  const f = join(dir, 'keys.json');
  expect(JSON.parse(readFileSync(f, 'utf8')).DISCOGS_TOKEN).toBe('dgTokenSecret9876');
  expect(statSync(f).mode & 0o777).toBe(0o600);
  // the music side (its own process) picks it up: Discogs is no longer "off"
  await expect.poll(async () => (await (await fetch(B + '/api/radar/discogs')).json()).off === undefined, { timeout: 8000 }).toBe(true);
  // a pasted key wins over .env; removing it brings the .env one back
  await put('LASTFM_API_KEY', 'pastedLastfm5555');
  expect((await list()).find(k => k.id === 'LASTFM_API_KEY')).toMatchObject({ from: 'page', tail: '5555' });
  await put('LASTFM_API_KEY', '');
  expect((await list()).find(k => k.id === 'LASTFM_API_KEY')).toMatchObject({ from: 'env', tail: '1234' });
  await put('DISCOGS_TOKEN', '');
  await expect.poll(async () => (await (await fetch(B + '/api/radar/discogs')).json()).off, { timeout: 8000 }).toBe(true);
});

test('Settings → Connections in the app', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(B + '/'); await expect(page.locator('#sync')).toBeVisible({ timeout: 10000 });
  await page.evaluate(() => document.querySelector('[data-act=settings]').click());
  await page.locator('.modal [data-settings-tab=connections], .modal button', { hasText: 'Connections' }).first().click();
  const row = page.locator('.conn[data-k=TMDB_API_KEY]');
  await expect(row).toContainText('Not connected');
  await row.locator('input').fill('tmdbKeyAbcd4321'); await row.locator('[data-conn=save]').click();
  await expect(page.locator('.conn[data-k=TMDB_API_KEY]')).toContainText('Connected · ends in 4321');
  await expect(page.locator('.conn[data-k=TMDB_API_KEY] input')).toHaveValue('');
  await expect(page.locator('.conn[data-k=LASTFM_API_KEY]')).toContainText('from .env');
  await page.locator('.conn[data-k=TMDB_API_KEY] [data-conn=remove]').click();
  await expect(page.locator('.conn[data-k=TMDB_API_KEY]')).toContainText('Not connected');
  expect(errs).toEqual([]);
});

test('Commons photos: free licences only, wide ones, credited, through the NAS, asked once', async ({ page }) => {
  const j = await (await fetch(B + '/api/commons?q=snowy%20forest%20Ontario')).json();
  expect(j.photos.map(p => p.credit)).toEqual(['Jane Doe, CC BY-SA 4.0, via Wikimedia Commons', 'Sam Roe, CC0, via Wikimedia Commons']);
  expect(j.photos[0].link).toBe('https://commons.wikimedia.org/wiki/File:Photo_3.jpg');
  expect(asked.some(a => a.includes('incategory:Quality_images') && a.includes('Cadence/1'))).toBe(true);
  const img = await fetch(B + '/' + j.photos[0].url); expect(img.status).toBe(200); expect(img.headers.get('content-type')).toBe('image/jpeg');
  expect((await fetch(B + '/api/commons/img/0123456789abcdef0123.jpg')).status).toBe(404);   // only ones it handed out
  const before = asked.filter(a => a.includes('/w/api.php')).length;
  await fetch(B + '/api/commons?q=snowy%20forest%20Ontario');
  expect(asked.filter(a => a.includes('/w/api.php')).length).toBe(before);   // kept, not asked again
  // a theme with a Commons subject: the photo goes behind the app with its credit on screen
  await page.goto(B + '/'); await expect(page.locator('#sync')).toBeVisible({ timeout: 10000 });
  await page.evaluate(() => window.CadenceThemes.apply('winter'));
  await expect(page.locator('.th-credit')).toHaveText('Photo: Jane Doe, CC BY-SA 4.0, via Wikimedia Commons', { timeout: 8000 });
  await expect(page.locator('.th-credit')).toHaveAttribute('href', 'https://commons.wikimedia.org/wiki/File:Photo_3.jpg');
});
