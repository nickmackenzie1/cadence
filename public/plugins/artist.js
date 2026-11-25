/* Artist page (user, 2026-11-16): one artist, everything Cadence knows, from api/radar/artist. Any element with
   data-artist="Name" anywhere in the app opens it (Radar, KEXP history, Radio). MusicBrainz details are looked up in the
   background on the NAS the first time, so the page fills in a few seconds later. */
(() => {
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const A = (u, t, cls = '') => `<a ${cls ? `class="${cls}" ` : ''}href="${E(u)}" target="_blank" rel="noopener">${t}</a>`;
  const LINK_NAMES = { bandcamp: 'Bandcamp', website: 'Website', wikipedia: 'Wikipedia', instagram: 'Instagram', youtube: 'YouTube', spotify: 'Spotify', apple: 'Apple Music', soundcloud: 'SoundCloud', bluesky: 'Bluesky', mastodon: 'Mastodon', facebook: 'Facebook', twitter: 'X (Twitter)', lastfm: 'Last.fm' };
  const day = ts => new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const year = d => d ? String(d).slice(0, 4) : '';
  let current = null;
  window.CadenceArtist = { open(name) { if (!name) return; current = String(name); try { const r = JSON.parse(localStorage.getItem('cadence.recentArtists') || '[]').filter(x => x.toLowerCase() !== current.toLowerCase()); localStorage.setItem('cadence.recentArtists', JSON.stringify([current, ...r].slice(0, 40))); } catch (e) {} try { sessionStorage.setItem('cadence.artist', current); } catch (e) {} if (location.hash === '#view-artist') window.dispatchEvent(new Event('cadence-artist')); else location.hash = 'view-artist'; } };
  // ---- listening: 30-second previews (Deezer, via the NAS) in the shared player, and Want to hear ----
  const P = () => window.CadencePodcasts;
  const PV = { queue: [], want: null, wantAt: 0, toast: m => {} };
  const key = (a, t) => (String(a) + '|' + (t || '')).toLowerCase();
  const wantList = async (force) => { if (!force && PV.want && Date.now() - PV.wantAt < 30e3) return PV.want;
    try { PV.want = await window.CadenceCached('api/radar/want', v => { PV.want = v; }); PV.wantAt = Date.now(); } catch (e) { PV.want = PV.want || []; } return PV.want; };
  const wantPost = async body => { PV.want = await (await fetch('api/radar/want', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); PV.wantAt = Date.now(); window.dispatchEvent(new Event('cadence-want')); return PV.want; };
  const playOne = async (artist, title) => {
    const p = P(); if (!p) return;
    // a song in your music folder plays in full (Downloads)
    const own = title && window.CadenceGet && window.CadenceGet.file(artist, title);
    if (own) { p.load({ uuid: 'own:' + key(artist, title), preview: true, full: true, title, podcastTitle: artist, url: own, from: { artist, title } }, true); return true; }
    let v; try { v = await (await fetch(`api/radar/preview?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title || '')}`)).json(); } catch (e) { v = null; }
    if (!v || !v.found) { PV.toast(`No preview found for ${artist}${title ? ' – ' + title : ''}`); return false; }
    p.load({ uuid: 'preview:' + key(v.artist, v.title), preview: true, title: v.title, podcastTitle: v.artist, url: v.preview, art: v.cover, link: v.link, from: { artist, title } }, true);
    return true;
  };
  // ---- following artists: the list and what's new are kept on the NAS (api/radar/follow) ----
  // the same name matching the NAS uses (radar/lib/extract.mjs norm): "Black Country, New Road" = "black country new road"
  // (2026-11-17: comparing plain lowercase made Follow look like it did nothing when the names were spelled differently)
  const norm = n => String(n).toLowerCase().trim().replace(/\s+(feat\.?|ft\.?|featuring|with|x|&|,)\s+.*$/, '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const FW = { d: null, at: 0, pending: new Map() };
  const fwLoad = async (body) => {
    let ok = false;
    try {
      const r = await fetch('api/radar/follow', body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
      if (r.ok) { const d = await r.json(); FW.d = body && body.news === false ? { ...d, news: (FW.d && FW.d.news) || [] } : d; FW.at = Date.now(); ok = true; }
    } catch (e) {}
    window.dispatchEvent(new Event('cadence-follow'));
    return ok ? FW.d : null;
  };
  // follow / unfollow: the button changes at once; the NAS answers without working out the news (that comes after)
  const fwChange = async (name, add) => {
    const k = norm(name); FW.pending.set(k, add); window.dispatchEvent(new Event('cadence-follow'));
    const d = await fwLoad(add ? { add: name, news: false } : { remove: name, news: false });
    FW.pending.delete(k);
    if (d) setTimeout(() => fwLoad(), 1500); else window.dispatchEvent(new Event('cadence-follow'));
    return d;
  };
  window.CadenceFollow = {
    peek: () => FW.d || { follows: [], news: [] },
    load: (force) => (!force && FW.d && Date.now() - FW.at < 60e3 ? Promise.resolve(FW.d) : fwLoad()),
    loaded: () => !!FW.d,
    has: name => { if (!name) return false; const k = norm(name); if (FW.pending.has(k)) return FW.pending.get(k); return !!FW.d && FW.d.follows.some(f => f.key === k || norm(f.name) === k); },
    add: name => fwChange(name, true), remove: name => fwChange(name, false), seen: (name) => fwLoad({ seen: name || true })
  };
  window.CadencePreview = {
    play: (artist, title) => { PV.queue = []; return playOne(artist, title); },
    // play a list in order (Want to hear → Play all); skips ones without a preview
    playAll: async (items) => { PV.queue = items.slice(); while (PV.queue.length) { const n = PV.queue.shift(); if (await playOne(n.artist, n.title)) break; } },
    want: { peek: () => PV.want || [], list: wantList, has: (a, t) => !!(PV.want || []).find(x => key(x.artist, x.title) === key(a, t)), add: it => wantPost({ add: it }), remove: it => wantPost({ remove: it }) },
  };
  // ---- what you listen to, for Radar's "For you" and Your year in music (user, 2026-11-16) ----
  // One line per song: a preview (stopped in its first 8 seconds = a skip), or a song heard live on a station.
  // Counted only while it's actually playing; sent to the NAS when the song changes or the page closes.
  const LST = { id: null, it: null, secs: 0, tick: 0 };
  const listenOf = c => {
    if (!c) return null;
    if (c.preview) return { id: 'pv|' + c.podcastTitle + '|' + c.title, kind: 'preview', artist: c.podcastTitle, title: c.title, url: c.url };
    if (c.live && c.now && c.now.artist && !c.now.airbreak) return { id: 'lv|' + c.station + '|' + c.now.artist + '|' + c.now.song, kind: c.station === 'kexp' ? 'kexp' : 'live', artist: c.now.artist, title: c.now.song, station: c.title };
    return null;
  };
  // ---- the sound of a song (2026-11-17): a preview you let play is read once for tempo, key and energy (Essentia.js, in a
  // worker, in your browser), and the numbers go to the NAS for the artist page and the Friday mix's running order ----
  const SND = { worker: null, busy: false, queue: [], seq: 0, wait: new Map() };
  const sndDone = () => { try { return new Set(JSON.parse(localStorage.getItem('cadence.snd.done') || '[]')); } catch (e) { return new Set(); } };
  const sndMark = id => { const d = [...sndDone(), id].slice(-3000); try { localStorage.setItem('cadence.snd.done', JSON.stringify(d)); } catch (e) {} };
  function soundOf(it) {
    if (!it || !it.url || !window.Worker || !window.OfflineAudioContext || sndDone().has(it.id) || SND.queue.some(x => x.id === it.id)) return;
    SND.queue.push(it); if (!SND.busy) soundNext();
  }
  async function soundNext() {
    const it = SND.queue.shift(); if (!it) { SND.busy = false; return; }
    SND.busy = true;
    try {
      // through the NAS relay: a browser may only decode sound it fetched from its own server
      const r = await fetch('api/radio/stream?u=' + encodeURIComponent(it.url)); if (!r.ok) throw new Error('preview ' + r.status);
      const buf = await r.arrayBuffer();
      const dec = await new OfflineAudioContext(1, 44100 * 31, 44100).decodeAudioData(buf);
      const ch = dec.getChannelData(0), pcm = new Float32Array(ch.length); pcm.set(ch);
      if (dec.numberOfChannels > 1) { const c2 = dec.getChannelData(1); for (let i = 0; i < pcm.length; i++) pcm[i] = (pcm[i] + c2[i]) / 2; }
      if (!SND.worker) { SND.worker = new Worker('sound-worker.js'); SND.worker.onmessage = e => { const f = SND.wait.get(e.data.id); if (f) { SND.wait.delete(e.data.id); f(e.data); } }; }
      const id = ++SND.seq, out = await new Promise(ok => { SND.wait.set(id, ok); SND.worker.postMessage({ id, pcm }, [pcm.buffer]); setTimeout(() => { if (SND.wait.has(id)) { SND.wait.delete(id); ok({ error: 'took too long' }); } }, 60000); });
      sndMark(it.id);
      if (!out.error) await fetch('api/radar/sound', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ artist: it.artist, title: it.title, ...out, id: undefined }) });
    } catch (e) { sndMark(it.id); }
    setTimeout(soundNext, 1500);
  }
  window.CadenceSound = { analyse: soundOf };
  // ---- your Discogs records (2026-11-18): "In your records" / "On your wantlist" marks, an artist's records, the shelf ----
  const DG = window.CadenceDiscogs = (() => {
    let ix = null, loading = false, sum = null, sumAt = 0; const per = new Map(), E2 = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    // the same as the server's norm() (radar/lib/extract.mjs), so the marks line up
    const nk = n => String(n).toLowerCase().trim().replace(/\s+(feat\.?|ft\.?|featuring|with|x|&|,)\s+.*$/, '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    const key = (a, t) => nk(a) + '|' + nk(String(t || '').replace(/\s*\((deluxe|remaster(ed)?|expanded|anniversary)[^)]*\)/gi, ''));
    const get = u => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null);
    const load = () => { if (loading || ix) return; loading = true;
      get('api/radar/discogs?index=1').then(j => { ix = j ? { artists: new Set(j.artists), own: new Set(j.own), want: new Set(j.want) } : { artists: new Set(), own: new Set(), want: new Set() }; if (ix.artists.size || ix.want.size) DG.changed(); }).finally(() => { loading = false; }); };
    const rec = r => `<a class="dg-rec" href="https://www.discogs.com/release/${+r.rid}" target="_blank" rel="noopener" title="${E2(r.artist + ' – ' + r.title + (r.year ? ' (' + r.year + ')' : ''))}">${r.thumb || r.cover ? `<img src="${E2(r.thumb || r.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">` : '<span class="dg-noimg"></span>'}<span><b>${E2(r.title)}</b><span class="muted">${[r.year, r.format].filter(Boolean).map(E2).join(' · ')}</span></span></a>`;
    return {
      changed: () => {},
      // a small mark next to something you own or want (an album; or, with no album, an artist you own records by)
      chip(artist, title) {
        load(); if (!ix || !artist) return '';
        const k = title ? key(artist, title) : null;
        if (k && ix.own.has(k)) return '<span class="dg-chip own" title="On your Discogs collection">In your records</span>';
        if (k && ix.want.has(k)) return '<span class="dg-chip" title="On your Discogs wantlist">On your wantlist</span>';
        if (!title && ix.artists.has(nk(artist))) return '<span class="dg-chip own" title="You own records by them">In your records</span>';
        return '';
      },
      owns: (a, t) => !!(ix && ix.own.has(key(a, t))), wants: (a, t) => !!(ix && ix.want.has(key(a, t))),
      // on an artist's page: the records of theirs you own, and the ones on your wantlist
      artistBlock(name) {
        const c = per.get(name.toLowerCase());
        if (!c) { per.set(name.toLowerCase(), { loading: true }); get('api/radar/discogs?artist=' + encodeURIComponent(name)).then(d => { per.set(name.toLowerCase(), d || { off: true }); if (d && ((d.own || []).length || (d.want || []).length)) DG.changed(); }); return ''; }
        if (c.loading || c.off || c.pending || (!(c.own || []).length && !(c.want || []).length)) return '';
        return `<div class="dg-ap">${c.own.length ? `<div><h4>In your records</h4><div class="dg-recs">${c.own.map(rec).join('')}</div></div>` : ''}${c.want.length ? `<div><h4>On your wantlist</h4><div class="dg-recs">${c.want.map(rec).join('')}</div></div>` : ''}</div>`;
      },
      // the "Your records" card on Music Radar: counts, the newest, and one pulled from the shelf (a different one each day)
      card() {
        if (!sum || Date.now() - sumAt > 5 * 60e3) { sumAt = Date.now(); get('api/radar/discogs').then(d => { const had = !!sum; sum = d; if (d && (d.on || had)) DG.changed(); }); }
        if (!sum || sum.off) return '';
        if (sum.pending) return '<section class="mr-card w12 dg-card"><h3>Your records</h3><p class="mr-sub">Copying your Discogs collection and wantlist. This takes a minute or two the first time.</p></section>';
        return `<section class="mr-card w12 dg-card"><div class="mr-row" style="justify-content:space-between"><div><h3>Your records</h3><p class="mr-sub">${sum.records.toLocaleString()} in your Discogs collection · ${sum.wants.toLocaleString()} on your wantlist</p></div>
          <button class="btn sm" data-dg-sync>Check Discogs now</button></div>
          ${sum.shelf ? `<div class="dg-shelf"><span class="mr-small">Pulled from the shelf today</span>${rec(sum.shelf)}</div>` : ''}
          ${sum.recent.length ? `<h4>Newest in your collection</h4><div class="dg-recs">${sum.recent.map(rec).join('')}</div>` : ''}</section>`;
      },
      async sync() { const r = await fetch('api/radar/discogs/sync', { method: 'POST' }).then(x => x.json()).catch(() => ({ error: true })); ix = null; per.clear(); sum = null; DG.changed(); return r; },
      async want(artist, title, add = true) {
        const r = await fetch('api/radar/discogs/want', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ artist, title, add }) }).then(x => x.json()).catch(() => ({ error: true }));
        if (r.ok) { ix = null; per.delete(String(artist).toLowerCase()); } return r;
      },
    };
  })();
  const sendListen = (it, secs, beacon) => {
    if (!it || secs < 1) return;
    if (it.kind === 'preview' && secs >= 8 && !beacon) soundOf(it);
    const b = JSON.stringify({ ...it, id: undefined, url: undefined, secs, skipped: it.kind === 'preview' && secs < 8 });
    if (beacon && navigator.sendBeacon) navigator.sendBeacon('api/radar/listen', new Blob([b], { type: 'application/json' }));
    else fetch('api/radar/listen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: b }).catch(() => {});
  };
  const listenTick = () => {
    const p = P(); if (!p) return;
    const it = listenOf(p.current), id = it ? it.id : null;
    if (id !== LST.id) { sendListen(LST.it, LST.secs); LST.id = id; LST.it = it; LST.secs = 0; }
    if (it && !p.audio.paused && p.audio.readyState >= 2) LST.secs++;
  };
  setInterval(listenTick, 1000);
  addEventListener('pagehide', () => { sendListen(LST.it, LST.secs, true); LST.secs = 0; });
  const hook = () => { const p = P(); if (!p || p.onPreviewEnded) return;
    p.onPreviewEnded = async () => { while (PV.queue.length) { const n = PV.queue.shift(); if (await playOne(n.artist, n.title)) return; } };
    p.hasNextPreview = () => PV.queue.length > 0; };
  let toast = () => {};
  // "Not for me" anywhere: <button data-nfm-type="artist|genre|source" data-nfm-value="…"> (data-nfm-off undoes it)
  window.CadenceNfm = {
    list: null,
    async set(type, value, on) {
      const r = await fetch('api/radar/nfm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, value, on }) });
      this.list = await r.json(); window.dispatchEvent(new CustomEvent('cadence-radar-reload', { detail: { type, value, on } })); return this.list;
    },
    has(type, v) { const l = this.list && this.list[type + 's']; return !!l && l.some(x => x.toLowerCase() === String(v).toLowerCase()); },
    async load() { try { this.list = await (await fetch('api/radar/nfm')).json(); } catch (e) {} return this.list; }
  };
  // buttons any page can drop next to a pick: <button data-pv data-a="…" data-t="…"> and <button data-want …>
  document.addEventListener('click', async e => {
    const nb = e.target.closest('[data-nfm-type]');
    if (nb) { e.preventDefault(); e.stopPropagation(); const off = !!nb.dataset.nfmOff, v = nb.dataset.nfmValue, t = nb.dataset.nfmType;
      await window.CadenceNfm.set(t, v, !off);
      const label = t === 'source' ? (v.startsWith('blog:') ? v.slice(5) : v) : v;
      toast(off ? `Showing ${label} again` : `Hidden: ${label}. Undo under Music Radar, For you.`);
      if (nb.closest('.modal')) { const li = nb.closest('li'); if (li) li.remove(); }
      return; }
    const fb = e.target.closest('[data-follow]');
    if (fb) { e.preventDefault(); e.stopPropagation(); if (fb.disabled) return;
      const n = fb.dataset.follow;
      if (!window.CadenceFollow.loaded()) await window.CadenceFollow.load();   // know where you stand before changing it
      const on = window.CadenceFollow.has(n); fb.disabled = true;
      const d = await (on ? window.CadenceFollow.remove(n) : window.CadenceFollow.add(n)); fb.disabled = false;
      PV.toast(!d ? 'Couldn\'t reach Music Radar just now. Try again in a moment.' : on ? 'Stopped following ' + n : 'Following ' + n + '. You\'ll get a note when they turn up.'); return; }
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
      toast = m => api.ui.toast(m);
      if (api.system().mode === 'nas') window.CadenceNfm.load();
      window.addEventListener('cadence-radar-reload', () => { if (api.ui.currentRoute() === 'view-artist') api.ui.refresh(); });
      const G = {};
      PV.toast = m => api.ui.toast(m); hook();
      // play + want buttons for one pick (used by Music Radar and this page)
      // TasteDive's "fans also like" for an artist page (2026-11-19): asked once, kept on the NAS; nothing shows without a key
      const TD = new Map();
      const tdArtists = (name, skip) => {
        const k = name.toLowerCase();
        if (!TD.has(k)) { TD.set(k, null); fetch('api/similar?' + new URLSearchParams({ q: name, type: 'music' })).then(r => r.json()).catch(() => null).then(v => { TD.set(k, v); if (v && v.results && v.results.length && api.ui.currentRoute() === 'view-artist') api.ui.refresh(); }); }
        const v = TD.get(k), no = new Set([k, ...skip.map(x => String(x).toLowerCase())]);
        return v && v.results ? v.results.filter(x => !no.has(x.name.toLowerCase())).slice(0, 8) : [];
      };
      window.CadencePreview.buttons = (artist, title, type, from) => { if (!artist) return ''; const on = window.CadencePreview.want.has(artist, title);
        return `<span class="pv-btns"><button class="pv-b" data-pv data-a="${E(artist)}" data-t="${E(title || '')}" aria-label="Play a preview of ${E(title || artist)}" title="Play a 30-second preview">${api.ui.icon('play')}</button><button class="pv-b${on ? ' on' : ''}" data-want data-a="${E(artist)}" data-t="${E(title || '')}" data-type="${E(type || '')}" data-from="${E(from || '')}" aria-label="${on ? 'Remove from' : 'Save to'} Want to hear" title="${on ? 'In Want to hear' : 'Save to Want to hear'}">${api.ui.icon(on ? 'bookmark-check' : 'bookmark-plus')}</button>${window.CadenceGet ? window.CadenceGet.button(artist, title, type) : ''}${type === 'song' && title && window.CadenceLyrics ? window.CadenceLyrics.button(artist, title) : ''}</span>`; };
      DG.changed = () => { clearTimeout(DG._t); DG._t = setTimeout(() => api.ui.refresh(), 60); };
      document.addEventListener('click', async e => { const b = e.target.closest('[data-dg-sync]'); if (!b) return; b.disabled = true; const r = await DG.sync(); api.ui.toast(r.error ? "Couldn't reach Discogs just now" : r.off ? 'Add DISCOGS_TOKEN to .env on the NAS' : `Discogs: ${r.records} records, ${r.wants} wanted`); });
      const onWant = () => { api.ui.refreshWidgets && api.ui.refreshWidgets(); const r = api.ui.currentRoute(); if (r === 'view-radar' || r === 'view-artist' || r === 'view-want' || r === 'view-artists') api.ui.refresh(); };
      window.addEventListener('cadence-want', onWant);
      window.addEventListener('cadence-follow', onWant);
      // a calm note when something new turns up for an artist you follow: each item once, checked every 30 minutes
      const noteFollow = async () => {
        const d = await window.CadenceFollow.load(true); if (!d || !d.news.length || !api.island || !api.island.notify) return;
        let told = []; try { told = JSON.parse(localStorage.getItem('cadence.followNoted') || '[]'); } catch (e) {}
        const fresh = d.news.filter(n => !told.includes(n.artist + '|' + n.text)); if (!fresh.length) return;
        localStorage.setItem('cadence.followNoted', JSON.stringify([...told, ...fresh.map(n => n.artist + '|' + n.text)].slice(-400)));
        const n = fresh[0], more = fresh.length - 1;
        api.island.notify({ icon: 'mic-vocal', title: n.artist + ': ' + n.text, sub: more ? `and ${more} more about artists you follow` : 'An artist you follow', actions: [{ label: 'See', run: () => api.ui.navigate('view-artists') }] });
      };
      const fwT1 = setTimeout(noteFollow, 20000), fwT2 = setInterval(noteFollow, 30 * 60e3);

      // calm notes: your Friday mix is ready (Fridays, once), and release day for artists you follow or saved (once each)
      const told = (k, v) => { let l = []; try { l = JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) {} if (l.includes(v)) return true; localStorage.setItem(k, JSON.stringify([...l, v].slice(-300))); return false; };
      const noteMusic = async () => {
        if (api.system().mode !== 'nas' || !api.island || !api.island.notify) return;
        const now = new Date();
        if (now.getMonth() === 11 && now.getDate() >= 1 && !told('cadence.yearNoted', String(now.getFullYear()))) api.island.notify({ icon: 'calendar-days', title: `Your ${now.getFullYear()} in music is ready`, sub: 'Who you listened to most, your stations, and who you found early', actions: [{ label: 'See it', run: () => api.ui.navigate('view-year') }] });
        if (now.getDay() === 5 && now.getHours() >= 7) {
          const wk = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
          if (!told('cadence.mixNoted', wk)) api.island.notify({ icon: 'disc-3', title: 'Your Friday mix is ready', sub: 'New picks for you, and new music from people you follow', actions: [{ label: 'Listen', run: () => api.ui.navigate('view-mix') }] });
        }
        try {
          const R = await (await fetch('api/radar/releases')).json(), today = R.today;
          for (const x of (R.thisWeek || []).filter(x => x.date === today)) if (!told('cadence.releaseNoted', x.artist + '|' + x.title)) {
            api.island.notify({ icon: 'calendar-days', title: `Out today: ${x.title}`, sub: `${x.artist}, ${x.why}`, actions: [{ label: 'Play a preview', run: () => window.CadencePreview.play(x.artist, x.title) }] }); break;
          }
        } catch (e) {}
      };
      const msT1 = setTimeout(noteMusic, 35000), msT2 = setInterval(noteMusic, 60 * 60e3);
      // Said the Gramophone: Sean's 100 favourite songs and favourite albums of every year since 2005, read from the blog
      const SG = { d: null, year: null, tab: 'artists', at: 0 };
      // the last copy on this device first (2026-11-19), then the NAS's
      const sgLoad = async (year) => { let sync = true, changed = false;
        const job = api.cached('api/radar/stg' + (year ? '?year=' + year : ''), v => { SG.d = v; SG.at = Date.now(); if (!sync) changed = true; });
        sync = false;
        try { await job; } catch (e) { SG.d = SG.d || { err: true }; changed = true; }
        if (changed && api.ui.currentRoute() === 'view-stg') api.ui.refresh();
        if (SG.d && SG.d.status && SG.d.status.running) setTimeout(() => api.ui.currentRoute() === 'view-stg' && sgLoad(SG.year), 8000); };
      api.views.add({ id: 'stg', group: 'music', order: 50, site: 'saidthegramophone.com', title: 'Said the Gramophone', icon: '🎼', subtitle: 'Best songs and albums of every year, from the blog', render: el => {
        if (!SG.d || Date.now() - SG.at > 60e3) sgLoad(SG.year);
        const d = SG.d;
        if (!d) { el.innerHTML = api.ui.skeleton(4); return; }
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
            <ul class="sg-l">${d.artists.map(a => `<li><span class="sg-n">${a.n}</span>${window.CadencePreview.buttons(a.artist, (a.songs[0] || {}).title, null, 'Said the Gramophone')}<div><a class="ar-link" href="#view-artist" data-artist="${E(a.artist)}"><b>${E(a.artist)}</b></a>
              <span class="muted">${a.years.join(', ')}${a.best ? ` · best #${a.best}` : ''}${a.albums.length ? ` · ${a.albums.length} album${a.albums.length === 1 ? '' : 's'} of the year` : ''}</span></div></li>`).join('')}</ul>` : '<p class="muted">Once a few years are read, the artists he loves year after year show up here.</p>';
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
      const showRow = (e, full) => `<li><span class="sh-d">${E(dateLabel(e.date, e.time))}</span>${full && e.match ? window.CadencePreview.buttons(e.match.name, null, 'artist', 'Shows') : ''}<div>
          <span class="sh-a">${e.artists.map((a, i) => `<a class="ar-link" href="#view-artist" data-artist="${E(a)}">${i ? E(a) : `<b>${E(a)}</b>`}</a>`).join(', ')}${e.title && e.title !== e.artists.join(', ') ? ` <span class="muted">· ${E(e.title.split(': ')[0])}</span>` : ''}</span>
          <span class="muted">${E([e.venue, e.city, e.km != null ? e.km + ' km away' : null, e.price].filter(Boolean).join(' · '))}${e.url ? ` · <a href="${E(e.url)}" target="_blank" rel="noopener">${api.ui.logo(e.url, { size: 12 })}Details</a>` : ''}</span>
          ${e.note ? `<span class="muted sh-note">${E(e.note)}</span>` : ''}
          ${(e.heard || []).map(h => `<span class="sh-heard">${api.ui.icon('message-square-quote')}${e.artists.length > 1 ? `${E(h.artist)}: ` : ''}${E(h.where.join(' · '))}</span>`).join('')}
          ${full && e.match ? `<span class="sh-why">${E(e.match.why)}</span>` : ''}</div></li>`;
      api.views.add({ id: 'shows', group: 'music', order: 45, title: 'Shows', icon: '🗓', subtitle: 'Concerts near home, by artists you care about first', render: el => {
        const d = SH.d;
        if (!d || Date.now() - SH.at > 10 * 60e3) { if (!SH.busy) shLoad(); if (!d) { el.innerHTML = '<p class="muted">Looking for shows… (the first look can take a minute)</p>'; return; } }
        if (d.error) { el.innerHTML = `<p class="muted">Couldn't check for shows: ${E(d.error)}</p>`; return; }
        const c = d.cfg, k = d.keys;
        const dist = [[50, '50 km'], [100, '100 km: Kingston, Belleville, Gananoque'], [200, '200 km: adds Ottawa and Peterborough'], [300, '300 km: adds Toronto and Montreal']];
        const noKey = d.note === 'needs a key';
        const setup = `<details class="sh-set" ${noKey ? 'open' : ''}><summary>Where the shows come from</summary>
          <p class="muted">Kingston Live needs nothing. The other two are free, each with its own key in the NAS <code>.env</code> (the NAS picks up a changed .env on its next update check):</p>
          <ul><li>${k.kingstonlive ? api.ui.icon('circle-check') : api.ui.icon('circle')}<div><b>${api.ui.logo('kingstonlive.ca')}Kingston Live</b>: the volunteer-run listings for Kingston${k.kingstonlive ? ' (used when Kingston is inside your circle)' : ' (turned off with KINGSTONLIVE=0)'}</div></li><li>${k.ticketmaster ? api.ui.icon('circle-check') : api.ui.icon('circle')}<div><b>${api.ui.logo('ticketmaster.ca')}Ticketmaster</b>: every concert near you. Sign up at <a href="https://developer.ticketmaster.com" target="_blank" rel="noopener">developer.ticketmaster.com</a>, open My Apps, copy the Consumer Key, and add <code>TICKETMASTER_API_KEY=…</code></div></li>
            <li>${k.bandsintown ? api.ui.icon('circle-check') : api.ui.icon('circle')}<div><b>${api.ui.logo('bandsintown.com')}Bandsintown</b>: tour dates for the artists you care about, including smaller venues. Bandsintown gives app IDs on request; add <code>BANDSINTOWN_APP_ID=…</code></div></li></ul></details>`;
        el.innerHTML = `<div class="sg sh">
          <div class="sh-bar"><label>Around ${E(c.place)}, within <select class="inp" id="sh-km">${dist.map(([v, l]) => `<option value="${v}" ${c.radiusKm === v ? 'selected' : ''}>${l}</option>`).join('')}${dist.some(x => x[0] === c.radiusKm) ? '' : `<option selected value="${c.radiusKm}">${c.radiusKm} km</option>`}</select></label>
            ${!noKey ? `<button class="linkish" id="sh-again">${api.ui.icon('refresh-cw')}Check again</button>` : ''}</div>
          ${noKey ? '<p>Shows need Kingston inside your circle, or a free key from Ticketmaster or Bandsintown. Here\'s how:</p>' + setup : `
          ${(d.errors || []).map(x => `<p class="muted" title="${E(x)}">${E(x.split(':')[0])} couldn't be reached just now. It'll try again on the next check.</p>`).join('')}
          <h3>By artists you care about</h3>
          ${d.matches.length ? `<ul class="sh-l">${d.matches.map(e => showRow(e, true)).join('')}</ul>` : '<p class="muted">Nobody from your lists is playing nearby right now. Shows by artists in Want to hear, climbing on Radar, played a lot on KEXP, or that you look up will show here.</p>'}
          ${(d.local || []).length ? `<h3>${api.ui.logo('kingstonlive.ca')}Kingston Live</h3><ul class="sh-l sh-kl">${d.local.map(e => showRow(e, false)).join('')}</ul>` : ''}
          ${d.nearby.length ? `<details class="sh-more"><summary>Everything else nearby (${d.nearby.length})</summary><ul class="sh-l">${d.nearby.map(e => showRow(e, false)).join('')}</ul></details>` : ''}
          ${setup}`}</div>`;
        const km = el.querySelector('#sh-km'); if (km) km.onchange = () => { SH.d = null; api.ui.refresh(); shLoad({ settings: { radiusKm: +km.value } }); };
        const ag = el.querySelector('#sh-again'); if (ag) ag.onclick = () => { api.ui.toast('Checking for shows'); shLoad({ refresh: true }); };
      } });

      // Artists: open any artist by name, the ones you looked at lately, and the ones in Want to hear
      // ---- suggestions as you type (user, 2026-11-17): names you've looked at straight away, then the NAS's mix of
      // Radar, KEXP history and Deezer's artist search (/api/radar/find) with a photo and a line on where they're from.
      // Arrow keys move, Enter opens the highlighted one (or looks up exactly what you typed), Escape closes.
      function suggest(inp, known) {
        if (!inp) return;
        const box = document.createElement('div'); box.className = 'ar-sug'; box.setAttribute('role', 'listbox'); box.hidden = true;
        inp.parentNode.style.position = 'relative'; inp.parentNode.appendChild(box);
        inp.setAttribute('role', 'combobox'); inp.setAttribute('aria-autocomplete', 'list'); inp.setAttribute('aria-expanded', 'false');
        let items = [], sel = -1, timer = 0, ctl = null, seq = 0;
        const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n);
        const line = a => [a.kexp ? `KEXP played them ${a.kexp.toLocaleString('en-CA')} time${a.kexp === 1 ? '' : 's'}` : '', a.radar ? 'on Radar' : '', a.mine ? 'looked at before' : '',
          a.fans ? `${fmt(a.fans)} fans on Deezer` : '', a.albums ? `${a.albums} release${a.albums === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
        const open = name => { box.hidden = true; inp.setAttribute('aria-expanded', 'false'); window.CadenceArtist.open(name); location.hash = 'view-artist'; };
        const draw = () => {
          box.hidden = !items.length; inp.setAttribute('aria-expanded', String(!!items.length));
          box.innerHTML = items.map((a, i) => `<button type="button" role="option" class="ar-sg${i === sel ? ' on' : ''}" data-i="${i}" aria-selected="${i === sel}">
            <span class="ar-sg-im">${a.image ? `<img src="api/logo?u=${encodeURIComponent(a.image)}" alt="" loading="lazy">` : api.ui.icon('mic-vocal')}</span>
            <span class="ar-sg-t"><b>${E(a.name)}</b>${line(a) ? `<small>${E(line(a))}</small>` : ''}</span></button>`).join('');
        };
        const local = q => { const l = q.toLowerCase(); return known.filter(n => n.toLowerCase().includes(l)).slice(0, 3).map(n => ({ name: n, mine: true })); };
        const merge = (mine, far) => { const out = [...mine]; for (const a of far) { const m = out.find(x => x.name.toLowerCase() === a.name.toLowerCase()); if (m) Object.assign(m, a, { mine: true }); else out.push(a); } return out.slice(0, 8); };
        inp.addEventListener('input', () => {
          const q = inp.value.trim(); clearTimeout(timer); if (ctl) ctl.abort();
          if (q.length < 2) { items = []; sel = -1; return draw(); }
          items = local(q); sel = -1; draw();
          const my = ++seq;
          timer = setTimeout(async () => {
            ctl = new AbortController();
            try { const far = await (await fetch('api/radar/find?q=' + encodeURIComponent(q), { signal: ctl.signal })).json(); if (my === seq && Array.isArray(far)) { items = merge(local(q), far); draw(); } } catch (e) {}
          }, 160);
        });
        inp.addEventListener('keydown', e => {
          if (box.hidden) return;
          if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, items.length - 1); draw(); e.preventDefault(); }
          else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, -1); draw(); e.preventDefault(); }
          else if (e.key === 'Escape') { items = []; draw(); e.stopPropagation(); }
          else if (e.key === 'Enter' && sel >= 0 && items[sel]) { e.preventDefault(); open(items[sel].name); }
        });
        box.addEventListener('mousedown', e => e.preventDefault());   // keep the focus in the box while choosing
        box.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) open(items[+b.dataset.i].name); });
        inp.addEventListener('blur', () => setTimeout(() => { box.hidden = true; inp.setAttribute('aria-expanded', 'false'); }, 120));
        inp.addEventListener('focus', () => { if (items.length) draw(); });
      }
      if (!document.getElementById('ar-sug-css')) { const st = document.createElement('style'); st.id = 'ar-sug-css'; st.textContent = `
        .ar-sug{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:30;background:var(--panel);border:1px solid var(--line);border-radius:var(--r-l);box-shadow:0 10px 30px rgba(0,0,0,.12);padding:4px;max-height:420px;overflow:auto}
        .ar-sg{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;background:none;color:inherit;padding:6px 8px;border-radius:var(--r);cursor:pointer;font:inherit}
        .ar-sg.on,.ar-sg:hover{background:var(--hover,rgba(127,127,127,.1))}
        .ar-sg-im{flex:none;width:36px;height:36px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:var(--line);color:var(--muted)}
        .ar-sg-im img{width:100%;height:100%;object-fit:cover} .ar-sg-im svg{width:16px;height:16px}
        .ar-sg-t{display:flex;flex-direction:column;min-width:0} .ar-sg-t b{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap} .ar-sg-t small{color:var(--muted);font-size:12px}`;
        document.head.appendChild(st); }
      // artists in ⌘K, from the same search as the suggestions above (NAS only)
      api.search.add(async q => {
        if (api.system().mode !== 'nas') return [];
        const r = await fetch('api/radar/find?q=' + encodeURIComponent(q)); if (!r.ok) return [];
        return (await r.json()).slice(0, 4).map(a => ({ title: a.name, k: ['artist', a.kexp ? `KEXP ${a.kexp.toLocaleString('en-CA')} plays` : '', a.radar ? 'on Radar' : ''].filter(Boolean).join(' · '),
          run: () => { window.CadenceArtist.open(a.name); location.hash = 'view-artist'; } }));
      });
      api.views.add({ id: 'artists', group: 'music', order: 60, title: 'Artists', icon: '🎤', subtitle: 'Look anyone up, or go back to who you looked at', render: el => {
        let recent = []; try { recent = JSON.parse(localStorage.getItem('cadence.recentArtists') || '[]'); } catch (e) {}
        const saved = [...new Set((PV.want || []).map(x => x.artist))].filter(a => !recent.some(r => r.toLowerCase() === a.toLowerCase()));
        const chips = list => `<div class="ars">${list.map(a => `<a class="ar-chip" href="#view-artist" data-artist="${E(a)}">${E(a)}</a>`).join('')}</div>`;
        el.innerHTML = `<div class="sg"><form id="ar-find" class="ar-find"><input class="inp" id="ar-q" placeholder="Any artist or band" aria-label="Artist name" autocomplete="off"><button class="btn primary" type="submit">Look up</button></form>
          ${(() => { const F = window.CadenceFollow.peek(); if (!F.follows.length) return '<h3>Following</h3><p class="muted">Follow an artist from their page to hear when they turn up: a blog post, a release, a chart, KEXP or a station playing them, a show nearby. Following someone also keeps them off your mainstream list.</p>';
            const by = {}; for (const n of F.news) (by[n.key] ||= []).push(n);
            return `<div class="fw-head"><h3>Following</h3>${F.news.length ? '<button class="linkish" id="fw-seen">Mark everything as seen</button>' : ''}</div><ul class="fw-l">${F.follows.map(f => `<li><div class="fw-n"><a class="ar-link" href="#view-artist" data-artist="${E(f.name)}"><b>${E(f.name)}</b></a>
              <button class="linkish fw-x" data-unfollow="${E(f.name)}">Unfollow</button></div>${(by[f.key] || []).length ? `<ul class="fw-news">${by[f.key].slice(0, 6).map(n => `<li>${n.url ? `<a href="${E(n.url)}" target="_blank" rel="noopener">${api.ui.logo(n.url, { size: 13 })}${E(n.text)}</a>` : E(n.text)}</li>`).join('')}${by[f.key].length > 6 ? `<li class="muted">and ${by[f.key].length - 6} more</li>` : ''}</ul>` : '<span class="muted">Nothing new since you last looked</span>'}</li>`).join('')}</ul>`; })()}
          <h3>Looked at lately</h3>${recent.length ? chips(recent) : '<p class="muted">Artists you open from Radar, Radio or KEXP history show up here.</p>'}
          ${saved.length ? `<h3>From Want to hear</h3>${chips(saved)}` : ''}
          ${recent.length ? '<p><button class="linkish" id="ar-clear">Clear the list</button></p>' : ''}</div>`;
        el.querySelector('#ar-find').onsubmit = e => { e.preventDefault(); const q = el.querySelector('#ar-q').value.trim(); if (q) { window.CadenceArtist.open(q); location.hash = 'view-artist'; } };
        suggest(el.querySelector('#ar-q'), [...recent, ...saved]);
        const c = el.querySelector('#ar-clear'); if (c) c.onclick = () => { localStorage.removeItem('cadence.recentArtists'); api.ui.refresh(); };
        if (!PV.want) wantList().then(() => api.ui.currentRoute() === 'view-artists' && api.ui.refresh());
        if (!FW.d) window.CadenceFollow.load().then(() => api.ui.currentRoute() === 'view-artists' && api.ui.refresh());
        const fs = el.querySelector('#fw-seen'); if (fs) fs.onclick = () => window.CadenceFollow.seen().then(() => { localStorage.setItem('cadence.followNoted', '[]'); api.ui.refresh(); });
        el.querySelectorAll('[data-unfollow]').forEach(b => b.onclick = () => window.CadenceFollow.remove(b.dataset.unfollow).then(() => { api.ui.toast('Stopped following ' + b.dataset.unfollow); api.ui.refresh(); }));
      } });

      // the Want to hear page: everything you saved, to listen through
      // ---- Your year in music: from what you actually listened to (user, 2026-11-16) ----
      const YR = { d: null, y: null, at: 0 };
      const yrLoad = async y => { try { YR.d = await (await fetch('api/radar/year' + (y ? '?y=' + y : ''))).json(); } catch (e) { YR.d = { error: e.message }; } YR.at = Date.now(); if (api.ui.currentRoute() === 'view-year') api.ui.refresh(); };
      api.views.add({ id: 'year', group: 'music', order: 70, title: 'Your year', icon: '📅', subtitle: 'Your year in music, from what you listened to', render: el => {
        if (api.system().mode !== 'nas') { el.innerHTML = '<p class="muted">Your year in music needs the NAS.</p>'; return; }
        const d = YR.d;
        if (!d || Date.now() - YR.at > 10 * 60e3) { yrLoad(YR.y); if (!d) { el.innerHTML = '<div class="yr" aria-busy="true"><i class="sk sk-l" style="width:30%;height:22px"></i><div class="yr-tiles">' + '<i class="sk" style="height:76px"></i>'.repeat(4) + '</div></div>'; return; } }
        if (d.error) { el.innerHTML = `<p class="muted">Couldn't put it together: ${E(d.error)}</p>`; return; }
        const max = Math.max(1, ...d.months), mon = i => new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'short' });
        const hrs = m => m >= 120 ? Math.round(m / 60) + ' hours' : m + ' minutes';
        el.innerHTML = `<div class="yr">
          <div class="yr-head"><h2>${d.year} in music</h2>${d.years.length > 1 ? `<select class="inp" id="yr-y">${d.years.map(y => `<option ${y === d.year ? 'selected' : ''}>${y}</option>`).join('')}</select>` : ''}</div>
          ${!d.songs ? '<p class="muted">Nothing yet. Every preview you play and every song you hear on a station adds to it.</p>' : `
          <div class="yr-tiles"><div><b>${E(hrs(d.minutes))}</b><span>listening</span></div><div><b>${d.artistsCount.toLocaleString()}</b><span>artists</span></div>
            <div><b>${d.live.toLocaleString()}</b><span>songs on the radio</span></div><div><b>${d.previews.toLocaleString()}</b><span>previews played</span></div>
            ${d.follows ? `<div><b>${d.follows}</b><span>artists followed</span></div>` : ''}${d.saved ? `<div><b>${d.saved}</b><span>saved to Want to hear</span></div>` : ''}</div>
          <div class="yr-grid">
            <section><h3>Who you listened to most</h3><ol class="yr-l">${d.artists.map(a => `<li>${window.CadencePreview.buttons(a.artist, null, 'artist', 'Your year')}<div><a class="ar-link" href="#view-artist" data-artist="${E(a.artist)}"><b>${E(a.artist)}</b></a><span class="muted">${E(hrs(a.minutes))}${a.songs.length ? ' · ' + E(a.songs.join(', ')) : ''}</span></div></li>`).join('')}</ol></section>
            <section><h3>Month by month</h3><div class="yr-m">${d.months.map((m, i) => `<div title="${E(hrs(m))}"><i style="height:${Math.round(m / max * 100)}%"></i><span>${E(mon(i))}</span></div>`).join('')}</div>
              ${d.genres.length ? `<h3>Your sound</h3><div class="ap-tags">${d.genres.map(g => `<span>${E(g)}</span>`).join('')}</div>` : ''}
              ${d.stations.length ? `<h3>Your stations</h3><ul class="yr-s">${d.stations.map(x => `<li><span>${E(x.station)}</span><span class="muted">${E(hrs(x.minutes))}</span></li>`).join('')}</ul>` : ''}
              ${d.early.length ? `<h3>${api.ui.icon('trophy')}Found early</h3><ul class="yr-s">${d.early.map(x => `<li><span><a class="ar-link" href="#view-artist" data-artist="${E(x.artist)}">${E(x.artist)}</a></span><span class="muted">${x.days} days before ${E(x.what)}</span></li>`).join('')}</ul>` : ''}</section>
          </div>`}</div>`;
        const ys = el.querySelector('#yr-y'); if (ys) ys.onchange = () => { YR.y = +ys.value; YR.d = null; yrLoad(YR.y); };
      } });

      // ---- Friday mix: a new set of previews every Friday (user, 2026-11-16) ----
      const MX = { d: null, at: 0, week: null };
      const mxLoad = async (opts = {}) => {
        try { MX.d = opts.again ? await (await fetch('api/radar/mix', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ again: true }) })).json()
          : await (await fetch('api/radar/mix' + (opts.week ? '?week=' + encodeURIComponent(opts.week) : ''))).json(); } catch (e) { MX.d = { error: e.message }; }
        if (!opts.week && MX.d && MX.d.weeks) MX.weeks = MX.d.weeks;
        MX.at = Date.now(); if (api.ui.currentRoute() === 'view-mix') api.ui.refresh();
      };
      const bcUrl = a => 'https://bandcamp.com/search?q=' + encodeURIComponent(a) + '&item_type=b';
      const GROUPS = [['foryou', 'For you'], ['follow', 'New from people you follow'], ['rising', 'Climbing fast'], ['wild', 'Wildcards']];
      api.views.add({ id: 'mix', group: 'music', order: 12, title: 'Friday mix', icon: '💿', subtitle: 'A new set of previews every Friday, picked for you', render: el => {
        if (api.system().mode !== 'nas') { el.innerHTML = '<p class="muted">The Friday mix needs the NAS.</p>'; return; }
        const d = MX.d;
        if (!d || (!MX.week && Date.now() - MX.at > 10 * 60e3)) { if (!d) { el.innerHTML = '<p class="muted">Putting this week\'s mix together…</p>'; mxLoad(); return; } mxLoad(); }
        if (d.error) { el.innerHTML = `<p class="muted">Couldn't make the mix: ${E(d.error)}</p>`; return; }
        const day = w => new Date(w + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        const items = d.items || [];
        el.innerHTML = `<div class="mx">
          <div class="mx-head"><div><h2>Week of ${E(day(d.week))}</h2><p class="muted">${items.length} picks: for you, new from people you follow, climbing fast, and a few wildcards</p></div>
            <div class="mx-act">${items.length ? `<button class="btn primary" id="mx-all">${api.ui.icon('play')}Play all</button><button class="btn" id="mx-save">${api.ui.icon('bookmark-plus')}Save all to Want to hear</button>` : ''}
              ${!MX.week ? `<button class="btn ghost" id="mx-again">${api.ui.icon('refresh-cw')}Make a new one</button>` : ''}
              ${(MX.weeks || []).length > 1 ? `<select class="inp" id="mx-week">${MX.weeks.map(w => `<option value="${E(w)}" ${w === d.week ? 'selected' : ''}>${E(day(w))}</option>`).join('')}</select>` : ''}</div></div>
          ${items.length ? GROUPS.map(([g, label]) => { const l = items.filter(x => x.group === g); return l.length ? `<h3>${label}</h3><ol class="mx-l">${l.map(x => `<li>${window.CadencePreview.buttons(x.artist, x.title, x.type, 'Friday mix')}
              <div class="mx-t"><span><a class="ar-link" href="#view-artist" data-artist="${E(x.artist)}"><b>${E(x.artist)}</b></a>${x.title ? ' — ' + E(x.title) : ''}${DG.chip(x.artist, x.title)}</span><span class="muted">${E(x.why)}</span></div>
              <a class="mx-bc" href="${E(bcUrl(x.artist))}" target="_blank" rel="noopener" title="Find ${E(x.artist)} on Bandcamp">${api.ui.logo('bandcamp.com', { size: 14 })}Bandcamp</a></li>`).join('')}</ol>` : ''; }).join('')
            : '<p class="muted">Nothing to put in it yet. Follow a few artists or let Music Radar run a couple of scans.</p>'}</div>`;
        const all = el.querySelector('#mx-all'); if (all) all.onclick = () => window.CadencePreview.playAll(items.map(x => ({ artist: x.artist, title: x.title })));
        const sv = el.querySelector('#mx-save'); if (sv) sv.onclick = async () => { for (const x of items) if (!window.CadencePreview.want.has(x.artist, x.title)) await window.CadencePreview.want.add({ artist: x.artist, title: x.title, type: x.type, from: 'Friday mix' }); api.ui.toast(`Saved ${items.length} to Want to hear`); api.ui.refresh(); };
        const ag = el.querySelector('#mx-again'); if (ag) ag.onclick = () => { api.ui.toast('Making a new mix'); mxLoad({ again: true }); };
        const wk = el.querySelector('#mx-week'); if (wk) wk.onchange = () => { const w = wk.value; MX.week = w === MX.weeks[0] ? null : w; MX.d = null; mxLoad(MX.week ? { week: w } : {}); };
      } });

      api.views.add({ id: 'want', group: 'music', order: 40, title: 'Want to hear', icon: '🎧', subtitle: 'Music you saved to listen to', render: el => {
        const list = PV.want;
        if (!list) { el.innerHTML = api.ui.skeleton(4); wantList(true).then(() => api.ui.refresh()); return; }
        el.innerHTML = `<div class="wh">${list.length ? `<button class="btn primary" id="wh-all">${api.ui.icon('play')}Play all previews</button>
          <ul class="wh-l">${list.map(x => `<li>${window.CadencePreview.buttons(x.artist, x.title, x.type, x.from)}<div><span><a class="ar-link" href="#view-artist" data-artist="${E(x.artist)}"><b>${E(x.artist)}</b></a>${x.title ? ' — ' + E(x.title) : ''}${DG.chip(x.artist, x.title)}</span>
            <span class="muted">${x.from ? 'from ' + E(x.from) + ' · ' : ''}saved ${new Date(x.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></div>
            ${x.title && window.CadenceDiscogs && !DG.owns(x.artist, x.title) ? `<button class="btn sm ghost dg-wb" data-dg-want="${E(x.artist)}" data-dg-title="${E(x.title)}" data-on="${DG.wants(x.artist, x.title) ? 1 : ''}">${DG.wants(x.artist, x.title) ? 'On your Discogs wantlist' : 'Add to my Discogs wantlist'}</button>` : ''}</li>`).join('')}</ul>`
          : '<p class="muted">Nothing saved yet. Use the bookmark next to any pick in Music Radar or on an artist page.</p>'}</div>`;
        const all = el.querySelector('#wh-all'); if (all) all.onclick = () => window.CadencePreview.playAll(list);
        el.querySelectorAll('[data-dg-want]').forEach(b => b.onclick = async () => {
          const on = !!b.dataset.on; b.disabled = true; const r = await DG.want(b.dataset.dgWant, b.dataset.dgTitle, !on);
          api.ui.toast(r.ok ? (on ? 'Taken off your Discogs wantlist' : 'Added to your Discogs wantlist') : r.off ? 'Add DISCOGS_TOKEN to .env on the NAS to use your Discogs wantlist' : r.none ? "Discogs doesn't have that album" : "Couldn't reach Discogs just now. Try again in a moment.");
          api.ui.refresh();
        });
      } });
      // Pages you've opened are remembered in this browser (the last 40), so opening one again draws at once and then
      // updates quietly; the NAS keeps its own copy too and rebuilds it in the background (user, 2026-11-16).
      const KEEP = (() => {
        let dbp = null; const dbo = () => dbp || (dbp = new Promise((ok, no) => { try { const r = indexedDB.open('cadence-artists', 1); r.onupgradeneeded = () => r.result.createObjectStore('p'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); } catch (e) { no(e); } }));
        const st = (mode, fn) => dbo().then(db => new Promise((ok, no) => { const t = db.transaction('p', mode), q = fn(t.objectStore('p')); t.oncomplete = () => ok(q && q.result); t.onerror = () => no(t.error); }));
        return {
          get: k => st('readonly', s => s.get(k)).catch(() => null),
          put: (k, d) => st('readwrite', s => s.put({ d, at: Date.now() }, k)).then(() => st('readonly', s => s.getAllKeys())).then(async keys => {
            if (keys.length <= 40) return;
            const all = await Promise.all(keys.map(x => st('readonly', s => s.get(x)).then(v => [x, v ? v.at : 0])));
            all.sort((a, b) => a[1] - b[1]); for (const [x] of all.slice(0, keys.length - 40)) await st('readwrite', s => s.delete(x));
          }).catch(() => {})
        };
      })();
      const again = (name, k, ms) => setTimeout(() => { if (current && current.toLowerCase() === k && api.ui.currentRoute() === 'view-artist') load(name, true); }, ms);
      const load = (name, force) => {
        const k = name.toLowerCase(), c = G[k];
        if (c && !force && (c.busy || Date.now() - c.at < 60e3)) return c.d;
        G[k] = { d: c && c.d, at: Date.now(), busy: true };
        // nothing in memory yet: draw what this browser kept while the NAS answers
        if (!c) KEEP.get(k).then(v => { if (v && G[k] && G[k].busy && !G[k].d) { G[k].d = v.d; if (api.ui.currentRoute() === 'view-artist') api.ui.refresh(); } });
        const tries = force ? (c && c.tries) || 0 : 0;
        fetch('api/radar/artist?name=' + encodeURIComponent(name)).then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
          .then(d => {
            G[k] = { d, at: Date.now(), tries: tries + 1 }; if (d && !d.error) KEEP.put(k, d);
            // the NAS answered from its copy and is rebuilding: pick the new one up shortly (a few times at most)
            if (d && (d.refreshing || d.mbPending || d.adbPending) && tries < 6) { G[k].tries = tries + 1; again(name, k, d.refreshing ? 2500 : 5000); }
          }, e => { G[k] = { d: (c && c.d) || (G[k] && G[k].d) || { error: e.message }, at: Date.now() }; })
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
        if (!d) { el.innerHTML = `<div class="ap" aria-busy="true"><header class="ap-head"><i class="ap-img sk"></i><div class="ap-skh"><h2>${E(current)}</h2><i class="sk sk-l" style="width:46%"></i><i class="sk sk-l" style="width:62%"></i><i class="sk sk-b"></i></div></header>
          <div class="ap-grid">${[0, 1, 2].map(() => `<section><i class="sk sk-l" style="width:40%;height:16px"></i>${[80, 64, 72, 58].map(w => `<i class="sk sk-l" style="width:${w}%"></i>`).join('')}</section>`).join('')}</div></div>`; return; }
        if (d.error) { el.innerHTML = `<div class="ap"><h2>${E(current)}</h2><p class="muted">Couldn't load this artist right now.</p></div>`; return; }
        const mb = d.mb, k = d.kexp, ad = d.adb;
        // images from TheAudioDB go through the NAS (kept there), like every other logo
        const kept = u => (u ? 'api/logo?u=' + encodeURIComponent(u) : '');
        const formed = (mb && mb.since && year(mb.since)) || (ad && (ad.formed || ad.born)) || null;
        const facts = [mb && mb.type, (mb && (mb.from || mb.country)) || (ad && ad.country), formed && `since ${formed}${(mb && mb.ended) || (ad && ad.disbanded) ? ' (ended)' : ''}`,
          ad && ad.members > 1 && `${ad.members} members`, ad && ad.label, d.radar && d.radar.listeners && `${d.radar.listeners.toLocaleString()} ${d.radar.listenersFrom === 'lb' ? 'ListenBrainz' : 'Last.fm'} listeners`].filter(Boolean);
        const tags = [...new Set([...(d.genres || []), ...((mb && mb.tags) || []), ...(ad ? [ad.genre, ad.style, ad.mood].filter(Boolean) : [])].map(t => t.toLowerCase()))].slice(0, 12);
        // links: MusicBrainz first, then anything TheAudioDB adds on a site MusicBrainz didn't list
        const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
        const links = [...((mb && mb.links) || [])]; for (const l of (ad && ad.links) || []) if (!links.some(x => host(x.url) === host(l.url))) links.push(l);
        // the two databases side by side, marking where they disagree
        const cmpRows = mb && ad ? [
          ['Formed', mb.since ? year(mb.since) : null, ad.formed || ad.born],
          ['From', mb.from || mb.country, ad.country],
          ['Kind', mb.type, ad.members > 1 ? `Group of ${ad.members}` : ad.members === 1 || ad.gender ? 'Person' : null],
          ['Genre', (mb.tags || []).slice(0, 3).join(', '), [ad.genre, ad.style].filter(Boolean).join(', ')],
          ['Label', null, ad.label]].filter(x => x[1] || x[2]) : [];
        const differs = (a, b) => { if (!a || !b) return false; const A = String(a).toLowerCase(), B = String(b).toLowerCase(); return !(A.includes(B) || B.includes(A) || A.split(/[ ,]+/).some(w => w.length > 3 && B.includes(w))); };
        const charts = d.mentions.filter(m => m.rank != null), other = d.mentions.filter(m => m.rank == null);
        const bigArt = u => String(u || '').replace(/-250\.jpg$/, '-500.jpg').replace(/_thumb250\.jpg$/, '_thumb500.jpg') || null;
        const art = (ad && ad.photo && kept(ad.photo)) || d.art || (mb && mb.releases[0] && mb.releases[0].cover) || (k && k.image && bigArt(k.image));
        // links KEXP's DJs put in their comments about this artist's songs (Bandcamp, YouTube, their site…)
        const djl = (k && k.links) || [], djBc = djl.find(l => l.kind === 'bandcamp');
        el.innerHTML = `<div class="ap">
          ${ad && ad.banner ? `<img class="ap-banner" src="${E(kept(ad.banner))}" alt="" width="1000" height="185" onerror="this.remove()">` : !ad && d.adbPending ? '<i class="ap-banner sk" aria-hidden="true"></i>' : ''}
          <header class="ap-head${ad && ad.fanart && !ad.banner ? ' ap-fan' : ''}"${ad && ad.fanart && !ad.banner ? ` style="--fan:url('${E(kept(ad.fanart))}')"` : ''}>${art ? `<img class="ap-img" src="${E(art)}" alt="" width="150" height="150" onerror="this.replaceWith(Object.assign(document.createElement('i'),{className:'ap-img ap-noimg'}))">` : !ad && d.adbPending ? '<i class="ap-img sk"></i>' : `<i class="ap-img ap-noimg">${api.ui.icon('user')}</i>`}
            <div>${ad && ad.logo && !ad.banner ? `<span class="ap-logo"><img src="${E(kept(ad.logo))}" alt="${E(d.name)} logo" onerror="this.parentNode.remove()"></span>` : ''}<h2>${E(d.name)}</h2>${mb && mb.disambiguation ? `<p class="muted">${E(mb.disambiguation)}</p>` : ''}
              ${facts.length ? `<p class="ap-facts">${facts.map(E).join(' · ')}</p>` : ''}
              ${d.called && d.called.lead > 0 ? `<p class="ap-called">${api.ui.icon('trophy')}Radar spotted them on ${E(d.called.via)}, ${d.called.milestones.map(m => `${m.days} days before ${E(m.what)}`).join(' and ')}</p>` : ''}
              ${d.sound ? `<p class="muted ap-sound" title="Read from the previews you've played">${api.ui.icon('audio-waveform')}${E(d.sound.words)} <span>(from ${d.sound.songs} preview${d.sound.songs === 1 ? '' : 's'})</span></p>` : ''}
              ${tags.length ? `<div class="ap-tags">${tags.map(t => `<span>${E(t)}</span>`).join('')}</div>` : ''}
              ${DG.artistBlock(d.name)}<div class="ap-links">${(() => { if (!window.CadenceFollow.loaded()) window.CadenceFollow.load(); const f = window.CadenceFollow.has(d.name); return `<button class="btn${f ? '' : ' primary'}" data-follow="${E(d.name)}" aria-pressed="${f}">${api.ui.icon(f ? 'user-check' : 'user-plus')}${f ? 'Following' : 'Follow'}</button>`; })()}<button class="btn" data-pv data-a="${E(d.name)}">${api.ui.icon('play')}Play a preview</button>${(() => { const on = window.CadencePreview.want.has(d.name, null);
                return `<button class="btn" data-want data-a="${E(d.name)}" data-type="artist" data-from="artist page">${api.ui.icon(on ? 'bookmark-check' : 'bookmark-plus')}${on ? 'In Want to hear' : 'Save to Want to hear'}</button>`; })()}${(() => { const no = window.CadenceNfm.has('artist', d.name);
                return `<button class="btn ghost" data-nfm-type="artist" data-nfm-value="${E(d.name)}"${no ? ' data-nfm-off="1"' : ''} aria-pressed="${no}" title="${no ? 'Show them in Music Radar again' : 'Hide them in Music Radar, and For you learns from it'}">${api.ui.icon(no ? 'eye' : 'eye-off')}${no ? 'Not for me (undo)' : 'Not for me'}</button>`; })()}</div>
              ${(() => { const bc = links.find(l => /bandcamp\.com/.test(l.url)) || djBc; return `<div class="ap-links"><a class="btn" href="${E(bc ? bc.url : 'https://bandcamp.com/search?q=' + encodeURIComponent(d.name) + '&item_type=b')}" target="_blank" rel="noopener">${api.ui.logo('bandcamp.com', { size: 15 })}${bc ? 'Buy on Bandcamp' : 'Find on Bandcamp'}</a></div>`; })()}
              ${djl.filter(l => l !== djBc || links.some(x => /bandcamp\.com/.test(x.url))).length ? `<div class="ap-links ap-listen"><span class="muted">Picked by KEXP's DJs:</span>${djl.filter(l => l !== djBc || links.some(x => /bandcamp\.com/.test(x.url))).map(l => `<a class="btn" href="${E(l.url)}" target="_blank" rel="noopener">${api.ui.logo(l.url, { size: 15 }) || api.ui.icon(l.kind === 'website' ? 'globe' : 'external-link')}${E({ bandcamp: 'Bandcamp', youtube: 'YouTube', soundcloud: 'SoundCloud', spotify: 'Spotify', apple: 'Apple Music', instagram: 'Instagram', website: 'Website' }[l.kind] || l.kind)}</a>`).join('')}</div>` : ''}
              ${(d.listen || []).length ? `<div class="ap-links ap-listen"><span class="muted">Listen from the blogs:</span>${d.listen.map(l => `<a class="btn" href="${E(l.url)}" target="_blank" rel="noopener" title="${E((l.title || '') + (l.feed ? ' (from ' + l.feed + ')' : ''))}">${api.ui.logo(l.kind + '.com', { size: 15 })}${E({ bandcamp: 'Bandcamp', spotify: 'Spotify', soundcloud: 'SoundCloud' }[l.kind] || l.kind)}${l.feed ? ` <span class="muted">${E(l.feed)}</span>` : ''}</a>`).join('')}</div>` : ''}
              ${links.some(l => !/bandcamp\.com/.test(l.url)) ? `<div class="ap-links">${links.filter(l => !/bandcamp\.com/.test(l.url)).map(l => A(l.url, `${api.ui.logo(l.url, { size: 15 }) || api.ui.icon(l.kind === 'website' ? 'globe' : 'external-link')}${E(LINK_NAMES[l.kind] || l.kind)}`, 'btn')).join('')}</div>` : ''}
              ${d.mbPending || d.adbPending ? `<p class="muted ap-wait">Looking up ${d.mbPending ? 'releases and links' : 'photos, logo and biography'}…</p>` : ''}
              ${d.mainstream ? `<p class="muted">Hidden from Music Radar by your mainstream filter.</p>` : ''}</div></header>

          <div class="ap-grid">
          ${ad && ad.bio ? `<section class="ap-wide ap-about"><h3>${api.ui.logo('theaudiodb.com')}About</h3>${(() => { const b = ad.bio, cut = b.length > 700 ? b.slice(0, 700).replace(/\s+\S*$/, '') : b;
            return `<p>${E(cut).replace(/\n+/g, '</p><p>')}${cut !== b ? '…' : ''}</p>${cut !== b ? `<details><summary>Read the rest</summary><p>${E(b.slice(cut.length)).replace(/\n+/g, '</p><p>')}</p></details>` : ''}`; })()}
            <p class="muted ap-credit">From ${A(ad.page, 'TheAudioDB')}</p></section>` : ''}
          ${!mb && d.mbPending ? `<section class="ap-wide" aria-busy="true"><h3>${api.ui.logo('musicbrainz.org')}Releases</h3><div class="ap-rel">${'<span class="ap-r"><i class="ap-cover sk"></i><i class="sk sk-l" style="width:80%"></i><i class="sk sk-l" style="width:50%"></i></span>'.repeat(6)}</div></section>` : ''}
          ${mb && mb.releases.length ? `<section class="ap-wide"><h3>${api.ui.logo('musicbrainz.org')}Releases</h3>${window.CadenceCoverFlow
            // Cover Flow, the record bin or the grid (public/plugins/coverflow.js; user, 2026-11-18)
            ? window.CadenceCoverFlow.html(mb.releases.slice(0, 40).map(r => ({ ...r, link: 'https://musicbrainz.org/release-group/' + encodeURIComponent(r.id) })), { key: 'artist:' + d.name.toLowerCase(), artist: d.name })
            : `<div class="ap-rel">${mb.releases.slice(0, 18).map(r => `<a class="ap-r" href="https://musicbrainz.org/release-group/${E(r.id)}" target="_blank" rel="noopener">
              <span class="ap-cover"><img src="${E(r.cover)}" alt="" loading="lazy" onerror="this.remove()">${api.ui.icon('disc-3')}</span><b>${E(r.title)}</b><span class="muted">${E([year(r.date), r.type].filter(Boolean).join(' · '))}</span></a>`).join('')}</div>`}
            ${window.CadenceCoverFlow ? '' : `<p class="ap-relplay">${mb.releases.slice(0, 6).map(r => `<button class="btn" data-pv data-a="${E(d.name)}" data-t="${E(r.title)}">${api.ui.icon('play')}${E(r.title)}</button>`).join('')}</p>`}</section>` : ''}

          ${cmpRows.length ? `<section class="ap-cmp"><h3>MusicBrainz and TheAudioDB side by side</h3><table><tr><th></th><th>${api.ui.logo('musicbrainz.org', { size: 13 })}MusicBrainz</th><th>${api.ui.logo('theaudiodb.com', { size: 13 })}TheAudioDB</th></tr>
            ${cmpRows.map(([l, a, b]) => `<tr class="${differs(a, b) ? 'diff' : ''}"><th>${E(l)}</th><td>${a ? E(a) : '<span class="muted">not listed</span>'}</td><td>${b ? E(b) : '<span class="muted">not listed</span>'}</td></tr>`).join('')}</table>
            ${cmpRows.some(([, a, b]) => differs(a, b)) ? '<p class="muted">Highlighted rows: the two disagree.</p>' : '<p class="muted">They agree wherever both have an answer.</p>'}</section>` : ''}
          ${(() => { const l = tdArtists(d.name, (d.similar || []).map(x => x.name)); return l.length ? `<section class="ap-wide"><h3>${api.ui.icon('users')}Fans also like</h3><ul class="ap-sim">${l.map(x => `<li>${window.CadencePreview.buttons(x.name, null, 'artist', 'Fans of ' + d.name)}<div><a class="ar-link" href="#view-artist" data-artist="${E(x.name)}"><b>${E(x.name)}</b></a>${x.teaser ? `<span class="muted">${E(x.teaser.length > 120 ? x.teaser.slice(0, 120) + '…' : x.teaser)}</span>` : ''}</div></li>`).join('')}</ul><p class="muted ap-credit">Suggestions from TasteDive</p></section>` : ''; })()}
          ${(d.similar || []).length ? `<section class="ap-wide"><h3>${api.ui.icon('sparkles')}Sounds like</h3><ul class="ap-sim">${d.similar.map(x => `<li>${window.CadencePreview.buttons(x.name, null, 'artist', 'Sounds like ' + d.name)}<div><a class="ar-link" href="#view-artist" data-artist="${E(x.name)}"><b>${E(x.name)}</b></a><span class="muted">${E(x.why)}</span></div></li>`).join('')}</ul></section>` : ''}
          <section><h3>Where they're showing up</h3>
            ${other.length || d.picks.length ? `<ul class="ap-list">
              ${other.slice(0, 30).map(m => `<li><span class="ap-src">${api.ui.logo(m.url || '', { size: 14 })}${E(m.feed || m.sourceName)}</span><div>${m.url ? A(m.url, E(m.title || d.name)) : E(m.title || d.name)}<span class="muted">${E(m.sourceName)}${m.tier === 'small' ? ' · small blog' : ''} · ${day(m.first)}${m.seen > 1 ? ` · seen ${m.seen} times` : ''}</span></div></li>`).join('')}
              ${d.picks.map(p => `<li><span class="ap-src">${api.ui.logo(p.link || p.thread || '', { size: 14 })}${E((p.subs || []).slice(0, 2).join(', ') || 'Communities')}</span><div>${p.link ? A(p.link, E(p.song || 'recommended')) : E(p.song || 'recommended')}<span class="muted">Lemmy & Mastodon · ${day(p.ts)}${p.thread ? ' · ' + A(p.thread, 'discussion') : ''}</span></div></li>`).join('')}
            </ul>` : `<p class="muted">${(() => {
              const also = [d.stg && d.stg.length ? "Said the Gramophone's best-of lists" : null, k && k.plays ? `KEXP (${k.plays.toLocaleString()} plays)` : null].filter(Boolean);
              return also.length ? `No blog, chart or community has mentioned them lately. They do turn up on ${E(also.join(' and '))}, further down.` : 'No blog, chart or community has mentioned them yet.';
            })()}</p>`}</section>

          <section><h3>Charts</h3>
            ${charts.length ? `<ul class="ap-list">${charts.map(m => { const run = (m.run || []).map(x => x.rank); const first = run[0], lastR = run[run.length - 1];
              return `<li><span class="ap-src">${api.ui.logo(m.url || '', { size: 14 })}${E(m.sourceName)}</span><div>${E(m.feed || '')}${m.title ? ' · ' + E(m.title) : ''}<span class="muted">now #${m.rank}${m.best && m.best !== m.rank ? `, best #${m.best}` : ''}${run.length > 1 ? ` · #${first} → #${lastR} over ${run.length} checks` : ''}</span>
                ${run.length > 1 ? spark(run) : ''}</div></li>`; }).join('')}</ul>` : '<p class="muted">Not on any chart THING follows.</p>'}</section>

          ${d.stg && d.stg.length ? `<section><h3>${api.ui.logo('saidthegramophone.com')}On Said the Gramophone's best-of lists</h3><ul class="ap-list ap-stg">${d.stg.map(x => `<li><span class="ap-src">${x.year}</span><div><span>${x.kind === 'song' ? `#${x.rank} song: ` : 'Album of the year: '}${A(x.url, E(x.title))}</span></div>${window.CadencePreview.buttons(d.name, x.title, x.kind, "Said the Gramophone " + x.year)}</li>`).join('')}</ul></section>` : ''}

          <section><h3>${api.ui.logo('kexp.org')}On KEXP</h3>
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
        .ap-img{width:120px;height:120px;border-radius:var(--r-l);object-fit:cover;flex:none;background:var(--accent-soft)} .ap-noimg{display:grid;place-items:center;color:var(--accent)} .ap-noimg svg{width:40px;height:40px}
        .ap-head h2{margin:0 0 4px;font-size:26px} .ap-facts{margin:4px 0;color:var(--muted)}
        .ap-tags{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0} .ap-tags span{font-size:12px;border:1px solid var(--line);border-radius:999px;padding:1px 8px}
        .ap-links{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px} .ap-listen{align-items:center} .dg-chip{display:inline-block;margin-left:6px;padding:0 7px;border-radius:999px;font-size:11px;line-height:18px;background:var(--accent-soft);color:var(--text);vertical-align:1px;white-space:nowrap}.dg-chip.own{background:color-mix(in srgb,var(--ok,#3a9a5b) 18%,transparent)}
    .dg-ap{display:flex;flex-wrap:wrap;gap:16px;margin:12px 0}.dg-ap h4,.dg-card h4{margin:0 0 6px;font-size:13px;color:var(--muted);font-weight:600}
    .dg-recs{display:flex;flex-wrap:wrap;gap:8px}.dg-rec{display:flex;align-items:center;gap:8px;max-width:260px;padding:4px 8px 4px 4px;border:1px solid var(--line);border-radius:10px;color:inherit;text-decoration:none}
    .dg-rec:hover{border-color:var(--accent)}.dg-rec img,.dg-noimg{width:40px;height:40px;border-radius:6px;object-fit:cover;flex:none;background:var(--hover)}.dg-rec>span{display:flex;flex-direction:column;min-width:0}
    .dg-rec b{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dg-rec .muted{font-size:12px}.dg-shelf{display:flex;flex-direction:column;gap:4px;margin:8px 0 12px}.dg-wb{margin-left:auto}
    .ap-sound{display:flex;align-items:center;gap:6px;margin:6px 0 0;font-size:13px} .ap-sound svg{width:14px;height:14px} .ap-listen>.muted{font-size:13px} .ap-links .btn{display:inline-flex;gap:6px;align-items:center;font-size:13px} .ap-links svg{width:14px;height:14px}
        .ap-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px} .ap-wide{grid-column:1/-1} .ap h3{margin:0 0 8px;font-size:15px} .ap h4{margin:12px 0 6px;font-size:13px}
        .ap-rel{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px} .ap-r{display:flex;flex-direction:column;gap:2px;color:inherit;text-decoration:none;font-size:13px}
        .ap-cover{position:relative;aspect-ratio:1;border-radius:var(--r-m);background:var(--accent-soft);display:grid;place-items:center;overflow:hidden;color:var(--accent)} .ap-cover img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
        .ap-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px} .ap-list li{display:grid;grid-template-columns:110px 1fr;gap:10px;font-size:13px}
        .ap-list li>div{display:flex;flex-direction:column;gap:1px;min-width:0} .ap-list .muted{font-size:12px}
        .ap .cx-logo,.sh .cx-logo,.sg .cx-logo{vertical-align:-2px} .ap-src .cx-logo{margin-right:5px} .ap-links .btn .cx-logo{margin:0}
        .yr-head{display:flex;align-items:center;gap:12px} .yr-head h2{margin:0} .yr-head .inp{width:auto}
        .yr-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin:14px 0 18px} .yr-tiles>div{border:1px solid var(--line);border-radius:var(--r-l);padding:12px 14px;background:var(--panel)} .yr-tiles b{display:block;font-size:22px} .yr-tiles span{color:var(--muted);font-size:13px}
        .yr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:22px} .yr h3{font-size:15px;margin:14px 0 6px} .yr h3 svg{width:15px;height:15px;vertical-align:-2px;margin-right:6px;color:var(--muted)}
        .yr-l{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px} .yr-l li{display:flex;align-items:center;gap:8px} .yr-l li>div{display:flex;flex-direction:column;min-width:0} .yr-l .muted{font-size:12px}
        .yr-m{display:grid;grid-template-columns:repeat(12,1fr);gap:4px;height:120px;align-items:end} .yr-m>div{display:flex;flex-direction:column;justify-content:flex-end;height:100%;gap:4px} .yr-m i{display:block;background:var(--accent);border-radius:3px 3px 0 0;min-height:2px;opacity:.75} .yr-m span{font-size:10px;color:var(--muted);text-align:center}
        .yr-s{list-style:none;padding:0;margin:0} .yr-s li{display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-bottom:1px solid var(--line);font-size:13px}
        .mx-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap} .mx-head h2{margin:0} .mx-act{display:flex;gap:8px;flex-wrap:wrap;align-items:center} .mx-act .inp{width:auto}
        .mx-l{list-style:none;padding:0;margin:6px 0 16px;display:flex;flex-direction:column;gap:8px} .mx-l li{display:flex;align-items:center;gap:10px;font-size:14px}
        .mx-t{flex:1;min-width:0;display:flex;flex-direction:column} .mx-t .muted{font-size:12px} .mx-bc{font-size:12px;color:var(--muted);white-space:nowrap} .mx h3{margin:14px 0 4px;font-size:15px}
        .ap-sim{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px 16px} .ap-sim li{display:flex;align-items:center;gap:8px;min-width:0} .ap-sim li>div{display:flex;flex-direction:column;min-width:0} .ap-sim .muted{font-size:12px} .ap-wide h3 svg{width:16px;height:16px;vertical-align:-2px;margin-right:6px;color:var(--muted)}
        .ap-called{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--accent);margin:2px 0 6px} .ap-called svg{width:14px;height:14px;flex:none}
        .ap-banner{display:block;width:100%;height:auto;aspect-ratio:1000/185;max-height:200px;object-fit:cover;border-radius:var(--r-l);margin:0 0 14px}
        /* placeholders while parts are still on their way (user, 2026-11-16: parts coming in were jarring) */
        .sk{display:block;background:linear-gradient(90deg,var(--hover) 0%,color-mix(in srgb,var(--line) 70%,var(--hover)) 50%,var(--hover) 100%);background-size:200% 100%;animation:ap-sk 1.6s ease-in-out infinite;border-radius:var(--r-s)}
        .sk-l{height:11px;margin:9px 0} .sk-b{height:30px;width:280px;max-width:100%;margin-top:14px;border-radius:var(--r-m)} .ap-skh{flex:1;min-width:0} .ap-skh h2{margin:0 0 4px}
        i.ap-banner.sk{height:auto} .ap-r .sk.ap-cover{border-radius:var(--r-m)}
        @keyframes ap-sk{from{background-position:100% 0}to{background-position:-100% 0}} @media (prefers-reduced-motion:reduce){.sk{animation:none}}
        .ap-head.ap-fan{position:relative;isolation:isolate;padding:14px;border-radius:var(--r-l);overflow:hidden} .ap-head.ap-fan::before{content:'';position:absolute;inset:0;z-index:-1;background:var(--fan) center/cover;opacity:.16}
        .ap-logo{display:inline-block;background:#18181c;border-radius:var(--r-m);padding:6px 10px;margin-bottom:6px} .ap-logo img{display:block;max-height:46px;max-width:240px;object-fit:contain}
        .ap-about p{margin:0 0 8px;font-size:14px;line-height:1.55;max-width:75ch} .ap-about details summary{cursor:pointer;color:var(--muted);font-size:13px;margin-bottom:6px} .ap-credit{font-size:12px}
        .ap-cmp table{width:100%;border-collapse:collapse;font-size:13px} .ap-cmp th,.ap-cmp td{text-align:left;padding:5px 8px;border-bottom:1px solid var(--line);vertical-align:top} .ap-cmp tr>th:first-child{color:var(--muted);font-weight:500;width:70px}
        .ap-cmp tr.diff td{background:color-mix(in srgb,var(--warn,#d4a72c) 14%,transparent)} .ap-cmp p{font-size:12px;margin:6px 0 0}
        .ap-list.ap-stg li{grid-template-columns:48px 1fr auto;align-items:center} .ap-list.ap-stg li>div{display:block} .ap-src{color:var(--muted);font-size:12px;overflow:hidden;text-overflow:ellipsis}
        .ap-spark{color:var(--accent);margin-top:2px} .ap-relplay{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px} .ap-relplay .btn{display:inline-flex;gap:4px;align-items:center;font-size:12px;padding:3px 8px}
        .pv-btns{display:inline-flex;gap:2px;vertical-align:middle} .pv-b{background:none;border:0;padding:3px;border-radius:var(--r-s);cursor:pointer;color:var(--muted);display:inline-flex}
        .pv-b:hover{background:var(--accent-soft);color:var(--accent)} .pv-b.on{color:var(--accent)} .pv-b svg{width:16px;height:16px} .pv-busy{opacity:.4}
        .sh-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:2px 0 14px}.sh-bar .inp{width:auto;display:inline-block;margin-left:4px}
        .sh-l{list-style:none;padding:0;margin:8px 0 16px;display:flex;flex-direction:column;gap:10px}.sh-l li{display:flex;gap:12px;align-items:flex-start;font-size:14px}
        .sh-l li>div{flex:1;min-width:0;display:flex;flex-direction:column}.sh-l .muted{font-size:12px}.sh-d{min-width:9em;color:var(--muted);font-size:13px}
        .sh-why{font-size:12px;color:var(--accent)} .sh-heard{font-size:12px;color:var(--muted);display:flex;gap:5px;align-items:flex-start} .sh-heard svg{width:13px;height:13px;flex:none;margin-top:2px}.sh-more>summary,.sh-set>summary{cursor:pointer;color:var(--muted);margin:8px 0}
        .sh-set ul{list-style:none;padding:0;display:flex;flex-direction:column;gap:8px;font-size:14px}.sh-set li{display:flex;gap:8px;align-items:flex-start}.sh-set li svg{width:15px;height:15px;flex:none;margin-top:2px}
        .fw-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px}.fw-l{list-style:none;padding:0;margin:6px 0 18px;display:flex;flex-direction:column;gap:12px}
        .fw-n{display:flex;align-items:baseline;gap:10px}.fw-x{font-size:12px;color:var(--muted)!important}.fw-l>li>.muted{font-size:12px}
        .fw-news{list-style:none;padding:0 0 0 2px;margin:4px 0 0;display:flex;flex-direction:column;gap:3px;font-size:13px}.fw-news li::before{content:'';display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--accent);margin:0 8px 2px 0}
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
      return () => { window.removeEventListener('cadence-artist', onOpen); window.removeEventListener('cadence-want', onWant); window.removeEventListener('cadence-follow', onWant); clearTimeout(fwT1); clearInterval(fwT2); clearTimeout(msT1); clearInterval(msT2); css.remove(); };
    },
  });
})();
