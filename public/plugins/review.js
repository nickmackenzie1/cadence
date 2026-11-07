/* Built-in Cadence plugin — uses only the public plugin API. */
(() => {
const registerPlugin = def => Cadence.registerPlugin(def);
registerPlugin({
  id:'review', name:'Weekly review', version:'1.0.0', builtin:true,
  description:'Friday-afternoon look back: what got done per client, what slipped, who owes you, who has gone quiet, and what’s coming next week.',
  setup(api){
    const E = api.ui.esc;
    const monday = () => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };
    api.views.add({ id:'review', title:'Weekly review', icon:'✦', subtitle:'', render: (el, api) => {
      const t = api.util.todayKey(), wk = monday().getTime(), clients = api.clients.list(), cmap = Object.fromEntries(clients.map(c => [c.id, c]));
      const all = api.tasks.list(), open = all.filter(x => !x.done);
      const doneWk = all.filter(x => x.done && x.doneAt >= wk), mtgWk = api.meetings.list().filter(m => m.start >= wk);
      const slipped = open.filter(x => x.owner === 'me' && x.dueDate && x.dueDate < t).sort((a,b) => a.dueDate.localeCompare(b.dueDate));
      const owed = open.filter(x => x.owner === 'client' && x.dueDate && x.dueDate < t);
      const nextEnd = api.util.ymd(api.util.addDays(new Date(), 8));
      const nextWk = open.filter(x => x.owner === 'me' && x.dueDate && x.dueDate > t && x.dueDate <= nextEnd);
      const quiet = clients.filter(c => c.status !== 'paused').map(c => { const last = Math.max(0, ...api.meetings.list().filter(m => m.clientId === c.id).map(m => m.start), ...all.filter(x => x.clientId === c.id).map(x => x.doneAt || x.createdAt)); return { c, days: last ? Math.floor((Date.now() - last) / 864e5) : null }; }).filter(r => r.days === null || r.days >= 14);
      const byClient = (arr) => { const g = {}; arr.forEach(x => (g[x.clientId || '_'] = g[x.clientId || '_'] || []).push(x)); return Object.entries(g).sort((a,b) => b[1].length - a[1].length); };
      const cname = id => cmap[id] ? `${api.ui.avatar(cmap[id], 18)} ${E(cmap[id].name)}` : '<span class="muted">No client</span>';
      const stat = (v, l, color) => `<div class="stat"><div class="v" style="${color ? 'color:' + color : ''}">${v}</div><div class="l">${l}</div></div>`;
      const row = (x, extra = '') => `<div class="rv-row" data-go="${x.clientId ? 'client-' + x.clientId : ''}"><span>${E(x.title)}</span>${extra}</div>`;
      el.innerHTML = `
        <div class="muted" style="margin:-14px 0 18px">Week of ${monday().toLocaleDateString(undefined,{month:'long',day:'numeric'})}</div>
        <div class="stats">${stat(doneWk.length, 'Completed this week', 'var(--ok)')}${stat(mtgWk.length, 'Meetings')}${stat(slipped.length, 'Slipped (overdue on me)', slipped.length ? 'var(--danger)' : '')}${stat(owed.length, 'Overdue from clients', owed.length ? 'var(--client)' : '')}</div>
        <div class="cols">
          <div>
            <div class="group"><div class="group-h">✓ Done this week<span class="c">${doneWk.length}</span></div>
              ${byClient(doneWk).map(([cid, xs]) => `<details class="rv-c"><summary>${cname(cid)}<span class="muted" style="margin-left:auto">${xs.length}</span></summary>${xs.map(x => row(x)).join('')}</details>`).join('') || '<div class="muted" style="padding:8px 4px">Nothing completed yet this week.</div>'}</div>
            <div class="group"><div class="group-h danger">⚠ Slipped<span class="c">${slipped.length}</span></div>
              ${slipped.map(x => row(x, `<span class="chip">${cmap[x.clientId] ? E(cmap[x.clientId].name) : ''}</span><span class="chip due over">${E(api.util.fmtDate(x.dueDate))}</span>`)).join('') || '<div class="muted" style="padding:8px 4px">Nothing slipped. Nice.</div>'}</div>
          </div>
          <div>
            <div class="group"><div class="group-h client">↗ Clients owe you (overdue)<span class="c">${owed.length}</span></div>
              ${byClient(owed).map(([cid, xs]) => `<div class="rv-c-row">${cname(cid)}<span class="muted">${xs.length} item${xs.length===1?'':'s'}</span>${cmap[cid] && window.CadenceChase ? `<button class="btn" data-chase="${cid}" style="margin-left:auto;padding:4px 10px">⚑ Chase</button>` : ''}</div>`).join('') || '<div class="muted" style="padding:8px 4px">Everyone’s on time.</div>'}</div>
            <div class="group"><div class="group-h">◌ Gone quiet (14+ days)<span class="c">${quiet.length}</span></div>
              ${quiet.map(r => `<div class="rv-c-row" data-go="client-${r.c.id}" style="cursor:pointer">${cname(r.c.id)}<span class="muted" style="margin-left:auto">${r.days === null ? 'no activity' : r.days + ' days'}</span></div>`).join('') || '<div class="muted" style="padding:8px 4px">You’re in touch with everyone.</div>'}</div>
            <div class="group"><div class="group-h">→ Coming up (next 7 days)<span class="c">${nextWk.length}</span></div>
              ${nextWk.sort((a,b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 12).map(x => row(x, `<span class="chip due">${E(api.util.fmtDate(x.dueDate))}</span>`)).join('') || '<div class="muted" style="padding:8px 4px">Nothing scheduled — a good time to plan.</div>'}</div>
          </div>
        </div>
        <div class="row" style="justify-content:flex-end"><button class="btn" id="rv-copy">Copy summary</button></div>`;
      el.querySelectorAll('[data-go]').forEach(x => x.dataset.go && x.addEventListener('click', () => api.ui.navigate(x.dataset.go)));
      el.querySelectorAll('[data-chase]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); window.CadenceChase.chase(cmap[b.dataset.chase]); }));
      el.querySelector('#rv-copy').onclick = () => {
        const n = id => cmap[id] ? cmap[id].name : 'No client';
        api.ui.copy(`Weekly review — week of ${monday().toLocaleDateString(undefined,{month:'short',day:'numeric'})}\n\nDone (${doneWk.length})\n${byClient(doneWk).map(([cid, xs]) => `  ${n(cid)}: ${xs.map(x => x.title).join('; ')}`).join('\n') || '  —'}\n\nSlipped (${slipped.length})\n${slipped.map(x => `  • ${x.title} (${n(x.clientId)}, ${api.util.fmtDate(x.dueDate)})`).join('\n') || '  —'}\n\nOwed by clients (${owed.length})\n${byClient(owed).map(([cid, xs]) => `  ${n(cid)}: ${xs.length}`).join('\n') || '  —'}\n\nGone quiet: ${quiet.map(r => r.c.name).join(', ') || '—'}\nNext 7 days: ${nextWk.length} tasks`);
      };
    }});
    api.commands.add({ title:'Weekly review', hint:'R', run: api => api.ui.navigate('view-review') });
    // Friday-afternoon nudge, once a week, remembered per device (never touches synced data)
    setTimeout(() => {
      const d = new Date(); if(d.getDay() !== 5 || d.getHours() < 14) return;
      const k = 'cadence.reviewNudge', wkKey = api.util.ymd(monday());
      try { if(localStorage.getItem(k) === wkKey) return; localStorage.setItem(k, wkKey); } catch(e){ return; }
      api.ui.toast('It’s Friday — time for your weekly review ✦', [{ label:'Open review', run: () => api.ui.navigate('view-review') }]);
    }, 4000);
  }
});
})();
