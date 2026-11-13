/* Sheep: a little desktop pet (an original pixel sheep). It walks along the tops of cards and the bottom of the window,
   falls off edges, nibbles, naps when you leave it alone, hops when you finish a task, and says baa when clicked.
   Grab it and throw it. ⌘K "Let a sheep out" / "Round up the sheep". Up to 5 at once. */
(() => {
  const KEY = 'cadence.sheep';
  const G = window.__sheep = window.__sheep || {};
  // 16x10 pixel art, facing right. W wool, w wool shade, F face/legs, E eye, P pink ear
  const BODY = [
    '...WW.WW........',
    '..WWWWWWWWW.....',
    '.WWWWWWWWWWWFFP.',
    'WWWWWWWWWWWFFEFF',
    'WWWWWWWWWWWFFFFF',
    'WwWWWWWWWWWWFFF.',
    '.wwWWWWWWWWw....',
    '..wwwwwwwwww....',
  ];
  const LEGS = { a: ['..F.F....F.F....', '..F.F....F.F....'], b: ['...F.F..F.F.....', '...F.F..F.F.....'], stand: ['..F.F....F.F....', '..F.F....F.F....'], fall: ['.F...F..F...F...', 'F.....F.......F.'], none: ['................', '................'] };
  const COL = { W: '#fbfaf5', w: '#d8d3c6', F: '#3b3632', E: '#ffffff', P: '#f2a7b5' };
  function sprite(frame) {
    let rows = BODY.slice();
    if (frame === 'eat') rows = rows.map((r, y) => r.slice(0, 11) + (BODY[y - 2] ? BODY[y - 2].slice(11) : '.....'));   // head down in the grass
    if (frame === 'sleep' || frame === 'blink') rows = rows.map(r => r.replace('E', 'F'));
    const legs = frame === 'sleep' ? LEGS.none : LEGS[frame] || LEGS.stand;
    let all = rows.concat(legs); if (frame === 'sleep') all = ['................', '................'].concat(rows);
    let out = ''; all.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = COL[r[x]]; if (c) out += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${c}"/>`; } });
    return out;
  }
  const FRAMES = {}; for (const f of ['a', 'b', 'stand', 'fall', 'eat', 'sleep', 'blink']) FRAMES[f] = sprite(f);
  const S = 3, W = 16 * S, H = 10 * S;   // on-screen size
  const PLAT = '.stat,.qa,.gl,.c-hero,.dk-card,.pl-card,.modal,.isl-pill,.group-h,.task.open,.rs-pin .ph,.tile,.pb-card,.ntiles,.dock .dk,.m-band,.m-head';

  Cadence.registerPlugin({
    id: 'sheep', name: 'Sheep', version: '1.0.0', category: 'Fun', spaces: ['work', 'life'],
    description: 'A little pixel sheep that wanders across your cards, falls off edges, naps, nibbles, and hops when you finish a task. Drag it, throw it, click it.',
    tagline: 'A desktop pet that walks on your cards', color: '#9ca3af',
    icon: '<path d="M6 13a4 4 0 0 1 3-6 4 4 0 0 1 6 0 4 4 0 0 1 3 6 3 3 0 0 1-3 4H9a3 3 0 0 1-3-4z"/><path d="M9 17v3M15 17v3"/>',
    settings() { G.settings && G.settings(); },
    setup(api) {
      G.teardown && G.teardown();
      const opts = () => { let v = null; try { v = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {} return Object.assign({ count: 0 }, v || {}); };
      const save = n => { try { localStorage.setItem(KEY, JSON.stringify(Object.assign(opts(), n))); } catch (e) {} sync(); };
      const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
      let flock = [], raf = 0, last = 0, plats = [], platT = 0, idleAt = performance.now();

      function platforms() {
        const out = [{ el: null, l: 0, r: innerWidth, t: innerHeight }];
        document.querySelectorAll(PLAT).forEach(el => { if (el.closest('[hidden]')) return; const r = el.getBoundingClientRect(); if (r.width < 60 || r.bottom < 0 || r.top > innerHeight - 10 || r.top < 30) return; out.push({ el, l: r.left, r: r.right, t: r.top }); });
        // cover screens (meeting, dialogs): only their own things
        const layer = (document.querySelector('#meeting.open') || (document.querySelector('#scrim.open') && document.querySelector('#modal')));
        return layer ? out.filter(p => !p.el || layer.contains(p.el)) : out;
      }
      const top = p => { if (!p.el) return { l: 0, r: innerWidth, t: innerHeight }; if (!p.el.isConnected) return null; const r = p.el.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top }; };

      function spawn() {
        const el = document.createElement('div'); el.className = 'shp'; el.setAttribute('aria-label', 'Sheep');
        el.innerHTML = `<svg viewBox="0 0 16 10" width="${W}" height="${H}" shape-rendering="crispEdges"></svg><span class="shp-b"></span>`;
        document.body.appendChild(el);
        const s = { el, svg: el.firstChild, x: 80 + Math.random() * (innerWidth - 200), y: -40, vx: 0, vy: 0, dir: Math.random() < .5 ? 1 : -1, on: null, state: 'fall', until: 0, frame: '', step: 0, blinkAt: 0 };
        let drag = null;
        el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); drag = { dx: e.clientX - s.x, dy: e.clientY - s.y, px: e.clientX, py: e.clientY, t: performance.now(), moved: 0, vx: 0, vy: 0 }; s.state = 'held'; s.on = null; el.classList.add('held'); });
        el.addEventListener('pointermove', e => { if (!drag) return; const now = performance.now(), dt = Math.max(1, now - drag.t); drag.vx = (e.clientX - drag.px) / dt * 16; drag.vy = (e.clientY - drag.py) / dt * 16; drag.moved += Math.abs(e.clientX - drag.px) + Math.abs(e.clientY - drag.py); drag.px = e.clientX; drag.py = e.clientY; drag.t = now; s.x = e.clientX - drag.dx; s.y = e.clientY - drag.dy; if (Math.abs(drag.vx) > .5) s.dir = drag.vx > 0 ? 1 : -1; });
        el.addEventListener('pointerup', () => { if (!drag) return; el.classList.remove('held'); const d = drag; drag = null;
          if (d.moved < 6) { baa(s); s.state = 'fall'; s.vy = -4; return; }
          s.vx = Math.max(-25, Math.min(25, d.vx)); s.vy = Math.max(-25, Math.min(25, d.vy)); s.state = 'fall'; if (Math.hypot(s.vx, s.vy) > 10) say(s, 'Wheee!'); });
        flock.push(s); run();
      }
      const BAAS = ['Baa.', 'Baaa!', 'Meh.', 'Baa?', 'baaaaaa', 'Have you chased Acme?', 'Grass is greener on Today.', 'Is it 5 yet?', 'Baa (that means good job)'];
      function say(s, t) { const b = s.el.querySelector('.shp-b'); b.textContent = t; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); clearTimeout(s.sayT); s.sayT = setTimeout(() => b.classList.remove('on'), 1800); }
      function baa(s) { const names = api.clients.list().map(c => c.name); let t = BAAS[(Math.random() * BAAS.length) | 0]; if (/Acme/.test(t)) t = names.length ? `Have you chased ${names[(Math.random() * names.length) | 0]}?` : 'Baa.'; say(s, t); }

      function pick(s, now) {
        if (reduced()) { s.state = 'sleep'; s.until = now + 1e9; return; }
        const idle = now - idleAt > 45000, r = Math.random();
        if (idle && r < .5) { s.state = 'sleep'; s.until = now + 8000 + Math.random() * 15000; return; }
        if (r < .5) { s.state = 'walk'; s.until = now + 2500 + Math.random() * 5000; if (Math.random() < .35) s.dir *= -1; }
        else if (r < .7) { s.state = 'eat'; s.until = now + 1500 + Math.random() * 2500; }
        else if (r < .82) { s.state = 'hop'; s.vy = -5.5; s.vx = s.dir * 1.6; s.on = null; }
        else { s.state = 'stand'; s.until = now + 800 + Math.random() * 2200; }
      }

      function tick(t) {
        const dt = Math.min(3, (t - last) / 16.67); last = t;
        if (t - platT > 500) { platT = t; plats = platforms(); }
        for (const s of flock) {
          if (s.state === 'held') { draw(s, 'fall', t); continue; }
          let p = s.on && top(s.on);
          if (s.on && (!p || s.x + W * .5 < p.l || s.x + W * .5 > p.r)) { s.on = null; s.state = 'fall'; s.vx = s.dir * 1; s.vy = 0; p = null; }
          if (!s.on) {   // flying or falling
            const py = s.y; s.vy += .45 * dt; s.vx *= .995; s.x += s.vx * dt; s.y += s.vy * dt;
            if (s.x < 0) { s.x = 0; s.vx = Math.abs(s.vx) * .6; s.dir = 1; } if (s.x > innerWidth - W) { s.x = innerWidth - W; s.vx = -Math.abs(s.vx) * .6; s.dir = -1; }
            if (s.y < -H * 2 && s.vy < 0) s.vy *= .5;
            if (s.vy > 0) { const feet = s.y + H, pfeet = py + H, cx = s.x + W / 2;
              let land = null; for (const q of plats) if (cx >= q.l && cx <= q.r && pfeet <= q.t + 1 && feet >= q.t && (!land || q.t < land.t)) land = q;
              if (land) { const hard = s.vy > 9; s.y = land.t - H; s.on = land; s.vy = 0; s.vx = 0; s.state = hard ? 'stand' : 'walk'; s.until = t + (hard ? 900 : 2000); if (hard) say(s, 'Oof.'); } }
            draw(s, 'fall', t); continue;
          }
          s.y = p.t - H;
          if (t > s.until) pick(s, t);
          if (s.state === 'walk') { s.x += s.dir * .7 * dt; if (s.x < 0 || s.x > innerWidth - W) { s.dir *= -1; s.x = Math.max(0, Math.min(innerWidth - W, s.x)); } }
          if (s.state === 'hop') { s.on = null; continue; }
          draw(s, s.state === 'walk' ? (Math.floor(t / 180) % 2 ? 'a' : 'b') : s.state === 'eat' ? 'eat' : s.state === 'sleep' ? 'sleep' : (t % 4200 < 140 ? 'blink' : 'stand'), t);
          s.el.classList.toggle('zz', s.state === 'sleep');
        }
        raf = flock.length ? requestAnimationFrame(tick) : 0;
      }
      function draw(s, frame, t) {
        if (s.frame !== frame) { s.svg.innerHTML = FRAMES[frame] || FRAMES.stand; s.frame = frame; }
        s.el.style.transform = `translate(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px)`; s.svg.style.transform = s.dir < 0 ? 'scaleX(-1)' : '';
        if (frame !== 'sleep') s.el.classList.remove('zz');
      }
      const run = () => { if (!raf) { last = performance.now(); plats = platforms(); raf = requestAnimationFrame(tick); } };
      function sync() {
        const n = Math.max(0, Math.min(5, opts().count | 0));
        while (flock.length > n) { const s = flock.pop(); s.el.remove(); }
        while (flock.length < n) spawn();
      }

      G.settings = () => {
        const n = opts().count;
        api.ui.modal('Sheep', `<div class="field"><label>How many sheep</label><div class="seg wrap" id="shp-n">${[0, 1, 2, 3, 5].map(v => `<button data-v="${v}" class="${v === n ? 'on' : ''}">${v === 0 ? 'None' : v}</button>`).join('')}</div>
          <div class="muted" style="font-size:12px;margin-top:6px">They walk on your cards, nap when you're away, and hop when you finish something. Drag one to pick it up; let go mid-swing to throw it.</div></div>`,
          `<button class="btn primary" id="shp-done">Done</button>`);
        document.querySelectorAll('#shp-n button').forEach(b => b.onclick = () => { document.querySelectorAll('#shp-n button').forEach(x => x.classList.toggle('on', x === b)); save({ count: +b.dataset.v }); });
        document.getElementById('shp-done').onclick = () => api.ui.close();
      };
      api.commands.add({ title: 'Let a sheep out', hint: 'A little desktop pet', run: () => { save({ count: Math.min(5, opts().count + 1) }); } });
      api.commands.add({ title: 'Round up the sheep', hint: 'Put them all away', run: () => { save({ count: 0 }); api.ui.toast('All sheep are back in the pen'); } });
      api.commands.add({ title: 'Sheep…', run: () => G.settings() });
      api.on('task:complete', () => { for (const s of flock) if (s.on && Math.random() < .8) { s.state = 'hop'; s.vy = -6 - Math.random() * 2; s.vx = (Math.random() - .5) * 2; s.on = null; if (Math.random() < .4) say(s, 'Baa!'); } });

      if (!document.getElementById('shp-css')) {
        const st = document.createElement('style'); st.id = 'shp-css';
        st.textContent = `
        .shp{position:fixed;left:0;top:0;z-index:84;cursor:grab;touch-action:none;user-select:none;will-change:transform}
        .shp.held{cursor:grabbing}
        .shp svg{display:block;filter:drop-shadow(0 1px 0 rgba(0,0,0,.35)) drop-shadow(0 3px 3px rgba(0,0,0,.15));transform-origin:50% 50%}
        .shp-b{position:absolute;left:50%;bottom:calc(100% + 6px);transform:translateX(-50%) scale(.6);opacity:0;white-space:nowrap;background:#fff;color:#2b2b2b;border:1px solid rgba(0,0,0,.12);border-radius:var(--r);padding:4px 8px;font:600 11.5px/1.2 Inter,system-ui;box-shadow:0 4px 12px rgba(0,0,0,.15);transition:opacity .2s,transform .25s cubic-bezier(.3,1.6,.5,1);pointer-events:none}
        .shp-b.on{opacity:1;transform:translateX(-50%) scale(1)}
        .shp.zz:after{content:'z';position:absolute;right:-2px;top:-10px;font:800 12px ui-rounded,system-ui;color:var(--muted,#888);animation:shpZ 2.2s ease-in-out infinite}
        @keyframes shpZ{0%{opacity:0;transform:translate(0,4px) scale(.7)}40%{opacity:1}100%{opacity:0;transform:translate(8px,-14px) scale(1.2)}}
        @media print{.shp{display:none}}`;
        document.head.appendChild(st);
      }
      G.h = { act: () => { idleAt = performance.now(); for (const s of flock) if (s.state === 'sleep' && Math.random() < .3) s.until = 0; } };
      if (!G.bound) { G.bound = true; for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => G.h.act && G.h.act(), true); }
      G.teardown = () => { cancelAnimationFrame(raf); raf = 0; flock.forEach(s => s.el.remove()); flock = []; G.h = {}; };
      G.flock = () => flock.map(s => ({ x: s.x, y: s.y, state: s.state, on: !!s.on }));
      sync();
    },
  });
})();
