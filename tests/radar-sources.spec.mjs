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
    for (const id of ['listenbrainz', 'lbcharts', 'apple', 'audius', 'bandcamp', 'blogs']) expect(by[id].n, id).toBeGreaterThan(0);
    expect(by.hypem.error).toContain('503');
    expect(by.lastfm).toBeUndefined();   // skipped without a key, recorded as a run
    const runs = Object.fromEntries(store.sourceRuns().map(r => [r.source, r]));
    expect(runs.lastfm.error).toContain('LASTFM_API_KEY');
    expect(runs.hypem.ok).toBe(0);
    const sig = store.signals();
    expect(sig.find(s => s.source === 'apple' && s.artist === 'Ketamine Kids').rank).toBe(1);
    expect(sig.find(s => s.source === 'lbcharts' && s.artist === 'Wednesday' && s.feed === 'Top artists this week')).toMatchObject({ rank: 1, feed: 'Top artists this week' });
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
  const v080 = S.OLD_DEFAULT_SETS[1].map(name => ({ name, url: 'https://old.example/' + encodeURIComponent(name) }));
  expect(S.blogList({ blogs: v080 }).some(b => b.name === '!earshot reviews')).toBe(true);
  expect(S.blogList({ blogs: v080 }).some(b => b.name === 'Drowned in Sound')).toBe(true);
});

test('!earshot: the whole chart inside one feed item (table or lines)', async () => {
  const S = await import('../server/services/radar/lib/sources.mjs');
  const rows = [...Array(8)].map((_, i) => `<tr><td>${i + 1}</td><td>Band ${i}</td><td>Record ${i}</td><td>Label ${i}</td></tr>`).join('');
  const xml = `<rss><channel><item><title>!earshot Top 50 for the Week Ending: Tuesday, November 10, 2026</title><description><![CDATA[<table><tr><th>#</th><th>Artist</th><th>Album</th><th>Label</th></tr>${rows}</table>]]></description></item></channel></rss>`;
  const out = S.earshotChart(S.earshotRows(xml).map(title => ({ title })));
  expect(out).toHaveLength(8);
  expect([out[0].rank, out[0].artist, out[0].title, out[0].label]).toEqual([1, 'Band 0', 'Record 0', 'Label 0']);
  expect(S.earshotRows('<item><description>1. Jay Som - Belong (Polyvinyl)&lt;br&gt;2. Alvvays - Blue Rev (Polyvinyl)</description></item>')).toEqual(['1. Jay Som - Belong (Polyvinyl)', '2. Alvvays - Blue Rev (Polyvinyl)']);
});

test('every earlier default blog list picks up blogs added since', async () => {
  const S = await import('../server/services/radar/lib/sources.mjs');
  for (const set of S.OLD_DEFAULT_SETS) {
    const saved = set.map(name => ({ name, url: 'https://old.example/' + encodeURIComponent(name) }));
    expect(S.blogList({ blogs: saved }).length, `a saved list of ${set.length}`).toBe(S.DEFAULT_BLOGS.length);
  }
  // feeds that moved follow along in your own list
  expect(S.blogList({ blogs: [{ name: 'The Fader', url: 'https://www.thefader.com/rss.xml' }, { name: 'Under the Radar', url: 'https://www.undertheradarmag.com/rss.xml' }, { name: 'Mine', url: 'https://x.example/f' }] }).map(b => b.url))
    .toEqual(['https://www.thefader.com/feed.rss', 'https://www.undertheradarmag.com/site/rss', 'https://x.example/f']);
  expect(S.blogList({ blogs: [{ name: 'Only mine', url: 'https://x.example/feed' }] })).toHaveLength(1);   // your own list is left alone
});

test('front page buzz uses every source: blog/KEXP-only artists climb, several sources beat one, mainstream stays out', async () => {
  const B = await import('../server/services/radar/lib/buzz.mjs');
  const DAY = 86400, t = 1_800_000_000;
  const sig = (source, artist, daysAgo, extra = {}) => ({ source, uid: source + artist + daysAgo, artist, artist_key: artist.toLowerCase(), first_seen: t - daysAgo * DAY, last_seen: t - daysAgo * DAY, seen: 1, best_rank: null, type: 'album', title: artist + ' LP', ...extra });
  const W = { blogs: 3, kexp: 3.5, earshot: 3, apple: 1 };
  const common = { t, weight: s => W[s.source] || 1, communityWeight: 3, hide: new Set(['drake']), name: id => id };
  const snaps = [{ ts: t - 3600, kind: 'artist', key: 'community band', artist: 'Community Band', score: 40 }];
  const signals = [sig('blogs', 'Quiet Blog Band', 1), sig('kexp', 'Quiet Blog Band', 0), sig('earshot', 'Quiet Blog Band', 2, { best_rank: 5 }),
    sig('blogs', 'One Source Band', 0), sig('blogs', 'Drake', 0), sig('blogs', 'Old News', 20)];
  const rise = B.allBuzz({ ...common, snaps, sig: signals, pts: [], chartSet: new Set(['apple', 'earshot']) });
  const names = rise.top.map(r => r.artist);
  expect(names[0]).toBe('Quiet Blog Band');                       // three sources this week
  expect(names).toContain('Community Band');                      // the community scan still counts
  expect(names).toContain('One Source Band');
  expect(names).not.toContain('Drake');
  expect(rise.top[0].sources.sort()).toEqual(['blogs', 'kexp']);  // earshot is a chart: counted per day on the chart, none here
  const one = rise.top.find(r => r.artist === 'One Source Band');
  expect(rise.top[0].cur).toBeGreaterThan(one.cur);
  const old = rise.top.find(r => r.artist === 'Old News');           // three weeks ago: fading, near the bottom
  expect(old.status).toBe('fading'); expect(old.cur).toBeLessThan(one.cur / 3);
  const albums = B.allAlbums({ ...common, snaps: [], sig: signals });
  expect(albums[0]).toEqual(expect.objectContaining({ artist: 'Quiet Blog Band', album: 'Quiet Blog Band LP' }));
  expect(albums[0].subs.length).toBe(3);
});

test('KEXP weekly charts: Top 90 and genre lists ranked, Adds as this week\'s mentions', async () => {
  const S = await import('../server/services/radar/lib/sources.mjs');
  const html = `<h2>KEXP Charts for the Week of Nov. 6 - Nov. 12</h2><h3>Add Date: Nov. 16</h3><h4>Top 90:</h4>
    <p>1. Sampa the Great - Nu Zamrock (Loma Vista Recordings)<br>2. Shabazz Palaces - It&#39;s a Style Sport (Sub Pop)<br></p>
    <h4>Adds:</h4><p>Aesop Rock &amp; Blockhead - Trouble Mountain (Rhymesayers)  <br>E. Lundquist - Chasing My Reflections (KingUnderground)</p>
    <h4>Jazz:</h4><ol><li>Some Trio - Blue Hour (Label)</li></ol>`;
  const v = S.kexpChart(html);
  expect(v.map(r => [r.feed, r.rank, r.artist, r.title])).toEqual([
    ['Top 90', 1, 'Sampa the Great', 'Nu Zamrock'], ['Top 90', 2, 'Shabazz Palaces', "It's a Style Sport"],
    ['Adds this week', null, 'Aesop Rock & Blockhead', 'Trouble Mountain'], ['Adds this week', null, 'E. Lundquist', 'Chasing My Reflections'], ['Jazz', 1, 'Some Trio', 'Blue Hour']]);
  expect(v[0].date).toBe('Week of Nov. 6 - Nov. 12');
  expect(S.DEFAULT_CFG.on.kexpchart).toBe(true);
});

test('Kingston Live feed: acts, venue, date and time out of its titles and descriptions', async () => {
  const S = await import('../server/services/radar/lib/shows.mjs');
  const xml = `<rss version="2.0"><channel><description/><link/>
    <item><ID>920444</ID><title>Dan Mangan, Jenn Grant @ The Spire - Nov 16, 2026</title><link>https://kingstonlive.ca/show/920444/view</link><description>Presented by Flying V Productions. 7:30 PM doors at 6:30 PM </description></item>
    <item><ID>1</ID><title>Jazz Sessions: Spencer Evans @ La Vida Bistrobar and Social - Nov 19, 2026</title><link>https://kingstonlive.ca/show/1/view</link><description>The perfect venue for live music. 7:00 PM - 9:00 PM </description></item>
    <item><ID>2</ID><title>The Gertrudes, Hollow Body @ The Toucan - Nov 29, 2026</title><link>https://kingstonlive.ca/show/2/view</link><description>&amp;nbsp; 1700 </description></item>
    <item><ID>3</ID><title>The Oreoz @ The Merchant Tap House - Dec 02, 2026</title><link>https://kingstonlive.ca/show/3/view</link><description>A dynamic party band. 22:30 </description></item>
  </channel></rss>`;
  const v = S.kingstonLive(xml);
  expect(v.map(e => [e.artists, e.venue, e.date, e.time])).toEqual([
    [['Dan Mangan', 'Jenn Grant'], 'The Spire', '2026-11-16', '19:30'], [['Spencer Evans'], 'La Vida Bistrobar and Social', '2026-11-19', '19:00'],
    [['The Gertrudes', 'Hollow Body'], 'The Toucan', '2026-11-29', '17:00'], [['The Oreoz'], 'The Merchant Tap House', '2026-12-02', '22:30']]);
  expect(v[0].note).toBe('Presented by Flying V Productions.');
  expect(v[1].title).toBe('Jazz Sessions: Spencer Evans');
  expect(v[0].url).toBe('https://kingstonlive.ca/show/920444/view');
});
