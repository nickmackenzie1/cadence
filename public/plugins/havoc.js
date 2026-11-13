/* Havoc — wreck the Cadence page itself. Two engines, switched from the toolbar:
     Physics  — vendor/havoc-engine.js (Matter.js): blast, melt, rain, black hole, zero-G, collapse
     Elements — vendor/elements-engine.js (falling sand): the page becomes matter you can burn, flood, freeze and bury
   Shift+H (or the command palette) opens the one you used last. Esc restores everything. */
(() => {
  const MODE_KEY = 'cadence.havoc';   // 'physics' | 'elements', follows you between devices
  const load = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); });
  const v = () => '?v=' + Date.now().toString(36).slice(0, -3);
  const mode = () => { try { return localStorage.getItem(MODE_KEY) === 'elements' ? 'elements' : 'physics'; } catch { return 'physics'; } };
  const remember = m => { try { localStorage.setItem(MODE_KEY, m); } catch {} };
  const running = () => (window.__havoc && window.__havoc.active) || (window.__elements && window.__elements.active);
  let loadingPhysics = null, loadingElements = null;

  async function open(api, m) {
    try {
      if (m === 'elements') {
        if (window.__elements) return window.__elements.start();
        loadingElements = loadingElements || load('vendor/elements-engine.js' + v());   // starts itself once loaded
        await loadingElements;
      } else {
        if (window.__havoc) return window.__havoc.start();
        loadingPhysics = loadingPhysics || (async () => { if (!window.Matter) await load('vendor/matter.min.js'); await load('vendor/havoc-engine.js' + v()); })();
        await loadingPhysics;
      }
    } catch (e) {
      if (m === 'elements') loadingElements = null; else loadingPhysics = null;
      api.ui.toast('Havoc needs its engine files (vendor/) — ' + e.message);
    }
  }
  function unleash(api, m) {
    if (running()) { window.__havoc && window.__havoc.stop(); window.__elements && window.__elements.stop(); return; }
    open(api, m || mode());
  }

  Cadence.registerPlugin({
    id: 'havoc', name: 'Havoc', version: '1.1.0', icon: '<path d="M12 2.5l2 5.5 5.5-1.5-3.8 4.5 4.8 3.5-5.8.8.8 5.7-3.5-3.8-3.5 3.8.8-5.7-5.8-.8 4.8-3.5L4.5 6.5 10 8z"/>', color: '#f76b15', category: 'Fun', tagline: 'Wreck the page with physics, or turn it into sand, fire and water',
    description: 'Blow off steam: blast, melt or black-hole the Cadence page, or switch to Elements and burn, flood, freeze and bury it. Shift+H to unleash, Esc to restore.',
    setup(api) {
      api.commands.add({ title: '💥 Havoc — wreck this page', hint: '⇧H', run: api => unleash(api) });
      api.commands.add({ title: '🔥 Elements — turn this page into sand, fire and water', run: api => { remember('elements'); unleash(api, 'elements'); } });
      // either toolbar's Physics / Elements switch: the engine has already stopped, start the other one
      window.__havocMode && removeEventListener('havoc:mode', window.__havocMode);
      window.__havocMode = e => { const m = e.detail === 'elements' ? 'elements' : 'physics'; remember(m); setTimeout(() => open(api, m), 60); };
      addEventListener('havoc:mode', window.__havocMode);
      window.__havocKey && removeEventListener('keydown', window.__havocKey);
      window.__havocKey = e => {
        if (e.key !== 'H' || !e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
        if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
        if (window.__elements && window.__elements.active) return;   // Elements handles its own Shift+H
        e.preventDefault(); unleash(api);
      };
      addEventListener('keydown', window.__havocKey);
    }
  });
})();
