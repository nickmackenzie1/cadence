/* Momentum — gamified progress for Cadence.
   XP for every completed task, combos, crits, streaks, levels, achievements,
   Borderlands-style damage numbers that burst from whatever you clicked,
   and a little world in the sidebar (plant / mountain / tower) that grows as you work. */
(() => {
  // one shared overlay + font, created once no matter how often the plugin is rebuilt
  const G = window.__momentum = window.__momentum || {};
  if (!G.layer) {
    G.layer = document.createElement('div');
    G.layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:70;overflow:hidden';
    document.body.appendChild(G.layer);
    const f = document.createElement('link'); f.rel = 'stylesheet'; f.href = 'https://fonts.googleapis.com/css2?family=Bangers&family=Luckiest+Guy&display=swap'; document.head.appendChild(f);
    const st = document.createElement('style'); st.textContent = `
      .mo-num{position:absolute;left:0;top:0;font-family:Bangers,"Luckiest Guy",Impact,"Arial Black",sans-serif;font-weight:400;letter-spacing:.03em;white-space:nowrap;will-change:transform,opacity;line-height:.95;isolation:isolate;filter:drop-shadow(0 0 14px color-mix(in srgb,var(--g) 55%,transparent))}
      /* Borderlands-style: chunky black outline + offset shadow behind a top-lit gradient fill, slanted */
      .mo-num .w{display:grid;transform:skewX(-9deg)}
      .mo-num .w>span{grid-area:1/1;display:block;text-align:center}
      .mo-num .o{color:#120f16;-webkit-text-stroke:.17em #120f16;text-shadow:.05em .08em 0 #120f16,.08em .12em 0 #120f16}
      .mo-num .f{color:transparent;background:linear-gradient(180deg,#fff 0%,#fff 30%,var(--g) 70%,color-mix(in srgb,var(--g) 65%,#000) 100%);-webkit-background-clip:text;background-clip:text}
      .mo-num .lbw{font-size:.4em;letter-spacing:.1em;margin-bottom:.14em}
      .mo-num .lbw .o{-webkit-text-stroke:.24em #120f16}
      .mo-num .lbw .f{background:linear-gradient(180deg,#fff 5%,var(--g) 85%);-webkit-background-clip:text;background-clip:text}
      .mo-spark{position:absolute;left:0;top:0;width:8px;height:8px;background:var(--g);clip-path:polygon(50% 0,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0 50%,39% 39%);will-change:transform,opacity}
      .mo-orb{position:absolute;left:0;top:0;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:radial-gradient(circle,#fff,var(--g) 60%,transparent 70%);box-shadow:0 0 14px var(--g),0 0 4px #fff;will-change:transform}
      .mo-strip{border-radius:10px;transition:background .15s}
      .mo-strip:hover,.mo-strip.open{background:var(--hover)}
      .mo-head{display:flex;align-items:center;gap:10px;padding:6px 8px;cursor:pointer;user-select:none}
      .mo-rings{width:30px;height:30px;flex:none;transform:rotate(-90deg)}
      .mo-rings circle{fill:none;stroke-linecap:round;transition:stroke-dashoffset .9s cubic-bezier(.2,.9,.2,1)}
      .mo-rings .bg{stroke:color-mix(in srgb,var(--text) 9%,transparent)}
      .mo-head.bump .mo-rings{animation:mobump .55s cubic-bezier(.2,1.6,.4,1)}
      @keyframes mobump{35%{transform:rotate(-90deg) scale(1.18)}}
      .mo-txt{flex:1;min-width:0;line-height:1.2}
      .mo-txt b{font-size:13px;font-weight:650;display:block}
      .mo-txt span{font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums}
      .mo-streak{font-weight:650;font-size:12px;display:flex;align-items:center;gap:2px;font-variant-numeric:tabular-nums}
      .mo-streak.cold{opacity:.35;filter:grayscale(1)}
      .mo-chev{color:var(--faint);font-size:11px;transition:transform .2s;margin-left:2px}
      .mo-strip.open .mo-chev{transform:rotate(90deg)}
      .mo-body{display:grid;grid-template-rows:0fr;transition:grid-template-rows .3s cubic-bezier(.2,.9,.2,1)}
      .mo-strip.open .mo-body{grid-template-rows:1fr}
      .mo-body>div{overflow:hidden;min-height:0}
      .mo-world{height:96px;margin:2px 8px 6px;border-radius:9px;overflow:hidden;position:relative;background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 10%,transparent),transparent)}
      .mo-world svg{width:100%;height:100%;display:block}
      .mo-sub{display:flex;justify-content:space-between;align-items:center;padding:0 9px 8px;font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums}
      .mo-sub .mo-statslink{color:var(--text);font-weight:600;cursor:pointer;flex:none}
      .mo-sub .mo-statslink:hover{color:var(--accent)}
      .mo-sub .td{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .mo-sway{transform-box:fill-box;transform-origin:50% 100%;animation:mosway 5s ease-in-out infinite}
      @keyframes mosway{50%{transform:rotate(1.6deg)}}
      .mo-cloud{animation:mocloud 40s linear infinite}
      .mo-grow{transform-box:fill-box;transform-origin:50% 100%;animation:mogrow .9s cubic-bezier(.2,1.6,.4,1)}
      @keyframes mogrow{from{transform:scale(0)}}
      .mo-fly{animation:mofly 7s ease-in-out infinite}
      @keyframes mofly{25%{transform:translate(14px,-6px)}50%{transform:translate(4px,-12px)}75%{transform:translate(-10px,-4px)}}
      @keyframes mocloud{from{transform:translateX(-60px)}to{transform:translateX(260px)}}
      .mo-drop{animation:modrop .9s ease-in forwards}
      @keyframes modrop{from{transform:translateY(-40px);opacity:1}90%{opacity:1}to{transform:translateY(46px);opacity:0}}
      .mo-hop{animation:mohop .5s ease}
      @keyframes mohop{40%{transform:translateY(-8px)}}
      .mo-fall{animation:mofall .55s cubic-bezier(.5,0,.8,.4)}
      @keyframes mofall{from{transform:translateY(-90px)}}
      @keyframes moach{from{opacity:0;transform:translateX(-20px) scale(.9)}}
      .mo-modal-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
      .mo-tile{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:12px}
      .mo-tile .v{font:800 24px/1 ui-sans-serif,system-ui;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
      .mo-tile .l{font-size:11.5px;color:var(--muted);margin-top:4px}
      .mo-bars{display:flex;align-items:flex-end;gap:8px;height:110px;padding:8px 4px 0}
      .mo-bars div{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:10.5px;color:var(--muted)}
      .mo-bars div i{display:block;width:100%;border-radius:6px 6px 3px 3px;background:linear-gradient(180deg,#b06bd6,#5b5bd6);min-height:3px;transition:height .6s}
      .mo-bars div.today i{background:linear-gradient(180deg,#ff7a8a,#b06bd6)}
      .mo-achs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
      .mo-a{display:flex;gap:10px;align-items:center;padding:9px 10px;border-radius:10px;border:1px solid var(--line);font-size:12.5px}
      .mo-a .i{font-size:20px}.mo-a small{display:block;color:var(--muted);font-size:11px}
      .mo-a.locked{opacity:.45;filter:grayscale(1)}
    `;
    document.head.appendChild(st);
  }

  Cadence.registerPlugin({
    id: 'momentum', name: 'Momentum', version: '1.0.0', settings: () => window.__momentum.openStats && window.__momentum.openStats(), icon: '<path d="M12 21v-9"/><path d="M12 12c0-4 3-7 8-7 0 5-3 7-8 7z"/><path d="M12 14.5c0-3-2-5-6-5 0 3 2 5 6 5z"/>', color: '#30a46c', category: 'Fun', tagline: 'XP, streaks & a growing garden',
    description: 'Gamified progress: XP, combos, crits and streaks, Borderlands-style damage numbers, achievements, and an ever-growing garden — every task you finish plants something.',
    setup(api) {
      const S = () => Object.assign({ xp: 0, streak: 0, best: 0, lastDay: null, ach: {}, sound: true, log: [], awarded: {}, crits: 0, loot: 0 }, api.storage.get('state') || {});
      const put = st => api.storage.set('state', st);
      const today = () => api.util.todayKey();
      const dayOf = t => api.util.ymd(new Date(t));
      const yesterday = () => api.util.ymd(api.util.addDays(new Date(), -1));
      // level curve: each level needs a bit more
      const need = L => Math.round(80 * Math.pow(L, 1.35));
      function levelOf(xp) { let L = 1, acc = 0; while (xp >= acc + need(L)) { acc += need(L); L++; } return { L, into: xp - acc, need: need(L), pct: (xp - acc) / need(L) }; }
      const todayXp = st => st.log.filter(e => dayOf(e[0]) === today()).reduce((a, e) => a + e[1], 0);
      const todayCount = st => st.log.filter(e => dayOf(e[0]) === today() && e[1] > 0).length;

      /* ---------------- sound (soft, optional) */
      let AC;
      function chime(kind) {
        if (!S().sound) return;
        try {
          AC = AC || new (window.AudioContext || window.webkitAudioContext)();
          const t = AC.currentTime, notes = kind === 'level' ? [523, 659, 784, 1046] : kind === 'crit' ? [880, 1320] : kind === 'ach' ? [784, 988, 1175] : [988];
          notes.forEach((f, i) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = kind === 'crit' ? 'square' : 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + i * 0.07); g.gain.exponentialRampToValueAtTime(kind === 'crit' ? 0.05 : 0.08, t + i * 0.07 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.25); o.connect(g).connect(AC.destination); o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.3); });
        } catch (e) {}
      }

      /* ---------------- damage numbers */
      function originFor(task) {
        const p = api.ui.pointer();
        if (Date.now() - p.t < 1200) return { x: p.x, y: p.y };
        const el = document.querySelector(`.task[data-id="${task.id}"]`);
        if (el) { const r = el.getBoundingClientRect(); return { x: r.left + 26, y: r.top + r.height / 2 }; }
        return { x: innerWidth / 2, y: innerHeight / 2 };
      }
      function pop(x, y, text, { size = 34, color = '#ffd166', label = '', delay = 0, vx = null, life = 1.1 } = {}) { if (api.ui.reducedMotion && api.ui.reducedMotion()) { return; }
        setTimeout(() => {
          const el = document.createElement('div'); el.className = 'mo-num';
          el.style.setProperty('--g', color); el.style.fontSize = size + 'px'; el.style.color = '#fff';
          const layer = (t, cls = '') => `<span class="w ${cls}"><span class="o">${t}</span><span class="f">${t}</span></span>`;
          el.innerHTML = (label ? layer(label, 'lbw') : '') + layer(text);
          G.layer.appendChild(el);
          const w = el.offsetWidth, h = el.offsetHeight;
          let px = x - w / 2, py = y - h, vX = vx ?? (Math.random() * 3 - 1.5), vY = -(6 + Math.random() * 3), t = 0, rot = (Math.random() * 14 - 7);
          const tick = () => {
            t += 1 / 60; vY += 0.32; px += vX; py += vY; vX *= 0.98;
            const s = t < 0.09 ? 0.3 + (t / 0.09) * 1.25 : t < 0.22 ? 1.55 - ((t - 0.09) / 0.13) * 0.55 : 1;
            const jx = t < 0.25 ? (Math.random() - 0.5) * 5 : 0, jy = t < 0.25 ? (Math.random() - 0.5) * 5 : 0;
            const a = t > life - 0.35 ? Math.max(0, (life - t) / 0.35) : 1;
            el.style.transform = `translate(${px + jx}px,${py + jy}px) rotate(${rot * (1 - t)}deg) scale(${s})`; el.style.opacity = a;
            if (t < life) requestAnimationFrame(tick); else el.remove();
          };
          tick();
        }, delay);
      }
      function sparks(x, y, color, n = 10) { if (api.ui.reducedMotion && api.ui.reducedMotion()) { return; }
        for (let i = 0; i < n; i++) {
          const el = document.createElement('div'); el.className = 'mo-spark'; el.style.setProperty('--g', color);
          G.layer.appendChild(el);
          const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 5; let px = x, py = y, vx = Math.cos(a) * v, vy = Math.sin(a) * v - 2, t = 0, s = 0.6 + Math.random() * 1.2, r = Math.random() * 360;
          const tick = () => { t += 1 / 60; vy += 0.18; px += vx; py += vy; vx *= 0.96; r += 9; el.style.transform = `translate(${px - 4}px,${py - 4}px) rotate(${r}deg) scale(${s * (1 - t / 0.7)})`; el.style.opacity = 1 - t / 0.7; if (t < 0.7) requestAnimationFrame(tick); else el.remove(); };
          tick();
        }
      }
      function orb(x, y, color, done) { if (api.ui.reducedMotion && api.ui.reducedMotion()) { if (typeof done === "function") done(); return; }
        const card = document.querySelector('[data-sw="momentum"] .mo-rings');
        if (!card) { done && done(); return; }
        const r = card.getBoundingClientRect(), tx = r.left + r.width * 0.5, ty = r.top + r.height * 0.5;
        const el = document.createElement('div'); el.className = 'mo-orb'; el.style.setProperty('--g', color); G.layer.appendChild(el);
        const cx = (x + tx) / 2 + (Math.random() * 160 - 80), cy = Math.min(y, ty) - 120 - Math.random() * 80; let t = 0;
        const tick = () => { t += 1 / 38; const k = t * t * (3 - 2 * t), u = 1 - k; const px = u * u * x + 2 * u * k * cx + k * k * tx, py = u * u * y + 2 * u * k * cy + k * k * ty; el.style.transform = `translate(${px}px,${py}px) scale(${1 + Math.sin(t * Math.PI) * 0.8})`; if (t < 1) requestAnimationFrame(tick); else { el.remove(); done && done(); } };
        tick();
      }

      /* ---------------- awarding */
      let combo = G.combo || { n: 0, until: 0 }; G.combo = combo;
      api.on('task:complete', task => {
        const st = S(); if (st.awarded[task.id]) return;
        const t = today(), o = originFor(task), now = Date.now();
        combo.n = now < combo.until ? combo.n + 1 : 1; combo.until = now + 25000;
        const mult = Math.min(3, 1 + 0.25 * (combo.n - 1));
        let base = 10 + 6 * (task.priority || 0); const parts = [];
        const loot = task.owner === 'client';
        const crit = !loot && task.dueDate && task.dueDate < t;
        if (loot) { base += 8; }
        else if (task.dueDate === t) { base += 5; parts.push(['ON TIME', 5, '#7cf7d4']); }
        else if (task.dueDate && task.dueDate > t) { base += 3; parts.push(['EARLY', 3, '#5cc8ff']); }
        if (task.meetingId) { base += 3; }
        const total = Math.round(base * (crit ? 2 : 1) * mult);
        // numbers
        const color = crit ? '#ff8a3d' : loot ? '#b28cff' : '#ffd166';
        pop(o.x, o.y, '+' + total, { size: crit ? 54 : 38, color, label: crit ? 'CRITICAL!' : loot ? 'LOOT' : '' });
        if (combo.n > 1) pop(o.x + 40, o.y - 10, `x${mult.toFixed(2).replace(/\.?0+$/, '')}`, { size: 24, color: '#ff4fa3', label: `${combo.n} COMBO`, delay: 140, vx: 2.2 });
        parts.forEach((p, i) => pop(o.x - 30, o.y + 6, p[0], { size: 18, color: p[2], delay: 220 + i * 120, vx: -2 }));
        sparks(o.x, o.y, color, crit ? 22 : 12);
        chime(crit ? 'crit' : 'xp');
        // state
        const before = levelOf(st.xp);
        st.xp += total; st.awarded[task.id] = total;
        const keys = Object.keys(st.awarded); if (keys.length > 400) keys.slice(0, keys.length - 400).forEach(k => delete st.awarded[k]);
        st.log.push([now, total, task.clientId || null]); if (st.log.length > 3000) st.log.splice(0, st.log.length - 3000);
        let streakUp = 0;
        if (st.lastDay !== t) { st.streak = st.lastDay === yesterday() ? st.streak + 1 : 1; st.lastDay = t; st.best = Math.max(st.best, st.streak); if (st.streak > 1) streakUp = st.streak; }
        const goalHit = todayCount(st) === (st.goal || 5);
        seedGarden(st); plantFor(st, crit ? 'sun' : loot ? 'berry' : 'flower', task.clientId);
        if (crit) st.crits = (st.crits || 0) + 1;
        if (loot) st.loot = (st.loot || 0) + 1;
        const after = levelOf(st.xp);
        for (let L = before.L + 1; L <= after.L; L++) plantFor(st, 'tree');
        const newAch = checkAchievements(st, { combo: combo.n });
        put(st);
        orb(o.x, o.y, color, () => {
          refresh(true, { kind: loot ? 'loot' : 'xp', task });
          if (after.L > before.L) levelUp(after.L);
          if (goalHit) api.island.celebrate({ eyebrow: 'Daily goal', icon: '🎯', color: '#3fc37a', title: `${st.goal || 5} tasks done today`, sub: 'Everything else is a bonus', right: '✓' });
          if (streakUp && !newAch.some(a => a.id.startsWith('streak'))) api.island.show({ icon: '🔥', color: '#ff7a1a', title: `${streakUp}-day streak`, sub: streakUp >= st.best ? 'Your best yet' : `Best: ${st.best} days` });
          newAch.forEach(a => achievement(a));
        });
      });
      api.on('task:reopen', task => {
        const st = S(), amt = st.awarded[task.id]; if (!amt) return;
        st.xp = Math.max(0, st.xp - amt); delete st.awarded[task.id];
        const i = st.log.findIndex(e => e[1] === amt && Date.now() - e[0] < 864e5); if (i > -1) st.log.splice(i, 1);
        if (st.garden) { for (let i = st.garden.length - 1; i >= 0; i--) if (st.garden[i].k !== 'tree' && Date.now() - st.garden[i].t < 864e5) { st.garden.splice(i, 1); break; } }
        put(st); const o = originFor(task); pop(o.x, o.y, '-' + amt, { size: 26, color: '#8a877f' }); refresh();
      });

      /* ---------------- achievements */
      const ACH = [
        ['first', '🎯', 'First blood', 'Complete your first task', (st) => st.log.length >= 1],
        ['day5', '🔥', 'On a roll', '5 tasks in one day', (st) => todayCount(st) >= 5],
        ['day10', '⚡', 'Unstoppable', '10 tasks in one day', (st) => todayCount(st) >= 10],
        ['combo5', '🌀', 'Combo king', 'Hit a 5x combo', (st, c) => c.combo >= 5],
        ['crit10', '🗡️', 'Overdue slayer', 'Finish 10 overdue tasks', (st) => (st.crits || 0) >= 10],
        ['loot10', '💎', 'Collector', 'Close 10 client items', (st) => (st.loot || 0) >= 10],
        ['streak3', '📅', 'Habit forming', '3-day streak', (st) => st.streak >= 3],
        ['streak7', '🗓️', 'Week warrior', '7-day streak', (st) => st.streak >= 7],
        ['streak30', '🏔️', 'Iron will', '30-day streak', (st) => st.streak >= 30],
        ['lvl5', '⭐', 'Rising star', 'Reach level 5', (st) => levelOf(st.xp).L >= 5],
        ['lvl10', '🌟', 'Veteran', 'Reach level 10', (st) => levelOf(st.xp).L >= 10],
        ['clean', '🧹', 'Clean slate', 'Nothing overdue or due today left', () => api.tasks.list(x => !x.done && x.owner === 'me' && x.dueDate && x.dueDate <= today()).length === 0],
        ['inbox0', '📭', 'Inbox zero', 'Empty the Inbox', () => api.tasks.list(x => !x.done && !x.clientId).length === 0],
        ['xp1k', '🏆', 'Thousandaire', 'Earn 1,000 XP', (st) => st.xp >= 1000],
        ['xp10k', '👑', 'Legend', 'Earn 10,000 XP', (st) => st.xp >= 10000],
      ];
      function checkAchievements(st, ctx) {
        const got = [];
        for (const [id, icon, name, desc, test] of ACH) if (!st.ach[id]) { try { if (test(st, ctx)) { st.ach[id] = Date.now(); st.xp += 50; got.push({ id, icon, name, desc }); } } catch (e) {} }
        return got;
      }
      function achievement(a) {
        chime('ach');
        const w = document.querySelector('[data-sw="momentum"] .mo-rings'); if (w) { const r = w.getBoundingClientRect(); sparks(r.left + r.width / 2, r.top + r.height / 2, '#ffd166', 14); }
        api.island.celebrate({ eyebrow: 'Achievement unlocked', icon: a.icon, color: '#ffb020', title: a.name, sub: a.desc, right: '+50 XP', onClick: () => openStats() });
        refresh();
      }
      function levelUp(L) {
        chime('level');
        const w = document.querySelector('[data-sw="momentum"] .mo-rings'); if (w) { const r = w.getBoundingClientRect(); for (let i = 0; i < 3; i++) setTimeout(() => sparks(r.left + r.width / 2, r.top + r.height / 2, ['#ffd166', '#7cf7d4', '#ff4fa3'][i], 16), i * 140); }
        api.island.celebrate({ eyebrow: 'Level up', icon: '🌳', color: '#7cf7d4', title: `Level ${L}`, sub: 'A new tree is growing in your garden', right: 'LV ' + L, onClick: () => openStats() });
      }

      /* ---------------- the garden: every completed task plants something; it grows forever */
      const rnd = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      function idleDays(st) { if (!st.lastDay) return 0; return Math.round((new Date(today().replace(/-/g, '/')) - new Date(st.lastDay.replace(/-/g, '/'))) / 864e5); }
      function seedGarden(st) {
        // first run after the update: plant everything already earned
        if (st.garden) return st.garden;
        const R = rnd(4242); st.garden = [];
        st.log.forEach(e => { if (e[1] > 0) st.garden.push({ k: e[1] >= 30 ? 'sun' : 'flower', c: e[2] || null, x: R(), d: R(), t: e[0] }); });
        for (let L = 2; L <= levelOf(st.xp).L; L++) st.garden.push({ k: 'tree', x: R(), d: R() * 0.5, t: Date.now() });
        return st.garden;
      }
      function plantFor(st, kind, cid) { const R = Math.random; (st.garden = st.garden || []).push({ k: kind, c: cid || null, x: R(), d: R(), t: Date.now() }); if (st.garden.length > 600) st.garden.splice(0, st.garden.length - 600); }
      const PETALS = ['#ff7a8a', '#ffd166', '#b28cff', '#ff9f43', '#5cc8ff', '#ff6fb5', '#7cf7d4'];
      function garden(st) {
        const items = seedGarden(st), n = items.length, cl = Object.fromEntries(api.clients.list().map(c => [c.id, c.color]));
        // the camera pulls back as the garden fills up
        const W = 240 * (1 + Math.sqrt(Math.max(0, n - 12)) / 6), H = W * 86 / 240, ps = Math.pow(W / 240, 0.65), ground = H * 0.62, now = Date.now();
        const days = idleDays(st), R0 = rnd(77);
        let back = '', mid = '';
        // background grass tufts
        for (let i = 0; i < Math.round(W / 9); i++) { const x = R0() * W, y = ground + R0() * (H - ground) * 0.9; back += `<path d="M${x} ${y} l-2 -5 M${x} ${y} l0 -6 M${x} ${y} l2 -5" stroke="#5fae5f" stroke-width="1" opacity=".55"/>`; }
        const sorted = items.map((it, i) => ({ ...it, i })).sort((a, b) => a.d - b.d);
        for (const it of sorted) {
          const x = 8 + it.x * (W - 16), y = ground + 4 + it.d * (H - ground - 8), s = (0.7 + it.d * 0.6) * ps, age = Math.min(1, (now - it.t) / (3 * 864e5));
          const fresh = now - it.t < 4000 ? ' class="mo-grow"' : '';
          const g = `transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(s * (0.75 + age * 0.35)).toFixed(2)})"`;
          if (it.k === 'tree') mid += `<g ${g}><g${fresh}><rect x="-1.6" y="-26" width="3.2" height="26" rx="1" fill="#8a5a3c"/><circle cy="-30" r="11" fill="#3e9a5a"/><circle cx="-7" cy="-24" r="7.5" fill="#46a865"/><circle cx="7" cy="-25" r="8" fill="#348c50"/><circle cx="3" cy="-34" r="5" fill="#5bbd78" opacity=".8"/></g></g>`;
          else if (it.k === 'sun') mid += `<g ${g}><g${fresh} class="mo-sway"><path d="M0 0 V-20" stroke="#4a9a4a" stroke-width="1.6"/><path d="M0 -9 q-6 -3 -8 1 q5 1 8 -1" fill="#5aae5a"/>${[...Array(10)].map((_, k) => `<ellipse rx="1.8" ry="4" transform="translate(0 -22) rotate(${k * 36}) translate(0 -4)" fill="#ffc83d"/>`).join('')}<circle cy="-22" r="3.2" fill="#7a4b22"/></g></g>`;
          else if (it.k === 'berry') mid += `<g ${g}><g${fresh}><circle cy="-5" r="6" fill="#3f8f55"/><circle cx="-4" cy="-7" r="4.5" fill="#4aa063"/>${[[-3, -6], [2, -8], [4, -3], [-1, -2]].map(([a, b]) => `<circle cx="${a}" cy="${b}" r="1.4" fill="#b28cff"/>`).join('')}</g></g>`;
          else { const col = cl[it.c] || PETALS[it.i % PETALS.length], h = 9 + (it.i % 4) * 2; mid += `<g ${g}><g${fresh} class="mo-sway" style="animation-delay:-${(it.i % 7) * 0.6}s"><path d="M0 0 V-${h}" stroke="#4a9a4a" stroke-width="1.2"/><path d="M0 -${h * 0.45} q4 -3 6 0 q-3 2 -6 0" fill="#5aae5a"/>${[0, 72, 144, 216, 288].map(a => `<ellipse rx="1.7" ry="2.8" transform="translate(0 -${h}) rotate(${a}) translate(0 -2.4)" fill="${col}"/>`).join('')}<circle cy="-${h}" r="1.4" fill="#fff4c2"/></g></g>`; }
        }
        // weeds creep in after a couple of idle days
        let weeds = ''; if (days >= 2) { const Rw = rnd(days * 31); for (let i = 0; i < Math.min(14, days * 3); i++) { const x = Rw() * W, y = ground + Rw() * (H - ground); weeds += `<path d="M${x} ${y} q-3 -6 -1 -10 M${x} ${y} q3 -5 2 -9 M${x} ${y} q0 -4 -4 -6" stroke="#8b7d4a" stroke-width="1.2" fill="none"/>`; } }
        // butterflies for your streak
        let bugs = ''; for (let i = 0; i < Math.min(6, st.lastDay === today() ? st.streak : 0); i++) { const c = PETALS[(i * 3) % PETALS.length], bx = W * (0.15 + i * 0.14), by = ground - 14 - (i % 3) * 8; bugs += `<g class="mo-fly" style="animation-delay:-${i * 1.3}s;transform-origin:${bx}px ${by}px"><g transform="translate(${bx} ${by}) scale(${W / 240})"><ellipse cx="-2.2" cy="0" rx="2.4" ry="1.7" fill="${c}"/><ellipse cx="2.2" cy="0" rx="2.4" ry="1.7" fill="${c}"/><rect x="-.4" y="-1.5" width=".8" height="3" fill="#333"/></g></g>`; }
        const sunR = 9 * W / 240;
        return `<svg viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" preserveAspectRatio="xMidYMax slice">
          <defs><linearGradient id="mo-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${days >= 2 ? '#c9c4b8' : '#bfe3ff'}"/><stop offset="1" stop-color="${days >= 2 ? '#e8e2d2' : '#eef8ff'}"/></linearGradient></defs>
          <rect width="100%" height="100%" fill="url(#mo-sky)"/>
          <circle cx="${W - sunR * 3}" cy="${sunR * 2.4}" r="${sunR}" fill="#ffd166" opacity="${days >= 2 ? .45 : 1}"/>
          <g class="mo-cloud" opacity=".8"><ellipse cx="${W * 0.15}" cy="${H * 0.18}" rx="${16 * W / 240}" ry="${5 * W / 240}" fill="#fff"/></g>
          <path d="M0 ${ground - H * 0.08} Q ${W * 0.25} ${ground - H * 0.2} ${W * 0.5} ${ground - H * 0.07} T ${W} ${ground - H * 0.1} V ${H} H 0Z" fill="#a8d89a" opacity=".6"/>
          <rect y="${ground}" width="100%" height="${H - ground}" fill="#8cc97a"/><rect y="${ground}" width="100%" height="2" fill="#7bbb6a"/>
          ${back}${weeds}${mid}${bugs}
          ${n === 0 ? `<text x="${W / 2}" y="${ground + (H - ground) / 2 + 3}" text-anchor="middle" font-size="8" fill="#2f6b34" font-family="ui-sans-serif" opacity=".8">finish a task to plant your first flower</text>` : ''}
        </svg>`;
      }

      /* ---------------- widget */
      let widgetEl = null, shown = null;
      const isOpen = () => { try { return localStorage.getItem('cadence.mo.open') === '1'; } catch (e) { return false; } };
      api.sidebar.add({ id: 'momentum', slot: 'top', order: 10, render: (el) => {
        widgetEl = el; shown = null;
        el.innerHTML = `<div class="mo-strip ${isOpen() ? 'open' : ''}">
          <div class="mo-head" title="Momentum — click to expand">
            <svg class="mo-rings" viewBox="0 0 30 30"><defs><linearGradient id="mo-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a8a"/><stop offset="1" stop-color="#b06bd6"/></linearGradient></defs>
              <circle class="bg" cx="15" cy="15" r="12.5" stroke-width="4"/><circle class="xp" cx="15" cy="15" r="12.5" stroke-width="4" stroke="url(#mo-g)" stroke-dasharray="78.54" stroke-dashoffset="78.54"/>
              <circle class="bg" cx="15" cy="15" r="7" stroke-width="3.6"/><circle class="day" cx="15" cy="15" r="7" stroke-width="3.6" stroke="#3fc37a" stroke-dasharray="43.98" stroke-dashoffset="43.98"/></svg>
            <div class="mo-txt"><b class="lv"></b><span class="xpt"></span></div>
            <span class="mo-streak"></span><span class="mo-chev">›</span>
          </div>
          <div class="mo-body"><div><div class="mo-world"></div><div class="mo-sub"><span class="td"></span><span class="mo-statslink" role="button">Stats ›</span></div></div></div>
        </div>`;
        const strip = el.querySelector('.mo-strip');
        el.querySelector('.mo-head').addEventListener('click', () => { strip.classList.toggle('open'); try { localStorage.setItem('cadence.mo.open', strip.classList.contains('open') ? '1' : '0'); } catch (e) {} });
        el.querySelector('.mo-statslink').addEventListener('click', e => { e.stopPropagation(); openStats(); });
        refresh();
      }});
      function countUp(node, from, to, suffix) {
        const t0 = performance.now(), dur = 700;
        const tick = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); node.textContent = Math.round(from + (to - from) * e).toLocaleString() + suffix; if (k < 1) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      }
      function refresh(animate) {
        if (!widgetEl || !widgetEl.isConnected) return;
        const st = S(), lv = levelOf(st.xp), w = widgetEl, goal = st.goal || 5, done = todayCount(st);
        w.querySelector('.mo-world').innerHTML = garden(st);
        w.querySelector('.lv').textContent = 'Level ' + lv.L;
        const xpt = w.querySelector('.xpt'), suffix = ` / ${lv.need.toLocaleString()} XP`;
        if (animate && shown && shown.L === lv.L) countUp(xpt, shown.into, lv.into, suffix); else xpt.textContent = lv.into.toLocaleString() + suffix;
        w.querySelector('.mo-rings .xp').style.strokeDashoffset = (78.54 * (1 - lv.pct)).toFixed(2);
        w.querySelector('.mo-rings .day').style.strokeDashoffset = (43.98 * (1 - Math.min(1, done / goal))).toFixed(2);
        const sk = w.querySelector('.mo-streak'); sk.textContent = '🔥 ' + st.streak; sk.classList.toggle('cold', st.lastDay !== today()); sk.title = `${st.streak}-day streak · best ${st.best}`;
        w.querySelector('.mo-head').title = `Level ${lv.L} · ${lv.into}/${lv.need} XP · today ${done}/${goal} tasks — click to ${w.querySelector('.mo-strip').classList.contains('open') ? 'collapse' : 'expand'}`;
        const plants = (st.garden || []).length, trees = (st.garden || []).filter(g => g.k === 'tree').length;
        w.querySelector('.td').textContent = `${plants} plant${plants === 1 ? '' : 's'}${trees ? ` · ${trees} tree${trees === 1 ? '' : 's'}` : ''} · ${done}/${goal} today`;
        if (animate) {
          const h = w.querySelector('.mo-head'); h.classList.remove('bump'); void h.offsetWidth; h.classList.add('bump');
        }
        shown = lv;
      }
      api.on('client:update', () => refresh());

      /* ---------------- stats modal */
      G.openStats = () => openStats();
      function openStats() {
        const st = S(), lv = levelOf(st.xp), E = api.ui.esc;
        const days = [...Array(7)].map((_, i) => { const d = api.util.ymd(api.util.addDays(new Date(), i - 6)); return { d, xp: st.log.filter(e => dayOf(e[0]) === d).reduce((a, e) => a + e[1], 0) }; });
        const max = Math.max(30, ...days.map(d => d.xp));
        const byClient = {}; st.log.forEach(e => { if (e[2]) byClient[e[2]] = (byClient[e[2]] || 0) + e[1]; });
        const top = Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, xp]) => ({ c: api.clients.get(id), xp })).filter(x => x.c);
        api.ui.modal('✦ Momentum', `
          <div class="mo-modal-grid">
            <div class="mo-tile"><div class="v">${lv.L}</div><div class="l">Level · ${lv.into}/${lv.need} XP</div></div>
            <div class="mo-tile"><div class="v">${st.xp.toLocaleString()}</div><div class="l">Total XP</div></div>
            <div class="mo-tile"><div class="v">🔥 ${st.streak}</div><div class="l">Day streak · best ${st.best}</div></div>
            <div class="mo-tile"><div class="v">${todayXp(st)}</div><div class="l">XP today · ${todayCount(st)} done</div></div>
          </div>
          <div class="field"><label>Last 7 days</label><div class="mo-bars">${days.map((d, i) => `<div class="${i === 6 ? 'today' : ''}"><span>${d.xp || ''}</span><i style="height:${Math.round(d.xp / max * 80)}px"></i>${new Date(d.d.replace(/-/g, '/')).toLocaleDateString(undefined, { weekday: 'short' })}</div>`).join('')}</div></div>
          ${top.length ? `<div class="field"><label>Where your XP comes from</label>${top.map(t => `<div style="display:flex;align-items:center;gap:10px;padding:5px 0">${api.ui.avatar(t.c, 20)}<span style="flex:1">${E(t.c.name)}</span><b style="font-variant-numeric:tabular-nums">${t.xp.toLocaleString()} XP</b></div>`).join('')}</div>` : ''}
          <div class="field"><label>Achievements · ${Object.keys(st.ach).length}/${ACH.length}</label><div class="mo-achs">${ACH.map(([id, icon, name, desc]) => `<div class="mo-a ${st.ach[id] ? '' : 'locked'}"><span class="i">${icon}</span><div><b>${E(name)}</b><small>${E(desc)}</small></div></div>`).join('')}</div></div>
          <div class="row" style="gap:16px;align-items:flex-end;flex-wrap:wrap">
            <div class="field"><label>Your garden</label><div style="font-size:13px">${(() => { const g = seedGarden(st), c = k => g.filter(x => x.k === k).length; return `🌸 ${c('flower')} flowers · 🌻 ${c('sun')} sunflowers · 🫐 ${c('berry')} berry bushes · 🌳 ${c('tree')} trees`; })()}</div></div>
            <div class="field"><label>Daily goal</label><div class="seg" id="mo-goal">${[3, 5, 8, 12].map(n => `<button data-g="${n}" class="${(st.goal || 5) === n ? 'on' : ''}">${n}</button>`).join('')}</div></div>
            <div class="field"><label>Sound</label><div class="seg" id="mo-sound"><button data-s="1" class="${st.sound ? 'on' : ''}">On</button><button data-s="0" class="${st.sound ? '' : 'on'}">Off</button></div></div>
          </div>
          <div class="muted" style="font-size:12px">Rings: outer = progress to the next level, inner = today’s tasks vs your daily goal. Garden: every task plants a flower in the client’s colour, overdue ones a sunflower, client items a berry bush, each level a tree; your streak brings butterflies, and a couple of idle days lets weeds in. XP: 10 per task, +6 per priority level, +5 on time, ×2 <b>crit</b> for overdue tasks, +8 for closing a client item, combos up to ×3 when you finish tasks within 25 s of each other. Achievements give +50.</div>`,
          `<button class="btn ghost danger" id="mo-reset" style="margin-right:auto">Reset progress</button><button class="btn primary" data-act="close-modal">Nice</button>`, 'wide');
        document.querySelectorAll('#mo-goal button').forEach(b => b.onclick = () => { const s = S(); s.goal = +b.dataset.g; put(s); refresh(); openStats(); });
        document.querySelectorAll('#mo-sound button').forEach(b => b.onclick = () => { const s = S(); s.sound = b.dataset.s === '1'; put(s); openStats(); });
        document.querySelector('#mo-reset').onclick = () => { if (document.querySelector('#mo-reset').dataset.sure) { put({}); refresh(); api.ui.close(); api.ui.toast('Progress reset'); } else { document.querySelector('#mo-reset').dataset.sure = 1; document.querySelector('#mo-reset').textContent = 'Click again to reset'; } };
      }
      api.commands.add({ title: 'Momentum stats', run: () => openStats() });
      api.onSettings(() => openStats());
      // keep "watered today / streak" fresh across midnight
      clearInterval(G.tick); G.tick = setInterval(() => refresh(), 5 * 60 * 1000);
    }
  });
})();
