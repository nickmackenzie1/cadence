/* Home life (Life space):
   - Partner: who carries which household jobs (mental load), date-night rotator, gift idea vault with occasions,
     a weekly check-in agenda, and the odd nudge for a small kindness.
   - Household: documents and renewals (passports, licences, insurance…), bills with a monthly "where did it go",
     and an emergency binder you can print.
   - Yourself: personal maintenance (physical, dentist, eyes, haircut), friendship keeper, protected solo time. */
(() => {
  const K = window.LifeKit; if (!K) return; const { esc, uid, form, today, daysUntil, addDays, ymd } = K;
  const nextDow = dow => { const d = new Date(); d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7)); return ymd(d); };

  /* ======================= Partner ======================= */
  const KIND = ['Leave a note in their bag', 'Make their coffee the way they like it', 'Take one of their chores without saying anything', 'Send a “thinking of you” text mid-day', 'Plan tonight so they don’t have to', 'Bring home their favourite snack', 'Tell them one specific thing they did well this week', 'Put the phone away for the whole evening'];
  Cadence.registerPlugin({
    id: 'partner', name: 'Partner', version: '1.0.0', category: 'Life', spaces: ['life'],
    description: 'Make the invisible work visible (who owns which household jobs), keep date night going, never lose a gift idea, and a 15-minute weekly check-in.',
    tagline: 'Mental load, dates, gifts, check-ins', color: '#e11d48',
    icon: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    setup(api) {
      const g = k => api.storage.get(k), s = (k, v) => { api.storage.set(k, v); api.ui.refresh(); };
      const cfg = () => Object.assign({ me: 'Me', them: 'Partner', dateEvery: 2, dateNext: null, planner: 'me', checkinDay: 0, kind: true }, g('cfg') || {});
      const area = () => K.area(api, 'Home', '🏠');
      function load(el) {
        const c = cfg(), rec = api.tasks.list(t => !t.done && t.repeat), who = t => t.who || 'me', w = { me: 0, them: 0, both: 0 };
        const weight = t => t.repeat.unit === 'day' ? 7 / (t.repeat.n || 1) : t.repeat.unit === 'weekday' ? 5 : t.repeat.unit === 'week' ? 1 / (t.repeat.n || 1) : .25 / (t.repeat.n || 1);
        rec.forEach(t => w[who(t)] += weight(t)); const tot = w.me + w.them + w.both || 1;
        return `${K.card('Who carries what', `<div class="lk-bar" style="margin:4px 0 6px"><i style="width:${w.me / tot * 100}%;background:#e11d48"></i><i style="width:${w.both / tot * 100}%;background:#a855f7"></i><i style="width:${w.them / tot * 100}%;background:#3b82f6"></i></div>
          <div class="muted" style="font-size:12px;margin-bottom:8px"><b style="color:#e11d48">${esc(c.me)} ${Math.round(w.me / tot * 100)}%</b> · <b style="color:#a855f7">Shared ${Math.round(w.both / tot * 100)}%</b> · <b style="color:#3b82f6">${esc(c.them)} ${Math.round(w.them / tot * 100)}%</b> (weighted by how often each job repeats)</div>
          ${rec.map(t => `<div class="lk-row"><span class="grow">${esc(t.title)}</span><em>${t.repeat.unit === 'day' ? 'daily' : t.repeat.unit + 'ly'}</em><select class="inp" data-who="${esc(t.id)}" style="width:auto;padding:2px 6px">${[['me', c.me], ['both', 'Shared'], ['them', c.them]].map(([v, l]) => `<option value="${v}" ${who(t) === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`).join('') || K.empty('Your repeating household tasks show up here, so you can see who owns what.')}`)}`;
      }
      function dates(el) {
        const c = cfg(), ideas = g('ideas') || [], hist = g('dates') || [];
        return K.card('Date night', `<div class="lk-row"><span class="grow">Next date night: <b>${c.dateNext ? esc(api.util.fmtDate(c.dateNext)) : 'not set'}</b>, planned by <b>${esc(c.planner === 'me' ? c.me : c.them)}</b></span><button class="lk-btn" id="pt-dset">Set</button>${c.dateNext ? '<button class="lk-btn" id="pt-ddone">We went!</button>' : ''}</div>
          <div class="lk-row"><span class="grow">Every</span><select class="inp" id="pt-every" style="width:auto">${[[1, 'week'], [2, '2 weeks'], [4, 'month']].map(([v, l]) => `<option value="${v}" ${c.dateEvery == v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`)
          + K.card('Idea list', `<div class="lk-top" style="margin:0 0 6px"><input class="inp" id="pt-idea" placeholder="Pottery class, that new ramen place…" style="flex:1"><button class="lk-btn" id="pt-iadd">Add</button><button class="lk-btn" id="pt-pick">Pick one for us</button></div>${ideas.map(i => `<div class="lk-row"><span class="grow">${esc(i.t)}</span><button class="lk-x" data-idel="${esc(i.id)}">${api.ui.icon('x')}</button></div>`).join('')}`)
          + (hist.length ? K.card('Past dates', hist.slice(0, 8).map(h => `<div class="lk-row"><span class="grow">${esc(h.what || 'Date night')}</span><em>${esc(api.util.fmtDate(h.at))}</em></div>`).join('')) : '');
      }
      function gifts() {
        const people = g('people') || [], vault = g('vault') || [];
        return `<div class="lk-top"><input class="inp" id="pt-gift" placeholder="“She loves that” — capture it in 2 seconds" style="flex:1"><select class="inp" id="pt-gp" style="width:auto">${people.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}<option value="">Someone else</option></select><button class="btn primary" id="pt-gadd">Save</button></div>`
          + people.map(p => K.card(esc(p.name), `${(p.occ || []).map(o => { const d = daysUntil(nextOcc(o.date)); return `<div class="lk-row"><span class="grow">${esc(o.what)}</span><em class="${d <= 14 ? 'hot' : ''}">${esc(api.util.fmtDate(nextOcc(o.date)))} · in ${d} days</em></div>`; }).join('')}${vault.filter(v => v.p === p.id).map(v => `<div class="lk-row"><span class="grow">${esc(v.t)}</span><em>${esc(api.util.fmtDate(v.at))}</em><button class="lk-x" data-vdel="${esc(v.id)}">${api.ui.icon('x')}</button></div>`).join('') || K.empty('No ideas yet')}`, `<button class="lk-btn" data-occ="${esc(p.id)}">Add a date</button>`)).join('')
          + `<button class="lk-btn" id="pt-padd">Add a person</button>`;
      }
      const nextOcc = d => { const [, m, dd] = d.split('-'), y = new Date().getFullYear(), x = `${y}-${m}-${dd}`; return x >= today() ? x : `${y + 1}-${m}-${dd}`; };
      function checkin() {
        const c = cfg(), notes = g('checkins') || [], DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return K.card(`Weekly check-in · ${DAYS[c.checkinDay]}s, 15 minutes`, `<div class="pt-agenda">${[['sched', 'This week’s schedule (who’s where, who drives)'], ['money', 'Money: anything coming up?'], ['bug', 'Anything bugging either of you?'], ['thanks', 'One appreciation each']].map(([k, l]) => `<label>${esc(l)}<textarea class="inp" data-ci="${k}" rows="2"></textarea></label>`).join('')}</div><button class="btn primary" id="pt-cisave" style="margin-top:8px">Save this week’s check-in</button>`,
          `<select class="inp" id="pt-cid" style="width:auto">${DAYS.map((d, i) => `<option value="${i}" ${c.checkinDay == i ? 'selected' : ''}>${d}</option>`).join('')}</select>`)
          + (notes.length ? K.card('Past check-ins', notes.slice(0, 6).map(n => `<div class="lk-row"><span class="grow">${esc(Object.values(n.a).filter(Boolean).join(' · ').slice(0, 160))}</span><em>${esc(api.util.fmtDate(n.at))}</em></div>`).join('')) : '');
      }
      function view(el) {
        const t = api.storage.get('tab') || 'load', c = cfg();
        el.innerHTML = `<div class="lk-top">${K.tabs([['load', 'Mental load'], ['dates', 'Date night'], ['gifts', 'Gift ideas'], ['checkin', 'Check-in']], t)}<span class="sp"></span><button class="lk-btn" id="pt-names">${esc(c.me)} & ${esc(c.them)}</button></div><div>${({ load, dates, gifts, checkin })[t](el)}</div>`;
        const $ = q => el.querySelector(q), all = q => el.querySelectorAll(q), save = p => s('cfg', { ...cfg(), ...p });
        all('[data-tab]').forEach(b => b.onclick = () => { api.storage.set('tab', b.dataset.tab); api.ui.refresh(); });
        $('#pt-names').onclick = () => form(api, 'Names', [{ k: 'me', label: 'You' }, { k: 'them', label: 'Your partner' }], c, v => save(v));
        all('[data-who]').forEach(x => x.onchange = () => api.tasks.update(x.dataset.who, { who: x.value }));
        $('#pt-dset') && ($('#pt-dset').onclick = () => form(api, 'Next date night', [{ k: 'dateNext', label: 'Date', type: 'date', def: nextDow(5) }, { k: 'planner', label: 'Who plans it', type: 'select', opts: [['me', c.me], ['them', c.them]] }], c, v => { save(v); sched(v.dateNext, v.planner); }));
        $('#pt-ddone') && ($('#pt-ddone').onclick = () => { api.ui.ask('Date night done', [{ k: 'what', label: 'What did you do? (for the history)', ph: 'Ramen and a movie' }]).then(v => { if (!v) return; const what = v.what || ''; api.storage.set('dates', [{ at: c.dateNext, what }, ...(g('dates') || [])]); const nx = addDays(c.dateNext, 7 * c.dateEvery), pl = c.planner === 'me' ? 'them' : 'me'; save({ dateNext: nx, planner: pl }); sched(nx, pl); }); });
        $('#pt-every') && ($('#pt-every').onchange = e => save({ dateEvery: +e.target.value }));
        $('#pt-iadd') && ($('#pt-iadd').onclick = () => { const v = $('#pt-idea').value.trim(); if (v) s('ideas', [...(g('ideas') || []), { id: uid(), t: v }]); });
        $('#pt-pick') && ($('#pt-pick').onclick = () => { const i = g('ideas') || []; api.ui.toast(i.length ? `How about: ${i[Math.floor(Math.random() * i.length)].t}` : 'Add a few ideas first'); });
        all('[data-idel]').forEach(b => b.onclick = () => s('ideas', (g('ideas') || []).filter(i => i.id !== b.dataset.idel)));
        $('#pt-padd') && ($('#pt-padd').onclick = () => form(api, 'Add a person', [{ k: 'name', label: 'Name', req: true }, { k: 'bday', label: 'Birthday', type: 'date' }], null, v => { const p = { id: uid(), name: v.name, occ: v.bday ? [{ what: 'Birthday', date: v.bday }] : [] }; s('people', [...(g('people') || []), p]); remind(p); }));
        all('[data-occ]').forEach(b => b.onclick = () => form(api, 'Add a date', [{ k: 'what', label: 'Occasion', req: true, ph: 'Anniversary, Mother’s Day…' }, { k: 'date', label: 'Date', type: 'date', req: true }], null, v => { const ps = (g('people') || []).map(p => p.id === b.dataset.occ ? { ...p, occ: [...(p.occ || []), v] } : p); s('people', ps); remind(ps.find(p => p.id === b.dataset.occ)); }));
        $('#pt-gadd') && ($('#pt-gadd').onclick = () => { const v = $('#pt-gift').value.trim(); if (v) s('vault', [{ id: uid(), t: v, p: $('#pt-gp').value, at: today() }, ...(g('vault') || [])]); });
        all('[data-vdel]').forEach(b => b.onclick = () => s('vault', (g('vault') || []).filter(v => v.id !== b.dataset.vdel)));
        $('#pt-cid') && ($('#pt-cid').onchange = e => { save({ checkinDay: +e.target.value }); K.ownTask(api, 'checkin', { title: 'Weekly check-in with ' + c.them, dueDate: nextDow(+e.target.value), dueTime: '20:00', repeat: { unit: 'week', n: 1 }, clientId: area() }); });
        $('#pt-cisave') && ($('#pt-cisave').onclick = () => { const a = {}; all('[data-ci]').forEach(x => a[x.dataset.ci] = x.value.trim()); s('checkins', [{ at: today(), a }, ...(g('checkins') || [])].slice(0, 52)); api.ui.toast('Saved'); });
      }
      function sched(day, planner) { const c = cfg(); K.ownTask(api, 'date', { title: `Date night (${planner === 'me' ? 'you plan it' : c.them + ' plans it'})`, dueDate: day, clientId: area() }); K.ownTask(api, 'sitter', { title: 'Book the babysitter for date night', dueDate: daysUntil(day) > 7 ? addDays(day, -7) : today(), clientId: area() }); }
      function remind(p) { for (const o of p.occ || []) { const d = nextOcc(o.date); K.ownTask(api, `gift:${p.id}:${o.what}`, { title: `${o.what} for ${p.name} in 2 weeks: sort a gift`, dueDate: daysUntil(d) > 14 ? addDays(d, -14) : today(), tags: ['gift'], notes: (g('vault') || []).filter(v => v.p === p.id).map(v => '- ' + v.t).join('\n') }); } }
      // the odd small-kindness nudge (about twice a week, never in the morning rush)
      setTimeout(() => { const c = cfg(); if (!c.kind) return; const last = +(localStorage.getItem('cadence.kind') || 0), h = new Date().getHours(); if (Date.now() - last < 3 * 864e5 || h < 11 || h > 20 || Math.random() > .5) return; localStorage.setItem('cadence.kind', Date.now());
        api.island.show({ icon: '❤️', color: '#e11d48', title: 'A little thing', sub: KIND[Math.floor(Math.random() * KIND.length)], log: false, ms: 9000 }); }, 25000);
      window.__partner = { remind, nextOcc };
      api.views.add({ id: 'partner', title: 'Partner', icon: '❤️', subtitle: 'Mental load, date night, gift ideas, weekly check-in', render: view });
      api.commands.add({ title: 'Save a gift idea', run: () => { api.storage.set('tab', 'gifts'); api.ui.navigate('view-partner'); setTimeout(() => document.getElementById('pt-gift') && document.getElementById('pt-gift').focus(), 100); } });
      K.css('pt-css', `.pt-agenda{display:grid;grid-template-columns:1fr 1fr;gap:8px}.pt-agenda label{font-size:12.5px;color:var(--muted);display:flex;flex-direction:column;gap:4px}`);
    },
  });

  /* ======================= Household ======================= */
  const DOCS = [['Passport', 1825, 180], ['Child’s passport', 1825, 180], ['Driver’s licence', 1825, 60], ['Health card', 1825, 60], ['Car insurance', 365, 30], ['Home insurance', 365, 30], ['Car registration', 365, 30], ['Subscription', 365, 14], ['Other', 365, 30]];
  Cadence.registerPlugin({
    id: 'household', name: 'Household', version: '1.0.0', category: 'Life', spaces: ['life'],
    description: 'Documents and renewals with reminders well ahead (passports 6 months out), recurring bills with a monthly “where did the money go”, and an emergency binder you can print.',
    tagline: 'Renewals, bills, emergency binder', color: '#0d9488',
    icon: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>',
    setup(api) {
      const g = k => api.storage.get(k) || [], s = (k, v) => { api.storage.set(k, v); api.ui.refresh(); };
      const area = () => K.area(api, 'Money', '💰');
      function docs() {
        const d = g('docs').slice().sort((a, b) => (a.exp || '9').localeCompare(b.exp || '9'));
        return K.card('Documents and renewals', d.map(x => { const n = x.exp ? daysUntil(x.exp) : null; return `<div class="lk-row"><span class="lk-pill">${esc(x.kind)}</span><span class="grow">${esc(x.who || '')}${x.note ? ` <span class="muted">· ${esc(x.note)}</span>` : ''}</span><em class="${n != null && n < 0 ? 'hot' : n != null && n <= x.lead ? 'soon' : ''}">${x.exp ? (n < 0 ? 'Expired ' : 'Expires ') + esc(api.util.fmtDate(x.exp)) : ''}</em><button class="lk-x" data-ddel="${esc(x.id)}">${api.ui.icon('x')}</button></div>`; }).join('') || K.empty('Passports, licences, health cards, insurance, subscriptions.'), '<button class="lk-btn" id="hh-dadd">Add</button>');
      }
      function bills() {
        const b = g('bills'), tot = b.reduce((x, y) => x + (+y.amt || 0), 0), cats = {}; b.forEach(x => cats[x.cat || 'Other'] = (cats[x.cat || 'Other'] || 0) + (+x.amt || 0));
        const review = (api.storage.get('reviews') || [])[0];
        return K.card(`Recurring bills · $${tot.toLocaleString()} a month`, `${Object.keys(cats).length ? `<div class="lk-bar" style="margin:4px 0 8px">${Object.entries(cats).map(([c, v], i) => `<i title="${esc(c)} $${v}" style="width:${v / tot * 100}%;background:hsl(${i * 67 % 360} 60% 55%)"></i>`).join('')}</div><div class="muted" style="font-size:12px;margin-bottom:6px">${Object.entries(cats).map(([c, v]) => `${esc(c)} $${v.toLocaleString()}`).join(' · ')}</div>` : ''}
          ${b.map(x => `<div class="lk-row"><span class="grow">${esc(x.name)}${x.auto ? ' <span class="lk-pill">autopay</span>' : ''}</span><em>$${(+x.amt || 0).toLocaleString()}</em><em>due the ${esc(x.day)}${['th', 'st', 'nd', 'rd'][(x.day % 10 > 3 || ~~(x.day / 10) === 1) ? 0 : x.day % 10] || 'th'}</em><button class="lk-x" data-bdel="${esc(x.id)}">${api.ui.icon('x')}</button></div>`).join('') || K.empty('Hydro, phone, internet, mortgage…')}`, '<button class="lk-btn" id="hh-badd">Add a bill</button>')
          + K.card('Monthly money review (for two)', `${review ? `<div class="lk-row"><span class="grow">Last review: ${esc(review.note.slice(0, 140))}</span><em>${esc(api.util.fmtDate(review.at))}</em></div>` : ''}<textarea class="inp" id="hh-rev" rows="3" placeholder="Where did the money go this month? Anything to change?"></textarea><button class="btn" id="hh-rsave" style="margin-top:6px">Save this month’s review</button>`);
      }
      function binder() {
        const b = Object.assign({ contacts: '', papers: '', accounts: '', steps: '' }, api.storage.get('binder') || {});
        return K.card('Emergency binder', `<p class="muted" style="font-size:12.5px;margin:0 0 8px">What someone would need if one of you is out of commission. Don’t put passwords here; say where they’re kept.</p>
          ${[['contacts', 'Who to call (doctor, lawyer, accountant, employer, neighbours)'], ['papers', 'Where the papers are (will, insurance, deeds, birth certificates)'], ['accounts', 'Accounts and bills (bank, utilities, where passwords are kept)'], ['steps', 'What to do first']].map(([k, l]) => `<div class="field"><label>${esc(l)}</label><textarea class="inp" data-bd="${k}" rows="3">${esc(b[k])}</textarea></div>`).join('')}
          <div class="lk-top"><button class="btn primary" id="hh-bsave">Save</button><button class="btn" id="hh-bprint">Print it</button></div>`);
      }
      function view(el) {
        const t = api.storage.get('tab') || 'docs';
        el.innerHTML = K.tabs([['docs', 'Documents'], ['bills', 'Bills'], ['binder', 'Emergency binder']], t) + ({ docs, bills, binder })[t]();
        const $ = q => el.querySelector(q), all = q => el.querySelectorAll(q);
        all('[data-tab]').forEach(b => b.onclick = () => { api.storage.set('tab', b.dataset.tab); api.ui.refresh(); });
        $('#hh-dadd') && ($('#hh-dadd').onclick = () => form(api, 'Document or renewal', [{ k: 'kind', label: 'What', type: 'select', opts: DOCS.map(([d]) => [d, d]) }, { k: 'who', label: 'Whose', ph: 'Nick' }, { k: 'exp', label: 'Expires', type: 'date', req: true }, { k: 'note', label: 'Note', ph: 'Number ends 4421, in the blue folder' }], null, v => {
          const lead = (DOCS.find(d => d[0] === v.kind) || DOCS[8])[2], x = { id: uid(), ...v, lead }; s('docs', [...g('docs'), x]);
          K.ownTask(api, 'doc:' + x.id, { title: `Renew ${v.who ? v.who + '’s ' : ''}${v.kind.toLowerCase()}`, dueDate: daysUntil(v.exp) > lead ? addDays(v.exp, -lead) : today(), notes: `Expires ${v.exp}. ${v.note || ''}`, clientId: area() }); }));
        all('[data-ddel]').forEach(b => b.onclick = () => { K.dropTask(api, 'doc:' + b.dataset.ddel); s('docs', g('docs').filter(x => x.id !== b.dataset.ddel)); });
        $('#hh-badd') && ($('#hh-badd').onclick = () => form(api, 'Recurring bill', [{ k: 'name', label: 'Bill', req: true, ph: 'Hydro' }, { k: 'amt', label: 'About how much', type: 'number' }, { k: 'day', label: 'Due day of the month', type: 'number', def: 1 }, { k: 'cat', label: 'Category', type: 'select', opts: ['Home', 'Utilities', 'Phone & internet', 'Car', 'Insurance', 'Kids', 'Subscriptions', 'Other'].map(x => [x, x]) }, { k: 'auto', label: 'Autopay (just a heads-up, no task)', type: 'check' }], null, v => {
          const x = { id: uid(), ...v, day: Math.max(1, Math.min(28, +v.day || 1)) }; s('bills', [...g('bills'), x]); const d = new Date(), due = new Date(d.getFullYear(), d.getMonth() + (d.getDate() > x.day ? 1 : 0), x.day);
          K.ownTask(api, 'bill:' + x.id, { title: `${v.auto ? 'Check' : 'Pay'} ${v.name}${v.amt ? ' (~$' + v.amt + ')' : ''}`, dueDate: ymd(due), repeat: { unit: 'month', n: 1 }, clientId: area(), tags: ['bills'] }); }));
        all('[data-bdel]').forEach(b => { b.onclick = () => { K.dropTask(api, 'bill:' + b.dataset.bdel); s('bills', g('bills').filter(x => x.id !== b.dataset.bdel)); }; });
        $('#hh-rsave') && ($('#hh-rsave').onclick = () => { const v = $('#hh-rev').value.trim(); if (v) s('reviews', [{ at: today(), note: v }, ...g('reviews')].slice(0, 24)); });
        const read = () => { const b = {}; all('[data-bd]').forEach(x => b[x.dataset.bd] = x.value); return b; };
        $('#hh-bsave') && ($('#hh-bsave').onclick = () => { api.storage.set('binder', read()); api.ui.toast('Saved'); });
        $('#hh-bprint') && ($('#hh-bprint').onclick = () => { const b = read(); K.printable('Emergency binder', [['Who to call', 'contacts'], ['Where the papers are', 'papers'], ['Accounts and bills', 'accounts'], ['What to do first', 'steps']].map(([h, k]) => `<h2>${h}</h2><p>${esc(b[k]).replace(/\n/g, '<br>')}</p>`).join('') + `<p class="m">Printed ${new Date().toLocaleDateString()}</p>`); });
      }
      // first of the month: the money review
      setTimeout(() => { const d = new Date(), k = d.getFullYear() + '-' + d.getMonth(); if (d.getDate() > 3 || api.storage.get('revAsk') === k || !g('bills').length) return; api.storage.set('revAsk', k); K.ownTask(api, 'review:' + k, { title: 'Monthly money review together (15 min)', dueDate: today(), clientId: area() }); }, 9000);
      api.views.add({ id: 'household', title: 'Household', icon: '🗂️', subtitle: 'Renewals, bills and the emergency binder', render: view });
    },
  });

  /* ======================= Yourself ======================= */
  const MAINT = [['Annual physical', 12], ['Dentist cleaning', 6], ['Eye exam', 24], ['Haircut', 1.5], ['Skin check', 12], ['Blood donation', 2]];
  Cadence.registerPlugin({
    id: 'yourself', name: 'Yourself', version: '1.0.0', category: 'Wellbeing', spaces: ['life'],
    description: 'Your own maintenance (physical, dentist, eyes, haircut) on repeat, a friendship keeper that nudges you to see people, and protected solo time for each parent on a rotation.',
    tagline: 'Maintenance, friends, solo time', color: '#0ea5e9',
    icon: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    setup(api) {
      const g = k => api.storage.get(k) || [], s = (k, v) => { api.storage.set(k, v); api.ui.refresh(); };
      const area = () => K.area(api, 'Health', '💚');
      function view(el) {
        const t = api.storage.get('tab') || 'maint', fr = g('friends').slice().sort((a, b) => due(a) - due(b)), solo = Object.assign({ a: 'Me', b: 'Partner', day: 6, on: false }, api.storage.get('solo') || {});
        const mt = api.tasks.list(x => x.lk && x.lk.startsWith('self:') && !x.done);
        el.innerHTML = K.tabs([['maint', 'Maintenance'], ['friends', 'Friends'], ['solo', 'Solo time']], t) + (t === 'maint' ? K.card('Keep yourself serviced', MAINT.map(([n, mo]) => { const x = mt.find(y => y.lk === 'self:' + n); return `<div class="lk-row"><span class="grow">${esc(n)}</span><em>every ${mo < 2 ? Math.round(mo * 4.3) + ' weeks' : mo + ' months'}</em>${x ? `<em>next ${esc(api.util.fmtDate(x.dueDate))}</em><button class="lk-btn" data-moff="${esc(n)}">Stop</button>` : `<button class="lk-btn" data-mon="${esc(n)}">Track</button>`}</div>`; }).join(''))
          : t === 'friends' ? `<div class="lk-top"><button class="lk-btn" id="yf-add">Add a friend</button></div>` + K.card('Friendship keeper', fr.map(f => { const d = due(f); return `<div class="lk-row"><span class="grow"><b>${esc(f.name)}</b> <span class="muted">every ${f.every} weeks</span></span><em class="${d < 0 ? 'hot' : d < 7 ? 'soon' : ''}">${f.last ? 'last seen ' + esc(api.util.fmtDate(f.last)) : 'not seen yet'}</em><button class="lk-btn" data-seen="${esc(f.id)}">Saw them</button><button class="lk-x" data-fdel="${esc(f.id)}">${api.ui.icon('x')}</button></div>`; }).join('') || K.empty('Who do you want to see more often?'))
          : K.card('Protected solo time', `<p class="muted" style="font-size:12.5px;margin:0 0 8px">A block of alone time each week, alternating between the two of you.</p><div class="lk-row"><span class="grow">${esc(solo.a)} and ${esc(solo.b)}, on ${['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][solo.day]}</span><button class="lk-btn" id="ys-set">${solo.on ? 'Change' : 'Set it up'}</button></div>${solo.on ? `<div class="lk-row"><span class="grow">This week it’s <b>${esc(soloWho(solo))}</b>’s turn</span></div>` : ''}`));
        const all = q => el.querySelectorAll(q), $ = q => el.querySelector(q);
        all('[data-tab]').forEach(b => b.onclick = () => { api.storage.set('tab', b.dataset.tab); api.ui.refresh(); });
        all('[data-mon]').forEach(b => b.onclick = () => { const [n, mo] = MAINT.find(m => m[0] === b.dataset.mon); form(api, n, [{ k: 'last', label: 'When was the last one? (roughly)', type: 'date' }], null, v => { const next = v.last ? addDays(v.last, Math.round(mo * 30.4)) : today();
          K.ownTask(api, 'self:' + n, { title: `Book: ${n.toLowerCase()}`, dueDate: next < today() ? today() : next, repeat: mo < 2 ? { unit: 'week', n: Math.round(mo * 4.3) } : { unit: 'month', n: mo }, clientId: area() }); api.ui.refresh(); }); });
        all('[data-moff]').forEach(b => b.onclick = () => { K.dropTask(api, 'self:' + b.dataset.moff); api.ui.refresh(); });
        $('#yf-add') && ($('#yf-add').onclick = () => form(api, 'A friend to keep close', [{ k: 'name', label: 'Name', req: true }, { k: 'every', label: 'See them every … weeks', type: 'number', def: 4 }, { k: 'last', label: 'Last saw them', type: 'date' }], null, v => s('friends', [...g('friends'), { id: uid(), ...v, every: Math.max(1, +v.every || 4) }])));
        all('[data-seen]').forEach(b => b.onclick = () => { s('friends', g('friends').map(f => f.id === b.dataset.seen ? { ...f, last: today() } : f)); K.dropTask(api, 'friend:' + b.dataset.seen); });
        all('[data-fdel]').forEach(b => b.onclick = () => s('friends', g('friends').filter(f => f.id !== b.dataset.fdel)));
        $('#ys-set') && ($('#ys-set').onclick = () => form(api, 'Solo time', [{ k: 'a', label: 'One of you' }, { k: 'b', label: 'The other' }, { k: 'day', label: 'Day', type: 'select', opts: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => [i, d]) }], solo, v => { const x = { ...v, day: +v.day, on: true }; api.storage.set('solo', x); soloTask(x); api.ui.refresh(); }));
      }
      const due = f => f.last ? daysUntil(addDays(f.last, f.every * 7)) : -1;
      const soloWho = x => Math.floor(Date.now() / (7 * 864e5)) % 2 ? x.b : x.a;
      const soloTask = x => K.ownTask(api, 'solo', { title: `Solo time: ${soloWho(x)} (protected, 3 hours)`, dueDate: nextDow(x.day), clientId: area() });
      // nudges: friends overdue get a task; solo time task renamed each week
      setTimeout(() => { for (const f of g('friends')) if (due(f) < 0) K.ownTask(api, 'friend:' + f.id, { title: `See ${f.name} (it’s been a while)`, dueDate: today(), tags: ['friends'] }); const x = api.storage.get('solo'); if (x && x.on) soloTask(x); }, 10000);
      api.views.add({ id: 'yourself', title: 'Yourself', icon: '💚', subtitle: 'Maintenance, friends, solo time', render: view });
    },
  });
})();
