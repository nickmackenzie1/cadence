import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Cadence: everything lives in the NAS data folder (data/radar), next to the rest of Cadence's data
export const DATA = process.env.RADAR_DATA || path.join(process.env.DATA_DIR || "/data", "radar");
fs.mkdirSync(path.join(DATA, "digests"), { recursive: true });

// Starting subreddit list. Once you add/remove subs from the dashboard,
// your edited list is saved in data/state.json and used instead.
export const DEFAULT_SUBS = [
  "listentothis", "indieheads", "newmusic", "ifyoulikeblank", "Music",
  "hiphopheads", "popheads", "electronicmusic", "indie_rock", "shoegaze",
  "postpunk", "LetsTalkMusic", "Emo", "treemusic", "futurebeats",
];
export const LISTINGS = ["hot", "rising", "new"];
export const POSTS_PER_LISTING = 50;
export const COMMENT_POSTS = 60;          // fetch comments for the N hottest new posts per run
export const WINDOW_HOURS = 72;           // only score posts this recent
export const USER_AGENT = "music-radar/2.0 (personal RSS feed script)";
// Cadence: the address of your Cadence (for links in the RSS feed and phone alerts). Empty = links relative to Cadence.
export const PUBLIC_URL = (process.env.RADAR_URL || process.env.CADENCE_URL || "").replace(/\/$/, "");
export const API = `${PUBLIC_URL}/api/radar`;
export const AI_MODEL = process.env.RADAR_MODEL || "claude-haiku-5-5";
export const ALERT_MIN_SCORE = Number(process.env.RADAR_ALERT_MIN || 60);

// Only used when there's no LASTFM_API_KEY (with Last.fm, size is checked automatically)
export const TOO_BIG = new Set([
  "taylor swift", "drake", "kendrick lamar", "beyonce", "the weeknd",
  "radiohead", "the beatles", "kanye west", "billie eilish", "sabrina carpenter",
  "bad bunny", "ariana grande", "travis scott", "olivia rodrigo", "chappell roan",
]);

// RADAR_NOW lets the simulator pretend it's a different time
export const now = () => Number(process.env.RADAR_NOW) || Date.now() / 1000;
export const sleep = (ms) => (process.env.RADAR_NOW ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));
export const DAY = 86400;
