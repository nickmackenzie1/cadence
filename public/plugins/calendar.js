/* Calendar — your meetings inside Cadence.
   The NAS reads iCal feeds (Google "secret address", Outlook "publish", iCloud) — URLs never leave the NAS.
   Today's schedule on Home, matched to clients; a heads-up in the Island before each meeting with Prep / Start;
   one-click Meeting Mode with the right client; a nudge to import Fireflies notes after it ends. */
(() => {
  const G = window.__cal = window.__cal || { events: [], at: 0, nudged: {} };
  if (!G.style) {
    G.style = document.createElement('style');
    G.style.textContent = `
      .cal-strip{margin:0 0 22px}
      .cal-h{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:var(--muted);padding:0 4px 9px}
      .cal-h button{margin-left:auto;font-size:12px;color:var(--muted);font-weight:500;padding:2px 6px;border-radius:6px}
      .cal-h button:hover{background:var(--hover);color:var(--text)}
      .cal-row{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 6px;scrollbar-width:thin}
      .cal-ev{flex:none;display:flex;align-items:center;gap:10px;min-width:210px;max-width:290px;padding:9px 12px 9px 10px;border-radius:12px;background:var(--panel);border:1px solid var(--line);cursor:pointer;position:relative;overflow:hidden;transition:transform .15s,box-shadow .2s}
      .cal-ev:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(0,0,0,.06)}
      .cal-ev:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--cc,#5b5bd6)}
      .cal-ev.past{opacity:.5}
      .cal-ev.now{border-color:color-mix(in srgb,var(--cc) 50%,var(--line));box-shadow:0 0 0 3px color-mix(in srgb,var(--cc) 14%,transparent)}
      .cal-ev .prog{position:absolute;left:0;bottom:0;height:2px;background:var(--cc)}
      .cal-ev .tm{font:600 12px/1.2 ui-sans-serif,system-ui;font-variant-numeric:tabular-nums;color:var(--muted);flex:none;width:52px}
      .cal-ev .tm b{display:block;color:var(--text);font-size:13px}
      .cal-ev .tx{min-width:0;flex:1}
      .cal-ev .tx b{display:block;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .cal-ev .tx span{display:block;font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .cal-empty{font-size:12.5px;color:var(--muted);padding:6px 4px}
      .cal-empty a{color:var(--accent);cursor:pointer}
      .cal-pop{min-width:300px;max-width:340px;padding:12px 14px}
      .cal-pop h4{margin:0 0 4px;font-size:14px}
      .cal-pop .meta{font-size:12px;color:var(--muted);margin-bottom:10px}
      .cal-pop .att{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0 10px}
      .cal-pop .att span{font-size:11px;padding:2px 7px;border-radius:999px;background:var(--hover);color:var(--muted)}
      .cal-pop .acts{display:flex;gap:6px;flex-wrap:wrap}
      .cal-next{font-size:12.5px;color:var(--muted);margin-top:8px}
      .cal-next b{color:var(--text);font-weight:600}
      .cal-cfg{display:grid;grid-template-columns:14px 1fr auto auto;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)}
      .cal-cfg i{width:12px;height:12px;border-radius:50%}
    `;
    document.head.appendChild(G.style);
  }
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const fmtT = ms => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

  Cadence.registerPlugin({
    id: 'calendar', spaces: ['work'], name: 'Calendar', version: '1.0.0', settings: () => window.__cal.settings && window.__cal.settings(), icon: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9.5h16M8.5 3v4M15.5 3v4M12 13v3l2 1.2"/>', color: '#e5484d', category: 'Meetings', tagline: 'Meetings matched to clients',
    description: 'Your meetings in Cadence: today’s schedule matched to clients, a heads-up before each meeting with Prep / Start, and a nudge to import Fireflies notes afterwards. Reads iCal feeds through the NAS.',
    setup(api) {
      const E = api.ui.esc, opts = () => Object.assign({ sample: false, lead: 10 }, api.storage.get('settings') || {}, api.system().demo ? { sample: true } : {});

      /* ---------- matching an event to a client ---------- */
      function matchClient(ev) {
        const cl = api.clients.list(); if (!cl.length) return null;
        const doms = (ev.attendees || []).map(a => a.email.split('@')[1]).concat([(ev.organizer || '').split('@')[1]]).filter(Boolean);
        const text = norm(ev.title + ' ' + (ev.description || '').slice(0, 300) + ' ' + (ev.location || ''));
        let best = null, score = 0;
        for (const c of cl) {
          let sc = 0;
          if (c.domain && doms.some(d => d === c.domain || d.endsWith('.' + c.domain))) sc += 5;
          const n = norm(c.name); if (n.length >= 3 && text.includes(n)) sc += 4;
          const first = norm(c.name.split(/\s+/)[0]); if (first.length >= 4 && text.includes(first)) sc += 2;
          if ((c.links || []).some(l => { try { return text.includes(norm(new URL(l.url).hostname)); } catch { return false; } })) sc += 1;
          if (sc > score) { score = sc; best = c; }
        }
        return score >= 2 ? best : null;
      }

      /* ---------- data ---------- */
      function sampleEvents() {
        const cl = api.clients.list(), now = new Date(), at = (dayOff, h, m) => { const d = new Date(now); d.setDate(d.getDate() + dayOff); d.setHours(h, m, 0, 0); return d.getTime(); };
        const soon = Date.now() + 12 * 60e3, c = i => cl[i % Math.max(1, cl.length)];
        const mk = (id, title, start, mins, client) => ({ id, cal: 'sample', title, start, end: start + mins * 60e3, attendees: client && client.domain ? [{ email: 'team@' + client.domain, name: client.name + ' team' }] : [], join: 'https://zoom.us/j/000000000', location: '', description: 'Sample event' });
        const ev = [mk('s1', `Weekly sync — ${c(0) ? c(0).name : 'Client'}`, soon, 30, c(0)), mk('s2', `${c(1) ? c(1).name : 'Client'} · CRM blueprint review`, at(0, 15, 0), 60, c(1)), mk('s3', 'Focus block', at(0, 9, 0), 90, null),
          mk('s4', `${c(2) ? c(2).name : 'Client'} kickoff`, at(1, 10, 0), 45, c(2)), mk('s5', `Status call — ${c(0) ? c(0).name : 'Client'}`, at(2, 14, 30), 30, c(0))];
        return ev.sort((a, b) => a.start - b.start);
      }
      async function load(force) {
        if (opts().sample) { G.events = sampleEvents(); G.at = Date.now(); G.errors = []; return G.events; }
        if (api.system().mode !== 'nas') { for (let i = 0; i < 20 && api.system().mode !== 'nas'; i++) await new Promise(r => setTimeout(r, 250)); }
        if (api.system().mode !== 'nas') { G.events = []; G.errors = []; return []; }
        try {
          const r = await fetch('api/calendar/events?days=14' + (force ? '&refresh=1' : ''), { cache: 'no-store' }); const j = await r.json();
          G.errors = j.events.filter(e => e.error); G.events = j.events.filter(e => !e.error); G.at = Date.now();
        } catch (e) { G.errors = [{ message: e.message }]; }
        return G.events;
      }
      const enrich = ev => { const c = matchClient(ev); return { ...ev, client: c }; };
      const todays = () => G.events.filter(e => !e.allDay && sameDay(e.start, Date.now())).map(enrich);

      /* ---------- actions ---------- */
      function startFor(ev) {
        const c = ev.client || matchClient(ev);
        const who = (ev.attendees || []).map(a => a.name || a.email).filter(Boolean).slice(0, 8).join(', ');
        api.meetings.start(c ? c.id : null, `${ev.title}\n${fmtT(ev.start)}–${fmtT(ev.end)}${who ? '\nWith: ' + who : ''}\n\nNotes\n`);
      }
      function prepFor(ev) { const c = ev.client || matchClient(ev); if (c && window.CadencePrep) window.CadencePrep.open(c); else startFor(ev); }
      function details(ev, anchor) {
        const c = ev.client;
        const html = `<div class="cal-pop"><h4>${E(ev.title)}</h4><div class="meta">${new Date(ev.start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${fmtT(ev.start)}–${fmtT(ev.end)}${ev.location ? ' · ' + E(ev.location) : ''}</div>
          ${c ? `<div style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:6px">${api.ui.avatar(c, 20)} ${E(c.name)}</div>` : '<div class="muted" style="font-size:12px;margin-bottom:6px">No client matched</div>'}
          ${(ev.attendees || []).length ? `<div class="att">${ev.attendees.slice(0, 10).map(a => `<span title="${E(a.email)}">${E(a.name || a.email)}</span>`).join('')}</div>` : ''}
          <div class="acts">${ev.join ? `<a class="btn" href="${E(ev.join)}" target="_blank" rel="noopener">Join ↗</a>` : ''}${c ? '<button class="btn" data-a="prep">☰ Prep</button>' : ''}<button class="btn primary" data-a="start">◉ Start meeting</button></div></div>`;
        const pop = document.createElement('div'); pop.className = 'pop'; pop.innerHTML = html; document.body.appendChild(pop);
        const r = anchor.getBoundingClientRect(); pop.style.left = Math.max(10, Math.min(innerWidth - pop.offsetWidth - 10, r.left)) + 'px'; pop.style.top = Math.min(innerHeight - pop.offsetHeight - 10, r.bottom + 6) + 'px';
        const close = () => { pop.classList.add('out'); setTimeout(() => pop.remove(), 140); document.removeEventListener('pointerdown', out, true); };
        const out = e => { if (!pop.contains(e.target)) close(); };
        setTimeout(() => document.addEventListener('pointerdown', out, true), 0);
        pop.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { close(); b.dataset.a === 'prep' ? prepFor(ev) : startFor(ev); });
      }

      /* ---------- Home: today's schedule ---------- */
      function strip() {
        const list = todays(), now = Date.now();
        const evHtml = ev => { const c = ev.client, col = c ? ((c.brand && c.brand.primary) || c.color) : '#8a877f', past = ev.end < now, cur = ev.start <= now && ev.end > now;
          return `<div class="cal-ev ${past ? 'past' : ''} ${cur ? 'now' : ''}" data-ev="${E(ev.id)}" style="--cc:${col}"><div class="tm"><b>${fmtT(ev.start).replace(/\s?[AP]M$/i, '')}</b>${cur ? 'now' : Math.round((ev.end - ev.start) / 60e3) + 'm'}</div>
            ${c ? api.ui.avatar(c, 26) : ''}<div class="tx"><b>${E(ev.title)}</b><span>${c ? E(c.name) : (ev.attendees || []).length ? ev.attendees.length + ' attendees' : 'No client'}</span></div>${cur ? `<span class="prog" style="width:${Math.round((now - ev.start) / (ev.end - ev.start) * 100)}%"></span>` : ''}</div>`; };
        const configured = opts().sample || (G.cfg && G.cfg.calendars && G.cfg.calendars.length);
        return `<div class="cal-strip"><div class="cal-h">Today’s meetings${list.length ? ` · ${list.length}` : ''}${opts().sample ? ' <span class="badge">sample</span>' : ''}<button data-calcfg>${configured ? 'Calendars' : 'Connect calendar'}</button></div>
          ${list.length ? `<div class="cal-row">${list.map(evHtml).join('')}</div>` : `<div class="cal-empty">${configured ? 'No meetings today.' : 'Connect your Google or Outlook calendar to see meetings here — or <a data-calsample>try a sample calendar</a>.'}</div>`}</div>`;
      }
      function mount() {
        const route = api.ui.currentRoute();
        if (route.startsWith('client-')) {
          const cid = route.slice(7), up = G.events.map(enrich).filter(e => e.client && e.client.id === cid && e.end > Date.now())[0];
          const hero = document.querySelector('.c-hero .head > div');
          if (up && hero && !hero.querySelector('.cal-next')) hero.insertAdjacentHTML('beforeend', `<div class="cal-next">📅 Next meeting <b>${new Date(up.start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${fmtT(up.start)}</b> — ${E(up.title)}</div>`);
        }
      }
      api.today.schedule(() => todays().filter(e => !e.allDay).map(ev => ({ start: ev.start, end: ev.end, title: ev.title, sub: ev.client ? ev.client.name : '',
        color: ev.client ? ((ev.client.brand && ev.client.brand.primary) || ev.client.color) : '', attrs: `data-ev="${E(ev.id)}"` })),
        () => `<button class="td-link" data-calcfg>${opts().sample || (G.cfg && G.cfg.calendars && G.cfg.calendars.length) ? 'Calendars' : 'Connect calendar'}</button>`);
      // after new events arrive: redraw Today (its schedule), or just the bits mount() adds elsewhere
      const repaint = () => { if (api.ui.currentRoute() === 'today') api.ui.refresh(); else mount(); };
      api.on('render', mount);
      api.on('refocus', () => load().then(() => { repaint(); tick(); }).catch(() => {}));
      if (!G.clickBound) {
        G.clickBound = true;
        document.addEventListener('click', e => {
          const evEl = e.target.closest('[data-ev],[data-calev]'); if (evEl) { e.stopPropagation(); const id = evEl.dataset.ev || evEl.dataset.calev; const ev = G.events.map(enrich).find(x => x.id === id); if (ev) G.details(ev, evEl); return; }
          if (e.target.closest('[data-calcfg]')) { e.stopPropagation(); G.settings(); }
          if (e.target.closest('[data-calsample]')) { e.stopPropagation(); G.sample(); }
        }, true);
      }
      G.details = details;

      /* ---------- Island: heads-up before, live during, nudge after ---------- */
      function tick() {
        const I = api.island;
        const now = Date.now(), active = api.meetings.active(), lead = opts().lead * 60e3;
        const list = G.events.filter(e => !e.allDay).map(enrich);
        const soon = list.find(e => e.start > now && e.start - now <= lead), cur = list.find(e => e.start <= now && e.end > now);
        if (!active && (soon || cur)) {
          const ev = soon || cur, c = ev.client;
          const label = () => { const m = Math.round((ev.start - Date.now()) / 60e3); return ev.start > Date.now() ? (m <= 0 ? 'now' : `in ${m} min`) : 'now'; };
          I.live('next', { prio: 5, view: () => ({ tick: label, minW: 210, onClick: () => soon ? prepFor(ev) : startFor(ev),
            html: `${c ? api.ui.avatar(c, 18) : '<span class="isl-dot" style="background:#5cc8ff;box-shadow:0 0 0 3px rgba(92,200,255,.2)"></span>'}<span class="isl-t"><b>${E(c ? c.name : ev.title)}</b></span><span class="isl-right" data-live-tick>${label()}</span>` }) });
          if (soon && !G.nudged['pre' + ev.id] && ev.start - now <= 5 * 60e3) { G.nudged['pre' + ev.id] = 1; I.show({ icon: '📅', color: '#2f7de1', title: ev.title, sub: `Starts ${label()}${c ? ' · ' + c.name : ''}`, actions: [{ label: 'Start', run: () => startFor(ev) }].concat(c ? [{ label: 'Prep', run: () => prepFor(ev) }] : []).concat(ev.join ? [{ label: 'Join', run: () => window.open(ev.join, '_blank', 'noopener') }] : []) }); }
        } else I.clear('next');
        // just ended (and no meeting logged): offer the Fireflies import
        const ended = list.find(e => e.end <= now && now - e.end < 20 * 60e3 && e.client && !G.nudged['post' + e.id]);
        if (ended && !active) {
          const logged = api.meetings.list().some(m => m.clientId === ended.client.id && m.end > ended.start - 30 * 60e3);
          G.nudged['post' + ended.id] = 1;
          if (!logged) I.show({ icon: '📝', color: '#8a3ffc', title: `${ended.client.name} meeting ended`, sub: 'Grab the action items while they’re fresh', actions: [{ label: 'Import notes', run: () => api.meetings.importNotes(ended.client.id) }, { label: 'Later', run: () => {} }] });
        }
      }
      clearInterval(G.tickT); G.tickT = setInterval(tick, 30000);
      clearInterval(G.loadT); G.loadT = setInterval(() => load().then(() => { repaint(); tick(); }), 5 * 60e3);

      /* ---------- settings ---------- */
      async function settings() {
        let cfg = { calendars: [] };
        if (api.system().mode === 'nas') { try { cfg = await (await fetch('api/calendar/config', { cache: 'no-store' })).json(); } catch (e) {} }
        G.cfg = cfg; const cals = cfg.calendars.map(c => ({ ...c })), o = opts();
        const draw = () => {
          api.ui.modal('📅 Calendars', `
            <p class="muted" style="margin:0;font-size:13px">Paste a private iCal link. It’s stored only on your NAS — never synced, never sent to GitHub.<br>
            <b>Google:</b> Calendar settings → your calendar → Integrate calendar → “Secret address in iCal format”. <b>Outlook:</b> Settings → Calendar → Shared calendars → Publish → ICS link.</p>
            <div>${cals.map((c, i) => `<div class="cal-cfg"><i style="background:${E(c.color)}"></i><div><b style="font-size:13px">${E(c.name)}</b><div class="muted" style="font-size:11px">${E(c.host || 'new')}</div></div><input type="color" value="${E(c.color)}" data-col="${i}" style="width:28px;height:24px;border:0;background:none"><button class="btn ghost danger" data-del="${i}">✕</button></div>`).join('')}</div>
            ${api.system().mode === 'nas' ? `<div class="field"><label>Add a calendar</label><div class="row"><input class="inp" id="cal-name" placeholder="Name (e.g. Work)" style="max-width:150px"><input class="inp" id="cal-url" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"></div></div>` : '<div class="muted" style="font-size:12.5px">Calendar links are read by your NAS — open Cadence there to connect one.</div>'}
            <div class="row" style="gap:16px;align-items:center;flex-wrap:wrap">
              <label class="row" style="align-items:center;gap:6px;font-size:13px"><input type="checkbox" id="cal-sample" ${o.sample ? 'checked' : ''}> Use a sample calendar (preview)</label>
              <label class="row" style="align-items:center;gap:6px;font-size:13px">Heads-up <select class="inp" id="cal-lead" style="width:auto;padding:4px 8px">${[5, 10, 15].map(n => `<option ${o.lead === n ? 'selected' : ''}>${n}</option>`).join('')}</select> min before</label>
            </div>`,
            `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="cal-save">Save</button>`, 'wide');
          document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { cals.splice(+b.dataset.del, 1); draw(); });
          document.querySelectorAll('[data-col]').forEach(b => b.oninput = () => { cals[+b.dataset.col].color = b.value; });
          document.querySelector('#cal-save').onclick = async () => {
            const name = (document.querySelector('#cal-name') || {}).value, url = ((document.querySelector('#cal-url') || {}).value || '').trim();
            if (url) cals.push({ id: 'c' + Date.now().toString(36), name: name || 'Calendar', color: '#2f7de1', url });
            api.storage.set('settings', { ...opts(), sample: document.querySelector('#cal-sample').checked, lead: +document.querySelector('#cal-lead').value });
            if (api.system().mode === 'nas' && !api.system().demo) { try { await fetch('api/calendar/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ calendars: cals }) }); G.cfg = await (await fetch('api/calendar/config', { cache: 'no-store' })).json(); } catch (e) { api.ui.toast('Could not save: ' + e.message); } }
            api.ui.close(); await load(true); api.ui.refresh(); tick();
            api.ui.toast(G.errors && G.errors.length ? 'A calendar couldn’t be read — check the link' : `Calendar updated · ${todays().length} meetings today`);
          };
        };
        draw();
      }
      G.settings = settings;
      G.sample = () => { api.storage.set('settings', { ...opts(), sample: true }); load().then(() => { api.ui.refresh(); tick(); }); };
      api.commands.add({ title: 'Calendar settings', run: () => settings() });
      api.onSettings(() => settings());
      api.commands.add({ title: 'Start meeting from calendar (current / next)', run: () => { const ev = G.events.map(enrich).find(e => e.end > Date.now()); if (ev) startFor(ev); else api.ui.toast('No upcoming meetings'); } });

      // first load
      (async () => { if (api.system().mode === 'nas') { try { G.cfg = await (await fetch('api/calendar/config', { cache: 'no-store' })).json(); } catch (e) {} } await load(); repaint(); tick(); })();
    }
  });
})();
