import { LISTINGS, POSTS_PER_LISTING, sleep } from "./config.mjs";
import { httpJson } from "./http.mjs";

let auth;
async function getAuth() {
  if (auth && auth.exp > Date.now()) return auth;
  const { REDDIT_CLIENT_ID: id, REDDIT_CLIENT_SECRET: secret } = process.env;
  if (!id || !secret) return (auth = { base: "https://www.reddit.com", headers: {}, delay: 1100, exp: Infinity });
  const tok = await httpJson("https://www.reddit.com/api/v1/access_token", {
    headers: { Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
               "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  return (auth = { base: "https://oauth.reddit.com", headers: { Authorization: `Bearer ${tok.access_token}` },
                   delay: 650, exp: Date.now() + (tok.expires_in - 60) * 1000 });
}

export async function redditGet(pathAndQuery) {
  const a = await getAuth();
  const data = await httpJson(a.base + pathAndQuery, { headers: a.headers });
  await sleep(a.delay); // stay under Reddit's rate limits
  return data;
}

const toPost = (p, sub) => ({
  id: p.id, sub: sub || p.subreddit, title: p.title,
  score: p.score ?? 0, ratio: p.upvote_ratio ?? 0.5, comments: p.num_comments ?? 0,
  created: p.created_utc, url: p.url ?? "", permalink: "https://reddit.com" + p.permalink,
});

export async function fetchPosts(subs) {
  const seen = new Set(), posts = [];
  for (const sub of subs) {
    for (const listing of LISTINGS) {
      try {
        const data = await redditGet(`/r/${sub}/${listing}.json?limit=${POSTS_PER_LISTING}&raw_json=1`);
        for (const { data: p } of data?.data?.children ?? []) {
          if (seen.has(p.id) || p.stickied) continue;
          seen.add(p.id);
          posts.push(toPost(p, sub));
        }
      } catch (e) { console.log(`  ! r/${sub}/${listing}: ${e.message}`); }
    }
    console.log(`  r/${sub}: done`);
  }
  return posts;
}

export async function fetchComments(post, n = 12) {
  const d = await redditGet(`/r/${post.sub}/comments/${post.id}.json?limit=${n}&depth=1&sort=top&raw_json=1`);
  return (d?.[1]?.data?.children ?? []).filter((c) => c.kind === "t1" && c.data.body)
    .map((c) => c.data.body.slice(0, 300)).slice(0, n);
}

export async function searchArtist(artist) {
  const d = await redditGet(`/search.json?q=${encodeURIComponent(`"${artist}"`)}&sort=new&limit=50&type=link&raw_json=1`);
  return (d?.data?.children ?? []).map((c) => c.data.subreddit);
}

export async function subAbout(sub) {
  const d = await redditGet(`/r/${sub}/about.json?raw_json=1`);
  return { subscribers: d?.data?.subscribers ?? 0, title: d?.data?.title ?? "",
           description: d?.data?.public_description ?? "", nsfw: !!d?.data?.over18 };
}
