// Music Radar without Reddit: Lemmy communities and Mastodon hashtags (public APIs, no keys), and hiding mainstream
// artists. Against a fake fediverse server.
import { test, expect } from '@playwright/test';
import http from 'node:http';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

const saved = Object.fromEntries(['RADAR_DATA', 'RADAR_DB', 'RADAR_FEDI_BASE'].map(k => [k, process.env[k]]));
test.afterAll(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });

test('Lemmy and Mastodon posts come out like Reddit posts', async () => {
  const port = await freePort(), seen = [];
  const srv = http.createServer((req, res) => {
    seen.push(req.url);
    const j = o => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.url.startsWith('/lemmy.ml/api/v3/post/list')) return j({ posts: [
      { post: { id: 11, name: 'Jay Som - Appointments [indie rock] (2025)', url: 'https://youtu.be/x', ap_id: 'https://lemmy.ml/post/11', published: '2026-11-15T10:00:00.000000' }, counts: { score: 14, upvotes: 15, downvotes: 1, comments: 3 } },
      { post: { id: 12, name: 'Weekly thread', featured_community: true, published: '2026-11-15T10:00:00Z' }, counts: { score: 2 } },
      { post: { id: 13, name: 'Removed', removed: true, published: '2026-11-15T10:00:00Z' }, counts: {} }] });
    if (req.url.startsWith('/lemmy.ml/api/v3/comment/list')) return j({ comments: [{ comment: { content: 'Love this record' } }] });
    if (req.url.startsWith('/mastodon.social/api/v1/timelines/tag/indiemusic')) return j([
      { id: '1', uri: 'https://m/1', url: 'https://m/@a/1', created_at: '2026-11-15T12:00:00.000Z', content: '<p>New one <a>#indiemusic</a></p>', favourites_count: 4, reblogs_count: 2, replies_count: 1,
        card: { title: 'Bleeds, by Wednesday', url: 'https://wednesday.bandcamp.com/album/bleeds', provider_name: 'Bandcamp' } },
      { id: '2', uri: 'https://m/2', url: 'https://m/@b/2', created_at: '2026-11-15T12:00:00Z', content: '<p>#NowPlaying Hovvdy - Jean https://youtu.be/y</p>', favourites_count: 1, reblogs_count: 0 },
      { id: '3', reblog: { id: '1', uri: 'https://m/1', content: 'dup', created_at: '2026-11-15T12:00:00Z' } }]);
    res.writeHead(404); res.end();
  }).listen(port);
  process.env.RADAR_FEDI_BASE = `http://localhost:${port}`;
  try {
    const F = await import('../server/services/radar/lib/fediverse.mjs');
    const lm = await F.fetchLemmy(['indieheads@lemmy.ml', 'not a community'], () => {});
    expect(lm).toHaveLength(1);
    expect(lm[0]).toEqual(expect.objectContaining({ sub: 'indieheads@lemmy.ml', title: 'Jay Som - Appointments [indie rock] (2025)', score: 14, comments: 3, permalink: 'https://lemmy.ml/post/11' }));
    expect(lm[0].created).toBe(Date.parse('2026-11-15T10:00:00Z') / 1000);   // Lemmy dates without a zone are UTC
    expect(await F.fetchLemmyComments(lm[0])).toEqual(['Love this record']);
    const md = await F.fetchMastodon(['#indiemusic'], () => {});
    expect(md.map(p => [p.sub, p.title, p.score])).toEqual([['#indiemusic', 'Wednesday - Bleeds', 6], ['#indiemusic', 'Hovvdy - Jean', 1]]);
    // the titles read like Reddit's, so the same parser finds artist and song
    const X = await import('../server/services/radar/lib/extract.mjs');
    expect([lm[0], ...md].map(p => X.parseTitle(p.title)?.artist)).toEqual(['Jay Som', 'Wednesday', 'Hovvdy']);
  } finally { srv.close(); }
});

test('mainstream artists: your list, Last.fm listeners over the limit, the Apple chart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cadence-ms-'));
  Object.assign(process.env, { RADAR_DATA: dir, RADAR_DB: join(dir, 'cadence.db') });
  try {
    const M = await import('../server/services/radar/lib/mainstream.mjs');
    expect(M.mainstreamCfg().list).toContain('Drake');
    const state = { artists: { a: { name: 'Big Indie Band', listeners: 3_000_000 }, b: { name: 'Small Band', listeners: 4000 } } };
    const set = M.mainstreamSet(state, { chartArtists: ['Chart Topper'] });
    for (const n of ['drake', 'Taylor Swift', 'KANYE WEST', 'Big Indie Band', 'Chart Topper']) expect(M.hidden(set, n), n).toBe(true);
    expect(M.hidden(set, 'Small Band')).toBe(false);
    // your own settings: a shorter list, a higher limit, charts off
    M.saveMainstreamCfg({ list: 'Drake\nKanye West', listeners: 5_000_000, charts: false });
    const set2 = M.mainstreamSet(state, { chartArtists: ['Chart Topper'] });
    expect(['Drake', 'Taylor Swift', 'Big Indie Band', 'Chart Topper'].map(n => M.hidden(set2, n))).toEqual([true, false, false, false]);
    M.saveMainstreamCfg({ on: false });
    expect(M.mainstreamSet(state)).toBeNull();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
