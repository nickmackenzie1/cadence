/* Games themes (user backlog 2026-11-13). Each one recreates a game's look in CSS: palette, menus, type, props.
   Lookalike fonts are fine; no logos, quotes, or drawings of the actual characters, and in-game items are drawn as
   our own generic versions (a cut gem, not the game's currency). Fonts we can't ship are read from the NAS
   (data/fonts, api/fonts/<name>) and fall back to a vendored one. */
(() => {
  const R = t => window.CadenceThemes.register(t);
  const F = 'vendor/themes/fonts/', font = (family, file, weight = 400) => ({ family, src: F + file, weight });
  const today = api => api.util.ymd(new Date());
  const doneToday = api => api.tasks.list(x => x.done && x.doneAt && api.util.ymd(new Date(x.doneAt)) === today(api)).length;
  const dueToday = api => api.tasks.list(x => !x.done && x.dueDate && x.dueDate <= today(api)).length;
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ---------------- Breath of the Wild: the slate menu. Dusk over green hills, dark glass panels with thin cream
     frames, a bright corner-bracket cursor on the task you point at, ancient-blue accents, a stamina wheel that fills
     as you finish today's tasks, an item-get card for each one, and drifting spirit lights. ---------------- */
  const corners = c => [0, 1].flatMap(x => [0, 1].map(y => `linear-gradient(${c},${c}) ${x ? 'right' : 'left'} ${y ? 'bottom' : 'top'}/12px 2px no-repeat,linear-gradient(${c},${c}) ${x ? 'right' : 'left'} ${y ? 'bottom' : 'top'}/2px 12px no-repeat`)).join(',');
  const GEM = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12l4 6-10 12L2 9z" fill="#5fd3ee"/><path d="M6 3l3 6h6l3-6M2 9h20M9 9l3 12 3-12" fill="none" stroke="#e9fbff" stroke-width="1" opacity=".75"/></svg>';
  const botwEnhance = ({ api }) => {
    if (!api) return;
    const wheel = document.createElement('div'); wheel.className = 'bw-wheel';
    const draw = () => { const d = doneToday(api), all = Math.max(1, Math.min(12, d + dueToday(api))), f = Math.min(1, d / all);
      wheel.style.setProperty('--f', f); wheel.title = `${d} of ${all} done today`; wheel.classList.toggle('full', d > 0 && f >= 1); };
    document.body.appendChild(wheel); draw();
    const on = e => {
      setTimeout(draw, 60);
      const t = (e && e.detail) || {}; const card = document.createElement('div'); card.className = 'bw-get';
      card.innerHTML = `${GEM}<div><small>Done</small><b></b></div>`; card.querySelector('b').textContent = t.title || 'Task';
      document.body.appendChild(card); setTimeout(() => card.classList.add('out'), 2600); setTimeout(() => card.remove(), 3200);
    };
    document.addEventListener('cadence:task-complete', on);
    const tick = setInterval(draw, 60000);
    return () => { document.removeEventListener('cadence:task-complete', on); clearInterval(tick); wheel.remove(); document.querySelectorAll('.bw-get').forEach(x => x.remove()); };
  };
  R({ id: 'botw', name: 'Breath of the Wild', category: 'Games', tagline: 'The slate menu: dark glass over dusk hills, cream frames, a glowing cursor, a stamina wheel for today. Add Hylia Serif to the NAS fonts folder for the lettering.',
    fonts: [font('Cinzel', 'cinzel-latin-500-normal.woff2', 500), font('Cinzel', 'cinzel-latin-700-normal.woff2', 700), font('Public Sans', 'public-sans-latin-400-normal.woff2', 400), font('Public Sans', 'public-sans-latin-700-normal.woff2', 700), { family: 'Hylia Serif', src: 'api/fonts/hylia-serif', mine: true }],
    font: '"Public Sans",system-ui,sans-serif',
    vars: { '--ambient': 'off', '--bg': '#101a17', '--panel': 'rgba(8,11,11,.74)', '--side': 'rgba(5,8,8,.82)', '--text': '#f1ead6', '--muted': '#bdb59e', '--faint': '#8a846f', '--line': 'rgba(241,234,214,.2)', '--hover': 'rgba(241,234,214,.07)',
      '--accent': '#5fd3ee', '--on-accent': '#04161b', '--accent-soft': 'rgba(95,211,238,.16)', '--client': '#e8c66a', '--client-soft': 'rgba(232,198,106,.16)', '--ok': '#8fd16a', '--danger': '#e8775f', '--danger-soft': 'rgba(232,119,95,.16)', '--r': '3px', '--shadow': '0 0 0 1px rgba(241,234,214,.16),0 10px 30px rgba(0,0,0,.35)' },
    preview: { bg: '#2c4a52', panel: '#0b0f0f', side: '#060909', text: '#f1ead6', accent: '#5fd3ee', line: '#5b594c', r: '3px' },
    enhance: botwEnhance,
    css: `:skin body{background:
        radial-gradient(1400px 260px at 30% 78%,#1e3a26 0 60%,transparent 61%),radial-gradient(1100px 240px at 85% 84%,#173020 0 62%,transparent 63%),
        radial-gradient(900px 200px at 55% 70%,rgba(64,96,84,.55) 0 55%,transparent 70%),radial-gradient(500px 160px at 72% 62%,rgba(150,160,150,.18),transparent 70%),
        radial-gradient(180px 180px at 82% 30%,rgba(255,226,170,.55),transparent 70%),
        linear-gradient(180deg,#1d3240 0%,#3a5866 38%,#b49a72 66%,#2b4630 67%,#12231a 100%);background-attachment:fixed}
      :skin .app,:skin .main{background:transparent}
      :skin .side{backdrop-filter:blur(6px);border-right:1px solid rgba(241,234,214,.22)}
      :skin .side .nav a.on,:skin .side .ntile.on{background:transparent;color:#fff;box-shadow:inset 0 -2px 0 #5fd3ee;text-shadow:0 0 10px rgba(95,211,238,.6)}
      :skin .side .sect{font-family:"Hylia Serif",Cinzel,serif;letter-spacing:.12em;color:#e8c66a}
      :skin .head h1,:skin .c-hero h1{font-family:"Hylia Serif",Cinzel,serif;font-weight:700;color:#f6eed4;letter-spacing:.06em;text-shadow:0 2px 10px rgba(0,0,0,.6)}
      :skin .head .sub,:skin .head .sub *{color:#d9d0b6}
      :skin .group-h,:skin .th-cat,:skin .modal-h{font-family:"Hylia Serif",Cinzel,serif;color:#e8c66a;letter-spacing:.1em;text-transform:none;border-bottom:1px solid rgba(241,234,214,.25);padding-bottom:4px}
      :skin .group,:skin .gl,:skin .stat,:skin .qa,:skin .modal,:skin .drawer{background:rgba(8,11,11,.74);backdrop-filter:blur(8px);border:1px solid rgba(241,234,214,.28);box-shadow:inset 0 0 0 3px rgba(8,11,11,.6),inset 0 0 0 4px rgba(241,234,214,.1)}
      :skin .task:not(.td-b){border:1px solid transparent;border-radius:2px;transition:background-color .15s,box-shadow .15s}
      :skin .task:not(.td-b):hover,:skin .task:not(.td-b).sel{background:${corners('#fff5c8')},radial-gradient(120% 140% at 50% 50%,rgba(255,240,190,.12),rgba(255,240,190,.03));box-shadow:0 0 14px rgba(255,236,170,.18);border-color:rgba(255,245,200,.35)}
      :skin .check{border:1.5px solid #cfc6aa;border-radius:2px;transform:rotate(45deg) scale(.78);background:rgba(0,0,0,.35)}
      :skin .task.done .check{background:#5fd3ee;border-color:#e9fbff;box-shadow:0 0 10px rgba(95,211,238,.8)} :skin .task.done .check svg{transform:rotate(-45deg);color:#04161b}
      :skin .btn{background:rgba(8,11,11,.6);border:1px solid rgba(241,234,214,.35);color:#f1ead6;border-radius:2px}
      :skin .btn:hover{border-color:#fff5c8;box-shadow:0 0 10px rgba(255,236,170,.25)}
      :skin .btn.primary,:skin .meet-btn{background:rgba(95,211,238,.18);border-color:#5fd3ee;color:#e9fbff}
      :skin .chip{background:rgba(232,198,106,.14);border:1px solid rgba(232,198,106,.45);color:#f3dfa5}
      :skin .bw-wheel{--f:0;position:fixed;right:24px;top:22px;width:46px;height:46px;border-radius:50%;z-index:30;pointer-events:auto;
        background:radial-gradient(circle,transparent 0 55%,rgba(0,0,0,.4) 56% 57%,transparent 58%),conic-gradient(#8fe05a calc(var(--f)*360deg),rgba(20,30,20,.55) 0);
        -webkit-mask:radial-gradient(circle,transparent 0 50%,#000 51%);mask:radial-gradient(circle,transparent 0 50%,#000 51%);filter:drop-shadow(0 0 6px rgba(143,224,90,.35));transition:--f .6s}
      :skin .bw-wheel.full{filter:drop-shadow(0 0 10px rgba(143,224,90,.8))}
      :skin .bw-get{position:fixed;right:24px;top:84px;z-index:3000;display:flex;align-items:center;gap:12px;min-width:220px;max-width:340px;padding:10px 16px;
        background:rgba(6,9,9,.86);border:1px solid rgba(241,234,214,.35);box-shadow:inset 0 0 0 3px rgba(6,9,9,.8),inset 0 0 0 4px rgba(241,234,214,.12);color:#f1ead6;animation:bw-in .35s ease-out}
      :skin .bw-get svg{width:28px;height:28px;flex:none;filter:drop-shadow(0 0 8px rgba(95,211,238,.7))}
      :skin .bw-get small{display:block;font-family:"Hylia Serif",Cinzel,serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#e8c66a}
      :skin .bw-get b{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      :skin .bw-get.out{opacity:0;transform:translateX(20px);transition:opacity .5s,transform .5s}
      @keyframes bw-in{from{opacity:0;transform:translateX(30px)}}
      @media (prefers-reduced-motion:reduce){:skin .bw-get{animation:none}}`,
    // spirit lights: soft blue-green motes drifting up through the page
    effects: ({ layer, level }) => {
      const cv = document.createElement('canvas'), cx = cv.getContext('2d'), DPR = Math.min(2, devicePixelRatio || 1);
      cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; layer.appendChild(cv);
      const size = () => { cv.width = innerWidth * DPR; cv.height = innerHeight * DPR; cx.setTransform(DPR, 0, 0, DPR, 0, 0); }; size(); addEventListener('resize', size);
      const make = any => ({ x: rnd(0, innerWidth), y: any ? rnd(0, innerHeight) : innerHeight + 10, r: rnd(1.2, 2.8), vy: rnd(.15, .45), ph: rnd(0, 6.3), a: rnd(.25, .7) });
      const ps = Array.from({ length: level === 'low' ? 10 : 26 }, () => make(true));
      let raf = 0, last = performance.now();
      const loop = now => { const dt = Math.min(3, (now - last) / 16.7); last = now; cx.clearRect(0, 0, innerWidth, innerHeight);
        for (let i = 0; i < ps.length; i++) { const p = ps[i]; p.ph += .02 * dt; p.y -= p.vy * dt; p.x += Math.sin(p.ph) * .35 * dt; if (p.y < -10) ps[i] = make(false);
          const g = cx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5), al = p.a * (.6 + .4 * Math.sin(p.ph * 2));
          g.addColorStop(0, `rgba(190,250,255,${al})`); g.addColorStop(.35, `rgba(95,211,238,${al * .5})`); g.addColorStop(1, 'rgba(95,211,238,0)');
          cx.fillStyle = g; cx.beginPath(); cx.arc(p.x, p.y, p.r * 5, 0, 6.3); cx.fill(); }
        raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
      return () => { cancelAnimationFrame(raf); removeEventListener('resize', size); cv.remove(); };
    } });
})();
