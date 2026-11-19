/* Games, film and TV, and old-tech brand themes (user, 2026-11-18: "all of them"). The look is CSS; the pictures are
   the real ones, shown as they are and credited: stills from TMDB (t.tmdb), fanart and title logos from TheGamesDB
   (t.game), and each brand's logo from its own site (t.site). Nothing here draws a character or a logo, or quotes a line. */
(() => {
  const T = window.CadenceThemes; if (!T) return;
  const R = t => T.register({ ...t, vars: { '--ambient': 'off', ...t.vars } });
  const V = 'vendor/themes/fonts/';
  const F = (family, file, weight = 400) => ({ family, src: V + file, weight });
  const OSWALD = F('Oswald', 'oswald-latin-600-normal.woff2', 600), PLEX = F('IBM Plex Sans', 'ibm-plex-sans-latin-400-normal.woff2'), PLEXB = F('IBM Plex Sans', 'ibm-plex-sans-latin-700-normal.woff2', 700);
  const glass = `:skin .app,:skin .main{background:transparent}`;
  const pal = (bg, panel, side, text, muted, accent, onAccent, line, r = '10px', more = {}) => ({ '--bg': bg, '--panel': panel, '--side': side, '--text': text, '--muted': muted, '--faint': more.faint || muted,
    '--line': line, '--hover': more.hover || 'color-mix(in srgb,var(--text) 6%,transparent)', '--accent': accent, '--accent-soft': `color-mix(in srgb,${accent} 16%,transparent)`, '--on-accent': onAccent, '--r': r, ...more });

  /* ---------------- Games ---------------- */
  R({ id: 'csgo', name: 'CS:GO', category: 'Games', site: 'counter-strike.net', game: { title: 'Counter-Strike: Global Offensive' },
    tagline: 'Dust II sandstone and a radar-green sidebar. Fanart from TheGamesDB behind it.',
    fonts: [F('Rajdhani', 'rajdhani-latin-500-normal.woff2', 500), F('Rajdhani', 'rajdhani-latin-700-normal.woff2', 700)], font: 'Rajdhani,system-ui,sans-serif',
    vars: pal('#2a2620', 'rgba(36,33,28,.9)', '#141a14', '#efe6d2', '#b9ae96', '#e5a823', '#1d1300', 'rgba(239,230,210,.14)', '2px', { '--client': '#7fd36b' }),
    preview: { bg: 'linear-gradient(180deg,#c8a971,#8a6d43)', panel: '#24211c', side: '#141a14', text: '#efe6d2', accent: '#e5a823', line: '#4a4335', r: '2px' },
    css: `${glass}:skin body{background:linear-gradient(180deg,#3b3326,#2a2620 60%)}
      :skin .side{background:radial-gradient(circle at 50% 30%,rgba(127,211,107,.08),transparent 60%),repeating-radial-gradient(circle at 50% 30%,transparent 0 38px,rgba(127,211,107,.07) 39px 40px),#141a14}
      :skin .head h1{text-transform:uppercase;letter-spacing:.06em;font-weight:700}:skin .task{border-radius:2px}` });
  R({ id: 'half-life', name: 'Half-Life', category: 'Games', site: 'half-life.com', game: { title: 'Half-Life 2' },
    tagline: 'The HEV suit HUD: amber readouts on dark glass, with fanart from TheGamesDB.',
    fonts: [F('Share Tech Mono', 'share-tech-mono-latin-400-normal.woff2')], font: '"IBM Plex Sans",system-ui,sans-serif',
    vars: pal('#16130d', 'rgba(28,24,16,.88)', '#0e0c08', '#ffe2a6', '#c9a96a', '#ff9d1c', '#1a0e00', 'rgba(255,157,28,.22)', '4px'),
    preview: { bg: 'linear-gradient(160deg,#3a2b14,#16130d)', panel: '#1c1810', side: '#0e0c08', text: '#ffe2a6', accent: '#ff9d1c', line: '#4d3a1a', r: '4px' },
    css: `${glass}:skin .head h1,:skin .ntile .tl,:skin .t-meta{font-family:"Share Tech Mono",monospace}
      :skin .head h1{color:#ffb84a;text-shadow:0 0 12px rgba(255,157,28,.45);letter-spacing:.04em}
      :skin .task,:skin .card{border:1px solid rgba(255,157,28,.28);box-shadow:inset 0 0 0 1px rgba(0,0,0,.4)}` });
  R({ id: 'portal', name: 'Portal', category: 'Games', site: 'thinkwithportals.com', game: { title: 'Portal 2' },
    tagline: 'A clean white test chamber: panelled walls, and the two portal colours, blue and orange. Fanart from TheGamesDB.',
    vars: pal('#e9ecef', 'rgba(250,251,252,.94)', '#dde2e7', '#20262c', '#56616c', '#1e86d8', '#fff', 'rgba(32,38,44,.13)', '6px', { '--client': '#f08a1c' }),
    preview: { bg: 'repeating-linear-gradient(0deg,#e9ecef 0 46px,#cfd5db 46px 48px)', panel: '#fafbfc', side: '#dde2e7', text: '#20262c', accent: '#1e86d8', line: '#c4ccd4', r: '6px' },
    css: `${glass}:skin body{background:repeating-linear-gradient(0deg,transparent 0 118px,rgba(32,38,44,.06) 118px 120px),repeating-linear-gradient(90deg,transparent 0 118px,rgba(32,38,44,.06) 118px 120px),#e9ecef}
      :skin .btn.primary{box-shadow:0 0 0 2px rgba(30,134,216,.25),0 0 14px rgba(30,134,216,.35)}:skin .task:hover{box-shadow:inset 3px 0 0 #f08a1c}` });
  // Steam (user's backlog, 2026-11-18): the desktop client's library. Navy-to-slate gradient, light-blue links, the
  // green Play button, and the logo from Steam's own site. No game fanart: it's the launcher, not one game.
  R({ id: 'steam', name: 'Steam', category: 'Games', site: 'store.steampowered.com',
    tagline: 'The Steam library: deep navy, steel-blue panels, light-blue links and the green Play button.',
    font: 'Arial,"Helvetica Neue",Helvetica,system-ui,sans-serif',
    vars: pal('#1b2838', '#16202d', '#171d25', '#c7d5e0', '#8f98a0', '#66c0f4', '#0e1a26', 'rgba(102,192,244,.16)', '3px',
      { '--faint': '#6b7682', '--hover': 'rgba(102,192,244,.08)', '--client': '#a4d007', '--ok': '#a4d007', '--accent-soft': 'rgba(102,192,244,.14)' }),
    preview: { bg: 'linear-gradient(180deg,#2a475e,#1b2838 70%)', panel: '#16202d', side: '#171d25', text: '#c7d5e0', accent: '#66c0f4', line: '#2a3f5a', r: '3px' },
    css: `${glass}:skin body{background:radial-gradient(ellipse at 70% -10%,rgba(102,192,244,.16),transparent 55%),linear-gradient(180deg,#2a475e 0,#1b2838 340px,#1b2838)}
      :skin .side{background:linear-gradient(180deg,#23262e,#171d25 70%);border-right:1px solid #0e141b}
      :skin .head h1{text-transform:uppercase;letter-spacing:.04em;font-weight:700;color:#fff}
      :skin .ntile.on,:skin #side .nav a.on{background:linear-gradient(90deg,rgba(102,192,244,.22),rgba(102,192,244,.06));color:#fff}
      :skin .task{border-radius:2px;background:linear-gradient(90deg,rgba(32,47,65,.85),rgba(22,32,45,.85))}
      :skin .task:hover{background:linear-gradient(90deg,rgba(62,90,118,.75),rgba(32,47,65,.85))}
      :skin .card,:skin .modal{background:linear-gradient(180deg,#1e2c3d,#16202d);border:1px solid rgba(0,0,0,.35);box-shadow:0 2px 12px rgba(0,0,0,.35)}
      :skin a{color:#66c0f4}
      :skin .btn{border-radius:2px;background:rgba(103,193,245,.2);color:#66c0f4;border:0}:skin .btn:hover{background:#66c0f4;color:#fff}
      :skin .btn.primary{background:linear-gradient(90deg,#75b022 5%,#588a1b 95%);color:#d2efa9;text-shadow:0 1px 0 rgba(0,0,0,.25);border:0}
      :skin .btn.primary:hover{background:linear-gradient(90deg,#8ed629 5%,#6aa621 95%);color:#fff}
      :skin .qa{background:rgba(14,20,27,.6);border:1px solid #2a3f5a;border-radius:3px}
      :skin .chip{background:rgba(103,193,245,.08);color:#9fd4f5;border-radius:2px}` });
  R({ id: 'borderlands', name: 'Borderlands', category: 'Games', site: 'borderlands.com', game: { title: 'Borderlands 2' },
    tagline: 'Cel-shaded: thick black ink lines around everything, sun-baked yellows. Fanart from TheGamesDB.',
    fonts: [F('Anton', 'anton-latin-400-normal.woff2')],
    vars: pal('#f2d36b', '#fff6d8', '#2b2116', '#1a1410', '#5a4a33', '#d2461f', '#fff', '#1a1410', '6px', { '--faint': '#7a6a52', '--hover': 'rgba(26,20,16,.06)' }),
    preview: { bg: 'linear-gradient(160deg,#f6dd7a,#e0a83a)', panel: '#fff6d8', side: '#2b2116', text: '#1a1410', accent: '#d2461f', line: '#1a1410', r: '6px' },
    css: `${glass}:skin body{background:linear-gradient(160deg,#f6dd7a,#e0a83a)}
      :skin .side{--text:#fff1cc;--muted:#e3cf9e;color:#fff1cc}
      :skin .task,:skin .card,:skin .btn,:skin #qa,:skin .modal{border:3px solid #1a1410!important;box-shadow:4px 4px 0 #1a1410}
      :skin .head h1{font-family:Anton,Impact,sans-serif;text-transform:uppercase;letter-spacing:.02em;font-size:40px;-webkit-text-stroke:1px #1a1410}` });
  R({ id: 'vice-city', name: 'Vice City', category: 'Games', site: 'rockstargames.com', game: { title: 'Grand Theft Auto: Vice City' },
    tagline: 'Pink and teal neon over a Miami sunset, 1986. Fanart from TheGamesDB.',
    fonts: [F('Fredoka', 'fredoka-latin-600-normal.woff2', 600)],
    vars: pal('#1c0f2b', 'rgba(36,18,52,.86)', 'rgba(20,9,32,.9)', '#fdeefc', '#d6b3dd', '#ff4fb3', '#26001a', 'rgba(255,79,179,.22)', '12px', { '--client': '#2ee6d6' }),
    preview: { bg: 'linear-gradient(180deg,#ff8a5c,#ff4fb3 45%,#3a1556 75%,#1c0f2b)', panel: '#241234', side: '#140920', text: '#fdeefc', accent: '#ff4fb3', line: '#5b2a6e' },
    css: `${glass}:skin body{background:radial-gradient(500px 220px at 70% 105%,rgba(255,138,92,.55),transparent 70%),linear-gradient(180deg,#2b1240,#1c0f2b 70%);background-attachment:fixed}
      :skin .head h1{font-family:Fredoka,system-ui,sans-serif;color:#ff6cc2;text-shadow:0 0 6px #ff4fb3,0 0 20px rgba(255,79,179,.6),3px 3px 0 #2ee6d6}` });

  /* ---------------- Film and TV (stills from TMDB) ---------------- */
  R({ id: 'severance', name: 'Severance', category: 'Movie & TV', tmdb: { type: 'tv', title: 'Severance', year: 2022 },
    tagline: 'A very calm office: pale green-blue walls, a tidy grid, soft fluorescent light. Stills from TMDB.',
    fonts: [PLEX, PLEXB], font: '"IBM Plex Sans",system-ui,sans-serif',
    vars: pal('#dfe8e6', 'rgba(246,249,248,.94)', '#cfdcd9', '#1f2b2a', '#566664', '#2e7d74', '#fff', 'rgba(31,43,42,.12)', '3px'),
    preview: { bg: 'linear-gradient(180deg,#eef3f2,#cfdcd9)', panel: '#f6f9f8', side: '#cfdcd9', text: '#1f2b2a', accent: '#2e7d74', line: '#bccbc8', r: '3px' },
    css: `${glass}:skin body{background:linear-gradient(180deg,rgba(255,255,255,.55),transparent 120px),#dfe8e6}:skin .head h1{font-weight:400;letter-spacing:.02em}` });
  R({ id: 'blade-runner', name: 'Blade Runner 2049', category: 'Movie & TV', tmdb: { type: 'movie', title: 'Blade Runner 2049', year: 2017 },
    tagline: 'Orange haze over a ruined city, and teal rain at night. Stills from TMDB.',
    fonts: [OSWALD],
    vars: pal('#2a160c', 'rgba(42,24,14,.84)', 'rgba(20,10,6,.9)', '#ffe6cf', '#d4a986', '#ff8a3d', '#1e0b00', 'rgba(255,138,61,.2)', '2px', { '--client': '#4fd1c5' }),
    preview: { bg: 'linear-gradient(180deg,#e0874a,#7a3a1a 60%,#2a160c)', panel: '#2a180e', side: '#140a06', text: '#ffe6cf', accent: '#ff8a3d', line: '#5a3220', r: '2px' },
    css: `${glass}:skin body{background:radial-gradient(1200px 500px at 50% 0%,rgba(224,135,74,.55),transparent 70%),#2a160c;background-attachment:fixed}
      :skin .head h1{font-family:Oswald,Impact,sans-serif;text-transform:uppercase;letter-spacing:.22em;font-weight:600}` });
  R({ id: 'dune', name: 'Dune', category: 'Movie & TV', tmdb: { type: 'movie', title: 'Dune', year: 2021 },
    tagline: 'Endless dunes in pale gold and dust, and a wide, quiet sky. Stills from TMDB.',
    fonts: [F('Cinzel', 'cinzel-latin-500-normal.woff2', 500)],
    vars: pal('#e7d6b8', 'rgba(247,239,224,.9)', '#d7c29d', '#2c2116', '#6a5539', '#a4602a', '#fff', 'rgba(44,33,22,.14)', '2px'),
    preview: { bg: 'linear-gradient(180deg,#f2e6cf,#c89f68 70%,#a4794a)', panel: '#f7efe0', side: '#d7c29d', text: '#2c2116', accent: '#a4602a', line: '#c7b08a', r: '2px' },
    css: `${glass}:skin body{background:radial-gradient(1400px 260px at 30% 100%,#c89f68 0 55%,transparent 56%),radial-gradient(1100px 220px at 85% 100%,#b88b58 0 60%,transparent 61%),linear-gradient(180deg,#f2e6cf,#e7d6b8);background-attachment:fixed}
      :skin .head h1{font-family:Cinzel,serif;letter-spacing:.3em;text-transform:uppercase;font-weight:500}` });
  R({ id: 'twin-peaks', name: 'Twin Peaks', category: 'Movie & TV', tmdb: { type: 'tv', title: 'Twin Peaks', year: 1990 },
    tagline: 'Red velvet curtains and a black-and-white zigzag floor. Stills from TMDB.',
    fonts: [F('Cormorant Garamond', 'cormorant-garamond-latin-600-normal.woff2', 600)],
    vars: pal('#3a0a0e', 'rgba(26,10,12,.9)', '#1a0709', '#f7e7e2', '#d1aaa5', '#e2b04a', '#1a1000', 'rgba(247,231,226,.14)', '4px'),
    preview: { bg: 'repeating-linear-gradient(90deg,#6b0f16 0 10px,#4a0a10 10px 20px)', panel: '#1a0a0c', side: '#1a0709', text: '#f7e7e2', accent: '#e2b04a', line: '#4a1a1e', r: '4px' },
    css: `${glass}:skin body{background:repeating-linear-gradient(90deg,#6b0f16 0 26px,#4f0b11 26px 40px,#5d0d14 40px 52px);background-attachment:fixed}
      :skin body::after{content:"";position:fixed;left:0;right:0;bottom:0;height:70px;z-index:-1;pointer-events:none;background:repeating-linear-gradient(135deg,#111 0 22px,#eee 22px 44px);opacity:.9;
        -webkit-mask:linear-gradient(transparent,#000 60%);mask:linear-gradient(transparent,#000 60%)}
      :skin .head h1{font-family:"Cormorant Garamond",serif;font-size:40px;color:#f0d9a0}` });
  R({ id: 'grand-budapest', name: 'The Grand Budapest Hotel', category: 'Movie & TV', tmdb: { type: 'movie', title: 'The Grand Budapest Hotel', year: 2014 },
    tagline: 'Pastel pink and lavender, everything centred and symmetrical, a little bakery box. Stills from TMDB.',
    fonts: [F('Cormorant Garamond', 'cormorant-garamond-latin-600-normal.woff2', 600)],
    vars: pal('#f4d6dc', 'rgba(255,246,247,.94)', '#e7c4d4', '#3b1f2b', '#6e4a5a', '#8a3a5c', '#fff', 'rgba(59,31,43,.14)', '4px', { '--client': '#6b5a9e' }),
    preview: { bg: 'linear-gradient(180deg,#f7dfe4,#e9b8c6)', panel: '#fff6f7', side: '#e7c4d4', text: '#3b1f2b', accent: '#8a3a5c', line: '#d9aab9', r: '4px' },
    css: `${glass}:skin body{background:linear-gradient(90deg,rgba(255,255,255,.25) 50%,transparent 50%) 0 0/48px 100%,#f4d6dc}
      :skin .head h1{font-family:"Cormorant Garamond",serif;text-align:center;letter-spacing:.12em;text-transform:uppercase;font-size:34px;color:#8a3a5c}
      :skin .task{border:1px solid #d9aab9}` });
  R({ id: 'stranger-things', name: 'Stranger Things', category: 'Movie & TV', tmdb: { type: 'tv', title: 'Stranger Things', year: 2016 },
    tagline: 'A small town in 1983: red neon titles on black, wood panelling, a string of coloured bulbs. Stills from TMDB.',
    fonts: [F('Source Serif 4', 'source-serif-4-latin-600-normal.woff2', 600)],
    vars: pal('#0d0b0b', 'rgba(24,18,16,.9)', '#140f0d', '#f2e4dc', '#bfa79a', '#e63b2e', '#fff', 'rgba(242,228,220,.13)', '6px'),
    preview: { bg: 'radial-gradient(circle at 50% 40%,#3a0c0a,#0d0b0b 70%)', panel: '#181210', side: '#140f0d', text: '#f2e4dc', accent: '#e63b2e', line: '#3a2a24', r: '6px' },
    css: `${glass}:skin .head h1{font-family:"Source Serif 4",Georgia,serif;font-weight:600;color:transparent;-webkit-text-stroke:1.5px #ff4a3a;text-shadow:0 0 10px rgba(255,60,40,.6),0 0 26px rgba(255,60,40,.35);letter-spacing:.04em;text-transform:uppercase}
      :skin .side{background:repeating-linear-gradient(90deg,#1c1410 0 18px,#191210 18px 20px)}
      :skin body::before{content:"";position:fixed;top:0;left:0;right:0;height:14px;z-index:30;pointer-events:none;background:radial-gradient(circle,#ff5050 0 3px,transparent 4px) 0 4px/60px 14px,radial-gradient(circle,#ffd84a 0 3px,transparent 4px) 20px 4px/60px 14px,radial-gradient(circle,#4ac0ff 0 3px,transparent 4px) 40px 4px/60px 14px;filter:drop-shadow(0 0 4px rgba(255,220,120,.8))}` });
  R({ id: 'kiki', name: "Kiki's Delivery Service", category: 'Studio Ghibli', site: 'ghibli.jp', tmdb: { type: 'movie', title: "Kiki's Delivery Service", year: 1989 },
    tagline: 'A seaside town in summer: terracotta roofs, sea blue, a red bow. Stills from TMDB.',
    fonts: [F('Nunito', 'nunito-latin-700-normal.woff2', 700)],
    vars: pal('#eaf3f6', 'rgba(255,255,255,.92)', '#d3e7ee', '#1f2d36', '#566a76', '#c8432b', '#fff', 'rgba(31,45,54,.12)', '14px', { '--client': '#2f7fa8' }),
    preview: { bg: 'linear-gradient(180deg,#bfe3f2,#eaf3f6 60%,#d98b5f)', panel: '#ffffff', side: '#d3e7ee', text: '#1f2d36', accent: '#c8432b', line: '#c2d8e0', r: '14px' },
    css: `${glass}:skin body{background:linear-gradient(180deg,#cfeaf5,#eaf3f6 40%);background-attachment:fixed}:skin .head h1{font-family:Nunito,system-ui,sans-serif}` });
  R({ id: 'howl', name: "Howl's Moving Castle", category: 'Studio Ghibli', site: 'ghibli.jp', tmdb: { type: 'movie', title: "Howl's Moving Castle", year: 2004 },
    tagline: 'Mountain meadows, a big sky, and the warm brass and soot of a walking castle. Stills from TMDB.',
    fonts: [F('Cormorant Garamond', 'cormorant-garamond-latin-600-normal.woff2', 600)],
    vars: pal('#e8efe2', 'rgba(252,250,244,.92)', '#d6e2cc', '#26301f', '#5b6852', '#b5762a', '#fff', 'rgba(38,48,31,.13)', '12px', { '--client': '#3f7fb5' }),
    preview: { bg: 'linear-gradient(180deg,#a9cdea,#e8efe2 55%,#8fb36b)', panel: '#fcfaf4', side: '#d6e2cc', text: '#26301f', accent: '#b5762a', line: '#c3d1b8', r: '12px' },
    css: `${glass}:skin body{background:radial-gradient(1400px 240px at 40% 100%,#8fb36b 0 55%,transparent 56%),linear-gradient(180deg,#b8d6ee,#e8efe2 50%);background-attachment:fixed}
      :skin .head h1{font-family:"Cormorant Garamond",serif;font-size:38px}` });
  R({ id: 'interstellar', name: 'Interstellar', category: 'Movie & TV', tmdb: { type: 'movie', title: 'Interstellar', year: 2014 },
    tagline: 'Deep space, a ring of light around a black hole, cornfield gold. Stills from TMDB.',
    vars: pal('#07080c', 'rgba(16,18,24,.86)', 'rgba(8,9,13,.92)', '#e9ecf2', '#a3a9b6', '#e4b866', '#1a1100', 'rgba(233,236,242,.12)', '8px'),
    preview: { bg: 'radial-gradient(circle at 60% 45%,#000 0 14%,#f4d08a 15% 17%,rgba(244,208,138,.2) 22%,#07080c 50%)', panel: '#101218', side: '#08090d', text: '#e9ecf2', accent: '#e4b866', line: '#262a33' },
    css: `${glass}:skin body{background:radial-gradient(260px 70px at 78% 18%,rgba(244,208,138,.35),transparent 70%),radial-gradient(60px 60px at 78% 18%,#000 60%,rgba(244,208,138,.8) 64%,transparent 72%),
        radial-gradient(1px 1px at 20% 30%,#fff,transparent),radial-gradient(1px 1px at 40% 70%,#fff,transparent),radial-gradient(1px 1px at 65% 50%,#fff,transparent),radial-gradient(1px 1px at 90% 80%,#fff,transparent),#07080c;background-attachment:fixed}
      :skin .head h1{font-weight:300;letter-spacing:.35em;text-transform:uppercase}` });
  R({ id: 'lotr', name: 'The Lord of the Rings', category: 'Movie & TV', tmdb: { type: 'movie', title: 'The Lord of the Rings: The Fellowship of the Ring', year: 2001 },
    tagline: 'Old maps and parchment, green hills, a glint of gold. Stills from TMDB.',
    fonts: [F('Cinzel', 'cinzel-latin-700-normal.woff2', 700), F('IM Fell English', 'im-fell-english-latin-400-normal.woff2')], font: '"IM Fell English",Georgia,serif',
    vars: pal('#efe3c6', 'rgba(250,243,226,.92)', '#2f3a26', '#2b2216', '#665538', '#9a6b17', '#fff', 'rgba(43,34,22,.16)', '4px', { '--faint': '#7f6d4f' }),
    preview: { bg: 'radial-gradient(circle at 30% 30%,#f7edd2,#e2cf9f)', panel: '#faf3e2', side: '#2f3a26', text: '#2b2216', accent: '#9a6b17', line: '#cdb88a', r: '4px' },
    css: `${glass}:skin body{background:radial-gradient(circle at 30% 20%,#f7edd2,#e6d5ab 80%);background-attachment:fixed}
      :skin .side{--text:#efe3c6;--muted:#c9bc98;color:#efe3c6}
      :skin .head h1{font-family:Cinzel,serif;font-weight:700;color:#6b4a10;letter-spacing:.08em}` });

  /* ---------------- Old tech and brands (logos from each brand's own site) ---------------- */
  R({ id: 'winamp', name: 'Winamp', category: 'Brands', site: 'winamp.com',
    tagline: 'Gunmetal panels, lime-green LCD text and bevelled buttons, like the 1998 media player.',
    fonts: [F('VT323', 'vt323-latin-400-normal.woff2')],
    vars: pal('#23232e', '#2e2e3c', '#191921', '#e8e8f0', '#a9a9bd', '#5bd85b', '#041204', '#4a4a5c', '2px', { '--client': '#e0c050' }),
    preview: { bg: '#23232e', panel: '#2e2e3c', side: '#191921', text: '#e8e8f0', accent: '#5bd85b', line: '#4a4a5c', r: '2px' },
    css: `:skin .head h1{font-family:VT323,monospace;font-size:40px;color:#5bd85b;background:#000;display:inline-block;padding:0 10px;border:2px inset #4a4a5c;text-shadow:0 0 6px rgba(91,216,91,.6)}
      :skin .task,:skin .card,:skin .btn{border:2px outset #4a4a5c;border-radius:0}:skin .btn:active{border-style:inset}` });
  R({ id: 'wii', name: 'Wii Menu', category: 'Brands', site: 'nintendo.com',
    tagline: 'Soft white and light grey, rounded channel tiles, a calm blue glow. Add the menu music yourself if you like.',
    fonts: [F('Nunito', 'nunito-latin-700-normal.woff2', 700)], font: 'Nunito,system-ui,sans-serif',
    vars: pal('#f3f4f6', '#ffffff', '#e7e9ed', '#3d434c', '#6b727d', '#29a8e0', '#fff', 'rgba(61,67,76,.12)', '18px'),
    preview: { bg: 'repeating-linear-gradient(0deg,#f3f4f6 0 4px,#ebedf0 4px 6px)', panel: '#ffffff', side: '#e7e9ed', text: '#3d434c', accent: '#29a8e0', line: '#d6dae0', r: '18px' },
    css: `${glass}:skin body{background:repeating-linear-gradient(0deg,#f3f4f6 0 4px,#eef0f3 4px 6px)}
      :skin .task,:skin .card{border-radius:18px;border:2px solid #d6dae0;box-shadow:0 2px 0 #d6dae0}:skin .task:hover{border-color:#29a8e0;box-shadow:0 0 0 3px rgba(41,168,224,.2)}` });
  R({ id: 'ps2', name: 'PS2', category: 'Brands', site: 'playstation.com',
    tagline: 'The boot screen: deep blue-black fog, slow glowing towers of light.',
    vars: pal('#05070f', 'rgba(12,16,30,.86)', 'rgba(5,7,15,.92)', '#e6ecff', '#9ba6c8', '#5c8dff', '#020615', 'rgba(230,236,255,.12)', '6px'),
    preview: { bg: 'radial-gradient(circle at 50% 70%,#1b2a66,#05070f 70%)', panel: '#0c101e', side: '#05070f', text: '#e6ecff', accent: '#5c8dff', line: '#1f2847', r: '6px' },
    css: `${glass}:skin body{background:radial-gradient(900px 400px at 50% 100%,rgba(40,70,180,.45),transparent 70%),#05070f;background-attachment:fixed}
      :skin body::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;
        background:linear-gradient(transparent 30%,rgba(120,160,255,.22)) 12% 100%/26px 46% no-repeat,linear-gradient(transparent 20%,rgba(120,160,255,.18)) 28% 100%/22px 62% no-repeat,linear-gradient(transparent 40%,rgba(120,160,255,.2)) 71% 100%/30px 38% no-repeat,linear-gradient(transparent 25%,rgba(120,160,255,.16)) 86% 100%/20px 55% no-repeat;filter:blur(2px)}` });
  R({ id: 'system7', name: 'System 7', category: 'Brands', site: 'apple.com',
    tagline: 'The 1991 Mac desktop: grey, crisp black lines, striped title bars, square windows.',
    fonts: [F('Sometype Mono', 'sometype-mono-latin-400-normal.woff2'), F('Sometype Mono', 'sometype-mono-latin-700-normal.woff2', 700)],
    vars: pal('#a8a8a8', '#ffffff', '#dddddd', '#000000', '#3a3a3a', '#3a3aa8', '#fff', '#000000', '0px', { '--faint': '#555', '--hover': '#e8e8e8' }),
    preview: { bg: 'repeating-conic-gradient(#a8a8a8 0 25%,#b8b8b8 0 50%) 0 0/4px 4px', panel: '#ffffff', side: '#dddddd', text: '#000000', accent: '#3a3aa8', line: '#000000', r: '0px' },
    css: `${glass}:skin body{background:repeating-conic-gradient(#a8a8a8 0 25%,#b4b4b4 0 50%) 0 0/4px 4px}
      :skin .head h1{font-family:"Sometype Mono",monospace;font-size:24px;font-weight:700;display:block;padding:2px 10px;background:repeating-linear-gradient(0deg,#fff 0 1px,#000 1px 2px);border:1px solid #000}
      :skin .task,:skin .card,:skin #qa{border:1px solid #000;border-radius:0;box-shadow:2px 2px 0 #000}` });
  R({ id: 'bandcamp', name: 'Bandcamp', category: 'Brands', site: 'bandcamp.com',
    tagline: 'Bandcamp’s clean white pages and that teal-blue, like browsing a label’s shop.',
    vars: pal('#ffffff', '#ffffff', '#f3f3f3', '#262626', '#5e5e5e', '#1da0c3', '#fff', '#e3e3e3', '4px'),
    preview: { bg: '#ffffff', panel: '#ffffff', side: '#f3f3f3', text: '#262626', accent: '#1da0c3', line: '#e3e3e3', r: '4px' },
    css: `:skin .head h1{font-weight:700;letter-spacing:-.01em}:skin a{color:#1da0c3}` });
})();
