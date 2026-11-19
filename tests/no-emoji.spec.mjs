// No emoji in the UI (CLAUDE.md rule; user, 2026-11-18: "all emojis"). Every page in both spaces with the plugins on,
// every Settings tab and ⌘K are read for emoji left in text, tooltips, placeholders, labels and the tab title.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net'; import { spawn } from 'node:child_process'; import { mkdtempSync, rmSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
test('no emoji anywhere on screen: every page in both spaces, every Settings tab, and ⌘K', async ({ page }) => {
  test.setTimeout(240000);
  const PORT = await freePort(), B = `http://localhost:${PORT}`;
  const dir = mkdtempSync(join(tmpdir(), 'cadence-emoji-')), server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  await page.addInitScript(() => { localStorage.setItem('cadence.off.work', '[]'); localStorage.setItem('cadence.off.life', '[]'); });
  const found = new Map();
  const scan = async where => {
    const r = await page.evaluate(() => {
      const RE = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*/gu, out = [];
      const w = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
      let n; while ((n = w.nextNode())) { const p = n.parentElement; if (!p || p.closest('script,style,textarea,[contenteditable="true"],.keep-emoji')) continue;
        const cs = getComputedStyle(p); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        for (const m of n.nodeValue.matchAll(RE)) out.push([m[0], 'text', n.nodeValue.trim().slice(0, 60), p.closest('[id]') ? p.closest('[id]').id : p.tagName]); }
      for (const el of document.querySelectorAll('[title],[placeholder],[aria-label]')) for (const a of ['title', 'placeholder', 'aria-label']) { const v = el.getAttribute(a); if (v) for (const m of v.matchAll(RE)) out.push([m[0], a, v.slice(0, 60), el.closest('[id]') ? el.closest('[id]').id : el.tagName]); }
      if (RE.test(document.title)) out.push(['?', 'document.title', document.title, '']);
      return out; });
    for (const [e, kind, ctx, id] of r) { const k = e + ' ' + kind + ' ' + ctx; if (!found.has(k)) found.set(k, where + ' #' + id); }
  };
  for (const sp of ['work', 'life']) {
    await page.goto(B + '/#today'); await expect(page.locator('#sync')).toBeVisible({ timeout: 10000 });
    if (sp === 'life') { await page.locator('#side-head [data-act=space][data-s=life]').click(); await page.waitForTimeout(1500); }
    const routes = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href')).filter(h => /^#[a-z]/.test(h)))]);
    for (const r of routes) { await page.evaluate(h => { location.hash = h; }, r); await page.waitForTimeout(500); await scan(sp + ' ' + r); }
    await page.evaluate(() => document.querySelector('[data-act=settings]').click()); await page.waitForTimeout(500);
    const tabs = await page.locator('.modal [data-act=set-tab]').count();
    for (let i = 0; i < tabs; i++) { await page.locator('.modal [data-act=set-tab]').nth(i).click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(500); await scan(sp + ' settings ' + i); }
    await page.keyboard.press('Escape'); await page.keyboard.press('Meta+k'); await page.keyboard.press('Control+k'); await page.waitForTimeout(500); await scan(sp + ' palette'); await page.keyboard.press('Escape');
  }
  // and the swapper itself: a mapped emoji becomes its icon, any other is left out, tooltips lose theirs, outside <body> too
  await page.evaluate(() => { const d = document.createElement('div'); d.innerHTML = '<span id="ea">\u{1F3E0} home</span><span id="eb">\u{1F9A9} bird</span><button id="ec" title="\u{1F525} hot">x</button>'; document.body.appendChild(d);
    const o = document.createElement('div'); o.id = 'ed'; o.textContent = '\u{1F3A7} out'; document.documentElement.appendChild(o); });
  await expect(page.locator('#ea svg.lu')).toHaveCount(1); await expect(page.locator('#eb')).toHaveText('bird');
  await expect(page.locator('#ec')).toHaveAttribute('title', 'hot'); await expect(page.locator('#ed svg.lu')).toHaveCount(1);
  server.kill(); rmSync(dir, { recursive: true, force: true });
  expect([...found].map(([k, w]) => k + '   @ ' + w)).toEqual([]);
});
