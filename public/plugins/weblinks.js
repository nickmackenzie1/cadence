/* Web links: your own bookmarks in the sidebar (Zoho admin, Fireflies, bank, anything).
   Add, rename, reorder and delete from the plugin's Settings or the ⌘K command. */
Cadence.registerPlugin({
  id: 'weblinks', name: 'Web links', version: '1.0.0', category: 'Productivity',
  description: 'Pin links to the sidebar. Each one opens in a new tab and shows the site\'s icon.',
  tagline: 'Your bookmarks in the sidebar', color: '#2f7de1',
  icon: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  settings(api) { edit(api); },
  setup(api) {
    if (!document.getElementById('wl-css')) {
      const st = document.createElement('style'); st.id = 'wl-css';
      st.textContent = `
        .wl-head{display:flex;align-items:center;justify-content:space-between;padding:6px 10px 4px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}
        .wl-head button{color:var(--faint);font-size:15px;line-height:1;width:20px;height:20px;border-radius:var(--r-s)}
        .wl-head button:hover{color:var(--text);background:var(--hover)}
        .wl-row{display:flex;align-items:center;gap:9px;padding:5px 10px;border-radius:var(--r-m);color:var(--text);text-decoration:none;font-size:13px}
        .wl-row:hover{background:var(--hover)}
        .wl-row img,.wl-row .wl-dot{width:16px;height:16px;border-radius:4px;flex:none}
        .wl-row .wl-dot{background:var(--line);display:grid;place-items:center;font-size:10px;color:var(--muted)}
        .wl-row span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .wl-ed{display:grid;grid-template-columns:1fr 1.6fr auto auto auto;gap:6px;align-items:center;margin-bottom:6px}
        .wl-ed .btn{padding:0 8px;height:32px}
      `;
      document.head.appendChild(st);
    }
    api.sidebar.add({ id: 'weblinks', slot: 'bottom', order: 20, render: el => draw(el, api) });
    api.commands.add({ title: 'Add a web link to the sidebar', run: api => edit(api, true) });
    api.widgets.add({ id: 'links', title: 'Web links', icon: '🔗', size: 'm', description: 'Your pinned links as big buttons.', render: el => {
      const E = api.ui.esc, l = links(api);
      el.innerHTML = l.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;padding:8px 12px 12px">${l.map(x => { const h = host(x.url); return `<a href="${E(x.url)}" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;gap:8px;padding:10px;border:1px solid var(--line);border-radius:var(--r-l);color:var(--text);text-decoration:none;font-size:13px;font-weight:500;overflow:hidden">${h ? `<img src="${E(api.ui.faviconUrl(h))}" width="18" height="18" style="border-radius:4px;flex:none" onerror="this.remove()">` : ''}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${E(x.name || h)}</span></a>`; }).join('')}</div>`
        : '<div style="padding:18px;color:var(--muted);font-size:13px;text-align:center">No links yet. Add some in the Web links plugin settings.</div>';
    } });
  }
});

function links(api) { const l = api.storage.get('links'); return Array.isArray(l) ? l : []; }
function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
function clean(u) { u = String(u || '').trim(); if (!u) return ''; if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u; return /^https?:\/\//i.test(u) ? u : ''; }

function draw(el, api) {
  const E = api.ui.esc, list = links(api);
  if (!list.length) { el.innerHTML = ''; el.style.display = 'none'; return; }
  el.style.display = '';
  el.innerHTML = `<div class="wl-head">Links<button title="Edit links" data-wl-edit>✎</button></div>` + list.map(l => {
    const h = host(l.url);
    return `<a class="wl-row" href="${E(l.url)}" target="_blank" rel="noopener noreferrer" title="${E(l.url)}">${h ? `<img src="${E(api.ui.faviconUrl(h))}" alt="" loading="lazy" onerror="this.outerHTML='<i class=&quot;wl-dot&quot;>↗</i>'">` : '<i class="wl-dot">↗</i>'}<span>${E(l.name || h || l.url)}</span></a>`;
  }).join('');
  el.querySelector('[data-wl-edit]').onclick = () => edit(api);
}

function edit(api, addNew) {
  const E = api.ui.esc;
  let list = links(api).map(l => ({ ...l }));
  if (addNew || !list.length) list.push({ name: '', url: '' });
  const rows = () => list.map((l, i) => `<div class="wl-ed" data-i="${i}">
      <input class="inp" data-k="name" placeholder="Name" value="${E(l.name || '')}">
      <input class="inp" data-k="url" placeholder="https://…" value="${E(l.url || '')}">
      <button class="btn" data-mv="-1" title="Move up" ${i ? '' : 'disabled'}>↑</button>
      <button class="btn" data-mv="1" title="Move down" ${i < list.length - 1 ? '' : 'disabled'}>↓</button>
      <button class="btn" data-del title="Remove">✕</button></div>`).join('');
  const open = () => {
    api.ui.modal('Web links', `<p style="color:var(--muted);margin:0 0 12px">Pinned in the sidebar, each opens in a new tab.</p><div id="wl-rows">${rows()}</div><button class="btn" id="wl-add">+ Add link</button>`,
      `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="wl-save">Save</button>`);
    const box = document.getElementById('wl-rows');
    const read = () => box.querySelectorAll('.wl-ed').forEach(r => { const l = list[+r.dataset.i]; r.querySelectorAll('input').forEach(inp => { l[inp.dataset.k] = inp.value; }); });
    box.onclick = e => {
      const b = e.target.closest('button'); if (!b) return; read();
      const i = +b.closest('.wl-ed').dataset.i;
      if (b.hasAttribute('data-del')) list.splice(i, 1);
      else { const j = i + +b.dataset.mv; [list[i], list[j]] = [list[j], list[i]]; }
      box.innerHTML = rows();
    };
    document.getElementById('wl-add').onclick = () => { read(); list.push({ name: '', url: '' }); box.innerHTML = rows(); box.querySelector('.wl-ed:last-child input').focus(); };
    document.getElementById('wl-save').onclick = () => {
      read();
      const bad = list.find(l => l.url.trim() && !clean(l.url));
      if (bad) return api.ui.toast('Only http and https links: ' + bad.url);
      const out = list.map(l => ({ name: l.name.trim().slice(0, 60), url: clean(l.url) })).filter(l => l.url).slice(0, 40);
      api.storage.set('links', out); api.ui.close(); api.ui.refreshWidgets();
      api.ui.toast(out.length ? `Saved ${out.length} link${out.length === 1 ? '' : 's'}` : 'Links cleared');
    };
    const first = box.querySelector('.wl-ed:last-child input'); if (first && !first.value) first.focus();
  };
  open();
}
