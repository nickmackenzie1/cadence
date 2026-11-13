/* Sand jar: every task you finish turns to sand. A little stream flies from the task into a glass jar in the corner,
   and the jar fills up over the day. It empties at midnight. Built on the shared Elements layer (CadenceFX), so the
   sand is real: it piles, it slides, and fire turns it to glass. */
(() => {
  const KEY = 'cadence.sandjar';          // { day, n, on, corner }
  const PER_TASK = 46;                     // grains per finished task
  const JW = 64, JH = 88, M = 22;          // jar size and margin, px
  const G = window.__sjG = window.__sjG || {};

  Cadence.registerPlugin({
    id: 'sand-jar', name: 'Sand jar', version: '1.0.0', category: 'Fun', spaces: ['work', 'life'],
    icon: '<path d="M8 2h8M9 2v3.5L6.5 9A4 4 0 0 0 6 11v8a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-8a4 4 0 0 0-.5-2L15 5.5V2"/><path d="M6 15h12"/>', color: '#c79a4a',
    tagline: 'Finished tasks turn to sand and fill a jar',
    description: 'Each task you finish turns into a little stream of sand that pours into a glass jar in the corner. The jar fills over the day and empties at midnight.',
    settings(api) { G.settings && G.settings(); },
    setup(api) {
      const today = () => api.util.todayKey();
      const read = () => { let v = null; try { v = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {} v = Object.assign({ day: today(), n: 0, on: true, corner: 'right' }, v || {}); if (v.day !== today()) { v.day = today(); v.n = 0; } return v; };
      const write = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
      const rect = () => { const v = read(), left = v.corner === 'left' ? M + 288 : innerWidth - M - JW; return { left, top: innerHeight - M - JH, right: left + JW, bottom: innerHeight - M }; };
      const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
      let w = null, day = today();

      // the jar, refilled to today's level
      async function build() {
        if (!window.CadenceFX || reduced() || !read().on || !api.plugins.enabled('sand-jar')) return;
        w = await window.CadenceFX.world(); if (!w) return;
        const r = rect(); w.jar(r);
        pour(Math.min(read().n, 40) * PER_TASK, true);
      }
      // grains drop in from just above the jar's mouth, a few per frame
      function pour(n, fast) {
        if (!w || n <= 0) return; const r = rect(), cx = (r.left + r.right) / 2;
        let left = n;
        const tick = () => { if (!w) return; const k = Math.min(left, fast ? 60 : 8); for (let i = 0; i < k; i++) w.spawn(cx + (Math.random() - 0.5) * (r.right - r.left - 14), r.top - 6, w.M.SAND, 0, 1); left -= k; if (left > 0) requestAnimationFrame(tick); };
        tick();
      }
      // the finished task sends a stream of sand-coloured grains to the jar, then they pour in
      function stream(from) {
        const r = rect(), tx = (r.left + r.right) / 2, ty = r.top - 10;
        const n = 14, done = [];
        for (let i = 0; i < n; i++) {
          const d = document.createElement('i'); d.className = 'sj-g';
          d.style.left = from.x + 'px'; d.style.top = from.y + 'px';
          document.body.appendChild(d);
          const mx = (from.x + tx) / 2 + (Math.random() - 0.5) * 80, my = Math.min(from.y, ty) - 60 - Math.random() * 60;
          done.push(d.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${mx - from.x}px,${my - from.y}px)`, offset: 0.45 }, { transform: `translate(${tx - from.x}px,${ty - from.y}px)` }],
            { duration: 650 + Math.random() * 250, delay: i * 22, easing: 'cubic-bezier(.3,.6,.4,1)' }).finished.then(() => d.remove()).catch(() => d.remove()));
        }
        Promise.all(done).then(() => pour(PER_TASK));
      }
      api.on('task:complete', () => {
        const v = read(); if (!v.on || reduced()) return;
        if (v.day !== day) { day = v.day; w && w.clear(w.M.SAND); build(); }   // a new day: an empty jar
        v.n++; write(v);
        const c = document.querySelector('.task.leaving .check, .task.done .check');
        const b = c ? c.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
        if (!w) build().then(() => stream({ x: b.left + b.width / 2, y: b.top + b.height / 2 }));
        else stream({ x: b.left + b.width / 2, y: b.top + b.height / 2 });
      });
      api.on('task:reopen', () => { const v = read(); if (v.n > 0) { v.n--; write(v); } });
      // midnight, or the layer rebuilt after a resize: put the jar back
      addEventListener('elements:ready', () => setTimeout(build, 50));
      setInterval(() => { if (today() !== day) { day = today(); if (w) { w.clear(w.M.SAND); build(); } } }, 60000);

      G.settings = () => {
        const v = read();
        api.ui.modal('Sand jar', `
          <label class="xm-row"><input type="checkbox" id="sj-on" ${v.on ? 'checked' : ''}> Finished tasks pour sand into the jar</label>
          <div class="field"><label>Corner</label><div class="seg" id="sj-corner"><button data-v="left" class="${v.corner === 'left' ? 'on' : ''}">Bottom left</button><button data-v="right" class="${v.corner !== 'left' ? 'on' : ''}">Bottom right</button></div></div>
          <p class="muted" style="font-size:12px">Today: ${v.n} task${v.n === 1 ? '' : 's'} in the jar. It empties at midnight.</p>`,
          '<button class="btn" id="sj-empty" style="margin-right:auto">Empty the jar</button><button class="btn primary" id="sj-done">Done</button>');
        let corner = v.corner;
        document.querySelectorAll('#sj-corner button').forEach(b => b.onclick = () => { corner = b.dataset.v; document.querySelectorAll('#sj-corner button').forEach(x => x.classList.toggle('on', x === b)); });
        document.getElementById('sj-empty').onclick = () => { const n = read(); n.n = 0; write(n); w && w.clear(w.M.SAND); api.ui.toast('Jar emptied'); };
        document.getElementById('sj-done').onclick = () => { const n = read(); n.on = document.getElementById('sj-on').checked; const moved = n.corner !== corner; n.corner = corner; write(n); api.ui.close();
          if (w && (moved || !n.on)) { w.clear(w.M.SAND); w.clear(w.M.GLASS); } if (n.on) build(); };
      };
      api.commands.add({ title: 'Sand jar…', run: () => G.settings() });
      window.__sandjar = { read, rect, build };

      if (!document.getElementById('sj-css')) { const st = document.createElement('style'); st.id = 'sj-css';
        st.textContent = `.sj-g{position:fixed;width:3px;height:3px;margin:-1.5px;border-radius:1px;background:#d6b670;z-index:61;pointer-events:none;box-shadow:0 0 2px rgba(150,110,40,.5)}`; document.head.appendChild(st); }
      if (read().on && read().n > 0) setTimeout(build, 600);   // a jar with sand in it from earlier today
    }
  });
})();
