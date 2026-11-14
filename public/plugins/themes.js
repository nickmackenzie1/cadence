/* Themes: the theming engine (a plugin like everything else) + the gallery.

   Any plugin can add a theme:
     CadenceThemes.register({
       id: 'my-theme', name: 'My theme', category: 'Useful' | 'Fun' | 'Crazy', tagline: 'One line',
       vars:  { '--accent': '#e5484d', ... },          // design tokens, always applied
       light: { ... }, dark: { ... },                   // optional: follow the light/dark toggle
       font: '"My Font", system-ui',                    // optional body font
       fonts: [{ family: 'My Font', src: 'vendor/x.woff2', weight: 400 }],
       stylesheets: ['vendor/lib.css'], scripts: ['vendor/lib.js'],   // loaded only while active
       css: ':skin .btn { … }',                         // ':skin' becomes html[data-skin="my-theme"]
       enhance(ctx) { …; return () => cleanup },        // DOM tweaks that are part of the look (always run)
       effects(ctx) { …; return () => cleanup },        // motion/overlays; skipped when Effects is Off or reduced motion
                                                        // ctx = { layer, level: 'full'|'low', tokens, isDark, api }
       preview: { bg, panel, side, text, accent, line } // gallery card colours (optional, read from vars otherwise)
     });
   Read the live theme from your own plugin with CSS variables (var(--accent) …), or in JS:
     CadenceThemes.token('--accent'), CadenceThemes.isDark(), CadenceThemes.current(),
     CadenceThemes.on(fn)  or  document.addEventListener('cadence:theme', e => e.detail) */
(() => {
  const T = new Map(), subs = new Set();
  const html = document.documentElement;
  const st = document.createElement('style'); st.id = 'cadence-skin'; document.head.appendChild(st);
  let current = 'cadence', links = [], fx = null, enh = null, apiRef = null;
  const loadedScripts = new Set();

  const varsCss = o => Object.entries(o || {}).map(([k, v]) => `${k.startsWith('--') ? k : '--' + k}:${v}`).join(';');
  const fontSt = document.createElement('style'); fontSt.id = 'cadence-skin-fonts'; document.head.appendChild(fontSt);
  function fontFaces() { fontSt.textContent = [...T.values()].map(t => cssFor(t, true)).join(''); }
  function cssFor(t, opts_fonts) {
    if (opts_fonts) { let o = ''; for (const f of t.fonts || []) o += `@font-face{font-family:"${f.family}";src:url("${f.src}") ${f.mine ? '' : `format("${/\.ttf$/.test(f.src) ? 'truetype' : /\.woff$/.test(f.src) ? 'woff' : 'woff2'}")`};font-weight:${f.weight || 400};font-style:${f.style || 'normal'};font-display:swap}`; return o; }
    const sel = `html[data-skin="${t.id}"]`; let out = '';
    if (t.vars) out += `${sel}{${varsCss(t.vars)}}`;
    if (t.light) out += `${sel}:not([data-theme=dark]){${varsCss(t.light)}}`;
    if (t.dark) out += `${sel}[data-theme=dark]{${varsCss(t.dark)}}`;
    if (t.font) out += `${sel} body,${sel} button,${sel} input,${sel} textarea,${sel} select{font-family:${t.font}}`;
    if (t.css) out += String(t.css).replaceAll(':skin', sel);
    return out;
  }
  // settings live in plugin storage; before the plugin API is ready, read them straight from the saved state
  function stored(k) {
    if (apiRef) return apiRef.storage.get(k);
    try { const s = JSON.parse(localStorage.getItem(sessionStorage.getItem('cadence.demo') === '1' ? 'cadence.demo.v1' : 'cadence.v1') || '{}'); return ((s.pluginData || {}).themes || {})[k]; } catch (e) { return undefined; }
  }
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function custom() {
    const c = stored('custom') || {};
    for (const k of ['--accent', '--accent-soft', '--r', '--font-override']) html.style.removeProperty(k);
    if (c.accent) { html.style.setProperty('--accent', c.accent); html.style.setProperty('--accent-soft', `color-mix(in srgb, ${c.accent} 16%, var(--panel))`); }
    if (c.radius != null) html.style.setProperty('--r', c.radius + 'px');
    let fo = document.getElementById('cadence-skin-custom');
    const FONTS = { sans: 'Inter, system-ui, sans-serif', serif: '"Iowan Old Style", "Palatino Linotype", Georgia, serif', mono: '"JetBrains Mono", ui-monospace, monospace', system: 'system-ui, -apple-system, "Segoe UI", sans-serif', rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif' };
    let rules = '';
    if (c.font && FONTS[c.font]) rules += `body,button,input,textarea,select{font-family:${FONTS[c.font]}!important}`;
    // corners: --r is the base; every radius in the app is a multiple of it (core.css --r-s/-m/-l/-xl)
    if (rules) { if (!fo) { fo = document.createElement('style'); fo.id = 'cadence-skin-custom'; document.head.appendChild(fo); } fo.textContent = rules; }
    else if (fo) fo.remove();
  }

  function apply(id, opts = {}) {
    const t = T.get(id) || T.get('cadence');
    for (const f of [fx, enh]) if (f) { try { f(); } catch (e) { console.warn('theme cleanup', e); } }
    fx = enh = null;
    document.querySelectorAll('.th-fx').forEach(e => e.remove());
    links.forEach(l => l.remove()); links = [];
    current = t.id;
    st.textContent = cssFor(t);
    if (t.id === 'cadence') delete html.dataset.skin; else html.dataset.skin = t.id;
    for (const href of t.stylesheets || []) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); links.push(l); }
    for (const src of t.scripts || []) if (!loadedScripts.has(src)) { loadedScripts.add(src); const s = document.createElement('script'); s.src = src; document.head.appendChild(s); }
    custom();
    // enhance: DOM tweaks that are part of the look (always on); effects: motion and overlays (Effects setting)
    if (t.enhance) { try { enh = t.enhance({ tokens: token, isDark, api: apiRef }) || null; } catch (e) { console.warn('theme enhance', e); } }
    const level = stored('effects') || 'full';
    if (t.effects && level !== 'off' && !reduced() && !opts.noEffects) {
      const layer = document.createElement('div'); layer.className = 'th-fx'; layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:24;overflow:hidden';
      document.body.appendChild(layer);
      try { fx = t.effects({ layer, level, tokens: token, isDark, api: apiRef }) || null; } catch (e) { console.warn('theme effects', e); }
    }
    requestAnimationFrame(() => { const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = token('--bg') || m.content; });
    if (opts.save && apiRef) { apiRef.storage.set('theme', t.id); apiRef.storage.set('recent', [t.id, ...(apiRef.storage.get('recent') || []).filter(x => x !== t.id)].slice(0, 6)); }
    const detail = { id: t.id, theme: t, dark: isDark() };
    subs.forEach(fn => { try { fn(detail); } catch (e) { console.error(e); } });
    document.dispatchEvent(new CustomEvent('cadence:theme', { detail }));
  }
  function token(name) { return getComputedStyle(html).getPropertyValue(name.startsWith('--') ? name : '--' + name).trim(); }
  function lum(c) { const m = /^#?([0-9a-f]{6})$/i.exec(c) || /^#?([0-9a-f]{3})$/i.exec(c); if (!m) { const r = /rgba?\((\d+)\D+(\d+)\D+(\d+)/.exec(c); return r ? (0.2126 * r[1] + 0.7152 * r[2] + 0.0722 * r[3]) / 255 : 1; } let h = m[1]; if (h.length === 3) h = [...h].map(x => x + x).join(''); const n = parseInt(h, 16); return (0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255; }
  function isDark() { return lum(token('--bg')) < 0.45; }

  // quick switcher from the sidebar's palette button: light/dark, recent themes, a few favourites, the full gallery
  function quick(anchorEl) {
    document.querySelectorAll('.thq').forEach(x => x.remove());
    if (!apiRef) return;
    const E = apiRef.ui.esc, cur = T.get(current), adaptive = !cur.vars || cur.id === 'cadence' || (cur.light && cur.dark);
    const recent = (apiRef.storage.get('recent') || []).filter(id => T.has(id) && id !== current).slice(0, 5);
    const picks = ['cadence', 'dracula', 'catppuccin-mocha', 'neobrutalism', 'ninety-five', 'calm', 'tokyo-night', 'paper'].filter(id => T.has(id) && id !== current && !recent.includes(id)).slice(0, 6 - Math.min(recent.length, 3));
    const sw = id => { const t = T.get(id), v = Object.assign({}, t.light || {}, t.vars || {}), p = t.preview || {};
      return `<button class="thq-t ${id === current ? 'on' : ''}" data-q="${E(id)}"><span class="thq-sw" style="background:${E(p.bg || v['--bg'] || '#f7f6f3')};border-color:${E(p.line || v['--line'] || '#ddd')}"><i style="background:${E(p.accent || v['--accent'] || '#5b5bd6')}"></i><i style="background:${E(p.text || v['--text'] || '#222')}"></i></span>${E(t.name)}</button>`; };
    const box = document.createElement('div'); box.className = 'thq';
    box.innerHTML = `<div class="thq-h"><b>${E(cur.name)}</b><span>${adaptive ? 'Follows light & dark' : (isDark() ? 'Always dark' : 'Always light')}</span></div>
      ${adaptive ? `<div class="seg thq-mode"><button data-m="light" class="${apiRef.ui.colorMode() === 'light' ? 'on' : ''}">☀ Light</button><button data-m="dark" class="${apiRef.ui.colorMode() === 'dark' ? 'on' : ''}">☾ Dark</button></div>` : ''}
      ${recent.length ? `<div class="thq-l">Recent</div>${recent.map(sw).join('')}` : ''}
      ${picks.length ? `<div class="thq-l">Try</div>${picks.map(sw).join('')}` : ''}
      <button class="thq-all" data-q="__all">Browse all ${T.size} themes →</button>`;
    document.body.appendChild(box);
    const r = anchorEl.getBoundingClientRect(), h = box.offsetHeight;
    box.style.left = Math.max(8, Math.min(innerWidth - box.offsetWidth - 8, r.left - 20)) + 'px';
    box.style.top = Math.max(8, r.top - h - 10) + 'px';
    const close = () => { box.remove(); removeEventListener('pointerdown', out, true); removeEventListener('keydown', esc, true); };
    const out = e => { if (!box.contains(e.target) && e.target !== anchorEl && !anchorEl.contains(e.target)) close(); };
    const esc = e => { if (e.key === 'Escape') close(); };
    setTimeout(() => { addEventListener('pointerdown', out, true); addEventListener('keydown', esc, true); }, 0);
    box.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { apiRef.ui.setColorMode(b.dataset.m); close(); });
    box.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
      if (b.dataset.q === '__all') { close(); apiRef.ui.navigate('view-themes'); return; }
      const prev = current; window.CadenceThemes.apply(b.dataset.q); close();
      apiRef.ui.toast(`Theme: ${T.get(current).name}`, [{ label: 'Undo', run: () => window.CadenceThemes.apply(prev) }]);
    });
  }

  window.CadenceThemes = {
    register(t) {
      if (!t || !/^[a-z0-9-]{2,40}$/.test(t.id || '')) throw new Error('Theme needs an id like "my-theme"');
      T.set(t.id, Object.freeze({ category: 'Fun', ...t })); if (t.fonts) fontFaces();
      if (current === t.id) apply(t.id);                      // re-registered while active: refresh
      else if (stored('theme') === t.id && current === 'cadence') apply(t.id);   // its pack loaded after boot
      if (apiRef) apiRef.ui.refresh();
    },
    apply: id => apply(id, { save: true }),
    current: () => T.get(current), list: () => [...T.values()],
    token, isDark,
    quick: el => quick(el),
    on(fn) { subs.add(fn); return () => subs.delete(fn); },
  };

  // the built-in default: Cadence as it was designed (light/dark follow the moon toggle)
  window.CadenceThemes.register({ id: 'cadence', name: 'Cadence', category: 'Useful', tagline: 'The original. Follows light and dark.',
    preview: { bg: '#f7f6f3', panel: '#fff', side: '#f0eee9', text: '#1d1c1a', accent: '#5b5bd6', line: '#e7e4dd' } });
  apply(stored('theme') || 'cadence');     // as early as possible: no flash of the wrong theme

  const CATS = ['Useful', 'Editor', 'daisyUI', 'Fun', 'Movie & TV', 'Studio Ghibli', 'Games', 'Seasonal', 'Crazy'];
  Cadence.registerPlugin({
    id: 'themes', name: 'Themes', version: '1.0.0', category: 'Look & feel',
    description: 'A theming engine for the whole app and every plugin, plus a gallery of useful, fun and properly unhinged themes. Customise the accent, font and corners on top of any theme. Plugins can add their own themes with CadenceThemes.register().',
    tagline: 'Useful, fun and crazy themes', color: '#b06bd6',
    icon: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A4.6 4.6 0 0 0 21 9.8C21 6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
    settings(api) { api.ui.navigate('view-themes'); },
    setup(api) {
      apiRef = api;
      if (!document.getElementById('th-css')) {
        const s = document.createElement('style'); s.id = 'th-css';
        s.textContent = `
          .thg [hidden]{display:none!important}
          .thg{display:grid;grid-template-columns:200px minmax(0,1fr);gap:28px;align-items:start}
          .thg-nav{position:sticky;top:12px;display:flex;flex-direction:column;gap:10px;max-height:calc(100vh - 24px);overflow:auto}
          .thg-tone{width:100%}.thg-tone button{flex:1}
          .thg-idx{display:flex;flex-direction:column;gap:1px}
          .thg-idx button{display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-radius:var(--r-m);font-size:13px;color:var(--muted);text-align:left}
          .thg-idx button span{font-size:11px;color:var(--faint);font-variant-numeric:tabular-nums}
          .thg-idx button:hover{background:var(--hover);color:var(--text)} .thg-idx button.on{background:var(--accent-soft);color:var(--accent);font-weight:600}
          .thg-fam{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px;max-height:168px;overflow:auto;padding:2px}
          .thg-fam button{display:flex;align-items:center;gap:6px;padding:4px 8px 4px 4px;border:1px solid var(--line);border-radius:999px;background:var(--panel);color:var(--text);font:inherit;font-size:12px;cursor:pointer}
          .thg-fam button.on{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
          .thg-fam i{position:relative;width:22px;height:22px;border-radius:50%;overflow:hidden;border:1px solid rgba(0,0,0,.15);flex:none}
          .thg-fam i b{position:absolute;right:0;top:0;width:50%;height:100%}.thg-fam i s{position:absolute;left:0;bottom:0;width:50%;height:45%}
          .thg-rand{display:inline-flex;align-items:center;justify-content:center;gap:6px}.thg-rand svg{width:15px;height:15px}
          .thg-now{display:grid;grid-template-columns:minmax(0,260px) 1fr;gap:20px;align-items:center;padding:16px;border:1px solid var(--line);border-radius:var(--r-l);background:var(--panel);scroll-margin-top:12px}
          .thg-big .th-mini{height:150px;border-radius:var(--r-m);border:1px solid var(--line);grid-template-columns:70px 1fr}
          .thg-k{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
          .thg-info h2{margin:4px 0 2px;font-size:22px;letter-spacing:-.01em}.thg-info p{margin:0 0 12px;color:var(--muted);font-size:13px}
          .thg-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.thg-row .btn{display:inline-flex;align-items:center;gap:6px}.thg-row svg{width:15px;height:15px}
          .thg-now .th-cust{grid-column:1/-1;margin-top:4px}
          .thg-none{padding:30px;text-align:center;color:var(--muted)}
          @media (max-width:860px){.thg{grid-template-columns:1fr;gap:14px}.thg-nav{position:static;max-height:none}.thg-idx{flex-direction:row;overflow-x:auto;scrollbar-width:none}.thg-idx button{flex:none;gap:6px}.thg-now{grid-template-columns:1fr}}
          .th-cat{margin:26px 0 10px;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);scroll-margin-top:12px}.th-cat span{color:var(--faint);margin-left:4px}
          .th-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
          .th-card{border:1px solid var(--line);border-radius:14px;overflow:hidden;cursor:pointer;background:var(--panel);transition:transform .15s,box-shadow .2s,border-color .2s;text-align:left;padding:0;display:block;width:100%}
          .th-card:hover{transform:translateY(-2px);box-shadow:var(--shadow)}
          .th-card.on{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent)}
          .th-mini{height:92px;display:grid;grid-template-columns:52px 1fr;background:var(--p-bg);font-family:var(--p-font,inherit);position:relative;overflow:hidden}
          .th-mini .s{background:var(--p-side);border-right:1px solid var(--p-line);padding:9px 7px;display:flex;flex-direction:column;gap:5px}
          .th-mini .s i{height:5px;border-radius:3px;background:var(--p-text);opacity:.18}
          .th-mini .s i.a{background:var(--p-accent);opacity:.9}
          .th-mini .m{padding:10px 11px;display:flex;flex-direction:column;gap:6px}
          .th-mini .h{font-weight:700;font-size:13px;color:var(--p-text);line-height:1;white-space:nowrap;overflow:hidden}
          .th-mini .r{display:flex;align-items:center;gap:6px;background:var(--p-panel);border:1px solid var(--p-line);border-radius:var(--p-r,6px);padding:4px 6px}
          .th-mini .r b{width:9px;height:9px;border-radius:50%;border:1.5px solid var(--p-accent);flex:none}
          .th-mini .r span{height:4px;flex:1;border-radius:2px;background:var(--p-text);opacity:.35}
          .th-mini .bt{align-self:flex-start;background:var(--p-accent);color:#fff;font-size:9px;font-weight:700;padding:3px 8px;border-radius:var(--p-r,6px)}
          .th-meta{padding:10px 12px 12px}
          .th-meta b{display:block;font-size:13.5px}
          .th-meta span{display:block;font-size:12px;color:var(--muted);margin-top:2px;line-height:1.35}
          .th-fxbadge{position:absolute;right:6px;top:6px;font-size:10px;font-weight:700;background:rgba(0,0,0,.55);color:#fff;border-radius:999px;padding:2px 7px}
          .th-cust{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--panel)}
          .th-cust label{display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px}
          .th-cust input[type=color]{width:100%;height:34px;border:1px solid var(--line);border-radius:8px;background:none;padding:2px}
          .th-cust input[type=range]{width:100%}
          .th-filter{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:18px 0 0}
          .th-filter .pl-cats button span{opacity:.6;margin-left:3px}
          .thq{position:fixed;z-index:70;width:250px;background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow),0 18px 50px -12px rgba(0,0,0,.28);padding:10px;animation:thqin .2s cubic-bezier(.2,1.2,.4,1);color:var(--text)}
          @keyframes thqin{from{opacity:0;transform:translateY(6px) scale(.98)}}
          .thq-h{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:2px 4px 8px}
          .thq-h b{font-size:13.5px}.thq-h span{font-size:11px;color:var(--muted)}
          .thq-mode{display:flex;margin:0 0 6px}.thq-mode button{flex:1}
          .thq-l{font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);padding:8px 4px 4px}
          .thq-t{display:flex;align-items:center;gap:9px;width:100%;padding:6px;border-radius:8px;font-size:13px;text-align:left}
          .thq-t:hover{background:var(--hover)} .thq-t.on{font-weight:650}
          .thq-sw{width:26px;height:18px;border-radius:5px;border:1px solid;display:flex;align-items:flex-end;gap:2px;padding:3px;flex:none}
          .thq-sw i{flex:1;height:5px;border-radius:2px}
          .thq-all{display:block;width:100%;margin-top:8px;padding:8px;border-radius:9px;background:var(--hover);font-weight:600;font-size:12.5px;text-align:center}
          .thq-all:hover{background:var(--accent-soft);color:var(--accent)}
          .th-dev{margin-top:26px;font-size:13px;color:var(--muted)}
          .th-dev code{font-family:var(--mono);font-size:12px;background:var(--hover);padding:1px 5px;border-radius:5px}
        `;
        document.head.appendChild(s);
      }
      api.views.add({ id: 'themes', title: 'Themes', icon: '◐', subtitle: 'One look for the whole app, on every device', wide: true, render: el => gallery(el) });
      api.commands.add({ title: 'Theme gallery', hint: 'Look & feel', run: () => api.ui.navigate('view-themes') });
      api.commands.add({ title: 'Next theme', run: () => { const l = [...T.keys()]; const id = l[(l.indexOf(current) + 1) % l.length]; window.CadenceThemes.apply(id); api.island.show({ icon: '◐', title: T.get(id).name, sub: T.get(id).tagline || '', ms: 2200 }); } });
      for (const t of T.values()) api.commands.add({ title: `Theme: ${t.name}`, run: () => window.CadenceThemes.apply(t.id) });
      api.on('sync', e => { if (e && (e.phase === 'pulled') && (api.storage.get('theme') || 'cadence') !== current) apply(api.storage.get('theme') || 'cadence'); });
      // the moon toggle swaps light/dark: adaptive themes and effects need a refresh
      if (!window.__thObs) { window.__thObs = new MutationObserver(() => { const d = { id: current, theme: T.get(current), dark: isDark() }; subs.forEach(fn => fn(d)); document.dispatchEvent(new CustomEvent('cadence:theme', { detail: d })); }); window.__thObs.observe(html, { attributes: true, attributeFilter: ['data-theme'] }); }
      if ((api.storage.get('theme') || 'cadence') !== current) apply(api.storage.get('theme') || 'cadence');

      function preview(t) {
        const p = Object.assign({}, { bg: t.vars?.['--bg'] || t.light?.['--bg'], panel: t.vars?.['--panel'] || t.light?.['--panel'], side: t.vars?.['--side'] || t.light?.['--side'], text: t.vars?.['--text'] || t.light?.['--text'], accent: t.vars?.['--accent'] || t.light?.['--accent'], line: t.vars?.['--line'] || t.light?.['--line'], r: t.vars?.['--r'] }, t.preview || {});
        const v = Object.entries({ bg: p.bg || '#f7f6f3', panel: p.panel || '#fff', side: p.side || p.panel || '#f0eee9', text: p.text || '#1d1c1a', accent: p.accent || '#5b5bd6', line: p.line || '#e7e4dd', r: p.r || '6px', font: p.font || t.font || 'inherit' }).map(([k, x]) => `--p-${k}:${x}`).join(';');
        return `<div class="th-mini" style="${api.ui.esc(v)};${p.extra ? api.ui.esc(p.extra) : ''}"><div class="s"><i class="a"></i><i></i><i></i><i></i></div><div class="m"><div class="h">Today</div><div class="r"><b></b><span></span></div><div class="r"><b></b><span style="flex:.6"></span></div><div class="bt">Add</div></div>${t.effects ? '<span class="th-fxbadge">FX</span>' : ''}</div>`;
      }
      const G = window.__thUI = window.__thUI || { tone: 'all', q: '', open: false };
      const toneOf = t => { const v = t.vars || t.light || {}; const bg = (t.preview && t.preview.bg) || v['--bg'] || '#fff'; return t.light && t.dark ? 'both' : lum(bg) < 0.45 ? 'dark' : 'light'; };
      const slug = c => 'thg-' + String(c).toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const catsNow = () => { const seen = [...new Set([...T.values()].map(t => t.category || 'Fun'))]; return [...CATS.filter(c => seen.includes(c)), ...seen.filter(c => !CATS.includes(c)).sort()]; };

      function gallery(el) {
        const E = api.ui.esc, c = api.storage.get('custom') || {}, level = api.storage.get('effects') || 'full';
        const cats = catsNow(), all = [...T.values()], cur = T.get(current) || T.get('cadence');
        const recent = (api.storage.get('recent') || []).filter(id => T.has(id) && id !== current && !(T.get(id).family && T.get(id).family === (T.get(current) || {}).family)).slice(0, 6).map(id => T.get(id));
        // a theme family (all 30 daisyUI palettes) is one card; its palettes are chosen inside it, under Current theme.
        // The card shows the palette you're on, or the last one you picked from it.
        const famPick = api.storage.get('famPick') || {};
        const membersOf = f => all.filter(x => x.family === f);
        const repOf = f => { const m = membersOf(f); return m.find(x => x.id === current) || m.find(x => x.id === famPick[f]) || m[0]; };
        const shown = list => { const out = [], seen = new Set(); for (const t of list) { if (!t.family) { out.push(t); continue; } if (seen.has(t.family)) continue; seen.add(t.family); out.push(repOf(t.family)); } return out; };
        const inCat = k => shown(all.filter(t => (t.category || 'Fun') === k));
        const card = t => { const f = t.family, m = f ? membersOf(f) : null;
          const q = (f ? f + ' ' + m.map(x => x.name).join(' ') + ' palettes' : t.name + ' ' + (t.tagline || '')) + ' ' + (t.category || '');
          return `<button class="th-card ${t.id === current ? 'on' : ''}" data-th="${E(t.id)}" ${f ? `data-fam="${E(f)}"` : ''} data-tone="${f ? 'both' : toneOf(t)}" data-q="${E(q.toLowerCase())}">${preview(t)}<div class="th-meta"><b>${E(f || t.name)}</b><span>${E(f ? `${m.length} palettes · now ${t.name}` : t.tagline || '')}</span></div></button>`; };
        el.innerHTML = `<div class="thg">
          <aside class="thg-nav">
            <input class="inp thg-q" id="thg-q" type="search" placeholder="Search ${shown(all).length} themes" value="${E(G.q)}" aria-label="Search themes" data-no-grammar>
            <div class="seg thg-tone">${[['all', 'Any'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button class="${G.tone === k ? 'on' : ''}" data-tht="${k}">${l}</button>`).join('')}</div>
            <nav class="thg-idx" aria-label="Theme categories">
              <button data-go="thg-now">Current</button>${recent.length ? '<button data-go="thg-recent">Recently used</button>' : ''}
              ${cats.map(k => `<button data-go="${slug(k)}">${E(k)}<span>${inCat(k).length}</span></button>`).join('')}
            </nav>
            <button class="btn thg-rand" id="thg-rand">${api.ui.icon('shuffle')}Surprise me</button>
          </aside>
          <div class="thg-main">
            <section class="thg-now" id="thg-now"></section>
            ${recent.length ? `<h3 class="th-cat" id="thg-recent">Recently used</h3><div class="th-grid">${recent.map(card).join('')}</div>` : ''}
            ${cats.map(k => `<section class="thg-sec" data-cat="${E(k)}"><h3 class="th-cat" id="${slug(k)}">${E(k)} <span>${inCat(k).length}</span></h3><div class="th-grid">${inCat(k).map(card).join('')}</div></section>`).join('')}
            <div class="thg-none" hidden>No theme matches. Try another word, or set Light / Dark back to Any.</div>
            <div class="th-dev">Make your own: call <code>CadenceThemes.register({ id, name, vars, css, effects })</code> from any plugin (Settings → Developer), see docs/PLUGINS.md. Credits for the open-source projects behind these themes are in <code>vendor/themes/CREDITS.md</code>.</div>
          </div></div>`;

        // ---- the current theme, with its tweaks, at the top ----
        function now() {
          const t = T.get(current) || cur, box = el.querySelector('#thg-now'), cc = api.storage.get('custom') || {};
          box.innerHTML = `<div class="thg-big">${preview(t)}</div>
            <div class="thg-info"><div class="thg-k">Current theme · ${E(t.family || t.category || 'Fun')}</div><h2>${E(t.name)}</h2><p>${E(t.tagline || '')}</p>
              ${t.family ? `<div class="thg-fam" role="listbox" aria-label="${E(t.family)} palettes">${membersOf(t.family).map(m => { const v = m.vars || {}; return `<button role="option" aria-selected="${m.id === current}" class="${m.id === current ? 'on' : ''}" data-fpick="${E(m.id)}" title="${E(m.name)}"><i style="background:${E(v['--bg'] || '#fff')}"><b style="background:${E(v['--accent'] || '#888')}"></b><s style="background:${E(v['--panel'] || v['--bg'] || '#fff')}"></s></i><span>${E(m.name)}</span></button>`; }).join('')}</div>` : ''}
              <div class="thg-row"><div class="seg">${[['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button class="${(api.ui.colorMode() === k) ? 'on' : ''}" data-mode="${k}">${l}</button>`).join('')}</div>
                <button class="btn" id="thg-tw" aria-expanded="${G.open}">${api.ui.icon('sliders-horizontal')}Adjust</button></div></div>
            <div class="th-cust" ${G.open ? '' : 'hidden'}>
              <div><label>Accent colour</label><input type="color" id="th-accent" value="${E(cc.accent || (token('--accent').match(/^#[0-9a-f]{6}$/i) ? token('--accent') : '#5b5bd6'))}"></div>
              <div><label>Font</label><select class="inp" id="th-font"><option value="">Theme's own</option>${[['sans', 'Inter'], ['system', 'System'], ['serif', 'Serif'], ['rounded', 'Rounded'], ['mono', 'Mono']].map(([k, n]) => `<option value="${k}" ${cc.font === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
              <div><label>Corners: <span id="th-rv">${cc.radius != null ? cc.radius + 'px' : "theme's own"}</span></label><input type="range" id="th-radius" min="0" max="22" value="${cc.radius != null ? cc.radius : 10}"></div>
              <div><label>Effects</label><select class="inp" id="th-fx">${[['full', 'Full'], ['low', 'Gentle'], ['off', 'Off']].map(([k, n]) => `<option value="${k}" ${level === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
              <div style="display:flex;align-items:flex-end"><button class="btn" id="th-reset">Reset tweaks</button></div>
            </div>`;
          const save = patch => { api.storage.set('custom', Object.assign({}, api.storage.get('custom') || {}, patch)); custom(); };
          box.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { keepPlace(b, () => api.ui.setColorMode(b.dataset.mode)); });
          box.querySelector('#thg-tw').onclick = () => { G.open = !G.open; now(); };
          box.querySelectorAll('[data-fpick]').forEach(b => b.onclick = () => pick(b.dataset.fpick, b));
          box.querySelector('#th-accent').oninput = e => save({ accent: e.target.value });
          box.querySelector('#th-font').onchange = e => save({ font: e.target.value || null });
          box.querySelector('#th-radius').oninput = e => { save({ radius: +e.target.value }); box.querySelector('#th-rv').textContent = e.target.value + 'px'; };
          box.querySelector('#th-fx').onchange = e => { api.storage.set('effects', e.target.value); apply(current); };
          box.querySelector('#th-reset').onclick = () => { api.storage.set('custom', {}); custom(); now(); };
        }
        now();

        // ---- keep what you clicked where it was on screen, whatever the new theme does to the layout ----
        function keepPlace(anchor, fn) {
          const key = anchor.dataset.th, y = anchor.getBoundingClientRect().top;
          fn();
          // walk up every scrolling box (themes can nest them, e.g. Pocket Casts) until the card is back where it was
          const fix = () => { const a = key ? el.querySelector(`.thg-sec .th-card[data-th="${CSS.escape(key)}"]`) || el.querySelector(`.th-card[data-th="${CSS.escape(key)}"]`) : anchor; if (!a || !a.isConnected) return;
            for (let e = a.parentElement; e; e = e.parentElement) { const d = a.getBoundingClientRect().top - y; if (Math.abs(d) <= 1) return; const o = getComputedStyle(e).overflowY; if ((o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight) e.scrollTop += d; }
            const d = a.getBoundingClientRect().top - y; if (Math.abs(d) > 1) document.scrollingElement.scrollTop += d; };
          fix(); requestAnimationFrame(() => { fix(); requestAnimationFrame(fix); }); setTimeout(fix, 120);
        }
        const pick = (id, anchor) => {
          const prev = current;
          keepPlace(anchor, () => {
            window.CadenceThemes.apply(id);
            el.querySelectorAll('.th-card.on').forEach(x => x.classList.remove('on'));
            const ct = T.get(current);
            if (ct && ct.family) {   // a palette from a family: remember it, and redraw that family's card to show it
              famPick[ct.family] = ct.id; api.storage.set('famPick', famPick);
              el.querySelectorAll(`.th-card[data-fam="${CSS.escape(ct.family)}"]`).forEach(x => { const n = document.createElement('div'); n.innerHTML = card(ct); const nb = n.firstElementChild; nb.hidden = x.hidden; nb.onclick = () => pick(nb.dataset.th, nb); x.replaceWith(nb); });
            }
            el.querySelectorAll(`.th-card[data-th="${CSS.escape(current)}"]`).forEach(x => x.classList.add('on'));
            now();
          });
          if (prev !== current) api.ui.toast(`Theme: ${T.get(current).name}`, [{ label: 'Undo', run: () => pick(prev, anchor) }]);
        };
        el.querySelectorAll('[data-th]').forEach(b => b.onclick = () => pick(b.dataset.th, b));
        el.querySelector('#thg-rand').onclick = () => { const vis = [...el.querySelectorAll('.thg-sec .th-card')].filter(x => !x.hidden && x.dataset.th !== current); const b = vis[Math.floor(Math.random() * vis.length)]; if (b) { b.scrollIntoView({ block: 'center', behavior: 'smooth' }); pick(b.dataset.th, b); } };

        // ---- search and light/dark filter: hide, don't rebuild ----
        function filter() {
          const q = G.q.trim().toLowerCase();
          el.querySelectorAll('.th-card').forEach(b => { b.hidden = !((!q || b.dataset.q.includes(q)) && (G.tone === 'all' || b.dataset.tone === G.tone || b.dataset.tone === 'both')); });
          let any = false;
          el.querySelectorAll('.thg-sec').forEach(sec => { const n = sec.querySelectorAll('.th-card:not([hidden])').length; sec.hidden = !n; any = any || !!n; const sp = sec.querySelector('.th-cat span'); if (sp) sp.textContent = n; const nb = el.querySelector(`[data-go="${sec.querySelector('.th-cat').id}"]`); if (nb) { nb.hidden = !n; nb.querySelector('span').textContent = n; } });
          el.querySelector('.thg-none').hidden = any;
        }
        const qi = el.querySelector('#thg-q'); qi.oninput = () => { G.q = qi.value; filter(); };
        el.querySelectorAll('[data-tht]').forEach(b => b.onclick = () => { G.tone = b.dataset.tht; el.querySelectorAll('[data-tht]').forEach(x => x.classList.toggle('on', x === b)); filter(); });
        filter();

        // ---- the index: jump to a section, and show which one you're in ----
        el.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { const h = el.querySelector('#' + b.dataset.go); if (h) h.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); });
        G.io && G.io.disconnect();
        if (window.IntersectionObserver) {
          const heads = [el.querySelector('#thg-now'), ...el.querySelectorAll('.thg-main .th-cat')].filter(Boolean), vis = new Map();
          G.io = new IntersectionObserver(es => {
            for (const e of es) vis.set(e.target.id, e.isIntersecting ? e.boundingClientRect.top : null);
            const top = heads.find(h => vis.get(h.id) != null) || null;
            el.querySelectorAll('[data-go]').forEach(b => b.classList.toggle('on', !!top && b.dataset.go === top.id));
          }, { rootMargin: '0px 0px -70% 0px' });
          heads.forEach(h => G.io.observe(h));
        }
      }
    }
  });
})();
