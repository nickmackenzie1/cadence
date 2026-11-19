// Hockey on the Island (2026-11-19): off until switched on; the score and clock on the Island while the team plays;
// a goal for your team lifts the Island (and would sound the horn); the final gets one quiet note. A stand-in NHL feed.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { createServer as netServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = netServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

const G = { state: 'LIVE', tor: 1, bos: 1, period: 2, clock: '12:34', goals: [] };
const game = () => ({ id: 2026020301, gameState: G.state, startTimeUTC: '2026-11-19T00:00:00Z', period: G.period, periodDescriptor: { number: G.period, periodType: 'REG' },
  clock: { timeRemaining: G.clock, inIntermission: false },
  awayTeam: { abbrev: 'BOS', commonName: { default: 'Bruins' }, placeName: { default: 'Boston' }, score: G.bos },
  homeTeam: { abbrev: 'TOR', commonName: { default: 'Maple Leafs' }, placeName: { default: 'Toronto' }, score: G.tor }, goals: G.goals });
let fake, server, dir, B;
test.beforeAll(async () => {
  fake = createServer((req, res) => {
    const json = o => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.url.startsWith('/v1/score/now')) return json({ games: [game(), { id: 9, gameState: 'FUT', homeTeam: { abbrev: 'EDM' }, awayTeam: { abbrev: 'CGY' } }] });
    if (req.url.startsWith('/v1/club-schedule/TOR/week/now')) return json({ games: [{ id: 2026020320, gameState: 'FUT', startTimeUTC: '2099-11-21T00:00:00Z', homeTeam: { abbrev: 'MTL', commonName: { default: 'Canadiens' } }, awayTeam: { abbrev: 'TOR' } }] });
    res.writeHead(404); res.end();
  });
  await new Promise(r => fake.listen(0, '127.0.0.1', r));
  dir = mkdtempSync(join(tmpdir(), 'cadence-hk-')); const PORT = await freePort(); B = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x'), NHL_API: `http://127.0.0.1:${fake.address().port}`, NHL_CACHE_MS: '0' }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); fake && fake.close(); rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); });

test('the NAS gives the game from your team’s side, and the next one after a final', async () => {
  const d = await (await fetch(B + '/api/nhl?team=TOR')).json();
  expect(d.game).toMatchObject({ state: 'live', home: true, us: { abbrev: 'TOR', name: 'Maple Leafs', score: 1 }, them: { abbrev: 'BOS', score: 1 }, period: 2, clock: '12:34' });
  expect(d.poll).toBe(20);
  expect((await fetch(B + '/api/nhl?team=../x')).status).toBe(400);
  G.state = 'OFF';
  const f = await (await fetch(B + '/api/nhl?team=TOR')).json();
  expect(f.game.state).toBe('final');
  expect(f.next).toMatchObject({ home: false, them: { abbrev: 'MTL', name: 'Canadiens' } });
  G.state = 'LIVE';
});

test('off until switched on; then the score on the Island, a goal lifts it, the final gets a note', async ({ page }) => {
  await page.goto(B + '/');
  await page.waitForFunction(() => window.CadenceHockey && window.CadenceIsland);
  // let the startup notices finish, so the Island is at rest
  await expect.poll(async () => { await page.evaluate(() => window.CadenceIsland.dismiss()); return page.evaluate(() => !window.__island.cur && !window.__island.queue.length); }, { timeout: 15000 }).toBe(true);
  // off: nothing on the Island
  await page.evaluate(() => window.CadenceHockey.tick());
  await expect(page.locator('.isl-pill')).not.toContainText('TOR');
  // switch on in the settings
  await page.evaluate(() => window.CadenceHockey.settings());
  await page.check('#hk-on');
  await page.click('#hk-save');
  await expect(page.locator('.isl-pill')).toContainText(/BOS 1 · TOR 1/, { timeout: 10000 });
  await expect(page.locator('.isl-pill')).toContainText('2nd 12:34');
  // a Leafs goal
  G.tor = 2; G.clock = '08:01'; G.goals = [{ period: 2, timeInPeriod: '11:59', teamAbbrev: { default: 'TOR' }, name: { default: 'A. Matthews' }, strength: 'ev' }];
  await page.evaluate(() => window.CadenceHockey.tick());
  await expect(page.locator('.isl-pill')).toContainText('Maple Leafs goal', { timeout: 10000 });
  await expect(page.locator('.isl-pill')).toContainText('A. Matthews');
  // the final: one quiet note, and the game leaves the Island
  G.state = 'FINAL';
  await page.evaluate(() => window.CadenceHockey.tick());
  await expect(page.locator('.isl-pill')).toContainText('Maple Leafs won 2–1', { timeout: 10000 });
  await expect.poll(() => page.evaluate(() => window.__island.lives.has('hockey'))).toBe(false);
});
