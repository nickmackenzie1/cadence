/* Notifications: one place for everything Cadence tells you.
   - A bell in the sidebar footer opens the notification centre: history (synced), unread dots, click to jump.
   - Per-plugin switches: mute any plugin's notices, or let them through to desktop notifications too.
   - Quiet hours: nothing pops up or pings (still kept in the history).
   - Push notifications: this device subscribes through a service worker; the NAS sends reminders even when no Cadence tab
     is open (keys and subscriptions live on the NAS only; the push goes out through your browser's push service). */
(() => {
  const BELL = '<svg class="lu" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></svg>';
  const G = window.__notify = window.__notify || {};
  Cadence.registerPlugin({
    id: 'notify', name: 'Notifications', version: '1.0.0', category: 'Essentials', spaces: ['work', 'life'],
    description: 'A notification centre with history, per-plugin settings, quiet hours, and push notifications to this device even when Cadence is closed.',
    tagline: 'Bell, history, quiet hours, push', color: '#f59e0b',
    icon: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
    settings() { G.settings && G.settings(); },
    setup(api) {
      const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
      const cfg = () => Object.assign({ muted: {}, desktop: { reminders: true }, quiet: null }, api.storage.get('cfg') || {});
      const setCfg = p => { api.storage.set('cfg', Object.assign(cfg(), p)); };
      const list = () => api.storage.get('items') || [];
      const setList = l => { api.storage.set('items', l.slice(0, 150)); api.ui.refreshSide(); };
      const unread = () => list().filter(n => !n.read).length;
      const inQuiet = () => { const q = cfg().quiet; if (!q || !q.from || !q.to) return false; const d = new Date(), m = d.getHours() * 60 + d.getMinutes(), [a, b] = [q.from, q.to].map(x => { const [h, mm] = x.split(':').map(Number); return h * 60 + mm; }); return a < b ? m >= a && m < b : m >= a || m < b; };
      const nameOf = pid => pid === 'reminders' ? 'Reminders' : pid === 'core' ? 'Cadence' : (api.plugins.list().find(p => p.id === pid) || {}).name || pid;

      /* incoming */
      api.on('notify', n => {
        const c = cfg(); if (c.muted[n.pid]) return;
        const item = { id: n.id, at: n.at, pid: n.pid, title: String(n.title || '').slice(0, 140), body: String(n.body || '').slice(0, 280), route: n.route || '', taskId: n.taskId || '', kind: n.kind || '', read: false };
        // the same notice twice in a row within a minute (e.g. a re-render) is one notice
        const l = list(); if (l[0] && l[0].title === item.title && l[0].pid === item.pid && item.at - l[0].at < 60e3) return;
        setList([item, ...l]);
        const wantDesk = n.desktop || c.desktop[n.pid];
        if (wantDesk && !inQuiet() && 'Notification' in window && Notification.permission === 'granted' && (document.hidden || n.kind === 'reminder')) {
          const opts = { body: item.body, tag: n.tag || item.id, icon: 'favicon.svg' };
          navigator.serviceWorker && navigator.serviceWorker.getRegistration ? navigator.serviceWorker.getRegistration().then(r => r ? r.showNotification(item.title, { ...opts, data: { url: item.route ? '/#' + item.route : '/' } }) : new Notification(item.title, opts)).catch(() => { try { new Notification(item.title, opts); } catch (e) {} }) : (() => { try { new Notification(item.title, opts); } catch (e) {} })();
        }
      });

      /* the centre */
      let panel = null;
      const ago = t => { const s = (Date.now() - t) / 1000; return s < 60 ? 'now' : s < 3600 ? Math.round(s / 60) + 'm' : s < 86400 ? Math.round(s / 3600) + 'h' : new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' }); };
      function center(btn) {
        if (panel) return close();
        panel = document.createElement('div'); panel.id = 'nt-panel'; document.body.appendChild(panel);
        const r = btn.getBoundingClientRect(); panel.style.left = Math.max(8, r.left - 20) + 'px'; panel.style.bottom = (innerHeight - r.top + 10) + 'px';
        draw(); setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
      }
      const outside = e => { if (panel && !panel.contains(e.target) && !e.target.closest('[data-foot="notify:bell"]')) close(); };
      function close() { panel && panel.remove(); panel = null; document.removeEventListener('pointerdown', outside, true); }
      function draw() {
        if (!panel) return; const l = list(), t0 = new Date().setHours(0, 0, 0, 0);
        const sec = (title, xs) => xs.length ? `<div class="nt-sec">${title}</div>` + xs.map(n => `<button class="nt-it ${n.read ? '' : 'new'}" data-id="${esc(n.id)}"><span class="nt-src">${esc(nameOf(n.pid))}</span><b>${esc(n.title)}</b>${n.body ? `<span class="nt-b">${esc(n.body)}</span>` : ''}<span class="nt-t">${ago(n.at)}</span></button>`).join('') : '';
        panel.innerHTML = `<header><b>Notifications</b>${inQuiet() ? '<span class="nt-q">Quiet hours</span>' : ''}<span class="sp"></span><button data-nt="read" title="Mark all read">Mark read</button><button data-nt="clear" title="Clear all">Clear</button><button data-nt="cfg" title="Settings">${api.ui.icon('settings')}</button></header>
          <div class="nt-list">${l.length ? sec('Today', l.filter(n => n.at >= t0)) + sec('Earlier', l.filter(n => n.at < t0)) : '<div class="nt-empty">You’re all caught up.</div>'}</div>`;
        panel.onclick = e => {
          const b = e.target.closest('[data-nt]'), it = e.target.closest('.nt-it');
          if (b) { const k = b.dataset.nt; if (k === 'read') setList(list().map(n => ({ ...n, read: true }))); if (k === 'clear') setList([]); if (k === 'cfg') { close(); G.settings(); return; } draw(); return; }
          if (it) { const n = list().find(x => x.id === it.dataset.id); setList(list().map(x => x.id === it.dataset.id ? { ...x, read: true } : x)); close();
            if (n && n.taskId) { const t = api.tasks.get(n.taskId); if (t) { api.ui.navigate(t.clientId ? 'client-' + t.clientId : 'today'); setTimeout(() => api.ui.openTask(t.id), 80); } } else if (n && n.route) api.ui.navigate(n.route); }
        };
        // opening the centre marks things as seen (dots stay until you click or mark read)
      }
      api.footer.add({ id: 'bell', icon: BELL, title: 'Notifications', badge: () => { const n = unread(); return n ? (n > 9 ? '9+' : n) : ''; }, run: btn => center(btn) });
      api.commands.add({ title: 'Notifications', hint: 'History and settings', run: () => { const b = document.querySelector('[data-foot="notify:bell"]'); b ? center(b) : G.settings(); } });
      api.commands.add({ title: 'Notification settings…', run: () => G.settings() });

      /* push on this device */
      const pushOK = () => 'serviceWorker' in navigator && 'PushManager' in window && window.isSecureContext && api.system().mode === 'nas';
      async function reg() { return navigator.serviceWorker.register('sw.js'); }
      async function subscribe() {
        if (!pushOK()) throw new Error(window.isSecureContext ? 'This browser has no push support.' : 'Push needs the HTTPS address of your NAS.');
        if (Notification.permission !== 'granted' && await Notification.requestPermission() !== 'granted') throw new Error('Notifications are blocked for this site in your browser settings.');
        const r = await reg(); await navigator.serviceWorker.ready;
        const { key } = await (await fetch('api/push/key')).json();
        const raw = Uint8Array.from(atob(key.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - key.length % 4) % 4)), c => c.charCodeAt(0));
        let sub = await r.pushManager.getSubscription(); if (!sub) sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw });
        const device = localStorage.getItem('cadence.device') || (navigator.userAgent.match(/\(([^;)]+)/) || [])[1] || 'This device';
        const res = await fetch('api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON(), device }) });
        if (!res.ok) throw new Error('The NAS refused the subscription.');
      }
      async function unsubscribe() { const r = await navigator.serviceWorker.getRegistration(); const sub = r && await r.pushManager.getSubscription(); if (sub) { await fetch('api/push/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); } }
      async function subscribed() { try { const r = await navigator.serviceWorker.getRegistration(); return !!(r && await r.pushManager.getSubscription()); } catch (e) { return false; } }
      if (pushOK()) navigator.serviceWorker.getRegistration().then(r => r || null).catch(() => {});
      if (!G.msg && 'serviceWorker' in navigator) { G.msg = true; navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'cadence-open') { const h = (e.data.url || '').split('#')[1]; if (h) location.hash = h; } }); }

      /* settings */
      G.settings = async () => {
        const c = cfg(), pids = [...new Set(['reminders', ...list().map(n => n.pid), ...api.plugins.list().filter(p => p.enabled).map(p => p.id).filter(id => ['calendar', 'desk', 'intern', 'stocks', 'zoho-status', 'rss', 'momentum', 'homeowner', 'chase'].includes(id))])];
        const perm = 'Notification' in window ? Notification.permission : 'unsupported', subd = await subscribed();
        let srv = null; try { if (api.system().mode === 'nas') srv = await (await fetch('api/push/config')).json(); } catch (e) {}
        api.ui.modal('Notifications', `
          <div class="field"><label>Which plugins can notify you</label>
            <div class="nt-grid"><span></span><b>In the centre</b><b>Desktop</b>${pids.map(p => `<span>${esc(nameOf(p))}</span><input type="checkbox" data-mute="${esc(p)}" ${c.muted[p] ? '' : 'checked'}><input type="checkbox" data-desk="${esc(p)}" ${c.desktop[p] ? 'checked' : ''}>`).join('')}</div></div>
          <div class="field"><label>Quiet hours</label><div class="row" style="gap:8px;align-items:center"><label class="xm-row" style="margin:0"><input type="checkbox" id="nt-qon" ${c.quiet ? 'checked' : ''}> From</label><input class="inp" type="time" id="nt-qf" value="${esc((c.quiet && c.quiet.from) || '21:00')}" style="width:auto"> to <input class="inp" type="time" id="nt-qt" value="${esc((c.quiet && c.quiet.to) || '07:30')}" style="width:auto"></div>
            <div class="muted" style="font-size:12px;margin-top:6px">Nothing pops up or pings during quiet hours. It all still lands in the centre.</div></div>
          <div class="field"><label>Desktop notifications in this browser</label><div class="muted" style="font-size:12.5px">${perm === 'granted' ? 'Allowed.' : perm === 'denied' ? 'Blocked in this browser’s site settings.' : perm === 'unsupported' ? 'Not supported here.' : 'Not allowed yet.'}</div>${perm === 'default' ? '<button class="btn" id="nt-perm" style="margin-top:6px">Allow desktop notifications</button>' : ''}</div>
          <div class="field"><label>Push to this device (works when Cadence is closed)</label>
            ${pushOK() ? `<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn ${subd ? '' : 'primary'}" id="nt-push">${subd ? 'Turn off push on this device' : 'Turn on push on this device'}</button>${subd ? '<button class="btn" id="nt-test">Send a test</button>' : ''}</div>
              ${srv ? `<div class="muted" style="font-size:12px;margin-top:6px">${srv.devices.length ? srv.devices.length + ' device' + (srv.devices.length === 1 ? '' : 's') + ' get pushes: ' + srv.devices.map(d => esc(d.device || d.host)).join(', ') : 'No devices yet.'} Reminders are sent by the NAS at the reminder time.</div>` : ''}`
              : `<div class="muted" style="font-size:12.5px">${!window.isSecureContext ? 'Open Cadence at its HTTPS address on your network to use push.' : api.system().mode !== 'nas' ? 'Push needs the Cadence server on your NAS.' : 'This browser has no push support.'}</div>`}</div>`,
          `<button class="btn primary" id="nt-done">Done</button>`);
        const $ = id => document.getElementById(id);
        const save = () => {
          const muted = {}, desktop = {}; document.querySelectorAll('[data-mute]').forEach(i => { if (!i.checked) muted[i.dataset.mute] = true; }); document.querySelectorAll('[data-desk]').forEach(i => { if (i.checked) desktop[i.dataset.desk] = true; });
          const quiet = $('nt-qon').checked ? { from: $('nt-qf').value, to: $('nt-qt').value } : null;
          setCfg({ muted, desktop, quiet });
          if (api.system().mode === 'nas') fetch('api/push/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reminders: !muted.reminders, quiet }) }).catch(() => {});
        };
        $('nt-perm') && ($('nt-perm').onclick = async () => { await Notification.requestPermission(); save(); G.settings(); });
        $('nt-push') && ($('nt-push').onclick = async () => { try { if (subd) await unsubscribe(); else await subscribe(); save(); api.ui.toast(subd ? 'Push is off on this device' : 'Push is on for this device'); G.settings(); } catch (e) { api.ui.toast(e.message); } });
        $('nt-test') && ($('nt-test').onclick = async () => { const r = await (await fetch('api/push/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json().catch(() => ({})); api.ui.toast(r.sent ? `Sent to ${r.sent} device${r.sent === 1 ? '' : 's'}` : 'Nothing was delivered. Try turning push off and on again.'); });
        $('nt-done').onclick = () => { save(); api.ui.close(); };
      };

      if (!document.getElementById('nt-css')) {
        const st = document.createElement('style'); st.id = 'nt-css';
        st.textContent = `
        #nt-panel{position:fixed;z-index:60;width:360px;max-height:min(70vh,560px);display:flex;flex-direction:column;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:14px;box-shadow:0 20px 50px -15px rgba(0,0,0,.35);overflow:hidden;animation:ntIn .18s ease-out}
        @keyframes ntIn{from{opacity:0;transform:translateY(6px)}}
        #nt-panel header{display:flex;align-items:center;gap:6px;padding:10px 12px;border-bottom:1px solid var(--line);font-size:13.5px}
        #nt-panel header .sp{flex:1}#nt-panel header button{background:none;border:0;color:var(--muted);font:600 11.5px Inter,system-ui;cursor:pointer;padding:4px 6px;border-radius:6px;display:inline-flex;align-items:center}
        #nt-panel header button:hover{background:var(--hover);color:var(--text)}#nt-panel header svg{width:15px;height:15px}
        .nt-q{font-size:10.5px;background:color-mix(in srgb,#6366f1 15%,transparent);color:#6366f1;border-radius:999px;padding:2px 7px;font-weight:700}
        .nt-list{overflow:auto;padding:4px 0}
        .nt-sec{font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);padding:8px 14px 4px}
        .nt-it{display:grid;grid-template-columns:1fr auto;gap:1px 8px;width:100%;text-align:left;background:none;border:0;padding:8px 14px 8px 22px;cursor:pointer;color:var(--text);position:relative;font:13px/1.35 Inter,system-ui}
        .nt-it:hover{background:var(--hover)}.nt-it.new:before{content:'';position:absolute;left:9px;top:14px;width:7px;height:7px;border-radius:50%;background:var(--accent)}
        .nt-it .nt-src{grid-column:1;font-size:10.5px;color:var(--muted);font-weight:600}.nt-it b{grid-column:1;font-weight:600}.nt-it .nt-b{grid-column:1;color:var(--muted);font-size:12px}
        .nt-it .nt-t{grid-column:2;grid-row:1;font-size:11px;color:var(--muted)}
        .nt-empty{padding:34px 14px;text-align:center;color:var(--muted);font-size:13px}
        .nt-grid{display:grid;grid-template-columns:1fr auto auto;gap:6px 18px;align-items:center;font-size:13px}.nt-grid b{font-size:11px;color:var(--muted);font-weight:600}.nt-grid input{justify-self:center}`;
        document.head.appendChild(st);
      }
      G.list = list;
    },
  });
})();
