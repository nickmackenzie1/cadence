/* Christmas mode: string lights, and snow that looks real and reacts.
   Three depth layers (far specks, mid flakes that settle, big soft bokeh drifting past up close), soft flakes and
   tumbling six-armed crystals. Wind, gusts and your mouse push it around; it settles on cards, buttons, headings and
   tasks as little drifts with an angle of repose, and slides off the ends. Reactions: a click sends a shockwave,
   clicking a snowy button knocks its pile off in clumps that burst into powder when they land, neighbours get jolted,
   scrolling shakes snow loose, typing shakes your box clear. Every knob is in the settings (presets = chaos levels).
   One canvas, pointer-events off, paused when the tab is hidden, off for reduced motion. */
(() => {
  const G = window.__xmas = window.__xmas || {};
  // presets: amount, size, speed, wind, gusts, pile depth (multipliers), plus style/depth/melt/reactions
  const LEVELS = [
    { name: 'Calm', amount: .5, size: .9, speed: .85, wind: .15, gusts: .2, pile: .6 },
    { name: 'Festive', amount: 1, size: 1, speed: 1, wind: .3, gusts: .45, pile: 1 },
    { name: 'Blizzard', amount: 2.2, size: 1.05, speed: 1.35, wind: 1, gusts: 1.1, pile: 1.6 },
    { name: 'Total chaos', amount: 3.6, size: 1.5, speed: 1.6, wind: 1.6, gusts: 2.2, pile: 2.6 },
  ];
  const LIGHTS = { classic: ['#ff3b30', '#ffcc00', '#34c759', '#0a84ff', '#ff9f0a', '#bf5af2'], warm: ['#ffd27a', '#ffc35a', '#ffe0a3'], candy: ['#ff2d55', '#ffffff'] };
  // everything snow can land on. TEXTY ones catch it on the words themselves (the first line of text, not the empty box)
  const SURFACES = '.gl,.stat,.qa,.group-h,.btn,.task.open,.c-hero,.modal,.dk-card,.rs-pin .ph,.meet-btn,.space-sw,.pl-card,.th-card,.db-item:not(.bare),.dock .dk,.vgrid .vt,.gh-card,.tm-card,.zl-card,.msn-dp,.dc-i,'
    + '.check,.chip,.te-chip,.inp,.pop-i,.ntile,.nav a .t,.nav a .ic,.nav a .n,.t-title,.head h1,.head .sub,.sect,.c-desc,.gl .v,.stat .v,.dw-task,.isl-pill,.pj-bar,.rs-rec .wrap,.tile,.pb-card,.seg';
  const TEXTY = '.group-h,.t-title,.head h1,.head .sub,.sect,.c-desc,.nav a .t,.gl .v,.stat .v';
  const MAX_SURF = 280;
  const TUNE_KEYS = [['amount', 'Amount', .2, 4, .1], ['size', 'Flake size', .5, 2.2, .05], ['speed', 'Fall speed', .3, 2.2, .05], ['wind', 'Wind', -2, 2, .05], ['gusts', 'Gusts', 0, 3, .05], ['pile', 'Drift depth', 0, 3, .05]];

  Cadence.registerPlugin({
    id: 'christmas', name: 'Christmas mode', version: '2.0.0', category: 'Look & feel', spaces: ['work', 'life'],
    description: 'Lights along the top and realistic snow: far specks, tumbling crystals and soft close-up flakes. It drifts in the wind, piles up on cards and buttons, and reacts: clicks send shockwaves, clicking a snowy button knocks the pile off in clumps, scrolling shakes it loose. Every knob is adjustable. Offered automatically in December.',
    tagline: 'Lights, snow, and as much chaos as you like', color: '#c41e3a',
    icon: '<path d="M12 2v20M4.9 6l14.2 12M4.9 18L19.1 6"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5M3 9.2l3.3.9-.9 3.3M21 14.8l-3.3-.9.9-3.3M3 14.8l3.3-.9-.9-3.3M21 9.2l-3.3.9.9 3.3"/>',
    settings(api) { G.settings && G.settings(); },
    setup(api) {
      G.teardown && G.teardown();   // plugins rebuild when you switch Work/Life: stop the previous engine first
      const defaults = { on: false, look: 'elements', lights: true, lightStyle: 'classic', pattern: 'twinkle', snow: true, build: true, chaos: 1, offered: 0, style: 'mixed', depth: true, melt: false, react: true, tune: null };
      // one Christmas for both spaces: settings live in this browser, not in a space's data
      const opts = () => { let v = null; try { v = JSON.parse(localStorage.getItem('cadence.xmas') || 'null'); } catch (e) {} return Object.assign({}, defaults, v || api.storage.get('opts') || {}); };
      const setOpts = o => { try { localStorage.setItem('cadence.xmas', JSON.stringify(o)); } catch (e) {} apply(true); };
      const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
      const tuneOf = o => Object.assign({}, LEVELS[Math.max(0, Math.min(3, o.chaos))], o.tune || {});

      /* ---------------- settings (live: changes show while you drag) ---------------- */
      G.settings = () => {
        const o = opts(); let draft = { ...o, tune: o.tune ? { ...o.tune } : null };
        const seg = (id, list, cur) => `<div class="seg wrap" id="${id}">${list.map(([v, l]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
        const sliders = () => { const t = tuneOf(draft); return TUNE_KEYS.map(([k, l, mn, mx, st]) => `<label class="xm-sl"><span>${l}</span><input type="range" min="${mn}" max="${mx}" step="${st}" value="${t[k]}" data-k="${k}"><em>${k === 'wind' ? (t[k] < -.05 ? '← ' : t[k] > .05 ? '→ ' : '') + Math.abs(t[k]).toFixed(1) : (+t[k]).toFixed(1) + '×'}</em></label>`).join(''); };
        api.ui.modal('Christmas mode', `
          <label class="xm-row"><input type="checkbox" id="xm-on" ${o.on ? 'checked' : ''}> <b>Christmas mode is on</b></label>
          <div class="field"><label>Look</label>${seg('xm-look', [['elements', 'Elements'], ['classic', 'Classic']], o.look)}
            <div class="muted" style="font-size:12px;margin-top:6px">Elements: falling-sand snow that piles on cards, real icicles on the lights, and it melts under typing fire. Classic: the original soft flakes and drifts.</div></div>
          <div class="field"><label>Chaos level</label>${seg('xm-chaos', LEVELS.map((l, i) => [i, l.name]), o.tune ? -1 : o.chaos)}
            <div class="muted" style="font-size:12px;margin-top:6px">A preset for everything below. Total chaos: blizzard gusts, big clumps, deep drifts, and a snow burst every time you finish a task.</div></div>
          <div class="field"><label>Snowflakes</label>${seg('xm-fs', [['mixed', 'Mixed'], ['soft', 'Soft'], ['crystals', 'Crystals']], o.style)}</div>
          <details class="xm-adv" ${o.tune ? 'open' : ''}><summary>Fine-tune</summary><div id="xm-sliders">${sliders()}</div></details>
          <label class="xm-row"><input type="checkbox" id="xm-o-snow" ${o.snow ? 'checked' : ''}> Snow</label>
          <label class="xm-row"><input type="checkbox" id="xm-build" ${o.build ? 'checked' : ''}> Snow builds up on cards, buttons and headings</label>
          <label class="xm-row"><input type="checkbox" id="xm-react" ${o.react ? 'checked' : ''}> Snow reacts to clicks and scrolling</label>
          <label class="xm-row"><input type="checkbox" id="xm-depth" ${o.depth ? 'checked' : ''}> Big soft flakes up close (depth)</label>
          <label class="xm-row"><input type="checkbox" id="xm-melt" ${o.melt ? 'checked' : ''}> Drifts slowly melt</label>
          <label class="xm-row"><input type="checkbox" id="xm-lights" ${o.lights ? 'checked' : ''}> String lights</label>
          <div class="field"><label>Lights</label>${seg('xm-style', [['classic', 'Classic colours'], ['warm', 'Warm white'], ['candy', 'Candy cane']], o.lightStyle)}
            <div style="margin-top:8px">${seg('xm-pat', [['twinkle', 'Twinkle'], ['chase', 'Chase'], ['steady', 'Steady']], o.pattern)}</div></div>
          ${reduced() ? '<p class="muted" style="font-size:12px">Your system asks for reduced motion, so snow stays off and the lights stay still.</p>' : ''}`,
          `<button class="btn" id="xm-shovel-page">Shovel this page</button><button class="btn" id="xm-shovel" style="margin-right:auto">Shovel everything</button><button class="btn primary" id="xm-save">Done</button>`, 'wide');
        const $ = id => document.getElementById(id);
        const read = () => ({ ...draft, on: $('xm-on').checked, snow: $('xm-o-snow').checked, build: $('xm-build').checked, react: $('xm-react').checked, depth: $('xm-depth').checked, melt: $('xm-melt').checked, lights: $('xm-lights').checked });
        const live = () => { draft = read(); if (draft.on) { G.o = draft; G.preview && G.preview(draft); } };
        const segPick = (id, fn) => document.querySelectorAll(`#${id} button`).forEach(b => b.onclick = () => { document.querySelectorAll(`#${id} button`).forEach(x => x.classList.toggle('on', x === b)); fn(b.dataset.v); live(); });
        segPick('xm-chaos', v => { draft.chaos = +v; draft.tune = null; $('xm-sliders').innerHTML = sliders(); bindSliders(); });
        segPick('xm-fs', v => { draft.style = v; });
        segPick('xm-look', v => { draft.look = v; live(); });
        segPick('xm-style', v => { draft.lightStyle = v; }); segPick('xm-pat', v => { draft.pattern = v; });
        const bindSliders = () => document.querySelectorAll('#xm-sliders input').forEach(i => i.oninput = () => { draft.tune = { ...tuneOf(draft), [i.dataset.k]: +i.value }; document.querySelectorAll('#xm-chaos button').forEach(x => x.classList.remove('on')); const em = i.nextElementSibling, v = +i.value; em.textContent = i.dataset.k === 'wind' ? (v < -.05 ? '← ' : v > .05 ? '→ ' : '') + Math.abs(v).toFixed(1) : v.toFixed(1) + '×'; live(); });
        bindSliders();
        document.querySelectorAll('#modal .xm-row input').forEach(i => i.onchange = live);
        $('xm-shovel').onclick = () => { shovel(); api.ui.toast('All shovelled'); };
        $('xm-shovel-page').onclick = () => { shovelPage(); api.ui.toast('This page is shovelled'); };
        $('xm-save').onclick = () => { setOpts(read()); api.ui.close(); };
      };
      api.commands.add({ title: 'Christmas mode…', hint: 'Lights and snow', run: () => G.settings() });
      api.commands.add({ title: 'Shovel this page', hint: 'Christmas mode', run: () => { shovelPage(); api.ui.toast('This page is shovelled'); } });
      api.commands.add({ title: 'Shovel everything', hint: 'Christmas mode', run: () => { shovel(); api.ui.toast('All shovelled'); } });
      // quick switches, any day of the year: snow and lights on their own
      const flip = key => { const o = opts(), wasOn = o.on, cur = wasOn && o[key], n = { ...o, [key]: !cur, on: true };
        if (!wasOn) { n.snow = key === 'snow'; n.lights = key === 'lights'; }
        if (!n.snow && !n.lights) n.on = false;
        setOpts(n); api.ui.toast(key === 'snow' ? (n.snow ? 'Let it snow' : 'Snow stopped') : (n.lights ? 'Lights on' : 'Lights off')); };
      api.commands.add({ title: 'Let it snow / stop the snow', hint: 'Christmas mode', run: () => flip('snow') });
      api.commands.add({ title: 'Lights on / off', hint: 'Christmas mode', run: () => flip('lights') });
      G.flip = flip;

      // December: offer it once a year
      const now = new Date(), season = (now.getMonth() === 11) || (now.getMonth() === 0 && now.getDate() <= 6);
      if (season && !opts().on && opts().offered !== now.getFullYear() + (now.getMonth() === 0 ? -1 : 0)) {
        setTimeout(() => api.island.show({ title: 'It’s December', sub: 'Turn on Christmas mode? Lights and snow.', sticky: true, color: '#c41e3a',
          actions: [{ label: 'Let it snow', run: () => setOpts({ ...opts(), on: true, offered: now.getFullYear() }) }, { label: 'Not this year', run: () => setOpts({ ...opts(), offered: now.getFullYear() }) }] }), 4000);
      }

      /* ---------------- lights ---------------- */
      // the string hooks onto the Island pill (the wire swags into its sides), and the pill wears its own ring of tiny bulbs
      let ringRO = null, ringT = 0, followUntil = 0, followRaf = 0, ringMO = null;
      // the Elements look draws its own lights and snow in the engine: the classic ones stay off, whoever redraws them
      const classicOff = o => o && o.look !== 'classic' && !reduced();
      function lights(o) {
        if (classicOff(o)) o = { ...o, lights: false };
        let el = document.getElementById('xm-string');
        if (!o.on || !o.lights) { el && el.remove(); document.getElementById('xm-glow')?.remove(); document.getElementById('xm-ring')?.remove(); ringRO && ringRO.disconnect(); ringRO = null; ringMO && ringMO.disconnect(); ringMO = null; cancelAnimationFrame(followRaf); followRaf = 0; G.bulbs = null; return; }
        if (!el) { el = document.createElement('div'); el.id = 'xm-string'; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el); }
        const cols = LIGHTS[o.lightStyle] || LIGHTS.classic, W = innerWidth, pill = document.querySelector('.isl-pill'), pr = pill && pill.getBoundingClientRect();
        const hook = pr && pr.width > 20 && pr.top < 60 ? { l: pr.left - 4, r: pr.right + 4, y: Math.min(34, pr.top + pr.height / 2) } : null;
        const segs = hook ? [[0, hook.l, 4, hook.y], [hook.r, W, hook.y, 4]] : [[0, W, 4, 4]];
        const bulbs = []; let path = '', k = 0;
        for (const [x0, x1, yA, yB] of segs) { if (x1 - x0 < 20) continue; const n = Math.max(1, Math.round((x1 - x0) / 46)), st = (x1 - x0) / n;
          path += `M${x0.toFixed(1)} ${yA} `;
          for (let i = 0; i < n; i++) { const a2 = x0 + i * st, b2 = a2 + st, y0 = i === 0 ? yA : 4, y1 = i === n - 1 ? yB : 4;
            path += `Q ${(a2 + st / 2).toFixed(1)} 26 ${b2.toFixed(1)} ${y1} `;
            bulbs.push({ x: a2 + st / 2, y: .25 * y0 + .5 * 26 + .25 * y1, c: cols[k % cols.length], d: (k * .37) % 2.2, k: k++ }); } }
        el.className = `xm-${o.pattern} ${o.chaos >= 2 && !reduced() ? 'xm-sway' : ''}`;
        G.bulbs = bulbs; G.pattern = o.pattern;
        let gl = document.getElementById('xm-glow'); if (!gl) { gl = document.createElement('div'); gl.id = 'xm-glow'; gl.setAttribute('aria-hidden', 'true'); document.body.appendChild(gl); }
        gl.className = el.className + (window.CadenceThemes && window.CadenceThemes.isDark && window.CadenceThemes.isDark() ? ' dk' : '');
        gl.innerHTML = bulbs.map(b => `<i style="left:${b.x}px;--c:${b.c};--d:${b.d}s;--k:${b.k}"></i>`).join('');
        el.innerHTML = `<svg class="xm-wire" width="${W}" height="40" viewBox="0 0 ${W} 40"><path d="${path}"/></svg>` + bulbs.map(b => `<i style="left:${b.x}px;top:${(b.y - 3).toFixed(1)}px;--c:${b.c};--d:${b.d}s;--k:${b.k}"></i>`).join('');
        G.ringCols = cols; G.ringCls = el.className; drawRing();
        if (pill && !ringRO && window.ResizeObserver) {
          // follow the pill frame by frame while it grows or shrinks, so the bulbs move with it instead of catching up later
          const kick = () => { followUntil = performance.now() + 950; if (!followRaf) followRaf = requestAnimationFrame(follow); clearTimeout(ringT); ringT = setTimeout(() => G.o && G.o.on && G.o.lights && lights(G.o), 1000); };
          ringRO = new ResizeObserver(kick); ringRO.observe(pill);
          ringMO = new MutationObserver(kick); ringMO.observe(pill, { attributes: true, attributeFilter: ['class', 'style'] });
        }
      }
      function follow() { drawRing(); followRaf = performance.now() < followUntil ? requestAnimationFrame(follow) : 0; }
      function drawRing() {
        const pill = document.querySelector('.isl-pill'), pr = pill && pill.getBoundingClientRect(), cols = G.ringCols;
        let ring = document.getElementById('xm-ring');
        if (!cols || !document.getElementById('xm-string') || !pill || !pr || pr.width < 20) { ring && ring.remove(); return; }
        if (!ring) { ring = document.createElement('div'); ring.id = 'xm-ring'; ring.setAttribute('aria-hidden', 'true'); document.body.appendChild(ring); }
        const pad = 5, w = pr.width + pad * 2, h = pr.height + pad * 2, rad = Math.min(h / 2, (parseFloat(getComputedStyle(pill).borderTopLeftRadius) || h / 2) + pad);
        ring.className = G.ringCls || ''; Object.assign(ring.style, { left: pr.left - pad + 'px', top: pr.top - pad + 'px', width: w + 'px', height: h + 'px' });
        ring.innerHTML = `<svg width="${w}" height="${h}"><rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="${rad - 1.5}" class="xm-rw"/></svg>`;
        const rect = ring.querySelector('rect'), len = rect.getTotalLength ? rect.getTotalLength() : 0, m = Math.max(8, Math.floor(len / 15));
        let dots = ''; for (let i = 0; i < m; i++) { const pt = rect.getPointAtLength(len * i / m); dots += `<circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="2.3" style="--c:${cols[i % cols.length]};--d:${((i * .29) % 2.2).toFixed(2)}s;--k:${i}"/>`; }
        ring.querySelector('svg').insertAdjacentHTML('beforeend', dots);
      }

      /* ---------------- snow ---------------- */
      // sprites, drawn once: soft flakes, three crystal shapes, a bokeh disc
      const sprite = (size, draw) => { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); return c; };
      const SOFT = sprite(32, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.45, 'rgba(255,255,255,.85)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); });
      const ICE = sprite(32, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.38, 'rgba(236,244,255,.95)'); r.addColorStop(.62, 'rgba(176,204,240,.45)'); r.addColorStop(1, 'rgba(176,204,240,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); });
      const BOKEH = sprite(64, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, s * .1, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,.55)'); r.addColorStop(.7, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); });
      const crystal = (v, edge) => sprite(48, (g, s) => { g.translate(s / 2, s / 2); g.strokeStyle = '#fff'; g.lineCap = 'round'; g.shadowColor = edge ? 'rgba(120,160,215,.95)' : 'rgba(160,190,230,.9)'; g.shadowBlur = edge ? 3 : 2;
        for (let a = 0; a < 6; a++) { g.save(); g.rotate(a * Math.PI / 3); g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -20); g.stroke(); g.lineWidth = 1.4;
          const br = v === 0 ? [[-8, 5], [-14, 4]] : v === 1 ? [[-6, 6], [-11, 5], [-16, 3]] : [[-10, 7], [-16, 3]];
          for (const [y, l] of br) { g.beginPath(); g.moveTo(0, y); g.lineTo(-l, y - l * .8); g.moveTo(0, y); g.lineTo(l, y - l * .8); g.stroke(); }
          if (v === 2) { g.beginPath(); g.arc(0, -20, 1.8, 0, 6.28); g.fillStyle = '#fff'; g.fill(); } g.restore(); }
        g.beginPath(); g.arc(0, 0, 2.2, 0, 6.28); g.fillStyle = '#fff'; g.fill(); });
      const CRYS = [crystal(0), crystal(1), crystal(2)], CRYS_L = [crystal(0, 1), crystal(1, 1), crystal(2, 1)];   // _L: a cool blue edge baked in for light themes
      // reflections: each bulb's colour, as bright as the bulb is right now (mirrors the CSS twinkle/chase timing)
      const TINT = new Map(), tint = c => { if (!TINT.has(c)) TINT.set(c, sprite(32, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, c); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); })); return TINT.get(c); };
      const bright = (b, t) => G.pattern === 'steady' ? 1 : G.pattern === 'chase' ? ((Math.floor(t / 400) + b.k % 3) % 3 === 0 ? 1 : .25) : .725 + .275 * Math.cos(2 * Math.PI * ((t / 2400 + b.d / 2.4) % 1));
      const bulbAt = x => { const B = G.bulbs; if (!B || !B.length) return null; return B[Math.max(0, Math.min(B.length - 1, Math.round((x - 23) / 46)))]; };

      let cv, cx, raf = 0, flakes = [], last = 0, gustT = 0, gust = 0, gustTarget = 0, piles = new Map(), surfT = 0, T = tuneOf(defaults), DPR = 1, scrollKick = 0;
      const mouse = { x: -999, y: -999, vx: 0, vy: 0, t: 0 };
      const rnd = (a, b) => a + Math.random() * (b - a);
      const BUCKET = 4, CAP = 1400;
      // z: 0 far … 1 near. Only the middle band settles; the near band is soft bokeh passing in front.
      function newFlake(top) {
        const o = G.o || defaults, z = Math.random(), near = o.depth && z > .94, far = z < .22;
        const r = (far ? rnd(.5, 1.1) : near ? rnd(5, 9) : rnd(1.1, 2.6)) * T.size;
        const crys = !far && !near && (o.style === 'crystals' || (o.style === 'mixed' && Math.random() < .28));
        return { x: rnd(-60, innerWidth + 60), y: top ? rnd(-80, innerHeight * .9) : rnd(-40, -8), z, r: crys ? r * 2.2 : r, near, far, crys, spr: crys ? (Math.random() * 3) | 0 : null,
          vy: 0, vx: 0, ph: Math.random() * 6.28, sp: rnd(.6, 1.6), rot: Math.random() * 6.28, vr: rnd(-.03, .03), o: far ? rnd(.35, .6) : near ? rnd(.25, .45) : rnd(.7, 1) };
      }
      const fallSpeed = f => (f.far ? .35 : f.near ? 1.6 : .55 + f.r * .18 * (f.crys ? .35 : 1)) * T.speed * (f.tv || 1);
      /* drifts are remembered by what they sit on and which page it's on (sidebar snow is shared by every page), so
         they survive page changes and reloads until you shovel them */
      const STORE = new Map(); let dirty = false;
      try { const raw = JSON.parse(localStorage.getItem('cadence.snow') || '{}'); for (const [k, v] of Object.entries(raw)) STORE.set(k, { h: Float32Array.from(v.h, x => x / 10), w: v.w, rad: -1 }); } catch (e) {}
      const save = () => { if (!dirty) return; dirty = false; const out = {}; let n = 0;
        for (const [k, p] of STORE) { if (n > 400) break; let any = false; for (let j = 0; j < p.h.length; j++) if (p.h[j] > .5) { any = true; break; } if (!any) continue; out[k] = { w: Math.round(p.w), h: Array.from(p.h, x => Math.round(x * 10)) }; n++; }
        try { localStorage.setItem('cadence.snow', JSON.stringify(out)); } catch (e) {} };
      const saveIv = setInterval(save, 4000); G.h0 = save; if (!G.ph) { G.ph = 1; addEventListener('pagehide', () => G.h0 && G.h0()); }
      const routeKey = () => (location.hash || '#today').slice(1);
      function keyOf(el) {
        const scope = el.closest('#side') ? '*' : routeKey();
        const id = el.dataset.id || el.dataset.cid || el.dataset.sw || el.dataset.k || el.getAttribute('href') || el.dataset.act || '';
        const cls = (el.classList[0] || el.tagName).toString();
        if (id) return `${scope}|${cls}|${id}`;
        const same = [...document.querySelectorAll(el.classList[0] ? '.' + CSS.escape(el.classList[0]) : el.tagName)];
        return `${scope}|${cls}|#${same.indexOf(el)}`;
      }
      function resample(p, w) { const n = Math.ceil(w / BUCKET) + 1, old = p.h, h = new Float32Array(n); if (old.length > 1) for (let j = 0; j < n; j++) { const x = j / (n - 1) * (old.length - 1), a = Math.floor(x), b = Math.min(old.length - 1, a + 1); h[j] = old[a] + (old[b] - old[a]) * (x - a); } p.h = h; p.w = w; p.rad = -1; }
      // the first line of an element's text: where snow sits on words
      function textBox(el) {
        const rg = document.createRange(); rg.selectNodeContents(el); const rs = rg.getClientRects(); if (!rs.length) return null;
        const er = el.getBoundingClientRect(), t = rs[0].top; let l = Infinity, r = -Infinity, h = 0;
        for (const x of rs) if (Math.abs(x.top - t) < 4 && x.width > 0) { l = Math.min(l, x.left); r = Math.max(r, x.right); h = Math.max(h, x.height); }
        return r > l ? { dx: l - er.left, dy: t - er.top, w: r - l, h } : null;
      }
      // the real top of every letter, column by column: render the text off-screen in the same font and scan it.
      // Snow then sits on the letters (ascenders hold more), and falls through the gaps between words.
      const GCV = document.createElement('canvas'), GX = GCV.getContext('2d', { willReadFrequently: true });
      function glyphs(el, p, tb) {
        const cs = getComputedStyle(el), n = p.h.length, W = Math.max(1, Math.ceil(tb.w)), H = Math.max(4, Math.ceil(tb.h) + 2);
        let txt = (el.textContent || '').replace(/\s+/g, ' ').trim(); if (cs.textTransform === 'uppercase') txt = txt.toUpperCase();
        GCV.width = W; GCV.height = H; GX.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; if ('letterSpacing' in GX) GX.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
        while (txt.length > 1 && GX.measureText(txt).width > W + 3) txt = txt.replace(/\s*\S+$/, '');   // first line only
        const m = GX.measureText(txt), asc = m.fontBoundingBoxAscent || parseFloat(cs.fontSize) * .95;
        GX.clearRect(0, 0, W, H); GX.fillStyle = '#000'; GX.textBaseline = 'alphabetic'; GX.fillText(txt, 0, asc);
        const d = GX.getImageData(0, 0, W, H).data;
        p.base = new Float32Array(n); p.hole = new Uint8Array(n); p.mf = null;
        for (let j = 0; j < n; j++) { let top = H; for (let x = j * BUCKET; x < Math.min(W, j * BUCKET + BUCKET); x++) for (let y = 0; y < top; y++) if (d[(y * W + x) * 4 + 3] > 60) { top = y; break; }
          if (top >= H) p.hole[j] = 1; else p.base[j] = top; }
        p.rad = 0;
      }
      // every spot holds snow a bit differently: that's what makes peaks and dips instead of a flat line
      const lumps = n => { const a = new Float32Array(n); for (let j = 0; j < n; j++) a[j] = .35 + Math.random() * 1.3; for (let k = 0; k < 2; k++) for (let j = 1; j < n - 1; j++) a[j] = (a[j - 1] + a[j] * 2 + a[j + 1]) / 4; return a; };
      // the bottom of the window: the rare flake that gets all the way down piles up there
      const GROUND = { ground: true, isConnected: true, contains: () => false, closest: () => null, matches: () => false, dataset: {}, classList: [], getAttribute: () => null,
        getBoundingClientRect: () => ({ left: 0, right: innerWidth, top: innerHeight - 1, bottom: innerHeight, width: innerWidth, height: 1 }) };
      const rectOf = (el, p) => { const r = el.getBoundingClientRect(); if (!p || !p.tb) return r; const left = r.left + p.tb.dx; return { left, right: left + p.tb.w, top: r.top + p.tb.dy, bottom: r.bottom, width: p.tb.w, height: r.height }; };
      // a screen that covers the page (the meeting, a dialog): only its own things carry snow while it's up
      const coverLayer = () => (document.querySelector('#meeting.open') || (document.querySelector('#scrim.open') && document.querySelector('#modal')));
      function surfaces() {
        const layer = coverLayer();
        const seen = new Set(); let n = 0;
        const add = (el, texty) => {
          let tb = null; if (texty) { tb = textBox(el); if (!tb || tb.w < 14) return; }
          const r0 = el.getBoundingClientRect(); if (r0.bottom < 0 || r0.top > innerHeight) return;
          const w = tb ? tb.w : r0.width; if (w < (texty ? 14 : 16)) return;
          if (++n > MAX_SURF) return; seen.add(el);
          let p = piles.get(el);
          if (!p) { const k = el === GROUND ? '*|ground' : keyOf(el); p = STORE.get(k); if (!p) { p = { h: new Float32Array(Math.ceil(w / BUCKET) + 1), w, rad: -1 }; STORE.set(k, p); } piles.set(el, p); }
          p.tb = tb; if (el === GROUND) p.max = 3;
          if (Math.abs(p.w - w) > 2) resample(p, w);
          if (!p.n || p.n.length !== p.h.length) p.n = lumps(p.h.length);
          if (p.rad < 0) { if (texty) glyphs(el, p, tb); else if (el === GROUND) { p.rad = 0; p.base = null; p.mf = null; p.hole = null; } else { p.hole = null; shape(el, p, r0); } }
        };
        add(GROUND, false);
        document.querySelectorAll(SURFACES).forEach(el => { if (el.closest('#xm-string,#xm-ring') || (layer && !layer.contains(el) && !el.closest('.isl'))) return; add(el, el.matches(TEXTY)); });
        for (const el of piles.keys()) if (!seen.has(el) || !el.isConnected) piles.delete(el);
      }
      // the top edge's shape: rounded corners curve down, so snow sits on the curve and slides off steep parts
      function shape(el, p, r) {
        const cs = getComputedStyle(el), R = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, r.width / 2, r.height);
        p.rad = R; p.base = new Float32Array(p.h.length); p.mf = new Float32Array(p.h.length);
        for (let j = 0; j < p.h.length; j++) { const x = Math.min(r.width, j * BUCKET), d = Math.min(x, r.width - x); p.base[j] = R && d < R ? R - Math.sqrt(Math.max(0, R * R - (R - d) * (R - d))) : 0; }
        for (let j = 0; j < p.h.length; j++) { const sl = Math.abs((p.base[Math.min(p.h.length - 1, j + 1)] - p.base[Math.max(0, j - 1)]) / (2 * BUCKET)); p.mf[j] = Math.max(.05, Math.min(1, 1 - sl * 1.1)); }
      }
      const baseY = (p, r, j) => r.top + (p.base ? p.base[j] : 0);
      function shovel() { STORE.forEach(p => p.h.fill(0)); STORE.clear(); piles.clear(); dirty = true; try { localStorage.removeItem('cadence.snow'); } catch (e) {} }
      function shovelPage() { const r = routeKey() + '|'; for (const [k, p] of STORE) if (k.startsWith(r)) { p.h.fill(0); STORE.delete(k); } piles.forEach((p, el) => { if (!el.closest('#side')) p.h.fill(0); }); piles.clear(); dirty = true; save(); }
      G.shovel = shovel; G.shovelPage = shovelPage; G.debug = () => ({ store: STORE.size, piles: piles.size, flakes: flakes.length, raf: !!raf, cv: !!cv, max: Math.max(0, ...[...STORE.values()].map(p => Math.max(...p.h))) });
      // powder thrown into the air (bursts, splats, things knocked off)
      function powder(x, y, n, spread = 3, up = 4) { for (let i = 0; i < n && flakes.length < CAP; i++) { const f = newFlake(); f.near = f.far = f.crys = false; f.spr = null; f.r = rnd(1, 2.4) * T.size; f.o = rnd(.75, 1); f.x = x + rnd(-6, 6); f.y = y; f.vx = rnd(-spread, spread); f.vy = rnd(-up, -up * .25); f.air = 1; flakes.push(f); } }
      G.burst = (x, y, n) => powder(x, y, n, 3, 4.5);
      // a clump: a packed ball that arcs off and bursts into powder where it lands
      function clump(x, y, size, vx, vy) { if (flakes.length >= CAP) return; const f = newFlake(); Object.assign(f, { near: false, far: false, crys: false, spr: null, x, y, r: size, vx, vy, air: 1, clump: 1, o: 1 }); flakes.push(f); }
      function knock(el, strength = 1) {
        const p = piles.get(el); if (!p) return; const r = rectOf(el, p); let moved = 0; dirty = true;
        for (let j = 0; j < p.h.length; j++) { const take = p.h[j] * Math.min(1, strength); if (take < .6) continue; p.h[j] -= take; moved += take;
          const x = r.left + j * BUCKET, y = baseY(p, r, j) - p.h[j] - take;
          if (j % 3 === 0 && take > 2.5) clump(x, y, Math.min(9, 2 + take * .45) * T.size, rnd(-2.2, 2.2) * strength + (x - (r.left + r.width / 2)) * .012, -rnd(2.5, 6.5) * strength);
          else if (Math.random() < .45) powder(x, y, 1, 1.5 * strength, 3 * strength); }
        return moved;
      }
      function settle(p, rect, x, amt) {
        let i = Math.max(0, Math.min(p.h.length - 1, Math.round((x - rect.left) / BUCKET)));
        if (p.hole && p.hole[i]) return false;
        if (p.n) amt *= p.n[i];
        const max = 14 * T.pile * (p.max || (rect.width < 120 ? .6 : 1)), mf = p.mf ? p.mf[i] : 1;
        if (max <= 0 || p.h[i] >= max * mf) { if (mf < .5) powder(x, baseY(p, rect, i) - p.h[i], 1, .6, .2); return false; }
        const ok = j => j >= 0 && j < p.h.length && !(p.hole && p.hole[j]);
        // a flake that lands on a slope rolls a little way downhill first
        for (let roll = 0; roll < 3; roll++) { const l = ok(i - 1) ? p.h[i - 1] + (p.base ? p.base[i - 1] * -1 : 0) : 1e9, rr = ok(i + 1) ? p.h[i + 1] + (p.base ? p.base[i + 1] * -1 : 0) : 1e9, here = p.h[i] + (p.base ? -p.base[i] : 0);
          if (Math.min(l, rr) < here - 1.4) i += l < rr ? -1 : 1; else break; }
        if (Math.random() < .12) amt *= 2.2;                       // now and then a little clump
        const spread = 1 + ((Math.random() * 3) | 0), w0 = amt / (spread * 2 - 1 + .0001);
        for (let d = -(spread - 1); d <= spread - 1; d++) if (ok(i + d)) p.h[i + d] += w0 * (1 - Math.abs(d) * .25) * (.7 + Math.random() * .6);
        for (let d = -6; d <= 6; d++) if (ok(i + d)) p.h[i + d] += amt * .035;   // a thin blanket around it
        dirty = true;
        for (let k = 0; k < 2; k++) for (let j = 0; j < p.h.length; j++) {   // angle of repose: steep enough for peaks, not spikes
          if (!ok(j)) { p.h[j] = 0; continue; }
          const tb = j > 0 && ok(j - 1), ta = j < p.h.length - 1 && ok(j + 1);
          if (tb && p.h[j] - p.h[j - 1] > 3.6) { const m = (p.h[j] - p.h[j - 1]) / 4; p.h[j] -= m; p.h[j - 1] += m; }
          if (ta && p.h[j] - p.h[j + 1] > 3.6) { const m = (p.h[j] - p.h[j + 1]) / 4; p.h[j] -= m; p.h[j + 1] += m; }
          // at the edge of a letter or word, snow that's too tall tumbles off
          if ((!tb || !ta) && p.h[j] > 4.5 && Math.random() < .3) { p.h[j] -= 1.2; powder(rect.left + j * BUCKET, baseY(p, rect, j) - p.h[j], 1, .7, .2); }
        }
        if (p.mf) for (let j = 0; j < p.h.length; j++) { const cap = max * p.mf[j]; if (p.h[j] > cap) { if (Math.random() < .3) powder(rect.left + j * BUCKET, baseY(p, rect, j) - p.h[j], 1, .7, .2); p.h[j] = cap; } }
        for (const e of [0, p.h.length - 1]) if (p.h[e] > 3.5) { p.h[e] -= 1.5; if (Math.random() < .5) powder(rect.left + e * BUCKET + (e ? 4 : -4), rect.top - p.h[e], 1, .8, .2); }
        return true;
      }
      function frame(t) {
        raf = requestAnimationFrame(frame);
        if (document.hidden || !cx) return;
        const dt = Math.min(2.5, (t - last) / 16.7 || 1); last = t;
        const o = G.o; T = tuneOf(o);
        if (t - surfT > 400 && o.build) { surfT = t; surfaces(); }
        gustT -= dt; if (gustT <= 0) { gustT = rnd(90, 480); gustTarget = rnd(-1, 1) * T.gusts * (Math.random() < .3 ? 2.6 : 1); }
        gust += (gustTarget - gust) * .01 * dt;
        const wind = T.wind * .9 + Math.sin(t / 5200) * .25 * Math.abs(T.wind || .3) + gust;
        mouse.vx *= .9; mouse.vy *= .9; scrollKick *= .9;
        const want = Math.min(CAP, Math.round(150 * T.amount));
        cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height);
        const layer = coverLayer();
        const rects = o.build ? [...piles.entries()].filter(([el]) => !layer || el === GROUND || layer.contains(el) || el.closest('.isl')).map(([el, p]) => [el, p, rectOf(el, p)]) : [];
        const focus = document.activeElement && document.activeElement.matches && document.activeElement.matches('input,textarea,[contenteditable="true"]') ? document.activeElement : null;
        const light = !(window.CadenceThemes && window.CadenceThemes.isDark && window.CadenceThemes.isDark());
        const mspd = Math.hypot(mouse.vx, mouse.vy);
        meltAt(rects); flow(rects, dt);
        for (let i = flakes.length - 1; i >= 0; i--) {
          const f = flakes[i];
          f.ph += .02 * f.sp * dt; f.rot += f.vr * dt;
          const depthWind = f.far ? .5 : f.near ? 1.4 : 1;
          if (f.air) { f.vy += (f.clump ? .22 : .12) * dt; f.vx += (wind * depthWind - f.vx) * .01 * dt; if (!f.clump && f.vy > fallSpeed(f)) f.air = 0; }
          else { if (!f.tv) { f.tv = .85 + Math.random() * .3; f.fl = (f.crys ? 1.1 : .55) * (.6 + Math.random() * .8) / Math.max(.6, f.r * .45); }   // its own fall speed and flutter
            f.vx += ((wind + Math.sin(f.ph) * f.fl + Math.sin(f.ph * 2.3 + f.sp) * f.fl * .35) * depthWind - f.vx) * .035 * dt; f.vy += (fallSpeed(f) + scrollKick * (f.far ? .2 : 1) - f.vy) * .05 * dt; }
          // the mouse ploughs through, harder the faster it moves
          if (!f.far) { const dx = f.x - mouse.x, dy = f.y - mouse.y, d2 = dx * dx + dy * dy, R = 70 + Math.min(110, mspd * 4);
            if (d2 < R * R) { const d = Math.sqrt(d2) || 1, k = (R - d) / R; f.vx += (dx / d) * k * (1.2 + mspd * .08) + mouse.vx * .1 * k; f.vy += (dy / d) * k * (1 + mspd * .05) + mouse.vy * .1 * k; } }
          const ny = f.y + f.vy * dt, nx = f.x + f.vx * dt;
          let landed = false;
          if (o.build && f.vy > 0 && !f.far && !f.near) for (const [el, p, r] of rects) {
            if (nx < r.left || nx > r.right) continue;
            const i2 = Math.max(0, Math.min(p.h.length - 1, Math.round((nx - r.left) / BUCKET)));
            if (p.hole && p.hole[i2]) continue;   // between words: falls on through
            const top = baseY(p, r, i2) - p.h[i2];
            if (f.y <= top && ny >= top) {
              if (f.clump) { powder(nx, top - 2, 6 + (f.r | 0), 2.2, 2.2); settle(p, r, nx, f.r * .5); landed = true; break; }
              const boost = el === focus || (focus && el.contains(focus)) ? 2 : 1; landed = settle(p, r, nx + Math.max(-8, Math.min(8, wind * 3)), 1.15 * (f.crys ? 1.4 : 1) * f.r / 1.8 * boost) || landed; break; }
          }
          if (!landed && f.clump && ny > innerHeight - 4) { powder(nx, innerHeight - 6, 10, 2.6, 2.6); landed = true; }
          if (landed || ny > innerHeight + 20 || nx < -80 || nx > innerWidth + 80 || ny < -innerHeight * 1.5) { if (flakes.length > want || f.air) flakes.splice(i, 1); else Object.assign(f, newFlake()); continue; }
          f.x = nx; f.y = ny;
          // draw
          const X = f.x * DPR, Y = f.y * DPR;
          if (f.clump) { cx.globalAlpha = 1; cx.fillStyle = '#fff'; cx.shadowColor = light ? 'rgba(130,165,215,.55)' : 'rgba(0,0,0,.25)'; cx.shadowBlur = 4 * DPR;
            for (const [ox, oy, k] of [[0, 0, 1], [.6, -.3, .7], [-.5, .35, .65]]) { cx.beginPath(); cx.arc(X + ox * f.r * DPR, Y + oy * f.r * DPR, f.r * k * DPR, 0, 6.283); cx.fill(); }
            cx.shadowBlur = 0; cx.shadowColor = 'transparent'; continue; }
          if (G.bulbs && !f.far && f.y < 340) { const b = bulbAt(f.x), dist = Math.hypot(f.x - b.x, f.y - 18), k = bright(b, t) * Math.max(0, 1 - dist / 340);
            if (k > .05) { const s2 = (f.near ? f.r * 4 : f.r * 5 + 6) * DPR; cx.globalCompositeOperation = light ? 'source-over' : 'lighter'; cx.globalAlpha = Math.min(.9, k * (light ? .55 : .95)); cx.drawImage(tint(b.c), X - s2 / 2, Y - s2 / 2, s2, s2); cx.globalCompositeOperation = 'source-over'; } }
          cx.globalAlpha = f.o;
          if (f.near) { const s = f.r * 2.6 * DPR; cx.drawImage(BOKEH, X - s / 2, Y - s / 2, s, s); continue; }
          if (f.crys) { const s = f.r * 2 * DPR; cx.setTransform(Math.cos(f.rot), Math.sin(f.rot), -Math.sin(f.rot), Math.cos(f.rot), X, Y);
            cx.drawImage((light ? CRYS_L : CRYS)[f.spr], -s / 2, -s / 2, s, s); cx.setTransform(1, 0, 0, 1, 0, 0); continue; }
          const s = f.r * (light ? 3.2 : 2.4) * DPR;
          cx.drawImage(light ? ICE : SOFT, X - s / 2, Y - s / 2, s, s);
        }
        while (flakes.length < want) flakes.push(newFlake(true));
        // the drifts
        cx.globalAlpha = 1;
        for (const [, p, r] of rects) {
          if (o.melt) for (let j = 0; j < p.h.length; j++) if (p.h[j] > 0) p.h[j] = Math.max(0, p.h[j] - .004 * dt);
          // snow creeps: tiny sideways settling every frame closes the gaps into a continuous cover
          if (Math.random() < .25) for (let j = 1; j < p.h.length - 1; j++) { if (p.hole && (p.hole[j] || p.hole[j - 1] || p.hole[j + 1])) continue; const avg = (p.h[j - 1] + p.h[j + 1]) / 2; p.h[j] += (avg - p.h[j]) * .024; }
          let any = false; for (let j = 0; j < p.h.length; j++) if (p.h[j] > 1.2) { any = true; break; } if (!any) continue;
          const X = j => Math.min(r.right, r.left + j * BUCKET) * DPR, Yb = j => baseY(p, r, j) * DPR;
          // one smooth shape per run of solid ground (letters, words); curves through midpoints for soft peaks
          cx.beginPath();
          for (let j0 = 0; j0 < p.h.length;) { if (p.hole && p.hole[j0]) { j0++; continue; } let j1 = j0; while (j1 + 1 < p.h.length && !(p.hole && p.hole[j1 + 1])) j1++;
            const top = j => Yb(j) - p.h[j] * DPR; cx.moveTo(X(j0), Yb(j0)); cx.lineTo(X(j0), top(j0));
            for (let j = j0; j < j1; j++) { const mx = (X(j) + X(j + 1)) / 2, my = (top(j) + top(j + 1)) / 2; cx.quadraticCurveTo(X(j), top(j), mx, my); }
            cx.lineTo(X(j1), top(j1)); for (let j = j1; j >= j0; j--) cx.lineTo(X(j), Yb(j)); cx.closePath(); j0 = j1 + 1; }
          let hmax = 0; for (let j = 0; j < p.h.length; j++) if (p.h[j] > hmax) hmax = p.h[j];
          const gr = cx.createLinearGradient(0, (r.top - hmax - 2) * DPR, 0, r.top * DPR);
          gr.addColorStop(0, '#ffffff'); gr.addColorStop(.55, light ? '#f3f7fd' : '#eef3fa'); gr.addColorStop(1, light ? 'rgba(214,228,246,.82)' : 'rgba(205,219,238,.78)');
          // a soft glow instead of a hard edge, so the snow sits into the page
          cx.shadowColor = light ? 'rgba(150,180,220,.45)' : 'rgba(225,235,250,.35)'; cx.shadowBlur = 6 * DPR; cx.shadowOffsetY = 0; cx.fillStyle = gr; cx.fill();
          cx.shadowColor = 'transparent'; cx.shadowBlur = 0; cx.shadowOffsetY = 0;
          if (light) { cx.strokeStyle = 'rgba(200,218,242,.55)'; cx.lineWidth = DPR; cx.beginPath(); let on = false;   // a cool blue edge, no dark rim
            for (let j = 0; j < p.h.length; j++) { const x = X(j), y = Yb(j) - p.h[j] * DPR; if (p.h[j] > .8) { on ? cx.lineTo(x, y) : cx.moveTo(x, y); on = true; } else on = false; }
            cx.stroke(); }
          // the lights glint off the drift tops in their own colours
          if (G.bulbs && r.top < 520) { cx.globalCompositeOperation = light ? 'source-over' : 'lighter'; cx.lineWidth = 1.8 * DPR; cx.lineCap = 'round';
            for (let j = 0; j < p.h.length - 2; j += 2) { if (p.h[j] < 1.5) continue; const x = r.left + j * BUCKET, b = bulbAt(x), dist = Math.hypot(x - b.x, r.top - 18), k = bright(b, t) * Math.max(0, 1 - dist / 520);
              if (k < .06) continue; cx.globalAlpha = Math.min(.85, k * (light ? .7 : 1)); cx.strokeStyle = b.c; cx.beginPath(); cx.moveTo(X(j), Yb(j) - p.h[j] * DPR); cx.lineTo(X(j + 2), Yb(j + 2) - p.h[j + 2] * DPR); cx.stroke(); }
            cx.globalCompositeOperation = 'source-over'; cx.globalAlpha = 1; }
          // sparkle
          if (Math.random() < .08) { const j = (Math.random() * p.h.length) | 0; if (p.h[j] > 3) { cx.globalAlpha = .9; cx.fillStyle = '#fff'; cx.fillRect(X(j), Yb(j) - (p.h[j] - 1) * DPR, 1.5 * DPR, 1.5 * DPR); cx.globalAlpha = 1; } }
        }
      }
      function size() { if (!cv) return; DPR = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * DPR; cv.height = innerHeight * DPR; }
      function snow(o, user) {
        if (classicOff(o)) o = { ...o, snow: false };
        const want = o.on && o.snow && !reduced();
        if (!want) { cancelAnimationFrame(raf); raf = 0; cv && cv.remove(); cv = cx = null; flakes = []; if (user && (!o.on || !o.snow)) shovel(); else { piles.clear(); save(); } return; }
        T = tuneOf(o);
        if (!cv) { cv = document.createElement('canvas'); cv.id = 'xm-snow'; cv.setAttribute('aria-hidden', 'true'); document.body.appendChild(cv); cx = cv.getContext('2d'); size(); }
        if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
      }
      G.preview = o => show(o, true);
      G.reset = (x = {}) => setOpts({ ...opts(), on: false, ...x });
      // handlers are swapped on every setup (spaces rebuild plugins); the listeners themselves are bound once
      /* ---- fire melts snow: typing in Fire mode sends heat ("cadence:heat"). Snow under it melts into water that runs
         off the edges and streams down, and water too close to the flame turns to steam. A small falling-sand grid:
         every cell is empty, water or steam; water falls, slides diagonally, then spreads sideways; card tops are floors. */
      const CELL = 4, WATER = 1, STEAM = 2;
      let gw = 0, gh = 0, grid = null, solid = null, wcv = null, wcx = null, img = null, live = [], heats = [];
      const gi = (x, y) => y * gw + x;
      const wsprite = (r, stops) => { const c = document.createElement('canvas'); c.width = c.height = r * 2; const x = c.getContext('2d'), g = x.createRadialGradient(r * .8, r * .7, 0, r, r, r); stops.forEach(([o, col]) => g.addColorStop(o, col)); x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2); return c; };
      const DROP = wsprite(14, [[0, 'rgba(235,246,255,.95)'], [.25, 'rgba(120,185,255,.8)'], [.7, 'rgba(70,140,235,.35)'], [1, 'rgba(70,140,235,0)']]);
      const PUFF = wsprite(20, [[0, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]);
      function ensureGrid() { const w = Math.ceil(innerWidth / CELL), h = Math.ceil(innerHeight / CELL); if (grid && w === gw && h === gh) return; gw = w; gh = h; grid = new Uint8Array(gw * gh); solid = new Uint8Array(gw * gh); live = []; }
      const addCell = (x, y, k) => { const cx2 = Math.floor(x / CELL), cy2 = Math.floor(y / CELL); if (cx2 < 0 || cy2 < 0 || cx2 >= gw || cy2 >= gh) return; const i = gi(cx2, cy2); if (grid[i] || solid[i]) return; grid[i] = k; live.push(i); };
      function meltAt(rects) {
        if (!heats.length) return; ensureGrid();
        for (const h of heats.splice(0)) {
          for (const [, p, r] of rects) { if (h.y < r.top - 70 || h.y > r.bottom + 10 || h.x < r.left - h.r || h.x > r.right + h.r) continue;
            for (let j = 0; j < p.h.length; j++) { const x = r.left + j * BUCKET, d = Math.abs(x - h.x); if (d > h.r || p.h[j] < .3) continue;
              const m = Math.min(p.h[j], h.power * (1 - d / h.r)); p.h[j] -= m; dirty = true;
              for (let k = 0; k < m * 1.6; k++) addCell(x + Math.random() * BUCKET, r.top - p.h[j] - 2 - Math.random() * 3, Math.random() < .12 ? STEAM : WATER); } }
          for (const f of flakes) { if (Math.hypot(f.x - h.x, f.y - h.y) < h.r * .8 && Math.random() < .5) { f.y = -20; } }   // flakes in the flame vanish
          for (let k = 0; k < 3; k++) addCell(h.x + (Math.random() - .5) * 20, h.y - 10, STEAM); }
      }
      function flow(rects, dt) {
        if (!live.length || !grid) return;
        solid.fill(0);   // floors: the tops of the cards and boxes (water runs along them and pours off the ends)
        for (const [, , r] of rects) { const y = Math.floor(r.top / CELL); if (y < 1 || y >= gh) continue; const a = Math.max(0, Math.floor(r.left / CELL)), b = Math.min(gw - 1, Math.floor(r.right / CELL)); for (let x = a; x <= b; x++) solid[gi(x, y)] = 1; }
        const steps = Math.min(3, Math.max(1, Math.round(dt * 1.5))), next = [];
        live.sort((a, b) => b - a);   // bottom rows first, so a falling column doesn't block itself
        for (const i of live) {
          let k = grid[i]; if (!k) continue; let x = i % gw, y = (i / gw) | 0, at = i;
          for (let s2 = 0; s2 < steps; s2++) {
            const free = (xx, yy) => xx >= 0 && xx < gw && yy >= 0 && yy < gh && !grid[gi(xx, yy)] && !solid[gi(xx, yy)];
            if (k === WATER) {
              if (y >= gh - 1) { if (Math.random() < .02) { grid[at] = 0; k = 0; } break; }   // the bottom of the window: a puddle that dries up
              const dl = Math.random() < .5 ? -1 : 1;
              let nx = x, ny = y;
              if (free(x, y + 1)) ny = y + 1; else if (free(x + dl, y + 1)) { nx = x + dl; ny = y + 1; } else if (free(x - dl, y + 1)) { nx = x - dl; ny = y + 1; }
              else if (free(x + dl, y)) nx = x + dl; else if (free(x - dl, y)) nx = x - dl;
              else { if (Math.random() < .004) { grid[at] = 0; k = 0; } break; }   // resting water slowly evaporates
              grid[at] = 0; x = nx; y = ny; at = gi(x, y); grid[at] = k;
            } else {   // steam drifts up and fades
              if (Math.random() < .03 || y <= 0) { grid[at] = 0; k = 0; break; }
              const nx = x + (Math.random() < .5 ? -1 : 1) * (Math.random() < .4 ? 1 : 0), ny = y - 1;
              if (free(nx, ny)) { grid[at] = 0; x = nx; y = ny; at = gi(x, y); grid[at] = k; } else break;
            }
          }
          if (k) next.push(at);
        }
        live = next.length > 6000 ? next.slice(-6000) : next;
        // draw: each cell is a soft round drop; neighbours overlap and read as one body of water
        cx.save(); cx.setTransform(DPR, 0, 0, DPR, 0, 0); cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over'; cx.filter = 'none';
        for (const i of live) { const k = grid[i], x = (i % gw) * CELL, y = ((i / gw) | 0) * CELL; if (k === WATER) cx.drawImage(DROP, x - 5, y - 5, 14, 14); else { cx.globalAlpha = .5; cx.drawImage(PUFF, x - 8, y - 8, 20, 20); cx.globalAlpha = 1; } }
        cx.restore();
      }
      G.water = () => live.length;
      const H = G.h = {};
      {
        H.resize = () => { size(); G.o && lights(G.o); grid = null; };
        H['cadence:heat'] = e => { const d = e.detail || {}; if (!G.o || !G.o.on || !G.o.snow) return; heats.push({ x: d.x, y: d.y, r: d.r || 60, power: d.power || 2.5 }); if (heats.length > 30) heats.shift(); };
        H.theme = () => { piles.forEach(p => p.rad = -1); setTimeout(() => G.o && lights(G.o), 60); };
        H.pointermove = e => { const t = performance.now(), k = Math.max(1, t - mouse.t); mouse.vx = (e.clientX - mouse.x) / k * 16; mouse.vy = (e.clientY - mouse.y) / k * 16; if (Math.abs(mouse.vx) > 60) mouse.vx = 0; if (Math.abs(mouse.vy) > 60) mouse.vy = 0; mouse.x = e.clientX; mouse.y = e.clientY; mouse.t = t; };
        // a click: a shockwave through the air, and whatever you clicked shrugs its snow off
        H.pointerdown = e => { const o = G.o; if (!o || !o.on || !o.react || !cx) return;
          const x = e.clientX, y = e.clientY, R = 190 * Math.max(.7, Math.min(1.6, T.gusts));
          for (const f of flakes) { if (f.far) continue; const dx = f.x - x, dy = f.y - y, d = Math.hypot(dx, dy); if (d < R && d > 0) { const k = (1 - d / R) * 9; f.vx += dx / d * k; f.vy += dy / d * k - 1.5; f.air = f.clump ? 1 : f.air; } }
          let hit = null; for (const el of piles.keys()) if (el.contains(e.target) && (!hit || hit.contains(el))) hit = el;
          if (hit) knock(hit, 1);
          for (const [el] of piles) { if (el === hit) continue; const r = el.getBoundingClientRect(), cxm = Math.max(r.left, Math.min(x, r.right)), cym = Math.max(r.top, Math.min(y, r.bottom)), d = Math.hypot(cxm - x, cym - y); if (d < 140) knock(el, .35 * (1 - d / 140)); }
        };
        // scrolling shakes everything loose
        H.wheel = e => { const o = G.o; if (!o || !o.on || !o.react || !cx) return; const v = Math.max(-40, Math.min(40, e.deltaY)); scrollKick += -v * .04;
          if (Math.abs(v) > 12) for (const [el, p] of piles) if (Math.random() < .5) knock(el, Math.min(.5, Math.abs(v) / 120)); };
        // typing shakes snow off the box you're writing in
        H.keydown = e => { if (!G.o || !G.o.on || e.key.length > 1 && e.key !== 'Backspace') return; const el = document.activeElement; if (!el) return;
          for (const [s, p] of piles) if (s === el || s.contains(el)) { const r = s.getBoundingClientRect(); let shook = 0; for (let j = 0; j < p.h.length; j++) if (p.h[j] > 1 && Math.random() < .18) { p.h[j] *= .55; if (shook++ < 6) powder(r.left + j * BUCKET, r.top - 2, 1, 1.5, 3); } } };
      }
      if (!G.bound) { G.bound = true; const on = (t, o, tgt = window) => tgt.addEventListener(t === 'theme' ? 'cadence:theme' : t, e => G.h[t] && G.h[t](e), o);
        on('resize'); on('theme', undefined, document); on('pointermove', { passive: true }); on('pointerdown', { capture: true, passive: true }); on('wheel', { passive: true }); on('keydown', true); on('cadence:heat'); }

      function apply(user) { show(G.o = opts(), user); }
      function show(o, user) {
        document.documentElement.classList.toggle('xm-on', !!o.on);
        // Elements look: the shared effects layer does snow, lights and icicles (reduced motion keeps the classic, still lights)
        const eng = o.look !== 'classic' && !reduced();
        lights(eng ? { ...o, lights: false } : o); snow(eng ? { ...o, snow: false } : o, user);
        window.CadenceFX && window.CadenceFX.want('xmas', eng && o.on ? { snow: !!o.snow, everywhere: o.build !== false, lights: o.lights ? o.pattern : null, palette: o.lightStyle } : null);
      }
      G.teardown = () => { cancelAnimationFrame(raf); raf = 0; clearInterval(saveIv); save(); cv && cv.remove(); cv = cx = null; ringRO && ringRO.disconnect(); ringRO = null; ringMO && ringMO.disconnect(); ringMO = null; cancelAnimationFrame(followRaf); followRaf = 0; G.h = {}; };
      // a snow burst from the checkbox when you finish something (Blizzard and up)
      api.on('task:complete', () => { const o = G.o; if (!o || !o.on || T.gusts < 1 || reduced()) return; const c = document.querySelector('.task.done .check, .task.leaving .check'); const r = c ? c.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2 }; powder(r.left + 9, r.top, Math.round(25 * T.amount), 3.5, 5); });

      if (!document.getElementById('xm-css')) { const st = document.createElement('style'); st.id = 'xm-css'; st.textContent = `
        canvas#xm-snow{position:fixed;inset:0;width:100vw;height:100vh;z-index:27;pointer-events:none}
        /* light spill: each bulb's colour washes softly over the UI below it, pulsing with the bulb */
        #xm-glow{position:fixed;left:0;right:0;top:0;height:300px;z-index:26;pointer-events:none;overflow:hidden}
        #xm-glow i{position:absolute;top:-40px;width:200px;height:300px;margin-left:-100px;background:radial-gradient(closest-side,color-mix(in srgb,var(--c) 70%,transparent),transparent);opacity:.13;mix-blend-mode:normal}
        #xm-glow.dk i{opacity:.32;mix-blend-mode:screen}
        #xm-glow.xm-twinkle i{animation:xmgl 2.4s ease-in-out infinite;animation-delay:calc(var(--d) * -1)}
        #xm-glow.xm-chase i{animation:xmglc 1.2s steps(1) infinite;animation-delay:calc(var(--k) % 3 * -.4s)}
        @keyframes xmgl{50%{opacity:.04}} @keyframes xmglc{33%,66%{opacity:.03}}
        @media (prefers-reduced-motion:reduce){#xm-glow i{animation:none!important}}
        #xm-string{position:fixed;left:0;right:0;top:-2px;height:34px;z-index:29;pointer-events:none;overflow:hidden}
        #xm-string{height:44px!important}
        #xm-string .xm-wire{position:absolute;left:0;top:0}
        #xm-string .xm-wire path{fill:none;stroke:rgba(46,92,52,.5);stroke-width:1.3;stroke-linecap:round}
        #xm-ring{position:fixed;z-index:81;pointer-events:none}
        #xm-ring svg{display:block;overflow:visible} #xm-ring .xm-rw{fill:none;stroke:rgba(46,92,52,.45);stroke-width:1.1}
        #xm-ring circle{fill:var(--c);filter:drop-shadow(0 0 2.5px var(--c))}
        #xm-ring.xm-twinkle circle{animation:xmtw 2.4s ease-in-out infinite;animation-delay:calc(var(--d) * -1)}
        #xm-ring.xm-chase circle{animation:xmch 1.2s steps(1) infinite;animation-delay:calc(var(--k) % 3 * -.4s)}
        #xm-string i{position:absolute;top:12px;width:9px;height:14px;margin-left:-4.5px;border-radius:45% 45% 50% 50%/40% 40% 60% 60%;background:radial-gradient(circle at 35% 30%,color-mix(in srgb,var(--c) 40%,#fff),var(--c) 60%);
          box-shadow:0 0 5px 1px color-mix(in srgb,var(--c) 85%,transparent),0 0 14px 3px color-mix(in srgb,var(--c) 40%,transparent);transform-origin:50% -4px}
        #xm-string i::before{content:'';position:absolute;left:2px;top:-4px;width:5px;height:5px;border-radius:1.5px 1.5px .5px .5px;background:linear-gradient(90deg,#9aa3a8,#e8eef0 45%,#8a9398)}
        #xm-string.xm-twinkle i{animation:xmtw 2.4s ease-in-out infinite;animation-delay:calc(var(--d) * -1)}
        #xm-string.xm-chase i{animation:xmch 1.2s steps(1) infinite;animation-delay:calc(var(--k) % 3 * -.4s)}
        #xm-string.xm-sway i{animation-name:xmtw,xmsw;animation-duration:2.4s,3.2s;animation-iteration-count:infinite;animation-timing-function:ease-in-out}
        @keyframes xmtw{0%,100%{opacity:1;filter:brightness(1.15)}50%{opacity:.45;filter:brightness(.7)}}
        @keyframes xmch{0%{opacity:1}33%{opacity:.25}66%{opacity:.25}}
        @keyframes xmsw{0%,100%{rotate:-9deg}50%{rotate:9deg}}
        @media (prefers-reduced-motion:reduce){#xm-string i{animation:none!important}}
        .xm-row{display:flex;gap:8px;align-items:center;margin:8px 0;font-size:14px}
        .xm-adv{margin:4px 0 10px;border:1px solid var(--line);border-radius:var(--r);padding:8px 12px}.xm-adv summary{cursor:pointer;font-weight:600;font-size:13px}
        .xm-sl{display:grid;grid-template-columns:110px 1fr 54px;gap:10px;align-items:center;margin:8px 0;font-size:13px}.xm-sl input{width:100%;accent-color:var(--accent)}.xm-sl em{font-style:normal;color:var(--muted);font-variant-numeric:tabular-nums;text-align:right}
      `; document.head.appendChild(st); }
      apply();
    }
  });
})();
