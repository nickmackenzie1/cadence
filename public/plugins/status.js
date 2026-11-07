/* System status — boot sequence, live connection/sync/AI panel and an activity log.
   Everything you'd want to know about what Cadence is doing, without getting in the way. */
(() => {
  const G = window.__status = window.__status || { log: [], lat: [], booted: false };
  if (!G.style) {
    G.style = document.createElement('style');
    G.style.textContent = `
      .st-boot{position:fixed;right:18px;bottom:18px;z-index:90;cursor:pointer;transition:opacity .4s, transform .4s}
      .st-boot.out{opacity:0;transform:translateY(8px);pointer-events:none}
      .st-term{width:300px;border-radius:14px;background:rgba(18,17,25,.92);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);color:#d9d6e8;box-shadow:0 18px 50px rgba(0,0,0,.28),inset 0 0 0 1px rgba(255,255,255,.07);padding:12px 14px 11px;font:11.5px/1.7 "JetBrains Mono",ui-monospace,monospace;animation:stin .45s cubic-bezier(.2,1.3,.4,1);overflow:hidden;transition:width .45s cubic-bezier(.2,.9,.2,1), padding .45s, border-radius .45s}
      @keyframes stin{from{opacity:0;transform:translateX(24px) scale(.96)}}
      .st-term .st-lines{max-height:160px;transition:max-height .45s, opacity .3s}
      .st-boot.mini .st-term{width:118px;padding:8px 12px;border-radius:999px}
      .st-boot.mini .st-lines,.st-boot.mini .st-prog,.st-boot.mini .hd span{max-height:0;opacity:0;margin:0}
      .st-boot.mini .hd{margin:0}
      .st-boot.mini .hd b{color:#4cc38a}
      .st-term .hd{display:flex;align-items:center;gap:9px;margin-bottom:7px;font:700 12px/1 ui-sans-serif,system-ui;color:#fff;letter-spacing:.02em;white-space:nowrap;transition:margin .4s}
      .st-term .hd i{flex:none;width:18px;height:18px;border-radius:7px;background:conic-gradient(from 210deg,#5b5bd6,#b06bd6,#ff7a8a,#5b5bd6);position:relative}
      .st-term .hd i:after{content:"";position:absolute;inset:5px;border-radius:50%;background:#121119}
      .st-term .hd span{margin-left:auto;font:500 11px/1 "JetBrains Mono",monospace;color:#7d7a90}
      .st-line{display:flex;gap:10px;opacity:0;transform:translateX(-6px);transition:opacity .2s,transform .2s}
      .st-line.in{opacity:1;transform:none}
      .st-line .k{color:#7d7a90;width:14px}
      .st-line .v{margin-left:auto;color:#7d7a90;white-space:nowrap}
      .st-line .v.ok{color:#4cc38a}.st-line .v.warn{color:#e5a24a}.st-line .v.off{color:#7d7a90}
      .st-spin{display:inline-block;width:10px;height:10px;border:1.5px solid #7d7a90;border-top-color:#b28cff;border-radius:50%;animation:stsp .7s linear infinite;vertical-align:-1px}
      @keyframes stsp{to{transform:rotate(360deg)}}
      .st-prog{height:2px;border-radius:9px;background:rgba(255,255,255,.07);margin-top:8px;overflow:hidden;transition:opacity .3s}
      .st-prog i{display:block;height:100%;width:0;background:linear-gradient(90deg,#5b5bd6,#b06bd6,#ff7a8a);transition:width .3s}
      .st-card{border-radius:12px;border:1px solid var(--line);background:var(--panel);padding:8px 10px;font-size:12px;cursor:pointer;transition:box-shadow .2s}
      .st-card:hover{box-shadow:0 4px 14px rgba(0,0,0,.06)}
      .st-row{display:flex;align-items:center;gap:8px;height:22px}
      .st-row .lbl{color:var(--muted);width:34px;font-weight:600;font-size:11px;letter-spacing:.04em}
      .st-row .val{font-variant-numeric:tabular-nums;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .st-dot{width:7px;height:7px;border-radius:50%;background:var(--faint);flex:none;position:relative}
      .st-dot.ok{background:var(--ok)}.st-dot.warn{background:var(--client)}.st-dot.err{background:var(--danger)}
      .st-dot.ping:after{content:"";position:absolute;inset:-4px;border-radius:50%;border:1.5px solid currentColor;color:var(--ok);animation:stping .8s ease-out}
      @keyframes stping{from{transform:scale(.4);opacity:1}to{transform:scale(1.6);opacity:0}}
      .st-spark{width:56px;height:16px;flex:none}
      .st-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      .st-tile{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:10px 12px}
      .st-tile .v{font:700 17px/1.2 ui-sans-serif,system-ui;font-variant-numeric:tabular-nums}
      .st-tile .l{font-size:11px;color:var(--muted);margin-top:2px}
      .st-log{font:11.5px/1.7 "JetBrains Mono",ui-monospace,monospace;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:8px 10px;max-height:220px;overflow:auto}
      .st-log div{display:flex;gap:10px}.st-log span{color:var(--muted)}
    `;
    document.head.appendChild(G.style);
  }
  const fmtAgo = t => { if (!t) return '—'; const s = Math.round((Date.now() - t) / 1000); return s < 5 ? 'just now' : s < 60 ? s + 's ago' : s < 3600 ? Math.round(s / 60) + 'm ago' : Math.round(s / 3600) + 'h ago'; };
  const fmtBytes = b => b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : b > 1e3 ? Math.round(b / 1e3) + ' KB' : (b || 0) + ' B';
  const fmtUp = s => s > 86400 ? Math.floor(s / 86400) + 'd ' + Math.floor(s % 86400 / 3600) + 'h' : s > 3600 ? Math.floor(s / 3600) + 'h ' + Math.floor(s % 3600 / 60) + 'm' : Math.floor(s / 60) + 'm';
  const log = (msg, kind = '') => { G.log.push({ t: Date.now(), msg, kind }); if (G.log.length > 200) G.log.shift(); };

  Cadence.registerPlugin({
    id: 'status', name: 'System status', version: '1.0.0',
    description: 'Boot sequence, a live panel for NAS connection, sync, AI and caches, and an activity log of what Cadence is doing.',
    setup(api) {
      const settings = () => Object.assign({ boot: true }, api.storage.get('settings') || {});
      let phase = G.phase || 'idle'; let widget = null;

      /* ------------ events */
      api.on('sync', e => {
        if (e.phase === 'push') { phase = 'saving'; }
        if (e.phase === 'saved' || e.phase === 'pulled') { phase = 'idle'; if (e.ms != null) { G.lat.push(e.ms); if (G.lat.length > 24) G.lat.shift(); } if (e.phase === 'saved') log(`saved · ${e.ms} ms`, 'ok'); else if (e.first) log(`loaded workspace · ${e.ms} ms`, 'ok'); }
        if (e.phase === 'connected') { G.connectedAt = Date.now(); log('connected to NAS', 'ok'); G.onConnect && G.onConnect(e.health); }
        if (e.phase === 'error') { phase = 'error'; log('sync error: ' + e.error, 'err'); }
        G.phase = phase; paint(e.phase === 'saved' || e.phase === 'pulled');
      });
      api.on('*', (p, ev) => {
        if (ev === 'sync' || ev === 'render' || ev === 'render:side') return;
        const name = p && (p.title || p.name || (p.meeting && 'meeting')) || '';
        log(`${ev}${name ? ' · ' + String(name).slice(0, 40) : ''}`);
      });

      /* ------------ periodic health ping (NAS only) */
      async function ping() {
        if (api.system().mode !== 'nas') return null;
        const t0 = performance.now();
        try { const r = await fetch('api/health', { cache: 'no-store' }); const j = await r.json(); const ms = Math.round(performance.now() - t0); G.health = j; G.pingMs = ms; G.lat.push(ms); if (G.lat.length > 24) G.lat.shift(); paint(true); return j; }
        catch (e) { G.pingMs = null; phase = 'error'; log('NAS unreachable', 'err'); paint(); return null; }
      }
      clearInterval(G.pingT); G.pingT = setInterval(ping, 20000);

      /* ------------ sidebar widget */
      api.sidebar.add({ id: 'status', order: 20, render: el => { widget = el; el.innerHTML = `<div class="st-card" title="System status — click for details"></div>`; el.firstChild.addEventListener('click', openPanel); paint(); } });
      function spark() {
        const v = G.lat.slice(-16); if (v.length < 2) return '';
        const mx = Math.max(...v, 40), pts = v.map((x, i) => `${(i / (v.length - 1) * 56).toFixed(1)},${(15 - x / mx * 13).toFixed(1)}`).join(' ');
        return `<svg class="st-spark" viewBox="0 0 56 16"><polyline points="${pts}" fill="none" stroke="var(--ok)" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
      }
      function paint(pinged) {
        if (!widget || !widget.isConnected) return;
        const sys = api.system(), nas = sys.mode === 'nas', ms = G.pingMs ?? sys.latency;
        const conn = nas ? (phase === 'error' ? ['err', 'unreachable'] : ['ok', `NAS · ${ms != null ? ms + ' ms' : 'online'}`]) : sys.mode === 'claude' ? ['ok', 'Claude storage'] : ['warn', 'browser only'];
        const sync = phase === 'saving' ? ['warn', '<span class="st-spin"></span> saving…'] : phase === 'error' ? ['err', 'retrying…'] : ['ok', 'saved ' + fmtAgo(sys.lastSyncAt)];
        const ai = sys.ai ? ['ok', (G.health && G.health.model) || 'ready'] : ['', 'off'];
        widget.firstChild.innerHTML = `
          <div class="st-row"><span class="st-dot ${conn[0]} ${pinged ? 'ping' : ''}"></span><span class="lbl">LINK</span><span class="val">${conn[1]}</span>${spark()}</div>
          <div class="st-row"><span class="st-dot ${sync[0]}"></span><span class="lbl">SYNC</span><span class="val">${sync[1]}</span></div>
          <div class="st-row"><span class="st-dot ${ai[0]}"></span><span class="lbl">AI</span><span class="val">${api.ui.esc(ai[1])}</span></div>`;
      }
      clearInterval(G.paintT); G.paintT = setInterval(() => paint(), 5000);

      /* ------------ details panel */
      async function openPanel() {
        const h = await ping() || G.health, sys = api.system(), lat = G.lat.length ? G.lat : [0];
        const avg = Math.round(lat.reduce((a, b) => a + b, 0) / lat.length), E = api.ui.esc;
        api.ui.modal('System', `
          <div class="st-grid">
            <div class="st-tile"><div class="v">${sys.mode === 'nas' ? 'NAS' : sys.mode === 'claude' ? 'Claude' : 'Browser'}</div><div class="l">Storage mode</div></div>
            <div class="st-tile"><div class="v">${G.pingMs ?? sys.latency ?? '—'} ms</div><div class="l">Latency · avg ${avg} ms</div></div>
            <div class="st-tile"><div class="v">${fmtAgo(sys.lastSyncAt)}</div><div class="l">Last sync</div></div>
            <div class="st-tile"><div class="v">${sys.counts.open} / ${sys.counts.tasks}</div><div class="l">Open / all tasks</div></div>
            <div class="st-tile"><div class="v">${sys.counts.clients}</div><div class="l">Clients · ${sys.counts.meetings} meetings</div></div>
            <div class="st-tile"><div class="v">${sys.plugins}</div><div class="l">Plugins active</div></div>
            ${h ? `<div class="st-tile"><div class="v">${fmtUp(h.uptime || 0)}</div><div class="l">Server uptime · ${E(h.node || '')}</div></div>
            <div class="st-tile"><div class="v">${fmtBytes(h.dataBytes)}</div><div class="l">Data · ${h.backups} daily backups</div></div>
            <div class="st-tile"><div class="v">${h.logos}</div><div class="l">Logos cached · ${h.companies} sites read</div></div>
            <div class="st-tile"><div class="v">${h.ai ? 'Online' : 'Off'}</div><div class="l">AI ${h.model ? '· ' + E(h.model) : ''}</div></div>
            <div class="st-tile"><div class="v">${h.auth ? 'On' : 'Off'}</div><div class="l">Login protection</div></div>
            <div class="st-tile"><div class="v">v${E(h.version || '?')}</div><div class="l">Server · app v${E(sys.version)}</div></div>` : ''}
          </div>
          <div class="field"><label>Activity</label><div class="st-log">${G.log.slice().reverse().slice(0, 80).map(l => `<div><span>${new Date(l.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span><b style="font-weight:500;color:${l.kind === 'err' ? 'var(--danger)' : l.kind === 'ok' ? 'var(--ok)' : 'inherit'}">${E(l.msg)}</b></div>`).join('') || '<span>Nothing yet</span>'}</div></div>
          <label class="row muted" style="align-items:center;gap:8px;font-size:13px"><input type="checkbox" id="st-bootset" ${settings().boot ? 'checked' : ''}> Show the boot sequence when Cadence opens</label>`,
          `<button class="btn" id="st-ping" style="margin-right:auto">↻ Re-check</button><button class="btn primary" data-act="close-modal">Close</button>`, 'wide');
        document.querySelector('#st-bootset').onchange = e => api.storage.set('settings', { ...settings(), boot: e.target.checked });
        document.querySelector('#st-ping').onclick = () => openPanel();
      }
      api.commands.add({ title: 'System status', run: () => openPanel() });

      /* ------------ boot sequence (once per page load) */
      if (!G.booted) {
        G.booted = true; log('boot');
        if (settings().boot) boot();
      }
      function boot() {
        const ov = document.createElement('div'); ov.className = 'st-boot';
        ov.innerHTML = `<div class="st-term"><div class="hd"><i></i><b>Starting…</b><span style="margin-left:auto;font:500 10.5px/1 'JetBrains Mono',monospace;color:#7d7a90">v${api.system().version}</span></div><div class="st-lines"></div><div class="st-prog"><i></i></div></div>`;
        document.body.appendChild(ov);
        let skip = false; ov.addEventListener('click', () => { skip = true; finish(); openPanel(); });
        const lines = ov.querySelector('.st-lines'), prog = ov.querySelector('.st-prog i');
        const steps = [];
        const line = (label) => { const el = document.createElement('div'); el.className = 'st-line'; el.innerHTML = `<span class="k">▸</span><span>${label}</span><span class="v"><span class="st-spin"></span></span>`; lines.appendChild(el); requestAnimationFrame(() => el.classList.add('in')); return (txt, cls = 'ok') => { el.querySelector('.v').className = 'v ' + cls; el.querySelector('.v').textContent = txt; }; };
        const wait = ms => new Promise(r => setTimeout(r, skip ? 0 : ms));
        const connected = new Promise(r => { G.onConnect = r; setTimeout(() => r(null), 1500); });
        (async () => {
          let done = line('Booting core'); await wait(160); done('ok'); prog.style.width = '15%';
          done = line('Connecting to NAS'); const h = await connected; await wait(120);
          const sys = api.system();
          if (h || sys.mode === 'nas') done(`ok · ${sys.latency ?? '—'} ms`); else if (sys.mode === 'claude') done('Claude storage', 'ok'); else done('local mode', 'warn');
          prog.style.width = '40%';
          done = line('Loading workspace'); await wait(220); const s2 = api.system(); done(`${s2.counts.open} open · ${s2.counts.clients} clients`); prog.style.width = '60%';
          done = line('AI engine'); await wait(160); done(s2.ai ? ((h && h.model) || 'online') : 'off', s2.ai ? 'ok' : 'off'); prog.style.width = '75%';
          done = line('Plugins'); await wait(140); done(`${s2.plugins} active`); prog.style.width = '88%';
          if (h) { done = line('Caches'); await wait(120); done(`${h.logos} logos · ${h.backups} backups`); }
          prog.style.width = '100%';
          ov.querySelector('.hd b').textContent = 'Ready';
          await wait(900); ov.classList.add('mini');          // collapse into a little pill
          await wait(1400); finish();
        })();
        function finish() { if (ov.classList.contains('out')) return; ov.classList.add('out'); setTimeout(() => ov.remove(), 500); paint(true); }
      }
    }
  });
})();
