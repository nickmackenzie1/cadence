// Now playing for every station: the song title inside the stream (ICY metadata), what each station played, and
// "Keep a history". The NAS refuses private addresses, so the reader is tested against a local stream directly and
// the page gets its now-playing from fixtures.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

const PORT = await freePort(), B = `http://localhost:${PORT}`;
let server, dir;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-radionow-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, RADIO_WARM: '0', KEXP_LOG: '0', RADIO_HISTORY: '0' }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

// a stream that sends a title every 1000 bytes; the first block can be empty (length 0) like real stations
const icyServer = (title, { metaint = 1000, latin1 = false, empty = false } = {}) => http.createServer((req, res) => {
  if (req.headers['icy-metadata'] !== '1' || !metaint) { res.writeHead(200, { 'Content-Type': 'audio/mpeg' }); return res.end(Buffer.alloc(4000)); }
  res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'icy-metaint': String(metaint) });
  const meta = Buffer.from(`StreamTitle='${title}';StreamUrl='';`, latin1 ? 'latin1' : 'utf8'), pad = Buffer.alloc(Math.ceil(meta.length / 16) * 16); meta.copy(pad);
  res.end(Buffer.concat([Buffer.alloc(metaint), empty ? Buffer.from([0]) : Buffer.concat([Buffer.from([pad.length / 16]), pad]), Buffer.alloc(500)]));
});
const readFrom = async srv => {
  const R = require('../server/services/radio.js');
  await new Promise(r => srv.listen(0, r));
  try {
    return await new Promise((ok, bad) => { const req = http.get(`http://localhost:${srv.address().port}/`, { headers: { 'Icy-MetaData': '1' } }, res => Promise.resolve(R.readIcy(res, req)).then(ok, bad)); req.on('error', bad); });
  } finally { srv.close(); }
};

test('reads the song title out of a stream', async () => {
  const R = require('../server/services/radio.js');
  expect(await readFrom(icyServer('Alvvays - Belinda Says'))).toEqual({ title: 'Alvvays - Belinda Says' });
  expect(await readFrom(icyServer('Céline Dion - Pour que tu m\'aimes encore'.replace("'", '')), { latin1: true })).toEqual({ title: 'Céline Dion - Pour que tu maimes encore' });
  expect(await readFrom(icyServer('x', { empty: true }))).toEqual({ title: null });          // nothing right now
  expect(await readFrom(icyServer('x', { metaint: 0 }))).toEqual({ none: true });           // this station never sends titles
  expect(R.splitTitle('Alvvays - Belinda Says')).toEqual({ artist: 'Alvvays', song: 'Belinda Says', raw: 'Alvvays - Belinda Says' });
  expect(R.splitTitle('CFRC Station ID')).toEqual({ artist: null, song: 'CFRC Station ID', raw: 'CFRC Station ID' });
});

test('keep a history: on and off, per station', async () => {
  const post = b => fetch(B + '/api/radio/follow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json());
  expect((await (await fetch(B + '/api/radio/history?id=cfrc')).json())).toEqual({ station: 'cfrc', follow: false, since: null, plays: [] });
  const on = await post({ id: 'cfrc', name: 'CFRC 101.9', on: true });
  expect(on.follow).toBe(true); expect(on.since).toBeTruthy();
  expect((await post({ id: 'cfrc', on: false })).follow).toBe(false);
  expect((await fetch(B + '/api/radio/follow', { method: 'POST', body: '{}' })).status).toBe(400);
});

test('the page: any station shows its song, what it played earlier, and the station history', async ({ page }) => {
  let song = 'Belinda Says';
  await page.route('**/api/radio/stations', r => r.fulfill({ json: [{ id: 'cfrc', name: 'CFRC 101.9', place: 'Kingston, ON', url: `${B}/api/health` }] }));
  await page.route('**/api/radio/kexp-history', r => r.fulfill({ json: { on: false } }));
  await page.route('**/api/radio/now?id=cfrc*', r => r.fulfill({ json: { artist: 'Alvvays', song, raw: 'Alvvays - ' + song } }));
  await page.route('**/api/radio/history?id=cfrc*', r => r.fulfill({ json: { station: 'cfrc', follow: false, since: null, plays: [
    { at: new Date().toISOString(), artist: 'Alvvays', song: 'Belinda Says' }, { at: new Date(Date.now() - 240e3).toISOString(), artist: 'Jay Som', song: 'Superbike' }, { at: new Date(Date.now() - 480e3).toISOString(), artist: null, song: 'CFRC Station ID' }] } }));
  await page.goto(B + '/#view-radio');
  await page.locator('.rd-st', { hasText: 'CFRC' }).locator('[data-rd="play"]').click();
  await expect(page.locator('#pc-mini')).toContainText('Belinda Says');
  await expect(page.locator('#pc-mini')).toContainText('Alvvays · CFRC 101.9');
  await expect(page.locator('.rd-now')).toContainText('Belinda Says');
  await expect(page.locator('.rd-now [data-artist="Alvvays"]')).toHaveCount(1);
  await page.locator('.rd-earlier summary').click();
  await expect(page.locator('.rd-earlier li')).toHaveCount(2);
  await expect(page.locator('.rd-earlier')).toContainText('Jay Som');
  await expect(page.locator('.rd-earlier')).toContainText('CFRC Station ID');
  await page.locator('.rd-st', { hasText: 'CFRC' }).locator('[data-rd="hist"]').click();
  await expect(page.locator('.rd-pl li')).toHaveCount(3);
  await expect(page.locator('#rd-follow')).not.toBeChecked();
});
