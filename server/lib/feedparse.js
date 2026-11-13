'use strict';
/* RSS 2.0 / Atom to compact JSON, and HTML entity decoding. No config, no disk: safe to load from anywhere
   (Feeds, company lookups, Music Radar's blog source). */
const ENT = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', copy: '©', reg: '®', trade: '™', bull: '•', middot: '·', laquo: '«', raquo: '»', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç' };
const decode = s => String(s || '').replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m).replace(/\s+/g, ' ').trim();

function parseFeed(xml, base) {
  const tag = (src, name) => { const m = src.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i')); return m ? m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1').trim() : ''; };
  const attr = (src, name, a) => { const m = src.match(new RegExp(`<${name}\\b[^>]*\\b${a}=["']([^"']+)["']`, 'i')); return m ? m[1] : ''; };
  const abs = u => { try { return u ? new URL(decode(u), base).href : ''; } catch { return ''; } };
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

module.exports = { ENT, decode, parseFeed };
