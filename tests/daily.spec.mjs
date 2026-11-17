// Free daily data through the NAS (services/daily.js) against one fake server for every host, then the three plugins:
// Outside, Daily and Home helpers (dinner ideas → Kitchen, barcode → shopping list, garbage night, TV).
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

const PORT = await freePort(), FAKE = await freePort(), B = `http://localhost:${PORT}`;
let server, fake, dir;
const soon = new Date(Date.now() + 2 * 3600e3).toISOString();
const MEAL = (id, name) => ({ idMeal: id, strMeal: name, strCategory: 'Vegetarian', strArea: 'Canadian', strMealThumb: '', strInstructions: 'Chop.\nCook.', strIngredient1: 'Potatoes', strMeasure1: '4', strIngredient2: 'Cheese curds', strMeasure2: '1 cup', strSource: 'https://example.com/r' });
let mealN = 0;
const ROUTES = [
  [/^\/air-quality-api\.open-meteo\.com\//, () => ({ current: { us_aqi: 22, pm2_5: 4 }, hourly: { uv_index: [0, 1.2, 2.4, 1], grass_pollen: [null, null] } })],
  [/^\/services\.swpc\.noaa\.gov\//, () => [['time_tag', 'kp', 'observed', 'noaa_scale'], [new Date(Date.now() + 3600e3).toISOString().slice(0, 19).replace('T', ' '), '6.33', 'predicted', 'G2']]],
  [/^\/celestrak\.org\//, () => 'ISS (ZARYA)\n1 25544U 98067A   24001.50000000  .00016717  00000+0  10270-3 0  9005\n2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.49815971432010\n'],
  [/^\/en\.wikipedia\.org\/api\/rest_v1\/feed\/onthisday\//, () => ({ selected: [{ year: 1965, text: 'Something happened in Ontario.', pages: [{ title: 'X', content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/X' } } }] }] })],
  [/^\/xkcd\.com\/info\.0\.json/, () => ({ num: 3000, safe_title: 'A Comic', img: 'https://imgs.xkcd.com/comics/x.png', alt: 'the joke', year: '2026', month: '11', day: '16' })],
  [/^\/lichess\.org\/api\/puzzle\/daily/, () => ({ puzzle: { id: 'abc12', rating: 1840, plays: 9000, themes: ['endgame', 'mateIn2'] } })],
  [/^\/hacker-news\.firebaseio\.com\/v0\/topstories\.json/, () => [1, 2]],
  [/^\/hacker-news\.firebaseio\.com\/v0\/item\/(\d+)\.json/, m => ({ id: +m[1], title: 'Story ' + m[1], url: 'https://example.com/' + m[1], score: 100 + +m[1], descendants: 5 })],
  [/^\/www\.themealdb\.com\/api\/json\/v1\/1\/random\.php/, () => ({ meals: [MEAL(String(++mealN), ['Poutine', 'Butter tarts', 'Tourtière', 'Nanaimo bars'][(mealN - 1) % 4])] })],
  [/^\/world\.openfoodfacts\.org\/api\/v2\/product\/(\d+)\.json/, m => m[1] === '0064200116459' ? { status: 1, product: { product_name: 'Oat milk', brands: 'Oatly', quantity: '1.75 L' } } : { status: 0 }],
  [/^\/api\.tvmaze\.com\/search\/shows/, () => [{ show: { id: 77, name: 'Letterkenny', network: { name: 'Crave' }, premiered: '2016-02-07', status: 'Running' } }]],
  [/^\/api\.tvmaze\.com\/shows\/77/, () => ({ id: 77, name: 'Letterkenny', network: { name: 'Crave' }, _embedded: { nextepisode: { name: 'The Return', season: 13, number: 1, airstamp: soon } } })],
];

test.beforeAll(async () => {
  fake = http.createServer((req, res) => {
    for (const [re, fn] of ROUTES) { const m = req.url.match(re); if (m) { const v = fn(m); res.writeHead(200, { 'Content-Type': typeof v === 'string' ? 'text/plain' : 'application/json' }); return res.end(typeof v === 'string' ? v : JSON.stringify(v)); } }
    res.writeHead(404); res.end();
  }).listen(FAKE);
  dir = mkdtempSync(join(tmpdir(), 'cadence-daily-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, DAILY_BASE: `http://localhost:${FAKE}`, KEXP_LOG: '0', RADIO_WARM: '0' }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); fake && fake.close(); rmSync(dir, { recursive: true, force: true }); });

test('the NAS routes: outdoors, on this day, xkcd, lichess, HN, meals, food, TV', async () => {
  const j = async u => { const r = await fetch(B + u); return [r.status, await r.json()]; };
  const [s1, o] = await j('/api/daily/outdoors?lat=44.22&lon=-76.66');
  expect(s1).toBe(200);
  expect(o.air).toEqual(expect.objectContaining({ aqi: 22, aqiLabel: 'Good', uvMax: 2.4, uvLabel: 'Low', pollen: {} }));
  expect(o.aurora).toEqual(expect.objectContaining({ kpMax: 6.33, kpNeeded: 6, possible: true }));
  expect(Array.isArray(o.iss) || o.iss.error).toBeTruthy();
  expect((await j('/api/daily/outdoors?lat=999&lon=0'))[0]).toBe(400);
  expect((await j('/api/daily/onthisday'))[1][0]).toEqual(expect.objectContaining({ year: 1965, url: 'https://en.wikipedia.org/wiki/X' }));
  expect((await j('/api/daily/xkcd'))[1]).toEqual(expect.objectContaining({ num: 3000, url: 'https://xkcd.com/3000/' }));
  expect((await j('/api/daily/lichess'))[1]).toEqual(expect.objectContaining({ rating: 1840, url: 'https://lichess.org/training/abc12' }));
  expect((await j('/api/daily/hn'))[1].map(s => s.title)).toEqual(['Story 1', 'Story 2']);
  const meals = (await j('/api/daily/meals?n=2'))[1];
  expect(meals).toHaveLength(2); expect(meals[0].ingredients).toEqual(['4 Potatoes', '1 cup Cheese curds']);
  expect((await j('/api/daily/food?code=0064200116459'))[1]).toEqual(expect.objectContaining({ found: true, product: 'Oat milk', name: 'Oatly Oat milk' }));
  expect((await j('/api/daily/food?code=12'))[0]).toBe(400);
  expect((await j('/api/daily/tv?ids=77'))[1][0].next).toEqual(expect.objectContaining({ season: 13, number: 1 }));
});

test('garbage night: Loyalist east is Tuesday, west Wednesday; pickup day counts until noon', async ({ page }) => {
  await page.goto(B + '/');
  const r = await page.evaluate(() => { const { nextPickup } = window.CadenceHomeBits, f = d => d && d.toISOString().slice(0, 10);
    const mon = new Date(2026, 10, 16, 20), tueAm = new Date(2026, 10, 17, 6), tuePm = new Date(2026, 10, 17, 15);
    return [f(nextPickup({ preset: 'loyalist-east' }, mon)), f(nextPickup({ preset: 'loyalist-west' }, mon)), f(nextPickup({ preset: 'loyalist-east' }, tueAm)), f(nextPickup({ preset: 'loyalist-east' }, tuePm)), f(nextPickup({ preset: 'custom', day: 5 }, mon))]
      .map(s => s && s.slice(5)); });
  // (dates in local time; compare month-day only)
  expect(r.map(x => x && x.length)).toEqual([5, 5, 5, 5, 5]);
  expect(r[0] < r[1]).toBe(true); expect(r[2]).toBe(r[0]); expect(r[3] > r[2]).toBe(true);
});

test('Daily page and Outside page render from the NAS', async ({ page }) => {
  await page.goto(B + '/#view-daily');
  await expect(page.locator('.dy-otd')).toContainText('Something happened in Ontario.');
  await expect(page.locator('.dy-x figcaption')).toContainText('A Comic');
  await expect(page.locator('.dy-c iframe')).toHaveCount(0);                 // nothing loads from Lichess until you choose to play
  await page.route('https://lichess.org/**', r => r.fulfill({ body: '<p>board</p>', contentType: 'text/html' }));
  await page.click('[data-play-chess]');
  await expect(page.locator('.dy-c iframe')).toHaveAttribute('src', /lichess\.org\/training\/frame/);
  await expect(page.locator('.dy-c')).toContainText('Rated 1840');
  await expect(page.locator('.dy-hn li')).toHaveCount(2);
  // no section draws over another (2026-11-16: the Dashboard's own .dy-grid rules squeezed Daily's rows)
  expect(await page.locator('.dy-grid').evaluate(g => getComputedStyle(g).gridAutoRows)).toBe('auto');   // rows grow with their content
  const boxes = await page.locator('.dy-grid > section').evaluateAll(ss => ss.map(s => { const r = s.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, b] = [boxes[i], boxes[j]];
    expect(a[0] < b[2] - 1 && b[0] < a[2] - 1 && a[1] < b[3] - 1 && b[1] < a[3] - 1, `sections ${i} and ${j} overlap`).toBe(false);
  }
  await page.goto(B + '/#view-outside');
  await expect(page.locator('.od-l')).toContainText('Good');
  await expect(page.locator('.od-l')).toContainText('Possible tonight');
});

test('Home helpers: dinner idea saved to Kitchen and onto the list, barcode onto the list, a show added', async ({ page }) => {
  await page.goto(B + '/');
  await page.click('[data-act="space"][data-s="life"]');
  await page.goto(B + '/#view-home-bits');
  await expect(page.locator('.hb-meal')).toHaveCount(3);
  const name = await page.locator('.hb-meal b').first().innerText();
  await page.locator('[data-hb="save"]').first().click();
  await page.locator('[data-hb="shop"]').first().click();
  await page.fill('#hb-bc', '0064200116459'); await page.click('#hb-bc-go');
  await expect(page.locator('.hb-prod')).toContainText('Oatly Oat milk');
  await page.click('#hb-bc-add');
  await page.fill('#hb-tq', 'letterkenny'); await page.click('#hb-tgo');
  await page.locator('#hb-tres [data-add]').click();
  await expect(page.locator('.hb-tv')).toContainText('S13E1');
  // two hours from now: still today unless the test runs after 10 pm (CI runs on UTC, which is evening here)
  await expect(page.locator('.hb-tv')).toContainText(new Date(soon).toDateString() === new Date().toDateString() ? 'Tonight' : 'Tomorrow');
  // it all landed in Kitchen: the recipe, its ingredients and the scanned milk on the shopping list
  await page.goto(B + '/#view-kitchen');
  await page.click('.kt-tabs [data-t="recipes"]');
  await expect(page.locator('#view')).toContainText(name);
  await page.click('.kt-tabs [data-t="list"]');
  await expect(page.locator('#view')).toContainText('Cheese curds');
  await expect(page.locator('#view')).toContainText('Oat milk');
});
