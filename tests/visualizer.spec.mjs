// The redesigned player and the old-school visualizers: with the visualizer on, sound from other servers plays through
// the NAS relay (so the browser may analyse it) without losing your place; the window opens from the player, switches
// between Bars, Scope, VU and Ring, remembers the choice, and actually draws something while sound plays.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

const PORT = await freePort(), B = `http://localhost:${PORT}`;
let server, dir;
// 20 s of a loud 440 Hz tone, so the analyser has something to see
const wav = (() => { const rate = 8000, n = rate * 20, b = Buffer.alloc(44 + n); b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40); for (let i = 0; i < n; i++) b[44 + i] = 128 + Math.round(100 * Math.sin(2 * Math.PI * 440 * i / rate)); return b; })();
// answer seeking like the NAS relay does (Range → 206)
const ranged = r => { const m = /bytes=(\d*)-(\d*)/.exec(r.request().headers().range || ''); if (!m) return { status: 200, contentType: 'audio/wav', body: wav, headers: { 'Accept-Ranges': 'bytes' } };
  const a = +m[1] || 0, z = m[2] ? +m[2] : wav.length - 1; return { status: 206, contentType: 'audio/wav', body: wav.subarray(a, z + 1), headers: { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${a}-${z}/${wav.length}` } }; };
const EP = 'https://audio.example.com/show/ep1.wav';

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-viz-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

test('Player: calm redesign, visualizer relays the sound, switches styles and draws', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const hits = { direct: 0, relay: 0 };
  // the "other server" and the NAS relay both hand back the tone (the real relay only reaches public hosts)
  await page.route(EP, r => { hits.direct++; r.fulfill({ status: 200, contentType: 'audio/wav', body: wav, headers: { 'Access-Control-Allow-Origin': '*' } }); });
  await page.route(u => u.pathname.endsWith('/api/radio/stream'), r => { hits.relay++; expect(new URL(r.request().url()).searchParams.get('u')).toBe(EP); r.fulfill(ranged(r)); });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(B + '/#today'); await expect(page.locator('#sync')).toBeVisible({ timeout: 10000 });
  await page.evaluate(ep => CadencePodcasts.load({ uuid: 'v1', url: ep, title: 'A quiet episode', podcastTitle: 'Test Show', duration: 20 }, true), EP);
  await expect.poll(() => page.evaluate(() => !CadencePodcasts.audio.paused), { timeout: 8000 }).toBe(true);
  const bar = page.locator('#pc-mini');
  await expect(bar).toContainText('A quiet episode');
  // the new bar: one outlined play button (not a filled accent one), skip either side, steady times, a seek line
  await expect(bar.locator('.pc-play')).toHaveCount(1); await expect(bar.locator('.pc-big')).toHaveCount(0);
  await expect(bar.locator('[data-pc=back]')).toHaveCount(1); await expect(bar.locator('[data-pc=fwd]')).toHaveCount(1);
  await expect(bar.locator('.pc-m-line')).toBeVisible();
  expect(hits.relay).toBe(0);   // visualizer off: played straight from the other server

  // let it play a few seconds, then open the visualizer: it moves to the relay and keeps the place
  await expect.poll(() => page.evaluate(() => CadencePodcasts.audio.currentTime), { timeout: 8000 }).toBeGreaterThan(2);
  const before = await page.evaluate(() => CadencePodcasts.audio.currentTime);
  await bar.locator('[data-pc=viz]').click();
  const win = page.locator('#pc-viz'); await expect(win).toBeVisible();
  await expect.poll(() => page.evaluate(() => CadencePodcasts.audio.src)).toContain('api/radio/stream?u=');
  await expect.poll(() => hits.relay, { timeout: 8000 }).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => CadencePodcasts.audio.currentTime), { timeout: 8000 }).toBeGreaterThanOrEqual(before - 0.5);
  await expect.poll(() => page.evaluate(() => !CadencePodcasts.audio.paused), { timeout: 8000 }).toBe(true);

  // it hears the tone (the analyser reads real levels) and paints the canvas
  await expect.poll(() => page.evaluate(() => { const a = CadencePodcasts.analyser(); if (!a) return 0; const f = new Uint8Array(a.an.frequencyBinCount); a.an.getByteFrequencyData(f); return Math.max(...f); }), { timeout: 8000 }).toBeGreaterThan(100);
  const lit = () => page.evaluate(() => { const c = document.querySelector('#pc-viz canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 200) n++; return n; });
  for (const m of ['bars', 'scope', 'vu', 'ring']) {
    await win.locator(`[data-vz=${m}]`).click();
    await expect(win.locator(`[data-vz=${m}]`)).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(lit, { timeout: 5000 }).toBeGreaterThan(50);
    await page.waitForTimeout(300); await win.screenshot({ path: `test-results/viz-${m}.png` });
  }
  await bar.screenshot({ path: 'test-results/player.png' }); await page.screenshot({ path: 'test-results/player-page.png' });

  // remembered after a reload
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cadence.viz.mode')))).toBe('ring');
  // closing hides it; the player keeps playing
  await win.locator('[data-vz-act=close]').click(); await expect(win).toBeHidden();
  expect(await page.evaluate(() => !CadencePodcasts.audio.paused)).toBe(true);
  // clicking the seek line jumps
  const box = await bar.locator('.pc-m-line').boundingBox();
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
  await expect.poll(() => page.evaluate(() => CadencePodcasts.audio.currentTime), { timeout: 5000 }).toBeGreaterThan(13);
  expect(errs).toEqual([]);
});
