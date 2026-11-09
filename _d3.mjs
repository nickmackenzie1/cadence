import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process'; import { mkdtempSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
const dir = mkdtempSync(join(tmpdir(), 'r-')), PORT = 10799, B = `http://localhost:${PORT}`;
const s = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x') }, stdio: 'ignore' });
for (let i = 0; i < 100; i++) { try { if ((await fetch(B + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', e => console.log('ERR', e.message, e.stack.split('\n').slice(0,2).join(' | ')));
await p.addInitScript(() => localStorage.setItem('cadence.reviewNudge', 'x'));
await p.goto(B + '/#today'); await p.waitForTimeout(1500);
await p.evaluate(() => Cadence.registerPlugin({ id: 'h', name: 'h', setup(api) { window.T = api; } }));
const ids = await p.evaluate(() => { const c = T.clients.add('Acme'), pr = T.clients.add('Catalyst Connect'); T.clients.update(pr.id, { kind: 'project', icon: '🚀' }); const d = T.util.todayKey();
  for (const [title, cid, owner] of [['Today task', c.id, 'me'], ['Proj task', pr.id, 'me'], ['Dev task', c.id, 'dev'], ['Inbox task', null, 'me'], ['Waiting task', c.id, 'client']]) T.tasks.add({ title, clientId: cid, owner, dueDate: d });
  return { c: c.id, pr: pr.id }; });
const disabled = await p.evaluate(() => JSON.stringify(window.T.system ? window.T.system() : {}));
for (const theme of ['cadence', 'neobrutalism']) {
  await p.evaluate(t => window.CadenceThemes && window.CadenceThemes.apply(t), theme); await p.waitForTimeout(400);
  for (const [route, title] of [['today', 'Today task'], ['client-' + ids.c, 'Today task'], ['client-' + ids.pr, 'Proj task'], ['dev', 'Dev task'], ['inbox', 'Inbox task'], ['waiting', 'Waiting task'], ['upcoming', null]]) {
    if (!title) continue;
    await p.evaluate(r => location.hash = r, route); await p.waitForTimeout(500);
    const row = p.locator('#view .task', { hasText: title }).first();
    if (!await row.count()) { console.log(theme, route, 'NO ROW'); continue; }
    await row.locator('.t-title').click(); await p.waitForTimeout(200);
    const before = await p.evaluate(t => window.T.tasks.list(x => x.title === t)[0].priority, title);
    const chip = p.locator('.task.open [data-te=prio]'); if (!await chip.count()) { console.log(theme, route, 'NO EDITOR'); continue; }
    await chip.click(); await p.waitForTimeout(150);
    const target = before === 3 ? 1 : 3;
    try { await p.locator('#pop .pop-i').nth(target).click({ timeout: 2000 }); } catch (e) { console.log(theme, route, 'POP CLICK FAIL', e.message.split('\n')[0]); }
    await p.waitForTimeout(250);
    const after = await p.evaluate(t => window.T.tasks.list(x => x.title === t)[0].priority, title);
    const shown = await p.locator('.task.open [data-te=prio]').textContent().catch(() => 'gone');
    console.log(theme, route, 'prio', before, '->', after, 'chip shows', shown.trim());
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  }
}
await b.close(); s.kill();
