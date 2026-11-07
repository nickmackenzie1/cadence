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
    id: 'mural', name: 'Living mural', version: '1.0.0', icon: '<path d="M14 4l6 6-8 8H6v-6z"/><path d="M4 20.5c2 0 3-1 3-3"/>', color: '#ff4fa3', category: 'Look & feel', tagline: 'Rebuild a masterpiece from client logos',
    description: 'Mosaic: pick a public-domain painting and every task you finish lays tiles made of your clients’ logos, each placed where its colours fit, until the picture appears. Brushstrokes: every task paints a stroke in the client’s colours. Time-lapse and poster for both.',
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


      /* ================= Mosaic: rebuild a public-domain painting out of your clients' logos =================
         Pick a painting; every task you finish lays a few tiles. Each tile is the client's logo, placed where
         the painting's colour is closest to that client's colour, then tinted to fit. */
      const PRESETS = [
        { id: 'wave', name: 'The Great Wave', by: 'Hokusai, c. 1831', file: 'Tsunami_by_hokusai_19th_century.jpg' },
        { id: 'starry', name: 'The Starry Night', by: 'Van Gogh, 1889', file: 'Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg' },
        { id: 'pearl', name: 'Girl with a Pearl Earring', by: 'Vermeer, c. 1665', file: '1665_Girl_with_a_Pearl_Earring.jpg' },
        { id: 'lilies', name: 'Water Lilies', by: 'Monet, 1906', file: 'Claude_Monet_-_Water_Lilies_-_1906,_Ryerson.jpg' },
        { id: 'kiss', name: 'The Kiss', by: 'Klimt, 1908', file: 'Gustav_Klimt_016.jpg' },
        { id: 'jatte', name: 'A Sunday on La Grande Jatte', by: 'Seurat, 1884', file: 'Georges_Seurat_-_A_Sunday_on_La_Grande_Jatte_--_1884_-_Google_Art_Project.jpg' },
        { id: 'mona', name: 'Mona Lisa', by: 'Leonardo, c. 1503', file: 'Mona_Lisa,_by_Leonardo_da_Vinci,_from_C2RMF_retouched.jpg' },
      ];
      const remote = f => 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(f) + '?width=480';
      const viaNas = u => api.system().mode === 'nas' ? 'api/img?url=' + encodeURIComponent(u) : u;
      const loadImg = (src, cors) => new Promise((res, rej) => { const im = new Image(); if (cors) im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => rej(new Error('Image did not load')); im.src = src; });
      const mos = () => api.storage.get('mosaic') || null;
      const putMos = m => api.storage.set('mosaic', m);
      const cellRGB = (t, i) => { const h = t.px.substr(i * 6, 6); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
      const dist = (a, b) => { const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2], rm = (a[0] + b[0]) / 2; return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db; };
      function sample(img, cols) {
        const rows = Math.max(8, Math.round(cols * img.naturalHeight / img.naturalWidth));
        const c = document.createElement('canvas'); c.width = cols; c.height = rows; const x = c.getContext('2d', { willReadFrequently: true });
        x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, cols, rows);
        const d = x.getImageData(0, 0, cols, rows).data; let px = '';
        for (let i = 0; i < d.length; i += 4) px += ((1 << 24) | (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]).toString(16).slice(1);
        return { cols, rows, px };
      }
      /* a client's colour: sampled from its logo when we can read it, else its brand colour */
      G.logo = G.logo || {}; G.lcol = G.lcol || {};
      function clientLogo(c) {
        if (!c || !c.domain) return null; const key = c.id + ':' + (c.logoV || '');
        if (G.logo[key] !== undefined) return G.logo[key];
        G.logo[key] = null; const url = api.ui.faviconUrl(c.domain, c.logoV), same = !/^https?:/i.test(url) || url.startsWith(location.origin);
        loadImg(url, false).then(im => { G.logo[key] = im; if (same) { try { const k = document.createElement('canvas'); k.width = k.height = 8; const x = k.getContext('2d'); x.drawImage(im, 0, 0, 8, 8); const d = x.getImageData(0, 0, 8, 8).data; let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 120) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } if (n) G.lcol[c.id] = [r / n, g / n, b / n]; } catch (e) {} } G.dirty && G.dirty(); }).catch(() => {});
        return null;
      }
      const clientRGB = c => G.lcol[c.id] || hex2rgb((c.brand && c.brand.primary) || c.color);
      function placeTiles(m, cid, k) {
        const t = m.target, total = t.cols * t.rows; if (m.tiles.length >= total) return 0;
        const used = new Uint8Array(total); m.tiles.forEach(x => used[x[0]] = 1);
        const free = []; for (let i = 0; i < total; i++) if (!used[i]) free.push(i);
        const c = cid && api.clients.get(cid), R = rng(hash(t.id) + m.tiles.length * 7919);
        let ci = -1; if (c) { ci = m.cl.indexOf(cid); if (ci < 0) { m.cl.push(cid); ci = m.cl.length - 1; } }
        let placed = 0;
        for (let n = 0; n < k && free.length; n++) {
          let best = -1, bd = Infinity;
          for (let s = 0; s < Math.min(28, free.length); s++) { const j = Math.floor(R() * free.length), d = c ? dist(cellRGB(t, free[j]), clientRGB(c)) * (0.55 + R() * 0.9) : R(); if (d < bd) { bd = d; best = j; } }
          m.tiles.push([free[best], ci]); free.splice(best, 1); placed++;
        }
        return placed;
      }
      function newMosaic(target, opts) {
        const m = { target, tiles: [], cl: [], per: opts.per || 4, started: Date.now(), hits: {} };
        if (opts.backfill) api.tasks.list(t => t.done && t.doneAt).sort((a, b) => a.doneAt - b.doneAt).forEach(t => placeTiles(m, t.clientId, m.per));
        const pct = m.tiles.length / (target.cols * target.rows); [10, 25, 50, 75, 100].forEach(p => { if (pct * 100 >= p) m.hits[p] = 1; });
        return m;
      }
      api.on('task:complete', t => {
        const m = mos(); if (!m) return; const total = m.target.cols * m.target.rows; if (m.tiles.length >= total) return;
        const before = m.tiles.length / total; placeTiles(m, t.clientId, m.per); const after = m.tiles.length / total;
        m.last = m.tiles.length; putMos(m);
        const hit = [10, 25, 50, 75, 100].find(p => before * 100 < p && after * 100 >= p && !m.hits[p]);
        if (hit) { m.hits[hit] = 1; putMos(m);
          setTimeout(() => api.island.celebrate(hit === 100
            ? { eyebrow: 'Mosaic finished', icon: '🖼️', color: '#ff4fa3', title: m.target.name, sub: `${total.toLocaleString()} logos, one painting`, actions: [{ label: 'See it', run: () => api.ui.navigate('view-mural') }, { label: 'Start another', run: () => { api.ui.navigate('view-mural'); setTimeout(picker, 300); } }] }
            : { eyebrow: 'Mosaic', icon: '🧩', color: '#ff4fa3', title: `${m.target.name} is ${hit}% done`, sub: `${m.tiles.length.toLocaleString()} of ${total.toLocaleString()} tiles`, right: hit + '%', onClick: () => api.ui.navigate('view-mural') }), 1600); }
      });

      function drawMosaic(canvas, m, upto, peek) {
        const t = m.target, T = 18, ctx = canvas.getContext('2d');
        canvas.width = t.cols * T; canvas.height = t.rows * T;
        ctx.fillStyle = '#efe9dd'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        // the painting, as a faint ghost to fill in
        const g = document.createElement('canvas'); g.width = t.cols; g.height = t.rows; const gx = g.getContext('2d'), id = gx.createImageData(t.cols, t.rows);
        for (let i = 0; i < t.cols * t.rows; i++) { const [r, gg, b] = cellRGB(t, i); id.data.set([r, gg, b, 255], i * 4); } gx.putImageData(id, 0, 0);
        ctx.save(); ctx.globalAlpha = peek ? 1 : 0.32; ctx.filter = peek ? 'none' : 'saturate(.5) blur(2px)'; ctx.imageSmoothingEnabled = true; ctx.drawImage(g, 0, 0, canvas.width, canvas.height); ctx.restore();
        if (peek) return;
        const n = upto == null ? m.tiles.length : upto, cls = m.cl.map(id => api.clients.get(id));
        for (let k = 0; k < n; k++) {
          const [i, ci] = m.tiles[k], x = (i % t.cols) * T, y = Math.floor(i / t.cols) * T, rgb = cellRGB(t, i), col = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`, c = ci >= 0 ? cls[ci] : null;
          ctx.fillStyle = col; ctx.fillRect(x, y, T, T);
          const logo = c && clientLogo(c);
          if (logo) {
            ctx.save(); ctx.globalCompositeOperation = 'luminosity'; ctx.globalAlpha = 0.55; ctx.drawImage(logo, x + 2, y + 2, T - 4, T - 4); ctx.restore();
            ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.5; ctx.fillStyle = col; ctx.fillRect(x, y, T, T); ctx.restore();
          } else if (c) {
            ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.font = `700 ${T * .55}px Inter, ui-sans-serif, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((c.name || '?')[0].toUpperCase(), x + T / 2, y + T / 2 + 1); ctx.restore();
          }
          ctx.strokeStyle = 'rgba(0,0,0,.10)'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, T - 1, T - 1);
          ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.strokeRect(x + 1.5, y + 1.5, T - 3, T - 3);
        }
        if (m.last && upto == null) { // the newest tiles glow briefly
          ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.shadowColor = '#fff'; ctx.shadowBlur = 8;
          m.tiles.slice(Math.max(0, m.last - m.per), m.last).forEach(([i]) => ctx.strokeRect((i % t.cols) * T + 1, Math.floor(i / t.cols) * T + 1, T - 2, T - 2)); ctx.restore();
        }
      }

      async function picker() {
        const E = api.ui.esc, done = api.tasks.list(t => t.done).length;
        api.ui.modal('🧩 Choose a painting', `
          <p class="muted" style="margin:0 0 4px;font-size:13px">Public-domain masterpieces from Wikimedia Commons. Each finished task lays tiles made of your clients’ logos, placed where their colours fit.</p>
          <div class="mo-pick">${PRESETS.map(p => `<button class="mo-pc" data-p="${p.id}"><span class="th"><img alt="" loading="lazy" src="${E(viaNas(remote(p.file)))}" onerror="this.style.display='none'"></span><b>${E(p.name)}</b><small>${E(p.by)}</small></button>`).join('')}
            <label class="mo-pc up"><span class="th">⤒</span><b>Your own image</b><small>Any photo or artwork</small><input type="file" accept="image/*" id="mo-up" hidden></label></div>
          <div class="row" style="gap:18px;flex-wrap:wrap;align-items:center;font-size:13px">
            <label class="row" style="gap:6px;align-items:center">Size <select class="inp" id="mo-cols" style="width:auto;padding:4px 8px"><option value="36">Small · ~1k tiles</option><option value="48" selected>Medium · ~2k tiles</option><option value="64">Large · ~3.5k tiles</option></select></label>
            <label class="row" style="gap:6px;align-items:center">Tiles per task <select class="inp" id="mo-per" style="width:auto;padding:4px 8px"><option>2</option><option selected>4</option><option>8</option></select></label>
            <label class="row" style="gap:6px;align-items:center"><input type="checkbox" id="mo-bf" checked> Count the ${done} tasks you’ve already finished</label>
          </div><div class="muted" id="mo-msg" style="font-size:12.5px;min-height:18px"></div>`, `<button class="btn" data-act="close-modal">Cancel</button>`, 'wide');
        const msg = document.querySelector('#mo-msg');
        const start = async (img, meta) => {
          try {
            const cols = +document.querySelector('#mo-cols').value, t = Object.assign(sample(img, cols), meta);
            const m = newMosaic(t, { per: +document.querySelector('#mo-per').value, backfill: document.querySelector('#mo-bf').checked });
            putMos(m); api.storage.set('mode', 'mosaic'); api.ui.close(); api.ui.refresh();
            api.island.show({ icon: '🧩', color: '#ff4fa3', title: `Started ${t.name}`, sub: `${m.tiles.length.toLocaleString()} of ${(t.cols * t.rows).toLocaleString()} tiles laid${m.tiles.length ? ' from past work' : ''}` });
          } catch (e) { msg.textContent = 'Couldn’t read that image (' + e.message + '). Try another, or upload one.'; }
        };
        document.querySelectorAll('[data-p]').forEach(b => b.onclick = async () => {
          const p = PRESETS.find(x => x.id === b.dataset.p); msg.textContent = `Loading ${p.name}…`;
          try { const img = await loadImg(viaNas(remote(p.file)), api.system().mode !== 'nas'); await start(img, { id: p.id + '-' + Date.now().toString(36), name: p.name, by: p.by, src: 'Wikimedia Commons' }); }
          catch (e) { msg.textContent = `Couldn’t load ${p.name} — ${api.system().mode === 'nas' ? 'is the NAS online?' : 'open Cadence on your NAS, or upload an image'}.`; }
        });
        document.querySelector('#mo-up').onchange = e => { const f = e.target.files[0]; if (!f) return; const url = URL.createObjectURL(f);
          loadImg(url, false).then(img => start(img, { id: 'own-' + Date.now().toString(36), name: f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 40) || 'My image', by: 'Your upload' })).finally(() => setTimeout(() => URL.revokeObjectURL(url), 5000)); };
      }

      function renderMosaic(el) {
        const m = mos(), E = api.ui.esc;
        if (!m) { el.innerHTML = `<div class="mu-wrap" style="aspect-ratio:16/9;display:grid;place-items:center;background:#efe9dd"><div style="text-align:center;max-width:420px;padding:20px;color:rgba(40,30,20,.7)"><div style="font-size:34px">🧩</div><b style="font-size:16px;color:rgba(40,30,20,.85)">Rebuild a masterpiece out of your clients’ logos</b><p style="font-size:13.5px;line-height:1.5">Pick a public-domain painting. Every task you finish lays a few tiles, each one a client’s logo placed where its colours fit, until the whole picture appears.</p><button class="btn primary" id="mo-new">Choose a painting</button></div></div>`; el.querySelector('#mo-new').onclick = picker; return; }
        const t = m.target, total = t.cols * t.rows, pct = m.tiles.length / total, left = Math.ceil((total - m.tiles.length) / m.per);
        const counts = {}; m.tiles.forEach(([, ci]) => { counts[ci] = (counts[ci] || 0) + 1; });
        el.innerHTML = `<div class="mu-bar"><span class="mu-stat"><b style="color:var(--text)">${E(t.name)}</b> · ${E(t.by || '')} · ${m.tiles.length.toLocaleString()} / ${total.toLocaleString()} tiles · ${pct >= 1 ? 'finished' : `about ${left.toLocaleString()} more tasks`}</span><span class="sp"></span>
            <button class="btn" id="mo-peek" title="Hold to see the original">◐ Peek</button><button class="btn" id="mo-play" title="Time-lapse">▶</button><button class="btn" id="mo-dl" title="Download poster">⤓</button><button class="btn" id="mo-new">New painting</button></div>
          <div class="mo-prog"><i style="width:${(pct * 100).toFixed(1)}%"></i></div>
          <div class="mu-wrap mo-wrap"><canvas></canvas></div>
          <div class="mu-legend">${Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([ci, n]) => { const c = +ci >= 0 && api.clients.get(m.cl[+ci]); return `<span>${c ? api.ui.avatar(c, 16) : '<i style="background:#bbb"></i>'}${E(c ? c.name : 'No client')} · ${n}</span>`; }).join('')}</div>`;
        const cv = el.querySelector('canvas');
        const draw = () => drawMosaic(cv, m); draw();
        G.dirty = () => { clearTimeout(G.dt); G.dt = setTimeout(() => { if (cv.isConnected) draw(); }, 120); };
        const peek = el.querySelector('#mo-peek');
        peek.onpointerdown = () => drawMosaic(cv, m, null, true); peek.onpointerup = peek.onpointerleave = draw;
        el.querySelector('#mo-new').onclick = picker;
        el.querySelector('#mo-play').onclick = () => { cancelAnimationFrame(G.raf); let i = 0; const per = Math.max(1, Math.ceil(m.tiles.length / 300)); const step = () => { i = Math.min(m.tiles.length, i + per); drawMosaic(cv, m, i); if (i < m.tiles.length && cv.isConnected) G.raf = requestAnimationFrame(step); }; step(); };
        el.querySelector('#mo-dl').onclick = () => {
          const big = document.createElement('canvas'), art = document.createElement('canvas'); drawMosaic(art, m);
          big.width = art.width + 120; big.height = art.height + 200; const c2 = big.getContext('2d');
          c2.fillStyle = '#f3efe6'; c2.fillRect(0, 0, big.width, big.height); c2.drawImage(art, 60, 60);
          c2.fillStyle = 'rgba(40,30,20,.82)'; c2.font = '600 30px Inter, ui-sans-serif, system-ui'; c2.fillText(t.name + (t.by ? ', after ' + t.by.split(',')[0] : ''), 60, art.height + 120);
          c2.fillStyle = 'rgba(40,30,20,.5)'; c2.font = '400 20px Inter, ui-sans-serif, system-ui'; c2.fillText(`${m.tiles.length.toLocaleString()} client logos · one per slice of finished work`, 60, art.height + 154);
          try { big.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'cadence-mosaic.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }); }
          catch (e) { api.ui.toast('Logos from other sites can’t be exported here — open Cadence on your NAS for the poster'); }
        };
      }
      if (!G.mosStyle) { G.mosStyle = document.createElement('style'); G.mosStyle.textContent = `
        .mu-tabs{display:inline-flex;background:var(--hover);border-radius:9px;padding:2px;margin:-6px 0 16px}
        .mu-tabs button{font-size:12.5px;padding:5px 12px;border-radius:7px;color:var(--muted)}
        .mu-tabs button.on{background:var(--panel);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.08)}
        .mo-wrap{background:#efe9dd}
        #mu-body .mu-bar .btn{padding:5px 10px;font-size:12.5px}.mo-wrap canvas{image-rendering:auto}
        .mo-prog{height:4px;border-radius:9px;background:var(--line);overflow:hidden;margin:-4px 0 12px}.mo-prog i{display:block;height:100%;background:linear-gradient(90deg,#ff4fa3,#ffb020)}
        .mo-pick{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin:12px 0 14px}
        .mo-pc{display:flex;flex-direction:column;text-align:left;gap:2px;padding:6px 6px 9px;border-radius:12px;border:1px solid var(--line);background:var(--panel);cursor:pointer;transition:transform .15s,box-shadow .2s}
        .mo-pc:hover{transform:translateY(-2px);box-shadow:0 8px 20px -10px rgba(0,0,0,.3)}
        .mo-pc .th{display:grid;place-items:center;aspect-ratio:4/3;border-radius:8px;overflow:hidden;background:var(--hover);margin-bottom:5px;font-size:22px;color:var(--muted)}
        .mo-pc .th img{width:100%;height:100%;object-fit:cover}
        .mo-pc b{font-size:12.5px;line-height:1.25}.mo-pc small{font-size:11px;color:var(--muted)}
        .mo-pc.up{border-style:dashed}`; document.head.appendChild(G.mosStyle); }

      api.views.add({ id: 'mural', title: 'Mural', icon: '🎨', subtitle: 'Your work, made into art', render: (el, api) => {
        const mode = api.storage.get('mode') || 'mosaic';
        el.innerHTML = `<div class="mu-tabs"><button data-mm="mosaic" class="${mode === 'mosaic' ? 'on' : ''}">🧩 Mosaic</button><button data-mm="strokes" class="${mode === 'strokes' ? 'on' : ''}">🖌 Brushstrokes</button></div><div id="mu-body"></div>`;
        el.querySelectorAll('[data-mm]').forEach(b => b.onclick = () => { api.storage.set('mode', b.dataset.mm); api.ui.refresh(); });
        const body = el.querySelector('#mu-body');
        if (mode === 'mosaic') renderMosaic(body); else renderStrokes(body, api);
      }});
      function renderStrokes(el, api) {
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
      }
      api.commands.add({ title: 'Open the mural', run: api => api.ui.navigate('view-mural') });
      api.commands.add({ title: 'Mosaic: choose a new painting', run: api => { api.ui.navigate('view-mural'); setTimeout(picker, 300); } });
    }
  });
})();
