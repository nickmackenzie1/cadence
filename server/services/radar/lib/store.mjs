import fs from "node:fs";
import path from "node:path";
import { DATA, now, DAY } from "./config.mjs";

const STATE = path.join(DATA, "state.json");
const blank = () => ({
  subs: null,            // your subreddit list (null = defaults)
  artists: {},           // key -> { name, firstSeen:{sub:ts}, genres:{g:n}, lastfm, listenersHistory }
  picks: [],             // everything ever put in your feed
  feedback: {},          // pickId -> 1 | -1
  edges: {},             // "a|||b" -> { a, b, n, ts }  ("sounds like" map)
  subMentions: {},       // r/xyz mentioned in comments -> count
  subSuggestions: [],
  alerts: {},            // key -> last alert ts
  seenPosts: {},         // postId -> ts (so trends count each post once)
  extractCache: {},      // postId -> extraction result
  digests: [],
});

export function loadState() {
  try { return { ...blank(), ...JSON.parse(fs.readFileSync(STATE, "utf8")) }; } catch { return blank(); }
}

export function saveState(s) {
  const t = now();
  for (const [id, ts] of Object.entries(s.seenPosts)) if (t - ts > 10 * DAY) delete s.seenPosts[id];
  for (const [id, e] of Object.entries(s.extractCache)) if (t - e.ts > 5 * DAY) delete s.extractCache[id];
  fs.writeFileSync(STATE + ".tmp", JSON.stringify(s));
  fs.renameSync(STATE + ".tmp", STATE);
}

export function appendJsonl(name, rows) {
  if (!rows.length) return;
  fs.appendFileSync(path.join(DATA, name + ".jsonl"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
}

export function readJsonl(name, sinceTs = 0) {
  try {
    return fs.readFileSync(path.join(DATA, name + ".jsonl"), "utf8").split("\n")
      .filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.ts >= sinceTs);
  } catch { return []; }
}
