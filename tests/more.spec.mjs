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

test('feed skins: podcast player, news front page, Letterboxd film diary', async ({ page }) => {
  const now = new Date().toUTCString();
  await page.route('**/api/feed?*', r => { const u = decodeURIComponent(r.request().url());
    if (u.includes('pod')) return r.fulfill({ json: { title: 'The Show', image: '', items: [{ title: 'Ep 1: Hello', link: 'https://x/1', date: now, audio: 'https://x/ep1.mp3', duration: '00:42:10', summary: 'We talk.' }] } });
    if (u.includes('letterboxd')) return r.fulfill({ json: { title: 'Films', items: [{ title: 'Heat, 1995 - ★★★★½', link: 'https://x/f', date: now, image: '', film: { title: 'Heat', year: '1995', rating: 4.5, rewatch: true, liked: true, watched: '2026-11-01' } }] } });
    return r.fulfill({ json: { title: 'News', items: [{ title: 'Big story - Paper', link: 'https://x/n1', date: now, source: 'Paper', summary: 'Things happened.' }, { title: 'Small story - Other', link: 'https://x/n2', date: now, source: 'Other' }] } }); });
  const errs = await open(page);
  await page.evaluate(() => location.hash = 'view-feeds');
  for (const [u, style] of [['https://example.com/pod.xml', 'podcast'], ['https://letterboxd.com/me/rss/', 'films'], ['https://example.com/news.xml', 'news']]) {
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true, bubbles: true })));
    await page.keyboard.type('Manage feeds'); await page.keyboard.press('Enter');
    await page.fill('#rs-url', u); await page.click('#rs-add');
    await expect(page.locator('.rs-feedcfg').last().locator('select[data-k=style]')).toHaveValue(style);
    await page.click('#rs-save');
  }
  await expect(page.locator('.rs-pod')).toHaveCount(1);
  await expect(page.locator('.rs-news .lead')).toContainText('Big story');
  await expect(page.locator('.rs-film .st')).toContainText('★★★★½');
  await page.click('.rs-play');
  await expect(page.locator('#rs-player.on b')).toHaveText('Ep 1: Hello');
  expect(errs.filter(e => !/play|media|NotSupported/i.test(e))).toEqual([]);
});

test('desk toys: aquarium fish from focus, invoice radar, desk plant grows, weekly rewind', async ({ page }) => {
  const errs = await open(page);
  // aquarium
  await page.evaluate(() => window.__aqua.start(25));
  expect(await page.evaluate(() => !!localStorage.getItem('cadence.focus'))).toBe(true);
  await page.evaluate(() => window.__aqua.finishNow());
  await page.evaluate(() => location.hash = 'view-aquarium');
  await expect(page.locator('.aq-list span')).toHaveCount(1);
  await expect(page.locator('.aq canvas')).toHaveCount(1);
  // invoice radar
  await page.evaluate(() => { const c = window.T.clients.add('Billco'); for (const t of ['Build report', 'Fix sync']) { const x = window.T.tasks.add({ title: t, clientId: c.id }); window.T.tasks.complete(x.id); } location.hash = 'view-invoices'; });
  await expect(page.locator('.ir-row', { hasText: 'Billco' })).toContainText('2 done');
  await page.locator('.ir-row', { hasText: 'Billco' }).locator('[data-inv]').click();
  await expect(page.locator('.ir-row', { hasText: 'Billco' })).toHaveCount(0);
  // plant: two completions above, plus one more
  expect(await page.evaluate(() => { const x = window.T.tasks.add({ title: 'Water me' }); window.T.tasks.complete(x.id); return 1; })).toBe(1);
  // rewind
  await page.evaluate(() => window.__rewind.show());
  await expect(page.locator('#rw-ov h2').first()).toHaveText(/\d+/);
  for (let i = 0; i < 6; i++) { if (!(await page.locator('#rw-ov').count())) break; await page.click('#rw-ov [data-rw=next]'); }
  await expect(page.locator('#rw-ov')).toHaveCount(0);
  expect(errs).toEqual([]);
});

test('games: roulette picks a task and locks, rival keeps score, quests unlock steps, bucket list sorts by years left', async ({ page }) => {
  const errs = await open(page);
  await page.evaluate(() => { for (const t of ['Alpha', 'Beta', 'Gamma']) window.T.tasks.add({ title: t }); window.__roulette.spin(); });
  await page.click('#rl-go');
  await expect(page.locator('#rl-res b')).toHaveText(/Alpha|Beta|Gamma/, { timeout: 8000 });
  await page.click('#rl-go');   // "Do it"
  await page.evaluate(() => window.__roulette.spin());
  await expect(page.locator('#rl-go')).toBeDisabled();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => typeof window.__rival.rival())).toBe('number');
  // quests
  await page.evaluate(() => window.__quests.start('run'));
  const first = await page.evaluate(() => window.T.tasks.list(t => t.quest && !t.done).map(t => t.title));
  expect(first).toEqual(['Walk 30 minutes, 3 times']);
  await page.evaluate(() => { const t = window.T.tasks.list(t => t.quest && !t.done)[0]; window.T.tasks.complete(t.id); });
  expect(await page.evaluate(() => window.T.tasks.list(t => t.quest && !t.done).map(t => t.title))).toEqual(['Run/walk intervals for a week']);
  await page.evaluate(() => location.hash = 'view-quests');
  await expect(page.locator('.qn.done')).toHaveCount(1);
  await expect(page.locator('.qn.open')).toHaveCount(1);
  // bucket list (Life only)
  await page.mouse.click(700, 300); await page.keyboard.press('Shift+L');
  await expect(page.locator('html[data-space=life]')).toHaveCount(1);
  await page.evaluate(() => location.hash = 'view-bucket');
  await page.fill('#bk-born', '1985'); await page.click('#bk-save');
  for (const [t, p] of [['See the northern lights', '1'], ['Climb Kilimanjaro', '3']]) { await page.fill('#bk-t', t); await page.selectOption('#bk-p', p); await page.click('#bk-go'); }
  await expect(page.locator('.bk-it b').first()).toHaveText('Climb Kilimanjaro');
  await expect(page.locator('.bk-txt b')).toHaveText(/\d/);
  expect(errs).toEqual([]);
});

test('mindset: forecast chips, done-list mode, future-you note on the second push, regret minimizer', async ({ page }) => {
  const errs = await open(page);
  const ad = n => page.evaluate(n => window.T.util.ymd(window.T.util.addDays(new Date(), n)), n);
  const id = await page.evaluate(async d => window.T.tasks.add({ title: 'Do the taxes', dueDate: d, createdAt: Date.now() - 20 * 864e5 }).id, await ad(0));
  // first push: no question (default asks from the second); second push: the note
  await page.evaluate(async ([id, d]) => window.T.tasks.update(id, { dueDate: d }), [id, await ad(1)]);
  await page.waitForTimeout(100);
  expect(await page.locator('#fy-n').count()).toBe(0);
  await page.evaluate(async ([id, d]) => window.T.tasks.update(id, { dueDate: d }), [id, await ad(3)]);
  await page.fill('#fy-n', 'Waiting on the T4 slip'); await page.click('#fy-ok');
  expect(await page.evaluate(id => window.T.tasks.get(id).excuses[0].note, id)).toBe('Waiting on the T4 slip');
  // forecast: pushed twice and old, so it gets a chip
  expect(await page.evaluate(id => window.__forecast.chance(window.T.tasks.get(id)), id)).toBeLessThan(.7);
  await page.evaluate(() => location.hash = 'upcoming');
  await expect(page.locator('.fc-chip').first()).toContainText('%');
  // regret
  await page.evaluate(() => window.__regret.ask());
  await page.locator('.rg', { hasText: 'Do the taxes' }).locator('input').check(); await page.click('#rg-ok');
  expect(await page.evaluate(id => window.T.tasks.get(id).tags, id)).toContain('regret');
  // done-list
  await page.evaluate(() => { const x = window.T.tasks.add({ title: 'Answered the email' }); window.T.tasks.complete(x.id); window.__donelist.set(true); });
  await expect(page.locator('.dl h1')).toHaveText('Look what you’ve done');
  await expect(page.locator('.dl-it')).toContainText(['Answered the email']);
  await page.click('#dl-off');
  await expect(page.locator('.dl')).toHaveCount(0);
  expect(errs).toEqual([]);
});

test('accountability: grandma visits about overdue work, stakes are won and lost, the Cliq ledger keeps its token on the NAS', async ({ page, request }) => {
  const errs = await open(page);
  const past = await page.evaluate(() => window.T.util.ymd(window.T.util.addDays(new Date(), -3)));
  const id = await page.evaluate(d => window.T.tasks.add({ title: 'Call the dentist', dueDate: d }).id, past);
  const line = await page.evaluate(() => window.__grandma.visit(true));
  expect(line).toContain('Call the dentist');
  // stakes: a won stake and a lost one
  const fut = await page.evaluate(() => window.T.util.ymd(window.T.util.addDays(new Date(), 2)));
  const won = await page.evaluate(d => window.T.tasks.add({ title: 'Ship the report', dueDate: d }).id, fut);
  await page.evaluate(id => window.__stakes.stake(window.T.tasks.get(id)), won);
  await page.fill('#sk-a', '50'); await page.fill('#sk-c', 'The Leafs'); await page.click('#sk-ok');
  await page.evaluate(() => location.hash = 'upcoming');
  await expect(page.locator('.sk-chip')).toContainText('$50 at stake');
  await page.evaluate(id => window.T.tasks.complete(id), won);
  expect(await page.evaluate(id => window.T.tasks.get(id).stake.status, won)).toBe('safe');
  await page.evaluate(id => window.T.tasks.update(id, { stake: { amount: 10, cause: 'Spam', status: 'live' } }), id);
  await page.evaluate(() => window.__stakes.judge());
  await expect(page.locator('.modal')).toContainText('You owe $10 to Spam');
  // ledger: text and the server keeping the token to itself
  expect(await page.evaluate(() => window.__ledger.text())).toContain('Call the dentist');
  await request.put(B + '/api/cliq/config', { data: { channel: 'team', dc: 'ca', zapikey: 'secret123' } });
  const cfg = await (await request.get(B + '/api/cliq/config')).json();
  expect(cfg).toEqual({ channel: 'team', dc: 'ca', hasKey: true });
  expect(errs).toEqual([]);
});

test('routines: energy check-in tucks hard tasks away, places from quick add, rituals install and share', async ({ page }) => {
  const errs = await open(page);
  await page.fill('#qa', 'Write the Q4 proposal ~hard'); await page.press('#qa', 'Enter');
  await page.fill('#qa', 'Reply to Sam'); await page.press('#qa', 'Enter');
  await page.fill('#qa', 'Buy lightbulbs at the hardware store'); await page.press('#qa', 'Enter');
  expect(await page.evaluate(() => window.T.tasks.list(t => t.title === 'Write the Q4 proposal')[0].effort)).toBe('hard');
  expect(await page.evaluate(() => window.T.tasks.list(t => /lightbulbs/.test(t.title))[0].place)).toBe('hardware store');
  await page.click('.en-ban [data-lv=low]');
  await expect(page.locator('.en-ban.low')).toContainText('1 hard task');
  await expect(page.locator('.task', { hasText: 'Write the Q4 proposal' })).toBeHidden();
  await page.click('.en-ban [data-lv=show]');
  await expect(page.locator('.task', { hasText: 'Write the Q4 proposal' })).toBeVisible();
  await page.evaluate(() => location.hash = 'view-places');
  await expect(page.locator('#view')).toContainText('hardware store');
  // rituals
  await page.evaluate(() => location.hash = 'view-rituals');
  await page.click('[data-in="weekly-review"]');
  expect(await page.evaluate(() => window.T.tasks.list(t => t.ritual === 'weekly-review' && t.repeat).length)).toBe(4);
  await page.click('[data-un="weekly-review"]');
  expect(await page.evaluate(() => window.T.tasks.list(t => t.ritual === 'weekly-review' && !t.done).length)).toBe(0);
  await page.click('#rt-imp');
  await page.fill('#ri-t', JSON.stringify({ cadenceRitual: 1, id: 'friday', name: 'Friday shutdown', tasks: [['Close all tabs', { unit: 'week', n: 1, day: 5 }]] }));
  await page.click('#ri-go');
  await expect(page.locator('.rt-card.on', { hasText: 'Friday shutdown' })).toHaveCount(1);
  expect(errs).toEqual([]);
});

test('kitchen: recipe from a link, plan it, shopping list by aisle, groceries task', async ({ page }) => {
  await page.route('**/api/recipe?*', r => r.fulfill({ json: { url: 'https://blog.example/tacos', name: 'Fish tacos', image: '', servings: 4, minutes: 30, site: 'blog.example',
    ingredients: ['1 lb cod', '8 tortillas', '1 lime', '1/2 cup sour cream', '2 cups cabbage'], steps: ['Season the fish', 'Grill it', 'Assemble'] } }));
  const errs = await open(page);
  await page.mouse.click(700, 300); await page.keyboard.press('Shift+L');
  await expect(page.locator('html[data-space=life]')).toHaveCount(1);
  await page.evaluate(() => location.hash = 'view-kitchen');
  await page.click('.kt-tabs [data-t=recipes]');
  await page.fill('#kr-url', 'https://blog.example/tacos'); await page.click('#kr-go');
  await expect(page.locator('.modal')).toContainText('Season the fish');
  await page.click('#kr-body [data-k="1"]'); await page.click('#kr-body [data-k="1"]'); await page.click('#kr-body [data-k="1"]'); await page.click('#kr-body [data-k="1"]');
  await expect(page.locator('#kr-body li').first()).toHaveText('2 lb cod');
  await page.click('#kr-shop');
  await page.keyboard.press('Escape');
  await page.click('.kt-tabs [data-t=list]');
  await expect(page.locator('.kl-g', { hasText: 'Meat & fish' })).toContainText('2 lb cod');
  await expect(page.locator('.kl-g', { hasText: 'Produce' })).toContainText('lime');
  await page.click('#kl-task');
  expect(await page.evaluate(() => window.T.tasks.list(t => /^Groceries/.test(t.title)).length)).toBe(1);
  // plan
  await page.click('.kt-tabs [data-t=plan]');
  const t0 = await page.evaluate(() => window.T.util.todayKey());
  const cell = page.locator(`.kp-cell[data-d="${t0}"][data-m=dinner] input`);
  await cell.fill('Fish tacos'); await cell.press('Enter');
  await expect(page.locator(`.kp-cell[data-d="${t0}"][data-m=dinner] .nm`)).toHaveText('Fish tacos');
  expect(errs).toEqual([]);
});
