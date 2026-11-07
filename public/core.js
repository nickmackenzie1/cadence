/* Cadence core — state, storage, parsing, rendering, plugin host.
   Plugins live in plugins/*.js and use window.Cadence.registerPlugin (see docs/PLUGINS.md). */
/* =========================================================
   Cadence — a modular to-do app for consultants
   Core: state, storage, parsing, rendering, plugin host
   ========================================================= */
(function(){
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = (p = '') => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const clone = o => JSON.parse(JSON.stringify(o));
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const COLORS = ['#5b5bd6','#2f9e6b','#d4533b','#c2771c','#0e8fb5','#b0459a','#7a8a2a','#7a5af8','#e0607e','#3f7d8c','#a0522d','#4a6cf7'];

/* ---------- dates ---------- */
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fromYmd = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const todayKey = () => ymd(new Date());
const DOWS = ['sun','mon','tue','wed','thu','fri','sat'];
const MONS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
function fmtTime(t){ if(!t) return ''; let [h,m] = t.split(':').map(Number); const ap = h>=12?'PM':'AM'; h = h%12||12; return m ? `${h}:${pad(m)} ${ap}` : `${h} ${ap}`; }
function fmtDate(key){
  if(!key) return '';
  const t = todayKey(), d = fromYmd(key), diff = Math.round((d - fromYmd(t))/864e5);
  if(diff === 0) return 'Today'; if(diff === 1) return 'Tomorrow'; if(diff === -1) return 'Yesterday';
  if(diff > 1 && diff < 7) return d.toLocaleDateString(undefined,{weekday:'long'});
  return d.toLocaleDateString(undefined,{month:'short',day:'numeric', year: d.getFullYear()!==new Date().getFullYear()?'numeric':undefined});
}
function dueState(task){
  if(!task.dueDate || task.done) return '';
  const t = todayKey();
  if(task.dueDate < t) return 'over';
  if(task.dueDate === t){ if(task.dueTime){ const [h,m]=task.dueTime.split(':').map(Number); const n=new Date(); if(n.getHours()*60+n.getMinutes() > h*60+m) return 'over'; } return 'today'; }
  return '';
}
const dueLabel = t => t.dueDate ? fmtDate(t.dueDate) + (t.dueTime ? ' · ' + fmtTime(t.dueTime) : '') : '';
const dueMs = t => { if(!t.dueDate) return null; const d = fromYmd(t.dueDate); if(t.dueTime){ const [h,m]=t.dueTime.split(':').map(Number); d.setHours(h,m,0,0);} else d.setHours(9,0,0,0); return d.getTime(); };

/* ---------- state ---------- */
/* demo mode: ?demo opens this tab on fake data — separate storage, never synced (?demo=0 to leave) */
const DEMO = (() => { try { const q = new URLSearchParams(location.search); if(q.has('demo')){ if(q.get('demo') === '0') sessionStorage.removeItem('cadence.demo'); else sessionStorage.setItem('cadence.demo', '1'); history.replaceState(null, '', location.pathname + location.hash); } return sessionStorage.getItem('cadence.demo') === '1'; } catch(e){ return false; } })();
if(DEMO) document.documentElement.classList.add('demo');
const LS_KEY = DEMO ? 'cadence.demo.v1' : 'cadence.v1';
const blank = () => ({ v:1, clients:[], tasks:[], meetings:[], settings:{ myName:'', theme:'light', remindLead:10 }, disabled:[], userPlugins:[], pluginData:{}, activeMeeting:null, updatedAt:0 });
let S = (() => { try { const raw = localStorage.getItem(LS_KEY); if(raw) return Object.assign(blank(), JSON.parse(raw)); } catch(e){} if(DEMO && window.CadenceDemo){ const d = Object.assign(blank(), window.CadenceDemo.build()); try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch(e){} return d; } return blank(); })();
const reducedMotion = () => S.settings.motion === 'reduce' || (S.settings.motion !== 'full' && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
function resetDemo(){ try { localStorage.removeItem('cadence.demo.v1'); } catch(e){} location.reload(); }
function exitDemo(){ try { sessionStorage.removeItem('cadence.demo'); } catch(e){} location.href = location.pathname; }

/* storage: localStorage instantly, account sync (artifact db) when available */
const Store = {
  ref:null, busy:false, again:false, status:'local', timer:null,
  async init(){
    if(!window.claude || !window.claude.use){ return this.initServer(); }
    if(DEMO) return;
    try{
      const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
      if(!db || !user) return;
      const id = await user.id(); if(!id) return;
      this.ref = db.collection('data/users/' + id).doc('app');
      let first = true;
      const t = setTimeout(()=>{ if(first){ this.setStatus('local'); } }, 10000);
      this.ref.onSnapshot(snap => {
        if(snap.metadata && snap.metadata.hasPendingWrites) return;
        clearTimeout(t);
        const d = snap.exists ? snap.data() : null;
        if(d && d.json && ((d.updatedAt||0) > (S.updatedAt||0) || (first && !S.tasks.length && !S.clients.length && !S.meetings.length))){
          try { S = Object.assign(blank(), JSON.parse(d.json)); persistLocal(); rebuildPlugins(); render(); } catch(e){ console.error(e); }
        } else if(first && (!d || (d.updatedAt||0) < (S.updatedAt||0)) && S.updatedAt){ this.push(); }
        first = false; this.setStatus('synced');
      }, err => { clearTimeout(t); console.warn('db', err); this.setStatus('local'); });
    }catch(e){ console.warn(e); }
  },
  /* self-hosted mode (Synology / Docker): server.js exposes api/state + api/ai */
  server:false,
  async initServer(){
    if(location.protocol === 'file:') return;
    try {
      const h = await fetch('api/health', { cache:'no-store' }); if(!h.ok) return;
      const info = await h.json(); if(!info.ok) return;
      this.server = true; this.health = info; render(); emit('sync', { phase:'connected', health: info });
      if(DEMO){ this.status = 'demo'; this.setStatus('demo'); }
      if(info.ai){
        const f = async (prompt, opts = {}) => { const r = await fetch('api/ai', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ prompt, tier: opts.modelTier || 'default' }) }); const j = await r.json(); if(!r.ok) throw Object.assign(new Error(j.error || 'AI error'), { code: r.status === 429 ? 'rate_limited' : 'error' }); return { text: j.text || '' }; };
        f.json = async (prompt, opts) => { const r = await f(prompt + '\n\nRespond with JSON only.', opts); const m = r.text.match(/[\[{][\s\S]*[\]}]/); return m ? JSON.parse(m[0]) : null; };
        AI = f; rebuildPlugins();
      }
      if(DEMO) return; // demo data never touches the NAS copy
      await this.pull(true);
      setInterval(() => this.pull(false), 20000);
      document.addEventListener('visibilitychange', () => { if(!document.hidden) this.pull(false); });
    } catch(e){ console.warn('No Cadence server found, using browser storage', e); }
  },
  async pull(first){
    const t0 = performance.now(); emit('sync', { phase:'pull' });
    try {
      const r = await fetch('api/state', { cache:'no-store' }); if(!r.ok) throw new Error(r.status);
      this.latency = Math.round(performance.now() - t0); this.lastSyncAt = Date.now();
      const d = await r.json();
      const localEmpty = !S.tasks.length && !S.clients.length && !S.meetings.length;
      if(d && d.json && ((d.updatedAt||0) > (S.updatedAt||0) || (first && localEmpty))){ S = Object.assign(blank(), JSON.parse(d.json)); persistLocal(); rebuildPlugins(); render(); }
      else if(first && (d.updatedAt||0) < (S.updatedAt||0)) this.push();
      this.setStatus('synced'); emit('sync', { phase:'pulled', ms: this.latency, first });
    } catch(e){ this.setStatus('local'); emit('sync', { phase:'error', error: String(e.message || e) }); }
  },
  setStatus(s){ this.status = s; const el = $('#sync'); if(el){ el.className = 'sync' + (s==='synced'?' ok':''); el.lastChild.textContent = DEMO ? 'Demo data — not saved' : s==='synced' ? (this.server ? 'Synced to NAS' : 'Synced') : 'This browser'; } },
  schedule(){ if(DEMO || (!this.ref && !this.server)) return; clearTimeout(this.timer); this.timer = setTimeout(()=>this.push(), 700); },
  async push(){
    if(DEMO || (!this.ref && !this.server)) return;
    if(this.busy){ this.again = true; return; }
    this.busy = true;
    emit('sync', { phase:'push' }); const t0 = performance.now();
    try {
      if(this.server){ const r = await fetch('api/state', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ json: JSON.stringify(S), updatedAt: S.updatedAt }) }); if(r.status === 409){ this.busy = false; return this.pull(false); } if(!r.ok) throw new Error('HTTP ' + r.status); }
      else await this.ref.set({ json: JSON.stringify(S), updatedAt: S.updatedAt });
      this.latency = Math.round(performance.now() - t0); this.lastSyncAt = Date.now();
      this.setStatus('synced'); emit('sync', { phase:'saved', ms: this.latency }); }
    catch(e){ console.warn('sync failed', e); emit('sync', { phase:'error', error: String(e.message || e) }); if(e && e.code === 'quota_exceeded') toast('Sync storage is full — archive old tasks in Settings.'); }
    this.busy = false;
    if(this.again){ this.again = false; this.push(); }
  }
};
function persistLocal(){ try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch(e){} }
function save(){ S.updatedAt = Date.now(); persistLocal(); Store.schedule(); }

/* ---------- model ops ---------- */
const client = id => S.clients.find(c => c.id === id);
const decodeEntities = str => { const ta = document.createElement('textarea'); ta.innerHTML = String(str || ''); return ta.value; };
const capFirst = str => { str = String(str || '').trim(); return /^\p{Ll}\p{Lu}/u.test(str) ? str : str.charAt(0).toLocaleUpperCase() + str.slice(1); };   // leaves iOS, eBay alone
const titleCase = str => /[A-Z]/.test(str) ? str.trim() : String(str).trim().replace(/(^|[\s\-(&/])(\p{Ll})/gu, (m, p, c) => p + c.toLocaleUpperCase());
function cleanDomain(v){
  v = String(v || '').trim().toLowerCase(); if(!v) return '';
  v = v.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split(/[\/?#\s]/)[0].replace(/:\d+$/, '');
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v) ? v : '';
}
const guessDomain = name => { const b = norm(String(name).replace(/\b(inc|corp|corporation|llc|ltd|limited|co|company|group|industries|holdings|solutions|consulting|technologies|tech)\b\.?/gi, '')); return b ? b + '.com' : ''; };
const initials = name => { const w = String(name||'?').replace(/[^\p{L}\p{N}\s&]/gu,'').trim().split(/\s+/).filter(x => !/^(inc|corp|llc|ltd|the|&)$/i.test(x)); return ((w[0]||'?')[0] + (w.length > 1 ? w[1][0] : (w[0]||'')[1] || '')).toUpperCase(); };
const faviconUrl = (d, v) => Store.server ? 'api/favicon?d=' + encodeURIComponent(d) + (v ? '&v=' + v : '') : 'https://www.google.com/s2/favicons?sz=128&domain=' + encodeURIComponent(d);
const INDUSTRY = {
  software:      { label:'Software & IT',          icon:'💻', color:'#4a6cf7', apps:['Zoho Desk','Zoho Billing','Zoho CRM','Zoho Analytics'], tpl:'desk' },
  manufacturing: { label:'Manufacturing',          icon:'🏭', color:'#3f7d8c', apps:['Zoho Inventory','Zoho CRM','Zoho Books','Zoho Analytics'], tpl:'crm' },
  healthcare:    { label:'Healthcare',             icon:'🩺', color:'#2f9e6b', apps:['Zoho Bookings','Zoho Desk','Zoho Forms','Zoho CRM'], tpl:'desk' },
  legal:         { label:'Legal',                  icon:'⚖️', color:'#6b5b95', apps:['Zoho CRM','Zoho Sign','Zoho WorkDrive','Zoho Bookings'], tpl:'crm' },
  finance:       { label:'Finance & accounting',   icon:'💼', color:'#1f6f5c', apps:['Zoho Books','Zoho Practice','Zoho Sign','Zoho CRM'], tpl:'books' },
  insurance:     { label:'Insurance',              icon:'🛡️', color:'#355c9a', apps:['Zoho CRM','Zoho Desk','Zoho Sign','Zoho Forms'], tpl:'crm' },
  realestate:    { label:'Real estate',            icon:'🏠', color:'#c2771c', apps:['Zoho CRM','Zoho Sign','Zoho Bookings','Zoho Campaigns'], tpl:'crm' },
  construction:  { label:'Construction & trades',  icon:'🏗️', color:'#d0892b', apps:['Zoho FSM','Zoho Projects','Zoho Inventory','Zoho Books'], tpl:'crm' },
  retail:        { label:'Retail & eCommerce',     icon:'🛍️', color:'#e0607e', apps:['Zoho Commerce','Zoho Inventory','Zoho Books','Marketing Automation'], tpl:'books' },
  logistics:     { label:'Logistics',              icon:'🚚', color:'#0e8fb5', apps:['Zoho Inventory','Zoho FSM','Zoho Analytics','Zoho Creator'], tpl:'crm' },
  education:     { label:'Education',              icon:'🎓', color:'#7a5af8', apps:['Zoho Forms','Zoho Creator','Zoho Desk','Zoho Campaigns'], tpl:'desk' },
  nonprofit:     { label:'Nonprofit',              icon:'🤝', color:'#b0459a', apps:['Zoho CRM for Nonprofits','Zoho Campaigns','Zoho Forms','Zoho Books'], tpl:'crm' },
  hospitality:   { label:'Hospitality & travel',   icon:'🏨', color:'#a0522d', apps:['Zoho Bookings','Zoho Desk','Zoho Survey','Zoho Books'], tpl:'desk' },
  marketing:     { label:'Marketing & creative',   icon:'📣', color:'#d4533b', apps:['Zoho Projects','Zoho Social','Marketing Plus','Zoho CRM'], tpl:'crm' },
  energy:        { label:'Energy & utilities',     icon:'⚡', color:'#7a8a2a', apps:['Zoho FSM','Zoho Creator','Zoho Analytics','Zoho Inventory'], tpl:'crm' },
  automotive:    { label:'Automotive',             icon:'🚗', color:'#5b5bd6', apps:['Zoho CRM','Zoho Inventory','Zoho Desk','Zoho Bookings'], tpl:'crm' },
  other:         { label:'Other',                  icon:'🏢', color:'#8a877f', apps:[], tpl:null },
};
async function fetchCompany(domain, refresh){
  if(!Store.server) throw new Error('nas-only');
  const r = await fetch(`api/company?d=${encodeURIComponent(domain)}${refresh ? '&refresh=1' : ''}`, { cache:'no-store' });
  if(!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
function applyCompany(c, info, force){
  if(!info) return;
  if(info.industry && (force || !c.industryManual)) c.industry = info.industry;
  if(info.description && (force || !c.descManual)) c.description = info.description;
  c.themeColor = info.themeColor || c.themeColor || '';
  c.hasBanner = !!info.hasBanner; c.logoV = info.fetchedAt; c.fetchedAt = info.fetchedAt;
}
/* long-running jobs show as a spinner in the Island (or plain toasts without it) */
function job(key, title, o = {}){
  const I = enabled('island') && window.CadenceIsland;
  if(I) return I.progress(key, title, o);
  return { update(){}, done(p = {}){ if(p.title) toast(p.title + (p.sub ? ' — ' + p.sub : '')); }, dismiss(){} };
}
async function refreshCompany(cid, opts = {}){
  const c = client(cid); if(!c || !c.domain) return;
  if(!Store.server){ if(!opts.quiet) toast('Company lookup runs on your NAS — open Cadence there to refresh'); return; }
  const j = opts.quiet ? null : job('company:' + cid, `Looking up ${c.domain}`, { sub: 'logo, colours, industry, description' });
  try {
    const info = await fetchCompany(c.domain, !!opts.refresh);
    applyCompany(c, info, opts.force); save(); render();
    if(j) j.done(info.ok ? { title: `Updated ${c.name}`, sub: [info.industry && INDUSTRY[info.industry] ? INDUSTRY[info.industry].label : '', info.logo ? 'new logo' : ''].filter(Boolean).join(' · ') || c.domain, image: avatar(client(cid), 20), check: false } : { title: `Couldn’t reach ${c.domain}`, sub: 'Kept what we had', icon: '!', color: '#e5484d' });
  } catch(e){ if(j) j.done({ title: 'Lookup failed', sub: e.message, icon: '!', color: '#e5484d' }); }
}
function avatar(c, size = 16){
  if(!c) return '';
  const img = c.domain ? `<img src="${esc(faviconUrl(c.domain, c.logoV))}" alt="" loading="lazy" onerror="this.remove()">` : '';
  return `<span class="av" style="--c:${c.color};width:${size}px;height:${size}px;font-size:${Math.round(size*.42)}px">${esc(initials(c.name))}${img}</span>`;
}
function addClient(name, color, domain){
  name = String(name||'').trim();
  const m = name.match(/^(.*?)\s*[(<\[]\s*([^)>\]]+)\s*[)>\]]\s*$/); if(m && cleanDomain(m[2])){ name = m[1].trim(); domain = domain || m[2]; }
  if(!name) return null;
  name = titleCase(name);
  const ex = S.clients.find(c => norm(c.name) === norm(name)); if(ex){ ex.archived = false; return ex; }
  const c = { id: uid('c'), name, color: color || COLORS[S.clients.length % COLORS.length], domain: cleanDomain(domain), status:'active', archived:false, createdAt: Date.now() };
  S.clients.push(c); save(); emit('client:add', clone(c));
  if(c.domain) setTimeout(() => refreshCompany(c.id, { quiet:true }), 0);
  return c;
}
function computeRemind(t){
  if(t.remindMode === 'none') return null;
  if(t.remindMode === 'custom') return t.remindAt;
  if(!t.dueTime) return null;
  const lead = t.remindMode === 'at' ? 0 : t.remindMode === '60' ? 60 : (S.settings.remindLead ?? 10);
  return dueMs(t) - lead*60000;
}
function addTask(p){
  if(p && p.id === undefined) delete p.id;
  const t = Object.assign({ id: uid('t'), title:'', clientId:null, owner:'me', assignee:'', dueDate:null, dueTime:null, priority:0, tags:[], notes:'', remindMode:'auto', remindAt:null, reminded:false, done:false, doneAt:null, createdAt:Date.now(), meetingId:null }, p);
  t.title = capFirst(t.title);
  t.remindAt = computeRemind(t);
  S.tasks.push(t); save(); emit('task:add', clone(t)); return t;
}
function updateTask(id, patch){
  const t = S.tasks.find(x => x.id === id); if(!t) return;
  Object.assign(t, patch);
  if(['dueDate','dueTime','remindMode','remindAt'].some(k => k in patch)){ t.remindAt = computeRemind(t); t.reminded = false; }
  save(); emit('task:update', clone(t)); return t;
}
const REPEAT_LABEL = r => !r ? '' : r.unit === 'weekday' ? 'Weekdays' : r.unit === 'day' ? (r.n > 1 ? `Every ${r.n} days` : 'Daily') : r.unit === 'week' ? (r.n === 2 ? 'Every 2 weeks' : r.n > 1 ? `Every ${r.n} weeks` : 'Weekly') : r.unit === 'month' ? (r.n > 1 ? `Every ${r.n} months` : 'Monthly') : '';
function nextOccurrence(fromKey, r){
  const step = d => {
    if(r.unit === 'day') return addDays(d, r.n || 1);
    if(r.unit === 'week') return addDays(d, 7 * (r.n || 1));
    if(r.unit === 'weekday'){ let x = addDays(d, 1); while(x.getDay() === 0 || x.getDay() === 6) x = addDays(x, 1); return x; }
    if(r.unit === 'month'){ const day = fromYmd(fromKey).getDate(); const x = new Date(d.getFullYear(), d.getMonth() + (r.n || 1), 1); x.setDate(Math.min(day, new Date(x.getFullYear(), x.getMonth()+1, 0).getDate())); return x; }
    return addDays(d, 1);
  };
  let d = step(fromYmd(fromKey));
  while(ymd(d) <= todayKey() && fromKey < todayKey()) d = step(d);   // completed late: jump to the next future one
  return ymd(d);
}
function toggleDone(id, force){
  const t = S.tasks.find(x => x.id === id); if(!t) return;
  t.done = force ?? !t.done; t.doneAt = t.done ? Date.now() : null;
  if(t.repeat){
    if(t.done && !t.spawnedId){
      const next = addTask({ ...clone(t), id: undefined, done:false, doneAt:null, reminded:false, spawnedId:null, createdAt: Date.now(), dueDate: nextOccurrence(t.dueDate || todayKey(), t.repeat), meetingId:null, lastChased:null });
      t.spawnedId = next.id;
    } else if(!t.done && t.spawnedId){
      const n = S.tasks.find(x => x.id === t.spawnedId); if(n && !n.done) removeTask(n.id); t.spawnedId = null;
    }
  }
  save();
  emit(t.done ? 'task:complete' : 'task:reopen', clone(t));
}
function removeTask(id){ const i = S.tasks.findIndex(x => x.id === id); if(i>-1){ const [t] = S.tasks.splice(i,1); save(); emit('task:remove', clone(t)); return t; } }
const sortTasks = arr => arr.sort((a,b) => (a.dueDate||'9999').localeCompare(b.dueDate||'9999') || (a.order ?? 1e15) - (b.order ?? 1e15) || (a.dueTime||'99').localeCompare(b.dueTime||'99') || (b.priority-a.priority) || (a.createdAt-b.createdAt));
const open = () => S.tasks.filter(t => !t.done);

/* ---------- natural-language quick add ---------- */
function parseQuick(input, ctx = {}){
  let t = ' ' + input + ' ';
  const r = { title:'', repeat:null, clientId: ctx.clientId || null, owner: ctx.owner || 'me', assignee:'', dueDate:null, dueTime:null, priority:0, tags:[], newClient:null };
  const take = (re, fn) => { const m = t.match(re); if(m && fn(m) !== false){ t = t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length); return m; } return null; };
  const pre = '(?:\\s(?:by|on|due|before|until))?';
  // client  @acme
  // multi-word names: @Acme Corp, @"Blue Sky Labs", @Blue_Sky
  (() => {
    const at = t.search(/\s@\S/); if(at < 0) return;
    const rest = t.slice(at + 2);
    const quoted = rest.match(/^"([^"]+)"/);
    // "meet with @Acme" keeps the name in the sentence; "Send SOW @Acme" just tags it
    const keep = /(^|\s)(with|from|for|to|at|by|about|re|and|cc|w\/|via|of|on)$/i.test(t.slice(0, at).trimEnd());
    const cut = (len, name) => { t = t.slice(0, at) + ' ' + (keep && name ? name + ' ' : '') + t.slice(at + 2 + len); };
    if(quoted){
      const q = norm(quoted[1]), c = S.clients.find(c => norm(c.name) === q);
      if(c) r.clientId = c.id; else r.newClient = quoted[1].trim();
      return cut(quoted[0].length, c ? c.name : quoted[1].trim());
    }
    const live = S.clients.filter(c => !c.archived);
    for(let k = 6; k >= 1; k--){                       // longest exact match on existing clients first
      const m = rest.match(new RegExp('^(\\S+(?:\\s+\\S+){' + (k-1) + '})(?=\\s|$)')); if(!m) continue;
      const c = live.find(c => norm(c.name) === norm(m[1])) || S.clients.find(c => norm(c.name) === norm(m[1]));
      if(c){ r.clientId = c.id; return cut(m[1].length, c.name); }
    }
    const w = rest.match(/^\S+/)[0], q = norm(w);
    const c = q && (live.find(c => norm(c.name).startsWith(q)) || live.find(c => norm(c.name).includes(q)));
    if(c) r.clientId = c.id; else r.newClient = w.replace(/[_]+/g, ' ').trim();
    cut(w.length, c ? c.name : r.newClient);
  })();
  // owner  ^ or ^Name  -> client's action item
  take(/\s\^([\w.'-]*)(?=\s)/, m => { r.owner = 'client'; r.assignee = m[1] || ''; });
  // priority  !1 !2 !3  !high
  take(/\s!(1|2|3|high|med|low|!+)(?=\s)/i, m => { const v = m[1].toLowerCase(); r.priority = v==='high'||v==='1'||v.startsWith('!')&&v.length>=2 ? 3 : v==='med'||v==='2'||v==='!' ? 2 : 1; });
  // plugin syntax
  for(const p of Reg.parsers){ try { const out = p.fn(t, r, ctx); if(typeof out === 'string') t = out; } catch(e){ console.error(e); } }
  // tags
  let m; while((m = t.match(/\s#([\w-]+)(?=\s)/))){ r.tags.push(m[1]); t = t.slice(0,m.index) + ' ' + t.slice(m.index + m[0].length); }
  // time
  take(/(?:\s(?:at|@))?\s(\d{1,2})(?::(\d{2}))?\s?(am|pm|a|p)(?=\s)/i, m => { let h = +m[1]%12; if(/p/i.test(m[3])) h += 12; r.dueTime = `${pad(h)}:${pad(+(m[2]||0))}`; })
   || take(/(?:\s(?:at|@))?\s([01]?\d|2[0-3]):([0-5]\d)(?=\s)/, m => { r.dueTime = `${pad(+m[1])}:${m[2]}`; })
   || take(/\s(?:at\s)?noon(?=\s)/i, () => { r.dueTime = '12:00'; });
  const setRepeat = (n, u) => {
    u = u.toLowerCase();
    if(/^daily|^days?$/.test(u)) r.repeat = { unit:'day', n };
    else if(/^weekdays?$/.test(u)) r.repeat = { unit:'weekday', n:1 };
    else if(/^weekly|^weeks?$/.test(u)) r.repeat = { unit:'week', n };
    else if(/^(biweekly|fortnightly)$/.test(u)) r.repeat = { unit:'week', n:2 };
    else if(/^monthly|^months?$/.test(u)) r.repeat = { unit:'month', n };
    else { r.repeat = { unit:'week', n }; const d = DOWS.indexOf(u.slice(0,3)); const now = new Date(); r.dueDate = ymd(addDays(now, (d - now.getDay() + 7) % 7)); }
  };
  // "every fri", "every 2 weeks", "every weekday" — anywhere
  take(/\s(?:repeat\s)?every\s(?:(\d+)\s)?(day|days|weekday|weekdays|week|weeks|month|months|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tues|tue|wed|thurs|thu|fri|sat|sun)(?=\s)/i, m => setRepeat(+(m[1] || 1), m[2]));
  // "daily", "weekly"… — but not as the first word ("Weekly report" stays a title)
  if(!r.repeat){ const m = t.match(/\S\s+(daily|weekly|biweekly|fortnightly|monthly)(?=\s)/i); if(m){ setRepeat(1, m[1]); const at = m.index + m[0].length - m[1].length; t = t.slice(0, at) + t.slice(at + m[1].length); } }
  take(/\s(eod|end of day)(?=\s)/i, () => { r.dueTime = r.dueTime || '17:00'; r.dueDate = todayKey(); });
  const now = new Date();
  take(new RegExp(pre + '\\s(today|tod|tonight)(?=\\s)','i'), m => { r.dueDate = todayKey(); if(/night/i.test(m[1]) && !r.dueTime) r.dueTime = '19:00'; })
  || take(new RegExp(pre + '\\s(tomorrow|tmrw|tmr|tom)(?=\\s)','i'), () => { r.dueDate = ymd(addDays(now,1)); })
  || take(new RegExp(pre + '\\s(next week|nw)(?=\\s)','i'), () => { r.dueDate = ymd(addDays(now, ((8 - now.getDay()) % 7) || 7)); })
  || take(new RegExp(pre + '\\s(eow|end of week)(?=\\s)','i'), () => { r.dueDate = ymd(addDays(now, (5 - now.getDay() + 7) % 7)); })
  || take(new RegExp(pre + '\\sin\\s(\\d+)\\s?(d|days?|w|wks?|weeks?)(?=\\s)','i'), m => { r.dueDate = ymd(addDays(now, +m[1] * (/^w/i.test(m[2]) ? 7 : 1))); })
  || take(new RegExp(pre + '\\s(next\\s)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tues|tue|wed|thurs|thu|fri|sat|sun)(?=\\s)','i'), m => {
      const d = DOWS.indexOf(m[2].slice(0,3).toLowerCase()); let diff = (d - now.getDay() + 7) % 7; if(diff === 0) diff = 7; if(m[1] && diff < 7 && (d - now.getDay()) <= 0) {} r.dueDate = ymd(addDays(now, diff)); })
  || take(new RegExp(pre + '\\s(' + MONS.join('|') + ')[a-z]*\\.?\\s(\\d{1,2})(?:st|nd|rd|th)?(?=\\s)','i'), m => {
      let d = new Date(now.getFullYear(), MONS.indexOf(m[1].toLowerCase()), +m[2]); if(Date.now() - d > 60*864e5) d.setFullYear(d.getFullYear()+1); r.dueDate = ymd(d); })
  || take(new RegExp(pre + '\\s(\\d{1,2})\\/(\\d{1,2})(?=\\s)'), m => {
      let d = new Date(now.getFullYear(), +m[1]-1, +m[2]); if(isNaN(d) || +m[1]>12) return false; if(Date.now() - d > 60*864e5) d.setFullYear(d.getFullYear()+1); r.dueDate = ymd(d); });
  if(r.repeat && !r.dueDate){ r.dueDate = todayKey(); if(r.repeat.unit === 'weekday'){ let d = new Date(); while(d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1); r.dueDate = ymd(d); } }
  if(r.dueTime && !r.dueDate){ const [h,mm] = r.dueTime.split(':').map(Number); r.dueDate = (now.getHours()*60+now.getMinutes() > h*60+mm) ? ymd(addDays(now,1)) : todayKey(); }
  r.title = t.replace(/\s+/g,' ').replace(/\s(by|on|due|at)$/i,'').trim();
  return r;
}
function parseChips(r){
  const out = [];
  if(r.clientId){ const c = client(r.clientId); out.push(`<span class="chip">${avatar(c,14)}${esc(c.name)}</span>`); }
  if(r.newClient) out.push(`<span class="chip">+ new client “${esc(r.newClient)}”</span>`);
  if(r.owner === 'client') out.push(`<span class="chip client-owned">↗ ${r.assignee ? esc(r.assignee) : 'Client'}’s action</span>`);
  if(r.dueDate) out.push(`<span class="chip">◷ ${esc(dueLabel(r))}</span>`);
  if(r.repeat) out.push(`<span class="chip">↻ ${REPEAT_LABEL(r.repeat)}</span>`);
  if(r.priority) out.push(`<span class="chip pri${r.priority}">${'!'.repeat(r.priority)} ${['','Low','Medium','High'][r.priority]}</span>`);
  r.tags.forEach(x => out.push(`<span class="chip">#${esc(x)}</span>`));
  return out.join('');
}
function createFromQuick(text, ctx){
  const r = parseQuick(text, ctx); if(!r.title) return null;
  if(r.newClient){ const c = addClient(r.newClient); r.clientId = c.id; }
  delete r.newClient;
  return addTask(r);
}

/* =========================================================
   Plugin host
   ========================================================= */
const Reg = { defs:[], commands:[], views:[], parsers:[], extractors:[], taskActions:[], meetingActions:[], clientActions:[], sidebar:[], listeners:[] };
let AI = null;
function enabled(pid){ return !S.disabled.includes(pid); }
function emit(ev, payload){ for(const l of Reg.listeners) if(l.ev === ev || l.ev === '*') { try { l.fn(payload, ev); } catch(e){ console.error(`[plugin ${l.pid}]`, e); } } }
function makeApi(pid){
  return Object.freeze({
    pluginId: pid,
    tasks: { list: f => S.tasks.filter(f || (() => true)).map(clone), get: id => clone(S.tasks.find(t => t.id === id) || null), add: p => clone(addTask(p)), update: (id,p) => { updateTask(id,p); render(); }, complete: id => { toggleDone(id,true); render(); }, remove: id => { removeTask(id); render(); }, quickAdd: (text, ctx) => clone(createFromQuick(text, ctx)) },
    clients: { list: () => S.clients.filter(c => !c.archived).map(clone), get: id => clone(client(id) || null), add: name => clone(addClient(name)), update: (id, patch) => { const c = client(id); if(!c) return; Object.assign(c, patch); save(); emit('client:update', clone(c)); } },
    meetings: { list: () => S.meetings.map(clone), active: () => clone(S.activeMeeting), start: (cid, notes) => startMeeting(cid, notes), importNotes: (cid) => { if(!S.activeMeeting) startMeeting(cid); setTimeout(openImport, 60); } },
    on: (ev, fn) => Reg.listeners.push({ pid, ev, fn }),
    commands: { add: c => Reg.commands.push({ ...c, pid }) },
    views: { add: v => Reg.views.push({ ...v, pid }) },
    db: { snapshot: () => clone(S) },
    /* the Island, for any plugin — falls back to a plain toast when the Island plugin is off */
    island: (() => { const I = () => enabled('island') && window.CadenceIsland; const noop = { update(){}, done(p){ if(p && p.title) toast(p.title); }, dismiss(){} };
      return {
        available: () => !!I(),
        show: n => I() ? I().show(n) : (toast(n.title + (n.sub ? ' — ' + n.sub : ''), n.actions || []), noop),
        celebrate: n => I() ? I().celebrate(n) : (toast((n.icon ? n.icon + ' ' : '') + n.title), noop),
        progress: (key, title, o) => I() ? I().progress(key, title, o) : noop,
        live: (key, l) => I() && I().live(pid + ':' + key, l),
        clear: key => I() && I().clear(pid + ':' + key),
      }; })(),
    parsers: { add: fn => Reg.parsers.push({ fn, pid }) },
    extractors: { add: e => Reg.extractors.push({ ...e, pid }) },
    taskActions: { add: a => Reg.taskActions.push({ ...a, pid }) },
    meetingActions: { add: a => Reg.meetingActions.push({ ...a, pid }) },
    clientActions: { add: a => Reg.clientActions.push({ ...a, pid }) },
    sidebar: { add: w => Reg.sidebar.push({ ...w, pid }) },
    plugins: { enabled: id => enabled(id) },
    system: () => ({ demo: DEMO, mode: Store.server ? 'nas' : Store.ref ? 'claude' : 'local', status: Store.status, lastSyncAt: Store.lastSyncAt || null, latency: Store.latency ?? null, ai: !!AI, health: Store.health || null, version: window.Cadence.version, plugins: Reg.defs.filter(d => enabled(d.id)).length, counts: { tasks: S.tasks.length, open: S.tasks.filter(t => !t.done).length, clients: S.clients.filter(c => !c.archived).length, meetings: S.meetings.length } }),
    ui: { reducedMotion, toast, refreshWidgets: () => renderWidgets(), pointer: () => ({ ...lastPointer }), faviconUrl: (d, v) => faviconUrl(d, v), avatar: (c, size) => avatar(c, size), navigate: r => go(r), refresh: () => render(), copy: copyText, esc, modal: openModalHTML, close: closeModal, currentRoute: () => route() },
    storage: { get: k => (S.pluginData[pid] || {})[k], set: (k,v) => { (S.pluginData[pid] = S.pluginData[pid] || {})[k] = v; save(); } },
    get ai(){ return AI; },
    settings: () => clone(S.settings),
    util: { parse: parseQuick, ymd, fmtDate, dueLabel, addDays, todayKey }
  });
}
function rebuildPlugins(){
  for(const k of ['commands','views','parsers','extractors','taskActions','meetingActions','clientActions','sidebar','listeners']) Reg[k] = [];
  for(const def of Reg.defs){
    if(!enabled(def.id)) continue;
    try { def.setup(makeApi(def.id)); } catch(e){ console.error(`Plugin ${def.id} failed`, e); }
  }
  if(booted) renderWidgets();
}
let loadingUser = null;
function registerPlugin(def){
  if(!def || !def.id || typeof def.setup !== 'function') throw new Error('Plugin needs { id, name, setup(api) }');
  if(loadingUser != null) def = Object.assign({}, def, { userCode: loadingUser });
  else if(!('builtin' in def)) def = Object.assign({}, def, { builtin: true }); // shipped in plugins/*.js
  Reg.defs = Reg.defs.filter(d => d.id !== def.id); Reg.defs.push(def);
  rebuildPlugins(); if(booted){ cancelAnimationFrame(registerPlugin.raf); registerPlugin.raf = requestAnimationFrame(() => render()); }
}
window.Cadence = Object.freeze({ version:'0.5.0', registerPlugin });

/* =========================================================
   Routing & render
   ========================================================= */
let booted = false, selTask = null;
const route = () => (location.hash || '#today').slice(1);
const go = r => { if(route() === r) render(); else location.hash = r; };
window.addEventListener('hashchange', () => render());

function render(){
  document.documentElement.dataset.theme = S.settings.theme;
  document.documentElement.dataset.motion = reducedMotion() ? 'reduce' : 'full';
  renderSide(); renderView();
}
function counts(){
  const t = todayKey(), o = open();
  return {
    today: o.filter(x => x.owner==='me' && x.dueDate && x.dueDate <= t).length,
    over: o.filter(x => x.owner==='me' && dueState(x)==='over').length,
    upcoming: o.filter(x => x.dueDate && x.dueDate > t).length,
    waiting: o.filter(x => x.owner==='client').length,
    inbox: o.filter(x => !x.clientId).length
  };
}
let showPaused = false;
function clientLink(cl, r, o, isPaused){
  const n = o.filter(t => t.clientId===cl.id && t.owner==='me').length, hot = o.some(t => t.clientId===cl.id && t.owner==='me' && dueState(t)==='over');
  return `<a class="${r==='client-'+cl.id?'on':''} ${isPaused?'paused':''}" href="#client-${cl.id}"><span class="ic">${avatar(cl, 20)}</span><span class="t">${esc(cl.name)}</span>${n?`<span class="n ${hot?'hot':''}">${n}</span>`:''}</a>`;
}
const NAV_ICONS = {
  today: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
  upcoming: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="8.5" cy="14.5" r=".6"/><circle cx="12" cy="14.5" r=".6"/><circle cx="15.5" cy="14.5" r=".6"/></svg>',
  waiting: '<svg viewBox="0 0 24 24"><path d="M7 3.5h10M7 20.5h10M8 3.5c0 4 8 5.5 8 8.5s-8 4.5-8 8.5M16 3.5c0 4-8 5.5-8 8.5s8 4.5 8 8.5"/></svg>',
  inbox: '<svg viewBox="0 0 24 24"><path d="M3.5 13.5l2.6-7.2A2 2 0 0 1 8 5h8a2 2 0 0 1 1.9 1.3l2.6 7.2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M3.5 13.5H8l1.5 2.5h5l1.5-2.5h4.5"/></svg>',
  done: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M8.3 12.3l2.5 2.5 5-5.3"/></svg>',
  keys: '<svg viewBox="0 0 24 24"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7.5 14h9"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2.8l1.6 2.3 2.8-.4.9 2.7 2.6 1.1-.5 2.8 1.8 2.2-1.8 2.2.5 2.8-2.6 1.1-.9 2.7-2.8-.4L12 21.2l-1.6-2.3-2.8.4-.9-2.7-2.6-1.1.5-2.8L2.8 12l1.8-2.2-.5-2.8 2.6-1.1.9-2.7 2.8.4z"/></svg>',
};
function renderSide(){
  const r = route(), c = counts(), o = open();
  const nav = (id, ic, label, n, hot) => `<a class="${r===id?'on':''}" href="#${id}"><span class="ic">${ic}</span><span class="t">${label}</span>${n ? `<span class="n ${hot?'hot':''}">${n}</span>` : ''}</a>`;
  const all = S.clients.filter(x => !x.archived).sort((a,b) => a.name.localeCompare(b.name));
  const clients = all.filter(x => x.status !== 'paused'), paused = all.filter(x => x.status === 'paused');
  if(!$('#side-head').firstChild) $('#side-head').innerHTML = `<div class="brand"><span class="logo"></span>Cadence<kbd title="Command palette">⌘K</kbd></div>`;
  $('#side-main').innerHTML = `
    <nav class="nav">
      ${nav('today', NAV_ICONS.today, 'Today', c.today, c.over>0)}
      ${nav('upcoming', NAV_ICONS.upcoming, 'Upcoming', c.upcoming)}
      ${nav('waiting', NAV_ICONS.waiting, 'Waiting on clients', c.waiting)}
      ${nav('inbox', NAV_ICONS.inbox, 'Inbox', c.inbox)}
      ${nav('done', NAV_ICONS.done, 'Logbook')}
    </nav>
    ${(() => { const loose = Reg.views.filter(v => !v.group && !v.hidden), ins = Reg.views.filter(v => v.group === 'insights'); const items = (ins.length ? [nav('insights', '✦', 'Insights')] : []).concat(loose.map(v => nav('view-'+v.id, esc(v.icon||'◇'), esc(v.title)))); return items.length ? `<div class="sect">Views</div><nav class="nav">${items.join('')}</nav>` : ''; })()}
    <div class="sect">Clients <button data-act="add-client" title="Add client">+</button></div>
    <nav class="nav">${clients.map(cl => clientLink(cl, r, o)).join('') || (paused.length ? '' : `<a data-act="add-client"><span class="ic">+</span><span class="t muted">Add your clients</span></a>`)}
      ${paused.length ? `<div class="more" data-act="toggle-paused">${showPaused ? '▾' : '▸'} Paused <span class="muted">${paused.length}</span></div>${showPaused ? paused.map(cl => clientLink(cl, r, o, true)).join('') : ''}` : ''}</nav>`;
  $('#side-foot').innerHTML = `${DEMO ? `<div class="demo-row"><b>●</b> Demo data<button data-act="demo-reset">Reset</button><button data-act="demo-exit">Exit</button></div>` : ''}
      <button class="meet-btn" data-act="meeting">${S.activeMeeting ? '● Resume meeting' : '◉ Start meeting'} <kbd style="background:transparent;color:inherit;border-color:currentColor;opacity:.45">M</kbd></button>
      <div class="foot-row"><span class="sync ${Store.status==='synced'?'ok':''}" id="sync"><i></i><span>${DEMO ? 'Demo data — not saved' : Store.status==='synced'?(Store.server?'Synced to NAS':'Synced'):'This browser'}</span></span><button data-act="shortcuts" title="Keyboard shortcuts (?)">${NAV_ICONS.keys}</button><button data-act="theme" title="Theme">${NAV_ICONS.moon}</button><button data-act="settings" title="Settings & plugins">${NAV_ICONS.gear}</button></div>`;
  emit('render:side', {});
}
/* plugin sidebar widgets: rendered once per plugin rebuild; plugins update their own widget afterwards */
function renderWidgets(){
  const box = $('#side-widgets'), top = $('#side-top'); if(!box) return;
  box.innerHTML = ''; top.innerHTML = '';
  for(const w of Reg.sidebar.slice().sort((a,b) => (a.order||0) - (b.order||0))){
    const el = document.createElement('div'); el.className = 'sw'; el.dataset.sw = w.id; (w.slot === 'top' ? top : box).appendChild(el);
    try { w.render(el, makeApi(w.pid)); } catch(e){ console.error('[widget ' + w.id + ']', e); }
  }
}
function taskRow(t, opts = {}){
  if(selTask === t.id) return taskEditor(t);
  const c = client(t.clientId), ds = dueState(t);
  const meta = [];
  if(c && !opts.hideClient) meta.push(`<span class="chip">${avatar(c,14)}${esc(c.name)}</span>`);
  if(t.owner === 'client' && !opts.hideOwner) meta.push(`<span class="chip client-owned">↗ ${esc(t.assignee || 'Client')}</span>`);
  if(t.dueDate) meta.push(`<span class="chip due ${ds}">${ds==='over'?'⚠ ':''}${esc(dueLabel(t))}</span>`);
  if(t.remindAt && !t.reminded && !t.done) meta.push(`<span class="chip due" title="Reminder ${new Date(t.remindAt).toLocaleString()}">🔔</span>`);
  if(t.repeat) meta.push(`<span class="chip due" title="${REPEAT_LABEL(t.repeat)}">↻ ${REPEAT_LABEL(t.repeat)}</span>`);
  if(t.lastChased && t.owner === 'client' && !t.done) meta.push(`<span class="chip due" title="Last chased">✉ chased ${fmtDate(ymd(new Date(t.lastChased))).toLowerCase()}</span>`);
  if(t.priority) meta.push(`<span class="chip pri${t.priority}">${'!'.repeat(t.priority)}</span>`);
  (t.tags||[]).forEach(x => meta.push(`<span class="chip">#${esc(x)}</span>`));
  if(t.notes) meta.push(`<span class="chip due" title="Has notes">≡</span>`);
  return `<div draggable="true" class="task ${t.done?'done':''} ${t.owner==='client'?'client':''} ${t.priority===3?'p3':''} ${selTask===t.id?'sel':''}" data-id="${t.id}">
    <button class="check" data-act="toggle" aria-label="Complete"></button>
    <div class="t-body"><div class="t-title">${esc(t.title)}</div><div class="t-meta">${meta.join('')}</div></div></div>`;
}
const group = (title, tasks, opts = {}) => tasks.length ? `<div class="group" data-drop="${opts.drop||''}"><div class="group-h ${opts.cls||''}">${title}<span class="c">${tasks.length}</span></div>${sortTasks(tasks).map(t => taskRow(t, opts)).join('')}</div>` : '';
function quickAdd(placeholder, ctx = {}){
  return `<div class="qa" data-ctx='${esc(JSON.stringify(ctx))}'><div class="qa-row"><span class="plus">+</span><input id="qa" autocomplete="off" placeholder="${esc(placeholder)}"><span class="hint">@ client · ^ they owe · fri 3pm · !1 · #tag</span></div><div class="qa-chips" id="qa-chips"></div></div>`;
}
function emptyState(icon, title, sub){ return `<div class="empty"><div class="big">${icon}</div><b>${title}</b>${sub||''}</div>`; }

function renderView(){
  const r = route(), v = $('#view'), t = todayKey(), o = open();
  let html = '';
  if(r === 'today'){
    const hr = new Date().getHours(), name = (S.settings.myName||'').split(' ')[0];
    const over = o.filter(x => x.owner==='me' && dueState(x)==='over' );
    const today = o.filter(x => x.owner==='me' && x.dueDate===t && dueState(x)!=='over');
    const chase = o.filter(x => x.owner==='client' && x.dueDate && x.dueDate <= t);
    const doneToday = S.tasks.filter(x => x.done && x.doneAt && ymd(new Date(x.doneAt))===t).length;
    const totalToday = doneToday + over.length + today.length, pct = totalToday ? doneToday / totalToday : 0;
    const timed = today.filter(x => x.dueTime).sort((a,b) => a.dueTime.localeCompare(b.dueTime));
    const nowHM = `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`, nxt = timed.find(x => x.dueTime >= nowHM) || timed[0];
    const nc = nxt && client(nxt.clientId), upcomingN = o.filter(x => x.owner === 'me' && x.dueDate && x.dueDate > t && x.dueDate <= ymd(addDays(new Date(), 7))).length;
    const glance = S.clients.length ? `<div class="glance">
        <div class="gl" data-go="today" title="Today's progress"><svg class="ring" viewBox="0 0 42 42"><circle cx="21" cy="21" r="17" stroke="color-mix(in srgb,var(--text) 8%,transparent)"/><circle cx="21" cy="21" r="17" stroke="var(--ok)" stroke-dasharray="106.8" stroke-dashoffset="${(106.8 * (1 - pct)).toFixed(1)}" style="transition:stroke-dashoffset .8s"/></svg><div class="tx"><div class="v">${doneToday}<span style="font-size:14px;color:var(--muted);font-weight:600"> / ${totalToday}</span></div><div class="l">${totalToday && doneToday === totalToday ? 'All done today 🎉' : 'done today'}</div></div></div>
        <div class="gl ${over.length ? 'hot' : ''}" data-go="#g-over"><div class="tx"><div class="v">${over.length}</div><div class="l">${over.length ? 'overdue — clear them' : 'nothing overdue'}</div></div></div>
        <div class="gl ${chase.length ? 'warm' : ''}" data-go="waiting"><div class="tx"><div class="v">${chase.length}</div><div class="l">${chase.length ? 'client items to chase' : 'no one to chase'}</div></div></div>
        <div class="gl" ${nxt ? `data-task="${nxt.id}"` : 'data-go="upcoming"'}><span class="ic2">${nc ? avatar(nc, 34) : nxt ? '⏰' : '🗓️'}</span><div class="tx"><div class="nx">${nxt ? esc(nxt.title) : upcomingN ? upcomingN + ' coming up this week' : 'Nothing timed today'}</div><div class="l">${nxt ? 'Next · ' + fmtTime(nxt.dueTime) + (nc ? ' · ' + esc(nc.name) : '') : 'Upcoming'}</div></div></div>
      </div>` : '';
    html = `<div class="head"><div><h1 class="hello">Good ${hr<12?'morning':hr<18?'afternoon':'evening'}${name?', '+esc(name):''}</h1><div class="sub">${new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})} · ${over.length+today.length} to do${doneToday?` · ${doneToday} done today`:''}</div></div></div>
      ${glance}${quickAdd('Add a task for today…  e.g. “Send SOW @acme 3pm”', { defaultDate:'today' })}
      <div id="g-over"></div>${group('Overdue', over, {cls:'danger'})}${group('Today', today)}${group('Follow up — client items due', chase, {cls:'client'})}
      ${!over.length && !today.length && !chase.length ? (S.clients.length ? emptyState('☀','Nothing due today','<span>Plan ahead in Upcoming, or start a meeting with <kbd>M</kbd>.</span>') : onboarding()) : ''}`;
  } else if(r === 'upcoming'){
    const up = o.filter(x => x.dueDate && x.dueDate > t);
    const byDay = {}; up.forEach(x => (byDay[x.dueDate] = byDay[x.dueDate] || []).push(x));
    html = `<div class="head"><div><h1>Upcoming</h1><div class="sub">Everything scheduled after today</div></div></div>${quickAdd('Schedule something…  e.g. “Review blueprint @northwind next week”')}
      ${Object.keys(byDay).sort().map(k => group(`${fmtDate(k)} <span class="c" style="font-weight:400">${fromYmd(k).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span>`, byDay[k])).join('') || emptyState('◷','Nothing scheduled','Type a date like “fri”, “nov 20” or “in 3 days”.')}`;
  } else if(r === 'waiting'){
    const w = o.filter(x => x.owner==='client'), by = {};
    w.forEach(x => (by[x.clientId||'_'] = by[x.clientId||'_'] || []).push(x));
    html = `<div class="head"><div><h1>Waiting on clients</h1><div class="sub">Action items you’re owed — chase these</div></div></div>${quickAdd('Log a client action item…', { owner:'client' })}
      ${Object.keys(by).map(k => { const c = client(k); return group(c ? `${avatar(c,16)} ${esc(c.name)}${Reg.clientActions.filter(x => (x.where||[]).includes('waiting')).map(x => `<button class="btn" style="margin-left:auto;padding:3px 10px;font-size:12px;text-transform:none;letter-spacing:0" data-act="client-action" data-i="${Reg.clientActions.indexOf(x)}" data-cid="${c.id}">${esc(x.short || x.label)}</button>`).join('')}` : 'No client', by[k], {hideClient:true, hideOwner:false}); }).join('') || emptyState('↗','No one owes you anything','Prefix with <kbd>^</kbd> to mark an item as the client’s.')}`;
  } else if(r === 'inbox'){
    html = `<div class="head"><div><h1>Inbox</h1><div class="sub">Tasks not tied to a client</div></div></div>${quickAdd('Capture anything…')}${group('Unsorted', o.filter(x => !x.clientId)) || emptyState('▢','Inbox zero','Nice.')}`;
  } else if(r === 'done'){
    const d = S.tasks.filter(x => x.done).sort((a,b) => b.doneAt - a.doneAt).slice(0, 200), by = {};
    d.forEach(x => { const k = ymd(new Date(x.doneAt)); (by[k] = by[k] || []).push(x); });
    html = `<div class="head"><div><h1>Logbook</h1><div class="sub">Recently completed</div></div></div>${Object.keys(by).sort().reverse().map(k => `<div class="group"><div class="group-h">${fmtDate(k)}<span class="c">${by[k].length}</span></div>${by[k].map(x => taskRow(x)).join('')}</div>`).join('') || emptyState('✓','Nothing completed yet','')}`;
  } else if(r.startsWith('client-')){
    const c = client(r.slice(7));
    if(!c){ html = emptyState('?','Client not found',''); }
    else {
      const mine = o.filter(x => x.clientId===c.id && x.owner==='me'), theirs = o.filter(x => x.clientId===c.id && x.owner==='client');
      const mtgs = S.meetings.filter(m => m.clientId===c.id).sort((a,b) => b.start - a.start);
      const overdue = mine.filter(x => dueState(x)==='over').length;
      const ind = INDUSTRY[c.industry], tint = c.themeColor || (ind && ind.color) || c.color;
      const heroBg = c.hasBanner && Store.server && c.domain ? `<div class="bg img" style="background-image:url('api/banner?d=${encodeURIComponent(c.domain)}&v=${c.logoV||''}')"></div>` : `<div class="bg" style="background:radial-gradient(1200px 260px at 85% 0%, ${tint}38, transparent 70%), linear-gradient(180deg, ${tint}1f, transparent)"></div>${ind ? `<div class="wm">${ind.icon}</div>` : ''}`;
      html = `<div class="c-hero">${heroBg}<div class="head"><div><h1>${avatar(c, 44)}<span class="nm" contenteditable="true" spellcheck="false" data-rename="${c.id}" title="Click to rename">${esc(c.name)}</span>${c.status==='paused' ? ' <span class="badge">Paused</span>' : ''}</h1><div class="sub">${ind ? `<span class="chip ind" data-act="edit-client" data-cid="${c.id}">${ind.icon} ${esc(ind.label)}</span> ` : ''}${c.domain ? `<a class="site-link" href="https://${esc(c.domain)}" target="_blank" rel="noopener">${esc(c.domain)}</a> · ` : `<a class="site-link" data-act="edit-client" data-cid="${c.id}" style="cursor:pointer">+ add website</a> · `}${mtgs[0] ? 'Last meeting ' + fmtDate(ymd(new Date(mtgs[0].start))).toLowerCase() : 'No meetings logged yet'}</div>${c.description ? `<div class="c-desc" title="Click to expand" onclick="this.classList.toggle('full')">${esc(decodeEntities(c.description))}</div>` : ''}</div>
        <div class="actions">${Reg.clientActions.filter(x => x.primary).map((x,i) => `<button class="btn" data-act="client-action" data-i="${Reg.clientActions.indexOf(x)}" data-cid="${c.id}">${esc(x.label)}</button>`).join('')}<button class="btn primary" data-act="meeting" data-cid="${c.id}">◉ Start meeting</button><button class="btn ghost" data-act="client-menu" data-cid="${c.id}" title="More">•••</button></div></div></div>
        ${ind && ind.apps.length ? `<div class="playbook"><span class="pb-t">${ind.icon} Usually fits ${esc(ind.label.toLowerCase())}:</span>${ind.apps.map(a => `<span class="chip">${esc(a)}</span>`).join('')}${ind.tpl && enabled('templates') && window.CadenceTemplates ? `<button class="btn" data-act="pb-template" data-cid="${c.id}" data-tpl="${ind.tpl}" style="margin-left:auto;padding:4px 10px;font-size:12px">▤ ${esc(window.CadenceTemplates.name(ind.tpl) || 'Apply template')}</button>` : ''}</div>` : ''}
        <div class="stats"><div class="stat"><div class="v">${mine.length}</div><div class="l">On me</div></div><div class="stat"><div class="v" style="color:var(--client)">${theirs.length}</div><div class="l">Waiting on ${esc(c.name)}</div></div><div class="stat"><div class="v" style="color:${overdue?'var(--danger)':'inherit'}">${overdue}</div><div class="l">Overdue</div></div><div class="stat"><div class="v">${mtgs.length}</div><div class="l">Meetings</div></div></div>
        ${quickAdd(`Add a task for ${c.name}…  prefix ^ for their action item`, { clientId: c.id })}
        <div class="cols"><div>${group('On me', mine, {hideClient:true, drop:'owner:me'}) || `<div class="group" data-drop="owner:me"><div class="group-h">On me</div><div class="muted drop-hint" style="padding:10px 6px">All clear.</div></div>`}</div>
        <div>${group('On client', theirs, {hideClient:true, cls:'client', drop:'owner:client'}) || `<div class="group" data-drop="owner:client"><div class="group-h client">On client</div><div class="muted drop-hint" style="padding:10px 6px">Nothing outstanding.</div></div>`}</div></div>
        ${mtgs.length ? `<div class="group"><div class="group-h">Meeting log<span class="c">${mtgs.length}</span></div>${mtgs.map(m => `<details class="mtg"><summary><b>${new Date(m.start).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</b><span class="muted">${Math.max(1,Math.round((m.end-m.start)/60000))} min · ${m.itemIds.length} action items</span></summary><div class="notes">${esc(m.notes || 'No notes.')}</div>${Reg.meetingActions.length ? `<div class="row" style="margin-top:10px;flex-wrap:wrap">${Reg.meetingActions.map((ac,i) => `<button class="btn" data-act="mlog-action" data-mid="${m.id}" data-i="${i}">${esc(ac.label)}</button>`).join('')}</div>` : ''}</details>`).join('')}</div>` : ''}`;
    }
  } else if(r === 'insights'){
    const ins = Reg.views.filter(x => x.group === 'insights');
    if(!ins.length){ html = emptyState('✦','No insights yet','Enable Pulse, Review, Mural or Feeds in Settings → Plugins.'); }
    else {
      const cur = ins.find(x => x.id === S.settings.insightsTab) || ins[0];
      v.innerHTML = `<div class="head"><div><h1>Insights</h1><div class="sub">${esc(cur.subtitle || '')}</div></div></div><div class="ins-tabs">${ins.map(x => `<button class="${x===cur?'on':''}" data-act="ins-tab" data-id="${esc(x.id)}">${esc(x.icon||'')} ${esc(x.title)}</button>`).join('')}</div><div id="pv"></div>`;
      try { cur.render($('#pv'), makeApi(cur.pid)); } catch(e){ $('#pv').textContent = 'Plugin view failed: ' + e.message; }
      applyKb(); emit('render', { route: r, view: cur.id }); return;
    }
  } else if(r.startsWith('view-')){
    const pv = Reg.views.find(x => 'view-'+x.id === r);
    if(pv){ v.innerHTML = `<div class="head"><div><h1>${esc(pv.title)}</h1>${pv.subtitle?`<div class="sub">${esc(pv.subtitle)}</div>`:''}</div></div><div id="pv"></div>`; try { pv.render($('#pv'), makeApi(pv.pid)); } catch(e){ $('#pv').textContent = 'Plugin view failed: ' + e.message; } emit('render', { route: r }); return; }
    html = emptyState('◇','View not available','The plugin providing it may be disabled.');
  } else { location.hash = 'today'; return; }
  v.innerHTML = html;
  bindQuickAdd(); applyKb();
  emit('render', { route: r });
}
function onboarding(){
  return `<div class="empty" style="text-align:left;max-width:480px;margin:0 auto"><b style="font-size:18px">Welcome to Cadence 👋</b><p class="muted">Start by adding the clients you work with, separated by commas. Add a website in brackets to pull in their logo.</p>
    <div class="row"><input class="inp" id="ob-clients" placeholder="Acme Corp (acme.com), Northwind, Globex…"><button class="btn primary" data-act="ob-add">Add</button></div>
    <p class="muted" style="margin-top:22px;font-size:13px">Then try typing in the box above:<br><code>Send proposal @acme fri 3pm !1</code> — a task with client, due time, and priority.<br><code>^ Share API credentials @acme tomorrow</code> — an item the <i>client</i> owes you.</p></div>`;
}
/* ---------- @client autocomplete ---------- */
function attachClientAC(inp, onPick){
  const host = inp.closest('.qa'); host.style.position = 'relative';
  const pop = document.createElement('div'); pop.className = 'ac'; pop.hidden = true; host.appendChild(pop);
  let items = [], sel = 0, tok = null;
  const token = () => {
    const v = inp.value, caret = inp.selectionStart ?? v.length, at = v.lastIndexOf('@', caret - 1);
    if(at < 0 || (at > 0 && !/\s/.test(v[at-1]))) return null;
    const q = v.slice(at + 1, caret); if(q.startsWith('"')) return null;
    if((q.match(/\s/g) || []).length > 4) return null;
    return { at, caret, q };
  };
  const draw = () => {
    tok = token();
    if(!tok){ pop.hidden = true; return; }
    const q = norm(tok.q), live = S.clients.filter(c => !c.archived), lower = tok.q.toLowerCase();
    if(live.some(c => lower.startsWith(c.name.toLowerCase() + ' '))){ pop.hidden = true; return; }   // already picked, typing on
    items = (q ? live.filter(c => norm(c.name).startsWith(q)).concat(live.filter(c => !norm(c.name).startsWith(q) && norm(c.name).includes(q))) : live.slice().sort((a,b) => (a.status==='paused') - (b.status==='paused') || a.name.localeCompare(b.name))).slice(0, 8);
    if(/\s$/.test(tok.q) && !items.length){ pop.hidden = true; return; }
    const createRow = tok.q.trim() && !live.some(c => norm(c.name) === q);
    const n = items.length + (createRow ? 1 : 0);
    if(sel >= n) sel = n - 1;
    if(sel < 0 && items.length && !/\s/.test(tok.q)) sel = 0;   // only pre-select real clients; "New client" must be chosen
    pop.innerHTML = items.map((c, i) => `<div class="ac-i ${i===sel?'on':''}" data-i="${i}">${avatar(c, 18)}<span>${esc(c.name)}</span>${c.status==='paused'?'<span class="badge">Paused</span>':''}</div>`).join('')
      + (createRow ? `<div class="ac-i ${sel===items.length?'on':''}" data-i="new"><span class="av" style="--c:var(--faint);width:18px;height:18px;font-size:12px">+</span><span>New client “${esc(tok.q.trim())}”</span></div>` : '');
    pop.hidden = !pop.innerHTML;
  };
  const pick = i => {
    if(!tok) return;
    let name;
    if(i === 'new' || i === items.length){ name = tok.q.trim().replace(/_+/g, ' '); if(!name) return; addClient(name); renderSide(); }
    else name = items[i].name;
    const v = inp.value, insert = '@' + name + ' ';
    inp.value = v.slice(0, tok.at) + insert + v.slice(tok.caret).replace(/^\s+/, '');
    const pos = tok.at + insert.length; inp.setSelectionRange(pos, pos);
    pop.hidden = true; sel = 0; onPick && onPick();
  };
  inp.addEventListener('input', () => { sel = -1; draw(); });
  inp.addEventListener('click', draw);
  inp.addEventListener('blur', () => setTimeout(() => { pop.hidden = true; }, 150));
  inp.addEventListener('keydown', e => {
    if(pop.hidden) return;
    const n = pop.querySelectorAll('.ac-i').length;
    if(e.key === 'ArrowDown'){ sel = (sel + 1) % n; draw(); const o = pop.querySelector('.ac-i.on'); o && o.scrollIntoView({ block:'nearest' }); }
    else if(e.key === 'ArrowUp'){ sel = sel <= 0 ? n - 1 : sel - 1; draw(); }
    else if(e.key === 'Enter' || e.key === 'Tab'){ if(sel < 0){ pop.hidden = true; return; } pick(sel); }
    else if(e.key === 'Escape'){ pop.hidden = true; }
    else return;
    e.preventDefault(); e.stopImmediatePropagation();
  });
  pop.addEventListener('mousedown', e => { const it = e.target.closest('.ac-i'); if(!it) return; e.preventDefault(); pick(it.dataset.i === 'new' ? 'new' : +it.dataset.i); inp.focus(); });
}
function bindQuickAdd(){
  const inp = $('#qa'); if(!inp) return;
  const box = inp.closest('.qa'), ctx = JSON.parse(box.dataset.ctx || '{}'), chips = $('#qa-chips');
  attachClientAC(inp, () => { chips.innerHTML = parseChips(parseQuick(inp.value, ctx)); });
  inp.addEventListener('input', () => { chips.innerHTML = inp.value.trim() ? parseChips(parseQuick(inp.value, ctx)) : ''; });
  inp.addEventListener('keydown', e => {
    if(e.key === 'Enter' && inp.value.trim()){
      const t = createFromQuick(inp.value, ctx);
      const defaulted = !!(t && ctx.defaultDate === 'today' && !t.dueDate);
      if(defaulted){ t.dueDate = todayKey(); save(); }
      inp.value = ''; chips.innerHTML = ''; render(); $('#qa') && $('#qa').focus();
      if(t) emit('task:quickadd', { ...clone(t), defaulted });
      if(t) toast(`Added “${t.title}”`, [{ label:'Undo', run: () => { removeTask(t.id); render(); } }]);
    }
    if(e.key === 'Escape') inp.blur();
  });
}

/* ---------- inline task editor (replaces the side drawer): the task opens in place ---------- */
const TE_ICONS = {
  due: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  time: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  client: '<svg viewBox="0 0 24 24"><path d="M4 20V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v14M15 10h3a2 2 0 0 1 2 2v8M3 20h18M8 8h3M8 12h3M8 16h3"/></svg>',
  owner: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>',
  repeat: '<svg viewBox="0 0 24 24"><path d="M17 2.5l3 3-3 3"/><path d="M4 11.5v-1a5 5 0 0 1 5-5h11"/><path d="M7 21.5l-3-3 3-3"/><path d="M20 12.5v1a5 5 0 0 1-5 5H4"/></svg>',
  prio: '<svg viewBox="0 0 24 24"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  remind: '<svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4"/></svg>',
  tags: '<svg viewBox="0 0 24 24"><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.3"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
};
function taskEditor(t){
  const c = client(t.clientId), ds = dueState(t);
  const chip = (k, label, on, extra = '') => `<button class="te-chip ${on ? 'on' : ''} ${extra}" data-te="${k}">${TE_ICONS[k] || ''}<span>${label}</span></button>`;
  const remindLabel = t.remindAt ? (t.reminded ? 'Reminded' : new Date(t.remindAt).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' })) : 'Remind';
  return `<div class="task open ${t.done?'done':''} ${t.owner==='client'?'client':''}" data-id="${t.id}">
    <button class="check" data-act="toggle" aria-label="Complete"></button>
    <div class="t-body">
      <input class="te-title" data-tf="title" value="${esc(t.title)}" spellcheck="false" aria-label="Title">
      <textarea class="te-notes" data-tf="notes" rows="1" placeholder="Notes">${esc(t.notes || '')}</textarea>
      <div class="te-chips">
        ${chip('due', t.dueDate ? dueLabel({ dueDate: t.dueDate }) : 'Date', !!t.dueDate, ds)}
        ${t.dueDate ? chip('time', t.dueTime ? fmtTime(t.dueTime) : 'Time', !!t.dueTime) : ''}
        <button class="te-chip ${c ? 'on' : ''}" data-te="client">${c ? avatar(c, 15) : TE_ICONS.client}<span>${c ? esc(c.name) : 'Client'}</span></button>
        ${chip('owner', t.owner === 'client' ? (esc(t.assignee) || 'Client') + '’s' : 'Mine', t.owner === 'client', t.owner === 'client' ? 'cl' : '')}
        ${chip('repeat', t.repeat ? REPEAT_LABEL(t.repeat) : 'Repeat', !!t.repeat)}
        ${chip('prio', t.priority ? ['','Low','Medium','High'][t.priority] : 'Priority', !!t.priority, t.priority ? 'p' + t.priority : '')}
        ${t.dueTime ? chip('remind', remindLabel, !!t.remindAt) : ''}
        ${chip('tags', (t.tags||[]).length ? (t.tags).map(x => '#' + esc(x)).join(' ') : 'Tags', (t.tags||[]).length > 0)}
        <span class="te-sp"></span>
        ${Reg.taskActions.length ? `<button class="te-chip icon" data-te="more" title="More">${TE_ICONS.more}</button>` : ''}
        <button class="te-chip icon danger" data-te="delete" title="Delete">${TE_ICONS.trash}</button>
      </div>
    </div></div>`;
}
/* a small popover anchored to an element — fluid, appears right where you clicked */
function popover(anchor, html, mount, opts = {}){
  closePop();
  const p = document.createElement('div'); p.className = 'pop'; p.id = 'pop'; p.innerHTML = html;
  document.body.appendChild(p);
  const r = anchor.getBoundingClientRect(), w = Math.max(opts.w || 0, p.offsetWidth), h = p.offsetHeight;
  if(opts.w) p.style.width = opts.w + 'px';
  const x = Math.max(10, Math.min(innerWidth - w - 10, r.left)), below = r.bottom + 8 + h < innerHeight;
  p.style.left = x + 'px'; p.style.top = (below ? r.bottom + 6 : r.top - h - 6) + 'px';
  p.style.transformOrigin = `${r.left - x + 14}px ${below ? 'top' : 'bottom'}`;
  const close = () => closePop();
  mount && mount(p, close);
  setTimeout(() => { document.addEventListener('pointerdown', popOutside, true); }, 0);
  return p;
}
function popOutside(e){ const p = $('#pop'); if(p && !p.contains(e.target)){ closePop(); if(!e.target.closest('.te-chip')) e.stopPropagation(); } }
function closePop(){ const p = $('#pop'); if(p){ p.classList.add('out'); p.id = ''; setTimeout(() => p.remove(), 140); } document.removeEventListener('pointerdown', popOutside, true); }
function popList(anchor, items, onPick, opts = {}){
  return popover(anchor, `${opts.search ? '<input class="pop-search" placeholder="Search…">' : ''}<div class="pop-list">${items.map((it, i) => `<button class="pop-i ${it.on ? 'on' : ''}" data-i="${i}">${it.html || esc(it.label)}${it.on ? '<span class="ck">✓</span>' : ''}</button>`).join('')}</div>${opts.foot || ''}`, (p, close) => {
    p.querySelectorAll('.pop-i').forEach(b => b.onclick = () => { onPick(items[+b.dataset.i]); close(); });
    const s = p.querySelector('.pop-search');
    if(s){ s.focus(); s.oninput = () => { const q = s.value.toLowerCase(); p.querySelectorAll('.pop-i').forEach(b => b.style.display = b.textContent.toLowerCase().includes(q) ? '' : 'none'); };
      s.onkeydown = e => { if(e.key === 'Enter'){ const f = [...p.querySelectorAll('.pop-i')].find(b => b.style.display !== 'none'); f && f.click(); } if(e.key === 'Escape') close(); }; }
    opts.mount && opts.mount(p, close);
  }, opts);
}
function editChip(t, key, el){
  const up = patch => { updateTask(t.id, patch); renderSide(); renderView(); };
  if(key === 'due'){
    if(window.CadenceDatePick) return window.CadenceDatePick.openAt(el, { value: t.dueDate, title: t.title, onPick: k => up({ dueDate: k }), onClear: () => up({ dueDate: null, dueTime: null }) });
    return popover(el, `<input type="date" class="inp" value="${t.dueDate || ''}">`, (p, close) => { const i = p.querySelector('input'); i.focus(); i.onchange = () => { up({ dueDate: i.value || null }); close(); }; });
  }
  if(key === 'time'){
    const quick = ['09:00','10:00','12:00','14:00','15:00','17:00'];
    return popover(el, `<div class="pop-times">${quick.map(q => `<button data-q="${q}" class="${t.dueTime === q ? 'on' : ''}">${fmtTime(q)}</button>`).join('')}</div><div class="pop-row"><input type="time" class="inp" value="${t.dueTime || ''}"><button class="btn" data-clear>Clear</button></div>`, (p, close) => {
      p.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { up({ dueTime: b.dataset.q }); close(); });
      const i = p.querySelector('input'); i.onchange = () => { up({ dueTime: i.value || null }); close(); };
      p.querySelector('[data-clear]').onclick = () => { up({ dueTime: null }); close(); };
    }, { w: 236 });
  }
  if(key === 'client'){
    const items = [{ id: null, html: `<span class="av" style="--c:var(--faint);width:18px;height:18px;font-size:10px">–</span> No client`, on: !t.clientId }]
      .concat(S.clients.filter(c => !c.archived).sort((a,b) => a.name.localeCompare(b.name)).map(c => ({ id: c.id, html: `${avatar(c, 18)} ${esc(c.name)}`, on: c.id === t.clientId })));
    return popList(el, items, it => up({ clientId: it.id }), { search: true, w: 230 });
  }
  if(key === 'owner'){
    return popover(el, `<div class="pop-list"><button class="pop-i ${t.owner==='me'?'on':''}" data-o="me">Mine${t.owner==='me'?'<span class="ck">✓</span>':''}</button><button class="pop-i ${t.owner==='client'?'on':''}" data-o="client">Client’s action item${t.owner==='client'?'<span class="ck">✓</span>':''}</button></div><div class="pop-row"><input class="inp" placeholder="Who at the client? (optional)" value="${esc(t.assignee || '')}"></div>`, (p, close) => {
      const i = p.querySelector('input');
      p.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { up({ owner: b.dataset.o, assignee: b.dataset.o === 'client' ? i.value.trim() : '' }); close(); });
      i.onkeydown = e => { if(e.key === 'Enter'){ up({ owner: 'client', assignee: i.value.trim() }); close(); } };
    }, { w: 240 });
  }
  if(key === 'repeat'){
    const opts = [['', 'Does not repeat'], ['day:1','Daily'], ['weekday:1','Every weekday'], ['week:1','Weekly'], ['week:2','Every 2 weeks'], ['month:1','Monthly']];
    const cur = t.repeat ? t.repeat.unit + ':' + t.repeat.n : '';
    return popList(el, opts.map(([v, l]) => ({ v, label: l, on: v === cur })), it => { if(!it.v) return up({ repeat: null }); const [unit, n] = it.v.split(':'); up({ repeat: { unit, n: +n }, ...(t.dueDate ? {} : { dueDate: todayKey() }) }); }, { w: 200 });
  }
  if(key === 'prio'){
    const cols = ['var(--muted)', 'var(--accent)', 'var(--client)', 'var(--danger)'];
    return popList(el, [0,1,2,3].map(n => ({ n, html: `<span style="color:${cols[n]};font-weight:700;width:18px;display:inline-block">${n ? '!'.repeat(n) : '–'}</span>${['None','Low','Medium','High'][n]}`, on: (t.priority||0) === n })), it => up({ priority: it.n }), { w: 180 });
  }
  if(key === 'remind'){
    const opts = [['auto', `${S.settings.remindLead} min before`], ['at', 'At due time'], ['60', '1 hour before'], ['none', 'No reminder']];
    return popList(el, opts.map(([v, l]) => ({ v, label: l, on: t.remindMode === v })), it => up({ remindMode: it.v }), { w: 200 });
  }
  if(key === 'tags'){
    return popover(el, `<div class="pop-row"><input class="inp" placeholder="tags, comma separated" value="${esc((t.tags||[]).join(', '))}"></div><div class="muted" style="font-size:11px;padding:2px 4px 0">Enter to save</div>`, (p, close) => {
      const i = p.querySelector('input'); i.focus(); i.setSelectionRange(i.value.length, i.value.length);
      i.onkeydown = e => { if(e.key === 'Enter'){ up({ tags: i.value.split(',').map(s => s.trim().replace(/^#/,'')).filter(Boolean) }); close(); } if(e.key === 'Escape') close(); };
    }, { w: 240 });
  }
  if(key === 'more'){
    return popList(el, Reg.taskActions.map(a => ({ a, label: a.label })), it => { try { it.a.run(clone(S.tasks.find(x => x.id === t.id)), makeApi(it.a.pid)); } catch(e){ toast(e.message); } }, { w: 220 });
  }
  if(key === 'delete'){
    const gone = removeTask(t.id); selTask = null; renderSide(); renderView();
    if(gone) toast(`Deleted “${gone.title}”`, [{ label:'Undo', run: () => { S.tasks.push(gone); save(); render(); } }]);
  }
}
function openTask(id){
  if(selTask === id) return;
  selTask = id; kbId = id; renderView();
  const ti = $('#view .task.open .te-title'); if(ti){ ti.focus({ preventScroll: true }); ti.setSelectionRange(ti.value.length, ti.value.length); }
  const el = $('#view .task.open'); if(el){ const r = el.getBoundingClientRect(); if(r.bottom > innerHeight - 20 || r.top < 0) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  autosize($('#view .task.open .te-notes'));
}
function closeDrawer(){ if(!selTask) return; flushEdit(); selTask = null; closePop(); renderSide(); renderView(); }
function renderDrawer(){}
const autosize = ta => { if(!ta) return; ta.style.height = 'auto'; ta.style.height = Math.min(240, ta.scrollHeight) + 'px'; };
let teTimer = null, tePending = null;
function flushEdit(){ if(tePending){ clearTimeout(teTimer); updateTask(tePending.id, tePending.patch); tePending = null; } }
document.addEventListener('input', e => {
  const f = e.target.dataset && e.target.dataset.tf; if(!f || !selTask) return;
  if(f === 'notes') autosize(e.target);
  tePending = { id: selTask, patch: { ...(tePending && tePending.id === selTask ? tePending.patch : {}), [f]: f === 'title' ? e.target.value : e.target.value } };
  clearTimeout(teTimer); teTimer = setTimeout(flushEdit, 400);
});
document.addEventListener('keydown', e => {
  if(e.target.classList && e.target.classList.contains('te-title') && e.key === 'Enter'){ e.preventDefault(); closeDrawer(); }
}, true);

/* ---------- reminders ---------- */
function checkReminders(){
  const now = Date.now();
  for(const t of S.tasks){
    if(t.done || t.reminded || !t.remindAt || t.remindAt > now) continue;
    t.reminded = true; save();
    const c = client(t.clientId);
    if(!(window.CadenceIsland && enabled('island'))) toast(`🔔 ${t.title}${c ? ' · ' + c.name : ''}${t.dueTime ? ' — due ' + fmtTime(t.dueTime) : ''}`, [
      { label:'Done', run: () => { toggleDone(t.id, true); render(); } },
      { label:'Snooze 10m', run: () => { updateTask(t.id, { remindMode:'custom', remindAt: Date.now() + 600000 }); render(); } },
      { label:'Open', run: () => openTask(t.id) }
    ], { sticky:true, cls:'rem', bottom:true });
    try { if('Notification' in window && Notification.permission === 'granted') new Notification('Cadence', { body: t.title + (c ? ' · ' + c.name : '') }); } catch(e){}
    try { const a = new (window.AudioContext || window.webkitAudioContext)(); const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(.08, a.currentTime); g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + .5); o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + .5); } catch(e){}
    emit('reminder', clone(t));
  }
  const n = S.tasks.filter(t => !t.done && t.reminded && t.remindAt && now - t.remindAt < 36e5).length;
  document.title = (counts().over ? `(${counts().over}) ` : '') + 'Cadence';
}

/* ---------- toasts ---------- */
let lastPointer = { x: innerWidth / 2, y: innerHeight - 60, t: 0, target: null };
document.addEventListener('pointerdown', e => { lastPointer = { x: e.clientX, y: e.clientY, t: Date.now(), target: e.target }; }, true);
let floatStack = 0;
function toast(msg, actions = [], opts = {}){
  // contextual: a toast caused by a click appears as a bubble right where you clicked
  const at = opts.at || (!opts.sticky && !opts.bottom && Date.now() - lastPointer.t < 900 ? lastPointer : null);
  // not caused by a click: let it flow out of the Island at the top, if that plugin is on
  if(!at && window.CadenceIsland && enabled('island')) return window.CadenceIsland.toast(msg, actions, opts);
  if(at){
    const el = document.createElement('div'); el.className = 'ftoast';
    el.innerHTML = `<span>${esc(msg)}</span>` + actions.map((a,i) => `<button data-i="${i}">${esc(a.label)}</button>`).join('');
    const slot = floatStack++; setTimeout(() => floatStack = Math.max(0, floatStack - 1), 2200);
    document.body.appendChild(el);
    const w = el.offsetWidth, h = el.offsetHeight;
    const x = Math.max(10, Math.min(innerWidth - w - 10, at.x - w / 2)), y = Math.max(10, Math.min(innerHeight - h - 10, at.y - h - 22 - slot * (h + 8)));
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return; actions[+b.dataset.i].run(); el.remove(); });
    const life = opts.ms || (actions.length ? 3600 : 2200);
    setTimeout(() => el.classList.add('out'), life);
    setTimeout(() => el.remove(), life + 400);
    return;
  }
  const el = document.createElement('div'); el.className = 'toast ' + (opts.cls || '');

  el.innerHTML = `<span>${esc(msg)}</span>` + actions.map((a,i) => `<button data-i="${i}">${esc(a.label)}</button>`).join('') + (opts.sticky ? '<button data-x>✕</button>' : '');
  el.addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return; if(b.dataset.i) actions[+b.dataset.i].run(); el.remove(); });
  $('#toasts').appendChild(el);
  const all = $$('.toast:not(.rem)'); while(all.length > 3) all.shift().remove();
  if(!opts.sticky) setTimeout(() => el.remove(), opts.ms || 4000);
}
async function copyText(text){
  try { await navigator.clipboard.writeText(text); toast('Copied to clipboard'); return true; }
  catch(e){ openModalHTML('Copy this', `<textarea class="inp" style="min-height:300px" id="copy-fallback">${esc(text)}</textarea>`, ''); setTimeout(() => { const t = $('#copy-fallback'); t && t.select(); }, 30); return false; }
}

/* ---------- popover menu ---------- */
function openMenu(anchor, items){
  closeMenu();
  const m = document.createElement('div'); m.className = 'menu'; m.id = 'menu';
  m.innerHTML = items.map((it, i) => it === '-' ? '<div class="menu-sep"></div>' : `<div class="menu-i ${it.danger?'danger':''}" data-i="${i}">${esc(it.label)}</div>`).join('');
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  m.style.top = (r.bottom + 6) + 'px'; m.style.left = Math.max(8, r.right - m.offsetWidth) + 'px';
  m.addEventListener('click', e => { const it = e.target.closest('.menu-i'); if(!it) return; closeMenu(); items[+it.dataset.i].run(); });
  setTimeout(() => document.addEventListener('click', closeMenu, { once:true }), 0);
}
function closeMenu(){ const m = $('#menu'); if(m) m.remove(); }
function clientMenu(anchor, cid){
  const c = client(cid), api = pid => makeApi(pid);
  const items = Reg.clientActions.filter(x => !x.primary).map(x => ({ label: x.label, run: () => x.run(clone(c), api(x.pid)) }));
  if(items.length) items.push('-');
  items.push({ label: c.status === 'paused' ? '▶  Resume client' : '❚❚  Pause client', run: () => { c.status = c.status === 'paused' ? 'active' : 'paused'; save(); render(); toast(c.status === 'paused' ? `${c.name} paused — find them under Paused in the sidebar` : `${c.name} is active again`); } });
  items.push({ label: '✎  Edit client', run: () => promptClient(cid) });
  if(c.domain) items.push({ label: '↻  Refresh company info', run: () => refreshCompany(cid, { refresh:true }) });
  openMenu(anchor, items);
}

/* ---------- modal & palette ---------- */
function openModalHTML(title, body, foot = '', cls = ''){
  $('#modal').className = 'modal ' + cls;
  $('#modal').innerHTML = (title ? `<div class="modal-h">${title}<span style="margin-left:auto"></span><button class="btn ghost" data-act="close-modal">✕</button></div>` : '') + `<div class="modal-b">${body}</div>` + (foot ? `<div class="modal-f">${foot}</div>` : '');
  $('#scrim').classList.add('open');
}
function closeModal(){ $('#scrim').classList.remove('open'); $('#modal').innerHTML = ''; }
function coreCommands(){
  const cmds = [
    { title:'New task', k:'N', run: () => { closeModal(); const q = $('#qa'); if(q) q.focus(); else { go('inbox'); setTimeout(() => $('#qa') && $('#qa').focus(), 30); } } },
    { title: S.activeMeeting ? 'Resume meeting' : 'Start meeting', k:'M', run: () => { closeModal(); startMeeting(); } },
    { title:'Add client', run: () => promptClient() },
    { title:'Toggle dark mode', run: () => { closeModal(); S.settings.theme = S.settings.theme==='dark'?'light':'dark'; save(); render(); } },
    { title:'Settings & plugins', run: () => openSettings() },
    { title:'Keyboard shortcuts', k:'?', run: () => showShortcuts() },
    { title:'Go to Today', run: () => { closeModal(); go('today'); } },
    { title:'Go to Upcoming', run: () => { closeModal(); go('upcoming'); } },
    { title:'Go to Waiting on clients', run: () => { closeModal(); go('waiting'); } },
    ...S.clients.filter(c => !c.archived).map(c => ({ title:`Open client: ${c.name}`, run: () => { closeModal(); go('client-'+c.id); } })),
    ...S.clients.filter(c => !c.archived).map(c => ({ title:`Start meeting with ${c.name}`, run: () => { closeModal(); startMeeting(c.id); } })),
    ...Reg.commands.map(c => ({ title: c.title, k: c.hint, run: () => { closeModal(); c.run(makeApi(c.pid)); } }))
  ];
  return cmds;
}
function openPalette(){
  const cmds = coreCommands(); let sel = 0, list = cmds;
  $('#modal').className = 'modal pal'; $('#modal').innerHTML = `<input id="pal-in" placeholder="Type a command, client, or task…"><div class="pal-list" id="pal-list"></div>`;
  $('#scrim').classList.add('open');
  const draw = () => {
    const q = $('#pal-in').value.toLowerCase().trim();
    const taskHits = q.length > 1 ? S.tasks.filter(t => !t.done && t.title.toLowerCase().includes(q)).slice(0, 6).map(t => ({ title: '↳ ' + t.title, k: client(t.clientId)?.name, run: () => { closeModal(); if(t.clientId) go('client-'+t.clientId); setTimeout(() => openTask(t.id), 50); } })) : [];
    list = cmds.filter(c => !q || q.split(' ').every(w => c.title.toLowerCase().includes(w))).concat(taskHits).slice(0, 40);
    sel = Math.min(sel, list.length - 1);
    $('#pal-list').innerHTML = list.map((c,i) => `<div class="pal-item ${i===sel?'on':''}" data-i="${i}">${esc(c.title)}${c.k?`<span class="k">${esc(c.k)}</span>`:''}</div>`).join('') || '<div class="muted" style="padding:12px">No matches</div>';
    const on = $('#pal-list .pal-item.on'); if(on) on.scrollIntoView({ block: 'nearest' });
  };
  const inp = $('#pal-in'); draw(); inp.focus();
  inp.addEventListener('input', () => { sel = 0; draw(); });
  inp.addEventListener('keydown', e => {
    if(e.key === 'ArrowDown'){ sel = Math.min(sel+1, list.length-1); draw(); e.preventDefault(); }
    if(e.key === 'ArrowUp'){ sel = Math.max(sel-1, 0); draw(); e.preventDefault(); }
    if(e.key === 'Enter' && list[sel]) list[sel].run();
  });
  $('#pal-list').addEventListener('click', e => { const it = e.target.closest('.pal-item'); if(it) list[+it.dataset.i].run(); });
}
function promptClient(existing){
  const c = existing ? client(existing) : null;
  const draft = { name: c ? c.name : '', domain: c ? (c.domain||'') : '', color: c ? c.color : COLORS[S.clients.length % COLORS.length], status: c ? (c.status||'active') : 'active', info: null, logoV: c ? c.logoV : null };
  openModalHTML(c ? 'Edit client' : 'Add client', `
    <div class="fav-prev"><span id="cl-av"></span><div style="flex:1"><div class="field"><label>Name</label><input class="inp" id="cl-name" value="${esc(draft.name)}" placeholder="Client or project name"></div></div></div>
    <div class="field"><label>Website</label><div class="row"><input class="inp" id="cl-domain" value="${esc(draft.domain)}" placeholder="acme.com — pulls in their logo, industry & description">${Store.server ? `<button class="btn" id="cl-refresh" title="Fetch logo, industry and description from the website">↻ Fetch details</button>` : ''}</div><span class="suggest" id="cl-guess"></span><div class="muted" id="cl-found" style="font-size:12px;margin-top:6px">${Store.server ? '' : 'Logo, industry and description are fetched automatically when Cadence runs on your NAS.'}</div></div>
    <div class="row" style="gap:12px"><div class="field" style="flex:1"><label>Industry</label><select class="inp" id="cl-ind"><option value="">—</option>${Object.entries(INDUSTRY).map(([k,v]) => `<option value="${k}" ${c && c.industry===k?'selected':''}>${v.icon}  ${esc(v.label)}</option>`).join('')}</select></div></div>
    <div class="field"><label>About</label><textarea class="inp" id="cl-desc" style="min-height:56px" placeholder="What they do, in a sentence">${esc(c ? c.description || '' : '')}</textarea></div>
    <div class="field"><label>Status</label><div class="seg" id="cl-status"><button data-v="active" class="${draft.status!=='paused'?'on':''}">Active</button><button data-v="paused" class="${draft.status==='paused'?'on':''}">Paused</button></div><div class="muted" style="font-size:12px;margin-top:6px">Paused clients move to a collapsed section in the sidebar. Their tasks stay visible.</div></div>
    <div class="field"><label>Color <span style="text-transform:none;letter-spacing:0;font-weight:400">— used when there's no logo</span></label><div class="swatches" id="cl-sw">${COLORS.map(col => `<button style="background:${col}" data-col="${col}" class="${draft.color===col?'on':''}"></button>`).join('')}</div></div>`,
    (c ? `<button class="btn ghost danger" data-act="archive-client" data-cid="${c.id}" style="margin-right:auto">${c.archived?'Unarchive':'Archive'}</button>` : '') + `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="save-client" data-cid="${c ? c.id : ''}">${c ? 'Save' : 'Add client'}</button>`);
  const refresh = () => {
    draft.name = $('#cl-name').value; draft.domain = $('#cl-domain').value;
    $('#cl-av').innerHTML = avatar({ name: draft.name || '?', color: draft.color, domain: cleanDomain(draft.domain), logoV: draft.logoV }, 52);
    const g = guessDomain(draft.name), gl = $('#cl-guess');
    gl.textContent = !draft.domain.trim() && g ? `Try ${g}?` : ''; gl.dataset.v = g;
  };
  let t; const later = () => { clearTimeout(t); t = setTimeout(refresh, 300); };
  $('#cl-name').addEventListener('input', later); $('#cl-domain').addEventListener('input', later);
  $('#cl-guess').addEventListener('click', e => { $('#cl-domain').value = e.target.dataset.v; refresh(); });
  const rb = $('#cl-refresh');
  if(rb) rb.addEventListener('click', async () => {
    const d = cleanDomain($('#cl-domain').value); if(!d){ toast('Enter a website first'); return; }
    rb.disabled = true; rb.textContent = 'Fetching…'; $('#cl-found').textContent = `Reading ${d}…`;
    try {
      const info = await fetchCompany(d, true); draft.info = info; draft.logoV = info.fetchedAt;
      if(info.industry) $('#cl-ind').value = info.industry;
      if(info.description) $('#cl-desc').value = info.description;
      if(!$('#cl-name').value.trim() && info.name) $('#cl-name').value = info.name;
      const bits = [info.industry && INDUSTRY[info.industry] ? INDUSTRY[info.industry].icon + ' ' + INDUSTRY[info.industry].label : null, info.hasLogo ? 'logo' : null, info.hasBanner ? 'banner image' : null, info.description ? 'description' : null].filter(Boolean);
      $('#cl-found').textContent = info.ok ? (bits.length ? 'Found: ' + bits.join(' · ') : 'Reached the site but found nothing useful.') : `Couldn’t reach ${d}.`;
      refresh();
    } catch(e){ $('#cl-found').textContent = 'Lookup failed: ' + e.message; }
    rb.disabled = false; rb.textContent = '↻ Fetch details';
  });
  window._clDraft = draft;
  $('#cl-sw').addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return; $$('#cl-sw button').forEach(x => x.classList.toggle('on', x === b)); draft.color = b.dataset.col; refresh(); });
  $('#cl-status').addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return; $$('#cl-status button').forEach(x => x.classList.toggle('on', x === b)); });
  [$('#cl-name'), $('#cl-domain')].forEach(i => i.addEventListener('keydown', e => { if(e.key === 'Enter') $('[data-act=save-client]').click(); }));
  refresh(); setTimeout(() => (c ? $('#cl-domain') : $('#cl-name')).focus(), 20);
}

/* ---------- settings ---------- */
let settingsTab = 'general';
const plugUI = { q:'', cat:'All', open:null };
const PLUG_CATS = ['Meetings','Clients','Productivity','Look & feel','Fun','Integrations','System','Other'];
/* plugin icon: SVG markup (inner paths or a full <svg>), an image URL, or an emoji — on a tile in the plugin's colour */
function plugIcon(d, size = 36){
  const col = d.color || COLORS[Math.abs([...String(d.id)].reduce((a, ch) => a * 31 + ch.charCodeAt(0) | 0, 7)) % COLORS.length];
  const ic = String(d.icon || '');
  const inner = !ic ? `<b>${esc((d.name || d.id || '?').trim()[0].toUpperCase())}</b>`
    : /^(https?:|data:image)/.test(ic) ? `<img src="${esc(ic)}" alt="">`
    : ic.trim().startsWith('<svg') ? ic
    : ic.trim().startsWith('<') ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ic}</svg>`
    : `<span>${esc(ic)}</span>`;
  return `<span class="pl-ic" style="--pc:${esc(col)};width:${size}px;height:${size}px;border-radius:${Math.round(size*.28)}px">${inner}</span>`;
}
function openSettings(tab){
  if(tab) settingsTab = tab;
  const tabs = [['general','General'],['plugins','Plugins'],['dev','Developer'],['data','Data']];
  let body = `<div class="tabs">${tabs.map(([k,l]) => `<button class="${settingsTab===k?'on':''}" data-act="set-tab" data-tab="${k}">${l}</button>`).join('')}</div>`;
  if(settingsTab === 'general'){
    body += `<div class="field"><label>Your name</label><input class="inp" id="st-name" value="${esc(S.settings.myName)}" placeholder="Used to tell your action items apart in Fireflies notes"></div>
      <div class="field"><label>Default reminder</label><select class="inp" id="st-lead">${[0,5,10,15,30,60].map(n => `<option value="${n}" ${S.settings.remindLead==n?'selected':''}>${n ? n + ' minutes before due time' : 'At due time'}</option>`).join('')}</select></div>
      <div class="field"><label>Desktop notifications</label><button class="btn" data-act="notif">${('Notification' in window && Notification.permission==='granted') ? '✓ Enabled' : 'Enable notifications'}</button><div class="muted" style="font-size:12px;margin-top:6px">Reminders always appear in-app with a chime. Keep Cadence open in a tab or pinned window.</div></div>
      <div class="field"><label>Theme</label><div class="seg"><button data-act="set-theme" data-v="light" class="${S.settings.theme==='light'?'on':''}">Light</button><button data-act="set-theme" data-v="dark" class="${S.settings.theme==='dark'?'on':''}">Dark</button></div></div>
      <div class="field"><label>Motion</label><div class="row" style="align-items:center"><select class="inp" id="set-motion" style="width:auto">${[['auto','Match system'],['reduce','Reduced'],['full','Full']].map(([v,l]) => `<option value="${v}" ${(S.settings.motion||'auto')===v?'selected':''}>${l}</option>`).join('')}</select><span class="muted" style="font-size:12px">Reduced turns off damage numbers, confetti, springs and the living garden.</span></div></div>`;
  } else if(settingsTab === 'plugins'){
    const cats = [...new Set(Reg.defs.map(d => d.category || 'Other'))].sort((a, b) => PLUG_CATS.indexOf(a) - PLUG_CATS.indexOf(b));
    const q = (plugUI.q || '').toLowerCase(), cat = plugUI.cat || 'All';
    const list = Reg.defs.filter(d => (cat === 'All' || (d.category || 'Other') === cat) && (!q || [d.name, d.id, d.tagline, d.description].join(' ').toLowerCase().includes(q)));
    const on = Reg.defs.filter(d => enabled(d.id)).length;
    body += `<div class="pl-bar"><input class="inp" id="pl-q" placeholder="Search ${Reg.defs.length} plugins…" value="${esc(plugUI.q || '')}"><span class="muted" style="font-size:12px;white-space:nowrap">${on} on</span></div>
      <div class="pl-cats">${['All', ...cats].map(c => `<button class="${c === cat ? 'on' : ''}" data-act="pl-cat" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="pl-grid">${list.map(d => { const open = plugUI.open === d.id;
        return `<div class="pl-card ${enabled(d.id) ? '' : 'off'} ${open ? 'open' : ''}" data-act="pl-open" data-pid="${esc(d.id)}">
          <div class="pl-top">${plugIcon(d, 36)}<div class="pl-tx"><b>${esc(d.name || d.id)}</b><span>${esc(d.tagline || d.description || '')}</span></div><button class="switch sm ${enabled(d.id)?'on':''}" data-act="toggle-plugin" data-pid="${esc(d.id)}" aria-label="Turn ${esc(d.name || d.id)} ${enabled(d.id) ? 'off' : 'on'}"></button></div>
          ${open ? `<div class="pl-more"><p>${esc(d.description || '')}</p><div class="pl-meta"><span>v${esc(d.version || '1.0')}</span><span>${d.userCode ? 'Installed by you' : 'Built-in'}</span>${(d.category) ? `<span>${esc(d.category)}</span>` : ''}${d.settings && enabled(d.id) ? `<button class="btn" data-act="pl-settings" data-pid="${esc(d.id)}">Settings</button>` : ''}${d.userCode ? `<button class="btn ghost danger" data-act="remove-plugin" data-pid="${esc(d.id)}">Remove</button>` : ''}</div></div>` : ''}
        </div>`; }).join('') || '<div class="muted" style="padding:20px 0;font-size:13px">No plugins match.</div>'}</div>`;
  } else if(settingsTab === 'dev'){
    body += `<p class="muted" style="margin:0">Everything beyond the core — Fireflies import, AI extraction, recap emails, Client Pulse — is a plugin built on this API. Write your own:</p>
<pre class="code">Cadence.registerPlugin({
  id: 'zoho-desk-link', name: 'Zoho Desk links', version: '1.0.0',
  description: 'Adds an "Open in Desk" action to tasks',
  setup(api) {
    // react to events: task:add task:update task:complete task:reopen
    //   task:remove client:add meeting:start meeting:end reminder  '*'
    api.on('task:complete', t =&gt; console.log('done', t.title));

    // command palette entries (⌘K)
    api.commands.add({ title: 'Plan my week', run: api =&gt; { ... } });

    // sidebar views
    api.views.add({ id: 'week', title: 'This week', icon: '▦',
      render: (el, api) =&gt; { el.innerHTML = '...'; } });

    // quick-add syntax: return the remaining text
    api.parsers.add((text, result) =&gt;
      text.replace(/\\s~(\\d+)h(?=\\s)/, (m, h) =&gt; (result.estimate = +h, ' ')));

    // meeting-notes extractors: text -&gt; [{title, owner, assignee, dueDate}]
    api.extractors.add({ id: 'otter', name: 'Otter.ai', run: async (text, ctx) =&gt; [] });

    // buttons in the task drawer / meeting review screen
    api.taskActions.add({ label: 'Open in Desk', run: (task, api) =&gt; { } });
    api.meetingActions.add({ label: 'Post to Cliq', run: (meeting, items, api) =&gt; { } });

    // also: api.tasks.{list,get,add,update,complete,remove,quickAdd}
    //       api.clients.{list,get,add}  api.meetings.{list,active,start}
    //       api.storage.{get,set}  api.ui.{toast,navigate,copy,modal,close}
    //       api.ai (Claude, or null)  api.util.{parse,ymd,fmtDate,...}
  }
});</pre>
      <div class="field"><label>Install a plugin from code</label><textarea class="inp" id="dev-code" style="min-height:140px;font-family:var(--mono);font-size:12px" placeholder="Paste a Cadence.registerPlugin({...}) call"></textarea><div class="row" style="margin-top:8px"><button class="btn primary" data-act="dev-install">Install</button></div></div>`;
  } else {
    const oldDone = S.tasks.filter(t => t.done && t.doneAt < Date.now() - 30*864e5).length;
    body += `<div class="field"><label>Storage</label><div class="muted">${Store.status==='synced' ? (Store.server ? 'Saved on your Cadence server (NAS), with daily backups — shared by every device that opens it.' : 'Synced to your Claude account — available on any device where you open Cadence.') : 'Saved in this browser only.'} ${S.tasks.length} tasks · ${S.clients.length} clients · ${S.meetings.length} meetings.</div></div>
      <div class="field"><label>Demo mode</label><div class="row" style="align-items:center">${DEMO ? `<button class="btn" data-act="demo-reset">↺ Reset demo data</button><button class="btn primary" data-act="demo-exit">Exit demo</button>` : `<button class="btn" data-act="demo-open">Open demo in a new tab ↗</button>`}<span class="muted" style="font-size:12px">${DEMO ? 'You’re looking at fake data. Nothing here is saved to your NAS.' : 'Fake clients, tasks, meetings and calendar to play with — your real data isn’t touched.'}</span></div></div>
      <div class="field"><label>Backup</label><div class="row"><button class="btn" data-act="export">Copy backup (JSON)</button><button class="btn" data-act="import-open">Restore from backup…</button></div></div>
      <div class="field"><label>Housekeeping</label><button class="btn" data-act="purge" ${oldDone?'':'disabled'}>Delete ${oldDone} tasks completed 30+ days ago</button></div>`;
  }
  openModalHTML('Settings', body, '', 'wide');
  const pq = $('#pl-q'); if(pq) pq.addEventListener('input', () => { plugUI.q = pq.value; clearTimeout(plugUI.t); plugUI.t = setTimeout(() => { const pos = pq.selectionStart; openSettings(); const n = $('#pl-q'); if(n){ n.focus(); n.setSelectionRange(pos, pos); } }, 140); });
  const mo = $('#set-motion'); if(mo) mo.addEventListener('change', () => { S.settings.motion = mo.value; save(); render(); });
  const n = $('#st-name'); if(n) n.addEventListener('change', () => { S.settings.myName = n.value.trim(); save(); render(); });
  const l = $('#st-lead'); if(l) l.addEventListener('change', () => { S.settings.remindLead = +l.value; S.tasks.forEach(t => { if(t.remindMode==='auto' && !t.done){ t.remindAt = computeRemind(t); } }); save(); });
}

/* =========================================================
   Meeting mode
   ========================================================= */
let mTimer = null, notesTimer = null;
function startMeeting(cid, notes){
  closeModal();
  if(!S.activeMeeting){
    const r = route();
    cid = cid || (r.startsWith('client-') ? r.slice(7) : null);
    S.activeMeeting = { id: uid('m'), clientId: cid, start: Date.now(), items: [], notes: notes || '', phase: 'live', nextOwner: 'me' };
    save(); emit('meeting:start', clone(S.activeMeeting));
  }
  $('#meeting').classList.add('open'); renderMeeting();
  clearInterval(mTimer); mTimer = setInterval(() => { const el = $('#m-timer'); if(el && S.activeMeeting) el.textContent = elapsed(S.activeMeeting.start); }, 1000);
}
const elapsed = s => { const sec = Math.floor((Date.now() - s)/1000); return `${Math.floor(sec/3600) ? Math.floor(sec/3600)+':' : ''}${pad(Math.floor(sec/60)%60)}:${pad(sec%60)}`; };
function hideMeeting(){ $('#meeting').classList.remove('open'); clearInterval(mTimer); render(); }
function addMeetingItem(text){
  const M = S.activeMeeting; let owner = M.nextOwner;
  let txt = text.trim();
  const pm = txt.match(/^(me|i|c|client|they|them)\s*[:>]\s*/i); if(pm){ owner = /^(me|i)$/i.test(pm[1]) ? 'me' : 'client'; txt = txt.slice(pm[0].length); }
  const r = parseQuick(txt, { clientId: M.clientId, owner });
  if(!r.title) return;
  M.items.push({ id: uid('i'), title: capFirst(r.title), owner: r.owner, assignee: r.assignee, dueDate: r.dueDate, dueTime: r.dueTime, priority: r.priority, tags: r.tags, repeat: r.repeat, include: true });
  save();
}
function renderMeeting(){
  const M = S.activeMeeting, el = $('#meeting'); if(!M){ hideMeeting(); return; }
  const c = client(M.clientId);
  const clientSel = `<select class="inp" id="m-client" style="width:auto;min-width:180px"><option value="">No client</option>${S.clients.filter(x=>!x.archived).map(x => `<option value="${x.id}" ${x.id===M.clientId?'selected':''}>${esc(x.name)}</option>`).join('')}</select>`;
  const item = i => `<div class="m-item" data-iid="${i.id}"><span class="tt" contenteditable="true" spellcheck="false">${esc(i.title)}</span>${i.dueDate ? `<span class="chip due">${esc(dueLabel(i))}</span>` : ''}${i.assignee ? `<span class="chip client-owned">${esc(i.assignee)}</span>` : ''}<button class="sw" data-act="m-swap" title="Move to other side">⇄</button><button class="x" data-act="m-del" title="Remove">×</button></div>`;
  if(M.phase === 'live'){
    const mine = M.items.filter(i => i.owner === 'me'), theirs = M.items.filter(i => i.owner === 'client');
    el.innerHTML = `<div class="m-head"><span class="live"><i></i>Live</span>${clientSel}<span class="timer" id="m-timer">${elapsed(M.start)}</span><span style="margin-left:auto"></span>
        <button class="btn" data-act="m-import">⇣ Import notes (Fireflies)</button><button class="btn ghost" data-act="m-hide" title="Keep meeting running in background">Minimize</button><button class="btn primary" data-act="m-review">End &amp; review ${M.items.length ? `(${M.items.length})` : ''}</button></div>
      <div class="m-body"><div class="m-main">
        <div class="m-cols"><div class="m-col me"><h3>On me <span class="muted">${mine.length}</span></h3>${mine.map(item).join('') || '<div class="muted" style="font-size:13px">Your action items land here.</div>'}</div>
          <div class="m-col cl"><h3>On ${esc(c ? c.name : 'client')} <span class="muted">${theirs.length}</span></h3>${theirs.map(item).join('') || '<div class="muted" style="font-size:13px">Things the client owes you land here.</div>'}</div></div>
        <div class="m-input"><div class="qa"><div class="qa-row"><span class="owner-pill ${M.nextOwner}" data-act="m-owner" style="cursor:pointer" title="Tab to switch">${M.nextOwner==='me'?'Me':(c?esc(c.name):'Client')}</span><input id="m-in" autocomplete="off" placeholder="Type an action item and hit Enter…  “fri”, “^Sarah”, “c: send logins”"><span class="hint"><kbd>Tab</kbd> switch owner · <kbd>Enter</kbd> add</span></div><div class="qa-chips" id="m-chips"></div></div></div>
      </div>
      <div class="m-side"><div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Notes</div><textarea id="m-notes" placeholder="Free-form notes, decisions, context…">${esc(M.notes)}</textarea><div class="muted" style="font-size:12px">Notes are saved with the meeting in the client’s log.</div></div></div>`;
    const inp = $('#m-in'); inp.focus();
    inp.addEventListener('keydown', e => {
      if(e.key === 'Tab'){ e.preventDefault(); M.nextOwner = M.nextOwner === 'me' ? 'client' : 'me'; save(); const p = $('[data-act=m-owner]'); p.className = 'owner-pill ' + M.nextOwner; p.textContent = M.nextOwner==='me' ? 'Me' : (c ? c.name : 'Client'); }
      if(e.key === 'Enter' && inp.value.trim()){ addMeetingItem(inp.value); renderMeeting(); }
      if(e.key === 'Escape') inp.blur();
    });
    inp.addEventListener('input', () => { const r = parseQuick(inp.value.replace(/^(me|i|c|client|they|them)\s*[:>]\s*/i,''), { clientId: M.clientId }); delete r.clientId; $('#m-chips').innerHTML = inp.value.trim() ? parseChips({...r, owner:'me'}) : ''; });
    $('#m-notes').addEventListener('input', e => { M.notes = e.target.value; clearTimeout(notesTimer); notesTimer = setTimeout(save, 500); });
  } else {
    const inc = M.items.filter(i => i.include).length;
    el.innerHTML = `<div class="m-head"><b style="font-size:15px">Review action items</b>${clientSel}<span class="muted">${elapsed(M.start)} meeting</span><span style="margin-left:auto"></span><button class="btn ghost" data-act="m-back">← Back to meeting</button><button class="btn ghost danger" data-act="m-discard">Discard</button></div>
      <div style="flex:1;overflow:auto"><div class="wrap" style="padding-top:28px">
        <p class="muted" style="margin-top:0">Tidy up titles and due dates, then create the tasks. Client items go to <b>Waiting on clients</b> so you can chase them.</p>
        ${['me','client'].map(o => { const list = M.items.filter(i => i.owner === o); return `<div class="group"><div class="group-h ${o==='client'?'client':''}">${o==='me'?'On me':'On '+esc(c?c.name:'client')}<span class="c">${list.length}</span></div>${list.map(i => `<div class="rv-item" data-iid="${i.id}"><input type="checkbox" data-rv="include" ${i.include?'checked':''}><input type="text" data-rv="title" value="${esc(i.title)}"><input type="date" data-rv="dueDate" value="${i.dueDate||''}"><button class="sw btn ghost" data-act="m-swap" title="Switch owner">⇄</button></div>`).join('') || '<div class="muted" style="padding:8px 0">None</div>'}</div>`; }).join('')}
        <div class="row" style="gap:6px;margin:-8px 0 20px"><span class="muted" style="font-size:12px;align-self:center">Set due for all client items:</span>${[['+2d',2],['+1w',7]].map(([l,n]) => `<button class="btn" data-act="m-bulkdue" data-n="${n}">${l}</button>`).join('')}</div>
      </div></div>
      <div class="m-input" style="display:flex;gap:8px;justify-content:flex-end;align-items:center;flex-wrap:wrap">${Reg.meetingActions.map((a,i) => `<button class="btn" data-act="m-action" data-i="${i}">${esc(a.label)}</button>`).join('')}<button class="btn primary" data-act="m-commit" ${inc?'':'disabled'}>Create ${inc} task${inc===1?'':'s'} &amp; finish</button></div>`;
    $$('[data-rv]', el).forEach(inp => inp.addEventListener('change', () => { const it = M.items.find(x => x.id === inp.closest('.rv-item').dataset.iid); const k = inp.dataset.rv; it[k] = inp.type === 'checkbox' ? inp.checked : (inp.value || null); save(); if(k==='include') renderMeeting(); }));
  }
  $('#m-client').addEventListener('change', e => { M.clientId = e.target.value || null; save(); renderMeeting(); });
  $$('.m-item .tt', el).forEach(t => t.addEventListener('blur', () => { const it = M.items.find(x => x.id === t.closest('.m-item').dataset.iid); if(it){ it.title = t.textContent.trim() || it.title; save(); } }));
}
function commitMeeting(){
  const M = S.activeMeeting; if(!M) return;
  const items = M.items.filter(i => i.include && i.title);
  const ids = items.map(i => addTask({ title: i.title, clientId: M.clientId, owner: i.owner, assignee: i.assignee || '', dueDate: i.dueDate, dueTime: i.dueTime, priority: i.priority || 0, tags: i.tags || [], repeat: i.repeat || null, meetingId: M.id }).id);
  const rec = { id: M.id, clientId: M.clientId, start: M.start, end: Date.now(), notes: M.notes, itemIds: ids };
  S.meetings.push(rec); S.activeMeeting = null; save();
  emit('meeting:end', { meeting: clone(rec), items: clone(items) });
  hideMeeting(); if(M.clientId) go('client-' + M.clientId);
  toast(`Meeting saved · ${ids.length} task${ids.length===1?'':'s'} created`);
}
function openImport(){
  const ex = Reg.extractors.filter(e => !e.available || e.available());
  openModalHTML('Import meeting notes', `<p class="muted" style="margin:0">Paste a Fireflies summary, transcript, or any notes. Action items are split into <b>yours</b> and the <b>client’s</b>${S.settings.myName ? ` (matching “${esc(S.settings.myName)}” as you)` : ' — set your name in Settings so Cadence can tell them apart'}.</p>
    <textarea class="inp" id="imp-text" style="min-height:240px" placeholder="Action Items&#10;&#10;**Alex Chen**&#10;Send revised Zoho CRM blueprint by Friday (12:41)&#10;&#10;**Sarah Lee**&#10;Share API credentials for Books integration (18:02)"></textarea>
    <div class="row"><select class="inp" id="imp-ex" style="width:auto">${ex.map(e => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('')}</select><label class="row muted" style="align-items:center;gap:6px;font-size:13px"><input type="checkbox" id="imp-notes" checked> Also add to meeting notes</label></div>`,
    `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="imp-run">Extract action items</button>`);
  setTimeout(() => $('#imp-text').focus(), 30);
}
async function runImport(){
  const text = $('#imp-text').value.trim(); if(!text) return;
  const ex = Reg.extractors.find(e => e.id === $('#imp-ex').value); if(!ex) return;
  const btn = $('[data-act=imp-run]'); btn.disabled = true; btn.textContent = 'Extracting…';
  const M = S.activeMeeting, c = client(M.clientId);
  const j = job('extract', ex.id === 'ai' ? 'Claude is reading your notes' : 'Extracting action items', { sub: `${text.split(/\s+/).length.toLocaleString()} words${c ? ' · ' + c.name : ''}` });
  try {
    const items = await ex.run(text, { myName: S.settings.myName, clientName: c ? c.name : '', today: todayKey() }, makeApi(ex.pid));
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

/* =========================================================
   Global events
   ========================================================= */
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]');
  const taskEl = e.target.closest('.task');
  const gl = e.target.closest('.gl');
  if(gl){ if(gl.dataset.task){ openTask(gl.dataset.task); return; } const g = gl.dataset.go; if(g && g.startsWith('#')){ const el = $(g); el && el.scrollIntoView({ behavior:'smooth', block:'start' }); } else if(g && g !== route()) go(g); return; }
  const tc = e.target.closest('[data-te]');
  if(tc && taskEl){ const t = S.tasks.find(x => x.id === taskEl.dataset.id); if(t) editChip(t, tc.dataset.te, tc); return; }
  if(selTask && !e.target.closest('.task.open, .pop, .dp, .modal, .menu, .ftoast, .isl, .toast')) closeDrawer();
  if(!a && taskEl){ openTask(taskEl.dataset.id); return; }
  if(e.target.id === 'scrim'){ closeModal(); return; }
  const sg = e.target.closest('[data-seg]');
  if(sg && selTask){ const f = sg.dataset.seg; updateTask(selTask, { [f]: f === 'priority' ? +sg.dataset.v : sg.dataset.v }); render(); return; }
  if(!a) return;
  const act = a.dataset.act, M = S.activeMeeting;
  switch(act){
    case 'toggle': {
      const id = taskEl.dataset.id, t = S.tasks.find(x => x.id === id);
      toggleDone(id);
      if(t.done && route() !== 'done'){ taskEl.classList.add('done','leaving'); setTimeout(() => { renderSide(); renderView(); }, 420); toast(`Completed “${t.title}”`, [{ label:'Undo', run: () => { toggleDone(id, false); render(); } }]); }
      else { renderSide(); renderView(); }
      if(selTask === id) renderDrawer();
      break; }
    case 'add-client': promptClient(); break;
    case 'edit-client': promptClient(a.dataset.cid); break;
    case 'save-client': {
      const name = $('#cl-name').value.trim(), col = ($('#cl-sw .on') || {}).dataset?.col, raw = $('#cl-domain').value.trim(), dom = cleanDomain(raw), status = ($('#cl-status .on') || {}).dataset?.v || 'active'; if(!name) return;
      if(raw && !dom){ toast('That website doesn’t look right — try something like acme.com'); return; }
      const ind = $('#cl-ind').value, desc = $('#cl-desc').value.trim(), dr = window._clDraft || {};
      const finish = (c, domainChanged) => {
        if(dr.info) applyCompany(c, dr.info, true);
        if(ind !== (c.industry || '')) c.industryManual = !!ind; c.industry = ind || '';
        if(desc !== (c.description || '')) c.descManual = !!desc; c.description = desc;
        save(); if(domainChanged && !dr.info && c.domain) refreshCompany(c.id, { quiet:true });
      };
      if(a.dataset.cid){ const c = client(a.dataset.cid), changed = c.domain !== dom; Object.assign(c, { name, color: col || c.color, domain: dom, status }); if(changed){ c.hasBanner = false; } finish(c, changed); }
      else { const c = addClient(name, col, dr.info ? '' : dom); c.domain = dom; c.status = status; finish(c, !dr.info); closeModal(); go('client-' + c.id); return; }
      closeModal(); render(); break; }
    case 'pause-client': { const c = client(a.dataset.cid); c.status = c.status === 'paused' ? 'active' : 'paused'; save(); render(); toast(c.status === 'paused' ? `${c.name} paused — find them under Paused in the sidebar` : `${c.name} is active again`); break; }
    case 'toggle-paused': showPaused = !showPaused; renderSide(); break;
    case 'archive-client': { const c = client(a.dataset.cid); c.archived = !c.archived; save(); closeModal(); go('today'); break; }
    case 'ob-add': { const v = $('#ob-clients').value; v.split(',').forEach(n => addClient(n)); render(); toast('Clients added — they’re in the sidebar'); break; }
    case 'meeting': startMeeting(a.dataset.cid); break;
    case 'remove-plugin': { const d = Reg.defs.find(x => x.id === a.dataset.pid); if(!d || !d.userCode) break; S.userPlugins = S.userPlugins.filter(c => c !== d.userCode); Reg.defs = Reg.defs.filter(x => x !== d); save(); rebuildPlugins(); render(); toast(`Removed ${d.name || d.id}`); openSettings('plugins'); break; }
    case 'pl-cat': plugUI.cat = a.dataset.c; openSettings(); break;
    case 'pl-open': if(e.target.closest('button')) break; plugUI.open = plugUI.open === a.dataset.pid ? null : a.dataset.pid; openSettings(); break;
    case 'pl-settings': { const d = Reg.defs.find(x => x.id === a.dataset.pid); if(d && d.settings){ closeModal(); setTimeout(() => d.settings(makeApi(d.id)), 60); } break; }
    case 'ins-tab': S.settings.insightsTab = a.dataset.id; persistLocal(); render(); break;
    case 'demo-open': window.open(location.pathname + '?demo=1' + location.hash, '_blank'); break;
    case 'demo-reset': resetDemo(); break;
    case 'demo-exit': exitDemo(); break;
    case 'theme': S.settings.theme = S.settings.theme === 'dark' ? 'light' : 'dark'; save(); render(); break;
    case 'settings': openSettings(); break;
    case 'set-tab': openSettings(a.dataset.tab); break;
    case 'set-theme': S.settings.theme = a.dataset.v; save(); render(); openSettings(); break;
    case 'notif': try { Notification.requestPermission().then(p => { toast(p === 'granted' ? 'Desktop notifications on' : 'Notifications blocked here — in-app reminders still work'); openSettings(); }).catch(() => toast('Notifications aren’t available in this window — in-app reminders still work')); } catch(err){ toast('Notifications aren’t available in this window — in-app reminders still work'); } break;
    case 'toggle-plugin': { const p = a.dataset.pid; S.disabled = enabled(p) ? [...S.disabled, p] : S.disabled.filter(x => x !== p); save(); rebuildPlugins(); render(); openSettings(); break; }
    case 'dev-install': {
      const code = $('#dev-code').value.trim(); if(!code) return;
      try { loadingUser = code; try { new Function('Cadence', code)(window.Cadence); } finally { loadingUser = null; } S.userPlugins = [...S.userPlugins, code]; save(); toast('Plugin installed'); openSettings('plugins'); }
      catch(err){ toast(/eval|unsafe|Content Security/i.test(String(err)) ? 'This host blocks running pasted code. Plugins can be added in the app source instead.' : 'Plugin error: ' + err.message); }
      break; }
    case 'export': copyText(JSON.stringify(S, null, 2)); break;
    case 'import-open': openModalHTML('Restore from backup', `<p class="muted" style="margin:0">This replaces everything currently in Cadence.</p><textarea class="inp" id="imp-json" style="min-height:260px;font-family:var(--mono);font-size:12px" placeholder="Paste backup JSON"></textarea>`, `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="import-run">Restore</button>`); break;
    case 'import-run': try { const d = JSON.parse($('#imp-json').value); if(!Array.isArray(d.tasks)) throw new Error('Not a Cadence backup'); S = Object.assign(blank(), d); save(); rebuildPlugins(); closeModal(); render(); toast('Backup restored'); } catch(err){ toast('Could not restore: ' + err.message); } break;
    case 'purge': { const cut = Date.now() - 30*864e5; const n = S.tasks.length; S.tasks = S.tasks.filter(t => !(t.done && t.doneAt < cut)); save(); toast(`Deleted ${n - S.tasks.length} old tasks`); openSettings(); render(); break; }
    case 'close-modal': closeModal(); break;
    case 'close-drawer': closeDrawer(); break;
    case 'dr-toggle': toggleDone(selTask); render(); break;
    case 'dr-delete': { const t = removeTask(selTask); closeDrawer(); render(); if(t) toast(`Deleted “${t.title}”`, [{ label:'Undo', run: () => { S.tasks.push(t); save(); render(); } }]); break; }
    case 'task-action': { const ac = Reg.taskActions[+a.dataset.i]; const t = S.tasks.find(x => x.id === selTask); try { ac.run(clone(t), makeApi(ac.pid)); } catch(err){ toast(err.message); } break; }
    case 'm-owner': { M.nextOwner = M.nextOwner === 'me' ? 'client' : 'me'; save(); renderMeeting(); break; }
    case 'm-del': { M.items = M.items.filter(i => i.id !== a.closest('[data-iid]').dataset.iid); save(); renderMeeting(); break; }
    case 'm-swap': { const it = M.items.find(i => i.id === a.closest('[data-iid]').dataset.iid); it.owner = it.owner === 'me' ? 'client' : 'me'; save(); renderMeeting(); break; }
    case 'm-hide': hideMeeting(); toast('Meeting still running — resume from the sidebar'); break;
    case 'm-review': M.phase = 'review'; save(); renderMeeting(); break;
    case 'm-back': M.phase = 'live'; save(); renderMeeting(); break;
    case 'm-discard': openModalHTML('Discard meeting?', `<p style="margin:0">All ${M.items.length} captured items and notes will be lost.</p>`, `<button class="btn" data-act="close-modal">Keep</button><button class="btn primary" style="background:var(--danger);border-color:var(--danger)" data-act="m-discard-yes">Discard</button>`); break;
    case 'm-discard-yes': S.activeMeeting = null; save(); closeModal(); hideMeeting(); break;
    case 'm-bulkdue': { const d = ymd(addDays(new Date(), +a.dataset.n)); M.items.filter(i => i.owner === 'client').forEach(i => i.dueDate = d); save(); renderMeeting(); break; }
    case 'm-commit': commitMeeting(); break;
    case 'm-import': openImport(); break;
    case 'imp-run': runImport(); break;
    case 'mlog-action': {
      const ac = Reg.meetingActions[+a.dataset.i], m = S.meetings.find(x => x.id === a.dataset.mid); if(!ac || !m) break;
      const items = m.itemIds.map(id => S.tasks.find(t => t.id === id)).filter(Boolean).map(t => ({ title:t.title, owner:t.owner, assignee:t.assignee, dueDate:t.dueDate, dueTime:t.dueTime, done:t.done }));
      try { ac.run(clone(m), items, makeApi(ac.pid)); } catch(err){ toast(err.message); } break; }
    case 'pb-template': window.CadenceTemplates && window.CadenceTemplates.apply(client(a.dataset.cid), a.dataset.tpl); break;
    case 'client-menu': e.stopPropagation(); clientMenu(a, a.dataset.cid); break;
    case 'client-action': { const ac = Reg.clientActions[+a.dataset.i]; try { ac.run(clone(client(a.dataset.cid)), makeApi(ac.pid)); } catch(err){ toast(err.message); } break; }
    case 'shortcuts': showShortcuts(); break;
    case 'client-update': { const cmd = Reg.commands.find(c => c.pid === 'recap' && /Status update/.test(c.title)); if(cmd) cmd.run(makeApi('recap')); break; }
    case 'm-action': { const ac = Reg.meetingActions[+a.dataset.i]; try { ac.run(clone(M), clone(M.items.filter(i => i.include)), makeApi(ac.pid)); } catch(err){ toast(err.message); } break; }
  }
});
/* ---------- keyboard navigation ---------- */
let kbId = null;
const visibleTasks = () => $$('#view .task');
function applyKb(){
  const els = visibleTasks(); els.forEach(el => el.classList.toggle('kb', el.dataset.id === kbId));
  if(kbId && !els.some(el => el.dataset.id === kbId)) kbId = null;
}
function moveKb(dir){
  const els = visibleTasks(); if(!els.length) return;
  let i = els.findIndex(el => el.dataset.id === kbId);
  i = i < 0 ? (dir > 0 ? 0 : els.length - 1) : Math.max(0, Math.min(els.length - 1, i + dir));
  kbId = els[i].dataset.id; applyKb();
  els[i].scrollIntoView({ block:'nearest' });
  if(selTask) openTask(kbId);
}
function kbTask(){ return kbId && S.tasks.find(t => t.id === kbId); }
function showShortcuts(){
  const rows = [['N','New task'],['M','Start / resume meeting'],['⌘K  or  /','Command palette & search'],['J / K  or  ↓ / ↑','Move through tasks'],['X','Complete selected task'],['E  or  Enter','Open selected task'],['S','Snooze to tomorrow'],['O','Switch owner (me ↔ client)'],['1 2 3 / 0','Set priority / clear'],['Delete','Delete selected task'],['T','Go to Today'],['R','Weekly review'],['?','This help'],['Esc','Close panel']];
  openModalHTML('Keyboard shortcuts', `<div class="kbd-grid">${rows.map(([k,l]) => `<kbd>${k}</kbd><span>${l}</span>`).join('')}</div><p class="muted" style="margin:6px 0 0;font-size:13px">Drag tasks to reorder them, drag between <b>On me</b> and <b>On client</b> to change the owner, or drop one on a client in the sidebar to move it there.</p>`);
}

document.addEventListener('keydown', e => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable;
  if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); $('#scrim').classList.contains('open') ? closeModal() : openPalette(); return; }
  if(e.key === 'Escape'){ if($('#scrim').classList.contains('open')) closeModal(); else if(selTask) closeDrawer(); return; }
  if(typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if($('#meeting').classList.contains('open')) return;
  if(e.key === 'n' || e.key === 'q'){ e.preventDefault(); const q = $('#qa'); q && q.focus(); }
  if(e.key === 'm'){ e.preventDefault(); startMeeting(); }
  if(e.key === '/'){ e.preventDefault(); openPalette(); }
  if(e.key === 't') go('today');
  if(e.key === '?'){ e.preventDefault(); showShortcuts(); }
  if(e.key === 'r'){ const v = Reg.views.find(x => x.id === 'review'); if(v) go('view-review'); }
  if(e.key === 'j' || e.key === 'ArrowDown'){ e.preventDefault(); moveKb(1); }
  if(e.key === 'k' || e.key === 'ArrowUp'){ e.preventDefault(); moveKb(-1); }
  const t = kbTask(); if(!t) return;
  const el = visibleTasks().find(x => x.dataset.id === t.id);
  if(e.key === 'x' && el){ const els = visibleTasks(), i = els.indexOf(el), nxt = els[i+1] || els[i-1]; el.querySelector('.check').click(); kbId = nxt && nxt !== el ? nxt.dataset.id : null; setTimeout(applyKb, 450); }
  if(e.key === 'e' || e.key === 'Enter'){ e.preventDefault(); openTask(t.id); }
  if(e.key === 's'){ updateTask(t.id, { dueDate: ymd(addDays(new Date(), 1)) }); render(); toast(`Snoozed “${t.title}” to tomorrow`); }
  if(e.key === 'o'){ updateTask(t.id, { owner: t.owner === 'me' ? 'client' : 'me' }); render(); }
  if(['0','1','2','3'].includes(e.key)){ updateTask(t.id, { priority: +e.key }); render(); }
  if(e.key === 'Delete' || e.key === 'Backspace'){ e.preventDefault(); const gone = removeTask(t.id); kbId = null; if(selTask === t.id) closeDrawer(); render(); toast(`Deleted “${gone.title}”`, [{ label:'Undo', run: () => { S.tasks.push(gone); save(); render(); } }]); }
});

/* ---------- inline client rename ---------- */
document.addEventListener('keydown', e => { const el = e.target.closest && e.target.closest('[data-rename]'); if(!el) return; if(e.key === 'Enter'){ e.preventDefault(); el.blur(); } if(e.key === 'Escape'){ el.textContent = client(el.dataset.rename).name; el.blur(); } }, true);
document.addEventListener('focusout', e => {
  const el = e.target.closest && e.target.closest('[data-rename]'); if(!el) return;
  const c = client(el.dataset.rename), v = el.textContent.replace(/\s+/g, ' ').trim();
  if(!c) return; if(!v){ el.textContent = c.name; return; }
  if(v !== c.name){ const old = c.name; c.name = v; save(); renderSide(); toast(`Renamed to “${v}”`, [{ label:'Undo', run: () => { c.name = old; save(); render(); } }]); }
});

/* ---------- drag & drop ---------- */
let dragId = null;
const clearDrop = () => $$('.drop-before,.drop-after,.drop-on').forEach(x => x.classList.remove('drop-before','drop-after','drop-on'));
document.addEventListener('dragstart', e => {
  const el = e.target.closest && e.target.closest('.task'); if(!el) return;
  dragId = el.dataset.id; el.classList.add('dragging');
  try { e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; } catch(err){}
});
document.addEventListener('dragend', () => { $$('.dragging').forEach(x => x.classList.remove('dragging')); clearDrop(); dragId = null; });
document.addEventListener('dragover', e => {
  if(!dragId) return;
  const side = e.target.closest('.nav a[href^="#client-"]'), task = e.target.closest('#view .task'), grp = e.target.closest('#view .group');
  clearDrop();
  if(side){ e.preventDefault(); side.classList.add('drop-on'); return; }
  if(task && task.dataset.id !== dragId){ e.preventDefault(); const r = task.getBoundingClientRect(); task.classList.add(e.clientY < r.top + r.height/2 ? 'drop-before' : 'drop-after'); return; }
  if(grp && grp.dataset.drop){ e.preventDefault(); grp.classList.add('drop-on'); }
});
document.addEventListener('drop', e => {
  if(!dragId) return; e.preventDefault();
  const id = dragId, t = S.tasks.find(x => x.id === id); if(!t) return;
  const side = e.target.closest('.nav a[href^="#client-"]'), task = e.target.closest('#view .task'), grp = e.target.closest('#view .group');
  clearDrop();
  if(side){ const cid = side.getAttribute('href').slice(8), c = client(cid); updateTask(id, { clientId: cid }); render(); toast(`Moved “${t.title}” to ${c.name}`); return; }
  if(!grp) return;
  const patch = {};
  const own = (grp.dataset.drop || '').match(/^owner:(me|client)$/); if(own && t.owner !== own[1]) patch.owner = own[1];
  const peers = $$('.task', grp).map(x => S.tasks.find(y => y.id === x.dataset.id)).filter(x => x && x.id !== id);
  const dates = [...new Set(peers.map(x => x.dueDate || ''))];
  if(dates.length === 1 && dates[0] !== (t.dueDate || '') && !own) patch.dueDate = dates[0] || null;
  if(Object.keys(patch).length) updateTask(id, patch);
  if(task && task.dataset.id !== id){
    const r = task.getBoundingClientRect(), after = e.clientY >= r.top + r.height/2;
    const ids = peers.map(x => x.id), at = ids.indexOf(task.dataset.id) + (after ? 1 : 0);
    ids.splice(at, 0, id);
    ids.forEach((tid, i) => { const x = S.tasks.find(y => y.id === tid); if(x) x.order = i * 10; });
    save();
  }
  render();
  if(patch.owner) toast(patch.owner === 'client' ? `Now waiting on the client` : `Moved to your list`);
});

/* user-installed plugins */
for(const code of S.userPlugins){ loadingUser = code; try { new Function('Cadence', code)(window.Cadence); } catch(e){ console.warn('User plugin failed', e); } loadingUser = null; }

/* =========================================================
   Boot
   ========================================================= */
if(!S.fixPrep){
  let n = 0;
  for(const t of S.tasks){ const c = client(t.clientId); if(c && /\b(with|from|for|to|at|about|re|and|cc|via|of)$/i.test(t.title.trim())){ t.title = capFirst(t.title.trim() + ' ' + c.name); n++; } else if(/^\p{Ll}/u.test(t.title)) t.title = capFirst(t.title); }
  S.fixPrep = 1; if(n) save();
}
booted = true;
render(); renderWidgets();
if(S.activeMeeting) toast('A meeting is still in progress', [{ label:'Resume', run: () => startMeeting() }], { sticky:true });
setInterval(checkReminders, 15000); checkReminders();
setInterval(() => { if(!$('#meeting').classList.contains('open') && !document.activeElement.closest?.('.qa, .drawer, .modal')) { renderSide(); } }, 60000);
Store.init();
/* narrow layout: slide-over sidebar */
$('#nav-btn') && $('#nav-btn').addEventListener('click', () => document.body.classList.toggle('nav-open'));
$('#nav-scrim') && $('#nav-scrim').addEventListener('click', () => document.body.classList.remove('nav-open'));
addEventListener('hashchange', () => document.body.classList.remove('nav-open'));
if(window.claude && window.claude.use){
  claude.use('sample').then(s => { AI = s || null; rebuildPlugins(); }).catch(() => {});
}
})();
