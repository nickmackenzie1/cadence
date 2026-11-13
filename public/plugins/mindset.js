/* Mindset tools:
   - Procrastination forecaster: a weather-style "chance this actually happens" on tasks you've been avoiding.
   - Done-list mode: on a bad day, Today shows only what you've already done.
   - Future-you negotiator: pushing a task back asks for a note to future you; future you can reject the excuse.
   - Regret minimizer: once a month, "which of these would you regret not doing at 80?" and those get promoted. */
(() => {
  const esc = window.CadenceKit.esc;
  const css = window.CadenceKit.css;
  const DAY = 864e5;
  // shared: how many times each task has been pushed back (kept by the negotiator, read by the forecaster)
  const MOVES = () => { try { return JSON.parse(localStorage.getItem('cadence.moves') || '{}'); } catch (e) { return {}; } };
  const addMove = id => { const m = MOVES(); m[id] = (m[id] || 0) + 1; const ks = Object.keys(m); if (ks.length > 500) delete m[ks[0]]; try { localStorage.setItem('cadence.moves', JSON.stringify(m)); } catch (e) {} };

  /* ======================= Procrastination forecaster ======================= */
  Cadence.registerPlugin({
    id: 'forecast', name: 'Procrastination forecaster', version: '1.0.0', category: 'Insights', spaces: ['work', 'life'],
    description: 'Learns which tasks you avoid (age, how often you push them back, words you tend to dodge) and shows a weather-style chance it actually happens this week.',
    tagline: '30% chance of actually happening', color: '#0284c7',
    icon: '<path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.947 12.65a4 4 0 0 0-5.925-4.128"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>',
    setup(api) {
      let words = null, wordsAt = 0;
      const toks = s => String(s || '').toLowerCase().match(/[a-z]{4,}/g) || [];
      function learn() {   // words in tasks you finish quickly vs. tasks that sat for weeks
        if (words && Date.now() - wordsAt < 10 * 60e3) return words; const w = {};
        for (const t of api.tasks.list(x => x.createdAt)) { const slow = t.done ? (t.doneAt - t.createdAt) / DAY > 10 : (Date.now() - t.createdAt) / DAY > 14, fast = t.done && (t.doneAt - t.createdAt) / DAY < 2;
          if (!slow && !fast) continue; for (const k of new Set(toks(t.title))) { w[k] = w[k] || [0, 0]; w[k][slow ? 0 : 1]++; } }
        words = w; wordsAt = Date.now(); return w;
      }
      function chance(t) {
        if (t.done) return null; const age = (Date.now() - (t.createdAt || Date.now())) / DAY, moves = MOVES()[t.id] || 0, t0 = api.util.todayKey();
        let p = .85 - Math.min(.35, age / 60) - moves * .12;
        if (t.dueDate && t.dueDate < t0) p -= Math.min(.25, (new Date(t0) - new Date(t.dueDate)) / DAY * .03);
        if (!t.dueDate) p -= .08; if (t.priority) p += .08 * t.priority; if (t.stage === 'doing') p += .15; if (t.owner === 'client') return null;
        const w = learn(); for (const k of toks(t.title)) { const s = w[k]; if (s && s[0] + s[1] >= 3) p += (s[1] - s[0]) / (s[0] + s[1]) * .08; }
        return Math.max(.05, Math.min(.95, p));
      }
      const icon = p => p >= .7 ? 'sun' : p >= .4 ? 'cloud-sun' : 'cloud-rain';
      window.__forecast = { chance };
      api.chips.add((t, preview) => { if (preview || t.done) return ''; const age = (Date.now() - (t.createdAt || Date.now())) / DAY, moves = MOVES()[t.id] || 0; if (age < 3 && !moves) return '';
        const p = chance(t); if (p == null || p >= .7) return ''; return `<span class="chip fc-chip ${p < .4 ? 'rain' : ''}" title="Chance this actually happens this week (from its age, ${moves} push${moves === 1 ? '' : 'es'} back, and what you usually avoid)">${api.ui.icon(icon(p))}${Math.round(p * 100)}%</span>`; });
      api.widgets.add({ id: 'forecast', title: 'Procrastination forecast', icon: 'cloud-rain', size: 'm', description: 'The tasks least likely to happen this week.', render: el => {
        const list = api.tasks.list(t => !t.done && t.owner !== 'client').map(t => ({ t, p: chance(t) })).filter(x => x.p != null).sort((a, b) => a.p - b.p).slice(0, 5);
        el.innerHTML = `<div class="fc-w">${list.map(x => `<div>${api.ui.icon(icon(x.p))}<span>${esc(x.t.title)}</span><b>${Math.round(x.p * 100)}%</b></div>`).join('') || '<span class="muted">Clear skies.</span>'}</div>`; } });
      css('fc-css', `.fc-chip svg{width:12px;height:12px;margin-right:3px}.fc-chip{color:#0284c7}.fc-chip.rain{color:#64748b}
        .fc-w>div{display:flex;align-items:center;gap:8px;padding:5px 0;font-size:13px;border-bottom:1px solid var(--line)}.fc-w svg{width:16px;height:16px;color:#0284c7;flex:none}.fc-w span{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`);
    },
  });

  /* ======================= Done-list mode ======================= */
  Cadence.registerPlugin({
    id: 'donelist', name: 'Done-list mode', version: '1.0.0', category: 'Wellbeing', spaces: ['work', 'life'],
    description: 'For bad days: Today shows only what you’ve already done, this week and all time. Proof you’re not failing. Turns itself off at midnight.',
    tagline: 'Only what you’ve done, for bad days', color: '#10b981',
    icon: '<path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/>',
    setup(api) {
      const on = () => { const v = localStorage.getItem('cadence.donelist'); return v && v === new Date().toDateString(); };
      const set = v => { v ? localStorage.setItem('cadence.donelist', new Date().toDateString()) : localStorage.removeItem('cadence.donelist'); live(); api.ui.navigate('today'); api.ui.refresh(); };
      const live = () => on() ? api.island.live('donelist', { prio: 3, view: () => ({ minW: 160, onClick: () => set(false), html: `<span class="isl-dot" style="background:#10b981"></span><span class="isl-t"><b>Done-list mode</b></span>` }) }) : api.island.clear('donelist');
      api.on('render', e => {
        if (!on() || !e || e.route !== 'today') return; const v = document.getElementById('view'); if (!v || v.querySelector('.dl')) return;
        const t0 = new Date().setHours(0, 0, 0, 0), wk = t0 - ((new Date().getDay() + 6) % 7) * DAY, done = api.tasks.list(t => t.done && t.doneAt).sort((a, b) => b.doneAt - a.doneAt);
        const today = done.filter(t => t.doneAt >= t0), week = done.filter(t => t.doneAt >= wk && t.doneAt < t0);
        const row = t => { const c = t.clientId && api.clients.get(t.clientId); return `<div class="dl-it">${api.ui.icon('check')}<span>${esc(t.title)}</span>${c ? `<em>${esc(c.name)}</em>` : ''}</div>`; };
        v.innerHTML = `<div class="dl"><div class="head"><div><h1>Look what you’ve done</h1><div class="sub">Just for today, only the finished things. You can switch back any time.</div></div></div>
          <div class="dl-big"><div><b>${today.length}</b><span>today</span></div><div><b>${week.length + today.length}</b><span>this week</span></div><div><b>${done.length}</b><span>all time</span></div></div>
          ${today.length ? `<div class="sect">Today</div>${today.map(row).join('')}` : '<div class="dl-soft">Nothing yet today, and that’s okay. Getting through a hard day counts.</div>'}
          ${week.length ? `<div class="sect">Earlier this week</div>${week.slice(0, 40).map(row).join('')}` : ''}
          <button class="btn" id="dl-off" style="margin-top:20px">Show my list again</button></div>`;
        v.querySelector('#dl-off').onclick = () => set(false);
      });
      window.__donelist = { set, on };
      api.commands.add({ title: 'Bad day: show only what I’ve done', hint: 'Done-list mode', run: () => set(!on()) });
      live();
      css('dl-css', `.dl-big{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:8px 0 18px}.dl-big div{border:1px solid var(--line);border-radius:var(--r-l);padding:16px;background:color-mix(in srgb,#10b981 7%,var(--panel))}
        .dl-big b{display:block;font:900 34px/1 ui-rounded,system-ui;color:#059669}.dl-big span{font-size:13px;color:var(--muted)}
        .dl-it{display:flex;align-items:center;gap:10px;padding:8px 2px;border-bottom:1px solid var(--line);font-size:14px}.dl-it svg{width:16px;height:16px;color:#10b981;flex:none}.dl-it span{flex:1}.dl-it em{font-style:normal;font-size:12px;color:var(--muted)}
        .dl-soft{padding:18px;border-radius:var(--r-l);background:var(--hover);font-size:14px;margin-bottom:10px}`);
    },
  });

  /* ======================= Future-you negotiator ======================= */
  Cadence.registerPlugin({
    id: 'future-you', name: 'Future-you negotiator', version: '1.0.0', category: 'Wellbeing', spaces: ['work', 'life'],
    description: 'Pushing a task to a later date asks for a quick note to future you. When it comes due, future you sees the excuse and can accept it or reject it.',
    tagline: 'Snoozing needs a note to future you', color: '#f43f5e',
    icon: '<path d="M12 6v6l4 2"/><path d="M16 21.16a10 10 0 1 1 5-8.16"/><path d="m22 16-3 3-3-3M19 19v-6"/>',
    setup(api) {
      const due = new Map(); const prime = () => { due.clear(); for (const t of api.tasks.list(x => !x.done)) due.set(t.id, t.dueDate); };
      prime(); api.on('sync', prime); api.on('space', prime); api.on('task:add', t => due.set(t.id, t.dueDate));
      const opt = () => Object.assign({ from: 2 }, api.storage.get('opt') || {});   // ask from the Nth push (default: the second time you push it)
      let asking = false;
      api.on('task:update', t => {
        const prev = due.get(t.id); due.set(t.id, t.dueDate);
        if (t.done || !prev || !t.dueDate || t.dueDate <= prev || asking || t._fyNote) return;
        addMove(t.id); const n = MOVES()[t.id] || 1; if (n < opt().from) return;
        asking = true;
        const strict = (t.excuses || []).some(x => x.rejected);
        api.ui.modal(strict ? 'Again?' : 'A note to future you', `<p style="margin:0 0 10px;font-size:13px">${strict ? `Future you already rejected an excuse for <b>${esc(t.title)}</b>. This is push number ${n}.` : `You’re pushing <b>${esc(t.title)}</b> from ${esc(api.util.fmtDate(prev))} to ${esc(api.util.fmtDate(t.dueDate))}${n > 1 ? ` (push number ${n})` : ''}. Why? Future you will read this.`}</p>
          <textarea class="inp" id="fy-n" rows="3" placeholder="Waiting on the API keys, honestly"></textarea>`,
          `<button class="btn" id="fy-undo" style="margin-right:auto">Never mind, keep ${esc(api.util.fmtDate(prev))}</button><button class="btn" id="fy-skip">Skip</button><button class="btn primary" id="fy-ok">Send to future me</button>`);
        const done = note => { asking = false; api.ui.close(); if (note) { const cur = api.tasks.get(t.id); api.tasks.update(t.id, { excuses: [...((cur && cur.excuses) || []), { at: Date.now(), note: note.slice(0, 280), from: prev, to: t.dueDate }] }); } };
        document.getElementById('fy-ok').onclick = () => done(document.getElementById('fy-n').value.trim());
        document.getElementById('fy-skip').onclick = () => done('');
        document.getElementById('fy-undo').onclick = () => { asking = false; api.ui.close(); due.set(t.id, prev); api.tasks.update(t.id, { dueDate: prev }); api.ui.toast('Kept the original date'); };
        setTimeout(() => document.getElementById('fy-n') && document.getElementById('fy-n').focus(), 50);
      });
      const pending = t => { const e = (t.excuses || []).slice(-1)[0]; return e && !e.judged && t.dueDate && t.dueDate <= api.util.todayKey() ? e : null; };
      api.chips.add((t, preview) => { if (preview || t.done) return ''; const e = pending(t); return e ? `<span class="chip fy-chip" title="Past you said: ${esc(e.note)}">${api.ui.icon('message-circle')}Past you left a note</span>` : ''; });
      api.taskCards.add(t => { const e = pending(t); if (!e) return '';
        setTimeout(() => document.querySelectorAll('[data-fy]').forEach(b => b.onclick = () => { const cur = api.tasks.get(t.id); const ex = (cur.excuses || []).map((x, i, a) => i === a.length - 1 ? { ...x, judged: true, rejected: b.dataset.fy === 'no' } : x);
          api.tasks.update(t.id, b.dataset.fy === 'no' ? { excuses: ex, priority: Math.max(1, cur.priority || 0) } : { excuses: ex }); api.ui.toast(b.dataset.fy === 'no' ? 'Excuse rejected. It’s top of the list now.' : 'Fair enough.'); }), 0);
        return `<div class="fy-card"><small>${esc(new Date(e.at).toLocaleDateString([], { month: 'short', day: 'numeric' }))}, past you wrote:</small><p>“${esc(e.note)}”</p><div><button class="btn" data-fy="ok">Fair, accept it</button><button class="btn" data-fy="no">Not good enough</button></div></div>`; });
      window.__futureYou = { prime };
      api.commands.add({ title: 'Future-you negotiator settings', run: () => api.ui.ask('Future-you negotiator', [{ k: 'n', label: 'Ask for a note to future you from', type: 'select', def: opt().from, opts: [[1, 'Every time I push a task back'], [2, 'The second push onwards'], [3, 'The third push onwards']] }]).then(v => { if (v) api.storage.set('opt', { from: +v.n }); }) });
      css('fy-css', `.fy-chip{color:#f43f5e}.fy-chip svg{width:12px;height:12px;margin-right:3px}
        .fy-card{border:1px solid color-mix(in srgb,#f43f5e 35%,var(--line));background:color-mix(in srgb,#f43f5e 6%,var(--panel));border-radius:var(--r-l);padding:10px 12px;margin-top:8px}
        .fy-card small{color:var(--muted);font-size:12px}.fy-card p{margin:4px 0 8px;font-size:14px;font-style:italic}.fy-card div{display:flex;gap:6px}`);
    },
  });

  /* ======================= Regret minimizer ======================= */
  Cadence.registerPlugin({
    id: 'regret', name: 'Regret minimizer', version: '1.0.0', category: 'Wellbeing', spaces: ['life', 'work'],
    description: 'Once a month: “which of these would you regret not doing at 80?” The ones you pick get quietly promoted.',
    tagline: 'What would 80-year-old you want?', color: '#d97706',
    icon: '<path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>',
    setup(api) {
      function ask() {
        const list = api.tasks.list(t => !t.done && t.owner !== 'client' && !(t.tags || []).includes('regret')).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).slice(0, 10);
        if (!list.length) return api.ui.toast('Nothing on your list to weigh up right now.');
        api.ui.modal('At 80, would you regret not doing…', `<p class="muted" style="margin:0 0 10px;font-size:13px">Pick the ones that really matter. They’ll move up your list. Leave the rest.</p>
          <div class="rg-list">${list.map(t => `<label class="rg"><input type="checkbox" value="${esc(t.id)}"><span>${esc(t.title)}</span><em>${Math.round((Date.now() - (t.createdAt || Date.now())) / DAY)}d on your list</em></label>`).join('')}</div>`,
          `<button class="btn" data-act="close-modal">Not now</button><button class="btn primary" id="rg-ok">These matter</button>`);
        document.getElementById('rg-ok').onclick = () => { const ids = [...document.querySelectorAll('.rg input:checked')].map(i => i.value);
          for (const id of ids) { const t = api.tasks.get(id); api.tasks.update(id, { tags: [...new Set([...(t.tags || []), 'regret'])], priority: Math.max(1, t.priority || 0) }); }
          api.storage.set('asked', new Date().getFullYear() + '-' + new Date().getMonth()); api.ui.close(); api.ui.toast(ids.length ? `${ids.length} promoted. Future you says thanks.` : 'Okay. Nothing urgent for 80-year-old you.'); };
      }
      api.chips.add((t, preview) => !preview && !t.done && (t.tags || []).includes('regret') ? `<span class="chip rg-chip" title="You said 80-year-old you would care">${api.ui.icon('heart')}Matters</span>` : '');
      window.__regret = { ask };
      api.commands.add({ title: 'Regret minimizer', hint: 'What would you regret not doing?', run: ask });
      setTimeout(() => { const k = new Date().getFullYear() + '-' + new Date().getMonth(); if (api.storage.get('asked') === k || api.storage.get('offered') === k || api.tasks.list(t => !t.done).length < 4) return; api.storage.set('offered', k);
        api.island.show({ icon: '🌱', title: 'Monthly check-in', sub: 'Which of these would you regret not doing at 80?', sticky: true, log: false, actions: [{ label: 'Take a look', run: ask }] }); }, 12000);
      css('rg-css', `.rg{display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid var(--line);cursor:pointer;font-size:14px}.rg span{flex:1}.rg em{font-style:normal;font-size:12px;color:var(--muted)}
        .rg-chip{color:#d97706}.rg-chip svg{width:12px;height:12px;margin-right:3px}`);
    },
  });
})();
