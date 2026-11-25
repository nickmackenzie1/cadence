// Phones: the secure-address guide, sticky headers below the Island, and room to tap a task (2026-11-24).
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
let server, dir, B;
test.beforeAll(async () => {
  const PORT = await freePort(); dir = mkdtempSync(join(tmpdir(), 'cadence-phone-')); B = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x') }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });


test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('a phone on the plain address: the guide says what https unlocks, and that the NAS has no secure address yet', async ({ page }) => {
  const h = await (await fetch(B + '/api/health')).json();
  expect(h.httpsReady).toBe(false); expect(h.httpsPort).toBeGreaterThan(0);
  await page.goto(B + '/#today'); await expect(page.locator('#qa')).toBeVisible({ timeout: 15000 });
  await page.keyboard.press('Control+k'); await page.locator('#pal-in').fill('secure address'); await page.keyboard.press('Enter');
  const m = page.locator('#modal');
  await expect(m).toContainText('Set up this phone');
  await expect(m).toContainText("isn't serving THING's secure address yet");
});

test('sticky headers sit below the Island; the task circle answers a tap beside it', async ({ page }) => {
  await page.goto(B + '/#today'); await expect(page.locator('#qa')).toBeVisible({ timeout: 15000 });
  expect(await page.evaluate(() => (() => { const d = document.createElement('div'); d.style.height = 'var(--sticky-top)'; document.body.append(d); const h = d.offsetHeight; d.remove(); return h; })())).toBeGreaterThanOrEqual(48);
  await page.fill('#qa', 'Water the plants today'); await page.press('#qa', 'Enter');
  const c = page.locator('#view .task', { hasText: 'Water the plants' }).locator('.check');
  await expect(c).toBeVisible();
  const b = await c.boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2 + 15, b.y + b.height / 2);
  await expect(page.locator('#view .task.done', { hasText: 'Water the plants' }).or(page.getByText('Completed “Water the plants”'))).not.toHaveCount(0);
});
