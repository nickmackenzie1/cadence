// Music Radar: the Life view draws the NAS radar data (simulated here), and thumbs and subreddit edits go back to the NAS.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

const PORT = await freePort(), B = `http://localhost:${PORT}`;
let server, dir;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-radar-'));
  const sim = spawnSync(process.execPath, ['server/services/radar/test/simulate.mjs'], { env: { ...process.env, RADAR_DATA: join(dir, 'radar'), RADAR_DB: join(dir, 'cadence.db'), ANTHROPIC_API_KEY: '', LASTFM_API_KEY: '' }, encoding: 'utf8' });
  if (sim.status !== 0) throw new Error('simulate failed: ' + sim.stderr);
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x') }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

test('Music Radar view: charts, picks, thumbs and subreddits', async ({ page }) => {
  test.setTimeout(120000);
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { localStorage.setItem('cadence.reviewNudge', (d => { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })(new Date())); localStorage.setItem('cadence.space', 'life'); });
  await page.goto(B + '/#view-radar');
  await expect(page.locator('.mr-tiles')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.mr-chart svg polyline').first()).toBeVisible();
  await expect(page.locator('.mr-graph circle').first()).toBeAttached();
  await expect(page.locator('.mr-card').filter({ hasText: 'Fastest risers' })).toContainText('Glass Lantern');
  // off by default; nothing in the UI uses emoji
  await expect(page.locator('#mr-on')).not.toBeChecked();
  expect(await page.locator('#view-radar, .mr-grid').first().innerText()).not.toMatch(/\p{Extended_Pictographic}/u);

  // thumbs up a pick, then undo it
  const up = page.locator('[data-fb][data-v="1"]').first(), id = await up.getAttribute('data-fb');
  await up.click();
  await expect.poll(async () => (await (await fetch(B + '/api/radar/data')).json()).picks.find(p => p.id === id).feedback).toBe(1);
  await expect(page.locator(`[data-fb="${id}"][data-v="1"]`)).toHaveClass(/on/);
  await page.locator(`[data-fb="${id}"][data-v="1"]`).click();
  await expect.poll(async () => (await (await fetch(B + '/api/radar/data')).json()).picks.find(p => p.id === id).feedback).toBe(0);

  // add and remove a subreddit
  await page.fill('#mr-new', 'r/synthwave'); await page.keyboard.press('Enter');
  await expect(page.locator('.mr-sc', { hasText: 'r/synthwave' })).toBeVisible({ timeout: 15000 });
  await page.click('[data-rm="synthwave"]');
  await expect(page.locator('.mr-sc', { hasText: 'r/synthwave' })).toHaveCount(0, { timeout: 15000 });

  // years view switches
  await page.click('#mr-hy [data-v=month]');
  await expect(page.locator('#mr-hy [data-v=month]')).toHaveClass(/on/);

  // other sources: combined across sources, each source on its own tab, and their settings
  await page.goto(B + '/#view-radar');
  const src = page.locator('#mr-sources');
  await expect(src).toContainText('Glass Lantern');
  await expect(src.locator('tr', { hasText: 'Glass Lantern' }).locator('.mr-src')).toHaveCount(5);   // blogs, Audius, ListenBrainz, Hype Machine, Reddit
  await page.click('[data-src=hypem]');
  await expect(src).toContainText('Mira Vale');
  await page.click('[data-src=lastfm]');
  await expect(src).toContainText('LASTFM_API_KEY');
  await expect(page.locator('.mr-card', { hasText: 'Crossed over' })).toContainText('Ketamine Kids');
  await page.click('#mr-srcset');
  await page.fill('#mr-lb', 'nick');
  await page.click('#mr-srcsave');
  await expect.poll(async () => (await (await fetch(B + '/api/radar/data')).json()).sources.cfg.lbUser).toBe('nick');

  // it's all in cadence.db as radar_* tables, and the Database view shows them
  const raw = await (await fetch(B + '/api/radar/raw')).json();
  expect(raw.storage).toBe('sqlite');
  expect(raw.tables.find(t => t.name === 'radar_picks').count).toBeGreaterThan(5);
  await page.goto(B + '/#view-db');
  await page.click('[data-col="sql:radar_picks"]');
  await expect(page.locator('.dbv [data-row]').first()).toBeVisible();

  // the RSS feed and a digest are served
  const rss = await (await fetch(B + '/api/radar/feed.xml')).text();
  expect(rss).toContain('<rss');
  expect(errs).toEqual([]);
});
