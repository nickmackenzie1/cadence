// Local shows (user, 2026-11-16): concerts near home, matched to artists you care about.
//  - Ticketmaster Discovery (TICKETMASTER_API_KEY): every music event within the radius, refreshed twice a day
//  - Bandsintown (BANDSINTOWN_APP_ID): tour dates for the artists you care about, kept if they're within the radius
// Both keys are free and live in the NAS .env; without them the page says how to get one.
// "Artists you care about": Want to hear, artists you opened lately (sent by the page), climbing on Radar,
// KEXP's most played this year, and Said the Gramophone favourites.
import { httpJson, httpText } from "./http.mjs";
import { getKv, setKv } from "./store.mjs";
import { norm } from "./extract.mjs";

const TM = () => (process.env.TICKETMASTER_API || "https://app.ticketmaster.com").replace(/\/$/, "");
const BIT = () => (process.env.BANDSINTOWN_API || "https://rest.bandsintown.com").replace(/\/$/, "");
// Amherstview, Ontario (Loyalist Township)
export const DEFAULT_SHOWS = { place: "Amherstview", lat: 44.2234, lon: -76.6533, radiusKm: 100 };
export const showsCfg = () => ({ ...DEFAULT_SHOWS, ...(getKv("showsCfg", {}) || {}) });
export function saveShowsCfg(c = {}) {
  const cur = showsCfg(), r = Math.round(Number(c.radiusKm));
  const next = { ...cur, radiusKm: r >= 10 && r <= 1000 ? r : cur.radiusKm };
  if (c.place && Number.isFinite(+c.lat) && Number.isFinite(+c.lon)) Object.assign(next, { place: String(c.place).slice(0, 80), lat: +c.lat, lon: +c.lon });
  setKv("showsCfg", next); cache = null; return next;
}
export const keys = () => ({ ticketmaster: !!process.env.TICKETMASTER_API_KEY, bandsintown: !!process.env.BANDSINTOWN_APP_ID, kingstonlive: process.env.KINGSTONLIVE !== "0" });

const km = (a, b, c, d) => { const R = 6371, r = (x) => (x * Math.PI) / 180, dl = r(c - a), dn = r(d - b);
  return 2 * R * Math.asin(Math.sqrt(Math.sin(dl / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dn / 2) ** 2)); };

// ---- Ticketmaster: music events near home, up to 5 pages of 200 ----
async function ticketmaster(cfg) {
  const out = [];
  for (let page = 0; page < 5; page++) {
    const q = new URLSearchParams({ apikey: process.env.TICKETMASTER_API_KEY, latlong: `${cfg.lat},${cfg.lon}`, radius: String(cfg.radiusKm), unit: "km",
      classificationName: "music", size: "200", sort: "date,asc", page: String(page) });
    const j = await httpJson(`${TM()}/discovery/v2/events.json?${q}`);
    for (const e of j?._embedded?.events || []) {
      const v = e._embedded?.venues?.[0] || {}, at = e._embedded?.attractions || [];
      const lat = +v.location?.latitude, lon = +v.location?.longitude;
      out.push({ id: "tm:" + e.id, artists: at.length ? at.map((a) => a.name) : [e.name], title: e.name, date: e.dates?.start?.localDate || null, time: e.dates?.start?.localTime || null,
        venue: v.name || null, city: [v.city?.name, v.state?.stateCode].filter(Boolean).join(", ") || null, url: e.url || null,
        km: Number.isFinite(lat) && Number.isFinite(lon) ? Math.round(km(cfg.lat, cfg.lon, lat, lon)) : null,
        genre: e.classifications?.[0]?.genre?.name && e.classifications[0].genre.name !== "Undefined" ? e.classifications[0].genre.name : null, from: "Ticketmaster" });
    }
    if (page + 1 >= (j?.page?.totalPages || 0)) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  return out;
}

// ---- Kingston Live (kingstonlive.ca, volunteer-run listings for Kingston; feed address from the user, no key) ----
const KL_FEED = () => process.env.KINGSTONLIVE_FEED || "https://www.kingstonlive.ca/show_feed_xml&no_headers=true&barebones_mode=true";
const KINGSTON = { lat: 44.2312, lon: -76.486 };
const ENT = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", rsquo: "’", lsquo: "‘", ndash: "–", mdash: "—", eacute: "é" };
const dec = (t) => String(t).replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1").replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
const plain = (t) => dec(dec(t)).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
// the act names out of a listing title: "Dan Mangan, Jenn Grant" / "Band w/ Guest" / "Band + Guest"
export const actsOf = (t) => String(t || "").replace(/\s*[-–:|]\s*(album release|release show|live|tour|in concert)\b.*$/i, "")
  .split(/\s*,\s*|\s+\+\s+|\s+w\/\s*|\s+with\s+|\s+\/\s+|\s+and guests?\b/i).map((x) => x.trim()).filter((x) => x.length > 1 && x.length < 80).slice(0, 6);
// The feed's exact layout wasn't visible from the agent workspace: read any repeated element (<show>, <event>, <item>…)
// and its children by the usual names.
export function kingstonLive(xml) {
  xml = String(xml);
  const tag = (["show", "event", "item", "entry", "listing"].find((t) => (xml.match(new RegExp(`<${t}[\\s>]`, "gi")) || []).length > 0)) || null;
  if (!tag) return [];
  const blocks = xml.match(new RegExp(`<${tag}[\\s>][\\s\\S]*?<\\/${tag}>`, "gi")) || [];
  const out = [];
  for (const b of blocks) {
    const f = {};
    const inner = b.replace(/^<[^>]*>/, "").replace(/<\/[^>]*>\s*$/, "");
    for (const m of inner.matchAll(/<([a-z_:][\w:.-]*)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi)) { const k = m[1].toLowerCase().replace(/^.*:/, ""); if (!(k in f)) f[k] = plain(m[3]); }
    for (const m of b.matchAll(/\s([a-z_]+)="([^"]*)"/gi)) { const k = m[1].toLowerCase(); if (!(k in f)) f[k] = plain(m[2]); }
    const pick = (...ks) => { for (const k of ks) if (f[k]) return f[k]; return null; };
    const title = pick("title", "name", "show_title", "event_name", "headline", "summary");
    if (!title) continue;
    // Kingston Live's own layout (seen 2026-11-16): "Series: Act, Act @ Venue - Nov 16, 2026", time in the description
    // ("7:30 PM doors at 6:30 PM", "22:30", "1700"). Its listings cover the Kingston area (Wolfe Island, Gananoque…).
    const kl = title.match(/^(.+?)\s+@\s+(.+?)\s+-\s+([A-Z][a-z]{2,8})\.?\s+(\d{1,2}),\s+(\d{4})\s*$/);
    if (kl) {
      const M = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }, mo = M[kl[3].slice(0, 3).toLowerCase()];
      const head = kl[1], colon = head.indexOf(": "), series = colon > 0 ? head.slice(0, colon) : null, actsTxt = colon > 0 ? head.slice(colon + 2) : head;
      const acts = actsTxt.split(/\s*,\s*/).map((x) => x.trim()).filter((x) => x.length > 1 && x.length < 80).slice(0, 8);
      const desc = pick("description") || "";
      const t12 = desc.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/i), t24 = desc.match(/\b(\d{1,2}):(\d{2})\b/), t4 = desc.match(/(?:^|\s)(\d{2})(\d{2})(?:\s|$)/);
      let time = null;
      if (t12) { let h = +t12[1]; if (/pm/i.test(t12[3]) && h < 12) h += 12; if (/am/i.test(t12[3]) && h === 12) h = 0; time = String(h).padStart(2, "0") + ":" + t12[2]; }
      else if (t24) time = t24[1].padStart(2, "0") + ":" + t24[2];
      else if (t4 && +t4[1] < 24) time = t4[1] + ":" + t4[2];
      const blurb = desc.replace(/\s*\d{1,2}(:\d{2})?\s*(AM|PM)?(\s*-\s*\d{1,2}(:\d{2})?\s*(AM|PM)?)?(\s*doors at.*)?\s*$/i, "").trim();
      const link = pick("link") || "";
      out.push({ id: "kl:" + (pick("id") || title), artists: acts.length ? acts : [actsTxt], title: series ? head : null, date: mo ? `${kl[5]}-${String(mo).padStart(2, "0")}-${kl[4].padStart(2, "0")}` : null, time,
        venue: kl[2], city: "Kingston area", url: /^https?:\/\//i.test(link) ? link : null, km: null, genre: null, price: null, note: blurb && blurb.length > 2 ? blurb.slice(0, 160) : null, from: "Kingston Live" });
      continue;
    }
    const when = pick("date", "start_date", "startdate", "show_date", "event_date", "start", "datetime", "dtstart", "pubdate", "when") || "";
    let date = null, time = pick("time", "start_time", "starttime", "doors");
    const iso = when.match(/(\d{4})-(\d{2})-(\d{2})(?:[ t](\d{2}):(\d{2}))?/i);
    if (iso) { date = `${iso[1]}-${iso[2]}-${iso[3]}`; if (!time && iso[4]) time = `${iso[4]}:${iso[5]}`; }
    else if (when) {
      // "Fri, 21 Nov 2026 20:00:00 -0500" or "November 21, 2026 8:00 pm": the date as written (not shifted to UTC)
      const M = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
      const a = when.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3})[a-z]*\.?,?\s+(\d{4})/i) || when.match(/([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i);
      if (a) { const [dd, mm] = /^\d/.test(a[1]) ? [a[1], a[2]] : [a[2], a[1]], mo = M[mm.toLowerCase()];
        if (mo) date = `${a[3]}-${String(mo).padStart(2, "0")}-${String(dd).padStart(2, "0")}`; }
      if (!time) { const t = when.slice(a ? a.index + a[0].length : 0).match(/(\d{1,2}:\d{2})\s*(am|pm)?/i); if (t) time = t[1] + (t[2] || ""); }
    }
    const tm = time && String(time).match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i); if (tm) { let h = +tm[1]; if (tm[3] && /pm/i.test(tm[3]) && h < 12) h += 12; if (tm[3] && /am/i.test(tm[3]) && h === 12) h = 0; time = String(h).padStart(2, "0") + ":" + tm[2]; } else time = null;
    const acts = pick("artists", "performers", "bands", "acts", "lineup") ? actsOf(pick("artists", "performers", "bands", "acts", "lineup")) : actsOf(title);
    const link = pick("link", "url", "show_url", "permalink", "guid") || "";
    out.push({ id: "kl:" + (pick("id", "show_id", "guid") || title + date), artists: acts.length ? acts : [title], title, date, time,
      venue: pick("venue", "venue_name", "location", "place", "resource", "resource_name") || null, city: "Kingston, ON",
      url: /^https?:\/\//i.test(link) ? link : null, km: null, genre: pick("category", "genre") || null, price: pick("price", "cost", "admission", "tickets") || null, from: "Kingston Live" });
  }
  return out;
}

// ---- Bandsintown: one artist's upcoming dates (cached a day per artist), kept when near home ----
const bitCache = new Map();
async function bandsintown(name, cfg) {
  const c = bitCache.get(norm(name)); if (c && Date.now() - c.at < 24 * 3600e3) return c.v;
  let v = [];
  try {
    const j = await httpJson(`${BIT()}/artists/${encodeURIComponent(name).replace(/%2F/g, "%252F")}/events?app_id=${encodeURIComponent(process.env.BANDSINTOWN_APP_ID)}&date=upcoming`);
    v = (Array.isArray(j) ? j : []).map((e) => {
      const lat = +e.venue?.latitude, lon = +e.venue?.longitude, d = String(e.datetime || "");
      return { id: "bit:" + e.id, artists: [name, ...(e.lineup || []).filter((x) => norm(x) !== norm(name))], title: e.title || null, date: d.slice(0, 10) || null, time: d.slice(11, 16) || null,
        venue: e.venue?.name || null, city: [e.venue?.city, e.venue?.region].filter(Boolean).join(", ") || null, url: e.url || e.offers?.[0]?.url || null,
        km: Number.isFinite(lat) && Number.isFinite(lon) ? Math.round(km(cfg.lat, cfg.lon, lat, lon)) : null, genre: null, from: "Bandsintown" };
    });
  } catch { v = []; }
  bitCache.set(norm(name), { at: Date.now(), v });
  return v;
}

let cache = null, running = null;
// the last list fetched (followed-artist notes look here without fetching again)
export const cachedShows = () => (cache ? cache.list : []);
// interest: [{ name, why }] (strongest reason first; the page adds the artists you opened lately)
export async function shows(interest = [], { force = false } = {}) {
  const cfg = showsCfg(), k = keys();
  const why = new Map();
  for (const it of interest) { const n = norm(it.name); if (n && !why.has(n)) why.set(n, { name: it.name, why: it.why }); }
  const nearKingston = km(cfg.lat, cfg.lon, KINGSTON.lat, KINGSTON.lon) <= cfg.radiusKm;
  if (!k.ticketmaster && !k.bandsintown && !(k.kingstonlive && nearKingston)) return { keys: k, cfg, matches: [], local: [], nearby: [], note: "needs a key" };
  if (force || !cache || Date.now() - cache.at > 12 * 3600e3 || cache.radius !== cfg.radiusKm || cache.lat !== cfg.lat) {
    if (!running) running = (async () => {
      const errors = []; let list = [];
      if (k.ticketmaster) { try { list = list.concat(await ticketmaster(cfg)); } catch (e) { errors.push("Ticketmaster: " + e.message.slice(0, 120)); } }
      if (k.kingstonlive && nearKingston) {
        try { const v = kingstonLive(await httpText(KL_FEED())); if (!v.length) throw new Error("couldn't read the feed's format"); const d = Math.round(km(cfg.lat, cfg.lon, KINGSTON.lat, KINGSTON.lon)); list = list.concat(v.map((e) => ({ ...e, km: d }))); }
        catch (e) { errors.push("Kingston Live: " + e.message.slice(0, 120)); }
      }
      cache = { at: Date.now(), radius: cfg.radiusKm, lat: cfg.lat, list, errors };
    })().finally(() => { running = null; });
    await running;
  }
  let list = cache.list.slice();
  // Bandsintown for the first 40 artists you care about (slowly: about one request a second, a day's cache each)
  if (k.bandsintown) {
    for (const { name } of [...why.values()].slice(0, 40)) {
      const fresh = !bitCache.has(norm(name));
      list = list.concat((await bandsintown(name, cfg)).filter((e) => e.km != null && e.km <= cfg.radiusKm));
      if (fresh) await new Promise((r) => setTimeout(r, 1000));
    }
  }
  const today = new Date().toISOString().slice(0, 10), seen = new Set(), all = [];
  for (const e of list.sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
    if (e.date && e.date < today) continue;
    const key = norm(e.artists[0] || e.title) + "|" + e.date + "|" + String(e.time || "").slice(0, 2);   // a matinee and an evening show both stay
    if (seen.has(key)) continue; seen.add(key);
    const hit = e.artists.map((a) => why.get(norm(a))).find(Boolean);
    all.push(hit ? { ...e, match: hit } : e);
  }
  // Kingston Live gets its own full list (user, 2026-11-16: "just show all artists from kingston live"); the rest stay folded
  const kl = (e) => String(e.id).startsWith("kl:");
  return { keys: k, cfg, checked: cache.at, errors: cache.errors, matches: all.filter((e) => e.match), local: all.filter((e) => !e.match && kl(e)), nearby: all.filter((e) => !e.match && !kl(e)).slice(0, 150) };
}
