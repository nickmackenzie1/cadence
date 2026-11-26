/* Music, in its own app (2026-11-25, the split): Music Radar, Downloads, Radio, KEXP, artist pages and Podcasts moved to
   CRATE DIGGER, on the same NAS at port 8545 (https) or 8585 (http). THING keeps this: a Music page in the sidebar that
   opens CRATE DIGGER, a command for it, and what CRATE DIGGER is playing on THING's Island. It asks CRATE DIGGER
   (api/now) with your CRATE DIGGER sign-in, every 20 seconds while THING is open in front of you; if you're not signed in
   there, or the page is on plain http, it just doesn't show anything. */
(() => {
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const url = () => location.protocol === 'https:' ? `https://${location.hostname}:8545/` : `http://${location.hostname}:8585/`;
  const open = () => window.open(url(), 'cratedigger');
  let now = null, timer = 0;
  async function check(api) {
    clearTimeout(timer);
    if (document.visibilityState === 'visible' && api.system().mode === 'nas') {
      try { const r = await fetch(url() + 'api/now', { credentials: 'include', cache: 'no-store' }); now = r.ok ? await r.json() : null; } catch { now = null; }
      const I = window.CadenceIsland;
      if (I) {
        if (now && now.playing && (now.title || now.artist)) I.live('crate-now', { prio: 3, view: () => ({ html: `<span class="isl-ic">${api.ui.icon('audio-lines')}</span><span class="isl-t"><b>${E(now.title)}</b>${now.artist ? ` <span class="muted">${E(now.artist)}</span>` : ''}</span>`, minW: 190, onClick: open }) });
        else I.clear('crate-now');
      }
    }
    timer = setTimeout(() => check(api), 20000);
  }
  Cadence.registerPlugin({
    id: 'music-link', name: 'Music (CRATE DIGGER)', version: '1.0.0', category: 'Media', spaces: ['work', 'life'],
    description: 'Music lives in its own app now, CRATE DIGGER. This puts it in the sidebar and shows what it is playing on the Island.',
    setup(api) {
      api.views.add({ id: 'music', group: 'music', title: 'Music', icon: '💿', subtitle: 'Music Radar, Downloads, Radio, KEXP and Podcasts, in CRATE DIGGER', render: el => {
        el.innerHTML = `<div class="ml">
          ${now && now.playing ? `<p class="ml-now">${api.ui.icon('audio-lines')} Playing in CRATE DIGGER: <b>${E(now.title)}</b>${now.artist ? ` · ${E(now.artist)}` : ''}</p>` : ''}
          <p>Music has its own app now: <b>CRATE DIGGER</b>, on your NAS next to THING. Your Radar, Want to hear, KEXP history, downloads and podcasts are there.</p>
          <p><a class="btn pri" href="${E(url())}" target="cratedigger" rel="noopener">${api.ui.icon('external-link')} Open CRATE DIGGER</a></p>
          <p class="muted">On a phone, open it once and add it to your Home Screen (Share → Add to Home Screen) for its own icon.</p></div>
          <style>.ml{max-width:560px}.ml p{margin:0 0 14px}.ml-now{display:flex;gap:8px;align-items:center;padding:10px 12px;border-radius:var(--r-m);background:var(--accent-soft)}</style>`;
      } });
      api.commands.add({ title: 'Open CRATE DIGGER (music)', icon: 'audio-lines', run: open });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(api); });
      setTimeout(() => check(api), 3000);
    }
  });
})();
