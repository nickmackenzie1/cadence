/* Elements — turn whatever is on screen into falling-sand matter: fire, snow, water, lava, ice, sand, oil, wood, steam, stone.
   Ported from Nick's "Ember & Frost" living page. Words, panels, icons and images become cells; damaged pieces break loose
   and fall as one piece. Nothing on the real page changes: the matter lives on a canvas over it, and Esc puts it all back.
   window.__elements = { active, start(), stop(), toggle() }. Switching to Physics fires `havoc:mode` with detail 'physics'. */
(() => {
  'use strict';
  if (window.__elements) { window.__elements.toggle(); return; }

  /* ------------------------------------------------------------------ materials */
  const CELL = 2;
  const E = 0, SAND = 1, WATER = 2, ICE = 3, FIRE = 4, WOOD = 5, STEAM = 6, STONE = 7, OIL = 8, LAVA = 9, EMBER = 10, ASH = 11, SMOKE = 12, SNOW = 13, PAGE = 14, GLASS = 15;
  const fluid = new Uint8Array(16), gas = new Uint8Array(16), dens = new Uint8Array(16);
  fluid[WATER] = fluid[OIL] = fluid[LAVA] = 1; gas[STEAM] = gas[FIRE] = gas[SMOKE] = 1;
  dens[OIL] = 1; dens[WATER] = 2; dens[LAVA] = 3; dens[SAND] = 4; dens[ASH] = 4; dens[SNOW] = 1;
  const R = Math.random, rr = (a, b) => a + ((R() * (b - a)) | 0);
  const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  const UP5 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0]];

  // the grid and everything stored per cell
  let W = 0, H = 0, N = 0, grid, life, shade, stamp, owner, colR, colG, colB;
  let els = [];   // page pieces: { cells, total, lost, released, vy, acc, children, thresh }
  let tick = 1, fc = 0, paused = false, snowing = false, glow = 1, bg = [247, 246, 243];

  function set(x, y, m, l) {
    const i = y * W + x, o = owner[i];
    if (o) { const e = els[o]; if (e) e.lost++; owner[i] = 0; }
    grid[i] = m; life[i] = l || 0; shade[i] = (R() * 256) | 0; stamp[i] = tick;
  }
  const setI = (j, m, l) => set(j % W, (j / W) | 0, m, l);
  function swap(i, j) {
    let t = grid[i]; grid[i] = grid[j]; grid[j] = t;
    t = life[i]; life[i] = life[j]; life[j] = t;
    t = shade[i]; shade[i] = shade[j]; shade[j] = t;
    t = owner[i]; owner[i] = owner[j]; owner[j] = t;
    t = colR[i]; colR[i] = colR[j]; colR[j] = t;
    t = colG[i]; colG[i] = colG[j]; colG[j] = t;
    t = colB[i]; colB[i] = colB[j]; colB[j] = t;
    stamp[i] = stamp[j] = tick;
  }
  function randN(x, y) {
    const d = N8[(R() * 8) | 0], nx = x + d[0], ny = y + d[1];
    return nx < 0 || nx >= W || ny < 0 || ny >= H ? -1 : ny * W + nx;
  }
  const char = (j, amt) => { life[j] = Math.min(255, life[j] + amt); };
  // heat something flammable (wood or a piece of the page); k = intensity
  function heat(j, t, k) {
    const c = life[j] / 255;
    if (t === PAGE) { if (R() < (0.012 + c * 0.14) * k) setI(j, EMBER, rr(40, 110)); else char(j, 4 * k); }
    else { if (R() < (0.006 + c * 0.06) * k) setI(j, EMBER, rr(140, 250)); else char(j, 2 * k); }
  }
  // sand soaks up heat, glows, and fuses into glass
  function melt(j, a) { life[j] = Math.min(255, life[j] + a); if (life[j] >= 200 && R() < 0.3) setI(j, GLASS, 255); }

  /* ------------------------------------------------------------------ movement */
  function fall(i, m, nx, ny) {
    if (nx < 0 || nx >= W || ny >= H) return false;
    const j = ny * W + nx, t = grid[j];
    if (t === E || ((fluid[t] || gas[t]) && dens[t] < dens[m] && R() < 0.7)) { swap(i, j); return true; }
    return false;
  }
  function powder(i, x, y, m) {
    if (fall(i, m, x, y + 1)) return;
    const d = R() < 0.5 ? -1 : 1;
    if (fall(i, m, x + d, y + 1)) return;
    fall(i, m, x - d, y + 1);
  }
  function liquid(i, x, y, m, spread) {
    if (fall(i, m, x, y + 1)) return;
    const d = R() < 0.5 ? -1 : 1;
    if (fall(i, m, x + d, y + 1)) return;
    if (fall(i, m, x - d, y + 1)) return;
    let ci = i, cx = x;
    for (let s = 0; s < spread; s++) {
      const nx = cx + d; if (nx < 0 || nx >= W) break;
      const j = y * W + nx; if (grid[j] !== E) break;
      swap(ci, j); ci = j; cx = nx;
    }
  }
  function rise(i, m, nx, ny) {
    if (nx < 0 || nx >= W || ny < 0 || ny >= H) return false;
    const j = ny * W + nx, t = grid[j];
    if (t === E || (t === SMOKE && m !== SMOKE && R() < 0.5) || (m === STEAM && fluid[t] && R() < 0.3)) { swap(i, j); return true; }
    return false;
  }
  function gasMove(i, x, y, m, up) {
    const d = R() < 0.5 ? -1 : 1;
    if (R() < up) { if (rise(i, m, x, y - 1)) return; if (rise(i, m, x + d, y - 1)) return; }
    rise(i, m, x + d, y);
  }

  /* ------------------------------------------------------------------ one step of the world */
  function step() {
    tick = (tick % 255) + 1;
    const ltr = tick & 1;
    for (let y = H - 1; y >= 0; y--) {
      for (let k = 0; k < W; k++) {
        const x = ltr ? k : W - 1 - k, i = y * W + x, m = grid[i];
        if (m === E || m === STONE || m === WOOD || m === PAGE || stamp[i] === tick) continue;
        switch (m) {
          case SAND: {
            if (life[i]) {
              life[i] = life[i] > 2 ? life[i] - 2 : 0;
              if (life[i] > 110) { const j = randN(x, y); if (j >= 0 && grid[j] === SAND) melt(j, life[i] >> 4); }
            }
            powder(i, x, y, m); break;
          }
          case ASH: powder(i, x, y, m); break;
          case WATER: liquid(i, x, y, m, 5); break;
          case OIL: liquid(i, x, y, m, 3); break;
          case GLASS: {
            if (life[i]) {
              if (life[i] > 140) { const j = randN(x, y); if (j >= 0 && grid[j] === SAND) melt(j, 9); }
              life[i] = life[i] > 2 ? life[i] - 2 : 0;
            }
            break;
          }
          case SNOW: {
            const j = randN(x, y);
            if (j >= 0) {
              const t = grid[j];
              if ((t === FIRE || t === EMBER || t === LAVA) && R() < 0.3) { set(x, y, WATER); break; }
              if (t === STEAM && R() < 0.1) { set(x, y, WATER); break; }
              if (t === WATER && R() < 0.004) { set(x, y, WATER); break; }
            }
            if (y > 2 && grid[i - W] === SNOW && grid[i - 2 * W] === SNOW && grid[i - 3 * W] === SNOW && R() < 0.00025) { set(x, y, ICE); break; }
            if (R() < 0.45) break;
            const d = R() < 0.5 ? -1 : 1;
            if (R() < 0.35 && fall(i, m, x + d, y + 1)) break;
            if (fall(i, m, x, y + 1)) break;
            if (R() < 0.25) fall(i, m, x + d, y + 1);
            break;
          }
          case ICE: {
            const j = randN(x, y);
            if (j >= 0 && grid[j] === WATER && R() < 0.004) setI(j, ICE);
            break;
          }
          case FIRE: {
            if (life[i] <= 1) { if (R() < 0.3) set(x, y, SMOKE, rr(60, 150)); else grid[i] = E; break; }
            life[i]--;
            let out = false;
            for (let n = 0; n < 8; n++) {
              const nx = x + N8[n][0], ny = y + N8[n][1];
              if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
              const j = ny * W + nx, t = grid[j];
              if (t === WOOD || t === PAGE) heat(j, t, 1);
              else if (t === OIL && R() < 0.25) set(nx, ny, FIRE, rr(30, 60));
              else if (t === ICE && R() < 0.05) set(nx, ny, WATER);
              else if (t === SAND) melt(j, 12);
              else if (t === SNOW && R() < 0.15) set(nx, ny, WATER);
              else if (t === WATER && R() < 0.25) { set(nx, ny, STEAM, rr(150, 250)); out = true; break; }
            }
            if (out) { set(x, y, STEAM, rr(60, 120)); break; }
            gasMove(i, x, y, m, 0.75);
            break;
          }
          case EMBER: {
            if (life[i] <= 1) { if (R() < 0.3) set(x, y, ASH); else grid[i] = E; break; }
            life[i]--;
            if (R() < 0.45) {
              const d = UP5[(R() * 5) | 0], nx = x + d[0], ny = y + d[1];
              if (nx >= 0 && nx < W && ny >= 0 && grid[ny * W + nx] === E) {
                if (R() < 0.05) set(nx, ny, SMOKE, rr(60, 150)); else set(nx, ny, FIRE, rr(10, 30));
              }
            }
            for (let k2 = 0; k2 < 2; k2++) {
              const j = randN(x, y); if (j < 0) continue;
              const t = grid[j];
              if (t === WOOD || t === PAGE) heat(j, t, 2);
              else if (t === OIL && R() < 0.4) setI(j, FIRE, rr(30, 60));
              else if (t === SAND) melt(j, 10);
              else if ((t === ICE && R() < 0.1) || (t === SNOW && R() < 0.4)) setI(j, WATER);
              else if (t === WATER && R() < 0.3) { setI(j, STEAM, rr(150, 250)); set(x, y, WOOD, 230); break; }
            }
            break;
          }
          case STEAM: {
            if (life[i] <= 1) { if (R() < 0.45) set(x, y, WATER); else grid[i] = E; break; }
            life[i]--;
            const j = randN(x, y);
            if (j >= 0 && (grid[j] === ICE || grid[j] === SNOW) && R() < 0.15) { set(x, y, WATER); break; }
            gasMove(i, x, y, m, 0.8);
            break;
          }
          case SMOKE: {
            if (life[i] <= 1) { grid[i] = E; break; }
            life[i]--;
            if (R() < 0.6) gasMove(i, x, y, m, 0.55);
            break;
          }
          case LAVA: {
            let cooled = false;
            for (let k2 = 0; k2 < 2; k2++) {
              const j = randN(x, y); if (j < 0) continue;
              const t = grid[j];
              if (t === WATER) { setI(j, STEAM, rr(150, 250)); if (R() < 0.5) { set(x, y, STONE); cooled = true; break; } }
              else if (t === SAND) melt(j, 25);
              else if (t === SNOW) setI(j, R() < 0.5 ? STEAM : WATER, rr(100, 200));
              else if (t === ICE && R() < 0.2) { setI(j, WATER); if (R() < 0.05) { set(x, y, STONE); cooled = true; break; } }
              else if (t === WOOD || t === PAGE) heat(j, t, 3);
              else if (t === OIL && R() < 0.5) setI(j, FIRE, rr(30, 60));
            }
            if (cooled) break;
            if (y > 0 && grid[i - W] === E && R() < 0.004) set(x, y - 1, R() < 0.5 ? SMOKE : FIRE, rr(10, 40));
            if (tick % 3 === 0) liquid(i, x, y, m, 1);
            break;
          }
        }
      }
    }
  }

  /* ------------------------------------------------------------------ rigid page pieces: break loose once damaged, fall as one */
  function release(id) {
    const e = els[id]; e.released = true; e.vy = 0; e.acc = 0;
    for (const cid of e.children) {          // a panel carries the words, icons and images inside it
      const c = els[cid]; if (!c) continue;
      for (const k of c.cells) if (owner[k] === cid) { owner[k] = id; e.cells.push(k); }
      els[cid] = null;
    }
    e.cells.sort((a, b) => b - a);           // bottom rows first, so the shape holds while it moves
  }
  function canMove(e, id) {
    for (let n = 0; n < e.cells.length; n++) {
      const j = e.cells[n] + W;
      if (j >= N) return false;
      if (owner[j] === id) continue;
      const t = grid[j];
      if (!(t === E || gas[t] || fluid[t])) return false;
    }
    return true;
  }
  function bodies() {
    for (let id = 1; id < els.length; id++) {
      const e = els[id]; if (!e) continue;
      if (!e.released) { if (e.lost > e.total * e.thresh) release(id); else continue; }
      e.cells = e.cells.filter(c => owner[c] === id);
      if (!e.cells.length) { els[id] = null; continue; }
      e.vy = Math.min(e.vy + 0.18, 5); e.acc += e.vy;
      while (e.acc >= 1) {
        e.acc -= 1;
        if (!canMove(e, id)) { e.vy = 0; e.acc = 0; break; }
        for (let n = 0; n < e.cells.length; n++) { const c = e.cells[n]; swap(c, c + W); e.cells[n] = c + W; }
      }
    }
  }

  /* ------------------------------------------------------------------ read the screen into cells (the page itself is never changed) */
  // computed colours come as rgb()/rgba() or, from color-mix(), as color(srgb r g b / a) with 0–1 channels
  function parseColor(s) {
    const m = String(s).match(/[\d.]+/g) || [0, 0, 0, 0];
    if (/^color\(/.test(s)) return [m[0] * 255, m[1] * 255, m[2] * 255, m[3] === undefined ? 1 : +m[3]];
    return [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]];
  }
  function newEl(thresh) { els.push({ cells: [], total: 0, lost: 0, released: false, vy: 0, acc: 0, children: [], thresh }); return els.length - 1; }
  // paint one cell, blending see-through colours over whatever is already there
  function put(i, id, r, g, b, a) {
    if (a === undefined) a = 1;
    if (a < 1) {
      const u = grid[i] === PAGE ? [colR[i], colG[i], colB[i]] : bg;
      r = u[0] + (r - u[0]) * a; g = u[1] + (g - u[1]) * a; b = u[2] + (b - u[2]) * a;
    }
    if (owner[i] && els[owner[i]]) els[owner[i]].total--;   // covered by something on top: no longer part of the piece below
    grid[i] = PAGE; owner[i] = id; colR[i] = r; colG[i] = g; colB[i] = b; life[i] = 0; shade[i] = (R() * 256) | 0;
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
  const ours = el => el && el.closest && el.closest('#elements-host, #havoc-host');

  let run = 0;   // bumped on every start and stop, so callbacks from a closed run do nothing
  async function harvest(my) {
    const idOf = new Map(), area = innerWidth * innerHeight;
    const pieceOf = el => { for (let e = el && el.parentElement; e; e = e.parentElement) if (idOf.has(e)) return idOf.get(e); return 0; };
    const all = document.body.querySelectorAll('*');

    // 1. panels: anything with a visible background or border, smaller than most of the screen (big ones are the backdrop)
    for (const el of all) {
      if (ours(el) || /^(SCRIPT|STYLE|SVG|PATH|IMG|CANVAS|BR|HTML|BODY)$/i.test(el.tagName)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      if (r.width * r.height > area * 0.55) continue;
      const cs = getComputedStyle(el), bgc = parseColor(cs.backgroundColor);
      const sides = ['Top', 'Right', 'Bottom', 'Left'].map(s => ({ w: Math.max(0, Math.round(parseFloat(cs['border' + s + 'Width']) / CELL)) * (cs['border' + s + 'Style'] === 'none' ? 0 : 1), c: parseColor(cs['border' + s + 'Color']) }));
      const hasBorder = sides.some(s => s.w && s.c[3] > 0.08);
      if (bgc[3] < 0.02 && !hasBorder) continue;
      if (!seen(el)) continue;
      const b = cellBox(r, clipOf(el.parentElement)); if (b.x1 <= b.x0 || b.y1 <= b.y0) continue;
      const id = newEl(0.2); idOf.set(el, id);
      const parent = pieceOf(el); if (parent) els[parent].children.push(id);
      const rad = Math.round(parseFloat(cs.borderTopLeftRadius) / CELL) || 0;
      for (let y = b.y0; y < b.y1; y++) for (let x = b.x0; x < b.x1; x++) {
        if (!inRound(x, y, b, rad)) continue;
        let c = null;
        if (y < b.ry0 + sides[0].w) c = sides[0].c; else if (y >= b.ry1 - sides[2].w) c = sides[2].c;
        else if (x < b.rx0 + sides[3].w) c = sides[3].c; else if (x >= b.rx1 - sides[1].w) c = sides[1].c;
        if (c && c[3] > 0.08) put(y * W + x, id, c[0], c[1], c[2], c[3]);
        else if (bgc[3] >= 0.02) put(y * W + x, id, bgc[0], bgc[1], bgc[2], bgc[3]);
      }
    }

    // 2. pictures: <img>, <canvas> and the little SVG icons, sampled at cell size
    const sample = (src, el, r) => {
      if (my !== run) return;
      const b = cellBox(r, clipOf(el.parentElement)); if (b.x1 <= b.x0 || b.y1 <= b.y0) return;
      const w = b.rx1 - b.rx0, h = b.ry1 - b.ry0; if (w <= 0 || h <= 0) return;
      const oc = document.createElement('canvas'); oc.width = w; oc.height = h;   // fresh canvas each time: one tainted image can't spoil the rest
      const ox = oc.getContext('2d', { willReadFrequently: true });
      let d;
      try { ox.drawImage(src, 0, 0, w, h); d = ox.getImageData(0, 0, w, h).data; } catch (e) { return; }
      const id = newEl(0.18); const parent = pieceOf(el); if (parent) els[parent].children.push(id);
      const rad = Math.round(parseFloat(getComputedStyle(el).borderTopLeftRadius) / CELL) || 0;
      for (let y = b.y0; y < b.y1; y++) for (let x = b.x0; x < b.x1; x++) {
        if (!inRound(x, y, b, rad)) continue;
        const k = ((y - b.ry0) * w + (x - b.rx0)) * 4, a = d[k + 3] / 255;
        if (a > 0.25) put(y * W + x, id, d[k], d[k + 1], d[k + 2], a);
      }
    };
    const pics = [];
    for (const el of document.body.querySelectorAll('img, canvas, svg')) {
      if (ours(el) || (el.tagName === 'svg' && el.ownerSVGElement)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 3 || r.height < 3 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth || !seen(el)) continue;
      if (el.tagName === 'IMG') { if (el.complete && el.naturalWidth) sample(el, el, r); }
      else if (el.tagName === 'CANVAS') sample(el, el, r);
      else if (r.width <= 96 && r.height <= 96 && pics.length < 400) {
        // icons are styled by the stylesheet, so carry the computed paint onto a copy before turning it into a picture
        const cs = getComputedStyle(el), copy = el.cloneNode(true);
        copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); copy.setAttribute('width', r.width); copy.setAttribute('height', r.height);
        const paint = s => `color:${s.color};fill:${s.fill};stroke:${s.stroke};stroke-width:${s.strokeWidth};stroke-linecap:${s.strokeLinecap};stroke-linejoin:${s.strokeLinejoin};stroke-dasharray:${s.strokeDasharray};stroke-dashoffset:${s.strokeDashoffset};opacity:${s.opacity};fill-opacity:${s.fillOpacity};stroke-opacity:${s.strokeOpacity}`;
        copy.setAttribute('style', paint(cs));
        const src = el.querySelectorAll('*'), dst = copy.querySelectorAll('*');   // every shape inside too (rings, dots…)
        for (let k = 0; k < src.length && k < 200; k++) dst[k].setAttribute('style', paint(getComputedStyle(src[k])));
        const im = new Image();
        pics.push(new Promise(res => { im.onload = () => { sample(im, el, r); res(); }; im.onerror = res; setTimeout(res, 400); }));
        im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(copy).replace(/currentColor/g, cs.color));
      }
    }
    await Promise.all(pics);
    if (my !== run) return false;

    // 3. words: each visible word is drawn in its own font, then reduced to cells by coverage
    const tc = document.createElement('canvas'), tx = tc.getContext('2d', { willReadFrequently: true });
    const range = document.createRange();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: n => !n.nodeValue.trim() || ours(n.parentElement) || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|OPTION)$/.test(n.parentElement.tagName) ? 2 : 1
    });
    const styleOf = new Map();
    const drawWord = (text, r, el, cs) => {
      const clip = clipOf(el);
      if (r.right < clip.l || r.left > clip.r || r.bottom < clip.t || r.top > clip.b) return;
      const col = parseColor(cs.color); if (col[3] < 0.05) return;
      if (cs.textTransform === 'uppercase') text = text.toUpperCase(); else if (cs.textTransform === 'lowercase') text = text.toLowerCase();
      const x0 = Math.floor(r.left / CELL), y0 = Math.floor(r.top / CELL);
      const cw = Math.ceil(r.width / CELL) + 3, ch = Math.ceil(r.height / CELL) + 2;
      tc.width = cw * CELL; tc.height = ch * CELL;
      tx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; tx.fillStyle = '#000';
      if ('letterSpacing' in tx) tx.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
      const m = tx.measureText(text), asc = m.fontBoundingBoxAscent || r.height * 0.8;
      tx.fillText(text, r.left - x0 * CELL, r.top - y0 * CELL + asc);
      const d = tx.getImageData(0, 0, tc.width, tc.height).data;
      const id = newEl(0.12); const parent = pieceOf(el); if (parent) els[parent].children.push(id);
      const cx0 = Math.max(0, Math.floor(clip.l / CELL)), cx1 = Math.min(W, Math.ceil(clip.r / CELL)), cy0 = Math.max(0, Math.floor(clip.t / CELL)), cy1 = Math.min(H, Math.ceil(clip.b / CELL));
      for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
        const gx = x0 + cx, gy = y0 + cy; if (gx < cx0 || gx >= cx1 || gy < cy0 || gy >= cy1) continue;
        let a = 0;
        for (let sy = 0; sy < CELL; sy++) for (let sx = 0; sx < CELL; sx++) a += d[((cy * CELL + sy) * tc.width + cx * CELL + sx) * 4 + 3];
        a /= CELL * CELL;
        if (a > 80) put(gy * W + gx, id, col[0], col[1], col[2], col[3]);
      }
    };
    let words = 0;
    while (walker.nextNode() && words < 4000) {
      const n = walker.currentNode, el = n.parentElement;
      const pr = el.getBoundingClientRect(); if (pr.bottom < 0 || pr.top > innerHeight || pr.width === 0) continue;
      if (!styleOf.has(el)) styleOf.set(el, seen(el) ? getComputedStyle(el) : null);
      const cs = styleOf.get(el); if (!cs) continue;
      const re = /\S+/g; let mt;
      while ((mt = re.exec(n.nodeValue))) {
        range.setStart(n, mt.index); range.setEnd(n, mt.index + mt[0].length);
        const r = range.getBoundingClientRect();
        if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
        drawWord(mt[0], r, el, cs); words++;
      }
    }
    // what's typed in inputs (it isn't a text node)
    for (const el of document.body.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]), textarea')) {
      if (ours(el) || !seen(el)) continue;
      const text = el.value || el.placeholder; if (!text) continue;
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (r.bottom < 0 || r.top > innerHeight || !r.width) continue;
      const lh = parseFloat(cs.fontSize) * 1.3, left = r.left + parseFloat(cs.paddingLeft), top = r.top + (el.tagName === 'TEXTAREA' ? parseFloat(cs.paddingTop) : (r.height - lh) / 2);
      const fake = { color: el.value ? cs.color : 'rgba(138,135,127,1)', fontStyle: cs.fontStyle, fontWeight: cs.fontWeight, fontSize: cs.fontSize, fontFamily: cs.fontFamily, letterSpacing: cs.letterSpacing, textTransform: 'none' };
      tx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      drawWord(text.slice(0, 200), { left, top, right: Math.min(r.right, left + tx.measureText(text).width), bottom: top + lh, width: tx.measureText(text).width, height: lh }, el, fake);
    }

    for (let i = 0; i < N; i++) { const o = owner[i]; if (o) els[o].cells.push(i); }
    for (let id = 1; id < els.length; id++) { const e = els[id]; e.total = e.cells.length; e.cells.sort((a, b) => b - a); }
    clipCache.clear();
    return true;
  }

  /* ------------------------------------------------------------------ drawing */
  const cl = v => v < 0 ? 0 : v > 255 ? 255 : v | 0;
  const rgba = (r, g, b, a) => (cl(a) << 24) | (cl(b) << 16) | (cl(g) << 8) | cl(r);
  const rgb = (r, g, b) => rgba(r, g, b, 255);
  const STOPS = [[0, [70, 12, 4]], [0.25, [190, 40, 6]], [0.5, [255, 110, 18]], [0.75, [255, 190, 60]], [1, [255, 246, 205]]];
  const FIREC = new Uint32Array(64);
  for (let n = 0; n < 64; n++) {
    const t = n / 63; let a = STOPS[0], b = STOPS[4];
    for (let s = 0; s < 4; s++) if (t >= STOPS[s][0] && t <= STOPS[s + 1][0]) { a = STOPS[s]; b = STOPS[s + 1]; break; }
    const u = (t - a[0]) / (b[0] - a[0] || 1);
    FIREC[n] = rgb(a[1][0] + (b[1][0] - a[1][0]) * u, a[1][1] + (b[1][1] - a[1][1]) * u, a[1][2] + (b[1][2] - a[1][2]) * u);
  }
  const EMB = [rgb(255, 170, 60), rgb(230, 80, 20), rgb(120, 28, 10)];
  const PR = new Float32Array(256), PG = new Float32Array(256), PB = new Float32Array(256);
  const pal = (m, r, g, b, v) => { for (let s = 0; s < 16; s++) { const k = (R() - 0.5) * v; PR[m * 16 + s] = r + k; PG[m * 16 + s] = g + k * 0.9; PB[m * 16 + s] = b + k * 0.8; } };
  pal(SAND, 214, 182, 112, 44); pal(ICE, 168, 214, 240, 22); pal(STONE, 96, 98, 106, 34); pal(ASH, 92, 90, 88, 26);

  let cv, ctx, base, bctx, light, lctx, l1, l2, l3, l1c, l2c, l3c, img, buf, limg, lbuf, BG;
  const mix = (a, c) => [bg[0] + (c[0] - bg[0]) * a, bg[1] + (c[1] - bg[1]) * a, bg[2] + (c[2] - bg[2]) * a];
  function render() {
    for (let x = 0; x < W; x++) {
      let depth = 0, liq = 0;
      for (let y = 0; y < H; y++) {
        const i = y * W + x, m = grid[i];
        lbuf[i] = 0;
        let r, g, b;
        switch (m) {
          case E: buf[i] = BG; depth = 0; liq = 0; continue;
          case FIRE: {
            const t = life[i] / 30 + (R() - 0.5) * 0.25;
            const c = FIREC[t <= 0 ? 0 : t >= 1 ? 63 : (t * 63) | 0];
            buf[i] = c; lbuf[i] = c; depth = 0; liq = 0; continue;
          }
          case EMBER: { const k = R(), c = EMB[k < 0.35 ? 0 : k < 0.8 ? 1 : 2]; buf[i] = c; lbuf[i] = c; depth++; liq = 0; continue; }
          case STEAM: { const c = mix(0.12 + Math.min(life[i] / 140, 1) * 0.5, [225, 230, 238]); buf[i] = rgb(c[0], c[1], c[2]); depth = 0; liq = 0; continue; }
          case SMOKE: { const c = mix(Math.min(life[i] / 120, 1) * 0.75, [40, 38, 42]); buf[i] = rgb(c[0], c[1], c[2]); depth = 0; liq = 0; continue; }
          case LAVA: {
            const s = shade[i], w = 0.72 + 0.28 * Math.sin(s * 0.09 + fc * 0.05 + x * 0.12 + y * 0.07);
            r = 255 * w; g = (55 + (s & 63)) * w * w; b = 12;
            if (liq === 0) { r *= 0.75; g *= 0.5; }
            buf[i] = rgb(r, g, b); lbuf[i] = rgb(r * 0.75, g * 0.6, b); liq++; depth++; continue;
          }
          case WATER: {
            const d = Math.min(liq, 50) / 50, f = 1 - d * 0.62;
            const sh = Math.sin(x * 0.33 + y * 0.45 + fc * 0.11) * 7 + ((shade[i] & 15) - 8);
            r = (28 + sh * 0.4) * f; g = (100 + sh) * f; b = (210 + sh) * f + 10 * d;
            if (liq === 0) { r += 70; g += 80; b += 40; } else if (liq === 1) { r += 25; g += 30; b += 15; }
            liq++; depth++; break;
          }
          case OIL: {
            const f = 1 - Math.min(liq, 30) / 30 * 0.4; r = 58 * f; g = 42 * f; b = 26 * f;
            if (liq === 0) { const h = Math.sin(x * 0.25 + fc * 0.04); r += 40 + 25 * h; g += 30 + 10 * h; b += 45 - 25 * h; }
            liq++; depth++; break;
          }
          case SNOW: {
            const s = shade[i];
            r = 228 + (s & 15) - 8; g = 234 + (s & 15) - 8; b = 245;
            const above = y > 0 ? grid[i - W] : E;
            if (above !== SNOW) { r += 18; g += 16; b += 10; }
            if (s > 250 && R() < 0.5) { r = g = b = 255; }
            const a = 1 - Math.min(depth, 30) / 30 * 0.22;
            r *= a; g *= a * 1.01; b *= a * 1.04;
            depth++; liq = 0; break;
          }
          case ICE: {
            const s = shade[i] & 15;
            r = PR[ICE * 16 + s]; g = PG[ICE * 16 + s]; b = PB[ICE * 16 + s];
            const above = y > 0 ? grid[i - W] : E, left = x > 0 ? grid[i - 1] : E;
            if (above !== ICE) { r += 45; g += 35; b += 12; } else if (left !== ICE) { r += 20; g += 16; b += 6; }
            if ((shade[i] & 127) > 124) { r += 40; g += 40; b += 20; }
            const a = 1 - Math.min(depth, 30) / 30 * 0.28; r *= a; g *= a; b *= a;
            depth++; liq = 0; break;
          }
          case WOOD: case PAGE: {
            if (m === WOOD) {
              const grain = Math.sin(x * 1.15 + Math.sin(y * 0.12 + x * 0.3) * 2.2) * 14 + ((shade[i] & 15) - 8);
              r = 118 + grain; g = 74 + grain * 0.6; b = 40 + grain * 0.3;
            } else { r = colR[i]; g = colG[i]; b = colB[i]; }
            const c = life[i] / 255;
            if (c > 0) {   // scorch: browns first, then goes black
              const c1 = Math.min(c * 2, 1), c2 = Math.max(c * 2 - 1, 0);
              r += (120 - r) * c1 * 0.7; g += (64 - g) * c1 * 0.7; b += (26 - b) * c1 * 0.7;
              r += (20 - r) * c2; g += (14 - g) * c2; b += (12 - b) * c2;
              if (c > 0.55 && R() < 0.025) { r = 255; g = 120; b = 30; lbuf[i] = rgb(180, 70, 20); }
            }
            depth++; liq = 0; break;
          }
          case GLASS: {
            const s = shade[i] & 15, above = y > 0 ? grid[i - W] : E;
            r = 140 + s; g = 205 + s; b = 195 + s;
            if (above !== GLASS) { r += 50; g += 40; b += 40; }
            if ((x + y + (shade[i] >> 5)) % 9 === 0) { r += 45; g += 45; b += 45; }
            const h = life[i] / 255;
            if (h > 0) { r += (255 - r) * h; g += (140 - g) * h; b += (40 - b) * h; lbuf[i] = rgb(230 * h, 100 * h, 25 * h); }
            const c = mix(0.55 + 0.45 * h, [r, g, b]); buf[i] = rgb(c[0], c[1], c[2]);
            depth++; liq = 0; continue;
          }
          default: {
            const s = shade[i] & 15;
            r = PR[m * 16 + s]; g = PG[m * 16 + s]; b = PB[m * 16 + s];
            if (m === SAND && life[i] > 60) {
              const h = (life[i] - 60) / 195;
              r += (255 - r) * h; g += (110 - g) * h; b += (25 - b) * h;
              lbuf[i] = rgb(210 * h, 80 * h, 18 * h);
            }
            const a = (depth === 0 ? 1.12 : 1) * (1 - Math.min(depth, 26) / 26 * 0.38);
            r *= a; g *= a; b *= a; depth++; liq = 0; break;
          }
        }
        buf[i] = rgb(r, g, b);
      }
    }
    bctx.putImageData(img, 0, 0); lctx.putImageData(limg, 0, 0);
    const DW = cv.width, DH = cv.height;
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false; ctx.drawImage(base, 0, 0, DW, DH);
    if (glow > 0) {   // bloom: shrink the glowing layer a few times, then add it back blurred
      l1c.clearRect(0, 0, l1.width, l1.height); l1c.drawImage(light, 0, 0, l1.width, l1.height);
      l2c.clearRect(0, 0, l2.width, l2.height); l2c.drawImage(l1, 0, 0, l2.width, l2.height);
      l3c.clearRect(0, 0, l3.width, l3.height); l3c.drawImage(l2, 0, 0, l3.width, l3.height);
      ctx.imageSmoothingEnabled = true; ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55 * glow; ctx.drawImage(l1, 0, 0, DW, DH);
      ctx.globalAlpha = 0.8 * glow; ctx.drawImage(l2, 0, 0, DW, DH);
      ctx.globalAlpha = 1.0 * glow; ctx.drawImage(l3, 0, 0, DW, DH);
      ctx.globalAlpha = 0.6 * glow; ctx.drawImage(l3, 0, 0, DW, DH);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
  }

  /* ------------------------------------------------------------------ tools and painting */
  const TOOLS = [
    { id: FIRE, key: '1', name: 'Fire', hint: 'Burns the page, boils water, melts snow', color: '#ff7a1f', icon: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>' },
    { id: SNOW, key: '2', name: 'Snow', hint: 'Drifts down and piles up', color: '#dfe8f7', icon: '<path d="M2 12h20M12 2v20M20 16l-4-4 4-4M4 8l4 4-4 4M16 4l-4 4-4-4M8 20l4-4 4 4"/>' },
    { id: WATER, key: '3', name: 'Water', hint: 'Finds the lowest point; puts fires out', color: '#4c8df6', icon: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>' },
    { id: LAVA, key: '4', name: 'Lava', hint: 'Glows, lights things, turns to stone in water', color: '#ef5a12', icon: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>' },
    { id: ICE, key: '5', name: 'Ice', hint: 'Melts in heat, freezes water it touches', color: '#a8d6f0', icon: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h3M8 8v3"/>' },
    { id: SAND, key: '6', name: 'Sand', hint: 'Piles up; heat it into glass', color: '#d6b670', icon: '<path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/>' },
    { id: OIL, key: '7', name: 'Oil', hint: 'Floats on water, catches fire easily', color: '#a07a4a', icon: '<path d="M3 22h12M4 9h10M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9.83a2 2 0 0 0-.59-1.42L18 5"/>' },
    { id: WOOD, key: '8', name: 'Wood', hint: 'Chars, then burns as embers', color: '#9a6a40', icon: '<path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17ZM12 22v-3"/>' },
    { id: STEAM, key: '9', name: 'Steam', hint: 'Rises, then comes back down as rain', color: '#c9ced8', icon: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>' },
    { id: STONE, key: '0', name: 'Stone', hint: 'Walls and floors', color: '#8c8f98', icon: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 9v6M16 15v6M16 3v6M3 15h18M3 9h18M8 15v6M8 3v6"/>' },
    { id: E, key: '-', name: 'Eraser', hint: 'Clears anything', color: '#ffffff', icon: '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21M22 21H7M5 11l9 9"/>' },
  ];
  const ICONS = {
    ignite: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    snowfall: '<path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2M8 15h.01M8 19h.01M12 17h.01M12 21h.01M16 15h.01M16 19h.01"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    play: '<path d="M6 3l14 9-14 9z"/>',
    reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
  };
  let tool = FIRE, brush = 6;

  function paint(cx, cy) {
    const r = brush;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const x = cx + dx, y = cy + dy;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const i = y * W + x, cur = grid[i];
      if (tool === E) { if (cur !== E) set(x, y, E); continue; }
      if (tool === FIRE) {
        if (cur === WOOD || cur === PAGE) { if (R() < 0.5) set(x, y, EMBER, cur === PAGE ? rr(40, 110) : rr(140, 250)); }
        else if (cur === OIL) set(x, y, FIRE, rr(30, 60));
        else if (cur === E && R() < 0.3) set(x, y, FIRE, rr(20, 45));
        continue;
      }
      if (cur !== E) continue;
      const solid = tool === WOOD || tool === STONE || tool === ICE;
      if (solid || R() < (tool === SNOW ? 0.5 : 0.35)) set(x, y, tool, tool === STEAM ? rr(150, 250) : 0);
    }
  }
  function ignite() {   // light the bottom edge of a few pieces of the page
    const cands = [];
    for (let id = 1; id < els.length; id++) { const e = els[id]; if (e && e.cells.length && !e.released) cands.push(id); }
    for (let n = 0; n < 5 && cands.length; n++) {
      const e = els[cands.splice((R() * cands.length) | 0, 1)[0]];
      for (let k = 0; k < Math.min(6, e.cells.length); k++) { const c = e.cells[(R() * Math.min(40, e.cells.length)) | 0]; if (grid[c] === PAGE) setI(c, EMBER, rr(60, 120)); }
    }
  }

  /* ------------------------------------------------------------------ toolbar (same look as Havoc's) */
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
  let host, root, hud, tipEl;
  const btn = (id, title, color, key, icon) => `<button data-id="${id}" style="--c:${color || '#fff'}" aria-label="${title}">${'<svg viewBox="0 0 24 24" aria-hidden="true">' + icon + '</svg>'}${key ? `<span class="k">${key}</span>` : ''}</button>`;
  function buildHud() {
    hud = document.createElement('div'); hud.className = 'hud'; hud.setAttribute('role', 'toolbar'); hud.setAttribute('aria-label', 'Elements');
    hud.innerHTML = `<div class="brand"><i></i>ELEMENTS</div>`
      + `<div class="modes" role="group" aria-label="Mode"><button data-mode="physics" aria-pressed="false">Physics</button><button data-mode="elements" class="on" aria-pressed="true">Elements</button></div><div class="sep"></div>`
      + TOOLS.map(t => btn('t' + t.id, t.name, t.color, t.key, t.icon)).join('')
      + `<div class="sep"></div><label class="size">Size <input type="range" min="1" max="16" value="${brush}" aria-label="Brush size"></label>`
      + btn('ignite', 'Ignite', '#ff7a1f', 'I', ICONS.ignite) + btn('snowfall', 'Snowfall', '#dfe8f7', 'S', ICONS.snowfall)
      + btn('pause', 'Pause', '#fff', '', ICONS.pause) + btn('reset', 'Rebuild the page', '#fff', '', ICONS.reset) + btn('close', 'Exit (Esc)', '#fff', '', ICONS.close);
    tipEl = document.createElement('div'); tipEl.className = 'tip';
    hud.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return; e.stopPropagation();
      if (b.dataset.mode) { if (b.dataset.mode === 'physics') { stop(); dispatchEvent(new CustomEvent('havoc:mode', { detail: 'physics' })); } return; }
      const id = b.dataset.id;
      if (id[0] === 't') tool = +id.slice(1);
      else if (id === 'ignite') ignite();
      else if (id === 'snowfall') snowing = !snowing;
      else if (id === 'pause') paused = !paused;
      else if (id === 'reset') { stop(); setTimeout(start, 60); return; }
      else if (id === 'close') { stop(); return; }
      syncHud();
    });
    hud.querySelector('.size input').addEventListener('input', e => { brush = +e.target.value; });
    hud.addEventListener('pointerover', e => {
      const b = e.target.closest('button'); if (!b || b.dataset.mode) return;
      const t = TOOLS.find(x => 't' + x.id === b.dataset.id);
      const label = t ? `<b>${t.name}</b> · ${t.hint}` : { ignite: '<b>Ignite</b> · set a few things alight', snowfall: '<b>Snowfall</b> · let it snow', pause: paused ? 'Play · Space' : 'Pause · Space', reset: 'Rebuild the page and start over', close: 'Exit and restore · Esc' }[b.dataset.id];
      tipEl.style.setProperty('--c', t ? t.color : '#fff'); tipEl.innerHTML = label; tipEl.classList.add('show');
    });
    hud.addEventListener('pointerout', () => tipEl.classList.remove('show'));
    root.append(hud, tipEl);
    syncHud();
  }
  function syncHud() {
    if (!hud) return;
    hud.querySelectorAll('button[data-id]').forEach(b => {
      const id = b.dataset.id;
      b.classList.toggle('on', id === 't' + tool || (id === 'snowfall' && snowing) || (id === 'pause' && paused));
      if (id === 'pause') { b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${paused ? ICONS.play : ICONS.pause}</svg>`; b.setAttribute('aria-label', paused ? 'Play' : 'Pause'); }
    });
  }

  /* ------------------------------------------------------------------ lifecycle */
  let raf = 0, down = false, px = 0, py = 0, locked = [];
  const S = window.__elements = { active: false, toggle() { S.active ? stop() : start(); } };
  const toGrid = e => [Math.floor(e.clientX / CELL), Math.floor(e.clientY / CELL)];
  function line(x0, y0, x1, y1) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= steps; s++) paint(Math.round(x0 + (x1 - x0) * s / steps), Math.round(y0 + (y1 - y0) * s / steps));
  }
  function onKey(e) {
    if (!S.active || e.metaKey || e.ctrlKey || e.altKey) return;
    e.stopPropagation();   // the app underneath shouldn't react while the page is matter
    if (e.key === 'Escape' || (e.key === 'H' && e.shiftKey)) { e.preventDefault(); stop(); return; }
    const t = TOOLS.find(t => t.key === e.key);
    if (t) { tool = t.id; e.preventDefault(); }
    else if (e.key === 'i' || e.key === 'I') ignite();
    else if (e.key === 's' || e.key === 'S') snowing = !snowing;
    else if (e.key === ' ') { e.preventDefault(); paused = !paused; }
    else if (e.key === '[') brush = Math.max(1, brush - 1);
    else if (e.key === ']') brush = Math.min(16, brush + 1);
    syncHud();
  }
  function frame() {
    fc++;
    if (!S.active) return;
    if (down) paint(px, py);
    if (!paused && !document.hidden) {
      if (snowing) for (let n = 0; n < 5; n++) { const x = (R() * W) | 0; if (grid[x] === E && R() < 0.6) set(x, 0, SNOW); }
      step(); bodies();
    }
    render();
    raf = requestAnimationFrame(frame);
  }
  let resizeT;
  function onResize() { clearTimeout(resizeT); resizeT = setTimeout(() => { if (S.active) { stop(); start(); } }, 300); }

  async function start() {
    if (S.active) return;
    S.active = true;
    W = Math.ceil(innerWidth / CELL); H = Math.ceil(innerHeight / CELL); N = W * H;
    grid = new Uint8Array(N); life = new Uint8Array(N); shade = new Uint8Array(N); stamp = new Uint8Array(N);
    owner = new Uint16Array(N); colR = new Uint8Array(N); colG = new Uint8Array(N); colB = new Uint8Array(N);
    els = [null]; tick = 1; paused = false; snowing = false;
    // the backdrop: the page's own background colour
    const pick = el => { const c = parseColor(getComputedStyle(el).backgroundColor); return c[3] > 0.5 ? c : null; };
    const under = document.elementFromPoint(innerWidth * 0.6, innerHeight * 0.5);
    let found = null; for (let e = under; e && !found; e = e.parentElement) found = pick(e);
    bg = (found || pick(document.body) || pick(document.documentElement) || [255, 255, 255]).slice(0, 3);
    BG = rgb(bg[0], bg[1], bg[2]);

    host = document.createElement('div'); host.id = 'elements-host';
    host.style.cssText = 'position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;display:block!important;margin:0!important;padding:0!important;border:0!important;background:none!important;transform:none!important;filter:none!important';
    root = host.attachShadow({ mode: 'open' });
    const st = document.createElement('style'); st.textContent = CSS; root.appendChild(st);
    const busy = document.createElement('div'); busy.className = 'busy'; busy.textContent = 'MATERIALISING'; root.appendChild(busy);
    (document.fullscreenElement || document.documentElement).appendChild(host);
    addEventListener('keydown', onKey, true);   // Esc works even while the page is still being read

    const my = ++run;
    const ok = await harvest(my);
    if (!ok || my !== run || !S.active || !host) return;   // closed while reading the page
    busy.remove();

    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };
    base = mk(W, H); bctx = base.getContext('2d'); light = mk(W, H); lctx = light.getContext('2d');
    l1 = mk(W >> 1, H >> 1); l2 = mk(W >> 2, H >> 2); l3 = mk(W >> 3, H >> 3);
    l1c = l1.getContext('2d'); l2c = l2.getContext('2d'); l3c = l3.getContext('2d');
    img = bctx.createImageData(W, H); buf = new Uint32Array(img.data.buffer);
    limg = lctx.createImageData(W, H); lbuf = new Uint32Array(limg.data.buffer);
    cv = document.createElement('canvas'); cv.className = 'sim'; cv.width = W * CELL; cv.height = H * CELL;
    cv.style.width = W * CELL + 'px'; cv.style.height = H * CELL + 'px'; ctx = cv.getContext('2d');
    root.insertBefore(cv, root.firstChild.nextSibling);
    cv.addEventListener('pointerdown', e => { down = true; cv.setPointerCapture(e.pointerId); [px, py] = toGrid(e); paint(px, py); });
    cv.addEventListener('pointermove', e => { if (!down) return; const [x, y] = toGrid(e); line(px, py, x, y); px = x; py = y; });
    const up = () => { down = false; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('contextmenu', e => e.preventDefault());

    // hold the page still underneath while it's matter
    locked = [document.documentElement, document.body].map(el => [el, el.style.overflow]);
    locked.forEach(([el]) => { el.style.overflow = 'hidden'; });
    addEventListener('resize', onResize);
    buildHud();
    S.stats = { pieces: els.length - 1, cells: W * H };
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (!S.active) return;
    S.active = false; run++; cancelAnimationFrame(raf); down = false;
    removeEventListener('keydown', onKey, true); removeEventListener('resize', onResize);
    locked.forEach(([el, v]) => { el.style.overflow = v; if (!el.getAttribute('style')) el.removeAttribute('style'); }); locked = [];
    host && host.remove(); host = null; hud = null; cv = null;
    grid = life = shade = stamp = owner = colR = colG = colB = null; els = [];
  }
  S.start = start; S.stop = stop;
  S._debug = { get grid() { return grid; }, get els() { return els; }, get W() { return W; }, get H() { return H; }, ignite, PAGE, FIRE };
  start();
})();
