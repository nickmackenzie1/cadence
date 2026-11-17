// TheAudioDB (user, 2026-11-16: "get the band's logo and other stuff, compare that"): a community music database
// with what MusicBrainz doesn't have: the band's logo, photos, wide banner art and a short biography, plus its own
// formed year, country, genre, style, mood and links, which the artist page sets next to MusicBrainz's.
// Free test key "123" (30 requests a minute), no sign-up; AUDIODB_KEY on the NAS uses a personal key instead.
// Looked up in the background, one request every 2.1 s, found by MusicBrainz ID when known (so a common name doesn't
// pick the wrong band), else by name. Kept in radar_kv: found for 30 days, not found retried after 7.
// AUDIODB=0 turns it off; off under CI unless AUDIODB=1 (tests point AUDIODB_API at a fake).
import { getKv, setKv } from "./store.mjs";
import { httpJson } from "./http.mjs";
import { norm } from "./extract.mjs";

const API = () => (process.env.AUDIODB_API || "https://www.theaudiodb.com/api/v1/json").replace(/\/$/, "") + "/" + encodeURIComponent(process.env.AUDIODB_KEY || "123");
const ON = () => process.env.AUDIODB === "1" || (process.env.AUDIODB !== "0" && !process.env.CI);
const GAP = +process.env.AUDIODB_GAP || 2100, KEEP = 30 * 86400e3, RETRY = 7 * 86400e3, MAXQ = 300;
const K = (name) => "adb:" + norm(name);
const queue = new Map(); let running = false;

// what we know (or null) and whether a lookup is on its way; queues one if it's missing or old
export function audiodbFor(name, mbid = null) {
  if (!name || !ON()) return { info: null, pending: false };
  const k = K(name); let c = null; try { c = getKv(k); } catch { return { info: null, pending: false }; }
  const stale = !c || Date.now() - (c.at || 0) > (c.none ? RETRY : KEEP) || (mbid && c.none && !c.triedMbid);
  if (stale && !queue.has(k) && queue.size < MAXQ) { queue.set(k, { name, mbid }); if (!running) pump(); }
  return { info: c && !c.none ? c : null, pending: stale && queue.has(k) };
}
async function pump() {
  running = true;
  while (queue.size) {
    const [k, v] = queue.entries().next().value; queue.delete(k);
    try { setKv(k, (await lookup(v.name, v.mbid)) || { none: true, triedMbid: !!v.mbid, at: Date.now() }); }
    catch { /* offline or rate-limited: asked again next time the page is opened */ }
    await new Promise((r) => setTimeout(r, GAP).unref?.());
  }
  running = false;
}
const https = (u) => (u ? String(u).replace(/^http:/, "https:") : null);
const site = (u) => (u ? (/^https?:\/\//i.test(u) ? u : "https://" + String(u).replace(/^\/+/, "")) : null);
export async function lookup(name, mbid) {
  let a = null;
  if (mbid) { const j = await httpJson(`${API()}/artist-mb.php?i=${encodeURIComponent(mbid)}`); a = (j.artists || [])[0] || null; }
  if (!a) {
    const j = await httpJson(`${API()}/search.php?s=${encodeURIComponent(name)}`), want = norm(name);
    a = (j.artists || []).find((x) => norm(x.strArtist || "") === want) || null;
  }
  if (!a) return null;
  const n = (x) => (x && +x ? +x : null), t = (x) => (x && String(x).trim()) || null;
  const links = [];
  for (const [kind, u] of [["website", a.strWebsite], ["facebook", a.strFacebook], ["twitter", a.strTwitter], ["lastfm", a.strLastFMChart]]) if (t(u)) links.push({ kind, url: site(t(u)) });
  return {
    id: a.idArtist, name: a.strArtist, mbid: a.strMusicBrainzID || null,
    logo: https(a.strArtistLogo), photo: https(a.strArtistThumb), banner: https(a.strArtistBanner), fanart: https(a.strArtistFanart || a.strArtistFanart2), cutout: https(a.strArtistCutout),
    bio: t(a.strBiographyEN) ? String(a.strBiographyEN).trim().slice(0, 4000) : null,
    formed: n(a.intFormedYear), born: n(a.intBornYear), died: n(a.intDiedYear), disbanded: t(a.strDisbanded),
    country: t(a.strCountry), genre: t(a.strGenre), style: t(a.strStyle), mood: t(a.strMood), label: t(a.strLabel), members: n(a.intMembers), gender: t(a.strGender),
    links, page: `https://www.theaudiodb.com/artist/${a.idArtist}`, at: Date.now(),
  };
}
export const _queue = () => queue.size;
