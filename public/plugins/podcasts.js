/* Podcasts: your Pocket Casts shows, Up next, new episodes and your place in each, with a player that belongs to the
   whole app (user, 2026-11-13: one plugin for Work and Life, and it keeps playing whatever you switch: space, view or
   browser tab). Sync runs on the NAS (server/services/pocketcasts.js); this file never sees your login.

   The player is a single <audio> owned by window.CadencePodcasts, created once when this file loads and kept on
   <html>, outside the page Cadence re-renders. A plugin rebuild or a space switch only redraws the controls around it.
   Your place is saved locally every few seconds and sent back to Pocket Casts every 30 s, on pause, and at the end. */
(() => {
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = s => { s = Math.max(0, Math.round(isFinite(s) ? s || 0 : 0)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
  const left = e => Math.max(0, (e.duration || 0) - (e.position || 0));
  const LS = 'cadence.pc.';
  const lsGet = (k, d) => { try { const v = localStorage.getItem(LS + k); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch {} };
  const post = (u, b) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.ok ? r.json() : null).catch(() => null);

  // ---- the one player ----
  const P = window.CadencePodcasts || (window.CadencePodcasts = (() => {
    const audio = document.createElement('audio'); audio.preload = 'metadata'; audio.id = 'pc-audio'; document.documentElement.appendChild(audio);
    const listeners = new Set(), emit = () => listeners.forEach(f => { try { f(); } catch (e) {} });
    let cur = lsGet('current', null), lastSent = 0, sleepAt = 0, sleepTimer = 0;
    const savePos = () => { if (!cur) return; cur.position = audio.currentTime || cur.position || 0; lsSet('current', cur); lsSet('pos.' + cur.uuid, cur.position); };
    const sendPos = played => { if (!cur || !cur.podcast) return; lastSent = Date.now(); post('api/podcasts/progress', { uuid: cur.uuid, podcast: cur.podcast, position: played ? cur.duration || audio.duration || 0 : audio.currentTime, played }); };
    audio.addEventListener('timeupdate', () => { savePos(); if (Date.now() - lastSent > 30000 && !audio.paused) sendPos(false); emit(); });
    audio.addEventListener('pause', () => { savePos(); sendPos(false); emit(); });
    audio.addEventListener('play', emit); audio.addEventListener('loadedmetadata', () => { if (cur && !cur.duration) cur.duration = audio.duration; emit(); });
    audio.addEventListener('ended', () => { sendPos(true); const q = lsGet('queue', []); const next = q.shift(); lsSet('queue', q); if (next) api.play(next); else emit(); });
    const media = () => { if (!('mediaSession' in navigator) || !cur) return;
      navigator.mediaSession.metadata = new MediaMetadata({ title: cur.title, artist: cur.podcastTitle, album: 'Podcasts', artwork: cur.art ? [{ src: cur.art, sizes: '200x200', type: 'image/webp' }] : [] });
      const h = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f); } catch (e) {} };
      h('play', () => audio.play()); h('pause', () => audio.pause()); h('seekbackward', () => api.skip(-10)); h('seekforward', () => api.skip(30));
      h('seekto', d => { audio.currentTime = d.seekTime; }); h('nexttrack', () => audio.dispatchEvent(new Event('ended'))); };
    const api = {
      audio, get current() { return cur; }, on: f => { listeners.add(f); return () => listeners.delete(f); },
      load(e, autoplay) {
        if (!e || !e.url) return; if (cur && cur.uuid !== e.uuid) { savePos(); sendPos(false); }
        // resume from whichever is further along: this device, or Pocket Casts (your phone)
        cur = { ...e, position: Math.max(+e.position || 0, +lsGet('pos.' + e.uuid, 0) || 0) }; lsSet('current', cur);
        audio.src = e.url; audio.playbackRate = lsGet('rate', 1);
        const seek = () => { if (cur.position && (!audio.duration || cur.position < audio.duration - 5)) audio.currentTime = cur.position; audio.removeEventListener('loadedmetadata', seek); };
        audio.addEventListener('loadedmetadata', seek); media();
        if (autoplay) audio.play().catch(() => {}); emit();
      },
      play(e) { if (e) this.load(e, true); else if (cur) { if (!audio.src) this.load(cur, true); else audio.play().catch(() => {}); } },
      pause() { audio.pause(); }, toggle() { audio.paused ? this.play() : this.pause(); },
      skip(d) { if (audio.src) audio.currentTime = Math.max(0, Math.min((audio.duration || 1e9) - 1, audio.currentTime + d)); },
      rate(r) { audio.playbackRate = r; lsSet('rate', r); emit(); },
      sleep(min) { clearTimeout(sleepTimer); sleepAt = min ? Date.now() + min * 60e3 : 0; if (min) sleepTimer = setTimeout(() => { audio.pause(); sleepAt = 0; emit(); }, min * 60e3); emit(); },
      get sleepLeft() { return sleepAt ? Math.max(0, Math.round((sleepAt - Date.now()) / 60e3)) : 0; },
      queue(e) { const q = lsGet('queue', []).filter(x => x.uuid !== e.uuid); q.push(e); lsSet('queue', q); emit(); }, get queued() { return lsGet('queue', []); },
    };
    // a reload doesn't start playing by itself, but the mini player is ready with your place
    if (cur && cur.url) { audio.src = cur.url; const s = () => { if (cur.position) audio.currentTime = cur.position; audio.removeEventListener('loadedmetadata', s); }; audio.addEventListener('loadedmetadata', s); setTimeout(media, 0); }
    addEventListener('pagehide', () => { savePos(); if (cur && !audio.paused) navigator.sendBeacon && navigator.sendBeacon('api/podcasts/progress', new Blob([JSON.stringify({ uuid: cur.uuid, podcast: cur.podcast, position: audio.currentTime })], { type: 'application/json' })); });
    return api;
  })());

  // ---- the mini player: one bar, kept on <html> like the audio, shown whenever something is loaded ----
  function mini(api) {
    let bar = document.getElementById('pc-mini');
    if (!bar) { bar = document.createElement('div'); bar.id = 'pc-mini'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Podcast player'); document.documentElement.appendChild(bar); }
    const draw = () => {
      const c = P.current; bar.hidden = !c; if (!c) return;
      if (api.ui.currentRoute() === 'view-podcasts' && bar.dataset.cur !== c.uuid + ':' + P.audio.paused) { bar.dataset.cur = c.uuid + ':' + P.audio.paused; setTimeout(() => api.ui.refresh(), 0); }
      const a = P.audio, d = isFinite(a.duration) && a.duration ? a.duration : c.duration || 0, t = a.currentTime || c.position || 0;
      bar.style.fontFamily = getComputedStyle(document.body).fontFamily;
      bar.innerHTML = `${c.art ? `<img src="${E(c.art)}" alt="" onerror="this.style.visibility='hidden'">` : `<i class="pc-noart">${api.ui.icon('podcast')}</i>`}
        <div class="pc-m-t"><b>${E(c.title)}</b><span>${E(c.podcastTitle)} · ${fmt(t)} / ${fmt(d)}</span><i class="pc-m-bar"><i style="width:${d ? (t / d * 100).toFixed(2) : 0}%"></i></i></div>
        <button class="pc-ib" data-pc="back" aria-label="Back 10 seconds" title="Back 10 s">${api.ui.icon('rotate-ccw')}</button>
        <button class="pc-ib pc-big" data-pc="toggle" aria-label="${a.paused ? 'Play' : 'Pause'}">${api.ui.icon(a.paused ? 'play' : 'pause')}</button>
        <button class="pc-ib" data-pc="fwd" aria-label="Forward 30 seconds" title="Forward 30 s">${api.ui.icon('rotate-cw')}</button>
        <a class="pc-ib" href="#view-podcasts" aria-label="Open Podcasts" title="Open Podcasts">${api.ui.icon('list-checks')}</a>`;
    };
    bar.onclick = e => { const b = e.target.closest('[data-pc]'); if (!b) return; ({ back: () => P.skip(-10), fwd: () => P.skip(30), toggle: () => P.toggle() })[b.dataset.pc](); };
    // redraw at most ~4 times a second
    let q = 0; const off = P.on(() => { if (q) return; q = setTimeout(() => { q = 0; draw(); }, 250); }); draw();
    return () => { off(); };
  }

  Cadence.registerPlugin({
    id: 'podcasts', name: 'Podcasts', version: '1.0.0', category: 'Media', color: '#f43e37',
    icon: '<path d="M16.85 18.58a9 9 0 1 0-9.7 0"/><path d="M8 14a5 5 0 1 1 8 0"/><circle cx="12" cy="11" r="1"/><path d="M13 17a1 1 0 1 0-2 0l.5 4.5a.5.5 0 1 0 1 0Z"/>',
    tagline: 'Your Pocket Casts shows, Up next and your place, with a player that keeps going everywhere.',
    description: 'Syncs with Pocket Casts from the NAS (add POCKETCASTS_EMAIL and POCKETCASTS_PASSWORD to the NAS .env). Resume where your phone left off; pausing here sends your place back. Works in Work and Life, and keeps playing when you switch space, view or tab.',
    setup(api) {
      const offMini = mini(api);
      api.on('meeting:start', () => { if (!P.audio.paused) { P.pause(); api.ui.toast('Podcast paused for your meeting'); } });
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
      api.views.add({ id: 'podcasts', title: 'Podcasts', icon: '🎧', subtitle: 'Pocket Casts, on your NAS', wide: true, render: el => {
        if (!data) { el.innerHTML = `<div class="pc"><p class="muted">Loading your shows…</p></div>`; return; }
        if (data.configured === false) {
          el.innerHTML = `<div class="pc"><div class="pc-card pc-setup"><h3>Connect Pocket Casts</h3>
            <p>Add these two lines to the <code>.env</code> file on the NAS, next to your other settings, then restart the container. They stay on the NAS; this browser never sees them.</p>
            <pre>POCKETCASTS_EMAIL=you@example.com\nPOCKETCASTS_PASSWORD=your-password</pre>
            <p class="muted">Pocket Casts has no official API, so this uses the one its web player uses. If they change it, sync pauses with a note here and the player keeps working.</p></div></div>`; return;
        }
        const c = P.current, a = P.audio, all = [...(data.inProgress || []), ...(data.upNext || []), ...(data.newEpisodes || [])], byId = Object.fromEntries(all.map(e => [e.uuid, e]));
        const rates = [1, 1.2, 1.3, 1.5, 1.8, 2];
        el.innerHTML = `<div class="pc">
          <div class="pc-main">
            ${data.error ? `<p class="pc-note">${api.ui.icon('refresh-cw')}${E(data.error)}</p>` : ''}
            <div class="pc-card pc-now">${c ? `${c.art ? `<img src="${E(c.art)}" alt="" onerror="this.style.visibility='hidden'">` : ''}<div class="pc-now-t">
                <span class="muted">${a.paused ? (c.position ? 'Paused · ' + fmt(left({ duration: a.duration || c.duration, position: a.currentTime || c.position })) + ' left' : 'Ready') : 'Playing'}</span>
                <b>${E(c.title)}</b><span class="muted">${E(c.podcastTitle)}</span>
                <input type="range" class="pc-seek" min="0" max="${Math.round(isFinite(a.duration) && a.duration ? a.duration : c.duration || 0)}" value="${Math.round(a.currentTime || c.position || 0)}" aria-label="Position">
                <div class="pc-ctl"><button class="pc-ib" data-act-pc="back" aria-label="Back 10 seconds">${api.ui.icon('rotate-ccw')}</button>
                  <button class="pc-ib pc-big" data-act-pc="toggle" aria-label="${a.paused ? 'Play' : 'Pause'}">${api.ui.icon(a.paused ? 'play' : 'pause')}</button>
                  <button class="pc-ib" data-act-pc="fwd" aria-label="Forward 30 seconds">${api.ui.icon('rotate-cw')}</button>
                  <select class="inp sm" id="pc-rate" aria-label="Speed">${rates.map(r => `<option value="${r}" ${Math.abs(a.playbackRate - r) < .01 ? 'selected' : ''}>${r}×</option>`).join('')}</select>
                  <select class="inp sm" id="pc-sleep" aria-label="Sleep timer"><option value="0">${P.sleepLeft ? 'Sleep: ' + P.sleepLeft + ' min' : 'No sleep timer'}</option>${[10, 20, 30, 45, 60].map(m => `<option value="${m}">Sleep in ${m} min</option>`).join('')}</select>
                  <button class="pc-ib" data-act-pc="star" aria-label="Star">${api.ui.icon('star')}</button>
                  <button class="pc-ib" data-act-pc="notes" aria-label="Show notes">${api.ui.icon('list-checks')}</button></div></div>`
              : `<p class="muted">Pick an episode below to start. Anything you were playing on your phone is under In progress.</p>`}</div>
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
          toggle: () => P.toggle(), back: () => P.skip(-10), fwd: () => P.skip(30), sync: () => load(true),
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
  css.textContent = `#pc-mini{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:40;display:flex;align-items:center;gap:8px;width:min(560px,calc(100vw - 24px));padding:6px 8px;border-radius:14px;background:var(--panel);color:var(--text);border:1px solid var(--line);box-shadow:0 8px 28px rgba(0,0,0,.18)}
    #pc-mini[hidden]{display:none} #pc-mini img,#pc-mini .pc-noart{width:40px;height:40px;border-radius:8px;flex:none;object-fit:cover;display:grid;place-items:center;background:var(--accent-soft)}
    .pc-m-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px} .pc-m-t b,.pc-m-t span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis} .pc-m-t b{font-size:13px} .pc-m-t span{font-size:11.5px;color:var(--muted)}
    .pc-m-bar{display:block;height:3px;border-radius:2px;background:var(--line);overflow:hidden} .pc-m-bar i{display:block;height:100%;background:var(--accent)}
    .pc-ib{display:inline-grid;place-items:center;width:34px;height:34px;border-radius:50%;border:0;background:transparent;color:var(--text);cursor:pointer;flex:none} .pc-ib:hover{background:var(--hover)} .pc-ib svg{width:18px;height:18px}
    .pc-ib.pc-big{width:40px;height:40px;background:var(--accent);color:var(--on-accent)} .pc-ib.pc-big svg{width:20px;height:20px}
    @media (min-width:900px){#pc-mini{left:calc(50% + 138px)}}
    .pc{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;padding-bottom:80px} @media (max-width:900px){.pc{grid-template-columns:1fr}}
    .pc-main,.pc-side{display:flex;flex-direction:column;gap:14px;min-width:0}
    .pc-card{background:var(--panel);border:1px solid var(--line);border-radius:var(--r,10px);padding:12px 14px}
    .pc-h{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}
    .pc-now{display:flex;gap:14px;align-items:flex-start} .pc-now>img{width:96px;height:96px;border-radius:12px;object-fit:cover;flex:none}
    .pc-now-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px} .pc-now-t b{font-size:16px}
    .pc-seek{width:100%;margin:8px 0 4px;accent-color:var(--accent)} .pc-ctl{display:flex;flex-wrap:wrap;align-items:center;gap:6px} .pc-ctl select{width:auto}
    .pc-ep{display:flex;align-items:center;gap:10px;padding:7px 0;border-top:1px solid var(--line)} .pc-ep:first-of-type{border-top:0}
    .pc-ep img{width:38px;height:38px;border-radius:8px;object-fit:cover;flex:none} .pc-ep-t{flex:1;min-width:0;display:flex;flex-direction:column} .pc-ep-t b{font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} .pc-ep-t span{font-size:12px;color:var(--muted)}
    .pc-ep-a{display:flex;gap:4px;flex:none} .pc-ep-a .btn svg{width:14px;height:14px} @media (max-width:700px){.pc-ep-a .btn span{display:none}}
    .pc-shows{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px} .pc-shows img{width:100%;aspect-ratio:1;border-radius:8px;object-fit:cover;background:var(--accent-soft)}
    .pc-note,.pc-sync{display:flex;align-items:center;gap:6px;font-size:12.5px} .pc-note svg,.pc-sync svg{width:14px;height:14px;flex:none}
    .pc-setup pre{background:var(--hover);padding:10px;border-radius:8px;overflow:auto} .pc-notes{max-height:60vh;overflow:auto;line-height:1.55;white-space:normal}`;
  document.head.appendChild(css);
})();
