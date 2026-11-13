import fs from "node:fs";
import path from "node:path";
import { DATA, PUBLIC_URL } from "./config.mjs";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildRss(state, limit = 80, base = PUBLIC_URL) {
  const api = `${base}/api/radar`;
  const items = [
    ...state.picks.map((p) => ({ ts: p.ts, kind: "pick", p })),
    ...state.digests.map((d) => ({ ts: d.ts, kind: "digest", d })),
  ].sort((a, b) => b.ts - a.ts).slice(0, limit);

  const xmlItems = items.map(({ ts, kind, p, d }) => {
    if (kind === "digest") {
      return `  <item>
    <title>${esc(d.title)}</title>
    <link>${esc(`${api}/digests/${d.file}`)}</link>
    <guid isPermaLink="false">digest-${esc(d.id)}</guid>
    <pubDate>${new Date(ts * 1000).toUTCString()}</pubDate>
    <description>${esc(d.html)}</description>
  </item>`;
    }
    const icon = p.type === "album" ? "💿 " : p.type === "ep" ? "📀 " : "";
    const title = p.song ? `${icon}${p.artist} — ${p.song}` : `${p.artist} (recommended in comments)`;
    const fb = (v) => `${api}/feedback?id=${encodeURIComponent(p.id)}&v=${v}`;
    const desc = `<p><b>You should check this out.</b> ${esc(p.blurb)}</p>`
      + (p.genres?.length ? `<p>Genres: ${esc(p.genres.join(", "))}</p>` : "")
      + (p.listeners != null ? `<p>Last.fm listeners: ${p.listeners.toLocaleString()}</p>` : "")
      + `<p>Radar score: ${p.score.toFixed(1)}</p>`
      + `<p><a href="${esc(p.link)}">Listen</a> · <a href="${esc(p.thread)}">Reddit thread</a></p>`
      + `<p><a href="${esc(fb(1))}">👍 More like this</a> · <a href="${esc(fb(-1))}">👎 Not for me</a></p>`;
    return `  <item>
    <title>${esc(title)}</title>
    <link>${esc(p.link)}</link>
    <guid isPermaLink="false">${esc(p.id)}</guid>
    <pubDate>${new Date(ts * 1000).toUTCString()}</pubDate>
    <description>${esc(desc)}</description>
  </item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Music Radar</title>
  <link>${esc(base + "/#view-radar")}</link>
  <description>Up-and-coming music picked from Reddit buzz</description>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${xmlItems.join("\n")}
</channel>
</rss>
`;
}

export function writeRss(state, out = path.join(DATA, "feed.xml")) {
  fs.writeFileSync(out, buildRss(state), "utf8");
  return out;
}
