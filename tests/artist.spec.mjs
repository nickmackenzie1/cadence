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
    // a fake TheAudioDB (found by MusicBrainz ID): logo, photo, banner, biography, and a formed year that disagrees
    if (req.url.startsWith('/adb/123/artist-mb.php?i=mb-gl')) return j({ artists: [{ idArtist: '901', strArtist: 'Glass Lantern', strMusicBrainzID: 'mb-gl', intFormedYear: '2018', strCountry: 'Toronto, Canada',
      strGenre: 'Shoegaze', strStyle: 'Rock/Pop', strMood: 'Dreamy', strLabel: 'Arts & Crafts', intMembers: '4', strFacebook: 'www.facebook.com/glasslantern',
      strBiographyEN: 'Glass Lantern are a four-piece from Toronto.\n\nThey met at a laundromat and started playing loud, slow songs together in a garage behind a bakery. ' + 'Their first record came out on a small label. '.repeat(30),
      strArtistLogo: 'https://r2.theaudiodb.com/images/media/artist/logo/gl.png', strArtistThumb: 'https://r2.theaudiodb.com/images/media/artist/thumb/gl.jpg', strArtistBanner: 'https://r2.theaudiodb.com/images/media/artist/banner/gl.jpg' }] });
    if (req.url.startsWith('/adb/')) return j({ artists: null });
    res.writeHead(404); res.end();
  }).listen(MB);
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...env, PORT: String(PORT), TLS_DIR: join(dir, 'x'),
    RADAR_MB: '1', RADAR_MB_API: `http://localhost:${MB}`, AUDIODB: '1', AUDIODB_API: `http://localhost:${MB}/adb`, AUDIODB_GAP: '20', RADAR_CAA_API: `http://localhost:${MB}`, RADAR_MB_GAP: '20', KEXP_LOG: '1', KEXP_QUIET_MS: '1', KEXP_API: 'http://127.0.0.1:9', KEXP_LOG_DELAY: '99999999', RADIO_WARM: '0' }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); mb && mb.close(); rmSync(dir, { recursive: true, force: true }); });

test('artist page: from a Radar pick to everything about them', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('cadence.reviewNudge', (d => { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })(new Date())); });
  await page.goto(B + '/');
  await page.click('[data-act="space"][data-s="life"]');   // Music Radar lives in Life
  await page.evaluate(() => { location.hash = 'view-radar'; });
  await page.locator('.mr-sec[data-sec=all]').click();   // every Radar section at once
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
  // sounds like: artists mentioned together with them, each a way to wander on
  await expect(page.locator('.ap-sim li', { hasText: 'Porch Static' })).toContainText(/mentioned together \d+ time/);
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

test('artist pages are kept: instant from the NAS copy and this browser, updated in the background', async ({ page }) => {
  const api = n => fetch(B + '/api/radar/artist?name=' + encodeURIComponent(n)).then(r => r.json());
  const first = await api('Glass Lantern');
  expect(first.name).toBe('Glass Lantern');
  const again = await api('Glass Lantern');
  expect(again.cachedAt).toBeGreaterThan(0);                                   // answered from the kept page
  // ?fresh=1 rebuilds now: a new KEXP play appears
  const before = (await api('Glass Lantern')).kexp.plays;
  const add = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '-e', `
    const K = require('./server/services/kexp-log.js'); const d = K.open();
    d.prepare('INSERT INTO kexp_plays VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(...K.row({ id: 999, play_type: 'trackplay', airdate: new Date().toISOString(), artist: 'Glass Lantern', song: 'Orbit', album: 'Night Swim', show: 5 }));
  `], { env: { ...process.env, DATA_DIR: dir, KEXP_LOG: '0' }, encoding: 'utf8' });
  expect(add.status, add.stderr).toBe(0);
  await expect.poll(async () => (await fetch(B + '/api/radar/artist?fresh=1&name=Glass%20Lantern').then(r => r.json())).kexp.plays).toBe(before + 1);

  // the browser keeps it too: reopen with the NAS slow to answer, and the page is there straight away
  await page.goto(B + '/');
  await page.evaluate(() => window.CadenceArtist.open('Glass Lantern'));
  await expect(page.locator('.ap-head h2')).toHaveText('Glass Lantern');
  await expect(page.locator('section', { hasText: 'On KEXP' })).toContainText(`${before + 1} plays`);
  await expect.poll(() => page.evaluate(() => new Promise(ok => { const r = indexedDB.open('cadence-artists', 1); r.onsuccess = () => { const q = r.result.transaction('p').objectStore('p').count(); q.onsuccess = () => ok(q.result); }; r.onerror = () => ok(0); }))).toBeGreaterThan(0);
  await page.route(/api\/radar\/artist/, async r => { await new Promise(f => setTimeout(f, 4000)); r.continue().catch(() => {}); });
  await page.reload();
  await page.evaluate(() => window.CadenceArtist.open('Glass Lantern'));
  await expect(page.locator('section', { hasText: 'On KEXP' })).toContainText(`${before + 1} plays`, { timeout: 2000 });
});

test('TheAudioDB adds the logo, photo, banner and biography, and is compared with MusicBrainz', async ({ page }) => {
  await page.route(/\/api\/(logo|favicon)\?/, r => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64') }));
  // both lookups run in the background; ask for a fresh build until TheAudioDB's part is in
  await expect.poll(async () => !!(await fetch(B + '/api/radar/artist?fresh=1&name=Glass%20Lantern').then(r => r.json())).adb, { timeout: 20000 }).toBe(true);
  await page.goto(B + '/');
  await page.evaluate(() => window.CadenceArtist.open('Glass Lantern'));
  await expect(page.locator('.ap-logo')).toHaveCount(0);                     // the banner already shows the name: no logo tile
  await expect(page.locator('.ap-banner')).toHaveAttribute('src', /banner%2Fgl\.jpg/);
  await expect(page.locator('.ap-img')).toHaveAttribute('src', /thumb%2Fgl\.jpg/);   // the band photo, not a cover
  await expect(page.locator('.ap-about')).toContainText('four-piece from Toronto');
  await expect(page.locator('.ap-about details summary')).toHaveText('Read the rest');
  await expect(page.locator('.ap-facts')).toContainText('4 members');
  await expect(page.locator('.ap-facts')).toContainText('Arts & Crafts');
  await expect(page.locator('.ap-links a', { hasText: 'Facebook' })).toHaveAttribute('href', 'https://www.facebook.com/glasslantern');
  const cmp = page.locator('.ap-cmp');
  await expect(cmp.locator('tr', { hasText: 'Formed' })).toHaveClass(/diff/);          // 2019 vs 2018
  await expect(cmp.locator('tr', { hasText: 'From' })).not.toHaveClass(/diff/);        // Toronto vs Toronto, Canada
  await expect(cmp.locator('tr', { hasText: 'Label' })).toContainText('not listed');
  await expect(cmp).toBeVisible(); await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/artist-adb.png', fullPage: true });
});

test('while an artist page is on its way, a calm placeholder holds its shape', async ({ page }) => {
  await page.goto(B + '/');
  await page.evaluate(() => indexedDB.deleteDatabase('cadence-artists'));
  await page.route(/api\/radar\/artist\?/, async r => { await new Promise(f => setTimeout(f, 1500)); r.continue().catch(() => {}); });
  await page.reload();
  await page.evaluate(() => window.CadenceArtist.open('Someone Slow To Load'));
  await expect(page.locator('.ap[aria-busy=true] .ap-img.sk')).toBeVisible();
  await expect(page.locator('.ap .ap-head h2')).toHaveText('Someone Slow To Load');
  await expect(page.locator('.ap[aria-busy=true]')).toHaveCount(0, { timeout: 8000 });   // then the real page
});

test('an artist nobody knows still gets a calm page', async ({ page }) => {
  await page.goto(B + '/');
  await page.evaluate(() => window.CadenceArtist.open('Nobody Here Yet'));
  await expect(page.locator('.ap-head h2')).toHaveText('Nobody Here Yet');
  await expect(page.locator('#view')).toContainText('No blog, chart or community has mentioned them yet.');
  await expect(page.locator('#view')).toContainText('KEXP hasn\'t played them');
});

test('Music home: one tile, tabs on every music page, and it reopens the tab you used last', async ({ page }) => {
  await page.goto(B + '/');
  await page.click('[data-act="space"][data-s="life"]');
  await page.evaluate(() => { location.hash = 'music'; });
  await expect(page).toHaveURL(/#view-(radar|radio|kexp-history|want|shows|stg|artists)$/);   // the last music tab (settings sync, so another test may have chosen one)
  const tabs = page.locator('.mus-tabs a');
  await expect(tabs).toHaveText(['Music Radar', 'Friday mix', 'Radio', 'KEXP history', 'Want to hear', 'Shows', 'Said the Gramophone', 'Artists', 'Your year']);
  await expect(page.locator('#view h1')).toHaveText('Music');
  await tabs.filter({ hasText: 'Radio' }).first().click();
  await expect(page).toHaveURL(/#view-radio$/);
  await expect(page.locator('.mus-tabs a.on')).toHaveText('Radio');
  await page.evaluate(() => { location.hash = 'today'; });
  await page.evaluate(() => { location.hash = 'music'; });
  await expect(page).toHaveURL(/#view-radio$/);                    // back where you were
  // the side menu has one Music tile, not a tile per music page
  await expect(page.locator('#side-main a.vt[href="#music"]')).toHaveCount(1);
  await expect(page.locator('#side-main a.vt[href="#view-radar"], #side-main a.vt[href="#view-radio"]')).toHaveCount(0);
  // Artists: look anyone up; they're remembered
  await page.locator('.mus-tabs a', { hasText: 'Artists' }).click();
  await page.fill('#ar-q', 'Glass Lantern'); await page.click('#ar-find button');
  await expect(page).toHaveURL(/#view-artist$/);
  await expect(page.locator('.mus-tabs a')).toHaveCount(9);         // tabs stay on top of an artist page…
  await expect(page.locator('.mus-tabs a.on')).toHaveCount(0);      // …with none of them chosen
  await page.evaluate(() => { location.hash = 'view-artists'; });
  await expect(page.locator('.ar-chip', { hasText: 'Glass Lantern' })).toHaveCount(1);
});
