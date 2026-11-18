'use strict';
/* RSS 2.0 / Atom to compact JSON, and HTML entity decoding. No config, no disk: safe to load from anywhere
   (Feeds, company lookups, Music Radar's blog source). */
const ENT = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', copy: '©', reg: '®', trade: '™', bull: '•', middot: '·', laquo: '«', raquo: '»', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç' };
const decode = s => String(s || '').replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m).replace(/\s+/g, ' ').trim();

// music players and links embedded in a post (Music Radar's blog reader, 2026-11-17): Bandcamp, Spotify, SoundCloud
const LISTEN = [['bandcamp', /^https:\/\/(?:[a-z0-9-]+\.bandcamp\.com\/(?:album|track)\/[^\s"'<>?#]+|bandcamp\.com\/EmbeddedPlayer\/[^\s"'<>]+)/i],
  ['spotify', /^https:\/\/open\.spotify\.com\/(?:embed\/)?(?:album|track|artist|playlist)\/[A-Za-z0-9]+/i],
  ['soundcloud', /^https:\/\/(?:w\.)?soundcloud\.com\/[^\s"'<>]+/i]];
function listenLinks(html) {
  const out = [], seen = new Set();
  for (const m of String(html).matchAll(/(?:href|src)=["']([^"']+)["']/gi)) {
    let u = decode(m[1]); if (u.startsWith('//')) u = 'https:' + u;
    // SoundCloud's player carries the real address in ?url=
    const sc = u.match(/^https:\/\/w\.soundcloud\.com\/player\/?\?url=([^&]+)/i); if (sc) { try { u = decodeURIComponent(sc[1]); } catch {} }
    for (const [kind, re] of LISTEN) {
      const x = u.match(re); if (!x) continue;
      const url = x[0].replace('/embed/', '/'); if (seen.has(url) || /EmbeddedPlayer/i.test(url) && kind === 'bandcamp' && out.some(o => o.kind === 'bandcamp')) break;
      seen.add(url); out.push({ kind, url }); break;
    }
    if (out.length >= 4) break;
  }
  return out;
}
// "Sounds like: A, B and C" (Indie Shuffle and others): similar artists named by the writer
function soundsLike(text) {
  const m = String(text).match(/\bsounds? like\s*[:\-–—]\s*([^.\n|]{2,200})/i); if (!m) return [];
  return m[1].split(/\s*(?:,|\/|;|\band\b|&|\+)\s*/i).map(x => x.replace(/["“”]/g, '').trim()).filter(x => x.length > 1 && x.length < 50 && x.split(' ').length <= 6).slice(0, 6);
}

function parseFeed(xml, base) {
  const tag = (src, name) => { const m = src.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i')); return m ? m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1').trim() : ''; };
  const attr = (src, name, a) => { const m = src.match(new RegExp(`<${name}\\b[^>]*\\b${a}=["']([^"']+)["']`, 'i')); return m ? m[1] : ''; };
  // links and images from a feed must be web addresses: a javascript: or data: link in a feed item would be a clickable script
  const abs = u => { try { const h = u ? new URL(decode(u), base).href : ''; return /^https?:\/\//i.test(h) ? h : ''; } catch { return ''; } };
  const strip = h => decode(String(h).replace(/<[^>]+>/g, ' ')).slice(0, 280);
  const bigger = u => u.replace(/\/(\d{2,3})x(\d{2,3})x(\d)\//, '/400x400x$3/');   // Lightspeed-style thumbnail sizes
  const atom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
  const chan = atom ? xml : (tag(xml, 'channel') || xml);
  const head = chan.split(atom ? /<entry[\s>]/i : /<item[\s>]/i)[0];
  const out = { title: decode(tag(head, 'title')), link: atom ? abs(attr(head, 'link', 'href')) : abs(tag(head, 'link')), image: abs(tag(tag(head, 'image'), 'url') || attr(head, 'itunes:image', 'href') || tag(head, 'logo') || tag(head, 'icon')), items: [] };
  const blocks = chan.match(atom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const b of blocks.slice(0, 60)) {
    const html = tag(b, 'content:encoded') || tag(b, 'content') || tag(b, 'description') || tag(b, 'summary');
    const img = attr(b, 'media:content', 'url') || attr(b, 'media:thumbnail', 'url') || (/<enclosure[^>]+type=["']image/i.test(b) ? attr(b, 'enclosure', 'url') : '') || attr(b, 'itunes:image', 'href') || (decode(html).match(/<img[^>]+src=["']([^"']+)["']/i) || [])[1] || '';
    out.items.push({
      title: decode(tag(b, 'title')).slice(0, 300),
      link: atom ? abs(attr(b, 'link', 'href')) : abs(tag(b, 'link') || tag(b, 'guid')),
      date: tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'published') || tag(b, 'dc:date') || '',
      image: img ? bigger(abs(img)) : '',
      summary: strip(html),
      // tags the writer gave the post (often the artist and the genre)
      categories: [...b.matchAll(/<category\b[^>]*?(?:\bterm=["']([^"']+)["'][^>]*?)?(?:\/>|>([\s\S]*?)<\/category>)/gi)].map(m => decode((m[2] || m[1] || '').replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1'))).filter(c => c && c.length < 80).slice(0, 12),
      listen: listenLinks(decode(html) + ' ' + html),
      soundsLike: soundsLike(decode(String(html)).replace(/<\/(?:p|li|div|h\d)>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ')),
      // podcasts
      audio: /<enclosure[^>]+type=["']audio/i.test(b) ? abs(attr(b, 'enclosure', 'url')) : '',
      duration: tag(b, 'itunes:duration').slice(0, 12),
      // news: the publisher (Google News puts it in <source>)
      source: decode(tag(b, 'source')).slice(0, 80),
      // Letterboxd diary entries
      film: tag(b, 'letterboxd:filmTitle') ? { title: decode(tag(b, 'letterboxd:filmTitle')).slice(0, 200), year: tag(b, 'letterboxd:filmYear').slice(0, 4), rating: parseFloat(tag(b, 'letterboxd:memberRating')) || null, rewatch: /yes/i.test(tag(b, 'letterboxd:rewatch')), watched: tag(b, 'letterboxd:watchedDate').slice(0, 10), liked: /yes/i.test(tag(b, 'letterboxd:memberLike')) } : null,
    });
  }
  return out;
}

module.exports = { ENT, decode, parseFeed, listenLinks, soundsLike };
