/* Kids (Life): sizes, activities and registration deadlines, a memory jar, health records, chores with allowance,
   and birthday parties. One "Kids" page with a tab for each; everything is per child. */
(() => {
  const K = window.LifeKit; if (!K) return; const { esc, uid, form, today, daysUntil, addDays, fromYmd } = K;
  Cadence.registerPlugin({
    id: 'kids', name: 'Kids', version: '1.0.0', category: 'Life', spaces: ['life'],
    description: 'Per child: clothing and shoe sizes (with a nudge when the next size is probably due), activities with schedules, gear, carpools and registration deadlines, a memory jar, health records, chores with allowance, and birthday parties.',
    tagline: 'Sizes, activities, memories, health, chores', color: '#f472b6',
    icon: '<path d="M9 12h.01M15 12h.01M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/>',
    setup(api) {
      const get = k => api.storage.get(k) || [], set = (k, v) => { api.storage.set(k, v); api.ui.refresh(); };
      const kids = () => get('kids'), kid = id => kids().find(k => k.id === id);
      const age = k => k.born ? Math.floor((Date.now() - fromYmd(k.born)) / (365.25 * 864e5)) : null;
      const sel = () => api.storage.get('sel') || (kids()[0] && kids()[0].id), tab = () => api.storage.get('tab') || 'sizes';
      const famArea = () => K.area(api, 'Family', '👶');
      const addKid = (k) => form(api, k ? 'Edit child' : 'Add a child', [{ k: 'name', label: 'Name', req: true }, { k: 'born', label: 'Birthday', type: 'date' }], k, v => { set('kids', k ? kids().map(x => x.id === k.id ? { ...x, ...v } : x) : [...kids(), { id: uid(), ...v }]); if (!k) api.storage.set('sel', kids().slice(-1)[0].id); });
      // sizes: months each size usually lasts, by age
      const LAST = (kind, a) => kind === 'Shoes' ? (a < 3 ? 3 : a < 6 ? 4 : 6) : kind === 'Diapers' ? 3 : (a < 2 ? 3 : a < 6 ? 6 : 12);
      function sizes(k) {
        const rows = get('sizes').filter(s => s.kid === k.id), kinds = [...new Set(['Shoes', 'Clothes', ...rows.map(r => r.kind)])], a = age(k) ?? 5;
        return `${kinds.map(kind => { const h = rows.filter(r => r.kind === kind).sort((x, y) => y.at.localeCompare(x.at)), cur = h[0]; const next = cur ? addDays(cur.at, LAST(kind, a) * 30) : null, d = next ? daysUntil(next) : null;
          return K.card(esc(kind), cur ? `<div class="lk-row"><span class="grow">Size <b>${esc(cur.size)}</b> since ${esc(api.util.fmtDate(cur.at))}</span><em class="${d < 0 ? 'hot' : d < 30 ? 'soon' : ''}">${d < 0 ? 'Next size probably due now' : `Next size in ~${Math.max(1, Math.round(d / 30))} mo`}</em></div>${h.slice(1, 4).map(r => `<div class="lk-row"><span class="grow muted">${esc(r.size)}</span><em>${esc(api.util.fmtDate(r.at))}</em></div>`).join('')}` : K.empty('No size yet'), `<button class="lk-btn" data-size="${esc(kind)}">New size</button>`); }).join('')}
          <div class="lk-top"><button class="lk-btn" data-size="">Track something else</button><button class="lk-btn" id="kd-buy">Copy “what to buy” for grandparents</button></div>`;
      }
      function activities(k) {
        const acts = get('acts').filter(x => x.kid === k.id), DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return acts.map(x => { const d = x.reg ? daysUntil(x.reg) : null, rot = (x.carpool || '').split(',').map(s => s.trim()).filter(Boolean), wk = Math.floor(Date.now() / (7 * 864e5)), driver = rot.length ? rot[wk % rot.length] : '';
          return K.card(esc(x.name), `<div class="lk-row"><span class="grow">${x.day !== '' && x.day != null ? `${DAYS[+x.day]}s` : ''}${x.time ? ' at ' + esc(api.util.fmtTime(x.time)) : ''}${x.where ? ' · ' + esc(x.where) : ''}</span>${driver ? `<em>Driving this week: <b>${esc(driver)}</b></em>` : ''}</div>
            ${x.gear ? `<div class="lk-row"><span class="grow">Gear: ${esc(x.gear)}</span></div>` : ''}${x.reg ? `<div class="lk-row"><span class="grow">Registration ${d < 0 ? 'closed' : 'opens/closes'} ${esc(api.util.fmtDate(x.reg))}</span><em class="${d >= 0 && d < 14 ? 'hot' : ''}">${d >= 0 ? `in ${d} days` : ''}</em></div>` : ''}`,
            `<button class="lk-btn" data-act-ed="${esc(x.id)}">Edit</button>`); }).join('') + `<button class="lk-btn" data-act-ed="">Add an activity</button>`;
      }
      const editAct = (k, x) => form(api, x ? 'Edit activity' : 'New activity', [{ k: 'name', label: 'Activity', req: true, ph: 'Hockey' }, { k: 'day', label: 'Day', type: 'select', opts: [['', 'Varies'], ...['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => [i, d])] }, { k: 'time', label: 'Time', type: 'time' }, { k: 'where', label: 'Where' }, { k: 'gear', label: 'Gear to bring', ph: 'Skates, helmet, water bottle' }, { k: 'carpool', label: 'Carpool rotation (names, comma separated)', ph: 'Us, the Patels, the Kims' }, { k: 'reg', label: 'Registration deadline', type: 'date' }], x, v => {
        const all = get('acts'), id = x ? x.id : uid(); set('acts', x ? all.map(a => a.id === x.id ? { ...a, ...v } : a) : [...all, { id, kid: k.id, ...v }]);
        if (v.reg && daysUntil(v.reg) >= 0) { K.ownTask(api, 'reg:' + id, { title: `Register ${k.name} for ${v.name}`, dueDate: daysUntil(v.reg) > 7 ? addDays(v.reg, -7) : today(), notes: `Deadline ${v.reg}. Popular programs fill in minutes.`, clientId: famArea(), priority: 2 }); }
        if (v.day !== '' && v.day != null) K.ownTask(api, 'act:' + id, { title: `${k.name}: ${v.name}${v.gear ? ' (bring ' + v.gear + ')' : ''}`, dueDate: (() => { const d = new Date(); d.setDate(d.getDate() + ((+v.day - d.getDay() + 7) % 7)); return K.ymd(d); })(), dueTime: v.time || null, repeat: { unit: 'week', n: 1 }, clientId: famArea(), place: v.where || null });
      });
      function memories(k) {
        const m = get('mem').filter(x => x.kid === k.id).sort((a, b) => b.at.localeCompare(a.at)), years = [...new Set(m.map(x => x.at.slice(0, 4)))];
        return `<div class="lk-top"><input class="inp" id="kd-mem" placeholder="Something ${esc(k.name)} said or did today" style="flex:1"><select class="inp" id="kd-mt" style="width:auto"><option>Quote</option><option>First</option><option>Moment</option></select><button class="btn primary" id="kd-madd">Save</button></div>
          ${years.map(y => K.card(y, m.filter(x => x.at.startsWith(y)).map(x => `<div class="lk-row"><span class="lk-pill">${esc(x.type)}</span><span class="grow">${x.type === 'Quote' ? '“' + esc(x.text) + '”' : esc(x.text)}</span><em>${esc(api.util.fmtDate(x.at))}</em></div>`).join(''), `<button class="lk-btn" data-book="${y}">Make the ${y} book</button>`)).join('') || K.empty('The jar is empty. Funny quotes, firsts, little moments: one tap each.')}`;
      }
      function health(k) {
        const h = get('health').filter(x => x.kid === k.id).sort((a, b) => b.at.localeCompare(a.at)), allergies = h.filter(x => x.type === 'Allergy');
        return `${allergies.length ? `<div class="kd-alert">Allergies: ${allergies.map(a => esc(a.what)).join(', ')}</div>` : ''}<div class="lk-top"><button class="lk-btn" data-h="">Add a record</button><button class="lk-btn" id="kd-walkin">Copy a summary for a walk-in clinic</button></div>
          ${K.card('Records', h.map(x => `<div class="lk-row"><span class="lk-pill">${esc(x.type)}</span><span class="grow">${esc(x.what)}${x.notes ? ` <span class="muted">· ${esc(x.notes)}</span>` : ''}</span>${x.weight ? `<em>${esc(x.weight)}</em>` : ''}<em>${esc(api.util.fmtDate(x.at))}</em><button class="lk-x" data-hdel="${esc(x.id)}">${api.ui.icon('x')}</button></div>`).join('') || K.empty('Vaccines, visits, allergies, medicines with doses and weights.'))}`;
      }
      function chores(k) {
        const c = get('chores').filter(x => x.kid === k.id), log = get('chorelog').filter(x => x.kid === k.id), bal = log.filter(x => !x.paid).reduce((s, x) => s + (+x.pts || 0), 0), t0 = today();
        return `<div class="kd-bal"><b>${bal}</b><span>points to cash out${c.some(x => x.money) ? '' : ''}</span><button class="lk-btn" id="kd-pay" ${bal ? '' : 'disabled'}>Pay out</button></div>
          ${K.card('Chores', c.map(x => { const did = log.some(l => l.chore === x.id && l.day === t0); return `<div class="lk-row"><button class="lk-btn" data-do="${esc(x.id)}" ${did ? 'disabled' : ''}>${did ? 'Done today' : 'Did it'}</button><span class="grow">${esc(x.name)}</span><em>${x.pts} pt${x.pts == 1 ? '' : 's'} · ${esc(x.every)}</em><button class="lk-x" data-cdel="${esc(x.id)}">${api.ui.icon('x')}</button></div>`; }).join('') || K.empty('Age-appropriate jobs that earn points (or dollars).'), '<button class="lk-btn" data-chore>Add a chore</button>')}`;
      }
      function parties(k) {
        const ps = get('parties').filter(x => x.kid === k.id), inv = get('invited').filter(x => x.kid === k.id && x.date >= addDays(today(), -1));
        return ps.map(p => K.card(`${esc(k.name)}’s party · ${esc(api.util.fmtDate(p.date))}`, `${(p.guests || []).map((g, i) => `<div class="lk-row"><span class="grow">${esc(g.name)}</span><select class="inp" data-rsvp="${p.id}:${i}" style="width:auto;padding:2px 6px">${['?', 'Yes', 'No', 'Maybe'].map(o => `<option ${g.rsvp === o ? 'selected' : ''}>${o}</option>`).join('')}</select><input class="inp" data-gift="${p.id}:${i}" value="${esc(g.gift || '')}" placeholder="Gift received" style="width:170px;padding:2px 6px"><label class="muted" style="font-size:12px"><input type="checkbox" data-ty="${p.id}:${i}" ${g.ty ? 'checked' : ''}> Thank-you sent</label></div>`).join('')}
            <div class="lk-top" style="margin:8px 0 0"><input class="inp" data-gadd="${p.id}" placeholder="Add guests (comma separated)" style="flex:1"></div>`, `<em class="muted">${(p.guests || []).filter(g => g.rsvp === 'Yes').length} coming</em>`)).join('')
          + `<div class="lk-top"><button class="lk-btn" id="kd-party">Plan a party</button><button class="lk-btn" id="kd-inv">We’re invited to one</button></div>`
          + (inv.length ? K.card('Parties we’re invited to', inv.map(x => `<div class="lk-row"><span class="grow">${esc(x.who)}’s party</span><em>${esc(x.gift || 'Gift idea?')}</em><em>${esc(api.util.fmtDate(x.date))}</em></div>`).join('')) : '');
      }
      function view(el) {
        const ks = kids(); if (!ks.length) { el.innerHTML = `<div class="empty sm"><b>No kids added yet</b>Only names and birthdays.<br><button class="btn primary" id="kd-add">Add a child</button></div>`; el.querySelector('#kd-add').onclick = () => addKid(); return; }
        const k = kid(sel()) || ks[0], t = tab();
        el.innerHTML = `<div class="lk-top">${ks.map(x => `<button class="kd-kid ${x.id === k.id ? 'on' : ''}" data-kid="${esc(x.id)}">${esc(x.name)}${age(x) != null ? `<span>${age(x)}</span>` : ''}</button>`).join('')}<button class="lk-btn" id="kd-add">+</button><span class="sp"></span><button class="lk-btn" id="kd-edit">Edit ${esc(k.name)}</button></div>
          ${K.tabs([['sizes', 'Sizes'], ['acts', 'Activities'], ['mem', 'Memory jar'], ['health', 'Health'], ['chores', 'Chores'], ['party', 'Parties']], t)}<div id="kd-body">${({ sizes, acts: activities, mem: memories, health, chores, party: parties })[t](k)}</div>`;
        const $ = s => el.querySelector(s), all = s => el.querySelectorAll(s);
        all('[data-kid]').forEach(b => b.onclick = () => { api.storage.set('sel', b.dataset.kid); api.ui.refresh(); });
        all('[data-tab]').forEach(b => b.onclick = () => { api.storage.set('tab', b.dataset.tab); api.ui.refresh(); });
        $('#kd-add').onclick = () => addKid(); $('#kd-edit').onclick = () => addKid(k);
        all('[data-size]').forEach(b => b.onclick = () => form(api, 'New size', [{ k: 'kind', label: 'What', def: b.dataset.size || '', ph: 'Snowsuit', req: true }, { k: 'size', label: 'Size', req: true, ph: '11 / 4T / XL' }, { k: 'at', label: 'Since', type: 'date', def: today() }], null, v => set('sizes', [...get('sizes'), { id: uid(), kid: k.id, ...v }])));
        $('#kd-buy') && ($('#kd-buy').onclick = () => { const rows = get('sizes').filter(s => s.kid === k.id), by = {}; rows.sort((a, b) => b.at.localeCompare(a.at)).forEach(r => { if (!by[r.kind]) by[r.kind] = r; });
          api.ui.copy(`${k.name}'s sizes right now:\n` + Object.values(by).map(r => `- ${r.kind}: ${r.size}`).join('\n') + `\n\nIf in doubt, go one size up.`); api.ui.toast('Copied, ready to text'); });
        all('[data-act-ed]').forEach(b => b.onclick = () => editAct(k, get('acts').find(a => a.id === b.dataset.actEd)));
        $('#kd-madd') && ($('#kd-madd').onclick = () => { const v = $('#kd-mem').value.trim(); if (!v) return; set('mem', [...get('mem'), { id: uid(), kid: k.id, text: v, type: $('#kd-mt').value, at: today() }]); });
        all('[data-book]').forEach(b => b.onclick = () => { const y = b.dataset.book, m = get('mem').filter(x => x.kid === k.id && x.at.startsWith(y)).sort((a, b) => a.at.localeCompare(b.at));
          K.printable(`${k.name}, ${y}`, m.map(x => `<p>${x.type === 'Quote' ? '“' + esc(x.text) + '”' : esc(x.text)}<br><span class="m">${esc(api.util.fmtDate(x.at))} · ${esc(x.type)}</span></p>`).join('')); });
        all('[data-h]').forEach(b => b.onclick = () => form(api, 'Health record', [{ k: 'type', label: 'Type', type: 'select', opts: ['Visit', 'Vaccine', 'Allergy', 'Medicine', 'Measurement'].map(x => [x, x]) }, { k: 'what', label: 'What', req: true, ph: 'Amoxicillin 250mg, 5ml twice a day' }, { k: 'weight', label: 'Weight', ph: '18 kg' }, { k: 'at', label: 'Date', type: 'date', def: today() }, { k: 'notes', label: 'Notes' }], null, v => set('health', [...get('health'), { id: uid(), kid: k.id, ...v }])));
        all('[data-hdel]').forEach(b => b.onclick = () => set('health', get('health').filter(x => x.id !== b.dataset.hdel)));
        $('#kd-walkin') && ($('#kd-walkin').onclick = () => { const h = get('health').filter(x => x.kid === k.id).sort((a, b) => b.at.localeCompare(a.at)), w = h.find(x => x.weight);
          api.ui.copy(`${k.name}${k.born ? `, born ${k.born} (${age(k)})` : ''}\nAllergies: ${h.filter(x => x.type === 'Allergy').map(x => x.what).join(', ') || 'none known'}\nCurrent medicines: ${h.filter(x => x.type === 'Medicine').slice(0, 3).map(x => `${x.what} (${x.at})`).join('; ') || 'none'}\n${w ? `Weight: ${w.weight} on ${w.at}\n` : ''}Recent: ${h.filter(x => ['Visit', 'Vaccine'].includes(x.type)).slice(0, 4).map(x => `${x.type} ${x.what} (${x.at})`).join('; ')}`); api.ui.toast('Copied'); });
        all('[data-chore]').forEach(b => b.onclick = () => form(api, 'New chore', [{ k: 'name', label: 'Chore', req: true, ph: 'Feed the cat' }, { k: 'pts', label: 'Points (or dollars)', type: 'number', def: 1 }, { k: 'every', label: 'How often', type: 'select', opts: [['daily', 'Daily'], ['weekly', 'Weekly']] }], null, v => set('chores', [...get('chores'), { id: uid(), kid: k.id, ...v }])));
        all('[data-do]').forEach(b => b.onclick = () => { const c = get('chores').find(x => x.id === b.dataset.do); set('chorelog', [...get('chorelog'), { id: uid(), kid: k.id, chore: c.id, pts: c.pts, day: today() }]); api.ui.toast(`+${c.pts} for ${k.name}`); });
        all('[data-cdel]').forEach(b => b.onclick = () => set('chores', get('chores').filter(x => x.id !== b.dataset.cdel)));
        $('#kd-pay') && ($('#kd-pay').onclick = () => { set('chorelog', get('chorelog').map(x => x.kid === k.id ? { ...x, paid: true } : x)); api.ui.toast(`Paid out ${k.name}`); });
        $('#kd-party') && ($('#kd-party').onclick = () => form(api, `${k.name}’s party`, [{ k: 'date', label: 'Date', type: 'date', req: true }, { k: 'guests', label: 'Guests (comma separated)', type: 'textarea', rows: 3 }], null, v => { const p = { id: uid(), kid: k.id, date: v.date, guests: v.guests.split(/,|\n/).map(s => s.trim()).filter(Boolean).map(name => ({ name, rsvp: '?' })) }; set('parties', [...get('parties'), p]);
          K.ownTask(api, 'party:' + p.id, { title: `Send invitations for ${k.name}’s party`, dueDate: daysUntil(v.date) > 21 ? addDays(v.date, -21) : today(), clientId: famArea() }); }));
        $('#kd-inv') && ($('#kd-inv').onclick = () => form(api, 'Party invitation', [{ k: 'who', label: 'Whose party', req: true }, { k: 'date', label: 'Date', type: 'date', req: true }, { k: 'gift', label: 'Gift idea' }], null, v => { const x = { id: uid(), kid: k.id, ...v }; set('invited', [...get('invited'), x]);
          K.ownTask(api, 'inv:' + x.id, { title: `Get a gift for ${v.who}’s party${v.gift ? ': ' + v.gift : ''}`, dueDate: daysUntil(v.date) > 3 ? addDays(v.date, -3) : today(), clientId: famArea(), tags: ['gift'] }); }));
        const upd = (attr, fn) => all(`[${attr}]`).forEach(i => i.onchange = () => { const [pid, gi] = i.getAttribute(attr).split(':'); set('parties', get('parties').map(p => p.id === pid ? { ...p, guests: p.guests.map((g, j) => j === +gi ? fn(g, i) : g) } : p)); });
        upd('data-rsvp', (g, i) => ({ ...g, rsvp: i.value })); upd('data-gift', (g, i) => ({ ...g, gift: i.value })); upd('data-ty', (g, i) => ({ ...g, ty: i.checked }));
        all('[data-gadd]').forEach(i => i.onkeydown = e => { if (e.key !== 'Enter' || !i.value.trim()) return; const pid = i.dataset.gadd; set('parties', get('parties').map(p => p.id === pid ? { ...p, guests: [...p.guests, ...i.value.split(',').map(s => s.trim()).filter(Boolean).map(name => ({ name, rsvp: '?' }))] } : p)); });
      }
      // size nudges, once a week
      setTimeout(() => { const wk = Math.floor(Date.now() / (7 * 864e5)); if (api.storage.get('nudged') === wk) return; for (const k of kids()) { const rows = get('sizes').filter(s => s.kid === k.id), seen = {};
        for (const r of rows.sort((a, b) => b.at.localeCompare(a.at))) { if (seen[r.kind]) continue; seen[r.kind] = 1; if (daysUntil(addDays(r.at, LAST(r.kind, age(k) ?? 5) * 30)) < 0) { api.storage.set('nudged', wk); api.island.show({ icon: '👶', title: `${k.name} might need new ${r.kind.toLowerCase()}`, sub: `Size ${r.size} since ${api.util.fmtDate(r.at)}`, actions: [{ label: 'Open', run: () => api.ui.navigate('view-kids') }] }); return; } } } }, 15000);
      window.__kids = { today: () => { const dow = new Date().getDay(), wk = Math.floor(Date.now() / (7 * 864e5)); return (api.storage.get('acts') || []).filter(a => a.day !== '' && a.day != null && +a.day === dow).map(a => { const rot = (a.carpool || '').split(',').map(x => x.trim()).filter(Boolean); const k = kid(a.kid); return { kid: k ? k.name : '', name: a.name, time: a.time, where: a.where, driver: rot.length ? rot[wk % rot.length] : '' }; }); } };
      api.views.add({ id: 'kids', title: 'Kids', icon: '👶', subtitle: 'Sizes, activities, memories, health, chores and parties', render: view });
      K.css('kd-css', `.kd-kid{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:5px 12px;font:600 13px Inter,system-ui;cursor:pointer;color:var(--text);display:inline-flex;gap:6px;align-items:center}.kd-kid span{font-size:11px;color:var(--muted)}.kd-kid.on{background:#f472b6;border-color:#f472b6;color:#fff}.kd-kid.on span{color:#fff}
        .kd-alert{background:color-mix(in srgb,#e5484d 12%,var(--panel));border:1px solid color-mix(in srgb,#e5484d 40%,var(--line));color:#b42318;border-radius:var(--r);padding:8px 12px;font-weight:700;font-size:13px;margin-bottom:10px}
        .kd-bal{display:flex;align-items:center;gap:10px;margin-bottom:12px}.kd-bal b{font:900 34px/1 ui-rounded,system-ui;color:#f472b6}.kd-bal span{flex:1;color:var(--muted);font-size:13px}`);
    },
  });
})();
