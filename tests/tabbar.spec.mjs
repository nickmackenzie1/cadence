// Phones: a tab bar along the bottom (Today, Upcoming, Add, Search, Menu). Desktop doesn't show it.
import { test, expect, devices } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
let server, dir, B;
test.beforeAll(async () => {
  const PORT = await freePort(); dir = mkdtempSync(join(tmpdir(), 'cadence-tab-')); B = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

test.describe('on a phone', () => {
  const { defaultBrowserType, ...phone } = devices['Pixel 7'];
  test.use(phone);
  test('the tab bar moves around, adds, searches and opens the menu', async ({ page }) => {
    await page.goto(B + '/#today');
    await expect(page.locator('#sync')).toContainText('NAS', { timeout: 10000 });
    const bar = page.locator('#tabbar');
    await expect(bar).toBeVisible();
    await expect(page.locator('#nav-btn')).toBeHidden();                       // the menu lives in the bar now
    await expect(bar.locator('[data-tb=today]')).toHaveClass(/on/);
    await bar.locator('[data-tb=upcoming]').tap();
    await expect(page).toHaveURL(/#upcoming$/);
    await expect(bar.locator('[data-tb=upcoming]')).toHaveClass(/on/);
    // Add: back to Today with quick add ready to type
    await bar.locator('[data-tb=add]').tap();
    await expect(page).toHaveURL(/#today$/);
    await expect(page.locator('#qa')).toBeFocused();
    // nothing at the bottom of the page hides behind the bar
    const room = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.wrap')).paddingBottom));
    expect(room).toBeGreaterThan(await bar.evaluate(b => b.getBoundingClientRect().height));
    // Search opens ⌘K (and the bar steps aside while it's open)
    await bar.locator('[data-tb=search]').tap();
    await expect(page.locator('#pal-in')).toBeVisible();
    await expect(bar).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(bar).toBeVisible();
    // Menu opens the slide-over sidebar
    await bar.locator('[data-tb=menu]').tap();
    await expect(page.locator('body')).toHaveClass(/nav-open/);
    await expect(bar.locator('[data-tb=menu]')).toHaveClass(/on/);
    await page.locator('#side a[href="#upcoming"]').tap();
    await expect(page.locator('body')).not.toHaveClass(/nav-open/);
  });
});

test('desktop has no tab bar', async ({ page }) => {
  await page.goto(B + '/#today');
  await expect(page.locator('#sync')).toContainText('NAS', { timeout: 10000 });
  await expect(page.locator('#tabbar')).toBeHidden();
});
