// Said the Gramophone's yearly best-of lists: read from the blog's archive (a fake one here), shown per year and as
// "most-loved artists", and on artist pages.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

const PORT = await freePort(), SG = await freePort(), B = `http://localhost:${PORT}`;
let server, blog, dir;
const li = (n, a, t) => `<p></p><li><div class="harmonia-player"></div><span><a href="javascript:;" id="play"><img src="play.png"></a></span><a href="http://x.example/${n}.mp3">${a} - "${t}"</a> [<a href="https://x.example/buy">buy</a>]<br>Some words about it.</li><p></p>`;
const page = (y, songs, albums) => `<html><body><div class="title">BEST SONGS OF ${y}</div><p>My favourite <i>songs</i> are not my favourite <i>albums</i>.</p>
  <p><b>My favourite albums of ${y}</b> were:<br></p><ul>${albums.map(([a, t]) => `<li>${a} - <i>${t}</i> (lovely / <a href="#">buy</a>);</li>`).join('')}</ul>
  <ol>${songs.map(([a, t], i) => li(i + 1, a, t)).join('')}</ol></body></html>`;
const filler = y => [...Array(10)].map((_, i) => [`Filler ${y} ${i}`, `Song ${i}`]);
const PAGES = {
  '/archives/best_songs_of_2023.php': page(2023, [['Feist', 'Borrow Trouble'], ['Becky G and Peso Pluma', 'CHANEL'], ...filler(2023)], [['Lankum', 'False Lankum']]),
  '/archives/best_songs_of_2024.php': page(2024, [['Lankum', 'New One'], ['Feist ft. Hayden', 'Another'], ...filler(2024)], [['Ben Howard', 'Is It?']]),
};

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cadence-stg-'));
  blog = http.createServer((req, res) => { const p = PAGES[req.url]; res.writeHead(p ? 200 : 404, { 'Content-Type': 'text/html' }); res.end(p || 'nope'); }).listen(SG);
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x'), RADAR_DATA: join(dir, 'radar'), RADAR_DB: join(dir, 'cadence.db'),
    STG: '1', STG_BASE: `http://localhost:${SG}`, STG_GAP_MS: '0', STG_DELAY_MS: '200', KEXP_LOG: '0', RADIO_WARM: '0', RADAR_MB: '0', ANTHROPIC_API_KEY: '' }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
});
test.afterAll(() => { server && server.kill(); blog && blog.close(); rmSync(dir, { recursive: true, force: true }); });

test('reads every year it can, and counts the artists who keep coming back', async () => {
  await expect.poll(async () => (await (await fetch(B + '/api/radar/stg')).json()).status.years, { timeout: 20000 }).toEqual([2023, 2024]);
  const d = await (await fetch(B + '/api/radar/stg?year=2023')).json();
  expect(d.status.running).toBe(false);
  expect(d.list.songs.slice(0, 2)).toEqual([{ rank: 1, artist: 'Feist', title: 'Borrow Trouble' }, { rank: 2, artist: 'Becky G and Peso Pluma', title: 'CHANEL' }]);
  expect(d.list.albums).toEqual([{ artist: 'Lankum', title: 'False Lankum' }]);
  expect(d.status.errors['2010']).toMatch(/no list/);
  // Feist (song 2023, guest-led song 2024) and Lankum (album 2023, song 2024) both made two years
  expect(d.artists.slice(0, 2).map(a => [a.artist, a.n]).sort()).toEqual([['Feist', 2], ['Lankum', 2]]);
});

test('the page, and the artist page', async ({ page }) => {
  await page.goto(B + '/#view-stg');
  await expect(page.locator('.sg-l li').first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.sg')).toContainText('2 years');
  await page.click('[data-sgy="2023"]');
  await expect(page.locator('.sg-songs li')).toHaveCount(12);
  await expect(page.locator('.sg-songs li').first()).toContainText('Borrow Trouble');
  await page.locator('.sg-songs li').first().locator('[data-artist]').click();
  await expect(page.locator('.ap')).toContainText("On Said the Gramophone's best-of lists", { timeout: 10000 });
  await expect(page.locator('.ap')).toContainText('#1 song: Borrow Trouble');
});
