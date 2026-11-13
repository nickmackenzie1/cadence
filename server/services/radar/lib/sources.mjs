// More places to hear about music besides Reddit (Cadence addition, user request 2026-11-13).
// Each source turns what it finds into "signals": { uid, artist, title, type, url, image, genres, rank, metric, feed, date }.
// They're stored in cadence.db (radar_signals, plus radar_chart_points for chart positions over time), so the dashboard
// can show each source on its own, combine them per artist, and chart trends. A source that fails records its error
// in radar_source_runs and never stops the others.
//
// Open APIs: ListenBrainz fresh releases (sitewide, and yours with a username), Apple Music charts, Audius trending,
// Last.fm charts and tag pages (needs LASTFM_API_KEY). No official API: Bandcamp discover (the endpoint the site uses),
// Hype Machine (its public JSON). Plain RSS: music blogs and magazines, read for artist names.
import { createRequire } from "node:module";
import { httpJson, httpText } from "./http.mjs";
import { norm, parseTitle } from "./extract.mjs";
import { hasAI, claude, parseJson } from "./ai.mjs";
import { now } from "./config.mjs";

const require = createRequire(import.meta.url);
let parseFeed = null;
try { ({ parseFeed } = require("../../../lib/feedparse.js")); } catch (e) { console.error("radar: feed parser", e); }   // Cadence's RSS/Atom parser (no config, no disk)

export const DEFAULT_BLOGS = [
  { name: "Pitchfork reviews", url: "https://pitchfork.com/feed/feed-album-reviews/rss" },
  { name: "Pitchfork news", url: "https://pitchfork.com/feed/feed-news/rss" },
  { name: "Stereogum", url: "https://www.stereogum.com/feed/" },
  { name: "The Fader", url: "https://www.thefader.com/rss.xml" },
  { name: "Gorilla vs. Bear", url: "https://www.gorillavsbear.net/feed/" },
  { name: "Bandcamp Daily", url: "https://daily.bandcamp.com/feed" },
];
export const DEFAULT_CFG = {
  on: { listenbrainz: true, apple: true, audius: true, lastfm: true, bandcamp: true, hypem: true, blogs: true },
  lbUser: "",            // ListenBrainz username for your own fresh releases
  appleCountry: "ca",
  audiusGenres: ["", "Electronic", "Hip-Hop/Rap", "Alternative"],   // "" = all genres
  tags: [],              // Bandcamp + Last.fm tags; empty = your top taste genres, else a starter set
  blogs: DEFAULT_BLOGS,
};
const STARTER_TAGS = ["indie", "shoegaze", "hip-hop", "electronic", "post-punk"];
const slug = (s) => String(s).toLowerCase().trim().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
const pick = (o, ...ks) => { for (const k of ks) { const v = k.split(".").reduce((x, p) => (x == null ? x : x[p]), o); if (v != null && v !== "") return v; } return null; };

// ---------- the sources ----------
export const SOURCES = {
  listenbrainz: {
    name: "ListenBrainz", kind: "Fresh releases", site: "https://listenbrainz.org/explore/fresh-releases/",
    async fetch(cfg) {
      const out = [];
      const add = (body, feed) => {
        for (const r of arr(pick(body, "payload.releases", "releases") || (Array.isArray(body) ? body : []))) {
          const artist = r.artist_credit_name; if (!artist || !r.release_name) continue;
          out.push({ uid: r.release_mbid || r.release_group_mbid || `${artist}|${r.release_name}`, artist, title: r.release_name,
            type: String(r.release_group_primary_type || "album").toLowerCase(), date: r.release_date || null, feed,
            url: r.release_group_mbid ? `https://musicbrainz.org/release-group/${r.release_group_mbid}` : r.release_mbid ? `https://musicbrainz.org/release/${r.release_mbid}` : null,
            image: r.caa_id && r.caa_release_mbid ? `https://coverartarchive.org/release/${r.caa_release_mbid}/${r.caa_id}-250.jpg` : null,
            genres: arr(r.release_tags).map(String).slice(0, 4), metric: r.confidence ?? null });
        }
      };
      add(await httpJson("https://api.listenbrainz.org/1/explore/fresh-releases/?days=30&past=true&future=true"), "Everyone");
      if (cfg.lbUser) add(await httpJson(`https://api.listenbrainz.org/1/user/${encodeURIComponent(cfg.lbUser)}/fresh_releases?days=30&sort=confidence`), "For you");
      return out;
    },
  },
  apple: {
    name: "Apple Music", kind: "Charts", site: "https://music.apple.com/",
    async fetch(cfg) {
      const cc = (cfg.appleCountry || "ca").toLowerCase().slice(0, 2), out = [];
      for (const what of ["albums", "songs"]) {
        const body = await httpJson(`https://rss.applemarketingtools.com/api/v2/${cc}/music/most-played/100/${what}.json`);
        arr(pick(body, "feed.results")).forEach((r, i) => {
          if (!r.artistName || !r.name) return;
          out.push({ uid: `${cc}:${what}:${r.id || r.artistName + "|" + r.name}`, artist: r.artistName, title: r.name, type: what === "albums" ? "album" : "track",
            rank: i + 1, url: r.url || null, image: r.artworkUrl100 || null, date: r.releaseDate || null, feed: `Top ${what} (${cc.toUpperCase()})`,
            genres: arr(r.genres).map((g) => g.name).filter((g) => g && g !== "Music").slice(0, 3) });
        });
      }
      return out;
    },
  },
  audius: {
    name: "Audius", kind: "Trending", site: "https://audius.co/trending",
    async fetch(cfg) {
      const out = [];
      for (const genre of cfg.audiusGenres?.length ? cfg.audiusGenres : [""]) {
        const body = await httpJson(`https://api.audius.co/v1/tracks/trending?time=week&app_name=cadence-music-radar${genre ? "&genre=" + encodeURIComponent(genre) : ""}`);
        arr(body.data).slice(0, 100).forEach((t, i) => {
          const artist = pick(t, "user.name", "user.handle"); if (!artist || !t.title) return;
          out.push({ uid: `${genre || "all"}:${t.id}`, artist, title: t.title, type: "track", rank: i + 1, metric: t.play_count ?? null,
            url: t.permalink ? "https://audius.co" + t.permalink : null, image: pick(t, "artwork.150x150", "artwork.480x480"),
            genres: [t.genre, t.mood].filter(Boolean).map((g) => String(g).toLowerCase()).slice(0, 2), feed: genre || "All genres", date: t.release_date || null });
        });
      }
      return out;
    },
  },
  lastfm: {
    name: "Last.fm", kind: "Charts and tags", site: "https://www.last.fm/charts", needs: "LASTFM_API_KEY",
    async fetch(cfg, ctx) {
      const key = process.env.LASTFM_API_KEY; if (!key) throw new Error("needs LASTFM_API_KEY on the NAS");
      const api = (q) => httpJson(`https://ws.audioscrobbler.com/2.0/?${q}&api_key=${key}&format=json&limit=50`), out = [];
      const chart = await api("method=chart.gettopartists");
      arr(pick(chart, "artists.artist")).forEach((a, i) => a.name && out.push({ uid: `chart:${a.name}`, artist: a.name, title: a.name, type: "artist", rank: i + 1, metric: +a.listeners || null, url: a.url, feed: "Top artists" }));
      for (const tag of ctx.tags.slice(0, 6)) {
        const t = await api(`method=tag.gettopartists&tag=${encodeURIComponent(tag)}`);
        arr(pick(t, "topartists.artist")).forEach((a, i) => a.name && out.push({ uid: `tag:${tag}:${a.name}`, artist: a.name, title: a.name, type: "artist", rank: i + 1, url: a.url, genres: [tag], feed: `Tag: ${tag}` }));
      }
      return out;
    },
  },
  bandcamp: {
    name: "Bandcamp", kind: "New by tag", site: "https://bandcamp.com/discover",
    async fetch(cfg, ctx) {
      const out = [], errors = [];
      for (const tag of ctx.tags.slice(0, 6)) {
        const t = slug(tag);
        let items = null;
        try {   // the endpoint bandcamp.com/discover uses
          const body = await httpJson("https://bandcamp.com/api/discover/1/discover_web", { headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category_id: 0, tag_norm_names: [t], geoname_id: 0, slice: "new", cursor: "*", size: 60, include_result_types: ["a", "s"] }) });
          items = arr(body.results);
        } catch (e) { errors.push(e.message); }
        if (!items || !items.length) try {   // the older one
          const body = await httpJson("https://bandcamp.com/api/hub/2/dig_deeper", { headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filters: { format: "all", location: 0, sort: "date", tags: [t] }, page: 1 }) });
          items = arr(body.items);
        } catch (e) { errors.push(e.message); }
        for (const r of items || []) {
          const artist = pick(r, "band_name", "artist", "album_artist"), title = pick(r, "title", "album_title", "item_title");
          if (!artist || !title) continue;
          const url = pick(r, "item_url", "tralbum_url", "url", "band_url");
          out.push({ uid: url || `${artist}|${title}`, artist, title, type: /track|^t$/.test(String(pick(r, "item_type", "result_type", "tralbum_type") || "")) ? "track" : "album",
            url, image: r.item_image_id || r.art_id ? `https://f4.bcbits.com/img/a${r.item_image_id || r.art_id}_9.jpg` : null,
            date: pick(r, "release_date", "publish_date"), genres: [tag, pick(r, "genre", "band_genre_name")].filter(Boolean).map((g) => String(g).toLowerCase()), feed: `Tag: ${tag}` });
        }
      }
      if (!out.length && errors.length) throw new Error(errors[0]);
      return out;
    },
  },
  hypem: {
    name: "Hype Machine", kind: "Blog buzz", site: "https://hypem.com/popular",
    async fetch() {
      const out = [];
      for (const [path, feed] of [["popular/3day", "Popular"], ["latest/noremix", "Latest"]]) {
        const body = await httpJson(`https://hypem.com/playlist/${path}/json/1/data.js`);
        Object.entries(body).filter(([k]) => /^\d+$/.test(k)).forEach(([k, t]) => {
          if (!t || !t.artist || !t.title) return;
          out.push({ uid: `${path}:${t.mediaid || t.artist + "|" + t.title}`, artist: t.artist, title: t.title, type: "track", rank: +k + 1,
            metric: +t.loved_count || null, url: t.mediaid ? `https://hypem.com/track/${t.mediaid}` : t.posturl || null, image: t.thumb_url || null,
            feed: `${feed}${t.sitename ? " · " + t.sitename : ""}`, date: t.dateposted ? new Date(t.dateposted * 1000).toISOString() : null });
        });
      }
      return out;
    },
  },
  blogs: {
    name: "Blogs and magazines", kind: "Headlines", site: null,
    async fetch(cfg) {
      if (!parseFeed) throw new Error("feed parser not available");
      const items = [], errors = [];
      for (const b of cfg.blogs?.length ? cfg.blogs : DEFAULT_BLOGS) {
        try { const f = parseFeed(await httpText(b.url), b.url); for (const it of f.items.slice(0, 40)) items.push({ ...it, feed: b.name }); }
        catch (e) { errors.push(`${b.name}: ${e.message}`); }
      }
      if (!items.length && errors.length) throw new Error(errors.join("; "));
      const found = await headlines(items);
      return Object.assign(found, { warnings: errors });
    },
  },
};

// ---------- artist names from blog headlines ----------
const VERBS = "announces?|shares?|releases?|drops?|returns?|unveils?|debuts?|premieres?|teases?|details|covers?|signs?|is back|talks?|on (?:their|her|his|the)|interview|reveals?|plots?|confirms?";
export function fromHeadline(title) {
  const t = String(title).replace(/\s+/g, " ").trim();
  let m;
  const clean = (s) => s.replace(/^(?:watch|listen|stream|hear|premiere|video|review|new music|song of the day|album of the week|track of the day)\s*[:\-–—]\s*/i, "").replace(/[“”"]/g, "").trim();
  const ok = (a) => a && a.length > 1 && a.length < 50 && a.split(" ").length <= 6 && !/^(the|a|an|how|why|what|when|our|this|these|best|new|every|listen|watch|stream|review|interview|we|you|i)\b/i.test(a);
  const s = clean(t);
  // Artist – "Song" / Artist: Album
  const p = parseTitle(s.replace(/[“”]/g, '"'));
  if (p && ok(p.artist)) return { artist: p.artist, title: p.song, type: p.type };
  if ((m = s.match(/^([^:]{2,50}):\s+(.{2,120})$/)) && ok(m[1])) return { artist: m[1].trim(), title: m[2].replace(/\s*(album|ep) review$/i, "").trim(), type: "album" };
  // "Song" by Artist
  if ((m = t.match(/[“"]([^”"]{2,80})[”"]\s+by\s+([A-Z0-9][^,.:;!?]{1,45})/))) return { artist: m[2].trim(), title: m[1].trim(), type: "track" };
  // Artist Announces New Album "Title" / Artist Shares New Song …
  if ((m = s.match(new RegExp(`^([A-Z0-9][^,:;!?]{1,48}?)\\s+(?:${VERBS})\\b(.*)$`, "i"))) && ok(m[1])) {
    const q = t.match(/[“"]([^”"]{2,80})[”"]|‘([^’]{2,80})’/);
    return { artist: m[1].trim(), title: q ? (q[1] || q[2]) : m[2].trim().slice(0, 90), type: /album|lp/i.test(m[2]) ? "album" : /\bep\b/i.test(m[2]) ? "ep" : "track" };
  }
  return null;
}
async function headlines(items) {
  const out = [], add = (it, f) => out.push({ uid: it.link || `${it.feed}|${it.title}`, artist: f.artist, title: f.title || it.title, type: f.type || "article",
    url: it.link || null, image: it.image || null, date: it.date || null, feed: it.feed, headline: it.title, genres: (f.genres || []).slice(0, 3) });
  if (hasAI() && items.length) {
    // Claude reads the headlines in batches: better than the rules for things like "Pitchfork's 30 best albums of…"
    for (let i = 0; i < items.length; i += 40) {
      const batch = items.slice(i, i + 40);
      try {
        const res = parseJson(await claude("For each music headline, give the main artist it's about and the song/album title if any. "
          + 'Skip lists, roundups and non-music headlines. Reply with JSON only: [{"i":0,"artist":"…","title":"…","type":"album|ep|track|article","genres":["…"]}].\n\n'
          + batch.map((it, k) => `${k}. [${it.feed}] ${it.title}${it.summary ? " — " + it.summary.slice(0, 140) : ""}`).join("\n"), 2500));
        for (const r of arr(res)) { const it = batch[r.i]; if (it && r.artist) add(it, r); }
        continue;
      } catch (e) { console.log(`  ! AI headline reading failed (using rules): ${e.message}`); }
      for (const it of batch) { const f = fromHeadline(it.title); if (f) add(it, f); }
    }
    return out;
  }
  for (const it of items) { const f = fromHeadline(it.title); if (f) add(it, f); }
  return out;
}

// ---------- run them ----------
export function tagsFor(cfg, state) {
  if (cfg.tags?.length) return cfg.tags;
  // your taste first: genres of picks you gave a thumbs up
  const n = {};
  for (const p of state?.picks || []) if (state.feedback?.[p.id] > 0) for (const g of p.genres || []) n[g] = (n[g] || 0) + 1;
  const mine = Object.entries(n).sort((a, b) => b[1] - a[1]).map(([g]) => g);
  return [...new Set([...mine, ...STARTER_TAGS])].slice(0, 6);
}

export async function runSources(cfg, { store, state, only = null, log = console.log } = {}) {
  cfg = { ...DEFAULT_CFG, ...(cfg || {}), on: { ...DEFAULT_CFG.on, ...(cfg?.on || {}) } };
  const ctx = { tags: tagsFor(cfg, state) }, ts = now(), summary = [];
  for (const [id, src] of Object.entries(SOURCES)) {
    if (only ? !only.includes(id) : !cfg.on[id]) continue;
    if (src.needs && !process.env[src.needs]) { store.addSourceRun({ ts, source: id, ok: 0, n: 0, fresh: 0, ms: 0, error: `skipped: needs ${src.needs}` }); continue; }
    const t0 = Date.now();
    try {
      const rows = await src.fetch(cfg, ctx);
      const signals = rows.filter((r) => r.artist).map((r) => ({ ...r, source: id, uid: String(r.uid).slice(0, 300), artist_key: norm(r.artist) })).filter((r) => r.artist_key);
      const fresh = store.upsertSignals(signals, ts);
      const warn = rows.warnings?.length ? rows.warnings.join("; ") : null;
      store.addSourceRun({ ts, source: id, ok: 1, n: signals.length, fresh, ms: Date.now() - t0, error: warn });
      log(`${src.name}: ${signals.length} found, ${fresh} new${warn ? " (" + warn + ")" : ""}`);
      summary.push({ id, n: signals.length, fresh });
    } catch (e) {
      store.addSourceRun({ ts, source: id, ok: 0, n: 0, fresh: 0, ms: Date.now() - t0, error: e.message });
      log(`! ${src.name} failed: ${e.message}`);
      summary.push({ id, error: e.message });
    }
  }
  return summary;
}
