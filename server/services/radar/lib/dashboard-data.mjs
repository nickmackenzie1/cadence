// Everything the dashboard and digest need, computed from stored data.
import { now, DAY } from "./config.mjs";
import { readJsonl, signals } from "./store.mjs";
import { mainstreamSet, hidden, mainstreamCfg } from "./mainstream.mjs";
import { riseData, momentum, subLeadTimes, soundsLikeGraph } from "./trends.mjs";
import { tasteModel } from "./taste.mjs";
import { trackRecord } from "./discover.mjs";
import { withArt } from "./coverart.mjs";
import { spotifyConnected, hasSpotifyApp, playlistUrl } from "./spotify.mjs";
import { sourcesData } from "./sources-data.mjs";
import { isArtist, cleanGenre, norm } from "./extract.mjs";
import { forYou, nfmCfg } from "./foryou.mjs";

export function dashboardData(state) {
  const t = now();
  // older scans stored thread titles ("Daily Discussion") as artists and upload labels as genres: leave them out
  // and mainstream artists are hidden everywhere below (see mainstream.mjs)
  let chartArtists = []; try { chartArtists = signals({ since: t - 30 * DAY, source: "apple", limit: 2000 }).map((r) => r.artist); } catch {}
  const hide = mainstreamSet(state, { chartArtists }) || new Set(), keep = (name) => !hidden(hide, name);
  // "Not for me": those artists, and anyone tagged with a genre you said no to, are hidden like mainstream ones
  const nfm = nfmCfg();
  for (const a of nfm.artists) hide.add(norm(a));
  if (nfm.genres.length) {
    const no = new Set(nfm.genres.map((g) => g.toLowerCase()));
    for (const [k, a] of Object.entries(state.artists || {})) if (Object.keys(a.genres || {}).some((g) => no.has(g.toLowerCase()))) hide.add(k);
    try { for (const r of signals({ since: t - 60 * DAY, limit: 20000 })) if (r.genres && r.genres.split(", ").some((g) => no.has(g.toLowerCase()))) hide.add(r.artist_key || norm(r.artist)); } catch {}
  }
  const snaps = readJsonl("snapshots", t - 15 * DAY).filter((s) => isArtist(s.artist) && keep(s.artist));
  const rise = riseData(snaps, t);
  const taste = tasteModel(state);

  // albums: best score per release over the last 7 days
  const albums = new Map();
  for (const s of snaps) if (s.kind === "album" && t - s.ts < 7 * DAY) {
    const cur = albums.get(s.key);
    if (!cur || s.score > cur.score) albums.set(s.key, s);
  }

  let sources; try { sources = sourcesData(state, snaps, hide); } catch (e) { console.error('radar sources data', e); sources = { available: false, note: e.message }; }
  // the front page uses every source when the database is there (sources-data → buzz.mjs); else the community scan alone
  const all = !!(sources.available && sources.rise);
  // For you: everything Radar is buzzing about, ranked by your taste
  let fy = { list: [] };
  try {
    const pool = [...((all ? sources.rise : rise).top || []), ...((all ? sources.rise : rise).risers || []), ...((sources.combined || []).slice(0, 150)),
      ...((all ? sources.albums : []) || []).map((a) => ({ artist: a.artist, title: a.album, type: a.type, score: a.score }))]
      .map((x) => ({ artist: x.artist, title: x.title || null, type: x.type || null, score: x.score ?? x.cur ?? x.total ?? 1 })).filter((x) => x.artist && keep(x.artist));
    fy = forYou(state, pool);
  } catch (e) { console.error("radar for you", e); }
  return {
    generatedAt: t,
    forYou: fy,
    notForMe: nfm,
    allSources: all,
    sources,
    rise: all ? sources.rise : rise,
    albums: all ? sources.albums : [...albums.values()].sort((a, b) => b.score - a.score).slice(0, 12),
    genres: all ? sources.genres : momentum(readJsonl("genres", t - 28 * DAY).filter((r) => cleanGenre(r.genre)), t, "genre").slice(0, 20),
    buzz: momentum(readJsonl("terms", t - 28 * DAY), t, "term", 4).slice(0, 20),
    subLead: subLeadTimes(state.artists).filter((s) => s.samples >= 2).slice(0, 15),
    graph: soundsLikeGraph(state.edges, taste.liked, 120, (k) => state.artists?.[k]?.name),
    picks: withArt([...state.picks].filter((p) => !p.artist || (isArtist(p.artist) && keep(p.artist))).sort((a, b) => b.ts - a.ts).slice(0, 40).map((p) => ({ ...p, feedback: state.feedback[p.id] || 0, alsoOn: sources.alsoOn?.[p.key] || [] })), (p) => p.artist, (p) => p.song),
    picksThisWeek: state.picks.filter((p) => t - p.ts < 7 * DAY).length,
    artistsTracked: all ? sources.tracked : Object.keys(state.artists).length,
    trackRecord: trackRecord(state),
    taste: { genres: taste.genreWeights, subs: taste.subWeights, liked: taste.liked.size, disliked: taste.disliked.size },
    mainstream: { ...mainstreamCfg(), hiding: hide ? hide.size : 0 },
    digests: [...state.digests].reverse().slice(0, 10).map(({ html, ...d }) => d),
    spotify: { app: hasSpotifyApp(), connected: spotifyConnected(), url: playlistUrl() },
  };
}
