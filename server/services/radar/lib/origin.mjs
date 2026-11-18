// Where an artist is from, from Wikidata (2026-11-17), for Close to home: the place a band formed (P740) or a person was
// born (P19), with its coordinates and country, looked up by MusicBrainz id (P434) in batches. Kept 90 days ("none" 30).
// MusicBrainz's area alone can't tell Kingston, Ontario from Kingston, Jamaica; distance from home can.
import { getKv, setKv } from "./store.mjs";
import { httpJson } from "./http.mjs";
import { norm } from "./extract.mjs";
import { DEFAULT_SHOWS } from "./shows.mjs";

const KEEP = 90 * 86400e3, NONE = 30 * 86400e3;
const ON = () => process.env.RADAR_WIKIDATA !== "0" && (!process.env.CI || process.env.RADAR_WIKIDATA === "1");
export const kmBetween = (a, b) => {
  const r = (d) => (d * Math.PI) / 180, dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};
const home = () => ({ lat: +process.env.HOME_LAT || DEFAULT_SHOWS.lat, lon: +process.env.HOME_LON || DEFAULT_SHOWS.lon });
// the kept answer for an artist (by name or key), or null if not looked up yet
export function originOf(nameOrKey) {
  const c = getKv("wdo:" + norm(nameOrKey));
  return c && !c.none ? c : null;
}
export function sparqlFor(mbids) {
  return `SELECT ?mbid ?placeLabel ?coord ?country WHERE {
  VALUES ?mbid { ${mbids.map((m) => `"${String(m).replace(/[^0-9a-f-]/gi, "")}"`).join(" ")} }
  ?a wdt:P434 ?mbid .
  OPTIONAL { ?a wdt:P740 ?formed } OPTIONAL { ?a wdt:P19 ?born }
  BIND(COALESCE(?formed, ?born) AS ?place)
  ?place wdt:P625 ?coord .
  OPTIONAL { ?place wdt:P17 ?country }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
}
// parse SPARQL JSON results into mbid -> { place, lat, lon, canada }
export function parseResults(j) {
  const out = new Map();
  for (const b of j?.results?.bindings || []) {
    const mbid = b.mbid?.value, m = String(b.coord?.value || "").match(/Point\(([-\d.]+) ([-\d.]+)\)/);
    if (!mbid || !m || out.has(mbid)) continue;
    out.set(mbid, { place: b.placeLabel?.value || null, lon: +m[1], lat: +m[2], canada: /\/Q16$/.test(b.country?.value || "") });
  }
  return out;
}
// look up artists [{ name, mbid }] that have no kept answer; up to `max` per call, 40 per query
export async function originWarm(artists, { max = 120 } = {}) {
  if (!ON()) return 0;
  const todo = artists.filter((a) => a.mbid && (() => { const c = getKv("wdo:" + norm(a.name)); return !c || Date.now() - c.at > (c.none ? NONE : KEEP); })()).slice(0, max);
  const H = home();
  for (let i = 0; i < todo.length; i += 40) {
    const batch = todo.slice(i, i + 40);
    const j = await httpJson(`${process.env.WIKIDATA_SPARQL || "https://query.wikidata.org/sparql"}?format=json&query=${encodeURIComponent(sparqlFor(batch.map((a) => a.mbid)))}`, { headers: { Accept: "application/sparql-results+json" } });
    const got = parseResults(j);
    for (const a of batch) {
      const o = got.get(a.mbid);
      setKv("wdo:" + norm(a.name), o ? { ...o, km: Math.round(kmBetween(H, o)), at: Date.now() } : { none: true, at: Date.now() });
    }
    if (i + 40 < todo.length) await new Promise((r) => setTimeout(r, 2000).unref?.());
  }
  return todo.length;
}
