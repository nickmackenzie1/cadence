// Years of trends from the Arctic Shift Reddit archive (free, no login).
import fs from "node:fs";
import path from "node:path";
import { DATA } from "./config.mjs";
import { httpJson } from "./http.mjs";
import { norm } from "./extract.mjs";

const FILE = path.join(DATA, "history.json");
export const loadHistory = () => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return {}; } };
export const saveHistory = (h) => fs.writeFileSync(FILE, JSON.stringify(h));

export async function archivePage(sub, afterIso, limit = 100) {
  const url = `https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=${encodeURIComponent(sub)}`
    + `&after=${afterIso}&sort=asc&limit=${limit}`;
  const d = await httpJson(url);
  return (d.data || []).map((p) => ({
    id: p.id, sub, title: p.title || "", score: p.score ?? 0, comments: p.num_comments ?? 0,
    created: p.created_utc, url: p.url || "", permalink: "https://reddit.com" + (p.permalink || ""),
  }));
}

// Fold one month's extracted posts into compact counts.
export function aggregateMonth(posts, ext) {
  const m = { posts: posts.length, music: 0, genres: {}, artists: {}, albums: {} };
  for (const p of posts) {
    const e = ext[p.id];
    if (!e?.music || !e.artist) continue;
    m.music++;
    for (const g of e.genres || []) m.genres[g] = (m.genres[g] || 0) + 1;
    const key = norm(e.artist);
    const a = (m.artists[key] ||= { name: e.artist, n: 0, score: 0 });
    a.n++; a.score += Math.max(0, p.score);
    if (e.type !== "track" && e.song) {
      const ak = key + "::" + norm(e.song);
      const al = (m.albums[ak] ||= { artist: e.artist, album: e.song, type: e.type, n: 0, score: 0 });
      al.n++; al.score += Math.max(0, p.score);
    }
  }
  // keep files small: only artists/albums that showed up more than once, or scored well
  m.artists = Object.fromEntries(Object.entries(m.artists).filter(([, a]) => a.n > 1 || a.score >= 50));
  return m;
}

// ---------- analysis ----------
export function historyTrends(hist, { topGenres = 8 } = {}) {
  const years = {};               // year -> { music, genres, artists, albums }
  const months = {};              // "YYYY-MM" -> { music, genres }
  for (const subMonths of Object.values(hist)) {
    for (const [month, m] of Object.entries(subMonths)) {
      const y = month.slice(0, 4);
      const Y = (years[y] ||= { music: 0, genres: {}, artists: {}, albums: {} });
      const M = (months[month] ||= { music: 0, genres: {} });
      Y.music += m.music; M.music += m.music;
      for (const [g, n] of Object.entries(m.genres)) { Y.genres[g] = (Y.genres[g] || 0) + n; M.genres[g] = (M.genres[g] || 0) + n; }
      for (const [k, a] of Object.entries(m.artists)) {
        const t = (Y.artists[k] ||= { name: a.name, n: 0, score: 0 }); t.n += a.n; t.score += a.score;
      }
      for (const [k, a] of Object.entries(m.albums)) {
        const t = (Y.albums[k] ||= { ...a, n: 0, score: 0 }); t.n += a.n; t.score += a.score;
      }
    }
  }
  const yearList = Object.keys(years).sort();
  if (!yearList.length) return null;

  // genre share of tagged music posts, per year
  const totalGenre = {};
  for (const y of yearList) for (const [g, n] of Object.entries(years[y].genres)) totalGenre[g] = (totalGenre[g] || 0) + n;
  const top = Object.entries(totalGenre).sort((a, b) => b[1] - a[1]).slice(0, topGenres).map(([g]) => g);
  const share = (Y, g) => (Y.music ? (Y.genres[g] || 0) / Y.music : 0);
  const genreShareByYear = top.map((g) => ({ genre: g, values: yearList.map((y) => +(100 * share(years[y], g)).toFixed(2)) }));

  // biggest genre jumps year over year ("genres blowing up")
  const genreJumps = [];
  for (let i = 1; i < yearList.length; i++) {
    const a = years[yearList[i - 1]], b = years[yearList[i]];
    for (const g of Object.keys(b.genres)) {
      if ((b.genres[g] || 0) < 5) continue;
      const before = share(a, g), after = share(b, g);
      genreJumps.push({ year: yearList[i], genre: g, from: +(100 * before).toFixed(2), to: +(100 * after).toFixed(2),
                        change: before ? (after - before) / before : null });
    }
  }
  const jumpsByYear = {};
  for (const j of genreJumps.sort((x, y) => (y.change ?? 99) - (x.change ?? 99))) {
    (jumpsByYear[j.year] ||= []).length < 5 && jumpsByYear[j.year].push(j);
  }

  // top artists/albums each year, and breakout years (first year they really took off)
  const rank = (obj) => Object.values(obj).sort((a, b) => b.n - a.n || b.score - a.score);
  const topArtistsByYear = Object.fromEntries(yearList.map((y) => [y, rank(years[y].artists).slice(0, 10)]));
  const topAlbumsByYear = Object.fromEntries(yearList.map((y) => [y, rank(years[y].albums).slice(0, 10)]));
  const breakouts = [];
  const seenBefore = {};
  for (const y of yearList) {
    for (const [k, a] of Object.entries(years[y].artists)) {
      const prev = seenBefore[k] || 0;
      if (a.n >= 4 && a.n >= 3 * (prev + 1)) breakouts.push({ year: y, artist: a.name, mentions: a.n, before: prev });
    }
    for (const [k, a] of Object.entries(years[y].artists)) seenBefore[k] = Math.max(seenBefore[k] || 0, a.n);
  }
  const breakoutsByYear = {};
  for (const b of breakouts.sort((a, b) => b.mentions - a.mentions)) (breakoutsByYear[b.year] ||= []).length < 8 && breakoutsByYear[b.year].push(b);

  // monthly share for each top genre (for the "zoom in" chart)
  const monthList = Object.keys(months).sort();
  const genreShareByMonth = top.map((g) => ({ genre: g, values: monthList.map((m) => +(100 * share(months[m], g)).toFixed(2)) }));

  return { years: yearList, months: monthList, genreShareByYear, genreShareByMonth, jumpsByYear,
           topArtistsByYear, topAlbumsByYear, breakoutsByYear,
           postsByYear: yearList.map((y) => years[y].music) };
}
