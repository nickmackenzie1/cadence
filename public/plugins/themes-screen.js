/* Movie & TV and Studio Ghibli themes (user backlog 2026-11-13). Each borrows a palette, textures, type, props and a
   mood from the film or show, recreated in CSS. Lookalike fonts are fine (user, 13:16); no logos, quotes, stills, and
   no drawings of the actual characters. Fonts we can't ship come from the NAS (data/fonts, api/fonts/<name>) and
   fall back to a vendored one.
   Fonts are vendored (OFL / Apache-2.0, see vendor/themes/CREDITS.md). Effects respect the Effects setting and
   reduced motion (the engine skips effects() then). */
(() => {
  const R = t => window.CadenceThemes.register(t);
  const F = 'vendor/themes/fonts/', font = (family, file, weight = 400) => ({ family, src: F + file, weight });
  const TV = 'Movie & TV', GH = 'Studio Ghibli';
  const svg = s => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

  // a light particle layer for effects: make() a particle, step(p, dt) moves it (false = respawn), draw(cx, p)
  function particles(layer, level, { n, make, step, draw, every }) {
    const cv = document.createElement('canvas'), cx = cv.getContext('2d'), DPR = Math.min(2, devicePixelRatio || 1);
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; layer.appendChild(cv);
    const size = () => { cv.width = innerWidth * DPR; cv.height = innerHeight * DPR; cx.setTransform(DPR, 0, 0, DPR, 0, 0); };
    size(); addEventListener('resize', size);
    const count = Math.round(n * (level === 'low' ? 0.4 : 1)), ps = Array.from({ length: count }, () => make(true));
    let raf = 0, last = performance.now();
    const loop = now => {
      const dt = Math.min(3, (now - last) / 16.7); last = now;
      cx.clearRect(0, 0, innerWidth, innerHeight);
      for (let i = 0; i < ps.length; i++) { if (step(ps[i], dt) === false) ps[i] = make(false); draw(cx, ps[i]); }
      if (every) every(cx, dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', size); cv.remove(); };
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const leaf = (cx, p, cols) => { cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = cols[p.c % cols.length]; cx.globalAlpha = p.o;
    cx.beginPath(); cx.moveTo(0, -p.s); cx.quadraticCurveTo(p.s * .8, 0, 0, p.s); cx.quadraticCurveTo(-p.s * .8, 0, 0, -p.s); cx.fill(); cx.restore(); };
  const fallingLeaves = cols => ({ layer, level }) => particles(layer, level, { n: 22,
    make: any => ({ x: rnd(0, innerWidth), y: any ? rnd(0, innerHeight) : -20, s: rnd(5, 10), r: rnd(0, 6.3), vr: rnd(-.03, .03), vx: rnd(-.4, .4), vy: rnd(.4, 1), ph: rnd(0, 6.3), o: rnd(.5, .9), c: (Math.random() * 9) | 0 }),
    step: (p, dt) => { p.ph += .02 * dt; p.x += (p.vx + Math.sin(p.ph) * .6) * dt; p.y += p.vy * dt; p.r += p.vr * dt; return p.y < innerHeight + 20; },
    draw: (cx, p) => leaf(cx, p, cols) });
  const done = fn => { const h = e => fn(e.detail || {}); document.addEventListener('cadence:task-complete', h); return () => document.removeEventListener('cadence:task-complete', h); };
  const rowOf = t => t && t.id ? document.querySelector(`.task[data-id="${CSS.escape(t.id)}"]:not(.td-b)`) : null;

  /* ---------------- Jurassic Park: jungle, a timber park sign with torches, hazard-striped fence, jeep stripes,
     amber when you finish something, and now and then footprints (and a ripple) from something big ---------------- */
  const PRINT = svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 52"><path fill="#06110a" d="M20 51c-7 0-11-5-9-12L4 24l9 7 3-22 4 20 4-20 3 22 9-7-7 15c2 7-2 12-9 12z"/></svg>');
  R({ id: 'jurassic', name: 'Jurassic Park', category: TV, tagline: 'Deep jungle, a timber park sign with torches, hazard-striped fence and amber. Something big walks by now and then.',
    fonts: [font('Oswald', 'oswald-latin-600-normal.woff2', 600), { family: 'Jurassic Park', src: 'api/fonts/jurassic-park', mine: true }],
    vars: { '--ambient': 'off', '--bg': '#13261b', '--panel': '#1c3326', '--side': '#0e1d14', '--text': '#efe6c8', '--muted': '#b4ac8c', '--faint': '#7b7660', '--line': '#2f4a37', '--hover': '#25402f',
      '--accent': '#e8a317', '--on-accent': '#1a1206', '--accent-soft': 'rgba(232,163,23,.16)', '--client': '#d9541e', '--client-soft': 'rgba(217,84,30,.18)', '--ok': '#6fbf4a', '--danger': '#e0452f', '--danger-soft': 'rgba(224,69,47,.16)', '--r': '6px', '--shadow': '0 8px 20px rgba(0,0,0,.35)' },
    preview: { bg: '#13261b', panel: '#1c3326', side: '#0e1d14', text: '#efe6c8', accent: '#e8a317', line: '#2f4a37', r: '6px' },
    css: `:skin body{background:radial-gradient(900px 500px at 80% 0%,#1f3d2a,transparent 60%),radial-gradient(700px 300px at 10% 100%,#0b1a10,transparent 70%),repeating-linear-gradient(115deg,rgba(255,255,255,.012) 0 3px,transparent 3px 11px),#13261b}
      :skin .app,:skin .main{background:transparent}
      :skin .head h1,:skin .c-hero h1,:skin .group-h,:skin .th-cat,:skin .modal-h{font-family:"Jurassic Park",Oswald,Impact,sans-serif;text-transform:uppercase;letter-spacing:.06em}
      :skin .head h1{position:relative;display:inline-block;margin-top:10px;padding:6px 20px 4px;color:#f4c430;font-size:32px;text-shadow:0 2px 0 #2b1a0c;
        background:repeating-linear-gradient(90deg,rgba(0,0,0,.09) 0 2px,transparent 2px 9px),repeating-linear-gradient(0deg,rgba(255,255,255,.04) 0 1px,transparent 1px 6px),linear-gradient(180deg,#6b4423,#4a2e17);
        border:3px solid #2b1a0c;border-radius:4px;box-shadow:inset 0 0 0 2px #8a5a2e,0 5px 0 #2b1a0c,0 12px 20px rgba(0,0,0,.45)}
      :skin .head h1::before,:skin .head h1::after{content:"";position:absolute;top:-16px;width:12px;height:18px;border-radius:50% 50% 45% 45%/60% 60% 40% 40%;
        background:radial-gradient(circle at 50% 72%,#fff6c2 0 18%,#ffb52e 40%,#e0452f 72%,transparent 74%);filter:drop-shadow(0 0 8px rgba(255,160,40,.8));animation:jp-flame 1.1s ease-in-out infinite alternate;transform-origin:50% 100%}
      :skin .head h1::before{left:-7px} :skin .head h1::after{right:-7px;animation-delay:-.5s}
      @keyframes jp-flame{from{transform:scale(1,1) rotate(-3deg)}to{transform:scale(.88,1.12) rotate(3deg)}}
      :skin .group-h{color:#e8a317;padding-bottom:7px;box-shadow:inset 0 -3px 0 #e8a317,inset 0 -6px 0 #c8102e}
      :skin .btn.primary,:skin .meet-btn{background:#c8102e;border-color:#c8102e;color:#fff;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.05em}
      :skin .side{border-right:7px solid #e8a317;border-image:repeating-linear-gradient(180deg,#e8a317 0 16px,#14100a 16px 32px) 7}
      :skin .qa{border:2px solid #e8a317;background:#1c3326}
      :skin .task:not(.td-b){border-left:3px solid transparent} :skin .task:not(.td-b):hover{border-left-color:#e8a317}
      :skin .task.done .check{background:radial-gradient(circle at 35% 30%,#fff3b0,#ffb21e 45%,#c96a07);border-color:#8a4404}
      :skin .jp-ripple{position:fixed;left:50%;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border:2px solid rgba(232,163,23,.5);border-radius:50%;animation:jp-r 2.2s ease-out forwards;pointer-events:none}
      @keyframes jp-r{to{width:520px;height:520px;margin:-260px 0 0 -260px;opacity:0}}
      :skin .jp-print{position:fixed;width:40px;height:52px;background:${PRINT} center/contain no-repeat;opacity:0;pointer-events:none;animation:jp-p 7s ease-in-out forwards}
      @keyframes jp-p{10%{opacity:.5}70%{opacity:.5}to{opacity:0}}
      :skin .jp-amber{position:fixed;width:24px;height:28px;margin:-14px 0 0 -12px;border-radius:50% 50% 46% 46%/58% 58% 42% 42%;pointer-events:none;z-index:3000;
        background:radial-gradient(circle at 34% 28%,rgba(255,255,255,.75),transparent 24%),radial-gradient(circle at 50% 60%,#ffb21e,#c96a07 70%,#8a4404);box-shadow:0 0 18px rgba(255,170,30,.65);animation:jp-am 1.6s ease-out forwards}
      :skin .jp-amber::after{content:"";position:absolute;left:8px;top:12px;width:8px;height:3px;border-radius:2px;background:#3a1d05;box-shadow:-3px -3px 0 -1px #3a1d05,3px -3px 0 -1px #3a1d05,-3px 3px 0 -1px #3a1d05,3px 3px 0 -1px #3a1d05}
      @keyframes jp-am{0%{opacity:0;transform:translateY(0) scale(.4)}20%{opacity:1;transform:translateY(-10px) scale(1)}to{opacity:0;transform:translateY(-70px) scale(1)}}
      @media (prefers-reduced-motion:reduce){:skin .head h1::before,:skin .head h1::after{animation:none}}`,
    effects: ({ layer }) => {
      const timers = new Set(), later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
      const add = (cls, x, y, extra = '') => { const d = document.createElement('div'); d.className = cls; d.style.cssText = `left:${x}px;top:${y}px;${extra}`; layer.appendChild(d); later(() => d.remove(), 8000); return d; };
      // a ripple from the quick-add box, like footsteps far away
      const ripple = () => { const q = document.querySelector('.qa'); if (q) { const r = q.getBoundingClientRect(); for (let i = 0; i < 3; i++) later(() => add('jp-ripple', r.left + r.width / 2, r.top + r.height / 2), i * 380); } later(ripple, 14000 + Math.random() * 8000); };
      // a trail of big three-toed prints across the bottom of the page
      const walk = () => { const y0 = innerHeight - 90, dir = Math.random() < .5 ? 1 : -1, x0 = dir > 0 ? 40 : innerWidth - 80;
        for (let i = 0; i < 7; i++) later(() => add('jp-print', x0 + dir * i * 120, y0 + (i % 2 ? -22 : 10), `transform:rotate(${dir * 90}deg) scale(${dir > 0 ? 1 : -1},1)`), i * 650);
        later(walk, 40000 + Math.random() * 25000); };
      later(ripple, 5000); later(walk, 12000);
      // finishing a task: a drop of amber with something preserved inside floats up from the row
      const off = done(t => { const row = rowOf(t), r = row ? row.getBoundingClientRect() : { right: innerWidth / 2, top: innerHeight / 2, height: 0 }; add('jp-amber', Math.min(innerWidth - 30, r.right - 40), r.top + r.height / 2); });
      return () => { off(); timers.forEach(clearTimeout); timers.clear(); };
    } });

  /* ---------------- Star Wars: deep space, a gold accent, a tilted crawl for headings, hyperspace when you finish ---------------- */
  R({ id: 'star-wars', name: 'Star Wars', category: TV, tagline: 'Deep space, a twinkling starfield and a gold accent. Finish a task: jump to lightspeed.',
    fonts: [font('Exo 2', 'exo-2-latin-600-normal.woff2', 600)],
    vars: { '--ambient': 'off', '--bg': '#000000', '--panel': 'rgba(14,16,22,.88)', '--side': '#06070a', '--text': '#e9e9e9', '--muted': '#9a9fa8', '--faint': '#5e636c', '--line': '#23262e', '--hover': '#14171e',
      '--accent': '#ffe81f', '--on-accent': '#000', '--accent-soft': 'rgba(255,232,31,.14)', '--client': '#4fa3ff', '--client-soft': 'rgba(79,163,255,.16)', '--ok': '#5bd46b', '--danger': '#ff4d4d', '--danger-soft': 'rgba(255,77,77,.16)', '--r': '4px', '--shadow': '0 0 0 1px #23262e' },
    preview: { bg: '#000', panel: '#0e1016', side: '#06070a', text: '#e9e9e9', accent: '#ffe81f', line: '#23262e', r: '4px' },
    css: `:skin .app,:skin .main{background:transparent}
      :skin .head h1,:skin .c-hero h1{font-family:"Exo 2",sans-serif;color:#ffe81f;text-transform:uppercase;letter-spacing:.14em;transform:perspective(320px) rotateX(14deg);transform-origin:left bottom}
      :skin .group-h,:skin .th-cat{font-family:"Exo 2",sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#ffe81f}
      :skin .task:not(.td-b),:skin .gl,:skin .stat,:skin .qa{border:1px solid #23262e;background:rgba(14,16,22,.85)}
      :skin .btn.primary,:skin .meet-btn{background:#ffe81f;color:#000;border-color:#ffe81f;text-transform:uppercase;letter-spacing:.08em}`,
    effects: ({ layer, level }) => {
      let warp = 0;
      const off = particles(layer, level, { n: 220,
        make: () => ({ x: rnd(0, innerWidth), y: rnd(0, innerHeight), s: rnd(.3, 1.4), tw: rnd(0, 6.3), z: rnd(.2, 1) }),
        step: (p, dt) => { p.tw += .03 * dt; if (warp > 0) { const cx = innerWidth / 2, cy = innerHeight / 2; p.x += (p.x - cx) * .05 * warp * p.z * dt; p.y += (p.y - cy) * .05 * warp * p.z * dt; if (p.x < -20 || p.x > innerWidth + 20 || p.y < -20 || p.y > innerHeight + 20) return false; } },
        draw: (cx, p) => { cx.globalAlpha = .5 + Math.sin(p.tw) * .4; cx.fillStyle = '#fff';
          if (warp > .05) { const dx = (p.x - innerWidth / 2) * .06 * warp, dy = (p.y - innerHeight / 2) * .06 * warp; cx.strokeStyle = '#cfe3ff'; cx.lineWidth = p.s; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x - dx, p.y - dy); cx.stroke(); }
          else { cx.fillRect(p.x, p.y, p.s, p.s); } cx.globalAlpha = 1; },
        every: (cx, dt) => { warp = Math.max(0, warp - .012 * dt); } });
      const un = done(() => { warp = 1.4; });
      return () => { off(); un(); };
    } });

  /* ---------------- The Shining: a hexagon carpet, typewriter type, warm hotel lamps ---------------- */
  const HEX = svg(`<svg xmlns='http://www.w3.org/2000/svg' width='56' height='97' viewBox='0 0 56 97'><rect width='56' height='97' fill='#6b2716'/><g fill='none' stroke-linejoin='miter'><path d='M28 6 L50 18.5 L50 43.5 L28 56 L6 43.5 L6 18.5 Z' stroke='#d5512a' stroke-width='7'/><path d='M28 18 L39 24.3 L39 37.7 L28 44 L17 37.7 L17 24.3 Z' fill='#a92b1f' stroke='#d5512a' stroke-width='3'/><path d='M0 56 L0 97 M56 56 L56 97 M28 56 L28 97' stroke='#d5512a' stroke-width='7'/></g></svg>`);
  R({ id: 'shining', name: 'The Shining', category: TV, tagline: 'A hexagon hotel carpet down the side, typewriter pages, warm lamplight.',
    fonts: [font('Special Elite', 'special-elite-latin-400-normal.woff2'), font('Courier Prime', 'courier-prime-latin-400-normal.woff2')],
    font: '"Courier Prime","Courier New",monospace',
    vars: { '--ambient': 'off', '--bg': '#efe6d2', '--panel': '#fbf6ea', '--side': '#6b2716', '--text': '#2a1a12', '--muted': '#6e5a4b', '--faint': '#a08d7a', '--line': '#d9cbb0', '--hover': '#f1e5cc',
      '--accent': '#b3261e', '--on-accent': '#fff', '--accent-soft': '#f3d6cf', '--client': '#8a5a17', '--client-soft': '#efe0bf', '--ok': '#4c7a3b', '--danger': '#b3261e', '--danger-soft': '#f3d6cf', '--r': '2px', '--shadow': '0 1px 0 #d9cbb0,0 6px 14px rgba(42,26,18,.08)' },
    preview: { bg: '#efe6d2', panel: '#fbf6ea', side: '#6b2716', text: '#2a1a12', accent: '#b3261e', line: '#d9cbb0', r: '2px' },
    css: `:skin .side{background:${HEX};background-size:56px 97px;color:#f5e6cf;border-right:4px solid #3e140b}
      :skin .side .nav a,:skin .side .ntile,:skin .side .sect,:skin .side .brand,:skin #side-head .brand,:skin .side .muted{color:#f5e6cf}
      :skin .side .ntile,:skin .side .nav a{background:rgba(42,14,8,.55)} :skin .side .ntile.on,:skin .side .nav a.on{background:#2a0e08;color:#ffd9a8}
      :skin .head h1,:skin .c-hero h1,:skin .group-h,:skin .th-cat,:skin .modal-h{font-family:"Special Elite","Courier New",monospace;letter-spacing:.02em}
      :skin .head h1{font-size:32px}
      :skin .task:not(.td-b),:skin .gl,:skin .qa{background:#fbf6ea;border:1px solid #d9cbb0}
      :skin body{background:radial-gradient(700px 400px at 70% 10%,rgba(255,196,120,.35),transparent 70%),#efe6d2}` });

  /* ---------------- Kill Bill: yellow and black, a red accent, and a clean slash when you finish ---------------- */
  R({ id: 'kill-bill', name: 'Kill Bill', category: TV, tagline: 'Track-suit yellow and black, condensed caps, and a sword-clean slash through finished tasks.',
    fonts: [font('Anton', 'anton-latin-400-normal.woff2')],
    vars: { '--ambient': 'off', '--bg': '#f5c400', '--panel': '#ffffff', '--side': '#111111', '--text': '#111111', '--muted': '#4a4a4a', '--faint': '#8a7a30', '--line': '#111111', '--hover': '#fff3b0',
      '--accent': '#d7141a', '--on-accent': '#fff', '--accent-soft': '#ffd6d6', '--client': '#111111', '--client-soft': '#ffe98a', '--ok': '#111111', '--danger': '#d7141a', '--danger-soft': '#ffd6d6', '--r': '0px', '--shadow': '5px 5px 0 #111' },
    preview: { bg: '#f5c400', panel: '#fff', side: '#111', text: '#111', accent: '#d7141a', line: '#111', r: '0' },
    css: `:skin .side{color:#f5c400} :skin .side .nav a,:skin .side .ntile,:skin .side .sect,:skin #side-head .brand,:skin .side .muted{color:#f5c400} :skin .side .ntile.on,:skin .side .nav a.on{background:#f5c400;color:#111}
      :skin .head h1,:skin .c-hero h1,:skin .group-h,:skin .th-cat,:skin .modal-h{font-family:Anton,Impact,sans-serif;text-transform:uppercase;letter-spacing:.03em}
      :skin .head h1{font-size:44px;line-height:1}
      :skin .group-h{position:relative;padding-bottom:6px} :skin .group-h::after{content:'';position:absolute;left:0;bottom:0;width:120px;height:4px;background:#d7141a;transform:skewX(-35deg)}
      :skin .task:not(.td-b),:skin .gl,:skin .stat,:skin .qa{border:3px solid #111;box-shadow:5px 5px 0 #111;background:#fff}
      :skin .btn{border:2px solid #111;border-radius:0} :skin .btn.primary,:skin .meet-btn{background:#111;color:#f5c400;border-color:#111}
      :skin .kb-slash{position:fixed;height:3px;background:#d7141a;transform-origin:left center;z-index:3000;pointer-events:none;animation:kb-s .35s cubic-bezier(.2,.9,.2,1) forwards;box-shadow:0 0 6px rgba(215,20,26,.6)}
      @keyframes kb-s{from{transform:rotate(-8deg) scaleX(0)}70%{transform:rotate(-8deg) scaleX(1);opacity:1}to{transform:rotate(-8deg) scaleX(1);opacity:0}}`,
    effects: ({ layer }) => done(t => { const r = rowOf(t) || document.querySelector('.qa'); if (!r) return; const b = r.getBoundingClientRect(), s = document.createElement('div'); s.className = 'kb-slash'; s.style.left = b.left - 10 + 'px'; s.style.top = b.top + b.height / 2 + 'px'; s.style.width = b.width + 20 + 'px'; layer.appendChild(s); setTimeout(() => s.remove(), 500); }) });

  /* ---------------- Titan A.E.: ice-blue deep space, glassy panels, drifting crystals ---------------- */
  R({ id: 'titan-ae', name: 'Titan A.E.', category: TV, tagline: 'Ice-blue deep space, glassy panels with a cyan edge, crystals drifting by.',
    fonts: [font('Exo 2', 'exo-2-latin-600-normal.woff2', 600)],
    vars: { '--ambient': 'off', '--bg': '#06142e', '--panel': 'rgba(13,42,82,.72)', '--side': 'rgba(4,14,34,.92)', '--text': '#e3f4ff', '--muted': '#93b7d6', '--faint': '#5d7fa0', '--line': 'rgba(95,211,255,.28)', '--hover': 'rgba(95,211,255,.12)',
      '--accent': '#5fd3ff', '--on-accent': '#04122a', '--accent-soft': 'rgba(95,211,255,.16)', '--client': '#ffb347', '--client-soft': 'rgba(255,179,71,.16)', '--ok': '#7cf0c4', '--danger': '#ff6b7a', '--danger-soft': 'rgba(255,107,122,.16)', '--r': '10px', '--shadow': '0 0 0 1px rgba(95,211,255,.2),0 10px 30px rgba(0,0,0,.4)' },
    preview: { bg: 'radial-gradient(circle at 70% 30%,#14407a,#06142e 70%)', panel: '#0d2a52', side: '#040e22', text: '#e3f4ff', accent: '#5fd3ff', line: '#1f5f8f', r: '10px' },
    css: `:skin body{background:radial-gradient(1100px 700px at 75% 20%,#123a6e,transparent 65%),radial-gradient(600px 400px at 10% 90%,#0b3a4a,transparent 70%),#06142e}
      :skin .app,:skin .main{background:transparent}
      :skin .task:not(.td-b),:skin .gl,:skin .stat,:skin .qa,:skin .modal{backdrop-filter:blur(8px);border:1px solid rgba(95,211,255,.25)}
      :skin .head h1,:skin .c-hero h1,:skin .group-h,:skin .th-cat{font-family:"Exo 2",sans-serif;letter-spacing:.04em}
      :skin .head h1{text-shadow:0 0 22px rgba(95,211,255,.45)}
      :skin .btn.primary,:skin .meet-btn{background:linear-gradient(180deg,#8ae3ff,#3fb6e8);color:#04122a;border:0}`,
    effects: ({ layer, level }) => particles(layer, level, { n: 26,
      make: any => ({ x: rnd(0, innerWidth), y: any ? rnd(0, innerHeight) : innerHeight + 20, s: rnd(3, 9), r: rnd(0, 6.3), vr: rnd(-.01, .01), vy: rnd(-.35, -.12), vx: rnd(-.15, .15), o: rnd(.25, .7) }),
      step: (p, dt) => { p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; return p.y > -20; },
      draw: (cx, p) => { cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.globalAlpha = p.o; cx.strokeStyle = '#9fe6ff'; cx.shadowColor = '#5fd3ff'; cx.shadowBlur = 8; cx.beginPath();
        for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; cx.lineTo(Math.cos(a) * p.s, Math.sin(a) * p.s); } cx.closePath(); cx.stroke(); cx.restore(); } }) });

  /* ---------------- The Simpsons: the cloud sky drifting by, sunny yellow, a living-room purple, chunky outlines,
     donut checkboxes, and a pink-frosted donut with sprinkles when you finish something ---------------- */
  const CLOUD = svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 90"><g fill="#fff"><circle cx="50" cy="58" r="30"/><circle cx="92" cy="40" r="38"/><circle cx="140" cy="48" r="32"/><circle cx="178" cy="62" r="24"/><rect x="40" y="58" width="150" height="30" rx="15"/></g></svg>');
  const DONUT = 'radial-gradient(circle,var(--bg) 0 22%,#1d1d1d 23% 26%,transparent 27%),'
    + 'radial-gradient(circle at 38% 34%,#fff 0 6%,transparent 7%),radial-gradient(circle at 64% 30%,#ffd90f 0 6%,transparent 7%),radial-gradient(circle at 72% 58%,#3fb4ff 0 6%,transparent 7%),radial-gradient(circle at 30% 62%,#7ad04f 0 6%,transparent 7%),radial-gradient(circle at 52% 78%,#fff 0 6%,transparent 7%),'
    + 'radial-gradient(circle,transparent 0 30%,#f78fb3 31% 62%,#e2a35b 63% 72%,#1d1d1d 73% 78%,transparent 79%)';
  R({ id: 'simpsons', name: 'The Simpsons', category: TV, tagline: 'The cloud sky drifting by, sunny yellow, living-room purple, chunky outlines and donuts. Add Simpsonfont to the NAS fonts folder for the lettering.',
    fonts: [font('Fredoka', 'fredoka-latin-600-normal.woff2', 600), { family: 'Simpsonfont', src: 'api/fonts/simpsonfont', mine: true }],
    font: 'Fredoka,"Trebuchet MS",sans-serif',
    vars: { '--ambient': 'off', '--bg': '#70d1fe', '--panel': '#ffffff', '--side': '#fff3a8', '--text': '#1d1d1d', '--muted': '#55585e', '--faint': '#8a8d93', '--line': '#1d1d1d', '--hover': '#fff7c7',
      '--accent': '#8a5fb8', '--on-accent': '#fff', '--accent-soft': '#eadcf8', '--client': '#f26d8b', '--client-soft': '#ffdce5', '--ok': '#3aa64b', '--danger': '#e2352b', '--danger-soft': '#ffd8d4', '--r': '14px', '--shadow': '3px 3px 0 #1d1d1d' },
    preview: { bg: '#70d1fe', panel: '#fff', side: '#fff3a8', text: '#1d1d1d', accent: '#8a5fb8', line: '#1d1d1d', r: '14px' },
    css: `:skin body{background:${CLOUD} 6% 10%/260px auto no-repeat,${CLOUD} 78% 22%/320px auto no-repeat,${CLOUD} 40% 78%/220px auto no-repeat,${CLOUD} 96% 88%/180px auto no-repeat,linear-gradient(180deg,#5cc8fb,#8fdcff);background-attachment:fixed}
      :skin .app,:skin .main{background:transparent}
      :skin .sp-sky{position:fixed;inset:0;z-index:-1;background:${CLOUD} 0 0/300px auto repeat-x;background-position:0 14%;opacity:.85;animation:sp-drift 90s linear infinite;pointer-events:none}
      :skin .sp-sky.b{background-size:200px auto;background-position:0 62%;opacity:.6;animation-duration:140s}
      @keyframes sp-drift{to{background-position-x:-1200px}}
      :skin .head h1,:skin .c-hero h1{font-family:Simpsonfont,Fredoka,sans-serif;color:#ffd90f;-webkit-text-stroke:2px #1d1d1d;paint-order:stroke fill;font-size:40px;letter-spacing:.01em;text-shadow:3px 3px 0 #1d1d1d}
      :skin .group-h{font-family:Simpsonfont,Fredoka,sans-serif;color:#1d1d1d;background:#ffd90f;display:inline-block;padding:2px 12px;border:2px solid #1d1d1d;border-radius:999px;box-shadow:2px 2px 0 #1d1d1d}
      :skin .head .sub,:skin .head .sub *{color:#1d1d1d}
      :skin .task:not(.td-b),:skin .gl,:skin .stat,:skin .qa{border:2px solid #1d1d1d;box-shadow:3px 3px 0 #1d1d1d;background:#fff}
      :skin .task:not(.td-b):hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 #1d1d1d}
      :skin .task.done .check{background:${DONUT};border-color:transparent} :skin .task.done .check svg{opacity:0}
      :skin .btn{border:2px solid #1d1d1d;border-radius:999px} :skin .btn.primary,:skin .meet-btn{background:#ffd90f;color:#1d1d1d;border:2px solid #1d1d1d}
      :skin .chip{background:#ffdce5;border:1.5px solid #1d1d1d}
      :skin .side{border-right:2px solid #1d1d1d}
      :skin .sp-donut{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:${DONUT.replace('var(--bg)', 'transparent')};pointer-events:none;z-index:3000;animation:sp-pop 1.5s cubic-bezier(.2,1.6,.4,1) forwards}
      @keyframes sp-pop{0%{opacity:0;transform:scale(.2) rotate(-40deg)}25%{opacity:1;transform:scale(1.1) rotate(0)}70%{opacity:1;transform:scale(1) rotate(10deg) translateY(-12px)}to{opacity:0;transform:scale(.9) translateY(-40px)}}`,
    effects: ({ layer }) => {
      const a = document.createElement('div'), b = document.createElement('div'); a.className = 'sp-sky'; b.className = 'sp-sky b'; document.body.prepend(b, a); // behind the page, not in the fx layer on top
      const off = done(t => { const row = rowOf(t), r = row ? row.getBoundingClientRect() : { right: innerWidth / 2, top: innerHeight / 2, height: 0 };
        const d = document.createElement('div'); d.className = 'sp-donut'; d.style.left = Math.min(innerWidth - 30, r.right - 44) + 'px'; d.style.top = r.top + r.height / 2 + 'px'; layer.appendChild(d); setTimeout(() => d.remove(), 1600); });
      return () => { off(); a.remove(); b.remove(); };
    } });

  /* ---------------- Family Guy: a suburban living room, royal blue, warm beige stripes ---------------- */
  R({ id: 'family-guy', name: 'Family Guy', category: TV, tagline: 'Suburban living room: beige striped walls, royal blue, a red-letter accent.',
    fonts: [font('Fredoka', 'fredoka-latin-600-normal.woff2', 600)],
    vars: { '--ambient': 'off', '--bg': '#ece3c8', '--panel': '#fffaf0', '--side': '#2c4f9e', '--text': '#1f2430', '--muted': '#5d6170', '--faint': '#8f907f', '--line': '#d5c9a6', '--hover': '#f4ecd5',
      '--accent': '#2c4f9e', '--on-accent': '#fff', '--accent-soft': '#dbe3f5', '--client': '#d63b2c', '--client-soft': '#f8d9d4', '--ok': '#4c8c3a', '--danger': '#d63b2c', '--danger-soft': '#f8d9d4', '--r': '10px', '--shadow': '0 2px 0 #d5c9a6,0 8px 18px rgba(31,36,48,.08)' },
    preview: { bg: '#ece3c8', panel: '#fffaf0', side: '#2c4f9e', text: '#1f2430', accent: '#d63b2c', line: '#d5c9a6', r: '10px' },
    css: `:skin body{background:repeating-linear-gradient(90deg,#ece3c8 0 34px,#e5dbbd 34px 38px)}
      :skin .app,:skin .main{background:transparent}
      :skin .side{color:#fff} :skin .side .nav a,:skin .side .ntile,:skin .side .sect,:skin #side-head .brand,:skin .side .muted{color:#e6ecfb} :skin .side .ntile.on,:skin .side .nav a.on{background:rgba(255,255,255,.18);color:#fff}
      :skin .head h1,:skin .c-hero h1,:skin .group-h,:skin .th-cat{font-family:Fredoka,sans-serif}
      :skin .head h1{color:#2c4f9e;font-size:36px}
      :skin .btn.primary,:skin .meet-btn{background:#d63b2c;border-color:#d63b2c;color:#fff}` });

  /* ---------------- South Park: construction paper, cut-out cards, a snowy mountain town ---------------- */
  const PAPER = 'repeating-linear-gradient(0deg,rgba(0,0,0,.018) 0 1px,transparent 1px 3px),repeating-linear-gradient(90deg,rgba(0,0,0,.012) 0 1px,transparent 1px 4px)';
  R({ id: 'south-park', name: 'South Park', category: TV, tagline: 'Construction-paper cut-outs on a snowy mountain town, wobbly hand lettering.',
    fonts: [font('Patrick Hand', 'patrick-hand-latin-400-normal.woff2')],
    font: '"Patrick Hand","Comic Sans MS",cursive',
    vars: { '--ambient': 'off', '--bg': '#dfeefa', '--panel': '#fffdf6', '--side': '#3f8f3c', '--text': '#1b1b1b', '--muted': '#4c4c4c', '--faint': '#7c7c7c', '--line': '#1b1b1b', '--hover': '#fff3cf',
      '--accent': '#e5332a', '--on-accent': '#fff', '--accent-soft': '#ffd9d6', '--client': '#2a6fd6', '--client-soft': '#d9e7fb', '--ok': '#3f8f3c', '--danger': '#e5332a', '--danger-soft': '#ffd9d6', '--r': '3px', '--shadow': '2px 3px 0 rgba(0,0,0,.25)' },
    preview: { bg: '#dfeefa', panel: '#fffdf6', side: '#3f8f3c', text: '#1b1b1b', accent: '#e5332a', line: '#1b1b1b', r: '3px' },
    css: `:skin body{font-size:16px;background:linear-gradient(180deg,#bfe1f7,#dfeefa 55%);background-attachment:fixed}
      :skin .main::after{content:'';position:fixed;left:0;right:0;bottom:0;height:120px;pointer-events:none;z-index:0;background:radial-gradient(60% 120px at 20% 100%,#f7fbff 98%,transparent),radial-gradient(55% 140px at 75% 100%,#eef6fd 98%,transparent)}
      :skin #view{position:relative;z-index:1}
      :skin .side{background:${PAPER},#3f8f3c;color:#fff} :skin .side .nav a,:skin .side .ntile,:skin .side .sect,:skin #side-head .brand,:skin .side .muted{color:#f2fbe9}
      :skin .task:not(.td-b),:skin .gl,:skin .stat,:skin .qa{background:${PAPER},#fffdf6;border:2px solid #1b1b1b;box-shadow:2px 3px 0 rgba(0,0,0,.25)}
      :skin .group .task:not(.td-b):nth-of-type(3n){transform:rotate(-.4deg)} :skin .group .task:not(.td-b):nth-of-type(3n+1){transform:rotate(.35deg)}
      :skin .head h1,:skin .c-hero h1{font-size:40px;transform:rotate(-1deg)}
      :skin .btn{border:2px solid #1b1b1b;border-radius:3px} :skin .btn.primary,:skin .meet-btn{background:#e5332a;color:#fff}`,
    effects: ({ layer, level }) => particles(layer, level, { n: 60,
      make: any => ({ x: rnd(0, innerWidth), y: any ? rnd(0, innerHeight) : -8, s: rnd(2, 4.5), vy: rnd(.5, 1.2), ph: rnd(0, 6.3) }),
      step: (p, dt) => { p.ph += .03 * dt; p.y += p.vy * dt; p.x += Math.sin(p.ph) * .3 * dt; return p.y < innerHeight + 10; },
      draw: (cx, p) => { cx.fillStyle = '#fff'; cx.strokeStyle = 'rgba(0,0,0,.35)'; cx.lineWidth = .8; cx.beginPath(); cx.arc(p.x, p.y, p.s, 0, 6.3); cx.fill(); cx.stroke(); } }) });

  /* ---------------- Over the Garden Wall: an old storybook in autumn, lantern glow, falling leaves ---------------- */
  R({ id: 'garden-wall', name: 'Over the Garden Wall', category: TV, tagline: 'An old storybook in autumn: aged paper, rust and gold, lantern light, leaves falling.',
    fonts: [font('IM Fell English', 'im-fell-english-latin-400-normal.woff2')],
    font: '"IM Fell English",Georgia,serif',
    vars: { '--ambient': 'off', '--bg': '#2b2118', '--panel': '#e9dcc0', '--side': '#1e1712', '--text': '#2b2118', '--muted': '#6d5a44', '--faint': '#9a8668', '--line': '#c9b48f', '--hover': '#e1d0ad',
      '--accent': '#b5522b', '--on-accent': '#fff', '--accent-soft': '#efd2c1', '--client': '#7a5a1e', '--client-soft': '#ead8b0', '--ok': '#5b7a35', '--danger': '#a33224', '--danger-soft': '#efcfc4', '--r': '4px', '--shadow': '0 3px 0 #1e1712,0 12px 30px rgba(0,0,0,.35)' },
    preview: { bg: '#2b2118', panel: '#e9dcc0', side: '#1e1712', text: '#2b2118', accent: '#b5522b', line: '#c9b48f', r: '4px' },
    css: `:skin body{background:radial-gradient(900px 600px at 60% 30%,#4a3524,transparent 70%),#2b2118;font-size:15.5px}
      :skin .app,:skin .main{background:transparent}
      :skin .side{color:#e9dcc0} :skin .side .nav a,:skin .side .ntile,:skin .side .sect,:skin #side-head .brand,:skin .side .muted{color:#e2d1ad} :skin .side .ntile.on,:skin .side .nav a.on{background:rgba(201,155,59,.18);color:#f3d27a}
      :skin #view{color:#ecdcb8} :skin #view .group,:skin #view .gl,:skin #view .stat,:skin #view .qa,:skin #view .task:not(.td-b),:skin .modal{color:#2b2118}
      :skin .head h1,:skin .c-hero h1{color:#f3d27a;font-size:38px;text-shadow:0 0 24px rgba(243,210,122,.3)}
      :skin .group,:skin .gl,:skin .stat,:skin .qa{background:radial-gradient(circle at 15% 10%,rgba(255,255,255,.3),transparent 50%),#e9dcc0;border:1px solid #c9b48f}
      :skin .group{padding:8px 10px}
      :skin .btn.primary,:skin .meet-btn{background:#b5522b;border-color:#8a3c1e;color:#fff}`,
    effects: fallingLeaves(['#b5522b', '#c99b3b', '#8a3c1e', '#d4733a', '#6d5a2a']) });

  /* ---------------- Spirited Away: dusk over a bathhouse, red lacquer, gold, paper lanterns rising ---------------- */
  R({ id: 'spirited-away', name: 'Spirited Away', category: GH, tagline: 'Dusk over a bathhouse: red lacquer, gold trim, paper lanterns drifting up.',
    fonts: [font('Cormorant Garamond', 'cormorant-garamond-latin-600-normal.woff2', 600)],
    vars: { '--ambient': 'off', '--bg': '#1b2240', '--panel': '#3a1214', '--side': '#140f22', '--text': '#f6e7cf', '--muted': '#cdb48f', '--faint': '#8f7a60', '--line': '#6b2a22', '--hover': '#4a191a',
      '--accent': '#e2452e', '--on-accent': '#fff', '--accent-soft': 'rgba(226,69,46,.2)', '--client': '#d9a441', '--client-soft': 'rgba(217,164,65,.18)', '--ok': '#7fbf8a', '--danger': '#ff6b5a', '--danger-soft': 'rgba(255,107,90,.16)', '--r': '6px', '--shadow': '0 0 0 1px #6b2a22,0 10px 26px rgba(0,0,0,.4)' },
    preview: { bg: 'linear-gradient(180deg,#1b2240,#7a2e2e)', panel: '#3a1214', side: '#140f22', text: '#f6e7cf', accent: '#e2452e', line: '#6b2a22', r: '6px' },
    css: `:skin body{background:linear-gradient(180deg,#141a36 0%,#2a2350 45%,#7a2e2e 100%);background-attachment:fixed}
      :skin .app,:skin .main{background:transparent}
      :skin .head h1,:skin .c-hero h1,:skin .group-h,:skin .th-cat,:skin .modal-h{font-family:"Cormorant Garamond",Georgia,serif;font-weight:600;letter-spacing:.02em}
      :skin .head h1{font-size:40px;color:#f3c76b}
      :skin .task:not(.td-b),:skin .gl,:skin .stat,:skin .qa{border:1px solid #6b2a22;border-top:2px solid #d9a441}
      :skin .btn.primary,:skin .meet-btn{background:#e2452e;border-color:#b5301d;color:#fff}`,
    effects: ({ layer, level }) => particles(layer, level, { n: 14,
      make: any => ({ x: rnd(0, innerWidth), y: any ? rnd(innerHeight * .3, innerHeight) : innerHeight + 40, s: rnd(7, 14), vy: rnd(-.45, -.2), ph: rnd(0, 6.3), fl: rnd(0, 6.3) }),
      step: (p, dt) => { p.ph += .01 * dt; p.fl += .2 * dt; p.y += p.vy * dt; p.x += Math.sin(p.ph) * .25 * dt; return p.y > -40; },
      draw: (cx, p) => { const g = .75 + Math.sin(p.fl) * .08; cx.save(); cx.translate(p.x, p.y); cx.shadowColor = 'rgba(255,170,90,.9)'; cx.shadowBlur = 18 * g;
        cx.fillStyle = `rgba(255,${Math.round(150 + 40 * g)},90,${.8 * g})`; cx.beginPath(); cx.ellipse(0, 0, p.s * .7, p.s, 0, 0, 6.3); cx.fill();
        cx.shadowBlur = 0; cx.fillStyle = 'rgba(80,20,10,.6)'; cx.fillRect(-p.s * .45, -p.s - 2, p.s * .9, 3); cx.fillRect(-p.s * .45, p.s - 1, p.s * .9, 3); cx.restore(); } }) });

  /* ---------------- My Neighbor Totoro: a green countryside after rain, soft painted sky, gentle showers ---------------- */
  R({ id: 'totoro', name: 'My Neighbor Totoro', category: GH, tagline: 'Green countryside under a soft painted sky, rounded friendly type, the odd gentle shower.',
    fonts: [font('Nunito', 'nunito-latin-700-normal.woff2', 700)],
    font: 'Nunito,"Trebuchet MS",sans-serif',
    vars: { '--ambient': 'off', '--bg': '#dfeee4', '--panel': '#fbfaf2', '--side': '#2f5d3a', '--text': '#203226', '--muted': '#55705c', '--faint': '#8aa391', '--line': '#cfe0cf', '--hover': '#eef5e8',
      '--accent': '#3e7a4e', '--on-accent': '#fff', '--accent-soft': '#d6ead9', '--client': '#4a7fb5', '--client-soft': '#dbe8f5', '--ok': '#3e7a4e', '--danger': '#c4553f', '--danger-soft': '#f6dcd5', '--r': '16px', '--shadow': '0 2px 0 #cfe0cf,0 10px 24px rgba(32,50,38,.08)' },
    preview: { bg: 'linear-gradient(180deg,#cfe6f2,#dfeee4 60%,#a9cf9f)', panel: '#fbfaf2', side: '#2f5d3a', text: '#203226', accent: '#3e7a4e', line: '#cfe0cf', r: '16px' },
    css: `:skin body{background:linear-gradient(180deg,#cfe6f2 0%,#dfeee4 55%,#bcdcae 100%);background-attachment:fixed}
      :skin .app,:skin .main{background:transparent}
      :skin .side{color:#eaf5ea} :skin .side .nav a,:skin .side .ntile,:skin .side .sect,:skin #side-head .brand,:skin .side .muted{color:#e2f0e2} :skin .side .ntile.on,:skin .side .nav a.on{background:rgba(255,255,255,.16);color:#fff}
      :skin .head h1,:skin .c-hero h1{color:#2f5d3a;font-size:36px}
      :skin .task:not(.td-b),:skin .gl,:skin .stat,:skin .qa{border-radius:16px}
      :skin .btn{border-radius:999px} :skin .btn.primary,:skin .meet-btn{background:#3e7a4e;border-color:#3e7a4e;color:#fff}`,
    effects: ({ layer, level }) => {
      // a shower now and then: rain that comes and goes
      let rain = 0, target = 0, t = 0;
      const cycle = () => { target = target ? 0 : 1; t = setTimeout(cycle, target ? rnd(15000, 25000) : rnd(30000, 60000)); }; t = setTimeout(cycle, 4000);
      const off = particles(layer, level, { n: 120,
        make: any => ({ x: rnd(-50, innerWidth), y: any ? rnd(0, innerHeight) : rnd(-60, -10), l: rnd(8, 16), v: rnd(7, 11) }),
        step: (p, dt) => { p.y += p.v * dt; p.x += p.v * .18 * dt; return p.y < innerHeight + 20; },
        draw: (cx, p) => { if (rain < .02) return; cx.strokeStyle = `rgba(90,120,140,${.35 * rain})`; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x + p.l * .18, p.y + p.l); cx.stroke(); },
        every: (cx, dt) => { rain += (target - rain) * .01 * dt; } });
      return () => { clearTimeout(t); off(); };
    } });
})();
