/* Colour-blind modes (backlog, done 2026-11-19). Works on top of any theme: the colours that carry meaning (done/ok,
   problems, priority, clients, warnings) switch to a set that stays apart for the chosen kind of colour vision, from
   the Okabe–Ito palette made for exactly this, and meaning that was colour-only gets a second cue: links are underlined,
   the connection dot gets a shape, focus rings are thicker.
     Red–green  (protanopia, deuteranopia: the common ones)
     Blue–yellow (tritanopia)
     No colour  (achromatopsia: told apart by lightness and shape only)
   Per device (localStorage cadence.cvd), set from the plugin's Settings or ⌘K. */
(() => {
  const MODES = [['off', 'Off', 'Colours as the theme has them'], ['rg', 'Red–green', 'Protanopia and deuteranopia, the most common'], ['by', 'Blue–yellow', 'Tritanopia'], ['mono', 'No colour', 'Achromatopsia: lightness and shapes only']];
  const get = () => { try { const v = localStorage.getItem('cadence.cvd'); return MODES.some(m => m[0] === v) ? v : 'off'; } catch { return 'off'; } };
  const set = v => { try { localStorage.setItem('cadence.cvd', v); } catch {} apply(); };
  const apply = () => { const v = get(); if (v === 'off') delete document.documentElement.dataset.cvd; else document.documentElement.dataset.cvd = v; };
  apply();   // as early as possible

  const mix = (c, p) => `color-mix(in srgb,${c} ${p}%,transparent)`;
  const vars = (o) => Object.entries(o).map(([k, v]) => `--${k}:${v}!important`).join(';');
  const style = document.createElement('style'); style.id = 'cvd-css';
  style.textContent = `
    html[data-cvd=rg]{${vars({ ok: '#0072b2', danger: '#d55e00', 'danger-soft': mix('#d55e00', 14), client: '#e69f00', 'client-soft': mix('#e69f00', 16), warn: '#e69f00' })}}
    html[data-cvd=by]{${vars({ ok: '#009e73', danger: '#c51b7d', 'danger-soft': mix('#c51b7d', 14), client: '#e66101', 'client-soft': mix('#e66101', 16), warn: '#e66101' })}}
    html[data-cvd=mono]:not([data-theme=dark]){${vars({ ok: '#1a1a1a', danger: '#1a1a1a', 'danger-soft': 'rgba(0,0,0,.08)', client: '#555', 'client-soft': 'rgba(0,0,0,.06)', warn: '#333' })}}
    html[data-cvd=mono][data-theme=dark]{${vars({ ok: '#f2f2f2', danger: '#f2f2f2', 'danger-soft': 'rgba(255,255,255,.1)', client: '#bbb', 'client-soft': 'rgba(255,255,255,.08)', warn: '#ddd' })}}
    /* a second cue wherever colour was the only one */
    html[data-cvd] #view a:not(.btn):not(.chip):not(.ar-link):not([class*=card]):not(.ntile),html[data-cvd] .ar-link{text-decoration:underline;text-underline-offset:2px;text-decoration-thickness:1px}
    html[data-cvd] :focus-visible{outline-width:3px!important;outline-offset:2px}
    html[data-cvd] .sync i{border-radius:1px;width:7px;height:7px}html[data-cvd] .sync.ok i{border-radius:50%;background:var(--ok)}
    html[data-cvd] .chip.pri3{font-weight:800;text-decoration:underline}html[data-cvd] .chip.pri2{font-weight:700}
    html[data-cvd=mono] .chip.pri3,html[data-cvd=mono] .chip.pri2{border:1.5px solid currentColor}`;
  (document.head || document.documentElement).appendChild(style);

  Cadence.registerPlugin({
    id: 'colour-vision', name: 'Colour-blind modes', version: '1.0.0', category: 'Useful', color: '#0072b2',
    icon: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M12 9v6"/>',
    tagline: 'Colours that stay apart, whatever your colour vision',
    description: 'On top of any theme: red–green, blue–yellow or no-colour modes swap the colours that carry meaning (done, problems, priority, clients) for ones that stay apart, and add a second cue where colour was the only one: underlined links, shaped status dots, bolder priorities. Per device.',
    setup(api) {
      const E = api.ui.esc;
      const open = () => {
        const cur = get();
        api.ui.modal('Colour-blind mode', `<p class="muted" style="margin:0 0 12px">Works with every theme, on this device. The colours that mean something switch to ones that stay apart, and links, dots and priorities get a shape or underline too.</p>
          <div class="cvd-l">${MODES.map(([k, l, d]) => `<label class="cvd-o"><input type="radio" name="cvd" value="${k}" ${cur === k ? 'checked' : ''}><span><b>${E(l)}</b><span class="muted">${E(d)}</span></span>
            <span class="cvd-sw" aria-hidden="true">${['ok', 'danger', 'client', 'accent'].map(v => `<i data-k="${k}" style="background:var(--${v})"></i>`).join('')}</span></label>`).join('')}</div>`, '<button class="btn primary" data-act="close-modal">Done</button>');
        setTimeout(() => document.querySelectorAll('input[name=cvd]').forEach(r => r.onchange = () => { set(r.value); api.ui.toast(r.value === 'off' ? 'Colour-blind mode off' : `Colour-blind mode: ${MODES.find(m => m[0] === r.value)[1]}`); }), 0);
      };
      api.onSettings(open);
      api.commands.add({ title: 'Colour-blind mode…', icon: 'eye', run: open });
      window.CadenceKit.css('cvd-ui', `.cvd-l{display:flex;flex-direction:column;gap:8px}
        .cvd-o{display:flex;gap:10px;align-items:center;padding:10px 12px;border:1px solid var(--line);border-radius:var(--r,8px);cursor:pointer}
        .cvd-o:has(input:checked){border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
        .cvd-o>span:first-of-type{display:flex;flex-direction:column;flex:1}.cvd-o .muted{font-size:12.5px}
        .cvd-sw{display:flex;gap:4px}.cvd-sw i{width:14px;height:14px;border-radius:4px;border:1px solid var(--line)}`);
      // swatches in the dialog show each mode's colours, not just the current one
      const SW = { off: null, rg: ['#0072b2', '#d55e00', '#e69f00'], by: ['#009e73', '#c51b7d', '#e66101'], mono: ['#1a1a1a', '#1a1a1a', '#555'] };
      window.CadenceKit.css('cvd-sw', Object.entries(SW).filter(([, c]) => c).map(([k, c]) => c.map((x, i) => `.cvd-sw i[data-k=${k}]:nth-child(${i + 1}){background:${x}!important}`).join('')).join(''));
    }
  });
})();
