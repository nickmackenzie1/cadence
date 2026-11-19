/* Havoc: Wizard vs the bosses (user, 2026-11-18). The game itself is vendor/havoc-fight.js, loaded the first time.
   From ⌘K, or Shift+F. Esc puts the page back. */
(() => {
  let loading = null;
  const go = async api => {
    try {
      if (!window.HavocFight) { loading = loading || new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/havoc-fight.js?v=' + Date.now().toString(36).slice(0, -3); s.onload = res; s.onerror = () => rej(new Error('Could not load vendor/havoc-fight.js')); document.head.appendChild(s); }); await loading; }
      if (window.__havoc && window.__havoc.active) window.__havoc.stop();
      if (window.__elements && window.__elements.active) window.__elements.stop();
      window.HavocFight.active ? window.HavocFight.stop() : window.HavocFight.start();
    } catch (e) { loading = null; api.ui.toast("The wizard couldn't come out: " + e.message); }
  };
  Cadence.registerPlugin({
    id: 'havoc-fight', name: 'Wizard vs bosses', version: '1.0.0', category: 'Fun', color: '#4c5fd5',
    icon: '<path d="m14.5 17.5-11-11V3h3.5l11 11"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/><path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="m5 14 4 4"/><path d="m7 17-3 3"/><path d="m3 19 2 2"/>',
    tagline: 'A wizard fights a dragon on your page',
    description: 'A wizard walks along the bottom of the page and fights with fireballs from his staff: a fire-breathing dragon, then a vampire cat that swoops in to bite, then Blobby, who chases him along the ground. Each boss goes down after a random number of hits, the next one comes out, and every round wrecks the page a little more. Click to aim, arrow keys to move. Shift+F or ⌘K to start, Esc puts everything back.',
    setup(api) {
      api.commands.add({ title: 'Havoc: wizard vs the dragon', icon: 'swords', hint: '⇧F', run: api => go(api) });
      window.__hfKey && removeEventListener('keydown', window.__hfKey);
      window.__hfKey = e => {
        if (e.key !== 'F' || !e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
        if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
        e.preventDefault(); go(api);
      };
      addEventListener('keydown', window.__hfKey);
    }
  });
})();
