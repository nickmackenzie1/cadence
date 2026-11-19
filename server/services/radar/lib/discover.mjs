// Checking whether past picks actually blew up (listeners a month later, counted where they were counted at the pick:
// Last.fm or ListenBrainz).
import { now, DAY } from "./config.mjs";
import { lastfmInfo, lastfmOk, lbSizes } from "./enrich.mjs";

// 30+ days after a pick, did their listeners grow? (hit = +25% or more)
export async function updateTrackRecord(state) {
  const due = state.picks.filter((p) => !p.outcome && p.listeners && now() - p.ts > 30 * DAY).slice(0, 40);
  const lb = due.filter((p) => p.listenersFrom === "lb");
  if (lb.length) await lbSizes(state, lb.map((p) => ({ key: p.key, name: p.artist })), { force: true });
  for (const p of due) {
    let n = null;
    if (p.listenersFrom === "lb") n = state.artists[p.key]?.lb?.users ?? null;
    else if (lastfmOk()) n = (await lastfmInfo(state, p.key, p.artist, { force: true }))?.listeners ?? null;
    if (!n) continue;
    const growth = n / p.listeners - 1;
    p.outcome = { checkedTs: now(), listenersNow: n, growth, hit: growth >= 0.25 };
  }
}

export function trackRecord(state) {
  const checked = state.picks.filter((p) => p.outcome);
  const hits = checked.filter((p) => p.outcome.hit);
  return {
    checked: checked.length, hits: hits.length, hitRate: checked.length ? hits.length / checked.length : null,
    best: [...checked].sort((a, b) => b.outcome.growth - a.outcome.growth).slice(0, 10)
      .map((p) => ({ artist: p.artist, song: p.song, pickedTs: p.ts, from: p.listenersFrom || "lastfm", before: p.listeners, now: p.outcome.listenersNow, growth: p.outcome.growth })),
  };
}
