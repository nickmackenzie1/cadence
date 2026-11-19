// How big is an artist? (2026-11-19) Last.fm keys need a paid Pro account from 1 December 2026, so the free answer
// comes first: ListenBrainz's listener count for the artist's MusicBrainz id (the artist pages' MusicBrainz look-up
// gives the id; ones without it are looked up in the background and counted next run). Last.fm is still used when a
// key is set and it works; when Last.fm turns the key down, Radar notes it once and quietly uses ListenBrainz for a day.
//
// Counts are kept as they come ({ n, from }). Scoring and the mainstream limit are in Last.fm-sized numbers, so a
// ListenBrainz count is multiplied by RADAR_LB_SCALE (25 by default: ListenBrainz has far fewer people on it) first.
import { now, DAY } from "./config.mjs";
import { httpJson } from "./http.mjs";
import { getKv, setKv } from "./store.mjs";
import { mbidOf } from "./similar.mjs";
import { artistInfo } from "./coverart.mjs";

const LB = () => process.env.LISTENBRAINZ_API || "https://api.listenbrainz.org";
const LFM = () => process.env.LASTFM_API || "https://ws.audioscrobbler.com";
export const LB_SCALE = () => Math.max(1, +process.env.RADAR_LB_SCALE || 25);
const LB_ON = () => process.env.RADAR_LB_SIZE !== "0" && (!process.env.CI || process.env.RADAR_LB_SIZE === "1");

// ---------- Last.fm: only while the key works ----------
export const hasLastfm = () => !!process.env.LASTFM_API_KEY;
const keyTag = () => String(process.env.LASTFM_API_KEY || "").slice(-6);
// { at, key, why } when Last.fm last turned this key down; a new key, or a day later, tries again
export function lastfmTurnedDown() {
  const r = getKv("lastfmRejected");
  return r && r.key === keyTag() && Date.now() - r.at < DAY * 1000 ? r : null;
}
export const lastfmOk = () => hasLastfm() && !lastfmTurnedDown();
// Last.fm's answers for a key it won't take: HTTP 401/403, or error 10 (invalid key), 26 (suspended), 4/9 (auth)
export function isRejection(errOrBody) {
  if (!errOrBody) return false;
  if (errOrBody instanceof Error) return /HTTP 40[13]\b/.test(errOrBody.message);
  return [4, 9, 10, 26].includes(+errOrBody.error);
}
export function noteRejected(why) {
  if (!lastfmTurnedDown()) setKv("lastfmRejected", { at: Date.now(), key: keyTag(), why: String(why || "").slice(0, 160) });
}
export async function lastfmJson(query) {
  let d;
  try { d = await httpJson(`${LFM()}/2.0/?${query}&api_key=${process.env.LASTFM_API_KEY}&format=json`); }
  catch (e) { if (isRejection(e)) noteRejected(e.message); throw e; }
  if (isRejection(d)) { noteRejected(d.message); throw new Error(`Last.fm turned the key down: ${d.message || d.error}`); }
  return d;
}

// Last.fm listener count + tags, cached a week per artist.
export async function lastfmInfo(state, key, name, { force = false } = {}) {
  if (!lastfmOk()) return null;
  const a = (state.artists[key] ||= { name, firstSeen: {}, genres: {} });
  if (!force && a.lastfm && now() - a.lastfm.ts < 7 * DAY) return a.lastfm;
  try {
    const d = await lastfmJson(`method=artist.getinfo&autocorrect=1&artist=${encodeURIComponent(name)}`);
    if (!d.artist) return (a.lastfm = { ts: now(), listeners: null, tags: [] });
    a.lastfm = { ts: now(), listeners: Number(d.artist.stats?.listeners) || 0,
                 tags: (d.artist.tags?.tag || []).map((t) => t.name.toLowerCase()).slice(0, 5), url: d.artist.url };
    (a.listenersHistory ||= []).push({ ts: now(), n: a.lastfm.listeners });
    return a.lastfm;
  } catch { return null; }
}

// ---------- ListenBrainz: free, by MusicBrainz id ----------
// POST /1/popularity/artist { artist_mbids } → [{ artist_mbid, total_listen_count, total_user_count }]
export async function lbPopularity(mbids) {
  const out = new Map(), ids = [...new Set(mbids.filter(Boolean))];
  for (let i = 0; i < ids.length; i += 50) {
    const j = await httpJson(`${LB()}/1/popularity/artist`, { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ artist_mbids: ids.slice(i, i + 50) }) });
    for (const r of Array.isArray(j) ? j : []) if (r && r.artist_mbid) out.set(r.artist_mbid, { users: r.total_user_count ?? null, listens: r.total_listen_count ?? null });
  }
  return out;
}
// ListenBrainz counts for many artists at once, cached a week on each artist (a.lb). Ones with no MusicBrainz id yet
// are queued for the background look-up and skipped this time.
export async function lbSizes(state, list, { force = false } = {}) {
  if (!LB_ON()) return;
  const want = [];
  for (const { key, name } of list) {
    const a = (state.artists[key] ||= { name, firstSeen: {}, genres: {} });
    if (!force && a.lb && now() - a.lb.ts < 7 * DAY) continue;
    const mbid = mbidOf(name);
    if (!mbid) { try { artistInfo(name); } catch {} continue; }
    want.push({ a, mbid });
  }
  if (!want.length) return;
  let got;
  try { got = await lbPopularity(want.map((w) => w.mbid)); } catch { return; }
  for (const { a, mbid } of want) {
    const r = got.get(mbid);
    a.lb = { ts: now(), mbid, users: r?.users ?? null, listens: r?.listens ?? null };
    if (a.lb.users != null) (a.listenersHistory ||= []).push({ ts: now(), n: a.lb.users, from: "lb" });
  }
}

// ---------- one answer per artist ----------
// { n, from: "lastfm" | "lb" } as the source gave it, or null when nothing is known yet
export function sizeOf(a) {
  if (!a) return null;
  if (a.lastfm?.listeners != null && lastfmOk()) return { n: a.lastfm.listeners, from: "lastfm" };
  if (a.lb?.users != null) return { n: a.lb.users, from: "lb" };
  if (a.lastfm?.listeners != null) return { n: a.lastfm.listeners, from: "lastfm" };   // an older Last.fm count beats none
  return null;
}
// in Last.fm-sized numbers, for scoring and the mainstream limit
export const scaled = (s) => (s && s.n != null ? (s.from === "lb" ? s.n * LB_SCALE() : s.n) : null);
export const sourceName = (from) => (from === "lb" ? "ListenBrainz" : "Last.fm");
export const sizeText = (s) => (s && s.n != null ? `${s.n.toLocaleString()} ${sourceName(s.from)} listener${s.n === 1 ? "" : "s"}` : "");

// Size the top candidates: Last.fm while the key works, ListenBrainz for the rest. Sets c.listeners (as given),
// c.listenersFrom, and a.listeners (Last.fm-sized) for the mainstream filter.
export async function sizeCandidates(state, cands) {
  if (lastfmOk()) for (const c of cands) { const info = await lastfmInfo(state, c.key, c.artist); if (!c.genres.length && info?.tags?.length) c.genres = info.tags.slice(0, 3); if (!lastfmOk()) break; }
  await lbSizes(state, cands.filter((c) => !lastfmOk() || !state.artists[c.key]?.lastfm).map((c) => ({ key: c.key, name: c.artist })));
  let known = 0;
  for (const c of cands) {
    const a = state.artists[c.key], s = sizeOf(a);
    c.listeners = s ? s.n : null; c.listenersFrom = s ? s.from : null;
    if (a) a.listeners = scaled(s);
    if (s) known++;
  }
  return known;
}

// Small-but-buzzing is the sweet spot. 0 = too big, drop it. (Last.fm-sized numbers)
export function sizeFactor(listeners) {
  if (listeners == null) return 1;
  if (listeners < 1000) return 1.2;
  if (listeners < 20000) return 1.5;
  if (listeners < 100000) return 1.3;
  if (listeners < 500000) return 1.0;
  if (listeners < 2000000) return 0.6;
  if (listeners < 5000000) return 0.3;
  return 0;
}
