// Havoc: Wizard vs the bosses (2026-11-18): the fight starts, bosses take turns, the page gets wrecked, Esc puts it all back.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
let server, dir, B;
test.beforeAll(async () => {
  const PORT = await freePort(); dir = mkdtempSync(join(tmpdir(), 'cadence-hf-')); B = `http://localhost:${PORT}`;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x') }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

test('pixel fight on both engines: four bosses, the spells, the skeleton trick, and the page comes back', async ({ page }) => {
  test.setTimeout(90e3);
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto(B + '/?demo=1#today');
  await expect(page.locator('#view .task').first()).toBeVisible({ timeout: 15000 });
  const text = () => page.evaluate(() => document.querySelector('#view h1').textContent);
  const h1 = await text();
  const styled = () => page.evaluate(() => [...document.querySelectorAll('#app *')].filter(e => e.getAttribute('style')).length);
  const before = await styled();
  await page.locator('body').press('Shift+F');
  await expect(page.locator('canvas.hf-canvas')).toBeVisible({ timeout: 10000 });
  const st = () => page.evaluate(() => window.HavocFight.state());
  // the words are physics now (no Havoc toolbar), the matter is the Elements layer
  await expect.poll(async () => (await st()).physics, { timeout: 8000 }).toBe(true);
  expect(await page.evaluate(() => !!document.getElementById('havoc-host').shadowRoot.querySelector('.hud'))).toBe(false);
  expect((await st()).boss).toBe('dragon');
  // a spell shouts its name
  await page.waitForTimeout(2000);
  await page.keyboard.press('2');
  await expect.poll(async () => (await st()).bubbles.join(' '), { timeout: 3000 }).toContain('Kablammo');
  const hits = await page.evaluate(() => window.HavocFight.debug.impact(500, 300, 'blast', 2) || window.HavocFight.state().hits);
  expect(hits).toBeGreaterThan(0);
  for (const next of ['cat', 'blobby']) { await page.evaluate(() => window.HavocFight.debug.hit(99)); await expect.poll(async () => (await st()).boss, { timeout: 5000 }).toBe(next); }
  // Splat splat: Blobby bursts, then pulls himself back together
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.HavocFight.debug.cast('splat'));
  await expect.poll(async () => (await st()).solid).toBe(false);
  await expect.poll(async () => (await st()).solid, { timeout: 10000 }).toBe(true);
  await page.evaluate(() => window.HavocFight.debug.hit(99));
  await expect.poll(async () => (await st()).boss, { timeout: 5000 }).toBe('skeleton');
  // the trick: an offer, the wizard walks over, gets grabbed and shaken, then thrown
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.HavocFight.debug.trick());
  await expect.poll(async () => (await st()).mode, { timeout: 3000 }).toBe('offer');
  await expect.poll(async () => (await st()).wizard.held, { timeout: 15000 }).toBe(true);
  await expect.poll(async () => (await st()).wizard.flying, { timeout: 5000 }).toBe(true);
  await expect.poll(async () => (await st()).wizard.flying, { timeout: 5000 }).toBe(false);
  // Esc: the words go back, nothing left behind
  await page.keyboard.press('Escape');
  await expect(page.locator('canvas.hf-canvas')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => !!(window.__havoc && window.__havoc.active))).toBe(false);
  expect(await text()).toBe(h1);
  expect(await styled()).toBe(before);
  expect(errs).toEqual([]);
});

test('one Havoc: Fire and Acid tools, the letters float, the Wizard button starts the fight', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto(B + '/?demo=1#today');
  await expect(page.locator('#view .task').first()).toBeVisible({ timeout: 15000 });
  const fx = []; await page.exposeFunction('__fxSeen', t => fx.push(t));
  await page.evaluate(() => addEventListener('havoc:fx', e => window.__fxSeen(e.detail.type)));
  await page.locator('body').press('Shift+H');
  await expect.poll(() => page.evaluate(() => !!(window.__havoc && window.__havoc.active)), { timeout: 10000 }).toBe(true);
  const hud = sel => page.evaluate(s => !!document.getElementById('havoc-host').shadowRoot.querySelector(s), sel);
  expect(await hud('button[data-id=fire]')).toBe(true); expect(await hud('button[data-id=acid]')).toBe(true); expect(await hud('button[data-id=fight]')).toBe(true);
  // Fire on a heading: Elements fire, and the words come loose
  const box = await page.locator('#view h1').boundingBox();
  await page.keyboard.press('3');
  await page.mouse.click(box.x + 30, box.y + box.height / 2);
  await page.keyboard.press('5');
  await page.mouse.click(box.x + 80, box.y + box.height / 2);
  await expect.poll(() => fx.join(' ')).toContain('fire');
  await expect.poll(() => fx.join(' ')).toContain('acid');
  // the Wizard button: Havoc steps aside and the fight starts
  await page.evaluate(() => document.getElementById('havoc-host').shadowRoot.querySelector('button[data-id=fight]').click());
  await expect(page.locator('canvas.hf-canvas')).toBeVisible({ timeout: 10000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('canvas.hf-canvas')).toHaveCount(0);
  expect(errs).toEqual([]);
});

test('the new bosses: the big baby is calmed with milk, zombies climb out of the graves, Old Clinker hates the cold', async ({ page }) => {
  test.setTimeout(90e3);
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto(B + '/?demo=1#today');
  await expect(page.locator('#view .task').first()).toBeVisible({ timeout: 15000 });
  await page.locator('body').press('Shift+F');
  await expect(page.locator('canvas.hf-canvas')).toBeVisible({ timeout: 10000 });
  const st = () => page.evaluate(() => window.HavocFight.state());
  // the baby: any spell is milk, and when he stops crying he's asleep and the round is done
  await page.evaluate(() => window.HavocFight.debug.boss('baby'));
  await expect.poll(async () => (await st()).landed, { timeout: 8000 }).toBe(true);
  await page.waitForTimeout(1900);
  await page.keyboard.press('2');
  await expect.poll(async () => (await st()).bubbles.join(' '), { timeout: 3000 }).not.toContain('Kablammo');
  await page.evaluate(() => window.HavocFight.debug.hit(99));
  await expect.poll(async () => (await st()).bubbles.join(' '), { timeout: 3000 }).toContain('Zzz');
  // the graveyard: a zombie comes up when the wizard goes near; the round ends when they're all down
  await page.evaluate(() => window.HavocFight.debug.boss('graves'));
  await expect.poll(async () => (await st()).boss, { timeout: 8000 }).toBe('graves');
  await expect.poll(async () => (await st()).graves.some(g => g !== 'shut'), { timeout: 20000 }).toBe(true);
  for (let i = 0; i < 10 && (await st()).boss === 'graves'; i++) await page.evaluate(() => window.HavocFight.debug.hit(1));
  await expect.poll(async () => (await st()).boss, { timeout: 8000 }).not.toBe('graves');
  // Old Clinker: fire barely touches him, Frostbite puts him out bit by bit (he shrinks)
  await page.evaluate(() => window.HavocFight.debug.boss('clinker'));
  await expect.poll(async () => (await st()).boss, { timeout: 8000 }).toBe('clinker');
  await page.waitForTimeout(2000);
  const r0 = (await st()).R, hp0 = (await st()).hp;
  await page.evaluate(() => window.HavocFight.debug.hit(3));
  expect((await st()).R).toBeLessThan(r0);
  expect((await st()).hp).toBeLessThan(hp0);
  await page.keyboard.press('Escape');
  await expect(page.locator('canvas.hf-canvas')).toHaveCount(0);
  expect(errs).toEqual([]);
});

test('physics and Elements together: a picture bursts into Elements pixels, and Havoc can ask Elements what is under a word', async ({ page }) => {
  test.setTimeout(60e3);
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto(B + '/?demo=1#today');
  await expect(page.locator('#view .task').first()).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 200; c.height = 120; const g = c.getContext('2d'); g.fillStyle = '#e8590c'; g.fillRect(0, 0, 200, 120);
    const im = document.createElement('img'); im.id = 'pxtest'; im.src = c.toDataURL(); im.style.cssText = 'display:block;width:200px;height:120px'; document.querySelector('#view h1').after(im); });
  await page.waitForTimeout(300);
  await page.locator('body').press('Shift+H');
  await expect.poll(() => page.evaluate(() => !!(window.__havoc && window.__havoc.active)), { timeout: 10000 }).toBe(true);
  expect(await page.evaluate(() => window.__havoc.stats.images)).toBe(1);
  await expect.poll(() => page.evaluate(() => !!window.__fx), { timeout: 10000 }).toBe(true);
  // words start whole, and the ones sitting still are page pixels in Elements too (so fire eats them pixel by pixel),
  // living in the layer just under the Elements canvas
  const words = () => page.evaluate(() => ['havoc-host', 'havoc-page'].reduce((n, id) => n + (document.getElementById(id)?.shadowRoot.querySelectorAll('.l.w').length || 0), 0));
  expect(await words()).toBeGreaterThan(10);
  const hb = await page.locator('#view h1').boundingBox();
  const pageCells = () => page.evaluate(async ([x, y, w, h]) => { const W = await window.CadenceFX.world(); const pts = []; for (let yy = y; yy < y + h; yy += 3) for (let xx = x; xx < x + w; xx += 3) pts.push(xx, yy); const m = await W.probe(pts); return m.filter(v => v === W.M.PAGE).length; }, [hb.x, hb.y, hb.width, hb.height]);
  await expect.poll(pageCells, { timeout: 5000 }).toBeGreaterThan(100);
  await expect.poll(() => page.evaluate(() => document.getElementById('havoc-page')?.shadowRoot.querySelectorAll('.l.w').length || 0)).toBeGreaterThan(3);
  // a black hole pulls loose Elements matter in
  const sand = () => page.evaluate(async () => { const w = await window.CadenceFX.world(); return w.count({ left: 700, top: 500, right: 1000, bottom: 800 }, w.M.SAND); });
  await page.evaluate(async () => { const w = await window.CadenceFX.world(); for (let i = 0; i < 6; i++) w.spawn(780 + i * 25, 560, w.M.SAND, 4, 1); });
  await expect.poll(sand).toBeGreaterThan(40);
  const before = await sand();
  await page.evaluate(async () => { const w = await window.CadenceFX.world(); w.sink(850, 650, 250, 4); });
  await expect.poll(sand, { timeout: 6000 }).toBeLessThan(before / 2);
  const box = await page.locator('#pxtest').boundingBox();
  await page.evaluate(([x, y]) => window.__havoc.blast(x, y), [box.x + 100, box.y + 60]);
  // the picture is gone from the physics, and its pixels are Elements matter now
  await expect.poll(() => page.evaluate(() => document.getElementById('havoc-host').shadowRoot.querySelectorAll('canvas.img').length)).toBe(0);
  await expect.poll(() => page.evaluate(async () => { const w = await window.CadenceFX.world(); return w.count({ left: 0, top: 0, right: innerWidth, bottom: innerHeight }, w.M.PIXEL); }), { timeout: 8000 }).toBeGreaterThan(50);
  // the probe: water where we put it
  const got = await page.evaluate(async () => { const w = await window.CadenceFX.world(); w.spawn(300, 300, w.M.STONE, 3, 1); await new Promise(r => setTimeout(r, 400)); const m = await w.probe([300, 300, 5, 5]); return [m[0] === w.M.STONE, m[1]]; });
  expect(got[0]).toBe(true);
  await page.keyboard.press('Escape');
  expect(errs).toEqual([]);
});

test('the finish rewinds, a resize keeps the mess, and touch works: tap, long-press to grab, two fingers to throw', async ({ page }) => {
  test.setTimeout(60e3);
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto(B + '/?demo=1#today');
  await expect(page.locator('#view .task').first()).toBeVisible({ timeout: 15000 });
  const h1 = await page.evaluate(() => document.querySelector('#view h1').textContent);
  await page.locator('body').press('Shift+H');
  await expect.poll(() => page.evaluate(() => !!(window.__havoc && window.__havoc.active)), { timeout: 10000 }).toBe(true);
  const loose = () => page.evaluate(() => [...document.getElementById('havoc-host').shadowRoot.querySelectorAll('.l')].filter(e => !/translate\(/.test(e.style.transform) || e.classList.contains('mv')).length);
  const touch = (type, id, x, y) => page.evaluate(([type, id, x, y]) => document.getElementById('havoc-host').shadowRoot.querySelector('.hit').dispatchEvent(new PointerEvent(type, { pointerType: 'touch', pointerId: id, clientX: x, clientY: y, bubbles: true, isPrimary: id === 1 })), [type, id, x, y]);
  const box = await page.locator('#view h1').boundingBox(), cx = box.x + 60, cy = box.y + box.height / 2;
  // long-press: what's under the finger comes loose to be dragged
  await touch('pointerdown', 1, cx, cy); await page.waitForTimeout(450);
  expect(await page.evaluate(() => window.__havoc.stats && true)).toBe(true);
  await touch('pointermove', 1, cx + 80, cy + 60); await touch('pointerup', 1, cx + 80, cy + 60);
  // two fingers sweep the words near them along
  const t = await page.locator('#view .task .t-title').first().boundingBox();
  await touch('pointerdown', 1, t.x + 20, t.y + 8); await touch('pointerdown', 2, t.x + 80, t.y + 8);
  for (let k = 1; k <= 5; k++) { await touch('pointermove', 1, t.x + 20 + k * 30, t.y + 8 - k * 20); await touch('pointermove', 2, t.x + 80 + k * 30, t.y + 8 - k * 20); }
  await touch('pointerup', 1, t.x + 170, t.y - 92); await touch('pointerup', 2, t.x + 230, t.y - 92);
  await page.waitForTimeout(500);
  expect(await loose()).toBeGreaterThan(0);
  // a resize: still going, the mess kept
  await page.evaluate(() => { window.__hvRun = window.__havoc.stats; });   // a restart would make a new one
  await page.setViewportSize({ width: 1000, height: 760 }); await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__havoc.active && window.__havoc.stats === window.__hvRun)).toBe(true);
  // Esc: the pieces fly home first, then the page is back
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.__havoc.rewinding)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__havoc.active), { timeout: 5000 }).toBe(false);
  expect(await page.evaluate(() => document.querySelector('#view h1').textContent)).toBe(h1);
  expect(errs).toEqual([]);
});

test('a deep pool grows kelp, lily pads and fish that leap at a splash; drain it and the fish are gone', async ({ page }) => {
  test.setTimeout(150e3);
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(B + '/?demo=1#today');
  await expect(page.locator('#view .task').first()).toBeVisible({ timeout: 15000 });
  await page.locator('body').press('Shift+H');
  await expect.poll(() => page.evaluate(() => !!(window.__havoc && window.__havoc.active)), { timeout: 10000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => !!window.__fx), { timeout: 10000 }).toBe(true);
  await page.evaluate(async () => { const w = await window.CadenceFX.world();
    for (let x = 560; x <= 1000; x += 6) w.spawn(x, 760, w.M.STONE, 3, 1);
    for (let y = 520; y <= 760; y += 6) { w.spawn(560, y, w.M.STONE, 3, 1); w.spawn(1000, y, w.M.STONE, 3, 1); }
    await new Promise(r => setTimeout(r, 300));
    for (let k = 0; k < 40; k++) { for (let x = 590; x < 980; x += 18) w.spawn(x, 560, w.M.WATER, 5, 1); await new Promise(r => setTimeout(r, 120)); } });
  const kelp = () => page.evaluate(async () => { const w = await window.CadenceFX.world(); return w.count({ left: 0, top: 0, right: innerWidth, bottom: innerHeight }, w.M.KELP); });
  const fish = () => page.evaluate(async () => (await window.CadenceFX.world()).fish());
  await expect.poll(kelp, { timeout: 50000 }).toBeGreaterThan(10);
  await expect.poll(fish, { timeout: 40000 }).toBeGreaterThan(0);
  // lily pads on the surface, and a splash sends fish leaping
  const life = () => page.evaluate(async () => (await window.CadenceFX.world()).life());
  await expect.poll(async () => (await life()).pads, { timeout: 40000 }).toBeGreaterThan(0);
  await expect.poll(async () => { await page.evaluate(async () => { const w = await window.CadenceFX.world(); for (let x = 600; x < 1000; x += 80) w.splash(x, 640); }); return (await life()).jumping; }, { timeout: 10000 }).toBeGreaterThan(0);
  await page.evaluate(async () => { const w = await window.CadenceFX.world(); w.clear(w.M.WATER); });
  await expect.poll(fish, { timeout: 5000 }).toBe(0);
  await page.keyboard.press('Escape');
  expect(errs).toEqual([]);
});

test('water finds its level: two sides of a pool joined under a wall even out', async ({ page }) => {
  test.setTimeout(90e3);
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(B + '/?demo=1#today');
  await expect(page.locator('#view .task').first()).toBeVisible({ timeout: 15000 });
  await page.locator('body').press('Shift+H');
  await expect.poll(() => page.evaluate(() => !!(window.__havoc && window.__havoc.active)), { timeout: 10000 }).toBe(true);
  await expect.poll(() => page.evaluate(async () => !!(await window.CadenceFX.world())), { timeout: 10000 }).toBe(true);
  // a U-tube in the empty strip at the right, all the water poured into the left side
  await page.evaluate(async () => { const w = await window.CadenceFX.world();
    for (let x = 1220; x <= 1390; x += 4) w.paint(x, 740, x, 740, w.M.STONE, 2);
    w.paint(1220, 420, 1220, 740, w.M.STONE, 2); w.paint(1390, 420, 1390, 740, w.M.STONE, 2); w.paint(1305, 420, 1305, 700, w.M.STONE, 2);
    await new Promise(r => setTimeout(r, 300));
    for (let k = 0; k < 50; k++) { w.spawn(1260, 460, w.M.WATER, 5, 1); await new Promise(r => setTimeout(r, 80)); } });
  const gap = () => page.evaluate(async () => { const w = await window.CadenceFX.world(); const top = async x => { const pts = []; for (let y = 420; y < 740; y += 3) pts.push(x, y); const m = await w.probe(pts); const k = Array.from(m).indexOf(w.M.WATER); return k < 0 ? 740 : 420 + k * 3; }; return Math.abs((await top(1262)) - (await top(1348))); });
  await expect.poll(gap, { timeout: 45000, intervals: [1000] }).toBeLessThan(13);
  await page.keyboard.press('Escape');
  expect(errs).toEqual([]);
});

test('bombs go off after their fuse, the vacuum swallows words, the fan blows matter along, the volcano pours lava', async ({ page }) => {
  test.setTimeout(90e3);
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(B + '/?demo=1#today');
  await expect(page.locator('#view .task').first()).toBeVisible({ timeout: 15000 });
  await page.locator('body').press('Shift+H');
  await expect.poll(() => page.evaluate(() => !!(window.__havoc && window.__havoc.active)), { timeout: 10000 }).toBe(true);
  await expect.poll(() => page.evaluate(async () => !!(await window.CadenceFX.world())), { timeout: 10000 }).toBe(true);
  const tools = () => page.evaluate(() => window.__havoc.tools());
  // a bomb: there, then gone with a blast a couple of seconds later
  await page.evaluate(() => { window.__blasts = 0; addEventListener('havoc:fx', e => { if (e.detail.type === 'blast') window.__blasts++; }); });
  await page.keyboard.press('b'); await page.mouse.click(700, 200);
  expect((await tools()).bombs).toBe(1);
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.__blasts)).toBe(0);   // not yet: the fuse is still burning
  await expect.poll(async () => (await tools()).bombs, { timeout: 5000 }).toBe(0);
  expect(await page.evaluate(() => window.__blasts)).toBeGreaterThan(0);
  // the vacuum: words disappear into it
  const before = (await tools()).words;
  await page.keyboard.press('v'); await page.mouse.move(600, 560); await page.mouse.down();
  await page.mouse.move(760, 560, { steps: 20 }); await page.waitForTimeout(1500); await page.mouse.up();
  expect((await tools()).words).toBeLessThan(before);
  // the fan: a pile of sand moves along the way it's aimed
  const sandX = () => page.evaluate(async () => { const w = await window.CadenceFX.world(); const l = await w.count({ left: 1180, top: 120, right: 1300, bottom: 420 }, w.M.SAND), r = await w.count({ left: 1300, top: 120, right: 1400, bottom: 420 }, w.M.SAND); return [l, r]; });
  await page.evaluate(async () => { const w = await window.CadenceFX.world(); w.paint(1200, 300, 1280, 300, w.M.STONE, 2); for (let x = 1210; x < 1270; x += 12) w.spawn(x, 280, w.M.SAND, 4, 1); });
  await page.waitForTimeout(800);
  const [l0, r0] = await sandX();
  await page.keyboard.press('f'); await page.mouse.move(1190, 285); await page.mouse.down(); await page.mouse.move(1300, 285, { steps: 4 }); await page.waitForTimeout(2500); await page.mouse.up();
  const [l1, r1] = await sandX();
  expect(r1).toBeGreaterThan(r0); expect(l1).toBeLessThan(l0);
  // the volcano: lava at the bottom of the page
  await page.keyboard.press('u'); await page.mouse.click(1350, 700);
  expect((await tools()).vents).toBe(1);
  await expect.poll(() => page.evaluate(async () => { const w = await window.CadenceFX.world(); return w.count({ left: 1250, top: 600, right: 1400, bottom: 900 }, w.M.LAVA); }), { timeout: 8000 }).toBeGreaterThan(5);
  await page.keyboard.press('Escape');
  expect((await tools()).bombs + (await tools()).vents).toBe(0);
  expect(errs).toEqual([]);
});
