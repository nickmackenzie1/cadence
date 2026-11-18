// Swipe on phones: right completes a task (with Undo), left snoozes it to tomorrow (with Undo); a short or vertical
// move does nothing, and the swipe doesn't open the task.
import { test, expect, devices } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
let server, dir, B;
test.beforeAll(async () => {
  const PORT = await freePort(); dir = mkdtempSync(join(tmpdir(), 'cadence-swipe-')); B = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });
const { defaultBrowserType, ...phone } = devices['Pixel 7'];
// the toast with this text, and its Undo pressed at once (a slow test machine can outlast the toast; a person doesn't)
const undoAfter = (page, re) => expect.poll(() => page.evaluate(src => {
  const re = new RegExp(src), box = [...document.querySelectorAll('.toast, .isl-pill, [class*=toast]')].find(x => re.test(x.textContent || ''));
  const b = box && [...box.querySelectorAll('button, [role=button], a, span')].find(x => x.textContent.trim() === 'Undo');
  if (!b) return false; b.click(); return true;
}, re.source), { intervals: [30], timeout: 8000 }).toBe(true);
test.use(phone);

// a finger moving across the screen, in small steps
async function swipe(page, el, dxTotal, dyTotal = 0) {
  const b = await el.boundingBox(), cdp = await page.context().newCDPSession(page);
  const x0 = b.x + b.width / 2, y0 = b.y + b.height / 2, steps = 12;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + dxTotal * i / steps, y: y0 + dyTotal * i / steps }] }); await page.waitForTimeout(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

test('swipe right completes, swipe left snoozes, both can be undone', async ({ page }) => {
  await page.goto(B + '/#today');
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 10000 });
  await page.evaluate(() => Cadence.registerPlugin({ id: 'test-hook', name: 'test', setup(api) { window.T = api; } }));
  const today = await page.evaluate(() => window.T.util.todayKey());
  // names of its own each run (a second push of the same task asks for a note to future you: the Future-you plugin)
  const n = Math.random().toString(36).slice(2, 6);
  await page.evaluate(([d, n]) => { window.T.tasks.add({ title: `Water the plants ${n}`, dueDate: d }); window.T.tasks.add({ title: `Call the bank ${n}`, dueDate: d }); window.T.tasks.add({ title: `Read a chapter ${n}`, dueDate: d }); window.T.tasks.add({ title: `Pay the rent ${n}`, dueDate: d }); window.T.ui.refresh(); }, [today, n]);
  const row = t => page.locator('#view .task', { hasText: t });
  await expect(row(`Water the plants ${n}`)).toBeVisible();
  const W = (await row(`Water the plants ${n}`).boundingBox()).width;

  // right: done (the toast says so), and its Undo, pressed straight away, reopens it
  await swipe(page, row(`Water the plants ${n}`), W * 0.6);
  await undoAfter(page, new RegExp('Completed .Water the plants ' + n));
  await expect.poll(() => page.evaluate(n => window.T.tasks.list(t => t.title === `Water the plants ${n}`)[0].done, n)).toBe(false);
  await expect(page.locator('.drawer.open')).toHaveCount(0);                     // the swipe didn't open the task

  // left: snoozed to tomorrow, and Undo puts it back on today
  const due = () => page.evaluate(n => window.T.tasks.list(t => t.title === `Call the bank ${n}`)[0].dueDate, n);
  await swipe(page, row(`Call the bank ${n}`), -W * 0.6);
  await undoAfter(page, new RegExp('Snoozed .Call the bank ' + n + '. to tomorrow'));
  await expect.poll(due).toBe(today);
  // and without Undo it goes to tomorrow, off Today (another task: a second push of the same one asks for a note)
  const due2 = () => page.evaluate(n => window.T.tasks.list(t => t.title === `Pay the rent ${n}`)[0].dueDate, n);
  await swipe(page, row(`Pay the rent ${n}`), -W * 0.6);
  await expect.poll(due2).toBe(await page.evaluate(() => window.T.util.ymd(window.T.util.addDays(new Date(), 1))));
  await expect(row(`Pay the rent ${n}`)).toHaveCount(0);
  // and a swipe right without Undo completes
  await swipe(page, row(`Water the plants ${n}`), W * 0.6);
  await expect.poll(() => page.evaluate(n => window.T.tasks.list(t => t.title === `Water the plants ${n}`)[0].done, n)).toBe(true);

  // a short swipe springs back; a vertical drag scrolls; neither changes anything
  await swipe(page, row(`Read a chapter ${n}`), W * 0.15);
  await swipe(page, row(`Read a chapter ${n}`), 10, 120);
  await page.waitForTimeout(400);
  expect(await page.evaluate(n => { const t = window.T.tasks.list(t => t.title === `Read a chapter ${n}`)[0]; return [t.done, t.dueDate]; }, n)).toEqual([false, today]);
  await expect.poll(() => row(`Read a chapter ${n}`).evaluate(e => e.getAttribute('style') || '')).not.toMatch(/translate/);   // sprang back
});
