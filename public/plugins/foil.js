/* Foil (2026-11-25, from holospot: github.com/dmitrykurash/holospot, MIT, with three.js, MIT; both in public/vendor).
   Real holographic foil, worked out per pixel by the kit (it bends light off a grooved surface, so colours shift as it
   tilts). THING uses it three ways:
   - the logo: THING's ring-and-dot mark stamped in foil on a dark paper square, in the sidebar. It tilts toward the
     pointer and only draws while something moves, so it costs nothing at rest.
   - the Foil theme (themes below): a foil sheet the kit renders once, used as a picture on the theme's accents.
   - Havoc: the same sheet colours the holo material (vendor/elements-core.js) and the shattering holo pane.
   The kit (1.3 MB) and three.js (2 MB) load only when one of these is first used, never on a phone's narrow layout for
   the logo. "Reduce motion" on: one still frame, no tilting. No WebGL: the ordinary logo stays. window.CadenceFoil. */
(() => {
  const url = p => new URL(p, document.baseURI).href;
  let kitP = null;
  const kit = () => kitP || (kitP = Promise.all([import(url('vendor/three/three.module.js')), import(url('vendor/holo/dist/holo.js'))]).then(([THREE, H]) => ({ THREE, H })));
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dark = () => document.documentElement.classList.contains('dark') || matchMedia('(prefers-color-scheme: dark)').matches && !document.documentElement.classList.contains('light');
  const MARK = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 64 64"><circle cx="32" cy="32" r="16.5" fill="none" stroke="#000" stroke-width="11"/><circle cx="32" cy="32" r="3.6" fill="#000"/></svg>');

  // WebGL with a real graphics chip only: on a software renderer (no GPU, a virtual machine, test browsers) the foil is
  // slow and slows the whole page, so the plain logo stays. window.__forceGL in tests.
  let gl0 = null;
  function glOk() {
    if (gl0 !== null) return gl0;
    try {
      const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return (gl0 = false);
      const dbg = gl.getExtension('WEBGL_debug_renderer_info'), who = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
      gl0 = !!window.__forceGL || !/swiftshader|llvmpipe|software|basic render/i.test(who);
      const lose = gl.getExtension('WEBGL_lose_context'); lose && lose.loseContext();
    } catch { gl0 = false; }
    return gl0;
  }

  // one small scene: a card, its own transparent renderer, drawn on demand
  async function stage(canvas, cardOpts, { tilt = 18, follow = true, fill = 1 } = {}) {
    const { THREE, H } = await kit();
    const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.setClearColor(0x000000, 0); r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height; r.setSize(w, h, false);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, w / h, 0.05, 50);
    const holo = new H.Holo(r, { quality: 'low', compose: 'over' });
    const card = holo.card({ size: 1, ...cardOpts }); scene.add(card);   // 1 unit across, centred
    const obj = holo.get(card); await obj.ready;
    camera.position.set(0, 0, 0.5 / Math.tan(15 * Math.PI / 180) * fill); camera.lookAt(0, 0, 0);   // fill 1: the card just fills the frame
    const rest = H.shotRotation({ rx: 0, ry: 0, rz: 0, flip: false });
    const target = { x: 0, y: 0 }, now = { x: 0, y: 0 }; let raf = 0, t0 = performance.now();
    const draw = () => { card.rotation.set(rest.x + now.x * Math.PI / 180, rest.y + now.y * Math.PI / 180, rest.z, 'XYZ'); holo.render(scene, camera, { time: (performance.now() - t0) / 1000 }); };
    const tick = () => { now.x += (target.x - now.x) * 0.16; now.y += (target.y - now.y) * 0.16; draw(); raf = Math.abs(target.x - now.x) + Math.abs(target.y - now.y) > 0.05 ? requestAnimationFrame(tick) : 0; };
    const aim = (x, y) => { target.x = Math.max(-tilt, Math.min(tilt, x)); target.y = Math.max(-tilt, Math.min(tilt, y)); if (!raf && !still()) raf = requestAnimationFrame(tick); };
    draw();
    return { aim, draw, holo, card, scene, camera, renderer: r, follow, dispose() { cancelAnimationFrame(raf); holo.dispose(); r.dispose(); } };
  }

  // the sidebar logo: a foil ring-and-dot on dark paper, leaning toward the pointer
  // (a normal-size card, zoomed so the paper fills the square; CSS rounds it to THING's corners. The kit draws the stamp
  // a frame or two after its artwork loads, and doesn't show it at all on a very small card.)
  const LOGO = () => ({ material: 'emboss', look: 'plain', widthMm: 60, heightMm: 60,
    settings: { 'emboss.logo': MARK, 'emboss.foil': 'concentric', 'emboss.width': 40, 'emboss.x': 31.5, 'emboss.y': 44,   /* the kit's centre of any card face */ 'emboss.height': 420,
      'emboss.paperColour': '#1d1a2e', 'emboss.stock': 'smooth', 'emboss.textureStrength': 0.1, 'grain.on': false, 'scene.background': dark() ? 'black' : 'white' } });
  let logoOn = null, logoBusy = false;
  async function logo(el) {
    if (!el || logoOn || logoBusy || !glOk() || el.offsetWidth < 8) return null;
    logoBusy = true;   // one at a time: set up once, even if asked again while it loads
    const cv = document.createElement('canvas'); cv.className = 'foil-cv'; el.appendChild(cv);
    try {
      const s = await stage(cv, LOGO(), { tilt: 20, fill: 0.78 });
      for (const ms of [250, 700, 1500]) setTimeout(() => s.draw(), ms);   // the stamp arrives after its artwork loads
      el.classList.add('foil-on'); logoOn = s;
      addEventListener('pointermove', e => { const b = el.getBoundingClientRect(); if (!b.width) return; const dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2), d = Math.hypot(dx, dy) || 1, k = Math.min(1, 260 / d) * 0.9 + 0.1;
        s.aim(dy / d * 22 * k, -dx / d * 22 * k); }, { passive: true });
      return s;
    } catch (e) { cv.remove(); logoBusy = false; console.warn('foil: logo', e && e.message); return null; }
  }

  // a foil sheet, rendered once: a picture (data URL) the theme and Havoc use. Prism Rainbow, face-on with a slight lean
  const sheets = new Map();
  function sheet({ material = 'prism', size = 384, lean = 14 } = {}) {
    const k = material + size + lean; if (sheets.has(k)) return sheets.get(k);
    const p = (async () => {
      if (!glOk()) return null;
      const cv = document.createElement('canvas'); cv.width = cv.height = size; cv.style.cssText = `position:fixed;left:-9999px;top:0;width:${size}px;height:${size}px`; document.body.appendChild(cv);
      try {
        const s = await stage(cv, { material, look: 'plain', widthMm: 60, heightMm: 60, settings: { 'card.corner': 2.5, 'scene.background': 'black', 'grain.on': false } }, { tilt: 30, fill: 0.8 });
        s.renderer.setPixelRatio(1); s.renderer.setSize(size, size, false);
        s.card.rotation.set(lean * Math.PI / 180, -lean * Math.PI / 180, 0);
        s.holo.render(s.scene, s.camera, { still: true });
        const out = cv.toDataURL('image/png'); s.dispose(); return out;
      } catch (e) { console.warn('foil: sheet', e && e.message); return null; }
      finally { cv.remove(); }
    })();
    sheets.set(k, p); return p;
  }

  // draw the logo card into any canvas (the sign-in page, and tests)
  const logoInto = (canvas, o) => stage(canvas, LOGO(), { fill: 0.78, ...o });
  window.CadenceFoil = { logo, logoInto, sheet, ok: glOk, kit };

  // the Foil theme: calm colours, and real foil (a sheet the kit renders once) on the accents: the active page in the sidebar,
  // tabs, primary buttons and a ticked task. The foil drifts with the pointer; still with reduced motion.
  const INK = '#1d1a2e';
  async function brightSheet() {
    const d = await sheet({ material: 'prism', lean: 14, size: 256 }); if (!d) return null;
    const im = new Image(); im.src = d; await im.decode();
    const c = document.createElement('canvas'); c.width = c.height = 192; const g = c.getContext('2d');
    g.filter = 'brightness(1.35) saturate(1.25)'; g.drawImage(im, 24, 24, 160, 160, 0, 0, 192, 192);   // the bright middle
    return c.toDataURL('image/png');
  }
  function theme(api) {
    const T = window.CadenceThemes; if (!T || T.list().some(t => t.id === 'foil')) return;
    const on = sel => `${sel}{background-image:var(--foil-img);background-size:400% 400%;background-position:var(--foil-at);transition:background-position .5s ease-out;color:${INK}}`;
    T.register({
      id: 'foil', name: 'Foil', category: 'Fun', tagline: 'Holographic foil on the accents, leaning with your pointer.',
      light: { '--bg': '#f4f3f7', '--panel': '#ffffff', '--side': '#eeedf3', '--text': INK, '--muted': '#6b6880', '--faint': '#a4a1b5', '--line': '#e3e1ea', '--hover': '#e9e7f0', '--accent': '#6d5ae6', '--accent-soft': '#ece9fc' },
      dark: { '--bg': '#121019', '--panel': '#1a1724', '--side': '#15121e', '--text': '#ece9f6', '--muted': '#9a96ad', '--faint': '#6c6880', '--line': '#2a2638', '--hover': '#221f2e', '--accent': '#a99bff', '--accent-soft': '#2a2545' },
      preview: { bg: '#f4f3f7', panel: '#ffffff', side: '#eeedf3', text: INK, accent: '#b9a8ff', line: '#e3e1ea' },
      css: `:skin{--foil-img:conic-gradient(from 200deg,#ffb3dc,#ffe7a3,#b5ffc4,#a6e4ff,#d0b3ff,#ffb3dc);--foil-at:calc(var(--fx,.5) * 100%) calc(var(--fy,.5) * 100%)}
        ${on(':skin .nav a.on,:skin .vt.on,:skin .ntile.on,:skin .space-sw i')} :skin .nav a.on .ic,:skin .vt.on,:skin .vt.on svg,:skin .ntile.on,:skin .ntile.on svg{color:${INK}}
        ${on(':skin .ins-tabs a.on,:skin .ins-tabs button.on,:skin .seg button.on')}
        ${on(':skin .btn.primary,:skin .btn.pri')} :skin .btn.primary,:skin .btn.pri{border-color:transparent}
        :skin .task.done .check{background:var(--foil-img) var(--foil-at)/700% 700%;border-color:transparent}
        :skin .task.done .check:after{border-color:${INK}}`,
      enhance() {
        const h = document.documentElement; let raf = 0, x = .5, y = .5, gone = false;
        brightSheet().then(d => { if (d && !gone) h.style.setProperty('--foil-img', `url(${d})`); });
        const move = e => { x = e.clientX / innerWidth; y = e.clientY / innerHeight; if (!raf) raf = requestAnimationFrame(() => { raf = 0; h.style.setProperty('--fx', x.toFixed(3)); h.style.setProperty('--fy', y.toFixed(3)); }); };
        if (!still()) addEventListener('pointermove', move, { passive: true });
        return () => { gone = true; removeEventListener('pointermove', move); for (const k of ['--foil-img', '--fx', '--fy']) h.style.removeProperty(k); };
      },
    });
  }

  if (!window.Cadence) return;   // the sign-in page uses CadenceFoil on its own
  Cadence.registerPlugin({
    id: 'foil', name: 'Foil', version: '1.0.0', category: 'Appearance', spaces: ['work', 'life'],
    tagline: 'Real holographic foil: the THING logo, a Foil theme, and holo in Havoc.',
    description: 'The THING logo in the sidebar becomes foil that leans toward your pointer, there is a Foil theme, and Havoc gets a holo material. Drawn by holospot (MIT). Uses no power when nothing moves.',
    setup(api) {
      const css = document.createElement('style');
      css.textContent = `.brand .logo .foil-cv{position:absolute;inset:0;width:100%;height:100%;border-radius:inherit;z-index:2;pointer-events:none}
        .brand .logo.foil-on{background:none;box-shadow:none}.brand .logo.foil-on:before,.brand .logo.foil-on:after{display:none}`;
      document.head.appendChild(css);
      // after things settle, and only where the sidebar shows (not on a phone's narrow layout)
      const go = () => { const el = document.querySelector('#side-head .brand .logo'); if (el && innerWidth > 900) logo(el); };
      (window.requestIdleCallback || setTimeout)(go, { timeout: 4000 });
      theme(api);
      addEventListener('resize', () => { if (!logoOn) go(); });
    }
  });
})();
