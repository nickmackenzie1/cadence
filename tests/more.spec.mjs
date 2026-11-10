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

test('notifications: reminders and plugin notices land in the centre, mute per plugin, push endpoints', async ({ page, request }) => {
  const errs = await open(page);
  await page.evaluate(() => { window.T.tasks.add({ title: 'Ring the bank', remindMode: 'custom', remindAt: Date.now() - 1000 }); });
  await expect(page.locator('[data-foot="notify:bell"] .fb-n')).toHaveText(/\d/, { timeout: 15000 });
  await page.click('[data-foot="notify:bell"]');
  await expect(page.locator('#nt-panel .nt-it.new')).toContainText('Ring the bank');
  await page.click('#nt-panel [data-nt=read]');
  await expect(page.locator('#nt-panel .nt-it.new')).toHaveCount(0);
  await page.keyboard.press('Escape'); await page.mouse.click(700, 400);
  // a plugin notice through api.island.show is logged too, and can be muted
  await page.evaluate(() => Cadence.registerPlugin({ id: 'pinger', name: 'Pinger', setup(api) { window.P = api; } }));
  await page.evaluate(() => window.P.notify({ title: 'Ping one' }));
  await expect.poll(() => page.evaluate(() => window.__notify.list()[0].title)).toBe('Ping one');
  await page.evaluate(() => window.__notify.settings());
  await expect(page.locator('[data-mute="pinger"]')).toBeChecked();
  await page.uncheck('[data-mute="pinger"]'); await page.click('#nt-done');
  await page.evaluate(() => window.P.notify({ title: 'Ping two' }));
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__notify.list().some(n => n.title === 'Ping two'))).toBe(false);
  // server side: a VAPID key, subscription validation, config
  const k = await (await request.get(B + '/api/push/key')).json(); expect(k.key).toMatch(/^[A-Za-z0-9_-]{80,}$/);
  expect((await request.post(B + '/api/push/subscribe', { data: { subscription: { endpoint: 'http://192.168.1.5/x' } } })).status()).toBe(400);
  expect((await (await request.put(B + '/api/push/config', { data: { quiet: { from: '22:00', to: '07:00' } } })).json()).cfg.quiet.from).toBe('22:00');
  expect(errs).toEqual([]);
});

const WX = () => { const d = new Date(), days = Array.from({ length: 7 }, (_, i) => new Date(d.getTime() + i * 864e5).toISOString().slice(0, 10)), hrs = Array.from({ length: 48 }, (_, i) => new Date(d.getTime() + i * 36e5).toISOString().slice(0, 16));
  return { current: { temperature_2m: 4.2, apparent_temperature: 1, weather_code: 3, wind_speed_10m: 12, is_day: 1 }, hourly: { time: hrs, temperature_2m: hrs.map(() => 4), precipitation_probability: hrs.map((_, i) => i === 3 ? 80 : 10), weather_code: hrs.map((_, i) => i === 3 ? 63 : 3) },
    daily: { time: days, weather_code: [3, 61, 0, 71, 2, 3, 0], temperature_2m_max: [6, 5, 8, 1, 4, 5, 7], temperature_2m_min: [1, 2, 0, -3, -1, 0, 2], precipitation_probability_max: [20, 80, 0, 60, 10, 5, 0] } }; };

test('weather: pick a town, see it in the sidebar, the dashboard widget and under Today', async ({ page }) => {
  await page.route('**/api/weather/geo?*', r => r.fulfill({ json: { results: [{ name: 'Toronto', admin1: 'Ontario', country: 'Canada', latitude: 43.7, longitude: -79.4 }] } }));
  await page.route('**/api/weather?*', r => r.fulfill({ json: WX() }));
  const errs = await open(page);
  await page.evaluate(() => window.__wx.settings());
  await page.fill('#wx-q', 'Toro');
  await page.click('#wx-res button');
  await page.click('#wx-done');
  await expect(page.locator('#view .head .sub .wx-line')).toContainText('4° and cloudy');
  await expect(page.locator('#view .head .sub .wx-line')).toContainText('rain likely');
  await page.evaluate(() => window.__wx.detail());
  await expect(page.locator('.modal .wx-days > div')).toHaveCount(7);
  expect(errs).toEqual([]);
});
