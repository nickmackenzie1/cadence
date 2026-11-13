// The other sources, ready for the dashboard: each source on its own, everything combined per artist, and trends.
import { now, DAY } from "./config.mjs";
import * as store from "./store.mjs";
import { momentum } from "./trends.mjs";
import { SOURCES, DEFAULT_CFG, tagsFor } from "./sources.mjs";

// how much one signal from each source counts in the combined score (blogs and Hype Machine are the early-buzz signals)
const WEIGHT = { reddit: 3, blogs: 3, hypem: 3, audius: 2, bandcamp: 1.5, listenbrainz: 1.5, apple: 1, lastfm: 1 };
const CHARTS = new Set(["apple", "audius", "lastfm", "hypem"]);
export const sourcesCfg = () => { const c = store.getKv("sourcesCfg", {}) || {}; return { ...DEFAULT_CFG, ...c, on: { ...DEFAULT_CFG.on, ...(c.on || {}) } }; };

export function sourcesData(state, snaps) {
  const t = now(), cfg = sourcesCfg();
  if (!store.usingDb()) return { available: false, note: store.storageNote };
  const sig = store.signals({ since: t - 60 * DAY, limit: 20000 });
  const runs = Object.fromEntries(store.sourceRuns().map((r) => [r.source, r]));
  const bySource = {};
  for (const s of sig) (bySource[s.source] ||= []).push(s);

  // chart movement over the last 14 days: first position seen vs now
  const pts = store.chartPoints({ since: t - 14 * DAY }), firstRank = new Map();
  for (const p of pts) { const k = p.source + "|" + p.uid; if (!firstRank.has(k)) firstRank.set(k, p.rank); }

  // ---- each source ----
  const list = Object.entries(SOURCES).map(([id, src]) => {
    const rows = bySource[id] || [], latest = rows.length ? Math.max(...rows.map((r) => r.last_seen)) : 0;
    const current = rows.filter((r) => r.last_seen === latest);
    const items = (CHARTS.has(id) ? current.sort((a, b) => (a.feed || "").localeCompare(b.feed || "") || (a.rank ?? 999) - (b.rank ?? 999)) : rows.slice(0, 60))
      .slice(0, 120).map((r) => ({ ...r, was: firstRank.get(id + "|" + r.uid) ?? null }));
    return { id, name: src.name, kind: src.kind, site: src.site, on: !!cfg.on[id], needs: src.needs || null, missing: !!(src.needs && !process.env[src.needs]),
      run: runs[id] || null, total: rows.length, week: rows.filter((r) => t - r.first_seen < 7 * DAY).length, chart: CHARTS.has(id), items,
      feeds: [...new Set(items.map((r) => r.feed).filter(Boolean))] };
  });

  // ---- Reddit, so it combines with the rest ----
  const reddit = new Map();
  for (const p of state.picks) if (t - p.ts < 30 * DAY) { const r = reddit.get(p.key) || { n: 0, first: p.ts, title: null, url: null, artist: p.artist }; r.n++; r.first = Math.min(r.first, p.ts); r.title ||= p.song; r.url ||= p.link; reddit.set(p.key, r); }
  const buzz = new Map();
  for (const s of snaps || []) if (s.kind === "artist" && t - s.ts < 7 * DAY) buzz.set(s.key, Math.max(buzz.get(s.key) || 0, s.score || 0));

  // ---- combined per artist, last 30 days ----
  const A = new Map(), get = (key, name) => { let a = A.get(key); if (!a) A.set(key, (a = { key, artist: name, sources: {}, n: 0, first: Infinity, last: 0, score: 0, titles: [], genres: {} })); return a; };
  for (const s of sig) {
    if (t - s.last_seen > 30 * DAY) continue;
    const a = get(s.artist_key, s.artist), age = Math.max(0, (t - s.first_seen) / DAY);
    a.sources[s.source] = (a.sources[s.source] || 0) + 1; a.n++;
    a.first = Math.min(a.first, s.first_seen); a.last = Math.max(a.last, s.last_seen);
    const rankBonus = s.best_rank ? Math.max(0, (51 - s.best_rank) / 50) : 0;
    a.score += (WEIGHT[s.source] || 1) * (1 + rankBonus) * Math.pow(0.5, age / 10);
    if (a.titles.length < 3 && s.title && s.title !== s.artist && !a.titles.some((x) => x.title === s.title)) a.titles.push({ title: s.title, url: s.url, source: s.source });
    for (const g of String(s.genres || "").split(", ").filter(Boolean)) a.genres[g] = (a.genres[g] || 0) + 1;
  }
  for (const [key, r] of reddit) {
    const a = get(key, r.artist); a.sources.reddit = r.n; a.n += r.n; a.first = Math.min(a.first, r.first); a.last = Math.max(a.last, r.first);
    a.score += WEIGHT.reddit * (1 + Math.min(1, (buzz.get(key) || 0) / 100)) * Math.pow(0.5, Math.max(0, (t - r.first) / DAY) / 10);
    if (r.title && a.titles.length < 3) a.titles.unshift({ title: r.title, url: r.url, source: "reddit" });
  }
  const combined = [...A.values()].map((a) => {
    const n = Object.keys(a.sources).length;
    return { ...a, breadth: n, score: +(a.score * (1 + 0.5 * (n - 1))).toFixed(2), genres: Object.entries(a.genres).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([g]) => g) };
  }).sort((a, b) => b.breadth - a.breadth || b.score - a.score);

  // ---- trends ----
  const days = 30, labels = [], idx = new Map();
  for (let d = days - 1; d >= 0; d--) { const day = new Date((t - d * DAY) * 1000).toISOString().slice(0, 10); idx.set(day, labels.length); labels.push(day.slice(5)); }
  const perDay = {};
  const bump = (src, ts) => { const i = idx.get(new Date(ts * 1000).toISOString().slice(0, 10)); if (i == null) return; (perDay[src] ||= Array(days).fill(0))[i]++; };
  for (const s of sig) bump(s.source, s.first_seen);
  for (const p of state.picks) bump("reddit", p.ts);
  const name = (id) => (id === "reddit" ? "Reddit" : SOURCES[id]?.name || id);
  const genreRows = [];
  for (const s of sig) for (const g of String(s.genres || "").split(", ").filter(Boolean)) genreRows.push({ ts: s.first_seen, genre: g.toLowerCase(), n: 1 });

  // ---- crossover: your Reddit picks that turned up on the Apple chart, and chart movers ----
  const apple = new Map(); for (const s of bySource.apple || []) { const c = apple.get(s.artist_key); if (!c || (s.best_rank ?? 999) < (c.best_rank ?? 999)) apple.set(s.artist_key, s); }
  const crossover = [];
  for (const p of state.picks) { const a = apple.get(p.key); if (a && !crossover.some((c) => c.key === p.key)) crossover.push({ key: p.key, artist: p.artist, picked: p.ts, charted: a.first_seen, rank: a.best_rank, feed: a.feed, url: a.url }); }
  const movers = [];
  for (const s of sig) {
    if (!CHARTS.has(s.source) || s.rank == null) continue;
    const was = firstRank.get(s.source + "|" + s.uid);
    if (was != null && was - s.rank >= 5 && t - s.last_seen < 2 * DAY) movers.push({ source: s.source, artist: s.artist, title: s.title, feed: s.feed, was, now: s.rank, url: s.url });
  }
  movers.sort((a, b) => (b.was - b.now) - (a.was - a.now));
  const movesOnce = []; const once = new Set(); for (const m of movers) { const k = m.source + "|" + m.artist + "|" + m.title; if (!once.has(k)) { once.add(k); movesOnce.push(m); } }

  return {
    available: true, cfg: { ...cfg, tagsUsed: tagsFor(cfg, state) }, list,
    combined: combined.slice(0, 60), multi: combined.filter((a) => a.breadth >= 2).length,
    perDay: { labels, series: Object.entries(perDay).map(([id, data]) => ({ id, label: name(id), data })).sort((a, b) => b.data.reduce((x, y) => x + y, 0) - a.data.reduce((x, y) => x + y, 0)) },
    genres: momentum(genreRows, t, "genre").slice(0, 16),
    crossover: crossover.sort((a, b) => b.charted - a.charted).slice(0, 20),
    movers: movesOnce.slice(0, 20),
    alsoOn: Object.fromEntries(combined.filter((a) => Object.keys(a.sources).some((s) => s !== "reddit")).map((a) => [a.key, Object.keys(a.sources).filter((s) => s !== "reddit")])),
  };
}
