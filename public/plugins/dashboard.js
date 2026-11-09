/* Dashboards: build your own pages out of widgets. Drag from the library, move, resize, configure.
   Any plugin can offer widgets with api.widgets.add(); this plugin also ships a starter set.
   Pages can be your home page (Cadence opens there) or docked as a side panel next to everything else. */
Cadence.registerPlugin({
  id: 'dashboard', name: 'Dashboards', version: '1.0.0', category: 'Productivity',
  description: 'Build your own pages from widgets: today\'s focus, quick add, notes, clocks, Zoho status, client stocks, links and anything other plugins offer. Drag to move, pull the corner to resize, make a page your home screen or dock it beside the app.',
  tagline: 'Drag-and-drop pages, your way', color: '#0ea5a4',
  icon: '<rect x="3.5" y="3.5" width="7" height="9" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="5" rx="1.5"/><rect x="13.5" y="11.5" width="7" height="9" rx="1.5"/><rect x="3.5" y="15.5" width="7" height="5" rx="1.5"/>',
  settings(api) { api.ui.navigate('view-dash'); setTimeout(() => window.__dash && window.__dash.pageSettings(), 120); },
  setup(api) {
    const D = window.__dash = window.__dash || { edit: false, page: null, booted: false };
    const E = api.ui.esc, COLS = 12, ROW = 76, GAP = 14;
    const SIZES = { s: [3, 2], m: [4, 3], l: [6, 4], w: [12, 2], row: [12, 1], t: [3, 4], xl: [8, 5] };
    const uid = () => Math.random().toString(36).slice(2, 9);

    /* ---------------- built-in widgets ---------------- */
    const W = (id, def) => api.widgets.add({ id, ...def });
    const ymd = api.util.ymd, today = () => api.util.todayKey();
    W('focus', { title: "Today's focus", icon: '☀', size: 'l', description: 'Overdue and due today. Tick them off right here.',
      fields: [{ key: 'max', label: 'How many', type: 'number' }, { key: 'clients', label: 'Show client names', type: 'checkbox' }],
      render(el, api, ctx) {
        const t = today(), max = +ctx.cfg.max || 8;
        const list = api.tasks.list(x => !x.done && x.owner !== 'client' && x.dueDate && x.dueDate <= t).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '') || (b.priority || 0) - (a.priority || 0));
        el.innerHTML = `<div class="dw-list">${list.slice(0, max).map(x => { const c = x.clientId && ctx.cfg.clients !== false ? api.clients.get(x.clientId) : null; return `<div class="dw-task ${x.priority >= 3 ? 'p3' : ''}" data-id="${E(x.id)}"><button class="check" aria-label="Complete"></button><span class="tt">${E(x.title)}${c ? `<small>${E(c.name)}</small>` : ''}</span>${x.dueDate < t ? `<em>${api.space() === 'life' ? 'earlier' : 'overdue'}</em>` : x.dueTime ? `<em class="t">${E(x.dueTime)}</em>` : ''}</div>`; }).join('') || '<div class="dw-empty">Nothing due. Enjoy it.</div>'}${list.length > max ? `<div class="dw-more">+${list.length - max} more</div>` : ''}</div>`;
        el.querySelectorAll('.dw-task .check').forEach(b => b.onclick = () => { const row = b.closest('.dw-task'); row.classList.add('done'); setTimeout(() => api.tasks.complete(row.dataset.id), 320); });
        el.querySelectorAll('.dw-task .tt').forEach(t => t.onclick = () => { const x = api.tasks.get(t.closest('.dw-task').dataset.id); api.ui.navigate(x && x.clientId ? 'client-' + x.clientId : 'today'); });
      } });
    W('quickadd', { title: 'Quick add', icon: '+', size: 'w', description: 'Add a task from anywhere. Same syntax as everywhere else: @client fri 3pm !1 #tag',
      render(el, api) {
        el.innerHTML = `<div class="dw-qa"><span>+</span><input placeholder="${api.space() === 'life' ? 'Add something… @home sat every month' : 'Add a task… @client fri 3pm !1'}" autocomplete="off"></div>`;
        const i = el.querySelector('input'); i.onkeydown = e => { if (e.key === 'Enter' && i.value.trim()) { api.tasks.quickAdd(i.value.trim(), {}); api.island.show({ check: true, title: 'Added', sub: i.value.trim(), ms: 1800 }); i.value = ''; } };
      } });
    W('clock', { title: 'Clock', icon: '◷', size: 'm', description: 'Big time, date and a greeting.',
      fields: [{ key: 'tz', label: 'Time zone (blank = yours), e.g. Europe/London', type: 'text' }, { key: 'label', label: 'Label', type: 'text' }],
      render(el, api, ctx) {
        const draw = () => { if (!el.isConnected) return clearInterval(t); const o = ctx.cfg.tz ? { timeZone: ctx.cfg.tz } : {}; let now; try { now = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', ...o }); } catch (e) { now = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
          const h = new Date().getHours(); el.innerHTML = `<div class="dw-clock"><b>${E(now)}</b><span>${E(ctx.cfg.label || (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'))}</span><small>${new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', ...o })}</small></div>`; };
        draw(); const t = setInterval(draw, 15000);
      } });
    W('stats', { title: 'At a glance', icon: '▦', size: 'row', minH: 1, description: 'Done today, due today, overdue, waiting on clients.',
      render(el, api) {
        const t = today(), all = api.tasks.list(), open = all.filter(x => !x.done);
        const life = api.space() === 'life', wk = api.util.ymd(api.util.addDays(new Date(), 7));
        const n = { done: all.filter(x => x.done && x.doneAt && ymd(new Date(x.doneAt)) === t).length, due: open.filter(x => x.owner !== 'client' && x.dueDate === t).length, over: open.filter(x => x.owner !== 'client' && x.dueDate && x.dueDate < t).length, wait: life ? open.filter(x => x.dueDate && x.dueDate > t && x.dueDate <= wk).length : open.filter(x => x.owner === 'client').length };
        el.innerHTML = `<div class="dw-stats">${[['done', 'done today', 'ok', 'today'], ['due', 'due today', '', 'today'], ['over', life ? (n.over ? 'still on the list' : 'all caught up') : n.over ? 'overdue — clear them' : 'nothing overdue', life ? '' : 'bad', 'today'], ['wait', life ? 'coming up this week' : 'waiting on clients', life ? '' : 'cl', life ? 'upcoming' : 'waiting']].map(([k, l, c, go]) => `<div class="gl ${c}" data-nav="${go}"><div class="tx"><div class="v">${n[k]}</div><div class="l">${l}</div></div></div>`).join('')}</div>`;
        el.querySelectorAll('[data-nav]').forEach(g => g.onclick = () => api.ui.navigate(g.dataset.nav));
      } });
    W('waiting', { title: 'Waiting on clients', icon: '⧗', size: 'm', spaces: ['work'], description: 'Who owes you what, oldest first.',
      render(el, api) {
        const by = new Map(); api.tasks.list(x => !x.done && x.owner === 'client' && x.clientId).forEach(x => { by.set(x.clientId, (by.get(x.clientId) || []).concat([x])); });
        const rows = [...by.entries()].map(([cid, xs]) => ({ c: api.clients.get(cid), n: xs.length, age: Math.max(...xs.map(x => Date.now() - (x.lastChased || x.createdAt || Date.now()))) / 864e5 })).filter(r => r.c).sort((a, b) => b.age - a.age);
        el.innerHTML = `<div class="dw-list">${rows.map(r => `<div class="dw-row" data-c="${E(r.c.id)}">${api.ui.avatar(r.c, 20)}<span>${E(r.c.name)}</span><em>${r.n} · ${Math.floor(r.age)}d</em></div>`).join('') || '<div class="dw-empty">Nobody owes you anything.</div>'}</div>`;
        el.querySelectorAll('[data-c]').forEach(r => r.onclick = () => api.ui.navigate('client-' + r.dataset.c));
      } });
    W('note', { title: 'Sticky note', icon: '✎', size: 's', description: 'Scribble anything. Saved as you type.',
      fields: [{ key: 'color', label: 'Colour', type: 'select', options: ['yellow', 'pink', 'blue', 'green', 'plain'] }],
      render(el, api, ctx) {
        el.innerHTML = `<textarea class="dw-note ${E(ctx.cfg.color || 'yellow')}" placeholder="Write something…">${E(ctx.cfg.text || '')}</textarea>`;
        const ta = el.querySelector('textarea'); let t; ta.oninput = () => { clearTimeout(t); t = setTimeout(() => ctx.setCfg({ text: ta.value }, true), 500); };
      } });
    W('text', { title: 'Text', icon: '¶', size: 'w', description: 'A heading or a paragraph for your page. **bold**, # heading, - list.',
      fields: [{ key: 'text', label: 'Text', type: 'textarea' }, { key: 'align', label: 'Align', type: 'select', options: ['left', 'center'] }],
      render(el, api, ctx) {
        const md = s => E(s || '').split('\n').map(l => /^#\s/.test(l) ? `<h2>${l.slice(2)}</h2>` : /^-\s/.test(l) ? `<li>${l.slice(2)}</li>` : l ? `<p>${l}</p>` : '').join('').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        el.innerHTML = `<div class="dw-text" style="text-align:${ctx.cfg.align === 'center' ? 'center' : 'left'}">${md(ctx.cfg.text || '# Hello\nUse the gear to write anything here.')}</div>`;
      } });
    W('image', { title: 'Image', icon: '▣', size: 'm', description: 'A picture, mood board or logo from a URL.',
      fields: [{ key: 'url', label: 'Image URL (https)', type: 'text' }, { key: 'fit', label: 'Fit', type: 'select', options: ['cover', 'contain'] }],
      render(el, api, ctx) { const u = /^https:\/\//.test(ctx.cfg.url || '') ? ctx.cfg.url : ''; el.innerHTML = u ? `<div class="dw-img" style="background-image:url('${E(u).replace(/'/g, '%27')}');background-size:${ctx.cfg.fit === 'contain' ? 'contain' : 'cover'}"></div>` : '<div class="dw-empty">Set an image URL with the gear.</div>'; } });
    W('embed', { title: 'Web page', icon: '⧉', size: 'l', description: 'Embed a web page (many sites block embedding).',
      fields: [{ key: 'url', label: 'Page URL (https)', type: 'text' }],
      render(el, api, ctx) { const u = /^https:\/\//.test(ctx.cfg.url || '') ? ctx.cfg.url : ''; el.innerHTML = u ? `<iframe class="dw-frame" src="${E(u)}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerpolicy="no-referrer" loading="lazy"></iframe>` : '<div class="dw-empty">Set a page URL with the gear.</div>'; } });
    W('spacer', { title: 'Spacer', icon: '·', size: 'w', minH: 1, description: 'Empty space, or a divider line.',
      fields: [{ key: 'line', label: 'Show a divider line', type: 'checkbox' }],
      render(el, api, ctx) { el.innerHTML = ctx.cfg.line ? '<hr class="dw-hr">' : ''; } });

    /* ---------------- pages ---------------- */
    function starter() {
      const it = (key, x, y, w, h, cfg = {}) => ({ iid: uid(), key, x, y, w, h, cfg });
      if (api.space() === 'life') return [{ id: 'home', name: 'Home', icon: '🌿', items: [
        it('dashboard:clock', 0, 0, 4, 2), it('dashboard:quickadd', 4, 0, 8, 2), it('dashboard:stats', 0, 2, 12, 1),
        it('dashboard:focus', 0, 3, 7, 5, { title: 'Today' }), it('dashboard:note', 7, 3, 5, 3, { color: 'green', text: 'This week:\n- ' }), it('weblinks:links', 7, 6, 5, 2)] }];
      return [{ id: 'home', name: 'Home', icon: '⌂', items: [
        it('dashboard:clock', 0, 0, 4, 2), it('dashboard:quickadd', 4, 0, 8, 2), it('dashboard:stats', 0, 2, 12, 1),
        it('dashboard:focus', 0, 3, 7, 5), it('dashboard:waiting', 7, 3, 5, 3), it('dashboard:note', 7, 6, 5, 2, { color: 'yellow', text: 'Drag me around in Edit mode ✨' }),
        it('zoho-status:board', 0, 8, 7, 3), it('stocks:market', 7, 8, 5, 3)] }];
    }
    // the starter page is saved the first time it's needed, so its widget ids stay stable
    const pages = () => { const p = api.storage.get('pages'); if (Array.isArray(p) && p.length) return p; const st = starter(); api.storage.set('pages', st); return st; };
    const savePages = p => api.storage.set('pages', p);
    const cur = () => { const p = pages(); return p.find(x => x.id === D.page) || p[0]; };
    function updatePage(fn) { const p = pages(), pg = p.find(x => x.id === cur().id); fn(pg); savePages(p); }

    /* ---------------- layout engine: collisions push down, then everything floats up ---------------- */
    const hit = (a, b) => a !== b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    function settle(items, moved) {
      const push = m => { for (const o of items) if (hit(m, o) && o !== m) { o.y = m.y + m.h; push(o); } };
      if (moved) push(moved);
      const sorted = items.slice().sort((a, b) => a.y - b.y || a.x - b.x), placed = [];
      for (const it of sorted) {
        if (it !== moved) while (it.y > 0 && !placed.some(p => hit({ ...it, y: it.y - 1 }, p))) it.y--;
        placed.push(it);
      }
      return items;
    }
    function freeSpot(items, w, h) { for (let y = 0; y < 200; y++) for (let x = 0; x + w <= COLS; x++) { const c = { x, y, w, h }; if (!items.some(o => hit(c, o))) return { x, y }; } return { x: 0, y: 0 }; }

    /* ---------------- styles ---------------- */
    if (!document.getElementById('dash-css')) {
      const st = document.createElement('style'); st.id = 'dash-css';
      st.textContent = `
        .db-top{display:flex;align-items:center;gap:8px;margin:-8px 0 18px;flex-wrap:wrap}
        .db-tabs{display:flex;gap:2px;flex-wrap:wrap;border-bottom:1px solid var(--line);flex:1;min-width:0}
        .db-tabs button{padding:8px 12px;font-weight:600;font-size:13.5px;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-1px;transition:color .15s,border-color .15s}
        .db-tabs button:hover{color:var(--text)}
        .db-tabs button.on{color:var(--text);border-color:var(--accent)}
        .db-tabs .add{font-weight:500;color:var(--faint)}
        .db-top .btn svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
        .wrap.db-wide{max-width:1180px}
        .db-wrap{position:relative}
        .db-grid{position:relative;display:grid;grid-template-columns:repeat(${COLS},1fr);grid-auto-rows:${ROW}px;gap:${GAP}px;min-height:300px;transition:background .3s}
        .db-grid.edit{background-image:linear-gradient(color-mix(in srgb,var(--accent) 9%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--accent) 9%,transparent) 1px,transparent 1px);background-size:calc((100% + ${GAP}px)/${COLS}) ${ROW + GAP}px;border-radius:14px;outline:1px dashed color-mix(in srgb,var(--accent) 35%,transparent);outline-offset:6px;padding-bottom:${ROW * 2}px}
        /* a widget is a card like everything else in the app (themes style .db-item alongside .gl / .pl-card) */
        .db-item{position:relative;background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:0 1px 2px rgba(0,0,0,.03);display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden;transition:box-shadow .2s,transform .25s cubic-bezier(.2,1.2,.4,1),opacity .2s}
        .db-item.bare{background:none;border-color:transparent;box-shadow:none;overflow:visible}
        .db-grid.edit .db-item{cursor:grab;user-select:none}
        .db-grid.edit .db-item.bare{border:1px dashed var(--line)}
        .db-item.drag{z-index:5;box-shadow:var(--shadow),0 24px 60px -16px rgba(0,0,0,.3);transition:none;cursor:grabbing;opacity:.95}
        .db-item.pop{animation:dbpop .45s cubic-bezier(.2,1.4,.4,1)}
        @keyframes dbpop{from{transform:scale(.85);opacity:0}}
        .db-ph{border-radius:14px;background:color-mix(in srgb,var(--accent) 12%,transparent);border:2px dashed color-mix(in srgb,var(--accent) 50%,transparent);pointer-events:none;transition:all .12s}
        .db-h{display:flex;align-items:center;gap:7px;padding:11px 14px 2px;font-size:12px;font-weight:600;color:var(--muted);flex:none;min-height:14px}
        .db-h .ic{font-size:12px;opacity:.8}
        .db-h .tools{margin-left:auto;display:none;gap:2px}
        .db-grid.edit .db-h .tools{display:flex}
        .db-item.bare .db-h{position:absolute;right:4px;top:4px;padding:0;z-index:2}
        .db-h .tools button{width:24px;height:24px;border-radius:7px;color:var(--muted);font-size:13px;display:grid;place-items:center;background:var(--panel)}
        .db-h .tools button:hover{background:var(--hover);color:var(--text)}
        .db-b{flex:1;min-height:0;overflow:auto;position:relative;container-type:inline-size}
        .db-item.bare .db-b{overflow:visible}
        .db-grid.edit .db-b{pointer-events:none}
        .db-rs{position:absolute;right:3px;bottom:3px;width:16px;height:16px;cursor:nwse-resize;display:none;border-right:2px solid var(--accent);border-bottom:2px solid var(--accent);border-radius:0 0 7px 0;opacity:.75;z-index:3}
        .db-grid.edit .db-rs{display:block}
        .db-lib{position:fixed;top:12px;right:12px;bottom:12px;width:300px;background:var(--panel);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow),0 30px 80px -20px rgba(0,0,0,.3);z-index:27;display:flex;flex-direction:column;animation:dbin .3s cubic-bezier(.2,1.1,.3,1)}
        @keyframes dbin{from{transform:translateX(24px);opacity:0}}
        .db-lib h3{margin:0;padding:18px 18px 4px;font-size:16px}
        .db-lib p{margin:0;padding:0 18px 10px;font-size:12px;color:var(--muted)}
        .db-lib input{margin:0 14px 10px;width:calc(100% - 28px)}
        .db-libl{overflow:auto;padding:0 10px 14px;display:flex;flex-direction:column;gap:6px}
        .db-w{display:flex;gap:10px;align-items:flex-start;padding:10px;border:1px solid var(--line);border-radius:12px;cursor:grab;background:var(--panel);transition:transform .15s,border-color .15s,box-shadow .15s}
        .db-w:hover{border-color:color-mix(in srgb,var(--wc,var(--accent)) 50%,var(--line));transform:translateX(-2px);box-shadow:0 6px 18px -10px rgba(0,0,0,.25)}
        .db-w i{width:30px;height:30px;border-radius:9px;flex:none;display:grid;place-items:center;font-style:normal;color:#fff;background:linear-gradient(160deg,color-mix(in srgb,var(--wc,var(--accent)) 78%,#fff),var(--wc,var(--accent)));font-size:14px}
        .db-w b{display:block;font-size:13px}.db-w span{display:block;font-size:11.5px;color:var(--muted);line-height:1.35}
        .db-w small{display:block;font-size:10.5px;color:var(--faint);margin-top:2px}
        .db-empty{padding:60px 20px;text-align:center;color:var(--muted)}
        body.dash-side .app{margin-right:360px}
        body.dash-lib .main{padding-right:320px;transition:padding .3s}
        .db-side{position:fixed;top:0;right:0;bottom:0;width:360px;background:var(--side);border-left:1px solid var(--line);z-index:9;overflow:auto;padding:14px 12px 30px;animation:dbin .3s}
        .db-side .db-sh{display:flex;align-items:center;gap:8px;margin:0 2px 12px;font-weight:700}
        .db-side .db-sh button{margin-left:auto;color:var(--muted);width:28px;height:28px;border-radius:8px}.db-side .db-sh button:hover{background:var(--hover)}
        .db-side .db-item{margin-bottom:10px}
        @media (max-width:900px){.db-grid{grid-template-columns:repeat(4,1fr)}.db-grid .db-item{grid-column:auto/span 4!important;grid-row:auto/span var(--h)!important}body.dash-side .app{margin-right:0}.db-side{display:none}}
        /* built-in widgets: made of the app's own parts (.check, .gl, quick-add look) so every theme reaches them */
        .dw-list{padding:4px 8px 10px;display:flex;flex-direction:column}
        .dw-task{display:flex;align-items:center;gap:11px;padding:7px 6px;border-radius:9px;font-size:14px;transition:opacity .3s}
        .dw-task:hover{background:var(--hover)}
        .dw-task .check{margin-top:0;cursor:pointer}
        .dw-task .check:hover{border-color:var(--accent)}
        .dw-task.p3 .check{border-color:var(--danger)}
        .dw-task.done{opacity:.4}.dw-task.done .tt{text-decoration:line-through}
        .dw-task.done .check{background:var(--ok);border-color:var(--ok)}
        .dw-task .tt{flex:1;min-width:0;cursor:pointer}.dw-task small{display:block;color:var(--muted);font-size:12px}
        .dw-task em,.dw-row em{font-style:normal;font-size:11.5px;color:var(--danger);font-weight:600;white-space:nowrap}.dw-task em.t{color:var(--muted);font-weight:500}
        .dw-row{display:flex;align-items:center;gap:9px;padding:7px 6px;border-radius:9px;cursor:pointer;font-size:14px}.dw-row:hover{background:var(--hover)}.dw-row span{flex:1}.dw-row em{color:var(--client)}
        .dw-more{font-size:12px;color:var(--muted);padding:4px 6px}
        .dw-empty{padding:18px;color:var(--muted);font-size:13px;text-align:center}
        .dw-qa{display:flex;align-items:center;gap:10px;margin:6px 12px 12px;padding:0 14px;height:44px;border:1px solid var(--line);border-radius:12px;background:var(--panel);transition:border-color .15s,box-shadow .15s}
        .dw-qa span{color:var(--accent);font-size:19px}.dw-qa input{flex:1;border:0;outline:0;background:none;font-size:14.5px;color:var(--text);min-width:0}
        .dw-qa:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 16%,transparent)}
        .dw-clock{height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 16px 12px;container-type:inline-size}
        .dw-clock b{font-size:clamp(24px,18cqw,58px);font-weight:700;letter-spacing:-.035em;line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap}
        .dw-clock span{font-weight:600;margin-top:8px}.dw-clock small{color:var(--muted);font-size:12.5px}
        .dw-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:${GAP}px;height:100%}
        .dw-stats .gl{height:100%}
        .dw-stats .ok .v{color:var(--ok)}.dw-stats .bad .v{color:var(--danger)}.dw-stats .cl .v{color:var(--client)}
        .dw-note{width:100%;height:100%;border:0;outline:0;resize:none;padding:14px 16px;font:inherit;font-size:14px;line-height:1.55;border-radius:14px;color:var(--text);background:color-mix(in srgb,var(--nc) 26%,var(--panel));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--nc) 40%,var(--line))}
        .dw-note.yellow{--nc:#f5c400}.dw-note.pink{--nc:#ff5c9a}.dw-note.blue{--nc:#3b8bff}.dw-note.green{--nc:#20b26b}.dw-note.plain{--nc:var(--line);background:var(--panel)}
        .dw-text{padding:2px 4px}.dw-text h2{margin:4px 0 6px;font-size:26px;letter-spacing:-.025em}.dw-text p{margin:0 0 6px;color:var(--muted)}.dw-text ul{margin:0;padding-left:18px}
        .dw-img{position:absolute;inset:8px;border-radius:10px;background-position:center;background-repeat:no-repeat}
        .dw-frame{position:absolute;inset:0;width:100%;height:100%;border:0}
        .dw-hr{border:0;border-top:1px solid var(--line);margin:18px 6px}
      `;
      document.head.appendChild(st);
    }

    /* ---------------- rendering ---------------- */
    const meta = key => api.widgets.list().find(w => w.key === key);
    function itemCtx(it, page) {
      return { cfg: it.cfg || {}, w: it.w, h: it.h, edit: D.edit,
        setCfg(patch, quiet) { updatePage(pg => { const x = pg.items.find(i => i.iid === it.iid); if (x) x.cfg = Object.assign({}, x.cfg, patch); }); if (!quiet) refresh(); } };
    }
    function itemHTML(it) {
      const m = meta(it.key), bare = /:(spacer|text|note|stats)$/.test(it.key);
      return `<div class="db-item ${bare ? 'bare' : ''}" data-iid="${E(it.iid)}" style="grid-column:${it.x + 1}/span ${it.w};grid-row:${it.y + 1}/span ${it.h};--h:${it.h}">
        <div class="db-h">${/:(spacer|text|note|stats)$/.test(it.key) ? '' : `<span class="ic">${m && window.LUCIDE && window.LUCIDE[m.icon] ? api.ui.icon(m.icon) : E(m ? m.icon || '◇' : '?')}</span>${E(it.cfg && it.cfg.title || (m ? m.title : 'Missing widget'))}`}<span class="tools">${m && m.fields && m.fields.length ? '<button data-t="cfg" title="Settings">⚙</button>' : ''}<button data-t="dup" title="Duplicate">⧉</button><button data-t="del" title="Remove">✕</button></span></div>
        <div class="db-b"></div><span class="db-rs" data-t="rs"></span></div>`;
    }
    function drawItems(gridEl, page) {
      for (const it of page.items) {
        const el = gridEl.querySelector(`[data-iid="${it.iid}"] .db-b`); if (!el) continue;
        if (!api.widgets.render(it.key, el, itemCtx(it, page))) el.innerHTML = `<div class="dw-empty">This widget's plugin is off or gone.<br><small>${E(it.key)}</small></div>`;
      }
    }
    let root = null;
    function refresh() { if (root && root.isConnected) render(root); renderSide(); }
    function render(el) {
      root = el;
      const all = pages(), page = cur(); D.page = page.id;
      const home = api.storage.get('home'), side = api.storage.get('side');
      el.innerHTML = `<div class="db-top"><div class="db-tabs">${all.map(p => `<button class="${p.id === page.id ? 'on' : ''}" data-pg="${E(p.id)}">${E(p.icon || '')} ${E(p.name)}${home === p.id ? ' ⌂' : ''}</button>`).join('')}<button class="add" data-pg="+">+ Page</button></div><span class="sp"></span>
        ${D.edit ? `<button class="btn" id="db-lib">+ Add widget</button><button class="btn" id="db-pset">Page settings</button><button class="btn primary" id="db-done">Done</button>` : `<button class="btn" id="db-dock" title="Dock this page beside the app">${side === page.id ? 'Undock' : 'Dock to side'}</button><button class="btn primary" id="db-edit"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>Edit</button>`}</div>
        <div class="db-wrap"><div class="db-grid ${D.edit ? 'edit' : ''}" id="db-grid">${page.items.map(itemHTML).join('')}</div>
        ${!page.items.length ? `<div class="db-empty"><b>An empty page.</b><br>Press <b>Edit</b>, then <b>+ Add widget</b>, and drag things in.</div>` : ''}</div>`;
      const grid = el.querySelector('#db-grid');
      drawItems(grid, page);
      el.querySelectorAll('[data-pg]').forEach(b => b.onclick = () => { if (b.dataset.pg === '+') return newPage(); D.page = b.dataset.pg; render(el); });
      const on = (id, fn) => { const b = el.querySelector('#' + id); if (b) b.onclick = fn; };
      on('db-edit', () => { D.edit = true; render(el); library(); });
      on('db-done', () => { D.edit = false; closeLib(); render(el); });
      on('db-lib', () => library());
      on('db-pset', () => pageSettings());
      on('db-dock', () => { api.storage.set('side', side === page.id ? null : page.id); renderSide(); render(el); });
      if (D.edit) editing(grid, page);
    }

    /* ---------------- edit mode: drag, resize, tools, drop from library ---------------- */
    function editing(grid, page) {
      const cell = () => { const r = grid.getBoundingClientRect(); return { r, cw: (r.width + GAP) / COLS, rh: ROW + GAP }; };
      grid.querySelectorAll('.db-item').forEach(node => {
        const iid = node.dataset.iid;
        node.querySelectorAll('[data-t]').forEach(b => {
          if (b.dataset.t === 'rs') return;
          b.onpointerdown = e => e.stopPropagation();
          b.onclick = e => {
            e.stopPropagation();
            if (b.dataset.t === 'del') { node.style.transform = 'scale(.8)'; node.style.opacity = '0'; setTimeout(() => { updatePage(pg => { pg.items = settle(pg.items.filter(i => i.iid !== iid)); }); refresh(); }, 180); }
            if (b.dataset.t === 'dup') { updatePage(pg => { const o = pg.items.find(i => i.iid === iid); const c = { ...o, iid: uid(), cfg: { ...o.cfg }, y: o.y + o.h }; pg.items.push(c); settle(pg.items, c); }); refresh(); }
            if (b.dataset.t === 'cfg') configure(iid);
          };
        });
        node.onpointerdown = e => {
          if (e.button !== 0) return;
          const resize = e.target.dataset.t === 'rs';
          const it = { ...page.items.find(i => i.iid === iid) }, m = meta(it.key) || {};
          const { r, cw, rh } = cell(), sx = e.clientX, sy = e.clientY, nr = node.getBoundingClientRect();
          node.setPointerCapture(e.pointerId); node.classList.add('drag');
          const ph = document.createElement('div'); ph.className = 'db-ph'; ph.style.cssText = `grid-column:${it.x + 1}/span ${it.w};grid-row:${it.y + 1}/span ${it.h}`; grid.appendChild(ph);
          let nx = it.x, ny = it.y, nw = it.w, nh = it.h;
          node.onpointermove = ev => {
            const dx = ev.clientX - sx, dy = ev.clientY - sy;
            if (resize) {
              nw = Math.max(m.minW || 2, Math.min(COLS - it.x, Math.round((nr.width + dx + GAP) / cw)));
              nh = Math.max(m.minH || 1, Math.round((nr.height + dy + GAP) / rh));
              node.style.width = (nr.width + dx) + 'px'; node.style.height = (nr.height + dy) + 'px'; node.style.position = 'absolute'; node.style.left = (nr.left - r.left) + 'px'; node.style.top = (nr.top - r.top) + 'px';
            } else {
              nx = Math.max(0, Math.min(COLS - it.w, it.x + Math.round(dx / cw))); ny = Math.max(0, it.y + Math.round(dy / rh));
              node.style.transform = `translate(${dx}px,${dy}px) rotate(${Math.max(-2, Math.min(2, dx / 120))}deg)`;
            }
            ph.style.gridColumn = `${nx + 1}/span ${nw}`; ph.style.gridRow = `${ny + 1}/span ${nh}`;
          };
          node.onpointerup = node.onpointercancel = () => {
            node.onpointermove = node.onpointerup = node.onpointercancel = null; ph.remove();
            if (nx === it.x && ny === it.y && nw === it.w && nh === it.h) { node.classList.remove('drag'); node.removeAttribute('style'); node.style.cssText = `grid-column:${it.x + 1}/span ${it.w};grid-row:${it.y + 1}/span ${it.h};--h:${it.h}`; return; }
            updatePage(pg => { const x = pg.items.find(i => i.iid === iid); Object.assign(x, { x: nx, y: ny, w: nw, h: nh }); settle(pg.items, x); });
            refresh();
          };
        };
      });
      // drop from the library
      let ph = null;
      grid.ondragover = e => {
        if (!D.dragKey) return; e.preventDefault();
        const { r, cw, rh } = cell(), [w, h] = D.dragSize;
        const x = Math.max(0, Math.min(COLS - w, Math.floor((e.clientX - r.left) / cw - w / 2 + .5))), y = Math.max(0, Math.floor((e.clientY - r.top) / rh));
        if (!ph) { ph = document.createElement('div'); ph.className = 'db-ph'; grid.appendChild(ph); }
        ph.style.gridColumn = `${x + 1}/span ${w}`; ph.style.gridRow = `${y + 1}/span ${h}`; ph.dataset.x = x; ph.dataset.y = y;
      };
      grid.ondragleave = e => { if (ph && !grid.contains(e.relatedTarget)) { ph.remove(); ph = null; } };
      grid.ondrop = e => { e.preventDefault(); if (!D.dragKey || !ph) return; const x = +ph.dataset.x, y = +ph.dataset.y; ph.remove(); ph = null; add(D.dragKey, { x, y }); D.dragKey = null; };
    }
    function add(key, at) {
      const m = meta(key); if (!m) return;
      const [w, h] = SIZES[m.size] || SIZES.m; let iid = uid();
      updatePage(pg => { const pos = at || freeSpot(pg.items, w, h); const it = { iid, key, x: pos.x, y: pos.y, w, h, cfg: {} }; pg.items.push(it); settle(pg.items, it); });
      refresh();
      const n = document.querySelector(`.db-item[data-iid="${iid}"]`); if (n) { n.classList.add('pop'); n.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    }

    /* ---------------- widget library ---------------- */
    function closeLib() { document.querySelectorAll('.db-lib').forEach(x => x.remove()); document.body.classList.remove('dash-lib'); }
    function library() {
      closeLib();
      const box = document.createElement('div'); box.className = 'db-lib';
      box.innerHTML = `<h3>Widgets</h3><p>Drag onto the page, or click to add. Plugins can add their own.</p><input class="inp" placeholder="Search widgets…" id="db-lq"><div class="db-libl"></div><div style="padding:10px 14px;border-top:1px solid var(--line);display:flex;gap:8px"><button class="btn primary" style="flex:1" id="db-ldone">Done editing</button></div>`;
      document.body.appendChild(box); document.body.classList.add('dash-lib');
      const list = box.querySelector('.db-libl');
      const draw = q => {
        const ws = api.widgets.list().filter(w => (!w.spaces || w.spaces.includes(api.space())) && (!q || (w.title + ' ' + w.description).toLowerCase().includes(q)));
        list.innerHTML = ws.map(w => `<div class="db-w" draggable="true" data-k="${E(w.key)}" style="--wc:${E(w.color || '#0ea5a4')}"><i>${window.LUCIDE && window.LUCIDE[w.icon] ? api.ui.icon(w.icon) : E(w.icon || '◇')}</i><div><b>${E(w.title)}</b><span>${E(w.description || '')}</span><small>${E(w.pid === 'dashboard' ? 'Built in' : 'from ' + w.pid)}</small></div></div>`).join('');
        list.querySelectorAll('.db-w').forEach(n => {
          n.onclick = () => add(n.dataset.k);
          n.ondragstart = e => { D.dragKey = n.dataset.k; const m = meta(n.dataset.k); D.dragSize = SIZES[m.size] || SIZES.m; e.dataTransfer.setData('text/plain', n.dataset.k); e.dataTransfer.effectAllowed = 'copy'; };
          n.ondragend = () => { D.dragKey = null; };
        });
      };
      draw('');
      box.querySelector('#db-lq').oninput = e => draw(e.target.value.toLowerCase());
      box.querySelector('#db-ldone').onclick = () => { D.edit = false; closeLib(); refresh(); };
    }

    /* ---------------- per-widget settings (from the widget's fields) ---------------- */
    function configure(iid) {
      const page = cur(), it = page.items.find(i => i.iid === iid), m = meta(it.key); if (!m) return;
      const c = it.cfg || {};
      const field = f => f.type === 'textarea' ? `<textarea class="inp" data-k="${E(f.key)}" rows="6">${E(c[f.key] || '')}</textarea>`
        : f.type === 'select' ? `<select class="inp" data-k="${E(f.key)}">${f.options.map(o => `<option ${c[f.key] === o ? 'selected' : ''}>${E(o)}</option>`).join('')}</select>`
        : f.type === 'checkbox' ? `<input type="checkbox" data-k="${E(f.key)}" ${c[f.key] ? 'checked' : ''}>`
        : `<input class="inp" type="${f.type === 'number' ? 'number' : f.type === 'color' ? 'color' : 'text'}" data-k="${E(f.key)}" value="${E(c[f.key] ?? '')}">`;
      api.ui.modal(`${m.title} settings`, `<div class="field"><label>Title</label><input class="inp" data-k="title" value="${E(c.title || '')}" placeholder="${E(m.title)}"></div>${m.fields.map(f => `<div class="field"><label>${E(f.label)}</label>${field(f)}</div>`).join('')}`,
        `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="dw-save">Save</button>`);
      document.getElementById('dw-save').onclick = () => {
        const patch = {}; document.querySelectorAll('.modal [data-k]').forEach(i => { patch[i.dataset.k] = i.type === 'checkbox' ? i.checked : i.type === 'number' ? (i.value === '' ? '' : +i.value) : i.value; });
        updatePage(pg => { const x = pg.items.find(i => i.iid === iid); x.cfg = Object.assign({}, x.cfg, patch); }); api.ui.close(); refresh();
      };
    }
    /* ---------------- pages: add, rename, home, delete ---------------- */
    function newPage() {
      const p = pages(), id = uid(); p.push({ id, name: 'Page ' + (p.length + 1), icon: '◇', items: [] }); savePages(p);
      D.page = id; D.edit = true; refresh(); library();
    }
    function pageSettings() {
      const page = cur(), home = api.storage.get('home') === page.id, n = pages().length;
      api.ui.modal('Page settings', `<div class="field"><label>Name</label><input class="inp" id="ps-n" value="${E(page.name)}"></div>
        <div class="field"><label>Icon (an emoji or a symbol)</label><input class="inp" id="ps-i" value="${E(page.icon || '')}" maxlength="4"></div>
        <label style="display:flex;gap:8px;align-items:center;margin:4px 0"><input type="checkbox" id="ps-h" ${home ? 'checked' : ''}> Open Cadence on this page</label>`,
        `${n > 1 ? '<button class="btn ghost danger" id="ps-del" style="margin-right:auto">Delete page</button>' : ''}<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="ps-save">Save</button>`);
      document.getElementById('ps-save').onclick = () => {
        updatePage(pg => { pg.name = document.getElementById('ps-n').value.trim() || pg.name; pg.icon = document.getElementById('ps-i').value.trim(); });
        const h = document.getElementById('ps-h').checked; api.storage.set('home', h ? page.id : (home ? null : api.storage.get('home')));
        api.ui.close(); refresh();
      };
      const del = document.getElementById('ps-del'); if (del) del.onclick = () => { savePages(pages().filter(p => p.id !== page.id)); if (api.storage.get('home') === page.id) api.storage.set('home', null); if (api.storage.get('side') === page.id) api.storage.set('side', null); D.page = null; api.ui.close(); refresh(); };
    }
    D.pageSettings = pageSettings;

    /* ---------------- side panel: a page docked beside the app (stacked, one column) ---------------- */
    function renderSide() {
      const sid = api.plugins.enabled('dashboard') ? api.storage.get('side') : null, page = sid && pages().find(p => p.id === sid);
      let el = document.getElementById('db-side');
      if (!page) { if (el) el.remove(); document.body.classList.remove('dash-side'); return; }
      if (!el) { el = document.createElement('aside'); el.id = 'db-side'; el.className = 'db-side'; document.body.appendChild(el); }
      document.body.classList.add('dash-side');
      const items = page.items.slice().sort((a, b) => a.y - b.y || a.x - b.x);
      el.innerHTML = `<div class="db-sh">${E(page.icon || '')} ${E(page.name)}<button title="Undock" id="db-undock">✕</button></div>${items.map(it => `<div class="db-item ${/:(spacer|text|note)$/.test(it.key) ? 'bare' : ''}" data-iid="${E(it.iid)}" style="height:${Math.min(it.h, 5) * ROW}px"><div class="db-h">${/:(spacer|text|note)$/.test(it.key) ? '' : E((it.cfg && it.cfg.title) || (meta(it.key) || {}).title || '')}</div><div class="db-b"></div></div>`).join('')}`;
      for (const it of items) { const b = el.querySelector(`[data-iid="${it.iid}"] .db-b`); if (b && !api.widgets.render(it.key, b, itemCtx(it, page))) b.innerHTML = ''; }
      el.querySelector('#db-undock').onclick = () => { api.storage.set('side', null); refresh(); };
    }

    api.views.add({ id: 'dash', title: 'Dashboard', icon: '▦', subtitle: '', render: el => { D.edit = false; closeLib(); render(el); } });
    api.commands.add({ title: 'Dashboard', hint: 'Your pages', run: () => api.ui.navigate('view-dash') });
    api.commands.add({ title: 'Edit dashboard', run: () => { api.ui.navigate('view-dash'); setTimeout(() => { D.edit = true; refresh(); library(); }, 60); } });
    api.commands.add({ title: 'Toggle side panel', run: () => { const s = api.storage.get('side'); api.storage.set('side', s ? null : cur().id); renderSide(); } });
    // live data: redraw widgets when things change (cheap: only when a dashboard is on screen)
    let t = 0; const live = () => { clearTimeout(t); t = setTimeout(() => { if (!D.edit && root && root.isConnected) render(root); renderSide(); }, 250); };
    for (const ev of ['task:add', 'task:update', 'task:complete', 'task:reopen', 'task:remove', 'client:update', 'sync']) api.on(ev, live);
    api.on('render', e => {
      const w = document.querySelector('#view'); if (w) w.classList.toggle('db-wide', !!(e && e.route === 'view-dash'));
      if (!e || e.route !== 'view-dash') { if (D.edit) { D.edit = false; closeLib(); } }
    });
    setTimeout(renderSide, 50);
    // home page: open Cadence on a dashboard page (once per load, only if you didn't ask for something else)
    if (!D.booted) { D.booted = true; const h = api.storage.get('home'); if (h && (!location.hash || location.hash === '#today')) { D.page = h; setTimeout(() => api.ui.navigate('view-dash'), 0); } }
  }
});
