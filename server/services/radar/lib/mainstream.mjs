// "Block out mainstream like Drake and Kanye and Taylor Swift" (user, 2026-11-16). Music Radar is for finding
// things early, so an artist is hidden everywhere on the dashboard when any of these is true:
//   - they're on your list (Radar settings; starts with the obvious ones below)
//   - Last.fm says they have more listeners than your limit (needs LASTFM_API_KEY; the scan records listeners)
//   - they're on the Apple Music chart (that source) in the last 30 days
// Their source tabs still show them as-is: those are the raw charts. Off with "Hide mainstream artists" unticked.
import { getKv, setKv } from "./store.mjs";
import { norm } from "./extract.mjs";

export const DEFAULT_MAINSTREAM = [
  "Drake", "Kanye West", "Ye", "Taylor Swift", "Beyoncé", "Rihanna", "Ed Sheeran", "Ariana Grande", "Justin Bieber",
  "Billie Eilish", "The Weeknd", "Bad Bunny", "Post Malone", "Travis Scott", "Kendrick Lamar", "Eminem", "Nicki Minaj",
  "Cardi B", "Doja Cat", "SZA", "Dua Lipa", "Harry Styles", "Olivia Rodrigo", "Sabrina Carpenter", "Lady Gaga",
  "Bruno Mars", "Coldplay", "Imagine Dragons", "Maroon 5", "Morgan Wallen", "Luke Combs", "Shakira", "Katy Perry",
  "Miley Cyrus", "Selena Gomez", "Justin Timberlake", "Lil Wayne", "Future", "21 Savage", "Lil Baby", "Metro Boomin",
  "Chappell Roan", "Charli xcx", "Benson Boone", "Tate McRae", "Zach Bryan", "Jelly Roll", "BTS", "BLACKPINK", "Rosé",
];
export const DEFAULT_LISTENERS = 2_000_000;

export function mainstreamCfg() {
  const c = getKv("mainstreamCfg", {}) || {};
  return { on: c.on ?? true, listeners: c.listeners ?? DEFAULT_LISTENERS, charts: c.charts ?? true, list: Array.isArray(c.list) ? c.list : DEFAULT_MAINSTREAM };
}
export function saveMainstreamCfg(input = {}) {
  const cur = mainstreamCfg();
  const list = Array.isArray(input.list) ? input.list : typeof input.list === "string" ? input.list.split(/\n|,(?![^(]*\))/) : cur.list;
  const next = {
    on: input.on !== undefined ? !!input.on : cur.on,
    charts: input.charts !== undefined ? !!input.charts : cur.charts,
    listeners: input.listeners !== undefined ? Math.max(0, Math.min(1e9, Math.round(+input.listeners || 0))) : cur.listeners,
    list: [...new Set(list.map((s) => String(s).trim()).filter(Boolean))].slice(0, 500).map((s) => s.slice(0, 80)),
  };
  setKv("mainstreamCfg", next);
  return next;
}

// the set of hidden artists (normalised names), or null when the filter is off
export function mainstreamSet(state, { chartArtists = [] } = {}, cfg = mainstreamCfg()) {
  if (!cfg.on) return null;
  const set = new Set(cfg.list.map(norm).filter(Boolean));
  if (cfg.listeners > 0) for (const [k, a] of Object.entries(state?.artists || {})) if ((a.listeners || 0) >= cfg.listeners) set.add(norm(a.name || k));
  if (cfg.charts) for (const n of chartArtists) set.add(norm(n));
  // anyone you follow is never hidden, however big (user, 2026-11-16)
  for (const f of getKv("follows", []) || []) set.delete(f.key || norm(f.name));
  return set;
}
// the same answer as mainstreamSet for one artist, without walking every artist Radar knows
export function isMainstream(name, record, { chartArtists = [] } = {}, cfg = mainstreamCfg()) {
  if (!cfg.on || !name) return false;
  const k = norm(name);
  if ((getKv("follows", []) || []).some((f) => (f.key || norm(f.name)) === k)) return false;
  return cfg.list.some((n) => norm(n) === k) || (cfg.listeners > 0 && (record?.listeners || 0) >= cfg.listeners) || (cfg.charts && chartArtists.some((n) => norm(n) === k));
}
export const hidden = (set, name) => !!set && !!name && set.has(norm(name));
