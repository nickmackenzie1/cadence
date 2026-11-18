// Sounds like (user, 2026-11-16): artists to wander to from an artist page.
//   mentioned together  the same communities and posts talk about both (Radar's "sounds like" graph)
//   Last.fm similar     listeners' similar-artist list (needs LASTFM_API_KEY on the NAS), kept 30 days
import { getKv, setKv, neighbors, alikeFor } from "./store.mjs";
import { httpJson } from "./http.mjs";
import { norm } from "./extract.mjs";

const titled = (k) => String(k || "").replace(/\b\w/g, (c) => c.toUpperCase());
const ON = () => !!process.env.LASTFM_API_KEY && (process.env.RADAR_LASTFM_SIMILAR === "1" || !process.env.CI);
async function lastfm(name) {
  if (!ON()) return [];
  const k = "lfs:" + norm(name), c = getKv(k);
  if (c && Date.now() - c.at < 30 * 86400e3) return c.list;
  try {
    const j = await httpJson(`${process.env.LASTFM_API || "https://ws.audioscrobbler.com"}/2.0/?method=artist.getsimilar&artist=${encodeURIComponent(name)}&autocorrect=1&limit=15&api_key=${process.env.LASTFM_API_KEY}&format=json`);
    const list = ((j.similarartists || {}).artist || []).map((a) => ({ name: a.name, match: +a.match || 0 })).filter((a) => a.name);
    setKv(k, { list, at: Date.now() }); return list;
  } catch { return c ? c.list : []; }
}
export async function similar(name, { limit = 12 } = {}) {
  const me = norm(name), out = new Map();
  for (const n of neighbors(me, 12)) if (n.key !== me) out.set(n.key, { name: n.name || titled(n.key), why: `mentioned together ${n.n} time${n.n === 1 ? "" : "s"}`, from: "radar" });
  // writers saying so (Indie Shuffle's "Sounds like" lines and the like) come first
  let said = []; try { said = alikeFor(me, 8); } catch {}
  for (const n of said.reverse()) { if (n.key === me) continue; const why = `${n.feeds.split(",")[0]} says they sound alike`, x = out.get(n.key); out.delete(n.key); out.set(n.key, x ? { ...x, why: why + ", and " + x.why } : { name: n.name || titled(n.key), why, from: "blogs" }); }
  const ordered = [...out.entries()].reverse(); out.clear(); for (const [k, v] of ordered) out.set(k, v);
  for (const a of await lastfm(name)) { const k = norm(a.name); if (k === me) continue; const x = out.get(k); if (x) x.why += ", and Last.fm says they're alike"; else out.set(k, { name: a.name, why: `Last.fm: ${Math.round(a.match * 100)}% alike`, from: "lastfm" }); }
  return [...out.values()].slice(0, limit);
}
