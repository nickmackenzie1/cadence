// Theme packs on demand (2026-11-18): only the pack with your theme loads with the app; the rest come when needed.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
let server, dir, B;
test.beforeAll(async () => {
  const PORT = await freePort(); dir = mkdtempSync(join(tmpdir(), 'cadence-tp-')); B = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x') }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

test('a reload brings only your theme pack; the others are listed and load when used or when the Themes page opens', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(B + '/#today');
  await expect(page.locator('#qa')).toBeVisible({ timeout: 15000 });
  const all = await page.evaluate(() => window.CadenceThemes.list().length);
  // pick a theme from the Dracula-style editor pack, then reload
  const pick = await page.evaluate(() => { const t = window.CadenceThemes.list().find(x => x.category === 'Editor'); window.CadenceThemes.apply(t.id); return t.id; });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cadence.theme.work'))).toBe(pick);
  await page.waitForTimeout(800);   // let the choice save
  await page.reload();
  await expect(page.locator('#qa')).toBeVisible({ timeout: 15000 });
  const st = await page.evaluate(() => ({ skipped: window.__cadenceBundle.skipped.filter(f => /themes-/.test(f)), cur: window.CadenceThemes.current().id, n: window.CadenceThemes.list().length, stubs: window.CadenceThemes.list().filter(t => t.stub).length }));
  expect(st.cur).toBe(pick);                                  // your theme, straight away
  expect(st.skipped.length).toBeGreaterThan(5);              // most packs stayed on the server
  expect(st.skipped).not.toContain('plugins/themes-editor.js');
  expect(st.n).toBeGreaterThanOrEqual(all - 3);               // still (nearly) every theme to choose from: a pack that makes a theme on the fly adds it once loaded
  expect(st.stubs).toBeGreaterThan(20);
  // applying a theme from a pack that isn't here fetches it
  const other = await page.evaluate(() => { const t = window.CadenceThemes.list().find(x => x.stub && x.category === 'daisyUI'); window.CadenceThemes.apply(t.id); return t.id; });
  await expect.poll(() => page.evaluate(() => window.CadenceThemes.current().id), { timeout: 10000 }).toBe(other);
  // the Themes page fetches the rest
  await page.goto(B + '/#view-themes');
  await expect.poll(() => page.evaluate(() => window.CadenceThemes.list().filter(t => t.stub).length), { timeout: 15000 }).toBe(0);
  await expect(page.locator('.th-card').first()).toBeVisible();
  expect(errs).toEqual([]);
});
