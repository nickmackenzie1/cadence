/* Life kit: small shared helpers for the Life plugins (forms, lists, areas, reminder tasks). Not a plugin itself. */
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const DAY = 864e5;
  const css = (id, text) => { if (document.getElementById(id)) return; const s = document.createElement('style'); s.id = id; s.textContent = text; document.head.appendChild(s); };
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const fromYmd = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = fromYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
  const today = () => ymd(new Date());
  const daysUntil = s => Math.round((fromYmd(s) - fromYmd(today())) / DAY);
  // fields: [{k, label, type: text|date|number|select|textarea|time|check, opts:[[v,l]], ph, w}]
  function form(api, title, fields, val, onSave, extraBtns = '') {
    const v = val || {};
    const f = x => { const id = 'lk-' + x.k, cur = v[x.k] == null ? (x.def ?? '') : v[x.k];
      if (x.type === 'select') return `<select class="inp" id="${id}">${x.opts.map(([a, b]) => `<option value="${esc(a)}" ${String(cur) === String(a) ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`;
      if (x.type === 'textarea') return `<textarea class="inp" id="${id}" rows="${x.rows || 4}" placeholder="${esc(x.ph || '')}">${esc(cur)}</textarea>`;
      if (x.type === 'check') return `<label class="xm-row" style="margin:0"><input type="checkbox" id="${id}" ${cur ? 'checked' : ''}> ${esc(x.label)}</label>`;
      return `<input class="inp" id="${id}" type="${x.type || 'text'}" value="${esc(cur)}" placeholder="${esc(x.ph || '')}">`; };
    api.ui.modal(title, `<div class="lk-form">${fields.map(x => x.type === 'check' ? `<div class="field">${f(x)}</div>` : `<div class="field" style="${x.w ? `flex:0 0 ${x.w}` : ''}"><label>${esc(x.label)}</label>${f(x)}</div>`).join('')}</div>`,
      `${extraBtns}<button class="btn primary" id="lk-ok">Save</button>`);
    document.getElementById('lk-ok').onclick = () => { const out = { ...v }; for (const x of fields) { const el = document.getElementById('lk-' + x.k); out[x.k] = x.type === 'check' ? el.checked : x.type === 'number' ? (el.value === '' ? null : +el.value) : el.value.trim(); }
      const req = fields.find(x => x.req && !out[x.k]); if (req) return document.getElementById('lk-' + req.k).focus(); api.ui.close(); onSave(out); };
    setTimeout(() => { const first = document.querySelector('.lk-form input,.lk-form textarea'); first && first.focus(); }, 30);
  }
  // an area in the Life space (created if missing)
  function area(api, name, icon) { let c = api.clients.list().find(x => x.name.toLowerCase() === name.toLowerCase()); if (!c) { c = api.clients.add(name); if (icon) api.clients.update(c.id, { icon }); } return c.id; }
  // one task that this plugin owns (key), created or updated in place
  function ownTask(api, key, patch) { const t = api.tasks.list(x => x.lk === key && !x.done)[0]; if (t) { api.tasks.update(t.id, patch); return t.id; } return api.tasks.add({ ...patch, lk: key }).id; }
  function dropTask(api, key) { for (const t of api.tasks.list(x => x.lk === key && !x.done)) api.tasks.remove(t.id); }
  const tabs = (list, cur) => `<div class="seg lk-tabs">${list.map(([v, l]) => `<button data-tab="${esc(v)}" class="${cur === v ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`;
  const empty = t => `<div class="lk-empty">${esc(t)}</div>`;
  const card = (title, body, actions = '') => `<div class="lk-card"><div class="lk-ch"><b>${title}</b>${actions}</div>${body}</div>`;
  function printable(title, html) { const w = window.open('', '_blank'); if (!w) return; w.document.write(`<!doctype html><title>${esc(title)}</title><style>body{font:14px/1.5 Georgia,serif;max-width:760px;margin:40px auto;padding:0 20px;color:#222}h1{font-size:28px}h2{margin-top:28px;border-bottom:1px solid #ddd;padding-bottom:4px}li{margin:4px 0}.m{color:#777;font-size:12px}</style><h1>${esc(title)}</h1>${html}<script>setTimeout(()=>print(),300)<\/script>`); w.document.close(); }
  css('lk-css', `.lk-form{display:flex;flex-wrap:wrap;gap:0 10px}.lk-form .field{flex:1 1 100%}.lk-tabs{margin-bottom:14px;flex-wrap:wrap}
    .lk-card{border:1px solid var(--line);border-radius:14px;padding:12px 14px;background:var(--panel);margin-bottom:12px}.lk-ch{display:flex;align-items:center;gap:8px;margin-bottom:6px}.lk-ch b{flex:1;font-size:14.5px}
    .lk-row{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--line);font-size:13.5px}.lk-row:last-child{border-bottom:0}.lk-row .grow{flex:1;min-width:0}.lk-row em{font-style:normal;color:var(--muted);font-size:12px;white-space:nowrap}
    .lk-row .hot{color:#e5484d;font-weight:700}.lk-row .soon{color:#d97706;font-weight:700}.lk-btn{border:1px solid var(--line);background:var(--bg);color:var(--text);border-radius:8px;padding:3px 9px;font:600 12px Inter,system-ui;cursor:pointer}.lk-btn:hover{border-color:var(--accent)}
    .lk-x{background:none;border:0;color:var(--muted);cursor:pointer;opacity:.5}.lk-x:hover{opacity:1}.lk-empty{color:var(--muted);font-size:13px;padding:14px 0}
    .lk-pill{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:2px 9px;font-size:11.5px;font-weight:700;background:var(--hover)}.lk-bar{height:8px;border-radius:999px;background:var(--hover);overflow:hidden;display:flex}.lk-bar i{display:block;height:100%}
    .lk-top{display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap}.lk-top .sp{flex:1}`);
  window.LifeKit = { esc, uid, DAY, ymd, fromYmd, addDays, today, daysUntil, form, area, ownTask, dropTask, tabs, empty, card, printable, css };
})();
