// Following artists: follow from an artist page, notes about what's new (here: a station of yours playing them), the
// Following list in Music → Artists, "mark as seen", and following a mainstream artist takes them off that list.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const PORT = await freePort(), B = `http://localhost:${PORT}`;
let server, dir;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-follow-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x'), RADAR_DATA: join(dir, 'radar'), RADAR_DB: join(dir, 'cadence.db'),
    RADAR_MB: '0', KEXP_LOG: '0', RADIO_WARM: '0', RADIO_HISTORY: '0', STG: '0', KINGSTONLIVE: '0', ANTHROPIC_API_KEY: '' }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });
const post = (p, b) => fetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json());

test('following a mainstream artist takes them off the mainstream list', async () => {
  expect((await post('/api/radar/community', {})).mainstream.list).toContain('Taylor Swift');
  const r = await post('/api/radar/follow', { add: 'Taylor Swift' });
  expect(r.follows.map(f => f.name)).toContain('Taylor Swift');
  expect((await (await fetch(B + '/api/radar/community', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json()).mainstream.list).not.toContain('Taylor Swift');
  await post('/api/radar/follow', { remove: 'Taylor Swift' });
});

test('follow from the artist page; a station playing them becomes a note, listed under Following until seen', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => localStorage.setItem('cadence.reviewNudge', (d => { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })(new Date())));
  await page.goto(B + '/'); await expect(page.locator('#sync')).toContainText('NAS', { timeout: 10000 });
  await page.evaluate(() => { window.CadenceArtist.open('Jay Som'); location.hash = 'view-artist'; });
  const btn = page.locator('[data-follow="Jay Som"]');
  await expect(btn).toHaveText('Follow');
  await btn.click();
  await expect(page.locator('[data-follow="Jay Som"]')).toHaveText('Following');
  const song = 'Superbike ' + Math.random().toString(36).slice(2, 6);   // new each run: the island doesn't repeat an identical note
  // CFRC (a station whose history is kept) plays them after you followed (a second later: times are whole seconds)
  await new Promise(r => setTimeout(r, 1200));
  const r = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '-e', `
    const { DatabaseSync } = require('node:sqlite'); const d = new DatabaseSync(${JSON.stringify(join(dir, 'cadence.db'))});
    d.exec("CREATE TABLE IF NOT EXISTS radio_plays (id INTEGER PRIMARY KEY AUTOINCREMENT, station TEXT NOT NULL, at INTEGER NOT NULL, artist TEXT, song TEXT, raw TEXT); CREATE TABLE IF NOT EXISTS radio_follow (station TEXT PRIMARY KEY, name TEXT, url TEXT, since INTEGER);");
    d.prepare('INSERT OR REPLACE INTO radio_follow VALUES (?,?,?,?)').run('cfrc', 'CFRC 101.9', null, 1);
    d.prepare('INSERT INTO radio_plays (station, at, artist, song, raw) VALUES (?,?,?,?,?)').run('cfrc', Math.round(Date.now() / 1000), 'Jay Som', ${JSON.stringify(song)}, 'Jay Som - ' + ${JSON.stringify(song)});`], { encoding: 'utf8' });
  expect(r.status, r.stderr).toBe(0);
  await expect.poll(async () => (await (await fetch(B + '/api/radar/follow')).json()).news.map(n => n.text)).toEqual([`CFRC 101.9 played “${song}”`]);
  // the island note (checked 20 s after the app opens)
  await page.clock.fastForward(21000);
  // the note is sent once (the island decides when to show it, between its own notes): it's recorded as told
  await expect.poll(async () => { await page.clock.runFor(1500); return page.evaluate(t => (localStorage.getItem('cadence.followNoted') || '').includes(t), `Jay Som|CFRC 101.9 played “${song}”`); }, { timeout: 20000 }).toBe(true);
  // Music → Artists: Following, with what's new, until marked as seen
  await page.evaluate(() => { location.hash = 'view-artists'; });
  await expect(page.locator('.fw-l > li')).toHaveCount(1);
  await expect(page.locator('.fw-news')).toContainText(`CFRC 101.9 played “${song}”`);
  await page.click('#fw-seen');
  await expect(page.locator('.fw-l > li')).toContainText('Nothing new since you last looked');
  expect((await (await fetch(B + '/api/radar/follow')).json()).news).toEqual([]);
  // unfollow
  await page.click('[data-unfollow="Jay Som"]');
  await expect(page.locator('.fw-l')).toHaveCount(0);
});

test('Follow knows an artist you follow under another spelling, changes at once, and says so when it can\'t save', async ({ page }) => {
  await post('/api/radar/follow', { add: 'Black Country New Road' });   // e.g. followed from a blog's spelling
  await page.goto(B + '/'); await expect(page.locator('#sync')).toContainText('NAS', { timeout: 10000 });
  await page.evaluate(() => { window.CadenceArtist.open('Black Country, New Road'); location.hash = 'view-artist'; });
  const btn = page.locator('[data-follow="Black Country, New Road"]');
  await expect(btn).toHaveText('Following');                             // was "Follow", and clicking did nothing
  await btn.click();
  await expect(btn).toHaveText('Follow');
  expect((await (await fetch(B + '/api/radar/follow')).json()).follows.map(f => f.key)).not.toContain('black country new road');
  // the NAS can't be reached: a plain message, and the button goes back
  await page.route('**/api/radar/follow', r => r.request().method() === 'POST' ? r.fulfill({ status: 502, body: '' }) : r.continue());
  await btn.click();
  await expect(page.getByText("Couldn't reach Music Radar just now").first()).toBeVisible();
  await expect(btn).toHaveText('Follow');
});
