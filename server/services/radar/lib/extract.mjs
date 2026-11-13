// Turns a Reddit post (+ comments) into structured music data.
// With ANTHROPIC_API_KEY, Claude reads titles AND comments; otherwise regex rules do it.
import { hasAI, claude, parseJson } from "./ai.mjs";

const TAG_RE = /^\s*\[(fresh|new)([^\]]*)\]\s*/i;
const SPLIT_RE = /^(?<artist>.+?)\s+(?:--|—|–|-|:)\s+(?<song>.+)$/;
const BRACKET_RE = /[[(]([^\])]*)[\])]/g;
const NOT_GENRE = /^(\d{4}s?|official|video|audio|lyrics?|full album|album|ep|lp|single|live|remix|hd|hq|music video|visualizer|cover|demo|\d+)$/i;
const ALBUM_HINT = /\b(full album|album stream|lp|full ep|ep)\b/i;

export function norm(name) {
  return String(name).toLowerCase().trim()
    .replace(/\s+(feat\.?|ft\.?|featuring|with|x|&|,)\s+.*$/, "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

// ---------- rule-based ----------
export function parseTitle(title) {
  const tag = title.match(TAG_RE);
  const fresh = !!tag;
  const tagKind = tag ? tag[2].trim().toLowerCase() : "";
  const genres = [];
  for (const m of title.matchAll(BRACKET_RE)) {
    for (const g of m[1].split(/[\/,;|]/)) {
      const t = g.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
      if (t && t.length < 30 && !NOT_GENRE.test(t) && !/^(fresh|new$|feat|ft\.|prod|with |w\/|remix|from )/.test(t)) genres.push(t);
    }
  }
  let t = title.replace(TAG_RE, "").trim();
  const m = t.match(SPLIT_RE);
  if (!m) return null;
  const artist = m.groups.artist.trim().replace(/^["']+|["']+$/g, "");
  let song = m.groups.song;
  const isAlbum = /album|ep|lp/.test(tagKind) || ALBUM_HINT.test(song);
  song = song.replace(/\s*[[(][^\])]*[\])]/g, "").trim().replace(/^["']+|["']+$/g, "");
  if (!(artist.length > 1 && artist.length < 60 && song)) return null;
  if (artist.endsWith("?") || artist.split(/\s+/).length > 8) return null;
  return { artist, song, fresh, type: isAlbum ? (/ep/.test(tagKind) || /\bep\b/i.test(m.groups.song) ? "ep" : "album") : "track", genres };
}

const LIKE_RE = /(?:sounds?|reminds? me of|vibes? of|feels?)\s+(?:a\s+(?:lot|bit)\s+|kinda\s+|so much\s+)?(?:like\s+)?(?:early\s+|late\s+|old\s+)?([A-Z0-9][\w'&.$!]*(?:\s+(?:of\s+|the\s+)?[A-Z0-9&][\w'&.$!]*){0,4})/g;
const MEETS_RE = /([A-Z][\w'&.]*(?:\s+[A-Z][\w'&.]*){0,3})\s+meets\s+([A-Z][\w'&.]*(?:\s+[A-Z][\w'&.]*){0,3})/g;
const SCENE_RE = /\b((?:[a-z]+[- ]){0,1}[a-z]*(?:core|wave|gaze|pop|punk|emo|rock|hop|step|house|techno|folk|metal|revival|jazz|soul|rap|drill|phonk|garage|grunge|indie))\b/gi;
const POS = /\b(love|loving|amazing|banger|incredible|beautiful|obsessed|fire|gorgeous|great|favou?rite|chills|perfect|underrated|masterpiece|goat|stunning|insane|killer|addictive|gem)\b/gi;
const NEG = /\b(boring|overrated|mid|bad|hate|worse|generic|derivative|cringe|terrible|awful|meh|skip|annoying|forgettable|ai slop|industry plant)\b/gi;
const SUB_RE = /(?:^|[\s(])\/?r\/([A-Za-z0-9_]{3,21})\b/g;
const STOP_LEAD = /^(like|more|the|this|that|so|very|some|really|of|a|and|is|just|good|great|new|old|real) /;
const STOP_SCENES = new Set(["revival", "pop", "rock", "rap", "indie", "punk", "emo", "metal", "jazz", "soul", "folk", "house", "techno", "hop", "wave", "core", "step"]);

export function ruleExtract(p) {
  const t = parseTitle(p.title);
  const comments = p.commentTexts || [];
  const text = comments.join("\n");
  const soundsLike = [];
  if (t) {
    const clean = (x) => x.replace(/[.!?,]+$/, "").trim();
    for (const m of text.matchAll(LIKE_RE)) soundsLike.push([t.artist, clean(m[1])]);
    for (const m of text.matchAll(MEETS_RE)) soundsLike.push([t.artist, clean(m[1])], [t.artist, clean(m[2])]);
  }
  const terms = new Set(t?.genres || []);
  for (const m of text.matchAll(SCENE_RE)) {
    if (m[1] !== m[1].toLowerCase()) continue;          // "Beach House" is a band, not a scene
    const s = m[1].trim();
    if (s.length > 4 && !STOP_SCENES.has(s) && !STOP_LEAD.test(s)) terms.add(s);
  }
  const pos = (text.match(POS) || []).length, neg = (text.match(NEG) || []).length;
  return {
    music: !!t, artist: t?.artist || null, song: t?.song || null, type: t?.type || "track",
    fresh: t?.fresh || false, genres: t?.genres || [], mentioned: [], soundsLike: soundsLike.slice(0, 6),
    terms: [...terms].slice(0, 8), sentiment: comments.length ? (pos - neg) / (pos + neg + 2) : 0,
    subMentions: [...text.matchAll(SUB_RE)].map((m) => m[1]),
  };
}

// ---------- AI ----------
const PROMPT = `You are a data extractor for a music-discovery tool. For each Reddit post below (title + some top comments), return a JSON array with one object per post:
{"id": "...",
 "music": true if the post shares or discusses a specific artist's music,
 "artist": main artist name or null,
 "song": track or release title or null,
 "type": "track" | "album" | "ep",
 "genres": up to 3 lowercase genres (from title tags, comments, or obvious context),
 "mentioned": other artists that commenters RECOMMEND or bring up as worth hearing (max 5),
 "sounds_like": [[artistA, artistB], ...] pairs where someone says A sounds like / reminds of B (A is usually the post's artist; max 5),
 "terms": up to 5 lowercase scene/trend phrases people use (e.g. "midwest emo revival", "sigilkore", "sounds like 2007"),
 "sentiment": number from -1 (commenters dislike it) to 1 (commenters love it), 0 if no comments}
Use ONLY what is in the text. For r/ifyoulikeblank-style requests, "artist" is null and "mentioned" holds the recommended artists. Reply with the JSON array only.

POSTS:
`;

async function aiBatch(batch) {
  const payload = batch.map((p) => ({ id: p.id, sub: p.sub, title: p.title, comments: (p.commentTexts || []).slice(0, 10) }));
  const out = parseJson(await claude(PROMPT + JSON.stringify(payload), 6000));
  return new Map(out.map((o) => [o.id, o]));
}

export async function extractAll(posts) {
  const result = {};
  for (const p of posts) result[p.id] = ruleExtract(p);
  if (!hasAI() || !posts.length) return result;
  for (let i = 0; i < posts.length; i += 15) {
    const batch = posts.slice(i, i + 15);
    try {
      const ai = await aiBatch(batch);
      for (const p of batch) {
        const a = ai.get(p.id), r = result[p.id];
        if (!a) continue;
        result[p.id] = {
          music: !!a.music || (a.mentioned?.length > 0),
          artist: a.artist || null, song: a.song || null,
          type: ["album", "ep"].includes(a.type) ? a.type : r.type,
          fresh: r.fresh,
          genres: (a.genres || []).map((g) => g.toLowerCase()).slice(0, 3),
          mentioned: (a.mentioned || []).slice(0, 5),
          soundsLike: (a.sounds_like || []).filter((x) => Array.isArray(x) && x.length === 2).slice(0, 5),
          terms: (a.terms || []).map((s) => s.toLowerCase()).slice(0, 5),
          sentiment: Math.max(-1, Math.min(1, Number(a.sentiment) || 0)),
          subMentions: r.subMentions, ai: true,
        };
      }
    } catch (e) { console.log(`  ! AI extraction batch failed (using rules): ${e.message}`); }
    process.stdout.write(`  AI read ${Math.min(i + 15, posts.length)}/${posts.length} posts\r`);
  }
  console.log();
  return result;
}
