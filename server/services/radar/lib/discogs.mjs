// Your Discogs records (user, 2026-11-18): your collection and wantlist, copied every few hours so Radar can say
// "you own this", learn from what you own and want, and keep Want to hear and the wantlist in step.
// Needs DISCOGS_TOKEN (discogs.com → Settings → Developers → Generate token) in .env. Kept in radar's kv as "discogs".
import { getKv, setKv } from "./store.mjs";
import { norm } from "./extract.mjs";

const API = () => (process.env.DISCOGS_API || "https://api.discogs.com").replace(/\/$/, "");
const TOKEN = () => String(process.env.DISCOGS_TOKEN || "").trim();
export const discogsOn = () => !!TOKEN();
const UA = "Cadence/1 (self-hosted to-do app; personal use)";
const wait = (ms) => new Promise((r) => setTimeout(r, ms).unref?.());
async function call(path, { method = "GET" } = {}) {
  const r = await fetch(API() + path, { method, headers: { Authorization: `Discogs token=${TOKEN()}`, "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (r.status === 429) { await wait(30000); return call(path, { method }); }   // over the minute's allowance: wait it out once
  if (!r.ok && r.status !== 204) throw new Error("Discogs: HTTP " + r.status);
  return r.status === 204 ? {} : r.json().catch(() => ({}));
}
// the account the token belongs to
async function user() {
  const k = getKv("discogsUser"); if (k && k.token === TOKEN().slice(-6)) return k.name;
  const j = await call("/oauth/identity"); if (!j.username) throw new Error("Discogs didn't say whose token this is");
  setKv("discogsUser", { name: j.username, token: TOKEN().slice(-6) }); return j.username;
}
const item = (r) => { const b = r.basic_information || {};
  return { rid: b.id || r.id, master: b.master_id || null, artist: (b.artists || []).map((a) => String(a.name).replace(/\s*\(\d+\)$/, "")).join(", ") || "Unknown", title: b.title || "",
    year: b.year || null, format: (b.formats || []).map((f) => f.name).filter(Boolean).slice(0, 2).join(", ") || null, label: (b.labels || [])[0]?.name || null,
    cover: b.cover_image || b.thumb || null, thumb: b.thumb || null, genres: [...(b.genres || []), ...(b.styles || [])].slice(0, 4), added: r.date_added || null }; };
async function allPages(path, key) {
  const out = []; let page = 1, pages = 1;
  do { const j = await call(`${path}${path.includes("?") ? "&" : "?"}page=${page}&per_page=100`); pages = (j.pagination && j.pagination.pages) || 1; out.push(...(j[key] || []).map(item)); page++; if (page <= pages) await wait(1100); } while (page <= pages && page <= 60);
  return out;
}
// copy the collection and wantlist (about one request a second; a 1,000-record collection is 10 requests)
export async function discogsSync() {
  if (!discogsOn()) return { off: true };
  const name = await user();
  const collection = await allPages(`/users/${encodeURIComponent(name)}/collection/folders/0/releases?sort=added&sort_order=desc`, "releases");
  await wait(1100);
  const wants = await allPages(`/users/${encodeURIComponent(name)}/wants`, "wants");
  const d = { at: Date.now(), user: name, collection, wants };
  setKv("discogs", d);
  return { user: name, records: collection.length, wants: wants.length };
}
export const discogsData = () => getKv("discogs") || null;
// quick lookups: artists you own, and artist|title pairs you own or want
let IX = { at: -1 };
export function discogsIndex() {
  const d = discogsData(); if (!d) return { artists: new Set(), own: new Set(), want: new Set(), wantArtists: new Set() };
  if (IX.at === d.at) return IX;
  const key = (a, t) => norm(a) + "|" + norm(String(t).replace(/\s*\((deluxe|remaster(ed)?|expanded|anniversary)[^)]*\)/gi, ""));
  const split = (a) => String(a).split(/,\s*/);
  IX = { at: d.at, artists: new Set(d.collection.flatMap((r) => split(r.artist).map(norm))), wantArtists: new Set(d.wants.flatMap((r) => split(r.artist).map(norm))),
    own: new Set(d.collection.flatMap((r) => split(r.artist).map((a) => key(a, r.title)))), want: new Set(d.wants.flatMap((r) => split(r.artist).map((a) => key(a, r.title)))), key };
  return IX;
}
// for the page: counts, the newest few, one pulled from the shelf, and an artist's records
export function discogsSummary({ artist } = {}) {
  if (!discogsOn()) return { off: true };
  const d = discogsData(); if (!d) return { on: true, pending: true };
  const ak = artist ? norm(artist) : null, mine = (r) => String(r.artist).split(/,\s*/).some((a) => norm(a) === ak);
  const day = Math.floor(Date.now() / 86400e3), pick = d.collection.length ? d.collection[(day * 2654435761 >>> 0) % d.collection.length] : null;
  return { on: true, user: d.user, at: d.at, records: d.collection.length, wants: d.wants.length, recent: d.collection.slice(0, 6), shelf: pick,
    ...(ak ? { own: d.collection.filter(mine), want: d.wants.filter(mine) } : {}) };
}
// add to (or take off) your wantlist: the best match for an artist and album, when you ask
export async function discogsWant({ artist, title, add = true, rid } = {}) {
  if (!discogsOn()) return { off: true };
  const name = await user();
  let id = +rid || null;
  if (!id) {
    const q = new URLSearchParams({ artist: String(artist || ""), release_title: String(title || ""), type: "master", per_page: "5" });
    let j = await call(`/database/search?${q}`), hit = (j.results || [])[0];
    if (hit && hit.main_release) id = hit.main_release;
    else if (hit) { const m = await call(`/masters/${hit.id}`); id = m.main_release; }
    if (!id) { q.set("type", "release"); j = await call(`/database/search?${q}`); id = (j.results || [])[0]?.id || null; }
    if (!id) return { none: true };
  }
  await call(`/users/${encodeURIComponent(name)}/wants/${id}`, { method: add === false ? "DELETE" : "PUT" });
  // keep our copy in step without waiting for the next sync
  const d = discogsData();
  if (d) { d.wants = add === false ? d.wants.filter((w) => w.rid !== id) : d.wants.some((w) => w.rid === id) ? d.wants : [{ rid: id, artist: artist || "", title: title || "", added: new Date().toISOString() }, ...d.wants]; setKv("discogs", { ...d }); IX = { at: -1 }; }
  return { ok: true, rid: id, added: add !== false };
}
