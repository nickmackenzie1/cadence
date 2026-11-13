// Data-driven subreddit suggestions + checking whether past picks actually blew up.
import { now, DAY } from "./config.mjs";
import { searchArtist, subAbout } from "./reddit.mjs";
import { lastfmInfo, hasLastfm } from "./enrich.mjs";

const MUSICY = /music|band|song|album|rock|pop|hip.?hop|rap|jazz|metal|punk|electronic|indie|beats|folk|emo|wave|core|gaze|techno|house|dnb|ambient|r&b|rnb|soul|listen|vinyl|artist|singer|producer/i;
const GENERIC = new Set(["askreddit", "music", "pics", "videos", "funny", "all", "popular", "news", "gaming", "movies"]);

// Where else do the artists you like get posted? Subs that keep showing up = suggestions.
export async function suggestSubs(state, currentSubs, { maxArtists = 8 } = {}) {
  const have = new Set(currentSubs.map((s) => s.toLowerCase()));
  const likedPicks = state.picks.filter((p) => state.feedback[p.id] === 1);
  const seed = (likedPicks.length ? likedPicks : [...state.picks].sort((a, b) => b.score - a.score))
    .map((p) => p.artist).filter((a, i, arr) => arr.indexOf(a) === i).slice(0, maxArtists);

  const tally = new Map();
  for (const artist of seed) {
    try {
      for (const sub of new Set(await searchArtist(artist))) {
        if (have.has(sub.toLowerCase()) || GENERIC.has(sub.toLowerCase())) continue;
        if (!tally.has(sub)) tally.set(sub, new Set());
        tally.get(sub).add(artist);
      }
    } catch (e) { console.log(`  ! search ${artist}: ${e.message}`); }
  }
  // subs that commenters link to, e.g. "check out r/sigilkore"
  for (const [sub, n] of Object.entries(state.subMentions)) {
    if (n >= 2 && !have.has(sub.toLowerCase()) && !GENERIC.has(sub.toLowerCase())) {
      if (!tally.has(sub)) tally.set(sub, new Set());
      tally.get(sub).add(`mentioned in ${n} comments`);
    }
  }
  const ranked = [...tally].sort((a, b) => b[1].size - a[1].size).slice(0, 15);
  const out = [];
  for (const [sub, why] of ranked) {
    try {
      const info = await subAbout(sub);
      if (info.nsfw || !MUSICY.test(`${sub} ${info.title} ${info.description}`)) continue;
      out.push({ sub, because: [...why], subscribers: info.subscribers, description: info.description.slice(0, 160) });
    } catch {}
  }
  state.subSuggestions = out.slice(0, 10);
  return state.subSuggestions;
}

// 30+ days after a pick, did their Last.fm listeners grow? (hit = +25% or more)
export async function updateTrackRecord(state) {
  if (!hasLastfm()) return;
  const due = state.picks.filter((p) => !p.outcome && p.listeners && now() - p.ts > 30 * DAY).slice(0, 40);
  for (const p of due) {
    const info = await lastfmInfo(state, p.key, p.artist, { force: true });
    if (!info?.listeners) continue;
    const growth = info.listeners / p.listeners - 1;
    p.outcome = { checkedTs: now(), listenersNow: info.listeners, growth, hit: growth >= 0.25 };
  }
}

export function trackRecord(state) {
  const checked = state.picks.filter((p) => p.outcome);
  const hits = checked.filter((p) => p.outcome.hit);
  return {
    checked: checked.length, hits: hits.length, hitRate: checked.length ? hits.length / checked.length : null,
    best: [...checked].sort((a, b) => b.outcome.growth - a.outcome.growth).slice(0, 10)
      .map((p) => ({ artist: p.artist, song: p.song, pickedTs: p.ts, before: p.listeners, now: p.outcome.listenersNow, growth: p.outcome.growth })),
  };
}
