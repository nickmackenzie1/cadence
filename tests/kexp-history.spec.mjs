// KEXP history view: plays saved on the NAS, grouped and counted (no AI). The database is filled before the server
// starts; the poller is pointed at nothing and never runs.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

const PORT = await freePort(), B = `http://localhost:${PORT}`;
const dir = mkdtempSync(join(tmpdir(), 'cadence-kx-'));
let server;

test.beforeAll(async () => {
  // fill kexp_plays through the real module (its poller stays off in this process)
  process.env.DATA_DIR = dir; process.env.KEXP_LOG = '0';
  const K = createRequire(import.meta.url)('../server/services/kexp-log.js');
  const d = K.open(), ins = d.prepare('INSERT INTO kexp_plays VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'), now = Date.now();
  let id = 1;
  const P = (minsAgo, artist, song, album, extra = {}) => ins.run(...K.row({ id: id++, play_type: 'trackplay', airdate: new Date(now - minsAgo * 60e3).toISOString(), artist, song, album, labels: ['Polyvinyl'], show: 7, ...extra }));
  d.prepare('INSERT INTO kexp_shows VALUES (?,?,?,?,?,?,?)').run(7, 'The Morning Show', 'Eclectic', 'John Richards', 0, null, null);
  d.prepare('INSERT INTO kexp_shows VALUES (?,?,?,?,?,?,?)').run(8, 'Audioasis', 'Local', 'Sharlese Metcalf', 0, null, null);
  // two months back so "New to KEXP" has something to compare with
  P(60 * 24 * 50, 'Old Favourite', 'Classic', 'Back Catalogue');
  P(60 * 24 * 40, 'Jay Som', 'Float', 'Belong');
  for (let i = 0; i < 5; i++) P(60 * 24 * i + 30, 'Jay Som', 'Appointments', 'Belong', { rotation_status: 'Heavy', comment: i === 0 ? 'Playing the Crocodile on Thursday' : '' });
  P(25, 'Wednesday', 'Bleeds', 'Bleeds', { show: 8 });
  P(20, 'Brand New Band', 'First Single', 'Demo', { is_local: true });
  P(15, 'Brand New Band', 'Second Single', 'Demo');
  delete process.env.KEXP_LOG;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir,
    KEXP_LOG: '1', KEXP_API: 'http://127.0.0.1:9', KEXP_LOG_DELAY: '99999999' }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); rmSync(dir, { recursive: true, force: true }); });

test('KEXP history: top artists and songs, an artist, a song, the songs around a play, DJ comments, search', async ({ page }) => {
  await page.goto(B + '/#view-kexp-history');
  await expect(page.locator('.kx-sum')).toContainText('10 songs saved since');
  // Top: artists this month, Jay Som first with 5 plays
  await expect(page.locator('.kx-row').first()).toContainText('Jay Som');
  await expect(page.locator('.kx-row').first().locator('.kx-n')).toHaveText('5');
  await page.click('.kx-chip[data-v="song"]');
  await expect(page.locator('.kx-row').first()).toContainText('Appointments');
  await page.click('.kx-chip[data-v="all"]');
  await expect(page.locator('.kx-row', { hasText: 'Classic' })).toHaveCount(1);

  // artist page: plays, songs with counts, plays per month
  await page.click('.kx-chip[data-v="artist"]');
  await page.locator('.kx-row', { hasText: 'Jay Som' }).click();
  await expect(page.locator('.kx-head h3')).toHaveText('Jay Som');
  await expect(page.locator('.kx-head')).toContainText('6 plays');
  await expect(page.locator('.kx-row', { hasText: 'Float' })).toContainText('1 play');
  await expect(page.locator('.kx-bars span')).toHaveCount(2);
  await expect(page.locator('.kx-c summary').first()).toHaveText('DJ comment');

  // song page, then the songs around one play
  await page.locator('.kx-row', { hasText: 'Appointments' }).click();
  await expect(page.locator('.kx-head h3')).toHaveText('Appointments');
  await expect(page.locator('.kx-play')).toHaveCount(5);
  await page.locator('.kx-play').first().locator('[data-k="around"]').click();
  await expect(page.locator('.kx-play.hl')).toContainText('Appointments');
  await expect(page.locator('.kx-play', { hasText: 'Bleeds' })).toHaveCount(1);
  // Back goes one step at a time: around → song → artist → list
  await page.click('[data-k="back"]'); await expect(page.locator('.kx-head h3')).toHaveText('Appointments');
  await page.click('[data-k="back"]'); await expect(page.locator('.kx-head h3')).toHaveText('Jay Som');
  await page.click('[data-k="back"]'); await expect(page.locator('.kx-chip[data-v="top"]')).toHaveClass(/on/);

  // recent with DJ comments only
  await page.click('.kx-chip[data-v="recent"]');
  await page.locator('#kx-com').check();
  await expect(page.locator('.kx-play')).toHaveCount(1);
  await expect(page.locator('.kx-play')).toContainText('Appointments');

  // new to KEXP: first played in the last two weeks
  await page.click('.kx-chip[data-v="new"]');
  await expect(page.locator('.kx-row', { hasText: 'Brand New Band' })).toHaveCount(1);
  await expect(page.locator('.kx-row', { hasText: 'Jay Som' })).toHaveCount(0);

  // shows and DJs: each play says where it was played; program and DJ pages; Top by show / DJ
  await page.click('.kx-chip[data-v="recent"]'); await page.locator('#kx-com').uncheck();
  await expect(page.locator('.kx-play', { hasText: 'Bleeds' })).toContainText('on Audioasis with Sharlese Metcalf');
  await page.locator('.kx-play', { hasText: 'Bleeds' }).locator('[data-k="dj"]').click();
  await expect(page.locator('.kx-head h3')).toHaveText('Sharlese Metcalf');
  await expect(page.locator('.kx-head')).toContainText('on Audioasis');
  await expect(page.locator('.kx-two .kx-row').first()).toContainText('Wednesday');
  await page.locator('.kx-head [data-k="program"]').click();
  await expect(page.locator('.kx-head h3')).toHaveText('Audioasis');
  await page.click('[data-k="back"]'); await page.click('[data-k="back"]');
  await page.click('.kx-chip[data-v="top"]'); await page.click('.kx-chip[data-v="show"]');
  await expect(page.locator('.kx-row').first()).toContainText('The Morning Show');
  await page.click('.kx-chip[data-v="dj"]');
  await expect(page.locator('.kx-row').first()).toContainText('John Richards');

  // search: by artist, by song, every play
  await page.click('.kx-chip[data-v="search"]');
  await page.fill('#kx-q', 'single'); await page.press('#kx-q', 'Enter');
  await expect(page.locator('.kx-row')).toHaveCount(1);
  await expect(page.locator('.kx-row')).toContainText('Brand New Band');
  await page.click('.kx-chip[data-v="song"]');
  await expect(page.locator('.kx-row')).toHaveCount(2);
  await page.click('.kx-chip[data-v="play"]');
  await expect(page.locator('.kx-play')).toHaveCount(2);
  await expect(page.locator('.kx-play').first()).toContainText('Second Single');
});
