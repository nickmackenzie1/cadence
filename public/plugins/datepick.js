/* Quick date — add a task without a date and a little calendar pops open right under it.
   Click a day or a quick pick; arrow keys + Enter work while the quick-add box is empty.
   Keep typing your next task and it politely disappears. */
(() => {
  const G = window.__datepick = window.__datepick || {};
  if (!G.style) {
    G.style = document.createElement('style');
    G.style.textContent = `
      .dp{position:fixed;z-index:65;width:268px;padding:10px;border-radius:14px;background:var(--panel);border:1px solid var(--line);box-shadow:0 18px 50px rgba(0,0,0,.16),0 2px 6px rgba(0,0,0,.06);font-size:12.5px;transform-origin:var(--ox,30px) top;animation:dpin .28s cubic-bezier(.2,1.4,.4,1)}
      .dp.up{transform-origin:var(--ox,30px) bottom}
      .dp.out{transition:opacity .16s,transform .16s;opacity:0;transform:scale(.96) translateY(-4px)}
      @keyframes dpin{from{opacity:0;transform:scale(.9) translateY(-6px)}}
      .dp:before{content:"";position:absolute;top:-6px;left:calc(var(--ox,30px) - 6px);width:11px;height:11px;background:var(--panel);border-left:1px solid var(--line);border-top:1px solid var(--line);transform:rotate(45deg)}
      .dp.up:before{top:auto;bottom:-6px;transform:rotate(225deg)}
      .dp-hd{display:flex;align-items:center;gap:6px;margin-bottom:8px;color:var(--muted);font-size:11.5px}
      .dp-hd b{color:var(--text);font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dp-hd button{width:22px;height:22px;border-radius:6px;display:grid;place-items:center;color:var(--muted)}
      .dp-hd button:hover{background:var(--hover);color:var(--text)}
      .dp-quick{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:10px}
      .dp-quick button{padding:6px 2px;border-radius:8px;background:var(--bg);border:1px solid var(--line);font-size:11.5px;font-weight:550;line-height:1.15}
      .dp-quick button small{display:block;color:var(--muted);font-weight:500;font-size:10px;margin-top:1px}
      .dp-quick button:hover{border-color:var(--accent);color:var(--accent)}
      .dp-month{display:flex;align-items:center;margin-bottom:4px}
      .dp-month b{flex:1;font-weight:650;font-size:13px}
      .dp-month button{width:24px;height:24px;border-radius:6px;color:var(--muted);font-size:14px}
      .dp-month button:hover{background:var(--hover);color:var(--text)}
      .dp-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center}
      .dp-grid .w{font-size:10px;color:var(--faint);font-weight:600;padding:3px 0}
      .dp-grid button{height:30px;border-radius:8px;font-size:12px;font-variant-numeric:tabular-nums;position:relative}
      .dp-grid button:hover{background:var(--hover)}
      .dp-grid button.o{color:var(--faint)}
      .dp-grid button.past{color:var(--faint)}
      .dp-grid button.t{color:var(--accent);font-weight:700}
      .dp-grid button.t:after{content:"";position:absolute;left:50%;bottom:4px;width:3px;height:3px;margin-left:-1.5px;border-radius:50%;background:var(--accent)}
      .dp-grid button.sel{background:var(--accent);color:#fff;font-weight:650}
      .dp-grid button.busy:before{content:"";position:absolute;top:4px;right:5px;width:4px;height:4px;border-radius:50%;background:var(--client);opacity:.7}
      .dp-ft{display:flex;justify-content:space-between;align-items:center;margin-top:8px;color:var(--faint);font-size:10.5px}
      .dp-ft button{color:var(--muted);font-size:11.5px;font-weight:550;padding:4px 6px;border-radius:6px}
      .dp-ft button:hover{background:var(--hover);color:var(--text)}
    `;
    document.head.appendChild(G.style);
  }

  Cadence.registerPlugin({
    id: 'datepick', name: 'Quick date', version: '1.0.0',
    description: 'Add a task without a date and a little calendar pops open right under it — click a day or use the arrow keys.',
    setup(api) {
      const { ymd, addDays, todayKey, fmtDate } = api.util;
      const fromKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
      function close(fast) {
        const el = G.el; if (!el) return; G.el = null; G.keys && document.removeEventListener('keydown', G.keys, true); G.out && document.removeEventListener('pointerdown', G.out, true);
        const q = document.getElementById('qa'); if (q && G.inp) q.removeEventListener('input', G.inp);
        if (fast) { el.remove(); return; } el.classList.add('out'); setTimeout(() => el.remove(), 170);
      }
      function open(task, opts = {}) {
        close(true);
        const row = opts.anchor || document.querySelector(`.task[data-id="${task.id}"]`); if (!row) return;
        const t0 = todayKey(), now = new Date();
        const dueCounts = {}; api.tasks.list(x => !x.done && x.dueDate && x.owner === 'me').forEach(x => dueCounts[x.dueDate] = (dueCounts[x.dueDate] || 0) + 1);
        const start0 = opts.value ? fromKey(opts.value) : now;
        let view = new Date(start0.getFullYear(), start0.getMonth(), 1), sel = opts.value || t0;
        const sat = (6 - now.getDay() + 7) % 7 || 7, mon = ((8 - now.getDay()) % 7) || 7;
        const quick = [['Today', t0], ['Tomorrow', ymd(addDays(now, 1))], ['Weekend', ymd(addDays(now, now.getDay() === 6 ? 0 : sat))], ['Next week', ymd(addDays(now, mon))]];
        const el = document.createElement('div'); el.className = 'dp'; G.el = el;
        const pick = key => {
          if (opts.onPick) { close(); opts.onPick(key); return; }
          api.tasks.update(task.id, { dueDate: key });
          close();
          const r2 = document.querySelector(`.task[data-id="${task.id}"]`);
          const p = r2 ? r2.getBoundingClientRect() : null;
          api.ui.toast(`Due ${fmtDate(key).toLowerCase()}`, [], p ? { at: { x: p.left + 120, y: p.top + 8 } } : {});
          const q = document.getElementById('qa'); q && q.focus();
        };
        const draw = () => {
          const first = new Date(view), start = addDays(first, -((first.getDay() + 6) % 7)); // weeks start Monday
          let cells = '';
          for (let i = 0; i < 42; i++) {
            const d = addDays(start, i), k = ymd(d);
            if (i >= 35 && d.getMonth() !== view.getMonth()) break;
            const cls = [d.getMonth() !== view.getMonth() ? 'o' : '', k < t0 ? 'past' : '', k === t0 ? 't' : '', k === sel ? 'sel' : '', dueCounts[k] ? 'busy' : ''].join(' ');
            cells += `<button data-k="${k}" class="${cls}" title="${dueCounts[k] ? dueCounts[k] + ' due' : ''}">${d.getDate()}</button>`;
          }
          el.innerHTML = `
            <div class="dp-hd"><span>When is</span><b>${api.ui.esc(task.title)}</b><span>due?</span><button data-x title="No date (Esc)">✕</button></div>
            <div class="dp-quick">${quick.map(([l, k]) => `<button data-k="${k}">${l}<small>${fromKey(k).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</small></button>`).join('')}</div>
            <div class="dp-month"><b>${view.toLocaleDateString(undefined, { month: 'long', year: view.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })}</b><button data-m="-1">‹</button><button data-m="1">›</button></div>
            <div class="dp-grid">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(w => `<span class="w">${w}</span>`).join('')}${cells}</div>
            <div class="dp-ft"><span>←→↑↓ move · ↵ pick · esc ${opts.anchor ? 'close' : 'skip'}</span><button data-x>${opts.value ? 'Clear date' : 'No date'}</button></div>`;
        };
        draw(); document.body.appendChild(el);
        // place right under the new task (or above if there's no room)
        const r = row.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
        const x = Math.max(10, Math.min(innerWidth - w - 10, r.left + (opts.anchor ? 0 : 18))), below = r.bottom + 10 + h < innerHeight;
        el.style.left = x + 'px'; el.style.top = (below ? r.bottom + 8 : r.top - h - 8) + 'px';
        el.classList.toggle('up', !below); el.style.setProperty('--ox', Math.max(16, Math.min(w - 16, r.left + (opts.anchor ? 16 : 30) - x)) + 'px');
        el.addEventListener('click', e => {
          const b = e.target.closest('button'); if (!b) return; e.stopPropagation();
          if (b.dataset.x !== undefined) { close(); if (opts.onClear) opts.onClear(); return; }
          if (b.dataset.m) { view = new Date(view.getFullYear(), view.getMonth() + +b.dataset.m, 1); draw(); return; }
          if (b.dataset.k) pick(b.dataset.k);
        });
        // keyboard: only while the quick-add box is empty, so typing the next task is never blocked
        G.keys = e => {
          const q = document.getElementById('qa'), typing = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return close(); }
          if (typing && q && q.value) return;
          const mv = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
          if (mv) { e.preventDefault(); e.stopPropagation(); const d = addDays(fromKey(sel), mv); sel = ymd(d); if (d.getMonth() !== view.getMonth() || d.getFullYear() !== view.getFullYear()) view = new Date(d.getFullYear(), d.getMonth(), 1); draw(); return; }
          if (e.key === 'Enter' && !(q && q.value)) { e.preventDefault(); e.stopPropagation(); pick(sel); }
        };
        document.addEventListener('keydown', G.keys, true);
        G.out = e => { if (!el.contains(e.target)) close(); };
        setTimeout(() => G.el === el && document.addEventListener('pointerdown', G.out, true), 0);
        const q = document.getElementById('qa'); G.inp = () => close(); q && q.addEventListener('input', G.inp, { once: true });
      }
      api.on('task:quickadd', task => { if (!task.dueDate) setTimeout(() => open(task), 60); });
      // other parts of Cadence (the inline task editor) can borrow the calendar
      window.CadenceDatePick = { openAt: (anchor, o) => open({ id: '_', title: o.title || 'this' }, { anchor, value: o.value, onPick: o.onPick, onClear: o.onClear }) };
      api.on('render', () => { if (G.el && !document.body.contains(G.el)) G.el = null; });
    }
  });
})();
