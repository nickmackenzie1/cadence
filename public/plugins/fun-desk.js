/* Desk toys that are secretly useful:
   - Focus aquarium: focus sessions (25 / 50 min) and every finished one adds a fish to your tank.
   - Invoice radar (Work): which clients have work done since you last billed them, on a radar.
   - Desk plant: grows as you finish things, droops when overdue work piles up.
   - Weekly rewind: your week as a short story, offered on Friday afternoon. */
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = (id, text) => { if (document.getElementById(id)) return; const s = document.createElement('style'); s.id = id; s.textContent = text; document.head.appendChild(s); };
  const DAY = 864e5;

  /* ======================= Focus aquarium ======================= */
  const SPECIES = [
    { name: 'Neon tetra', body: [12, 4], tail: 5, min: 0 },
    { name: 'Guppy', body: [14, 6], tail: 8, min: 0 },
    { name: 'Clownfish', body: [18, 9], tail: 7, min: 25, stripes: true },
    { name: 'Angelfish', body: [16, 14], tail: 8, min: 40, tall: true },
    { name: 'Pufferfish', body: [17, 15], tail: 5, min: 50, round: true },
    { name: 'Koi', body: [30, 11], tail: 12, min: 50 },
  ];
  Cadence.registerPlugin({
    id: 'aquarium', name: 'Focus aquarium', version: '1.0.0', category: 'Fun', spaces: ['work', 'life'],
    description: 'Start a focus session (25 or 50 minutes). Finish it and a new fish joins your tank. Longer sessions bring rarer fish.',
    tagline: 'Focus time grows a fish tank', color: '#06b6d4',
    icon: '<path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z"/><path d="M18 12v.5M16 17.93a9.77 9.77 0 0 1 0-11.86M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33"/>',
    setup(api) {
      const W = window.__aqua = window.__aqua || {};
      const fish = () => api.storage.get('fish') || [];
      const stats = () => Object.assign({ minutes: 0, sessions: 0 }, api.storage.get('stats') || {});
      const cur = () => { try { return JSON.parse(localStorage.getItem('cadence.focus') || 'null'); } catch (e) { return null; } };
      const setCur = v => { try { v ? localStorage.setItem('cadence.focus', JSON.stringify(v)) : localStorage.removeItem('cadence.focus'); } catch (e) {} };
      const left = f => Math.max(0, f.start + f.mins * 60e3 - Date.now());
      const mmss = ms => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
      function start(mins) { setCur({ start: Date.now(), mins }); tick(); api.ui.toast(`Focus for ${mins} minutes. A fish is waiting.`); refresh(); }
      function stop(early) {
        const f = cur(); if (!f) return; setCur(null); api.island.clear('focus');
        if (early) { api.ui.toast('Focus stopped. No fish this time.'); refresh(); return; }
        const pool = SPECIES.filter(s => s.min <= f.mins), sp = pool[Math.floor(Math.random() * pool.length)], k = SPECIES.indexOf(sp);
        const nf = { id: Date.now().toString(36), k, hue: Math.floor(Math.random() * 360), size: .85 + Math.random() * .3 + (f.mins >= 50 ? .2 : 0), at: Date.now(), mins: f.mins };
        api.storage.set('fish', [...fish(), nf].slice(-60)); const st = stats(); api.storage.set('stats', { minutes: st.minutes + f.mins, sessions: st.sessions + 1 });
        api.island.celebrate ? api.island.celebrate({ icon: '🐟', title: `A ${sp.name} joined your tank`, sub: `${f.mins} minutes of focus · ${fish().length} fish` }) : api.ui.toast(`A ${sp.name} joined your tank`);
        api.notify({ title: `Focus done: a ${sp.name} joined your tank`, body: `${f.mins} minutes`, route: 'view-aquarium', quiet: true });
        refresh();
      }
      function tick() {
        clearInterval(W.iv); const f = cur(); if (!f) { api.island.clear('focus'); return; }
        if (left(f) <= 0) { stop(false); return; }
        api.island.live('focus', { prio: 8, view: () => ({ tick: () => mmss(left(cur() || f)), minW: 170, onClick: () => askStop(),
          html: `<span class="isl-dot" style="background:#06b6d4;box-shadow:0 0 0 3px rgba(6,182,212,.2)"></span><span class="isl-t"><b>Focus</b></span><span class="isl-right" data-live-tick>${mmss(left(f))}</span>` }) });
        W.iv = setInterval(() => { const g = cur(); if (!g) return clearInterval(W.iv); if (left(g) <= 0) { clearInterval(W.iv); stop(false); } }, 1000);
      }
      const askStop = () => api.island.show({ icon: '🐟', title: 'Stop focusing early?', sub: 'You won’t get a fish for this one.', sticky: true, log: false, actions: [{ label: 'Stop', run: () => stop(true) }, { label: 'Keep going', run: () => {} }] });
      const refresh = () => { api.ui.refreshWidgets && api.ui.refreshWidgets(); if (api.ui.currentRoute() === 'view-aquarium') api.ui.refresh(); };

      function tank(el, big) {
        const H = big ? 380 : 170;
        el.innerHTML = `<div class="aq ${big ? 'big' : ''}"><canvas height="${H}"></canvas><div class="aq-bar">${cur() ? `<span>Focusing · <b class="aq-left">${mmss(left(cur()))}</b></span><button class="btn" data-aq="stop">Stop</button>` : `<span>${fish().length} fish · ${Math.round(stats().minutes / 6) / 10}h focused</span><button class="btn" data-aq="25">Focus 25</button><button class="btn" data-aq="50">50</button>`}</div></div>`;
        el.querySelectorAll('[data-aq]').forEach(b => b.onclick = () => { const v = b.dataset.aq; if (v === 'stop') askStop(); else start(+v); });
        const cv = el.querySelector('canvas'), cx = cv.getContext('2d'), DPR = Math.min(2, devicePixelRatio || 1);
        const fit = () => { cv.width = cv.clientWidth * DPR; cv.height = H * DPR; }; fit();
        const fs = fish().map((f, i) => ({ ...f, sp: SPECIES[f.k] || SPECIES[0], x: Math.random(), y: .15 + Math.random() * .6, dir: Math.random() < .5 ? 1 : -1, v: .0004 + Math.random() * .0005, ph: Math.random() * 6 }));
        const bubbles = Array.from({ length: 10 }, () => ({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 2.5, v: .002 + Math.random() * .002 }));
        let last = performance.now();
        const frame = t => {
          if (!cv.isConnected) return; const dt = Math.min(50, t - last); last = t; const w = cv.width / DPR, h = H;
          if (Math.abs(cv.clientWidth * DPR - cv.width) > 2) fit();
          cx.setTransform(DPR, 0, 0, DPR, 0, 0);
          const g = cx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#6fd3e8'); g.addColorStop(1, '#13658f'); cx.fillStyle = g; cx.fillRect(0, 0, w, h);
          // light rays
          cx.globalAlpha = .08; cx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { const x = (i * .27 + Math.sin(t / 4000 + i) * .03) * w; cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x + 40, 0); cx.lineTo(x + 120, h); cx.lineTo(x + 60, h); cx.fill(); } cx.globalAlpha = 1;
          // sand + weed
          cx.fillStyle = '#e8d29a'; cx.beginPath(); cx.moveTo(0, h); for (let x = 0; x <= w; x += 20) cx.lineTo(x, h - 14 - Math.sin(x / 50) * 4); cx.lineTo(w, h); cx.fill();
          cx.strokeStyle = '#2f8f4e'; cx.lineWidth = 4; cx.lineCap = 'round';
          for (const wx of [.08, .12, .82, .9]) { cx.beginPath(); cx.moveTo(wx * w, h - 12); for (let k = 1; k <= 6; k++) cx.lineTo(wx * w + Math.sin(t / 900 + k + wx * 9) * 5 * k / 3, h - 12 - k * (big ? 16 : 9)); cx.stroke(); }
          // bubbles
          cx.fillStyle = 'rgba(255,255,255,.55)'; for (const b of bubbles) { if (!reduced()) { b.y -= b.v * dt / 16; if (b.y < -.05) { b.y = 1; b.x = Math.random() * .3 + (Math.random() < .5 ? .05 : .7); } } cx.beginPath(); cx.arc(b.x * w + Math.sin(t / 500 + b.r) * 3, b.y * h, b.r, 0, 6.3); cx.fill(); }
          // fish
          for (const f of fs) {
            if (!reduced()) { f.x += f.dir * f.v * dt / 16 * 6; if (f.x > 1.05) f.dir = -1; if (f.x < -.05) f.dir = 1; f.ph += dt / 220; }
            const s = f.size * (big ? 1.4 : 1), [bw, bh] = f.sp.body, x = f.x * w, y = f.y * (h - 30) + 10 + Math.sin(f.ph / 3) * 4, wag = Math.sin(f.ph) * .35;
            cx.save(); cx.translate(x, y); cx.scale(f.dir * s, s);
            cx.fillStyle = `hsl(${f.hue} 75% 55%)`;
            cx.beginPath(); cx.moveTo(-bw * .9, 0); cx.lineTo(-bw * .9 - f.sp.tail, -f.sp.tail * .8 + wag * 4); cx.lineTo(-bw * .9 - f.sp.tail, f.sp.tail * .8 + wag * 4); cx.closePath(); cx.fill();
            cx.beginPath(); if (f.sp.tall) { cx.moveTo(bw, 0); cx.lineTo(0, -bh); cx.lineTo(-bw, 0); cx.lineTo(0, bh); cx.closePath(); } else cx.ellipse(0, 0, bw, bh, 0, 0, 6.3); cx.fill();
            if (f.sp.stripes) { cx.fillStyle = 'rgba(255,255,255,.85)'; cx.fillRect(-2, -bh, 3, bh * 2); cx.fillRect(bw * .45, -bh * .8, 2.5, bh * 1.6); }
            cx.fillStyle = `hsl(${f.hue} 80% 75% / .6)`; cx.beginPath(); cx.ellipse(-bw * .1, -bh * .35, bw * .45, bh * .25, 0, 0, 6.3); cx.fill();
            cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(bw * .55, -bh * .2, Math.max(1.6, bh * .22), 0, 6.3); cx.fill(); cx.fillStyle = '#111'; cx.beginPath(); cx.arc(bw * .6, -bh * .2, Math.max(.9, bh * .12), 0, 6.3); cx.fill();
            cx.restore();
          }
          if (!fs.length) { cx.fillStyle = 'rgba(255,255,255,.85)'; cx.font = '600 13px Inter,system-ui'; cx.textAlign = 'center'; cx.fillText('Finish a focus session to get your first fish', w / 2, h / 2); }
          const lt = el.querySelector('.aq-left'); if (lt && cur()) lt.textContent = mmss(left(cur()));
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }
      api.views.add({ id: 'aquarium', title: 'Aquarium', icon: '🐟', subtitle: 'Every finished focus session adds a fish. Longer sessions bring rarer ones.', render: el => {
        tank(el, true);
        const box = document.createElement('div'); box.className = 'aq-list';
        box.innerHTML = fish().slice().reverse().slice(0, 30).map(f => `<span style="--h:${f.hue}"><i></i>${esc((SPECIES[f.k] || SPECIES[0]).name)}<em>${new Date(f.at).toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${f.mins}m</em></span>`).join('');
        el.appendChild(box);
      } });
      api.widgets.add({ id: 'tank', title: 'Focus aquarium', icon: 'fish', size: 'm', description: 'Your fish tank and a focus timer.', render: el => tank(el, false) });
      api.commands.add({ title: 'Focus for 25 minutes', hint: 'Earn a fish', run: () => start(25) });
      api.commands.add({ title: 'Focus for 50 minutes', hint: 'Rarer fish', run: () => start(50) });
      api.commands.add({ title: 'Stop focus', run: () => stop(true) });
      W.start = start; W.stop = stop; W.finishNow = () => { const f = cur(); if (f) { setCur({ ...f, start: Date.now() - f.mins * 60e3 - 10 }); stop(false); } };
      tick();
      css('aq-css', `.aq{border-radius:14px;overflow:hidden;border:1px solid var(--line);background:#13658f}.aq canvas{display:block;width:100%}
        .aq-bar{display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--panel);font-size:12.5px;color:var(--muted)}.aq-bar span{margin-right:auto}.aq-bar .btn{padding:4px 10px}
        .aq-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}.aq-list span{display:inline-flex;align-items:center;gap:6px;font-size:12px;border:1px solid var(--line);border-radius:999px;padding:3px 9px 3px 6px}
        .aq-list i{width:10px;height:10px;border-radius:50%;background:hsl(var(--h) 75% 55%)}.aq-list em{font-style:normal;color:var(--muted)}`);
    },
  });

  /* ======================= Invoice radar ======================= */
  Cadence.registerPlugin({
    id: 'invoice-radar', name: 'Invoice radar', version: '1.0.0', category: 'Clients', spaces: ['work'],
    description: 'Shows which clients have work done since you last invoiced them. The further out on the radar, the longer it’s been. Mark a client invoiced when you send the bill.',
    tagline: 'Who you haven’t billed yet', color: '#16a34a',
    icon: '<path d="M19.07 4.93A10 10 0 0 0 6.99 3.34M4 6h.01M2.29 9.62A10 10 0 1 0 21.31 8.35M16.24 7.76A6 6 0 1 0 8.23 16.67M12 18h.01M17.99 11.66A6 6 0 0 1 15.77 16.67"/><circle cx="12" cy="12" r="2"/><path d="m13.41 10.59 5.66-5.66"/>',
    setup(api) {
      const inv = () => api.storage.get('invoiced') || {};
      function rows() {
        const all = api.tasks.list(t => t.done && t.clientId && t.doneAt), m = inv();
        return api.clients.list().filter(c => c.kind !== 'project').map(c => {
          const since = m[c.id] || 0, un = all.filter(t => t.clientId === c.id && t.doneAt > since).sort((a, b) => a.doneAt - b.doneAt);
          return { c, since, un, oldest: un[0] ? Math.floor((Date.now() - un[0].doneAt) / DAY) : 0, days: since ? Math.floor((Date.now() - since) / DAY) : null };
        }).filter(r => r.un.length).sort((a, b) => b.oldest - a.oldest || b.un.length - a.un.length);
      }
      function radar(list, S) {
        const C = S / 2, R = C - 18, maxD = Math.max(30, ...list.map(r => r.oldest));
        return `<svg viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" class="ir-svg">${[1, .66, .33].map(k => `<circle cx="${C}" cy="${C}" r="${R * k}"/>`).join('')}<line x1="${C}" y1="${C - R}" x2="${C}" y2="${C + R}"/><line x1="${C - R}" y1="${C}" x2="${C + R}" y2="${C}"/>
          <path class="sweep" d="M${C} ${C}L${C} ${C - R}A${R} ${R} 0 0 1 ${C + R * Math.sin(.6)} ${C - R * Math.cos(.6)}Z"/>
          ${list.map((r, i) => { const a = i / list.length * Math.PI * 2 + .4, d = 14 + (R - 14) * Math.min(1, r.oldest / maxD), x = C + Math.sin(a) * d, y = C - Math.cos(a) * d, z = 5 + Math.min(10, r.un.length * 1.5);
            return `<g class="blip ${r.oldest > 30 ? 'hot' : ''}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${z}" style="fill:${esc(r.c.color)}"><title>${esc(r.c.name)}: ${r.un.length} done since last invoice, oldest ${r.oldest}d</title></circle><text x="${x.toFixed(1)}" y="${(y + z + 11).toFixed(1)}">${esc(r.c.name.slice(0, 12))}</text></g>`; }).join('')}
          <text x="${C}" y="${C - R - 4}" class="lbl">${maxD}d</text></svg>`;
      }
      function view(el) {
        const list = rows();
        el.innerHTML = `<div class="ir-wrap"><div>${radar(list, 300)}<div class="muted" style="font-size:12px;text-align:center">Further out = older unbilled work · bigger = more of it</div></div>
          <div class="ir-list">${list.map(r => `<div class="ir-row">${api.ui.avatar(r.c, 26)}<div><b>${esc(r.c.name)}</b><span>${r.un.length} done since ${r.since ? 'your last invoice (' + r.days + 'd ago)' : 'you started tracking'} · oldest ${r.oldest}d</span>
            <span class="ir-t">${r.un.slice(-3).map(t => esc(t.title)).join(' · ')}</span></div><button class="btn" data-inv="${esc(r.c.id)}">Invoiced</button></div>`).join('') || '<div class="muted" style="padding:20px 0">Nothing unbilled. Every finished task has been invoiced.</div>'}</div></div>`;
        el.querySelectorAll('[data-inv]').forEach(b => b.onclick = () => { api.storage.set('invoiced', { ...inv(), [b.dataset.inv]: Date.now() }); api.ui.toast('Marked invoiced'); api.ui.refresh(); });
      }
      api.views.add({ id: 'invoices', title: 'Invoice radar', icon: '📡', subtitle: 'Clients with finished work you haven’t billed yet', render: view });
      api.widgets.add({ id: 'radar', title: 'Invoice radar', icon: 'radar', size: 'm', description: 'Clients with work done since you last invoiced them.', render: el => { const l = rows(); el.innerHTML = `<div class="ir-mini">${radar(l, 150)}<div>${l.slice(0, 4).map(r => `<div class="ir-m"><i style="background:${esc(r.c.color)}"></i>${esc(r.c.name)}<em>${r.un.length}</em></div>`).join('') || '<span class="muted">All billed</span>'}</div></div>`; } });
      api.clientActions.add({ label: 'Mark invoiced', run: c => { api.storage.set('invoiced', { ...inv(), [c.id]: Date.now() }); api.ui.toast(`${c.name} marked invoiced`); } });
      // first working day of the month: one nudge
      setTimeout(() => { const d = new Date(), k = d.getFullYear() + '-' + d.getMonth(); if (d.getDate() > 5 || api.storage.get('nudged') === k) return; const l = rows(); if (!l.length) return; api.storage.set('nudged', k);
        api.island.show({ icon: '📡', title: `${l.length} client${l.length === 1 ? ' has' : 's have'} unbilled work`, sub: l.slice(0, 3).map(r => r.c.name).join(', '), actions: [{ label: 'Open radar', run: () => api.ui.navigate('view-invoices') }] }); }, 6000);
      css('ir-css', `.ir-wrap{display:grid;grid-template-columns:320px 1fr;gap:24px;align-items:start}@media (max-width:900px){.ir-wrap{grid-template-columns:1fr}}
        .ir-svg circle,.ir-svg line{fill:none;stroke:color-mix(in srgb,#16a34a 35%,var(--line))}.ir-svg{background:radial-gradient(circle,color-mix(in srgb,#16a34a 10%,transparent),transparent 70%);border-radius:50%}
        .ir-svg .sweep{fill:color-mix(in srgb,#16a34a 22%,transparent);transform-origin:50% 50%;animation:irSw 4s linear infinite}@keyframes irSw{to{transform:rotate(360deg)}}
        .ir-svg .blip circle{stroke:var(--bg);stroke-width:2}.ir-svg .blip.hot circle{stroke:#e5484d}.ir-svg text{font:600 9.5px Inter,system-ui;fill:var(--muted);text-anchor:middle}
        .ir-row{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}.ir-row b{display:block}.ir-row span{display:block;font-size:12px;color:var(--muted)}.ir-row .ir-t{font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:420px}
        .ir-mini{display:flex;gap:12px;align-items:center}.ir-m{display:flex;align-items:center;gap:6px;font-size:12.5px;padding:2px 0}.ir-m i{width:8px;height:8px;border-radius:50%}.ir-m em{margin-left:auto;font-style:normal;color:var(--muted);padding-left:10px}
        @media (prefers-reduced-motion:reduce){.ir-svg .sweep{animation:none}}`);
    },
  });

  /* ======================= Desk plant ======================= */
  Cadence.registerPlugin({
    id: 'desk-plant', name: 'Desk plant', version: '1.0.0', category: 'Fun', spaces: ['work', 'life'],
    description: 'A little plant that grows as you finish tasks and droops when overdue work piles up. Finishing anything waters it.',
    tagline: 'Grows when you get things done', color: '#22c55e',
    icon: '<path d="M7 20h10M10 20c5.5-2.5.8-6.4 3-10M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8zM14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
    setup(api) {
      const P = () => Object.assign({ name: 'Fern', grown: 0, last: 0 }, api.storage.get('plant') || {});
      const health = () => { const over = api.tasks.list(t => !t.done && t.owner !== 'client' && t.dueDate && t.dueDate < api.util.todayKey()).length, idle = P().last ? (Date.now() - P().last) / DAY : 0; return Math.max(0, Math.min(1, 1 - over * .08 - Math.max(0, idle - 1) * .15)); };
      const stage = () => Math.min(6, Math.floor(Math.sqrt(P().grown / 2)));
      const STAGES = ['Seed', 'Sprout', 'Seedling', 'Leafy', 'Bushy', 'Budding', 'In bloom'];
      api.on('task:complete', () => { const p = P(); api.storage.set('plant', { ...p, grown: p.grown + 1, last: Date.now() }); const s0 = Math.min(6, Math.floor(Math.sqrt(p.grown / 2))), s1 = stage(); W.water = Date.now(); if (s1 > s0) api.island.show({ icon: '🪴', title: `${p.name} grew: ${STAGES[s1]}`, sub: `${p.grown + 1} tasks of sunshine` }); api.ui.refreshWidgets && api.ui.refreshWidgets(); });
      const W = window.__plant = window.__plant || {};
      function svg(sz) {
        const s = stage(), h = health(), droop = (1 - h) * 22, leaf = `hsl(${Math.round(55 + h * 70)} ${Math.round(45 + h * 20)}% ${Math.round(42 + (1 - h) * 12)}%)`;
        const stemH = [4, 14, 26, 38, 48, 56, 62][s], top = 70 - stemH;
        let leaves = ''; const n = [0, 2, 3, 5, 7, 8, 9][s];
        for (let i = 0; i < n; i++) { const y = 68 - (i + 1) * stemH / (n + 1), side = i % 2 ? 1 : -1, len = 9 + Math.min(8, i * 1.4), a = side * (40 + droop + i * 2);
          leaves += `<ellipse cx="${50 + side * len * .55}" cy="${y}" rx="${len * .6}" ry="${len * .26}" fill="${leaf}" transform="rotate(${a} ${50} ${y})"/>`; }
        const flower = s >= 5 ? `<g transform="translate(50 ${top})">${[0, 72, 144, 216, 288].map(r => `<ellipse rx="${s === 6 ? 5 : 3}" ry="${s === 6 ? 2.6 : 1.8}" cx="${s === 6 ? 5 : 3}" fill="${h > .5 ? '#f472b6' : '#d6a5b9'}" transform="rotate(${r})"/>`).join('')}<circle r="2.2" fill="#facc15"/></g>` : s === 0 ? '<ellipse cx="50" cy="69" rx="3" ry="2" fill="#7c5a3a"/>' : '';
        const water = W.water && Date.now() - W.water < 2500 ? '<g class="pl-drop"><path d="M50 8c3 5 4 7 4 9a4 4 0 0 1-8 0c0-2 1-4 4-9z" fill="#38bdf8"/></g>' : '';
        return `<svg viewBox="0 0 100 100" width="${sz}" height="${sz}" class="pl-svg">${water}<path d="M50 70 Q ${50 + droop * .6} ${70 - stemH / 2} ${50 + droop} ${top}" stroke="${leaf}" stroke-width="2.4" fill="none" stroke-linecap="round"/>${leaves}${flower}
          <path d="M33 70h34l-4 22H37z" fill="#c2693d"/><rect x="31" y="66" width="38" height="7" rx="2" fill="#d97a49"/><ellipse cx="50" cy="69" rx="16" ry="2" fill="#5b3a24"/></svg>`;
      }
      const label = () => { const h = health(); return h > .75 ? 'Thriving' : h > .45 ? 'A bit thirsty' : h > .2 ? 'Wilting: overdue work is piling up' : 'Needs help: finish something'; };
      const draw = (el, big) => { const p = P(); el.innerHTML = `<div class="pl ${big ? 'big' : ''}">${svg(big ? 140 : 64)}<div><b class="pl-n" title="Rename">${esc(p.name)}</b><span>${STAGES[stage()]} · ${label()}</span><span class="muted">${p.grown} tasks of sunshine</span></div></div>`;
        el.querySelector('.pl-n').onclick = () => { api.ui.ask('Name your plant', [{ k: 'n', label: 'Name', def: p.name }]).then(v => { if (v && v.n) { api.storage.set('plant', { ...P(), name: v.n.slice(0, 24) }); draw(el, big); } }); }; };
      api.sidebar.add({ id: 'plant', slot: 'bottom', order: 21, title: 'Desk plant', render: el => draw(el, false) });
      api.widgets.add({ id: 'plant', title: 'Desk plant', icon: 'flower-2', size: 's', description: 'Grows when you finish things, droops when work is overdue.', render: el => draw(el, true) });
      css('pl-css', `.pl{display:flex;align-items:center;gap:10px;font-size:12.5px}.pl.big{flex-direction:column;text-align:center;padding:6px}.pl b{display:block;font-size:13.5px;cursor:pointer}.pl span{display:block}.pl .muted{font-size:11.5px}
        .pl-svg{overflow:visible}.pl-drop{animation:plDrop 1.2s ease-in forwards}@keyframes plDrop{from{transform:translateY(-10px);opacity:1}to{transform:translateY(40px);opacity:0}}`);
    },
  });

  /* ======================= Weekly rewind ======================= */
  Cadence.registerPlugin({
    id: 'rewind', name: 'Weekly rewind', version: '1.0.0', category: 'Insights', spaces: ['work', 'life'],
    description: 'Your week as a short story: what you finished, your busiest day, who you worked with, the oldest thing you finally closed. Offered on Friday afternoons.',
    tagline: 'Your week, in six cards', color: '#a855f7',
    icon: '<polygon points="11 19 2 12 11 5 11 19"/><polygon points="22 19 13 12 22 5 22 19"/>',
    setup(api) {
      const weekStart = (off = 0) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - off * 7); return d.getTime(); };
      function data() {
        const s = weekStart(), e = s + 7 * DAY, ps = weekStart(1);
        const done = api.tasks.list(t => t.done && t.doneAt >= s && t.doneAt < e), prev = api.tasks.list(t => t.done && t.doneAt >= ps && t.doneAt < s);
        const byDay = Array.from({ length: 7 }, (_, i) => done.filter(t => t.doneAt >= s + i * DAY && t.doneAt < s + (i + 1) * DAY).length);
        const bestI = byDay.indexOf(Math.max(...byDay));
        const cl = {}; done.forEach(t => { if (t.clientId) cl[t.clientId] = (cl[t.clientId] || 0) + 1; });
        const clients = Object.entries(cl).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ c: api.clients.get(id), n })).filter(x => x.c);
        const oldest = done.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))[0];
        const theirs = done.filter(t => t.owner === 'client').length, meetings = api.meetings.list().filter(m => m.start >= s && m.start < e).length;
        return { done, prev, byDay, bestI, clients, oldest, theirs, meetings, s };
      }
      function show() {
        const d = data(), names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], diff = d.done.length - d.prev.length, max = Math.max(1, ...d.byDay);
        const cards = [
          `<small>Your week</small><h2>${d.done.length}</h2><p>things finished${d.prev.length ? `, ${diff >= 0 ? diff + ' more' : -diff + ' fewer'} than last week` : ''}.</p>`,
          `<small>Busiest day</small><h2>${d.done.length ? names[d.bestI] : '—'}</h2><div class="rw-bars">${d.byDay.map((n, i) => `<i style="height:${8 + n / max * 90}px" class="${i === d.bestI && n ? 'on' : ''}"><b>${n || ''}</b><em>${names[i][0]}</em></i>`).join('')}</div>`,
          d.clients.length ? `<small>${api.space() === 'life' ? 'Where your time went' : 'Who you worked for'}</small><div class="rw-cl">${d.clients.slice(0, 6).map(x => `<span>${api.ui.avatar(x.c, 34)}<b>${esc(x.c.name)}</b><em>${x.n}</em></span>`).join('')}</div>` : null,
          d.oldest && d.oldest.createdAt && Date.now() - d.oldest.createdAt > 3 * DAY ? `<small>Finally closed</small><h3>“${esc(d.oldest.title)}”</h3><p>It sat on your list for ${Math.round((d.oldest.doneAt - d.oldest.createdAt) / DAY)} days.</p>` : null,
          api.space() === 'work' ? `<small>Also this week</small><div class="rw-n"><span><b>${d.meetings}</b>meetings</span><span><b>${d.theirs}</b>client items received</span></div>` : null,
          `<small>That’s a wrap</small><h3>${d.done.length >= 20 ? 'Huge week.' : d.done.length >= 8 ? 'Solid week.' : d.done.length ? 'Every bit counts.' : 'Rest weeks count too.'}</h3><p>See you Monday.</p>`,
        ].filter(Boolean);
        let i = 0; const ov = document.createElement('div'); ov.id = 'rw-ov';
        const draw = () => { ov.innerHTML = `<div class="rw-card"><div class="rw-dots">${cards.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div><div class="rw-body">${cards[i]}</div><div class="rw-nav"><button data-rw="prev" ${i ? '' : 'disabled'}>Back</button><button data-rw="next" class="pri">${i === cards.length - 1 ? 'Done' : 'Next'}</button></div></div>`; };
        draw(); document.body.appendChild(ov);
        ov.onclick = e => { const b = e.target.closest('[data-rw]'); if (e.target === ov) return ov.remove(); if (!b) return; if (b.dataset.rw === 'prev') i = Math.max(0, i - 1); else if (i === cards.length - 1) return ov.remove(); else i++; draw(); };
        const key = e => { if (!document.body.contains(ov)) return removeEventListener('keydown', key); if (e.key === 'Escape') ov.remove(); if (e.key === 'ArrowRight') { i = Math.min(cards.length - 1, i + 1); draw(); } if (e.key === 'ArrowLeft') { i = Math.max(0, i - 1); draw(); } };
        addEventListener('keydown', key);
        api.storage.set('seen', weekStart());
      }
      window.__rewind = { show, data };
      api.commands.add({ title: 'Weekly rewind', hint: 'Your week in six cards', run: show });
      setTimeout(() => { const d = new Date(); if (!(d.getDay() === 5 && d.getHours() >= 15) || api.storage.get('seen') === weekStart() || api.storage.get('offered') === weekStart()) return; if (!data().done.length) return; api.storage.set('offered', weekStart());
        api.island.show({ icon: '⏪', title: 'Your weekly rewind is ready', sub: `${data().done.length} things finished this week`, sticky: true, actions: [{ label: 'Watch', run: show }] }); }, 8000);
      css('rw-css', `#rw-ov{position:fixed;inset:0;z-index:130;background:rgba(10,8,20,.6);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center}
        .rw-card{width:380px;max-width:92vw;min-height:440px;display:flex;flex-direction:column;border-radius:22px;padding:18px 22px;color:#fff;background:linear-gradient(160deg,#6d28d9,#db2777 60%,#f59e0b);box-shadow:0 30px 80px -20px rgba(0,0,0,.6);animation:rwIn .35s cubic-bezier(.3,1.4,.5,1)}
        @keyframes rwIn{from{transform:scale(.9);opacity:0}}
        .rw-dots{display:flex;gap:4px}.rw-dots i{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.3)}.rw-dots i.on{background:#fff}
        .rw-body{flex:1;display:flex;flex-direction:column;justify-content:center;gap:8px;animation:rwIn .3s ease}.rw-body small{text-transform:uppercase;letter-spacing:.12em;font-size:11px;font-weight:700;opacity:.8}
        .rw-body h2{font:900 64px/1 ui-rounded,system-ui;margin:0}.rw-body h3{font:800 24px/1.25 ui-rounded,system-ui;margin:0}.rw-body p{margin:0;font-size:15px;opacity:.9}
        .rw-bars{display:flex;gap:8px;align-items:flex-end;height:120px;margin-top:10px}.rw-bars i{flex:1;background:rgba(255,255,255,.3);border-radius:6px 6px 2px 2px;position:relative}.rw-bars i.on{background:#fff}
        .rw-bars b{position:absolute;top:-17px;left:0;right:0;text-align:center;font-size:11px}.rw-bars em{position:absolute;bottom:-17px;left:0;right:0;text-align:center;font-size:11px;font-style:normal;opacity:.8}
        .rw-cl{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px}.rw-cl span{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.14);border-radius:12px;padding:8px}.rw-cl b{font-size:13px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rw-cl em{font-style:normal;font-weight:800}
        .rw-n{display:flex;gap:12px}.rw-n span{flex:1;background:rgba(255,255,255,.14);border-radius:14px;padding:14px;font-size:12.5px}.rw-n b{display:block;font:900 34px/1 ui-rounded,system-ui}
        .rw-nav{display:flex;gap:8px;justify-content:space-between;margin-top:14px}.rw-nav button{border:0;border-radius:999px;padding:8px 16px;font:700 13px Inter,system-ui;cursor:pointer;background:rgba(255,255,255,.2);color:#fff}.rw-nav .pri{background:#fff;color:#6d28d9}.rw-nav button:disabled{opacity:.3}`);
    },
  });
})();
