/* KEXP through the years (user, 2026-11-17: "those charts of most listened artists through the years, that go through
   it and show the changes"). A bar chart race of who KEXP played most, month by month, from the history on your NAS:
   the last 12 months (who's big at that point) or everything so far. Play, pause, drag through the years, and
   "Save as video" records it once through (WebM, made in this browser; nothing is sent anywhere).
   The months are counted ahead of time on the NAS (kexp_monthly, then the race itself, kept in kexp.db). */
(() => {
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const getJson = async u => { const r = await fetch(u); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j; };
  const N = 12, ROW = 34, TOP = 18, MONTH_MS = 650;
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const label = m => { const [y, mo] = m.split('-'); return new Date(+y, +mo - 1, 15).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); };
  // a steady colour per artist: the hue from the name, soft saturation, so the chart stays calm
  const hue = name => { let h = 2166136261; for (const c of String(name)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return Math.round((h % 1000) * 137.508) % 360; };

  Cadence.registerPlugin({
    id: 'kexp-race', name: 'KEXP through the years', version: '1.0.0', category: 'Media', color: '#0f766e',
    icon: '<path d="M3 3v18h18"/><rect x="7" y="13" width="3" height="5"/><rect x="12" y="9" width="3" height="9"/><rect x="17" y="5" width="3" height="13"/>',
    tagline: 'Who KEXP played most, month by month since 2001, as a moving chart.',
    description: 'A bar chart race from the KEXP history kept on your NAS: the last 12 months or everything so far, with play, pause, a year slider and Save as video.',
    setup(api) {
      const S = { d: null, err: null, mode: api.storage.get('mode') || 'roll', pos: 0, playing: false, raf: 0, last: 0, rec: null, loading: false };
      const load = () => {
        if (S.loading) return; S.loading = true;
        // this device's last copy draws at once (2026-11-19); the NAS's replaces it
        const take = d => { S.d = d; S.err = null; if (d.ready && S.pos === 0) S.pos = Math.max(0, d.months.length - 1); };
        api.cached('api/radio/kexp?view=race', take, { max: 800000 }).catch(e => { if (!S.d) S.err = e.message; })
          .finally(() => { S.loading = false; if (api.ui.currentRoute() === 'view-kexp-years') api.ui.refresh(); });
      };
      const frames = () => (S.d && S.d.ready ? (S.mode === 'all' ? S.d.all : S.d.roll) : []);
      // one moment between two months: each artist's value and rank slide from one month to the next
      function at(pos) {
        const F = frames(), i = Math.max(0, Math.min(F.length - 1, Math.floor(pos))), f = reduce() ? 0 : Math.min(1, pos - i), a = F[i] || [], b = F[Math.min(F.length - 1, i + 1)] || a;
        const va = new Map(a.map(([n, v], r) => [n, { v, r }])), vb = new Map(b.map(([n, v], r) => [n, { v, r }]));
        const floorA = a.length ? a[a.length - 1][1] * 0.85 : 0, floorB = b.length ? b[b.length - 1][1] * 0.85 : 0;
        const out = [];
        for (const n of new Set([...va.keys(), ...vb.keys()])) {
          const x = va.get(n) || { v: floorA, r: N + 0.5 }, y = vb.get(n) || { v: floorB, r: N + 0.5 };
          out.push({ n, v: x.v + (y.v - x.v) * f, r: x.r + (y.r - x.r) * f });
        }
        return { i, rows: out.sort((p, q) => p.r - q.r) };
      }
      function draw() {
        const cv = document.getElementById('kr-cv'); if (!cv || !S.d || !S.d.ready) return;
        const d = devicePixelRatio || 1, w = cv.clientWidth, h = TOP + N * ROW + 40;
        if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); cv.style.height = h + 'px'; }
        const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0);
        const css = getComputedStyle(document.documentElement), text = css.getPropertyValue('--text').trim() || '#222', muted = css.getPropertyValue('--muted').trim() || '#777',
          bg = css.getPropertyValue('--card').trim() || css.getPropertyValue('--bg').trim() || '#fff', dark = matchMedia('(prefers-color-scheme: dark)').matches || document.documentElement.classList.contains('dark');
        g.fillStyle = bg; g.fillRect(0, 0, w, h);
        const { i, rows } = at(S.pos), max = Math.max(1, ...rows.filter(r => r.r < N).map(r => r.v)), left = 8, right = w - 70, bw = right - left;
        g.font = '600 13px system-ui, sans-serif'; g.textBaseline = 'middle';
        for (const r of rows) {
          if (r.r > N) continue;
          const y = TOP + r.r * ROW, len = Math.max(2, (r.v / max) * bw), alpha = Math.max(0, Math.min(1, N + 0.3 - r.r));
          g.globalAlpha = alpha;
          g.fillStyle = `hsl(${hue(r.n)} 42% ${dark ? 42 : 62}%)`; g.beginPath(); g.roundRect ? g.roundRect(left, y + 3, len, ROW - 8, 5) : g.rect(left, y + 3, len, ROW - 8); g.fill();
          // the name inside the bar when it fits, otherwise just after it
          const tw = g.measureText(r.n).width, inside = tw + 16 < len;
          g.fillStyle = inside ? (dark ? '#f3f3f3' : '#1b1b1b') : text; g.textAlign = 'left';
          g.fillText(r.n, inside ? left + 8 : left + len + 8, y + ROW / 2 - 1);
          g.fillStyle = muted; g.font = '12px system-ui, sans-serif';
          g.fillText(Math.round(r.v).toLocaleString(), inside ? left + len + 8 : Math.min(right + 8, left + len + tw + 16), y + ROW / 2 - 1);
          g.font = '600 13px system-ui, sans-serif';
        }
        g.globalAlpha = 1;
        // the month, large and quiet, bottom right
        const m = S.d.months[i];
        g.textAlign = 'right'; g.fillStyle = muted; g.globalAlpha = 0.55; g.font = '700 30px system-ui, sans-serif'; g.fillText(label(m), w - 12, h - 52);
        g.globalAlpha = 0.8; g.font = '12px system-ui, sans-serif';
        g.fillText(`${(S.d.totals[i] || 0).toLocaleString()} plays this month · ${S.mode === 'all' ? 'all plays so far' : 'plays in the 12 months before'}`, w - 12, h - 26);
        g.globalAlpha = 1;
        const sl = document.getElementById('kr-pos'); if (sl && document.activeElement !== sl) sl.value = S.pos;
        const ml = document.getElementById('kr-month'); if (ml) ml.textContent = label(m);
      }
      function tick(t) {
        S.raf = 0; if (!S.playing) return;
        const dt = S.last ? t - S.last : 16; S.last = t;
        const end = frames().length - 1;
        S.pos = Math.min(end, S.pos + (reduce() ? 0 : dt / MONTH_MS));
        if (reduce()) { S.pos = Math.min(end, Math.floor(S.pos) + 1); }
        draw();
        if (S.pos >= end) { stop(); return; }
        if (api.ui.currentRoute() !== 'view-kexp-years' && !S.rec) { stop(); return; }
        S.raf = reduce() ? setTimeout(() => tick(performance.now()), MONTH_MS) : requestAnimationFrame(tick);
      }
      const play = () => { if (S.pos >= frames().length - 1) S.pos = 0; S.playing = true; S.last = 0; if (!S.raf) S.raf = requestAnimationFrame(tick); controls(); };
      const stop = () => { S.playing = false; if (S.raf) { cancelAnimationFrame(S.raf); clearTimeout(S.raf); S.raf = 0; } controls(); list(); if (S.rec && S.rec.state === 'recording') S.rec.stop(); };
      const controls = () => { const b = document.getElementById('kr-play'); if (b) { b.innerHTML = api.ui.icon(S.playing ? 'pause' : 'play') + (S.playing ? 'Pause' : 'Play'); b.setAttribute('aria-pressed', S.playing); } };
      // the same moment as text: readable, and every name opens its artist page
      const list = () => {
        const el = document.getElementById('kr-list'); if (!el || !S.d || !S.d.ready) return;
        const F = frames()[Math.round(S.pos)] || [];
        el.innerHTML = F.map(([n, v]) => `<li><a href="#view-artist" data-artist="${E(n)}">${E(n)}</a><span class="muted">${v.toLocaleString()} plays</span></li>`).join('');
      };
      function record() {
        const cv = document.getElementById('kr-cv'); if (!cv || !cv.captureStream || !window.MediaRecorder) return api.ui.toast("This browser can't record the chart. Chrome, Edge and Firefox can.");
        const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t)) || '';
        const chunks = [], rec = new MediaRecorder(cv.captureStream(30), type ? { mimeType: type, videoBitsPerSecond: 4e6 } : {});
        rec.ondataavailable = e => e.data.size && chunks.push(e.data);
        rec.onstop = () => {
          S.rec = null; const blob = new Blob(chunks, { type: 'video/webm' }), a = document.createElement('a');
          a.href = URL.createObjectURL(blob); a.download = `kexp-through-the-years-${S.mode === 'all' ? 'all-time' : '12-months'}.webm`; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 60e3); api.ui.toast('Saved the video to your downloads'); api.ui.refresh();
        };
        S.rec = rec; S.pos = 0; draw(); rec.start(); play(); api.ui.refresh();
      }

      api.views.add({ id: 'kexp-years', site: 'kexp.org', group: 'music', order: 31, title: 'KEXP through the years', icon: '📈', subtitle: 'Who KEXP played most, month by month', wide: true, render: el => {
        if (api.system().mode !== 'nas') { el.innerHTML = '<p class="muted">This chart needs the KEXP history on your NAS.</p>'; return; }
        if (!S.d && !S.err) { load(); if (!S.d) { el.innerHTML = api.ui.skeleton(1) + '<div class="skel" style="height:360px"></div>'; return; } }
        if (S.err && !S.d) { el.innerHTML = `<p class="muted">Couldn't load the chart: ${E(S.err)}. <button class="lnk" id="kr-retry">Try again</button></p>`; el.querySelector('#kr-retry').onclick = () => { S.err = null; load(); }; return; }
        if (!S.d.ready) {
          el.innerHTML = `<div class="kr"><p>Your NAS is counting KEXP's plays month by month (${Math.round((S.d.progress || 0) * 100)}% so far). It works on this while you're not using THING, so check back later.</p></div>`;
          return;
        }
        const end = S.d.months.length - 1;
        el.innerHTML = `<div class="kr">
          <div class="kr-bar">
            <div class="seg" role="group" aria-label="What to count">${[['roll', 'Last 12 months'], ['all', 'All time so far']].map(([k, l]) => `<button class="seg-b${S.mode === k ? ' on' : ''}" data-kr-mode="${k}" aria-pressed="${S.mode === k}">${l}</button>`).join('')}</div>
            <button class="btn primary" id="kr-play" aria-pressed="${S.playing}">${api.ui.icon(S.playing ? 'pause' : 'play')}${S.playing ? 'Pause' : 'Play'}</button>
            <button class="btn" id="kr-rec" ${S.rec ? 'disabled' : ''}>${api.ui.icon('download')}${S.rec ? 'Recording…' : 'Save as video'}</button>
          </div>
          <canvas id="kr-cv" class="kr-cv" role="img" aria-label="KEXP's most-played artists, month by month"></canvas>
          <div class="kr-scrub"><span class="muted">${E(label(S.d.months[0]))}</span><input type="range" id="kr-pos" min="0" max="${end}" step="0.01" value="${S.pos}" aria-label="Month"><span class="muted">${E(label(S.d.months[end]))}</span></div>
          <h3 class="kr-h" id="kr-month">${E(label(S.d.months[Math.round(S.pos)]))}</h3>
          <ol class="kr-list" id="kr-list"></ol>
          <p class="muted kr-note">From ${S.d.months.length} months of KEXP's playlist kept on your NAS. Months before your history starts aren't shown.</p>
        </div>`;
        el.querySelectorAll('[data-kr-mode]').forEach(b => b.onclick = () => { S.mode = b.dataset.krMode; api.storage.set('mode', S.mode); api.ui.refresh(); });
        el.querySelector('#kr-play').onclick = () => (S.playing ? stop() : play());
        el.querySelector('#kr-rec').onclick = record;
        const sl = el.querySelector('#kr-pos'); sl.oninput = () => { if (S.playing) stop(); S.pos = +sl.value; draw(); };
        sl.onchange = () => { S.pos = Math.round(+sl.value); draw(); list(); };
        requestAnimationFrame(() => { draw(); list(); });
      } });
      if (!document.getElementById('kr-css')) { const st = document.createElement('style'); st.id = 'kr-css'; st.textContent = `
        .kr{display:flex;flex-direction:column;gap:12px}
        .kr-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
        .kr-bar .seg{display:inline-flex;border:1px solid var(--line);border-radius:999px;padding:2px}
        .kr-bar .seg-b{border:0;background:transparent;color:var(--muted);padding:5px 12px;border-radius:999px;cursor:pointer;font:inherit}
        .kr-bar .seg-b.on{background:var(--hover,rgba(0,0,0,.06));color:var(--text)}
        .kr-cv{width:100%;display:block;border:1px solid var(--line);border-radius:var(--r-l,12px)}
        .kr-scrub{display:flex;align-items:center;gap:10px}.kr-scrub input{flex:1}.kr-scrub span{font-size:12px;white-space:nowrap}
        .kr-h{margin:4px 0 0;font-size:15px}
        .kr-list{margin:0;padding-left:22px;columns:2;column-gap:28px}.kr-list li{break-inside:avoid;padding:2px 0}.kr-list li span{margin-left:8px;font-size:12px}
        @media (max-width:640px){.kr-list{columns:1}}
        .kr-note{font-size:12px}`; document.head.appendChild(st); }
    },
  });
})();
