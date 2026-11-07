/* Database viewer — a read-only look under the hood.
   Browse every collection (clients, tasks, meetings, plugin data) as a sortable table, filter with
   `key:value` tokens, inspect any record as JSON, follow clientId links, and open any daily backup on the
   NAS to compare it with what you have now. Nothing here writes. */
(() => {
  const G = window.__dbv = window.__dbv || {};
  if (!G.style) {
    G.style = document.createElement('style');
    G.style.textContent = `
      .dbv{--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;display:grid;grid-template-columns:210px 1fr;gap:18px;min-height:60vh}
      .dbv-side{display:flex;flex-direction:column;gap:2px;font-size:13px}
      .dbv-side .h{font-size:11px;font-weight:650;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);padding:12px 8px 6px}
      .dbv-side button{display:flex;align-items:center;gap:8px;text-align:left;padding:6px 8px;border-radius:8px;color:var(--text);font-family:var(--mono);font-size:12.5px}
      .dbv-side button:hover{background:var(--hover)}
      .dbv-side button.on{background:var(--panel);box-shadow:0 0 0 1px var(--line),0 1px 2px rgba(0,0,0,.06)}
      .dbv-side button span{margin-left:auto;color:var(--muted);font-size:11px}
      .dbv-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-bottom:16px}
      .dbv-stat{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 12px}
      .dbv-stat b{display:block;font:600 17px/1.2 var(--mono);font-variant-numeric:tabular-nums}
      .dbv-stat span{font-size:11.5px;color:var(--muted)}
      .dbv-bar{display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap}
      .dbv-bar .inp{font-family:var(--mono);font-size:12.5px;flex:1;min-width:220px}
      .dbv-bar .cnt{font:12px var(--mono);color:var(--muted)}
      .dbv-main{min-width:0;container-type:inline-size}
      @container (max-width:820px){.dbv-split.insp{grid-template-columns:1fr}.dbv-insp{max-height:50vh}}
      .dbv-split{display:grid;grid-template-columns:1fr;gap:14px}
      .dbv-split.insp{grid-template-columns:minmax(0,1fr) minmax(280px,38%)}
      .dbv-tw{overflow:auto;border:1px solid var(--line);border-radius:12px;background:var(--panel);max-height:68vh}
      .dbv table{border-collapse:collapse;width:100%;font:12px/1.4 var(--mono)}
      .dbv th{position:sticky;top:0;background:var(--panel);text-align:left;font-weight:600;color:var(--muted);padding:8px 10px;border-bottom:1px solid var(--line);white-space:nowrap;cursor:pointer;user-select:none}
      .dbv th:hover{color:var(--text)}
      .dbv td{padding:6px 10px;border-bottom:1px solid color-mix(in srgb,var(--line) 60%,transparent);white-space:nowrap;max-width:280px;overflow:hidden;text-overflow:ellipsis}
      .dbv tr:hover td{background:var(--hover)}
      .dbv tr.on td{background:color-mix(in srgb,var(--accent) 10%,transparent)}
      .dbv td.n{color:#0090ff}.dbv td.b{color:#d6409f}.dbv td.nl{color:var(--muted);opacity:.6}.dbv td.o{color:var(--muted)}
      .dbv td a{color:var(--accent);cursor:pointer;text-decoration:none}
      .dbv-insp{border:1px solid var(--line);border-radius:12px;background:#151513;color:#e9e6dd;overflow:auto;max-height:68vh;position:relative}
      .dbv-insp .ih{position:sticky;top:0;display:flex;gap:6px;align-items:center;padding:8px 10px;background:#1d1d1a;border-bottom:1px solid #2c2b27;font:12px var(--mono);color:#a7a397}
      .dbv-insp .ih button{color:#e9e6dd;background:#2c2b27;border-radius:6px;padding:2px 8px;font-size:11.5px}
      .dbv-insp .ih button:first-of-type{margin-left:auto}
      .dbv-insp pre{margin:0;padding:12px 14px;font:12px/1.55 var(--mono);white-space:pre-wrap;word-break:break-word}
      .dbv-insp .k{color:#9cdcfe}.dbv-insp .s{color:#ce9178}.dbv-insp .n{color:#b5cea8}.dbv-insp .bo{color:#c586c0}.dbv-insp .nu{color:#808080}
      .dbv-bk{display:flex;align-items:center;gap:10px;padding:7px 10px;border-bottom:1px solid var(--line);font:12px var(--mono)}
      .dbv-bk:last-child{border-bottom:0}
      .dbv-bk span{color:var(--muted)}
      .dbv-bk button{margin-left:auto}
      .dbv-banner{font-size:12.5px;padding:8px 12px;border-radius:10px;background:color-mix(in srgb,#f5a524 16%,transparent);margin-bottom:12px;display:flex;gap:10px;align-items:center}
      .dbv-banner button{margin-left:auto}
      .dbv-diff b{font-family:var(--mono)}.dbv-diff .p{color:#30a46c}.dbv-diff .m{color:#e5484d}
      @media (max-width:900px){.dbv{grid-template-columns:1fr}.dbv-split.insp{grid-template-columns:1fr}}
    `;
    document.head.appendChild(G.style);
  }
  const bytes = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB';
  const size = o => new Blob([JSON.stringify(o) || '']).size;
  const PREF = ['id', 'title', 'name', 'clientId', 'owner', 'dueDate', 'dueTime', 'done', 'doneAt', 'priority', 'domain', 'status', 'start', 'end', 'createdAt'];

  Cadence.registerPlugin({
    id: 'dbview', name: 'Database viewer', version: '1.0.0',
    description: 'A read-only look under the hood: every collection as a sortable table, key:value filters, a JSON inspector, and your NAS backups to browse and compare.',
    setup(api) {
      const E = api.ui.esc;
      const st = { col: 'tasks', q: '', sort: null, dir: 1, sel: null, src: null /* {name, data} when viewing a backup */ };

      function collections(S) {
        const out = [['clients', S.clients || []], ['tasks', S.tasks || []], ['meetings', S.meetings || []], ['settings', S.settings || {}]];
        if (S.activeMeeting) out.push(['activeMeeting', S.activeMeeting]);
        Object.keys(S.pluginData || {}).sort().forEach(k => out.push(['plugin/' + k, S.pluginData[k]]));
        return out;
      }
      const asRows = v => Array.isArray(v) ? v : Object.entries(v || {}).map(([key, value]) => ({ key, value }));
      function columns(rows) {
        const seen = new Map(); rows.slice(0, 300).forEach(r => r && typeof r === 'object' && Object.keys(r).forEach(k => seen.set(k, (seen.get(k) || 0) + 1)));
        return [...seen.keys()].sort((a, b) => { const ia = PREF.indexOf(a), ib = PREF.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || seen.get(b) - seen.get(a); }).slice(0, 9);
      }
      function matches(r, q) {
        if (!q) return true;
        return q.split(/\s+/).filter(Boolean).every(tok => {
          const m = tok.match(/^(-?)([\w.]+)([:<>])(.*)$/);
          if (m) { const [, neg, k, op, val] = m, v = r[k]; let ok;
            if (op === ':') ok = String(v ?? 'null').toLowerCase().includes(val.toLowerCase());
            else { const a = typeof v === 'number' ? v : String(v ?? ''), b = isNaN(+val) ? val : +val; ok = op === '<' ? a < b : a > b; }
            return neg ? !ok : ok; }
          return JSON.stringify(r).toLowerCase().includes(tok.toLowerCase());
        });
      }
      function cell(v, k, S) {
        if (v == null) return `<td class="nl">null</td>`;
        if (typeof v === 'boolean') return `<td class="b">${v}</td>`;
        if (typeof v === 'number') { const ts = v > 1e12 && v < 4e12 && /At$|^start$|^end$|^t$|time/i.test(k); return `<td class="n" title="${ts ? new Date(v).toLocaleString() : ''}">${ts ? new Date(v).toISOString().replace('T', ' ').slice(0, 16) : v}</td>`; }
        if (typeof v === 'object') return `<td class="o">${Array.isArray(v) ? `[${v.length}]` : `{${Object.keys(v).length}}`}</td>`;
        if (k === 'clientId') { const c = (S.clients || []).find(x => x.id === v); return `<td><a data-jump="${E(v)}">${E(c ? c.name : v)}</a></td>`; }
        return `<td title="${E(String(v).slice(0, 300))}">${E(String(v).slice(0, 120))}</td>`;
      }
      function highlight(o) {
        return E(JSON.stringify(o, null, 2)).replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g, (m, str, colon, bool) =>
          str ? (colon ? `<span class="k">${str}</span>${colon}` : `<span class="s">${str}</span>`) : bool ? `<span class="bo">${m}</span>` : m === 'null' ? `<span class="nu">null</span>` : `<span class="n">${m}</span>`);
      }

      async function render(el) {
        const live = api.db.snapshot(), S = st.src ? st.src.data : live, cols = collections(S);
        if (!cols.find(c => c[0] === st.col)) st.col = 'tasks';
        const raw = cols.find(c => c[0] === st.col)[1], rows = asRows(raw), keys = columns(rows);
        let list = rows.filter(r => matches(r, st.q));
        if (st.sort) list = list.slice().sort((a, b) => { const x = a[st.sort], y = b[st.sort]; return (x == null) - (y == null) || (x > y ? 1 : x < y ? -1 : 0) * st.dir; });
        const sys = api.system(), tot = size(S);
        const selRow = st.sel != null ? rows.find((r, i) => (r.id || r.key || i) === st.sel) : null;
        const diff = st.src ? ['clients', 'tasks', 'meetings'].map(k => { const a = new Set((live[k] || []).map(x => x.id)), b = new Set((S[k] || []).map(x => x.id)); const add = [...a].filter(x => !b.has(x)).length, rem = [...b].filter(x => !a.has(x)).length; return `${k} <b class="p">+${add}</b> <b class="m">−${rem}</b>`; }).join(' · ') : '';

        el.innerHTML = `<div class="dbv">
          <div class="dbv-side"><div class="h">Collections</div>${cols.map(([k, v]) => `<button data-col="${E(k)}" class="${k === st.col ? 'on' : ''}">${E(k)}<span>${Array.isArray(v) ? v.length : Object.keys(v || {}).length}</span></button>`).join('')}
            <div class="h">On the NAS</div><div id="dbv-nas" class="muted" style="font-size:12px;padding:0 8px">${sys.mode === 'nas' ? 'Loading…' : 'Open Cadence on your NAS to see files and backups.'}</div></div>
          <div class="dbv-main">
            ${st.src ? `<div class="dbv-banner">Viewing backup <b style="font-family:var(--mono)">${E(st.src.name)}</b> · read-only · <span class="dbv-diff">now vs then: ${diff}</span><button class="btn" data-back>Back to live</button></div>` : ''}
            <div class="dbv-stats">
              <div class="dbv-stat"><b>${bytes(tot)}</b><span>state size</span></div>
              <div class="dbv-stat"><b>${(S.tasks || []).length}</b><span>tasks · ${(S.tasks || []).filter(t => !t.done).length} open</span></div>
              <div class="dbv-stat"><b>${(S.clients || []).length}</b><span>clients</span></div>
              <div class="dbv-stat"><b>${(S.meetings || []).length}</b><span>meetings</span></div>
              <div class="dbv-stat"><b>${Object.keys(S.pluginData || {}).length}</b><span>plugin stores · ${bytes(size(S.pluginData || {}))}</span></div>
              <div class="dbv-stat"><b>${sys.demo ? 'demo' : sys.mode}</b><span>${sys.latency != null ? sys.latency + ' ms · ' : ''}${S.updatedAt ? 'saved ' + new Date(S.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'storage'}</span></div>
            </div>
            <div class="dbv-bar"><input class="inp" id="dbv-q" placeholder="filter… e.g.  done:false  owner:them  priority>1  -clientId:null  zoho" value="${E(st.q)}"><span class="cnt">${list.length}/${rows.length} rows · ${bytes(size(raw))}</span><button class="btn" data-copy>Copy JSON</button><button class="btn" data-csv>CSV</button></div>
            <div class="dbv-split ${selRow ? 'insp' : ''}">
              <div class="dbv-tw"><table><thead><tr>${keys.map(k => `<th data-sort="${E(k)}">${E(k)}${st.sort === k ? (st.dir > 0 ? ' ↑' : ' ↓') : ''}</th>`).join('')}</tr></thead>
                <tbody>${list.slice(0, 500).map((r, i) => { const id = r.id || r.key || rows.indexOf(r); return `<tr data-row="${E(id)}" class="${id === st.sel ? 'on' : ''}">${keys.map(k => cell(r[k], k, S)).join('')}</tr>`; }).join('')}</tbody></table>
                ${list.length > 500 ? `<div class="muted" style="padding:8px 10px;font-size:12px">Showing 500 of ${list.length} — narrow the filter.</div>` : ''}${!list.length ? '<div class="muted" style="padding:14px;font-size:12.5px">No rows match.</div>' : ''}</div>
              ${selRow ? `<div class="dbv-insp"><div class="ih">${E(st.col)} / ${E(String(st.sel))}<button data-icopy>Copy</button><button data-iclose>✕</button></div><pre>${highlight(selRow)}</pre></div>` : ''}
            </div>
          </div></div>`;

        const q = el.querySelector('#dbv-q');
        q.oninput = () => { st.q = q.value; clearTimeout(G.qt); G.qt = setTimeout(() => { const pos = q.selectionStart; render(el).then(() => { const n = el.querySelector('#dbv-q'); n.focus(); n.setSelectionRange(pos, pos); }); }, 160); };
        el.querySelectorAll('[data-col]').forEach(b => b.onclick = () => { st.col = b.dataset.col; st.sel = null; st.sort = null; st.q = ''; render(el); });
        el.querySelectorAll('[data-sort]').forEach(th => th.onclick = () => { const k = th.dataset.sort; st.dir = st.sort === k ? -st.dir : 1; st.sort = k; render(el); });
        el.querySelectorAll('[data-row]').forEach(tr => tr.onclick = e => { if (e.target.closest('[data-jump]')) return; const v = tr.dataset.row; st.sel = st.sel == v ? null : (isNaN(+v) || rows.some(r => r.id === v || r.key === v) ? v : +v); render(el); });
        el.querySelectorAll('[data-jump]').forEach(a => a.onclick = () => { st.col = 'clients'; st.sel = a.dataset.jump; st.q = ''; st.sort = null; render(el); });
        const ic = el.querySelector('[data-icopy]'); if (ic) ic.onclick = () => api.ui.copy(JSON.stringify(selRow, null, 2));
        const icl = el.querySelector('[data-iclose]'); if (icl) icl.onclick = () => { st.sel = null; render(el); };
        el.querySelector('[data-copy]').onclick = () => { api.ui.copy(JSON.stringify(Array.isArray(raw) ? list : raw, null, 2)); api.ui.toast(`Copied ${Array.isArray(raw) ? list.length + ' rows' : st.col}`); };
        el.querySelector('[data-csv]').onclick = () => { const esc = v => { const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }; api.ui.copy([keys.join(',')].concat(list.map(r => keys.map(k => esc(r[k])).join(','))).join('\n')); api.ui.toast('Copied as CSV'); };
        const back = el.querySelector('[data-back]'); if (back) back.onclick = () => { st.src = null; st.sel = null; render(el); };

        if (sys.mode === 'nas') {
          try {
            const info = G.nas && Date.now() - G.nas.at < 15000 ? G.nas.info : await (await fetch('api/db', { cache: 'no-store' })).json();
            G.nas = { at: Date.now(), info };
            const box = el.querySelector('#dbv-nas'); if (!box) return;
            box.innerHTML = `<div style="font-family:var(--mono);font-size:11.5px;line-height:1.7;margin-bottom:8px">${info.entries.sort((a, b) => (b.bytes || 0) - (a.bytes || 0)).map(f => `<div style="display:flex;gap:6px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.secret ? '🔒 ' : ''}${E(f.name)}</span><span style="margin-left:auto;color:var(--muted)">${bytes(f.bytes || 0)}${f.dir ? ' · ' + f.files : ''}</span></div>`).join('')}</div>
              <div style="font-size:11px;font-weight:650;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);padding:4px 0">Backups · keeps ${info.keep}</div>
              <div style="border:1px solid var(--line);border-radius:10px;background:var(--panel);max-height:260px;overflow:auto">${info.backups.map(b => `<div class="dbv-bk">${E(b.name.slice(6, 16))}<span>${bytes(b.bytes)}</span><button class="btn ghost" data-bk="${E(b.name)}" style="padding:2px 8px;font-size:11.5px">${st.src && st.src.name === b.name ? 'viewing' : 'open'}</button></div>`).join('') || '<div class="dbv-bk"><span>none yet</span></div>'}</div>`;
            box.querySelectorAll('[data-bk]').forEach(b => b.onclick = async () => { try { const d = await (await fetch('api/db/backup?name=' + encodeURIComponent(b.dataset.bk), { cache: 'no-store' })).json(); st.src = { name: b.dataset.bk, data: Object.assign({ clients: [], tasks: [], meetings: [], pluginData: {}, settings: {} }, JSON.parse(d.json || '{}')) }; st.sel = null; render(el); } catch (e) { api.ui.toast('Could not open backup: ' + e.message); } });
          } catch (e) { const box = el.querySelector('#dbv-nas'); if (box) box.textContent = 'Could not read the data folder.'; }
        }
      }

      api.views.add({ id: 'db', group: 'insights', title: 'Database', icon: '⛁', subtitle: 'Read-only: every record Cadence keeps, and your NAS backups', render: el => render(el) });
      api.commands.add({ title: 'Open database viewer', run: () => api.ui.navigate('view-db') });
    }
  });
})();
