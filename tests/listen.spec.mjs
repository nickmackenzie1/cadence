// Listening from Music Radar: 30-second previews (fake Deezer) in the shared player, the Want to hear list kept on the
// NAS, and Play all moving through it.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

const PORT = await freePort(), DZ = await freePort(), B = `http://localhost:${PORT}`;
let server, dz, dir;
const wav = (() => { const n = 8000 * 3, b = Buffer.alloc(44 + n); b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(8000, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40); b.fill(128, 44); return b; })();
const T = (title, artist, n) => ({ id: n, title, link: 'https://www.deezer.com/track/' + n, preview: `http://localhost:${DZ}/p/${n}.wav`, artist: { name: artist }, album: { title: 'Album', cover_medium: '' } });

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-listen-'));
  const env = { ...process.env, RADAR_DATA: join(dir, 'radar'), RADAR_DB: join(dir, 'cadence.db'), DATA_DIR: dir, ANTHROPIC_API_KEY: '', LASTFM_API_KEY: '' };
  const sim = spawnSync(process.execPath, ['server/services/radar/test/simulate.mjs'], { env, encoding: 'utf8' });
  if (sim.status !== 0) throw new Error('simulate failed: ' + sim.stderr);
  dz = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url), j = o => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.startsWith('/p/')) { res.writeHead(200, { 'Content-Type': 'audio/wav' }); return res.end(wav); }
    if (u.startsWith('/search/artist')) return j({ data: u.includes('Mira Vale') ? [{ id: 9, name: 'Mira Vale' }] : [] });
    if (u.startsWith('/artist/9/top')) return j({ data: [T('Blue Moon Hotel', 'Mira Vale', 91)] });
    if (u.startsWith('/search')) {
      const m = u.match(/artist:"([^"]+)" (track|album):"([^"]+)"/); if (!m) return j({ data: [] });
      return j({ data: m[2] === 'track' && !['Mira Vale', 'Nobody'].includes(m[1]) ? [T(m[3], m[1], m[3].length)] : [] });
    }
    res.writeHead(404); res.end();
  }).listen(DZ);
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...env, PORT: String(PORT), TLS_DIR: join(dir, 'x'), DEEZER_API: `http://localhost:${DZ}`, KEXP_LOG: '0', RADIO_WARM: '0', RADAR_MB: '0' }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); dz && dz.close(); rmSync(dir, { recursive: true, force: true }); });

test('previews: a song, or the artist\'s top track when there\'s no match', async () => {
  const j = async q => (await fetch(B + '/api/radar/preview?' + q)).json();
  expect(await j('artist=Glass%20Lantern&title=Night%20Swim')).toEqual(expect.objectContaining({ found: true, title: 'Night Swim', artist: 'Glass Lantern', exact: true }));
  expect(await j('artist=Mira%20Vale&title=Something')).toEqual(expect.objectContaining({ found: true, title: 'Blue Moon Hotel', exact: false }));
  expect((await j('artist=Nobody&title=Nothing')).found).toBe(false);
});

test('play from a pick, save to Want to hear, play all', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('cadence.reviewNudge', (d => { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })(new Date())); });
  await page.goto(B + '/');
  await page.click('[data-act="space"][data-s="life"]');
  await page.evaluate(() => { location.hash = 'view-radar'; });
  await expect(page.locator('.mr-tiles')).toBeVisible({ timeout: 10000 });

  // play the first pick's preview
  const pick = page.locator('.mr-pick').first(), artist = await pick.locator('[data-artist]').first().getAttribute('data-artist');
  await pick.locator('[data-pv]').click();
  await expect.poll(() => page.evaluate(() => { const c = window.CadencePodcasts.current; return c && c.preview && !window.CadencePodcasts.audio.paused; })).toBe(true);
  await expect(page.locator('#pc-mini')).toContainText('preview');
  await expect(page.locator(`#pc-mini [data-artist="${artist}"]`)).toHaveCount(1);

  // save two picks; the Want to hear card shows them, newest first
  await pick.locator('[data-want]').click();
  await page.locator('.mr-pick').nth(1).locator('[data-want]').click();
  await expect(page.locator('.mr-want li')).toHaveCount(2);
  expect((await (await fetch(B + '/api/radar/want')).json()).length).toBe(2);
  await expect(pick.locator('[data-want]')).toHaveClass(/on/);

  // play all: when one ends, the next starts
  const before = await page.evaluate(() => window.CadencePodcasts.current.uuid);
  await page.click('#mr-wantall');
  // the newest save plays first, so the player moves off the preview that was already playing
  await expect.poll(() => page.evaluate(() => window.CadencePodcasts.current.uuid)).not.toBe(before);
  const first = await page.evaluate(() => window.CadencePodcasts.current.uuid);
  await expect(page.locator('#pc-mini [data-pc="nextpv"]')).toHaveCount(1);
  await page.evaluate(() => window.CadencePodcasts.audio.dispatchEvent(new Event('ended')));
  await expect.poll(() => page.evaluate(() => window.CadencePodcasts.current.uuid)).not.toBe(first);

  // the Want to hear page lists them; removing one updates the NAS list
  await page.goto(B + '/#view-want');
  await expect(page.locator('.wh-l li')).toHaveCount(2);
  await page.locator('.wh-l li').first().locator('[data-want]').click();
  await expect(page.locator('.wh-l li')).toHaveCount(1);
  expect((await (await fetch(B + '/api/radar/want')).json()).length).toBe(1);
});
