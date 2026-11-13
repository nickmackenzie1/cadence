import { WINDOW_HOURS } from "./config.mjs";
import { norm } from "./extract.mjs";

// HN-style gravity: votes decay with age, comments show engagement.
export function hotness(p, t) {
  const ageH = Math.max((t - p.created) / 3600, 0.1);
  const votes = Math.max(p.score, 0);
  const engagement = Math.log1p(votes) + 0.7 * Math.log1p(p.comments);
  const velocity = votes / (ageH + 2) ** 1.5;
  return engagement + 2 * Math.log1p(velocity) + (p.ratio - 0.5) * 2;
}

/**
 * Groups posts by artist (and separately by album/EP) and scores them.
 * ctx: { now, subWeights, taste, ext }
 */
export function buildCandidates(posts, ctx) {
  const { now: t, subWeights = {}, taste, ext } = ctx;
  const groups = new Map();
  const add = (key, item) => { if (!groups.has(key)) groups.set(key, []); groups.get(key).push(item); };

  for (const p of posts) {
    if (t - p.created > WINDOW_HOURS * 3600 || p.created > t) continue;
    const e = ext[p.id];
    if (!e?.music) continue;
    if (e.artist) {
      const key = norm(e.artist);
      if (key) add(key, { p, e, w: 1, direct: true });
    }
    // artists recommended in comments count as weaker mentions
    for (const m of e.mentioned || []) {
      const key = norm(m);
      if (key && key !== norm(e.artist || "")) add(key, { p, e: { ...e, artist: m, song: null, genres: [] }, w: 0.3, direct: false });
    }
  }

  const out = [];
  for (const [key, items] of groups) {
    const direct = items.filter((i) => i.direct);
    const heat = items.reduce((s, i) => s + hotness(i.p, t) * i.w * (subWeights[i.p.sub] || 1), 0);
    const subs = [...new Set(items.map((i) => i.p.sub))].sort();
    const mentions = items.length;
    const fresh = direct.some((i) => i.e.fresh);
    const sentiments = direct.filter((i) => i.e.sentiment).map((i) => i.e.sentiment);
    const sentiment = sentiments.length ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length : 0;
    const genreCount = {};
    for (const i of direct) for (const g of i.e.genres || []) genreCount[g] = (genreCount[g] || 0) + 1;
    const genres = Object.entries(genreCount).sort((a, b) => b[1] - a[1]).map(([g]) => g).slice(0, 4);
    const best = (direct.length ? direct : items).reduce((a, b) => (hotness(b.p, t) > hotness(a.p, t) ? b : a));
    const albums = direct.filter((i) => i.e.type !== "track");
    const c = {
      key, kind: "artist", artist: best.e.artist, song: best.e.song, type: best.e.type || "track",
      heat, mentions, subs, fresh, sentiment, genres,
      upvotes: direct.reduce((s, i) => s + i.p.score, 0),
      comments: direct.reduce((s, i) => s + i.p.comments, 0),
      link: best.direct ? (best.p.url || best.p.permalink) : best.p.permalink,
      thread: best.p.permalink, commentOnly: !direct.length,
      titles: items.slice(0, 5).map((i) => i.p.title),
      album: albums.length ? albums.reduce((a, b) => (hotness(b.p, t) > hotness(a.p, t) ? b : a)) : null,
    };
    const sentimentFactor = Math.max(0.6, Math.min(1.3, 1 + 0.35 * sentiment)); // backlash sinks, love lifts
    c.tasteFactor = taste ? taste.factor(c) : 1;
    c.score = heat * (1 + 0.6 * (subs.length - 1)) * (1 + 0.25 * Math.log1p(mentions - 1))
      * (fresh ? 1.2 : 1) * sentimentFactor * c.tasteFactor;
    out.push(c);
  }
  return out.sort((a, b) => b.score - a.score);
}

// Album/EP leaderboard: one row per release, scored on that release's own posts.
export function albumBoard(cands) {
  return cands.filter((c) => c.album).map((c) => ({
    key: c.key + "::" + norm(c.album.e.song), artist: c.artist, album: c.album.e.song, type: c.album.e.type,
    score: c.score, subs: c.subs, genres: c.genres, link: c.album.p.url || c.album.p.permalink, thread: c.album.p.permalink,
  })).sort((a, b) => b.score - a.score);
}
