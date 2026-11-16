/* Radio (user, 2026-11-15): "a radio player too, KEXP, good stuff like that, Amherst Island Radio for local".
   Plays through the same audio element and mini player as Podcasts, so only one thing plays and it keeps going
   when you switch space, view or tab. Stream addresses come from the NAS (api/radio/*), which looks them up in
   Radio Browser; http:// streams are relayed by the NAS because an https page can't play them directly. */
(() => {
  const P = window.CadencePodcasts;
  if (!P) { console.warn('Radio needs the shared player from podcasts.js'); return; }
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const playable = url => (location.protocol === 'https:' && /^http:\/\//i.test(url) ? 'api/radio/stream?u=' + encodeURIComponent(url) : url);
  const getJson = async u => { const r = await fetch(u); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j; };

  Cadence.registerPlugin({
    id: 'radio', name: 'Radio', version: '1.0.0', category: 'Media', color: '#64748b',
    icon: '<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>',
    tagline: 'KEXP, campus and community radio, and any station you can find, in the same player as Podcasts.',
    description: 'Indie, college and community stations, with Amherst Island Radio and the Toronto and Kingston campus stations for local. Search thousands more (Radio Browser, no account needed) and save your own. KEXP shows what song is on. Works in Work and Life and keeps playing everywhere.',
    setup(api) {
      const offMini = P.useMini ? P.useMini(api) : () => {};
      let stations = null, results = null, searching = false, error = null, nowTimer = 0, hist = null;
      const mine = () => api.storage.get('mine') || [];
      const setMine = list => api.storage.set('mine', list);
      const load = async () => { try { stations = await getJson('api/radio/stations'); error = null; } catch (e) { error = e.message; stations = stations || []; }
        try { hist = await getJson('api/radio/kexp-history'); } catch { hist = null; } refresh(); };
      const day = iso => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
      const refresh = () => { if (api.ui.currentRoute() === 'view-radio') api.ui.refresh(); };

      const play = s => {
        if (!s.url) return api.ui.toast("Couldn't find a stream for " + s.name);
        P.load({ uuid: 'radio:' + s.id, live: true, station: s.id, now: null, title: s.name, podcastTitle: s.place || 'Live radio', url: playable(s.url), art: s.art || null }, true);
        pollNow();
      };
      // KEXP: what's on now, every 30 s while it's the station that's playing
      const pollNow = async () => {
        clearTimeout(nowTimer); const c = P.current;
        if (!c || !c.live || c.station !== 'kexp') return;
        try { P.setNow(await getJson('api/radio/now?id=kexp')); } catch (e) { /* the stream keeps playing without it */ }
        if (!P.audio.paused) nowTimer = setTimeout(pollNow, 30000);
      };
      const offPlay = P.on(() => { const c = P.current; if (c && c.live && c.station === 'kexp' && !P.audio.paused && !nowTimer) pollNow(); if (P.audio.paused) { clearTimeout(nowTimer); nowTimer = 0; } });

      const card = (s, opts = {}) => {
        const c = P.current, on = c && c.live && c.uuid === 'radio:' + s.id, playing = on && !P.audio.paused;
        return `<div class="rd-st${on ? ' on' : ''}">
          ${s.art ? `<img src="${E(s.art)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('i'),{className:'rd-noart'}))">` : `<i class="rd-noart">${api.ui.icon('radio')}</i>`}
          <div class="rd-t"><b>${E(s.name)}</b><span class="muted">${E([s.place, s.about].filter(Boolean).join(' · '))}</span>
            ${s.missing ? `<span class="muted rd-miss">Couldn't find its stream right now</span>` : ''}</div>
          <div class="rd-act">
            ${s.home ? `<a class="pc-ib" href="${E(s.home)}" target="_blank" rel="noopener" aria-label="${E(s.name)} website" title="Website">${api.ui.icon('external-link')}</a>` : ''}
            ${opts.save ? `<button class="pc-ib" data-rd="save" data-i="${opts.i}" aria-label="Save ${E(s.name)}" title="Save to your stations">${api.ui.icon('plus')}</button>` : ''}
            ${opts.remove ? `<button class="pc-ib" data-rd="remove" data-id="${E(s.id)}" aria-label="Remove ${E(s.name)}" title="Remove">${api.ui.icon('x')}</button>` : ''}
            <button class="pc-ib pc-big" data-rd="${playing ? 'pause' : 'play'}" data-id="${E(s.id)}" ${opts.save ? `data-i="${opts.i}"` : ''} aria-label="${playing ? 'Pause' : 'Play'} ${E(s.name)}" ${s.url ? '' : 'disabled'}>${api.ui.icon(playing ? 'pause' : 'play')}</button>
          </div></div>`;
      };

      api.views.add({ id: 'radio', title: 'Radio', icon: '📻', subtitle: 'Indie, college and community stations', wide: true, render: el => {
        if (!stations) { el.innerHTML = `<div class="rd"><p class="muted">Tuning the dial…</p></div>`; load(); return; }
        const c = P.current, live = c && c.live ? c : null, n = live && live.now && !live.now.airbreak ? live.now : null;
        const my = mine();
        el.innerHTML = `<div class="rd">
          ${live ? `<div class="pc-card rd-now">${(n && n.art) || live.art ? `<img src="${E((n && n.art) || live.art)}" alt="" onerror="this.style.visibility='hidden'">` : `<i class="rd-noart big">${api.ui.icon('radio')}</i>`}
            <div class="rd-t"><span class="muted">${P.failed ? "Can't reach this station right now" : P.audio.paused ? 'Paused' : 'Live'}${live.now && live.now.airbreak ? ' · DJ talking' : ''}</span>
              <b>${E(n ? n.song : live.title)}</b><span class="muted">${E(n ? `${n.artist}${n.album ? ' · ' + n.album : ''} · ${live.title}` : live.podcastTitle)}</span></div>
            <button class="pc-ib pc-big" data-rd="${P.audio.paused ? 'resume' : 'pause'}" aria-label="${P.audio.paused ? 'Play' : 'Pause'}">${api.ui.icon(P.audio.paused ? 'play' : 'pause')}</button></div>` : ''}
          ${error ? `<p class="pc-note">${api.ui.icon('refresh-cw')}Couldn't load stations from the NAS: ${E(error)}</p>` : ''}
          ${my.length ? `<h3 class="rd-h">Your stations</h3><div class="rd-list">${my.map(s => card(s, { remove: true })).join('')}</div>` : ''}
          <h3 class="rd-h">Stations</h3><div class="rd-list">${stations.map(s => card(s)).join('')}</div>
          <h3 class="rd-h">Find a station</h3>
          <form class="rd-find" id="rd-find"><input class="inp" id="rd-q" type="search" placeholder="Name, city or genre (shoegaze, college, Kingston…)" aria-label="Find a station" value="${E(api.storage.get('lastQ') || '')}">
            <button class="btn" type="submit">${searching ? 'Looking…' : 'Search'}</button></form>
          ${results ? (results.length ? `<div class="rd-list">${results.map((s, i) => card(s, { save: true, i })).join('')}</div>` : `<p class="muted">Nothing found. Try another name or a genre.</p>`) : ''}
          <details class="rd-add"><summary>Add a station by its stream address</summary>
            <form id="rd-addf" class="rd-find"><input class="inp" id="rd-an" placeholder="Name" aria-label="Station name"><input class="inp" id="rd-au" type="url" placeholder="https://…" aria-label="Stream address"><button class="btn" type="submit">Add</button></form></details>
          ${hist && hist.on && hist.plays ? `<p class="muted rd-foot">${api.ui.icon('history')} Your NAS is keeping KEXP's playlist: ${hist.plays.toLocaleString()} songs since ${day(hist.since)}${hist.backfill === 'running' ? ', still filling in the past year' : ''}. Searching it is coming next.</p>` : ''}
          <p class="muted rd-foot">Stream addresses come from Radio Browser, a free community directory, looked up by your NAS.</p>
        </div>`;
        const byId = id => stations.find(s => s.id === id) || my.find(s => s.id === id);
        el.querySelector('.rd').onclick = e => {
          const b = e.target.closest('[data-rd]'); if (!b) return;
          const act = b.dataset.rd, s = b.dataset.i != null && results ? results[+b.dataset.i] : byId(b.dataset.id);
          if (act === 'play' && s) play(s);
          else if (act === 'pause') P.pause();
          else if (act === 'resume') P.play();
          else if (act === 'save' && s) { if (!my.some(x => x.id === s.id)) setMine([...my, s]); api.ui.toast('Saved ' + s.name); refresh(); }
          else if (act === 'remove') { setMine(my.filter(x => x.id !== b.dataset.id)); refresh(); }
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
      return () => { offMini(); offPlay(); clearTimeout(nowTimer); };
    },
  });

  const css = document.createElement('style');
  css.textContent = `.rd{max-width:880px;display:flex;flex-direction:column;gap:10px}
    .rd-h{margin:14px 0 2px;font-size:15px}
    .rd-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px}
    .rd-st{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--line);border-radius:var(--radius,10px);background:var(--card)}
    .rd-st.on{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset}
    .rd-st img,.rd-noart{width:40px;height:40px;border-radius:8px;flex:none;object-fit:cover;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent)}
    .rd-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
    .rd-t b,.rd-t span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .rd-t span{font-size:12px} .rd-miss{font-style:italic}
    .rd-act{display:flex;align-items:center;gap:4px;flex:none}
    .rd-act button:disabled{opacity:.3;cursor:default}
    .rd-now{display:flex;align-items:center;gap:14px;padding:14px}
    .rd-now img,.rd-noart.big{width:72px;height:72px;border-radius:10px;object-fit:cover;flex:none}
    .rd-now .rd-t b{font-size:18px;white-space:normal}
    .rd-find{display:flex;gap:6px;flex-wrap:wrap} .rd-find .inp{flex:1;min-width:160px}
    .rd-add summary{cursor:pointer;color:var(--muted);font-size:13px} .rd-add form{margin-top:8px}
    .rd-foot{font-size:12px}
    @media (max-width:640px){.rd-list{grid-template-columns:1fr}}`;
  document.head.appendChild(css);
})();
