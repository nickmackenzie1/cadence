// Checking whether past picks actually blew up (Last.fm listeners a month later).
import { now, DAY } from "./config.mjs";
import { lastfmInfo, hasLastfm } from "./enrich.mjs";

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
