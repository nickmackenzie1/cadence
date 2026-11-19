// Sounds like (user, 2026-11-16): artists to wander to from an artist page.
//   mentioned together  the same communities and posts talk about both (Radar's "sounds like" graph)
//   Last.fm similar     listeners' similar-artist list (only with a Last.fm key that works: Pro from 1 Dec 2026), kept 30 days
//   ListenBrainz        artists people play in the same listening sessions (labs API, no key; 2026-11-17), kept 30 days
import { getKv, setKv, neighbors, alikeFor } from "./store.mjs";
import { httpJson } from "./http.mjs";
import { norm } from "./extract.mjs";
import { lastfmOk, lastfmJson } from "./enrich.mjs";

const titled = (k) => String(k || "").replace(/\b\w/g, (c) => c.toUpperCase());
const ON = () => lastfmOk() && (process.env.RADAR_LASTFM_SIMILAR === "1" || !process.env.CI);
async function lastfm(name) {
  if (!ON()) return [];
  const k = "lfs:" + norm(name), c = getKv(k);
  if (c && Date.now() - c.at < 30 * 86400e3) return c.list;
  try {
    const j = await lastfmJson(`method=artist.getsimilar&artist=${encodeURIComponent(name)}&autocorrect=1&limit=15`);
    const list = ((j.similarartists || {}).artist || []).map((a) => ({ name: a.name, match: +a.match || 0 })).filter((a) => a.name);
    setKv(k, { list, at: Date.now() }); return list;
  } catch { return c ? c.list : []; }
}
// ---- ListenBrainz similar artists, by MusicBrainz id (the artist pages' MusicBrainz look-up gives it) ----
const LB_ALGO = "session_based_days_7500_session_300_contribution_5_threshold_10_limit_100_filter_True_skip_30";
const LB_ON = () => process.env.RADAR_LB_SIMILAR !== "0" && (!process.env.CI || process.env.RADAR_LB_SIMILAR === "1");
export const mbidOf = (name) => (getKv("mba:" + norm(name)) || {}).mbid || null;
export function lbCached(mbid) { const c = mbid && getKv("lbs:" + mbid); return c ? c.list : null; }
export async function lbSimilar(mbid, { cachedOnly = false } = {}) {
  if (!mbid || !LB_ON()) return [];
  const k = "lbs:" + mbid, c = getKv(k);
  if (c && (cachedOnly || Date.now() - c.at < 30 * 86400e3)) return c.list;
  if (cachedOnly) return [];
  try {
    const j = await httpJson(`${process.env.LB_LABS || "https://labs.api.listenbrainz.org"}/similar-artists/json?artist_mbids=${encodeURIComponent(mbid)}&algorithm=${LB_ALGO}`);
    const rows = (Array.isArray(j) ? j : []).filter((a) => a && a.name && a.artist_mbid !== mbid);
    const top = Math.max(1, ...rows.map((a) => +a.score || 0));
    const list = rows.slice(0, 25).map((a) => ({ name: a.name, mbid: a.artist_mbid, match: +((+a.score || 0) / top).toFixed(3) }));
    setKv(k, { list, at: Date.now() }); return list;
  } catch { return c ? c.list : []; }
}

export async function similar(name, { limit = 12 } = {}) {
  const me = norm(name), out = new Map();
  for (const n of neighbors(me, 12)) if (n.key !== me) out.set(n.key, { name: n.name || titled(n.key), why: `mentioned together ${n.n} time${n.n === 1 ? "" : "s"}`, from: "radar" });
  // writers saying so (Indie Shuffle's "Sounds like" lines and the like) come first
  let said = []; try { said = alikeFor(me, 8); } catch {}
  for (const n of said.reverse()) { if (n.key === me) continue; const why = `${n.feeds.split(",")[0]} says they sound alike`, x = out.get(n.key); out.delete(n.key); out.set(n.key, x ? { ...x, why: why + ", and " + x.why } : { name: n.name || titled(n.key), why, from: "blogs" }); }
  const ordered = [...out.entries()].reverse(); out.clear(); for (const [k, v] of ordered) out.set(k, v);
  for (const a of await lbSimilar(mbidOf(name))) { const k = norm(a.name); if (k === me) continue; const x = out.get(k); if (x) x.why += ", and ListenBrainz listeners play them together"; else out.set(k, { name: a.name, why: "ListenBrainz listeners play them together", from: "listenbrainz" }); }
  for (const a of await lastfm(name)) { const k = norm(a.name); if (k === me) continue; const x = out.get(k); if (x) x.why += ", and Last.fm says they're alike"; else out.set(k, { name: a.name, why: `Last.fm: ${Math.round(a.match * 100)}% alike`, from: "lastfm" }); }
  return [...out.values()].slice(0, limit);
}

// the background job: ListenBrainz lists for the artists you like that don't have a fresh one (30 a run, ~1 a second)
export async function lbWarm(names, { max = 30, gap = 1200 } = {}) {
  let n = 0;
  for (const name of names) {
    const mbid = mbidOf(name); if (!mbid) continue;
    const c = getKv("lbs:" + mbid); if (c && Date.now() - c.at < 30 * 86400e3) continue;
    await lbSimilar(mbid); n++;
    if (n >= max) break;
    await new Promise((r) => setTimeout(r, gap).unref?.());
  }
  return n;
}
