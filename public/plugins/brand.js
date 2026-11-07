/* Brand theme — each client page quietly takes on the client's brand colours.
   Colours come from the client's website CSS (fetched by the NAS) and from their logo,
   sampled in the browser. Applied subtly: backdrop, accents, buttons, focus rings. */
(() => {
  const G = window.__brand = window.__brand || {};
  if (!G.style) {
    G.style = document.createElement('style');
    G.style.textContent = `
      body.branded .main{background:linear-gradient(180deg,color-mix(in srgb,var(--b1) 6%,var(--bg)) 0,var(--bg) 460px)}
      body.branded .c-hero .bg:not(.img){background:radial-gradient(900px 280px at 85% -20%,color-mix(in srgb,var(--b1) 34%,transparent),transparent 70%),radial-gradient(700px 240px at 5% -10%,color-mix(in srgb,var(--b2) 24%,transparent),transparent 70%)!important}
      body.branded .c-hero .wm{opacity:.09}
      body.branded .c-hero h1 .av{box-shadow:0 0 0 3px var(--panel),0 0 0 5px color-mix(in srgb,var(--b1) 45%,transparent),0 6px 18px color-mix(in srgb,var(--b1) 30%,transparent)}
      body.branded .btn.primary{background:var(--b1);border-color:var(--b1);color:var(--b1-on)}
      body.branded .stat{border-top:2px solid color-mix(in srgb,var(--b1) 55%,transparent)}
      body.branded .stat:first-child .v{color:var(--b1-ink)}
      body.branded .qa:focus-within{border-color:var(--b1);box-shadow:0 0 0 4px color-mix(in srgb,var(--b1) 16%,transparent)}
      body.branded .qa-row .plus{color:var(--b1-ink)}
      body.branded .cols .group:first-child .group-h{color:var(--b1-ink);border-bottom-color:color-mix(in srgb,var(--b1) 40%,var(--line))}
      body.branded .check:hover{border-color:var(--b1);background:color-mix(in srgb,var(--b1) 12%,transparent)}
      body.branded .playbook{border-color:color-mix(in srgb,var(--b1) 35%,var(--line));background:color-mix(in srgb,var(--b1) 5%,transparent)}
      body.branded .chip.ind{border-color:color-mix(in srgb,var(--b1) 40%,var(--line))}
      body.branded .site-link:hover{color:var(--b1-ink)}
      body.branded ::selection{background:color-mix(in srgb,var(--b1) 28%,transparent)}
      body.branded .nav a.on{--sel:var(--b1)}
      .bpal{display:inline-flex;gap:3px;vertical-align:middle;margin-left:8px;padding:3px;border-radius:999px;background:var(--panel);border:1px solid var(--line);cursor:pointer}
      .bpal i{width:11px;height:11px;border-radius:50%;display:block;box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)}
      .bpal.scanning i{animation:bscan 1s infinite}
      .bpal.scanning i:nth-child(2){animation-delay:.15s}.bpal.scanning i:nth-child(3){animation-delay:.3s}
      @keyframes bscan{50%{transform:scale(.5);opacity:.4}}
    `;
    document.head.appendChild(G.style);
  }

  /* colour helpers */
  const hex2rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h.slice(0, 6), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const rgb2hex = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  function rgb2hsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; }
  function hsl2rgb([h, s, l]) { if (!s) return [l * 255, l * 255, l * 255]; const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]; }
  const lum = c => { const a = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * a[0] + .7152 * a[1] + .0722 * a[2]; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  function readable(hex, dark) {
    const bg = dark ? [27, 27, 30] : [247, 246, 243]; let [h, s, l] = rgb2hsl(hex2rgb(hex));
    for (let i = 0; i < 20 && contrast(hsl2rgb([h, s, l]), bg) < 3.6; i++) l += dark ? 0.04 : -0.04;
    return rgb2hex(hsl2rgb([h, Math.min(1, s), Math.max(0, Math.min(1, l))]));
  }
  const hueDist = (a, b) => { const x = rgb2hsl(hex2rgb(a))[0], y = rgb2hsl(hex2rgb(b))[0]; const d = Math.abs(x - y); return Math.min(d, 1 - d) * 360; };

  /* sample the logo's dominant vivid colour (same-origin logo on the NAS, so the canvas is readable) */
  function sampleLogo(url) {
    return new Promise(res => {
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => {
        try {
          const c = document.createElement('canvas'); c.width = c.height = 40; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 40, 40);
          const d = x.getImageData(0, 0, 40, 40).data, bins = new Map();
          for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] < 200) continue; const [h, s, l] = rgb2hsl([d[i], d[i + 1], d[i + 2]]); if (s < 0.3 || l < 0.15 || l > 0.88) continue;
            const k = Math.round(h * 18) % 18, b = bins.get(k) || { n: 0, r: 0, g: 0, b: 0 }; const w = 0.5 + s; b.n += w; b.r += d[i] * w; b.g += d[i + 1] * w; b.b += d[i + 2] * w; bins.set(k, b);
          }
          const top = [...bins.values()].sort((a, b) => b.n - a.n).filter(b => b.n > 12).slice(0, 3).map(b => rgb2hex([b.r / b.n, b.g / b.n, b.b / b.n]));
          res(top);
        } catch (e) { res([]); }
      };
      im.onerror = () => res([]);
      im.src = url;
    });
  }

  Cadence.registerPlugin({
    id: 'brand', name: 'Brand theme', version: '1.0.0',
    description: 'Client pages subtly take on each client’s brand colours, detected from their website CSS and logo.',
    setup(api) {
      const busy = new Set();
      async function detect(c, force) {
        if (busy.has(c.id)) return; busy.add(c.id);
        const pal = document.querySelector('.bpal'); if (pal) pal.classList.add('scanning');
        let web = [], logo = [];
        const sys = api.system();
        try {
          if (sys.mode === 'nas' && c.domain) {
            const r = await fetch(`api/company?d=${encodeURIComponent(c.domain)}${force ? '&refresh=1' : ''}`, { cache: 'no-store' });
            if (r.ok) { const j = await r.json(); web = j.colors || []; }
            logo = await sampleLogo(api.ui.faviconUrl(c.domain, c.logoV));
          }
        } catch (e) {}
        // logo first (it IS the brand), then site CSS, then theme colour, then the client's own colour
        const cands = [...logo, ...web, c.themeColor, c.color].filter(Boolean);
        const primary = cands[0];
        const secondary = cands.find(x => x !== primary && hueDist(x, primary) > 25) || cands[1] || primary;
        const brand = { v: 1, primary, secondary, palette: [...new Set(cands)].slice(0, 5), source: logo.length ? 'logo' : web.length ? 'website' : 'client colour', at: Date.now() };
        busy.delete(c.id);
        api.clients.update(c.id, { brand });
        return brand;
      }
      function apply(c) {
        const b = c && c.brand, root = document.documentElement;
        if (!b) { document.body.classList.remove('branded'); return; }
        const dark = root.dataset.theme === 'dark';
        root.style.setProperty('--b1', b.primary);
        root.style.setProperty('--b2', b.secondary || b.primary);
        root.style.setProperty('--b1-ink', readable(b.primary, dark));
        root.style.setProperty('--b1-on', lum(hex2rgb(b.primary)) > 0.45 ? '#15131c' : '#ffffff');
        document.body.classList.add('branded');
        // palette chip in the hero
        const sub = document.querySelector('.c-hero .sub');
        if (sub && !sub.querySelector('.bpal')) {
          const el = document.createElement('span'); el.className = 'bpal';
          el.title = `Brand colours (from ${b.source}) — click to re-detect`;
          el.innerHTML = (b.palette || [b.primary]).slice(0, 4).map(x => `<i style="background:${x}"></i>`).join('');
          el.addEventListener('click', async ev => { ev.stopPropagation(); el.classList.add('scanning'); await detect(api.clients.get(c.id), true); api.ui.toast('Brand colours re-detected'); });
          sub.appendChild(el);
        }
      }
      api.on('render', ({ route }) => {
        if (!route.startsWith('client-')) { document.body.classList.remove('branded'); return; }
        const c = api.clients.get(route.slice(7)); if (!c) return;
        apply(c);
        // first visit, logo refreshed, or stale: detect in the background
        if (!c.brand || (c.logoV && c.brand.at < c.logoV) || (c.brand.source === 'client colour' && c.domain && api.system().mode === 'nas' && Date.now() - c.brand.at > 36e5)) detect(c).then(() => { if (api.ui.currentRoute() === route) api.ui.refresh(); });
      });
      api.clientActions.add({ id: 'brand-redetect', label: '🎨  Re-detect brand colours', run: async (c, api) => { await detect(c, true); api.ui.refresh(); api.ui.toast('Brand colours updated'); } });
    }
  });
})();
