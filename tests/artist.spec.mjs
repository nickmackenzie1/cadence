// Artist page: click an artist anywhere → one page with MusicBrainz details (fake), every source mention, charts,
// community picks and KEXP plays + DJs. Radar data is the simulator's; KEXP plays are filled in before the server starts.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

const PORT = await freePort(), MB = await freePort(), B = `http://localhost:${PORT}`;
let server, mb, dir;

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-artist-'));
  const env = { ...process.env, RADAR_DATA: join(dir, 'radar'), RADAR_DB: join(dir, 'cadence.db'), DATA_DIR: dir, ANTHROPIC_API_KEY: '', LASTFM_API_KEY: '' };
  const sim = spawnSync(process.execPath, ['server/services/radar/test/simulate.mjs'], { env, encoding: 'utf8' });
  if (sim.status !== 0) throw new Error('simulate failed: ' + sim.stderr);
  const fill = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '-e', `
    const K = require('./server/services/kexp-log.js'); const d = K.open(), now = Date.now();
    const ins = d.prepare('INSERT INTO kexp_plays VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    d.prepare('INSERT INTO kexp_shows VALUES (?,?,?,?,?,?,?)').run(5, 'The Morning Show', 'Eclectic', 'John Richards', 0, null, null);
    for (let i = 0; i < 4; i++) ins.run(...K.row({ id: i + 1, play_type: 'trackplay', airdate: new Date(now - i * 864e5).toISOString(), artist: 'Glass Lantern', song: i ? 'Night Swim' : 'Orbit', album: 'Night Swim', show: 5 }));
  `], { env: { ...env, KEXP_LOG: '0' }, encoding: 'utf8' });
  if (fill.status !== 0) throw new Error('fill failed: ' + fill.stderr);
  mb = http.createServer((req, res) => {
    const j = o => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.url.startsWith('/ws/2/artist/?')) return j({ artists: decodeURIComponent(req.url).includes('Glass Lantern') ? [{ id: 'mb-gl', name: 'Glass Lantern', score: 100 }] : [] });
    if (req.url.startsWith('/ws/2/artist/mb-gl')) return j({ id: 'mb-gl', name: 'Glass Lantern', type: 'Group', area: { name: 'Canada' }, 'begin-area': { name: 'Toronto' }, 'life-span': { begin: '2019-04' },
      tags: [{ name: 'shoegaze', count: 3 }, { name: 'dream pop', count: 1 }],
      relations: [{ type: 'bandcamp', url: { resource: 'https://glasslantern.bandcamp.com/' } }, { type: 'official homepage', url: { resource: 'http://glasslantern.example' } }],
      'release-groups': [{ id: 'rg1', title: 'Night Swim', 'first-release-date': '2025-09-01', 'primary-type': 'Album', 'secondary-types': [] },
        { id: 'rg2', title: 'Live at the Horseshoe', 'first-release-date': '2024-01-01', 'primary-type': 'Album', 'secondary-types': ['Live'] }] });
    res.writeHead(404); res.end();
  }).listen(MB);
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...env, PORT: String(PORT), TLS_DIR: join(dir, 'x'),
    RADAR_MB: '1', RADAR_MB_API: `http://localhost:${MB}`, RADAR_CAA_API: `http://localhost:${MB}`, RADAR_MB_GAP: '20', KEXP_LOG: '1', KEXP_API: 'http://127.0.0.1:9', KEXP_LOG_DELAY: '99999999', RADIO_WARM: '0' }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); mb && mb.close(); rmSync(dir, { recursive: true, force: true }); });

test('artist page: from a Radar pick to everything about them', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('cadence.reviewNudge', (d => { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })(new Date())); });
  await page.goto(B + '/');
  await page.click('[data-act="space"][data-s="life"]');   // Music Radar lives in Life
  await page.evaluate(() => { location.hash = 'view-radar'; });
  await expect(page.locator('.mr-tiles')).toBeVisible({ timeout: 10000 });
  await page.locator('.mr-pick [data-artist="Glass Lantern"]').first().click();
  await expect(page).toHaveURL(/#view-artist$/);
  await expect(page.locator('.ap-head h2')).toHaveText('Glass Lantern');
  // MusicBrainz fills in a few seconds later (looked up in the background)
  await expect(page.locator('.ap-facts')).toContainText('Toronto', { timeout: 15000 });
  await expect(page.locator('.ap-facts')).toContainText('since 2019');
  await expect(page.locator('.ap-links a', { hasText: 'Bandcamp' })).toHaveAttribute('href', 'https://glasslantern.bandcamp.com/');
  await expect(page.locator('.ap-links a', { hasText: 'Website' })).toHaveAttribute('href', 'https://glasslantern.example');
  await expect(page.locator('.ap-r')).toHaveCount(1);                       // the live album is left out
  await expect(page.locator('.ap-r')).toContainText('Night Swim');
  await expect(page.locator('.ap-tags')).toContainText('shoegaze');
  // where they're showing up: sources and community picks
  await expect(page.locator('section', { hasText: 'Where they\'re showing up' }).locator('.ap-list li').first()).toBeVisible();
  // KEXP: plays, songs, who plays them, and the way into KEXP history
  const kx = page.locator('section', { hasText: 'On KEXP' });
  await expect(kx).toContainText('4 plays');
  await expect(kx).toContainText('John Richards');
  await kx.locator('[data-ap="kexp"]').click();
  await expect(page).toHaveURL(/#view-kexp-history$/);
  await expect(page.locator('.kx-head h3')).toHaveText('Glass Lantern');
  // and back to the artist page from KEXP history
  await page.locator('.kx-full').click();
  await expect(page.locator('.ap-head h2')).toHaveText('Glass Lantern');
});

test('an artist nobody knows still gets a calm page', async ({ page }) => {
  await page.goto(B + '/');
  await page.evaluate(() => window.CadenceArtist.open('Nobody Here Yet'));
  await expect(page.locator('.ap-head h2')).toHaveText('Nobody Here Yet');
  await expect(page.locator('#view')).toContainText('No blog, chart or community has mentioned them yet.');
  await expect(page.locator('#view')).toContainText('KEXP hasn\'t played them');
});
