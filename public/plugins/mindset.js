/* Mindset tools:
   - Done-list mode: on a bad day, Today shows only what you've already done.
   (Procrastination forecaster, Future-you negotiator and Regret minimizer were removed 2026-11-18, user's choice.) */
(() => {
  const esc = window.CadenceKit.esc;
  const css = window.CadenceKit.css;
  const DAY = 864e5;

  /* ======================= Done-list mode ======================= */
  Cadence.registerPlugin({
    id: 'donelist', name: 'Done-list mode', version: '1.0.0', category: 'Wellbeing', spaces: ['work', 'life'],
    description: 'For bad days: Today shows only what you’ve already done, this week and all time. Proof you’re not failing. Turns itself off at midnight.',
    tagline: 'Only what you’ve done, for bad days', color: '#10b981',
    icon: '<path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/>',
    setup(api) {
      const on = () => { const v = localStorage.getItem('cadence.donelist'); return v && v === new Date().toDateString(); };
      const set = v => { v ? localStorage.setItem('cadence.donelist', new Date().toDateString()) : localStorage.removeItem('cadence.donelist'); live(); api.ui.navigate('today'); api.ui.refresh(); };
      const live = () => on() ? api.island.live('donelist', { prio: 3, view: () => ({ minW: 160, onClick: () => set(false), html: `<span class="isl-dot" style="background:var(--ok)"></span><span class="isl-t"><b>Done-list mode</b></span>` }) }) : api.island.clear('donelist');
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
        .dl-big b{display:block;font:900 34px/1 ui-rounded,system-ui;color:var(--ok)}.dl-big span{font-size:13px;color:var(--muted)}
        .dl-it{display:flex;align-items:center;gap:10px;padding:8px 2px;border-bottom:1px solid var(--line);font-size:14px}.dl-it svg{width:16px;height:16px;color:var(--ok);flex:none}.dl-it span{flex:1}.dl-it em{font-style:normal;font-size:12px;color:var(--muted)}
        .dl-soft{padding:18px;border-radius:var(--r-l);background:var(--hover);font-size:14px;margin-bottom:10px}`);
    },
  });

})();
