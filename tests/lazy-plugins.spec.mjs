// Only the plugins you use are downloaded: files whose plugins are off in both spaces stay on the server, show as
// placeholders in Settings → Plugins, and are fetched the moment you switch one on (or move to a space that uses it).
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
  dir = mkdtempSync(join(tmpdir(), 'cadence-lazy-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'tls'), HTTPS: 'off' }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

const synced = page => expect(page.locator('#sync')).toContainText('NAS', { timeout: 8000 });
const loaded = (page, f) => page.evaluate(f => !!document.querySelector(`script[data-src="${f}"]`), f);

test('switched-off plugins stay on the server until you switch them on', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  // first visit: nothing saved in this browser yet, so everything loads
  await page.goto(B + '/'); await synced(page);
  expect(await page.evaluate(() => window.__cadenceBundle.skipped)).toEqual([]);
  expect(await loaded(page, 'plugins/haunted.js')).toBe(true);
  await page.fill('#qa', 'Something to save'); await page.keyboard.press('Escape'); await page.focus('#qa'); await page.press('#qa', 'Enter');   // the saved copy is written on the first change
  await expect.poll(() => page.evaluate(() => !!localStorage.getItem('cadence.v1'))).toBe(true);
  await page.waitForTimeout(1200);   // let the push land

  // second visit: Haunted is off in Work (and Life is unopened here), so its file isn't downloaded or run
  await page.reload(); await synced(page);
  const skipped = await page.evaluate(() => window.__cadenceBundle.skipped);
  expect(skipped).toContain('plugins/haunted.js');
  expect(skipped).not.toContain('plugins/island.js');          // other code leans on it
  expect(await loaded(page, 'plugins/haunted.js')).toBe(false);
  expect(await loaded(page, 'plugins/rss.js')).toBe(true);       // switched on: loaded as before

  // it still shows in Settings → Plugins, and switching it on fetches it
  await page.goto(B + '/#plugins'); await synced(page);
  await page.click('[data-act=pl-tab][data-t=all]');
  const card = page.locator('.pl-card[data-pid="haunted"]'); await expect(card).toBeVisible(); await expect(card).toHaveClass(/off/);
  const got = page.waitForResponse(r => /bundle\.js\?.*only=plugins%2Fhaunted\.js/.test(r.url()));
  await card.click(); await page.locator('.pb-dbtns [data-act=toggle-plugin][data-pid="haunted"]').click();
  expect((await got).ok()).toBe(true);
  await expect.poll(() => loaded(page, 'plugins/haunted.js')).toBe(true);
  await expect(page.locator('.pl-card[data-pid="haunted"]')).not.toHaveClass(/off/);

  // the page only ever references the bundle, and the skipped bundle really is smaller
  const full = (await (await fetch(`${B}/bundle.js`)).text()).length, part = (await (await fetch(`${B}/bundle.js?skip=plugins/haunted.js,plugins/mural.js`)).text()).length;
  expect(part).toBeLessThan(full);
  expect(errs).toEqual([]);
});

test('moving to a space that uses a left-out plugin fetches it', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(B + '/'); await synced(page);
  await page.fill('#qa', 'Another thing'); await page.keyboard.press('Escape'); await page.focus('#qa'); await page.press('#qa', 'Enter'); await page.waitForTimeout(1200);
  // Homeowner is a Life plugin; Life hasn't been opened in this browser, so it's left out
  await page.evaluate(() => { localStorage.removeItem('cadence.life.v1'); }); await page.reload(); await synced(page);
  expect(await page.evaluate(() => window.__cadenceBundle.skipped)).toContain('plugins/homeowner.js');
  await page.locator('.space-sw [role=tab]', { hasText: 'Life' }).click();
  await expect.poll(() => loaded(page, 'plugins/homeowner.js'), { timeout: 8000 }).toBe(true);
  expect(errs).toEqual([]);
});
