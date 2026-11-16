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
  window.CadenceArtist = { open(name) { if (!name) return; current = String(name); try { sessionStorage.setItem('cadence.artist', current); } catch (e) {} if (location.hash === '#view-artist') window.dispatchEvent(new Event('cadence-artist')); else location.hash = 'view-artist'; } };
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

      api.views.add({ id: 'artist', title: 'Artist', icon: '🎤', hidden: true, wide: true, render: el => {
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
              ${links.length ? `<div class="ap-links">${links.map(l => A(l.url, `${api.ui.icon(l.kind === 'website' ? 'globe' : 'external-link')}${E(LINK_NAMES[l.kind] || l.kind)}`, 'btn')).join('')}</div>` : ''}
              ${d.mbPending ? `<p class="muted ap-wait">Looking up releases and links…</p>` : ''}
              ${d.mainstream ? `<p class="muted">Hidden from Music Radar by your mainstream filter.</p>` : ''}</div></header>

          <div class="ap-grid">
          ${mb && mb.releases.length ? `<section class="ap-wide"><h3>Releases</h3><div class="ap-rel">${mb.releases.slice(0, 18).map(r => `<a class="ap-r" href="https://musicbrainz.org/release-group/${E(r.id)}" target="_blank" rel="noopener">
              <span class="ap-cover"><img src="${E(r.cover)}" alt="" loading="lazy" onerror="this.remove()">${api.ui.icon('disc-3')}</span><b>${E(r.title)}</b><span class="muted">${E([year(r.date), r.type].filter(Boolean).join(' · '))}</span></a>`).join('')}</div></section>` : ''}

          <section><h3>Where they're showing up</h3>
            ${other.length || d.picks.length ? `<ul class="ap-list">
              ${other.slice(0, 30).map(m => `<li><span class="ap-src">${E(m.feed || m.sourceName)}</span><div>${m.url ? A(m.url, E(m.title || d.name)) : E(m.title || d.name)}<span class="muted">${E(m.sourceName)}${m.tier === 'small' ? ' · small blog' : ''} · ${day(m.first)}${m.seen > 1 ? ` · seen ${m.seen} times` : ''}</span></div></li>`).join('')}
              ${d.picks.map(p => `<li><span class="ap-src">${E((p.subs || []).slice(0, 2).join(', ') || 'Communities')}</span><div>${p.link ? A(p.link, E(p.song || 'recommended')) : E(p.song || 'recommended')}<span class="muted">Lemmy & Mastodon · ${day(p.ts)}${p.thread ? ' · ' + A(p.thread, 'discussion') : ''}</span></div></li>`).join('')}
            </ul>` : '<p class="muted">No blog, chart or community has mentioned them yet.</p>'}</section>

          <section><h3>Charts</h3>
            ${charts.length ? `<ul class="ap-list">${charts.map(m => { const run = (m.run || []).map(x => x.rank); const first = run[0], lastR = run[run.length - 1];
              return `<li><span class="ap-src">${E(m.sourceName)}</span><div>${E(m.feed || '')}${m.title ? ' · ' + E(m.title) : ''}<span class="muted">now #${m.rank}${m.best && m.best !== m.rank ? `, best #${m.best}` : ''}${run.length > 1 ? ` · #${first} → #${lastR} over ${run.length} checks` : ''}</span>
                ${run.length > 1 ? spark(run) : ''}</div></li>`; }).join('')}</ul>` : '<p class="muted">Not on any chart Cadence follows.</p>'}</section>

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
        .ap-spark{color:var(--accent);margin-top:2px} .ap-src-note{font-size:12px;margin-top:20px} .ap a{color:inherit}
        [data-artist]{cursor:pointer} .ar-link{color:inherit;text-decoration:none;font:inherit;background:none;border:0;padding:0} .ar-link:hover{text-decoration:underline}
        @media (max-width:640px){.ap-head{flex-direction:column} .ap-list li{grid-template-columns:80px 1fr}}`;
      document.head.appendChild(css);
      return () => { window.removeEventListener('cadence-artist', onOpen); css.remove(); };
    },
  });
})();
