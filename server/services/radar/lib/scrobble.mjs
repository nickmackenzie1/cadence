// Sending your listens to ListenBrainz (2026-11-17). Off until LISTENBRAINZ_TOKEN is set in .env (your token is on
// listenbrainz.org → Settings). Only real listens: songs you heard on a station for two minutes or more, with a title.
// Previews (30 seconds) and podcasts aren't sent. Ones that couldn't be sent wait in a short queue and go with the next.
import { getKv, setKv } from "./store.mjs";
import { httpJson } from "./http.mjs";

const QKEY = "lbScrobbleQueue", MIN_SECS = 120;
// Koito (2026-11-19): a self-hosted scrobbler on your own network that speaks the ListenBrainz API. KOITO_URL is its
// address (http://nas:4110), KOITO_TOKEN an API key made in Koito. Listens go to ListenBrainz, Koito, or both;
// each has its own queue, so one being down doesn't hold the other up.
export const koitoBase = () => String(process.env.KOITO_URL || "").trim().replace(/\/+$/, "").replace(/\/apis\/listenbrainz(\/1)?$/, "");
export const koitoOn = () => !!(koitoBase() && process.env.KOITO_TOKEN);
export const lbOn = () => !!process.env.LISTENBRAINZ_TOKEN;
export const scrobbleOn = () => lbOn() || koitoOn();
export function targets() {
  const t = [];
  if (lbOn()) t.push({ id: "lb", q: QKEY, last: "lbScrobbleLast", url: `${process.env.LISTENBRAINZ_API || "https://api.listenbrainz.org"}/1/submit-listens`, token: process.env.LISTENBRAINZ_TOKEN });
  if (koitoOn()) t.push({ id: "koito", q: "koitoScrobbleQueue", last: "koitoScrobbleLast", url: `${koitoBase()}/apis/listenbrainz/1/submit-listens`, token: process.env.KOITO_TOKEN });
  return t;
}
export const worthSending = (l) => (l.kind === "live" || l.kind === "kexp") && !!l.title && l.secs >= MIN_SECS && !l.skipped;
export function listenPayload(l) {
  return {
    listened_at: Math.max(0, Math.floor(l.ts - l.secs)),
    track_metadata: { artist_name: l.artist, track_name: l.title,
      additional_info: { media_player: "THING", submission_client: "THING", ...(l.station ? { music_service_name: l.station } : {}) } },
  };
}
// queue one listen and send everything waiting (up to 100 at a time) to each place that's set up
export async function scrobble(l) {
  const ts = targets();
  if (!ts.length) return { sent: 0, off: true };
  const one = l && worthSending(l) ? [listenPayload(l)] : [];
  const out = {};
  for (const t of ts) out[t.id] = await sendTo(t, one);
  const lb = out.lb || out.koito;   // the old single answer: ListenBrainz when it's on
  return { ...lb, ...(out.lb && out.koito ? { koito: out.koito } : {}) };
}
async function sendTo(t, one) {
  const q = (getKv(t.q) || []).concat(one).slice(-500);
  if (!q.length) return { sent: 0 };
  const batch = q.slice(0, 100);
  try {
    await httpJson(t.url, {
      method: "POST", headers: { Authorization: `Token ${t.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ listen_type: batch.length === 1 ? "single" : "import", payload: batch }),
    });
    setKv(t.q, q.slice(batch.length)); setKv(t.last, { at: Date.now(), n: batch.length });
    return { sent: batch.length };
  } catch (e) { setKv(t.q, q); setKv(t.last, { at: Date.now(), error: String(e.message || e).slice(0, 200) }); return { sent: 0, error: e.message }; }
}
