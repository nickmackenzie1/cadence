/* Lyrics (user, 2026-11-19), from LRCLIB through the NAS (server/services/lyrics.js; kept there, so a song is looked up
   about once). A panel that floats above the player:
   - Live radio: follows what's on. KEXP says when each song started, so time-synced lyrics scroll along and the line
     being sung is lit; other stations count from when the title changed. The stream reaches you a little after the
     song really starts: "Earlier" and "Later" nudge the timing, remembered per station.
   - Anywhere a song is listed (artist pages, Radar, Said the Gramophone, the radio's "played earlier"): the lyrics
     button opens that song's lyrics to read.
   - From the player bar: the lyrics button on the right.
   Plain words where there's no timing. "From LRCLIB" with a link, always. */
(() => {
  Cadence.registerPlugin({
    id: 'lyrics', name: 'Lyrics', version: '1.0.0', category: 'Music', color: '#7048e8',
    icon: '<path d="m11 7.601-5.994 8.19a1 1 0 0 0 .1 1.298l.817.818a1 1 0 0 0 1.314.087L15.09 12"/><path d="M16.5 21.174C15.5 20.5 14.372 20 13 20c-2.058 0-3.928 2.356-6 2-2.072-.356-2.775-3.369-1.5-4.5"/><circle cx="16" cy="7" r="5"/>',
    tagline: 'Words to what\'s playing, in time with the radio',
    description: 'Lyrics for the song on the radio (in time with it on KEXP, where the words being sung light up), and for any song on artist pages and in Radar. From LRCLIB, a free open lyrics library, looked up through your NAS.',
    setup(api) {
      const E = api.ui.esc, ic = n => api.ui.icon(n);
      const P = () => window.CadencePodcasts;
      const cache = new Map();
      const G = { open: false, follow: false, song: null, data: null, at: 0, station: null, lastIdx: -1, timer: 0, seenAt: new Map() };
      const keyOf = (a, t) => (a + '|' + t).toLowerCase();
      const fetchLyrics = (artist, track, album) => {
        const k = keyOf(artist, track);
        if (!cache.has(k)) cache.set(k, fetch('api/lyrics?' + new URLSearchParams({ artist, track, ...(album ? { album } : {}) })).then(r => r.ok ? r.json() : r.json().then(j => ({ error: j.error || 'HTTP ' + r.status }), () => ({ error: 'HTTP ' + r.status }))).catch(e => ({ error: e.message })));
        return cache.get(k);
      };
      // how far behind the real start the stream reaches you, per station (Earlier / Later change it)
      const delayOf = st => { try { const v = JSON.parse(localStorage.getItem('cadence.ly.delay') || '{}')[st]; return typeof v === 'number' ? v : (st === 'kexp' ? 6000 : 0); } catch { return 0; } };
      const setDelay = (st, v) => { try { const o = JSON.parse(localStorage.getItem('cadence.ly.delay') || '{}'); o[st] = v; localStorage.setItem('cadence.ly.delay', JSON.stringify(o)); } catch {} };
      const liveNow = () => { const c = P() && P().current; return c && c.live && c.now && !c.now.airbreak && c.now.artist && c.now.song ? c : null; };

      function show(song, { follow = false } = {}) {
        G.open = true; G.follow = follow; G.song = song; G.data = null; G.lastIdx = -1; G.at = 0;
        draw();
        fetchLyrics(song.artist, song.track, song.album).then(d => { if (G.song !== song) return; G.data = d; G.lastIdx = -1; draw(); });
      }
      function followLive() {
        const c = liveNow(); if (!c) { api.ui.toast('Nothing with a title is playing on the radio just now'); return; }
        const n = c.now, k = keyOf(n.artist, n.song);
        if (!G.seenAt.has(k)) G.seenAt.set(k, Date.now());
        G.station = c.station;
        show({ artist: n.artist, track: n.song, album: n.album, startedAt: n.at ? Date.parse(n.at) : G.seenAt.get(k), live: true }, { follow: true });
      }
      const close = () => { G.big = false; G.open = false; G.follow = false; clearInterval(G.timer); G.timer = 0; const el = document.getElementById('ly-panel'); if (el) el.remove(); };
      window.CadenceLyrics = {
        // startedAt (ms) makes it follow along as if live (the tests use this; the radio uses live())
        open: (artist, track, album, startedAt) => { if (startedAt) G.station = 'manual'; show({ artist, track, album, ...(startedAt ? { startedAt, live: true } : {}) }); },
        live: () => followLive(),
        close,
        // a button for the player bar (live radio with a title)
        barButton: c => c && c.live && c.now && !c.now.airbreak && c.now.song ? `<button class="pc-ib${G.open && G.follow ? ' on' : ''}" data-ly-live aria-label="Lyrics" title="Lyrics">${ic('mic-vocal')}</button>` : '',
        // a button for song lists
        button: (artist, track) => artist && track ? `<button class="pv-b" data-ly data-a="${E(artist)}" data-t="${E(track)}" aria-label="Lyrics for ${E(track)}" title="Lyrics">${ic('mic-vocal')}</button>` : '',
      };

      function lineIndex(lines, ms) { let lo = 0, hi = lines.length - 1, at = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (lines[m][0] <= ms) { at = m; lo = m + 1; } else hi = m - 1; } return at; }
      function draw() {
        if (!G.open) return;
        let el = document.getElementById('ly-panel');
        if (!el) { el = document.createElement('section'); el.id = 'ly-panel'; el.setAttribute('aria-label', 'Lyrics'); document.body.appendChild(el); }
        // full screen (2026-11-19): big words, the cover blurred behind, nothing else; Esc or the button to come back
        el.className = 'ly' + (G.big ? ' ly-big' : '');
        const art = G.song && G.song.live && P() && P().current && P().current.now && P().current.now.art;
        el.style.setProperty('--ly-art', art ? `url("${String(art).replace(/["\\]/g, '')}")` : 'none');
        const s = G.song, d = G.data, synced = d && d.found && d.synced && d.synced.length, timed = synced && s.live && s.startedAt;
        const body = !d ? '<p class="muted ly-msg">Looking for the words…</p>'
          : d.error ? `<p class="muted ly-msg">Couldn't reach the lyrics library just now. ${E(d.error)}</p>`
          : !d.found ? '<p class="muted ly-msg">No lyrics for this one in LRCLIB yet.</p>'
          : d.instrumental ? '<p class="muted ly-msg">An instrumental: no words to show.</p>'
          : synced ? `<ol class="ly-l${timed ? ' timed' : ''}">${d.synced.map(([, t], i) => `<li data-i="${i}">${t ? E(t) : '<span class="ly-gap">·</span>'}</li>`).join('')}</ol>`
          : `<div class="ly-plain">${E(d.plain || '').split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')}</div>`;
        el.innerHTML = `<header class="ly-h"><div><b>${E(s.track)}</b><span class="muted">${E(s.artist)}${s.live ? ' · on the radio now' : ''}</span></div>
            ${timed ? `<span class="ly-nudge" title="The words running ahead or behind? Nudge them"><button class="pc-ib" data-ly-nudge="-1000" aria-label="Words earlier">${ic('chevron-up')}</button><button class="pc-ib" data-ly-nudge="1000" aria-label="Words later">${ic('chevron-down')}</button></span>` : ''}
            <button class="pc-ib" data-ly-big aria-label="${G.big ? 'Smaller' : 'Full screen'}" title="${G.big ? 'Smaller' : 'Full screen'}">${ic(G.big ? 'minimize-2' : 'maximize-2')}</button>
            <button class="pc-ib" data-ly-close aria-label="Close lyrics">${ic('x')}</button></header>
          <div class="ly-b">${body}</div>
          <footer class="muted ly-f">From <a href="https://lrclib.net" target="_blank" rel="noopener">LRCLIB</a>${synced && !timed ? ' · time-synced, shown as text here' : ''}</footer>`;
        clearInterval(G.timer); G.timer = 0;
        if (timed) { G.timer = setInterval(tick, 250); tick(); }
      }
      function tick() {
        const el = document.getElementById('ly-panel'); if (!el || !G.data || !G.data.synced) return;
        const pos = Date.now() - G.song.startedAt - delayOf(G.station), i = lineIndex(G.data.synced, pos);
        if (i === G.lastIdx) return; G.lastIdx = i;
        el.querySelectorAll('.ly-l li.on').forEach(x => x.classList.remove('on'));
        const li = i >= 0 && el.querySelector(`.ly-l li[data-i="${i}"]`); if (!li) return;
        li.classList.add('on');
        const box = el.querySelector('.ly-b'); if (box) box.scrollTo({ top: li.offsetTop - box.clientHeight / 2 + li.clientHeight / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
      // follow the radio: a new song on air brings its words
      const off = P() && P().on ? P().on(() => {
        if (!G.open || !G.follow) return;
        const c = liveNow(); if (!c) return;
        const n = c.now, k = keyOf(n.artist, n.song); if (!G.seenAt.has(k)) G.seenAt.set(k, Date.now());
        if (keyOf(G.song.artist, G.song.track) !== k) followLive();
      }) : null;
      window.__lyClick && document.removeEventListener('click', window.__lyClick, true);
      document.addEventListener('click', window.__lyClick = e => {
        const b = e.target.closest('[data-ly],[data-ly-live],[data-ly-close],[data-ly-nudge],[data-ly-big]'); if (!b) return;
        e.preventDefault(); e.stopPropagation();
        if (b.hasAttribute('data-ly-close')) return close();
        if (b.hasAttribute('data-ly-big')) { G.big = !G.big; G.lastIdx = -1; draw(); return; }
        if (b.hasAttribute('data-ly-live')) return G.open && G.follow ? close() : followLive();
        if (b.hasAttribute('data-ly-nudge')) { const v = delayOf(G.station) + +b.dataset.lyNudge; setDelay(G.station, v); G.lastIdx = -1; tick(); api.ui.toast(`Words ${+b.dataset.lyNudge < 0 ? 'earlier' : 'later'}: ${(v / 1000).toFixed(0)} s behind the start`); return; }
        show({ artist: b.dataset.a, track: b.dataset.t });
      }, true);
      window.__lyKey && document.removeEventListener('keydown', window.__lyKey);
      document.addEventListener('keydown', window.__lyKey = e => { if (e.key === 'Escape' && G.big) { G.big = false; G.lastIdx = -1; draw(); return; } if (e.key === 'Escape' && G.open && !document.querySelector('.modal-bg,.modal.open')) close(); });
      api.commands.add({ title: 'Lyrics for what\'s on the radio', icon: 'mic-vocal', run: () => followLive() });
      api.commands.add({ title: 'Lyrics, full screen', icon: 'maximize-2', run: () => { G.big = true; followLive(); } });

      window.CadenceKit.css('ly-css', `
        .ly{position:fixed;right:16px;bottom:calc(var(--player-h,84px) + 12px);z-index:70;width:min(380px,calc(100vw - 32px));max-height:min(62vh,560px);display:flex;flex-direction:column;
          background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:calc(var(--r,8px) + 6px);box-shadow:0 18px 48px rgba(0,0,0,.22);overflow:hidden}
        .ly-h{display:flex;gap:8px;align-items:center;padding:12px 10px 10px 16px;border-bottom:1px solid var(--line)}
        .ly-h>div{display:flex;flex-direction:column;min-width:0;flex:1}.ly-h b{font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ly-h span{font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .ly-nudge{display:flex}.ly-h .pc-ib svg{width:16px;height:16px}
        .ly-b{overflow:auto;padding:14px 18px;scroll-behavior:auto;flex:1}
        .ly-l{list-style:none;margin:0;padding:30% 0;display:flex;flex-direction:column;gap:10px;font-size:16px;line-height:1.35;font-weight:600}
        .ly-l li{color:var(--muted);transition:color .25s,transform .25s;transform-origin:left center}
        .ly-l.timed li{color:color-mix(in srgb,var(--muted) 70%,transparent)}
        .ly-l li.on{color:var(--text);transform:scale(1.04)}
        .ly-gap{opacity:.5}
        .ly-plain p{margin:0 0 14px;line-height:1.55;font-size:14.5px}
        .ly-msg{margin:8px 0}
        .ly-f{padding:8px 16px;border-top:1px solid var(--line);font-size:12px}.ly-f a{color:inherit}
        .ly.ly-big{inset:0;width:auto;max-height:none;border-radius:0;border:0;z-index:2147483000;background:#0d0d12;color:#f4f4f8}
        .ly-big::before{content:"";position:absolute;inset:-40px;background:var(--ly-art) center/cover;filter:blur(40px) brightness(.45) saturate(1.2);z-index:-1}
        .ly-big .ly-h{border:0;padding:20px 24px;background:linear-gradient(rgba(13,13,18,.6),transparent)}.ly-big .ly-h b{font-size:20px}.ly-big .muted{color:rgba(244,244,248,.65)}
        .ly-big .ly-h .pc-ib{color:#f4f4f8}
        .ly-big .ly-b{display:flex;justify-content:center}.ly-big .ly-l,.ly-big .ly-plain{max-width:820px;width:100%}
        .ly-big .ly-l{font-size:clamp(22px,3.4vw,40px);gap:22px;padding:35vh 0}.ly-big .ly-l li{color:rgba(244,244,248,.35)}.ly-big .ly-l li.on{color:#fff;transform:none}
        .ly-big .ly-plain p{font-size:clamp(18px,2.2vw,26px);line-height:1.5}
        .ly-big .ly-f{border:0;text-align:center;color:rgba(244,244,248,.5)}
        @media (max-width:640px){.ly{right:8px;left:8px;width:auto;bottom:calc(var(--player-h,84px) + var(--tabbar-h,0px) + 8px)}}
        @media (prefers-reduced-motion:reduce){.ly-l li{transition:none}.ly-l li.on{transform:none}}
      `);
      return () => { close(); off && off(); delete window.CadenceLyrics; };
    }
  });
})();
