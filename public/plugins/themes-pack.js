/* Theme pack: everything here uses only the public CadenceThemes.register() API, so it doubles as the example.
   Open-source credits: public/vendor/themes/CREDITS.md */
(() => {
  const R = t => window.CadenceThemes.register(t);
  const V = 'vendor/themes/';
  const flat = ':skin .btn.primary{color:var(--on-accent,#fff)}';

  /* ============================ USEFUL ============================ */
  R({ id: 'paper', name: 'Paper', category: 'Useful', tagline: 'Warm paper, ink and a serif. Easy on the eyes.',
    vars: { '--bg': '#f6f1e6', '--panel': '#fffdf7', '--side': '#efe8d8', '--text': '#2a2520', '--muted': '#857a6a', '--faint': '#b5aa96', '--line': '#e2d9c6', '--hover': 'rgba(80,60,20,.05)', '--accent': '#9b2c2c', '--accent-soft': '#f3e1dc', '--danger': '#b8452b', '--ok': '#4f7a3a', '--client': '#a8681a', '--client-soft': '#f4e6cf', '--shadow': '0 1px 2px rgba(60,40,10,.06),0 10px 30px rgba(60,40,10,.08)' },
    font: '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif',
    css: `:skin .head h1{font-weight:600;letter-spacing:-.01em} :skin body{font-size:15px}` });

  R({ id: 'tufte', name: 'Tufte', category: 'Useful', tagline: 'Edward Tufte’s book typography, via Tufte CSS.',
    fonts: [{ family: 'et-book', src: V + 'tufte/et-book-roman.woff' }, { family: 'et-book', src: V + 'tufte/et-book-bold.woff', weight: 700 }],
    font: 'et-book, Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif',
    vars: { '--bg': '#fffff8', '--panel': '#fffff8', '--side': '#fbfbf0', '--text': '#111', '--muted': '#6f6f66', '--faint': '#aaa99c', '--line': '#e4e4d6', '--hover': 'rgba(0,0,0,.035)', '--accent': '#7a1f1f', '--accent-soft': '#f2e8df', '--danger': '#a8321e', '--ok': '#3d6b35', '--client': '#8a6a1f', '--client-soft': '#f3ecd9', '--shadow': 'none' },
    css: `:skin body{font-size:17px} :skin .head h1{font-weight:400;font-style:italic;font-size:34px;letter-spacing:0}
      :skin .gl,:skin .stat,:skin .qa,:skin .dw-qa,:skin .pl-card,:skin .db-item:not(.bare),:skin .modal{box-shadow:none;border-color:var(--line)} :skin .btn{border-radius:2px} :skin .btn.primary{background:#111;border-color:#111}
      :skin .t-title{font-size:17px} :skin .group-h{font-style:italic;font-weight:400;font-size:15px;text-transform:none}` });

  R({ id: 'nord', name: 'Nord', category: 'Useful', tagline: 'Arctic, north-bluish calm for late nights.',
    vars: { '--bg': '#2e3440', '--panel': '#3b4252', '--side': '#2b303b', '--text': '#eceff4', '--muted': '#a3abbb', '--faint': '#6b7385', '--line': '#434c5e', '--hover': 'rgba(236,239,244,.05)', '--accent': '#88c0d0', '--accent-soft': '#3a4b5a', '--danger': '#bf616a', '--danger-soft': '#4a3439', '--ok': '#a3be8c', '--client': '#ebcb8b', '--client-soft': '#4a4536', '--shadow': '0 1px 2px rgba(0,0,0,.3),0 10px 30px rgba(0,0,0,.35)', '--on-accent': '#2e3440' },
    css: flat });

  R({ id: 'solarized', name: 'Solarized', category: 'Useful', tagline: 'The classic. Follows the light/dark toggle.',
    light: { '--bg': '#fdf6e3', '--panel': '#fffbee', '--side': '#eee8d5', '--text': '#073642', '--muted': '#657b83', '--faint': '#93a1a1', '--line': '#e4dcc4', '--hover': 'rgba(7,54,66,.05)', '--accent': '#268bd2', '--accent-soft': '#e3eef3', '--danger': '#dc322f', '--ok': '#859900', '--client': '#b58900', '--client-soft': '#f4ead0' },
    dark: { '--bg': '#002b36', '--panel': '#073642', '--side': '#00252e', '--text': '#eee8d5', '--muted': '#93a1a1', '--faint': '#586e75', '--line': '#0f4250', '--hover': 'rgba(238,232,213,.05)', '--accent': '#2aa198', '--accent-soft': '#0c4a52', '--danger': '#dc322f', '--ok': '#859900', '--client': '#b58900', '--client-soft': '#2b3a2a' } });

  R({ id: 'contrast', name: 'High contrast', category: 'Useful', tagline: 'Maximum legibility, big focus rings.',
    vars: { '--ambient': 'off', '--bg': '#000', '--panel': '#000', '--side': '#000', '--text': '#fff', '--muted': '#e6e6e6', '--faint': '#c8c8c8', '--line': '#fff', '--hover': '#262626', '--accent': '#ffd400', '--accent-soft': '#332b00', '--danger': '#ff6b6b', '--danger-soft': '#330000', '--ok': '#6bff8a', '--client': '#7ad7ff', '--client-soft': '#002633', '--shadow': 'none', '--on-accent': '#000' },
    css: `${flat} :skin :focus-visible{outline:3px solid #ffd400!important;outline-offset:2px}
      :skin .gl,:skin .stat,:skin .qa,:skin .dw-qa,:skin .modal,:skin .pl-card,:skin .db-item:not(.bare),:skin .th-card,:skin .btn{border-width:2px!important}
      :skin .t-title{font-weight:600} :skin a{text-decoration:underline}` });

  R({ id: 'calm', name: 'Calm', category: 'Useful', tagline: 'Soft sage, no screaming reds. Made for Life mode.',
    vars: { '--bg': '#f2f4f0', '--panel': '#fbfcfa', '--side': '#eaeee7', '--text': '#2f3a34', '--muted': '#7d877f', '--faint': '#b3bbb2', '--line': '#dfe5dc', '--hover': 'rgba(47,58,52,.045)', '--accent': '#5f8a73', '--accent-soft': '#e1ece5', '--danger': '#b08368', '--danger-soft': '#f3e9e2', '--ok': '#5f8a73', '--client': '#a08a5c', '--client-soft': '#f1ecdf', '--shadow': '0 1px 2px rgba(0,0,0,.03),0 12px 34px rgba(47,58,52,.07)' },
    css: `:skin .chip.over{font-weight:500} :skin .nav a .n.hot{color:var(--muted);font-weight:500}` });

  /* ============================ FUN ============================ */
  // 98.css bevels: outer dark/light + inner shadow/face
  const BEV = `:skin{--bev-out:inset -1px -1px #0a0a0a,inset 1px 1px #fff,inset -2px -2px #808080,inset 2px 2px #dfdfdf;--bev-in:inset -1px -1px #fff,inset 1px 1px #0a0a0a,inset -2px -2px #dfdfdf,inset 2px 2px #808080;--field:inset -1px -1px #fff,inset 1px 1px #808080,inset -2px -2px #dfdfdf,inset 2px 2px #0a0a0a}`;
  const TITLEBAR = (bg, txt, h = 20) => `content:'${txt}';position:absolute;left:3px;right:3px;top:3px;height:${h}px;background:${bg};color:#fff;font-weight:700;padding:0 6px;display:flex;align-items:center;font-size:12px;letter-spacing:.01em`;
  R({ id: 'ninety-five', name: 'Ninety-Five', category: 'Fun', tagline: 'Windows 95 style: bevels, teal desktop, 98.css pixel font.',
    fonts: [{ family: 'Pixelated MS Sans Serif', src: V + '98css/ms_sans_serif.woff2' }, { family: 'Pixelated MS Sans Serif', src: V + '98css/ms_sans_serif_bold.woff2', weight: 700 }],
    font: '"Pixelated MS Sans Serif", Arial, sans-serif',
    vars: { '--ambient': 'off', '--bg': '#008080', '--panel': '#c0c0c0', '--side': '#c0c0c0', '--text': '#000', '--muted': '#3a3a3a', '--faint': '#808080', '--line': '#808080', '--hover': 'rgba(0,0,128,.1)', '--accent': '#000080', '--accent-soft': '#c6c6e8', '--danger': '#a00000', '--danger-soft': '#e8c8c8', '--ok': '#007000', '--client': '#7a5a00', '--client-soft': '#e6dcb4', '--shadow': 'none', '--mono': '"Courier New",monospace' },
    preview: { bg: '#008080', panel: '#fff', side: '#c0c0c0', text: '#000', accent: '#000080', line: '#808080', r: '0' },
    css: `${BEV}
      :skin *{border-radius:0!important} :skin body{font-size:12px;-webkit-font-smoothing:none}
      :skin .main{background:#008080}
      :skin .wrap{background:#c0c0c0;box-shadow:var(--bev-out);margin:22px auto 40px;padding:46px 26px 50px;position:relative}
      :skin .wrap::before{${TITLEBAR('linear-gradient(90deg,#000080,#1084d0)', 'Cadence.exe')}}
      :skin .wrap::after{content:'_  ▫  ✕';position:absolute;right:7px;top:5px;font:700 11px/16px Arial;color:#000;letter-spacing:6px;background:#c0c0c0;padding:0 2px 0 8px;box-shadow:var(--bev-out)}
      :skin .head h1{font-size:22px;font-weight:700;letter-spacing:0}
      :skin .side{box-shadow:var(--bev-out);border:0}
      :skin .nav a.on{background:#000080;color:#fff} :skin .nav a.on .ic,:skin .nav a.on .n{color:#fff}
      :skin .btn,:skin .meet-btn{background:#c0c0c0!important;color:#000!important;border:0!important;box-shadow:var(--bev-out);min-height:23px}
      :skin .btn:active,:skin .meet-btn:active{box-shadow:var(--bev-in)}
      :skin .btn.primary{outline:1px solid #000;outline-offset:-1px}
      :skin .inp,:skin .qa,:skin .dw-qa,:skin .task.open{background:#fff!important;border:0!important;box-shadow:var(--field)!important}
      :skin .gl,:skin .stat,:skin .pl-card,:skin .db-item:not(.bare),:skin .th-card,:skin .c-hero,:skin .pop,:skin .drawer{background:#c0c0c0!important;border:0!important;box-shadow:var(--bev-out)!important}
      :skin .check{border:0;box-shadow:var(--field);background:#fff} :skin .task.done .check{background:#fff;color:#000}
      :skin .task:hover{background:transparent;outline:1px dotted #000;outline-offset:-2px}
      :skin .modal{background:#c0c0c0;border:0;box-shadow:var(--bev-out);padding:3px}
      :skin .modal-h{background:linear-gradient(90deg,#000080,#1084d0);color:#fff;padding:4px 6px;border:0}
      :skin .modal-h button{background:#c0c0c0;color:#000;box-shadow:var(--bev-out);width:18px;height:16px}
      :skin .modal-f{border-top:0}
      :skin .db-item:not(.bare){padding:3px} :skin .db-item:not(.bare) .db-h{background:linear-gradient(90deg,#000080,#1084d0);color:#fff;padding:3px 6px;font-weight:700;min-height:18px}
      :skin .dw-stats .gl{background:#c0c0c0!important}
      :skin .toast{background:#ffffe1;color:#000;border:1px solid #000;box-shadow:none} :skin .toast button{color:#000080}
      :skin .chip{background:#c0c0c0;box-shadow:var(--bev-out);color:#000}
      :skin .isl-pill{background:#c0c0c0!important;color:#000;box-shadow:var(--bev-out)!important;--isl-fg:#000;--isl-sub:#3a3a3a}
      :skin ::-webkit-scrollbar{width:16px;height:16px;background:repeating-conic-gradient(#c0c0c0 0 25%,#fff 0 50%) 0 0/2px 2px}
      :skin ::-webkit-scrollbar-thumb{background:#c0c0c0;box-shadow:var(--bev-out)}` });

  R({ id: 'xp', name: 'Luna', category: 'Fun', tagline: 'Windows XP style: blue title bars, glossy buttons, Tahoma (after XP.css).',
    font: 'Tahoma, "Segoe UI", Verdana, sans-serif',
    vars: { '--bg': '#ece9d8', '--panel': '#fff', '--side': '#d6dff7', '--text': '#000', '--muted': '#4d4d4d', '--faint': '#9a9a9a', '--line': '#a0a0a0', '--hover': 'rgba(49,106,197,.1)', '--accent': '#316ac5', '--accent-soft': '#dbe5fa', '--danger': '#c42b1c', '--ok': '#2d8a2d', '--client': '#b06d00', '--client-soft': '#fbecd1', '--shadow': '0 2px 6px rgba(0,0,0,.2)' },
    preview: { bg: '#3a6ea5', panel: '#fff', side: '#d6dff7', text: '#000', accent: '#0a246a', line: '#7f9db9', r: '3px' },
    css: `:skin .main{background:linear-gradient(#5a7edc,#3a6ea5)}
      :skin .wrap{background:#ece9d8;margin:22px auto 40px;padding:48px 26px 48px;position:relative;border:3px solid #0831d9;border-top:0;border-radius:8px 8px 0 0}
      :skin .wrap::before{${TITLEBAR('linear-gradient(#0997ff,#0053ee 8%,#0050ee 40%,#06f 88%,#06f 93%,#005bff 95%,#003dd7 96%,#003dd7)', 'Cadence', 28)};left:-3px;right:-3px;top:0;border-radius:8px 8px 0 0;font:700 13px Trebuchet MS,Tahoma;text-shadow:1px 1px #0f1089;padding-left:10px}
      :skin .wrap::after{content:'✕';position:absolute;right:4px;top:4px;width:21px;height:21px;border:1px solid #fff;border-radius:3px;background:radial-gradient(circle at 90% 90%,#cc4600,#dc6527 55%,#e1a28a);color:#fff;font:700 12px/19px Tahoma;text-align:center}
      :skin .side{background:linear-gradient(180deg,#7ba2e7,#6375d6);color:#fff;--text:#fff;--muted:#e8eeff;--faint:#c8d4f6;--hover:rgba(255,255,255,.15)}
      :skin .nav a.on{background:rgba(255,255,255,.25)}
      :skin .btn{background:linear-gradient(180deg,#fff,#ecebe6 86%,#d6d0c5);border:1px solid #003c74;border-radius:3px;color:#000}
      :skin .btn:hover{box-shadow:inset -1px 1px #fff0cf,inset 1px 2px #fdd889,inset -2px 2px #fbc761,inset 2px -2px #e5a01a}
      :skin .btn.primary{color:#000;background:linear-gradient(180deg,#fff,#ecebe6 86%,#d6d0c5);box-shadow:inset 0 0 0 1px #6c9fe6}
      :skin .inp,:skin .qa,:skin .dw-qa{border:1px solid #7f9db9;border-radius:0;background:#fff}
      :skin .gl,:skin .stat,:skin .pl-card,:skin .db-item:not(.bare){border:1px solid #d0d0bf;border-radius:3px;background:#fff}
      :skin .modal{border:3px solid #0831d9;border-radius:8px 8px 0 0;background:#ece9d8}
      :skin .modal-h{background:linear-gradient(#0997ff,#0053ee 8%,#0050ee 40%,#06f 88%,#003dd7);color:#fff;text-shadow:1px 1px #0f1089}
      :skin .head h1{font-family:"Trebuchet MS",Tahoma,sans-serif}
      :skin .db-item:not(.bare){border:2px solid #0831d9!important;border-radius:6px 6px 0 0!important} :skin .db-item:not(.bare) .db-h{background:linear-gradient(#0997ff,#0053ee 8%,#0050ee 40%,#06f 88%,#003dd7);color:#fff;padding:5px 8px;text-shadow:1px 1px #0f1089;font-weight:700}
      :skin .meet-btn{background:linear-gradient(#3c8d0d,#5eac2a 12%,#3c8d0d 88%,#2b6b08)!important;color:#fff!important;font:italic 700 15px "Trebuchet MS",Tahoma;text-shadow:1px 1px 2px #1a4004;border-radius:0 12px 12px 0!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.4)}` });

  R({ id: 'seven', name: 'Aero', category: 'Fun', tagline: 'Windows 7 style: frosted glass and soft glow (after 7.css).',
    font: '"Segoe UI", system-ui, sans-serif',
    vars: { '--bg': '#1d5c8f', '--panel': 'rgba(255,255,255,.92)', '--side': 'rgba(214,229,245,.72)', '--text': '#1b1b1b', '--muted': '#4a5866', '--faint': '#93a3b3', '--line': 'rgba(120,150,180,.5)', '--hover': 'rgba(64,140,220,.12)', '--accent': '#2a7ad5', '--accent-soft': '#dcebfb', '--danger': '#c42b1c', '--ok': '#2b8a3e', '--client': '#b06d00', '--client-soft': '#fbecd1', '--shadow': '0 0 0 1px rgba(255,255,255,.6) inset,0 8px 30px rgba(0,30,60,.35)' },
    preview: { bg: '#1d5c8f', panel: '#fff', side: '#cfe0f2', text: '#1b1b1b', accent: '#2a7ad5', line: '#9fb6cc', r: '4px' },
    css: `:skin body{background:radial-gradient(ellipse at 30% 20%,#4fa3e0,transparent 60%),radial-gradient(ellipse at 80% 90%,#2b8a3e55,transparent 55%),linear-gradient(160deg,#1d5c8f,#0b2e4f)}
      :skin .main{background:transparent}
      :skin .wrap{background:rgba(240,246,252,.72);-webkit-backdrop-filter:blur(18px) saturate(1.6);backdrop-filter:blur(18px) saturate(1.6);border:1px solid rgba(255,255,255,.7);border-radius:8px;box-shadow:0 0 0 1px rgba(0,0,0,.35),0 12px 40px rgba(0,0,0,.4);margin:22px auto 40px;padding-top:44px;position:relative}
      :skin .wrap::before{content:'';position:absolute;inset:0 0 auto 0;height:30px;border-radius:8px 8px 0 0;background:linear-gradient(rgba(255,255,255,.55),rgba(255,255,255,.15));pointer-events:none}
      :skin .wrap::after{content:'✕';position:absolute;right:8px;top:6px;width:42px;height:18px;border-radius:0 0 4px 4px;background:linear-gradient(#e8a493,#d2522f 45%,#c2401c 50%,#d77553);color:#fff;font:700 11px/18px Segoe UI;text-align:center;box-shadow:0 0 0 1px rgba(0,0,0,.4)}
      :skin .side{-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border-right:1px solid rgba(255,255,255,.4)}
      :skin .btn{background:linear-gradient(#f2f2f2 45%,#ebebeb 45%,#cfcfcf);border:1px solid #707070;border-radius:3px;color:#000}
      :skin .btn:hover{background:linear-gradient(#eaf6fd 45%,#bee6fd 45%,#a7d9f5);border-color:#3c7fb1}
      :skin .btn.primary{color:#000;border-color:#3c7fb1;box-shadow:inset 0 0 0 1px #9ed2f5}
      :skin .gl,:skin .stat,:skin .qa,:skin .dw-qa,:skin .pl-card,:skin .db-item:not(.bare){background:rgba(255,255,255,.8);border:1px solid rgba(120,150,180,.55);border-radius:6px}` });

  R({ id: 'chicago', name: 'Chicago', category: 'Fun', tagline: 'Classic Macintosh, 1-bit black and white (system.css fonts).',
    fonts: [{ family: 'ChicagoFLF', src: V + 'systemcss/ChicagoFLF.woff2' }, { family: 'ChiKareGo2', src: V + 'systemcss/ChiKareGo2.woff2' }],
    font: 'ChiKareGo2, ChicagoFLF, Geneva, sans-serif',
    vars: { '--ambient': 'off', '--bg': '#fff', '--panel': '#fff', '--side': '#fff', '--text': '#000', '--muted': '#000', '--faint': '#555', '--line': '#000', '--hover': '#ddd', '--accent': '#000', '--accent-soft': '#ddd', '--danger': '#000', '--danger-soft': '#eee', '--ok': '#000', '--client': '#000', '--client-soft': '#eee', '--shadow': '2px 2px 0 #000' },
    preview: { bg: '#888', panel: '#fff', side: '#fff', text: '#000', accent: '#000', line: '#000', r: '0', extra: 'background-image:repeating-conic-gradient(#000 0 25%,#fff 0 50%);background-size:3px 3px' },
    css: `:skin body{font-size:16px;-webkit-font-smoothing:none}
      :skin .main{background:repeating-conic-gradient(#000 0 25%,#fff 0 50%) 0 0/2px 2px}
      :skin .wrap{background:#fff;border:1px solid #000;box-shadow:2px 2px 0 #000;margin:22px auto 40px;padding-top:44px;position:relative}
      :skin .wrap::before{content:'Cadence';position:absolute;left:0;right:0;top:0;height:20px;border-bottom:1px solid #000;font:16px ChicagoFLF;text-align:center;line-height:20px;background:linear-gradient(#fff,#fff) center/90px 100% no-repeat,repeating-linear-gradient(#fff 0 2px,#000 2px 3px) 0 3px/100% 14px no-repeat,#fff}
      :skin .head h1{font-family:ChicagoFLF;font-weight:400;font-size:28px;letter-spacing:0}
      :skin *{border-radius:0!important} :skin .btn{border-radius:6px!important;border:1px solid #000;background:#fff;color:#000}
      :skin .btn:active{background:#000;color:#fff} :skin .btn.primary{color:#000;box-shadow:0 0 0 1px #fff,0 0 0 3px #000}
      :skin .nav a.on{background:#000;color:#fff} :skin .nav a.on .ic,:skin .nav a.on .n{color:#fff}
      :skin .side{border-right:1px solid #000}
      :skin .gl,:skin .stat,:skin .qa,:skin .dw-qa,:skin .pl-card,:skin .db-item:not(.bare),:skin .modal,:skin .pop{border:1px solid #000;box-shadow:2px 2px 0 #000}
      :skin .chip.over{text-decoration:underline wavy} :skin .check{border:1.5px solid #000}
      :skin .db-item:not(.bare) .db-h{justify-content:center;font:16px ChicagoFLF;color:#000;border-bottom:1px solid #000;padding:2px 8px;background:repeating-linear-gradient(#fff 0 2px,#000 2px 3px) 0 4px/100% 12px no-repeat,#fff} :skin .db-item:not(.bare) .db-h .ic{display:none}
      :skin .isl-pill{background:#fff!important;color:#000;box-shadow:0 0 0 1px #000,2px 2px 0 #000!important;--isl-fg:#000;--isl-sub:#000}` });

  // NES.css's pixel border trick: four flat shadows give stepped "rounded" corners
  const PIX = c => `box-shadow:0 -4px ${c},0 4px ${c},-4px 0 ${c},4px 0 ${c}`;
  // NES: NES.css's component looks re-created on Cadence's own markup (titled pixel containers, balloons,
  // pixel checkboxes, progress, coloured buttons and badges, pixel cursor). MIT, nostalgic-css/NES.css
  const NESK = '#212529', PXC = (d, c = NESK) => `box-shadow:0 -${d}px ${c},0 ${d}px ${c},-${d}px 0 ${c},${d}px 0 ${c}`;
  const NES_CUR = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22' shape-rendering='crispEdges'%3E%3Cpath d='M2 2h2v2h2v2h2v2h2v2h2v2h2v2h-4v2h2v2h2v2h-2v-2h-2v-2h-2v2h-2v2h-2z' fill='%23212529'/%3E%3Cpath d='M4 4h2v2h2v2h2v2h2v2h2v2h-4v2h-2v2h-2z' fill='%23fff'/%3E%3C/svg%3E\") 2 2, auto";
  const NES_CHECK = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'%3E%3Cpath d='M6 1h1v1H6zM5 2h1v1H5zM4 3h1v1H4zM1 3h1v1H1zM2 4h1v1H2zM3 4h1v1H3zM3 5h1v1H3z' fill='%23212529'/%3E%3C/svg%3E\")";
  R({ id: 'nes', name: 'NES', category: 'Fun', tagline: '8-bit console: NES.css boxes, balloons, pixel checkboxes and a pixel cursor.',
    fonts: [{ family: 'Press Start 2P', src: V + 'fonts/press-start-2p-latin-400-normal.woff2' }],
    font: '"Press Start 2P", monospace',
    vars: { '--ambient': 'off', '--bg': '#fff', '--panel': '#fff', '--side': '#fff', '--text': NESK, '--muted': '#5a6268', '--faint': '#adb5bd', '--line': NESK, '--hover': '#e7f4fd', '--accent': '#209cee', '--on-accent': '#fff', '--accent-soft': '#d6eefc', '--danger': '#e76e55', '--danger-soft': '#fbe2dc', '--ok': '#92cc41', '--client': '#f7d51d', '--client-soft': '#fff3c4', '--shadow': 'none' },
    preview: { bg: '#fff', panel: '#fff', side: '#fff', text: NESK, accent: '#209cee', line: NESK, r: '0' },
    css: `:skin body{font-size:10px;line-height:1.8;cursor:${NES_CUR}} :skin *{border-radius:0!important} :skin a,:skin button,:skin .task,:skin [data-act]{cursor:${NES_CUR}}
      :skin .head h1{font-size:18px;letter-spacing:0;color:${NESK};text-shadow:3px 3px 0 #d6eefc} :skin .t-title{font-size:11px} :skin .sub{font-size:9px}
      /* sidebar: white with a pixel edge, blinking cursor on the active item */
      :skin .side{border-right:4px solid ${NESK};background:#fff}
      :skin .nav a{height:30px} :skin .nav a.on{background:#209cee;color:#fff} :skin .nav a.on .ic{color:#fff}
      :skin .nav a.on .t::before{content:'▶ ';animation:nesblink 1s steps(1) infinite} @keyframes nesblink{50%{opacity:0}}
      :skin .sect{font-size:8px;letter-spacing:.06em}
      :skin .space-sw{${PXC(4)};margin:4px} :skin .space-sw i{background:#209cee;${PXC(2, '#006bb3')}}
      /* nes-container: cards are pixel boxes */
      :skin .gl,:skin .stat,:skin .qa,:skin .dw-qa,:skin .pl-card,:skin .db-item:not(.bare),:skin .th-card,:skin .task.open,:skin .dk-card,:skin .zl-card{border:0!important;${PXC(4)}!important;margin:8px 6px}
      /* nes-container.with-title: groups get their heading cut into the frame */
      :skin .group{position:relative;margin:30px 6px 26px;padding:22px 14px 10px;${PXC(4)}}
      :skin .group-h{position:absolute;top:-12px;left:14px;margin:0;padding:0 10px;background:var(--bg);border:0!important;font-size:10px;letter-spacing:0;line-height:20px;color:${NESK}}
      :skin .group-h .c{color:#209cee}
      :skin .group-h.client{color:#b38b00} :skin .group-h.dev{color:#209cee}
      /* nes-btn and its colours */
      :skin .btn{border:0;${PXC(4)},inset -4px -4px #adafbc;background:#fff;color:${NESK};padding:8px 14px;margin:4px;font-size:10px}
      :skin .btn:hover{background:#e7e7e7} :skin .btn:active{box-shadow:0 -4px ${NESK},0 4px ${NESK},-4px 0 ${NESK},4px 0 ${NESK},inset 4px 4px #adafbc}
      :skin .btn.primary{background:#209cee;color:#fff;${PXC(4)},inset -4px -4px #006bb3} :skin .btn.primary:hover{background:#108de0}
      :skin .btn.danger,:skin .btn.ghost.danger{background:#e76e55;color:#fff;${PXC(4)},inset -4px -4px #8c2022}
      :skin .meet-btn{background:#92cc41;color:#fff;border:0;${PXC(4)},inset -4px -4px #4aa52e;margin:6px}
      /* nes-checkbox */
      :skin .check{width:18px;height:18px;border:0!important;background:#fff;${PXC(3)};margin:3px}
      :skin .task.done .check,:skin .dw-task.done .check{background:#fff ${NES_CHECK} center/14px no-repeat!important}
      :skin .task.done .check::after{display:none}
      /* nes-badge: chips */
      :skin .chip{border:0;background:#fff;color:${NESK};${PXC(2)};margin:2px 3px;padding:3px 7px;font-size:8px;text-transform:uppercase;letter-spacing:.02em}
      :skin .chip.due.today{background:#92cc41;color:#fff!important} :skin .chip.due.over,:skin .chip.over{background:#e76e55;color:#fff!important} :skin .chip.client-owned{background:#f7d51d;color:${NESK}!important} :skin .chip.dev-owned{background:#209cee;color:#fff!important}
      :skin .qa .hint{display:none}
      :skin .te-chip{border:0;${PXC(2)};margin:3px;font-size:9px} :skin .te-chip.on{background:#d6eefc}
      /* nes-input */
      :skin .inp,:skin .qa input{font-family:inherit;font-size:10px} :skin .inp{border:0;${PXC(4)};margin:4px;padding:8px}
      /* nes-balloon: toasts and the Island speak in speech bubbles */
      :skin .toast,:skin .isl-pill{position:relative;background:#fff!important;border:0!important;${PXC(4)}!important;overflow:visible}
      :skin .toast::after,:skin .isl-pill::after{content:'';position:absolute;left:26px;bottom:-14px;width:8px;height:8px;background:#fff;box-shadow:-4px 0 ${NESK},4px 0 ${NESK},-4px 4px ${NESK},4px 4px #fff,8px 4px ${NESK},0 8px ${NESK}}
      /* nes-progress: project bars */
      :skin .pj-bar{height:22px;max-width:520px;background:#fff;${PXC(4)};margin:6px 4px}
      :skin .pj-bar i{background:repeating-linear-gradient(90deg,#92cc41 0 12px,#76c442 12px 14px)!important}
      /* modals: a dialog box */
      :skin .modal{border:0!important;${PXC(4)}!important} :skin .modal-h{border-bottom:4px solid ${NESK};font-size:12px}
      :skin .pop{border:0;${PXC(4)}} :skin .pop-i:hover{background:#209cee;color:#fff}
      :skin .vgrid .vt.on{background:#209cee;color:#fff} :skin .dock .dk{${PXC(2)};margin:2px}
      :skin ::-webkit-scrollbar{width:12px} :skin ::-webkit-scrollbar-thumb{background:${NESK};border:3px solid #fff} :skin ::-webkit-scrollbar-track{background:#fff}
      :skin ::selection{background:#209cee;color:#fff}` });

  const GLOW = c => `text-shadow:0 0 2px ${c},0 0 8px ${c}88`;
  R({ id: 'terminal', name: 'Terminal', category: 'Fun', tagline: 'Green phosphor, VT323, a blinking cursor.',
    fonts: [{ family: 'VT323', src: V + 'fonts/vt323-latin-400-normal.woff2' }],
    font: 'VT323, monospace',
    vars: { '--ambient': 'off', '--bg': '#050a05', '--panel': '#081008', '--side': '#040804', '--text': '#33ff66', '--muted': '#22b84a', '--faint': '#167a31', '--line': '#145a25', '--hover': 'rgba(51,255,102,.08)', '--accent': '#33ff66', '--accent-soft': '#0d2a14', '--danger': '#ff5c5c', '--danger-soft': '#2a0c0c', '--ok': '#33ff66', '--client': '#ffcc33', '--client-soft': '#2a2208', '--shadow': 'none', '--on-accent': '#041004', '--mono': 'VT323, monospace' },
    css: `${flat} :skin body{font-size:19px;${GLOW('#33ff66')}} :skin *{border-radius:0!important}
      :skin .head h1{font-size:34px;font-weight:400} :skin .head h1::before{content:'> ';opacity:.7}
      :skin .head h1::after{content:'█';animation:thblink 1s steps(1) infinite;font-size:.8em}
      @keyframes thblink{50%{opacity:0}}
      :skin .btn{border:1px solid var(--line);background:transparent;color:var(--text)} :skin .btn::before{content:'['} :skin .btn::after{content:']'}
      :skin .btn.primary{background:#33ff66;text-shadow:none}
      :skin .gl,:skin .stat,:skin .qa,:skin .dw-qa,:skin .pl-card,:skin .db-item:not(.bare),:skin .modal{border:1px dashed var(--line);box-shadow:none}
      :skin .check{border-radius:0} :skin .task.done .check::after{content:'x'}
      :skin .nav a.on{background:#33ff66;color:#041004;text-shadow:none} :skin .nav a.on .ic,:skin .nav a.on .n{color:#041004}
      @media (prefers-reduced-motion:reduce){:skin .head h1::after{animation:none}}` });

  R({ id: 'vaporwave', name: 'Vaporwave', category: 'Fun', tagline: 'Ｐｉｎｋ ｓｕｎｓｅｔ， ｎｅｏｎ ｇｒｉｄ， ａｅｓｔｈｅｔｉｃ．',
    vars: { '--bg': '#1a0b33', '--panel': 'rgba(32,12,64,.82)', '--side': 'rgba(24,8,50,.78)', '--text': '#fdf0ff', '--muted': '#d4a8f0', '--faint': '#8d6bb5', '--line': 'rgba(255,113,206,.35)', '--hover': 'rgba(255,113,206,.12)', '--accent': '#ff71ce', '--accent-soft': 'rgba(255,113,206,.18)', '--danger': '#ff6b8b', '--ok': '#05ffa1', '--client': '#fffb96', '--client-soft': 'rgba(255,251,150,.12)', '--shadow': '0 0 24px rgba(255,113,206,.25)', '--on-accent': '#1a0b33' },
    preview: { bg: '#2b1055', panel: '#3a1670', side: '#200c46', text: '#fdf0ff', accent: '#ff71ce', line: '#ff71ce' },
    css: `${flat} :skin body{background:linear-gradient(#1a0b33 0%,#3a1670 45%,#d53a9d 72%,#ff9e5e 100%) fixed}
      :skin body::before{content:'';position:fixed;left:calc(276px + (100vw - 276px) / 2);bottom:14vh;width:30vh;height:30vh;margin-left:-15vh;border-radius:50%;background:linear-gradient(#fffb96,#ff71ce 70%);-webkit-mask:linear-gradient(#000 0 55%,transparent 55% 59%,#000 59% 67%,transparent 67% 72%,#000 72% 80%,transparent 80% 86%,#000 86% 91%,transparent 91%);mask:linear-gradient(#000 0 55%,transparent 55% 59%,#000 59% 67%,transparent 67% 72%,#000 72% 80%,transparent 80% 86%,#000 86% 91%,transparent 91%);opacity:.55;pointer-events:none}
      :skin body::after{content:'';position:fixed;left:-50%;right:-50%;bottom:-10vh;height:46vh;background:linear-gradient(transparent 0 94%,#ff71ce 94%) 0 0/100% 46px,linear-gradient(90deg,transparent 0 96%,#01cdfe 96%) 0 0/70px 100%;transform:perspective(320px) rotateX(62deg);transform-origin:bottom;opacity:.55;pointer-events:none;animation:thgrid 2.4s linear infinite}
      @keyframes thgrid{to{background-position:0 46px,0 0}}
      @media (prefers-reduced-motion:reduce){:skin body::after{animation:none}}
      :skin .app{position:relative;z-index:1} :skin .main{background:transparent}
      :skin .wrap{background:rgba(26,11,51,.72);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border:1px solid rgba(255,113,206,.3);border-radius:18px;margin:22px auto 40px;box-shadow:0 0 40px rgba(255,113,206,.2)}
      :skin .side{-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
      :skin .head h1{background:linear-gradient(90deg,#ff71ce,#01cdfe,#05ffa1);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(2px 2px 0 #b967ff);font-style:italic}
      :skin .gl,:skin .stat,:skin .qa,:skin .dw-qa,:skin .pl-card,:skin .db-item:not(.bare),:skin .modal{-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}` });

  const WOB = 'border-radius:255px 15px 225px 15px/15px 225px 15px 255px';
  R({ id: 'sketchbook', name: 'Sketchbook', category: 'Fun', tagline: 'Hand-drawn wobbly boxes on ruled paper (after PaperCSS).',
    fonts: [{ family: 'Comic Neue', src: V + 'fonts/comic-neue-latin-400-normal.woff2' }, { family: 'Comic Neue', src: V + 'fonts/comic-neue-latin-700-normal.woff2', weight: 700 }],
    font: '"Comic Neue", "Comic Sans MS", cursive',
    vars: { '--bg': '#fdfcf7', '--panel': '#fff', '--side': '#f7f5ec', '--text': '#41403e', '--muted': '#77746c', '--faint': '#b4b0a5', '--line': '#41403e', '--hover': 'rgba(65,64,62,.06)', '--accent': '#0071de', '--accent-soft': '#e2efff', '--danger': '#a7342d', '--ok': '#86a361', '--client': '#c27b16', '--client-soft': '#fbefdc', '--shadow': '2px 8px 4px -6px rgba(0,0,0,.3)' },
    preview: { r: '18px 4px 16px 4px' },
    css: `:skin body{font-size:16px} :skin .main{background:repeating-linear-gradient(transparent 0 27px,#d6e4f5 27px 28px),#fdfcf7}
      :skin .head h1{font-weight:700;font-size:30px;text-decoration:underline wavy #0071de 2px;text-underline-offset:6px}
      :skin .c-hero .head h1{text-decoration:none} :skin .c-hero h1 .nm{text-decoration:underline wavy #0071de 2px;text-underline-offset:9px;text-decoration-skip-ink:none;padding-bottom:4px}
      :skin .c-hero .sub{margin-top:4px!important}
      :skin .btn,:skin .gl,:skin .stat,:skin .qa,:skin .dw-qa,:skin .pl-card,:skin .db-item:not(.bare),:skin .th-card,:skin .modal,:skin .pop,:skin .chip,:skin .inp{${WOB}!important;border:2px solid #41403e!important}
      :skin .btn{box-shadow:15px 28px 25px -18px rgba(0,0,0,.2);transition:box-shadow .2s,transform .2s}
      :skin .btn:hover{box-shadow:2px 8px 8px -5px rgba(0,0,0,.3);transform:translateY(-1px)}
      :skin .check{${WOB}!important;border:2px solid #41403e}
      :skin .task.done .t-title{text-decoration:line-through wavy}` });

  // NeoBrutalism (after NeoBrutalismCSS, MIT): thick black borders, hard offset shadows, buttons you can press
  const NBF = [{ family: 'Lexend Mega', src: V + 'fonts/lexend-mega-latin-800-normal.woff2', weight: 800 }, { family: 'Public Sans', src: V + 'fonts/public-sans-latin-400-normal.woff2' }, { family: 'Public Sans', src: V + 'fonts/public-sans-latin-700-normal.woff2', weight: 700 }];
  const NB_CARDS = ':skin .pb-search,:skin .gl,:skin .stat,:skin .qa,:skin .dw-qa,:skin .pl-card,:skin .db-item:not(.bare),:skin .th-card,:skin .modal,:skin .pop,:skin .task.open,:skin .drawer,:skin .pb-detail,:skin .db-lib,:skin .toast';
  const neo = (id, name, tagline, p) => R({ id, name, category: 'Fun', tagline, fonts: NBF, font: '"Public Sans", system-ui, sans-serif',
    vars: { '--bg': p.bg, '--panel': '#ffffff', '--side': p.side, '--text': '#000', '--muted': '#2b2b2b', '--faint': '#5c5c5c', '--line': '#000', '--hover': 'rgba(0,0,0,.06)',
      '--accent': p.accent, '--on-accent': '#000', '--accent-soft': p.soft, '--danger': '#d7263d', '--danger-soft': '#ffc5c8', '--ok': '#0f8a5f', '--client': '#b35900', '--client-soft': '#ffe3b3', '--shadow': '5px 5px 0 #000' },
    preview: { bg: p.bg, panel: '#fff', side: p.side, text: '#000', accent: p.accent, line: '#000', r: '5px', font: '"Lexend Mega", sans-serif', extra: 'box-shadow:inset 0 0 0 3px #000' },
    css: `${NB_CARDS}{border:3px solid #000!important;border-radius:6px!important;box-shadow:5px 5px 0 #000!important}
      :skin .head h1,:skin .pb-hero h1,:skin .modal-h,:skin .th-cat,:skin .db-h{font-family:"Lexend Mega",sans-serif;font-weight:800;letter-spacing:-.05em}
      :skin .head h1{font-size:30px} :skin .modal-h{background:${p.accent};border-bottom:3px solid #000}
      :skin .btn,:skin .meet-btn{border:3px solid #000!important;border-radius:6px!important;background:#fff;color:#000!important;font-weight:700;box-shadow:4px 4px 0 #000;transition:transform .08s,box-shadow .08s}
      :skin .btn:hover,:skin .meet-btn:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 #000}
      :skin .btn:active,:skin .meet-btn:active{transform:translate(4px,4px);box-shadow:0 0 0 #000}
      :skin .btn.primary,:skin .meet-btn{background:${p.accent}!important}
      :skin .gl:hover,:skin .pl-card:hover,:skin .th-card:hover{transform:translate(-2px,-2px)!important;box-shadow:7px 7px 0 #000!important}
      :skin .glance .gl:nth-child(4n+1),:skin .dw-stats .gl:nth-child(4n+1){background:#ffc5c8!important} :skin .glance .gl:nth-child(4n+2),:skin .dw-stats .gl:nth-child(4n+2){background:#b9e2f8!important}
      :skin .glance .gl:nth-child(4n+3),:skin .dw-stats .gl:nth-child(4n+3){background:#b9e7de!important} :skin .glance .gl:nth-child(4n+4),:skin .dw-stats .gl:nth-child(4n+4){background:#bc98cb!important}
      :skin .gl .v{font-family:"Lexend Mega",sans-serif;font-weight:800}
      :skin .side{border-right:3px solid #000}
      :skin .nav a{border:3px solid transparent;border-radius:6px} :skin .nav a.on{background:#fff;border-color:#000;box-shadow:3px 3px 0 #000;color:#000} :skin .nav a.on .ic{color:#000}
      :skin .space-sw{background:#fff;border:3px solid #000;border-radius:8px;box-shadow:3px 3px 0 #000} :skin .space-sw i{background:${p.accent};border:2px solid #000;box-shadow:none;border-radius:5px}
      :skin .chip{border:2px solid #000;background:#fff;color:#000;border-radius:5px;padding:2px 8px;gap:5px;line-height:1.35;font-weight:600;font-size:11.5px} :skin .chip.over{background:#ffc5c8;color:#000}
      :skin .chip.due{color:#000} :skin .chip.due.today{background:#b9e7de} :skin .chip.due.soon{background:#fdfd96} :skin .chip.client-owned{background:#ffe3b3} :skin .chip.dev-owned{background:${p.soft};color:#000}
      :skin .t-meta{gap:7px;margin-top:7px} :skin .task{padding:12px 8px;gap:14px} :skin .t-title{font-size:15px}
      :skin .glance,:skin .stats{gap:18px!important} :skin .stats{margin-bottom:26px} :skin .qa{margin:6px 0 26px}
      :skin .group{margin-bottom:22px} :skin .group-h{padding-bottom:9px;margin-bottom:10px}
      :skin .cols{gap:34px}
      :skin .c-hero h1{font-size:clamp(24px,3vw,34px);line-height:1.15;gap:14px}
      :skin .c-hero .sub .chip{font-size:12px;padding:3px 9px}
      :skin .c-hero .head{flex-direction:column;gap:18px} :skin .c-hero .head .actions{order:-1;align-self:flex-end;justify-content:flex-end;gap:12px;margin-bottom:-58px;padding-top:0!important;max-width:60%} :skin .c-hero .actions .btn{padding:7px 14px}
      :skin .c-hero h1{padding-top:64px}
      :skin .playbook{gap:8px;margin:6px 0 22px} :skin .playbook .chip{background:#fff}
      :skin .check{border:2.5px solid #000;border-radius:5px} :skin .task.done .check,:skin .dw-task.done .check{background:#40d39c;border-color:#000}
      :skin .task:hover{background:rgba(255,255,255,.55)}
      :skin .group-h{font-family:"Lexend Mega",sans-serif;font-weight:800;letter-spacing:-.04em;color:#000;border-bottom:3px solid #000}
      :skin .inp{border:3px solid #000;border-radius:6px;background:#fff}
      :skin .isl-pill{background:#fff!important;border:3px solid #000;box-shadow:4px 4px 0 #000!important;--isl-fg:#000;--isl-sub:#2b2b2b}
      :skin .isl-pill.up{background:${p.accent}!important}
      :skin .pb-card::before,:skin .pb-detail::before{display:none} :skin .pl-ic{border:2.5px solid #000;box-shadow:3px 3px 0 #000}
      :skin .dw-note{box-shadow:none;border-radius:0}
      :skin ::selection{background:${p.accent};color:#000}` });
  neo('neobrutalism', 'Neo-Brutal', 'Thick borders, hard shadows, sunny yellow (after NeoBrutalismCSS).', { bg: '#fdfd96', side: '#b9e7de', accent: '#ff7a59', soft: '#ffd9cc' });
  neo('neobrutalism-sky', 'Neo-Brutal Sky', 'The same punch on a sky-blue page with pink buttons.', { bg: '#b9e2f8', side: '#fdfd96', accent: '#ff8fab', soft: '#ffd6e0' });

  /* ============================ CRAZY ============================ */
  R({ id: 'crt', name: 'CRT', category: 'Crazy', tagline: 'Amber phosphor on a dying monitor: scanlines, flicker, rolling bar.',
    fonts: [{ family: 'VT323', src: V + 'fonts/vt323-latin-400-normal.woff2' }],
    font: 'VT323, monospace',
    vars: { '--ambient': 'off', '--bg': '#0d0802', '--panel': '#140c03', '--side': '#0a0601', '--text': '#ffb000', '--muted': '#c98a00', '--faint': '#7a5400', '--line': '#4a3300', '--hover': 'rgba(255,176,0,.08)', '--accent': '#ffb000', '--accent-soft': '#2a1d00', '--danger': '#ff5a36', '--ok': '#ffd060', '--client': '#ffe08a', '--client-soft': '#2a2208', '--shadow': 'none', '--on-accent': '#140c03' },
    css: `${flat} :skin body{font-size:19px;${GLOW('#ffb000')}} :skin *{border-radius:0!important}
      :skin .app{border-radius:28px;overflow:hidden;box-shadow:inset 0 0 120px rgba(0,0,0,.9)}
      :skin .gl,:skin .stat,:skin .qa,:skin .dw-qa,:skin .pl-card,:skin .db-item:not(.bare),:skin .modal{border:1px solid var(--line);box-shadow:none}
      :skin .nav a.on{background:#ffb000;color:#140c03;text-shadow:none} :skin .nav a.on .ic,:skin .nav a.on .n{color:#140c03}`,
    effects({ layer, level }) {
      layer.innerHTML = `<div style="position:absolute;inset:0;background:repeating-linear-gradient(rgba(0,0,0,.28) 0 1px,transparent 1px 3px)"></div>
        <div style="position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.65) 100%)"></div>
        ${level === 'full' ? `<div class="crt-roll" style="position:absolute;left:0;right:0;height:18vh;background:linear-gradient(transparent,rgba(255,176,0,.06),transparent);animation:crtroll 7s linear infinite"></div>
        <div style="position:absolute;inset:0;background:rgba(255,176,0,.025);animation:crtflick .12s steps(2) infinite"></div>` : ''}
        <style>@keyframes crtroll{from{top:-20vh}to{top:110vh}}@keyframes crtflick{50%{opacity:.4}}</style>`;
      // every so often the whole screen jolts
      const jolt = level === 'full' ? setInterval(() => { const a = document.querySelector('.app'); if (!a || document.hidden) return; a.animate([{ transform: 'translateX(0)', filter: 'none' }, { transform: 'translateX(-3px) skewX(1deg)', filter: 'brightness(1.4)' }, { transform: 'translateX(2px)' }, { transform: 'none', filter: 'none' }], { duration: 180 }); }, 9000) : 0;
      return () => clearInterval(jolt);
    } });

  R({ id: 'matrix', name: 'Matrix', category: 'Crazy', tagline: 'Digital rain behind everything. Wake up.',
    vars: { '--ambient': 'off', '--bg': '#000', '--panel': 'rgba(0,12,4,.86)', '--side': 'rgba(0,8,2,.86)', '--text': '#c8ffd6', '--muted': '#4fd27a', '--faint': '#1f7a3c', '--line': 'rgba(0,255,90,.22)', '--hover': 'rgba(0,255,90,.08)', '--accent': '#00ff5a', '--accent-soft': 'rgba(0,255,90,.12)', '--danger': '#ff4d4d', '--ok': '#00ff5a', '--client': '#d6ff4d', '--client-soft': 'rgba(214,255,77,.1)', '--shadow': '0 0 20px rgba(0,255,90,.12)', '--on-accent': '#001a08', '--mono': '"JetBrains Mono", monospace' },
    font: '"JetBrains Mono", ui-monospace, monospace',
    css: `${flat} :skin .app{position:relative;z-index:1} :skin .main{background:transparent}
      :skin .wrap{background:rgba(0,10,3,.78);min-height:100%;box-shadow:0 0 0 1px rgba(0,255,90,.15)}
      :skin .head h1{color:#00ff5a;text-shadow:0 0 12px rgba(0,255,90,.7)}`,
    effects({ layer, level }) {
      layer.style.zIndex = '0';
      const cv = document.createElement('canvas'); layer.appendChild(cv);
      const ctx = cv.getContext('2d'), chars = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉ0123456789TODO✓', fs = 16;
      let drops = [], raf = 0, last = 0;
      const size = () => { cv.width = innerWidth; cv.height = innerHeight; drops = Array.from({ length: Math.ceil(innerWidth / fs) }, () => Math.random() * -50); };
      size(); addEventListener('resize', size);
      const step = ts => {
        raf = requestAnimationFrame(step);
        if (document.hidden || ts - last < (level === 'full' ? 45 : 90)) return; last = ts;
        ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.font = fs + 'px monospace';
        drops.forEach((y, i) => {
          ctx.fillStyle = Math.random() < 0.04 ? '#e8ffe8' : '#00c845';
          ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * fs, y * fs);
          drops[i] = y * fs > cv.height && Math.random() > 0.975 ? 0 : y + 1;
        });
      };
      raf = requestAnimationFrame(step);
      return () => { cancelAnimationFrame(raf); removeEventListener('resize', size); };
    } });

  R({ id: 'geocities', name: 'GeoCities', category: 'Crazy', tagline: 'Welcome to my homepage!!! Under construction, sparkles, a hit counter.',
    fonts: [{ family: 'Comic Neue', src: V + 'fonts/comic-neue-latin-400-normal.woff2' }, { family: 'Comic Neue', src: V + 'fonts/comic-neue-latin-700-normal.woff2', weight: 700 }],
    font: '"Comic Neue", "Comic Sans MS", cursive',
    vars: { '--ambient': 'off', '--bg': '#000033', '--panel': '#ffffff', '--side': '#000080', '--text': '#000', '--muted': '#333', '--faint': '#777', '--line': '#ff00ff', '--hover': '#ffff9944', '--accent': '#0000ee', '--accent-soft': '#ccccff', '--danger': '#ff0000', '--ok': '#008000', '--client': '#ff6600', '--client-soft': '#ffe0cc', '--shadow': '4px 4px 0 #ff00ff' },
    preview: { bg: '#000033', panel: '#fff', side: '#000080', text: '#000', accent: '#ff00ff', line: '#ff00ff', r: '0' },
    css: `:skin body{background:radial-gradient(1px 1px at 10px 20px,#fff,transparent),radial-gradient(1px 1px at 60px 70px,#fff,transparent),radial-gradient(2px 2px at 120px 30px,#ffff99,transparent),radial-gradient(1px 1px at 160px 120px,#fff,transparent),#000033;background-size:180px 160px;font-size:15px}
      :skin .main{background:transparent} :skin *{border-radius:0!important}
      :skin .side{--text:#ffff00;--muted:#00ffff;--faint:#99ccff;--hover:#0000cc;border-right:4px ridge #c0c0c0}
      :skin .wrap{background:#fff;border:6px ridge #c0c0c0;margin:20px auto 40px;padding-top:70px;position:relative}
      :skin .wrap::before{content:'🚧 UNDER CONSTRUCTION 🚧';position:absolute;top:0;left:0;right:0;height:34px;display:grid;place-items:center;font:700 16px "Comic Neue";color:#000;background:repeating-linear-gradient(45deg,#ffd400 0 18px,#000 18px 36px);text-shadow:0 0 4px #ffd400,0 0 4px #ffd400,0 0 8px #ffd400}
      :skin .head h1{font-size:34px;background:linear-gradient(90deg,red,orange,yellow,lime,cyan,blue,magenta,red);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:georain 2s linear infinite;font-weight:700}
      @keyframes georain{to{background-position:200% 0}}
      :skin .chip.over{animation:geoblink 1s steps(1) infinite;font-weight:700} @keyframes geoblink{50%{visibility:hidden}}
      :skin .wrap a,:skin .site-link{color:#0000ee;text-decoration:underline}
      :skin .nav a.on{background:#ff00ff;color:#fff} :skin .meet-btn{background:#ffff00!important;color:#000!important}
      :skin .btn{background:#c0c0c0;border:3px outset #fff;color:#000;font-weight:700}
      :skin .btn:active{border-style:inset}
      :skin .gl,:skin .stat,:skin .qa,:skin .dw-qa,:skin .pl-card,:skin .db-item:not(.bare){border:3px double #ff00ff}
      :skin .isl-pill{background:#000!important;--isl-fg:#ffff00;--isl-sub:#00ffff;box-shadow:0 0 0 3px #ff00ff!important}
      @media (prefers-reduced-motion:reduce){:skin .head h1,:skin .chip.over{animation:none}}`,
    effects({ layer, level }) {
      let n = 0; try { n = +(localStorage.getItem('cadence.geo.hits') || 1337) + 1; localStorage.setItem('cadence.geo.hits', n); } catch (e) { n = 1338; }
      layer.innerHTML = `<div style="position:absolute;right:14px;bottom:14px;background:#000;color:#0f0;font:700 13px monospace;padding:4px 8px;border:2px inset #c0c0c0">You are visitor #<span style="letter-spacing:2px;background:#111;padding:0 4px">${String(n).padStart(8, '0')}</span></div>
        <div style="position:absolute;left:0;right:0;bottom:0;height:22px;background:#000080;color:#ffff00;font:700 13px/22px 'Comic Neue';white-space:nowrap;overflow:hidden"><span style="display:inline-block;padding-left:100%;animation:geomq 18s linear infinite">★ Welcome to my Cadence homepage!!! ★ Sign my guestbook ★ Best viewed in Netscape Navigator at 800×600 ★ Don't forget to finish your tasks ★</span></div>
        <style>@keyframes geomq{to{transform:translateX(-100%)}}@keyframes geosp{to{transform:translateY(26px) scale(0) rotate(180deg);opacity:0}}</style>`;
      // sparkle trail behind the cursor
      const colors = ['#ff00ff', '#ffff00', '#00ffff', '#ff6600', '#fff'];
      let lastT = 0;
      const move = e => {
        if (performance.now() - lastT < (level === 'full' ? 30 : 90)) return; lastT = performance.now();
        const s = document.createElement('span'); s.textContent = '✦';
        s.style.cssText = `position:absolute;left:${e.clientX - 6}px;top:${e.clientY - 8}px;color:${colors[Math.floor(Math.random() * colors.length)]};font-size:${10 + Math.random() * 10}px;animation:geosp .8s ease-out forwards;pointer-events:none`;
        layer.appendChild(s); setTimeout(() => s.remove(), 820);
      };
      addEventListener('pointermove', move, { passive: true });
      return () => removeEventListener('pointermove', move);
    } });

  // augmented-ui: clipped corners + neon inlays on cards (tagged as Cadence re-renders)
  R({ id: 'cyberpunk', name: 'Cyberpunk', category: 'Crazy', tagline: 'Neon yellow, clipped corners (augmented-ui), glitching headlines.',
    stylesheets: [V + 'augmented-ui/augmented-ui.min.css'],
    vars: { '--bg': '#0b0b12', '--panel': '#12121c', '--side': '#08080d', '--text': '#e8f9ff', '--muted': '#7fd6e6', '--faint': '#3c6d78', '--line': '#2b2b3d', '--hover': 'rgba(252,238,10,.07)', '--accent': '#fcee0a', '--accent-soft': 'rgba(252,238,10,.12)', '--danger': '#ff2a6d', '--danger-soft': 'rgba(255,42,109,.14)', '--ok': '#05d9e8', '--client': '#ff2a6d', '--client-soft': 'rgba(255,42,109,.12)', '--shadow': 'none', '--on-accent': '#0b0b12' },
    font: '"JetBrains Mono", ui-monospace, monospace',
    css: `${flat} :skin .head h1{text-transform:uppercase;letter-spacing:.08em;color:#fcee0a;position:relative;text-shadow:2px 0 #ff2a6d,-2px 0 #05d9e8;animation:cyglitch 4s steps(1) infinite}
      @keyframes cyglitch{0%,93%{clip-path:none;transform:none}94%{clip-path:inset(20% 0 50% 0);transform:translateX(-4px)}96%{clip-path:inset(60% 0 10% 0);transform:translateX(4px)}98%{clip-path:none;transform:translateX(-1px)}}
      @media (prefers-reduced-motion:reduce){:skin .head h1{animation:none}}
      :skin [data-augmented-ui]{--aug-border-bg:#fcee0a;--aug-border-all:1px;--aug-tl:12px;--aug-br:12px;--aug-inlay-bg:transparent;border:0!important;box-shadow:none!important;border-radius:0!important}
      :skin .btn.primary[data-augmented-ui]{--aug-border-bg:#fcee0a;background:#fcee0a}
      :skin .nav a.on{background:#fcee0a;color:#0b0b12} :skin .nav a.on .ic,:skin .nav a.on .n{color:#0b0b12}
      :skin .side{border-right:1px solid #fcee0a33}
      :skin .main{background:linear-gradient(rgba(252,238,10,.03) 1px,transparent 1px) 0 0/100% 4px}`,
    enhance() {
      const SEL = '.gl,.stat,.qa,.modal,.pl-card,.th-card,.btn.primary,.task.open,.pop';
      const tag = root => root.querySelectorAll && root.querySelectorAll(SEL).forEach(e => { if (!e.hasAttribute('data-augmented-ui')) e.setAttribute('data-augmented-ui', 'tl-clip br-clip border'); });
      tag(document);
      let q = 0; const mo = new MutationObserver(() => { cancelAnimationFrame(q); q = requestAnimationFrame(() => tag(document)); });
      mo.observe(document.body, { childList: true, subtree: true });
      return () => { mo.disconnect(); document.querySelectorAll('[data-augmented-ui]').forEach(e => e.removeAttribute('data-augmented-ui')); };
    } });

  // css-doodle: a living generative background
  R({ id: 'doodle-party', name: 'Doodle Party', category: 'Crazy', tagline: 'A generative confetti background that never repeats (css-doodle).',
    scripts: [V + 'css-doodle/css-doodle.min.js'],
    vars: { '--bg': '#fff8ef', '--panel': 'rgba(255,255,255,.9)', '--side': 'rgba(255,250,242,.88)', '--text': '#1f1a3a', '--muted': '#6b6290', '--faint': '#aaa3c8', '--line': '#ecdcff', '--hover': 'rgba(124,77,255,.07)', '--accent': '#7c4dff', '--accent-soft': '#efe7ff', '--danger': '#ff4f6d', '--ok': '#1ec28b', '--client': '#ff9f1c', '--client-soft': '#fff0db', '--shadow': '0 10px 30px rgba(124,77,255,.15)' },
    preview: { bg: '#ffe9f2', panel: '#fff', side: '#fff6e8', text: '#1f1a3a', accent: '#7c4dff', line: '#ecdcff', r: '14px' },
    css: `:skin .app{position:relative;z-index:1} :skin .main{background:transparent} :skin body{background:#fff8ef}
      :skin .wrap{background:rgba(255,255,255,.82);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);border-radius:24px;margin:24px auto 40px;box-shadow:var(--shadow)}
      :skin .side{-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
      :skin .head h1{background:linear-gradient(90deg,#7c4dff,#ff4f6d,#ff9f1c);-webkit-background-clip:text;background-clip:text;color:transparent}`,
    effects({ layer, level }) {
      layer.style.zIndex = '0';
      const make = () => {
        if (!customElements.get('css-doodle')) return setTimeout(make, 150);
        layer.innerHTML = `<css-doodle style="position:absolute;inset:0;width:100vw;height:100vh">
          @grid: ${level === 'full' ? 9 : 6} / 100vw 100vh;
          :doodle { overflow: hidden; }
          background: @p(#7c4dff, #ff4f6d, #ff9f1c, #1ec28b, #3ab7ff, #ffd23f);
          opacity: @r(.18, .5);
          margin: auto;
          @size: @r(18px, 90px);
          border-radius: @p(50%, 0, 50% 0, 0 50%, 30% 70% 70% 30% / 30% 30% 70% 70%);
          transform: translate(@r(-60%, 60%), @r(-60%, 60%)) rotate(@r(360deg)) scale(@r(.4, 1.1));
          ${level === 'full' ? 'animation: f @r(8s, 20s) ease-in-out infinite alternate; @keyframes f { to { transform: translate(@r(-80%, 80%), @r(-80%, 80%)) rotate(@r(-360deg, 360deg)) scale(@r(.3, 1.2)); } }' : ''}
        </css-doodle>`;
      };
      make();
      const re = setInterval(() => { const d = layer.querySelector('css-doodle'); if (d && d.update && !document.hidden) d.update(); }, level === 'full' ? 12000 : 30000);
      return () => clearInterval(re);
    } });
})();
