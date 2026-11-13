// Music Radar data cleanup: thread titles aren't artists, upload labels aren't genres, one subreddit can't make a breakout.
import { test, expect } from '@playwright/test';
const X = await import('../server/services/radar/lib/extract.mjs');
const H = await import('../server/services/radar/lib/history.mjs');

test('thread titles, decorated names and upload labels are left out', () => {
  for (const t of ['Daily Discussion - November 13, 2026', 'Teatime & Trending Topics - Week 3', 'TOP TEN POP TEN - Week of 11/2', 'Weekly Recommendations - 11/13'])
    expect(X.parseTitle(t)).toBeNull();
  expect(X.parseTitle('Daily Bread - Song [hip hop]').artist).toBe('Daily Bread');
  expect(X.parseTitle('Band - Song [dream pop, and ambient folk]').genres).toEqual(['dream pop', 'ambient folk']);
  for (const t of ['Artist - Song (Áudio Oficial)', 'Artist - Song (Radio Edit)', 'Artist - Song (Live at the BRIT Awards 2026)']) expect(X.parseTitle(t).genres).toEqual([]);
});

test('archive trends: breakouts need 2+ subreddits, genre jumps need a real share', () => {
  const mk = (arts, genres, music) => ({ posts: music, music, genres, albums: {}, artists: Object.fromEntries(arts.map(([n, c]) => [n.toLowerCase(), { name: n, n: c, score: 10 }])) });
  const h = H.historyTrends({
    popheads: { '2025-03': mk([['Dove Cameron', 3], ['Daily Discussion', 40], ['Real Band', 2]], { pop: 100 }, 1000),
                '2026-03': mk([['Dove Cameron', 69], ['Daily Discussion', 50], ['Real Band', 5], ['TOP TEN POP TEN', 12]], { pop: 120, 'áudio oficial': 12, 'radio edit': 11, hyperpop: 30 }, 1000) },
    indieheads: { '2026-03': mk([['Real Band', 6], ['Dove Cameron', 1]], { 'and ambient folk': 12 }, 500) },
  });
  expect(h.topArtistsByYear['2026'].map(a => a.name)).toEqual(['Dove Cameron', 'Real Band']);
  expect(h.breakoutsByYear['2026'].map(b => b.artist)).toEqual(['Real Band']);
  expect(h.jumpsByYear['2026'].map(j => j.genre)).toEqual(['hyperpop']);
});
