// Everything the dashboard and digest need, computed from stored data.
import { now, DAY, DEFAULT_SUBS } from "./config.mjs";
import { readJsonl } from "./store.mjs";
import { riseData, momentum, subLeadTimes, soundsLikeGraph } from "./trends.mjs";
import { tasteModel } from "./taste.mjs";
import { trackRecord } from "./discover.mjs";
import { loadHistory, historyTrends } from "./history.mjs";
import { spotifyConnected, hasSpotifyApp, playlistUrl } from "./spotify.mjs";
import { sourcesData } from "./sources-data.mjs";

export function dashboardData(state) {
  const t = now();
  const snaps = readJsonl("snapshots", t - 15 * DAY);
  const rise = riseData(snaps, t);
  const taste = tasteModel(state);

  // albums: best score per release over the last 7 days
  const albums = new Map();
  for (const s of snaps) if (s.kind === "album" && t - s.ts < 7 * DAY) {
    const cur = albums.get(s.key);
    if (!cur || s.score > cur.score) albums.set(s.key, s);
  }

  let sources; try { sources = sourcesData(state, snaps); } catch (e) { console.error('radar sources data', e); sources = { available: false, note: e.message }; }
  return {
    generatedAt: t,
    sources,
    rise,
    albums: [...albums.values()].sort((a, b) => b.score - a.score).slice(0, 12),
    genres: momentum(readJsonl("genres", t - 28 * DAY), t, "genre").slice(0, 20),
    buzz: momentum(readJsonl("terms", t - 28 * DAY), t, "term", 4).slice(0, 20),
    subLead: subLeadTimes(state.artists).filter((s) => s.samples >= 2).slice(0, 15),
    graph: soundsLikeGraph(state.edges, taste.liked),
    picks: [...state.picks].sort((a, b) => b.ts - a.ts).slice(0, 40).map((p) => ({ ...p, feedback: state.feedback[p.id] || 0, alsoOn: sources.alsoOn?.[p.key] || [] })),
    picksThisWeek: state.picks.filter((p) => t - p.ts < 7 * DAY).length,
    artistsTracked: Object.keys(state.artists).length,
    subs: state.subs || DEFAULT_SUBS,
    suggestions: state.subSuggestions,
    trackRecord: trackRecord(state),
    taste: { genres: taste.genreWeights, subs: taste.subWeights, liked: taste.liked.size, disliked: taste.disliked.size },
    history: historyTrends(loadHistory()),
    digests: [...state.digests].reverse().slice(0, 10).map(({ html, ...d }) => d),
    spotify: { app: hasSpotifyApp(), connected: spotifyConnected(), url: playlistUrl() },
  };
}
