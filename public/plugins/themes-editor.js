/* Editor themes: the colour palettes of popular, open-source code-editor themes (all MIT licensed),
   mapped onto Cadence's tokens. Palettes from each project's published spec. */
(() => {
  const R = t => window.CadenceThemes.register(t);
  // p: bg, side, panel, text, muted, faint, line, accent, on (text on accent), red, green, yellow, [extra css]
  const mk = (id, name, tagline, p, css = '') => R({ id, name, category: 'Editor', tagline,
    vars: { '--bg': p.bg, '--side': p.side, '--panel': p.panel, '--text': p.text, '--muted': p.muted, '--faint': p.faint, '--line': p.line,
      '--hover': `color-mix(in srgb, ${p.text} 7%, transparent)`, '--accent': p.accent, '--on-accent': p.on || '#fff',
      '--accent-soft': `color-mix(in srgb, ${p.accent} 18%, ${p.panel})`, '--danger': p.red, '--danger-soft': `color-mix(in srgb, ${p.red} 16%, ${p.panel})`,
      '--ok': p.green, '--client': p.yellow, '--client-soft': `color-mix(in srgb, ${p.yellow} 16%, ${p.panel})`,
      '--shadow': p.light ? '0 1px 2px rgba(0,0,0,.05),0 10px 28px rgba(0,0,0,.08)' : '0 1px 2px rgba(0,0,0,.3),0 12px 32px rgba(0,0,0,.35)' },
    preview: { bg: p.bg, panel: p.panel, side: p.side, text: p.text, accent: p.accent, line: p.line },
    css: ':skin .btn.primary{color:var(--on-accent)}' + css });

  mk('dracula', 'Dracula', 'The dark theme for everything. Purple, pink and green.',
    { bg: '#282a36', side: '#21222c', panel: '#2f3141', text: '#f8f8f2', muted: '#a4a8c6', faint: '#6272a4', line: '#44475a', accent: '#bd93f9', on: '#282a36', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c' },
    ':skin .head h1{color:#ff79c6} :skin .nav a.on .ic{color:#50fa7b} :skin .chip.today{color:#8be9fd}');
  mk('alucard', 'Alucard', 'Dracula’s official light sibling.',
    { light: 1, bg: '#fffbeb', side: '#f5efd8', panel: '#fffdf5', text: '#1f1f1f', muted: '#635d97', faint: '#9a96b8', line: '#e6dfc6', accent: '#644ac9', red: '#cb3a2a', green: '#14710a', yellow: '#846e15' });
  mk('one-dark', 'One Dark', 'Atom’s classic, the most installed VS Code theme.',
    { bg: '#282c34', side: '#21252b', panel: '#2c313a', text: '#abb2bf', muted: '#8b929e', faint: '#5c6370', line: '#3e4451', accent: '#61afef', on: '#1e2127', red: '#e06c75', green: '#98c379', yellow: '#e5c07b' },
    ':skin .head h1{color:#e5c07b}');
  mk('tokyo-night', 'Tokyo Night', 'Neon lights of downtown Tokyo at night.',
    { bg: '#1a1b26', side: '#16161e', panel: '#1f2335', text: '#c0caf5', muted: '#9aa5ce', faint: '#565f89', line: '#292e42', accent: '#7aa2f7', on: '#16161e', red: '#f7768e', green: '#9ece6a', yellow: '#e0af68' },
    ':skin .head h1{color:#bb9af7}');
  mk('catppuccin-latte', 'Catppuccin Latte', 'Soothing pastel, the light flavour.',
    { light: 1, bg: '#eff1f5', side: '#e6e9ef', panel: '#f7f8fa', text: '#4c4f69', muted: '#6c6f85', faint: '#9ca0b0', line: '#ccd0da', accent: '#8839ef', red: '#d20f39', green: '#40a02b', yellow: '#df8e1d' });
  mk('catppuccin-frappe', 'Catppuccin Frappé', 'Soothing pastel, muted and cosy.',
    { bg: '#303446', side: '#292c3c', panel: '#353a4e', text: '#c6d0f5', muted: '#a5adce', faint: '#737994', line: '#414559', accent: '#ca9ee6', on: '#232634', red: '#e78284', green: '#a6d189', yellow: '#e5c890' });
  mk('catppuccin-macchiato', 'Catppuccin Macchiato', 'Soothing pastel, a bit deeper.',
    { bg: '#24273a', side: '#1e2030', panel: '#2a2e45', text: '#cad3f5', muted: '#a5adcb', faint: '#6e738d', line: '#363a4f', accent: '#c6a0f6', on: '#181926', red: '#ed8796', green: '#a6da95', yellow: '#eed49f' });
  mk('catppuccin-mocha', 'Catppuccin Mocha', 'Soothing pastel, the darkest flavour.',
    { bg: '#1e1e2e', side: '#181825', panel: '#24243a', text: '#cdd6f4', muted: '#a6adc8', faint: '#6c7086', line: '#313244', accent: '#cba6f7', on: '#11111b', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af' });
  mk('gruvbox', 'Gruvbox', 'Retro groove: warm, earthy contrast.',
    { bg: '#282828', side: '#1d2021', panel: '#32302f', text: '#ebdbb2', muted: '#bdae93', faint: '#928374', line: '#504945', accent: '#fabd2f', on: '#1d2021', red: '#fb4934', green: '#b8bb26', yellow: '#fe8019' },
    ':skin .head h1{color:#fe8019}');
  mk('rose-pine', 'Rosé Pine', 'All natural pine, faux fur and a bit of soho vibes.',
    { bg: '#191724', side: '#1f1d2e', panel: '#211f32', text: '#e0def4', muted: '#908caa', faint: '#6e6a86', line: '#403d52', accent: '#ebbcba', on: '#191724', red: '#eb6f92', green: '#9ccfd8', yellow: '#f6c177' },
    ':skin .head h1{color:#c4a7e7}');
  mk('rose-pine-dawn', 'Rosé Pine Dawn', 'Rosé Pine for the morning.',
    { light: 1, bg: '#faf4ed', side: '#f2e9e1', panel: '#fffaf3', text: '#575279', muted: '#797593', faint: '#9893a5', line: '#dfdad9', accent: '#d7827e', on: '#26233a', red: '#b4637a', green: '#286983', yellow: '#ea9d34' });
  mk('night-owl', 'Night Owl', 'Made for night owls, with care for low light.',
    { bg: '#011627', side: '#010e1a', panel: '#0b2942', text: '#d6deeb', muted: '#8ba3ba', faint: '#5f7e97', line: '#1d3b53', accent: '#82aaff', on: '#011627', red: '#ef5350', green: '#addb67', yellow: '#ecc48d' },
    ':skin .head h1{color:#c792ea}');
  R({ id: 'github', name: 'GitHub', category: 'Editor', tagline: 'GitHub’s own Primer colours. Follows light and dark.',
    light: { '--bg': '#f6f8fa', '--side': '#f6f8fa', '--panel': '#ffffff', '--text': '#1f2328', '--muted': '#656d76', '--faint': '#8c959f', '--line': '#d0d7de', '--hover': 'rgba(31,35,40,.05)', '--accent': '#0969da', '--accent-soft': '#ddf4ff', '--danger': '#cf222e', '--danger-soft': '#ffebe9', '--ok': '#1a7f37', '--client': '#9a6700', '--client-soft': '#fff8c5' },
    dark: { '--bg': '#0d1117', '--side': '#010409', '--panel': '#161b22', '--text': '#e6edf3', '--muted': '#7d8590', '--faint': '#484f58', '--line': '#30363d', '--hover': 'rgba(230,237,243,.05)', '--accent': '#2f81f7', '--accent-soft': '#121d2f', '--danger': '#f85149', '--danger-soft': '#25171c', '--ok': '#3fb950', '--client': '#d29922', '--client-soft': '#272115' },
    preview: { bg: '#f6f8fa', panel: '#fff', side: '#f6f8fa', text: '#1f2328', accent: '#0969da', line: '#d0d7de' } });
  mk('ayu-mirage', 'Ayu Mirage', 'Simple, bright and elegant, in its middle shade.',
    { bg: '#1f2430', side: '#1c212b', panel: '#242936', text: '#cccac2', muted: '#9fa3ab', faint: '#707a8c', line: '#33415e', accent: '#ffcc66', on: '#1f2430', red: '#f28779', green: '#d5ff80', yellow: '#ffad66' });
  mk('everforest', 'Everforest', 'Green, warm and comfortable for long sessions.',
    { bg: '#2d353b', side: '#232a2e', panel: '#343f44', text: '#d3c6aa', muted: '#a9b29c', faint: '#859289', line: '#475258', accent: '#a7c080', on: '#232a2e', red: '#e67e80', green: '#83c092', yellow: '#dbbc7f' });
  mk('kanagawa', 'Kanagawa', 'Inspired by Hokusai’s The Great Wave.',
    { bg: '#1f1f28', side: '#16161d', panel: '#2a2a37', text: '#dcd7ba', muted: '#a6a69c', faint: '#727169', line: '#363646', accent: '#7e9cd8', on: '#16161d', red: '#e46876', green: '#98bb6c', yellow: '#e6c384' },
    ':skin .head h1{color:#957fb8}');
  mk('synthwave-84', 'SynthWave ’84', 'Neon glow straight out of 1984.',
    { bg: '#262335', side: '#171520', panel: '#2a2139', text: '#f0eff1', muted: '#b6b1d4', faint: '#848bbd', line: '#34294f', accent: '#ff7edb', on: '#262335', red: '#fe4450', green: '#72f1b8', yellow: '#fede5d' },
    ':skin .head h1{color:#fff;text-shadow:0 0 2px #fff,0 0 10px #ff7edb,0 0 22px #ff7edb} :skin .nav a.on .t{text-shadow:0 0 8px #36f9f6} :skin .chip.today{color:#36f9f6;text-shadow:0 0 6px #36f9f6}');
  mk('monokai', 'Monokai', 'The Sublime Text classic.',
    { bg: '#272822', side: '#1e1f1c', panel: '#2f302a', text: '#f8f8f2', muted: '#b8b8a8', faint: '#75715e', line: '#3e3d32', accent: '#a6e22e', on: '#272822', red: '#f92672', green: '#a6e22e', yellow: '#e6db74' },
    ':skin .head h1{color:#66d9ef}');
})();
