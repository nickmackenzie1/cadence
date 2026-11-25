/* Havoc — wreck the Cadence page itself. Two engines, switched from the toolbar:
     Physics  — vendor/havoc-engine.js (Matter.js): the words float, fly and explode; its fire, lava, acid, rain and
                blasts are played out as real Elements matter (one Havoc: user, 2026-11-18)
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
        if (!window.ElementsWorld) { loadingElements = loadingElements || load('vendor/elements-engine.js' + v()); await loadingElements; }
        window.__elements = window.__elements || window.ElementsWorld.create({ kind: 'havoc' });
        window.__elements.start();
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
    description: 'Blow off steam: blast, melt or black-hole the THING page, or switch to Elements and burn, flood, freeze and bury it. Shift+H to unleash, Esc to restore.',
    setup(api) {
      api.commands.add({ title: 'Havoc: wreck this page', icon: 'bomb', hint: '⇧H', run: api => unleash(api) });
      api.commands.add({ title: 'Elements: turn this page into sand, fire and water', icon: 'flame', run: api => { remember('elements'); unleash(api, 'elements'); } });
      // Physics mode plays out in real matter too: a blast leaves fire and scatters sand, melt pours lava, rain is real
      // water that puddles on the cards, and a black hole swallows the matter around it
      window.__havocFx && removeEventListener('havoc:fx', window.__havocFx);
      window.__havocFx = e => {
        const d = e.detail || {}; if (!window.CadenceFX) return;
        if (d.type === 'rain' || d.type === 'stop') {
          window.CadenceFX.want('havoc', d.type === 'rain' && d.on ? { rain: 7 } : null);
          // the pictures' pixels go with the mess when Havoc stops
          if (d.type === 'stop') window.CadenceFX.world().then(w => { if (w && w.M.PIXEL != null) { w.clear(w.M.PIXEL); w.clear(w.M.DRIP); } if (w && w.unstamp) w.unstamp(); }, () => {});
          return;
        }
        window.CadenceFX.world().then(w => {
          if (!w) return;
          if (d.type === 'blast') { w.explode(d.x, d.y, 7); w.spawn(d.x, d.y, w.M.FIRE, 5, 0.5, 15, 40); w.spawn(d.x, d.y + 10, w.M.SAND, 6, 0.4); }
          else if (d.type === 'melt') { w.spawn(d.x, d.y, w.M.LAVA, 4, 0.75); w.heatAt(d.x, d.y, 800, 2); }
          // Fire and Acid tools: the flames sit on a splash of oil so they keep burning; acid eats what it lands on
          else if (d.type === 'fire') { w.spawn(d.x, d.y + 4, w.M.OIL, 4, 0.5); w.spawn(d.x, d.y, w.M.FIRE, 6, 0.65, 30, 80); }
          else if (d.type === 'acid') w.spawn(d.x, d.y, w.M.ACID, 4, 0.7);
          // a picture bursts into its pixels (2026-11-19): one colour per cell, read from Havoc's copy of the picture.
          // A picture from another site can't be read (the browser won't allow it): it bursts in its average-looking grey
          else if (d.type === 'pixels') {
            const c = w.cellSize || 3, cw = Math.max(1, Math.round(d.w / c)), ch = Math.max(1, Math.round(d.h / c));
            let px;
            try { const t = document.createElement('canvas'); t.width = cw; t.height = ch; const g = t.getContext('2d', { willReadFrequently: true }); g.drawImage(d.canvas, 0, 0, cw, ch); px = g.getImageData(0, 0, cw, ch).data; }
            catch (e) { px = new Uint8ClampedArray(cw * ch * 4); for (let i = 0; i < px.length; i += 4) { const v = 120 + ((i * 7919) % 50); px[i] = v; px[i + 1] = v; px[i + 2] = v + 8; px[i + 3] = 255; } }
            w.pixels(d.left, d.top, cw, ch, px, d.x, d.y, d.power || 2.4);
          }
          else if (d.type === 'hole') { if (w.sink) w.sink(d.x, d.y, 280, 7); else { let n = 0; const iv = setInterval(() => { w.clearAt(d.x, d.y, 30 + n * 6); if (++n > 60) clearInterval(iv); }, 110); } }
        });
      };
      addEventListener('havoc:fx', window.__havocFx);
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
