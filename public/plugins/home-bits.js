/* Home helpers (Life; user picked 2026-11-16): dinner ideas (TheMealDB), garbage night (Loyalist Township preset:
   Tuesday east of Speers Blvd, Wednesday west; or any weekly day), scan a barcode onto the shopping list (Open Food
   Facts), and your shows airing soon (TVmaze). Data fetched by the NAS; recipes and the list go into Kitchen. */
(() => {
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const PRESETS = { 'loyalist-east': { day: 2, label: 'Loyalist Township, Amherstview east of Speers Blvd (Tuesday)' }, 'loyalist-west': { day: 3, label: 'Loyalist Township, Bath and Amherstview west of Speers Blvd (Wednesday)' }, custom: { day: null, label: 'My own day' } };
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

  // the next pickup: today until noon on a pickup day, otherwise the next one
  function nextPickup(cfg, now = new Date()) {
    const day = cfg.preset === 'custom' ? cfg.day : PRESETS[cfg.preset].day, d = new Date(now); d.setHours(0, 0, 0, 0);
    for (let i = 0; i < 8; i++) { const x = new Date(d); x.setDate(d.getDate() + i); if (x.getDay() === day && (i > 0 || now.getHours() < 12)) return x; }
    return null;
  }
  window.CadenceHomeBits = { nextPickup, PRESETS };   // for tests

  Cadence.registerPlugin({
    settings(api) { const c = Object.assign({ preset: 'loyalist-east', day: 2, what: 'Garbage and recycling', remind: '19:00', on: true }, api.storage.get('garbage') || {});
      window.LifeKit.form(api, 'Home helpers', [{ k: 'on', type: 'check', label: 'Remind me the evening before garbage night' }, { k: 'remind', type: 'time', label: 'At', w: '140px' }], c, o => api.storage.set('garbage', Object.assign(c, { on: !!o.on, remind: o.remind || '19:00' }))); },
    id: 'home-bits', name: 'Home helpers', version: '1.0.0', category: 'Life', color: '#16a34a', spaces: ['life'],
    icon: '<path d="m15 11-1 9"/><path d="m19 11-4-7"/><path d="M2 11h20"/><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4"/><path d="M4.5 15.5h15"/><path d="m5 11 4-7"/><path d="m9 11 1 9"/>',
    tagline: 'Dinner ideas, garbage night, barcodes to the shopping list, and your shows.',
    description: 'Dinner ideas you can save to Kitchen or put straight on the shopping list. A reminder the evening before garbage day (set up for Loyalist Township, or any weekly day). Scan or type a barcode to add the product to the shopping list. And when your shows have new episodes. Free data fetched by your NAS.',
    setup(api) {
      const K = () => window.CadenceKitchen;
      const nas = () => api.system().mode === 'nas';
      const G = { meals: null, tv: null, tvAt: 0 };
      const refresh = () => { api.ui.refreshWidgets && api.ui.refreshWidgets(); if (api.ui.currentRoute() === 'view-home-bits') api.ui.refresh(); };
      const getJson = async u => { const r = await fetch(u); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j; };

      // ---------------- garbage night ----------------
      const gcfg = () => Object.assign({ preset: 'loyalist-east', day: 2, what: 'Garbage and recycling', remind: '19:00', on: true }, api.storage.get('garbage') || {});
      const garbageLine = () => {
        const c = gcfg(), d = nextPickup(c); if (!d) return { head: 'Set your pickup day', sub: '' };
        const now = new Date(), today = ymd(now), tm = new Date(now); tm.setDate(now.getDate() + 1);
        if (ymd(d) === today) return { head: `${c.what}: pickup today`, sub: 'At the curb by 7 am.', when: 'today' };
        if (ymd(d) === ymd(tm)) return { head: `${c.what} go out tonight`, sub: `Pickup tomorrow, ${DAYS[d.getDay()]}, by 7 am.`, when: 'eve' };
        return { head: `Next pickup ${d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}`, sub: c.what, when: 'later' };
      };
      // the evening before, at your reminder time, once
      const gtick = () => {
        const c = gcfg(); if (!c.on || !api.island || !api.island.notify) return;
        const l = garbageLine(), [h, m] = String(c.remind || '19:00').split(':').map(Number), now = new Date(), key = ymd(now);
        if (l.when === 'eve' && now.getHours() * 60 + now.getMinutes() >= h * 60 + (m || 0) && api.storage.get('gNoted') !== key) {
          api.storage.set('gNoted', key); api.island.notify({ icon: 'trash-2', title: l.head, sub: l.sub });
        }
      };
      const gt = setInterval(gtick, 5 * 60e3); setTimeout(gtick, 8000);

      // ---------------- dinner ideas ----------------
      const loadMeals = async () => { G.meals = 'busy'; refresh(); try { G.meals = await getJson('api/daily/meals?n=3'); } catch (e) { G.meals = { error: e.message }; } refresh(); };
      const mealCards = (compact) => {
        if (!nas()) return '<p class="muted">Needs the NAS.</p>';
        if (G.meals === null) { loadMeals(); return '<p class="muted">Finding ideas…</p>'; }
        if (G.meals === 'busy') return '<p class="muted">Finding ideas…</p>';
        if (G.meals.error) return `<p class="muted">Couldn't get ideas right now.</p>`;
        return `<div class="hb-meals">${G.meals.map((m, i) => `<div class="hb-meal">${m.image ? `<img src="${E(m.image)}/preview" alt="" loading="lazy" onerror="this.src='${E(m.image)}'">` : ''}
          <div><b>${E(m.name)}</b><span class="muted">${E([m.area, m.category].filter(Boolean).join(' · '))} · ${m.ingredients.length} ingredients</span>
          ${compact ? '' : `<div class="hb-act"><button class="btn" data-hb="save" data-i="${i}">Save to Kitchen</button><button class="btn" data-hb="shop" data-i="${i}">Add ingredients to the list</button>${m.url ? `<a class="btn" href="${E(m.url)}" target="_blank" rel="noopener">Original</a>` : ''}</div>`}</div></div>`).join('')}</div>
          <button class="btn hb-more" data-hb="more">${api.ui.icon('refresh-cw')}Other ideas</button>`;
      };

      // ---------------- barcode → shopping list ----------------
      const addItem = (name, from) => {
        if (K()) { const n = K().addToList([name], from); api.ui.toast(n ? `Added ${name} to the shopping list` : `${name} is already on the list`); }
        else { api.tasks.add({ title: 'Buy ' + name }); api.ui.toast(`Added "Buy ${name}"`); }
      };
      const lookup = async code => {
        const out = document.getElementById('hb-bc-out'); if (out) out.innerHTML = '<p class="muted">Looking it up…</p>';
        try {
          const p = await getJson('api/daily/food?code=' + encodeURIComponent(code));
          if (!out) return;
          if (!p.found) { out.innerHTML = `<p class="muted">Open Food Facts doesn't know ${E(code)}. Type what it is instead:</p><div class="hb-row"><input class="inp" id="hb-bc-name" placeholder="e.g. oat milk"><button class="btn" id="hb-bc-add2">Add</button></div>`;
            out.querySelector('#hb-bc-add2').onclick = () => { const v = out.querySelector('#hb-bc-name').value.trim(); if (v) addItem(v, 'Scanned'); }; return; }
          out.innerHTML = `<div class="hb-prod">${p.image ? `<img src="${E(p.image)}" alt="">` : ''}<div><b>${E(p.name || p.product)}</b><span class="muted">${E(p.quantity || '')}</span></div><button class="btn primary" id="hb-bc-add">Add to the shopping list</button></div>`;
          out.querySelector('#hb-bc-add').onclick = () => addItem(p.product || p.name, 'Scanned');
        } catch (e) { if (out) out.innerHTML = `<p class="muted">${E(e.message)}</p>`; }
      };
      let stream = null;
      const stopCam = () => { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } };
      const scan = async () => {
        const box = document.getElementById('hb-cam'); if (!box) return;
        if (!('BarcodeDetector' in window)) { box.innerHTML = '<p class="muted">This browser can\'t read barcodes from the camera. Type the number under the barcode instead.</p>'; return; }
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          box.innerHTML = '<video autoplay playsinline muted></video><p class="muted">Point the camera at a barcode.</p>';
          const v = box.querySelector('video'); v.srcObject = stream;
          const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
          const loop = async () => { if (!stream) return; try { const r = await det.detect(v); if (r[0]) { stopCam(); box.innerHTML = ''; document.getElementById('hb-bc').value = r[0].rawValue; return lookup(r[0].rawValue); } } catch (e) {} setTimeout(loop, 300); };
          v.onloadeddata = loop;
        } catch (e) { box.innerHTML = '<p class="muted">The camera isn\'t available. Type the number under the barcode instead.</p>'; }
      };

      // ---------------- TV ----------------
      const shows = () => api.storage.get('shows') || [];
      const loadTv = async (force) => {
        if (!shows().length) { G.tv = []; return; }
        if (!force && G.tv && Date.now() - G.tvAt < 3 * 3600e3) return;
        try { G.tv = await getJson('api/daily/tv?ids=' + shows().map(s => s.id).join(',')); G.tvAt = Date.now(); } catch (e) { G.tv = G.tv || []; }
        refresh();
      };
      const when = iso => { const d = new Date(iso), t = new Date(), tm = new Date(t); tm.setDate(t.getDate() + 1);
        const day = d.toDateString() === t.toDateString() ? 'Tonight' : d.toDateString() === tm.toDateString() ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
        return day + ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); };
      const upcoming = (days = 7) => (G.tv || []).filter(s => s.next && s.next.airstamp && Date.parse(s.next.airstamp) - Date.now() < days * 864e5 && Date.parse(s.next.airstamp) > Date.now() - 3 * 3600e3)
        .sort((a, b) => Date.parse(a.next.airstamp) - Date.parse(b.next.airstamp));
      const tvList = (days) => { if (G.tv === null) { loadTv(); return '<p class="muted">Loading…</p>'; }
        if (!shows().length) return '<p class="muted">Add the shows you watch to see when new episodes air.</p>';
        const u = upcoming(days);
        return u.length ? `<ul class="hb-tv">${u.map(s => `<li><b>${E(when(s.next.airstamp))}</b><span>${E(s.name)} · S${s.next.season}E${s.next.number}${s.next.name ? ' “' + E(s.next.name) + '”' : ''}</span><span class="muted">${E(s.network || '')}</span></li>`).join('')}</ul>` : `<p class="muted">Nothing new in the next ${days} days.</p>`; };

      // ---------------- cards and page ----------------
      api.widgets.add({ id: 'garbage', title: 'Garbage night', icon: 'trash-2', size: 's', description: 'Which night the bins go out.', render: el => {
        const l = garbageLine(); el.innerHTML = `<div class="hb-g ${l.when || ''}"><b>${E(l.head)}</b><span class="muted">${E(l.sub)}</span></div>`;
        el.querySelector('.hb-g').onclick = () => api.ui.navigate('view-home-bits'); } });
      api.widgets.add({ id: 'dinner-ideas', title: 'Dinner ideas', icon: 'utensils', size: 'm', description: 'Three ideas for dinner.', render: el => {
        el.innerHTML = mealCards(true); const b = el.querySelector('[data-hb="more"]'); if (b) b.onclick = loadMeals; } });
      api.widgets.add({ id: 'tv-soon', site: 'tvmaze.com', title: 'Your shows', icon: 'tv', size: 'm', description: 'New episodes of the shows you watch.', render: el => { el.innerHTML = nas() ? tvList(7) : '<p class="muted">Needs the NAS.</p>'; } });

      api.views.add({ id: 'home-bits', title: 'Home helpers', icon: '🧺', subtitle: 'Dinner ideas, garbage night, barcodes and your shows', wide: true, render: el => {
        const c = gcfg(), l = garbageLine();
        el.innerHTML = `<div class="hb">
          <section><h3>Garbage night</h3><div class="hb-g ${l.when || ''}"><b>${E(l.head)}</b><span class="muted">${E(l.sub)}</span></div>
            <div class="hb-form"><label>Where<select class="inp" id="hb-gp">${Object.entries(PRESETS).map(([k, p]) => `<option value="${k}" ${c.preset === k ? 'selected' : ''}>${E(p.label)}</option>`).join('')}</select></label>
            ${c.preset === 'custom' ? `<label>Pickup day<select class="inp" id="hb-gd">${DAYS.map((d, i) => `<option value="${i}" ${+c.day === i ? 'selected' : ''}>${d}</option>`).join('')}</select></label>` : ''}
            <label>What goes out<input class="inp" id="hb-gw" value="${E(c.what)}"></label>
            <label>Remind me the evening before at<input class="inp" id="hb-gr" type="time" value="${E(c.remind)}"></label>
            <label class="hb-chk"><input type="checkbox" id="hb-go" ${c.on ? 'checked' : ''}> Remind me</label></div>
            <p class="muted hb-note">Holiday weeks can move pickup by a day. Loyalist posts those changes in the Recycle Coach app and on loyalist.ca.</p></section>
          <section><h3>Dinner ideas</h3>${mealCards(false)}</section>
          <section><h3>Scan to the shopping list</h3><div class="hb-row"><input class="inp" id="hb-bc" inputmode="numeric" placeholder="Barcode number"><button class="btn" id="hb-bc-go">Look up</button><button class="btn" id="hb-bc-cam">${api.ui.icon('camera')}Scan</button></div>
            <div id="hb-cam"></div><div id="hb-bc-out"></div><p class="muted hb-note">Product names from Open Food Facts.</p></section>
          <section><h3>Your shows</h3>${nas() ? tvList(14) : ''}
            <div class="hb-row"><input class="inp" id="hb-tq" placeholder="Add a show"><button class="btn" id="hb-tgo">Find</button></div><div id="hb-tres"></div>
            ${shows().length ? `<div class="hb-chips">${shows().map(s => `<span class="hb-chip">${E(s.name)}<button data-rm="${s.id}" aria-label="Remove ${E(s.name)}">${api.ui.icon('x')}</button></span>`).join('')}</div>` : ''}
            <p class="muted hb-note">Episode times from TVmaze.</p></section></div>`;
        const $ = id => el.querySelector('#' + id), save = o => { api.storage.set('garbage', Object.assign(gcfg(), o)); api.ui.refresh(); refresh(); };
        $('hb-gp').onchange = e => save({ preset: e.target.value });
        if ($('hb-gd')) $('hb-gd').onchange = e => save({ day: +e.target.value });
        $('hb-gw').onchange = e => save({ what: e.target.value.trim() || 'Garbage and recycling' });
        $('hb-gr').onchange = e => save({ remind: e.target.value || '19:00' });
        $('hb-go').onchange = e => save({ on: e.target.checked });
        el.querySelectorAll('[data-hb]').forEach(b => b.onclick = () => {
          const m = Array.isArray(G.meals) ? G.meals[+b.dataset.i] : null;
          if (b.dataset.hb === 'more') loadMeals();
          else if (b.dataset.hb === 'save' && m) { if (!K()) return api.ui.toast('Turn on Kitchen to save recipes'); K().addRecipe({ name: m.name, image: m.image, ingredients: m.ingredients, steps: m.steps, url: m.url, source: 'TheMealDB' }); api.ui.toast(`Saved ${m.name} to Kitchen`); }
          else if (b.dataset.hb === 'shop' && m) { if (!K()) return api.ui.toast('Turn on Kitchen to use the shopping list'); const n = K().addToList(m.ingredients, m.name); api.ui.toast(`${n} item${n === 1 ? '' : 's'} added to the shopping list`); }
        });
        $('hb-bc-go').onclick = () => { const v = $('hb-bc').value.trim(); if (v) lookup(v); };
        $('hb-bc').onkeydown = e => { if (e.key === 'Enter') $('hb-bc-go').click(); };
        $('hb-bc-cam').onclick = scan;
        const find = async () => { const q = $('hb-tq').value.trim(); if (q.length < 2) return; const box = $('hb-tres'); box.innerHTML = '<p class="muted">Looking…</p>';
          try { const r = await getJson('api/daily/tv-search?q=' + encodeURIComponent(q));
            box.innerHTML = r.length ? `<ul class="hb-res">${r.map((s, i) => `<li><b>${E(s.name)}</b><span class="muted">${E([s.network, s.premiered && s.premiered.slice(0, 4), s.status].filter(Boolean).join(' · '))}</span><button class="btn" data-add="${i}">Add</button></li>`).join('')}</ul>` : '<p class="muted">Nothing found.</p>';
            box.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { const s = r[+b.dataset.add]; if (!shows().some(x => x.id === s.id)) api.storage.set('shows', [...shows(), { id: s.id, name: s.name }]); loadTv(true).then(() => api.ui.refresh()); });
          } catch (e) { box.innerHTML = '<p class="muted">Search isn\'t working right now.</p>'; } };
        $('hb-tgo').onclick = find; $('hb-tq').onkeydown = e => { if (e.key === 'Enter') find(); };
        el.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { api.storage.set('shows', shows().filter(s => s.id !== +b.dataset.rm)); G.tv = (G.tv || []).filter(s => s.id !== +b.dataset.rm); api.ui.refresh(); });
      } });

      const css = document.createElement('style');
      css.textContent = `.hb{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:22px;max-width:1200px} .hb h3{margin:0 0 8px;font-size:15px}
        .hb-g{display:flex;flex-direction:column;gap:2px;cursor:pointer} .hb-g.eve b,.hb-g.today b{color:var(--accent)}
        .hb-form{display:flex;flex-direction:column;gap:8px;margin-top:10px} .hb-form label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--muted)} .hb-chk{flex-direction:row!important;align-items:center}
        .hb-note{font-size:12px} .hb-row{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0} .hb-row .inp{flex:1;min-width:140px}
        .hb-meals{display:flex;flex-direction:column;gap:10px} .hb-meal{display:flex;gap:10px} .hb-meal img{width:64px;height:64px;border-radius:var(--r-m);object-fit:cover;flex:none}
        .hb-meal>div{display:flex;flex-direction:column;gap:2px;font-size:13px} .hb-act{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px} .hb-act .btn{font-size:12px;padding:3px 8px} .hb-more{margin-top:8px;display:inline-flex;gap:6px;align-items:center}
        #hb-cam video{width:100%;max-width:360px;border-radius:var(--r-m)} .hb-prod{display:flex;gap:10px;align-items:center;flex-wrap:wrap} .hb-prod img{width:56px;height:56px;object-fit:contain} .hb-prod>div{flex:1;display:flex;flex-direction:column}
        .hb-tv,.hb-res{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px;font-size:13px} .hb-tv li{display:grid;grid-template-columns:170px 1fr auto;gap:8px}
        .hb-res li{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center} .hb-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
        .hb-chip{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--line);border-radius:999px;padding:2px 4px 2px 10px;font-size:12px} .hb-chip button{background:none;border:0;cursor:pointer;color:var(--muted);display:flex}
        @media (max-width:640px){.hb-tv li{grid-template-columns:1fr}}`;
      document.head.appendChild(css);
      return () => { clearInterval(gt); stopCam(); css.remove(); };
    },
  });
})();
