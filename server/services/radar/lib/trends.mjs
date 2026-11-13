import { DAY } from "./config.mjs";

const dayIndex = (t, ts, days) => days - 1 - Math.floor((t - ts) / DAY); // 0 = oldest, days-1 = today

// Per-artist daily buzz (max score per day) + status
export function riseData(snaps, t, days = 14) {
  const series = new Map(), names = new Map(), firstTs = new Map();
  for (const s of snaps) {
    const i = dayIndex(t, s.ts, days);
    if (i < 0 || i >= days || s.kind === "album") continue;
    if (!series.has(s.key)) series.set(s.key, Array(days).fill(0));
    const arr = series.get(s.key);
    arr[i] = Math.max(arr[i], s.score);
    names.set(s.key, s.artist);
    if (!firstTs.has(s.key) || s.ts < firstTs.get(s.key)) firstTs.set(s.key, s.ts);
  }
  const rows = [];
  for (const [key, arr] of series) {
    const cur = Math.max(arr[days - 1], arr[days - 2] || 0);
    const weekAgo = Math.max(...arr.slice(Math.max(0, days - 9), days - 6));
    const peak = Math.max(...arr);
    const peakDay = arr.lastIndexOf(peak);
    let status;
    if (t - firstTs.get(key) < 2 * DAY) status = "new";
    else if (cur >= 0.8 * peak && cur > weekAgo) status = "climbing";
    else if (peakDay < days - 3 && cur < 0.5 * peak) status = "fading";
    else status = "peaked";
    rows.push({ key, artist: names.get(key), series: arr, cur, weekAgo, delta: cur - weekAgo, peak, status });
  }
  rows.sort((a, b) => b.delta - a.delta);
  const labels = Array.from({ length: days }, (_, i) =>
    new Date((t - (days - 1 - i) * DAY) * 1000).toISOString().slice(5, 10));
  return { labels, risers: rows.slice(0, 15), top: [...rows].sort((a, b) => b.cur - a.cur).slice(0, 6), all: rows };
}

// Compare the last 7 days to the 3 weeks before (per-week rate). Works for genres and buzzwords.
export function momentum(rows, t, field, minTotal = 3) {
  const recent = {}, prior = {};
  for (const r of rows) {
    const age = t - r.ts;
    if (age < 7 * DAY) recent[r[field]] = (recent[r[field]] || 0) + r.n;
    else if (age < 28 * DAY) prior[r[field]] = (prior[r[field]] || 0) + r.n;
  }
  const keys = new Set([...Object.keys(recent), ...Object.keys(prior)]);
  const out = [];
  for (const k of keys) {
    const r = recent[k] || 0, p = (prior[k] || 0) / 3;
    if (r + (prior[k] || 0) < minTotal) continue;
    out.push({ name: k, thisWeek: r, perWeekBefore: +p.toFixed(1), change: p ? (r - p) / p : null, isNew: !p && r > 0 });
  }
  return out.sort((a, b) => (b.change ?? 99) - (a.change ?? 99) || b.thisWeek - a.thisWeek);
}

// Which subreddits post an artist first, and how far ahead of the others.
export function subLeadTimes(artists) {
  const stats = {};
  for (const a of Object.values(artists)) {
    const seen = Object.entries(a.firstSeen || {});
    if (seen.length < 2) continue;
    const first = Math.min(...seen.map(([, ts]) => ts));
    const last = Math.max(...seen.map(([, ts]) => ts));
    for (const [sub, ts] of seen) {
      const s = (stats[sub] ||= { sub, samples: 0, firsts: 0, lagHours: 0, leadHours: 0 });
      s.samples++;
      s.lagHours += (ts - first) / 3600;
      if (ts === first) { s.firsts++; s.leadHours += (last - first) / 3600; }
    }
  }
  return Object.values(stats).map((s) => ({
    sub: s.sub, samples: s.samples, firstShare: s.firsts / s.samples,
    avgLagHours: s.lagHours / s.samples, avgLeadHours: s.firsts ? s.leadHours / s.firsts : 0,
  })).sort((a, b) => b.firstShare - a.firstShare || a.avgLagHours - b.avgLagHours);
}

// Early-warning subs get more weight in scoring (needs 3+ shared artists to count).
export function subWeights(artists) {
  const w = {};
  for (const s of subLeadTimes(artists)) if (s.samples >= 3) w[s.sub] = +(1 + 0.5 * (s.firstShare - 0.3)).toFixed(2);
  return w;
}

export function soundsLikeGraph(edges, liked = new Set(), maxEdges = 120) {
  const top = Object.values(edges).sort((a, b) => b.n - a.n).slice(0, maxEdges);
  const nodes = new Map();
  for (const e of top) for (const [k, name] of [[e.a, e.aName], [e.b, e.bName]]) {
    const n = nodes.get(k) || { id: k, name, degree: 0, liked: liked.has(k) };
    n.degree += e.n; nodes.set(k, n);
  }
  return { nodes: [...nodes.values()], links: top.map((e) => ({ source: e.a, target: e.b, n: e.n })) };
}
