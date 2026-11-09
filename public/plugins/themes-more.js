/* More themes: Discord and Liquid Glass. Same public CadenceThemes.register() API as themes-pack.js.
   Credits in public/vendor/themes/CREDITS.md */
(() => {
  const R = t => window.CadenceThemes.register(t);

  /* ---------------- Discord (after radekkozak/discordian, MIT: palette and layout ideas only) ---------------- */
  R({ id: 'discord', name: 'Discord', category: 'Fun', tagline: 'Discord’s dark greys and blurple. Clients become servers, tasks read like messages.',
    font: '"gg sans","Noto Sans","Helvetica Neue",Helvetica,Arial,sans-serif',
    vars: { '--ambient': 'off', '--bg': '#313338', '--panel': '#2b2d31', '--side': '#2b2d31', '--text': '#dbdee1', '--muted': '#949ba4', '--faint': '#6d6f78', '--line': '#3f4147',
      '--hover': 'rgba(78,80,88,.32)', '--accent': '#5865f2', '--on-accent': '#fff', '--accent-soft': 'rgba(88,101,242,.18)', '--danger': '#f23f43', '--danger-soft': 'rgba(242,63,67,.16)',
      '--ok': '#23a55a', '--client': '#f0b232', '--client-soft': 'rgba(240,178,50,.15)', '--shadow': '0 8px 16px rgba(0,0,0,.24)' },
    preview: { bg: '#313338', panel: '#2b2d31', side: '#1e1f22', text: '#dbdee1', accent: '#5865f2', line: '#3f4147', r: '8px' },
    enhance: (ctx) => discordEnhance(ctx),
    css: `:skin body{font-size:14.5px}
      /* the server rail (built by enhance) + channel list */
      :skin .app{grid-template-columns:314px 1fr} @media (max-width:1180px){:skin .app{grid-template-columns:290px 1fr}}
      :skin .side{position:relative;background:#2b2d31;border-right:0;padding-left:84px}
      :skin .dc-rail{position:absolute;left:0;top:0;bottom:0;width:72px;background:#1e1f22;display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 0;overflow-y:auto;scrollbar-width:none}
      :skin .dc-rail::-webkit-scrollbar{display:none}
      :skin .dc-i{position:relative;flex:none;width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:#313338;color:#dbdee1;text-decoration:none;transition:border-radius .18s,background .18s,color .18s;font-size:22px;font-weight:300}
      :skin .dc-i .av{width:48px!important;height:48px!important;border-radius:inherit!important;font-size:16px!important;transition:border-radius .18s}
      :skin .dc-i:hover,:skin .dc-i.on{border-radius:16px}
      :skin .dc-i::before{content:'';position:absolute;left:-16px;top:50%;width:8px;height:0;margin-top:0;border-radius:0 4px 4px 0;background:#fff;transition:height .18s,margin-top .18s}
      :skin .dc-i:hover::before{height:20px;margin-top:-10px} :skin .dc-i.on::before{height:40px;margin-top:-20px}
      :skin .dc-i[data-tip]:hover::after{content:attr(data-tip);position:fixed;left:84px;margin-top:0;transform:translateY(0);background:#111214;color:#dbdee1;font-size:14px;font-weight:600;padding:6px 10px;border-radius:6px;white-space:nowrap;z-index:200;pointer-events:none;box-shadow:0 8px 16px rgba(0,0,0,.24)}
      :skin .dc-home{background:#313338;color:#dbdee1} :skin .dc-home.on,:skin .dc-home:hover{background:#5865f2;color:#fff}
      :skin .dc-home svg{width:26px;height:26px}
      :skin .dc-sep{flex:none;width:32px;height:2px;border-radius:1px;background:#35363c}
      :skin .dc-i.proj .av{border-radius:14px!important} :skin .dc-i.proj{border-radius:14px}
      :skin .dc-space{font-size:17px;font-weight:700;color:#dbdee1} :skin .dc-space:hover{background:#5865f2;color:#fff}
      :skin .dc-add{color:#23a55a} :skin .dc-add:hover{background:#23a55a;color:#fff} :skin .dc-add svg{width:22px;height:22px}
      :skin .dc-badge{position:absolute;right:-4px;bottom:-4px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#f23f43;color:#fff;font-size:11px;font-weight:700;line-height:16px;text-align:center;box-shadow:0 0 0 3px #1e1f22}
      /* channel list header: the "server" name */
      :skin #side-head{margin:-14px -10px 10px 0;padding:0 12px;height:48px;display:flex;flex-direction:column;justify-content:center;box-shadow:0 1px 0 rgba(4,4,5,.2),0 1.5px 0 rgba(6,6,7,.05),0 2px 0 rgba(4,4,5,.05)}
      :skin #side-head .brand{font-size:15px;font-weight:700;color:#f2f3f5;gap:6px} :skin #side-head .brand .logo{display:none} :skin #side-head .brand::after{content:'⌄';margin-left:auto;font-size:16px;color:#b5bac1}
      :skin #side-head .brand kbd{display:none} :skin #side-head .space-sw{display:none}
      :skin #side-main .sect:has(+ .nav a[data-cid]),:skin #side-main .sect:has(+ .nav a[data-cid]) + .nav,:skin #side-main .sect:has([data-act=add-project]),:skin #side-main .sect:has([data-act=add-project]) + .nav{display:none}
      :skin .ntiles{display:flex;flex-direction:column;gap:2px} :skin .ntile{flex-direction:row;justify-content:flex-start;height:32px;padding:0 8px;border-radius:4px;color:#949ba4;gap:6px}
      :skin .ntile .ic{display:none} :skin .ntile .tl{font-size:15px;font-weight:500;text-transform:lowercase} :skin .ntile .tl::before{content:'#';margin-right:6px;font-size:18px;font-weight:400;color:#80848e}
      :skin .ntile:hover{background:rgba(78,80,88,.3);color:#dbdee1} :skin .ntile.on{background:#404249;color:#fff}
      :skin .ntile .n{position:static;margin-left:auto;box-shadow:none;background:#4e5058;color:#fff} :skin .ntile .n.hot{background:#f23f43}
      :skin .nav a:not([data-cid]) .ic{display:none} :skin .nav a:not([data-cid]) .t::before{content:'#';margin-right:6px;font-size:18px;font-weight:400;color:#80848e;vertical-align:-1px}
      :skin .nav a:not([data-cid]) .t{text-transform:lowercase}
      /* the user panel */
      :skin #side-foot{background:#232428;margin:0 -10px -10px -84px;padding:8px 10px 8px 84px;border-top:0;position:relative}
      :skin .dc-user{display:flex;align-items:center;gap:8px;padding:2px 4px 6px} :skin .dc-me{position:relative;width:32px;height:32px;border-radius:50%;background:#5865f2;color:#fff;display:grid;place-items:center;font-weight:700}
      :skin .dc-me i{position:absolute;right:-2px;bottom:-2px;width:10px;height:10px;border-radius:50%;background:#23a55a;box-shadow:0 0 0 3px #232428}
      :skin .dc-who{display:flex;flex-direction:column;line-height:1.2} :skin .dc-who b{color:#f2f3f5;font-size:14px} :skin .dc-who small{color:#b5bac1;font-size:12px}
      :skin .sect{font-size:11.5px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;color:#949ba4}
      :skin .sect{justify-content:flex-start;gap:4px} :skin .sect button{margin-left:auto} :skin .sect::before{content:'⌄';font-weight:400}
      :skin .nav a{border-radius:4px;color:#949ba4;height:32px;font-weight:500} :skin .nav a:hover{background:rgba(78,80,88,.3);color:#dbdee1}
      :skin .nav a.on{background:#404249;color:#fff} :skin .nav a.on .ic{color:#fff}
      :skin .nav a[data-cid] .av{border-radius:50%!important} :skin .nav a[data-cid] .t::before{content:'# ';color:#80848e;font-weight:400}
      :skin .nav a .n{background:#f23f43;color:#fff;border-radius:8px;padding:0 6px;font-size:11px;font-weight:700;min-width:0} :skin .nav a .n:not(.hot){background:#4e5058}
      :skin .space-sw{background:#1e1f22;border-radius:8px} :skin .space-sw i{background:#404249;border-radius:6px}
      :skin .vgrid .vt{border-radius:50%} :skin .vgrid .vt:hover{border-radius:14px;background:#5865f2;color:#fff}
      :skin .dock .dk{border-radius:50%} :skin .dock .dk:hover{border-radius:12px}
      :skin #side-foot{background:#232428;margin:0 -10px -10px;padding:10px;border-top:0}
      :skin .meet-btn{background:#23a55a;color:#fff;border-radius:4px;border:0}
      /* main: a channel */
      :skin .head h1{font-size:22px;font-weight:700;letter-spacing:0} :skin .head h1::before{content:'# ';color:#80848e;font-weight:500}
      :skin .gl,:skin .stat{background:#2b2d31;border:0;border-radius:8px;box-shadow:none}
      :skin .qa{background:#383a40;border:0;border-radius:8px;box-shadow:none} :skin .qa .plus{background:#b5bac1;color:#383a40;border-radius:50%;width:24px;height:24px;display:grid;place-items:center;font-weight:700}
      :skin .qa input::placeholder{color:#6d6f78}
      :skin .group-h{color:#949ba4;font-size:12px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;border-bottom:1px solid #3f4147}
      :skin .task{border-radius:4px;padding:8px 10px} :skin .task:hover{background:#2e3035}
      :skin .t-title{color:#dbdee1;font-weight:500}
      :skin .check{border-radius:50%;border:2px solid #80848e} :skin .task.done .check{background:#23a55a;border-color:#23a55a}
      :skin .chip{background:#1e1f22;color:#dbdee1;border:0;border-radius:4px;padding:2px 8px;font-weight:500}
      :skin .chip.due.today{color:#23a55a} :skin .chip.due.over,:skin .chip.over{color:#f23f43} :skin .chip.client-owned{color:#f0b232} :skin .chip.dev-owned{color:#949cf7}
      :skin .btn{background:#4e5058;color:#fff;border:0;border-radius:4px;font-weight:500} :skin .btn:hover{background:#6d6f78}
      :skin .btn.primary{background:#5865f2;color:#fff} :skin .btn.primary:hover{background:#4752c4}
      :skin .btn.ghost{background:transparent;color:#dbdee1} :skin .btn.ghost:hover{background:rgba(78,80,88,.3)}
      :skin .inp{background:#1e1f22;border:0;border-radius:4px;color:#dbdee1}
      :skin .modal{background:#313338;border:0;border-radius:8px;box-shadow:0 0 0 1px rgba(0,0,0,.2),0 16px 40px rgba(0,0,0,.4)}
      :skin .modal-h{font-size:20px;font-weight:700;border:0}
      :skin .pop{background:#111214;border:0;border-radius:8px} :skin .pop-i:hover{background:#5865f2;color:#fff}
      :skin .toast{background:#111214;border:0;border-radius:8px;color:#dbdee1}
      :skin .isl-pill{background:#111214!important;--isl-fg:#dbdee1;--isl-sub:#949ba4}
      :skin .task.open{background:#2b2d31;border:0;box-shadow:0 0 0 1px #1e1f22,0 8px 16px rgba(0,0,0,.24)}
      :skin .te-chip{background:#1e1f22;border:0;color:#b5bac1} :skin .te-chip.on{background:#404249;color:#fff}
      :skin .c-hero{background:#2b2d31} :skin .c-hero h1 .av{border-radius:50%!important}
      :skin ::-webkit-scrollbar{width:8px;height:8px} :skin ::-webkit-scrollbar-thumb{background:#1a1b1e;border-radius:4px} :skin ::-webkit-scrollbar-track{background:#2b2d31}
      :skin ::selection{background:#5865f2;color:#fff}` });

  /* ---------------- Liquid Glass (Apple-style): frosted, see-through panels with light catching the edges ---------------- */
  const GLASS = (bg, edge, blur = 28) => `background:${bg}!important;-webkit-backdrop-filter:blur(${blur}px) saturate(1.8);backdrop-filter:blur(${blur}px) saturate(1.8);border:1px solid ${edge}!important;`;
  const LG_PANELS = ':skin .gl,:skin .stat,:skin .qa,:skin .task.open,:skin .pl-card,:skin .th-card,:skin .db-item:not(.bare),:skin .dk-card,:skin .tm-card,:skin .gh-card,:skin .zl-card,:skin .dw-qa';
  R({ id: 'liquid-glass', name: 'Liquid Glass', category: 'Useful', tagline: 'Frosted, see-through panels floating over soft colour, with light catching the edges.',
    font: '-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI Variable","Segoe UI",system-ui,sans-serif',
    light: { '--bg': '#eef1f7', '--panel': 'rgba(255,255,255,.58)', '--side': 'rgba(255,255,255,.42)', '--text': '#111318', '--muted': '#5d6270', '--faint': '#9196a3', '--line': 'rgba(17,19,24,.09)',
      '--hover': 'rgba(255,255,255,.55)', '--accent': '#0a84ff', '--on-accent': '#fff', '--accent-soft': 'rgba(10,132,255,.14)', '--danger': '#ff3b30', '--danger-soft': 'rgba(255,59,48,.14)', '--ok': '#30b158', '--client': '#ff9f0a', '--client-soft': 'rgba(255,159,10,.15)',
      '--shadow': '0 10px 40px rgba(31,38,80,.12)', '--lg-edge': 'rgba(255,255,255,.7)', '--lg-hi': 'rgba(255,255,255,.9)', '--lg-lo': 'rgba(255,255,255,.18)', '--lg-m1': '#9ec5ff', '--lg-m2': '#ffc2e0', '--lg-m3': '#b8f0d8', '--lg-m4': '#ffe0a8' },
    dark: { '--bg': '#0d0f16', '--panel': 'rgba(40,44,58,.5)', '--side': 'rgba(30,33,45,.45)', '--text': '#f2f3f7', '--muted': '#a3a8b8', '--faint': '#6b7083', '--line': 'rgba(255,255,255,.09)',
      '--hover': 'rgba(255,255,255,.08)', '--accent': '#0a84ff', '--on-accent': '#fff', '--accent-soft': 'rgba(10,132,255,.22)', '--danger': '#ff453a', '--danger-soft': 'rgba(255,69,58,.18)', '--ok': '#32d74b', '--client': '#ffb340', '--client-soft': 'rgba(255,179,64,.16)',
      '--shadow': '0 12px 48px rgba(0,0,0,.45)', '--lg-edge': 'rgba(255,255,255,.16)', '--lg-hi': 'rgba(255,255,255,.28)', '--lg-lo': 'rgba(255,255,255,.04)', '--lg-m1': '#1f4bb8', '--lg-m2': '#7a1f5c', '--lg-m3': '#0f6b52', '--lg-m4': '#6b4a12' },
    preview: { bg: 'linear-gradient(135deg,#9ec5ff,#ffc2e0 50%,#b8f0d8)', panel: 'rgba(255,255,255,.6)', side: 'rgba(255,255,255,.45)', text: '#111318', accent: '#0a84ff', line: 'rgba(255,255,255,.8)', r: '18px' },
    css: `
      /* soft colour under the glass, slowly drifting */
      :skin body{background:radial-gradient(60vmax 50vmax at 8% 10%,var(--lg-m1),transparent 60%),radial-gradient(55vmax 45vmax at 92% 18%,var(--lg-m2),transparent 60%),
        radial-gradient(60vmax 50vmax at 80% 95%,var(--lg-m3),transparent 60%),radial-gradient(50vmax 40vmax at 15% 90%,var(--lg-m4),transparent 60%),var(--bg) fixed;background-attachment:fixed}
      :skin .main{background:transparent}
      /* the sidebar floats as a glass slab */
      :skin .side{${GLASS('var(--side)', 'var(--lg-edge)', 40)}margin:10px 0 10px 10px;height:calc(100vh - 20px);border-radius:26px;box-shadow:inset 0 1px 0 var(--lg-hi),inset 0 -1px 0 var(--lg-lo),var(--shadow)}
      :skin .nav a{border-radius:12px} :skin .nav a.on{background:rgba(255,255,255,.6);box-shadow:inset 0 1px 0 var(--lg-hi),0 2px 10px rgba(31,38,80,.08)}
      :skin[data-theme=dark] .nav a.on{background:rgba(255,255,255,.1)}
      :skin .space-sw{${GLASS('rgba(255,255,255,.3)', 'var(--lg-edge)', 20)}border-radius:14px} :skin .space-sw i{border-radius:11px;background:rgba(255,255,255,.75);box-shadow:inset 0 1px 0 var(--lg-hi),0 2px 8px rgba(31,38,80,.12)}
      :skin #side-foot{border-top-color:var(--line)}
      /* every card is a pane of glass: blurred backdrop, a bright top edge, a soft inner glow */
      ${LG_PANELS}{${GLASS('var(--panel)', 'var(--lg-edge)')}border-radius:22px!important;box-shadow:inset 0 1px 0 var(--lg-hi),inset 0 -1px 0 var(--lg-lo),var(--shadow)!important;position:relative}
      :skin .gl::before,:skin .stat::before,:skin .qa::before{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(160deg,rgba(255,255,255,.45),transparent 38%,transparent 70%,rgba(255,255,255,.12))}
      :skin[data-theme=dark] .gl::before{opacity:.25}
      :skin .modal,:skin .pop,:skin .toast,:skin .dock-fly,:skin #upd-bar{${GLASS('var(--panel)', 'var(--lg-edge)', 36)}border-radius:24px!important;box-shadow:inset 0 1px 0 var(--lg-hi),0 24px 70px rgba(31,38,80,.22)!important}
      :skin .pop{border-radius:18px!important}
      :skin .isl-pill{${GLASS('rgba(255,255,255,.55)', 'var(--lg-edge)', 30)}box-shadow:inset 0 1px 0 var(--lg-hi),0 10px 30px rgba(31,38,80,.18)!important}
      /* glass buttons: clear capsules; primary is tinted glass */
      :skin .btn{${GLASS('rgba(255,255,255,.45)', 'var(--lg-edge)', 16)}border-radius:999px;box-shadow:inset 0 1px 0 var(--lg-hi),0 2px 10px rgba(31,38,80,.08);transition:transform .15s,box-shadow .2s}
      :skin .btn:hover{transform:translateY(-1px);box-shadow:inset 0 1px 0 var(--lg-hi),0 6px 18px rgba(31,38,80,.14)}
      :skin .btn.primary{background:color-mix(in srgb,var(--accent) 82%,transparent)!important;color:#fff;border-color:rgba(255,255,255,.35)!important}
      :skin .meet-btn{${GLASS('color-mix(in srgb,var(--accent) 80%,transparent)', 'rgba(255,255,255,.4)', 16)}color:#fff;border-radius:16px;box-shadow:inset 0 1px 0 rgba(255,255,255,.5),0 8px 24px color-mix(in srgb,var(--accent) 35%,transparent)}
      :skin .chip{background:rgba(255,255,255,.5);border:1px solid var(--lg-edge);border-radius:999px;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
      :skin[data-theme=dark] .chip{background:rgba(255,255,255,.08)}
      :skin .te-chip{border-radius:999px;background:rgba(255,255,255,.4);border-color:var(--lg-edge)}
      :skin .inp{background:rgba(255,255,255,.5);border:1px solid var(--lg-edge);border-radius:14px}
      :skin .check{border-radius:50%;background:rgba(255,255,255,.5);box-shadow:inset 0 1px 2px rgba(31,38,80,.12)}
      :skin .task{border-radius:14px} :skin .task:hover{background:rgba(255,255,255,.4)}
      :skin .group-h{border-bottom-color:var(--line)}
      :skin .c-hero{border-radius:28px} :skin .vgrid .vt,:skin .dock .dk{border-radius:12px}
      :skin .vgrid .vt.on{background:rgba(255,255,255,.6);box-shadow:inset 0 1px 0 var(--lg-hi)}
      :skin .head h1{letter-spacing:-.03em;font-weight:700}
      @supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){:skin{--panel:rgba(255,255,255,.92);--side:rgba(245,247,252,.96)}}`
  });
  /* ======================= Discord: server rail + channel list ======================= */
  const svgHome = '<svg viewBox="0 0 24 24"><path d="M12 3.5l8.5 7.2V20a.5.5 0 0 1-.5.5h-5.2v-6h-5.6v6H4a.5.5 0 0 1-.5-.5v-9.3z" fill="currentColor"/></svg>';
  const svgCompass = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor"/></svg>';
  const myName = () => { try { return (JSON.parse(localStorage.getItem('cadence.v1') || '{}').settings || {}).myName || 'You'; } catch (e) { return 'You'; } };
  const discordEnhance = ({ api }) => {
    const side = document.getElementById('side'); if (!side || !api) return;
    const rail = document.createElement('nav'); rail.className = 'dc-rail'; rail.setAttribute('aria-label', 'Clients');
    const E = api.ui.esc;
    let t = 0;
    const draw = () => {
      const r = (location.hash || '#today').slice(1), open = api.tasks.list(x => !x.done), today = api.util.todayKey();
      const late = id => open.filter(x => x.clientId === id && x.dueDate && x.dueDate < today && x.owner !== 'client').length;
      const cl = api.clients.list().sort((a, b) => (a.kind === 'project') - (b.kind === 'project') || a.name.localeCompare(b.name));
      const homeOn = !r.startsWith('client-') && !r.startsWith('view-') && r !== 'plugins';
      rail.innerHTML = `<a class="dc-i dc-home ${homeOn ? 'on' : ''}" href="#today" data-tip="Home">${svgHome}</a><i class="dc-sep"></i>` +
        cl.map(c => { const n = late(c.id); return `<a class="dc-i ${r === 'client-' + c.id ? 'on' : ''} ${c.kind === 'project' ? 'proj' : ''}" href="#client-${E(c.id)}" data-tip="${E(c.name)}">${api.ui.avatar(c, 48)}${n ? `<b class="dc-badge">${n}</b>` : ''}</a>`; }).join('') +
        `<a class="dc-i dc-add" data-act="add-client" data-tip="Add a client">+</a><a class="dc-i dc-add" data-act="add-project" data-tip="New project"><svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 9v6M9 12h6" stroke="currentColor" stroke-width="2"/></svg></a><a class="dc-i dc-add" href="#plugins" data-tip="Explore plugins">${svgCompass}</a><i class="dc-sep"></i><a class="dc-i dc-space" data-act="space" data-s="${api.space() === 'life' ? 'work' : 'life'}" data-tip="Switch to ${api.space() === 'life' ? 'Work' : 'Life'}">${api.space() === 'life' ? 'W' : 'L'}</a>`;
      const foot = document.getElementById('side-foot');
      if (foot && !foot.querySelector('.dc-user')) { const nm = myName(); foot.insertAdjacentHTML('afterbegin', `<div class="dc-user"><span class="dc-me">${E((nm[0] || 'Y').toUpperCase())}<i></i></span><span class="dc-who"><b>${E(nm.split(' ')[0])}</b><small>Online</small></span></div>`); }
    };
    side.appendChild(rail); draw();
    const later = () => { clearTimeout(t); t = setTimeout(draw, 60); };
    const mo = new MutationObserver(later); ['side-main', 'side-foot'].forEach(id => { const el = document.getElementById(id); el && mo.observe(el, { childList: true }); });
    addEventListener('hashchange', later);
    return () => { mo.disconnect(); removeEventListener('hashchange', later); rail.remove(); document.querySelectorAll('.dc-user').forEach(x => x.remove()); };
  };

  /* ======================= MSN Messenger 7.5 (homage; no Microsoft assets) ======================= */
  let AC = null; const ac = () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} return AC; };
  const tone = (f, at, dur, type = 'sine', vol = .08) => { const c = ac(); if (!c) return; const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, c.currentTime + at); g.gain.linearRampToValueAtTime(vol, c.currentTime + at + .01); g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + at + dur); o.connect(g).connect(c.destination); o.start(c.currentTime + at); o.stop(c.currentTime + at + dur + .05); };
  const chime = () => { tone(988, 0, .18); tone(1319, .12, .32); };
  const buzz = () => { for (let i = 0; i < 6; i++) tone(i % 2 ? 140 : 180, i * .07, .08, 'square', .05); };
  const msnState = () => { try { return Object.assign({ status: 'online', pm: '' }, JSON.parse(localStorage.getItem('cadence.msn') || '{}')); } catch (e) { return { status: 'online', pm: '' }; } };
  const msnSave = s => { try { localStorage.setItem('cadence.msn', JSON.stringify(s)); } catch (e) {} };
  const MSN_ST = [['online', 'Online'], ['busy', 'Busy'], ['brb', 'Be Right Back'], ['away', 'Away'], ['offline', 'Appear Offline']];
  function popup(html) {
    let box = document.getElementById('msn-pops'); if (!box) { box = document.createElement('div'); box.id = 'msn-pops'; document.body.appendChild(box); }
    const el = document.createElement('div'); el.className = 'msn-pop'; el.innerHTML = `<div class="mp-h">Cadence Messenger<span>×</span></div><div class="mp-b">${html}</div>`;
    el.querySelector('span').onclick = () => el.remove(); box.appendChild(el); setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 4200);
  }
  function nudge(silent) {
    const app = document.querySelector('.app'); if (!app) return;
    app.classList.remove('msn-shake'); void app.offsetWidth; app.classList.add('msn-shake'); setTimeout(() => app.classList.remove('msn-shake'), 700);
    if (msnState().status !== 'busy') buzz();
    if (!silent) popup('<b>You have just sent a Nudge!</b>');
  }
  const msnEnhance = ({ api }) => {
    if (!api) return;
    const E = api.ui.esc, head = document.getElementById('side-head'), view = document.getElementById('view');
    const card = document.createElement('div'); card.className = 'msn-me';
    const bar = document.createElement('div'); bar.className = 'msn-title'; bar.innerHTML = '<span class="msn-buddy"><i></i><i></i></span>Cadence Messenger<span class="msn-wb"><i>_</i><i>□</i><i>×</i></span>';
    const nowPlaying = () => { const b = document.querySelector('[data-sw=rss] .tx b'), sp = document.querySelector('[data-sw=rss] .tx span:last-child'); return b ? `♫ ${b.textContent}${sp && sp.textContent ? ' - ' + sp.textContent.replace(/^C\$\S+\s*|NEW|VG\S*|NM\S*|G\+?/g, '').trim() : ''}` : ''; };
    const draw = () => {
      const s = msnState(), nm = myName(), lbl = Object.fromEntries(MSN_ST)[s.status];
      card.className = `msn-me st-${s.status}`;
      card.innerHTML = `<button class="msn-dp" title="Click three times to nudge">${E((nm[0] || 'Y').toUpperCase())}</button>
        <div class="msn-id"><button class="msn-name">${E(nm)} <span>(${E(lbl)})</span> ▾</button>
        <input class="msn-pm" value="${E(s.pm)}" placeholder="${E(nowPlaying() || '<Type a personal message>')}" maxlength="80"></div>`;
      let clicks = 0, ct = 0;
      card.querySelector('.msn-dp').onclick = () => { clicks++; clearTimeout(ct); ct = setTimeout(() => clicks = 0, 600); if (clicks >= 3) { clicks = 0; nudge(); } };
      card.querySelector('.msn-name').onclick = e => { const m = document.createElement('div'); m.className = 'msn-menu'; m.innerHTML = MSN_ST.map(([v, l]) => `<button data-v="${v}" class="${s.status === v ? 'on' : ''}"><i class="st-${v}"></i>${l}</button>`).join('');
        const r = e.currentTarget.getBoundingClientRect(); m.style.left = r.left + 'px'; m.style.top = r.bottom + 4 + 'px'; document.body.appendChild(m);
        m.onclick = ev => { const b = ev.target.closest('button'); if (b) { msnSave({ ...msnState(), status: b.dataset.v }); draw(); } m.remove(); };
        setTimeout(() => document.addEventListener('pointerdown', function off(ev) { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('pointerdown', off, true); } }, true), 0); };
      const pm = card.querySelector('.msn-pm');
      pm.onchange = () => { const v = pm.value.trim(), st = msnState(); st.pm = v; if (/^brb\b/i.test(v)) st.status = 'brb'; msnSave(st); draw(); };
      pm.onkeydown = e => { if (e.key === 'Enter') pm.blur(); };
    };
    head && head.after(card); view && view.parentNode.insertBefore(bar, view); draw();
    // Windows XP: the contact list is its own window, with a menu bar and an "I want to…" panel
    const side = document.getElementById('side');
    const sbar = document.createElement('div'); sbar.className = 'msn-title msn-side-title'; sbar.innerHTML = '<span class="msn-buddy"><i></i><i></i></span>Cadence Messenger<span class="msn-wb"><i>_</i><i>□</i><i>×</i></span>';
    const MENUS = { File: [['Settings', 'settings'], ['Themes', 'theme']], Contacts: [['Add a contact', 'add-client'], ['New project', 'add-project']], Actions: [['Start a meeting', 'meeting'], ['Send a Nudge', '#nudge'], ['Waiting on clients', '#go:waiting']], Tools: [['Plugins', 'open-plugins'], ['Keyboard shortcuts', 'shortcuts']], Help: [['Command palette (⌘K)', '#palette']] };
    const menubar = document.createElement('div'); menubar.className = 'msn-menubar'; menubar.innerHTML = Object.keys(MENUS).map(m => `<button data-m="${m}">${m}</button>`).join('');
    const iwant = document.createElement('div'); iwant.className = 'msn-iwant';
    const iwOpen = () => { try { return localStorage.getItem('cadence.msn.iw') === '1'; } catch (e) { return false; } };
    iwant.classList.toggle('open', iwOpen());
    iwant.innerHTML = `<button class="iw-h" data-iw="toggle">I want to…<span>▾</span></button><button data-act="add-client"><i class="iw-add"></i>Add a Contact</button><button data-iw="im"><i class="iw-im"></i>Send an Instant Message</button><button data-act="meeting"><i class="iw-mt"></i>Start a Meeting</button><button data-iw="nudge"><i class="iw-nd"></i>Send a Nudge</button>`;
    const run = v => { if (v === '#nudge') return nudge(); if (v === '#palette') return document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true, bubbles: true }));
      if (v.startsWith('#go:')) { location.hash = v.slice(4); return; } const b = document.createElement('button'); b.dataset.act = v; b.hidden = true; document.body.appendChild(b); b.click(); b.remove(); };
    menubar.onclick = e => { const b = e.target.closest('[data-m]'); if (!b) return; document.querySelector('.msn-menu')?.remove();
      const m = document.createElement('div'); m.className = 'msn-menu'; m.innerHTML = MENUS[b.dataset.m].map(([l, v]) => `<button data-v="${v}">${l}</button>`).join('');
      const r = b.getBoundingClientRect(); m.style.left = r.left + 'px'; m.style.top = r.bottom + 'px'; document.body.appendChild(m);
      m.onclick = ev => { const x = ev.target.closest('[data-v]'); m.remove(); if (x) run(x.dataset.v); };
      setTimeout(() => document.addEventListener('pointerdown', function off(ev) { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('pointerdown', off, true); } }, true), 0); };
    iwant.onclick = e => { const b = e.target.closest('[data-iw]'); if (!b) return;
      if (b.dataset.iw === 'toggle') { const o = !iwant.classList.contains('open'); iwant.classList.toggle('open', o); try { localStorage.setItem('cadence.msn.iw', o ? '1' : '0'); } catch (x) {} setTimeout(() => window.dispatchEvent(new Event('resize')), 30); return; }
      if (b.dataset.iw === 'nudge') nudge(); else { const q = document.getElementById('qa'); if (q) q.focus(); else location.hash = 'inbox'; } };
    if (side) { side.prepend(menubar); side.prepend(sbar); const foot = document.getElementById('side-foot'); foot && side.insertBefore(iwant, foot); }
    // OG easter eggs
    const keys = e => { if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G')) { e.preventDefault(); nudge(); } };
    document.addEventListener('keydown', keys);
    const seen = new Set();
    const signIn = () => { const r = location.hash.slice(1); if (!r.startsWith('client-') || seen.has(r)) return; seen.add(r); const c = api.clients.get(r.slice(7)); if (c) popup(`${api.ui.avatar(c, 34)}<span><b>${E(c.name)}</b> has just signed in.</span>`); };
    addEventListener('hashchange', signIn);
    const done = () => { if (msnState().status !== 'busy') chime(); };
    document.addEventListener('cadence:task-complete', done);
    const t = setInterval(() => { const pm = card.querySelector('.msn-pm'); if (pm && !pm.value && document.activeElement !== pm) pm.placeholder = nowPlaying() || '<Type a personal message>'; }, 9000);
    return () => { document.removeEventListener('keydown', keys); removeEventListener('hashchange', signIn); document.removeEventListener('cadence:task-complete', done); clearInterval(t); card.remove(); bar.remove(); sbar.remove(); menubar.remove(); iwant.remove(); document.getElementById('msn-pops')?.remove(); };
  };

  const MSN_BLUE = '#2f62b8';
  R({ id: 'msn', name: 'MSN Messenger', category: 'Fun', tagline: 'Messenger 7.5 vibes. Ctrl+G sends a nudge. Clients sign in. Set your status.',
    font: 'Tahoma,"Segoe UI",Verdana,sans-serif',
    vars: { '--ambient': 'off', '--bg': '#ffffff', '--panel': '#ffffff', '--side': '#eef4fc', '--text': '#000000', '--muted': '#4d5a6b', '--faint': '#8a97a8', '--line': '#a5bcd9', '--hover': '#e3edfa',
      '--accent': '#2f62b8', '--on-accent': '#fff', '--accent-soft': '#d7e5f7', '--danger': '#d32f2f', '--danger-soft': '#fbe1e1', '--ok': '#3aa63a', '--client': '#e08a00', '--client-soft': '#fff1d6', '--shadow': '0 2px 6px rgba(47,98,184,.18)' },
    preview: { bg: 'linear-gradient(180deg,#d8e6f8,#fff 40%)', panel: '#fff', side: '#eef4fc', text: '#000', accent: MSN_BLUE, line: '#a5bcd9', r: '6px' },
    enhance: msnEnhance,
    css: `:skin body{font-size:12.5px;background:
          radial-gradient(60% 18% at 22% 16%,rgba(255,255,255,.85),transparent 70%),radial-gradient(40% 12% at 70% 10%,rgba(255,255,255,.7),transparent 70%),radial-gradient(30% 10% at 88% 26%,rgba(255,255,255,.55),transparent 70%),
          radial-gradient(130% 60% at 30% 108%,#69b33d 0 48%,#4a9a2b 62%,transparent 63%),radial-gradient(120% 55% at 85% 112%,#5aa833 0 46%,transparent 47%),
          linear-gradient(180deg,#2f6fd0 0%,#4c8fe0 30%,#86bcf0 62%,#bfdcf6 78%) fixed}
      :skin .app{padding:12px;gap:14px;height:100vh;box-sizing:border-box;grid-template-columns:300px 1fr}
      /* Luna windows: thick blue frame, rounded top, glossy title bar */
      :skin .side,:skin .main{background:linear-gradient(180deg,#dbe8f8 0,#f3f7fd 120px,#fff 260px);border:3px solid #0a52d6;border-top:0;border-radius:9px 9px 0 0;box-shadow:inset 0 0 0 1px #3b80f2,3px 4px 14px rgba(0,0,0,.35);overflow:hidden}
      :skin .side{padding-top:0}
      :skin .msn-title{background:linear-gradient(180deg,#0997ff 0%,#0053ee 8%,#0050ee 40%,#0066ff 88%,#0066ff 93%,#005bff 95%,#003dd7 96%,#003dd7 100%)!important;height:30px;border-radius:7px 7px 0 0;font:700 13px Trebuchet MS,Tahoma,sans-serif;text-shadow:1px 1px #0f1089}
      :skin .msn-side-title{margin:0 -10px 0;padding:0 6px 0 10px}
      :skin .msn-wb i{border:1px solid #fff!important;border-radius:3px!important;background:linear-gradient(180deg,#3c8cf3,#1b5fd8)!important;width:21px!important;height:21px!important;box-shadow:inset 1px 1px 0 rgba(255,255,255,.4)}
      :skin .msn-wb i:last-child{background:linear-gradient(180deg,#e88466,#d33b16)!important}
      :skin .msn-menubar{display:flex;gap:2px;margin:0 -10px 10px;padding:2px 6px;background:#ece9d8;border-bottom:1px solid #b8b49f}
      :skin .msn-menubar button{padding:2px 8px;font:12px Tahoma,sans-serif;color:#000;border-radius:0} :skin .msn-menubar button:hover{background:#316ac5;color:#fff}
      :skin .msn-iwant{margin:6px -10px 0;border-top:1px solid #a5bcd9;background:linear-gradient(180deg,#eef4fc,#dce8f8);padding-bottom:6px}
      :skin .msn-iwant .iw-h{display:flex!important;justify-content:space-between;padding:4px 10px!important;color:#fff!important;font-weight:700;font-size:12px;background:linear-gradient(180deg,#7ca7e6,#3d6fc4);margin-bottom:4px;text-decoration:none!important}
      :skin .msn-iwant:not(.open){padding-bottom:0} :skin .msn-iwant:not(.open) > button:not(.iw-h){display:none} :skin .msn-iwant:not(.open) .iw-h{margin-bottom:0} :skin .msn-iwant:not(.open) .iw-h span{transform:rotate(-90deg)}
      :skin .msn-iwant button{display:flex;align-items:center;gap:8px;width:100%;padding:3px 12px;font:12px Tahoma,sans-serif;color:#0b3a8c;text-align:left} :skin .msn-iwant button:hover{text-decoration:underline}
      :skin .msn-iwant i{width:14px;height:14px;border-radius:3px;flex:none} :skin .iw-add{background:radial-gradient(circle,#fff 0 22%,transparent 23%),#3aa63a} :skin .iw-im{background:linear-gradient(135deg,#7ab8ff,#2f62b8)} :skin .iw-mt{background:linear-gradient(135deg,#ffcf5a,#e08a00)} :skin .iw-nd{background:linear-gradient(135deg,#ff8c7a,#d83b2a)}
      :skin .main{display:flex;flex-direction:column} :skin #view{flex:1;overflow:auto;width:100%;box-sizing:border-box}
      :skin .msn-title{flex:none;display:flex;align-items:center;gap:8px;height:30px;padding:0 6px 0 10px;color:#fff;font-weight:700;font-size:12.5px;background:linear-gradient(180deg,#5d8fd8,#2f62b8 55%,#2556a8);text-shadow:0 1px 0 rgba(0,0,0,.25)}
      :skin .msn-wb{margin-left:auto;display:flex;gap:3px} :skin .msn-wb i{font-style:normal;width:22px;height:20px;display:grid;place-items:center;border-radius:3px;background:linear-gradient(180deg,#7aa6e6,#3c6fc4);border:1px solid #1e4a96;font-size:11px}
      :skin .msn-wb i:last-child{background:linear-gradient(180deg,#e8846b,#c44a2c);border-color:#8f2c16}
      :skin .msn-buddy{position:relative;width:18px;height:16px} :skin .msn-buddy i{position:absolute;bottom:0;width:10px;height:14px;border-radius:5px 5px 3px 3px;background:radial-gradient(circle at 50% 28%,#fff 0 18%,transparent 19%),linear-gradient(#3ec43e,#1e8f1e)}
      :skin .msn-buddy i+i{left:7px;background:radial-gradient(circle at 50% 28%,#fff 0 18%,transparent 19%),linear-gradient(#5aa0f0,#2a66c8)}
      /* you: display picture, status, personal message */
      :skin #side-head .brand{display:none}
      :skin .msn-me{display:flex;gap:10px;align-items:center;padding:4px 2px 12px;margin-bottom:6px;border-bottom:1px solid #c2d4ec}
      :skin .msn-dp{width:52px;height:52px;flex:none;border-radius:7px;display:grid;place-items:center;font-size:22px;font-weight:700;color:#fff;background:linear-gradient(135deg,#8fb8ee,#2f62b8);box-shadow:0 0 0 2px #fff,0 0 0 4px #54b948,0 0 10px 4px rgba(84,185,72,.45)}
      :skin .msn-me.st-busy .msn-dp{box-shadow:0 0 0 2px #fff,0 0 0 4px #d83b2a,0 0 10px 4px rgba(216,59,42,.4)}
      :skin .msn-me.st-away .msn-dp,:skin .msn-me.st-brb .msn-dp{box-shadow:0 0 0 2px #fff,0 0 0 4px #f0a20a,0 0 10px 4px rgba(240,162,10,.4)}
      :skin .msn-me.st-offline .msn-dp{box-shadow:0 0 0 2px #fff,0 0 0 4px #9aa5b4;filter:grayscale(1)}
      :skin .msn-id{min-width:0;flex:1;display:flex;flex-direction:column;gap:3px}
      :skin .msn-name{text-align:left;font-weight:700;font-size:13px;color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} :skin .msn-name span{font-weight:400;color:#4d5a6b}
      :skin .msn-pm{border:1px solid transparent;background:transparent;font:italic 11.5px Tahoma,sans-serif;color:#4d5a6b;padding:2px 4px;border-radius:3px;width:100%}
      :skin .msn-pm:hover,:skin .msn-pm:focus{border-color:#a5bcd9;background:#fff;outline:0}
      .msn-menu{position:fixed;z-index:300;background:#fff;border:1px solid #7d9ec0;box-shadow:2px 3px 8px rgba(0,0,0,.2);padding:3px;min-width:170px;font:12px Tahoma,sans-serif}
      .msn-menu button{display:flex;align-items:center;gap:8px;width:100%;padding:4px 8px;text-align:left}.msn-menu button:hover{background:#316ac5;color:#fff}.msn-menu button.on{font-weight:700}
      .msn-menu i{width:10px;height:10px;border-radius:50%}.msn-menu .st-online{background:#54b948}.msn-menu .st-busy{background:#d83b2a}.msn-menu .st-brb,.msn-menu .st-away{background:#f0a20a}.msn-menu .st-offline{background:#9aa5b4}
      /* the contact list */
      :skin .sect{font-weight:700;color:#1e3f7a;font-size:12px;text-transform:none;letter-spacing:0;justify-content:flex-start;gap:4px} :skin .sect button{margin-left:auto} :skin .sect::before{content:'▾';color:#2f62b8}
      :skin .nav a{border-radius:3px;border:1px solid transparent;height:26px} :skin .nav a:hover{background:#e3edfa;border-color:#b7cdea}
      :skin .nav a.on{background:linear-gradient(180deg,#e7f0fb,#cfe0f6);border-color:#7da2ce;color:#000}
      :skin .nav a[data-cid] .ic{position:relative} :skin .nav a[data-cid] .ic::after{content:'';position:absolute;right:-3px;bottom:-2px;width:9px;height:9px;border-radius:50%;border:1.5px solid #fff;background:#9aa5b4}
      :skin .nav a[data-cid]:has(.n) .ic::after{background:#54b948} :skin .nav a[data-cid]:has(.n.hot) .ic::after{background:#d83b2a}
      :skin .nav a[data-cid]:not(:has(.n)) .t{color:#7a8798}
      :skin .vgrid .vt{border:1px solid transparent;border-radius:4px} :skin .vgrid .vt:hover,:skin .vgrid .vt.on{background:#e3edfa;border-color:#b7cdea}
      /* buttons, inputs: Luna-era Messenger */
      :skin .btn{border:1px solid #7d9ec0;border-radius:3px;background:linear-gradient(180deg,#fff,#e3ecf8);color:#000;box-shadow:inset 0 1px 0 #fff}
      :skin .btn:hover{border-color:#e5a630;box-shadow:inset 0 0 0 1px #f8cf74}
      :skin .btn.primary,:skin .meet-btn{background:linear-gradient(180deg,#6d9be0,#2f62b8);border:1px solid #1e4a96;color:#fff;border-radius:3px}
      :skin .inp{border:1px solid #7d9ec0;border-radius:2px}
      :skin .qa{border:1px solid #7d9ec0;border-radius:4px;background:#fff;box-shadow:inset 0 1px 2px rgba(0,0,0,.08)} :skin .qa{position:relative} :skin .qa .qa-row{padding-right:70px} :skin .qa::after{content:'Send';position:absolute;right:8px;top:8px;padding:4px 14px;border:1px solid #7d9ec0;border-radius:3px;background:linear-gradient(180deg,#fff,#dfe9f7);font-size:12px}
            :skin .head h1{font-size:20px;color:#1e3f7a;font-weight:700;letter-spacing:0}
      :skin .gl,:skin .stat{border:1px solid #a5bcd9;border-radius:6px;background:linear-gradient(180deg,#fff,#f0f6fd);box-shadow:none}
      :skin .group-h{color:#1e3f7a;border-bottom:1px solid #c2d4ec;font-size:12.5px} :skin .group-h::before{content:'▾ ';color:#2f62b8}
      :skin .task{border-radius:3px} :skin .task:hover{background:#eaf2fc}
      :skin .chip{border-radius:3px;border:1px solid #c2d4ec;background:#f3f8fe}
      :skin .modal{border:1px solid #2f62b8;border-radius:8px;overflow:hidden} :skin .modal-h{background:linear-gradient(180deg,#5d8fd8,#2f62b8);color:#fff}
      :skin .toast{border:1px solid #7d9ec0;border-radius:6px;background:linear-gradient(180deg,#e3edfa,#fff)}
      /* the pop-ups in the corner */
      #msn-pops{position:fixed;right:14px;bottom:14px;z-index:250;display:flex;flex-direction:column;gap:8px}
      .msn-pop{width:220px;border:1px solid #7d9ec0;border-radius:6px;overflow:hidden;background:linear-gradient(180deg,#f3f8fe,#d9e7f8);box-shadow:0 6px 20px rgba(30,74,150,.3);font:12px Tahoma,sans-serif;animation:msnup .45s cubic-bezier(.2,1,.3,1)}
      .msn-pop.out{transition:transform .4s,opacity .4s;transform:translateY(30px);opacity:0}
      .msn-pop .mp-h{display:flex;justify-content:space-between;padding:4px 8px;color:#fff;font-weight:700;background:linear-gradient(180deg,#5d8fd8,#2f62b8)} .msn-pop .mp-h span{cursor:pointer}
      .msn-pop .mp-b{display:flex;gap:10px;align-items:center;padding:14px 12px;min-height:46px;color:#000}
      @keyframes msnup{from{transform:translateY(60px);opacity:0}}
      .app.msn-shake{animation:msnshake .6s cubic-bezier(.36,.07,.19,.97)}
      @keyframes msnshake{10%,90%{transform:translate(-2px,1px)}20%,80%{transform:translate(4px,-2px)}30%,50%,70%{transform:translate(-8px,3px)}40%,60%{transform:translate(8px,-3px)}}
      @media (prefers-reduced-motion:reduce){.app.msn-shake{animation:none}}` });

  /* ======================= LimeWire (homage; no LimeWire assets) ======================= */
  const lwEnhance = ({ api }) => {
    if (!api) return;
    const main = document.querySelector('.main'); if (!main) return;
    const bar = document.createElement('div'); bar.className = 'lw-status';
    let dl = null;
    const draw = () => {
      const open = api.tasks.list(x => !x.done).length, t = api.util.todayKey(), done = api.tasks.list(x => x.done && x.doneAt && api.util.ymd(new Date(x.doneAt)) === t).length;
      bar.innerHTML = `<span class="lw-conn"><i></i><i></i><i></i><i></i><i></i></span><b>Turbo-Charged Connection</b><span class="lw-sep"></span>Sharing ${open.toLocaleString()} task${open === 1 ? '' : 's'}<span class="lw-sep"></span>Completed today: ${done}` +
        (dl ? `<span class="lw-dl"><span class="lw-name">${api.ui.esc(dl.name)}</span><span class="lw-prog"><i style="width:${dl.p}%"></i></span><span>${dl.p >= 100 ? 'Download complete' : dl.p + '%'}</span></span>` : '');
    };
    main.appendChild(bar); draw();
    const iv = setInterval(draw, 15000);
    const fake = e => { const t = e.detail || {}; const name = (t.title || 'task').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '.mp3'; dl = { name, p: 0 };
      const step = () => { if (!dl) return; dl.p = Math.min(100, dl.p + Math.ceil(Math.random() * 18)); draw(); if (dl.p < 100) setTimeout(step, 180 + Math.random() * 260); else setTimeout(() => { dl = null; draw(); }, 2600); }; step(); };
    document.addEventListener('cadence:task-complete', fake);
    const ph = () => { const q = document.getElementById('qa'); if (q && !q.dataset.lw) { q.dataset.lw = 1; q.placeholder = 'Search for tasks… or add one: “Send SOW @acme fri”'; } };
    const mo = new MutationObserver(ph); const v = document.getElementById('view'); v && mo.observe(v, { childList: true }); ph();
    return () => { clearInterval(iv); document.removeEventListener('cadence:task-complete', fake); mo.disconnect(); bar.remove(); };
  };
  const LIME = '#4fa312';
  R({ id: 'limewire', name: 'LimeWire', category: 'Fun', tagline: 'Peer-to-peer task sharing, circa 2005. Turbo-Charged.',
    font: 'Tahoma,Verdana,"Segoe UI",sans-serif',
    vars: { '--ambient': 'off', '--bg': '#eef0ea', '--panel': '#ffffff', '--side': '#e3e6de', '--text': '#1d1f1a', '--muted': '#555a50', '--faint': '#8b9084', '--line': '#a8ad9f', '--hover': '#d9efc4',
      '--accent': LIME, '--on-accent': '#fff', '--accent-soft': '#dff2cc', '--danger': '#c62f1c', '--danger-soft': '#f8dcd6', '--ok': '#3d8f0e', '--client': '#c27a00', '--client-soft': '#fbecc9', '--shadow': 'none' },
    preview: { bg: '#eef0ea', panel: '#fff', side: 'linear-gradient(180deg,#f2f3ef,#d3d7cc)', text: '#1d1f1a', accent: LIME, line: '#a8ad9f', r: '3px' },
    enhance: lwEnhance,
    css: `:skin body{font-size:12.5px}
      :skin .side{background:linear-gradient(180deg,#f5f6f2,#dfe2d8);border-right:1px solid #9aa08f}
      :skin #side-head .brand{color:#2f6b0b;font-weight:700} :skin #side-head .brand .logo{background:radial-gradient(circle at 35% 30%,#c8f07a,#5aa516 55%,#2f6b0b)!important;border-radius:50%}
      :skin .main{display:flex;flex-direction:column} :skin #view{flex:1;overflow:auto;width:100%;box-sizing:border-box}
      :skin .nav a{border-radius:2px;height:26px} :skin .nav a.on{background:linear-gradient(180deg,#9ad35a,${LIME});color:#fff;border:1px solid #3b7d0d} :skin .nav a.on .ic{color:#fff}
      :skin .sect{color:#3b4036;font-size:11px;font-weight:700;background:linear-gradient(180deg,#e9ebe4,#cfd3c6);border:1px solid #b0b5a6;padding:2px 8px;margin:10px -4px 4px;border-radius:2px}
      :skin .head h1{font-size:19px;font-weight:700;letter-spacing:0;color:#2f6b0b}
      /* the search bar */
      :skin .qa{border:1px solid #8c9282;border-radius:3px;background:linear-gradient(180deg,#fff,#f3f4f0);box-shadow:inset 0 1px 2px rgba(0,0,0,.1);display:flex;flex-direction:column}
      :skin .qa{position:relative} :skin .qa-row{display:flex;padding-right:96px} :skin .qa::after{content:'Search';position:absolute;right:8px;top:9px;padding:5px 18px;border:1px solid #3b7d0d;border-radius:3px;color:#fff;font-weight:700;background:linear-gradient(180deg,#9ad35a,${LIME} 60%,#3f8c0c);pointer-events:none}
      :skin .qa .hint{display:none}
      /* results table */
      :skin .group{border:1px solid #a8ad9f;background:#fff;margin-bottom:14px}
      :skin .group-h{margin:0;padding:5px 10px;border-bottom:1px solid #a8ad9f;background:linear-gradient(180deg,#f4f5f1,#d6dacd);color:#2b2e27;font-weight:700;font-size:12px}
      :skin .group .task{border-radius:0;padding:6px 10px;border-bottom:1px solid #e3e6dc} :skin .group .task:nth-of-type(even){background:#f3f7ec}
      :skin .group .task:hover{background:#d9efc4} :skin .task.sel{background:#b9e08f!important}
      :skin .t-title{font-size:13px} :skin .check{border-radius:2px;border:1px solid #6b7062;background:linear-gradient(180deg,#fff,#e6e8e1)} :skin .task.done .check{background:${LIME};border-color:#3b7d0d}
      :skin .chip{border-radius:2px;background:#eef0ea;border:1px solid #c9cdc1;font-size:11px}
      :skin .btn{border:1px solid #8c9282;border-radius:3px;background:linear-gradient(180deg,#fff,#dcdfd5);color:#1d1f1a}
      :skin .btn.primary,:skin .meet-btn{background:linear-gradient(180deg,#9ad35a,${LIME} 60%,#3f8c0c);border:1px solid #3b7d0d;color:#fff;border-radius:3px}
      :skin .gl,:skin .stat{border:1px solid #a8ad9f;border-radius:3px;background:linear-gradient(180deg,#fff,#eef0e8);box-shadow:none}
      :skin .modal{border:1px solid #6b7062;border-radius:4px} :skin .modal-h{background:linear-gradient(180deg,#f4f5f1,#d6dacd);border-bottom:1px solid #a8ad9f}
      /* the status bar */
      :skin .lw-status{flex:none;display:flex;align-items:center;gap:10px;height:26px;padding:0 12px;border-top:1px solid #9aa08f;background:linear-gradient(180deg,#eceee7,#d3d7cb);font-size:11.5px;color:#2b2e27;white-space:nowrap;overflow:hidden}
      :skin .lw-conn{display:flex;align-items:flex-end;gap:2px;height:14px} :skin .lw-conn i{width:4px;background:${LIME};border:1px solid #3b7d0d}
      :skin .lw-conn i:nth-child(1){height:4px}:skin .lw-conn i:nth-child(2){height:6px}:skin .lw-conn i:nth-child(3){height:8px}:skin .lw-conn i:nth-child(4){height:10px}:skin .lw-conn i:nth-child(5){height:12px}
      :skin .lw-sep{width:1px;height:14px;background:#9aa08f}
      :skin .lw-dl{margin-left:auto;display:flex;align-items:center;gap:8px} :skin .lw-name{max-width:220px;overflow:hidden;text-overflow:ellipsis}
      :skin .lw-prog{width:140px;height:12px;border:1px solid #6b7062;background:#fff} :skin .lw-prog i{display:block;height:100%;background:repeating-linear-gradient(90deg,#7ec43a 0 7px,${LIME} 7px 9px);transition:width .2s}
      :skin ::selection{background:${LIME};color:#fff}` });

})();
