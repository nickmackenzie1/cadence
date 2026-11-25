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
    // one Havoc (user, 2026-11-18: "Elements should be the go-to for everything destructive, but keep the words
    // floating and exploding"): the letters are physics; fire, lava, acid, rain and blasts are real Elements matter
    { id: 'grab',   key: '1', name: 'Grab',       hint: 'Drag & fling anything',              color: '#7cf7d4' },
    { id: 'blast',  key: '2', name: 'Blast',      hint: 'Click to detonate: words fly, the blast burns', color: '#ff7a3d' },
    { id: 'fire',   key: '3', name: 'Fire',       hint: 'Click or drag to set things alight; burning words float up', color: '#ffa94d' },
    { id: 'melt',   key: '4', name: 'Lava',       hint: 'Pour lava: text and images melt',    color: '#ff4fa3' },
    { id: 'acid',   key: '5', name: 'Acid',       hint: 'Drip acid: words dissolve',          color: '#a9e34b' },
    { id: 'rain',   key: '6', name: 'Rain',       hint: 'Toggle a storm of real water that pools on the cards', color: '#5cc8ff' },
    { id: 'hole',   key: '7', name: 'Black hole', hint: 'Click to open a singularity',         color: '#b28cff' },
    { id: 'zerog',  key: '8', name: 'Zero-G',     hint: 'Toggle gravity',                      color: '#ffe066' },
    { id: 'quake',  key: '9', name: 'Collapse',   hint: 'Bring the whole page down',           color: '#ff3b3b' },
    // 2026-11-20 (user: bombs that go off a couple of seconds later, a vacuum you drag around, a fan, a volcano)
    { id: 'bomb',   key: 'b', name: 'Bomb',       hint: 'Click to drop a bomb: it fizzes, flashes faster, then goes off. Click one to pick it up and throw it', color: '#ffb347' },
    { id: 'vac',    key: 'v', name: 'Vacuum',     hint: 'Hold and drag: sucks up words, fire, water, sand, everything', color: '#9ad1ff' },
    { id: 'fan',    key: 'f', name: 'Fan',        hint: 'Press where the fan goes, drag to aim, hold to blow', color: '#b8f2e6' },
    { id: 'volcano', key: 'u', name: 'Volcano',   hint: 'Click: lava wells up from the bottom of the page and erupts', color: '#ff6b3d' },
  ];
  const ICONS = {
    grab:  '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5V4a1.5 1.5 0 0 1 3 0v6m0-4.5a1.5 1.5 0 0 1 3 0V12m0-3.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.9-2.5L5 15.5a1.6 1.6 0 0 1 2.6-1.9L8 14"/>',
    blast: '<path d="M12 2l1.8 5.2L19 5l-2.2 5.2L22 12l-5.2 1.8L19 19l-5.2-2.2L12 22l-1.8-5.2L5 19l2.2-5.2L2 12l5.2-1.8L5 5l5.2 2.2z"/>',
    melt:  '<path d="M4 4h16v6c0 1.5-1 2-2 2s-1.5.8-1.5 2v3.5a1.5 1.5 0 0 1-3 0V13c0-1-.6-1.5-1.5-1.5S10.5 12 10.5 13v1.5a1.5 1.5 0 0 1-3 0V12c0-1-.5-1.5-1.5-1.5S4 10 4 9z"/>',
    rain:  '<path d="M7 15a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.3 1.5A3.8 3.8 0 0 1 17.5 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
    fire:  '<path d="M12 22c4 0 7-2.7 7-7 0-3.5-2.5-6-4-8-.5 2-1.5 3-3 3 0-3-1-6-4-8 0 4-4 7-4 12 0 4.3 3.4 8 8 8z"/>',
    acid:  '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"/><path d="M7.5 14h9"/>',
    fight: '<path d="M6 21l12-12M15 6l3-3 3 3-3 3M5 14l5 5M3 16l5 5"/><path d="M12 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/>',
    hole:  '<circle cx="12" cy="12" r="3.2"/><path d="M12 3a9 9 0 0 1 9 9M21 12a9 9 0 0 1-9 9M12 21a9 9 0 0 1-9-9M3 12a9 9 0 0 1 9-9" opacity=".55"/><path d="M12 6.5a5.5 5.5 0 0 1 5.5 5.5M6.5 12A5.5 5.5 0 0 0 12 17.5"/>',
    zerog: '<circle cx="12" cy="12" r="4"/><ellipse cx="12" cy="12" rx="10" ry="3.6" transform="rotate(-20 12 12)"/>',
    quake: '<path d="M3 21h18M5 21V9l4-3 4 3v12M13 21V12l3-2 3 2v9"/><path d="M8 11l1.5 2-1 2 1 2M16 14l-1 1.5 1 1.5"/>',
    bomb:  '<circle cx="11" cy="14" r="7"/><path d="M15.5 8.5 17 7"/><path d="M17 7c1-1 2.5-1 3.2-2.2M19 3v1.2M21.5 5.5h-1.2"/>',
    vac:   '<path d="M4 20h6l2-5"/><path d="M12 15 18 4"/><path d="M16.5 3.2 20 5.2"/><path d="M3 20.5c0-1.4 1-2.5 2.5-2.5"/><circle cx="8" cy="20" r="1.2"/>',
    fan:   '<circle cx="12" cy="12" r="1.6"/><path d="M12 10.4C12 6 14 3.5 16.5 4.5c2 .8 1 4-4.5 5.9"/><path d="M13.4 12.8c3.8 2.2 5 5.2 3 6.8-1.7 1.3-4.2-1-3.5-6.7"/><path d="M10.6 12.8c-3.8 2.2-7 1.7-7.3-.9-.3-2.1 3-2.9 7.3.9"/>',
    volcano: '<path d="M2 21h20L15 10h-6z"/><path d="M9 10l1.5 2.5L12 10.5l1.5 2L15 10"/><path d="M12 7c-.5-1.5.5-3 2-3.5M10 6.5C9 5 9.5 3 11 2"/>',
    more:  '<path d="m6 15 6-6 6 6"/>',
    tilt:  '<rect x="7" y="3" width="10" height="18" rx="2" transform="rotate(-18 12 12)"/><path d="M3 20c2 1 5 1.5 8 1.5"/>',
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
  // bare (Wizard vs bosses, 2026-11-18): no toolbar, no mouse tools, no keys; another game drives it through H.blast / H.melt / H.knock
  let bare = false;
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
    // a word landing (2026-11-19): a short, soft tap, louder for a harder hit, lower for bigger text
    tick(v, size) { noise(0.03 + Math.min(0.04, v * 0.002), { freq: clamp(3200 - size * 55, 700, 3000), q: 2.5, type: 'bandpass', gain: clamp(0.006 * v, 0.008, 0.14), attack: 0.002 }); },
  };
  let tickN = 0, tickT = 0;
  function landed(o, v) {
    const now = performance.now();
    if (now - tickT > 100) { tickT = now; tickN = 0; }
    if (tickN >= 6 || (o.lastTick && now - o.lastTick < 120)) return;   // a few at a time, so a pile settling is a patter, not a roar
    tickN++; o.lastTick = now; sfx.tick(v, o.h || 14);
  }

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
        cs = { font: `${c.fontStyle} ${c.fontWeight} ${c.fontSize} ${c.fontFamily}`, color, shadow: c.textShadow !== 'none' ? c.textShadow : '', transform: c.textTransform, ls: c.letterSpacing && c.letterSpacing !== 'normal' ? c.letterSpacing : '', feel: feelOf(parseFloat(c.fontSize) || 14, parseInt(c.fontWeight, 10) || 400) };
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
        out.push({ ch: text.substr(i - len + 1, len), x: r.left, y: r.top, w: r.width, h: r.height, cs, node: n, at: i - len + 1 });
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
  // Words (2026-11-19): the letters of a word travel as one piece of real text (one element, one body) until something
  // hits it hard enough, then it breaks into its letters right where it is. Five times fewer pieces for the browser
  // and the physics, and the page's own kerning while it's whole.
  // weight by size (2026-11-19): headings are dense and cut through the air, small print is light and drifts
  function feelOf(px, wt) {
    const k = clamp(px / 15, 0.6, 3.2), bold = wt >= 600 ? 1.15 : 1;
    return { density: 0.0016 * Math.pow(k, 0.9) * bold, frictionAir: clamp(0.022 / Math.pow(k, 1.3), 0.004, 0.04), restitution: clamp(0.34 - 0.06 * k, 0.12, 0.32) };
  }
  const BREAK = 15;   // a knock faster than this (px per step) breaks a word; so does slamming into something at 1.5×
  const shown = (g, first) => { const t = g.cs.transform; return t === 'uppercase' ? g.ch.toUpperCase() : t === 'lowercase' ? g.ch.toLowerCase() : t === 'capitalize' && first ? g.ch.toUpperCase() : g.ch; };
  function groupWords(glyphs) {
    const out = []; let cur = null;
    for (const g of glyphs) {
      const joins = cur && cur.node === g.node && g.at === cur.end && Math.abs(g.y - cur.y) < g.h * 0.5 && g.cs === cur.cs;
      if (joins) { cur.gs.push(g); cur.end = g.at + g.ch.length; }
      else { cur = { node: g.node, end: g.at + g.ch.length, y: g.y, cs: g.cs, gs: [g] }; out.push(cur); }
    }
    return out.map(w => w.gs);
  }
  function makeWord(gs) {
    if (gs.length === 1) return makeLetter(gs[0], true);
    const cs = gs[0].cs, x0 = Math.min(...gs.map(g => g.x)), y0 = Math.min(...gs.map(g => g.y));
    const w = Math.max(...gs.map(g => g.x + g.w)) - x0, h = Math.max(...gs.map(g => g.y + g.h)) - y0;
    const el = document.createElement('div');
    el.className = 'l w'; el.textContent = gs.map((g, i) => shown(g, i === 0)).join('');
    el.style.cssText = `width:${w}px;height:${h}px;line-height:${h}px;font:${cs.font};color:${cs.color};${cs.shadow ? 'text-shadow:' + cs.shadow + ';' : ''}${cs.ls ? 'letter-spacing:' + cs.ls + ';' : ''}text-align:left;transform:translate(${x0}px,${y0}px)`;
    stage.appendChild(el);
    const body = Bodies.rectangle(x0 + w / 2, y0 + h / 2, Math.max(2, w), Math.max(2, h * 0.82), { friction: 0.4, slop: 0.02, label: 'W', ...cs.feel });
    Body.setStatic(body, true);
    // where each letter sits inside the word, from its centre
    const parts = gs.map((g, i) => ({ g, ch: shown(g, i === 0), dx: g.x + g.w / 2 - (x0 + w / 2), dy: g.y + g.h / 2 - (y0 + h / 2) }));
    const o = { kind: 'W', el, body, w, h, alive: true, color: cs.color, parts, home: [x0, y0], cs, src: gs[0].node.parentElement };
    bodyMap.set(body.id, o); letters.push(o);
    return body;
  }
  // a word breaks into its letters, each carrying on from where it was with the word's speed plus the knock
  function shatter(o, vx = 0, vy = 0, spin = 0) {
    if (!o.alive || o.kind !== 'W') return [];
    const b = o.body, a = b.angle, ca = Math.cos(a), sa = Math.sin(a), bv = b.isStatic ? { x: 0, y: 0 } : b.velocity, out = [];
    kill(o);
    for (const p of o.parts) {
      const x = b.position.x + p.dx * ca - p.dy * sa, y = b.position.y + p.dx * sa + p.dy * ca;
      const l = makeLetter({ ...p.g, ch: p.ch, x: x - p.g.w / 2, y: y - p.g.h / 2, home: [p.g.x, p.g.y] }, false, a);
      Composite.add(engine.world, l.body);
      const out_ = Math.sign(p.dx || rand(-1, 1));
      Body.setVelocity(l.body, { x: bv.x + vx + out_ * rand(0.5, 2.5), y: bv.y + vy + rand(-2, 1) }); Body.setAngularVelocity(l.body, spin + rand(-0.3, 0.3));
      out.push(l);
    }
    return out;
  }
  const breakQ = [];
  function makeLetter(g, frozen = true, angle = 0) {
    const el = document.createElement('div');
    el.className = 'l'; el.textContent = g.ch;
    el.style.cssText = `width:${g.w}px;height:${g.h}px;line-height:${g.h}px;font:${g.cs.font};color:${g.cs.color};${g.cs.shadow ? 'text-shadow:' + g.cs.shadow + ';' : ''}transform:translate(${g.x}px,${g.y}px)${angle ? ` rotate(${angle}rad)` : ''}`;
    if (g.cs.transform && g.cs.transform !== 'none') el.style.textTransform = 'none';
    stage.appendChild(el);
    const body = Bodies.rectangle(g.x + g.w / 2, g.y + g.h / 2, Math.max(2, g.w), Math.max(2, g.h * 0.82), {
      friction: 0.4, slop: 0.02, label: 'L', angle, ...(g.cs.feel || {})
    });
    if (frozen) Body.setStatic(body, true);   // freeze; created-static bodies can't be properly unfrozen in Matter
    const o = { kind: 'L', el, body, w: g.w, h: g.h, alive: true, color: g.cs.color, home: g.home || [g.x, g.y], cs: g.cs, src: g.node && g.node.parentElement };
    bodyMap.set(body.id, o); letters.push(o);
    return frozen ? body : o;
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
    const o = { kind: 'I', el: cv, ctx: cv.getContext('2d'), base, w, h, sx: cv.width / w, body: null, alive: true, melt: null, ripples: [], beads: [], dirty: true, ready: false, t: 0, home: [r.left, r.top] };
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
    if (!o.alive || !o.body || o.pinned) return;
    if (o.stamped) unstamp(o);
    if (o.kind === 'W' && Math.hypot(vx, vy) > BREAK) { shatter(o, vx, vy, spin); return; }
    if (o.body.isStatic) Body.setStatic(o.body, false);
    Sleeping.set(o.body, false);
    Body.setVelocity(o.body, { x: vx, y: vy }); Body.setAngularVelocity(o.body, spin);
  };
  function bodiesNear(x, y, r) {
    const out = [];
    for (const o of letters) {
      if (!o.alive || !o.body) continue;
      if (o.kind === 'W') { const b = o.body.bounds; if (Math.hypot(clamp(x, b.min.x, b.max.x) - x, clamp(y, b.min.y, b.max.y) - y) < r) out.push(o); }
      else if (Math.hypot(o.body.position.x - x, o.body.position.y - y) < r) out.push(o);
    }
    for (const o of images) if (o.alive && !o.melt) { const b = o.body.bounds; const cx = clamp(x, b.min.x, b.max.x), cy = clamp(y, b.min.y, b.max.y); if (Math.hypot(cx - x, cy - y) < r) out.push(o); }
    for (const o of loose) if (o.alive) { const b = o.body.bounds; if (Math.hypot(clamp(x, b.min.x, b.max.x) - x, clamp(y, b.min.y, b.max.y) - y) < r) out.push(o); }
    return out;
  }
  // Cadence listens for these and plays them out in its Elements matter layer too (fire, lava, real rain, swallowed sand)
  const tellFx = (type, x, y, extra) => { try { dispatchEvent(new CustomEvent('havoc:fx', { detail: { type, x, y, ...extra } })); } catch (e) {} };
  // pictures near a blast burst into their own pixels (2026-11-19), which become Elements matter: they fly, pour into
  // heaps, burn, get eaten by acid and run as coloured liquid when lava reaches them. Without the Elements layer
  // (reduce motion) a picture still flies off whole.
  const canPixels = () => !!window.CadenceFX && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  function burstImage(o, x, y, power = 2.4) {
    const b = o.body, left = b.position.x - o.w / 2, top = b.position.y - o.h / 2;
    tellFx('pixels', x, y, { canvas: o.base, left, top, w: o.w, h: o.h, power });
    kill(o);
  }
  function blast(x, y) {
    tellFx('blast', x, y);
    const R = 170;
    if (canPixels()) for (const o of images) {
      if (!o.alive || o.melt || !o.ready) continue; const bb = o.body.bounds;
      if (Math.hypot(clamp(x, bb.min.x, bb.max.x) - x, clamp(y, bb.min.y, bb.max.y) - y) < R * 0.45) burstImage(o, x, y);
    }
    for (const o of bodiesNear(x, y, R)) {
      const p = o.body.position, dx = p.x - x, dy = p.y - y, d = Math.max(8, Math.hypot(dx, dy)), k = (1 - Math.min(1, d / R)) ** 0.7;
      const pow = o.kind === 'I' ? 14 : 26;
      release(o, dx / d * pow * k + rand(-2, 2), dy / d * pow * k - rand(3, 9) * k, rand(-0.5, 0.5));
    }
    for (const c of cards) {
      if (c.loose) continue; const q = c.q, d = Math.hypot(clamp(x, q.l, q.r) - x, clamp(y, q.t, q.b) - y);
      if (d < R * 0.3 && (q.r - q.l) * (q.b - q.t) < W * Hh * 0.2) { const cx = (q.l + q.r) / 2, cy = (q.t + q.b) / 2, dd = Math.max(10, Math.hypot(cx - x, cy - y)); loosen(c, (cx - x) / dd * 9, (cy - y) / dd * 9 - 6, rand(-0.06, 0.06)); }
    }
    for (const b of bombs) if (!b.gone && Math.hypot(b.body.position.x - x, b.body.position.y - y) < 150) b.fuse = Math.min(b.fuse, b.t + rand(0.1, 0.22));
    shake = Math.max(shake, 18);
    rings.push({ x, y, r: 10, max: 260, life: 1, color: '255,170,90', w: 10 });
    rings.push({ x, y, r: 4, max: 140, life: 1, color: '255,255,255', w: 3 });
    for (let i = 0; i < 24; i++) { const a = rand(0, Math.PI * 2), v = rand(3, 16); particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, life: rand(0.5, 1.2), size: rand(1.5, 4), color: Math.random() < 0.5 ? '255,200,90' : '255,110,40', g: 0.3, glow: true }); }
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
  // the boxes a blast can knock: found once per Havoc (2026-11-19: it used to ask the page 28 times on every blast)
  let dentBoxes = null;
  function boxes() {
    if (dentBoxes) return dentBoxes;
    dentBoxes = [];
    const all = document.body ? document.body.querySelectorAll('*') : [];
    for (const el of all) {
      if (el === host || el === scorchHost || el.closest('#havoc-host, #havoc-scorch, #island, .isl, .hf-ui, #toast, .toast')) continue;
      const r = el.getBoundingClientRect(); if (!inView(r) || r.width < 36 || r.height < 18 || r.width > W * 0.7 || r.height > Hh * 0.6) continue;
      const cs = getComputedStyle(el), boxy = (cs.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) || parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== 'none';
      if (!boxy || cs.position === 'fixed' || cs.visibility === 'hidden') continue;
      dentBoxes.push({ el, l: r.left, t: r.top, r: r.right, b: r.bottom });
    }
    return dentBoxes;
  }
  function dent(x, y, R) {
    // the boxes the blast reaches; of nested ones, only the innermost (the card, not the column it sits in)
    const hitB = boxes().filter(q => Math.hypot(clamp(x, q.l, q.r) - x, clamp(y, q.t, q.b) - y) < R * 0.8);
    const inner = hitB.filter(q => !hitB.some(z => z !== q && z.l >= q.l && z.r <= q.r && z.t >= q.t && z.b <= q.b));
    for (const q of inner) {
      const el = q.el, r = { left: q.l, top: q.t, width: q.r - q.l, height: q.b - q.t };
      if (el.__loose) continue;
      {
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2, dd = Math.max(20, Math.hypot(cx - x, cy - y)), k = Math.max(0, 1 - dd / (R * 1.8)); if (k <= 0.05) continue;
        const st = el.__hv || (el.__hv = { r: 0, x: 0, y: 0, init: false });
        if (!st.init) { st.init = true; hideEl(el, 'transition', 'transform .45s cubic-bezier(.2,1.5,.4,1)'); hideEl(el, 'transform', 'none'); restore.push(() => { delete el.__hv; }); }
        const side = Math.sign((cx - x) || 1);
        st.r = Math.max(-9, Math.min(9, st.r + side * rand(1.2, 3.6) * k)); st.x += (cx - x) / dd * 9 * k; st.y += (cy - y) / dd * 7 * k + 2 * k;
        el.style.setProperty('transform', `translate(${st.x.toFixed(1)}px,${st.y.toFixed(1)}px) rotate(${st.r.toFixed(2)}deg)`, 'important');
      }
    }
  }
  // Cards as shelves (2026-11-19): the top of every card is a ledge the letters land and pile on. A blast close to a
  // card knocks the card itself loose: the real card tumbles (its own background, border and icons), its words come free,
  // and the cards inside it go with it. Collapse brings them all down.
  let cards = [];
  function makeShelves() {
    cards = [];
    const list = boxes().filter(q => q.r - q.l >= 80 && q.b - q.t >= 40).sort((a, b) => (a.b - a.t) * (a.r - a.l) - (b.b - b.t) * (b.r - b.l)).slice(0, 90);
    for (const q of list) {
      const shelf = Bodies.rectangle((q.l + q.r) / 2, q.t + 3, q.r - q.l, 6, { isStatic: true, label: 'shelf', friction: 0.7, restitution: 0.05 });
      cards.push({ q, shelf, loose: false });
    }
    Composite.add(engine.world, cards.map(c => c.shelf));
  }
  const inside = (q, z) => z !== q && z.l >= q.l - 1 && z.r <= q.r + 1 && z.t >= q.t - 1 && z.b <= q.b + 1;
  function loosen(c, vx = 0, vy = 0, spin = 0) {
    if (c.loose) return; c.loose = true;
    const q = c.q, el = q.el, w = q.r - q.l, h = q.b - q.t, cx = q.l + w / 2, cy = q.t + h / 2;
    Composite.remove(engine.world, c.shelf);
    for (const d of cards) if (!d.loose && inside(q, d.q)) { d.loose = true; d.rides = true; Composite.remove(engine.world, d.shelf); }
    el.__loose = true; restore.push(() => { delete el.__loose; });
    hideEl(el, 'transition', 'none'); hideEl(el, 'transform-origin', '50% 50%'); hideEl(el, 'transform', 'none'); hideEl(el, 'position', getComputedStyle(el).position === 'static' ? 'relative' : getComputedStyle(el).position); hideEl(el, 'z-index', '4');
    const body = Bodies.rectangle(cx, cy, w, h, { friction: 0.5, frictionAir: 0.012, restitution: 0.12, density: 0.0008, label: 'C', chamfer: { radius: Math.min(10, w / 6, h / 6) } });
    Composite.add(engine.world, body);
    const o = { kind: 'C', el, body, w, h, cx0: cx, cy0: cy, alive: true };
    bodyMap.set(body.id, o); loose.push(o);
    Body.setVelocity(body, { x: vx, y: vy }); Body.setAngularVelocity(body, spin);
    // what was written on it comes free, flying with it
    for (const l of letters) if (l.alive && l.body && l.body.isStatic) { const p = l.body.position; if (p.x > q.l && p.x < q.r && p.y > q.t && p.y < q.b) release(l, vx * 0.8 + rand(-1, 1), vy * 0.8 + rand(-1.5, 0.5), rand(-0.1, 0.1)); }
    for (const im of images) if (im.alive && im.body && im.body.isStatic) { const p = im.body.position; if (p.x > q.l && p.x < q.r && p.y > q.t && p.y < q.b) release(im, vx * 0.8, vy * 0.8, rand(-0.05, 0.05)); }
  }
  let loose = [];

  // fire: the flames are Elements (on a splash of oil so they keep burning); the words nearby come loose and float up
  function ignite(x, y) {
    tellFx('fire', x, y);
    for (const o of bodiesNear(x, y, 55)) { if (o.stamped) { o.pinned = true; continue; } if (o.kind === 'L' || o.kind === 'W') release(o, rand(-1.2, 1.2), rand(-7, -3), rand(-0.25, 0.25)); }
  }
  function melt(x, y, as = 'melt') {
    tellFx(as, x, y);
    const R = 110; let hitAny = false;
    for (const o of images) if (o.alive && !o.melt) { const b = o.body.bounds; if (x >= b.min.x && x <= b.max.x && y >= b.min.y && y <= b.max.y) { startMelt(o, x, y); hitAny = true; } }
    for (const o of bodiesNear(x, y, R)) { if (o.stamped) { o.pinned = true; continue; } if (o.kind === 'W') shatter(o); }
    for (const o of letters.slice()) {
      if (!o.alive || o.drip || o.kind !== 'L' || o.stamped) continue;
      const p = o.body.position, d = Math.hypot(p.x - x, p.y - y); if (d > R) continue;
      o.drip = { vy: rand(0.05, 0.3), a: rand(0.004, 0.02), delay: d * rand(4, 9), y: 0, len: 0, x0: p.x - o.w / 2, y0: p.y - o.h / 2, ang: o.body.angle };
      Composite.remove(engine.world, o.body);
      o.el.classList.add('drip');
      hitAny = true;
    }
    if (hitAny) { sfx.goo(); for (let i = 0; i < 16; i++) particles.push({ x: x + rand(-30, 30), y: y + rand(-10, 10), vx: rand(-1, 1), vy: rand(0, 2), life: rand(0.6, 1.4), size: rand(2, 5), color: '255,80,170', g: 0.15, glow: true }); }
  }
  function openHole(x, y) {
    tellFx('hole', x, y);
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
    for (const c of cards) if (!c.loose) setTimeout(() => { if (H.active) loosen(c, rand(-1, 1), rand(-1, 0.5), rand(-0.03, 0.03)); }, (Hh - c.q.b) * 1.6 + rand(100, 400));
    for (let i = 0; i < 40; i++) particles.push({ x: rand(0, W), y: Hh + 10, vx: rand(-1, 1), vy: rand(-3, -1), life: rand(1.5, 3), size: rand(20, 50), color: '120,110,100', g: -0.01, smoke: true });
  }
  function toggleZeroG() {
    zeroG = !zeroG; engine.gravity.y = zeroG ? 0 : 1;
    if (zeroG) for (const o of [...letters, ...images]) if (o.alive && o.body && !o.melt && !o.drip) release(o, rand(-1.2, 1.2), rand(-2.2, -0.3), rand(-0.03, 0.03));
    tone(zeroG ? 300 : 900, zeroG ? 900 : 300, 0.5, { gain: 0.15, type: 'triangle' });
    syncHud();
  }
  // Words and Elements, both ways (2026-11-19): ten times a second Havoc asks the Elements layer what's under each word.
  // In water a word floats (and a still one is lifted loose); in fire or lava it darkens and glows, passes the fire on to
  // what's next to it, and ends up as ash; acid eats it away into fumes; flowing lava shoves it about.
  let fxw = null, probing = false, probeN = 0, wet = [];
  function senses() {
    if (!fxw || probing || !fxw.probe) return;
    const list = letters.filter(o => o.alive && o.body && !o.drip), xy = new Array(list.length * 2);
    for (let k = 0; k < list.length; k++) { const p = list[k].body.position; xy[k * 2] = p.x; xy[k * 2 + 1] = p.y + list[k].h * 0.2; }
    if (!list.length) return;
    probing = true;
    fxw.probe(xy).then(m => {
      probing = false; if (!m || !H.active) return;
      const M_ = fxw.M; wet = [];
      for (let k = 0; k < list.length; k++) {
        const o = list[k]; if (!o.alive || !o.body) continue;
        const t = m[k], b = o.body, p = b.position;
        if (o.stamped) { if (t === M_.FIRE || t === M_.EMBER || t === M_.LAVA || t === M_.ACID) o.pinned = true; continue; }
        const was = o.inWater; o.inWater = t === M_.WATER;
        // a word landing in a pool makes the fish jump (2026-11-20)
        if (o.inWater && !was && !b.isStatic && fxw.splash && Math.hypot(b.velocity.x, b.velocity.y) > 2) fxw.splash(p.x, p.y);
        if (t === M_.WATER) {
          if (b.isStatic) release(o, rand(-0.4, 0.4), rand(-1.5, -0.4), rand(-0.05, 0.05));
          wet.push(o);
        } else if (t === M_.FIRE || t === M_.EMBER || t === M_.LAVA) {
          o.burn = (o.burn || 0) + (t === M_.LAVA ? 0.35 : 0.14);
          if (t === M_.LAVA) { if (b.isStatic) release(o, 0, -2, 0); Body.applyForce(b, p, { x: rand(-1, 1) * 0.0004 * b.mass, y: -0.0012 * b.mass }); }
          else if (b.isStatic && Math.random() < 0.25) release(o, rand(-0.6, 0.6), rand(-3, -1), rand(-0.1, 0.1));
        } else if (t === M_.ACID) o.acid = (o.acid || 0) + 0.2;
        if (o.burn) {
          const v = Math.min(1, o.burn);
          o.el.style.filter = `sepia(${v}) brightness(${(1 - 0.75 * v).toFixed(2)})`;
          o.el.style.textShadow = v < 0.95 ? `0 0 ${2 + 5 * v}px rgba(255,${130 - 60 * v | 0},40,${0.4 + 0.5 * v})` : '';
          // the fire passes along the line of text
          if (Math.random() < 0.35) fxw.spawn(p.x + rand(-o.w / 2, o.w / 2), p.y - o.h * 0.3, M_.FIRE, 1, 0.8, 10, 30);
          o.burn += 0.05;
          if (o.burn >= 1.4) { for (let x = -o.w / 2; x <= o.w / 2; x += 6) fxw.spawn(p.x + x, p.y, M_.ASH, 1, 0.8); fxw.spawn(p.x, p.y - 6, M_.SMOKE, 2, 0.4, 20, 50); kill(o); continue; }
        }
        if (o.acid) {
          o.el.style.opacity = String(Math.max(0, 1 - o.acid)); o.el.style.filter = `blur(${(o.acid * 1.5).toFixed(1)}px) hue-rotate(${o.acid * 60 | 0}deg)`;
          if (o.acid >= 1) { fxw.spawn(p.x, p.y, M_.FUME, 2, 0.5, 30, 70); kill(o); continue; }
          if (t !== M_.ACID) o.acid = Math.max(0, o.acid - 0.02);
        }
      }
    }, () => { probing = false; });
  }
  // The page as pixels (2026-11-19, user: "the page turns into pixels… this is what is amazing"): every word that hasn't
  // moved is also page in the Elements layer, like Elements mode reads it. Untouched it's see-through (the real word
  // shows); fire, acid, lava and lightning eat it pixel by pixel and paint the colour behind it over what's gone. A word
  // that gets thrown leaves the page first (its pixels go) and flies as a word; a word that has started burning or
  // dissolving stays put and burns as pixels.
  const bgCache = new Map();
  function bgOf(el) {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      if (bgCache.has(e)) return bgCache.get(e);
      const m = getComputedStyle(e).backgroundColor.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
      if (m && (m[4] === undefined || +m[4] > 0.5)) { const c = [+m[1] | 0, +m[2] | 0, +m[3] | 0]; bgCache.set(e, c); return c; }
    }
    return null;
  }
  // Page words sit in a layer just under the Elements canvas (z 60): untouched cells are see-through so the word shows,
  // burnt cells paint the background over it. A thrown word moves back up to the physics stage.
  let lowHost = null, lowStage = null;
  function low() {
    if (lowStage) return lowStage;
    lowHost = document.createElement('div'); lowHost.id = 'havoc-page';
    lowHost.style.cssText = 'position:fixed!important;inset:0!important;z-index:59!important;pointer-events:none!important;display:block!important;margin:0!important;padding:0!important;border:0!important;background:none!important;transform:none!important;filter:none!important';
    const r = lowHost.attachShadow({ mode: 'open' }), st = document.createElement('style'); st.textContent = CSS; r.appendChild(st);
    lowStage = document.createElement('div'); lowStage.className = 'stage'; r.appendChild(lowStage);
    (document.fullscreenElement || document.documentElement).appendChild(lowHost);
    return lowStage;
  }
  function stampAll() {
    if (!fxw || !fxw.stamp || !H.active) return;
    const C = fxw.cellSize || 3, cw = Math.ceil(W / C), ch = Math.ceil(Hh / C);
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.scale(1 / C, 1 / C); g.textBaseline = 'middle';
    const idx = new Uint8Array(cw * ch).fill(255), cols = [], colIdx = new Map(), list = [];
    const pageBg = bgOf(document.body) || [255, 255, 255];
    for (const o of letters) {
      if (!o.alive || !o.body || !o.body.isStatic || !o.home || !o.cs) continue;
      g.font = o.cs.font; g.fillStyle = o.cs.color; try { g.letterSpacing = o.cs.ls || '0px'; } catch (_) {}
      g.fillText(o.el.textContent, o.home[0], o.home[1] + o.h / 2);
      const bg = bgOf(o.src) || pageBg, key = bg.join(',');
      if (!colIdx.has(key)) { if (cols.length / 3 >= 250) continue; colIdx.set(key, cols.length / 3); cols.push(...bg); }
      const bi = colIdx.get(key), x0 = Math.max(0, Math.floor(o.home[0] / C)), x1 = Math.min(cw, Math.ceil((o.home[0] + o.w) / C)), y0 = Math.max(0, Math.floor(o.home[1] / C)), y1 = Math.min(ch, Math.ceil((o.home[1] + o.h) / C));
      for (let y = y0; y < y1; y++) idx.fill(bi, y * cw + x0, y * cw + x1);
      list.push(o);
    }
    let px; try { px = g.getImageData(0, 0, cw, ch).data; } catch (_) { return; }
    fxw.stamp(0, 0, cw, ch, new Uint8Array(px.buffer.slice(0)), idx, cols);
    const ls = low();
    for (const o of list) { o.stamped = true; ls.appendChild(o.el); }
  }
  // a word leaves the page: its untouched pixels go with it
  function unstamp(o) {
    if (!o.stamped) return; o.stamped = false;
    if (stage && o.el.parentNode !== stage) stage.appendChild(o.el);
    if (fxw && fxw.unstamp) fxw.unstamp({ left: o.home[0], top: o.home[1], right: o.home[0] + o.w, bottom: o.home[1] + o.h });
  }
  /* ------------------------------------------------------------------ bombs, vacuum, fan, volcano (2026-11-20) */
  // Bombs: a round bomb drops where you click, its fuse fizzing; it flashes faster and faster and goes off about 2.6 s
  // later with a full blast. Click one with the Bomb tool to pick it up and throw it. A blast nearby sets it off early.
  let bombs = [], vents = [], fanAt = null, bombHeld = false, vacT = 0, fanT = 0;
  const BOMB_R = 11;
  function dropBomb(x, y) {
    const body = Bodies.circle(x, y, BOMB_R, { restitution: 0.35, friction: 0.5, frictionAir: 0.004, density: 0.004 });
    Composite.add(engine.world, body);
    bombs.push({ body, t: 0, fuse: 2.6 + rand(-0.15, 0.15) });
    sfx.click();
  }
  function bombAt(x, y) { return bombs.find(b => Math.hypot(b.body.position.x - x, b.body.position.y - y) < BOMB_R + 6); }
  function bombsStep(dt) {
    for (const b of bombs) {
      b.t += dt; const p = b.body.position;
      // the fuse: a fizz of sparks from its tip
      const a = b.body.angle - Math.PI / 2 + 0.6, tx = p.x + Math.cos(a) * (BOMB_R + 5), ty = p.y + Math.sin(a) * (BOMB_R + 5);
      b.tip = [tx, ty];
      if (Math.random() < 0.7) particles.push({ x: tx, y: ty, vx: rand(-1.2, 1.2), vy: rand(-2, 0.2), life: rand(0.15, 0.35), size: rand(0.8, 1.6), color: Math.random() < 0.5 ? '255,220,140' : '255,160,60', g: 0.05, glow: true });
      if (b.t >= b.fuse) { b.gone = true; Composite.remove(engine.world, b.body); blast(p.x, p.y); }
    }
    if (bombs.some(b => b.gone)) bombs = bombs.filter(b => !b.gone);
  }
  function drawBombs(c, now) {
    for (const b of bombs) {
      const p = b.body.position, k = Math.min(1, b.t / b.fuse);
      // flashing: slow at first, faster and faster near the end
      const rate = 2 + 14 * k * k, lit = Math.sin(b.t * rate * Math.PI * 2) > 0.2 && k > 0.25, swell = 1 + (k > 0.85 ? (k - 0.85) * 0.8 : 0);
      c.save(); c.translate(p.x, p.y); c.rotate(b.body.angle); c.scale(swell, swell);
      const g = c.createRadialGradient(-4, -4, 1, 0, 0, BOMB_R);
      g.addColorStop(0, lit ? '#fff1d6' : '#5d6a86'); g.addColorStop(0.35, lit ? '#ffb070' : '#2f3850'); g.addColorStop(1, lit ? '#d0603a' : '#161b28');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, BOMB_R, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#8b93a7'; c.fillRect(-3.5, -BOMB_R - 3, 7, 4);   // the cap
      c.strokeStyle = '#c9a36a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, -BOMB_R - 3); c.quadraticCurveTo(3, -BOMB_R - 8, 6, -BOMB_R - 6); c.stroke();
      c.restore();
    }
  }
  // Vacuum: while held, everything near the nozzle is pulled in: words (gone once they reach it), and every loose bit
  // of Elements matter.
  function vacStep(dt) {
    if (tool !== 'vac' || !pointer.down || !pointer.inside) return;
    const x = pointer.x, y = pointer.y, R = 150;
    for (const o of [...letters, ...images]) {
      if (!o.alive || o.drip || o.melt || !o.body) continue;
      const p = o.body.position, dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy) || 1;
      if (d > R) continue;
      if (o.body.isStatic) { if (d > R * 0.55 || o.kind === 'I') continue; release(o, 0, 0, 0); }
      const f = (o.kind === 'I' ? 0.00025 : 0.00012) * o.body.mass * clamp(200 / (d + 10), 0.5, 8);
      Body.applyForce(o.body, p, { x: dx / d * f, y: dy / d * f });
      if (d < (o.kind === 'W' ? 22 : 14) && o.kind !== 'I') { sfx.pop(); spaghettify(o, { x, y }); }
    }
    for (const b of bombs) { const p = b.body.position, dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy) || 1; if (d < R) Body.applyForce(b.body, p, { x: dx / d * 0.00006 * b.body.mass * 40, y: dy / d * 0.00006 * b.body.mass * 40 }); }
    vacT += dt;
    if (vacT > 0.09) { vacT = 0; if (fxw && fxw.sink) fxw.sink(x, y, 90, 0.12, true); }
    if (Math.random() < 0.8) { const a = rand(0, Math.PI * 2), r0 = rand(40, 110); particles.push({ x: x + Math.cos(a) * r0, y: y + Math.sin(a) * r0, vx: -Math.cos(a) * r0 / 9, vy: -Math.sin(a) * r0 / 9, life: 0.18, size: rand(0.8, 1.4), color: '200,230,255', g: 0 }); }
  }
  // Fan: press where it sits, drag to aim; while held it blows a cone of air: words lift off and fly, flames, smoke,
  // snow, sand and water are pushed along.
  function fanStep(dt) {
    if (tool !== 'fan' || !pointer.down || !fanAt) return;
    let dx = pointer.x - fanAt.x, dy = pointer.y - fanAt.y, d = Math.hypot(dx, dy);
    if (d < 12) { dx = fanAt.dx; dy = fanAt.dy; } else { dx /= d; dy /= d; fanAt.dx = dx; fanAt.dy = dy; }
    const L = 320, Wd = 80;
    for (const o of [...letters, ...images, ...bombs.map(b => ({ body: b.body, alive: true, kind: 'B' }))]) {
      if (!o.alive || o.drip || o.melt || !o.body) continue;
      const p = o.body.position, rx = p.x - fanAt.x, ry = p.y - fanAt.y, along = rx * dx + ry * dy; if (along < 0 || along > L) continue;
      if (Math.abs(-rx * dy + ry * dx) > Wd * (0.35 + along / L)) continue;
      const k = 1 - along / L * 0.75;
      if (o.body.isStatic) { if (o.kind === 'I' || along > L * 0.6 || Math.random() > 0.08 * k) continue; release(o, dx * 2, dy * 2 - 1, rand(-0.1, 0.1)); }
      const f = (o.kind === 'I' ? 0.00012 : 0.0005) * o.body.mass * k;
      Body.applyForce(o.body, p, { x: dx * f, y: dy * f - (o.kind === 'B' ? 0 : 0.00008 * o.body.mass) });
    }
    fanT += dt;
    if (fanT > 0.08) { fanT = 0; if (fxw && fxw.gust) fxw.gust(fanAt.x, fanAt.y, dx, dy, L, Wd, 0.1); }
    if (Math.random() < 0.9) { const s = rand(-1, 1) * 18; particles.push({ x: fanAt.x - dy * s, y: fanAt.y + dx * s, vx: dx * rand(9, 14), vy: dy * rand(9, 14), life: 0.32, size: rand(0.6, 1.1), color: '220,245,255', g: 0 }); }
  }
  function drawFan(c, now) {
    if (tool !== 'fan' || !fanAt || !pointer.down) return;
    const a = Math.atan2(fanAt.dy, fanAt.dx);
    c.save(); c.translate(fanAt.x, fanAt.y); c.rotate(a);
    c.fillStyle = 'rgba(40,52,64,.85)'; c.beginPath(); c.roundRect(-16, -18, 10, 36, 4); c.fill();
    c.rotate(now / 40);
    c.fillStyle = 'rgba(184,242,230,.85)';
    for (let i = 0; i < 3; i++) { c.rotate(Math.PI * 2 / 3); c.beginPath(); c.ellipse(-2, 7, 4, 9, 0.4, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }
  // Volcano: a vent at the bottom of the page under where you click. Lava wells up for about 14 s, with eruptions that
  // throw glowing lava bombs which land as lava; the ground rumbles. Lava meeting water hisses into steam and stone.
  function openVent(x) {
    vents.push({ x, t: 0, life: 14, next: 0.6 });
    shake = Math.max(shake, 10); sfx.quake();
  }
  function ventsStep(dt) {
    for (const v of vents) {
      v.t += dt; v.next -= dt;
      if (fxw && Math.random() < 0.5) fxw.spawn(v.x + rand(-10, 10), Hh - 3, fxw.M.LAVA, 3, 0.8);
      if (Math.random() < 0.3) particles.push({ x: v.x + rand(-14, 14), y: Hh - 6, vx: rand(-0.4, 0.4), vy: rand(-1.5, -0.6), life: rand(1.4, 2.6), size: rand(18, 36), color: '90,80,78', g: -0.01, smoke: true });
      if (v.next <= 0 && v.t < v.life - 1) {
        v.next = rand(0.7, 1.6); shake = Math.max(shake, 7);
        const n = 8 + (Math.random() * 10) | 0;
        for (let i = 0; i < n; i++) particles.push({ x: v.x + rand(-6, 6), y: Hh - 8, vx: rand(-4, 4), vy: rand(-17, -9), life: rand(1.2, 2.2), size: rand(2.5, 4.5), color: Math.random() < 0.5 ? '255,140,40' : '255,90,30', g: 0.32, glow: true, lava: true });
        // what's right above the vent gets thrown up
        for (const o of bodiesNear(v.x, Hh - 60, 120)) { if (o.stamped && o.pinned) continue; release(o, rand(-3, 3), rand(-14, -7), rand(-0.3, 0.3)); }
      }
    }
    if (vents.some(v => v.t >= v.life)) vents = vents.filter(v => v.t < v.life);
  }
  function kill(o) {
    if (!o.alive) return; o.alive = false;
    if (o.body) Composite.remove(engine.world, o.body);
    o.el.remove();
  }

  /* ------------------------------------------------------------------ frame loop */
  let flash = 0, flashPos = { x: 0, y: 0 }, rainAcc = 0, acc = 0;
  const STEP = 1000 / 60;
  let calmMotion = false;   // "reduce motion": no screen shake or flash
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (lastT || now)) / 1000); lastT = now;
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
        if (d < (o.kind === 'I' ? 40 : o.kind === 'W' ? 26 : 16)) { h.eaten++; sfx.pop(); spaghettify(o, h); }
      }
    }
    holes = holes.filter(h => h.t < h.life);
    bombsStep(dt); vacStep(dt); fanStep(dt); ventsStep(dt);
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
        d.dead = true;
        if (hitIt.kind === 'L' || hitIt.kind === 'W') { if (hitIt.body.isStatic) { if (Math.random() < 0.55) release(hitIt, rand(-0.5, 0.5), rand(0.5, 2), rand(-0.1, 0.1)); } else Body.applyForce(hitIt.body, hitIt.body.position, { x: 0, y: 0.00025 * hitIt.body.mass }); sfx.plink(); }
        else if (false && hitIt.kind === 'I' && !hitIt.melt) {   // water beads on images: Elements rain does the water now
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
    // physics on a steady clock (2026-11-19): always 1/60 s steps, as many as the time that passed (at most 3, so a
    // slow device goes briefly slow-motion instead of falling further behind), and the leftover carried to the next
    // frame. What's drawn is blended between the last two steps, so 120 Hz screens still move smoothly.
    acc = Math.min(acc + dt * 1000, STEP * 3);
    while (acc >= STEP) {
      // what's in water floats: a bit more than its weight upwards, and the water slows it
      for (const o of wet) { if (!o.alive || !o.body || o.body.isStatic) continue; const b = o.body; Body.applyForce(b, b.position, { x: 0, y: -b.mass * engine.gravity.scale * (zeroG ? 0 : 1.35) }); Body.setVelocity(b, { x: b.velocity.x * 0.96, y: b.velocity.y * 0.94 }); }
      Engine.update(engine, STEP); acc -= STEP;
    }
    if (++probeN % 6 === 0) senses();
    const blend = acc / STEP;
    // words that slammed into something during those steps break up now
    while (breakQ.length) { const [o, v] = breakQ.pop(); if (o.alive) shatter(o, v.x * 0.3, v.y * 0.3, 0); }
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
      const b = o.body;
      if (b.isStatic || b.isSleeping) { if (o.mv) { o.mv = false; o.el.classList.remove('mv'); } continue; }
      if (!o.mv) { o.mv = true; o.el.classList.add('mv'); }
      // only write when it has really moved: a quarter pixel, or a sliver of a turn (drawn between the last two steps)
      const pp = b.positionPrev, ang = b.anglePrev + (b.angle - b.anglePrev) * blend;
      const px = pp.x + (b.position.x - pp.x) * blend - o.w / 2, py = pp.y + (b.position.y - pp.y) * blend - o.h / 2;
      if (Math.abs(px - (o.px ?? 1e9)) > 0.25 || Math.abs(py - o.py) > 0.25 || Math.abs(ang - o.pa) > 0.004) {
        o.px = px; o.py = py; o.pa = ang;
        o.el.style.transform = `translate(${px.toFixed(1)}px,${py.toFixed(1)}px) rotate(${ang.toFixed(3)}rad)`;
      }
      if (b.position.y > Hh + 400 || b.position.x < -600 || b.position.x > W + 600) kill(o);
    }
    for (const o of images) {
      if (!o.alive) continue;
      const b = o.body;
      if (!o.melt && !b.isStatic && !b.isSleeping) o.el.style.transform = `translate(${b.position.x - o.w / 2}px,${b.position.y - o.h / 2}px) rotate(${b.angle}rad)`;
      if (o.ready && (o.dirty || o.melt || o.ripples.length || o.beads.length && o.beads.some(bd => bd.wait > 0 || bd.r > 3.2))) renderImage(o, dt);
      if (!o.melt && (b.position.y > Hh + 900)) kill(o);
    }
    for (const o of loose) {
      if (!o.alive) continue; const b = o.body; if (b.isSleeping) continue;
      const pp = b.positionPrev, x = pp.x + (b.position.x - pp.x) * blend, y = pp.y + (b.position.y - pp.y) * blend, a = b.anglePrev + (b.angle - b.anglePrev) * blend;
      o.el.style.setProperty('transform', `translate(${(x - o.cx0).toFixed(1)}px,${(y - o.cy0).toFixed(1)}px) rotate(${a.toFixed(3)}rad)`, 'important');
    }
    drawFx(dt);
    // screen shake
    if (calmMotion) shake = 0;
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

  // made once, stamped many times (2026-11-19): a soft glow dot per colour and a smoke puff per colour, instead of a
  // blur or a gradient for every particle every frame. Glows add up where they overlap
  const spriteCache = new Map();
  function sprite(kind, color) {
    const k = kind + color; let cv = spriteCache.get(k); if (cv) return cv;
    cv = document.createElement('canvas'); const S = kind === 'glow' ? 32 : 64; cv.width = cv.height = S; const g = cv.getContext('2d'), c = S / 2;
    const gr = g.createRadialGradient(c, c, 0, c, c, c);
    if (kind === 'glow') { gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.22, `rgba(${color},1)`); gr.addColorStop(0.5, `rgba(${color},.35)`); gr.addColorStop(1, `rgba(${color},0)`); }
    else { gr.addColorStop(0, `rgba(${color},1)`); gr.addColorStop(1, `rgba(${color},0)`); }
    g.fillStyle = gr; g.fillRect(0, 0, S, S); spriteCache.set(k, cv); return cv;
  }
  function drawFx(dt) {
    const c = fxc; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, Hh);
    // rain streaks
    if (false && drops.length) {   // no drawn streaks: the rain you see is Elements water (user: "hate the rain on physics")
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
    drawBombs(c, performance.now()); drawFan(c, performance.now());
    // shockwave rings
    for (const r of rings) { r.r += (r.max - r.r) * 0.16; r.life -= dt * 2.2; c.strokeStyle = `rgba(${r.color},${Math.max(0, r.life)})`; c.lineWidth = r.w * Math.max(0, r.life); c.beginPath(); c.arc(r.x, r.y, r.r, 0, Math.PI * 2); c.stroke(); }
    rings = rings.filter(r => r.life > 0);
    // flash
    if (calmMotion) flash = 0;
    if (flash > 0) { const g = c.createRadialGradient(flashPos.x, flashPos.y, 0, flashPos.x, flashPos.y, 260); g.addColorStop(0, `rgba(255,240,200,${flash})`); g.addColorStop(1, 'rgba(255,200,120,0)'); c.fillStyle = g; c.fillRect(0, 0, W, Hh); flash -= dt * 5; }
    // particles
    for (const p of particles) {
      p.vx *= 0.985; p.vy = p.vy * 0.985 + p.g; p.x += p.vx; p.y += p.vy; p.life -= dt;
      if (p.lava && (p.life <= 0 || (p.vy > 0 && p.y > Hh - 4))) { p.life = 0; if (fxw) fxw.spawn(p.x, Math.min(Hh - 3, p.y), fxw.M.LAVA, 2, 0.9); continue; }
      const a = Math.max(0, Math.min(1, p.life));
      if (p.smoke) { const s = p.size * (2 - a); c.globalAlpha = 0.35 * a; c.drawImage(sprite('smoke', p.color), p.x - s, p.y - s, s * 2, s * 2); c.globalAlpha = 1; continue; }
      if (p.glow) { const s = p.size * 3.2; c.globalCompositeOperation = 'lighter'; c.globalAlpha = a; c.drawImage(sprite('glow', p.color), p.x - s, p.y - s, s * 2, s * 2); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; continue; }
      c.fillStyle = `rgba(${p.color},${a})`; c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill();
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
  // touch (2026-11-19): a tap does the tool; holding a finger still for a moment grabs what's under it (and you can drag
  // and fling it); two fingers sweep everything near them along. Painting tools (fire, lava, acid) paint as you drag.
  const touches = new Map(); let lp = null, swipe = null;
  function touchDown(e) {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now() });
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.inside = true;
    if (touches.size === 2) { clearTimeout(lp && lp.timer); lp = null; const [a, b] = [...touches.values()]; swipe = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; return; }
    if (touches.size > 2) return;
    if (tool === 'melt' || tool === 'fire' || tool === 'acid' || tool === 'vac' || tool === 'fan') { pointer.down = true; act(e.clientX, e.clientY); return; }
    lp = { id: e.pointerId, x: e.clientX, y: e.clientY, grabbed: false, timer: setTimeout(() => {
      if (!lp) return; lp.grabbed = true;
      for (const b of Query.point(Composite.allBodies(engine.world), { x: lp.x, y: lp.y })) { const o = bodyMap.get(b.id); if (o && o.alive && b.isStatic) release(o); }
      mcon.collisionFilter.mask = 0xFFFFFFFF; sfx.click(); try { navigator.vibrate && navigator.vibrate(12); } catch (_) {}
    }, 320) };
  }
  function touchMove(e) {
    const t = touches.get(e.pointerId); if (!t) return;
    t.x = e.clientX; t.y = e.clientY; pointer.x = e.clientX; pointer.y = e.clientY;
    if (touches.size === 2 && swipe) {
      const [a, b] = [...touches.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = mx - swipe.x, dy = my - swipe.y;
      for (const o of bodiesNear(mx, my, 140)) release(o, clamp(dx * 0.9, -30, 30) + (o.body.isStatic ? 0 : o.body.velocity.x * 0.3), clamp(dy * 0.9, -30, 30) + (o.body.isStatic ? 0 : o.body.velocity.y * 0.3), rand(-0.2, 0.2));
      swipe = { x: mx, y: my }; return;
    }
    if (lp && !lp.grabbed && Math.hypot(t.x - t.x0, t.y - t.y0) > 12) { clearTimeout(lp.timer); lp = null; }
    if (pointer.down) onMove(e);
  }
  function touchUp(e) {
    const t = touches.get(e.pointerId); touches.delete(e.pointerId);
    if (touches.size < 2) swipe = null;
    if (lp && lp.id === e.pointerId) {
      clearTimeout(lp.timer);
      if (!lp.grabbed && t && performance.now() - t.t < 450) act(t.x, t.y);   // a tap
      if (lp.grabbed) mcon.collisionFilter.mask = tool === 'grab' ? 0xFFFFFFFF : 0;
      lp = null;
    }
    if (!touches.size) { pointer.down = false; pointer.inside = false; }
  }
  function onDown(e) {
    if (e.pointerType === 'touch') return touchDown(e);
    if (e.button !== 0) return;
    pointer.down = true; act(e.clientX, e.clientY);
  }
  function act(x, y) {
    if (tool === 'grab') {
      // pull a static piece loose so the mouse constraint can grab it
      const hits = Query.point(Composite.allBodies(engine.world), { x, y });
      for (const b of hits) { const o = bodyMap.get(b.id); if (o && o.alive && b.isStatic) { release(o); sfx.click(); } }
    } else if (tool === 'blast') blast(x, y);
    else if (tool === 'melt') melt(x, y);
    else if (tool === 'fire') ignite(x, y);
    else if (tool === 'acid') melt(x, y, 'acid');
    else if (tool === 'hole') openHole(x, y);
    else if (tool === 'rain') setRain(!raining);
    else if (tool === 'quake') collapse();
    else if (tool === 'zerog') toggleZeroG();
    else if (tool === 'bomb') { if (bombAt(x, y)) { bombHeld = true; mcon.collisionFilter.mask = 0xFFFFFFFF; } else dropBomb(x, y); }
    else if (tool === 'fan') fanAt = { x, y, dx: fanAt ? fanAt.dx : 0, dy: fanAt ? fanAt.dy : -1 };
    else if (tool === 'volcano') openVent(x);
  }
  function onMove(e) { pointer.x = e.clientX; pointer.y = e.clientY; pointer.inside = true; if (tool === 'melt' && pointer.down && Math.random() < 0.25) melt(pointer.x, pointer.y);
    if (tool === 'fire' && pointer.down && Math.random() < 0.35) ignite(pointer.x, pointer.y);
    if (tool === 'acid' && pointer.down && Math.random() < 0.25) melt(pointer.x, pointer.y, 'acid'); }
  function onKey(e) {
    if (!H.active || bare) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); rewind(); return; }
    const t = TOOLS.find(t => t.key === e.key); if (t) { e.preventDefault(); e.stopPropagation(); pick(t.id); }
    if (e.key.toLowerCase() === 'm' && !e.metaKey && !e.ctrlKey) { muted = !muted; syncHud(); }
  }
  function setRain(on) {
    raining = on; syncHud(); tellFx('rain', 0, 0, { on });
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
    if (TOOLS.some(t => t.id === id)) recent = [id, ...recent.filter(t => t !== id)].slice(0, 4);
    if (PHONE && hud) hud.classList.remove('open');
    sfx.click(); syncHud();
  }
  // Phones (2026-11-24, same as Elements mode): a slim bar with the current tool, the last three used, More and Exit;
  // swipe up (or More) for everything, each button named; picking a tool tucks it away. Computers are unchanged.
  const PHONE = matchMedia('(hover: none) and (pointer: coarse)').matches;
  let recent = [], unTilt = null;
  const NAMES = { sound: 'Sound', reset: 'Rebuild', close: 'Exit', fight: 'Wizard', more: 'More', tilt: 'Tilt' };

  /* ------------------------------------------------------------------ HUD */
  const CSS = `
  :host{all:initial}
  *{box-sizing:border-box}
  .stage{position:fixed;inset:0;pointer-events:none;overflow:hidden;contain:strict}
  .l{position:absolute;left:0;top:0;white-space:pre;text-align:center;transform-origin:50% 50%;user-select:none;font-kerning:none;margin:0;padding:0;letter-spacing:0;word-spacing:0;text-decoration:none;-webkit-font-smoothing:antialiased}
  .l.mv,.l.drip{will-change:transform}
  .l.drip{transform-origin:50% 0}
  .l.drip::after{content:"";position:absolute;left:38%;width:24%;bottom:100%;height:var(--trail,0px);background:linear-gradient(to top,currentColor,transparent);border-radius:0 0 50% 50%;opacity:.55}
  .img{position:absolute;left:0;top:0;will-change:transform;transform-origin:50% 50%}
  canvas.fx,canvas.scorch{position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none}
  .hit{position:fixed;inset:0;cursor:none;pointer-events:auto;background:transparent;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
  @media (max-width:760px){.hud{max-width:calc(100vw - 12px);overflow-x:auto;justify-content:flex-start;bottom:calc(10px + env(safe-area-inset-bottom));scrollbar-width:none}.hud::-webkit-scrollbar{display:none}
    .brand,.modes,.sep{display:none}.tip{display:none}button{flex:none;width:44px;height:44px}}
  .hud{position:fixed;left:50%;bottom:22px;transform:translateX(-50%) translateY(0);display:flex;align-items:center;gap:4px;padding:7px;border-radius:20px;
       background:linear-gradient(180deg,rgba(28,28,36,.82),rgba(12,12,18,.9));backdrop-filter:blur(18px) saturate(1.4);-webkit-backdrop-filter:blur(18px) saturate(1.4);
       border:1px solid rgba(255,255,255,.1);box-shadow:0 0 0 1px rgba(0,0,0,.4),0 18px 50px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.08);
       font:500 12px/1 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#e9e7f2;pointer-events:auto;animation:rise .5s cubic-bezier(.2,1.2,.3,1)}
  @keyframes rise{from{transform:translateX(-50%) translateY(40px);opacity:0}}
  .brand{display:flex;align-items:center;gap:7px;padding:0 10px 0 8px;font-weight:800;letter-spacing:.14em;font-size:11px;color:#fff}
  .brand i{width:9px;height:9px;border-radius:50%;background:#ff3b3b;box-shadow:0 0 10px #ff3b3b,0 0 2px #fff inset;animation:pulse 1.4s infinite}
  @keyframes pulse{50%{opacity:.45}}
  .modes{display:flex;padding:3px;gap:2px;border-radius:12px;background:rgba(255,255,255,.06)}
  .modes button.mode{width:auto;height:30px;padding:0 10px;border-radius:9px;font:600 11.5px ui-sans-serif,system-ui,sans-serif;color:#bdbacb}
  .modes button.mode.on{background:rgba(255,255,255,.14);color:#fff;box-shadow:none}
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
  .nm{display:none}
  .full{display:contents}
  @keyframes riseP{from{transform:translateY(40px);opacity:0}}
  .hud.phone{left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));transform:none;width:auto;max-width:none;overflow:visible;flex-direction:column;flex-wrap:nowrap;align-items:stretch;justify-content:flex-start;gap:0;padding:6px 8px 8px;border-radius:22px;animation:riseP .45s cubic-bezier(.2,1.2,.3,1)}
  .hud.phone .grab{width:38px;height:4px;border-radius:2px;background:rgba(255,255,255,.28);align-self:center;margin:0 0 6px}
  .hud.phone .mini{display:flex;align-items:center;gap:4px}
  .hud.phone .mini .gap{flex:1}
  .hud.phone .full{display:none}
  .hud.phone.open .full{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-start;gap:4px;max-height:58vh;overflow:auto;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08)}
  .hud.phone.open .mini [data-id=more] svg{transform:rotate(180deg)}
  .hud.phone button{width:56px;height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border-radius:13px}
  .hud.phone button svg{width:21px;height:21px}
  .hud.phone .k{display:none}
  .hud.phone .nm{display:block;font:600 9.5px/1 ui-sans-serif,system-ui,-apple-system,sans-serif;max-width:54px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:0}
  .hud.phone .brand,.hud.phone .sep{display:none}
  .hud.phone .modes{width:100%;margin-bottom:4px}
  .hud.phone .modes button{flex:1;width:auto;height:36px;flex-direction:row}
  .hud.phone ~ .tip{display:none}
  .hud.phone .full [data-id=close]{display:none}
  .intro{position:fixed;left:0;right:0;top:0;height:3px;background:linear-gradient(90deg,transparent,#ff3b3b,#ffb35c,transparent);box-shadow:0 0 30px 6px rgba(255,80,60,.6);pointer-events:none;animation:scan 1s cubic-bezier(.5,0,.2,1) forwards}
  @keyframes scan{to{transform:translateY(100vh);opacity:.2}}
  .stamp{position:fixed;left:50%;top:44%;transform:translate(-50%,-50%) scale(.6);font:900 54px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.3em;color:#fff;text-shadow:0 0 30px rgba(255,60,60,.9),0 0 2px #fff;pointer-events:none;opacity:0;animation:stamp 1.2s ease forwards}
  @keyframes stamp{15%{opacity:1;transform:translate(-50%,-50%) scale(1.04)}30%{transform:translate(-50%,-50%) scale(1)}75%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1.15);filter:blur(6px)}}
  `;
  const hbtn = (id, title, color, key) => { const t = TOOLS.find(x => x.id === id); return `<button data-id="${id}" style="--c:${color || '#fff'}" aria-label="${title}">${'<svg viewBox="0 0 24 24">' + ICONS[id] + '</svg>'}${key ? `<span class="k">${key}</span>` : ''}<span class="nm">${t ? t.name : NAMES[id] || title}</span></button>`; };
  function buildHud() {
    const btn = hbtn;
    hud = document.createElement('div'); hud.className = 'hud';
    if (PHONE) hud.classList.add('phone');
    hud.innerHTML = (PHONE ? `<div class="grab" aria-hidden="true"></div><div class="mini"></div>` : '') + `<div class="full"><div class="brand"><i></i>HAVOC</div><div class="modes" role="group" aria-label="Mode"><button class="mode on" data-mode="physics" aria-pressed="true">Physics</button><button class="mode" data-mode="elements" aria-pressed="false">Elements</button></div><div class="sep"></div>` + TOOLS.map(t => btn(t.id, t.name, t.color, t.key)).join('') + `<div class="sep"></div>` + btn('fight', 'Wizard vs bosses', '#b197fc') + btn('sound', 'Sound', '#fff') + btn('reset', 'Restore page', '#fff') + btn('close', 'Exit (Esc)', '#fff');
    if (PHONE) {
      if (window.CadenceTilt && window.CadenceTilt.supported()) hud.querySelector('.full').insertAdjacentHTML('beforeend', hbtn('tilt', 'Tilt to pour', '#9fd3c7'));
      let y0 = null;
      hud.addEventListener('pointerdown', e => { y0 = e.clientY; });
      hud.addEventListener('pointerup', e => { if (y0 == null) return; const dy = e.clientY - y0; y0 = null; if (dy < -24) hud.classList.add('open'); else if (dy > 24) hud.classList.remove('open'); });
    }
    tipEl = document.createElement('div'); tipEl.className = 'tip';
    hud.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return; e.stopPropagation();
      if (b.dataset.id === 'more') { hud.classList.toggle('open'); return; }
      if (b.dataset.id === 'tilt') { window.CadenceTilt.set(!window.CadenceTilt.wanted()).then(syncHud); return; }
      // switch to the Elements engine (Cadence listens for this and loads it)
      if (b.dataset.mode) { if (b.dataset.mode === 'elements') { stop(); dispatchEvent(new CustomEvent('havoc:mode', { detail: 'elements' })); } return; }
      const id = b.dataset.id;
      if (id === 'sound') { muted = !muted; if (!muted) sfx.click(); syncHud(); }
      else if (id === 'reset') rewind(() => setTimeout(start, 60));
      else if (id === 'close') rewind();
      else if (id === 'fight') { stop(); dispatchEvent(new CustomEvent('havoc:fight')); }   // havoc-fight.js takes it from here
      else pick(id);
    });
    hud.addEventListener('pointerover', e => {
      const b = e.target.closest('button'); if (!b || b.dataset.mode || PHONE) return;
      const t = TOOLS.find(x => x.id === b.dataset.id);
      const label = t ? `<b>${t.name}</b> · ${t.hint}` : b.dataset.id === 'sound' ? (muted ? 'Sound off · M' : 'Sound on · M') : b.dataset.id === 'reset' ? 'Rebuild the page and start over' : b.dataset.id === 'fight' ? '<b>Wizard vs bosses</b> · a pixel wizard fights four bosses on this page' : 'Exit and restore · Esc';
      tipEl.style.setProperty('--c', t ? t.color : '#fff'); tipEl.innerHTML = label; tipEl.classList.add('show');
    });
    hud.addEventListener('pointerout', () => tipEl.classList.remove('show'));
    root.appendChild(hud); root.appendChild(tipEl);
    syncHud();
  }
  function syncHud() {
    if (!hud) return;
    if (PHONE) {
      const tt = id => TOOLS.find(t => t.id === id);
      if (!recent.includes(tool) && tt(tool)) recent = [tool, ...recent].slice(0, 4);
      const rec = recent.filter(id => id !== tool && tt(id)).slice(0, 3);
      hud.querySelector('.mini').innerHTML = (tt(tool) ? hbtn(tool, tt(tool).name, tt(tool).color) : '') + rec.map(id => hbtn(id, tt(id).name, tt(id).color)).join('')
        + '<span class="gap"></span>' + hbtn('more', 'All tools', '#fff') + hbtn('close', 'Exit', '#fff');
    }
    hud.querySelectorAll('button[data-id]').forEach(b => {
      const id = b.dataset.id;
      b.classList.toggle('on', id === tool && id !== 'rain' || (id === 'rain' && raining) || (id === 'zerog' && zeroG) || (id === 'tilt' && window.CadenceTilt && window.CadenceTilt.wanted()));
      if (id === 'sound') b.innerHTML = `<svg viewBox="0 0 24 24">${muted ? ICONS.mute : ICONS.sound}</svg><span class="nm">Sound</span>`;
    });
  }

  /* ------------------------------------------------------------------ lifecycle */
  function sizeCanvas(cv) { cv.width = Math.round(W * DPR); cv.height = Math.round(Hh * DPR); }
  function start(opts = {}) {
    if (H.active) return;
    bare = !!opts.bare;
    document.documentElement.classList.add('havoc-open');   // full screen: Cadence hides its tab bar (2026-11-24)
    H.active = true; W = innerWidth; Hh = innerHeight; DPR = Math.min(2, devicePixelRatio || 1);
    calmMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    letters = []; images = []; bodyMap = new Map(); restore = []; particles = []; rings = []; holes = []; drops = []; shake = 0; raining = false; bombs = []; vents = []; fanAt = null; bombHeld = false; zeroG = false; tool = 'blast';
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
    engine.gravity.y = 1; engine.gravity.x = 0; acc = 0; breakQ.length = 0; dentBoxes = null;
    // tilt: gravity leans, settled words are woken so they slide, and the matter layer leans too
    if (window.CadenceTilt) { unTilt && unTilt(); unTilt = window.CadenceTilt.listen(v => { if (engine) { const was = engine.gravity.x; engine.gravity.x = v * 0.9; if (Math.abs(was - engine.gravity.x) > 0.04) for (const b of Composite.allBodies(engine.world)) if (!b.isStatic && b.isSleeping) Sleeping.set(b, false); } if (fxw && fxw.tilt) fxw.tilt(v); }); }
    // a word that slams into something (the floor, a wall, another piece) hard enough breaks into its letters
    Events.on(engine, 'collisionStart', e => {
      for (const pr of e.pairs) for (const [a, b] of [[pr.bodyA, pr.bodyB], [pr.bodyB, pr.bodyA]]) {
        const o = bodyMap.get(a.id); if (!o || !o.alive || (o.kind !== 'W' && o.kind !== 'L')) continue;
        const rv = Math.hypot(a.velocity.x - (b.velocity ? b.velocity.x : 0), a.velocity.y - (b.velocity ? b.velocity.y : 0));
        if (rv > 2.2 && !muted) landed(o, rv);
        if (o.kind === 'W' && !o.queued && rv > BREAK * 1.5) { o.queued = true; breakQ.push([o, { x: a.velocity.x, y: a.velocity.y }]); }
      }
    });
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
    for (const gs of groupWords(glyphs)) bodies.push(makeWord(gs.length === 1 ? [{ ...gs[0], ch: shown(gs[0], true) }] : gs));
    parents.forEach(hideText);
    Composite.add(engine.world, bodies);
    loose = []; makeShelves();
    fxw = null; wet = []; probing = false;
    if (canPixels()) window.CadenceFX.world().then(w => { if (!H.active) return; fxw = w; setTimeout(stampAll, 60); }, () => {});

    mouse = Mouse.create(hit);
    mouse.pixelRatio = 1;
    mcon = MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.18, damping: 0.08, render: { visible: false } } });
    mcon.collisionFilter.mask = 0;
    Composite.add(engine.world, mcon);
    // matter's mouse swallows wheel events; let them through (scroll is locked anyway)
    try { hit.removeEventListener('wheel', mouse.mousewheel); hit.removeEventListener('mousewheel', mouse.mousewheel); hit.removeEventListener('DOMMouseScroll', mouse.mousewheel); } catch (e) {}

    hit.addEventListener('pointerdown', onDown);
    hit.addEventListener('pointermove', e => e.pointerType === 'touch' ? touchMove(e) : onMove(e));
    hit.addEventListener('pointerup', e => { if (e.pointerType === 'touch') touchUp(e); else pointer.down = false; if (bombHeld) { bombHeld = false; setTimeout(() => { if (mcon) mcon.collisionFilter.mask = tool === 'grab' ? 0xFFFFFFFF : 0; }, 30); } });
    hit.addEventListener('pointercancel', e => { if (e.pointerType === 'touch') touchUp(e); });
    hit.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') { pointer.inside = false; pointer.down = false; } });
    hit.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('keydown', onKey, true);
    addEventListener('resize', onResize);

    if (bare) hit.style.pointerEvents = 'none';
    if (!bare) buildHud();
    if (!bare) {
    const intro = document.createElement('div'); intro.className = 'intro'; root.appendChild(intro); setTimeout(() => intro.remove(), 1100);
    const stamp = document.createElement('div'); stamp.className = 'stamp'; stamp.textContent = 'HAVOC'; root.appendChild(stamp); setTimeout(() => stamp.remove(), 1300);
    }
    sfx.arm();
    (document.fullscreenElement || document.documentElement).appendChild(host);
    lastT = 0; raf = requestAnimationFrame(frame);
    H.stats = { letters: letters.length, images: images.length, shelves: cards.length };
  }
  // ---- the finish (2026-11-19): every piece still on screen flies back to its place, the scorch fades, then the real page
  // comes back underneath exactly where they landed. Reduce motion: straight back, as before.
  function rewind(then) {
    if (!H.active || H.rewinding) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { stop(); if (then) then(); return; }
    H.rewinding = true; cancelAnimationFrame(raf); raining = false; holes = []; drops = []; bombs = []; vents = []; fanAt = null;
    if (hud) hud.style.display = 'none'; if (tipEl) tipEl.remove(); hit.style.pointerEvents = 'none';
    tellFx('stop', 0, 0);
    let longest = 0;
    const fly = (el, tf, i) => {
      const delay = Math.min(260, i * 0.35) + rand(0, 120), dur = rand(620, 900); longest = Math.max(longest, delay + dur);
      el.style.transition = `transform ${dur | 0}ms cubic-bezier(.55,-0.12,.2,1.15) ${delay | 0}ms, opacity 280ms ${delay | 0}ms, filter 400ms ${delay | 0}ms`;
      el.style.transform = tf; el.style.opacity = '1'; el.style.filter = ''; el.style.textShadow = '';
    };
    let i = 0;
    for (const o of letters) if (o.alive && o.el.isConnected && o.home) { o.el.classList.remove('drip'); o.el.style.setProperty('--trail', '0px'); fly(o.el, `translate(${o.home[0]}px,${o.home[1]}px) rotate(0rad)`, i++); }
    for (const o of images) if (o.alive && o.el.isConnected && o.home) fly(o.el, `translate(${o.home[0]}px,${o.home[1]}px) rotate(0rad)`, i++);
    for (const o of loose) if (o.alive) { o.el.style.setProperty('transition', `transform ${700 + rand(0, 200) | 0}ms cubic-bezier(.55,-0.12,.2,1.15)`, 'important'); o.el.style.setProperty('transform', 'translate(0px,0px) rotate(0rad)', 'important'); longest = Math.max(longest, 900); }
    if (scorchHost) { scorchHost.style.setProperty('transition', 'opacity .7s', 'important'); scorchHost.style.setProperty('opacity', '0', 'important'); }
    if (hl) { hl.style.transition = 'opacity .7s'; hl.style.opacity = '0'; }
    if (fx) { fx.style.transition = 'opacity .3s'; fx.style.opacity = '0'; }
    setTimeout(() => { H.rewinding = false; stop(); if (then) then(); }, longest + 60);
  }
  H.rewind = then => rewind(then);
  let resizeT;
  // the window changed size (or the phone turned): keep the mess, move the floor and walls, keep the scorch marks
  function onResize() {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      if (!H.active || H.rewinding) return;
      const nw = innerWidth, nh = innerHeight; if (nw === W && nh === Hh) return;
      const keep = cv => { const t = document.createElement('canvas'); t.width = cv.width; t.height = cv.height; t.getContext('2d').drawImage(cv, 0, 0); return t; };
      const s0 = keep(scorch), h0 = keep(hl);
      W = nw; Hh = nh;
      for (const cv of [scorch, hl, fx]) sizeCanvas(cv);
      sc.setTransform(1, 0, 0, 1, 0, 0); sc.drawImage(s0, 0, 0); sc.setTransform(DPR, 0, 0, DPR, 0, 0);
      hlc.setTransform(1, 0, 0, 1, 0, 0); hlc.drawImage(h0, 0, 0); hlc.setTransform(DPR, 0, 0, DPR, 0, 0);
      const T = 200;
      Body.setPosition(walls[0], { x: W / 2, y: Hh + T / 2 }); Body.setPosition(walls[1], { x: -T / 2, y: Hh / 2 - 1000 }); Body.setPosition(walls[2], { x: W + T / 2, y: Hh / 2 - 1000 });
      for (const o of [...letters, ...images, ...loose]) if (o.alive && o.body && !o.body.isStatic) Sleeping.set(o.body, false);
      // the Elements layer rebuilds at the new size: put the page words back into it
      setTimeout(() => { if (H.active && fxw) { for (const o of letters) o.stamped = false; stampAll(); } }, 700);
    }, 200);
  }
  function stop() {
    if (!H.active) return;
    if (unTilt) { const u = unTilt; unTilt = null; u(); }
    H.active = false; H.rewinding = false; cancelAnimationFrame(raf); raining = false; tellFx('stop', 0, 0); document.documentElement.classList.remove('havoc-open');
    removeEventListener('keydown', onKey, true); removeEventListener('resize', onResize);
    try { Engine.clear(engine); } catch (e) {}
    host && host.remove(); host = null; hud = null; scorchHost && scorchHost.remove(); scorchHost = null; lowHost && lowHost.remove(); lowHost = null; lowStage = null;
    for (let i = restore.length - 1; i >= 0; i--) { try { restore[i](); } catch (e) {} }
    // put style attributes back exactly as they were
    touched.forEach((orig, el) => { if (orig === null) { el.getAttribute('style'); /* forces Chrome to sync the lazily-serialized attribute */ if (!el.style.cssText.trim()) el.removeAttribute('style'); } else if (!el.style.cssText.trim() && orig.trim()) el.setAttribute('style', orig); });
    restore = []; touched = new Map(); letters = []; images = []; bodyMap.clear(); cards = []; loose = []; dentBoxes = null;
  }
  H.start = start; H.stop = stop;
  H.blast = (x, y) => { if (H.active) blast(x, y); };
  H.toolList = () => TOOLS.map(t => ({ key: t.key, name: t.name, id: t.id, color: t.color }));   // for the phone controller (havoc.js)
  H.tools = () => ({ bombs: bombs.length, vents: vents.length, words: letters.filter(o => o.alive).length });   // tests
  H.melt = (x, y) => { if (H.active) melt(x, y); };
  // a smaller knock than a blast: the words nearby fly off, no boom
  H.knock = (x, y, r = 90, pow = 12) => {
    if (!H.active) return;
    for (const o of bodiesNear(x, y, r)) { const p = o.body.position, dx = p.x - x, dy = p.y - y, d = Math.max(8, Math.hypot(dx, dy)), k = 1 - Math.min(1, d / r);
      release(o, dx / d * pow * k + rand(-1.5, 1.5), dy / d * pow * k - rand(2, 6) * k, rand(-0.4, 0.4)); }
    if (Math.random() < 0.15) damage(x, y);   // a crack now and then, not on every hit
  };
  start(window.__havocOpts || {}); window.__havocOpts = null;
})();
