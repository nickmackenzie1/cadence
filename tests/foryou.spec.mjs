// For you (user, 2026-11-16): Radar learns from follows, Want to hear, previews played or skipped and songs heard live,
// ranks what it's buzzing about for you with a plain reason, and "Not for me" hides an artist, genre or source.
// Radar data is the simulator's.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

const PORT = await freePort(), B = `http://localhost:${PORT}`;
let server, dir;
const get = p => fetch(B + p).then(r => r.json());
const post = (p, b) => fetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json());

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-fy-'));
  const env = { ...process.env, RADAR_DATA: join(dir, 'radar'), RADAR_DB: join(dir, 'cadence.db'), DATA_DIR: dir, ANTHROPIC_API_KEY: '', LASTFM_API_KEY: '' };
  const sim = spawnSync(process.execPath, ['server/services/radar/test/simulate.mjs'], { env, encoding: 'utf8' });
  if (sim.status !== 0) throw new Error('simulate failed: ' + sim.stderr);
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...env, PORT: String(PORT), TLS_DIR: join(dir, 'x'), KEXP_LOG: '0', STG: '0', RADAR_MB: '0', AUDIODB: '0', RADIO_WARM: '0', KINGSTONLIVE: '0' }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

test('For you learns from what you follow and play; Not for me hides and undoes', async ({ page }) => {
  let d = await get('/api/radar/data');
  // the simulator already has thumbs on some picks, so there's a little to go on before following anyone
  expect(d.forYou.list.every(x => x.why)).toBe(true);
  // follow the best-connected artist in the "sounds like" graph, and play previews of another
  expect(d.graph.nodes.every(n => n.name && n.name !== 'undefined')).toBe(true);   // names, not blanks
  const top = [...d.graph.nodes].sort((a, b) => b.degree - a.degree)[0], hub = { name: top.name };
  await post('/api/radar/follow', { add: hub.name });
  for (let i = 0; i < 2; i++) expect((await post('/api/radar/listen', { artist: hub.name, title: 'Song', kind: 'preview', secs: 30 })).ok).toBe(true);
  expect((await post('/api/radar/listen', { artist: 'Someone', kind: 'nonsense', secs: 30 })).ok).toBe(false);   // only real kinds
  d = await get('/api/radar/data');
  expect(d.forYou.list.length).toBeGreaterThan(0);
  expect(d.forYou.list.every(x => x.why && x.artist !== hub.name)).toBe(true);   // new to you, never someone you follow
  expect(d.forYou.list.some(x => /^(mentioned alongside|you like) /.test(x.why))).toBe(true);

  // the page: For you at the top, with reasons; Not for me hides an artist everywhere, and can be undone
  await page.goto(B + '/');
  await page.click('[data-act="space"][data-s="life"]');
  await page.evaluate(() => { location.hash = 'view-radar'; });
  const fy = page.locator('.mr-fy');
  await expect(fy.locator('.mr-fyl li').first()).toBeVisible({ timeout: 10000 });
  const first = await fy.locator('.mr-fyl li').first().locator('.ar-link').textContent();
  await expect(fy.locator('.mr-why').first()).not.toBeEmpty();
  await page.setViewportSize({ width: 1400, height: 900 }); await fy.screenshot({ path: 'test-results/foryou.png' });
  await fy.locator('.mr-fyl li').first().locator('[data-nfm-type=artist]').click();
  await expect(fy.locator('.mr-fyl .ar-link', { hasText: first })).toHaveCount(0);
  await expect(fy).toContainText('1 artist hidden');
  d = await get('/api/radar/data');
  expect(JSON.stringify(d.rise.top) + JSON.stringify(d.rise.risers)).not.toContain(`"${first}"`);
  await fy.locator('#mr-nfm-manage').click();
  await page.locator('.mr-nfmd [data-nfm-off]').first().click();
  await expect.poll(async () => (await get('/api/radar/nfm')).artists.length).toBe(0);

  // previews heard in the browser are logged (a quick stop is a skip)
  await page.evaluate(() => { const P = window.CadencePodcasts; P.load({ uuid: 'preview:x', preview: true, title: 'Quick one', podcastTitle: 'Skipped Band', url: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=' }, false); });
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
});

test('a source or a genre can be Not for me too', async () => {
  let n = await post('/api/radar/nfm', { type: 'source', value: 'blog:Pitchfork' });
  expect(n.sources).toContain('blog:Pitchfork');
  n = await post('/api/radar/nfm', { type: 'genre', value: 'EDM' });
  expect(n.genres).toContain('EDM');
  n = await post('/api/radar/nfm', { type: 'genre', value: 'edm', on: false });
  expect(n.genres).toEqual([]);
  n = await post('/api/radar/nfm', { type: 'source', value: 'blog:Pitchfork', on: false });
  expect(n.sources).toEqual([]);
});

test('Friday mix: picks in groups with reasons, kept for the week, made again on request, and a page to play them', async ({ page }) => {
  const m = await get('/api/radar/mix');
  expect(m.week).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(new Date(m.week + 'T12:00:00').getDay()).toBe(5);                      // weeks start on a Friday
  expect(m.items.length).toBeGreaterThan(3);
  expect(m.items.every(x => x.artist && x.why && ['foryou', 'follow', 'rising', 'wild'].includes(x.group))).toBe(true);
  expect(new Set(m.items.map(x => x.artist.toLowerCase())).size).toBe(m.items.length);   // nobody twice
  expect((await get('/api/radar/mix')).made).toBe(m.made);                       // the same mix all week
  const again = await post('/api/radar/mix', { again: true });
  expect(again.made).toBeGreaterThanOrEqual(m.made);
  await page.goto(B + '/#view-mix');
  await expect(page.locator('.mx h2')).toContainText('Week of');
  await expect(page.locator('.mx-l li').first()).toBeVisible();
  await expect(page.locator('.mx-l li .mx-bc').first()).toHaveAttribute('href', /bandcamp\.com\/search\?q=/);
  await expect(page.locator('.mus-tabs a[href="#view-mix"]')).toHaveCount(1);
  await page.locator('#mx-save').click();
  await expect.poll(async () => (await get('/api/radar/want')).length).toBeGreaterThanOrEqual(again.items.length);
});

test('Out this week and Called it', async () => {
  const r = await get('/api/radar/releases');
  expect(r.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(Array.isArray(r.thisWeek) && Array.isArray(r.soon)).toBe(true);
  for (const x of [...r.thisWeek, ...r.soon]) expect(x.artist && x.title && x.date && x.why).toBeTruthy();
  const c = await get('/api/radar/calledit');
  expect(Array.isArray(c.list)).toBe(true);
  for (const x of c.list) { expect(x.lead).toBeGreaterThanOrEqual(3); expect(x.milestones[0].what).toMatch(/Apple chart|heavy rotation/); }
});

test('Close to home: Kingston and Canadian artists, with why', async ({ page }) => {
  const { DatabaseSync } = await import('node:sqlite');
  const d = new DatabaseSync(join(dir, 'cadence.db'));
  d.exec("PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS radio_plays (id INTEGER PRIMARY KEY AUTOINCREMENT, station TEXT NOT NULL, at INTEGER NOT NULL, artist TEXT, song TEXT, raw TEXT)");
  const ins = d.prepare('INSERT INTO radio_plays (station, at, artist, song, raw) VALUES (?,?,?,?,?)'), now = Math.round(Date.now() / 1000);
  for (let i = 0; i < 3; i++) ins.run('cfrc', now - i * 3600, 'The Limestone Kids', 'Song ' + i, '');
  ins.run('ckut', now, 'Montreal Band', 'Song', '');
  d.close();
  const h = await get('/api/radar/home');
  const k = h.kingston.find(x => x.artist === 'The Limestone Kids');
  expect(k.why[0]).toBe('played on CFRC 101.9 3 times');
  expect(h.canada.find(x => x.artist === 'Montreal Band').why[0]).toBe('played on CKUT 90.3');
  await page.goto(B + '/');
  await page.click('[data-act="space"][data-s="life"]');
  await page.evaluate(() => { location.hash = 'view-radar'; });
  await expect(page.locator('.mr-home')).toContainText('The Limestone Kids');
});

test('Your year in music: minutes, top artists, stations; skipped previews left out', async ({ page }) => {
  await post('/api/radar/listen', { artist: 'Year Band', title: 'First', kind: 'live', station: 'CFRC 101.9', secs: 600 });
  await post('/api/radar/listen', { artist: 'Year Band', title: 'Second', kind: 'kexp', station: 'KEXP 90.3', secs: 300 });
  await post('/api/radar/listen', { artist: 'Skip Band', title: 'Nope', kind: 'preview', secs: 3, skipped: true });
  const y = await get('/api/radar/year');
  expect(y.year).toBe(new Date().getFullYear());
  expect(y.artists[0].artist).toBe('Year Band');
  expect(y.artists[0].minutes).toBe(15);
  expect(y.artists.some(a => a.artist === 'Skip Band')).toBe(false);
  expect(y.stations.map(s => s.station)).toContain('CFRC 101.9');
  expect(y.months[new Date().getMonth()]).toBeGreaterThanOrEqual(15);
  await page.goto(B + '/#view-year');
  await expect(page.locator('.yr h2')).toHaveText(`${y.year} in music`);
  await expect(page.locator('.yr-l li').first()).toContainText('Year Band');
});
