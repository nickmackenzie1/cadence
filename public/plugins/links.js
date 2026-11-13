/* Client links — a row of quick links on each client page (Zoho CRM account, Projects portal,
   Desk, WorkDrive, Books, or anything else). Paste a URL; the Zoho product is detected and labelled. */
(() => {
  const G = window.__links = window.__links || {};
  if (!G.style) {
    G.style = document.createElement('style');
    G.style.textContent = `
      .cl-links{position:relative;display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;align-items:center}
      .cl-link{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 6px 0 9px;border-radius:var(--r-m);background:var(--panel);border:1px solid var(--line);color:var(--text);text-decoration:none;font-size:13px;font-weight:500;transition:border-color .15s,transform .1s,box-shadow .15s}
      .cl-link:hover{border-color:var(--faint);box-shadow:0 3px 10px rgba(0,0,0,.06)}
      .cl-link:active{transform:scale(.97)}
      .cl-link .ico{width:18px;height:18px;border-radius:var(--r-s);display:grid;place-items:center;font:800 9.5px/1 ui-sans-serif,system-ui;color:#fff;flex:none;letter-spacing:-.02em}
      .cl-link .ar{opacity:.4;font-size:11px;margin-right:2px}
      .cl-link .x{width:18px;height:18px;border-radius:var(--r-s);display:none;place-items:center;color:var(--muted);font-size:13px}
      .cl-link:hover .x{display:grid}.cl-link .x:hover{background:var(--hover);color:var(--danger)}
      .cl-link:hover .ar{display:none}
      .cl-add{height:30px;padding:0 10px;border-radius:var(--r-m);border:1px dashed var(--line);color:var(--muted);font-size:13px;font-weight:500;background:transparent;cursor:pointer}
      .cl-add:hover{border-color:var(--faint);color:var(--text)}
      .cl-detect{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted);margin-top:6px;min-height:20px}
    `;
    document.head.appendChild(G.style);
  }

  // Zoho apps by subdomain; works for every data centre (zoho.com / .eu / .ca / .in / .com.au / .jp / zohocloud.ca …)
  const ZOHO = {
    crm: ['Zoho CRM', '#e42527'], crmplus: ['CRM Plus', '#e42527'], bigin: ['Bigin', '#0fa36b'], projects: ['Zoho Projects', '#0a7bd6'], projectsportal: ['Projects portal', '#0a7bd6'], desk: ['Zoho Desk', '#00a35a'],
    books: ['Zoho Books', '#1f8b4c'], invoice: ['Zoho Invoice', '#0a7bd6'], inventory: ['Zoho Inventory', '#f39c12'], billing: ['Zoho Billing', '#2e7bd6'], subscriptions: ['Zoho Billing', '#2e7bd6'],
    expense: ['Zoho Expense', '#16a085'], people: ['Zoho People', '#e67e22'], recruit: ['Zoho Recruit', '#2c80c5'], creator: ['Zoho Creator', '#7b3fe4'], flow: ['Zoho Flow', '#8e44ad'],
    analytics: ['Zoho Analytics', '#f0582a'], workdrive: ['WorkDrive', '#1e88e5'], sign: ['Zoho Sign', '#226db4'], cliq: ['Zoho Cliq', '#0b8ad8'], mail: ['Zoho Mail', '#e42527'],
    campaigns: ['Campaigns', '#d4533b'], forms: ['Zoho Forms', '#e5574b'], survey: ['Zoho Survey', '#2c9e4b'], sites: ['Zoho Sites', '#ef4f3f'], commerce: ['Zoho Commerce', '#f39c12'],
    bookings: ['Bookings', '#7b3fe4'], fsm: ['Zoho FSM', '#0a7bd6'], sprints: ['Zoho Sprints', '#00a8e8'], connect: ['Zoho Connect', '#d81b60'], salesiq: ['SalesIQ', '#0a7bd6'],
    one: ['Zoho One', '#e42527'], accounts: ['Zoho Admin', '#555'], 'api-console': ['API Console', '#555'], marketingautomation: ['Marketing Automation', '#d4533b'], social: ['Zoho Social', '#1da1f2'],
    writer: ['Writer', '#1e88e5'], sheet: ['Sheet', '#1f8b4c'], show: ['Show', '#f0582a'], notebook: ['Notebook', '#f5b400'], meeting: ['Zoho Meeting', '#0a7bd6'], lens: ['Lens', '#555'],
  };
  const OTHER = [
    [/docs\.google\.com\/spreadsheets/, ['Google Sheet', '#0f9d58']], [/docs\.google\.com/, ['Google Doc', '#4285f4']], [/drive\.google\.com/, ['Google Drive', '#1fa463']],
    [/notion\.(so|site)/, ['Notion', '#111']], [/figma\.com/, ['Figma', '#a259ff']], [/slack\.com/, ['Slack', '#4a154b']], [/github\.com/, ['GitHub', '#24292f']],
    [/sharepoint\.com|onedrive|office\.com/, ['Microsoft 365', '#0078d4']], [/dropbox\.com/, ['Dropbox', '#0061ff']], [/fireflies\.ai/, ['Fireflies', '#8a3ffc']],
    [/loom\.com/, ['Loom', '#625df5']], [/miro\.com/, ['Miro', '#ffd02f']], [/trello\.com/, ['Trello', '#0079bf']], [/asana\.com/, ['Asana', '#f06a6a']],
  ];
  function detect(url) {
    let u; try { u = new URL(/^https?:\/\//i.test(url) ? url : 'https://' + url); } catch (e) { return null; }
    const host = u.hostname.toLowerCase();
    const z = host.match(/^(?:www\.)?([a-z-]+)\.(?:zoho|zohocloud|zohopublic)\.[a-z.]+$/);
    if (z && ZOHO[z[1]]) { const [label, color] = ZOHO[z[1]]; return { url: u.href, label, color, zoho: true, abbr: label.replace(/^Zoho\s+/, '').slice(0, 2) }; }
    if (/(^|\.)zoho(cloud)?\.[a-z.]+$/.test(host)) return { url: u.href, label: 'Zoho', color: '#e42527', zoho: true, abbr: 'Z' };
    for (const [re, [label, color]] of OTHER) if (re.test(u.href)) return { url: u.href, label, color, abbr: label.slice(0, 2) };
    const name = host.replace(/^www\./, '').split('.')[0];
    return { url: u.href, label: name.charAt(0).toUpperCase() + name.slice(1), color: '#8a877f', abbr: name.slice(0, 2).toUpperCase() };
  }

  Cadence.registerPlugin({
    id: 'links', spaces: ['work'], name: 'Client links', version: '1.0.0', icon: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>', color: '#3e63dd', category: 'Clients', tagline: 'Quick links for every client',
    description: 'A row of quick links on each client page — paste their Zoho CRM account, Projects portal, Desk, WorkDrive or any URL and it’s detected and labelled.',
    setup(api) {
      const E = api.ui.esc;
      function save(cid, links) { api.clients.update(cid, { links }); api.ui.refresh(); }
      function openAdd(c, editIdx) {
        const cur = (c.links || [])[editIdx];
        api.ui.modal(`${api.ui.avatar(c, 22)}&nbsp; ${cur ? 'Edit' : 'Add'} link — ${E(c.name)}`, `
          <div class="field"><label>URL</label><textarea class="inp" id="lk-url" rows="2" style="min-height:44px;resize:vertical" placeholder="Paste a Zoho CRM account, Projects portal, WorkDrive folder…">${cur ? E(cur.url) : ''}</textarea>
            <div class="cl-detect" id="lk-det"></div></div>
          <div class="field"><label>Label <span style="text-transform:none;letter-spacing:0;font-weight:400">— optional, auto-filled</span></label><input class="inp" id="lk-label" value="${cur ? E(cur.label) : ''}" placeholder="e.g. CRM account, Sandbox, Blueprint"></div>
          <div class="muted" style="font-size:12px">Tip: paste several URLs (one per line) to add them all at once · right-click a link to edit it.</div>`,
          `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="lk-save">${cur ? 'Save' : 'Add link'}</button>`);
        const $ = s => document.querySelector(s), urlIn = $('#lk-url'), lab = $('#lk-label');
        let auto = !cur;
        const show = () => {
          const lines = urlIn.value.split(/\s*\n\s*/).filter(Boolean), d = lines.length === 1 ? detect(lines[0]) : null;
          $('#lk-det').innerHTML = lines.length > 1 ? `${lines.length} links — labels detected automatically` : d ? `<span class="ico" style="width:18px;height:18px;border-radius:var(--r-s);display:inline-grid;place-items:center;background:${d.color};color:#fff;font:800 9.5px ui-sans-serif">${E(d.abbr)}</span> ${E(d.label)}${d.zoho ? ' · Zoho' : ''}` : '';
          if (auto && d) lab.value = d.label;
        };
        urlIn.addEventListener('input', show); lab.addEventListener('input', () => auto = false);
        lab.addEventListener('keydown', e => { if (e.key === 'Enter') $('#lk-save').click(); });
        urlIn.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !urlIn.value.includes('\n') && !e.shiftKey)) { e.preventDefault(); $('#lk-save').click(); } });
        show(); setTimeout(() => urlIn.focus(), 20);
        $('#lk-save').onclick = () => {
          const lines = urlIn.value.split(/\s*\n\s*/).map(s => s.trim()).filter(Boolean); if (!lines.length) return;
          const links = (api.clients.get(c.id).links || []).slice();
          const items = lines.map((l, i) => { const d = detect(l); if (!d) return null; return { id: 'k' + Date.now().toString(36) + i, url: d.url, label: (lines.length === 1 && lab.value.trim()) || d.label }; }).filter(Boolean);
          if (!items.length) { api.ui.toast('That doesn’t look like a link'); return; }
          if (cur) links[editIdx] = { ...cur, ...items[0] }; else links.push(...items);
          api.ui.close(); save(c.id, links); api.ui.toast(cur ? 'Link updated' : items.length > 1 ? `Added ${items.length} links` : `Added ${items[0].label}`);
        };
      }
      api.on('render', ({ route }) => {
        if (!route.startsWith('client-')) return;
        const c = api.clients.get(route.slice(7)); const hero = document.querySelector('.c-hero .head > div'); if (!c || !hero || hero.querySelector('.cl-links')) return;
        const row = document.createElement('div'); row.className = 'cl-links';
        row.innerHTML = (c.links || []).map((l, i) => { const d = detect(l.url) || {}; return `<a class="cl-link" href="${E(l.url)}" target="_blank" rel="noopener" title="${E(l.url)}" data-i="${i}"><span class="ico" style="background:${d.color || '#8a877f'}">${E(d.abbr || '↗')}</span>${E(l.label)}<span class="ar">↗</span><span class="x" data-x="${i}" title="Remove">×</span></a>`; }).join('')
          + `<button class="cl-add">${(c.links || []).length ? '+ Link' : '+ Add Zoho / project links'}</button>`;
        hero.appendChild(row);
        row.querySelector('.cl-add').onclick = () => openAdd(api.clients.get(c.id));
        row.querySelectorAll('[data-x]').forEach(x => x.addEventListener('click', e => {
          e.preventDefault(); e.stopPropagation();
          const links = (api.clients.get(c.id).links || []).slice(), [gone] = links.splice(+x.dataset.x, 1);
          save(c.id, links); api.ui.toast(`Removed ${gone.label}`, [{ label: 'Undo', run: () => { const l = (api.clients.get(c.id).links || []).slice(); l.splice(+x.dataset.x, 0, gone); save(c.id, l); } }]);
        }));
        row.querySelectorAll('.cl-link').forEach(a => a.addEventListener('contextmenu', e => { e.preventDefault(); openAdd(api.clients.get(c.id), +a.dataset.i); }));
      });
      api.clientActions.add({ id: 'links-add', label: '🔗  Add link', run: c => openAdd(c) });
    }
  });
})();
