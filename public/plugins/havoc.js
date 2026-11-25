/* Havoc — wreck the Cadence page itself. Two engines, switched from the toolbar:
     Physics  — vendor/havoc-engine.js (Matter.js): the words float, fly and explode; its fire, lava, acid, rain and
                blasts are played out as real Elements matter (one Havoc: user, 2026-11-18)
     Elements — vendor/elements-engine.js (falling sand): the page becomes matter you can burn, flood, freeze and bury
   Shift+H (or the command palette) opens the one you used last. Esc restores everything. */
(() => {
  const MODE_KEY = 'cadence.havoc';   // 'physics' | 'elements', follows you between devices
  const load = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); });
  const v = () => '?v=' + Date.now().toString(36).slice(0, -3);
  const mode = () => { try { return localStorage.getItem(MODE_KEY) === 'elements' ? 'elements' : 'physics'; } catch { return 'physics'; } };
  const remember = m => { try { localStorage.setItem(MODE_KEY, m); } catch {} };
  const running = () => (window.__havoc && window.__havoc.active) || (window.__elements && window.__elements.active);
  let loadingPhysics = null, loadingElements = null;

  async function open(api, m) {
    try {
      if (m === 'elements') {
        if (!window.ElementsWorld) { loadingElements = loadingElements || load('vendor/elements-engine.js' + v()); await loadingElements; }
        window.__elements = window.__elements || window.ElementsWorld.create({ kind: 'havoc' });
        window.__elements.start();
      } else {
        if (window.__havoc) return window.__havoc.start();
        loadingPhysics = loadingPhysics || (async () => { if (!window.Matter) await load('vendor/matter.min.js'); await load('vendor/havoc-engine.js' + v()); })();
        await loadingPhysics;
      }
    } catch (e) {
      if (m === 'elements') loadingElements = null; else loadingPhysics = null;
      api.ui.toast('Havoc needs its engine files (vendor/) — ' + e.message);
    }
  }
  function unleash(api, m) {
    if (running()) { window.__havoc && window.__havoc.stop(); window.__elements && window.__elements.stop(); return; }
    open(api, m || mode());
  }

  // Tilt to pour (2026-11-24, user: "it needs to be a setting you can turn off and on and not on by default"): the
  // phone's left-right tilt, -1 … 1, for both Havoc modes while one is open. Remembered on this device; iOS asks for
  // motion access the first time it's turned on.
  const TILT_KEY = 'cadence.havoc.tilt';
  const Tilt = window.CadenceTilt = {
    subs: new Set(), v: 0, live: false, last: 0,
    supported: () => typeof DeviceOrientationEvent !== 'undefined' && matchMedia('(hover: none) and (pointer: coarse)').matches,
    wanted() { try { return localStorage.getItem(TILT_KEY) === '1'; } catch { return false; } },
    async set(on) {
      if (on && !window.isSecureContext) {   // iPhones only give motion to pages on a secure (https) address
        try { window.CadenceIsland && window.CadenceIsland.toast('Tilt needs THING\'s secure address: open it with https:// (once its certificate is installed on this phone)'); } catch {}
        on = false;
      } else if (on && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try { if (await DeviceOrientationEvent.requestPermission() !== 'granted') on = false; } catch { on = false; }
        if (!on) try { window.CadenceIsland && window.CadenceIsland.toast('Tilt needs motion access. If you said no, close and reopen the page to be asked again'); } catch {}
      }
      try { on ? localStorage.setItem(TILT_KEY, '1') : localStorage.removeItem(TILT_KEY); } catch {}
      if (on && Tilt.subs.size) Tilt.attach(); else Tilt.detach();
      return on;
    },
    onOrient(e) {
      const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
      Tilt.got = true;
      const g = ang === 90 ? e.beta : (ang === -90 || ang === 270) ? -e.beta : ang === 180 ? -e.gamma : e.gamma;
      if (g == null) return;
      let v = Math.max(-1, Math.min(1, g / 40)); if (Math.abs(v) < 0.08) v = 0;
      v = Tilt.v + (v - Tilt.v) * 0.35;
      const now = performance.now();
      if (Math.abs(v - Tilt.v) > 0.03 || now - Tilt.last > 250) { Tilt.v = v; Tilt.last = now; Tilt.subs.forEach(f => f(v)); }
    },
    attach() {
      if (!Tilt.live && Tilt.supported()) {
        Tilt.live = true; Tilt.got = false; addEventListener('deviceorientation', Tilt.onOrient);
        clearTimeout(Tilt.chk); Tilt.chk = setTimeout(() => { if (Tilt.live && !Tilt.got) try { window.CadenceIsland && window.CadenceIsland.toast('Tilt is on but the phone isn\'t sending motion. Check Settings → Safari → Motion & Orientation Access'); } catch {} }, 2500);
      }
    },
    detach() { if (Tilt.live) { Tilt.live = false; removeEventListener('deviceorientation', Tilt.onOrient); } Tilt.v = 0; Tilt.subs.forEach(f => f(0)); },
    listen(fn) { Tilt.subs.add(fn); if (Tilt.wanted()) Tilt.attach(); return () => { Tilt.subs.delete(fn); fn(0); if (!Tilt.subs.size) Tilt.detach(); }; },
  };

  // ---- the phone as a Havoc controller (2026-11-24) --------------------------------------------------------------
  // Mac side: while Havoc is open (either mode) it listens on api/havoc/remote/host and acts out what the phone sends:
  // tilt goes to the same place as the phone's own tilt, touches become pointer events at the same spot on this
  // screen (a ring shows where), tool keys become key presses. Phone side: a controller with a touchpad shaped like
  // the Mac's screen, the Mac's tools by name, and Tilt. All through the NAS on the home network; nothing is stored.
  const R = window.CadenceHavocRemote = { es: null, ring: null, tgt: null, mode: '' };
  const hostInfo = () => {
    const el = window.__elements && window.__elements.active, mode = el ? 'elements' : 'physics';
    const tools = el ? (window.__elements.toolList ? window.__elements.toolList() : []) : (window.__havoc && window.__havoc.toolList ? window.__havoc.toolList() : []);
    return { mode, w: innerWidth, h: innerHeight, tools };
  };
  function hostReport() { try { fetch('api/havoc/remote/host', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(hostInfo()) }).catch(() => {}); } catch {} }
  function ring(x, y, on) {
    if (!R.ring) { R.ring = document.createElement('div'); R.ring.style.cssText = 'position:fixed;z-index:2147483647;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:2px solid rgba(255,255,255,.9);box-shadow:0 0 0 2px rgba(0,0,0,.35),0 0 18px rgba(120,170,255,.6);pointer-events:none;transition:opacity .25s,transform .12s'; document.documentElement.appendChild(R.ring); }
    R.ring.style.left = x + 'px'; R.ring.style.top = y + 'px'; R.ring.style.opacity = on ? '1' : '0'; R.ring.style.transform = on ? 'scale(1)' : 'scale(.6)';
  }
  function fire(type, x, y, target) {
    let t = target;
    if (!t) { t = document.elementFromPoint(x, y); while (t && t.shadowRoot) { const inner = t.shadowRoot.elementFromPoint(x, y); if (!inner || inner === t) break; t = inner; } }   // Havoc's layers are in shadow roots
    t = t || document.body; const o = { clientX: x, clientY: y, bubbles: true, cancelable: true, composed: true, button: 0, buttons: type.endsWith('up') ? 0 : 1 };
    try { t.dispatchEvent(new PointerEvent('pointer' + type, { ...o, pointerId: 77, pointerType: 'mouse', isPrimary: true })); } catch {}
    try { t.dispatchEvent(new MouseEvent('mouse' + type, o)); } catch {}
    return t;
  }
  function hostMsg(m, api) {
    if (m.t === 'tilt') { if (window.CadenceTilt) window.CadenceTilt.subs.forEach(f => f(m.v)); return; }
    if (m.t === 'down' || m.t === 'move' || m.t === 'up') {
      const x = m.x * innerWidth, y = m.y * innerHeight;
      if (m.t === 'down') R.tgt = fire('down', x, y); else if (m.t === 'move') { if (R.tgt) fire('move', x, y, R.tgt); } else { fire('up', x, y, R.tgt); R.tgt = null; }
      ring(x, y, m.t !== 'up'); return;
    }
    if (m.t === 'key') { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: m.key, bubbles: true, cancelable: true })); setTimeout(hostReport, 80); return; }
    if (m.t === 'hello') { try { api.ui.toast('Your phone is controlling Havoc'); } catch {} hostReport(); }
  }
  function hostOn(api) {
    if (R.es || typeof EventSource === 'undefined') return;
    R.es = new EventSource('api/havoc/remote/host');
    R.es.onopen = hostReport;
    R.es.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } hostMsg(m, api); };
  }
  function hostOff() { if (R.es) { R.es.close(); R.es = null; } if (R.ring) R.ring.style.opacity = '0'; }

  // phone side
  const post = b => fetch('api/havoc/remote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).catch(() => {});
  async function controller(api) {
    let info = null; try { info = await (await fetch('api/havoc/remote', { cache: 'no-store' })).json(); } catch {}
    if (!info || !info.open) { api.ui.toast('Open Havoc on your Mac first (Shift+H), then try again'); return; }
    if (document.getElementById('hv-remote')) return;
    const box = document.createElement('div'); box.id = 'hv-remote';
    box.innerHTML = `<style>
      #hv-remote{position:fixed;inset:0;z-index:2147483646;background:#121218;color:#eceaf4;display:flex;flex-direction:column;padding:calc(12px + env(safe-area-inset-top)) 12px calc(12px + env(safe-area-inset-bottom));gap:10px;font:500 13px/1.2 Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;touch-action:none;-webkit-user-select:none;user-select:none}
      #hv-remote .hd{display:flex;align-items:center;gap:8px}#hv-remote .hd b{flex:1;font-weight:700;letter-spacing:.08em;font-size:12px}
      #hv-remote .hd i{width:8px;height:8px;border-radius:50%;background:#ff7a1f;box-shadow:0 0 8px #ff7a1f}
      #hv-remote button{all:unset;cursor:pointer;border-radius:12px;padding:8px 10px;background:rgba(255,255,255,.07);text-align:center}
      #hv-remote button.on{background:color-mix(in srgb,var(--c,#fff) 22%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--c,#fff) 60%,transparent);color:#fff}
      #hv-remote .pad{position:relative;align-self:center;width:100%;border-radius:16px;background:radial-gradient(circle at 50% 40%,#232331,#16161f);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1);touch-action:none}
      #hv-remote .pad span{position:absolute;inset:0;display:grid;place-items:center;color:rgba(255,255,255,.35);font-size:12px;pointer-events:none}
      #hv-remote .pad .dot{position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:2px solid #fff;opacity:0;pointer-events:none}
      #hv-remote .tools{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;overflow:auto;flex:1;align-content:start}
      #hv-remote .tools button{font-size:12px;padding:10px 4px}
    </style>
    <div class="hd"><i></i><b>HAVOC ON YOUR MAC</b><button data-tilt>Tilt</button><button data-x aria-label="Stop controlling">Done</button></div>
    <div class="pad"><span>Tap or drag here: it happens on your Mac</span><div class="dot"></div></div>
    <div class="tools"></div>`;
    document.documentElement.appendChild(box); document.documentElement.classList.add('havoc-open');
    const pad = box.querySelector('.pad'), dot = box.querySelector('.dot'), tools = box.querySelector('.tools');
    const fit = () => { const ar = (info.w || 1440) / (info.h || 900), W = box.clientWidth - 24, H = Math.min(innerHeight * 0.5, W / ar); pad.style.height = H + 'px'; pad.style.width = (H * ar) + 'px'; };
    let cur = info.tool || '';
    const drawTools = () => { tools.innerHTML = (info.tools || []).map(t => `<button data-key="${esc(t.key)}" data-id="${esc(t.id)}" style="--c:${esc(t.color || '#fff')}" class="${t.id === cur ? 'on' : ''}">${esc(t.name)}</button>`).join(''); };
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    fit(); drawTools(); addEventListener('resize', fit);
    post({ t: 'hello' });
    tools.addEventListener('click', e => { const b = e.target.closest('button[data-key]'); if (!b) return; cur = b.dataset.id; post({ t: 'key', key: b.dataset.key }); tools.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
    // touches: normalized to the Mac's screen; moves at most ~30 a second
    let last = 0, downNow = false;
    const at = e => { const r = pad.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)), px: e.clientX - r.left, py: e.clientY - r.top }; };
    const show = (q, on) => { dot.style.left = q.px + 'px'; dot.style.top = q.py + 'px'; dot.style.opacity = on ? '1' : '0'; };
    pad.addEventListener('pointerdown', e => { e.preventDefault(); downNow = true; try { pad.setPointerCapture(e.pointerId); } catch {} const q = at(e); show(q, true); post({ t: 'down', x: q.x, y: q.y }); });
    pad.addEventListener('pointermove', e => { if (!downNow) return; const now = performance.now(); if (now - last < 33) return; last = now; const q = at(e); show(q, true); post({ t: 'move', x: q.x, y: q.y }); });
    const up = e => { if (!downNow) return; downNow = false; const q = at(e); show(q, false); post({ t: 'up', x: q.x, y: q.y }); };
    pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
    // tilt: the phone's own reading, sent to the Mac
    const tb = box.querySelector('[data-tilt]'); let unT = null;
    const tiltOn = () => { if (unT) return; unT = Tilt.listen(v => post({ t: 'tilt', v })); tb.classList.add('on'); };
    if (Tilt.wanted()) tiltOn();
    tb.onclick = async () => { if (unT) { const u = unT; unT = null; u(); tb.classList.remove('on'); post({ t: 'tilt', v: 0 }); Tilt.set(false); return; } if (await Tilt.set(true)) tiltOn(); };
    // the Mac's tools change when it switches mode
    const poll = setInterval(async () => { try { const i = await (await fetch('api/havoc/remote', { cache: 'no-store' })).json(); if (!i.open) { close(); api.ui.toast('Havoc closed on your Mac'); return; } if (i.mode !== info.mode || (i.tools || []).length !== (info.tools || []).length) { info = i; fit(); drawTools(); } } catch {} }, 3000);
    function close() { clearInterval(poll); removeEventListener('resize', fit); if (unT) { const u = unT; unT = null; u(); post({ t: 'tilt', v: 0 }); } box.remove(); document.documentElement.classList.remove('havoc-open'); }
    box.querySelector('[data-x]').onclick = close;
  }
  R.controller = controller;

  Cadence.registerPlugin({
    id: 'havoc', name: 'Havoc', version: '1.1.0', icon: '<path d="M12 2.5l2 5.5 5.5-1.5-3.8 4.5 4.8 3.5-5.8.8.8 5.7-3.5-3.8-3.5 3.8.8-5.7-5.8-.8 4.8-3.5L4.5 6.5 10 8z"/>', color: '#f76b15', category: 'Fun', tagline: 'Wreck the page with physics, or turn it into sand, fire and water',
    description: 'Blow off steam: blast, melt or black-hole the THING page, or switch to Elements and burn, flood, freeze and bury it. Shift+H to unleash, Esc to restore.',
    setup(api) {
      api.commands.add({ title: 'Havoc: wreck this page', icon: 'bomb', hint: '⇧H', run: api => unleash(api) });
      api.commands.add({ title: 'Havoc: control it from this phone', icon: 'smartphone', run: api => controller(api) });
      // the Mac listens for a phone while Havoc is open (either mode)
      new MutationObserver(() => {
        const on = document.documentElement.classList.contains('havoc-open') && !document.getElementById('hv-remote') && !matchMedia('(hover: none) and (pointer: coarse)').matches;
        if (on) { hostOn(api); setTimeout(hostReport, 300); } else if (!document.documentElement.classList.contains('havoc-open')) hostOff();
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      // a phone: when Havoc opens on the Mac, offer to control it (once per opening)
      if (matchMedia('(hover: none) and (pointer: coarse)').matches && !api.system().demo) {
        let offered = false;
        setInterval(async () => {
          if (document.hidden || document.getElementById('hv-remote')) return;
          try { const i = await (await fetch('api/havoc/remote', { cache: 'no-store' })).json();
            if (i.open && !offered) { offered = true; window.CadenceIsland && window.CadenceIsland.show({ title: 'Havoc is open on your Mac', sub: 'Control it from here', ms: 9000, actions: [{ label: 'Control it', run: () => controller(api) }] }); }
            if (!i.open) offered = false;
          } catch {}
        }, 6000);
      }
      api.commands.add({ title: 'Elements: turn this page into sand, fire and water', icon: 'flame', run: api => { remember('elements'); unleash(api, 'elements'); } });
      // Physics mode plays out in real matter too: a blast leaves fire and scatters sand, melt pours lava, rain is real
      // water that puddles on the cards, and a black hole swallows the matter around it
      window.__havocFx && removeEventListener('havoc:fx', window.__havocFx);
      window.__havocFx = e => {
        const d = e.detail || {}; if (!window.CadenceFX) return;
        if (d.type === 'rain' || d.type === 'stop') {
          window.CadenceFX.want('havoc', d.type === 'rain' && d.on ? { rain: 7 } : null);
          // the pictures' pixels go with the mess when Havoc stops
          if (d.type === 'stop') window.CadenceFX.world().then(w => { if (w && w.M.PIXEL != null) { w.clear(w.M.PIXEL); w.clear(w.M.DRIP); } if (w && w.unstamp) w.unstamp(); }, () => {});
          return;
        }
        window.CadenceFX.world().then(w => {
          if (!w) return;
          if (d.type === 'blast') { w.explode(d.x, d.y, 7); w.spawn(d.x, d.y, w.M.FIRE, 5, 0.5, 15, 40); w.spawn(d.x, d.y + 10, w.M.SAND, 6, 0.4); }
          else if (d.type === 'melt') { w.spawn(d.x, d.y, w.M.LAVA, 4, 0.75); w.heatAt(d.x, d.y, 800, 2); }
          // Fire and Acid tools: the flames sit on a splash of oil so they keep burning; acid eats what it lands on
          else if (d.type === 'fire') { w.spawn(d.x, d.y + 4, w.M.OIL, 4, 0.5); w.spawn(d.x, d.y, w.M.FIRE, 6, 0.65, 30, 80); }
          else if (d.type === 'acid') w.spawn(d.x, d.y, w.M.ACID, 4, 0.7);
          // a picture bursts into its pixels (2026-11-19): one colour per cell, read from Havoc's copy of the picture.
          // A picture from another site can't be read (the browser won't allow it): it bursts in its average-looking grey
          else if (d.type === 'pixels') {
            const c = w.cellSize || 3, cw = Math.max(1, Math.round(d.w / c)), ch = Math.max(1, Math.round(d.h / c));
            let px;
            try { const t = document.createElement('canvas'); t.width = cw; t.height = ch; const g = t.getContext('2d', { willReadFrequently: true }); g.drawImage(d.canvas, 0, 0, cw, ch); px = g.getImageData(0, 0, cw, ch).data; }
            catch (e) { px = new Uint8ClampedArray(cw * ch * 4); for (let i = 0; i < px.length; i += 4) { const v = 120 + ((i * 7919) % 50); px[i] = v; px[i + 1] = v; px[i + 2] = v + 8; px[i + 3] = 255; } }
            w.pixels(d.left, d.top, cw, ch, px, d.x, d.y, d.power || 2.4);
          }
          else if (d.type === 'hole') { if (w.sink) w.sink(d.x, d.y, 280, 7); else { let n = 0; const iv = setInterval(() => { w.clearAt(d.x, d.y, 30 + n * 6); if (++n > 60) clearInterval(iv); }, 110); } }
        });
      };
      addEventListener('havoc:fx', window.__havocFx);
      // either toolbar's Physics / Elements switch: the engine has already stopped, start the other one
      window.__havocMode && removeEventListener('havoc:mode', window.__havocMode);
      window.__havocMode = e => { const m = e.detail === 'elements' ? 'elements' : 'physics'; remember(m); setTimeout(() => open(api, m), 60); };
      addEventListener('havoc:mode', window.__havocMode);
      window.__havocKey && removeEventListener('keydown', window.__havocKey);
      window.__havocKey = e => {
        if (e.key !== 'H' || !e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
        if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
        if (window.__elements && window.__elements.active) return;   // Elements handles its own Shift+H
        e.preventDefault(); unleash(api);
      };
      addEventListener('keydown', window.__havocKey);
    }
  });
})();
