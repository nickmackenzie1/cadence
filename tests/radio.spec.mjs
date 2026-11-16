// Radio: stations from the NAS, playing through the shared Podcasts player (mini player, pause/resume to the live edge),
// KEXP "now playing", saving stations from search, and the NAS relay refusing private addresses.
// Radio Browser and the real stations aren't reachable from CI, so the station list, search and now-playing come
// from page.route fixtures and the "stream" is a local silent WAV.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

const PORT = await freePort(), FAKE = await freePort(), B = `http://localhost:${PORT}`;
let server, fake, dir;
const wav = (() => { const n = 8000 * 30, b = Buffer.alloc(44 + n); b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(8000, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40); b.fill(128, 44); return b; })();
const STREAM = () => `http://localhost:${FAKE}/live.wav`;
const STATIONS = () => [
  { id: 'kexp', name: 'KEXP 90.3', place: 'Seattle', about: 'DJ-picked indie', url: STREAM(), home: 'https://www.kexp.org', now: 'kexp' },
  { id: 'cjai', name: 'Amherst Island Radio', place: 'Amherst Island, ON', about: 'Community radio', url: STREAM() },
  { id: 'gone', name: 'Quiet Station', place: 'Nowhere', url: null, missing: true },
];

test.beforeAll(async () => {
  fake = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'audio/wav' }); res.end(wav); }).listen(FAKE);
  dir = mkdtempSync(join(tmpdir(), 'cadence-radio-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); fake && fake.close(); rmSync(dir, { recursive: true, force: true }); });

const fixtures = async page => {
  await page.route('**/api/radio/stations', r => r.fulfill({ json: STATIONS() }));
  await page.route('**/api/radio/kexp-history', r => r.fulfill({ json: { on: true, plays: 12345, since: '2025-11-15T00:00:00Z', backfill: 'running' } }));
  await page.route('**/api/radio/now?id=kexp', r => r.fulfill({ json: { artist: 'Jay Som', song: 'Appointments', album: 'Belong', art: null } }));
  await page.route('**/api/radio/search?*', r => r.fulfill({ json: [{ id: 'rb:1', name: 'CFRC 101.9', place: 'Ontario, Canada', about: 'college, indie', url: STREAM() }] }));
};

test('play a station: shared mini player, KEXP now playing, pause and resume to the live edge', async ({ page }) => {
  await fixtures(page);
  await page.goto(B + '/#view-radio');
  await expect(page.locator('.rd-st')).toHaveCount(3);
  await expect(page.locator('.rd-foot').first()).toContainText("keeping KEXP's playlist: 12,345 songs since");
  await expect(page.locator('.rd-st', { hasText: 'Quiet Station' })).toContainText("Couldn't find its stream");
  await expect(page.locator('.rd-st', { hasText: 'Quiet Station' }).locator('[data-rd="play"]')).toBeDisabled();

  await page.locator('.rd-st', { hasText: 'KEXP' }).locator('[data-rd="play"]').click();
  await expect.poll(() => page.evaluate(() => !CadencePodcasts.audio.paused)).toBe(true);
  await expect(page.locator('#pc-mini')).toContainText('Appointments');
  await expect(page.locator('#pc-mini')).toContainText('Jay Som · KEXP 90.3');
  await expect(page.locator('#pc-mini [data-pc="back"]')).toHaveCount(0);           // live: no skipping
  await expect(page.locator('#pc-mini a[href="#view-radio"]')).toHaveCount(1);
  await expect(page.locator('.rd-now')).toContainText('Appointments');

  // keeps playing in another view; the Podcasts view doesn't treat the station as an episode
  await page.goto(B + '/#view-podcasts');
  await expect(page.locator('#pc-mini')).toBeVisible();
  expect(await page.evaluate(() => !CadencePodcasts.audio.paused)).toBe(true);

  // pause, then play rejoins the live stream (reloads it rather than resuming the old buffer)
  await page.locator('#pc-mini [data-pc="toggle"]').click();
  await expect.poll(() => page.evaluate(() => CadencePodcasts.audio.paused)).toBe(true);
  await page.evaluate(() => { window.__src = CadencePodcasts.audio.src; CadencePodcasts.audio.removeAttribute('src'); });
  await page.locator('#pc-mini [data-pc="toggle"]').click();
  await expect.poll(() => page.evaluate(() => !CadencePodcasts.audio.paused && CadencePodcasts.audio.src === window.__src)).toBe(true);

  // after a reload the station is ready but not downloading until you press play
  await page.reload();
  await expect(page.locator('#pc-mini')).toContainText('KEXP 90.3');
  expect(await page.evaluate(() => CadencePodcasts.audio.getAttribute('src'))).toBeNull();
});

test('find a station, save it, remove it', async ({ page }) => {
  await fixtures(page);
  await page.goto(B + '/#view-radio');
  await page.locator('#rd-q').fill('Kingston');
  await page.locator('#rd-find button').click();
  await expect(page.locator('.rd-st', { hasText: 'CFRC 101.9' })).toHaveCount(1);
  await page.locator('.rd-st', { hasText: 'CFRC 101.9' }).locator('[data-rd="save"]').click();
  await expect(page.locator('.rd-h', { hasText: 'Your stations' })).toHaveCount(1);
  await expect(page.locator('.rd-list').first()).toContainText('CFRC 101.9');
  await page.locator('.rd-list').first().locator('[data-rd="remove"]').click();
  await expect(page.locator('.rd-h', { hasText: 'Your stations' })).toHaveCount(0);
});

test('the NAS relay only plays public addresses', async () => {
  for (const u of ['http://127.0.0.1:' + FAKE + '/live.wav', 'http://192.168.1.10/stream', 'file:///etc/passwd']) {
    const r = await fetch(B + '/api/radio/stream?u=' + encodeURIComponent(u));
    expect(r.status, u).toBeGreaterThanOrEqual(400);
  }
});

test('Radio Browser results: the best stream wins (working, https, most votes; never HLS)', async () => {
  const R = (await import('../server/services/radio.js')).default;
  const s = (o) => R.shape({ stationuuid: o.id, name: o.id, url_resolved: o.url, lastcheckok: o.ok ? 1 : 0, votes: o.votes || 0, hls: o.hls ? 1 : 0 });
  expect(R.best([s({ id: 'a', url: 'http://a', ok: 1, votes: 50 }), s({ id: 'b', url: 'https://b', ok: 1, votes: 5 }), s({ id: 'c', url: 'https://c', ok: 0, votes: 999 }), s({ id: 'd', url: 'https://d.m3u8', ok: 1, votes: 999, hls: 1 })]).id).toBe('rb:b');
});
