// Music Radar recommendations (2026-11-17): ListenBrainz similar artists, the walk out from what you like, Wikidata hometowns.
import { test, expect } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const saved = { RADAR_DATA: process.env.RADAR_DATA, RADAR_DB: process.env.RADAR_DB, RADAR_LB_SIMILAR: process.env.RADAR_LB_SIMILAR, RADAR_WIKIDATA: process.env.RADAR_WIKIDATA };
test.afterAll(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
test.beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), 'radar-recs-'));
  process.env.RADAR_DATA = join(dir, 'radar'); process.env.RADAR_DB = join(dir, 'cadence.db');
  process.env.RADAR_LB_SIMILAR = '1'; process.env.RADAR_WIKIDATA = '1'; delete process.env.LASTFM_API_KEY;
});

test('ListenBrainz similar artists: parsed, kept, and shown on Sounds like', async () => {
  const store = await import('../server/services/radar/lib/store.mjs');
  const Sim = await import('../server/services/radar/lib/similar.mjs');
  store.setKv('mba:wet leg', { mbid: 'aaaa-1111', name: 'Wet Leg', at: Date.now() });
  const real = globalThis.fetch; let calls = 0;
  globalThis.fetch = async u => { calls++; expect(String(u)).toContain('artist_mbids=aaaa-1111');
    return new Response(JSON.stringify([{ artist_mbid: 'b1', name: 'Dry Cleaning', score: 800, reference_mbid: 'aaaa-1111' }, { artist_mbid: 'b2', name: 'Yard Act', score: 400, reference_mbid: 'aaaa-1111' }]), { headers: { 'content-type': 'application/json' } }); };
  try {
    const list = await Sim.lbSimilar('aaaa-1111');
    expect(list).toEqual([{ name: 'Dry Cleaning', mbid: 'b1', match: 1 }, { name: 'Yard Act', mbid: 'b2', match: 0.5 }]);
    await Sim.lbSimilar('aaaa-1111'); expect(calls).toBe(1);   // kept for 30 days
    const sim = await Sim.similar('Wet Leg');
    expect(sim.find(s => s.name === 'Dry Cleaning').why).toBe('ListenBrainz listeners play them together');
    expect(await Sim.lbWarm(['Wet Leg', 'Nobody'])).toBe(0);   // fresh, and no MusicBrainz id for the other
  } finally { globalThis.fetch = real; }
});

test('the walk reaches artists two steps from yours, says through whom, and skips one-step ones', async () => {
  const F = await import('../server/services/radar/lib/foryou.mjs');
  const e = (a, b, n) => ({ a, b, n });
  const state = { artists: { 'mid band': { name: 'Mid Band' }, 'far band': { name: 'Far Band' } },
    edges: { 1: e('mine', 'mid band', 4), 2: e('mid band', 'far band', 4), 3: e('far band', 'farther', 3), 4: e('mine', 'weak', 1) } };
  const walk = F.walkFrom(state, [{ key: 'mine', name: 'Mine', w: 5 }], []);
  expect(walk.has('mid band')).toBe(false);          // one step: For you's direct links already count it
  expect(walk.get('far band')).toMatchObject({ seed: 'Mine', via: 'Mid Band', s: 1 });
  expect(walk.get('farther').s).toBeLessThan(1);      // three steps: weaker
  expect(walk.has('weak')).toBe(false);               // mentioned together only once: not a link for the walk
});

test('Wikidata hometowns: batched query, distance from home, Kingston Jamaica is not close to home', async () => {
  const store = await import('../server/services/radar/lib/store.mjs');
  const O = await import('../server/services/radar/lib/origin.mjs');
  expect(O.sparqlFor(['abc-1', 'bad"}; DROP'])).toContain('"abc-1" "badD"');   // only id characters get into the query
  const real = globalThis.fetch;
  globalThis.fetch = async u => {
    expect(decodeURIComponent(String(u))).toContain('wdt:P434');
    return new Response(JSON.stringify({ results: { bindings: [
      { mbid: { value: 'm-wolfe' }, placeLabel: { value: 'Wolfe Island' }, coord: { value: 'Point(-76.39 44.18)' }, country: { value: 'http://www.wikidata.org/entity/Q16' } },
      { mbid: { value: 'm-jam' }, placeLabel: { value: 'Kingston' }, coord: { value: 'Point(-76.79 17.99)' }, country: { value: 'http://www.wikidata.org/entity/Q766' } },
      { mbid: { value: 'm-to' }, placeLabel: { value: 'Toronto' }, coord: { value: 'Point(-79.38 43.65)' }, country: { value: 'http://www.wikidata.org/entity/Q16' } },
    ] } }), { headers: { 'content-type': 'application/sparql-results+json' } });
  };
  try {
    const n = await O.originWarm([{ name: 'Island Band', mbid: 'm-wolfe' }, { name: 'Reggae Band', mbid: 'm-jam' }, { name: 'City Band', mbid: 'm-to' }, { name: 'Unknown', mbid: 'm-none' }]);
    expect(n).toBe(4);
    const wolfe = O.originOf('Island Band');
    expect(wolfe.place).toBe('Wolfe Island'); expect(wolfe.km).toBeGreaterThan(10); expect(wolfe.km).toBeLessThan(30);
    expect(O.originOf('Reggae Band').km).toBeGreaterThan(2500);
    expect(O.originOf('City Band')).toMatchObject({ canada: true });
    expect(O.originOf('Unknown')).toBeNull();
    expect(store.getKv('wdo:unknown').none).toBe(true);
    expect(await O.originWarm([{ name: 'Island Band', mbid: 'm-wolfe' }])).toBe(0);   // kept
  } finally { globalThis.fetch = real; }
});

test('ListenBrainz scrobbling: only real radio listens, sent with your token, kept when it fails', async () => {
  const store = await import('../server/services/radar/lib/store.mjs');
  const S = await import('../server/services/radar/lib/scrobble.mjs');
  const row = (o) => ({ ts: 1_800_000_000, artist: 'Wet Leg', title: 'Chaise Longue', kind: 'live', station: 'CFRC', secs: 200, skipped: false, ...o });
  expect(S.worthSending(row())).toBe(true);
  expect(S.worthSending(row({ kind: 'preview', secs: 30 }))).toBe(false);
  expect(S.worthSending(row({ secs: 60 }))).toBe(false);
  expect(S.worthSending(row({ title: null }))).toBe(false);
  expect(S.listenPayload(row())).toMatchObject({ listened_at: 1_800_000_000 - 200, track_metadata: { artist_name: 'Wet Leg', track_name: 'Chaise Longue', additional_info: { music_service_name: 'CFRC', submission_client: 'THING' } } });
  delete process.env.LISTENBRAINZ_TOKEN;
  expect(await S.scrobble(row())).toEqual({ sent: 0, off: true });
  process.env.LISTENBRAINZ_TOKEN = 'tok';
  const real = globalThis.fetch, sent = []; let fail = true;
  globalThis.fetch = async (u, o) => { if (fail) return new Response('busy', { status: 503 }); sent.push({ u: String(u), auth: o.headers.Authorization, body: JSON.parse(o.body) }); return new Response('{"status":"ok"}', { headers: { 'content-type': 'application/json' } }); };
  try {
    expect((await S.scrobble(row())).sent).toBe(0);
    expect(store.getKv('lbScrobbleQueue')).toHaveLength(1);   // waits for the next one
    fail = false;
    expect((await S.scrobble(row({ title: 'Wet Dream' }))).sent).toBe(2);
    expect(sent[0]).toMatchObject({ u: 'https://api.listenbrainz.org/1/submit-listens', auth: 'Token tok', body: { listen_type: 'import' } });
    expect(sent[0].body.payload.map(p => p.track_metadata.track_name)).toEqual(['Chaise Longue', 'Wet Dream']);
    expect(store.getKv('lbScrobbleQueue')).toEqual([]);
  } finally { globalThis.fetch = real; delete process.env.LISTENBRAINZ_TOKEN; }
});
