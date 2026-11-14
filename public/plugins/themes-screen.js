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
  R({ id: 'shining', name: 'The Shining', category: TV, tagline: 'The hotel: hexagon carpet underfoot, lamplit wallpaper, typewriter pages on the platen, a brass room plaque, a hedge maze at the edge.',
    fonts: [font('Special Elite', 'special-elite-latin-400-normal.woff2'), font('Courier Prime', 'courier-prime-latin-400-normal.woff2')],
    font: '"Courier Prime","Courier New",monospace',
    vars: { '--ambient': 'off', '--bg': '#e9dcc0', '--panel': '#fbf7ec', '--side': '#6b2716', '--text': '#2a1a12', '--muted': '#6e5a4b', '--faint': '#a08d7a', '--line': '#d9cbb0', '--hover': '#f1e5cc',
      '--accent': '#a3201a', '--on-accent': '#fff', '--accent-soft': '#f3d6cf', '--client': '#8a5a17', '--client-soft': '#efe0bf', '--ok': '#4c7a3b', '--danger': '#a3201a', '--danger-soft': '#f3d6cf', '--r': '1px', '--shadow': '0 2px 0 rgba(60,30,10,.1),0 14px 26px rgba(60,30,10,.18)' },
    preview: { bg: '#e9dcc0', panel: '#fbf7ec', side: '#6b2716', text: '#2a1a12', accent: '#a3201a', line: '#d9cbb0', r: '1px' },
    css: `:skin body{background:linear-gradient(#2a0e08,#2a0e08) left 0 bottom 64px/100% 5px no-repeat,${HEX} left bottom/40px 69px repeat-x,radial-gradient(700px 420px at 72% 6%,rgba(255,196,120,.45),transparent 70%),radial-gradient(500px 300px at 20% 0%,rgba(255,206,140,.25),transparent 70%),
        repeating-linear-gradient(90deg,rgba(120,70,30,.06) 0 2px,transparent 2px 26px,rgba(120,70,30,.04) 26px 27px,transparent 27px 54px),linear-gradient(180deg,#efe3c7,#e2d3b2);background-attachment:fixed}
      :skin .app,:skin .main{background:transparent}
      :skin #view{padding-bottom:70px}
      :skin .side{position:relative;z-index:2;background:${HEX};background-size:56px 97px;color:#f5e6cf;border-right:4px solid #3e140b}
      :skin .side .nav a,:skin .side .ntile,:skin .side .sect,:skin .side .brand,:skin #side-head .brand,:skin .side .muted{color:#f5e6cf}
      :skin .side .ntile,:skin .side .nav a{background:rgba(42,14,8,.55)} :skin .side .ntile.on,:skin .side .nav a.on{background:#2a0e08;color:#ffd9a8}
      :skin .head h1,:skin .c-hero h1,:skin .group-h,:skin .th-cat,:skin .modal-h{font-family:"Special Elite","Courier New",monospace;letter-spacing:.02em}
      :skin .head h1{font-size:36px;color:#2a1a12}
      :skin .group,:skin .gl,:skin .stat,:skin .qa,:skin .modal{position:relative;background:linear-gradient(180deg,rgba(0,0,0,.06),transparent 14px),repeating-linear-gradient(180deg,transparent 0 27px,rgba(120,90,60,.07) 27px 28px),#fbf7ec;border:1px solid #d9cbb0;border-radius:1px;box-shadow:var(--shadow)}
      :skin .group{padding:26px 18px 14px;margin-top:22px}
      :skin .group::before{content:"";position:absolute;left:-14px;right:-14px;top:-16px;height:22px;border-radius:11px;background:linear-gradient(180deg,#3a3634,#121010 55%,#2b2826);box-shadow:0 4px 8px rgba(0,0,0,.35),inset 0 2px 1px rgba(255,255,255,.15)}
      :skin .group::after{content:"237";position:absolute;right:16px;top:14px;font:700 12px/1 "Special Elite",monospace;letter-spacing:.12em;color:#4a3108;padding:5px 9px 4px;border-radius:2px;background:linear-gradient(160deg,#f0d58a,#c49a3a 55%,#e6c46e);box-shadow:0 1px 2px rgba(0,0,0,.35),inset 0 0 0 1px rgba(90,60,10,.4)}
      :skin .group-h{font-size:17px;color:#2a1a12}
      :skin .task:not(.td-b){font-family:"Courier Prime",monospace}
      :skin .task:not(.td-b):hover{background:rgba(255,220,170,.35)}
      :skin .check{border-radius:50%;border:2px solid #2a1a12;background:radial-gradient(circle at 40% 35%,#fff,#e6dccb);box-shadow:0 2px 0 #2a1a12}
      :skin .task.done .check{background:#a3201a;border-color:#5a0f0b}
      :skin .btn{border-radius:1px;font-family:"Courier Prime",monospace} :skin .btn.primary,:skin .meet-btn{background:#a3201a;border-color:#5a0f0b;color:#fff}
      :skin .sh-ding{position:fixed;z-index:3000;pointer-events:none;font:700 14px "Special Elite",monospace;color:#a3201a;letter-spacing:.2em;animation:sh-ding .9s steps(6) forwards}
      @keyframes sh-ding{0%{opacity:0;transform:translateX(30px)}30%{opacity:1;transform:none}80%{opacity:1}to{opacity:0;transform:translateX(-40px)}}`,
    effects: ({ layer }) => {
      // the carriage return: the finished line slides left like a typewriter carriage, with a little bell
      const off = done(t => { const row = rowOf(t), r = row ? row.getBoundingClientRect() : { right: innerWidth / 2, top: innerHeight / 2, height: 0 };
        if (row && row.animate) row.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-22px)' }, { transform: 'translateX(0)' }], { duration: 420, easing: 'steps(5)' });
        const d = document.createElement('div'); d.className = 'sh-ding'; d.textContent = 'ding'; d.style.left = Math.min(innerWidth - 80, r.right - 70) + 'px'; d.style.top = (r.top + 6) + 'px'; layer.appendChild(d); setTimeout(() => d.remove(), 950); });
      return off;
    } });

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
  // the mountain town: big snow-capped peaks, cut-out pine trees, snowy ground, all with a felt-marker outline
  const SP_PEAKS = svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 360" preserveAspectRatio="none"><g stroke="#1b1b1b" stroke-width="3" stroke-linejoin="round">
    <path d="M-10 360L170 90l90 110 120-160 150 190 110-120 170 170 130-150 140 120 140-110 100 90V360z" fill="#7d8fb3"/>
    <path d="M170 90l42 52-18 8-24-20-22 24-18-12zM380 40l58 74-26 6-30-26-20 30-30-18zM640 120l46 50-22 10-24-18-20 16-24-14zM940 130l48 46-26 8-22-16-18 18-24-12z" fill="#fff"/>
    <path d="M-10 360v-90c120-30 250-10 380-26s300 10 450-6 260 16 390 0v122z" fill="#f7fbff"/></g></svg>`);
  const SP_PINES = svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 200"><g stroke="#1b1b1b" stroke-width="3" stroke-linejoin="round" fill="#2f7a3a">
    <path d="M50 20L10 110h22L4 170h92L68 110h22z"/><path d="M160 50l-34 70h18l-24 50h80l-24-50h18z"/></g><g fill="#5a3b22" stroke="#1b1b1b" stroke-width="3"><rect x="42" y="170" width="16" height="24"/><rect x="152" y="170" width="14" height="22"/></g></svg>`);
  R({ id: 'south-park', name: 'South Park', category: TV, tagline: 'Construction-paper cut-outs in a snowy mountain town: felt-marker outlines, jerky stop-motion wobble, falling snow.',
    fonts: [font('Patrick Hand', 'patrick-hand-latin-400-normal.woff2')],
    font: '"Patrick Hand","Comic Sans MS",cursive',
    vars: { '--ambient': 'off', '--bg': '#bfe1f7', '--panel': '#fffdf6', '--side': '#3f8f3c', '--text': '#1b1b1b', '--muted': '#4c4c4c', '--faint': '#7c7c7c', '--line': '#1b1b1b', '--hover': '#fff3cf',
      '--accent': '#e5332a', '--on-accent': '#fff', '--accent-soft': '#ffd9d6', '--client': '#2a6fd6', '--client-soft': '#d9e7fb', '--ok': '#3f8f3c', '--danger': '#e5332a', '--danger-soft': '#ffd9d6', '--r': '3px', '--shadow': '3px 4px 0 rgba(0,0,0,.28)' },
    preview: { bg: 'linear-gradient(180deg,#9ccff0,#bfe1f7 50%,#f7fbff 51%)', panel: '#fffdf6', side: '#3f8f3c', text: '#1b1b1b', accent: '#e5332a', line: '#1b1b1b', r: '3px' },
    css: `:skin body{font-size:17px;background:${SP_PINES} left -20px bottom 2vh/220px auto no-repeat,${SP_PINES} right -30px bottom 1vh/260px auto no-repeat,${SP_PEAKS} bottom/100% 44vh no-repeat,linear-gradient(180deg,#8ec8ef,#bfe1f7 60%);background-attachment:fixed}
      :skin .app,:skin .main{background:transparent}
      :skin #view{position:relative;z-index:1}
      :skin .side{background:${PAPER},#3f8f3c;color:#fff;border-right:3px solid #1b1b1b} :skin .side .nav a,:skin .side .ntile,:skin .side .sect,:skin #side-head .brand,:skin .side .muted{color:#f2fbe9}
      :skin .side .ntile.on,:skin .side .nav a.on{background:#fffdf6;color:#1b1b1b;border:2px solid #1b1b1b;transform:rotate(-1.5deg);box-shadow:2px 3px 0 rgba(0,0,0,.3)}
      :skin .side .ntile.on *,:skin .side .nav a.on *{color:#1b1b1b}
      :skin .group,:skin .gl,:skin .stat,:skin .qa,:skin .modal{background:${PAPER},#fffdf6;border:3px solid #1b1b1b;border-radius:4px 10px 3px 8px/9px 3px 10px 4px;box-shadow:3px 4px 0 rgba(0,0,0,.28)}
      :skin .group{transform:rotate(-.35deg);padding:10px 12px}
      :skin .task:not(.td-b){background:${PAPER},#fff;border:2.5px solid #1b1b1b;border-radius:6px 3px 7px 2px/3px 7px 2px 6px;margin:6px 0;box-shadow:2px 3px 0 rgba(0,0,0,.22)}
      :skin .group .task:not(.td-b):nth-of-type(3n){transform:rotate(-.6deg);background-color:#fff8d6} :skin .group .task:not(.td-b):nth-of-type(3n+1){transform:rotate(.5deg);background-color:#e6f3ff}
      :skin .task:not(.td-b):hover{animation:sp-jerk .36s steps(1) infinite}
      @keyframes sp-jerk{0%{transform:translate(0,0) rotate(-.6deg)}33%{transform:translate(1px,-2px) rotate(.4deg)}66%{transform:translate(-1px,-1px) rotate(-.2deg)}}
      :skin .head h1,:skin .c-hero h1{font-size:46px;transform:rotate(-1.5deg);display:inline-block;background:#fffdf6;border:3px solid #1b1b1b;padding:2px 16px;box-shadow:3px 4px 0 rgba(0,0,0,.28)}
      :skin .group-h{font-size:21px;color:#1b1b1b}
      :skin .check{border:2.5px solid #1b1b1b;border-radius:3px}
      :skin .task.done .check{background:#e5332a}
      :skin .btn{border:2.5px solid #1b1b1b;border-radius:3px;box-shadow:2px 2px 0 rgba(0,0,0,.25)} :skin .btn.primary,:skin .meet-btn{background:#e5332a;color:#fff}
      :skin .chip{border:2px solid #1b1b1b;border-radius:3px;background:#fff8d6}
      :skin .sp-pop{position:fixed;z-index:3000;pointer-events:none;font:28px "Patrick Hand",cursive;color:#fff;background:#e5332a;border:3px solid #1b1b1b;padding:0 12px;box-shadow:3px 4px 0 rgba(0,0,0,.3);animation:sp-pop 1.2s steps(6) forwards}
      @keyframes sp-pop{0%{opacity:0;transform:scale(.3) rotate(-14deg)}20%{opacity:1;transform:scale(1.1) rotate(4deg)}35%{transform:scale(1) rotate(-3deg)}80%{opacity:1}to{opacity:0;transform:translateY(-30px) rotate(6deg)}}
      @media (prefers-reduced-motion:reduce){:skin .task:not(.td-b):hover{animation:none}}`,
    effects: ({ layer, level }) => {
      const words = ['Done!', 'Sweet!', 'Nice!', 'Boom!', 'Yes!'];
      const offDone = done(t => { const row = rowOf(t), r = row ? row.getBoundingClientRect() : { right: innerWidth / 2, top: innerHeight / 2, height: 0 };
        const d = document.createElement('div'); d.className = 'sp-pop'; d.textContent = words[Math.floor(Math.random() * words.length)]; d.style.left = Math.min(innerWidth - 120, r.right - 110) + 'px'; d.style.top = (r.top + r.height / 2 - 22) + 'px'; layer.appendChild(d); setTimeout(() => d.remove(), 1300); });
      const offSnow = particles(layer, level, { n: 60,
      make: any => ({ x: rnd(0, innerWidth), y: any ? rnd(0, innerHeight) : -8, s: rnd(2, 4.5), vy: rnd(.5, 1.2), ph: rnd(0, 6.3) }),
      step: (p, dt) => { p.ph += .03 * dt; p.y += p.vy * dt; p.x += Math.sin(p.ph) * .3 * dt; return p.y < innerHeight + 10; },
      draw: (cx, p) => { cx.fillStyle = '#fff'; cx.strokeStyle = 'rgba(0,0,0,.35)'; cx.lineWidth = .8; cx.beginPath(); cx.arc(p.x, p.y, p.s, 0, 6.3); cx.fill(); cx.stroke(); } });
      return () => { offDone(); offSnow(); };
    } });

  /* ---------------- Over the Garden Wall: a night forest painted like an old storybook plate. Warm near-black, bare
     trees in silhouette, a low moon, aged cream pages framed like vintage postcards, chapter-heading ornaments, a
     lantern swaying in the corner, autumn leaves, and a single leaf let go when you finish something.
     Palette from the show's wiki skin (warm black #1a120b, cream #fffcf2, nav brown #3b322a, old gold #c7ab75);
     the look from its art direction: heavy blacks that still feel warm, strong light against dark. ---------------- */
  const GW_TREES = svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 420" preserveAspectRatio="none"><g fill="#0d0805">
    <path d="M0 420V300c40-10 70 8 110-6s70-30 120-12 90 10 140-8 90 4 140 14 80-20 130-16 90 22 140 8 100-26 160-14 90 20 130 10 100-22 130-18v162z"/>
    <path d="M90 420V150l-4-60-22-30 24 22-2-40 8 44 26-36-22 52 6 60 30-40-28 60 4 220zM300 420V200l-30-70 34 50 4-90 8 96 30-50-26 74 4 210zM520 420V240l-20-40 24 28 6-80 6 84 22-30-18 50v158zM760 420V170l-28-80-30-30 34 22-6-50 16 60 24-60-14 80 34-34-34 60v232zM980 420V210l-24-60 30 40 6-110 8 116 34-56-30 84v196zM1140 420V250l-18-50 24 34 4-70 8 76 20-30-18 50v160z"/></g></svg>`);
  const GW_LANTERN = svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 70"><path d="M20 0v10" stroke="#2c1805" stroke-width="2"/><path d="M12 10h16l-2 6H14z" fill="#2c1805"/><rect x="11" y="16" width="18" height="34" rx="3" fill="#ffcf6b" fill-opacity=".85" stroke="#2c1805" stroke-width="2.5"/><path d="M20 16v34M11 33h18" stroke="#2c1805" stroke-width="1.5" opacity=".7"/><ellipse cx="20" cy="36" rx="4" ry="6" fill="#fff6d6"/><path d="M10 50h20l-3 6H13z" fill="#2c1805"/></svg>`);
  R({ id: 'garden-wall', name: 'Over the Garden Wall', category: TV, tagline: 'A night forest painted like an old storybook plate: bare trees, a low moon, cream postcard pages, a lantern swaying, autumn leaves.',
    fonts: [font('IM Fell English', 'im-fell-english-latin-400-normal.woff2')],
    font: '"IM Fell English",Georgia,serif',
    vars: { '--ambient': 'off', '--bg': '#1a120b', '--panel': '#fffcf2', '--side': '#2a211b', '--text': '#3a3a3a', '--muted': '#6b5a45', '--faint': '#9d9b96', '--line': '#d9ccb2', '--hover': '#f5f2e9',
      '--accent': '#8c3b1f', '--on-accent': '#fffcf2', '--accent-soft': '#f2e1d3', '--client': '#8c6b3e', '--client-soft': '#efe5d2', '--ok': '#4f6b2d', '--danger': '#9a2f1f', '--danger-soft': '#f1d8cf', '--r': '2px', '--shadow': '0 2px 0 #0d0805,0 14px 30px rgba(0,0,0,.45)' },
    preview: { bg: '#1a120b', panel: '#fffcf2', side: '#2a211b', text: '#3a3a3a', accent: '#8c3b1f', line: '#d9ccb2', r: '2px' },
    css: `:skin body{background:${GW_TREES} bottom/100% 46vh no-repeat fixed,radial-gradient(1500px 340px at 55% 88%,rgba(150,96,48,.55),rgba(90,58,30,.25) 45%,transparent 72%),radial-gradient(160px 160px at 82% 16%,rgba(255,236,190,.9),rgba(255,214,140,.25) 45%,transparent 70%),radial-gradient(1000px 520px at 75% 20%,#3b2a1a,transparent 70%),linear-gradient(180deg,#22170e,#1a120b 60%,#0f0a06);background-attachment:fixed;font-size:15.5px}
      :skin .app,:skin .main{background:transparent}
      :skin .side{background:linear-gradient(180deg,rgba(59,50,42,.96),rgba(42,33,27,.97));border-right:1px solid #4f2e0f;color:#e6e6e6}
      :skin .side .nav a,:skin .side .ntile,:skin .side .sect,:skin #side-head .brand,:skin .side .muted{color:#e4d7bd}
      :skin .side .ntile.on,:skin .side .nav a.on{background:rgba(199,171,117,.16);color:#f3e2b8;box-shadow:inset 2px 0 0 #c7ab75}
      :skin #view{color:#e8dcc2}
      :skin #view .group,:skin #view .gl,:skin #view .stat,:skin #view .qa,:skin #view .task:not(.td-b),:skin .modal{color:#3a3a3a}
      :skin .head h1,:skin .c-hero h1{color:#f3e2b8;font-size:40px;font-weight:400;letter-spacing:.01em;text-shadow:0 0 22px rgba(255,214,140,.35),0 2px 0 #0d0805}
      :skin .head .sub,:skin .head .sub *{color:#cdbb95}
      :skin .group-h,:skin .th-cat{display:flex;align-items:center;gap:10px;font-variant:small-caps;letter-spacing:.08em;color:#8c6b3e}
      :skin .group-h::before,:skin .group-h::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,transparent,#b89f84 30%,#b89f84 70%,transparent)}
      :skin .group,:skin .gl,:skin .stat,:skin .qa,:skin .modal{background:radial-gradient(120% 90% at 20% 0%,#fffcf2,#f2efe6 70%,#e9e1cf);border:1px solid #b89f84;box-shadow:inset 0 0 0 4px #fffcf2,inset 0 0 0 5px rgba(140,107,62,.45),0 2px 0 #0d0805,0 16px 34px rgba(0,0,0,.5)}
      :skin .group{padding:12px 14px}
      :skin .task:not(.td-b):hover{background:rgba(184,159,132,.16)}
      :skin .check{border-color:#8c6b3e;border-radius:50%}
      :skin .task.done .check{background:radial-gradient(circle at 40% 35%,#e8a25a,#8c3b1f 70%);border-color:#4f2e0f}
      :skin .btn{border-color:#b89f84} :skin .btn.primary,:skin .meet-btn{background:#8c3b1f;border-color:#4f2e0f;color:#fffcf2}
      :skin a{color:#8c6b3e}
      :skin .gw-lantern{position:fixed;top:-6px;right:7vw;width:40px;height:70px;background:${GW_LANTERN} center/contain no-repeat;transform-origin:50% 0;animation:gw-sway 5s ease-in-out infinite alternate;z-index:5;pointer-events:none;filter:drop-shadow(0 0 18px rgba(255,190,90,.75))}
      :skin .gw-lantern::after{content:"";position:absolute;left:-60px;top:0;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle,rgba(255,200,110,.22),transparent 65%);animation:gw-flicker 2.4s ease-in-out infinite alternate}
      @keyframes gw-sway{from{transform:rotate(-5deg)}to{transform:rotate(5deg)}}
      @keyframes gw-flicker{0%{opacity:.7}40%{opacity:1}55%{opacity:.82}to{opacity:.95}}
      :skin .gw-leaf{position:fixed;width:18px;height:18px;margin:-9px 0 0 -9px;pointer-events:none;z-index:3000;border-radius:0 70% 0 70%;background:linear-gradient(135deg,#e07a2e,#8c3b1f);box-shadow:inset 0 0 0 1px rgba(0,0,0,.2);animation:gw-fall 2.6s cubic-bezier(.3,.1,.5,1) forwards}
      @keyframes gw-fall{0%{opacity:0;transform:translate(0,0) rotate(0)}12%{opacity:1}35%{transform:translate(26px,40px) rotate(70deg)}65%{transform:translate(-18px,90px) rotate(150deg)}to{opacity:0;transform:translate(14px,150px) rotate(260deg)}}
      @media (prefers-reduced-motion:reduce){:skin .gw-lantern,:skin .gw-lantern::after{animation:none}}`,
    enhance: () => { const l = document.createElement('div'); l.className = 'gw-lantern'; document.body.appendChild(l); return () => l.remove(); },
    effects: ctx => {
      const offLeaves = fallingLeaves(['#b5522b', '#c99b3b', '#8c3b1f', '#d4733a', '#6d5a2a'])(ctx);
      const offDone = done(t => { const row = rowOf(t), r = row ? row.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2 };
        const d = document.createElement('div'); d.className = 'gw-leaf'; d.style.left = (r.left + 18) + 'px'; d.style.top = r.top + 'px'; ctx.layer.appendChild(d); setTimeout(() => d.remove(), 2700); });
      return () => { offLeaves(); offDone(); };
    } });

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

  /* ---------------- My Neighbor Totoro: a painted countryside in early summer. Big soft clouds, green hills and rice
     paddies, a huge old camphor tree on the right, watercolour-paper pages, a passing shower now and then, and an acorn
     that drops and bounces when you finish something. Scenery only: none of the film's characters. ---------------- */
  const TT_LAND = svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="none">
    <path d="M0 230C160 170 300 200 430 185S700 140 860 175 1080 150 1200 165V400H0z" fill="#8fbf74"/>
    <path d="M0 265C200 240 340 262 520 248S860 230 1020 245 1150 236 1200 240V400H0z" fill="#6ea85a"/>
    <g fill="#9ccde0" opacity=".55"><path d="M80 320h300l-30 26H50zM430 334h260l-24 22H404zM740 318h330l-28 26H712z"/></g>
    <g stroke="#5b9149" stroke-width="2" opacity=".5"><path d="M50 346h300M404 356h260M712 344h330M0 372h1200"/></g>
    <path d="M0 300C300 288 520 300 760 292S1060 286 1200 290V400H0z" fill="#5c9a4b" opacity=".55"/></svg>`);
  const TT_TREE = svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 520"><path d="M196 520c8-80 6-150-6-220h46c-14 70-18 140-8 220z" fill="#5b4632"/>
    <g fill="#2f6a3a"><circle cx="210" cy="190" r="140"/><circle cx="96" cy="230" r="96"/><circle cx="330" cy="236" r="92"/><circle cx="150" cy="110" r="96"/><circle cx="280" cy="104" r="100"/><circle cx="210" cy="60" r="70"/></g>
    <g fill="#3f8248"><circle cx="170" cy="150" r="70"/><circle cx="270" cy="170" r="66"/><circle cx="120" cy="220" r="52"/><circle cx="320" cy="230" r="48"/><circle cx="220" cy="90" r="50"/></g>
    <g fill="#5aa25c" opacity=".7"><circle cx="150" cy="120" r="30"/><circle cx="250" cy="130" r="26"/><circle cx="300" cy="200" r="22"/><circle cx="110" cy="200" r="20"/></g></svg>`);
  const TT_CLOUD = svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 140"><g fill="#fff"><circle cx="70" cy="95" r="40"/><circle cx="125" cy="70" r="58"/><circle cx="190" cy="80" r="48"/><circle cx="240" cy="100" r="34"/><rect x="40" y="95" width="230" height="40" rx="20"/></g><g fill="#dce9f2"><rect x="44" y="118" width="226" height="18" rx="9"/></g></svg>`);
  R({ id: 'totoro', name: 'My Neighbor Totoro', category: GH, tagline: 'A painted countryside in early summer: big soft clouds, rice paddies, an old camphor tree, a passing shower, acorns.',
    fonts: [font('Nunito', 'nunito-latin-700-normal.woff2', 700), font('Patrick Hand', 'patrick-hand-latin-400-normal.woff2')],
    font: 'Nunito,"Trebuchet MS",sans-serif',
    vars: { '--ambient': 'off', '--bg': '#cfe6f2', '--panel': '#fffcf2', '--side': '#2f5d3a', '--text': '#233227', '--muted': '#55705c', '--faint': '#8aa391', '--line': '#e3dcc6', '--hover': '#f4f1e2',
      '--accent': '#3e7a4e', '--on-accent': '#fff', '--accent-soft': '#d6ead9', '--client': '#4a7fb5', '--client-soft': '#dbe8f5', '--ok': '#3e7a4e', '--danger': '#c4553f', '--danger-soft': '#f6dcd5', '--r': '18px', '--shadow': '0 2px 0 rgba(90,80,50,.08),0 12px 28px rgba(40,70,50,.12)' },
    preview: { bg: 'linear-gradient(180deg,#bcdcef,#cfe6f2 55%,#8fbf74 56%)', panel: '#fffcf2', side: '#2f5d3a', text: '#233227', accent: '#3e7a4e', line: '#e3dcc6', r: '18px' },
    css: `:skin body{background:${TT_TREE} right -30px bottom 12vh/min(24vw,300px) auto no-repeat,${TT_LAND} bottom/100% 38vh no-repeat,
        ${TT_CLOUD} 12% 9%/300px auto no-repeat,${TT_CLOUD} 58% 4%/220px auto no-repeat,${TT_CLOUD} 84% 20%/260px auto no-repeat,${TT_CLOUD} 34% 26%/170px auto no-repeat,
        linear-gradient(180deg,#9fcbe6 0%,#bfe0f0 40%,#d8ecf1 62%,#cfe6d8 100%);background-attachment:fixed}
      :skin .app,:skin .main{background:transparent}
      :skin .side{background:radial-gradient(ellipse 7px 4px at 12px 10px,rgba(150,200,130,.22) 98%,transparent),radial-gradient(ellipse 5px 3px at 32px 30px,rgba(150,200,130,.16) 98%,transparent) 0 0/44px 40px,linear-gradient(180deg,#356842,#2b5535);color:#eaf5ea}
      :skin .side .nav a,:skin .side .ntile,:skin .side .sect,:skin #side-head .brand,:skin .side .muted{color:#e2f0e2} :skin .side .ntile.on,:skin .side .nav a.on{background:rgba(255,255,255,.18);color:#fff;border-radius:14px}
      :skin .head h1,:skin .c-hero h1{color:#24472c;font-size:40px;text-shadow:0 2px 0 rgba(255,255,255,.6)}
      :skin .head .sub,:skin .head .sub *{color:#2f4c36}
      :skin .group-h,:skin .th-cat{font-family:"Patrick Hand",Nunito,sans-serif;font-size:20px;color:#3e7a4e;letter-spacing:.01em;text-transform:none}
      :skin .group-h::before{content:"";display:inline-block;width:12px;height:15px;margin-right:8px;vertical-align:-2px;border-radius:50% 50% 45% 45%/40% 40% 60% 60%;background:radial-gradient(circle at 40% 30%,#c98b4e,#8a5528 70%);box-shadow:inset 0 4px 0 -1px #5b3a1d}
      :skin .group,:skin .gl,:skin .stat,:skin .qa,:skin .modal{background:radial-gradient(130% 120% at 30% 0%,#fffdf6 40%,#f7f1df 85%,#efe6cc);border:1px solid #e3dcc6;border-radius:18px;box-shadow:var(--shadow)}
      :skin .group{padding:10px 14px}
      :skin .task:not(.td-b){border-radius:14px} :skin .task:not(.td-b):hover{background:#f1f6e8}
      :skin .check{border:2px solid #7aa36a;border-radius:50%}
      :skin .task.done .check{background:radial-gradient(circle at 40% 35%,#c98b4e,#8a5528 70%);border-color:#5b3a1d}
      :skin .btn{border-radius:999px} :skin .btn.primary,:skin .meet-btn{background:#3e7a4e;border-color:#3e7a4e;color:#fff}
      :skin .chip{border-radius:999px;background:#e6f2df;border-color:#cfe3c4;color:#2f5d3a}
      :skin .tt-acorn{position:fixed;width:16px;height:20px;margin:-10px 0 0 -8px;pointer-events:none;z-index:3000;border-radius:50% 50% 45% 45%/40% 40% 60% 60%;background:radial-gradient(circle at 40% 30%,#d79a5a,#8a5528 70%);box-shadow:inset 0 6px 0 -1px #5b3a1d;animation:tt-drop 1.3s cubic-bezier(.3,0,.4,1) forwards}
      :skin .tt-acorn::before{content:"";position:absolute;left:7px;top:-4px;width:2px;height:5px;background:#5b3a1d;border-radius:2px}
      @keyframes tt-drop{0%{opacity:0;transform:translateY(-60px) rotate(-20deg)}15%{opacity:1}50%{transform:translateY(0) rotate(10deg)}62%{transform:translateY(-14px) rotate(-6deg)}74%{transform:translateY(0)}84%{transform:translateY(-4px)}92%{transform:translateY(0);opacity:1}to{opacity:0;transform:translateY(0) translateX(14px) rotate(80deg)}}`,
    effects: ({ layer, level }) => {
      const offDone = done(t => { const row = rowOf(t), r = row ? row.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, height: 0 };
        const d = document.createElement('div'); d.className = 'tt-acorn'; d.style.left = (r.left + 18) + 'px'; d.style.top = (r.top + r.height / 2) + 'px'; layer.appendChild(d); setTimeout(() => d.remove(), 1400); });
      // a shower now and then: rain that comes and goes
      let rain = 0, target = 0, t = 0;
      const cycle = () => { target = target ? 0 : 1; t = setTimeout(cycle, target ? rnd(15000, 25000) : rnd(30000, 60000)); }; t = setTimeout(cycle, 4000);
      const off = particles(layer, level, { n: 120,
        make: any => ({ x: rnd(-50, innerWidth), y: any ? rnd(0, innerHeight) : rnd(-60, -10), l: rnd(8, 16), v: rnd(7, 11) }),
        step: (p, dt) => { p.y += p.v * dt; p.x += p.v * .18 * dt; return p.y < innerHeight + 20; },
        draw: (cx, p) => { if (rain < .02) return; cx.strokeStyle = `rgba(90,120,140,${.35 * rain})`; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x + p.l * .18, p.y + p.l); cx.stroke(); },
        every: (cx, dt) => { rain += (target - rain) * .01 * dt; } });
      return () => { clearTimeout(t); off(); offDone(); };
    } });
})();
