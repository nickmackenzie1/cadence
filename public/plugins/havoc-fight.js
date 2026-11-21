/* Havoc: Wizard vs the bosses (user, 2026-11-18). The game itself is vendor/havoc-fight.js, loaded the first time.
   From ⌘K, or Shift+F. Esc puts the page back. */
(() => {
  let loading = null;
  const go = async api => {
    try {
      if (!window.HavocFight) { loading = loading || new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/havoc-fight.js?v=' + Date.now().toString(36).slice(0, -3); s.onload = res; s.onerror = () => rej(new Error('Could not load vendor/havoc-fight.js')); document.head.appendChild(s); }); await loading; }
      if (window.__havoc && window.__havoc.active) window.__havoc.stop();
      window.HavocFight.active ? window.HavocFight.stop() : window.HavocFight.start();
    } catch (e) { loading = null; api.ui.toast("The wizard couldn't come out: " + e.message); }
  };
  Cadence.registerPlugin({
    id: 'havoc-fight', name: 'Wizard vs bosses', version: '1.0.0', category: 'Fun', color: '#4c5fd5',
    icon: '<path d="m14.5 17.5-11-11V3h3.5l11 11"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/><path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="m5 14 4 4"/><path d="m7 17-3 3"/><path d="m3 19 2 2"/>',
    tagline: 'A pixel wizard fights four bosses on your page',
    description: 'A pixel-art wizard fights on your page, shouting his spells: purple fireballs, Kablammo, Meltdown, Zappity zap and Frostbite. The bosses take turns: a fire-breathing dragon, a vampire cat that swoops in to bite, Blobby the jelly cube (Splat splat bursts him into acid, and he pulls himself back together) and a skeleton who throws bones, or tricks the wizard into coming close, then shakes him and throws him. Words fly with Havoc\'s physics, and fire, lava and acid are real Elements. Click to aim, 1 to 6 for spells. Shift+F or ⌘K to start, Esc puts everything back.',
    setup(api) {
      api.commands.add({ title: 'Havoc: wizard vs the dragon', icon: 'swords', hint: '⇧F', run: api => go(api) });
      window.__hfKey && removeEventListener('keydown', window.__hfKey);
      window.__hfKey = e => {
        if (e.key !== 'F' || !e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
        if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
        e.preventDefault(); go(api);
      };
      addEventListener('keydown', window.__hfKey);
      // the Wizard button on Havoc's toolbar
      window.__hfFromHavoc && removeEventListener('havoc:fight', window.__hfFromHavoc);
      window.__hfFromHavoc = () => setTimeout(() => go(api), 80);
      addEventListener('havoc:fight', window.__hfFromHavoc);
    }
  });
})();
