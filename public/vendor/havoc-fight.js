/* Havoc: Wizard vs the bosses (user, 2026-11-18). All of it is Cadence's own design, drawn here in code.
   A wizard walks along the bottom of the page and fights with fireballs from his staff. The bosses take turns, and
   each one comes back stronger:
     Dragon       flies across the top and blows fireballs, at the wizard and at the page
     Vampire cat  flaps around on bat wings and swoops down to bite the wizard (each bite heals it a little)
     Blobby       chases the wizard along the ground, hopping, and shakes the page when it lands
   A boss goes down after a random number of hits, and the next one comes out. Every round wrecks the page a little more:
   scorch marks first, then knocked-crooked and charred bits, then bits that come loose and fall. If the effects layer is
   on, the fire is real Elements fire, so it spreads. Esc, or the Stop button, puts every bit of the page back.
   Click to aim the wizard's fireballs. Arrow keys (or A and D) walk him, Up, W or Space jumps.
   HavocFight.start() / stop() / active; HavocFight.state() and .debug are for the tests. */
(() => {
  if (window.HavocFight) return;
  const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), irnd = (a, b) => Math.floor(rnd(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const BOSSES = ['dragon', 'cat', 'blobby'];
  const NAME = { dragon: 'Dragon', cat: 'Vampire cat', blobby: 'Blobby' };
  const HITS = { dragon: [6, 12], cat: [5, 10], blobby: [6, 11] };
  let S = null;

  // ---------- the page: what gets wrecked, and how it's put back ----------
  const BLOCK = '.task,.card,.ntile,#side .nav a,#view h1,#view h2,#view h3,.chip,.btn,button,img,.widget,.wl-it,.wq-it,li,.qa,.qa-row,.sect,.panel';
  const BIG = '.task,.card,.ntile,.widget,.wq-it,.wl-it,.panel';
  const blockAt = (x, y) => {
    for (const el of document.elementsFromPoint(x, y)) {
      if (!S || el === S.cv || S.ui.contains(el) || el === document.body || el === document.documentElement) continue;
      // a whole row or card when there is one, rather than the button inside it
      const c = el.closest(BIG) || el.closest(BLOCK); if (!c || S.ui.contains(c)) continue;
      const r = c.getBoundingClientRect(), a = r.width * r.height;
      if (a > 300 && a < innerWidth * innerHeight * 0.3) return c;
    }
    return null;
  };
  const keep = el => { if (!S.kept.has(el)) S.kept.set(el, { style: el.getAttribute('style'), anims: [] }); return S.kept.get(el); };
  const animate = (el, frames, opts) => { const a = el.animate(frames, opts); keep(el).anims.push(a); return a; };
  // a hit on the page at x,y. power 1 is a fireball; bigger for a boss going down
  function wreck(x, y, power = 1) {
    if (!S) return;
    const lvl = S.round;
    // soot, always
    const d = S.dx, r = (18 + 10 * power) * rnd(0.8, 1.2), g = d.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(20,14,10,.55)'); g.addColorStop(0.55, 'rgba(40,26,16,.25)'); g.addColorStop(1, 'rgba(40,26,16,0)');
    d.fillStyle = g; d.beginPath(); d.arc(x, y, r, 0, TAU); d.fill();
    for (let i = 0; i < 3 + power * 2; i++) { const a = rnd(0, TAU), l = rnd(r * 0.5, r * 1.05); d.strokeStyle = 'rgba(30,20,12,.12)'; d.lineWidth = rnd(1.5, 3.5); d.beginPath(); d.moveTo(x, y); d.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); d.stroke(); }
    burst(x, y, 10 + power * 6, ['#ffd166', '#ff9f1c', '#f3722c', '#5c4033'], 260);
    // real fire from the effects layer, when it's there
    if (S.fx) { try { S.fx.spawn(x, y, S.fx.M.FIRE, 3 + Math.min(lvl, 4), 0.5, 15, 40); if (power > 1) S.fx.explode(x, y, 4 + power * 2); } catch {} }
    const el = blockAt(x, y); if (!el) return;
    S.wrecked++;
    const st = keep(el);
    if (lvl <= 1 && power <= 1) { animate(el, [{ transform: 'translate(0,0)' }, { transform: `translate(${rnd(-6, 6)}px,${rnd(-4, 4)}px) rotate(${rnd(-2, 2)}deg)` }, { transform: 'translate(0,0)' }], { duration: 260 }); return; }
    if (lvl === 2 || (lvl > 2 && Math.random() < 0.4 && !st.loose)) {
      st.tilt = (st.tilt || 0) + rnd(-7, 7);
      el.style.transition = 'transform .25s ease-out, filter .4s';
      el.style.transform = `rotate(${st.tilt.toFixed(1)}deg) translate(${rnd(-6, 6).toFixed(0)}px,${rnd(-3, 5).toFixed(0)}px)`;
      el.style.filter = `sepia(.5) brightness(${Math.max(0.45, 0.85 - 0.1 * (st.hits = (st.hits || 0) + 1)).toFixed(2)})`;
      return;
    }
    // round 3 on: it comes loose and falls to the bottom
    if (st.loose) return; st.loose = true;
    const b = el.getBoundingClientRect(), drop = innerHeight - b.bottom + rnd(-10, 30), spin = rnd(-70, 70), side = rnd(-80, 80);
    el.style.filter = 'sepia(.6) brightness(.55)';
    animate(el, [{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${side * 0.3}px,${-20 * power}px) rotate(${spin * 0.2}deg)`, offset: 0.15 },
      { transform: `translate(${side}px,${drop}px) rotate(${spin}deg)` }], { duration: 900 + rnd(0, 500), easing: 'cubic-bezier(.4,.05,.8,.5)', fill: 'forwards' });
  }
  function shake(n = 1) {
    S.shake = Math.max(S.shake, 6 * n);
    if (calm()) return;
    const app = document.getElementById('app') || document.body.firstElementChild;
    if (app) animate(app, [{ transform: 'translate(0,0)' }, { transform: `translate(${rnd(-5, 5) * n}px,${rnd(-4, 4) * n}px)` }, { transform: `translate(${rnd(-4, 4) * n}px,${rnd(-3, 3) * n}px)` }, { transform: 'translate(0,0)' }], { duration: 300 });
  }
  const someBlock = () => {
    const els = [...document.querySelectorAll('.task,.card,.ntile,#view h1,.widget,.chip,.wq-it,img')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 20 && r.height > 10 && r.top > 0 && r.bottom < innerHeight && r.left > 0 && r.right < innerWidth && !(S.kept.get(e) || {}).loose; });
    if (!els.length) return null; const r = els[irnd(0, els.length - 1)].getBoundingClientRect(); return { x: r.left + rnd(0.2, 0.8) * r.width, y: r.top + r.height / 2 };
  };

  // ---------- bits flying about ----------
  function burst(x, y, n, cols, sp = 200, g = 300) {
    for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(0.2, 1) * sp; S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.3, life: rnd(0.4, 1), max: 1, col: cols[irnd(0, cols.length - 1)], r: rnd(1.5, 4), g }); }
  }
  const shoot = (x, y, tx, ty, from, speed, big = 1, target = null) => {
    const a = Math.atan2(ty - y, tx - x);
    S.shots.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, from, r: (from === 'wiz' ? 7 : 10) * big, life: 4, tx, ty, target });
  };

  // ---------- the wizard ----------
  const G = () => innerHeight - 4; // the ground
  function newWizard() { return { x: innerWidth * 0.25, y: G(), vy: 0, face: 1, cd: 1, hurt: 0, cast: 0, walk: 0, manual: 0, dir: 0, jumpQ: false }; }
  function wizStep(w, b, dt) {
    w.cd -= dt; w.hurt = Math.max(0, w.hurt - dt); w.cast = Math.max(0, w.cast - dt); w.manual = Math.max(0, w.manual - dt);
    let vx = 0;
    if (w.manual > 0) vx = w.dir * 260;
    else if (b && b.alive && w.hurt <= 0) {
      // keep a good distance from the boss; from Blobby, run
      const want = b.kind === 'blobby' ? (b.x < innerWidth / 2 ? innerWidth - 90 : 90) : clamp(b.x + (w.x < b.x ? -1 : 1) * 260, 60, innerWidth - 60);
      if (Math.abs(want - w.x) > 30) vx = Math.sign(want - w.x) * (b.kind === 'blobby' ? 230 : 150);
      // dodge: a fireball or a swooping cat coming his way
      const near = S.shots.some(s => s.from === 'boss' && Math.hypot(s.x - w.x, s.y - (w.y - 40)) < 150 && (s.x - w.x) * s.vx < 0) || (b.kind === 'cat' && b.mode === 'swoop' && Math.abs(b.x - w.x) < 140);
      if (near && w.y >= G() - 0.5 && Math.random() < 0.08) w.jumpQ = true;
      if (b.kind === 'blobby' && Math.abs(b.x - w.x) < 120 && w.y >= G() - 0.5 && Math.random() < 0.05) w.jumpQ = true;
      if (w.cd <= 0 && !S.banner) { const tx = b.x + b.vx * 0.35, ty = b.y + (b.vy || 0) * 0.2; staffShot(w, tx, ty); w.cd = rnd(0.7, 1.4) / (1 + 0.08 * (S.round - 1)); }
    }
    if (w.jumpQ && w.y >= G() - 0.5) { w.vy = -560; w.jumpQ = false; }
    w.x = clamp(w.x + vx * dt, 24, innerWidth - 24); if (vx) w.face = Math.sign(vx); if (b && w.manual <= 0 && !vx) w.face = Math.sign(b.x - w.x) || 1;
    w.walk += Math.abs(vx) * dt * 0.05;
    w.vy += 1500 * dt; w.y = Math.min(G(), w.y + w.vy * dt); if (w.y >= G()) w.vy = 0;
  }
  const tip = w => ({ x: w.x + w.face * 18, y: w.y - 76 });
  function staffShot(w, tx, ty) { const t = tip(w); w.face = Math.sign(tx - w.x) || w.face; const t2 = tip(w); shoot(t2.x, t2.y, tx, ty, 'wiz', 560); w.cast = 0.25; burst(t.x, t.y, 6, ['#fff3b0', '#ffd166'], 90, 0); }
  function hurtWizard(w, from) { if (w.hurt > 0) return false; w.hurt = 0.9; w.vy = -320; w.x = clamp(w.x + (w.x < from ? -60 : 60), 24, innerWidth - 24); burst(w.x, w.y - 40, 14, ['#ffffff', '#c7d2fe', '#a5b4fc'], 180); shake(0.6); return true; }

  // ---------- the bosses ----------
  function newBoss(kind) {
    const lv = S.round, hp = Math.round(irnd(...HITS[kind]) * (1 + 0.25 * Math.floor((lv - 1) / 3)));
    const side = Math.random() < 0.5 ? -1 : 1;
    const b = { kind, hp, max: hp, alive: true, t: 0, flash: 0, vx: 0, vy: 0, face: -side, cd: rnd(1.2, 2), speed: 1 + 0.15 * Math.floor((lv - 1) / 3), dying: 0 };
    if (kind === 'dragon') Object.assign(b, { x: side < 0 ? -160 : innerWidth + 160, y: innerHeight * 0.22, R: 60, home: innerHeight * rnd(0.16, 0.3), breath: 0 });
    if (kind === 'cat') Object.assign(b, { x: side < 0 ? -80 : innerWidth + 80, y: innerHeight * 0.3, R: 30, mode: 'fly', mt: rnd(2.5, 4) });
    if (kind === 'blobby') Object.assign(b, { x: side < 0 ? -70 : innerWidth + 70, y: G(), R: 44, squash: 0, grounded: true, hopT: 0.6 });
    return b;
  }
  function bossStep(b, w, dt) {
    b.t += dt; b.flash = Math.max(0, b.flash - dt); b.cd -= dt * b.speed;
    if (!b.alive) { b.dying += dt; b.vy += 900 * dt; b.y += b.vy * dt; b.x += b.vx * dt; return; }
    if (b.kind === 'dragon') {
      // a lazy figure-of-eight across the top; turns to face the wizard
      const cx = innerWidth / 2 + Math.sin(b.t * 0.35 * b.speed) * innerWidth * 0.36, cy = b.home + Math.sin(b.t * 0.9 * b.speed) * 50;
      b.vx = (cx - b.x) * 1.6; b.vy = (cy - b.y) * 1.6; b.x += b.vx * dt; b.y += b.vy * dt; b.face = w.x < b.x ? -1 : 1;
      b.breath = Math.max(0, b.breath - dt);
      if (b.cd <= 0 && !S.banner && b.x > 40 && b.x < innerWidth - 40) {
        b.breath = 0.5; const n = irnd(1, 2 + Math.min(S.round, 3));
        for (let i = 0; i < n; i++) setTimeout(() => { if (!S || !b.alive) return; const m2 = mouth(b);
          const page = Math.random() < 0.45 && someBlock();
          if (page) shoot(m2.x, m2.y, page.x, page.y, 'boss', 300 * b.speed, 1.2, page);
          else shoot(m2.x, m2.y, w.x + w.vy * 0 + rnd(-40, 40), w.y - 30, 'boss', 330 * b.speed, 1.2);
          burst(m2.x, m2.y, 8, ['#ffd166', '#ff9f1c', '#f3722c'], 140, 0); }, i * 220);
        b.cd = rnd(1.4, 2.4);
      }
    } else if (b.kind === 'cat') {
      b.mt -= dt;
      if (b.mode === 'fly') {
        const cx = innerWidth / 2 + Math.sin(b.t * 0.7) * innerWidth * 0.38 + Math.sin(b.t * 2.3) * 60, cy = innerHeight * 0.28 + Math.sin(b.t * 1.7) * innerHeight * 0.12;
        b.vx = (cx - b.x) * 2; b.vy = (cy - b.y) * 2;
        // claws through the page now and then
        if (Math.random() < dt * 0.6 * S.round) { const p = someBlock(); if (p && Math.hypot(p.x - b.x, p.y - b.y) < 260) scratch(p.x, p.y); }
        if (b.mt <= 0 && !S.banner) { b.mode = 'swoop'; b.mt = 1.6; b.sx = w.x; b.sy = w.y - 40; }
      } else if (b.mode === 'swoop') {
        const a = Math.atan2(b.sy - b.y, b.sx - b.x); b.vx = Math.cos(a) * 520 * b.speed; b.vy = Math.sin(a) * 520 * b.speed;
        if (Math.hypot(b.sx - b.x, b.sy - b.y) < 30 || b.mt <= 0) { b.mode = 'up'; b.mt = 1; }
      } else { b.vy = -380; b.vx *= 0.96; if (b.mt <= 0 || b.y < innerHeight * 0.25) { b.mode = 'fly'; b.mt = rnd(2.2, 3.8) / b.speed; } }
      b.x += b.vx * dt; b.y += b.vy * dt; b.face = b.vx < 0 ? -1 : 1;
      if (Math.hypot(b.x - w.x, b.y - (w.y - 40)) < b.R + 22 && hurtWizard(w, b.x)) { b.hp = Math.min(b.max, b.hp + 1); b.mode = 'up'; b.mt = 1; b.bite = 0.6; burst(w.x, w.y - 50, 8, ['#c084fc', '#e9d5ff'], 120); }
      b.bite = Math.max(0, (b.bite || 0) - dt);
    } else if (b.kind === 'blobby') {
      b.hopT -= dt * b.speed;
      if (b.grounded && b.hopT <= 0 && !S.banner) { b.vy = -rnd(380, 560); b.vx = Math.sign(w.x - b.x) * rnd(160, 240) * b.speed; b.grounded = false; b.squash = -0.3; }
      if (!b.grounded) { b.vy += 1300 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y >= G()) { b.y = G(); b.grounded = true; b.vx = 0; b.squash = 0.45; b.hopT = rnd(0.35, 0.9); shake(0.5 + 0.2 * S.round);
          // the landing thumps the page
          if (S.round >= 2) wreck(clamp(b.x + rnd(-60, 60), 10, innerWidth - 10), G() - rnd(20, 140), 1);
          burst(b.x, G(), 10, ['#99e2b4', '#52b788', '#2d6a4f'], 160); goo(b.x, G() - 6, 0.6); } }
      b.squash *= Math.pow(0.02, dt); b.face = w.x < b.x ? -1 : 1;
      if (Math.abs(b.x - w.x) < b.R * 0.8 + 14 && w.y > G() - b.R * 1.3) hurtWizard(w, b.x);
      if (b.x < -100) b.x = -100; if (b.x > innerWidth + 100) b.x = innerWidth + 100;
    }
  }
  const mouth = b => ({ x: b.x + b.face * 92, y: b.y - 24 });
  function scratch(x, y) {
    const d = S.dx; d.strokeStyle = 'rgba(40,20,50,.35)'; d.lineWidth = 2; d.lineCap = 'round';
    const a = rnd(-0.6, 0.6); for (let i = -1; i <= 1; i++) { d.beginPath(); d.moveTo(x - 16 + i * 7, y - 14); d.lineTo(x + 16 + i * 7 + a * 10, y + 14); d.stroke(); }
    const el = blockAt(x, y); if (el && S.round >= 2) wreck(x, y, 1); else if (el) animate(el, [{ transform: 'none' }, { transform: `rotate(${rnd(-2, 2)}deg)` }, { transform: 'none' }], { duration: 200 });
  }
  function goo(x, y, s = 1) { const d = S.dx; d.fillStyle = 'rgba(82,183,136,.28)'; for (let i = 0; i < 4; i++) { d.beginPath(); d.ellipse(x + rnd(-30, 30) * s, y + rnd(-4, 4), rnd(8, 22) * s, rnd(3, 7) * s, 0, 0, TAU); d.fill(); } }
  function hitBoss(b, x, y) {
    b.hp--; b.flash = 0.15; burst(x, y, 12, ['#fff3b0', '#ffd166', '#ff9f1c'], 220);
    if (b.kind === 'blobby') { b.R = Math.max(26, b.R - 1.2); goo(x, Math.min(G() - 4, y + 30), 0.4); }
    if (b.kind === 'cat' && b.mode === 'swoop') { b.mode = 'up'; b.mt = 1; }
    if (b.hp <= 0) down(b);
  }
  function down(b) {
    b.alive = false; b.vy = -260; b.vx = rnd(-80, 80); S.beaten++;
    shake(2); burst(b.x, b.y - 20, 50, b.kind === 'blobby' ? ['#99e2b4', '#52b788', '#d8f3dc'] : b.kind === 'cat' ? ['#2b2d42', '#7b2cbf', '#e0aaff'] : ['#2f9e44', '#ffd166', '#ff9f1c'], 420);
    if (b.kind === 'blobby') goo(b.x, G() - 6, 2);
    // going down takes a chunk of the page with it
    for (let i = 0; i < 2 + S.round; i++) setTimeout(() => S && wreck(clamp(b.x + rnd(-220, 220), 10, innerWidth - 10), clamp(b.y + rnd(-160, 160), 10, innerHeight - 10), 2), i * 120);
    setTimeout(() => { if (!S) return; S.round++; const k = BOSSES[(S.round - 1) % BOSSES.length]; S.banner = { text: `Round ${S.round}: ${NAME[k]}${S.round > 3 ? ', angrier' : ''}`, t: 1.8 }; S.boss = newBoss(k); }, 1400);
  }

  // ---------- drawing (all shapes, no images) ----------
  function drawWizard(c, w) {
    c.save(); c.translate(w.x, w.y); c.scale(w.face, 1);
    if (w.hurt > 0 && Math.floor(w.hurt * 14) % 2) c.globalAlpha = 0.45;
    const bob = Math.sin(w.walk * 6) * 2, air = w.y < G() - 1;
    // feet
    c.fillStyle = '#3d2b1f'; c.beginPath(); c.ellipse(-7 + (air ? 0 : bob), -2, 6, 3, 0, 0, TAU); c.ellipse(8 - (air ? 0 : bob), -2, 6, 3, 0, 0, TAU); c.fill();
    // robe
    const rg = c.createLinearGradient(0, -52, 0, 0); rg.addColorStop(0, '#4c5fd5'); rg.addColorStop(1, '#2f3b9c');
    c.fillStyle = rg; c.beginPath(); c.moveTo(-9, -50); c.lineTo(9, -50); c.lineTo(17, -3); c.quadraticCurveTo(0, 2, -17, -3); c.closePath(); c.fill();
    c.fillStyle = '#ffd166'; for (const [sx, sy] of [[-6, -30], [5, -16], [-2, -40], [9, -34]]) star(c, sx, sy, 2.2);
    // belt
    c.fillStyle = '#c9a227'; c.fillRect(-11, -31, 22, 3);
    // arm and staff
    const cast = w.cast > 0 ? 1 : 0;
    c.strokeStyle = '#6b4423'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(14, -6); c.lineTo(18, -74 - cast * 4); c.stroke();
    c.fillStyle = '#4c5fd5'; c.beginPath(); c.ellipse(10, -36, 5, 9, -0.5 - cast * 0.6, 0, TAU); c.fill();
    c.fillStyle = '#f1c9a5'; c.beginPath(); c.arc(16, -40 - cast * 6, 3.5, 0, TAU); c.fill();
    const og = c.createRadialGradient(18, -78, 0, 18, -78, 12 + cast * 10); og.addColorStop(0, 'rgba(255,243,176,.95)'); og.addColorStop(0.4, 'rgba(255,190,80,.6)'); og.addColorStop(1, 'rgba(255,160,60,0)');
    c.fillStyle = og; c.beginPath(); c.arc(18, -78, 12 + cast * 10, 0, TAU); c.fill();
    c.fillStyle = '#fff3b0'; c.beginPath(); c.arc(18, -78, 4.5, 0, TAU); c.fill();
    // head, beard, hat
    c.fillStyle = '#f1c9a5'; c.beginPath(); c.arc(0, -57, 7.5, 0, TAU); c.fill();
    c.fillStyle = '#f8f9fa'; c.beginPath(); c.moveTo(-7, -56); c.quadraticCurveTo(0, -30, 7, -56); c.quadraticCurveTo(0, -52, -7, -56); c.fill();
    c.fillStyle = '#1b1b1b'; c.beginPath(); c.arc(3.5, -59, 1.2, 0, TAU); c.fill();
    c.fillStyle = '#3b4cca'; c.beginPath(); c.ellipse(0, -63, 14, 3.5, 0, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(-9, -64); c.quadraticCurveTo(-2, -82, -10, -94 + Math.sin(w.walk * 3) * 1.5); c.quadraticCurveTo(4, -84, 9, -64); c.closePath(); c.fill();
    c.fillStyle = '#ffd166'; star(c, -1, -74, 2.4);
    c.restore();
  }
  function star(c, x, y, r) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.fill(); }
  function drawDragon(c, b) {
    c.save(); c.translate(b.x, b.y); c.scale(b.face, 1); if (!b.alive) c.rotate(b.dying * 2);
    const flap = Math.sin(b.t * 7) * 0.7, hit = b.flash > 0;
    const body = hit ? '#e9fce9' : '#2f9e44', dark = hit ? '#d3f9d8' : '#237032', belly = hit ? '#fff' : '#b2f2bb';
    // far wing
    wing(c, -6, -18, -1.9 - flap, dark);
    // tail
    c.strokeStyle = body; c.lineWidth = 14; c.lineCap = 'round'; c.beginPath(); c.moveTo(-40, 0); c.quadraticCurveTo(-90, 20 + Math.sin(b.t * 3) * 10, -120, -4 + Math.sin(b.t * 3 + 1) * 14); c.stroke();
    c.fillStyle = dark; c.beginPath(); const tx = -120, ty = -4 + Math.sin(b.t * 3 + 1) * 14; c.moveTo(tx - 4, ty); c.lineTo(tx - 22, ty - 12); c.lineTo(tx - 16, ty + 2); c.lineTo(tx - 22, ty + 14); c.closePath(); c.fill();
    // legs
    c.fillStyle = dark; c.beginPath(); c.ellipse(-18, 26, 9, 14, 0.3, 0, TAU); c.ellipse(20, 26, 9, 14, -0.2, 0, TAU); c.fill();
    // body and belly
    c.fillStyle = body; c.beginPath(); c.ellipse(0, 0, 52, 32, 0, 0, TAU); c.fill();
    c.fillStyle = belly; c.beginPath(); c.ellipse(8, 12, 36, 16, 0.08, 0, TAU); c.fill();
    // spikes along the back
    c.fillStyle = dark; for (let i = -3; i <= 3; i++) { const x = i * 13, y = -30 + Math.abs(i) * 2; c.beginPath(); c.moveTo(x - 6, y + 4); c.lineTo(x, y - 9); c.lineTo(x + 6, y + 4); c.fill(); }
    // neck and head
    c.strokeStyle = body; c.lineWidth = 22; c.beginPath(); c.moveTo(34, -8); c.quadraticCurveTo(58, -30, 68, -30); c.stroke();
    c.fillStyle = body; c.beginPath(); c.ellipse(76, -30, 20, 14, 0.15, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(94, -24, 14, 9, 0.2, 0, TAU); c.fill();
    c.fillStyle = dark; c.beginPath(); c.moveTo(66, -42); c.lineTo(56, -62); c.lineTo(74, -44); c.fill(); c.beginPath(); c.moveTo(76, -44); c.lineTo(72, -64); c.lineTo(84, -42); c.fill();
    c.fillStyle = '#ffe066'; c.beginPath(); c.ellipse(80, -34, 5, 4, 0, 0, TAU); c.fill(); c.fillStyle = '#212529'; c.beginPath(); c.ellipse(81.5, -34, 1.6, 3.4, 0, 0, TAU); c.fill();
    c.fillStyle = dark; c.beginPath(); c.arc(103, -27, 1.8, 0, TAU); c.fill();
    if (b.breath > 0) { const g = c.createRadialGradient(108, -22, 0, 108, -22, 26); g.addColorStop(0, 'rgba(255,230,150,.9)'); g.addColorStop(1, 'rgba(255,140,40,0)'); c.fillStyle = g; c.beginPath(); c.arc(108, -22, 26, 0, TAU); c.fill(); }
    // near wing
    wing(c, 4, -20, -1.4 + flap, hit ? '#c3fae8' : '#40c057');
    c.restore();
  }
  function wing(c, x, y, a, col) {
    c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = col; c.globalAlpha *= 0.95;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(78, -10); c.quadraticCurveTo(70, 8, 58, 6); c.quadraticCurveTo(48, 22, 36, 14); c.quadraticCurveTo(24, 26, 12, 14); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(58, 6); c.moveTo(0, 0); c.lineTo(36, 14); c.stroke(); c.restore();
  }
  function drawCat(c, b) {
    c.save(); c.translate(b.x, b.y); c.scale(b.face, 1); if (!b.alive) c.rotate(b.dying * 3);
    const flap = Math.sin(b.t * 14) * 0.8, hit = b.flash > 0, fur = hit ? '#e9ecef' : '#22223b';
    // bat wings
    for (const s of [-1, 1]) { c.save(); c.scale(1, 1); c.translate(-4, -6); c.rotate(s * (0.5 + flap * 0.5) - Math.PI / 2 * (s > 0 ? 0 : 0)); c.fillStyle = hit ? '#f3d9fa' : '#5a189a';
      c.beginPath(); c.moveTo(0, 0); c.lineTo(-10, -38 * s); c.quadraticCurveTo(-20, -30 * s, -24, -34 * s); c.quadraticCurveTo(-26, -20 * s, -36, -22 * s); c.quadraticCurveTo(-28, -8 * s, -30, -4 * s); c.closePath(); c.fill(); c.restore(); }
    // tail
    c.strokeStyle = fur; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-22, 4); c.quadraticCurveTo(-40, 0, -38, -16 + Math.sin(b.t * 4) * 4); c.stroke();
    // body, cape collar, head
    c.fillStyle = fur; c.beginPath(); c.ellipse(-6, 6, 22, 13, 0, 0, TAU); c.fill();
    c.fillStyle = hit ? '#fff' : '#7b2cbf'; c.beginPath(); c.moveTo(6, -6); c.lineTo(22, 14); c.lineTo(10, 10); c.closePath(); c.fill();
    c.fillStyle = fur; c.beginPath(); c.arc(16, -6, 14, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(6, -14); c.lineTo(6, -30); c.lineTo(15, -18); c.fill(); c.beginPath(); c.moveTo(18, -19); c.lineTo(26, -32); c.lineTo(28, -14); c.fill();
    c.fillStyle = '#c77dff'; c.beginPath(); c.moveTo(8, -17); c.lineTo(8, -25); c.lineTo(13, -18); c.fill();
    // eyes, glowing
    c.fillStyle = '#f5d76e'; c.beginPath(); c.ellipse(14, -8, 3.6, 3, 0, 0, TAU); c.ellipse(24, -8, 3.6, 3, 0, 0, TAU); c.fill();
    c.fillStyle = '#10002b'; c.beginPath(); c.ellipse(15, -8, 1, 2.6, 0, 0, TAU); c.ellipse(25, -8, 1, 2.6, 0, 0, TAU); c.fill();
    // fangs
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(17, 0); c.lineTo(18.5, 6 + (b.bite > 0 ? 2 : 0)); c.lineTo(20, 0); c.fill(); c.beginPath(); c.moveTo(22, 0); c.lineTo(23.5, 6 + (b.bite > 0 ? 2 : 0)); c.lineTo(25, 0); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(28, -2); c.lineTo(38, -4); c.moveTo(28, 0); c.lineTo(38, 2); c.stroke();
    c.restore();
  }
  function drawBlobby(c, b) {
    c.save(); c.translate(b.x, b.y); if (!b.alive) { c.globalAlpha = Math.max(0, 1 - b.dying); c.scale(1 + b.dying, Math.max(0.05, 1 - b.dying)); }
    const R = b.R, sq = b.squash, sx = 1 + sq * 0.6, sy = 1 - sq * 0.6, hit = b.flash > 0;
    const g = c.createRadialGradient(-R * 0.3, -R * 1.2, R * 0.1, 0, -R * 0.8, R * 1.3);
    g.addColorStop(0, hit ? '#ffffff' : '#d8f3dc'); g.addColorStop(0.5, hit ? '#e6fcf5' : '#74c69d'); g.addColorStop(1, hit ? '#c3fae8' : '#2d6a4f');
    c.fillStyle = g; c.globalAlpha *= 0.92; c.beginPath();
    for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU, wob = 1 + Math.sin(a * 5 + b.t * 6) * 0.04 + Math.sin(a * 3 - b.t * 4) * 0.03;
      const x = Math.cos(a) * R * sx * wob, y = Math.sin(a) * R * sy * wob; c.lineTo(x, Math.min(0, y - R * sy)); }
    c.closePath(); c.fill(); c.globalAlpha = 1;
    c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(-R * 0.35, -R * 1.45 * sy, R * 0.18, R * 0.1, -0.5, 0, TAU); c.fill();
    const ey = -R * 1.1 * sy, f = b.face * R * 0.12;
    for (const ex of [-R * 0.28, R * 0.28]) { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ex + f, ey, R * 0.17, R * 0.21, 0, 0, TAU); c.fill(); c.fillStyle = '#1b1b1b'; c.beginPath(); c.arc(ex + f * 1.6, ey + 2, R * 0.08, 0, TAU); c.fill(); }
    c.strokeStyle = '#1b4332'; c.lineWidth = 2.5; c.lineCap = 'round'; c.beginPath(); c.arc(f, -R * 0.75 * sy, R * 0.2, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    c.restore();
  }
  function drawShot(c, s) {
    const wiz = s.from === 'wiz', r = s.r;
    const g = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 2.2);
    g.addColorStop(0, wiz ? 'rgba(255,250,220,1)' : 'rgba(255,240,180,1)'); g.addColorStop(0.35, wiz ? 'rgba(255,200,90,.9)' : 'rgba(255,150,40,.95)'); g.addColorStop(1, 'rgba(240,90,20,0)');
    c.fillStyle = g; c.beginPath(); c.arc(s.x, s.y, r * 2.2, 0, TAU); c.fill();
  }

  // ---------- the loop ----------
  function frame(now) {
    if (!S) return;
    const dt = Math.min(0.05, (now - (S.last || now)) / 1000); S.last = now;
    const w = S.wiz, b = S.boss;
    if (S.banner && (S.banner.t -= dt) <= 0) S.banner = null;
    wizStep(w, b, dt);
    if (b) bossStep(b, w, dt);
    if (b && !b.alive && b.dying > 2.5 && S.boss === b) S.boss = null;
    // fireballs
    for (const s of S.shots) {
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; if (s.from === 'boss') s.vy += 60 * dt;
      if (Math.random() < 0.7) S.parts.push({ x: s.x, y: s.y, vx: rnd(-20, 20), vy: rnd(-30, 10), life: 0.35, max: 0.35, col: s.from === 'wiz' ? '#ffe8a3' : '#ffb347', r: s.r * 0.5, g: -40 });
      if (s.from === 'wiz') {
        const B = S.boss; if (B && B.alive) { const hy = B.kind === 'blobby' ? B.y - B.R : B.y; if (Math.hypot(s.x - B.x, s.y - hy) < B.R + s.r) { s.life = 0; hitBoss(B, s.x, s.y); continue; } }
        // a wild shot that strays onto the page
        if (s.target && Math.hypot(s.x - s.target.x, s.y - s.target.y) < 14) { s.life = 0; wreck(s.x, s.y, 1); }
      } else {
        if (Math.hypot(s.x - w.x, s.y - (w.y - 40)) < s.r + 18) { s.life = 0; hurtWizard(w, s.x - s.vx); burst(s.x, s.y, 10, ['#ffd166', '#f3722c'], 160); continue; }
        if (s.target && Math.hypot(s.x - s.target.x, s.y - s.target.y) < 16) { s.life = 0; wreck(s.x, s.y, 1); continue; }
        if (s.y >= G() - 4) { s.life = 0; wreck(s.x, G() - rnd(10, 60), 1); }
      }
      if (s.x < -60 || s.x > innerWidth + 60 || s.y < -80) s.life = 0;
    }
    S.shots = S.shots.filter(s => s.life > 0);
    for (const p of S.parts) { p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    S.parts = S.parts.filter(p => p.life > 0); if (S.parts.length > 900) S.parts.splice(0, S.parts.length - 900);

    // draw
    const c = S.cx, k = S.dpr; c.setTransform(k, 0, 0, k, 0, 0); c.clearRect(0, 0, innerWidth, innerHeight);
    S.shake *= Math.pow(0.001, dt); const sh = calm() ? 0 : S.shake; c.translate(rnd(-sh, sh), rnd(-sh, sh));
    c.drawImage(S.decals, 0, 0, innerWidth, innerHeight);
    // a soft floor shadow, so the ground reads
    const fl = c.createLinearGradient(0, G() - 30, 0, innerHeight); fl.addColorStop(0, 'rgba(0,0,0,0)'); fl.addColorStop(1, 'rgba(0,0,0,.12)'); c.fillStyle = fl; c.fillRect(0, G() - 30, innerWidth, 40);
    if (S.boss) ({ dragon: drawDragon, cat: drawCat, blobby: drawBlobby })[S.boss.kind](c, S.boss);
    drawWizard(c, w);
    for (const s of S.shots) drawShot(c, s);
    for (const p of S.parts) { c.globalAlpha = Math.max(0, p.life / p.max); c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); }
    c.globalAlpha = 1; c.setTransform(k, 0, 0, k, 0, 0);
    hud(c);
    S.raf = requestAnimationFrame(frame);
  }
  function hud(c) {
    const B = S.boss, mid = innerWidth / 2;
    c.font = '600 13px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (B && B.alive) {
      const wd = Math.min(260, innerWidth * 0.5), x = mid - wd / 2, y = 22;
      c.fillStyle = 'rgba(20,20,28,.55)'; rr(c, x - 10, y - 12, wd + 20, 40, 10); c.fill();
      c.fillStyle = '#f8f9fa'; c.fillText(`${NAME[B.kind]} · round ${S.round}`, mid, y);
      c.fillStyle = 'rgba(255,255,255,.18)'; rr(c, x, y + 12, wd, 6, 3); c.fill();
      c.fillStyle = '#ffd166'; rr(c, x, y + 12, Math.max(0, wd * B.hp / B.max), 6, 3); c.fill();
    }
    if (S.banner) {
      c.globalAlpha = Math.min(1, S.banner.t * 2, (1.8 - S.banner.t) * 4 + 0.2); c.font = '700 26px system-ui, sans-serif';
      c.fillStyle = 'rgba(20,20,28,.6)'; const tw = c.measureText(S.banner.text).width + 40; rr(c, mid - tw / 2, innerHeight * 0.4 - 26, tw, 52, 14); c.fill();
      c.fillStyle = '#fff3b0'; c.fillText(S.banner.text, mid, innerHeight * 0.4); c.globalAlpha = 1;
    }
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }

  // ---------- start and stop ----------
  function size() {
    if (!S) return; const k = S.dpr = Math.min(2, devicePixelRatio || 1);
    for (const cv of [S.cv, S.decals]) { const old = cv === S.decals && cv.width ? (() => { const o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height; o.getContext('2d').drawImage(cv, 0, 0); return o; })() : null;
      cv.width = innerWidth * k; cv.height = innerHeight * k; if (old) cv.getContext('2d').drawImage(old, 0, 0); }
    S.dx.setTransform(k, 0, 0, k, 0, 0);
  }
  function start() {
    if (S) return;
    const cv = document.createElement('canvas'); cv.className = 'hf-canvas';
    cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483000;cursor:crosshair;touch-action:none';
    const ui = document.createElement('div'); ui.className = 'hf-ui';
    ui.style.cssText = 'position:fixed;z-index:2147483001;right:14px;top:12px;display:flex;gap:8px;align-items:center;font:500 12.5px system-ui,sans-serif;color:#f8f9fa';
    ui.innerHTML = '<span class="hf-tip" style="background:rgba(20,20,28,.55);padding:6px 10px;border-radius:8px">Click to aim · arrows to move · Esc to stop</span><button class="hf-stop" style="background:rgba(20,20,28,.7);color:#fff;border:0;border-radius:8px;padding:6px 12px;font:inherit;cursor:pointer">Stop</button>';
    const decals = document.createElement('canvas');
    S = { cv, ui, decals, cx: cv.getContext('2d'), dx: decals.getContext('2d'), shots: [], parts: [], kept: new Map(), round: 1, beaten: 0, wrecked: 0, shake: 0, fx: null, banner: { text: 'Round 1: Dragon', t: 1.8 } };
    // the Island steps aside for the fight (it sits where the boss's health bar goes)
    const hide = document.createElement('style'); hide.textContent = '.isl,#island{visibility:hidden!important}'; ui.append(hide);
    document.body.append(cv, ui); size();
    S.wiz = newWizard(); S.boss = newBoss('dragon');
    if (window.CadenceFX) window.CadenceFX.world().then(w => { if (S && w) S.fx = w; }).catch(() => {});
    S.onDown = e => { if (!S) return; e.preventDefault(); const w = S.wiz; if (w.hurt > 0) return; if (S.lastClick && performance.now() - S.lastClick < 220) return; S.lastClick = performance.now(); staffShot(w, e.clientX, e.clientY); w.cd = Math.max(w.cd, 0.6); };
    S.onKey = e => {
      if (!S) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); stop(); return; }
      const k = e.key.toLowerCase();
      if (['arrowleft', 'a'].includes(k)) { S.wiz.manual = 1.2; S.wiz.dir = -1; e.preventDefault(); }
      else if (['arrowright', 'd'].includes(k)) { S.wiz.manual = 1.2; S.wiz.dir = 1; e.preventDefault(); }
      else if (['arrowup', 'w', ' '].includes(k)) { S.wiz.jumpQ = true; e.preventDefault(); }
    };
    S.onUp = e => { if (S && ['arrowleft', 'arrowright', 'a', 'd'].includes(e.key.toLowerCase())) S.wiz.manual = Math.min(S.wiz.manual, 0.15); };
    cv.addEventListener('pointerdown', S.onDown);
    addEventListener('keydown', S.onKey, true); addEventListener('keyup', S.onUp, true);
    S.onSize = () => size(); addEventListener('resize', S.onSize);
    ui.querySelector('.hf-stop').onclick = () => stop();
    S.raf = requestAnimationFrame(frame);
    dispatchEvent(new CustomEvent('havoc-fight', { detail: { on: true } }));
  }
  function stop() {
    if (!S) return;
    cancelAnimationFrame(S.raf);
    // every bit of the page back as it was
    for (const [el, st] of S.kept) { for (const a of st.anims) { try { a.cancel(); } catch {} } if (st.style == null) el.removeAttribute('style'); else el.setAttribute('style', st.style); }
    removeEventListener('keydown', S.onKey, true); removeEventListener('keyup', S.onUp, true); removeEventListener('resize', S.onSize);
    S.cv.remove(); S.ui.remove();
    const fx = S.fx; S = null;
    // the fire it left in the effects layer goes too
    if (fx) { try { fx.clearAt(innerWidth / 2, innerHeight / 2, Math.hypot(innerWidth, innerHeight)); } catch {} }
    dispatchEvent(new CustomEvent('havoc-fight', { detail: { on: false } }));
  }
  window.HavocFight = {
    start, stop, get active() { return !!S; },
    state: () => S && { round: S.round, boss: S.boss && S.boss.kind, hp: S.boss && S.boss.hp, max: S.boss && S.boss.max, beaten: S.beaten, wrecked: S.wrecked, touched: S.kept.size },
    debug: { blockAt: (x, y) => { const e = blockAt(x, y); return e && (e.tagName + "." + e.className); }, hit: n => { for (let i = 0; i < n; i++) if (S && S.boss && S.boss.alive) hitBoss(S.boss, S.boss.x, S.boss.y); }, wreck: (x, y, p) => wreck(x, y, p), setRound: r => { if (S) S.round = r; } }
  };
})();
