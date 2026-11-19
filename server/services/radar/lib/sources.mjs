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
import { norm, parseTitle, isArtist, cleanName } from "./extract.mjs";
import { hasAI, claude, parseJson } from "./ai.mjs";
import { now, DAY } from "./config.mjs";
import { lastfmTurnedDown, lastfmJson } from "./enrich.mjs";

const require = createRequire(import.meta.url);
let parseFeed = null;
try { ({ parseFeed } = require("../../../lib/feedparse.js")); } catch (e) { console.error("radar: feed parser", e); }   // Cadence's RSS/Atom parser (no config, no disk)

// tier "big": mainstream outlets that count for less, so a band only looks like it's rising once the small blogs and
// radio pick it up too (user, 2026-11-15). tier "small": independent blogs that post less but are picky.
export const DEFAULT_BLOGS = [
  { name: "Pitchfork reviews", url: "https://pitchfork.com/feed/feed-album-reviews/rss", tier: "big" },
  { name: "Pitchfork news", url: "https://pitchfork.com/feed/feed-news/rss", tier: "big" },
  { name: "Stereogum", url: "https://www.stereogum.com/feed/" },
  { name: "The Fader", url: "https://www.thefader.com/feed.rss", tier: "big" },
  { name: "Gorilla vs. Bear", url: "https://www.gorillavsbear.net/feed/", tier: "small" },
  { name: "Bandcamp Daily", url: "https://daily.bandcamp.com/feed", tier: "small" },
  // added 2026-11-15 for underground indie rock. Feed addresses follow each site's platform (WordPress /feed/,
  // Squarespace ?format=rss) and weren't checked from the agent workspace: a wrong one shows as a warning in Sources.
  { name: "Post-Trash", url: "https://post-trash.com/news?format=rss", tier: "small" },
  { name: "Rosy Overdrive", url: "https://rosyoverdrive.com/feed/", tier: "small" },
  { name: "Aquarium Drunkard", url: "https://aquariumdrunkard.com/feed/", tier: "small" },
  { name: "Obscure Sound", url: "https://feeds.feedburner.com/ObscureSound", tier: "small" },   // the address the user sent (2026-11-17)
  { name: "Under the Radar", url: "https://www.undertheradarmag.com/site/rss", tier: "small" },
  { name: "Said the Gramophone", url: "https://feeds.feedburner.com/saidthegramophone/stg", tier: "small" },
  { name: "The Line of Best Fit", url: "https://bestfitmusic.substack.com/feed", tier: "small" },
  // 2026-11-16: Canadian campus radio's review feed (user sent the address)
  { name: "!earshot reviews", url: "https://www.earshot-online.com/reviews/rss.cfm", tier: "small" },
  { name: "Drowned in Sound", url: "https://www.drownedinsound.org/rss/", tier: "small" },   // user sent 2026-11-16
  // user sent 2026-11-16: Canadian and long-running indie blogs (WordPress feed addresses, unchecked from the agent workspace)
  { name: "Spill Magazine", url: "https://spillmagazine.com/feed/", tier: "small" },
  { name: "Canadian Beats", url: "https://canadianbeats.ca/feed/", tier: "small" },
  { name: "EARMILK", url: "https://earmilk.com/feed/" },
  // user sent 2026-11-16 (feed addresses as given)
  { name: "The Last Mixed Tape", url: "https://thelastmixedtape.com/feed/", tier: "small" },
  { name: "Right Chord Music", url: "https://www.rightchordmusic.co.uk/feed/", tier: "small" },
  { name: "Indie Pulse Music", url: "https://indiepulsemusic.com/feed/", tier: "small" },
  { name: "Indie Rock Cafe", url: "https://feeds.feedburner.com/indierockcafe/ycjd", tier: "small" },
  // user sent 2026-11-17: the rest of Pitchfork's feeds. Best New Albums/Tracks are their picks (normal weight); the
  // others are a big outlet's everyday output (counts for less); reissues are mostly older music (counts for less)
  { name: "Pitchfork Best New Albums", url: "https://pitchfork.com/feed/reviews/best/albums/rss" },
  { name: "Pitchfork Best New Tracks", url: "https://pitchfork.com/feed/reviews/best/tracks/rss" },
  { name: "Pitchfork Best New Reissues", url: "https://pitchfork.com/feed/reviews/best/reissues/rss", tier: "big" },
  { name: "Pitchfork track reviews", url: "https://pitchfork.com/feed/feed-track-reviews/rss", tier: "big" },
  { name: "Pitchfork: The Pitch", url: "https://pitchfork.com/feed/feed-the-pitch/rss", tier: "big" },
  { name: "Pitchfork features", url: "https://pitchfork.com/feed/feed-features/rss", tier: "big" },
  // user sent 2026-11-17 (checked: all post often; The Line of Best Fit's Feedburner feed stopped in September, so the
  // Substack one above stays). skip: posts that aren't about one artist
  { name: "BrooklynVegan", url: "https://www.brooklynvegan.com/feed/", tier: "big" },
  { name: "My AMP Music", url: "https://myampmusic.co/feed/", tier: "small" },
  { name: "Indie Shuffle", url: "https://feeds.feedburner.com/indieshuffle", tier: "small" },
  { name: "Nialler9", url: "https://feeds.feedburner.com/nialler9/rss", tier: "small", skip: "gig guide|gigs? (?:this|of the) week|what'?s on" },
];
// a saved list that is just the old six defaults gets the new ones; a list you changed yourself is left alone
const SIX = ["Pitchfork reviews", "Pitchfork news", "Stereogum", "The Fader", "Gorilla vs. Bear", "Bandcamp Daily"];
const V080 = [...SIX, "Post-Trash", "Rosy Overdrive", "Aquarium Drunkard", "Obscure Sound", "Under the Radar", "The Line of Best Fit"];
const V0101 = [...V080, "!earshot reviews", "Drowned in Sound"];
const V0110 = [...V0101, "Said the Gramophone", "Spill Magazine", "Canadian Beats", "EARMILK"];
// the defaults until 0.14.0 (before Under the Radar and Said the Gramophone lost their feeds); built after DEFAULT_BLOGS below
// the defaults until 0.27.3 (before the extra Pitchfork feeds)
const V0272 = [...V0110, "The Line of Best Fit", "!earshot reviews", "Drowned in Sound", "The Last Mixed Tape", "Right Chord Music", "Indie Pulse Music", "Indie Rock Cafe"];
// the defaults until 0.28.1 (before BrooklynVegan, My AMP Music, Indie Shuffle and Nialler9)
const V0281 = [...new Set(V0272), "Pitchfork Best New Albums", "Pitchfork Best New Tracks", "Pitchfork Best New Reissues", "Pitchfork track reviews", "Pitchfork: The Pitch", "Pitchfork features"];
export const OLD_DEFAULT_SETS = [SIX, V080, [...V080, "!earshot reviews"], V0101, V0110, [...new Set(V0272)], V0281];
// feeds that moved or went away (checked 2026-11-16): saved lists follow these too. null = no feed any more.
const MOVED = {
  "https://www.thefader.com/rss.xml": "https://www.thefader.com/feed.rss",
  "https://www.thelineofbestfit.com/feeds/rss": "https://bestfitmusic.substack.com/feed",
  "https://www.undertheradarmag.com/rss.xml": "https://www.undertheradarmag.com/site/rss",   // address from the user
  "https://www.saidthegramophone.com/feed/": "https://feeds.feedburner.com/saidthegramophone/stg",   // the feed linked in the blog's footer
  "https://www.obscuresound.com/feed/": "https://feeds.feedburner.com/ObscureSound",   // address from the user, 2026-11-17
};
OLD_DEFAULT_SETS.push(V0281.filter((n) => n !== "Under the Radar" && n !== "Said the Gramophone"));   // 0.14.0, briefly without them
export function blogList(cfg) {
  const b0 = cfg?.blogs, b = b0 && b0.map((x) => (x.url in MOVED ? (MOVED[x.url] ? { ...x, url: MOVED[x.url] } : null) : x)).filter(Boolean);
  if (b0?.length && OLD_DEFAULT_SETS.some((set) => b0.length === set.length && b0.every((x) => set.includes(x.name)))) return DEFAULT_BLOGS;
  if (!b?.length) return DEFAULT_BLOGS;
  return b.map((x) => { const d = DEFAULT_BLOGS.find((d) => d.url === x.url || d.name === x.name); return { ...x, tier: x.tier || d?.tier, skip: x.skip || d?.skip }; });
}
export const DEFAULT_CFG = {
  on: { listenbrainz: true, lbcharts: true, apple: true, audius: true, lastfm: true, bandcamp: true, hypem: true, blogs: true, kexp: true, earshot: true, kexpchart: true },
  lbUser: "",            // ListenBrainz username for your own fresh releases
  appleCountry: "ca",
  audiusGenres: ["", "Electronic", "Hip-Hop/Rap", "Alternative"],   // "" = all genres
  tags: [],              // Bandcamp (+ Last.fm, with a working key) tags; empty = your top taste genres, else a starter set
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
  // Last.fm keys need Pro from 1 December 2026: this runs only while the key works (ListenBrainz charts cover the rest)
  lastfm: {
    name: "Last.fm", kind: "Charts and tags", site: "https://www.last.fm/charts", needs: "LASTFM_API_KEY",
    async fetch(cfg, ctx) {
      const down = lastfmTurnedDown();
      if (down) throw new Error("skipped: Last.fm turned the key down (keys need Pro from 1 December 2026); ListenBrainz charts cover this");
      const api = (q) => lastfmJson(`${q}&limit=50`), out = [];
      const chart = await api("method=chart.gettopartists");
      arr(pick(chart, "artists.artist")).forEach((a, i) => a.name && out.push({ uid: `chart:${a.name}`, artist: a.name, title: a.name, type: "artist", rank: i + 1, metric: +a.listeners || null, url: a.url, feed: "Top artists" }));
      for (const tag of ctx.tags.slice(0, 6)) {
        const t = await api(`method=tag.gettopartists&tag=${encodeURIComponent(tag)}`);
        arr(pick(t, "topartists.artist")).forEach((a, i) => a.name && out.push({ uid: `tag:${tag}:${a.name}`, artist: a.name, title: a.name, type: "artist", rank: i + 1, url: a.url, genres: [tag], feed: `Tag: ${tag}` }));
      }
      return out;
    },
  },
  // the free chart (2026-11-19): who ListenBrainz listeners played most this week and month, no key
  lbcharts: {
    name: "ListenBrainz charts", kind: "Charts", site: "https://listenbrainz.org/statistics/",
    async fetch() {
      const out = [], base = process.env.LISTENBRAINZ_API || "https://api.listenbrainz.org";
      for (const [range, feed] of [["week", "Top artists this week"], ["month", "Top artists this month"]]) {
        const j = await httpJson(`${base}/1/stats/sitewide/artists?count=100&range=${range}`);
        arr(pick(j, "payload.artists")).forEach((a, i) => a.artist_name && out.push({ uid: `lbc:${range}:${a.artist_name}`, artist: a.artist_name, title: a.artist_name,
          type: "artist", rank: i + 1, metric: +a.listen_count || null, url: (a.artist_mbid || (a.artist_mbids || [])[0]) ? `https://listenbrainz.org/artist/${a.artist_mbid || a.artist_mbids[0]}/` : null, feed }));
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
  kexp: {
    // DJs choose the records, not an algorithm: what moves into heavy rotation is an early "about to break" signal
    name: "KEXP", kind: "Radio airplay", site: "https://www.kexp.org/playlist/",
    async fetch() {
      const plays = [];
      let url = "https://api.kexp.org/v2/plays/?format=json&limit=200&ordering=-airdate";
      for (let page = 0; page < 6 && url; page++) { const b = await httpJson(url); plays.push(...arr(b.results)); url = b.next || null; }
      return kexpSignals(plays);
    },
  },
  earshot: {
    // !earshot's National Top 50: what Canadian campus and community radio played most this week. Their published
    // feed (user sent the address 2026-11-16), fetched at most once a day like a feed reader would.
    name: "!earshot campus radio", kind: "Campus radio chart", site: "https://www.earshot-online.com/charts/",
    async fetch() {
      if (earshotCache.v && Date.now() - earshotCache.at < 20 * 3600e3) return earshotCache.v;
      if (!parseFeed) throw new Error("feed parser not available");
      const xml = await httpText(EARSHOT_CHART), f = parseFeed(xml, EARSHOT_CHART);
      let v = earshotChart(f.items);
      if (!v.length) v = earshotChart(earshotRows(xml).map((title) => ({ title, link: f.items[0]?.link, date: f.items[0]?.date })));
      if (!v.length) throw new Error(f.items.length ? "couldn't read the chart's format (first item: " + String(f.items[0].title).slice(0, 80) + ")" : "the chart feed was empty");
      earshotCache = { at: Date.now(), v };
      return v;
    },
  },
  kexpchart: {
    // KEXP's weekly charts (kexp.org/charts, no feed): the Top 90, ten-record genre lists, and Adds, the records
    // just put into rotation that week. Read at most once a day.
    name: "KEXP weekly charts", kind: "Radio chart", site: "https://www.kexp.org/charts/",
    async fetch() {
      if (kexpChartCache.v && Date.now() - kexpChartCache.at < 20 * 3600e3) return kexpChartCache.v;
      const v = kexpChart(await httpText(KEXP_CHARTS));
      if (!v.length) throw new Error("couldn't read the chart page's format");
      kexpChartCache = { at: Date.now(), v };
      return v;
    },
  },
  blogs: {
    name: "Blogs and magazines", kind: "Headlines", site: null,
    async fetch(cfg) {
      if (!parseFeed) throw new Error("feed parser not available");
      const items = [], errors = [];
      for (const b of blogList(cfg)) {
        try {
          const f = parseFeed(await httpText(b.url), b.url), skip = b.skip ? new RegExp(b.skip, "i") : null;
          for (const it of f.items.slice(0, 40)) if (!skip || !(skip.test(it.title) || (it.categories || []).some((c) => skip.test(c)))) items.push({ ...it, feed: b.name });
        }
        catch (e) { errors.push(`${b.name}: ${e.message}`); }
      }
      if (!items.length && errors.length) throw new Error(errors.join("; "));
      const found = await headlines(items);
      return Object.assign(found, { warnings: errors });
    },
  },
};

// ---------- KEXP weekly charts ----------
const KEXP_CHARTS = process.env.KEXP_CHARTS || "https://www.kexp.org/charts/";
let kexpChartCache = { at: 0, v: null };
// The page is a run of headings ("Top 90:", "Jazz:", "Adds:") each followed by lines "12. Artist - Title (Label)"
// (Adds have no numbers). Lists may be <ol>/<ul> items or <br>-separated lines.
export function kexpChart(html) {
  const ent = (t) => t.replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&quot;/g, '"').replace(/&#39;|&apos;|&rsquo;/g, "’").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const text = (h) => ent(String(h).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  html = String(html);
  const week = text((html.match(/KEXP Charts for the Week of[^<]*/i) || [""])[0]).replace(/^KEXP Charts for the /i, "") || null;
  const out = [], seen = new Set();
  const parts = html.split(/<h[1-6][^>]*>/i).slice(1);
  let ordered = 0;
  for (const part of parts) {
    const end = part.search(/<\/h[1-6]>/i); if (end < 0) continue;
    const head = text(part.slice(0, end)).replace(/:$/, "").trim();
    if (!head || head.length > 40 || /charts for the week|add date/i.test(head)) continue;
    const body = part.slice(end);
    let lines = (body.match(/<li[\s>][\s\S]*?<\/li>/gi) || []).map(text);
    if (!lines.length) lines = body.split(/<br\s*\/?>|<\/p>|\n/i).map(text);
    const adds = /^adds?$/i.test(head);
    let i = 0;
    for (let l of lines) {
      if (!l) continue;
      const num = l.match(/^(\d{1,3})[.)]\s+/); if (num) l = l.slice(num[0].length);
      const m = l.match(/^(.{1,120}?)\s+[-–—]\s+(.{1,200}?)(?:\s+\(([^()]{1,80})\))?\s*$/); if (!m) continue;
      i++;
      const artist = m[1].trim(), title = m[2].replace(/^["“]|["”]$/g, "").trim(), rank = adds ? null : num ? +num[1] : i;
      if (!isArtist(artist)) continue;
      const uid = "kexpchart:" + norm(head) + ":" + norm(artist) + "|" + norm(title);
      if (seen.has(uid)) continue; seen.add(uid);
      out.push({ uid, artist: cleanName(artist) || artist, title, type: /\bb\/w\b|^".*"$/.test(m[2]) ? "track" : "album", rank, metric: rank ? Math.max(1, (head === "Top 90" ? 91 : 11) - rank) : null,
        feed: adds ? "Adds this week" : head, url: KEXP_CHARTS, label: m[3] || null, genres: [], date: week, image: null });
    }
    ordered++;
  }
  return out;
}

// ---------- !earshot National Top 50 ----------
// The feed is one item ("!earshot Top 50 for the Week Ending …") whose description holds the whole chart as HTML
// (table rows, list items or <br> lines). Turn that into one line per album, "rank. Artist - Album (Label)".
export function earshotRows(xml) {
  const ent = (t) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&amp;/g, "&");
  const item = (String(xml).match(/<item[\s>][\s\S]*?<\/item>/i) || [String(xml)])[0];
  let html = (item.match(/<(content:encoded|description)[^>]*>([\s\S]*?)<\/\1>/i) || [])[2] || "";
  html = html.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1");
  if (!/<[a-z]/i.test(html)) html = ent(html);            // escaped HTML inside <description>
  const text = (h) => ent(h.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const rows = [];
  const trs = html.match(/<tr[\s>][\s\S]*?<\/tr>/gi);
  if (trs && trs.length > 5) {
    for (const tr of trs) {
      const cells = (tr.match(/<t[dh][\s>][\s\S]*?<\/t[dh]>/gi) || []).map(text).filter(Boolean);
      if (cells.length < 2 || !/^\d{1,3}\.?$/.test(cells[0])) continue;     // header rows
      const [rank, artist, album, label] = [cells[0].replace(".", ""), ...cells.slice(1).filter((c) => !/^(\*|cc|\d{1,3}|-|new|re)$/i.test(c))];
      if (artist) rows.push(`${rank}. ${artist}${album ? " - " + album : ""}${label ? " (" + label + ")" : ""}`);
    }
  } else {
    for (const part of html.split(/<br\s*\/?>|<\/?(?:li|p|div)[^>]*>|\n/i)) { const t = text(part); if (/^#?\s*\d{1,3}\s*[.):\-–]?\s+\S/.test(t)) rows.push(t); }
  }
  return rows;
}
const EARSHOT_CHART = "https://www.earshot-online.com/charts/NewTop50Feed.cfm";
let earshotCache = { at: 0, v: null };
// The feed's exact layout wasn't visible from the agent workspace, so this reads the common shapes:
// "12. Artist - Album (Label)", "Artist – Album [Label] *", or the artist in the title and "Album (Label)" in the text.
// A trailing * or "CC" marks Canadian content.
export function earshotChart(items) {
  const out = [], seen = new Set();
  items.forEach((it, i) => {
    let text = String(it.title || "").replace(/\s+/g, " ").trim();
    if (!text) return;
    let rank = i + 1;
    const r = text.match(/^#?\s*(\d{1,3})\s*[.):\-–]?\s+/); if (r) { rank = +r[1]; text = text.slice(r[0].length); }
    const canadian = /\s(\*|\(cc\)|cc)$/i.test(text) || /\bcancon\b|canadian content/i.test(it.summary || "");
    text = text.replace(/\s(\*|\(cc\)|cc)$/i, "").trim();
    let label = null;
    const lb = text.match(/\s*[([]([^()[\]]{2,60})[)\]]\s*$/); if (lb) { label = lb[1].trim(); text = text.slice(0, lb.index).trim(); }
    let artist = text, album = null;
    const sep = text.match(/\s[-–—]\s|\s?:\s|\s\/\s/);
    if (sep) { artist = text.slice(0, sep.index).trim(); album = text.slice(sep.index + sep[0].length).trim(); }
    else if (it.summary && it.summary.length < 200) {
      let s = it.summary.trim(); const l2 = s.match(/\s*[([]([^()[\]]{2,60})[)\]]\s*$/); if (l2) { label ||= l2[1].trim(); s = s.slice(0, l2.index).trim(); }
      album = s.replace(/^album:\s*/i, "") || null;
    }
    if (!artist || !isArtist(artist)) return;
    const uid = "earshot:" + norm(artist) + "|" + norm(album || "");
    if (seen.has(uid)) return; seen.add(uid);
    out.push({ uid, artist: cleanName(artist) || artist, title: album, type: "album", url: it.link || "https://www.earshot-online.com/charts/",
      image: it.image || null, genres: [], rank, metric: Math.max(1, 51 - rank), feed: "National Top 50" + (canadian ? " · Canadian" : ""), date: it.date || null, label });
  });
  return out.sort((a, b) => a.rank - b.rank);
}

// ---------- KEXP: plays → one signal per release ----------
const ROTATION = { Heavy: 1, Medium: 2, Light: 3, "R/N": 4 };
export function kexpSignals(plays, t = now()) {
  const by = new Map();
  for (const p of plays) {
    if (!p || p.play_type !== "trackplay" || !p.artist) continue;
    const live = /live on kexp/i.test(p.album || "");
    const rel = p.release_date ? (t - Date.parse(p.release_date) / 1000) / DAY : null;
    // new music only: in rotation, a live session, or released in the last year (not the library's old favourites)
    if (!live && !ROTATION[p.rotation_status] && !(rel != null && rel >= -60 && rel < 365)) continue;
    const key = live ? "live|" + norm(p.artist) : p.release_group_id || p.release_id || norm(p.artist) + "|" + norm(p.album || p.song || "");
    const r = by.get(key) || { uid: "kexp:" + key, artist: p.artist, title: live ? "Live on KEXP session" : p.album || p.song, type: live ? "session" : "album",
      url: p.release_group_id ? `https://musicbrainz.org/release-group/${p.release_group_id}` : "https://www.kexp.org/playlist/",
      image: p.thumbnail_uri || p.image_uri || null, genres: [], date: p.release_date || null, plays: 0, rot: 9, labels: p.labels || [] };
    r.plays++; r.rot = Math.min(r.rot, ROTATION[p.rotation_status] || 9); r.image ||= p.thumbnail_uri || p.image_uri || null;
    by.set(key, r);
  }
  const name = (r) => (r.type === "session" ? "Live sessions" : r.rot === 9 ? "New releases" : r.rot === 4 ? "Recently added" : Object.keys(ROTATION)[r.rot - 1] + " rotation");
  return [...by.values()].sort((a, b) => a.rot - b.rot || b.plays - a.plays)
    .map(({ plays, rot, labels, ...r }) => ({ ...r, metric: plays, rank: rot < 9 ? rot : null, feed: name({ ...r, rot }) }));
}

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
// a post's tags: the writer's own words for the artist and the genre. These say nothing about either:
const PLAIN_TAGS = /^(?:news|music|new music|music news|featured|uncategori[sz]ed|tracks?|albums?|albums? & eps|eps?|singles?|reviews?|album reviews?|track reviews?|videos?|music videos?|interviews?|features?|premieres?|live|live reviews?|tours?|tour dates|concerts?|festivals?|best new music|song of the day|playlists?|lists|spotlight|artist spotlight|stream|listen|watch|mp3|free download|downloads?|news & tours|irish music|international|local|nyc|[0-9]{4}s?)$/i;
const tagsOf = (it) => (it.categories || []).map((c) => c.trim()).filter((c) => c && !PLAIN_TAGS.test(c));
// the tag that is the artist: one the headline names (case aside), longest first
function tagArtist(it) {
  const t = String(it.title).toLowerCase();
  return tagsOf(it).filter((c) => c.length > 1 && t.includes(c.toLowerCase())).sort((a, b) => b.length - a.length)[0] || null;
}
// "announces new album" posts (user, 2026-11-17: release news for artists you follow), with the date when it's given
const ANNOUNCE = /\b(?:announces?|unveils?|details|reveals?|confirms?|shares? details of)\b[^.]*\b(?:album|lp|ep|record|debut)\b|\b(?:new|debut|next) (?:album|lp|ep)\b[^.]*\b(?:out|due|arrives?|coming)\b/i;
const MONTHS = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
export function releaseDate(text, posted) {
  const m = String(text).match(new RegExp(`\\b(?:out|due|arrives?|arriving|released?|drops?|available|lands?)\\b(?: (?:on|via [^,.]{1,40}(?: on)?))?\\s+(?:(?:mon|tues|wednes|thurs|fri|satur|sun)day,?\\s+)?(${MONTHS})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?`, "i"));
  if (!m) return null;
  const mon = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m[1].slice(0, 3).toLowerCase()), day = +m[2];
  if (mon < 0 || day < 1 || day > 31) return null;
  const p = new Date(Date.parse(posted) || Date.now());
  let y = m[3] ? +m[3] : p.getUTCFullYear();
  // no year: the next time that date comes round after the post
  if (!m[3] && Date.UTC(y, mon, day) < Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), p.getUTCDate()) - 7 * 86400e3) y++;
  return `${y}-${String(mon + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
async function headlines(items) {
  const out = [], add = (it, f) => {
    const artist = (tagsOf(it).find((c) => c.toLowerCase() === String(f.artist).toLowerCase())) || f.artist;   // the tag's spelling
    const genres = [...(f.genres || []), ...tagsOf(it).filter((c) => c.toLowerCase() !== artist.toLowerCase() && !String(it.title).toLowerCase().includes(c.toLowerCase()) && c.split(" ").length <= 3).map((c) => c.toLowerCase())];
    const announce = ANNOUNCE.test(it.title), release = announce ? releaseDate(`${it.title}. ${it.summary || ""}`, it.date) : null;
    out.push({ uid: it.link || `${it.feed}|${it.title}`, artist, title: f.title || it.title, type: f.type || "article",
      url: it.link || null, image: it.image || null, date: it.date || null, feed: it.feed, headline: it.title, genres: [...new Set(genres)].slice(0, 3),
      ...(it.listen?.length ? { listen: it.listen } : {}), ...(it.soundsLike?.length ? { soundsLike: it.soundsLike } : {}), ...(announce ? { announce: true, release } : {}) });
  };
  // the rules, helped by the post's tags when the headline alone doesn't say who it's about
  const byRules = (it) => { const f = fromHeadline(it.title); if (f) return f; const a = tagArtist(it); return a ? { artist: a, title: it.title, type: ANNOUNCE.test(it.title) ? "album" : "article" } : null; };
  if (hasAI() && items.length) {
    // Claude reads the headlines in batches: better than the rules for things like "Pitchfork's 30 best albums of…"
    for (let i = 0; i < items.length; i += 40) {
      const batch = items.slice(i, i + 40);
      try {
        const res = parseJson(await claude("For each music headline, give the main artist it's about and the song/album title if any. "
          + 'Skip lists, roundups and non-music headlines. Reply with JSON only: [{"i":0,"artist":"…","title":"…","type":"album|ep|track|article","genres":["…"]}].\n\n'
          + batch.map((it, k) => `${k}. [${it.feed}] ${it.title}${tagsOf(it).length ? " (tags: " + tagsOf(it).slice(0, 6).join(", ") + ")" : ""}${it.summary ? " — " + it.summary.slice(0, 140) : ""}`).join("\n"), 2500));
        for (const r of arr(res)) { const it = batch[r.i]; if (it && r.artist) add(it, r); }
        continue;
      } catch (e) { console.log(`  ! AI headline reading failed (using rules): ${e.message}`); }
      for (const it of batch) { const f = byRules(it); if (f) add(it, f); }
    }
    return out;
  }
  for (const it of items) { const f = byRules(it); if (f) add(it, f); }
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
