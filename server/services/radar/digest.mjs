#!/usr/bin/env node
/**
 * Weekly digest: top 10 picks, risers, albums, genres & scenes blowing up,
 * subreddit suggestions, track record. Adds it to the RSS feed, sends a phone
 * alert, and refreshes the Spotify playlist. Run once a week.
 *
 *   node digest.mjs [--offline]     (--offline skips Reddit/Last.fm lookups)
 */
import fs from "node:fs";
import path from "node:path";
import { DATA, DEFAULT_SUBS, PUBLIC_URL, API, now, DAY } from "./lib/config.mjs";
import { loadState, saveState } from "./lib/store.mjs";
import { dashboardData } from "./lib/dashboard-data.mjs";
import { suggestSubs, updateTrackRecord } from "./lib/discover.mjs";
import { hasAI, claude } from "./lib/ai.mjs";
import { notify } from "./lib/notify.mjs";
import { writeRss } from "./lib/rss.mjs";
import { updatePlaylist } from "./lib/spotify.mjs";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pct = (x) => (x == null ? "new" : `${x >= 0 ? "+" : ""}${Math.round(x * 100)}%`);

export async function digest({ offline = false } = {}) {
  const t = now();
  const state = loadState();
  if (!offline) {
    console.log("Checking track record…"); await updateTrackRecord(state);
    console.log("Looking for new subreddits…");
    try { await suggestSubs(state, state.subs || DEFAULT_SUBS); } catch (e) { console.log(`  ! ${e.message}`); }
  }
  const d = dashboardData(state);
  const week = state.picks.filter((p) => t - p.ts < 7 * DAY && state.feedback[p.id] !== -1)
    .sort((a, b) => b.score - a.score).slice(0, 10);
  const risers = d.rise.risers.filter((r) => r.delta > 0).slice(0, 5);
  const genres = d.genres.filter((g) => g.isNew || g.change > 0).slice(0, 5);
  const buzz = d.buzz.filter((g) => g.isNew || g.change > 0).slice(0, 5);

  let intro = `${week.length} picks this week.`;
  if (hasAI()) {
    try {
      intro = (await claude("Write a 2–3 sentence intro for my weekly personal music-radar digest, like a friend texting me. "
        + "Use only this data, no invented facts:\n" + JSON.stringify({ week: week.map((p) => [p.artist, p.song, p.genres]),
          risers: risers.map((r) => r.artist), genres: genres.map((g) => [g.name, pct(g.change)]), scenes: buzz.map((b) => b.name),
          albums: d.albums.slice(0, 3).map((a) => [a.artist, a.album]) }), 400)).trim();
    } catch {}
  }

  const li = (xs, f) => (xs.length ? `<ul>${xs.map((x) => `<li>${f(x)}</li>`).join("")}</ul>` : "<p><i>Not enough data yet.</i></p>");
  const html = `<p>${esc(intro)}</p>
<h3>Top 10 this week</h3>${li(week, (p) => `<a href="${esc(p.link)}">${esc(p.artist)} — ${esc(p.song || "recommended in comments")}</a> <small>${esc((p.genres || []).join(", "))}</small><br><small>${esc(p.blurb)}</small>`)}
<h3>Fastest risers</h3>${li(risers, (r) => `${esc(r.artist)} <small>(${r.weekAgo ? `${Math.round(r.weekAgo)} → ` : "new → "}${Math.round(r.cur)})</small>`)}
<h3>Albums &amp; EPs blowing up</h3>${li(d.albums.slice(0, 5), (a) => `<a href="${esc(a.link)}">${esc(a.artist)} — ${esc(a.album)}</a> <small>${esc(a.type)}</small>`)}
<h3>Genres blowing up</h3>${li(genres, (g) => `${esc(g.name)} <small>${pct(g.change)} (${g.thisWeek} posts)</small>`)}
<h3>New scenes &amp; buzzwords</h3>${li(buzz, (g) => `${esc(g.name)} <small>${pct(g.change)}</small>`)}
<h3>Subreddits you might add</h3>${li(d.suggestions.slice(0, 5), (s) => `<a href="https://reddit.com/r/${esc(s.sub)}">r/${esc(s.sub)}</a> <small>${s.subscribers.toLocaleString()} members · ${esc(s.because.slice(0, 3).join(", "))}</small>`)}
${d.trackRecord.checked ? `<h3>Track record</h3><p>${d.trackRecord.hits} of ${d.trackRecord.checked} picks from a month+ ago grew 25%+ on Last.fm.</p>` : ""}
<p><a href="${esc(PUBLIC_URL + "/#view-radar")}">Open Music Radar in Cadence</a></p>`;

  const date = new Date(t * 1000).toISOString().slice(0, 10);
  const file = `${date}.html`;
  fs.writeFileSync(path.join(DATA, "digests", file),
    `<!doctype html><meta charset="utf-8"><title>Music Radar — week of ${date}</title>`
    + `<body style="font-family:system-ui,sans-serif;max-width:680px;margin:2rem auto;padding:0 1rem;line-height:1.5">`
    + `<h1>Music Radar — week of ${date}</h1>${html}</body>`);
  state.digests = state.digests.filter((x) => x.id !== date);
  state.digests.push({ id: date, ts: t, title: `📬 Weekly digest — ${date}`, file, html });

  if (!offline) {
    try { const r = await updatePlaylist(state); if (r) console.log(`Spotify playlist: ${r.count} tracks`); } catch (e) { console.log(`  ! Spotify: ${e.message}`); }
    await notify({ title: "📬 Your weekly Music Radar", message: intro.slice(0, 300), url: `${API}/digests/${file}` });
  }
  saveState(state);
  writeRss(state);
  console.log(`Digest written → data/digests/${file}`);
  return file;
}
