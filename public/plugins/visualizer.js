/* Visualizers for the shared player (user, 2026-11-16: "old school where you can choose different ones, in a mini
   window"). window.CadenceViz:
   - open() / close() / toggle(): a small window above the page (drag it by its top) with four old-school styles:
       Bars  (Winamp-style spectrum, green → yellow → amber, falling peak caps)
       Scope (green oscilloscope trace)
       VU    (two needle meters on a cream face)
       Ring  (a circular spectrum in your theme's colour)
       Waterfall (2026-11-17: a scrolling picture of the sound, low notes at the bottom)
       MilkDrop  (2026-11-17: Winamp's MilkDrop, through Butterchurn, MIT, vendored and loaded only when picked; a new
                  look every 30 seconds, blended; WebGL 2; not run when your device asks for reduced motion)
     "Pulse" (off by default): your theme gently pulses with the beat. It sets --beat (0–1) on the page; themes can use it.
     "Pop out" moves it into a real mini window that floats over other apps (Document Picture-in-Picture: Chrome, Edge).
   - mini(canvas): the little live bars inside the player itself.
   The sound comes from CadencePodcasts.analyser(): while a visualizer is on, the player plays everything through the
   NAS relay, because a browser can only analyse sound from its own server. */
(() => {
  'use strict';
  const P = () => window.CadencePodcasts;
  const MODES = [['bars', 'Bars'], ['scope', 'Scope'], ['vu', 'VU'], ['ring', 'Ring'], ['fall', 'Waterfall'], ['milk', 'MilkDrop']];
  const LS = 'cadence.viz.';
  const get = (k, d) => { try { const v = localStorage.getItem(LS + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} };
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let box = null, cv = null, mode = get('mode', 'bars'), raf = 0, pip = null, peaks = [], hold = [], vu = [0, 0];

  const CSS = `
  #pc-viz{position:fixed;z-index:41;width:420px;max-width:calc(100vw - 16px);height:236px;display:flex;flex-direction:column;border-radius:var(--r-l,12px);overflow:hidden;
    background:#0b0d0b;border:1px solid var(--line,#333);box-shadow:var(--shadow,0 10px 30px rgba(0,0,0,.35));font:12px/1.2 system-ui,sans-serif;color:#cfd6cf}
  #pc-viz[hidden]{display:none}
  #pc-viz .vz-top{display:flex;align-items:center;gap:1px;overflow-x:auto;scrollbar-width:none;padding:5px 6px;background:#161a16;cursor:grab;user-select:none;touch-action:none}
  #pc-viz .vz-top:active{cursor:grabbing}
  #pc-viz .vz-m{border:0;background:transparent;color:#8f998f;font:inherit;padding:3px 6px;white-space:nowrap;border-radius:999px;cursor:pointer}
  #pc-viz .vz-m:hover{color:#e6ece6}#pc-viz .vz-m.on{background:#2a312a;color:#e6ece6}
  #pc-viz .vz-sp{flex:1}
  #pc-viz .vz-b{display:inline-grid;place-items:center;width:24px;height:24px;border:0;border-radius:6px;background:transparent;color:#8f998f;cursor:pointer}
  #pc-viz .vz-b:hover{background:#2a312a;color:#e6ece6}#pc-viz .vz-b svg{width:14px;height:14px}
  #pc-viz canvas{flex:1;width:100%;min-height:0;display:block}#pc-viz canvas[hidden]{display:none}
  #pc-viz .vz-b.on{background:#2a312a;color:#e6ece6}#pc-viz .vz-b[hidden]{display:none}
  #pc-viz .vz-name{position:absolute;left:8px;bottom:6px;max-width:70%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:rgba(230,236,230,.55);font-size:10px;pointer-events:none}
  html.cz-pulse #pc-mini{box-shadow:0 0 calc(var(--beat,0) * 22px) color-mix(in srgb,var(--accent,#5b8) 55%,transparent)}
  html.cz-pulse .island,html.cz-pulse #island{box-shadow:0 0 calc(var(--beat,0) * 16px) color-mix(in srgb,var(--accent,#5b8) 45%,transparent)}
  #pc-viz .vz-note{position:absolute;left:0;right:0;bottom:8px;text-align:center;color:#8f998f;pointer-events:none;font-size:11px}
  body.vz-pip{margin:0;background:#0b0d0b}body.vz-pip #pc-viz{position:static;width:100vw;height:100vh;border:0;border-radius:0;box-shadow:none}`;
  const icon = n => (window.CadenceKit && CadenceKit.icon ? CadenceKit.icon(n) : '');

  function ensure() {
    if (box) return box;
    if (!document.getElementById('pc-viz-css')) { const s = document.createElement('style'); s.id = 'pc-viz-css'; s.textContent = CSS; document.head.appendChild(s); }
    box = document.createElement('div'); box.id = 'pc-viz'; box.hidden = true; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Visualizer');
    box.innerHTML = `<div class="vz-top">${MODES.map(([k, l]) => `<button class="vz-m" data-vz="${k}">${l}</button>`).join('')}<span class="vz-sp"></span>
      <button class="vz-b" data-vz-act="next" hidden title="Another look" aria-label="Another MilkDrop look">${icon('shuffle') || '»'}</button>
      <button class="vz-b${get('pulse', false) ? ' on' : ''}" data-vz-act="pulse" aria-pressed="${get('pulse', false)}" title="Let your theme pulse with the beat" aria-label="Let your theme pulse with the beat">${icon('activity') || '~'}</button>
      ${'documentPictureInPicture' in window ? `<button class="vz-b" data-vz-act="pip" title="Pop out into a mini window" aria-label="Pop out into a mini window">${icon('picture-in-picture-2') || '⧉'}</button>` : ''}
      <button class="vz-b" data-vz-act="close" title="Close" aria-label="Close the visualizer">${icon('x') || '×'}</button></div><canvas class="vz-2d"></canvas><canvas class="vz-gl" hidden></canvas><div class="vz-name" hidden></div><div class="vz-note" hidden></div>`;
    cv = box.querySelector('.vz-2d'); gl.cv = box.querySelector('.vz-gl');
    document.documentElement.appendChild(box);
    const pos = get('pos', null); place(pos ? pos.x : null, pos ? pos.y : null);
    box.addEventListener('click', e => {
      const m = e.target.closest('[data-vz]'); if (m) { mode = m.dataset.vz; set('mode', mode); peaks = []; hold = []; marks(); return; }
      const a = e.target.closest('[data-vz-act]'); if (!a) return;
      const act = a.dataset.vzAct;
      if (act === 'close') close(); else if (act === 'pip') popOut(); else if (act === 'next') milkNext(2.7);
      else if (act === 'pulse') { const on = !get('pulse', false); set('pulse', on); a.classList.toggle('on', on); a.setAttribute('aria-pressed', on); if (on) { const p = P(); if (p) { p.setViz(true); p.analyser(); } } pulseLoop(); }
    });
    // drag by the top strip (not inside the mini window: the system moves that)
    const top = box.querySelector('.vz-top');
    top.addEventListener('pointerdown', e => {
      if (pip || e.target.closest('button')) return;
      const r = box.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      top.setPointerCapture(e.pointerId);
      const mv = ev => place(ev.clientX - dx, ev.clientY - dy), up = () => { top.removeEventListener('pointermove', mv); top.removeEventListener('pointerup', up); const b = box.getBoundingClientRect(); set('pos', { x: b.left, y: b.top }); };
      top.addEventListener('pointermove', mv); top.addEventListener('pointerup', up);
    });
    addEventListener('resize', () => { if (!pip) { const b = box.getBoundingClientRect(); place(b.left, b.top); } });
    marks();
    return box;
  }
  function place(x, y) {
    const r = box.getBoundingClientRect(), w = r.width || 420, h = r.height || 236, W = innerWidth, H = innerHeight;
    if (x == null) { x = W - w - 20; y = H - h - 96; }   // above the player, on the right
    box.style.left = Math.max(8, Math.min(W - w - 8, x)) + 'px'; box.style.top = Math.max(8, Math.min(H - h - 8, y)) + 'px';
  }
  const marks = () => box && box.querySelectorAll('[data-vz]').forEach(b => { b.classList.toggle('on', b.dataset.vz === mode); b.setAttribute('aria-pressed', b.dataset.vz === mode); });
  const note = t => { const n = box && box.querySelector('.vz-note'); if (n) { n.hidden = !t; n.textContent = t || ''; } };

  function open() {
    const p = P(); if (!p) return;
    p.setViz(true); ensure(); box.hidden = false; set('open', true);
    p.analyser();   // a click started this: the sound engine may start now
    loop();
  }
  function close() {
    if (pip) { try { pip.close(); } catch (e) {} }
    if (box) box.hidden = true; set('open', false); cancel();
  }
  const isOpen = () => !!box && !box.hidden;
  const toggle = () => (isOpen() ? close() : open());

  async function popOut() {
    if (pip || !('documentPictureInPicture' in window)) return;
    try {
      pip = await documentPictureInPicture.requestWindow({ width: 360, height: 230 });
      const s = pip.document.createElement('style'); s.textContent = CSS + ':root{color-scheme:dark}'; pip.document.head.appendChild(s);
      pip.document.title = 'THING visualizer'; pip.document.body.className = 'vz-pip';
      pip.document.body.appendChild(box); box.querySelector('[data-vz-act="pip"]').hidden = true;
      cancel(); loop();
      pip.addEventListener('pagehide', () => { document.documentElement.appendChild(box); box.querySelector('[data-vz-act="pip"]').hidden = false; pip = null; place(null, null); cancel(); if (isOpen()) loop(); });
    } catch (e) { pip = null; }
  }

  // ---- drawing ----
  const frame = f => (pip ? pip.requestAnimationFrame(f) : requestAnimationFrame(f));
  const cancel = () => { if (raf) { (pip || window).cancelAnimationFrame(raf); raf = 0; } };
  function loop() {
    cancel();
    const tick = () => { raf = 0; if (!isOpen()) return; draw(); raf = frame(tick); };
    raf = frame(tick);
  }
  function size(c) {
    const d = (pip ? pip.devicePixelRatio : devicePixelRatio) || 1, w = Math.max(1, c.clientWidth), h = Math.max(1, c.clientHeight);
    if (c.width !== Math.round(w * d) || c.height !== Math.round(h * d)) { c.width = Math.round(w * d); c.height = Math.round(h * d); }
    const g = c.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); return [g, w, h];
  }
  // the sound right now: frequency bands (0–1) and the wave, or nothing when paused / not available
  const buf = { f: null, t: null, l: null, r: null };
  function sound() {
    const p = P(), a = p && p.viz && p.analyser && p.analyser();
    if (!a || !a.an || p.audio.paused) return null;
    const n = a.an.frequencyBinCount;
    if (!buf.f || buf.f.length !== n) { buf.f = new Uint8Array(n); buf.t = new Uint8Array(a.an.fftSize); buf.l = new Uint8Array(a.anL.fftSize); buf.r = new Uint8Array(a.anR.fftSize); }
    a.an.getByteFrequencyData(buf.f); a.an.getByteTimeDomainData(buf.t); a.anL.getByteTimeDomainData(buf.l); a.anR.getByteTimeDomainData(buf.r);
    return { f: buf.f, t: buf.t, l: buf.l, r: buf.r, rate: a.ctx.sampleRate };
  }
  // n bands on a log scale from 40 Hz to 16 kHz
  function bands(s, n) {
    const out = new Array(n).fill(0); if (!s) return out;
    const hz = s.rate / 2 / s.f.length, lo = Math.log(40), hi = Math.log(16000);
    for (let i = 0; i < n; i++) {
      const a = Math.max(1, Math.floor(Math.exp(lo + (hi - lo) * i / n) / hz)), b = Math.max(a + 1, Math.floor(Math.exp(lo + (hi - lo) * (i + 1) / n) / hz));
      let m = 0; for (let j = a; j < b && j < s.f.length; j++) m = Math.max(m, s.f[j]);
      out[i] = m / 255;
    }
    return out;
  }
  const rms = w => { if (!w) return 0; let s = 0; for (let i = 0; i < w.length; i++) { const v = (w[i] - 128) / 128; s += v * v; } return Math.sqrt(s / w.length); };
  const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#5b8';

  function draw() {
    const milk = mode === 'milk'; cv.hidden = milk; gl.cv.hidden = !milk;
    box.querySelector('[data-vz-act="next"]').hidden = !milk; box.querySelector('.vz-name').hidden = !milk || !gl.name;
    const p = P();
    if (milk) return milkDraw(p);
    const s = sound(), [g, w, h] = size(cv);
    note(!p || !p.current ? 'Play something to see it here' : p.audio.paused ? 'Paused' : !s ? 'Starting…' : '');
    ({ bars, scope, vu: meters, ring, fall })[mode](g, w, h, s);
  }
  // ---- Waterfall: each frame a new column on the right, older sound drifts left; quiet is dark, loud is your accent ----
  const fallBuf = { c: null, pal: null, acc: '' };
  function fall(g, w, h, s) {
    const d = (pip ? pip.devicePixelRatio : devicePixelRatio) || 1, W = Math.round(w * d), H = Math.round(h * d);
    let b = fallBuf.c; if (!b || b.width !== W || b.height !== H) { b = fallBuf.c = document.createElement('canvas'); b.width = W; b.height = H; const x = b.getContext('2d'); x.fillStyle = '#05070a'; x.fillRect(0, 0, W, H); }
    const acc = accent(); if (fallBuf.acc !== acc) { fallBuf.acc = acc; fallBuf.pal = palette(acc); }
    const step = Math.max(1, Math.round(d * (reduce() ? 0.5 : 1.5)));
    if (s) {
      // shift through a second canvas (drawing a canvas onto itself isn't dependable), then swap them
      let t = fallBuf.t; if (!t || t.width !== W || t.height !== H) { t = fallBuf.t = document.createElement('canvas'); t.width = W; t.height = H; }
      const tx = t.getContext('2d'); tx.fillStyle = '#05070a'; tx.fillRect(W - step, 0, step, H); tx.drawImage(b, -step, 0);
      fallBuf.t = b; fallBuf.c = b = t;
    }
    const x = b.getContext('2d');
    if (s) {
      const rows = Math.min(160, Math.round(h)), v = bands(s, rows), rh = H / rows;
      for (let i = 0; i < rows; i++) { x.fillStyle = fallBuf.pal[Math.min(255, Math.round(Math.pow(v[i], 1.3) * 255))]; x.fillRect(W - step, H - (i + 1) * rh, step, Math.ceil(rh)); }
    }
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(b, 0, 0); g.setTransform(d, 0, 0, d, 0, 0);
  }
  // dark blue-black → deep teal → your accent → soft cream: 256 steps
  function palette(acc) {
    const hex = c => { const m = String(c).match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i); if (!m) return [85, 187, 136]; let h = m[1]; if (h.length === 3) h = h.replace(/./g, '$&$&'); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
    const stops = [[0, [5, 7, 10]], [0.35, [14, 60, 70]], [0.75, hex(acc)], [1, [246, 236, 210]]], out = [];
    for (let i = 0; i < 256; i++) { const t = i / 255; let k = 0; while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
      const [t0, c0] = stops[k], [t1, c1] = stops[k + 1], f = (t - t0) / (t1 - t0); out.push(`rgb(${c0.map((v, j) => Math.round(v + (c1[j] - v) * f)).join(',')})`); }
    return out;
  }

  // ---- MilkDrop, through Butterchurn: scripts load the first time it's picked ----
  const gl = { cv: null, viz: null, loading: null, names: [], presets: null, name: '', at: 0, w: 0, h: 0, ctx: null, failed: '' };
  const loadScript = src => new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = src; sc.onload = ok; sc.onerror = () => no(new Error('could not load ' + src)); document.head.appendChild(sc); });
  function milkLoad() {
    if (!gl.loading) gl.loading = (async () => {
      if (!window.butterchurn) await loadScript('vendor/butterchurn/butterchurn.min.js');
      if (!window.butterchurnPresets) await loadScript('vendor/butterchurn/butterchurnPresets.min.js');
      const bp = window.butterchurnPresets.default || window.butterchurnPresets;
      gl.presets = bp.getPresets ? bp.getPresets() : bp; gl.names = Object.keys(gl.presets);
    })().catch(e => { gl.failed = 'MilkDrop could not load. Try another style.'; gl.loading = null; throw e; });
    return gl.loading;
  }
  function milkNext(blend) {
    if (!gl.viz || !gl.names.length) return;
    let n; do { n = gl.names[Math.floor(Math.random() * gl.names.length)]; } while (gl.names.length > 1 && n === gl.name);
    gl.name = n; gl.at = performance.now(); gl.viz.loadPreset(gl.presets[n], blend);
    const el = box.querySelector('.vz-name'); el.textContent = n; el.hidden = false;
  }
  function milkDraw(p) {
    if (reduce()) return note('MilkDrop is off while your device asks for reduced motion');
    // asked once: every test context counts against the browser's limit, and too many knock out MilkDrop's own
    if (gl.webgl2 == null) gl.webgl2 = (() => { try { const c = document.createElement('canvas'), x = c.getContext('webgl2'); if (x) { const l = x.getExtension('WEBGL_lose_context'); if (l) l.loseContext(); } return !!x; } catch (e) { return false; } })();
    if (!gl.webgl2) return note("This browser can't show MilkDrop (it needs WebGL 2)");
    if (gl.failed) return note(gl.failed);
    const a = p && p.viz && p.analyser && p.analyser();
    if (!p || !p.current) return note('Play something to see it here');
    if (!gl.presets) { note('Loading MilkDrop…'); milkLoad().catch(() => {}); return; }
    if (!a) return note('Starting…');
    const d = (pip ? pip.devicePixelRatio : devicePixelRatio) || 1, w = Math.max(1, Math.round(gl.cv.clientWidth * d)), h = Math.max(1, Math.round(gl.cv.clientHeight * d));
    if (!gl.viz || gl.ctx !== a.ctx) {
      const B = window.butterchurn.default || window.butterchurn;
      gl.cv.width = w; gl.cv.height = h;
      try { gl.viz = B.createVisualizer(a.ctx, gl.cv, { width: w, height: h, pixelRatio: 1 }); gl.viz.connectAudio(a.an); gl.ctx = a.ctx; gl.w = w; gl.h = h; milkNext(0); }
      catch (e) { gl.failed = "MilkDrop couldn't start here."; console.warn('milkdrop', e); return; }
    }
    if (w !== gl.w || h !== gl.h) { gl.cv.width = w; gl.cv.height = h; gl.viz.setRendererSize(w, h); gl.w = w; gl.h = h; }
    note(p.audio.paused ? 'Paused' : '');
    if (!p.audio.paused && performance.now() - gl.at > 30000) milkNext(2.7);
    gl.viz.render();
  }

  // ---- Pulse: a gentle glow on the beat (off by default; never with reduced motion) ----
  // Bass energy against its own recent average; a beat sets --beat to 1, then it fades. About 30 times a second,
  // only while something plays and the tab is showing.
  let pulseRaf = 0, beat = 0, avg = 0, lastBeat = 0;
  function pulseLoop() {
    if (pulseRaf) return;
    const root = document.documentElement;
    const tick = () => {
      pulseRaf = 0;
      const on = get('pulse', false) && !reduce();
      root.classList.toggle('cz-pulse', on);
      if (!on) { root.style.removeProperty('--beat'); return; }
      const s = !document.hidden ? sound() : null;
      if (s) {
        const b = bands(s, 24), e = (b[0] + b[1] + b[2] + b[3]) / 4, now = performance.now();
        avg = avg ? avg * 0.94 + e * 0.06 : e;
        if (e > 0.3 && e > avg * 1.25 && now - lastBeat > 280) { beat = 1; lastBeat = now; }
      }
      beat *= 0.86; root.style.setProperty('--beat', beat.toFixed(3));
      pulseRaf = setTimeout(() => requestAnimationFrame(tick), 33);
    };
    pulseRaf = setTimeout(tick, 0);
  }
  if (get('pulse', false)) setTimeout(pulseLoop, 1500);
  // Winamp-ish: segmented bars, green → yellow → amber (no alarming red), peak caps that hang then fall
  function bars(g, w, h, s) {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const n = 28, gap = 2, bw = (w - 12 - gap * (n - 1)) / n, b = bands(s, n), top = 8, bottom = h - 8, H = bottom - top;
    const grad = g.createLinearGradient(0, bottom, 0, top); grad.addColorStop(0, '#1fbf3a'); grad.addColorStop(.55, '#d8d21c'); grad.addColorStop(1, '#e8902a');
    for (let i = 0; i < n; i++) {
      const v = Math.pow(b[i], 1.4), x = 6 + i * (bw + gap), bh = v * H;
      g.fillStyle = grad; g.fillRect(x, bottom - bh, bw, bh);
      // the segment lines
      g.fillStyle = '#000'; for (let y = bottom - 3; y > bottom - bh; y -= 4) g.fillRect(x, y, bw, 1);
      if (peaks[i] == null || bh >= peaks[i]) { peaks[i] = bh; hold[i] = 18; } else if (hold[i] > 0) hold[i]--; else peaks[i] = Math.max(0, peaks[i] - (reduce() ? H : 1.6));
      g.fillStyle = '#d9dfd9'; g.fillRect(x, bottom - peaks[i] - 2, bw, 2);
    }
  }
  // phosphor oscilloscope on a faint grid
  function scope(g, w, h, s) {
    g.fillStyle = '#021006'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(80,255,140,.08)'; g.lineWidth = 1;
    for (let x = 0; x <= w; x += w / 10) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += h / 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.strokeStyle = '#46ff7e'; g.lineWidth = 1.6; g.shadowColor = '#46ff7e'; g.shadowBlur = 8; g.beginPath();
    const t = s && s.t, n = t ? t.length : 2;
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * w, y = h / 2 + (t ? (t[i] - 128) / 128 : 0) * (h / 2 - 8); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke(); g.shadowBlur = 0;
  }
  // two VU meters: cream face, black needle, amber past 0 dB; the needle rises fast and settles slowly, like the real thing
  function meters(g, w, h, s) {
    g.fillStyle = '#1b1712'; g.fillRect(0, 0, w, h);
    let L = rms(s && s.l), R = rms(s && s.r); if (s && R < 0.0005 && L > 0.002) R = L;   // a mono station: both needles move
    const lv = [L, R].map(v => (v > 0 ? Math.max(0, Math.min(1, (20 * Math.log10(v) + 26) / 29)) : 0));
    for (let i = 0; i < 2; i++) { const k = lv[i] > vu[i] ? 0.35 : 0.06; vu[i] += (lv[i] - vu[i]) * (reduce() ? 1 : k); }
    const mw = (w - 18) / 2;
    for (let i = 0; i < 2; i++) {
      const x0 = 6 + i * (mw + 6), y0 = 6, mh = h - 12, cx = x0 + mw / 2, cy = y0 + mh * 0.95, r = Math.min(mw * 0.55, mh * 0.8);
      g.fillStyle = '#efe5c8'; g.beginPath(); g.roundRect ? g.roundRect(x0, y0, mw, mh, 6) : g.rect(x0, y0, mw, mh); g.fill();
      const a0 = Math.PI * 1.22, a1 = Math.PI * 1.78, red = a0 + (a1 - a0) * (26 / 29);
      g.lineWidth = 2; g.strokeStyle = '#222'; g.beginPath(); g.arc(cx, cy, r, a0, red); g.stroke();
      g.strokeStyle = '#d4892a'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r, red, a1); g.stroke();
      g.fillStyle = '#222'; g.font = '10px system-ui'; g.textAlign = 'center';
      for (const [db, lab] of [[-20, '20'], [-10, '10'], [-5, '5'], [0, '0'], [3, '+3']]) {
        const a = a0 + (a1 - a0) * ((db + 26) / 29), x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        g.beginPath(); g.moveTo(x, y); g.lineTo(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6)); g.stroke(); g.fillText(lab, cx + Math.cos(a) * (r - 14), cy + Math.sin(a) * (r - 14) + 3);
      }
      g.font = 'bold 11px system-ui'; g.fillText('VU', cx, cy - r * 0.35); g.font = '10px system-ui'; g.fillText(i ? 'R' : 'L', x0 + 10, y0 + mh - 8);
      const a = a0 + (a1 - a0) * vu[i];
      g.strokeStyle = '#111'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (r + 4), cy + Math.sin(a) * (r + 4)); g.stroke();
      g.fillStyle = '#111'; g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fill();
    }
  }
  // a circle of bars in your theme's colour
  function ring(g, w, h, s) {
    g.fillStyle = '#07080d'; g.fillRect(0, 0, w, h);
    const n = 64, b = bands(s, n), cx = w / 2, cy = h / 2, r0 = Math.min(w, h) * 0.22, len = Math.min(w, h) * 0.26, c = accent();
    g.strokeStyle = c; g.lineCap = 'round'; g.lineWidth = Math.max(2, (2 * Math.PI * r0) / n * 0.55);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2, v = 2 + Math.pow(b[i], 1.5) * len;
      g.globalAlpha = 0.45 + b[i] * 0.55; g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * (r0 + v), cy + Math.sin(a) * (r0 + v)); g.stroke();
    }
    g.globalAlpha = 1; const bass = b.slice(0, 6).reduce((x, y) => x + y, 0) / 6;
    g.fillStyle = c; g.globalAlpha = 0.18 + bass * 0.3; g.beginPath(); g.arc(cx, cy, r0 * (0.75 + bass * 0.2), 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
  }

  // the little live bars in the player: theme colour, quiet when nothing is playing
  const minis = new Set();
  function mini(c) {
    if (minis.has(c)) return; minis.add(c);
    const tick = () => {
      if (!c.isConnected) { minis.delete(c); return; }
      if (c.dataset.style === 'classic') { classicMini(c); if (sound() && !reduce()) requestAnimationFrame(tick); else setTimeout(tick, 400); return; }
      const [g, w, h] = size(c), s = sound(), n = 7, b = bands(s, n), col = accent();
      g.clearRect(0, 0, w, h); g.fillStyle = col;
      const bw = (w - (n - 1) * 3) / n;
      for (let i = 0; i < n; i++) { const v = s ? Math.max(0.12, Math.pow(b[i], 1.2)) : [0.35, 0.6, 0.45, 0.8, 0.5, 0.65, 0.4][i] * 0.5, bh = v * h; g.globalAlpha = s ? 1 : 0.45; g.fillRect(i * (bw + 3), h - bh, bw, bh); }
      g.globalAlpha = 1;
      if (s && !reduce()) requestAnimationFrame(tick); else setTimeout(tick, 400);
    };
    tick();
  }

  // the Classic player's own little analyser: black, green → yellow → amber bars with peak caps, a flat line when quiet
  const mpk = new WeakMap();
  function classicMini(c) {
    const [g, w, h] = size(c), s = sound(), n = 19, b = bands(s, n), gap = 1, bw = (w - gap * (n - 1)) / n;
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    if (!s) { g.fillStyle = '#1d6b2a'; g.fillRect(0, h - 1, w, 1); return; }
    const grad = g.createLinearGradient(0, h, 0, 0); grad.addColorStop(0, '#1fbf3a'); grad.addColorStop(.6, '#d8d21c'); grad.addColorStop(1, '#e8902a');
    const pk = mpk.get(c) || []; mpk.set(c, pk);
    for (let i = 0; i < n; i++) {
      const bh = Math.round(Math.pow(b[i], 1.3) * (h - 2)), x = i * (bw + gap);
      g.fillStyle = grad; g.fillRect(x, h - bh, bw, bh);
      pk[i] = Math.max(bh, (pk[i] || 0) - (reduce() ? h : 0.5));
      g.fillStyle = '#c9cfd6'; g.fillRect(x, h - pk[i] - 1, bw, 1);
    }
  }
  window.CadenceViz = { open, close, toggle, mini, get isOpen() { return isOpen(); } };
  // reopen where you left it (it starts drawing once something plays)
  if (get('open', false)) addEventListener('load', () => { const p = P(); if (p && p.current) { ensure(); box.hidden = false; loop(); } });
})();
