/* Camping planner (Life). One trip is the hub: the route sets the days, the days set the menu, the menu and the
   weather build the packing list, and the journal feeds the trip report and next trip's lists. */
(() => {
  const K = window.LifeKit; if (!K) return; const { esc, uid, form, today, daysUntil, addDays, ymd, fromYmd } = K;
  const TYPES = [['car', 'Car camping'], ['canoe', 'Canoe trip'], ['backpacking', 'Backpacking'], ['rv', 'RV / trailer']];
  const BASE = {
    all: ['Tent + footprint', 'Sleeping bags', 'Sleeping pads', 'Headlamps + spare batteries', 'First-aid kit', 'Sunscreen', 'Bug spray', 'Lighter + matches', 'Water bottles', 'Toilet paper + trowel', 'Garbage bags', 'Map / offline maps', 'Phone charger / battery pack', 'Multi-tool / knife', 'Rope / paracord'],
    car: ['Cooler + ice', 'Camp stove + fuel', 'Pots, pans, utensils', 'Plates, cups, cutlery', 'Dish tub + soap', 'Camp chairs', 'Lantern', 'Tarp + poles', 'Firewood (buy local)', 'Axe or saw', 'Table cloth'],
    canoe: ['Canoe + paddles (+ spare)', 'PFDs for everyone', 'Bailer + throw rope + whistle', 'Dry bags / barrel', 'Portage pack', 'Water filter', 'Bear rope / barrel', 'Small stove + fuel', 'Pot + mugs', 'Lightweight tarp'],
    backpacking: ['Backpack + rain cover', 'Water filter', 'Bear canister / rope', 'Small stove + fuel', 'Pot + spork', 'Trekking poles', 'Lightweight tarp', 'Blister kit'],
    rv: ['Water hose + pressure regulator', 'Sewer hose + gloves', 'Leveling blocks', 'Wheel chocks', 'Power adapter (30/50A)', 'Camp chairs', 'Outdoor mat'],
    person: ['Rain jacket', 'Warm layer (fleece)', 'Quick-dry pants', 'Shorts', 'T-shirts', 'Socks (+1 pair)', 'Underwear', 'Sleepwear', 'Hat', 'Camp shoes', 'Toothbrush + toiletries'],
    kid: ['Extra change of clothes', 'Comfort toy', 'Rain boots', 'Small backpack', 'Kid headlamp', 'Card games / colouring'],
    dog: ['Dog food + bowls', 'Leash + long line', 'Poop bags', 'Dog bed / blanket', 'Vaccination record', 'Towel'],
    cold: ['Toque', 'Gloves', 'Warmer sleeping bag (rated −5°C or lower)', 'Long underwear', 'Hot-water bottle trick (Nalgene)'],
    rain: ['Extra tarp', 'Rain pants', 'Dry bags for clothes', 'Extra socks', 'Card games for the tent'],
    leave: ['Fire is dead out (cold to the touch)', 'All garbage packed out', 'Nothing left on the site', 'Tent pegs counted', 'Water and electrical disconnected (RV)', 'Check under the picnic table'],
    bear: ['Food hung 4 m up and 2 m out, or in a barrel', 'Cook 50 m downwind from the tent', 'No food or toiletries in the tent', 'Bear spray within reach'],
    permits: ['Campsite reservation / permit printed', 'Fire ban checked', 'Park alerts checked', 'Vehicle permit on the dash', 'Fishing licence'],
  };
  const GEAR = [[/pancake/i, ['Griddle', 'Spatula', 'Syrup']], [/burger|steak|grill/i, ['Grill grate', 'Tongs', 'Spatula']], [/hot ?dog|smore|s'more|marshmallow/i, ['Roasting sticks']], [/chili|stew|soup|pasta|mac/i, ['Big pot', 'Ladle']], [/foil|packet/i, ['Heavy-duty foil']], [/coffee/i, ['Coffee press or pour-over', 'Kettle']], [/egg|bacon/i, ['Frying pan', 'Spatula']], [/taco|wrap/i, ['Cutting board', 'Knife']], [/oat|porridge/i, ['Pot', 'Bowls']]];
  const PERISH = /chicken|beef|burger|steak|fish|pork|sausage|milk|cream|yogurt/i;
  const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

  Cadence.registerPlugin({
    id: 'camping', name: 'Camping planner', version: '1.0.0', category: 'Life', spaces: ['life'],
    description: 'Plan a camping trip end to end: setup with forecast and booking-window nudges, packing lists built from trip type, people, weather and menu, a route with daily distances and a leave-behind plan, a meal grid, and a journal that turns into a trip report and smarter lists next time.',
    tagline: 'Route, menu, packing, journal', color: '#15803d',
    icon: '<path d="M3.5 21 14 3M20.5 21 10 3M15.5 21 12 15l-3.5 6M2 21h20"/>',
    setup(api) {
      const g = k => api.storage.get(k) || (k === 'learn' ? { skip: [], add: [], notes: [] } : []);
      const trips = () => g('trips'), trip = id => trips().find(t => t.id === id), upd = (id, p) => { api.storage.set('trips', trips().map(t => t.id === id ? { ...t, ...p } : t)); api.ui.refresh(); };
      const days = t => { const n = Math.max(1, daysUntil(t.end) - daysUntil(t.start) + 1); return Array.from({ length: n }, (_, i) => addDays(t.start, i)); };
      function packList(t) {
        const L = g('learn'), wx = t.wx || {}, out = [], add = (sec, items) => items.forEach(it => { if (!L.skip.includes(it)) out.push({ sec, it }); });
        add('Shared gear', [...BASE.all, ...BASE[t.type] || [], ...L.add]);
        (t.adults || []).forEach(p => add(p, BASE.person)); (t.kids || []).forEach(p => add(p, [...BASE.person, ...BASE.kid]));
        if (t.dog) add('Dog', BASE.dog); if (wx.cold) add('Weather: cold nights', BASE.cold); if (wx.rain) add('Weather: rain', BASE.rain);
        const meals = Object.values(t.menu || {}).flatMap(d => Object.values(d)).join(' '); add('For the menu', [...new Set(GEAR.filter(([re]) => re.test(meals)).flatMap(([, g2]) => g2))]);
        if (t.type === 'canoe' || t.type === 'backpacking') add('Bear safety', BASE.bear);
        add('Permits & checks', BASE.permits);
        return out;
      }
      const tabs = [['setup', 'Setup'], ['pack', 'Packing'], ['route', 'Route'], ['menu', 'Menu'], ['journal', 'Journal']];
      function setup(t) {
        const L = g('learn'), wx = t.wx, open = addDays(t.start, -150);
        return K.card('Trip', `<div class="lk-row"><span class="grow"><b>${esc(t.place || 'Somewhere nice')}</b> · ${esc(TYPES.find(x => x[0] === t.type)[1])} · ${esc(api.util.fmtDate(t.start))} – ${esc(api.util.fmtDate(t.end))}</span><button class="lk-btn" id="cp-edit">Edit</button></div>
          <div class="lk-row"><span class="grow">${[...(t.adults || []), ...(t.kids || []).map(k => k + ' (kid)')].map(esc).join(', ') || 'Who’s coming?'}${t.dog ? ' + the dog' : ''}</span></div>`)
          + K.card('Forecast', wx && wx.days ? wx.days.map(d => `<div class="lk-row"><span class="grow">${esc(api.util.fmtDate(d.date))}</span><em>${Math.round(d.hi)}° / <b class="${d.lo <= 2 ? 'hot' : ''}">${Math.round(d.lo)}°</b></em><em class="${d.rain >= 60 ? 'soon' : ''}">${d.rain}% rain</em></div>`).join('') + `${wx.cold ? '<div class="cp-flag">Lows near freezing: warm sleeping bags and toques added to packing.</div>' : ''}${wx.rain ? '<div class="cp-flag">Rainy day ahead: tarps and dry bags added.</div>' : ''}`
            : `<div class="muted" style="font-size:13px">${daysUntil(t.start) > 7 ? 'The forecast shows up a week before you leave.' : 'Add a place (town or park name) to get the forecast.'}</div>`, `<button class="lk-btn" id="cp-wx">Refresh</button>`)
          + K.card('Booking window', `<div class="lk-row"><span class="grow">Ontario Parks (and many others) open reservations 5 months ahead. Popular parks fill on day one. For this trip that’s <b>${esc(api.util.fmtDate(open))}</b>.</span>${daysUntil(open) > 0 ? '<button class="lk-btn" id="cp-open">Remind me that morning</button>' : ''}</div>`)
          + K.card('Permits & checks', BASE.permits.map(c => `<label class="lk-row"><input type="checkbox" data-chk="${esc(c)}" ${(t.checks || []).includes(c) ? 'checked' : ''}><span class="grow">${esc(c)}</span></label>`).join(''))
          + (L.notes.length ? K.card('Notes from past trips', L.notes.slice(0, 6).map(n => `<div class="lk-row"><span class="grow">${esc(n.t)}</span><em>${esc(n.trip)}</em></div>`).join('')) : '');
      }
      function pack(t) {
        const list = packList(t), got = t.packed || [], secs = [...new Set(list.map(x => x.sec))], w = t.weights || {}, bp = t.type === 'backpacking' || t.type === 'canoe';
        const tot = list.filter(x => got.includes(x.sec + '|' + x.it)).reduce((s, x) => s + (+w[x.it] || 0), 0);
        return `<div class="lk-top"><b>${got.length} of ${list.length} packed</b>${bp ? `<span class="muted">· ${(tot / 1000).toFixed(1)} kg packed so far</span>` : ''}<span class="sp"></span><button class="lk-btn" id="cp-leave">Leaving-the-site checklist</button></div>`
          + secs.map(sc => K.card(esc(sc), list.filter(x => x.sec === sc).map(x => { const k = x.sec + '|' + x.it; return `<label class="lk-row"><input type="checkbox" data-pk="${esc(k)}" ${got.includes(k) ? 'checked' : ''}><span class="grow">${esc(x.it)}</span>${bp ? `<input class="inp cp-w" data-w="${esc(x.it)}" value="${esc(w[x.it] || '')}" placeholder="g">` : ''}</label>`; }).join(''))).join('');
      }
      function route(t) {
        const legs = t.legs || [], pace = (t.kids || []).length ? 8 : 15;
        return (t.type === 'car' || t.type === 'rv' ? K.card('Drive in', `${legs.map((l, i) => `<div class="lk-row"><span class="lk-pill">${esc(l.kind)}</span><span class="grow">${esc(l.name)}${l.note ? ` <span class="muted">· ${esc(l.note)}</span>` : ''}</span><button class="lk-x" data-ldel="${i}">${api.ui.icon('x')}</button></div>`).join('') || K.empty('Gas, groceries, the last real washroom, ice…')}<div class="lk-row"><span class="grow">Gatehouse closes at</span><input class="inp" type="time" id="cp-gate" value="${esc(t.gate || '')}" style="width:auto"></div>`, '<button class="lk-btn" id="cp-stop">Add a stop</button>')
          : K.card('Days on the water / trail', `${legs.map((l, i) => `<div class="lk-row"><span class="lk-pill">Day ${i + 1}</span><span class="grow">${esc(l.from)} → ${esc(l.to)}${l.site ? ` <span class="muted">· camp at ${esc(l.site)}</span>` : ''}</span><em class="${+l.km > pace ? 'hot' : ''}">${esc(l.km || '?')} km${l.port ? ` · ${esc(l.port)} portages` : ''}</em><button class="lk-x" data-ldel="${i}">${api.ui.icon('x')}</button></div>`).join('') || K.empty('Split the route into days.')}${legs.some(l => +l.km > pace) ? `<div class="cp-flag">Some days are longer than a comfortable ${pace} km for this group.</div>` : ''}`, '<button class="lk-btn" id="cp-day">Add a day</button>'))
          + K.card('Bail-out / access points', `<textarea class="inp" id="cp-bail" rows="2" placeholder="Access point 3 road, Ranger station at…">${esc(t.bail || '')}</textarea>`)
          + K.card('Leave-behind plan', `<div class="lk-row"><span class="grow">Trusted person</span><input class="inp" id="cp-who" value="${esc(t.contact || '')}" placeholder="Mom, 416-555-0100" style="max-width:260px"></div><div class="lk-row"><span class="grow">Expected out by</span><input class="inp" type="time" id="cp-out" value="${esc(t.outBy || '18:00')}" style="width:auto"></div><div class="lk-top" style="margin:8px 0 0"><button class="btn" id="cp-copy">Copy the plan to send</button><button class="btn" id="cp-ck">Add a check-in reminder</button></div>`);
      }
      function menu(t) {
        const ds = days(t), m = t.menu || {}, cooler = t.type === 'car' || t.type === 'rv';
        const warn = cooler ? ds.slice(3).some(d => Object.values(m[d] || {}).some(x => PERISH.test(x))) : false;
        return `${warn ? '<div class="cp-flag">Fresh meat or dairy after day 3: the cooler might not last. Move those meals earlier or plan an ice run.</div>' : ''}<div class="cp-menu" style="grid-template-columns:80px repeat(${ds.length},minmax(110px,1fr))"><span></span>${ds.map((d, i) => `<b>Day ${i + 1}<em>${esc(api.util.fromYmd(d).toLocaleDateString([], { weekday: 'short' }))}</em></b>`).join('')}
          ${MEALS.map(ml => `<span class="ml">${ml}</span>${ds.map(d => `<input class="inp" data-meal="${d}|${ml}" value="${esc((m[d] || {})[ml] || '')}" placeholder="${ml === 'Breakfast' ? 'Pancakes' : ml === 'Dinner' ? 'Foil-pack chicken' : ''}">`).join('')}`).join('')}</div>
          <div class="lk-top" style="margin-top:10px"><button class="btn" id="cp-groc">Add to the shopping list</button><span class="muted" style="font-size:12px">Cooking gear for these meals is added to the packing list automatically.</span></div>
          ${t.type !== 'car' && t.type !== 'rv' ? K.card('Bear-safe food storage', BASE.bear.map(b => `<div class="lk-row"><span class="grow">${esc(b)}</span></div>`).join('')) : ''}`;
      }
      function journal(t) {
        const ds = days(t), j = t.journal || {};
        return ds.map((d, i) => { const e = j[d] || {}; return K.card(`Day ${i + 1} · ${esc(api.util.fmtDate(d))}`, `<div class="cp-j"><input class="inp" data-j="${d}|weather" value="${esc(e.weather || '')}" placeholder="Weather"><input class="inp" data-j="${d}|wildlife" value="${esc(e.wildlife || '')}" placeholder="Wildlife spotted"><input class="inp" data-j="${d}|high" value="${esc(e.high || '')}" placeholder="Highlight of the day"><select class="inp" data-j="${d}|rating"><option value="">Site rating</option>${[1, 2, 3, 4, 5].map(r => `<option ${+e.rating === r ? 'selected' : ''} value="${r}">${'★'.repeat(r)}</option>`).join('')}</select><textarea class="inp" data-j="${d}|notes" rows="2" placeholder="Notes, site tips for next time">${esc(e.notes || '')}</textarea></div>`); }).join('')
          + K.card('After the trip', `<div class="field"><label>Packed but didn’t use (comma separated, dropped next time)</label><input class="inp" id="cp-skip"></div><div class="field"><label>Wish we’d brought</label><input class="inp" id="cp-wish"></div><div class="field"><label>One thing to do differently</label><input class="inp" id="cp-diff"></div><div class="lk-top"><button class="btn primary" id="cp-learn">Save lessons</button><button class="btn" id="cp-report">Trip report</button></div>`);
      }
      function view(el) {
        const sel = api.storage.get('sel'), t = sel && trip(sel);
        if (!t) { el.innerHTML = `<div class="lk-top"><button class="btn primary" id="cp-new">Plan a camping trip</button></div>` + (trips().slice().sort((a, b) => b.start.localeCompare(a.start)).map(x => `<button class="vc-trip" data-open="${esc(x.id)}"><b>${esc(x.name)}</b><span>${esc(x.place || '')} · ${esc(api.util.fmtDate(x.start))}</span><em>${daysUntil(x.start) > 0 ? daysUntil(x.start) + ' days' : daysUntil(x.end) >= 0 ? 'Out there' : 'Done'}</em></button>`).join('') || K.empty('No trips yet.'));
          el.querySelector('#cp-new').onclick = () => edit(null); el.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { api.storage.set('sel', b.dataset.open); api.ui.refresh(); }); return; }
        const tb = api.storage.get('tab') || 'setup';
        el.innerHTML = `<div class="lk-top"><button class="lk-btn" id="cp-back">‹ Trips</button><b style="font-size:17px">${esc(t.name)}</b><span class="sp"></span><span class="vc-count">${daysUntil(t.start) > 0 ? `<b>${daysUntil(t.start)}</b> days to go` : ''}</span></div>${K.tabs(tabs, tb)}<div>${({ setup, pack, route, menu, journal })[tb](t)}</div>`;
        wire(el, t);
      }
      function edit(t) { form(api, t ? 'Edit trip' : 'New camping trip', [{ k: 'name', label: 'Trip name', req: true, ph: 'Algonquin long weekend' }, { k: 'place', label: 'Park or town (for the forecast)', ph: 'Algonquin Park' }, { k: 'type', label: 'Type', type: 'select', opts: TYPES }, { k: 'start', label: 'Arrive', type: 'date', req: true }, { k: 'end', label: 'Leave', type: 'date', req: true }, { k: 'adultsS', label: 'Adults (comma separated)', ph: 'Nick, Sam' }, { k: 'kidsS', label: 'Kids (comma separated)', ph: 'Maya' }, { k: 'dog', label: 'Bringing the dog', type: 'check' }],
        t ? { ...t, adultsS: (t.adults || []).join(', '), kidsS: (t.kids || []).join(', ') } : null, v => { const x = { ...(t || { id: uid(), packed: [], menu: {}, legs: [], journal: {} }), name: v.name, place: v.place, type: v.type, start: v.start, end: v.end < v.start ? v.start : v.end, dog: v.dog, adults: v.adultsS.split(',').map(s => s.trim()).filter(Boolean), kids: v.kidsS.split(',').map(s => s.trim()).filter(Boolean) };
          api.storage.set('sel', x.id); api.storage.set('trips', t ? trips().map(y => y.id === t.id ? x : y) : [...trips(), x]); api.ui.refresh(); }); }
      async function forecast(t) {
        if (!t.place) return api.ui.toast('Add a park or town first'); try {
          const geo = await (await fetch('api/weather/geo?q=' + encodeURIComponent(t.place))).json(), p = (geo.results || [])[0]; if (!p) return api.ui.toast('Couldn’t find that place');
          const d = await (await fetch(`api/weather?lat=${p.latitude}&lon=${p.longitude}`)).json(), ds = days(t), dy = d.daily, out = [];
          dy.time.forEach((x, i) => { if (ds.includes(x)) out.push({ date: x, hi: dy.temperature_2m_max[i], lo: dy.temperature_2m_min[i], rain: dy.precipitation_probability_max[i] }); });
          if (!out.length) return api.ui.toast('The forecast doesn’t reach your dates yet');
          upd(t.id, { wx: { days: out, cold: out.some(x => x.lo <= 2), rain: out.some(x => x.rain >= 60), at: Date.now() } }); } catch (e) { api.ui.toast('Forecast unavailable'); } }
      function wire(el, t) {
        const $ = q => el.querySelector(q), all = q => el.querySelectorAll(q), on = (q, f) => { const x = $(q); if (x) x.onclick = f; };
        on('#cp-back', () => { api.storage.set('sel', null); api.ui.refresh(); });
        all('[data-tab]').forEach(b => b.onclick = () => { api.storage.set('tab', b.dataset.tab); api.ui.refresh(); });
        on('#cp-edit', () => edit(t)); on('#cp-wx', () => forecast(t));
        on('#cp-open', () => { K.ownTask(api, 'cpopen:' + t.id, { title: `Book the campsite for ${t.name} (reservations open today, 7 AM)`, dueDate: addDays(t.start, -150), dueTime: '06:55', priority: 3 }); api.ui.toast('Reminder set'); });
        all('[data-chk]').forEach(c => c.onchange = () => upd(t.id, { checks: c.checked ? [...(t.checks || []), c.dataset.chk] : (t.checks || []).filter(x => x !== c.dataset.chk) }));
        all('[data-pk]').forEach(c => c.onchange = () => upd(t.id, { packed: c.checked ? [...(t.packed || []), c.dataset.pk] : (t.packed || []).filter(x => x !== c.dataset.pk) }));
        all('[data-w]').forEach(i => i.onchange = () => upd(t.id, { weights: { ...(t.weights || {}), [i.dataset.w]: +i.value || 0 } }));
        on('#cp-leave', () => api.ui.modal('Before you drive away', BASE.leave.map(x => `<label class="lk-row"><input type="checkbox"><span class="grow">${esc(x)}</span></label>`).join(''), ''));
        on('#cp-stop', () => form(api, 'A stop on the way', [{ k: 'kind', label: 'Type', type: 'select', opts: ['Gas', 'Groceries', 'Washroom', 'Ice', 'Firewood', 'Food', 'Other'].map(x => [x, x]) }, { k: 'name', label: 'Where', req: true }, { k: 'note', label: 'Note' }], null, v => upd(t.id, { legs: [...(t.legs || []), v] })));
        on('#cp-day', () => form(api, `Day ${(t.legs || []).length + 1}`, [{ k: 'from', label: 'From', req: true, def: ((t.legs || []).slice(-1)[0] || {}).to || '' }, { k: 'to', label: 'To', req: true }, { k: 'km', label: 'Distance (km)', type: 'number' }, { k: 'port', label: 'Portages', type: 'number' }, { k: 'site', label: 'Campsite / lake' }], null, v => upd(t.id, { legs: [...(t.legs || []), v] })));
        all('[data-ldel]').forEach(b => b.onclick = () => upd(t.id, { legs: t.legs.filter((_, i) => i !== +b.dataset.ldel) }));
        const field = (q, k) => { const x = $(q); if (x) x.onchange = () => upd(t.id, { [k]: x.value }); };
        field('#cp-gate', 'gate'); field('#cp-bail', 'bail'); field('#cp-who', 'contact'); field('#cp-out', 'outBy');
        const plan = () => `Leave-behind plan: ${t.name}\nWho: ${[...(t.adults || []), ...(t.kids || [])].join(', ')}${t.dog ? ' + dog' : ''}\nWhere: ${t.place || '?'} (${TYPES.find(x => x[0] === t.type)[1]})\nIn: ${t.start}   Out: ${t.end} by ${t.outBy || '18:00'}\n${(t.legs || []).map((l, i) => l.from ? `Day ${i + 1}: ${l.from} → ${l.to}${l.site ? ' (camp ' + l.site + ')' : ''}` : `Stop: ${l.name}`).join('\n')}\n${t.bail ? 'Bail-out: ' + t.bail + '\n' : ''}If you haven't heard from us by ${t.outBy || '18:00'} + 3 hours on ${t.end}, call the park office / 911.`;
        on('#cp-copy', () => { api.ui.copy(plan()); api.ui.toast('Copied. Send it to ' + (t.contact || 'someone you trust')); });
        on('#cp-ck', () => { K.ownTask(api, 'cpck:' + t.id, { title: `Check in with ${t.contact || 'your contact'}: we’re out safe`, dueDate: t.end, dueTime: t.outBy || '18:00', priority: 3 }); api.ui.toast('Check-in reminder added'); });
        all('[data-meal]').forEach(i => i.onchange = () => { const [d, ml] = i.dataset.meal.split('|'), m = { ...(t.menu || {}) }; m[d] = { ...(m[d] || {}), [ml]: i.value.trim() }; upd(t.id, { menu: m }); });
        on('#cp-groc', () => { const meals = [...new Set(Object.values(t.menu || {}).flatMap(d => Object.values(d)).filter(Boolean))]; if (!window.__kitchen) return api.ui.copy(meals.join('\n')), api.ui.toast('Copied (turn on the Kitchen plugin for a proper list)'); const n = window.__kitchen.addToList(meals.map(m => 'Ingredients for: ' + m), t.name); api.ui.toast(`${n} added to the shopping list`); });
        all('[data-j]').forEach(i => i.onchange = () => { const [d, k] = i.dataset.j.split('|'), j = { ...(t.journal || {}) }; j[d] = { ...(j[d] || {}), [k]: i.value }; upd(t.id, { journal: j }); });
        on('#cp-learn', () => { const L = g('learn'), sp = q => ($(q).value || '').split(',').map(s => s.trim()).filter(Boolean);
          api.storage.set('learn', { skip: [...new Set([...L.skip, ...sp('#cp-skip')])], add: [...new Set([...L.add, ...sp('#cp-wish')])], notes: [...($('#cp-diff').value.trim() ? [{ t: $('#cp-diff').value.trim(), trip: t.name }] : []), ...L.notes].slice(0, 30) }); api.ui.toast('Next trip’s lists are smarter now'); api.ui.refresh(); });
        on('#cp-report', () => { const j = t.journal || {}; K.printable(`${t.name}`, `<p class="m">${esc(t.place || '')} · ${esc(t.start)} to ${esc(t.end)} · ${esc([...(t.adults || []), ...(t.kids || [])].join(', '))}</p>` + days(t).map((d, i) => { const e = j[d] || {}; return `<h2>Day ${i + 1}</h2>${e.high ? `<p><b>${esc(e.high)}</b></p>` : ''}<p>${[e.weather && 'Weather: ' + esc(e.weather), e.wildlife && 'Wildlife: ' + esc(e.wildlife), e.rating && 'Site: ' + '★'.repeat(+e.rating)].filter(Boolean).join(' · ')}</p>${e.notes ? `<p>${esc(e.notes)}</p>` : ''}`; }).join('')); });
      }
      window.__camping = { packList };
      api.views.add({ id: 'camping', title: 'Camping', icon: '⛺', subtitle: 'Trip setup, packing, route, menu and journal', wide: true, render: view });
      K.css('cp-css', `.cp-flag{background:color-mix(in srgb,#d97706 12%,var(--panel));border:1px solid color-mix(in srgb,#d97706 40%,var(--line));border-radius:10px;padding:7px 10px;font-size:12.5px;margin:6px 0}
        .cp-w{width:64px;padding:2px 6px;font-size:12px}.cp-menu{display:grid;gap:6px;overflow-x:auto}.cp-menu b{font-size:12.5px}.cp-menu b em{display:block;font-style:normal;font-weight:400;color:var(--muted);font-size:11px}.cp-menu .ml{font-size:12px;color:var(--muted);align-self:center}.cp-menu .inp{padding:5px 7px;font-size:12.5px}
        .cp-j{display:grid;grid-template-columns:1fr 1fr;gap:6px}.cp-j textarea{grid-column:1/-1}
        .vc-trip{display:grid;grid-template-columns:1fr auto;gap:2px 12px;width:100%;text-align:left;border:1px solid var(--line);border-radius:14px;background:var(--panel);padding:12px 14px;margin-bottom:8px;cursor:pointer;color:var(--text)}.vc-trip b{font-size:15px}.vc-trip span{grid-column:1;color:var(--muted);font-size:12.5px}.vc-trip em{grid-column:2;grid-row:1/3;align-self:center;font-style:normal;font-weight:700;color:#15803d}.vc-count{font-size:13px;color:var(--muted)}.vc-count b{font:900 26px/1 ui-rounded,system-ui;color:#15803d}`);
    },
  });
})();
