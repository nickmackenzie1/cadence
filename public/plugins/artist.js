/* Artist page (user, 2026-11-16): one artist, everything Cadence knows, from api/radar/artist. Any element with
   data-artist="Name" anywhere in the app opens it (Radar, KEXP history, Radio). MusicBrainz details are looked up in the
   background on the NAS the first time, so the page fills in a few seconds later. */
(() => {
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const A = (u, t, cls = '') => `<a ${cls ? `class="${cls}" ` : ''}href="${E(u)}" target="_blank" rel="noopener">${t}</a>`;
  const LINK_NAMES = { bandcamp: 'Bandcamp', website: 'Website', wikipedia: 'Wikipedia', instagram: 'Instagram', youtube: 'YouTube', spotify: 'Spotify', apple: 'Apple Music', soundcloud: 'SoundCloud', bluesky: 'Bluesky', mastodon: 'Mastodon' };
  const day = ts => new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const year = d => d ? String(d).slice(0, 4) : '';
  let current = null;
  window.CadenceArtist = { open(name) { if (!name) return; current = String(name); try { const r = JSON.parse(localStorage.getItem('cadence.recentArtists') || '[]').filter(x => x.toLowerCase() !== current.toLowerCase()); localStorage.setItem('cadence.recentArtists', JSON.stringify([current, ...r].slice(0, 40))); } catch (e) {} try { sessionStorage.setItem('cadence.artist', current); } catch (e) {} if (location.hash === '#view-artist') window.dispatchEvent(new Event('cadence-artist')); else location.hash = 'view-artist'; } };
  // ---- listening: 30-second previews (Deezer, via the NAS) in the shared player, and Want to hear ----
  const P = () => window.CadencePodcasts;
  const PV = { queue: [], want: null, wantAt: 0, toast: m => {} };
  const key = (a, t) => (String(a) + '|' + (t || '')).toLowerCase();
  const wantList = async (force) => { if (!force && PV.want && Date.now() - PV.wantAt < 30e3) return PV.want; try { PV.want = await (await fetch('api/radar/want')).json(); PV.wantAt = Date.now(); } catch (e) { PV.want = PV.want || []; } return PV.want; };
  const wantPost = async body => { PV.want = await (await fetch('api/radar/want', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); PV.wantAt = Date.now(); window.dispatchEvent(new Event('cadence-want')); return PV.want; };
  const playOne = async (artist, title) => {
    const p = P(); if (!p) return;
    let v; try { v = await (await fetch(`api/radar/preview?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title || '')}`)).json(); } catch (e) { v = null; }
    if (!v || !v.found) { PV.toast(`No preview found for ${artist}${title ? ' – ' + title : ''}`); return false; }
    p.load({ uuid: 'preview:' + key(v.artist, v.title), preview: true, title: v.title, podcastTitle: v.artist, url: v.preview, art: v.cover, link: v.link, from: { artist, title } }, true);
    return true;
  };
  window.CadencePreview = {
    play: (artist, title) => { PV.queue = []; return playOne(artist, title); },
    // play a list in order (Want to hear → Play all); skips ones without a preview
    playAll: async (items) => { PV.queue = items.slice(); while (PV.queue.length) { const n = PV.queue.shift(); if (await playOne(n.artist, n.title)) break; } },
    want: { peek: () => PV.want || [], list: wantList, has: (a, t) => !!(PV.want || []).find(x => key(x.artist, x.title) === key(a, t)), add: it => wantPost({ add: it }), remove: it => wantPost({ remove: it }) },
  };
  const hook = () => { const p = P(); if (!p || p.onPreviewEnded) return;
    p.onPreviewEnded = async () => { while (PV.queue.length) { const n = PV.queue.shift(); if (await playOne(n.artist, n.title)) return; } };
    p.hasNextPreview = () => PV.queue.length > 0; };
  // buttons any page can drop next to a pick: <button data-pv data-a="…" data-t="…"> and <button data-want …>
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-pv],[data-want]'); if (!b) return;
    e.preventDefault(); e.stopPropagation(); hook();
    const a = b.dataset.a, t = b.dataset.t || null;
    if (b.hasAttribute('data-pv')) { b.classList.add('pv-busy'); await window.CadencePreview.play(a, t); b.classList.remove('pv-busy'); }
    else { const on = window.CadencePreview.want.has(a, t); await (on ? window.CadencePreview.want.remove({ artist: a, title: t }) : window.CadencePreview.want.add({ artist: a, title: t, type: b.dataset.type || null, from: b.dataset.from || null }));
      PV.toast(on ? 'Removed from Want to hear' : 'Saved to Want to hear'); }
  }, true);
  wantList();

  // any artist name in the app: <… data-artist="Name">
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-artist]'); if (!el || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
    e.preventDefault(); e.stopPropagation(); window.CadenceArtist.open(el.dataset.artist);
  }, true);

  Cadence.registerPlugin({
    id: 'artist-page', name: 'Artist pages', version: '1.0.0', category: 'Media', color: '#db2777',
    icon: '<circle cx="12" cy="8" r="4"/><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M18 4l2 2-2 2"/>',
    tagline: 'Everything about an artist on one page.',
    description: 'Click any artist name in Music Radar, Radio or KEXP history: where they\'re from, their releases with covers, every blog, chart and community talking about them, their KEXP plays and DJs, and links to Bandcamp and their site.',
    setup(api) {
      const G = {};
      PV.toast = m => api.ui.toast(m); hook();
      // play + want buttons for one pick (used by Music Radar and this page)
      window.CadencePreview.buttons = (artist, title, type, from) => { if (!artist) return ''; const on = window.CadencePreview.want.has(artist, title);
        return `<span class="pv-btns"><button class="pv-b" data-pv data-a="${E(artist)}" data-t="${E(title || '')}" aria-label="Play a preview of ${E(title || artist)}" title="Play a 30-second preview">${api.ui.icon('play')}</button><button class="pv-b${on ? ' on' : ''}" data-want data-a="${E(artist)}" data-t="${E(title || '')}" data-type="${E(type || '')}" data-from="${E(from || '')}" aria-label="${on ? 'Remove from' : 'Save to'} Want to hear" title="${on ? 'In Want to hear' : 'Save to Want to hear'}">${api.ui.icon(on ? 'bookmark-check' : 'bookmark-plus')}</button></span>`; };
      const onWant = () => { api.ui.refreshWidgets && api.ui.refreshWidgets(); const r = api.ui.currentRoute(); if (r === 'view-radar' || r === 'view-artist' || r === 'view-want') api.ui.refresh(); };
      window.addEventListener('cadence-want', onWant);
      // Said the Gramophone: Sean's 100 favourite songs and favourite albums of every year since 2005, read from the blog
      const SG = { d: null, year: null, tab: 'artists', at: 0 };
      const sgLoad = async (year) => { try { SG.d = await (await fetch('api/radar/stg' + (year ? '?year=' + year : ''))).json(); SG.at = Date.now(); } catch (e) { SG.d = SG.d || { err: true }; }
        if (api.ui.currentRoute() === 'view-stg') api.ui.refresh();
        if (SG.d && SG.d.status && SG.d.status.running) setTimeout(() => api.ui.currentRoute() === 'view-stg' && sgLoad(SG.year), 8000); };
      api.views.add({ id: 'stg', group: 'music', order: 50, title: 'Said the Gramophone', icon: '🎼', subtitle: 'Best songs and albums of every year, from the blog', render: el => {
        const d = SG.d;
        if (!d || Date.now() - SG.at > 60e3) { sgLoad(SG.year); if (!d) { el.innerHTML = '<p class="muted">Loading…</p>'; return; } }
        if (d.err) { el.innerHTML = '<p class="muted">The NAS didn\'t answer. Try again in a moment.</p>'; return; }
        const st = d.status, errs = Object.entries(st.errors || {});
        const head = `<p class="muted">${st.years.length ? `${st.years.length} years, ${st.songs.toLocaleString()} songs and ${st.albums} albums of the year` : 'Nothing read yet'}${st.running ? ' · reading the archive now, a page every few seconds…' : ''}
          ${!st.running ? ` · <button class="linkish" id="sg-again">Look again</button>` : ''}</p>
          ${!d.on && !st.years.length ? '<p class="muted">Reading the archive is switched off on this NAS (STG=0).</p>' : ''}
          ${errs.length ? `<details class="sg-err"><summary>${errs.length} year${errs.length === 1 ? '' : 's'} didn't read</summary><ul>${errs.map(([y, m]) => `<li>${y}: ${E(m)}</li>`).join('')}</ul></details>` : ''}`;
        const tabs = `<div class="sg-tabs"><button class="sg-c${SG.tab === 'artists' ? ' on' : ''}" data-sgt="artists">Most-loved artists</button>${d.years.map(y => `<button class="sg-c${SG.tab === 'year' && d.year === y ? ' on' : ''}" data-sgy="${y}">${y}</button>`).join('')}</div>`;
        let body = '';
        if (SG.tab === 'artists') {
          body = d.artists.length ? `<p class="muted">Artists who keep coming back: how many years they made his lists (songs or albums), and their best spot.</p>
            <ul class="sg-l">${d.artists.map(a => `<li><span class="sg-n">${a.n}</span><div><a class="ar-link" href="#view-artist" data-artist="${E(a.artist)}"><b>${E(a.artist)}</b></a>
              <span class="muted">${a.years.join(', ')}${a.best ? ` · best #${a.best}` : ''}${a.albums.length ? ` · ${a.albums.length} album${a.albums.length === 1 ? '' : 's'} of the year` : ''}</span></div>${window.CadencePreview.buttons(a.artist, (a.songs[0] || {}).title, null, 'Said the Gramophone')}</li>`).join('')}</ul>` : '<p class="muted">Once a few years are read, the artists he loves year after year show up here.</p>';
        } else if (d.list) {
          const L = d.list;
          body = `<p class="muted"><a href="${E(L.url)}" target="_blank" rel="noopener">Read the ${d.year} post</a> · <button class="linkish" id="sg-all">${api.ui.icon('play')}Play previews in order</button></p>
            ${L.albums.length ? `<h3>Favourite albums of ${d.year}</h3><ul class="sg-l">${L.albums.map(a => `<li>${window.CadencePreview.buttons(a.artist, a.title, 'album', 'Said the Gramophone ' + d.year)}<div><a class="ar-link" href="#view-artist" data-artist="${E(a.artist)}"><b>${E(a.artist)}</b></a> — ${E(a.title)}</div></li>`).join('')}</ul>` : ''}
            <h3>Best songs of ${d.year}</h3><ol class="sg-l sg-songs">${L.songs.map(x => `<li><span class="sg-n">${x.rank}</span>${window.CadencePreview.buttons(x.artist, x.title, 'song', 'Said the Gramophone ' + d.year)}<div><a class="ar-link" href="#view-artist" data-artist="${E(x.artist)}"><b>${E(x.artist)}</b></a> — ${E(x.title)}</div></li>`).join('')}</ol>`;
        }
        el.innerHTML = `<div class="sg">${head}${tabs}${body}</div>`;
        el.querySelectorAll('[data-sgy]').forEach(b => b.onclick = () => { SG.tab = 'year'; SG.year = +b.dataset.sgy; SG.at = 0; sgLoad(SG.year); });
        el.querySelectorAll('[data-sgt]').forEach(b => b.onclick = () => { SG.tab = 'artists'; api.ui.refresh(); });
        const again = el.querySelector('#sg-again'); if (again) again.onclick = async () => { await fetch('api/radar/stg', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: 'missing' }) }); api.ui.toast('Looking through the archive again'); setTimeout(() => sgLoad(SG.year), 1500); };
        const all = el.querySelector('#sg-all'); if (all) all.onclick = () => window.CadencePreview.playAll(d.list.songs.map(x => ({ artist: x.artist, title: x.title })));
      } });

      // Shows: concerts near home, the ones by artists you care about first (NAS: api/radar/shows)
      const SH = { d: null, at: 0, busy: false };
      const shLoad = async (extra = {}) => { SH.busy = true;
        let recent = []; try { recent = JSON.parse(localStorage.getItem('cadence.recentArtists') || '[]'); } catch (e) {}
        try { const r = await fetch('api/radar/shows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recent, ...extra }) }); SH.d = await r.json(); if (!r.ok) SH.d = { error: SH.d.error || 'HTTP ' + r.status }; }
        catch (e) { SH.d = { error: e.message }; }
        SH.busy = false; SH.at = Date.now(); if (api.ui.currentRoute() === 'view-shows') api.ui.refresh(); };
      const dateLabel = (d, t) => { if (!d) return 'Date to be announced'; const x = new Date(d + 'T' + (t || '12:00') + ':00');
        return x.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: x.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }) + (t ? ' · ' + x.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : ''); };
      const showRow = (e, full) => `<li><span class="sh-d">${E(dateLabel(e.date, e.time))}</span><div>
          ${e.artists.slice(0, 4).map((a, i) => `<a class="ar-link" href="#view-artist" data-artist="${E(a)}">${i ? E(a) : `<b>${E(a)}</b>`}</a>`).join(', ')}${e.artists.length > 4 ? ' and more' : ''}
          <span class="muted">${E([e.venue, e.city, e.km != null ? e.km + ' km away' : null, e.price].filter(Boolean).join(' · '))}${e.url ? ` · <a href="${E(e.url)}" target="_blank" rel="noopener">Details</a>` : ''}</span>
          ${full && e.match ? `<span class="sh-why">${E(e.match.why)}</span>` : ''}</div>${full && e.match ? window.CadencePreview.buttons(e.match.name, null, 'artist', 'Shows') : ''}</li>`;
      api.views.add({ id: 'shows', group: 'music', order: 45, title: 'Shows', icon: '🗓', subtitle: 'Concerts near home, by artists you care about first', render: el => {
        const d = SH.d;
        if (!d || Date.now() - SH.at > 10 * 60e3) { if (!SH.busy) shLoad(); if (!d) { el.innerHTML = '<p class="muted">Looking for shows… (the first look can take a minute)</p>'; return; } }
        if (d.error) { el.innerHTML = `<p class="muted">Couldn't check for shows: ${E(d.error)}</p>`; return; }
        const c = d.cfg, k = d.keys;
        const dist = [[50, '50 km'], [100, '100 km: Kingston, Belleville, Gananoque'], [200, '200 km: adds Ottawa and Peterborough'], [300, '300 km: adds Toronto and Montreal']];
        const noKey = d.note === 'needs a key';
        const setup = `<details class="sh-set" ${noKey ? 'open' : ''}><summary>Where the shows come from</summary>
          <p class="muted">Kingston Live needs nothing. The other two are free, each with its own key in the NAS <code>.env</code> (the NAS picks up a changed .env on its next update check):</p>
          <ul><li>${k.kingstonlive ? api.ui.icon('circle-check') : api.ui.icon('circle')}<div><b>Kingston Live</b>: the volunteer-run listings for Kingston${k.kingstonlive ? ' (used when Kingston is inside your circle)' : ' (turned off with KINGSTONLIVE=0)'}</div></li><li>${k.ticketmaster ? api.ui.icon('circle-check') : api.ui.icon('circle')}<div><b>Ticketmaster</b>: every concert near you. Sign up at <a href="https://developer.ticketmaster.com" target="_blank" rel="noopener">developer.ticketmaster.com</a>, open My Apps, copy the Consumer Key, and add <code>TICKETMASTER_API_KEY=…</code></div></li>
            <li>${k.bandsintown ? api.ui.icon('circle-check') : api.ui.icon('circle')}<div><b>Bandsintown</b>: tour dates for the artists you care about, including smaller venues. Bandsintown gives app IDs on request; add <code>BANDSINTOWN_APP_ID=…</code></div></li></ul></details>`;
        el.innerHTML = `<div class="sg sh">
          <div class="sh-bar"><label>Around ${E(c.place)}, within <select class="inp" id="sh-km">${dist.map(([v, l]) => `<option value="${v}" ${c.radiusKm === v ? 'selected' : ''}>${l}</option>`).join('')}${dist.some(x => x[0] === c.radiusKm) ? '' : `<option selected value="${c.radiusKm}">${c.radiusKm} km</option>`}</select></label>
            ${!noKey ? `<button class="linkish" id="sh-again">${api.ui.icon('refresh-cw')}Check again</button>` : ''}</div>
          ${noKey ? '<p>Shows need Kingston inside your circle, or a free key from Ticketmaster or Bandsintown. Here\'s how:</p>' + setup : `
          ${(d.errors || []).map(x => `<p class="muted">${E(x)}</p>`).join('')}
          <h3>By artists you care about</h3>
          ${d.matches.length ? `<ul class="sh-l">${d.matches.map(e => showRow(e, true)).join('')}</ul>` : '<p class="muted">Nobody from your lists is playing nearby right now. Shows by artists in Want to hear, climbing on Radar, played a lot on KEXP, or that you look up will show here.</p>'}
          ${d.nearby.length ? `<details class="sh-more"><summary>Everything else nearby (${d.nearby.length})</summary><ul class="sh-l">${d.nearby.map(e => showRow(e, false)).join('')}</ul></details>` : ''}
          ${setup}`}</div>`;
        const km = el.querySelector('#sh-km'); if (km) km.onchange = () => { SH.d = null; api.ui.refresh(); shLoad({ settings: { radiusKm: +km.value } }); };
        const ag = el.querySelector('#sh-again'); if (ag) ag.onclick = () => { api.ui.toast('Checking for shows'); shLoad({ refresh: true }); };
      } });

      // Artists: open any artist by name, the ones you looked at lately, and the ones in Want to hear
      api.views.add({ id: 'artists', group: 'music', order: 60, title: 'Artists', icon: '🎤', subtitle: 'Look anyone up, or go back to who you looked at', render: el => {
        let recent = []; try { recent = JSON.parse(localStorage.getItem('cadence.recentArtists') || '[]'); } catch (e) {}
        const saved = [...new Set((PV.want || []).map(x => x.artist))].filter(a => !recent.some(r => r.toLowerCase() === a.toLowerCase()));
        const chips = list => `<div class="ars">${list.map(a => `<a class="ar-chip" href="#view-artist" data-artist="${E(a)}">${E(a)}</a>`).join('')}</div>`;
        el.innerHTML = `<div class="sg"><form id="ar-find" class="ar-find"><input class="inp" id="ar-q" placeholder="Any artist or band" aria-label="Artist name" autocomplete="off"><button class="btn primary" type="submit">Look up</button></form>
          <h3>Looked at lately</h3>${recent.length ? chips(recent) : '<p class="muted">Artists you open from Radar, Radio or KEXP history show up here.</p>'}
          ${saved.length ? `<h3>From Want to hear</h3>${chips(saved)}` : ''}
          ${recent.length ? '<p><button class="linkish" id="ar-clear">Clear the list</button></p>' : ''}</div>`;
        el.querySelector('#ar-find').onsubmit = e => { e.preventDefault(); const q = el.querySelector('#ar-q').value.trim(); if (q) { window.CadenceArtist.open(q); location.hash = 'view-artist'; } };
        const c = el.querySelector('#ar-clear'); if (c) c.onclick = () => { localStorage.removeItem('cadence.recentArtists'); api.ui.refresh(); };
        if (!PV.want) wantList().then(() => api.ui.currentRoute() === 'view-artists' && api.ui.refresh());
      } });

      // the Want to hear page: everything you saved, to listen through
      api.views.add({ id: 'want', group: 'music', order: 40, title: 'Want to hear', icon: '🎧', subtitle: 'Music you saved to listen to', render: el => {
        const list = PV.want;
        if (!list) { el.innerHTML = '<p class="muted">Loading…</p>'; wantList(true).then(() => api.ui.refresh()); return; }
        el.innerHTML = `<div class="wh">${list.length ? `<button class="btn primary" id="wh-all">${api.ui.icon('play')}Play all previews</button>
          <ul class="wh-l">${list.map(x => `<li>${window.CadencePreview.buttons(x.artist, x.title, x.type, x.from)}<div><a class="ar-link" href="#view-artist" data-artist="${E(x.artist)}"><b>${E(x.artist)}</b></a>${x.title ? ' — ' + E(x.title) : ''}
            <span class="muted">${x.from ? 'from ' + E(x.from) + ' · ' : ''}saved ${new Date(x.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></div></li>`).join('')}</ul>`
          : '<p class="muted">Nothing saved yet. Use the bookmark next to any pick in Music Radar or on an artist page.</p>'}</div>`;
        const all = el.querySelector('#wh-all'); if (all) all.onclick = () => window.CadencePreview.playAll(list);
      } });
      const load = (name, force) => {
        const k = name.toLowerCase(), c = G[k];
        if (c && !force && (c.busy || Date.now() - c.at < 60e3)) return c.d;
        G[k] = { d: c && c.d, at: Date.now(), busy: true };
        fetch('api/radar/artist?name=' + encodeURIComponent(name)).then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
          .then(d => { G[k] = { d, at: Date.now() }; if (d && d.mbPending) setTimeout(() => { if (current && current.toLowerCase() === k && api.ui.currentRoute() === 'view-artist') { load(name, true); } }, 4000); },
            e => { G[k] = { d: { error: e.message }, at: Date.now() }; })
          .then(() => { if (api.ui.currentRoute() === 'view-artist') api.ui.refresh(); });
        return G[k].d;
      };
      const onOpen = () => { if (api.ui.currentRoute() === 'view-artist') api.ui.refresh(); };
      window.addEventListener('cadence-artist', onOpen);

      api.views.add({ id: 'artist', group: 'music', order: 99, title: 'Artist', icon: '🎤', hidden: true, wide: true, render: el => {
        if (!current) { try { current = sessionStorage.getItem('cadence.artist'); } catch (e) {} }
        if (!current) { el.innerHTML = '<p class="muted">Pick an artist from Music Radar, Radio or KEXP history.</p>'; return; }
        if (api.system().mode !== 'nas') { el.innerHTML = '<p class="muted">Artist pages need the NAS.</p>'; return; }
        const d = load(current);
        if (!d) { el.innerHTML = `<div class="ap"><h2>${E(current)}</h2><p class="muted">Gathering everything…</p></div>`; return; }
        if (d.error) { el.innerHTML = `<div class="ap"><h2>${E(current)}</h2><p class="muted">Couldn't load this artist right now.</p></div>`; return; }
        const mb = d.mb, k = d.kexp;
        const facts = [mb && mb.type, mb && (mb.from || mb.country), mb && mb.since && `since ${year(mb.since)}${mb.ended ? ' (ended)' : ''}`, d.radar && d.radar.listeners && `${d.radar.listeners.toLocaleString()} Last.fm listeners`].filter(Boolean);
        const tags = [...new Set([...(d.genres || []), ...((mb && mb.tags) || [])].map(t => t.toLowerCase()))].slice(0, 10);
        const links = (mb && mb.links) || [];
        const charts = d.mentions.filter(m => m.rank != null), other = d.mentions.filter(m => m.rank == null);
        const art = d.art || (mb && mb.releases[0] && mb.releases[0].cover);
        el.innerHTML = `<div class="ap">
          <header class="ap-head">${art ? `<img class="ap-img" src="${E(art)}" alt="" onerror="this.remove()">` : `<i class="ap-img ap-noimg">${api.ui.icon('user')}</i>`}
            <div><h2>${E(d.name)}</h2>${mb && mb.disambiguation ? `<p class="muted">${E(mb.disambiguation)}</p>` : ''}
              ${facts.length ? `<p class="ap-facts">${facts.map(E).join(' · ')}</p>` : ''}
              ${tags.length ? `<div class="ap-tags">${tags.map(t => `<span>${E(t)}</span>`).join('')}</div>` : ''}
              <div class="ap-links"><button class="btn primary" data-pv data-a="${E(d.name)}">${api.ui.icon('play')}Play a preview</button>${(() => { const on = window.CadencePreview.want.has(d.name, null);
                return `<button class="btn" data-want data-a="${E(d.name)}" data-type="artist" data-from="artist page">${api.ui.icon(on ? 'bookmark-check' : 'bookmark-plus')}${on ? 'In Want to hear' : 'Save to Want to hear'}</button>`; })()}</div>
              ${links.length ? `<div class="ap-links">${links.map(l => A(l.url, `${api.ui.icon(l.kind === 'website' ? 'globe' : 'external-link')}${E(LINK_NAMES[l.kind] || l.kind)}`, 'btn')).join('')}</div>` : ''}
              ${d.mbPending ? `<p class="muted ap-wait">Looking up releases and links…</p>` : ''}
              ${d.mainstream ? `<p class="muted">Hidden from Music Radar by your mainstream filter.</p>` : ''}</div></header>

          <div class="ap-grid">
          ${mb && mb.releases.length ? `<section class="ap-wide"><h3>Releases</h3><div class="ap-rel">${mb.releases.slice(0, 18).map(r => `<a class="ap-r" href="https://musicbrainz.org/release-group/${E(r.id)}" target="_blank" rel="noopener">
              <span class="ap-cover"><img src="${E(r.cover)}" alt="" loading="lazy" onerror="this.remove()">${api.ui.icon('disc-3')}</span><b>${E(r.title)}</b><span class="muted">${E([year(r.date), r.type].filter(Boolean).join(' · '))}</span></a>`).join('')}</div>
            <p class="ap-relplay">${mb.releases.slice(0, 6).map(r => `<button class="btn" data-pv data-a="${E(d.name)}" data-t="${E(r.title)}">${api.ui.icon('play')}${E(r.title)}</button>`).join('')}</p></section>` : ''}

          <section><h3>Where they're showing up</h3>
            ${other.length || d.picks.length ? `<ul class="ap-list">
              ${other.slice(0, 30).map(m => `<li><span class="ap-src">${E(m.feed || m.sourceName)}</span><div>${m.url ? A(m.url, E(m.title || d.name)) : E(m.title || d.name)}<span class="muted">${E(m.sourceName)}${m.tier === 'small' ? ' · small blog' : ''} · ${day(m.first)}${m.seen > 1 ? ` · seen ${m.seen} times` : ''}</span></div></li>`).join('')}
              ${d.picks.map(p => `<li><span class="ap-src">${E((p.subs || []).slice(0, 2).join(', ') || 'Communities')}</span><div>${p.link ? A(p.link, E(p.song || 'recommended')) : E(p.song || 'recommended')}<span class="muted">Lemmy & Mastodon · ${day(p.ts)}${p.thread ? ' · ' + A(p.thread, 'discussion') : ''}</span></div></li>`).join('')}
            </ul>` : '<p class="muted">No blog, chart or community has mentioned them yet.</p>'}</section>

          <section><h3>Charts</h3>
            ${charts.length ? `<ul class="ap-list">${charts.map(m => { const run = (m.run || []).map(x => x.rank); const first = run[0], lastR = run[run.length - 1];
              return `<li><span class="ap-src">${E(m.sourceName)}</span><div>${E(m.feed || '')}${m.title ? ' · ' + E(m.title) : ''}<span class="muted">now #${m.rank}${m.best && m.best !== m.rank ? `, best #${m.best}` : ''}${run.length > 1 ? ` · #${first} → #${lastR} over ${run.length} checks` : ''}</span>
                ${run.length > 1 ? spark(run) : ''}</div></li>`; }).join('')}</ul>` : '<p class="muted">Not on any chart Cadence follows.</p>'}</section>

          ${d.stg && d.stg.length ? `<section><h3>On Said the Gramophone's best-of lists</h3><ul class="ap-list">${d.stg.map(x => `<li><span class="ap-src">${x.year}</span><div>${x.kind === 'song' ? `#${x.rank} song: ` : 'Album of the year: '}${A(x.url, E(x.title))}</div>${window.CadencePreview.buttons(d.name, x.title, x.kind, "Said the Gramophone " + x.year)}</li>`).join('')}</ul></section>` : ''}

          <section><h3>On KEXP</h3>
            ${k ? `<p>${k.plays.toLocaleString()} play${k.plays === 1 ? '' : 's'} · first ${new Date(k.first).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} · last ${new Date(k.last).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
              <ul class="ap-list">${k.songs.slice(0, 6).map(s => `<li><span class="ap-src">${s.plays}×</span><div>${E(s.song)}<span class="muted">${E(s.album || '')}</span></div></li>`).join('')}</ul>
              ${k.djs && k.djs.length ? `<h4>Who plays them</h4><ul class="ap-list">${k.djs.slice(0, 5).map(x => `<li><span class="ap-src">${x.plays}×</span><div>${E(x.hosts)}<span class="muted">${E(x.program || '')}</span></div></li>`).join('')}</ul>` : ''}
              <button class="btn" data-ap="kexp">${api.ui.icon('list-music')}Every KEXP play</button>` : '<p class="muted">KEXP hasn\'t played them since your NAS started keeping track.</p>'}</section>
          </div>
          <p class="muted ap-src-note">From Music Radar's sources, KEXP's playlist and MusicBrainz.</p></div>`;
        const kb = el.querySelector('[data-ap="kexp"]'); if (kb) kb.onclick = () => window.CadenceKexpHistory ? window.CadenceKexpHistory.artist(d.name) : api.ui.navigate('view-kexp-history');
      } });

      // a tiny rank line (lower rank = higher on the chart = higher on the line)
      function spark(ranks) {
        const w = 120, h = 24, max = Math.max(...ranks), min = Math.min(...ranks), span = Math.max(1, max - min);
        const pts = ranks.map((r, i) => `${(i / Math.max(1, ranks.length - 1) * w).toFixed(1)},${(2 + (r - min) / span * (h - 4)).toFixed(1)}`).join(' ');
        return `<svg class="ap-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
      }

      const css = document.createElement('style');
      css.textContent = `.ap{max-width:1100px} .ap-head{display:flex;gap:18px;align-items:flex-start;margin-bottom:18px}
        .ap-img{width:120px;height:120px;border-radius:12px;object-fit:cover;flex:none;background:var(--accent-soft)} .ap-noimg{display:grid;place-items:center;color:var(--accent)} .ap-noimg svg{width:40px;height:40px}
        .ap-head h2{margin:0 0 4px;font-size:26px} .ap-facts{margin:4px 0;color:var(--muted)}
        .ap-tags{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0} .ap-tags span{font-size:12px;border:1px solid var(--line);border-radius:999px;padding:1px 8px}
        .ap-links{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px} .ap-links .btn{display:inline-flex;gap:6px;align-items:center;font-size:13px} .ap-links svg{width:14px;height:14px}
        .ap-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px} .ap-wide{grid-column:1/-1} .ap h3{margin:0 0 8px;font-size:15px} .ap h4{margin:12px 0 6px;font-size:13px}
        .ap-rel{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px} .ap-r{display:flex;flex-direction:column;gap:2px;color:inherit;text-decoration:none;font-size:13px}
        .ap-cover{position:relative;aspect-ratio:1;border-radius:8px;background:var(--accent-soft);display:grid;place-items:center;overflow:hidden;color:var(--accent)} .ap-cover img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
        .ap-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px} .ap-list li{display:grid;grid-template-columns:110px 1fr;gap:10px;font-size:13px}
        .ap-list li>div{display:flex;flex-direction:column;gap:1px;min-width:0} .ap-list .muted{font-size:12px} .ap-src{color:var(--muted);font-size:12px;overflow:hidden;text-overflow:ellipsis}
        .ap-spark{color:var(--accent);margin-top:2px} .ap-relplay{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px} .ap-relplay .btn{display:inline-flex;gap:4px;align-items:center;font-size:12px;padding:3px 8px}
        .pv-btns{display:inline-flex;gap:2px;vertical-align:middle} .pv-b{background:none;border:0;padding:3px;border-radius:6px;cursor:pointer;color:var(--muted);display:inline-flex}
        .pv-b:hover{background:var(--accent-soft);color:var(--accent)} .pv-b.on{color:var(--accent)} .pv-b svg{width:16px;height:16px} .pv-busy{opacity:.4}
        .sh-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:2px 0 14px}.sh-bar .inp{width:auto;display:inline-block;margin-left:4px}
        .sh-l{list-style:none;padding:0;margin:8px 0 16px;display:flex;flex-direction:column;gap:10px}.sh-l li{display:flex;gap:12px;align-items:flex-start;font-size:14px}
        .sh-l li>div{flex:1;min-width:0;display:flex;flex-direction:column}.sh-l .muted{font-size:12px}.sh-d{min-width:9em;color:var(--muted);font-size:13px}
        .sh-why{font-size:12px;color:var(--accent)}.sh-more>summary,.sh-set>summary{cursor:pointer;color:var(--muted);margin:8px 0}
        .sh-set ul{list-style:none;padding:0;display:flex;flex-direction:column;gap:8px;font-size:14px}.sh-set li{display:flex;gap:8px;align-items:flex-start}.sh-set li svg{width:15px;height:15px;flex:none;margin-top:2px}
        .ar-find{display:flex;gap:8px;max-width:520px;margin:4px 0 18px}.ar-find .inp{flex:1}
        .ars{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 16px}.ar-chip{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:4px 12px;font-size:13px;color:var(--text);text-decoration:none}.ar-chip:hover{border-color:var(--accent);color:var(--accent)}
        .sg{max-width:820px} .sg-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 14px} .sg-c{border:1px solid var(--line);background:var(--panel);color:var(--muted);border-radius:999px;padding:3px 10px;font-size:13px;cursor:pointer} .sg-c.on{border-color:var(--accent);color:var(--accent);background:var(--accent-soft)} .sg-l{list-style:none;padding:0;margin:6px 0 18px;display:flex;flex-direction:column;gap:6px}
        .sg-l li{display:flex;gap:10px;align-items:flex-start;font-size:14px} .sg-l li>div{flex:1;min-width:0;display:flex;flex-direction:column} .sg-l .muted{font-size:12px}
        .sg-n{min-width:2.2em;text-align:right;color:var(--muted);font-variant-numeric:tabular-nums} .sg-songs li>div{flex-direction:row;flex-wrap:wrap;gap:0 4px}
        .sg-err{font-size:13px;color:var(--muted);margin:6px 0} .linkish{background:none;border:0;padding:0;color:var(--accent);cursor:pointer;font:inherit;display:inline-flex;gap:3px;align-items:center} .linkish svg{width:13px;height:13px}
        .wh{max-width:760px} .wh-l{list-style:none;padding:0;margin:14px 0 0;display:flex;flex-direction:column;gap:8px} .wh-l li{display:flex;gap:10px;align-items:flex-start;font-size:14px}
        .wh-l li>div{display:flex;flex-direction:column} .wh-l .muted{font-size:12px} .wh .btn.primary{display:inline-flex;gap:6px;align-items:center} .ap-src-note{font-size:12px;margin-top:20px} .ap a{color:inherit}
        [data-artist]{cursor:pointer} .ar-link{color:inherit;text-decoration:none;font:inherit;background:none;border:0;padding:0} .ar-link:hover{text-decoration:underline}
        @media (max-width:640px){.ap-head{flex-direction:column} .ap-list li{grid-template-columns:80px 1fr}}`;
      document.head.appendChild(css);
      return () => { window.removeEventListener('cadence-artist', onOpen); window.removeEventListener('cadence-want', onWant); css.remove(); };
    },
  });
})();
