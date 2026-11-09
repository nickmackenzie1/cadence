/* Built-in Cadence plugin — uses only the public plugin API. */
(() => {
const registerPlugin = def => Cadence.registerPlugin(def);
registerPlugin({
  id:'recap', spaces: ['work'], name:'Client recap email', version:'2.0.0', icon: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>', color: '#2f7de1', category: 'Meetings', tagline: 'Formatted recap & status emails', builtin:true,
  description:'Formatted follow-up emails — action items for both sides in clean tables, optional AI summary. Pastes into Outlook/Gmail with formatting intact.',
  setup(api){
    const E = api.ui.esc;
    const firstName = () => (api.settings().myName || '').split(' ')[0];
    const dueTxt = i => i.dueDate ? api.util.fmtDate(i.dueDate) + (i.dueTime ? '' : '') : '—';
    const dateStr = ts => new Date(ts || Date.now()).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});

    function emailHTML(d){
      const th = 'text-align:left;font-size:12px;color:#6b6b6b;font-weight:600;padding:8px 10px;border-bottom:1px solid #e5e5e5;';
      const td = 'padding:9px 10px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#1d1c1a;vertical-align:top;';
      const table = (title, color, rows, who) => `
        <tr><td style="padding:22px 0 8px;"><div style="font-size:13px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.05em;border-left:3px solid ${color};padding-left:8px;">${E(title)} (${rows.length})</div></td></tr>
        <tr><td>${rows.length ? `<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
          <tr><th style="${th}">Action item</th><th style="${th}width:140px;">Owner</th><th style="${th}width:110px;">Due</th></tr>
          ${rows.map(i => `<tr><td style="${td}">${i.done ? '<s style="color:#999">' + E(i.title) + '</s> ✓' : E(i.title)}</td><td style="${td}color:#555;">${E(i.assignee || who)}</td><td style="${td}color:#555;white-space:nowrap;">${E(dueTxt(i))}</td></tr>`).join('')}
        </table>` : `<div style="font-size:14px;color:#888;padding:4px 0 0 11px;">Nothing outstanding.</div>`}</td></tr>`;
      return `<table cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1d1c1a;">
        <tr><td style="font-size:14px;line-height:1.55;padding-bottom:4px;">${E(d.greeting)}</td></tr>
        <tr><td style="font-size:14px;line-height:1.55;padding:10px 0 0;">${E(d.intro).replace(/\n/g,'<br>')}</td></tr>
        ${d.summary ? `<tr><td style="padding:22px 0 8px;"><div style="font-size:13px;font-weight:700;color:#444;text-transform:uppercase;letter-spacing:.05em;border-left:3px solid #999;padding-left:8px;">Summary</div></td></tr>
        <tr><td style="font-size:14px;line-height:1.6;padding-left:11px;">${E(d.summary).replace(/^\s*[-•]\s*/gm,'• ').replace(/\n/g,'<br>')}</td></tr>` : ''}
        ${d.hideOurs ? '' : table(d.ourLabel, '#4b4bc4', d.mine, d.me || 'Us')}
        ${table(d.theirLabel, '#b8691a', d.theirs, d.clientName || 'Client')}
        ${d.next ? `<tr><td style="padding:22px 0 0;font-size:14px;"><b>Next meeting:</b> ${E(d.next)}</td></tr>` : ''}
        <tr><td style="font-size:14px;line-height:1.55;padding-top:22px;">${E(d.closing).replace(/\n/g,'<br>')}</td></tr>
      </table>`;
    }
    function emailText(d){
      const rows = (l, who) => l.length ? l.map(i => `  • ${i.title}${i.done?' (done)':''} — ${i.assignee || who}${i.dueDate ? ', due ' + dueTxt(i) : ''}`).join('\n') : '  • Nothing outstanding';
      return `${d.greeting}\n\n${d.intro}\n${d.summary ? `\nSUMMARY\n${d.summary}\n` : ''}\n${d.hideOurs ? '' : d.ourLabel.toUpperCase() + '\n' + rows(d.mine, d.me || 'Us') + '\n\n'}${d.theirLabel.toUpperCase()}\n${rows(d.theirs, d.clientName || 'Client')}\n${d.next ? `\nNext meeting: ${d.next}\n` : ''}\n${d.closing}`;
    }

    function openRecap(o){
      const me = firstName();
      const d = {
        clientName: o.clientName || '', me, mine: o.mine, theirs: o.theirs, summary: '', next: '',
        subject: o.subject, greeting: `Hi ${o.clientName ? o.clientName + ' team' : 'all'},`, intro: o.intro,
        ourLabel: o.ourLabel || (me ? `Action items — ${me}` : 'Action items — our side'), theirLabel: o.theirLabel || `Action items — ${o.clientName || 'your side'}`, hideOurs: !!o.hideOurs,
        closing: (o.closing || `Let me know if I missed anything or if any dates need to shift.`) + `\n\nThanks,\n${me || ''}`.trim()
      };
      api.ui.modal(o.title || '✉ Recap email', `
        <div class="field"><label>Subject</label><div class="row"><input class="inp" id="rc-subject" value="${E(d.subject)}"><button class="btn" id="rc-copysub">Copy</button></div></div>
        <div class="row" style="gap:12px">
          <div class="field" style="flex:1"><label>Greeting</label><input class="inp" id="rc-greeting" value="${E(d.greeting)}"></div>
          <div class="field" style="flex:1"><label>Next meeting (optional)</label><input class="inp" id="rc-next" placeholder="e.g. Thu Nov 12, 2pm"></div></div>
        <div class="field"><label>Intro</label><textarea class="inp" id="rc-intro" style="min-height:60px">${E(d.intro)}</textarea></div>
        <div class="field"><label style="display:flex;align-items:center;gap:8px">Summary (optional)${api.ai && o.notes ? '<button class="btn" id="rc-ai" style="text-transform:none;letter-spacing:0;margin-left:auto">✦ Write from meeting notes</button>' : ''}</label>
          <textarea class="inp" id="rc-summary" style="min-height:70px" placeholder="Key decisions and context — a few bullets"></textarea></div>
        <div class="field"><label>Preview</label><div id="rc-preview" style="background:#fff;color:#1d1c1a;border:1px solid var(--line);border-radius:10px;padding:20px 22px"></div></div>`,
        `<span class="muted" style="font-size:12px;margin-right:auto;align-self:center">Paste into Outlook or Gmail — formatting is kept.</span><button class="btn" id="rc-plain">Copy plain text</button><button class="btn primary" id="rc-copy">Copy formatted email</button>`, 'wide');
      const $ = s => document.querySelector(s);
      const sync = () => { d.subject = $('#rc-subject').value; d.greeting = $('#rc-greeting').value; d.intro = $('#rc-intro').value; d.summary = $('#rc-summary').value.trim(); d.next = $('#rc-next').value.trim(); $('#rc-preview').innerHTML = emailHTML(d); };
      ['#rc-subject','#rc-greeting','#rc-intro','#rc-summary','#rc-next'].forEach(s => $(s).addEventListener('input', sync));
      sync();
      $('#rc-copysub').onclick = () => api.ui.copy(d.subject);
      $('#rc-plain').onclick = () => { api.ui.copy(`Subject: ${d.subject}\n\n` + emailText(d)); o.onCopy && o.onCopy(); };
      $('#rc-copy').onclick = async () => {
        const html = emailHTML(d), text = emailText(d);
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], {type:'text/html'}), 'text/plain': new Blob([text], {type:'text/plain'}) })]);
          api.ui.toast('Formatted email copied — paste it into a new message'); o.onCopy && o.onCopy();
        } catch(e){
          try { const r = document.createRange(); r.selectNodeContents($('#rc-preview')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); const ok = document.execCommand('copy'); sel.removeAllRanges(); api.ui.toast(ok ? 'Formatted email copied — paste it into a new message' : 'Select the preview and press ⌘C to copy'); if(ok && o.onCopy) o.onCopy(); }
          catch(e2){ api.ui.toast('Select the preview and press ⌘C to copy'); }
        }
      };
      const aiBtn = $('#rc-ai');
      if(aiBtn) aiBtn.onclick = async () => {
        aiBtn.disabled = true; aiBtn.textContent = 'Writing…';
        try {
          const res = await api.ai(`Write a concise meeting summary for a client follow-up email from a technology consultant${me ? ' named ' + me : ''} to ${o.clientName || 'the client'}. 3–5 short bullet points starting with "• ", covering decisions made and key context. Do NOT list action items (they appear separately). Professional, friendly, no fluff. Output only the bullets.\n\nMeeting notes:\n"""\n${o.notes.slice(0, 40000)}\n"""`, { modelTier:'quick' });
          $('#rc-summary').value = (res.text || '').trim(); sync();
        } catch(e){ api.ui.toast(e && e.code === 'rate_limited' ? 'AI is busy — try again shortly' : 'Couldn’t write the summary'); }
        aiBtn.disabled = false; aiBtn.textContent = '✦ Write from meeting notes';
      };
    }

    const subj = (clientName, ts, what = 'Meeting recap & action items') => `${clientName ? clientName + ' — ' : ''}${what} (${new Date(ts || Date.now()).toLocaleDateString(undefined,{month:'short',day:'numeric'})})`;

    const recapMeeting = (m, items) => {
      const c = api.clients.get(m.clientId), name = c ? c.name : '';
      openRecap({ clientName: name, mine: items.filter(i => i.owner === 'me'), theirs: items.filter(i => i.owner === 'client'), notes: m.notes || '',
        subject: subj(name, m.start), intro: `Thanks for your time ${new Date(m.start).toDateString() === new Date().toDateString() ? 'today' : 'on ' + dateStr(m.start)}. Here’s a recap of what we covered and the action items we agreed on.` });
    };
    api.meetingActions.add({ label:'✉ Recap email', run: (m, items) => recapMeeting(m, items) });
    api.commands.add({ title:'Status update email for current client', run: api => {
      const r = api.ui.currentRoute(); if(!r.startsWith('client-')){ api.ui.toast('Open a client first'); return; }
      const cid = r.slice(7), c = api.clients.get(cid), open = api.tasks.list(t => !t.done && t.clientId === cid);
      openRecap({ clientName: c.name, mine: open.filter(t => t.owner === 'me'), theirs: open.filter(t => t.owner === 'client'), notes: '',
        subject: subj(c.name, null, 'Status update'), intro: 'Here’s a quick update on where things stand and what’s outstanding on each side.' });
    }});
    api.clientActions.add({ label:'✉  Status update email', run: (c, api) => {
      const open = api.tasks.list(t => !t.done && t.clientId === c.id);
      openRecap({ clientName: c.name, mine: open.filter(t => t.owner === 'me'), theirs: open.filter(t => t.owner === 'client'), notes: '',
        subject: subj(c.name, null, 'Status update'), intro: 'Here’s a quick update on where things stand and what’s outstanding on each side.' });
    }});
    api.taskActions.add({ label:'Copy as follow-up line', run: (t, api) => api.ui.copy(`• ${t.title}${t.assignee ? ` (${t.assignee})` : ''}${t.dueDate ? ` — by ${api.util.fmtDate(t.dueDate)}` : ''}`) });
    // expose for other plugins
    window.CadenceRecap = { open: openRecap, meeting: recapMeeting };
  }
});
})();
