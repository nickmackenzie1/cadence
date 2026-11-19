// How big an artist is, now that Last.fm keys need Pro (1 December 2026): ListenBrainz counts by default, Last.fm only
// while its key works, and a key Last.fm turns down is noted once and skipped (fake responses, no network).
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const KEYS = ['RADAR_DATA', 'RADAR_DB', 'LASTFM_API_KEY', 'RADAR_LB_SIZE', 'RADAR_LB_SCALE', 'LISTENBRAINZ_TOKEN', 'KOITO_URL', 'KOITO_TOKEN'];
const saved = Object.fromEntries(KEYS.map(k => [k, process.env[k]]));
test.afterAll(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });

test('listener counts come from ListenBrainz without Last.fm; a key Last.fm turns down is skipped quietly', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'radar-size-'));
  Object.assign(process.env, { RADAR_DATA: join(dir, 'radar'), RADAR_DB: join(dir, 'cadence.db'), RADAR_LB_SIZE: '1', RADAR_LB_SCALE: '25', LASTFM_API_KEY: 'old-free-key' });
  const store = await import('../server/services/radar/lib/store.mjs');
  const E = await import('../server/services/radar/lib/enrich.mjs');
  const { isMainstream } = await import('../server/services/radar/lib/mainstream.mjs');
  store.setKv('mba:wet leg', { mbid: 'mb-wetleg', at: Date.now() });
  store.setKv('mba:huge star', { mbid: 'mb-huge', at: Date.now() });
  const real = globalThis.fetch, calls = [];
  globalThis.fetch = async (u, o) => {
    u = String(u); calls.push(u);
    if (u.includes('audioscrobbler')) return json({ error: 10, message: 'API key requires Last.fm Pro' }, 403);
    if (u.includes('/1/popularity/artist')) {
      const ids = JSON.parse(o.body).artist_mbids;
      return json(ids.map(id => ({ artist_mbid: id, total_listen_count: 1, total_user_count: id === 'mb-huge' ? 200000 : 900 })));
    }
    return new Response('no', { status: 404 });
  };
  try {
    const state = { artists: {}, picks: [] };
    const cands = [{ key: 'wet leg', artist: 'Wet Leg', genres: [] }, { key: 'huge star', artist: 'Huge Star', genres: [] }];
    expect(E.lastfmOk()).toBe(true);
    await E.sizeCandidates(state, cands);
    // Last.fm said no once: noted, and not asked again for the rest of the run
    expect(calls.filter(u => u.includes('audioscrobbler'))).toHaveLength(1);
    expect(E.lastfmOk()).toBe(false);
    expect(E.lastfmTurnedDown().why).toMatch(/403/);
    expect(cands[0]).toMatchObject({ listeners: 900, listenersFrom: 'lb' });
    expect(E.sizeText({ n: 900, from: 'lb' })).toBe('900 ListenBrainz listeners');
    // scaled to Last.fm-sized numbers for the score and the mainstream limit (2,000,000 by default)
    expect(state.artists['wet leg'].listeners).toBe(900 * 25);
    expect(state.artists['huge star'].listeners).toBe(200000 * 25);
    expect(E.sizeFactor(state.artists['huge star'].listeners)).toBe(0);
    const ms = { on: true, list: [], listeners: 2000000, charts: false };   // the default limit, whatever another test left
    expect(isMainstream('Huge Star', state.artists['huge star'], {}, ms)).toBe(true);
    expect(isMainstream('Wet Leg', state.artists['wet leg'], {}, ms)).toBe(false);
    // the chart source says why it's skipped, without asking Last.fm again
    const { SOURCES } = await import('../server/services/radar/lib/sources.mjs');
    await expect(SOURCES.lastfm.fetch({}, { tags: [] })).rejects.toThrow(/Pro from 1 December 2026/);
    expect(calls.filter(u => u.includes('audioscrobbler'))).toHaveLength(1);
    // a new key gets a fresh try
    process.env.LASTFM_API_KEY = 'paid-pro-key';
    expect(E.lastfmOk()).toBe(true);
  } finally { globalThis.fetch = real; rmSync(dir, { recursive: true, force: true }); }
});

test('Koito: listens go to Koito and ListenBrainz, each with its own queue', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'radar-koito-'));
  Object.assign(process.env, { RADAR_DATA: join(dir, 'radar'), RADAR_DB: join(dir, 'cadence.db'), LISTENBRAINZ_TOKEN: 'lbtok', KOITO_URL: 'http://192.168.1.20:4110/apis/listenbrainz/', KOITO_TOKEN: 'ktok' });
  const store = await import('../server/services/radar/lib/store.mjs');
  const S = await import('../server/services/radar/lib/scrobble.mjs');
  const row = (o) => ({ ts: 1_800_000_000, artist: 'Wet Leg', title: 'Chaise Longue', kind: 'live', station: 'CFRC', secs: 200, skipped: false, ...o });
  const real = globalThis.fetch, sent = []; let koitoUp = false;
  globalThis.fetch = async (u, o) => {
    u = String(u);
    if (u.startsWith('http://192.168.1.20') && !koitoUp) return new Response('down', { status: 502 });
    sent.push({ u, auth: o.headers.Authorization, n: JSON.parse(o.body).payload.length });
    return json({ status: 'ok' });
  };
  try {
    expect(S.koitoBase()).toBe('http://192.168.1.20:4110');
    const r = await S.scrobble(row());
    expect(r.sent).toBe(1);                       // ListenBrainz got it
    expect(r.koito).toMatchObject({ sent: 0 });   // Koito was down: it waits
    expect(store.getKv('koitoScrobbleQueue')).toHaveLength(1);
    koitoUp = true;
    await S.scrobble(row({ title: 'Wet Dream' }));
    const k = sent.filter(s => s.u.startsWith('http://192.168.1.20'));
    expect(k).toEqual([{ u: 'http://192.168.1.20:4110/apis/listenbrainz/1/submit-listens', auth: 'Token ktok', n: 2 }]);
    expect(sent.filter(s => s.u.includes('api.listenbrainz.org')).map(s => s.auth)).toEqual(['Token lbtok', 'Token lbtok']);
    expect(store.getKv('koitoScrobbleQueue')).toEqual([]);
    // Koito alone works too
    delete process.env.LISTENBRAINZ_TOKEN;
    expect((await S.scrobble(row({ title: 'Angelica' }))).sent).toBe(1);
  } finally { globalThis.fetch = real; rmSync(dir, { recursive: true, force: true }); }
});
