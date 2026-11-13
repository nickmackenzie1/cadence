// Fake responses in each source's real format, for the simulation and the tests (no network needed).
// mockFetch(day) answers like the real APIs would on simulated day 0..13: Glass Lantern climbs Hype Machine and Audius,
// Mira Vale gets blog coverage, Ketamine Kids crosses over onto the Apple chart near the end.
const FILL = ["Sabrina Carpenter", "Kendrick Lamar", "Chappell Roan", "Tyler, the Creator", "Billie Eilish", "SZA", "Fred again..", "Charli xcx", "Bad Bunny", "Doechii", "The Weeknd", "Olivia Rodrigo"];
const INDIE = ["Wednesday", "MJ Lenderman", "Fontaines D.C.", "Alvvays", "Hovvdy", "Water From Your Eyes", "Feeble Little Horse", "Squirrel Flower", "Wishy", "Smut"];
const rankOf = (start, perDay, day, floor = 1) => Math.max(floor, Math.round(start - perDay * day));

export function payloads(day) {
  const lb = { payload: { releases: [
    ...INDIE.slice(0, 6).map((a, i) => ({ artist_credit_name: a, release_name: `Record ${i + 1}`, release_date: `2026-11-${String(1 + i).padStart(2, "0")}`, release_group_primary_type: i % 3 ? "Album" : "EP", release_mbid: `lb-${a}`, release_group_mbid: `lbg-${a}` })),
    ...(day >= 5 ? [{ artist_credit_name: "Glass Lantern", release_name: "Halflight", release_date: "2026-11-20", release_group_primary_type: "Album", release_mbid: "lb-glass", release_group_mbid: "lbg-glass", release_tags: ["shoegaze"] }] : []),
  ] } };
  const apple = (what) => ({ feed: { updated: new Date().toISOString(), results: [
    ...(what === "songs" && day >= 11 ? [{ artistName: "Ketamine Kids", name: "Sigil", id: "ak1", url: "https://music.apple.com/ca/song/ak1", genres: [{ name: "Hip-Hop/Rap" }, { name: "Music" }] }] : []),
    ...FILL.map((a, i) => ({ artistName: a, name: `${what === "albums" ? "Album" : "Song"} ${i + 1}`, id: `${what}-${i}`, url: `https://music.apple.com/ca/${what}/${i}`, genres: [{ name: i % 2 ? "Pop" : "Hip-Hop/Rap" }] })),
  ] } });
  const audius = { data: [
    { id: "au-glass", title: "Undertow", genre: "Alternative", mood: "Melancholy", play_count: 1200 + day * 900, permalink: "/glasslantern/undertow", user: { name: "Glass Lantern", handle: "glasslantern" } },
    { id: "au-neon", title: "Static Bloom", genre: "Electronic", play_count: 9000, permalink: "/neontidal/static-bloom", user: { name: "Neon Tidal", handle: "neontidal" } },
    ...Array.from({ length: 20 }, (_, i) => ({ id: `au-${i}`, title: `Track ${i}`, genre: "Electronic", play_count: 500 * (20 - i), permalink: `/u${i}/t${i}`, user: { name: `Producer ${i}`, handle: `p${i}` } })),
  ] };
  // Glass Lantern climbs Audius: put it at a rank that improves each day
  const g = audius.data.shift(); audius.data.splice(Math.min(audius.data.length, rankOf(20, 1.5, day) - 1), 0, g);
  const hype = { version: 1 };
  const hy = [...INDIE.slice(4).map((a, i) => ({ artist: a, title: `Song ${i}`, mediaid: `h${i}`, sitename: "Gorilla vs. Bear", loved_count: 300 - i * 10 })),
    ...(day >= 3 ? [{ artist: "Glass Lantern", title: "Undertow", mediaid: "hglass", sitename: "Stereogum", loved_count: 100 + day * 40 }] : []),
    ...(day >= 7 ? [{ artist: "Mira Vale", title: "Paper Coast", mediaid: "hmira", sitename: "The Fader", loved_count: 220 }] : [])];
  const gi = hy.findIndex((t) => t.artist === "Glass Lantern"); if (gi >= 0) { const [x] = hy.splice(gi, 1); hy.splice(Math.max(0, Math.min(hy.length, 6 - Math.floor(day / 2))), 0, x); }
  hy.forEach((t, i) => { hype[i] = { ...t, dateposted: 1793300000 + day * 86400 }; });
  const bc = { results: [
    ...INDIE.slice(2, 7).map((a, i) => ({ title: `Tape ${i}`, band_name: a, item_url: `https://${a.toLowerCase().replace(/\W/g, "")}.bandcamp.com/album/tape-${i}`, item_type: "a", release_date: "06 Nov 2026" })),
    ...(day >= 2 ? [{ title: "Porch Lights EP", band_name: "Porch Static", item_url: "https://porchstatic.bandcamp.com/album/porch-lights", item_type: "a", release_date: "08 Nov 2026" }] : []),
  ] };
  const rss = (name, items) => `<?xml version="1.0"?><rss version="2.0"><channel><title>${name}</title>${items.map(([t, l]) => `<item><title><![CDATA[${t}]]></title><link>${l}</link><pubDate>Mon, 09 Nov 2026 12:00:00 GMT</pubDate></item>`).join("")}</channel></rss>`;
  const blogs = {
    stereogum: rss("Stereogum", [["Wednesday Announce New Album “Bleeds”", "https://stereogum.example/wednesday"], ["The 50 Best Albums Of 2026 So Far", "https://stereogum.example/list"],
      ...(day >= 6 ? [["Mira Vale – “Paper Coast”", "https://stereogum.example/mira"]] : []), ...(day >= 9 ? [["Glass Lantern Share New Song “Undertow”", "https://stereogum.example/glass"]] : [])]),
    gvb: rss("Gorilla vs. Bear", [["Hovvdy – “Meant”", "https://gvb.example/hovvdy"], ...(day >= 8 ? [["Mira Vale – Paper Coast", "https://gvb.example/mira"]] : [])]),
  };
  return { lb, apple, audius, hype, bc, blogs };
}

export function mockFetch(day) {
  const p = payloads(day);
  const json = (b) => new Response(JSON.stringify(b), { status: 200, headers: { "Content-Type": "application/json" } });
  const text = (b) => new Response(b, { status: 200, headers: { "Content-Type": "application/rss+xml" } });
  return async (url) => {
    url = String(url);
    if (url.includes("listenbrainz.org")) return json(p.lb);
    if (url.includes("applemarketingtools.com")) return json(p.apple(url.includes("/songs.json") ? "songs" : "albums"));
    if (url.includes("api.audius.co")) return json(url.includes("genre=") ? { data: p.audius.data.slice(0, 8) } : p.audius);
    if (url.includes("hypem.com")) return json(p.hype);
    if (url.includes("bandcamp.com/api/discover")) return json(p.bc);
    if (url.includes("stereogum")) return text(p.blogs.stereogum);
    if (url.includes("gorillavsbear")) return text(p.blogs.gvb);
    return new Response("not here", { status: 404 });
  };
}
export const TEST_BLOGS = [{ name: "Stereogum", url: "https://www.stereogum.com/feed/" }, { name: "Gorilla vs. Bear", url: "https://www.gorillavsbear.net/feed/" }];
