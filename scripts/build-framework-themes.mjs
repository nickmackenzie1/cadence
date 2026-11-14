// Builds public/plugins/themes-frameworks.js: Bootstrap 6 (alpha), the 26 Bootswatch palettes, and Bulma, mapped onto
// Cadence's tokens. Each framework's own CSS is loaded in a headless browser and its colours are READ (Bootstrap 6 and
// Bulma define them with oklch / color-mix / light-dark(), so they can't be copied as plain values).
// Usage: npm pack bootstrap@6.0.0-alpha.1 bootswatch bulma, unpack each into DIR/<name>/package, then
//   node scripts/build-framework-themes.mjs DIR
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const DIR = process.argv[2]; if (!DIR) throw new Error('usage: node scripts/build-framework-themes.mjs <dir with unpacked packages>');
const pkg = name => { const d = fs.readdirSync(DIR).find(x => x.startsWith(name + '-') && fs.statSync(path.join(DIR, x)).isDirectory()); return path.join(DIR, d, 'package'); };
const version = name => JSON.parse(fs.readFileSync(path.join(pkg(name), 'package.json'), 'utf8')).version;

const browser = await chromium.launch(), page = await browser.newPage();
// resolve CSS custom properties to plain colours for a given stylesheet and colour scheme
async function read(cssFile, scheme, vars, rootAttr = '') {
  const css = fs.readFileSync(cssFile, 'utf8');
  await page.setContent(`<!doctype html><html ${rootAttr} style="color-scheme:${scheme}"><head><style>${css}</style></head><body><i id=p></i></body></html>`);
  return page.evaluate(vars => {
    const p = document.getElementById('p'), out = {};
    const hex = c => { const m = c.match(/[\d.]+/g); if (!m || m.length < 3) return c; const [r, g, b] = m.slice(0, 3).map(n => Math.round(+n)); const a = m.length > 3 ? +m[3] : 1;
      return a < 1 ? `rgba(${r},${g},${b},${+a.toFixed(3)})` : '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join(''); };
    for (const [k, expr] of Object.entries(vars)) {
      if (k.startsWith('len:')) { p.style.borderTopLeftRadius = expr; out[k.slice(4)] = getComputedStyle(p).borderTopLeftRadius; continue; }
      if (k.startsWith('font:')) { p.style.fontFamily = expr; out[k.slice(5)] = getComputedStyle(p).fontFamily; continue; }
      // canvas round-trip turns oklch()/color-mix() into sRGB
      p.style.color = expr; const c = getComputedStyle(p).color;
      const cv = document.createElement('canvas').getContext('2d'); cv.fillStyle = '#000'; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data;
      out[k] = /rgba?\(|color\(|oklch|lab/.test(c) ? (d[3] < 255 ? `rgba(${d[0]},${d[1]},${d[2]},${(d[3] / 255).toFixed(3)})` : hex(`rgb(${d[0]},${d[1]},${d[2]})`)) : c;
    }
    return out;
  }, vars);
}
const lum = h => { const m = String(h).match(/^#(..)(..)(..)$/); if (!m) return 0.5; const [r, g, b] = m.slice(1).map(x => parseInt(x, 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; };
const tok = c => ({ '--bg': c.bg2, '--panel': c.bg, '--side': c.side || c.bg2, '--text': c.fg, '--muted': c.muted, '--faint': c.faint, '--line': c.line, '--hover': c.hover,
  '--accent': c.primary, '--on-accent': c.onPrimary, '--accent-soft': c.primarySoft, '--client': c.info || c.primary, '--client-soft': c.infoSoft || c.primarySoft,
  '--ok': c.success, '--danger': c.danger, '--danger-soft': c.dangerSoft, '--r': c.radius, '--shadow': c.shadow });

// ---- Bootstrap 6 alpha ----
const BS6 = path.join(pkg('bootstrap'), 'dist/css/bootstrap.css');
const bs6vars = { bg: 'var(--bs-bg-body)', bg2: 'var(--bs-bg-1)', side: 'var(--bs-bg-2)', fg: 'var(--bs-fg-body)', muted: 'var(--bs-fg-2)', faint: 'var(--bs-fg-3)', line: 'var(--bs-border-color)', hover: 'var(--bs-bg-2)',
  primary: 'var(--bs-primary-base)', onPrimary: 'var(--bs-primary-contrast)', primarySoft: 'var(--bs-primary-bg-subtle)', info: 'var(--bs-info-base, var(--bs-cyan-500))', infoSoft: 'var(--bs-info-bg-subtle)',
  success: 'var(--bs-success-base, var(--bs-green-500))', danger: 'var(--bs-danger-base, var(--bs-red-500))', dangerSoft: 'var(--bs-danger-bg-subtle)', focus: 'var(--bs-primary-focus-ring)',
  'len:radius': 'var(--bs-radius-7, var(--bs-border-radius))', 'font:font': 'var(--bs-font-sans-serif, system-ui)' };
const b6l = await read(BS6, 'light', bs6vars), b6d = await read(BS6, 'dark', bs6vars);
// ---- Bulma ----
const BU = path.join(pkg('bulma'), 'css/bulma.css');
const buvars = { bg: 'var(--bulma-scheme-main)', bg2: 'var(--bulma-scheme-main-bis)', side: 'var(--bulma-scheme-main-ter)', fg: 'var(--bulma-text-strong)', muted: 'var(--bulma-text)', faint: 'var(--bulma-text-weak)', line: 'var(--bulma-border)', hover: 'var(--bulma-background)',
  primary: 'var(--bulma-primary)', onPrimary: 'var(--bulma-primary-invert)', primarySoft: 'var(--bulma-primary-soft)', info: 'var(--bulma-link)', infoSoft: 'var(--bulma-link-soft)',
  success: 'var(--bulma-success)', danger: 'var(--bulma-danger)', dangerSoft: 'var(--bulma-danger-soft)', 'len:radius': 'var(--bulma-radius)', 'font:font': 'var(--bulma-family-primary)' };
const bul = await read(BU, 'light', buvars, 'data-theme="light"'), bud = await read(BU, 'dark', buvars, 'data-theme="dark"');
// ---- Bootswatch (Bootstrap 5.3 variables) ----
const SW = path.join(pkg('bootswatch'), 'dist');
// Bootswatch's dark palettes only set body bg/colour (the -subtle / tertiary vars stay Bootstrap's light ones), so the
// surfaces and greys are mixed from each palette's own body background and text colour
const mix = (a, pct) => `color-mix(in srgb, var(--bs-body-color) ${pct}%, var(--bs-body-bg))`;
const swvars = { bg: 'var(--bs-body-bg)', bg2: mix(0, 4), side: mix(0, 7), fg: 'var(--bs-body-color)', muted: mix(0, 72), faint: mix(0, 50), line: mix(0, 16), hover: mix(0, 6),
  primary: 'var(--bs-primary)', primarySoft: 'color-mix(in srgb, var(--bs-primary) 16%, var(--bs-body-bg))', info: 'var(--bs-info)', infoSoft: 'color-mix(in srgb, var(--bs-info) 16%, var(--bs-body-bg))', success: 'var(--bs-success)', danger: 'var(--bs-danger)', dangerSoft: 'color-mix(in srgb, var(--bs-danger) 16%, var(--bs-body-bg))',
  'len:radius': 'var(--bs-border-radius)' };
const sw = [];
for (const name of fs.readdirSync(SW).filter(n => fs.existsSync(path.join(SW, n, 'bootstrap.css'))).sort()) {
  const c = await read(path.join(SW, name, 'bootstrap.css'), 'light', swvars);
  c.onPrimary = lum(c.primary) > 0.45 ? '#111111' : '#ffffff';
  sw.push({ name, c });
}
await browser.close();

// readability floor: text 4.5:1 and muted 3:1 against the panel, nudged toward black or white until they pass
const rgb = h => String(h).match(/^#(..)(..)(..)$/)?.slice(1).map(x => parseInt(x, 16));
const toHex = a => '#' + a.map(n => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')).join('');
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const ensure = (fg, bg, min) => { const f = rgb(fg), b = rgb(bg); if (!f || !b) return fg; const to = lum(bg) > .4 ? 0 : 255; let c = f, t = 0;
  while (cr(toHex(c), bg) < min && t < 1) { t += .05; c = f.map(v => v + (to - v) * t); } return toHex(c); };
const fix = c => ({ ...c, fg: ensure(c.fg, c.bg, 4.5), muted: ensure(c.muted, c.bg, 3), onPrimary: c.onPrimary && rgb(c.primary) ? (cr(c.onPrimary, c.primary) >= 3 ? c.onPrimary : (lum(c.primary) > .4 ? '#111111' : '#ffffff')) : c.onPrimary,
  shadow: 'none', radius: c.radius && c.radius !== '0px' ? c.radius : '0px' });
const title = s => s.charAt(0).toUpperCase() + s.slice(1);
const themes = [
  { id: 'bootstrap', name: 'Bootstrap 6', family: null, tagline: `Bootstrap ${version('bootstrap')} (alpha): its own colours, radius and focus ring. Follows light/dark.`, light: tok(fix(b6l)), dark: tok(fix(b6d)), focus: b6l.focus, kind: 'bs' },
  { id: 'bulma', name: 'Bulma', family: null, tagline: `Bulma ${version('bulma')}: turquoise primary, soft boxes, rounded buttons. Follows light/dark.`, light: tok(fix(bul)), dark: tok(fix(bud)), kind: 'bulma' },
  ...sw.map(({ name, c }) => ({ id: 'bootswatch-' + name, name: title(name), family: 'Bootswatch', tagline: `${lum(c.bg) < .4 ? 'Dark' : 'Light'} · Bootswatch ${version('bootswatch')}`, vars: tok(fix(c)), kind: 'bs' })),
];
const out = `/* Bootstrap 6, Bootswatch and Bulma themes (all MIT), mapped onto Cadence's tokens.
   Generated by scripts/build-framework-themes.mjs from the frameworks' own CSS: do not edit by hand. */
(() => {
  const T = ${JSON.stringify(themes)};
  // the frameworks' component feel, on Cadence markup
  const BS = f => \`:skin .btn{border-radius:var(--r);font-weight:500} :skin .btn.primary{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
    :skin .btn:focus-visible,:skin .inp:focus,:skin .qa:focus-within{outline:0;box-shadow:0 0 0 .25rem \${f || 'color-mix(in srgb,var(--accent) 25%,transparent)'}}
    :skin .gl,:skin .stat,:skin .qa,:skin .group,:skin .modal{border:1px solid var(--line);border-radius:calc(var(--r) * 1.5)} :skin .chip{border-radius:999px}\`;
  const BULMA = \`:skin .btn{border-radius:var(--r);font-weight:600} :skin .btn.primary{background:var(--accent);border-color:transparent;color:var(--on-accent)}
    :skin .gl,:skin .stat,:skin .qa,:skin .group,:skin .modal{border:0;border-radius:calc(var(--r) * 1.5);box-shadow:0 .5em 1em -.125em rgba(10,10,10,.1),0 0 0 1px rgba(10,10,10,.02)}
    :skin .chip{border-radius:var(--r);background:var(--accent-soft);color:var(--text);border:0} :skin .head h1{font-weight:700}\`;
  for (const t of T) window.CadenceThemes.register({
    id: t.id, name: t.name, category: 'Useful', ...(t.family ? { family: t.family } : {}), tagline: t.tagline,
    ...(t.vars ? { vars: { '--ambient': 'off', ...t.vars } } : { light: { '--ambient': 'off', ...t.light }, dark: { '--ambient': 'off', ...t.dark } }),
    font: 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
    css: t.kind === 'bulma' ? BULMA : BS(t.focus),
  });
})();
`;
fs.writeFileSync(new URL('../public/plugins/themes-frameworks.js', import.meta.url), out);
console.log('wrote', themes.length, 'themes');
