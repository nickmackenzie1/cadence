// One artist, everything Cadence knows (user, 2026-11-16: "one artist page that pulls everything together"):
// Music Radar's own data (genres, listeners, community picks), every source that mentioned them (blogs, charts, radio),
// their chart runs, KEXP plays and DJs (passed in from kexp-log), and MusicBrainz (origin, links, tags, releases).
import { now, DAY } from "./config.mjs";
import { signalsFor, chartPointsFor, artistRecord, picksForArtist } from "./store.mjs";
import { norm, isArtist } from "./extract.mjs";
import { artistInfo, artFor } from "./coverart.mjs";
import { audiodbFor } from "./audiodb.mjs";
import { soundOfArtist } from "./sound.mjs";
import { SOURCES, blogList } from "./sources.mjs";
import { sourcesCfg } from "./sources-data.mjs";
import { isMainstream } from "./mainstream.mjs";
import { sizeOf } from "./enrich.mjs";

const SOURCE_NAME = (id) => (id === "community" ? "Lemmy & Mastodon" : SOURCES[id]?.name || id);

export function artistData(name, { kexp = null } = {}) {
  name = String(name || "").trim().slice(0, 120);
  if (!name) return null;
  const key = norm(name), t = now();
  const a = artistRecord(key);

  // community picks (the scan) for this artist
  const picks = picksForArtist(key, name).filter((p) => p.key === key || norm(p.artist || "") === key).sort((x, y) => y.ts - x.ts).slice(0, 20)
    .map((p) => ({ ts: p.ts, song: p.song, type: p.type, score: p.score, subs: p.subs || [], link: p.link, thread: p.thread, genres: p.genres || [] }));

  // every source signal; charts get their runs (rank over time)
  const tiers = new Map(blogList(sourcesCfg()).map((b) => [b.name, b.tier]));
  const sig = signalsFor(key);
  const uids = new Set(sig.filter((s) => s.rank != null).map((s) => s.source + "|" + s.uid));
  const points = uids.size ? chartPointsFor([...uids], t - 120 * DAY) : [];
  const runs = {};
  for (const p of points) (runs[p.source + "|" + p.uid] ||= []).push({ ts: p.ts, rank: p.rank });
  const mentions = sig.map((s) => ({ source: s.source, sourceName: SOURCE_NAME(s.source), title: s.title, type: s.type, feed: s.feed,
    tier: s.source === "blogs" ? tiers.get(s.feed) || null : null, url: s.url, first: s.first_seen, last: s.last_seen, seen: s.seen,
    rank: s.rank, best: s.best_rank, image: s.image, run: runs[s.source + "|" + s.uid] || null }));

  const mb = artistInfo(name);
  const adb = audiodbFor(name, mb.info?.mbid || null);
  const genres = new Map();
  for (const [g, n] of Object.entries(a?.genres || {})) genres.set(g, (genres.get(g) || 0) + n);
  for (const s of sig) for (const g of String(s.genres || "").split(", ").filter(Boolean)) genres.set(g, (genres.get(g) || 0) + 1);
  // a picture: the newest release cover we know, else any image a source brought
  const art = mentions.find((m) => m.image)?.image || (picks[0] && artFor(name, picks[0].song)?.img) || null;
  let chartArtists = []; try { chartArtists = sig.filter((s) => s.source === "apple").map((s) => s.artist); } catch {}

  return {
    name: mb.info?.name || a?.name || sig[0]?.artist || picks[0]?.artist || name, key, isArtist: isArtist(name),
    mainstream: isMainstream(name, a, { chartArtists }),
    radar: a ? { listeners: sizeOf(a)?.n ?? null, listenersFrom: sizeOf(a)?.from ?? null, firstSeen: Math.min(...Object.values(a.firstSeen || {}), Infinity) || null, communities: Object.keys(a.firstSeen || {}) } : null,
    genres: [...genres.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([g]) => g),
    // players and links blog posts carried (Bandcamp, Spotify, SoundCloud), newest first, one of each address
    listen: sig.flatMap((s) => (s.listen || []).map((l) => ({ ...l, feed: s.feed, title: s.title }))).filter((l, i, all) => all.findIndex((x) => x.url === l.url) === i).slice(0, 6),
    sound: (() => { try { return soundOfArtist(name); } catch { return null; } })(),
    picks, mentions, sources: [...new Set(mentions.map((m) => m.sourceName))],
    mb: mb.info, mbPending: mb.pending, adb: adb.info, adbPending: adb.pending, art, kexp,
  };
}
