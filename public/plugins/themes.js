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
  let applySeq = 0;
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

  // ---- making a theme yours (2026-11-18): your own background picture, a picture in the corner and a sound when you
  // finish something, kept per theme (pictures and sounds live on the NAS: api/theme-media). Themes may also name their
  // brand's site (the sidebar shows that site's own logo) and a credited free-licence photo as their own background.
  let mine = null;
  // film and TV themes: their title on TMDB (pictures come through the NAS when TMDB_API_KEY is set)
  const TMDB = { jurassic: ['movie', 'Jurassic Park', 1993], 'star-wars': ['movie', 'Star Wars', 1977], shining: ['movie', 'The Shining', 1980], 'kill-bill': ['movie', 'Kill Bill: Vol. 1', 2003],
    'titan-ae': ['movie', 'Titan A.E.', 2000], matrix: ['movie', 'The Matrix', 1999], 'spirited-away': ['movie', 'Spirited Away', 2001], totoro: ['movie', 'My Neighbor Totoro', 1988],
    simpsons: ['tv', 'The Simpsons', 1989], 'family-guy': ['tv', 'Family Guy', 1999], 'south-park': ['tv', 'South Park', 1997], 'garden-wall': ['tv', 'Over the Garden Wall', 2014] };
  // brand themes: the site whose own logo shows in the sidebar while the theme is on
  const SITES = { claude: 'claude.ai', 'pocket-casts': 'pocketcasts.com', discord: 'discord.com', msn: 'msn.com', limewire: 'limewire.com', github: 'github.com', ipod: 'apple.com',
    xp: 'microsoft.com', seven: 'microsoft.com', geocities: 'geocities.ws', jurassic: 'jurassicworld.com', 'star-wars': 'starwars.com', 'spirited-away': 'ghibli.jp', totoro: 'ghibli.jp',
    'south-park': 'southparkstudios.com', 'garden-wall': 'cartoonnetwork.com', botw: 'zelda.com' };
  // game themes: their game (or console) on TheGamesDB (needs THEGAMESDB_API_KEY); NES is TheGamesDB platform 7
  const GAMES = { botw: ['game', 'The Legend of Zelda: Breath of the Wild'], cyberpunk: ['game', 'Cyberpunk 2077'], nes: ['platform', '7'] };
  // where a theme's pictures come from: [source, kind, title, year]; a theme can name its own (t.tmdb, t.game)
  // t.commons: a subject for a credited free-licence photo from Wikimedia Commons (a function may pick it each time)
  const tmdbOf = t => t.commons && !t.tmdb && !t.game ? ['commons', 'photo', typeof t.commons === 'function' ? t.commons() : t.commons, ''] : t.tmdb ? ['tmdb', t.tmdb.type || 'movie', t.tmdb.title, t.tmdb.year || ''] : t.game ? ['gdb', t.game.kind || 'game', t.game.title, ''] : TMDB[t.id] ? ['tmdb', ...TMDB[t.id]] : GAMES[t.id] ? ['gdb', ...GAMES[t.id], ''] : null;
  const kindWord = m => m[0] === 'commons' ? 'photo search' : m[0] === 'gdb' ? (m[1] === 'platform' ? 'console' : 'game') : m[1] === 'tv' ? 'show' : 'film';
  const tmdbArt = new Map();   // theme id → promise of the answer, once a visit
  const filmArt = t => { const m = tmdbOf(t); if (!m) return Promise.resolve(null);
    const ck = t.id + '|' + m[2];
    if (m[0] === 'commons') { if (!tmdbArt.has(ck)) tmdbArt.set(ck, fetch('api/commons?q=' + encodeURIComponent(m[2])).then(r => r.ok ? r.json() : null).then(j => j && j.photos && j.photos.length
      ? { title: m[2], source: 'Wikimedia Commons', link: j.photos[0].link, backdrops: j.photos.map(p => p.url), credits: j.photos.map(p => p.credit), links: j.photos.map(p => p.link) } : j && { none: true }).catch(() => null)); return tmdbArt.get(ck); }
    const u = m[0] === 'gdb' ? `api/gdb/art?kind=${m[1]}&q=${encodeURIComponent(m[2])}${m[1] === 'platform' ? '&platform=' + m[2] : ''}` : `api/tmdb/art?type=${m[1]}&q=${encodeURIComponent(m[2])}&year=${m[3]}`;
    if (!tmdbArt.has(ck)) tmdbArt.set(ck, fetch(u).then(r => r.ok ? r.json() : null).catch(() => null)); return tmdbArt.get(ck); };
  // colours from a picture: the most common colour (darkened) for the background, the most colourful readable one for the accent
  function paletteOf(img) {
    const c = document.createElement('canvas'); c.width = c.height = 24; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 24, 24);
    const d = g.getImageData(0, 0, 24, 24).data, bins = new Map();
    const hslOf = (r, gg, b) => { r /= 255; gg /= 255; b /= 255; const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2; let h = 0, sat = 0; if (mx !== mn) { const dd = mx - mn; sat = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn); h = (mx === r ? (gg - b) / dd + (gg < b ? 6 : 0) : mx === gg ? (b - r) / dd + 2 : (r - gg) / dd + 4) * 60; } return [h, sat, l]; };
    for (let i = 0; i < d.length; i += 4) { const [h, sat, l] = hslOf(d[i], d[i + 1], d[i + 2]); const k = `${Math.round(h / 24)}|${Math.round(sat * 4)}|${Math.round(l * 4)}`, b = bins.get(k) || { n: 0, h: 0, s: 0, l: 0 }; b.n++; b.h += h; b.s += sat; b.l += l; bins.set(k, b); }
    const cols = [...bins.values()].map(b => ({ n: b.n, h: b.h / b.n, s: b.s / b.n, l: b.l / b.n })).sort((a, b) => b.n - a.n), base = cols[0], f = (h, sat, l) => `hsl(${Math.round(h)} ${Math.round(sat * 100)}% ${Math.round(l * 100)}%)`;
    const acc = cols.filter(x => x.l > 0.25 && x.l < 0.85).sort((a, b) => b.s * Math.sqrt(b.n) - a.s * Math.sqrt(a.n))[0] || base, bs = Math.min(0.45, base.s);
    return { '--bg': f(base.h, bs, 0.09), '--panel': f(base.h, bs, 0.13), '--side': f(base.h, bs, 0.075), '--line': f(base.h, bs * 0.8, 0.21), '--hover': f(base.h, bs, 0.17), '--text': f(base.h, Math.min(0.25, bs), 0.93),
      '--muted': f(base.h, Math.min(0.2, bs), 0.68), '--faint': f(base.h, Math.min(0.15, bs), 0.45), '--accent': f(acc.h, Math.max(0.45, Math.min(0.8, acc.s)), Math.max(0.55, Math.min(0.7, acc.l))), '--accent-soft': f(acc.h, 0.35, 0.2), '--on-accent': '#111' };
  }
  function makeMine(t) {
    if (mine) { try { mine(); } catch (e) {} mine = null; }
    const x = (stored('extras') || {})[t.id] || {}, bits = [];
    const css = document.getElementById('cadence-skin-mine') || Object.assign(document.createElement('style'), { id: 'cadence-skin-mine' });
    if (!css.parentNode) document.head.appendChild(css);
    const bg = x.bg || (t.photo && t.photo.url), dim = x.bg ? (x.dim != null ? x.dim : 0.55) : (t.photo && t.photo.dim != null ? t.photo.dim : 0.6);
    css.textContent = bg ? `html body{background-image:linear-gradient(color-mix(in srgb,var(--bg) ${Math.round(dim * 100)}%,transparent),color-mix(in srgb,var(--bg) ${Math.round(dim * 100)}%,transparent)),url("${String(bg).replace(/["\\]/g, '')}")!important;background-size:cover!important;background-position:center!important;background-attachment:fixed!important}
      html body .main{background:transparent!important}` : '';
    if (bg && !x.bg && t.photo && t.photo.credit) {
      const c = document.createElement('a'); c.className = 'th-credit'; c.href = t.photo.link || '#'; c.target = '_blank'; c.rel = 'noopener'; c.textContent = 'Photo: ' + t.photo.credit;
      c.style.cssText = 'position:fixed;right:10px;bottom:6px;z-index:2;font-size:11px;color:var(--muted);opacity:.75;text-decoration:none;background:color-mix(in srgb,var(--bg) 70%,transparent);padding:1px 6px;border-radius:6px';
      document.body.appendChild(c); bits.push(() => c.remove());
    }
    if (x.corner) {
      const im = document.createElement('img'); im.className = 'th-corner'; im.src = x.corner; im.alt = '';
      im.style.cssText = `position:fixed;${x.cornerSide === 'left' ? 'left:290px' : 'right:16px'};bottom:16px;max-width:${x.cornerSize || 180}px;max-height:${x.cornerSize || 180}px;z-index:20;pointer-events:none;filter:drop-shadow(0 6px 14px rgba(0,0,0,.25))`;
      document.body.appendChild(im); bits.push(() => im.remove());
    }
    if (x.sound) {
      const play = () => { try { const a = new Audio(x.sound); a.volume = x.volume != null ? x.volume : 0.6; a.play().catch(() => {}); } catch (e) {} };
      document.addEventListener('cadence:task-complete', play); bits.push(() => document.removeEventListener('cadence:task-complete', play));
    }
    // the brand's own logo from its site, in place of Cadence's, while the theme is on
    // (the sidebar can be redrawn after the theme applies, or before the plugin API is ready: it puts itself back)
    const site = t.site || SITES[t.id];
    if (site) {
      let had = null;
      const put = () => {
        const logo = document.querySelector('#side-head .brand .logo'); if (!logo || logo.classList.contains('th-brand') || !apiRef || !apiRef.ui.logo) return;
        const img = apiRef.ui.logo(site, { size: 20 }); if (!img) return;
        had = logo.innerHTML; logo.innerHTML = img; logo.classList.add('th-brand'); logo.dataset.site = site;
      };
      put();
      const head = document.getElementById('side-head'), mo = head ? new MutationObserver(put) : null; if (mo) mo.observe(head, { childList: true, subtree: true });
      const iv = setInterval(put, 1000);
      bits.push(() => { if (mo) mo.disconnect(); clearInterval(iv); const logo = document.querySelector('#side-head .brand .logo.th-brand'); if (logo) { logo.innerHTML = had || ''; logo.classList.remove('th-brand'); delete logo.dataset.site; } });
    }
    // the film's own picture (TMDB), unless you've set your own; and its colours when you ask for them
    const film = tmdbOf(t);
    if (film && !x.bg && x.tmdb !== false) {
      let live = true; bits.push(() => { live = false; });
      filmArt(t).then(a => {
        if (!live || !a || !a.backdrops || !a.backdrops.length) return;
        const pi = (x.tmdbPick || 0) % a.backdrops.length, pic = a.backdrops[pi], d2 = x.dim != null ? x.dim : 0.62;
        css.textContent = `html body{background-image:linear-gradient(color-mix(in srgb,var(--bg) ${Math.round(d2 * 100)}%,transparent),color-mix(in srgb,var(--bg) ${Math.round(d2 * 100)}%,transparent)),url("${pic}")!important;background-size:cover!important;background-position:center!important;background-attachment:fixed!important}
          html body .main{background:transparent!important}`;
        const c = document.createElement('a'); c.className = 'th-credit'; c.href = (a.links && a.links[pi]) || a.link; c.target = '_blank'; c.rel = 'noopener'; c.textContent = a.credits ? 'Photo: ' + a.credits[pi] : 'Picture: ' + a.title + ' on ' + (a.source || 'TMDB');
        c.style.cssText = 'position:fixed;right:10px;bottom:6px;z-index:2;font-size:11px;color:var(--muted);opacity:.75;text-decoration:none;background:color-mix(in srgb,var(--bg) 70%,transparent);padding:1px 6px;border-radius:6px';
        document.body.appendChild(c); bits.push(() => c.remove());
        // a game's title logo, small in the corner (unless you've put your own picture there)
        if (a.logo && !x.corner) { const lg = document.createElement('img'); lg.className = 'th-gamelogo'; lg.src = a.logo; lg.alt = '';
          lg.style.cssText = 'position:fixed;right:18px;top:14px;max-width:170px;max-height:70px;z-index:3;pointer-events:none;opacity:.9;filter:drop-shadow(0 2px 6px rgba(0,0,0,.35))';
          lg.onerror = () => lg.remove(); document.body.appendChild(lg); bits.push(() => lg.remove()); }
        if (x.tmdbColors) {
          const im = new Image(); im.onload = () => { if (!live) return; try { const v = paletteOf(im); for (const [k, val] of Object.entries(v)) html.style.setProperty(k, val); bits.push(() => { for (const k of Object.keys(v)) html.style.removeProperty(k); custom(); }); } catch (e) {} }; im.src = pic;
        }
      });
    }
    mine = () => bits.forEach(f => { try { f(); } catch (e) {} });
  }
  function apply(id, opts = {}) {
    // a theme whose pack is still on the server: fetch it, then apply (the pack's register() replaces the placeholder)
    const t0 = T.get(id), my = ++applySeq;
    if (t0 && t0.stub) { loadPack(t0.stub).then(() => { const t1 = T.get(id); if (t1 && !t1.stub && my === applySeq) apply(id, opts); }); return; }   // unless another theme was picked meanwhile
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
    makeMine(t);
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
    // the next page load only fetches the theme pack this space uses (server/lib/bundle.js); trying one on doesn't count
    if (opts.save || (stored('theme') || 'cadence') === t.id) { try { localStorage.setItem('cadence.theme.' + (localStorage.getItem('cadence.space') === 'life' ? 'life' : 'work'), t.id); } catch (e) {} }
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
    token, isDark, paletteOf,
    quick: el => quick(el),
    on(fn) { subs.add(fn); return () => subs.delete(fn); },
  };

  // the built-in default: Cadence as it was designed (light/dark follow the moon toggle)
  window.CadenceThemes.register({ id: 'cadence', name: 'THING', category: 'Useful', tagline: 'The original. Follows light and dark.',
    preview: { bg: '#f7f6f3', panel: '#fff', side: '#f0eee9', text: '#1d1c1a', accent: '#5b5bd6', line: '#e7e4dd' } });
  /* Theme packs left on the server (2026-11-18, lighter app download): only the pack with each space's current theme
     loads with the app. The rest show in the gallery from a small list the server sends (name, category, colours), and
     their pack is fetched when one is applied, or all at once when the Themes page opens. */
  const BUN = window.__cadenceBundle, packs = new Map();
  function loadPack(f) {
    if (!BUN) return Promise.resolve();
    if (!packs.has(f)) packs.set(f, new Promise(res => { const s = document.createElement('script'); s.src = `bundle.js?v=${BUN.v}&only=${encodeURIComponent(f)}`; s.onload = res; s.onerror = () => { packs.delete(f); res(); }; document.body.appendChild(s); }));
    return packs.get(f);
  }
  const waiting = () => (BUN && BUN.skipped || []).filter(f => BUN.themes && BUN.themes[f] && !packs.has(f));
  function loadAllPacks() {
    const fs = waiting(); if (!fs.length) return Promise.resolve();
    const p = new Promise(res => { const s = document.createElement('script'); s.src = `bundle.js?v=${BUN.v}&only=${encodeURIComponent(fs.join(','))}`; s.onload = res; s.onerror = () => { for (const f of fs) packs.delete(f); res(); }; document.body.appendChild(s); });
    for (const f of fs) packs.set(f, p);
    return p;
  }
  if (BUN && BUN.themes) for (const f of BUN.skipped || []) for (const m of BUN.themes[f] || []) if (!T.has(m.id)) T.set(m.id, Object.freeze({ id: m.id, name: m.name, category: m.category, tagline: m.tagline, family: m.family,
    preview: m.p, effects: m.fx ? true : undefined, light: m.both ? {} : undefined, dark: m.both ? {} : undefined, stub: f }));
  window.CadenceThemes.loadAll = loadAllPacks;
  apply(stored('theme') || 'cadence');     // as early as possible: no flash of the wrong theme

  const CATS = ['Useful', 'Live', 'Editor', 'daisyUI', 'Fun', 'Movie & TV', 'Studio Ghibli', 'Games', 'Brands', 'Seasonal', 'Crazy'];
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
          .thg-dense .th-grid{grid-template-columns:repeat(auto-fill,minmax(124px,1fr));gap:8px}.thg-dense .th-meta span{display:none}.thg-dense .th-meta{padding:6px 8px}.thg-dense .th-meta b{font-size:12px}
          .thg-opt{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--muted);margin:6px 0;cursor:pointer}
          .th-card{border:1px solid var(--line);border-radius:14px;overflow:hidden;cursor:pointer;background:var(--panel);transition:transform .15s,box-shadow .2s,border-color .2s;text-align:left;padding:0;display:block;width:100%}
          .th-card:hover{transform:translateY(-2px);box-shadow:var(--shadow)}
          .th-mine{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding-top:8px;border-top:1px solid var(--line)}.th-mine>label{width:100%}
          .th-slot{display:inline-flex;align-items:center;gap:6px}.th-slot img{width:40px;height:40px;object-fit:cover;border-radius:8px;border:1px solid var(--line)}.th-pc{width:100%;font-size:12px}
          .th-brand img,.th-brand svg{width:20px;height:20px;border-radius:5px}
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
        if (waiting().length) loadAllPacks().then(() => { if (api.ui.currentRoute() === 'view-themes') api.ui.refresh(); });
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
        if (G.dense == null) { const sv = api.storage.get('gallery') || {}; G.dense = !!sv.dense; G.hover = sv.hover !== false; }
        el.innerHTML = `<div class="thg${G.dense ? ' thg-dense' : ''}">
          <aside class="thg-nav">
            <input class="inp thg-q" id="thg-q" type="search" placeholder="Search ${shown(all).length} themes" value="${E(G.q)}" aria-label="Search themes" data-no-grammar>
            <div class="seg thg-tone">${[['all', 'Any'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button class="${G.tone === k ? 'on' : ''}" data-tht="${k}">${l}</button>`).join('')}</div>
            <nav class="thg-idx" aria-label="Theme categories">
              <button data-go="thg-now">Current</button>${recent.length ? '<button data-go="thg-recent">Recently used</button>' : ''}
              ${cats.map(k => `<button data-go="${slug(k)}">${E(k)}<span>${inCat(k).length}</span></button>`).join('')}
            </nav>
            <label class="thg-opt"><input type="checkbox" id="thg-dense" ${G.dense ? 'checked' : ''}> Compact grid</label>
            <label class="thg-opt"><input type="checkbox" id="thg-hover" ${G.hover !== false ? 'checked' : ''}> Try a theme by resting on it</label>
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
              <div class="th-mine"><label>Make ${E(t.name)} yours: your own pictures and sound, kept on your NAS</label>
                ${(() => { const x = (api.storage.get('extras') || {})[t.id] || {};
                  const slot = (k, label, acc, ic) => `<span class="th-slot">${x[k] ? (k === 'sound' ? `<button class="btn" data-mine-play>${api.ui.icon('play')}${label}</button>` : `<img src="${E(x[k])}" alt="">`) : ''}
                    <label class="btn">${api.ui.icon(ic)}${x[k] ? 'Change' : label}<input type="file" accept="${acc}" data-mine="${k}" hidden></label>${x[k] ? `<button class="btn ghost" data-mine-rm="${k}" aria-label="Remove ${label.toLowerCase()}">${api.ui.icon('x')}</button>` : ''}</span>`;
                  return slot('bg', 'Background picture', 'image/*', 'image') + slot('corner', 'Corner picture', 'image/*', 'image') + slot('sound', 'Sound when you finish', 'audio/*', 'music')
                    + (x.bg ? `<span class="th-slot"><label>Dim <input type="range" min="0" max="90" value="${Math.round((x.dim != null ? x.dim : 0.55) * 100)}" data-mine-dim></label></span>` : ''); })()}
                ${t.photo && t.photo.credit ? `<span class="muted th-pc">Background photo: ${E(t.photo.credit)}</span>` : ''}
                ${tmdbOf(t) ? `<span class="th-slot th-tmdb" data-tmdb-row><span class="muted">Pictures from the ${kindWord(tmdbOf(t))}…</span></span>` : ''}</div>
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
          const setMine = patch => { const all = api.storage.get('extras') || {}; const x = Object.assign({}, all[t.id] || {}, patch); for (const k of Object.keys(x)) if (x[k] == null) delete x[k]; all[t.id] = x; api.storage.set('extras', all); makeMine(t); now(); };
          box.querySelectorAll('[data-mine]').forEach(inp => inp.onchange = async () => {
            const f = inp.files && inp.files[0]; if (!f) return;
            try { const r = await fetch('api/theme-media', { method: 'POST', headers: { 'Content-Type': f.type || 'application/octet-stream' }, body: f }); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); setMine({ [inp.dataset.mine]: j.url }); api.ui.toast('Added to ' + t.name); }
            catch (e) { api.ui.toast("Couldn't add that: " + e.message); }
          });
          box.querySelectorAll('[data-mine-rm]').forEach(b => b.onclick = () => setMine({ [b.dataset.mineRm]: null }));
          const dm = box.querySelector('[data-mine-dim]'); if (dm) dm.onchange = () => setMine({ dim: +dm.value / 100 });
          // TMDB: next picture, colours from the picture, or none
          const tr = box.querySelector('[data-tmdb-row]');
          if (tr) filmArt(t).then(a => {
            const x = (api.storage.get('extras') || {})[t.id] || {};
            const m = tmdbOf(t), gdb = m[0] === 'gdb', cm = m[0] === 'commons', src = cm ? 'Wikimedia Commons' : gdb ? 'TheGamesDB' : 'TMDB';
            if (!a && cm) { tr.innerHTML = `<span class="muted">Couldn't reach Wikimedia Commons just now.</span>`; return; }
            if (!a || a.off) { tr.innerHTML = `<span class="muted">Connect ${gdb ? 'TheGamesDB' : 'TMDB'} in Settings → Connections for pictures from the ${kindWord(m)}.</span> <button class="btn sm" data-tm="keys">Open Connections</button>`;
              tr.querySelector('[data-tm=keys]').onclick = () => api.ui.openSettings('connections'); return; }
            if (a.none || !a.backdrops || !a.backdrops.length) { tr.innerHTML = `<span class="muted">${src} has no pictures for this one.</span>`; return; }
            tr.innerHTML = x.bg ? `<span class="muted">Your own background is on; remove it to see the ${kindWord(m)}'s pictures.</span>`
              : `<button class="btn" data-tm="next">${api.ui.icon('shuffle')}Another picture</button>
                 <label class="th-slot"><input type="checkbox" data-tm="colors" ${x.tmdbColors ? 'checked' : ''}> Colours from the picture</label>
                 <label class="th-slot"><input type="checkbox" data-tm="off" ${x.tmdb === false ? 'checked' : ''}> No pictures</label>
                 <span class="muted th-pc">${cm ? `Free-licence photos of ${E(a.title)} from Wikimedia Commons, credited on screen.` : `${E(a.title)} pictures from ${src}.${gdb ? '' : ' This product uses the TMDB API but is not endorsed or certified by TMDB.'}`}</span>`;
            const nb = tr.querySelector('[data-tm=next]'); if (nb) nb.onclick = () => setMine({ tmdbPick: ((x.tmdbPick || 0) + 1) % a.backdrops.length });
            const cb = tr.querySelector('[data-tm=colors]'); if (cb) cb.onchange = () => setMine({ tmdbColors: cb.checked || null });
            const ob = tr.querySelector('[data-tm=off]'); if (ob) ob.onchange = () => setMine({ tmdb: ob.checked ? false : null });
          });
          const pl = box.querySelector('[data-mine-play]'); if (pl) pl.onclick = () => { const x = (api.storage.get('extras') || {})[t.id] || {}; if (x.sound) new Audio(x.sound).play().catch(() => {}); };
        }
        now();

        // ---- keep what you clicked where it was on screen, whatever the new theme does to the layout ----
        function keepPlace(anchor, fn) {
          const key = anchor.dataset.th, y = anchor.getBoundingClientRect().top;
          fn();
          // walk up every scrolling box (themes can nest them, e.g. Pocket Casts) until the card is back where it was
          const fix = () => { const a = key ? el.querySelector(`.thg-sec .th-card[data-th="${CSS.escape(key)}"]`) || el.querySelector(`.th-card[data-th="${CSS.escape(key)}"]`) : anchor; if (!a || !a.isConnected) return;
            for (let e = a.parentElement; e; e = e.parentElement) { const d = a.getBoundingClientRect().top - y; if (Math.abs(d) <= 1) return; const o = getComputedStyle(e).overflowY; if ((o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight) e.scrollTop += d; }
            const d = a.getBoundingClientRect().top - y; if (Math.abs(d) > 1) document.scrollingElement.scrollTop += d; };   // instant: smooth scrolling would overshoot as it's corrected each frame
          // a new theme can keep changing the layout for a while (its fonts arrive, effects start): for 1.5 s, put the card
          // back whenever sizes change. Scrolling changes no sizes, so this never fights you (and stops if you scroll).
          fix(); requestAnimationFrame(() => { fix(); requestAnimationFrame(fix); }); setTimeout(fix, 120);
          let stop = false; const quit = () => { stop = true; try { ro.disconnect(); } catch (e) {} ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(t => removeEventListener(t, quit, true)); };
          ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(t => addEventListener(t, quit, { capture: true, passive: true }));
          const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (!stop) requestAnimationFrame(() => !stop && fix()); }) : null;
          if (ro) { ro.observe(el); ro.observe(document.body); }
          setTimeout(quit, 1500);
          if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!stop) fix(); });
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
        el.querySelectorAll('[data-th]').forEach(b => b.onclick = () => { tryOn.stop(); pick(b.dataset.th, b); });
        // ---- try one on: rest the pointer on a card and the whole app wears it; move off and it goes back; click keeps it ----
        const tryOn = (() => {
          // the theme you had stays in G (not here), so a redraw or leaving the page mid-try still puts it back
          let t = 0, out = 0;
          const stop = () => { clearTimeout(t); clearTimeout(out); G.tryOn = null; if (G.tryBase != null && current !== G.tryBase) apply(G.tryBase); G.tryBase = null; el.classList.remove('thg-trying'); };
          const fine = matchMedia('(hover: hover) and (pointer: fine)');
          el.querySelectorAll('.thg-main .th-card').forEach(b => {
            // pointermove, not mouseenter: a theme changes the layout, which slides another card under a still pointer
            b.addEventListener('pointermove', () => { if (!fine.matches || G.hover === false || G.tryOn === b.dataset.th) return; clearTimeout(out); clearTimeout(t); G.tryOn = b.dataset.th;
              if (b.dataset.th === (G.tryBase ?? current)) return;
              t = setTimeout(() => { if (G.tryBase == null) G.tryBase = current; if (current !== b.dataset.th) { apply(b.dataset.th); el.classList.add('thg-trying'); } }, 650); });
            b.addEventListener('mouseleave', () => { clearTimeout(t); G.tryOn = null; out = setTimeout(stop, 350); });
          });
          if (!G.tryHook) { G.tryHook = true; addEventListener('hashchange', () => { if (G.tryBase != null && location.hash !== '#view-themes') { apply(G.tryBase); G.tryBase = null; } }); }
          return { stop };
        })();
        const saveG = () => api.storage.set('gallery', { dense: !!G.dense, hover: G.hover !== false });
        el.querySelector('#thg-dense').onchange = e => { G.dense = e.target.checked; el.querySelector('.thg').classList.toggle('thg-dense', G.dense); saveG(); };
        el.querySelector('#thg-hover').onchange = e => { G.hover = e.target.checked; if (!G.hover) tryOn.stop(); saveG(); };
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
