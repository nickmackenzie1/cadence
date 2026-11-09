// Good Homeowner: the setup interview creates the right maintenance reminders in Life's Home area, and re-running it updates instead of duplicating.
import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 10200 + Math.floor(Math.random() * 200), B = `http://localhost:${PORT}`;
let server, dir;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-home-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x') }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

test('setup interview builds the home plan, and re-running it never duplicates', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { localStorage.setItem('cadence.reviewNudge', 'x'); localStorage.setItem('cadence.space', 'life'); });
  await page.goto(B + '/#view-house');
  const hook = () => page.evaluate(() => Cadence.registerPlugin({ id: 'test-hook', name: 'test', setup(api) { window.T = api; } }));
  await expect(page.locator('.gh-hero')).toBeVisible({ timeout: 8000 });
  await page.click('#gh-start');
  // place: a house we own, cold winters
  await page.click('.gh-o[data-q=type][data-v=house]'); await page.click('.gh-o[data-q=own][data-v=own]'); await page.click('.gh-o[data-q=climate][data-v=cold]');
  await page.click('#gh-next');
  // heating: gas furnace, pleated filter, central AC, plus a humidifier
  await page.click('.gh-o[data-q=heat][data-v=gas]'); await page.click('.gh-o[data-q=extras][data-v=humidifier]');
  await page.click('#gh-next');
  await page.click('.gh-o[data-q=water][data-v=sump]');
  await page.click('#gh-next');
  await expect(page.locator('.gh-h')).toHaveText('Outside');
  await page.click('.gh-o[data-q=outside][data-v=snowblower]');
  await page.click('#gh-next');
  await page.click('.gh-o[data-q=safety][data-v=tires]');
  await page.click('#gh-next');
  // review: untick one
  await expect(page.locator('.gh-plan')).toContainText('Change the furnace filter');
  await page.uncheck('.gh-i input[data-k=coils]');
  await page.click('#gh-go');
  await expect(page.locator('.gh-top')).toContainText('maintenance reminders running');
  await hook();
  const tasks = await page.evaluate(() => window.T.tasks.list(t => t.gh));
  const keys = tasks.map(t => t.gh);
  for (const k of ['filter', 'furnace', 'ac', 'humon', 'sump', 'taps-off', 'eaves-fall', 'snowblower', 'tires-on', 'batteries']) expect(keys).toContain(k);
  expect(keys).not.toContain('coils');   // unticked
  expect(keys).not.toContain('pool-open');
  const home = await page.evaluate(() => window.T.clients.list().find(c => c.name === 'Home').id);
  expect(tasks.every(t => t.clientId === home && t.repeat && t.repeat.unit === 'month')).toBe(true);
  expect(tasks.find(t => t.gh === 'filter').repeat.n).toBe(3);
  expect(tasks.find(t => t.gh === 'furnace').repeat.n).toBe(12);
  expect(tasks.every(t => t.dueDate > window_today(t))).toBe(true);

  // the filter size flows into the reminder's notes
  await page.fill('[data-sys=filterSize]', '16x25x1');
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.T.tasks.list(t => t.gh === 'filter')[0].notes)).toContain('16x25x1');

  // a warranty gets a reminder 30 days before it ends
  await page.click('[data-add=warranties]');
  await page.fill('[data-list=warranties][data-k=item]', 'Dishwasher');
  await page.fill('[data-list=warranties][data-k=expires]', '2030-06-30');
  await page.waitForTimeout(700);
  const w = await page.evaluate(() => window.T.tasks.list(t => String(t.gh).startsWith('warranty:')));
  expect(w).toHaveLength(1); expect(w[0].dueDate).toBe('2030-05-31');

  // re-run with a different filter: updated in place, no duplicates; a removed system takes its reminders with it
  const before = keys.length;
  await page.click('#gh-redo');
  await page.click('#gh-next');
  await page.click('.gh-o[data-q=filter][data-v=media]'); await page.click('.gh-o[data-q=extras][data-v=humidifier]');
  for (let i = 0; i < 4; i++) await page.click('#gh-next');
  await page.click('#gh-go');
  await hook();
  const again = await page.evaluate(() => window.T.tasks.list(t => t.gh));
  const ks = again.map(t => t.gh);
  expect(new Set(ks).size).toBe(ks.length);
  expect(ks.filter(k => k === 'filter')).toHaveLength(1);
  expect(again.find(t => t.gh === 'filter').repeat.n).toBe(6);
  expect(ks).not.toContain('humon');
  expect(ks.filter(k => k.startsWith('warranty:'))).toHaveLength(1);   // warranties survive a re-run
  expect(ks.length).toBe(before - 2 + 1);   // -humidifier on/off, +warranty
  expect(ks).not.toContain('coils');   // still unticked from last time

  // finishing one rolls it forward and keeps it owned by the plan
  await page.evaluate(() => { const t = window.T.tasks.list(t => t.gh === 'furnace')[0]; window.T.tasks.complete(t.id); });
  const next = await page.evaluate(() => window.T.tasks.list(t => t.gh === 'furnace' && !t.done));
  expect(next).toHaveLength(1);

  // the widget lists this month's home jobs
  expect(await page.evaluate(() => window.T.widgets.list().some(w => w.title === 'This month at home'))).toBe(true);
  expect(errs).toEqual([]);
});

function window_today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
