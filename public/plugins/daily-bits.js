/* Daily (user picked 2026-11-16): Wikipedia's "On this day", today's xkcd, the Lichess daily puzzle and the top
   Hacker News stories. Each is a dashboard card; the Daily page shows all four. Fetched and cached by the NAS. */
(() => {
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const A = (u, t) => `<a href="${E(u)}" target="_blank" rel="noopener">${t}</a>`;

  Cadence.registerPlugin({
    id: 'daily-bits', name: 'Daily', version: '1.0.0', category: 'Info', color: '#8b5cf6',
    icon: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
    tagline: 'On this day, xkcd, a chess puzzle and Hacker News.',
    description: 'Small things for each day: what happened on this date (Wikipedia), the latest xkcd, the Lichess daily puzzle you can play right here, and the top Hacker News stories. Each one is a dashboard card. Fetched by your NAS, no accounts.',
    setup(api) {
      const G = {};
      const get = (k, url, ttl = 30 * 60e3) => {
        const c = G[k];
        if (c && (c.busy || Date.now() - c.at < ttl)) return c.v;
        G[k] = { v: c ? c.v : undefined, at: Date.now(), busy: true };
        fetch(url).then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
          .then(v => { G[k] = { v, at: Date.now() }; }, () => { G[k] = { v: (c && c.v) || null, at: Date.now() - ttl + 60e3 }; })
          .then(() => { api.ui.refreshWidgets && api.ui.refreshWidgets(); if (api.ui.currentRoute() === 'view-daily') api.ui.refresh(); });
        return G[k].v;
      };
      const wait = v => v === undefined ? '<p class="muted">Loading…</p>' : v === null ? '<p class="muted">Not available right now.</p>' : '';
      const nas = () => api.system().mode === 'nas';

      const otd = (n = 3) => { const v = get('otd', 'api/daily/onthisday', 3 * 3600e3); if (!v) return wait(v);
        return `<ul class="dy-otd">${v.slice(0, n).map(e => `<li><b>${e.year}</b><span>${E(e.text)}${e.url ? ' ' + A(e.url, 'Read more') : ''}</span></li>`).join('')}</ul>`; };
      const comic = () => { const v = get('xkcd', 'api/daily/xkcd', 3600e3); if (!v) return wait(v);
        return `<figure class="dy-x">${A(v.url, `<img src="${E(v.img)}" alt="${E(v.alt)}" title="${E(v.alt)}" loading="lazy">`)}<figcaption><b>${E(v.title)}</b> <span class="muted">#${v.num}</span></figcaption><details><summary>The hidden caption</summary><p>${E(v.alt)}</p></details></figure>`; };
      // Lichess's own embeddable daily-puzzle board: play it right here
      // the board itself is Lichess's own page, so it only loads when you choose to play
      const chess = (h = 300) => { const v = get('chess', 'api/daily/lichess', 3600e3);
        return `<div class="dy-c"><div class="dy-board" data-h="${h}"><button class="btn" data-play-chess>${api.ui.icon('crown')}Play today's puzzle here</button></div>
          ${v ? `<p class="muted">Rated ${v.rating}${v.themes.length ? ' · ' + E(v.themes.slice(0, 3).join(', ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()) : ''} · ${A(v.url, 'Open on Lichess')}</p>` : ''}</div>`; };
      const news = (n = 6) => { const v = get('hn', 'api/daily/hn', 15 * 60e3); if (!v) return wait(v);
        return `<ol class="dy-hn">${v.slice(0, n).map(s => `<li>${A(s.url, E(s.title))}<span class="muted">${s.score} points · ${A(s.discuss, s.comments + ' comments')}</span></li>`).join('')}</ol>`; };

      const wireChess = el => el.querySelectorAll('[data-play-chess]').forEach(b => b.onclick = () => {
        const box = b.closest('.dy-board'); box.innerHTML = `<iframe src="https://lichess.org/training/frame?theme=brown&bg=auto" title="Lichess daily puzzle" style="height:${box.dataset.h}px"></iframe>`; });
      const card = fn => el => { el.innerHTML = nas() ? fn() : '<p class="muted">Needs the NAS.</p>'; wireChess(el); };
      api.widgets.add({ id: 'on-this-day', title: 'On this day', icon: 'calendar', size: 'm', description: 'What happened on today\'s date (Wikipedia).', render: card(() => otd(3)) });
      api.widgets.add({ id: 'xkcd', title: 'xkcd', icon: 'smile', size: 'm', description: 'The latest xkcd comic.', render: card(comic) });
      api.widgets.add({ id: 'chess', title: 'Chess puzzle', icon: 'crown', size: 'm', description: 'The Lichess daily puzzle, playable here.', render: card(() => chess(260)) });
      api.widgets.add({ id: 'hn', title: 'Hacker News', icon: 'newspaper', size: 'm', description: 'Top stories on Hacker News.', render: card(() => news(6)) });

      api.views.add({ id: 'daily', title: 'Daily', icon: '🗓', subtitle: 'On this day, xkcd, a chess puzzle and Hacker News', wide: true, render: el => {
        if (!nas()) { el.innerHTML = '<p class="muted">Daily needs the NAS.</p>'; return; }
        el.innerHTML = `<div class="dy-grid"><section><h3>On this day</h3>${otd(8)}</section><section><h3>xkcd</h3>${comic()}</section>
          <section><h3>Chess puzzle</h3>${chess(380)}</section><section><h3>Hacker News</h3>${news(12)}</section></div>`;
        wireChess(el);
      } });

      const css = document.createElement('style');
      css.textContent = `.dy-otd{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;font-size:13px} .dy-otd li{display:grid;grid-template-columns:44px 1fr;gap:8px}
        .dy-x{margin:0} .dy-x img{max-width:100%;height:auto;display:block;margin:0 auto 6px;background:#fff;border-radius:4px} .dy-x figcaption{font-size:13px} .dy-x details{font-size:12px;color:var(--muted)}
        .dy-c iframe{width:100%;max-width:400px;border:0;border-radius:var(--r-s);display:block} .dy-board .btn{display:inline-flex;gap:6px;align-items:center} .dy-c p{font-size:12px;margin:6px 0 0}
        .dy-hn{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px;font-size:13px} .dy-hn li span{display:block;font-size:12px}
        .dy-hn a,.dy-otd a{color:inherit} .dy-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:18px;max-width:1200px} .dy-grid h3{margin:0 0 8px;font-size:15px}`;
      document.head.appendChild(css);
      return () => css.remove();
    },
  });
})();
