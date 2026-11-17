// One daily buzz score per artist from every source, for the front page (who's climbing, fastest risers, albums,
// genres). Before 2026-11-16 those came from the Lemmy/Mastodon scan alone.
//  - community scan: that day's best score for the artist (scaled so a typical top pick ≈ 1)
//  - a new mention (blog post, KEXP release, Bandcamp, ListenBrainz, earshot entry…): its source weight, once, the day it appeared
//  - KEXP played it again: half weight on the day of the latest play
//  - charts: every day on a chart counts a little, more near the top
// Each day's events fade with a 5-day half-life, and artists turning up in several sources in the same week get a boost.
import { DAY } from "./config.mjs";
import { riseData } from "./trends.mjs";
import { isArtist, cleanName, norm } from "./extract.mjs";

const HALF = 5, LOOKBACK = 10;
const rankBonus = (r) => (r ? Math.max(0, (51 - r) / 50) : 0);

export function allBuzz({ t, snaps, sig, pts, weight, communityWeight, chartSet, hide, name, days = 14 }) {
  const D = days + LOOKBACK, dayOf = (ts) => D - 1 - Math.floor((t - ts) / DAY);
  const skip = (artist) => !isArtist(artist) || hide?.has(norm(artist));
  const A = new Map();
  const add = (key, artist, i, w, src) => {
    if (i < 0 || i >= D || !(w > 0)) return;
    let a = A.get(key); if (!a) A.set(key, (a = { key, artist, ev: Array(D).fill(0), src: Array.from({ length: D }, () => new Set()) }));
    a.ev[i] += w; a.src[i].add(src);
  };

  // community scan: best score per day, scaled by a typical strong score so it sits alongside the other sources
  const cs = snaps.filter((s) => s.kind !== "album").map((s) => s.score).filter((x) => x > 0).sort((a, b) => a - b);
  const scale = cs.length ? cs[Math.floor(cs.length * 0.9)] || 1 : 1;
  const best = new Map();
  for (const s of snaps) if (s.kind !== "album" && !skip(s.artist)) { const k = s.key + "|" + dayOf(s.ts); const b = best.get(k); if (!b || s.score > b.score) best.set(k, s); }
  for (const s of best.values()) add(s.key, s.artist, dayOf(s.ts), communityWeight * Math.min(2, s.score / scale), "community");

  // source signals: once when first seen; KEXP again when played again
  const byUid = new Map();
  for (const s of sig) {
    if (skip(s.artist)) continue;
    byUid.set(s.source + "|" + s.uid, s);
    if (chartSet.has(s.source) && s.best_rank != null) continue;   // ranked chart entries count per day below (KEXP Adds have no rank: one mention)
    const w = weight(s) * (1 + rankBonus(s.best_rank));
    add(s.artist_key, cleanName(s.artist) || s.artist, dayOf(s.first_seen), w, s.source);
    if (s.source === "kexp" && dayOf(s.last_seen) !== dayOf(s.first_seen)) add(s.artist_key, cleanName(s.artist) || s.artist, dayOf(s.last_seen), w / 2, s.source);
  }
  // charts: a little for each day on the chart (best position that day)
  const onChart = new Map();
  for (const p of pts) {
    const s = byUid.get(p.source + "|" + p.uid); if (!s) continue;
    // one count per artist, chart source and day, however many tracks or genre charts they're on
    const k = p.source + "|" + s.artist_key + "|" + dayOf(p.ts), r = onChart.get(k);
    if (!r || p.rank < r.rank) onChart.set(k, { s, rank: p.rank, i: dayOf(p.ts) });
  }
  for (const { s, rank, i } of onChart.values()) add(s.artist_key, cleanName(s.artist) || s.artist, i, weight(s) * 0.25 * (1 + rankBonus(rank)), s.source);

  // decay + several-sources boost → one value per day for the last `days` days, scaled so the top artist is 100
  const fake = [], sources = {}, labelTs = (i) => t - (D - 1 - i) * DAY, vals = [];
  for (const a of A.values()) {
    let acc = 0;
    const v = a.ev.map((e, i) => (acc = acc * Math.pow(0.5, 1 / HALF) + e));
    for (let i = LOOKBACK; i < D; i++) {
      const week = new Set(); for (let j = Math.max(0, i - 6); j <= i; j++) for (const x of a.src[j]) week.add(x);
      const val = v[i] * (1 + 0.35 * Math.max(0, week.size - 1));
      if (val > 0) vals.push({ ts: labelTs(i), kind: "artist", key: a.key, artist: a.artist, score: val });
      if (i === D - 1) sources[a.key] = [...week].map(name);
    }
  }
  const top = Math.max(1e-9, ...vals.map((x) => x.score));
  for (const x of vals) { x.score = +(x.score / top * 100).toFixed(1); if (x.score >= 0.5) fake.push(x); }
  const rise = riseData(fake, t, days);
  for (const r of [...rise.risers, ...rise.top]) r.sources = sources[r.key] || [];
  // a riser needs real buzz: a second source, or one that isn't just ListenBrainz's list of new releases
  const real = rise.risers.filter((r) => r.sources.length > 1 || (r.sources.length === 1 && r.sources[0] !== name("listenbrainz")));
  if (real.length >= 3) rise.risers = real;
  delete rise.all;
  return rise;
}

// releases from every source over the last 7 days: community album posts, blog reviews, KEXP, earshot, Bandcamp…
export function allAlbums({ t, snaps, sig, weight, communityWeight, hide, name, limit = 12 }) {
  const R = new Map(), age = (ts) => Math.max(0, (t - ts) / DAY);
  const get = (artist, title, type, link) => {
    const k = norm(artist) + "|" + norm(title); let r = R.get(k);
    if (!r) R.set(k, (r = { key: k, artist: cleanName(artist) || artist, album: title, type: type || "album", link: link || null, score: 0, where: new Set(), subs: [] }));
    return r;
  };
  const cs = snaps.filter((s) => s.kind === "album").map((s) => s.score).sort((a, b) => a - b), scale = cs.length ? cs[Math.floor(cs.length * 0.9)] || 1 : 1;
  const bestC = new Map();
  for (const s of snaps) if (s.kind === "album" && age(s.ts) < 7 && s.album && isArtist(s.artist) && !hide?.has(norm(s.artist))) { const b = bestC.get(s.key); if (!b || s.score > b.score) bestC.set(s.key, s); }
  for (const s of bestC.values()) { const r = get(s.artist, s.album, s.type, s.link); r.score += communityWeight * Math.min(2, s.score / scale) * 10; for (const x of s.subs || []) r.where.add(x); }
  for (const s of sig) {
    if (!/^(album|ep|release)$/.test(s.type || "") || !s.title || s.title === s.artist || age(s.last_seen) > 7 || !isArtist(s.artist) || hide?.has(norm(s.artist))) continue;
    const r = get(s.artist, s.title, s.type, s.url); r.link ||= s.url;
    r.score += weight(s) * (1 + rankBonus(s.best_rank)) * Math.pow(0.5, age(s.first_seen) / 10) * 10;
    r.where.add(s.source === "blogs" ? s.feed || name(s.source) : name(s.source));
  }
  const out = [...R.values()].map((r) => ({ ...r, score: r.score * (1 + 0.35 * (r.where.size - 1)), subs: [...r.where] })).sort((a, b) => b.score - a.score);
  const top = out[0]?.score || 1;
  return out.slice(0, limit).map(({ where, ...r }) => ({ ...r, score: +(r.score / top * 100).toFixed(1) }));
}
