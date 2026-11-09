/* Built-in Cadence plugin — uses only the public plugin API. */
(() => {
const registerPlugin = def => Cadence.registerPlugin(def);
registerPlugin({
  id:'chase', spaces: ['work'], name:'Chase client items', version:'1.0.0', icon: '<path d="M4 12h13M12 6l6 6-6 6"/>', color: '#f59e0b', category: 'Clients', tagline: 'Nudge clients on what they owe', builtin:true,
  description:'One click to write a polite reminder email listing everything a client owes you, overdue first. Marks items as chased.',
  setup(api){
    function chase(c){
      const t = api.util.todayKey();
      const items = api.tasks.list(x => !x.done && x.clientId === c.id && x.owner === 'client').sort((a,b) => (a.dueDate||'9999').localeCompare(b.dueDate||'9999'));
      if(!items.length) return api.ui.toast(`${c.name} doesn’t owe you anything right now 🎉`);
      const over = items.filter(x => x.dueDate && x.dueDate < t).length;
      const mark = () => items.forEach(x => api.tasks.update(x.id, { lastChased: Date.now() }));
      const intro = over
        ? `Just a friendly nudge on a few items we’re waiting on from your side. ${over === 1 ? 'One is' : over + ' are'} now past the date we agreed, so getting ${over === 1 ? 'it' : 'them'} over will keep the project on track.`
        : `Just a quick nudge on the items we’re waiting on from your side to keep things moving.`;
      if(window.CadenceRecap){
        window.CadenceRecap.open({ clientName: c.name, mine: [], theirs: items, hideOurs: true, notes: '',
          title: '⚑ Chase email', theirLabel: 'Waiting on your side', subject: `${c.name} — friendly reminder: ${items.length} open item${items.length===1?'':'s'}`,
          intro, closing: 'If anything is blocked or you need a hand with any of these, just let me know and I’ll jump in.', onCopy: mark });
      } else {
        api.ui.copy(`${intro}\n\n${items.map(x => `• ${x.title}${x.dueDate ? ' — ' + api.util.fmtDate(x.dueDate) : ''}`).join('\n')}`); mark();
      }
    }
    api.clientActions.add({ id:'chase', label:'⚑  Chase outstanding items', where:['waiting'], short:'Chase', run: c => chase(c) });
    api.commands.add({ title:'Chase current client', run: api => { const r = api.ui.currentRoute(); if(!r.startsWith('client-')) return api.ui.toast('Open a client first'); chase(api.clients.get(r.slice(7))); } });
    window.CadenceChase = { chase };
  }
});
})();
