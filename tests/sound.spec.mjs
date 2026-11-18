// The sound of a song (2026-11-17): a preview is read in the browser (Essentia.js in a worker) for tempo, key and energy,
// kept on the NAS, shown on the artist page, and used to shape the Friday mix's running order.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

const PORT = await freePort(), B = `http://localhost:${PORT}`;
let server, dir;
// 20 s at 22.05 kHz: an A major chord with a low thump every half second (120 BPM)
const wav = (() => { const rate = 22050, n = rate * 20, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) { const t = i / rate, ph = t % 0.5; const v = (ph < 0.04 ? Math.sin(2 * Math.PI * 60 * t) * (1 - ph / 0.04) * 0.7 : 0) + 0.15 * (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 554.37 * t) + Math.sin(2 * Math.PI * 659.25 * t)); b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), 44 + i * 2); } return b; })();
const PV = 'https://cdns-preview.example.com/beep.mp3';

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-sound-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, MUSIC_PROCESS: '0' }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

test('a preview is read for tempo and key in a worker, kept, and shown on the artist page', async ({ page }) => {
  test.setTimeout(90000);
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route(u => u.pathname.endsWith('/api/radio/stream'), r => { expect(new URL(r.request().url()).searchParams.get('u')).toBe(PV); r.fulfill({ status: 200, contentType: 'audio/wav', body: wav }); });
  let posted = null;
  await page.route(u => u.pathname.endsWith('/api/radar/sound'), async r => { posted = JSON.parse(r.request().postData()); await r.continue(); });
  await page.goto(B + '/#today'); await expect(page.locator('#sync')).toBeVisible({ timeout: 10000 });
  await page.evaluate(pv => { localStorage.removeItem('cadence.snd.done'); CadenceSound.analyse({ id: 'pv|Tone Band|Beep', url: pv, artist: 'Tone Band', title: 'Beep' }); }, PV);
  await expect.poll(() => posted, { timeout: 60000 }).not.toBeNull();
  expect(posted).toMatchObject({ artist: 'Tone Band', title: 'Beep', key: 'A', scale: 'major' });
  expect(posted.bpm).toBeGreaterThan(110); expect(posted.bpm).toBeLessThan(130);
  // read once: asking again doesn't fetch it again
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cadence.snd.done')))).toContain('pv|Tone Band|Beep');
  await expect.poll(async () => (await (await page.request.get(B + '/api/radar/artist?name=Tone%20Band&fresh=1')).json()).sound?.words, { timeout: 10000 }).toMatch(/^About 1[12]\d BPM, mostly A major/);
  expect(errs).toEqual([]);
});

test('running order: calm at the ends, liveliest in the middle; unread ones after', async () => {
  const S = await import('../server/services/radar/lib/sound.mjs');
  const E = { a: 1, b: 5, c: 3, d: 2, e: 4 };
  expect(S.arc(['a', 'b', 'c', 'd', 'e', 'x'], k => E[k] ?? null)).toEqual(['a', 'c', 'b', 'e', 'd', 'x']);
  expect(S.arc(['a', 'x'], k => E[k] ?? null)).toEqual(['a', 'x']);   // too few to shape
});
