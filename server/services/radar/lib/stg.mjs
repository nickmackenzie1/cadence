// Said the Gramophone's yearly "Best songs of …" lists (2005 onward): Sean's 100 favourite songs and favourite albums
// of each year, read once from the blog's archive pages (one page every few seconds), kept in radar_kv, and turned into
// "most-loved artists across the years". The current year's list is looked for again each December and January.
import { httpText } from "./http.mjs";
import { getKv, setKv } from "./store.mjs";
import { norm, isArtist, cleanName } from "./extract.mjs";

const BASE = (process.env.STG_BASE || "https://www.saidthegramophone.com").replace(/\/$/, "");
const FIRST = 2005;
const KEY = "stgBest";
// the first three years have their own page names; from 2008 it's best_songs_of_YYYY.php
export const pageFor = (y) => `${BASE}/archives/${y === 2005 ? "2005s_best_music" : y === 2006 || y === 2007 ? `${y}s_best_music_songs` : `best_songs_of_${y}`}.php`;

const ENT = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", eacute: "é", egrave: "è", aacute: "á", oacute: "ó", iacute: "í", uacute: "ú", ntilde: "ñ", ouml: "ö", uuml: "ü", auml: "ä", ccedil: "ç" };
const dec = (s) => String(s).replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
const text = (h) => dec(String(h).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
// Artist - "Song" (straight or curly quotes); "ft." guests stay with the artist name, the lead artist is used for counting
const SONG = /^(.{1,120}?)\s*[-–—]\s*["“”](.{1,200}?)["“”]/;
export const leadArtist = (a) => String(a).split(/\s+(?:ft\.?|feat\.?|featuring|with|x|&|and)\s+/i)[0].trim();

// one year's page → { songs: [{rank, artist, title}], albums: [{artist, title}] }
export function parseYear(html) {
  html = String(html);
  const songs = [];
  // the list is the first <ol> that holds songs; each <li> starts with a link "Artist - "Song""
  for (const ol of html.match(/<ol[\s>][\s\S]*?<\/ol>/gi) || []) {
    const items = ol.split(/<li\b[^>]*>/i).slice(1);
    const got = [];
    items.forEach((li) => {
      // the song is usually the link text; fall back to the start of the item's text
      const links = [...li.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => text(m[1])).filter(Boolean);
      const cand = [...links, text(li)];
      for (const c of cand) { const m = c.match(SONG); if (m) { got.push({ rank: got.length + 1, artist: m[1].trim(), title: m[2].trim() }); return; } }
      got.push(null);   // keep numbering honest even when one item doesn't read
    });
    const ok = got.filter(Boolean);
    if (ok.length >= 10) { got.forEach((s, i) => s && songs.push({ ...s, rank: i + 1 })); break; }
  }
  // "My favourite albums of 2023 were:" followed by a list (or, older years, lines) of Artist - Album
  const albums = [];
  const at = html.search(/favou?rite\s+(?:albums|records|lps)\b/i);
  if (at >= 0) {
    const rest = html.slice(at, at + 8000);
    const ul = rest.match(/<ul[\s>][\s\S]*?<\/ul>/i);
    const lines = ul ? ul[0].split(/<li\b[^>]*>/i).slice(1) : rest.split(/<br\s*\/?>|<\/p>/i).slice(1, 16);
    for (const l of lines) {
      const i = l.match(/<i>([\s\S]*?)<\/i>/i), t = text(l);
      const m = t.match(/^(.{1,120}?)\s+[-–—]\s+(.+)$/); if (!m) { if (albums.length) break; continue; }
      const title = i ? text(i[1]) : m[2].replace(/\s*\(.*$/, "").replace(/[;,.]\s*(and)?$/, "").trim();
      if (title) albums.push({ artist: m[1].trim(), title });
      if (albums.length >= 20) break;
    }
  }
  return { songs, albums };
}

let running = null;
export function stgStatus() {
  const d = getKv(KEY, { years: {}, errors: {} });
  const ys = Object.keys(d.years).map(Number).sort();
  return { years: ys, songs: ys.reduce((n, y) => n + d.years[y].songs.length, 0), albums: ys.reduce((n, y) => n + d.years[y].albums.length, 0),
    errors: d.errors || {}, running: !!running, last: d.at || null };
}
// fetch the years we don't have yet (and this year's / last year's around the turn of the year). Slow on purpose.
export function stgImport({ gapMs = Number(process.env.STG_GAP_MS || 4000), force = false } = {}) {
  if (running) return running;
  running = (async () => {
    const d = getKv(KEY, { years: {}, errors: {} });
    const now = new Date(), y0 = now.getFullYear();
    const recheck = new Set(now.getMonth() >= 11 ? [y0] : now.getMonth() <= 1 ? [y0 - 1] : []);
    const last = now.getMonth() >= 11 ? y0 : y0 - 1;
    for (let y = FIRST; y <= last; y++) {
      if (!force && d.years[y]?.songs.length && !recheck.has(y)) continue;
      try {
        const p = parseYear(await httpText(pageFor(y)));
        if (p.songs.length) { d.years[y] = { ...p, url: pageFor(y), at: Date.now() }; delete d.errors[y]; }
        else d.errors[y] = "couldn't read the list on this page";
      } catch (e) { d.errors[y] = /404/.test(e.message) ? "no list for this year yet" : e.message.slice(0, 120); }
      d.at = Date.now(); setKv(KEY, d);
      await new Promise((r) => setTimeout(r, gapMs).unref?.());
    }
    return stgStatus();
  })().finally(() => { running = null; });
  return running;
}

// everything for the page: each year, plus the artists that come back year after year
export function stgData(year = null) {
  const d = getKv(KEY, { years: {}, errors: {} });
  const ys = Object.keys(d.years).map(Number).sort((a, b) => b - a);
  const by = new Map();
  for (const y of ys) {
    for (const s of d.years[y].songs) { const a = leadArtist(s.artist); if (!isArtist(a)) continue; const k = norm(a);
      const r = by.get(k) || { artist: cleanName(a) || a, years: new Set(), songs: [], albums: [], best: 101, score: 0 };
      r.years.add(y); r.songs.push({ year: y, rank: s.rank, title: s.title }); r.best = Math.min(r.best, s.rank); r.score += 1 + (101 - s.rank) / 100; by.set(k, r); }
    for (const al of d.years[y].albums) { const k = norm(leadArtist(al.artist));
      const r = by.get(k) || { artist: cleanName(al.artist) || al.artist, years: new Set(), songs: [], albums: [], best: 101, score: 0 };
      r.years.add(y); r.albums.push({ year: y, title: al.title }); r.score += 2; by.set(k, r); }
  }
  const artists = [...by.values()].map((r) => ({ ...r, years: [...r.years].sort(), n: r.years.size, best: r.best > 100 ? null : r.best }))
    .sort((a, b) => b.n - a.n || b.score - a.score).slice(0, 60);
  const y = year && d.years[year] ? +year : ys[0] || null;
  return { status: stgStatus(), years: ys, year: y, list: y ? d.years[y] : null, artists };
}

// one artist's entries, for the artist page
export function stgFor(name) {
  const d = getKv(KEY, { years: {} }), k = norm(name), out = [];
  for (const [y, v] of Object.entries(d.years)) {
    for (const s of v.songs) if (norm(leadArtist(s.artist)) === k || norm(s.artist) === k) out.push({ year: +y, kind: "song", rank: s.rank, title: s.title, url: v.url });
    for (const a of v.albums) if (norm(leadArtist(a.artist)) === k) out.push({ year: +y, kind: "album", title: a.title, url: v.url });
  }
  return out.sort((a, b) => b.year - a.year || (a.rank || 0) - (b.rank || 0));
}
