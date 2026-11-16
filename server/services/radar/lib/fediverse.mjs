// Community buzz (user, 2026-11-16: Reddit removed). Lemmy communities and
// Mastodon hashtags have public read APIs with no account or key. Their posts come out in the same shape as Reddit's
// (id, sub, title, score, ratio, comments, created, url, permalink), so picks, trends, breakouts and genre jumps work on them unchanged.
//   Lemmy:    GET https://<host>/api/v3/post/list?community_name=<name>&type_=All&sort=Hot|New&limit=40
//             GET https://<host>/api/v3/comment/list?post_id=<id>&sort=Top&type_=All&limit=12
//   Mastodon: GET https://<host>/api/v1/timelines/tag/<tag>?limit=40
// Community ids look like "indieheads@lemmy.ml"; hashtags like "#indiemusic" (on mastodon.social unless "#tag@host").
import { httpJson } from "./http.mjs";

export const DEFAULT_COMMUNITIES = ["indieheads@lemmy.ml", "listentothis@lemmy.zip", "indieheads@lemmy.world", "postpunk@lemmy.world", "garagerock@lemmy.world", "music@lemmy.world"];
export const DEFAULT_TAGS = ["#indiemusic", "#indierock", "#newmusic", "#bandcamp"];
const MASTODON = "mastodon.social";
const HOST_RE = /^[a-z0-9.-]+\.[a-z]{2,}$/i, NAME_RE = /^[a-z0-9_]{1,40}$/i;

export const isFedi = (sub) => /@|^#/.test(String(sub || ""));
// tests point every host at one fake server
const base = (host) => process.env.RADAR_FEDI_BASE ? process.env.RADAR_FEDI_BASE.replace(/\/$/, "") + "/" + host : "https://" + host;
const iso = (s) => { const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + "Z"); return isFinite(t) ? Math.round(t / 1000) : 0; };
const strip = (html) => String(html || "").replace(/<br\s*\/?>|<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

export function parseCommunity(s) {
  const m = String(s || "").trim().replace(/^!/, "").match(/^([^@\s]+)@([^@\s]+)$/);
  return m && NAME_RE.test(m[1]) && HOST_RE.test(m[2]) ? { name: m[1].toLowerCase(), host: m[2].toLowerCase() } : null;
}
export function parseTag(s) {
  const m = String(s || "").trim().match(/^#?([a-z0-9_]{2,40})(?:@([a-z0-9.-]+\.[a-z]{2,}))?$/i);
  return m ? { tag: m[1].toLowerCase(), host: (m[2] || MASTODON).toLowerCase() } : null;
}

export async function fetchLemmy(communities = DEFAULT_COMMUNITIES, log = console.log) {
  const seen = new Set(), posts = [];
  for (const c of communities.map(parseCommunity).filter(Boolean)) {
    const sub = `${c.name}@${c.host}`;
    try {
      for (const sort of ["Hot", "New"]) {
        const d = await httpJson(`${base(c.host)}/api/v3/post/list?community_name=${encodeURIComponent(sub)}&type_=All&sort=${sort}&limit=40`);
        for (const it of d.posts || []) {
          const p = it.post || {}, n = it.counts || {}, id = `lm-${c.host}-${p.id}`;
          if (!p.id || seen.has(id) || p.deleted || p.removed || p.featured_community || p.featured_local) continue;
          seen.add(id);
          const up = n.upvotes ?? Math.max(0, n.score || 0), down = n.downvotes ?? 0;
          posts.push({ id, sub, title: p.name || "", score: n.score ?? up - down, ratio: up + down ? up / (up + down) : 0.5, comments: n.comments ?? 0,
            created: iso(p.published || ""), url: p.url || p.ap_id || "", permalink: p.ap_id || `https://${c.host}/post/${p.id}`, fedi: { kind: "lemmy", host: c.host, postId: p.id } });
        }
      }
      log(`  ${sub}: done`);
    } catch (e) { log(`  ! ${sub}: ${e.message}`); }
  }
  return posts;
}

// what a Mastodon post is about: the link card first (Bandcamp "Song, by Artist", YouTube "Artist - Song"), else its text
export function mastodonTitle(st) {
  const card = st.card || null;
  if (card && card.title) {
    const by = card.title.match(/^(.+?),\s+by\s+(.+)$/i);           // Bandcamp
    if (by) return `${by[2].trim()} - ${by[1].trim()}`;
    if (/\s[-–—]\s/.test(card.title)) return card.title.replace(/\s*\|\s*(YouTube|Bandcamp|SoundCloud).*$/i, "").trim();
  }
  const text = strip(st.content).split("\n").map((l) => l.replace(/#\w+/g, "").replace(/https?:\/\/\S+/g, "").replace(/^(now playing|np|listening to)\s*[:\-–]?\s*/i, "").trim()).find((l) => /\s[-–—]\s/.test(l));
  return text || (card && card.title) || strip(st.content).slice(0, 200);
}
export async function fetchMastodon(tags = DEFAULT_TAGS, log = console.log) {
  const seen = new Set(), posts = [];
  for (const t of tags.map(parseTag).filter(Boolean)) {
    const sub = "#" + t.tag + (t.host === MASTODON ? "" : "@" + t.host);
    try {
      const list = await httpJson(`${base(t.host)}/api/v1/timelines/tag/${encodeURIComponent(t.tag)}?limit=40`);
      for (const s0 of Array.isArray(list) ? list : []) {
        const st = s0.reblog || s0, id = "md-" + (st.uri || st.id);
        if (seen.has(id) || st.sensitive) continue; seen.add(id);
        posts.push({ id, sub, title: mastodonTitle(st).slice(0, 300), score: (st.favourites_count || 0) + (st.reblogs_count || 0), ratio: 0.9, comments: st.replies_count || 0,
          created: iso(st.created_at || ""), url: (st.card && st.card.url) || st.url || "", permalink: st.url || st.uri || "", fedi: { kind: "mastodon" } });
      }
      log(`  ${sub}: done`);
    } catch (e) { log(`  ! ${sub}: ${e.message}`); }
  }
  return posts;
}

export async function fetchLemmyComments(post, n = 12) {
  const f = post.fedi || {}; if (f.kind !== "lemmy") return [];
  const d = await httpJson(`${base(f.host)}/api/v3/comment/list?post_id=${f.postId}&sort=Top&type_=All&limit=${n}`);
  return (d.comments || []).map((c) => String((c.comment || {}).content || "").slice(0, 300)).filter(Boolean).slice(0, n);
}
