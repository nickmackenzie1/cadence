// Views and plugins from the big 2026-11-09 batch.
import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 10200 + Math.floor(Math.random() * 200), B = `http://localhost:${PORT}`;
let server, dir;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-more-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x') }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

async function open(page) {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('cadence.reviewNudge', 'x'));
  await page.goto(B + '/#today');
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
  await page.evaluate(() => Cadence.registerPlugin({ id: 'test-hook', name: 'test', setup(api) { window.T = api; } }));
  return errs;
}
const seed = page => page.evaluate(() => { const T = window.T, d = T.util.todayKey(), ad = n => T.util.ymd(T.util.addDays(new Date(), n));
  const A = T.clients.add('Acme'); const ids = {};
  ids.sow = T.tasks.add({ title: 'Send SOW', clientId: A.id, dueDate: d }).id;
  ids.fix = T.tasks.add({ title: 'Fix layout', clientId: A.id, dueDate: ad(2), stage: 'doing' }).id;
  ids.keys = T.tasks.add({ title: 'API keys', clientId: A.id, owner: 'client' }).id;
  return ids; });

test('kanban: columns by status, drag a card to In progress, regroup by due', async ({ page }) => {
  const errs = await open(page); const ids = await seed(page);
  await page.evaluate(() => location.hash = 'view-kanban');
  await expect(page.locator('.kb-col[data-col=todo] .kb-card')).toHaveCount(1);
  await expect(page.locator('.kb-col[data-col=waiting] .kb-card')).toHaveCount(1);
  await page.locator(`.kb-card[data-id="${ids.sow}"]`).dragTo(page.locator('.kb-col[data-col=doing]'));
  await expect(page.locator('.kb-col[data-col=doing] .kb-card')).toHaveCount(2);
  expect(await page.evaluate(id => window.T.tasks.get(id).stage, ids.sow)).toBe('doing');
  await page.evaluate(id => window.__kanban.move(id, 'done'), ids.fix);
  await expect(page.locator('.kb-col[data-col=done] .kb-card')).toHaveCount(1);
  await page.click('#kb-mode button[data-v=due]');
  await expect(page.locator('.kb-col[data-col=today] .kb-card')).toHaveCount(1);
  await expect(page.locator('.kb-col[data-col=none] .kb-card')).toHaveCount(1);
  expect(errs).toEqual([]);
});

test('calendar view: month and week grids, drag to reschedule, click a day to add', async ({ page }) => {
  const errs = await open(page); const ids = await seed(page);
  await page.evaluate(() => location.hash = 'view-calendar');
  await expect(page.locator('.cv-month .cv-day')).toHaveCount(42);
  const t0 = await page.evaluate(() => window.T.util.todayKey());
  await expect(page.locator(`.cv-day[data-day="${t0}"] .cv-it`)).toHaveCount(1);
  const target = await page.evaluate(() => window.T.util.ymd(window.T.util.addDays(new Date(), 1)));
  await page.locator(`.cv-it[data-id="${ids.sow}"]`).dragTo(page.locator(`.cv-month .cv-day[data-day="${target}"]`));
  await expect.poll(() => page.evaluate(id => window.T.tasks.get(id).dueDate, ids.sow)).toBe(target);
  await page.locator(`.cv-month .cv-day[data-day="${t0}"]`).click({ position: { x: 60, y: 70 } });
  await page.fill('.cv-add', 'Call the bank'); await page.press('.cv-add', 'Enter');
  await expect.poll(() => page.evaluate(d => window.T.tasks.list(t => t.title === 'Call the bank')[0]?.dueDate, t0)).toBe(t0);
  await page.click('#cv-mode button[data-v=week]');
  await expect(page.locator('.cv-col')).toHaveCount(7);
  await page.locator('.cv-it', { hasText: 'Call the bank' }).click();
  await expect(page.locator('.cv-side .task.open')).toHaveCount(1);
  expect(errs).toEqual([]);
});
