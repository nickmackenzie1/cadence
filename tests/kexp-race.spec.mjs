// KEXP through the years (2026-11-17): the bar chart race page plays, scrubs, switches between the last 12 months and
// all time, lists the month's names as links, and says calmly when the NAS is still counting.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const PORT = await freePort(), B = `http://localhost:${PORT}`;
let server, dir;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-race-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, KEXP_LOG: '0' }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

const months = Array.from({ length: 24 }, (_, i) => `${2010 + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, '0')}`);
const frame = i => [['Alvvays', 300 - i * 8], ['Big Thief', 100 + i * 10], ['Wednesday', 150], ...Array.from({ length: 9 }, (_, k) => [`Band ${k + 1}`, 90 - k * 5])].sort((a, b) => b[1] - a[1]);
const RACE = { ready: true, months, totals: months.map(() => 1234), roll: months.map((_, i) => frame(i)), all: months.map((_, i) => frame(i).map(([n, v]) => [n, v * (i + 1)])) };

test('the race plays, scrubs, switches what it counts, and names open artist pages', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route(u => u.pathname.endsWith('/api/radio/kexp') && u.searchParams.get('view') === 'race', r => r.fulfill({ json: RACE }));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(B + '/#view-kexp-years'); await expect(page.locator('#sync')).toBeVisible({ timeout: 10000 });
  const cv = page.locator('#kr-cv'); await expect(cv).toBeVisible();
  // opens on the latest month
  await expect(page.locator('#kr-month')).toContainText('2011');
  await expect(page.locator('#kr-list li')).toHaveCount(12);
  await expect(page.locator('#kr-list li').first()).toContainText('Big Thief');
  // drag to the start: Alvvays leads
  await page.locator('#kr-pos').fill('0'); await page.locator('#kr-pos').dispatchEvent('change');
  await expect(page.locator('#kr-list li').first()).toContainText('Alvvays');
  await expect(page.locator('#kr-month')).toContainText('2010');
  // something is drawn
  const painted = () => cv.evaluate(c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const s = new Set(); for (let i = 0; i < d.length; i += 400) s.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); return s.size; });
  expect(await painted()).toBeGreaterThan(5);
  // play moves through the months, pause stops
  await page.locator('#kr-play').click();
  await expect.poll(() => page.locator('#kr-pos').inputValue().then(Number), { timeout: 5000 }).toBeGreaterThan(1);
  await page.locator('#kr-play').click();
  await expect(page.locator('#kr-play')).toHaveAttribute('aria-pressed', 'false');
  await page.waitForTimeout(300); await cv.screenshot({ path: 'test-results/kexp-race.png' });
  // all time so far: remembered
  await page.locator('[data-kr-mode=all]').click();
  await expect(page.locator('[data-kr-mode=all]')).toHaveAttribute('aria-pressed', 'true');
  // a name opens the artist page
  await page.locator('#kr-list a').first().click();
  await expect(page).toHaveURL(/view-artist/);
  expect(errs).toEqual([]);
});

test('while the NAS is still counting, it says so', async ({ page }) => {
  await page.route(u => u.pathname.endsWith('/api/radio/kexp') && u.searchParams.get('view') === 'race', r => r.fulfill({ json: { ready: false, progress: 0.42 } }));
  await page.goto(B + '/#view-kexp-years'); await expect(page.locator('#sync')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('counting KEXP\'s plays month by month (42% so far)')).toBeVisible();
});
