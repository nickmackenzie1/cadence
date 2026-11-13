// Fake-data test: 14 days of radar runs (4/day) + a weekly digest + 10 years of archive data.
// Uses its own data folder so it never touches your real data:
//   RADAR_DATA=/tmp/radar-sim node test/simulate.mjs && RADAR_DATA=/tmp/radar-sim node server.mjs
import fs from "node:fs";
import path from "node:path";
if (!process.env.RADAR_DATA) { console.error("Set RADAR_DATA to a scratch folder first."); process.exit(1); }
fs.rmSync(process.env.RADAR_DATA, { recursive: true, force: true });
const DAY = 86400, END = Math.floor(Date.now() / 1000);
const START = END - 14 * DAY;
process.env.RADAR_NOW = String(START);
const { run } = await import("../radar.mjs");
const { digest } = await import("../digest.mjs");
const { loadState, saveState } = await import("../lib/store.mjs");
const { saveHistory } = await import("../lib/history.mjs");

let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rnd() * a.length)];
// shape(d): buzz level on day d (0..13)
const ARTISTS = [
  { name: "Glass Lantern", genre: "shoegaze", like: ["Slowdive", "Hum"], subs: ["shoegaze", "listentothis", "indieheads", "Music"], shape: (d) => Math.max(0, d - 4) * 0.6 },
  { name: "Mira Vale", genre: "dream pop", like: ["Beach House", "Alvvays"], subs: ["listentothis", "indieheads", "newmusic"], shape: (d) => (d > 6 ? 5 : 1) },
  { name: "Ketamine Kids", genre: "sigilkore", like: ["Bladee", "Ecco2k"], subs: ["futurebeats", "hiphopheads", "Music"], shape: (d) => d * 0.5 },
  { name: "Porch Static", genre: "midwest emo", like: ["American Football", "Glass Lantern"], subs: ["Emo", "indieheads", "listentothis"], shape: (d) => 2 + d * 0.3 },
  { name: "Neon Tidal", genre: "uk garage", like: ["Burial", "Sammy Virji"], subs: ["futurebeats", "electronicmusic"], shape: (d) => 6 * Math.exp(-((d - 4) ** 2) / 6) },
  { name: "The Sundays Club", genre: "indie pop", like: ["Alvvays"], subs: ["popheads", "indieheads"], shape: (d) => (d < 6 ? 4 : 0.5) },
  { name: "Holloway Drive", genre: "post punk", like: ["Fontaines D.C.", "Shame"], subs: ["postpunk", "indieheads", "listentothis"], shape: (d) => 1.5 },
  { name: "Drake", genre: "hip hop", like: [], subs: ["hiphopheads", "Music"], shape: () => 6 },
];
const SONGS = ["Blue Moth", "Halflight", "Paper Coast", "Undertow", "Static Bloom", "Night Swim", "Cinder", "Low Tide", "Ghost Bus", "Velvet Hour", "Orbit", "Sleepwalk"];
const POS = ["love this", "absolute banger", "this is incredible", "obsessed", "so underrated"];
const NEG = ["kinda boring", "mid honestly", "overrated"];
const SCENES = { shoegaze: "nu gaze revival", sigilkore: "sigilkore", "midwest emo": "midwest emo revival", "uk garage": "speed garage", "dream pop": "bedroom pop" };

let id = 0; const pool = [];
for (let r = 0; r < 14 * 4; r++) {
  const t = START + r * 6 * 3600, d = Math.floor(r / 4);
  for (const a of ARTISTS) {
    const n = Math.round(a.shape(d) * (0.6 + rnd() * 0.8) / 2);
    for (let k = 0; k < n; k++) {
      // the early sub (first in list) usually gets it first
      const sub = a.subs[Math.min(a.subs.length - 1, Math.floor(rnd() * rnd() * a.subs.length + (rnd() < 0.15 ? 1 : 0)))];
      const album = rnd() < 0.15;
      const song = pick(SONGS);
      const comments = [
        `This sounds like ${pick(a.like.length ? a.like : ["nobody"])}, ${a.name === "The Sundays Club" ? pick(NEG) : pick(POS)}`,
        a.like.length > 1 ? `${a.like[0]} meets ${a.like[1]}` : "nice",
        rnd() < 0.5 ? `peak ${SCENES[a.genre] || a.genre} energy` : "more please",
      ];
      pool.push({ id: `p${id++}`, sub, created: t - Math.floor(rnd() * 6 * 3600), base: 20 + a.shape(d) * 60 * rnd(),
        title: album ? `[FRESH ALBUM] ${a.name} - ${song}` : `${a.name} -- ${song} [${a.genre}] (2026)`,
        url: `https://youtu.be/sim${id}`, permalink: `https://reddit.com/r/${sub}/comments/p${id}`, commentTexts: comments });
    }
  }
  const ifyoulike = { id: `p${id++}`, sub: "ifyoulikeblank", created: t - 3600, base: 30, title: "[IIL] Slowdive, Hum [WEWIL]",
    url: "", permalink: "https://reddit.com/r/ifyoulikeblank/x", commentTexts: ["Glass Lantern!!", "check r/nugaze"] };
  pool.push(ifyoulike);
  process.env.RADAR_NOW = String(t);
  const live = pool.filter((p) => p.created <= t && t - p.created < 72 * 3600).map((p) => {
    const ageH = (t - p.created) / 3600;
    return { ...p, score: Math.round(p.base * Math.min(1, ageH / 12) * 10), comments: Math.round(p.base / 3), ratio: 0.93 };
  });
  const { picks } = await run({ demoPosts: live, top: 6, quiet: true });
  // pretend the user rates some picks
  const s = loadState();
  for (const p of picks) {
    if (["glass lantern", "porch static", "mira vale"].includes(p.key)) s.feedback[s.picks.find((x) => x.key === p.key && x.ts === t)?.id] = 1;
    if (p.key === "the sundays club") s.feedback[s.picks.find((x) => x.key === p.key && x.ts === t)?.id] = -1;
  }
  delete s.feedback.undefined;
  saveState(s);
  if (r % 8 === 0) console.log(`day ${d}: ${pool.length} posts so far, ${picks.length} new picks`);
}

// fake subreddit suggestions (real ones come from Reddit search in the digest)
const s = loadState();
s.subSuggestions = [{ sub: "nugaze", because: ["Glass Lantern", "mentioned in 3 comments"], subscribers: 41200, description: "new shoegaze" },
                    { sub: "midwestemo", because: ["Porch Static"], subscribers: 98000, description: "" }];
saveState(s);
await digest({ offline: true });

// 10 years of fake archive data
const hist = { listentothis: {} };
const g = (y, m) => ({
  "indie rock": 30 - (y - 2016) * 1.2, "shoegaze": 3 + Math.max(0, y - 2019) * 2.2, "hyperpop": y === 2020 || y === 2021 ? 9 : y > 2021 ? 3 : 0.5,
  "dream pop": 8 + Math.sin(y) * 2, "hip hop": 15, "post punk": 4 + (y >= 2018 && y <= 2022 ? 6 : 1), "midwest emo": 2 + Math.max(0, y - 2022) * 3, "uk garage": y >= 2023 ? 5 + (y - 2023) * 2 : 1,
});
for (let y = 2016; y <= 2026; y++) for (let m = 1; m <= 12; m++) {
  if (y === 2026 && m > 10) break;
  const genres = Object.fromEntries(Object.entries(g(y, m)).map(([k, v]) => [k, Math.max(0, Math.round(v * (0.85 + rnd() * 0.3)))]));
  const artists = {};
  for (const a of ["Phoebe Bridgers", "Alvvays", "Fontaines D.C.", "Wednesday", "Glass Lantern", "Mira Vale", "Fred again..", "MJ Lenderman"]) {
    const start = { "Phoebe Bridgers": 2017, "Alvvays": 2016, "Fontaines D.C.": 2019, "Wednesday": 2023, "Glass Lantern": 2025, "Mira Vale": 2026, "Fred again..": 2021, "MJ Lenderman": 2024 }[a];
    if (y >= start) artists[a.toLowerCase()] = { name: a, n: Math.round((y === start ? 1 : 3) * (1 + rnd() * 2)), score: 400 };
  }
  hist.listentothis[`${y}-${String(m).padStart(2, "0")}`] = { posts: 300, music: 100, genres, artists,
    albums: y >= 2023 ? { "wednesday::rat saw god": { artist: "Wednesday", album: "Rat Saw God", type: "album", n: y === 2023 ? 4 : 1, score: 900 } } : {} };
}
saveHistory(hist);
console.log("Simulation done. Data in", process.env.RADAR_DATA);
