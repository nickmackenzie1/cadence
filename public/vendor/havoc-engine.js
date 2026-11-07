/* Havoc — physics-based page destruction.
   Injected on demand by background.js together with matter.min.js. Click the toolbar button again (or Esc) to restore. */
(() => {
  'use strict';
  if (window.__havoc) { window.__havoc.toggle(); return; }
  const M = window.Matter;
  if (!M) { console.warn('Havoc: Matter.js missing'); return; }
  const { Engine, Bodies, Body, Composite, Events, Mouse, MouseConstraint, Query, Sleeping } = M;

  const MAX_LETTERS = 2600;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TOOLS = [
    { id: 'grab',   key: '1', name: 'Grab',       hint: 'Drag & fling anything',              color: '#7cf7d4' },
    { id: 'blast',  key: '2', name: 'Blast',      hint: 'Click to detonate',                  color: '#ff7a3d' },
    { id: 'melt',   key: '3', name: 'Melt',       hint: 'Click text or images to melt them',  color: '#ff4fa3' },
    { id: 'rain',   key: '4', name: 'Rain',       hint: 'Toggle a storm — drops bead on images', color: '#5cc8ff' },
    { id: 'hole',   key: '5', name: 'Black hole', hint: 'Click to open a singularity',         color: '#b28cff' },
    { id: 'zerog',  key: '6', name: 'Zero-G',     hint: 'Toggle gravity',                      color: '#ffe066' },
    { id: 'quake',  key: '7', name: 'Collapse',   hint: 'Bring the whole page down',           color: '#ff3b3b' },
  ];
  const ICONS = {
    grab:  '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5V4a1.5 1.5 0 0 1 3 0v6m0-4.5a1.5 1.5 0 0 1 3 0V12m0-3.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.9-2.5L5 15.5a1.6 1.6 0 0 1 2.6-1.9L8 14"/>',
    blast: '<path d="M12 2l1.8 5.2L19 5l-2.2 5.2L22 12l-5.2 1.8L19 19l-5.2-2.2L12 22l-1.8-5.2L5 19l2.2-5.2L2 12l5.2-1.8L5 5l5.2 2.2z"/>',
    melt:  '<path d="M4 4h16v6c0 1.5-1 2-2 2s-1.5.8-1.5 2v3.5a1.5 1.5 0 0 1-3 0V13c0-1-.6-1.5-1.5-1.5S10.5 12 10.5 13v1.5a1.5 1.5 0 0 1-3 0V12c0-1-.5-1.5-1.5-1.5S4 10 4 9z"/>',
    rain:  '<path d="M7 15a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.3 1.5A3.8 3.8 0 0 1 17.5 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
    hole:  '<circle cx="12" cy="12" r="3.2"/><path d="M12 3a9 9 0 0 1 9 9M21 12a9 9 0 0 1-9 9M12 21a9 9 0 0 1-9-9M3 12a9 9 0 0 1 9-9" opacity=".55"/><path d="M12 6.5a5.5 5.5 0 0 1 5.5 5.5M6.5 12A5.5 5.5 0 0 0 12 17.5"/>',
    zerog: '<circle cx="12" cy="12" r="4"/><ellipse cx="12" cy="12" rx="10" ry="3.6" transform="rotate(-20 12 12)"/>',
    quake: '<path d="M3 21h18M5 21V9l4-3 4 3v12M13 21V12l3-2 3 2v9"/><path d="M8 11l1.5 2-1 2 1 2M16 14l-1 1.5 1 1.5"/>',
    sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    mute:  '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
    reset: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.7"/><path d="M4 4v4.7h4.7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
  };

  /* ------------------------------------------------------------------ state */
  const H = window.__havoc = { active: false, toggle() { H.active ? stop() : start(); } };
  let host, root, stage, fx, fxc, hit, hud, scorch, sc, tipEl, scorchHost, hl, hlc;
  let engine, mouse, mcon, raf = 0, lastT = 0, W = innerWidth, Hh = innerHeight, DPR = Math.min(2, devicePixelRatio || 1);
  let letters = [], images = [], bodyMap = new Map(), restore = [], touched = new Map();
  const touch = el => { if (!touched.has(el)) touched.set(el, el.getAttribute('style')); };
  let tool = 'blast', raining = false, zeroG = false, muted = false;
  let particles = [], rings = [], holes = [], drops = [], shake = 0, pointer = { x: W / 2, y: Hh / 2, down: false, inside: false };
  let walls = [];

  /* ------------------------------------------------------------------ audio (synthesized, no assets) */
  let AC = null, master = null, noiseBuf = null;
  function audio() {
    if (muted) return null;
    if (!AC) {
      try {
        AC = new (window.AudioContext || window.webkitAudioContext)();
        master = AC.createGain(); master.gain.value = 0.55; master.connect(AC.destination);
        const comp = AC.createDynamicsCompressor(); master.disconnect(); master.connect(comp); comp.connect(AC.destination);
        noiseBuf = AC.createBuffer(1, AC.sampleRate * 1.5, AC.sampleRate);
        const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { return null; }
    }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function noise(dur, { freq = 800, q = 0.7, type = 'lowpass', gain = 0.8, attack = 0.005, sweep = null } = {}) {
    const a = audio(); if (!a) return;
    const t = a.currentTime, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function tone(f0, f1, dur, { type = 'sine', gain = 0.4 } = {}) {
    const a = audio(); if (!a) return;
    const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  const sfx = {
    boom()  { noise(1.1, { freq: 1800, sweep: 60, gain: 1 }); tone(110, 28, 0.9, { gain: 0.9 }); noise(0.25, { freq: 4000, type: 'highpass', gain: 0.25 }); },
    plink() { if (Math.random() < 0.6) return; tone(rand(900, 1800), rand(300, 500), 0.12, { gain: 0.07 }); },
    splat() { tone(rand(500, 700), 120, 0.18, { gain: 0.12, type: 'triangle' }); noise(0.12, { freq: 1200, gain: 0.08 }); },
    goo()   { tone(rand(140, 220), 40, 0.7, { gain: 0.25, type: 'sawtooth' }); noise(0.6, { freq: 400, sweep: 120, gain: 0.25, q: 8, type: 'bandpass' }); },
    hole()  { tone(55, 30, 3.5, { gain: 0.5, type: 'sawtooth' }); noise(3, { freq: 200, sweep: 2400, gain: 0.35, q: 4, type: 'bandpass', attack: 0.6 }); },
    pop()   { tone(rand(600, 1000), 1800, 0.08, { gain: 0.06, type: 'square' }); },
    quake() { noise(2.6, { freq: 160, sweep: 50, gain: 1, attack: 0.3 }); tone(42, 24, 2.6, { gain: 0.8, type: 'sawtooth' }); },
    arm()   { tone(220, 880, 0.18, { gain: 0.12, type: 'square' }); setTimeout(() => tone(660, 1320, 0.12, { gain: 0.1, type: 'square' }), 90); },
    click() { tone(1400, 900, 0.04, { gain: 0.05, type: 'square' }); },
  };

  /* ------------------------------------------------------------------ harvesting the page */
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'IFRAME', 'TEMPLATE', 'svg', 'SVG', 'CODE_']);
  const inView = r => r.width > 0.5 && r.height > 0.5 && r.bottom > 0 && r.right > 0 && r.top < Hh && r.left < W;
  function hideText(el) {
    if (el.__havocHidden) return; el.__havocHidden = true; touch(el);
    const s = el.style, old = [s.getPropertyValue('color'), s.getPropertyPriority('color'), s.getPropertyValue('-webkit-text-fill-color'), s.getPropertyPriority('-webkit-text-fill-color'), s.getPropertyValue('text-shadow'), s.getPropertyPriority('text-shadow')];
    s.setProperty('color', 'transparent', 'important'); s.setProperty('-webkit-text-fill-color', 'transparent', 'important'); s.setProperty('text-shadow', 'none', 'important');
    restore.push(() => { el.__havocHidden = false; s.setProperty('color', old[0], old[1]); s.setProperty('-webkit-text-fill-color', old[2], old[3]); s.setProperty('text-shadow', old[4], old[5]); });
  }
  function hideEl(el, prop = 'visibility', val = 'hidden') {
    touch(el);
    const s = el.style, old = s.getPropertyValue(prop), pri = s.getPropertyPriority(prop);
    s.setProperty(prop, val, 'important');
    restore.push(() => { s.setProperty(prop, old, pri); });
  }
  function harvestText() {
    const styleCache = new Map(), out = [];
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = n.parentElement; if (!p || SKIP.has(p.tagName) || p.closest('#havoc-host, svg, [contenteditable="true"]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const range = document.createRange(), parents = new Set();
    let n;
    while ((n = walker.nextNode()) && out.length < MAX_LETTERS) {
      const p = n.parentElement;
      range.selectNodeContents(n); const nr = range.getBoundingClientRect(); if (!inView(nr)) continue;
      let cs = styleCache.get(p);
      if (cs === undefined) {
        const c = getComputedStyle(p);
        if (c.visibility === 'hidden' || +c.opacity === 0) { styleCache.set(p, false); continue; }
        let color = c.webkitTextFillColor && c.webkitTextFillColor !== c.color && !/rgba\(0, 0, 0, 0\)/.test(c.webkitTextFillColor) ? c.webkitTextFillColor : c.color;
        if (/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(color)) color = '#222';
        cs = { font: `${c.fontStyle} ${c.fontWeight} ${c.fontSize} ${c.fontFamily}`, color, shadow: c.textShadow !== 'none' ? c.textShadow : '', transform: c.textTransform };
        styleCache.set(p, cs);
      }
      if (!cs) continue;
      const text = n.nodeValue;
      let any = false;
      for (let i = 0; i < text.length && out.length < MAX_LETTERS; i++) {
        const ch = text[i]; if (/\s/.test(ch)) continue;
        // keep surrogate pairs (emoji) together
        let len = 1; const code = text.charCodeAt(i); if (code >= 0xd800 && code <= 0xdbff) len = 2;
        range.setStart(n, i); range.setEnd(n, Math.min(text.length, i + len));
        const r = range.getClientRects()[0];
        if (len === 2) i++;
        if (!r || !inView(r) || r.width < 1) continue;
        out.push({ ch: text.substr(i - len + 1, len), x: r.left, y: r.top, w: r.width, h: r.height, cs });
        any = true;
      }
      if (any) parents.add(p);
    }
    range.detach && range.detach();
    return { glyphs: out, parents };
  }
  function harvestImages() {
    const out = [];
    const els = document.querySelectorAll('img, video, canvas, picture > source + img');
    for (const el of els) {
      if (el.closest('#havoc-host, #havoc-scorch')) continue;
      const r = el.getBoundingClientRect(); if (!inView(r) || r.width < 24 || r.height < 24) continue;
      const c = getComputedStyle(el); if (c.visibility === 'hidden' || +c.opacity === 0 || c.display === 'none') continue;
      if (el.tagName === 'IMG' && !(el.complete && el.naturalWidth)) continue;
      out.push({ el, src: el, r, fit: c.objectFit || 'fill', radius: c.borderRadius });
    }
    // big CSS background images (hero banners, cards)
    const all = document.body ? document.body.querySelectorAll('*') : [];
    let count = 0;
    for (const el of all) {
      if (count > 40) break;
      if (el.closest('#havoc-host, #havoc-scorch')) continue;
      const c = getComputedStyle(el); if (!c.backgroundImage || c.backgroundImage === 'none' || !/url\(/.test(c.backgroundImage)) continue;
      const r = el.getBoundingClientRect(); if (!inView(r) || r.width * r.height < 6000) continue;
      const url = (c.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/) || [])[1]; if (!url || /^data:image\/svg/.test(url)) continue;
      count++;
      out.push({ el, url, r, fit: c.backgroundSize === 'contain' ? 'contain' : 'cover', bg: true, radius: c.borderRadius });
    }
    return out;
  }

  /* ------------------------------------------------------------------ building the stage */
  function makeLetter(g) {
    const el = document.createElement('div');
    el.className = 'l'; el.textContent = g.ch;
    el.style.cssText = `width:${g.w}px;height:${g.h}px;line-height:${g.h}px;font:${g.cs.font};color:${g.cs.color};${g.cs.shadow ? 'text-shadow:' + g.cs.shadow + ';' : ''}transform:translate(${g.x}px,${g.y}px)`;
    if (g.cs.transform && g.cs.transform !== 'none') el.style.textTransform = 'none';
    stage.appendChild(el);
    const body = Bodies.rectangle(g.x + g.w / 2, g.y + g.h / 2, Math.max(2, g.w), Math.max(2, g.h * 0.82), {
      friction: 0.4, frictionAir: 0.012, restitution: 0.28, density: 0.0016, slop: 0.02, label: 'L'
    });
    Body.setStatic(body, true);   // freeze; created-static bodies can't be properly unfrozen in Matter
    const o = { kind: 'L', el, body, w: g.w, h: g.h, alive: true, color: g.cs.color };
    bodyMap.set(body.id, o); letters.push(o);
    return body;
  }
  function fitRect(sw, sh, w, h, fit) {
    if (fit === 'cover') { const s = Math.max(w / sw, h / sh), cw = w / s, ch = h / s; return [(sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, w, h]; }
    if (fit === 'contain' || fit === 'scale-down') { const s = Math.min(w / sw, h / sh), dw = sw * s, dh = sh * s; return [0, 0, sw, sh, (w - dw) / 2, (h - dh) / 2, dw, dh]; }
    return [0, 0, sw, sh, 0, 0, w, h];
  }
  function makeImage(info) {
    const { r } = info, w = Math.round(r.width), h = Math.round(r.height);
    const cv = document.createElement('canvas'); cv.className = 'img';
    const scale = Math.min(DPR, 1600 / Math.max(w, h));
    cv.width = Math.max(1, Math.round(w * scale)); cv.height = Math.max(1, Math.round(h * scale));
    cv.style.cssText = `width:${w}px;height:${h}px;transform:translate(${r.left}px,${r.top}px);${info.radius && info.radius !== '0px' ? 'border-radius:' + info.radius + ';' : ''}`;
    const base = document.createElement('canvas'); base.width = cv.width; base.height = cv.height;
    const o = { kind: 'I', el: cv, ctx: cv.getContext('2d'), base, w, h, sx: cv.width / w, body: null, alive: true, melt: null, ripples: [], beads: [], dirty: true, ready: false, t: 0 };
    const paint = src => {
      try {
        const sw = src.naturalWidth || src.videoWidth || src.width, sh = src.naturalHeight || src.videoHeight || src.height;
        if (!sw || !sh) return;
        const [a, b, c, d, e, f, g, hh] = fitRect(sw, sh, base.width, base.height, info.fit);
        base.getContext('2d').drawImage(src, a, b, c, d, e, f, g, hh);
        o.ready = true; o.dirty = true;
      } catch (e) { /* unreadable source: leave blank */ }
    };
    if (info.bg) { const im = new Image(); im.onload = () => { paint(im); hideEl(info.el, 'background-image', 'none'); }; im.src = info.url; }
    else { paint(info.src); hideEl(info.el); }
    stage.appendChild(cv);
    o.body = Bodies.rectangle(r.left + w / 2, r.top + h / 2, w, h, { friction: 0.5, frictionAir: 0.01, restitution: 0.15, density: 0.0012, label: 'I', chamfer: { radius: Math.min(10, w / 6, h / 6) } });
    Body.setStatic(o.body, true);
    bodyMap.set(o.body.id, o); images.push(o);
    return o.body;
  }

  /* ------------------------------------------------------------------ image rendering: ripples, beads (lens droplets), melt */
  function renderImage(o, dt) {
    const { ctx, base } = o, cw = base.width, chh = base.height, s = o.sx;
    o.t += dt;
    ctx.clearRect(0, 0, cw, chh);
    if (o.melt) {
      const m = o.melt; let alive = false;
      for (const col of m.cols) {
        if (o.t * 1000 < col.delay) { ctx.drawImage(base, col.x, 0, col.w, chh, col.x, 0, col.w, chh); alive = true; continue; }
        col.v += col.a * dt * 60; col.off += col.v * dt * 60;
        const off = col.off * s;
        // taffy-stretch the column, then slide it down
        const stretch = chh + off * 0.55;
        ctx.drawImage(base, col.x, 0, col.w, chh, col.x, off * 0.45, col.w, stretch);
        // wet sheen near the drip edge
        if (off > 4 && off < chh * 1.6) {
          const y = off * 0.45 + stretch;
          ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(col.x, y - 5 * s, col.w, 5 * s);
          ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(col.x, y - 9 * s, col.w, 1.5 * s);
        }
        if (off * 0.45 < chh) alive = true;
      }
      if (!alive) { kill(o); }
      return;
    }
    // ripples: horizontal row displacement
    if (o.ripples.length) {
      const step = Math.max(1, Math.round(2 * s));
      for (let y = 0; y < chh; y += step) {
        let dx = 0;
        for (const rp of o.ripples) {
          const d = Math.abs(y - rp.y * s), age = o.t - rp.t0;
          const front = age * 140 * s; if (d > front + 60 * s) continue;
          dx += rp.amp * s * Math.exp(-d / (50 * s)) * Math.sin((d - front) / (7 * s)) * Math.exp(-age * 1.6);
        }
        ctx.drawImage(base, 0, y, cw, step, dx, y, cw, step);
      }
      o.ripples = o.ripples.filter(rp => o.t - rp.t0 < 2.4);
    } else ctx.drawImage(base, 0, 0);
    // water beads: tiny inverted lenses that slide and leave trails
    for (const b of o.beads) {
      b.wait -= dt;
      if (b.wait <= 0 && b.r > 3.2) { b.vy += 0.25 * dt; b.y += b.vy * dt * 60 * (b.r / 7); b.x += Math.sin(o.t * 3 + b.seed) * 0.15; if (Math.random() < 0.08) { b.trail.push({ x: b.x, y: b.y, r: Math.max(1.2, b.r * rand(0.18, 0.32)) }); b.r *= 0.995; } }
      for (const t of b.trail) lens(ctx, base, t.x * s, t.y * s, t.r * s, 1.35, 0.6);
      if (b.trail.length) { ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(b.x * s - b.r * s * 0.35, (b.trail[0].y) * s, b.r * s * 0.7, (b.y - b.trail[0].y) * s); }
      lens(ctx, base, b.x * s, b.y * s, b.r * s, 1.7, 1);
    }
    o.beads = o.beads.filter(b => b.y - b.r < o.h + 10);
    o.dirty = o.ripples.length > 0 || o.beads.some(b => b.wait <= 0 && b.r > 3.2);
  }
  function lens(ctx, base, x, y, r, mag, alpha) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    // a real droplet flips what's behind it
    ctx.translate(x, y); ctx.scale(mag, -mag);
    const sz = r * 2 / mag * 1.4;
    ctx.globalAlpha = alpha;
    ctx.drawImage(base, x - sz / 2, y - sz / 2, sz, sz, -sz / 2, -sz / 2, sz, sz);
    ctx.restore();
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${0.75 * alpha})`); g.addColorStop(0.25, `rgba(255,255,255,${0.12 * alpha})`); g.addColorStop(0.8, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.35 * alpha})`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  function startMelt(o, px, py) {
    if (o.melt) return;
    if (!o.body.isStatic) Body.setStatic(o.body, true);
    const cw = o.base.width, colW = Math.max(1, Math.round(cw / 220)), cols = [];
    const lx = (px - (o.body.position.x - o.w / 2)) * o.sx;
    // smooth noise so neighbouring columns ooze together, plus a few fast drips
    const ph = [rand(0, 9), rand(0, 9), rand(0, 9)], drips = [];
    for (let i = 0; i < Math.max(3, Math.round(o.w / 70)); i++) drips.push({ x: rand(0, cw), w: rand(6, 18) * o.sx, k: rand(1.6, 3) });
    for (let x = 0; x < cw; x += colW) {
      const u = x / cw;
      let n = 0.55 + 0.25 * Math.sin(u * 7 + ph[0]) + 0.15 * Math.sin(u * 17 + ph[1]) + 0.08 * Math.sin(u * 41 + ph[2]);
      for (const d of drips) { const t = Math.abs(x - d.x) / d.w; if (t < 1) n += (d.k - 1) * (1 - t * t) * 0.6; }
      const dist = Math.abs(x - lx) / o.sx;
      cols.push({ x, w: colW + 1, off: 0, v: 0.08 * n, a: 0.009 * n, delay: dist * 2.2 });
    }
    o.melt = { cols }; o.t = 0; o.dirty = true;
    Composite.remove(engine.world, o.body);
  }

  /* ------------------------------------------------------------------ actions */
  const release = (o, vx = 0, vy = 0, spin = 0) => {
    if (!o.alive || !o.body) return;
    if (o.body.isStatic) Body.setStatic(o.body, false);
    Sleeping.set(o.body, false);
    Body.setVelocity(o.body, { x: vx, y: vy }); Body.setAngularVelocity(o.body, spin);
  };
  function bodiesNear(x, y, r) {
    const out = [];
    for (const o of letters) if (o.alive && o.body && Math.hypot(o.body.position.x - x, o.body.position.y - y) < r) out.push(o);
    for (const o of images) if (o.alive && !o.melt) { const b = o.body.bounds; const cx = clamp(x, b.min.x, b.max.x), cy = clamp(y, b.min.y, b.max.y); if (Math.hypot(cx - x, cy - y) < r) out.push(o); }
    return out;
  }
  function blast(x, y) {
    const R = 170;
    for (const o of bodiesNear(x, y, R)) {
      const p = o.body.position, dx = p.x - x, dy = p.y - y, d = Math.max(8, Math.hypot(dx, dy)), k = (1 - Math.min(1, d / R)) ** 0.7;
      const pow = o.kind === 'I' ? 14 : 26;
      release(o, dx / d * pow * k + rand(-2, 2), dy / d * pow * k - rand(3, 9) * k, rand(-0.5, 0.5));
    }
    shake = Math.max(shake, 18);
    rings.push({ x, y, r: 10, max: 260, life: 1, color: '255,170,90', w: 10 });
    rings.push({ x, y, r: 4, max: 140, life: 1, color: '255,255,255', w: 3 });
    for (let i = 0; i < 70; i++) { const a = rand(0, Math.PI * 2), v = rand(3, 16); particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, life: rand(0.5, 1.2), size: rand(1.5, 4), color: Math.random() < 0.5 ? '255,200,90' : '255,110,40', g: 0.3, glow: true }); }
    for (let i = 0; i < 24; i++) { const a = rand(0, Math.PI * 2), v = rand(0.5, 3); particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: rand(1.2, 2.4), size: rand(14, 34), color: '60,55,52', g: -0.02, smoke: true }); }
    flash = 1; flashPos = { x, y };
    damage(x, y);
    dent(x, y, R);
    sfx.boom();
  }

  /* ------------------------------------------------------------------ damage that becomes part of the page */
  // one crack: a jagged, tapering line with a dark groove and a lit lip, branching as it goes
  function crack(x, y, a, len, w, depth) {
    let cx = x, cy = y, left = len;
    while (left > 0 && w > 0.25) {
      const step = Math.min(left, rand(7, 15)); a += rand(-0.38, 0.38);
      const nx = cx + Math.cos(a) * step, ny = cy + Math.sin(a) * step;
      sc.strokeStyle = `rgba(28,20,14,${0.55 + 0.3 * Math.min(1, w / 2)})`; sc.lineWidth = w; sc.lineCap = 'round';
      sc.beginPath(); sc.moveTo(cx, cy); sc.lineTo(nx, ny); sc.stroke();
      hlc.strokeStyle = `rgba(255,255,255,${0.55 * Math.min(1, w / 1.6)})`; hlc.lineWidth = Math.max(0.5, w * 0.45); hlc.lineCap = 'round';
      hlc.beginPath(); hlc.moveTo(cx + w * 0.55, cy + w * 0.55); hlc.lineTo(nx + w * 0.55, ny + w * 0.55); hlc.stroke();
      if (depth < 2 && Math.random() < 0.2) crack(nx, ny, a + (Math.random() < 0.5 ? -1 : 1) * rand(0.45, 1), left * rand(0.25, 0.55), w * 0.6, depth + 1);
      cx = nx; cy = ny; left -= step; w *= 0.93;
    }
    return { x: cx, y: cy };
  }
  function damage(x, y) {
    const R = rand(80, 130), n = 7 + Math.floor(rand(0, 5)), spokes = [];
    // soot: a few irregular soft burns, multiplied into whatever is underneath
    for (let i = 0; i < 6; i++) {
      const ox = x + rand(-18, 18), oy = y + rand(-18, 18), r = rand(26, 62);
      const g = sc.createRadialGradient(ox, oy, 0, ox, oy, r); g.addColorStop(0, `rgba(36,24,16,${rand(0.16, 0.3)})`); g.addColorStop(0.6, 'rgba(60,40,26,.08)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      sc.fillStyle = g; sc.beginPath(); sc.arc(ox, oy, r, 0, Math.PI * 2); sc.fill();
    }
    // the crater: shaded like a dent (dark lower-right, lit upper-left)
    const cr = rand(10, 16);
    const dg = sc.createRadialGradient(x + cr * 0.35, y + cr * 0.35, 0, x, y, cr * 1.6); dg.addColorStop(0, 'rgba(20,14,10,.55)'); dg.addColorStop(1, 'rgba(20,14,10,0)');
    sc.fillStyle = dg; sc.beginPath(); sc.arc(x, y, cr * 1.6, 0, Math.PI * 2); sc.fill();
    hlc.strokeStyle = 'rgba(255,255,255,.55)'; hlc.lineWidth = 1.5; hlc.beginPath(); hlc.arc(x, y, cr, Math.PI * 0.95, Math.PI * 1.75); hlc.stroke();
    // radial cracks
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rand(-0.3, 0.3); spokes.push(a); crack(x + Math.cos(a) * cr * 0.8, y + Math.sin(a) * cr * 0.8, a, R * rand(0.55, 1.25), rand(1.5, 2.6), 0); }
    // ring fractures between neighbouring spokes, like struck glass or plaster
    for (const rr of [R * rand(0.22, 0.3), R * rand(0.45, 0.58)]) {
      for (let i = 0; i < n; i++) {
        if (Math.random() < 0.35) continue;
        const a0 = spokes[i], a1 = spokes[(i + 1) % n] + (i === n - 1 ? Math.PI * 2 : 0), segs = 3;
        sc.strokeStyle = 'rgba(28,20,14,.5)'; sc.lineWidth = rand(0.7, 1.3); sc.beginPath();
        for (let k = 0; k <= segs; k++) { const a = a0 + (a1 - a0) * k / segs, r = rr * rand(0.9, 1.1); const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; k ? sc.lineTo(px, py) : sc.moveTo(px, py); }
        sc.stroke();
      }
    }
    // chips knocked out near the impact
    for (let i = 0; i < 6; i++) {
      const a = rand(0, Math.PI * 2), d = rand(cr, cr * 3), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d, r = rand(2, 6);
      sc.fillStyle = 'rgba(40,28,20,.35)'; sc.beginPath();
      for (let k = 0; k < 5; k++) { const b = k / 5 * Math.PI * 2 + rand(-0.3, 0.3), q = r * rand(0.6, 1.2); k ? sc.lineTo(px + Math.cos(b) * q, py + Math.sin(b) * q) : sc.moveTo(px + Math.cos(b) * q, py + Math.sin(b) * q); }
      sc.closePath(); sc.fill();
      hlc.strokeStyle = 'rgba(255,255,255,.45)'; hlc.lineWidth = 0.8; hlc.beginPath(); hlc.arc(px, py, r * 0.8, Math.PI, Math.PI * 1.6); hlc.stroke();
    }
  }
  // the page's own boxes (cards, inputs, buttons) get knocked askew by the shockwave and stay that way
  function dent(x, y, R) {
    const seen = new Set();
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2, d = i % 2 ? R * 0.35 : R * 0.8;
      for (const el of document.elementsFromPoint(x + Math.cos(a) * d, y + Math.sin(a) * d)) {
        if (seen.has(el) || el === host || el === scorchHost || el === document.body || el === document.documentElement) continue; seen.add(el);
        const r = el.getBoundingClientRect(); if (r.width < 36 || r.height < 18 || r.width > W * 0.7 || r.height > Hh * 0.6) continue;
        const cs = getComputedStyle(el), boxy = (cs.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) || parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== 'none';
        if (!boxy || cs.position === 'fixed') continue;
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2, dd = Math.max(20, Math.hypot(cx - x, cy - y)), k = Math.max(0, 1 - dd / (R * 1.8)); if (k <= 0.05) continue;
        const st = el.__hv || (el.__hv = { r: 0, x: 0, y: 0, init: false });
        if (!st.init) { st.init = true; hideEl(el, 'transition', 'transform .45s cubic-bezier(.2,1.5,.4,1)'); hideEl(el, 'transform', 'none'); restore.push(() => { delete el.__hv; }); }
        const side = Math.sign((cx - x) || 1);
        st.r = Math.max(-9, Math.min(9, st.r + side * rand(1.2, 3.6) * k)); st.x += (cx - x) / dd * 9 * k; st.y += (cy - y) / dd * 7 * k + 2 * k;
        el.style.setProperty('transform', `translate(${st.x.toFixed(1)}px,${st.y.toFixed(1)}px) rotate(${st.r.toFixed(2)}deg)`, 'important');
        break; // one box per sample point: the innermost card
      }
    }
  }
  function melt(x, y) {
    const R = 110; let hitAny = false;
    for (const o of images) if (o.alive && !o.melt) { const b = o.body.bounds; if (x >= b.min.x && x <= b.max.x && y >= b.min.y && y <= b.max.y) { startMelt(o, x, y); hitAny = true; } }
    for (const o of letters) {
      if (!o.alive || o.drip) continue;
      const p = o.body.position, d = Math.hypot(p.x - x, p.y - y); if (d > R) continue;
      o.drip = { vy: rand(0.05, 0.3), a: rand(0.004, 0.02), delay: d * rand(4, 9), y: 0, len: 0, x0: p.x - o.w / 2, y0: p.y - o.h / 2, ang: o.body.angle };
      Composite.remove(engine.world, o.body);
      o.el.classList.add('drip');
      hitAny = true;
    }
    if (hitAny) { sfx.goo(); for (let i = 0; i < 16; i++) particles.push({ x: x + rand(-30, 30), y: y + rand(-10, 10), vx: rand(-1, 1), vy: rand(0, 2), life: rand(0.6, 1.4), size: rand(2, 5), color: '255,80,170', g: 0.15, glow: true }); }
  }
  function openHole(x, y) {
    holes.push({ x, y, r: 0, max: 280, t: 0, life: 7, eaten: 0 });
    sfx.hole(); shake = Math.max(shake, 6);
  }
  function collapse() {
    shake = 34; sfx.quake();
    const all = [...letters, ...images].filter(o => o.alive && !o.melt && !o.drip);
    for (const o of all) {
      const y = o.body.position.y;
      setTimeout(() => { if (H.active) release(o, rand(-1.5, 1.5), rand(-2, 1), rand(-0.08, 0.08)); }, (Hh - y) * 1.6 + rand(0, 260));
    }
    for (let i = 0; i < 40; i++) particles.push({ x: rand(0, W), y: Hh + 10, vx: rand(-1, 1), vy: rand(-3, -1), life: rand(1.5, 3), size: rand(20, 50), color: '120,110,100', g: -0.01, smoke: true });
  }
  function toggleZeroG() {
    zeroG = !zeroG; engine.gravity.y = zeroG ? 0 : 1;
    if (zeroG) for (const o of [...letters, ...images]) if (o.alive && o.body && !o.melt && !o.drip) release(o, rand(-1.2, 1.2), rand(-2.2, -0.3), rand(-0.03, 0.03));
    tone(zeroG ? 300 : 900, zeroG ? 900 : 300, 0.5, { gain: 0.15, type: 'triangle' });
    syncHud();
  }
  function kill(o) {
    if (!o.alive) return; o.alive = false;
    if (o.body) Composite.remove(engine.world, o.body);
    o.el.remove();
  }

  /* ------------------------------------------------------------------ frame loop */
  let flash = 0, flashPos = { x: 0, y: 0 }, rainAcc = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.033, (now - (lastT || now)) / 1000); lastT = now;
    // black holes pull
    for (const h of holes) {
      h.t += dt; h.r = Math.min(h.max, h.r + dt * 160);
      const fading = h.t > h.life - 1;
      for (const o of [...letters, ...images]) {
        if (!o.alive || o.drip || o.melt || !o.body) continue;
        const p = o.body.position, dx = h.x - p.x, dy = h.y - p.y, d = Math.hypot(dx, dy);
        if (d > h.r || fading) continue;
        if (o.body.isStatic) release(o, 0, 0, 0);
        const f = (o.kind === 'I' ? 0.00035 : 0.00009) * o.body.mass * clamp(260 / (d + 20), 0.6, 9);
        Body.applyForce(o.body, p, { x: dx / d * f + (-dy / d) * f * 0.9, y: dy / d * f + (dx / d) * f * 0.9 });
        if (d < (o.kind === 'I' ? 40 : 16)) { h.eaten++; sfx.pop(); spaghettify(o, h); }
      }
    }
    holes = holes.filter(h => h.t < h.life);
    // rain
    if (raining) {
      rainAcc += dt * 70;
      while (rainAcc > 1) { rainAcc--; drops.push({ x: rand(-40, W + 40), y: rand(-60, -10), vx: 1.4, vy: rand(14, 20), len: rand(10, 22) }); }
    }
    for (const d of drops) {
      d.x += d.vx; d.y += d.vy;
      const hitBodies = Query.point(Composite.allBodies(engine.world), { x: d.x, y: d.y });
      let hitIt = null; for (const b of hitBodies) { const o = bodyMap.get(b.id); if (o && o.alive) { hitIt = o; break; } }
      if (hitIt) {
        d.dead = true; splash(d.x, d.y, 5);
        if (hitIt.kind === 'L') { if (hitIt.body.isStatic) { if (Math.random() < 0.55) release(hitIt, rand(-0.5, 0.5), rand(0.5, 2), rand(-0.1, 0.1)); } else Body.applyForce(hitIt.body, hitIt.body.position, { x: 0, y: 0.00025 * hitIt.body.mass }); sfx.plink(); }
        else if (hitIt.kind === 'I' && !hitIt.melt) {
          const b = hitIt.body, lx = d.x - (b.position.x - hitIt.w / 2), ly = d.y - (b.position.y - hitIt.h / 2);
          if (Math.abs(b.angle) < 0.05) {
            const near = hitIt.beads.find(bd => Math.hypot(bd.x - lx, bd.y - ly) < bd.r + 4);
            if (near) { near.r = Math.min(16, near.r + 0.9); near.wait = Math.min(near.wait, 0.1); }
            else if (hitIt.beads.length < 60) hitIt.beads.push({ x: lx, y: ly, r: rand(3, 7), vy: 0, wait: rand(0.4, 3), seed: rand(0, 9), trail: [] });
            if (Math.random() < 0.35) hitIt.ripples.push({ y: ly, amp: rand(2, 5), t0: hitIt.t });
            hitIt.dirty = true;
          }
          sfx.plink();
        }
      } else if (d.y > Hh) { d.dead = true; splash(d.x, Hh - 2, 3); }
    }
    drops = drops.filter(d => !d.dead);
    // physics
    const steps = Math.ceil(dt * 1000 / 16.6);
    for (let i = 0; i < steps; i++) Engine.update(engine, dt * 1000 / steps);
    // sync DOM
    for (const o of letters) {
      if (!o.alive) continue;
      if (o.drip) {
        const dr = o.drip;
        if (dr.delay > 0) { dr.delay -= dt * 1000; continue; }
        dr.vy += dr.a * 60 * dt; dr.y += dr.vy * 60 * dt; dr.len = Math.min(dr.y * 1.1, 240);
        o.el.style.transform = `translate(${dr.x0}px,${dr.y0 + dr.y}px) rotate(${dr.ang}rad) scaleY(${1 + Math.min(1.4, dr.y / 160)})`;
        o.el.style.setProperty('--trail', dr.len + 'px');
        if (dr.y > 60) o.el.style.opacity = String(Math.max(0, 1 - (dr.y - 60) / 260));
        if (dr.y > 330 || dr.y0 + dr.y > Hh + 40) kill(o);
        continue;
      }
      const b = o.body; if (b.isStatic || b.isSleeping) continue;
      o.el.style.transform = `translate(${b.position.x - o.w / 2}px,${b.position.y - o.h / 2}px) rotate(${b.angle}rad)`;
      if (b.position.y > Hh + 400 || b.position.x < -600 || b.position.x > W + 600) kill(o);
    }
    for (const o of images) {
      if (!o.alive) continue;
      const b = o.body;
      if (!o.melt && !b.isStatic && !b.isSleeping) o.el.style.transform = `translate(${b.position.x - o.w / 2}px,${b.position.y - o.h / 2}px) rotate(${b.angle}rad)`;
      if (o.ready && (o.dirty || o.melt || o.ripples.length || o.beads.length && o.beads.some(bd => bd.wait > 0 || bd.r > 3.2))) renderImage(o, dt);
      if (!o.melt && (b.position.y > Hh + 900)) kill(o);
    }
    drawFx(dt);
    // screen shake
    if (shake > 0.3) { stage.style.transform = `translate(${rand(-shake, shake)}px,${rand(-shake, shake)}px)`; shake *= 0.88; }
    else if (shake) { shake = 0; stage.style.transform = ''; }
  }
  function spaghettify(o, h) {
    o.alive = false; Composite.remove(engine.world, o.body);
    const el = o.el; el.style.transition = 'transform .45s cubic-bezier(.6,0,.9,.4), opacity .45s';
    el.style.transform = `translate(${h.x - o.w / 2}px,${h.y - o.h / 2}px) rotate(${rand(3, 9)}rad) scale(0.05)`; el.style.opacity = '0';
    setTimeout(() => el.remove(), 480);
    for (let i = 0; i < 4; i++) particles.push({ x: h.x + rand(-6, 6), y: h.y + rand(-6, 6), vx: rand(-1, 1), vy: rand(-1, 1), life: 0.5, size: rand(1, 3), color: '200,170,255', g: 0, glow: true });
  }
  function splash(x, y, n) {
    for (let i = 0; i < n; i++) particles.push({ x, y, vx: rand(-2.2, 2.2), vy: rand(-3.5, -0.5), life: rand(0.25, 0.5), size: rand(1, 2.2), color: '170,220,255', g: 0.35 });
  }

  function drawFx(dt) {
    const c = fxc; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, Hh);
    // rain streaks
    if (drops.length) {
      c.strokeStyle = 'rgba(170,215,255,.55)'; c.lineWidth = 1.2; c.beginPath();
      for (const d of drops) { c.moveTo(d.x, d.y); c.lineTo(d.x - d.vx * d.len / d.vy, d.y - d.len); }
      c.stroke();
    }
    // black holes
    for (const h of holes) {
      const fade = h.t > h.life - 1 ? Math.max(0, h.life - h.t) : Math.min(1, h.t * 2);
      const core = 22 + Math.min(18, h.eaten * 0.15);
      const g = c.createRadialGradient(h.x, h.y, core * 0.6, h.x, h.y, core * 4.5);
      g.addColorStop(0, `rgba(0,0,0,${fade})`); g.addColorStop(0.18, `rgba(40,0,70,${0.85 * fade})`); g.addColorStop(0.32, `rgba(180,120,255,${0.45 * fade})`); g.addColorStop(0.45, `rgba(255,170,90,${0.18 * fade})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(h.x, h.y, core * 4.5, 0, Math.PI * 2); c.fill();
      c.save(); c.translate(h.x, h.y); c.rotate(h.t * 2.2);
      for (let i = 0; i < 3; i++) { c.rotate(Math.PI * 2 / 3); c.strokeStyle = `rgba(220,190,255,${0.5 * fade})`; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, core * 2.3, core * 0.75, 0, 0, Math.PI * 1.2); c.stroke(); }
      c.restore();
      c.fillStyle = `rgba(0,0,0,${fade})`; c.beginPath(); c.arc(h.x, h.y, core, 0, Math.PI * 2); c.fill();
      c.strokeStyle = `rgba(255,220,180,${0.8 * fade})`; c.lineWidth = 1.5; c.beginPath(); c.arc(h.x, h.y, core + 1.5, 0, Math.PI * 2); c.stroke();
      if (h.r < h.max) { c.strokeStyle = `rgba(178,140,255,${0.25 * (1 - h.r / h.max)})`; c.lineWidth = 1; c.beginPath(); c.arc(h.x, h.y, h.r, 0, Math.PI * 2); c.stroke(); }
    }
    // shockwave rings
    for (const r of rings) { r.r += (r.max - r.r) * 0.16; r.life -= dt * 2.2; c.strokeStyle = `rgba(${r.color},${Math.max(0, r.life)})`; c.lineWidth = r.w * Math.max(0, r.life); c.beginPath(); c.arc(r.x, r.y, r.r, 0, Math.PI * 2); c.stroke(); }
    rings = rings.filter(r => r.life > 0);
    // flash
    if (flash > 0) { const g = c.createRadialGradient(flashPos.x, flashPos.y, 0, flashPos.x, flashPos.y, 260); g.addColorStop(0, `rgba(255,240,200,${flash})`); g.addColorStop(1, 'rgba(255,200,120,0)'); c.fillStyle = g; c.fillRect(0, 0, W, Hh); flash -= dt * 5; }
    // particles
    for (const p of particles) {
      p.vx *= 0.985; p.vy = p.vy * 0.985 + p.g; p.x += p.vx; p.y += p.vy; p.life -= dt;
      const a = Math.max(0, Math.min(1, p.life));
      if (p.smoke) { const s = p.size * (2 - a); const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, s); g.addColorStop(0, `rgba(${p.color},${0.35 * a})`); g.addColorStop(1, `rgba(${p.color},0)`); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, s, 0, Math.PI * 2); c.fill(); continue; }
      if (p.glow) { c.shadowColor = `rgba(${p.color},1)`; c.shadowBlur = 8; }
      c.fillStyle = `rgba(${p.color},${a})`; c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill();
      c.shadowBlur = 0;
    }
    particles = particles.filter(p => p.life > 0);
    if (particles.length > 900) particles.splice(0, particles.length - 900);
    // reticle
    if (pointer.inside) {
      const t = TOOLS.find(x => x.id === tool) || TOOLS[0], x = pointer.x, y = pointer.y, now = performance.now() / 1000;
      c.strokeStyle = t.color; c.fillStyle = t.color; c.lineWidth = 1.5; c.shadowColor = t.color; c.shadowBlur = 10;
      if (tool === 'grab') { c.beginPath(); c.arc(x, y, pointer.down ? 6 : 9, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(x, y, 2, 0, Math.PI * 2); c.fill(); }
      else if (tool === 'blast') { const r = 16 + Math.sin(now * 6) * 2; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + now; c.beginPath(); c.moveTo(x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4)); c.lineTo(x + Math.cos(a) * (r + 11), y + Math.sin(a) * (r + 11)); c.stroke(); } c.globalAlpha = 0.12; c.beginPath(); c.arc(x, y, 170, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1; }
      else if (tool === 'melt') { c.beginPath(); c.moveTo(x, y - 14); c.bezierCurveTo(x + 10, y - 2, x + 9, y + 10, x, y + 10); c.bezierCurveTo(x - 9, y + 10, x - 10, y - 2, x, y - 14); c.stroke(); c.globalAlpha = 0.12; c.beginPath(); c.arc(x, y, 110, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1; }
      else if (tool === 'hole') { c.beginPath(); c.arc(x, y, 12, now * 3, now * 3 + Math.PI * 1.5); c.stroke(); c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill(); }
      else { c.beginPath(); c.moveTo(x - 10, y); c.lineTo(x + 10, y); c.moveTo(x, y - 10); c.lineTo(x, y + 10); c.stroke(); }
      c.shadowBlur = 0;
    }
  }

  /* ------------------------------------------------------------------ input */
  function onDown(e) {
    if (e.button !== 0) return;
    pointer.down = true; const x = e.clientX, y = e.clientY;
    if (tool === 'grab') {
      // pull a static piece loose so the mouse constraint can grab it
      const hits = Query.point(Composite.allBodies(engine.world), { x, y });
      for (const b of hits) { const o = bodyMap.get(b.id); if (o && o.alive && b.isStatic) { release(o); sfx.click(); } }
    } else if (tool === 'blast') blast(x, y);
    else if (tool === 'melt') melt(x, y);
    else if (tool === 'hole') openHole(x, y);
    else if (tool === 'rain') setRain(!raining);
    else if (tool === 'quake') collapse();
    else if (tool === 'zerog') toggleZeroG();
  }
  function onMove(e) { pointer.x = e.clientX; pointer.y = e.clientY; pointer.inside = true; if (tool === 'melt' && pointer.down && Math.random() < 0.25) melt(pointer.x, pointer.y); }
  function onKey(e) {
    if (!H.active) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); stop(); return; }
    const t = TOOLS.find(t => t.key === e.key); if (t) { e.preventDefault(); e.stopPropagation(); pick(t.id); }
    if (e.key.toLowerCase() === 'm' && !e.metaKey && !e.ctrlKey) { muted = !muted; syncHud(); }
  }
  function setRain(on) {
    raining = on; syncHud();
    if (on) { noise(0.8, { freq: 3000, type: 'highpass', gain: 0.12, attack: 0.3 }); rainHiss(); }
  }
  let hissNode = null;
  function rainHiss() {
    const a = audio(); if (!a || hissNode) return;
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = 'highpass'; f.frequency.value = 2500; g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.06, a.currentTime + 0.8);
    s.connect(f).connect(g).connect(master); s.start(); hissNode = { s, g };
    const check = setInterval(() => { if (!raining || !H.active || muted) { clearInterval(check); try { g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.5); s.stop(a.currentTime + 0.6); } catch (e) {} hissNode = null; } }, 200);
  }
  function pick(id) {
    if (id === 'rain') { tool = 'rain'; setRain(!raining); }
    else if (id === 'zerog') { toggleZeroG(); return; }
    else if (id === 'quake') { collapse(); return; }
    else tool = id;
    mcon.collisionFilter.mask = tool === 'grab' ? 0xFFFFFFFF : 0;
    sfx.click(); syncHud();
  }

  /* ------------------------------------------------------------------ HUD */
  const CSS = `
  :host{all:initial}
  *{box-sizing:border-box}
  .stage{position:fixed;inset:0;pointer-events:none;overflow:hidden;contain:strict}
  .l{position:absolute;left:0;top:0;white-space:pre;text-align:center;will-change:transform;transform-origin:50% 50%;user-select:none;font-kerning:none;margin:0;padding:0;letter-spacing:0;word-spacing:0;text-decoration:none;-webkit-font-smoothing:antialiased}
  .l.drip{transform-origin:50% 0}
  .l.drip::after{content:"";position:absolute;left:38%;width:24%;bottom:100%;height:var(--trail,0px);background:linear-gradient(to top,currentColor,transparent);border-radius:0 0 50% 50%;opacity:.55}
  .img{position:absolute;left:0;top:0;will-change:transform;transform-origin:50% 50%}
  canvas.fx,canvas.scorch{position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none}
  .hit{position:fixed;inset:0;cursor:none;pointer-events:auto;background:transparent}
  .hud{position:fixed;left:50%;bottom:22px;transform:translateX(-50%) translateY(0);display:flex;align-items:center;gap:4px;padding:7px;border-radius:20px;
       background:linear-gradient(180deg,rgba(28,28,36,.82),rgba(12,12,18,.9));backdrop-filter:blur(18px) saturate(1.4);-webkit-backdrop-filter:blur(18px) saturate(1.4);
       border:1px solid rgba(255,255,255,.1);box-shadow:0 0 0 1px rgba(0,0,0,.4),0 18px 50px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.08);
       font:500 12px/1 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#e9e7f2;pointer-events:auto;animation:rise .5s cubic-bezier(.2,1.2,.3,1)}
  @keyframes rise{from{transform:translateX(-50%) translateY(40px);opacity:0}}
  .brand{display:flex;align-items:center;gap:7px;padding:0 10px 0 8px;font-weight:800;letter-spacing:.14em;font-size:11px;color:#fff}
  .brand i{width:9px;height:9px;border-radius:50%;background:#ff3b3b;box-shadow:0 0 10px #ff3b3b,0 0 2px #fff inset;animation:pulse 1.4s infinite}
  @keyframes pulse{50%{opacity:.45}}
  .sep{width:1px;height:26px;background:rgba(255,255,255,.1);margin:0 4px}
  button{all:unset;position:relative;width:40px;height:40px;border-radius:13px;display:grid;place-items:center;cursor:pointer;color:#bdbacb;transition:background .15s,color .15s,transform .1s}
  button:hover{background:rgba(255,255,255,.07);color:#fff}
  button:active{transform:scale(.92)}
  button svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
  button.on{color:var(--c);background:color-mix(in srgb,var(--c) 16%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--c) 45%,transparent),0 0 18px color-mix(in srgb,var(--c) 30%,transparent)}
  button.on svg{filter:drop-shadow(0 0 6px var(--c))}
  button .k{position:absolute;right:4px;bottom:3px;font-size:8.5px;opacity:.45;font-weight:700}
  .tip{position:fixed;bottom:84px;left:50%;transform:translateX(-50%);padding:8px 12px;border-radius:10px;background:rgba(12,12,18,.92);border:1px solid rgba(255,255,255,.1);color:#fff;font:500 12px/1.3 ui-sans-serif,system-ui,sans-serif;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .15s, transform .15s;box-shadow:0 10px 30px rgba(0,0,0,.4)}
  .tip b{color:var(--c)}
  .tip.show{opacity:1}
  .intro{position:fixed;left:0;right:0;top:0;height:3px;background:linear-gradient(90deg,transparent,#ff3b3b,#ffb35c,transparent);box-shadow:0 0 30px 6px rgba(255,80,60,.6);pointer-events:none;animation:scan 1s cubic-bezier(.5,0,.2,1) forwards}
  @keyframes scan{to{transform:translateY(100vh);opacity:.2}}
  .stamp{position:fixed;left:50%;top:44%;transform:translate(-50%,-50%) scale(.6);font:900 54px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.3em;color:#fff;text-shadow:0 0 30px rgba(255,60,60,.9),0 0 2px #fff;pointer-events:none;opacity:0;animation:stamp 1.2s ease forwards}
  @keyframes stamp{15%{opacity:1;transform:translate(-50%,-50%) scale(1.04)}30%{transform:translate(-50%,-50%) scale(1)}75%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1.15);filter:blur(6px)}}
  `;
  function buildHud() {
    hud = document.createElement('div'); hud.className = 'hud';
    const btn = (id, title, color, key) => `<button data-id="${id}" style="--c:${color || '#fff'}" aria-label="${title}">${'<svg viewBox="0 0 24 24">' + ICONS[id] + '</svg>'}${key ? `<span class="k">${key}</span>` : ''}</button>`;
    hud.innerHTML = `<div class="brand"><i></i>HAVOC</div><div class="sep"></div>` + TOOLS.map(t => btn(t.id, t.name, t.color, t.key)).join('') + `<div class="sep"></div>` + btn('sound', 'Sound', '#fff') + btn('reset', 'Restore page', '#fff') + btn('close', 'Exit (Esc)', '#fff');
    tipEl = document.createElement('div'); tipEl.className = 'tip';
    hud.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return; e.stopPropagation();
      const id = b.dataset.id;
      if (id === 'sound') { muted = !muted; if (!muted) sfx.click(); syncHud(); }
      else if (id === 'reset') { stop(); setTimeout(start, 60); }
      else if (id === 'close') stop();
      else pick(id);
    });
    hud.addEventListener('pointerover', e => {
      const b = e.target.closest('button'); if (!b) return;
      const t = TOOLS.find(x => x.id === b.dataset.id);
      const label = t ? `<b>${t.name}</b> · ${t.hint}` : b.dataset.id === 'sound' ? (muted ? 'Sound off · M' : 'Sound on · M') : b.dataset.id === 'reset' ? 'Rebuild the page and start over' : 'Exit and restore · Esc';
      tipEl.style.setProperty('--c', t ? t.color : '#fff'); tipEl.innerHTML = label; tipEl.classList.add('show');
    });
    hud.addEventListener('pointerout', () => tipEl.classList.remove('show'));
    root.appendChild(hud); root.appendChild(tipEl);
    syncHud();
  }
  function syncHud() {
    if (!hud) return;
    hud.querySelectorAll('button').forEach(b => {
      const id = b.dataset.id;
      b.classList.toggle('on', id === tool && id !== 'rain' || (id === 'rain' && raining) || (id === 'zerog' && zeroG));
      if (id === 'sound') b.innerHTML = `<svg viewBox="0 0 24 24">${muted ? ICONS.mute : ICONS.sound}</svg>`;
    });
  }

  /* ------------------------------------------------------------------ lifecycle */
  function sizeCanvas(cv) { cv.width = Math.round(W * DPR); cv.height = Math.round(Hh * DPR); }
  function start() {
    if (H.active) return;
    H.active = true; W = innerWidth; Hh = innerHeight; DPR = Math.min(2, devicePixelRatio || 1);
    letters = []; images = []; bodyMap = new Map(); restore = []; particles = []; rings = []; holes = []; drops = []; shake = 0; raining = false; zeroG = false; tool = 'blast';
    host = document.createElement('div'); host.id = 'havoc-host';
    host.style.cssText = 'position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;display:block!important;margin:0!important;padding:0!important;border:0!important;background:none!important;transform:none!important;filter:none!important';
    root = host.attachShadow({ mode: 'open' });
    const st = document.createElement('style'); st.textContent = CSS; root.appendChild(st);
    stage = document.createElement('div'); stage.className = 'stage';
    // damage is burned *into* the page: a multiply layer under the physics, plus a thin highlight layer for chipped edges
    scorchHost = document.createElement('div'); scorchHost.id = 'havoc-scorch';
    scorchHost.style.cssText = 'position:fixed!important;inset:0!important;z-index:2147483646!important;pointer-events:none!important;mix-blend-mode:multiply!important;display:block!important;margin:0!important;padding:0!important;background:none!important';
    scorch = document.createElement('canvas'); scorch.style.cssText = 'position:absolute;inset:0;width:100vw;height:100vh'; sizeCanvas(scorch); sc = scorch.getContext('2d'); sc.setTransform(DPR, 0, 0, DPR, 0, 0);
    scorchHost.appendChild(scorch); document.documentElement.appendChild(scorchHost);
    hl = document.createElement('canvas'); hl.className = 'scorch'; sizeCanvas(hl); hlc = hl.getContext('2d'); hlc.setTransform(DPR, 0, 0, DPR, 0, 0);
    fx = document.createElement('canvas'); fx.className = 'fx'; sizeCanvas(fx); fxc = fx.getContext('2d');
    hit = document.createElement('div'); hit.className = 'hit';
    root.append(hl, stage, fx, hit);

    // lock scrolling while the page is "live"
    const de = document.documentElement, bd = document.body;
    for (const el of [de, bd]) if (el) hideEl(el, 'overflow', 'hidden');

    engine = Engine.create({ enableSleeping: true, positionIterations: 6, velocityIterations: 4 });
    engine.gravity.y = 1;
    const T = 200;
    walls = [
      Bodies.rectangle(W / 2, Hh + T / 2, W * 3, T, { isStatic: true, label: 'wall', friction: 0.8 }),
      Bodies.rectangle(-T / 2, Hh / 2 - 1000, T, Hh + 4000, { isStatic: true, label: 'wall' }),
      Bodies.rectangle(W + T / 2, Hh / 2 - 1000, T, Hh + 4000, { isStatic: true, label: 'wall' }),
    ];
    Composite.add(engine.world, walls);

    // harvest + build (images first so text sits on top)
    const imgs = harvestImages();
    const { glyphs, parents } = harvestText();
    const bodies = [];
    for (const info of imgs) bodies.push(makeImage(info));
    for (const g of glyphs) bodies.push(makeLetter(g));
    parents.forEach(hideText);
    Composite.add(engine.world, bodies);

    mouse = Mouse.create(hit);
    mouse.pixelRatio = 1;
    mcon = MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.18, damping: 0.08, render: { visible: false } } });
    mcon.collisionFilter.mask = 0;
    Composite.add(engine.world, mcon);
    // matter's mouse swallows wheel events; let them through (scroll is locked anyway)
    try { hit.removeEventListener('wheel', mouse.mousewheel); hit.removeEventListener('mousewheel', mouse.mousewheel); hit.removeEventListener('DOMMouseScroll', mouse.mousewheel); } catch (e) {}

    hit.addEventListener('pointerdown', onDown);
    hit.addEventListener('pointermove', onMove);
    hit.addEventListener('pointerup', () => { pointer.down = false; });
    hit.addEventListener('pointerleave', () => { pointer.inside = false; pointer.down = false; });
    hit.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('keydown', onKey, true);
    addEventListener('resize', onResize);

    buildHud();
    const intro = document.createElement('div'); intro.className = 'intro'; root.appendChild(intro); setTimeout(() => intro.remove(), 1100);
    const stamp = document.createElement('div'); stamp.className = 'stamp'; stamp.textContent = 'HAVOC'; root.appendChild(stamp); setTimeout(() => stamp.remove(), 1300);
    sfx.arm();
    (document.fullscreenElement || document.documentElement).appendChild(host);
    lastT = 0; raf = requestAnimationFrame(frame);
    H.stats = { letters: letters.length, images: images.length };
  }
  let resizeT;
  function onResize() { clearTimeout(resizeT); resizeT = setTimeout(() => { if (H.active) { stop(); start(); } }, 300); }
  function stop() {
    if (!H.active) return;
    H.active = false; cancelAnimationFrame(raf); raining = false;
    removeEventListener('keydown', onKey, true); removeEventListener('resize', onResize);
    try { Engine.clear(engine); } catch (e) {}
    host && host.remove(); host = null; hud = null; scorchHost && scorchHost.remove(); scorchHost = null;
    for (let i = restore.length - 1; i >= 0; i--) { try { restore[i](); } catch (e) {} }
    // put style attributes back exactly as they were
    touched.forEach((orig, el) => { if (orig === null) { el.getAttribute('style'); /* forces Chrome to sync the lazily-serialized attribute */ if (!el.style.cssText.trim()) el.removeAttribute('style'); } else if (!el.style.cssText.trim() && orig.trim()) el.setAttribute('style', orig); });
    restore = []; touched = new Map(); letters = []; images = []; bodyMap.clear();
  }
  H.start = start; H.stop = stop;
  start();
})();
