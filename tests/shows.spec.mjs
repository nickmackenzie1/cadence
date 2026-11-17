// Local shows: concerts near home from Ticketmaster and Bandsintown (fakes here), the ones by artists you care about
// first, with why; far-away and past shows left out; the distance setting.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

const PORT = await freePort(), FAKE = await freePort(), B = `http://localhost:${PORT}`;
const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
let server, fake, dir, tmAsked = [];
const KINGSTON = { latitude: '44.2312', longitude: '-76.4860' }, VANCOUVER = { latitude: '49.28', longitude: '-123.12' };
const tmEvent = (id, artists, date, loc = KINGSTON) => ({ id, name: artists.join(' / '), url: 'https://tickets.example/' + id, dates: { start: { localDate: date, localTime: '20:00:00' } },
  classifications: [{ genre: { name: 'Rock' } }], _embedded: { venues: [{ name: 'The Grad Club', city: { name: 'Kingston' }, state: { stateCode: 'ON' }, location: loc }], attractions: artists.map(name => ({ name })) } });

test.beforeAll(async () => {
  fake = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'), j = o => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/discovery/v2/events.json') { tmAsked.push(Object.fromEntries(u.searchParams));
      return j({ _embedded: { events: [tmEvent('a', ['Jay Som', 'Opener'], day(10)), tmEvent('b', ['Random Band'], day(5)), tmEvent('c', ['Jay Som'], day(-3))] }, page: { totalPages: 1 } }); }
    if (u.pathname === '/kingstonlive') { res.writeHead(200, { 'Content-Type': 'text/xml' });   // the real feed's layout (sent by the user, 2026-11-16)
      const md = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
      return res.end(`<rss version="2.0"><channel><description/><link/>
        <item><ID>9</ID><title>Jay Som @ The Grad Club - ${md(day(10))}</title><link>https://kingstonlive.ca/show/9/view</link><description>Presented by Flying V Productions. 8:00 PM doors at 7:00 PM </description></item>
        <item><ID>10</ID><title>Wind Down Wednesdays: The Local Band, Friends &amp; Co @ The Mansion - ${md(day(2))}</title><link>https://kingstonlive.ca/show/10/view</link><description>Live 1 hr acoustics every Wednesday. 21:30 </description></item>
      </channel></rss>`); }
    const m = u.pathname.match(/^\/artists\/(.+)\/events$/);
    if (m) { const a = decodeURIComponent(m[1]);
      if (a === 'Alvvays') return j([{ id: 'x1', datetime: day(20) + 'T19:30:00', lineup: ['Alvvays', 'Piner'], url: 'https://bit.example/x1', venue: { name: "Ale House", city: 'Kingston', region: 'ON', ...KINGSTON } },
        { id: 'x2', datetime: day(21) + 'T19:30:00', lineup: ['Alvvays'], venue: { name: 'Commodore', city: 'Vancouver', region: 'BC', ...VANCOUVER } }]);
      return j([]); }
    res.writeHead(404); res.end();
  }).listen(FAKE);
  dir = mkdtempSync(join(tmpdir(), 'cadence-shows-'));
  // KEXP has played The Local Band once: their show says so
  const fill = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '-e', `
    const K = require('./server/services/kexp-log.js'); const d = K.open();
    d.prepare('INSERT INTO kexp_plays VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(...K.row({ id: 1, play_type: 'trackplay', airdate: new Date().toISOString(), artist: 'The Local Band', song: 'Home', album: 'Home' }));
  `], { env: { ...process.env, DATA_DIR: dir, KEXP_LOG: '0' }, encoding: 'utf8' });
  if (fill.status !== 0) throw new Error(fill.stderr);
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x'),
    RADAR_DATA: join(dir, 'radar'), RADAR_DB: join(dir, 'cadence.db'), TICKETMASTER_API_KEY: 'k', TICKETMASTER_API: `http://localhost:${FAKE}`, BANDSINTOWN_APP_ID: 'cadence-test', BANDSINTOWN_API: `http://localhost:${FAKE}`, KINGSTONLIVE_FEED: `http://localhost:${FAKE}/kingstonlive`,
    KEXP_LOG: '0', STG: '0', RADAR_MB: '0', RADIO_WARM: '0', ANTHROPIC_API_KEY: '' }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  await fetch(B + '/api/radar/want', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ add: { artist: 'Jay Som' } }) });
});
test.afterAll(() => { server && server.kill(); fake && fake.close(); rmSync(dir, { recursive: true, force: true }); });

test('shows near home: artists you care about first, with why; far and past shows left out', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cadence.recentArtists', JSON.stringify(['Alvvays'])));
  await page.goto(B + '/#view-shows');
  const mine = page.locator('.sh-l').first().locator('li');
  await expect(mine).toHaveCount(2, { timeout: 15000 });
  await expect(mine.nth(0)).toContainText('Jay Som');                 // sooner first
  await expect(mine.nth(0)).toContainText('In your Want to hear');
  await expect(mine.nth(0)).toContainText('The Grad Club · Kingston, ON');
  await expect(mine.nth(1)).toContainText('Alvvays');
  await expect(mine.nth(1)).toContainText('You looked them up');
  // a headliner and support share one line ("Alvvays, Piner"), not one name per line (user screenshot, 2026-11-16)
  await expect(mine.nth(1).locator('.sh-a')).toContainText('Alvvays, Piner');
  const tops = await mine.nth(1).locator('.sh-a a').evaluateAll(as => as.map(a => Math.round(a.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
  await mine.nth(1).screenshot({ path: 'test-results/show-row.png' });
  await expect(page.locator('.sh')).not.toContainText('Vancouver');
  // Kingston Live: its own open list, every act named (user: "just show all artists from kingston live")
  const kl = page.locator('.sh-kl li');
  await expect(kl).toHaveCount(1);
  await expect(kl.first().locator('.sh-a')).toContainText('The Local Band');
  await expect(kl.first()).toContainText('The Mansion · Kingston area · 13 km away');
  await expect(kl.first()).toContainText('Wind Down Wednesdays');
  await expect(kl.first()).toContainText('9:30');
  // where they've turned up (user: "used to show where they were mentioned, if they were mentioned on any source")
  await expect(kl.first().locator('.sh-heard')).toContainText('The Local Band: KEXP (1 play)');
  // everything else stays folded
  await page.locator('.sh-more summary').click();
  await expect(page.locator('.sh-more li')).toHaveCount(1);             // Random Band (Jay Som there twice counts once)
  await expect(page.locator('.sh-more')).toContainText('Random Band');
  expect(tmAsked[0]).toEqual(expect.objectContaining({ latlong: '44.2234,-76.6533', radius: '100', unit: 'km', classificationName: 'music' }));
  // a wider circle is remembered and asked for
  await page.selectOption('#sh-km', '300');
  await expect.poll(() => tmAsked.length).toBeGreaterThan(1);
  expect(tmAsked[tmAsked.length - 1].radius).toBe('300');
  await expect(page.locator('#sh-km')).toHaveValue('300');
});
