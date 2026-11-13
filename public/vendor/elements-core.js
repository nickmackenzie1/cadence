/* Elements engine core — Nick's engine (Ember & Frost, v5), kept as close to his file as possible so new versions drop in.
   It runs in a Web Worker when this file is loaded as one, or on the page (window.ElementsENGINE) as a fallback.
   It only talks through messages: init, opt, frame, save, stats, count. Cadence additions are marked "Cadence". */
function ENGINE(env) {
  'use strict';
  const E=0, SAND=1, WATER=2, ICE=3, FIRE=4, WOOD=5, STEAM=6, STONE=7, OIL=8, LAVA=9, EMBER=10, ASH=11, SMOKE=12, SNOW=13,
        PAGE=14, GLASS=15, WIRE=16, BULB=17, PLANT=18, ACID=19, FUME=20, POWDER=21, BOLT=22, SURF=23;   // SURF: Cadence, invisible ledge
  const FIREWORK=30, LIGHTNING=31;
  const fluid = new Uint8Array(32), gas = new Uint8Array(32), dens = new Uint8Array(32);
  fluid[WATER]=fluid[OIL]=fluid[LAVA]=fluid[ACID]=1; gas[STEAM]=gas[FIRE]=gas[SMOKE]=gas[FUME]=1;
  dens[OIL]=1; dens[WATER]=2; dens[ACID]=2; dens[LAVA]=3; dens[SAND]=4; dens[ASH]=4; dens[POWDER]=4; dens[SNOW]=1;
  const R = Math.random, rr = (a, b) => a + ((R() * (b - a)) | 0);
  const N8 = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
  const UP5 = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0]];
  // Cadence adds: lights (hang them or not), palette, compact (a slim string for the ambient layer), rain (drops per frame), floor (false: things fall out of the window)
  const opts = { snowing: false, storm: false, windBase: 0.3, lightMode: 0, heatView: false, snowEverywhere: false, sharp: true, paused: false, reduced: false, lights: true, palette: 'classic', compact: false, rain: 0, floor: true };

  let W = 0, H = 0, N = 0, gen = 0;
  let grid, life, shade, stamp, owner, colR, colG, colB, pristine, layer, boxOf, initGrid;
  let els = [null], boxCol = [], boxGone = new Uint8Array(0), bodyBg = [12, 17, 28];
  const HB = 4; let HW = 0, HH = 0, T, T2;
  let spR, spG, spB, emR, emG, emB, opq, trn, inR, inG, inB, outR, outG, outB;
  const CS = 5, CSZ = 32; let CW = 0, CH = 0, awake, awakeNext;
  let depthA, liqA, depthB, liqB, rendered, mark, hole;
  let tick = 1, fc = 0, wind = 0, gust = 0, gustT = 0, gustTarget = 0;
  let parts = [], sprites = [], flash = 0, shake = 0, events = [], view = { top: 0, viewH: 400 }, fireCount = 0;
  let buf, lbuf, ovb, heatb, solid;
  let stepMs = 0, renderMs = 0;
  const AMBL = 0.9;

  // ---------- helpers ----------
  function wakeAt(i) {
    const y = (i / W) | 0, cx = (i - y * W) >> CS, cy = y >> CS;
    for (let dy = -1; dy <= 1; dy++) {
      const yy = cy + dy; if (yy < 0 || yy >= CH) continue;
      const row = yy * CW;
      for (let dx = -1; dx <= 1; dx++) { const c = cx + dx; if (c >= 0 && c < CW) { awake[row + c] = 1; awakeNext[row + c] = 1; } }
    }
  }
  function set(x, y, m, l) {
    const i = y * W + x;
    const o = owner[i];
    if (o) { const e = els[o]; if (e) e.lost++; owner[i] = 0; }
    grid[i] = m; life[i] = l || 0; shade[i] = (R() * 256) | 0; stamp[i] = tick; pristine[i] = 0;
    wakeAt(i);
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
    pristine[i] = pristine[j] = 0;
    wakeAt(i);
  }
  function randN(x, y) {
    const d = N8[(R() * 8) | 0], nx = x + d[0], ny = y + d[1];
    if (nx < 0 || nx >= W || ny < 0 || ny >= H) return -1;
    return ny * W + nx;
  }
  const char = (j, amt) => { life[j] = Math.min(255, life[j] + amt); };
  // temperature read smoothly between the 4×4 heat squares
  function tAt(x, y) {
    const fx = x / HB - 0.5, fy = y / HB - 0.5;
    let x0 = Math.floor(fx), y0 = Math.floor(fy);
    const ux = Math.min(1, Math.max(0, fx - x0)), uy = Math.min(1, Math.max(0, fy - y0));
    x0 = x0 < 0 ? 0 : x0 >= HW ? HW - 1 : x0; y0 = y0 < 0 ? 0 : y0 >= HH ? HH - 1 : y0;
    const x1 = x0 + 1 < HW ? x0 + 1 : x0, y1 = y0 + 1 < HH ? y0 + 1 : y0;
    return (T[y0 * HW + x0] * (1 - ux) + T[y0 * HW + x1] * ux) * (1 - uy) + (T[y1 * HW + x0] * (1 - ux) + T[y1 * HW + x1] * ux) * uy;
  }
  const heatTo = (x, y, target, rate) => { const b = (y >> 2) * HW + (x >> 2); T[b] += (target - T[b]) * rate; };
  const windSide = () => R() < 0.5 + Math.max(-0.42, Math.min(0.42, wind * 0.3)) ? 1 : -1;

  function heat(j, t, k) {
    if (t === POWDER) { explode(j % W, (j / W) | 0, 4); return; }
    if (t === PLANT) { if (R() < 0.08 * k) setI(j, EMBER, rr(25, 60)); return; }
    const c = life[j] / 255;
    if (t === PAGE) { if (R() < (0.012 + c * 0.14) * k) setI(j, EMBER, rr(40, 110)); else char(j, 4 * k); }
    else { if (R() < (0.006 + c * 0.06) * k) setI(j, EMBER, rr(140, 250)); else char(j, 2 * k); }
  }
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

  // ---------- one simulation step ----------
  const KEEP = new Uint8Array(32);
  KEEP[FIRE] = KEEP[EMBER] = KEEP[STEAM] = KEEP[SMOKE] = KEEP[FUME] = KEEP[BOLT] = KEEP[LAVA] = KEEP[BULB] = KEEP[PLANT] = KEEP[ACID] = 1;
  function step() {
    tick = (tick % 255) + 1;
    const ltr = tick & 1;
    fireCount = 0;
    for (let y = H - 1; y >= 0; y--) {
      const rowC = (y >> CS) * CW;
      for (let kc = 0; kc < CW; kc++) {
        const cx = ltr ? kc : CW - 1 - kc, ci = rowC + cx;
        if (!awake[ci]) continue;
        const x0 = cx << CS, x1 = Math.min(W, x0 + CSZ);
        for (let kk = x0; kk < x1; kk++) {
          const x = ltr ? kk : x1 - 1 - (kk - x0), i = y * W + x, m = grid[i];
          if (m === E || m === STONE || m === WOOD || m === PAGE || m === WIRE || m === SURF || stamp[i] === tick) continue;
          if (KEEP[m] || (life[i] && (m === SAND || m === GLASS))) {
            awakeNext[ci] = 1; if (cx > 0) awakeNext[ci - 1] = 1; if (cx < CW - 1) awakeNext[ci + 1] = 1; if (ci >= CW) awakeNext[ci - CW] = 1;
          }
          switch (m) {
            case SAND: {
              if (tAt(x, y) > 900 && R() < 0.02) { set(x, y, GLASS, 255); break; }
              if (life[i] > 60) heatTo(x, y, 150 + life[i] * 2, 0.01);
              if (life[i]) {
                life[i] = life[i] > 2 ? life[i] - 2 : 0;
                if (life[i] > 110) { const j = randN(x, y); if (j >= 0 && grid[j] === SAND) melt(j, life[i] >> 4); }
              }
              powder(i, x, y, m); break;
            }
            case ASH: powder(i, x, y, m); break;
            case WATER: {
              const t = tAt(x, y);
              if (t > 100 && R() < 0.06) { set(x, y, STEAM, rr(120, 220)); heatTo(x, y, t - 60, 0.2); break; }
              if (t > 30) heatTo(x, y, 20, 0.004);
              if (t < -3 && R() < 0.01) { const j = randN(x, y); if (j >= 0 && (grid[j] === ICE || grid[j] === SNOW)) { set(x, y, ICE); break; } }
              if (y > 0 && grid[i - W] === E && R() < 0.0004) { grid[i] = E; break; }
              if (opts.snowing && y > 0 && y < H - 1 && grid[i + W] === E && R() < 0.15 && hangsFromLights(x, y)) { set(x, y, ICE); break; }
              liquid(i, x, y, m, 5); break;
            }
            case BULB: {
              const br = bulbs[life[i]] ? bulbs[life[i]].br : 0;
              if (br > 0.4) heatTo(x, y, 34, 0.0006);
              if (br > 0.4 && R() < 0.02) { const j = randN(x, y); if (j >= 0 && grid[j] === SNOW && R() < 0.25) setI(j, WATER); }
              break;
            }
            case OIL: liquid(i, x, y, m, 3); break;
            case GLASS: {
              if (life[i]) {
                heatTo(x, y, 100 + life[i] * 2, 0.01);
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
              { const t = tAt(x, y); if (t > 2 && R() < (t - 2) * 0.0004) { set(x, y, WATER); break; } }
              if (y > 2 && grid[i - W] === SNOW && grid[i - 2 * W] === SNOW && grid[i - 3 * W] === SNOW && R() < 0.00025) { set(x, y, ICE); break; }
              if (R() < 0.45) break;
              if (life[i] === 1 && y + 1 < H && (grid[i + W] === WIRE || grid[i + W] === BULB) && R() < (opts.snowEverywhere ? 0.85 : 0.35)) {
                let moved = false;
                for (let k = 2; k < 14 && y + k < H; k++) { const jj = i + k * W, t = grid[jj]; if (t === E) { swap(i, jj); moved = true; break; } if (t !== WIRE && t !== BULB) break; }
                if (moved) break;
              }
              const d = windSide();
              if (Math.abs(wind) > 0.15 && R() < Math.abs(wind) * 0.3) {
                const nx = x + (wind > 0 ? 1 : -1);
                if (nx >= 0 && nx < W && grid[y * W + nx] === E) { swap(i, y * W + nx); break; }
              }
              if (R() < 0.35 && fall(i, m, x + d, y + 1)) break;
              if (fall(i, m, x, y + 1)) break;
              if (R() < 0.25 && fall(i, m, x + d, y + 1)) break;
              if (life[i] === 1 && !opts.snowEverywhere && y > lightsBottom) { grid[i] = E; break; }
              const wy = wireY[x];
              if (wy > 0 && y < wy && wy - y > (opts.snowEverywhere ? 9 : 5) && R() < 0.15) grid[i] = E;
              break;
            }
            case ICE: {
              { const t = tAt(x, y); if (t > 6 && R() < (t - 6) * 0.0002) { set(x, y, WATER); break; } }
              const j = randN(x, y);
              if (j >= 0 && grid[j] === WATER && R() < 0.004) setI(j, ICE);
              break;
            }
            case FIRE: {
              fireCount++;
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
              fireCount++;
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
              if (tAt(x, y) < 15 && life[i] > 2) life[i]--;
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
              const j = randN(x, y); if (j < 0) break;
              const t = grid[j];
              if (t === WATER) { setI(j, E); life[i] = Math.min(80, life[i] + 14); }
              else if (t === SNOW && R() < 0.3) { setI(j, E); life[i] = Math.min(80, life[i] + 6); }
              else if (t === PLANT) { const a = (life[i] + life[j]) >> 1; life[j] = life[i] + life[j] - a; life[i] = a; }
              else if (t === E && life[i] >= 2 && R() < 0.08 && canHold(j)) {
                const give = (life[i] - 1) >> 1; life[i] -= give + 1;
                setI(j, PLANT, give); if (R() < 0.05) shade[j] = 255;
              }
              break;
            }
            case ACID: {
              const j = randN(x, y);
              if (j >= 0) {
                const t = grid[j];
                const eats = t === PAGE || t === WOOD || t === PLANT || t === SNOW || t === ICE || t === ASH || t === POWDER || (t === SAND && R() < 0.3) || (t === STONE && R() < 0.12);
                if (eats && R() < 0.3) { setI(j, R() < 0.5 ? FUME : E, rr(40, 90)); if (R() < 0.3) { set(x, y, FUME, rr(40, 90)); break; } }
                else if (t === WATER && R() < 0.004) { set(x, y, WATER); break; }
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
    const t = awake; awake = awakeNext; awakeNext = t; awakeNext.fill(0);
  }

  function canHold(j) {
    const x = j % W, y = (j / W) | 0;
    for (let n = 0; n < 8; n++) {
      const nx = x + N8[n][0], ny = y + N8[n][1];
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const t = grid[ny * W + nx];
      if (t === PAGE || t === WIRE || t === BULB || t === STONE || t === WOOD || t === GLASS || t === ICE) return true;
    }
    return y + 1 < H && grid[j + W] === PLANT && R() < 0.2;
  }

  // ---------- explosions, fireworks, lightning ----------
  function explode(cx, cy, r) {
    shake = Math.min(14, shake + r * 1.2); flash = Math.max(flash, 0.12);
    events.push(['explode', r]);
    const cells = [];
    for (let dy = -r - 3; dy <= r + 3; dy++) for (let dx = -r - 3; dx <= r + 3; dx++) {
      const x = cx + dx, y = cy + dy; if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const d = Math.hypot(dx, dy); if (d <= r + 3) cells.push([d, x, y, dx, dy]);
    }
    cells.sort((a, b) => b[0] - a[0]);
    for (const [d, x, y, dx, dy] of cells) {
      const i = y * W + x, m = grid[i];
      if (m === WIRE || m === BULB || m === SURF) continue;
      if (d <= r) {
        if (m === POWDER) set(x, y, FIRE, rr(10, 30));
        else if (m === E) { if (d < r * 0.75 && R() < 0.7) set(x, y, FIRE, rr(6, 22)); }
        else if (m === PAGE || m === WOOD || m === PLANT) { if (R() < 0.4) set(x, y, R() < 0.5 ? EMBER : E, rr(30, 80)); else { char(i, 120); pristine[i] = 0; wakeAt(i); } }
        else if (m === SNOW || m === ICE) set(x, y, R() < 0.5 ? STEAM : WATER, rr(60, 140));
        else if (m === WATER || m === ACID) set(x, y, STEAM, rr(80, 160));
        else if (m === GLASS && R() < 0.5) set(x, y, SAND);
        else if (m === STONE && d < r * 0.6 && R() < 0.3) set(x, y, SAND);
      }
      const g2 = grid[i];
      if (g2 === SAND || g2 === ASH || g2 === SNOW || g2 === WATER || g2 === ACID || g2 === OIL || g2 === POWDER) {
        const k = (r + 4 - d) / (d || 1), tx = Math.round(x + dx * k), ty = Math.round(y + dy * k - 1);
        if (tx >= 0 && tx < W && ty >= 0 && ty < H && grid[ty * W + tx] === E) swap(i, ty * W + tx);
      }
    }
    for (let dy = -r; dy <= r; dy += 4) for (let dx = -r; dx <= r; dx += 4) { const x = cx + dx, y = cy + dy; if (x >= 0 && x < W && y >= 0 && y < H) heatTo(x, y, 1200, 0.6); }
    for (let n = 0; n < 10; n++) spark(cx, cy, (R() - 0.5) * 4, -R() * 3.5, [255, 170 + R() * 60, 60], rr(15, 35));
  }
  const FW_COLS = [[255, 70, 60], [80, 255, 120], [90, 150, 255], [255, 210, 70], [255, 110, 230], [240, 245, 255]];
  function spark(x, y, vx, vy, col, lf, kind = 0) { if (parts.length < 2500) { const p = { x, y, vx, vy, col, life: lf, max: lf, kind }; parts.push(p); return p; } return null; }
  function launch(x, y) {
    const p = spark(x, y, (R() - 0.5) * 0.6, -3.2 - R() * 1.2, FW_COLS[(R() * FW_COLS.length) | 0], rr(28, 50), 1);
    if (p) { p.c2 = FW_COLS[(R() * FW_COLS.length) | 0]; events.push(['launch']); }
  }
  function burst(p) {
    const n = rr(70, 110), ring = R() < 0.4;
    for (let k = 0; k < n; k++) {
      const a = R() * Math.PI * 2, sp = ring ? 2.3 + R() * 0.3 : 0.5 + R() * 2.2;
      spark(p.x, p.y, Math.cos(a) * sp, Math.sin(a) * sp - 0.4, R() < 0.5 ? p.col : p.c2, rr(40, 80), 2);
    }
    flash = Math.max(flash, 0.08); heatTo(p.x | 0, p.y | 0, 320, 0.3);
    events.push(['burst']);
  }
  function updateParts() {
    const out = [];
    for (let n = 0; n < parts.length; n++) {
      const p = parts[n];
      p.life--;
      if (p.kind === 1) { spark(p.x, p.y + 1, (R() - 0.5) * 0.4, 0.3 + R() * 0.5, [255, 190, 90], rr(6, 14)); p.vx += wind * 0.01; }
      else { p.vy += p.kind === 2 ? 0.03 : 0.05; p.vx *= 0.985; p.vy *= 0.985; p.vx += wind * 0.004; }
      const nx = p.x + p.vx, ny = p.y + p.vy, x = nx | 0, y = ny | 0;
      if (nx < 0 || x >= W || ny < 0 || y >= H) continue;
      const i = y * W + x, m = grid[i];
      if (m !== E && !gas[m]) {
        if (p.kind === 1) { burst(p); continue; }
        if (m === SNOW && R() < 0.5) set(x, y, WATER);
        else if (m === WATER && R() < 0.2) set(x, y, STEAM, rr(60, 120));
        else if (m === PAGE || m === WOOD) { char(i, p.kind === 2 ? 4 : 12); pristine[i] = 0; wakeAt(i); if (R() < (p.kind === 2 ? 0.003 : 0.006)) set(x, y, EMBER, rr(30, 70)); }
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
  function strike(tx, ty) {
    const top = view.top;
    let x = Math.max(0, Math.min(W - 1, tx + rr(-30, 31))), y = top, hit = -1, dir = 0, seg = 0;
    const path = [], forks = [];
    while (y < H) {
      const i = y * W + x, m = grid[i];
      const passes = m === WIRE || m === BULB || y < ty || (y <= lightsBottom && (m === SNOW || m === ICE || m === WATER));
      if (m !== E && !gas[m] && !passes) { hit = i; break; }
      if (m === E || gas[m]) path.push(i);
      if (--seg <= 0) { seg = rr(2, 7); dir = Math.max(-2, Math.min(2, rr(-2, 3) + (y < ty ? Math.sign(tx - x) : 0))); }
      for (let k = 1; k <= Math.abs(dir); k++) {
        const sx = x + Math.sign(dir) * k; if (sx >= 0 && sx < W && (grid[y * W + sx] === E || gas[grid[y * W + sx]])) path.push(y * W + sx);
      }
      x = Math.max(0, Math.min(W - 1, x + dir)); y++;
      if (R() < 0.035 && path.length > 8) forks.push([x, y, dir || (R() < 0.5 ? -1 : 1)]);
    }
    for (const i of path) {
      if (grid[i] === E || gas[grid[i]]) set(i % W, (i / W) | 0, BOLT, rr(6, 12));
      const j = i + 1; if (R() < 0.5 && j % W && (grid[j] === E || gas[grid[j]])) set(j % W, (j / W) | 0, BOLT, rr(3, 8));
    }
    for (let [fx, fy, fd] of forks) {
      const len = rr(10, 35);
      for (let k = 0; k < len; k++) { fx += fd + rr(-1, 2); fy++; if (fx < 0 || fx >= W || fy >= H || grid[fy * W + fx] !== E) break; set(fx, fy, BOLT, rr(3, 7)); }
    }
    if (hit >= 0) {
      const hx = hit % W, hy = (hit / W) | 0;
      if (grid[hit] === SAND) {
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
        else if (t === PAGE || t === WOOD || t === PLANT) { if (R() < 0.5) set(x2, y2, EMBER, rr(40, 100)); else { char(j, 160); pristine[j] = 0; wakeAt(j); } }
        else if (t === WATER || t === ACID) set(x2, y2, STEAM, rr(100, 200));
        else if (t === SNOW || t === ICE) set(x2, y2, R() < 0.5 ? STEAM : WATER, rr(80, 160));
        else if (t === POWDER) explode(x2, y2, 5);
        else if (t === E && R() < 0.3) set(x2, y2, FIRE, rr(5, 15));
      }
      for (let k = 0; k < 14; k++) spark(hx, hy - 1, (R() - 0.5) * 3, -R() * 3, [220, 230, 255], rr(8, 20));
    }
    // the light string flickers: hard near the strike, briefly everywhere
    for (const b of bulbs) b.flick = Math.max(b.flick, Math.abs(b.x - tx) < 160 ? rr(14, 32) : rr(2, 7));
    flash = 1; shake = Math.max(shake, 5);
    events.push(['strike', tx]);
  }

  // ---------- temperature and wind ----------
  function heatStep() {
    const amb = opts.snowing ? -8 : -3;
    for (let by = 0; by < HH; by++) for (let bx = 0; bx < HW; bx++) {
      const i = by * HW + bx, c = T[i];
      const l = bx > 0 ? T[i - 1] : c, rt = bx < HW - 1 ? T[i + 1] : c, u = by > 0 ? T[i - HW] : c, d = by < HH - 1 ? T[i + HW] : c;
      const v = c + ((l + rt) * 0.25 + u * 0.18 + d * 0.32 - c) * 0.22;
      T2[i] = v + (amb - v) * 0.008;
    }
    const t = T; T = T2; T2 = t;
  }
  function heatEffects() {
    for (let b = 0; b < HW * HH; b++) {
      const t = T[b];
      if (t > 2) { const c = (((b / HW) | 0) >> 3) * CW + ((b % HW) >> 3); awake[c] = 1; }
      if (t < 160) continue;
      const bx = (b % HW) * HB, by = ((b / HW) | 0) * HB;
      for (let k = 0; k < 2; k++) {
        const x = bx + ((R() * HB) | 0), y = by + ((R() * HB) | 0); if (x >= W || y >= H) continue;
        const i = y * W + x, m = grid[i];
        if (m === PAGE || m === WOOD) {
          if (R() < (t - 160) / 400) { char(i, 1 + (((t - 160) * 0.02) | 0)); pristine[i] = 0; wakeAt(i); }
          if (t > (m === PAGE ? 330 : 380) && R() < 0.01) set(x, y, EMBER, m === PAGE ? rr(40, 110) : rr(140, 250));
        } else if (m === PLANT && t > 220 && R() < 0.05) set(x, y, EMBER, rr(20, 50));
      }
    }
  }
  function windStep() {
    if (--gustT <= 0) { gustT = rr(90, 420); gustTarget = (R() * 2 - 1) * (0.2 + Math.abs(opts.windBase) * 0.7) * (R() < 0.25 ? 2 : 1); }
    gust += (gustTarget - gust) * 0.01; wind = opts.windBase + gust;
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
      outR[i] = Math.min(2, emR[i] + spR[i]); outG[i] = Math.min(2, emG[i] + spG[i]); outB[i] = Math.min(2, emB[i] + spB[i]);
    }
    const D1 = 0.86, D2 = 0.81;
    const pull = (i, a, d) => {
      let v = outR[a] * d; if (v > inR[i]) inR[i] = v;
      v = outG[a] * d; if (v > inG[i]) inG[i] = v;
      v = outB[a] * d; if (v > inB[i]) inB[i] = v;
    };
    const pass = i => { const t = trn[i]; let v = inR[i] * t; if (v > outR[i]) outR[i] = v; v = inG[i] * t; if (v > outG[i]) outG[i] = v; v = inB[i] * t; if (v > outB[i]) outB[i] = v; };
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

  // ---------- Christmas lights: indestructible, they sway, flicker and sag ----------
  const BULB_SHAPE = ['.CCC.', '.CCC.', '.BBB.', 'BHBBB', 'BBBBB', 'BBBBB', '.BBB.', '..B..'];
  const PALETTES = { classic: [[255, 48, 40], [40, 225, 80], [60, 120, 255], [255, 175, 30], [255, 80, 205]], warm: [[255, 214, 150], [255, 200, 120], [255, 226, 170]], candy: [[255, 40, 50], [255, 245, 240]] };
  let BCOL = PALETTES.classic;
  const HALO = [];
  for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
    const d = Math.hypot(dx, dy * 0.85);
    if (d < 3.5) HALO.push([dx, dy, 0.6, 0]); else if (d < 5.5) HALO.push([dx, dy, 0.32, 0]); else if (d < 7.5) HALO.push([dx, dy, 0.16, 1]);
  }
  let TOP = 7, SAG = 16;
  let bulbs = [], wireY = new Int16Array(0), wireCells = [], segN = 2, segW = 1, sagExtra = new Float32Array(2), lightsBottom = 0;
  const canLight = i => { const t = grid[i]; return t === E || t === WIRE || t === SURF || gas[t] || t === SNOW || t === WATER || t === ICE; };
  function wireYAt(x) {
    const s = Math.min(segN - 1, Math.max(0, (x / segW) | 0)), t = (x - s * segW) / segW;
    return Math.round(TOP + (SAG + sagExtra[s]) * 4 * t * (1 - t));
  }
  function placeWire() {
    for (const i of wireCells) if (grid[i] === WIRE) { grid[i] = E; wakeAt(i); }
    wireCells = [];
    const put = (x, y) => { if (x < 0 || x >= W || y < 0 || y >= H) return; const i = y * W + x; if (!canLight(i)) return; grid[i] = WIRE; owner[i] = 0; life[i] = 0; pristine[i] = 0; shade[i] = (R() * 16) | 0; wireCells.push(i); wakeAt(i); };
    let prev = wireYAt(0);
    for (let x = 0; x < W; x++) { const y = wireYAt(x); wireY[x] = y; for (let yy = Math.min(prev, y); yy <= Math.max(prev, y); yy++) put(x, yy); prev = y; }
    for (let s = 0; s <= segN; s++) {
      const hx = Math.min(W - 1, Math.round(s * segW));
      for (let yy = TOP - 4; yy < TOP; yy++) put(hx, yy);
      put(hx - 1, TOP - 4); put(hx + 1, TOP - 4);
    }
  }
  function placeBulb(b) {
    for (const i of b.cells) if (grid[i] === BULB && life[i] === b.k) { grid[i] = E; wakeAt(i); }
    b.cells = [];
    const y = wireYAt(b.x) + 1;
    BULB_SHAPE.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) {
      const ch = row[rx]; if (ch === '.') continue;
      const gx = (ry < 2 ? b.x : b.x + b.ox) - 2 + rx, gy = y + ry;
      if (gx < 0 || gx >= W || gy < 0 || gy >= H) continue;
      const i = gy * W + gx; if (!canLight(i) && grid[i] !== BULB) continue;
      grid[i] = BULB; owner[i] = 0; life[i] = b.k; pristine[i] = 0; shade[i] = ch === 'C' ? 0 : ch === 'H' ? 2 : 1; b.cells.push(i); wakeAt(i);
    } });
    b.cx = b.x + b.ox; b.cy = y + 4;
  }
  function removeLights() {
    for (const i of wireCells) if (grid[i] === WIRE) { grid[i] = E; wakeAt(i); }
    for (const b of bulbs) for (const i of b.cells) if (grid[i] === BULB) { grid[i] = E; wakeAt(i); }
    wireCells = []; bulbs = []; wireY = new Int16Array(W); lightsBottom = 0;
  }
  function buildLights() {
    if (!opts.lights) return;
    BCOL = PALETTES[opts.palette] || PALETTES.classic;
    if (opts.compact) { TOP = 4; SAG = 8; } else { TOP = 7; SAG = 16; }
    segN = Math.max(2, Math.round(W / 120)); segW = W / segN; sagExtra = new Float32Array(segN);
    lightsBottom = TOP + SAG + 6 + 12;
    wireY = new Int16Array(W); wireCells = [];
    placeWire();
    bulbs = [];
    let k = 0;
    for (let x = 9; x < W - 4 && k < 255; x += 13) {
      const t = (x % segW) / segW; if (t < 0.07 || t > 0.93) continue;
      const b = { k, x, ox: 0, cells: [], col: BCOL[k % BCOL.length], br: 0, flick: 0, cx: x, cy: 0 };
      bulbs.push(b); placeBulb(b); k++;
    }
  }
  function updateBulbs() {
    const lm = opts.lightMode;
    for (const b of bulbs) {
      let v = lm === 0 ? 0.42 + 0.58 * (0.5 + 0.5 * Math.sin(fc * 0.035 + b.k * 2.39))
            : lm === 1 ? (((b.k + ((fc / 14) | 0)) % 3) === 0 ? 1 : 0.16)
            : lm === 2 ? 0.93 + 0.07 * R() : 0;
      if (b.flick > 0) { b.flick--; if (lm !== 3) v = R() < 0.5 ? 0.05 : 1; }
      b.br = v;
    }
  }
  function lightsReact() {
    // sway: bulbs swing up to 2 cells with the wind
    if (fc % 6 === 0) for (const b of bulbs) {
      const o = opts.reduced ? 0 : Math.max(-2, Math.min(2, Math.round(wind * 1.1 + Math.sin(fc * 0.06 + b.k) * Math.min(1, Math.abs(wind)) * 0.7)));
      if (o !== b.ox) { b.ox = o; placeBulb(b); }
    }
    // sag: heavy snow on a stretch of wire pulls it down a few cells
    if (fc % 30 === 0) {
      let changed = false;
      for (let s = 0; s < segN; s++) {
        let n = 0; const xa = Math.round(s * segW), xb = Math.min(W, Math.round((s + 1) * segW));
        for (let x = xa; x < xb; x++) { const wy = wireY[x]; for (let y = Math.max(0, wy - 8); y < wy; y++) if (grid[y * W + x] === SNOW) n++; }
        const want = Math.min(5, Math.floor(n / 70));
        if (Math.abs(want - sagExtra[s]) >= 1) { sagExtra[s] = want; changed = true; }
      }
      if (changed) { placeWire(); for (const b of bulbs) placeBulb(b); }
    }
  }
  function hangsFromLights(x, y) {
    for (let k = 1; k <= 5; k++) {
      if (y - k < 0) return false;
      const t = grid[(y - k) * W + x];
      if (t === WIRE || t === BULB) return true;
      if (t !== ICE) return false;
    }
    return false;
  }

  // ---------- page pieces: break loose, tumble, bounce, crack, and settle ----------
  function checkReleases() {
    for (let id = 1; id < els.length; id++) {
      const e = els[id]; if (!e || e.total === 0) continue;
      if (e.lost > e.total * e.thresh) { release(id); continue; }
      // a big piece (image, card) that has been cut in two: the smaller part breaks off and falls
      if (e.total > 1500 && e.lost !== e.checked && fc - (e.checkedAt || 0) > 8) { e.checked = e.lost; e.checkedAt = fc; splitOff(id); }
    }
  }
  function splitOff(id) {
    const e = els[id];
    const cells = e.cells.filter(c => owner[c] === id); e.cells = cells;
    if (cells.length < 2) return;
    for (const c of cells) mark[c] = 1;
    const comps = [];
    for (const c0 of cells) {
      if (mark[c0] !== 1) continue;
      const comp = [c0]; mark[c0] = 2;
      for (let q = 0; q < comp.length; q++) {
        const c = comp[q], x = c % W;
        if (x > 0 && mark[c - 1] === 1) { mark[c - 1] = 2; comp.push(c - 1); }
        if (x < W - 1 && mark[c + 1] === 1) { mark[c + 1] = 2; comp.push(c + 1); }
        if (c >= W && mark[c - W] === 1) { mark[c - W] = 2; comp.push(c - W); }
        if (c + W < N && mark[c + W] === 1) { mark[c + W] = 2; comp.push(c + W); }
      }
      comps.push(comp);
    }
    for (const c of cells) mark[c] = 0;
    if (comps.length < 2) return;
    comps.sort((a, b) => b.length - a.length);
    e.cells = comps[0];
    for (let k = 1; k < comps.length; k++) {
      const comp = comps[k];
      if (e.isBox) {   // the part of a card that breaks off takes the words sitting on it, and leaves the page background behind
        let x0 = W, x1 = 0, y0 = H, y1 = 0;
        for (const c of comp) { const x = c % W, y = (c / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x; if (boxOf[i] === id && layer[i] === 2) hole[i] = 1; }
        for (const cid of e.children) {
          const ch = els[cid]; if (!ch) continue;
          const keep = [];
          for (const c of ch.cells) {
            if (owner[c] !== cid) continue;
            const x = c % W, y = (c / W) | 0;
            if (x >= x0 && x <= x1 && y >= y0 && y <= y1) { owner[c] = 0; comp.push(c); } else keep.push(c);
          }
          ch.cells = keep;
        }
      }
      for (const c of comp) owner[c] = 0;
      makeSprite(comp, 0);
      events.push(['crack']);
    }
  }
  function release(id) {
    const e = els[id]; if (!e) return;
    for (const cid of e.children) {
      const c = els[cid]; if (!c) continue;
      for (const k of c.cells) if (owner[k] === cid) { owner[k] = id; e.cells.push(k); }
      els[cid] = null; boxGone[cid] = 1;
    }
    const cells = e.cells.filter(c => owner[c] === id);
    els[id] = null; boxGone[id] = 1;
    if (cells.length) makeSprite(cells, 0);
  }
  function makeSprite(cells, depth) {
    let sx = 0, sy = 0;
    for (const i of cells) { sx += i % W; sy += (i / W) | 0; }
    const n = cells.length, cx = sx / n, cy = sy / n;
    const s = { x: cx, y: cy, vx: (R() - 0.5) * 0.3, vy: 0, a: 0, va: n < 25000 ? (R() - 0.5) * 0.012 : 0, n, depth, bounces: 0,
      dx: new Float32Array(n), dy: new Float32Array(n), cr: new Uint8Array(n), cg: new Uint8Array(n), cb: new Uint8Array(n), cl: new Uint8Array(n), cm: new Uint8Array(n), edge: null, maxR: 0 };
    const seen = new Set(cells);
    const edge = [];
    for (let k = 0; k < n; k++) {
      const i = cells[k], x = i % W, y = (i / W) | 0;
      s.dx[k] = x - cx; s.dy[k] = y - cy; s.cr[k] = colR[i]; s.cg[k] = colG[i]; s.cb[k] = colB[i]; s.cl[k] = life[i]; s.cm[k] = grid[i];
      s.maxR = Math.max(s.maxR, Math.hypot(s.dx[k], s.dy[k]));
      if (!seen.has(i - 1) || !seen.has(i + 1) || !seen.has(i - W) || !seen.has(i + W)) edge.push(k);
      grid[i] = E; owner[i] = 0; pristine[i] = 0; life[i] = 0; wakeAt(i);
    }
    s.edge = Int32Array.from(edge);
    sprites.push(s);
    return s;
  }
  function spriteHits(s, x, y, a) {
    const c = Math.cos(a), sn = Math.sin(a), list = s.edge;
    for (let q = 0; q < list.length; q++) {
      const k = list[q];
      const px = Math.round(x + c * s.dx[k] - sn * s.dy[k]), py = Math.round(y + sn * s.dx[k] + c * s.dy[k]);
      if (py >= H || px < 0 || px >= W) return true;
      if (py < 0) continue;
      const t = grid[py * W + px];
      if (t !== E && !gas[t] && !fluid[t]) return true;
    }
    return false;
  }
  function updateSprites() {
    const next = [];
    for (const s of sprites) {
      s.vy = Math.min(s.vy + 0.18, 6); s.vx *= 0.995;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(s.vy), Math.abs(s.vx), Math.abs(s.va) * s.maxR)));
      let alive = true;
      for (let st = 0; st < steps; st++) {
        const nx = s.x + s.vx / steps, ny = s.y + s.vy / steps;
        let na = s.a + s.va / steps;
        if (Math.abs(na) > 0.35) { na = Math.sign(na) * 0.35; s.va = 0; }
        if (spriteHits(s, nx, ny, na)) {
          const impact = s.vy;
          if (impact > 2.6 && s.n > 80 && s.depth < 2 && crack(s, impact, next)) { alive = false; break; }
          if (impact > 1.1 && s.bounces < 2) {
            s.vy = -impact * 0.3; s.vx += (R() - 0.5) * 0.6; if (s.n < 25000) s.va += (R() - 0.5) * 0.02; s.bounces++;
            crumble(s, 0.01);
          } else { settle(s); alive = false; }
          break;
        }
        s.x = nx; s.y = ny; s.a = na;
      }
      if (alive) next.push(s);
    }
    sprites = next;
  }
  function worldOf(s, k) {
    const c = Math.cos(s.a), sn = Math.sin(s.a);
    return [s.x + c * s.dx[k] - sn * s.dy[k], s.y + sn * s.dx[k] + c * s.dy[k]];
  }
  function crumble(s, frac) {   // a few crumbs break off the edges as it hits
    for (let q = 0; q < s.edge.length; q++) {
      if (R() > frac) continue;
      const [wx, wy] = worldOf(s, s.edge[q]), x = Math.round(wx), y = Math.round(wy) - 1;
      if (x >= 0 && x < W && y >= 0 && y < H && grid[y * W + x] === E) set(x, y, ASH);
    }
  }
  function crack(s, impact, out) {
    const th = R() * Math.PI, nx = Math.cos(th), ny = Math.sin(th), off = (R() - 0.5) * s.maxR * 0.4;
    const A = [], B = [];
    for (let k = 0; k < s.n; k++) (s.dx[k] * nx + s.dy[k] * ny > off ? A : B).push(k);
    if (A.length < 12 || B.length < 12) return false;
    crumble(s, 0.05);
    for (const [grp, sign] of [[A, 1], [B, -1]]) {
      const m = grp.length; let sx = 0, sy = 0;
      const wxs = new Float32Array(m), wys = new Float32Array(m);
      for (let q = 0; q < m; q++) { const [wx, wy] = worldOf(s, grp[q]); wxs[q] = wx; wys[q] = wy; sx += wx; sy += wy; }
      const cx = sx / m, cy = sy / m;
      const p = { x: cx, y: cy - 0.5, vx: s.vx + sign * nx * (0.4 + R() * 0.4), vy: -impact * 0.25, a: 0, va: m < 25000 ? sign * (0.01 + R() * 0.015) : 0, n: m, depth: s.depth + 1, bounces: 0,
        dx: new Float32Array(m), dy: new Float32Array(m), cr: new Uint8Array(m), cg: new Uint8Array(m), cb: new Uint8Array(m), cl: new Uint8Array(m), cm: new Uint8Array(m), edge: null, maxR: 0 };
      const key = new Set(); const pos = [];
      for (let q = 0; q < m; q++) {
        const k = grp[q];
        p.dx[q] = wxs[q] - cx; p.dy[q] = wys[q] - cy; p.cr[q] = s.cr[k]; p.cg[q] = s.cg[k]; p.cb[q] = s.cb[k]; p.cl[q] = s.cl[k]; p.cm[q] = s.cm[k];
        p.maxR = Math.max(p.maxR, Math.hypot(p.dx[q], p.dy[q]));
        const kx = Math.round(p.dx[q]), ky = Math.round(p.dy[q]); pos.push([kx, ky]); key.add(kx + ',' + ky);
      }
      const edge = [];
      for (let q = 0; q < m; q++) { const [kx, ky] = pos[q]; if (!key.has((kx - 1) + ',' + ky) || !key.has((kx + 1) + ',' + ky) || !key.has(kx + ',' + (ky - 1)) || !key.has(kx + ',' + (ky + 1))) edge.push(q); }
      p.edge = Int32Array.from(edge);
      out.push(p);
    }
    events.push(['crack']);
    return true;
  }
  function settle(s) {   // turn back into page cells where it landed; a new piece that can break loose again
    const c = Math.cos(s.a), sn = Math.sin(s.a);
    els.push({ cells: [], total: 0, lost: 0, children: [], thresh: 0.35, isBox: false });
    const id = els.length - 1;
    const e = els[id];
    for (let k = 0; k < s.n; k++) {
      const x = Math.round(s.x + c * s.dx[k] - sn * s.dy[k]), y = Math.round(s.y + sn * s.dx[k] + c * s.dy[k]);
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const i = y * W + x, t = grid[i];
      if (t !== E && !gas[t] && !fluid[t]) continue;
      grid[i] = s.cm[k]; life[i] = s.cl[k]; colR[i] = s.cr[k]; colG[i] = s.cg[k]; colB[i] = s.cb[k]; shade[i] = (R() * 256) | 0;
      owner[i] = id < 65536 ? id : 0; pristine[i] = 0; stamp[i] = tick; wakeAt(i);
      if (owner[i]) e.cells.push(i);
    }
    e.total = e.cells.length;
    if (e.total === 0 || id >= 65536) els[id] = null;
    events.push(['land', s.n]);
  }

  // ---------- painting and input ----------
  function paint(cx, cy, tool, brush) {
    if (tool < 0 || tool === FIREWORK || tool === LIGHTNING) return;
    const r = brush;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const x = cx + dx, y = cy + dy;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const i = y * W + x, cur = grid[i];
      if (cur === WIRE || cur === BULB || cur === SURF) continue;
      if (tool === E) { if (cur !== E) set(x, y, E); continue; }
      if (tool === FIRE) {
        if (cur === WOOD || cur === PAGE) { if (R() < 0.5) set(x, y, EMBER, cur === PAGE ? rr(40, 110) : rr(140, 250)); }
        else if (cur === OIL) set(x, y, FIRE, rr(30, 60));
        else if (cur === E && R() < 0.3) set(x, y, FIRE, rr(20, 45));
        continue;
      }
      if (cur !== E) continue;
      const solidT = tool === WOOD || tool === STONE || tool === ICE;
      if (solidT || R() < (tool === SNOW || tool === PLANT ? 0.5 : 0.35)) set(x, y, tool, tool === STEAM ? rr(150, 250) : tool === PLANT ? 24 : 0);
    }
  }
  function line(x0, y0, x1, y1, tool, brush) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= steps; s++) paint(Math.round(x0 + (x1 - x0) * s / steps), Math.round(y0 + (y1 - y0) * s / steps), tool, brush);
  }
  function ignite() {
    const top = view.top, bot = top + view.viewH, cands = [];
    for (let id = 1; id < els.length; id++) {
      const e = els[id]; if (!e || !e.cells.length) continue;
      const y = (e.cells[0] / W) | 0; if (y > top && y < bot && owner[e.cells[0]] === id) cands.push(id);
    }
    for (let n = 0; n < 4 && cands.length; n++) {
      const e = els[cands.splice((R() * cands.length) | 0, 1)[0]];
      for (let k = 0; k < Math.min(6, e.cells.length); k++) { const c = e.cells[(R() * Math.min(40, e.cells.length)) | 0]; if (grid[c] === PAGE) setI(c, EMBER, rr(60, 120)); }
    }
  }
  function landSnow(x, y) {
    if (x < 0 || x >= W) return;
    for (let k = 0; k < 6; k++) {
      const yy = y - k; if (yy < 0 || yy >= H) break;
      const t = grid[yy * W + x];
      if (t === E) { set(x, yy, SNOW, 1); return; }
      if (t !== SNOW) return;
    }
  }
  function handleInput(ev) {
    switch (ev[0]) {
      case 'paint': line(ev[1], ev[2], ev[3], ev[4], ev[5], ev[6]); break;
      case 'launch': launch(ev[1], ev[2]); break;
      case 'strike': strike(ev[1], ev[2]); break;
      case 'ignite': ignite(); break;
      case 'snow': for (let k = 1; k < ev.length; k += 2) landSnow(ev[k], ev[k + 1]); break;
      // Cadence: drop matter at a cell ([x, y, material, radius, chance, lifeLo, lifeHi])
      case 'spawn': {
        const [, cx, cy, m, r, chance, lo, hi] = ev;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue; const x = cx + dx, y = cy + dy;
          if (x < 0 || x >= W || y < 0 || y >= H || grid[y * W + x] !== E || R() > chance) continue;
          set(x, y, m, m === FIRE || m === EMBER || m === STEAM || m === SMOKE ? rr(lo, hi) : 0);
        }
        break;
      }
      case 'heat': { const [, x, y, t, rad] = ev; for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) { const xx = x + dx * HB, yy = y + dy * HB; if (xx >= 0 && xx < W && yy >= 0 && yy < H) { heatTo(xx, yy, t, 0.5); wakeAt(yy * W + xx); } } break; }
      case 'explode': explode(ev[1], ev[2], ev[3]); break;
      // the page's ledges moved: [x0, x1, y, x0, x1, y, …]; what rested on a ledge that's gone falls
      case 'surf': {
        for (let i = 0; i < N; i++) if (grid[i] === SURF) { grid[i] = E; wakeAt(i); }
        for (let k = 1; k + 2 < ev.length; k += 3) { const x0 = ev[k], x1 = ev[k + 1], y = ev[k + 2]; if (y < 1 || y >= H) continue; for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) { const i = y * W + x; if (grid[i] === E) { grid[i] = SURF; wakeAt(i); } } }
        break;
      }
      // a glass jar, open at the top: [x0, y0, x1, y1]
      case 'jar': { const [, x0, y0, x1, y1] = ev; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { if (x < 0 || x >= W || y < 0 || y >= H) continue; if (x <= x0 + 1 || x >= x1 - 1 || y >= y1 - 1) { const i = y * W + x; grid[i] = GLASS; life[i] = 0; shade[i] = (R() * 16) | 0; owner[i] = 0; pristine[i] = 0; wakeAt(i); } } break; }
      case 'clear': { const m = ev[1]; for (let i = 0; i < N; i++) { const g = grid[i]; if (g !== SURF && g !== WIRE && g !== BULB && (m < 0 || g === m)) { grid[i] = E; wakeAt(i); } } parts = []; break; }
      case 'clearAt': { const [, cx, cy, r] = ev; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (dx * dx + dy * dy > r * r) continue; const x = cx + dx, y = cy + dy; if (x < 0 || x >= W || y < 0 || y >= H) continue; const i = y * W + x, g = grid[i]; if (g !== SURF && g !== WIRE && g !== BULB && g !== E) { grid[i] = E; wakeAt(i); } } break; }
    }
  }

  // ---------- rendering into the shared buffers ----------
  const cl = v => v < 0 ? 0 : v > 255 ? 255 : v | 0;
  const rgba = (r, g, b, a) => (cl(a) << 24) | (cl(b) << 16) | (cl(g) << 8) | cl(r);
  const rgb = (r, g, b) => rgba(r, g, b, 255);
  const LB = c => c & 0x00ffffff;   // emissive colour without the mask bit
  const STOPS = [[0,[70,12,4]],[0.25,[190,40,6]],[0.5,[255,110,18]],[0.75,[255,190,60]],[1,[255,246,205]]];
  const FIREC = new Uint32Array(64);
  for (let n = 0; n < 64; n++) {
    const t = n / 63; let a = STOPS[0], b = STOPS[4];
    for (let s = 0; s < 4; s++) if (t >= STOPS[s][0] && t <= STOPS[s + 1][0]) { a = STOPS[s]; b = STOPS[s + 1]; break; }
    const u = (t - a[0]) / (b[0] - a[0] || 1);
    FIREC[n] = rgb(a[1][0] + (b[1][0] - a[1][0]) * u, a[1][1] + (b[1][1] - a[1][1]) * u, a[1][2] + (b[1][2] - a[1][2]) * u);
  }
  const EMB = [rgb(255, 170, 60), rgb(230, 80, 20), rgb(120, 28, 10)];
  const PR = new Float32Array(512), PG = new Float32Array(512), PB = new Float32Array(512);
  const pal = (m, r, g, b, v) => { for (let s = 0; s < 16; s++) { const k = (R() - 0.5) * v; PR[m*16+s] = r + k; PG[m*16+s] = g + k * 0.9; PB[m*16+s] = b + k * 0.8; } };
  pal(SAND, 214, 182, 112, 44); pal(ICE, 168, 214, 240, 22); pal(STONE, 96, 98, 106, 34); pal(ASH, 92, 90, 88, 26); pal(POWDER, 50, 48, 47, 20);
  let SR = 0, SG = 0, SB = 0;   // scorch() result, kept in variables to avoid making garbage per cell
  function scorch(r, g, b, lf) {
    const c = lf / 255;
    if (c > 0) {
      const c1 = Math.min(c * 2, 1), c2 = Math.max(c * 2 - 1, 0);
      r += (120 - r) * c1 * 0.7; g += (64 - g) * c1 * 0.7; b += (26 - b) * c1 * 0.7;
      r += (20 - r) * c2; g += (14 - g) * c2; b += (12 - b) * c2;
    }
    SR = r; SG = g; SB = b;
  }
  // a see-through colour over the page's cover colour (or over nothing, if nothing needs covering)
  function over(r, g, b, a, cr, cg, cb) { return cr >= 0 ? rgb(cr + (r - cr) * a, cg + (g - cg) * a, cb + (b - cb) * a) : rgba(r, g, b, a * 255); }

  function render() {
    const relight = (fc & 1) === 0;
    if (relight) { sweepLight(); spR.fill(0); spG.fill(0); spB.fill(0); }
    for (let c = 0; c < CW * CH; c++) rendered[c] = awake[c] || ((c + fc) & 3) === 0 ? 1 : 0;
    depthA.fill(0); liqA.fill(0);
    const sharp = opts.sharp, bgR = bodyBg[0], bgG = bodyBg[1], bgB = bodyBg[2];
    for (let y = 0; y < H; y++) {
      const cy = y >> CS, rowC = cy * CW, first = (y & (CSZ - 1)) === 0, last = (y & (CSZ - 1)) === CSZ - 1 || y === H - 1;
      for (let cx = 0; cx < CW; cx++) {
        const ci = rowC + cx, x0 = cx << CS, x1 = Math.min(W, x0 + CSZ);
        if (!rendered[ci]) {
          if (last) for (let x = x0; x < x1; x++) { depthA[x] = depthB[cy * W + x]; liqA[x] = liqB[cy * W + x]; }
          continue;
        }
        if (first) {
          const yb = Math.min(H, y + CSZ) - 1;
          for (let by = y >> 2; by <= yb >> 2; by++) for (let bx = x0 >> 2; bx <= (x1 - 1) >> 2; bx++) { const b = by * HW + bx; emR[b] = emG[b] = emB[b] = opq[b] = 0; }
        }
        for (let x = x0; x < x1; x++) {
          const i = y * W + x, m = grid[i];
          let depth = depthA[x], liq = liqA[x];
          solid[i] = m === WIRE || m === BULB ? 2 : (m !== E && !gas[m] && m !== BOLT) ? 1 : 0;
          do {
            lbuf[i] = 0;
            if (m !== E) {
              const lb = (y >> 2) * HW + (x >> 2); opq[lb] += OPQ[m];
              const ek = m * 3;
              if (EMS[ek] > 0) { emR[lb] += EMS[ek]; emG[lb] += EMS[ek + 1]; emB[lb] += EMS[ek + 2]; }
              else if (m === BULB && shade[i]) { const bl = bulbs[life[i]]; if (bl) { const c = bl.col, br = bl.br * 0.0003; emR[lb] += c[0] * br; emG[lb] += c[1] * br; emB[lb] += c[2] * br; } }
              else if ((m === GLASS || m === SAND) && life[i] > 60) { const h = life[i] * 0.00025; emR[lb] += h; emG[lb] += h * 0.45; emB[lb] += h * 0.1; }
            }
            // what the real page underneath should look like here if its own content has gone
            const Ly = layer[i];
            let cr = -1, cg = 0, cb = 0;
            if (Ly) {
              if (m === PAGE && pristine[i] && life[i] === 0 && sharp) { buf[i] = 0; lbuf[i] = 0xff000000; depth++; liq = 0; continue; }   // untouched: the real page shows
              if (Ly === 2 && !boxGone[boxOf[i]] && !hole[i]) { const c = boxCol[boxOf[i]]; cr = c[0]; cg = c[1]; cb = c[2]; } else { cr = bgR; cg = bgG; cb = bgB; }
            }
            let r, g, b;
            switch (m) {
              case E: case SURF: buf[i] = cr >= 0 ? rgb(cr, cg, cb) : 0; depth = 0; liq = 0; continue;
              case FIRE: {
                const t = life[i] / 30 + (R() - 0.5) * 0.25;
                const c = FIREC[t <= 0 ? 0 : t >= 1 ? 63 : (t * 63) | 0];
                buf[i] = c; lbuf[i] = LB(c); depth = 0; liq = 0; continue;
              }
              case BOLT: { buf[i] = rgb(235, 240, 255); lbuf[i] = LB(rgb(190, 205, 255)); depth = 0; liq = 0; continue; }
              case EMBER: { const k = R(), c = EMB[k < 0.35 ? 0 : k < 0.8 ? 1 : 2]; buf[i] = c; lbuf[i] = LB(c); depth++; liq = 0; continue; }
              case STEAM: { buf[i] = over(225, 230, 238, 0.12 + Math.min(life[i] / 140, 1) * 0.5, cr, cg, cb); depth = 0; liq = 0; continue; }
              case SMOKE: { buf[i] = over(40, 38, 42, Math.min(life[i] / 120, 1) * 0.75, cr, cg, cb); depth = 0; liq = 0; continue; }
              case FUME: { buf[i] = over(170, 235, 110, Math.min(life[i] / 90, 1) * 0.55, cr, cg, cb); depth = 0; liq = 0; continue; }
              case LAVA: {
                const s = shade[i], w = 0.72 + 0.28 * Math.sin(s * 0.09 + fc * 0.05 + x * 0.12 + y * 0.07);
                r = 255 * w; g = (55 + (s & 63)) * w * w; b = 12;
                if (liq === 0) { r *= 0.75; g *= 0.5; }
                buf[i] = rgb(r, g, b); lbuf[i] = LB(rgb(r * 0.75, g * 0.6, b)); liq++; depth++; continue;
              }
              case GLASS: {
                const s = shade[i] & 15, above = y > 0 ? grid[i - W] : E;
                r = 140 + s; g = 205 + s; b = 195 + s;
                if (above !== GLASS) { r += 50; g += 40; b += 40; }
                if ((x + y + (shade[i] >> 5)) % 9 === 0) { r += 45; g += 45; b += 45; }
                const h = life[i] / 255;
                if (h > 0) { r += (255 - r) * h; g += (140 - g) * h; b += (40 - b) * h; lbuf[i] = LB(rgb(230 * h, 100 * h, 25 * h)); }
                buf[i] = over(r, g, b, (140 + 115 * h) / 255, cr, cg, cb);
                depth++; liq = 0; continue;
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
              case ACID: {
                const d = Math.min(liq, 40) / 40, f = 1 - d * 0.5, sh = Math.sin(x * 0.4 + y * 0.3 + fc * 0.15) * 10;
                r = (90 + sh) * f; g = (225 + sh) * f; b = 60 * f;
                if (liq === 0) { r += 60; g += 30; b += 50; }
                lbuf[i] = LB(rgb(20, 60, 10)); liq++; depth++; break;
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
                scorch(r, g, b, life[i]); r = SR; g = SG; b = SB;
                if (life[i] > 140 && R() < 0.025) { r = 255; g = 120; b = 30; lbuf[i] = LB(rgb(180, 70, 20)); }
                depth++; liq = 0; break;
              }
              case WIRE: { const s = shade[i] & 15; r = 26 + s; g = 56 + s; b = 32 + s * 0.5; depth++; liq = 0; break; }
              case BULB: {
                const bl = bulbs[life[i]], p = shade[i];
                if (p === 0 || !bl) { r = 74; g = 84; b = 72; }
                else {
                  const c = bl.col, br = bl.br, dim = 0.26 + 0.74 * br;
                  r = c[0] * dim; g = c[1] * dim; b = c[2] * dim;
                  if (p === 2) { r += (255 - r) * 0.7 * br; g += (255 - g) * 0.7 * br; b += (255 - b) * 0.7 * br; }
                  buf[i] = rgb(r, g, b); lbuf[i] = LB(rgb(c[0] * br, c[1] * br, c[2] * br)); depth++; liq = 0; continue;
                }
                depth++; liq = 0; break;
              }
              case PLANT: {
                const s = shade[i];
                if (s >= 250) { r = 205; g = 22; b = 32; if (y > 0 && grid[i - W] !== PLANT) { r = 255; g = 95; b = 95; } }
                else {
                  const v = (s & 15) - 8; r = 20 + v; g = 96 + v * 2; b = 42 + v;
                  if ((s & 7) === 0) { r += 40; g += 60; b += 30; }
                  if (y > 0 && grid[i - W] === E) g += 18;
                }
                depth++; liq = 0; break;
              }
              default: {
                const s = shade[i] & 15;
                r = PR[m*16+s]; g = PG[m*16+s]; b = PB[m*16+s];
                if (m === SAND && life[i] > 60) {
                  const h = (life[i] - 60) / 195;
                  r += (255 - r) * h; g += (110 - g) * h; b += (25 - b) * h;
                  lbuf[i] = LB(rgb(210 * h, 80 * h, 18 * h));
                }
                if (m === POWDER && (shade[i] & 31) === 0) { r += 60; g += 55; b += 40; }
                const a = (depth === 0 ? 1.12 : 1) * (1 - Math.min(depth, 26) / 26 * 0.38);
                r *= a; g *= a; b *= a; depth++; liq = 0; break;
              }
            }
            const lb = (y >> 2) * HW + (x >> 2), Lr = inR[lb], Lg = inG[lb], Lbb = inB[lb];
            buf[i] = rgb(r * AMBL + (r * 0.55 + 70) * Lr, g * AMBL + (g * 0.55 + 70) * Lg, b * AMBL + (b * 0.55 + 70) * Lbb);
          } while (false);
          depthA[x] = depth; liqA[x] = liq;
          if (last) { depthB[cy * W + x] = depth; liqB[cy * W + x] = liq; }
        }
      }
    }
    const markDrawn = (x, y) => { awake[(y >> CS) * CW + (x >> CS)] = 1; };   // so next frame redraws and erases it
    // falling pieces
    for (const s of sprites) {
      const c = Math.cos(s.a), sn = Math.sin(s.a), rot = s.a !== 0;
      for (let k = 0; k < s.n; k++) {
        scorch(s.cr[k], s.cg[k], s.cb[k], s.cl[k]);
        const col = rgb(SR * AMBL, SG * AMBL, SB * AMBL);
        for (let q = 0; q < (rot ? 2 : 1); q++) {
          const ddx = s.dx[k] + q * 0.5, ddy = s.dy[k] + q * 0.5;
          const x = Math.round(s.x + c * ddx - sn * ddy), y = Math.round(s.y + sn * ddx + c * ddy);
          if (x < 0 || x >= W || y < 0 || y >= H) continue;
          const i = y * W + x; buf[i] = col; lbuf[i] = 0; markDrawn(x, y);
        }
      }
    }
    // sparks and rockets
    for (const p of parts) {
      const x = p.x | 0, y = p.y | 0; if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const i = y * W + x, f = Math.max(0.15, p.life / p.max), tw = p.kind === 2 && R() < 0.15 ? 0.3 : 1;
      const c = rgb(p.col[0] * f * tw + 40 * f, p.col[1] * f * tw + 40 * f, p.col[2] * f * tw + 40 * f);
      buf[i] = c; lbuf[i] = LB(c); markDrawn(x, y);
      const lb = (y >> 2) * HW + (x >> 2), e = 0.0012 * f; spR[lb] += p.col[0] * e; spG[lb] += p.col[1] * e; spB[lb] += p.col[2] * e;
      if (p.kind) { const tx = (p.x - p.vx) | 0, ty = (p.y - p.vy) | 0; if (tx >= 0 && tx < W && ty >= 0 && ty < H && grid[ty * W + tx] === E && !layer[ty * W + tx]) buf[ty * W + tx] = rgba(p.col[0], p.col[1], p.col[2], 140 * f); }
    }
    // pixel halos around lit bulbs
    for (const bl of bulbs) {
      const br = bl.br; if (br < 0.05) continue;
      const cr = bl.col[0], cg = bl.col[1], cb = bl.col[2];
      for (const [dx, dy, f0, dith] of HALO) {
        const x = bl.cx + dx, y = bl.cy + dy; if (x < 0 || x >= W || y < 0 || y >= H) continue;
        if (dith && ((x + y) & 1)) continue;
        if (!rendered[(y >> CS) * CW + (x >> CS)]) continue;
        const j = y * W + x, m = grid[j];
        if (m === BULB || m === WIRE) continue;
        if (m === PAGE && pristine[j] && opts.sharp) continue;
        const f = f0 * br, v = buf[j], a0 = v >>> 24;
        if (a0 === 0 || (m === E && !layer[j])) { const a = f * 190; if (a0 < a) buf[j] = rgba(cr, cg, cb, a); }
        else buf[j] = rgba((v & 255) + cr * f * 0.65, ((v >> 8) & 255) + cg * f * 0.65, ((v >> 16) & 255) + cb * f * 0.65, a0);
      }
    }
    // light and shadow laid over the real page (one colour + alpha per 4×4 square)
    if (relight) for (let b = 0; b < HW * HH; b++) {
      const L = Math.max(inR[b], inG[b], inB[b]);
      const sa = (1 - AMBL) * (1 - Math.min(1, L * 1.2)), ta = L > 0.01 ? Math.min(0.5, L * 0.4) : 0;
      const A = 1 - (1 - sa) * (1 - ta);
      if (A < 0.004) { ovb[b] = 0; continue; }
      const k = ta / A;
      ovb[b] = ta > 0 ? rgba(inR[b] / L * 255 * k, inG[b] / L * 255 * k, inB[b] / L * 255 * k, A * 255) : rgba(0, 0, 0, A * 255);
    }
    if (opts.heatView) for (let b = 0; b < HW * HH; b++) {
      const t = T[b];
      if (t < -1) heatb[b] = rgba(40, 110, 255, Math.min(1, -t / 12) * 110);
      else if (t > 8) { const f = Math.min(1, (t - 8) / 700); heatb[b] = rgba(255, 60 + 195 * Math.min(1, f * 1.6), 40 + 215 * Math.max(0, f * 2 - 1), 70 + 150 * f); }
      else heatb[b] = 0;
    }
  }

  // ---------- setup, resize remap, save and restore ----------
  function init(msg) {
    const old = msg.remap && grid ? { W, H, grid, life, shade, colR, colG, colB, pristine, owner } : null;
    gen = msg.gen; W = msg.W; H = msg.H; N = W * H;
    grid = msg.grid; colR = msg.colR; colG = msg.colG; colB = msg.colB; owner = msg.owner; layer = msg.layer; boxOf = msg.boxOf;
    boxCol = msg.boxCol; bodyBg = msg.bodyBg;
    life = new Uint8Array(N); shade = new Uint8Array(N); stamp = new Uint8Array(N); pristine = new Uint8Array(N);
    for (let i = 0; i < N; i++) { shade[i] = (R() * 256) | 0; if (grid[i] === PAGE) pristine[i] = 1; }
    initGrid = grid.slice();
    els = [null];
    for (const e of msg.els) els.push({ cells: [], total: 0, lost: 0, children: e.children, thresh: e.thresh, isBox: e.isBox });
    for (let i = 0; i < N; i++) { const o = owner[i]; if (o && els[o]) els[o].cells.push(i); }
    for (let id = 1; id < els.length; id++) els[id].total = els[id].cells.length;
    boxGone = new Uint8Array(els.length + 1);
    HW = Math.ceil(W / HB); HH = Math.ceil(H / HB); const HN = HW * HH;
    T = new Float32Array(HN).fill(-3); T2 = new Float32Array(HN);
    spR = new Float32Array(HN); spG = new Float32Array(HN); spB = new Float32Array(HN);
    emR = new Float32Array(HN); emG = new Float32Array(HN); emB = new Float32Array(HN); opq = new Float32Array(HN); trn = new Float32Array(HN);
    inR = new Float32Array(HN); inG = new Float32Array(HN); inB = new Float32Array(HN);
    outR = new Float32Array(HN); outG = new Float32Array(HN); outB = new Float32Array(HN);
    CW = Math.ceil(W / CSZ); CH = Math.ceil(H / CSZ);
    awake = new Uint8Array(CW * CH).fill(1); awakeNext = new Uint8Array(CW * CH).fill(1);
    depthA = new Int16Array(W); liqA = new Int16Array(W); depthB = new Int16Array(CH * W); liqB = new Int16Array(CH * W); rendered = new Uint8Array(CW * CH);
    mark = new Uint8Array(N); hole = new Uint8Array(N);
    parts = []; sprites = []; flash = 0; shake = 0;
    if (old) remap(old, msg.map);
    else if (msg.saved) applySave(msg.saved);
    for (let id = 1; id < els.length; id++) {   // count what each piece has already lost
      const e = els[id]; if (!e) continue;
      e.cells = e.cells.filter(c => owner[c] === id); e.lost = e.total - e.cells.length;
    }
    wireY = new Int16Array(W);
    buildLights();
    awake.fill(1); awakeNext.fill(1);
  }
  function remap(o, map) {
    const LOOSE = new Uint8Array(32);
    for (const m of [SNOW, WATER, ICE, SAND, GLASS, PLANT, ASH, OIL, STONE, WOOD, POWDER, ACID, LAVA, STEAM, SMOKE]) LOOSE[m] = 1;
    if (map.same) {
      // same layout, only shifted sideways: carry everything over exactly, page damage included
      const mapX = x => x < map.oL ? Math.round(x * map.nL / Math.max(1, map.oL))
                      : x < map.oR ? x - map.oL + map.nL
                      : map.nR + Math.round((x - map.oR) * (W - map.nR) / Math.max(1, o.W - map.oR));
      for (let y = 0; y < Math.min(H, o.H); y++) for (let x = 0; x < o.W; x++) {
        const oi = y * o.W + x, om = o.grid[oi];
        const nx = mapX(x); if (nx < 0 || nx >= W) continue;
        const i = y * W + nx;
        if (om === WIRE || om === BULB) { if (grid[i] !== PAGE) grid[i] = E; continue; }
        grid[i] = om; life[i] = o.life[oi]; shade[i] = o.shade[oi]; colR[i] = o.colR[oi]; colG[i] = o.colG[oi]; colB[i] = o.colB[oi];
        pristine[i] = o.pristine[oi];
        owner[i] = om === PAGE && o.pristine[oi] ? o.owner[oi] : 0;
      }
    } else {
      // the page reflowed: keep the loose material (snow, water, glass…) in the same relative place
      for (let y = 0; y < o.H; y++) for (let x = 0; x < o.W; x++) {
        const oi = y * o.W + x, om = o.grid[oi]; if (!LOOSE[om]) continue;
        const nx = Math.round(x * (W - 1) / Math.max(1, o.W - 1)), ny = Math.round(y * (H - 1) / Math.max(1, o.H - 1));
        const i = ny * W + nx; if (grid[i] !== E) continue;
        grid[i] = om; life[i] = o.life[oi]; shade[i] = o.shade[oi];
      }
    }
  }
  function encodeSave() {
    const idx = [];
    for (let i = 0; i < N; i++) {
      const m = grid[i];
      if (m === WIRE || m === BULB || gas[m] || m === BOLT) { if (initGrid[i] === PAGE) idx.push(i); continue; }
      if (m !== initGrid[i] || life[i] !== 0 || (m === PAGE && !pristine[i])) idx.push(i);
    }
    const ab = new ArrayBuffer(8 + idx.length * 9), dv = new DataView(ab);
    dv.setUint32(0, 0x45465331); dv.setUint32(4, idx.length);
    let p = 8;
    for (const i of idx) {
      let m = grid[i]; if (m === WIRE || m === BULB || gas[m] || m === BOLT) m = E;
      dv.setUint32(p, i); dv.setUint8(p + 4, m); dv.setUint8(p + 5, m === E ? 0 : life[i]); dv.setUint8(p + 6, colR[i]); dv.setUint8(p + 7, colG[i]); dv.setUint8(p + 8, colB[i]); p += 9;
    }
    return ab;
  }
  function applySave(ab) {
    try {
      const dv = new DataView(ab);
      if (dv.getUint32(0) !== 0x45465331) return;
      const n = dv.getUint32(4); let p = 8;
      for (let k = 0; k < n && p + 9 <= ab.byteLength; k++, p += 9) {
        const i = dv.getUint32(p); if (i >= N) continue;
        const m = dv.getUint8(p + 4); if (m >= 32 || m === WIRE || m === BULB) continue;
        grid[i] = m; life[i] = dv.getUint8(p + 5); colR[i] = dv.getUint8(p + 6); colG[i] = dv.getUint8(p + 7); colB[i] = dv.getUint8(p + 8);
        pristine[i] = 0; owner[i] = 0;
      }
    } catch (err) { /* a damaged save is ignored */ }
  }
  function stats() {
    const counts = {};
    for (let i = 0; i < N; i++) counts[grid[i]] = (counts[grid[i]] || 0) + 1;
    let aw = 0; for (const v of awake) aw += v;
    return { W, H, counts, awake: aw, chunks: CW * CH, sprites: sprites.length, parts: parts.length, stepMs, renderMs, wind, bulbs: bulbs.map(b => [b.ox, b.cy]), sag: Array.from(sagExtra), released: els.filter(e => e === null).length };
  }

  // ---------- frame ----------
  function frame(msg) {
    const b = msg.bufs;
    if (msg.gen !== gen || b.buf.byteLength !== N * 4) { env.post({ t: 'frame', gen: msg.gen, stale: true, bufs: b }, [b.buf, b.lbuf, b.ov, b.heat, b.solid]); return; }
    buf = new Uint32Array(b.buf); lbuf = new Uint32Array(b.lbuf); ovb = new Uint32Array(b.ov); heatb = new Uint32Array(b.heat); solid = new Uint8Array(b.solid);
    view = msg.view; events = [];
    if (msg.input) for (const ev of msg.input) handleInput(ev);
    let t0 = performance.now();
    if (!opts.paused) {
      if (opts.storm && view.top < H) {
        for (let n = 0; n < 2; n++) { const x = (R() * W) | 0, i = view.top * W + x; if (grid[i] === E && R() < 0.5) set(x, view.top, WATER); }
        if (R() < 0.006) strike((R() * W) | 0, Math.min(H - 1, view.top + rr(60, Math.max(61, view.viewH))));
      }
      if (opts.rain > 0 && view.top < H) for (let n = 0; n < opts.rain; n++) { const x = (R() * W) | 0, i = view.top * W + x; if (grid[i] === E) set(x, view.top, WATER); }
      windStep(); step(); heatStep(); heatEffects(); updateParts(); updateSprites(); checkReleases(); lightsReact();
      if (!opts.floor) for (let x = 0, i = (H - 1) * W; x < W; x++, i++) { const m = grid[i]; if (m !== E && m !== SURF && m !== GLASS && m !== WIRE && m !== BULB && m !== PAGE) { grid[i] = E; wakeAt(i); } }   // falls out of the window
    }
    const t1 = performance.now();
    fc++;
    updateBulbs(); render();
    const t2 = performance.now();
    stepMs = stepMs * 0.9 + (t1 - t0) * 0.1; renderMs = renderMs * 0.9 + (t2 - t1) * 0.1;
    let aw = 0; for (let c = 0; c < awake.length; c++) aw += awake[c];
    const out = { t: 'frame', gen, quiet: aw === 0 && !parts.length && !sprites.length && !bulbs.length, bufs: b, flash: opts.reduced ? Math.min(flash, 0.25) : flash, shake: opts.reduced ? 0 : shake, wind, events, fire: fireCount, lightsBottom, W, H };
    env.post(out, [b.buf, b.lbuf, b.ov, b.heat, b.solid]);
    flash *= 0.7; shake *= 0.85;
  }

  env.on(msg => {
    try {
      switch (msg.t) {
        case 'init': init(msg); break;
        case 'opt':
          opts[msg.key] = msg.value;
          if (msg.key === 'snowing' || msg.key === 'sharp') { awake && awake.fill(1); }
          if (grid && (msg.key === 'lights' || msg.key === 'palette' || msg.key === 'compact')) { removeLights(); buildLights(); awake.fill(1); }
          break;
        case 'count': { let n = 0; const [x0, y0, x1, y1] = msg.rect; for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) if (grid[y * W + x] === msg.m) n++; env.post({ t: 'count', id: msg.id, n }); break; }
        case 'frame': frame(msg); break;
        case 'save': { const ab = encodeSave(); env.post({ t: 'saved', gen, data: ab }, [ab]); break; }
        case 'stats': env.post({ t: 'stats', id: msg.id, data: stats() }); break;
      }
    } catch (err) {
      env.post({ t: 'error', message: String(err && err.stack || err) });
      if (msg.t === 'frame' && msg.bufs) { try { env.post({ t: 'frame', gen: msg.gen, stale: true, bufs: msg.bufs }, [msg.bufs.buf, msg.bufs.lbuf, msg.bufs.ov, msg.bufs.heat, msg.bufs.solid]); } catch (e2) {} }
    }
  });
}

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  ENGINE({ post: (m, t) => self.postMessage(m, t || []), on: fn => { self.onmessage = e => fn(e.data); } });
} else if (typeof window !== 'undefined') {
  window.ElementsENGINE = ENGINE;
}
