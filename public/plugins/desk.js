/* Zoho Desk tickets (Work): a support ticket is a task with a `ticket` on it, so it has a client, an owner (you, the
   client, or a dev) and a due date like any task, plus what support work needs: ticket number, Desk status, priority
   and age against an SLA. Its own board surfaces them; chips mark them everywhere else.
   Quick add:  "Fix sync error @acme tkt 4821"  ·  "desk 4821"  ·  or paste the ticket's Desk URL.
   No Desk API yet (it needs OAuth and a token on the NAS); statuses are yours to move. Completing the task closes the ticket. */
Cadence.registerPlugin({
  id: 'desk', name: 'Desk tickets', version: '1.0.0', category: 'Clients', spaces: ['work'],
  description: 'Track Zoho Desk support tickets as first-class work: ticket number, Desk status, priority and age against your SLA. A tickets board, chips on every ticket task, an open-tickets widget. Type "tkt 4821" or paste a Desk link in quick add.',
  tagline: 'Support tickets, surfaced and tracked', color: '#0f9d58',
  icon: '<path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
  settings(api) { window.__desk && window.__desk.settings(); },
  setup(api) {
    const D = window.__desk = window.__desk || {};
    const E = api.ui.esc;
    const STATUS = [['open', 'Open'], ['escalated', 'Escalated'], ['hold', 'On hold'], ['customer', 'Waiting on customer'], ['closed', 'Closed']];
    const PRI = [['urgent', 'Urgent'], ['high', 'High'], ['normal', 'Normal'], ['low', 'Low']];
    const SL = Object.fromEntries(STATUS), PL = Object.fromEntries(PRI);
    const opts = () => Object.assign({ link: '', sla: { urgent: 1, high: 2, normal: 4, low: 7 } }, api.storage.get('opts') || {});
    const ageDays = k => k.opened ? Math.floor((Date.now() - k.opened) / 864e5) : 0;
    // how it's doing against the SLA: ok / warn (past 75%) / breach. Waiting on customer and on hold pause the clock (shown, not judged).
    const sla = k => { if (!k || k.status === 'closed' || k.status === 'customer' || k.status === 'hold') return ''; const lim = opts().sla[k.pri || 'normal'] || 4, d = ageDays(k); return d >= lim ? 'breach' : d >= lim * .75 ? 'warn' : ''; };
    const link = k => k.url || (k.no && opts().link.includes('{n}') ? opts().link.replace('{n}', encodeURIComponent(k.no)) : '');
    const tickets = (f = () => true) => api.tasks.list(t => t.ticket && f(t));
    const label = k => k.no ? '#' + k.no : k.url ? 'Desk ticket' : 'Ticket';

    // quick add: "tkt 4821", "ticket 4821", "desk #4821", or a desk.zoho.* ticket URL
    api.parsers.add((text, r) => {
      let k = null;
      text = text.replace(/\s(https?:\/\/desk\.zoho\.[a-z.]+\/\S*?tickets?\/\S+)(?=\s)/i, (m, url) => { const id = (url.match(/(?:details|tickets)\/(\d{3,})/) || [])[1]; k = { url, no: '' , id }; return ' '; });
      text = text.replace(/\s(?:ticket|tkt|desk)\s?#?(\d{2,})(?=\s)/i, (m, n) => { k = Object.assign(k || {}, { no: n }); return ' '; });
      if (k) { r.ticket = { no: k.no || '', url: k.url || '', status: 'open', pri: r.priority === 3 ? 'high' : 'normal', opened: Date.now() }; if (!r.tags.includes('desk')) r.tags.push('desk'); }
      return text;
    });
    // chips on rows and in the quick-add preview
    api.chips.add((t, preview) => {
      const k = t.ticket; if (!k) return '';
      if (preview) return `<span class="chip tkt">🎫 ${E(label(k))}${k.url && !k.no ? ' (Desk link)' : ''}</span>`;
      const s = sla(k), d = ageDays(k);
      return `<span class="chip tkt st-${E(k.status)} ${s}" title="Desk ticket ${E(label(k))} · ${E(SL[k.status] || 'Open')} · ${E(PL[k.pri] || 'Normal')} priority · opened ${d}d ago${s === 'breach' ? ' · past SLA' : ''}">🎫 ${E(label(k))}${k.status !== 'open' ? ' · ' + E(SL[k.status]) : ''}${k.status !== 'closed' && d >= 1 ? ` · ${d}d` : ''}</span>`;
    });
    // completing the task closes the ticket; reopening reopens it
    api.on('task:complete', t => { if (t.ticket && t.ticket.status !== 'closed') api.tasks.update(t.id, { ticket: { ...t.ticket, status: 'closed', closed: Date.now() } }); });
    api.on('task:reopen', t => { if (t.ticket && t.ticket.status === 'closed') api.tasks.update(t.id, { ticket: { ...t.ticket, status: 'open', closed: null } }); });

    // the ticket editor (from a task's ⋯ menu, or a board card)
    function edit(id) {
      const t = api.tasks.get(id); if (!t) return;
      const k = Object.assign({ no: '', url: '', status: 'open', pri: 'normal', opened: Date.now() }, t.ticket || {});
      const seg = (name, list, cur) => `<div class="seg" data-seg="${name}">${list.map(([v, l]) => `<button data-v="${v}" class="${cur === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
      api.ui.modal(t.ticket ? `Ticket ${label(k)}` : 'Link a Desk ticket', `<div class="muted" style="margin:-4px 0 12px;font-size:13px">${E(t.title)}</div>
        <div class="row" style="gap:10px"><div class="field" style="flex:1"><label>Ticket number</label><input class="inp" id="dk-no" value="${E(k.no)}" placeholder="4821"></div>
        <div class="field" style="flex:1"><label>Opened</label><input class="inp" type="date" id="dk-op" value="${api.util.ymd(new Date(k.opened))}"></div></div>
        <div class="field"><label>Desk link <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional${opts().link ? ', built from the number if empty' : ''})</span></label><input class="inp" id="dk-url" value="${E(k.url)}" placeholder="https://desk.zoho.com/agent/…/tickets/details/…"></div>
        <div class="field"><label>Status</label>${seg('status', STATUS, k.status)}</div>
        <div class="field"><label>Priority</label>${seg('pri', PRI, k.pri)}</div>`,
        `${t.ticket ? '<button class="btn ghost danger" id="dk-rm" style="margin-right:auto">Unlink ticket</button>' : ''}<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="dk-save">Save</button>`);
      const cur = { status: k.status, pri: k.pri };
      document.querySelectorAll('#modal [data-seg] button').forEach(b => b.onclick = () => { const sg = b.parentNode.dataset.seg; cur[sg] = b.dataset.v; b.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
      document.getElementById('dk-save').onclick = () => {
        const no = document.getElementById('dk-no').value.replace(/[^\w-]/g, ''), url = document.getElementById('dk-url').value.trim(), op = document.getElementById('dk-op').value;
        if (url && !/^https?:\/\//.test(url)) return api.ui.toast('The link should start with https://');
        const tk = { ...k, no, url, status: cur.status, pri: cur.pri, opened: op ? new Date(op + 'T09:00').getTime() : k.opened };
        const tags = (t.tags || []).includes('desk') ? t.tags : [...(t.tags || []), 'desk'];
        api.tasks.update(id, { ticket: tk, tags });
        if (cur.status === 'closed' && !t.done) api.tasks.complete(id); else if (cur.status !== 'closed' && t.done) api.tasks.update(id, { done: false, doneAt: null });
        api.ui.close(); api.ui.refresh();
      };
      const rm = document.getElementById('dk-rm'); if (rm) rm.onclick = () => { api.tasks.update(id, { ticket: null, tags: (t.tags || []).filter(x => x !== 'desk') }); api.ui.close(); api.ui.refresh(); };
      setTimeout(() => document.getElementById('dk-no')?.focus(), 30);
    }
    D.edit = edit;
    api.taskActions.add({ label: '🎫 Desk ticket…', run: t => edit(t.id) });
    api.taskActions.add({ label: '↗ Open in Desk', run: t => { const u = t.ticket && link(t.ticket); if (u) window.open(u, '_blank', 'noopener'); else api.ui.toast(t.ticket ? 'No Desk link yet: add one, or set a link pattern in Desk tickets settings' : 'This task has no ticket'); } });

    D.settings = () => {
      const o = opts();
      api.ui.modal('Desk tickets', `<div class="field"><label>Ticket link pattern</label><input class="inp" id="dk-l" value="${E(o.link)}" placeholder="https://desk.zoho.com/agent/yourportal/all/tickets/search?q={n}">
        <div class="muted" style="font-size:12px;margin-top:6px">Optional. <b>{n}</b> becomes the ticket number, so “tkt 4821” links straight to Desk. Pasted Desk links always win.</div></div>
        <div class="field"><label>SLA: days before a ticket counts as late</label><div class="row" style="gap:8px">${PRI.map(([v, l]) => `<label style="flex:1;font-size:12px;color:var(--muted)">${l}<input class="inp" type="number" min="1" max="60" data-sla="${v}" value="${o.sla[v]}"></label>`).join('')}</div>
        <div class="muted" style="font-size:12px;margin-top:6px">Amber at 75%, red when past. The clock pauses (no colour) while a ticket is on hold or waiting on the customer.</div></div>`,
        `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="dk-s">Save</button>`);
      document.getElementById('dk-s').onclick = () => { const n = { link: document.getElementById('dk-l').value.trim(), sla: {} }; document.querySelectorAll('[data-sla]').forEach(i => n.sla[i.dataset.sla] = Math.max(1, +i.value || 4)); api.storage.set('opts', n); api.ui.close(); api.ui.refresh(); };
    };

    // the board
    let filter = '';
    function board(el) {
      const open = tickets(t => !t.done && (!filter || t.clientId === filter)), cols = STATUS.filter(([v]) => v !== 'closed');
      const weekClosed = tickets(t => t.done && t.doneAt && Date.now() - t.doneAt < 7 * 864e5 && (!filter || t.clientId === filter)).length;
      const breach = open.filter(t => sla(t.ticket) === 'breach').length;
      const clientIds = [...new Set(tickets(t => !t.done).map(t => t.clientId).filter(Boolean))];
      const order = (a, b) => (sla(b.ticket) === 'breach') - (sla(a.ticket) === 'breach') || ['urgent', 'high', 'normal', 'low'].indexOf(a.ticket.pri) - ['urgent', 'high', 'normal', 'low'].indexOf(b.ticket.pri) || a.ticket.opened - b.ticket.opened;
      const card = t => { const k = t.ticket, c = t.clientId && api.clients.get(t.clientId), s = sla(k), u = link(k), d = ageDays(k);
        return `<div class="dk-card ${s}" data-id="${E(t.id)}"><div class="dk-top"><span class="dk-no">${u ? `<a href="${E(u)}" target="_blank" rel="noopener">${E(label(k))} ↗</a>` : E(label(k))}</span><span class="dk-pri p-${E(k.pri)}">${E(PL[k.pri] || 'Normal')}</span></div>
          <div class="dk-t" data-open="${E(t.id)}">${E(t.title)}</div>
          <div class="dk-meta">${c ? `<span class="chip">${api.ui.avatar(c, 14)}${E(c.name)}</span>` : ''}${t.owner === 'dev' ? '<span class="chip dev-owned">⚙ Dev</span>' : t.owner === 'client' ? '<span class="chip client-owned">↗ client</span>' : ''}<span class="dk-age ${s}" title="${s === 'breach' ? 'Past SLA' : s === 'warn' ? 'Close to SLA' : 'Age'}">${d ? d + 'd' : 'today'}</span></div>
          <select class="dk-st" data-id="${E(t.id)}" aria-label="Status">${STATUS.map(([v, l]) => `<option value="${v}" ${k.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`; };
      el.innerHTML = `<div class="dk-head"><div class="dk-sum"><span><b>${open.length}</b> open</span>${breach ? `<span class="breach"><b>${breach}</b> past SLA</span>` : ''}<span class="ok"><b>${weekClosed}</b> closed this week</span></div>
          <div class="dk-tools"><select class="inp" id="dk-f"><option value="">All clients</option>${clientIds.map(id => { const c = api.clients.get(id); return c ? `<option value="${E(id)}" ${filter === id ? 'selected' : ''}>${E(c.name)}</option>` : ''; }).join('')}</select><button class="btn" id="dk-new">+ Ticket</button><button class="btn ghost" id="dk-set" title="Link pattern and SLA">⚙</button></div></div>
        ${open.length ? `<div class="dk-board">${cols.map(([v, l]) => { const xs = open.filter(t => (t.ticket.status || 'open') === v).sort(order); return `<div class="dk-col" data-col="${v}"><div class="dk-ch">${l}<span>${xs.length}</span></div>${xs.map(card).join('') || '<div class="dk-empty">—</div>'}</div>`; }).join('')}</div>`
          : `<div class="empty"><div class="big">🎫</div><b>No open tickets</b>Add one with “tkt 4821” in any quick add, paste a Desk link, or use a task’s ⋯ menu → Desk ticket.</div>`}`;
      el.querySelector('#dk-f').onchange = e => { filter = e.target.value; board(el); };
      el.querySelector('#dk-set').onclick = D.settings;
      el.querySelector('#dk-new').onclick = () => { const t = api.tasks.add({ title: 'New ticket', clientId: filter || null, tags: ['desk'], ticket: { no: '', url: '', status: 'open', pri: 'normal', opened: Date.now() } }); edit(t.id); renameAfter(t.id); };
      el.querySelectorAll('.dk-st').forEach(s => s.onchange = () => { const t = api.tasks.get(s.dataset.id); if (!t) return; api.tasks.update(t.id, { ticket: { ...t.ticket, status: s.value } }); if (s.value === 'closed') api.tasks.complete(t.id); else api.ui.refresh(); });
      el.querySelectorAll('[data-open]').forEach(x => x.onclick = () => edit(x.dataset.open));
      // drag a card between columns
      el.querySelectorAll('.dk-card').forEach(c => { c.draggable = true; c.ondragstart = e => { e.dataTransfer.setData('text/dk', c.dataset.id); c.classList.add('drag'); }; c.ondragend = () => c.classList.remove('drag'); });
      el.querySelectorAll('.dk-col').forEach(col => { col.ondragover = e => { e.preventDefault(); col.classList.add('over'); }; col.ondragleave = () => col.classList.remove('over');
        col.ondrop = e => { e.preventDefault(); col.classList.remove('over'); const id = e.dataTransfer.getData('text/dk'), t = id && api.tasks.get(id); if (t) { api.tasks.update(id, { ticket: { ...t.ticket, status: col.dataset.col } }); api.ui.refresh(); } }; });
    }
    // a new ticket from the board starts as "New ticket": ask for a real title in the editor's place
    function renameAfter(id) { setTimeout(() => { const m = document.querySelector('#modal .muted'); if (!m) return; m.outerHTML = `<div class="field"><label>What's the issue</label><input class="inp" id="dk-title" placeholder="Sync error on the Deals module"></div>`;
      const s = document.getElementById('dk-save'), old = s.onclick; s.onclick = () => { const v = document.getElementById('dk-title').value.trim(); if (v) api.tasks.update(id, { title: v }); old(); };
      const x = document.querySelector('#modal [data-act=close-modal]'); if (x) x.addEventListener('click', () => { const t = api.tasks.get(id); if (t && t.title === 'New ticket' && !t.ticket.no) api.tasks.remove(id); }); }, 40); }

    api.views.add({ id: 'tickets', title: 'Tickets', icon: '🎫', subtitle: 'Zoho Desk tickets you’re working, by status. Oldest and past-SLA first.', render: el => board(el) });
    api.on('render', e => { const w = document.querySelector('#view'); if (w) w.classList.toggle('dk-wide', !!(e && e.route === 'view-tickets')); });
    api.commands.add({ title: 'Open Desk tickets', hint: 'Desk tickets', run: () => api.ui.navigate('view-tickets') });
    api.clientActions.add({ label: '🎫 Tickets', primary: true, run: c => { filter = c.id; api.ui.navigate('view-tickets'); } });
    api.widgets.add({ id: 'open', title: 'Open tickets', icon: '🎫', size: 'm', spaces: ['work'], description: 'Desk tickets still open, past-SLA first.', render: el => {
      const xs = tickets(t => !t.done).sort((a, b) => (sla(b.ticket) === 'breach') - (sla(a.ticket) === 'breach') || a.ticket.opened - b.ticket.opened).slice(0, 8);
      el.innerHTML = xs.length ? `<div class="dw-list">${xs.map(t => `<div class="dw-row" data-open="${E(t.id)}"><span class="dk-no sm">${E(label(t.ticket))}</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${E(t.title)}</span><em class="dk-age ${sla(t.ticket)}">${ageDays(t.ticket)}d</em></div>`).join('')}</div>` : '<div class="dw-empty">No open tickets. 🎉</div>';
      el.querySelectorAll('[data-open]').forEach(r => r.onclick = () => edit(r.dataset.open));
    } });

    if (!document.getElementById('dk-css')) {
      const st = document.createElement('style'); st.id = 'dk-css';
      st.textContent = `
        .wrap.dk-wide{max-width:1180px}
        .chip.tkt{background:color-mix(in srgb,#0f9d58 12%,transparent);color:color-mix(in srgb,#0f9d58 75%,var(--text))}
        .chip.tkt.st-escalated{background:color-mix(in srgb,var(--danger) 12%,transparent);color:var(--danger)}
        .chip.tkt.st-hold,.chip.tkt.st-customer{background:var(--hover);color:var(--muted)}
        .chip.tkt.warn{box-shadow:inset 0 0 0 1px color-mix(in srgb,#d97706 60%,transparent)}.chip.tkt.breach{background:var(--danger);color:#fff}
        .dk-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px}
        .dk-sum{display:flex;gap:16px;font-size:13.5px;color:var(--muted)}.dk-sum b{font-size:20px;color:var(--text);margin-right:3px}.dk-sum .breach,.dk-sum .breach b{color:var(--danger)}.dk-sum .ok b{color:var(--ok)}
        .dk-tools{display:flex;gap:8px;align-items:center}.dk-tools select{width:auto;height:34px;padding:4px 10px}
        .dk-board{display:grid;grid-template-columns:repeat(4,minmax(200px,1fr));gap:12px;align-items:start;overflow-x:auto;padding-bottom:6px}
        .dk-col{background:color-mix(in srgb,var(--text) 3.5%,transparent);border-radius:14px;padding:8px;min-height:120px;transition:background .15s}.dk-col.over{background:var(--accent-soft)}
        .dk-ch{display:flex;justify-content:space-between;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);padding:4px 6px 8px}.dk-ch span{font-weight:600}
        .dk-col[data-col=escalated] .dk-ch{color:var(--danger)}
        .dk-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 11px;margin-bottom:8px;box-shadow:0 1px 2px rgba(0,0,0,.04);cursor:grab;border-left:3px solid transparent}
        .dk-card.warn{border-left-color:#d97706}.dk-card.breach{border-left-color:var(--danger)}.dk-card.drag{opacity:.4}
        .dk-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
        .dk-no{font:600 12px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted)}.dk-no a{color:var(--accent);text-decoration:none}.dk-no a:hover{text-decoration:underline}.dk-no.sm{flex:none;margin-right:8px}
        .dk-pri{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:2px 7px;border-radius:999px;background:var(--hover);color:var(--muted)}
        .dk-pri.p-urgent{background:var(--danger);color:#fff}.dk-pri.p-high{background:color-mix(in srgb,var(--danger) 14%,transparent);color:var(--danger)}.dk-pri.p-low{opacity:.7}
        .dk-t{font-size:14px;font-weight:550;line-height:1.35;overflow-wrap:anywhere;cursor:pointer;margin-bottom:8px}.dk-t:hover{color:var(--accent)}
        .dk-meta{display:flex;flex-wrap:wrap;gap:5px;align-items:center;margin-bottom:8px}
        .dk-age{margin-left:auto;font-size:11.5px;font-weight:700;font-style:normal;color:var(--muted)}.dk-age.warn{color:#d97706}.dk-age.breach{color:var(--danger)}
        .dk-st{width:100%;font:inherit;font-size:12px;padding:4px 6px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--text)}
        .dk-empty{color:var(--faint);text-align:center;padding:18px 0;font-size:13px}
        @media (max-width:900px){.dk-board{grid-template-columns:repeat(4,240px)}}
      `;
      document.head.appendChild(st);
    }
  }
});
