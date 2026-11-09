/* Client stock ticker: every client trades on the Cadence exchange.
   The price is worked out from what you actually did: finishing their tasks, meetings, chasing, new work
   push it up; ignoring them and letting their tasks go overdue sends it down. History is rebuilt from your
   data, so there is a 30-day chart from day one. Nothing extra is stored except which crashes you were told about. */
Cadence.registerPlugin({
  id: 'stocks', spaces: ['work'], name: 'Client stock ticker', version: '1.0.0', category: 'Fun',
  description: 'Each client gets a share price that rises when you work with them and sinks while you ignore them. Live ticker in the sidebar, a full market report from ⌘K, and a heads-up when a client crashes.',
  tagline: 'Your clients, as a stock market', color: '#1f9d63',
  icon: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  settings(api) {
    const o = Object.assign({ rows: 5, sort: 'weak', alerts: true, tape: true }, api.storage.get('opts') || {});
    api.ui.modal('Client stock ticker', `
      <div class="field"><label>Rows in the sidebar</label><select class="inp" id="sk-rows">${[3, 5, 8, 12].map(n => `<option ${n === o.rows ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="field"><label>Show first</label><select class="inp" id="sk-sort">${[['weak', 'Weakest stocks (who needs you)'], ['movers', 'Biggest movers today'], ['best', 'Best performers'], ['name', 'A to Z']].map(([k, l]) => `<option value="${k}" ${k === o.sort ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <label style="display:flex;gap:8px;align-items:center;margin:4px 0"><input type="checkbox" id="sk-tape" ${o.tape ? 'checked' : ''}> Scrolling ticker tape</label>
      <label style="display:flex;gap:8px;align-items:center;margin:4px 0"><input type="checkbox" id="sk-alerts" ${o.alerts ? 'checked' : ''}> Tell me on the Island when a client crashes</label>`,
      `<button class="btn primary" id="sk-save">Save</button>`);
    document.getElementById('sk-save').onclick = () => {
      api.storage.set('opts', { rows: +document.getElementById('sk-rows').value, sort: document.getElementById('sk-sort').value, tape: document.getElementById('sk-tape').checked, alerts: document.getElementById('sk-alerts').checked });
      api.ui.close(); api.ui.refreshWidgets();
    };
  },
  setup(api) {
    const opts = () => Object.assign({ rows: 5, sort: 'weak', alerts: true, tape: true }, api.storage.get('opts') || {});
    if (!document.getElementById('stk-css')) {
      const st = document.createElement('style'); st.id = 'stk-css';
      st.textContent = `
        .stk{padding:2px 4px 4px}
        .stk-h{display:flex;align-items:baseline;justify-content:space-between;padding:6px 6px 4px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);cursor:pointer}
        .stk-h b{font:600 11px var(--mono);letter-spacing:0;text-transform:none}
        .stk-r{display:grid;grid-template-columns:44px 1fr auto;align-items:center;gap:8px;padding:4px 6px;border-radius:8px;cursor:pointer;font-family:var(--mono);font-size:11.5px}
        .stk-r:hover{background:var(--hover)}
        .stk-r .sym{font-weight:600;color:var(--text)}
        .stk-r svg{width:100%;height:16px;display:block}
        .stk-r .px{text-align:right;line-height:1.15;color:var(--text)}
        .stk-r .px small{display:block;font-size:10px}
        .up{color:var(--ok)} .dn{color:var(--danger)} .fl{color:var(--muted)}
        .stk-r.crash .sym::after{content:' ⚠';color:var(--danger)}
        .stk-tape{overflow:hidden;white-space:nowrap;mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);font:500 11px var(--mono);color:var(--muted);padding:2px 0 4px}
        .stk-tape span{display:inline-block;animation:stktape var(--d,30s) linear infinite;padding-left:100%}
        .stk-tape i{font-style:normal;margin-right:14px}
        @keyframes stktape{to{transform:translateX(-100%)}}
        @media (prefers-reduced-motion:reduce){.stk-tape span{animation:none;padding-left:0}}
        .stk-rep{display:grid;gap:10px}
        .stk-card{display:grid;grid-template-columns:1fr 220px;gap:12px;align-items:center;padding:10px 12px;border:1px solid var(--line);border-radius:12px;cursor:pointer}
        .stk-card:hover{background:var(--hover)}
        .stk-card b{font-size:14px}.stk-card .m{font:12px var(--mono);color:var(--muted);margin-top:2px}
        .stk-card .why{font-size:12px;color:var(--muted);margin-top:4px}
        .stk-card svg{width:100%;height:46px}
      `;
      document.head.appendChild(st);
    }
    api.sidebar.add({ id: 'stocks', slot: 'bottom', order: 25, render: el => draw(el) });
    api.commands.add({ title: 'Market report: client share prices', run: () => report() });
    api.widgets.add({ id: 'market', title: 'Client stocks', icon: '📈', size: 'm', description: 'Your weakest client stocks with sparklines. Click the header for the market report.', render: el => draw(el) });
    for (const ev of ['task:complete', 'task:add', 'task:update', 'task:reopen', 'task:remove', 'client:add', 'client:update', 'meeting:end', 'sync']) api.on(ev, () => { clearTimeout(window.__stkT); window.__stkT = setTimeout(() => { api.ui.refreshWidgets(); alerts(); }, 300); });
    setTimeout(alerts, 4000);

    const DAY = 864e5;
    const key = d => api.util.ymd(d);
    function symbols(clients) {
      const used = new Map(), out = {};
      for (const c of clients) {
        const words = String(c.name || '?').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
        let s = words.length >= 3 ? words.map(w => w[0]).join('').slice(0, 4) : (words[0] || 'X').slice(0, 4);
        const n = used.get(s) || 0; used.set(s, n + 1); out[c.id] = n ? s.slice(0, 3) + (n + 1) : s;
      }
      return out;
    }
    // tiny deterministic noise so lines look alive but never jump around between reloads
    const noise = (id, k) => { let h = 2166136261; for (const ch of id + k) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) / 4294967295 - 0.5) * 0.012; };

    // price history for one client: 60 simulated days, the last 30 shown
    function history(c, tasks, meetings) {
      const mine = tasks.filter(t => t.clientId === c.id), mtg = meetings.filter(m => m.clientId === c.id);
      const ev = new Map(); const add = (ms, w, why) => { if (!ms) return; const k = key(new Date(ms)); const e = ev.get(k) || { w: 0, why: [] }; e.w += w; e.why.push(why); ev.set(k, e); };
      for (const t of mine) {
        add(t.createdAt, 0.008, 'new work');
        if (t.done && t.doneAt) add(t.doneAt, t.owner === 'client' ? 0.02 : 0.035, t.owner === 'client' ? 'they delivered' : 'you delivered');
        if (t.lastChased) add(t.lastChased, 0.015, 'chased');
      }
      for (const m of mtg) add(m.start, 0.06, 'meeting');
      const today = new Date(); today.setHours(12, 0, 0, 0);
      let p = 100, lastTouch = null; const pts = [];
      const born = Math.min(...[c.createdAt, ...mine.map(t => t.createdAt), ...mtg.map(m => m.start)].filter(Boolean), Date.now());
      for (let i = 59; i >= 0; i--) {
        const d = new Date(today.getTime() - i * DAY), k = key(d), e = ev.get(k);
        let why = '';
        if (d.getTime() + DAY < born) { pts.push({ k, p: null }); continue; }
        if (e) { p *= 1 + Math.min(0.14, e.w); lastTouch = d.getTime(); why = e.why[0]; }
        else if (c.status !== 'paused') {
          const idle = lastTouch ? (d.getTime() - lastTouch) / DAY : 3;
          if (idle > 2) { p *= 1 - (0.012 + 0.004 * Math.min(10, idle - 2)); why = 'ignored'; }
        }
        const over = mine.filter(t => t.owner !== 'client' && t.dueDate && t.dueDate < k && (!t.done || (t.doneAt && key(new Date(t.doneAt)) > k))).length;
        if (over) { p *= 1 - Math.min(0.05, over * 0.01); why = why || 'overdue work'; }
        p *= 1 + noise(c.id, k);
        p = Math.max(5, Math.min(999, p));
        pts.push({ k, p, why });
      }
      const shown = pts.slice(-30), vals = shown.filter(x => x.p != null);
      const now = vals.length ? vals[vals.length - 1].p : 100, prev = vals.length > 1 ? vals[vals.length - 2].p : now, month = vals.length ? vals[0].p : now;
      const idleDays = lastTouch ? Math.floor((Date.now() - lastTouch) / DAY) : null;
      return { pts: shown, now, day: (now - prev) / prev, month: (now - month) / month, idleDays, lastWhy: (vals[vals.length - 1] || {}).why || '' };
    }
    function market() {
      const clients = api.clients.list().filter(c => c.status !== 'archived'), tasks = api.tasks.list(), meetings = api.meetings.list(), sym = symbols(clients);
      return clients.map(c => ({ c, sym: sym[c.id], ...history(c, tasks, meetings) }));
    }
    const pct = x => (x > 0 ? '+' : '') + (x * 100).toFixed(1) + '%';
    const cls = x => x > 0.0005 ? 'up' : x < -0.0005 ? 'dn' : 'fl';
    function spark(pts, w = 60, h = 16, fill) {
      const v = pts.map(x => x.p).filter(x => x != null); if (v.length < 2) return '';
      const lo = Math.min(...v), hi = Math.max(...v), r = hi - lo || 1, n = pts.length - 1;
      const xy = pts.map((x, i) => x.p == null ? null : [(i / n) * w, h - 1 - ((x.p - lo) / r) * (h - 2)]).filter(Boolean);
      const col = v[v.length - 1] >= v[0] ? 'var(--ok)' : 'var(--danger)', d = 'M' + xy.map(p => p.map(n => n.toFixed(1)).join(',')).join('L');
      return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${fill ? `<path d="${d}L${xy[xy.length - 1][0].toFixed(1)},${h}L${xy[0][0].toFixed(1)},${h}Z" fill="${col}" opacity=".12"/>` : ''}<path d="${d}" fill="none" stroke="${col}" stroke-width="1.4" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
    }

    function draw(el) {
      const m = market(); if (!m.length) { el.style.display = 'none'; return; } el.style.display = '';
      const idx = m.reduce((s, x) => s + x.now, 0) / m.length, idxDay = m.reduce((s, x) => s + x.day, 0) / m.length;
      const o = opts(), SORT = { weak: (a, b) => a.now - b.now, movers: (a, b) => Math.abs(b.day) - Math.abs(a.day), best: (a, b) => b.month - a.month, name: (a, b) => a.c.name.localeCompare(b.c.name) };
      const rows = m.slice().sort(SORT[o.sort] || SORT.weak).slice(0, o.rows);   // default: weakest first, the ones that need you
      const E = api.ui.esc;
      el.innerHTML = `<div class="stk"><div class="stk-h" data-rep>Cadence index <b class="${cls(idxDay)}">${idx.toFixed(1)} ${pct(idxDay)}</b></div>
        ${o.tape && m.length > o.rows ? `<div class="stk-tape"><span style="--d:${Math.max(18, m.length * 3)}s">${m.map(x => `<i>${E(x.sym)} <b class="${cls(x.day)}">${x.now.toFixed(1)}</b></i>`).join('')}</span></div>` : ''}
        ${rows.map(x => `<div class="stk-r ${x.now < 70 ? 'crash' : ''}" data-c="${E(x.c.id)}" title="${E(x.c.name)} · ${pct(x.month)} this month${x.idleDays != null ? ' · last touched ' + x.idleDays + 'd ago' : ''}"><span class="sym">${E(x.sym)}</span>${spark(x.pts)}<span class="px">${x.now.toFixed(1)}<small class="${cls(x.day)}">${pct(x.day)}</small></span></div>`).join('')}</div>`;
      el.querySelector('[data-rep]').onclick = report;
      el.querySelectorAll('[data-c]').forEach(r => r.onclick = () => api.ui.navigate('client-' + r.dataset.c));
    }

    function report() {
      const m = market().sort((a, b) => a.month - b.month), E = api.ui.esc;
      if (!m.length) return api.ui.toast('No clients listed on the exchange yet');
      const tip = x => x.idleDays == null ? 'No activity yet' : x.idleDays > 2 ? `Ignored for ${x.idleDays} days` : x.lastWhy ? `Latest: ${x.lastWhy}` : 'Active';
      api.ui.modal('Market report', `<p style="color:var(--muted);margin:0 0 12px">30 days on the Cadence exchange, worst performers first. Finish their tasks, meet, or chase to send a stock up.</p>
        <div class="stk-rep">${m.map(x => `<div class="stk-card" data-c="${E(x.c.id)}"><div><b>${E(x.c.name)}</b><div class="m">${E(x.sym)} · ${x.now.toFixed(2)} · <span class="${cls(x.day)}">${pct(x.day)} today</span> · <span class="${cls(x.month)}">${pct(x.month)} 30d</span></div><div class="why">${E(tip(x))}</div></div>${spark(x.pts, 220, 46, true)}</div>`).join('')}</div>`,
        `<button class="btn" data-act="close-modal">Close</button>`, 'wide');
      document.querySelectorAll('.stk-card').forEach(r => r.onclick = () => { api.ui.close(); api.ui.navigate('client-' + r.dataset.c); });
    }

    // a heads-up when a client crashes (below 70, or down 8%+ today) — once per client per day
    function alerts() {
      if (api.system().demo || !opts().alerts) return;
      const seen = api.storage.get('alerted') || {}, today = api.util.todayKey();
      const crash = market().filter(x => (x.now < 70 || x.day < -0.08) && seen[x.c.id] !== today).sort((a, b) => a.now - b.now)[0];
      if (!crash) return;
      seen[crash.c.id] = today; api.storage.set('alerted', seen);
      api.island.show({ icon: '📉', color: '#e5484d', title: `${crash.sym} is crashing`, sub: `${crash.now.toFixed(1)} · ${crash.idleDays != null ? `you've ignored ${crash.c.name} for ${crash.idleDays} days` : crash.c.name}`,
        actions: [{ label: 'Open', run: () => api.ui.navigate('client-' + crash.c.id) }], ms: 8000 });
    }
  }
});
