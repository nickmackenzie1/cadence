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
      const load = async () => {
        const [a, m] = await Promise.all([getJ('api/jobs'), getJ('api/radar/jobs')]);
        G.list = [...a, ...m]; G.at = Date.now();
        if (api.ui.currentRoute() === 'view-jobs') draw();
      };
      const ago = t => { const m = Math.round((Date.now() - t) / 60e3); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
      const until = t => { const m = Math.round((t - Date.now()) / 60e3); return m < 1 ? 'in a moment' : m < 60 ? 'in about ' + m + ' min' : m < 1440 ? 'in about ' + Math.round(m / 60) + ' h' : 'in about ' + Math.round(m / 1440) + ' d'; };
      const dur = ms => ms < 1000 ? ms + ' ms' : ms < 60e3 ? (ms / 1000).toFixed(1) + ' s' : Math.round(ms / 60e3) + ' min';
      const every = ms => !ms ? '' : ms < 60e3 ? 'in small steps' : ms < 3600e3 ? `every ${Math.round(ms / 60e3)} min` : ms < 86400e3 ? `every ${+(ms / 3600e3).toFixed(1)} h` : ms === 86400e3 ? 'once a day' : `every ${+(ms / 86400e3).toFixed(1)} days`;
      const PACES = [[15 * 60e3, 'Every 15 minutes'], [3600e3, 'Every hour'], [3 * 3600e3, 'Every 3 hours'], [6 * 3600e3, 'Every 6 hours'], [12 * 3600e3, 'Every 12 hours'], [86400e3, 'Once a day'], [7 * 86400e3, 'Once a week']];
      const STATE = {
        running: ['Running now', 'loader'], waiting: ['Waiting', 'hourglass'], scheduled: ['Scheduled', 'clock'],
        paused: ['Paused', 'pause'], finished: ['Done', 'check'], stopped: ['Stopped', 'pause']
      };
      const ORDER = ['running', 'waiting', 'scheduled', 'paused', 'finished', 'stopped'];
      const now = j => j.state === 'running' ? 'Running now' : j.state === 'paused' ? 'Paused. It won’t run until you resume it'
        : j.state === 'waiting' ? (j.waiting ? j.waiting.charAt(0).toUpperCase() + j.waiting.slice(1) : 'Waiting its turn') + (j.soon ? ' (you asked for it now)' : '')
        : j.state === 'finished' ? 'Done: nothing left to do for now' : j.state === 'stopped' ? 'Stopped' : j.next ? 'Next run ' + until(j.next) : 'Scheduled';
      const last = j => !j.last ? 'Hasn’t run yet' : `Last ran ${ago(j.last.at)}, took ${dur(j.last.ms)}` + (j.last.ok ? (j.last.note ? ` · ${j.last.note}` : '') : ' · didn’t finish');
      const tags = j => [j.where === 'music' ? 'Music side' : 'App', j.heavy && 'takes turns', j.quiet && 'waits while you use Cadence', j.hours && `only ${j.hours[0]}:00–${j.hours[1]}:00`, j.every && every(j.every) + (j.changed ? ' (changed)' : '')].filter(Boolean);

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

      let root = null;
      function draw() {
        if (!root || !root.isConnected) return;
        if (!G.list) { root.innerHTML = '<p class="muted">Loading…</p>'; return; }
        const list = G.list.slice().sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state) || a.label.localeCompare(b.label));
        const paused = list.filter(j => j.state === 'paused').length, live = list.filter(j => j.state !== 'paused' && j.state !== 'finished').length;
        const counts = ORDER.map(s => [s, list.filter(j => j.state === s).length]).filter(([, n]) => n);
        root.innerHTML = `<div class="jb">
          <div class="jb-top"><p class="muted">${counts.map(([s, n]) => `${n} ${STATE[s][0].toLowerCase()}`).join(' · ')}. Heavy jobs take turns, one at a time, and most wait while you're using Cadence.</p>
            <div class="jb-all">${live ? `<button class="btn ghost" data-jall="pause">${ic('pause')} Pause all</button>` : ''}${paused ? `<button class="btn ghost" data-jall="resume">${ic('play')} Resume all</button>` : ''}<button class="btn ghost" id="jb-re">${ic('refresh-cw')} Check again</button></div></div>
          <ul class="jb-l">${list.map(j => { const k = j.where + j.name, open = !!G.open[k], busy = !!G.busy[k], [, icon] = STATE[j.state] || ['', 'clock'];
            const canPace = j.base && j.base >= 60e3;
            return `<li class="jb-j jb-${j.state}${j.last && !j.last.ok ? ' jb-fail' : ''}" data-k="${E(k)}">
              <button class="jb-row" data-jo="${E(k)}" aria-expanded="${open}"><span class="jb-ic">${ic(icon)}</span>
                <span class="jb-tx"><b>${E(j.label)}</b><span class="muted">${E(now(j))}</span><span class="muted jb-last">${E(last(j))}</span></span>
                <span class="jb-chev">${ic(open ? 'chevron-up' : 'chevron-down')}</span></button>
              ${open ? `<div class="jb-more">
                <div class="jb-tags">${tags(j).map(t => `<span class="chip">${E(t)}</span>`).join('')}<span class="muted">${j.runs} run${j.runs === 1 ? '' : 's'} since the NAS last started${j.fails ? `, ${j.fails} didn’t finish` : ''}</span></div>
                ${j.last && !j.last.ok ? `<p class="jb-err">What went wrong last time: ${E(j.last.error || 'no details')}</p>` : ''}
                <div class="jb-ctl">
                  <button class="btn sm" data-ja="run" ${busy || j.state === 'running' ? 'disabled' : ''}>${ic('play')} Run now</button>
                  ${j.state === 'paused' ? `<button class="btn sm" data-ja="resume" ${busy ? 'disabled' : ''}>${ic('play')} Resume</button>` : j.state !== 'finished' ? `<button class="btn sm ghost" data-ja="pause" ${busy ? 'disabled' : ''}>${ic('pause')} Pause</button>` : ''}
                  ${canPace ? `<label class="jb-pace">How often <select class="inp sm" data-jp>${[[j.base, `As it came (${every(j.base)})`], ...PACES.filter(([v]) => v !== j.base)].map(([v, l]) => `<option value="${v}" ${v === j.every ? 'selected' : ''}>${E(l)}</option>`).join('')}${PACES.some(([v]) => v === j.every) || j.every === j.base ? '' : `<option value="${j.every}" selected>${E(every(j.every))}</option>`}</select></label>` : '<span class="muted jb-note">Runs in small steps until its work is done, so it has no fixed pace.</span>'}
                </div>
                ${j.history && j.history.length ? `<div class="jb-h"><span class="muted">Recent runs</span><ol>${j.history.map(h => `<li><span>${E(new Date(h.at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }))}</span><span>${h.n > 1 ? `${h.n} steps, ` : ''}${E(dur(h.ms))}</span><span class="muted">${h.ok ? E(h.note || 'Finished') : 'Didn’t finish: ' + E(h.error || '')}</span></li>`).join('')}</ol></div>` : ''}
              </div>` : ''}</li>`; }).join('')}</ul></div>`;
        root.querySelectorAll('[data-jo]').forEach(b => b.onclick = () => { const k = b.dataset.jo; G.open[k] = !G.open[k]; draw(); });
        const job = el => { const k = el.closest('[data-k]').dataset.k; return G.list.find(j => j.where + j.name === k); };
        root.querySelectorAll('[data-ja]').forEach(b => b.onclick = () => act(job(b), { action: b.dataset.ja }));
        root.querySelectorAll('[data-jp]').forEach(s => s.onchange = () => act(job(s), { action: 'every', every: +s.value }));
        root.querySelectorAll('[data-jall]').forEach(b => b.onclick = () => all(b.dataset.jall));
        const re = root.querySelector('#jb-re'); if (re) re.onclick = () => load();
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
        .jb{max-width:860px}
        .jb-top{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px}
        .jb-top p{margin:4px 0;max-width:520px}
        .jb-all{display:flex;gap:6px;flex-wrap:wrap}
        .jb-l{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
        .jb-j{border-bottom:1px solid var(--line)}
        .jb-row{display:flex;gap:12px;align-items:flex-start;width:100%;text-align:left;background:none;border:0;padding:12px 6px;color:inherit;font:inherit;cursor:pointer;border-radius:var(--r,8px)}
        .jb-row:hover{background:var(--hover)}
        .jb-ic{flex:none;margin-top:2px;color:var(--muted)}.jb-ic svg{width:17px;height:17px}
        .jb-running .jb-ic{color:var(--accent)}.jb-running .jb-ic svg{animation:jbspin 1.6s linear infinite}
        @keyframes jbspin{to{transform:rotate(360deg)}}
        @media (prefers-reduced-motion:reduce){.jb-running .jb-ic svg{animation:none}}
        .jb-paused .jb-tx b{color:var(--muted)}
        .jb-tx{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;font-size:13.5px}
        .jb-tx b{font-weight:600;font-size:14px}
        .jb-last{font-size:12.5px}
        .jb-fail .jb-last{color:var(--text)}
        .jb-chev{color:var(--faint)}.jb-chev svg{width:16px;height:16px}
        .jb-more{padding:0 6px 14px 35px;display:flex;flex-direction:column;gap:10px;font-size:13px}
        .jb-tags{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
        .jb-err{margin:0;padding:8px 10px;background:var(--hover);border-radius:var(--r,8px)}
        .jb-ctl{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
        .jb-ctl svg{width:14px;height:14px}
        .jb-pace{display:flex;gap:6px;align-items:center;color:var(--muted);white-space:nowrap}
        .jb-note{font-size:12.5px}
        .jb-h ol{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:3px}
        .jb-h li{display:grid;grid-template-columns:120px 110px 1fr;gap:10px;font-size:12.5px}
        @media (max-width:640px){.jb-more{padding-left:6px}.jb-h li{grid-template-columns:1fr 1fr}.jb-h li span:last-child{grid-column:1/-1}}
      `);
    }
  });
})();
