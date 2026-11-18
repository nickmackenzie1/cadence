// ⌘K finds everything: commands, tasks by title or notes (done ones too, after open ones), meetings by their notes,
// and what plugins add (artists from Music, via api.search).
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const PORT = await freePort(), DZ = await freePort(), B = `http://localhost:${PORT}`;
let server, dir, dz;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-pal-'));
  dz = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: decodeURIComponent(req.url).toLowerCase().includes('plumb') ? [{ id: 3, name: 'The Plumbers', nb_fan: 1200 }] : [] })); }).listen(DZ);
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x'), DEEZER_API: `http://localhost:${DZ}`, RADAR_DATA: join(dir, 'radar') }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); dz && dz.close(); rmSync(dir, { recursive: true, force: true }); });

test('⌘K finds tasks by their notes, done tasks and artists', async ({ page }) => {
  await page.goto(B + '/#inbox');
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  await page.evaluate(() => Cadence.registerPlugin({ id: 'test-hook', name: 'test', setup(api) { window.T = api; } }));
  await page.evaluate(() => {
    const c = window.T.clients.add('Harbourfront');
    const a = window.T.tasks.add({ title: 'Fix the leak', notes: 'Ask the plumber about the copper valve' });
    window.T.tasks.add({ title: 'Plumber invoice', clientId: c.id });
    const b = window.T.tasks.add({ title: 'Old plumbing quote' }); window.T.tasks.complete(b.id);
  });
  await page.keyboard.press('Control+k');
  await page.fill('#pal-in', 'plumb');
  const items = page.locator('#pal-list .pal-item');
  await expect(items.filter({ hasText: 'Plumber invoice' })).toContainText('Harbourfront');
  await expect(items.filter({ hasText: 'Fix the leak' })).toContainText('in notes:');           // found by its notes
  await expect(items.filter({ hasText: 'Old plumbing quote' })).toContainText('done');          // done tasks too
  const texts = await items.allTextContents(), at = t => texts.findIndex(x => x.includes(t));
  expect(at('Old plumbing quote')).toBeGreaterThan(at('Plumber invoice'));                       // open ones first
  await expect(items.filter({ hasText: 'The Plumbers' })).toContainText('artist');               // from Music (api.search)
  // two words in any order
  await page.fill('#pal-in', 'valve copper');
  await expect(items.filter({ hasText: 'Fix the leak' })).toHaveCount(1);
  // choosing an artist opens their page
  await page.fill('#pal-in', 'plumbers');
  await items.filter({ hasText: 'The Plumbers' }).click();
  await expect(page).toHaveURL(/#view-artist$/);
});

test('⌘K finds meetings by what was said in them', async ({ page }) => {
  await page.goto(B + '/?demo=1#today');
  await page.keyboard.press('Control+k');
  await page.fill('#pal-in', 'walked through pipeline');
  const m = page.locator('#pal-list .pal-item', { hasText: /^Meeting with / }).first();
  await expect(m).toContainText('Walked through');
  const name = (await m.textContent()).match(/^Meeting with (.+?),/)[1];
  await m.click();
  await expect(page.locator('#view h1')).toContainText(name);
});
