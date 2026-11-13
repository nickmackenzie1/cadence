/* Games with your list:
   - Roulette: spin a wheel of your open tasks and do whatever it lands on. No appeals (10-minute cooldown).
   - Rival: an imaginary rival with the same list, finishing things at a believable pace, always just ahead.
   - Life quests: goals as a skill tree. Finish a step and the next ones unlock as real tasks.
   - Bucket list by urgency: sorted by how many good years each one realistically has left. Grim, but clarifying. */
(() => {
  const esc = window.CadenceKit.esc;
  const css = window.CadenceKit.css;
  const DAY = 864e5;
  const uid = window.CadenceKit.uid;

  /* ======================= Roulette ======================= */
  Cadence.registerPlugin({
    id: 'roulette', name: 'Roulette', version: '1.0.0', category: 'Fun', spaces: ['work', 'life'],
    description: 'Can’t decide? Spin a wheel of your open tasks and do whatever it lands on. No appeals: the wheel locks for 10 minutes.',
    tagline: 'Spin. Do it. No appeals.', color: '#ef4444',
    icon: '<circle cx="12" cy="12" r="10"/><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93 4.93 19.07"/><circle cx="12" cy="12" r="2"/>',
    setup(api) {
      const R = window.__roulette = window.__roulette || {};
      const COLS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4', '#e11d48'];
      const pool = () => { const t0 = api.util.todayKey(), open = api.tasks.list(t => !t.done && t.owner !== 'client');
        const rank = t => (t.dueDate && t.dueDate <= t0 ? 0 : t.dueDate ? 1 : 2) * 10 - (t.priority || 0);
        return open.sort((a, b) => rank(a) - rank(b)).slice(0, 12); };
      const lockLeft = () => Math.max(0, (api.storage.get('lock') || 0) - Date.now());
      function spin() {
        const list = pool(); if (list.length < 2) return api.ui.toast('Add a couple of tasks first.');
        const n = list.length, seg = 360 / n;
        const wheel = list.map((t, i) => { const a0 = (i * seg - 90) * Math.PI / 180, a1 = ((i + 1) * seg - 90) * Math.PI / 180, r = 150;
          const p = `M160 160 L${160 + r * Math.cos(a0)} ${160 + r * Math.sin(a0)} A${r} ${r} 0 ${seg > 180 ? 1 : 0} 1 ${160 + r * Math.cos(a1)} ${160 + r * Math.sin(a1)}Z`, mid = (i + .5) * seg;
          const flip = mid > 180, label = esc(t.title.length > 18 ? t.title.slice(0, 17) + '…' : t.title);
          return `<path d="${p}" fill="${COLS[i % COLS.length]}"/><text transform="rotate(${mid - 90} 160 160) translate(${flip ? 160 + 140 : 160 + 28} 164)${flip ? ' rotate(180 0 -4)' : ''}" class="rl-t" text-anchor="${flip ? 'start' : 'start'}">${label}</text>`; }).join('');
        const locked = lockLeft();
        api.ui.modal('Roulette', `<div class="rl"><div class="rl-ptr"></div><svg viewBox="0 0 320 320" width="320" height="320" class="rl-w"><g class="rl-g">${wheel}</g><circle cx="160" cy="160" r="16" fill="var(--panel)" stroke="var(--line)"/></svg><div class="rl-res" id="rl-res">${locked ? `The wheel is locked for ${Math.ceil(locked / 60e3)} more min. You know what you have to do.` : 'Whatever it lands on, you do. No appeals.'}</div></div>`,
          `<button class="btn primary" id="rl-go" ${locked ? 'disabled' : ''}>Spin</button>`);
        document.getElementById('rl-go').onclick = () => {
          const pick = Math.floor(Math.random() * n), turns = 5 + Math.floor(Math.random() * 3), target = turns * 360 + (360 - (pick + .5) * seg) + (Math.random() - .5) * seg * .6;
          const g = document.querySelector('.rl-g'), btn = document.getElementById('rl-go'); btn.disabled = true;
          g.style.transition = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'none' : 'transform 4.2s cubic-bezier(.12,.75,.12,1)'; g.style.transform = `rotate(${target}deg)`;
          setTimeout(() => { const t = list[pick]; api.storage.set('lock', Date.now() + 10 * 60e3); api.storage.set('won', { id: t.id, at: Date.now() });
            document.getElementById('rl-res').innerHTML = `<small>The wheel has spoken</small><b>${esc(t.title)}</b><span>Do it now. The wheel is locked for 10 minutes.</span>`;
            btn.textContent = 'Do it'; btn.disabled = false; btn.onclick = () => { api.ui.close(); api.ui.navigate(t.clientId ? 'client-' + t.clientId : 'today'); setTimeout(() => api.ui.openTask(t.id), 100); }; R.last = t.id; }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 50 : 4300);
        };
      }
      R.spin = spin;
      api.on('task:complete', t => { const w = api.storage.get('won'); if (w && w.id === t.id && Date.now() - w.at < 60 * 60e3) { api.storage.set('won', null); api.island.celebrate({ icon: '🎲', title: 'The wheel is pleased', sub: 'Roulette task done within the hour' }); } });
      api.commands.add({ title: 'Spin the wheel', hint: 'Roulette: do whatever it lands on', run: spin });
      css('rl-css', `.rl{position:relative;display:flex;flex-direction:column;align-items:center;gap:12px}.rl-w{filter:drop-shadow(0 10px 24px rgba(0,0,0,.2))}
        .rl-g{transform-origin:160px 160px}.rl-t{font:600 10.5px Inter,system-ui;fill:#fff}
        .rl-ptr{position:absolute;top:-4px;left:50%;margin-left:-11px;width:0;height:0;border:11px solid transparent;border-top:20px solid var(--text);z-index:2}
        .rl-res{text-align:center;font-size:13px;color:var(--muted);min-height:54px}.rl-res small{display:block;text-transform:uppercase;letter-spacing:.1em;font-size:10.5px;font-weight:700}.rl-res b{display:block;font-size:18px;color:var(--text);margin:2px 0}`);
    },
  });

  /* ======================= Rival ======================= */
  Cadence.registerPlugin({
    id: 'rival', name: 'Rival', version: '1.0.0', category: 'Fun', spaces: ['work', 'life'],
    description: 'An imaginary rival with the same list. They finish things at a believable pace (based on your own last two weeks) and stay just ahead of you. Beat them.',
    tagline: 'Always one task ahead', color: '#64748b',
    icon: '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/>',
    setup(api) {
      const name = () => api.storage.get('name') || 'Morgan';
      const t0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
      const mine = () => api.tasks.list(t => t.done && t.doneAt >= t0()).length;
      function rival() {
        const days = 14, since = t0() - days * DAY, n = api.tasks.list(t => t.done && t.doneAt >= since && t.doneAt < t0()).length, avg = Math.max(3, n / days);
        const h = new Date().getHours() + new Date().getMinutes() / 60, frac = Math.max(0, Math.min(1, (h - 8.5) / 9));   // works 8:30 to 5:30
        const seed = new Date().getDate() * 7.3, wobble = Math.sin(seed + h) * .6;
        let r = Math.round(avg * 1.08 * frac + wobble);
        const me = mine(); if (me > r && frac < 1) r = Math.min(me + 1, Math.round(avg * 1.3 * frac + 2));   // they sprint when you pass them
        return Math.max(0, r);
      }
      function draw(el) {
        const me = mine(), r = rival(), mx = Math.max(me, r, 1), ahead = me - r;
        el.innerHTML = `<div class="rv"><div class="rv-r"><span>You</span><i><b style="width:${me / mx * 100}%"></b></i><em>${me}</em></div><div class="rv-r them"><span title="Rename" class="rv-n">${esc(name())}</span><i><b style="width:${r / mx * 100}%"></b></i><em>${r}</em></div>
          <div class="rv-s">${ahead > 0 ? `You’re ${ahead} ahead. ${esc(name())} is sweating.` : ahead === 0 ? 'Neck and neck.' : `${esc(name())} is ${-ahead} ahead. Hm.`}</div></div>`;
        el.querySelector('.rv-n').onclick = () => { api.ui.ask('Name your rival', [{ k: 'n', label: 'Name', def: name() }]).then(v => { if (v && v.n) { api.storage.set('name', v.n.slice(0, 20)); draw(el); } }); };
      }
      const TAUNTS = ['just closed another one.', 'is having a great day.', 'says hi. From in front of you.', 'didn’t even need coffee for that one.'];
      let lastLead = null;
      const check = () => { const me = mine(), r = rival(), lead = me > r ? 'me' : me < r ? 'them' : lastLead; if (lastLead && lead !== lastLead) {
        if (lead === 'me') api.island.celebrate({ icon: '⚔️', title: `You passed ${name()}!`, sub: `${me} to ${r} today` }); else api.island.show({ icon: '⚔️', title: `${name()} ${TAUNTS[Math.floor(Math.random() * TAUNTS.length)]}`, sub: `${r} to your ${me}`, log: false }); }
        lastLead = lead; api.ui.refreshWidgets && api.ui.refreshWidgets(); };
      api.on('task:complete', () => setTimeout(check, 50));
      clearInterval(window.__rivalIv); window.__rivalIv = setInterval(check, 5 * 60e3); setTimeout(() => { lastLead = mine() >= rival() ? 'me' : 'them'; }, 1500);
      window.__rival = { rival, mine };
      api.sidebar.add({ id: 'rival', slot: 'bottom', order: 23, title: 'Rival', render: draw });
      api.widgets.add({ id: 'rival', title: 'Rival', icon: 'swords', size: 's', description: 'You vs your imaginary rival, today.', render: draw });
      css('rv-css', `.rv{font-size:12.5px;display:flex;flex-direction:column;gap:6px;padding:4px 2px}.rv-r{display:grid;grid-template-columns:60px 1fr 24px;gap:8px;align-items:center}
        .rv-r i{height:8px;border-radius:999px;background:var(--hover);overflow:hidden}.rv-r b{display:block;height:100%;border-radius:999px;background:var(--accent);transition:width .5s}
        .rv-r.them b{background:#64748b}.rv-r em{font-style:normal;font-weight:700;text-align:right}.rv-n{cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rv-s{color:var(--muted);font-size:11.5px}`);
    },
  });

  /* ======================= Life quests ======================= */
  const QUESTS = {
    cook: { title: 'Learn to cook', nodes: [['Make a perfect omelette'], ['Cook rice and beans from scratch', 0], ['Master one pasta sauce', 0], ['Roast a whole chicken', 1], ['Bake bread', 2], ['Cook a three-course dinner', 3, 4], ['Host a dinner party', 5]] },
    run: { title: 'Run a 5K', nodes: [['Walk 30 minutes, 3 times'], ['Run/walk intervals for a week', 0], ['Run 1 km without stopping', 1], ['Run 3 km', 2], ['Sign up for a 5K', 2], ['Run the 5K', 3, 4]] },
    guitar: { title: 'Learn guitar', nodes: [['Learn 4 open chords'], ['Switch chords in time with a metronome', 0], ['Play a full song', 1], ['Learn a strumming pattern', 0], ['Learn barre chords', 2, 3], ['Play for someone', 4]] },
    house: { title: 'Get the house in order', nodes: [['Declutter one closet'], ['Set up a donation box', 0], ['Declutter the kitchen', 0], ['Make an emergency binder', 0], ['Organise the garage', 1, 2], ['Have people over', 4]] },
  };
  Cadence.registerPlugin({
    id: 'quests', name: 'Life quests', version: '1.0.0', category: 'Life', spaces: ['life', 'work'],
    description: 'Goals as a skill tree: “Learn to cook” leads to “Host a dinner party”. Finish a step and the next ones unlock as real tasks.',
    tagline: 'Goals as a skill tree', color: '#8b5cf6',
    icon: '<circle cx="12" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/><path d="M12 7v4M12 11l-6 6M12 11l6 6"/>',
    setup(api) {
      const all = () => api.storage.get('quests') || [];
      const save = q => api.storage.set('quests', q);
      const unlocked = (q, n) => !n.done && (n.req || []).every(i => q.nodes[i] && q.nodes[i].done);
      function sync(q) {   // every unlocked step has a task
        for (const [i, n] of q.nodes.entries()) if (unlocked(q, n) && !n.taskId) { const t = api.tasks.add({ title: n.title, tags: ['quest'], quest: { q: q.id, n: i } }); n.taskId = t.id; }
        return q;
      }
      function start(key, custom) {
        const tpl = custom || QUESTS[key]; const q = { id: uid(), title: tpl.title, at: Date.now(), nodes: tpl.nodes.map(([title, ...req]) => ({ title, req, done: false })) };
        save([...all(), sync(q)]); api.ui.toast(`Quest started: ${q.title}`); api.ui.refresh();
      }
      api.on('task:complete', t => { if (!t.quest) return; const qs = all(), q = qs.find(x => x.id === t.quest.q); if (!q || !q.nodes[t.quest.n] || q.nodes[t.quest.n].done) return;
        q.nodes[t.quest.n].done = true; q.nodes[t.quest.n].at = Date.now(); const before = q.nodes.filter(n => n.taskId).length; sync(q); const opened = q.nodes.filter(n => n.taskId).length - before;
        save(qs); const finished = q.nodes.every(n => n.done);
        api.island.celebrate({ icon: '✦', title: finished ? `Quest complete: ${q.title}!` : `${q.nodes[t.quest.n].title}: done`, sub: finished ? 'Every step, start to finish.' : opened ? `${opened} new step${opened === 1 ? '' : 's'} unlocked` : `${q.nodes.filter(n => n.done).length} of ${q.nodes.length} steps` }); });
      function tree(q) {
        const depth = q.nodes.map(() => 0); q.nodes.forEach((n, i) => { depth[i] = n.req.length ? Math.max(...n.req.map(r => depth[r] + 1)) : 0; });
        const cols = Math.max(...depth) + 1, rows = {}; const pos = q.nodes.map((n, i) => { const d = depth[i]; rows[d] = (rows[d] || 0) + 1; return { d, r: rows[d] - 1 }; });
        const maxR = Math.max(...Object.values(rows)), CW = 190, RH = 70, W = cols * CW, H = maxR * RH;
        const xy = i => [pos[i].d * CW + 80, (pos[i].r + .5) * (H / rows[pos[i].d])];
        const lines = q.nodes.flatMap((n, i) => n.req.map(r => { const [x1, y1] = xy(r), [x2, y2] = xy(i); return `<path d="M${x1 + 74} ${y1} C${x1 + 110} ${y1} ${x2 - 110} ${y2} ${x2 - 74} ${y2}" class="${q.nodes[r].done ? 'on' : ''}"/>`; })).join('');
        return `<div class="qt" style="width:${W}px;height:${H}px"><svg width="${W}" height="${H}">${lines}</svg>${q.nodes.map((n, i) => { const [x, y] = xy(i), st = n.done ? 'done' : unlocked(q, n) ? 'open' : 'locked';
          return `<div class="qn ${st}" style="left:${x - 74}px;top:${y - 24}px" title="${esc(n.title)}">${st === 'done' ? api.ui.icon('check') : st === 'locked' ? api.ui.icon('lock') : api.ui.icon('star')}<span>${esc(n.title)}</span></div>`; }).join('')}</div>`;
      }
      function view(el) {
        const qs = all();
        el.innerHTML = `${qs.map(q => { const d = q.nodes.filter(n => n.done).length; return `<section class="qs"><header><b>${esc(q.title)}</b><span>${d} of ${q.nodes.length}</span><i class="qbar"><b style="width:${d / q.nodes.length * 100}%"></b></i><button class="btn ghost" data-qdel="${esc(q.id)}" title="Abandon quest">${api.ui.icon('x')}</button></header><div class="qscroll">${tree(q)}</div></section>`; }).join('')}
          <section class="qs new"><b>Start a quest</b><div class="qpick">${Object.entries(QUESTS).map(([k, v]) => `<button class="btn" data-q="${k}">${esc(v.title)}</button>`).join('')}<button class="btn" data-q="custom">Your own…</button></div></section>`;
        el.querySelectorAll('[data-q]').forEach(b => b.onclick = () => b.dataset.q === 'custom' ? custom() : start(b.dataset.q));
        el.querySelectorAll('[data-qdel]').forEach(b => b.onclick = () => { const q = all().find(x => x.id === b.dataset.qdel); if (!q) return; save(all().filter(x => x.id !== q.id)); for (const n of q.nodes) if (n.taskId && !n.done) { const t = api.tasks.get(n.taskId); if (t && !t.done) api.tasks.remove(n.taskId); } api.ui.toast('Quest abandoned'); api.ui.refresh(); });
      }
      function custom() {
        api.ui.modal('Your own quest', `<div class="field"><label>Goal</label><input class="inp" id="qc-t" placeholder="Learn Spanish"></div>
          <div class="field"><label>Steps, one per line. Indent a line (two spaces) to make it need the step above it.</label><textarea class="inp" id="qc-s" rows="7" placeholder="Learn 100 words\n  Have a 5 minute conversation\n  Watch a film without subtitles\nBook a trip"></textarea></div>`, '<button class="btn primary" id="qc-go">Start quest</button>');
        document.getElementById('qc-go').onclick = () => { const title = document.getElementById('qc-t').value.trim(), lines = document.getElementById('qc-s').value.split('\n').filter(l => l.trim()); if (!title || !lines.length) return;
          const nodes = [], stack = []; lines.forEach(l => { const ind = (l.match(/^\s*/)[0].length / 2) | 0; while (stack.length > ind) stack.pop(); const parent = stack[stack.length - 1]; nodes.push([l.trim(), ...(parent != null ? [parent] : [])]); stack.push(nodes.length - 1); });
          api.ui.close(); start(null, { title, nodes }); };
      }
      window.__quests = { start, all };
      api.views.add({ id: 'quests', title: 'Quests', icon: '🗺️', subtitle: 'Goals as a skill tree. Finish a step, the next ones unlock as tasks.', wide: true, render: view });
      css('qs-css', `.qs{border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin-bottom:14px;background:var(--panel)}.qs header{display:flex;align-items:center;gap:10px;margin-bottom:8px}.qs header span{color:var(--muted);font-size:12px}
        .qbar{flex:1;height:6px;border-radius:999px;background:var(--hover);overflow:hidden;max-width:240px}.qbar b{display:block;height:100%;background:#8b5cf6;border-radius:999px}
        .qscroll{overflow-x:auto;padding:6px 0}.qt{position:relative}.qt>svg{position:absolute;inset:0}.qt path{fill:none;stroke:var(--line);stroke-width:2}.qt path.on{stroke:#8b5cf6}
        .qn{position:absolute;width:148px;height:48px;display:flex;align-items:center;gap:7px;padding:0 10px;border-radius:12px;border:1.5px solid var(--line);background:var(--bg);font-size:12px;line-height:1.25}
        .qn span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.qn svg{width:15px;height:15px;flex:none}
        .qn.done{border-color:#8b5cf6;background:color-mix(in srgb,#8b5cf6 12%,var(--bg))}.qn.done svg{color:#8b5cf6}
        .qn.open{border-color:#f59e0b;box-shadow:0 0 0 3px color-mix(in srgb,#f59e0b 20%,transparent)}.qn.open svg{color:#f59e0b}.qn.locked{opacity:.55}
        .qs.new{display:flex;flex-direction:column;gap:8px}.qpick{display:flex;flex-wrap:wrap;gap:6px}`);
    },
  });

  /* ======================= Bucket list by urgency ======================= */
  Cadence.registerPlugin({
    id: 'bucket', name: 'Bucket list', version: '1.0.0', category: 'Life', spaces: ['life'],
    description: 'A bucket list sorted by how many good years each item realistically has left (physical ones first). Your life in weeks at the top. Grim, but clarifying.',
    tagline: 'Sorted by actuarial urgency', color: '#0f172a',
    icon: '<path d="m12.5 17-.5-1-.5 1h1z"/><path d="M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="12" r="1"/>',
    setup(api) {
      const cfg = () => Object.assign({ born: null, expect: 82 }, api.storage.get('cfg') || {});
      const items = () => api.storage.get('items') || [];
      const LIMIT = { 3: ['Very physical', 60], 2: ['Active', 72], 1: ['Gentle', 999] };   // realistic "until" ages
      const age = () => { const b = cfg().born; return b ? (Date.now() - new Date(b + '-07-01').getTime()) / (365.25 * DAY) : null; };
      const yearsLeft = it => { const a = age(); if (a == null) return null; const until = Math.min(cfg().expect, it.by || 999, LIMIT[it.phys || 1][1]); return Math.max(0, until - a); };
      function view(el) {
        const a = age(), c = cfg(), list = items().slice().sort((x, y) => (x.done - y.done) || ((yearsLeft(x) ?? 99) - (yearsLeft(y) ?? 99)));
        const weeks = a != null ? Math.floor(a * 52.18) : 0, total = Math.round(c.expect * 52.18);
        el.innerHTML = `${a == null ? `<div class="bk-setup"><b>When were you born?</b> It’s only used here, to work out the years each item has left. <input class="inp" id="bk-born" type="number" min="1920" max="2020" placeholder="1988" style="width:110px"> <button class="btn primary" id="bk-save">Save</button></div>`
          : `<div class="bk-life"><div class="bk-grid">${Array.from({ length: Math.ceil(total / 52) }, (_, y) => `<i class="${y * 52 < weeks ? (y * 52 + 52 <= weeks ? 'past' : 'now') : ''}"></i>`).join('')}</div>
            <div class="bk-txt"><b>${Math.max(0, total - weeks).toLocaleString()}</b> weeks left, if you’re average (expectancy ${c.expect}). <button class="btn ghost" id="bk-edit">Change</button></div></div>`}
          <div class="bk-add"><input class="inp" id="bk-t" placeholder="Something you want to do before you die"><select class="inp" id="bk-p">${Object.entries(LIMIT).reverse().map(([k, [l]]) => `<option value="${k}">${l}</option>`).join('')}</select><input class="inp" id="bk-by" type="number" min="1" max="120" placeholder="By age (optional)" style="width:150px"><button class="btn primary" id="bk-go">Add</button></div>
          <div class="bk-list">${list.map(it => { const y = yearsLeft(it); return `<div class="bk-it ${it.done ? 'done' : ''} ${y != null && y < 5 && !it.done ? 'hot' : ''}"><button class="bk-chk" data-bk="${esc(it.id)}">${it.done ? api.ui.icon('check') : ''}</button><div><b>${esc(it.t)}</b><span>${LIMIT[it.phys || 1][0]}${it.by ? ' · by ' + it.by : ''}</span></div><em>${it.done ? 'Lived' : y == null ? '' : y < 1 ? 'Now or never' : Math.floor(y) + ' good years left'}</em><button class="bk-x" data-bkx="${esc(it.id)}" title="Remove">${api.ui.icon('x')}</button></div>`; }).join('') || '<div class="muted" style="padding:16px 0">Nothing yet. What would you regret never doing?</div>'}</div>`;
        const $ = id => el.querySelector('#' + id);
        $('bk-save') && ($('bk-save').onclick = () => { const b = +$('bk-born').value; if (b > 1900) { api.storage.set('cfg', { ...cfg(), born: b }); api.ui.refresh(); } });
        $('bk-edit') && ($('bk-edit').onclick = () => { api.ui.ask('Your numbers', [{ k: 'b', label: 'Birth year', type: 'number', def: c.born, min: 1900, max: 2025 }, { k: 'e', label: 'Life expectancy to plan around', type: 'number', def: c.expect, min: 50, max: 110 }]).then(v => { if (!v) return; api.storage.set('cfg', { born: v.b || c.born, expect: Math.max(50, Math.min(110, v.e || c.expect)) }); api.ui.refresh(); }); });
        $('bk-go').onclick = () => { const t = $('bk-t').value.trim(); if (!t) return; api.storage.set('items', [...items(), { id: uid(), t: t.slice(0, 160), phys: +$('bk-p').value, by: +$('bk-by').value || null, done: false }]); api.ui.refresh(); };
        $('bk-t').onkeydown = e => { if (e.key === 'Enter') $('bk-go').click(); };
        el.querySelectorAll('[data-bk]').forEach(b => b.onclick = () => { api.storage.set('items', items().map(x => x.id === b.dataset.bk ? { ...x, done: !x.done, at: Date.now() } : x)); if (!items().find(x => x.id === b.dataset.bk).done) {} api.ui.refresh(); });
        el.querySelectorAll('[data-bkx]').forEach(b => b.onclick = () => { api.storage.set('items', items().filter(x => x.id !== b.dataset.bkx)); api.ui.refresh(); });
      }
      api.views.add({ id: 'bucket', title: 'Bucket list', icon: '💀', subtitle: 'Sorted by how many good years each one has left', render: view });
      css('bk-css', `.bk-setup{padding:14px;border:1px dashed var(--line);border-radius:12px;margin-bottom:14px;font-size:13px}
        .bk-life{display:flex;gap:16px;align-items:center;margin-bottom:16px}.bk-grid{display:grid;grid-template-columns:repeat(15,8px);gap:3px}.bk-grid i{width:8px;height:8px;border-radius:2px;background:var(--hover)}.bk-grid i.past{background:color-mix(in srgb,var(--text) 55%,transparent)}.bk-grid i.now{background:#e5484d}
        .bk-txt{font-size:13px;color:var(--muted)}.bk-txt b{display:block;font:900 34px/1 ui-rounded,system-ui;color:var(--text)}
        .bk-add{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}.bk-add #bk-t{flex:1;min-width:220px}.bk-add select{width:auto}
        .bk-it{display:grid;grid-template-columns:auto 1fr auto auto;gap:12px;align-items:center;padding:10px 4px;border-bottom:1px solid var(--line)}.bk-it b{display:block;font-size:14px}.bk-it span{font-size:12px;color:var(--muted)}
        .bk-it em{font-style:normal;font-size:12px;font-weight:700;color:var(--muted)}.bk-it.hot em{color:#e5484d}.bk-it.done b{text-decoration:line-through;opacity:.6}
        .bk-chk{width:22px;height:22px;border-radius:50%;border:1.5px solid var(--line);background:none;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff}.bk-it.done .bk-chk{background:#22a06b;border-color:#22a06b}.bk-chk svg{width:13px;height:13px}
        .bk-x{background:none;border:0;color:var(--muted);cursor:pointer;opacity:0}.bk-it:hover .bk-x{opacity:1}.bk-x svg{width:14px;height:14px}`);
    },
  });
})();
