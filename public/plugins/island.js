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
      .isl-pill{pointer-events:auto;position:relative;background:#0d0c10;color:#f2f0f7;border-radius:22px;box-shadow:0 10px 30px rgba(0,0,0,.22),0 0 0 1px rgba(255,255,255,.05) inset;overflow:hidden;
        width:var(--w,120px);height:var(--h,30px);transition:width .75s cubic-bezier(.32,1.22,.42,1),height .75s cubic-bezier(.32,1.22,.42,1),border-radius .75s cubic-bezier(.32,1.22,.42,1),box-shadow .5s;cursor:default;font:500 12.5px/1.25 Inter,ui-sans-serif,system-ui,sans-serif}
      .isl-pill.big{border-radius:24px;box-shadow:0 18px 50px rgba(0,0,0,.32),0 0 0 1px rgba(255,255,255,.06) inset}
      .isl-pill.click{cursor:pointer}
      .isl-c{position:absolute;inset:0;display:flex;align-items:center;gap:10px;padding:0 14px;white-space:nowrap;transition:opacity .38s ease, filter .45s ease, transform .6s cubic-bezier(.32,1.2,.42,1)}
      .isl-c.leaving{opacity:0;filter:blur(6px);transform:scale(.94);transition-duration:.28s,.3s,.35s}
      .isl-c.entering{opacity:0;filter:blur(6px);transform:scale(1.04) translateY(2px)}
      .isl-c.stack{flex-direction:column;align-items:stretch;justify-content:center;gap:7px;padding:9px 14px 10px;white-space:nowrap}
      .isl-row{display:flex;align-items:center;gap:10px;min-width:0}
      .isl-ico{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;flex:none;font-size:13px;background:var(--ic,#2a2833);color:#fff}
      .isl-t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;max-width:300px}
      .isl-t b{font-weight:650;color:#fff}
      .isl-t small{display:block;color:#9d99ad;font-size:11px;margin-top:1px;overflow:hidden;text-overflow:ellipsis}
      .isl-right{color:#9d99ad;font-variant-numeric:tabular-nums;font-size:12px;flex:none}
      .isl-acts{display:flex;gap:6px;justify-content:flex-end}
      .isl-acts button{background:#24222c;color:#fff;border-radius:999px;padding:5px 11px;font:600 11.5px/1 Inter,ui-sans-serif,system-ui;border:0;cursor:pointer}
      .isl-acts button:hover{background:#34313f}
      .isl-acts button.pri{background:var(--accent,#5b5bd6)}
      .isl-dot{width:7px;height:7px;border-radius:50%;background:#3fc37a;flex:none;box-shadow:0 0 0 3px rgba(63,195,122,.18);transition:background .3s, box-shadow .3s}
      .isl-dot.busy{background:#f5b041;box-shadow:0 0 0 3px rgba(245,176,65,.22);animation:islp 1s infinite}
      .isl-dot.err{background:#ff5a5a;box-shadow:0 0 0 3px rgba(255,90,90,.22)}
      .isl-dot.off{background:#6b6878;box-shadow:none}
      .isl-dot.rec{background:#ff3b3b;box-shadow:0 0 0 3px rgba(255,59,59,.25);animation:islp 1.4s infinite}
      @keyframes islp{50%{opacity:.45}}
      .isl-time{font-variant-numeric:tabular-nums;color:#d8d5e2;font-weight:600;letter-spacing:.01em}
      .isl-check{width:20px;height:20px;border-radius:50%;background:#3fc37a;display:grid;place-items:center;flex:none}
      .isl-check svg{width:13px;height:13px;stroke:#fff;stroke-width:3;fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:20;stroke-dashoffset:20;animation:islck .45s .12s forwards}
      @keyframes islck{to{stroke-dashoffset:0}}
      .isl-spin{width:14px;height:14px;border:2px solid #4a4757;border-top-color:#b28cff;border-radius:50%;animation:islsp .7s linear infinite;flex:none}
      @keyframes islsp{to{transform:rotate(360deg)}}
      .isl-bar{height:3px;border-radius:9px;background:#2a2833;overflow:hidden}
      .isl-bar i{display:block;height:100%;background:linear-gradient(90deg,#5b5bd6,#b06bd6,#ff7a8a);transition:width .35s}
      .isl-measure{position:fixed;left:-9999px;top:0;visibility:hidden}
    `;
    document.head.appendChild(st);
    G.el = document.createElement('div'); G.el.className = 'isl';
    G.el.innerHTML = '<div class="isl-pill"></div>';
    document.body.appendChild(G.el);
    G.pill = G.el.firstChild;
    G.queue = []; G.lives = new Map(); G.cur = null; G.sync = 'ok';
  }
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
    if (live) return live.view();
    const t = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return { html: `<span class="isl-dot ${G.sync}"></span><span class="isl-time">${t}</span>` };
  }
  function idle() { if (G.cur) return; morph(idleView()); }
  clearInterval(G.clock); G.clock = setInterval(() => { if (!G.cur) { const v = idleView(); const tEl = G.pill.querySelector('.isl-time'); const lt = G.pill.querySelector('[data-live-tick]'); if (tEl && !G.lives.size) tEl.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); else if (lt && v.tick) lt.textContent = v.tick(); else if (!tEl && !lt) idle(); } }, 1000);

  /* ---- transient notices ---- */
  function show(n) {
    // newest wins: keep at most 2 waiting, and hurry the current notice along
    G.queue = G.queue.filter(q => q.sticky).concat(G.queue.filter(q => !q.sticky).slice(-1));
    G.queue.push(n);
    if (!G.cur) return next();
    if (!G.cur.sticky) { clearTimeout(G.t); G.t = setTimeout(dismiss, 1200); }
  }
  function next() {
    const n = G.queue.shift(); if (!n) { G.cur = null; idle(); return; }
    G.cur = n;
    const acts = (n.actions || []).length ? `<div class="isl-acts">${n.actions.map((a, i) => `<button data-ai="${i}" class="${i === 0 ? 'pri' : ''}">${esc(a.label)}</button>`).join('')}</div>` : '';
    const ico = n.check ? checkSvg : n.spin ? '<span class="isl-spin"></span>' : n.icon ? `<span class="isl-ico" style="--ic:${n.color || '#2a2833'}">${n.icon}</span>` : '';
    const body = `<div class="isl-row">${ico}<span class="isl-t"><b>${esc(n.title)}</b>${n.sub ? `<small>${esc(n.sub)}</small>` : ''}</span>${n.right ? `<span class="isl-right">${esc(n.right)}</span>` : ''}</div>`;
    const stack = !!acts || !!n.sub;
    morph({ html: body + acts, stack, actions: n.actions, onClick: n.onClick });
    clearTimeout(G.t);
    if (!n.sticky) G.t = setTimeout(dismiss, n.ms || (acts ? 6000 : n.sub ? 4600 : 3600));
  }
  function dismiss() { clearTimeout(G.t); G.cur = null; setTimeout(next, 220); }
  function update(n) { if (G.cur === n) { G.queue.unshift(n); G.cur = null; next(); } }

  window.CadenceIsland = {
    show, dismiss, update,
    live(key, l) { G.lives.set(key, l); if (!G.cur) idle(); },
    clear(key) { G.lives.delete(key); if (!G.cur) idle(); },
    setSync(s) { G.sync = s; const d = G.pill.querySelector('.isl-dot:not(.rec)'); if (d) d.className = 'isl-dot ' + s; },
    toast(msg, actions = [], opts = {}) { show({ title: msg, actions, sticky: opts.sticky, icon: opts.icon, color: opts.color, check: /^(Completed|Added|Saved|Updated|Restored|Deleted)/.test(msg) }); },
  };

  Cadence.registerPlugin({
    id: 'island', name: 'Island', version: '1.0.0',
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
      api.on('reminder', t => {
        const c = t.clientId && api.clients.get(t.clientId);
        show({ icon: '🔔', color: '#5b5bd6', title: t.title, sub: (c ? c.name + ' · ' : '') + (t.dueTime ? 'due ' + t.dueTime : 'reminder'), sticky: true,
          actions: [{ label: 'Done', run: () => api.tasks.complete(t.id) }, { label: 'Snooze 10m', run: () => api.tasks.update(t.id, { remindMode: 'custom', remindAt: Date.now() + 600000 }) }, { label: 'Dismiss', run: () => {} }] });
      });
    }
  });
})();
