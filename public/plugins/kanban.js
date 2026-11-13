/* Kanban: your open work as columns. Group by status (To do / In progress / Waiting / Done), client, due date or who
   owes it; drag a card to another column to change it. Cards are the normal task rows, so clicking one opens the
   usual editor right there in the column. */
(() => {
  Cadence.registerPlugin({
    id: 'kanban', name: 'Kanban', version: '1.0.0', category: 'Views', spaces: ['work', 'life'],
    description: 'A board of your open tasks. Group by status, client, due date or owner, and drag cards between columns to update them.',
    tagline: 'Drag your work between columns', color: '#0ea5e9',
    icon: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/>',
    setup(api) {
      const esc = window.CadenceKit.esc;
      const U = api.util, today = () => U.todayKey(), plus = n => U.ymd(U.addDays(new Date(), n));
      const life = () => api.space() === 'life';
      const MODES = () => [['status', 'Status'], ['client', life() ? 'Area' : 'Client'], ['due', 'Due'], ...(life() ? [] : [['owner', 'Owner']])];
      const weekAgo = () => Date.now() - 7 * 864e5;
      const endOfWeek = () => { const d = new Date(), k = (7 - d.getDay()) % 7; return U.ymd(U.addDays(d, k)); };

      function columns(mode) {
        const t0 = today();
        if (mode === 'status') return [
          { id: 'todo', title: 'To do', test: t => !t.done && !t.stage && t.owner !== 'client', patch: () => ({ stage: null }) },
          { id: 'doing', title: 'In progress', test: t => !t.done && t.stage === 'doing', patch: () => ({ stage: 'doing' }) },
          { id: 'waiting', title: life() ? 'Waiting' : 'Waiting / follow-up', test: t => !t.done && (t.stage === 'waiting' || (t.owner === 'client' && t.stage !== 'doing')), patch: () => ({ stage: 'waiting' }) },
          { id: 'done', title: 'Done this week', test: t => t.done && (t.doneAt || 0) > weekAgo(), patch: 'done' },
        ];
        if (mode === 'due') return [
          { id: 'over', title: 'From earlier', test: t => !t.done && t.dueDate && t.dueDate < t0, patch: null },
          { id: 'today', title: 'Today', test: t => !t.done && t.dueDate === t0, patch: () => ({ dueDate: t0 }) },
          { id: 'week', title: 'This week', test: t => !t.done && t.dueDate > t0 && t.dueDate <= endOfWeek(), patch: () => ({ dueDate: endOfWeek() > t0 ? plus(1) : t0 }) },
          { id: 'later', title: 'Later', test: t => !t.done && t.dueDate > endOfWeek(), patch: () => ({ dueDate: U.ymd(U.addDays(U.fromYmd(endOfWeek()), 7)) }) },
          { id: 'none', title: 'No date', test: t => !t.done && !t.dueDate, patch: () => ({ dueDate: null, dueTime: null }) },
        ];
        if (mode === 'owner') return [
          { id: 'me', title: 'On me', test: t => !t.done && t.owner === 'me', patch: () => ({ owner: 'me' }) },
          { id: 'client', title: 'Client owes', test: t => !t.done && t.owner === 'client', patch: () => ({ owner: 'client' }) },
          { id: 'dev', title: 'With dev', test: t => !t.done && t.owner === 'dev', patch: () => ({ owner: 'dev' }) },
        ];
        const cl = api.clients.list(), open = api.tasks.list(t => !t.done);
        const used = cl.filter(c => open.some(t => t.clientId === c.id));
        return [{ id: 'none', title: life() ? 'No area' : 'No client', test: t => !t.done && !t.clientId, patch: () => ({ clientId: null }) },
          ...used.map(c => ({ id: c.id, title: c.name, c, test: t => !t.done && t.clientId === c.id, patch: () => ({ clientId: c.id }) }))];
      }

      function render(el) {
        const mode = api.storage.get('mode') || 'status', only = api.storage.get('client') || '';
        const cols = columns(mode), all = api.tasks.list(t => !only || t.clientId === only);
        const sortT = (a, b) => (b.priority || 0) - (a.priority || 0) || String(a.dueDate || '9').localeCompare(String(b.dueDate || '9')) || (a.order || 0) - (b.order || 0);
        el.innerHTML = `<div class="kb-bar"><div class="seg" id="kb-mode">${MODES().map(([v, l]) => `<button data-v="${v}" class="${mode === v ? 'on' : ''}">${l}</button>`).join('')}</div>
          ${mode !== 'client' ? `<select class="inp kb-f" id="kb-client"><option value="">${life() ? 'All areas' : 'All clients'}</option>${api.clients.list().map(c => `<option value="${esc(c.id)}" ${c.id === only ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>` : ''}
          <span class="muted kb-hint">Drag a card to another column to change it</span></div>
          <div class="kb-board">${cols.map(col => { const list = all.filter(col.test).sort(sortT); return `<section class="kb-col ${col.patch ? '' : 'nodrop'}" data-col="${esc(col.id)}">
            <header>${col.c ? api.ui.avatar(col.c, 16) : ''}<b>${esc(col.title)}</b><span class="n">${list.length}</span></header>
            <div class="kb-list">${list.map(t => card(t, mode)).join('') || '<div class="kb-empty">Nothing here</div>'}</div></section>`; }).join('')}</div>`;
        // editing happens in a panel on the right, not squeezed into the card
        const sel = api.ui.selected(), selT = sel && api.tasks.get(sel);
        if (selT) { el.querySelector('.kb-board').insertAdjacentHTML('afterend', `<aside class="kb-side" aria-label="Edit task">${api.ui.taskRow(selT)}</aside>`); el.classList.add('kb-has-side'); } else el.classList.remove('kb-has-side');
        el.querySelectorAll('.kb-card').forEach(c => { const go = e => { e.stopPropagation(); const id = c.dataset.id; setTimeout(() => api.ui.openTask(id), 0); }; c.addEventListener('click', go); c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(e); } }); });
        el.querySelectorAll('#kb-mode button').forEach(b => b.onclick = () => { api.storage.set('mode', b.dataset.v); api.ui.refresh(); });
        const f = el.querySelector('#kb-client'); if (f) f.onchange = () => { api.storage.set('client', f.value); api.ui.refresh(); };
        // drag and drop
        let dragId = null;
        el.querySelectorAll('.kb-card').forEach(c => {
          c.addEventListener('dragstart', e => { if (api.ui.selected()) { e.preventDefault(); return; } dragId = c.dataset.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); requestAnimationFrame(() => c.classList.add('dragging')); });
          c.addEventListener('dragend', () => { c.classList.remove('dragging'); el.querySelectorAll('.kb-col.over').forEach(x => x.classList.remove('over')); });
        });
        el.querySelectorAll('.kb-col').forEach(col => {
          col.addEventListener('dragover', e => { if (!dragId || col.classList.contains('nodrop')) return; e.preventDefault(); col.classList.add('over'); });
          col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) col.classList.remove('over'); });
          col.addEventListener('drop', e => { e.preventDefault(); col.classList.remove('over'); const id = dragId || e.dataTransfer.getData('text/plain'); dragId = null; move(id, col.dataset.col, mode); });
        });
      }
      function card(t, mode) {
        const c = t.clientId && api.clients.get(t.clientId), st = api.util.dueState(t), sel = api.ui.selected() === t.id;
        return `<div class="kb-card ${sel ? 'sel' : ''} ${t.done ? 'done' : ''}" draggable="true" data-id="${esc(t.id)}" tabindex="0" role="button" aria-label="${esc(t.title)}">
          <div class="kb-t">${t.priority ? `<i class="kb-p p${Math.min(3, t.priority)}" aria-label="Priority ${t.priority}"></i>` : ''}${esc(t.title)}</div>
          <div class="kb-m">${c && mode !== 'client' ? `<span class="kb-cl">${api.ui.avatar(c, 14)}${esc(c.name)}</span>` : ''}${t.dueDate ? `<span class="kb-due ${st}">${esc(api.util.dueLabel(t))}</span>` : ''}${t.owner === 'client' ? '<span class="kb-ow">they owe</span>' : t.owner === 'dev' ? '<span class="kb-ow">dev</span>' : ''}</div></div>`;
      }
      function move(id, colId, mode) {
        const t = api.tasks.get(id), col = columns(mode).find(c => c.id === colId); if (!t || !col || !col.patch) return;
        if (col.test(t)) return;
        if (col.patch === 'done') { api.tasks.complete(id); return; }
        const patch = col.patch(t);
        if (t.done) Object.assign(patch, { done: false, doneAt: null });
        if (mode === 'status' && colId === 'todo' && t.owner === 'client') patch.owner = 'me';
        api.tasks.update(id, patch);
        api.ui.toast(`Moved to ${col.title}`);
      }
      // test hook
      window.__kanban = { move: (id, col) => move(id, col, api.storage.get('mode') || 'status') };

      api.views.add({ id: 'kanban', title: 'Board', icon: '🗂️', subtitle: 'Your open work as columns', wide: true, render });
      api.commands.add({ title: 'Board (Kanban)', run: () => api.ui.navigate('view-kanban') });

      if (!document.getElementById('kb-css')) {
        const st = document.createElement('style'); st.id = 'kb-css';
        st.textContent = `
        .kb-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
        .kb-f{width:auto;min-width:160px;padding:6px 10px}.kb-hint{font-size:12px;margin-left:auto}
        .kb-board{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(260px,1fr);gap:12px;overflow-x:auto;padding-bottom:10px;align-items:start}
        .kb-col{background:color-mix(in srgb,var(--text) 3.5%,transparent);border:1px solid var(--line);border-radius:var(--r-l);padding:8px;min-height:120px;transition:background .15s,border-color .15s}
        .kb-col.over{background:color-mix(in srgb,var(--accent) 10%,transparent);border-color:var(--accent);border-style:dashed}
        .kb-col header{display:flex;align-items:center;gap:7px;padding:4px 6px 8px;font-size:13px}
        .kb-col header .n{margin-left:auto;font-size:12px;color:var(--muted);background:var(--hover);border-radius:999px;padding:1px 8px}
        .kb-red{width:7px;height:7px;border-radius:50%;background:#e5484d}
        .kb-list{display:flex;flex-direction:column;gap:6px}
        .kb-card{border-radius:var(--r);background:var(--panel,var(--bg));border:1px solid var(--line);box-shadow:0 1px 2px rgba(0,0,0,.04);cursor:grab}
        .kb-card{padding:9px 11px}.kb-card.sel{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 25%,transparent)}.kb-card.done .kb-t{text-decoration:line-through;color:var(--muted)}
        .kb-t{font-size:13px;line-height:1.35;display:flex;gap:6px;align-items:flex-start}.kb-p{flex:none;width:7px;height:7px;border-radius:50%;margin-top:6px;background:#f59e0b}.kb-p.p3{background:var(--client)}
        .kb-m{display:flex;gap:6px;flex-wrap:wrap;margin-top:5px;font-size:12px;color:var(--muted)}.kb-cl{display:inline-flex;align-items:center;gap:4px}.kb-due.over{color:var(--muted)}.kb-due.today{color:var(--accent);font-weight:600}.kb-ow{border:1px solid var(--line);border-radius:999px;padding:0 6px}
        .kb-has-side{display:grid;grid-template-columns:minmax(0,1fr) 360px;column-gap:14px;align-items:start}.kb-has-side .kb-bar{grid-column:1/-1}.kb-side{position:sticky;top:16px}.kb-side .task{margin:0}
        @media (max-width:1100px){.kb-has-side{display:block}}
        .kb-card.dragging{opacity:.35}
        .kb-card:hover{border-color:color-mix(in srgb,var(--accent) 40%,var(--line))}
        @media (max-width:640px){.kb-board{grid-auto-columns:85vw;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch}.kb-col{scroll-snap-align:start}.kb-hint{display:none}}
        .kb-empty{font-size:12px;color:var(--muted);text-align:center;padding:16px 0;border:1px dashed var(--line);border-radius:var(--r)}`;
        document.head.appendChild(st);
      }
    },
  });
})();
