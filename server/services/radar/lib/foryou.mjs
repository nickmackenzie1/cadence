// For you (user, 2026-11-16: "it learns your taste"): Music Radar's picks, ranked for you, with a plain reason.
// It learns from what you do, all kept on the NAS:
//   follows (+5), Want to hear (+3), a pick you thumbed up (+3) or down (-3),
//   previews you let play (+1 each, up to 3) or stopped in the first few seconds (-0.5 each, down to -2),
//   songs you heard on a station for a minute or more (+1 each, up to 4)
// Those artists' genres become your genre weights; artists mentioned alongside ones you like get a bump.
// "Not for me" (artists, genres, sources) hides them everywhere in Radar and counts against them here.
import { now, DAY } from "./config.mjs";
import { getKv, setKv, listensSince, signalsFor, alikeAll } from "./store.mjs";
import { norm, cleanGenre } from "./extract.mjs";
import { UMBRELLA } from "./sources-data.mjs";
import { lbCached, mbidOf } from "./similar.mjs";

const NFM_KEY = "notForMe";
export function nfmCfg() {
  const c = getKv(NFM_KEY, null) || {};
  return { artists: c.artists || [], genres: c.genres || [], sources: c.sources || [] };
}
// type: artist | genre | source; value: the name (a source is its id, or "blog:<name>" for one blog)
export function setNfm(type, value, on = true) {
  const c = nfmCfg(), list = { artist: "artists", genre: "genres", source: "sources" }[type];
  if (!list || !value) return c;
  const v = String(value).trim().slice(0, 120), k = (x) => (type === "artist" ? norm(x) : String(x).toLowerCase());
  c[list] = c[list].filter((x) => k(x) !== k(v));
  if (on) c[list].unshift(v);
  c[list] = c[list].slice(0, 500);
  setKv(NFM_KEY, c);
  return c;
}
export const nfmSourceOff = (cfg, source, feed) => cfg.sources.includes(source) || (source === "blogs" && feed && cfg.sources.includes("blog:" + feed));

// genres Cadence knows for an artist: Radar's own, every source's tags, MusicBrainz's (if looked up)
export function genresOf(key, state) {
  const g = new Map(), add = (x, w = 1) => { const c = cleanGenre ? cleanGenre(x) : x; if (c && !UMBRELLA.has(String(c).toLowerCase())) g.set(String(c).toLowerCase(), (g.get(String(c).toLowerCase()) || 0) + w); };
  for (const [x, n] of Object.entries(state?.artists?.[key]?.genres || {})) add(x, n);
  try { for (const s of signalsFor(key, 60)) for (const x of String(s.genres || "").split(", ").filter(Boolean)) add(x); } catch {}
  try { for (const x of (getKv("mba:" + key) || {}).tags || []) add(x, 2); } catch {}
  return g;
}

export function tasteProfile(state) {
  const A = new Map();   // artist key -> { name, w, why }
  const bump = (name, w, why) => {
    if (!name) return; const k = norm(name); if (!k) return;
    const a = A.get(k) || { key: k, name, w: 0, why: null, whyW: 0 };
    a.w += w; if (w > a.whyW) { a.why = why; a.whyW = w; }
    A.set(k, a);
  };
  for (const f of getKv("follows", []) || []) bump(f.name, 5, `you follow ${f.name}`);
  for (const x of getKv("wantToHear", []) || []) bump(x.artist, 3, `${x.artist} is in your Want to hear`);
  // your records on Discogs: an artist you own counts (more records, a bit more), and one on your wantlist
  const dg = getKv("discogs");
  if (dg) {
    const owned = new Map(); for (const r of dg.collection || []) for (const a of String(r.artist).split(/,\s*/)) owned.set(a, (owned.get(a) || 0) + 1);
    for (const [a, n] of owned) if (!/^various/i.test(a)) bump(a, Math.min(5, 2 + n), `you own ${n === 1 ? 'a record' : n + ' records'} by ${a}`);
    for (const r of dg.wants || []) for (const a of String(r.artist).split(/,\s*/)) if (!/^various/i.test(a)) bump(a, 3, `${a} is on your Discogs wantlist`);
  }
  for (const p of state?.picks || []) { const v = state.feedback?.[p.id]; if (v) bump(p.artist, v > 0 ? 3 : -3, `you liked a pick by ${p.artist}`); }
  // listening: capped per artist so one long session doesn't swamp everything
  const per = new Map();
  for (const l of listensSince(now() - 365 * DAY)) {
    if (!l.artist) continue;
    const c = per.get(l.artist_key) || { name: l.artist, play: 0, skip: 0, live: 0 }; per.set(l.artist_key, c);
    if (l.kind === "preview") { if (l.skipped && l.secs < 8) c.skip++; else if (l.secs >= 20) c.play++; }
    else if (l.secs >= 60) c.live++;
  }
  for (const c of per.values()) {
    if (c.play) bump(c.name, Math.min(3, c.play), `you played previews of ${c.name}`);
    if (c.live) bump(c.name, Math.min(4, c.live), `you heard ${c.name} on the radio`);
    if (c.skip) bump(c.name, -Math.min(2, c.skip * 0.5), null);
  }
  const nfm = nfmCfg();
  for (const a of nfm.artists) bump(a, -10, null);
  // genre weights from the artists you like (and against the ones you don't)
  const G = new Map();
  for (const a of A.values()) for (const [g, n] of genresOf(a.key, state)) G.set(g, (G.get(g) || 0) + Math.sign(a.w) * Math.min(3, Math.abs(a.w)) * Math.min(1, n / 2));
  for (const g of nfm.genres) G.set(g.toLowerCase(), -10);
  const top = Math.max(1, ...[...G.values()].filter((v) => v > 0));
  const genres = new Map([...G].map(([g, v]) => [g, v / top]));
  return { artists: A, genres, nfm, any: [...A.values()].some((a) => a.w > 0) };
}

// pool: [{ artist, score (buzz), ... }] from Radar; returns the best for you with a reason
export function forYou(state, pool, { limit = 12 } = {}) {
  const P = tasteProfile(state);
  if (!P.any) return { list: [], note: "Follow a few artists, save some to Want to hear, or play previews, and picks for you show up here." };
  const liked = [...P.artists.values()].filter((a) => a.w > 0);
  const likedKeys = new Map(liked.map((a) => [a.key, a]));
  // one pass over the "sounds like" edges: for each artist next to someone you like, the strongest such link
  // (was once per candidate: 300 × 150k edges, 2026-11-17)
  const nearBy = new Map();
  for (const e of Object.values(state?.edges || {})) for (const [me, other] of [[e.a, e.b], [e.b, e.a]]) {
    const l = likedKeys.get(other); if (!l) continue; const w = l.w * Math.min(3, e.n || 1), cur = nearBy.get(me);
    if (!cur || w > cur.w) nearBy.set(me, { l, w });
  }
  // a blog writer saying "sounds like" someone you like counts as much as being talked about together three times
  let alike = []; try { alike = alikeAll(); } catch {}
  for (const e of alike) for (const [me, other] of [[e.a, e.b], [e.b, e.a]]) {
    const l = likedKeys.get(other); if (!l) continue; const w = l.w * Math.min(4, 2 + e.n), cur = nearBy.get(me);
    if (!cur || w > cur.w) nearBy.set(me, { l, w, said: true });
  }
  // ListenBrainz: artists played in the same sessions as ones you like (cached ones only; the lb-similar job fetches)
  for (const l of liked) for (const o of lbCached(mbidOf(l.name)) || []) {
    const me = norm(o.name), w = l.w * Math.min(3, 3 * o.match), cur = nearBy.get(me);
    if (me && w > 0.3 && (!cur || w > cur.w)) nearBy.set(me, { l, w, lb: true });
  }
  const walk = walkFrom(state, liked, alike);
  const maxBuzz = Math.max(1, ...pool.map((x) => x.score || 0));
  const seen = new Set(), out = [];
  for (const x of pool) {
    const k = norm(x.artist || ""); if (!k || seen.has(k)) continue; seen.add(k);
    const mine = P.artists.get(k);
    if (mine && (mine.w >= 3 || mine.w < 0)) continue;   // already yours (followed, saved), or not for you
    // mentioned alongside someone you like
    const nb = nearBy.get(k), near = nb ? nb.l : null, nearW = nb ? nb.w : 0, said = !!nb?.said, lb = !!nb?.lb;
    // further out: two or three steps from someone you like (only counts when nothing closer does)
    const wk = !near ? walk.get(k) : null;
    const g = genresOf(k, state); let gScore = 0, gBest = null, gBestW = 0;
    for (const [name, n] of g) { const w = P.genres.get(name) || 0; gScore += w * Math.min(1, n / 2); if (w > gBestW) { gBest = name; gBestW = w; } }
    if ([...g.keys()].some((name) => (P.genres.get(name) || 0) <= -10)) continue;   // a genre you said no to
    gScore = Math.max(-1, Math.min(2, gScore));
    const buzz = (x.score || 0) / maxBuzz;
    const score = buzz * 0.6 + gScore * 0.9 + (near ? Math.min(1.5, nearW / 5) : 0) + (wk ? 0.8 * wk.s : 0) + (mine ? mine.w * 0.15 : 0);
    if (score <= 0.35 || (!near && !wk && gScore <= 0.05 && !(mine && mine.w > 0))) continue;
    const why = near ? (said ? `a blog says they sound like ${near.name}` : lb ? `people who play ${near.name} play them too` : `mentioned alongside ${near.name}`)
      : wk ? `a couple of steps from ${wk.seed} (through ${wk.via})` : mine && mine.w > 0 ? mine.why : gBest ? `you like ${gBest}` : "climbing on Radar";
    out.push({ artist: x.artist, title: x.title || x.album || null, type: x.type || null, score: +score.toFixed(3), why, because: near ? near.name : wk ? wk.seed : null, genre: gBest });
  }
  out.sort((a, b) => b.score - a.score);
  return { list: out.slice(0, limit), genres: [...P.genres].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([g, v]) => ({ genre: g, w: +v.toFixed(2) })) };
}

// ---- a walk out from what you like (2026-11-17) ----
// Personalised PageRank over Radar's links (mentioned together twice or more, blogs' "sounds like", ListenBrainz):
// start on the artists you like, step along links in proportion to their strength, come back home 35% of the time.
// Three steps reach artists two or three links away. Each artist remembers which of yours it came from, and through whom.
// Returns key -> { s (0..1, against the strongest), seed, via }, for artists not one step from yours.
export function walkFrom(state, liked, alike = []) {
  const adj = new Map(), link = (a, b, w) => { if (!a || !b || a === b || !(w > 0)) return; let m = adj.get(a); if (!m) adj.set(a, (m = new Map())); m.set(b, (m.get(b) || 0) + w); };
  for (const e of Object.values(state?.edges || {})) if ((e.n || 1) >= 2) { const w = Math.min(4, e.n); link(e.a, e.b, w); link(e.b, e.a, w); }
  for (const e of alike) { const w = Math.min(4, 2 + e.n); link(e.a, e.b, w); link(e.b, e.a, w); }
  for (const l of liked) for (const o of lbCached(mbidOf(l.name)) || []) { const k = norm(o.name); link(l.key, k, 3 * o.match); link(k, l.key, 3 * o.match); }
  const seeds = liked.filter((a) => adj.has(a.key)); if (!seeds.length) return new Map();
  const tot = seeds.reduce((t, a) => t + a.w, 0), home = new Map(seeds.map((a) => [a.key, a.w / tot]));
  const BACK = 0.35, name = (k) => state?.artists?.[k]?.name || liked.find((a) => a.key === k)?.name || k.replace(/\b\w/g, (c) => c.toUpperCase());
  let p = new Map(home), from = new Map(seeds.map((a) => [a.key, { seed: a.name, via: null }]));
  for (let step = 0; step < 3; step++) {
    const next = new Map([...home].map(([k, v]) => [k, BACK * v])), best = new Map(), nfrom = new Map(from);
    for (const [u, pu] of p) {
      const m = adj.get(u); if (!m) continue;
      let sum = 0; for (const w of m.values()) sum += w;
      for (const [v, w] of m) {
        const add = (1 - BACK) * pu * w / sum; next.set(v, (next.get(v) || 0) + add);
        if (add > (best.get(v) || 0)) { best.set(v, add); const f = from.get(u); if (f) nfrom.set(v, { seed: f.seed, via: f.via || (home.has(u) ? null : name(u)) }); }
      }
    }
    p = next; from = nfrom;
  }
  // one step away is already counted by nearBy; liked artists themselves aren't candidates
  const oneStep = new Set(); for (const a of seeds) for (const k of adj.get(a.key).keys()) oneStep.add(k);
  const out = new Map(); let top = 0;
  for (const [k, v] of p) if (!home.has(k) && !oneStep.has(k) && from.get(k)?.via) { out.set(k, v); if (v > top) top = v; }
  return new Map([...out].map(([k, v]) => [k, { s: +(v / (top || 1)).toFixed(3), ...from.get(k) }]));
}
