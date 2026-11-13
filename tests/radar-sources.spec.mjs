// Music Radar's other sources: each one reads its real response format (fake responses, no network).
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
