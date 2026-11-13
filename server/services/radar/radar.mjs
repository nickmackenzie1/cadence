#!/usr/bin/env node
/**
 * Music Radar — one run: collect → AI/rule extraction → trends → score → enrich → feed + alerts.
 * Run every few hours (cron / Task Scheduler). See README.md.
 *
 *   node radar.mjs [--top 15] [--playlist]
 */
import { DEFAULT_SUBS, COMMENT_POSTS, WINDOW_HOURS, TOO_BIG, ALERT_MIN_SCORE, now, DAY } from "./lib/config.mjs";
import { loadState, saveState, appendJsonl, readJsonl } from "./lib/store.mjs";
import { fetchPosts, fetchComments } from "./lib/reddit.mjs";
import { extractAll, norm } from "./lib/extract.mjs";
import { hotness, buildCandidates, albumBoard } from "./lib/score.mjs";
import { subWeights } from "./lib/trends.mjs";
import { tasteModel } from "./lib/taste.mjs";
import { lastfmInfo, sizeFactor, hasLastfm } from "./lib/enrich.mjs";
import { hasAI, claude, parseJson } from "./lib/ai.mjs";
import { notify } from "./lib/notify.mjs";
import { writeRss } from "./lib/rss.mjs";
import { updatePlaylist } from "./lib/spotify.mjs";

function defaultBlurb(c) {
  const bits = [`${c.mentions} mention${c.mentions > 1 ? "s" : ""} across r/${c.subs.join(", r/")}`];
  if (!c.commentOnly) bits.push(`${c.upvotes.toLocaleString()} upvotes, ${c.comments.toLocaleString()} comments`);
  else bits.push("recommended by commenters");
  if (c.genres.length) bits.push(c.genres.slice(0, 2).join(" / "));
  if (c.fresh) bits.push("brand-new release");
  if (c.listeners != null) bits.push(`${c.listeners.toLocaleString()} Last.fm listeners`);
  if (c.sentiment > 0.3) bits.push("comments love it");
  return bits.join(" · ");
}

async function aiBlurbs(picks) {
  if (!hasAI() || !picks.length) return {};
  const data = picks.map((p) => ({ artist: p.artist, title: p.song, type: p.type, subs: p.subs, genres: p.genres,
    mentions: p.mentions, upvotes: p.upvotes, comments: p.comments, listeners: p.listeners, sentiment: +p.sentiment.toFixed(2),
    post_titles: p.titles }));
  try {
    return parseJson(await claude("You're a friend with great music taste writing a personal music radar feed. "
      + "For each artist, write ONE punchy sentence (max 35 words) on why I should check them out: vibe/genre from the data, "
      + "and the buzz signal (e.g. 'blowing up across r/indieheads and r/listentothis', 'only 8k listeners'). "
      + "Don't invent facts beyond the data. Reply ONLY with JSON {\"<artist>\": \"<blurb>\"}.\n\n" + JSON.stringify(data)));
  } catch (e) { console.log(`  ! AI blurbs skipped: ${e.message}`); return {}; }
}

export async function run({ top = 15, demoPosts = null, playlist = false, quiet = false } = {}) {
  const log = quiet ? () => {} : console.log;
  const t = now();
  const state = loadState();
  const subs = state.subs || DEFAULT_SUBS;

  // 1. collect
  if (!demoPosts) log(`Fetching ${subs.length} subreddits…`);
  const posts = demoPosts ?? await fetchPosts(subs);
  const windowPosts = posts.filter((p) => t - p.created < WINDOW_HOURS * 3600 && p.created <= t);
  const fresh = windowPosts.filter((p) => !state.extractCache[p.id]);
  if (!demoPosts) {
    const hot = [...fresh].sort((a, b) => hotness(b, t) - hotness(a, t)).slice(0, COMMENT_POSTS);
    log(`Reading comments on ${hot.length} posts…`);
    for (const p of hot) { try { p.commentTexts = await fetchComments(p); } catch {} }
  }

  // 2. extract (Claude reads titles + comments if ANTHROPIC_API_KEY is set)
  log(`Extracting music data from ${fresh.length} new posts${hasAI() ? " with Claude" : ""}…`);
  const ext = await extractAll(fresh);

  // 3. fold new posts into long-running trend data (each post counted once)
  const genreCounts = {}, termCounts = {};
  for (const p of fresh) {
    const e = ext[p.id];
    state.extractCache[p.id] = { ...e, ts: t };
    if (state.seenPosts[p.id]) continue;
    state.seenPosts[p.id] = t;
    for (const s of e.subMentions || []) state.subMentions[s] = (state.subMentions[s] || 0) + 1;
    if (!e.music) continue;
    for (const g of e.genres || []) genreCounts[g] = (genreCounts[g] || 0) + 1;
    for (const term of e.terms || []) termCounts[term] = (termCounts[term] || 0) + 1;
    for (const name of [e.artist, ...(e.mentioned || [])].filter(Boolean)) {
      const key = norm(name);
      if (!key) continue;
      const a = (state.artists[key] ||= { name, firstSeen: {}, genres: {} });
      if (!a.firstSeen[p.sub] || p.created < a.firstSeen[p.sub]) a.firstSeen[p.sub] = p.created;
      if (name === e.artist) for (const g of e.genres || []) a.genres[g] = (a.genres[g] || 0) + 1;
    }
    for (const [x, y] of e.soundsLike || []) {
      const [a, b] = [norm(x), norm(y)].sort();
      if (!a || !b || a === b) continue;
      const k = `${a}|||${b}`;
      const edge = (state.edges[k] ||= { a, b, aName: a === norm(x) ? x : y, bName: b === norm(y) ? y : x, n: 0 });
      edge.n++; edge.ts = t;
    }
  }
  appendJsonl("genres", Object.entries(genreCounts).map(([genre, n]) => ({ ts: t, genre, n })));
  appendJsonl("terms", Object.entries(termCounts).map(([term, n]) => ({ ts: t, term, n })));

  // 4. score
  const taste = tasteModel(state);
  let cands = buildCandidates(windowPosts, { now: t, subWeights: subWeights(state.artists), taste, ext: state.extractCache });

  // 5. how big are they really? (Last.fm) — otherwise fall back to the hand-made list
  if (hasLastfm()) {
    for (const c of cands.slice(0, 40)) {
      const info = await lastfmInfo(state, c.key, c.artist);
      c.listeners = info?.listeners ?? null;
      c.score *= sizeFactor(c.listeners);
      if (!c.genres.length && info?.tags?.length) c.genres = info.tags.slice(0, 3);
    }
    cands = cands.filter((c) => c.score > 0);
  } else cands = cands.filter((c) => !TOO_BIG.has(c.key));
  cands.sort((a, b) => b.score - a.score);
  const albums = albumBoard(cands);

  // 6. snapshot for charts (read the previous run first, for spike alerts)
  const prev = new Map();
  for (const s of readJsonl("snapshots", t - 3 * DAY)) if (s.ts < t && s.kind !== "album") prev.set(s.key, Math.max(prev.get(s.key) || 0, s.score));
  appendJsonl("snapshots", [
    ...cands.slice(0, 200).map((c) => ({ ts: t, kind: "artist", key: c.key, artist: c.artist, score: +c.score.toFixed(2),
      mentions: c.mentions, subs: c.subs, upvotes: c.upvotes, genres: c.genres, listeners: c.listeners ?? null })),
    ...albums.slice(0, 50).map((a) => ({ ts: t, kind: "album", key: a.key, artist: a.artist, album: a.album, type: a.type,
      score: +a.score.toFixed(2), subs: a.subs, link: a.link, thread: a.thread })),
  ]);

  // 7. pick what goes in the feed (new songs/albums only; comment-only finds need 2+ mentions)
  const featured = new Set(state.picks.map((p) => `${p.key}::${(p.song || "").toLowerCase()}`));
  const recentArtists = new Set(state.picks.filter((p) => t - p.ts < 3 * DAY).map((p) => p.key));
  const picks = cands.filter((c) => {
    if (recentArtists.has(c.key)) return false;
    if (c.commentOnly) return c.mentions >= 2 && !featured.has(`${c.key}::`);
    return !featured.has(`${c.key}::${(c.song || "").toLowerCase()}`);
  }).slice(0, top);
  const blurbs = await aiBlurbs(picks);
  for (const c of picks) {
    state.picks.push({ id: `${c.key.replace(/\s+/g, "-")}-${Math.round(t).toString(36)}`, key: c.key, artist: c.artist,
      song: c.song, type: c.type, score: +c.score.toFixed(2), link: c.link, thread: c.thread, genres: c.genres, subs: c.subs,
      listeners: c.listeners ?? null, blurb: blurbs[c.artist] || defaultBlurb(c), ts: t });
    log(`  ${c.score.toFixed(1).padStart(7)}  ${c.type !== "track" ? "💿 " : ""}${c.artist} — ${c.song ?? "(recommended in comments)"}  [${c.subs.join(", ")}]`);
  }

  // 8. phone alert when something suddenly spikes across subs
  for (const c of cands.slice(0, 30)) {
    const before = prev.get(c.key) || 0;
    const spiking = c.subs.length >= 2 && c.score >= ALERT_MIN_SCORE && c.score >= 2 * before;
    if (spiking && !(t - (state.alerts[c.key] || 0) < 7 * DAY)) {
      state.alerts[c.key] = t;
      await notify({ title: `🚀 ${c.artist} is spiking`, url: c.link,
        message: `${c.song ? c.song + " · " : ""}${c.mentions} mentions across r/${c.subs.join(", r/")} (score ${c.score.toFixed(0)}${before ? `, was ${before.toFixed(0)}` : ""})` });
      log(`  🔔 alert: ${c.artist}`);
    }
  }

  saveState(state);
  const out = writeRss(state);
  if (playlist) { try { const r = await updatePlaylist(state); if (r) log(`Spotify playlist updated: ${r.count} tracks`); } catch (e) { log(`  ! Spotify: ${e.message}`); } }
  log(`Wrote ${picks.length} new picks → ${out}  (dashboard: Cadence → Life → Music Radar)`);
  return { picks, cands, albums };
}
