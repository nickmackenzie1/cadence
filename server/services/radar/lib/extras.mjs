// Three things built from what Music Radar already keeps (user, 2026-11-16):
//   Friday mix   a weekly set of 30-second previews: for you, new from people you follow, climbing fast, a few wildcards
//   Out this week   releases by artists you follow or saved, from MusicBrainz and the sources' release dates
//   Called it    how early Radar spotted someone before the Apple chart or KEXP's heavy rotation
import { now, DAY } from "./config.mjs";
import { arc, energy } from "./sound.mjs";
import { getKv, setKv, signalsFor, firstSightings, firstEarlyFor } from "./store.mjs";
import { norm } from "./extract.mjs";
import { artistInfo } from "./coverart.mjs";
import { nfmCfg } from "./foryou.mjs";

const iso = (ts) => new Date(ts * 1000).toISOString().slice(0, 10);
// the Friday that starts this mix's week (Friday to Thursday), as YYYY-MM-DD in local time
export function mixWeek(d = new Date()) {
  const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 2) % 7));
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
const myArtists = () => {
  const m = new Map();
  for (const f of getKv("follows", []) || []) m.set(f.key || norm(f.name), { name: f.name, why: "you follow them" });
  for (const w of getKv("wantToHear", []) || []) if (w.artist && !m.has(norm(w.artist))) m.set(norm(w.artist), { name: w.artist, why: "in your Want to hear" });
  return m;
};

// ---- Out this week: releases in the last 7 days or the next 60, by artists you follow or saved ----
export function releases({ back = 7, ahead = 60 } = {}) {
  const t = now(), mine = myArtists(), out = new Map(), announced = new Map(), today = iso(t), from = iso(t - back * DAY), to = iso(t + ahead * DAY);
  const add = (r) => { if (!r.date || r.date < from || r.date > to) return; const k = norm(r.artist) + "|" + norm(r.title); if (!out.has(k)) out.set(k, r); };
  for (const [key, a] of mine) {
    const mb = artistInfo(a.name);   // queues a MusicBrainz look-up if it's missing; its answer shows next time
    for (const r of mb.info?.releases || []) add({ artist: a.name, title: r.title, type: (r.type || "release").toLowerCase(), date: String(r.date || "").slice(0, 10), why: a.why, source: "MusicBrainz", cover: r.cover, url: `https://musicbrainz.org/release-group/${r.id}` });
    for (const s of signalsFor(key, 100)) {
      // a blog announcing a record: its release day when the post gives one; otherwise "announced", without a day
      if (s.announce) {
        const r = { artist: a.name, title: s.title, type: s.type === "ep" ? "ep" : "album", why: a.why, source: s.feed || s.source, cover: s.image, url: s.url, announced: true };
        if (s.announce.release) add({ ...r, date: s.announce.release });
        else if (s.first_seen > t - 21 * DAY) announced.set(norm(a.name) + "|" + norm(s.title), { ...r, date: String(s.date ? new Date(Date.parse(s.date) || s.first_seen * 1000).toISOString() : iso(s.first_seen)).slice(0, 10) });
        continue;
      }
      if (s.date && /album|ep|single|release|track/.test(s.type || "")) add({ artist: a.name, title: s.title, type: s.type, date: String(s.date).slice(0, 10), why: a.why, source: s.source, cover: s.image, url: s.url });
    }
  }
  const list = [...out.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { today, thisWeek: list.filter((r) => r.date <= iso(t + 7 * DAY)), soon: list.filter((r) => r.date > iso(t + 7 * DAY)),
    announced: [...announced.values()].filter((r) => !list.some((x) => norm(x.artist) === norm(r.artist))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
    pending: [...mine.values()].some((a) => artistInfo(a.name, { queue: false }).pending) };
}

// ---- Called it: Radar's first sighting vs the Apple chart and KEXP's heavy rotation ----
// The database groups first sightings; KEXP's heavy rotation is read once for the stretch since Radar started (by
// date index). Kept an hour (2026-11-17: loading every signal and asking KEXP per artist froze the NAS).
let calledCache = { at: 0, v: null };
const EARLY = ["blogs", "hypem", "bandcamp", "kexp", "earshot", "kexpchart", "audius", "community"];
// Starts from who reached the Apple chart or KEXP's heavy rotation (a few hundred), not every artist Radar knows.
export function calledIt(state, { heavySince = () => [], limit = 12, fresh = false, artistOf = () => null } = {}) {
  if (!fresh && calledCache.v && Date.now() - calledCache.at < 3600e3) return { ...calledCache.v, list: calledCache.v.all.slice(0, limit) };
  const firstApple = new Map(), heavy = new Map();
  for (const r of firstSightings(["apple"])) if (r.key && (!firstApple.has(r.key) || r.ts < firstApple.get(r.key).ts)) firstApple.set(r.key, { ts: r.ts, name: r.artist });
  try { for (const h of heavySince(now() - 400 * DAY)) { const k = norm(h.artist); if (k && (!heavy.has(k) || h.t < heavy.get(k))) heavy.set(k, h.t); } } catch {}
  const keys = [...new Set([...firstApple.keys(), ...heavy.keys()])];
  const firstEarly = new Map();
  for (const r of firstEarlyFor(keys, EARLY)) if (!firstEarly.has(r.key) || r.ts < firstEarly.get(r.key).ts) firstEarly.set(r.key, { ts: r.ts, name: r.artist, via: r.source === "blogs" ? r.feed || "a blog" : r.source });
  for (const k of keys) {
    const a = (state?.artists && state.artists[k]) || artistOf(k); if (!a) continue;
    const f = Math.min(...Object.values(a.firstSeen || {}), Infinity);
    if (isFinite(f) && (!firstEarly.has(k) || f < firstEarly.get(k).ts)) firstEarly.set(k, { ts: f, name: a.name || k, via: "Lemmy & Mastodon" });
  }
  const nfm = new Set(nfmCfg().artists.map(norm)), out = [];
  for (const [k, e] of firstEarly) {
    if (nfm.has(k)) continue;
    const ms = [], ap = firstApple.get(k), h = heavy.get(k);
    if (ap && ap.ts - e.ts >= 3 * DAY) ms.push({ what: "the Apple chart", days: Math.round((ap.ts - e.ts) / DAY), at: ap.ts });
    if (h && h - e.ts >= 3 * DAY) ms.push({ what: "KEXP's heavy rotation", days: Math.round((h - e.ts) / DAY), at: h });
    if (!ms.length) continue;
    ms.sort((a, b) => b.days - a.days);
    out.push({ artist: e.name, spotted: iso(e.ts), via: e.via, lead: ms[0].days, milestones: ms.map((m) => ({ ...m, at: iso(m.at) })) });
  }
  out.sort((a, b) => b.lead - a.lead);
  const v = { all: out, count: out.length, median: out.length ? out.map((x) => x.lead).sort((a, b) => a - b)[Math.floor(out.length / 2)] : null };
  calledCache = { at: Date.now(), v };
  return { ...v, list: out.slice(0, limit) };
}
// the line for one artist's page: only their own signals (indexed), not every artist's
export function calledItFor(state, name, { kexpHeavy = () => null } = {}) {
  const k = norm(name), early = new Set(["blogs", "hypem", "bandcamp", "kexp", "earshot", "kexpchart", "audius", "community"]);
  let first = null, apple = null;
  for (const s of signalsFor(k, 2000)) {
    if (s.source === "apple") { if (!apple || s.first_seen < apple) apple = s.first_seen; }
    else if (early.has(s.source) && (!first || s.first_seen < first.ts)) first = { ts: s.first_seen, via: s.source === "blogs" ? s.feed || "a blog" : s.source };
  }
  const f = Math.min(...Object.values(state?.artists?.[k]?.firstSeen || {}), Infinity);
  if (isFinite(f) && (!first || f < first.ts)) first = { ts: f, via: "Lemmy & Mastodon" };
  if (!first) return null;
  const ms = [];
  if (apple && apple - first.ts >= 3 * DAY) ms.push({ what: "the Apple chart", days: Math.round((apple - first.ts) / DAY), at: iso(apple) });
  let h = null; try { h = kexpHeavy(name); } catch {}
  if (h && h - first.ts >= 3 * DAY) ms.push({ what: "KEXP's heavy rotation", days: Math.round((h - first.ts) / DAY), at: iso(h) });
  return ms.length ? { artist: name, spotted: iso(first.ts), via: first.via, lead: Math.max(...ms.map((m) => m.days)), milestones: ms.sort((a, b) => b.days - a.days) } : { artist: name, spotted: iso(first.ts), via: first.via, lead: 0, milestones: [] };
}

// ---- Friday mix ----
// D: the dashboard data (for you, rise, combined). Kept per week; "again" makes this week's over.
export function fridayMix(D, { again = false, rel = null } = {}) {
  const week = mixWeek(), mixes = getKv("fridayMixes", {}) || {};
  if (mixes[week] && !again) return { week, ...mixes[week], weeks: Object.keys(mixes).sort().reverse() };
  const items = [], seen = new Set(), nfm = new Set(nfmCfg().artists.map(norm)), mine = myArtists();
  const add = (x, why, cap) => {
    const k = norm(x.artist || ""); if (!k || seen.has(k) || nfm.has(k) || items.filter((i) => i.group === cap).length >= LIMIT[cap]) return;
    seen.add(k); items.push({ artist: x.artist, title: x.title || null, type: x.type || null, why, group: cap });
  };
  const LIMIT = { foryou: 8, follow: 6, rising: 4, wild: 3 };
  for (const x of D.forYou?.list || []) add(x, x.why[0].toUpperCase() + x.why.slice(1), "foryou");
  for (const r of [...(rel?.thisWeek || [])].reverse()) add({ artist: r.artist, title: r.title, type: r.type }, `New ${r.type || "release"} from ${r.artist}, out ${r.date}`, "follow");
  for (const [k, a] of mine) { const s = signalsFor(k, 20).find((x) => now() - x.first_seen < 14 * DAY && x.title && x.title !== x.artist); if (s) add({ artist: a.name, title: s.title, type: s.type }, `New from ${a.name}, ${a.why}`, "follow"); }
  for (const r of D.rise?.risers || []) add({ artist: r.artist }, "Climbing fast on Radar", "rising");
  // wildcards: talked about in more than one place, not your usual, picked at random
  const pool = (D.sources?.combined || []).filter((a) => (a.breadth || 0) >= 2 && !seen.has(norm(a.artist)) && !mine.has(norm(a.artist)));
  for (let i = 0; i < 12 && pool.length; i++) { const a = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; add({ artist: a.artist, title: ((a.titles || [])[0] || {}).title || null }, `A wildcard: ${a.breadth} sources are talking about them`, "wild"); }
  // each group in a running order with a shape (calm → lively → calm), from the songs' sound where it's been read
  try {
    const order = [...new Set(items.map((i) => i.group))];
    const shaped = order.flatMap((g) => arc(items.filter((i) => i.group === g), (i) => energy(i.artist)));
    items.splice(0, items.length, ...shaped);
  } catch {}
  mixes[week] = { made: Date.now(), items };
  const keep = Object.keys(mixes).sort().slice(-12); for (const k of Object.keys(mixes)) if (!keep.includes(k)) delete mixes[k];
  setKv("fridayMixes", mixes);
  return { week, ...mixes[week], weeks: keep.slice().reverse() };
}
// this week's mix if it's been made already (null if not), the same shape fridayMix() hands back
export function mixKept() {
  const week = mixWeek(), mixes = getKv("fridayMixes", {}) || {};
  return mixes[week] ? { week, ...mixes[week], weeks: Object.keys(mixes).sort().reverse() } : null;
}
export function pastMix(week) { const m = (getKv("fridayMixes", {}) || {})[week]; return m ? { week, ...m } : null; }
