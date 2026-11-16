/* Music Radar (Life): up-and-coming artists, songs and albums from indie blogs, campus radio, charts and music
   communities on Lemmy and Mastodon, scored for buzz and for your taste (Reddit removed 2026-11-16).
   Nick's music-radar app, running on the NAS (server/services/radar). This is its dashboard:
   who's climbing, fastest risers, genres and scenes blowing up, albums, which communities find artists first, the
   "sounds like" map, picks you rate up or down (that's how it learns your taste), where it listens, the track
   record, and the weekly digests. Switched off until you turn it on: then the NAS scans every
   6 hours and writes a digest every week. */
(() => {
  const esc = window.CadenceKit.esc, css = window.CadenceKit.css;
  const PAL = ['#3b82f6', '#f97316', '#10b981', '#eab308', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444'];
  const fmt = n => (n == null ? '–' : Number(n).toLocaleString());
  const pct = x => (x == null ? 'new' : `${x >= 0 ? '+' : ''}${Math.round(x * 100)}%`);
  const STATUS = { climbing: 'climbing', new: 'new', peaked: 'peaked', fading: 'fading' };
  const ago = ms => { if (!ms) return 'never'; const m = Math.round((Date.now() - ms) / 60e3); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
  const plain = s => String(s || '').replace(/^[\p{Extended_Pictographic}️\s]+/u, '');   // titles from the NAS may start with an emoji
  const empty = msg => `<div class="mr-empty">${msg}</div>`;

  /* ---------- small SVG charts ---------- */
  function lineChart(labels, series, { h = 240, unit = '' } = {}) {
    if (!series.length || !labels.length) return empty('Not enough data yet.');
    const W = 720, H = h, L = 36, B = 22, T = 8, R = 8, max = Math.max(1, ...series.flatMap(s => s.data)) * 1.08;
    const x = i => L + (labels.length === 1 ? 0 : i * (W - L - R) / (labels.length - 1)), y = v => T + (H - T - B) * (1 - v / max);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(k => max * k);
    const every = Math.ceil(labels.length / 8);
    return `<div class="mr-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Line chart${unit ? ' of ' + esc(unit) : ''}">
      ${ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="mr-grid"/><text x="${L - 6}" y="${y(v) + 3}" class="mr-ax" text-anchor="end">${Math.round(v)}</text>`).join('')}
      ${labels.map((l, i) => i % every === 0 || i === labels.length - 1 ? `<text x="${x(i)}" y="${H - 6}" class="mr-ax" text-anchor="${i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}">${esc(l)}</text>` : '').join('')}
      ${series.map((s, k) => `<polyline fill="none" stroke="${PAL[k % PAL.length]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${s.data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}"/>
        ${s.data.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="6" fill="transparent"><title>${esc(s.label)} · ${esc(labels[i])}: ${Math.round(v * 10) / 10}${unit ? ' ' + esc(unit) : ''}</title></circle>`).join('')}`).join('')}
    </svg><div class="mr-legend">${series.map((s, k) => `<span><i style="background:${PAL[k % PAL.length]}"></i>${esc(s.label)}</span>`).join('')}</div></div>`;
  }
  // % change bars: right of the line is up, left is down (capped at +300%)
  function changeBars(rows) {
    const shown = rows.filter(r => r.change != null).slice(0, 10), fresh = rows.filter(r => r.change == null);
    const freshLine = fresh.length ? `<div class="mr-small">Brand new this week: ${fresh.slice(0, 8).map(r => `<b>${esc(r.name)}</b> (${r.thisWeek})`).join(', ')}</div>` : '';
    if (!shown.length) return empty('Needs a couple of weeks of scans to compare.') + freshLine;
    return `<div class="mr-bars">${shown.map(r => { const v = Math.max(-100, Math.min(300, Math.round(r.change * 100))), w = Math.abs(v) / 300 * 75;
      return `<div class="mr-bar" title="${esc(pct(r.change))} · ${r.thisWeek} this week vs ${r.perWeekBefore}/week before"><span class="mr-bl">${esc(r.name)}</span>
        <span class="mr-bt"><i class="${v >= 0 ? 'up' : 'dn'}" style="${v >= 0 ? `left:25%;width:${w}%` : `right:75%;width:${Math.min(25, w)}%`}"></i></span><span class="mr-bv">${esc(pct(r.change))}</span></div>`; }).join('')}</div>${freshLine}`;
  }
  // "sounds like" map: a small force layout, run once, drawn as SVG
  function graph(g) {
    if (!g || !g.nodes.length) return empty('No comparisons collected yet.');
    const W = 900, H = 420, nodes = g.nodes.map((d, i) => ({ ...d, x: W / 2 + Math.cos(i * 2.4) * (60 + i * 3), y: H / 2 + Math.sin(i * 2.4) * (40 + i * 2), vx: 0, vy: 0 }));
    const byId = new Map(nodes.map(n => [n.id, n])), links = g.links.map(l => ({ ...l, s: byId.get(l.source), t: byId.get(l.target) })).filter(l => l.s && l.t);
    const maxD = Math.max(1, ...nodes.map(n => n.degree)), rad = n => 4 + 12 * Math.sqrt(n.degree / maxD);
    for (let it = 0; it < 260; it++) {
      const k = 1 - it / 260;
      for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
        const A = nodes[a], Bn = nodes[b]; let dx = A.x - Bn.x, dy = A.y - Bn.y; const d2 = dx * dx + dy * dy || 1, f = 3200 / d2;
        const d = Math.sqrt(d2); dx /= d; dy /= d; A.vx += dx * f; A.vy += dy * f; Bn.vx -= dx * f; Bn.vy -= dy * f;
      }
      for (const l of links) { const dx = l.t.x - l.s.x, dy = l.t.y - l.s.y, d = Math.hypot(dx, dy) || 1, f = (d - 110) * 0.02; l.s.vx += dx / d * f; l.s.vy += dy / d * f; l.t.vx -= dx / d * f; l.t.vy -= dy / d * f; }
      for (const n of nodes) { n.vx += (W / 2 - n.x) * 0.004; n.vy += (H / 2 - n.y) * 0.004; n.x = Math.max(14, Math.min(W - 14, n.x + n.vx * k)); n.y = Math.max(14, Math.min(H - 14, n.y + n.vy * k)); n.vx *= 0.6; n.vy *= 0.6; }
    }
    const minLabel = [...nodes].map(n => n.degree).sort((a, b) => a - b)[Math.floor(nodes.length * 0.6)] || 1;
    const nb = id => links.filter(l => l.s.id === id || l.t.id === id).map(l => (l.s.id === id ? l.t.name : l.s.name));
    return `<svg class="mr-graph" viewBox="0 0 ${W} ${H}" role="img" aria-label="Map of artists people compare to each other">
      ${links.map(l => `<line x1="${l.s.x.toFixed(1)}" y1="${l.s.y.toFixed(1)}" x2="${l.t.x.toFixed(1)}" y2="${l.t.y.toFixed(1)}" stroke-width="${Math.min(4, 1 + l.n / 2)}" class="mr-edge"/>`).join('')}
      ${nodes.map(n => `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${rad(n).toFixed(1)}" class="mr-node ${n.liked ? 'liked' : ''}"><title>${esc(n.name)}${n.liked ? ' (you liked)' : ''} · compared with ${esc(nb(n.id).slice(0, 6).join(', '))}</title></circle>`).join('')}
      ${nodes.filter(n => n.degree >= minLabel || n.liked).map(n => `<text x="${(n.x + rad(n) + 3).toFixed(1)}" y="${(n.y + 4).toFixed(1)}" class="mr-gl">${esc(n.name)}</text>`).join('')}
    </svg>`;
  }

  const SRC_NAMES = { community: 'Lemmy & Mastodon', listenbrainz: 'ListenBrainz', apple: 'Apple Music', audius: 'Audius', lastfm: 'Last.fm', bandcamp: 'Bandcamp', hypem: 'Hype Machine', blogs: 'Blogs', kexp: 'KEXP', earshot: '!earshot' };
  const SRC_COL = { community: '#6364ff', listenbrainz: '#eb743b', apple: '#ec4899', audius: '#8b5cf6', lastfm: '#ef4444', bandcamp: '#14b8a6', hypem: '#3b82f6', blogs: '#eab308', kexp: '#64748b', earshot: '#0d9488' };
  const srcPill = id => `<span class="mr-src" style="--c:${SRC_COL[id] || '#888'}">${esc(SRC_NAMES[id] || id)}</span>`;
  const day = ts => ts ? new Date(ts * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
  const link = (u, t) => u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${t}</a>` : t;

  // an artist name that opens their artist page (artist.js)
  const pv = (artist, title, type, from) => (window.CadencePreview && window.CadencePreview.buttons ? window.CadencePreview.buttons(artist, title, type, from) : '');
  const an = (name, bold = true) => `<a class="ar-link" href="#view-artist" data-artist="${esc(name)}">${bold ? `<b>${esc(name)}</b>` : esc(name)}</a>`;
  // album art (MusicBrainz / Cover Art Archive via the NAS, or the source's own) and "Album · Oct 2025"
  const artImg = x => x.image ? `<img class="mr-art" src="${esc(x.image)}" alt="" loading="lazy" onerror="this.remove()">` : '';
  const relNote = x => { const r = x.release; if (!r || !r.date) return ''; const d = new Date(r.date.length === 4 ? r.date + '-01-01' : r.date.length === 7 ? r.date + '-01' : r.date);
    return isNaN(d) ? '' : ` <span class="mr-small">${esc(r.type || 'Release')} · ${esc(d.toLocaleDateString(undefined, r.date.length === 4 ? { year: 'numeric' } : { month: 'short', year: 'numeric' }))}</span>`; };
  // ---- other sources: tabs for combined + each source ----
  function sourcesCard(S0, ic, G) {
    if (!S0 || !S0.available) return `<section class="mr-card w12"><h3>Other sources</h3>${empty(esc((S0 && S0.note) || 'Other sources need the database on the NAS.'))}</section>`;
    const tabs = [['all', 'Combined']].concat(S0.list.map(x => [x.id, x.name]));
    const cur = S0.list.find(x => x.id === G.src);
    let body;
    if (!cur) {
      const rows = S0.combined.filter(a => !G.multi || a.breadth >= 2), max = Math.max(1, ...rows.map(a => a.score));
      body = `<div class="mr-row" style="margin-bottom:8px"><label class="mr-small"><input type="checkbox" id="mr-multi" ${G.multi ? 'checked' : ''}> Only artists on 2 or more sources (${S0.multi})</label></div>
        ${rows.length ? `<table class="mr-t"><tr><th>Artist</th><th>Where</th><th>Heard</th><th class="n">Score</th></tr>${rows.slice(0, 40).map(a => `<tr>
          <td><div class="mr-withart">${artImg(a)}<div>${an(a.artist)} ${pv(a.artist, a.titles[0] && a.titles[0].title, null, 'Music Radar')}${a.genres.length ? ` <span class="mr-small">${esc(a.genres.join(', '))}</span>` : ''}<div class="mr-small">${a.titles.map(x => link(x.url, esc(x.title))).join(' · ')}${relNote(a)}</div></div></div></td>
          <td>${Object.keys(a.sources).map(srcPill).join(' ')}</td><td class="mr-small">${esc(day(a.first))}</td>
          <td class="n"><span class="mr-score"><i style="width:${Math.round(a.score / max * 100)}%"></i></span>${Math.round(a.score)}</td></tr>`).join('')}</table>`
          : empty(G.multi ? 'No artist is on two sources yet. Untick the box to see everything.' : 'Nothing collected yet. Press Check sources.')}`;
    } else {
      const run = cur.run, items = cur.items.filter(x => !G.feed || x.feed === G.feed);
      const status = cur.missing ? `Needs <code>${esc(cur.needs)}</code> in the NAS .env.` : !run ? 'Not checked yet.'
        : `Checked ${esc(ago(run.ts * 1000))}: ${run.n} found, ${run.fresh} new.` + (run.error ? ` <span class="mr-warn">${esc(run.error)}</span>` : '');
      body = `<p class="mr-sub">${esc(cur.kind)} · ${status}${cur.site ? ` · ${link(cur.site, 'Open site')}` : ''}${cur.on ? '' : ' · switched off in Sources'}</p>
        ${cur.feeds.length > 1 ? `<div class="mr-chips">${['', ...cur.feeds].map(f => `<button class="mr-chip ${G.feed === f ? 'on' : ''}" data-feed="${esc(f)}">${esc(f || 'All')}</button>`).join('')}</div>` : ''}
        ${items.length ? `<table class="mr-t"><tr>${cur.chart ? '<th class="n">#</th>' : ''}<th>Artist</th><th>Title</th><th>Where</th><th>${cur.chart ? 'Move' : 'First seen'}</th></tr>${items.slice(0, 80).map(x => `<tr>
          ${cur.chart ? `<td class="n">${x.rank ?? ''}</td>` : ''}<td><div class="mr-withart">${artImg(x)}${an(x.artist)} ${pv(x.artist, x.title, x.type, x.feed || 'Music Radar')}</div></td><td>${link(x.url, esc(x.title || ''))}${x.type && x.type !== 'track' && x.type !== 'artist' ? ` <span class="chip">${esc(x.type)}</span>` : ''}${relNote(x)}</td>
          <td class="mr-small">${esc(x.feed || '')}</td>
          <td class="mr-small">${cur.chart ? (x.was == null || x.was === x.rank ? (x.seen > 1 ? 'steady' : 'new') : x.was > x.rank ? `up ${x.was - x.rank}` : `down ${x.rank - x.was}`) : esc(day(x.first_seen))}</td></tr>`).join('')}</table>`
          : empty(cur.missing ? 'Add the key on the NAS to use this source.' : 'Nothing from this source yet.')}`;
    }
    return `<section class="mr-card w12" id="mr-sources"><div class="mr-row" style="justify-content:space-between"><div><h3>Other sources</h3><p class="mr-sub">Blogs, charts, radio, new releases and streaming trends, next to the communities</p></div>
        <span class="mr-row"><button class="btn" id="mr-srcnow">${ic('refresh-cw')}Check sources</button><button class="btn" id="mr-srcset">${ic('settings')}Sources</button></span></div>
      <div class="seg mr-tabs" id="mr-srctabs">${tabs.map(([id, n]) => { const x = S0.list.find(y => y.id === id); return `<button data-src="${id}" class="${G.src === id || (id === 'all' && !cur) ? 'on' : ''}">${esc(n)}${x ? ` <span class="mr-n${x.run && !x.run.ok ? ' bad' : ''}">${x.total}</span>` : ''}</button>`; }).join('')}</div>
      ${body}</section>
      <section class="mr-card w8"><h3>New finds per day, by source</h3><p class="mr-sub">Artists, songs and records each source turned up, last 30 days</p>${lineChart(S0.perDay.labels, S0.perDay.series.map(x => ({ label: x.label, data: x.data })), { h: 220, unit: 'finds' })}</section>
      <section class="mr-card w4"><h3>Climbing the charts</h3><p class="mr-sub">Up 5 or more places in two weeks</p>
        ${S0.movers.length ? `<table class="mr-t">${S0.movers.slice(0, 8).map(m => `<tr><td>${link(m.url, `<b>${esc(m.artist)}</b>`)}<div class="mr-small">${esc(m.title || '')} · ${esc(SRC_NAMES[m.source])} ${esc(m.feed || '')}</div></td><td class="n" style="white-space:nowrap">${m.was} → ${m.now}</td></tr>`).join('')}</table>` : empty('No big moves yet.')}
        <h4>Crossed over</h4><p class="mr-sub">Community picks that later showed up on the Apple chart</p>
        ${S0.crossover.length ? `<table class="mr-t">${S0.crossover.map(c => `<tr><td>${an(c.artist)} ${c.url ? link(c.url, 'chart') : ''}<div class="mr-small">picked ${esc(day(c.picked))}, charted ${esc(day(c.charted))}</div></td><td class="n">#${c.rank}</td></tr>`).join('')}</table>` : empty('None yet.')}</section>
      <section class="mr-card w12"><h3>Genres across sources</h3><p class="mr-sub">Tags from every source except the communities: last 7 days vs the weekly average of the 3 weeks before</p>${changeBars(S0.genres)}</section>`;
  }
  function sourcesDialog(api, S0) {
    const c = S0.cfg, E = esc;
    api.ui.modal('Sources', `<div class="mr-dlg">
      <p class="mr-small">Checked after every scan, or with Check sources. Each one is free; Last.fm uses the key on the NAS.</p>
      ${S0.list.map(x => `<label class="mr-srcrow"><input type="checkbox" data-on="${x.id}" ${c.on[x.id] ? 'checked' : ''}> <b>${E(x.name)}</b> <span class="mr-small">${E(x.kind)}${x.missing ? ' · needs ' + E(x.needs) : ''}</span></label>`).join('')}
      <div class="field"><label>ListenBrainz username (adds releases picked for you)</label><input class="inp" id="mr-lb" value="${E(c.lbUser || '')}" placeholder="optional"></div>
      <div class="field"><label>Apple Music chart country</label><input class="inp" id="mr-cc" value="${E(c.appleCountry || 'ca')}" maxlength="2" style="width:5em"></div>
      <div class="field"><label>Tags for Bandcamp and Last.fm (comma separated)</label><input class="inp" id="mr-tags" value="${E((c.tags || []).join(', '))}" placeholder="${E((c.tagsUsed || []).join(', '))}"><div class="mr-small">Empty uses your taste: genres of picks you liked, then a starter set.</div></div>
      <div class="field"><label>Blogs and magazines (one per line: name | feed address | small or big). Small blogs count for more; big outlets count for less.</label><textarea class="inp" id="mr-blogs" rows="7" style="font-family:var(--mono);font-size:12px">${E((c.blogs || []).map(b => `${b.name} | ${b.url}${b.tier ? ' | ' + b.tier : ''}`).join('\n'))}</textarea></div>
    </div>`, `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="mr-srcsave">Save</button>`);
    document.getElementById('mr-srcsave').onclick = async () => {
      const q = id => document.getElementById(id);
      const on = {}; document.querySelectorAll('.mr-dlg [data-on]').forEach(b => { on[b.dataset.on] = b.checked; });
      const blogs = q('mr-blogs').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const [a, b, c] = l.includes('|') ? l.split('|') : ['', l]; const tier = (c || '').trim().toLowerCase(); return { name: a.trim(), url: (b || '').trim(), ...(tier === 'big' || tier === 'small' ? { tier } : {}) }; }).filter(b => /^https?:\/\//.test(b.url));
      await fetch('api/radar/sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on, lbUser: q('mr-lb').value, appleCountry: q('mr-cc').value, tags: q('mr-tags').value.split(',').map(t => t.trim()).filter(Boolean), blogs }) });
      api.ui.close(); api.ui.toast('Sources saved'); window.__radar.load();
    };
  }

  Cadence.registerPlugin({
    id: 'music-radar', name: 'Music Radar', version: '1.0.0', category: 'Life', spaces: ['life'],
    description: 'Finds up-and-coming artists, songs and albums from indie blogs, campus radio, charts and music communities on Lemmy and Mastodon, tracks what\'s rising, and learns your taste from thumbs up and down. Runs on your NAS: a scan every 6 hours and a weekly digest, an RSS feed, optional phone alerts and a Spotify playlist.',
    tagline: 'Up-and-coming music before it breaks', color: '#3b82f6',
    icon: '<path d="M19.07 4.93A10 10 0 0 0 6.99 3.34M4 6h.01M2.29 9.62A10 10 0 1 0 21.31 8.35M16.24 7.76A6 6 0 1 0 8.23 16.67M12 18h.01M17.99 11.66A6 6 0 0 1 15.77 16.67"/><circle cx="12" cy="12" r="2"/><path d="m13.41 10.59 5.66-5.66"/>',
    setup(api) {
      const G = { d: null, st: null, years: 'year', year: null, all: false, poll: 0, src: 'all', feed: '', multi: true };
      const get = async u => { const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error(r.status); return r.json(); };
      const post = async (u, b) => { const r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) }); return r.json(); };
      async function load() {
        if (api.system().mode !== 'nas') return;
        try { [G.st, G.d, G.comm] = await Promise.all([get('api/radar/status'), get('api/radar/data'), get('api/radar/community').catch(() => G.comm || null)]); } catch (e) { G.err = e.message; }
        if (api.ui.currentRoute() === 'view-radar') api.ui.refresh();
        clearTimeout(G.poll); if (G.st && G.st.job) G.poll = setTimeout(load, 3000);   // a scan is running: check back
      }
      window.__radar = { load, get G() { return G; } };

      api.views.add({ id: 'radar', title: 'Music Radar', icon: '📡', subtitle: 'Up-and-coming music before it breaks', wide: true, render: el => {
        if (api.system().mode !== 'nas') { el.innerHTML = empty('Music Radar runs on your NAS. Open Cadence from the NAS to use it.'); return; }
        if (!G.d || !G.st) { el.innerHTML = empty('Loading…'); load(); return; }
        const D = G.d, S = G.st, ic = n => api.ui.icon(n);
        const hot = D.genres.find(g => g.change != null && g.change > 0) || D.genres[0];
        const risers = D.rise.risers.filter(r => r.delta > 0).slice(0, 10);
        const picks = G.all ? D.picks : D.picks.slice(0, 15);
        const keys = S.keys, setupRow = (on, name, what) => `<li class="${on ? 'on' : ''}">${ic(on ? 'circle-check' : 'circle')}<code>${name}</code> ${what}</li>`;
        el.innerHTML = `
          <div class="mr-top">
            <label class="mr-switch"><input type="checkbox" id="mr-on" ${S.on ? 'checked' : ''}> Scan every 6 hours, digest weekly</label>
            <span class="mr-status">${S.job ? `${ic('loader')} ${esc(S.job.kind)} running…` : `Last scan ${esc(ago(S.lastScan || (D.generatedAt && Date.parse(D.generatedAt))))}`}</span>
            <span class="mr-actions">
              <button class="btn" id="mr-scan" ${S.job ? 'disabled' : ''}>${ic('radar')}Scan now</button>
              <button class="btn" id="mr-digest" ${S.job ? 'disabled' : ''}>${ic('mail')}Write the digest</button>
              <a class="btn" href="api/radar/feed.xml" target="_blank" rel="noopener">${ic('rss')}RSS feed</a>
              ${D.spotify.connected ? (D.spotify.url ? `<a class="btn" href="${esc(D.spotify.url)}" target="_blank" rel="noopener">${ic('music')}Spotify playlist</a>` : '') : D.spotify.app ? `<a class="btn" href="api/radar/spotify/login">${ic('music')}Connect Spotify</a>` : ''}
            </span>
          </div>
          ${S.lastError && !S.job ? `<div class="mr-problem">${ic('circle-alert')}<div><b>The last run had a problem</b><div>${esc(S.lastError)}</div><a href="#view-db" id="mr-log">See the job log in Database</a></div></div>` : ''}
          <div class="mr-tiles">
            <div class="mr-tile"><b>${fmt(D.picksThisWeek)}</b><span>Picks this week</span></div>
            <div class="mr-tile"><b>${fmt(D.artistsTracked)}</b><span>Artists tracked</span></div>
            <div class="mr-tile"><b>${esc(hot ? hot.name : '–')}</b><span>Hottest genre this week</span></div>
            <div class="mr-tile"><b>${D.trackRecord.hitRate == null ? '–' : Math.round(D.trackRecord.hitRate * 100) + '%'}</b><span>Track record (hit rate)</span></div>
          </div>
          <div class="mr-grid">
            ${(() => { const W = window.CadencePreview && window.CadencePreview.want, list = W ? W.peek() : [];
              return list.length ? `<section class="mr-card w12 mr-want"><div class="mr-row" style="justify-content:space-between"><div><h3>Want to hear</h3><p class="mr-sub">What you saved, newest first</p></div>
                <span class="mr-row"><button class="btn" id="mr-wantall">${ic('play')}Play all previews</button><a class="btn" href="#view-want">See all ${list.length}</a></span></div>
                <ul class="mr-wl">${list.slice(0, 5).map(x => `<li>${pv(x.artist, x.title, x.type, x.from)} ${an(x.artist, true)}${x.title ? ' — ' + esc(x.title) : ''}</li>`).join('')}</ul></section>` : ''; })()}
            <section class="mr-card w12"><div class="mr-row" style="justify-content:space-between"><div><h3>Said the Gramophone, every year</h3><p class="mr-sub">A Montreal blog's 100 favourite songs and best albums of each year since 2005, and the artists it keeps coming back to</p></div><a class="btn" href="#view-stg">Open</a></div></section>
            <section class="mr-card w8"><h3>Who's climbing</h3><p class="mr-sub">${D.allSources ? 'Daily buzz from every source (blogs, KEXP, campus radio, charts, Bandcamp, Lemmy and Mastodon), last 14 days' : 'Daily buzz score, last 14 days'}: the 6 artists buzzing most right now.</p>
              ${D.rise.top.length ? lineChart(D.rise.labels, D.rise.top.map(r => ({ label: r.artist, data: r.series })), { unit: 'buzz' }) : empty('Scan a few times to see trends.')}</section>
            <section class="mr-card w4"><h3>Fastest risers</h3><p class="mr-sub">Buzz now vs a week ago${D.allSources ? ', and where it came from this week' : ''}</p>
              ${risers.length ? `<table class="mr-t"><tr><th>Artist</th><th class="n">Week ago</th><th class="n">Now</th><th></th></tr>${risers.map(r => `<tr><td>${an(r.artist, false)} ${pv(r.artist, null, null, 'Music Radar')}${r.sources && r.sources.length ? `<div class="mr-small">${esc(r.sources.join(', '))}</div>` : ''}</td><td class="n">${Math.round(r.weekAgo)}</td><td class="n">${Math.round(r.cur)}</td><td><span class="chip">${STATUS[r.status]}</span></td></tr>`).join('')}</table>` : empty('Nothing rising yet.')}</section>
            <section class="mr-card w6"><h3>Genres blowing up</h3><p class="mr-sub">${D.allSources ? 'Every source: l' : 'L'}ast 7 days vs the weekly average of the 3 weeks before</p>${changeBars(D.genres)}</section>
            <section class="mr-card w6"><h3>New scenes and buzzwords</h3><p class="mr-sub">Phrases from Lemmy and Mastodon comments, same comparison</p>${changeBars(D.buzz)}</section>
            <section class="mr-card w6"><h3>Albums and EPs blowing up</h3><p class="mr-sub">${D.allSources ? 'Reviews, KEXP, campus radio, Bandcamp and community posts in the last 7 days' : 'Best buzz score in the last 7 days'}</p>
              ${D.albums.length ? `<table class="mr-t"><tr><th>Release</th><th>Where</th><th class="n">Score</th></tr>${D.albums.map(a => `<tr><td>${pv(a.artist, a.album, a.type, 'Music Radar')} ${an(a.artist, false)} — ${a.link ? `<a href="${esc(a.link)}" target="_blank" rel="noopener">${esc(a.album)}</a>` : esc(a.album)} <span class="chip">${esc(a.type)}</span></td><td class="mr-small">${esc((a.subs || []).join(', '))}</td><td class="n">${Math.round(a.score)}</td></tr>`).join('')}</table>` : empty('No albums or EPs mentioned in the last week.')}</section>
            <section class="mr-card w6"><h3>Which communities find artists first</h3><p class="mr-sub">How often each community posted a shared artist first. Early ones count more in scoring.</p>
              ${D.subLead.length ? `<div class="mr-bars">${D.subLead.map(s => `<div class="mr-bar" title="first on ${Math.round(s.firstShare * 100)}% of ${s.samples} shared artists${s.avgLeadHours ? `, ~${Math.round(s.avgLeadHours)}h ahead` : ''}"><span class="mr-bl">${esc(s.sub)}</span><span class="mr-bt"><i class="up" style="left:0;width:${Math.round(s.firstShare * 100)}%"></i></span><span class="mr-bv">${Math.round(s.firstShare * 100)}%</span></div>`).join('')}</div>` : empty('Needs artists that show up in 2 or more communities.')}</section>
            <section class="mr-card w12"><h3>"Sounds like" map</h3><p class="mr-sub">Comparisons people make in comments. Bigger dot = compared more often. Ringed = artists you liked. Hover a dot for who it's compared with.</p>${graph(D.graph)}</section>
            ${sourcesCard(D.sources, ic, G)}
            <section class="mr-card w8"><h3>Recent picks</h3><p class="mr-sub">Thumbs up and down teach the radar your taste</p>
              ${D.picks.length ? picks.map(p => `<div class="mr-pick">${artImg(p).replace('mr-art', 'mr-art big')}<div class="mr-pb">${p.artist ? an(p.artist) : ''} ${pv(p.artist, p.song, p.type, (p.subs || [])[0] || 'Music Radar')} — <a href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.song || 'recommended in comments')}</a>${p.type && p.type !== 'track' ? ` <span class="chip">${esc(p.type)}</span>` : ''}${relNote(p)}
                  ${(p.genres || []).slice(0, 3).map(g => `<span class="chip">${esc(g)}</span>`).join(' ')}${(p.alsoOn || []).length ? ` <span class="mr-small">also on</span> ${p.alsoOn.map(srcPill).join(' ')}` : ''}<div class="mr-small">${esc(p.blurb)} · <a href="${esc(p.thread)}" target="_blank" rel="noopener">thread</a></div></div>
                <div class="mr-fb"><button class="${p.feedback === 1 ? 'on' : ''}" data-fb="${esc(p.id)}" data-v="1" data-cur="${p.feedback}" aria-label="More like this">${ic('thumbs-up')}</button><button class="${p.feedback === -1 ? 'on' : ''}" data-fb="${esc(p.id)}" data-v="-1" data-cur="${p.feedback}" aria-label="Not for me">${ic('thumbs-down')}</button></div></div>`).join('')
                + (D.picks.length > 15 && !G.all ? `<p><button class="btn" id="mr-all">Show all ${D.picks.length}</button></p>` : '') : empty('No picks yet. Press Scan now, or switch the radar on.')}</section>
            ${G.comm ? `<section class="mr-card w4" id="mr-comm"><h3>Where it listens</h3><p class="mr-sub">Community posts the radar reads, besides the other sources. No accounts or keys.</p>
              <label class="mr-small">Lemmy communities (one per line, name@server)</label>
              <textarea class="inp mr-ta" id="mr-lemmy" rows="5" spellcheck="false">${esc(G.comm.communities.join('\n'))}</textarea>
              <label class="mr-small">Mastodon hashtags (one per line)</label>
              <textarea class="inp mr-ta" id="mr-tags" rows="3" spellcheck="false">${esc(G.comm.tags.join('\n'))}</textarea>
              <h4>Hide mainstream artists</h4>
              <label class="mr-small mr-chk"><input type="checkbox" id="mr-ms-on" ${G.comm.mainstream.on ? 'checked' : ''}> Hide them everywhere on this page${D.mainstream && D.mainstream.hiding ? ` (${D.mainstream.hiding} hidden now)` : ''}</label>
              <label class="mr-small mr-chk"><input type="checkbox" id="mr-ms-charts" ${G.comm.mainstream.charts ? 'checked' : ''}> Anyone on the Apple Music chart</label>
              <label class="mr-small mr-chk">Anyone with more than <input class="inp mr-num" id="mr-ms-l" type="number" min="0" step="100000" value="${G.comm.mainstream.listeners}"> Last.fm listeners${G.st && G.st.keys && G.st.keys.lastfm ? '' : ' (needs LASTFM_API_KEY)'}</label>
              <label class="mr-small">And these artists (one per line)</label>
              <textarea class="inp mr-ta" id="mr-ms-list" rows="6" spellcheck="false">${esc(G.comm.mainstream.list.join('\n'))}</textarea>
              <div class="mr-row"><button class="btn" id="mr-comm-save">Save</button><span class="mr-small">Takes effect on the next scan; the mainstream filter right away.</span></div>
            </section>` : ''}
            <section class="mr-card w4"><h3>What it's learned</h3>
              <div class="mr-small">${D.taste.liked + D.taste.disliked ? `${D.taste.liked} liked · ${D.taste.disliked} not for me<br>${Object.entries(D.taste.genres).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([g, w]) => `${esc(g)} ×${w}`).join(' · ')}` : 'Rate a few picks and it starts weighting genres and subreddits.'}</div></section>
            <section class="mr-card w6"><h3>Track record</h3><p class="mr-sub">Picks from 30+ days ago: did their Last.fm listeners grow 25% or more?</p>
              ${D.trackRecord.checked ? `<p>${D.trackRecord.hits} of ${D.trackRecord.checked} checked picks were hits.</p><table class="mr-t"><tr><th>Artist</th><th class="n">Then</th><th class="n">Now</th><th class="n">Growth</th></tr>${D.trackRecord.best.map(b => `<tr><td>${esc(b.artist)}</td><td class="n">${fmt(b.before)}</td><td class="n">${fmt(b.now)}</td><td class="n">${pct(b.growth)}</td></tr>`).join('')}</table>` : empty('Needs a Last.fm key and picks that are 30+ days old.')}</section>
            <section class="mr-card w6"><h3>Weekly digests</h3>
              ${D.digests.length ? `<table class="mr-t">${D.digests.map(d => `<tr><td><a href="api/radar/digests/${esc(d.file)}" target="_blank" rel="noopener">${esc(plain(d.title))}</a></td></tr>`).join('')}</table>` : empty('The first digest comes a week after the first scan.')}
              <details class="mr-setup"><summary>Setup: optional keys on the NAS</summary>
                <p class="mr-small">Everything works without them; each one unlocks more. Add them to the NAS <code>.env</code>; they never leave the NAS.</p>
                <ul>${setupRow(keys.ai, 'ANTHROPIC_API_KEY', 'Claude reads posts and comments: better artists and genres, "sounds like" pairs, nicer blurbs and digest')}
                  ${setupRow(keys.lastfm, 'LASTFM_API_KEY', 'real listener counts (small-but-buzzing gets boosted), track record')}
                  ${setupRow(keys.ntfy, 'NTFY_TOPIC', 'phone alerts when an artist spikes, plus the weekly digest')}
                  ${setupRow(keys.spotify, 'SPOTIFY_CLIENT_ID / _SECRET', `a "Music Radar" playlist. Redirect address: <code id="mr-redir">…</code>`)}</ul>
                ${S.log && S.log.length ? `<pre class="mr-log">${esc(S.log.join('\n'))}</pre>` : ''}</details></section>
          </div>`;
        const $ = s => el.querySelector(s);
        $('#mr-on').onchange = async e => { G.st = await post('api/radar/settings', { on: e.target.checked }); api.ui.toast(e.target.checked ? 'Music Radar is on: it scans every 6 hours' : 'Music Radar is off'); api.ui.refresh(); };
        $('#mr-scan').onclick = async () => { G.st = await post('api/radar/run', { what: 'scan' }); api.ui.toast('Scanning. It takes a few minutes; this page updates when it\'s done.'); load(); };
        $('#mr-digest').onclick = async () => { G.st = await post('api/radar/run', { what: 'digest' }); load(); };
        const lg = $('#mr-log'); if (lg) lg.onclick = () => { (window.__dbv = window.__dbv || {}).want = 'sql:radar_jobs'; };
        el.querySelectorAll('[data-fb]').forEach(b => b.onclick = async () => { const v = +b.dataset.v, cur = +b.dataset.cur; await post('api/radar/feedback', { id: b.dataset.fb, v: cur === v ? 0 : v }); load(); });
        const wa = $('#mr-wantall'); if (wa) wa.onclick = () => window.CadencePreview.playAll(window.CadencePreview.want.peek());
        const cs = $('#mr-comm-save'); if (cs) cs.onclick = async () => {
          G.comm = await post('api/radar/community', { communities: $('#mr-lemmy').value, tags: $('#mr-tags').value,
            mainstream: { on: $('#mr-ms-on').checked, charts: $('#mr-ms-charts').checked, listeners: +$('#mr-ms-l').value, list: $('#mr-ms-list').value } });
          api.ui.toast('Saved'); load();
        };
        el.querySelectorAll('#mr-srctabs [data-src]').forEach(b => b.onclick = () => { G.src = b.dataset.src; G.feed = ''; api.ui.refresh(); });
        el.querySelectorAll('[data-feed]').forEach(b => b.onclick = () => { G.feed = b.dataset.feed; api.ui.refresh(); });
        const mm = $('#mr-multi'); if (mm) mm.onchange = () => { G.multi = mm.checked; api.ui.refresh(); };
        const sn = $('#mr-srcnow'); if (sn) { sn.disabled = !!S.job; sn.onclick = async () => { G.st = await post('api/radar/run', { what: 'sources' }); api.ui.toast('Checking sources. This page updates when it\'s done.'); load(); }; }
        const ss = $('#mr-srcset'); if (ss) ss.onclick = () => sourcesDialog(api, D.sources);
        const all = $('#mr-all'); if (all) all.onclick = () => { G.all = true; api.ui.refresh(); };
        const det = $('.mr-setup'); if (det) det.ontoggle = () => { if (det.open) get('api/radar/spotify').then(r => { const c = el.querySelector('#mr-redir'); if (c) c.textContent = r.redirect; }).catch(() => {}); };
      } });
      api.commands.add({ title: '📡 Music Radar', run: () => api.ui.navigate('view-radar') });
      api.on('refocus', () => { if (api.ui.currentRoute() === 'view-radar') load(); });

      css('mr-css', `
        .mr-top{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;margin:0 0 16px}
        .mr-switch{display:flex;align-items:center;gap:8px;font-weight:600;font-size:13px}
        .mr-status{color:var(--muted);font-size:13px;display:inline-flex;align-items:center;gap:6px}.mr-status svg{width:14px;height:14px}.mr-err{color:var(--danger)}
        .mr-actions{display:flex;flex-wrap:wrap;gap:6px;margin-left:auto}.mr-actions .btn{color:var(--text);display:inline-flex;align-items:center;gap:6px;text-decoration:none}.mr-actions svg{width:15px;height:15px}
        .mr-note{display:flex;align-items:center;gap:6px;margin:0 0 10px}.mr-note svg{width:14px;height:14px;flex:none}
        .mr-problem{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line);border-left:3px solid var(--client);border-radius:var(--r-l);background:var(--panel);padding:12px 14px;margin:0 0 16px;font-size:13px}.mr-problem svg{width:18px;height:18px;flex:none;color:var(--client);margin-top:1px}.mr-problem div div{color:var(--muted);margin:2px 0 4px}.mr-problem a{color:var(--accent);font-size:12.5px}
        .mr-src{display:inline-block;font-size:11px;font-weight:600;padding:1px 7px;border-radius:999px;color:var(--c);background:color-mix(in srgb,var(--c) 13%,transparent);white-space:nowrap;margin:1px 0}
        .mr-tabs{margin:4px 0 12px;flex-wrap:wrap;height:auto}.mr-tabs button{display:inline-flex;align-items:center;gap:5px}.mr-n{font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums}.mr-n.bad{color:var(--client)}
        .mr-warn{color:var(--client)}.mr-chip{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:2px 10px;font-size:12px;cursor:pointer;color:var(--text)}.mr-chip.on{border-color:var(--accent);color:var(--accent)}
        .mr-score{display:inline-block;width:60px;height:6px;border-radius:3px;background:color-mix(in srgb,var(--text) 7%,transparent);margin-right:8px;vertical-align:middle;position:relative;overflow:hidden}.mr-score i{position:absolute;inset:0 auto 0 0;background:var(--accent);border-radius:3px}
        .mr-dlg{display:flex;flex-direction:column;gap:8px}.mr-srcrow{display:flex;align-items:center;gap:8px;font-size:13px}.mr-dlg .field{margin-top:6px}
        .mr-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}
        .mr-tile{border:1px solid var(--line);border-radius:var(--r-l);background:var(--panel);padding:12px 14px;display:flex;flex-direction:column;gap:2px;min-width:0}
        .mr-tile b{font-size:22px;font-weight:600;letter-spacing:-.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mr-tile span{font-size:12px;color:var(--muted)}
        .mr-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:14px}
        .mr-card{grid-column:span 12;border:1px solid var(--line);border-radius:var(--r-l);background:var(--panel);padding:14px 16px;min-width:0}
        .mr-card.w8{grid-column:span 8}.mr-card.w6{grid-column:span 6}.mr-card.w4{grid-column:span 4}
        @media (max-width:1000px){.mr-card.w8,.mr-card.w6,.mr-card.w4{grid-column:span 12}.mr-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}
        .mr-card h3{margin:0;font-size:14px}.mr-card h4{margin:14px 0 2px;font-size:13px}.mr-sub{margin:2px 0 10px;color:var(--muted);font-size:13px}
        .mr-small{font-size:12px;color:var(--muted)}.mr-empty{color:var(--muted);font-size:13px;padding:18px 0;text-align:center}
        .mr-chart svg{width:100%;height:auto;display:block}.mr-grid line.mr-grid,.mr-chart .mr-grid{stroke:var(--line);stroke-width:1}
        .mr-ax{fill:var(--muted);font:10.5px Inter,system-ui}.mr-legend{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:var(--muted);margin-top:6px}.mr-legend i{display:inline-block;width:14px;height:3px;border-radius:2px;margin-right:6px;vertical-align:middle}
        .mr-t{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}.mr-t th{text-align:left;font-weight:500;font-size:12px;color:var(--muted);padding:4px 6px;border-bottom:1px solid var(--line)}.mr-t td{padding:6px;border-bottom:1px solid var(--line);vertical-align:top}.mr-t .n{text-align:right}
        .mr-t a,.mr-pick a{color:var(--text);text-decoration:none}.mr-t a:hover,.mr-pick a:hover{text-decoration:underline}
        .mr-bars{display:flex;flex-direction:column;gap:6px}.mr-bar{display:grid;grid-template-columns:minmax(0,9rem) 1fr 3.5rem;align-items:center;gap:8px;font-size:13px}
        .mr-bl{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mr-bv{text-align:right;color:var(--muted);font-variant-numeric:tabular-nums}
        .mr-bt{position:relative;height:12px;border-radius:3px;background:color-mix(in srgb,var(--text) 5%,transparent)}.mr-bt i{position:absolute;top:0;bottom:0;border-radius:3px}.mr-bt i.up{background:#3b82f6}.mr-bt i.dn{background:#a3a3a3}
        .mr-graph{width:100%;height:auto;display:block}.mr-edge{stroke:var(--line)}.mr-node{fill:#3b82f6;stroke:var(--panel);stroke-width:2}.mr-node.liked{stroke:#f97316;stroke-width:3}.mr-gl{fill:var(--muted);font:11px Inter,system-ui;pointer-events:none}
        .mr-pick{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}
        .mr-wl{list-style:none;padding:0;margin:6px 0 0;display:flex;flex-direction:column;gap:4px;font-size:14px}
        .mr-ta{width:100%;font:12px/1.4 ui-monospace,monospace;margin:2px 0 8px;resize:vertical} .mr-chk{display:flex;align-items:center;gap:6px;margin:4px 0} .mr-num{width:110px;padding:2px 6px}
        .mr-art{width:36px;height:36px;border-radius:4px;object-fit:cover;flex:none;background:var(--line)} .mr-art.big{width:56px;height:56px;border-radius:6px}
        .mr-withart{display:flex;align-items:center;gap:8px}.mr-pb{flex:1;min-width:0}
        .mr-fb{display:flex;gap:4px;align-items:flex-start}.mr-fb button{border:1px solid var(--line);background:var(--panel);border-radius:var(--r-m);width:34px;height:32px;display:grid;place-items:center;cursor:pointer;color:var(--muted)}
        .mr-fb button svg{width:15px;height:15px}.mr-fb button.on{border-color:var(--accent);color:var(--accent);background:var(--accent-soft)}
        .mr-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}.mr-sc{display:inline-flex;align-items:center;gap:2px;border:1px solid var(--line);border-radius:999px;padding:2px 2px 2px 10px;font-size:13px}
        .mr-sc button{border:0;background:none;color:var(--muted);cursor:pointer;display:grid;place-items:center;width:22px;height:22px}.mr-sc button svg{width:12px;height:12px}
        .mr-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.mr-row .inp{flex:1;min-width:8rem}
        .mr-setup{margin-top:14px}.mr-setup summary{cursor:pointer;font-size:13px;color:var(--muted)}.mr-setup ul{list-style:none;padding:0;margin:8px 0;display:flex;flex-direction:column;gap:6px;font-size:13px}
        .mr-setup li{display:flex;gap:6px;align-items:flex-start;color:var(--muted)}.mr-setup li.on{color:var(--text)}.mr-setup li svg{width:14px;height:14px;flex:none;margin-top:2px}
        .mr-log{font:11px var(--mono);background:var(--bg);border:1px solid var(--line);border-radius:var(--r-m);padding:8px;max-height:160px;overflow:auto;white-space:pre-wrap}`);
    }
  });
})();
