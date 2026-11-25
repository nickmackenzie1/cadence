/* Downloads (2026-11-24): get a song or a record from Music Radar into your music folder on the NAS, and play it in full.
   A Get button sits beside Play and Want to hear everywhere they appear (CadencePreview.buttons). The NAS looks on
   Soulseek, YouTube Music, YouTube, SoundCloud and Usenet (server/services/getmusic.js); files land in your music
   folder, where Navidrome, Plex or Jellyfin see them too. A song you have plays in full instead of a 30-second preview.
   The page shows the queue in plain words, which sources are set up, and where each file came from. */
(() => {
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  const key = (a, t) => norm(a) + '|' + norm(t);
  const G = { d: null, owned: new Map(), asked: new Set(), want: new Set(), t: 0, poll: 0, api: null };
  const LABEL = { waiting: 'Waiting its turn', looking: 'Looking', getting: 'Getting it', done: 'In your music', none: "Couldn't find it", failed: "Didn't work" };

  async function load() {
    try { G.d = await (await fetch('api/radar/get', { cache: 'no-store' })).json(); } catch { G.d = G.d || null; }
    for (const j of (G.d && G.d.jobs) || []) if (j.status === 'done' && j.kind === 'track' && j.files && j.files[0]) G.owned.set(key(j.artist, j.title), { p: j.files[0], q: j.quality });
    clearTimeout(G.poll);
    if (G.d && G.d.jobs.some(j => ['waiting', 'looking', 'getting'].includes(j.status))) G.poll = setTimeout(async () => { await load(); changed(); }, 4000);
    return G.d;
  }
  // redraw for new button states, but never while you're typing in the page (a redraw would wipe what you typed)
  const typing = () => { const a = document.activeElement; return !!(a && a.closest && a.closest('#view') && a.matches('input:not([type=checkbox]):not([type=radio]), textarea, [contenteditable]')); };
  const changed = () => { clearTimeout(G.t); G.t = setTimeout(() => { if (typing()) return changed(); G.api && G.api.ui.refresh(); }, 80); };
  const job = (a, t, kind) => ((G.d && G.d.jobs) || []).find(j => j.kind === kind && key(j.artist, kind === 'album' ? j.album : j.title) === key(a, t));
  // what's already in the music folder: asked for in small batches, for the buttons on screen
  let askT = 0;
  function ask(a, t) {
    const k = key(a, t); if (G.asked.has(k)) return; G.asked.add(k); G.want.add(JSON.stringify({ artist: a, title: t }));
    clearTimeout(askT); askT = setTimeout(async () => {
      const items = [...G.want].map(x => JSON.parse(x)); G.want.clear();
      try { const r = await (await fetch('api/radar/get/owned', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) })).json();
        let n = 0; for (const [k2, v] of Object.entries(r || {})) if (!G.owned.has(k2)) { G.owned.set(k2, v); n++; } if (n) changed(); } catch {}
    }, 250);
  }
  async function get(b) {
    const r = await fetch('api/radar/get', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(x => x.json()).catch(() => null);
    if (!r) { G.api.ui.toast("Couldn't reach the NAS just now. Try again in a moment."); return; }
    if (r.owned) { G.owned.set(key(b.artist, b.title), r.owned); G.api.ui.toast('Already in your music'); changed(); return; }
    if (r.error) { G.api.ui.toast(r.error); return; }
    G.api.ui.toast(r.already ? 'Already on its way' : `Getting ${b.kind === 'album' ? b.album : b.title}. It'll be in your music when it's done.`);
    await load(); changed();
  }
  async function act(id, a) { await fetch('api/radar/get/job', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, act: a }) }).catch(() => {}); await load(); changed(); }
  const fileUrl = p => 'api/radar/get/file?p=' + encodeURIComponent(p);

  window.CadenceGet = {
    // beside Play and Want to hear: a song, or a record (type album)
    button(artist, title, type) {
      if (!G.api || G.api.system().mode !== 'nas' || !artist || !title || type === 'artist') return '';
      const album = type === 'album', ic = n => G.api.ui.icon(n);
      if (!album) { const o = G.owned.get(key(artist, title)); if (o) return `<span class="pv-b on dl-have" title="In your music: Play plays the whole song" aria-label="In your music">${ic('circle-check')}</span>`; ask(artist, title); }
      const j = job(artist, title, album ? 'album' : 'track');
      if (j && j.status === 'done' && album) return `<span class="pv-b on dl-have" title="In your music" aria-label="In your music">${ic('circle-check')}</span>`;
      if (j && ['waiting', 'looking', 'getting'].includes(j.status)) return `<span class="pv-b dl-busy" title="${E(LABEL[j.status])}" aria-label="${E(LABEL[j.status])}">${ic('loader')}</span>`;
      return `<button class="pv-b" data-get data-a="${E(artist)}" data-t="${E(title)}" data-kind="${album ? 'album' : 'track'}" aria-label="Get ${E(title)} into your music" title="Get ${album ? 'the record' : 'the song'} into your music">${ic('download')}</button>`;
    },
    // Play: a song you have plays in full
    file(artist, title) { const o = G.owned.get(key(artist, title)); return o ? fileUrl(o.p) : null; },
    get, load,
  };

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-get]'); if (!b) return;
    e.preventDefault(); e.stopPropagation(); if (b.disabled) return; b.disabled = true;
    const kind = b.dataset.kind === 'album' ? 'album' : 'track';
    get(kind === 'album' ? { kind, artist: b.dataset.a, album: b.dataset.t } : { kind, artist: b.dataset.a, title: b.dataset.t }).finally(() => { b.disabled = false; });
  }, true);
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-dl]'); if (!b) return; e.preventDefault();
    const [a, id] = b.dataset.dl.split(':');
    if (a === 'play') { const j = ((G.d && G.d.jobs) || []).find(x => x.id === id), p = window.CadencePodcasts; if (j && p && j.files && j.files[0]) p.load({ uuid: 'own:' + j.files[0], preview: true, full: true, title: j.kind === 'album' ? j.album : j.title, podcastTitle: j.artist, url: fileUrl(j.files[0]) }, true); return; }
    act(id, a);
  });

  const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };

  Cadence.registerPlugin({
    id: 'downloads', name: 'Downloads', version: '1.0.0', category: 'Media', spaces: ['life'],
    tagline: 'Get songs and records from Music Radar into your music folder.',
    description: 'A Get button beside every Play in Music Radar. The NAS looks on Soulseek, YouTube Music, YouTube, SoundCloud and Usenet, saves the song in your music folder (where Navidrome, Plex or Jellyfin see it too), and Play then plays the whole song. Later it swaps in a better copy when one turns up.',
    setup(api) {
      G.api = api;
      if (api.system().mode === 'nas') load().then(d => { if (d && d.jobs && d.jobs.length) changed(); });   // nothing to show yet: no redraw
      api.views.add({ id: 'downloads', group: 'music', order: 42, title: 'Downloads', icon: '⬇️', subtitle: 'Songs and records, into your music folder', render: el => {
        if (api.system().mode !== 'nas') { el.innerHTML = '<p class="muted">Downloads run on your NAS. Open THING from the NAS to use them.</p>'; return; }
        if (!G.d) { el.innerHTML = api.ui.skeleton(3, 'Loading downloads'); load().then(changed); return; }
        const D = G.d, S = D.sources, ic = n => api.ui.icon(n);
        const src = (on, name, what) => `<li class="${on ? 'on' : ''}">${ic(on ? 'circle-check' : 'circle')}<b>${name}</b> <span class="muted">${what}</span></li>`;
        const row = j => {
          const busy = ['waiting', 'looking', 'getting'].includes(j.status), what = j.kind === 'album' ? `${E(j.album)} <span class="muted">(record)</span>` : E(j.title);
          const where = j.status === 'done' ? [j.source, j.qualityLabel, j.files && j.files.length > 1 ? `${j.files.length} files` : ''].filter(Boolean).join(' · ') : '';
          return `<li class="dl-r ${E(j.status)}"><span class="dl-i">${ic(busy ? 'loader' : j.status === 'done' ? 'circle-check' : j.status === 'waiting' ? 'clock' : 'circle')}</span>
            <div class="dl-m"><b>${what}</b><span><a class="ar-link" href="#view-artist" data-artist="${E(j.artist)}">${E(j.artist)}</a> · ${E(LABEL[j.status] || j.status)}${j.note ? ' · ' + E(j.note) : ''}${where ? ' · ' + E(where) : ''}${j.from ? ' · ' + E(j.from) : ''} · ${ago(j.at || j.added)}</span>
            ${j.status === 'done' && j.files && j.files[0] ? `<code class="dl-f">${E(j.files[0])}${j.files.length > 1 ? ' …' : ''}</code>` : ''}</div>
            <span class="dl-a">${j.status === 'done' && j.files && j.files[0] ? `<button class="btn sm" data-dl="play:${E(j.id)}">${ic('play')} Play</button>` : ''}
            ${j.status === 'done' && j.kind === 'track' && (j.quality || 0) < 100 && S.slskd ? `<button class="btn sm" data-dl="better:${E(j.id)}" title="Look on Soulseek for a better copy">${ic('sparkles')} Better copy</button>` : ''}
            ${['failed', 'none'].includes(j.status) ? `<button class="btn sm" data-dl="retry:${E(j.id)}">${ic('refresh-cw')} Try again</button>` : ''}
            ${busy ? '' : `<button class="btn sm ghost" data-dl="remove:${E(j.id)}" title="Take it off this list (the file stays in your music)" aria-label="Take it off this list">${ic('x')}</button>`}</span></li>`;
        };
        el.innerHTML = `<div class="dl">
          <form class="dl-add" id="dl-add"><input class="inp" id="dl-ar" placeholder="Artist" autocomplete="off" data-no-grammar><input class="inp" id="dl-ti" placeholder="Song, or a record" autocomplete="off" data-no-grammar>
            <div class="seg" id="dl-k"><button type="button" class="on" data-k="track">Song</button><button type="button" data-k="album">Record</button></div><button class="btn pri" type="submit">${ic('download')} Get it</button></form>
          ${D.music && !D.music.ok ? `<p class="dl-note">${ic('info')} ${E(D.music.note)}</p>` : ''}
          ${D.jobs.length ? `<ul class="dl-l">${D.jobs.map(row).join('')}</ul>` : `<p class="muted">Nothing yet. Press ${ic('download')} beside a song in Music Radar, or type one above.</p>`}
          <details class="dl-set"><summary>Sources and settings</summary>
            <ul class="dl-src">${src(S.slskd, 'Soulseek', 'through your slskd: songs and records, often lossless. Looked at first.')}${src(S.ytdlp, 'YouTube Music, YouTube and SoundCloud', 'through yt-dlp, kept up to date on the NAS: songs.')}${src(S.usenet, 'Usenet', `a newznab indexer and ${S.usenetClient || 'SABnzbd or NZBGet'}: records.`)}</ul>
            <p class="muted">Addresses and keys go in Settings → Connections. The music folder is <code>${E((D.music && D.music.path) || '/music')}</code> inside THING: set MUSIC_PATH in .env on the NAS to your music share, and point Navidrome, Plex or Jellyfin at the same folder.</p>
            <label class="dl-tg"><input type="checkbox" id="dl-singles" ${D.settings && D.settings.newSingles ? 'checked' : ''}> Get new singles from artists you follow when they come out</label>
            <p class="muted">Songs from YouTube or SoundCloud are looked for again on Soulseek after a week, and swapped for a better copy when there is one.</p>
          </details></div>
          <style>.dl-add{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px}.dl-add .inp{flex:1 1 160px;min-width:0}.dl-l{list-style:none;padding:0;margin:0}
          .dl-r{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--line)}.dl-i{color:var(--muted);padding-top:2px}.dl-r.done .dl-i{color:var(--accent)}
          .dl-r.looking .dl-i svg,.dl-r.getting .dl-i svg{animation:dl-spin 1.6s linear infinite}@keyframes dl-spin{to{transform:rotate(360deg)}}
          .dl-m{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.dl-m>span{font-size:12.5px;color:var(--muted)}.dl-f{font-size:11.5px;color:var(--faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
          .dl-a{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.dl-note{padding:10px 12px;border-radius:var(--r-m);background:var(--accent-soft);display:flex;gap:8px;align-items:flex-start}
          .dl-src{list-style:none;padding:0;display:grid;gap:6px}.dl-src li{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.dl-src li.on svg{color:var(--accent)}.dl-set{margin-top:20px}.dl-tg{display:flex;gap:8px;align-items:center;margin:10px 0}
          @media (max-width:640px){.dl-r{flex-wrap:wrap}.dl-a{width:100%;justify-content:flex-start;padding-left:26px}}</style>`;
        let kind = 'track';
        el.querySelectorAll('#dl-k button').forEach(b => b.onclick = () => { kind = b.dataset.k; el.querySelectorAll('#dl-k button').forEach(x => x.classList.toggle('on', x === b)); el.querySelector('#dl-ti').placeholder = kind === 'album' ? 'Record' : 'Song'; });
        el.querySelector('#dl-add').onsubmit = e => { e.preventDefault(); const a = el.querySelector('#dl-ar').value.trim(), t = el.querySelector('#dl-ti').value.trim(); if (!a || !t) return;
          get(kind === 'album' ? { kind, artist: a, album: t, from: 'typed in' } : { kind, artist: a, title: t, from: 'typed in' }); };
        el.querySelector('#dl-singles').onchange = async e => { await fetch('api/radar/get/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newSingles: e.target.checked }) }).catch(() => {});
          api.ui.toast(e.target.checked ? "New singles from artists you follow will be fetched when they're out" : 'New singles stay in Out this week'); await load(); };
      } });
      api.commands.add({ title: 'Downloads: songs and records into your music', icon: 'download', run: () => { location.hash = 'view-downloads'; } });
    }
  });
})();
