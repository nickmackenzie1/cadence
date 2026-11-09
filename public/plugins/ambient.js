/* Ambient light: client pages glow in the client's brand colours, like bias lighting behind a TV.
   The page column becomes the "screen"; soft lights in the brand palette shine out around it and morph from one
   client's colours to the next as you switch. Buttons and checks take on the brand colour (contrast-checked).
   Works for Life areas too (from the area's colour). Themes can opt out with `--ambient: off`. */
Cadence.registerPlugin({
  id: 'ambient', name: 'Ambient light', version: '1.0.0', category: 'Look & feel',
  description: 'Client pages glow in the client\'s brand colours, like the bias lights behind a TV, and the colours morph as you move between clients. The page itself stays a calm, readable "screen", and buttons pick up the brand colour (adjusted until it passes contrast). Works for Life areas too.',
  tagline: 'Client pages glow in their brand colours', color: '#ff5c8a',
  icon: '<rect x="4" y="6" width="16" height="11" rx="2"/><path d="M2 4l2 2M22 4l-2 2M2 19l2-2M22 19l-2-2M9 21h6"/>',
  settings(api) {
    const o = Object.assign({ level: 'bold', drift: true, accent: true }, api.storage.get('opts') || {});
    api.ui.modal('Ambient light', `
      <div class="field"><label>Intensity</label><div class="seg" id="am-lv">${[['bold', 'Bold'], ['subtle', 'Subtle'], ['off', 'Off']].map(([k, l]) => `<button data-v="${k}" class="${o.level === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <label style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="am-dr" ${o.drift ? 'checked' : ''}> Lights drift slowly (like a living room at night)</label>
      <label style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="am-ac" ${o.accent ? 'checked' : ''}> Buttons and checks use the client's colour</label>
      <p class="muted" style="font-size:12.5px;margin:10px 0 0">Colours come from the Brand plugin (logo and website) or the client's own colour. Some retro themes switch the glow off.</p>`,
      `<button class="btn primary" id="am-save">Done</button>`);
    let level = o.level;
    document.querySelectorAll('#am-lv button').forEach(b => b.onclick = () => { level = b.dataset.v; document.querySelectorAll('#am-lv button').forEach(x => x.classList.toggle('on', x === b)); });
    document.getElementById('am-save').onclick = () => { api.storage.set('opts', { level, drift: document.getElementById('am-dr').checked, accent: document.getElementById('am-ac').checked }); api.ui.close(); window.__amb && window.__amb.update(true); };
  },
  setup(api) {
    const A = window.__amb = window.__amb || {};
    const opts = () => Object.assign({ level: 'bold', drift: true, accent: true }, api.storage.get('opts') || {});
    const html = document.documentElement;

    /* ---------- colour helpers ---------- */
    const hex = h => { h = String(h || '').trim(); if (/^#[0-9a-f]{3}$/i.test(h)) h = '#' + [...h.slice(1)].map(x => x + x).join(''); return /^#[0-9a-f]{6}$/i.test(h) ? h.toLowerCase() : null; };
    const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const toHex = a => '#' + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
    const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v, i) => v * (1 - t) + y[i] * t)); };
    const lum = h => { const c = rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const sat = h => { const [r, g, b] = rgb(h).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };
    const hsl = h => { let [r, g, b] = rgb(h).map(v => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let hh = 0, s = 0, l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; } return [hh, s, l]; };
    const fromHsl = (h, s, l) => { h = ((h % 360) + 360) % 360; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return toHex([f(0), f(8), f(4)].map(v => v * 255)); };
    // a lively palette: the brand's own colours, minus greys, topped up with hue-shifted siblings
    function palette(c) {
      const raw = [...((c.brand && c.brand.palette) || []), c.brand && c.brand.primary, c.brand && c.brand.secondary, c.themeColor, c.color].map(hex).filter(Boolean);
      let cols = [...new Set(raw)].filter(h => sat(h) > 0.18 && lum(h) > 0.02 && lum(h) < 0.92);
      if (!cols.length) cols = [hex(c.color) || '#5b5bd6'];
      const base = cols[0], [hh, s, l] = hsl(base);
      const sib = [fromHsl(hh + 35, Math.min(1, s * 1.05), Math.min(.62, l + .08)), fromHsl(hh - 40, s, Math.max(.38, l - .04)), fromHsl(hh + 180 * .18, s * .9, .55)];
      while (cols.length < 5) cols.push(sib[(cols.length - 1) % sib.length]);
      return cols.slice(0, 5);
    }
    // the brand colour, nudged darker/lighter until it reads on this theme's page (WCAG 3:1 for UI, 4.5 for text use)
    function readable(c, bg) {
      let x = c, toward = lum(bg) > 0.4 ? '#000000' : '#ffffff';
      for (let i = 0; i < 12 && contrast(x, bg) < 4.5; i++) x = mix(x, toward, 0.12);
      return x;
    }

    /* ---------- the light layer (lives outside the page so colours morph between clients) ---------- */
    if (!document.getElementById('amb-css')) {
      const st = document.createElement('style'); st.id = 'amb-css';
      st.textContent = `
        #amb{position:fixed;z-index:-1;pointer-events:none;overflow:hidden;opacity:0;transition:opacity .9s ease}
        html.amb-on #amb{opacity:1}
        #amb i{position:absolute;width:var(--s,46vmax);height:var(--s,46vmax);border-radius:50%;background-color:var(--c,transparent);filter:blur(var(--blur,90px));opacity:var(--o,.6);
          transition:background-color 1.6s cubic-bezier(.4,0,.2,1),transform 1.1s cubic-bezier(.3,1.2,.5,1),opacity 1s;will-change:transform}
        #amb i:nth-child(1){left:-18%;top:-22%} #amb i:nth-child(2){right:-20%;top:-18%} #amb i:nth-child(3){right:-24%;top:34%}
        #amb i:nth-child(4){left:-24%;top:40%} #amb i:nth-child(5){left:20%;bottom:-40%}
        html.amb-drift #amb i{animation:ambdrift 26s ease-in-out infinite alternate}
        html.amb-drift #amb i:nth-child(2){animation-duration:31s;animation-delay:-7s} html.amb-drift #amb i:nth-child(3){animation-duration:37s;animation-delay:-13s}
        html.amb-drift #amb i:nth-child(4){animation-duration:29s;animation-delay:-19s} html.amb-drift #amb i:nth-child(5){animation-duration:34s;animation-delay:-3s}
        @keyframes ambdrift{50%{translate:4vmax -3vmax;scale:1.08}100%{translate:-3vmax 4vmax;scale:.94}}
        #amb.surge i{transform:scale(1.22);opacity:calc(var(--o,.6) + .15)}
        @media (prefers-reduced-motion:reduce){html.amb-drift #amb i{animation:none}#amb.surge i{transform:none}}
        /* the screen: the page column stays calm and readable on top of the glow */
        html.amb-on .main{background:transparent}
        html.amb-on #view{background:color-mix(in srgb,var(--bg) 84%,transparent);-webkit-backdrop-filter:blur(26px) saturate(1.25);backdrop-filter:blur(26px) saturate(1.25);
          border-radius:26px;margin-top:22px;margin-bottom:40px;box-shadow:0 0 0 1px color-mix(in srgb,var(--amb1) 30%,transparent),0 40px 120px -40px color-mix(in srgb,var(--amb1) 70%,transparent),0 0 90px -30px color-mix(in srgb,var(--amb2) 60%,transparent);
          transition:box-shadow 1.6s ease}
        html.amb-on.amb-subtle #view{background:color-mix(in srgb,var(--bg) 90%,transparent)}
        html.amb-on .c-hero{border-radius:26px 26px 0 0}
        /* the hero takes the brand gradient, boldly */
        html.amb-on .c-hero .bg:not(.img){background:radial-gradient(900px 340px at 0% 0%,color-mix(in srgb,var(--amb1) 52%,transparent),transparent 70%),radial-gradient(800px 320px at 100% 10%,color-mix(in srgb,var(--amb2) 46%,transparent),transparent 70%),linear-gradient(180deg,color-mix(in srgb,var(--amb3) 22%,transparent),transparent)!important;-webkit-mask-image:linear-gradient(180deg,#000 55%,transparent);mask-image:linear-gradient(180deg,#000 55%,transparent);transition:background 1.4s}
        html.amb-on.amb-subtle .c-hero .bg:not(.img){opacity:.6}
        html.amb-on .c-hero::after{content:'';position:absolute;left:0;right:0;top:0;height:4px;background:linear-gradient(90deg,var(--amb1),var(--amb2),var(--amb3),var(--amb4));opacity:.9}
        html.amb-on .c-hero h1 .nm{text-shadow:0 1px 0 color-mix(in srgb,var(--bg) 60%,transparent)}
        html.amb-on .stat{border-top:3px solid color-mix(in srgb,var(--amb1) 70%,var(--line))!important}
      `;
      document.head.appendChild(st);
    }
    let layer = document.getElementById('amb');
    if (!layer) { layer = document.createElement('div'); layer.id = 'amb'; layer.setAttribute('aria-hidden', 'true'); layer.innerHTML = '<i></i><i></i><i></i><i></i><i></i>'; document.body.prepend(layer); }

    // keep the lights inside the main area (the sidebar stays solid)
    function fit() { const m = document.querySelector('.main'); if (!m) return; const r = m.getBoundingClientRect(); Object.assign(layer.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }); }
    if (!A.resize) { A.resize = true; addEventListener('resize', () => fit()); }

    const view = () => document.getElementById('view');
    const ACCENT_VARS = ['--accent', '--accent-soft', '--on-accent', '--amb1', '--amb2', '--amb3', '--amb4'];
    function off() {
      html.classList.remove('amb-on', 'amb-subtle', 'amb-drift'); A.cid = null;
      const v = view(); if (v) ACCENT_VARS.forEach(k => v.style.removeProperty(k));
    }
    function update(force) {
      if (!api.plugins.enabled('ambient')) return off();
      const o = opts(), r = (location.hash || '#today').slice(1);
      const themeOff = getComputedStyle(html).getPropertyValue('--ambient').trim() === 'off';
      const c = r.startsWith('client-') && api.clients.get(r.slice(7));
      if (!c || o.level === 'off' || themeOff) return off();
      fit();
      const pal = palette(c), v = view();
      const changed = A.cid !== c.id;
      layer.querySelectorAll('i').forEach((el, i) => { el.style.setProperty('--c', pal[i % pal.length]); el.style.setProperty('--o', o.level === 'bold' ? (i === 4 ? .45 : .62) : .32); });
      html.classList.add('amb-on'); html.classList.toggle('amb-subtle', o.level === 'subtle'); html.classList.toggle('amb-drift', !!o.drift);
      if (v) {
        pal.slice(0, 4).forEach((x, i) => v.style.setProperty('--amb' + (i + 1), x));
        if (o.accent) {
          const bg = hex(getComputedStyle(html).getPropertyValue('--bg').trim()) || '#f7f6f3', acc = readable(pal[0], bg);
          v.style.setProperty('--accent', acc); v.style.setProperty('--accent-soft', `color-mix(in srgb, ${acc} 16%, var(--panel))`);
          v.style.setProperty('--on-accent', contrast(acc, '#ffffff') >= contrast(acc, '#111111') ? '#ffffff' : '#111111');
        } else ['--accent', '--accent-soft', '--on-accent'].forEach(k => v.style.removeProperty(k));
      }
      // a dramatic change between clients: the lights surge, then settle into the new colours
      if (changed && A.cid && !api.ui.reducedMotion()) { layer.classList.remove('surge'); void layer.offsetWidth; layer.classList.add('surge'); clearTimeout(A.st); A.st = setTimeout(() => layer.classList.remove('surge'), 650); }
      A.cid = c.id;
    }
    A.update = update;
    if (!A.hash) { A.hash = true; addEventListener('hashchange', () => setTimeout(() => window.__amb.update(), 0)); }   // also clears the glow if the plugin is switched off
    api.on('render', () => update());
    api.on('client:update', () => update(true));
    api.on('space', () => update(true));
    document.addEventListener('cadence:theme', () => update(true));
    update();
  }
});
