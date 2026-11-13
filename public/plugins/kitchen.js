/* Kitchen (Life): recipes, a weekly meal plan, and a shopping list sorted by store aisle.
   - Recipes: paste a link from any recipe blog and the NAS pulls just the recipe (ingredients, steps, time, photo),
     skipping the life story. Or type one in. Scale servings.
   - Meal plan: a week of dinners (plus breakfast/lunch if you like). Mark what you actually made, so favourites rise.
   - Shopping list: built from the week's plan or added by hand, grouped by aisle. One tap makes a "Groceries" task. */
(() => {
  const esc = window.CadenceKit.esc;
  const css = window.CadenceKit.css;
  const uid = window.CadenceKit.uid;
  const AISLES = [
    ['Produce', /\b(apple|banana|lemon|lime|orange|berr|grape|onion|garlic|shallot|potato|carrot|celery|pepper|tomato|lettuce|spinach|kale|cabbage|broccoli|cauliflower|zucchini|squash|cucumber|avocado|herb|parsley|cilantro|basil|mint|thyme|rosemary|ginger|mushroom|leek|scallion|green onion|corn|pea|bean sprout|fruit|vegetable)s?\b/i],
    ['Meat & fish', /\b(chicken|beef|pork|lamb|turkey|bacon|sausage|ham|steak|mince|ground|salmon|tuna|cod|shrimp|prawn|fish|anchov)/i],
    ['Dairy & eggs', /\b(milk|cream|butter|cheese|parmesan|cheddar|mozzarella|feta|yogurt|yoghurt|egg|sour cream|ricotta)/i],
    ['Bakery', /\b(bread|bun|roll|bagel|tortilla|pita|naan|baguette|croissant)/i],
    ['Frozen', /\b(frozen|ice cream)/i],
    ['Pantry', /\b(flour|sugar|salt|pepper|oil|vinegar|rice|pasta|noodle|spaghetti|bean|lentil|chickpea|stock|broth|sauce|paste|soy|honey|syrup|spice|cumin|paprika|oregano|cinnamon|vanilla|baking|yeast|oat|cereal|nut|almond|peanut|can|tin|chocolate|cocoa|coffee|tea|ketchup|mustard|mayo)/i],
    ['Drinks', /\b(juice|soda|water|wine|beer|sparkling)/i],
    ['Household', /\b(paper towel|toilet|soap|detergent|dish|foil|wrap|bag|sponge|trash|battery|batteries|shampoo|toothpaste)/i],
  ];
  const aisleOf = s => (AISLES.find(([, re]) => re.test(s)) || ['Other'])[0];
  const FR = { '½': .5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': .25, '¾': .75, '⅛': .125 };
  function scale(line, k) {
    if (k === 1) return line;
    return line.replace(/^\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+|[½⅓⅔¼¾⅛])(\s*[½⅓⅔¼¾⅛])?/, (m, a, b) => {
      let v = /\d+\s+\d+\/\d+/.test(a) ? (() => { const [w, f] = a.trim().split(/\s+/); const [n, d] = f.split('/'); return +w + n / d; })() : /\//.test(a) ? (() => { const [n, d] = a.split('/'); return n / d; })() : FR[a] != null ? FR[a] : parseFloat(a);
      if (b) v += FR[b.trim()] || 0; const x = v * k, r = Math.round(x * 4) / 4;
      const whole = Math.floor(r), frac = r - whole, fs = { .25: '¼', .5: '½', .75: '¾' }[frac] || '';
      return (whole ? whole : '') + fs || String(Math.round(x * 10) / 10);
    });
  }
  const MEALS = ['breakfast', 'lunch', 'dinner'];

  Cadence.registerPlugin({
    id: 'kitchen', name: 'Kitchen', version: '1.0.0', category: 'Life', spaces: ['life'],
    description: 'Recipes (paste a link from any recipe blog and get just the recipe), a weekly meal plan, and a shopping list sorted by store aisle that builds itself from the plan.',
    tagline: 'Recipes, meal plan, shopping list', color: '#ea580c',
    icon: '<path d="M2 12h20"/><path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"/><path d="m4 8 16-4"/><path d="m8.86 6.78-.45-1.81a2 2 0 0 1 1.45-2.43l1.94-.48a2 2 0 0 1 2.43 1.46l.45 1.8"/>',
    setup(api) {
      const recipes = () => api.storage.get('recipes') || [];
      const setRecipes = r => api.storage.set('recipes', r);
      const plan = () => api.storage.get('plan') || {};
      const setPlan = p => api.storage.set('plan', p);
      const list = () => api.storage.get('list') || [];
      const setList = l => { api.storage.set('list', l); api.ui.refreshWidgets && api.ui.refreshWidgets(); };
      const opts = () => Object.assign({ meals: ['dinner'] }, api.storage.get('opts') || {});
      const tab = () => api.storage.get('tab') || 'plan';
      const weekOf = off => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + off * 7); return Array.from({ length: 7 }, (_, i) => api.util.ymd(api.util.addDays(d, i))); };
      const R = id => recipes().find(r => r.id === id);

      function addToList(lines, from) { const cur = list(); const have = new Set(cur.filter(x => !x.done).map(x => x.name.toLowerCase()));
        const add = lines.map(l => String(l).trim()).filter(l => l && !have.has(l.toLowerCase())).map(name => ({ id: uid(), name, aisle: aisleOf(name), done: false, from: from || '' }));
        setList([...cur, ...add]); return add.length; }
      async function fromLink(u) {
        const r = await fetch('api/recipe?url=' + encodeURIComponent(u)); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Could not read that page');
        if (j.partial || !j.ingredients.length) throw new Error('That page has no recipe data we can read. Add it by hand instead.');
        const rec = { id: uid(), at: Date.now(), made: 0, skipped: 0, ...j }; setRecipes([rec, ...recipes()]); return rec;
      }
      function editRecipe(rec) {
        const r = rec || { name: '', ingredients: [], steps: [], servings: 4, minutes: null };
        api.ui.modal(rec ? 'Edit recipe' : 'New recipe', `<div class="field"><label>Name</label><input class="inp" id="kr-n" value="${esc(r.name)}"></div>
          <div class="row" style="gap:8px"><div class="field" style="flex:1"><label>Serves</label><input class="inp" id="kr-s" type="number" min="1" value="${esc(r.servings || '')}"></div><div class="field" style="flex:1"><label>Minutes</label><input class="inp" id="kr-m" type="number" min="1" value="${esc(r.minutes || '')}"></div></div>
          <div class="field"><label>Ingredients, one per line</label><textarea class="inp" id="kr-i" rows="7">${esc(r.ingredients.join('\n'))}</textarea></div>
          <div class="field"><label>Steps, one per line</label><textarea class="inp" id="kr-st" rows="6">${esc(r.steps.join('\n'))}</textarea></div>`, '<button class="btn primary" id="kr-ok">Save</button>');
        document.getElementById('kr-ok').onclick = () => { const $ = id => document.getElementById(id), name = $('kr-n').value.trim(); if (!name) return $('kr-n').focus();
          const next = { ...(rec || { id: uid(), at: Date.now(), made: 0, skipped: 0 }), name, servings: +$('kr-s').value || null, minutes: +$('kr-m').value || null, ingredients: $('kr-i').value.split('\n').map(s => s.trim()).filter(Boolean), steps: $('kr-st').value.split('\n').map(s => s.trim()).filter(Boolean) };
          setRecipes(rec ? recipes().map(x => x.id === rec.id ? next : x) : [next, ...recipes()]); api.ui.close(); api.ui.refresh(); };
      }
      function show(id) {
        const r = R(id); if (!r) return; let k = 1;
        const body = () => `${r.image ? `<div class="kr-hero" style="background-image:url('${esc(r.image)}')"></div>` : ''}<div class="kr-meta">${r.minutes ? `<span>${api.ui.icon('clock')}${r.minutes} min</span>` : ''}${r.servings ? `<span>Serves <button data-k="-1">−</button><b>${Math.round(r.servings * k)}</b><button data-k="1">+</button></span>` : ''}${r.site ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.site)}</a>` : ''}${r.made ? `<span>Made ${r.made}×</span>` : ''}</div>
          <div class="kr-cols"><div><h4>Ingredients</h4><ul>${r.ingredients.map(i => `<li>${esc(scale(i, k))}</li>`).join('')}</ul></div><div><h4>Steps</h4><ol>${r.steps.map(s => s.startsWith('## ') ? `</ol><h5>${esc(s.slice(3))}</h5><ol>` : `<li>${esc(s)}</li>`).join('')}</ol></div></div>`;
        api.ui.modal(esc(r.name), `<div id="kr-body">${body()}</div>`, `<button class="btn" id="kr-del" style="margin-right:auto">Delete</button><button class="btn" id="kr-ed">Edit</button><button class="btn" id="kr-plan">Plan it…</button><button class="btn primary" id="kr-shop">Add to shopping list</button>`, 'wide');
        const wire = () => document.querySelectorAll('#kr-body [data-k]').forEach(b => b.onclick = () => { const s = r.servings || 1; k = Math.max(1 / s, k + (+b.dataset.k) / s); document.getElementById('kr-body').innerHTML = body(); wire(); }); wire();
        document.getElementById('kr-shop').onclick = () => { const n = addToList(r.ingredients.map(i => scale(i, k)), r.name); api.ui.toast(`${n} item${n === 1 ? '' : 's'} added to the shopping list`); };
        document.getElementById('kr-ed').onclick = () => editRecipe(r);
        document.getElementById('kr-del').onclick = () => { setRecipes(recipes().filter(x => x.id !== r.id)); api.ui.close(); api.ui.refresh(); };
        document.getElementById('kr-plan').onclick = () => { const days = weekOf(0).concat(weekOf(1)).filter(d => d >= api.util.todayKey()).slice(0, 8);
          api.ui.modal(`Plan ${esc(r.name)}`, `<div class="kr-days">${days.map(d => `<button class="btn" data-d="${d}">${esc(api.util.fmtDate(d))}</button>`).join('')}</div>`, '');
          document.querySelectorAll('.kr-days [data-d]').forEach(b => b.onclick = () => { const p = plan(); p[b.dataset.d] = { ...(p[b.dataset.d] || {}), dinner: { recipe: r.id } }; setPlan(p); api.ui.close(); api.ui.toast(`${r.name} on ${api.util.fmtDate(b.dataset.d)}`); api.ui.refresh(); }); };
      }

      function viewPlan(el) {
        const off = api.storage.get('week') || 0, days = weekOf(off), p = plan(), o = opts(), t0 = api.util.todayKey(), rs = recipes();
        const cell = (d, m) => { const e = (p[d] || {})[m], r = e && e.recipe && R(e.recipe), name = r ? r.name : e && e.text, past = d < t0;
          return `<div class="kp-cell ${e ? 'set' : ''} ${e && e.ate ? 'ate-' + e.ate : ''}" data-d="${d}" data-m="${m}">${e ? `<span class="nm" ${r ? `data-r="${esc(r.id)}"` : ''}>${esc(name)}</span>${past && !e.ate ? `<span class="kp-ate"><button data-ate="made" title="We made it">${api.ui.icon('check')}</button><button data-ate="skip" title="Didn’t happen">${api.ui.icon('x')}</button></span>` : `<button class="kp-x" data-clr title="Clear">${api.ui.icon('x')}</button>`}` : `<input placeholder="${past ? '' : 'Add…'}" list="kp-rl">`}</div>`; };
        el.innerHTML = `<div class="kp-bar"><button class="btn" data-w="-1">‹</button><b>${esc(api.util.fmtDate(days[0]))} – ${esc(api.util.fmtDate(days[6]))}</b><button class="btn" data-w="1">›</button><span class="sp"></span>
            ${MEALS.map(m => `<label class="kp-ml"><input type="checkbox" data-meal="${m}" ${o.meals.includes(m) ? 'checked' : ''}>${m[0].toUpperCase() + m.slice(1)}</label>`).join('')}<button class="btn primary" id="kp-shop">Shopping list from this week</button></div>
          <datalist id="kp-rl">${rs.map(r => `<option value="${esc(r.name)}">`).join('')}</datalist>
          <div class="kp-grid" style="grid-template-columns:90px repeat(7,minmax(var(--kp-col,0px),1fr))"><span></span>${days.map(d => `<span class="kp-dh ${d === t0 ? 'today' : ''}">${esc(api.util.fromYmd(d).toLocaleDateString([], { weekday: 'short', day: 'numeric' }))}</span>`).join('')}
            ${o.meals.map(m => `<span class="kp-mh">${m}</span>${days.map(d => cell(d, m)).join('')}`).join('')}</div>`;
        el.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { api.storage.set('week', off + +b.dataset.w); api.ui.refresh(); });
        el.querySelectorAll('[data-meal]').forEach(c => c.onchange = () => { const ms = MEALS.filter(m => el.querySelector(`[data-meal=${m}]`).checked); api.storage.set('opts', { ...o, meals: ms.length ? ms : ['dinner'] }); api.ui.refresh(); });
        el.querySelectorAll('.kp-cell input').forEach(i => { const save = () => { const v = i.value.trim(); if (!v) return; const c = i.closest('.kp-cell'), r = recipes().find(x => x.name.toLowerCase() === v.toLowerCase()), pp = plan(); pp[c.dataset.d] = { ...(pp[c.dataset.d] || {}), [c.dataset.m]: r ? { recipe: r.id } : { text: v } }; setPlan(pp); api.ui.refresh(); };
          i.onkeydown = e => { if (e.key === 'Enter') save(); }; i.onchange = save; });
        el.querySelectorAll('[data-clr]').forEach(b => b.onclick = () => { const c = b.closest('.kp-cell'), pp = plan(); if (pp[c.dataset.d]) delete pp[c.dataset.d][c.dataset.m]; setPlan(pp); api.ui.refresh(); });
        el.querySelectorAll('[data-ate]').forEach(b => b.onclick = () => { const c = b.closest('.kp-cell'), pp = plan(), e = pp[c.dataset.d][c.dataset.m]; e.ate = b.dataset.ate; setPlan(pp);
          if (e.recipe) setRecipes(recipes().map(r => r.id === e.recipe ? { ...r, [e.ate === 'made' ? 'made' : 'skipped']: (r[e.ate === 'made' ? 'made' : 'skipped'] || 0) + 1 } : r)); api.ui.refresh(); });
        el.querySelectorAll('.nm[data-r]').forEach(n => n.onclick = () => show(n.dataset.r));
        el.querySelector('#kp-shop').onclick = () => { let n = 0; for (const d of days) for (const m of MEALS) { const e = (plan()[d] || {})[m]; if (e && e.recipe && d >= t0) { const r = R(e.recipe); if (r) n += addToList(r.ingredients, r.name); } } api.ui.toast(n ? `${n} item${n === 1 ? '' : 's'} added` : 'Nothing new to add (only planned recipes from today on count)'); api.storage.set('tab', 'list'); api.ui.refresh(); };
      }
      function viewRecipes(el) {
        const rs = recipes().slice().sort((a, b) => (b.made || 0) - (a.made || 0) || (a.skipped || 0) - (b.skipped || 0) || b.at - a.at);
        el.innerHTML = `<div class="kr-add"><input class="inp" id="kr-url" placeholder="Paste a recipe link from any blog"><button class="btn primary" id="kr-go">Get recipe</button><button class="btn" id="kr-hand">Add by hand</button></div><div id="kr-msg" class="muted" style="font-size:12px;min-height:16px"></div>
          <div class="kr-grid">${rs.map(r => `<button class="kr-card" data-r="${esc(r.id)}"><div class="im" style="${r.image ? `background-image:url('${esc(r.image)}')` : ''}">${r.image ? '' : api.ui.icon('cooking-pot')}</div><b>${esc(r.name)}</b><span>${[r.minutes && r.minutes + ' min', r.made && `made ${r.made}×`, r.site].filter(Boolean).map(esc).join(' · ')}</span></button>`).join('') || '<div class="muted" style="grid-column:1/-1;padding:20px 0">No recipes yet. Paste a link above.</div>'}</div>`;
        const go = async () => { const u = el.querySelector('#kr-url').value.trim(), msg = el.querySelector('#kr-msg'); if (!u) return; msg.textContent = 'Reading the recipe…';
          try { const r = await fromLink(u); msg.textContent = ''; api.ui.refresh(); setTimeout(() => show(r.id), 50); } catch (e) { msg.textContent = e.message; } };
        el.querySelector('#kr-go').onclick = go; el.querySelector('#kr-url').onkeydown = e => { if (e.key === 'Enter') go(); };
        el.querySelector('#kr-hand').onclick = () => editRecipe(null);
        el.querySelectorAll('.kr-card').forEach(c => c.onclick = () => show(c.dataset.r));
      }
      function viewList(el) {
        const l = list(), groups = {}; l.forEach(x => (groups[x.aisle] = groups[x.aisle] || []).push(x));
        const order = [...AISLES.map(a => a[0]), 'Other'].filter(a => groups[a]);
        el.innerHTML = `<div class="kl-add"><input class="inp" id="kl-in" placeholder="Add an item (milk, 2 lemons…)"><button class="btn" id="kl-clr">Clear checked</button><button class="btn primary" id="kl-task">Make a Groceries task</button></div>
          ${order.map(a => `<div class="kl-g"><div class="sect">${esc(a)}</div>${groups[a].sort((x, y) => x.done - y.done).map(x => `<label class="kl-it ${x.done ? 'done' : ''}"><input type="checkbox" data-id="${esc(x.id)}" ${x.done ? 'checked' : ''}><span>${esc(x.name)}</span>${x.from ? `<em>${esc(x.from)}</em>` : ''}</label>`).join('')}</div>`).join('') || '<div class="muted" style="padding:16px 0">The list is empty.</div>'}`;
        const inp = el.querySelector('#kl-in'); inp.onkeydown = e => { if (e.key === 'Enter' && inp.value.trim()) { addToList(inp.value.split(/,\s*/)); api.ui.refresh(); setTimeout(() => document.getElementById('kl-in') && document.getElementById('kl-in').focus(), 30); } };
        el.querySelectorAll('.kl-it input').forEach(c => c.onchange = () => { setList(list().map(x => x.id === c.dataset.id ? { ...x, done: c.checked } : x)); c.closest('.kl-it').classList.toggle('done', c.checked); });
        el.querySelector('#kl-clr').onclick = () => { setList(list().filter(x => !x.done)); api.ui.refresh(); };
        el.querySelector('#kl-task').onclick = () => { const open = list().filter(x => !x.done); if (!open.length) return api.ui.toast('Nothing on the list');
          const notes = order.map(a => (groups[a] || []).filter(x => !x.done).length ? `${a}:\n` + groups[a].filter(x => !x.done).map(x => '- ' + x.name).join('\n') : '').filter(Boolean).join('\n\n');
          api.tasks.add({ title: `Groceries (${open.length} items)`, notes, dueDate: api.util.todayKey(), tags: ['groceries'], place: 'grocery store' }); api.ui.toast('Added to Today'); };
      }
      api.views.add({ id: 'kitchen', title: 'Kitchen', icon: '🍳', subtitle: 'Meal plan, recipes and the shopping list', wide: true, render: el => {
        const t = tab(), l = list().filter(x => !x.done).length;
        el.innerHTML = `<div class="seg kt-tabs">${[['plan', 'Meal plan'], ['recipes', `Recipes (${recipes().length})`], ['list', `Shopping list${l ? ` (${l})` : ''}`]].map(([v, n]) => `<button data-t="${v}" class="${t === v ? 'on' : ''}">${n}</button>`).join('')}</div><div id="kt-body"></div>`;
        el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { api.storage.set('tab', b.dataset.t); api.ui.refresh(); });
        ({ plan: viewPlan, recipes: viewRecipes, list: viewList })[t](el.querySelector('#kt-body'));
      } });
      api.widgets.add({ id: 'tonight', title: 'Tonight’s dinner', icon: 'utensils', size: 's', description: 'What’s planned for dinner, and the shopping list count.', render: el => {
        const e = (plan()[api.util.todayKey()] || {}).dinner, r = e && e.recipe && R(e.recipe), l = list().filter(x => !x.done).length;
        el.innerHTML = `<div class="kw">${r && r.image ? `<div class="im" style="background-image:url('${esc(r.image)}')"></div>` : ''}<small>Tonight</small><b>${esc(r ? r.name : e ? e.text : 'Nothing planned')}</b><span>${l} on the shopping list</span></div>`;
        el.querySelector('.kw').onclick = () => { if (r) show(r.id); else api.ui.navigate('view-kitchen'); }; } });
      api.commands.add({ title: 'Kitchen: meal plan', run: () => { api.storage.set('tab', 'plan'); api.ui.navigate('view-kitchen'); } });
      api.commands.add({ title: 'Kitchen: shopping list', run: () => { api.storage.set('tab', 'list'); api.ui.navigate('view-kitchen'); } });
      api.commands.add({ title: 'Add a recipe from a link', run: () => { api.storage.set('tab', 'recipes'); api.ui.navigate('view-kitchen'); setTimeout(() => document.getElementById('kr-url') && document.getElementById('kr-url').focus(), 120); } });
      window.__kitchen = { addToList, fromLink, scale, aisleOf, tonight: () => { const e = (plan()[api.util.todayKey()] || {}).dinner, r = e && e.recipe && R(e.recipe); return e ? { name: r ? r.name : e.text, image: r && r.image } : null; }, listCount: () => list().filter(x => !x.done).length };
      css('kt-css', `.kt-tabs{margin-bottom:14px}
        .kp-bar{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap}.kp-bar .sp{flex:1}.kp-ml{font-size:13px;display:inline-flex;align-items:center;gap:4px;color:var(--muted)}
        .kp-grid{display:grid;gap:6px}.kp-dh{font-size:12px;font-weight:700;color:var(--muted);text-align:center}.kp-dh.today{color:var(--accent)}.kp-mh{font-size:12px;text-transform:capitalize;color:var(--muted);align-self:center}
        .kp-cell{min-height:74px;border:1px dashed var(--line);border-radius:var(--r);padding:6px;display:flex;flex-direction:column;gap:4px;position:relative;font-size:13px}
        .kp-cell.set{border-style:solid;background:var(--panel)}.kp-cell input{border:0;background:none;width:100%;font:12.5px Inter,system-ui;color:var(--text);outline:none}
        .kp-cell .nm{font-weight:600;line-height:1.25}.kp-cell .nm[data-r]{cursor:pointer}.kp-cell .nm[data-r]:hover{color:var(--accent)}
        .kp-cell.ate-made{border-color:#22c55e}.kp-cell.ate-skip{opacity:.5}.kp-cell.ate-skip .nm{text-decoration:line-through}
        .kp-ate{display:flex;gap:4px;margin-top:auto}.kp-ate button,.kp-x{border:1px solid var(--line);background:var(--bg);border-radius:var(--r-s);padding:2px 4px;cursor:pointer;color:var(--muted);display:flex}.kp-ate svg,.kp-x svg{width:12px;height:12px}
        .kp-x{position:absolute;top:4px;right:4px;opacity:0}.kp-cell:hover .kp-x{opacity:1}
        .kr-add,.kl-add{display:flex;gap:8px;margin-bottom:6px}.kr-add .inp,.kl-add .inp{flex:1}
        .kr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-top:8px}
        .kr-card{text-align:left;border:1px solid var(--line);border-radius:var(--r-l);background:var(--panel);padding:0 0 10px;cursor:pointer;overflow:hidden;display:flex;flex-direction:column;gap:3px;color:var(--text)}
        .kr-card .im{aspect-ratio:4/3;background:var(--hover) center/cover;display:flex;align-items:center;justify-content:center;color:var(--muted)}.kr-card .im svg{width:30px;height:30px}
        .kr-card b{padding:6px 10px 0;font-size:13px;line-height:1.3}.kr-card span{padding:0 10px;font-size:12px;color:var(--muted)}
        .kr-hero{height:200px;border-radius:var(--r-l);background:center/cover;margin-bottom:10px}.kr-meta{display:flex;gap:14px;align-items:center;font-size:13px;color:var(--muted);margin-bottom:10px;flex-wrap:wrap}
        .kr-meta span{display:inline-flex;align-items:center;gap:5px}.kr-meta svg{width:14px;height:14px}.kr-meta button{border:1px solid var(--line);background:none;border-radius:var(--r-s);width:22px;cursor:pointer;color:var(--text)}
        .kr-cols{display:grid;grid-template-columns:1fr 1.4fr;gap:20px}.kr-cols h4{margin:0 0 6px}.kr-cols ul,.kr-cols ol{margin:0;padding-left:18px;font-size:13px;line-height:1.5}.kr-cols li{margin-bottom:4px}.kr-cols h5{margin:10px 0 4px}
        .kr-days{display:flex;flex-wrap:wrap;gap:6px}
        .kl-it{display:flex;align-items:center;gap:10px;padding:7px 2px;border-bottom:1px solid var(--line);font-size:14px;cursor:pointer}.kl-it span{flex:1}.kl-it em{font-style:normal;font-size:12px;color:var(--muted)}.kl-it.done span{text-decoration:line-through;color:var(--muted)}
        .kw{cursor:pointer;display:flex;flex-direction:column;gap:2px}.kw .im{height:70px;border-radius:var(--r-m);background:center/cover;margin-bottom:6px}.kw small{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}.kw b{font-size:14px}.kw span{font-size:12px;color:var(--muted)}
        @media (max-width:900px){.kr-cols{grid-template-columns:1fr}}`);
    },
  });
})();
