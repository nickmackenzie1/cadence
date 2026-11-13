/* Six more themes (user backlog 2026-11-12): Claude, Reddit, Pocket Casts, Blades, Adventure, Platformer.
   Same CadenceThemes.register() API as themes-pack.js. Homages: each borrows a palette, layout or texture and is
   drawn for Cadence. No logos, mascots, characters or other brand artwork. Fonts are vendored (OFL, see CREDITS.md). */
(() => {
  const R = t => window.CadenceThemes.register(t);
  const F = 'vendor/themes/fonts/';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = api => api.util.todayKey();
  const doneToday = api => api.tasks.list(x => x.done && x.doneAt && api.util.ymd(new Date(x.doneAt)) === today(api)).length;
  const dueToday = api => api.tasks.list(x => !x.done && x.dueDate && x.dueDate <= today(api)).length;
  // run fn now and whenever the view redraws
  const onView = fn => { const v = document.getElementById('view'); fn(); if (!v) return () => {}; const mo = new MutationObserver(() => fn()); mo.observe(v, { childList: true, subtree: true }); return () => mo.disconnect(); };

  /* ---------------- Claude: warm ivory and clay, a serif for headings, the roomy composer ---------------- */
  R({ id: 'claude', name: 'Claude', category: 'Useful', tagline: 'Warm ivory, clay accents and a calm serif, like the Claude app.',
    fonts: [{ family: 'Source Serif 4', src: F + 'source-serif-4-latin-400-normal.woff2', weight: 400 }, { family: 'Source Serif 4', src: F + 'source-serif-4-latin-600-normal.woff2', weight: 600 }],
    font: 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif',
    vars: { '--ambient': 'off', '--accent': '#c96442', '--on-accent': '#fff', '--r': '12px', '--ok': '#5f8a4f', '--client': '#b0702b' },
    light: { '--bg': '#faf9f5', '--panel': '#ffffff', '--side': '#f5f4ed', '--text': '#141413', '--muted': '#6b6a63', '--faint': '#a3a199', '--line': '#e8e6dc', '--hover': '#efede4',
      '--accent-soft': '#f6e3da', '--client-soft': '#f5e8d6', '--danger': '#b53b2c', '--danger-soft': '#f6dcd6', '--shadow': '0 1px 2px rgba(20,20,19,.05),0 4px 16px rgba(20,20,19,.05)' },
    dark: { '--bg': '#262624', '--panel': '#30302e', '--side': '#1f1e1d', '--text': '#f5f4ed', '--muted': '#a6a49b', '--faint': '#75736b', '--line': '#3d3d3a', '--hover': '#383835',
      '--accent': '#d97757', '--accent-soft': 'rgba(217,119,87,.16)', '--client-soft': 'rgba(176,112,43,.18)', '--danger': '#e0705f', '--danger-soft': 'rgba(224,112,95,.16)', '--shadow': '0 1px 2px rgba(0,0,0,.25),0 6px 20px rgba(0,0,0,.2)' },
    preview: { bg: '#faf9f5', panel: '#ffffff', side: '#f5f4ed', text: '#141413', accent: '#c96442', line: '#e8e6dc', r: '12px' },
    css: `:skin .head h1,:skin .c-hero h1,:skin .modal-h,:skin .mr-card h3,:skin .group-h{font-family:"Source Serif 4",Georgia,serif;font-weight:600;letter-spacing:-.01em}
      :skin .head h1{font-size:30px} :skin .group-h{font-size:15px;text-transform:none;letter-spacing:0;color:var(--text)}
      :skin .side{border-right:1px solid var(--line)}
      :skin .nav a.on,:skin .ntile.on{background:var(--hover);color:var(--text)}
      :skin .qa{background:var(--panel);border:1px solid var(--line);border-radius:18px;box-shadow:0 2px 6px rgba(20,20,19,.04),0 10px 30px rgba(20,20,19,.06);padding:6px 8px}
      :skin .qa:focus-within{border-color:color-mix(in srgb,var(--accent) 45%,var(--line))}
      :skin .btn.primary,:skin .meet-btn{background:var(--accent);border-color:var(--accent);color:#fff;border-radius:10px}
      :skin .btn{border-radius:10px} :skin .chip{border-radius:8px}
      :skin .check{border-radius:50%;border-width:1.5px} :skin .task.done .check{background:var(--accent);border-color:var(--accent)}
      :skin .task:not(.td-b){border-radius:12px} :skin .task:not(.td-b):hover{background:var(--hover)}
      :skin ::selection{background:color-mix(in srgb,var(--accent) 30%,transparent)}` });

  /* ---------------- Reddit: posts with a vote column (votes are the priority), orangered and blue ---------------- */
  const redditEnhance = ({ api }) => {
    if (!api) return;
    const cols = ['', 'low', 'med', 'high'];
    const paint = () => {
      for (const row of document.querySelectorAll('#view .task[data-id]:not(.td-b)')) {
        if (row.querySelector('.rd-vote') || row.querySelector('input,textarea')) continue;
        const t = api.tasks.get(row.dataset.id); if (!t) continue;
        const p = t.priority || 0, v = document.createElement('div');
        v.className = 'rd-vote' + (p ? ' up' : '');
        v.innerHTML = `<button class="rd-up" aria-label="Raise priority">${api.ui.icon('arrow-big-up')}</button><b>${p ? p : '•'}</b><button class="rd-dn" aria-label="Lower priority">${api.ui.icon('arrow-big-down')}</button>`;
        v.title = p ? `Priority: ${cols[p]}` : 'No priority';
        v.onclick = e => { e.stopPropagation(); const b = e.target.closest('button'); if (!b) return; const cur = (api.tasks.get(t.id) || {}).priority || 0; api.tasks.update(t.id, { priority: Math.max(0, Math.min(3, cur + (b.classList.contains('rd-up') ? 1 : -1))) }); };
        row.prepend(v);
      }
    };
    const off = onView(paint);
    return () => { off(); document.querySelectorAll('.rd-vote').forEach(x => x.remove()); };
  };
  R({ id: 'reddit', name: 'Reddit', category: 'Fun', tagline: 'Tasks as posts with a vote column: upvote to raise the priority.',
    fonts: [400, 500, 700].map(w => ({ family: 'IBM Plex Sans', src: F + `ibm-plex-sans-latin-${w}-normal.woff2`, weight: w })),
    font: '"IBM Plex Sans",-apple-system,"Segoe UI",sans-serif',
    vars: { '--ambient': 'off', '--accent': '#ff4500', '--on-accent': '#fff', '--client': '#0079d3', '--ok': '#46d160', '--r': '4px' },
    light: { '--bg': '#dae0e6', '--panel': '#ffffff', '--side': '#ffffff', '--text': '#1c1c1c', '--muted': '#787c7e', '--faint': '#a5a4a4', '--line': '#edeff1', '--hover': '#f6f7f8',
      '--accent-soft': '#ffe5d9', '--client-soft': '#e3f1fb', '--danger': '#ea0027', '--danger-soft': '#fde0e5', '--shadow': 'none' },
    dark: { '--bg': '#030303', '--panel': '#1a1a1b', '--side': '#1a1a1b', '--text': '#d7dadc', '--muted': '#818384', '--faint': '#5a5c5d', '--line': '#343536', '--hover': '#272729',
      '--accent-soft': 'rgba(255,69,0,.16)', '--client-soft': 'rgba(0,121,211,.18)', '--client': '#4fbcff', '--danger': '#ff585b', '--danger-soft': 'rgba(255,88,91,.15)', '--shadow': 'none' },
    preview: { bg: '#dae0e6', panel: '#ffffff', side: '#ffffff', text: '#1c1c1c', accent: '#ff4500', line: '#ccc', r: '4px' },
    enhance: redditEnhance,
    css: `:skin body{font-size:14px} :skin .side{border-right:1px solid var(--line)}
      :skin .head h1{font-size:22px;font-weight:700}
      :skin .group-h{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
      :skin .task:not(.td-b){background:var(--panel);border:1px solid var(--line);border-radius:4px;margin-bottom:8px;padding:0 10px 0 0;align-items:stretch;overflow:hidden}
      :skin .task:not(.td-b):hover{border-color:var(--muted)}
      :skin .rd-vote{flex:none;width:40px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:0;padding:6px 0;margin-right:8px;background:color-mix(in srgb,var(--text) 3%,transparent);font-size:12px;font-weight:700;color:var(--text)}
      :skin .rd-vote button{border:0;background:none;padding:2px;color:var(--faint);cursor:pointer;border-radius:2px;display:grid;place-items:center} :skin .rd-vote button:hover{background:var(--hover)}
      :skin .rd-vote .rd-up:hover{color:#ff4500} :skin .rd-vote .rd-dn:hover{color:#7193ff} :skin .rd-vote svg{width:20px;height:20px}
      :skin .rd-vote.up b,:skin .rd-vote.up .rd-up{color:#ff4500} :skin .rd-vote b{font-weight:700;line-height:1}
      :skin .task:not(.td-b) .check{align-self:center}
      :skin .chip{border-radius:2px;font-size:12px}
      :skin .chip:has(.av)::before{content:'r/';font-weight:700;margin-right:-2px}
      :skin .btn{border-radius:999px;font-weight:700}
      :skin .btn.primary,:skin .meet-btn{background:var(--client);border-color:var(--client);color:#fff;border-radius:999px}
      :skin .qa{border-radius:4px;background:var(--panel);border:1px solid var(--line)} :skin .qa:hover{border-color:var(--client)}
      :skin a{color:var(--client)}` });

  /* ---------------- Pocket Casts: dark, red, rounded artwork, and an Up Next player for your work ---------------- */
  const pcEnhance = ({ api }) => {
    if (!api) return;
    const main = document.querySelector('.main'); if (!main) return;
    const bar = document.createElement('div'); bar.className = 'pc-player';
    const draw = () => {
      const t = today(api), next = api.tasks.list(x => !x.done && x.dueDate && x.dueDate <= t).sort((a, b) => (b.priority || 0) - (a.priority || 0) || (a.dueDate < b.dueDate ? -1 : 1))[0];
      const d = doneToday(api), all = d + dueToday(api), pct = all ? Math.round(d / all * 100) : 0;
      const c = next && next.clientId ? api.clients.get(next.clientId) : null;
      bar.innerHTML = next
        ? `<div class="pc-art">${c ? api.ui.avatar(c, 40) : api.ui.icon('list-checks')}</div><div class="pc-meta"><b>${esc(next.title)}</b><span>${c ? esc(c.name) + ' · ' : ''}Up next</span></div>
           <button class="pc-play" data-id="${esc(next.id)}" aria-label="Mark done">${api.ui.icon('check')}</button>
           <div class="pc-prog" title="${d} of ${all} done today"><i style="width:${pct}%"></i></div><span class="pc-count">${d}/${all}</span>`
        : `<div class="pc-art">${api.ui.icon('list-checks')}</div><div class="pc-meta"><b>Up next is empty</b><span>${d} done today</span></div>`;
      const b = bar.querySelector('.pc-play'); if (b) b.onclick = () => api.tasks.complete(b.dataset.id);
    };
    main.appendChild(bar); draw();
    const iv = setInterval(draw, 20000), h = () => setTimeout(draw, 50);
    document.addEventListener('cadence:task-complete', h); const off = onView(() => { clearTimeout(bar._t); bar._t = setTimeout(draw, 120); });
    return () => { clearInterval(iv); document.removeEventListener('cadence:task-complete', h); off(); bar.remove(); };
  };
  R({ id: 'pocket-casts', name: 'Pocket Casts', category: 'Fun', tagline: 'Dark and red with an Up Next player: your next task, ready to finish.',
    font: 'Inter,system-ui,-apple-system,"Segoe UI",sans-serif',
    vars: { '--ambient': 'off', '--accent': '#f43e37', '--on-accent': '#fff', '--r': '10px', '--ok': '#78d549', '--client': '#03a9f4' },
    dark: { '--bg': '#161718', '--panel': '#1f2022', '--side': '#111213', '--text': '#ffffff', '--muted': '#b8c3c9', '--faint': '#6f7580', '--line': '#2c2e31', '--hover': '#26282b',
      '--accent-soft': 'rgba(244,62,55,.16)', '--client-soft': 'rgba(3,169,244,.16)', '--danger': '#f43e37', '--danger-soft': 'rgba(244,62,55,.16)', '--shadow': '0 8px 24px rgba(0,0,0,.35)' },
    light: { '--bg': '#ffffff', '--panel': '#ffffff', '--side': '#f6f6f6', '--text': '#292b2e', '--muted': '#6f7580', '--faint': '#a2a8b0', '--line': '#e4e6e8', '--hover': '#f2f3f4',
      '--accent-soft': '#fde3e2', '--client-soft': '#ddf2fd', '--danger': '#e2342d', '--danger-soft': '#fde3e2', '--shadow': '0 6px 20px rgba(0,0,0,.08)' },
    preview: { bg: '#161718', panel: '#1f2022', side: '#111213', text: '#ffffff', accent: '#f43e37', line: '#2c2e31', r: '10px' },
    enhance: pcEnhance,
    css: `:skin .head h1{font-size:28px;font-weight:700;letter-spacing:-.02em}
      :skin .group-h{font-size:13px;font-weight:700;color:var(--text);text-transform:none;letter-spacing:0}
      :skin .av{border-radius:8px!important}
      :skin .task:not(.td-b){border-radius:10px} :skin .task:not(.td-b):hover{background:var(--hover)}
      :skin .check{border-radius:50%;border-width:2px} :skin .task.done .check{background:var(--accent);border-color:var(--accent)}
      :skin .btn.primary,:skin .meet-btn{background:var(--accent);border-color:var(--accent);color:#fff;border-radius:999px}
      :skin .btn{border-radius:999px}
      :skin .nav a.on,:skin .ntile.on{color:var(--accent)}
      :skin .main{display:flex;flex-direction:column} :skin #view{flex:1;overflow:auto;width:100%;box-sizing:border-box}
      :skin .pc-player{flex:none;display:flex;align-items:center;gap:12px;height:64px;padding:0 18px;background:var(--side);border-top:1px solid var(--line);position:relative}
      :skin .pc-art{width:40px;height:40px;border-radius:8px;display:grid;place-items:center;background:var(--hover);color:var(--muted);overflow:hidden;flex:none} :skin .pc-art svg{width:20px;height:20px}
      :skin .pc-meta{min-width:0;flex:1;display:flex;flex-direction:column} :skin .pc-meta b{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap} :skin .pc-meta span{font-size:12px;color:var(--muted)}
      :skin .pc-play{width:44px;height:44px;border-radius:50%;border:0;background:var(--accent);color:#fff;display:grid;place-items:center;cursor:pointer;flex:none} :skin .pc-play svg{width:22px;height:22px}
      :skin .pc-play:hover{filter:brightness(1.08)}
      :skin .pc-prog{position:absolute;left:0;right:0;top:-2px;height:3px;background:var(--line)} :skin .pc-prog i{display:block;height:100%;background:var(--accent);transition:width .3s}
      :skin .pc-count{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums;width:40px;text-align:right}` });

  /* ---------------- Blades: the 2005 console dashboard, glossy blades down the side and a green glow ---------------- */
  const BLADES = [['today', 'Today', '#5dc21e'], ['upcoming', 'Upcoming', '#2a9ddb'], ['inbox', 'Inbox', '#f39a1d'], ['done', 'Logbook', '#8c8f94']];
  const bladesEnhance = ({ api }) => {
    const host = document.createElement('nav'); host.className = 'bl-blades'; host.setAttribute('aria-label', 'Blades');
    host.innerHTML = BLADES.map(([r, n, c]) => `<a href="#${r}" data-r="${r}" style="--c:${c}"><span>${n}</span></a>`).join('');
    document.body.appendChild(host);
    const mark = () => { const r = location.hash.slice(1) || 'today'; host.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.r === r)); };
    addEventListener('hashchange', mark); mark();
    return () => { removeEventListener('hashchange', mark); host.remove(); };
  };
  R({ id: 'blades', name: 'Blades', category: 'Fun', tagline: 'The 2005 console dashboard: glossy blades on the right, a soft green glow.',
    font: '"Segoe UI",Selawik,"Helvetica Neue",Arial,sans-serif',
    vars: { '--ambient': 'off', '--accent': '#4aa81a', '--on-accent': '#fff', '--r': '6px', '--ok': '#4aa81a', '--client': '#e08a12' },
    light: { '--bg': '#e6e9ec', '--panel': 'rgba(255,255,255,.86)', '--side': '#f1f3f5', '--text': '#1b1d1f', '--muted': '#5f656c', '--faint': '#9aa0a6', '--line': '#cdd2d7', '--hover': '#e2f2d6',
      '--accent-soft': '#dff0d0', '--client-soft': '#fbe8cc', '--danger': '#c8381e', '--danger-soft': '#f6dcd5', '--shadow': '0 2px 8px rgba(0,0,0,.12)' },
    dark: { '--bg': '#15181b', '--panel': 'rgba(36,40,44,.9)', '--side': '#1c2024', '--text': '#eef1f3', '--muted': '#a0a7ae', '--faint': '#6b7279', '--line': '#353b41', '--hover': '#26331d',
      '--accent-soft': 'rgba(74,168,26,.2)', '--client-soft': 'rgba(224,138,18,.2)', '--danger': '#ec6a4f', '--danger-soft': 'rgba(236,106,79,.16)', '--shadow': '0 2px 10px rgba(0,0,0,.4)' },
    preview: { bg: 'radial-gradient(circle at 70% 40%,#c9eaa8,#e6e9ec 60%)', panel: '#ffffff', side: '#f1f3f5', text: '#1b1d1f', accent: '#4aa81a', line: '#cdd2d7', r: '6px' },
    enhance: bladesEnhance,
    css: `:skin body{background:radial-gradient(900px 600px at 72% 38%,color-mix(in srgb,var(--accent) 22%,transparent),transparent 70%),linear-gradient(180deg,var(--bg),color-mix(in srgb,var(--bg) 85%,#000))}
      :skin .app,:skin .main{background:transparent} :skin .main{padding-right:150px}
      :skin .head h1{font-weight:300;font-size:34px;letter-spacing:-.01em}
      :skin .group-h{font-weight:600;color:var(--accent);text-transform:none;letter-spacing:0;font-size:15px}
      :skin .task:not(.td-b),:skin .gl,:skin .stat{background:var(--panel);border:1px solid var(--line);box-shadow:var(--shadow)}
      :skin .task:not(.td-b){margin-bottom:4px} :skin .task:not(.td-b):hover{background:var(--hover)}
      :skin .btn{background:linear-gradient(180deg,#fff,#dfe3e7);border:1px solid #b9bfc5;color:#1b1d1f}
      :skin[data-theme=dark] .btn{background:linear-gradient(180deg,#3a4046,#262a2f);border-color:#4a5157;color:#eef1f3}
      :skin .btn.primary,:skin .meet-btn{background:linear-gradient(180deg,#8fdc4d,#4aa81a 55%,#378111);border:1px solid #2f700e;color:#fff;text-shadow:0 1px 0 rgba(0,0,0,.25)}
      :skin .check{border-radius:50%} :skin .task.done .check{background:radial-gradient(circle at 35% 30%,#b5ef7c,#4aa81a 60%,#2f700e);border-color:#2f700e}
      :skin .bl-blades{position:fixed;right:0;top:0;bottom:0;width:140px;display:flex;flex-direction:row-reverse;z-index:20;pointer-events:none}
      :skin .bl-blades a{pointer-events:auto;position:relative;flex:none;width:30px;margin-left:-6px;height:100%;background:linear-gradient(90deg,color-mix(in srgb,var(--c) 75%,#fff),var(--c) 40%,color-mix(in srgb,var(--c) 80%,#000));border-left:1px solid rgba(255,255,255,.55);box-shadow:-4px 0 10px rgba(0,0,0,.18);text-decoration:none;transition:width .25s ease;border-radius:10px 0 0 10px}
      :skin .bl-blades a span{position:absolute;top:24px;left:50%;transform:translateX(-50%) rotate(180deg);writing-mode:vertical-rl;color:#fff;font-weight:600;font-size:13px;letter-spacing:.04em;text-shadow:0 1px 2px rgba(0,0,0,.35);white-space:nowrap}
      :skin .bl-blades a:hover{width:38px} :skin .bl-blades a.on{width:46px} :skin .bl-blades a.on span{font-size:14px}
      @media (max-width:900px){:skin .bl-blades{display:none} :skin .main{padding-right:0}}` });

  /* ---------------- Adventure: parchment over a deep forest, gold lettering, hearts for today's work ---------------- */
  const advEnhance = ({ api }) => {
    if (!api) return;
    const paint = () => {
      const head = document.querySelector('#view .head'); if (!head || head.querySelector('.adv-hearts')) return;
      const d = doneToday(api), all = Math.min(10, d + dueToday(api)), full = Math.min(all, d);
      const h = document.createElement('div'); h.className = 'adv-hearts'; h.title = `${d} done today`;
      h.innerHTML = all ? Array.from({ length: all }, (_, i) => `<i class="${i < full ? 'full' : ''}">${api.ui.icon('heart')}</i>`).join('') : '';
      head.appendChild(h);
    };
    const off = onView(paint);
    const got = e => {   // a small banner when you finish something
      const t = e.detail || {}, b = document.createElement('div'); b.className = 'adv-got';
      b.innerHTML = `<small>You finished</small><b>${esc(t.title || 'a task')}</b>`;
      document.body.appendChild(b); setTimeout(() => b.classList.add('out'), 2200); setTimeout(() => b.remove(), 2800);
      document.querySelectorAll('.adv-hearts').forEach(x => x.remove()); paint();
    };
    document.addEventListener('cadence:task-complete', got);
    return () => { off(); document.removeEventListener('cadence:task-complete', got); document.querySelectorAll('.adv-hearts,.adv-got').forEach(x => x.remove()); };
  };
  R({ id: 'adventure', name: 'Adventure', category: 'Fun', tagline: 'A fantasy quest log: parchment over a deep forest, gold lettering, a heart for every task done today.',
    fonts: [{ family: 'Cinzel', src: F + 'cinzel-latin-500-normal.woff2', weight: 500 }, { family: 'Cinzel', src: F + 'cinzel-latin-700-normal.woff2', weight: 700 }],
    font: 'Georgia,"Times New Roman",serif',
    vars: { '--ambient': 'off', '--bg': '#183024', '--panel': '#f2e5c2', '--side': '#10241a', '--text': '#2b2113', '--muted': '#6f5b3a', '--faint': '#9c8762', '--line': '#cfb98a', '--hover': '#e8d7aa',
      '--accent': '#3d8b3a', '--on-accent': '#fff', '--accent-soft': '#d6e5b9', '--client': '#8a5a17', '--client-soft': '#ecd9ad', '--ok': '#3d8b3a', '--danger': '#a33224', '--danger-soft': '#efcfb8',
      '--r': '6px', '--shadow': '0 2px 0 #b89c62,0 6px 18px rgba(0,0,0,.35)' },
    preview: { bg: '#183024', panel: '#f2e5c2', side: '#10241a', text: '#2b2113', accent: '#c9a227', line: '#cfb98a', r: '6px' },
    enhance: advEnhance,
    css: `:skin body{background:radial-gradient(1200px 700px at 30% 0%,#24452f,transparent 60%),repeating-linear-gradient(135deg,rgba(255,255,255,.015) 0 2px,transparent 2px 9px),#183024}
      :skin .app,:skin .main{background:transparent}
      :skin .side{background:linear-gradient(180deg,#14301f,#0c1d14);border-right:2px solid #c9a227;color:#ecdcb0}
      :skin .side .nav a,:skin .side .ntile,:skin .side .sect,:skin #side-head .brand{color:#ecdcb0} :skin .side .nav a.on,:skin .side .ntile.on{background:rgba(201,162,39,.18);color:#ffe9a8}
      :skin .side .sect{font-family:Cinzel,serif;letter-spacing:.08em;color:#c9a227}
      :skin .head h1,:skin .c-hero h1{font-family:Cinzel,serif;font-weight:700;color:#e9c95a;letter-spacing:.04em;text-shadow:0 2px 0 #3d2c0b,0 0 18px rgba(233,201,90,.25)}
      :skin .head .sub,:skin .head .sub *{color:#cdbb8e}
      :skin #view{color:#e9dcb4} :skin #view .group,:skin #view .gl,:skin #view .stat,:skin #view .qa,:skin #view .task,:skin #view .modal{color:var(--text)}
      :skin .td-sh,:skin .td-sh *,:skin .rt-bar,:skin .rt-bar *{color:#cdbb8e}
      :skin .adv-hearts{display:flex;gap:3px;margin-top:6px} :skin .adv-hearts i{display:grid;color:#5a2a1f} :skin .adv-hearts i.full{color:#e0442f;filter:drop-shadow(0 0 4px rgba(224,68,47,.45))} :skin .adv-hearts svg{width:20px;height:20px;fill:currentColor}
      :skin .group,:skin .gl,:skin .stat,:skin .modal{background:var(--panel);background-image:radial-gradient(circle at 20% 10%,rgba(255,255,255,.35),transparent 50%),radial-gradient(circle at 90% 90%,rgba(140,100,40,.12),transparent 55%);border:2px solid #b89c62;box-shadow:var(--shadow)}
      :skin .group{padding:8px 10px;border-radius:6px} :skin .group-h{font-family:Cinzel,serif;font-weight:700;color:#6b4a14;letter-spacing:.06em;text-transform:none;font-size:14px}
      :skin .task:not(.td-b){border-radius:4px} :skin .task:not(.td-b):hover{background:var(--hover)}
      :skin .check{border:2px solid #8a6a2a;border-radius:3px;transform:rotate(45deg) scale(.82);background:#f8eed2} :skin .task.done .check{background:#c9a227;border-color:#6b4a14}
      :skin .task.done .check svg{transform:rotate(-45deg)}
      :skin .btn{background:linear-gradient(180deg,#f6ebcb,#e2cc95);border:1px solid #9c7f43;color:#3a2a10;font-family:Cinzel,serif;font-weight:500}
      :skin .btn.primary,:skin .meet-btn{background:linear-gradient(180deg,#4fa44a,#2f6e2c);border:1px solid #1f4a1d;color:#fff4cf}
      :skin .qa{background:#f8eed2;border:2px solid #b89c62}
      :skin .adv-got{position:fixed;left:50%;top:22%;transform:translateX(-50%);z-index:3000;background:rgba(12,22,16,.92);border:2px solid #c9a227;border-radius:8px;padding:12px 28px;text-align:center;color:#ffe9a8;box-shadow:0 0 30px rgba(201,162,39,.35);animation:adv-in .35s ease-out}
      :skin .adv-got small{display:block;font-family:Cinzel,serif;font-size:12px;letter-spacing:.12em;color:#c9a227;text-transform:uppercase} :skin .adv-got b{font-family:Cinzel,serif;font-size:18px}
      :skin .adv-got.out{opacity:0;transition:opacity .5s}
      @keyframes adv-in{from{opacity:0;transform:translate(-50%,10px)}}
      @media (prefers-reduced-motion:reduce){:skin .adv-got{animation:none}}` });

  /* ---------------- Platformer: bright sky, drifting clouds, a brick floor and a coin for every task ---------------- */
  const plEnhance = ({ api }) => {
    if (!api) return;
    const hud = document.createElement('div'); hud.className = 'pl-hud';
    const draw = () => { hud.innerHTML = `<span class="pl-coin"></span>×${String(doneToday(api)).padStart(2, '0')}`; };
    document.body.appendChild(hud); draw();
    const h = () => setTimeout(draw, 50); document.addEventListener('cadence:task-complete', h);
    return () => { document.removeEventListener('cadence:task-complete', h); hud.remove(); };
  };
  const plEffects = ({ api }) => {
    // a coin pops out of the row you finished, with a short synthesized blip
    let ac = null;
    const blip = () => { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(); o.type = 'square'; o.frequency.setValueAtTime(988, ac.currentTime); o.frequency.setValueAtTime(1319, ac.currentTime + 0.08); g.gain.setValueAtTime(0.05, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.35); o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.36); } catch {} };
    const pop = e => {
      const id = e.detail && e.detail.id, row = id && document.querySelector(`.task[data-id="${CSS.escape(id)}"] .check`);
      const r = row ? row.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0 };
      const c = document.createElement('span'); c.className = 'pl-coin pl-pop'; c.style.left = r.left + r.width / 2 - 9 + 'px'; c.style.top = r.top - 6 + 'px';
      document.body.appendChild(c); setTimeout(() => c.remove(), 700); blip();
    };
    document.addEventListener('cadence:task-complete', pop);
    return () => { document.removeEventListener('cadence:task-complete', pop); if (ac) ac.close(); };
  };
  const BRICK = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' shape-rendering='crispEdges'%3E%3Crect width='32' height='32' fill='%23c84c0c'/%3E%3Cpath d='M0 0h32v2H0zM0 15h32v2H0zM15 2h2v13h-2zM0 17h2v15H0zM30 17h2v15h-2z' fill='%23000' opacity='.55'/%3E%3Cpath d='M2 3h12v1H2zM18 3h12v1H18zM3 18h26v1H3z' fill='%23fcbcb0'/%3E%3C/svg%3E\")";
  R({ id: 'platformer', name: 'Platformer', category: 'Fun', tagline: 'A bright 8-bit level: blue sky, drifting clouds, a brick floor and a coin for every task you finish.',
    fonts: [{ family: 'Press Start 2P', src: F + 'press-start-2p-latin-400-normal.woff2', weight: 400 }],
    font: '"Trebuchet MS",Verdana,sans-serif',
    vars: { '--ambient': 'off', '--bg': '#5c94fc', '--panel': '#ffffff', '--side': '#fcfcfc', '--text': '#111111', '--muted': '#4a4a4a', '--faint': '#888', '--line': '#111111', '--hover': '#fff3c4',
      '--accent': '#e45c10', '--on-accent': '#fff', '--accent-soft': '#ffe0c9', '--client': '#00a800', '--client-soft': '#d4f5d4', '--ok': '#00a800', '--danger': '#d82800', '--danger-soft': '#ffd8cc',
      '--r': '0px', '--shadow': '4px 4px 0 #111' },
    preview: { bg: '#5c94fc', panel: '#ffffff', side: '#fcfcfc', text: '#111', accent: '#e45c10', line: '#111', r: '0' },
    enhance: plEnhance, effects: plEffects,
    css: `:skin body{background:#5c94fc}
      :skin .app,:skin .main{background:transparent}
      :skin .main::before{content:'';position:fixed;top:0;bottom:0;right:0;left:276px;height:100%;pointer-events:none;z-index:0;
        background:radial-gradient(28px 20px at 22% 14%,#fff 98%,transparent),radial-gradient(40px 26px at 26% 12%,#fff 98%,transparent),radial-gradient(28px 20px at 30% 14%,#fff 98%,transparent),
          radial-gradient(28px 20px at 62% 24%,#fff 98%,transparent),radial-gradient(40px 26px at 66% 22%,#fff 98%,transparent),radial-gradient(28px 20px at 70% 24%,#fff 98%,transparent);
        animation:pl-drift 80s linear infinite;opacity:.95}
      :skin .main::after{content:'';position:fixed;left:0;right:0;bottom:0;height:32px;background:${BRICK};background-size:32px 32px;image-rendering:pixelated;z-index:1;pointer-events:none}
      :skin #view{position:relative;z-index:2;padding-bottom:48px}
      @keyframes pl-drift{from{background-position:0 0}to{background-position:60vw 0}}
      @media (max-width:900px){:skin .main::before{left:0}}
      @media (prefers-reduced-motion:reduce){:skin .main::before{animation:none}}
      :skin .side{border-right:4px solid #111;background:#fcfcfc}
      :skin .head h1,:skin .c-hero h1{font-family:"Press Start 2P",monospace;font-size:22px;line-height:1.4;color:#fff;text-shadow:3px 3px 0 #111;letter-spacing:0}
      :skin .head .sub,:skin .head .sub *{color:#fff;text-shadow:1px 1px 0 #111}
      :skin .group-h{font-family:"Press Start 2P",monospace;font-size:10px;color:#fff;text-shadow:2px 2px 0 #111;text-transform:uppercase}
      :skin .task:not(.td-b),:skin .gl,:skin .stat,:skin .qa,:skin .modal{background:#fff;border:3px solid #111;border-radius:0;box-shadow:4px 4px 0 #111}
      :skin .task:not(.td-b){margin-bottom:8px} :skin .task:not(.td-b):hover{background:#fff3c4}
      :skin .check{border:3px solid #111;border-radius:0;background:#fff} :skin .task.done .check{background:#fcbc3c}
      :skin .btn{border:3px solid #111;border-radius:0;background:#fff;box-shadow:3px 3px 0 #111;font-weight:700}
      :skin .btn:active{transform:translate(3px,3px);box-shadow:none}
      :skin .btn.primary,:skin .meet-btn{background:#e45c10;color:#fff;border-color:#111}
      :skin .chip{border:2px solid #111;border-radius:0}
      :skin .pl-hud{position:fixed;right:18px;top:12px;z-index:50;font:12px "Press Start 2P",monospace;color:#fff;text-shadow:2px 2px 0 #111;display:flex;align-items:center;gap:8px;pointer-events:none}
      :skin .pl-coin{display:inline-block;width:14px;height:18px;border-radius:50%;background:radial-gradient(ellipse at 40% 35%,#fff6c2 0 18%,#fcbc3c 20% 60%,#c87c0c 62%);border:2px solid #111;box-sizing:border-box}
      :skin .pl-pop{position:fixed;z-index:3000;width:18px;height:22px;animation:pl-pop .65s ease-out forwards;pointer-events:none}
      @keyframes pl-pop{0%{transform:translateY(0) scaleX(1)}25%{transform:translateY(-40px) scaleX(.3)}50%{transform:translateY(-60px) scaleX(1)}75%{transform:translateY(-52px) scaleX(.3)}100%{transform:translateY(-30px) scaleX(1);opacity:0}}` });
})();
