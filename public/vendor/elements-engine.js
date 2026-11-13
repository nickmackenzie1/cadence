/* Elements — turn whatever is on screen into falling-sand matter: fire, snow, water, lava, ice, sand, oil, wood, steam, stone.
   Ported from Nick's "Ember & Frost" living page. Words, panels, icons and images become cells; damaged pieces break loose
   and fall as one piece. Nothing on the real page changes: the matter lives on a canvas over it, and Esc puts it all back.
   window.__elements = { active, start(), stop(), toggle() }. Switching to Physics fires `havoc:mode` with detail 'physics'. */
(() => {
  'use strict';
  if (window.__elements) { window.__elements.toggle(); return; }

  /* ------------------------------------------------------------------ the simulation (Nick's engine, v3) */
  const CELL = 2;
  const E=0, SAND=1, WATER=2, ICE=3, FIRE=4, WOOD=5, STEAM=6, STONE=7, OIL=8, LAVA=9, EMBER=10, ASH=11, SMOKE=12, SNOW=13, PAGE=14, GLASS=15, WIRE=16, BULB=17, PLANT=18, ACID=19, FUME=20, POWDER=21, BOLT=22;
  const FIREWORK=30, LIGHTNING=31;   // tools, not materials
  const fluid = new Uint8Array(32), gas = new Uint8Array(32), dens = new Uint8Array(32);
  fluid[WATER]=fluid[OIL]=fluid[LAVA]=fluid[ACID]=1; gas[STEAM]=gas[FIRE]=gas[SMOKE]=gas[FUME]=1;
  dens[OIL]=1; dens[WATER]=2; dens[ACID]=2; dens[LAVA]=3; dens[SAND]=4; dens[ASH]=4; dens[POWDER]=4; dens[SNOW]=1;

  let W=0, H=0, N=0, grid, life, shade, stamp, owner, colR, colG, colB, pristine;
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  let sharpMode = true;
  let els = [];                 // page pieces: { cells, total, lost, released, vy, acc, children, thresh }
  let paused = false, snowing = false, tick = 1, fc = 0, glow = 1;
  let bulbs = [], bright = new Float32Array(256), lightMode = -1;   // -1: no lights hung
  const LIGHT_MODES = ['Twinkle', 'Chase', 'Steady'];
  const BCOL = [[255, 48, 40], [40, 225, 80], [60, 120, 255], [255, 175, 30], [255, 80, 205]];
  const R = Math.random, rr = (a, b) => a + ((R() * (b - a)) | 0);
  const N8 = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
  const UP5 = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0]];

  // temperature: one value per 4×4 cells; heat spreads, rises, and cools toward the cold night air
  const HB = 4; let HW = 0, HH = 0, T, T2, heatView = false;
  const tAt = (x, y) => T[(y >> 2) * HW + (x >> 2)];
  const heatTo = (x, y, target, rate) => { const b = (y >> 2) * HW + (x >> 2); T[b] += (target - T[b]) * rate; };
  // wind: the slider sets a base, gusts come and go on top of it
  let windBase = 0.3, wind = 0, gust = 0, gustT = 0, gustTarget = 0;
  const windSide = () => R() < 0.5 + Math.max(-0.42, Math.min(0.42, wind * 0.3)) ? 1 : -1;
  // fireworks and sparks are free-flying particles; flash and shake are screen effects
  let parts = [], flash = 0, shake = 0, storm = false;
  let snowEverywhere = true, lightsBottom = 0;   // in Cadence snow settles everywhere unless you choose 'on lights'   // where falling snow is allowed to settle
  // light: emission and opacity gathered while drawing, then spread on the coarse grid so solids cast shadows
  let emR, emG, emB, opq, trn, inR, inG, inB, outR, outG, outB;
  let AMBL = 0.9;   // ambient light; on a light page it stays 1 so opening Elements doesn't dim the screen

  function set(x, y, m, l) {
    const i = y * W + x;
    const o = owner[i];
    if (o) { const e = els[o]; if (e) e.lost++; owner[i] = 0; }
    grid[i] = m; life[i] = l || 0; shade[i] = (R() * 256) | 0; stamp[i] = tick; pristine[i] = 0;
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
    pristine[i] = pristine[j] = 0;   // anything that moves becomes pixels
  }
  function randN(x, y) {
    const d = N8[(R() * 8) | 0], nx = x + d[0], ny = y + d[1];
    if (nx < 0 || nx >= W || ny < 0 || ny >= H) return -1;
    return ny * W + nx;
  }
  const char = (j, amt) => { life[j] = Math.min(255, life[j] + amt); };
  // heat a flammable cell (wood or page). k = intensity
  function heat(j, t, k) {
    if (t === POWDER) { explode(j % W, (j / W) | 0, 4); return; }
    if (t === PLANT) { if (R() < 0.08 * k) setI(j, EMBER, rr(25, 60)); return; }
    const c = life[j] / 255;
    if (t === PAGE) { if (R() < (0.012 + c * 0.14) * k) setI(j, EMBER, rr(40, 110)); else char(j, 4 * k); }
    else { if (R() < (0.006 + c * 0.06) * k) setI(j, EMBER, rr(140, 250)); else char(j, 2 * k); }
  }

  // sand soaks up heat, glows, and fuses into glass
  function melt(j, a) { life[j] = Math.min(255, life[j] + a); if (life[j] >= 200 && R() < 0.3) set(j % W, (j / W) | 0, GLASS, 255); }

  // ---------- movement ----------
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
      const nx = cx + d;
      if (nx < 0 || nx >= W) break;
      const j = y * W + nx;
      if (grid[j] !== E) break;
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
    const d = windSide();
    if (Math.abs(wind) > 0.15 && R() < Math.abs(wind) * 0.25 && rise(i, m, x + (wind > 0 ? 1 : -1), y)) return;
    if (R() < up) { if (rise(i, m, x, y - 1)) return; if (rise(i, m, x + d, y - 1)) return; }
    rise(i, m, x + d, y);
  }

  // ---------- cellular step ----------
  function step() {
    tick = (tick % 255) + 1;
    const ltr = tick & 1;
    for (let y = H - 1; y >= 0; y--) {
      for (let k = 0; k < W; k++) {
        const x = ltr ? k : W - 1 - k, i = y * W + x, m = grid[i];
        if (m === E || m === STONE || m === WOOD || m === PAGE || m === WIRE || stamp[i] === tick) continue;
        switch (m) {
          case SAND: {
            if (tAt(x, y) > 900 && R() < 0.02) { set(x, y, GLASS, 255); break; }
            if (life[i] > 60) heatTo(x, y, 150 + life[i] * 2, 0.01);
            if (life[i]) {
              life[i] = life[i] > 2 ? life[i] - 2 : 0;
              if (life[i] > 110) { const j = randN(x, y); if (j >= 0 && grid[j] === SAND) melt(j, life[i] >> 4); }   // heat spreads through the pile
            }
            powder(i, x, y, m); break;
          }
          case ASH: powder(i, x, y, m); break;
          case WATER: {
            {
              const t = tAt(x, y);
              if (t > 100 && R() < 0.06) { set(x, y, STEAM, rr(120, 220)); heatTo(x, y, t - 60, 0.2); break; }   // boils, soaking up heat
              if (t > 30) heatTo(x, y, 20, 0.004);
              if (t < -3 && R() < 0.01) { const j = randN(x, y); if (j >= 0 && (grid[j] === ICE || grid[j] === SNOW)) { set(x, y, ICE); break; } }
              if (y > 0 && grid[i - W] === E && R() < 0.0004) { grid[i] = E; break; }                          // puddles slowly dry up
            }
            // icicles: while it's snowing, drips hanging from the lights or from ice freeze solid
            if (snowing && y > 0 && y < H - 1 && grid[i + W] === E && R() < 0.15 && hangsFromLights(x, y)) { set(x, y, ICE); break; }
            liquid(i, x, y, m, 5); break;
          }
          case BULB: {   // lit bulbs are warm and slowly melt the snow touching them
            if (bright[life[i]] > 0.4) heatTo(x, y, 34, 0.0006);
            if (bright[life[i]] > 0.4 && R() < 0.02) { const j = randN(x, y); if (j >= 0 && grid[j] === SNOW && R() < 0.25) setI(j, WATER); }
            break;
          }
          case OIL: liquid(i, x, y, m, 3); break;
          case GLASS: {
            if (life[i]) {
              heatTo(x, y, 100 + life[i] * 2, 0.01);
              if (life[i] > 140) { const j = randN(x, y); if (j >= 0 && grid[j] === SAND) melt(j, 9); }       // fresh glass is still hot
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
            { const t = tAt(x, y); if (t > 2 && R() < (t - 2) * 0.0004) { set(x, y, WATER); break; } }   // warmth melts it
            if (y > 2 && grid[i - W] === SNOW && grid[i - 2 * W] === SNOW && grid[i - 3 * W] === SNOW && R() < 0.00025) { set(x, y, ICE); break; }
            if (R() < 0.45) break;
            if (life[i] === 1 && y + 1 < H && (grid[i + W] === WIRE || grid[i + W] === BULB) && R() < (snowEverywhere ? 0.85 : 0.35)) {
              // a falling flake usually slips past the thin wire and bulbs
              let moved = false;
              for (let k = 2; k < 14 && y + k < H; k++) { const j = i + k * W, t = grid[j]; if (t === E) { swap(i, j); moved = true; break; } if (t !== WIRE && t !== BULB) break; }
              if (moved) break;
            }
            const d = windSide();
            if (Math.abs(wind) > 0.15 && R() < Math.abs(wind) * 0.3) {   // blown sideways, even off a resting drift
              const nx = x + (wind > 0 ? 1 : -1);
              if (nx >= 0 && nx < W && grid[y * W + nx] === E) { swap(i, y * W + nx); break; }
            }
            if (R() < 0.35 && fall(i, m, x + d, y + 1)) break;
            if (fall(i, m, x, y + 1)) break;
            if (R() < 0.25 && fall(i, m, x + d, y + 1)) break;
            // resting. Falling flakes (life 1) only settle on the light string unless snow is set to settle everywhere;
            // snow you paint (life 0) always stays
            if (life[i] === 1 && !snowEverywhere && y > lightsBottom) { grid[i] = E; break; }
            const wy = wireY[x];
            if (wy > 0 && y < wy && wy - y > (snowEverywhere ? 9 : 5) && R() < 0.15) grid[i] = E;   // keep the drift on the wire shallow
            break;
          }
          case ICE: {
            { const t = tAt(x, y); if (t > 6 && R() < (t - 6) * 0.0002) { set(x, y, WATER); break; } }
            const j = randN(x, y);
            if (j >= 0 && grid[j] === WATER && R() < 0.004) setI(j, ICE);
            break;
          }
          case FIRE: {
            if (life[i] <= 1) { if (R() < 0.3) set(x, y, SMOKE, rr(60, 150)); else grid[i] = E; break; }
            life[i]--;
            heatTo(x, y, 650, 0.04);
            let out = false;
            for (let n = 0; n < 8; n++) {
              const nx = x + N8[n][0], ny = y + N8[n][1];
              if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
              const j = ny * W + nx, t = grid[j];
              if (t === WOOD || t === PAGE || t === PLANT || t === POWDER) heat(j, t, 1);
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
            heatTo(x, y, 600, 0.03);
            if (R() < 0.45) {
              const d = UP5[(R() * 5) | 0], nx = x + d[0], ny = y + d[1];
              if (nx >= 0 && nx < W && ny >= 0 && grid[ny * W + nx] === E) {
                if (R() < 0.05) set(nx, ny, SMOKE, rr(60, 150)); else set(nx, ny, FIRE, rr(10, 30));
              }
            }
            for (let k2 = 0; k2 < 2; k2++) {
              const j = randN(x, y); if (j < 0) continue;
              const t = grid[j];
              if (t === WOOD || t === PAGE || t === PLANT || t === POWDER) heat(j, t, 2);
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
            if (tAt(x, y) < 15 && life[i] > 2) life[i]--;   // condenses faster in the cold
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
          case PLANT: {
            // holly: drinks water and snow, shares it along the vine, and climbs anything it can hold on to
            const j = randN(x, y); if (j < 0) break;
            const t = grid[j];
            if (t === WATER) { setI(j, E); life[i] = Math.min(80, life[i] + 14); }
            else if (t === SNOW && R() < 0.3) { setI(j, E); life[i] = Math.min(80, life[i] + 6); }
            else if (t === PLANT) { const a = (life[i] + life[j]) >> 1; life[j] = life[i] + life[j] - a; life[i] = a; }
            else if (t === E && life[i] >= 2 && R() < 0.08 && canHold(j)) {
              const give = (life[i] - 1) >> 1; life[i] -= give + 1;
              setI(j, PLANT, give); if (R() < 0.05) shade[j] = 255;   // a berry
            }
            break;
          }
          case ACID: {
            const j = randN(x, y);
            if (j >= 0) {
              const t = grid[j];
              const eats = t === PAGE || t === WOOD || t === PLANT || t === SNOW || t === ICE || t === ASH || t === POWDER || (t === SAND && R() < 0.3) || (t === STONE && R() < 0.12);
              if (eats && R() < 0.3) { setI(j, R() < 0.5 ? FUME : E, rr(40, 90)); if (R() < 0.3) { set(x, y, FUME, rr(40, 90)); break; } }
              else if (t === WATER && R() < 0.004) { set(x, y, WATER); break; }   // diluted
            }
            liquid(i, x, y, m, 4); break;
          }
          case FUME: { if (life[i] <= 1) { grid[i] = E; break; } life[i]--; if (R() < 0.7) gasMove(i, x, y, m, 0.6); break; }
          case POWDER: { if (tAt(x, y) > 220 && R() < 0.3) { explode(x, y, 4); break; } powder(i, x, y, m); break; }
          case BOLT: { heatTo(x, y, 3000, 0.3); if (life[i] <= 1) grid[i] = E; else life[i]--; break; }
          case LAVA: {
            heatTo(x, y, 1100, 0.03);
            let cooled = false;
            for (let k2 = 0; k2 < 2; k2++) {
              const j = randN(x, y); if (j < 0) continue;
              const t = grid[j];
              if (t === WATER) { setI(j, STEAM, rr(150, 250)); if (R() < 0.5) { set(x, y, STONE); cooled = true; break; } }
              else if (t === SAND) melt(j, 25);
              else if (t === SNOW) setI(j, R() < 0.5 ? STEAM : WATER, rr(100, 200));
              else if (t === ICE && R() < 0.2) { setI(j, WATER); if (R() < 0.05) { set(x, y, STONE); cooled = true; break; } }
              else if (t === WOOD || t === PAGE || t === PLANT || t === POWDER) heat(j, t, 3);
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

  // ---------- holly support ----------
  function canHold(j) {
    const x = j % W, y = (j / W) | 0;
    for (let n = 0; n < 8; n++) {
      const nx = x + N8[n][0], ny = y + N8[n][1];
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const t = grid[ny * W + nx];
      if (t === PAGE || t === WIRE || t === BULB || t === STONE || t === WOOD || t === GLASS || t === ICE) return true;
    }
    return y + 1 < H && grid[j + W] === PLANT && R() < 0.2;   // short free-standing shoots
  }

  // ---------- explosions ----------
  function explode(cx, cy, r) {
    shake = Math.min(14, shake + r * 1.2); flash = Math.max(flash, 0.12);
    const cells = [];
    for (let dy = -r - 3; dy <= r + 3; dy++) for (let dx = -r - 3; dx <= r + 3; dx++) {
      const x = cx + dx, y = cy + dy; if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const d = Math.hypot(dx, dy); if (d <= r + 3) cells.push([d, x, y, dx, dy]);
    }
    cells.sort((a, b) => b[0] - a[0]);   // outermost first, so things get pushed out of the way
    for (const [d, x, y, dx, dy] of cells) {
      const i = y * W + x, m = grid[i];
      if (m === WIRE || m === BULB) continue;
      if (d <= r) {
        if (m === POWDER) set(x, y, FIRE, rr(10, 30));
        else if (m === E) { if (d < r * 0.75 && R() < 0.7) set(x, y, FIRE, rr(6, 22)); }
        else if (m === PAGE || m === WOOD || m === PLANT) { if (R() < 0.4) set(x, y, R() < 0.5 ? EMBER : E, rr(30, 80)); else char(i, 120); }
        else if (m === SNOW || m === ICE) set(x, y, R() < 0.5 ? STEAM : WATER, rr(60, 140));
        else if (m === WATER || m === ACID) set(x, y, STEAM, rr(80, 160));
        else if (m === GLASS && R() < 0.5) set(x, y, SAND);
        else if (m === STONE && d < r * 0.6 && R() < 0.3) set(x, y, SAND);
      }
      const g2 = grid[i];   // anything loose gets thrown outward
      if (g2 === SAND || g2 === ASH || g2 === SNOW || g2 === WATER || g2 === ACID || g2 === OIL || g2 === POWDER) {
        const k = (r + 4 - d) / (d || 1), tx = Math.round(x + dx * k), ty = Math.round(y + dy * k - 1);
        if (tx >= 0 && tx < W && ty >= 0 && ty < H && grid[ty * W + tx] === E) swap(i, ty * W + tx);
      }
    }
    for (let dy = -r; dy <= r; dy += 4) for (let dx = -r; dx <= r; dx += 4) { const x = cx + dx, y = cy + dy; if (x >= 0 && x < W && y >= 0 && y < H) heatTo(x, y, 1200, 0.6); }
    for (let n = 0; n < 10; n++) spark(cx, cy, (R() - 0.5) * 4, -R() * 3.5, [255, 170 + R() * 60, 60], rr(15, 35));
  }

  // ---------- fireworks ----------
  const FW_COLS = [[255, 70, 60], [80, 255, 120], [90, 150, 255], [255, 210, 70], [255, 110, 230], [240, 245, 255]];
  function spark(x, y, vx, vy, col, life, kind = 0) { if (parts.length < 2500) { const p = { x, y, vx, vy, col, life, max: life, kind }; parts.push(p); return p; } }
  function launch(x, y) {
    const p = spark(x, y, (R() - 0.5) * 0.6, -3.2 - R() * 1.2, FW_COLS[(R() * FW_COLS.length) | 0], rr(28, 50), 1);
    if (p) p.c2 = FW_COLS[(R() * FW_COLS.length) | 0];
  }
  function burst(p) {
    const n = rr(70, 110), ring = R() < 0.4;
    for (let k = 0; k < n; k++) {
      const a = R() * Math.PI * 2, sp = ring ? 2.3 + R() * 0.3 : 0.5 + R() * 2.2;
      spark(p.x, p.y, Math.cos(a) * sp, Math.sin(a) * sp - 0.4, R() < 0.5 ? p.col : p.c2, rr(40, 80), 2);
    }
    flash = Math.max(flash, 0.08); heatTo(p.x | 0, p.y | 0, 500, 0.5);
  }
  function updateParts() {
    const out = [];
    for (let n = 0; n < parts.length; n++) {
      const p = parts[n];
      p.life--;
      if (p.kind === 1) { spark(p.x, p.y + 1, (R() - 0.5) * 0.4, 0.3 + R() * 0.5, [255, 190, 90], rr(6, 14)); p.vx += wind * 0.01; }
      else { p.vy += p.kind === 2 ? 0.03 : 0.05; p.vx *= 0.985; p.vy *= 0.985; p.vx += wind * 0.004; }
      const nx = p.x + p.vx, ny = p.y + p.vy, x = nx | 0, y = ny | 0;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const i = y * W + x, m = grid[i];
      if (m !== E && !gas[m]) {   // landed on something
        if (p.kind === 1) { burst(p); continue; }
        if (m === SNOW && R() < 0.5) set(x, y, WATER);
        else if (m === WATER && R() < 0.2) set(x, y, STEAM, rr(60, 120));
        else if (m === PAGE || m === WOOD) { char(i, p.kind === 2 ? 10 : 20); if (R() < 0.008) set(x, y, EMBER, rr(30, 70)); }
        else if (m === PLANT && R() < 0.04) set(x, y, EMBER, rr(20, 50));
        else if (m === POWDER) explode(x, y, 4);
        continue;
      }
      p.x = nx; p.y = ny;
      if (p.life <= 0) { if (p.kind === 1) burst(p); continue; }
      out.push(p);
    }
    parts = out;
  }

  // ---------- lightning ----------
  function strike(tx, ty) {
    const top = 0;   // the overlay is the viewport
    let x = Math.max(0, Math.min(W - 1, tx + rr(-30, 31))), y = top, hit = -1, dir = 0, seg = 0;
    const path = [], forks = [];
    while (y < H) {
      const i = y * W + x, m = grid[i];
      const passes = m === WIRE || m === BULB || y < ty || (y <= lightsBottom && (m === SNOW || m === ICE || m === WATER));   // arcs in front of everything above where you aimed
      if (m !== E && !gas[m] && !passes) { hit = i; break; }
      if (m === E || gas[m]) path.push(i);   // drawn wherever there's open air
      if (--seg <= 0) { seg = rr(2, 7); dir = Math.max(-2, Math.min(2, rr(-2, 3) + (y < ty ? Math.sign(tx - x) : 0))); }
      for (let k = 1; k <= Math.abs(dir); k++) {   // a horizontal run joins each step, so the bolt is one solid jagged line
        const sx = x + Math.sign(dir) * k; if (sx >= 0 && sx < W && (grid[y * W + sx] === E || gas[grid[y * W + sx]])) path.push(y * W + sx);
      }
      x = Math.max(0, Math.min(W - 1, x + dir)); y++;
      if (R() < 0.035 && path.length > 8) forks.push([x, y, dir || (R() < 0.5 ? -1 : 1)]);
    }
    for (const i of path) {
      if (grid[i] === E || gas[grid[i]]) set(i % W, (i / W) | 0, BOLT, rr(6, 12));
      const j = i + 1; if (R() < 0.5 && j % W && (grid[j] === E || gas[grid[j]])) set(j % W, (j / W) | 0, BOLT, rr(3, 8));   // a little thicker
    }
    for (let [fx, fy, fd] of forks) {
      const len = rr(10, 35);
      for (let k = 0; k < len; k++) { fx += fd + rr(-1, 2); fy++; if (fx < 0 || fx >= W || fy >= H || grid[fy * W + fx] !== E) break; set(fx, fy, BOLT, rr(3, 7)); }
    }
    if (hit >= 0) {
      const hx = hit % W, hy = (hit / W) | 0;
      if (grid[hit] === SAND) {   // fulgurite: a root of glass branching down through the sand
        let gx = hx, gy = hy;
        for (let k = 0; k < 40 && gy < H; k++) {
          const j = gy * W + gx; if (grid[j] !== SAND && grid[j] !== GLASS) break;
          set(gx, gy, GLASS, 255); if (R() < 0.5 && gx + 1 < W && grid[j + 1] === SAND) set(gx + 1, gy, GLASS, 255);
          gy++; gx = Math.max(0, Math.min(W - 1, gx + rr(-1, 2)));
        }
      }
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        if (dx * dx + dy * dy > 16) continue;
        const x2 = hx + dx, y2 = hy + dy; if (x2 < 0 || x2 >= W || y2 < 0 || y2 >= H) continue;
        const j = y2 * W + x2, t = grid[j];
        if (t === SAND && R() < 0.6) set(x2, y2, GLASS, 255);
        else if (t === PAGE || t === WOOD || t === PLANT) { if (R() < 0.5) set(x2, y2, EMBER, rr(40, 100)); else char(j, 160); }
        else if (t === WATER || t === ACID) set(x2, y2, STEAM, rr(100, 200));
        else if (t === SNOW || t === ICE) set(x2, y2, R() < 0.5 ? STEAM : WATER, rr(80, 160));
        else if (t === POWDER) explode(x2, y2, 5);
        else if (t === E && R() < 0.3) set(x2, y2, FIRE, rr(5, 15));
      }
      for (let k = 0; k < 14; k++) spark(hx, hy - 1, (R() - 0.5) * 3, -R() * 3, [220, 230, 255], rr(8, 20));
    }
    flash = 1; shake = Math.max(shake, 5);
  }

  // ---------- temperature ----------
  function heatStep() {
    const amb = snowing ? -8 : -3;
    for (let by = 0; by < HH; by++) for (let bx = 0; bx < HW; bx++) {
      const i = by * HW + bx, c = T[i];
      const l = bx > 0 ? T[i - 1] : c, rt = bx < HW - 1 ? T[i + 1] : c, u = by > 0 ? T[i - HW] : c, d = by < HH - 1 ? T[i + HW] : c;
      const v = c + ((l + rt) * 0.25 + u * 0.18 + d * 0.32 - c) * 0.22;   // heat rises: more comes from below
      T2[i] = v + (amb - v) * 0.008;
    }
    const t = T; T = T2; T2 = t;
  }
  // paper, wood and holly near enough heat scorch and catch fire without being touched
  function heatEffects() {
    for (let b = 0; b < HW * HH; b++) {
      const t = T[b]; if (t < 140) continue;
      const bx = (b % HW) * HB, by = ((b / HW) | 0) * HB;
      for (let k = 0; k < 2; k++) {
        const x = bx + ((R() * HB) | 0), y = by + ((R() * HB) | 0); if (x >= W || y >= H) continue;
        const i = y * W + x, m = grid[i];
        if (m === PAGE || m === WOOD) {
          if (R() < (t - 140) / 300) char(i, 1 + (((t - 140) * 0.02) | 0));
          if (t > (m === PAGE ? 280 : 360) && R() < 0.015) set(x, y, EMBER, m === PAGE ? rr(40, 110) : rr(140, 250));
        } else if (m === PLANT && t > 200 && R() < 0.05) set(x, y, EMBER, rr(20, 50));
      }
    }
  }
  function windStep() {
    if (--gustT <= 0) { gustT = rr(90, 420); gustTarget = (R() * 2 - 1) * (0.2 + Math.abs(windBase) * 0.7) * (R() < 0.25 ? 2 : 1); }
    gust += (gustTarget - gust) * 0.01; wind = windBase + gust;
  }

  // ---------- light that casts shadows ----------
  const OPQ = new Float32Array(32);
  OPQ[PAGE] = OPQ[STONE] = OPQ[WOOD] = OPQ[SAND] = OPQ[POWDER] = 1; OPQ[ASH] = 0.9; OPQ[SNOW] = 0.85; OPQ[PLANT] = 0.75; OPQ[OIL] = 0.6;
  OPQ[WIRE] = 0.5; OPQ[SMOKE] = 0.4; OPQ[ICE] = 0.35; OPQ[WATER] = OPQ[ACID] = 0.3; OPQ[GLASS] = OPQ[STEAM] = OPQ[FUME] = 0.12;
  const EMS = new Float32Array(32 * 3);
  const em = (m, r, g, b) => { EMS[m * 3] = r; EMS[m * 3 + 1] = g; EMS[m * 3 + 2] = b; };
  em(FIRE, 0.12, 0.066, 0.018); em(EMBER, 0.1, 0.04, 0.01); em(LAVA, 0.1, 0.035, 0.005); em(BOLT, 0.7, 0.75, 0.9); em(ACID, 0.004, 0.012, 0.003);
  function sweepLight() {
    const n = HW * HH;
    for (let i = 0; i < n; i++) {
      trn[i] = 1 - Math.min(1, opq[i] / 16);
      inR[i] = inG[i] = inB[i] = 0;
      outR[i] = Math.min(2, emR[i]); outG[i] = Math.min(2, emG[i]); outB[i] = Math.min(2, emB[i]);
    }
    const D1 = 0.86, D2 = 0.81;
    const pull = (i, a, d) => {
      let v = outR[a] * d; if (v > inR[i]) inR[i] = v;
      v = outG[a] * d; if (v > inG[i]) inG[i] = v;
      v = outB[a] * d; if (v > inB[i]) inB[i] = v;
    };
    const pass = i => { const t = trn[i]; let v = inR[i] * t; if (v > outR[i]) outR[i] = v; v = inG[i] * t; if (v > outG[i]) outG[i] = v; v = inB[i] * t; if (v > outB[i]) outB[i] = v; };
    for (let rep = 0; rep < 1; rep++) {
      for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) {
        const i = y * HW + x;
        if (x > 0) pull(i, i - 1, D1);
        if (y > 0) { pull(i, i - HW, D1); if (x > 0) pull(i, i - HW - 1, D2); if (x < HW - 1) pull(i, i - HW + 1, D2); }
        pass(i);
      }
      for (let y = HH - 1; y >= 0; y--) for (let x = HW - 1; x >= 0; x--) {
        const i = y * HW + x;
        if (x < HW - 1) pull(i, i + 1, D1);
        if (y < HH - 1) { pull(i, i + HW, D1); if (x < HW - 1) pull(i, i + HW + 1, D2); if (x > 0) pull(i, i + HW - 1, D2); }
        pass(i);
      }
    }
  }

  // ---------- rigid page pieces: break loose once damaged, then fall as one piece ----------
  function release(id) {
    const e = els[id]; e.released = true; e.vy = 0; e.acc = 0;
    for (const cid of e.children) {          // a card carries the words and images inside it
      const c = els[cid]; if (!c) continue;
      for (const k of c.cells) if (owner[k] === cid) { owner[k] = id; e.cells.push(k); }
      els[cid] = null;
    }
    e.cells.sort((a, b) => b - a);           // bottom rows first so the shape is kept while moving
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
    grid[i] = PAGE; owner[i] = id; colR[i] = r; colG[i] = g; colB[i] = b; life[i] = 0; shade[i] = (R() * 256) | 0; pristine[i] = 1;
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
  let hi, hx;   // the sharp copy of the screen, at full resolution
  const rrect = (x, y, w, h, rad) => { hx.beginPath(); if (hx.roundRect) hx.roundRect(x, y, w, h, Math.max(0, Math.min(rad, w / 2, h / 2))); else hx.rect(x, y, w, h); };
  const clipTo = c => { hx.save(); hx.beginPath(); hx.rect(c.l, c.t, c.r - c.l, c.b - c.t); hx.clip(); };
  async function harvest(my) {
    hi = document.createElement('canvas'); hi.width = W * CELL * DPR; hi.height = H * CELL * DPR;
    hx = hi.getContext('2d'); hx.scale(DPR, DPR);
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
      { // sharp copy: background, then borders (one rounded stroke when all four match, else per side)
        const rp = parseFloat(cs.borderTopLeftRadius) || 0, px = ['Top', 'Right', 'Bottom', 'Left'].map(k => cs['border' + k + 'Style'] === 'none' ? 0 : parseFloat(cs['border' + k + 'Width']) || 0);
        clipTo(clipOf(el.parentElement));
        if (bgc[3] >= 0.02) { hx.fillStyle = cs.backgroundColor; rrect(r.left, r.top, r.width, r.height, rp); hx.fill(); }
        const same = px.every(v => v === px[0]) && ['Right', 'Bottom', 'Left'].every(k => cs['border' + k + 'Color'] === cs.borderTopColor);
        if (same && px[0] > 0) { hx.lineWidth = px[0]; hx.strokeStyle = cs.borderTopColor; rrect(r.left + px[0] / 2, r.top + px[0] / 2, r.width - px[0], r.height - px[0], Math.max(0, rp - px[0] / 2)); hx.stroke(); }
        else {
          if (px[0]) { hx.fillStyle = cs.borderTopColor; hx.fillRect(r.left, r.top, r.width, px[0]); }
          if (px[2]) { hx.fillStyle = cs.borderBottomColor; hx.fillRect(r.left, r.bottom - px[2], r.width, px[2]); }
          if (px[3]) { hx.fillStyle = cs.borderLeftColor; hx.fillRect(r.left, r.top, px[3], r.height); }
          if (px[1]) { hx.fillStyle = cs.borderRightColor; hx.fillRect(r.right - px[1], r.top, px[1], r.height); }
        }
        hx.restore();
      }
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
      const rpx = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, rad = Math.round(rpx / CELL) || 0;
      clipTo(clipOf(el.parentElement)); rrect(r.left, r.top, r.width, r.height, rpx); hx.clip(); hx.drawImage(src, r.left, r.top, r.width, r.height); hx.restore();
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
      clipTo(clip); hx.font = tx.font; hx.fillStyle = cs.color; if ('letterSpacing' in hx) hx.letterSpacing = tx.letterSpacing; hx.fillText(text, r.left, r.top + asc); hx.restore();
      const d = tx.getImageData(0, 0, tc.width, tc.height).data;
      const id = newEl(0.12); const parent = pieceOf(el); if (parent) els[parent].children.push(id);
      const cx0 = Math.max(0, Math.floor(clip.l / CELL)), cx1 = Math.min(W, Math.ceil(clip.r / CELL)), cy0 = Math.max(0, Math.floor(clip.t / CELL)), cy1 = Math.min(H, Math.ceil(clip.b / CELL));
      for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
        const gx = x0 + cx, gy = y0 + cy; if (gx < cx0 || gx >= cx1 || gy < cy0 || gy >= cy1) continue;
        let a = 0;
        for (let sy = 0; sy < CELL; sy++) for (let sx = 0; sx < CELL; sx++) a += d[((cy * CELL + sy) * tc.width + cx * CELL + sx) * 4 + 3];
        a /= CELL * CELL;
        if (a > 30) put(gy * W + gx, id, col[0], col[1], col[2], col[3]);
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

  /* ------------------------------------------------------------------ Christmas lights */
  // ---------- Christmas lights: indestructible wire + bulbs ----------
  const BULB_SHAPE = ['.CCC.', '.CCC.', '.BBB.', 'BHBBB', 'BBBBB', 'BBBBB', '.BBB.', '..B..'];
  let wireY = new Int16Array(0);
  // icicles only grow on the light string, and only up to 5 cells long
  function hangsFromLights(x, y) {
    for (let k = 1; k <= 5; k++) {
      if (y - k < 0) return false;
      const t = grid[(y - k) * W + x];
      if (t === WIRE || t === BULB) return true;
      if (t !== ICE) return false;
    }
    return false;
  }
  function buildLights() {
    bulbs = []; wireY = new Int16Array(W);
    const segs = Math.max(2, Math.round(W / 120)), sw = W / segs, sag = 16, top = 7;
    lightsBottom = top + sag + 12;
    const wy = x => { const t = (x % sw) / sw; return Math.round(top + sag * 4 * t * (1 - t)); };
    const wire = (x, y) => { if (x < 0 || x >= W || y < 0 || y >= H) return; const i = y * W + x; grid[i] = WIRE; owner[i] = 0; life[i] = 0; shade[i] = (R() * 16) | 0; };
    let prev = wy(0);
    for (let x = 0; x < W; x++) { const y = wy(x); wireY[x] = y; for (let yy = Math.min(prev, y); yy <= Math.max(prev, y); yy++) wire(x, yy); prev = y; }
    for (let s = 0; s <= segs; s++) {            // little hooks the wire hangs from
      const hx = Math.min(W - 1, Math.round(s * sw));
      for (let yy = top - 4; yy < top; yy++) wire(hx, yy);
      wire(hx - 1, top - 4); wire(hx + 1, top - 4);
    }
    let k = 0;
    for (let x = 9; x < W - 4; x += 13) {
      const t = (x % sw) / sw; if (t < 0.07 || t > 0.93) continue;
      const y = wy(x) + 1;
      BULB_SHAPE.forEach((row, ry) => [...row].forEach((ch, rx) => {
        if (ch === '.') return;
        const gx = x - 2 + rx, gy = y + ry; if (gx < 0 || gx >= W || gy >= H) return;
        const i = gy * W + gx; grid[i] = BULB; owner[i] = 0; life[i] = k; shade[i] = ch === 'C' ? 0 : ch === 'H' ? 2 : 1;
      }));
      const cx = x, cy = y + 4, hj = [], hf = [];
      for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
        const gx = cx + dx, gy = cy + dy; if (gx < 0 || gx >= W || gy < 0 || gy >= H) continue;
        const d = Math.hypot(dx, dy * 0.85);
        const f = d < 3.5 ? 0.6 : d < 5.5 ? 0.32 : d < 7.5 && ((gx + gy) & 1) ? 0.16 : 0;   // stepped, dithered pixel halo
        if (f) { hj.push(gy * W + gx); hf.push(f); }
      }
      bulbs.push({ k, col: BCOL[k % 5], hj: Int32Array.from(hj), hf: Float32Array.from(hf) });
      if (++k >= 255) break;
    }
  }
  function updateLights() {
    for (let k = 0; k < bulbs.length; k++) {
      bright[k] = lightMode === 0 ? 0.42 + 0.58 * (0.5 + 0.5 * Math.sin(fc * 0.035 + k * 2.39))
                : lightMode === 1 ? (((k + ((fc / 14) | 0)) % 3) === 0 ? 1 : 0.16)
                : 0.93 + 0.07 * R();
    }
  }

  function removeLights() { for (let i = 0; i < N; i++) if (grid[i] === WIRE || grid[i] === BULB) grid[i] = E; bulbs = []; wireY = new Int16Array(W); lightsBottom = 0; }
  function cycleLights() {
    lightMode = lightMode >= LIGHT_MODES.length - 1 ? -1 : lightMode + 1;
    if (lightMode === 0) buildLights(); else if (lightMode === -1) removeLights();
  }

  /* ------------------------------------------------------------------ drawing */
  let cv, ctx, mask, mctx, mimg, mbuf, sharp, sctx, shadeC, shadeX, shadeI, tintC, tintX, tintI, heatC, heatX, heatI;
  let base, bctx, light, lctx, l1, l2, l3, l1c, l2c, l3c, img, buf, limg, lbuf;
  // ---------- render ----------
  const cl = v => v < 0 ? 0 : v > 255 ? 255 : v | 0;
  const rgba = (r, g, b, a) => (cl(a) << 24) | (cl(b) << 16) | (cl(g) << 8) | cl(r);
  const rgb = (r, g, b) => rgba(r, g, b, 255);
  const STOPS = [[0,[70,12,4]],[0.25,[190,40,6]],[0.5,[255,110,18]],[0.75,[255,190,60]],[1,[255,246,205]]];
  const FIREC = new Uint32Array(64);
  for (let n = 0; n < 64; n++) {
    const t = n / 63; let a = STOPS[0], b = STOPS[4];
    for (let s = 0; s < 4; s++) if (t >= STOPS[s][0] && t <= STOPS[s + 1][0]) { a = STOPS[s]; b = STOPS[s + 1]; break; }
    const u = (t - a[0]) / (b[0] - a[0] || 1);
    FIREC[n] = rgb(a[1][0] + (b[1][0] - a[1][0]) * u, a[1][1] + (b[1][1] - a[1][1]) * u, a[1][2] + (b[1][2] - a[1][2]) * u);
  }
  const EMB = [rgb(255, 170, 60), rgb(230, 80, 20), rgb(120, 28, 10)];
  let BGCSS = '#fff', bg = [247, 246, 243], BG = 0;
  const PR = new Float32Array(512), PG = new Float32Array(512), PB = new Float32Array(512);
  const pal = (m, r, g, b, v) => { for (let s = 0; s < 16; s++) { const k = (R() - 0.5) * v; PR[m*16+s] = r + k; PG[m*16+s] = g + k * 0.9; PB[m*16+s] = b + k * 0.8; } };
  pal(SAND, 214, 182, 112, 44); pal(ICE, 168, 214, 240, 22); pal(STONE, 96, 98, 106, 34); pal(ASH, 92, 90, 88, 26); pal(POWDER, 50, 48, 47, 20);

  function render() {
    const relight = (fc & 1) === 0;                // light and shadows are refreshed every other frame
    if (relight) { sweepLight(); emR.fill(0); emG.fill(0); emB.fill(0); opq.fill(0); }
    for (let x = 0; x < W; x++) {
      let depth = 0, liq = 0;
      for (let y = 0; y < H; y++) {
        const i = y * W + x, m = grid[i];
        lbuf[i] = 0; mbuf[i] = 0;
        let r, g, b;
        if (relight && m !== E) {                     // gather opacity and light for the shadow pass
          const lb = (y >> 2) * HW + (x >> 2); opq[lb] += OPQ[m];
          const ek = m * 3;
          if (EMS[ek] > 0) { emR[lb] += EMS[ek]; emG[lb] += EMS[ek + 1]; emB[lb] += EMS[ek + 2]; }
          else if (m === BULB && shade[i]) { const c = bulbs[life[i]].col, br = bright[life[i]] * 0.0003; emR[lb] += c[0] * br; emG[lb] += c[1] * br; emB[lb] += c[2] * br; }
          else if ((m === GLASS || m === SAND) && life[i] > 60) { const h = life[i] * 0.00025; emR[lb] += h; emG[lb] += h * 0.45; emB[lb] += h * 0.1; }
        }
        if (sharpMode && m === PAGE && pristine[i] && life[i] === 0) { buf[i] = 0; mbuf[i] = 0xff000000; depth++; liq = 0; continue; }   // untouched: show the sharp copy
        switch (m) {
          case E: buf[i] = 0; depth = 0; liq = 0; continue;
          case FIRE: {
            const t = life[i] / 30 + (R() - 0.5) * 0.25;
            const c = FIREC[t <= 0 ? 0 : t >= 1 ? 63 : (t * 63) | 0];
            buf[i] = c; lbuf[i] = c; depth = 0; liq = 0; continue;
          }
          case EMBER: { const k = R(), c = EMB[k < 0.35 ? 0 : k < 0.8 ? 1 : 2]; buf[i] = c; lbuf[i] = c; depth++; liq = 0; continue; }
          case STEAM: { buf[i] = rgba(225, 230, 238, (0.12 + Math.min(life[i] / 140, 1) * 0.5) * 255); depth = 0; liq = 0; continue; }
          case SMOKE: { buf[i] = rgba(40, 38, 42, Math.min(life[i] / 120, 1) * 190); depth = 0; liq = 0; continue; }
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
            r = PR[ICE*16+s]; g = PG[ICE*16+s]; b = PB[ICE*16+s];
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
            if (c > 0) {
              // scorch: first browns, then goes black
              const c1 = Math.min(c * 2, 1), c2 = Math.max(c * 2 - 1, 0);
              r += (120 - r) * c1 * 0.7; g += (64 - g) * c1 * 0.7; b += (26 - b) * c1 * 0.7;
              r += (20 - r) * c2; g += (14 - g) * c2; b += (12 - b) * c2;
              if (c > 0.55 && R() < 0.025) { r = 255; g = 120; b = 30; lbuf[i] = rgb(180, 70, 20); }
            }
            depth++; liq = 0; break;
          }
          case WIRE: { const s = shade[i] & 15; r = 26 + s; g = 56 + s; b = 32 + s * 0.5; depth++; liq = 0; break; }
          case BULB: {
            const k = life[i], p = shade[i];
            if (p === 0) { r = 74; g = 84; b = 72; }                 // socket cap
            else {
              const c = bulbs[k].col, br = bright[k], dim = 0.26 + 0.74 * br;
              r = c[0] * dim; g = c[1] * dim; b = c[2] * dim;
              if (p === 2) { r += (255 - r) * 0.7 * br; g += (255 - g) * 0.7 * br; b += (255 - b) * 0.7 * br; }   // glass highlight
              lbuf[i] = rgb(c[0] * br, c[1] * br, c[2] * br);
            }
            depth++; liq = 0; break;
          }
          case GLASS: {
            const s = shade[i] & 15, above = y > 0 ? grid[i - W] : E;
            r = 140 + s; g = 205 + s; b = 195 + s;
            if (above !== GLASS) { r += 50; g += 40; b += 40; }                       // bright rim
            if ((x + y + (shade[i] >> 5)) % 9 === 0) { r += 45; g += 45; b += 45; }  // diagonal reflections
            const h = life[i] / 255;                                                  // still hot from the furnace
            if (h > 0) { r += (255 - r) * h; g += (140 - g) * h; b += (40 - b) * h; lbuf[i] = rgb(230 * h, 100 * h, 25 * h); }
            buf[i] = rgba(r, g, b, 140 + 115 * h);
            depth++; liq = 0; continue;
          }
          case PLANT: {
            const s = shade[i];
            if (s >= 250) { r = 205; g = 22; b = 32; if (y > 0 && grid[i - W] !== PLANT) { r = 255; g = 95; b = 95; } }   // holly berries
            else {
              const v = (s & 15) - 8; r = 20 + v; g = 96 + v * 2; b = 42 + v;
              if ((s & 7) === 0) { r += 40; g += 60; b += 30; }                   // glossy leaf
              if (y > 0 && grid[i - W] === E) g += 18;
            }
            depth++; liq = 0; break;
          }
          case ACID: {
            const d = Math.min(liq, 40) / 40, f = 1 - d * 0.5, sh = Math.sin(x * 0.4 + y * 0.3 + fc * 0.15) * 10;
            r = (90 + sh) * f; g = (225 + sh) * f; b = 60 * f;
            if (liq === 0) { r += 60; g += 30; b += 50; }
            lbuf[i] = rgb(20, 60, 10); liq++; depth++; break;
          }
          case FUME: { buf[i] = rgba(170, 235, 110, Math.min(life[i] / 90, 1) * 140); depth = 0; liq = 0; continue; }
          case BOLT: { buf[i] = rgb(235, 240, 255); lbuf[i] = rgb(190, 205, 255); depth = 0; liq = 0; continue; }
          default: {
            const s = shade[i] & 15;
            r = PR[m*16+s]; g = PG[m*16+s]; b = PB[m*16+s];
            if (m === SAND && life[i] > 60) {        // red-hot sand
              const h = (life[i] - 60) / 195;
              r += (255 - r) * h; g += (110 - g) * h; b += (25 - b) * h;
              lbuf[i] = rgb(210 * h, 80 * h, 18 * h);
            }
            if (m === POWDER && (shade[i] & 31) === 0) { r += 60; g += 55; b += 40; }
            const a = (depth === 0 ? 1.12 : 1) * (1 - Math.min(depth, 26) / 26 * 0.38);
            r *= a; g *= a; b *= a; depth++; liq = 0; break;
          }
        }
        {   // lit by the light that reaches this spot: dim where it's in shadow, coloured where it's lit
          const lb = (y >> 2) * HW + (x >> 2), Lr = inR[lb], Lg = inG[lb], Lb = inB[lb];
          buf[i] = rgb(r * AMBL + (r * 0.55 + 70) * Lr, g * AMBL + (g * 0.55 + 70) * Lg, b * AMBL + (b * 0.55 + 70) * Lb);
        }
      }
    }
    // sparks and rockets
    for (const p of parts) {
      const x = p.x | 0, y = p.y | 0; if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const i = y * W + x, f = Math.max(0.15, p.life / p.max), tw = p.kind === 2 && R() < 0.15 ? 0.3 : 1;
      const c = rgb(p.col[0] * f * tw + 40 * f, p.col[1] * f * tw + 40 * f, p.col[2] * f * tw + 40 * f);
      buf[i] = c; lbuf[i] = c;
      const lb = (y >> 2) * HW + (x >> 2), e = relight ? 0.0012 * f : 0; emR[lb] += p.col[0] * e; emG[lb] += p.col[1] * e; emB[lb] += p.col[2] * e;
      if (p.kind) { const tx = (p.x - p.vx) | 0, ty = (p.y - p.vy) | 0; if (tx >= 0 && tx < W && ty >= 0 && ty < H && grid[ty * W + tx] === E) buf[ty * W + tx] = rgba(p.col[0], p.col[1], p.col[2], 140 * f); }
    }
    // pixel halos around lit bulbs; they also tint any snow, ice or water nearby
    for (const bl of bulbs) {
      const br = bright[bl.k]; if (br < 0.05) continue;
      const cr = bl.col[0], cg = bl.col[1], cb = bl.col[2];
      for (let n = 0; n < bl.hj.length; n++) {
        const j = bl.hj[n], f = bl.hf[n] * br, m = grid[j];
        if (m === BULB || m === WIRE) continue;
        const v = buf[j], a0 = v >>> 24;
        if (m === E) { const a = f * 190; if (a0 < a) buf[j] = rgba(cr, cg, cb, a); }
        else buf[j] = rgba((v & 255) + cr * f * 0.65, ((v >> 8) & 255) + cg * f * 0.65, ((v >> 16) & 255) + cb * f * 0.65, a0);
      }
    }
    bctx.putImageData(img, 0, 0); lctx.putImageData(limg, 0, 0);
    const DW = cv.width, DH = cv.height;
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = BGCSS; ctx.fillRect(0, 0, DW, DH);   // the page's own background under the matter
    ctx.imageSmoothingEnabled = false; ctx.drawImage(base, 0, 0, DW, DH);
    // the sharp page, cut out cell by cell wherever it is still untouched
    mctx.putImageData(mimg, 0, 0);
    sctx.globalCompositeOperation = 'copy'; sctx.imageSmoothingEnabled = false; sctx.drawImage(mask, 0, 0, DW, DH);
    sctx.globalCompositeOperation = 'source-in'; sctx.drawImage(hi, 0, 0);
    if (relight) {   // the same light and shadow, laid over the sharp page
      const sd = new Uint32Array(shadeI.data.buffer), td = new Uint32Array(tintI.data.buffer);
      for (let b = 0; b < HW * HH; b++) {
        const L = Math.max(inR[b], inG[b], inB[b]);
        sd[b] = rgba(0, 0, 0, (1 - AMBL) * (1 - Math.min(1, L * 1.2)) * 255);
        td[b] = L > 0.01 ? rgba(inR[b] / L * 255, inG[b] / L * 255, inB[b] / L * 255, Math.min(0.5, L * 0.4) * 255) : 0;
      }
      shadeX.putImageData(shadeI, 0, 0); tintX.putImageData(tintI, 0, 0);
    }
    sctx.globalCompositeOperation = 'source-atop'; sctx.imageSmoothingEnabled = true;
    sctx.drawImage(shadeC, 0, 0, DW, DH); sctx.drawImage(tintC, 0, 0, DW, DH);
    ctx.drawImage(sharp, 0, 0);
    if (glow > 0) {
      l1c.clearRect(0, 0, l1.width, l1.height); l1c.drawImage(light, 0, 0, l1.width, l1.height);
      l2c.clearRect(0, 0, l2.width, l2.height); l2c.drawImage(l1, 0, 0, l2.width, l2.height);
      l3c.clearRect(0, 0, l3.width, l3.height); l3c.drawImage(l2, 0, 0, l3.width, l3.height);
      ctx.imageSmoothingEnabled = true; ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55 * glow; ctx.drawImage(l1, 0, 0, DW, DH);
      ctx.globalAlpha = 0.8 * glow;  ctx.drawImage(l2, 0, 0, DW, DH);
      ctx.globalAlpha = 1.0 * glow;  ctx.drawImage(l3, 0, 0, DW, DH);
      ctx.globalAlpha = 0.6 * glow;  ctx.drawImage(l3, 0, 0, DW, DH);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    if (heatView) {   // thermal camera: cold is blue, hot goes red, yellow, white
      const hd = new Uint32Array(heatI.data.buffer);
      for (let b = 0; b < HW * HH; b++) {
        const t = T[b];
        if (t < -1) hd[b] = rgba(40, 110, 255, Math.min(1, -t / 12) * 110);
        else if (t > 8) { const f = Math.min(1, (t - 8) / 700); hd[b] = rgba(255, 60 + 195 * Math.min(1, f * 1.6), 40 + 215 * Math.max(0, f * 2 - 1), 70 + 150 * f); }
        else hd[b] = 0;
      }
      heatX.putImageData(heatI, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(heatC, 0, 0, DW, DH);
    }
    if (flash > 0.01) { ctx.fillStyle = `rgba(215,225,255,${flash * 0.55})`; ctx.fillRect(0, 0, DW, DH); flash *= 0.7; }
  }


  /* ------------------------------------------------------------------ tools and painting */
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
  let tool = FIRE, brush = 6;

  function paint(cx, cy) {
    if (tool === FIREWORK || tool === LIGHTNING) return;
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
      if (solid || R() < (tool === SNOW || tool === PLANT ? 0.5 : 0.35)) set(x, y, tool, tool === STEAM ? rr(150, 250) : tool === PLANT ? 24 : 0);
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
      + `<div class="sep"></div><label class="size">Size <input type="range" min="1" max="16" value="${brush}" aria-label="Brush size"></label><label class="size">Wind <input class="wind" type="range" min="-20" max="20" value="${Math.round(windBase * 10)}" aria-label="Wind"></label>`
      + btn('ignite', 'Ignite', '#ff7a1f', 'I', ICONS.ignite) + btn('snowfall', 'Snowfall', '#dfe8f7', 'S', ICONS.snowfall) + btn('storm', 'Storm', '#9fb4ff', 'T', ICONS.storm) + btn('settle', 'Where snow settles', '#dfe8f7', '', ICONS.settle) + btn('lights', 'Lights', '#ffb020', 'L', ICONS.lights) + btn('heat', 'Heat view', '#ff6b3d', 'V', ICONS.heat) + btn('look', 'Look: sharp or pixel', '#fff', 'P', ICONS.look)
      + btn('pause', 'Pause', '#fff', '', ICONS.pause) + btn('reset', 'Rebuild the page', '#fff', '', ICONS.reset) + btn('close', 'Exit (Esc)', '#fff', '', ICONS.close);
    tipEl = document.createElement('div'); tipEl.className = 'tip';
    hud.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return; e.stopPropagation();
      if (b.dataset.mode) { if (b.dataset.mode === 'physics') { stop(); dispatchEvent(new CustomEvent('havoc:mode', { detail: 'physics' })); } return; }
      const id = b.dataset.id;
      if (id[0] === 't') tool = +id.slice(1);
      else if (id === 'ignite') ignite();
      else if (id === 'snowfall') snowing = !snowing;
      else if (id === 'storm') storm = !storm;
      else if (id === 'heat') heatView = !heatView;
      else if (id === 'settle') snowEverywhere = !snowEverywhere;
      else if (id === 'lights') cycleLights();
      else if (id === 'look') sharpMode = !sharpMode;
      else if (id === 'pause') paused = !paused;
      else if (id === 'reset') { stop(); setTimeout(start, 60); return; }
      else if (id === 'close') { stop(); return; }
      syncHud();
    });
    hud.querySelector('.size input').addEventListener('input', e => { brush = +e.target.value; });
    hud.querySelector('input.wind').addEventListener('input', e => { windBase = +e.target.value / 10; });
    hud.addEventListener('pointerover', e => {
      const b = e.target.closest('button'); if (!b || b.dataset.mode) return;
      const t = TOOLS.find(x => 't' + x.id === b.dataset.id);
      const label = t ? `<b>${t.name}</b> · ${t.hint}` : { ignite: '<b>Ignite</b> · set a few things alight', snowfall: '<b>Snowfall</b> · let it snow', storm: '<b>Storm</b> · rain and lightning', heat: '<b>Heat view</b> · see temperature', settle: snowEverywhere ? '<b>Snow</b> · settles everywhere (click: only on the lights)' : '<b>Snow</b> · settles only on the lights (click: everywhere)', lights: '<b>Lights</b> · ' + (lightMode < 0 ? 'hang a string of lights' : lightMode < LIGHT_MODES.length - 1 ? 'switch to ' + LIGHT_MODES[lightMode + 1] : 'take them down'), look: sharpMode ? '<b>Look</b> · switch to all pixels' : '<b>Look</b> · switch to sharp', pause: paused ? 'Play · Space' : 'Pause · Space', reset: 'Rebuild the page and start over', close: 'Exit and restore · Esc' }[b.dataset.id];
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
      b.classList.toggle('on', id === 't' + tool || (id === 'snowfall' && snowing) || (id === 'pause' && paused) || (id === 'lights' && lightMode >= 0) || (id === 'look' && !sharpMode) || (id === 'storm' && storm) || (id === 'heat' && heatView) || (id === 'settle' && !snowEverywhere));
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
    else if (e.key === 'l' || e.key === 'L') cycleLights();
    else if (e.key === 't' || e.key === 'T') storm = !storm;
    else if (e.key === 'v' || e.key === 'V') heatView = !heatView;
    else if (e.key === 'p' || e.key === 'P') sharpMode = !sharpMode;
    else if (e.key === ' ') { e.preventDefault(); paused = !paused; }
    else if (e.key === '[') brush = Math.max(1, brush - 1);
    else if (e.key === ']') brush = Math.min(16, brush + 1);
    syncHud();
  }
  function frame() {
    fc++;
    if (!S.active) return;
    if (down) {
      if (tool === FIREWORK) { if (fc % 12 === 0) launch(px, py); }
      else if (tool === LIGHTNING) { if (fc % 30 === 0) strike(px, py); }
      else paint(px, py);
    }
    if (!paused && !document.hidden) {
      if (snowing) {
        for (let n = 0; n < (snowEverywhere ? 9 : 5); n++) { const x = (R() * W) | 0; if (grid[x] === E && R() < 0.6) set(x, 0, SNOW, 1); }
        if (Math.abs(wind) > 0.4 && snowEverywhere) {   // strong wind blows snow in from the side
          const x = wind > 0 ? 0 : W - 1, y = (R() * H * 0.7) | 0;
          if (grid[y * W + x] === E && R() < Math.abs(wind) * 0.4) set(x, y, SNOW, 1);
        }
      }
      if (storm) {
        for (let n = 0; n < 2; n++) { const x = (R() * W) | 0; if (grid[x] === E && R() < 0.5) set(x, 0, WATER); }
        if (R() < 0.006) strike((R() * W) | 0, rr(60, Math.max(61, H)));
      }
      windStep(); step(); heatStep(); heatEffects(); updateParts(); bodies();
    }
    if (shake > 0.3) { cv.style.transform = `translate(${((R() - 0.5) * shake).toFixed(1)}px,${((R() - 0.5) * shake).toFixed(1)}px)`; shake *= 0.85; }
    else if (cv.style.transform) cv.style.transform = '';
    if (bulbs.length) updateLights();
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
    owner = new Uint16Array(N); colR = new Uint8Array(N); colG = new Uint8Array(N); colB = new Uint8Array(N); pristine = new Uint8Array(N);
    els = [null]; tick = 1; paused = false; snowing = false; lightMode = -1; bulbs = []; wireY = new Int16Array(W);
    // the backdrop: the page's own background colour
    const pick = el => { const c = parseColor(getComputedStyle(el).backgroundColor); return c[3] > 0.5 ? c : null; };
    const under = document.elementFromPoint(innerWidth * 0.6, innerHeight * 0.5);
    let found = null; for (let e = under; e && !found; e = e.parentElement) found = pick(e);
    bg = (found || pick(document.body) || pick(document.documentElement) || [255, 255, 255]).slice(0, 3);
    AMBL = (bg[0] * 0.3 + bg[1] * 0.59 + bg[2] * 0.11) > 128 ? 1 : 0.9;
    BG = rgb(bg[0], bg[1], bg[2]); BGCSS = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
    HW = Math.ceil(W / HB); HH = Math.ceil(H / HB); const HN = HW * HH;
    T = new Float32Array(HN).fill(-3); T2 = new Float32Array(HN);
    emR = new Float32Array(HN); emG = new Float32Array(HN); emB = new Float32Array(HN); opq = new Float32Array(HN); trn = new Float32Array(HN);
    inR = new Float32Array(HN); inG = new Float32Array(HN); inB = new Float32Array(HN);
    outR = new Float32Array(HN); outG = new Float32Array(HN); outB = new Float32Array(HN);
    parts = []; flash = 0; shake = 0; storm = false; heatView = false;

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
    shadeC = mk(HW, HH); shadeX = shadeC.getContext('2d'); shadeI = shadeX.createImageData(HW, HH);
    tintC = mk(HW, HH); tintX = tintC.getContext('2d'); tintI = tintX.createImageData(HW, HH);
    heatC = mk(HW, HH); heatX = heatC.getContext('2d'); heatI = heatX.createImageData(HW, HH);
    mask = mk(W, H); mctx = mask.getContext('2d'); mimg = mctx.createImageData(W, H); mbuf = new Uint32Array(mimg.data.buffer);
    sharp = mk(W * CELL * DPR, H * CELL * DPR); sctx = sharp.getContext('2d');
    cv = document.createElement('canvas'); cv.className = 'sim'; cv.width = W * CELL * DPR; cv.height = H * CELL * DPR;
    cv.style.width = W * CELL + 'px'; cv.style.height = H * CELL + 'px'; ctx = cv.getContext('2d');
    root.insertBefore(cv, root.firstChild.nextSibling);
    cv.addEventListener('pointerdown', e => { down = true; cv.setPointerCapture(e.pointerId); [px, py] = toGrid(e); if (tool === FIREWORK) launch(px, py); else if (tool === LIGHTNING) strike(px, py); else paint(px, py); });
    cv.addEventListener('pointermove', e => { if (!down) return; const [x, y] = toGrid(e); if (tool !== FIREWORK && tool !== LIGHTNING) line(px, py, x, y); px = x; py = y; });
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
    grid = life = shade = stamp = owner = colR = colG = colB = pristine = null; els = []; hi = hx = null; bulbs = [];
  }
  S.start = start; S.stop = stop;
  S._debug = { get grid() { return grid; }, get els() { return els; }, get W() { return W; }, get H() { return H; }, ignite, PAGE, FIRE };
  start();
})();
