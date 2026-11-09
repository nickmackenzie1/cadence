/* Links on tasks: paste a Zoho Projects task URL (or CRM / Books / Creator record), a Gmail or Outlook email, or any
   web link into quick add, or link one from a task's ⋯ menu, and the task carries a tidy card with an Open button.
   Zoho and Google refuse to be framed inside other sites, so it's a card, not an iframe. Stored as task.ref.
   Desk ticket links belong to the Desk tickets plugin. */
Cadence.registerPlugin({
  id: 'zoho-link', name: 'Links on tasks', version: '1.1.0', category: 'Clients', spaces: ['work', 'life'],
  description: 'Paste a Zoho Projects task, a CRM/Books/Creator record, a Gmail or Outlook email, or any web link into a task and it shows as a clean card with an Open button. Works in quick add: "Reply to Sam https://mail.google.com/mail/u/0/#inbox/…".',
  tagline: 'Zoho tasks, emails and links on your tasks', color: '#e42527',
  icon: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
  setup(api) {
    const E = api.ui.esc;
    const APPS = { projects: 'Zoho Projects', crm: 'Zoho CRM', books: 'Zoho Books', creator: 'Zoho Creator', creatorapp: 'Zoho Creator', inventory: 'Zoho Inventory', sprints: 'Zoho Sprints', bugtracker: 'Zoho BugTracker' };
    const URL_RE = /https?:\/\/[^\s<>"')]+/i;
    // what kind of Zoho thing a URL points at
    function parse(url) {
      let u; try { u = new URL(url); } catch { return null; }
      const host = u.hostname.toLowerCase().replace(/^www\./, '');
      if (/^desk\.zoho\./.test(host)) return null;   // the Desk tickets plugin owns these
      // email: Gmail / Outlook keep the message id in the URL, which is all we need to jump back to it
      if (host === 'mail.google.com') { const acct = (u.pathname.match(/\/u\/(\d+)/) || [])[1] || '0', id = (u.hash.match(/\/([A-Za-z0-9]{12,})$/) || [])[1] || '';
        return { url, app: 'gmail', appName: 'Gmail', kind: id ? 'Email' : 'Inbox', portal: acct !== '0' ? 'account ' + (+acct + 1) : '', id }; }
      if (/^outlook\.(office|office365|live)\.com$/.test(host)) { const id = decodeURIComponent((u.pathname.match(/\/id\/([^/]+)/) || [])[1] || '');
        return { url, app: 'outlook', appName: 'Outlook', kind: id ? 'Email' : 'Mail', portal: host.includes('live') ? 'personal' : 'work', id: id ? id.slice(-10) : '' }; }
      const sub = host.split('.')[0], zoho = /(^|\.)zoho(cloud)?\.[a-z.]+$/.test(host), app = zoho && APPS[sub] ? sub : zoho && host.includes('creator') ? 'creator' : null;
      if (!app) return { url, app: 'web', appName: host, kind: 'Link', portal: '', id: '', host };
      const full = u.pathname + u.hash, nums = full.match(/\d{6,}/g) || [];
      const portal = (u.pathname.match(/\/portal\/([^/#?]+)/) || [])[1] || (u.pathname.match(/\/(org\d+)/) || [])[1] || '';
      let kind = 'Link';
      if (app === 'projects' || app === 'sprints') kind = /task|taskdetail/i.test(full) ? 'Task' : /bug|issue/i.test(full) ? 'Issue' : /milestone/i.test(full) ? 'Milestone' : /project/i.test(full) ? 'Project' : 'Link';
      else if (app === 'crm') kind = ((full.match(/\/tab\/([A-Za-z_]+)/) || [])[1] || 'Record').replace(/_/g, ' ').replace(/s$/, '');
      else if (app === 'books' || app === 'inventory') kind = ((full.match(/#\/([a-z]+)/) || [])[1] || 'Record').replace(/s$/, '');
      else kind = 'Record';
      return { url, app, appName: APPS[app] || 'Zoho', kind: kind.charAt(0).toUpperCase() + kind.slice(1), portal, id: nums.length ? nums[nums.length - 1] : '' };
    }
    const ICONS = { zoho: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>',
      mail: '<rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 7l8 6 8-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' };
    const mark = (app, z) => app === 'web' && z ? `<span class="zl-mark zl-web"><img src="${E(api.ui.faviconUrl(z.host))}" alt="" onerror="this.remove()"></span>` : `<span class="zl-mark zl-${E(app)}"><svg viewBox="0 0 24 24">${app === 'gmail' || app === 'outlook' ? ICONS.mail : ICONS.zoho}</svg></span>`;
    const refOf = t => t.ref || t.zoho || null;
    const label = z => z.app === 'web' ? z.host : `${z.appName} ${z.kind.toLowerCase()}`;

    // quick add: pull the URL out of the title
    api.parsers.add((text, r) => {
      let z = null; const out = text.replace(new RegExp('\\s(' + URL_RE.source + ')(?=\\s)', 'i'), (m, url) => { z = parse(url); return z ? ' ' : m; });
      if (!z) return text; r.ref = z;
      // only the link was typed: name the task after what it points at
      return out.replace(/[@^>#!][^\s]*/g, '').trim() ? out : ` ${z.app === 'web' ? 'Check ' + z.host : z.app === 'gmail' || z.app === 'outlook' ? 'Email in ' + z.appName : z.appName + ' ' + z.kind.toLowerCase() + (z.id ? ' ' + z.id.slice(-6) : '')}${out}`;
    });

    // rows: a chip that opens the link directly
    api.chips.add((t, preview) => { const z = refOf(t); if (!z) return '';
      return preview ? `<span class="chip zl-chip">${mark(z.app, z)}${E(z.app === 'web' ? z.host : z.kind)} link</span>`
        : `<a class="chip zl-chip" href="${E(z.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="Open ${E(label(z))}">${mark(z.app, z)}${E(z.app === 'web' ? z.host : z.kind)} ↗</a>`; });
    api.taskCards.add(t => { const z = refOf(t); if (!z) return '';
      const sub = z.app === 'web' ? z.url.replace(/^https?:\/\/(www\.)?/, '') : [z.portal && E(z.portal), z.id && '#' + E(z.id.slice(-8))].filter(Boolean).join(' · ') || E(new URL(z.url).hostname);
      return `<div class="zl-card">${mark(z.app, z)}<div class="zl-tx"><b>${E(label(z))}</b><span>${z.app === 'web' ? E(sub) : sub}</span></div>
        <a class="btn" href="${E(z.url)}" target="_blank" rel="noopener">Open${z.app === 'web' ? '' : ' in ' + E(z.appName.replace('Zoho ', ''))}</a><button class="zl-x" data-zl-rm="${E(t.id)}" title="Remove link">✕</button></div>`; });
    if (!window.__zlBound) { window.__zlBound = true;
      document.addEventListener('click', e => { const b = e.target.closest('[data-zl-rm]'); if (b) { e.stopPropagation(); window.__zlApi.tasks.update(b.dataset.zlRm, { ref: null, zoho: null }); window.__zlApi.ui.refresh(); } }, true); }
    window.__zlApi = api;

    function link(task) {
      api.ui.modal('Link to this task', `<div class="muted" style="margin:-4px 0 12px;font-size:13px">${E(task.title)}</div><div class="field"><label>Zoho Projects task, Gmail or Outlook email, or any link</label><input class="inp" id="zl-url" value="${E(refOf(task) ? refOf(task).url : '')}" placeholder="https://projects.zoho.com/portal/…   or   https://mail.google.com/mail/u/0/#inbox/…"></div><div class="muted" id="zl-msg" style="font-size:12px"></div>`,
        `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="zl-save">Link</button>`);
      const save = () => { const v = document.getElementById('zl-url').value.trim(), z = parse(v); if (!z) { document.getElementById('zl-msg').textContent = 'Paste a full link starting with https://'; return; } api.tasks.update(task.id, { ref: z, zoho: null }); api.ui.close(); api.ui.refresh(); };
      document.getElementById('zl-save').onclick = save; document.getElementById('zl-url').onkeydown = e => { if (e.key === 'Enter') save(); };
      setTimeout(() => document.getElementById('zl-url')?.focus(), 30);
    }
    api.taskActions.add({ label: 'Link a Zoho task, email or page…', run: t => link(t) });

    if (!document.getElementById('zl-css')) { const st = document.createElement('style'); st.id = 'zl-css'; st.textContent = `
      .zl-mark{display:inline-grid;place-items:center;width:15px;height:15px;border-radius:4px;background:#e42527;color:#fff;flex:none}
      .zl-mark svg{width:11px;height:11px;fill:currentColor;stroke:none}
      .zl-mark.zl-gmail{background:#d93025}.zl-mark.zl-outlook{background:#0a64c2}.zl-mark.zl-web{background:var(--hover);overflow:hidden}.zl-mark img{width:100%;height:100%;object-fit:contain}
      a.chip.zl-chip{text-decoration:none;color:inherit;cursor:pointer}a.chip.zl-chip:hover{border-color:var(--accent);color:var(--accent)}
      .zl-mark.zl-crm{background:#0a6ed1}.zl-mark.zl-books{background:#1f9d63}.zl-mark.zl-creator{background:#7a3fc4}.zl-mark.zl-projects,.zl-mark.zl-sprints{background:#e42527}
      .chip.zl-chip{gap:5px}
      .zl-card{display:flex;align-items:center;gap:12px;margin:8px 0 10px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
      .zl-card .zl-mark{width:32px;height:32px;border-radius:9px}.zl-card .zl-mark svg{width:20px;height:20px}
      .zl-tx{flex:1;min-width:0;display:flex;flex-direction:column}.zl-tx b{font-size:13.5px}.zl-tx span{font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .zl-card .btn{text-decoration:none;padding:6px 12px;font-size:12.5px}
      .zl-x{color:var(--faint);padding:4px 6px;border-radius:6px;font-size:12px}.zl-x:hover{background:var(--hover);color:var(--danger)}
    `; document.head.appendChild(st); }
  }
});
