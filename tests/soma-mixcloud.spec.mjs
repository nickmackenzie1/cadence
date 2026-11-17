// SomaFM channels on Radio (played through the NAS relay, which opens their .pls playlists) and Mixcloud shows by the
// KEXP DJs who play your favourites. The NAS only fetches public addresses, so the server parts are checked with
// safeFetch stubbed; the page is checked with the NAS's answers stubbed.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

test('the NAS reads SomaFM channels and finds Mixcloud shows by the DJs who play your favourites', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cadence-soma-'));
  const out = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '-e', `
    const net = require('./server/lib/net.js');
    net.safeFetch = async (u) => {
      const j = o => ({ buf: Buffer.from(JSON.stringify(o)) });
      if (u.endsWith('/channels.json')) return j({ channels: [
        { id: 'indiepop', title: 'Indie Pop Rocks!', description: 'New and classic indie pop', genre: 'pop|rock', listeners: '900', lastPlaying: 'Alvvays - Archie, Marry Me', largeimage: 'https://api.somafm.com/logos/256/indiepop256.png',
          playlists: [{ url: 'https://api.somafm.com/indiepop130.pls', format: 'aac', quality: 'high' }, { url: 'https://api.somafm.com/indiepop256.pls', format: 'mp3', quality: 'highest' }] },
        { id: 'groovesalad', title: 'Groove Salad', description: 'Ambient', genre: 'ambient', listeners: '2000', playlists: [{ url: 'https://api.somafm.com/groovesalad256.pls', format: 'mp3', quality: 'highest' }] },
        { id: 'broken', title: 'No playlists' }] });
      if (u.includes('api.mixcloud.com/search/')) return j({ data: [
        { name: 'The Morning Show with John Richards', key: '/kexp/morning-show/', url: 'https://www.mixcloud.com/kexp/morning-show/', user: { name: 'KEXP' }, audio_length: 7200, created_time: '2026-11-10T10:00:00Z' },
        { name: 'Unrelated mix', key: '/x/y/', url: 'https://www.mixcloud.com/x/y/', user: { name: 'Someone Else' } }] });
      throw new Error('unexpected ' + u);
    };
    (async () => {
      const R = require('./server/services/radio.js'), S = await R.soma();
      const K = require('./server/services/kexp-log.js'), d = K.open();
      d.prepare('INSERT INTO kexp_shows VALUES (?,?,?,?,?,?,?)').run(5, 'The Morning Show', 'Eclectic', 'John Richards', 0, null, null);
      d.prepare('INSERT INTO kexp_plays VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(...K.row({ id: 1, play_type: 'trackplay', airdate: new Date().toISOString(), artist: 'Alvvays', song: 'Archie', album: 'A', show: 5 }));
      const radar = require('./server/services/radar.js');
      await radar.follow({ add: 'Alvvays' });
      const M = await radar.mixcloud();
      console.log(JSON.stringify({ S, M }));
    })().catch(e => { console.error(e); process.exit(1); });
  `], { env: { ...process.env, DATA_DIR: dir, RADAR_DB: join(dir, 'cadence.db'), RADAR_DATA: join(dir, 'radar'), KEXP_LOG: '1', KEXP_LOG_DELAY: '99999999', KEXP_API: 'http://127.0.0.1:9' }, encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
  expect(out.status, out.stderr).toBe(0);
  const { S, M } = JSON.parse(out.stdout.trim().split('\n').pop());
  expect(S.map(c => c.id)).toEqual(['soma:groovesalad', 'soma:indiepop']);         // most listeners first; no playlist, left out
  const ip = S.find(c => c.id === 'soma:indiepop');
  expect(ip.url).toBe('https://api.somafm.com/indiepop256.pls');                     // the best mp3
  expect(ip.now).toBe('Alvvays - Archie, Marry Me');
  expect(ip.place).toBe('pop, rock');
  expect(M.djs[0].dj).toBe('John Richards');
  expect(M.djs[0].because).toEqual(['Alvvays']);
  expect(M.djs[0].shows.map(s => s.key)).toEqual(['/kexp/morning-show/']);          // only shows by that DJ
  expect(M.djs[0].shows[0].mins).toBe(120);
});

test('Radio shows SomaFM and Mixcloud; SomaFM plays through the relay; a Mixcloud show loads its player on Play', async ({ page }) => {
  const PORT = await freePort(), B = `http://localhost:${PORT}`, dir = mkdtempSync(join(tmpdir(), 'cadence-soma2-'));
  const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TLS_DIR: join(dir, 'x'), KEXP_LOG: '0', RADIO_WARM: '0' }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
    await page.route(/api\/radio\/soma$/, r => r.fulfill({ json: [{ id: 'soma:indiepop', name: 'Indie Pop Rocks!', place: 'pop, rock', about: 'Indie pop', now: 'Alvvays - Archie, Marry Me', art: null, home: 'https://somafm.com/indiepop/', url: 'https://api.somafm.com/indiepop256.pls' }] }));
    await page.route(/api\/radar\/mixcloud/, r => r.fulfill({ json: { djs: [{ dj: 'John Richards', program: 'The Morning Show', because: ['Alvvays'], shows: [{ name: 'The Morning Show', key: '/kexp/morning-show/', url: 'https://www.mixcloud.com/kexp/morning-show/', by: 'KEXP', mins: 120 }] }] } }));
    await page.route(/api\/radio\/stream/, r => r.fulfill({ status: 200, contentType: 'audio/wav', body: Buffer.alloc(0) }));
    await page.route('https://player-widget.mixcloud.com/**', r => r.fulfill({ body: '<p>player</p>', contentType: 'text/html' }));
    await page.goto(B + '/#view-radio');
    const soma = page.locator('.rd-soma:not(.rd-mc)');
    await soma.locator('summary').click();
    await expect(soma).toContainText('Now: Alvvays - Archie, Marry Me');
    await soma.locator('[data-rd=play]').first().click();
    await expect.poll(() => page.evaluate(() => CadencePodcasts.current && CadencePodcasts.current.url)).toContain('api/radio/stream?u=' + encodeURIComponent('https://api.somafm.com/indiepop256.pls'));
    const mc = page.locator('.rd-mc');
    await mc.locator('summary').click();
    await expect(mc).toContainText('plays Alvvays');
    await mc.locator('[data-rd=mc]').click();
    const dock = page.locator('#rd-mcdock');
    await expect(dock.locator('iframe.rd-mcw')).toHaveAttribute('src', /feed=%2Fkexp%2Fmorning-show%2F/);
    await page.evaluate(() => { location.hash = 'view-today'; });                     // moving around keeps it playing
    await expect(dock.locator('iframe.rd-mcw')).toHaveCount(1);
    await dock.locator('button').click(); await expect(dock).toHaveCount(0);
  } finally { server.kill(); rmSync(dir, { recursive: true, force: true }); }
});
