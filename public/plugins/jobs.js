/* Background work (user, 2026-11-18: "a place where we could view these jobs and control them"). Every job the NAS
   runs on its own (server/lib/scheduler.js), from both the app and the music side, with what it's doing now, when it
   last ran and how that went, and its last few runs. Each can be run now, paused (remembered across restarts) or set
   to run more or less often. Plain words, no red, no countdowns: "in about 2 h", not a ticking clock. */
(() => {
  Cadence.registerPlugin({
    id: 'jobs', name: 'Background work', version: '1.0.0', category: 'System', color: '#64748b',
    icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    tagline: 'See and control what the NAS does on its own',
    description: 'Every background job on the NAS (KEXP history, Radar scans, feeds, reminders, database upkeep…): what it is doing, when it last ran and how long it took. Run one now, pause it, or change how often it runs.',
    setup(api) {
      const E = api.ui.esc, ic = n => api.ui.icon(n);
      const G = { list: null, at: 0, open: {}, busy: {}, err: null, timer: 0 };
      const url = j => (j.where === 'music' ? 'api/radar/jobs/' : 'api/jobs/') + encodeURIComponent(j.name);
      const getJ = async u => { try { const r = await fetch(u); return r.ok ? await r.json() : []; } catch { return []; } };
      // the list from this device's last copy straight away (2026-11-19), the NAS's when both answer
      try { const a = JSON.parse(localStorage.getItem('cadence.c.jobs') || 'null'); if (Array.isArray(a)) G.list = a; } catch {}
      const load = async () => {
        const [a, m] = await Promise.all([getJ('api/jobs'), getJ('api/radar/jobs')]);
        try { const t = JSON.stringify([...a, ...m]); if (t.length < 400000) localStorage.setItem('cadence.c.jobs', t); } catch {}
        G.list = [...a, ...m]; G.at = Date.now();
        if (api.ui.currentRoute() === 'view-jobs') draw();
      };
      const ago = t => { const m = Math.round((Date.now() - t) / 60e3); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
      const until = t => { const m = Math.round((t - Date.now()) / 60e3); return m < 1 ? 'in a moment' : m < 60 ? 'in about ' + m + ' min' : m < 1440 ? 'in about ' + Math.round(m / 60) + ' h' : 'in about ' + Math.round(m / 1440) + ' d'; };
      const dur = ms => ms < 1000 ? ms + ' ms' : ms < 60e3 ? (ms / 1000).toFixed(1) + ' s' : Math.round(ms / 60e3) + ' min';
      const every = ms => !ms ? '' : ms < 60e3 ? 'in small steps' : ms < 3600e3 ? `every ${Math.round(ms / 60e3)} min` : ms < 86400e3 ? `every ${+(ms / 3600e3).toFixed(1)} h` : ms === 86400e3 ? 'once a day' : `every ${+(ms / 86400e3).toFixed(1)} days`;
      const PACES = [[15 * 60e3, 'Every 15 minutes'], [3600e3, 'Every hour'], [3 * 3600e3, 'Every 3 hours'], [6 * 3600e3, 'Every 6 hours'], [12 * 3600e3, 'Every 12 hours'], [86400e3, 'Once a day'], [7 * 86400e3, 'Once a week']];
      const tags = j => [j.where === 'music' ? 'Music side' : 'App', j.heavy && 'takes turns', j.quiet && 'waits while you use THING', j.hours && `only ${j.hours[0]}:00–${j.hours[1]}:00`, j.every && every(j.every) + (j.changed ? ' (changed)' : '')].filter(Boolean);

      async function act(j, body) {
        G.busy[j.where + j.name] = true; draw();
        try {
          const r = await fetch(url(j), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
          const i = G.list.findIndex(x => x.name === j.name && x.where === j.where); if (i >= 0) G.list[i] = d;
          api.ui.toast(body.action === 'run' ? `${j.label}: running it now` : body.action === 'pause' ? `Paused ${j.label}` : body.action === 'resume' ? `${j.label} is back on` : `${j.label}: ${every(d.every)}`);
        } catch (e) { api.ui.toast(`Couldn’t change that: ${e.message}`); }
        delete G.busy[j.where + j.name]; draw();
        setTimeout(load, 1200);
      }
      async function all(action) {
        const list = (G.list || []).filter(j => action === 'pause' ? j.state !== 'paused' && j.state !== 'finished' : j.state === 'paused');
        for (const j of list) { try { await fetch(url(j), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }); } catch {} }
        api.ui.toast(action === 'pause' ? `Paused ${list.length} background job${list.length === 1 ? '' : 's'}` : `Resumed ${list.length}`);
        load();
      }

      // Laid out like Immich's Jobs page (user, 2026-11-18: "base it off immich"): a card per job with its icon, name and
      // a line on what it does, two counters (Last run, Next run) and its buttons on the right; grouped by what they serve
      const GROUPS = [
        [/^KEXP/i, 'KEXP', 'radio', '#e8590c'], [/Radar|ListenBrainz|Discogs|Wikidata|Gramophone|Artist pages/i, 'Music', 'radar', '#7048e8'],
        [/^Radio/i, 'Music', 'radio', '#7048e8'], [/Feeds/i, 'Reading', 'rss', '#1c7ed6'], [/Reminders/i, 'Notifications', 'bell', '#2b8a3e'],
        [/Database/i, 'Upkeep', 'database', '#495057']];
      const groupOf = j => { const g = GROUPS.find(([re]) => re.test(j.label)) || [null, 'Other', 'cog', '#495057']; return { name: g[1], icon: g[2], col: g[3] }; };
      const ICON = j => /Discogs/i.test(j.label) ? 'disc-3' : /ListenBrainz/i.test(j.label) ? 'headphones' : /Wikidata/i.test(j.label) ? 'globe' : /Gramophone/i.test(j.label) ? 'book-open'
        : /Artist pages/i.test(j.label) ? 'user' : /search index/i.test(j.label) ? 'search' : /keep|saving/i.test(j.label) ? 'archive' : /lists|Top/i.test(j.label) ? 'trophy' : groupOf(j).icon;
      const title = j => { const i = j.label.indexOf(': '); return i > 0 && i < 24 ? [j.label.slice(0, i), j.label.slice(i + 2)] : [j.label, '']; };
      const stat = (head, val, sub, cls = '') => `<div class="jb-stat ${cls}"><div class="jb-sh">${head}</div><div class="jb-sv">${val}</div>${sub ? `<div class="jb-ss">${sub}</div>` : ''}</div>`;
      const lastStat = j => !j.last ? stat('Last run', '–', 'not yet') : stat('Last run', E(ago(j.last.at)), j.last.ok ? E(dur(j.last.ms)) : 'didn’t finish', j.last.ok ? '' : 'jb-soft');
      const nextStat = j => j.state === 'running' ? stat('Now', 'Running', '', 'jb-live') : j.state === 'paused' ? stat('Next run', 'Paused', '') : j.state === 'finished' ? stat('Next run', 'Done', 'nothing left')
        : j.state === 'waiting' ? stat('Next run', 'Waiting', E(j.waiting ? j.waiting.replace(/^waits /, '') : 'its turn')) : j.next ? stat('Next run', E(until(j.next).replace('in about ', '')), j.every ? E(every(j.every)) : '') : stat('Next run', '–', '');

      let root = null;
      function draw() {
        if (!root || !root.isConnected) return;
        if (!G.list) { root.innerHTML = api.ui.skeleton(6, 'Loading the jobs'); return; }
        const list = G.list.slice();
        const paused = list.filter(j => j.state === 'paused').length, live = list.filter(j => j.state !== 'paused' && j.state !== 'finished').length;
        const n = s => list.filter(j => j.state === s).length;
        const groups = []; for (const j of list) { const g = groupOf(j); let e = groups.find(x => x.name === g.name); if (!e) groups.push(e = { ...g, jobs: [] }); e.jobs.push(j); }
        const ORDG = ['KEXP', 'Music', 'Reading', 'Notifications', 'Upkeep', 'Other']; groups.sort((a, b) => ORDG.indexOf(a.name) - ORDG.indexOf(b.name));
        root.innerHTML = `<div class="jb">
          <div class="jb-top">
            <div class="jb-sum">${[['running', 'Running'], ['waiting', 'Waiting'], ['scheduled', 'Scheduled'], ['paused', 'Paused']].map(([s, l]) => `<div class="jb-pill${n(s) ? '' : ' zero'}"><b>${n(s)}</b>${l}</div>`).join('')}</div>
            <div class="jb-all">${live ? `<button class="btn ghost" data-jall="pause">${ic('pause')} Pause all</button>` : ''}${paused ? `<button class="btn ghost" data-jall="resume">${ic('play')} Resume all</button>` : ''}<button class="btn ghost" id="jb-re">${ic('refresh-cw')} Refresh</button></div>
          </div>
          <p class="muted jb-intro">Heavy jobs take turns, one at a time, and most wait while you're using Cadence. Run now skips the wait.</p>
          ${groups.map(g => `<h3 class="jb-gh">${E(g.name)}</h3>${g.jobs.sort((a, b) => a.label.localeCompare(b.label)).map(j => card(j, g)).join('')}`).join('')}
          ${checksHtml()}
        </div>`;
        root.querySelectorAll('[data-jo]').forEach(b => b.onclick = () => { const k = b.dataset.jo; G.open[k] = !G.open[k]; draw(); });
        const job = el => { const k = el.closest('[data-k]').dataset.k; return G.list.find(j => j.where + j.name === k); };
        root.querySelectorAll('[data-ja]').forEach(b => b.onclick = () => act(job(b), { action: b.dataset.ja }));
        root.querySelectorAll('[data-jp]').forEach(s => s.onchange = () => act(job(s), { action: 'every', every: +s.value }));
        root.querySelectorAll('[data-jall]').forEach(b => b.onclick = () => all(b.dataset.jall));
        const re = root.querySelector('#jb-re'); if (re) re.onclick = () => load();
        const ck = root.querySelector('#jb-check'); if (ck) ck.onclick = runChecks;
      }
      // ---- Check outside services (2026-11-19): every service THING reaches, asked once, and whether THING can read it ----
      const CK = { d: null, busy: false };
      fetch('api/checks').then(r => r.ok ? r.json() : null).then(d => { if (d && d.results) { CK.d = d; draw(); } }, () => {});
      async function runChecks() {
        if (CK.busy) return; CK.busy = true; draw();
        try { const r = await fetch('api/checks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); CK.d = r.ok ? await r.json() : CK.d; }
        catch { api.ui.toast("Couldn't reach the NAS"); }
        CK.busy = false; draw();
      }
      const CKS = { ok: ['circle-check', 'Works'], nokey: ['key-round', 'No key'], unreadable: ['circle-help', "Can't read it"], down: ['cloud-off', "Didn't answer"] };
      function checksHtml() {
        const d = CK.d, rs = d && d.results ? d.results.slice().sort((a, b) => ['unreadable', 'down', 'nokey', 'ok'].indexOf(a.state) - ['unreadable', 'down', 'nokey', 'ok'].indexOf(b.state)) : [];
        const okN = rs.filter(r => r.state === 'ok').length;
        return `<h3 class="jb-gh">Outside services</h3>
          <div class="jb-ck">
            <div class="jb-ck-top"><p class="muted">Asks each outside service THING uses, once, and checks THING can read the answer.${d && d.at ? ` Last checked ${E(new Date(d.at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }))}: ${okN} of ${rs.length} work.` : ''}</p>
              <button class="btn" id="jb-check" ${CK.busy ? 'disabled' : ''}>${ic(CK.busy ? 'loader' : 'globe')}${CK.busy ? 'Checking…' : 'Check outside services'}</button></div>
            ${CK.busy && !rs.length ? '<div class="skel skel-card"></div>' : ''}
            ${rs.length ? `<ul class="jb-ck-l">${rs.map(r => `<li class="ck-${r.state}">${ic(CKS[r.state][0])}<div><b>${E(r.name)}</b> <span class="muted">${E(r.what)}</span><div class="ck-n">${E(CKS[r.state][1])}${r.note ? ' · ' + E(r.note) : ''}${r.ms != null ? ` <span class="muted">· ${r.ms < 1000 ? r.ms + ' ms' : (r.ms / 1000).toFixed(1) + ' s'}</span>` : ''}</div></div></li>`).join('')}</ul>` : ''}
          </div>`;
      }
      function card(j, g) {
        const k = j.where + j.name, open = !!G.open[k], busy = !!G.busy[k], canPace = j.base && j.base >= 60e3;
        // under the KEXP heading, "KEXP: saving the shows you keep" reads as "Saving the shows you keep"
        let [t1, t2] = title(j); if (t2 && t1.toLowerCase() === g.name.toLowerCase()) { t1 = t2.charAt(0).toUpperCase() + t2.slice(1); t2 = ''; }
        return `<section class="jb-j jb-${j.state}" data-k="${E(k)}" style="--jc:${g.col}">
          <div class="jb-card">
            <div class="jb-ic">${ic(ICON(j))}</div>
            <div class="jb-tx"><b>${E(t1)}</b>${t2 ? `<span>${E(t2)}</span>` : ''}
              <div class="jb-tags">${tags(j).map(t => `<span class="chip">${E(t)}</span>`).join('')}</div>
              ${j.last && j.last.ok && j.last.note ? `<div class="muted jb-note">${E(j.last.note)}</div>` : ''}
              ${j.last && !j.last.ok ? `<div class="jb-err">Last time it didn’t finish: ${E(j.last.error || 'no details')}</div>` : ''}</div>
            <div class="jb-stats">${lastStat(j)}${nextStat(j)}</div>
            <div class="jb-btns">
              <button class="btn sm jb-run" data-ja="run" ${busy || j.state === 'running' ? 'disabled' : ''}>${ic('play')} Run now</button>
              ${j.state === 'paused' ? `<button class="btn sm" data-ja="resume" ${busy ? 'disabled' : ''}>${ic('play')} Resume</button>` : j.state !== 'finished' ? `<button class="btn sm ghost" data-ja="pause" ${busy ? 'disabled' : ''}>${ic('pause')} Pause</button>` : ''}
              <button class="btn sm ghost jb-row" data-jo="${E(k)}" aria-expanded="${open}">${ic('settings')} ${open ? 'Less' : 'More'}</button>
            </div>
          </div>
          ${open ? `<div class="jb-more">
            <div class="jb-ctl">${canPace ? `<label class="jb-pace">How often <select class="inp sm" data-jp>${[[j.base, `As it came (${every(j.base)})`], ...PACES.filter(([v]) => v !== j.base)].map(([v, l]) => `<option value="${v}" ${v === j.every ? 'selected' : ''}>${E(l)}</option>`).join('')}${PACES.some(([v]) => v === j.every) || j.every === j.base ? '' : `<option value="${j.every}" selected>${E(every(j.every))}</option>`}</select></label>` : '<span class="muted">Runs in small steps until its work is done, so it has no fixed pace.</span>'}
              <span class="muted">${j.runs} run${j.runs === 1 ? '' : 's'} since the NAS last started${j.fails ? `, ${j.fails} didn’t finish` : ''}</span></div>
            ${j.history && j.history.length ? `<div class="jb-h"><span class="muted">Recent runs</span><ol>${j.history.map(h => `<li><span>${E(new Date(h.at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }))}</span><span>${h.n > 1 ? `${h.n} steps, ` : ''}${E(dur(h.ms))}</span><span class="muted">${h.ok ? E(h.note || 'Finished') : 'Didn’t finish: ' + E(h.error || '')}</span></li>`).join('')}</ol></div>` : '<span class="muted">No runs yet since the NAS last started.</span>'}
          </div>` : ''}
        </section>`;
      }
      api.views.add({ id: 'jobs', title: 'Background work', icon: '⏱️', subtitle: 'What the NAS does on its own, and when', render: el => {
        if (api.system().mode !== 'nas') { el.innerHTML = '<p class="muted">Background work runs on the NAS.</p>'; return; }
        root = el; draw();
        if (!G.list || Date.now() - G.at > 4000) load();
        // keep it current while the page is open (every 5 s; stops when you leave)
        clearInterval(G.timer);
        G.timer = setInterval(() => { if (api.ui.currentRoute() !== 'view-jobs' || document.hidden) { if (api.ui.currentRoute() !== 'view-jobs') clearInterval(G.timer); return; } load(); }, 5000);
      } });
      api.commands.add({ title: 'Background work: see and control the NAS’s jobs', icon: 'timer', run: () => api.ui.navigate('view-jobs') });

      window.CadenceKit.css('jb-css', `
        .jb{max-width:980px}
        .jb-top{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}
        .jb-sum{display:flex;gap:8px;flex-wrap:wrap}
        .jb-pill{display:flex;gap:6px;align-items:baseline;padding:6px 12px;border-radius:999px;background:var(--hover);font-size:13px;color:var(--muted)}
        .jb-pill b{font-size:16px;color:var(--text)}.jb-pill.zero{opacity:.75}
        .jb-all{display:flex;gap:6px;flex-wrap:wrap}.jb-all svg{width:15px;height:15px}
        .jb-intro{margin:10px 0 4px;font-size:13px}
        .jb-ck{border:1px solid var(--line);border-radius:var(--r);background:var(--panel);padding:12px 14px;margin-bottom:24px}.jb-ck-top{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}.jb-ck-top p{margin:0;flex:1;min-width:220px;font-size:13px}
        .jb-ck-l{list-style:none;margin:12px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px 16px}.jb-ck-l li{display:flex;gap:8px;align-items:flex-start;font-size:13px}.jb-ck-l li svg{flex:none;margin-top:2px;width:15px;height:15px}
        .jb-ck-l .ck-n{font-size:12px}.ck-ok svg{color:var(--good,#3a9d6a)}.ck-nokey svg{color:var(--muted)}.ck-unreadable svg,.ck-down svg{color:var(--warn,#c08a2b)}
        .jb-gh{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:22px 0 8px}
        .jb-j{border:1px solid var(--line);border-radius:calc(var(--r,8px) + 4px);background:var(--panel);margin-bottom:10px;overflow:hidden}
        .jb-card{display:grid;grid-template-columns:44px minmax(0,1fr) auto auto;gap:16px;align-items:center;padding:14px 16px}
        .jb-ic{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;color:var(--jc);background:color-mix(in srgb,var(--jc) 13%,transparent)}
        .jb-ic svg{width:22px;height:22px}
        .jb-running .jb-ic svg{animation:jbpulse 1.6s ease-in-out infinite}
        @keyframes jbpulse{50%{opacity:.45}}
        @media (prefers-reduced-motion:reduce){.jb-running .jb-ic svg{animation:none}}
        .jb-tx{display:flex;flex-direction:column;gap:3px;min-width:0}
        .jb-tx b{font-size:15px;font-weight:650;letter-spacing:.01em}
        .jb-tx>span{font-size:13.5px;color:var(--muted)}
        .jb-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:4px}.jb-tags .chip{font-size:11.5px}
        .jb-note{font-size:12.5px;margin-top:2px}
        .jb-err{font-size:12.5px;margin-top:4px;padding:6px 8px;border-radius:6px;background:var(--hover)}
        .jb-stats{display:flex;gap:8px}
        .jb-stat{width:112px;border:1px solid var(--line);border-radius:10px;overflow:hidden;text-align:center;background:var(--bg)}
        .jb-sh{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;font-weight:600;padding:4px 0;background:var(--hover);color:var(--muted)}
        .jb-sv{font-size:16px;font-weight:650;padding:7px 4px 1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .jb-ss{font-size:11.5px;color:var(--muted);padding:0 4px 7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .jb-stat:not(:has(.jb-ss)) .jb-sv{padding-bottom:9px}
        .jb-live .jb-sh{background:color-mix(in srgb,var(--jc) 18%,transparent);color:var(--jc)}
        .jb-soft .jb-ss{color:var(--text)}
        .jb-paused .jb-ic{filter:grayscale(1);opacity:.6}.jb-paused .jb-tx b{color:var(--muted)}
        .jb-btns{display:flex;flex-direction:column;gap:6px;min-width:112px}
        .jb-btns .btn{justify-content:center;display:flex;gap:6px;align-items:center}.jb-btns svg{width:14px;height:14px}
        .jb-more{border-top:1px solid var(--line);padding:12px 16px 14px 76px;display:flex;flex-direction:column;gap:10px;font-size:13px;background:var(--bg)}
        .jb-ctl{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
        .jb-pace{display:flex;gap:6px;align-items:center;color:var(--muted);white-space:nowrap}
        .jb-h ol{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:3px}
        .jb-h li{display:grid;grid-template-columns:120px 110px 1fr;gap:10px;font-size:12.5px}
        @media (max-width:760px){.jb-card{grid-template-columns:44px minmax(0,1fr)}.jb-stats,.jb-btns{grid-column:1/-1}.jb-stat{flex:1;width:auto}.jb-btns{flex-direction:row;flex-wrap:wrap}
          .jb-more{padding-left:16px}.jb-h li{grid-template-columns:1fr 1fr}.jb-h li span:last-child{grid-column:1/-1}}
      `);
    }
  });
})();
