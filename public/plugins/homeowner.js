/* Good Homeowner (Life): a short interview about your home, then every recurring maintenance job set up for you,
   timed for your climate (Toronto winters by default). Plus a house profile for the details you always need:
   filter sizes, model numbers, paint colours, contractors, warranties. Re-run the setup any time: it updates
   the reminders it made instead of duplicating them. */
Cadence.registerPlugin({
  id: 'homeowner', name: 'Good Homeowner', version: '1.0.0', category: 'Home', spaces: ['life'],
  description: 'Answer a few questions about your home and it sets up every recurring maintenance job for you (furnace filters, eavestroughs, detector batteries, the water heater, winter tires…), timed for your climate. Keeps a house profile with filter sizes, model numbers, paint colours, contractors and warranties.',
  tagline: 'Your home, maintained on autopilot', color: '#c2771c',
  icon: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
  settings(api) { window.__gh && window.__gh.wizard(); },
  setup(api) {
    const G = window.__gh = window.__gh || {};
    const E = api.ui.esc;
    const prof = () => Object.assign({ answers: null, systems: {}, paint: [], pros: [], warranties: [], notes: '' }, api.storage.get('profile') || {});
    const saveProf = p => api.storage.set('profile', p);

    /* ---------------- the maintenance catalogue ----------------
       every: repeat in months; at: month(s) of the year it belongs in (seasonal), else spread over the coming weeks.
       if: when it applies, given the answers. Months are tuned for cold winters; cold-only jobs (tires, snow blower) drop out elsewhere. */
    const has = (a, k) => (a.extras || []).includes(k) || (a.water || []).includes(k) || (a.outside || []).includes(k) || (a.safety || []).includes(k);
    const ducted = a => ['gas', 'electric', 'heatpump'].includes(a.heat);
    const outdoors = a => a.type === 'house' || a.type === 'town';
    const owner = a => a.own !== 'rent';
    const filterEvery = a => ({ basic: 1, pleated: 3, media: 6 })[a.filter || 'pleated'];
    const CAT = [
      // heating & air
      { k: 'filter', t: 'Change the furnace filter', g: 'Heating & air', every: a => filterEvery(a), if: ducted, n: p => `Size: ${p.systems.filterSize || '(add it in My home)'}. The arrow on the filter points toward the furnace.` },
      { k: 'furnace', t: 'Book the furnace tune-up', g: 'Heating & air', every: 12, at: [9], if: a => owner(a) && ['gas', 'electric'].includes(a.heat), n: () => 'Before the cold hits. Ask them to check the flame sensor and the CO levels.' },
      { k: 'boiler', t: 'Book the boiler service', g: 'Heating & air', every: 12, at: [9], if: a => owner(a) && a.heat === 'boiler' },
      { k: 'hp', t: 'Service the heat pump', g: 'Heating & air', every: 12, at: [5], if: a => owner(a) && (a.heat === 'heatpump' || a.cool === 'heatpump') },
      { k: 'ac', t: 'Service the central AC', g: 'Heating & air', every: 12, at: [5], if: a => owner(a) && a.cool === 'central' },
      { k: 'acclear', t: 'Clear around the outdoor AC unit', g: 'Heating & air', every: 12, at: [5], if: a => outdoors(a) && ['central', 'heatpump'].includes(a.cool), n: () => 'Two feet of clearance; hose off the fins gently.' },
      { k: 'hrv', t: 'Clean the HRV/ERV filters', g: 'Heating & air', every: 3, if: a => has(a, 'hrv') },
      { k: 'humon', t: 'Turn the furnace humidifier on (new pad)', g: 'Heating & air', every: 12, at: [10], if: a => has(a, 'humidifier'), n: () => 'Replace the pad and open the bypass damper for winter.' },
      { k: 'humoff', t: 'Turn the furnace humidifier off for summer', g: 'Heating & air', every: 12, at: [4], if: a => has(a, 'humidifier') },
      { k: 'chimney', t: 'Chimney sweep and inspection', g: 'Heating & air', every: 12, at: [8], if: a => has(a, 'woodfire') },
      { k: 'gasfire', t: 'Service the gas fireplace', g: 'Heating & air', every: 12, at: [9], if: a => has(a, 'gasfire') },
      // water
      { k: 'wh', t: 'Flush the water heater', g: 'Water', every: 12, at: [6], if: a => ['tankgas', 'tankelec'].includes(a.wh), n: () => 'Drain a few buckets from the valve at the bottom until it runs clear.' },
      { k: 'anode', t: 'Check the water heater anode rod', g: 'Water', every: 36, at: [6], if: a => owner(a) && ['tankgas', 'tankelec'].includes(a.wh) },
      { k: 'tankless', t: 'Descale the tankless water heater', g: 'Water', every: 12, at: [6], if: a => a.wh === 'tankless' },
      { k: 'sump', t: 'Test the sump pump', g: 'Water', every: 3, at: [3, 6, 9, 12], if: a => has(a, 'sump'), n: () => 'Pour a bucket of water into the pit; it should kick on and drain. Check the backup battery too.' },
      { k: 'taps-off', t: 'Shut off and drain the outdoor taps', g: 'Water', every: 12, at: [10], if: a => has(a, 'taps'), n: () => 'Close the inside shut-off valve, then open the outside tap to drain it. Before the first frost.' },
      { k: 'taps-on', t: 'Turn the outdoor taps back on', g: 'Water', every: 12, at: [4], if: a => has(a, 'taps') },
      { k: 'salt', t: 'Top up the water softener salt', g: 'Water', every: 1, if: a => has(a, 'softener') },
      { k: 'well', t: 'Test the well water', g: 'Water', every: 12, at: [5], if: a => has(a, 'well'), n: () => 'Ontario offers free bacteria testing for private wells: pick up a bottle at a public health office.' },
      { k: 'septic', t: 'Pump out the septic tank', g: 'Water', every: 36, at: [6], if: a => has(a, 'septic') },
      { k: 'fridge', t: 'Replace the fridge water filter', g: 'Water', every: 6, if: a => has(a, 'fridgefilter'), n: p => p.systems.fridgeFilter ? `Filter: ${p.systems.fridgeFilter}` : '' },
      { k: 'leaks', t: 'Look for leaks under the sinks', g: 'Water', every: 6, at: [4, 10], if: () => true },
      // safety
      { k: 'alarms', t: 'Test the smoke and CO alarms', g: 'Safety', every: 1, if: a => has(a, 'alarms') },
      { k: 'batteries', t: 'New batteries in the smoke and CO alarms', g: 'Safety', every: 6, at: [3, 11], if: a => has(a, 'alarms'), n: () => 'When the clocks change.' },
      { k: 'alarm-age', t: 'Check the age of your smoke alarms (replace at 10 years)', g: 'Safety', every: 12, at: [11], if: a => has(a, 'alarms') },
      { k: 'extinguisher', t: 'Check the fire extinguisher gauge', g: 'Safety', every: 12, at: [1], if: a => has(a, 'extinguisher') },
      { k: 'dryer', t: 'Clean out the dryer vent', g: 'Safety', every: 12, at: [2], if: a => has(a, 'dryer'), n: () => 'Lint build-up is a leading cause of house fires. Clean the duct, not just the screen.' },
      // appliances
      { k: 'dish', t: 'Clean the dishwasher filter', g: 'Appliances', every: 1, if: a => has(a, 'dishwasher') },
      { k: 'washer', t: 'Clean the washer (gasket and cleaning cycle)', g: 'Appliances', every: 1, if: a => has(a, 'frontload') },
      { k: 'hood', t: 'Degrease the range hood filter', g: 'Appliances', every: 3, if: a => has(a, 'hood') },
      { k: 'coils', t: 'Vacuum the fridge coils', g: 'Appliances', every: 12, at: [3], if: () => true },
      // outside
      { k: 'eaves-spring', t: 'Clean the eavestroughs (spring)', g: 'Outside', every: 12, at: [5], if: a => outdoors(a) && owner(a) && has(a, 'eaves'), n: () => 'Check the downspouts drain at least 6 feet from the foundation.' },
      { k: 'eaves-fall', t: 'Clean the eavestroughs (after the leaves drop)', g: 'Outside', every: 12, at: [11], if: a => outdoors(a) && owner(a) && has(a, 'eaves') },
      { k: 'roof', t: 'Look over the roof and flashing', g: 'Outside', every: 12, at: [5], if: a => outdoors(a) && owner(a), n: () => 'From the ground with binoculars is fine: missing or curled shingles, moss, flashing around the chimney.' },
      { k: 'grade', t: 'Check the grading slopes away from the house', g: 'Outside', every: 12, at: [4], if: a => outdoors(a) && owner(a) },
      { k: 'caulk', t: 'Check caulking and weatherstripping', g: 'Outside', every: 12, at: [10], if: a => owner(a) },
      { k: 'deck', t: 'Clean and inspect the deck', g: 'Outside', every: 12, at: [5], if: a => outdoors(a) && has(a, 'deck') },
      { k: 'deck-seal', t: 'Re-seal or stain the deck', g: 'Outside', every: 24, at: [6], if: a => outdoors(a) && has(a, 'deck') },
      { k: 'garage', t: 'Lubricate the garage door and test the auto-reverse', g: 'Outside', every: 6, at: [4, 10], if: a => outdoors(a) && has(a, 'garage') },
      { k: 'mower', t: 'Tune up the lawn mower', g: 'Outside', every: 12, at: [4], if: a => outdoors(a) && has(a, 'lawn') },
      { k: 'aerate', t: 'Aerate and overseed the lawn', g: 'Outside', every: 12, at: [9], if: a => outdoors(a) && has(a, 'lawn') },
      { k: 'winterize', t: 'Winterize the mower and garden tools', g: 'Outside', every: 12, at: [10], if: a => outdoors(a) && has(a, 'lawn') },
      { k: 'snowblower', t: 'Tune up the snow blower', g: 'Outside', every: 12, at: [10], if: a => a.climate === 'cold' && has(a, 'snowblower') },
      { k: 'pool-open', t: 'Open the pool', g: 'Outside', every: 12, at: [5], if: a => has(a, 'pool') },
      { k: 'pool-close', t: 'Close the pool', g: 'Outside', every: 12, at: [9], if: a => has(a, 'pool') },
      { k: 'hottub', t: 'Drain and refill the hot tub', g: 'Outside', every: 3, if: a => has(a, 'hottub') },
      { k: 'tires-on', t: 'Book the winter tire swap', g: 'Car', every: 12, at: [10], if: a => has(a, 'tires') && a.climate === 'cold', n: () => 'Shops book up fast. On by mid-November, or when it\'s consistently below 7°C.' },
      { k: 'tires-off', t: 'Book the swap back to all-seasons', g: 'Car', every: 12, at: [4], if: a => has(a, 'tires') && a.climate === 'cold', n: () => 'After the last frost, usually mid-April.' },
    ];
    // first due date: seasonal jobs land at the start of their month. If that month is now, or just went by (taps off in
    // October, when it's already November), it comes due this week instead of next year. Interval jobs spread out over the coming weeks.
    function firstDue(item, a, i) {
      const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate()), cur = now.getMonth() + 1;
      const soon = () => api.util.ymd(api.util.addDays(today, 1 + i % 6));
      if (item.at) {
        if (item.at.some(m => m === cur || m === (cur + 10) % 12 + 1)) return soon();
        const cand = [];
        for (const m of item.at) for (const y of [now.getFullYear(), now.getFullYear() + 1]) { const d = new Date(y, m - 1, m >= 9 ? 1 : 15); if (d > today) cand.push(d); }
        cand.sort((x, y) => x - y); return api.util.ymd(cand[0]);
      }
      return api.util.ymd(api.util.addDays(today, 2 + (i * 3) % 24));   // don't drop everything on today
    }
    const repeatOf = (item, a) => { const every = typeof item.every === 'function' ? item.every(a) : item.every; return { unit: 'month', n: every }; };
    const plan = a => CAT.filter(x => x.if(a));

    function homeArea() {
      let c = api.clients.list().find(c => c.name.toLowerCase() === 'home');
      if (!c) { c = api.clients.add('Home'); api.clients.update(c.id, { icon: '🏠', color: '#c2771c' }); }
      return c.id;
    }
    // create or update the reminders the setup owns (tagged `gh:<key>`); remove ones that no longer apply
    function apply(a, chosen) {
      const area = homeArea(), p = prof(), mine = api.tasks.list(t => t.gh && !t.done);
      const keep = new Set(chosen.map(x => x.k));
      let made = 0, changed = 0, removed = 0;
      chosen.forEach((item, i) => {
        const notes = item.n ? item.n(p) || '' : '', patch = { title: item.t, notes, repeat: repeatOf(item, a), tags: ['home'] };
        const ex = mine.find(t => t.gh === item.k);
        if (ex) { if (ex.title !== patch.title || (ex.repeat || {}).n !== patch.repeat.n || (ex.notes || '') !== notes) { api.tasks.update(ex.id, patch); changed++; } }
        else { api.tasks.add({ ...patch, gh: item.k, clientId: area, owner: 'me', dueDate: firstDue(item, a, i), priority: 0 }); made++; }
      });
      for (const t of mine) if (!keep.has(t.gh) && !String(t.gh).startsWith('warranty:')) { api.tasks.remove(t.id); removed++; }
      return { made, changed, removed, area };
    }

    /* ---------------- the setup interview ---------------- */
    const STEPS = [
      { id: 'place', title: 'Your place', sub: 'So the list fits how you live.', q: [
        { k: 'type', label: 'What kind of home?', one: [['house', '🏡', 'House'], ['town', '🏘️', 'Townhouse'], ['condo', '🏢', 'Condo'], ['apt', '🛋️', 'Apartment']] },
        { k: 'own', label: 'Do you own or rent?', one: [['own', '🔑', 'Own'], ['rent', '📄', 'Rent']] },
        { k: 'climate', label: 'Winters where you live?', one: [['cold', '❄️', 'Cold (like Toronto)'], ['mild', '🌦️', 'Mild'], ['hot', '☀️', 'Hot, barely any']] } ] },
      { id: 'air', title: 'Heating & cooling', sub: 'Filters and tune-ups are the jobs people forget most.', q: [
        { k: 'heat', label: 'How is it heated?', one: [['gas', '🔥', 'Gas furnace'], ['electric', '⚡', 'Electric furnace'], ['heatpump', '♻️', 'Heat pump'], ['boiler', '♨️', 'Boiler / radiators'], ['baseboard', '▭', 'Baseboard heaters'], ['none', '🤷', 'Not sure']] },
        { k: 'filter', label: 'Which furnace filter?', show: a => ['gas', 'electric', 'heatpump'].includes(a.heat), one: [['basic', '▢', '1" basic (monthly)'], ['pleated', '▤', '1" pleated (3 months)'], ['media', '▥', '4–5" media (6 months)']] },
        { k: 'cool', label: 'Cooling?', one: [['central', '❄️', 'Central AC'], ['heatpump', '♻️', 'Heat pump'], ['window', '🪟', 'Window units'], ['none', '🌬️', 'None']] },
        { k: 'extras', label: 'Any of these? (tap all that apply)', many: [['hrv', '🌀', 'HRV / ERV'], ['humidifier', '💧', 'Furnace humidifier'], ['woodfire', '🪵', 'Wood fireplace'], ['gasfire', '🔥', 'Gas fireplace']] } ] },
      { id: 'water', title: 'Water', sub: 'Small checks that prevent the expensive surprises.', q: [
        { k: 'wh', label: 'Water heater?', one: [['tankgas', '🛢️', 'Gas tank'], ['tankelec', '🛢️', 'Electric tank'], ['tankless', '⚡', 'Tankless'], ['unknown', '🤷', 'Not sure']] },
        { k: 'water', label: 'Any of these?', many: [['taps', '🚰', 'Outdoor taps'], ['sump', '🌊', 'Sump pump'], ['softener', '🧂', 'Water softener'], ['fridgefilter', '🧊', 'Fridge water filter'], ['well', '🪣', 'Well'], ['septic', '🚽', 'Septic']] } ] },
      { id: 'outside', title: 'Outside', sub: 'Seasonal jobs, timed for spring and fall.', show: a => a.type === 'house' || a.type === 'town', q: [
        { k: 'outside', label: 'What do you have?', many: [['eaves', '🏠', 'Eavestroughs'], ['deck', '🪵', 'Deck'], ['lawn', '🌱', 'Lawn & garden'], ['garage', '🚗', 'Garage door'], ['snowblower', '❄️', 'Snow blower'], ['pool', '🏊', 'Pool'], ['hottub', '♨️', 'Hot tub']] } ] },
      { id: 'safety', title: 'Safety & appliances', sub: 'Mostly two-minute jobs.', q: [
        { k: 'safety', label: 'Which of these do you have?', many: [['alarms', '🚨', 'Smoke & CO alarms'], ['extinguisher', '🧯', 'Fire extinguisher'], ['dryer', '🌀', 'Clothes dryer'], ['dishwasher', '🍽️', 'Dishwasher'], ['frontload', '🧺', 'Front-load washer'], ['hood', '🍳', 'Range hood'], ['tires', '🛞', 'Winter tires on the car']] } ] },
    ];
    const DEFAULTS = { type: 'house', own: 'own', climate: /Toronto|Montreal|Winnipeg|Edmonton|Halifax|Chicago|New_York|Detroit|Minneapolis|Regina|Moncton|St_Johns/.test(Intl.DateTimeFormat().resolvedOptions().timeZone || '') ? 'cold' : 'mild',
      heat: 'gas', filter: 'pleated', cool: 'central', extras: [], wh: 'tankgas', water: ['taps'], outside: ['eaves'], safety: ['alarms', 'dryer', 'dishwasher', 'hood'] };

    function wizard() {
      const a = Object.assign({}, DEFAULTS, prof().answers || {});
      let step = 0;
      const steps = () => STEPS.filter(s => !s.show || s.show(a));
      const draw = () => {
        const list = steps(), last = step >= list.length;
        if (last) return review();
        const s = list[step];
        api.ui.modal('Good Homeowner', `<div class="gh-steps">${list.map((x, i) => `<i class="${i < step ? 'done' : i === step ? 'on' : ''}"></i>`).join('')}</div>
          <h3 class="gh-h">${E(s.title)}</h3><p class="gh-sub">${E(s.sub)}</p>
          ${s.q.filter(q => !q.show || q.show(a)).map(q => `<div class="gh-q"><label>${E(q.label)}</label><div class="gh-opts">${(q.one || q.many).map(([v, ic, l]) => {
            const on = q.one ? a[q.k] === v : (a[q.k] || []).includes(v);
            return `<button class="gh-o ${on ? 'on' : ''}" data-q="${q.k}" data-v="${v}" data-many="${q.many ? 1 : ''}"><span>${ic}</span>${E(l)}</button>`; }).join('')}</div></div>`).join('')}`,
          `${step ? '<button class="btn" id="gh-back">Back</button>' : '<span></span>'}<button class="btn primary" id="gh-next">${step === list.length - 1 ? 'Review the plan' : 'Next'}</button>`, 'wide');
        document.querySelectorAll('.gh-o').forEach(b => b.onclick = () => {
          const k = b.dataset.q, v = b.dataset.v;
          if (b.dataset.many) { const cur = new Set(a[k] || []); cur.has(v) ? cur.delete(v) : cur.add(v); a[k] = [...cur]; b.classList.toggle('on'); }
          else { a[k] = v; draw(); }
        });
        const back = document.getElementById('gh-back'); if (back) back.onclick = () => { step--; draw(); };
        document.getElementById('gh-next').onclick = () => { step++; draw(); };
      };
      const review = () => {
        const items = plan(a), off = new Set((a.off || []).filter(k => items.some(x => x.k === k)));   // remembers what you unticked last time
        const byG = {}; items.forEach(x => (byG[x.g] = byG[x.g] || []).push(x));
        const when = x => { const r = repeatOf(x, a); return `${['', 'Monthly', '', 'Every 3 months', '', '', 'Twice a year'][r.n] || (r.n === 12 ? 'Yearly' : r.n % 12 === 0 ? `Every ${r.n / 12} years` : `Every ${r.n} months`)}${x.at ? ' · ' + x.at.map(m => new Date(2000, m - 1, 1).toLocaleString([], { month: 'short' })).join(', ') : ''}`; };
        api.ui.modal('Your home plan', `<p class="gh-sub" style="margin-top:0">${items.length} recurring jobs for your home. Untick anything you'd rather not be reminded about. They go into your <b>Home</b> area.</p>
          <div class="gh-plan">${Object.entries(byG).map(([g, xs]) => `<div class="gh-g"><b>${E(g)}</b>${xs.map(x => `<label class="gh-i"><input type="checkbox" data-k="${x.k}" ${off.has(x.k) ? '' : 'checked'}><span>${E(x.t)}</span><em>${E(when(x))}</em></label>`).join('')}</div>`).join('')}</div>`,
          `<button class="btn" id="gh-back">Back</button><button class="btn primary" id="gh-go">Set up ${items.length - off.size} reminders</button>`, 'wide');
        const btn = document.getElementById('gh-go');
        document.querySelectorAll('.gh-i input').forEach(i => i.onchange = () => { i.checked ? off.delete(i.dataset.k) : off.add(i.dataset.k); btn.textContent = `Set up ${items.length - off.size} reminders`; });
        document.getElementById('gh-back').onclick = () => { step = steps().length - 1; draw(); };
        btn.onclick = () => {
          const p = prof(); p.answers = { ...a, off: [...off] }; saveProf(p);
          const r = apply(a, items.filter(x => !off.has(x.k)));
          api.ui.close();
          api.island.show({ icon: '🏡', color: '#c2771c', title: 'Your home is on autopilot', sub: [r.made && `${r.made} reminders set`, r.changed && `${r.changed} updated`, r.removed && `${r.removed} removed`].filter(Boolean).join(' · ') || 'Nothing changed', ms: 5000 });
          api.ui.navigate('view-house');
        };
      };
      draw();
    }
    G.wizard = wizard;

    /* ---------------- house profile ---------------- */
    function view(el) {
      const p = prof(), a = p.answers, home = api.clients.list().find(c => c.name.toLowerCase() === 'home');
      const tasks = api.tasks.list(t => t.gh && !t.done);
      if (!a) {
        el.innerHTML = `<div class="gh-hero"><div class="gh-house">🏡</div><h2>Let's look after your home</h2><p>A few quick questions about your place, and Cadence sets up every recurring maintenance job: furnace filters, eavestroughs, detector batteries, the water heater, winter tires. Timed for ${DEFAULTS.climate === 'cold' ? 'cold winters like Toronto\'s' : 'your climate'}.</p><button class="btn primary" id="gh-start">Start the 2-minute setup</button></div>`;
        el.querySelector('#gh-start').onclick = wizard; return;
      }
      // the year at a glance: which jobs land in which month
      const months = Array.from({ length: 12 }, (_, i) => ({ m: i + 1, xs: [] }));
      for (const t of tasks) { const d = t.dueDate ? new Date(t.dueDate + 'T12:00') : null; if (!d) continue; const r = t.repeat && t.repeat.unit === 'month' ? t.repeat.n : 12;
        for (let k = 0; k < 12; k += r) months[(d.getMonth() + k) % 12].xs.push(t); }
      const thisM = new Date().getMonth();
      const sys = p.systems, f = (key, label, ph) => `<label class="gh-f"><span>${E(label)}</span><input class="inp" data-sys="${key}" value="${E(sys[key] || '')}" placeholder="${E(ph || '')}"></label>`;
      const rows = (list, kind, cols) => `${list.map((r, i) => `<div class="gh-row">${cols.map(([k, ph, w]) => `<input class="inp" data-list="${kind}" data-i="${i}" data-k="${k}" value="${E(r[k] || '')}" placeholder="${E(ph)}" style="flex:${w || 1}" ${k === 'expires' ? 'type="date"' : ''}>`).join('')}<button class="gh-x" data-del="${kind}" data-i="${i}" title="Remove">✕</button></div>`).join('')}<button class="gh-add" data-add="${kind}">+ Add</button>`;
      el.innerHTML = `
        <div class="gh-top"><div><b>${tasks.length}</b> maintenance reminders running${home ? ` in <a href="#client-${E(home.id)}">${E(home.icon || '')} Home</a>` : ''}</div><button class="btn" id="gh-redo">Re-run setup</button></div>
        <div class="gh-year">${months.map((x, i) => `<div class="gh-m ${i === thisM ? 'now' : ''}"><b>${new Date(2000, i, 1).toLocaleString([], { month: 'short' })}</b><span>${x.xs.length || ''}</span><div class="gh-tip">${x.xs.slice(0, 12).map(t => `<div>${E(t.title)}</div>`).join('') || '<div class="muted">Nothing scheduled</div>'}</div></div>`).join('')}</div>
        <div class="gh-cards">
          <section class="gh-card"><h4>🔥 Systems</h4>${f('filterSize', 'Furnace filter size', 'e.g. 16x25x1')}${f('furnace', 'Furnace / heat pump model', 'brand, model, year installed')}${f('ac', 'AC model', 'brand, model, year')}${f('waterHeater', 'Water heater', 'brand, size, year (tank lasts 10–12 yrs)')}${f('fridgeFilter', 'Fridge water filter', 'part number')}${f('shutoff', 'Main water shut-off', 'where it is')}${f('panel', 'Electrical panel', 'where it is, which breaker is what')}</section>
          <section class="gh-card"><h4>🎨 Paint colours</h4>${rows(p.paint, 'paint', [['room', 'Room', 1.2], ['colour', 'Brand + colour', 2], ['finish', 'Finish', 1]])}</section>
          <section class="gh-card"><h4>🧰 Contractors</h4>${rows(p.pros, 'pros', [['name', 'Name', 1.4], ['trade', 'Trade', 1], ['phone', 'Phone', 1.2]])}</section>
          <section class="gh-card"><h4>🧾 Warranties</h4>${rows(p.warranties, 'warranties', [['item', 'Item', 1.6], ['expires', 'Expires', 1.2]])}<p class="gh-hint">You'll get a reminder a month before each one expires.</p></section>
          <section class="gh-card wide"><h4>📝 Notes</h4><textarea class="inp" id="gh-notes" rows="4" placeholder="Anything worth remembering about the house: quirks, what the previous owners did, where the spare keys are…">${E(p.notes || '')}</textarea></section>
        </div>`;
      el.querySelector('#gh-redo').onclick = wizard;
      // edits save as you type; only the knock-on reminder updates wait for a pause
      const timers = {}, later = (k, fn) => { clearTimeout(timers[k]); timers[k] = setTimeout(fn, 400); };
      el.querySelectorAll('[data-sys]').forEach(i => i.oninput = () => { const q = prof(); q.systems[i.dataset.sys] = i.value.trim(); saveProf(q); if (i.dataset.sys === 'filterSize' || i.dataset.sys === 'fridgeFilter') later('notes', refreshNotes); });
      el.querySelectorAll('[data-list]').forEach(i => i.oninput = i.onchange = () => { const q = prof(); const L = q[i.dataset.list]; L[+i.dataset.i] = { ...L[+i.dataset.i], [i.dataset.k]: i.value.trim() }; saveProf(q); if (i.dataset.list === 'warranties') later('w', warrantyReminders); });
      el.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { const q = prof(); q[b.dataset.add].push({ id: Math.random().toString(36).slice(2, 8) }); saveProf(q); view(el); const ins = el.querySelectorAll(`[data-list="${b.dataset.add}"]`); if (ins.length) ins[ins.length - (b.dataset.add === 'warranties' ? 2 : 3)].focus(); });
      el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const q = prof(); q[b.dataset.del].splice(+b.dataset.i, 1); saveProf(q); if (b.dataset.del === 'warranties') warrantyReminders(); view(el); });
      el.querySelector('#gh-notes').oninput = e => { const q = prof(); q.notes = e.target.value; saveProf(q); };
    }
    // keep filter sizes etc. in the reminders' notes
    function refreshNotes() { const p = prof(); for (const t of api.tasks.list(t => t.gh && !t.done)) { const item = CAT.find(x => x.k === t.gh); if (item && item.n) { const n = item.n(p) || ''; if ((t.notes || '') !== n) api.tasks.update(t.id, { notes: n }); } } }
    // a reminder 30 days before each warranty ends
    function warrantyReminders() {
      const p = prof(), area = homeArea(), existing = api.tasks.list(t => t.gh && String(t.gh).startsWith('warranty:') && !t.done);
      const want = p.warranties.filter(w => w.item && /^\d{4}-\d{2}-\d{2}$/.test(w.expires || ''));
      for (const w of want) {
        const due = api.util.ymd(api.util.addDays(new Date(w.expires + 'T12:00'), -30)), title = `Warranty ends soon: ${w.item} (${w.expires})`;
        const ex = existing.find(t => t.gh === 'warranty:' + w.id);
        if (ex) { if (ex.title !== title || ex.dueDate !== due) api.tasks.update(ex.id, { title, dueDate: due }); }
        else api.tasks.add({ title, gh: 'warranty:' + w.id, clientId: area, owner: 'me', dueDate: due, tags: ['home'], notes: 'Anything to claim before it runs out?' });
      }
      for (const t of existing) if (!want.some(w => 'warranty:' + w.id === t.gh)) api.tasks.remove(t.id);
    }

    if (!document.getElementById('gh-css')) {
      const st = document.createElement('style'); st.id = 'gh-css';
      st.textContent = `
        .gh-steps{display:flex;gap:6px;margin:-4px 0 14px}.gh-steps i{flex:1;height:4px;border-radius:4px;background:var(--line)}.gh-steps i.done{background:var(--accent)}.gh-steps i.on{background:color-mix(in srgb,var(--accent) 55%,var(--line))}
        .gh-h{margin:0;font-size:20px;letter-spacing:-.02em}.gh-sub{margin:4px 0 14px;color:var(--muted);font-size:13.5px}
        .gh-q{margin-bottom:16px}.gh-q>label{display:block;font-size:12.5px;font-weight:600;color:var(--muted);margin-bottom:8px}
        .gh-opts{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
        .gh-o{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid var(--line);border-radius:12px;font-size:13.5px;font-weight:550;text-align:left;background:var(--panel);transition:border-color .15s,background .15s,transform .1s}
        .gh-o span{font-size:20px;width:24px;text-align:center}.gh-o:hover{border-color:color-mix(in srgb,var(--accent) 45%,var(--line))}.gh-o:active{transform:scale(.98)}
        .gh-o.on{border-color:var(--accent);background:var(--accent-soft)}
        .gh-plan{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px;max-height:52vh;overflow:auto}
        .gh-g{border:1px solid var(--line);border-radius:12px;padding:10px 12px}.gh-g>b{display:block;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
        .gh-i{display:flex;align-items:baseline;gap:8px;padding:4px 0;font-size:13.5px;cursor:pointer}.gh-i input{accent-color:var(--accent)}.gh-i span{flex:1}.gh-i em{font-style:normal;font-size:11.5px;color:var(--muted);white-space:nowrap}
        .gh-hero{text-align:center;padding:30px 20px;max-width:520px;margin:0 auto}.gh-house{font-size:64px;animation:ghb 2.4s ease-in-out infinite}@keyframes ghb{50%{transform:translateY(-6px)}}
        .gh-hero h2{margin:10px 0 6px;font-size:24px;letter-spacing:-.02em}.gh-hero p{color:var(--muted);line-height:1.55;margin:0 0 18px}
        .gh-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;font-size:14px}.gh-top b{font-size:18px}.gh-top a{color:var(--accent);text-decoration:none;font-weight:600}.gh-top a:hover{text-decoration:underline}
        .gh-year{display:grid;grid-template-columns:repeat(12,1fr);gap:4px;margin-bottom:20px}
        .gh-m{position:relative;border:1px solid var(--line);border-radius:10px;padding:8px 4px;text-align:center;background:var(--panel);cursor:default}
        .gh-m b{display:block;font-size:11px;color:var(--muted);font-weight:600}.gh-m span{display:block;font-size:17px;font-weight:700;min-height:22px}
        .gh-m.now{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 25%,transparent)}.gh-m.now b{color:var(--accent)}
        .gh-tip{display:none;position:absolute;z-index:5;top:100%;left:50%;transform:translate(-50%,6px);width:220px;text-align:left;background:var(--panel);border:1px solid var(--line);border-radius:10px;box-shadow:var(--shadow);padding:8px 10px;font-size:12px;line-height:1.5}
        .gh-m:hover .gh-tip{display:block}
        .gh-cards{display:grid;align-items:start;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}
        .gh-card{border:1px solid var(--line);border-radius:14px;background:var(--panel);padding:14px}.gh-card.wide{grid-column:1/-1}
        .gh-card h4{margin:0 0 10px;font-size:14px}
        .gh-f{display:block;margin-bottom:8px}.gh-f span{display:block;font-size:11.5px;color:var(--muted);font-weight:600;margin-bottom:3px}
        .gh-row{display:flex;gap:6px;margin-bottom:6px;align-items:center}.gh-row .inp{min-width:0;padding:6px 8px;height:32px}
        .gh-x{width:26px;height:26px;border-radius:7px;color:var(--faint);flex:none}.gh-x:hover{background:var(--hover);color:var(--danger)}
        .gh-add{font-size:12.5px;color:var(--accent);font-weight:600;padding:4px 2px}
        .gh-hint{font-size:11.5px;color:var(--muted);margin:6px 0 0}
        @media (max-width:700px){.gh-year{grid-template-columns:repeat(6,1fr)}}
      `;
      document.head.appendChild(st);
    }

    api.views.add({ id: 'house', title: 'My home', icon: '🏡', subtitle: 'Maintenance on autopilot, and every detail about the house in one place.', render: el => view(el) });
    api.commands.add({ title: 'Set up home maintenance', hint: 'Good Homeowner', run: () => wizard() });
    api.widgets.add({ id: 'month', title: 'This month at home', icon: '🏡', size: 'm', spaces: ['life'], description: 'Home maintenance due this month.', render: el => {
      const t = new Date(), end = api.util.ymd(new Date(t.getFullYear(), t.getMonth() + 1, 0));
      const list = api.tasks.list(x => x.gh && !x.done && x.dueDate && x.dueDate <= end).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      el.innerHTML = list.length ? `<div class="dw-list">${list.map(x => `<div class="dw-task" data-id="${E(x.id)}"><button class="check" aria-label="Done"></button><span class="tt">${E(x.title)}<small>${E(new Date(x.dueDate + 'T12:00').toLocaleDateString([], { month: 'short', day: 'numeric' }))}</small></span></div>`).join('')}</div>`
        : `<div class="dw-empty">${prof().answers ? 'Nothing due at home this month. 🌿' : 'Set up Good Homeowner to fill this.'}</div>`;
      el.querySelectorAll('.dw-task .check').forEach(b => b.onclick = () => { const r = b.closest('.dw-task'); r.classList.add('done'); setTimeout(() => api.tasks.complete(r.dataset.id), 300); });
    } });
  }
});
