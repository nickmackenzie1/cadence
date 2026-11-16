// Album art and release info for Music Radar (user, 2026-11-16): MusicBrainz finds the release, the Cover Art
// Archive has its front cover. Both are free with no key. MusicBrainz asks for a real User-Agent and about one
// request a second, so lookups run in the background one at a time and every answer is kept (in radar_kv):
// found ones for good, not-found ones retried after 30 days. Nothing here ever blocks a page.
// RADAR_MB=0 turns it off. Off under CI and in the simulator unless RADAR_MB=1 (tests point RADAR_MB_API /
// RADAR_CAA_API at fakes). Its timers never keep a finished process alive.
import { getKv, setKv } from "./store.mjs";
import { httpJson } from "./http.mjs";
import { norm } from "./extract.mjs";

const MB = () => (process.env.RADAR_MB_API || "https://musicbrainz.org").replace(/\/$/, "");
const CAA = () => (process.env.RADAR_CAA_API || "https://coverartarchive.org").replace(/\/$/, "");
const UA = "Cadence/1 (self-hosted to-do app; https://github.com/nickmackenzie1/cadence)";
const GAP = +process.env.RADAR_MB_GAP || 1100, RETRY = 30 * 86400e3, MAXQ = 400;
const queue = new Map(); let running = false;
const ON = () => process.env.RADAR_MB === "1" || (process.env.RADAR_MB !== "0" && !process.env.CI);

const key = (artist, title) => "mb:" + norm(artist) + "|" + norm(title || "");
const lucene = (s) => String(s).replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, "\\$1");

// What we know now (or null), and queue a lookup if we don't know yet. Cheap: one row read.
export function artFor(artist, title) {
  if (!artist || !title || !ON()) return null;
  const k = key(artist, title);
  let c = null; try { c = getKv(k); } catch { return null; }
  if (c && !c.none) return c;
  if (!c || Date.now() - (c.at || 0) > RETRY) enqueue(k, artist, title);
  return null;
}
// add art/release fields to a list of rows in place, where they don't have their own picture
export function withArt(rows, artistOf = (r) => r.artist, titleOf = (r) => r.title) {
  for (const r of rows || []) {
    const a = artFor(artistOf(r), titleOf(r)); if (!a) continue;
    if (!r.image && a.img) r.image = a.img;
    r.release = { date: a.date || null, type: a.type || null, mbid: a.mbid };
  }
  return rows;
}

function enqueue(k, artist, title, job = () => lookup(artist, title)) {
  if (queue.has(k) || queue.size >= MAXQ) return;
  queue.set(k, { artist, title, job });
  if (!running) pump();
}
async function pump() {
  running = true;
  while (queue.size) {
    const [k, v] = queue.entries().next().value; queue.delete(k);
    try { setKv(k, (await v.job()) || { none: true, at: Date.now() }); }
    catch (e) { /* offline or rate-limited: not cached, so it's tried again next time it's shown */ }
    await new Promise((r) => setTimeout(r, GAP).unref?.());
  }
  running = false;
}
export async function lookup(artist, title) {
  const q = `releasegroup:"${lucene(title)}" AND artist:"${lucene(artist)}"`;
  const j = await httpJson(`${MB()}/ws/2/release-group/?fmt=json&limit=5&query=${encodeURIComponent(q)}`, { headers: { "User-Agent": UA, Accept: "application/json" } });
  const want = norm(title), list = j["release-groups"] || [];
  const rg = list.find((r) => (r.score ?? 0) >= 90 && norm(r.title) === want) || list.find((r) => (r.score ?? 0) >= 95);
  if (!rg) return null;
  let img = null;
  try {
    const c = await httpJson(`${CAA()}/release-group/${rg.id}`, { headers: { "User-Agent": UA, Accept: "application/json" } });
    const front = (c.images || []).find((i) => i.front) || (c.images || [])[0];
    img = front ? (front.thumbnails?.["250"] || front.thumbnails?.small || front.image || null) : null;
  } catch { /* no cover art for this one */ }
  return { mbid: rg.id, img: img ? img.replace(/^http:/, "https:") : null, date: rg["first-release-date"] || null, type: rg["primary-type"] || null, at: Date.now() };
}
// ---------- the artist: where they're from, links, tags and releases (two MusicBrainz requests, kept 30 days) ----------
const AKEY = (name) => "mba:" + norm(name);
export function artistInfo(name, { queue: q = true } = {}) {
  if (!name || !ON()) return { pending: false, info: null };
  const k = AKEY(name); let c = null; try { c = getKv(k); } catch { return { pending: false, info: null }; }
  const stale = !c || Date.now() - (c.at || 0) > (c.none ? RETRY : 30 * 86400e3);
  if (stale && q) enqueue(k, name, "", () => lookupArtist(name));
  return { pending: stale && (queue.has(k) || !c), info: c && !c.none ? c : null };
}
const LINK_TYPES = [["bandcamp", /bandcamp\.com/], ["website", null], ["wikipedia", /wikipedia\.org/], ["instagram", /instagram\.com/], ["youtube", /youtube\.com/],
  ["spotify", /open\.spotify\.com/], ["apple", /music\.apple\.com/], ["soundcloud", /soundcloud\.com/], ["bluesky", /bsky\.app/], ["mastodon", /\/@[^/]+$/]];
export async function lookupArtist(name) {
  const h = { headers: { "User-Agent": UA, Accept: "application/json" } };
  const j = await httpJson(`${MB()}/ws/2/artist/?fmt=json&limit=5&query=${encodeURIComponent(`artist:"${lucene(name)}"`)}`, h);
  const want = norm(name), list = j.artists || [];
  const a0 = list.find((a) => (a.score ?? 0) >= 90 && norm(a.name) === want) || list.find((a) => (a.score ?? 0) >= 99);
  if (!a0) return null;
  await new Promise((r) => setTimeout(r, GAP).unref?.());   // MusicBrainz: about one request a second
  const a = await httpJson(`${MB()}/ws/2/artist/${a0.id}?fmt=json&inc=url-rels+tags+release-groups`, h);
  const links = [];
  for (const rel of a.relations || []) {
    const u = rel.url && rel.url.resource; if (!u || rel.ended) continue;
    const kind = rel.type === "official homepage" ? "website" : (LINK_TYPES.find(([, re]) => re && re.test(u)) || [])[0];
    if (kind && !links.some((l) => l.kind === kind)) links.push({ kind, url: u.replace(/^http:/, "https:") });
  }
  const rgs = (a["release-groups"] || []).filter((r) => !(r["secondary-types"] || []).some((t) => /compilation|live|remix|demo|dj-mix|interview/i.test(t)))
    .map((r) => ({ id: r.id, title: r.title, date: r["first-release-date"] || null, type: r["primary-type"] || "Release",
      cover: `https://coverartarchive.org/release-group/${r.id}/front-250` }))
    .sort((x, y) => String(y.date || "").localeCompare(String(x.date || "")));
  return { mbid: a.id, name: a.name, type: a.type || null, disambiguation: a.disambiguation || null,
    from: (a["begin-area"] && a["begin-area"].name) || (a.area && a.area.name) || null, country: a.country || null,
    since: (a["life-span"] && a["life-span"].begin) || null, ended: !!(a["life-span"] && a["life-span"].ended),
    tags: (a.tags || []).sort((x, y) => y.count - x.count).slice(0, 8).map((t) => t.name), links, releases: rgs.slice(0, 40), at: Date.now() };
}
export const _queue = () => queue.size;
