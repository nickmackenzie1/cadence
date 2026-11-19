/* Music and radio themes (user, 2026-11-18: "any more cool theme ideas now that you get the vibe … get those all in").
   Now Playing (colours from the cover of what's playing), Record store, Mixtape, On Air, iPod, Gig poster, Teletext,
   Card catalogue, Limestone City, Late fall. Fonts are the vendored open-licence ones (vendor/themes/fonts). */
(() => {
  const T = window.CadenceThemes; if (!T) return;
  const R = t => T.register(t);
  const V = 'vendor/themes/fonts/';
  const P = () => window.CadencePodcasts;
  const playing = () => { const p = P(); return !!(p && p.current && !p.audio.paused); };
  const onPlayer = fn => { const p = P(); if (!p || !p.on) return () => {}; fn(); return p.on(fn); };
  // a dark sidebar on a light theme: everything inside it (logo, space switch, buttons) gets the dark set of colours
  const darkSide = (bg, panel, text, muted, faint, line) => `:skin .side{--bg:${bg};--panel:${panel};--side:${bg};--text:${text};--muted:${muted};--faint:${faint};--line:${line};--hover:rgba(255,255,255,.07);--accent-soft:rgba(255,255,255,.1);background:${bg};color:${text}}`;
  const el = (tag, cls, html) => { const e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; return e; };

  /* ---------------- Now Playing: the theme takes its colours from the cover of what's playing ---------------- */
  // A 24×24 copy of the cover, its pixels grouped into rough colours; the most common becomes the background (darkened),
  // the most colourful readable one the accent. Covers from servers that don't allow it (no CORS) keep the last colours.
  const rgb2hsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
    if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; };
  const hsl = (h, s, l) => `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
  function paletteOf(img) {
    const c = document.createElement('canvas'); c.width = c.height = 24; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 24, 24);
    const d = g.getImageData(0, 0, 24, 24).data, bins = new Map();
    for (let i = 0; i < d.length; i += 4) { const [h, s, l] = rgb2hsl(d[i], d[i + 1], d[i + 2]); const k = `${Math.round(h / 24)}|${Math.round(s * 4)}|${Math.round(l * 4)}`, b = bins.get(k) || { n: 0, h: 0, s: 0, l: 0 }; b.n++; b.h += h; b.s += s; b.l += l; bins.set(k, b); }
    const cols = [...bins.values()].map(b => ({ n: b.n, h: b.h / b.n, s: b.s / b.n, l: b.l / b.n })).sort((a, b) => b.n - a.n);
    const base = cols[0] || { h: 220, s: 0.1, l: 0.2 };
    const acc = cols.filter(c => c.l > 0.25 && c.l < 0.85).sort((a, b) => (b.s * Math.sqrt(b.n)) - (a.s * Math.sqrt(a.n)))[0] || base;
    const bs = Math.min(0.45, base.s);
    return { '--bg': hsl(base.h, bs, 0.09), '--panel': hsl(base.h, bs, 0.13), '--side': hsl(base.h, bs, 0.075), '--line': hsl(base.h, bs * 0.8, 0.21), '--hover': hsl(base.h, bs, 0.17),
      '--text': hsl(base.h, Math.min(0.25, bs), 0.93), '--muted': hsl(base.h, Math.min(0.2, bs), 0.68), '--faint': hsl(base.h, Math.min(0.15, bs), 0.45),
      '--accent': hsl(acc.h, Math.max(0.45, Math.min(0.8, acc.s)), Math.max(0.55, Math.min(0.7, acc.l))), '--accent-soft': hsl(acc.h, 0.35, 0.2), '--on-accent': '#111' };
  }
  const npEnhance = () => {
    const root = document.documentElement, set = new Set(); let last = '', seq = 0;
    const apply = vars => { for (const [k, v] of Object.entries(vars)) { root.style.setProperty(k, v); set.add(k); } };
    const check = () => {
      const p = P(), c = p && p.current, art = c && ((c.live && c.now && c.now.art) || c.art);
      if (!art || art === last) return; last = art; const my = ++seq;
      const img = new Image(); img.crossOrigin = 'anonymous'; img.referrerPolicy = 'no-referrer';
      img.onload = () => { if (my !== seq) return; try { apply(paletteOf(img)); } catch (e) { /* this server doesn't share its pixels: keep the colours we have */ } };
      img.src = art;
    };
    const off = onPlayer(check), iv = setInterval(check, 4000);
    return () => { off(); clearInterval(iv); for (const k of set) root.style.removeProperty(k); };
  };
  R({ id: 'now-playing', name: 'Now Playing', category: 'Fun', tagline: 'Takes its colours from the cover of whatever is playing, and changes with each song.',
    vars: { '--ambient': 'off', '--bg': '#14161c', '--panel': '#1b1e26', '--side': '#101217', '--text': '#eceef3', '--muted': '#a3a8b6', '--faint': '#646a79', '--line': '#2a2e39', '--hover': '#232733', '--accent': '#8fb5ff', '--accent-soft': '#1f2a44', '--on-accent': '#111' },
    preview: { bg: '#14161c', panel: '#1b1e26', side: '#101217', text: '#eceef3', accent: '#e8a25a', line: '#2a2e39' },
    css: `:skin body,:skin .side,:skin .main,:skin .gl,:skin .task,:skin .btn,:skin .qa{transition:background-color 1.4s ease,color 1.4s ease,border-color 1.4s ease}
      :skin .head h1{letter-spacing:-.02em} :skin #pc-mini{box-shadow:0 10px 40px color-mix(in srgb,var(--accent) 30%,transparent)}`,
    enhance: npEnhance });

  /* ---------------- Record store: crate dividers, price-tag stickers, staff-pick notes, sleeve-edged rows ---------------- */
  R({ id: 'record-store', name: 'Record store', category: 'Fun', tagline: 'Crate dividers for headings, price-tag stickers for dates, staff-pick notes.',
    fonts: [{ family: 'Patrick Hand', src: V + 'patrick-hand-latin-400-normal.woff2' }, { family: 'Oswald', src: V + 'oswald-latin-600-normal.woff2', weight: 600 }],
    vars: { '--ambient': 'off', '--bg': '#e9e2d3', '--panel': '#fbf8f1', '--side': '#2b2622', '--text': '#231f1b', '--muted': '#6e665b', '--faint': '#a59c8d', '--line': '#d8cfbd', '--hover': 'rgba(60,40,10,.05)', '--accent': '#d4582a', '--accent-soft': '#f6dfd2', '--on-accent': '#fff' },
    preview: { bg: '#e9e2d3', panel: '#fbf8f1', side: '#2b2622', text: '#231f1b', accent: '#d4582a', line: '#d8cfbd' },
    css: `:skin body{background:radial-gradient(circle at 1px 1px,rgba(60,40,10,.09) 1px,transparent 1.5px) 0 0/14px 14px,var(--bg)}
      ${darkSide('#2b2622', '#38312b', '#efe7da', '#b6aa98', '#7d7264', '#3b342e')}
      :skin .head h1{font-family:Oswald,Impact,sans-serif;text-transform:uppercase;letter-spacing:.02em;font-weight:600}
      :skin .group-h{position:relative;display:inline-flex;align-items:center;gap:8px;margin:18px 0 6px;padding:6px 16px 6px 12px;background:#fff;border:1px solid #cfc5b2;border-radius:8px 8px 0 0;
        font:600 13px Oswald,Impact,sans-serif;text-transform:uppercase;letter-spacing:.06em;color:#3a332c;box-shadow:0 -2px 0 #efe9dd inset}
      :skin .task{background:var(--panel);border:1px solid var(--line);border-left:6px solid #2b2622;border-radius:3px;margin:4px 0;box-shadow:0 1px 0 rgba(0,0,0,.04)}
      :skin .task:nth-child(3n+2){border-left-color:#7a5b3a} :skin .task:nth-child(3n+3){border-left-color:#3d5a6b}
      :skin .t-meta .chip{background:#ffcf3f;color:#2b2622;border:0;border-radius:999px;font-weight:700;padding:1px 9px;transform:rotate(-3deg);box-shadow:0 1px 1px rgba(0,0,0,.18)}
      :skin .t-last{font-family:"Patrick Hand",cursive;font-size:15px;color:#4c6b3c;background:#fffbe0;display:inline-block;padding:0 6px;transform:rotate(-.6deg)}
      :skin .btn.primary{background:var(--accent);border-color:var(--accent);text-transform:uppercase;font-family:Oswald,sans-serif;letter-spacing:.04em}` });

  /* ---------------- Mixtape: J-card track lists, label-maker headings, reels that turn while music plays ---------------- */
  R({ id: 'mixtape', name: 'Mixtape', category: 'Fun', tagline: 'Handwritten J-cards, label-maker headings, and a cassette that turns while music plays.',
    fonts: [{ family: 'Patrick Hand', src: V + 'patrick-hand-latin-400-normal.woff2' }, { family: 'Share Tech Mono', src: V + 'share-tech-mono-latin-400-normal.woff2' }],
    font: '"Patrick Hand", "Segoe Print", cursive',
    vars: { '--ambient': 'off', '--bg': '#f4f1e6', '--panel': '#fdfbf3', '--side': '#1f2833', '--text': '#1f2a44', '--muted': '#5d6782', '--faint': '#9aa2b5', '--line': '#c9d6ea', '--hover': 'rgba(31,42,68,.05)', '--accent': '#e2583e', '--accent-soft': '#fbe1da', '--on-accent': '#fff' },
    preview: { bg: '#2d3a4a', panel: '#fdfbf3', side: '#1f2833', text: '#1f2a44', accent: '#e2583e', line: '#c9d6ea' },
    css: `:skin body{font-size:16px;background:#2d3a4a} :skin .main{background:#2d3a4a} ${darkSide('#1f2833', '#2a3542', '#e8eef7', '#a9b4c6', '#6a7588', '#2b3644')}
      :skin .wrap,:skin #view{background:repeating-linear-gradient(var(--panel) 0 27px,#d6e2f2 27px 28px);border-radius:6px}
      :skin .head h1,:skin .group-h{display:inline-block;font:400 15px "Share Tech Mono",monospace;text-transform:uppercase;letter-spacing:.18em;color:#fff;background:#151515;padding:4px 12px 3px;border-radius:3px;
        text-shadow:0 1px 0 rgba(255,255,255,.35),0 -1px 0 rgba(0,0,0,.6);box-shadow:inset 0 1px 0 rgba(255,255,255,.15),0 1px 2px rgba(0,0,0,.25)}
      :skin .head h1{font-size:22px;background:#c0392b} :skin .group-h .c{color:#ffd76a}
      :skin .task{background:transparent;border:0;border-bottom:1px dashed #b9c9df;border-radius:0}
      :skin .t-title{font-size:17px} :skin .t-title::before{content:counter(tracks) ". ";counter-increment:tracks;color:var(--muted)} :skin .group{counter-reset:tracks}
      :skin .cz-tape{display:inline-flex;align-items:center;gap:14px;margin-left:14px;padding:6px 14px;background:#222;border-radius:8px;vertical-align:middle;box-shadow:inset 0 0 0 3px #3a3a3a}
      :skin .cz-tape i{width:26px;height:26px;border-radius:50%;background:repeating-conic-gradient(#ddd 0 20deg,#888 20deg 40deg);border:5px solid #f4f4f4;box-shadow:0 0 0 2px #111}
      :skin .cz-tape.on i{animation:cz-spin 2.4s linear infinite} @keyframes cz-spin{to{transform:rotate(360deg)}}
      html[data-motion=reduce]:skin .cz-tape.on i{animation:none}`,
    enhance: () => {
      const tape = el('span', 'cz-tape', '<i></i><i></i>'); tape.setAttribute('aria-hidden', 'true');
      const place = () => { const h = document.querySelector('.head h1'); if (h && tape.parentNode !== h.parentNode) h.insertAdjacentElement('afterend', tape); };
      const mo = new MutationObserver(place); const v = document.getElementById('view'); if (v) mo.observe(v, { childList: true, subtree: true }); place();
      const off = onPlayer(() => tape.classList.toggle('on', playing())), iv = setInterval(() => tape.classList.toggle('on', playing()), 1500);
      return () => { mo.disconnect(); off(); clearInterval(iv); tape.remove(); };
    } });

  /* ---------------- On Air: a radio studio, with an amber light that glows while something plays ---------------- */
  R({ id: 'on-air', name: 'On Air', category: 'Fun', tagline: 'A late-night radio studio: an on-air light, console panels and faders.',
    fonts: [{ family: 'Oswald', src: V + 'oswald-latin-600-normal.woff2', weight: 600 }, { family: 'Share Tech Mono', src: V + 'share-tech-mono-latin-400-normal.woff2' }],
    vars: { '--ambient': 'off', '--bg': '#121315', '--panel': '#1c1e22', '--side': '#0d0e10', '--text': '#e9e6df', '--muted': '#9a968c', '--faint': '#5d5a54', '--line': '#2b2d33', '--hover': '#24262b', '--accent': '#f0a23a', '--accent-soft': '#3a2a12', '--on-accent': '#1a1206' },
    preview: { bg: '#121315', panel: '#1c1e22', side: '#0d0e10', text: '#e9e6df', accent: '#f0a23a', line: '#2b2d33' },
    css: `:skin body{background:linear-gradient(180deg,#17181b,#0f1012)}
      :skin .gl,:skin .task,:skin .qa,:skin .stat,:skin .modal{background:linear-gradient(180deg,#22252a,#1a1c20);border:1px solid #2e3137;box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 2px 0 #08090a}
      :skin .head h1,:skin .group-h{font-family:Oswald,Impact,sans-serif;text-transform:uppercase;letter-spacing:.08em}
      :skin .group-h{color:var(--accent)} :skin .t-meta,:skin .muted{font-family:"Share Tech Mono",monospace}
      :skin .cz-onair{display:inline-flex;align-items:center;margin-left:14px;padding:4px 12px;border-radius:6px;font:600 13px Oswald,sans-serif;letter-spacing:.2em;color:#4b3a22;background:#2a2116;border:1px solid #3d2f1c;vertical-align:middle;transition:all .5s}
      :skin .cz-onair.on{color:#1a1206;background:#f0a23a;box-shadow:0 0 18px #f0a23a,0 0 46px rgba(240,162,58,.45);border-color:#ffc56b}
      :skin input[type=range]{accent-color:var(--accent)} :skin .check{border-radius:3px}`,
    enhance: () => {
      const light = el('span', 'cz-onair', 'On air'); light.setAttribute('aria-hidden', 'true');
      const place = () => { const h = document.querySelector('.head h1'); if (h && light.parentNode !== h.parentNode) h.insertAdjacentElement('afterend', light); };
      const mo = new MutationObserver(place); const v = document.getElementById('view'); if (v) mo.observe(v, { childList: true, subtree: true }); place();
      const tick = () => light.classList.toggle('on', playing()), off = onPlayer(tick), iv = setInterval(tick, 1500);
      return () => { mo.disconnect(); off(); clearInterval(iv); light.remove(); };
    } });

  /* ---------------- iPod: brushed menus, the blue highlight, a title bar ---------------- */
  R({ id: 'ipod', name: 'iPod', category: 'Fun', tagline: 'Brushed metal, the blue menu highlight and a little title bar.',
    font: '"Helvetica Neue",Helvetica,Arial,sans-serif',
    vars: { '--ambient': 'off', '--bg': '#d9dbde', '--panel': '#ffffff', '--side': '#eceef0', '--text': '#111', '--muted': '#5f646b', '--faint': '#9aa0a8', '--line': '#c9ccd1', '--hover': '#e9f1fb', '--accent': '#2e7ad1', '--accent-soft': '#dbe8f8', '--on-accent': '#fff' },
    preview: { bg: '#d9dbde', panel: '#fff', side: '#eceef0', text: '#111', accent: '#2e7ad1', line: '#c9ccd1' },
    css: `:skin body{background:repeating-linear-gradient(90deg,rgba(255,255,255,.18) 0 1px,transparent 1px 3px),linear-gradient(180deg,#e7e9ec,#c9ccd0)}
      :skin .head h1{font-weight:700;font-size:22px;text-align:center;padding:6px 0;background:linear-gradient(180deg,#fdfdfd,#cfd3d8);border:1px solid #a9adb3;border-radius:8px;text-shadow:0 1px 0 #fff}
      :skin .task,:skin .nav a{border-radius:0;border-bottom:1px solid #e3e5e8}
      :skin .task:hover,:skin .task.sel,:skin .nav a.on,:skin .nav a:hover{background:linear-gradient(180deg,#5aa2ef,#1f64c4);color:#fff}
      :skin .task:hover .t-meta,:skin .task:hover .muted,:skin .task.sel .t-meta{color:#e6f0ff}
      :skin .task:hover::after,:skin .nav a.on::after{content:'›';margin-left:auto;font-size:20px;color:#fff;padding-right:6px}
      :skin .group-h{font-weight:700;color:#3a3e44}
      :skin #pc-mini .pc-play{border-radius:50%;box-shadow:0 0 0 10px #f1f2f4,0 0 0 11px #c3c7cc}` });

  /* ---------------- Gig poster: wood type, two inks that overlap a little ---------------- */
  R({ id: 'gig-poster', name: 'Gig poster', category: 'Fun', tagline: 'Letterpress show poster: wood-type headings, two inks slightly off register.',
    fonts: [{ family: 'Anton', src: V + 'anton-latin-400-normal.woff2' }],
    vars: { '--ambient': 'off', '--bg': '#efe6d2', '--panel': '#f7f0df', '--side': '#16323a', '--text': '#1b2a2f', '--muted': '#5b6a6e', '--faint': '#9aa5a6', '--line': '#d9ccb0', '--hover': 'rgba(22,50,58,.05)', '--accent': '#e8643c', '--accent-soft': '#f6d6c6', '--on-accent': '#fff' },
    preview: { bg: '#efe6d2', panel: '#f7f0df', side: '#16323a', text: '#1b2a2f', accent: '#e8643c', line: '#d9ccb0' },
    css: `:skin body{background:radial-gradient(rgba(60,40,0,.06) 1px,transparent 1px) 0 0/5px 5px,var(--bg)}
      ${darkSide('#16323a', '#204049', '#f2e9d5', '#a9c2c5', '#6d8b90', '#24474f')}
      :skin .head h1{font:400 54px/1 Anton,Impact,sans-serif;text-transform:uppercase;letter-spacing:.01em;color:#16323a;text-shadow:3px 2px 0 rgba(232,100,60,.85);mix-blend-mode:multiply}
      :skin .group-h{font:400 22px Anton,Impact,sans-serif;text-transform:uppercase;letter-spacing:.03em;color:#e8643c;border-bottom:4px solid #16323a;padding-bottom:2px}
      :skin .task{border:0;border-bottom:1px solid var(--line);border-radius:0} :skin .t-title{font-weight:600}
      :skin .btn.primary{background:#16323a;border-color:#16323a;font-family:Anton,sans-serif;text-transform:uppercase;letter-spacing:.06em}` });

  /* ---------------- Teletext: seven colours, page numbers and coloured shortcut keys ---------------- */
  const PAGES = [['today', 100, 'Today'], ['upcoming', 200, 'Upcoming'], ['music', 300, 'Music'], ['view-radio', 310, 'Radio'], ['view-podcasts', 320, 'Podcasts'], ['settings', 900, 'Settings']];
  R({ id: 'teletext', name: 'Teletext', category: 'Crazy', tagline: 'Page 100: blocky colour pages, a clock in the corner and four coloured shortcut keys.',
    fonts: [{ family: 'VT323', src: V + 'vt323-latin-400-normal.woff2' }],
    font: 'VT323, "Courier New", monospace',
    vars: { '--ambient': 'off', '--r': '0px', '--bg': '#000', '--panel': '#000', '--side': '#000', '--text': '#fff', '--muted': '#0ff', '--faint': '#0aa', '--line': '#00f', '--hover': '#001a66', '--accent': '#ff0', '--accent-soft': '#333300', '--on-accent': '#000', '--ok': '#0f0' },
    preview: { bg: '#000', panel: '#000', side: '#000', text: '#fff', accent: '#ff0', line: '#00f', r: '0' },
    css: `:skin body{font-size:21px} :skin *{border-radius:0!important;box-shadow:none!important}
      :skin .head h1{display:block;background:#00f;color:#ff0;padding:2px 10px;font-size:34px;font-weight:400}
      :skin .group-h{background:#0ff;color:#000;padding:0 8px;font-weight:400;text-transform:uppercase}
      :skin .group-h .c{color:#000} :skin .t-meta{color:#0f0} :skin .t-meta .chip{background:#f0f;color:#fff;border:0}
      :skin .task{border:0} :skin .task:hover{background:#00f}
      :skin .tt-top{position:sticky;top:0;z-index:5;display:flex;gap:16px;padding:2px 10px;background:#000;color:#fff;font:21px VT323,monospace}
      :skin .tt-top b{color:#ff0;font-weight:400} :skin .tt-top span:last-child{margin-left:auto;color:#ff0}
      :skin .tt-keys{position:fixed;left:0;right:0;bottom:0;z-index:30;display:flex;font:22px VT323,monospace}
      :skin .tt-keys a{flex:1;text-align:center;padding:2px 0;color:#000;text-decoration:none}
      :skin .tt-keys a:nth-child(1){background:#f0f}:skin .tt-keys a:nth-child(2){background:#0f0}:skin .tt-keys a:nth-child(3){background:#ff0}:skin .tt-keys a:nth-child(4){background:#0ff}
      :skin #pc-mini{bottom:40px}`,
    enhance: () => {
      const main = document.querySelector('.main'); if (!main) return;
      const top = el('div', 'tt-top'), keys = el('nav', 'tt-keys'); keys.setAttribute('aria-label', 'Shortcuts');
      keys.innerHTML = [['#today', 'Today'], ['#upcoming', 'Upcoming'], ['#music', 'Music'], ['#settings', 'Settings']].map(([h, l]) => `<a href="${h}">${l}</a>`).join('');
      const draw = () => { const h = (location.hash || '#today').slice(1), pg = (PAGES.find(p => h === p[0] || h.startsWith(p[0])) || [0, 101, 'THING']);
        const d = new Date(); top.innerHTML = `<b>P${pg[1]}</b><span>CADENCE</span><span>${d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })} ${d.toTimeString().slice(0, 8)}</span>`; };
      main.prepend(top); document.body.appendChild(keys); draw(); const iv = setInterval(draw, 1000);
      return () => { clearInterval(iv); top.remove(); keys.remove(); };
    } });

  /* ---------------- Card catalogue: wood drawers, typed index cards, date-due stamps ---------------- */
  R({ id: 'card-catalogue', name: 'Card catalogue', category: 'Useful', tagline: 'Typed index cards in oak drawers, with date-due stamps.',
    fonts: [{ family: 'Special Elite', src: V + 'special-elite-latin-400-normal.woff2' }],
    vars: { '--ambient': 'off', '--bg': '#e8dcc4', '--panel': '#fbf6e8', '--side': '#5a3b22', '--text': '#2b2118', '--muted': '#6f5f4c', '--faint': '#a3927a', '--line': '#e2d4b8', '--hover': 'rgba(90,59,34,.06)', '--accent': '#6c4a9e', '--accent-soft': '#ebe3f5', '--on-accent': '#fff' },
    preview: { bg: '#e8dcc4', panel: '#fbf6e8', side: '#5a3b22', text: '#2b2118', accent: '#6c4a9e', line: '#e2d4b8' },
    css: `${darkSide('#5a3b22', '#6b4a2e', '#f3e6cf', '#d1b998', '#9c8263', '#6b4a2e')} :skin .side{background:repeating-linear-gradient(90deg,#5a3b22 0 7px,#61412a 7px 9px,#563820 9px 14px)}
      :skin .head h1,:skin .group-h,:skin .t-title{font-family:"Special Elite","Courier New",monospace}
      :skin .group-h{display:inline-block;background:#f6efd9;border:1px solid #cdbb98;border-bottom:0;padding:4px 14px;border-radius:10px 10px 0 0;margin-top:14px}
      :skin .task{background:#fbf6e8;border:1px solid #e0d1b2;border-radius:2px;margin:6px 0;background-image:linear-gradient(#c96f5d,#c96f5d),repeating-linear-gradient(transparent 0 23px,#d9e4ef 23px 24px);background-size:100% 2px,100% 100%;background-repeat:no-repeat,repeat;background-position:0 26px,0 0;box-shadow:0 1px 2px rgba(60,40,10,.12)}
      :skin .t-meta .chip{font-family:"Special Elite",monospace;background:transparent;color:#6c4a9e;border:2px solid #6c4a9e;border-radius:3px;transform:rotate(-4deg);opacity:.85;text-transform:uppercase;font-size:11px;letter-spacing:.06em}` });

  /* ---------------- Limestone City: Kingston limestone, Lake Ontario, a ferry departures board ---------------- */
  R({ id: 'limestone', name: 'Limestone City', category: 'Useful', tagline: 'Kingston limestone and Lake Ontario blue, with today as a ferry departures board.',
    fonts: [{ family: 'Source Serif 4', src: V + 'source-serif-4-latin-400-normal.woff2' }, { family: 'Share Tech Mono', src: V + 'share-tech-mono-latin-400-normal.woff2' }],
    vars: { '--ambient': 'off', '--bg': '#d8d6cf', '--panel': '#f2f1ec', '--side': '#3d4a55', '--text': '#26303a', '--muted': '#66717c', '--faint': '#9ea6ae', '--line': '#c9c6bc', '--hover': 'rgba(38,48,58,.05)', '--accent': '#2f6e96', '--accent-soft': '#dbe8f1', '--on-accent': '#fff' },
    preview: { bg: '#d8d6cf', panel: '#f2f1ec', side: '#3d4a55', text: '#26303a', accent: '#2f6e96', line: '#c9c6bc' },
    css: `:skin body{background:linear-gradient(0deg,rgba(255,255,255,.08) 1px,transparent 1px) 0 0/100% 46px,linear-gradient(90deg,rgba(0,0,0,.05) 1px,transparent 1px) 0 0/120px 46px,
        radial-gradient(rgba(0,0,0,.05) 1px,transparent 1.5px) 0 0/7px 7px,var(--bg)}
      ${darkSide('#3d4a55', '#4a5864', '#edf1f4', '#b3c0ca', '#7d8c98', '#4c5a66')}
      :skin .head h1,:skin .group-h{font-family:"Source Serif 4",Georgia,serif;font-weight:400}
      :skin .td-sched{background:#1d2328;border-radius:10px;padding:10px 12px;color:#f5c45a;font-family:"Share Tech Mono",monospace;--muted:#c9a24a;--line:#38424b;--text:#f5c45a}
      :skin .td-sched h2{color:#f5c45a;font-family:"Share Tech Mono",monospace;text-transform:uppercase;letter-spacing:.12em}
      :skin .td-sched h2::before{content:'Departures · ';color:#e8ecef}
      :skin .td-sched .muted{color:#c9a24a}` });

  /* ---------------- Late fall: grey November light, bare branches, the odd slow leaf ---------------- */
  const branch = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="420" height="260" viewBox="0 0 420 260"><g fill="none" stroke="#5b5148" stroke-linecap="round" opacity=".16">
    <path d="M420 18 C330 30 250 60 170 64 M300 38 C280 70 270 90 236 112 M232 58 C210 40 196 30 168 26 M170 64 C130 70 96 92 60 96 M118 76 C110 104 96 120 70 136 M250 60 C262 30 280 16 300 6" stroke-width="3"/>
    <path d="M236 112 C226 130 212 140 196 146 M60 96 C40 92 24 98 6 112 M196 146 C186 160 170 166 156 168 M168 26 C150 20 140 10 132 2" stroke-width="1.6"/></g></svg>`);
  R({ id: 'late-fall', name: 'Late fall', category: 'Useful', tagline: 'Grey November light, bare branches overhead, and now and then a slow leaf.',
    fonts: [{ family: 'Source Serif 4', src: V + 'source-serif-4-latin-400-normal.woff2' }],
    vars: { '--bg': '#e4e2dd', '--panel': '#f4f3ef', '--side': '#d9d6cf', '--text': '#2f2c28', '--muted': '#77716a', '--faint': '#aca69d', '--line': '#d4d0c8', '--hover': 'rgba(47,44,40,.05)', '--accent': '#a6582e', '--accent-soft': '#f1e2d8', '--on-accent': '#fff' },
    preview: { bg: '#e4e2dd', panel: '#f4f3ef', side: '#d9d6cf', text: '#2f2c28', accent: '#a6582e', line: '#d4d0c8' },
    css: `:skin body{background:url("data:image/svg+xml,${branch}") right top/420px auto no-repeat,linear-gradient(180deg,#d6d7d8,#e8e5df 40%)}
      :skin .head h1,:skin .group-h{font-family:"Source Serif 4",Georgia,serif;font-weight:400}
      :skin .cz-leaf{position:fixed;top:-30px;width:16px;height:16px;border-radius:0 70% 0 70%;background:linear-gradient(135deg,#c06a32,#8d4a22);opacity:.75;animation:cz-fall linear forwards}
      @keyframes cz-fall{0%{transform:translate(0,0) rotate(0)}50%{transform:translate(-40px,52vh) rotate(200deg)}100%{transform:translate(30px,110vh) rotate(420deg)}}`,
    effects: ({ layer }) => {
      let t = 0;
      const drop = () => { const l = el('i', 'cz-leaf'); l.style.left = (10 + Math.random() * 80) + 'vw'; l.style.animationDuration = (12 + Math.random() * 8) + 's'; layer.appendChild(l); setTimeout(() => l.remove(), 22000); t = setTimeout(drop, 9000 + Math.random() * 14000); };
      t = setTimeout(drop, 3000);
      return () => { clearTimeout(t); layer.innerHTML = ''; };
    } });
})();
