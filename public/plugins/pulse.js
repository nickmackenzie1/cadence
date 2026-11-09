/* Built-in Cadence plugin — uses only the public plugin API. */
(() => {
const registerPlugin = def => Cadence.registerPlugin(def);
registerPlugin({
  id:'pulse', spaces: ['work'], name:'Client Pulse', version:'1.0.0', icon: '<path d="M3 12h4l2-5 4 10 2-5h6"/>', color: '#ef4444', category: 'Clients', tagline: 'Every client at a glance', builtin:true,
  description:'A one-screen overview of all clients: open work, overdue items, what they owe you, and who you haven’t touched in a while.',
  setup(api){
    api.views.add({ id:'pulse', group: 'insights', title:'Client Pulse', icon:'◎', subtitle:'Every client at a glance — sorted by what needs attention', render: (el, api) => {
      const t = api.util.todayKey(), tasks = api.tasks.list(x => !x.done), mtgs = api.meetings.list();
      const rows = api.clients.list().filter(c => c.kind !== 'project').map(c => {
        const mine = tasks.filter(x => x.clientId === c.id && x.owner === 'me'), theirs = tasks.filter(x => x.clientId === c.id && x.owner === 'client');
        const over = mine.filter(x => x.dueDate && x.dueDate < t).length, chase = theirs.filter(x => x.dueDate && x.dueDate <= t).length;
        const last = Math.max(0, ...mtgs.filter(m => m.clientId === c.id).map(m => m.start), ...api.tasks.list(x => x.clientId === c.id).map(x => x.doneAt || x.createdAt));
        const days = last ? Math.floor((Date.now() - last) / 864e5) : null;
        return { c, mine: mine.length, theirs: theirs.length, over, chase, days, score: over*3 + chase*2 + (days > 14 ? 2 : 0) };
      }).sort((a,b) => b.score - a.score || a.c.name.localeCompare(b.c.name));
      if(!rows.length){ el.innerHTML = '<div class="empty"><b>No clients yet</b>Add some from the sidebar.</div>'; return; }
      el.innerHTML = `<table class="pulse"><thead><tr><th>Client</th><th>On me</th><th>Overdue</th><th>They owe</th><th>To chase</th><th>Last activity</th></tr></thead><tbody>${rows.map(r => `<tr class="click" data-go="client-${r.c.id}"><td style="display:flex;align-items:center;gap:10px">${api.ui.avatar(r.c, 22)}<b>${api.ui.esc(r.c.name)}</b>${r.c.status==='paused'?' <span class="badge">Paused</span>':''}</td><td>${r.mine||'–'}</td><td style="color:${r.over?'var(--danger)':''};font-weight:${r.over?600:400}">${r.over||'–'}</td><td>${r.theirs||'–'}</td><td style="color:${r.chase?'var(--client)':''};font-weight:${r.chase?600:400}">${r.chase||'–'}</td><td class="${r.days>14?'':'muted'}" style="color:${r.days>14?'var(--client)':''}">${r.days===null?'–':r.days===0?'Today':r.days+'d ago'}${r.days>14?' · quiet':''}</td></tr>`).join('')}</tbody></table>`;
      el.querySelectorAll('[data-go]').forEach(tr => tr.addEventListener('click', () => api.ui.navigate(tr.dataset.go)));
    }});
  }
});
})();
