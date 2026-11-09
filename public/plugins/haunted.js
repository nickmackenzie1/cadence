/* Haunted backlog: every overdue task of yours becomes a ghost drifting over the app.
   The longer it has been overdue, the faster (and greener) it moves. Complete the task to exorcise it.
   Hover a ghost to see what it is, click it to go to its client. Ghosts never block clicks elsewhere. */
Cadence.registerPlugin({
  id: 'haunted', name: 'Haunted backlog', version: '1.0.0', category: 'Fun',
  description: 'Overdue tasks become ghosts that drift across the screen, faster the older they get. Completing a task exorcises its ghost. Hover a ghost to read it, click to jump to the client.',
  tagline: 'Overdue tasks haunt you', color: '#6b5bd6',
  icon: '<path d="M6 20V11a6 6 0 0 1 12 0v9l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5z"/><path d="M10 11h.01M14 11h.01"/>',
  settings(api) {
    const cur = api.storage.get('level') || 'full';
    api.ui.modal('Haunted backlog', `<p style="color:var(--muted);margin:0 0 12px">How haunted should Cadence be?</p>
      ${[['mild', 'Mild', 'Up to 3 ghosts, slow, very faint'], ['full', 'Full', 'Up to 8 ghosts, speed grows with age'], ['off', 'Exorcised', 'No ghosts (keeps the plugin on)']].map(([k, t, d]) =>
        `<label style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;cursor:pointer"><input type="radio" name="hl" value="${k}" ${k === cur ? 'checked' : ''} style="margin-top:3px"><span><b>${t}</b><br><span style="color:var(--muted);font-size:13px">${d}</span></span></label>`).join('')}`,
      `<button class="btn primary" id="hl-save">Done</button>`);
    document.getElementById('hl-save').onclick = () => { const v = (document.querySelector('input[name=hl]:checked') || {}).value || 'full'; api.storage.set('level', v); api.ui.close(); window.__haunt && window.__haunt.sync(); };
  },
  setup(api) {
    const H = window.__haunt = window.__haunt || { ghosts: new Map() };
    H.api = api;
    if (!H.layer) {
      const st = document.createElement('style');
      st.textContent = `
        .hn-layer{position:fixed;inset:0;pointer-events:none;z-index:25;overflow:hidden}
        .hn-g{position:absolute;left:0;top:0;width:var(--s,38px);pointer-events:auto;cursor:pointer;opacity:var(--o,.42);transition:opacity .35s,filter .35s;will-change:transform}
        .hn-body{transition:transform .25s}
        .hn-g svg{display:block;width:100%;overflow:visible;filter:drop-shadow(0 0 6px color-mix(in srgb,var(--c) 60%,transparent));animation:hnsway 2.6s ease-in-out infinite alternate}
        .hn-g:hover{opacity:.97;z-index:2}
        .hn-g .tag{position:absolute;left:50%;top:100%;transform:translate(-50%,6px);background:var(--panel);color:var(--text);border:1px solid var(--line);box-shadow:var(--shadow);border-radius:9px;padding:6px 9px;font:500 12px/1.3 Inter,system-ui;white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis;opacity:0;pointer-events:none;transition:opacity .2s}
        .hn-g .tag small{display:block;color:var(--danger);font-weight:600;font-size:11px}
        .hn-g:hover .tag{opacity:1}
        .hn-g.poof{pointer-events:none;animation:hnpoof 1.1s cubic-bezier(.3,0,.6,1) forwards}
        .hn-g.born svg{animation:hnborn .9s cubic-bezier(.3,1.6,.5,1),hnsway 2.6s ease-in-out .9s infinite alternate}
        @keyframes hnsway{from{transform:rotate(-6deg)}to{transform:rotate(6deg) translateY(-3px)}}
        @keyframes hnborn{from{transform:scale(0) rotate(-40deg);opacity:0}}
        @keyframes hnpoof{30%{opacity:1;filter:brightness(2.2)}100%{opacity:0;filter:brightness(3) blur(4px);translate:0 -90px;scale:1.6}}
        .hn-spark{position:absolute;width:6px;height:6px;border-radius:50%;background:#fff;box-shadow:0 0 8px 2px var(--c);pointer-events:none;animation:hnsp .9s ease-out forwards}
        @keyframes hnsp{to{transform:translate(var(--dx),var(--dy)) scale(0);opacity:0}}
        .hn-g .hem{animation:hnhem .5s steps(2) infinite}
        .hn-bub{position:absolute;bottom:100%;left:50%;transform:translate(-50%,-4px) scale(.6);opacity:0;background:var(--panel);color:var(--text);border:1px solid var(--line);box-shadow:var(--shadow);border-radius:12px;padding:5px 9px;font:600 12px/1.25 Inter,system-ui;white-space:nowrap;pointer-events:none;transition:opacity .2s,transform .3s cubic-bezier(.3,1.6,.5,1)}
        .hn-bub::after{content:'';position:absolute;left:50%;top:100%;border:5px solid transparent;border-top-color:var(--panel);transform:translateX(-50%)}
        .hn-g.talk .hn-bub{opacity:1;transform:translate(-50%,-8px) scale(1)}
        .hn-g.talk{opacity:.95}
        .hn-g.shake .hn-body{animation:hnshake .42s ease-in-out 3}
        .hn-g.peek .hn-body{animation:hnpeek 1.8s ease-in-out}
        .hn-g.sigh .hn-body{animation:hnsigh 2.2s ease-in-out}
        .hn-g.flinch .hn-body{animation:hnflinch .5s ease-out}
        .hn-g.lunge .hn-body{animation:hnlunge .55s ease-in-out 2}
        @keyframes hnshake{25%{rotate:-14deg;translate:-3px 0}75%{rotate:14deg;translate:3px 0}}
        @keyframes hnpeek{30%,70%{translate:0 10px;scale:1 .92}}
        @keyframes hnsigh{40%,70%{scale:1.05 .86;translate:0 5px;filter:saturate(.3)}}
        @keyframes hnflinch{20%{scale:.8 1.15;translate:0 -6px}50%{scale:1.1 .9}}
        @keyframes hnlunge{50%{translate:0 -8px;scale:1.12}}
        .hn-wob{animation:hnwob .6s ease-in-out}
        @keyframes hnwob{20%{rotate:-2.5deg}50%{rotate:2deg}80%{rotate:-1deg}}
        @keyframes hnhem{50%{transform:translateX(2px)}}
      `;
      document.head.appendChild(st);
      H.layer = document.createElement('div'); H.layer.className = 'hn-layer'; document.body.appendChild(H.layer);
      requestAnimationFrame(t => H.loop(t));
      setInterval(() => H.sync(), 60e3);                       // tasks become overdue as time passes
      document.addEventListener('visibilitychange', () => { H.last = 0; });
    }
    H.sync = sync; H.loop = loop;
    api.on('task:complete', t => { const was = H.ghosts.has(t.id); exorcise(t.id, true); if (H.flinchAll && (was || Math.random() < 0.5)) H.flinchAll(t.id); });
    api.on('task:remove', t => exorcise(t && t.id, false));
    api.on('task:add', () => { const j = [...H.ghosts.values()].find(g => g.pers === 'judge' && !g.leaving); if (j && Math.random() < 0.6) { act(j, 'shake', 1300); say(j, pick(PERS.judge.lines)); } });
    for (const ev of ['task:add', 'task:update', 'task:reopen', 'sync']) api.on(ev, () => setTimeout(sync, 0));
    setTimeout(sync, 400);

    function overdue() {
      const now = Date.now(), today = api.util.todayKey();
      return api.tasks.list(t => !t.done && t.owner !== 'client' && t.dueDate && (t.dueDate < today || (t.dueTime && t.dueDate === today && due(t) < now)))
        .map(t => ({ t, days: Math.max(0, (now - due(t)) / 864e5) }))
        .sort((a, b) => b.days - a.days);
    }
    function due(t) { const [y, m, d] = t.dueDate.split('-').map(Number); const [hh, mm] = (t.dueTime || '23:59').split(':').map(Number); return new Date(y, m - 1, d, hh, mm).getTime(); }
    const PERS = {
      sulker:    { name: 'The Sulker',    lines: ['Still not done?', 'Tick me. Please.', 'I live here now.', '*disappointed boo*'] },
      nosy:      { name: 'The Nosy One',  lines: ['ooh what’s this', 'You’ll never finish this one either', 'Interesting choice', 'I’m just looking'] },
      judge:     { name: 'The Judge',     lines: ['Adding MORE?', 'Bold of you.', 'Finish one first', 'Mm-hm. Sure.'] },
      prankster: { name: 'The Prankster', lines: ['BOO!', 'hehe', 'Notification for you: boo', '*pokes*'] },
      drama:     { name: 'The Drama Queen', lines: ['Nobody remembers me…', 'I was due on a TUESDAY', 'Forgotten. Again.', 'Fine. I’ll just haunt.'] },
      shy:       { name: 'The Shy One',   lines: ['eep', 'don’t look at me', '…hi', '(hides)'] },
    };
    const PKEYS = Object.keys(PERS);
    const persOf = id => { let h = 7; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return PKEYS[h % PKEYS.length]; };
    const pick = a => a[Math.floor(Math.random() * a.length)];
    // fresh = pale lavender, a week = sickly green, a month = ectoplasm
    const hue = days => days < 1 ? '#b9b2ff' : days < 7 ? '#9fe3c4' : days < 30 ? '#8ff07a' : '#d4ff3a';
    const svg = c => `<svg viewBox="0 0 40 48"><path d="M20 2C10 2 4 10 4 20v24l4-3 4 3 4-3 4 3 4-3 4 3 4-3 4 3V20C36 10 30 2 20 2z" fill="color-mix(in srgb,${c} 55%,#fff)" stroke="${c}" stroke-width="1.5"/><g class="hem"><path d="M4 44l4-3 4 3 4-3 4 3 4-3 4 3 4-3 4 3" fill="none" stroke="${c}" stroke-width="1.5"/></g><ellipse cx="14.5" cy="19" rx="2.6" ry="3.6" fill="#1a1530"/><ellipse cx="25.5" cy="19" rx="2.6" ry="3.6" fill="#1a1530"/><ellipse cx="20" cy="29" rx="3" ry="3.8" fill="#1a1530" opacity=".85"/></svg>`;

    function sync() {
      const level = api.plugins.enabled('haunted') ? (api.storage.get('level') || 'full') : 'off';
      const max = level === 'off' ? 0 : level === 'mild' ? 3 : 8;
      const want = overdue().slice(0, max), ids = new Set(want.map(w => w.t.id));
      for (const [id, g] of H.ghosts) if (!ids.has(id) && !g.leaving) { g.el.remove(); H.ghosts.delete(id); }
      const W = innerWidth, Hh = innerHeight, still = api.ui.reducedMotion();
      want.forEach((w, i) => {
        let g = H.ghosts.get(w.t.id);
        const c = hue(w.days), speed = (level === 'mild' ? 10 : 18) * (1 + Math.log2(1 + w.days));
        const pers = persOf(w.t.id);
        const label = `<b>${api.ui.esc(w.t.title)}</b><small>${PERS[pers].name} · ${w.days < 1 ? 'overdue today' : Math.floor(w.days) + ' day' + (Math.floor(w.days) === 1 ? '' : 's') + ' overdue'}</small>`;
        if (!g) {
          const el = document.createElement('div'); el.className = 'hn-g born';
          el.onclick = () => { const t = api.tasks.get(w.t.id); api.ui.navigate(t && t.clientId ? 'client-' + t.clientId : 'today'); };
          H.layer.appendChild(el); setTimeout(() => el.classList.remove('born'), 950);
          g = { el, id: w.t.id, pers, mode: 'wander', next: performance.now() + 3000 + Math.random() * 9000, x: still ? W - 70 - i * 46 : Math.random() * (W - 80) + 20, y: still ? Hh - 90 : Math.random() * (Hh - 120) + 60, a: Math.random() * 6.28, ph: Math.random() * 6.28 };
          H.ghosts.set(w.t.id, g);
        }
        g.speed = speed; g.c = c; g.mild = level === 'mild';
        g.el.style.setProperty('--c', c); g.el.style.setProperty('--o', level === 'mild' ? '.26' : '.42'); g.el.style.setProperty('--s', Math.round(30 + Math.min(18, w.days * 1.2)) + 'px');
        if (g.c0 !== c || g.label !== label) { g.el.innerHTML = `<div class="hn-body">${svg(c)}</div><div class="hn-bub"></div><div class="tag">${label}</div>`; g.c0 = c; g.label = label; }
        g.el.title = '';
      });
      place();
    }
    function place() { for (const g of H.ghosts.values()) if (!g.leaving) g.el.style.transform = `translate(${g.x}px,${g.y}px)`; }

    // ---- personalities: every so often a ghost picks something in the UI, goes there and reacts ----
    function target(g) {
      const vis = el => { if (!el) return null; const r = el.getBoundingClientRect(); return r.width && r.bottom > 60 && r.top < innerHeight - 60 ? r : null; };
      const rows = [...document.querySelectorAll('#view .task[data-id]')];
      const own = rows.find(r => r.dataset.id === g.id), others = rows.filter(r => r.dataset.id !== g.id && !r.classList.contains('done'));
      const W = innerWidth;
      const beside = (el, r, act) => ({ el, act, x: Math.min(W - 60, r.right + 6 > W - 60 ? r.right - 70 : r.right + 6), y: r.top + r.height / 2 - 24 });
      const above = (el, r, act) => ({ el, act, x: r.left + r.width * (0.35 + Math.random() * 0.4), y: r.top - 46 });
      let r;
      switch (g.pers) {
        case 'sulker': if ((r = vis(own))) return beside(own, r, 'shake'); break;
        case 'nosy': { const el = pick(others.filter(vis)); if (el) return above(el, vis(el), 'peek'); break; }
        case 'judge': { const el = document.querySelector('#view .qa'); if ((r = vis(el))) return above(el, r, 'shake'); break; }
        case 'prankster': { const el = document.querySelector('.isl-pill'); if (el) { r = el.getBoundingClientRect(); return { el, act: 'lunge', wob: true, x: r.left + r.width / 2 - 20, y: r.bottom + 6 }; } break; }
        case 'drama': return { el: null, act: 'sigh', x: g.x, y: g.y };
        case 'shy': return null;
      }
      if (own && (r = vis(own)) && Math.random() < 0.5) return beside(own, r, 'shake');
      return null;
    }
    function say(g, text, ms = 2600) {
      const now = performance.now(); if ((H.talkUntil || 0) > now) return;   // one voice at a time
      H.talkUntil = now + ms; const b = g.el.querySelector('.hn-bub'); if (!b) return;
      b.textContent = text; g.el.classList.add('talk'); clearTimeout(g.tt); g.tt = setTimeout(() => g.el.classList.remove('talk'), ms);
    }
    function act(g, name, ms) { g.el.classList.remove('shake', 'peek', 'sigh', 'flinch', 'lunge'); void g.el.offsetWidth; g.el.classList.add(name); setTimeout(() => g.el.classList.remove(name), ms); }
    H.flinchAll = except => { for (const g of H.ghosts.values()) if (!g.leaving && g.id !== except) { act(g, 'flinch', 520); if (Math.random() < 0.35) say(g, pick(['!', 'they’re picking us off', 'not me, not me', 'eek'])); } };
    if (!H.pm) { H.pm = true; addEventListener('pointermove', e => { H.mx = e.clientX; H.my = e.clientY; }, { passive: true }); }

    function loop(ts) {
      requestAnimationFrame(t => H.loop(t));
      const a = H.api; if (!a || document.hidden || !H.ghosts.size || a.ui.reducedMotion()) { H.last = ts; return; }
      const dt = Math.min(0.05, ((ts - (H.last || ts)) / 1000)); H.last = ts;
      const W = innerWidth, Hh = innerHeight;
      for (const g of H.ghosts.values()) {
        if (g.leaving || g.el.matches(':hover')) continue;          // hovered ghosts hold still so you can read them
        if (g.mode === 'wander' && ts > g.next && !g.mild) {
          const t = target(g);
          if (t) { g.mode = 'seek'; g.t = t; g.seekStart = ts; } else { g.next = ts + 6000 + Math.random() * 8000; if (Math.random() < 0.3) say(g, pick(PERS[g.pers].lines)); }
        }
        if (g.mode === 'seek') {
          const t = g.t; if (t.el && t.el.isConnected && t.el.matches('.task')) { const r = t.el.getBoundingClientRect(); t.y = t.act === 'peek' ? r.top - 46 : r.top + r.height / 2 - 24; }
          const dx = t.x - g.x, dy = t.y - g.y, dist = Math.hypot(dx, dy), v = Math.max(70, g.speed * 2.5) * dt;
          if ((t.el && !t.el.isConnected) || ts - g.seekStart > 9000) { g.mode = 'wander'; g.next = ts + 5000; }
          else if (dist <= v + 1) {
            g.x = t.x; g.y = t.y; g.mode = 'act'; g.face = t.el ? (t.el.getBoundingClientRect().left + t.el.getBoundingClientRect().width / 2 < g.x + 20 ? -1 : 1) : g.face;
            const dur = t.act === 'sigh' ? 2300 : t.act === 'peek' ? 1900 : 1500;
            act(g, t.act, dur); say(g, pick(PERS[g.pers].lines), dur + 600);
            if (t.wob && t.el) { t.el.classList.remove('hn-wob'); void t.el.offsetWidth; t.el.classList.add('hn-wob'); setTimeout(() => t.el.classList.remove('hn-wob'), 650); }
            setTimeout(() => { g.mode = 'wander'; g.next = performance.now() + 9000 + Math.random() * 12000; }, dur + 400);
          } else { g.x += dx / dist * v; g.y += dy / dist * v; g.face = dx < 0 ? -1 : 1; }
        } else if (g.mode === 'wander') {
          let sp = g.speed;
          if (g.pers === 'shy' && H.mx != null) {                      // the shy one runs from your cursor
            const ddx = g.x + 19 - H.mx, ddy = g.y + 22 - H.my, d = Math.hypot(ddx, ddy);
            if (d < 140) { g.a = Math.atan2(ddy, ddx); sp = Math.max(sp, 160); if (!g.eep || ts - g.eep > 8000) { g.eep = ts; say(g, pick(PERS.shy.lines), 1400); } }
          }
          g.a += (Math.sin(ts / 1700 + g.ph) * 0.9) * dt;               // wander
          g.x += Math.cos(g.a) * sp * dt; g.y += Math.sin(g.a) * sp * dt + Math.sin(ts / 600 + g.ph) * 0.25;
          if (g.x < 8 || g.x > W - 60) { g.a = Math.PI - g.a; g.x = Math.max(8, Math.min(W - 60, g.x)); }
          if (g.y < 50 || g.y > Hh - 70) { g.a = -g.a; g.y = Math.max(50, Math.min(Hh - 70, g.y)); }
          g.face = Math.cos(g.a) < 0 ? -1 : 1;
        }
        g.el.style.transform = `translate(${g.x}px,${g.y}px)`;
        const body = g.el.firstChild; if (body && body.style) body.style.transform = `scaleX(${g.face || 1})`;
      }
    }

    function exorcise(id, celebrate) {
      const g = id && H.ghosts.get(id); if (!g || g.leaving) return;
      g.leaving = true; g.el.classList.add('poof');
      if (celebrate && !api.ui.reducedMotion()) for (let k = 0; k < 10; k++) {
        const s = document.createElement('i'); s.className = 'hn-spark';
        const ang = (k / 10) * 6.28, r = 40 + Math.random() * 30;
        s.style.cssText = `left:${g.x + 18}px;top:${g.y + 20}px;--c:${g.c};--dx:${Math.cos(ang) * r}px;--dy:${Math.sin(ang) * r}px`;
        H.layer.appendChild(s); setTimeout(() => s.remove(), 950);
      }
      setTimeout(() => { g.el.remove(); H.ghosts.delete(id); }, 1150);
      if (celebrate) {
        const left = [...H.ghosts.values()].filter(x => !x.leaving).length;
        api.island.show({ icon: '👻', color: g.c, title: 'Exorcised', sub: left ? `${left} ghost${left === 1 ? '' : 's'} still haunting you` : 'The backlog is at peace', ms: 3200 });
      }
    }
  }
});
