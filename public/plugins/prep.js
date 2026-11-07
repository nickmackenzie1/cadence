/* Built-in Cadence plugin — uses only the public plugin API. */
(() => {
const registerPlugin = def => Cadence.registerPlugin(def);
registerPlugin({
  id:'prep', name:'Meeting prep sheet', version:'1.0.0', builtin:true,
  description:'Before a call: what you owe, what they owe, what got done since last time, last meeting notes, and an agenda that carries into the meeting.',
  setup(api){
    const E = api.ui.esc;
    let saveT;
    function openPrep(c){
      const t = api.util.todayKey(), open = api.tasks.list(x => !x.done && x.clientId === c.id);
      const mtgs = api.meetings.list().filter(m => m.clientId === c.id).sort((a,b) => b.start - a.start), last = mtgs[0];
      const since = last ? last.start : Date.now() - 14 * 864e5;
      const done = api.tasks.list(x => x.done && x.clientId === c.id && x.doneAt >= since).sort((a,b) => b.doneAt - a.doneAt);
      const isOver = x => x.dueDate && x.dueDate < t;
      const mineOver = open.filter(x => x.owner === 'me' && isOver(x)), mine = open.filter(x => x.owner === 'me' && !isOver(x)), theirs = open.filter(x => x.owner === 'client').sort((a,b) => (a.dueDate||'9999').localeCompare(b.dueDate||'9999'));
      const key = 'agenda:' + c.id;
      let agenda = api.storage.get(key) || '';
      if(!agenda.trim()){
        const lines = [];
        if(done.length) lines.push('• Recap wins: ' + done.slice(0,3).map(x => x.title).join('; '));
        if(theirs.length) lines.push(`• Their open items (${theirs.length}) — confirm dates` + (theirs.some(isOver) ? ', some overdue' : ''));
        if(mineOver.length || mine.length) lines.push(`• Our progress & blockers (${mineOver.length + mine.length} open)`);
        lines.push('• Next steps & next meeting');
        agenda = lines.join('\n');
      }
      const li = x => `<li>${E(x.title)}${x.assignee ? ` <span class="muted">· ${E(x.assignee)}</span>` : ''}${x.dueDate ? ` <span class="${isOver(x) && !x.done ? 'over' : 'muted'}">· ${E(api.util.fmtDate(x.dueDate))}</span>` : ''}</li>`;
      const sec = (title, list, cls, empty) => `<div class="prep-sec ${cls}"><h4>${title}<span>${list.length}</span></h4>${list.length ? `<ul>${list.slice(0,12).map(li).join('')}${list.length > 12 ? `<li class="muted">+${list.length-12} more</li>` : ''}</ul>` : `<div class="muted" style="font-size:13px">${empty}</div>`}</div>`;
      api.ui.modal(`${api.ui.avatar(c, 22)}&nbsp; Prep — ${E(c.name)}`, `
        <div class="muted" style="margin-top:-6px;font-size:13px">${last ? `Last meeting ${E(api.util.fmtDate(api.util.ymd(new Date(last.start))).toLowerCase())} · ${mtgs.length} meeting${mtgs.length===1?'':'s'} logged` : 'No meetings logged yet'}${c.domain ? ` · ${E(c.domain)}` : ''}</div>
        <div class="prep-grid">
          ${sec('Overdue on me', mineOver, 'danger', 'Nothing overdue 👍')}
          ${sec('Waiting on them', theirs, 'client', 'Nothing outstanding')}
          ${sec('Open on me', mine, '', 'All clear')}
          ${sec(last ? 'Done since last meeting' : 'Done in the last 2 weeks', done, 'ok', 'Nothing yet')}
        </div>
        ${last && last.notes ? `<details class="mtg"><summary><b>Last meeting notes</b><span class="muted">${E(new Date(last.start).toLocaleDateString(undefined,{month:'short',day:'numeric'}))}</span></summary><div class="notes">${E(last.notes)}</div></details>` : ''}
        <div class="field"><label>Agenda</label><textarea class="inp" id="prep-agenda" style="min-height:96px">${E(agenda)}</textarea><div class="muted" style="font-size:12px;margin-top:5px">Saved automatically and added to the meeting notes when you start.</div></div>`,
        `<button class="btn" id="prep-copy" style="margin-right:auto">Copy agenda</button><button class="btn" data-act="close-modal">Close</button><button class="btn primary" id="prep-start">◉ Start meeting</button>`, 'wide');
      const ta = document.querySelector('#prep-agenda');
      ta.addEventListener('input', () => { clearTimeout(saveT); saveT = setTimeout(() => api.storage.set(key, ta.value), 500); });
      document.querySelector('#prep-copy').onclick = () => api.ui.copy(`Agenda — ${c.name} (${new Date().toLocaleDateString(undefined,{month:'short',day:'numeric'})})\n\n${ta.value.trim()}`);
      document.querySelector('#prep-start').onclick = () => {
        clearTimeout(saveT); const a = ta.value.trim(); api.storage.set(key, '');
        if(api.meetings.active()){ api.ui.toast('A meeting is already running — resuming it'); }
        api.meetings.start(c.id, a ? `Agenda\n${a}\n\nNotes\n` : '');
      };
    }
    api.clientActions.add({ id:'prep', label:'☰ Prep', primary:true, run: c => openPrep(c) });
    api.commands.add({ title:'Meeting prep for current client', run: api => { const r = api.ui.currentRoute(); if(!r.startsWith('client-')) return api.ui.toast('Open a client first'); openPrep(api.clients.get(r.slice(7))); } });
    window.CadencePrep = { open: openPrep };
  }
});
})();
