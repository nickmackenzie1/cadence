// Redraws change only what changed (idiomorph, 2026-11-18): a sync or refresh on the same page keeps the rows that didn't
// change (same elements), an open "Done today", and what you're typing; going to another page is a full redraw.
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
  dir = mkdtempSync(join(tmpdir(), 'cadence-morph-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

test('a redraw of the same page keeps unchanged rows, open sections and your typing', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(B + '/#today'); await expect(page.locator('#sync')).toBeVisible({ timeout: 10000 });
  const qa = page.locator('#qa');
  for (const t of ['Water the plants today', 'Call the bank today', 'Return library books today']) { await qa.fill(t); await qa.press('Enter'); }
  await expect(page.locator('.task')).toHaveCount(3);
  // finish one so "Done today" exists, and open it
  await page.locator('.task', { hasText: 'Call the bank' }).locator('.check').click();
  await expect(page.locator('.td-done')).toBeVisible();
  await page.locator('.td-done summary').click();
  await expect(page.locator('.td-done')).toHaveAttribute('open', '');
  // mark a row element, start typing, then something else changes (a task added from "another device")
  await page.evaluate(() => { document.querySelector('.task').__mark = 'same'; });
  await qa.fill('Half-typed thought');
  await page.evaluate(() => Cadence.registerPlugin({ id: 'test-hook', name: 'test', setup(api) { window.T = api; } }));
  await page.evaluate(() => { const d = new Date(), t = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); window.T.tasks.add({ title: 'From the phone', dueDate: t }); window.T.ui.refresh(); });
  await expect(page.locator('.task:not(.done)', { hasText: 'From the phone' })).toHaveCount(1);
  expect(await page.evaluate(() => [...document.querySelectorAll('.task')].some(e => e.__mark === 'same'))).toBe(true);   // the same element, not a copy
  await expect(page.locator('.td-done')).toHaveAttribute('open', '');                                                          // still open
  await expect(qa).toHaveValue('Half-typed thought'); await expect(qa).toBeFocused();
  // the add box still works once (its listeners aren't doubled by the redraws)
  await qa.fill('One more today'); await qa.press('Enter');
  await expect(page.locator('.task', { hasText: 'One more' })).toHaveCount(1);
  // another page and back: a full redraw
  await page.evaluate(() => { location.hash = 'upcoming'; }); await expect(page.locator('.head h1')).toHaveText('Upcoming');
  await page.evaluate(() => { location.hash = 'today'; }); await expect(page.locator('.task', { hasText: 'Water the plants' })).toHaveCount(1);
  expect(await page.evaluate(() => [...document.querySelectorAll('.task')].some(e => e.__mark === 'same'))).toBe(false);
  expect(errs).toEqual([]);
});
