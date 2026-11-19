/* Cover Flow and the record bin (user, 2026-11-18: "show an artist's albums like Cover Flow or flipping through a
   record-shop bin"). A component, not a plugin: artist pages (and anything else) call
     CadenceCoverFlow.html(items, { key, artist })   items: [{ id, title, date, type, cover, link }]
   and the markup comes alive by itself (a watcher finds new .cf blocks). Three ways to look, remembered per device:
     Cover Flow  the current sleeve faces you, the rest angle away on both sides, with a reflection
     Record bin  sleeves stand in a crate; flip through them and the current one lifts out
     Grid        the plain grid
   Wheel, drag or swipe, arrow keys, the slider, or click a sleeve to bring it forward. The current one shows its title,
   year, whether it's in your Discogs records or on your wantlist, a preview button and a link to MusicBrainz.
   The position is kept per artist, so a page redraw doesn't send you back to the start. */
(() => {
  if (window.CadenceCoverFlow) return;
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MODES = [['flow', 'Cover Flow'], ['bin', 'Record bin'], ['grid', 'Grid']];
  const mode = () => { try { const m = localStorage.getItem('cadence.cf.mode'); return MODES.some(x => x[0] === m) ? m : 'flow'; } catch { return 'flow'; } };
  const setMode = m => { try { localStorage.setItem('cadence.cf.mode', m); } catch {} };
  const at = new Map();          // key → current index, survives redraws
  const data = new Map();        // key → { items, artist }
  const icon = n => { try { return window.CadenceKit.icon(n); } catch { return ''; } };
  const year = d => String(d || '').slice(0, 4);
  const sleeve = (r, i) => `<button class="cf-it" data-i="${i}" aria-label="${E(r.title)}${year(r.date) ? ', ' + E(year(r.date)) : ''}" tabindex="-1">
      <span class="cf-art">${r.cover ? `<img src="${E(r.cover)}" alt="" loading="lazy" draggable="false" onerror="this.remove()">` : ''}<span class="cf-blank">${E(r.title)}</span></span></button>`;

  function html(items, { key, artist = '' } = {}) {
    if (!items || !items.length) return '';
    key = String(key || artist || 'cf');
    data.set(key, { items, artist });
    const m = mode();
    return `<div class="cf cf-${m}" data-cf="${E(key)}" data-mode="${m}" tabindex="0" role="group" aria-roledescription="carousel" aria-label="Albums${artist ? ' by ' + E(artist) : ''}">
      <div class="cf-bar" role="tablist" aria-label="How to show them">${MODES.map(([k, l]) => `<button role="tab" class="${k === m ? 'on' : ''}" aria-selected="${k === m}" data-cf-mode="${k}">${l}</button>`).join('')}</div>
      ${m === 'grid' ? `<div class="cf-grid">${items.map((r, i) => `<a class="cf-g" href="${E(r.link || '#')}" target="_blank" rel="noopener">${r.cover ? `<img src="${E(r.cover)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<span class="cf-blank">${E(r.title)}</span><b>${E(r.title)}</b><span class="muted">${E([year(r.date), r.type].filter(Boolean).join(' · '))}</span>${mark(artist, r.title)}</a>`).join('')}</div>`
        : `<div class="cf-stage">${m === 'bin' ? '<div class="cf-crate" aria-hidden="true"></div>' : ''}${items.map(sleeve).join('')}</div>
      <div class="cf-cap" aria-live="polite"></div>
      ${items.length > 1 ? `<input class="cf-scrub" type="range" min="0" max="${items.length - 1}" value="0" aria-label="Flip through">` : ''}`}
    </div>`;
  }
  const mark = (artist, title) => { try { return window.CadenceDiscogs ? window.CadenceDiscogs.chip(artist, title) : ''; } catch { return ''; } };

  // ---------- placing the sleeves ----------
  function place(root) {
    const key = root.dataset.cf, d = data.get(key); if (!d) return;
    const m = root.dataset.mode; if (m === 'grid') return;
    const n = d.items.length, cur = Math.max(0, Math.min(n - 1, at.get(key) || 0)); at.set(key, cur);
    const narrow = root.clientWidth < 560;
    root.querySelectorAll('.cf-it').forEach(el => {
      const i = +el.dataset.i, o = i - cur, a = Math.abs(o), s = Math.sign(o);
      let t, z, op = 1;
      if (m === 'flow') {
        const gap = narrow ? 34 : 52, first = narrow ? 110 : 165;
        t = o === 0 ? 'translate3d(-50%,0,140px)' : `translate3d(calc(-50% + ${s * (first + (a - 1) * gap)}px),0,0) rotateY(${-s * 62}deg)`;
        z = 500 - a; op = a > (narrow ? 5 : 8) ? 0 : 1;
      } else {
        // the bin: behind = further back and a touch higher; in front = tipped forward toward you; current = lifted out
        // each sleeve sits a little off true, like a real bin (steady per sleeve, not random each time)
        const jx = ((i * 37) % 9) - 4, jr = (((i * 53) % 7) - 3) * 0.4;
        if (o === 0) { t = 'translate3d(-50%,-34%,50px) rotateX(-8deg)'; z = 600; }
        else if (o > 0) { t = `translate3d(calc(-50% + ${jx}px),${-a * 13}px,${-a * 42}px) rotateX(-4deg) rotateZ(${jr}deg)`; z = 300 - a; op = a > 8 ? 0 : 1; }
        else { t = `translate3d(calc(-50% + ${jx}px),${-104 + a * 7}px,${30 + a * 6}px) rotateX(-70deg) rotateZ(${jr}deg)`; z = 560 - a; op = a > 4 ? 0 : 1; }
      }
      el.style.transform = t; el.style.zIndex = z; el.style.opacity = op;
      el.classList.toggle('cur', o === 0); el.setAttribute('aria-current', o === 0 ? 'true' : 'false');
    });
    const r = d.items[cur], cap = root.querySelector('.cf-cap');
    if (cap && r) cap.innerHTML = `<b>${E(r.title)}</b><span class="muted">${E([year(r.date), r.type, `${cur + 1} of ${n}`].filter(Boolean).join(' · '))}</span>${mark(d.artist, r.title)}
      <span class="cf-acts">${d.artist ? `<button class="btn sm" data-pv data-a="${E(d.artist)}" data-t="${E(r.title)}">${icon('play')} Preview</button>` : ''}${r.link ? `<a class="btn sm ghost" href="${E(r.link)}" target="_blank" rel="noopener">${icon('external-link')} MusicBrainz</a>` : ''}</span>`;
    const sc = root.querySelector('.cf-scrub'); if (sc && +sc.value !== cur) sc.value = cur;
  }
  const go = (root, to) => { const d = data.get(root.dataset.cf); if (!d) return; const n = d.items.length; const v = Math.max(0, Math.min(n - 1, to)); if (v === (at.get(root.dataset.cf) || 0)) return; at.set(root.dataset.cf, v); place(root); };
  const step = (root, k) => go(root, (at.get(root.dataset.cf) || 0) + k);

  // ---------- bringing new blocks to life ----------
  function wire(root) {
    if (root.dataset.cfReady) return; root.dataset.cfReady = '1';
    // first placement without the slide-in (a page redraw shouldn't make every sleeve fly into place again)
    root.classList.add('cf-still'); place(root); requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('cf-still')));
    let wheelAcc = 0, wheelT = 0;
    root.addEventListener('wheel', e => {
      if (root.dataset.mode === 'grid' || !e.target.closest('.cf-stage')) return;
      const dlt = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY; if (!dlt) return;
      e.preventDefault(); wheelAcc += dlt; clearTimeout(wheelT); wheelT = setTimeout(() => { wheelAcc = 0; }, 180);
      while (Math.abs(wheelAcc) >= 60) { step(root, Math.sign(wheelAcc)); wheelAcc -= Math.sign(wheelAcc) * 60; }
    }, { passive: false });
    let drag = null;
    root.addEventListener('pointerdown', e => { if (!e.target.closest('.cf-stage') || e.button !== 0) return; drag = { x: e.clientX, y: e.clientY, moved: 0, base: at.get(root.dataset.cf) || 0 }; });
    root.addEventListener('pointermove', e => {
      if (!drag) return; const bin = root.dataset.mode === 'bin';
      const dlt = bin ? (drag.y - e.clientY) : (drag.x - e.clientX); drag.moved = Math.max(drag.moved, Math.abs(dlt));
      if (drag.moved > 8) go(root, drag.base + Math.round(dlt / (bin ? 40 : 70)));
    });
    const end = () => { setTimeout(() => { drag = null; }, 0); };
    root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end); root.addEventListener('pointerleave', () => { drag = null; });
    root.addEventListener('click', e => {
      const mb = e.target.closest('[data-cf-mode]'); if (mb) { e.preventDefault(); const k = root.dataset.cf, d = data.get(k); setMode(mb.dataset.cfMode); const tmp = document.createElement('div'); tmp.innerHTML = html(d.items, { key: k, artist: d.artist }); const nr = tmp.firstElementChild; root.replaceWith(nr); wire(nr); nr.focus({ preventScroll: true }); return; }
      const it = e.target.closest('.cf-it'); if (!it) return;
      if (drag && drag.moved > 8) return;
      const i = +it.dataset.i, cur = at.get(root.dataset.cf) || 0;
      if (i !== cur) go(root, i);
      else { const d = data.get(root.dataset.cf), r = d.items[i]; if (r && r.link) window.open(r.link, '_blank', 'noopener'); }
    });
    root.addEventListener('keydown', e => {
      if (root.dataset.mode === 'grid' || e.target.closest('input,button.btn,a')) return;
      const k = e.key, bin = root.dataset.mode === 'bin';
      if (k === 'ArrowRight' || (bin && k === 'ArrowDown')) { e.preventDefault(); step(root, 1); }
      else if (k === 'ArrowLeft' || (bin && k === 'ArrowUp')) { e.preventDefault(); step(root, -1); }
      else if (k === 'Home') { e.preventDefault(); go(root, 0); }
      else if (k === 'End') { e.preventDefault(); go(root, 1e9); }
    });
    const sc = root.querySelector('.cf-scrub'); if (sc) sc.addEventListener('input', () => go(root, +sc.value));
    if (window.ResizeObserver) new ResizeObserver(() => place(root)).observe(root);
  }
  let pending = 0;
  const scan = () => { pending = 0; document.querySelectorAll('.cf:not([data-cf-ready])').forEach(wire); };
  new MutationObserver(() => { if (!pending) pending = requestAnimationFrame(scan); }).observe(document.documentElement, { childList: true, subtree: true });

  const css = document.createElement('style'); css.id = 'cf-css';
  css.textContent = `
    .cf{position:relative;outline:none;--cf-w:190px}
    .cf:focus-visible{box-shadow:0 0 0 2px var(--accent);border-radius:var(--r,8px)}
    .cf-bar{display:flex;gap:2px;background:var(--hover);border-radius:var(--r,8px);padding:3px;width:max-content;margin:0 0 10px auto}
    .cf-bar button{border:0;background:none;color:var(--muted);font:inherit;font-size:12.5px;padding:4px 10px;border-radius:calc(var(--r,8px) - 2px);cursor:pointer}
    .cf-bar button.on{background:var(--panel);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.08)}
    .cf-stage{position:relative;height:300px;perspective:900px;overflow:hidden;touch-action:pan-y;user-select:none;-webkit-user-select:none;cursor:grab}
    .cf-stage:active{cursor:grabbing}
    .cf-it{position:absolute;left:50%;top:22px;width:var(--cf-w);aspect-ratio:1;padding:0;border:0;background:none;cursor:pointer;
      transition:transform .45s cubic-bezier(.2,.8,.2,1),opacity .3s;transform-origin:50% 50%;will-change:transform}
    .cf-art{position:absolute;inset:0;border-radius:3px;overflow:hidden;background:linear-gradient(135deg,#3b3b46,#1d1d24);box-shadow:0 10px 24px rgba(0,0,0,.28)}
    .cf-flow .cf-art{-webkit-box-reflect:below 3px linear-gradient(transparent 62%,rgba(255,255,255,.22))}
    .cf-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1}
    .cf-blank{position:absolute;inset:0;display:grid;place-items:center;padding:14px;text-align:center;color:#e9e9ef;font-weight:650;font-size:14px;line-height:1.25}
    .cf-it.cur .cf-art{box-shadow:0 16px 40px rgba(0,0,0,.35)}
    .cf-cap{display:flex;flex-direction:column;align-items:center;gap:3px;text-align:center;min-height:86px;margin-top:6px}
    .cf-cap b{font-size:15px;font-weight:650}
    .cf-acts{display:flex;gap:6px;margin-top:6px}.cf-acts svg{width:14px;height:14px}.cf-acts .btn{display:inline-flex;gap:5px;align-items:center}
    .cf-scrub{display:block;width:min(420px,80%);margin:8px auto 0;accent-color:var(--accent)}
    /* the bin: a wooden crate seen from just above, sleeves standing in it */
    .cf-bin .cf-stage{height:330px;perspective:700px;perspective-origin:50% -40%}
    .cf-bin .cf-it{top:118px;--cf-w:200px;transform-origin:50% 100%}
    .cf-bin .cf-art{border-radius:2px;box-shadow:0 -2px 10px rgba(0,0,0,.25)}
    .cf-crate{position:absolute;left:50%;bottom:0;width:min(340px,92%);height:122px;transform:translateX(-50%);z-index:500;border-radius:4px 4px 2px 2px;
      background:repeating-linear-gradient(0deg,#8a5a34 0 38px,#6f4526 38px 41px),#7a4d2c;box-shadow:inset 0 3px 0 rgba(255,255,255,.18),0 8px 18px rgba(0,0,0,.25)}
    .cf-crate::after{content:"";position:absolute;left:50%;top:30px;width:64px;height:16px;transform:translateX(-50%);border-radius:10px;background:rgba(0,0,0,.45)}
    .cf-bin .cf-it.cur{z-index:700!important}
    .cf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px}
    .cf-g{position:relative;display:flex;flex-direction:column;gap:2px;color:inherit;text-decoration:none;font-size:13px}
    .cf-g img,.cf-g>.cf-blank{width:100%;aspect-ratio:1;object-fit:cover;border-radius:4px;background:linear-gradient(135deg,#3b3b46,#1d1d24)}
    .cf-g>.cf-blank{position:relative;font-size:12px}.cf-g img+.cf-blank{display:none}
    @media (max-width:640px){.cf{--cf-w:150px}.cf-stage{height:240px}.cf-bin .cf-stage{height:280px}.cf-bin .cf-it{--cf-w:160px;top:104px}}
    @media (prefers-reduced-motion:reduce){.cf-it{transition:none}} .cf-still .cf-it{transition:none!important}`;
  document.head.appendChild(css);

  window.CadenceCoverFlow = { html, place: root => place(root) };
})();
