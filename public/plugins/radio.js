/* Radio (user, 2026-11-15): "a radio player too, KEXP, good stuff like that, Amherst Island Radio for local".
   Plays through the same audio element and mini player as Podcasts, so only one thing plays and it keeps going
   when you switch space, view or tab. Stream addresses come from the NAS (api/radio/*), which looks them up in
   Radio Browser; http:// streams are relayed by the NAS because an https page can't play them directly. */
(() => {
  const P = window.CadencePodcasts;
  if (!P) { console.warn('Radio needs the shared player from podcasts.js'); return; }
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // playlists (.pls / .m3u, e.g. SomaFM) and plain-http streams on an https page go through the NAS relay
  const playable = url => ((location.protocol === 'https:' && /^http:\/\//i.test(url)) || /\.(pls|m3u8?)(\?|$)/i.test(url || '') ? 'api/radio/stream?u=' + encodeURIComponent(url) : url);
  const getJson = async u => { const r = await fetch(u); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j; };

  Cadence.registerPlugin({
    id: 'radio', name: 'Radio', version: '1.0.0', category: 'Media', color: '#64748b',
    icon: '<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>',
    tagline: 'KEXP, campus and community radio, and any station you can find, in the same player as Podcasts.',
    description: 'Indie, college and community stations, with Amherst Island Radio and the Toronto and Kingston campus stations for local. Search thousands more (Radio Browser, no account needed) and save your own. KEXP shows what song is on. Works in Work and Life and keeps playing everywhere.',
    setup(api) {
      const offMini = P.useMini ? P.useMini(api) : () => {};
      let stations = null, results = null, searching = false, error = null, nowTimer = 0, hist = null, stTimer = 0;
      const mine = () => api.storage.get('mine') || [];
      const setMine = list => api.storage.set('mine', list);
      // this device's last copy draws at once (2026-11-19); the NAS's answer redraws only if it changed
      let loadedAt = 0;
      const load = async ({ quiet = false } = {}) => {
        loadedAt = Date.now();
        const draw = info => { if (!(quiet && info.stale)) refresh(); };
        const [st] = await Promise.allSettled([
          api.cached('api/radio/stations', (v, info) => { stations = v; error = null; draw(info); }),
          api.cached('api/radio/kexp-history', (v, info) => { hist = v; draw(info); }).catch(() => { hist = hist || null; }),
        ]);
        if (st.status === 'rejected' && !stations) { error = st.reason.message; stations = []; refresh(); }
        // stations the NAS is still looking up: ask again shortly (it keeps searching in the background)
        clearTimeout(stTimer); if ((stations || []).some(s => s.pending)) stTimer = setTimeout(load, 3000); };
      const day = iso => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
      const refresh = () => { if (api.ui.currentRoute() === 'view-radio') api.ui.refresh(); };

      const play = s => {
        if (!s.url) return api.ui.toast("Couldn't find a stream for " + s.name);
        P.load({ uuid: 'radio:' + s.id, live: true, station: s.id, src: s.url, now: null, title: s.name, podcastTitle: s.place || 'Live radio', url: playable(s.url), art: s.art || null, home: s.home || null }, true);
        noTitles = false; earlier = null; pollNow();
      };
      // other plugins (the KEXP live theme) can start a station by its id
      window.CadenceRadio = { play: async id => { if (!stations) try { stations = await getJson('api/radio/stations'); } catch (e) { return false; } const s = (stations || []).find(x => x.id === id); if (s) play(s); return !!s; } };
      // what's on now, every 30 s while a station is playing: KEXP from its playlist, the others from the song title
      // inside the stream (most stations send one; some only send the show or nothing at all)
      let noTitles = false, earlier = null;
      const nowUrl = c => 'api/radio/now?id=' + encodeURIComponent(c.station) + (c.station !== 'kexp' && c.src ? '&u=' + encodeURIComponent(c.src) : '');
      const pollNow = async () => {
        clearTimeout(nowTimer); const c = P.current;
        if (!c || !c.live || !c.station) return;
        let v = null; try { v = await getJson(nowUrl(c)); } catch (e) { /* the stream keeps playing without it */ }
        if (P.current !== c) return;
        if (v && v.none) { noTitles = true; P.setNow(null); refresh(); return; }   // this station never sends titles: stop asking
        if (v && (v.song || v.airbreak)) { P.setNow(v); loadEarlier(c.station); }
        if (!P.audio.paused) nowTimer = setTimeout(pollNow, 30000);
      };
      const loadEarlier = async id => { try { const h = await getJson('api/radio/history?id=' + encodeURIComponent(id) + '&limit=12'); if (P.current && P.current.station === id) { earlier = h; refresh(); } } catch {} };
      // the Radio page redraws when the song changes (the mini player does its own)
      let nowKey = '';
      const offNow = P.on(() => { const c = P.current, k = c && c.live && c.now ? (c.now.song || '') + '|' + (c.now.artist || '') + '|' + !!c.now.airbreak : '';
        if (k !== nowKey) { nowKey = k; if (api.ui.currentRoute() === 'view-radio') api.ui.refresh(); } });
      const offPlay = P.on(() => { const c = P.current; if (c && c.live && c.station && !noTitles && !P.audio.paused && !nowTimer) pollNow(); if (P.audio.paused) { clearTimeout(nowTimer); nowTimer = 0; } });

      // a station's own logo (kept by the NAS), else its website's icon, else the radio icon underneath
      const stLogo = (s, size, big) => `<span class="rd-lg${big ? ' big' : ''}" style="--s:${size}px"><i class="rd-noart">${api.ui.icon('radio')}</i>${s.art || s.home ? api.ui.logo(s.home, { img: s.art, size }) : ''}</span>`;
      const SOMA = { v: null, busy: false, err: null }, MC = { v: null, busy: false, err: null };
      // Mixcloud's player sits in its own small dock at the bottom, outside the page, so redraws and moving around
      // the app don't restart the show; close it with the x
      const mcDock = (key, name) => {
        let d = document.getElementById('rd-mcdock');
        if (!d) { d = document.createElement('div'); d.id = 'rd-mcdock'; document.documentElement.appendChild(d); }
        d.innerHTML = `<div class="rd-mcd-h"><span>${api.ui.logo('mixcloud.com', { size: 14 })}${E(name || 'Mixcloud')}</span><button aria-label="Close the Mixcloud player" title="Close">${api.ui.icon('x')}</button></div>
          <iframe class="rd-mcw" src="https://player-widget.mixcloud.com/widget/iframe/?feed=${encodeURIComponent(key)}&hide_cover=1&mini=1&autoplay=1" title="Mixcloud player" allow="autoplay"></iframe>`;
        d.querySelector('button').onclick = () => d.remove();
      };
      const loadMc = async () => { MC.busy = true; try { MC.v = await getJson('api/radar/mixcloud'); } catch (e) { MC.err = e.message; } MC.busy = false; if (api.ui.currentRoute() === 'view-radio') api.ui.refresh(); };
      const loadSoma = async () => { SOMA.busy = true; try { SOMA.v = await getJson('api/radio/soma'); } catch (e) { SOMA.err = e.message; } SOMA.busy = false; if (api.ui.currentRoute() === 'view-radio') api.ui.refresh(); };
      const card = (s, opts = {}) => {
        const c = P.current, on = c && c.live && c.uuid === 'radio:' + s.id, playing = on && !P.audio.paused;
        return `<div class="rd-st${on ? ' on' : ''}">
          ${stLogo(s, 40)}
          <div class="rd-t"><b>${E(s.name)}</b><span class="muted">${E([s.place, s.about].filter(Boolean).join(' · '))}</span>
            ${s.pending ? `<span class="muted rd-miss">Looking up its stream…</span>` : s.missing ? `<span class="muted rd-miss">Couldn't find its stream. Add it by address below if you know it.</span>` : ''}</div>
          <div class="rd-act">
            ${s.home ? `<a class="pc-ib" href="${E(s.home)}" target="_blank" rel="noopener" aria-label="${E(s.name)} website" title="Website">${api.ui.icon('external-link')}</a>` : ''}
            ${s.url && !opts.save ? `<a class="pc-ib" href="#view-radio-station" data-rd="hist" data-id="${E(s.id)}" aria-label="What ${E(s.name)} played" title="What it played">${api.ui.icon('history')}</a>` : ''}
            ${opts.save ? `<button class="pc-ib" data-rd="save" data-i="${opts.i}" aria-label="Save ${E(s.name)}" title="Save to your stations">${api.ui.icon('plus')}</button>` : ''}
            ${opts.remove ? `<button class="pc-ib" data-rd="remove" data-id="${E(s.id)}" aria-label="Remove ${E(s.name)}" title="Remove">${api.ui.icon('x')}</button>` : ''}
            <button class="pc-ib pc-big" data-rd="${playing ? 'pause' : 'play'}" data-id="${E(s.id)}" ${opts.save ? `data-i="${opts.i}"` : ''} aria-label="${playing ? 'Pause' : 'Play'} ${E(s.name)}" ${s.url ? '' : 'disabled'}>${api.ui.icon(playing ? 'pause' : 'play')}</button>
          </div></div>`;
      };

      api.views.add({ id: 'radio', group: 'music', order: 20, title: 'Radio', icon: '📻', subtitle: 'Indie, college and community stations', wide: true, render: el => {
        if (!loadedAt || Date.now() - loadedAt > 60e3) load({ quiet: true });
        if (!stations) { el.innerHTML = `<div class="rd">${api.ui.skeleton(5, 'Tuning the dial')}</div>`; return; }
        const c = P.current, live = c && c.live ? c : null, n = live && live.now && !live.now.airbreak ? live.now : null;
        const my = mine();
        el.innerHTML = `<div class="rd">
          ${live ? `<div class="pc-card rd-now">${n && n.art ? `<img src="${E(n.art)}" alt="" onerror="this.style.visibility='hidden'">` : stLogo({ art: live.art, home: live.home }, 72, true)}
            <div class="rd-t"><span class="muted">${P.failed ? "Can't reach this station right now" : P.audio.paused ? 'Paused' : 'Live'}${live.now && live.now.airbreak ? ' · DJ talking' : ''}</span>
              <b>${E(n ? n.song : live.title)}</b><span class="muted">${n ? `${n.artist ? `<a class="ar-link" href="#view-artist" data-artist="${E(n.artist)}">${E(n.artist)}</a> · ` : ''}${n.album ? E(n.album) + ' · ' : ''}${E(live.title)}` : E(live.podcastTitle)}${noTitles && live.station !== 'kexp' ? ' · this station doesn\'t share song titles' : ''}</span>
              ${n && n.artist && window.CadencePreview && window.CadencePreview.buttons ? window.CadencePreview.buttons(n.artist, n.song, 'song', live.title) : ''}${n && window.CadenceLyrics ? `<button class="btn sm ghost rd-ly" data-ly-live>${api.ui.icon('mic-vocal')} Lyrics</button>` : ''}</div>
            <button class="pc-ib pc-big" data-rd="${P.audio.paused ? 'resume' : 'pause'}" aria-label="${P.audio.paused ? 'Play' : 'Pause'}">${api.ui.icon(P.audio.paused ? 'play' : 'pause')}</button></div>` : ''}
          ${live && earlier && earlier.plays.length > 1 ? `<details class="rd-earlier" ${api.storage.get('earlierOpen') ? 'open' : ''}><summary>Played earlier on ${E(live.title)}</summary>${playList(earlier.plays.slice(1, 12))}
            <a href="#view-radio-station" data-rd="hist" data-id="${E(live.station)}">Everything it played</a></details>` : ''}
          ${error ? `<p class="pc-note">${api.ui.icon('refresh-cw')}Couldn't load stations from the NAS: ${E(error)}</p>` : ''}
          ${my.length ? `<h3 class="rd-h">Your stations</h3><div class="rd-list">${my.map(s => card(s, { remove: true })).join('')}</div>` : ''}
          <h3 class="rd-h">Stations</h3><div class="rd-list">${stations.map(s => card(s)).join('')}</div>
          ${(() => { const open = !!api.storage.get('somaOpen'), S = SOMA.v; if (open && !S && !SOMA.busy && !SOMA.err) loadSoma();
            return `<details class="rd-soma" ${open ? 'open' : ''}><summary><h3 class="rd-h">${api.ui.logo('somafm.com', { size: 16 })}SomaFM</h3><span class="muted">${S ? S.length + ' ' : ''}listener-supported channels, no ads</span></summary>
              ${S ? `<div class="rd-list">${S.map(s => card({ ...s, about: s.now ? 'Now: ' + s.now : s.about })).join('')}</div>` : `<p class="muted">${SOMA.err ? "Couldn't reach SomaFM right now." : 'Loading the channels…'}</p>`}</details>`; })()}
          ${(() => { const open = !!api.storage.get('mcOpen'), M = MC.v; if (open && !M && !MC.busy && !MC.err) loadMc();
            return `<details class="rd-soma rd-mc" ${open ? 'open' : ''}><summary><h3 class="rd-h">${api.ui.logo('mixcloud.com', { size: 16 })}Mixcloud</h3><span class="muted">Shows by the KEXP DJs who play your favourites</span></summary>
              ${!M ? `<p class="muted">${MC.err ? "Couldn't reach Mixcloud right now." : 'Finding shows…'}</p>` : !(M.djs || []).length ? `<p class="muted">${M.note || 'No shows found yet.'}</p>` : M.djs.map(d => `<div class="rd-mcdj"><b>${E(d.dj)}</b> <span class="muted">${d.program ? E(d.program) + ' · ' : ''}plays ${E(d.because.slice(0, 3).join(', '))}</span>
                ${(d.shows || []).length ? `<ul class="rd-mcl">${d.shows.map(c => `<li data-mc="${E(c.key)}">${c.art ? `<img src="${E('api/logo?u=' + encodeURIComponent(c.art))}" alt="" width="40" height="40" loading="lazy" onerror="this.remove()">` : ''}<div><b>${E(c.name)}</b><span class="muted">${[c.by, c.mins && c.mins + ' min', c.at && new Date(c.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })].filter(Boolean).map(E).join(' · ')}</span></div>
                  <button class="btn" data-rd="mc" data-key="${E(c.key)}" data-name="${E(c.name)}">${api.ui.icon('play')}Play</button><a class="btn ghost" href="${E(c.url)}" target="_blank" rel="noopener">${api.ui.icon('external-link')}</a></li>`).join('')}</ul>` : `<p class="muted">${E(d.error || 'No shows found on Mixcloud.')}</p>`}</div>`).join('')}</details>`; })()}
          <h3 class="rd-h">Find a station</h3>
          <form class="rd-find" id="rd-find"><input class="inp" id="rd-q" type="search" placeholder="Name, city or genre (shoegaze, college, Kingston…)" aria-label="Find a station" value="${E(api.storage.get('lastQ') || '')}">
            <button class="btn" type="submit">${searching ? 'Looking…' : 'Search'}</button></form>
          ${results ? (results.length ? `<div class="rd-list">${results.map((s, i) => card(s, { save: true, i })).join('')}</div>` : `<p class="muted">Nothing found. Try another name or a genre.</p>`) : ''}
          <details class="rd-add"><summary>Add a station by its stream address</summary>
            <form id="rd-addf" class="rd-find"><input class="inp" id="rd-an" placeholder="Name" aria-label="Station name"><input class="inp" id="rd-au" type="url" placeholder="https://…" aria-label="Stream address"><button class="btn" type="submit">Add</button></form></details>
          ${hist && hist.on && hist.plays ? `<p class="muted rd-foot">${api.ui.icon('history')} Your NAS is keeping KEXP's playlist: ${hist.plays.toLocaleString()} songs since ${day(hist.since)}${hist.backfill === 'running' ? `, still filling in ${hist.backDays === 'all' ? 'everything back to 2001' : 'the past'}` : ''}. <a href="#view-kexp-history">Open KEXP history</a></p>` : ''}
          <p class="muted rd-foot">Stream addresses come from Radio Browser, a free community directory, looked up by your NAS.</p>
        </div>`;
        const byId = id => stations.find(s => s.id === id) || my.find(s => s.id === id) || (SOMA.v || []).find(s => s.id === id);
        const sd = el.querySelector('.rd-soma:not(.rd-mc)'); if (sd) sd.ontoggle = () => { api.storage.set('somaOpen', sd.open); if (sd.open && !SOMA.v && !SOMA.busy) { SOMA.err = null; loadSoma(); } };
        const md = el.querySelector('.rd-mc'); if (md) md.ontoggle = () => { api.storage.set('mcOpen', md.open); if (md.open && !MC.v && !MC.busy) { MC.err = null; loadMc(); } };
        el.querySelector('.rd').onclick = e => {
          const b = e.target.closest('[data-rd]'); if (!b) return;
          const act = b.dataset.rd, s = b.dataset.i != null && results ? results[+b.dataset.i] : byId(b.dataset.id);
          if (act === 'mc') { // Mixcloud's own little player, loaded only when you press play (kept across redraws); pauses this player first
            P.pause(); mcDock(b.dataset.key, b.dataset.name); return; }
          if (act === 'play' && s) play(s);
          else if (act === 'pause') P.pause();
          else if (act === 'resume') P.play();
          else if (act === 'save' && s) { if (!my.some(x => x.id === s.id)) setMine([...my, s]); api.ui.toast('Saved ' + s.name); refresh(); }
          else if (act === 'remove') { setMine(my.filter(x => x.id !== b.dataset.id)); refresh(); }
          else if (act === 'hist') { const st = byId(b.dataset.id) || (P.current && { id: P.current.station, name: P.current.title, url: P.current.src }); if (st) openStation(st); }
        };
        el.querySelector('#rd-find').onsubmit = async e => {
          e.preventDefault(); const q = el.querySelector('#rd-q').value.trim(); if (q.length < 2) return;
          api.storage.set('lastQ', q); searching = true; refresh();
          try { results = await getJson('api/radio/search?q=' + encodeURIComponent(q)); } catch (err) { results = []; api.ui.toast("Search isn't working right now"); }
          searching = false; refresh();
        };
        el.querySelector('#rd-addf').onsubmit = e => {
          e.preventDefault(); const name = el.querySelector('#rd-an').value.trim(), url = el.querySelector('#rd-au').value.trim();
          if (!/^https?:\/\//i.test(url)) return api.ui.toast('That needs to be a web address (https://…)');
          setMine([...my, { id: 'mine:' + Date.now().toString(36), name: name || new URL(url).hostname, place: 'Added by you', url }]); refresh();
        };
      } });
      // ---------------- one station: what it played (saved by the NAS) and "Keep a history" ----------------
      const ST = { s: null, d: null };
      const playList = plays => `<ul class="rd-pl">${plays.map(x => `<li><span class="muted">${new Date(x.at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>
        <div>${x.artist ? `<a class="ar-link" href="#view-artist" data-artist="${E(x.artist)}"><b>${E(x.artist)}</b></a> — ` : ''}${E(x.song || x.raw || '')}</div>
        ${x.artist && window.CadencePreview && window.CadencePreview.buttons ? window.CadencePreview.buttons(x.artist, x.song, 'song', 'radio') : ''}</li>`).join('')}</ul>`;
      const openStation = async s => { ST.s = s; ST.d = null; if (api.ui.currentRoute() !== 'view-radio-station') location.hash = 'view-radio-station'; else api.ui.refresh();
        try { ST.d = await getJson('api/radio/history?id=' + encodeURIComponent(s.id) + '&limit=200'); } catch (e) { ST.d = { error: e.message, plays: [] }; } if (api.ui.currentRoute() === 'view-radio-station') api.ui.refresh(); };
      api.views.add({ id: 'radio-station', group: 'music', order: 99, title: 'Station history', icon: '📻', hidden: true, render: el => {
        const s = ST.s, d = ST.d;
        if (!s) { el.innerHTML = '<p class="muted">Pick a station on the <a href="#view-radio">Radio</a> page.</p>'; return; }
        el.innerHTML = `<div class="rd"><p><a href="#view-radio">${api.ui.icon('arrow-left')}Radio</a></p><h2 class="rd-h rd-hl">${s.art || s.home ? stLogo(s, 34) : ''}${E(s.name)}</h2>
          ${!d ? '<p class="muted">Loading…</p>' : d.error ? `<p class="muted">Couldn't load it: ${E(d.error)}</p>` : `
          ${d.follow === 'kexp' ? `<p class="muted">KEXP's full playlist is kept on your NAS. <a href="#view-kexp-history">Open KEXP history</a></p>`
            : `<label class="rd-follow"><input type="checkbox" id="rd-follow" ${d.follow ? 'checked' : ''}> Keep a history, even when you're not listening
               <span class="muted">${d.follow ? 'Your NAS checks the song every couple of minutes' + (d.since ? ' (since ' + day(d.since) + ')' : '') + '.' : 'Otherwise songs are saved only while you listen.'}</span></label>`}
          ${d.plays.length ? playList(d.plays) : '<p class="muted">Nothing saved yet. Songs show up here once you listen, or turn on Keep a history.</p>'}`}</div>`;
        const f = el.querySelector('#rd-follow');
        if (f) f.onchange = async () => { try { const r = await fetch('api/radio/follow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, name: s.name, url: s.url, on: f.checked }) });
          ST.d = await r.json(); api.ui.toast(f.checked ? 'Keeping a history of ' + s.name : 'Stopped keeping a history'); } catch { api.ui.toast("Couldn't reach the NAS"); } api.ui.refresh(); };
      } });

      // ---------------- KEXP history: every play the NAS has saved, grouped and counted (no AI) ----------------
      const K = { cper: api.storage.get('cper') || 'month', wby: api.storage.get('wby') || 'artist', wper: api.storage.get('wper') || 'month', tab: api.storage.get('kTab') || 'top', by: api.storage.get('kBy') || 'artist', period: api.storage.get('kPeriod') || 'month', q: '', group: 'artist', detail: null, cache: {} };
      // what this page has already shown stays on screen when you come back; a fresh copy is asked for behind it
      // (2026-11-17: "stuff needs to be snappier")
      const kget = (qs, key = qs) => {
        if (K.cache[key] !== undefined && K.cache[key] !== null && K.stale && K.stale.has(key)) {
          K.stale.delete(key); const had = K.cache[key];
          getJson('api/radio/kexp?' + qs).then(v => { K.cache[key] = v; if (JSON.stringify(v) !== JSON.stringify(had) && api.ui.currentRoute() === 'view-kexp-history') api.ui.refresh(); }, () => {});
          return had;
        }
        if (K.cache[key] !== undefined) return K.cache[key];
        // first time this session: this device's last copy (if any) shows straight away, the fresh one replaces it
        K.cache[key] = null;
        let sync = true;
        api.cached('api/radio/kexp?' + qs, v => { K.cache[key] = v; if (!sync && api.ui.currentRoute() === 'view-kexp-history') api.ui.refresh(); }, { max: 400000 })
          .catch(e => { if (!K.cache[key]) { K.cache[key] = { error: e.message }; if (api.ui.currentRoute() === 'view-kexp-history') api.ui.refresh(); } });
        sync = false;
        return K.cache[key];
      };
      const when = iso => { const d = new Date(iso); return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }) + ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); };
      const ago = iso => { const days = Math.floor((Date.now() - Date.parse(iso)) / 864e5); return days < 1 ? 'today' : days < 2 ? 'yesterday' : days < 60 ? days + ' days ago' : new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }); };
      const n = (x, one, many) => `${(+x || 0).toLocaleString()} ${(+x === 1) ? one : many}`;
      const go = (detail, back) => { if (!back && K.detail) (K.stack = K.stack || []).push(K.detail); if (!detail) K.stack = []; K.detail = detail; api.ui.refresh(); const v = document.getElementById('view'); if (v) v.scrollTop = 0; scrollTo(0, 0); };
      const enc = encodeURIComponent;
      // artwork only when KEXP has it (a placeholder on every row is just noise); the header always gets one
      // the 500px cover where the address has one (Cover Art Archive, Internet Archive), for the big picture at the top
      const bigArt = u => String(u || '').replace(/-250\.jpg$/, '-500.jpg').replace(/_thumb250\.jpg$/, '_thumb500.jpg') || null;
      // "from 1972" when a record is much older than the play (crate digging); nothing for new music
      const yearOf = p => { const y = +String(p.release || '').slice(0, 4), at = new Date(p.at).getFullYear(); return y > 1900 && at - y >= 3 ? y : null; };
      // KEXP's DJs: photo, and whether they're still on air (loaded once a visit; kept a week on the NAS)
      const hostOf = name => { if (!K.hosts) { K.hosts = {}; getJson('api/radio/kexp?view=hosts').then(h => { K.hosts = h || {}; if (api.ui.currentRoute() === 'view-kexp-history') api.ui.refresh(); }, () => {}); } return K.hosts[name] || null; };
      const djFace = (name, big) => { const h = hostOf(name); return h && h.image ? `<img class="kx-dj${big ? ' big' : ''}" src="${E(h.image)}" alt="" loading="lazy" onerror="this.remove()">` : ''; };
      const art = (img, head) => img ? `<img src="${E(img)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : head ? `<i class="rd-noart">${api.ui.icon('list-music')}</i>` : '';
      const aBtn = a => `<button class="kx-link" data-k="artist" data-a="${E(a)}">${E(a)}</button>`;
      const rowArtist = r => `<li class="kx-row" data-k="artist" data-a="${E(r.artist)}">${art(r.image)}<div class="rd-t"><b>${E(r.artist)}</b><span class="muted">${n(r.plays, 'play', 'plays')}${r.songs ? ' · ' + n(r.songs, 'song', 'songs') : ''} · last ${ago(r.last)}</span></div><span class="kx-n">${(+r.plays).toLocaleString()}</span></li>`;
      const rowSong = r => `<li class="kx-row" data-k="song" data-a="${E(r.artist)}" data-s="${E(r.song)}">${art(r.image)}<div class="rd-t"><b>${E(r.song)}</b><span class="muted">${E(r.artist)} · ${n(r.plays, 'play', 'plays')} · last ${ago(r.last)}</span></div><span class="kx-n">${(+r.plays).toLocaleString()}</span></li>`;
      const rowAlbum = r => `<li class="kx-row" data-k="artist" data-a="${E(r.artist)}">${art(r.image)}<div class="rd-t"><b>${E(r.album)}</b><span class="muted">${E(r.artist)}${r.label ? ' · ' + E(r.label) : ''} · last ${ago(r.last)}</span></div><span class="kx-n">${(+r.plays).toLocaleString()}</span></li>`;
      const rowShow = r => `<li class="kx-row" data-k="program" data-v="${E(r.program)}">${art(r.image)}<div class="rd-t"><b>${E(r.program)}</b><span class="muted">${n(r.shows, 'show', 'shows')} · last ${ago(r.last)}</span></div><span class="kx-n">${(+r.plays).toLocaleString()}</span></li>`;
      const rowDj = r => `<li class="kx-row" data-k="dj" data-v="${E(String(r.hosts).split(', ')[0])}">${djFace(String(r.hosts).split(', ')[0])}<div class="rd-t"><b>${E(r.hosts)}</b><span class="muted">${(hostOf(String(r.hosts).split(', ')[0]) || {}).active === false ? 'former KEXP DJ · ' : ''}${E(r.programs || '')} · ${n(r.shows, 'show', 'shows')} · last ${ago(r.last)}</span></div><span class="kx-n">${(+r.plays).toLocaleString()}</span></li>`;
      const inArchive = at => { const t = Date.parse(at); return isFinite(t) && Date.now() - t < 336 * 3600e3 - 20 * 60e3 && Date.now() - t > 5 * 60e3; };
      const rowPlay = (p, hl) => `<li class="kx-play${hl ? ' hl' : ''}"><span class="kx-when">${E(when(p.at))}</span>
        <div class="rd-t"><b><button class="kx-link" data-k="song" data-a="${E(p.artist)}" data-s="${E(p.song || '')}">${E(p.song || '(untitled)')}</button></b>
          <span class="muted">${aBtn(p.artist)}${p.album ? ' · ' + E(p.album) : ''}${yearOf(p) ? ` · <span class="kx-yr" title="Released ${yearOf(p)}">from ${yearOf(p)}</span>` : ''}${p.label ? ' · ' + E(p.label) : ''}${p.rotation ? ' · ' + E(p.rotation) + ' rotation' : ''}${p.live ? ' · live in studio' : ''}${p.local ? ' · local' : ''}${p.request ? ' · request' : ''}</span>
          ${p.show ? `<span class="muted kx-show">on <button class="kx-link" data-k="program" data-v="${E(p.show.program)}">${E(p.show.program)}</button>${p.show.hosts ? ' with ' + p.show.hosts.split(', ').map(h => `<button class="kx-link" data-k="dj" data-v="${E(h)}">${E(h)}</button>`).join(', ') : ''}</span>` : ''}
          ${p.comment ? `<details class="kx-c"><summary>DJ comment</summary><p>${E(p.comment)}</p></details>` : ''}</div>
        ${inArchive(p.at) ? `<button class="pc-ib" data-kx-arch="${E(p.at)}" data-title="${E((p.artist ? p.artist + ' – ' : '') + (p.song || ''))}" data-show="${E(p.show ? p.show.program : 'KEXP')}" aria-label="Listen from here, in KEXP's archive" title="Listen from here (KEXP keeps two weeks)">${api.ui.icon('headphones')}</button>` : ''}
        ${hl ? '' : `<button class="pc-ib" data-k="around" data-id="${p.id}" aria-label="Songs around this play" title="Songs around this play">${api.ui.icon('list-music')}</button>`}</li>`;
      const list = (rows, fn, empty) => !rows ? api.ui.skeleton(3, 'Loading') : rows.error ? `<p class="pc-note">${api.ui.icon('refresh-cw')}${E(rows.error)}</p>` : rows.length ? `<ul class="kx-list">${rows.map(fn).join('')}</ul>` : `<p class="muted">${empty}</p>`;
      const chips = (name, cur, opts) => `<div class="kx-chips" role="tablist">${opts.map(([v, l]) => `<button class="kx-chip${cur === v ? ' on' : ''}" data-k="${name}" data-v="${v}" role="tab" aria-selected="${cur === v}">${l}</button>`).join('')}</div>`;
      const bars = months => { const max = Math.max(1, ...months.map(m => m.plays)); return `<div class="kx-bars" aria-label="Plays per month">${months.map(m => `<span title="${E(m.month)}: ${m.plays}" style="height:${Math.max(4, Math.round(m.plays / max * 100))}%"></span>`).join('')}</div>`; };

      // winners: one row per month or year: the most-played artist / song / album and the runner-up
      const winnersHtml = (r, max = 0) => {
        if (!r) return '<p class="muted">Counting…</p>';
        if (r.error) return `<p class="pc-note">${E(r.error)}</p>`;
        const rows = max ? r.list.slice(0, max) : r.list;
        if (!rows.length) return '<p class="muted">Not enough saved plays yet.</p>';
        const label = p => p.length === 4 ? p : new Date(p + '-15').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        const what = w => `<button class="kx-link" data-k="artist" data-a="${E(w.artist)}"><b>${E(w.artist)}</b></button>${w.song ? ' — ' + E(w.song) : w.album ? ' — ' + E(w.album) : ''} <span class="muted">${w.plays}×</span>`;
        return `<ul class="kx-win">${rows.map(x => `<li><span class="kx-wp">${E(label(x.period))}</span><div>${what(x.winner)}${x.runnerUp ? `<div class="muted kx-ru">then ${what(x.runnerUp)}</div>` : ''}</div></li>`).join('')}</ul>`;
      };
      const detailHtml = () => {
        const d = K.detail, back = `<button class="btn kx-back" data-k="back">${api.ui.icon('arrow-left')}Back</button>`;
        if (d.type === 'artist') {
          const a = kget('view=artist&artist=' + enc(d.artist));
          if (!a) return back + '<p class="muted">Loading…</p>';
          if (a.error || a === null) return back + `<p class="muted">Nothing saved for ${E(d.artist)} yet.</p>`;
          return `${back}<div class="kx-head">${art(bigArt(a.image), true)}<div><h3>${E(a.artist)}</h3><p class="muted">${n(a.plays, 'play', 'plays')} · first ${E(when(a.first))} · last ${E(when(a.last))}</p>
            <a class="btn kx-full" href="#view-artist" data-artist="${E(a.artist)}">${api.ui.icon('mic-vocal')}Everything about ${E(a.artist)}</a></div></div>
            ${a.months.length > 1 ? bars(a.months) : ''}
            <h4 class="rd-h">Songs</h4>${list(a.songs.map(s => ({ ...s, artist: a.artist, image: null })), rowSong, '')}
            <h4 class="rd-h">Recent plays</h4>${list(a.recent, p => rowPlay(p), '')}`;
        }
        if (d.type === 'song') {
          const s = kget(`view=song&artist=${enc(d.artist)}&song=${enc(d.song)}`);
          if (!s) return back + '<p class="muted">Loading…</p>';
          if (s.error) return back + `<p class="muted">Nothing saved for that song yet.</p>`;
          return `${back}<div class="kx-head">${art(s.plays[0] && bigArt(s.plays[0].image), true)}<div><h3>${E(s.song)}</h3><p class="muted">${aBtn(s.artist)}${s.album ? ' · ' + E(s.album) : ''} · ${n(s.plays.length, 'play', 'plays')}</p></div></div>
            ${list(s.plays, p => rowPlay(p), '')}`;
        }
        if (d.type === 'program' || d.type === 'dj') {
          const r = kget(`view=onair&${d.type}=${enc(d.name)}`);
          if (!r) return back + '<p class="muted">Loading…</p>';
          if (r.error) return back + `<p class="muted">Nothing saved for ${E(d.name)} yet.</p>`;
          const who = d.type === 'program' ? (r.hosts ? 'with ' + r.hosts.split(',').map(h => h.trim()).filter((h, i, a) => a.indexOf(h) === i).slice(0, 6).map(h => `<button class="kx-link" data-k="dj" data-v="${E(h)}">${E(h)}</button>`).join(', ') : '')
            : 'on ' + String(r.programs || '').split(',').slice(0, 6).map(x => `<button class="kx-link" data-k="program" data-v="${E(x)}">${E(x)}</button>`).join(', ');
          const face = d.type === 'dj' && hostOf(d.name) && hostOf(d.name).image ? `<img src="${E(hostOf(d.name).image)}" alt="" onerror="this.style.visibility='hidden'">` : art(r.image, true);
          return `${back}<div class="kx-head">${face}<div><h3>${E(d.name)}</h3><p class="muted">${d.type === 'dj' && (hostOf(d.name) || {}).active === false ? 'A former KEXP DJ · ' : ''}${who}</p><p class="muted">${n(r.plays, 'play', 'plays')} across ${n(r.shows, 'show', 'shows')} · last ${E(when(r.last))}${r.tags ? ' · ' + E(r.tags) : ''}</p></div></div>
            <div class="kx-two"><div><h4 class="rd-h">Artists they play most</h4>${list(r.artists, rowArtist, '')}</div><div><h4 class="rd-h">Songs they play most</h4>${list(r.songs, rowSong, '')}</div></div>
            <h4 class="rd-h">Their favourite artist each month</h4>${winnersHtml(kget(`view=winners&by=artist&per=month&${d.type}=${enc(d.name)}`), 12)}
            <h4 class="rd-h">Recent plays</h4>${list(r.recent, p => rowPlay(p), '')}`;
        }
        if (d.type === 'around') {
          const r = kget('view=around&n=8&id=' + d.id);
          if (!r) return back + '<p class="muted">Loading…</p>';
          if (r.error) return back + '<p class="muted">That play isn\'t saved.</p>';
          return `${back}<h3>Around ${E(r.play.song || '')} by ${E(r.play.artist)}</h3><p class="muted">What KEXP played before and after, ${E(when(r.play.at))}</p>
            <ul class="kx-list">${r.before.map(p => rowPlay(p)).join('')}${rowPlay(r.play, true)}${r.after.map(p => rowPlay(p)).join('')}</ul>`;
        }
        return back;
      };

      // the artist page's "Every KEXP play" opens this view on that artist
      window.CadenceKexpHistory = { artist: name => { K.detail = { type: 'artist', artist: name }; K.stack = []; K.away = false; api.ui.navigate('view-kexp-history'); } };
      // ---- KEXP's two-week archive (2026-11-17): listen from any moment, and shows you keep on the NAS ----
      const KA = window.CadenceKexpArchive = {
        async play(at, meta = {}) {
          let a; try { a = await getJson('api/radio/kexp?view=archive&at=' + encodeURIComponent(at)); } catch (e) { api.ui.toast("Couldn't reach KEXP's archive just now. Try again in a moment."); return false; }
          if (a.none) { api.ui.toast(a.why || "KEXP's archive doesn't have that moment."); return false; }
          // the older archive: a stream from that moment (no seeking, no end), through the NAS relay
          if (a.stream) { P.load({ uuid: 'kexp-arch:' + a.at, url: 'api/radio/stream?u=' + encodeURIComponent(a.url), live: true, title: meta.title || 'KEXP archive', podcastTitle: meta.show ? 'KEXP · ' + meta.show : 'KEXP archive', art: meta.art || null, home: 'kexp.org' }, true); return true; }
          P.load({ uuid: 'kexp-arch:' + a.url, url: a.url, archive: true, at: a.at, offset: a.offset, exact: true, position: a.offset,
            title: meta.title || 'KEXP, ' + new Date(a.at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }), podcastTitle: meta.show ? 'KEXP · ' + meta.show : 'KEXP archive', art: meta.art || null }, true);
          return true;
        },
      };
      // the show ended: the moment it ends, in the archive, is the next show (its file starts a little before)
      P.onArchiveEnded = (cur, dur) => { const t = Date.parse(cur.at) - (+cur.offset || 0) * 1000 + (dur || 0) * 1000; if (isFinite(t) && dur) KA.play(new Date(t + 2000).toISOString()); };
      document.addEventListener('click', e => {
        const b = e.target.closest('[data-kx-arch]'); if (!b) return;
        e.preventDefault(); e.stopPropagation(); KA.play(b.dataset.kxArch, { title: b.dataset.title, show: b.dataset.show });
      }, true);
      // shows you keep: a card on the Podcasts page
      const KK = { d: null, loading: false };
      const kkLoad = () => { if (KK.loading) return; KK.loading = true; getJson('api/radio/kexp-keep').then(d => { KK.d = d; }, () => { KK.d = KK.d || { error: true }; }).finally(() => { KK.loading = false; if (api.ui.currentRoute() === 'view-podcasts') api.ui.refresh(); }); };
      const kkPost = async body => { try { const r = await fetch('api/radio/kexp-keep', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(); KK.d = await r.json(); } catch (e) { api.ui.toast("Couldn't save that just now. Try again in a moment."); } if (api.ui.currentRoute() === 'view-podcasts') api.ui.refresh(); };
      const mmss = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0'); };
      const kkPlay = (ep, sec) => {
        const uuid = 'kexp-kept:' + ep.id;
        if (sec != null && P.current && P.current.uuid === uuid) { P.audio.currentTime = sec; if (P.audio.paused) P.play(); return; }
        P.load({ uuid, url: ep.url, kept: true, title: ep.program + ', ' + new Date(ep.start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }), podcastTitle: 'KEXP' + (ep.hosts ? ' · ' + ep.hosts : ''),
          art: ep.image || null, position: sec != null ? sec : ep.offset, exact: sec != null }, true);
      };
      window.CadenceKexpKeep = {
        card() {
          if (api.system().mode !== 'nas') return '';
          if (!KK.d) { kkLoad(); return '<div class="pc-card kk"><b>KEXP shows you keep</b><p class="muted">Loading…</p></div>'; }
          if (KK.d.error) return '';
          const d = KK.d, on = new Set(d.programs.map(x => x.toLowerCase()));
          const ep = x => `<div class="kk-ep">${x.image ? `<img src="${E(x.image)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : ''}<div class="kk-t">
              <div class="kk-top"><b>${E(x.program)}</b><button class="pc-ib" data-kk-play="${x.id}" aria-label="Play ${E(x.program)}" title="Play">${api.ui.icon('play')}</button></div>
              <span class="muted">${E(new Date(x.start).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}${x.hosts ? ' · ' + E(x.hosts) : ''} · ${Math.round(x.bytes / 1e6)} MB</span>
              ${x.plays.length ? `<details><summary>Playlist (${x.plays.length} songs)</summary><ol class="kk-pl">${x.plays.map(p => `<li><button class="kk-sk" data-kk-seek="${x.id}" data-sec="${p.sec}"><span class="muted">${mmss(p.sec - x.offset)}</span> ${E(p.artist)}${p.song ? ' – ' + E(p.song) : ''}</button></li>`).join('')}</ol></details>` : ''}</div></div>`;
          return `<div class="pc-card kk"><div class="pc-h"><b>KEXP shows you keep</b><span class="muted">${d.kept.length ? d.kept.length + ' saved on your NAS' : ''}</span></div>
            ${d.kept.length ? d.kept.map(ep).join('') : `<p class="muted">${d.programs.length ? `Each new episode of ${E(d.programs.join(', '))} is saved here after it airs (KEXP's archive keeps two weeks).` : 'Pick KEXP shows below and each new episode is saved on your NAS after it airs, for listening any time.'}</p>`}
            <details class="kk-pick"${d.programs.length ? '' : ' open'}><summary>Choose shows to keep${d.programs.length ? ` (${d.programs.length})` : ''}</summary>
              <div class="kk-ch">${d.choices.length ? d.choices.map(c => `<button class="chip${on.has(c.toLowerCase()) ? ' on' : ''}" data-kk-prog="${E(c)}" aria-pressed="${on.has(c.toLowerCase())}">${E(c)}</button>`).join('') : '<span class="muted">KEXP\'s show names show up here once your NAS has seen a few days of its playlist.</span>'}</div>
              <label class="kk-per">Keep the newest <select class="inp sm" data-kk-per>${[1, 2, 3, 4, 5].map(n => `<option${n === d.per ? ' selected' : ''}>${n}</option>`).join('')}</select> of each (a 3-hour show is about 170 MB)</label>
            </details></div>`;
        },
      };
      document.addEventListener('click', e => {
        const pl = e.target.closest('[data-kk-play]'), sk = e.target.closest('[data-kk-seek]'), pg = e.target.closest('[data-kk-prog]');
        if (!pl && !sk && !pg) return;
        e.preventDefault();
        if (pg) { const was = pg.getAttribute('aria-pressed') === 'true'; kkPost({ program: pg.dataset.kkProg, on: !was }); return; }
        const id = +(pl ? pl.dataset.kkPlay : sk.dataset.kkSeek), ep = KK.d && KK.d.kept.find(x => x.id === id); if (!ep) return;
        kkPlay(ep, sk ? +sk.dataset.sec : null);
      });
      document.addEventListener('change', e => { const s = e.target.closest('[data-kk-per]'); if (s) kkPost({ per: +s.value }); });
      if (!document.getElementById('kk-css')) { const st = document.createElement('style'); st.id = 'kk-css'; st.textContent = `
        .kk .kk-ep{display:flex;gap:10px;padding:8px 0;border-top:1px solid var(--line)}.kk .kk-ep:first-of-type{border-top:0}
        .kk .kk-ep img{width:48px;height:48px;border-radius:8px;object-fit:cover;flex:none}
        .kk .kk-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.kk .kk-top{display:flex;align-items:center;justify-content:space-between;gap:6px}
        .kk .kk-t>span{font-size:13px}.kk details summary{cursor:pointer;font-size:13px;color:var(--muted);margin-top:2px}
        .kk .kk-pl{margin:6px 0 0;padding-left:20px;max-height:280px;overflow:auto}.kk .kk-sk{border:0;background:transparent;font:inherit;color:inherit;text-align:left;cursor:pointer;padding:2px 0}
        .kk .kk-sk:hover{color:var(--accent)}.kk .kk-sk .muted{display:inline-block;min-width:52px;font-variant-numeric:tabular-nums}
        .kk .kk-pick{margin-top:8px}.kk .kk-ch{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.kk .kk-ch .chip.on{background:var(--accent);color:var(--accent-ink,#fff);border-color:var(--accent)}
        .kk .kk-per{font-size:13px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}`; document.head.appendChild(st); }

      api.views.add({ id: 'kexp-history', site: 'kexp.org', group: 'music', order: 30, title: 'KEXP history', icon: '🎼', subtitle: 'Every song KEXP plays, kept on your NAS', wide: true, render: el => {
        if (K.away) { K.away = false; for (const k of Object.keys(K.cache)) if (!K.cache[k] || K.cache[k].error) delete K.cache[k]; K.stale = new Set(Object.keys(K.cache));
          if (hist) getJson('api/radio/kexp-history').then(h => { hist = h; }, () => {}); }
        if (!hist) { el.innerHTML = `<div class="rd">${api.ui.skeleton(4)}</div>`; getJson('api/radio/kexp-history').then(h => { hist = h; }, () => { hist = { on: false }; }).then(() => api.ui.refresh()); return; }
        let body;
        if (!hist.on) body = `<p class="muted">Saving KEXP's playlist is turned off on your NAS (KEXP_LOG=0 in .env).</p>`;
        else if (!hist.plays) body = `<p class="muted">Your NAS starts saving KEXP's playlist a few seconds after it starts. Check back in a few minutes.</p>`;
        else if (K.detail) body = detailHtml();
        else {
          const tabs = chips('tab', K.tab, [['top', 'Top'], ['winners', 'Winners'], ['recent', 'Recent'], ['new', 'New to KEXP'], ['crate', 'Crate digging'], ['search', 'Search']]);
          let inner = '';
          if (K.tab === 'top') {
            const rows = kget(`view=top&by=${K.by}&period=${K.period}&limit=100`);
            inner = `<div class="kx-bar">${chips('by', K.by, [['artist', 'Artists'], ['song', 'Songs'], ['album', 'Albums'], ['show', 'Shows'], ['dj', 'DJs']])}${chips('period', K.period, [['week', 'Week'], ['month', 'Month'], ['year', 'Year'], ['all', 'All time']])}</div>
              ${list(rows, K.by === 'song' ? rowSong : K.by === 'album' ? rowAlbum : K.by === 'show' ? rowShow : K.by === 'dj' ? rowDj : rowArtist, K.by === 'show' || K.by === 'dj' ? 'Show names are still being filled in. Check back in a few minutes.' : 'Nothing played in this period yet.')}`;
          } else if (K.tab === 'winners') {
            inner = `<div class="kx-bar">${chips('wby', K.wby, [['artist', 'Artist'], ['song', 'Song'], ['album', 'Album']])}${chips('wper', K.wper, [['month', 'Each month'], ['year', 'Each year']])}</div>
              <p class="muted">The most-played ${K.wby} of each ${K.wper}, and the runner-up.</p>${winnersHtml(kget(`view=winners&by=${K.wby}&per=${K.wper}`))}`;
          } else if (K.tab === 'recent') {
            const c = api.storage.get('kComments') === true;
            inner = `<label class="kx-tog"><input type="checkbox" id="kx-com" ${c ? 'checked' : ''}> Only plays with a DJ comment</label>${list(kget('view=recent&limit=100' + (c ? '&comments=1' : '')), p => rowPlay(p), 'Nothing yet.')}`;
          } else if (K.tab === 'crate') {
            const r = kget(`view=crate&period=${K.cper || 'month'}`), top = r && r.decades ? Math.max(1, ...r.decades.map(x => x.plays)) : 1;
            inner = `<div class="kx-bar">${chips('cper', K.cper || 'month', [['week', 'This week'], ['month', 'This month'], ['year', 'This year']])}</div>
              <p class="muted">Records at least 20 years old that KEXP's DJs played: the gems they dug out.</p>
              ${r && r.decades && r.decades.length ? `<div class="kx-dec">${r.decades.map(x => `<span title="${x.plays} plays"><i style="height:${Math.max(4, Math.round(x.plays / top * 56))}px"></i>${x.decade}s</span>`).join('')}</div>` : ''}
              ${!r ? '<p class="muted">Loading…</p>' : r.error ? `<p class="pc-note">${E(r.error)}</p>` : list(r.plays, p => rowPlay(p), 'No old records in this stretch yet.')}`;
          } else if (K.tab === 'new') {
            const r = kget('view=new&days=14');
            inner = !r ? '<p class="muted">Loading…</p>' : r.error ? `<p class="pc-note">${E(r.error)}</p>` : !r.ready ? `<p class="muted">This needs a month of history to compare with. It will fill in as your NAS saves more.</p>`
              : `<p class="muted">Artists KEXP first played in the last two weeks.</p>${list(r.list, rowArtist, 'No new artists in the last two weeks.')}`;
          } else {
            const key = K.q.length > 1 ? `view=search&group=${K.group}&q=${enc(K.q)}` : null;
            inner = `<form class="rd-find" id="kx-f"><input class="inp" id="kx-q" type="search" placeholder="Artist, song or album" aria-label="Search KEXP history" value="${E(K.q)}"><button class="btn" type="submit">Search</button></form>
              ${chips('group', K.group, [['artist', 'By artist'], ['song', 'By song'], ['play', 'Every play']])}
              ${key ? list(kget(key), K.group === 'song' ? rowSong : K.group === 'play' ? (p => rowPlay(p)) : rowArtist, 'Nothing found.') : ''}`;
          }
          body = tabs + inner;
        }
        const mb = b => b == null ? '' : ' · ' + (b < 1048576 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1048576).toFixed(b < 10485760 ? 1 : 0) + ' MB') + ' on your NAS';
        el.innerHTML = `<div class="rd kx"><p class="muted kx-sum">${hist.moving ? `Moving KEXP history to its own file (${Math.min(100, Math.round(hist.moving.moved / Math.max(1, hist.moving.total) * 100))}%). Lists fill in as it goes. ` : ''}${hist.plays ?`${n(hist.plays, 'song', 'songs')} saved since ${E(day(hist.since))}${mb(hist.bytes)}${hist.backfill === 'running' ? ` · still filling in ${hist.backDays === 'all' ? 'everything back to 2001' : 'the past ' + (hist.backDays >= 365 ? Math.round(hist.backDays / 365) + (hist.backDays >= 730 ? ' years' : ' year') : hist.backDays + ' days')}${hist.paused ? ' (resting while you browse the music pages)' : ', in the background'}` : ''}` : ''}</p>${body}</div>`;
        const root = el.querySelector('.kx');
        root.onclick = e => {
          const b = e.target.closest('[data-k]'); if (!b || b.tagName === 'SUMMARY') return;
          const k = b.dataset.k;
          if (k === 'tab') { K.tab = b.dataset.v; api.storage.set('kTab', K.tab); K.detail = null; K.stack = []; api.ui.refresh(); }
          else if (k === 'wby' || k === 'wper' || k === 'cper') { K[k] = b.dataset.v; api.storage.set(k, b.dataset.v); api.ui.refresh(); }
          else if (k === 'by' || k === 'period' || k === 'group') { K[k] = b.dataset.v; if (k !== 'group') api.storage.set(k === 'by' ? 'kBy' : 'kPeriod', b.dataset.v); api.ui.refresh(); }
          else if (k === 'artist') go({ type: 'artist', artist: b.dataset.a });
          else if (k === 'song' && b.dataset.s) go({ type: 'song', artist: b.dataset.a, song: b.dataset.s });
          else if (k === 'around') go({ type: 'around', id: b.dataset.id });
          else if (k === 'program' || k === 'dj') { if (b.dataset.v) go({ type: k, name: b.dataset.v }); }
          else if (k === 'back') go((K.stack || []).pop() || null, true);
        };
        const f = root.querySelector('#kx-f'); if (f) f.onsubmit = e => { e.preventDefault(); K.q = root.querySelector('#kx-q').value.trim(); api.ui.refresh(); };
        const cb = root.querySelector('#kx-com'); if (cb) cb.onchange = () => { api.storage.set('kComments', cb.checked); api.ui.refresh(); };
      } });
      // fresh numbers each time you open it or come back to the tab (the NAS saves new plays every 5 minutes)
      api.on('render', () => { if (api.ui.currentRoute() !== 'view-kexp-history') K.away = true; });
      api.on('refocus', () => { K.away = true; });

      return () => { offMini(); offPlay(); offNow(); clearTimeout(nowTimer); clearTimeout(stTimer); };
    },
  });

  const css = document.createElement('style');
  css.textContent = `.rd{max-width:880px;display:flex;flex-direction:column;gap:10px}
    .rd-h{margin:14px 0 2px;font-size:15px}
    .kx-dj{width:36px;height:36px;border-radius:50%;object-fit:cover;flex:none} .kx-yr{color:var(--accent)}
    .kx-dec{display:flex;align-items:flex-end;gap:8px;margin:6px 0 10px;min-height:76px}.kx-dec span{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;color:var(--muted)}.kx-dec i{display:block;width:22px;border-radius:4px 4px 0 0;background:var(--accent);opacity:.7}
    .rd-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr));gap:8px} .rd-st{min-width:0}
    .rd-st{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--line);border-radius:var(--radius,10px);background:var(--card)}
    .rd-st.on{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset}
    .rd-soma summary{display:flex;align-items:baseline;gap:10px;cursor:pointer;list-style:none} .rd-soma summary::-webkit-details-marker{display:none} .rd-soma summary .rd-h{margin:0} .rd-soma[open] summary{margin-bottom:8px}
    .rd-mcdj{margin:8px 0 14px} .rd-mcl{list-style:none;padding:0;margin:6px 0 0;display:flex;flex-direction:column;gap:8px} .rd-mcl li{display:flex;align-items:center;gap:10px;flex-wrap:wrap} .rd-mcl li>div{flex:1;min-width:180px;display:flex;flex-direction:column} .rd-mcl img{border-radius:var(--r-s);object-fit:cover} .rd-mcl .muted{font-size:12px}
    #rd-mcdock{position:fixed;left:12px;bottom:84px;z-index:39;width:min(420px,calc(100vw - 24px));background:var(--panel);border:1px solid var(--line);border-radius:var(--r-l);box-shadow:var(--shadow);padding:6px 8px 8px}
    .rd-mcd-h{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--muted);margin-bottom:4px} .rd-mcd-h span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap} .rd-mcd-h button{border:0;background:transparent;color:var(--muted);cursor:pointer;display:grid;place-items:center} .rd-mcd-h svg{width:14px;height:14px}
    .rd-mcw{display:block;width:100%;height:60px;border:0;border-radius:var(--r-s)}
    .rd-hl{display:flex;align-items:center;gap:10px}
    .rd-lg{position:relative;width:var(--s);height:var(--s);flex:none;display:block} .rd-lg .rd-noart{width:100%;height:100%}
    .rd-lg .cx-logo{position:absolute;inset:0;width:100%;height:100%;margin:0;object-fit:contain;background:#fff;border-radius:var(--r-m);padding:3px;box-shadow:inset 0 0 0 1px var(--line)}
    .rd-st img,.rd-noart{width:40px;height:40px;border-radius:var(--r-m);flex:none;object-fit:cover;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent)}
    .rd-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
    .rd-t b,.rd-t span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .rd-t span{font-size:12px} .rd-miss{font-style:italic}
    .rd-act{display:flex;align-items:center;gap:4px;flex:none}
    .rd-act button:disabled{opacity:.3;cursor:default}
    .rd-now{display:flex;align-items:center;gap:14px;padding:14px}
    .rd-now img,.rd-noart.big{width:72px;height:72px;border-radius:var(--r);object-fit:cover;flex:none}
    .rd-now .rd-t b{font-size:18px;white-space:normal}
    .rd-find{display:flex;gap:6px;flex-wrap:wrap} .rd-find .inp{flex:1;min-width:160px}
    .rd-add summary{cursor:pointer;color:var(--muted);font-size:13px} .rd-add form{margin-top:8px}
    .rd-foot{font-size:12px}
    .kx-win{list-style:none;padding:0;margin:6px 0 16px;display:flex;flex-direction:column;gap:8px}.kx-win li{display:flex;gap:12px;align-items:baseline;font-size:14px}
    .kx-wp{min-width:9.5em;color:var(--muted);font-size:13px}.kx-ru{font-size:12px;margin-top:1px}.kx-ru .kx-link b{font-weight:500}
    .rd-earlier{margin:4px 0 14px;font-size:14px}.rd-earlier summary{cursor:pointer;color:var(--muted)}
    .rd-pl{list-style:none;padding:0;margin:8px 0;display:flex;flex-direction:column;gap:6px}.rd-pl li{display:flex;gap:10px;align-items:baseline;font-size:14px}
    .rd-pl li>span.muted{min-width:7.5em;font-size:12px}.rd-pl li>div{flex:1;min-width:0}
    .rd-follow{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;margin:6px 0 14px}.rd-follow .muted{flex-basis:100%;font-size:12px;margin-left:24px}
    .kx-sum{margin:0 0 4px}
    .kx-chips{display:flex;flex-wrap:wrap;gap:4px} .kx-bar{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between}
    .kx-chip{border:1px solid var(--line);background:var(--card);color:var(--text);border-radius:999px;padding:4px 12px;font:inherit;font-size:13px;cursor:pointer}
    .kx-chip.on{background:var(--accent);border-color:var(--accent);color:var(--accent-ink,#fff)}
    .kx-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
    .kx-row,.kx-play{display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:var(--r-m)}
    .kx-row{cursor:pointer} .kx-row:hover,.kx-play:hover{background:var(--hover,rgba(0,0,0,.04))}
    .kx-row img,.kx-row .rd-noart,.kx-head img,.kx-head .rd-noart{width:36px;height:36px;border-radius:var(--r-s);object-fit:cover;flex:none}
    .kx-head{display:flex;align-items:center;gap:12px;margin:8px 0} .kx-head img,.kx-head .rd-noart{width:64px;height:64px;border-radius:var(--r)}
    .kx-head h3{margin:0}
    .kx-n{font-variant-numeric:tabular-nums;font-weight:600;color:var(--muted)}
    .kx-play{align-items:flex-start} .kx-play.hl{background:var(--accent-soft);box-shadow:inset 3px 0 0 var(--accent)}
    .kx-when{width:158px;flex:none;white-space:nowrap;font-size:12px;color:var(--muted);padding-top:2px;font-variant-numeric:tabular-nums}
    .kx-play .rd-t span{white-space:normal}
    .kx-link{background:none;border:0;padding:0;font:inherit;color:inherit;cursor:pointer;text-align:left} .kx-link:hover{text-decoration:underline}
    .kx-c summary{cursor:pointer;font-size:12px;color:var(--muted)} .kx-c p{margin:4px 0 0;font-size:13px;white-space:pre-wrap}
    .kx-back{align-self:flex-start;display:inline-flex;gap:6px;align-items:center}
    .kx-bars{display:flex;align-items:flex-end;gap:2px;height:48px;padding:4px 0} .kx-bars span{flex:1;max-width:18px;background:var(--accent);opacity:.7;border-radius:2px 2px 0 0}
    .kx-tog{font-size:13px;display:flex;gap:6px;align-items:center}
    .kx-full{display:inline-flex;gap:6px;align-items:center;margin-top:6px;font-size:13px}
    .kx-show{font-size:12px} .kx-two{display:grid;grid-template-columns:1fr 1fr;gap:16px} @media (max-width:800px){.kx-two{grid-template-columns:1fr}}
    @media (max-width:640px){.kx-when{width:92px;white-space:normal}}
    @media (max-width:640px){.rd-list{grid-template-columns:minmax(0,1fr)}}`;
  document.head.appendChild(css);
})();
