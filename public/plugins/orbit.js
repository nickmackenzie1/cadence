/* Orbit: three round ideas (inspired by zumerlab/orbit, MIT; no code from it, no dependency).
   1. Client solar system (view): you're the sun; each client is a planet. The ones you touched most recently orbit
      closest, planet size = open work, moons = things they owe you, a red halo = overdue. Click a planet to open it.
   2. 24-hour day clock (in the view and as a dashboard widget): meetings as arcs, timed tasks as dots, night shaded,
      a hand for now, and what's next.
   3. Radial menu: right-click on empty space (Shift+right-click for the browser's menu) or ⌘K "Radial menu". */
(() => {
  const KEY = 'cadence.orbit';
  const G = window.__orbit = window.__orbit || {};
  const opt = () => { let v = null; try { v = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {} return Object.assign({ radial: true }, v || {}); };
  const setOpt = n => { try { localStorage.setItem(KEY, JSON.stringify(Object.assign(opt(), n))); } catch (e) {} };
  const esc = window.CadenceKit.esc;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  Cadence.registerPlugin({
    id: 'orbit', name: 'Orbit', version: '1.0.0', category: 'Views', spaces: ['work', 'life'],
    description: 'Round ways to see your work: a client solar system (recent clients orbit closest), a 24-hour day clock of meetings and timed tasks, and a radial menu on right-click.',
    tagline: 'Solar system, day clock, radial menu', color: '#6366f1',
    icon: '<circle cx="12" cy="12" r="3"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><path d="M10.4 21.9a10 10 0 0 0 9.941-15.416M13.5 2.1a10 10 0 0 0-9.841 15.416"/>',
    settings() { G.settings && G.settings(); },
    setup(api) {
      G.stop && G.stop();
      const today = () => api.util.todayKey();
      const open = () => api.tasks.list(t => !t.done);
      const recents = () => { try { return JSON.parse(localStorage.getItem('cadence.recent.' + api.space()) || '[]'); } catch (e) { return []; } };

      /* ================= 1. solar system ================= */
      function system(el) {
        const clients = api.clients.list(), tasks = open(), rec = recents(), t0 = today();
        const stat = c => { const mine = tasks.filter(t => t.clientId === c.id), owe = mine.filter(t => t.owner === 'client'); return { on: mine.length - owe.length, owe: owe.length, over: mine.some(t => t.dueDate && t.dueDate < t0), last: Math.max(0, ...api.tasks.list(t => t.clientId === c.id).map(t => t.doneAt || t.createdAt || 0)) }; };
        const list = clients.map(c => ({ c, s: stat(c) }));
        // closeness: recently opened first, then recent activity
        list.sort((a, b) => { const ra = rec.indexOf(a.c.id), rb = rec.indexOf(b.c.id); if (ra >= 0 || rb >= 0) return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb); return b.s.last - a.s.last; });
        const mineToday = tasks.filter(t => t.owner !== 'client' && t.dueDate && t.dueDate <= t0).length;
        const W = el.clientWidth || 800, size = Math.max(380, Math.min(W, 660)), C = size / 2;
        // rings: 1 planet on the first, then more per ring as they get bigger
        const rings = []; let i = 0, k = 0; while (i < list.length) { const cap = [1, 3, 5, 7, 9, 12][Math.min(k, 5)]; rings.push(list.slice(i, i + cap)); i += cap; k++; }
        const R0 = 78, step = Math.min(56, (C - R0 - 30) / Math.max(1, rings.length));
        const planets = [];
        rings.forEach((ring, ri) => ring.forEach((p, j) => planets.push({ ...p, r: R0 + ri * step + (ri ? step * .5 : 0), a0: (j / ring.length) * Math.PI * 2 + ri * .7, sp: .00022 / Math.pow(1 + ri, 1.2), sz: Math.round(20 + Math.min(18, Math.sqrt(p.s.on) * 6)) })));
        el.innerHTML = `<div class="ob-sys" style="width:${size}px;height:${size}px">
          ${[...new Set(planets.map(p => p.r))].map(r => `<i class="ob-ring" style="width:${r * 2}px;height:${r * 2}px;left:${C - r}px;top:${C - r}px"></i>`).join('')}
          <div class="ob-sun" style="left:${C}px;top:${C}px"><b>${mineToday}</b><span>on you today</span></div>
          ${planets.map((p, n) => `<a class="ob-pl ${p.s.over ? 'over' : ''}" data-n="${n}" href="#client-${esc(p.c.id)}" style="--c:${esc(p.c.color || '#888')};width:${p.sz}px;height:${p.sz}px;margin:-${p.sz / 2}px 0 0 -${p.sz / 2}px">${api.ui.avatar(p.c, p.sz)}
            ${Array.from({ length: Math.min(6, p.s.owe) }, (_, m) => `<i class="ob-moon" style="--m:${m};--mn:${Math.min(6, p.s.owe)}"></i>`).join('')}
            <span class="ob-tip"><b>${esc(p.c.name)}</b>${p.s.on} on you · ${p.s.owe} they owe${p.s.over ? ' · <em>overdue</em>' : ''}</span></a>`).join('')}
          ${!planets.length ? `<div class="ob-empty" style="left:${C}px;top:${C + 70}px">Add a client and it will start orbiting.</div>` : ''}
        </div>`;
        const els = [...el.querySelectorAll('.ob-pl')]; let hover = false, t = 0, lastT = performance.now();
        el.querySelector('.ob-sys').onmouseenter = () => hover = true; el.querySelector('.ob-sys').onmouseleave = () => hover = false;
        const place = () => planets.forEach((p, n) => { const a = p.a0 + t * p.sp; els[n].style.transform = `translate(${(C + Math.cos(a) * p.r).toFixed(1)}px,${(C + Math.sin(a) * p.r * .92).toFixed(1)}px)`; });
        place();
        if (reduced()) return;
        const loop = now => { if (!el.isConnected) { G.raf = 0; return; } const dt = Math.min(64, now - lastT); lastT = now; t += dt * (hover ? .15 : 1); place(); G.raf = requestAnimationFrame(loop); };
        cancelAnimationFrame(G.raf); G.raf = requestAnimationFrame(loop);
      }

      /* ================= 2. 24h day clock ================= */
      function dayClock(el, small) {
        const S = small ? Math.min(el.clientWidth || 220, el.clientHeight || 220, 260) : 340, C = S / 2, R = C - (small ? 10 : 18);
        const now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
        const ang = m => (m / 1440) * Math.PI * 2 + Math.PI / 2;     // midnight at the bottom, noon at the top
        const pt = (m, r) => [C + Math.cos(ang(m)) * r, C + Math.sin(ang(m)) * r];
        const arc = (m1, m2, r) => { const [x1, y1] = pt(m1, r), [x2, y2] = pt(m2, r); return `M${x1.toFixed(1)} ${y1.toFixed(1)}A${r} ${r} 0 ${m2 - m1 > 720 ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`; };
        const t0 = today(), dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const evs = ((window.__cal && window.__cal.events) || []).filter(e => !e.allDay && e.start >= dayStart && e.start < dayStart + 864e5).map(e => ({ m1: (e.start - dayStart) / 6e4, m2: Math.min(1439, ((e.end || e.start + 18e5) - dayStart) / 6e4), title: e.title || 'Meeting' }));
        const timed = api.tasks.list(t => t.dueDate === t0 && t.dueTime).map(t => { const [h, m] = t.dueTime.split(':').map(Number); return { m: h * 60 + m, title: t.title, done: t.done }; });
        const nexts = [...evs.map(e => ({ m: e.m1, title: e.title })), ...timed.filter(x => !x.done)].filter(x => x.m > mins).sort((a, b) => a.m - b.m), nx = nexts[0];
        const fmt = m => { const h = Math.floor(m / 60), mm = String(Math.round(m % 60)).padStart(2, '0'); return `${(h % 12) || 12}:${mm}${h < 12 ? 'a' : 'p'}`; };
        const ticks = Array.from({ length: 24 }, (_, h) => { const [x1, y1] = pt(h * 60, R - (h % 6 ? 4 : 9)), [x2, y2] = pt(h * 60, R); return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="${h % 6 ? '' : 'mj'}"/>`; }).join('');
        const labels = small ? '' : [0, 6, 12, 18].map(h => { const [x, y] = pt(h * 60, R - 22); return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}">${h === 0 ? '12a' : h === 12 ? '12p' : h === 6 ? '6a' : '6p'}</text>`; }).join('');
        const [hx, hy] = pt(mins, R - 2);
        el.innerHTML = `<div class="ob-clock ${small ? 'sm' : ''}"><svg viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
          <circle cx="${C}" cy="${C}" r="${R}" class="face"/>
          <path d="${arc(22 * 60, 1439.9, R - 1)}" class="night"/><path d="${arc(.1, 7 * 60, R - 1)}" class="night"/>
          <path d="${arc(.1, Math.max(.2, mins), R - 1)}" class="past"/>
          ${ticks}${labels}
          ${evs.map(e => `<path d="${arc(e.m1, Math.max(e.m1 + 5, e.m2), R - (small ? 12 : 16))}" class="ev"><title>${esc(e.title)} · ${fmt(e.m1)}</title></path>`).join('')}
          ${timed.map(x => { const [x1, y1] = pt(x.m, R - (small ? 12 : 16)); return `<circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="${small ? 3.5 : 5}" class="tk ${x.done ? 'dn' : ''}"><title>${esc(x.title)} · ${fmt(x.m)}</title></circle>`; }).join('')}
          ${(() => { const [ix, iy] = pt(mins, R * .7); return `<line x1="${ix.toFixed(1)}" y1="${iy.toFixed(1)}" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}" class="hand"/><circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="4" class="hub"/>`; })()}
        </svg><div class="ob-ctr"><b>${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</b>${nx ? `<span>Next: ${esc(nx.title.slice(0, small ? 22 : 34))}<br>in ${Math.round(nx.m - mins) >= 60 ? Math.floor((nx.m - mins) / 60) + 'h ' : ''}${Math.round((nx.m - mins) % 60)}m</span>` : '<span>Nothing else timed today</span>'}</div></div>`;
      }

      api.views.add({ id: 'orbit', title: 'Orbit', icon: '🪐', subtitle: 'Recent clients closest, size is open work', render: el => {
        el.innerHTML = `<div class="ob-wrap"><div class="ob-left" id="ob-sys"></div><div class="ob-right"><div class="sect">Your day</div><div id="ob-clock"></div>
          <div class="ob-legend"><span><i class="lg ev"></i>Meetings</span><span><i class="lg tk"></i>Timed tasks</span><span><i class="lg nt"></i>Night</span></div></div></div>`;
        system(el.querySelector('#ob-sys')); dayClock(el.querySelector('#ob-clock'));
        clearInterval(G.clockIv); G.clockIv = setInterval(() => { const c = document.getElementById('ob-clock'); if (c) dayClock(c); else clearInterval(G.clockIv); }, 30000);
      } });
      api.widgets.add({ id: 'dayclock', title: 'Day clock', icon: 'clock-4', size: 's', description: '24 hours on one dial: meetings, timed tasks, and what’s next.', render: el => { dayClock(el, true); } });

      /* ================= 3. radial menu ================= */
      const ITEMS = () => [
        { ic: 'plus', label: 'Add task', run: () => { api.ui.navigate('today'); setTimeout(() => document.getElementById('qa') && document.getElementById('qa').focus(), 80); } },
        { ic: 'sun', label: 'Today', run: () => api.ui.navigate('today') },
        { ic: 'calendar', label: 'Upcoming', run: () => api.ui.navigate('upcoming') },
        { ic: 'hourglass', label: 'Waiting', run: () => api.ui.navigate('waiting') },
        { ic: 'orbit', label: 'Orbit', run: () => api.ui.navigate('view-orbit') },
        { ic: 'search', label: 'Search', run: () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true, bubbles: true })) },
        ...(api.space() === 'work' ? [{ ic: 'users', label: 'Meeting', run: () => api.meetings.start(null) }] : []),
        { ic: 'palette', label: 'Theme', run: () => { const t = window.CadenceThemes; if (t && t.next) t.next(); else api.ui.navigate('view-themes'); } },
      ];
      let wheel = null;
      function radial(x, y, viaHold) {
        close(); const items = ITEMS(), n = items.length, R = 78;
        x = Math.max(R + 30, Math.min(innerWidth - R - 30, x)); y = Math.max(R + 30, Math.min(innerHeight - R - 30, y));
        wheel = document.createElement('div'); wheel.id = 'ob-wheel'; wheel.style.left = x + 'px'; wheel.style.top = y + 'px';
        wheel.innerHTML = `<div class="ob-hub">${api.ui.icon('x')}</div>` + items.map((it, i) => { const a = -Math.PI / 2 + i / n * Math.PI * 2; return `<button class="ob-it" data-i="${i}" style="--x:${(Math.cos(a) * R).toFixed(1)}px;--y:${(Math.sin(a) * R).toFixed(1)}px;--d:${i * 18}ms">${api.ui.icon(it.ic)}<span>${esc(it.label)}</span></button>`; }).join('');
        document.body.appendChild(wheel); requestAnimationFrame(() => wheel && wheel.classList.add('on'));
        const btns = [...wheel.querySelectorAll('.ob-it')]; let sel = -1;
        const pickAt = (px, py) => { const dx = px - x, dy = py - y, d = Math.hypot(dx, dy); if (d < 26) return -1; let a = Math.atan2(dy, dx) + Math.PI / 2; if (a < 0) a += Math.PI * 2; return Math.round(a / (Math.PI * 2) * n) % n; };
        const go = i => { const it = items[i]; close(); it && it.run(); };
        wheel.onmousemove = e => { sel = pickAt(e.clientX, e.clientY); btns.forEach((b, i) => b.classList.toggle('hl', i === sel)); };
        wheel.onclick = e => { const b = e.target.closest('.ob-it'); if (b) go(+b.dataset.i); else if (e.target.closest('.ob-hub') || e.target === wheel) close(); };
        G.wheelUp = viaHold ? (e => { const i = pickAt(e.clientX, e.clientY); if (i >= 0 && Math.hypot(e.clientX - x, e.clientY - y) > 40) go(i); }) : null;
      }
      function close() { if (wheel) { const w = wheel; w.classList.remove('on'); setTimeout(() => w.remove(), 160); wheel = null; } G.wheelUp = null; }
      G.radial = radial; G.close = close;
      const blank = t => !t.closest('input,textarea,select,a,button,label,img,video,[contenteditable="true"],.task,.chip,.modal,.rs-pin,.cl-link,.shp,#ob-wheel,.isl-pill,canvas,pre,code');
      G.h = {
        ctx: e => { if (!opt().radial || e.shiftKey || !api.plugins.enabled('orbit') || !blank(e.target) || String(getSelection()).trim()) return; e.preventDefault(); radial(e.clientX, e.clientY, true); },
        up: e => { if (e.button === 2 && G.wheelUp) { const f = G.wheelUp; G.wheelUp = null; f(e); } },
        key: e => { if (e.key === 'Escape' && wheel) { e.stopPropagation(); close(); } },
        down: e => { if (wheel && !e.target.closest('#ob-wheel')) close(); },
      };
      if (!G.bound) { G.bound = true;
        document.addEventListener('contextmenu', e => G.h.ctx && G.h.ctx(e));
        document.addEventListener('mouseup', e => G.h.up && G.h.up(e), true);
        document.addEventListener('keydown', e => G.h.key && G.h.key(e), true);
        document.addEventListener('pointerdown', e => G.h.down && G.h.down(e), true); }
      api.commands.add({ title: 'Radial menu', hint: 'Or right-click empty space', run: () => setTimeout(() => radial(innerWidth / 2, innerHeight / 2), 50) });
      api.commands.add({ title: 'Orbit: client solar system', run: () => api.ui.navigate('view-orbit') });
      G.settings = () => {
        api.ui.modal('Orbit', `<label class="xm-row"><input type="checkbox" id="ob-radial" ${opt().radial ? 'checked' : ''}> Right-click empty space opens the radial menu</label>
          <div class="muted" style="font-size:12px;margin:6px 0 0">Shift+right-click always gives you the browser's own menu. Hold the right button, flick toward an item and let go to pick it without a second click.</div>`,
          `<button class="btn primary" id="ob-done">Done</button>`);
        document.getElementById('ob-done').onclick = () => { setOpt({ radial: document.getElementById('ob-radial').checked }); api.ui.close(); };
      };
      G.stop = () => { cancelAnimationFrame(G.raf); G.raf = 0; clearInterval(G.clockIv); close(); G.h = {}; };

      if (!document.getElementById('ob-css')) {
        const st = document.createElement('style'); st.id = 'ob-css';
        st.textContent = `
        .ob-wrap{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:24px;align-items:start}
        @media (max-width:1180px){.ob-wrap{grid-template-columns:1fr}.ob-right{justify-self:center}}
        .ob-left{min-width:0;display:flex;justify-content:center}
        .ob-right{position:sticky;top:20px}
        .ob-sys{position:relative;margin:0 auto}
        .ob-ring{position:absolute;border-radius:50%;border:1px dashed color-mix(in srgb,var(--text) 14%,transparent);transform:scaleY(.92)}
        .ob-sun{position:absolute;width:104px;height:104px;margin:-52px 0 0 -52px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#3a2600;
          background:radial-gradient(circle at 38% 35%,#fff6c4,#ffd25e 45%,#ff9f2e 80%);box-shadow:0 0 0 8px rgba(255,190,70,.16),0 0 60px 10px rgba(255,170,40,.35);animation:obSun 6s ease-in-out infinite}
        .ob-sun b{font:800 30px/1 ui-rounded,system-ui}.ob-sun span{font:600 10.5px/1.2 Inter,system-ui;opacity:.8;margin-top:2px}
        @keyframes obSun{50%{box-shadow:0 0 0 12px rgba(255,190,70,.12),0 0 80px 16px rgba(255,170,40,.3)}}
        .ob-pl{position:absolute;left:0;top:0;border-radius:50%;display:block;z-index:2;text-decoration:none;will-change:transform}
        .ob-pl .av{box-shadow:0 0 0 2px var(--bg),0 0 0 3.5px color-mix(in srgb,var(--c) 70%,transparent),0 6px 16px -4px color-mix(in srgb,var(--c) 60%,transparent);transition:transform .2s}
        .ob-pl:hover{z-index:5}.ob-pl:hover .av{transform:scale(1.25)}
        .ob-pl.over .av{box-shadow:0 0 0 2px var(--bg),0 0 0 4px #e5484d,0 0 18px 2px rgba(229,72,77,.5)}
        .ob-moon{position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px;border-radius:50%;background:color-mix(in srgb,var(--c) 55%,#fff);box-shadow:0 0 4px rgba(0,0,0,.25);
          transform:rotate(calc(var(--m) / var(--mn) * 360deg)) translateX(calc(50% + 14px)) ;animation:obMoon 7s linear infinite;--r0:calc(var(--m) / var(--mn) * 360deg)}
        @keyframes obMoon{from{transform:rotate(var(--r0)) translateX(24px)}to{transform:rotate(calc(var(--r0) + 360deg)) translateX(24px)}}
        .ob-tip{position:absolute;left:50%;bottom:calc(100% + 10px);transform:translateX(-50%);white-space:nowrap;background:var(--panel,#fff);color:var(--text);border:1px solid var(--line);border-radius:var(--r-m);padding:6px 9px;font:12px/1.35 Inter,system-ui;box-shadow:0 8px 24px -8px rgba(0,0,0,.25);opacity:0;pointer-events:none;transition:opacity .15s}
        .ob-tip b{display:block}.ob-tip em{color:#e5484d;font-style:normal;font-weight:600}
        .ob-pl:hover .ob-tip{opacity:1}
        .ob-empty{position:absolute;transform:translateX(-50%);color:var(--muted);font-size:13px;white-space:nowrap}
        .ob-clock{position:relative;display:inline-block}
        .ob-clock svg{display:block}
        .ob-clock .face{fill:var(--panel,#fff);stroke:var(--line)}
        .ob-clock .night{fill:none;stroke:color-mix(in srgb,#3b3f8f 22%,transparent);stroke-width:22}
        .ob-clock.sm .night{stroke-width:14}
        .ob-clock .past{fill:none;stroke:color-mix(in srgb,var(--text) 4%,transparent);stroke-width:22}
        .ob-clock.sm .past{stroke-width:14}
        .ob-clock line{stroke:color-mix(in srgb,var(--text) 30%,transparent);stroke-width:1}.ob-clock line.mj{stroke-width:2;stroke:color-mix(in srgb,var(--text) 55%,transparent)}
        .ob-clock text{font:600 10.5px Inter,system-ui;fill:var(--muted);text-anchor:middle}
        .ob-clock .ev{fill:none;stroke:var(--accent,#5b5bd6);stroke-width:9;stroke-linecap:round;opacity:.85}
        .ob-clock.sm .ev{stroke-width:6}
        .ob-clock .tk{fill:#f59e0b;stroke:var(--panel,#fff);stroke-width:1.5}.ob-clock .tk.dn{fill:#22a06b}
        .ob-clock .hand{stroke:#e5484d!important;stroke-width:2.2!important;stroke-linecap:round}.ob-clock .hub{fill:#e5484d}
        .ob-ctr{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none;width:56%}
        .ob-ctr b{display:block;font:800 22px/1.1 ui-rounded,system-ui;color:var(--text)}.ob-clock.sm .ob-ctr b{font-size:16px}
        .ob-ctr span{display:block;font:12px/1.35 Inter,system-ui;color:var(--muted);margin-top:4px}.ob-clock.sm .ob-ctr span{font-size:11px}
        
        .ob-legend{display:flex;gap:14px;font-size:12px;color:var(--muted);margin-top:10px}
        .ob-legend .lg{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px;vertical-align:-1px}
        .lg.ev{background:var(--accent,#5b5bd6)}.lg.tk{background:#f59e0b}.lg.nt{background:color-mix(in srgb,#3b3f8f 30%,transparent)}
        #ob-wheel{position:fixed;z-index:120;width:0;height:0}
        #ob-wheel .ob-hub{position:absolute;width:44px;height:44px;margin:-22px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--panel,#fff);border:1px solid var(--line);color:var(--muted);box-shadow:0 10px 30px -8px rgba(0,0,0,.35);transform:scale(.3);opacity:0;transition:.18s cubic-bezier(.3,1.5,.5,1);cursor:pointer}
        #ob-wheel .ob-it{position:absolute;width:62px;height:62px;margin:-31px;border-radius:50%;border:1px solid var(--line);background:var(--panel,#fff);color:var(--text);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font:600 10px/1 Inter,system-ui;cursor:pointer;
          box-shadow:0 10px 26px -10px rgba(0,0,0,.35);transform:translate(0,0) scale(.2);opacity:0;transition:transform .26s cubic-bezier(.3,1.45,.5,1) var(--d),opacity .15s var(--d),background .12s}
        #ob-wheel.on .ob-hub{transform:none;opacity:1}
        #ob-wheel.on .ob-it{transform:translate(var(--x),var(--y)) scale(1);opacity:1}
        #ob-wheel .ob-it.hl,#ob-wheel .ob-it:hover{background:var(--accent,#5b5bd6);color:#fff;border-color:transparent}
        #ob-wheel .ob-it.hl{transform:translate(calc(var(--x) * 1.08),calc(var(--y) * 1.08)) scale(1.08)}
        #ob-wheel .ob-it svg{width:17px;height:17px}
        @media (prefers-reduced-motion:reduce){.ob-sun,.ob-moon{animation:none}}`;
        document.head.appendChild(st);
      }
    },
  });
})();
