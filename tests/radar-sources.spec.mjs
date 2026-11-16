// Music Radar's other sources: each one reads its real response format (fake responses, no network).
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// these specs point the radar modules at a temp folder through process.env; put it back so servers that
// later specs start in this same worker don't inherit it (that made radar.spec read an empty database)
const savedEnv = { RADAR_DATA: process.env.RADAR_DATA, RADAR_DB: process.env.RADAR_DB };
test.afterAll(() => { for (const [k, v] of Object.entries(savedEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });

test('every source parses its format, stores signals, and a failing source is recorded without stopping the rest', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'radar-src-'));
  process.env.RADAR_DATA = join(dir, 'radar'); process.env.RADAR_DB = join(dir, 'cadence.db'); delete process.env.LASTFM_API_KEY; delete process.env.ANTHROPIC_API_KEY;
  const store = await import('../server/services/radar/lib/store.mjs');
  const { runSources, fromHeadline } = await import('../server/services/radar/lib/sources.mjs');
  const { mockFetch, TEST_BLOGS } = await import('../server/services/radar/test/source-fixtures.mjs');
  const real = globalThis.fetch;
  try {
    const mock = mockFetch(12);
    globalThis.fetch = async (u, o) => (String(u).includes('hypem.com') ? new Response('nope', { status: 503 }) : mock(u, o));   // Hype Machine is down today
    const out = await runSources({ blogs: TEST_BLOGS }, { store, state: { picks: [], feedback: {} }, log: () => {} });
    const by = Object.fromEntries(out.map(r => [r.id, r]));
    for (const id of ['listenbrainz', 'apple', 'audius', 'bandcamp', 'blogs']) expect(by[id].n, id).toBeGreaterThan(0);
    expect(by.hypem.error).toContain('503');
    expect(by.lastfm).toBeUndefined();   // skipped without a key, recorded as a run
    const runs = Object.fromEntries(store.sourceRuns().map(r => [r.source, r]));
    expect(runs.lastfm.error).toContain('LASTFM_API_KEY');
    expect(runs.hypem.ok).toBe(0);
    const sig = store.signals();
    expect(sig.find(s => s.source === 'apple' && s.artist === 'Ketamine Kids').rank).toBe(1);
    expect(sig.find(s => s.source === 'audius' && s.artist === 'Glass Lantern').url).toBe('https://audius.co/glasslantern/undertow');
    expect(sig.find(s => s.source === 'blogs' && s.artist === 'Wednesday').title).toBe('Bleeds');
    expect(sig.some(s => s.source === 'blogs' && /best albums/i.test(s.title || ''))).toBe(false);   // lists are skipped
    // a second check updates, it doesn't duplicate
    const again = await runSources({ blogs: TEST_BLOGS }, { store, state: { picks: [], feedback: {} }, log: () => {} });
    expect(again.find(r => r.id === 'apple').fresh).toBe(0);
    expect(store.signals().length).toBe(sig.length);
  } finally { globalThis.fetch = real; rmSync(dir, { recursive: true, force: true }); }
  expect(fromHeadline('Fontaines D.C. Announce New Album “Romance”')).toMatchObject({ artist: 'Fontaines D.C.', title: 'Romance', type: 'album' });
  expect(fromHeadline('“Tidal Wave” by Mira Vale')).toMatchObject({ artist: 'Mira Vale', title: 'Tidal Wave' });
  expect(fromHeadline('How Charli xcx Won the Summer')).toBeNull();
});

test('KEXP: new music in rotation, recent releases and live sessions count; the old library doesn\'t', async () => {
  const S = await import('../server/services/radar/lib/sources.mjs');
  const P = o => ({ play_type: 'trackplay', ...o }), t = Date.parse('2026-11-15') / 1000;
  const out = S.kexpSignals([
    P({ artist: 'Jay Som', album: 'Belong', release_group_id: 'rg1', rotation_status: 'Heavy', release_date: '2025-10-10' }),
    P({ artist: 'Jay Som', album: 'Belong', release_group_id: 'rg1', rotation_status: 'Heavy', release_date: '2025-10-10' }),
    P({ artist: 'Public Enemy', album: 'Fear of a Black Planet', rotation_status: 'Library', release_date: '1990-01-01' }),
    P({ artist: 'Wednesday', album: 'Bleeds', release_date: '2026-09-01' }),
    P({ artist: 'Yuma Abe', album: 'Live on KEXP' }), { play_type: 'airbreak' },
  ], t);
  expect(out.map(s => [s.artist, s.feed, s.metric])).toEqual([['Jay Som', 'Heavy rotation', 2], ['Wednesday', 'New releases', 1], ['Yuma Abe', 'Live sessions', 1]]);
  // the old six default blogs get the new small blogs; a list you edited is kept, with tiers filled in where known
  expect(S.blogList({ blogs: S.DEFAULT_BLOGS.slice(0, 6).map(({ tier, ...b }) => b) }).map(b => b.name)).toContain('Post-Trash');
  expect(S.blogList({ blogs: [{ name: 'Pitchfork news', url: 'https://pitchfork.com/feed/feed-news/rss' }, { name: 'Mine', url: 'https://x.example/feed' }] }).map(b => b.tier)).toEqual(['big', undefined]);
});

test('!earshot National Top 50: rank, artist, album, label and Canadian content from the usual title shapes', async () => {
  const S = await import('../server/services/radar/lib/sources.mjs');
  const out = S.earshotChart([{ title: '1. Jay Som - Belong (Polyvinyl)' }, { title: '2. Alvvays – Blue Rev [Polyvinyl] *' }, { title: '#3 Fucked Up: One Day (Merge) CC' },
    { title: 'Various Artists - Compilation (Label)' }, { title: 'Daniel Romano', summary: 'Too Hot To Sleep (You\'ve Changed)' }]);
  expect(out.map(x => [x.rank, x.artist, x.title, x.label, x.feed])).toEqual([
    [1, 'Jay Som', 'Belong', 'Polyvinyl', 'National Top 50'], [2, 'Alvvays', 'Blue Rev', 'Polyvinyl', 'National Top 50 · Canadian'],
    [3, 'Fucked Up', 'One Day', 'Merge', 'National Top 50 · Canadian'], [5, 'Daniel Romano', 'Too Hot To Sleep', "You've Changed", 'National Top 50']]);
  expect(S.DEFAULT_BLOGS.some(b => b.name === '!earshot reviews')).toBe(true);
  // a saved list that is exactly the 0.8.0 defaults also gets new defaults
  const v080 = S.DEFAULT_BLOGS.slice(0, 12).map(({ tier, ...b }) => b);
  expect(S.blogList({ blogs: v080 }).some(b => b.name === '!earshot reviews')).toBe(true);
  expect(S.blogList({ blogs: v080 }).some(b => b.name === 'Drowned in Sound')).toBe(true);
});

test('every earlier default blog list picks up blogs added since', async () => {
  const S = await import('../server/services/radar/lib/sources.mjs');
  for (const n of [6, 12, 13, 14, 18]) {
    const saved = S.DEFAULT_BLOGS.slice(0, n).map(({ tier, ...b }) => b);
    expect(S.blogList({ blogs: saved }).length, `a saved list of ${n}`).toBe(S.DEFAULT_BLOGS.length);
  }
  expect(S.blogList({ blogs: [{ name: 'Only mine', url: 'https://x.example/feed' }] })).toHaveLength(1);   // your own list is left alone
});
