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
    if (opts_fonts) { let o = ''; for (const f of t.fonts || []) o += `@font-face{font-family:"${f.family}";src:url("${f.src}") format("${/\.ttf$/.test(f.src) ? 'truetype' : /\.woff$/.test(f.src) ? 'woff' : 'woff2'}");font-weight:${f.weight || 400};font-style:${f.style || 'normal'};font-display:swap}`; return o; }
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
    if (c.radius != null) rules += `.btn,.inp,.qa,.gl,.stat,.task,.modal,.pl-card,.th-card,.pop,.toast,.nav a,.drawer,.c-hero,.isl-pill{border-radius:${c.radius}px!important}`;
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
    if (opts.save && apiRef) apiRef.storage.set('theme', t.id);
    const detail = { id: t.id, theme: t, dark: isDark() };
    subs.forEach(fn => { try { fn(detail); } catch (e) { console.error(e); } });
    document.dispatchEvent(new CustomEvent('cadence:theme', { detail }));
  }
  function token(name) { return getComputedStyle(html).getPropertyValue(name.startsWith('--') ? name : '--' + name).trim(); }
  function lum(c) { const m = /^#?([0-9a-f]{6})$/i.exec(c) || /^#?([0-9a-f]{3})$/i.exec(c); if (!m) { const r = /rgba?\((\d+)\D+(\d+)\D+(\d+)/.exec(c); return r ? (0.2126 * r[1] + 0.7152 * r[2] + 0.0722 * r[3]) / 255 : 1; } let h = m[1]; if (h.length === 3) h = [...h].map(x => x + x).join(''); const n = parseInt(h, 16); return (0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255; }
  function isDark() { return lum(token('--bg')) < 0.45; }

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
    on(fn) { subs.add(fn); return () => subs.delete(fn); },
  };

  // the built-in default: Cadence as it was designed (light/dark follow the moon toggle)
  window.CadenceThemes.register({ id: 'cadence', name: 'Cadence', category: 'Useful', tagline: 'The original. Follows light and dark.',
    preview: { bg: '#f7f6f3', panel: '#fff', side: '#f0eee9', text: '#1d1c1a', accent: '#5b5bd6', line: '#e7e4dd' } });
  apply(stored('theme') || 'cadence');     // as early as possible: no flash of the wrong theme

  const CATS = ['Useful', 'Editor', 'daisyUI', 'Fun', 'Crazy'];
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
          .th-cat{margin:26px 0 10px;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
          .th-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}
          .th-card{border:1px solid var(--line);border-radius:14px;overflow:hidden;cursor:pointer;background:var(--panel);transition:transform .15s,box-shadow .2s,border-color .2s;text-align:left;padding:0;display:block;width:100%}
          .th-card:hover{transform:translateY(-2px);box-shadow:var(--shadow)}
          .th-card.on{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent)}
          .th-mini{height:104px;display:grid;grid-template-columns:52px 1fr;background:var(--p-bg);font-family:var(--p-font,inherit);position:relative;overflow:hidden}
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
          .th-dev{margin-top:26px;font-size:13px;color:var(--muted)}
          .th-dev code{font-family:var(--mono);font-size:12px;background:var(--hover);padding:1px 5px;border-radius:5px}
        `;
        document.head.appendChild(s);
      }
      api.views.add({ id: 'themes', title: 'Themes', icon: '◐', subtitle: 'Pick a look. Everything, plugins included, follows it, and it syncs to all your devices.', render: el => gallery(el) });
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
      const G = window.__thUI = window.__thUI || { cat: 'All', tone: 'all' };
      const toneOf = t => { const v = t.vars || t.light || {}; const bg = (t.preview && t.preview.bg) || v['--bg'] || '#fff'; return t.light && t.dark ? 'both' : lum(bg) < 0.45 ? 'dark' : 'light'; };
      function gallery(el) {
        const E = api.ui.esc, c = api.storage.get('custom') || {}, level = api.storage.get('effects') || 'full';
        const keep = t => (G.cat === 'All' || (t.category || 'Fun') === G.cat) && (G.tone === 'all' || toneOf(t) === G.tone || toneOf(t) === 'both');
        const byCat = CATS.map(cat => [cat, [...T.values()].filter(t => (t.category || 'Fun') === cat && keep(t))]).concat([['Other', [...T.values()].filter(t => !CATS.includes(t.category || 'Fun') && keep(t))]]).filter(x => x[1].length);
        el.innerHTML = `<div class="th-cust">
            <div><label>Accent colour</label><input type="color" id="th-accent" value="${E(c.accent || (token('--accent').match(/^#[0-9a-f]{6}$/i) ? token('--accent') : '#5b5bd6'))}"></div>
            <div><label>Font</label><select class="inp" id="th-font"><option value="">Theme's own</option>${[['sans', 'Inter'], ['system', 'System'], ['serif', 'Serif'], ['rounded', 'Rounded'], ['mono', 'Mono']].map(([k, n]) => `<option value="${k}" ${c.font === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
            <div><label>Corners: <span id="th-rv">${c.radius != null ? c.radius + 'px' : "theme's own"}</span></label><input type="range" id="th-radius" min="0" max="22" value="${c.radius != null ? c.radius : 10}"></div>
            <div><label>Effects</label><select class="inp" id="th-fx">${[['full', 'Full chaos'], ['low', 'Gentle'], ['off', 'Off']].map(([k, n]) => `<option value="${k}" ${level === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
            <div style="display:flex;align-items:flex-end"><button class="btn" id="th-reset">Reset tweaks</button></div>
          </div>
          <div class="th-filter"><div class="pl-cats" style="margin:0">${['All', ...CATS].map(k => `<button class="${G.cat === k ? 'on' : ''}" data-thc="${k}">${k}${k === 'All' ? ` <span>${T.size}</span>` : ''}</button>`).join('')}</div>
            <div class="seg">${[['all', 'Any'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button class="${G.tone === k ? 'on' : ''}" data-tht="${k}">${l}</button>`).join('')}</div></div>
          ${byCat.map(([cat, list]) => `<div class="th-cat">${E(cat)}</div><div class="th-grid">${list.map(t => `<button class="th-card ${t.id === current ? 'on' : ''}" data-th="${E(t.id)}">${preview(t)}<div class="th-meta"><b>${E(t.name)}</b><span>${E(t.tagline || '')}</span></div></button>`).join('')}</div>`).join('')}
          <div class="th-dev">Make your own: call <code>CadenceThemes.register({ id, name, vars, css, effects })</code> from any plugin (Settings → Developer), see docs/PLUGINS.md. Credits for the open-source projects behind these themes are in <code>vendor/themes/CREDITS.md</code>.</div>`;
        el.querySelectorAll('[data-thc]').forEach(b => b.onclick = () => { G.cat = b.dataset.thc; gallery(el); });
        el.querySelectorAll('[data-tht]').forEach(b => b.onclick = () => { G.tone = b.dataset.tht; gallery(el); });
        el.querySelectorAll('[data-th]').forEach(b => b.onclick = () => {
          const prev = current; window.CadenceThemes.apply(b.dataset.th); gallery(el);
          if (prev !== current) api.ui.toast(`Theme: ${T.get(current).name}`, [{ label: 'Undo', run: () => { window.CadenceThemes.apply(prev); gallery(el); } }]);
        });
        const save = patch => { api.storage.set('custom', Object.assign({}, api.storage.get('custom') || {}, patch)); custom(); };
        el.querySelector('#th-accent').oninput = e => save({ accent: e.target.value });
        el.querySelector('#th-font').onchange = e => save({ font: e.target.value || null });
        el.querySelector('#th-radius').oninput = e => { save({ radius: +e.target.value }); el.querySelector('#th-rv').textContent = e.target.value + 'px'; };
        el.querySelector('#th-fx').onchange = e => { api.storage.set('effects', e.target.value); apply(current); };
        el.querySelector('#th-reset').onclick = () => { api.storage.set('custom', {}); custom(); gallery(el); };
      }
    }
  });
})();
