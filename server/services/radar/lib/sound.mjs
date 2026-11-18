// The sound of songs (2026-11-17): tempo, key, danceability and loudness that the browser read from 30-second previews
// with Essentia.js. Kept per song ("snd:artist|title") and summed per artist ("snda:artist") for the artist page and the
// Friday mix's running order. Numbers only; nothing about the audio itself is kept.
import { getKv, setKv } from "./store.mjs";
import { norm } from "./extract.mjs";

const KEYS = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"];
const num = (v, lo, hi) => { const n = +v; return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
export function keepSound(b) {
  const artist = String(b.artist || "").trim().slice(0, 120), title = String(b.title || "").trim().slice(0, 200);
  const bpm = num(b.bpm, 30, 260), dance = num(b.dance, 0, 10), loud = num(b.loud, -80, 10);
  const key = KEYS.includes(b.key) ? b.key : null, scale = b.scale === "major" || b.scale === "minor" ? b.scale : null;
  if (!artist || !title || bpm == null) return { ok: false };
  const ak = norm(artist), sk = `snd:${ak}|${norm(title)}`;
  const row = { bpm, bpmSure: num(b.bpmSure, 0, 10), key, scale, keySure: num(b.keySure, 0, 1), dance, loud, at: Date.now() };
  const had = getKv(sk); setKv(sk, row);
  // per artist: running sums over their songs (a re-read of the same song replaces it)
  const a = getKv("snda:" + ak) || { n: 0, bpm: 0, dance: 0, loud: 0, keys: {}, name: artist };
  if (had) { a.n--; a.bpm -= had.bpm; a.dance -= had.dance || 0; a.loud -= had.loud || 0; if (had.key) a.keys[had.key + " " + had.scale] = Math.max(0, (a.keys[had.key + " " + had.scale] || 1) - 1); }
  a.n++; a.bpm += bpm; a.dance += dance || 0; a.loud += loud || 0; if (key && scale) a.keys[key + " " + scale] = (a.keys[key + " " + scale] || 0) + 1;
  a.name = artist; setKv("snda:" + ak, a);
  return { ok: true };
}
// an artist's sound in plain words, or null if no song of theirs has been read yet
export function soundOfArtist(name) {
  const a = getKv("snda:" + norm(name)); if (!a || a.n < 1) return null;
  const bpm = Math.round(a.bpm / a.n), dance = a.dance / a.n, loud = a.loud / a.n;
  const topKey = Object.entries(a.keys || {}).sort((x, y) => y[1] - x[1])[0];
  const feel = dance >= 1.4 ? "upbeat" : dance >= 1.0 ? "easy-moving" : "laid-back";
  return { songs: a.n, bpm, key: topKey ? topKey[0] : null, feel, dance: +dance.toFixed(2), loud: +loud.toFixed(1),
    words: `About ${bpm} BPM${topKey ? `, mostly ${topKey[0]}` : ""}, ${feel}` };
}
// a running order with a shape: calm at the start and end, the liveliest in the middle. Items without a reading keep
// their place relative to each other and go after the shaped ones.
export function arc(items, energyOf) {
  const known = [], unknown = [];
  for (const it of items) { const e = energyOf(it); (e == null ? unknown : known).push({ it, e }); }
  if (known.length < 3) return items;
  known.sort((x, y) => x.e - y.e);
  const front = [], back = [];
  known.forEach((k, i) => (i % 2 ? back : front).push(k.it));
  return [...front, ...back.reverse(), ...unknown.map((u) => u.it)];
}
export function energy(name) {
  const s = soundOfArtist(name); if (!s) return null;
  return s.dance + Math.max(0, Math.min(1, (s.bpm - 70) / 100)) * 0.5;
}
