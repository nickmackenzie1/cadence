/* Island — a Dynamic-Island-style pill at the top of the app.
   Idle: the time and a sync dot. It morphs open for things that happen (task done, saving,
   reminders, startup), and holds "live activities" (a running meeting, later: now playing).
   Other plugins: window.CadenceIsland.show({...}), .live(key, {...}), .clear(key). */
(() => {
  const G = window.__island = window.__island || {};
  if (!G.el) {
    const st = document.createElement('style');
    st.textContent = `
      .isl{position:fixed;top:10px;left:calc(276px + (100vw - 276px) / 2);transform:translateX(-50%);z-index:80;pointer-events:none}
      @media (max-width:900px){.isl{left:50%}}
      /* themed: at rest it is part of the UI (panel colour, hairline border); a notice makes it surface */
      .isl-pill{--isl-fg:var(--text,#1d1c1a);--isl-sub:var(--muted,#8a877f);--isl-line:var(--line,#e7e4dd);--isl-hover:var(--hover,rgba(0,0,0,.04));--glow:var(--accent,#5b5bd6);
        pointer-events:auto;position:relative;color:var(--isl-fg);border-radius:22px;overflow:hidden;
        background:color-mix(in srgb,var(--panel,#fff) 72%,transparent);-webkit-backdrop-filter:blur(14px) saturate(1.4);backdrop-filter:blur(14px) saturate(1.4);
        box-shadow:0 0 0 1px var(--isl-line) inset,0 1px 2px rgba(0,0,0,.04);
        width:var(--w,120px);height:var(--h,30px);transform:translateY(0) scale(1);
        transition:width .75s cubic-bezier(.32,1.22,.42,1),height .75s cubic-bezier(.32,1.22,.42,1),border-radius .75s cubic-bezier(.32,1.22,.42,1),box-shadow .6s ease,background .6s ease,transform .6s cubic-bezier(.3,1.5,.5,1);cursor:default;font:500 12.5px/1.25 Inter,ui-sans-serif,system-ui,sans-serif}
      .isl-pill.big{border-radius:24px}
      .isl-pill.up{background:var(--panel,#fff);transform:translateY(4px) scale(1.02);
        box-shadow:0 0 0 1px color-mix(in srgb,var(--glow) 38%,var(--isl-line)) inset,0 14px 38px -8px rgba(0,0,0,.22),0 4px 12px rgba(0,0,0,.06),0 0 0 5px color-mix(in srgb,var(--glow) 12%,transparent),0 10px 44px -6px color-mix(in srgb,var(--glow) 45%,transparent)}
      .isl-pill.up::before{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:radial-gradient(120% 140% at 50% -30%,color-mix(in srgb,var(--glow) 16%,transparent),transparent 70%)}
      .isl-pill.ping::after{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;box-shadow:0 0 0 0 color-mix(in srgb,var(--glow) 55%,transparent);animation:islring .9s ease-out}
      @keyframes islring{to{box-shadow:0 0 0 14px transparent}}
      [data-theme=dark] .isl-pill{background:color-mix(in srgb,var(--panel,#1b1b1e) 80%,transparent);box-shadow:0 0 0 1px var(--isl-line) inset}
      [data-theme=dark] .isl-pill.up{background:color-mix(in srgb,var(--panel,#1b1b1e) 88%,#fff);
        box-shadow:0 0 0 1px color-mix(in srgb,var(--glow) 50%,transparent) inset,0 16px 44px -8px rgba(0,0,0,.6),0 0 0 5px color-mix(in srgb,var(--glow) 16%,transparent),0 8px 50px -4px color-mix(in srgb,var(--glow) 55%,transparent)}
      @media (prefers-reduced-motion:reduce){.isl-pill,.isl-pill.up{transform:none}.isl-pill.ping::after{animation:none}}
      .isl-pill.click{cursor:pointer}
      .isl-c{position:absolute;inset:0;display:flex;align-items:center;gap:10px;padding:0 14px;white-space:nowrap;transition:opacity .38s ease, filter .45s ease, transform .6s cubic-bezier(.32,1.2,.42,1)}
      .isl-c.leaving{opacity:0;filter:blur(6px);transform:scale(.94);transition-duration:.28s,.3s,.35s}
      .isl-c.entering{opacity:0;filter:blur(6px);transform:scale(1.04) translateY(2px)}
      .isl-c.stack{flex-direction:column;align-items:stretch;justify-content:center;gap:7px;padding:9px 14px 10px;white-space:nowrap}
      .isl-row{display:flex;align-items:center;gap:10px;min-width:0}
      .isl-ico{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;flex:none;font-size:13px;background:var(--ic,#2a2833);color:#fff}
      .isl-t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;max-width:300px}
      .isl-t b{font-weight:600;color:var(--isl-fg)}
      .isl-t small{display:block;color:var(--isl-sub);font-size:11px;margin-top:1px;overflow:hidden;text-overflow:ellipsis}
      .isl-right{color:var(--isl-sub);font-variant-numeric:tabular-nums;font-size:12px;flex:none}
      .isl-acts{display:flex;gap:2px;justify-content:flex-end;margin-right:-6px}
      .isl-acts.inline{margin:0 -6px 0 4px;flex:none}
      .isl-acts button{background:none;color:var(--isl-sub);border-radius:999px;padding:5px 8px;font:600 12px/1 Inter,ui-sans-serif,system-ui;border:0;cursor:pointer;transition:color .15s,background .15s}
      .isl-acts button:hover{color:var(--isl-fg);background:var(--isl-hover)}
      .isl-acts button.pri{color:var(--accent,#5b5bd6)}
      .isl-acts button.pri:hover{color:var(--accent,#5b5bd6);background:color-mix(in srgb,var(--accent,#5b5bd6) 12%,transparent)}
      .isl-sep{width:1px;height:14px;background:var(--isl-line);flex:none;margin-left:2px}
      .isl-dot{width:7px;height:7px;border-radius:50%;background:#3fc37a;flex:none;box-shadow:0 0 0 3px rgba(63,195,122,.18);transition:background .3s, box-shadow .3s}
      .isl-dot.busy{background:#f5b041;box-shadow:0 0 0 3px rgba(245,176,65,.22);animation:islp 1s infinite}
      .isl-dot.err{background:#ff5a5a;box-shadow:0 0 0 3px rgba(255,90,90,.22)}
      .isl-dot.off{background:var(--faint,#b9b5ac);box-shadow:none}
      .isl-dot.rec{background:#ff3b3b;box-shadow:0 0 0 3px rgba(255,59,59,.25);animation:islp 1.4s infinite}
      @keyframes islp{50%{opacity:.45}}
      .isl-time{font-variant-numeric:tabular-nums;color:var(--isl-fg);font-weight:600;letter-spacing:.01em}
      .isl-check{width:20px;height:20px;border-radius:50%;background:#3fc37a;display:grid;place-items:center;flex:none}
      .isl-check svg{width:13px;height:13px;stroke:#fff;stroke-width:3;fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:20;stroke-dashoffset:20;animation:islck .45s .12s forwards}
      @keyframes islck{to{stroke-dashoffset:0}}
      .isl-spin{width:14px;height:14px;border:2px solid var(--isl-line);border-top-color:var(--accent,#5b5bd6);border-radius:50%;animation:islsp .7s linear infinite;flex:none}
      @keyframes islsp{to{transform:rotate(360deg)}}
      .isl-bar{height:3px;border-radius:var(--r-m);background:var(--isl-line);overflow:hidden}
      .isl-bar i{display:block;height:100%;background:linear-gradient(90deg,#5b5bd6,#b06bd6,#ff7a8a);transition:width .35s}
      .isl-img{width:20px;height:20px;flex:none;display:grid;place-items:center}
      .isl-img img{width:20px;height:20px;border-radius:var(--r-s);object-fit:cover;display:block}
      .isl-img .av{width:20px!important;height:20px!important}
      .isl-row+.isl-bar{margin-top:-1px}
      /* celebrate */
      .isl-pill.cel.up{box-shadow:0 0 0 1px color-mix(in srgb,var(--glow) 45%,transparent) inset,0 18px 50px -8px rgba(0,0,0,.28),0 0 0 6px color-mix(in srgb,var(--glow) 16%,transparent),0 0 56px -4px color-mix(in srgb,var(--glow) 65%,transparent)}
      .isl-cel{position:relative;display:flex;align-items:center;gap:12px;padding:2px 2px 2px 0;min-width:260px}
      .isl-badge{width:40px;height:40px;border-radius:var(--r-l);flex:none;display:grid;place-items:center;font-size:22px;background:radial-gradient(circle at 30% 25%,color-mix(in srgb,var(--ic) 70%,#fff),var(--ic) 60%,color-mix(in srgb,var(--ic) 70%,#000));box-shadow:0 0 0 1px rgba(255,255,255,.18) inset,0 6px 18px -4px var(--ic);animation:islpop .7s cubic-bezier(.3,1.6,.5,1) both}
      .isl-badge .av{width:40px!important;height:40px!important;border-radius:var(--r-l)!important}
      .isl-eye{display:block;font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--ic);margin-bottom:1px}
      .isl-cel .isl-t b{font-size:14px}
      .isl-xp{font:800 13px/1 Inter,ui-sans-serif,system-ui;color:#16151a;background:var(--ic);padding:5px 8px;border-radius:999px;flex:none;animation:islpop .6s .25s cubic-bezier(.3,1.6,.5,1) both}
      .isl-shine{position:absolute;inset:-12px -20px;background:linear-gradient(105deg,transparent 35%,color-mix(in srgb,var(--glow) 22%,transparent) 50%,transparent 65%);transform:translateX(-100%);animation:islshine 1.4s .3s ease-out;pointer-events:none}
      .isl-cel i{position:absolute;top:50%;left:var(--x);width:4px;height:7px;border-radius:1px;background:var(--c);opacity:0;animation:islconf 1.1s var(--d) ease-out both;pointer-events:none}
      @keyframes islpop{from{transform:scale(.3) rotate(-14deg);opacity:0}}
      @keyframes islshine{to{transform:translateX(100%)}}
      @keyframes islconf{0%{opacity:1;transform:translateY(0) rotate(0)}100%{opacity:0;transform:translateY(-34px) rotate(260deg)}}
      .isl-measure{position:fixed;left:-9999px;top:0;visibility:hidden}
      .isl-bell{display:inline-flex;align-items:center;gap:3px;margin-left:8px;padding:2px 7px 2px 5px;border-radius:999px;background:var(--glow);color:#fff;font:700 11px/1 Inter,system-ui}.isl-bell svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2.2}
    `;
    document.head.appendChild(st);
    G.el = document.createElement('div'); G.el.className = 'isl';
    G.el.innerHTML = '<div class="isl-pill"></div>';
    document.body.appendChild(G.el);
    G.pill = G.el.firstChild;
    G.queue = []; G.lives = new Map(); G.cur = null; G.sync = 'ok'; G.badge = 0;
  }
  const esc = window.CadenceKit.esc;
  const checkSvg = '<span class="isl-check"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>';

  /* ---- morph engine ---- */
  function measure(html, stack) {
    const m = document.createElement('div'); m.className = 'isl-measure';
    m.innerHTML = `<div class="isl-c ${stack ? 'stack' : ''}" style="position:static;display:inline-flex;max-width:${Math.min(360, innerWidth - 60)}px">${html}</div>`;
    document.body.appendChild(m); const r = m.firstChild.getBoundingClientRect(); m.remove();
    return { w: Math.ceil(r.width), h: Math.ceil(r.height) };
  }
  function morph(view) {
    const p = G.pill, stack = !!view.stack;
    const size = view.size || measure(view.html, stack);
    const w = Math.min(innerWidth - 40, Math.max(view.minW || 0, size.w)), h = Math.max(30, stack ? size.h : (view.h || 30));
    p.style.setProperty('--w', w + 'px'); p.style.setProperty('--h', h + 'px');
    p.classList.toggle('big', h > 34 || stack); p.classList.toggle('click', !!view.onClick);
    p.onclick = view.onClick ? (e => { if (!e.target.closest('button')) view.onClick(); }) : null;
    const old = p.querySelector('.isl-c:not(.leaving)');
    const c = document.createElement('div'); c.className = 'isl-c entering' + (stack ? ' stack' : ''); c.innerHTML = view.html;
    p.appendChild(c); setTimeout(() => c.classList.remove('entering'), old ? 140 : 40);
    if (old) { old.classList.add('leaving'); setTimeout(() => old.remove(), 380); }
    (view.actions || []).forEach((a, i) => { const b = c.querySelector(`[data-ai="${i}"]`); if (b) b.onclick = e => { e.stopPropagation(); a.run(); dismiss(); }; });
    return c;
  }

  /* ---- idle / live ---- */
  function idleView() {
    const live = [...G.lives.values()].sort((a, b) => (b.prio || 0) - (a.prio || 0))[0];
    if (live) { const v = live.view(); return G.badge && !v.onClick ? { ...v, html: v.html + bell(), onClick: G.panelFn ? () => G.panelFn(G.pill) : null } : v; }
    const t = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return { html: `<span class="isl-dot ${G.sync}"></span><span class="isl-time">${t}</span>${bell()}`, onClick: G.panelFn ? () => G.panelFn(G.pill) : null };
  }
  // unread notifications: a bell with a count in the pill; clicking the pill opens the notification centre
  const bell = () => G.badge ? `<span class="isl-bell"><svg viewBox="0 0 24 24"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></svg><b>${G.badge > 9 ? '9+' : G.badge}</b></span>` : '';
  function idle() { if (G.cur) return; morph(idleView()); }
  clearInterval(G.clock); G.clock = setInterval(() => { if (!G.cur) { const v = idleView(); const tEl = G.pill.querySelector('.isl-time'); const lt = G.pill.querySelector('[data-live-tick]'); if (tEl && !G.lives.size) tEl.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); else if (lt && v.tick) lt.textContent = v.tick(); else if (!tEl && !lt) idle(); } }, 1000);

  /* ---- transient notices ----
     show(n) → handle { update(patch), done(patch), dismiss() }
     n: { title, sub, icon, color, image (html), right, check, spin, progress (0–1), actions:[{label,run}],
          style: 'celebrate', eyebrow, key (replaces a notice with the same key), sticky, ms, onClick, keep } */
  const kept = q => q.sticky || q.keep || q.style === 'celebrate';
  function show(n) {
    n = Object.assign({}, n);
    if (n.key) { // same key: update in place instead of queueing another
      if (G.cur && G.cur.key === n.key) { Object.assign(G.cur, n); render(G.cur, true); return handle(G.cur); }
      const q = G.queue.find(x => x.key === n.key); if (q) { Object.assign(q, n); return handle(q); }
    }
    // newest wins for plain notices; celebrations, sticky and keyed ones wait their turn
    G.queue = G.queue.filter(kept).concat(G.queue.filter(q => !kept(q)).slice(-1));
    G.queue.push(n);
    if (!G.cur) next();
    else if (!G.cur.sticky && G.cur.progress == null && !G.cur.spin) { clearTimeout(G.t); G.t = setTimeout(dismiss, G.cur.style === 'celebrate' ? 2200 : 1200); }
    return handle(n);
  }
  function handle(n) {
    return {
      update(patch) { Object.assign(n, patch); if (G.cur === n) render(n, true); },
      done(patch = {}) { Object.assign(n, { spin: false, progress: null, check: patch.icon ? false : true, sticky: false, ms: 3200 }, patch); if (G.cur === n) { render(n); clearTimeout(G.t); G.t = setTimeout(dismiss, n.ms); } },
      dismiss() { if (G.cur === n) dismiss(); else G.queue = G.queue.filter(x => x !== n); }
    };
  }
  function view(n) {
    const na = (n.actions || []).length, inline = na > 0 && na <= 2 && !n.sub && n.style !== 'celebrate' && n.progress == null;
    const acts = na ? `${inline ? '<span class="isl-sep"></span>' : ''}<div class="isl-acts ${inline ? 'inline' : ''}">${n.actions.map((a, i) => `<button data-ai="${i}" class="${i === 0 ? 'pri' : ''}">${esc(a.label)}</button>`).join('')}</div>` : '';
    if (n.style === 'celebrate') {
      const html = `<div class="isl-cel" style="--ic:${n.color || '#ffb020'}"><span class="isl-badge">${n.image || n.icon || '★'}</span><span class="isl-t"><span class="isl-eye">${esc(n.eyebrow || 'Achievement unlocked')}</span><b>${esc(n.title)}</b>${n.sub ? `<small>${esc(n.sub)}</small>` : ''}</span>${n.right ? `<span class="isl-xp">${esc(n.right)}</span>` : ''}<span class="isl-shine"></span>${'<i></i>'.repeat(10)}</div>${acts}`;
      return { html, stack: true, cls: 'cel' };
    }
    const ico = n.check ? checkSvg : n.spin ? '<span class="isl-spin"></span>' : n.image ? `<span class="isl-img">${n.image}</span>` : n.icon ? `<span class="isl-ico" style="--ic:${n.color || '#2a2833'}">${n.icon}</span>` : '';
    const row = `${ico}<span class="isl-t"><b>${esc(n.title)}</b>${n.sub ? `<small>${esc(n.sub)}</small>` : ''}</span>${n.right ? `<span class="isl-right">${esc(n.right)}</span>` : ''}`;
    const bar = n.progress != null ? `<div class="isl-bar"><i style="width:${Math.round(Math.max(0, Math.min(1, n.progress)) * 100)}%"></i></div>` : '';
    const stack = (na && !inline) || !!n.sub || !!bar;
    return { html: stack ? `<div class="isl-row">${row}</div>${bar}${acts}` : row + acts, stack };
  }
  function render(n, soft) {
    // progress / text updates of the same notice: patch in place, no crossfade
    if (soft && G.pill.querySelector('.isl-c:not(.leaving) .isl-bar') && n.progress != null) {
      const c = G.pill.querySelector('.isl-c:not(.leaving)');
      c.querySelector('.isl-bar i').style.width = Math.round(Math.max(0, Math.min(1, n.progress)) * 100) + '%';
      const b = c.querySelector('.isl-t b'), sm = c.querySelector('.isl-t small'); if (b) b.textContent = n.title; if (sm && n.sub) sm.textContent = n.sub;
      return;
    }
    const v = view(n);
    const c = morph({ html: v.html, stack: v.stack, actions: n.actions, onClick: n.onClick, h: v.stack ? 0 : 34, minW: n.progress != null ? 240 : 0 });
    G.pill.classList.toggle('cel', v.cls === 'cel');
    surface(n.color || (v.cls === 'cel' ? '#ffb020' : n.check ? '#3fc37a' : ''), !soft);
    if (v.cls === 'cel') c.querySelectorAll('.isl-cel i').forEach((d, k) => { d.style.setProperty('--x', (Math.random() * 100) + '%'); d.style.setProperty('--d', (k * 70) + 'ms'); d.style.setProperty('--c', ['#ffd166', '#7cf7d4', '#ff4fa3', '#5cc8ff', '#b28cff'][k % 5]); });
  }
  // a notice brings the pill up out of the UI (lift + glow in the notice's colour, one ring pulse); idle sinks it back
  const glowable = c => { const m = /^#([0-9a-f]{6})$/i.exec(c || ''); if (!m) return !!c; const n = parseInt(m[1], 16), l = (0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255; return l > 0.22; };
  function surface(color, ping) {
    const p = G.pill; if (!glowable(color)) color = '';
    if (color) p.style.setProperty('--glow', color); else p.style.removeProperty('--glow');
    p.classList.add('up');
    if (ping) { p.classList.remove('ping'); void p.offsetWidth; p.classList.add('ping'); clearTimeout(G.pt); G.pt = setTimeout(() => p.classList.remove('ping'), 950); }
  }
  function sink() { G.pill.classList.remove('up', 'ping', 'cel'); }
  function next() {
    const n = G.queue.shift(); if (!n) { G.cur = null; sink(); idle(); return; }
    G.cur = n; render(n);
    clearTimeout(G.t);
    if (!n.sticky && n.progress == null && !n.spin) G.t = setTimeout(dismiss, n.ms || (n.style === 'celebrate' ? 5200 : (n.actions || []).length ? 6000 : n.sub ? 4600 : 3600));
  }
  function dismiss() { clearTimeout(G.t); G.cur = null; if (!G.queue.length) sink(); else G.pill.classList.remove('cel'); setTimeout(() => { if (!G.cur) next(); }, 220); }
  function update(n) { if (G.cur === n) render(n, true); }

  window.CadenceIsland = {
    show, dismiss, update,
    /* a task that takes a while: const p = progress('import', 'Importing…'); p.update({ progress: .5 }); p.done({ title: 'Imported 12' }) */
    progress(key, title, o = {}) { return show(Object.assign({ key, title, progress: o.value ?? null, spin: o.value == null, sticky: true }, o)); },
    celebrate(o) { return show(Object.assign({ style: 'celebrate' }, o)); },
    live(key, l) { G.lives.set(key, l); if (!G.cur) idle(); },
    clear(key) { G.lives.delete(key); if (!G.cur) idle(); },
    setSync(s) { G.sync = s; const d = G.pill.querySelector('.isl-dot:not(.rec)'); if (d) d.className = 'isl-dot ' + s; },
    /* notifications: Island + notification centre. CadenceIsland.notify({ title, body, icon, route, taskId, source }) */
    notify(n) { return window.Cadence && window.Cadence.notify ? window.Cadence.notify(n) : show({ title: n.title, sub: n.body, icon: n.icon }); },
    setBadge(n) { n = +n || 0; if (n === G.badge) return; G.badge = n; if (!G.cur) idle(); },
    panel(fn) { G.panelFn = fn; if (!G.cur) idle(); },
    pill: () => G.pill,
    toast(msg, actions = [], opts = {}) { return show({ title: msg, actions, sticky: opts.sticky, icon: opts.icon, color: opts.color, check: /^(Completed|Added|Saved|Updated|Restored|Deleted|Copied|Removed|Imported)/.test(msg) }); },
  };

  Cadence.registerPlugin({
    id: 'island', name: 'Island', version: '1.0.0', icon: '<rect x="3.5" y="9" width="17" height="6" rx="3"/><path d="M16.5 12h.01"/>', color: '#1c1b19', category: 'Look & feel', tagline: 'Dynamic-Island notifications',
    description: 'A Dynamic-Island-style pill at the top: shows the time and sync, morphs open for completed tasks, reminders and startup, and holds live activities like a running meeting.',
    setup(api) {
      idle();
      api.on('sync', e => {
        if (e.phase === 'push' || e.phase === 'pull') window.CadenceIsland.setSync('busy');
        else if (e.phase === 'error') window.CadenceIsland.setSync('err');
        else window.CadenceIsland.setSync(api.system().status === 'synced' ? 'ok' : 'off');
      });
      // completed tasks: a satisfying check, unless the click already showed a bubble right there
      api.on('task:complete', t => {
        const p = api.ui.pointer(); if (Date.now() - p.t < 900) return;
        const c = t.clientId && api.clients.get(t.clientId);
        show({ check: true, title: t.title, right: c ? c.name : '' });
      });
      // meeting = live activity: red dot, client, running timer
      const syncMeeting = () => {
        const m = api.meetings.active();
        if (!m) { window.CadenceIsland.clear('meeting'); return; }
        const c = m.clientId && api.clients.get(m.clientId);
        const tick = () => { const s = Math.floor((Date.now() - m.start) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
        window.CadenceIsland.live('meeting', { prio: 10, view: () => ({ tick, html: `<span class="isl-dot rec"></span><span class="isl-t"><b>${esc(c ? c.name : 'Meeting')}</b></span><span class="isl-right" data-live-tick>${tick()}</span>`, minW: 190, onClick: () => api.meetings.start() }) });
      };
      api.on('meeting:start', syncMeeting); api.on('meeting:end', () => window.CadenceIsland.clear('meeting'));
      api.on('render:side', syncMeeting);
      // meeting wrapped up: summary + one tap to the recap email
      api.on('meeting:end', ({ meeting, items }) => {
        const c = meeting.clientId && api.clients.get(meeting.clientId), mine = items.filter(i => i.owner === 'me').length, mins = Math.max(1, Math.round((meeting.end - meeting.start) / 60000));
        show({ image: c ? api.ui.avatar(c, 20) : '', icon: c ? '' : '◉', title: `${c ? c.name : 'Meeting'} wrapped · ${mins} min`, sub: items.length ? `${mine} for you · ${items.length - mine} for them` : 'No action items', ms: 8000,
          actions: [].concat(window.CadenceRecap && window.CadenceRecap.meeting && items.length ? [{ label: '✉ Recap email', run: () => window.CadenceRecap.meeting(meeting, items) }] : []).concat(c ? [{ label: 'Open client', run: () => api.ui.navigate('client-' + c.id) }] : []) });
      });
      // connection: say it once when it drops, and once when it's back
      api.on('sync', e => {
        if (e.phase === 'error' && !G.offline) { G.offline = true; show({ key: 'net', icon: '⚡', color: '#e5484d', title: 'Can’t reach your NAS', sub: 'Changes are kept in this browser and sync when it’s back' }); }
        else if ((e.phase === 'saved' || e.phase === 'pulled') && G.offline) { G.offline = false; show({ key: 'net', check: true, title: 'Back online', sub: 'Everything synced' }); }
      });
      // once a day: a quiet morning brief
      api.on('sync', e => {
        if (e.phase !== 'connected' || G.briefed) return;
        const day = api.util.todayKey(); if (api.storage.get('brief') === day && !api.system().demo) return;
        G.briefed = true;
        setTimeout(() => {
          const t = day, open = api.tasks.list(x => !x.done && x.owner === 'me'), over = open.filter(x => x.dueDate && x.dueDate < t).length, due = open.filter(x => x.dueDate === t).length;
          const cal = (window.__cal && window.__cal.events || []).filter(ev => !ev.allDay && new Date(ev.start).toDateString() === new Date().toDateString() && ev.end > Date.now()).length;
          const h = new Date().getHours(), hi = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
          const parts = [due ? `${due} due today` : 'nothing due today', over ? `${over} from earlier` : '', cal ? `${cal} meeting${cal === 1 ? '' : 's'} left` : ''].filter(Boolean);
          show({ icon: h < 12 ? '☀️' : h < 17 ? '◐' : '☾', color: '#2a2833', title: hi + (api.settings().myName ? ', ' + api.settings().myName.split(' ')[0] : ''), sub: parts.join(' · '), ms: 6000, onClick: () => api.ui.navigate('today') });
          api.storage.set('brief', day);
        }, 7000);
      });
      api.on('reminder', t => {
        if (api.plugins.enabled('notify')) return;   // the notification centre shows reminders (with the same buttons)
        const c = t.clientId && api.clients.get(t.clientId);
        show({ icon: '🔔', color: '#5b5bd6', title: t.title, sub: (c ? c.name + ' · ' : '') + (t.dueTime ? 'due ' + t.dueTime : 'reminder'), sticky: true,
          actions: [{ label: 'Done', run: () => api.tasks.complete(t.id) }, { label: 'Snooze 10m', run: () => api.tasks.update(t.id, { remindMode: 'custom', remindAt: Date.now() + 600000 }) }, { label: 'Dismiss', run: () => {} }] });
      });
    }
  });
})();
