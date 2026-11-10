/* Family hub (Life):
   - Kitchen tablet: a full-screen board for a tablet on the fridge. Big clock, weather, today's schedule, who drives
     whom, dinner, what's due. Stays awake and refreshes itself. Open with ⌘K "Kitchen tablet" or the #kiosk address.
   - Vacation planner: countdown, booking deadlines, per-person packing lists remembered between trips, pet-sitter notes.
   - Traditions: pumpkin patch, cookie day, the yearly photo: reminded two weeks ahead every year. */
(() => {
  const K = window.LifeKit; if (!K) return; const { esc, uid, form, today, daysUntil, addDays, ymd, fromYmd } = K;
  const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  /* ======================= Kitchen tablet ======================= */
  Cadence.registerPlugin({
    id: 'kiosk', name: 'Kitchen tablet', version: '1.0.0', category: 'Life', spaces: ['life', 'work'],
    description: 'A full-screen family board for a tablet on the fridge: clock, weather, today’s schedule, who drives whom, dinner, and what’s due. Open the #kiosk address on the tablet.',
    tagline: 'The family board on the fridge', color: '#334155',
    icon: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M12 18h.01"/>',
    setup(api) {
      let el = null, iv = 0, lock = null;
      function draw() {
        if (!el) return; const now = new Date(), t0 = today(), tasks = api.tasks.list(t => !t.done && t.dueDate && t.dueDate <= t0).sort((a, b) => String(a.dueTime || '99').localeCompare(String(b.dueTime || '99')));
        const evs = ((window.__cal && window.__cal.events) || []).filter(e => !e.allDay && fromYmd(t0) <= new Date(e.start) && new Date(e.start) < fromYmd(addDays(t0, 1)));
        const sched = [...evs.map(e => ({ t: new Date(e.start).toTimeString().slice(0, 5), title: e.title })), ...tasks.filter(t => t.dueTime).map(t => ({ t: t.dueTime, title: t.title })), ...((window.__kids && window.__kids.today()) || []).map(a => ({ t: a.time || '', title: `${a.kid}: ${a.name}`, sub: a.driver ? `${a.driver} driving` : a.where }))].sort((a, b) => a.t.localeCompare(b.t));
        const wx = window.__wx && window.__wx.data, din = window.__kitchen && window.__kitchen.tonight();
        el.innerHTML = `<div class="ks-top"><div><div class="ks-clock">${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div><div class="ks-date">${DOW[now.getDay()]}, ${MON[now.getMonth()]} ${now.getDate()}</div></div>
            ${wx ? `<div class="ks-wx">${api.ui.icon(window.CadenceWeather.wmo(wx.current.weather_code)[1])}<b>${Math.round(wx.current.temperature_2m)}°</b><span>${esc(window.CadenceWeather.wmo(wx.current.weather_code)[0])} · ${Math.round(wx.daily.temperature_2m_max[0])}°/${Math.round(wx.daily.temperature_2m_min[0])}°</span></div>` : ''}<button class="ks-x" title="Close (Esc)">${api.ui.icon('x')}</button></div>
          <div class="ks-grid"><section><h3>Today</h3>${sched.map(x => `<div class="ks-it"><b>${x.t ? esc(api.util.fmtTime(x.t)) : ''}</b><span>${esc(x.title)}${x.sub ? `<em>${esc(x.sub)}</em>` : ''}</span></div>`).join('') || '<p class="ks-none">Nothing scheduled. Enjoy it.</p>'}</section>
            <section><h3>Dinner</h3>${din ? `${din.image ? `<div class="ks-din" style="background-image:url('${esc(din.image)}')"></div>` : ''}<p class="ks-big">${esc(din.name)}</p>` : '<p class="ks-none">Not planned yet</p>'}${window.__kitchen ? `<p class="ks-sub">${window.__kitchen.listCount()} on the shopping list</p>` : ''}</section>
            <section><h3>To do today</h3>${tasks.filter(t => !t.dueTime).slice(0, 8).map(t => `<label class="ks-td"><input type="checkbox" data-done="${esc(t.id)}"><span>${esc(t.title)}</span></label>`).join('') || '<p class="ks-none">All clear</p>'}</section></div>`;
        el.querySelector('.ks-x').onclick = close;
        el.querySelectorAll('[data-done]').forEach(c => c.onchange = () => { api.tasks.complete(c.dataset.done); setTimeout(draw, 300); });
      }
      async function open() { if (el) return; el = document.createElement('div'); el.id = 'kiosk'; document.body.appendChild(el); draw(); iv = setInterval(draw, 30e3); try { lock = navigator.wakeLock && await navigator.wakeLock.request('screen'); } catch (e) {} try { document.documentElement.requestFullscreen && !document.fullscreenElement && await document.documentElement.requestFullscreen(); } catch (e) {} }
      function close() { clearInterval(iv); el && el.remove(); el = null; try { lock && lock.release(); } catch (e) {} lock = null; if (location.hash === '#kiosk') location.hash = 'today'; try { document.fullscreenElement && document.exitFullscreen(); } catch (e) {} }
      window.__kiosk = { open, close };
      api.commands.add({ title: 'Kitchen tablet', hint: 'Full-screen family board', run: open });
      const hc = () => { if (location.hash === '#kiosk') open(); }; if (!window.__kioskHC) { window.__kioskHC = true; addEventListener('hashchange', () => window.__kioskHC2 && window.__kioskHC2()); addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('kiosk')) window.__kiosk.close(); }); } window.__kioskHC2 = hc; setTimeout(hc, 300);
      K.css('ks-css', `#kiosk{position:fixed;inset:0;z-index:150;background:var(--bg);color:var(--text);padding:3vh 4vw;display:flex;flex-direction:column;gap:3vh;overflow:auto}
        .ks-top{display:flex;align-items:center;gap:4vw}.ks-clock{font:800 clamp(56px,10vw,140px)/1 ui-rounded,system-ui;letter-spacing:-.02em}.ks-date{font-size:clamp(18px,2.4vw,30px);color:var(--muted)}
        .ks-wx{display:flex;align-items:center;gap:12px;margin-left:auto;margin-right:40px}.ks-wx svg{width:64px;height:64px;color:#f59e0b}.ks-wx b{font:800 52px/1 ui-rounded,system-ui}.ks-wx span{color:var(--muted);font-size:18px}
        .ks-x{position:absolute;top:18px;right:20px;background:none;border:0;color:var(--muted);cursor:pointer}.ks-x svg{width:28px;height:28px}
        .ks-grid{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:2.5vw;flex:1}.ks-grid section{background:var(--panel);border:1px solid var(--line);border-radius:22px;padding:20px 24px}
        .ks-grid h3{margin:0 0 12px;font-size:15px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}
        .ks-it{display:flex;gap:16px;padding:12px 0;border-bottom:1px solid var(--line);font-size:22px}.ks-it b{min-width:96px;color:var(--accent)}.ks-it em{display:block;font-style:normal;font-size:15px;color:var(--muted)}
        .ks-din{height:160px;border-radius:14px;background:center/cover;margin-bottom:10px}.ks-big{font:700 28px/1.2 ui-rounded,system-ui;margin:0}.ks-sub,.ks-none{color:var(--muted);font-size:18px}
        .ks-td{display:flex;gap:14px;align-items:center;font-size:21px;padding:10px 0;border-bottom:1px solid var(--line)}.ks-td input{width:26px;height:26px}
        @media (max-width:900px){.ks-grid{grid-template-columns:1fr}}`);
    },
  });

  /* ======================= Vacation planner ======================= */
  const SITTER = ['Feeding: how much, when, where the food is', 'Walks / litter box', 'Medicines and doses', 'Vet’s name and number', 'Emergency contact', 'Keys, alarm code location', 'Plants to water', 'Garbage / recycling day'];
  Cadence.registerPlugin({
    id: 'vacation', name: 'Vacation planner', version: '1.0.0', category: 'Life', spaces: ['life'],
    description: 'Trips with a countdown, booking deadlines as tasks, packing lists per person that remember what each person brought last time, and a pet-sitter sheet you can print.',
    tagline: 'Countdown, bookings, packing, pet sitter', color: '#0891b2',
    icon: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    setup(api) {
      const g = k => api.storage.get(k) || (k === 'base' ? {} : []), s = (k, v) => { api.storage.set(k, v); api.ui.refresh(); };
      const trips = () => g('trips'), trip = id => trips().find(t => t.id === id), upd = (id, p) => s('trips', trips().map(t => t.id === id ? { ...t, ...p } : t));
      function view(el) {
        const sel = api.storage.get('sel'), t = sel && trip(sel);
        if (!t) { const list = trips().slice().sort((a, b) => a.start.localeCompare(b.start));
          el.innerHTML = `<div class="lk-top"><button class="btn primary" id="vc-new">Plan a trip</button></div>` + (list.map(x => { const d = daysUntil(x.start); return `<button class="vc-trip" data-open="${esc(x.id)}"><b>${esc(x.name)}</b><span>${esc(api.util.fmtDate(x.start))} – ${esc(api.util.fmtDate(x.end))}</span><em>${d > 0 ? `${d} days to go` : daysUntil(x.end) >= 0 ? 'Happening now' : 'Done'}</em></button>`; }).join('') || K.empty('No trips yet.'));
          el.querySelector('#vc-new').onclick = () => form(api, 'New trip', [{ k: 'name', label: 'Where', req: true, ph: 'Cottage weekend' }, { k: 'start', label: 'Leave', type: 'date', req: true }, { k: 'end', label: 'Back', type: 'date', req: true }, { k: 'people', label: 'Who’s going (comma separated)', ph: 'Nick, Sam, Maya' }, { k: 'pet', label: 'We have a pet sitter coming', type: 'check' }], null, v => { const x = { id: uid(), ...v, people: v.people.split(',').map(p => p.trim()).filter(Boolean), bookings: [], packed: {}, sitter: v.pet ? SITTER.map(q => ({ q, a: '' })) : null }; api.storage.set('sel', x.id); s('trips', [...trips(), x]);
            K.ownTask(api, 'pack:' + x.id, { title: `Pack for ${x.name}`, dueDate: addDays(x.start, -1) < today() ? today() : addDays(x.start, -1) }); });
          el.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { api.storage.set('sel', b.dataset.open); api.ui.refresh(); }); return; }
        const base = g('base'), d = daysUntil(t.start);
        el.innerHTML = `<div class="lk-top"><button class="lk-btn" id="vc-back">‹ All trips</button><b style="font-size:17px">${esc(t.name)}</b><span class="sp"></span><span class="vc-count">${d > 0 ? `<b>${d}</b> days to go` : 'Have fun!'}</span></div>
          ${K.card('Bookings and deadlines', (t.bookings || []).map((b, i) => `<div class="lk-row"><span class="grow">${esc(b.what)}</span><em class="${b.done ? '' : daysUntil(b.by) < 7 ? 'hot' : ''}">${b.done ? 'Booked' : 'by ' + esc(api.util.fmtDate(b.by))}</em>${b.done ? '' : `<button class="lk-btn" data-bk="${i}">Booked</button>`}</div>`).join('') || K.empty('Flights, the hotel, the kennel, rental car…'), '<button class="lk-btn" id="vc-badd">Add</button>')}
          ${t.people.map(p => { const items = [...new Set([...(base[p] || []), ...((t.extra || {})[p] || [])])], packed = (t.packed || {})[p] || [];
            return K.card(`${esc(p)}’s packing list <span class="muted" style="font-weight:400;font-size:12px">${packed.length}/${items.length}</span>`, `${items.map(it => `<label class="lk-row"><input type="checkbox" data-pk="${esc(p)}" value="${esc(it)}" ${packed.includes(it) ? 'checked' : ''}><span class="grow">${esc(it)}</span></label>`).join('')}<input class="inp" data-padd="${esc(p)}" placeholder="Add an item (remembered for next time)" style="margin-top:6px">`); }).join('')}
          ${t.sitter ? K.card('For the pet sitter', t.sitter.map((x, i) => `<div class="field"><label>${esc(x.q)}</label><input class="inp" data-sit="${i}" value="${esc(x.a)}"></div>`).join(''), '<button class="lk-btn" id="vc-sprint">Print</button>') : ''}`;
        const $ = q => el.querySelector(q), all = q => el.querySelectorAll(q);
        $('#vc-back').onclick = () => { api.storage.set('sel', null); api.ui.refresh(); };
        $('#vc-badd').onclick = () => form(api, 'Booking deadline', [{ k: 'what', label: 'What', req: true, ph: 'Book the kennel' }, { k: 'by', label: 'By', type: 'date', req: true }], null, v => { const b = [...(t.bookings || []), v]; upd(t.id, { bookings: b }); K.ownTask(api, `book:${t.id}:${b.length - 1}`, { title: `${v.what} (${t.name})`, dueDate: v.by < today() ? today() : v.by }); });
        all('[data-bk]').forEach(b => b.onclick = () => { const i = +b.dataset.bk; upd(t.id, { bookings: t.bookings.map((x, j) => j === i ? { ...x, done: true } : x) }); K.dropTask(api, `book:${t.id}:${i}`); });
        all('[data-pk]').forEach(c => c.onchange = () => { const p = c.dataset.pk, cur = (t.packed || {})[p] || []; upd(t.id, { packed: { ...(t.packed || {}), [p]: c.checked ? [...cur, c.value] : cur.filter(x => x !== c.value) } }); });
        all('[data-padd]').forEach(i => i.onkeydown = e => { if (e.key !== 'Enter' || !i.value.trim()) return; const p = i.dataset.padd, b = g('base'); api.storage.set('base', { ...b, [p]: [...new Set([...(b[p] || []), ...i.value.split(',').map(x => x.trim()).filter(Boolean)])] }); api.ui.refresh(); });
        all('[data-sit]').forEach(i => i.onchange = () => upd(t.id, { sitter: t.sitter.map((x, j) => j === +i.dataset.sit ? { ...x, a: i.value } : x) }));
        $('#vc-sprint') && ($('#vc-sprint').onclick = () => K.printable(`Pet sitter notes · ${t.name}`, `<p class="m">${esc(api.util.fmtDate(t.start))} to ${esc(api.util.fmtDate(t.end))}</p>` + t.sitter.map(x => `<h2>${esc(x.q)}</h2><p>${esc(x.a || '—')}</p>`).join('')));
      }
      api.views.add({ id: 'vacation', title: 'Trips', icon: '✈️', subtitle: 'Countdowns, bookings, packing lists that remember', render: view });
      K.css('vc-css', `.vc-trip{display:grid;grid-template-columns:1fr auto;gap:2px 12px;width:100%;text-align:left;border:1px solid var(--line);border-radius:14px;background:var(--panel);padding:12px 14px;margin-bottom:8px;cursor:pointer;color:var(--text)}.vc-trip b{font-size:15px}.vc-trip span{grid-column:1;color:var(--muted);font-size:12.5px}.vc-trip em{grid-column:2;grid-row:1/3;align-self:center;font-style:normal;font-weight:700;color:#0891b2}
        .vc-count{font-size:13px;color:var(--muted)}.vc-count b{font:900 26px/1 ui-rounded,system-ui;color:#0891b2}`);
    },
  });

  /* ======================= Traditions ======================= */
  const ORD = ['first', 'second', 'third', 'fourth', 'last'];
  Cadence.registerPlugin({
    id: 'traditions', name: 'Family traditions', version: '1.0.0', category: 'Life', spaces: ['life'],
    description: 'The things you do every year (pumpkin patch, cookie day, the yearly photo) with a reminder two weeks ahead so they actually happen.',
    tagline: 'Every year, on time', color: '#c2410c',
    icon: '<path d="M12 7v14M3 7h18v4H3zM19 11v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8"/><path d="M7.5 7a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    setup(api) {
      const list = () => api.storage.get('list') || [];
      function nextDate(tr, from = today()) {
        for (const y of [fromYmd(from).getFullYear(), fromYmd(from).getFullYear() + 1]) {
          let d; if (tr.kind === 'date') d = new Date(y, +tr.month, +tr.day);
          else { const w = +tr.dow, n = ORD.indexOf(tr.ord); if (n === 4) { d = new Date(y, +tr.month + 1, 0); while (d.getDay() !== w) d.setDate(d.getDate() - 1); } else { d = new Date(y, +tr.month, 1); while (d.getDay() !== w) d.setDate(d.getDate() + 1); d.setDate(d.getDate() + 7 * n); } }
          if (ymd(d) >= from) return ymd(d); }
      }
      const sync = tr => { const d = nextDate(tr); K.ownTask(api, 'trad:' + tr.id, { title: `Plan: ${tr.name} (${api.util.fmtDate(d)})`, dueDate: daysUntil(d) > (tr.lead || 14) ? addDays(d, -(tr.lead || 14)) : today(), tags: ['tradition'] }); };
      api.on('task:complete', t => { if (t.lk && t.lk.startsWith('trad:')) { const tr = list().find(x => 'trad:' + x.id === t.lk); if (tr) setTimeout(() => { const d = nextDate(tr, addDays(nextDate(tr), 1)); K.ownTask(api, t.lk, { title: `Plan: ${tr.name} (${api.util.fmtDate(d)})`, dueDate: addDays(d, -(tr.lead || 14)), tags: ['tradition'] }); }, 50); } });
      function view(el) {
        const ts = list().map(t => ({ ...t, next: nextDate(t) })).sort((a, b) => a.next.localeCompare(b.next));
        el.innerHTML = `<div class="lk-top"><button class="btn primary" id="tr-add">Add a tradition</button>${!ts.length ? '<button class="btn" id="tr-ideas">Add some ideas</button>' : ''}</div>` + K.card('Every year', ts.map(t => `<div class="lk-row"><span class="grow"><b>${esc(t.name)}</b> <span class="muted">${t.kind === 'date' ? `${MON[t.month]} ${t.day}` : `${t.ord} ${DOW[t.dow]} of ${MON[t.month]}`}</span></span><em>next ${esc(api.util.fmtDate(t.next))} · in ${daysUntil(t.next)} days</em><button class="lk-x" data-del="${esc(t.id)}">${api.ui.icon('x')}</button></div>`).join('') || K.empty('Pumpkin patch, cookie day, the yearly family photo…'));
        el.querySelector('#tr-add').onclick = () => form(api, 'A family tradition', [{ k: 'name', label: 'What', req: true, ph: 'Pumpkin patch' }, { k: 'kind', label: 'When', type: 'select', opts: [['nth', 'A weekday in a month (e.g. first Saturday of October)'], ['date', 'A fixed date']] }, { k: 'ord', label: 'Which', type: 'select', opts: ORD.map(o => [o, o]) }, { k: 'dow', label: 'Day', type: 'select', opts: DOW.map((d, i) => [i, d]), def: 6 }, { k: 'month', label: 'Month', type: 'select', opts: MON.map((m, i) => [i, m]), def: 9 }, { k: 'day', label: 'Date (fixed date only)', type: 'number', def: 1 }, { k: 'lead', label: 'Remind me … days before', type: 'number', def: 14 }], null, v => { const tr = { id: uid(), ...v }; api.storage.set('list', [...list(), tr]); sync(tr); api.ui.refresh(); });
        el.querySelector('#tr-ideas') && (el.querySelector('#tr-ideas').onclick = () => { const ideas = [{ name: 'Pumpkin patch', kind: 'nth', ord: 'first', dow: 6, month: 9 }, { name: 'Christmas cookie day', kind: 'nth', ord: 'second', dow: 0, month: 11 }, { name: 'Yearly family photo', kind: 'nth', ord: 'first', dow: 0, month: 5 }, { name: 'First swim of summer', kind: 'date', month: 6, day: 1 }].map(x => ({ id: uid(), lead: 14, ...x })); api.storage.set('list', ideas); ideas.forEach(sync); api.ui.refresh(); });
        el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { K.dropTask(api, 'trad:' + b.dataset.del); api.storage.set('list', list().filter(x => x.id !== b.dataset.del)); api.ui.refresh(); });
      }
      window.__traditions = { nextDate };
      api.views.add({ id: 'traditions', title: 'Traditions', icon: '🎁', subtitle: 'The things you do every year', render: view });
    },
  });
})();
