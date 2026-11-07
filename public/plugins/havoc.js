/* Havoc — wreck the Cadence page itself with physics (same engine as the Havoc browser extension).
   Shift+H or the command palette. Esc restores everything. */
(() => {
  const load = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); });
  let loading = null;
  async function unleash(api) {
    if (window.__havoc) { window.__havoc.toggle(); return; }
    try {
      loading = loading || (async () => { if (!window.Matter) await load('vendor/matter.min.js'); await load('vendor/havoc-engine.js?v=' + Date.now().toString(36).slice(0, -3)); })();
      await loading;
    } catch (e) { loading = null; api.ui.toast('Havoc needs its engine files (vendor/) — ' + e.message); }
  }
  Cadence.registerPlugin({
    id: 'havoc', name: 'Havoc', version: '1.0.0', icon: '<path d="M12 2.5l2 5.5 5.5-1.5-3.8 4.5 4.8 3.5-5.8.8.8 5.7-3.5-3.8-3.5 3.8.8-5.7-5.8-.8 4.8-3.5L4.5 6.5 10 8z"/>', color: '#f76b15', category: 'Fun', tagline: 'Wreck the page with physics',
    description: 'Blow off steam: blast, melt, rain on or black-hole the Cadence page itself. Shift+H to unleash, Esc to restore.',
    setup(api) {
      api.commands.add({ title: '💥 Havoc — wreck this page', hint: '⇧H', run: api => unleash(api) });
      window.__havocKey && removeEventListener('keydown', window.__havocKey);
      window.__havocKey = e => {
        if (e.key !== 'H' || !e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
        if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
        e.preventDefault(); unleash(api);
      };
      addEventListener('keydown', window.__havocKey);
    }
  });
})();
