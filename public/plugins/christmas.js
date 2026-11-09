/* Christmas mode: a string of lights along the top, and snow with real physics. Flakes drift and tumble, gusts blow
   through, your mouse pushes them aside, and they settle on the tops of cards, buttons, headings and tasks, piling
   up until they slide off the edges. The box you're typing in collects snow faster and every keystroke shakes some
   off. Chaos level goes from Calm to Total chaos (gusts, big flakes, a snow burst when you finish a task).
   One canvas, pointer-events off, paused when the tab is hidden, off for reduced motion. */
(() => {
  const G = window.__xmas = window.__xmas || {};
  const LEVELS = [
    { name: 'Calm', flakes: 70, size: [1.2, 2.6], pile: 9, rate: 0.55, gust: 0.15, wind: 0.15 },
    { name: 'Festive', flakes: 150, size: [1.4, 3.2], pile: 14, rate: 0.8, gust: 0.35, wind: 0.25 },
    { name: 'Blizzard', flakes: 360, size: [1.2, 3.6], pile: 22, rate: 1.1, gust: 0.9, wind: 0.8 },
    { name: 'Total chaos', flakes: 650, size: [1.5, 5.2], pile: 34, rate: 1.6, gust: 1.8, wind: 1.4 },
  ];
  const LIGHTS = { classic: ['#ff3b30', '#ffcc00', '#34c759', '#0a84ff', '#ff9f0a', '#bf5af2'], warm: ['#ffd27a', '#ffc35a', '#ffe0a3'], candy: ['#ff2d55', '#ffffff'] };
  const SURFACES = '.gl,.stat,.qa,.head h1,.group-h,.btn,.task:not(.open),.task.open,.c-hero,.modal,.dk-card,.rs-pin .ph,.meet-btn,.space-sw,.nav a.on,.pl-card,.th-card,.db-item:not(.bare),.dock .dk,.vgrid .vt.on,.gh-card,.tm-card,.zl-card';

  Cadence.registerPlugin({
    id: 'christmas', name: 'Christmas mode', version: '1.0.0', category: 'Look & feel', spaces: ['work', 'life'],
    description: 'Lights along the top and snow with real physics: it drifts with the wind, scatters from your mouse, and builds up on cards, buttons and headings until it slides off. Pick a chaos level from Calm to Total chaos. Offered automatically in December.',
    tagline: 'Lights, snow, and as much chaos as you like', color: '#c41e3a',
    icon: '<path d="M12 2v20M4.9 6l14.2 12M4.9 18L19.1 6"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5M3 9.2l3.3.9-.9 3.3M21 14.8l-3.3-.9.9-3.3M3 14.8l3.3-.9-.9-3.3M21 9.2l-3.3.9.9 3.3"/>',
    settings(api) { G.settings && G.settings(); },
    setup(api) {
      const defaults = { on: false, lights: true, lightStyle: 'classic', pattern: 'twinkle', snow: true, build: true, chaos: 1, offered: 0 };
      const opts = () => Object.assign({}, defaults, api.storage.get('opts') || {});
      const setOpts = o => { api.storage.set('opts', o); apply(); };
      const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

      /* ---------------- settings ---------------- */
      G.settings = () => {
        const o = opts();
        const seg = (id, list, cur) => `<div class="seg" id="${id}">${list.map(([v, l]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
        api.ui.modal('Christmas mode', `
          <label class="xm-row"><input type="checkbox" id="xm-on" ${o.on ? 'checked' : ''}> <b>Christmas mode is on</b></label>
          <div class="field"><label>Chaos level</label>${seg('xm-chaos', LEVELS.map((l, i) => [i, l.name]), o.chaos)}
            <div class="muted" style="font-size:12px;margin-top:6px">Calm is a light dusting. Total chaos: gusts, big flakes, deep drifts and a snow burst every time you finish a task.</div></div>
          <label class="xm-row"><input type="checkbox" id="xm-snow" ${o.snow ? 'checked' : ''}> Snow</label>
          <label class="xm-row"><input type="checkbox" id="xm-build" ${o.build ? 'checked' : ''}> Snow builds up on cards, buttons and headings</label>
          <label class="xm-row"><input type="checkbox" id="xm-lights" ${o.lights ? 'checked' : ''}> String lights</label>
          <div class="field"><label>Lights</label>${seg('xm-style', [['classic', 'Classic colours'], ['warm', 'Warm white'], ['candy', 'Candy cane']], o.lightStyle)}
            <div style="margin-top:8px">${seg('xm-pat', [['twinkle', 'Twinkle'], ['chase', 'Chase'], ['steady', 'Steady']], o.pattern)}</div></div>
          ${reduced() ? '<p class="muted" style="font-size:12px">Your system asks for reduced motion, so snow stays off and the lights stay still.</p>' : ''}`,
          `<button class="btn" id="xm-shovel" style="margin-right:auto">Shovel the snow</button><button class="btn primary" id="xm-save">Done</button>`);
        const pick = id => { let v; document.querySelectorAll(`#${id} button`).forEach(b => { if (b.classList.contains('on')) v = b.dataset.v; b.onclick = () => { document.querySelectorAll(`#${id} button`).forEach(x => x.classList.toggle('on', x === b)); }; }); return () => (document.querySelector(`#${id} button.on`) || {}).dataset?.v ?? v; };
        const chaos = pick('xm-chaos'), style = pick('xm-style'), pat = pick('xm-pat');
        document.getElementById('xm-shovel').onclick = () => { shovel(); api.ui.toast('All shovelled'); };
        document.getElementById('xm-save').onclick = () => {
          setOpts({ ...o, on: document.getElementById('xm-on').checked, chaos: +chaos(), lightStyle: style(), pattern: pat(), snow: document.getElementById('xm-snow').checked, build: document.getElementById('xm-build').checked, lights: document.getElementById('xm-lights').checked });
          api.ui.close();
        };
      };
      api.commands.add({ title: 'Christmas mode…', hint: 'Lights and snow', run: () => G.settings() });
      api.commands.add({ title: 'Shovel the snow', hint: 'Christmas mode', run: () => shovel() });

      // December: offer it once a year
      const now = new Date(), season = (now.getMonth() === 11) || (now.getMonth() === 0 && now.getDate() <= 6);
      if (season && !opts().on && opts().offered !== now.getFullYear() + (now.getMonth() === 0 ? -1 : 0)) {
        setTimeout(() => api.island.show({ title: 'It’s December', sub: 'Turn on Christmas mode? Lights and snow.', sticky: true, color: '#c41e3a',
          actions: [{ label: 'Let it snow', run: () => setOpts({ ...opts(), on: true, offered: now.getFullYear() }) }, { label: 'Not this year', run: () => setOpts({ ...opts(), offered: now.getFullYear() }) }] }), 4000);
      }

      /* ---------------- lights ---------------- */
      function lights(o) {
        let el = document.getElementById('xm-string');
        if (!o.on || !o.lights) { el && el.remove(); return; }
        if (!el) { el = document.createElement('div'); el.id = 'xm-string'; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el); }
        const cols = LIGHTS[o.lightStyle] || LIGHTS.classic, n = Math.ceil(innerWidth / 46);
        el.className = `xm-${o.pattern} ${o.chaos >= 2 && !reduced() ? 'xm-sway' : ''}`;
        el.innerHTML = `<svg class="xm-wire" viewBox="0 0 ${n * 46} 30" preserveAspectRatio="none"><path d="${Array.from({ length: n }, (_, i) => `${i ? '' : 'M0 4 '}Q ${i * 46 + 23} 26 ${(i + 1) * 46} 4`).join(' ')}"/></svg>` +
          Array.from({ length: n }, (_, i) => `<i style="left:${i * 46 + 23}px;--c:${cols[i % cols.length]};--d:${(i * 0.37) % 2.2}s;--k:${i}"></i>`).join('');
      }

      /* ---------------- snow physics ---------------- */
      let cv, cx, raf = 0, flakes = [], last = 0, gustT = 0, gust = 0, piles = new Map(), surfT = 0, lvl = LEVELS[1];
      const mouse = { x: -999, y: -999, vx: 0, vy: 0, t: 0 };
      const rnd = (a, b) => a + Math.random() * (b - a);
      const newFlake = (top) => { const r = rnd(lvl.size[0], lvl.size[1]); return { x: rnd(-40, innerWidth + 40), y: top ? rnd(-innerHeight, 0) : -10, r, vy: 0.35 + r * 0.32, vx: 0, ph: Math.random() * 6.28, sp: rnd(0.6, 1.6), o: rnd(0.55, 0.95) }; };
      const BUCKET = 4;
      function surfaces() {
        const seen = new Set();
        document.querySelectorAll(SURFACES).forEach(el => {
          if (el.closest('#xm-string')) return;
          const r = el.getBoundingClientRect(); if (r.width < 24 || r.bottom < 0 || r.top > innerHeight) return;
          seen.add(el); if (!piles.has(el)) piles.set(el, { h: new Float32Array(Math.ceil(r.width / BUCKET) + 1), w: r.width });
          const p = piles.get(el); if (Math.abs(p.w - r.width) > 2) { p.h = new Float32Array(Math.ceil(r.width / BUCKET) + 1); p.w = r.width; }
        });
        for (const el of piles.keys()) if (!seen.has(el) || !el.isConnected) piles.delete(el);
      }
      function shovel() { piles.forEach(p => p.h.fill(0)); }
      G.shovel = shovel;
      function burst(x, y, n) { for (let i = 0; i < n; i++) { const f = newFlake(); f.x = x; f.y = y; f.vx = rnd(-3, 3); f.vy = rnd(-4, -1); f.burst = 1; flakes.push(f); } }
      G.burst = burst;
      function settle(p, rect, x) {
        const i = Math.max(0, Math.min(p.h.length - 1, Math.round((x - rect.left) / BUCKET)));
        const max = lvl.pile * (rect.width < 120 ? 0.6 : 1);
        if (p.h[i] >= max) return false;
        p.h[i] += 0.9 * lvl.rate; if (i > 0) p.h[i - 1] += 0.35 * lvl.rate; if (i < p.h.length - 1) p.h[i + 1] += 0.35 * lvl.rate;
        // angle of repose: steep steps slide sideways; past the edge they fall off
        for (let k = 0; k < 3; k++) for (let j = 0; j < p.h.length; j++) {
          const l = j > 0 ? p.h[j - 1] : -1, r = j < p.h.length - 1 ? p.h[j + 1] : -1;
          if (l >= 0 && p.h[j] - l > 2.4) { const m = (p.h[j] - l) / 3; p.h[j] -= m; p.h[j - 1] += m; }
          if (r >= 0 && p.h[j] - r > 2.4) { const m = (p.h[j] - r) / 3; p.h[j] -= m; p.h[j + 1] += m; }
        }
        // the ends are the edge of the card: snow there drops off
        for (const e of [0, p.h.length - 1]) if (p.h[e] > 3.5) { p.h[e] -= 1.5; if (Math.random() < 0.5) { const f = newFlake(); f.x = rect.left + e * BUCKET + (e ? 4 : -4); f.y = rect.top - p.h[e]; f.vx = e ? 0.6 : -0.6; f.vy = 0.6; flakes.push(f); } }
        return true;
      }
      function frame(t) {
        raf = requestAnimationFrame(frame);
        if (document.hidden) return;
        const dt = Math.min(2.5, (t - last) / 16.7 || 1); last = t;
        const o = G.o; if (!cx) return;
        if (t - surfT > 400 && o.build) { surfT = t; surfaces(); }
        // gusts come and go
        gustT -= dt; if (gustT <= 0) { gustT = rnd(120, 520); gust = rnd(-1, 1) * lvl.gust * (Math.random() < 0.35 ? 2.4 : 1); }
        const wind = Math.sin(t / 4000) * lvl.wind + gust;
        mouse.vx *= 0.9; mouse.vy *= 0.9;
        cx.clearRect(0, 0, cv.width, cv.height);
        const rects = o.build ? [...piles.entries()].map(([el, p]) => [el, p, el.getBoundingClientRect()]) : [];
        const focus = document.activeElement && document.activeElement.matches && document.activeElement.matches('input,textarea,[contenteditable="true"]') ? document.activeElement : null;
        const light = !(window.CadenceThemes && window.CadenceThemes.isDark && window.CadenceThemes.isDark());
        cx.fillStyle = '#fff'; cx.strokeStyle = 'rgba(120,140,175,.55)'; cx.lineWidth = DPR * 0.8;
        for (let i = flakes.length - 1; i >= 0; i--) {
          const f = flakes[i];
          f.ph += 0.02 * f.sp * dt;
          f.vx += ((wind + Math.sin(f.ph) * 0.5) - f.vx) * 0.04 * dt;
          if (f.burst) { f.vy += 0.12 * dt; if (f.vy > 0.35 + f.r * 0.32) f.burst = 0; } else f.vy += ((0.35 + f.r * 0.32) - f.vy) * 0.05 * dt;
          // the mouse is a snow plough
          const dx = f.x - mouse.x, dy = f.y - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < 6400) { const d = Math.sqrt(d2) || 1, k = (80 - d) / 80; f.vx += (dx / d) * k * 1.6 + mouse.vx * 0.08 * k; f.vy += (dy / d) * k * 1.2 + mouse.vy * 0.08 * k; }
          const ny = f.y + f.vy * dt, nx = f.x + f.vx * dt;
          let landed = false;
          if (o.build && f.vy > 0) for (const [el, p, r] of rects) {
            if (nx < r.left || nx > r.right) continue;
            const i2 = Math.max(0, Math.min(p.h.length - 1, Math.round((nx - r.left) / BUCKET))), top = r.top - p.h[i2];
            if (f.y <= top && ny >= top) { const boost = el === focus || (focus && el.contains(focus)) ? 2 : 1; for (let b = 0; b < boost; b++) landed = settle(p, r, nx) || landed; break; }
          }
          if (landed || ny > innerHeight + 10 || nx < -60 || nx > innerWidth + 60) { if (flakes.length > lvl.flakes) flakes.splice(i, 1); else Object.assign(f, newFlake()); continue; }
          f.x = nx; f.y = ny;
          cx.globalAlpha = f.o; cx.beginPath(); cx.arc(f.x * DPR, f.y * DPR, f.r * DPR, 0, 6.283); cx.fill(); if (light) cx.stroke();
        }
        while (flakes.length < lvl.flakes) flakes.push(newFlake(true));
        // the drifts: soft white caps with a cool shadow underneath
        cx.globalAlpha = 1;
        for (const [, p, r] of rects) {
          let any = false; for (let j = 0; j < p.h.length; j++) if (p.h[j] > 1.2) { any = true; break; } if (!any) continue;
          cx.beginPath(); cx.moveTo(r.left * DPR, r.top * DPR);
          for (let j = 0; j < p.h.length; j++) { const x = Math.min(r.right, r.left + j * BUCKET), y = r.top - p.h[j]; cx.lineTo(x * DPR, y * DPR); }
          cx.lineTo(r.right * DPR, r.top * DPR); cx.closePath();
          cx.shadowColor = light ? 'rgba(90,115,155,.55)' : 'rgba(120,150,190,.35)'; cx.shadowBlur = 5 * DPR; cx.shadowOffsetY = 1 * DPR; cx.fillStyle = '#fbfdff'; cx.fill();
          if (light) { cx.shadowColor = 'transparent'; cx.strokeStyle = 'rgba(140,160,195,.6)'; cx.beginPath(); let on = false;
            for (let j = 0; j < p.h.length; j++) { const x = Math.min(r.right, r.left + j * BUCKET) * DPR, y = (r.top - p.h[j]) * DPR; if (p.h[j] > 0.8) { on ? cx.lineTo(x, y) : cx.moveTo(x, y); on = true; } else on = false; }
            cx.stroke(); }
          cx.shadowColor = 'transparent'; cx.shadowBlur = 0; cx.shadowOffsetY = 0; cx.fillStyle = '#fff';
        }
      }
      let DPR = 1;
      function size() { if (!cv) return; DPR = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * DPR; cv.height = innerHeight * DPR; }
      function snow(o) {
        const want = o.on && o.snow && !reduced();
        if (!want) { cancelAnimationFrame(raf); raf = 0; cv && cv.remove(); cv = cx = null; flakes = []; piles.clear(); return; }
        lvl = LEVELS[Math.max(0, Math.min(3, o.chaos))];
        if (!cv) { cv = document.createElement('canvas'); cv.id = 'xm-snow'; cv.setAttribute('aria-hidden', 'true'); document.body.appendChild(cv); cx = cv.getContext('2d'); size(); }
        if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
      }
      if (!G.bound) { G.bound = true;
        addEventListener('resize', () => { size(); G.o && lights(G.o); });
        addEventListener('pointermove', e => { const t = performance.now(), k = Math.max(1, t - mouse.t); mouse.vx = (e.clientX - mouse.x) / k * 16; mouse.vy = (e.clientY - mouse.y) / k * 16; if (Math.abs(mouse.vx) > 60) mouse.vx = 0; if (Math.abs(mouse.vy) > 60) mouse.vy = 0; mouse.x = e.clientX; mouse.y = e.clientY; mouse.t = t; }, { passive: true });
        // typing shakes snow off the box you're writing in
        addEventListener('keydown', e => { if (!G.o || !G.o.on || e.key.length > 1 && e.key !== 'Backspace') return; const el = document.activeElement; if (!el) return;
          for (const [s, p] of piles) if (s === el || s.contains(el)) { const r = s.getBoundingClientRect(); let shook = 0; for (let j = 0; j < p.h.length; j++) if (p.h[j] > 1 && Math.random() < 0.18) { p.h[j] *= 0.55; shook++; if (shook < 6) burst(r.left + j * BUCKET, r.top - 2, 1); } } }, true);
      }

      function apply() {
        const o = G.o = opts();
        document.documentElement.classList.toggle('xm-on', !!o.on);
        lights(o); snow(o);
      }
      // a snow burst from the checkbox when you finish something (Blizzard and up)
      api.on('task:complete', () => { const o = G.o; if (!o || !o.on || o.chaos < 2 || reduced()) return; const c = document.querySelector('.task.done .check, .task.leaving .check'); const r = c ? c.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2 }; burst(r.left + 9, r.top, o.chaos >= 3 ? 70 : 30); });

      if (!document.getElementById('xm-css')) { const st = document.createElement('style'); st.id = 'xm-css'; st.textContent = `
        #xm-snow{position:fixed;inset:0;width:100vw;height:100vh;z-index:55;pointer-events:none}
        #xm-string{position:fixed;left:0;right:0;top:-2px;height:34px;z-index:56;pointer-events:none;overflow:hidden}
        #xm-string .xm-wire{position:absolute;left:0;top:0;width:100%;height:30px}
        #xm-string .xm-wire path{fill:none;stroke:#2d3a2b;stroke-width:1.6;opacity:.75}
        #xm-string i{position:absolute;top:12px;width:9px;height:14px;margin-left:-4.5px;border-radius:45% 45% 50% 50%/40% 40% 60% 60%;background:var(--c);
          box-shadow:0 0 6px 2px var(--c),0 0 18px 4px color-mix(in srgb,var(--c) 55%,transparent);transform-origin:50% -4px}
        #xm-string i::before{content:'';position:absolute;left:1.5px;top:-4px;width:6px;height:5px;border-radius:1px;background:#3a4a38}
        #xm-string.xm-twinkle i{animation:xmtw 2.4s ease-in-out infinite;animation-delay:calc(var(--d) * -1)}
        #xm-string.xm-chase i{animation:xmch 1.2s steps(1) infinite;animation-delay:calc(var(--k) % 3 * -.4s)}
        #xm-string.xm-sway i{animation-name:xmtw,xmsw;animation-duration:2.4s,3.2s;animation-iteration-count:infinite;animation-timing-function:ease-in-out}
        @keyframes xmtw{0%,100%{opacity:1;filter:brightness(1.15)}50%{opacity:.45;filter:brightness(.7)}}
        @keyframes xmch{0%{opacity:1}33%{opacity:.25}66%{opacity:.25}}
        @keyframes xmsw{0%,100%{rotate:-9deg}50%{rotate:9deg}}
        @media (prefers-reduced-motion:reduce){#xm-string i{animation:none!important}}
        .xm-row{display:flex;gap:8px;align-items:center;margin:8px 0;font-size:14px}
      `; document.head.appendChild(st); }
      apply();
    }
  });
})();
