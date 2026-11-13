/* Energy, places and rituals:
   - Energy-aware day: a quick morning check-in (low / okay / great). Tasks have an effort (~easy / ~hard in quick add,
     or a guess from the words). On a low day the hard ones are tucked away; on a great day they go first.
   - Places: say where a task can be done ("hardware store"). Nudges when you're nearby need the phone app; until
     then places show on the task and you can filter by them.
   - Rituals: install whole routines ("Sunday reset", "Month-end close") as bundles of repeating tasks, and share your
     own as a small file. */
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const css = (id, text) => { if (document.getElementById(id)) return; const s = document.createElement('style'); s.id = id; s.textContent = text; document.head.appendChild(s); };

  /* ======================= Energy-aware day ======================= */
  const HARD = /\b(write|draft|build|design|plan|proposal|report|taxes|migrate|migration|refactor|research|prepare|presentation|deck|strategy|audit|review all|budget|clean out|organi[sz]e|declutter|apply|study)\b/i;
  const EASY = /\b(reply|respond|call|text|email|buy|book|pay|send|check|order|confirm|schedule|ping|remind|print|sign|water|pick up|drop off|forward|share|rsvp)\b/i;
  Cadence.registerPlugin({
    id: 'energy', name: 'Energy-aware day', version: '1.0.0', category: 'Wellbeing', spaces: ['work', 'life'],
    description: 'A quick morning check-in. On low days the hard tasks are tucked away and easy wins come first; on great days the hard ones go first. Mark effort with ~easy or ~hard in quick add.',
    tagline: 'Hard tasks on good days', color: '#eab308',
    icon: '<rect width="16" height="10" x="2" y="7" rx="2"/><path d="M22 11v2M6 11v2"/>',
    setup(api) {
      const today = () => new Date().toDateString();
      const level = () => { try { const v = JSON.parse(localStorage.getItem('cadence.energy') || 'null'); return v && v.day === today() ? v.level : null; } catch (e) { return null; } };
      const setLevel = l => { localStorage.setItem('cadence.energy', JSON.stringify({ day: today(), level: l })); api.ui.toast(l === 'low' ? 'Low energy day. Hard tasks are tucked away.' : l === 'great' ? 'Great! Hard things first today.' : 'Okay day. Business as usual.'); api.ui.refresh(); };
      const effort = t => t.effort || (HARD.test(t.title) || (t.priority || 0) >= 3 ? 'hard' : EASY.test(t.title) ? 'easy' : 'normal');
      api.parsers.add((text, r) => text.replace(/\s~(easy|e|hard|h|quick|big)(?=\s)/i, (m, k) => { r.effort = /^(easy|e|quick)$/i.test(k) ? 'easy' : 'hard'; return ' '; }));
      api.chips.add((t, preview) => { if (t.done) return ''; const e = preview ? t.effort : effort(t); if (!e || e === 'normal') return ''; const lv = level();
        if (preview || t.effort || (lv && lv !== 'okay')) return `<span class="chip en-${e}" title="${e === 'hard' ? 'Takes real energy' : 'Quick, low-energy'}${t.effort ? '' : ' (guessed from the words)'}">${api.ui.icon(e === 'hard' ? 'battery-full' : 'battery-low')}${e === 'hard' ? 'Hard' : 'Easy'}</span>`; return ''; });
      api.taskCards.add(t => { const e = t.effort || 'auto';
        setTimeout(() => document.querySelectorAll('[data-en]').forEach(b => b.onclick = () => { api.tasks.update(t.id, { effort: b.dataset.en === 'auto' ? null : b.dataset.en }); }), 0);
        return `<div class="en-card"><span>Effort</span>${[['auto', 'Guess'], ['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']].map(([v, l]) => `<button class="${e === v ? 'on' : ''}" data-en="${v}">${l}</button>`).join('')}</div>`; });
      api.on('render', e => {
        if (!e || e.route !== 'today') return; const lv = level(), v = document.getElementById('view'); if (!v || v.querySelector('.en-ban')) return;
        const head = v.querySelector('.head'); if (!head) return;
        if (!lv) { head.insertAdjacentHTML('afterend', `<div class="en-ban ask"><span>How’s your energy today?</span>${[['low', 'battery-low', 'Low'], ['okay', 'battery-medium', 'Okay'], ['great', 'battery-full', 'Great']].map(([k, i, l]) => `<button data-lv="${k}">${api.ui.icon(i)}${l}</button>`).join('')}</div>`); }
        else {
          const rows = [...v.querySelectorAll('.task[data-id]')].map(el => ({ el, t: api.tasks.get(el.dataset.id) })).filter(x => x.t && !x.t.done);
          const hard = rows.filter(x => effort(x.t) === 'hard'), easy = rows.filter(x => effort(x.t) === 'easy');
          if (lv === 'low' && hard.length) { hard.forEach(x => x.el.classList.add('en-tucked')); head.insertAdjacentHTML('afterend', `<div class="en-ban low">${api.ui.icon('battery-low')}<span>Low energy day. ${hard.length} hard task${hard.length === 1 ? ' is' : 's are'} tucked away${easy.length ? `; ${easy.length} easy win${easy.length === 1 ? '' : 's'} up top` : ''}.</span><button data-lv="show">Show them</button><button data-lv="reset">Change</button></div>`);
            easy.forEach(x => { const g = x.el.parentElement; if (g) g.insertBefore(x.el, g.querySelector('.task[data-id]')); }); }
          else if (lv === 'great' && hard.length) { hard.slice().reverse().forEach(x => { const g = x.el.parentElement; if (g) g.insertBefore(x.el, g.querySelector('.task[data-id]')); }); head.insertAdjacentHTML('afterend', `<div class="en-ban great">${api.ui.icon('battery-full')}<span>Great energy. Hard things first: ${esc(hard[0].t.title)}.</span><button data-lv="reset">Change</button></div>`); }
          else head.insertAdjacentHTML('afterend', `<div class="en-ban okay quiet"><span>Energy: ${lv}</span><button data-lv="reset">Change</button></div>`);
        }
        v.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { const k = b.dataset.lv; if (k === 'show') { v.querySelectorAll('.en-tucked').forEach(x => x.classList.remove('en-tucked')); b.remove(); return; } if (k === 'reset') { localStorage.removeItem('cadence.energy'); api.ui.refresh(); return; } setLevel(k); });
      });
      window.__energy = { setLevel, level, effort };
      for (const [k, l] of [['low', 'Low'], ['okay', 'Okay'], ['great', 'Great']]) api.commands.add({ title: `Energy today: ${l}`, run: () => setLevel(k) });
      css('en-css', `.en-ban{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:9px 12px;border-radius:12px;margin:0 0 14px;font-size:13px;border:1px solid var(--line);background:var(--panel)}
        .en-ban span{flex:1}.en-ban svg{width:16px;height:16px}.en-ban button{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);background:var(--bg);color:var(--text);border-radius:999px;padding:4px 11px;font:600 12px Inter,system-ui;cursor:pointer}
        .en-ban button:hover{border-color:var(--accent)}.en-ban.low{background:color-mix(in srgb,#eab308 9%,var(--panel))}.en-ban.great{background:color-mix(in srgb,#22c55e 9%,var(--panel))}.en-ban.quiet{border-style:dashed;color:var(--muted);padding:5px 12px}
        .en-tucked{display:none!important}.en-hard,.chip.en-hard{color:#b45309}.en-easy,.chip.en-easy{color:#15803d}.chip.en-hard svg,.chip.en-easy svg{width:13px;height:13px;margin-right:3px}
        .en-card{display:flex;align-items:center;gap:4px;margin-top:8px;font-size:12px}.en-card span{color:var(--muted);margin-right:4px}.en-card button{border:1px solid var(--line);background:none;border-radius:999px;padding:3px 9px;font:600 11.5px Inter,system-ui;color:var(--muted);cursor:pointer}.en-card button.on{background:var(--accent);border-color:var(--accent);color:#fff}`);
    },
  });

  /* ======================= Places ======================= */
  Cadence.registerPlugin({
    id: 'places', name: 'Places', version: '1.0.0', category: 'Life', spaces: ['life', 'work'],
    description: 'Say where a task can be done (hardware store, pharmacy, office). See everything for a place in one go. Nudges when you’re nearby will come with the phone app.',
    tagline: 'Errands by where you are', color: '#ef4444',
    icon: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    setup(api) {
      api.parsers.add((text, r) => text.replace(/\s(?:at|@)\s?the\s([a-z][\w' -]{2,30}?)(?=\s(?:#|!|\^|>|~|@|tomorrow|today|tmrw|mon|tue|wed|thu|fri|sat|sun|next)|\s*$)/i, (m, p) => { r.place = p.trim().toLowerCase(); return ' '; }));
      api.chips.add((t, preview) => t.place && !t.done ? `<span class="chip pl-chip" title="Can be done at: ${esc(t.place)}">${api.ui.icon('map-pin')}${esc(t.place)}</span>` : '');
      api.taskCards.add(t => { setTimeout(() => { const i = document.getElementById('pl-in-' + t.id); if (i) i.onchange = () => api.tasks.update(t.id, { place: i.value.trim().toLowerCase() || null }); }, 0);
        const known = [...new Set(api.tasks.list(x => x.place).map(x => x.place))].slice(0, 20);
        return `<div class="pl-card">${api.ui.icon('map-pin')}<input id="pl-in-${esc(t.id)}" list="pl-list" class="inp" placeholder="Where can this be done? (hardware store, pharmacy…)" value="${esc(t.place || '')}"><datalist id="pl-list">${known.map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>`; });
      api.views.add({ id: 'places', title: 'Places', icon: '📍', subtitle: 'Your errands, by where you can do them', render: el => {
        const open = api.tasks.list(t => !t.done && t.place), by = {}; open.forEach(t => (by[t.place] = by[t.place] || []).push(t));
        el.innerHTML = Object.keys(by).length ? Object.entries(by).sort((a, b) => b[1].length - a[1].length).map(([p, ts]) => `<div class="sect">${api.ui.icon('map-pin')} ${esc(p)} <span class="muted">${ts.length}</span></div>${ts.map(t => api.ui.taskRow(t)).join('')}`).join('')
          : `<div class="muted" style="padding:20px 0;font-size:13.5px">No places yet. Add one to a task (open it and fill in “Where can this be done?”), or type it in quick add: <code>buy lightbulbs at the hardware store</code>.</div>`;
        el.insertAdjacentHTML('beforeend', '<p class="muted" style="font-size:12px;margin-top:20px">Nudges when you’re near a place need the Cadence phone app (coming later).</p>');
      } });
      css('pl-css', `.pl-chip{color:#ef4444}.pl-chip svg{width:12px;height:12px;margin-right:3px}.pl-card{display:flex;align-items:center;gap:8px;margin-top:8px}.pl-card svg{width:15px;height:15px;color:var(--muted)}.pl-card .inp{padding:5px 9px;font-size:12.5px}`);
    },
  });

  /* ======================= Rituals ======================= */
  const W = (d) => ({ unit: 'week', n: 1, day: d }), M = (n = 1) => ({ unit: 'month', n }), D = { unit: 'day', n: 1 };
  const LIB = [
    { id: 'sunday-reset', name: 'Sunday reset', space: 'life', area: ['Home', '🏠'], desc: 'Start the week calm: meals planned, laundry done, calendar checked.', tasks: [['Plan the week’s meals', W(0)], ['Laundry and change the sheets', W(0)], ['Tidy for 20 minutes', W(0)], ['Look at the calendar for the week', W(0)], ['Prep lunches', W(0)]] },
    { id: 'weekly-review', name: 'Weekly review', space: 'any', desc: 'The classic: inbox to zero, look at every project, check what you’re waiting on.', tasks: [['Get every inbox to zero', W(5)], ['Review each project’s next step', W(5)], ['Review what I’m waiting on', W(5)], ['Look at next week’s calendar', W(5)]] },
    { id: 'monday-plan', name: 'Monday planning', space: 'work', desc: 'Set the week up before the week sets you up.', tasks: [['Pick my top 3 for the week', W(1)], ['Clear overdue items or reschedule them honestly', W(1)], ['Chase anything waiting more than a week', W(1)]] },
    { id: 'month-end', name: 'Month-end close', space: 'work', desc: 'Bill, reconcile, tidy. First of every month.', tasks: [['Send invoices for last month', M()], ['Reconcile expenses', M()], ['Review subscriptions and licences', M()], ['Update each client’s status', M()]] },
    { id: 'new-parent', name: 'New parent survival', space: 'life', area: ['Family', '👶'], desc: 'The bare minimum that keeps the house running with a newborn.', tasks: [['Restock diapers and wipes', W(6)], ['Check formula / food supply', W(3)], ['Write down questions for the paediatrician', M()], ['Take 20 minutes for yourself', D], ['Say yes to someone’s offer of help', W(2)]] },
    { id: 'rebuild', name: 'Post-breakup rebuild', space: 'life', area: ['Me', '❤️'], desc: 'Small, steady things that add up. Be kind to yourself.', tasks: [['Call or text a friend', { unit: 'day', n: 3 }], ['Move your body for 20 minutes', D], ['Try one new thing', W(6)], ['Journal for 10 minutes', D], ['Plan a solo outing', W(5)]] },
    { id: 'spring-clean', name: 'Spring cleaning', space: 'life', area: ['Home', '🏠'], desc: 'Once a year, the deep clean.', tasks: [['Wash the windows', M(12)], ['Clean behind the fridge and stove', M(12)], ['Flip mattresses', M(12)], ['Sort the closets and donate', M(12)], ['Clean the outdoor furniture', M(12)]] },
  ];
  Cadence.registerPlugin({
    id: 'rituals', name: 'Rituals', version: '1.0.0', category: 'Life', spaces: ['work', 'life'],
    description: 'Install whole routines as bundles of repeating tasks: Sunday reset, Weekly review, Month-end close, New parent survival… Share your own as a small file.',
    tagline: 'Routines you can install and share', color: '#7c3aed',
    icon: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    setup(api) {
      const installed = () => api.storage.get('installed') || {};
      const nextDay = dow => { const d = new Date(); for (let i = 0; i < 7; i++) { const x = api.util.addDays(d, i); if (x.getDay() === dow) return api.util.ymd(x); } return api.util.todayKey(); };
      function install(b) {
        let clientId = null;
        if (b.area && api.space() === 'life') clientId = window.LifeKit ? window.LifeKit.area(api, b.area[0], b.area[1]) : null;
        const ids = b.tasks.map(([title, rep]) => { const r = { unit: rep.unit, n: rep.n || 1 }, due = rep.unit === 'week' && rep.day != null ? nextDay(rep.day) : rep.unit === 'month' ? (() => { const d = new Date(); return api.util.ymd(new Date(d.getFullYear(), d.getMonth() + (d.getDate() > 1 ? 1 : 0), 1)); })() : api.util.todayKey();
          return api.tasks.add({ title, repeat: r, dueDate: due, clientId, tags: ['ritual'], ritual: b.id, ...(clientId || !b.area ? {} : { lkArea: b.area[0] }) }).id; });
        api.storage.set('installed', { ...installed(), [b.id]: { name: b.name, at: Date.now(), ids } });
        api.ui.toast(`${b.name}: ${ids.length} repeating tasks added`); api.ui.refresh();
      }
      function uninstall(id) { const it = installed()[id]; if (!it) return; for (const tid of it.ids) { const t = api.tasks.get(tid); if (t && !t.done) api.tasks.remove(tid); }
        for (const t of api.tasks.list(x => x.ritual === id && !x.done)) api.tasks.remove(t.id); const m = { ...installed() }; delete m[id]; api.storage.set('installed', m); api.ui.toast('Ritual removed'); api.ui.refresh(); }
      const label = r => r.unit === 'day' ? (r.n > 1 ? `Every ${r.n} days` : 'Daily') : r.unit === 'week' ? `Weekly${r.day != null ? ' · ' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][r.day] : ''}` : r.n === 12 ? 'Yearly' : r.n > 1 ? `Every ${r.n} months` : 'Monthly';
      function exportBundle() {
        const tags = [...new Set(api.tasks.list(t => !t.done && t.repeat).flatMap(t => t.tags || []))], areas = api.clients.list();
        api.ui.modal('Share a ritual', `<p class="muted" style="margin:0 0 10px;font-size:13px">Pick which repeating tasks make up your ritual. You’ll get a small file to share.</p>
          <div class="field"><label>Name</label><input class="inp" id="rx-n" placeholder="My Friday shutdown"></div>
          <div class="field"><label>Which repeating tasks</label><select class="inp" id="rx-f"><option value="">All repeating tasks</option>${tags.map(t => `<option value="tag:${esc(t)}">Tagged #${esc(t)}</option>`).join('')}${areas.map(c => `<option value="c:${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></div>
          <textarea class="inp" id="rx-out" rows="8" readonly style="font:12px var(--mono,monospace)"></textarea>`, '<button class="btn" id="rx-copy">Copy</button><button class="btn primary" id="rx-dl">Download</button>');
        const $ = id => document.getElementById(id);
        const build = () => { const f = $('rx-f').value, ts = api.tasks.list(t => !t.done && t.repeat && (!f || (f.startsWith('tag:') ? (t.tags || []).includes(f.slice(4)) : t.clientId === f.slice(2))));
          const b = { cadenceRitual: 1, id: ($('rx-n').value.trim() || 'my-ritual').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40), name: $('rx-n').value.trim() || 'My ritual', space: api.space(), desc: '', tasks: ts.map(t => [t.title, { ...t.repeat, ...(t.repeat.unit === 'week' && t.dueDate ? { day: api.util.fromYmd(t.dueDate).getDay() } : {}) }]) };
          $('rx-out').value = JSON.stringify(b, null, 1); return b; };
        $('rx-n').oninput = build; $('rx-f').onchange = build; build();
        $('rx-copy').onclick = () => { api.ui.copy($('rx-out').value); api.ui.toast('Copied'); };
        $('rx-dl').onclick = () => { const b = build(), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(b, null, 1)], { type: 'application/json' })); a.download = b.id + '.ritual.json'; a.click(); };
      }
      function importBundle() {
        api.ui.modal('Install a shared ritual', `<div class="field"><label>Paste a ritual, or choose its file</label><textarea class="inp" id="ri-t" rows="8" style="font:12px var(--mono,monospace)" placeholder='{"cadenceRitual":1,"name":"…","tasks":[["Do the thing",{"unit":"week","n":1,"day":0}]]}'></textarea><input type="file" id="ri-f" accept=".json,application/json" style="margin-top:8px"></div><div id="ri-msg" class="muted" style="font-size:12px"></div>`, '<button class="btn primary" id="ri-go">Install</button>');
        const $ = id => document.getElementById(id);
        $('ri-f').onchange = async () => { const f = $('ri-f').files[0]; if (f) $('ri-t').value = await f.text(); };
        $('ri-go').onclick = () => { try { const b = JSON.parse($('ri-t').value); if (!b.cadenceRitual || !Array.isArray(b.tasks) || !b.tasks.length) throw new Error('That isn’t a Cadence ritual.');
          const clean = { id: 'shared-' + String(b.id || Date.now()).replace(/[^\w-]/g, '').slice(0, 40), name: String(b.name || 'Shared ritual').slice(0, 60), tasks: b.tasks.slice(0, 40).map(([t, r]) => [String(t).slice(0, 200), { unit: ['day', 'week', 'month', 'weekday'].includes(r && r.unit) ? r.unit : 'week', n: Math.max(1, Math.min(24, +(r && r.n) || 1)), ...(r && r.day != null ? { day: Math.max(0, Math.min(6, +r.day)) } : {}) }]) };
          api.ui.close(); install(clean); } catch (e) { $('ri-msg').textContent = e.message; } };
      }
      api.views.add({ id: 'rituals', title: 'Rituals', icon: '🔁', subtitle: 'Install a routine as a bundle of repeating tasks', render: el => {
        const inst = installed(), sp = api.space(), list = LIB.filter(b => b.space === 'any' || b.space === sp);
        el.innerHTML = `<div class="rt-bar"><button class="btn" id="rt-imp">${api.ui.icon('download')}Install from a file</button><button class="btn" id="rt-exp">${api.ui.icon('upload')}Share my own</button></div>
          <div class="rt-grid">${list.map(b => `<div class="rt-card ${inst[b.id] ? 'on' : ''}"><b>${esc(b.name)}</b><p>${esc(b.desc)}</p><ul>${b.tasks.map(([t, r]) => `<li>${esc(t)}<em>${label(r)}</em></li>`).join('')}</ul>${inst[b.id] ? `<button class="btn" data-un="${b.id}">Remove</button>` : `<button class="btn primary" data-in="${b.id}">Install</button>`}</div>`).join('')}
          ${Object.entries(inst).filter(([k]) => k.startsWith('shared-')).map(([k, v]) => `<div class="rt-card on"><b>${esc(v.name)}</b><p>Installed from a shared file.</p><button class="btn" data-un="${esc(k)}">Remove</button></div>`).join('')}</div>`;
        el.querySelectorAll('[data-in]').forEach(b => b.onclick = () => install(LIB.find(x => x.id === b.dataset.in)));
        el.querySelectorAll('[data-un]').forEach(b => b.onclick = () => uninstall(b.dataset.un));
        el.querySelector('#rt-imp').onclick = importBundle; el.querySelector('#rt-exp').onclick = exportBundle;
      } });
      window.__rituals = { install, uninstall, LIB };
      api.commands.add({ title: 'Rituals', hint: 'Install a routine', run: () => api.ui.navigate('view-rituals') });
      css('rt-css', `.rt-bar{display:flex;gap:8px;margin-bottom:14px}.rt-bar .btn{display:inline-flex;align-items:center;gap:6px}.rt-bar svg{width:15px;height:15px}
        .rt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}.rt-card{border:1px solid var(--line);border-radius:14px;padding:14px;background:var(--panel);display:flex;flex-direction:column;gap:6px}
        .rt-card.on{border-color:color-mix(in srgb,#7c3aed 45%,var(--line));background:color-mix(in srgb,#7c3aed 5%,var(--panel))}.rt-card p{margin:0;font-size:12.5px;color:var(--muted)}
        .rt-card ul{margin:4px 0 8px;padding:0;list-style:none;font-size:12.5px}.rt-card li{display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px dashed var(--line)}.rt-card li em{font-style:normal;color:var(--muted);white-space:nowrap}.rt-card .btn{align-self:flex-start;margin-top:auto}`);
    },
  });
})();
