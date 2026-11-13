/* Calendar view: month and week grids of your tasks (by due date / time) and your calendar's meetings.
   Drag a task to another day (or another hour in Week) to move it. Click an empty day to add a task on it.
   Click a task to edit it in the panel on the right. */
(() => {
  Cadence.registerPlugin({
    id: 'calview', name: 'Calendar view', version: '1.0.0', category: 'Views', spaces: ['work', 'life'],
    description: 'Month and week grids of your tasks and meetings. Drag tasks to reschedule, click a day to add one.',
    tagline: 'Month and week grids', color: '#e5484d',
    icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 14h2M14 14h2M8 17h2"/>',
    setup(api) {
      const esc = window.CadenceKit.esc;
      const U = api.util, key = d => U.ymd(d);
      const st = () => Object.assign({ mode: 'month', at: null }, api.storage.get('st') || {});
      const setSt = p => { api.storage.set('st', Object.assign(st(), p)); api.ui.refresh(); };
      const anchor = () => { const a = st().at; return a ? U.fromYmd(a) : new Date(); };
      const events = () => ((window.__cal && window.__cal.events) || []).filter(e => e.start);
      const colorOf = t => { const c = t.clientId && api.clients.get(t.clientId); return c ? c.color : 'var(--muted)'; };
      const HOURS = [7, 22];

      function itemHTML(t) {
        return `<div class="cv-it ${t.done ? 'dn' : ''} ${U.dueState(t) === 'over' && !t.done ? 'over' : ''} ${api.ui.selected() === t.id ? 'sel' : ''}" draggable="true" data-id="${esc(t.id)}" style="--c:${esc(colorOf(t))}" title="${esc(t.title)}">
          ${t.dueTime ? `<span class="tm">${esc(U.fmtTime(t.dueTime).replace(':00', '').replace(' ', '').toLowerCase())}</span>` : ''}${esc(t.title)}</div>`;
      }
      const evHTML = e => `<div class="cv-ev" title="${esc(e.title || 'Meeting')}"><span class="tm">${new Date(e.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(':00', '').replace(' ', '').toLowerCase()}</span>${esc(e.title || 'Meeting')}</div>`;

      function month(el) {
        const a = anchor(), first = new Date(a.getFullYear(), a.getMonth(), 1), start = U.addDays(first, -first.getDay()), t0 = U.todayKey();
        const tasks = api.tasks.list(t => t.dueDate && (!t.done || (t.doneAt && Date.now() - t.doneAt < 30 * 864e5)));
        const evs = events();
        let cells = '';
        for (let i = 0; i < 42; i++) {
          const d = U.addDays(start, i), k = key(d), inM = d.getMonth() === a.getMonth();
          const list = tasks.filter(t => t.dueDate === k).sort((x, y) => (x.done - y.done) || String(x.dueTime || '99').localeCompare(String(y.dueTime || '99')));
          const ev = evs.filter(e => key(new Date(e.start)) === k);
          const items = [...ev.map(evHTML), ...list.map(itemHTML)], max = 4;
          cells += `<div class="cv-day ${inM ? '' : 'out'} ${k === t0 ? 'today' : ''} ${d.getDay() % 6 === 0 ? 'we' : ''}" data-day="${k}"><div class="cv-dn">${d.getDate() === 1 ? d.toLocaleDateString([], { month: 'short' }) + ' ' : ''}${d.getDate()}</div>
            ${items.slice(0, max).join('')}${items.length > max ? `<button class="cv-more" data-day="${k}">+${items.length - max} more</button>` : ''}</div>`;
        }
        el.innerHTML = `<div class="cv-dow">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(x => `<span>${x}</span>`).join('')}</div><div class="cv-month">${cells}</div>`;
      }

      const narrow = () => matchMedia('(max-width: 640px)').matches;
      function agenda(el) {   // the week as a list of days, for phones
        const a = anchor(), start = U.addDays(a, -a.getDay()), t0 = U.todayKey(), tasks = api.tasks.list(t => t.dueDate), evs = events();
        el.innerHTML = Array.from({ length: 7 }, (_, i) => { const d = U.addDays(start, i), k = key(d), its = [...evs.filter(e => key(new Date(e.start)) === k).map(evHTML), ...tasks.filter(t => t.dueDate === k).sort((x, y) => String(x.dueTime || '99').localeCompare(String(y.dueTime || '99'))).map(itemHTML)];
          return `<div class="cv-ag ${k === t0 ? 'today' : ''}" data-day="${k}"><div class="cv-agh"><b>${d.toLocaleDateString([], { weekday: 'short' })}</b> ${d.getDate()}</div><div class="cv-agl">${its.join('') || '<span class="muted" style="font-size:12px">Nothing</span>'}</div></div>`; }).join('');
      }
      function week(el) { if (narrow()) return agenda(el);
        const a = anchor(), start = U.addDays(a, -a.getDay()), t0 = U.todayKey(), [h0, h1] = HOURS, PX = 44;
        const days = Array.from({ length: 7 }, (_, i) => U.addDays(start, i)), tasks = api.tasks.list(t => t.dueDate), evs = events();
        const now = new Date(), nowTop = ((now.getHours() + now.getMinutes() / 60) - h0) * PX;
        el.innerHTML = `<div class="cv-wk">
          <div class="cv-wh"><span></span>${days.map(d => `<span class="${key(d) === t0 ? 'today' : ''}"><b>${d.toLocaleDateString([], { weekday: 'short' })}</b>${d.getDate()}</span>`).join('')}</div>
          <div class="cv-all"><span class="lbl">All day</span>${days.map(d => `<div class="cv-day" data-day="${key(d)}">${tasks.filter(t => t.dueDate === key(d) && !t.dueTime && !t.done).map(itemHTML).join('')}</div>`).join('')}</div>
          <div class="cv-grid" style="--px:${PX}px">
            <div class="cv-hrs">${Array.from({ length: h1 - h0 }, (_, i) => `<span>${((h0 + i) % 12) || 12}${h0 + i < 12 ? 'a' : 'p'}</span>`).join('')}</div>
            ${days.map(d => { const k = key(d);
              const blocks = [...evs.filter(e => key(new Date(e.start)) === k).map(e => { const s = new Date(e.start), en = new Date(e.end || e.start + 18e5), top = (s.getHours() + s.getMinutes() / 60 - h0) * PX, h = Math.max(20, (en - s) / 36e5 * PX); return `<div class="cv-blk ev" style="top:${top}px;height:${h}px">${evHTML(e)}</div>`; }),
                ...tasks.filter(t => t.dueDate === k && t.dueTime).map(t => { const [hh, mm] = t.dueTime.split(':').map(Number), top = (hh + mm / 60 - h0) * PX; return `<div class="cv-blk" style="top:${Math.max(0, top)}px">${itemHTML(t)}</div>`; })];
              return `<div class="cv-col ${k === t0 ? 'today' : ''}" data-day="${k}">${Array.from({ length: h1 - h0 }, (_, i) => `<div class="cv-slot" data-day="${k}" data-h="${h0 + i}"></div>`).join('')}${blocks.join('')}${k === t0 && nowTop > 0 && nowTop < (h1 - h0) * PX ? `<i class="cv-now" style="top:${nowTop}px"></i>` : ''}</div>`; }).join('')}
          </div></div>`;
      }

      function render(el) {
        const s = st(), a = anchor(), sel = api.ui.selected(), selT = sel && api.tasks.get(sel);
        const title = s.mode === 'month' ? a.toLocaleDateString([], { month: 'long', year: 'numeric' }) : (() => { const st0 = U.addDays(a, -a.getDay()), en = U.addDays(st0, 6); return `${st0.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${st0.getMonth() === en.getMonth() ? en.getDate() : en.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${en.getFullYear()}`; })();
        el.innerHTML = `<div class="cv-bar"><div class="seg" id="cv-mode"><button data-v="month" class="${s.mode === 'month' ? 'on' : ''}">Month</button><button data-v="week" class="${s.mode === 'week' ? 'on' : ''}">Week</button></div>
          <button class="btn" data-cv="prev" aria-label="Previous">‹</button><button class="btn" data-cv="today">Today</button><button class="btn" data-cv="next" aria-label="Next">›</button>
          <h2 class="cv-title">${esc(title)}</h2>${!events().length ? '<span class="muted cv-hint">Connect a calendar (Calendar plugin) to see meetings here</span>' : ''}</div>
          <div class="cv-body ${selT ? 'has-side' : ''}"><div class="cv-main"></div>${selT ? `<aside class="cv-side">${api.ui.taskRow(selT)}</aside>` : ''}</div>`;
        const main = el.querySelector('.cv-main'); (s.mode === 'week' ? week : month)(main);
        el.querySelectorAll('#cv-mode button').forEach(b => b.onclick = () => setSt({ mode: b.dataset.v }));
        el.querySelectorAll('[data-cv]').forEach(b => b.onclick = () => { const k = b.dataset.cv, d = anchor(); if (k === 'today') return setSt({ at: null });
          const n = k === 'next' ? 1 : -1; setSt({ at: key(s.mode === 'month' ? new Date(d.getFullYear(), d.getMonth() + n, 1) : U.addDays(d, 7 * n)) }); });
        // open a task (after core's own click handling has closed any other)
        main.querySelectorAll('.cv-it').forEach(it => it.addEventListener('click', e => { e.stopPropagation(); const id = it.dataset.id; setTimeout(() => api.ui.openTask(id), 0); }));
        main.querySelectorAll('.cv-more').forEach(b => b.onclick = e => { e.stopPropagation(); setSt({ mode: 'week', at: b.dataset.day }); });
        // click an empty bit of a day: add a task there
        main.querySelectorAll('.cv-day, .cv-slot').forEach(d => d.addEventListener('dblclick', e => { if (e.target.closest('.cv-it,.cv-ev,.cv-more')) return; addOn(d.dataset.day, d.dataset.h); }));
        main.querySelectorAll('.cv-month .cv-day').forEach(d => d.addEventListener('click', e => { if (narrow()) { setSt({ mode: 'week', at: d.dataset.day }); return; } if (e.target.closest('.cv-it,.cv-ev,.cv-more,.cv-add') || api.ui.selected()) return; addOn(d.dataset.day); }));
        // drag to reschedule
        let dragId = null;
        main.querySelectorAll('.cv-it').forEach(it => { it.addEventListener('dragstart', e => { dragId = it.dataset.id; e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; }); it.addEventListener('dragend', () => main.querySelectorAll('.over').forEach(x => x.classList.remove('over'))); });
        main.querySelectorAll('.cv-day, .cv-slot').forEach(d => {
          d.addEventListener('dragover', e => { if (!dragId) return; e.preventDefault(); d.classList.add('over'); });
          d.addEventListener('dragleave', () => d.classList.remove('over'));
          d.addEventListener('drop', e => { e.preventDefault(); d.classList.remove('over'); const id = dragId || e.dataTransfer.getData('text/plain'); dragId = null; moveTo(id, d.dataset.day, d.dataset.h); });
        });
      }
      function moveTo(id, day, h) {
        const t = api.tasks.get(id); if (!t || !day) return;
        const patch = { dueDate: day }; if (h != null) patch.dueTime = String(h).padStart(2, '0') + ':00'; else if (st().mode === 'week') patch.dueTime = null;
        if (t.dueDate === day && (h == null ? true : t.dueTime === patch.dueTime)) return;
        api.tasks.update(id, patch); api.ui.toast(`Moved to ${U.fmtDate(day)}${patch.dueTime ? ' · ' + U.fmtTime(patch.dueTime) : ''}`);
      }
      function addOn(day, h) {
        const cell = document.querySelector(`.cv-main [data-day="${day}"]${h != null ? `[data-h="${h}"]` : ''}`); if (!cell || cell.querySelector('.cv-add')) return;
        const inp = document.createElement('input'); inp.className = 'cv-add'; inp.placeholder = h != null ? `Task at ${((+h) % 12) || 12}${+h < 12 ? 'am' : 'pm'}…` : 'New task…';
        cell.appendChild(inp); inp.focus();
        let fin = false; const done = ok => { if (fin) return; fin = true; const v = inp.value.trim(); inp.isConnected && inp.remove(); if (!ok || !v) return; const t = api.tasks.quickAdd(v); if (t) api.tasks.update(t.id, { dueDate: t.dueDate && t.dueDate !== U.todayKey() ? t.dueDate : day, ...(h != null && !t.dueTime ? { dueTime: String(h).padStart(2, '0') + ':00' } : {}) }); };
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); done(true); } if (e.key === 'Escape') { e.stopPropagation(); done(false); } });
        inp.addEventListener('blur', () => done(true));
      }
      window.__calview = { moveTo };

      api.views.add({ id: 'calendar', title: 'Calendar', icon: '🗓️', subtitle: 'Your tasks and meetings by day. Drag to reschedule, click a day to add.', wide: true, render });
      api.commands.add({ title: 'Calendar view', hint: 'Month and week', run: () => api.ui.navigate('view-calendar') });

      if (!document.getElementById('cv-css')) {
        const s = document.createElement('style'); s.id = 'cv-css';
        s.textContent = `
        .cv-bar{display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap}
        .cv-bar .btn{padding:5px 10px}.cv-title{font-size:18px;margin:0 0 0 8px;font-weight:700}.cv-hint{font-size:12px;margin-left:auto}
        .cv-body{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}.cv-body.has-side{grid-template-columns:minmax(0,1fr) 340px}
        .cv-side{position:sticky;top:16px;align-self:start}.cv-side .task{margin:0}
        .cv-dow{display:grid;grid-template-columns:repeat(7,1fr);font-size:11.5px;color:var(--muted);font-weight:600;padding:0 2px 6px}
        .cv-dow span{padding-left:8px}
        .cv-month{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));grid-auto-rows:minmax(108px,auto);border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--panel,var(--bg))}
        .cv-month .cv-day{border-right:1px solid var(--line);border-bottom:1px solid var(--line);padding:4px 5px 6px;display:flex;flex-direction:column;gap:3px;min-width:0;cursor:pointer}
        .cv-month .cv-day:nth-child(7n){border-right:0}.cv-month .cv-day:nth-last-child(-n+7){border-bottom:0}
        .cv-day.out{background:color-mix(in srgb,var(--text) 2.5%,transparent)}.cv-day.out .cv-dn{opacity:.45}
        .cv-day.we{background:color-mix(in srgb,var(--text) 1.5%,transparent)}
        .cv-day.over,.cv-slot.over{background:color-mix(in srgb,var(--accent) 12%,transparent)!important;outline:2px dashed var(--accent);outline-offset:-2px}
        .cv-dn{font-size:12px;font-weight:600;color:var(--muted);padding:2px 3px}
        .cv-day.today .cv-dn{color:#fff;background:var(--accent);border-radius:999px;align-self:flex-start;padding:2px 7px}
        .cv-it,.cv-ev{font-size:11.5px;line-height:1.3;padding:3px 6px;border-radius:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;min-width:0}
        .cv-it{background:color-mix(in srgb,var(--c) 14%,var(--panel,var(--bg)));border-left:3px solid var(--c);color:var(--text)}
        .cv-it:hover{filter:brightness(.97)}.cv-it.sel{outline:2px solid var(--accent)}
        .cv-it.dn{opacity:.5;text-decoration:line-through}.cv-it.over{border-left-color:#e5484d}
        .cv-ev{background:color-mix(in srgb,var(--accent) 16%,transparent);color:color-mix(in srgb,var(--accent) 75%,var(--text));cursor:default}
        .cv-it .tm,.cv-ev .tm{font-weight:700;margin-right:4px;opacity:.75}
        .cv-more{font-size:11px;color:var(--muted);background:none;border:0;text-align:left;padding:2px 6px;cursor:pointer}.cv-more:hover{color:var(--accent)}
        .cv-add{font:12px Inter,system-ui;border:1px solid var(--accent);border-radius:6px;padding:3px 6px;background:var(--bg);color:var(--text);width:100%;min-width:0}
        .cv-wk{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--panel,var(--bg))}
        .cv-wh,.cv-all{display:grid;grid-template-columns:48px repeat(7,minmax(0,1fr));border-bottom:1px solid var(--line)}
        .cv-wh span{padding:8px;font-size:12px;color:var(--muted);text-align:center}.cv-wh b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
        .cv-wh span.today{color:var(--accent);font-weight:700}
        .cv-all .lbl{font-size:10.5px;color:var(--muted);padding:6px 4px;text-align:right}
        .cv-all .cv-day{border-left:1px solid var(--line);padding:4px;display:flex;flex-direction:column;gap:3px;min-height:34px;min-width:0}
        .cv-grid{display:grid;grid-template-columns:48px repeat(7,minmax(0,1fr));max-height:62vh;overflow:auto;position:relative}
        .cv-hrs span{display:block;height:var(--px);font-size:10.5px;color:var(--muted);text-align:right;padding:0 6px;transform:translateY(-6px)}.cv-hrs span:first-child{transform:none}
        .cv-col{position:relative;border-left:1px solid var(--line);min-width:0}.cv-col.today{background:color-mix(in srgb,var(--accent) 4%,transparent)}
        .cv-slot{height:var(--px);border-bottom:1px solid color-mix(in srgb,var(--line) 60%,transparent)}
        .cv-blk{position:absolute;left:3px;right:3px;z-index:1}.cv-blk.ev{display:flex}.cv-blk.ev .cv-ev{flex:1;white-space:normal}
        .cv-now{position:absolute;left:0;right:0;height:2px;background:#e5484d;z-index:2}.cv-now:before{content:'';position:absolute;left:-4px;top:-3px;width:8px;height:8px;border-radius:50%;background:#e5484d}
        @media (max-width:1100px){.cv-body.has-side{grid-template-columns:1fr}.cv-side{position:static}}
        .cv-ag{display:grid;grid-template-columns:64px 1fr;gap:8px;padding:10px 4px;border-bottom:1px solid var(--line)}.cv-ag.today .cv-agh{color:var(--accent)}.cv-agh{font-size:13px;color:var(--muted)}.cv-agh b{display:block;font-size:11px;text-transform:uppercase}.cv-agl{display:flex;flex-direction:column;gap:4px;min-width:0}
        @media (max-width:640px){.cv-month{grid-auto-rows:58px}.cv-month .cv-it,.cv-month .cv-ev{font-size:0;padding:0;height:6px;border-radius:3px;border-left:0;background:var(--c,var(--accent))}.cv-month .cv-ev{background:var(--accent)}.cv-more{font-size:10px;padding:0}.cv-dn{font-size:11px}.cv-hint{display:none}.cv-title{font-size:16px;width:100%;margin:4px 0 0}}`;
        document.head.appendChild(s);
      }
    },
  });
})();
