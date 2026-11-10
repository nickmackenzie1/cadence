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
/* ---------- spaces: Work and Life are two complete Cadences (own tasks, areas/clients, plugins, theme, dashboards).
   The space you're in is per device; both sync through the same per-record sync. ---------- */
let SPACE = (() => { try { return localStorage.getItem('cadence.space') === 'life' ? 'life' : 'work'; } catch(e){ return 'work'; } })();
const LS_KEYS = { work: LS_KEY, life: DEMO ? 'cadence.demo.life.v1' : 'cadence.life.v1' };
const LIFE = () => SPACE === 'life';
const LIFE_AREAS = [['Home','🏠','#c2771c'],['Health','💚','#2f9e6b'],['Money','💰','#5b5bd6'],['Projects','🛠️','#e5484d']];
function lifeSeed(){
  const d = Object.assign(blank(), { lifeSeeded: Date.now() });
  d.clients = LIFE_AREAS.map(([name, icon, color], i) => ({ id: uid('a'), name, icon, color, domain: '', status: 'active', archived: false, createdAt: Date.now() + i }));
  d.pluginData = { themes: { theme: 'calm' } };
  d.disabled = ['haunted', 'havoc'];   // Life starts calm; switch them on in Plugins if you like
  try { const w = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); if(w.settings && w.settings.myName) d.settings.myName = w.settings.myName; } catch(e){}
  if(DEMO){ const a = n => d.clients.find(c => c.name === n).id, day = n => ymd(addDays(new Date(), n));
    d.tasks = [['Change the furnace filter', 'Home', 0], ['Book dentist cleaning', 'Health', 2], ['Pay the hydro bill', 'Money', -1], ['Clean the eavestroughs', 'Home', 6], ['Sand and paint the deck', 'Projects', 12], ['Renew car insurance', 'Money', 9]]
      .map(([title, area, n], i) => ({ id: uid('t'), title, clientId: a(area), owner: 'me', assignee: '', dueDate: day(n), dueTime: null, priority: 0, tags: [], notes: '', repeat: null, order: i, done: false, doneAt: null, createdAt: Date.now() - i * 1000 })); }
  return d;
}
function loadDoc(space){
  try { const raw = localStorage.getItem(LS_KEYS[space]); if(raw){ const d = Object.assign(blank(), JSON.parse(raw)); migrateOwners(d); return d; } } catch(e){}
  if(space === 'life') return null;
  if(DEMO && window.CadenceDemo){ const d = Object.assign(blank(), window.CadenceDemo.build()); try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch(e){} return d; }
  return blank();
}
let S = loadDoc(SPACE) || lifeSeed();
let OTHER;   // the other space's document, loaded when first needed (undefined = not loaded, null = doesn't exist yet)
function otherDoc(){ if(OTHER === undefined) OTHER = loadDoc(SPACE === 'work' ? 'life' : 'work'); return OTHER; }
function docOf(space){ return space === SPACE ? S : otherDoc(); }
function setDoc(space, d){ if(space === SPACE) S = d; else OTHER = d; }
function persistDoc(space){ const d = docOf(space); if(d) try { localStorage.setItem(LS_KEYS[space], JSON.stringify(d)); } catch(e){} }
document.documentElement.dataset.space = SPACE;
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
  /* self-hosted mode (Synology / Docker): server.js exposes api/sync (per-record) + api/state (whole document, fallback) + api/ai */
  server:false, mode:'records',
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
      this.mode = info.storage === 'sqlite' ? 'records' : 'doc';
      await this.pull(true);
      setInterval(() => this.pull(false), 20000);
      document.addEventListener('visibilitychange', () => { if(!document.hidden) this.pull(false); });
      addEventListener('online', () => this.push());
    } catch(e){ console.warn('No Cadence server found, using browser storage', e); }
  },
  async pull(first){
    if(this.mode === 'doc') return this.pullDoc(first);
    if(this.busy) return;
    const t0 = performance.now(); emit('sync', { phase:'pull' });
    try {
      const fresh = first && !Sync.st.init;
      const r = await fetch('api/sync?since=' + (fresh ? 0 : Sync.st.cursor), { cache:'no-store' });
      if(r.status === 501){ this.mode = 'doc'; return this.pullDoc(first); }
      if(!r.ok) throw new Error(r.status);
      const d = await r.json();
      this.latency = Math.round(performance.now() - t0); this.lastSyncAt = Date.now();
      if(fresh) Sync.adopt(d); else Sync.apply(d, new Map());
      if(Sync.pending()) this.schedule();
      this.setStatus('synced'); emit('sync', { phase:'pulled', ms: this.latency, first });
      if(d.conflicts && !Sync.told){ Sync.told = true; Sync.notify(d.conflicts, true); }
    } catch(e){ this.setStatus('local'); emit('sync', { phase:'error', error: String(e.message || e) }); }
  },
  setStatus(s){ this.status = s; const el = $('#sync'); if(el){ el.className = 'sync' + (s==='synced'?' ok':''); el.lastChild.textContent = DEMO ? 'Demo data — not saved' : s==='synced' ? (this.server ? 'Synced to NAS' : 'Synced') : 'This browser'; } },
  schedule(){ if(DEMO || (!this.ref && !this.server)) return; clearTimeout(this.timer); this.timer = setTimeout(()=>this.push(), 700); },
  async push(){
    if(DEMO || (!this.ref && !this.server)) return;
    if(this.server && this.mode === 'records') return this.pushRecords();
    if(LIFE()) return;
    if(this.busy){ this.again = true; return; }
    this.busy = true;
    emit('sync', { phase:'push' }); const t0 = performance.now();
    try {
      if(this.server){ const r = await fetch('api/state', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ json: JSON.stringify(S), updatedAt: S.updatedAt }) }); if(r.status === 409){ this.busy = false; return this.pullDoc(false); } if(!r.ok) throw new Error('HTTP ' + r.status); }
      else await this.ref.set({ json: JSON.stringify(S), updatedAt: S.updatedAt });
      this.latency = Math.round(performance.now() - t0); this.lastSyncAt = Date.now();
      this.setStatus('synced'); emit('sync', { phase:'saved', ms: this.latency }); }
    catch(e){ console.warn('sync failed', e); emit('sync', { phase:'error', error: String(e.message || e) }); if(e && e.code === 'quota_exceeded') toast('Sync storage is full — archive old tasks in Settings.'); }
    this.busy = false;
    if(this.again){ this.again = false; this.push(); }
  },
  /* per-record sync: send only what changed since the server last confirmed it; the server merges field by field */
  async pushRecords(){
    if(this.busy){ this.again = true; return; }
    if(!Sync.st.init) return this.pull(true);
    const { changes, sent } = Sync.diff();
    if(!changes.length) return;
    this.busy = true; emit('sync', { phase:'push' }); const t0 = performance.now();
    try {
      const r = await fetch('api/sync', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ device: Sync.device(), since: Sync.st.cursor, changes }) });
      if(r.status === 501){ this.mode = 'doc'; this.busy = false; return this.push(); }
      if(!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      Sync.apply(d, sent);
      this.latency = Math.round(performance.now() - t0); this.lastSyncAt = Date.now();
      this.setStatus('synced'); emit('sync', { phase:'saved', ms: this.latency, records: changes.length });
      if(d.newConflicts && d.newConflicts.length) Sync.notify(d.newConflicts.length);
    } catch(e){ console.warn('sync failed', e); this.setStatus('local'); emit('sync', { phase:'error', error: String(e.message || e) }); }
    this.busy = false;
    // more edits arrived meanwhile: send them (bounded, so a stubborn record can never spin)
    this.spins = Sync.pending() ? (this.spins || 0) + 1 : 0;
    if(this.again || (this.spins && this.spins < 4)){ this.again = false; setTimeout(() => this.push(), 50 * (this.spins || 1)); }
  },
  /* whole-document sync (servers without SQLite) */
  async pullDoc(first){
    if(LIFE()) return;   // whole-document sync (servers without SQLite) only carries Work; Life stays on this device
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
  }
};

/* ---------- per-record sync state (survives reloads, so offline edits are sent later) ---------- */
const Sync = {
  KEY: LS_KEY + '.sync', ARR: { task:'tasks', client:'clients', meeting:'meetings' }, told: false,
  st: (() => { try { return Object.assign({ init:false, cursor:0, recs:{}, dirty:{} }, JSON.parse(localStorage.getItem(LS_KEY + '.sync') || '{}')); } catch(e){ return { init:false, cursor:0, recs:{}, dirty:{} }; } })(),
  save(){ try { localStorage.setItem(this.KEY, JSON.stringify(this.st)); } catch(e){} },
  k: (kind, id) => kind + '\u0000' + id,
  device(){
    let d = ''; try { d = localStorage.getItem('cadence.device') || ''; } catch(e){}
    if(d) return d;
    const ua = navigator.userAgent, os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Device';
    const br = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    return os + ' · ' + br;
  },
  // the local state as records (same split as the server), for both spaces; Life's plugin/doc ids carry a 'life:' prefix
  local(){
    const m = new Map();
    for(const space of ['work', 'life']){
      const D = docOf(space); if(!D) continue;
      const pre = space === 'life' ? 'life:' : '';
      for(const [kind, key] of Object.entries(this.ARR)) (D[key] || []).forEach((x, i) => { if(x && x.id != null) m.set(this.k(kind, x.id), { kind, id: String(x.id), data: x, pos: i, space, h: JSON.stringify(x) }); });
      for(const [pid, d] of Object.entries(D.pluginData || {})) m.set(this.k('plugin', pre + pid), { kind:'plugin', id: pre + pid, data: d, space, h: JSON.stringify(d) });
      const root = {}; for(const [k, v] of Object.entries(D)) if(!['tasks','clients','meetings','pluginData','updatedAt'].includes(k)) root[k] = v;
      m.set(this.k('doc', pre + 'root'), { kind:'doc', id: pre + 'root', data: root, space, h: JSON.stringify(root) });
    }
    return m;
  },
  diff(){
    const local = this.local(), now = Date.now(), changes = [], sent = new Map(), st = this.st;
    for(const [k, r] of local){
      const s = st.recs[k];
      if(s && !s.deleted && s.h === r.h) continue;
      st.dirty[k] = st.dirty[k] || now;
      changes.push({ kind: r.kind, id: r.id, space: r.space, data: r.data, pos: s ? undefined : r.pos, baseRev: s ? s.rev : 0, at: st.dirty[k] });
      sent.set(k, r.h);
    }
    for(const [k, s] of Object.entries(st.recs)){
      if(s.deleted || local.has(k)) continue;
      st.dirty[k] = st.dirty[k] || now;
      const [kind, id] = k.split('\u0000');
      changes.push({ kind, id, space: s.space || (/^life:/.test(id) ? 'life' : 'work'), deleted: true, baseRev: s.rev, at: st.dirty[k] });
      sent.set(k, null);
    }
    this.save();
    return { changes, sent };
  },
  pending(){ const local = this.local(); for(const [k, r] of local){ const s = this.st.recs[k]; if(!s || s.deleted || s.h !== r.h) return true; } return Object.entries(this.st.recs).some(([k, s]) => !s.deleted && !local.has(k)); },
  spaceOf: rec => rec.space || (/^life:/.test(rec.id) ? 'life' : 'work'),
  // put one server record into its space's document (creating Life if another device started it)
  put(rec, D){
    const space = this.spaceOf(rec);
    if(!D){ D = docOf(space); if(!D){ D = Object.assign(blank(), {}); setDoc(space, D); } }
    const key = this.ARR[rec.kind], id = rec.id.replace(/^life:/, '');
    if(key){
      const arr = D[key] || (D[key] = []), i = arr.findIndex(x => String(x.id) === rec.id);
      if(rec.deleted){ if(i > -1) arr.splice(i, 1); }
      else if(i > -1) arr[i] = rec.data;
      else arr.splice(Math.min(rec.pos != null ? rec.pos : arr.length, arr.length), 0, rec.data);
    } else if(rec.kind === 'plugin'){ D.pluginData = D.pluginData || {}; if(rec.deleted) delete D.pluginData[id]; else D.pluginData[id] = rec.data; }
    else if(rec.kind === 'doc' && !rec.deleted && rec.data && typeof rec.data === 'object') Object.assign(D, rec.data);
    return space;
  },
  // merge server records into local state; `sent` = what this device just sent (key -> json, null = deleted)
  apply(d, sent){
    const local = this.local(), st = this.st, touched = new Set();
    let any = false, structural = false;
    for(const rec of d.records || []){
      const k = this.k(rec.kind, rec.id), h = JSON.stringify(rec.data), l = local.get(k), s = st.recs[k];
      const localH = l ? l.h : null;
      if(sent.has(k)){
        st.recs[k] = { rev: rec.rev, h, deleted: !!rec.deleted, space: this.spaceOf(rec) };
        if(localH === sent.get(k)){ delete st.dirty[k]; if((localH !== h) || (!!rec.deleted !== !l)){ const sp = this.put(rec); touched.add(sp); if(sp === SPACE){ any = true; structural = structural || rec.kind === 'doc' || rec.kind === 'plugin'; } } }
        // else: edited again while this was in flight: keep the local edit, it goes out next with the new base
      } else {
        const dirty = s ? (s.deleted ? !!l : localH !== s.h) : !!l;
        if(dirty) continue;   // local edits waiting: the server merges them on the next push
        st.recs[k] = { rev: rec.rev, h, deleted: !!rec.deleted, space: this.spaceOf(rec) };
        if(localH !== h || (!!rec.deleted !== !l)){ const sp = this.put(rec); touched.add(sp); if(sp === SPACE){ any = true; structural = structural || rec.kind === 'doc' || rec.kind === 'plugin'; } }
      }
    }
    // changes the server accepted without needing a new revision (already identical) count as synced too
    const back = new Set((d.records || []).map(r => this.k(r.kind, r.id)));
    for(const [k, h] of sent){
      if(back.has(k)) continue;
      const s = st.recs[k], l = local.get(k);
      if((l ? l.h : null) !== h) continue;
      if(h === null){ if(s) s.deleted = true; } else st.recs[k] = { rev: s ? s.rev : 0, h, deleted: false, space: l ? l.space : (s && s.space) };
      delete st.dirty[k];
    }
    st.cursor = Math.max(st.cursor || 0, d.cursor || 0);
    this.save();
    for(const sp of touched) if(sp !== SPACE) persistDoc(sp);
    if(any){ persistLocal(); if(structural) rebuildPlugins(); render(); }
  },
  // first sync of this device: adopt the server's copy, unless this device has newer unsynced work (pre-upgrade)
  adopt(d){
    const st = this.st, recs = d.records || [];
    const W = docOf('work'), localHas = W && (W.tasks.length || W.clients.length || W.meetings.length);
    const localNewer = localHas && (W.updatedAt || 0) > (d.docUpdatedAt || 0);
    st.recs = {}; st.dirty = {};
    for(const rec of recs) st.recs[this.k(rec.kind, rec.id)] = { rev: rec.rev, h: JSON.stringify(rec.data), deleted: !!rec.deleted, space: this.spaceOf(rec) };
    st.cursor = d.cursor || 0; st.init = true;
    if(!recs.length){ this.save(); return; }   // empty server: everything local goes up on the next push
    const fresh = { work: Object.assign(blank(), { pluginData: {} }), life: null };
    for(const r of recs.filter(r => !r.deleted).sort((a, b) => (a.pos || 0) - (b.pos || 0) || a.rev - b.rev)){
      const sp = this.spaceOf(r); if(sp === 'life' && !fresh.life) fresh.life = Object.assign(blank(), { pluginData: {} });
      this.put(r, fresh[sp]);
    }
    fresh.work.updatedAt = d.docUpdatedAt || Date.now();
    if(!localNewer) setDoc('work', fresh.work);                       // otherwise this device's newer Work is pushed
    if(fresh.life) setDoc('life', fresh.life);                        // a Life made only on this device (not on the server yet) is kept and pushed
    if(SPACE === 'life' && !docOf('life')) setDoc('life', lifeSeed());
    persistDoc('work'); persistDoc('life'); this.save(); rebuildPlugins(); render();
  },
  notify(n, quiet){
    if(!n) return;
    const msg = n === 1 ? '1 change clashed with another device' : `${n} changes clashed with other devices`;
    const show = window.CadenceIsland && enabled('island') ? (o => window.CadenceIsland.show(o)) : (o => toast(o.title, o.actions));
    show({ icon:'⇄', color:'#f5a524', title: msg, sub: quiet ? 'Newest edits were kept' : 'Kept the newest. Review?', actions:[{ label:'Review', run: () => openConflicts() }], ms: 9000 });
  }
};

/* ---------- clash review: both versions side by side, keep either ---------- */
const FIELD_NAMES = { assignedAt:'Handed over', stage:'Progress', log:'Steps', title:'Title', dueDate:'Due date', dueTime:'Due time', priority:'Priority', notes:'Notes', owner:'Who owes it', assignee:'Assignee', tags:'Tags', done:'Done', clientId:'Client', repeat:'Repeat', name:'Name', status:'Status', settings:'Settings', disabled:'Plugins switched off', userPlugins:'Your plugins', '(deleted)':'Deleted on one device', order:'Position' };
function conflictValue(c, v){
  if(c.field === '(deleted)') return v === 'deleted' ? 'Deleted' : 'Kept';
  if(v == null || v === '') return '<span class="muted">(empty)</span>';
  if(c.field === 'priority') return ['None','Low','Medium','High'][v] || esc(String(v));
  if(c.field === 'clientId'){ const cl = client(v); return esc(cl ? cl.name : v); }
  if(c.field === 'done') return v ? 'Done' : 'Not done';
  if(c.field === 'dueDate') return esc(fmtDate(v));
  if(typeof v === 'object') return `<code style="font-size:11px">${esc(JSON.stringify(v).slice(0, 160))}</code>`;
  return esc(String(v));
}
async function openConflicts(){
  let list = [];
  try { list = (await (await fetch('api/conflicts', { cache:'no-store' })).json()).conflicts || []; } catch(e){ return toast('Could not load clashes'); }
  if(!list.length){ closeModal(); return toast('No clashes to review'); }
  const when = t => t ? new Date(t).toLocaleString([], { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }) : '';
  openModalHTML('Sync clashes', `<p class="muted" style="margin:0 0 12px;font-size:13px">These were changed on two devices at once. The newest edit was kept; pick the other one if that's the right one.</p>
    <div class="cf-list">${list.map(c => { const live = Sync.ARR[c.kind] && (S[Sync.ARR[c.kind]] || []).find(x => String(x.id) === c.id); return `<div class="cf" data-cid="${c.cid}"><div class="cf-h"><b>${esc((live && (live.title || live.name)) || c.title || c.kind)}</b><span>${esc(FIELD_NAMES[c.field] || c.field)}</span></div>
      <div class="cf-row"><div class="cf-opt on"><small>Kept · ${esc(c.keptDevice || 'a device')} · ${esc(when(c.keptAt))}</small><div>${conflictValue(c, c.kept)}</div><button class="btn" data-keep="kept">Keep this</button></div>
      <div class="cf-opt"><small>${esc(c.otherDevice || 'a device')} · ${esc(when(c.otherAt))}</small><div>${conflictValue(c, c.other)}</div><button class="btn" data-keep="other">Use this instead</button></div></div></div>`; }).join('')}</div>`,
    `<button class="btn" id="cf-all">Keep everything as it is</button><button class="btn primary" data-act="close-modal">Done</button>`, 'wide');
  const resolve = async ids => { try { await fetch('api/conflicts/resolve', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ cid: ids }) }); } catch(e){} };
  $$('.cf').forEach(el => el.querySelectorAll('[data-keep]').forEach(b => b.onclick = async () => {
    const c = list.find(x => x.cid === +el.dataset.cid);
    if(b.dataset.keep === 'other') useConflictValue(c);
    await resolve([c.cid]); el.classList.add('done'); setTimeout(() => { el.remove(); if(!$$('.cf').length){ closeModal(); toast('All clashes sorted'); } }, 250);
  }));
  $('#cf-all').onclick = async () => { await resolve(list.map(c => c.cid)); closeModal(); toast('Kept the newest everywhere'); };
}
function useConflictValue(c){
  const key = Sync.ARR[c.kind];
  if(c.field === '(deleted)'){
    if(c.other === 'deleted'){ if(key){ S[key] = S[key].filter(x => String(x.id) !== c.id); } }
  } else if(key){ const x = S[key].find(r => String(r.id) === c.id); if(x){ if(c.other === null || c.other === undefined) delete x[c.field]; else x[c.field] = c.other; } }
  else if(c.kind === 'plugin'){ const d = S.pluginData[c.id]; if(d && typeof d === 'object') d[c.field] = c.other; }
  else if(c.kind === 'doc'){ S[c.field] = c.other; }
  save(); rebuildPlugins(); render();
}
function persistLocal(){ try { localStorage.setItem(LS_KEYS[SPACE], JSON.stringify(S)); } catch(e){} }
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
/* Dev (Work): a third owner next to Mine and Client's, for work handed to development. owner 'dev' */
const daysSince = ms => ms ? Math.floor((Date.now() - ms) / 864e5) : 0;
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
  if(c.icon && !img) return `<span class="av emoji" style="--c:${c.color};width:${size}px;height:${size}px;font-size:${Math.round(size*.62)}px">${esc(c.icon)}</span>`;
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
function migrateOwners(doc){ for(const t of (doc && doc.tasks) || []) if(t.owner === 'team'){ t.owner = 'dev'; t.assignee = ''; } if(doc && doc.settings) delete doc.settings.team; }
function addTask(p){
  if(p && p.id === undefined) delete p.id;
  const t = Object.assign({ id: uid('t'), title:'', clientId:null, owner:'me', assignee:'', dueDate:null, dueTime:null, priority:0, tags:[], notes:'', remindMode:'auto', remindAt:null, reminded:false, done:false, doneAt:null, createdAt:Date.now(), meetingId:null }, p);
  t.title = capFirst(t.title);
  if(t.owner === 'dev' && !t.assignedAt) t.assignedAt = Date.now();
  t.remindAt = computeRemind(t);
  S.tasks.push(t); save(); emit('task:add', clone(t)); return t;
}
function updateTask(id, patch){
  const t = S.tasks.find(x => x.id === id); if(!t) return;
  if(patch.owner === 'dev' && t.owner !== 'dev') patch = { ...patch, assignedAt: Date.now() };
  Object.assign(t, patch);
  if(['dueDate','dueTime','remindMode','remindAt'].some(k => k in patch)){ t.remindAt = computeRemind(t); t.reminded = false; }
  save(); emit('task:update', clone(t)); return t;
}
const REPEAT_LABEL = r => !r ? '' : r.unit === 'weekday' ? 'Weekdays' : r.unit === 'day' ? (r.n > 1 ? `Every ${r.n} days` : 'Daily') : r.unit === 'week' ? (r.n === 2 ? 'Every 2 weeks' : r.n > 1 ? `Every ${r.n} weeks` : 'Weekly') : r.unit === 'month' ? (r.n === 12 ? 'Yearly' : r.n === 6 ? 'Twice a year' : r.n === 3 ? 'Every 3 months' : r.n % 12 === 0 ? `Every ${r.n / 12} years` : r.n > 1 ? `Every ${r.n} months` : 'Monthly') : '';
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
      const next = addTask({ ...clone(t), id: undefined, done:false, doneAt:null, reminded:false, spawnedId:null, stage:null, log:[], createdAt: Date.now(), dueDate: nextOccurrence(t.dueDate || todayKey(), t.repeat), meetingId:null, lastChased:null });
      t.spawnedId = next.id;
    } else if(!t.done && t.spawnedId){
      const n = S.tasks.find(x => x.id === t.spawnedId); if(n && !n.done) removeTask(n.id); t.spawnedId = null;
    }
  }
  save();
  emit(t.done ? 'task:complete' : 'task:reopen', clone(t));
  if(t.done) try { document.dispatchEvent(new CustomEvent('cadence:task-complete', { detail: clone(t) })); } catch(e){}
}
function removeTask(id){ const i = S.tasks.findIndex(x => x.id === id); if(i>-1){ const [t] = S.tasks.splice(i,1); save(); emit('task:remove', clone(t)); return t; } }
const sortTasks = arr => arr.sort((a,b) => (a.dueDate||'9999').localeCompare(b.dueDate||'9999') || (a.order ?? 1e15) - (b.order ?? 1e15) || (a.dueTime||'99').localeCompare(b.dueTime||'99') || (b.priority-a.priority) || (a.createdAt-b.createdAt));
const open = () => S.tasks.filter(t => !t.done);

/* ---------- natural-language quick add ---------- */
function parseQuick(input, ctx = {}){
  let t = ' ' + input + ' ';
  const r = { title:'', repeat:null, clientId: ctx.clientId || null, owner: ctx.owner || 'me', assignee: ctx.assignee || '', dueDate:null, dueTime:null, priority:0, tags:[], newClient:null };
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
  // dev  >dev or >  -> handed to development
  if(!LIFE()) take(/\s>(dev)?(?=\s)/i, () => { r.owner = 'dev'; r.assignee = ''; });
  take(/\s\^([\w.'-]*)(?=\s)/, m => { if(!LIFE() && /^dev$/i.test(m[1])){ r.owner = 'dev'; r.assignee = ''; } else { r.owner = 'client'; r.assignee = m[1] || ''; } });
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
  if(r.owner === 'dev') out.push(`<span class="chip dev-owned">⚙ Dev</span>`);
  for(const c of Reg.chips){ try { const h = c.fn(r, true); if(h) out.push(h); } catch(e){} }
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
const Reg = { defs:[], commands:[], views:[], parsers:[], extractors:[], taskActions:[], meetingActions:[], clientActions:[], sidebar:[], listeners:[], settingsPanels:[], widgets:[], chips:[], cards:[] };
let AI = null;
function spaceOk(pid){ const d = Reg.defs.find(x => x.id === pid); return !d || !d.spaces || d.spaces.includes(SPACE); }
function enabled(pid){ return !S.disabled.includes(pid) && spaceOk(pid); }
/* switch between Work and Life: the whole app swaps to the other space's data, plugins and theme */
function switchSpace(to){
  if(to !== 'work' && to !== 'life') to = LIFE() ? 'work' : 'life';
  if(to === SPACE) return;
  const prev = S, next = otherDoc() || (to === 'life' ? lifeSeed() : Object.assign(blank(), {}));
  persistLocal();
  OTHER = prev; S = next; SPACE = to;
  try { localStorage.setItem('cadence.space', to); } catch(e){}
  document.documentElement.dataset.space = to;
  persistLocal();
  document.body.classList.remove('space-anim'); void document.body.offsetWidth; document.body.classList.add('space-anim');
  setTimeout(() => document.body.classList.remove('space-anim'), 700);
  selTask = null; rebuildPlugins();
  if(location.hash && location.hash !== '#today') location.hash = 'today'; else render();
  emit('space', { space: to });
  if(!S.lifeSynced && to === 'life'){ S.lifeSynced = true; save(); }   // a brand-new Life gets sent to the NAS
}
/* no emoji anywhere: every emoji that reaches the page (core, plugins, the Island, toasts, area icons in your data)
   is swapped for the matching Lucide icon as it renders. Text you're typing (inputs, editable fields) is left alone.
   icon('name') gives you a Lucide icon directly (also api.ui.icon). Icons: public/vendor/lucide (ISC). */
const EMOJI_ICONS = {"✦":"sparkles","🪐":"orbit","🕓":"clock-4","◉":"circle-dot","▦":"layout-grid","◇":"diamond","◖":"palette","◐":"palette","◑":"palette","◒":"palette","◓":"palette","☰":"menu","🏠": "house", "💚": "heart-pulse", "💰": "piggy-bank", "🛠️": "wrench", "💻": "laptop", "🏭": "factory", "🩺": "stethoscope", "⚖️": "scale", "💼": "briefcase", "🛡️": "shield", "🏗️": "construction", "🛍️": "shopping-bag", "🚚": "truck", "🎓": "graduation-cap", "🤝": "handshake", "🏨": "hotel", "📣": "megaphone", "⚡": "zap", "🚗": "car", "🏢": "building-2", "↗": "arrow-up-right", "⚙": "cog", "🎯": "target", "🎉": "party-popper", "📌": "pin", "⚠": "triangle-alert", "🔔": "bell", "✉": "mail", "▶": "play", "⏳": "hourglass", "⏰": "alarm-clock", "🗓️": "calendar-days", "🌿": "leaf", "☀": "sun", "👋": "hand", "👍": "thumbs-up", "⚽": "volleyball", "🍳": "cooking-pot", "🧺": "shirt", "🌱": "sprout", "🐶": "dog", "✈️": "plane", "🎨": "palette", "📚": "library-big", "👶": "baby", "🎵": "music", "🏃": "footprints", "🛒": "shopping-cart", "🧘": "flower-2", "🎁": "gift", "🚀": "rocket", "📦": "package", "🧪": "flask-conical", "🧭": "compass", "💡": "lightbulb", "🧰": "toolbox", "⚙️": "cog", "🗂️": "folder-kanban", "☑": "square-check", "✔": "check", "↔": "arrow-left-right", "✨": "sparkles", "📅": "calendar", "📝": "notebook-pen", "🔒": "lock", "🎫": "ticket", "👻": "ghost", "💥": "zap", "🏡": "house", "🏘️": "building", "🛋️": "sofa", "🔑": "key-round", "📄": "file-text", "❄️": "snowflake", "🌦️": "cloud-sun-rain", "☀️": "sun", "🔥": "flame", "♻️": "recycle", "♨️": "heater", "🤷": "circle-help", "🪟": "app-window", "🌬️": "wind", "🌀": "fan", "💧": "droplet", "🪵": "tree-pine", "🛢️": "cylinder", "🚰": "glass-water", "🌊": "waves", "🧂": "package-2", "🧊": "box", "🪣": "paint-bucket", "🚽": "toilet", "🏊": "waves-ladder", "🚨": "siren", "🧯": "fire-extinguisher", "🍽️": "utensils", "🛞": "life-buoy", "🧾": "receipt", "☕": "coffee", "🔗": "link", "🗡️": "sword", "💎": "gem", "🏔️": "mountain-snow", "⭐": "star", "🌟": "star", "🧹": "brush-cleaning", "📭": "mailbox", "🏆": "trophy", "👑": "crown", "🌳": "trees", "🌸": "flower", "🌻": "flower-2", "🫐": "cherry", "🖼️": "image", "🧩": "puzzle", "🖌": "paintbrush", "📈": "trending-up", "📉": "trending-down", "▫": "square", "🚧": "construction"};
const EMO_RE = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|\p{Emoji_Modifier})*|[✦◉▦◇◖◐◑◒◓☰]/gu;
function icon(name, cls = ''){ const d = window.LUCIDE && window.LUCIDE[name]; return d ? `<svg class="lu ${cls}" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>` : ''; }
const iconFor = e => EMOJI_ICONS[e] || EMOJI_ICONS[e.replace(/\uFE0F/g, '')] || EMOJI_ICONS[e + '\uFE0F'] || EMOJI_ICONS[e.replace(/\u200D[\s\S]*/, '')];
const Deemoji = (() => {
  const skip = n => { const p = n.parentElement; return !p || p.closest('script,style,textarea,svg,[contenteditable="true"],.keep-emoji'); };
  const fix = node => {
    if(node.nodeType === 3){ const t = node.nodeValue; if(!t || !EMO_RE.test(t)) return; EMO_RE.lastIndex = 0; if(skip(node)) return;
      const frag = document.createDocumentFragment(); let last = 0, m, any = false;
      while((m = EMO_RE.exec(t))){ const n = iconFor(m[0]); if(!n) continue; any = true;
        if(m.index > last) frag.appendChild(document.createTextNode(t.slice(last, m.index)));
        const sp = document.createElement('span'); sp.className = 'lu-w'; sp.innerHTML = icon(n); frag.appendChild(sp); last = m.index + m[0].length;
        if(t[last] === ' ' && t[last + 1] === ' ') last++; }
      EMO_RE.lastIndex = 0; if(!any) return;
      if(last < t.length) frag.appendChild(document.createTextNode(t.slice(last)));
      node.parentNode.replaceChild(frag, node); return; }
    if(node.nodeType !== 1 || node.matches('script,style,textarea,svg,canvas')) return;
    const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT), list = []; let n; while((n = w.nextNode())) if(EMO_RE.test(n.nodeValue)){ EMO_RE.lastIndex = 0; list.push(n); } else EMO_RE.lastIndex = 0;
    list.forEach(fix);
  };
  let queue = new Set(), sched = false;
  const flush = () => { sched = false; const q = queue; queue = new Set(); q.forEach(x => x.isConnected && fix(x)); };
  const mo = new MutationObserver(ms => { for(const m of ms){ if(m.type === 'characterData') queue.add(m.target); else m.addedNodes.forEach(x => queue.add(x)); } if(!sched){ sched = true; queueMicrotask(flush); } });
  const start = () => { fix(document.body); mo.observe(document.body, { childList: true, subtree: true, characterData: true }); };
  if(document.body) start(); else addEventListener('DOMContentLoaded', start);
  return { fix };
})();
/* errors surface instead of failing silently: a toast with the message, and a log you can copy (⌘K → Copy error log) */
const ErrLog = (() => { let list = []; try { list = JSON.parse(sessionStorage.getItem('cadence.errors') || '[]'); } catch(e){}
  const seen = new Set();
  const add = (msg, stack) => { msg = String(msg || 'Unknown error').slice(0, 300);
    const e = { at: new Date().toISOString(), route: location.hash, msg, stack: String(stack || '').split('\n').slice(0, 6).join('\n') };
    list = list.concat([e]).slice(-30); try { sessionStorage.setItem('cadence.errors', JSON.stringify(list)); } catch(x){}
    if(seen.has(msg)) return; seen.add(msg);
    try { toast(`Something went wrong: ${msg.slice(0, 90)}`, [{ label: 'Copy details', run: () => copy() }]); } catch(x){} };
  const text = () => `Cadence ${document.querySelector('meta[name=version]')?.content || ''} · ${navigator.userAgent}\n\n` + list.map(e => `${e.at} ${e.route}\n${e.msg}\n${e.stack}`).join('\n\n');
  const copy = () => copyText(text());
  addEventListener('error', e => { if(e.filename && !/\/(core|plugins\/[\w-]+)\.js/.test(e.filename)) return; add(e.message, e.error && e.error.stack); });
  addEventListener('unhandledrejection', e => { const r = e.reason; if(r && /Failed to fetch|NetworkError|aborted/i.test(String(r.message || r))) return; add(r && r.message || r, r && r.stack); });
  return { add, list: () => list.slice(), copy, text };
})();
window.CadenceErrors = ErrLog;
function emit(ev, payload){ for(const l of Reg.listeners) if(l.ev === ev || l.ev === '*') { try { l.fn(payload, ev); } catch(e){ console.error(`[plugin ${l.pid}]`, e); ErrLog.add(`[${l.pid}] ${e.message}`, e.stack); } } }
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
    /* extra chips on task rows (and the quick-add preview): api.chips.add((task, preview) => html or '') */
    chips: { add: fn => Reg.chips.push({ fn, pid }) },
    /* a card under the notes in the open task editor: api.taskCards.add(task => html or '') */
    taskCards: { add: fn => Reg.cards.push({ fn, pid }) },
    meetingActions: { add: a => Reg.meetingActions.push({ ...a, pid }) },
    clientActions: { add: a => Reg.clientActions.push({ ...a, pid }) },
    sidebar: { add: w => Reg.sidebar.push({ ...w, pid }) },
    /* the Settings button for this plugin (in the plugin browser): api.onSettings(() => openMySettings()) */
    onSettings: fn => { Reg.settingsPanels = Reg.settingsPanels.filter(x => x.pid !== pid).concat([{ pid, fn }]); },
    /* dashboard widgets: api.widgets.add({ id, title, icon?, size: 's'|'m'|'l'|'w'|'t', render(el, api, ctx) }) */
    widgets: {
      add: w => { Reg.widgets = Reg.widgets.filter(x => x.key !== pid + ':' + w.id); Reg.widgets.push({ size: 'm', ...w, pid, key: pid + ':' + w.id }); },
      list: () => Reg.widgets.map(w => ({ key: w.key, id: w.id, pid: w.pid, spaces: w.spaces, title: w.title, icon: w.icon, size: w.size, description: w.description || '', fields: w.fields || [], minW: w.minW, minH: w.minH, color: (Reg.defs.find(d => d.id === w.pid) || {}).color })),
      /* draw any plugin's widget into el; ctx = { cfg, setCfg(patch), w, h, edit } */
      render: (key, el, ctx = {}) => { const w = Reg.widgets.find(x => x.key === key); if(!w) return false; try { w.render(el, makeApi(w.pid), ctx); } catch(e){ el.innerHTML = `<div class="muted" style="padding:12px;font-size:12px">Widget failed: ${esc(e.message)}</div>`; } return true; },
    },
    plugins: { enabled: id => enabled(id) },
    space: () => SPACE,
    system: () => ({ demo: DEMO, space: SPACE, mode: Store.server ? 'nas' : Store.ref ? 'claude' : 'local', status: Store.status, lastSyncAt: Store.lastSyncAt || null, latency: Store.latency ?? null, ai: !!AI, health: Store.health || null, version: window.Cadence.version, plugins: Reg.defs.filter(d => enabled(d.id)).length, counts: { tasks: S.tasks.length, open: S.tasks.filter(t => !t.done).length, clients: S.clients.filter(c => !c.archived).length, meetings: S.meetings.length } }),
    ui: { icon, reducedMotion, toast, taskRow: (t, o) => { const x = S.tasks.find(y => y.id === (t && t.id || t)); return x ? taskRow(x, o || {}) : ''; }, openTask: id => openTask(id), selected: () => selTask, closeTask: () => closeDrawer(), colorMode: () => S.settings.theme === 'dark' ? 'dark' : 'light', setColorMode: m => { S.settings.theme = m === 'dark' ? 'dark' : 'light'; save(); render(); }, refreshWidgets: () => renderWidgets(), pointer: () => ({ ...lastPointer }), faviconUrl: (d, v) => faviconUrl(d, v), avatar: (c, size) => avatar(c, size), navigate: r => go(r), refresh: () => render(), copy: copyText, esc, modal: openModalHTML, close: closeModal, currentRoute: () => route() },
    storage: { get: k => (S.pluginData[pid] || {})[k], set: (k,v) => { (S.pluginData[pid] = S.pluginData[pid] || {})[k] = v; save(); } },
    get ai(){ return AI; },
    settings: () => clone(S.settings),
    util: { parse: parseQuick, ymd, fmtDate, dueLabel, addDays, todayKey, dueState, fromYmd, fmtTime }
  });
}
function rebuildPlugins(){
  for(const k of ['commands','views','parsers','extractors','taskActions','meetingActions','clientActions','sidebar','listeners','settingsPanels','widgets','chips','cards']) Reg[k] = [];
  for(const def of Reg.defs){
    if(!enabled(def.id)) continue;
    try { def.setup(makeApi(def.id)); } catch(e){ console.error(`Plugin ${def.id} failed`, e); ErrLog.add(`Plugin ${def.id} failed to start: ${e.message}`, e.stack); }
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
    today: o.filter(x => onMe(x) && x.dueDate && x.dueDate <= t).length,
    over: o.filter(x => onMe(x) && dueState(x)==='over').length,
    upcoming: o.filter(x => x.dueDate && x.dueDate > t).length,
    waiting: o.filter(x => x.owner==='client').length,
    dev: o.filter(x => x.owner==='dev').length, devLate: o.some(x => x.owner==='dev' && dueState(x)==='over'),
    inbox: o.filter(x => !x.clientId).length
  };
}
let showPaused = false, showFinished = false;
// recently opened clients/projects, per device and space
const recents = () => { try { return JSON.parse(localStorage.getItem('cadence.recent.' + SPACE) || '[]'); } catch(e){ return []; } };
function touchRecent(id){ try { const l = [id, ...recents().filter(x => x !== id)].slice(0, 12); localStorage.setItem('cadence.recent.' + SPACE, JSON.stringify(l)); } catch(e){} }
const isProject = c => !!c && c.kind === 'project';
// work I'm accountable for: my own tasks, and what I've handed to dev (still on me to land)
const onMe = x => x.owner === 'me' || x.owner === 'dev';
function clientLink(cl, r, o, isPaused){
  const n = o.filter(t => t.clientId===cl.id && t.owner==='me').length, hot = o.some(t => t.clientId===cl.id && t.owner==='me' && dueState(t)==='over');
  return `<a class="${r==='client-'+cl.id?'on':''} ${isPaused?'paused':''}" href="#client-${cl.id}" data-cid="${cl.id}" data-w="${(hot ? 1000 : 0) + n * 10 + (isPaused ? -5 : 0) + (isProject(cl) && !isPaused ? 60 : 0)}"><span class="ic">${avatar(cl, 20)}</span><span class="t">${esc(cl.name)}</span>${n?`<span class="n ${hot?'hot':''}">${n}</span>`:''}</a>`;
}
const NAV_ICONS = {
  today: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
  upcoming: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="8.5" cy="14.5" r=".6"/><circle cx="12" cy="14.5" r=".6"/><circle cx="15.5" cy="14.5" r=".6"/></svg>',
  waiting: '<svg viewBox="0 0 24 24"><path d="M7 3.5h10M7 20.5h10M8 3.5c0 4 8 5.5 8 8.5s-8 4.5-8 8.5M16 3.5c0 4-8 5.5-8 8.5s8 4.5 8 8.5"/></svg>',
  inbox: '<svg viewBox="0 0 24 24"><path d="M3.5 13.5l2.6-7.2A2 2 0 0 1 8 5h8a2 2 0 0 1 1.9 1.3l2.6 7.2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M3.5 13.5H8l1.5 2.5h5l1.5-2.5h4.5"/></svg>',
  dev: '<svg viewBox="0 0 24 24"><path d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5M13.5 5l-3 14"/></svg>',
  grid: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>',
  done: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M8.3 12.3l2.5 2.5 5-5.3"/></svg>',
  keys: '<svg viewBox="0 0 24 24"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7.5 14h9"/></svg>',
  puzzle: '<svg viewBox="0 0 24 24"><path d="M9 4.5a2 2 0 0 1 4 0V6h3.5A1.5 1.5 0 0 1 18 7.5V11h1.5a2 2 0 0 1 0 4H18v3.5a1.5 1.5 0 0 1-1.5 1.5H13v-1.5a2 2 0 0 0-4 0V20H5.5A1.5 1.5 0 0 1 4 18.5V15h1.5a2 2 0 0 0 0-4H4V7.5A1.5 1.5 0 0 1 5.5 6H9z"/></svg>',
  palette: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8h2.2A4.2 4.2 0 0 0 21 10.8C21 6.5 17 3 12 3z"/><circle cx="7.5" cy="11.5" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="15" cy="7.5" r="1"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2.8l1.6 2.3 2.8-.4.9 2.7 2.6 1.1-.5 2.8 1.8 2.2-1.8 2.2.5 2.8-2.6 1.1-.9 2.7-2.8-.4L12 21.2l-1.6-2.3-2.8.4-.9-2.7-2.6-1.1.5-2.8L2.8 12l1.8-2.2-.5-2.8 2.6-1.1.9-2.7 2.8.4z"/></svg>',
};
function projectPage(c, o){
  const all = S.tasks.filter(x => x.clientId === c.id), open = o.filter(x => x.clientId === c.id), t0 = todayKey();
  const done = all.filter(x => x.done), pct = all.length ? Math.round(done.length / all.length * 100) : 0;
  const mine = open.filter(x => x.owner === 'me'), theirs = open.filter(x => x.owner === 'client'), overdue = mine.filter(x => dueState(x) === 'over').length;
  const now = mine.filter(x => x.dueDate && x.dueDate <= t0), next = mine.filter(x => !x.dueDate || x.dueDate > t0);
  const recent = done.filter(x => x.doneAt).sort((a, b) => b.doneAt - a.doneAt).slice(0, 6);
  const weekDone = done.filter(x => x.doneAt && Date.now() - x.doneAt < 7 * 864e5).length;
  let tgt = '';
  if(c.target){ const days = Math.round((new Date(c.target + 'T12:00') - new Date(t0 + 'T12:00')) / 864e5);
    tgt = `<span class="pj-tgt ${days < 0 && c.status !== 'done' ? 'late' : days <= 7 && c.status !== 'done' ? 'soon' : ''}">🎯 ${esc(fmtDate(c.target))}${c.status === 'done' ? '' : days < 0 ? ` · ${-days}d past` : days === 0 ? ' · today' : ` · ${days}d left`}</span>`; }
  const st = c.status === 'done' ? '<span class="badge">Finished</span>' : c.status === 'paused' ? '<span class="badge">Paused</span>' : '';
  return `<div class="c-hero proj"><div class="bg" style="background:radial-gradient(1200px 260px at 85% 0%, ${c.color}30, transparent 70%), linear-gradient(180deg, ${c.color}18, transparent)"></div><div class="head"><div><h1>${avatar(c, 44)}<span class="nm" contenteditable="true" spellcheck="false" data-rename="${c.id}" title="Click to rename">${esc(c.name)}</span> ${st}</h1>
      <div class="sub"><span class="chip">Internal project</span>${tgt}</div>${c.description ? `<div class="c-desc">${esc(c.description)}</div>` : ''}
      <div class="pj-bar" title="${done.length} of ${all.length} done"><i style="width:${pct}%;background:${c.color}"></i></div><div class="pj-pct"><b>${pct}%</b> done · ${done.length} of ${all.length} tasks${weekDone ? ` · ${weekDone} this week` : ''}</div></div>
    <div class="actions">${Reg.clientActions.filter(x => x.primary && x.projects).map(x => `<button class="btn" data-act="client-action" data-i="${Reg.clientActions.indexOf(x)}" data-cid="${c.id}">${esc(x.label)}</button>`).join('')}<button class="btn" data-act="edit-project" data-cid="${c.id}">Edit project</button></div></div></div>
    <div class="stats"><div class="stat"><div class="v">${mine.length}</div><div class="l">To do</div></div><div class="stat"><div class="v" style="color:var(--client)">${theirs.length}</div><div class="l">Waiting on others</div></div><div class="stat"><div class="v" style="color:${overdue ? 'var(--danger)' : 'inherit'}">${overdue}</div><div class="l">Overdue</div></div><div class="stat"><div class="v">${weekDone}</div><div class="l">Done this week</div></div></div>
    ${quickAdd(`Add a task to ${c.name}…  ^ if waiting on someone`, { clientId: c.id })}
    <div class="cols"><div>${group('Now', now, { hideClient: true, drop: 'owner:me' }) || ''}${group('Next', next, { hideClient: true, drop: 'owner:me' }) || (now.length ? '' : `<div class="group" data-drop="owner:me"><div class="group-h">To do</div><div class="muted drop-hint" style="padding:10px 6px">${all.length ? 'All done. 🎉' : 'Break it down: add the first task above.'}</div></div>`)}</div>
    <div>${group('Waiting on others', theirs, { hideClient: true, cls: 'client', drop: 'owner:client' }) || `<div class="group" data-drop="owner:client"><div class="group-h client">Waiting on others</div><div class="muted drop-hint" style="padding:10px 6px">Nothing blocked.</div></div>`}
      ${group('With dev', open.filter(x => x.owner === 'dev'), { hideClient: true, cls: 'dev' })}
      ${recent.length ? `<div class="group"><div class="group-h soft">Recently done</div>${recent.map(x => `<div class="pj-done">✓ <span>${esc(x.title)}</span><em>${esc(fmtDate(ymd(new Date(x.doneAt))))}</em></div>`).join('')}</div>` : ''}</div></div>`;
}
function devPage(o){
  const all = o.filter(x => x.owner === 'dev'), late = all.filter(x => dueState(x) === 'over').length, oldest = Math.max(0, ...all.map(x => daysSince(x.assignedAt)));
  const doneWk = S.tasks.filter(x => x.owner === 'dev' && x.done && x.doneAt && Date.now() - x.doneAt < 7 * 864e5).length, by = {};
  all.forEach(x => (by[x.clientId || '_'] = by[x.clientId || '_'] || []).push(x));
  return `<div class="head"><div><h1>Dev</h1><div class="sub">Work handed to development. Type <kbd>&gt;dev</kbd> in any quick add, or set the owner chip to Dev.</div></div></div>
    <div class="stats"><div class="stat"><div class="v">${all.length}</div><div class="l">With dev</div></div><div class="stat"><div class="v" style="color:${late ? 'var(--danger)' : 'inherit'}">${late}</div><div class="l">Overdue</div></div><div class="stat"><div class="v" style="color:${oldest >= 7 ? 'var(--danger)' : 'inherit'}">${oldest ? oldest + 'd' : '–'}</div><div class="l">Oldest</div></div><div class="stat"><div class="v" style="color:var(--ok)">${doneWk}</div><div class="l">Done this week</div></div></div>
    ${quickAdd('Hand something to dev…  e.g. “Fix the blueprint transition @acme fri”', { owner: 'dev' })}
    ${Object.keys(by).map(k => { const c = client(k); return group(c ? `${avatar(c, 16)} ${esc(c.name)}` : 'No client', by[k], { hideClient: true, hideOwner: true }); }).join('') || emptyState('⚙', 'Nothing with dev', 'Hand a task over from its owner chip, or type >dev in quick add.')}`;
}
function renderSide(){
  const r = route(), c = counts(), o = open();
  const ntile = (id, ic, label, n, hot, title) => `<a class="ntile ${r===id?'on':''}" href="#${id}" title="${title || label}"><span class="ic">${ic}</span><span class="tl">${label}</span>${n ? `<span class="n ${hot?'hot':''}">${n}</span>` : ''}</a>`;
  const nav = (id, ic, label, n, hot) => `<a class="${r===id?'on':''}" href="#${id}"><span class="ic">${ic}</span><span class="t">${label}</span>${n ? `<span class="n ${hot?'hot':''}">${n}</span>` : ''}</a>`;
  const all = S.clients.filter(x => !x.archived).sort((a,b) => a.name.localeCompare(b.name));
  const projects = LIFE() ? [] : all.filter(isProject), cl0 = all.filter(x => !isProject(x) || LIFE());
  const clients = cl0.filter(x => x.status !== 'paused'), paused = cl0.filter(x => x.status === 'paused');
  if(!$('#side-head').firstChild) $('#side-head').innerHTML = `<div class="brand"><span class="logo"></span>Cadence<kbd title="Command palette">⌘K</kbd></div><div class="space-sw" role="tablist" aria-label="Space"><i></i><button data-act="space" data-s="work" role="tab">Work</button><button data-act="space" data-s="life" role="tab">Life</button></div>`;
  $$('#side-head .space-sw button').forEach(b => { b.classList.toggle('on', b.dataset.s === SPACE); b.setAttribute('aria-selected', b.dataset.s === SPACE); });
  $('#side-head .space-sw').dataset.on = SPACE;
  $('#side-main').innerHTML = `
    <nav class="ntiles ${LIFE() ? 'four' : ''}">
      ${ntile('today', NAV_ICONS.today, 'Today', c.today, c.over>0)}
      ${ntile('upcoming', NAV_ICONS.upcoming, 'Upcoming', c.upcoming)}
      ${LIFE() ? '' : ntile('waiting', NAV_ICONS.waiting, 'Waiting', c.waiting, false, 'Waiting on clients')}
      ${LIFE() ? '' : ntile('dev', NAV_ICONS.dev, 'Dev', c.dev, c.devLate)}
      ${ntile('inbox', NAV_ICONS.inbox, 'Inbox', c.inbox)}
      ${ntile('done', NAV_ICONS.done, 'Logbook')}
    </nav>
    ${(() => { const loose = Reg.views.filter(v => !v.group && !v.hidden), ins = Reg.views.filter(v => v.group === 'insights'); const tile = (id, ic, label) => `<a class="vt ${r===id?'on':''}" href="#${id}" aria-label="${label}"><span class="ic">${ic}</span><span class="vl">${label}</span></a>`;
      const items = (ins.length ? [tile('insights', '✦', 'Insights')] : []).concat(loose.map(v => tile('view-'+v.id, esc(v.icon||'◇'), esc(v.title)))); return items.length ? `<div class="sect">Views</div><nav class="vgrid">${items.join('')}</nav>` : ''; })()}
    ${LIFE() ? `<div class="sect">Areas <button data-act="add-client" title="Add an area">+</button></div>
    <nav class="nav">${clients.map(cl => clientLink(cl, r, o)).join('') || (paused.length ? '' : `<a data-act="add-client"><span class="ic">+</span><span class="t muted">Add an area</span></a>`)}
      ${paused.length ? `<div class="more" data-act="toggle-paused">${showPaused ? '▾' : '▸'} Paused <span class="muted">${paused.length}</span></div>${showPaused ? paused.map(cl => clientLink(cl, r, o, true)).join('') : ''}` : ''}</nav>` : (() => {
      // Work: the clients and projects you've opened lately, plus anyone with overdue work; everything else is one click away
      const live = all.filter(x => x.status !== 'done'), rec = recents().map(id => live.find(x => x.id === id)).filter(Boolean);
      const hot = live.filter(x => !rec.includes(x) && o.some(t => t.clientId === x.id && onMe(t) && dueState(t) === 'over')).slice(0, 3);
      let list = rec.slice(0, 4).concat(hot);
      if (list.length < 4) list = list.concat(live.filter(x => !list.includes(x)).sort((x, y) => o.filter(t => t.clientId === y.id).length - o.filter(t => t.clientId === x.id).length).slice(0, 4 - list.length));
      return `<div class="sect">Recent <button data-act="add-client" title="Add client">+</button></div>
        <nav class="nav">${list.map(cl => clientLink(cl, r, o, cl.status === 'paused')).join('') || `<a data-act="add-client"><span class="ic">+</span><span class="t muted">Add your clients</span></a>`}
        ${all.length ? `<a class="all-cl" data-act="all-clients"><span class="ic">${NAV_ICONS.grid || '▦'}</span><span class="t">All clients &amp; projects</span><span class="n">${all.length}</span></a>` : ''}</nav>`; })()}`;
  $('#side-foot').innerHTML = `${DEMO ? `<div class="demo-row"><b>●</b> Demo data<button data-act="demo-reset">Reset</button><button data-act="demo-exit">Exit</button></div>` : ''}
      ${LIFE() ? '' : `<button class="meet-btn" data-act="meeting">${S.activeMeeting ? '● Resume meeting' : '◉ Start meeting'} <kbd style="background:transparent;color:inherit;border-color:currentColor;opacity:.45">M</kbd></button>`}
      <div class="foot-row"><span class="sync ${Store.status==='synced'?'ok':''}" id="sync"><i></i><span>${DEMO ? 'Demo data — not saved' : Store.status==='synced'?(Store.server?'Synced to NAS':'Synced'):'This browser'}</span></span><button data-act="shortcuts" title="Keyboard shortcuts (?)">${NAV_ICONS.keys}</button><button data-act="theme" title="Theme">${NAV_ICONS.palette}</button><button data-act="open-plugins" title="Plugins">${NAV_ICONS.puzzle}</button><button data-act="settings" title="Settings">${NAV_ICONS.gear}</button></div>`;
  fitSide();
  emit('render:side', {});
}
/* the sidebar never scrolls: if the lists don't fit, the quietest clients/projects (no open tasks, not the one you're on)
   fold into "+N more", which opens a searchable picker */
let sideHidden = [];
function fitSide(){
  const m = $('#side-main'); sideHidden = []; if(!m || !m.clientHeight) return;
  const over = () => m.scrollHeight > m.clientHeight + 1;
  if(!over()) return;
  const links = [...m.querySelectorAll('a[data-cid]:not(.on)')].sort((a, b) => (+a.dataset.w) - (+b.dataset.w) || b.textContent.localeCompare(a.textContent));
  if(!links.length) return;
  const nav0 = links[0].closest('.nav'), more = document.createElement('a'); more.className = 'more-cl'; more.dataset.act = 'more-clients';
  (m.querySelector('.nav a[data-cid]') ? m.querySelector('.nav a[data-cid]').closest('.nav') : nav0).appendChild(more);
  for(const a of links){ if(!over()) break; sideHidden.push(a.dataset.cid); a.remove(); more.innerHTML = `<span class="ic">＋</span><span class="t">${sideHidden.length} more</span><kbd>⌘K</kbd>`; }
  if(!sideHidden.length) more.remove();
  // a section left with nothing visible loses its heading too (its items are in "+N more")
  m.querySelectorAll('.nav').forEach(n => { if(!n.querySelector('a') && n.previousElementSibling && n.previousElementSibling.classList.contains('sect')) {
    const k = n.previousElementSibling.querySelector('[data-act=add-project]') ? sideHidden.filter(id => isProject(client(id))).length : 0;
    if(k) n.insertAdjacentHTML('beforeend', `<a class="more-cl" data-act="more-clients"><span class="ic">＋</span><span class="t">${k} in “more”</span></a>`); else n.previousElementSibling.style.display = 'none'; } });
}
// re-fit when the look changes size: theme switches, web fonts arriving
document.addEventListener('cadence:theme', () => setTimeout(() => renderSide(), 80));
document.fonts && document.fonts.ready.then(() => renderSide && renderSide());
let sideFitT; addEventListener('resize', () => { clearTimeout(sideFitT); sideFitT = setTimeout(() => { renderSide(); }, 120); });
/* plugin sidebar widgets: rendered once per plugin rebuild; plugins update their own widget afterwards */
/* plugin sidebar widgets. Top-slot ones sit above the lists. The rest live in a dock: one row of small icons that
   open the widget in a flyout beside the sidebar. Pin a favourite to keep it inline (S.settings.pinnedWidgets). */
const wKey = w => w.pid + ':' + w.id;
const pinnedW = () => S.settings.pinnedWidgets || [];
let dockOpen = null;
function renderWidgets(){
  const box = $('#side-widgets'), top = $('#side-top'); if(!box) return;
  const was = dockOpen; closeDock(true); box.innerHTML = ''; top.innerHTML = '';
  let hold = $('#dock-hold'); if(!hold){ hold = document.createElement('div'); hold.id = 'dock-hold'; hold.hidden = true; document.body.appendChild(hold); } hold.innerHTML = '';
  const dock = document.createElement('div'); dock.className = 'dock';
  for(const w of Reg.sidebar.slice().sort((a,b) => (a.order||0) - (b.order||0))){
    const el = document.createElement('div'); el.className = 'sw'; el.dataset.sw = w.id;
    const def = Reg.defs.find(d => d.id === w.pid) || {}, key = wKey(w), name = w.title || def.name || w.id;
    if(w.slot === 'top') top.appendChild(el);
    else if(pinnedW().includes(key)){ const wrap = document.createElement('div'); wrap.className = 'swp'; wrap.innerHTML = `<button class="sw-dock" data-act="dock-unpin" data-k="${esc(key)}" title="Move ${esc(name)} to the dock">⤓</button>`; wrap.appendChild(el); box.appendChild(wrap); }
    else { hold.appendChild(el); dock.insertAdjacentHTML('beforeend', `<button class="dk" data-act="dock-open" data-k="${esc(key)}" title="${esc(name)}" style="--c:${esc(def.color || 'var(--accent)')}">${def.icon ? `<svg viewBox="0 0 24 24">${def.icon}</svg>` : esc((name[0] || '?').toUpperCase())}</button>`); el.dataset.k = key; el.dataset.name = name; }
    try { w.render(el, makeApi(w.pid)); } catch(e){ console.error('[widget ' + w.id + ']', e); ErrLog.add(`[widget ${w.id}] ${e.message}`, e.stack); }
  }
  if(dock.children.length) box.appendChild(dock);
  if(was){ const b = box.querySelector(`.dk[data-k="${CSS.escape(was)}"]`); if(b) openDock(was, b); }
  requestAnimationFrame(() => renderSide());
}
function openDock(key, btn){
  if(dockOpen === key) return closeDock();
  closeDock(true);
  const el = $(`#dock-hold [data-k="${CSS.escape(key)}"]`); if(!el) return;
  const fly = document.createElement('div'); fly.id = 'dock-fly'; fly.className = 'dock-fly';
  fly.innerHTML = `<div class="df-h"><b>${esc(el.dataset.name)}</b><button data-act="dock-pin" data-k="${esc(key)}" title="Keep it in the sidebar">📌 Pin</button><button data-act="dock-close" title="Close">✕</button></div><div class="df-b"></div>`;
  document.body.appendChild(fly); fly.querySelector('.df-b').appendChild(el);
  const side = $('#side').getBoundingClientRect(), r = btn.getBoundingClientRect();
  fly.style.left = Math.round(side.right + 8) + 'px'; fly.style.bottom = Math.max(10, Math.round(innerHeight - r.bottom)) + 'px';
  dockOpen = key; $$('.dock .dk').forEach(b => b.classList.toggle('on', b.dataset.k === key));
}
function closeDock(quiet){
  const fly = $('#dock-fly'); if(fly){ const el = fly.querySelector('.df-b > .sw'); if(el) ($('#dock-hold') || document.body).appendChild(el); fly.remove(); }
  dockOpen = null; $$('.dock .dk').forEach(b => b.classList.remove('on'));
}
document.addEventListener('mousedown', e => { if(dockOpen && !e.target.closest('#dock-fly, .dock, #pop, #modal')) closeDock(); }, true);
document.addEventListener('keydown', e => { if(e.key === 'Escape' && dockOpen) closeDock(); });
function taskRow(t, opts = {}){
  if(selTask === t.id) return taskEditor(t);
  const c = client(t.clientId), ds = dueState(t);
  const meta = [];
  if(c && !opts.hideClient) meta.push(`<span class="chip">${avatar(c,14)}${esc(c.name)}</span>`);
  if(t.owner === 'client' && !opts.hideOwner) meta.push(`<span class="chip client-owned">↗ ${esc(t.assignee || 'Client')}</span>`);
  if(t.owner === 'dev'){ const d = !t.done ? daysSince(t.assignedAt) : 0; if(!opts.hideOwner || d >= 2) meta.push(`<span class="chip dev-owned ${d >= 7 ? 'old' : ''}" title="With dev${d ? ' for ' + d + ' days' : ', since today'}">⚙ Dev${d >= 2 ? ` · ${d}d` : ''}</span>`); }
  for(const c of Reg.chips){ try { const h = c.fn(t, false); if(h) meta.push(h); } catch(e){} }
  if(t.dueDate) meta.push(`<span class="chip due ${ds}">${ds==='over'?'⚠ ':''}${esc(dueLabel(t))}</span>`);
  if(t.remindAt && !t.reminded && !t.done) meta.push(`<span class="chip due" title="Reminder ${new Date(t.remindAt).toLocaleString()}">🔔</span>`);
  if(t.repeat) meta.push(`<span class="chip due" title="${REPEAT_LABEL(t.repeat)}">↻ ${REPEAT_LABEL(t.repeat)}</span>`);
  if(t.lastChased && t.owner === 'client' && !t.done) meta.push(`<span class="chip due" title="Last chased">✉ chased ${fmtDate(ymd(new Date(t.lastChased))).toLowerCase()}</span>`);
  if(t.priority) meta.push(`<span class="chip pri${t.priority}">${'!'.repeat(t.priority)}</span>`);
  (t.tags||[]).forEach(x => meta.push(`<span class="chip">#${esc(x)}</span>`));
  if(t.notes) meta.push(`<span class="chip due" title="Has notes">≡</span>`);
  if(t.stage && !t.done) meta.unshift(`<span class="chip stage st-${t.stage}">${t.stage === 'doing' ? '▶ In progress' : '⏳ Following up'}</span>`);
  const last = !t.done && (t.log || []).slice(-1)[0];
  return `<div draggable="true" class="task ${t.done?'done':''} ${t.owner==='client'?'client':''} ${t.owner==='dev'?'dev':''} ${t.priority===3?'p3':''} ${selTask===t.id?'sel':''}" data-id="${t.id}">
    <button class="check" data-act="toggle" aria-label="Complete"></button>
    <div class="t-body"><div class="t-title">${esc(t.title)}</div>${last ? `<div class="t-last" title="${t.log.length} step${t.log.length > 1 ? 's' : ''} so far">↳ ${esc(last.text)} · ${esc(fmtDate(ymd(new Date(last.at))).toLowerCase())}</div>` : ''}<div class="t-meta">${meta.join('')}</div></div></div>`;
}
const group = (title, tasks, opts = {}) => tasks.length ? `<div class="group" data-drop="${opts.drop||''}"><div class="group-h ${opts.cls||''}">${title}<span class="c">${tasks.length}</span></div>${sortTasks(tasks).map(t => taskRow(t, opts)).join('')}</div>` : '';
function quickAdd(placeholder, ctx = {}){
  return `<div class="qa" data-ctx='${esc(JSON.stringify(ctx))}'><div class="qa-row"><span class="plus">+</span><input id="qa" autocomplete="off" placeholder="${esc(placeholder)}"><span class="hint">${LIFE() ? '@ area · fri 3pm · every week · !1 · #tag' : '@ client · ^ they owe · >dev · fri 3pm · !1 · #tag'}</span></div><div class="qa-chips" id="qa-chips"></div></div>`;
}
function emptyState(icon, title, sub){ return `<div class="empty"><div class="big">${icon}</div><b>${title}</b>${sub||''}</div>`; }

function renderView(){
  const r = route(), v = $('#view'), t = todayKey(), o = open();
  v.classList.remove('vw-wide');
  let html = '';
  if(r === 'today'){
    const hr = new Date().getHours(), name = (S.settings.myName||'').split(' ')[0];
    const over = o.filter(x => onMe(x) && dueState(x)==='over' );
    const today = o.filter(x => onMe(x) && x.dueDate===t && dueState(x)!=='over');
    const chase = o.filter(x => x.owner==='client' && x.dueDate && x.dueDate <= t);
    const doneToday = S.tasks.filter(x => x.done && x.doneAt && ymd(new Date(x.doneAt))===t).length;
    const totalToday = doneToday + over.length + today.length, pct = totalToday ? doneToday / totalToday : 0;
    const timed = today.filter(x => x.dueTime).sort((a,b) => a.dueTime.localeCompare(b.dueTime));
    const nowHM = `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`, nxt = timed.find(x => x.dueTime >= nowHM) || timed[0];
    const nc = nxt && client(nxt.clientId), upcomingN = o.filter(x => onMe(x) && x.dueDate && x.dueDate > t && x.dueDate <= ymd(addDays(new Date(), 7))).length;
    const glance = S.clients.length ? `<div class="glance">
        <div class="gl" data-go="today" title="Today's progress"><svg class="ring" viewBox="0 0 42 42"><circle cx="21" cy="21" r="17" stroke="color-mix(in srgb,var(--text) 8%,transparent)"/><circle cx="21" cy="21" r="17" stroke="var(--ok)" stroke-dasharray="106.8" stroke-dashoffset="${(106.8 * (1 - pct)).toFixed(1)}" style="transition:stroke-dashoffset .8s"/></svg><div class="tx"><div class="v">${doneToday}<span style="font-size:14px;color:var(--muted);font-weight:600"> / ${totalToday}</span></div><div class="l">${totalToday && doneToday === totalToday ? 'All done today 🎉' : 'done today'}</div></div></div>
        <div class="gl ${over.length && !LIFE() ? 'hot' : ''}" data-go="#g-over"><div class="tx"><div class="v">${over.length}</div><div class="l">${LIFE() ? (over.length ? 'still on the list' : 'all caught up') : over.length ? 'overdue — clear them' : 'nothing overdue'}</div></div></div>
        ${LIFE() ? `<div class="gl" data-go="upcoming"><div class="tx"><div class="v">${upcomingN}</div><div class="l">coming up this week</div></div></div>` : `<div class="gl ${chase.length ? 'warm' : ''}" data-go="waiting"><div class="tx"><div class="v">${chase.length}</div><div class="l">${chase.length ? 'client items to chase' : 'no one to chase'}</div></div></div>`}
        <div class="gl" ${nxt ? `data-task="${nxt.id}"` : 'data-go="upcoming"'}><span class="ic2">${nc ? avatar(nc, 34) : nxt ? '⏰' : '🗓️'}</span><div class="tx"><div class="nx">${nxt ? esc(nxt.title) : upcomingN ? upcomingN + ' coming up this week' : 'Nothing timed today'}</div><div class="l">${nxt ? 'Next · ' + fmtTime(nxt.dueTime) + (nc ? ' · ' + esc(nc.name) : '') : 'Upcoming'}</div></div></div>
      </div>` : '';
    html = `<div class="head"><div><h1 class="hello">Good ${hr<12?'morning':hr<18?'afternoon':'evening'}${name?', '+esc(name):''}</h1><div class="sub">${new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})} · ${over.length+today.length} to do${doneToday?` · ${doneToday} done today`:''}</div></div></div>
      ${glance}${quickAdd(LIFE() ? 'Add something for today…  e.g. “Call mom @health 6pm”' : 'Add a task for today…  e.g. “Send SOW @acme 3pm”', { defaultDate:'today' })}
      <div id="g-over"></div>${LIFE() ? group('Still on the list', over, {cls:'soft'}) : group('Overdue', over, {cls:'danger'})}${group('Today', today)}${LIFE() ? '' : group('Follow up — client items due', chase, {cls:'client'})}
      ${!over.length && !today.length && (LIFE() || !chase.length) ? (S.clients.length ? (LIFE() ? emptyState('🌿','Nothing for today','<span>Enjoy it. Plan ahead in Upcoming whenever you like.</span>') : emptyState('☀','Nothing due today','<span>Plan ahead in Upcoming, or start a meeting with <kbd>M</kbd>.</span>')) : onboarding()) : ''}`;
  } else if(r === 'upcoming'){
    const up = o.filter(x => x.dueDate && x.dueDate > t);
    const byDay = {}; up.forEach(x => (byDay[x.dueDate] = byDay[x.dueDate] || []).push(x));
    html = `<div class="head"><div><h1>Upcoming</h1><div class="sub">Everything scheduled after today</div></div></div>${quickAdd('Schedule something…  e.g. “Review blueprint @northwind next week”')}
      ${Object.keys(byDay).sort().map(k => group(`${fmtDate(k)} <span class="c" style="font-weight:400">${fromYmd(k).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span>`, byDay[k])).join('') || emptyState('◷','Nothing scheduled','Type a date like “fri”, “nov 20” or “in 3 days”.')}`;
  } else if((r === 'waiting' || r === 'dev') && LIFE()){ location.hash = 'today'; return;
  } else if(r === 'dev'){ html = devPage(o);
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
    const c = client(r.slice(7)); if(c) touchRecent(c.id);
    if(!c){ html = emptyState('?', LIFE() ? 'Area not found' : 'Client not found',''); }
    else if(LIFE()){
      // an area of your life: one calm list, no clients, meetings or chasing
      const list = o.filter(x => x.clientId === c.id), t0 = todayKey();
      const now = list.filter(x => !x.dueDate || x.dueDate <= t0), later = list.filter(x => x.dueDate && x.dueDate > t0);
      const doneWeek = S.tasks.filter(x => x.clientId === c.id && x.done && x.doneAt && Date.now() - x.doneAt < 7 * 864e5).length;
      html = `<div class="c-hero area"><div class="bg" style="background:radial-gradient(1200px 260px at 85% 0%, ${c.color}30, transparent 70%), linear-gradient(180deg, ${c.color}18, transparent)"></div><div class="head"><div><h1>${avatar(c, 44)}<span class="nm" contenteditable="true" spellcheck="false" data-rename="${c.id}" title="Click to rename">${esc(c.name)}</span></h1><div class="sub">${list.length} open${doneWeek ? ` · ${doneWeek} done this week` : ''}</div></div>
        <div class="actions">${Reg.clientActions.filter(x => x.primary).map(x => `<button class="btn" data-act="client-action" data-i="${Reg.clientActions.indexOf(x)}" data-cid="${c.id}">${esc(x.label)}</button>`).join('')}<button class="btn ghost" data-act="client-menu" data-cid="${c.id}" title="More">•••</button></div></div></div>
        ${quickAdd(`Add something for ${c.name}…  e.g. “Replace the furnace filter every 3 months”`, { clientId: c.id })}
        ${group('Now', now, { hideClient: true }) || ''}${group('Later', later, { hideClient: true }) || ''}
        ${!list.length ? emptyState(c.icon || '🌿', 'Nothing here yet', 'Add the first thing above. Repeating things like “every 3 months” work too.') : ''}`;
    }
    else if(isProject(c)) html = projectPage(c, o);
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
        <div class="cols"><div>${group('On me', mine, {hideClient:true, drop:'owner:me'}) || `<div class="group" data-drop="owner:me"><div class="group-h">On me</div><div class="muted drop-hint" style="padding:10px 6px">All clear.</div></div>`}${group('With dev', o.filter(x => x.clientId===c.id && x.owner==='dev'), {hideClient:true, hideOwner:true, cls:'dev'})}</div>
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
  } else if(r === 'plugins'){
    renderPlugins(v); applyKb(); emit('render', { route: r }); return;
  } else if(r.startsWith('view-')){
    const pv = Reg.views.find(x => 'view-'+x.id === r);
    v.classList.toggle('vw-wide', !!(pv && pv.wide));
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
  stage: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/></svg>',
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
      <textarea class="te-title" data-tf="title" rows="1" spellcheck="false" aria-label="Title">${esc(t.title)}</textarea>
      <textarea class="te-notes" data-tf="notes" rows="1" placeholder="Notes">${esc(t.notes || '')}</textarea>
      ${(t.log || []).length ? `<div class="te-log">${t.log.map((l, i) => `<div class="te-step"><i></i><span>${esc(l.text)}</span><em>${esc(fmtDate(ymd(new Date(l.at))))}</em><button data-act="step-del" data-i="${i}" title="Remove this step">✕</button></div>`).join('')}</div>` : ''}
      ${Reg.cards.map(c => { try { return c.fn(t) || ''; } catch(e){ return ''; } }).join('')}
      <div class="te-chips">
        ${chip('due', t.dueDate ? dueLabel({ dueDate: t.dueDate }) : 'Date', !!t.dueDate, ds)}
        ${t.dueDate ? chip('time', t.dueTime ? fmtTime(t.dueTime) : 'Time', !!t.dueTime) : ''}
        <button class="te-chip ${c ? 'on' : ''}" data-te="client">${c ? avatar(c, 15) : TE_ICONS.client}<span>${c ? esc(c.name) : 'Client'}</span></button>
        ${chip('owner', t.owner === 'client' ? (esc(t.assignee) || 'Client') + '’s' : t.owner === 'dev' ? 'Dev' : 'Mine', t.owner !== 'me', t.owner === 'client' ? 'cl' : t.owner === 'dev' ? 'tm' : '')}
        ${chip('stage', STAGE_LABEL[t.stage] || 'Progress', !!t.stage, t.stage ? 'st-' + t.stage : '')}
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
    const ck = on => on ? '<span class="ck">✓</span>' : '';
    return popover(el, `<div class="pop-list"><button class="pop-i" data-o="me">Mine${ck(t.owner==='me')}</button><button class="pop-i" data-o="client">Client’s action item${ck(t.owner==='client')}</button>${LIFE() ? '' : `<button class="pop-i" data-o="dev">⚙ Dev${ck(t.owner==='dev')}</button>`}</div><div class="pop-row"><input class="inp" placeholder="Who at the client? (optional)" value="${esc(t.owner === 'client' ? t.assignee || '' : '')}"></div>`, (p, close) => {
      const i = p.querySelector('input');
      p.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { up({ owner: b.dataset.o, assignee: b.dataset.o === 'client' ? i.value.trim() : '' }); close(); });
      i.onkeydown = e => { if(e.key === 'Enter'){ up({ owner: 'client', assignee: i.value.trim() }); close(); } };
    }, { w: 240 });
  }
  if(key === 'repeat'){
    const opts = [['', 'Does not repeat'], ['day:1','Daily'], ['weekday:1','Every weekday'], ['week:1','Weekly'], ['week:2','Every 2 weeks'], ['month:1','Monthly'], ['month:3','Every 3 months'], ['month:6','Twice a year'], ['month:12','Yearly']];
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
  if(key === 'stage'){
    const ck = on => on ? '<span class="ck">✓</span>' : '';
    return popover(el, `<div class="pop-list"><button class="pop-i" data-s="">Not started${ck(!t.stage)}</button><button class="pop-i" data-s="doing">▶ In progress${ck(t.stage === 'doing')}</button><button class="pop-i" data-s="waiting">⏳ Did my part, follow up…${ck(t.stage === 'waiting')}</button></div><div class="pop-sect">History</div><div class="pop-list"><button class="pop-i" data-s="log">✎ Log a step${(t.log || []).length ? `<span class="muted" style="margin-left:auto;font-size:11.5px">${t.log.length} so far</span>` : ''}</button></div>`, (p, close) => {
      p.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { close(); const v = b.dataset.s; if(v === 'waiting' || v === 'log') stepDialog(t.id, v === 'log'); else up({ stage: v || null }); });
    }, { w: 250 });
  }
  if(key === 'more'){
    return popList(el, Reg.taskActions.map(a => ({ a, label: a.label })), it => { try { it.a.run(clone(S.tasks.find(x => x.id === t.id)), makeApi(it.a.pid)); } catch(e){ toast(e.message); } }, { w: 220 });
  }
  if(key === 'delete'){
    const gone = removeTask(t.id); selTask = null; renderSide(); renderView();
    if(gone) toast(`Deleted “${gone.title}”`, [{ label:'Undo', run: () => { S.tasks.push(gone); save(); render(); } }]);
  }
}
/* in-progress work: log what you did and when to follow up. The task stays open, comes back on the follow-up date,
   and keeps a short history ("Opened a ticket with Zoho support" → "They asked for logs" → done). */
const STAGE_LABEL = { doing: 'In progress', waiting: 'Following up' };
function stepDialog(id, logOnly){
  const t = S.tasks.find(x => x.id === id); if(!t) return;
  const opts = [['1', 'Tomorrow'], ['2', 'In 2 days'], ['3', 'In 3 days'], ['7', 'Next week'], ['14', 'In 2 weeks'], ['', 'No date']];
  let pick = logOnly ? null : '3';
  const last = (t.log || []).slice(-1)[0];
  openModalHTML(logOnly ? 'Log a step' : 'Did your part?', `<div class="muted" style="margin:-4px 0 12px;font-size:13px">${esc(t.title)}</div>
    <div class="field"><label>What did you do?</label><input class="inp" id="st-text" placeholder="${t.stage === 'waiting' && last ? 'Followed up again' : 'Opened a ticket with Zoho support (#123)'}"></div>
    ${logOnly ? '' : `<div class="field"><label>Follow up</label><div class="seg wrap" id="st-when">${opts.map(([v, l]) => `<button data-v="${v}" class="${v === pick ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="row" style="gap:8px;margin-top:8px;align-items:center"><span class="muted" style="font-size:12.5px">or on</span><input class="inp" type="date" id="st-date" style="width:auto"></div></div>`}
    ${(t.log || []).length ? `<div class="field"><label>So far</label><div class="te-log">${t.log.map(l => `<div class="te-step"><i></i><span>${esc(l.text)}</span><em>${esc(fmtDate(ymd(new Date(l.at))))}</em></div>`).join('')}</div></div>` : ''}`,
    `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="st-save">${logOnly ? 'Add to history' : 'Save, follow up later'}</button>`);
  $$('#st-when button').forEach(b => b.onclick = () => { pick = b.dataset.v; $('#st-date').value = ''; $$('#st-when button').forEach(x => x.classList.toggle('on', x === b)); });
  const d = $('#st-date'); if(d) d.onchange = () => { pick = null; $$('#st-when button').forEach(x => x.classList.remove('on')); };
  const save2 = () => {
    const text = $('#st-text').value.trim() || (logOnly ? '' : t.stage === 'waiting' ? 'Followed up' : 'Did my part');
    if(!text) return $('#st-text').focus();
    const patch = { log: [...(t.log || []), { at: Date.now(), text: capFirst(text) }] };
    if(!logOnly){ patch.stage = 'waiting'; const when = d && d.value ? d.value : pick ? ymd(addDays(new Date(), +pick)) : null; patch.dueDate = when; if(!when) patch.dueTime = null; }
    updateTask(id, patch); closeModal(); render();
    if(!logOnly) toast(patch.dueDate ? `Back on your list ${dueLabel({ dueDate: patch.dueDate }).toLowerCase()}` : 'Marked as following up');
  };
  $('#st-save').onclick = save2; $('#st-text').onkeydown = e => { if(e.key === 'Enter') save2(); };
  setTimeout(() => $('#st-text')?.focus(), 30);
}
function openTask(id){
  if(selTask === id) return;
  selTask = id; kbId = id; renderView();
  const ti = $('#view .task.open .te-title'); if(ti){ ti.focus({ preventScroll: true }); ti.setSelectionRange(ti.value.length, ti.value.length); autosize(ti); }
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
  if(f === 'title' && /\n/.test(e.target.value)) e.target.value = e.target.value.replace(/\s*\n+\s*/g, ' ');   // one line of text, wrapped
  if(f === 'notes' || f === 'title') autosize(e.target);
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
    { title: LIFE() ? 'Switch to Work' : 'Switch to Life', k:'⇧L', run: () => { closeModal(); switchSpace(); } },
    ...(LIFE() ? [] : [{ title: S.activeMeeting ? 'Resume meeting' : 'Start meeting', k:'M', run: () => { closeModal(); startMeeting(); } }]),
    { title: LIFE() ? 'Add an area' : 'Add client', run: () => promptClient() },
    ...(LIFE() ? [] : [{ title:'New project', run: () => promptProject() }, { title:'Open Dev', run: () => { closeModal(); go('dev'); } }]),
    { title:'Copy error log', run: () => { closeModal(); ErrLog.list().length ? ErrLog.copy() : toast('No errors logged this session 👍'); } },
    { title:'Toggle dark mode', run: () => { closeModal(); S.settings.theme = S.settings.theme==='dark'?'light':'dark'; save(); render(); } },
    { title:'Settings & plugins', run: () => openSettings() },
    { title:'Review sync clashes', run: () => openConflicts() },
    { title:'Keyboard shortcuts', k:'?', run: () => showShortcuts() },
    { title:'Go to Today', run: () => { closeModal(); go('today'); } },
    { title:'Go to Upcoming', run: () => { closeModal(); go('upcoming'); } },
    ...(LIFE() ? [] : [{ title:'Go to Waiting on clients', run: () => { closeModal(); go('waiting'); } }]),
    ...S.clients.filter(c => !c.archived).map(c => ({ title:`${LIFE() ? 'Open area' : isProject(c) ? 'Open project' : 'Open client'}: ${c.name}`, run: () => { closeModal(); go('client-'+c.id); } })),
    ...(LIFE() ? [] : S.clients.filter(c => !c.archived).map(c => ({ title:`Start meeting with ${c.name}`, run: () => { closeModal(); startMeeting(c.id); } }))),
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
const AREA_EMOJI = ['🏠','💚','💰','🛠️','🚗','🎓','⚽','🍳','🧺','🌱','🐶','✈️','🎨','📚','👶','🎵','🏃','🛒','🧘','🎁'];
function promptArea(existing){
  const c = existing ? client(existing) : null;
  let icon = c ? c.icon || '🌱' : AREA_EMOJI[S.clients.length % AREA_EMOJI.length], color = c ? c.color : COLORS[S.clients.length % COLORS.length];
  openModalHTML(c ? 'Edit area' : 'New area', `<div class="field"><label>Name</label><input class="inp" id="ar-name" value="${esc(c ? c.name : '')}" placeholder="Kids, Car, Garden, Side project…"></div>
    <div class="field"><label>Icon</label><div class="ar-emoji">${AREA_EMOJI.map(e => `<button data-e="${e}" class="${e === icon ? 'on' : ''}">${e}</button>`).join('')}</div></div>
    <div class="field"><label>Colour</label><div class="swatches">${COLORS.map(x => `<button data-c="${x}" style="background:${x}" class="${x === color ? 'on' : ''}"></button>`).join('')}</div></div>`,
    `${c ? `<button class="btn ghost danger" id="ar-arch" style="margin-right:auto">Archive</button>` : ''}<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="ar-save">${c ? 'Save' : 'Add area'}</button>`);
  $$('.ar-emoji button').forEach(b => b.onclick = () => { icon = b.dataset.e; $$('.ar-emoji button').forEach(x => x.classList.toggle('on', x === b)); });
  $$('.swatches button').forEach(b => b.onclick = () => { color = b.dataset.c; $$('.swatches button').forEach(x => x.classList.toggle('on', x === b)); });
  const name = $('#ar-name'); name.focus();
  const done = () => { const n = name.value.trim(); if(!n) return name.focus();
    if(c){ c.name = n; c.icon = icon; c.color = color; } else { const a = addClient(n, color); if(a){ a.icon = icon; a.domain = ''; } }
    save(); closeModal(); render(); if(!c){ const a = S.clients.find(x => x.name.toLowerCase() === n.toLowerCase()); if(a) go('client-' + a.id); } };
  $('#ar-save').onclick = done; name.onkeydown = e => { if(e.key === 'Enter') done(); };
  if(c) $('#ar-arch').onclick = () => { c.archived = true; save(); closeModal(); go('today'); };
}
/* internal projects (Work): same record as a client, kind 'project'. No website, meetings or chasing; a target date and progress instead */
const PROJECT_EMOJI = ['🛠️','🚀','📦','🧪','📚','🧭','🏗️','💡','🧰','📣','🎯','⚙️','🗂️','🌱'];
function promptProject(existing){
  const c = existing ? client(existing) : null;
  let icon = c ? c.icon || '🛠️' : PROJECT_EMOJI[S.clients.filter(isProject).length % PROJECT_EMOJI.length], color = c ? c.color : COLORS[S.clients.length % COLORS.length], status = c ? (c.status || 'active') : 'active';
  openModalHTML(c ? 'Edit project' : 'New project', `<div class="field"><label>Name</label><input class="inp" id="pj-name" value="${esc(c ? c.name : '')}" placeholder="Internal tooling, website refresh, onboarding kit…"></div>
    <div class="field"><label>What's it for <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label><textarea class="inp" id="pj-desc" style="min-height:52px" placeholder="The goal, in a sentence">${esc(c ? c.description || '' : '')}</textarea></div>
    <div class="row" style="gap:12px;align-items:flex-start"><div class="field" style="flex:1"><label>Target date <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label><input class="inp" type="date" id="pj-target" value="${esc(c ? c.target || '' : '')}"></div>
      <div class="field" style="flex:1.4"><label>Status</label><div class="seg" id="pj-status">${[['active','Active'],['paused','Paused'],['done','Finished']].map(([v,l]) => `<button data-v="${v}" class="${status===v?'on':''}">${l}</button>`).join('')}</div></div></div>
    <div class="field"><label>Icon</label><div class="ar-emoji">${PROJECT_EMOJI.map(e => `<button data-e="${e}" class="${e === icon ? 'on' : ''}">${e}</button>`).join('')}</div></div>
    <div class="field"><label>Colour</label><div class="swatches">${COLORS.map(x => `<button data-c="${x}" style="background:${x}" class="${x === color ? 'on' : ''}"></button>`).join('')}</div></div>`,
    `${c ? `<button class="btn ghost danger" id="pj-arch">Archive</button><button class="btn ghost" id="pj-client" style="margin-right:auto" title="Turn it back into a client">Make it a client</button>` : ''}<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="pj-save">${c ? 'Save' : 'Create project'}</button>`);
  $$('#modal .ar-emoji button').forEach(b => b.onclick = () => { icon = b.dataset.e; $$('#modal .ar-emoji button').forEach(x => x.classList.toggle('on', x === b)); });
  $$('#modal .swatches button').forEach(b => b.onclick = () => { color = b.dataset.c; $$('#modal .swatches button').forEach(x => x.classList.toggle('on', x === b)); });
  $$('#pj-status button').forEach(b => b.onclick = () => { status = b.dataset.v; $$('#pj-status button').forEach(x => x.classList.toggle('on', x === b)); });
  const done = id => { save(); closeModal(); render(); if(id) go('client-' + id); };
  $('#pj-save').onclick = () => {
    const n = $('#pj-name').value.trim(); if(!n) return $('#pj-name').focus();
    const patch = { kind: 'project', icon, color, status, target: $('#pj-target').value || '', description: $('#pj-desc').value.trim() };
    if(c){ Object.assign(c, { name: n }, patch); emit('client:update', clone(c)); done(); return; }
    const ex = S.clients.find(x => norm(x.name) === norm(n));
    if(ex && !isProject(ex) && !ex.archived){ toast(`${ex.name} is already a client. Open it and choose “Make it a project”.`); return; }
    const p = addClient(n, color); Object.assign(p, patch); emit('client:update', clone(p)); done(p.id);
  };
  setTimeout(() => $('#pj-name')?.focus(), 30);
  if(c){
    $('#pj-arch').onclick = () => { c.archived = true; emit('client:update', clone(c)); save(); closeModal(); go('today'); render(); toast(`Archived ${c.name}`, [{ label: 'Undo', run: () => { c.archived = false; save(); render(); } }]); };
    $('#pj-client').onclick = () => { delete c.kind; emit('client:update', clone(c)); save(); closeModal(); render(); toast(`${c.name} is a client again`); };
  }
}
function promptClient(existing){
  if(LIFE()) return promptArea(existing);
  if(existing && isProject(client(existing))) return promptProject(existing);
  const c = existing ? client(existing) : null;
  const draft = { name: c ? c.name : '', domain: c ? (c.domain||'') : '', color: c ? c.color : COLORS[S.clients.length % COLORS.length], status: c ? (c.status||'active') : 'active', info: null, logoV: c ? c.logoV : null };
  openModalHTML(c ? 'Edit client' : 'Add client', `
    <div class="fav-prev"><span id="cl-av"></span><div style="flex:1"><div class="field"><label>Name</label><input class="inp" id="cl-name" value="${esc(draft.name)}" placeholder="Client or project name"></div></div></div>
    <div class="field"><label>Website</label><div class="row"><input class="inp" id="cl-domain" value="${esc(draft.domain)}" placeholder="acme.com — pulls in their logo, industry & description">${Store.server ? `<button class="btn" id="cl-refresh" title="Fetch logo, industry and description from the website">↻ Fetch details</button>` : ''}</div><span class="suggest" id="cl-guess"></span><div class="muted" id="cl-found" style="font-size:12px;margin-top:6px">${Store.server ? '' : 'Logo, industry and description are fetched automatically when Cadence runs on your NAS.'}</div></div>
    <div class="row" style="gap:12px"><div class="field" style="flex:1"><label>Industry</label><select class="inp" id="cl-ind"><option value="">—</option>${Object.entries(INDUSTRY).map(([k,v]) => `<option value="${k}" ${c && c.industry===k?'selected':''}>${v.icon}  ${esc(v.label)}</option>`).join('')}</select></div></div>
    <div class="field"><label>About</label><textarea class="inp" id="cl-desc" style="min-height:56px" placeholder="What they do, in a sentence">${esc(c ? c.description || '' : '')}</textarea></div>
    <div class="field"><label>Status</label><div class="seg" id="cl-status"><button data-v="active" class="${draft.status!=='paused'?'on':''}">Active</button><button data-v="paused" class="${draft.status==='paused'?'on':''}">Paused</button></div><div class="muted" style="font-size:12px;margin-top:6px">Paused clients move to a collapsed section in the sidebar. Their tasks stay visible.</div></div>
    <div class="field"><label>Color <span style="text-transform:none;letter-spacing:0;font-weight:400">— used when there's no logo</span></label><div class="swatches" id="cl-sw">${COLORS.map(col => `<button style="background:${col}" data-col="${col}" class="${draft.color===col?'on':''}"></button>`).join('')}</div></div>`,
    (c ? `<button class="btn ghost danger" data-act="archive-client" data-cid="${c.id}">${c.archived?'Unarchive':'Archive'}</button><button class="btn ghost" data-act="make-project" data-cid="${c.id}" style="margin-right:auto" title="Not really a client? Track it as internal work">Make it a project</button>` : '') + `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="save-client" data-cid="${c ? c.id : ''}">${c ? 'Save' : 'Add client'}</button>`);
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
  refresh(); setTimeout(() => (c ? $('#cl-domain') : $('#cl-name'))?.focus(), 20);
}

/* ---------- settings ---------- */
let settingsTab = 'general';
const plugUI = { q:'', cat:'All', open:null, tab:'active' };
/* ---------- plugin browser (its own page: #plugins) ---------- */
function hasSettings(pid){ const d = Reg.defs.find(x => x.id === pid); return !!(d && enabled(pid) && (d.settings || Reg.settingsPanels.some(x => x.pid === pid))); }
function openPluginSettings(pid){
  const d = Reg.defs.find(x => x.id === pid); if(!d) return;
  if(!enabled(pid)) return toast(`Turn ${d.name || pid} on to change its settings`);
  const panel = Reg.settingsPanels.find(x => x.pid === pid);
  closeModal();
  setTimeout(() => { try { (d.settings ? d.settings : panel.fn)(makeApi(pid)); } catch(e){ toast('Settings failed: ' + e.message); } }, 40);
}
function pluginAdds(pid){
  const by = k => Reg[k].filter(x => x.pid === pid);
  const out = [];
  by('views').forEach(v => out.push(['View', v.title]));
  by('sidebar').forEach(w => out.push(['Sidebar', w.title || 'A panel in the sidebar']));
  by('widgets').forEach(w => out.push(['Widget', w.title || w.id]));
  by('commands').forEach(c => out.push(['⌘K', c.title]));
  by('clientActions').forEach(a => out.push(['Client', (a.label || '').replace(/^\W+/, '')]));
  by('taskActions').forEach(a => out.push(['Task', a.label]));
  by('meetingActions').forEach(a => out.push(['Meeting', a.label]));
  by('extractors').forEach(x => out.push(['Importer', x.name]));
  by('parsers').forEach(() => out.push(['Quick add', 'syntax']));
  return out;
}
function renderPlugins(v){
  const all = Reg.defs.filter(d => spaceOk(d.id)), on = all.filter(d => enabled(d.id)), off = all.filter(d => !enabled(d.id)), mine = all.filter(d => d.userCode);
  const tabs = [['active', 'Active', on.length], ['available', 'Turned off', off.length], ['all', 'All', all.length], ['yours', 'Yours', mine.length]];
  const base = { active: on, available: off, all, yours: mine }[plugUI.tab] || on;
  const cats = [...new Set(base.map(d => d.category || 'Other'))].sort((a, b) => PLUG_CATS.indexOf(a) - PLUG_CATS.indexOf(b));
  if(plugUI.cat !== 'All' && !cats.includes(plugUI.cat)) plugUI.cat = 'All';
  v.innerHTML = `<div class="pb">
    <div class="pb-hero"><div><h1>Plugins</h1><div class="sub">${on.length} of ${all.length} on in <b>${LIFE() ? 'Life' : 'Work'}</b>. Each space has its own set. Cadence is whatever you make it: switch things on, tune them, or write your own.</div></div>
      <div class="pb-search">${NAV_ICONS.puzzle}<input id="pb-q" placeholder="Search plugins…" value="${esc(plugUI.q)}" autocomplete="off"></div></div>
    <div class="pb-tabs">${tabs.map(([k, l, n]) => `<button class="${plugUI.tab === k ? 'on' : ''}" data-act="pl-tab" data-t="${k}">${l}<span>${n}</span></button>`).join('')}<button class="pb-dev" data-act="set-tab" data-tab="dev">+ Write a plugin</button></div>
    <div class="pl-cats">${['All', ...cats].map(c => `<button class="${c === plugUI.cat ? 'on' : ''}" data-act="pl-cat" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <div class="pb-grid" id="pb-grid"></div>
    ${plugUI.open ? pluginDetail(plugUI.open) : ''}</div>`;
  const grid = () => {
    const q = plugUI.q.toLowerCase();
    const list = base.filter(d => (plugUI.cat === 'All' || (d.category || 'Other') === plugUI.cat) && (!q || [d.name, d.id, d.tagline, d.description, d.category].join(' ').toLowerCase().includes(q)));
    $('#pb-grid').innerHTML = list.map(d => {
      const adds = enabled(d.id) ? pluginAdds(d.id) : [], kinds = [...new Set(adds.map(x => x[0]))].slice(0, 3);
      return `<div class="pl-card pb-card ${enabled(d.id) ? '' : 'off'} ${plugUI.open === d.id ? 'sel' : ''}" data-act="pl-open" data-pid="${esc(d.id)}" style="--pc:${esc(d.color || '#5b5bd6')}">
        <div class="pb-top">${plugIcon(d, 44)}<div class="pb-act">${hasSettings(d.id) ? `<button class="pb-gear" data-act="pl-settings" data-pid="${esc(d.id)}" title="Settings">${NAV_ICONS.gear}</button>` : ''}<button class="switch sm ${enabled(d.id) ? 'on' : ''}" data-act="toggle-plugin" data-pid="${esc(d.id)}" aria-label="Turn ${esc(d.name || d.id)} ${enabled(d.id) ? 'off' : 'on'}"></button></div></div>
        <b>${esc(d.name || d.id)}</b><span class="pb-tag">${esc(d.tagline || d.description || '')}</span>
        <div class="pb-foot"><i>${esc(d.category || 'Other')}</i>${d.spaces && d.spaces.length === 1 ? `<i>${d.spaces[0] === 'work' ? 'Work only' : 'Life only'}</i>` : ''}${kinds.map(k => `<i class="k">${esc(k)}</i>`).join('')}${d.userCode ? '<i class="k">Yours</i>' : ''}</div>
      </div>`; }).join('') || `<div class="pb-empty">${plugUI.tab === 'available' && !q ? 'Everything is switched on. Bold.' : 'No plugins match.'}</div>`;
  };
  grid();
  const qi = $('#pb-q'); qi.oninput = () => { plugUI.q = qi.value; grid(); };
  if(plugUI.q) { qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); }
}
function pluginDetail(pid){
  const d = Reg.defs.find(x => x.id === pid); if(!d) return '';
  const adds = enabled(pid) ? pluginAdds(pid) : [];
  return `<div class="pb-scrim" data-act="pl-close"></div><aside class="pb-detail" style="--pc:${esc(d.color || '#5b5bd6')}">
    <button class="pb-x" data-act="pl-close" aria-label="Close">✕</button>
    <div class="pb-dh">${plugIcon(d, 64)}<div><h2>${esc(d.name || d.id)}</h2><div class="muted">${esc(d.tagline || '')}</div></div></div>
    <div class="pb-dbtns"><button class="btn ${enabled(pid) ? '' : 'primary'}" data-act="toggle-plugin" data-pid="${esc(pid)}">${enabled(pid) ? 'Turn off' : 'Turn on'}</button>
      ${hasSettings(pid) ? `<button class="btn primary" data-act="pl-settings" data-pid="${esc(pid)}">${NAV_ICONS.gear} Settings</button>` : ''}
      ${d.userCode ? `<button class="btn ghost danger" data-act="remove-plugin" data-pid="${esc(pid)}">Remove</button>` : ''}</div>
    <p>${esc(d.description || '')}</p>
    ${adds.length ? `<div class="pb-sec">What it adds</div><ul class="pb-adds">${adds.map(([k, t]) => `<li><i>${esc(k)}</i>${esc(t)}</li>`).join('')}</ul>` : enabled(pid) ? '' : '<div class="pb-sec">Turn it on to see what it adds.</div>'}
    <div class="pb-meta"><span>v${esc(d.version || '1.0')}</span><span>${d.userCode ? 'Installed by you' : 'Built-in'}</span><span>${esc(d.category || 'Other')}</span><span class="mono">${esc(d.id)}</span></div>
  </aside>`;
}
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
  } else if(settingsTab === 'plugins' && !openSettings.legacy){
    settingsTab = 'general'; closeModal(); go('plugins'); return;
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
    el.innerHTML = `<div class="m-head"><b style="font-size:15px">Review action items</b>${clientSel}<span class="muted">${elapsed(M.start)} meeting</span><span style="margin-left:auto"></span><button class="btn" data-act="m-tidy" title="Clean up bullets, prefixes, names, dates and duplicates">Tidy up</button>${AI ? '<button class="btn" data-act="m-ai" title="Rewrite titles as clear tasks">Fix wording with AI</button>' : ''}<button class="btn ghost" data-act="m-back">← Back to meeting</button><button class="btn ghost danger" data-act="m-discard">Discard</button></div>
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
  const me = norm((S.settings.myName || '').split(' ')[0] || '');
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
  if(!AI || !AI.json) return toast('AI isn’t set up on your NAS');
  const items = M.items.filter(i => i.include);
  const j = job('aiword', 'Claude is polishing the wording', { sub: `${items.length} action items` });
  try {
    const out = await AI.json(`Rewrite these meeting action items as short, clear task titles: start with a verb, keep names, numbers and product names (e.g. Zoho CRM), no trailing punctuation, no dates (they are stored separately). Return a JSON array of {"id","title"} in the same order.\n\n${JSON.stringify(items.map(i => ({ id: i.id, title: i.title })))}`, { modelTier: 'fast' });
    let n = 0; for(const o of (Array.isArray(out) ? out : [])){ const it = M.items.find(x => x.id === o.id); if(it && o.title && o.title !== it.title){ it.title = capFirst(String(o.title).slice(0, 200)); n++; } }
    save(); renderMeeting(); j.done({ title: n ? `Reworded ${n} item${n === 1 ? '' : 's'}` : 'Already clear', sub: 'Undo isn’t needed: edit any title inline' });
  } catch(e){ j.dismiss(); toast('AI wording failed: ' + e.message); }
}
function meetingBand(c){
  if(!c) return '';
  const pal = [...((c.brand && c.brand.palette) || []), c.brand && c.brand.primary, c.themeColor, c.color].filter(x => /^#[0-9a-f]{3,8}$/i.test(x || ''));
  const [a1, a2, a3] = [pal[0] || c.color, pal[1] || pal[0] || c.color, pal[2] || pal[1] || pal[0] || c.color];
  const o = open(), mine = o.filter(t => t.clientId === c.id && onMe(t)).length, theirs = o.filter(t => t.clientId === c.id && t.owner === 'client').length;
  const last = S.meetings.filter(m => m.clientId === c.id).sort((x, y) => y.start - x.start)[0], ind = INDUSTRY[c.industry];
  const talk = (c.research && c.research.talking) || [];
  return `<div class="m-band" style="--m1:${esc(a1)};--m2:${esc(a2)};--m3:${esc(a3)}">${c.hasBanner && c.domain && Store.server ? `<div class="m-ban" style="background-image:url('api/banner?d=${encodeURIComponent(c.domain)}&v=${c.logoV || ''}')"></div>` : ''}
    <div class="m-band-in">${avatar(c, 58)}<div class="m-who"><h2>${esc(c.name)}</h2><div class="m-sub">${ind ? `<span>${ind.icon} ${esc(ind.label)}</span>` : ''}${c.domain ? `<span>${esc(c.domain)}</span>` : ''}</div>${c.description ? `<p>${esc(decodeEntities(c.description).slice(0, 200))}</p>` : ''}</div>
      <div class="m-facts"><span><b>${mine}</b>on you</span><span><b>${theirs}</b>they owe</span><span><b>${last ? esc(fmtDate(ymd(new Date(last.start)))) : 'First'}</b>${last ? 'last met' : 'meeting'}</span></div></div>
    ${talk.length ? `<div class="m-talk"><em>Worth mentioning</em>${talk.slice(0, 3).map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}</div>`;
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
  setTimeout(() => $('#imp-text')?.focus(), 30);
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
    case 'add-project': promptProject(); break;
    case 'all-clients': { const o = open(), items = S.clients.filter(c => !c.archived).sort((x, y) => (isProject(x) - isProject(y)) || x.name.localeCompare(y.name)).map(c => { const n = o.filter(t => t.clientId === c.id && onMe(t)).length, late = o.some(t => t.clientId === c.id && onMe(t) && dueState(t) === 'over');
        return { id: c.id, html: `${avatar(c, 18)} ${esc(c.name)}${isProject(c) ? '<span class="muted" style="font-size:11px;margin-left:6px">project</span>' : ''}${c.status === 'paused' ? '<span class="muted" style="font-size:11px;margin-left:6px">paused</span>' : ''}${n ? `<span style="margin-left:auto;font-size:12px;${late ? 'color:var(--danger);font-weight:650' : 'color:var(--muted)'}">${n}</span>` : ''}` }; });
      popList(a, items, it => go('client-' + it.id), { search: true, w: 280 }); break; }
    case 'm-tidy': { const r = tidyMeeting(S.activeMeeting); renderMeeting(); toast(r.changed || r.dupes ? `Tidied ${r.changed} item${r.changed === 1 ? '' : 's'}${r.dupes ? ` · removed ${r.dupes} duplicate${r.dupes === 1 ? '' : 's'}` : ''}` : 'Already tidy'); break; }
    case 'm-ai': aiWording(S.activeMeeting); break;
    case 'rv-due': { const M = S.activeMeeting, it = M && M.items.find(x => x.id === a.closest('.rv-item').dataset.iid); if(!it) break;
      const set = k => { it.dueDate = k; if(!k) it.dueTime = null; save(); renderMeeting(); };
      if(window.CadenceDatePick) window.CadenceDatePick.openAt(a, { value: it.dueDate, title: it.title, onPick: set, onClear: () => set(null) });
      else { const d = document.createElement('input'); d.type = 'date'; d.value = it.dueDate || ''; d.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(d); d.onchange = () => { set(d.value || null); d.remove(); }; d.showPicker ? d.showPicker() : d.click(); }
      break; }
    case 'dock-open': openDock(a.dataset.k, a); break;
    case 'dock-close': closeDock(); break;
    case 'dock-pin': { S.settings.pinnedWidgets = [...new Set(pinnedW().concat(a.dataset.k))]; save(); closeDock(true); renderWidgets(); toast('Pinned to the sidebar. ⤓ on hover sends it back to the dock.'); break; }
    case 'dock-unpin': { S.settings.pinnedWidgets = pinnedW().filter(k => k !== a.dataset.k); save(); renderWidgets(); break; }
    case 'more-clients': { const o = open(), items = sideHidden.map(id => client(id)).filter(Boolean).sort((x, y) => x.name.localeCompare(y.name)).map(c => { const n = o.filter(t => t.clientId === c.id && t.owner === 'me').length; return { id: c.id, html: `${avatar(c, 18)} ${esc(c.name)}${n ? `<span class="muted" style="margin-left:auto;font-size:12px">${n}</span>` : ''}` }; });
      popList(a, items, it => go('client-' + it.id), { search: true, w: 240 }); break; }
    case 'step-del': { const t = S.tasks.find(x => x.id === selTask); if(!t) break; const log = (t.log || []).slice(); log.splice(+a.dataset.i, 1); updateTask(t.id, { log }); renderView(); break; }
    case 'edit-project': promptProject(a.dataset.cid); break;
    case 'toggle-finished': showFinished = !showFinished; renderSide(); break;
    case 'make-project': { const c = client(a.dataset.cid); if(!c) break; c.kind = 'project'; c.icon = c.icon || '🛠️'; save(); emit('client:update', clone(c)); closeModal(); render(); setTimeout(() => promptProject(c.id), 60); toast(`${c.name} is now an internal project`); break; }
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
    case 'remove-plugin': { const d = Reg.defs.find(x => x.id === a.dataset.pid); if(!d || !d.userCode) break; S.userPlugins = S.userPlugins.filter(c => c !== d.userCode); Reg.defs = Reg.defs.filter(x => x !== d); plugUI.open = null; save(); rebuildPlugins(); render(); toast(`Removed ${d.name || d.id}`); break; }
    case 'pl-cat': plugUI.cat = a.dataset.c; route() === 'plugins' ? renderView() : openSettings(); break;
    case 'pl-tab': plugUI.tab = a.dataset.t; plugUI.cat = 'All'; renderView(); break;
    case 'pl-open': if(e.target.closest('button')) break; plugUI.open = plugUI.open === a.dataset.pid ? null : a.dataset.pid; route() === 'plugins' ? renderView() : openSettings(); break;
    case 'pl-close': plugUI.open = null; renderView(); break;
    case 'pl-settings': openPluginSettings(a.dataset.pid); break;
    case 'open-plugins': closeModal(); go('plugins'); break;
    case 'space': switchSpace(a.dataset.s); break;
    case 'ins-tab': S.settings.insightsTab = a.dataset.id; persistLocal(); render(); break;
    case 'demo-open': window.open(location.pathname + '?demo=1' + location.hash, '_blank'); break;
    case 'demo-reset': resetDemo(); break;
    case 'demo-exit': exitDemo(); break;
    case 'theme':   // the Themes plugin offers a quick switcher; without it this is the plain light/dark toggle
      if(window.CadenceThemes && window.CadenceThemes.quick && enabled('themes')) window.CadenceThemes.quick(a);
      else { S.settings.theme = S.settings.theme === 'dark' ? 'light' : 'dark'; save(); render(); }
      break;
    case 'settings': openSettings(); break;
    case 'set-tab': openSettings(a.dataset.tab); break;
    case 'set-theme': S.settings.theme = a.dataset.v; save(); render(); openSettings(); break;
    case 'notif': try { Notification.requestPermission().then(p => { toast(p === 'granted' ? 'Desktop notifications on' : 'Notifications blocked here — in-app reminders still work'); openSettings(); }).catch(() => toast('Notifications aren’t available in this window — in-app reminders still work')); } catch(err){ toast('Notifications aren’t available in this window — in-app reminders still work'); } break;
    case 'toggle-plugin': { const p = a.dataset.pid, was = enabled(p); S.disabled = was ? [...S.disabled, p] : S.disabled.filter(x => x !== p); save(); rebuildPlugins(); render(); if(route() !== 'plugins') openSettings(); else { const d = Reg.defs.find(x => x.id === p); toast(`${d ? d.name || d.id : p} ${was ? 'turned off' : 'is on'}`, was ? [{ label: 'Undo', run: () => { S.disabled = S.disabled.filter(x => x !== p); save(); rebuildPlugins(); render(); } }] : (hasSettings(p) ? [{ label: 'Settings', run: () => openPluginSettings(p) }] : [])); } break; }
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
    case 'm-review': M.phase = 'review'; if(!M.tidied) tidyMeeting(M); save(); renderMeeting(); break;
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
  const rows = [['N','New task'],['M','Start / resume meeting'],['⌘K  or  /','Command palette & search'],['J / K  or  ↓ / ↑','Move through tasks'],['X','Complete selected task'],['F','Did my part, follow up later'],['E  or  Enter','Open selected task'],['S','Snooze to tomorrow'],['O','Switch owner (me ↔ client)'],['1 2 3 / 0','Set priority / clear'],['Delete','Delete selected task'],['T','Go to Today'],['R','Weekly review'],['?','This help'],['Esc','Close panel']];
  openModalHTML('Keyboard shortcuts', `<div class="kbd-grid">${rows.map(([k,l]) => `<kbd>${k}</kbd><span>${l}</span>`).join('')}</div><p class="muted" style="margin:6px 0 0;font-size:13px">Drag tasks to reorder them, drag between <b>On me</b> and <b>On client</b> to change the owner, or drop one on a client in the sidebar to move it there.</p>`);
}

document.addEventListener('keydown', e => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable;
  if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); $('#scrim').classList.contains('open') ? closeModal() : openPalette(); return; }
  if(e.key === 'Escape'){ if($('#scrim').classList.contains('open')) closeModal(); else if(selTask) closeDrawer(); return; }
  if(typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if($('#meeting').classList.contains('open')) return;
  if(e.key === 'n' || e.key === 'q'){ e.preventDefault(); const q = $('#qa'); q && q.focus(); }
  if(e.key === 'm' && !LIFE()){ e.preventDefault(); startMeeting(); }
  if(e.key === 'L' && e.shiftKey){ e.preventDefault(); switchSpace(); }
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
  if(e.key === 'f'){ e.preventDefault(); stepDialog(t.id); }
  if(e.key === 's'){ updateTask(t.id, { dueDate: ymd(addDays(new Date(), 1)) }); render(); toast(`Snoozed “${t.title}” to tomorrow`); }
  if(e.key === 'o'){ updateTask(t.id, { owner: t.owner === 'me' ? 'client' : t.owner === 'client' && !LIFE() ? 'dev' : 'me' }); render(); }
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
/* a new version on the NAS: old tabs running old code against new data cause odd bugs. Background tabs with nothing
   half-typed reload themselves; otherwise a banner asks. */
const Build = { id: null, pending: false };
const busyEditing = () => !!(tePending || (document.activeElement && document.activeElement.matches('input:not(#qa):not(.pop-search),textarea,[contenteditable="true"]') && document.activeElement.value !== '') || $('#modal.on, #modal:not([hidden]) .inp:focus'));
async function checkBuild(){
  if(DEMO) return;
  try { const r = await fetch('api/health', { cache: 'no-store' }); if(!r.ok) return; const j = await r.json(); if(!j.build) return;
    if(!Build.id){ Build.id = j.build; return; }
    if(j.build !== Build.id && !Build.pending){ Build.pending = true; newBuild(); } } catch(e){}
}
function reloadNow(){ try { flushEdit(); persistLocal && persistLocal(); } catch(e){} location.reload(); }
function newBuild(){
  if(document.hidden && !busyEditing()) return reloadNow();
  if($('#upd-bar')) return;
  const b = document.createElement('div'); b.id = 'upd-bar'; b.innerHTML = `<span>✨ Cadence was updated on your NAS</span><button class="btn primary" id="upd-go">Reload</button><button class="upd-x" id="upd-x" title="Later">✕</button>`;
  document.body.appendChild(b); $('#upd-go').onclick = reloadNow; $('#upd-x').onclick = () => b.remove();
}
document.addEventListener('visibilitychange', () => { if(document.hidden && Build.pending && !busyEditing()) reloadNow(); else if(!document.hidden) checkBuild(); });
setTimeout(checkBuild, 2500); setInterval(checkBuild, 60000);
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
