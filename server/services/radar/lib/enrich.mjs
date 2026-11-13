import { now, DAY } from "./config.mjs";
import { httpJson } from "./http.mjs";

export const hasLastfm = () => !!process.env.LASTFM_API_KEY;

// Last.fm listener count + tags, cached a week per artist.
export async function lastfmInfo(state, key, name, { force = false } = {}) {
  if (!hasLastfm()) return null;
  const a = (state.artists[key] ||= { name, firstSeen: {}, genres: {} });
  if (!force && a.lastfm && now() - a.lastfm.ts < 7 * DAY) return a.lastfm;
  try {
    const d = await httpJson(`https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&autocorrect=1&format=json`
      + `&artist=${encodeURIComponent(name)}&api_key=${process.env.LASTFM_API_KEY}`);
    if (!d.artist) return (a.lastfm = { ts: now(), listeners: null, tags: [] });
    a.lastfm = { ts: now(), listeners: Number(d.artist.stats?.listeners) || 0,
                 tags: (d.artist.tags?.tag || []).map((t) => t.name.toLowerCase()).slice(0, 5), url: d.artist.url };
    (a.listenersHistory ||= []).push({ ts: now(), n: a.lastfm.listeners });
    return a.lastfm;
  } catch { return null; }
}

// Small-but-buzzing is the sweet spot. 0 = too big, drop it.
export function sizeFactor(listeners) {
  if (listeners == null) return 1;
  if (listeners < 1000) return 1.2;
  if (listeners < 20000) return 1.5;
  if (listeners < 100000) return 1.3;
  if (listeners < 500000) return 1.0;
  if (listeners < 2000000) return 0.6;
  if (listeners < 5000000) return 0.3;
  return 0;
}
