// Downloads (2026-11-24): songs from Soulseek (slskd), YouTube Music (yt-dlp) and records from Usenet (newznab + SABnzbd),
// into the music folder; what's there plays in full. The outside programs are stand-ins here: a small slskd, indexer and
// SABnzbd answering like the real ones, and a yt-dlp script that prints a search result and writes a file.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readdirSync, chmodSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
let server, fake, dir, B, F;
const MUSIC = () => join(dir, 'music'), SLSKD = () => join(dir, 'slskd'), USENET = () => join(dir, 'usenet');
const FLAC = Buffer.alloc(4096, 1);
const slskFiles = [
  { filename: '@@music\\Wet Leg\\Wet Leg (2022)\\03 - Chaise Longue (Live at KEXP).mp3', size: 3000, bitRate: 320 },
  { filename: '@@music\\Wet Leg\\Wet Leg (2022)\\03 - Chaise Longue.flac', size: FLAC.length, bitRate: 0 },
];
const transfers = new Map();
let history = 0, lastSearch = '';

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-dl-'));
  for (const d of [MUSIC(), SLSKD(), USENET()]) mkdirSync(d, { recursive: true });
  // yt-dlp stand-in: a search prints one YouTube Music song; a download writes an .m4a where -o says
  const yt = join(dir, 'yt-dlp');
  writeFileSync(yt, `#!/usr/bin/env node
const a = process.argv.slice(2);
if (a.includes('--flat-playlist')) { const u = a[a.length - 1];
  if (/Starburster/i.test(decodeURIComponent(u))) console.log(JSON.stringify({ id: 'abc123', title: 'Starburster', artists: ['Fontaines D.C.'], duration: 223 }));
  process.exit(0); }
const o = a[a.indexOf('-o') + 1]; require('fs').writeFileSync(o.replace('%(id)s', 'abc123').replace('%(ext)s', 'm4a'), Buffer.alloc(2048, 2));
`); chmodSync(yt, 0o755);
  // slskd, the indexer and SABnzbd, on one port
  const FP = await freePort(); F = `http://127.0.0.1:${FP}`;
  fake = http.createServer(async (req, res) => {
    const u = new URL(req.url, F), json = (v, s = 200) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(v)); };
    let body = ''; for await (const c of req) body += c;
    if (u.pathname.startsWith('/api/v0/')) {
      if (req.headers['x-api-key'] !== 'sk') return json({}, 401);
      const p = u.pathname.slice(7);
      if (p === '/searches' && req.method === 'POST') { const q = JSON.parse(body); lastSearch = q.searchText; return json({ id: q.id, state: 'InProgress' }); }
      const m = p.match(/^\/searches\/([^/]+)(\/responses)?$/);
      if (m && req.method === 'DELETE') return json({}, 204);
      if (m && m[2]) return json(/wet leg chaise longue/i.test(lastSearch) ? [{ username: 'kind', hasFreeUploadSlot: true, queueLength: 0, uploadSpeed: 4e6, files: slskFiles }] : []);
      if (m) return json({ state: 'Completed, Succeeded' });
      const t = p.match(/^\/transfers\/downloads\/([^/]+)$/);
      if (t && req.method === 'POST') {
        for (const f of JSON.parse(body)) { const parts = f.filename.split('\\'); const name = parts.pop(), folder = parts.pop(); mkdirSync(join(SLSKD(), folder), { recursive: true }); writeFileSync(join(SLSKD(), folder, name), FLAC); transfers.set(f.filename, 'Completed, Succeeded'); }
        return json({}, 201);
      }
      if (t) return json({ username: t[1], directories: [{ directory: 'x', files: [...transfers].map(([filename, state]) => ({ filename, state })) }] });
      return json({}, 404);
    }
    if (u.pathname === '/idx/api') {
      if (u.searchParams.get('apikey') !== 'nk') return json({}, 401);
      const q = u.searchParams.get('q');
      return json({ channel: { item: /moisturizer/i.test(q) ? [
        { title: 'Wet Leg - Moisturizer (2025) Discography [MP3]', enclosure: { '@attributes': { url: F + '/nzb/2', length: '900000000' } } },
        { title: 'Wet.Leg-Moisturizer-WEB-2025-FLAC', enclosure: { '@attributes': { url: F + '/nzb/1', length: '320000000' } } },
      ] : [] } });
    }
    if (u.pathname === '/sab/api') {
      if (u.searchParams.get('apikey') !== 'sab') return json({}, 403);
      if (u.searchParams.get('mode') === 'addurl') {
        const d = join(USENET(), 'music', 'Wet.Leg-Moisturizer-WEB-2025-FLAC'); mkdirSync(d, { recursive: true });
        for (const n of ['01-wet_leg-catch_these_fists.flac', '02-wet_leg-liquidize.flac', '03-wet_leg-davina_mccall.flac', 'cover.jpg']) writeFileSync(join(d, n), FLAC);
        return json({ status: true, nzo_ids: ['SABnzbd_nzo_1'] });
      }
      if (u.searchParams.get('mode') === 'history') { history++; return json({ history: { slots: history < 2 ? [] : [{ nzo_id: 'SABnzbd_nzo_1', status: 'Completed', storage: '/downloads/complete/music/Wet.Leg-Moisturizer-WEB-2025-FLAC' }] } }); }
    }
    json({}, 404);
  });
  await new Promise(r => fake.listen(FP, '127.0.0.1', r));

  const PORT = await freePort(); B = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: join(dir, 'data'), TLS_DIR: join(dir, 'x'),
    MUSIC_DIR: MUSIC(), SLSKD_DOWNLOADS: SLSKD(), USENET_COMPLETE: USENET(), GET_YTDLP_BIN: yt, GET_TICK_MS: '60',
    SLSKD_URL: F, SLSKD_API_KEY: 'sk', NEWZNAB_URL: F + '/idx', NEWZNAB_API_KEY: 'nk', SABNZBD_URL: F + '/sab', SABNZBD_API_KEY: 'sab' }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  for (let i = 0; i < 100; i++) { try { if ((await fetch(B + '/api/radar/get')).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
});
test.afterAll(() => { server && server.kill(); fake && fake.close(); rmSync(dir, { recursive: true, force: true }); });

const post = (p, b) => fetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json());
const jobOf = async id => (await (await fetch(B + '/api/radar/get')).json()).jobs.find(j => j.id === id);

test('a song: the lossless copy from Soulseek (not the live one), saved as Artist/Singles/Artist - Title, then it plays in full', async () => {
  const r = await post('/api/radar/get', { artist: 'Wet Leg', title: 'Chaise Longue' });
  expect(r.job.status).toBe('waiting');
  await expect.poll(async () => (await jobOf(r.job.id)).status, { timeout: 20000 }).toBe('done');
  const j = await jobOf(r.job.id);
  expect(j.source).toBe('Soulseek'); expect(j.qualityLabel).toBe('Lossless');
  expect(j.files).toEqual(['Wet Leg/Singles/Wet Leg - Chaise Longue.flac']);
  expect(statSync(join(MUSIC(), j.files[0])).size).toBe(FLAC.length);
  expect(existsSync(join(SLSKD(), 'Wet Leg (2022)'))).toBe(false);   // moved out, and the empty folder tidied
  // already there: asking again says so, and the owned list knows it
  expect((await post('/api/radar/get', { artist: 'wet leg', title: 'chaise longue' })).owned).toBeTruthy();
  const o = await post('/api/radar/get/owned', { items: [{ artist: 'Wet Leg', title: 'Chaise Longue' }, { artist: 'Nobody', title: 'Nothing' }] });
  expect(Object.values(o).map(x => x.p)).toEqual(['Wet Leg/Singles/Wet Leg - Chaise Longue.flac']);
  // playing it: the file, with seeking
  const f = await fetch(B + '/api/radar/get/file?p=' + encodeURIComponent(j.files[0]), { headers: { Range: 'bytes=100-199' } });
  expect(f.status).toBe(206); expect(f.headers.get('content-type')).toBe('audio/flac'); expect((await f.arrayBuffer()).byteLength).toBe(100);
  expect((await fetch(B + '/api/radar/get/file?p=' + encodeURIComponent('../data/music-get.json'))).status).toBe(404);   // only the music folder
});

test('a song not on Soulseek comes from YouTube Music; a record comes from Usenet, the FLAC release rather than a discography', async () => {
  const s = await post('/api/radar/get', { artist: 'Fontaines D.C.', title: 'Starburster' });
  await expect.poll(async () => (await jobOf(s.job.id)).status, { timeout: 20000 }).toBe('done');
  const j = await jobOf(s.job.id);
  expect(j.source).toBe('YouTube Music'); expect(j.files).toEqual(['Fontaines D.C./Singles/Fontaines D.C. - Starburster.m4a']);
  const a = await post('/api/radar/get', { kind: 'album', artist: 'Wet Leg', album: 'Moisturizer' });
  await expect.poll(async () => (await jobOf(a.job.id)).status, { timeout: 20000 }).toBe('done');
  const r = await jobOf(a.job.id);
  expect(r.source).toBe('Usenet'); expect(r.qualityLabel).toBe('Lossless');
  expect(readdirSync(join(MUSIC(), 'Wet Leg', 'Moisturizer')).sort()).toEqual(['01-wet_leg-catch_these_fists.flac', '02-wet_leg-liquidize.flac', '03-wet_leg-davina_mccall.flac']);
  expect(existsSync(join(USENET(), 'music', 'Wet.Leg-Moisturizer-WEB-2025-FLAC'))).toBe(false);
  // nowhere to be found: said plainly, with Try again
  const n = await post('/api/radar/get', { artist: 'Nobody', title: 'Nothing At All' });
  await expect.poll(async () => (await jobOf(n.job.id)).status, { timeout: 30000 }).toBe('none');
  expect((await jobOf(n.job.id)).note).toBe('Looked on Soulseek, YouTube Music, YouTube and SoundCloud');
});

test('the Downloads page: the list in plain words, sources set up, Get from the box, and Play beside Radar picks plays the whole song', async ({ page }) => {
  await page.goto(B + '/#today');
  await page.click('[data-act=space][data-s=life]');
  await page.goto(B + '/#view-downloads');
  await expect(page.locator('.dl-r', { hasText: 'Chaise Longue' })).toContainText('In your music');
  await expect(page.locator('.dl-r', { hasText: 'Chaise Longue' })).toContainText('Soulseek · Lossless');
  await expect(page.locator('.dl-r', { hasText: 'Nothing At All' })).toContainText("Couldn't find it");
  await page.locator('.dl-set summary').click();
  await expect(page.locator('.dl-src li.on')).toHaveCount(3);
  await page.fill('#dl-ar', 'Fontaines D.C.'); await page.fill('#dl-ti', 'Starburster'); await page.click('#dl-add button[type=submit]');
  await expect(page.getByText('Already in your music').first()).toBeVisible();
  // the shared buttons: a song you have shows as in your music, and Play loads the file
  const html = await page.evaluate(() => window.CadencePreview.buttons('Wet Leg', 'Chaise Longue', 'song', 'test'));
  expect(html).toContain('dl-have');
  await page.evaluate(() => window.CadencePreview.play('Wet Leg', 'Chaise Longue'));
  await expect.poll(() => page.evaluate(() => window.CadencePodcasts.current && window.CadencePodcasts.current.url)).toContain('api/radar/get/file');
  await expect(page.locator('#pc-mini')).toContainText('From your music');
  await page.evaluate(() => window.CadencePodcasts.audio.pause());
  await page.setViewportSize({ width: 1300, height: 860 }); await page.waitForTimeout(300); await page.screenshot({ path: 'test-results/downloads.png' });
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300); await page.screenshot({ path: 'test-results/downloads-phone.png' });
});
