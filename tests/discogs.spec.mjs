// Your Discogs records in Music Radar (2026-11-18), against a fake Discogs: the collection and wantlist copied page by
// page, "In your records" marks, an artist's records, the Your records card, For you learning from what you own, and
// adding to your Discogs wantlist from Want to hear.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { createServer as netServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = netServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const rel = (id, artist, title, year, added) => ({ id, date_added: added, basic_information: { id, master_id: id + 1000, title, year, artists: [{ name: artist }], formats: [{ name: 'Vinyl' }], labels: [{ name: 'Domino' }], thumb: '', cover_image: '', genres: ['Rock'], styles: ['Indie Rock'] } });
// 150 records over two pages; Wet Leg's first album is the newest
const COLLECTION = [rel(1, 'Wet Leg', 'Wet Leg', 2022, '2026-11-10T10:00:00Z'), rel(2, 'Wet Leg', 'Moisturizer (Deluxe Edition)', 2025, '2026-11-01T10:00:00Z'),
  ...Array.from({ length: 148 }, (_, i) => rel(100 + i, 'Band ' + i, 'Album ' + i, 2000 + (i % 20), '2025-01-01T00:00:00Z'))];
let fake, F, PORT, B, server, dir, asked = [], WANTS = [rel(50, 'Big Thief', 'Dragon New Mountain I Believe in You', 2022, '2026-10-01T00:00:00Z')];
test.beforeAll(async () => {
  fake = createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); asked.push(req.method + ' ' + u.pathname + u.search + ' ' + (req.headers.authorization || ''));
    const json = (o, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/oauth/identity') return json({ id: 7, username: 'nickm' });
    if (u.pathname === '/users/nickm/collection/folders/0/releases') { const p = +u.searchParams.get('page'), n = +u.searchParams.get('per_page');
      return json({ pagination: { page: p, pages: Math.ceil(COLLECTION.length / n) }, releases: COLLECTION.slice((p - 1) * n, p * n) }); }
    if (u.pathname === '/users/nickm/wants') return json({ pagination: { page: 1, pages: 1 }, wants: WANTS.map(w => ({ ...w, basic_information: w.basic_information })) });
    if (u.pathname === '/database/search') return json({ results: /Ripped and Torn/i.test(u.searchParams.get('release_title') || '') && u.searchParams.get('type') === 'master' ? [{ id: 900, type: 'master' }] : [] });
    if (u.pathname === '/masters/900') return json({ id: 900, main_release: 9001 });
    if (u.pathname === '/users/nickm/wants/9001' && req.method === 'PUT') { res.writeHead(201); return res.end('{}'); }
    res.writeHead(404); res.end();
  });
  await new Promise(r => fake.listen(0, '127.0.0.1', r)); F = `http://127.0.0.1:${fake.address().port}`;
  dir = mkdtempSync(join(tmpdir(), 'cadence-dg-')); PORT = await freePort(); B = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, DISCOGS_TOKEN: 'tok-abc123', DISCOGS_API: F }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); fake && fake.close(); rmSync(dir, { recursive: true, force: true }); });

test('copying your collection and wantlist, then what Radar knows from it', async () => {
  test.setTimeout(60000);
  expect((await (await fetch(B + '/api/radar/discogs')).json()).pending).toBe(true);
  const s = await (await fetch(B + '/api/radar/discogs/sync', { method: 'POST' })).json();
  expect(s).toMatchObject({ user: 'nickm', records: 150, wants: 1 });
  expect(asked.filter(x => x.includes('/collection/')).length).toBe(2);                     // two pages of 100
  expect(asked.every(x => x.endsWith('Discogs token=tok-abc123'))).toBe(true);
  const sum = await (await fetch(B + '/api/radar/discogs?artist=Wet%20Leg')).json();
  expect(sum).toMatchObject({ on: true, records: 150, wants: 1 });
  expect(sum.recent[0].title).toBe('Wet Leg');
  expect(sum.own.map(r => r.title)).toEqual(['Wet Leg', 'Moisturizer (Deluxe Edition)']);
  expect(sum.shelf && sum.shelf.rid).toBeTruthy();
  const ix = await (await fetch(B + '/api/radar/discogs?index=1')).json();
  expect(ix.own).toContain('wet leg|moisturizer');                                         // "(Deluxe Edition)" doesn't count
  expect(ix.want).toContain('big thief|dragon new mountain i believe in you');
});

test('in the app: the marks, an artist\'s records, the card, and adding to your wantlist', async ({ page }) => {
  test.setTimeout(60000);
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await fetch(B + '/api/radar/want', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ add: { artist: 'Wet Leg', title: 'Moisturizer' } }) });
  await fetch(B + '/api/radar/want', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ add: { artist: 'Idles', title: 'Ripped and Torn' } }) });
  await page.goto(B + '/'); await expect(page.locator('#sync')).toBeVisible({ timeout: 10000 });
  await expect.poll(() => page.evaluate(() => { window.CadenceDiscogs.chip('x'); return window.CadenceDiscogs.owns('Wet Leg', 'Moisturizer'); })).toBe(true);
  expect(await page.evaluate(() => [window.CadenceDiscogs.chip('Wet Leg', 'Moisturizer'), window.CadenceDiscogs.chip('Big Thief', 'Dragon New Mountain I Believe In You'), window.CadenceDiscogs.chip('Nobody', 'Nothing'), window.CadenceDiscogs.chip('Wet Leg')]))
    .toEqual([expect.stringContaining('In your records'), expect.stringContaining('On your wantlist'), '', expect.stringContaining('In your records')]);
  // the artist page
  await page.evaluate(() => { window.CadenceArtist.open('Wet Leg'); location.hash = 'view-artist'; });
  await expect(page.locator('.dg-ap')).toContainText('In your records', { timeout: 15000 });
  await expect(page.locator('.dg-ap .dg-rec')).toHaveCount(2);
  await expect(page.locator('.dg-ap .dg-rec').first()).toHaveAttribute('href', 'https://www.discogs.com/release/1');
  // the Your records card on Music Radar
  await page.click('[data-act="space"][data-s="life"]');
  await page.evaluate(() => { location.hash = 'view-radar'; });
  await page.locator('.mr-sec[data-sec=all]').click();
  const card = page.locator('.dg-card'); await expect(card).toContainText('150 in your Discogs collection', { timeout: 15000 });
  await expect(card).toContainText('Pulled from the shelf today');
  await expect(card.locator('.dg-recs .dg-rec')).toHaveCount(6);
  // Want to hear: owned albums are marked and get no button; others can go on your Discogs wantlist
  await page.evaluate(() => { location.hash = 'view-want'; });
  const owned = page.locator('li', { hasText: 'Moisturizer' }); await expect(owned.locator('.dg-chip')).toHaveText('In your records', { timeout: 15000 });
  await expect(owned.locator('[data-dg-want]')).toHaveCount(0);
  const b = page.locator('[data-dg-want="Idles"]'); await expect(b).toHaveText('Add to my Discogs wantlist');
  await b.click();
  await expect(page.getByText('Added to your Discogs wantlist')).toBeVisible();
  expect(asked.some(x => x.startsWith('PUT /users/nickm/wants/9001'))).toBe(true);
  await expect(page.locator('li', { hasText: 'Ripped and Torn' }).locator('.dg-chip')).toHaveText('On your wantlist');
  await expect(page.locator('[data-dg-want="Idles"]')).toHaveText('On your Discogs wantlist');
  expect(errs).toEqual([]);
});

