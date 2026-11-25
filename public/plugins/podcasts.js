/* Podcasts: your Pocket Casts shows, Up next, new episodes and your place in each, with a player that belongs to the
   whole app (user, 2026-11-13: one plugin for Work and Life, and it keeps playing whatever you switch: space, view or
   browser tab). Sync runs on the NAS (server/services/pocketcasts.js); this file never sees your login.

   The player is a single <audio> owned by window.CadencePodcasts, created once when this file loads and kept on
   <html>, outside the page THING re-renders. A plugin rebuild or a space switch only redraws the controls around it.
   Your place is saved locally every few seconds and sent back to Pocket Casts every 30 s, on pause, and at the end. */
(() => {
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = s => { s = Math.max(0, Math.round(isFinite(s) ? s || 0 : 0)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
  const left = e => Math.max(0, (e.duration || 0) - (e.position || 0));
  const LS = 'cadence.pc.';
  const lsGet = (k, d) => { try { const v = localStorage.getItem(LS + k); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const skin = () => (lsGet('skin', 'calm') === 'classic' ? 'classic' : 'calm');
  const SK = () => ({ b: +lsGet('skipBack', 10) || 10, f: +lsGet('skipFwd', 30) || 30 });   // skip lengths (Podcasts settings)
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch {} };
  const post = (u, b) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.ok ? r.json() : null).catch(() => null);

  // ---- the one player ----
  const P = window.CadencePodcasts || (window.CadencePodcasts = (() => {
    const audio = document.createElement('audio'); audio.preload = 'metadata'; audio.id = 'pc-audio'; document.documentElement.appendChild(audio);
    const listeners = new Set(), emit = () => listeners.forEach(f => { try { f(); } catch (e) {} });
    let cur = lsGet('current', null), lastSent = 0, sleepAt = 0, sleepTimer = 0;
    // visualizer on: everything plays through the NAS relay (api/radio/stream, seeking passes through), because a browser
    // can only analyse sound from its own server. Once the sound engine exists it stays in the path, so keep relaying.
    let viz = !!lsGet('viz', false), actx = null, an = null, anL = null, anR = null, comp = null, gain = null, level = !!lsGet('level', false);
    // Even volume (2026-11-17, off by default): a gentle compressor with a little make-up gain, so a quiet station and a
    // loud one land near each other. It lives in the same sound engine as the visualizer, so it plays through the relay too.
    const setLevelNodes = () => { if (!comp) return; const t = actx.currentTime;
      comp.threshold.setValueAtTime(level ? -30 : 0, t); comp.knee.setValueAtTime(level ? 20 : 0, t); comp.ratio.setValueAtTime(level ? 3.5 : 1, t);
      comp.attack.setValueAtTime(0.02, t); comp.release.setValueAtTime(0.4, t); gain.gain.setTargetAtTime(level ? 1.6 : 1, t, 0.1); };
    let castOK = false;
    audio.setAttribute('x-webkit-airplay', 'allow');
    if (window.WebKitPlaybackTargetAvailabilityEvent) audio.addEventListener('webkitplaybacktargetavailabilitychanged', e => { castOK = e.availability === 'available'; emit(); });
    else if (audio.remote && audio.remote.watchAvailability) audio.remote.watchAvailability(a => { castOK = !!a; emit(); }).catch(() => {});
    // the sound engine starts on a click: when even volume is on, the first Play builds it
    audio.addEventListener('play', () => { wake(); if (level && window.CadencePodcasts) window.CadencePodcasts.analyser(); });
    // and if it still won't run while something plays, say so rather than playing silence
    audio.addEventListener('playing', () => setTimeout(() => { if (actx && actx.state !== 'running' && !audio.paused) { wake();
      setTimeout(() => { if (actx && actx.state !== 'running' && !audio.paused && P.toast) P.toast('Tap anywhere to turn the sound on'); }, 800); } }, 700));
    const activated = () => !navigator.userActivation || navigator.userActivation.hasBeenActive;
    // any click, tap or key wakes a paused sound engine (Safari only allows it inside one)
    const wake = () => { if (actx && actx.state !== 'running') actx.resume().catch(() => {}); };
    for (const ev of ['pointerdown', 'touchend', 'keydown']) addEventListener(ev, wake, { capture: true, passive: true });
    const own = u => { try { return new URL(u, location.href).origin === location.origin; } catch (e) { return true; } };
    const via = u => ((viz || actx) && u && !own(u) ? 'api/radio/stream?u=' + encodeURIComponent(u) : u);
    const setSrc = u => { const r = via(u); audio.crossOrigin = r && own(r) && (viz || actx) ? 'anonymous' : null; audio.src = r; };
    const savePos = () => { if (!cur || cur.live || cur.preview) return; cur.position = audio.currentTime || cur.position || 0; lsSet('current', cur); lsSet('pos.' + cur.uuid, cur.position); };
    const sendPos = played => { if (!cur || !cur.podcast || cur.live) return; lastSent = Date.now(); post('api/podcasts/progress', { uuid: cur.uuid, podcast: cur.podcast, position: played ? cur.duration || audio.duration || 0 : audio.currentTime, played }); };
    audio.addEventListener('timeupdate', () => { savePos(); if (Date.now() - lastSent > 30000 && !audio.paused) sendPos(false); emit(); });
    audio.addEventListener('pause', () => { savePos(); sendPos(false); emit(); });
    audio.volume = Math.max(0, Math.min(1, +lsGet('volume', 1))); audio.addEventListener('volumechange', emit); audio.addEventListener('seeked', emit);
    audio.addEventListener('play', emit); audio.addEventListener('error', emit); audio.addEventListener('waiting', emit); audio.addEventListener('playing', emit); audio.addEventListener('loadedmetadata', () => { if (cur && !cur.duration) cur.duration = audio.duration; emit(); });
    audio.addEventListener('ended', () => { if (cur && cur.live) return emit();
      if (cur && cur.archive && P.onArchiveEnded) { P.onArchiveEnded(cur, audio.duration); return; }   // KEXP's archive carries on into the next show
      if (cur && cur.preview) { emit(); if (P.onPreviewEnded) P.onPreviewEnded(cur); return; } sendPos(true); const q = lsGet('queue', []); const next = q.shift(); lsSet('queue', q); if (next) api.play(next); else emit(); });
    const media = () => { if (!('mediaSession' in navigator) || !cur) return;
      const n = cur.live && cur.now && !cur.now.airbreak ? cur.now : null;
      navigator.mediaSession.metadata = new MediaMetadata({ title: n ? n.song : cur.title, artist: n ? n.artist + ' · ' + cur.title : cur.podcastTitle, album: cur.live ? 'Radio' : 'Podcasts', artwork: (n && n.art) || cur.art ? [{ src: (n && n.art) || cur.art, sizes: '200x200' }] : [] });
      const h = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f); } catch (e) {} };
      h('play', () => api.play()); h('pause', () => audio.pause());
      // live radio can't seek
      h('seekbackward', cur.live ? null : () => api.skip(-SK().b)); h('seekforward', cur.live ? null : () => api.skip(SK().f));
      h('seekto', cur.live ? null : d => { audio.currentTime = d.seekTime; }); h('nexttrack', cur.live ? null : () => audio.dispatchEvent(new Event('ended'))); };
    const api = {
      audio, emit: () => emit(), get current() { return cur; }, on: f => { listeners.add(f); return () => listeners.delete(f); },
      load(e, autoplay) {
        if (!e || !e.url) return; if (cur && cur.uuid !== e.uuid) { savePos(); sendPos(false); }
        if (e.live) {   // a radio station: no position to restore, always the live edge
          cur = { ...e, position: 0 }; lsSet('current', cur); setSrc(e.url); audio.playbackRate = 1; media();
          if (autoplay) audio.play().catch(() => emit()); emit(); return;
        }
        // resume from whichever is further along: this device, or Pocket Casts (your phone)
        // exact: start right there (KEXP's archive at a chosen moment, a song in a kept show), not where you left off
        cur = { ...e, position: e.exact ? +e.position || 0 : Math.max(+e.position || 0, +lsGet('pos.' + e.uuid, 0) || 0) }; delete cur.exact; lsSet('current', cur);
        setSrc(e.url); audio.playbackRate = lsGet('rate', 1);
        const seek = () => { if (cur.position && (!audio.duration || cur.position < audio.duration - 5)) audio.currentTime = cur.position; audio.removeEventListener('loadedmetadata', seek); };
        audio.addEventListener('loadedmetadata', seek); media();
        if (autoplay) audio.play().catch(() => {}); emit();
      },
      play(e) { wake(); if (e) this.load(e, true); else if (cur) { if (!audio.src || cur.live) this.load(cur, true); else audio.play().catch(() => {}); } },
      // radio: what's on now (KEXP), shown in the mini player and on the lock screen
      setNow(n) { if (!cur || !cur.live) return; cur.now = n || null; lsSet('current', cur); media(); emit(); },
      get failed() { return !!(audio.error && cur); },
      pause() { audio.pause(); }, toggle() { audio.paused ? this.play() : this.pause(); },
      skip(d) { if (cur && cur.live) return; if (audio.src) audio.currentTime = Math.max(0, Math.min((audio.duration || 1e9) - 1, audio.currentTime + d)); },
      rate(r) { audio.playbackRate = r; lsSet('rate', r); emit(); },
      sleep(min) { clearTimeout(sleepTimer); sleepAt = min ? Date.now() + min * 60e3 : 0; if (min) sleepTimer = setTimeout(() => { audio.pause(); sleepAt = 0; emit(); }, min * 60e3); emit(); },
      get sleepLeft() { return sleepAt ? Math.max(0, Math.round((sleepAt - Date.now()) / 60e3)) : 0; },
      // the visualizer's ears: { an, anL, anR, ctx } (an for spectrum and wave, anL/anR for the VU needles)
      analyser() {
        if (!viz) return null;
        // the browser only lets a sound engine start from a click or tap. One made earlier (a visualizer drawing as the
        // page loads) stays paused, and since every sound goes through it, nothing could be heard anywhere (user,
        // 2026-11-18: "the audio playing is also not working across the board"). So: wait for a click first.
        if (!actx && !activated()) return null;
        if (!actx) {
          try {
            actx = new (window.AudioContext || window.webkitAudioContext)();
            const src = actx.createMediaElementSource(audio), sp = actx.createChannelSplitter(2);
            an = actx.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0.72;
            anL = actx.createAnalyser(); anR = actx.createAnalyser(); anL.fftSize = anR.fftSize = 1024;
            comp = actx.createDynamicsCompressor(); gain = actx.createGain(); setLevelNodes();
            src.connect(comp); comp.connect(gain); gain.connect(an); an.connect(actx.destination); gain.connect(sp); sp.connect(anL, 0); sp.connect(anR, 1);
          } catch (e) { console.warn('visualizer: no sound engine', e); actx = null; return null; }
        }
        if (actx.state === 'suspended') actx.resume().catch(() => {});
        return { an, anL, anR, ctx: actx };
      },
      get viz() { return viz; },
      get engine() { return actx ? actx.state : null; },   // the sound engine: null (not made yet), 'running' or 'suspended'
      get level() { return level; },
      setLevel(on) { level = !!on; lsSet('level', level); if (level) { this.setViz(true); if (!audio.paused) this.analyser(); } setLevelNodes(); emit(); },
      // another speaker: AirPlay (Safari) or the Remote Playback picker (Chrome on Android: Cast)
      get canCast() { return castOK; },
      cast() { try { if (audio.webkitShowPlaybackTargetPicker) audio.webkitShowPlaybackTargetPicker(); else if (audio.remote) audio.remote.prompt().catch(() => {}); } catch (e) {} },
      setViz(on) {
        on = !!on; if (on === viz) return; viz = on; lsSet('viz', viz);
        // switch what's playing over to the relay without losing your place
        if (viz && cur && audio.src && !own(audio.src)) {
          const t = audio.currentTime, playing = !audio.paused; setSrc(cur.url);
          if (!cur.live && t) { const s = () => { audio.currentTime = t; audio.removeEventListener('loadedmetadata', s); }; audio.addEventListener('loadedmetadata', s); }
          if (playing) audio.play().catch(() => {});
        }
        emit();
      },
      queue(e) { const q = lsGet('queue', []).filter(x => x.uuid !== e.uuid); q.push(e); lsSet('queue', q); emit(); }, get queued() { return lsGet('queue', []); },
    };
    // a reload doesn't start playing by itself, but the mini player is ready with your place
    if (cur && cur.url && cur.live) setTimeout(media, 0);   // a stream would start downloading: wait for Play
    else if (cur && cur.url) { setSrc(cur.url); const s = () => { if (cur.position) audio.currentTime = cur.position; audio.removeEventListener('loadedmetadata', s); }; audio.addEventListener('loadedmetadata', s); setTimeout(media, 0); }
    addEventListener('pagehide', () => { savePos(); if (cur && !audio.paused) navigator.sendBeacon && navigator.sendBeacon('api/podcasts/progress', new Blob([JSON.stringify({ uuid: cur.uuid, podcast: cur.podcast, position: audio.currentTime })], { type: 'application/json' })); });
    return api;
  })());

  // ---- the mini player: one bar, kept on <html> like the audio, shown whenever something is loaded ----
  function mini(api) {
    // the redesign (user, 2026-11-16: "out of place … ugly"): one card in the app's own surface, border, shadow and
    // corners; a calm play button; times in steady digits; progress as a thin line along the bottom edge (click to jump);
    // a little live visualizer that opens the big one. The text and buttons redraw; the visualizer canvas stays put.
    let bar = document.getElementById('pc-mini');
    if (!bar) { bar = document.createElement('div'); bar.id = 'pc-mini'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Player'); document.documentElement.appendChild(bar); }
    // two looks (Podcasts settings → Player look): Calm (the app's own) and Classic (user, 2026-11-16: "winamp inspired
    // player skin"): a gunmetal body, black LCD with big green time and a scrolling title, spectrum, seek and volume.
    // A recreation in CSS only: the title bar says Cadence, no logo, no slogan.
    let L, R, line, W = null;
    // where it sits (user, 2026-11-18: "make the mini player go away somehow … maybe it snaps to the sidebar"):
    // float (the bar at the bottom), side (in the sidebar, on wide screens) or tuck (a small round button)
    const wide = matchMedia('(min-width: 900px)');
    const place = () => { const p = lsGet('place', 'float'); return p === 'side' && !wide.matches ? 'float' : p; };
    const look = () => place() === 'tuck' || place() === 'side' ? 'calm' : skin();   // the classic look only floats
    const key = () => look() + ':' + place();
    const seat = () => { const side = document.getElementById('side'), want = place() === 'side' && side ? side : document.documentElement; if (bar.parentNode !== want) want.appendChild(bar); };
    wide.addEventListener('change', () => { build(); draw(); });
    const build = () => {
      const lk = look(); bar.dataset.skin = skin(); bar.dataset.key = key(); bar.dataset.place = place(); bar.className = lk === 'classic' ? 'pc-wa' : place() === 'tuck' ? 'pc-tuck' : ''; seat();
      if (lk === 'classic') {
        P.setViz(true);   // its little spectrum always moves, like the original: the sound goes through the NAS relay
        // after the user's own recreation (2026-11-16): gold title pills, lime-on-black time, cream seek bar with a gold
        // thumb, bevelled buttons where the active one lights up, and a playlist that folds open from its title
        const bt = (act, ic, label) => `<button data-pc="${act}" aria-label="${label}" title="${label}">${api.ui.icon(ic)}</button>`;
        bar.innerHTML = `<div class="wa-box"><div class="wa-tt"><i class="wa-ln"></i><b>THING</b><i class="wa-ln"></i><button class="wa-x" data-pc="tuck" title="Tuck the player away" aria-label="Tuck the player away">${api.ui.icon('chevron-down')}</button><button class="wa-x" data-pc="skin" title="Back to the calm look" aria-label="Back to the calm look">${api.ui.icon('minimize-2')}</button></div>
          <div class="wa-cmd"><div class="wa-row"><div class="wa-left"><div class="wa-time"><span class="wa-st"></span><span class="wa-t"></span></div><button class="wa-vis" data-pc="viz" title="Visualizer" aria-label="Open the visualizer"><canvas data-style="classic"></canvas></button></div>
            <div class="wa-right"><div class="wa-mq"><span></span></div><div class="wa-meta"><span class="wa-f wa-kind"></span><span class="wa-f wa-rate"></span><span class="wa-led wa-vled">vis</span><button class="wa-led wa-lled" data-pc="level" title="Even out the volume between stations" aria-label="Even out the volume between stations">lvl</button>${'' }</div>
              <input class="wa-vol" type="range" min="0" max="100" step="1" aria-label="Volume" title="Volume"></div></div>
            <input class="wa-seek" type="range" min="0" max="1000" step="1" aria-label="Seek">
            <div class="wa-btns"><div class="wa-b1">${bt('back', 'skip-back', 'Back')}${bt('play', 'play', 'Play')}${bt('pause', 'pause', 'Pause')}${bt('stop', 'square', 'Stop')}${bt('fwd', 'skip-forward', 'Forward')}</div>
              <button class="wa-wide" data-pc="pl" aria-label="Show Up next">Up next</button><button class="wa-cast" data-pc="cast" hidden aria-label="Play on a speaker" title="Play on a speaker">${api.ui.icon('cast')}</button><a class="wa-open" aria-label="Open where this came from" title="Open where this came from">${api.ui.icon('external-link')}</a></div></div></div>
          <div class="wa-box wa-plbox"><div class="wa-tt wa-tt-s" data-pc="pl" role="button" tabindex="0" aria-label="Fold Up next"><i class="wa-ln"></i><b>Up next</b><i class="wa-ln"></i></div><div class="wa-list"></div></div>`;
        W = { st: bar.querySelector('.wa-st'), time: bar.querySelector('.wa-t'), mq: bar.querySelector('.wa-mq span'), kind: bar.querySelector('.wa-kind'), rate: bar.querySelector('.wa-rate'),
          visLed: bar.querySelector('.wa-vled'), vol: bar.querySelector('.wa-vol'), seek: bar.querySelector('.wa-seek'), open: bar.querySelector('.wa-open'), list: bar.querySelector('.wa-list'), plbox: bar.querySelector('.wa-plbox'), dragging: false };
        W.plbox.hidden = !lsGet('waPl', false);
        W.vol.oninput = () => { P.audio.volume = W.vol.value / 100; lsSet('volume', P.audio.volume); };
        W.seek.onpointerdown = () => { W.dragging = true; }; W.seek.onchange = () => { W.dragging = false; const a = P.audio; if (P.current && !P.current.live && isFinite(a.duration) && a.duration) a.currentTime = W.seek.value / 1000 * a.duration; };
        W.list.ondblclick = e => { const r = e.target.closest('[data-q]'); if (!r) return; const q = lsGet('queue', []), it = q.find(x => x.uuid === r.dataset.q); if (!it) return; lsSet('queue', q.filter(x => x !== it)); P.play(it); };
        L = R = line = null;
      } else {
        bar.innerHTML = `<div class="pc-m-l"></div><button class="pc-m-viz" data-pc="viz" title="Visualizer" aria-label="Open the visualizer"><canvas></canvas></button><div class="pc-m-r"></div><i class="pc-m-line" data-pc-seek><i></i></i>`;
        L = bar.querySelector('.pc-m-l'); R = bar.querySelector('.pc-m-r'); line = bar.querySelector('.pc-m-line > i'); W = null;
      }
      if (window.CadenceViz) window.CadenceViz.mini(bar.querySelector('canvas'));
    };
    build();
    const mmss = t => { t = Math.max(0, Math.floor(t || 0)); const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, x = String(t % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${String(m).padStart(2, '0')}:${x}`; };
    const classic = (c, a) => {
      const live = !!c.live, n = live && c.now && !c.now.airbreak ? c.now : null;
      const d = isFinite(a.duration) && a.duration ? a.duration : c.duration || (c.preview ? 30 : 0), t = a.readyState ? a.currentTime : (live ? 0 : c.position || 0);
      const title = live ? (n ? `${n.artist ? n.artist + ' - ' : ''}${n.song} · ${c.title}` : c.title) : `1. ${c.podcastTitle} - ${c.title}${d ? ` (${mmss(d)})` : ''}${c.preview && !c.full ? ' preview' : ''}`;
      if (W.mq.dataset.t !== title) { W.mq.dataset.t = title; W.mq.textContent = title + '  ***  '; W.mq.parentElement.classList.toggle('run', title.length > 30); }
      W.st.innerHTML = api.ui.icon(P.failed ? 'circle-alert' : a.paused ? 'pause' : 'play'); W.st.className = 'wa-st' + (a.paused ? '' : ' on');
      W.time.textContent = live && P.failed ? '--:--' : mmss(t);
      W.kind.textContent = live ? 'LIVE' : c.full ? 'SONG' : c.preview ? 'PREV' : 'POD'; W.rate.textContent = (a.playbackRate || 1).toFixed(1) + 'x';
      W.visLed.classList.toggle('lit', !!(window.CadenceViz && window.CadenceViz.isOpen));
      const ll = bar.querySelector('.wa-lled'); ll.classList.toggle('lit', P.level); ll.setAttribute('aria-pressed', P.level);
      const cb = bar.querySelector('.wa-cast'); if (cb) cb.hidden = !P.canCast;
      if (document.activeElement !== W.vol) W.vol.value = Math.round(a.volume * 100);
      W.vol.style.setProperty('--v', (a.volume * 100).toFixed(0) + '%');
      W.seek.disabled = live; if (!W.dragging) W.seek.value = d && !live ? Math.round(t / d * 1000) : 0;
      // the lit button: playing, paused part-way, or stopped (paused at the start)
      const state = !a.paused ? 'play' : (!live && t > 0.5) ? 'pause' : 'stop';
      for (const k of ['play', 'pause', 'stop']) bar.querySelector(`.wa-b1 [data-pc=${k}]`).classList.toggle('lit', k === state);
      const href = live ? '#view-radio' : c.preview ? (c.link || '') : '#view-podcasts';
      if (href) { W.open.href = href; W.open.hidden = false; if (/^https?:/.test(href)) { W.open.target = '_blank'; W.open.rel = 'noopener'; } else W.open.removeAttribute('target'); } else W.open.hidden = true;
      bar.querySelector('[data-pc=back]').disabled = live; bar.querySelector('[data-pc=fwd]').disabled = live;
      bar.querySelector('.wa-wide').classList.toggle('lit', !W.plbox.hidden);
      // the playlist: what's on now, then Up next (double-click one to play it)
      if (!W.plbox.hidden) {
        const q = lsGet('queue', []), key = c.uuid + '|' + q.map(x => x.uuid).join(',');
        if (W.list.dataset.k !== key) {
          W.list.dataset.k = key;
          const row = (x, i, on) => `<div class="wa-tr${on ? ' on' : ''}"${on ? '' : ` data-q="${E(x.uuid)}" title="Double-click to play"`}><span>${i}. ${E(x.podcastTitle ? x.podcastTitle + ' - ' : '')}${E(x.title)}</span><span>${x.live ? 'live' : x.duration ? mmss(x.duration) : ''}</span></div>`;
          W.list.innerHTML = row(c, 1, true) + (q.length ? q.map((x, i) => row(x, i + 2, false)).join('') : '<div class="wa-tr wa-empty"><span>Nothing in Up next. Add episodes from Podcasts.</span></div>');
        }
      }
    };
    const ib = (act, ic, label, extra = '') => `<button class="pc-ib" data-pc="${act}" aria-label="${E(label)}" title="${E(label)}"${extra}>${api.ui.icon(ic)}</button>`;
    const where = () => place() === 'tuck' ? ib('unfold', 'chevron-up', 'Bring the player back') : `${place() === 'side' ? ib('place-float', 'maximize-2', 'Put the player back at the bottom') : wide.matches ? ib('place-side', 'panel-left', 'Put the player in the sidebar') : ''}${ib('tuck', 'chevron-down', 'Tuck the player away')}`;
    const extras = () => `${window.CadenceLyrics && P.current ? window.CadenceLyrics.barButton(P.current) : ''}${P.canCast ? ib('cast', P.audio.webkitShowPlaybackTargetPicker ? 'airplay' : 'cast', 'Play on a speaker') : ''}${ib('level', 'audio-lines', P.level ? 'Even volume is on' : 'Even out the volume between stations', ` aria-pressed="${P.level}"${P.level ? ' data-on="1"' : ''}`)}`;
    const play = a => `<button class="pc-ib pc-play${a.paused ? '' : ' on'}" data-pc="toggle" aria-label="${a.paused ? 'Play' : 'Pause'}">${api.ui.icon(a.paused ? 'play' : 'pause')}</button>`;
    const art = (src, ic) => (src ? `<img src="${E(src)}" alt="" onerror="this.style.visibility='hidden'">` : `<i class="pc-noart">${api.ui.icon(ic)}</i>`);
    // write a part only when it changed: rebuilding the artwork 4 times a second made it flash (user, 2026-11-16)
    const put = (el, html) => { if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; } };
    const draw = () => {
      const c = P.current; bar.hidden = !c; if (!c) return;
      if (bar.dataset.key !== key()) build();
      const a = P.audio; let pct = 0;
      if (W) { bar.style.fontFamily = ''; return classic(c, a); }
      bar.style.fontFamily = getComputedStyle(document.body).fontFamily;
      if (c.live) {
        const n = c.now && !c.now.airbreak ? c.now : null, state = P.failed ? "Can't reach this station right now" : !a.paused && a.readyState < 3 ? 'Tuning in…' : a.paused ? 'Paused' : 'Live';
        put(L, `${n && n.art ? art(n.art, 'radio') : `<span class="pc-lg"><i class="pc-noart">${api.ui.icon('radio')}</i>${c.art || c.home ? api.ui.logo(c.home, { img: c.art, size: 42 }) : ''}</span>`}<div class="pc-m-t"><b>${E(n ? n.song : c.title)}</b><span>${n && n.artist ? `<a class="ar-link" href="#view-artist" data-artist="${E(n.artist)}">${E(n.artist)}</a> · ` : ''}${E(n ? c.title : c.podcastTitle || '')}</span></div>`);
        put(R, `${play(a)}<span class="pc-m-time${!a.paused && !P.failed ? ' live' : ''}">${E(state)}</span>${extras()}${where()}<a class="pc-ib" href="#view-radio" aria-label="Open Radio" title="Open Radio">${api.ui.icon('radio')}</a>`);
        if (api.ui.currentRoute() === 'view-radio' && bar.dataset.cur !== c.uuid + ':' + a.paused) { bar.dataset.cur = c.uuid + ':' + a.paused; setTimeout(() => api.ui.refresh(), 0); }
      } else if (c.preview) {
        const d = isFinite(a.duration) && a.duration ? a.duration : 30, t = a.currentTime || 0; pct = t / d;
        put(L, `${art(c.art, 'music')}<div class="pc-m-t"><b>${E(c.title)}</b><span><a class="ar-link" href="#view-artist" data-artist="${E(c.podcastTitle)}">${E(c.podcastTitle)}</a> · ${c.full ? 'From your music' : '30-second preview'}</span></div>`);
        put(R, `${play(a)}${P.hasNextPreview && P.hasNextPreview() ? ib('nextpv', 'skip-forward', 'Next preview') : ''}<span class="pc-m-time">${fmt(t)} / ${fmt(d)}</span>${extras()}${where()}${c.link ? `<a class="pc-ib" href="${E(c.link)}" target="_blank" rel="noopener" aria-label="Full song on Deezer" title="Full song on Deezer">${api.ui.icon('external-link')}</a>` : ''}`);
      } else {
        const d = isFinite(a.duration) && a.duration ? a.duration : c.duration || 0, t = a.currentTime || c.position || 0; pct = d ? t / d : 0;
        if (api.ui.currentRoute() === 'view-podcasts' && bar.dataset.cur !== c.uuid + ':' + a.paused) { bar.dataset.cur = c.uuid + ':' + a.paused; setTimeout(() => api.ui.refresh(), 0); }
        put(L, `${art(c.art, 'podcast')}<div class="pc-m-t"><b>${E(c.title)}</b><span>${E(c.podcastTitle)}</span></div>`);
        put(R, `${ib('back', 'rotate-ccw', `Back ${SK().b} seconds`)}${play(a)}${ib('fwd', 'rotate-cw', `Forward ${SK().f} seconds`)}<span class="pc-m-time">${fmt(t)} / ${fmt(d)}</span>${extras()}${where()}<a class="pc-ib" href="#view-podcasts" aria-label="Open Podcasts" title="Open Podcasts">${api.ui.icon('podcast')}</a>`);
      }
      line.style.width = (Math.max(0, Math.min(1, pct)) * 100).toFixed(2) + '%';
      bar.classList.toggle('pc-live', !!c.live);
      const vb = bar.querySelector('.pc-m-viz'); vb.classList.toggle('on', !!(window.CadenceViz && window.CadenceViz.isOpen));
    };
    bar.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-pc][tabindex]')) { e.preventDefault(); e.target.click(); } };
    bar.onclick = e => {
      const seek = e.target.closest('[data-pc-seek]');
      if (seek) { const c = P.current, a = P.audio; if (c && !c.live && isFinite(a.duration) && a.duration) { const r = seek.getBoundingClientRect(); a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * a.duration; } return; }
      if (place() === 'tuck' && e.target.closest('.pc-m-l')) { lsSet('place', lsGet('placeWas', 'float')); build(); draw(); return; }   // tap the cover to bring it back
      const b = e.target.closest('[data-pc]'); if (!b) return;
      const go = pl => { if (pl === 'tuck') lsSet('placeWas', place()); lsSet('place', pl); build(); draw(); };
      if (b.dataset.pc === 'fwd' && P.current && P.current.preview) return P.onPreviewEnded && P.onPreviewEnded(P.current);
      ({ back: () => P.skip(-SK().b), fwd: () => P.skip(SK().f), toggle: () => P.toggle(),
        play: () => P.play(), pause: () => P.pause(), stop: () => { P.pause(); if (P.current && !P.current.live) P.audio.currentTime = 0; },
        skin: () => { lsSet('skin', 'calm'); build(); draw(); },
        'place-side': () => go('side'), 'place-float': () => go('float'), tuck: () => go('tuck'), unfold: () => go(lsGet('placeWas', 'float')),
        pl: () => { if (!W) return; W.plbox.hidden = !W.plbox.hidden; lsSet('waPl', !W.plbox.hidden); W.list.dataset.k = ''; draw(); }, nextpv: () => P.onPreviewEnded && P.onPreviewEnded(P.current),
        level: () => { P.setLevel(!P.level); api.ui.toast(P.level ? 'Even volume on: quiet and loud stations land closer together' : 'Even volume off'); }, cast: () => P.cast(), viz: () => { window.CadenceViz && window.CadenceViz.toggle(); draw(); } })[b.dataset.pc]();
    };
    // redraw at most ~4 times a second
    let q = 0; const off = P.on(() => { if (q) return; q = setTimeout(() => { q = 0; draw(); }, 250); }); draw();
    return () => { off(); };
  }

  // Podcasts and Radio share the one bar: whichever is on mounts it, and it goes away when neither is
  let miniRefs = 0, miniOff = null;
  P.useMini = api => { if (miniRefs++ === 0) miniOff = mini(api);
    return () => { if (--miniRefs > 0) return; if (miniOff) miniOff(); miniOff = null; const b = document.getElementById('pc-mini'); if (b) b.hidden = true; }; };

  Cadence.registerPlugin({
    settings(api) { const k = SK(); window.LifeKit.form(api, 'Podcasts', [{ k: 'skin', label: 'Player look', type: 'select', opts: [['calm', 'Calm (matches your theme)'], ['classic', 'Classic (Winamp-inspired)']] }, { k: 'b', label: 'Back button skips', type: 'select', opts: [5, 10, 15, 30].map(x => [String(x), x + ' seconds']) }, { k: 'f', label: 'Forward button skips', type: 'select', opts: [10, 15, 30, 45, 60].map(x => [String(x), x + ' seconds']) }],
      { skin: skin(), b: String(k.b), f: String(k.f) }, o => { lsSet('skin', o.skin); lsSet('skipBack', +o.b); lsSet('skipFwd', +o.f); P.emit && P.emit(); api.ui.refresh(); }); },
    id: 'podcasts', site: 'pocketcasts.com', name: 'Podcasts', version: '1.0.0', category: 'Media', color: '#f43e37',
    icon: '<path d="M16.85 18.58a9 9 0 1 0-9.7 0"/><path d="M8 14a5 5 0 1 1 8 0"/><circle cx="12" cy="11" r="1"/><path d="M13 17a1 1 0 1 0-2 0l.5 4.5a.5.5 0 1 0 1 0Z"/>',
    tagline: 'Your Pocket Casts shows, Up next and your place, with a player that keeps going everywhere.',
    description: 'Syncs with Pocket Casts from the NAS (add POCKETCASTS_EMAIL and POCKETCASTS_PASSWORD to the NAS .env). Resume where your phone left off; pausing here sends your place back. Works in Work and Life, and keeps playing when you switch space, view or tab.',
    setup(api) {
      P.toast = m => api.ui.toast(m);
      const offMini = P.useMini(api);
      api.on('meeting:start', () => { if (!P.audio.paused) { const live = P.current && P.current.live; P.pause(); api.ui.toast((live ? 'Radio' : 'Podcast') + ' paused for your meeting'); } });
      let data = null, loading = false, notified = lsGet('seenNew', 0);
      const load = async fresh => { if (loading) return; loading = true; try { data = await (await fetch('api/podcasts' + (fresh ? '?fresh=1' : ''))).json(); } catch { data = { error: 'Pocket Casts sync paused: the NAS didn’t answer' }; } loading = false;
        // one calm note a day for new episodes, never a badge count
        const newest = Math.max(0, ...((data && data.newEpisodes) || []).map(e => Date.parse(e.published) || 0));
        if (newest > notified && notified && api.island && api.island.notify) { const n = data.newEpisodes.filter(e => Date.parse(e.published) > notified).length; if (n) api.island.notify({ title: `${n} new episode${n === 1 ? '' : 's'} from your shows`, icon: '🎧', route: 'view-podcasts', quiet: true }); }
        if (newest) { notified = newest; lsSet('seenNew', newest); }
        if (api.ui.currentRoute() === 'view-podcasts') api.ui.refresh(); };
      load();
      const tick = setInterval(() => load(), 10 * 60e3);
      api.on('refocus', () => load());

      const epRow = (e, acts) => `<div class="pc-ep" data-uuid="${E(e.uuid)}">${e.art ? `<img src="${E(e.art)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : ''}
        <div class="pc-ep-t"><b>${E(e.title)}</b><span>${E(e.podcastTitle)}${e.duration ? ' · ' + (e.position ? fmt(left(e)) + ' left' : fmt(e.duration)) : ''}</span></div>
        <div class="pc-ep-a">${acts.map(([k, ic, l]) => `<button class="btn sm" data-act-pc="${k}" title="${E(l)}">${api.ui.icon(ic)}<span>${E(l)}</span></button>`).join('')}</div></div>`;
      api.views.add({ id: 'podcasts', site: 'pocketcasts.com', title: 'Podcasts', icon: '🎧', subtitle: 'Pocket Casts, on your NAS', wide: true, render: el => {
        if (!data) { el.innerHTML = `<div class="pc"><p class="muted">Loading your shows…</p></div>`; return; }
        if (data.configured === false) {
          el.innerHTML = `<div class="pc"><div class="pc-card pc-setup"><h3>Connect Pocket Casts</h3>
            <p>Add these two lines to the <code>.env</code> file on the NAS, next to your other settings, then restart the container. They stay on the NAS; this browser never sees them.</p>
            <pre>POCKETCASTS_EMAIL=you@example.com\nPOCKETCASTS_PASSWORD=your-password</pre>
            <p class="muted">Pocket Casts has no official API, so this uses the one its web player uses. If they change it, sync pauses with a note here and the player keeps working.</p></div>
            ${window.CadenceKexpKeep ? window.CadenceKexpKeep.card() : ''}</div>`; return;
        }
        const c = P.current && !P.current.live && !P.current.preview ? P.current : null, a = P.audio, all = [...(data.inProgress || []), ...(data.upNext || []), ...(data.newEpisodes || [])], byId = Object.fromEntries(all.map(e => [e.uuid, e]));
        const rates = [1, 1.2, 1.3, 1.5, 1.8, 2];
        el.innerHTML = `<div class="pc">
          <div class="pc-main">
            ${data.error ? `<p class="pc-note">${api.ui.icon('refresh-cw')}${E(data.error)}</p>` : ''}
            <div class="pc-card pc-now">${c ? `${c.art ? `<img src="${E(c.art)}" alt="" onerror="this.style.visibility='hidden'">` : ''}<div class="pc-now-t">
                <span class="muted">${a.paused ? (c.position ? 'Paused · ' + fmt(left({ duration: a.duration || c.duration, position: a.currentTime || c.position })) + ' left' : 'Ready') : 'Playing'}</span>
                <b>${E(c.title)}</b><span class="muted">${E(c.podcastTitle)}</span>
                <input type="range" class="pc-seek" min="0" max="${Math.round(isFinite(a.duration) && a.duration ? a.duration : c.duration || 0)}" value="${Math.round(a.currentTime || c.position || 0)}" aria-label="Position">
                <div class="pc-ctl"><button class="pc-ib" data-act-pc="back" aria-label="Back ${SK().b} seconds">${api.ui.icon('rotate-ccw')}</button>
                  <button class="pc-ib pc-big" data-act-pc="toggle" aria-label="${a.paused ? 'Play' : 'Pause'}">${api.ui.icon(a.paused ? 'play' : 'pause')}</button>
                  <button class="pc-ib" data-act-pc="fwd" aria-label="Forward ${SK().f} seconds">${api.ui.icon('rotate-cw')}</button>
                  <select class="inp sm" id="pc-rate" aria-label="Speed">${rates.map(r => `<option value="${r}" ${Math.abs(a.playbackRate - r) < .01 ? 'selected' : ''}>${r}×</option>`).join('')}</select>
                  <select class="inp sm" id="pc-sleep" aria-label="Sleep timer"><option value="0">${P.sleepLeft ? 'Sleep: ' + P.sleepLeft + ' min' : 'No sleep timer'}</option>${[10, 20, 30, 45, 60].map(m => `<option value="${m}">Sleep in ${m} min</option>`).join('')}</select>
                  <button class="pc-ib" data-act-pc="star" aria-label="Star">${api.ui.icon('star')}</button>
                  <button class="pc-ib" data-act-pc="notes" aria-label="Show notes">${api.ui.icon('list-checks')}</button></div></div>`
              : `<p class="muted">Pick an episode below to start. Anything you were playing on your phone is under In progress.</p>`}</div>
            ${window.CadenceKexpKeep ? window.CadenceKexpKeep.card() : ''}
            ${(data.upNext || []).length ? `<div class="pc-card"><div class="pc-h"><b>Up next</b><span class="muted">${data.upNext.length} episode${data.upNext.length === 1 ? '' : 's'} · ${fmt(data.upNext.reduce((s, e) => s + left(e), 0))}</span></div>${data.upNext.map(e => epRow(e, [['play', 'play', 'Play']])).join('')}</div>` : ''}
            <div class="pc-card"><div class="pc-h"><b>New from your shows</b><span class="muted">${(data.newEpisodes || []).length}</span></div>
              ${(data.newEpisodes || []).slice(0, 20).map(e => epRow(e, [['play', 'play', 'Play'], ['queue', 'list-plus', 'Up next'], ['task', 'list-checks', 'Make a task']])).join('') || '<p class="muted">Nothing new.</p>'}</div>
          </div>
          <aside class="pc-side">
            <div class="pc-card"><b>In progress</b>${(data.inProgress || []).slice(0, 8).map(e => epRow(e, [['play', 'play', 'Resume']])).join('') || '<p class="muted">Nothing half-listened.</p>'}</div>
            <div class="pc-card"><b>Your shows</b><div class="pc-shows">${(data.shows || []).slice(0, 30).map(s => `<img src="${E(s.art)}" alt="${E(s.title)}" title="${E(s.title)}" loading="lazy" onerror="this.style.opacity=0">`).join('')}</div></div>
            <p class="pc-sync muted">${api.ui.icon('refresh-cw')}${data.syncedAt ? 'Synced with Pocket Casts ' + Math.max(0, Math.round((Date.now() - data.syncedAt) / 60000)) + ' min ago' : 'Not synced yet'} · <button class="lnk" data-act-pc="sync">Sync now</button></p>
          </aside></div>`;
        const run = { play: e => P.play(e), queue: e => { P.queue(e); api.ui.toast('Added to Up next here'); }, task: e => { api.tasks.add({ title: 'Listen: ' + e.title }); api.ui.toast('Task added'); },
          toggle: () => P.toggle(), back: () => P.skip(-SK().b), fwd: () => P.skip(SK().f), sync: () => load(true),
          star: async () => { const r = await post('api/podcasts/star', { uuid: c.uuid, podcast: c.podcast, starred: true }); api.ui.toast(r ? 'Starred in Pocket Casts' : 'Couldn’t reach Pocket Casts'); },
          notes: async () => { const r = await (await fetch('api/podcasts/notes/' + encodeURIComponent(c.uuid))).json().catch(() => ({})); const d = document.createElement('div'); d.innerHTML = r.notes || ''; d.querySelectorAll('script,style,iframe').forEach(x => x.remove());
            api.ui.modal(`<div class="modal-h">${E(c.title)}</div><div class="pc-notes">${E(d.textContent || 'No show notes.').replace(/\n{2,}/g, '<br><br>')}</div>`); } };
        el.querySelectorAll('[data-act-pc]').forEach(b => b.onclick = () => { const row = b.closest('[data-uuid]'); run[b.dataset.actPc](row ? byId[row.dataset.uuid] : null); });
        const seek = el.querySelector('.pc-seek'); if (seek) seek.oninput = () => { P.audio.currentTime = +seek.value; };
        const rate = el.querySelector('#pc-rate'); if (rate) rate.onchange = () => P.rate(+rate.value);
        const sl = el.querySelector('#pc-sleep'); if (sl) sl.onchange = () => { P.sleep(+sl.value); api.ui.toast(+sl.value ? `Stopping in ${sl.value} min` : 'Sleep timer off'); };
      } });
      // keep the open view's player card current without re-rendering the whole page
      const offView = P.on(() => { if (api.ui.currentRoute() !== 'view-podcasts') return; const s = document.querySelector('.pc-seek'); if (s && document.activeElement !== s) { s.max = Math.round(isFinite(P.audio.duration) ? P.audio.duration : (P.current && P.current.duration) || 0); s.value = Math.round(P.audio.currentTime || 0); }
        const tb = document.querySelector('.pc-now [data-act-pc="toggle"]'); if (tb && tb.dataset.st !== String(P.audio.paused)) { tb.dataset.st = String(P.audio.paused); tb.innerHTML = api.ui.icon(P.audio.paused ? 'play' : 'pause'); } });
      return () => { clearInterval(tick); offMini(); offView(); };
    },
  });

  const css = document.createElement('style'); css.id = 'pc-css';
  css.textContent = `#pc-mini{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:40;display:flex;align-items:center;gap:10px;width:min(640px,calc(100vw - 24px));min-height:60px;padding:8px 10px 10px;
      border-radius:var(--r-l,12px);background:color-mix(in srgb,var(--panel) 94%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);color:var(--text);border:1px solid var(--line);box-shadow:var(--shadow);overflow:hidden}
    #pc-mini[hidden]{display:none}
    .pc-m-l{flex:1;min-width:0;display:flex;align-items:center;gap:10px}
    #pc-mini img,#pc-mini .pc-noart{width:42px;height:42px;border-radius:var(--r-m,8px);flex:none;object-fit:cover;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent)}
    #pc-mini .pc-noart svg{width:18px;height:18px}
    .pc-lg{position:relative;width:42px;height:42px;flex:none} .pc-lg .cx-logo{position:absolute;inset:0;width:100%;height:100%;margin:0;object-fit:contain;background:#fff;border-radius:var(--r-m,8px);padding:3px}
    .pc-m-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px} .pc-m-t b,.pc-m-t span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis} .pc-m-t b{font-size:13px;font-weight:600} .pc-m-t span{font-size:12px;color:var(--muted)}
    .pc-m-t .ar-link{color:inherit}
    .pc-m-r{display:flex;align-items:center;gap:2px;flex:none} .pc-m-r [data-pc=level][data-on]{color:var(--accent)} #pc-mini .wa-lled{border:0;padding:0;font-family:inherit;cursor:pointer;background:transparent}
    .pc-m-time{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums;min-width:74px;text-align:center;white-space:nowrap}
    .pc-m-time.live::before{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--accent);margin-right:6px;vertical-align:1px;animation:pc-pulse 2s ease-in-out infinite}
    @keyframes pc-pulse{50%{opacity:.35}} @media (prefers-reduced-motion:reduce){.pc-m-time.live::before{animation:none}}
    .pc-m-viz{flex:none;width:44px;height:28px;padding:0;border:0;background:transparent;cursor:pointer;border-radius:var(--r-s,6px);opacity:.85} .pc-m-viz:hover,.pc-m-viz.on{opacity:1;background:var(--hover)}
    .pc-m-viz canvas{width:100%;height:100%;display:block}
    .pc-m-line{position:absolute;left:0;right:0;bottom:0;height:5px;display:block;cursor:pointer} .pc-m-line::before{content:'';position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--line)}
    .pc-m-line>i{position:absolute;left:0;bottom:0;height:2px;background:var(--accent);display:block;transition:width .25s linear} #pc-mini.pc-live .pc-m-line{display:none}
    .pc-ib{display:inline-grid;place-items:center;width:34px;height:34px;border-radius:50%;border:0;background:transparent;color:var(--text);cursor:pointer;flex:none} .pc-ib:hover{background:var(--hover)} .pc-ib svg{width:17px;height:17px}
    .pc-ib.pc-play{width:38px;height:38px;border:1px solid var(--line);background:var(--panel)} .pc-ib.pc-play:hover{border-color:var(--accent);color:var(--accent);background:var(--panel)} .pc-ib.pc-play.on{background:var(--accent-soft);border-color:transparent;color:var(--accent)}
    .pc-ib.pc-big{width:40px;height:40px;background:var(--accent);color:var(--on-accent)} .pc-ib.pc-big svg{width:20px;height:20px}
    @media (max-width:560px){.pc-m-viz,.pc-m-time{display:none}}
    /* Classic (Winamp-inspired), after the user's own recreation: a CSS recreation, no images, fonts kept on the NAS */
    @font-face{font-family:'Cadence Aldrich';src:url(vendor/themes/fonts/aldrich-latin-400-normal.woff2) format('woff2');font-display:swap}
    @font-face{font-family:'Cadence Share Tech Mono';src:url(vendor/themes/fonts/share-tech-mono-latin-400-normal.woff2) format('woff2');font-display:swap}
    @font-face{font-family:'Cadence VT323';src:url(vendor/themes/fonts/vt323-latin-400-normal.woff2) format('woff2');font-display:swap}
    #pc-mini.pc-wa{display:block;width:min(480px,calc(100vw - 24px));min-height:0;padding:0;gap:0;border:0;border-radius:0;background:none;box-shadow:0 12px 30px rgba(0,0,0,.45);overflow:visible;
      color:#c9cbe0;font:13px/1.2 'Cadence Share Tech Mono',ui-monospace,Consolas,monospace;-webkit-backdrop-filter:none;backdrop-filter:none}
    .pc-wa .wa-box{position:relative;background:linear-gradient(90deg,#11101a,#373857 35%,#373857 65%,#11101a);border:1px solid #000;display:flex;flex-direction:column;align-items:stretch}
    .pc-wa .wa-box::after{content:'';position:absolute;inset:2px;border:2px outset #555265;pointer-events:none}
    .pc-wa .wa-tt{display:flex;align-items:center;justify-content:center;gap:8px;padding:5px 10px 4px}
    .pc-wa .wa-ln{flex:1;height:9px;border:1px solid #000;border-radius:3px;background:linear-gradient(#87785a,#635a42 35%,#202024 50%,#635a42 65%,#87785a)}
    .pc-wa .wa-tt b{font:18px/1 'Cadence VT323',monospace;letter-spacing:.4em;color:#8a8ba0;text-transform:uppercase;padding-left:.4em}
    .pc-wa .wa-tt-s{cursor:pointer} .pc-wa .wa-tt-s b{font-size:13px;letter-spacing:.25em} .pc-wa .wa-tt-s .wa-ln{height:6px}
    .pc-wa .wa-x{position:relative;z-index:1;display:grid;place-items:center;width:15px;height:13px;padding:0;background:#adbac7;border:2px outset #adbac7;color:#202033;cursor:pointer} .pc-wa .wa-x svg{width:8px;height:8px}
    .pc-wa .wa-cmd{margin:0 8px 8px;padding:8px 9px 9px;border:2px solid #555265;position:relative;z-index:1}
    .pc-wa .wa-row{display:flex;gap:8px}
    .pc-wa .wa-left{width:36%;display:flex;flex-direction:column;gap:4px} .pc-wa .wa-right{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:space-between;gap:5px}
    .pc-wa .wa-time,.pc-wa .wa-mq,.pc-wa .wa-f,.pc-wa .wa-vis,.pc-wa .wa-list{background:#000;border:2px inset #555265}
    .pc-wa .wa-time{display:flex;align-items:center;gap:4px;padding:2px 6px;color:lime;font:34px/1.05 'Cadence Aldrich',sans-serif;font-variant-numeric:tabular-nums}
    .pc-wa .wa-t{flex:1;text-align:right;text-shadow:0 0 6px rgba(0,255,0,.35)}
    .pc-wa .wa-st{color:#1f4a1f;display:grid;place-items:center} .pc-wa .wa-st.on{color:lime} .pc-wa .wa-st svg{width:11px;height:11px}
    .pc-wa .wa-vis{height:22px;padding:0;cursor:pointer;display:block} .pc-wa .wa-vis canvas{width:100%;height:100%;display:block}
    .pc-wa .wa-mq{height:26px;overflow:hidden;white-space:nowrap;color:lime;font-size:17px;line-height:22px;padding:0 5px}
    .pc-wa .wa-mq span{display:inline-block} .pc-wa .wa-mq.run span{padding-left:100%;animation:wa-mq 16s linear infinite}
    @keyframes wa-mq{to{transform:translateX(-100%)}}
    @media (prefers-reduced-motion:reduce){.pc-wa .wa-mq.run span{animation:none;padding-left:0}}
    .pc-wa .wa-meta{display:flex;align-items:center;gap:6px}
    .pc-wa .wa-f{color:lime;font-size:12px;line-height:15px;padding:0 6px;min-width:38px;text-align:center}
    .pc-wa .wa-led{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#4a4c66} .pc-wa .wa-led.lit{color:lime}
    .pc-wa input[type=range]{-webkit-appearance:none;appearance:none;margin:0;padding:0;outline:none;cursor:pointer;background:transparent}
    .pc-wa input[type=range]::-webkit-slider-thumb{-webkit-appearance:none}
    .pc-wa .wa-vol{width:100%;height:12px;border-radius:25px;border:2px inset #555265;background:linear-gradient(90deg,#1c5c1c,#46a01e var(--v,100%),#2b2c3e var(--v,100%))}
    .pc-wa .wa-vol::-webkit-slider-thumb{width:24px;height:16px;background:#adbac7;border:2px outset #adbac7;box-shadow:0 0 0 1px #202033}
    .pc-wa .wa-vol::-moz-range-thumb{width:20px;height:12px;border-radius:0;background:#adbac7;border:2px outset #adbac7}
    .pc-wa .wa-seek{display:block;width:100%;height:18px;margin:9px 0;border:2px inset #555265;overflow:hidden}
    .pc-wa .wa-seek::-webkit-slider-thumb{width:44px;height:18px;background:#b39d66;border:4px outset #ddcba2;box-shadow:-600px 0 0 600px #f9ebbc}
    .pc-wa .wa-seek::-moz-range-thumb{width:36px;height:12px;border-radius:0;background:#b39d66;border:4px outset #ddcba2}
    .pc-wa .wa-seek::-moz-range-progress{background:#f9ebbc;height:100%}
    .pc-wa .wa-seek:disabled{opacity:.45;cursor:default}
    .pc-wa .wa-btns{display:flex;align-items:center;gap:8px} .pc-wa .wa-b1{display:flex}
    .pc-wa .wa-btns button,.pc-wa .wa-open{position:relative;display:grid;place-items:center;width:38px;height:26px;padding:0;background:#adbac7;border:4px outset #adbac7;outline:1px solid #202033;color:#202033;cursor:pointer;font:inherit}
    .pc-wa .wa-btns svg{width:13px;height:13px;stroke-width:2.6}
    .pc-wa .wa-btns button.lit,.pc-wa .wa-btns button:active,.pc-wa .wa-open:active{color:#0a0;border-style:inset} .pc-wa .wa-btns button.lit svg{color:lime;filter:drop-shadow(0 0 1px #050)}
    .pc-wa .wa-btns button:disabled{opacity:.5;cursor:default}
    .pc-wa .wa-wide{width:auto!important;padding:0 10px!important;font-size:13px!important;font-weight:700;text-transform:uppercase;letter-spacing:.04em} .pc-wa .wa-wide.lit{color:#060!important} .pc-wa .wa-cast[hidden]{display:none!important}
    .pc-wa .wa-open{margin-left:auto}
    .pc-wa .wa-plbox{border-top:0} .pc-wa .wa-plbox[hidden]{display:none}
    .pc-wa .wa-list{margin:0 8px 8px;padding:6px 8px;color:lime;max-height:150px;overflow:auto;position:relative;z-index:1;font-size:13px;line-height:1.35}
    .pc-wa .wa-tr{display:flex;justify-content:space-between;gap:10px;cursor:default} .pc-wa .wa-tr[data-q]{cursor:pointer} .pc-wa .wa-tr span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .pc-wa .wa-tr.on{color:#f5f5f5} .pc-wa .wa-tr[data-q]:hover{background:#0b2a0b} .pc-wa .wa-empty{color:#4fae4f}
    .pc-wa button:focus-visible,.pc-wa a:focus-visible,.pc-wa input:focus-visible,.pc-wa [tabindex]:focus-visible{outline:1px dotted lime;outline-offset:1px}
    @media (min-width:900px){#pc-mini{left:calc(50% + 138px)}}
    /* in the sidebar: part of it, under everything else there */
    #side > #pc-mini{position:relative;left:auto;bottom:auto;transform:none;width:auto;flex:none;flex-wrap:wrap;gap:6px 8px;min-height:0;margin:10px -2px 2px;padding:8px;box-shadow:none;z-index:auto}
    #side > #pc-mini .pc-m-l{flex:1 1 100%}#side > #pc-mini .pc-m-r{flex:1 1 100%;justify-content:space-between;flex-wrap:wrap}#side > #pc-mini .pc-m-viz{display:none}
    #side > #pc-mini img,#side > #pc-mini .pc-noart{width:36px;height:36px}#side > #pc-mini .pc-m-time{font-size:11px}
    /* tucked away: a small round button with the cover and play; tap the cover to bring the bar back */
    #pc-mini.pc-tuck{left:auto;right:16px;transform:none;width:auto;min-height:0;padding:5px;gap:4px;border-radius:999px}
    #pc-mini.pc-tuck .pc-m-t,#pc-mini.pc-tuck .pc-m-viz,#pc-mini.pc-tuck .pc-m-line,#pc-mini.pc-tuck .pc-m-r > :not(.pc-play):not([data-pc=unfold]),#pc-mini.pc-tuck .pc-lg > :not(:first-child){display:none}
    #pc-mini.pc-tuck .pc-m-l{flex:none;cursor:pointer}#pc-mini.pc-tuck img,#pc-mini.pc-tuck .pc-noart{width:38px;height:38px;border-radius:50%}
    /* out of the way while a window (a recipe, settings) is open; the sidebar one stays, under the shade */
    html:has(#scrim.open) > #pc-mini,html:has(#meeting.open) > #pc-mini{visibility:hidden}
    .pc{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;padding-bottom:80px} @media (max-width:900px){.pc{grid-template-columns:1fr}}
    .pc-main,.pc-side{display:flex;flex-direction:column;gap:14px;min-width:0}
    .pc-card{background:var(--panel);border:1px solid var(--line);border-radius:var(--r,10px);padding:12px 14px}
    .pc-h{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}
    .pc-now{display:flex;gap:14px;align-items:flex-start} .pc-now>img{width:96px;height:96px;border-radius:var(--r-l);object-fit:cover;flex:none}
    .pc-now-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px} .pc-now-t b{font-size:16px}
    .pc-seek{width:100%;margin:8px 0 4px;accent-color:var(--accent)} .pc-ctl{display:flex;flex-wrap:wrap;align-items:center;gap:6px} .pc-ctl select{width:auto}
    .pc-ep{display:flex;align-items:center;gap:10px;padding:7px 0;border-top:1px solid var(--line)} .pc-ep:first-of-type{border-top:0}
    .pc-ep img{width:38px;height:38px;border-radius:var(--r-m);object-fit:cover;flex:none} .pc-ep-t{flex:1;min-width:0;display:flex;flex-direction:column} .pc-ep-t b{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} .pc-ep-t span{font-size:12px;color:var(--muted)}
    .pc-ep-a{display:flex;gap:4px;flex:none} .pc-ep-a .btn svg{width:14px;height:14px} @media (max-width:700px){.pc-ep-a .btn span{display:none}}
    .pc-shows{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px} .pc-shows img{width:100%;aspect-ratio:1;border-radius:var(--r-m);object-fit:cover;background:var(--accent-soft)}
    .pc-note,.pc-sync{display:flex;align-items:center;gap:6px;font-size:12px} .pc-note svg,.pc-sync svg{width:14px;height:14px;flex:none}
    .pc-setup pre{background:var(--hover);padding:10px;border-radius:var(--r-m);overflow:auto} .pc-notes{max-height:60vh;overflow:auto;line-height:1.55;white-space:normal}`;
  document.head.appendChild(css);
})();
