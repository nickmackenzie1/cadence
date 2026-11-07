/* Living mural — every task you complete paints a brushstroke in that client's brand colours.
   Strokes gather around each client's "home" on the canvas and flow along a shared wind field,
   so months of work become one painting. Replay it as a time-lapse or download it as a poster. */
(() => {
  const G = window.__mural = window.__mural || {};
  if (!G.style) {
    G.style = document.createElement('style');
    G.style.textContent = `
      .mu-wrap{position:relative;border-radius:16px;overflow:hidden;background:#f3efe6;box-shadow:0 1px 2px rgba(0,0,0,.05),0 18px 50px rgba(0,0,0,.10);border:1px solid var(--line)}
      .mu-wrap canvas{display:block;width:100%;height:auto}
      .mu-bar{display:flex;align-items:center;gap:8px;margin:0 0 14px;flex-wrap:wrap}
      .mu-bar .sp{flex:1}
      .mu-date{position:absolute;left:16px;bottom:14px;font:600 12px/1 ui-sans-serif,system-ui;color:rgba(40,30,20,.65);background:rgba(255,255,255,.6);backdrop-filter:blur(6px);padding:6px 10px;border-radius:999px;opacity:0;transition:opacity .3s}
      .mu-date.on{opacity:1}
      .mu-legend{display:flex;flex-wrap:wrap;gap:8px 14px;margin-top:14px;font-size:12.5px;color:var(--muted)}
      .mu-legend span{display:inline-flex;align-items:center;gap:6px}
      .mu-legend i{width:10px;height:10px;border-radius:50%}
      .mu-stat{font-size:12.5px;color:var(--muted)}
      .mu-empty{position:absolute;inset:0;display:grid;place-items:center;text-align:center;color:rgba(40,30,20,.55);font-size:14px;padding:20px}
    `;
    document.head.appendChild(G.style);
  }
  const W = 1600, H = 1000, TAU = Math.PI * 2;
  const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  // smooth value noise for the shared "wind" every stroke follows
  const NR = rng(9001), grid = [...Array(256)].map(() => NR());
  const n2 = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, s = t => t * t * (3 - 2 * t);
    const g = (a, b) => grid[((a * 57 + b * 131) & 255 + 256) & 255]; const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1);
    return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf); };
  const field = (x, y) => (n2(x / 380, y / 380) * 0.65 + n2(x / 140 + 9, y / 140 + 3) * 0.35) * TAU * 1.6;
  const hex2rgb = h => { h = String(h || '#888').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h.slice(0, 6), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const shade = ([r, g, b], k) => k >= 0 ? [r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k] : [r * (1 + k), g * (1 + k), b * (1 + k)];

  Cadence.registerPlugin({
    id: 'mural', name: 'Living mural', version: '1.0.0',
    description: 'Every task you complete paints a brushstroke in the client’s brand colours. Watch months of work become one painting, replay it as a time-lapse, download it as a poster.',
    setup(api) {
      const store = () => Object.assign({ strokes: [] }, api.storage.get('mural') || {});
      function backfill(st) {
        if (st.seeded) return st;
        st.strokes = api.tasks.list(t => t.done && t.doneAt).sort((a, b) => a.doneAt - b.doneAt)
          .map(t => ({ t: t.doneAt, c: t.clientId || null, k: t.owner === 'client' ? 'loot' : (t.dueDate && t.dueDate < api.util.ymd(new Date(t.doneAt)) ? 'crit' : 'n'), p: t.priority || 0 }));
        st.seeded = true; return st;
      }
      api.on('task:complete', t => {
        const st = backfill(store());
        st.strokes.push({ t: Date.now(), c: t.clientId || null, k: t.owner === 'client' ? 'loot' : (t.dueDate && t.dueDate < api.util.todayKey() ? 'crit' : 'n'), p: t.priority || 0 });
        if (st.strokes.length > 6000) st.strokes.splice(0, st.strokes.length - 6000);
        api.storage.set('mural', st);
      });

      /* each client gets a home on the canvas (spread with the golden angle) and a palette from its brand */
      function homes() {
        const cl = api.clients.list().slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)), out = {};
        cl.forEach((c, i) => {
          const a = i * 2.39996 + (hash(c.id) % 100) / 100, r = 0.18 + 0.27 * Math.sqrt((i + 0.5) / Math.max(1, cl.length));
          const pal = (c.brand && c.brand.palette && c.brand.palette.length ? c.brand.palette : [c.brand && c.brand.primary, c.brand && c.brand.secondary, c.color]).filter(Boolean);
          out[c.id] = { x: W / 2 + Math.cos(a) * r * W * 0.95, y: H / 2 + Math.sin(a) * r * H * 0.95, pal: pal.length ? pal : [c.color || '#8a877f'], name: c.name, n: 0 };
        });
        out._ = { x: W / 2, y: H / 2, pal: ['#8a877f', '#b9b5ac'], name: 'No client', n: 0 };
        return out;
      }
      function paper(ctx) {
        ctx.fillStyle = '#f3efe6'; ctx.fillRect(0, 0, W, H);
        const R = rng(7), img = ctx.getImageData(0, 0, W, H), d = img.data;
        for (let i = 0; i < d.length; i += 4) { const v = (R() - 0.5) * 14; d[i] += v; d[i + 1] += v; d[i + 2] += v; }
        ctx.putImageData(img, 0, 0);
        const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.95); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(90,70,40,.10)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      function stroke(ctx, s, i, hm) {
        const home = hm[s.c] || hm._, R = rng(hash(String(s.t)) ^ i);
        home.n++;
        // regions grow outward as a client accumulates work
        const spread = 40 + Math.sqrt(home.n) * 22, ang = R() * TAU, dist = Math.sqrt(R()) * spread;
        let x = home.x + Math.cos(ang) * dist, y = home.y + Math.sin(ang) * dist;
        const col = hex2rgb(home.pal[Math.floor(R() * home.pal.length)]);
        if (s.k === 'loot') { // splatter of dots
          for (let j = 0; j < 14 + s.p * 4; j++) { const a = R() * TAU, r = R() * 26, rad = 1 + R() * 4.5, c = shade(col, (R() - 0.4) * 0.5); ctx.fillStyle = `rgba(${c.map(Math.round)},${0.35 + R() * 0.4})`; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, rad, 0, TAU); ctx.fill(); }
          return;
        }
        const crit = s.k === 'crit', width = (crit ? 16 : 7) + s.p * 3 + R() * 6, len = (crit ? 70 : 34) + R() * 60 + s.p * 10, bristles = crit ? 16 : 10;
        const pts = []; let a0 = field(x, y);
        for (let k = 0; k < len; k++) { const a = field(x, y); a0 += (a - a0) * 0.3; x += Math.cos(a0) * 3; y += Math.sin(a0) * 3; pts.push([x, y, a0]); }
        for (let b = 0; b < bristles; b++) {
          const off = (b / (bristles - 1) - 0.5) * width, c = shade(col, (R() - 0.45) * 0.55), alpha = (crit ? 0.22 : 0.16) + R() * 0.2;
          ctx.strokeStyle = `rgba(${c.map(Math.round)},${alpha})`; ctx.lineWidth = 1 + R() * (crit ? 3 : 2.2); ctx.lineCap = 'round'; ctx.beginPath();
          const start = Math.floor(R() * 4), end = pts.length - Math.floor(R() * 6);
          for (let k = start; k < end; k++) { const [px, py, pa] = pts[k], taper = Math.sin(Math.PI * k / pts.length); const ox = -Math.sin(pa) * off * taper, oy = Math.cos(pa) * off * taper; k === start ? ctx.moveTo(px + ox, py + oy) : ctx.lineTo(px + ox, py + oy); }
          ctx.stroke();
        }
        if (crit) { const c = shade(col, 0.55); ctx.strokeStyle = `rgba(${c.map(Math.round)},.35)`; ctx.lineWidth = 1.5; ctx.beginPath(); pts.forEach(([px, py], k) => k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.stroke(); }
      }
      function paint(canvas, strokes, upto) {
        const ctx = canvas.getContext('2d'); paper(ctx);
        const hm = homes(); const n = upto == null ? strokes.length : upto;
        for (let i = 0; i < n; i++) stroke(ctx, strokes[i], i, hm);
        return hm;
      }

      api.views.add({ id: 'mural', group: 'insights', title: 'Mural', icon: '🎨', subtitle: 'Every finished task adds a brushstroke in that client’s colours', render: (el, api) => {
        const st = backfill(store()); if (!api.storage.get('mural') || !api.storage.get('mural').seeded) api.storage.set('mural', st);
        const strokes = st.strokes, E = api.ui.esc;
        el.innerHTML = `<div class="mu-bar"><span class="mu-stat">${strokes.length.toLocaleString()} strokes${strokes.length ? ' · since ' + new Date(strokes[0].t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span><span class="sp"></span>
          <button class="btn" id="mu-play" ${strokes.length ? '' : 'disabled'}>▶ Time-lapse</button><button class="btn" id="mu-dl" ${strokes.length ? '' : 'disabled'}>⤓ Poster</button></div>
          <div class="mu-wrap"><canvas width="${W}" height="${H}"></canvas><div class="mu-date"></div>${strokes.length ? '' : '<div class="mu-empty">Your mural is a blank canvas.<br>Complete a task and the first brushstroke appears here — in that client’s colours.</div>'}</div>
          <div class="mu-legend"></div>`;
        const canvas = el.querySelector('canvas'), date = el.querySelector('.mu-date');
        const hm = paint(canvas, strokes);
        el.querySelector('.mu-legend').innerHTML = Object.entries(hm).filter(([, h]) => h.n).sort((a, b) => b[1].n - a[1].n).map(([, h]) => `<span><i style="background:${h.pal[0]}"></i>${E(h.name)} · ${h.n}</span>`).join('');
        el.querySelector('#mu-play').onclick = () => {
          cancelAnimationFrame(G.raf); const ctx = canvas.getContext('2d'); paper(ctx); const hm2 = homes(); let i = 0;
          const per = Math.max(1, Math.ceil(strokes.length / 360)); date.classList.add('on');
          const step = () => { for (let k = 0; k < per && i < strokes.length; k++, i++) stroke(ctx, strokes[i], i, hm2); if (strokes[i - 1]) date.textContent = new Date(strokes[i - 1].t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); if (i < strokes.length && canvas.isConnected) G.raf = requestAnimationFrame(step); else setTimeout(() => date.classList.remove('on'), 1500); };
          step();
        };
        el.querySelector('#mu-dl').onclick = () => {
          // poster: the painting plus a quiet caption
          const big = document.createElement('canvas'); big.width = W; big.height = H + 140; const c2 = big.getContext('2d');
          const art = document.createElement('canvas'); art.width = W; art.height = H; paint(art, strokes);
          c2.fillStyle = '#f3efe6'; c2.fillRect(0, 0, big.width, big.height); c2.drawImage(art, 0, 0);
          c2.fillStyle = 'rgba(40,30,20,.8)'; c2.font = '600 34px Inter, ui-sans-serif, system-ui'; c2.fillText(`${(api.settings().myName || 'My').split(' ')[0]}'s work, painted`, 60, H + 70);
          c2.fillStyle = 'rgba(40,30,20,.5)'; c2.font = '400 22px Inter, ui-sans-serif, system-ui'; c2.fillText(`${strokes.length.toLocaleString()} tasks · ${Object.values(hm).filter(h => h.n).length} clients · ${new Date(strokes[0].t).toLocaleDateString()} – ${new Date().toLocaleDateString()}`, 60, H + 108);
          big.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'cadence-mural.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); api.ui.toast('Poster downloaded'); });
        };
      }});
      api.commands.add({ title: 'Open the mural', run: api => api.ui.navigate('view-mural') });
    }
  });
})();
