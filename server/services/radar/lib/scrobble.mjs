// Sending your listens to ListenBrainz (2026-11-17). Off until LISTENBRAINZ_TOKEN is set in .env (your token is on
// listenbrainz.org → Settings). Only real listens: songs you heard on a station for two minutes or more, with a title.
// Previews (30 seconds) and podcasts aren't sent. Ones that couldn't be sent wait in a short queue and go with the next.
import { getKv, setKv } from "./store.mjs";
import { httpJson } from "./http.mjs";

const QKEY = "lbScrobbleQueue", MIN_SECS = 120;
export const scrobbleOn = () => !!process.env.LISTENBRAINZ_TOKEN;
export const worthSending = (l) => (l.kind === "live" || l.kind === "kexp") && !!l.title && l.secs >= MIN_SECS && !l.skipped;
export function listenPayload(l) {
  return {
    listened_at: Math.max(0, Math.floor(l.ts - l.secs)),
    track_metadata: { artist_name: l.artist, track_name: l.title,
      additional_info: { media_player: "Cadence", submission_client: "Cadence", ...(l.station ? { music_service_name: l.station } : {}) } },
  };
}
// queue one listen and send everything waiting (up to 100 at a time)
export async function scrobble(l) {
  if (!scrobbleOn()) return { sent: 0, off: true };
  const q = (getKv(QKEY) || []).concat(l && worthSending(l) ? [listenPayload(l)] : []).slice(-500);
  if (!q.length) return { sent: 0 };
  const batch = q.slice(0, 100);
  try {
    await httpJson(`${process.env.LISTENBRAINZ_API || "https://api.listenbrainz.org"}/1/submit-listens`, {
      method: "POST", headers: { Authorization: `Token ${process.env.LISTENBRAINZ_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ listen_type: batch.length === 1 ? "single" : "import", payload: batch }),
    });
    setKv(QKEY, q.slice(batch.length)); setKv("lbScrobbleLast", { at: Date.now(), n: batch.length });
    return { sent: batch.length };
  } catch (e) { setKv(QKEY, q); setKv("lbScrobbleLast", { at: Date.now(), error: String(e.message || e).slice(0, 200) }); return { sent: 0, error: e.message }; }
}
