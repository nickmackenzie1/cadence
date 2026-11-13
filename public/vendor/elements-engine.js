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
    PAGE: 14, GLASS: 15, WIRE: 16, BULB: 17, PLANT: 18, ACID: 19, FUME: 20, POWDER: 21, BOLT: 22, SURF: 23, FIREWORK: 30, LIGHTNING: 31 };
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
    const AMBIENT = cfg.kind === 'ambient';
    const DPR = Math.min(2, devicePixelRatio || 1);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let CELL = cfg.cell || (innerWidth < 700 ? 3 : 2);
    let W = 0, H = 0, HW = 0, HH = 0, gen = 0, ready = false, busy = false, bufs = null, pending = false, lastFrame = null, lastSent = 0;
    let solidCopy = new Uint8Array(0), comp = null, inputQ = [], lightsBottom = 0, engineWind = 0.3, port = null;
    let host = null, root = null, cv = null, airCv = null, ax = null, raf = 0, flakes = [], down = false, px = 0, py = 0, holdN = 0;
    const S = { tool: FIRE, brush: 6, glow: 1, snowing: false, storm: false, heatView: false, sharp: true, paused: false, snowEverywhere: !AMBIENT ? false : true,
      lightMode: 0, windBase: 0.3, lights: !AMBIENT, palette: 'classic', compact: AMBIENT, rain: 0, floor: !AMBIENT, sound: false };
    const api = { active: false, stats: null, toggle() { api.active ? stop() : start(); } };
    const statsWaiters = [], countWaiters = new Map(); let countId = 0;

    /* ---------------- the engine: a worker, or on the page ---------------- */
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
    const setOpt = (key, value) => { S[key] = value; if (port) port.post({ t: 'opt', key, value }); };

    /* ---------------- read the screen into cells (havoc), or an empty world (ambient) ---------------- */
    // computed colours come as rgb()/rgba() or, from color-mix(), as color(srgb r g b / a) with 0–1 channels
    function parseColor(s) {
      const m = String(s).match(/[\d.]+/g) || [0, 0, 0, 0];
      if (/^color\(/.test(s)) return [m[0] * 255, m[1] * 255, m[2] * 255, m[3] === undefined ? 1 : +m[3]];
      return [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]];
    }
    // the part of an element you can actually see: inside the window and inside every scrolling/clipping ancestor
    const clipCache = new Map();
    function clipOf(el) {
      if (!el || el === document.documentElement) return { l: 0, t: 0, r: innerWidth, b: innerHeight };
      if (clipCache.has(el)) return clipCache.get(el);
      let c = clipOf(el.parentElement);
      const cs = getComputedStyle(el);
      if (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const r = el.getBoundingClientRect();
        c = { l: Math.max(c.l, r.left), t: Math.max(c.t, r.top), r: Math.min(c.r, r.right), b: Math.min(c.b, r.bottom) };
      }
      clipCache.set(el, c);
      return c;
    }
    const seen = el => { for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || +cs.opacity < 0.05 || cs.display === 'none') return false; } return true; };
    const cellBox = (r, clip) => ({
      x0: Math.max(0, Math.round(Math.max(r.left, clip.l) / CELL)), y0: Math.max(0, Math.round(Math.max(r.top, clip.t) / CELL)),
      x1: Math.min(W, Math.round(Math.min(r.right, clip.r) / CELL)), y1: Math.min(H, Math.round(Math.min(r.bottom, clip.b) / CELL)),
      rx0: Math.round(r.left / CELL), ry0: Math.round(r.top / CELL), rx1: Math.round(r.right / CELL), ry1: Math.round(r.bottom / CELL)
    });
    function inRound(x, y, b, rad) {
      if (rad <= 0) return true;
      const cx = x < b.rx0 + rad ? b.rx0 + rad : x >= b.rx1 - rad ? b.rx1 - rad - 1 : x;
      const cy = y < b.ry0 + rad ? b.ry0 + rad : y >= b.ry1 - rad ? b.ry1 - rad - 1 : y;
      return (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad;
    }
    const ours = el => el && el.closest && el.closest('#elements-host, #elements-ambient, #havoc-host');

    let run = 0, pictures = 0, foreign = 0;   // last read: images/icons turned into material, and how many came from other sites   // bumped on every start and stop, so callbacks from a closed run do nothing

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
      if (AMBIENT) return L;
      const newEl = (thresh, isBox) => { els.push({ thresh, children: [], isBox }); boxCol.push([0, 0, 0]); return els.length; };
      // a cell's colour, see-through colours blended over what's already there
      const put = (i, id, r, g, b, a = 1) => {
        if (a < 1) { const u = grid[i] ? [colR[i], colG[i], colB[i]] : bodyBg; r = u[0] + (r - u[0]) * a; g = u[1] + (g - u[1]) * a; b = u[2] + (b - u[2]) * a; }
        grid[i] = M.PAGE; owner[i] = id; colR[i] = r; colG[i] = g; colB[i] = b;
      };
      const over = i => { layer[i] = layer[i] === 1 || layer[i] === 2 ? 2 : 3; };   // content sitting on a panel, or on the page
      const idOf = new Map(), area = innerWidth * innerHeight;
      const boxAbove = el => { for (let e = el && el.parentElement; e; e = e.parentElement) if (idOf.has(e)) return idOf.get(e); return 0; };

      // 1. panels: a visible background or border, smaller than most of the screen (the big ones are the backdrop)
      for (const el of document.body.querySelectorAll('*')) {
        if (ours(el) || /^(SCRIPT|STYLE|SVG|PATH|IMG|CANVAS|BR|HTML|BODY)$/i.test(el.tagName)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
        if (r.width * r.height > area * 0.55) continue;
        const cs = getComputedStyle(el), bgc = parseColor(cs.backgroundColor);
        const sides = ['Top', 'Right', 'Bottom', 'Left'].map(s => ({ w: Math.max(0, Math.round(parseFloat(cs['border' + s + 'Width']) / CELL)) * (cs['border' + s + 'Style'] === 'none' ? 0 : 1), c: parseColor(cs['border' + s + 'Color']) }));
        if (bgc[3] < 0.02 && !sides.some(s => s.w && s.c[3] > 0.08)) continue;
        if (!seen(el)) continue;
        const b = cellBox(r, clipOf(el.parentElement)); if (b.x1 <= b.x0 || b.y1 <= b.y0) continue;
        const id = newEl(0.2, true); idOf.set(el, id);
        const rad = Math.round(parseFloat(cs.borderTopLeftRadius) / CELL) || 0;
        const mid = (((b.y0 + b.y1) >> 1) * W + ((b.x0 + b.x1) >> 1)), u = grid[mid] ? [colR[mid], colG[mid], colB[mid]] : bodyBg;
        boxCol[id] = bgc[3] >= 0.02 ? [u[0] + (bgc[0] - u[0]) * bgc[3], u[1] + (bgc[1] - u[1]) * bgc[3], u[2] + (bgc[2] - u[2]) * bgc[3]] : u.slice();
        for (let y = b.y0; y < b.y1; y++) for (let x = b.x0; x < b.x1; x++) {
          if (!inRound(x, y, b, rad)) continue;
          let c = null;
          if (y < b.ry0 + sides[0].w) c = sides[0].c; else if (y >= b.ry1 - sides[2].w) c = sides[2].c;
          else if (x < b.rx0 + sides[3].w) c = sides[3].c; else if (x >= b.rx1 - sides[1].w) c = sides[1].c;
          const i = y * W + x;
          if (c && c[3] > 0.08) put(i, id, c[0], c[1], c[2], c[3]); else if (bgc[3] >= 0.02) put(i, id, bgc[0], bgc[1], bgc[2], bgc[3]); else continue;
          layer[i] = 1; boxOf[i] = id;
        }
      }
      // 2. pictures: <img>, <canvas> and the small SVG icons, sampled at cell size
      const sample = (src, el, r) => {
        if (my !== run) return;
        const b = cellBox(r, clipOf(el.parentElement)); if (b.x1 <= b.x0 || b.y1 <= b.y0) return;
        const w = b.rx1 - b.rx0, h = b.ry1 - b.ry0; if (w <= 0 || h <= 0) return;
        const oc = document.createElement('canvas'); oc.width = w; oc.height = h;
        let d; try { const ox = oc.getContext('2d', { willReadFrequently: true }); ox.drawImage(src, 0, 0, w, h); d = ox.getImageData(0, 0, w, h).data; } catch (e) { return 'tainted'; }   // another site's picture
        pictures++; const id = newEl(0.18, false), par = boxAbove(el); if (par) els[par - 1].children.push(id);
        const rad = Math.round((parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0) / CELL);
        for (let y = b.y0; y < b.y1; y++) for (let x = b.x0; x < b.x1; x++) {
          if (!inRound(x, y, b, rad)) continue;
          const k = ((y - b.ry0) * w + (x - b.rx0)) * 4, a = d[k + 3] / 255;
          if (a > 0.25) { const i = y * W + x; over(i); put(i, id, d[k], d[k + 1], d[k + 2], a); }
        }
      };
      const pics = []; pictures = 0; foreign = 0;
      for (const el of document.body.querySelectorAll('img, canvas, svg')) {
        if (ours(el) || (el.tagName === 'svg' && el.ownerSVGElement)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 3 || r.height < 3 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth || !seen(el)) continue;
        if (el.tagName === 'IMG') {
          if (!(el.complete && el.naturalWidth) || sample(el, el, r) !== 'tainted') continue;
          // a picture from another site can't be read directly: fetch it again through Cadence's image proxy on the NAS
          // (same origin), and if that fails too, give it a plain fill so it still burns instead of vanishing
          const im = new Image(), url = el.currentSrc || el.src;
          pics.push(new Promise(res => {
            const flat = () => { pictures++; foreign++; const id = newEl(0.18, false), par = boxAbove(el); if (par) els[par - 1].children.push(id); const b = cellBox(r, clipOf(el.parentElement));
              for (let y = b.y0; y < b.y1; y++) for (let x = b.x0; x < b.x1; x++) { const i = y * W + x, t = ((x * 7 + y * 13) % 9) / 9; over(i); put(i, id, 96 + 24 * t, 92 + 22 * t, 104 + 20 * t, 1); } };
            const done = ok => { clearTimeout(tm); if (!ok || sample(im, el, r) === 'tainted') flat(); else foreign++; res(); };
            const tm = setTimeout(() => { im.onload = im.onerror = null; flat(); res(); }, 2500);
            im.onload = () => done(true); im.onerror = () => done(false);
            if (/^https?:/i.test(url)) im.src = 'api/img?url=' + encodeURIComponent(url); else done(false);
          }));
          continue;
        }
        else if (el.tagName === 'CANVAS') sample(el, el, r);
        else if (r.width <= 96 && r.height <= 96 && pics.length < 400) {
          // icons are painted by the stylesheet: carry the computed paint onto a copy of every shape before rasterizing it
          const cs = getComputedStyle(el), copy = el.cloneNode(true);
          copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); copy.setAttribute('width', r.width); copy.setAttribute('height', r.height);
          const paint = s => `color:${s.color};fill:${s.fill};stroke:${s.stroke};stroke-width:${s.strokeWidth};stroke-linecap:${s.strokeLinecap};stroke-linejoin:${s.strokeLinejoin};stroke-dasharray:${s.strokeDasharray};stroke-dashoffset:${s.strokeDashoffset};opacity:${s.opacity};fill-opacity:${s.fillOpacity};stroke-opacity:${s.strokeOpacity}`;
          copy.setAttribute('style', paint(cs));
          const src = el.querySelectorAll('*'), dst = copy.querySelectorAll('*');
          for (let k = 0; k < src.length && k < 200; k++) dst[k].setAttribute('style', paint(getComputedStyle(src[k])));
          const im = new Image();
          pics.push(new Promise(res => { im.onload = () => { sample(im, el, r); res(); }; im.onerror = res; setTimeout(res, 400); }));
          im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(copy).replace(/currentColor/g, cs.color));
        }
      }
      await Promise.all(pics);
      if (my !== run) return null;
      // 3. words: each visible word in its own font; every cell its ink touches belongs to the word
      const tc = document.createElement('canvas'), tx = tc.getContext('2d', { willReadFrequently: true }), range = document.createRange();
      const drawWord = (text, r, el, cs) => {
        const clip = clipOf(el);
        if (r.right < clip.l || r.left > clip.r || r.bottom < clip.t || r.top > clip.b) return;
        const col = parseColor(cs.color); if (col[3] < 0.05) return;
        if (cs.textTransform === 'uppercase') text = text.toUpperCase(); else if (cs.textTransform === 'lowercase') text = text.toLowerCase();
        const x0 = Math.floor(r.left / CELL), y0 = Math.floor(r.top / CELL), cw = Math.ceil(r.width / CELL) + 3, ch = Math.ceil(r.height / CELL) + 2;
        tc.width = cw * CELL; tc.height = ch * CELL;
        tx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; tx.fillStyle = '#000';
        if ('letterSpacing' in tx) tx.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
        const asc = tx.measureText(text).fontBoundingBoxAscent || r.height * 0.8;
        tx.fillText(text, r.left - x0 * CELL, r.top - y0 * CELL + asc);
        const d = tx.getImageData(0, 0, tc.width, tc.height).data;
        const id = newEl(0.12, false), par = boxAbove(el); if (par) els[par - 1].children.push(id);
        const cx0 = Math.max(0, Math.floor(clip.l / CELL)), cx1 = Math.min(W, Math.ceil(clip.r / CELL)), cy0 = Math.max(0, Math.floor(clip.t / CELL)), cy1 = Math.min(H, Math.ceil(clip.b / CELL));
        for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
          const gx = x0 + cx, gy = y0 + cy; if (gx < cx0 || gx >= cx1 || gy < cy0 || gy >= cy1) continue;
          let a = 0;
          for (let sy = 0; sy < CELL; sy++) for (let sx = 0; sx < CELL; sx++) a += d[((cy * CELL + sy) * tc.width + cx * CELL + sx) * 4 + 3];
          if (a / (CELL * CELL) > 12) { const i = gy * W + gx; over(i); put(i, id, col[0], col[1], col[2], col[3]); }
        }
      };
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: n => !n.nodeValue.trim() || ours(n.parentElement) || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|OPTION)$/.test(n.parentElement.tagName) ? 2 : 1 });
      const styleOf = new Map(); let words = 0;
      while (walker.nextNode() && words < 4000) {
        const n = walker.currentNode, el = n.parentElement, pr = el.getBoundingClientRect();
        if (pr.bottom < 0 || pr.top > innerHeight || pr.width === 0) continue;
        if (!styleOf.has(el)) styleOf.set(el, seen(el) ? getComputedStyle(el) : null);
        const cs = styleOf.get(el); if (!cs) continue;
        const re = /\S+/g; let mt;
        while ((mt = re.exec(n.nodeValue))) { range.setStart(n, mt.index); range.setEnd(n, mt.index + mt[0].length); const r = range.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) continue; drawWord(mt[0], r, el, cs); words++; }
      }
      for (const el of document.body.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]), textarea')) {
        if (ours(el) || !seen(el)) continue;
        const text = el.value || el.placeholder; if (!text) continue;
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el); if (r.bottom < 0 || r.top > innerHeight || !r.width) continue;
        tx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const lh = parseFloat(cs.fontSize) * 1.3, left = r.left + parseFloat(cs.paddingLeft), top = r.top + (el.tagName === 'TEXTAREA' ? parseFloat(cs.paddingTop) : (r.height - lh) / 2), w = tx.measureText(text).width;
        drawWord(text.slice(0, 200), { left, top, right: Math.min(r.right, left + w), bottom: top + lh, width: w, height: lh }, el, { color: el.value ? cs.color : 'rgba(138,135,127,1)', fontStyle: cs.fontStyle, fontWeight: cs.fontWeight, fontSize: cs.fontSize, fontFamily: cs.fontFamily, letterSpacing: cs.letterSpacing, textTransform: 'none' });
      }
      clipCache.clear();
      return L;
    }
    // ambient: the page is invisible ground, like Havoc's: the top of every line of text and of everything solid-looking
    // (cards, buttons, fields, pictures, chips) is a ledge snow and rain rest on; sent to the engine as [x0, x1, y, …].
    // Read when the page changes (scroll, typing, a new view, resize), not on a timer.
    let ledgesDirty = true, ledgeMO = null;
    const SOLIDISH = /^(IMG|SVG|INPUT|BUTTON|TEXTAREA|SELECT|CANVAS|VIDEO|HR)$/;
    function ledges() {
      ledgesDirty = false;
      const out = ['surf'], seen = new Set(), add = (l, rt, t) => {
        if (rt - l < 6 || t < 2 * CELL || t >= innerHeight) return;
        const x0 = Math.max(0, Math.floor(l / CELL)), x1 = Math.min(W, Math.ceil(rt / CELL)), y = Math.floor(t / CELL), k = y * 4096 + x0;
        if (y < 2 || y >= H || seen.has(k)) return; seen.add(k); out.push(x0, x1, y);
      };
      if (cfg.ledges) { for (const el of document.querySelectorAll(cfg.ledges)) { const r = el.getBoundingClientRect(); add(r.left, r.right, r.top); } inputQ.push(out); return; }
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
        range.selectNodeContents(t);
        for (const rc of range.getClientRects()) { m++; if (rc.width > 4 && rc.height > 6) add(rc.left, rc.right, rc.top + rc.height * 0.22); }   // just under the cap height, where letters start
      }
      inputQ.push(out);
    }
    function watchLedges(on) {
      const dirty = () => { ledgesDirty = true; };
      if (on && !ledgeMO) {
        ledgeMO = new MutationObserver(muts => { if (muts.some(m => !(m.target.closest && (ours(m.target) || m.target.closest('#xm-string,#xm-glow,#xm-ring,.hp-mirror'))))) dirty(); });
        ledgeMO.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
        addEventListener('scroll', dirty, true); addEventListener('resize', dirty);
        ledgeMO.off = () => { ledgeMO.disconnect(); removeEventListener('scroll', dirty, true); removeEventListener('resize', dirty); };
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
      api.stats = { pieces: L.els.length, pictures, foreign, cells: W * H, worker: port.worker, compositor: comp.kind };
      if (AMBIENT) { ledgesDirty = true; ledges(); watchLedges(true); }
    }

    /* ---------------- frames back from the engine ---------------- */
    function onEngine(msg) {
      if (msg.t === 'frame') {
        if (msg.stale || msg.gen !== gen) { if (msg.gen === gen && msg.bufs) bufs = msg.bufs; busy = false; return; }
        bufs = msg.bufs; busy = false;
        solidCopy.set(new Uint8Array(bufs.solid));
        comp.upload(bufs, S.heatView);
        lastFrame = msg; pending = true; lightsBottom = msg.lightsBottom; engineWind = msg.wind;
        for (const ev of msg.events) Sound.event(ev);
        Sound.fire(msg.fire);
      } else if (msg.t === 'stats') { const w = statsWaiters.shift(); if (w) w(msg.data); }
      else if (msg.t === 'count') { const w = countWaiters.get(msg.id); if (w) { countWaiters.delete(msg.id); w(msg.n); } }
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
      if (landed.length) inputQ.push(['snow', ...landed]);
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
        if (hide) return;
        if ((ledgesDirty && now - ledgeT > 250) || now - ledgeT > 4000) { ledgeT = now; ledges(); }
      }
      // nothing happening: ask the engine for a frame only now and then
      const idle = AMBIENT && lastFrame && lastFrame.quiet && !flakes.length && !S.snowing && !S.rain && !inputQ.length;
      if (!busy && bufs && now - lastSent > (idle ? 250 : 14)) {
        if (down && S.tool !== -1 && !AMBIENT) {
          if (S.tool === FIREWORK) { if (holdN++ % 10 === 0) inputQ.push(['launch', px, py]); }
          else if (S.tool === LIGHTNING) { if (holdN++ % 25 === 0) inputQ.push(['strike', px, py]); }
          else inputQ.push(['paint', px, py, px, py, S.tool, S.brush]);
        }
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
    }

    /* ---------------- Havoc's toolbar ---------------- */
    const T_ = (id, key, name, hint, color, icon) => ({ id, key, name, hint, color, icon });
    const TOOLS = [
      T_(FIRE, '1', 'Fire', 'Burns the page, boils water, melts snow', '#ff7a1f', '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'),
      T_(LIGHTNING, '2', 'Lightning', 'Click to strike: chars, boils, fuses sand to glass', '#cfd9ff', '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>'),
      T_(FIREWORK, '3', 'Firework', 'Click to launch; hold for a show', '#ff5ad2', '<path d="M4.9 19.1 9 15M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9 7.8 7.8M16.2 16.2l2.9 2.9M19.1 4.9l-2.9 2.9"/><circle cx="12" cy="12" r="2"/>'),
      T_(SNOW, '4', 'Snow', 'Drifts down and piles up', '#dfe8f7', '<path d="M2 12h20M12 2v20M20 16l-4-4 4-4M4 8l4 4-4 4M16 4l-4 4-4-4M8 20l4-4 4 4"/>'),
      T_(WATER, '5', 'Water', 'Finds the lowest point; puts fires out', '#4c8df6', '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>'),
      T_(LAVA, '6', 'Lava', 'Glows, lights things, turns to stone in water', '#ef5a12', '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>'),
      T_(ICE, '7', 'Ice', 'Melts in heat, freezes water it touches', '#a8d6f0', '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h3M8 8v3"/>'),
      T_(SAND, '8', 'Sand', 'Piles up; heat it into glass', '#d6b670', '<path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/>'),
      T_(PLANT, '9', 'Holly', 'Drinks water and snow, climbs, grows berries', '#2f9e55', '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>'),
      T_(ACID, '0', 'Acid', 'Eats through the page, gives off fumes', '#7be040', '<path d="M10 2v7.31M14 9.3V1.99M8.5 2h7M14 9.3a6.5 6.5 0 1 1-4 0M5.52 16h12.96"/>'),
      T_(POWDER, '-', 'Gunpowder', 'Explodes when it gets hot', '#8a8580', '<circle cx="11" cy="13" r="8"/><path d="m16.5 7.5 3-3M19 2l1 1"/>'),
      T_(OIL, '', 'Oil', 'Floats on water, catches fire easily', '#a07a4a', '<path d="M3 22h12M4 9h10M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9.83a2 2 0 0 0-.59-1.42L18 5"/>'),
      T_(WOOD, '', 'Wood', 'Chars, then burns as embers', '#9a6a40', '<path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17ZM12 22v-3"/>'),
      T_(STEAM, '', 'Steam', 'Rises, then comes back down as rain', '#c9ced8', '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>'),
      T_(STONE, '', 'Stone', 'Walls and floors', '#8c8f98', '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 9v6M16 15v6M16 3v6M3 15h18M3 9h18M8 15v6M8 3v6"/>'),
      T_(E, '=', 'Eraser', 'Clears anything', '#ffffff', '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21M22 21H7M5 11l9 9"/>'),
    ];

    const ICONS = {
      ignite: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
      storm: '<path d="M6 16.33A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.2M13 11l-4 6h6l-4 6"/>',
      heat: '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>',
      settle: '<path d="M2 21h20M5 21V17M19 21v-3M12 21v-6M8 9l4-4 4 4M12 5v8"/>',
      snowfall: '<path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2M8 15h.01M8 19h.01M12 17h.01M12 21h.01M16 15h.01M16 19h.01"/>',
      pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
      play: '<path d="M6 3l14 9-14 9z"/>',
      lights: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4"/>',
      look: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
      reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
      close: '<path d="M18 6 6 18M6 6l12 12"/>',
    };

    ICONS.sound = '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>';
    ICONS.mute = '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="m22 9-6 6M16 9l6 6"/>';
    const CSS = `
    :host{all:initial}
    *{box-sizing:border-box}
    canvas.sim{position:fixed;inset:0;cursor:crosshair;touch-action:none;pointer-events:auto}
    .hud{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);width:max-content;display:flex;align-items:center;gap:3px;padding:7px;border-radius:20px;max-width:calc(100vw - 20px);flex-wrap:wrap;justify-content:center;
         background:linear-gradient(180deg,rgba(28,28,36,.82),rgba(12,12,18,.9));backdrop-filter:blur(18px) saturate(1.4);-webkit-backdrop-filter:blur(18px) saturate(1.4);
         border:1px solid rgba(255,255,255,.1);box-shadow:0 0 0 1px rgba(0,0,0,.4),0 18px 50px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.08);
         font:500 12px/1 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#e9e7f2;pointer-events:auto;animation:rise .5s cubic-bezier(.2,1.2,.3,1)}
    @keyframes rise{from{transform:translateX(-50%) translateY(40px);opacity:0}}
    .brand{display:flex;align-items:center;gap:7px;padding:0 8px;font-weight:800;letter-spacing:.14em;font-size:11px;color:#fff}
    .brand i{width:9px;height:9px;border-radius:50%;background:#ff7a1f;box-shadow:0 0 10px #ff7a1f,0 0 2px #fff inset}
    .sep{width:1px;height:26px;background:rgba(255,255,255,.1);margin:0 3px}
    .modes{display:flex;padding:3px;gap:2px;border-radius:12px;background:rgba(255,255,255,.06)}
    .modes button{width:auto;height:30px;padding:0 10px;border-radius:9px;font:600 11.5px ui-sans-serif,system-ui,sans-serif;color:#bdbacb}
    .modes button.on{background:rgba(255,255,255,.14);color:#fff;box-shadow:none}
    button{all:unset;position:relative;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;cursor:pointer;color:#bdbacb;transition:background .15s,color .15s,transform .1s}
    button:hover{background:rgba(255,255,255,.07);color:#fff}
    button:focus-visible{outline:2px solid #fff;outline-offset:1px}
    button:active{transform:scale(.92)}
    button svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
    button.on{color:var(--c);background:color-mix(in srgb,var(--c) 16%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--c) 45%,transparent),0 0 18px color-mix(in srgb,var(--c) 30%,transparent)}
    button .k{position:absolute;right:4px;bottom:3px;font-size:8.5px;opacity:.45;font-weight:700}
    .size{display:flex;align-items:center;gap:6px;padding:0 6px;color:#bdbacb;font-size:11px}
    .size input{width:70px;accent-color:#ff7a1f}
    .tip{position:fixed;bottom:84px;left:50%;transform:translateX(-50%);padding:8px 12px;border-radius:10px;background:rgba(12,12,18,.92);border:1px solid rgba(255,255,255,.1);color:#fff;font:500 12px/1.3 ui-sans-serif,system-ui,sans-serif;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .15s;box-shadow:0 10px 30px rgba(0,0,0,.4)}
    .tip b{color:var(--c)}
    .tip.show{opacity:1}
    .busy{position:fixed;left:50%;top:44%;transform:translate(-50%,-50%);font:800 13px ui-sans-serif,system-ui,sans-serif;letter-spacing:.2em;color:#fff;text-shadow:0 0 18px rgba(255,120,40,.9);pointer-events:none}
    `;

    let hud = null, tipEl = null;
    const LIGHT_MODES = ['Twinkle', 'Chase', 'Steady', 'Off'];
    const btn = (id, title, color, key, icon) => `<button data-id="${id}" style="--c:${color || '#fff'}" aria-label="${title}">${'<svg viewBox="0 0 24 24" aria-hidden="true">' + icon + '</svg>'}${key ? `<span class="k">${key}</span>` : ''}</button>`;
    const hints = () => ({ ignite: '<b>Ignite</b> · set a few things alight', snowfall: '<b>Snowfall</b> · let it snow', storm: '<b>Storm</b> · rain and lightning', heat: '<b>Heat view</b> · see temperature',
      settle: S.snowEverywhere ? '<b>Snow</b> · settles everywhere (click: only on the lights)' : '<b>Snow</b> · settles only on the lights (click: everywhere)',
      lights: '<b>Lights</b> · ' + LIGHT_MODES[S.lightMode] + ' (click to change)', look: S.sharp ? '<b>Look</b> · switch to all pixels' : '<b>Look</b> · switch to sharp',
      sound: S.sound ? 'Sound on' : 'Sound off', pause: S.paused ? 'Play · Space' : 'Pause · Space', reset: 'Rebuild the page and start over', close: 'Exit and restore · Esc' });
    function act(id) {
      if (id[0] === 't') S.tool = +id.slice(1);
      else if (id === 'ignite') inputQ.push(['ignite']);
      else if (id === 'snowfall') setOpt('snowing', !S.snowing);
      else if (id === 'storm') setOpt('storm', !S.storm);
      else if (id === 'heat') setOpt('heatView', !S.heatView);
      else if (id === 'settle') setOpt('snowEverywhere', !S.snowEverywhere);
      else if (id === 'lights') setOpt('lightMode', (S.lightMode + 1) % 4);
      else if (id === 'look') setOpt('sharp', !S.sharp);
      else if (id === 'sound') { if (Sound.on) { Sound.disable(); S.sound = false; } else S.sound = Sound.enable(); }
      else if (id === 'pause') setOpt('paused', !S.paused);
      else if (id === 'reset') { stop(); setTimeout(start, 60); return; }
      else if (id === 'close') { stop(); return; }
      syncHud();
    }
    function buildHud() {
      hud = document.createElement('div'); hud.className = 'hud'; hud.setAttribute('role', 'toolbar'); hud.setAttribute('aria-label', 'Elements');
      hud.innerHTML = `<div class="brand"><i></i>ELEMENTS</div>`
        + `<div class="modes" role="group" aria-label="Mode"><button data-mode="physics" aria-pressed="false">Physics</button><button data-mode="elements" class="on" aria-pressed="true">Elements</button></div><div class="sep"></div>`
        + TOOLS.map(t => btn('t' + t.id, t.name, t.color, t.key, t.icon)).join('')
        + `<div class="sep"></div><label class="size">Size <input type="range" min="1" max="16" value="${S.brush}" aria-label="Brush size"></label><label class="size">Wind <input class="wind" type="range" min="-20" max="20" value="${Math.round(S.windBase * 10)}" aria-label="Wind"></label>`
        + btn('ignite', 'Ignite', '#ff7a1f', 'I', ICONS.ignite) + btn('snowfall', 'Snowfall', '#dfe8f7', 'S', ICONS.snowfall) + btn('storm', 'Storm', '#9fb4ff', 'T', ICONS.storm) + btn('settle', 'Where snow settles', '#dfe8f7', '', ICONS.settle) + btn('lights', 'Lights', '#ffb020', 'L', ICONS.lights) + btn('heat', 'Heat view', '#ff6b3d', 'V', ICONS.heat) + btn('look', 'Look: sharp or pixel', '#fff', 'P', ICONS.look)
        + btn('sound', 'Sound', '#fff', '', ICONS.mute) + btn('pause', 'Pause', '#fff', '', ICONS.pause) + btn('reset', 'Rebuild the page', '#fff', '', ICONS.reset) + btn('close', 'Exit (Esc)', '#fff', '', ICONS.close);
      tipEl = document.createElement('div'); tipEl.className = 'tip';
      hud.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return; e.stopPropagation();
        if (b.dataset.mode) { if (b.dataset.mode === 'physics') { stop(); dispatchEvent(new CustomEvent('havoc:mode', { detail: 'physics' })); } return; }
        act(b.dataset.id);
      });
      hud.querySelector('.size input').addEventListener('input', e => { S.brush = +e.target.value; });
      hud.querySelector('input.wind').addEventListener('input', e => setOpt('windBase', +e.target.value / 10));
      hud.addEventListener('pointerover', e => {
        const b = e.target.closest('button'); if (!b || b.dataset.mode) return;
        const t = TOOLS.find(x => 't' + x.id === b.dataset.id);
        tipEl.style.setProperty('--c', t ? t.color : '#fff'); tipEl.innerHTML = t ? `<b>${t.name}</b> · ${t.hint}` : hints()[b.dataset.id]; tipEl.classList.add('show');
      });
      hud.addEventListener('pointerout', () => tipEl.classList.remove('show'));
      root.append(hud, tipEl);
      syncHud();
    }
    function syncHud() {
      if (!hud) return;
      hud.querySelectorAll('button[data-id]').forEach(b => {
        const id = b.dataset.id;
        b.classList.toggle('on', id === 't' + S.tool || (id === 'snowfall' && S.snowing) || (id === 'pause' && S.paused) || (id === 'lights' && S.lightMode !== 3) || (id === 'look' && !S.sharp) || (id === 'storm' && S.storm) || (id === 'heat' && S.heatView) || (id === 'settle' && !S.snowEverywhere) || (id === 'sound' && S.sound));
        if (id === 'pause') { b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${S.paused ? ICONS.play : ICONS.pause}</svg>`; b.setAttribute('aria-label', S.paused ? 'Play' : 'Pause'); }
        if (id === 'sound') b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${S.sound ? ICONS.sound : ICONS.mute}</svg>`;
      });
    }
    function onKey(e) {
      if (!api.active || e.metaKey || e.ctrlKey || e.altKey) return;
      e.stopPropagation();   // the app underneath shouldn't react while the page is matter
      if (e.key === 'Escape' || (e.key === 'H' && e.shiftKey)) { e.preventDefault(); stop(); return; }
      const t = TOOLS.find(t => t.key && t.key === e.key);
      if (t) { S.tool = t.id; e.preventDefault(); syncHud(); return; }
      const k = e.key.toLowerCase(), map = { i: 'ignite', s: 'snowfall', l: 'lights', p: 'look', t: 'storm', v: 'heat' };
      if (map[k]) { act(map[k]); return; }
      if (e.key === ' ') { e.preventDefault(); act('pause'); }
      else if (e.key === '[') S.brush = Math.max(1, S.brush - 1);
      else if (e.key === ']') S.brush = Math.min(16, S.brush + 1);
    }
    const toGrid = e => [Math.floor(e.clientX / CELL), Math.floor(e.clientY / CELL)];

    /* ---------------- start / stop ---------------- */
    let locked = [], resizeT = 0;
    const onResize = () => { clearTimeout(resizeT); resizeT = setTimeout(async () => {
      if (!api.active) return;
      if (!AMBIENT) { stop(); start(); return; }
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
      if (!AMBIENT) addEventListener('keydown', onKey, true);   // Esc works even while the page is still being read
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
      if (!AMBIENT) {
        cv.addEventListener('pointerdown', e => { down = true; holdN = 1; cv.setPointerCapture(e.pointerId); [px, py] = toGrid(e); if (S.tool === FIREWORK) inputQ.push(['launch', px, py]); else if (S.tool === LIGHTNING) inputQ.push(['strike', px, py]); else inputQ.push(['paint', px, py, px, py, S.tool, S.brush]); });
        cv.addEventListener('pointermove', e => { if (!down) return; const [x, y] = toGrid(e); if (S.tool !== FIREWORK && S.tool !== LIGHTNING) inputQ.push(['paint', px, py, x, y, S.tool, S.brush]); px = x; py = y; });
        const up = () => { down = false; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
        cv.addEventListener('contextmenu', e => e.preventDefault());
        // hold the page still underneath while it's matter
        locked = [document.documentElement, document.body].map(el => [el, el.style.overflow]);
        locked.forEach(([el]) => { el.style.overflow = 'hidden'; });
        buildHud();
      }
      lastT = performance.now(); raf = requestAnimationFrame(loop);
      if (AMBIENT) dispatchEvent(new CustomEvent('elements:ready', { detail: { world: api } }));
    }
    function stop() {
      if (!api.active) return;
      api.active = false; run++; cancelAnimationFrame(raf); down = false; ready = false;
      removeEventListener('keydown', onKey, true); removeEventListener('resize', onResize); removeEventListener('pointermove', onMouse);
      locked.forEach(([el, v]) => { el.style.overflow = v; if (!el.getAttribute('style')) el.removeAttribute('style'); }); locked = [];
      Sound.disable(); S.sound = false;
      watchLedges(false);
      host && host.remove(); host = null; hud = null; cv = null; comp = null; flakes = [];
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
      spawn(x, y, m, r = 2, chance = 0.6, lo = 10, hi = 30) { if (!ready) return; const [cx, cy] = cell(x, y); inputQ.push(['spawn', cx, cy, m, r, chance, lo | 0, Math.max(lo + 1, hi | 0)]); },
      heatAt(x, y, t, rad = 1) { if (!ready) return; const [cx, cy] = cell(x, y); inputQ.push(['heat', cx, cy, t, rad]); },
      // melt snow and ice around a point (px): r up/down, rx sideways (defaults to r)
      melt(x, y, r = 40, rx = r) { if (!ready) return; const [cx, cy] = cell(x, y); inputQ.push(['melt', cx, cy, Math.max(1, Math.round(r / CELL)), Math.max(1, Math.round(rx / CELL))]); },
      // { snow, everywhere, wind, rain, storm, lights: 'twinkle'|'chase'|'steady'|null, palette }
      set(o) {
        if ('snow' in o) setOpt('snowing', !!o.snow);
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
      strike(x, y) { const [cx, cy] = cell(x, y); inputQ.push(['strike', cx, cy]); },
      explode(x, y, r = 5) { const [cx, cy] = cell(x, y); inputQ.push(['explode', cx, cy, r]); },
      firework(x, y) { const [cx, cy] = cell(x, y); inputQ.push(['launch', cx, cy]); },
      jar(rc) { inputQ.push(['jar', Math.floor(rc.left / CELL), Math.floor(rc.top / CELL), Math.floor(rc.right / CELL) - 1, Math.floor(rc.bottom / CELL) - 1]); },
      clear(m) { inputQ.push(['clear', m === undefined ? -1 : m]); },
      clearAt(x, y, r) { const [cx, cy] = cell(x, y); inputQ.push(['clearAt', cx, cy, Math.ceil(r / CELL)]); },
      // how many cells of a material are inside a screen rect (async: the engine has the grid)
      count(rc, m) { return new Promise(res => { if (!port) return res(0); const id = ++countId; countWaiters.set(id, res); port.post({ t: 'count', id, m, rect: [Math.floor(rc.left / CELL), Math.floor(rc.top / CELL), Math.ceil(rc.right / CELL), Math.ceil(rc.bottom / CELL)] }); }); },
      // counts of every material (async): { [material]: cells }
      counts() { return api.stats_().then(s => (s && s.counts) || {}); },
      get options() { return { ...S }; }
    });
    return api;
  }
  window.ElementsWorld = { create: createWorld, M };
})();
