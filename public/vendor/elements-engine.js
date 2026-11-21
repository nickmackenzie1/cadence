/* Elements — Nick's falling-sand engine (Ember & Frost v5) in Cadence.
   The simulation lives in vendor/elements-core.js and runs in a Web Worker (on the page if workers are blocked).
   This file is the page side: it reads the screen into cells, draws the engine's frames with one WebGL pass,
   blows snowflakes through the air until they land as real snow, and gives Cadence two kinds of world:

     ElementsWorld.create({ kind: 'havoc' })   the interactive overlay: the page itself becomes matter; toolbar; Esc closes
     ElementsWorld.create({ kind: 'ambient' }) a see-through layer that ignores the mouse; cards, buttons and headings
                                               are invisible ledges. Christmas, typing fire, the sand jar and the weather
                                               share one of these (CadenceFX in core.js).

   Untouched parts of the page aren't drawn at all: the real page shows through, so text stays perfectly sharp.
   Only cells that something has touched (burnt, melted, knocked loose) become pixels. */
(() => {
  'use strict';
  if (window.ElementsWorld) return;
  const R = Math.random;
  const M = { E: 0, SAND: 1, WATER: 2, ICE: 3, FIRE: 4, WOOD: 5, STEAM: 6, STONE: 7, OIL: 8, LAVA: 9, EMBER: 10, ASH: 11, SMOKE: 12, SNOW: 13,
    PAGE: 14, GLASS: 15, WIRE: 16, BULB: 17, PLANT: 18, ACID: 19, FUME: 20, POWDER: 21, BOLT: 22, SURF: 23, PIXEL: 24, DRIP: 25, KELP: 26, PAD: 27, FIREWORK: 30, LIGHTNING: 31 };
  const { E, SAND, WATER, ICE, FIRE, WOOD, STEAM, STONE, OIL, LAVA, SNOW, PLANT, ACID, POWDER, FIREWORK, LIGHTNING } = M;
  const here = (document.currentScript && document.currentScript.src) || new URL('vendor/elements-engine.js', location.href).href;
  const CORE = here.replace(/elements-engine\.js(\?.*)?$/, 'elements-core.js$1');

  /* ---------------------------------------------------------------- compositor (Nick's): one WebGL pass, 2D fallback */
  // Cadence: WebGL without a graphics card (SwiftShader, llvmpipe) is slower than plain 2D drawing, so use 2D there
  let softGL = null;
  function softwareGL() {
    if (softGL !== null) return softGL;
    try { const gl = document.createElement('canvas').getContext('webgl2'); const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info'); const who = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
      softGL = /swiftshader|llvmpipe|software|basic render/i.test(who); const lose = gl && gl.getExtension('WEBGL_lose_context'); lose && lose.loseContext(); } catch (e) { softGL = false; }
    return softGL;
  }
  function makeGL(canvas) {
    if (softwareGL()) return null;   // Cadence: decided on a spare canvas, since a canvas can't switch from WebGL to 2D later
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return null;
    const vs = `#version 300 es
      in vec2 p; out vec2 vUv;
      void main(){ vUv = vec2((p.x + 1.0) * 0.5, 1.0 - (p.y + 1.0) * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`;
    const fs = `#version 300 es
      precision mediump float;
      in vec2 vUv; out vec4 o;
      uniform sampler2D uBase, uLight, uOv, uHeat; uniform vec2 uSize; uniform float uGlow, uFlash, uHeatOn;
      void main(){
        vec4 b = texture(uBase, vUv);
        vec3 col = b.rgb * b.a; float a = b.a;
        ivec2 px = ivec2(min(vUv * uSize, uSize - 1.0));
        float mask = texelFetch(uLight, px, 0).a;              // 1 where the real page shows through untouched
        vec4 ov = texture(uOv, vUv); float oa = ov.a * mask;   // light and shadow over the real page
        col = col * (1.0 - oa) + ov.rgb * oa; a = a + oa * (1.0 - a);
        vec3 bl = textureLod(uLight, vUv, 1.0).rgb * 0.55 + textureLod(uLight, vUv, 2.0).rgb * 0.8
                + textureLod(uLight, vUv, 3.0).rgb * 1.6 + textureLod(uLight, vUv, 4.0).rgb * 0.5;
        col += bl * uGlow;                                      // glow, added on top
        if (uHeatOn > 0.5) { vec4 h = texture(uHeat, vUv); col = col * (1.0 - h.a) + h.rgb * h.a; a = a + h.a * (1.0 - a); }
        col += vec3(0.84, 0.88, 1.0) * uFlash * 0.55; a = max(a, uFlash * 0.55);
        o = vec4(min(col, vec3(1.0)), a);
      }`;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    try { gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog)); }
    catch (err) { console.warn('WebGL unavailable, using 2D drawing', err); return null; }
    gl.useProgram(prog);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = n => gl.getUniformLocation(prog, n);
    const uni = { base: U('uBase'), light: U('uLight'), ov: U('uOv'), heat: U('uHeat'), size: U('uSize'), glow: U('uGlow'), flash: U('uFlash'), heatOn: U('uHeatOn') };
    const mkTex = (unit, minF, magF) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minF); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magF);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    const tBase = mkTex(0, gl.NEAREST, gl.NEAREST), tLight = mkTex(1, gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR), tOv = mkTex(2, gl.LINEAR, gl.LINEAR), tHeat = mkTex(3, gl.LINEAR, gl.LINEAR);
    gl.uniform1i(uni.base, 0); gl.uniform1i(uni.light, 1); gl.uniform1i(uni.ov, 2); gl.uniform1i(uni.heat, 3);
    let W = 1, H = 1, HW = 1, HH = 1;
    const alloc = (unit, tex, w, h) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); };
    const up = (unit, tex, w, h, data) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data); };
    return {
      kind: 'webgl2',
      resize(w, h, hw, hh) { W = w; H = h; HW = hw; HH = hh; alloc(0, tBase, W, H); alloc(1, tLight, W, H); alloc(2, tOv, HW, HH); alloc(3, tHeat, HW, HH); },
      upload(b, heatOn) {
        up(0, tBase, W, H, new Uint8Array(b.buf));
        up(1, tLight, W, H, new Uint8Array(b.lbuf)); gl.generateMipmap(gl.TEXTURE_2D);
        up(2, tOv, HW, HH, new Uint8Array(b.ov));
        if (heatOn) up(3, tHeat, HW, HH, new Uint8Array(b.heat));
      },
      draw(p) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(uni.size, W, H); gl.uniform1f(uni.glow, p.glow); gl.uniform1f(uni.flash, p.flash); gl.uniform1f(uni.heatOn, p.heatOn ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    };
  }
  function make2D(canvas) {
    const ctx = canvas.getContext('2d');
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };
    let W, H, HW, HH, base, bx, light, lx, l1, l2, l3, heatC, hx, bImg, lImg, hImg;
    return {
      kind: '2d',
      resize(w, h, hw, hh) {
        W = w; H = h; HW = hw; HH = hh;
        base = mk(W, H); bx = base.getContext('2d'); bImg = bx.createImageData(W, H);
        light = mk(W, H); lx = light.getContext('2d'); lImg = lx.createImageData(W, H);
        l1 = mk(W >> 1, H >> 1); l2 = mk(W >> 2, H >> 2); l3 = mk(W >> 3, H >> 3);
        heatC = mk(HW, HH); hx = heatC.getContext('2d'); hImg = hx.createImageData(HW, HH);
      },
      upload(b, heatOn) {
        bImg.data.set(new Uint8Array(b.buf)); bx.putImageData(bImg, 0, 0);
        const src = new Uint32Array(b.lbuf), dst = new Uint32Array(lImg.data.buffer);
        for (let i = 0; i < src.length; i++) { const v = src[i] & 0xffffff; dst[i] = v ? (v | 0xff000000) >>> 0 : 0; }
        lx.putImageData(lImg, 0, 0);
        if (heatOn) { hImg.data.set(new Uint8Array(b.heat)); hx.putImageData(hImg, 0, 0); }
      },
      draw(p) {
        const DW = canvas.width, DH = canvas.height;
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.clearRect(0, 0, DW, DH);
        ctx.imageSmoothingEnabled = false; ctx.drawImage(base, 0, 0, DW, DH);
        if (p.glow > 0) {
          const c1 = l1.getContext('2d'), c2 = l2.getContext('2d'), c3 = l3.getContext('2d');
          c1.clearRect(0, 0, l1.width, l1.height); c1.drawImage(light, 0, 0, l1.width, l1.height);
          c2.clearRect(0, 0, l2.width, l2.height); c2.drawImage(l1, 0, 0, l2.width, l2.height);
          c3.clearRect(0, 0, l3.width, l3.height); c3.drawImage(l2, 0, 0, l3.width, l3.height);
          ctx.imageSmoothingEnabled = true; ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.55 * p.glow; ctx.drawImage(l1, 0, 0, DW, DH);
          ctx.globalAlpha = 0.8 * p.glow; ctx.drawImage(l2, 0, 0, DW, DH);
          ctx.globalAlpha = 1.6 * p.glow > 1 ? 1 : 1.6 * p.glow; ctx.drawImage(l3, 0, 0, DW, DH);
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        }
        if (p.heatOn) { ctx.imageSmoothingEnabled = true; ctx.drawImage(heatC, 0, 0, DW, DH); }
        if (p.flash > 0.01) { ctx.fillStyle = `rgba(215,225,255,${p.flash * 0.55})`; ctx.fillRect(0, 0, DW, DH); }
      }
    };
  }

  /* ---------------------------------------------------------------- snowflakes in the air (Nick's sprites) */
  const sprite = (size, draw) => { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); return c; };
  const SOFT = sprite(32, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.45, 'rgba(255,255,255,.85)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); });
  const BOKEH = sprite(64, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, s * .1, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,.55)'); r.addColorStop(.7, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); });
  const crystal = v => sprite(48, (g, s) => { g.translate(s / 2, s / 2); g.strokeStyle = '#fff'; g.lineCap = 'round'; g.shadowColor = 'rgba(160,190,230,.9)'; g.shadowBlur = 2;
    for (let a = 0; a < 6; a++) { g.save(); g.rotate(a * Math.PI / 3); g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -20); g.stroke(); g.lineWidth = 1.4;
      const br = v === 0 ? [[-8, 5], [-14, 4]] : v === 1 ? [[-6, 6], [-11, 5], [-16, 3]] : [[-10, 7], [-16, 3]];
      for (const [y, l] of br) { g.beginPath(); g.moveTo(0, y); g.lineTo(-l, y - l * .8); g.moveTo(0, y); g.lineTo(l, y - l * .8); g.stroke(); }
      g.restore(); }
    g.beginPath(); g.arc(0, 0, 2.2, 0, 6.28); g.fillStyle = '#fff'; g.fill(); });
  const CRYS = [crystal(0), crystal(1), crystal(2)];

  /* ---------------------------------------------------------------- quiet sound, off by default (Nick's) */
  const Sound = {
    ctx: null, master: null, noise: null, on: false, level: 0,
    enable() {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
      if (!this.ctx) {
        this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0.22; this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 2, nb = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = nb.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = R() * 2 - 1;
        this.noise = nb;
      }
      this.ctx.resume(); this.on = true; return true;
    },
    disable() { this.on = false; if (this.ctx) this.ctx.suspend(); },
    hit(dur, freq, q, vol, delay = 0, type = 'bandpass', attack = 0.004) {
      if (!this.on) return;
      const c = this.ctx, t0 = c.currentTime + delay;
      const src = c.createBufferSource(); src.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t0, R() * 1.5); src.stop(t0 + dur + 0.05);
    },
    tone(f0, f1, dur, vol, delay = 0, type = 'sine') {
      if (!this.on) return;
      const c = this.ctx, t0 = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.05);
    },
    fire(n) { this.level = Math.min(1, n / 500); },
    tickFire() { if (this.on && this.level > 0.01 && R() < this.level * 0.7) this.hit(0.03 + R() * 0.03, 1200 + R() * 3500, 3, 0.04 + this.level * 0.12); },
    event(ev) {
      if (!this.on) return;
      switch (ev[0]) {
        case 'strike': { const d = 0.25 + R() * 1.2; this.hit(0.25, 3000, 0.7, 0.5, 0, 'highpass'); this.hit(2.8, 120, 0.8, 0.9, d, 'lowpass', 0.08); this.hit(1.6, 300, 1, 0.35, d + 0.3, 'lowpass', 0.2); break; }
        case 'launch': this.tone(500, 1700, 0.7, 0.035, 0, 'sine'); this.hit(0.6, 4000, 1, 0.05, 0, 'highpass', 0.05); break;
        case 'burst': this.hit(0.5, 900, 0.8, 0.45, 0, 'lowpass'); for (let k = 0; k < 10; k++) this.hit(0.04, 2500 + R() * 3000, 4, 0.08, 0.15 + R() * 0.9); break;
        case 'explode': this.hit(0.9, 220, 0.7, 0.7, 0, 'lowpass'); this.tone(90, 35, 0.6, 0.35, 0, 'sine'); break;
        case 'crack': this.hit(0.12, 1800, 2, 0.25); break;
        case 'land': if (ev[1] > 300) this.hit(0.25, 260, 1, 0.3, 0, 'lowpass'); break;
      }
    }
  };

  function createWorld(cfg = {}) {
    // one world now: the page's ambient layer (snow, rain, Havoc's matter). The full-screen sandbox that read the whole
    // page into matter was folded into Havoc on 2026-11-20 (its extras are Havoc's Materials and Weather drawer).
    const AMBIENT = true;
    const DPR = Math.min(2, devicePixelRatio || 1);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let CELL = cfg.cell || (innerWidth < 700 ? 3 : 2);
    let W = 0, H = 0, HW = 0, HH = 0, gen = 0, ready = false, busy = false, bufs = null, pending = false, lastFrame = null, lastSent = 0;
    let solidCopy = new Uint8Array(0), comp = null, inputQ = [], lightsBottom = 0, sleeping = false, idleFrames = 0, engineWind = 0.3, port = null;
    let host = null, root = null, cv = null, airCv = null, ax = null, raf = 0, flakes = [];
    const S = { tool: FIRE, brush: 6, glow: 1, snowing: false, storm: false, heatView: false, sharp: true, paused: false, snowEverywhere: !AMBIENT ? false : true,
      lightMode: 0, windBase: 0.3, lights: !AMBIENT, palette: 'classic', compact: AMBIENT, rain: 0, floor: !AMBIENT, sound: false };
    const api = { active: false, stats: null, toggle() { api.active ? stop() : start(); } };
    const statsWaiters = [], countWaiters = new Map(); let countId = 0;

    /* ---------------- the engine: a worker, or on the page ---------------- */
    /* Sleeping (2026-11-18, ambient layer only): with nothing falling, burning or lit and nothing waiting to be sent, the
       loop stops asking for frames after about half a second, instead of running at 60 frames a second forever (that
       kept a quarter of a CPU core busy on an idle page). Anything that could need a frame wakes it: something asked of
       the world (spawn, heat, snow, rain, lights…), the page changing or scrolling, the engine's reply, the tab coming back. */
    const q = (...items) => { inputQ.push(...items); wake(); };
    function wake() {
      if (!AMBIENT || !sleeping || !api.active) return;
      sleeping = false; idleFrames = performance.now(); lastT = idleFrames;
      raf = requestAnimationFrame(loop);
    }
    function startEngine() {
      return new Promise(resolve => {
        const onPage = () => {
          const go = () => { let handler = null; window.ElementsENGINE({ post: m => setTimeout(() => onEngine(m)), on: fn => { handler = fn; } }); port = { post: m => setTimeout(() => handler && handler(m)), worker: false, kill() {} }; resolve(); };
          if (window.ElementsENGINE) return go();
          const s = document.createElement('script'); s.src = CORE; s.onload = go; s.onerror = () => resolve(); document.head.appendChild(s);
        };
        try {
          const wk = new Worker(CORE); let ok = false;
          // any first message means the worker is running (a stats probe before init answers with an error, which is fine)
          wk.onmessage = e => { if (!ok) { ok = true; clearTimeout(probe); resolve(); if (e.data && e.data.t === 'error') return; } onEngine(e.data); };
          wk.onerror = e => { if (!ok) { clearTimeout(probe); wk.terminate(); onPage(); } else console.error('Elements engine:', e.message); };
          port = { post: (m, t) => wk.postMessage(m, t || []), worker: true, kill() { wk.terminate(); } };
          const probe = setTimeout(() => { if (!ok) { wk.terminate(); onPage(); } }, 3000);   // never answered: run on the page
          wk.postMessage({ t: 'stats' });
        } catch (err) { onPage(); }
      });
    }
    const setOpt = (key, value) => { S[key] = value; if (port) port.post({ t: 'opt', key, value }); wake(); };

    /* ---------------- read the screen into cells (havoc), or an empty world (ambient) ---------------- */
    // computed colours come as rgb()/rgba() or, from color-mix(), as color(srgb r g b / a) with 0–1 channels
    function parseColor(s) {
      const m = String(s).match(/[\d.]+/g) || [0, 0, 0, 0];
      if (/^color\(/.test(s)) return [m[0] * 255, m[1] * 255, m[2] * 255, m[3] === undefined ? 1 : +m[3]];
      return [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]];
    }
    // the part of an element you can actually see: inside the window and inside every scrolling/clipping ancestor
    const ours = el => el && el.closest && el.closest('#elements-host, #elements-ambient, #havoc-host');

    let run = 0;   // bumped on every start and stop, so callbacks from a closed run do nothing

    async function rasterize(my) {
      W = Math.ceil(innerWidth / CELL); H = Math.ceil(innerHeight / CELL); const N = W * H;
      const grid = new Uint8Array(N), colR = new Uint8Array(N), colG = new Uint8Array(N), colB = new Uint8Array(N);
      const owner = new Uint16Array(N), layer = new Uint8Array(N), boxOf = new Uint16Array(N);
      const els = [], boxCol = [[0, 0, 0]];
      // the backdrop: the page's own background colour
      const pick = el => { const c = parseColor(getComputedStyle(el).backgroundColor); return c[3] > 0.5 ? c : null; };
      let found = null; for (let e = document.elementFromPoint(innerWidth * 0.6, innerHeight * 0.5); e && !found; e = e.parentElement) found = pick(e);
      const bodyBg = (found || pick(document.body) || pick(document.documentElement) || [255, 255, 255]).slice(0, 3);
      const L = { W, H, N, grid, colR, colG, colB, owner, layer, boxOf, els, boxCol, bodyBg };
      return L;
    }
    // ambient: the page is invisible ground, like Havoc's: the top of every line of text and of everything solid-looking
    // (cards, buttons, fields, pictures, chips) is a ledge snow and rain rest on; sent to the engine as [x0, x1, y, …].
    // Read when the page changes (scroll, typing, a new view, resize), not on a timer.
    let ledgesDirty = true, ledgeMO = null, domLedges = [], extraLedges = [], extraDirty = false;
    const SOLIDISH = /^(IMG|SVG|INPUT|BUTTON|TEXTAREA|SELECT|CANVAS|VIDEO|HR)$/;
    function sendLedges() { extraDirty = false; q(['surf', ...domLedges, ...extraLedges]); }
    function ledges() {
      ledgesDirty = false;
      const out = [], seen = new Set(), add = (l, rt, t) => {
        if (rt - l < 6 || t < 2 * CELL || t >= innerHeight) return;
        const x0 = Math.max(0, Math.floor(l / CELL)), x1 = Math.min(W, Math.ceil(rt / CELL)), y = Math.round(t / CELL), k = y * 4096 + x0;   // round: the snow's underside lands on the edge, not a cell above it
        if (y < 2 || y >= H || seen.has(k)) return; seen.add(k); out.push(x0, x1, y);
      };
      if (cfg.ledges) { for (const el of document.querySelectorAll(cfg.ledges)) { const r = el.getBoundingClientRect(); add(r.left, r.right, r.top); } domLedges = out; sendLedges(); return; }
      // things that look solid
      let n = 0;
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, { acceptNode: el => (ours(el) || el.closest('#xm-string,#xm-glow,#xm-ring,.hp-mirror,.nav-scrim') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
      for (let el = walk.nextNode(); el && n < 1500; el = walk.nextNode()) {
        const r = el.getBoundingClientRect(); if (r.width < 10 || r.height < 6 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
        n++;
        if (SOLIDISH.test(el.tagName.toUpperCase())) { add(r.left, r.right, r.top); continue; }
        const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity < 0.2) continue;
        const bg = parseColor(cs.backgroundColor), bw = parseFloat(cs.borderTopWidth) || 0;
        if ((bg[3] > 0.15 && r.width < innerWidth * 0.9) || (bw >= 1 && cs.borderTopStyle !== 'none') || cs.backgroundImage !== 'none' && r.width < innerWidth * 0.9) add(r.left + 2, r.right - 2, r.top);
      }
      // every line of text: snow sits on the letters
      const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: t => (/\S/.test(t.nodeValue) && t.parentElement && !ours(t.parentElement) && !t.parentElement.closest('script,style,#xm-string,.hp-mirror') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
      const range = document.createRange(); let m = 0;
      for (let t = tw.nextNode(); t && m < 2500; t = tw.nextNode()) {
        const pr = t.parentElement.getBoundingClientRect(); if (pr.bottom < 0 || pr.top > innerHeight || !pr.width) continue;
        range.selectNodeContents(t); const fs = parseFloat(getComputedStyle(t.parentElement).fontSize) || 14;
        // on the tops of the lowercase letters: the line's middle, less a fifth of the font size (x-height)
        for (const rc of range.getClientRects()) { m++; if (rc.width > 4 && rc.height > 6) add(rc.left + 1, rc.right - 1, rc.top + rc.height / 2 - fs * 0.2); }
      }
      domLedges = out; sendLedges();
    }
    function watchLedges(on) {
      const dirty = () => { ledgesDirty = true; wake(); };
      if (on && !ledgeMO) {
        // (2026-11-18) a text change arrives on a text node: judge it by its element. Things floating over the page (the
        // Island and its clock, toast bubbles, the phone tab bar) can't change where anything lands, so they don't count
        ledgeMO = new MutationObserver(muts => { if (muts.some(m => { const el = m.target.nodeType === 1 ? m.target : m.target.parentElement; return !(el && el.closest && (ours(el) || el.closest('#xm-string,#xm-glow,#xm-ring,.hp-mirror,.isl,.ftoast,.toasts,#tabbar'))); })) dirty(); });
        ledgeMO.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
        addEventListener('scroll', dirty, true); addEventListener('resize', dirty); document.addEventListener('visibilitychange', dirty);
        ledgeMO.off = () => { ledgeMO.disconnect(); removeEventListener('scroll', dirty, true); removeEventListener('resize', dirty); document.removeEventListener('visibilitychange', dirty); };
      } else if (!on && ledgeMO) { ledgeMO.off(); ledgeMO = null; }
    }

    /* ---------------- sending the page to the engine ---------------- */
    let lay = null;
    function allocBufs() { bufs = { buf: new ArrayBuffer(W * H * 4), lbuf: new ArrayBuffer(W * H * 4), ov: new ArrayBuffer(HW * HH * 4), heat: new ArrayBuffer(HW * HH * 4), solid: new ArrayBuffer(W * H) }; solidCopy = new Uint8Array(W * H); }
    function sizeCanvas() {
      cv.width = W * CELL * DPR; cv.height = H * CELL * DPR; cv.style.width = W * CELL + 'px'; cv.style.height = H * CELL + 'px';
      if (!comp) comp = makeGL(cv) || make2D(cv);
      comp.resize(W, H, HW, HH);
    }
    function sendInit(L, remapFrom) {
      gen++;
      const msg = { t: 'init', gen, W: L.W, H: L.H, grid: L.grid, colR: L.colR, colG: L.colG, colB: L.colB, owner: L.owner, layer: L.layer, boxOf: L.boxOf, els: L.els, boxCol: L.boxCol, bodyBg: L.bodyBg };
      if (remapFrom) { msg.remap = true; msg.map = { same: false }; }
      lay = { W: L.W, H: L.H };
      W = L.W; H = L.H; HW = Math.ceil(W / 4); HH = Math.ceil(H / 4);
      // every option first, so the lights are built the way this world wants them
      for (const [k, v] of Object.entries({ snowing: S.snowing, storm: S.storm, heatView: S.heatView, sharp: S.sharp, paused: S.paused, snowEverywhere: S.snowEverywhere, lightMode: S.lightMode, windBase: S.windBase, reduced, lights: S.lights, palette: S.palette, compact: S.compact, rain: S.rain, floor: S.floor })) port.post({ t: 'opt', key: k, value: v });
      port.post(msg, [L.grid.buffer, L.colR.buffer, L.colG.buffer, L.colB.buffer, L.owner.buffer, L.layer.buffer, L.boxOf.buffer]);
      allocBufs(); sizeCanvas(); busy = false; ready = true; lastFrame = null;
      api.stats = { cells: W * H, worker: port.worker, compositor: comp.kind };
      if (AMBIENT) { ledgesDirty = true; ledges(); watchLedges(true); }
    }

    /* ---------------- frames back from the engine ---------------- */
    function onEngine(msg) {
      if (msg.t === 'frame') {
        if (msg.stale || msg.gen !== gen) { if (msg.gen === gen && msg.bufs) bufs = msg.bufs; busy = false; return; }
        bufs = msg.bufs; busy = false;
        solidCopy.set(new Uint8Array(bufs.solid));
        comp.upload(bufs, S.heatView);
        lastFrame = msg; pending = true; lightsBottom = msg.lightsBottom; engineWind = msg.wind; wake();
        for (const ev of msg.events) Sound.event(ev);
        Sound.fire(msg.fire);
      } else if (msg.t === 'stats') { const w = statsWaiters.shift(); if (w) w(msg.data); }
      else if (msg.t === 'count') { const w = countWaiters.get(msg.id); if (w) { countWaiters.delete(msg.id); w(msg.n); } }
      else if (msg.t === 'probe') { const w = countWaiters.get(msg.id); if (w) { countWaiters.delete(msg.id); w(msg.m); } }
      else if (msg.t === 'error') console.error('Elements engine:', msg.message);
    }

    /* ---------------- snowflakes in the air (Nick's): they land as real snow ---------------- */
    const mouse = { x: -999, y: -999, vx: 0, vy: 0, t: 0 };
    const rnd = (a, b) => a + R() * (b - a);
    function sizeAir() { airCv.width = innerWidth * DPR; airCv.height = innerHeight * DPR; }
    function newFlake(anywhere) {
      const z = R(), near = !AMBIENT && !reduced && z > 0.94, far = z < 0.22;   // the calm layer: plain flakes only (no blurry front ones, no crystals)
      const r = far ? rnd(0.5, 1.1) : near ? rnd(5, 9) : rnd(1.1, 2.6);
      const crys = !AMBIENT && !far && !near && R() < 0.25;
      return { x: rnd(-40, innerWidth + 40), y: anywhere ? rnd(-60, innerHeight * 0.9) : rnd(-40, -8), r: crys ? r * 2.2 : r, near, far, crys, spr: (R() * 3) | 0,
        vx: 0, vy: 0, ph: R() * 6.28, sp: rnd(0.6, 1.6), rot: R() * 6.28, vr: rnd(-0.03, 0.03), o: far ? rnd(0.35, 0.6) : near ? rnd(0.25, 0.45) : rnd(0.7, 1),
        pass: R() < (S.snowEverywhere ? 0.85 : 0.35) };
    }
    function updateAir(dt) {
      const want = S.snowing && !S.paused ? (reduced ? 50 : (cfg.flakes || 170)) : 0;
      const landed = [];
      mouse.vx *= 0.9; mouse.vy *= 0.9;
      const mspd = Math.hypot(mouse.vx, mouse.vy);
      for (let i = flakes.length - 1; i >= 0; i--) {
        const f = flakes[i];
        if (S.paused) continue;
        f.ph += 0.02 * f.sp * dt; f.rot += f.vr * dt;
        const dw = f.far ? 0.5 : f.near ? 1.4 : 1, fall = (f.far ? 0.35 : f.near ? 1.6 : 0.55 + f.r * 0.18 * (f.crys ? 0.35 : 1));
        f.vx += ((engineWind * 0.9 + Math.sin(f.ph) * 0.5) * dw - f.vx) * 0.035 * dt;
        f.vy += (fall - f.vy) * 0.05 * dt;
        if (!f.far) {
          const dx = f.x - mouse.x, dy = f.y - mouse.y, d2 = dx * dx + dy * dy, Rr = 70 + Math.min(110, mspd * 4);
          if (d2 < Rr * Rr) { const d = Math.sqrt(d2) || 1, k = (Rr - d) / Rr; f.vx += (dx / d) * k * (1.2 + mspd * 0.08) + mouse.vx * 0.1 * k; f.vy += (dy / d) * k + mouse.vy * 0.1 * k; }
        }
        f.x += f.vx * dt; f.y += f.vy * dt;
        // a mid-depth flake that touches something solid becomes snow in the grid
        if (!f.far && !f.near && f.vy > 0 && W) {
          const cx = Math.floor(f.x / CELL), cy = Math.floor(f.y / CELL);
          if (cx >= 0 && cx < W && cy >= 1 && cy < H) {
            const v = solidCopy[cy * W + cx];
            if (v && !(v === 2 && f.pass)) {
              if (S.snowEverywhere || cy <= lightsBottom) { landed.push(cx, cy - 1); if (f.r > 2.2 && cx + 1 < W) landed.push(cx + 1, cy - 1); }
              flakes.splice(i, 1); continue;
            }
          }
        }
        if (f.y > innerHeight + 20 || f.x < -80 || f.x > innerWidth + 80) flakes.splice(i, 1);
      }
      if (landed.length) q(['snow', ...landed]);
      if (!S.paused) while (flakes.length < want) flakes.push(newFlake(flakes.length < want * 0.3));
    }
    function drawAir() {
      ax.setTransform(1, 0, 0, 1, 0, 0); ax.clearRect(0, 0, airCv.width, airCv.height);
      for (const f of flakes) {
        const X = f.x * DPR, Y = f.y * DPR;
        ax.globalAlpha = f.o * (AMBIENT && lightPage ? 0.9 : 1);
        if (f.near) { const s = f.r * 2.6 * DPR; ax.drawImage(BOKEH, X - s / 2, Y - s / 2, s, s); continue; }
        if (f.crys) { const s = f.r * 2 * DPR; ax.setTransform(Math.cos(f.rot), Math.sin(f.rot), -Math.sin(f.rot), Math.cos(f.rot), X, Y); ax.drawImage(CRYS[f.spr], -s / 2, -s / 2, s, s); ax.setTransform(1, 0, 0, 1, 0, 0); continue; }
        const s = f.r * 2.4 * DPR; ax.drawImage(SOFT, X - s / 2, Y - s / 2, s, s);
      }
      ax.globalAlpha = 1;
    }
    const onMouse = e => { const t = performance.now(), k = Math.max(1, t - mouse.t); mouse.vx = Math.max(-60, Math.min(60, (e.clientX - mouse.x) / k * 16)); mouse.vy = Math.max(-60, Math.min(60, (e.clientY - mouse.y) / k * 16)); mouse.x = e.clientX; mouse.y = e.clientY; mouse.t = t; };
    let lightPage = true;

    /* ---------------- the loop ---------------- */
    let lastT = performance.now(), ledgeT = 0, wasHidden = false;
    function loop(now) {
      if (!api.active) return;
      raf = requestAnimationFrame(loop);
      const dt = Math.min(2.5, (now - lastT) / 16.7 || 1); lastT = now;
      if (!ready) return;
      if (AMBIENT) {
        const hide = (cfg.hidden && cfg.hidden()) || document.hidden;
        if (hide !== wasHidden) { wasHidden = hide; host.style.setProperty('display', hide ? 'none' : 'block', 'important'); }
        // hidden (a meeting, a dialog, another tab): nothing to show, so sleep; the page changing back wakes it
        if (hide) { cancelAnimationFrame(raf); sleeping = true; return; }
        if ((ledgesDirty && now - ledgeT > 250) || now - ledgeT > 4000) { ledgeT = now; ledges(); } else if (extraDirty) sendLedges();
      }
      // nothing happening: ask the engine for a frame only now and then
      const idle = AMBIENT && lastFrame && lastFrame.quiet && !flakes.length && !S.snowing && !S.rain && !inputQ.length;
      if (!busy && bufs && now - lastSent > (idle ? 250 : 14)) {
        const input = inputQ; inputQ = [];
        busy = true; lastSent = now;
        port.post({ t: 'frame', gen, view: { top: 0, viewH: H }, input, bufs }, [bufs.buf, bufs.lbuf, bufs.ov, bufs.heat, bufs.solid]);
        bufs = null;
      }
      if (pending && lastFrame) {
        comp.draw({ glow: S.glow, flash: lastFrame.flash, heatOn: S.heatView });
        const sk = lastFrame.shake;
        cv.style.transform = sk > 0.3 ? `translate(${((R() - 0.5) * sk).toFixed(1)}px,${((R() - 0.5) * sk).toFixed(1)}px)` : '';
        pending = false;
      }
      if (S.snowing || flakes.length) { updateAir(dt); drawAir(); } else if (airCv.dataset.dirty) { ax.clearRect(0, 0, airCv.width, airCv.height); delete airCv.dataset.dirty; }
      if (flakes.length) airCv.dataset.dirty = 1;
      Sound.tickFire();
      if (AMBIENT) {
        // quiet = the engine's last frame had nothing moving, and nothing is waiting here (the 250 ms heartbeat to the engine
        // doesn't count); after 0.6 s of that, and with no reply on its way, stop asking for frames until something wakes it
        const still = idle && !ledgesDirty && !extraDirty && !inputQ.length && !airCv.dataset.dirty;
        if (!still) idleFrames = now; else if (now - idleFrames > 600 && !busy && !pending) { cancelAnimationFrame(raf); sleeping = true; }
      }
    }

    const CSS = `
    :host{all:initial}
    *{box-sizing:border-box}
    canvas.sim{position:fixed;inset:0;cursor:crosshair;touch-action:none;pointer-events:auto}
    .busy{position:fixed;left:50%;top:44%;transform:translate(-50%,-50%);font:800 13px ui-sans-serif,system-ui,sans-serif;letter-spacing:.2em;color:#fff;text-shadow:0 0 18px rgba(255,120,40,.9);pointer-events:none}
    `;
    /* ---------------- start / stop ---------------- */
    let resizeT = 0;
    const onResize = () => { clearTimeout(resizeT); resizeT = setTimeout(async () => {
      if (!api.active) return;
      // ambient: keep the loose snow, water and sand where it was (proportionally), rebuild everything else
      CELL = cfg.cell || CELL; sizeAir();
      const L = await rasterize(run); sendInit(L, lay); dispatchEvent(new CustomEvent('elements:ready', { detail: { world: api } }));
    }, 350); };
    async function start() {
      if (api.active) return;
      api.active = true; api.stats = null; const my = ++run;
      host = document.createElement('div'); host.id = AMBIENT ? 'elements-ambient' : 'elements-host';
      host.style.cssText = `position:fixed!important;inset:0!important;z-index:${AMBIENT ? (cfg.z || 60) : 2147483647}!important;pointer-events:none!important;display:block!important;margin:0!important;padding:0!important;border:0!important;background:none!important;transform:none!important;filter:none!important`;
      root = host.attachShadow({ mode: 'open' });
      const st = document.createElement('style'); st.textContent = CSS + 'canvas.air{position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none}'; root.appendChild(st);
      cv = document.createElement('canvas'); cv.className = 'sim'; airCv = document.createElement('canvas'); airCv.className = 'air'; ax = airCv.getContext('2d');
      if (AMBIENT) { cv.style.pointerEvents = 'none'; cv.style.cursor = 'default'; }
      const busyEl = document.createElement('div'); busyEl.className = 'busy'; busyEl.textContent = AMBIENT ? '' : 'MATERIALISING';
      root.append(cv, airCv, busyEl);
      (document.fullscreenElement || document.documentElement).appendChild(host);
      sizeAir();
      if (!port) await startEngine();
      if (my !== run || !api.active) return;
      if (!port) { console.warn('Elements engine could not start'); stop(); return; }
      const L = await rasterize(my);
      if (!L || my !== run || !api.active) return;
      busyEl.remove();
      // a light page keeps the glow soft (bloom is additive and washes out on white)
      lightPage = (L.bodyBg[0] * 0.3 + L.bodyBg[1] * 0.59 + L.bodyBg[2] * 0.11) > 128;
      S.glow = AMBIENT ? (lightPage ? 0.35 : 0.8) : (lightPage ? 0.6 : 1);
      sendInit(L, null);
      addEventListener('pointermove', onMouse, { passive: true });
      addEventListener('resize', onResize);
      lastT = performance.now(); raf = requestAnimationFrame(loop);
      if (AMBIENT) dispatchEvent(new CustomEvent('elements:ready', { detail: { world: api } }));
    }
    function stop() {
      if (!api.active) return;
      api.active = false; run++; cancelAnimationFrame(raf); ready = false;
      removeEventListener('resize', onResize); removeEventListener('pointermove', onMouse);
      Sound.disable(); S.sound = false;
      watchLedges(false);
      host && host.remove(); host = null; cv = null; comp = null; flakes = [];
      if (port) { port.kill(); port = null; }   // a fresh engine next time
    }
    api.start = start; api.stop = stop;
    api.stats_ = () => new Promise(res => { if (!port) return res(null); statsWaiters.push(res); port.post({ t: 'stats' }); });

    /* ---------------- what the rest of Cadence can ask of a world (ambient) ---------------- */
    const cell = (x, y) => [Math.floor(x / CELL), Math.floor(y / CELL)];
    Object.assign(api, {
      M,
      get CELL() { return CELL; },
      // drop matter at a screen point (life range for fire-like things)
      spawn(x, y, m, r = 2, chance = 0.6, lo = 10, hi = 30) { if (!ready) return; const [cx, cy] = cell(x, y); q(['spawn', cx, cy, m, r, chance, lo | 0, Math.max(lo + 1, hi | 0)]); },
      heatAt(x, y, t, rad = 1) { if (!ready) return; const [cx, cy] = cell(x, y); q(['heat', cx, cy, t, rad]); },
      // melt snow and ice around a point (px): r up/down, rx sideways (defaults to r)
      melt(x, y, r = 40, rx = r) { if (!ready) return; const [cx, cy] = cell(x, y); q(['melt', cx, cy, Math.max(1, Math.round(r / CELL)), Math.max(1, Math.round(rx / CELL))]); },
      // { snow, everywhere, wind, rain, storm, lights: 'twinkle'|'chase'|'steady'|null, palette }
      set(o) {
        if ('snow' in o) {
          const was = S.snowing; setOpt('snowing', !!o.snow);
          // switched off means off: the flakes still in the air go, and what has settled is cleared
          if (was && !o.snow && AMBIENT) { flakes = []; q(['clear', M.SNOW], ['clear', M.ICE]); }
        }
        if ('everywhere' in o) setOpt('snowEverywhere', !!o.everywhere);
        if ('wind' in o) setOpt('windBase', +o.wind || 0);
        if ('rain' in o) setOpt('rain', Math.max(0, Math.round(o.rain || 0)));
        if ('storm' in o) setOpt('storm', !!o.storm);
        if ('lights' in o) {
          if (o.palette && o.palette !== S.palette) setOpt('palette', o.palette);
          const mode = ['twinkle', 'chase', 'steady'].indexOf(o.lights);
          if (o.lights) { if (mode >= 0) setOpt('lightMode', mode); if (!S.lights) setOpt('lights', true); }
          else if (S.lights) setOpt('lights', false);
        }
      },
      // Cadence: paint a line of material from one point to another (Havoc's Materials drawer), brush in cells
      paint(x0, y0, x1, y1, m, brush = 5) { if (!ready) return; const [a, b] = cell(x0, y0), [c, d] = cell(x1, y1); q(['paint', a, b, c, d, m, brush]); },
      strike(x, y) { const [cx, cy] = cell(x, y); q(['strike', cx, cy]); },
      explode(x, y, r = 5) { const [cx, cy] = cell(x, y); q(['explode', cx, cy, r]); },
      // Cadence (2026-11-19): a picture bursts into its own pixels. left, top, width, height in page pixels; rgba is the
      // picture already scaled to one value per cell (cellsW × cellsH); the blast at bx, by with power (cells per frame)
      pixels(left, top, cellsW, cellsH, rgba, bx, by, power = 2.2) { if (!ready) return; const [x0, y0] = cell(left, top), [cx, cy] = cell(bx, by); q(['pixels', x0, y0, cellsW, cellsH, cx, cy, power, rgba]); },
      get cellSize() { return CELL; },
      // Havoc's words as page pixels (Cadence, 2026-11-19): rgba and bgIdx are one value per cell for the cellsW × cellsH
      // area at page left/top; bgCols is [r, g, b, …] for the bgIdx values. unstamp(rect) lets go of a thrown word
      // (no rect: everything Havoc stamped)
      stamp(left, top, cellsW, cellsH, rgba, bgIdx, bgCols) { if (!ready) return; const [x0, y0] = cell(left, top); q(['stamp', x0, y0, cellsW, cellsH, rgba, bgIdx, bgCols]); },
      unstamp(rc) { if (!ready) return; if (!rc) return q(['unstamp', -1]); q(['unstamp', Math.floor(rc.left / CELL), Math.floor(rc.top / CELL), Math.ceil(rc.right / CELL), Math.ceil(rc.bottom / CELL)]); },
      // what's at these page points: a Uint8Array of materials, one per point (Cadence, 2026-11-19, for Havoc's words)
      probe(xy) { return new Promise(res => { if (!port || !ready) return res(null); const id = ++countId, pts = new Int32Array(xy.length); for (let k = 0; k < xy.length; k++) pts[k] = Math.floor(xy[k] / CELL); countWaiters.set(id, res); port.post({ t: 'probe', id, pts }, [pts.buffer]); }); },
      firework(x, y) { const [cx, cy] = cell(x, y); q(['launch', cx, cy]); },
      jar(rc) { q(['jar', Math.floor(rc.left / CELL), Math.floor(rc.top / CELL), Math.floor(rc.right / CELL) - 1, Math.floor(rc.bottom / CELL) - 1]); },
      clear(m) { q(['clear', m === undefined ? -1 : m]); },
      // more ground from outside the page, in px: [[x0, x1, y], …] (e.g. the outline of you, from the webcam); [] to remove
      ledgesExtra(list) { wake(); extraLedges = []; for (const [a, b, y] of list || []) { const yy = Math.round(y / CELL); if (yy > 1 && yy < H) extraLedges.push(Math.max(0, Math.floor(a / CELL)), Math.min(W, Math.ceil(b / CELL)), yy); } extraDirty = true; },
      // Cadence: a black hole that pulls everything loose in, for about `secs` seconds
      sink(x, y, r = 280, secs = 7) { if (!ready) return; const [cx, cy] = cell(x, y); q(['sink', cx, cy, Math.ceil(r / CELL), Math.round(secs * 60)]); },
      clearAt(x, y, r) { const [cx, cy] = cell(x, y); q(['clearAt', cx, cy, Math.ceil(r / CELL)]); },
      // how many cells of a material are inside a screen rect (async: the engine has the grid)
      // Cadence: how many fish are swimming (the deep-pool ecosystems)
      // Cadence: something landed in the water at (x, y): fish nearby jump
      splash(x, y) { if (!ready) return; const [cx, cy] = cell(x, y); q(['splash', cx, cy]); },
      // Cadence: what's living in the pools, { fish, frogs, pads }
      life() { return new Promise(res => { if (!port) return res(null); const id = ++countId; countWaiters.set(id, res); port.post({ t: 'life', id }); }); },
      fish() { return new Promise(res => { if (!port) return res(0); const id = ++countId; countWaiters.set(id, res); port.post({ t: 'fish', id }); }); },
      count(rc, m) { return new Promise(res => { if (!port) return res(0); const id = ++countId; countWaiters.set(id, res); port.post({ t: 'count', id, m, rect: [Math.floor(rc.left / CELL), Math.floor(rc.top / CELL), Math.ceil(rc.right / CELL), Math.ceil(rc.bottom / CELL)] }); }); },
      // counts of every material (async): { [material]: cells }
      counts() { return api.stats_().then(s => (s && s.counts) || {}); },
      get options() { return { ...S }; }
    });
    return api;
  }
  window.ElementsWorld = { create: createWorld, M };
})();
