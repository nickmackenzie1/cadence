// Music Radar album art: MusicBrainz finds the release group, the Cover Art Archive has the cover. Against fakes.
import { test, expect } from '@playwright/test';
import http from 'node:http';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

const saved = { RADAR_DATA: process.env.RADAR_DATA, RADAR_DB: process.env.RADAR_DB, RADAR_MB_API: process.env.RADAR_MB_API, RADAR_CAA_API: process.env.RADAR_CAA_API, RADAR_MB_GAP: process.env.RADAR_MB_GAP, RADAR_MB: process.env.RADAR_MB };
test.afterAll(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });

test('finds the release, its cover and date; remembers misses; one request at a time', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cadence-art-')), port = await freePort(), hits = [];
  let inFlight = 0, maxInFlight = 0;
  const srv = http.createServer(async (req, res) => {
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight); hits.push(req.url); await new Promise(r => setTimeout(r, 20)); inFlight--;
    const j = o => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.url.startsWith('/ws/2/release-group/')) {
      const q = decodeURIComponent(req.url);
      if (q.includes('Belong')) return j({ 'release-groups': [{ id: 'rg-wrong', title: 'Belonging', score: 92 }, { id: 'rg-belong', title: 'Belong', score: 100, 'first-release-date': '2025-10-10', 'primary-type': 'Album' }] });
      return j({ 'release-groups': [{ id: 'rg-x', title: 'Something else', score: 40 }] });
    }
    if (req.url === '/release-group/rg-belong') return j({ images: [{ front: false, thumbnails: { 250: 'http://img/back.jpg' } }, { front: true, image: 'http://img/front.jpg', thumbnails: { 250: 'http://img/front-250.jpg' } }] });
    res.writeHead(404); res.end();
  }).listen(port);
  Object.assign(process.env, { RADAR_DATA: dir, RADAR_DB: join(dir, 'cadence.db'), RADAR_MB_API: `http://localhost:${port}`, RADAR_CAA_API: `http://localhost:${port}`, RADAR_MB_GAP: '10', RADAR_MB: '1' });
  try {
    const A = await import('../server/services/radar/lib/coverart.mjs');
    expect(A.artFor('Jay Som', 'Belong')).toBeNull();            // not known yet: queued
    expect(A.artFor('Nobody', 'Unknown Record')).toBeNull();
    await expect.poll(() => A._queue(), { timeout: 5000 }).toBe(0);
    await new Promise(r => setTimeout(r, 100));
    expect(A.artFor('jay som', 'BELONG')).toEqual(expect.objectContaining({ mbid: 'rg-belong', img: 'https://img/front-250.jpg', date: '2025-10-10', type: 'Album' }));
    // the miss is remembered: no new request
    const before = hits.length; expect(A.artFor('Nobody', 'Unknown Record')).toBeNull(); await new Promise(r => setTimeout(r, 100));
    expect(hits.length).toBe(before);
    expect(maxInFlight).toBe(1);
    // rows get the picture only when they don't have their own
    const rows = A.withArt([{ artist: 'Jay Som', title: 'Belong' }, { artist: 'Jay Som', title: 'Belong', image: 'https://own.jpg' }]);
    expect(rows.map(r => r.image)).toEqual(['https://img/front-250.jpg', 'https://own.jpg']);
    expect(rows[0].release).toEqual({ date: '2025-10-10', type: 'Album', mbid: 'rg-belong' });
  } finally { srv.close(); rmSync(dir, { recursive: true, force: true }); }
});
