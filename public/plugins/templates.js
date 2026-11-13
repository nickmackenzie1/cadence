/* Built-in Cadence plugin — uses only the public plugin API. */
(() => {
const registerPlugin = def => Cadence.registerPlugin(def);
registerPlugin({
  id:'templates', spaces: ['work'], name:'Project templates', version:'1.0.0', icon: '<path d="M12 3.5l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>', color: '#12a594', category: 'Clients', tagline: 'Kick off projects in one click', builtin:true,
  description:'Apply a checklist (Zoho CRM implementation, Books setup, Desk rollout, retainer…) to a client with real dates. Edit templates or save a client’s plan as a new one.',
  setup(api){
    const E = api.ui.esc;
    const DEFAULTS = [
      { id:'crm', name:'Zoho CRM implementation', body:`+0 Kickoff & discovery workshop
+1 ^ Share current process docs and a sample data export
+3 Map sales process & requirements
+5 Design CRM blueprint: modules, fields, layouts
+7 ^ Review & sign off on the CRM design
+10 Configure modules, fields and layouts
+12 Build workflows & automations (Deluge) #crm
+14 Data cleanup & import
+16 Set up users, roles & profiles
+18 ^ User acceptance testing
+20 Fix UAT feedback
+21 Admin & end-user training
+22 Go-live 🚀
+36 Post go-live check-in` },
      { id:'books', name:'Zoho Books setup', body:`+0 Kickoff: chart of accounts & tax review
+2 ^ Provide opening balances, bank details & logo
+4 Configure organization, taxes & currencies #books
+5 Set up chart of accounts & items
+6 Invoice & estimate templates
+7 Bank feeds & payment gateways
+8 Import customers, vendors & opening balances
+10 ^ Review test invoices
+12 Training session
+13 Go-live 🚀` },
      { id:'desk', name:'Zoho Desk rollout', body:`+0 Kickoff: support channels & SLAs
+2 ^ Provide support mailbox access & team list
+4 Configure departments, agents & roles #desk
+5 Set up email, web form & chat channels
+6 SLAs, assignment rules & blueprints
+8 Help center & knowledge base
+9 Integrate Desk with CRM
+10 ^ Test ticket flows
+12 Agent training
+13 Go-live 🚀` },
      { id:'retainer', name:'Monthly retainer cycle', body:`+0 Monthly check-in call
+0 ^ Send priorities for the month
+2 Review system health & usage reports
+25 Send monthly summary` }
    ];
    const list = () => api.storage.get('templates') || DEFAULTS;
    const parse = body => body.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const m = l.match(/^(?:\+?(\d+)\s*(d|w)?\b)?\s*(\^(\S*))?\s*(.+)$/i);
      return { offset: (+(m[1]||0)) * (/w/i.test(m[2]||'') ? 7 : 1), owner: m[3] ? 'client' : 'me', assignee: m[4] || '', text: m[5] };
    });
    const shift = (d, skip) => { if(skip){ while(d.getDay() === 0 || d.getDay() === 6) d = api.util.addDays(d, 1); } return d; };

    function apply(c, preId){
      const tpls = list();
      api.ui.modal(`${api.ui.avatar(c,22)}&nbsp; Apply template — ${E(c.name)}`, `
        <div class="row" style="gap:12px;align-items:flex-end">
          <div class="field" style="flex:2"><label>Template</label><select class="inp" id="tp-sel">${tpls.map((t,i) => `<option value="${i}" ${t.id===preId?'selected':''}>${E(t.name)}</option>`).join('')}</select></div>
          <div class="field" style="flex:1"><label>Start date</label><input class="inp" type="date" id="tp-start" value="${api.util.todayKey()}"></div>
        </div>
        <label class="row muted" style="align-items:center;gap:6px;font-size:13px"><input type="checkbox" id="tp-wk" checked> Move weekend dates to Monday</label>
        <div id="tp-prev"></div>`,
        `<button class="btn ghost" id="tp-edit" style="margin-right:auto">Edit templates…</button><button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="tp-go">Add tasks</button>`, 'wide');
      const $ = s => document.querySelector(s);
      const build = () => {
        const tpl = tpls[+$('#tp-sel').value], start = $('#tp-start').value || api.util.todayKey();
        const [y,m,d] = start.split('-').map(Number), base = new Date(y, m-1, d);
        return parse(tpl.body).map(it => { const r = api.util.parse(it.text, { owner: it.owner }); return { ...it, title: r.title, tags: r.tags, dueDate: api.util.ymd(shift(api.util.addDays(base, it.offset), $('#tp-wk').checked)) }; });
      };
      const draw = () => { const items = build(); $('#tp-prev').innerHTML = `<div class="group"><div class="group-h">${items.length} tasks</div>${items.map(i => `<div class="rv-item" style="grid-template-columns:1fr auto auto"><span>${E(i.title)}${i.tags.map(t => ` <span class="chip">#${E(t)}</span>`).join('')}</span>${i.owner==='client' ? `<span class="chip client-owned">↗ ${E(i.assignee || c.name)}</span>` : '<span></span>'}<span class="muted" style="font-size:12px;white-space:nowrap">${E(api.util.fmtDate(i.dueDate))}</span></div>`).join('')}</div>`; };
      ['#tp-sel','#tp-start','#tp-wk'].forEach(s => $(s).addEventListener('change', draw)); draw();
      $('#tp-edit').onclick = () => edit(() => apply(c));
      $('#tp-go').onclick = () => {
        const items = build(), tpl = tpls[+$('#tp-sel').value];
        items.forEach(i => api.tasks.add({ title: i.title, clientId: c.id, owner: i.owner, assignee: i.assignee, dueDate: i.dueDate, tags: i.tags }));
        api.ui.close(); api.ui.navigate('client-' + c.id); api.ui.refresh();
        api.ui.toast(`Added ${items.length} tasks from “${tpl.name}”`);
      };
    }
    function edit(back){
      let tpls = JSON.parse(JSON.stringify(list())), cur = 0;
      const draw = () => {
        api.ui.modal('Edit templates', `
          <div class="row" style="gap:8px;flex-wrap:wrap">${tpls.map((t,i) => `<button class="btn ${i===cur?'primary':''}" data-tpi="${i}">${E(t.name)}</button>`).join('')}<button class="btn ghost" id="te-new">+ New</button></div>
          ${tpls[cur] ? `<div class="field"><label>Name</label><input class="inp" id="te-name" value="${E(tpls[cur].name)}"></div>
          <div class="field"><label>Tasks — one per line</label><textarea class="inp" id="te-body" style="min-height:260px;font-family:var(--mono);font-size:13px">${E(tpls[cur].body)}</textarea>
          <div class="muted" style="font-size:12px;margin-top:6px"><code>+5</code> = 5 days after start (<code>+2w</code> for weeks) · <code>^</code> = client’s item, <code>^Sarah</code> to name someone · <code>#tag</code> works too</div></div>` : '<div class="muted">No templates. Add one.</div>'}`,
          `${tpls[cur] ? '<button class="btn ghost danger" id="te-del" style="margin-right:auto">Delete template</button>' : ''}<button class="btn" id="te-reset" ${tpls[cur]?'':'style="margin-right:auto"'}>Restore defaults</button><button class="btn" id="te-cancel">Cancel</button><button class="btn primary" id="te-save">Save</button>`, 'wide');
        const $ = s => document.querySelector(s);
        const grab = () => { if(tpls[cur] && $('#te-name')){ tpls[cur].name = $('#te-name').value.trim() || 'Untitled'; tpls[cur].body = $('#te-body').value; } };
        document.querySelectorAll('[data-tpi]').forEach(b => b.onclick = () => { grab(); cur = +b.dataset.tpi; draw(); });
        $('#te-new').onclick = () => { grab(); tpls.push({ id: 'u' + Date.now(), name: 'New template', body: '+0 Kickoff\n+3 ^ Client to send…\n+7 Deliver…' }); cur = tpls.length - 1; draw(); };
        if($('#te-del')) $('#te-del').onclick = () => { tpls.splice(cur, 1); cur = 0; draw(); };
        $('#te-reset').onclick = () => { tpls = JSON.parse(JSON.stringify(DEFAULTS)); cur = 0; draw(); };
        $('#te-cancel').onclick = () => back ? back() : api.ui.close();
        $('#te-save').onclick = () => { grab(); api.storage.set('templates', tpls); api.ui.toast('Templates saved'); back ? back() : api.ui.close(); };
      };
      draw();
    }
    function saveAs(c){
      const open = api.tasks.list(x => !x.done && x.clientId === c.id).sort((a,b) => (a.dueDate||'9999').localeCompare(b.dueDate||'9999'));
      if(!open.length) return api.ui.toast('This client has no open tasks to save');
      const first = open.find(x => x.dueDate)?.dueDate, base = first ? new Date(first.replace(/-/g,'/')) : new Date();
      const body = open.map(x => { const off = x.dueDate ? Math.max(0, Math.round((new Date(x.dueDate.replace(/-/g,'/')) - base) / 864e5)) : 0; return `+${off} ${x.owner === 'client' ? '^' + (x.assignee ? x.assignee.split(' ')[0] : '') + ' ' : ''}${x.title}${(x.tags||[]).map(t => ' #' + t).join('')}`; }).join('\n');
      const tpls = list().slice(); tpls.push({ id: 'u' + Date.now(), name: `${c.name} plan`, body });
      api.storage.set('templates', tpls); edit(); setTimeout(() => { const btns = document.querySelectorAll('[data-tpi]'); btns[btns.length-1] && btns[btns.length-1].click(); }, 30);
      api.ui.toast('Saved as a template — rename it and tidy up');
    }
    api.clientActions.add({ id:'tpl-apply', label:'▤  Apply project template', run: c => apply(c) });
    api.clientActions.add({ id:'tpl-save', label:'⎘  Save open tasks as template', run: c => saveAs(c) });
    api.commands.add({ title:'Apply project template to current client', run: api => { const r = api.ui.currentRoute(); if(!r.startsWith('client-')) return api.ui.toast('Open a client first'); apply(api.clients.get(r.slice(7))); } });
    api.commands.add({ title:'Edit project templates', run: () => edit() });
    api.onSettings(() => edit());
    window.CadenceTemplates = { apply: (c, id) => apply(c, id), name: id => { const t = list().find(x => x.id === id); return t ? t.name : ''; } };
  }
});
})();
