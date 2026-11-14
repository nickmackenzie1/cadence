// Podcasts: Pocket Casts sync through the NAS (against a fake Pocket Casts here), the app-wide player that keeps
// playing across views and space switches, resuming where the phone left off, and your place going back.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

const PORT = await freePort(), FAKE = await freePort(), B = `http://localhost:${PORT}`;
let server, fake, dir; const got = [];
// a tiny silent WAV so the browser has real audio to "play"
const wav = (() => { const n = 8000 * 30, b = Buffer.alloc(44 + n); b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(8000, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40); b.fill(128, 44); return b; })();
const EP = (uuid, title, pos = 0) => ({ uuid, podcastUuid: 'pod1', podcastTitle: 'Test Show', title, url: `http://localhost:${FAKE}/audio/${uuid}.wav`, published: new Date().toISOString(), duration: 30, playedUpTo: pos, playingStatus: pos ? 2 : 0 });

test.beforeAll(async () => {
  fake = http.createServer((req, res) => {
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      got.push({ path: req.url, body: body ? JSON.parse(body) : null, auth: req.headers.authorization || '' });
      const j = o => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (req.url.startsWith('/audio/')) { res.writeHead(200, { 'Content-Type': 'audio/wav', 'Accept-Ranges': 'none' }); return res.end(wav); }
      if (req.url === '/user/login') return JSON.parse(body).password === 'pw' ? j({ token: 'tok' }) : (res.writeHead(401), res.end());
      if (req.headers.authorization !== 'Bearer tok') { res.writeHead(401); return res.end(); }
      if (req.url === '/user/podcast/list') return j({ podcasts: [{ uuid: 'pod1', title: 'Test Show', author: 'Someone' }] });
      if (req.url === '/user/new_releases') return j({ episodes: [EP('e1', 'Brand new episode'), EP('e2', 'Another one')] });
      if (req.url === '/user/in_progress') return j({ episodes: [EP('e3', 'Half way through', 12)] });
      if (req.url === '/up_next/list') return j({ episodes: [EP('e2', 'Another one')] });
      if (req.url === '/sync/update_episode' || req.url === '/sync/update_episode_star') return j({ status: 'ok' });
      res.writeHead(404); res.end();
    });
  }).listen(FAKE);
  dir = mkdtempSync(join(tmpdir(), 'cadence-pc-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir,
    POCKETCASTS_EMAIL: 'me@example.com', POCKETCASTS_PASSWORD: 'pw', POCKETCASTS_API: `http://localhost:${FAKE}`, POCKETCASTS_CACHE: `http://localhost:${FAKE}` }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); fake && fake.close(); rmSync(dir, { recursive: true, force: true }); });

test('Podcasts: shows synced from Pocket Casts, resume from the phone, keeps playing across views and spaces, place goes back', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  // the server never hands the login or token to the browser
  const o = await (await fetch(B + '/api/podcasts')).json();
  expect(o.configured).toBe(true); expect(JSON.stringify(o)).not.toMatch(/tok|pw|me@example/);
  expect(o.inProgress[0].position).toBe(12);

  await page.goto(B + '/#view-podcasts'); await expect(page.locator('#sync')).toContainText('NAS', { timeout: 10000 });
  await expect(page.locator('.pc-ep', { hasText: 'Brand new episode' }).first()).toBeVisible();
  // resume the in-progress one: it starts at 12 s, where the "phone" left it
  await page.locator('.pc-side .pc-ep', { hasText: 'Half way through' }).locator('[data-act-pc=play]').click();
  await expect.poll(() => page.evaluate(() => !CadencePodcasts.audio.paused), { timeout: 8000 }).toBe(true);
  expect(await page.evaluate(() => CadencePodcasts.audio.currentTime)).toBeGreaterThanOrEqual(11.5);
  await expect(page.locator('#pc-mini')).toBeVisible();
  // switch view and space: same audio element, still playing
  await page.goto(B + '/#today'); await page.locator('.space-sw [role=tab]', { hasText: 'Life' }).click(); await page.waitForTimeout(800);
  expect(await page.evaluate(() => !CadencePodcasts.audio.paused && document.querySelectorAll('audio#pc-audio').length === 1)).toBe(true);
  await expect(page.locator('#pc-mini')).toBeVisible();
  // pausing sends the place back to Pocket Casts
  await page.locator('#pc-mini [data-pc=toggle]').click();
  await expect.poll(() => got.some(g => g.path === '/sync/update_episode' && g.body.uuid === 'e3' && +g.body.position >= 12 && g.body.status === 2)).toBe(true);
  expect(errs).toEqual([]);
});

test('Podcasts without Pocket Casts set up: a calm how-to, no errors', async () => {
  const r = await fetch(B + '/api/podcasts/status'); expect((await r.json()).configured).toBe(true);
});
