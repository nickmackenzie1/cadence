// Redraws keep what you're doing (2026-11-19): a plugin page or a dashboard card drawn again (sync, a timer, new data)
// keeps the box you're typing in (text, cursor, focus), inner scroll positions and sections you opened.
import { test, expect } from '@playwright/test';
import { createServer as netServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = netServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
let server, dir, B;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-keep-')); const PORT = await freePort(); B = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x') }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); });

const PAGE = n => `<div><input id="kp-in" value=""><div id="kp-sc" style="height:60px;overflow:auto">${'<p>line</p>'.repeat(40)}</div>
  <details id="kp-d"><summary>More</summary><p>hidden bit</p></details><p>draw ${n}</p></div>`;

test('a plugin page drawn again keeps typing, cursor, inner scroll and an opened section', async ({ page }) => {
  await page.goto(B + '/');
  await page.waitForFunction(() => window.Cadence);
  await page.evaluate(PAGE => { let n = 0; window.__pageHtml = eval(PAGE);
    Cadence.registerPlugin({ id: 'keep-test', name: 'Keep test', setup(api) { window.KT = api;
      api.views.add({ id: 'keep-test', title: 'Keep test', render: el => { el.innerHTML = window.__pageHtml(++n); } }); } }); }, PAGE.toString());
  await page.evaluate(() => { location.hash = 'view-keep-test'; });
  await expect(page.locator('#kp-in')).toBeVisible();
  await page.fill('#kp-in', 'half typed');
  await page.evaluate(() => { const i = document.getElementById('kp-in'); i.setSelectionRange(4, 4); document.getElementById('kp-sc').scrollTop = 200; document.getElementById('kp-d').open = true; });
  await page.evaluate(() => window.KT.ui.refresh());
  await expect(page.locator('#pv')).toContainText('draw 2');
  expect(await page.evaluate(() => { const i = document.getElementById('kp-in'); return [i.value, document.activeElement === i, i.selectionStart, document.getElementById('kp-sc').scrollTop, document.getElementById('kp-d').open]; }))
    .toEqual(['half typed', true, 4, 200, true]);
});

test('a dashboard card drawn again keeps typing and an opened section', async ({ page }) => {
  await page.goto(B + '/');
  await page.waitForFunction(() => window.Cadence);
  await page.evaluate(PAGE => { let n = 0; window.__pageHtml = eval(PAGE);
    Cadence.registerPlugin({ id: 'keep-card', name: 'Keep card', setup(api) { window.KC = api;
      api.widgets.add({ id: 'card', title: 'Card', render: el => { el.innerHTML = window.__pageHtml(++n); } }); } }); }, PAGE.toString());
  await page.waitForFunction(() => window.KC);
  await page.evaluate(() => { const el = document.createElement('div'); el.id = 'kc-host'; document.body.appendChild(el); window.KC.widgets.render('keep-card:card', el); });
  await page.fill('#kc-host #kp-in', 'card text');
  await page.evaluate(() => { document.querySelector('#kc-host #kp-d').open = true; window.KC.widgets.render('keep-card:card', document.getElementById('kc-host')); });
  await expect(page.locator('#kc-host')).toContainText('draw 2');
  expect(await page.evaluate(() => { const i = document.querySelector('#kc-host #kp-in'); return [i.value, document.activeElement === i, document.querySelector('#kc-host #kp-d').open]; })).toEqual(['card text', true, true]);
});
