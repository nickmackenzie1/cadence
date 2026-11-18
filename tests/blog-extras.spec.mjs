// Music Radar's blog reader (2026-11-17): post tags, embedded players, "Sounds like" lines, album announcements.
import { test, expect } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const savedEnv = { RADAR_DATA: process.env.RADAR_DATA, RADAR_DB: process.env.RADAR_DB };
test.afterAll(() => { for (const [k, v] of Object.entries(savedEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });

const item = (title, { cats = [], html = '', date = 'Tue, 17 Nov 2026 12:00:00 GMT', link } = {}) => `<item><title><![CDATA[${title}]]></title><link>${link || 'https://blog.example/' + encodeURIComponent(title)}</link><pubDate>${date}</pubDate>
  ${cats.map(c => `<category><![CDATA[${c}]]></category>`).join('')}<content:encoded><![CDATA[${html}]]></content:encoded></item>`;
const feed = items => `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>${items.join('')}</channel></rss>`;

test('blog posts bring tags, listen links, sounds-like pairs and release announcements', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'radar-blogx-'));
  process.env.RADAR_DATA = join(dir, 'radar'); process.env.RADAR_DB = join(dir, 'cadence.db'); delete process.env.ANTHROPIC_API_KEY; delete process.env.LASTFM_API_KEY;
  const store = await import('../server/services/radar/lib/store.mjs');
  const S = await import('../server/services/radar/lib/sources.mjs');
  const { similar } = await import('../server/services/radar/lib/similar.mjs');
  const feeds = {
    'shuffle.example': feed([item('Mira Vale - Low Tide', { cats: ['Indie Pop', 'Mira Vale'], html: '<p>Lovely.</p><p><strong>Sounds like:</strong> Alvvays, Japanese Breakfast and Snail Mail</p><iframe src="https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/miravale/low-tide&amp;color=1"></iframe>' })]),
    'vegan.example': feed([
      item('Wednesday announce new album, out March 6', { cats: ['Wednesday', 'Indie Rock'], html: '<p>Hear it: <a href="https://wednesday.bandcamp.com/album/bleeds?from=bv">Bandcamp</a></p>' }),
      // the headline alone doesn't follow a known shape: the tag names the artist
      item('A first listen to the strange and wonderful world of Fog Lake', { cats: ['News', 'Fog Lake'] }),
    ]),
    'niall.example': feed([item('Gig guide: what to see in Dublin this week', { cats: ['Gig Guide'] }), item('Sprints - Descartes', { cats: ['Irish Music'] })]),
  };
  const real = globalThis.fetch;
  globalThis.fetch = async u => { const h = new URL(String(u)).host; return feeds[h] ? new Response(feeds[h], { headers: { 'content-type': 'application/rss+xml' } }) : new Response('no', { status: 404 }); };
  try {
    const blogs = [{ name: 'Indie Shuffle', url: 'https://shuffle.example/feed' }, { name: 'BrooklynVegan', url: 'https://vegan.example/feed' }, { name: 'Nialler9', url: 'https://niall.example/feed' }];
    const out = await S.runSources({ blogs }, { store, only: ['blogs'], state: { picks: [], feedback: {} }, log: () => {} });
    expect(out[0].error).toBeUndefined();
    const sig = store.signals({ source: 'blogs' });
    // Nialler9's gig guide is skipped (the default's skip rule applies to a saved list too); its normal posts aren't
    expect(sig.some(s => /gig guide/i.test(s.title || ''))).toBe(false);
    expect(sig.find(s => s.artist === 'Sprints')).toBeTruthy();
    expect(sig.find(s => s.artist === 'Fog Lake')).toBeTruthy();
    // tags become genres
    expect(sig.find(s => s.artist === 'Mira Vale').genres).toContain('indie pop');

    const mira = store.signalsFor('mira vale');
    expect(mira[0].listen).toEqual([{ kind: 'soundcloud', url: 'https://soundcloud.com/miravale/low-tide' }]);
    const wed = store.signalsFor('wednesday');
    expect(wed[0].listen[0]).toEqual({ kind: 'bandcamp', url: 'https://wednesday.bandcamp.com/album/bleeds' });
    expect(wed[0].announce).toEqual({ release: '2027-03-06' });

    // "Sounds like" lines are pairs, both ways, and lead the artist page's Sounds like
    expect(store.alikeFor('mira vale').map(x => x.key).sort()).toEqual(['alvvays', 'japanese breakfast', 'snail mail']);
    expect(store.alikeFor('alvvays').map(x => x.key)).toEqual(['mira vale']);
    const sim = await similar('Alvvays');
    expect(sim[0].why).toContain('Indie Shuffle says they sound alike');
  } finally { globalThis.fetch = real; }
});

test('release days out of announcement wording, and the new default feeds', async () => {
  const S = await import('../server/services/radar/lib/sources.mjs');
  expect(S.releaseDate('Wet Leg announce new album, out September 26', 'Tue, 17 Nov 2026 10:00:00 GMT')).toBe('2027-09-26');
  expect(S.releaseDate('new LP due via Domino on Friday, December 4th', '2026-11-17')).toBe('2026-12-04');
  expect(S.releaseDate('the album arrives January 9, 2027', '2026-11-17')).toBe('2027-01-09');
  expect(S.releaseDate('out now everywhere', '2026-11-17')).toBeNull();
  const names = S.DEFAULT_BLOGS.map(b => b.name);
  for (const n of ['BrooklynVegan', 'My AMP Music', 'Indie Shuffle', 'Nialler9']) expect(names).toContain(n);
  // a saved list with Obscure Sound's old address follows it to Feedburner
  expect(S.blogList({ blogs: [{ name: 'Obscure Sound', url: 'https://www.obscuresound.com/feed/' }] })[0].url).toBe('https://feeds.feedburner.com/ObscureSound');
});
