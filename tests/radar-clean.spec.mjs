// Music Radar data cleanup: thread titles aren't artists, upload labels aren't genres, one subreddit can't make a breakout.
import { test, expect } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// these specs point the radar modules at a temp folder through process.env; put it back so servers that
// later specs start in this same worker don't inherit it (that made radar.spec read an empty database)
const savedEnv = { RADAR_DATA: process.env.RADAR_DATA, RADAR_DB: process.env.RADAR_DB };
test.afterAll(() => { for (const [k, v] of Object.entries(savedEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
process.env.RADAR_DATA ||= mkdtempSync(join(tmpdir(), 'cadence-radar-clean-'));   // the radar modules create their data folder on import
const X = await import('../server/services/radar/lib/extract.mjs');

test('thread titles, decorated names and upload labels are left out', () => {
  for (const t of ['Daily Discussion - November 13, 2026', 'Teatime & Trending Topics - Week 3', 'TOP TEN POP TEN - Week of 11/2', 'Weekly Recommendations - 11/13'])
    expect(X.parseTitle(t)).toBeNull();
  expect(X.parseTitle('Daily Bread - Song [hip hop]').artist).toBe('Daily Bread');
  expect(X.parseTitle('Band - Song [dream pop, and ambient folk]').genres).toEqual(['dream pop', 'ambient folk']);
  for (const t of ['Artist - Song (Áudio Oficial)', 'Artist - Song (Radio Edit)', 'Artist - Song (Live at the BRIT Awards 2026)']) expect(X.parseTitle(t).genres).toEqual([]);
});


test('chart and blog placeholders are not artists (other sources get the same cleanup)', () => {
  for (const n of ['Various Artists', 'V/A', 'Original Motion Picture Soundtrack', 'Original Broadway Cast Recording', 'Best of 2026', 'Top 50 Albums', 'Unknown Artist', 'New Music Friday'])
    expect(X.isArtist(n), n).toBe(false);
  for (const n of ['Beach House', 'Soundgarden', 'Best Coast', 'The Weeknd', 'Vampire Weekend']) expect(X.isArtist(n), n).toBe(true);
  expect(X.parseTitle('Various Artists - Summer Mix [house]')).toBeNull();
  expect(['music video', 'Official Audio', 'Electronic'].map(X.cleanGenre)).toEqual([null, null, 'electronic']);
});
