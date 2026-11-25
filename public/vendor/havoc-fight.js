/* Havoc: Wizard vs the bosses (user, 2026-11-18). Pixel art, all Cadence's own designs, drawn here in code.
   It plays out on Cadence's two engines at once:
     the words: Havoc's physics engine (vendor/havoc-engine.js) runs bare (no toolbar), so hits knock letters loose
                and blasts send them flying
     the matter: the Elements layer (CadenceFX), so the fire is real fire that spreads, lava melts, acid eats, ice freezes
   The wizard walks along the bottom and casts spells, shouting each one in a comic bubble:
     Fireball (purple), Kablammo (a big blast), Meltdown (a beam that melts the page), Zappity zap (lightning),
     Frostbite (freezes the boss for a moment) and, against Blobby only, Splat splat (Blobby bursts into acid and pulls
     himself back together).
   The bosses take turns, then come round again angrier:
     Dragon       flies across the top, breathes fireballs and spits lava
     Vampire cat  flaps about on bat wings, claws at the page, and now and then swoops down to bite the wizard
     Blobby       a jelly cube that hops after the wizard and leaves acid where he lands
     Skeleton     throws spinning bones that break things; or offers the wizard something nice, and when he comes close,
                  grabs him, shakes him up and down and throws him into the air
   (2026-11-19, user's ideas)
     Big baby     drops in, sits there and wails: tears (real Elements water) pour onto the page, each WAAAH knocks the
                  words about, and he throws his rattle. No fighting a baby: every spell turns into Milk time!, and the
                  round is done when he stops crying and falls asleep
     Graveyard    gravestones; when the wizard goes near one, a hand comes out and a zombie crawls up and shuffles after
                  him. Several can be up at once, and each goes down in a hit or two
     Old Clinker  a grumpy, crackling heap of coals with a flame crown (our own fire spirit). Sprays sparks, runs fire
                  along the floor, turns up the heat. Fire just tickles him; Frostbite hurts, and he shrinks as he's
                  put out
   A boss goes down after a random number of hits. Click to aim a fireball, 1 to 6 cast the spells, arrow keys (or A, D)
   walk, Up, W or Space jumps. Esc, or Stop, puts the whole page back.
   HavocFight.start() / stop() / active; HavocFight.state() and .debug are for the tests. */
(() => {
  if (window.HavocFight) return;
  const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), irnd = (a, b) => Math.floor(rnd(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), pick = a => a[Math.floor(Math.random() * a.length)];
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const BOSSES = ['dragon', 'cat', 'blobby', 'skeleton', 'baby', 'graves', 'clinker'];
  const NAME = { dragon: 'Dragon', cat: 'Vampire cat', blobby: 'Blobby', skeleton: 'Skeleton', baby: 'Big baby', graves: 'Graveyard', clinker: 'Old Clinker' };
  // for the baby it's how much crying is left; for the graveyard, how many zombies
  const HITS = { dragon: [6, 12], cat: [5, 10], blobby: [6, 11], skeleton: [6, 11], baby: [6, 9], graves: [5, 7], clinker: [7, 11] };
  const SPELLS = {
    fireball: { say: 'Fireball!', cd: 0.6 }, kablammo: { say: 'Kablammo!', cd: 1.6 }, meltdown: { say: 'Meltdown!', cd: 1.4 },
    zap: { say: 'Zappity zap!', cd: 1.4 }, frost: { say: 'Frostbite!', cd: 1.6 }, splat: { say: 'Splat splat!', cd: 2 },
    milk: { say: 'Milk time!', cd: 0.7 }
  };
  const MILK = ['Milk time!', 'Bottle up!', 'Have some milk!', 'Shh, shh, milk!', 'Moo-gic!'];
  const KEYS = { 1: 'fireball', 2: 'kablammo', 3: 'meltdown', 4: 'zap', 5: 'frost', 6: 'splat' };
  const OFFERS = [['Free potions!', 'Ooh, potions?'], ['I found your lost hat!', 'My hat?'], ['Want a cookie?', 'A cookie!'], ['Hugs are free!', 'Aww, a hug?'], ['Magic beans, cheap!', 'Beans?']];
  let S = null, starting = false;
  const load = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); });

  // ---------- what happens to the page ----------
  const H = () => (window.__havoc && window.__havoc.active && window.__havoc.knock) ? window.__havoc : null;
  const someBlock = () => {
    const els = [...document.querySelectorAll('.task .t-title,.card,.ntile,#view h1,.widget,.chip,.wq-it,#side .nav a,img,#qa')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 20 && r.height > 8 && r.top > 40 && r.bottom < innerHeight - 40 && r.left > 0 && r.right < innerWidth; });
    if (!els.length) return { x: rnd(100, innerWidth - 100), y: rnd(100, innerHeight * 0.7) };
    const r = pick(els).getBoundingClientRect(); return { x: r.left + rnd(0.15, 0.85) * r.width, y: r.top + r.height / 2 };
  };
  // a hit on the page. kind: fire | blast | lava | acid | ice | bone | thump
  function impact(x, y, kind = 'fire', power = 1) {
    if (!S) return;
    const fx = S.fx, M = fx && fx.M, h = H(), lv = Math.min(S.round, 6);
    try {
      if (fx) {
        // a splash of oil under the flames, so the fire sits on the page and burns a while
        if (kind === 'fire' || kind === 'blast') { fx.spawn(x, y + 4, M.OIL, 2 + (lv >> 1) + power, 0.5); fx.spawn(x, y, M.FIRE, 3 + lv + power, 0.6, 30, 80); }
        if (kind === 'blast') { fx.explode(x, y, 5 + power * 2 + lv); fx.spawn(x, y, M.EMBER, 4, 0.3); }
        if (kind === 'lava') { fx.spawn(x, y, M.LAVA, 4 + power + (lv >> 1), 0.75); fx.heatAt(x, y, 900, 3); }
        if (kind === 'acid') fx.spawn(x, y, M.ACID, 3 + power, 0.65);
        if (kind === 'ice') { fx.spawn(x, y, M.ICE, 3 + power, 0.6); fx.spawn(x, y - 10, M.SNOW, 4, 0.3); }
        if (kind === 'bone' && Math.random() < 0.3) fx.spawn(x, y, M.ASH, 2, 0.5);
      }
    } catch {}
    if (h) {
      if (kind === 'blast') h.blast(x, y);
      else if (kind === 'lava') { h.melt(x, y); h.knock(x, y, 60, 6); }
      else h.knock(x, y, (kind === 'bone' ? 90 : kind === 'thump' ? 120 : 70) + 12 * lv, (kind === 'bone' ? 16 : 10) + 2 * lv);
    }
    S.hits++;
    const cols = { fire: ['#ffd43b', '#ff922b', '#e8590c'], blast: ['#fff3bf', '#ffa94d', '#f76707', '#495057'], lava: ['#ffa94d', '#f76707', '#d9480f'],
      acid: ['#c0eb75', '#94d82d', '#5c940d'], ice: ['#e7f5ff', '#a5d8ff', '#74c0fc'], bone: ['#f1f3f5', '#ced4da'], thump: ['#adb5bd', '#868e96'] }[kind];
    burst(x, y, 8 + power * 6, cols, 220);
  }
  function shake(n = 1) { S.shake = Math.max(S.shake, 5 * n); }

  // ---------- speech bubbles ----------
  function say(who, text, t = 1.3) {
    if (!S) return;
    for (const b of S.bubbles) if (b.who === who) { b.el.remove(); b.t = 0; }
    const el = document.createElement('div'); el.className = 'hf-say' + (who === S.wiz ? ' wiz' : ''); el.textContent = text;
    S.ui.append(el); S.bubbles.push({ who, el, t, max: t });
  }

  // ---------- bits flying about (pixel squares) ----------
  function burst(x, y, n, cols, sp = 200, g = 320) {
    for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(0.2, 1) * sp; S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.3, life: rnd(0.35, 0.9), col: pick(cols), s: Math.random() < 0.3 ? 2 : 1, g }); }
  }

  // ---------- the wizard ----------
  const G = () => innerHeight - 6;
  function newWizard() { return { x: innerWidth * 0.22, y: G(), vy: 0, vx: 0, face: 1, cd: 1.2, hurt: 0, cast: 0, walk: 0, manual: 0, dir: 0, jumpQ: false, held: null, flying: false, spin: 0, lured: null }; }
  const tip = w => ({ x: w.x + w.face * 18, y: w.y - 88 });
  function wizStep(w, b, dt) {
    w.cd -= dt; w.hurt = Math.max(0, w.hurt - dt); w.cast = Math.max(0, w.cast - dt); w.manual = Math.max(0, w.manual - dt);
    if (w.held) return;  // the skeleton has him
    if (w.flying) {      // thrown: tumbling through the air
      w.vy += 1400 * dt; w.x += w.vx * dt; w.y += w.vy * dt; w.spin += dt * 12 * Math.sign(w.vx || 1);
      if (w.x < 24 || w.x > innerWidth - 24) { w.vx *= -0.5; w.x = clamp(w.x, 24, innerWidth - 24); }
      if (w.y >= G()) { w.y = G(); w.flying = false; w.spin = 0; w.vx = 0; w.vy = 0; w.hurt = 0.9; shake(1.5); impact(w.x, G() - 30, 'thump', 2); say(w, pick(['Oof!', 'My back!', 'Ow ow ow!'])); }
      return;
    }
    let vx = 0;
    if (w.manual > 0) vx = w.dir * 260;
    else if (w.lured) vx = Math.sign(w.lured.x - w.x) * 120;   // off to see what the skeleton's got
    else if (b && b.alive && w.hurt <= 0) {
      const away = b.kind === 'blobby' || b.kind === 'baby' || (b.kind === 'skeleton' && b.mode !== 'offer');
      let want = b.kind === 'blobby' ? (b.x < innerWidth / 2 ? innerWidth - 90 : 90) : clamp(b.x + (w.x < b.x ? -1 : 1) * (away ? 340 : 260), 60, innerWidth - 60);
      if (b.kind === 'graves') {
        // zombies up: keep away from the nearest; none up: go and have a look at a grave (which is how they come out)
        const z = b.nearestUp(w.x), g = b.nearestShut(w.x);
        want = z ? clamp(z.x + (w.x < z.x ? -1 : 1) * 300, 60, innerWidth - 60) : g ? clamp(g.x + (w.x < g.x ? -70 : 70), 40, innerWidth - 40) : w.x;
      }
      if (Math.abs(want - w.x) > 30) vx = Math.sign(want - w.x) * (b.kind === 'blobby' ? 230 : 150);
      const near = S.shots.some(s => s.from === 'boss' && Math.hypot(s.x - w.x, s.y - (w.y - 40)) < 160 && (s.x - w.x) * s.vx < 0) || (b.kind === 'cat' && b.mode === 'swoop' && Math.abs(b.x - w.x) < 150);
      if (near && w.y >= G() - 0.5 && Math.random() < 0.08) w.jumpQ = true;
      if (b.kind === 'blobby' && b.solid && Math.abs(b.x - w.x) < 120 && w.y >= G() - 0.5 && Math.random() < 0.05) w.jumpQ = true;
      if (w.cd <= 0 && !S.banner && b.targetable()) autoCast(w, b);
    }
    if (w.jumpQ && w.y >= G() - 0.5) { w.vy = -580; w.jumpQ = false; }
    w.x = clamp(w.x + vx * dt, 24, innerWidth - 24); if (vx) w.face = Math.sign(vx); else if (b && w.manual <= 0) w.face = Math.sign(b.x - w.x) || 1;
    w.walk += Math.abs(vx) * dt * 0.05;
    w.vy += 1500 * dt; w.y = Math.min(G(), w.y + w.vy * dt); if (w.y >= G()) w.vy = 0;
  }
  function autoCast(w, b) {
    let sp = 'fireball';
    const r = Math.random();
    if (b.kind === 'blobby' && b.solid && b.hp > 2 && r < 0.22) sp = 'splat';
    else if (r < 0.5) sp = 'fireball';
    else sp = pick(['kablammo', 'meltdown', 'zap', 'frost']);
    if (b.kind === 'baby') sp = 'milk';
    if (b.kind === 'clinker' && (sp === 'fireball' || sp === 'meltdown')) sp = r < 0.35 ? 'frost' : pick(['frost', 'zap', 'kablammo']);   // fire only tickles him
    const at = b.aim(); cast(sp, at.x, at.y);
    w.cd = (SPELLS[sp].cd + rnd(0.2, 0.7)) / (1 + 0.06 * (S.round - 1));
  }
  function cast(sp, tx, ty) {
    const w = S.wiz, b = S.boss; if (w.held || w.flying) return;
    if (sp === 'splat' && !(b && b.kind === 'blobby' && b.solid && b.alive)) sp = 'fireball';
    if (b && b.kind === 'baby' && b.alive) sp = 'milk';          // nobody fights a baby
    else if (sp === 'milk') sp = 'fireball';
    w.face = Math.sign(tx - w.x) || w.face; w.cast = 0.35;
    const t = tip(w);
    if (sp === 'milk') { if (Math.random() < 0.45) say(w, pick(MILK), 1.1); }
    else if (sp !== 'fireball' || Math.random() < 0.3) say(w, SPELLS[sp].say, 1.1);
    burst(t.x, t.y, 8, ['#f3d9fa', '#e599f7', '#be4bdb'], 100, 0);
    const a = Math.atan2(ty - t.y, tx - t.x);
    if (sp === 'fireball') S.shots.push({ x: t.x, y: t.y, vx: Math.cos(a) * 580, vy: Math.sin(a) * 580, from: 'wiz', kind: 'fire', r: 7, life: 3 });
    if (sp === 'milk') S.shots.push({ x: t.x, y: t.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, from: 'wiz', kind: 'milk', r: 8, life: 3 });
    if (sp === 'kablammo') S.shots.push({ x: t.x, y: t.y, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330, from: 'wiz', kind: 'kablammo', r: 13, life: 4 });
    if (sp === 'frost') for (let i = -1; i <= 1; i++) S.shots.push({ x: t.x, y: t.y, vx: Math.cos(a + i * 0.12) * 620, vy: Math.sin(a + i * 0.12) * 620, from: 'wiz', kind: 'ice', r: 5, life: 3 });
    if (sp === 'meltdown') {
      // a beam: straight to the target; the page along it melts
      S.beams.push({ x0: t.x, y0: t.y, x1: tx, y1: ty, t: 0.45, col: '#ff922b' });
      for (let i = 1; i <= 3; i++) { const k = i / 4; setTimeout(() => S && impact(t.x + (tx - t.x) * k + rnd(-20, 20), t.y + (ty - t.y) * k + rnd(-20, 20), 'lava', 1), i * 80); }
      const hitT = b && b.alive && b.targetable() && b.hitTest(tx, ty, 40); if (hitT) hitBoss(b, tx, ty, 1, hitT);
    }
    if (sp === 'zap') {
      const x = tx, y = ty; S.beams.push({ zig: true, x0: x + rnd(-40, 40), y0: -10, x1: x, y1: y, t: 0.35, col: '#e5dbff' });
      try { S.fx && S.fx.strike(x, Math.max(10, y - 40)); } catch {}
      shake(1);
      const hitT = b && b.alive && b.targetable() && b.hitTest(tx, ty, 50); if (hitT) hitBoss(b, x, y, 1, hitT); else impact(x, y, 'fire', 2);
    }
    if (sp === 'splat') { b.splat(); hitBoss(b, b.x, b.aimY(), 2); }
  }
  function hurtWizard(w, from, knock = 60) {
    if (w.hurt > 0 || w.held || w.flying) return false;
    w.hurt = 0.9; w.vy = -320; w.x = clamp(w.x + (w.x < from ? -knock : knock), 24, innerWidth - 24);
    burst(w.x, w.y - 40, 14, ['#ffffff', '#d0bfff', '#b197fc'], 180); shake(0.6);
    if (Math.random() < 0.35) say(w, pick(['Ouch!', 'Hey!', 'Rude!', 'Oof!']));
    return true;
  }

  // ---------- the bosses ----------
  function newBoss(kind) {
    const lv = S.round, hp = Math.round(irnd(...HITS[kind]) * (1 + 0.25 * Math.floor((lv - 1) / 4)));
    const side = Math.random() < 0.5 ? -1 : 1;
    const b = { kind, hp, max: hp, alive: true, t: 0, flash: 0, vx: 0, vy: 0, face: -side, cd: rnd(1.4, 2.2), speed: 1 + 0.15 * Math.floor((lv - 1) / 4), dying: 0, frozen: 0,
      targetable() { return this.alive && (this.kind !== 'blobby' || this.solid); },
      aimY() { return this.kind === 'blobby' || this.kind === 'baby' ? this.y - this.R : this.kind === 'skeleton' ? this.y - 50 : this.y; },
      hitTest(x, y, r) { return Math.hypot(x - this.x, y - this.aimY()) < this.R + r ? this : null; },   // what a shot at x, y hits
      aim() { return { x: this.x + this.vx * 0.3, y: this.aimY() }; } };
    if (kind === 'dragon') Object.assign(b, { x: side < 0 ? -170 : innerWidth + 170, y: innerHeight * 0.22, R: 58, home: innerHeight * rnd(0.16, 0.28), breath: 0 });
    if (kind === 'cat') Object.assign(b, { x: side < 0 ? -80 : innerWidth + 80, y: innerHeight * 0.3, R: 28, mode: 'fly', mt: rnd(2.5, 4) });
    if (kind === 'blobby') Object.assign(b, { x: side < 0 ? -70 : innerWidth + 70, y: G(), R: 42, squash: 0, grounded: true, hopT: 0.6, solid: true,
      splat() { this.solid = false; this.reform = 2.6; this.backBy = performance.now() + 5200; const R = this.R;   // back by then in real time, however slow the frames
        for (let i = 0; i < 26; i++) { const a = rnd(Math.PI, TAU), v = rnd(250, 560); S.jelly.push({ x: this.x + rnd(-R, R), y: this.y - rnd(0, 2 * R), vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: irnd(6, 14), home: false }); }
        for (let i = 0; i < 6; i++) setTimeout(() => S && impact(this.x + rnd(-200, 200), this.y - rnd(40, 300), 'acid', 1), i * 90);
        shake(1.5); } });
    if (kind === 'skeleton') Object.assign(b, { x: side < 0 ? -60 : innerWidth + 60, y: G(), R: 30, mode: 'walk', mt: rnd(2, 3.5), arm: 0, walk: 0 });
    if (kind === 'baby') Object.assign(b, { x: clamp(S.wiz.x < innerWidth / 2 ? innerWidth * 0.68 : innerWidth * 0.32, 120, innerWidth - 120), y: -180, R: 62, landed: false, wail: 1.2, tear: 0, cd: rnd(2.5, 3.5) });
    if (kind === 'graves') {
      // the zombies: one per grave, spread along the floor, away from where the wizard's standing
      const n = hp, xs = [];
      for (let i = 0; i < n * 8 && xs.length < n; i++) { const x = rnd(70, innerWidth - 70); if (Math.abs(x - S.wiz.x) > 150 && xs.every(o => Math.abs(o - x) > 90)) xs.push(x); }
      while (xs.length < n) xs.push(rnd(70, innerWidth - 70));
      Object.assign(b, { x: innerWidth / 2, y: G(), R: 26, quiet: 0,
        graves: xs.sort((p, q) => p - q).map(x => ({ x, st: 'shut', t: 0, zx: x, hp: S.round > 7 ? 2 : 1, walk: 0, flash: 0, face: 1, rise: 0, groan: rnd(2, 5) })),
        up() { return this.graves.filter(g => g.st === 'rise' || g.st === 'walk'); },
        nearestUp(x) { return this.up().sort((p, q) => Math.abs(p.zx - x) - Math.abs(q.zx - x))[0] || null; },
        nearestShut(x) { return this.graves.filter(g => g.st === 'shut').sort((p, q) => Math.abs(p.x - x) - Math.abs(q.x - x))[0] || null; },
        open(g) { g.st = 'hand'; g.t = 0.9; burst(g.x, G() - 6, 10, ['#5c3d2e', '#7f5539', '#495057'], 140); },
        targetable() { return this.alive && this.up().length > 0; },
        aimY() { return G() - 44; },
        hitTest(x, y, r) { return this.up().find(g => Math.hypot(x - g.zx, y - (G() - 44 + (1 - g.rise) * 40)) < 24 + r) || null; },
        aim() { const z = this.nearestUp(S.wiz.x); return z ? { x: z.zx + Math.sign(S.wiz.x - z.zx) * 10, y: G() - 44 } : { x: this.x, y: G() - 44 }; } });
    }
    if (kind === 'clinker') Object.assign(b, { x: side < 0 ? -90 : innerWidth + 90, y: innerHeight * 0.4, R: 60, home: innerHeight * rnd(0.32, 0.45), mode: 'float', mt: 0, puff: 0 });
    return b;
  }
  const mouth = b => ({ x: b.x + b.face * 84, y: b.y - 20 });
  function bossStep(b, w, dt) {
    b.t += dt; b.flash = Math.max(0, b.flash - dt); b.frozen = Math.max(0, b.frozen - dt);
    const sp = b.speed * (b.frozen > 0 ? 0.25 : 1); b.cd -= dt * sp;
    if (!b.alive) { b.dying += dt; if (b.kind === 'baby' || b.kind === 'graves') return; b.vy += 900 * dt; b.y += b.vy * dt; b.x += b.vx * dt; return; }
    const fdt = dt * (b.frozen > 0 ? 0.25 : 1);
    if (b.kind === 'dragon') {
      const cx = innerWidth / 2 + Math.sin(b.t * 0.35 * b.speed) * innerWidth * 0.36, cy = b.home + Math.sin(b.t * 0.9 * b.speed) * 50;
      b.vx = (cx - b.x) * 1.6; b.vy = (cy - b.y) * 1.6; b.x += b.vx * fdt; b.y += b.vy * fdt; b.face = w.x < b.x ? -1 : 1;
      b.breath = Math.max(0, b.breath - dt);
      if (b.cd <= 0 && !S.banner && b.x > 40 && b.x < innerWidth - 40) {
        b.breath = 0.6; const n = irnd(1, 2 + Math.min(S.round, 3)), lava = Math.random() < 0.25;
        for (let i = 0; i < n; i++) setTimeout(() => { if (!S || !b.alive) return; const m = mouth(b), page = Math.random() < 0.5 ? someBlock() : null;
          const tx = page ? page.x : w.x + rnd(-40, 40), ty = page ? page.y : w.y - 30, a = Math.atan2(ty - m.y, tx - m.x), v = 320 * b.speed;
          S.shots.push({ x: m.x, y: m.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, from: 'boss', kind: lava ? 'lava' : 'fire', r: 9, life: 4, target: page });
          burst(m.x, m.y, 8, ['#ffd43b', '#ff922b', '#e8590c'], 140, 0); }, i * 220);
        b.cd = rnd(1.4, 2.4);
      }
    } else if (b.kind === 'cat') {
      b.mt -= fdt;
      if (b.mode === 'fly') {
        const cx = innerWidth / 2 + Math.sin(b.t * 0.7) * innerWidth * 0.38 + Math.sin(b.t * 2.3) * 60, cy = innerHeight * 0.28 + Math.sin(b.t * 1.7) * innerHeight * 0.12;
        b.vx = (cx - b.x) * 2; b.vy = (cy - b.y) * 2;
        if (Math.random() < dt * 0.5 * Math.min(S.round, 4)) { const p = someBlock(); if (Math.hypot(p.x - b.x, p.y - b.y) < 300) { S.claws.push({ x: p.x, y: p.y, t: 0.5 }); impact(p.x, p.y, 'thump', 1); } }
        if (b.mt <= 0 && !S.banner) { b.mode = 'swoop'; b.mt = 1.6; b.sx = w.x; b.sy = w.y - 44; b.biting = Math.random() < 0.6; }
      } else if (b.mode === 'swoop') {
        const a = Math.atan2(b.sy - b.y, b.sx - b.x); b.vx = Math.cos(a) * 520 * b.speed; b.vy = Math.sin(a) * 520 * b.speed;
        if (Math.hypot(b.sx - b.x, b.sy - b.y) < 30 || b.mt <= 0) { b.mode = 'up'; b.mt = 1; }
      } else if (b.mode === 'bite') {
        // latched on: a few gulps, then off
        b.x = w.x + b.face * -14; b.y = w.y - 62; b.vx = 0; b.vy = 0;
        if (b.mt <= 0) { b.mode = 'up'; b.mt = 1; w.hurt = 0.6; }
      } else { b.vy = -380; b.vx *= 0.96; if (b.mt <= 0 || b.y < innerHeight * 0.25) { b.mode = 'fly'; b.mt = rnd(2.2, 3.8) / b.speed; } }
      if (b.mode !== 'bite') { b.x += b.vx * fdt; b.y += b.vy * fdt; b.face = b.vx < 0 ? -1 : 1; }
      if (b.mode === 'swoop' && Math.hypot(b.x - w.x, b.y - (w.y - 44)) < b.R + 24 && !w.held && !w.flying) {
        if (b.biting && w.hurt <= 0) { b.mode = 'bite'; b.mt = 1.2; w.hurt = 1.4; b.hp = Math.min(b.max, b.hp + 1); say(b, pick(['Nom nom!', 'Slurp!', 'Mmm, wizard!'])); setTimeout(() => S && say(S.wiz, pick(['Get off!', 'Not the neck!', 'Bad kitty!'])), 450);
          for (let i = 0; i < 4; i++) setTimeout(() => S && burst(w.x, w.y - 60, 6, ['#e599f7', '#cc5de8', '#ffffff'], 90), i * 250); }
        else if (hurtWizard(w, b.x)) { b.mode = 'up'; b.mt = 1; }
      }
    } else if (b.kind === 'blobby') {
      if (!b.solid) {   // in bits: pulls himself back together
        b.reform -= dt;
        // back together once the bits are home, or after 2.5 s of pulling whatever's left (slow devices never quite settle)
        if (b.reform <= 0 || performance.now() > b.backBy - 2500) { for (const j of S.jelly) j.home = true; if (b.reform < -2.5 || performance.now() > b.backBy || S.jelly.every(j => Math.hypot(j.x - b.x, j.y - (b.y - b.R)) < 14)) { S.jelly = []; b.solid = true; b.squash = 0.5; say(b, pick(['Blorp!', 'Still here!', 'Glorp.'])); } }
        return;
      }
      b.hopT -= fdt;
      if (b.grounded && b.hopT <= 0 && !S.banner) { b.vy = -rnd(380, 560); b.vx = Math.sign(w.x - b.x) * rnd(160, 240) * b.speed; b.grounded = false; b.squash = -0.3; }
      if (!b.grounded) { b.vy += 1300 * fdt; b.x += b.vx * fdt; b.y += b.vy * fdt;
        if (b.y >= G()) { b.y = G(); b.grounded = true; b.vx = 0; b.squash = 0.45; b.hopT = rnd(0.35, 0.9); shake(0.5 + 0.15 * Math.min(S.round, 5));
          impact(clamp(b.x + rnd(-40, 40), 10, innerWidth - 10), G() - rnd(10, 90), S.round >= 2 && Math.random() < 0.5 ? 'acid' : 'thump', 1); } }
      b.squash *= Math.pow(0.02, dt); b.face = w.x < b.x ? -1 : 1;
      if (Math.abs(b.x - w.x) < b.R + 12 && w.y > G() - b.R * 2) hurtWizard(w, b.x);
      b.x = clamp(b.x, -100, innerWidth + 100);
    } else if (b.kind === 'skeleton') {
      b.mt -= fdt; b.arm = Math.max(0, b.arm - dt);
      if (b.mode === 'walk') {
        const want = clamp(w.x + (b.x > w.x ? 1 : -1) * 320, 60, innerWidth - 60);
        b.vx = Math.abs(want - b.x) > 20 ? Math.sign(want - b.x) * 110 * b.speed : 0; b.x += b.vx * fdt; b.walk += Math.abs(b.vx) * fdt * 0.05; b.face = w.x < b.x ? -1 : 1;
        if (b.cd <= 0 && !S.banner && b.x > 30 && b.x < innerWidth - 30) {
          // throw a bone or two: at the wizard, or at the page
          const n = irnd(1, Math.min(3, 1 + Math.ceil(S.round / 3)));
          for (let i = 0; i < n; i++) setTimeout(() => { if (!S || !b.alive || b.mode !== 'walk') return; b.arm = 0.3;
            const page = Math.random() < 0.55 ? someBlock() : null, tx = page ? page.x : w.x, ty = page ? page.y : w.y - 40, hx = b.x + b.face * 16, hy = b.y - 70;
            const T = clamp(Math.hypot(tx - hx, ty - hy) / 520, 0.45, 1.3), vx = (tx - hx) / T, vy = (ty - hy) / T - 0.5 * 700 * T;
            S.shots.push({ x: hx, y: hy, vx, vy, g: 700, from: 'boss', kind: 'bone', r: 9, life: 4, spin: rnd(10, 16) * (Math.random() < 0.5 ? -1 : 1), a: 0, target: page }); }, i * 300);
          b.cd = rnd(1.5, 2.6);
        }
        if (b.mt <= 0 && !S.banner && !w.flying && w.hurt <= 0) {
          // the trick: something nice on offer
          b.mode = 'offer'; b.mt = 5; b.vx = 0; const o = pick(OFFERS); b.offer = o; say(b, o[0], 2.2);
          setTimeout(() => { if (S && b.mode === 'offer') { say(w, o[1], 1.4); w.lured = b; } }, 700);
        }
      } else if (b.mode === 'offer') {
        b.face = w.x < b.x ? -1 : 1;
        if (w.lured === b && Math.abs(w.x - b.x) < 46 && w.y >= G() - 1) {
          b.mode = 'grab'; b.mt = 1.5; w.lured = null; w.held = b; w.cast = 0; say(b, pick(['Gotcha!', 'Hehehe!', 'Psych!']), 1.2); setTimeout(() => S && say(w, pick(['Hey!', 'Put me down!', 'Not again!']), 1.2), 300);
        } else if (b.mt <= 0) { b.mode = 'walk'; b.mt = rnd(4, 6); if (w.lured === b) w.lured = null; }
      } else if (b.mode === 'grab') {
        // shaking him up and down
        const sh = Math.sin(b.t * 28) * 22; w.x = b.x + b.face * 22; w.y = b.y - 36 + sh; w.face = -b.face;
        if (Math.random() < dt * 10) burst(w.x, w.y - 40, 3, ['#ffd43b', '#e599f7'], 120);
        if (b.mt <= 0) {
          // and up he goes
          b.mode = 'walk'; b.mt = rnd(5, 8); w.held = null; w.flying = true; w.vy = -rnd(900, 1150); w.vx = b.face * rnd(120, 260); w.hurt = 0;
          say(b, pick(['Bye bye!', 'Wheee!', 'Up you go!']), 1.2); setTimeout(() => S && say(w, 'Aaaaah!', 1.4), 150); shake(1);
        }
      }
    } else if (b.kind === 'baby') {
      if (!b.landed) {   // drops in from above
        b.vy += 1500 * dt; b.y += b.vy * dt;
        if (b.y >= G()) { b.y = G(); b.vy = 0; b.landed = true; shake(2.2); impact(b.x - 50, G() - 20, 'thump', 2); impact(b.x + 50, G() - 20, 'thump', 2); say(b, 'Waaah?', 1.2); }
        return;
      }
      const cry = Math.max(0, b.hp / b.max);
      b.face = w.x < b.x ? -1 : 1;
      // tears: real water onto the page, more the harder he cries
      b.tear -= dt;
      if (b.tear <= 0 && cry > 0) {
        b.tear = 0.5 - 0.3 * cry;
        for (const ex of [-22, 22]) { const x = b.x + ex, y = b.y - b.R * 1.45;
          for (let i = 0; i < 3; i++) S.parts.push({ x, y, vx: ex * rnd(2, 5) + rnd(-20, 20), vy: rnd(-160, -60), life: rnd(0.6, 1.1), col: pick(['#74c0fc', '#a5d8ff', '#d0ebff']), s: 2, g: 700 });
          try { if (S.fx) S.fx.spawn(clamp(x + ex * 3, 10, innerWidth - 10), clamp(y - 40, 20, innerHeight - 40), S.fx.M.WATER, 1 + Math.round(cry * 2), 0.5); } catch {} }
      }
      // WAAAH: a ring that knocks the words about, and the wizard if he's close
      b.wail -= fdt;
      if (b.wail <= 0 && !S.banner) {
        b.wail = rnd(2.2, 3.4) / (0.6 + cry); b.wailing = 0.9;
        say(b, pick(['WAAAAH!', 'WAAAH!', 'MAMAAA!', 'BWAAAH!', 'WAH WAH WAH!']), 1.3);
        S.rings.push({ x: b.x, y: b.y - b.R * 1.3, r: 30, t: 0.9 }); shake(0.6 + cry);
        for (let i = 0; i < 6; i++) { const a = rnd(Math.PI * 1.05, Math.PI * 1.95), d = rnd(120, 340); setTimeout(() => S && impact(clamp(b.x + Math.cos(a) * d, 10, innerWidth - 10), clamp(b.y - b.R + Math.sin(a) * d, 30, innerHeight - 30), 'thump', 1), 80 + i * 70); }
        if (Math.abs(w.x - b.x) < 230) hurtWizard(w, b.x, 110);
      }
      b.wailing = Math.max(0, (b.wailing || 0) - dt);
      // the rattle, thrown
      if (b.cd <= 0 && !S.banner) {
        const hx = b.x + b.face * 40, hy = b.y - b.R * 1.2, T = clamp(Math.abs(w.x - hx) / 480, 0.5, 1.2), vx = (w.x - hx) / T, vy = (w.y - 40 - hy) / T - 0.5 * 700 * T;
        S.shots.push({ x: hx, y: hy, vx, vy, g: 700, from: 'boss', kind: 'rattle', r: 10, life: 4, spin: rnd(9, 14), a: 0 });
        b.cd = rnd(2.4, 3.6) / (0.7 + 0.6 * cry);
      }
      // a slow scoot towards the wizard while upset
      if (cry > 0.4) b.x = clamp(b.x + Math.sign(w.x - b.x) * 18 * cry * fdt, 80, innerWidth - 80);
      if (Math.abs(b.x - w.x) < b.R && w.y > G() - b.R * 1.6) hurtWizard(w, b.x);
    } else if (b.kind === 'graves') {
      b.quiet += dt;
      for (const g of b.graves) {
        g.flash = Math.max(0, g.flash - dt);
        if (g.st === 'shut') {
          // the wizard comes near: a hand comes up. (Or, after a long quiet spell with nothing up, one stirs by itself.)
          if (!S.banner && (Math.abs(w.x - g.x) < 150 || (b.quiet > 6 && !b.up().length && g === b.nearestShut(w.x)))) { b.open(g); b.quiet = 0; }
        } else if (g.st === 'hand') {
          g.t -= fdt; if (Math.random() < dt * 6) burst(g.x, G() - 4, 2, ['#5c3d2e', '#7f5539'], 80);
          if (g.t <= 0) { g.st = 'rise'; g.rise = 0; g.zx = g.x + 22; if (Math.random() < 0.6) say(b, pick(['Braaains…', 'Uuurgh…', 'Mmmnnh…', 'Hrrrrr…']), 1.4); }
        } else if (g.st === 'rise') {
          g.rise = Math.min(1, g.rise + fdt / 1.3); if (Math.random() < dt * 8) burst(g.x, G() - 4, 2, ['#5c3d2e', '#7f5539'], 100);
          if (g.rise >= 1) g.st = 'walk';
        } else if (g.st === 'walk') {
          // a slow shuffle after him, arms out
          const v = Math.sign(w.x - g.zx) * (34 + 4 * Math.min(S.round, 8)) * b.speed; g.zx = clamp(g.zx + v * fdt, 20, innerWidth - 20); g.walk += Math.abs(v) * fdt * 0.05; g.face = Math.sign(v) || g.face;
          g.groan -= dt; if (g.groan <= 0) { g.groan = rnd(4, 8); if (Math.random() < 0.4) { b.x = g.zx; say(b, pick(['Braaains…', 'Uuurgh…', 'Waaait…', 'Hnnngh…']), 1.2); } }
          if (Math.abs(g.zx - w.x) < 26 && w.y > G() - 80 && hurtWizard(w, g.zx, 80)) say(b, pick(['Nom?', 'Gotcha… almost…', 'Hrrgh!']), 1);
        }
      }
      // bubbles and the wizard's eyes follow the nearest one that's up
      const z = b.nearestUp(w.x); if (z) b.x = z.zx;
    } else if (b.kind === 'clinker') {
      b.mt -= fdt; b.puff = Math.max(0, b.puff - dt);
      if (b.mode === 'float') {
        const cx = innerWidth / 2 + Math.sin(b.t * 0.45 * b.speed) * innerWidth * 0.34, cy = b.home + Math.sin(b.t * 1.3) * 34;
        b.vx = (cx - b.x) * 1.4; b.vy = (cy - b.y) * 1.4; b.x += b.vx * fdt; b.y += b.vy * fdt; b.face = w.x < b.x ? -1 : 1;
        if (b.cd <= 0 && !S.banner && b.x > 40 && b.x < innerWidth - 40) {
          const r = Math.random();
          if (r < 0.5) {   // a spray of sparks, at him and at the page
            b.puff = 0.5; say(b, pick(['Crackle!', 'Have some sparks!', 'Pop pop!', 'Hot hot hot!']), 1.1);
            const n = 5 + Math.min(S.round, 5);
            for (let i = 0; i < n; i++) setTimeout(() => { if (!S || !b.alive) return; const page = Math.random() < 0.45 ? someBlock() : null, tx = page ? page.x : w.x + rnd(-80, 80), ty = page ? page.y : w.y - 30;
              const a = Math.atan2(ty - b.y, tx - b.x) + rnd(-0.15, 0.15), v = 300 * b.speed; S.shots.push({ x: b.x, y: b.y - 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v, from: 'boss', kind: 'fire', r: 6, life: 4, target: page }); }, i * 90);
          } else if (r < 0.8) {   // down to the floor, and fire runs along it both ways
            b.mode = 'dive'; say(b, pick(['Floor’s lava!', 'Hot feet!', 'Watch your toes!']), 1.2);
          } else {   // turns up the heat: the page under him starts to melt
            b.puff = 1; say(b, pick(['Feel the heat!', 'Turning it up!', 'Toasty!']), 1.2);
            try { if (S.fx) { S.fx.heatAt(b.x, b.y + 40, 800, 4); S.fx.spawn(b.x, b.y + 30, S.fx.M.EMBER, 5, 0.5); } } catch {}
            impact(clamp(b.x + rnd(-60, 60), 10, innerWidth - 10), clamp(b.y + rnd(60, 160), 30, innerHeight - 30), 'lava', 1);
          }
          b.cd = rnd(1.6, 2.6);
        }
      } else if (b.mode === 'dive') {
        b.vy = 620 * b.speed; b.vx *= 0.9; b.y += b.vy * fdt; b.x += b.vx * fdt;
        if (b.y >= G() - b.R) {
          b.y = G() - b.R; b.mode = 'rise'; b.mt = 0.8; shake(1.4); impact(b.x, G() - 20, 'blast', 1);
          for (const dir of [-1, 1]) for (let i = 1; i <= 7; i++) setTimeout(() => { if (!S) return; const x = b.x + dir * i * 70; if (x < 10 || x > innerWidth - 10) return; impact(x, G() - rnd(8, 30), 'fire', 1);
            if (Math.abs(S.wiz.x - x) < 36 && S.wiz.y > G() - 30) hurtWizard(S.wiz, x); }, i * 110);
        }
      } else if (b.mode === 'rise') { b.y -= 260 * fdt; if (b.mt <= 0 || b.y < b.home) b.mode = 'float'; }
      if (b.mode !== 'float' && Math.hypot(b.x - w.x, b.y - (w.y - 44)) < b.R + 20) hurtWizard(w, b.x);
      if (Math.random() < dt * 14) S.parts.push({ x: b.x + rnd(-b.R * 0.6, b.R * 0.6), y: b.y - b.R * 0.8, vx: rnd(-20, 20), vy: rnd(-120, -40), life: rnd(0.3, 0.7), col: pick(['#ffd43b', '#ff922b', '#fff3bf']), s: 1, g: -40 });
    }
  }
  function hitBoss(b, x, y, dmg = 1, target = null) {
    if (!b.alive) return;
    if (b.kind === 'graves') {
      // one zombie at a time; the bar is how many are left
      let z = target && target !== b ? target : b.nearestUp(S.wiz.x);
      if (!z) { z = b.nearestShut(S.wiz.x); if (!z) return; z.st = 'walk'; z.rise = 1; }
      z.hp -= dmg; z.flash = 0.15; burst(x, y, 10, ['#f3d9fa', '#e599f7', '#be4bdb'], 200);
      if (z.hp <= 0) {
        z.st = 'gone'; b.hp -= 1; burst(z.zx, G() - 40, 26, ['#8ce99a', '#5c940d', '#868e96', '#7f5539'], 260); impact(z.zx, G() - rnd(10, 40), 'thump', 1);
        if (b.hp > 0 && Math.random() < 0.5) say(S.wiz, pick(['Back to bed!', 'Rest in pieces!', 'Shoo!', 'Next!']), 1);
        if (b.hp <= 0) down(b);
      }
      return;
    }
    if (b.kind === 'baby') {
      // milk: a little less crying each time
      b.hp -= dmg; b.flash = 0.12; burst(x, y, 14, ['#ffffff', '#f8f9fa', '#e9ecef'], 200);
      if (b.hp > 0 && Math.random() < 0.5) say(b, pick(['*hic*', '…waah?', '*sniff*', 'Mmm…', '*gulp gulp*']), 1);
      b.wail = Math.max(b.wail, 1.2);
      if (b.hp <= 0) down(b);
      return;
    }
    b.hp -= dmg; b.flash = 0.15; burst(x, y, 12, ['#f3d9fa', '#e599f7', '#be4bdb', '#ffffff'], 220);
    if (b.kind === 'clinker') b.R = Math.max(28, b.R - 1.5);   // a little smaller each time he's put out a bit
    if (b.kind === 'blobby') b.R = Math.max(26, b.R - 1);
    if (b.kind === 'cat' && (b.mode === 'swoop' || b.mode === 'bite')) { b.mode = 'up'; b.mt = 1; }
    if (b.kind === 'skeleton' && b.mode === 'grab') { const w = S.wiz; w.held = null; w.flying = true; w.vy = -500; w.vx = -b.face * 150; b.mode = 'walk'; b.mt = rnd(4, 7); }
    if (b.hp <= 0) down(b);
  }
  function down(b) {
    b.alive = false; b.vy = -260; b.vx = rnd(-80, 80); S.beaten++;
    const w = S.wiz; if (w.held) { w.held = null; w.flying = true; w.vy = -300; } w.lured = null;
    if (b.kind === 'baby') {
      // asleep: no explosions for a baby
      b.vy = 0; b.vx = 0; S.shots = S.shots.filter(x => x.from !== 'boss'); say(b, 'Zzz…', 2.4); setTimeout(() => S && say(w, pick(['Phew. Asleep.', 'Shh…', 'Nap time.']), 1.6), 600);
      for (let i = 0; i < 5; i++) setTimeout(() => S && S.zs.push({ x: b.x + 30, y: b.y - b.R * 1.8, t: 1.6, s: 1 + i % 2 }), i * 380);
      setTimeout(() => nextRound(), 2600);
      return;
    }
    shake(2);
    if (b.kind === 'clinker') { say(b, pick(['Pfffft…', 'Fine, I’m out.', 'Fizzle…']), 1.6); try { if (S.fx) S.fx.spawn(b.x, b.y, S.fx.M.STEAM, 6, 0.5); } catch {} }
    if (b.kind === 'graves') say(w, 'Quiet again.', 1.4);
    if (b.kind === 'blobby') { S.jelly = []; for (let i = 0; i < 8; i++) setTimeout(() => S && impact(b.x + rnd(-120, 120), G() - rnd(20, 200), 'acid', 2), i * 80); }
    if (b.kind === 'skeleton') for (let i = 0; i < 16; i++) S.bones.push({ x: b.x + rnd(-20, 20), y: b.y - rnd(10, 100), vx: rnd(-260, 260), vy: rnd(-520, -150), a: rnd(0, TAU), va: rnd(-12, 12), skull: i === 0 });
    burst(b.x, b.y - 20, 50, { dragon: ['#2f9e44', '#ffd43b', '#ff922b'], cat: ['#343a40', '#7048e8', '#e599f7'], blobby: ['#b2f2bb', '#69db7c', '#d3f9d8'], skeleton: ['#f1f3f5', '#ced4da'],
      graves: ['#868e96', '#adb5bd', '#5c3d2e'], clinker: ['#ffd43b', '#ff922b', '#495057', '#212529'] }[b.kind], 420);
    // going down takes a chunk of the page with it
    for (let i = 0; i < 2 + Math.min(S.round, 5); i++) setTimeout(() => S && impact(clamp(b.x + rnd(-240, 240), 10, innerWidth - 10), clamp(b.y + rnd(-200, 120), 20, innerHeight - 20), i < 1 + (S.round >> 1) ? 'blast' : 'fire', 1), 150 + i * 140);
    setTimeout(() => nextRound(), 1500);
  }
  function nextRound(kind) { if (!S) return; S.round++; const k = kind || BOSSES[(S.round - 1) % BOSSES.length]; banner(`Round ${S.round}: ${NAME[k]}${S.round > BOSSES.length ? ', angrier' : ''}`); S.zs = []; S.rings = []; S.boss = newBoss(k); }
  function banner(text) { S.banner = { t: 1.8 }; S.bannerEl.textContent = text; S.bannerEl.classList.remove('on'); void S.bannerEl.offsetWidth; S.bannerEl.classList.add('on'); }

  // ---------- pixel drawing ----------
  // Sprites are drawn as flat shapes into a small canvas (one cell = PX screen pixels), then snapped to hard pixels with a
  // dark outline, and scaled up without smoothing. Effects (fireballs, sparks) go in a second small canvas as plain squares.
  const OUT = [28, 20, 38];
  function pixelize(c, w, h) {
    const img = c.getImageData(0, 0, w, h), d = img.data, n = w * h;
    if (!S.op || S.op.length !== n) S.op = new Uint8Array(n); const op = S.op;
    for (let i = 0; i < n; i++) { if (d[i * 4 + 3] >= 110) { op[i] = 1; d[i * 4 + 3] = 255; } else op[i] = 0; }
    for (let y = 0; y < h; y++) for (let x = 0, i = y * w; x < w; x++, i++) {
      if (op[i]) continue; const j = i * 4;
      if ((x > 0 && op[i - 1]) || (x < w - 1 && op[i + 1]) || (y > 0 && op[i - w]) || (y < h - 1 && op[i + w])) { d[j] = OUT[0]; d[j + 1] = OUT[1]; d[j + 2] = OUT[2]; d[j + 3] = 255; } else d[j + 3] = 0;
    }
    c.putImageData(img, 0, 0);
  }
  const R_ = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const P_ = (c, pts, col) => { c.fillStyle = col; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); };
  const E_ = (c, x, y, rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); };
  function drawWizard(c, w) {
    c.save(); c.translate(w.x, w.y);
    if (w.spin) { c.translate(0, -45); c.rotate(w.spin); c.translate(0, 45); }
    c.scale(w.face, 1);
    if (w.hurt > 0 && !w.held && Math.floor(w.hurt * 14) % 2) c.globalAlpha = 0.5;
    const air = w.y < G() - 1 || w.held, st = air ? 0 : Math.round(Math.sin(w.walk * 6) * 3), cast = w.cast > 0;
    R_(c, -12 + st, -7, 9, 7, '#3b2416'); R_(c, 3 - st, -7, 9, 7, '#3b2416');                                  // boots
    P_(c, [[-12, -46], [12, -46], [17, -6], [-17, -6]], '#6741d9');                                                  // robe
    P_(c, [[4, -46], [12, -46], [17, -6], [8, -6]], '#5530b5');
    R_(c, -17, -10, 34, 4, '#4527a0');
    for (const [x, y] of [[-8, -28], [4, -19], [-4, -15], [8, -36]]) R_(c, x, y, 3, 3, '#ffd43b');                 // stars
    R_(c, -13, -32, 26, 4, '#f59f00');                                                                               // belt
    P_(c, [[-9, -52], [9, -52], [5, -33], [0, -28], [-5, -33]], '#f1f3f5');                                          // beard
    R_(c, -8, -62, 16, 11, '#f4c7a1'); R_(c, 2, -59, 3, 3, '#1b1b1b'); R_(c, 7, -56, 3, 3, '#e8a87c');               // face
    R_(c, -16, -66, 32, 5, '#5f3dc4');                                                                               // hat
    P_(c, [[-11, -65], [11, -65], [4, -82], [-7, -96]], '#7048e8'); R_(c, -3, -78, 4, 4, '#ffd43b');
    // staff and arm (up when casting)
    const ay = cast ? -62 : -44;
    R_(c, 15, -86 + (cast ? -6 : 0), 4, 80, '#8b5a2b');
    P_(c, [[4, -44], [9, -46], [17, ay - 2], [14, ay + 4]], '#5f3dc4'); R_(c, 13, ay - 3, 6, 6, '#f4c7a1');
    E_(c, 17, -90 + (cast ? -6 : 0), cast ? 9 : 6, cast ? 9 : 6, cast ? '#e599f7' : '#9775fa'); R_(c, 15, -92 + (cast ? -6 : 0), 3, 3, '#f8f0fc');
    c.restore();
  }
  function drawDragon(c, b) {
    c.save(); c.translate(b.x, b.y); c.scale(b.face, 1); if (!b.alive) c.rotate(b.dying * 2);
    const f = b.flash > 0, fr = b.frozen > 0, flap = Math.sin(b.t * 7);
    const body = f ? '#f8f9fa' : fr ? '#a5d8ff' : '#2f9e44', dark = f ? '#e9ecef' : fr ? '#74c0fc' : '#1e7b34', belly = f ? '#fff' : fr ? '#e7f5ff' : '#b2f2bb', wingC = fr ? '#99e9f2' : '#40c057';
    const wing = (dy, k, col) => { const y = -20 + dy, tipY = y - 60 * k; P_(c, [[-10, y], [30, y], [66, tipY + 10], [40, tipY + 30], [22, tipY + 34], [6, tipY + 40]], col); };
    wing(0, 0.4 + flap * 0.6, dark);
    P_(c, [[-40, -10], [-80, 0], [-118, -6 + Math.sin(b.t * 3) * 12], [-80, 10], [-40, 12]], body);              // tail
    P_(c, [[-118, -6 + Math.sin(b.t * 3) * 12], [-136, -18 + Math.sin(b.t * 3) * 12], [-130, 2 + Math.sin(b.t * 3) * 12]], dark);
    R_(c, -26, 18, 12, 16, dark); R_(c, 14, 18, 12, 16, dark); R_(c, -28, 32, 6, 4, '#f1f3f5'); R_(c, 12, 32, 6, 4, '#f1f3f5'); // legs, claws
    E_(c, 0, 0, 50, 27, body); E_(c, 8, 10, 34, 13, belly);
    for (let i = -3; i <= 3; i++) P_(c, [[i * 13 - 6, -24 + Math.abs(i) * 2], [i * 13, -36 + Math.abs(i) * 2], [i * 13 + 6, -24 + Math.abs(i) * 2]], dark);
    P_(c, [[30, -18], [56, -40], [70, -34], [46, -4]], body);                                                      // neck
    R_(c, 56, -50, 34, 22, body); R_(c, 84, -42, 20, 14, body);                                                     // head, snout
    P_(c, [[60, -50], [54, -66], [66, -50]], '#f1f3f5'); P_(c, [[72, -50], [70, -68], [80, -50]], '#f1f3f5');      // horns
    R_(c, 74, -46, 7, 6, '#ffe066'); R_(c, 78, -46, 3, 6, '#212529'); R_(c, 98, -40, 3, 3, dark);
    if (b.breath > 0) { R_(c, 88, -30, 16, 8, '#5c1a00'); R_(c, 92, -29, 10, 5, '#ff922b'); } else R_(c, 86, -30, 18, 3, dark);
    R_(c, 90, -30, 3, 4, '#fff'); R_(c, 97, -30, 3, 4, '#fff');
    wing(2, 0.2 + flap * 0.7, wingC);
    c.restore();
  }
  function drawCat(c, b) {
    c.save(); c.translate(b.x, b.y); c.scale(b.face, 1); if (!b.alive) c.rotate(b.dying * 3);
    const flap = Math.sin(b.t * 14), f = b.flash > 0, fr = b.frozen > 0, fur = f ? '#f1f3f5' : fr ? '#a5d8ff' : '#2b2d42', wingC = f ? '#fff' : fr ? '#d0ebff' : '#5f3dc4';
    const wy = -8 - flap * 18;
    P_(c, [[-6, -4], [-18, wy - 22], [-34, wy - 14], [-30, wy - 2], [-44, wy + 2], [-24, 4]], wingC);             // far wing
    P_(c, [[-24, 2], [-40, -2], [-42, -14 + Math.sin(b.t * 4) * 4], [-36, -14], [-34, -6], [-22, -4]], fur);     // tail
    E_(c, -6, 6, 22, 12, fur);
    P_(c, [[4, -6], [22, 16], [8, 12]], f ? '#fff' : '#a61e4d');                                                    // cape
    R_(c, 4, -20, 26, 22, fur);                                                                                    // head
    P_(c, [[4, -20], [6, -34], [14, -20]], fur); P_(c, [[20, -20], [28, -34], [30, -20]], fur); R_(c, 8, -26, 3, 4, '#9775fa'); R_(c, 23, -26, 3, 4, '#9775fa');
    R_(c, 10, -14, 5, 4, '#ffd43b'); R_(c, 21, -14, 5, 4, '#ffd43b'); R_(c, 12, -14, 2, 4, '#212529'); R_(c, 23, -14, 2, 4, '#212529');
    const bite = b.mode === 'bite' && Math.sin(b.t * 18) > 0;
    R_(c, 14, -5, 10, bite ? 5 : 2, '#5c1a2e'); R_(c, 14, -4, 3, bite ? 7 : 5, '#fff'); R_(c, 21, -4, 3, bite ? 7 : 5, '#fff');
    P_(c, [[-4, -4], [10, wy - 26], [26, wy - 18], [22, wy - 6], [34, wy - 2], [12, 4]], wingC);                  // near wing
    c.restore();
  }
  function drawBlobby(c, b) {
    if (!b.solid && b.alive) return;
    c.save(); c.translate(b.x, b.y); if (!b.alive) { c.globalAlpha = Math.max(0, 1 - b.dying); c.scale(1 + b.dying, Math.max(0.05, 1 - b.dying)); }
    const R = b.R, sq = b.squash, sx = 1 + sq * 0.5, sy = 1 - sq * 0.5, f = b.flash > 0, fr = b.frozen > 0, sk = Math.sin(b.t * 5) * 3;
    const front = f ? '#fff' : fr ? '#c5f6fa' : '#8ce99a', top = f ? '#fff' : fr ? '#e3fafc' : '#c3fae8', side = f ? '#e9ecef' : fr ? '#99e9f2' : '#51cf66';
    const w = R * 2 * sx, h = R * 2 * sy, x0 = -w / 2, y0 = -h, d = R * 0.45;
    P_(c, [[x0 + sk, y0], [x0 + w + sk, y0], [x0 + w + d + sk, y0 - d * 0.7], [x0 + d + sk, y0 - d * 0.7]], top);  // top face
    P_(c, [[x0 + w + sk, y0], [x0 + w + d + sk, y0 - d * 0.7], [x0 + w + d, -d * 0.7], [x0 + w, 0]], side);      // side face
    P_(c, [[x0 + sk, y0], [x0 + w + sk, y0], [x0 + w, 0], [x0, 0]], front);                                       // front
    // things stuck inside him
    R_(c, x0 + w * 0.15, -h * 0.28, w * 0.22, 3, '#f8f9fa'); R_(c, x0 + w * 0.13, -h * 0.28 - 2, 4, 7, '#f8f9fa'); R_(c, x0 + w * 0.35, -h * 0.28 - 2, 4, 7, '#f8f9fa');
    R_(c, x0 + w * 0.7, -h * 0.22, 6, 6, '#fcc419');
    const f2 = b.face * R * 0.1;
    R_(c, -R * 0.45 + f2, -h * 0.72, R * 0.3, R * 0.34, '#fff'); R_(c, R * 0.15 + f2, -h * 0.72, R * 0.3, R * 0.34, '#fff');
    R_(c, -R * 0.35 + f2 * 1.8, -h * 0.66, R * 0.13, R * 0.17, '#212529'); R_(c, R * 0.25 + f2 * 1.8, -h * 0.66, R * 0.13, R * 0.17, '#212529');
    R_(c, -R * 0.25 + f2, -h * 0.42, R * 0.5, 3, '#2b8a3e');
    c.restore();
  }
  function drawSkeleton(c, b) {
    c.save(); c.translate(b.x, b.y); c.scale(b.face, 1); if (!b.alive) { c.restore(); return; }
    const f = b.flash > 0, fr = b.frozen > 0, bone = f ? '#fff' : fr ? '#d0ebff' : '#f1f3f5', shade = fr ? '#a5d8ff' : '#ced4da';
    const st = Math.round(Math.sin(b.walk * 6) * 4), grab = b.mode === 'grab', offer = b.mode === 'offer';
    R_(c, -9 + st, -36, 4, 30, bone); R_(c, 5 - st, -36, 4, 30, bone); R_(c, -12 + st, -7, 9, 5, shade); R_(c, 4 - st, -7, 9, 5, shade);  // legs
    R_(c, -12, -42, 24, 7, bone); R_(c, -2, -76, 4, 36, shade);                                                   // hips, spine
    for (let i = 0; i < 4; i++) R_(c, -12 + i, -72 + i * 7, 24 - i * 2, 3, bone);                                // ribs
    R_(c, -14, -78, 28, 4, bone);                                                                                 // shoulders
    // arms: throwing, holding out a gift, or holding the wizard
    const throwA = b.arm > 0;
    R_(c, -16, -76, 4, 26, bone);
    if (grab) { R_(c, 12, -76, 18, 4, bone); R_(c, 26, -76, 4, 10, bone); }
    else if (offer) { R_(c, 12, -66, 22, 4, bone); R_(c, 30, -76, 12, 10, '#e64980'); R_(c, 35, -76, 3, 10, '#ffd43b'); R_(c, 30, -72, 12, 3, '#ffd43b'); }
    else if (throwA) { R_(c, 12, -96, 4, 22, bone); }
    else R_(c, 12, -76, 4, 26, bone);
    R_(c, -11, -102, 22, 20, bone); R_(c, -8, -84, 16, 6, bone);                                                  // skull, jaw
    R_(c, -6, -96, 6, 6, '#212529'); R_(c, 4, -96, 5, 6, '#212529'); R_(c, 2, -89, 2, 3, '#495057');
    for (let i = -6; i < 8; i += 3) R_(c, i, -84, 1, 4, '#495057');
    if (offer || grab) { R_(c, -6, -95, 2, 2, '#ffd43b'); R_(c, 5, -95, 2, 2, '#ffd43b'); }
    c.restore();
  }
  function drawBone(c, x, y, a, s = 1, col = '#f1f3f5') {
    c.save(); c.translate(x, y); c.rotate(a); c.scale(s, s);
    R_(c, -10, -2, 20, 4, col); R_(c, -13, -5, 5, 5, col); R_(c, -13, 0, 5, 5, col); R_(c, 8, -5, 5, 5, col); R_(c, 8, 0, 5, 5, col);
    c.restore();
  }
  function drawSkull(c, x, y, a) { c.save(); c.translate(x, y); c.rotate(a); R_(c, -11, -11, 22, 18, '#f1f3f5'); R_(c, -7, 5, 14, 6, '#f1f3f5'); R_(c, -6, -5, 5, 6, '#212529'); R_(c, 3, -5, 5, 6, '#212529'); c.restore(); }

  // Big baby (our own): sitting, round as a ball, a curl on top; wails with eyes squeezed shut, or sleeps
  function drawBaby(c, b) {
    c.save(); c.translate(b.x, b.y);
    const R = b.R, f = b.flash > 0, asleep = !b.alive, wail = b.wailing > 0 && !asleep, cry = b.max ? Math.max(0, b.hp / b.max) : 0;
    const wob = asleep ? 0 : Math.sin(b.t * (6 + 6 * cry)) * 2 * (0.5 + cry);
    const skin = f ? '#fff' : '#f7c6a3', skinD = f ? '#f1f3f5' : '#eaa985', cheek = '#ff8fa3', nappy = '#f8f9fa', nappyD = '#dee2e6';
    if (asleep) c.rotate(-0.12);
    // legs and feet
    E_(c, -R * 0.55, -R * 0.18, R * 0.32, R * 0.2, skin); E_(c, R * 0.55, -R * 0.18, R * 0.32, R * 0.2, skin);
    E_(c, -R * 0.82, -R * 0.2, R * 0.14, R * 0.17, skinD); E_(c, R * 0.82, -R * 0.2, R * 0.14, R * 0.17, skinD);
    // body and nappy
    E_(c, wob * 0.5, -R * 0.68, R * 0.8, R * 0.66, skin);
    P_(c, [[-R * 0.62, -R * 0.42], [R * 0.62, -R * 0.42], [R * 0.4, -R * 0.06], [-R * 0.4, -R * 0.06]], nappy); R_(c, -R * 0.62, -R * 0.46, R * 1.24, 4, nappyD);
    R_(c, -R * 0.5, -R * 0.4, 5, 5, '#a5d8ff'); R_(c, R * 0.42, -R * 0.4, 5, 5, '#a5d8ff');
    E_(c, wob * 0.5, -R * 0.82, R * 0.12, R * 0.08, skinD);                                           // tummy button
    // arms: up and waving when upset, down when calm
    const up = asleep ? 0 : 0.4 + cry * 0.6, wv = Math.sin(b.t * 9) * 8 * up;
    P_(c, [[-R * 0.62, -R * 0.95], [-R * 0.7, -R * 0.75], [-R * 1.05, -R * (0.75 + up * 0.6) + wv], [-R * 0.98, -R * (0.95 + up * 0.6) + wv]], skin);
    P_(c, [[R * 0.62, -R * 0.95], [R * 0.7, -R * 0.75], [R * 1.05, -R * (0.75 + up * 0.6) - wv], [R * 0.98, -R * (0.95 + up * 0.6) - wv]], skin);
    E_(c, -R * 1.03, -R * (0.86 + up * 0.6) + wv, R * 0.13, R * 0.13, skin); E_(c, R * 1.03, -R * (0.86 + up * 0.6) - wv, R * 0.13, R * 0.13, skin);
    // head
    const hx = wob, hy = -R * 1.5;
    E_(c, hx, hy, R * 0.62, R * 0.56, skin);
    E_(c, hx - R * 0.6, hy + 2, R * 0.1, R * 0.14, skinD); E_(c, hx + R * 0.6, hy + 2, R * 0.1, R * 0.14, skinD);   // ears
    P_(c, [[hx - 4, hy - R * 0.54], [hx + 6, hy - R * 0.72], [hx + 12, hy - R * 0.6], [hx + 4, hy - R * 0.5]], '#c08457');   // the curl
    E_(c, hx - R * 0.34, hy + R * 0.18, R * 0.12, R * 0.08, cheek); E_(c, hx + R * 0.34, hy + R * 0.18, R * 0.12, R * 0.08, cheek);
    if (asleep) {
      R_(c, hx - R * 0.32, hy - 2, R * 0.2, 3, '#7f4f24'); R_(c, hx + R * 0.12, hy - 2, R * 0.2, 3, '#7f4f24');
      R_(c, hx - 5, hy + R * 0.28, 10, 3, '#c2255c');
    } else {
      // eyes squeezed shut: little upside-down Vs; streams of tears
      P_(c, [[hx - R * 0.36, hy + 2], [hx - R * 0.24, hy - 6], [hx - R * 0.12, hy + 2], [hx - R * 0.16, hy + 4], [hx - R * 0.24, hy - 1], [hx - R * 0.32, hy + 4]], '#7f4f24');
      P_(c, [[hx + R * 0.12, hy + 2], [hx + R * 0.24, hy - 6], [hx + R * 0.36, hy + 2], [hx + R * 0.32, hy + 4], [hx + R * 0.24, hy - 1], [hx + R * 0.16, hy + 4]], '#7f4f24');
      if (cry > 0) { R_(c, hx - R * 0.27, hy + 4, 4, R * 0.42 * cry + 6, '#74c0fc'); R_(c, hx + R * 0.21, hy + 4, 4, R * 0.42 * cry + 6, '#74c0fc'); }
      const mo = wail ? R * 0.26 : R * 0.12;
      E_(c, hx, hy + R * 0.3, R * 0.2, mo, '#a61e4d'); E_(c, hx, hy + R * 0.3 + mo * 0.5, R * 0.12, mo * 0.4, '#ff8fa3');
    }
    c.restore();
  }
  function drawRattle(c, x, y, a) {
    c.save(); c.translate(x, y); c.rotate(a);
    R_(c, -2, 0, 4, 16, '#ffd43b'); E_(c, 0, -6, 9, 9, '#f783ac'); R_(c, -9, -7, 18, 3, '#fff0f6'); R_(c, -3, 14, 6, 4, '#f783ac');
    c.restore();
  }
  function drawZ(c, x, y, s, t) {
    const k = 6 * s, col = t > 0.5 ? '#d0bfff' : '#e5dbff';
    c.save(); c.translate(x, y); c.globalAlpha = Math.min(1, t * 2);
    R_(c, 0, 0, k * 1.6, k * 0.35, col); for (let i = 0; i < 4; i++) R_(c, k * 1.2 - i * k * 0.36, k * 0.3 + i * k * 0.3, k * 0.4, k * 0.38, col); R_(c, 0, k * 1.4, k * 1.6, k * 0.35, col);
    c.restore();
  }
  // the graveyard: stones, the hands, and zombies of our own (green-grey, a torn shirt, arms out)
  function drawGraves(c, b) {
    const Gy = G();
    for (const g of b.graves) {
      const sx = g.x;
      // the stone (a crack in it once he's out)
      P_(c, [[sx - 17, Gy - 6], [sx - 17, Gy - 38], [sx - 12, Gy - 46], [sx + 12, Gy - 46], [sx + 17, Gy - 38], [sx + 17, Gy - 6]], '#adb5bd');
      R_(c, sx + 9, Gy - 44, 6, 38, '#868e96'); R_(c, sx - 2, Gy - 38, 4, 18, '#6c757d'); R_(c, sx - 8, Gy - 32, 16, 4, '#6c757d');
      if (g.st !== 'shut') { R_(c, sx - 10, Gy - 22, 6, 3, '#495057'); R_(c, sx - 6, Gy - 19, 4, 3, '#495057'); }
      // the earth in front
      P_(c, [[sx - 26, Gy], [sx - 18, Gy - 8], [sx + 18, Gy - 8], [sx + 26, Gy]], g.st === 'shut' ? '#7f5539' : '#5c3d2e');
      if (g.st === 'hand') {
        const wg = Math.sin(b.t * 18) * 3, hy = Gy - 8 - (0.9 - Math.max(0, g.t)) * 18;
        R_(c, sx + 22, hy, 7, Gy - hy, '#94b37a'); for (let i = 0; i < 4; i++) R_(c, sx + 20 + i * 3 + wg * (i % 2 ? 1 : -1) * 0.3, hy - 8 + (i === 0 ? 4 : 0), 2, 9, '#94b37a');
      }
    }
    // zombies: clipped at the floor, so they really come up out of it
    c.save(); c.beginPath(); c.rect(0, 0, innerWidth, Gy - 1); c.clip();
    for (const g of b.graves) {
      if (g.st !== 'rise' && g.st !== 'walk') continue;
      const f = g.flash > 0, fr = b.frozen > 0, skin = f ? '#fff' : fr ? '#c5f6fa' : '#94b37a', shirt = f ? '#f1f3f5' : '#4c6ef5', pants = '#5c3d2e';
      const x = g.zx, dy = (1 - g.rise) * 84, st = Math.round(Math.sin(g.walk * 5) * 3), sway = Math.sin(g.walk * 2.5) * 2;
      c.save(); c.translate(x, Gy + dy); c.scale(g.face || 1, 1);
      R_(c, -8 + st, -34, 6, 30, pants); R_(c, 3 - st, -34, 6, 30, pants); R_(c, -10 + st, -6, 9, 5, '#343a40'); R_(c, 2 - st, -6, 9, 5, '#343a40');
      P_(c, [[-11, -66], [11, -66], [12, -32], [6, -36], [2, -31], [-4, -36], [-12, -32]], shirt);                 // torn shirt
      R_(c, -6, -50, 4, 4, '#364fc7'); R_(c, 4, -44, 5, 3, '#364fc7');
      R_(c, 6, -62 + sway, 26, 6, skin); R_(c, 6, -52 - sway, 24, 6, skin); R_(c, 30, -63 + sway, 4, 7, skin); R_(c, 28, -53 - sway, 4, 7, skin);   // arms out
      R_(c, -9, -86, 18, 20, skin); R_(c, -9, -88, 18, 4, '#495057');                                             // head, hair
      R_(c, 1, -80, 6, 6, '#fff9db'); R_(c, 3, -78, 3, 3, '#212529'); R_(c, -6, -79, 4, 3, '#212529');           // one eye bigger
      R_(c, -4, -72, 10, 3, '#5c3d2e'); R_(c, -1, -72, 2, 2, '#fff');
      c.restore();
    }
    c.restore();
  }
  // Old Clinker (our own): a heap of coals, glowing in the cracks, a crown of flame, a grumpy brow
  function drawClinker(c, b) {
    c.save(); c.translate(b.x, b.y); c.scale(b.face, 1); if (!b.alive) { c.globalAlpha = Math.max(0, 1 - b.dying * 0.6); c.scale(1, Math.max(0.1, 1 - b.dying * 0.3)); }
    const k = b.R / 46, f = b.flash > 0, fr = b.frozen > 0, t = b.t, hot = b.puff > 0;
    c.scale(k, k);
    const coal = f ? '#f8f9fa' : fr ? '#495a6b' : '#2b2a2e', coal2 = f ? '#e9ecef' : fr ? '#5c7085' : '#3d3a40', glow = fr ? '#74c0fc' : hot ? '#ffd43b' : '#ff922b', glow2 = fr ? '#a5d8ff' : '#ffd43b';
    // flame crown first, behind: tongues that flicker
    const tongues = [[-34, 46], [-18, 64], [0, 76], [18, 62], [34, 44]];
    for (const [layer, col] of [[0, fr ? '#4dabf7' : '#e8590c'], [1, fr ? '#a5d8ff' : '#ff922b'], [2, fr ? '#e7f5ff' : '#ffd43b']]) {
      for (let i = 0; i < tongues.length; i++) {
        const [tx, th] = tongues[i], h = (th + Math.sin(t * 11 + i * 1.7) * 9 + (hot ? 18 : 0)) * (1 - layer * 0.28), wd = 13 - layer * 3.5;
        P_(c, [[tx - wd, -20], [tx + wd, -20], [tx + wd * 0.4, -20 - h * 0.55], [tx + Math.sin(t * 7 + i) * 4, -20 - h], [tx - wd * 0.5, -20 - h * 0.6]], col);
      }
    }
    // the heap: big lumps, then smaller ones on top
    P_(c, [[-50, 30], [-44, 6], [-30, -8], [-8, -16], [14, -14], [34, -6], [48, 8], [52, 30]], coal);
    for (const [x, y, w, h] of [[-44, 10, 26, 20], [-16, 2, 30, 26], [18, 6, 28, 22], [-30, -12, 22, 16], [4, -18, 24, 16]]) R_(c, x, y, w, h, coal2);
    // glowing cracks
    const fl = Math.sin(t * 9) > 0 ? glow : glow2;
    for (const [x, y, w, h] of [[-40, 16, 14, 2], [-28, 16, 2, 10], [-8, 8, 2, 14], [-8, 20, 12, 2], [24, 12, 2, 12], [24, 22, 14, 2], [-24, -6, 10, 2], [10, -10, 2, 8]]) R_(c, x, y, w, h, fl);
    // stubby arms
    const sw = Math.sin(t * 4) * 4;
    R_(c, -62, 2 + sw, 14, 10, coal); R_(c, 48, 2 - sw, 14, 10, coal); R_(c, -62, 6 + sw, 3, 2, glow); R_(c, 59, 6 - sw, 3, 2, glow);
    // face: a heavy brow, narrow glowing eyes, a jagged grin of a crack
    R_(c, -24, -10, 20, 5, '#121014'); R_(c, 6, -10, 20, 5, '#121014');
    R_(c, -20, -4, 13, 4, glow2); R_(c, 9, -4, 13, 4, glow2); R_(c, -14, -4, 3, 4, '#fff9db'); R_(c, 15, -4, 3, 4, '#fff9db');
    const m = hot ? 6 : 3;
    P_(c, [[-16, 10], [-8, 8], [-2, 12], [6, 8], [14, 10], [10, 10 + m], [4, 10 + m - 2], [-4, 10 + m], [-12, 10 + m - 2]], glow);
    c.restore();
  }

  // the effects canvas: plain squares in cell units
  function fxDot(c, x, y, s, col) { c.fillStyle = col; c.fillRect(Math.round(x / S.PX - s / 2), Math.round(y / S.PX - s / 2), s, s); }
  function fxBall(c, s) {
    const cols = s.from === 'wiz' ? (s.kind === 'ice' ? ['#1864ab', '#74c0fc', '#e7f5ff'] : s.kind === 'milk' ? ['#adb5bd', '#f1f3f5', '#ffffff'] : ['#5f3dc4', '#be4bdb', '#f3d9fa']) : s.kind === 'lava' ? ['#c92a2a', '#f76707', '#ffd43b'] : ['#d9480f', '#ff922b', '#fff3bf'];
    const r = Math.max(1, Math.round(s.r / S.PX)), cx = Math.round(s.x / S.PX), cy = Math.round(s.y / S.PX);
    for (let k = 0; k < 3; k++) { const rr = r - k * Math.max(1, r / 3); if (rr <= 0) break; c.fillStyle = cols[k];
      for (let dy = -Math.ceil(rr); dy <= Math.ceil(rr); dy++) { const half = Math.floor(Math.sqrt(Math.max(0, rr * rr - dy * dy))); c.fillRect(cx - half, cy + dy, half * 2 + 1, 1); } }
  }
  function fxLine(c, x0, y0, x1, y1, col, zig) {
    const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (S.PX * 1.2))); let jx = 0;
    c.fillStyle = col;
    for (let i = 0; i <= n; i++) { const k = i / n; if (zig && i % 4 === 0) jx = rnd(-6, 6); const x = x0 + (x1 - x0) * k + jx, y = y0 + (y1 - y0) * k;
      c.fillRect(Math.round(x / S.PX) - 1, Math.round(y / S.PX) - 1, zig ? 2 : 3, zig ? 2 : 3); }
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
    // shots
    for (const s of S.shots) {
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += (s.g || (s.from === 'boss' ? 60 : 0)) * dt; if (s.spin) s.a += s.spin * dt;
      if (s.kind !== 'bone' && s.kind !== 'rattle' && Math.random() < 0.8) S.parts.push({ x: s.x + rnd(-3, 3), y: s.y + rnd(-3, 3), vx: rnd(-20, 20), vy: rnd(-40, 0), life: 0.3, col: s.from === 'wiz' ? (s.kind === 'ice' ? '#a5d8ff' : s.kind === 'milk' ? pick(['#ffffff', '#f1f3f5']) : pick(['#be4bdb', '#e599f7', '#9775fa'])) : pick(['#ff922b', '#ffd43b']), s: 1, g: s.kind === 'milk' ? 200 : -30 });
      const B = S.boss;
      if (s.from === 'wiz') {
        const T = B && B.targetable() && B.hitTest(s.x, s.y, s.r);
        if (T) {
          s.life = 0;
          if (s.kind === 'milk') hitBoss(B, s.x, s.y, 1, T);
          else if (s.kind === 'kablammo') { hitBoss(B, s.x, s.y, 2, T); impact(s.x, s.y, 'blast', 2); shake(1.5); }
          else if (s.kind === 'ice' && B.kind === 'clinker') {   // the thing he can't stand
            hitBoss(B, s.x, s.y, 1); B.frozen = 1; try { if (S.fx) S.fx.spawn(s.x, s.y, S.fx.M.STEAM, 3, 0.5); } catch {} burst(s.x, s.y, 10, ['#f8f9fa', '#dee2e6', '#adb5bd'], 160, -60);
            if (Math.random() < 0.4) say(B, pick(['Hsssss!', 'Cold! Cold!', 'Ow, frosty!']), 1);
          }
          else if (s.kind === 'ice') { hitBoss(B, s.x, s.y, 1 / 3, T); B.frozen = 2.5; impact(s.x, s.y, 'ice', 1); }
          else if (B.kind === 'clinker') { hitBoss(B, s.x, s.y, 1 / 3); if (Math.random() < 0.3) say(B, pick(['Tasty!', 'Ha, tickles!', 'More, more!']), 1); }   // fire just feeds him
          else { hitBoss(B, s.x, s.y, 1, T); if (Math.random() < 0.5) impact(s.x, s.y, 'fire', 1); }
          continue;
        }
        if (s.kind === 'kablammo' && s.life < 2.6) { s.life = 0; impact(s.x, s.y, 'blast', 2); continue; }
      } else {
        if (!w.flying && !w.held && Math.hypot(s.x - w.x, s.y - (w.y - 44)) < s.r + 18) { s.life = 0; hurtWizard(w, s.x - s.vx); if (s.kind === 'rattle') say(w, pick(['Bonk!', 'Ow, my nose!']), 0.9); impact(s.x, s.y, s.kind === 'bone' ? 'bone' : s.kind === 'rattle' ? 'thump' : 'fire', 1); continue; }
        if (s.target && Math.hypot(s.x - s.target.x, s.y - s.target.y) < 18) { s.life = 0; impact(s.x, s.y, s.kind === 'bone' ? 'bone' : s.kind === 'lava' ? 'lava' : Math.random() < 0.12 + 0.04 * Math.min(S.round, 6) ? 'blast' : 'fire', 1); continue; }
      }
      if (s.y >= G() - 2) { s.life = 0; if (s.kind === 'milk') { burst(s.x, G() - 4, 10, ['#ffffff', '#f1f3f5'], 120); continue; } impact(s.x, G() - rnd(6, 40), s.kind === 'bone' ? 'bone' : s.kind === 'rattle' ? 'thump' : s.kind === 'ice' ? 'ice' : s.kind === 'lava' ? 'lava' : 'fire', 1); if (s.kind === 'bone') S.bones.push({ x: s.x, y: G() - 6, vx: s.vx * 0.2, vy: -200, a: s.a, va: rnd(-8, 8) }); }
      if (s.x < -80 || s.x > innerWidth + 80 || s.y < -400) s.life = 0;
    }
    S.shots = S.shots.filter(s => s.life > 0);
    for (const p of S.parts) { p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    S.parts = S.parts.filter(p => p.life > 0); if (S.parts.length > 1200) S.parts.splice(0, S.parts.length - 1200);
    for (const j of S.jelly) {
      if (j.home && b) { const tx = b.x + rnd(-6, 6), ty = b.y - b.R; j.vx += (tx - j.x) * 30 * dt; j.vy += (ty - j.y) * 30 * dt; j.vx *= 0.9; j.vy *= 0.9; }
      else { j.vy += 1100 * dt; if (j.y >= G() - j.s / 2) { j.y = G() - j.s / 2; j.vy *= -0.25; j.vx *= 0.7; } }
      j.x += j.vx * dt; j.y += j.vy * dt;
    }
    for (const o of S.bones) { o.vy += 1300 * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.a += o.va * dt; if (o.y >= G() - 4) { o.y = G() - 4; o.vy *= -0.3; o.vx *= 0.6; o.va *= 0.5; } }
    if (S.bones.length > 60) S.bones.splice(0, S.bones.length - 60);
    for (const k of S.claws) k.t -= dt; S.claws = S.claws.filter(k => k.t > 0);
    for (const m of S.beams) m.t -= dt; S.beams = S.beams.filter(m => m.t > 0);
    for (const g of S.rings) { g.t -= dt; g.r += 520 * dt; } S.rings = S.rings.filter(g => g.t > 0);
    for (const z of S.zs) { z.t -= dt; z.y -= 40 * dt; z.x += Math.sin(z.t * 5) * 20 * dt; } S.zs = S.zs.filter(z => z.t > 0);

    // draw: sprites into the pixel buffer
    const A = S.ax, X = S.fxx, PX = S.PX;
    A.setTransform(1, 0, 0, 1, 0, 0); A.clearRect(0, 0, S.lw, S.lh); A.setTransform(1 / PX, 0, 0, 1 / PX, 0, 0);
    if (S.boss) ({ dragon: drawDragon, cat: drawCat, blobby: drawBlobby, skeleton: drawSkeleton, baby: drawBaby, graves: drawGraves, clinker: drawClinker })[S.boss.kind](A, S.boss);
    for (const j of S.jelly) R_(A, j.x - j.s / 2, j.y - j.s / 2, j.s, j.s, j.s > 10 ? '#8ce99a' : '#c3fae8');
    for (const o of S.bones) o.skull ? drawSkull(A, o.x, o.y, o.a) : drawBone(A, o.x, o.y, o.a, 0.8);
    for (const s of S.shots) if (s.kind === 'bone') drawBone(A, s.x, s.y, s.a, 1); else if (s.kind === 'rattle') drawRattle(A, s.x, s.y, s.a);
    for (const z of S.zs) drawZ(A, z.x, z.y, z.s, z.t);
    drawWizard(A, w);
    pixelize(A, S.lw, S.lh);
    // effects
    X.setTransform(1, 0, 0, 1, 0, 0); X.clearRect(0, 0, S.lw, S.lh);
    for (const m of S.beams) { fxLine(X, m.x0, m.y0, m.x1, m.y1, m.zig ? '#7048e8' : '#d9480f', m.zig); fxLine(X, m.x0, m.y0, m.x1, m.y1, m.col, m.zig); }
    for (const k of S.claws) for (let i = -1; i <= 1; i++) fxLine(X, k.x - 14 + i * 7, k.y - 12, k.x + 14 + i * 7, k.y + 12, 'rgba(60,30,80,' + (k.t * 1.6).toFixed(2) + ')');
    for (const g of S.rings) for (let i = 0; i < 40; i++) { const a = Math.PI + (i / 39) * Math.PI; fxDot(X, g.x + Math.cos(a) * g.r, g.y + Math.sin(a) * g.r * 0.7, 2, g.t > 0.45 ? '#ffe3e3' : '#ffc9c9'); }
    for (const s of S.shots) if (s.kind !== 'bone' && s.kind !== 'rattle') fxBall(X, s);
    for (const p of S.parts) fxDot(X, p.x, p.y, p.s, p.col);
    // onto the screen, hard pixels
    const c = S.cx, k = S.dpr; c.setTransform(k, 0, 0, k, 0, 0); c.clearRect(0, 0, innerWidth, innerHeight);
    S.shake *= Math.pow(0.002, dt); const sh = calm() ? 0 : Math.round(S.shake);
    c.imageSmoothingEnabled = false;
    const ox = sh ? irnd(-sh, sh) : 0, oy = sh ? irnd(-sh, sh) : 0;
    c.drawImage(S.fxc, ox, oy, S.lw * PX, S.lh * PX);
    c.drawImage(S.ac, ox, oy, S.lw * PX, S.lh * PX);
    // bubbles follow whoever's talking
    const placed = [];
    for (const u of S.bubbles) {
      u.t -= dt; if (u.t <= 0) { u.el.remove(); continue; }
      const who = u.who, x = who === w ? w.x : who.x, y = who === w ? w.y - 104 : who.kind === 'dragon' ? who.y - 70 : who.kind === 'skeleton' ? who.y - 112 : who.kind === 'blobby' ? who.y - who.R * 2 - 26 : who.kind === 'baby' ? who.y - who.R * 2.3 - 10 : who.kind === 'graves' ? G() - 110 : who.kind === 'clinker' ? who.y - who.R - 46 : who.y - 40;
      // two talking at once (the skeleton and the wizard he's holding): stack the bubbles, don't overlap them
      let bx = Math.round(clamp(x, 70, innerWidth - 70)), by = Math.round(Math.max(56, y));
      while (placed.some(([px, py]) => Math.abs(px - bx) < 170 && Math.abs(py - by) < 38)) by -= 40;
      placed.push([bx, by]);
      u.el.style.transform = `translate(${bx}px,${by}px) translate(-50%,-100%)`;
      u.el.style.opacity = Math.min(1, u.t * 4);
    }
    S.bubbles = S.bubbles.filter(u => u.t > 0);
    // the boss's bar
    const B = S.boss;
    if (B && B.alive) { S.hud.style.display = ''; S.hudName.textContent = B.kind === 'graves' ? `${NAME[B.kind]} · ${B.hp} left · round ${S.round}` : B.kind === 'baby' ? `${NAME[B.kind]} · still crying · round ${S.round}` : `${NAME[B.kind]} · round ${S.round}`; S.hudBar.style.width = (100 * Math.max(0, B.hp) / B.max) + '%'; } else S.hud.style.display = 'none';
    S.raf = requestAnimationFrame(frame);
  }

  // ---------- start and stop ----------
  const CSS = `
    .hf-ui{position:fixed;inset:0;z-index:2147483647;pointer-events:none;font:700 13px/1.2 ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:#f8f9fa}
    .hf-ui *{box-sizing:border-box}
    .hf-top{position:absolute;right:12px;top:12px;display:flex;gap:8px;align-items:center;pointer-events:auto}
    .hf-tip,.hf-stop,.hf-boss,.hf-banner{background:#1c1426;border:3px solid #f8f9fa;box-shadow:3px 3px 0 #000;text-transform:uppercase;letter-spacing:.04em}
    .hf-tip{padding:5px 8px;font-size:11px}
    .hf-stop{color:#fff;padding:5px 12px;font:inherit;cursor:pointer}.hf-stop:hover{background:#5f3dc4}
    .hf-boss{position:absolute;left:50%;top:12px;transform:translateX(-50%);padding:6px 10px 8px;min-width:240px;text-align:center}
    .hf-bar{height:8px;margin-top:5px;background:#3b3052;border:2px solid #000}.hf-bar i{display:block;height:100%;background:#fcc419;transition:width .2s steps(4)}
    .hf-banner{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%) scale(.9);padding:12px 20px;font-size:22px;color:#fff3bf;opacity:0}
    .hf-banner.on{animation:hfb 1.8s steps(12) forwards}
    @keyframes hfb{10%{opacity:1;transform:translate(-50%,-50%) scale(1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1)}}
    .hf-say{position:absolute;left:0;top:0;background:#fff;color:#111;border:3px solid #111;box-shadow:3px 3px 0 #111;padding:6px 10px;white-space:nowrap;
      font:900 16px/1 "Comic Sans MS","Comic Neue","Chalkboard SE",ui-rounded,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.02em;margin-top:-10px}
    .hf-say::after{content:"";position:absolute;left:calc(50% - 8px);bottom:-13px;border:8px solid transparent;border-top:10px solid #111;border-bottom:0}
    .hf-say::before{content:"";position:absolute;left:calc(50% - 5px);bottom:-8px;border:5px solid transparent;border-top:7px solid #fff;border-bottom:0;z-index:1}
    .hf-say.wiz{background:#f3f0ff}.hf-say.wiz::before{border-top-color:#f3f0ff}
    /* phones (2026-11-24, user: "kinda messed on phone"): the boss bar across the top, the hint and Stop under it */
    @media (max-width:700px){
      .hf-boss{left:10px;right:10px;top:calc(10px + env(safe-area-inset-top));transform:none;min-width:0;padding:6px 8px 7px;font-size:12px}
      .hf-top{left:10px;right:10px;top:calc(62px + env(safe-area-inset-top));justify-content:space-between}
      .hf-tip{font-size:10px;padding:5px 7px}
      .hf-stop{padding:6px 14px}
      .hf-banner{font-size:17px;white-space:nowrap}
    }`;
  function size() {
    if (!S) return; const k = S.dpr = Math.min(2, devicePixelRatio || 1);
    S.PX = innerWidth < 700 ? 2 : 3; S.lw = Math.ceil(innerWidth / S.PX); S.lh = Math.ceil(innerHeight / S.PX);
    S.cv.width = innerWidth * k; S.cv.height = innerHeight * k;
    for (const cv of [S.ac, S.fxc]) { cv.width = S.lw; cv.height = S.lh; }
  }
  async function start() {
    if (S || starting) return; starting = true;
    try {
      // the words: physics, without its toolbar
      try {
        if (!window.Matter) await load('vendor/matter.min.js');
        if (window.__havoc && window.__havoc.start) { if (window.__havoc.active) window.__havoc.stop(); window.__havoc.start({ bare: true }); }
        else { window.__havocOpts = { bare: true }; await load('vendor/havoc-engine.js?v=' + Date.now().toString(36).slice(0, -3)); }
      } catch (e) { console.warn('Wizard vs bosses: physics', e); }
      // the matter: the Elements layer
      let fx = null; try { fx = window.CadenceFX ? await window.CadenceFX.world() : null; } catch {}
      const cv = document.createElement('canvas'); cv.className = 'hf-canvas';
      cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483647;cursor:crosshair;touch-action:none;image-rendering:pixelated';
      const ui = document.createElement('div'); ui.className = 'hf-ui';
      ui.innerHTML = `<style>${CSS}.isl,#island{visibility:hidden!important}</style><div class="hf-top"><span class="hf-tip">${matchMedia('(hover: none) and (pointer: coarse)').matches ? 'Tap to cast a fireball' : 'Click to aim · 1-6 spells · arrows move · Esc stops'}</span><button class="hf-stop">Stop</button></div>
        <div class="hf-boss"><span class="hf-name"></span><div class="hf-bar"><i></i></div></div><div class="hf-banner"></div>`;
      const ac = document.createElement('canvas'), fxc = document.createElement('canvas');
      S = { cv, ui, ac, fxc, cx: cv.getContext('2d'), ax: ac.getContext('2d', { willReadFrequently: true }), fxx: fxc.getContext('2d'), shots: [], parts: [], jelly: [], bones: [], claws: [], beams: [], bubbles: [], rings: [], zs: [],
        round: 1, beaten: 0, hits: 0, shake: 0, fx, hud: ui.querySelector('.hf-boss'), hudName: ui.querySelector('.hf-name'), hudBar: ui.querySelector('.hf-bar i'), bannerEl: ui.querySelector('.hf-banner') };
      (document.fullscreenElement || document.documentElement).append(cv, ui); size();
      document.documentElement.classList.add('havoc-open');   // full screen: Cadence's tab bar steps aside
      S.wiz = newWizard(); S.boss = newBoss('dragon'); banner('Round 1: Dragon');
      S.onDown = e => { if (!S) return; e.preventDefault(); const w = S.wiz; if (w.hurt > 0.3 || w.held || w.flying) return; if (S.lastClick && performance.now() - S.lastClick < 200) return; S.lastClick = performance.now(); cast('fireball', e.clientX, e.clientY); w.cd = Math.max(w.cd, 0.6); };
      S.onKey = e => {
        if (!S) return;
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); stop(); return; }
        const k = e.key.toLowerCase(), B = S.boss;
        if (KEYS[k] && B && B.targetable()) { e.preventDefault(); e.stopPropagation(); const at = B.aim(); cast(KEYS[k], at.x, at.y); S.wiz.cd = Math.max(S.wiz.cd, 0.8); return; }
        if (['arrowleft', 'a'].includes(k)) { S.wiz.manual = 1.2; S.wiz.dir = -1; S.wiz.lured = null; e.preventDefault(); }
        else if (['arrowright', 'd'].includes(k)) { S.wiz.manual = 1.2; S.wiz.dir = 1; S.wiz.lured = null; e.preventDefault(); }
        else if (['arrowup', 'w', ' '].includes(k)) { S.wiz.jumpQ = true; e.preventDefault(); }
      };
      S.onUp = e => { if (S && ['arrowleft', 'arrowright', 'a', 'd'].includes(e.key.toLowerCase())) S.wiz.manual = Math.min(S.wiz.manual, 0.15); };
      cv.addEventListener('pointerdown', S.onDown);
      addEventListener('keydown', S.onKey, true); addEventListener('keyup', S.onUp, true);
      S.onSize = () => size(); addEventListener('resize', S.onSize);
      ui.querySelector('.hf-stop').onclick = () => stop();
      S.raf = requestAnimationFrame(frame);
      dispatchEvent(new CustomEvent('havoc-fight', { detail: { on: true } }));
    } finally { starting = false; }
  }
  function stop() {
    if (!S) return;
    cancelAnimationFrame(S.raf);
    removeEventListener('keydown', S.onKey, true); removeEventListener('keyup', S.onUp, true); removeEventListener('resize', S.onSize);
    S.cv.remove(); S.ui.remove(); document.documentElement.classList.remove('havoc-open');
    const fx = S.fx; S = null;
    // the page back: physics puts every word where it was; the Elements layer drops what the fight left
    try { const h = window.__havoc; if (h && h.active) (h.rewind || h.stop)(); } catch {}   // the words fly home
    if (fx) { try { const M = fx.M; for (const m of [M.FIRE, M.LAVA, M.ACID, M.ICE, M.SMOKE, M.EMBER, M.ASH, M.SAND, M.FUME, M.STEAM, M.STONE, M.WATER, M.PIXEL, M.DRIP]) if (m != null) fx.clear(m); } catch {} }
    dispatchEvent(new CustomEvent('havoc-fight', { detail: { on: false } }));
  }
  window.HavocFight = {
    start, stop, get active() { return !!S; },
    state: () => S && { round: S.round, boss: S.boss && S.boss.kind, mode: S.boss && S.boss.mode, hp: S.boss && S.boss.hp, max: S.boss && S.boss.max, beaten: S.beaten, hits: S.hits,
      physics: !!H(), elements: !!S.fx, wizard: { x: S.wiz.x, y: S.wiz.y, held: !!S.wiz.held, flying: S.wiz.flying }, solid: S.boss && S.boss.solid, bubbles: S.bubbles.map(b => b.el.textContent),
      up: S.boss && S.boss.kind === 'graves' ? S.boss.up().length : null, graves: S.boss && S.boss.graves ? S.boss.graves.map(g => g.st) : null, R: S.boss && S.boss.R, landed: S.boss && S.boss.landed },
    debug: {
      hit: n => { for (let i = 0; i < n; i++) if (S && S.boss && S.boss.alive) hitBoss(S.boss, S.boss.x, S.boss.y, 1); },
      cast: sp => { const B = S && S.boss; if (B && B.targetable()) { const at = B.aim(); cast(sp, at.x, at.y); } },
      boss: kind => { if (S && NAME[kind]) { S.round--; nextRound(kind); } },
      trick: () => { const B = S && S.boss; if (B && B.kind === 'skeleton') { B.mode = 'walk'; B.mt = 0; B.cd = 9; S.wiz.hurt = 0; S.wiz.flying = false; } },
      impact: (x, y, k, p) => impact(x, y, k, p)
    }
  };
})();
