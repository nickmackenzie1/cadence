/* Zoho status: live availability of the Zoho apps you work in, from Zoho's public status page
   (StatusIQ RSS, fetched by the NAS so nothing leaves your browser). A light in the sidebar,
   the full board on click, and an Island alert when something you watch goes down or recovers. */
Cadence.registerPlugin({
  id: 'zoho-status', spaces: ['work'], name: 'Zoho status', version: '1.0.0', category: 'Integrations',
  description: 'Watches Zoho\'s public status page (Canada data centre by default) and shows a status light in the sidebar. Click it for every Zoho service. Pick the apps you care about and get an Island alert the moment one goes down, and again when it\'s back. Also available as a dashboard widget.',
  tagline: 'Is Zoho up? A light in the sidebar', color: '#e42527',
  icon: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  settings(api) { window.__zs && window.__zs.settings(); },
  setup(api) {
    const Z = window.__zs = window.__zs || { items: [], at: 0, err: '' };
    const DEFAULT_WATCH = ['Zoho CRM', 'Zoho Desk', 'Zoho Books', 'Zoho Projects', 'Zoho Creator', 'Zoho Mail', 'Zoho Analytics', 'Zoho Flow', 'Zoho Billing', 'Zoho Inventory', 'Zoho People', 'Zoho Forms', 'Zoho Sign', 'Zoho One'];
    const opts = () => Object.assign({ url: 'https://ca.zohostatus.com/rss', watch: null, alerts: true, sidebar: true }, api.storage.get('opts') || {});
    const watched = () => opts().watch || DEFAULT_WATCH;
    const E = api.ui.esc;

    if (!document.getElementById('zs-css')) {
      const st = document.createElement('style'); st.id = 'zs-css';
      st.textContent = `
        .zs-row{display:flex;align-items:center;gap:9px;padding:6px 10px;border-radius:9px;cursor:pointer;font-size:13px}
        .zs-row:hover{background:var(--hover)}
        .zs-dot{width:9px;height:9px;border-radius:50%;flex:none;background:var(--ok);box-shadow:0 0 0 3px color-mix(in srgb,var(--ok) 22%,transparent)}
        .zs-dot.warn{background:#f5a524;box-shadow:0 0 0 3px rgba(245,165,36,.25);animation:zsp 1.6s infinite}
        .zs-dot.down{background:var(--danger);box-shadow:0 0 0 3px color-mix(in srgb,var(--danger) 25%,transparent);animation:zsp 1s infinite}
        .zs-dot.unk{background:var(--faint);box-shadow:none}
        @keyframes zsp{50%{opacity:.45}}
        .zs-row b{font-weight:600}.zs-row span{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .zs-board{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:6px}
        .zs-svc{display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid var(--line);border-radius:10px;font-size:12.5px}
        .zs-svc.w{border-color:color-mix(in srgb,var(--accent) 35%,var(--line))}
        .zs-svc .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .zs-svc .s{font-size:11px;color:var(--muted)}
        .zs-svc.bad .s{color:var(--danger);font-weight:600}
        .zs-head{display:flex;gap:10px;align-items:center;margin-bottom:12px}
        .zs-pick{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:2px 12px;max-height:280px;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:8px 10px}
        .zs-pick label{display:flex;gap:7px;align-items:center;font-size:12.5px;padding:3px 0}
        .zs-w{padding:12px}.zs-w h4{margin:0 0 8px;font-size:13px;display:flex;align-items:center;gap:8px}
      `;
      document.head.appendChild(st);
    }

    const level = s => /operational|up\b|resolved/i.test(s) ? 'ok' : /maint|degrad|partial|slow|minor/i.test(s) ? 'warn' : /down|outage|major|critical|disrupt/i.test(s) ? 'down' : 'unk';
    const clean = n => n.replace(/^(CA|US|EU|IN|AU|JP|UK|SA|CN)\s+/, '');
    function parse(feed) {
      return (feed.items || []).map(it => { const t = it.title || ''; const i = t.lastIndexOf(' - '); const name = clean(i > 0 ? t.slice(0, i) : t), status = i > 0 ? t.slice(i + 3) : 'Unknown'; return { name, status, level: level(status), link: it.link }; })
        .filter((x, i, a) => x.name && a.findIndex(y => y.name === x.name) === i).sort((a, b) => a.name.localeCompare(b.name));
    }
    function load(force) {
      if (!force && Date.now() - Z.at < 4 * 60e3 && Z.items.length) return Promise.resolve();
      if (Z.busy && !force) return Z.busy;                       // setup can run twice at boot: share one request
      return (Z.busy = fetchNow(force).finally(() => { Z.busy = null; }));
    }
    async function fetchNow(force) {
      try {
        const r = await fetch(`api/feed?ttl=3&url=${encodeURIComponent(opts().url)}${force ? '&refresh=1' : ''}`, { cache: 'no-store' });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
        const prev = new Map(Z.items.map(x => [x.name, x.level]));
        Z.items = parse(j); Z.at = Date.now(); Z.err = '';
        changes(prev);
      } catch (e) { Z.err = e.message; }
      api.ui.refreshWidgets();
    }
    // Island alerts when a watched service changes state (not on the first load)
    function changes(prev) {
      if (!prev.size || !opts().alerts || api.system().demo) return;
      const w = new Set(watched());
      for (const x of Z.items) {
        if (!w.has(x.name) || !prev.has(x.name) || prev.get(x.name) === x.level) continue;
        if (x.level === 'ok') api.island.show({ icon: '✓', color: '#2f9e6b', title: `${x.name} is back`, sub: 'Operational again', ms: 6000 });
        else api.island.show({ icon: '!', color: x.level === 'down' ? '#e5484d' : '#f5a524', title: `${x.name}: ${x.status}`, sub: 'From Zoho’s status page', sticky: x.level === 'down', actions: [{ label: 'Details', run: () => board() }] });
      }
    }
    const summary = () => {
      if (!Z.items.length) return { level: 'unk', text: Z.err ? 'Status unavailable' : 'Checking…' };
      const w = new Set(watched()), mine = Z.items.filter(x => w.has(x.name)), bad = mine.filter(x => x.level !== 'ok'), badAll = Z.items.filter(x => x.level !== 'ok');
      if (bad.length) return { level: bad.some(x => x.level === 'down') ? 'down' : 'warn', text: bad.length === 1 ? `${bad[0].name}: ${bad[0].status}` : `${bad.length} of your apps have issues` };
      return { level: 'ok', text: badAll.length ? `Your apps are fine · ${badAll.length} other issue${badAll.length === 1 ? '' : 's'}` : 'All Zoho services operational' };
    };

    api.sidebar.add({ id: 'zoho-status', slot: 'bottom', order: 18, render: el => {
      if (!opts().sidebar) { el.style.display = 'none'; return; } el.style.display = '';
      const s = summary();
      el.innerHTML = `<div class="zs-row" title="Zoho status · updated ${Z.at ? new Date(Z.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'never'}"><i class="zs-dot ${s.level}"></i><b>Zoho</b><span>${E(s.text)}</span></div>`;
      el.firstChild.onclick = () => board();
    } });
    api.widgets.add({ id: 'board', title: 'Zoho status', icon: '◉', size: 'm', render: el => {
      const s = summary(), w = new Set(watched());
      const list = Z.items.filter(x => w.has(x.name)).sort((a, b) => (a.level === 'ok') - (b.level === 'ok'));
      el.innerHTML = `<div class="zs-w"><h4><i class="zs-dot ${s.level}"></i>${E(s.text)}</h4><div class="zs-board">${list.map(x => `<div class="zs-svc ${x.level !== 'ok' ? 'bad' : ''}"><i class="zs-dot ${x.level}"></i><span class="n">${E(x.name)}</span><span class="s">${x.level === 'ok' ? 'OK' : E(x.status)}</span></div>`).join('') || '<span class="muted">Loading…</span>'}</div></div>`;
    } });
    api.commands.add({ title: 'Zoho status', hint: 'Is Zoho up?', run: () => board() });

    function board() {
      const w = new Set(watched()), q0 = '';
      const draw = q => {
        const list = Z.items.filter(x => !q || x.name.toLowerCase().includes(q)).sort((a, b) => (w.has(b.name) - w.has(a.name)) || ((a.level === 'ok') - (b.level === 'ok')) || a.name.localeCompare(b.name));
        return list.map(x => `<div class="zs-svc ${w.has(x.name) ? 'w' : ''} ${x.level !== 'ok' ? 'bad' : ''}"><i class="zs-dot ${x.level}"></i><span class="n" title="${E(x.name)}">${E(x.name)}</span><span class="s">${x.level === 'ok' ? 'OK' : E(x.status)}</span></div>`).join('') || `<span class="muted">${Z.err ? E(Z.err) : 'Nothing yet.'}</span>`;
      };
      const s = summary();
      api.ui.modal('Zoho status', `<div class="zs-head"><i class="zs-dot ${s.level}"></i><b>${E(s.text)}</b><span class="muted" style="margin-left:auto;font-size:12px">${Z.items.length} services · ${Z.at ? 'updated ' + new Date(Z.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}</span></div>
        <input class="inp" id="zs-q" placeholder="Find a service…" style="margin-bottom:10px"><div class="zs-board" id="zs-list">${draw(q0)}</div>
        <p class="muted" style="font-size:12px;margin:12px 0 0">Your watched apps are outlined and listed first. Source: <a href="${E(opts().url.replace(/\/rss$/, ''))}" target="_blank" rel="noopener">${E(new URL(opts().url).hostname)}</a></p>`,
        `<button class="btn" id="zs-ref">Refresh</button><button class="btn" id="zs-set">Choose apps…</button><button class="btn primary" data-act="close-modal">Done</button>`, 'wide');
      document.getElementById('zs-q').oninput = e => { document.getElementById('zs-list').innerHTML = draw(e.target.value.toLowerCase()); };
      document.getElementById('zs-ref').onclick = async () => { await load(true); board(); };
      document.getElementById('zs-set').onclick = () => settings();
    }
    function settings() {
      const o = opts(), w = new Set(watched()), names = Z.items.length ? Z.items.map(x => x.name) : DEFAULT_WATCH;
      api.ui.modal('Zoho status settings', `
        <div class="field"><label>Status page feed</label><input class="inp" id="zs-url" value="${E(o.url)}"><div class="muted" style="font-size:12px;margin-top:5px">Canada data centre by default. For another region, open its Zoho status page and use its <code>/rss</code> address.</div></div>
        <div class="field"><label>Apps you work in (alerts and the sidebar light only care about these)</label><div class="zs-pick">${names.map(n => `<label><input type="checkbox" value="${E(n)}" ${w.has(n) ? 'checked' : ''}>${E(n)}</label>`).join('')}</div></div>
        <label style="display:flex;gap:8px;align-items:center;margin:4px 0"><input type="checkbox" id="zs-al" ${o.alerts ? 'checked' : ''}> Island alert when one of them goes down or recovers</label>
        <label style="display:flex;gap:8px;align-items:center;margin:4px 0"><input type="checkbox" id="zs-sb" ${o.sidebar ? 'checked' : ''}> Status light in the sidebar</label>`,
        `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="zs-save">Save</button>`, 'wide');
      document.getElementById('zs-save').onclick = () => {
        const url = document.getElementById('zs-url').value.trim();
        if (!/^https:\/\/[\w.-]+\/.*/.test(url)) return api.ui.toast('Use an https:// address');
        const watch = [...document.querySelectorAll('.zs-pick input:checked')].map(i => i.value);
        const changedUrl = url !== o.url;
        api.storage.set('opts', { url, watch, alerts: document.getElementById('zs-al').checked, sidebar: document.getElementById('zs-sb').checked });
        api.ui.close(); if (changedUrl) { Z.items = []; Z.at = 0; } load(changedUrl);
        api.ui.refreshWidgets();
      };
    }
    Z.settings = settings;
    clearInterval(Z.timer); Z.timer = setInterval(() => { if (!document.hidden && api.plugins.enabled('zoho-status')) load(); }, 5 * 60e3);
    load();
  }
});
