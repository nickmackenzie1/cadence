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
    css: `:skin body{font-size:14.5px}
      /* the server rail + channel list feel */
      :skin .side{background:#2b2d31;border-right:0;box-shadow:inset 72px 0 0 #1e1f22;padding-left:82px}
      :skin #side-head .brand{position:absolute;left:12px;top:12px;width:48px;height:48px;border-radius:16px;background:#5865f2;overflow:hidden;font-size:0;display:grid;place-items:center;transition:border-radius .2s}
      :skin #side-head .brand:hover{border-radius:14px}
      :skin #side-head .brand .logo{transform:scale(1.5)} :skin #side-head .brand kbd{display:none}
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
})();
