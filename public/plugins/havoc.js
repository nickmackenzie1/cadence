/* Havoc — wreck the Cadence page itself. One Havoc (2026-11-20): vendor/havoc-engine.js (Matter.js) makes the words
   float, fly and explode, and plays fire, lava, acid, rain, blasts and the Materials drawer out as real Elements
   matter (vendor/elements-engine.js); still words are page pixels in that layer, so they burn away pixel by pixel.
   Shift+H opens it, Esc restores everything. Its extras live in Havoc's Materials drawer (Weather row). */
(() => {
  const load = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); });
  const v = () => '?v=' + Date.now().toString(36).slice(0, -3);
  // the old Physics / Elements choice is gone: tidy away a saved one
  try { localStorage.removeItem('cadence.havoc'); } catch {}
  let loading = null;
  async function open(api) {
    try {
      if (window.__havoc) return window.__havoc.start();
      loading = loading || (async () => { if (!window.Matter) await load('vendor/matter.min.js'); await load('vendor/havoc-engine.js' + v()); })();
      await loading;
    } catch (e) {
      loading = null;
      api.ui.toast('Havoc needs its engine files (vendor/) — ' + e.message);
    }
  }
  function unleash(api) {
    if (window.__havoc && window.__havoc.active) { window.__havoc.stop(); return; }
    open(api);
  }

  Cadence.registerPlugin({
    id: 'havoc', name: 'Havoc', version: '1.1.0', icon: '<path d="M12 2.5l2 5.5 5.5-1.5-3.8 4.5 4.8 3.5-5.8.8.8 5.7-3.5-3.8-3.5 3.8.8-5.7-5.8-.8 4.8-3.5L4.5 6.5 10 8z"/>', color: '#f76b15', category: 'Fun', tagline: 'Wreck the page: words fly, burn and melt into pixels',
    description: 'Blow off steam: blast, burn, melt, flood or black-hole the THING page, and paint it with sand, snow, oil and more from the Materials drawer. Shift+H to unleash, Esc to restore.',
    setup(api) {
      api.commands.add({ title: 'Havoc: wreck this page', icon: 'bomb', hint: '⇧H', run: api => unleash(api) });
      // Physics mode plays out in real matter too: a blast leaves fire and scatters sand, melt pours lava, rain is real
      // water that puddles on the cards, and a black hole swallows the matter around it
      window.__havocFx && removeEventListener('havoc:fx', window.__havocFx);
      window.__havocFx = e => {
        const d = e.detail || {}; if (!window.CadenceFX) return;
        // rain and the Weather drawer (snowfall, storm, wind, string lights) are one ask of the ambient layer
        const hw = window.__havocWeather = window.__havocWeather || {};
        if (d.type === 'rain' || d.type === 'weather' || d.type === 'stop') {
          if (d.type === 'rain') hw.rain = d.on ? 7 : 0;
          else if (d.type === 'weather') Object.assign(hw, d.o || {});
          else for (const k of Object.keys(hw)) delete hw[k];
          const any = hw.rain || hw.snow || hw.storm || hw.lights || hw.wind != null;
          window.CadenceFX.want('havoc', any ? { rain: hw.rain || 0, snow: !!hw.snow, everywhere: !!hw.snow, storm: !!hw.storm, lights: hw.lights || null, ...(hw.wind != null ? { wind: hw.wind } : {}) } : null);
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
