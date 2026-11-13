/* Cadence: meeting mode — the live meeting screen (two columns of action items, notes, screenshots, the client band),
   the review step (tidy, AI wording, bulk due dates), saving the meeting as tasks, and importing notes (Fireflies etc.).
   Moved out of core.js (2026-11-13). core.js is one closure, so this file is a factory: core.js calls
   window.CadenceMeeting({ S, AI (live getters), save, render, esc, … }) once after its own definitions and gets the
   functions back. Everything here runs on user actions; the document listeners below are added once by that call.
   The buttons' data-act cases stay in core.js's one click handler and call into these functions. */
/* =========================================================
   Meeting mode
   ========================================================= */
window.CadenceMeeting = function(core){
'use strict';
const { $, $$, esc, uid, clone, norm, pad, ymd, todayKey, fmtDate, dueState, dueLabel, Store, save, client, decodeEntities, capFirst, INDUSTRY, job, avatar, addTask, open, parseQuick, parseChips, Reg, icon, emit, makeApi, route, go, render, onMe, group, TE_ICONS, toast, ask, openModalHTML, closeModal } = core;
let mTimer = null, notesTimer = null;
function startMeeting(cid, notes){
  closeModal();
  if(!core.S.activeMeeting){
    const r = route();
    cid = cid || (r.startsWith('client-') ? r.slice(7) : null);
    core.S.activeMeeting = { id: uid('m'), clientId: cid, start: Date.now(), items: [], notes: notes || '', phase: 'live', nextOwner: 'me', shots: [], agendaDone: {} };
    save(); emit('meeting:start', clone(core.S.activeMeeting));
    const ag = cid && (client(cid) || {}).agenda; if(ag && ag.length && window.CadenceIsland) window.CadenceIsland.show({ icon: '📋', title: `${ag.length} thing${ag.length === 1 ? '' : 's'} on the agenda`, sub: ag.slice(0, 2).map(a => a.text).join(' · '), log: false });
  }
  $('#meeting').classList.add('open'); renderMeeting();
  clearInterval(mTimer); mTimer = setInterval(() => { const el = $('#m-timer'); if(el && core.S.activeMeeting) el.textContent = elapsed(core.S.activeMeeting.start); }, 1000);
}
const elapsed = s => { const sec = Math.floor((Date.now() - s)/1000); return `${Math.floor(sec/3600) ? Math.floor(sec/3600)+':' : ''}${pad(Math.floor(sec/60)%60)}:${pad(sec%60)}`; };
function hideMeeting(){ $('#meeting').classList.remove('open'); clearInterval(mTimer); render(); }
function addMeetingItem(text){
  const M = core.S.activeMeeting; let owner = M.nextOwner;
  let txt = text.trim();
  const pm = txt.match(/^(me|i|c|client|they|them)\s*[:>]\s*/i); if(pm){ owner = /^(me|i)$/i.test(pm[1]) ? 'me' : 'client'; txt = txt.slice(pm[0].length); }
  const r = parseQuick(txt, { clientId: M.clientId, owner });
  if(!r.title) return;
  M.items.push({ id: uid('i'), title: capFirst(r.title), owner: r.owner, assignee: r.assignee, dueDate: r.dueDate, dueTime: r.dueTime, priority: r.priority, tags: r.tags, repeat: r.repeat, include: true });
  save();
}
function renderMeeting(){
  const M = core.S.activeMeeting, el = $('#meeting'); if(!M){ hideMeeting(); return; }
  const c = client(M.clientId);
  const clientSel = `<select class="inp" id="m-client" style="width:auto;min-width:180px"><option value="">No client</option>${core.S.clients.filter(x=>!x.archived).map(x => `<option value="${x.id}" ${x.id===M.clientId?'selected':''}>${esc(x.name)}</option>`).join('')}</select>`;
  const item = i => `<div class="m-item" data-iid="${i.id}"><span class="tt" contenteditable="true" spellcheck="false">${esc(i.title)}</span>${i.dueDate ? `<span class="chip due">${esc(dueLabel(i))}</span>` : ''}${i.assignee ? `<span class="chip client-owned">${esc(i.assignee)}</span>` : ''}<button class="sw" data-act="m-swap" title="Move to other side">⇄</button><button class="x" data-act="m-del" title="Remove">×</button></div>`;
  if(M.phase === 'live'){
    const mine = M.items.filter(i => i.owner === 'me'), theirs = M.items.filter(i => i.owner === 'client');
    el.innerHTML = `<div class="m-head"><span class="live"><i></i>Live</span>${clientSel}<span class="timer" id="m-timer">${elapsed(M.start)}</span><span style="margin-left:auto"></span>
        <button class="btn" data-act="m-import">⇣ Import notes (Fireflies)</button><button class="btn ghost" data-act="m-hide" title="Keep meeting running in background">Minimize</button><button class="btn primary" data-act="m-review">End &amp; review ${M.items.length ? `(${M.items.length})` : ''}</button></div>
      <div class="m-body"><div class="m-main">
        <div class="m-cols"><div class="m-col me"><h3>On me <span class="muted">${mine.length}</span></h3>${mine.map(item).join('') || '<div class="muted" style="font-size:13px">Your action items land here.</div>'}</div>
          <div class="m-col cl"><h3>On ${esc(c ? c.name : 'client')} <span class="muted">${theirs.length}</span></h3>${theirs.map(item).join('') || '<div class="muted" style="font-size:13px">Things the client owes you land here.</div>'}</div></div>
        ${shotsStrip(M)}
        <div class="m-input"><div class="qa"><div class="qa-row"><span class="owner-pill ${M.nextOwner}" data-act="m-owner" style="cursor:pointer" title="Tab to switch">${M.nextOwner==='me'?'Me':(c?esc(c.name):'Client')}</span><input id="m-in" autocomplete="off" placeholder="Type an action item and hit Enter…  “fri”, “^Sarah”, “c: send logins”"><span class="hint"><kbd>Tab</kbd> switch owner · <kbd>Enter</kbd> add</span></div><div class="qa-chips" id="m-chips"></div></div></div>
      </div>
      <div class="m-side">${agendaPanel(M, c)}<div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Notes</div><textarea id="m-notes" placeholder="Free-form notes, decisions, context…">${esc(M.notes)}</textarea><div class="muted" style="font-size:12px">Notes are saved with the meeting in the client’s log.</div></div></div>`;
    const inp = $('#m-in'); inp.focus();
    inp.addEventListener('keydown', e => {
      if(e.key === 'Tab'){ e.preventDefault(); M.nextOwner = M.nextOwner === 'me' ? 'client' : 'me'; save(); const p = $('[data-act=m-owner]'); p.className = 'owner-pill ' + M.nextOwner; p.textContent = M.nextOwner==='me' ? 'Me' : (c ? c.name : 'Client'); }
      if(e.key === 'Enter' && inp.value.trim()){ addMeetingItem(inp.value); renderMeeting(); }
      if(e.key === 'Escape') inp.blur();
    });
    inp.addEventListener('input', () => { const r = parseQuick(inp.value.replace(/^(me|i|c|client|they|them)\s*[:>]\s*/i,''), { clientId: M.clientId }); delete r.clientId; $('#m-chips').innerHTML = inp.value.trim() ? parseChips({...r, owner:'me'}) : ''; });
    $('#m-notes').addEventListener('input', e => { M.notes = e.target.value; clearTimeout(notesTimer); notesTimer = setTimeout(save, 500); });
    wireShots(el, M); wireAgenda(el, M, c);
  } else {
    const inc = M.items.filter(i => i.include).length;
    el.innerHTML = `<div class="m-head"><b style="font-size:15px">Review action items</b>${clientSel}<span class="muted">${elapsed(M.start)} meeting</span><span style="margin-left:auto"></span><button class="btn" data-act="m-tidy" title="Clean up bullets, prefixes, names, dates and duplicates">Tidy up</button>${core.AI ? '<button class="btn" data-act="m-ai" title="Rewrite titles as clear tasks">Fix wording with AI</button>' : ''}<button class="btn ghost" data-act="m-back">← Back to meeting</button><button class="btn ghost danger" data-act="m-discard">Discard</button></div>
      <div style="flex:1;overflow:auto"><div class="wrap" style="padding-top:28px">
        <p class="muted" style="margin-top:0">Tidy up titles and due dates, then create the tasks. Client items go to <b>Waiting on clients</b> so you can chase them.</p>
        ${['me','client'].map(o => { const list = M.items.filter(i => i.owner === o); return `<div class="group"><div class="group-h ${o==='client'?'client':''}">${o==='me'?'On me':'On '+esc(c?c.name:'client')}<span class="c">${list.length}</span></div>${list.map(i => `<div class="rv-item" data-iid="${i.id}"><input type="checkbox" data-rv="include" ${i.include?'checked':''}><input type="text" data-rv="title" value="${esc(i.title)}">${i.assignee ? `<span class="chip client-owned">${esc(i.assignee)}</span>` : ''}<button class="te-chip rv-due ${i.dueDate ? 'on ' + dueState(i) : ''}" data-act="rv-due">${TE_ICONS.due || ''}<span>${i.dueDate ? esc(dueLabel(i)) : 'Date'}</span></button><button class="sw btn ghost" data-act="m-swap" title="Switch owner">⇄</button></div>`).join('') || '<div class="muted" style="padding:8px 0">None</div>'}</div>`; }).join('')}
        <div class="row" style="gap:6px;margin:-8px 0 20px"><span class="muted" style="font-size:12px;align-self:center">Set due for all client items:</span>${[['+2d',2],['+1w',7]].map(([l,n]) => `<button class="btn" data-act="m-bulkdue" data-n="${n}">${l}</button>`).join('')}</div>
      </div></div>
      <div class="m-input" style="display:flex;gap:8px;justify-content:flex-end;align-items:center;flex-wrap:wrap">${Reg.meetingActions.map((a,i) => `<button class="btn" data-act="m-action" data-i="${i}">${esc(a.label)}</button>`).join('')}<button class="btn primary" data-act="m-commit" ${inc?'':'disabled'}>Create ${inc} task${inc===1?'':'s'} &amp; finish</button></div>`;
    $$('[data-rv]', el).forEach(inp => inp.addEventListener('change', () => { const it = M.items.find(x => x.id === inp.closest('.rv-item').dataset.iid); const k = inp.dataset.rv; it[k] = inp.type === 'checkbox' ? inp.checked : (inp.value || null); save(); if(k==='include') renderMeeting(); }));
  }
  // the meeting becomes the client's screen: their logo, colours, a line about them, where things stand, talking points
  const band = meetingBand(c), head = el.querySelector('.m-head'); if(band && head) head.insertAdjacentHTML('afterend', band);
  el.classList.toggle('branded', !!band);
  $('#m-client').addEventListener('change', e => { M.clientId = e.target.value || null; save(); renderMeeting(); });
  $$('.m-item .tt', el).forEach(t => t.addEventListener('blur', () => { const it = M.items.find(x => x.id === t.closest('.m-item').dataset.iid); if(it){ it.title = t.textContent.trim() || it.title; save(); } }));
}
/* tidy meeting action items without AI: bullets, checkboxes, "Action:" prefixes and timestamps go; "Sarah will send
   the SOW by Friday" becomes "Send the SOW" owned by Sarah, due Friday; "I'll…" is mine; duplicates go; capitalised. */
function tidyText(raw){
  let t = String(raw || '').replace(/\s+/g, ' ').trim(), owner = null, assignee = null;
  t = t.replace(/^\s*(?:[-*•–—·>]+|\d+[.)]|\[[ xX]?\]|\(\s?\)|[☐☑✓✔])\s*/, '').replace(/^\s*(?:[-*•–—·>]+|\[[ xX]?\])\s*/, '');
  t = t.replace(/^(?:action items?|action|todo|to-do|ai|next steps?|follow[- ]up)\s*[:\-–]\s*/i, '');
  t = t.replace(/\s*[\[(]\s*\d{1,2}:\d{2}(?::\d{2})?\s*[\])]\s*$/, '').replace(/\s*[-–]\s*\d{1,2}:\d{2}\s*$/, '');
  const me = norm((core.S.settings.myName || '').split(' ')[0] || '');
  let m;
  if((m = t.match(/^(?:i|we)(?:'ll|’ll| will| need to| should| have to| must| can| are going to| am going to)\s+(.+)$/i))){ owner = 'me'; t = m[1]; }
  else if((m = t.match(/^(?:they|the client|client)(?:'ll|’ll| will| need to| should| have to| must| to)\s+(.+)$/i))){ owner = 'client'; t = m[1]; }
  else if((m = t.match(/^([A-Z][a-zA-Z'’-]+(?:\s[A-Z][a-zA-Z'’-]+)?)\s*(?::|will|to|should|needs to|has to|is going to|'ll|’ll)\s+(.+)$/)) && !/^(please|follow|send|set|get|make|call|email|check|review|update|add|create|book|schedule|share|confirm|ask|fix|build|test|draft|finish|start|look|reply|prepare|zoho)$/i.test(m[1])){
    const who = m[1].trim(); t = m[2];
    if(me && norm(who.split(' ')[0]) === me) owner = 'me'; else { owner = 'client'; assignee = who; }
  }
  t = t.replace(/^(?:please|pls|need to|needs to|to)\s+/i, '').replace(/[\s.;,]+$/, '');
  return { title: capFirst(t), owner, assignee };
}
function tidyMeeting(M){
  const seen = new Set(); let changed = 0, dupes = 0;
  M.items = M.items.filter(it => {
    const before = JSON.stringify([it.title, it.owner, it.assignee, it.dueDate]);
    const r = tidyText(it.title);
    let title = r.title;
    if(!it.dueDate){ const q = parseQuick(title, { clientId: M.clientId }); if(q.dueDate && q.title){ it.dueDate = q.dueDate; it.dueTime = it.dueTime || q.dueTime; title = q.title; } }
    it.title = capFirst(title.replace(/[\s.;,]+$/, '')) || it.title;
    if(r.owner) it.owner = r.owner; if(r.assignee) it.assignee = r.assignee;
    const key = norm(it.title).replace(/[^a-z0-9]+/g, ' ').trim();
    if(seen.has(key + '|' + it.owner)){ dupes++; return false; } seen.add(key + '|' + it.owner);
    if(JSON.stringify([it.title, it.owner, it.assignee, it.dueDate]) !== before) changed++;
    return true;
  });
  M.tidied = true; save();
  return { changed, dupes };
}
async function aiWording(M){
  if(!core.AI || !core.AI.json) return toast('AI isn’t set up on your NAS');
  const items = M.items.filter(i => i.include);
  const j = job('aiword', 'Claude is polishing the wording', { sub: `${items.length} action items` });
  try {
    const out = await core.AI.json(`Rewrite these meeting action items as short, clear task titles: start with a verb, keep names, numbers and product names (e.g. Zoho CRM), no trailing punctuation, no dates (they are stored separately). Return a JSON array of {"id","title"} in the same order.\n\n${JSON.stringify(items.map(i => ({ id: i.id, title: i.title })))}`, { modelTier: 'fast' });
    let n = 0; for(const o of (Array.isArray(out) ? out : [])){ const it = M.items.find(x => x.id === o.id); if(it && o.title && o.title !== it.title){ it.title = capFirst(String(o.title).slice(0, 200)); n++; } }
    save(); renderMeeting(); j.done({ title: n ? `Reworded ${n} item${n === 1 ? '' : 's'}` : 'Already clear', sub: 'Undo isn’t needed: edit any title inline' });
  } catch(e){ j.dismiss(); toast('AI wording failed: ' + e.message); }
}
/* ---- agenda: a running list per client, raised when the next meeting starts ---- */
function clientAgendaCard(c){
  const ag = c.agenda || [];
  return `<div class="group ag-card"><div class="group-h">Agenda for the next meeting<span class="c">${ag.length}</span></div>
    ${ag.map(a => `<div class="ag-row"><span class="ag-b">•</span><span class="grow">${esc(a.text)}</span><span class="muted" style="font-size:12px">${esc(fmtDate(ymd(new Date(a.at))))}</span><button class="lk-x" data-agdel="${esc(a.id)}" data-cid="${esc(c.id)}" title="Remove">×</button></div>`).join('')}
    <input class="inp ag-in" data-agadd="${esc(c.id)}" placeholder="Add something to talk about next time…"></div>`;
}
function addAgenda(cid, text){ const c = client(cid); if(!c || !String(text || '').trim()) return; c.agenda = [...(c.agenda || []), { id: uid('ag'), text: capFirst(String(text).trim().slice(0, 200)), at: Date.now() }]; save(); }
function agendaPanel(M, c){
  if(!c) return '';
  const ag = c.agenda || [], done = M.agendaDone || {};
  return `<div class="m-ag"><div class="m-ag-h">Agenda <span class="muted">${ag.filter(a => done[a.id]).length}/${ag.length} covered</span></div>
    ${ag.map(a => { const n = M.items.filter(i => i.agendaId === a.id).length; return `<div class="m-ag-it ${done[a.id] ? 'done' : ''}" data-agid="${esc(a.id)}"><input type="checkbox" ${done[a.id] ? 'checked' : ''} title="Talked about it"><span class="grow">${esc(a.text)}</span>${n ? `<em>${n} task${n === 1 ? '' : 's'}</em>` : ''}<button class="m-ag-f" title="Add a follow-up task for this">+ task</button></div>`; }).join('') || '<div class="muted" style="font-size:13px">Nothing on the agenda yet.</div>'}
    <input class="inp m-ag-in" placeholder="Add to the agenda…"></div>`;
}
function wireAgenda(el, M, c){
  if(!c) return;
  $$('.m-ag-it', el).forEach(r => {
    const id = r.dataset.agid, a = (c.agenda || []).find(x => x.id === id);
    r.querySelector('input').addEventListener('change', e => { M.agendaDone = { ...(M.agendaDone || {}), [id]: e.target.checked }; save(); renderMeeting(); });
    r.querySelector('.m-ag-f').addEventListener('click', () => { if(!a) return; M.items.push({ id: uid('i'), title: 'Follow up: ' + a.text, owner: 'me', agendaId: id, include: true }); M.agendaDone = { ...(M.agendaDone || {}), [id]: true }; save(); renderMeeting();
      const t = $$('.m-item .tt', $('#meeting')).pop(); if(t){ t.focus(); const rg = document.createRange(); rg.selectNodeContents(t); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(rg); } });
  });
  const inp = $('.m-ag-in', el); if(inp) inp.addEventListener('keydown', e => { if(e.key === 'Enter' && inp.value.trim()){ addAgenda(c.id, inp.value); renderMeeting(); setTimeout(() => { const i = $('.m-ag-in'); i && i.focus(); }, 20); } });
}
/* ---- screenshots: paste (Ctrl+V), drop or pick; caption them; mark them up with arrows, boxes, text, a pen ---- */
function shotTile(sh, readonly, mid){
  return `<div class="m-shot" data-sid="${esc(sh.id)}"${mid ? ` data-mid="${esc(mid)}"` : ''}><div class="m-shot-im">${shotSvg(sh)}</div>${readonly ? (sh.caption ? `<div class="m-shot-cap">${esc(sh.caption)}</div>` : '') : `<input class="m-shot-cap" value="${esc(sh.caption || '')}" placeholder="What’s this?"><div class="m-shot-act"><button data-shot="mark" title="Mark up">✎ Mark up</button><button data-shot="del" title="Remove">×</button></div>`}</div>`;
}
function marksSvg(sh, sel){
  const sw = Math.max(3, Math.round(Math.max(sh.w, sh.h) / 300)), fs = Math.max(18, Math.round(Math.max(sh.w, sh.h) / 45));
  return (sh.marks || []).map((m, i) => { const st = `stroke="${m.c}" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
    if(m.t === 'box') return `<rect x="${Math.min(m.x1, m.x2)}" y="${Math.min(m.y1, m.y2)}" width="${Math.abs(m.x2 - m.x1)}" height="${Math.abs(m.y2 - m.y1)}" rx="${sw * 2}" ${st}/>`;
    if(m.t === 'hl') return `<rect x="${Math.min(m.x1, m.x2)}" y="${Math.min(m.y1, m.y2)}" width="${Math.abs(m.x2 - m.x1)}" height="${Math.abs(m.y2 - m.y1)}" fill="${m.c}" opacity=".3"/>`;
    if(m.t === 'arrow'){ const a = Math.atan2(m.y2 - m.y1, m.x2 - m.x1), L = sw * 5; return `<path d="M${m.x1} ${m.y1}L${m.x2} ${m.y2}M${m.x2 - L * Math.cos(a - .5)} ${m.y2 - L * Math.sin(a - .5)}L${m.x2} ${m.y2}L${m.x2 - L * Math.cos(a + .5)} ${m.y2 - L * Math.sin(a + .5)}" ${st}/>`; }
    if(m.t === 'pen') return `<path d="M${m.pts.map(p => p.join(' ')).join('L')}" ${st}/>`;
    if(m.t === 'text') return `<text x="${m.x1}" y="${m.y1}" fill="${m.c}" font-size="${fs}" font-weight="700" font-family="Inter,system-ui,sans-serif" paint-order="stroke" stroke="#fff" stroke-width="${Math.round(fs / 5)}">${esc(m.text)}</text>`;
    return ''; }).join('');
}
const shotSvg = sh => `<img src="${esc(sh.url)}" alt=""><svg viewBox="0 0 ${sh.w} ${sh.h}" preserveAspectRatio="none">${marksSvg(sh)}</svg>`;
function shotsStrip(M){
  const sh = M.shots || [];
  return `<div class="m-shots">${sh.map(x => shotTile(x)).join('')}<label class="m-shot-add" title="Paste a screenshot (Ctrl+V / ⌘V), drop one here, or pick a file"><input type="file" accept="image/*" multiple hidden><b>+</b><span>${sh.length ? 'Add' : 'Paste a screenshot (⌘V), drop one, or click'}</span></label></div>`;
}
async function addShot(file){
  const M = core.S.activeMeeting; if(!M || !file || !/^image\//.test(file.type)) return;
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  let url, w = img.naturalWidth, h = img.naturalHeight;
  try {
    if(!Store.server) throw 0;
    const r = await fetch('api/shots', { method: 'POST', headers: { 'Content-Type': file.type }, body: file }); if(!r.ok) throw 0; url = (await r.json()).url;
  } catch(e){ const k = Math.min(1, 1400 / Math.max(w, h)), cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); url = cv.toDataURL('image/jpeg', .82); w = cv.width; h = cv.height; }
  URL.revokeObjectURL(img.src);
  M.shots = [...(M.shots || []), { id: uid('s'), url, w, h, caption: '', marks: [], at: Date.now() }]; save(); renderMeeting();
  setTimeout(() => { const c = $$('#meeting .m-shot-cap'); c.length && c[c.length - 1].focus(); }, 50);
}
function wireShots(el, M){
  const add = $('.m-shot-add input', el); if(add) add.addEventListener('change', () => [...add.files].forEach(addShot));
  $$('.m-shot', el).forEach(t => { const sh = (M.shots || []).find(x => x.id === t.dataset.sid); if(!sh) return;
    const cap = $('.m-shot-cap', t); cap.addEventListener('input', () => { sh.caption = cap.value; clearTimeout(notesTimer); notesTimer = setTimeout(save, 400); });
    t.querySelector('[data-shot=mark]').onclick = () => markup(sh, () => { save(); renderMeeting(); });
    t.querySelector('.m-shot-im').onclick = () => markup(sh, () => { save(); renderMeeting(); });
    t.querySelector('[data-shot=del]').onclick = () => { M.shots = M.shots.filter(x => x !== sh); save(); renderMeeting(); }; });
  const box = $('.m-body', el); if(box){ box.addEventListener('dragover', e => { if([...(e.dataTransfer.items || [])].some(i => i.type.startsWith('image/'))){ e.preventDefault(); box.classList.add('drop'); } }); box.addEventListener('dragleave', () => box.classList.remove('drop')); box.addEventListener('drop', e => { const f = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/')); if(!f.length) return; e.preventDefault(); box.classList.remove('drop'); f.forEach(addShot); }); }
}
// client page: agenda add/remove; meeting log: open a screenshot
document.addEventListener('keydown', e => { const i = e.target.closest && e.target.closest('[data-agadd]'); if(!i || e.key !== 'Enter' || !i.value.trim()) return; addAgenda(i.dataset.agadd, i.value); render(); setTimeout(() => { const n = $(`[data-agadd="${i.dataset.agadd}"]`); n && n.focus(); }, 30); });
document.addEventListener('click', e => {
  const d = e.target.closest('[data-agdel]'); if(d){ const c = client(d.dataset.cid); if(c){ c.agenda = (c.agenda || []).filter(a => a.id !== d.dataset.agdel); save(); render(); } return; }
  const t = e.target.closest('.m-shot[data-mid]'); if(t){ const m = core.S.meetings.find(x => x.id === t.dataset.mid), sh = m && (m.shots || []).find(x => x.id === t.dataset.sid); if(sh) markup(sh, () => { save(); render(); }); }
});
document.addEventListener('paste', e => {
  const M = core.S.activeMeeting; if(!M || M.phase !== 'live' || !$('#meeting').classList.contains('open')) return;
  const files = [...(e.clipboardData && e.clipboardData.items || [])].filter(i => i.kind === 'file' && i.type.startsWith('image/')).map(i => i.getAsFile()).filter(Boolean);
  if(!files.length) return; e.preventDefault(); files.forEach(addShot);
});
/* the markup editor: arrows, boxes, highlight, text, pen; undo; colours */
function markup(sh, onDone, readonly){
  const ov = document.createElement('div'); ov.className = 'mk-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Mark up screenshot');
  let tool = 'arrow', color = '#e5484d', cur = null; const COLS = ['#e5484d', '#f59e0b', '#22c55e', '#3b82f6', '#111111', '#ffffff'];
  const draw = () => { ov.querySelector('.mk-svg').innerHTML = marksSvg(cur ? { ...sh, marks: [...sh.marks, cur] } : sh); };
  ov.innerHTML = `<div class="mk-bar">${readonly ? '' : `<span role="toolbar" aria-label="Markup tools" style="display:contents">${[['arrow', '↗ Arrow', 'A'], ['box', '▢ Box', 'B'], ['hl', '▬ Highlight', 'H'], ['text', 'T Text', 'T'], ['pen', '✎ Pen', 'P']].map(([k, l, key]) => `<button data-tool="${k}" class="${k === tool ? 'on' : ''}" aria-pressed="${k === tool}" title="${l.slice(2)} (${key})" aria-keyshortcuts="${key}">${l}</button>`).join('')}</span><span class="mk-sep"></span>${COLS.map((c, i) => `<button class="mk-c ${c === color ? 'on' : ''}" data-col="${c}" style="background:${c}" aria-pressed="${c === color}" aria-label="${['Red', 'Orange', 'Green', 'Blue', 'Black', 'White'][i]}" title="${['Red', 'Orange', 'Green', 'Blue', 'Black', 'White'][i]}"></button>`).join('')}<span class="mk-sep"></span><button data-mk="undo">Undo</button><button data-mk="clear">Clear</button>`}<input class="mk-cap" value="${esc(sh.caption || '')}" placeholder="Description" ${readonly ? 'readonly' : ''}><button data-mk="done" class="pri">${readonly ? 'Close' : 'Done'}</button></div>
    <div class="mk-stage"><div class="mk-wrap"><img src="${esc(sh.url)}" alt=""><svg class="mk-svg" viewBox="0 0 ${sh.w} ${sh.h}" preserveAspectRatio="none"></svg></div></div>`;
  document.body.appendChild(ov); draw();
  const svg = ov.querySelector('.mk-svg'), pt = e => { const r = svg.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * sh.w), Math.round((e.clientY - r.top) / r.height * sh.h)]; };
  const close = () => { sh.caption = ov.querySelector('.mk-cap').value.trim(); ov.remove(); removeEventListener('keydown', key, true); onDone && onDone(); };
  const key = e => { if(e.key === 'Escape' && !ov.querySelector('.mk-txt')){ e.stopPropagation(); close(); }
    if(!readonly && !e.metaKey && !e.ctrlKey && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)){ const t = { a: 'arrow', b: 'box', h: 'hl', t: 'text', p: 'pen' }[e.key.toLowerCase()]; if(t){ e.preventDefault(); const b = ov.querySelector(`[data-tool=${t}]`); b && b.click(); } } if((e.metaKey || e.ctrlKey) && e.key === 'z' && !readonly){ e.preventDefault(); sh.marks.pop(); draw(); } };
  addEventListener('keydown', key, true);
  ov.addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return;
    if(b.dataset.tool){ tool = b.dataset.tool; $$('[data-tool]', ov).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); }
    if(b.dataset.col){ color = b.dataset.col; $$('[data-col]', ov).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); }
    if(b.dataset.mk === 'undo'){ sh.marks.pop(); draw(); } if(b.dataset.mk === 'clear'){ sh.marks = []; draw(); } if(b.dataset.mk === 'done') close(); });
  if(readonly) return;
  svg.addEventListener('pointerdown', e => { e.preventDefault(); const [x, y] = pt(e);
    if(tool === 'text'){ const r = svg.getBoundingClientRect(), inp = document.createElement('input'); inp.className = 'mk-txt'; inp.style.left = e.clientX + 'px'; inp.style.top = (e.clientY - 14) + 'px'; inp.style.color = color; ov.appendChild(inp); inp.focus(); requestAnimationFrame(() => inp.focus());
      let fd = false; const fin = () => { if(fd) return; fd = true; if(inp.value.trim()) sh.marks.push({ t: 'text', c: color, x1: x, y1: y + Math.round(Math.max(18, Math.max(sh.w, sh.h) / 45) * .35), text: inp.value.trim().slice(0, 120) }); inp.remove(); draw(); };
      inp.addEventListener('keydown', k => { k.stopPropagation(); if(k.key === 'Enter') fin(); if(k.key === 'Escape'){ fd = true; inp.remove(); } }); inp.addEventListener('blur', () => setTimeout(fin, 0)); return; }
    svg.setPointerCapture(e.pointerId); cur = tool === 'pen' ? { t: 'pen', c: color, pts: [[x, y]] } : { t: tool, c: color, x1: x, y1: y, x2: x, y2: y }; draw(); });
  svg.addEventListener('pointermove', e => { if(!cur) return; const [x, y] = pt(e); if(cur.t === 'pen') cur.pts.push([x, y]); else { cur.x2 = x; cur.y2 = y; } draw(); });
  svg.addEventListener('pointerup', () => { if(!cur) return; const ok = cur.t === 'pen' ? cur.pts.length > 2 : Math.hypot(cur.x2 - cur.x1, cur.y2 - cur.y1) > 6; if(ok) sh.marks.push(cur); cur = null; draw(); });
}
function meetingBand(c){
  if(!c) return '';
  const pal = [...((c.brand && c.brand.palette) || []), c.brand && c.brand.primary, c.themeColor, c.color].filter(x => /^#[0-9a-f]{3,8}$/i.test(x || ''));
  const [a1, a2, a3] = [pal[0] || c.color, pal[1] || pal[0] || c.color, pal[2] || pal[1] || pal[0] || c.color];
  const o = open(), mine = o.filter(t => t.clientId === c.id && onMe(t)).length, theirs = o.filter(t => t.clientId === c.id && t.owner === 'client').length;
  const last = core.S.meetings.filter(m => m.clientId === c.id).sort((x, y) => y.start - x.start)[0], ind = INDUSTRY[c.industry];
  const talk = (c.research && c.research.talking) || [];
  return `<div class="m-band" style="--m1:${esc(a1)};--m2:${esc(a2)};--m3:${esc(a3)}">${c.hasBanner && c.domain && Store.server ? `<div class="m-ban" style="background-image:url('api/banner?d=${encodeURIComponent(c.domain)}&v=${c.logoV || ''}')"></div>` : ''}
    <div class="m-band-in">${avatar(c, 58)}<div class="m-who"><h2>${esc(c.name)}</h2><div class="m-sub">${ind ? `<span>${ind.icon} ${esc(ind.label)}</span>` : ''}${c.domain ? `<span>${esc(c.domain)}</span>` : ''}</div>${c.description ? `<p>${esc(decodeEntities(c.description).slice(0, 200))}</p>` : ''}</div>
      <div class="m-facts"><span><b>${mine}</b>on you</span><span><b>${theirs}</b>they owe</span><span><b>${last ? esc(fmtDate(ymd(new Date(last.start)))) : 'First'}</b>${last ? 'last met' : 'meeting'}</span></div></div>
    ${talk.length ? `<div class="m-talk"><em>Worth mentioning</em>${talk.slice(0, 3).map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}</div>`;
}
function commitMeeting(){
  const M = core.S.activeMeeting; if(!M) return;
  const items = M.items.filter(i => i.include && i.title);
  const ids = items.map(i => addTask({ title: i.title, clientId: M.clientId, owner: i.owner, assignee: i.assignee || '', dueDate: i.dueDate, dueTime: i.dueTime, priority: i.priority || 0, tags: i.tags || [], repeat: i.repeat || null, meetingId: M.id }).id);
  const rec = { id: M.id, clientId: M.clientId, start: M.start, end: Date.now(), notes: M.notes, itemIds: ids, shots: M.shots || [], agenda: [] };
  const cl = client(M.clientId);
  if(cl && (cl.agenda || []).length){ const done = M.agendaDone || {};
    rec.agenda = cl.agenda.map(a => ({ text: a.text, done: !!done[a.id], tasks: items.map((it, k) => it.agendaId === a.id ? ids[k] : null).filter(Boolean) }));
    cl.agenda = cl.agenda.filter(a => !done[a.id]); }
  core.S.meetings.push(rec); core.S.activeMeeting = null; save();
  emit('meeting:end', { meeting: clone(rec), items: clone(items) });
  hideMeeting(); if(M.clientId) go('client-' + M.clientId);
  toast(`Meeting saved · ${ids.length} task${ids.length===1?'':'s'} created`);
}
function openImport(){
  const ex = Reg.extractors.filter(e => !e.available || e.available());
  openModalHTML('Import meeting notes', `<p class="muted" style="margin:0">Paste a Fireflies summary, transcript, or any notes. Action items are split into <b>yours</b> and the <b>client’s</b>${core.S.settings.myName ? ` (matching “${esc(core.S.settings.myName)}” as you)` : ' — set your name in Settings so Cadence can tell them apart'}.</p>
    <textarea class="inp" id="imp-text" style="min-height:240px" placeholder="Action Items&#10;&#10;**Alex Chen**&#10;Send revised Zoho CRM blueprint by Friday (12:41)&#10;&#10;**Sarah Lee**&#10;Share API credentials for Books integration (18:02)"></textarea>
    <div class="row"><select class="inp" id="imp-ex" style="width:auto">${ex.map(e => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('')}</select><label class="row muted" style="align-items:center;gap:6px;font-size:13px"><input type="checkbox" id="imp-notes" checked> Also add to meeting notes</label></div>`,
    `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="imp-run">Extract action items</button>`);
  setTimeout(() => $('#imp-text')?.focus(), 30);
}
async function runImport(){
  const text = $('#imp-text').value.trim(); if(!text) return;
  const ex = Reg.extractors.find(e => e.id === $('#imp-ex').value); if(!ex) return;
  const btn = $('[data-act=imp-run]'); btn.disabled = true; btn.textContent = 'Extracting…';
  const M = core.S.activeMeeting, c = client(M.clientId);
  const j = job('extract', ex.id === 'ai' ? 'Claude is reading your notes' : 'Extracting action items', { sub: `${text.split(/\s+/).length.toLocaleString()} words${c ? ' · ' + c.name : ''}` });
  try {
    const items = await ex.run(text, { myName: core.S.settings.myName, clientName: c ? c.name : '', today: todayKey() }, makeApi(ex.pid));
    let n = 0;
    for(const it of (items || [])){
      if(!it || !it.title) continue;
      M.items.push({ id: uid('i'), title: capFirst(it.title), owner: it.owner === 'client' ? 'client' : 'me', assignee: it.assignee || '', dueDate: /^\d{4}-\d\d-\d\d$/.test(it.dueDate||'') ? it.dueDate : null, dueTime: /^\d\d:\d\d$/.test(it.dueTime||'') ? it.dueTime : null, priority: 0, tags: [], include: true }); n++;
    }
    if($('#imp-notes').checked) M.notes = (M.notes ? M.notes + '\n\n' : '') + text;
    save(); closeModal(); renderMeeting();
    const mine = M.items.slice(-n).filter(i => i.owner === 'me').length;
    j.done(n ? { title: `Pulled ${n} action item${n===1?'':'s'}`, sub: `${mine} for you · ${n - mine} for ${c ? c.name : 'the client'} — review each side` } : { title: 'No action items found', sub: 'Try the AI extractor or a plain list', icon: '?', color: '#6b6878' });
  } catch(e){
    btn.disabled = false; btn.textContent = 'Extract action items'; j.dismiss();
    toast(e && e.code === 'rate_limited' ? 'AI is busy — try again in a minute, or use the Fireflies parser.' : 'Extraction failed: ' + (e.message || e.code || e));
  }
}
return { startMeeting, hideMeeting, renderMeeting, tidyMeeting, clientAgendaCard, shotTile, markup, commitMeeting, openImport, runImport, meetingBand };
};
