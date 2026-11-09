/* The intern: a tiny pixel character in the sidebar who carries everything your clients owe you,
   one box per item. He walks slower as things get older, falls asleep when a client is slow,
   and wakes you up (on the Island) to chase them. Click him for the list. */
Cadence.registerPlugin({
  id: 'intern', name: 'The intern', version: '1.0.0', category: 'Fun',
  description: 'A pixel intern in the sidebar carries one box for every item a client owes you. He slows down as they get old, falls asleep when a client takes too long, and wakes you up to chase them.',
  tagline: 'Carries what clients owe you', color: '#c2771c',
  icon: '<rect x="7" y="3" width="10" height="7" rx="1"/><path d="M8 10v4h8v-4M9 14v6M15 14v6"/>',
  settings(api) {
    const name = api.storage.get('name') || 'Pixel', slow = api.storage.get('slow') || 5;
    api.ui.modal('The intern', `<div class="field"><label>Name</label><input class="inp" id="in-name" value="${api.ui.esc(name)}" maxlength="20"></div>
      <div class="field"><label>Falls asleep when a client has owed you something for</label><select class="inp" id="in-slow">${[2, 3, 5, 7, 10, 14].map(d => `<option value="${d}" ${d === slow ? 'selected' : ''}>${d} days</option>`).join('')}</select></div>`,
      `<button class="btn primary" id="in-save">Save</button>`);
    document.getElementById('in-save').onclick = () => { api.storage.set('name', document.getElementById('in-name').value.trim().slice(0, 20) || 'Pixel'); api.storage.set('slow', +document.getElementById('in-slow').value); api.ui.close(); api.ui.refreshWidgets(); };
  },
  setup(api) {
    const I = window.__intern = window.__intern || {};
    if (!document.getElementById('in-css')) {
      const st = document.createElement('style'); st.id = 'in-css';
      st.textContent = `
        .in-w{padding:4px 6px 6px;cursor:pointer;border-radius:10px}
        .in-w:hover{background:var(--hover)}
        .in-stage{position:relative;height:66px;border-bottom:2px solid var(--line);overflow:hidden}
        .in-guy{position:absolute;bottom:0;left:0;width:36px;transition:none}
        .in-guy svg{display:block;width:36px;image-rendering:pixelated;overflow:visible}
        .in-guy.asleep svg{transform:rotate(14deg);transform-origin:80% 100%;animation:inbreathe 3s ease-in-out infinite}
        @keyframes inbreathe{50%{scale:1 .96}}
        .in-guy.jump{animation:injump .5s cubic-bezier(.3,1.6,.5,1) 2}
        @keyframes injump{50%{translate:0 -14px}}
        .in-z{position:absolute;font:700 11px var(--mono);color:var(--accent);opacity:0;animation:inz 2.4s linear infinite}
        .in-z:nth-child(2){animation-delay:.8s;font-size:13px}.in-z:nth-child(3){animation-delay:1.6s;font-size:15px}
        @keyframes inz{0%{opacity:0;transform:translate(0,0)}20%{opacity:1}100%{opacity:0;transform:translate(14px,-30px)}}
        .in-pile{position:absolute;bottom:0;display:flex;flex-direction:column-reverse;align-items:center}
        .in-box{width:14px;height:10px;background:#c8955a;border:1px solid #8a5a2b;box-shadow:inset 0 3px 0 -2px #e2b886;margin-top:-1px;position:relative}
        .in-box::after{content:'';position:absolute;left:5px;top:0;width:2px;height:100%;background:#e9d8b4}
        .in-box.old{background:#b07a46;filter:saturate(.6)}
        .in-tx{font-size:12px;color:var(--muted);margin-top:5px;line-height:1.35}
        .in-tx b{color:var(--text);font-weight:600}
        .in-tx .zz{color:var(--client)}
        .in-list{display:grid;gap:12px}
        .in-cl{border:1px solid var(--line);border-radius:12px;padding:10px 12px}
        .in-cl h4{margin:0 0 6px;display:flex;align-items:center;justify-content:space-between;font-size:14px}
        .in-cl li{font-size:13px;color:var(--text);margin:3px 0}
        .in-cl li small{color:var(--muted);margin-left:6px}
        .in-cl ul{margin:0;padding-left:18px}
        .in-cl li.stale small{color:var(--danger);font-weight:600}
      `;
      document.head.appendChild(st);
    }
    api.sidebar.add({ id: 'intern', slot: 'bottom', order: 22, render: el => draw(el) });
    api.commands.add({ title: 'Ask the intern what clients owe you', run: () => list() });
    api.on('task:complete', t => {
      if (t.owner !== 'client') return;
      const c = t.clientId && api.clients.get(t.clientId);
      api.island.show({ icon: '📦', color: '#c2771c', title: `${name()}: one less box!`, sub: `${c ? c.name + ' delivered ' : ''}“${t.title}”`, ms: 4200 });
      I.jump = Date.now();
    });
    for (const ev of ['task:add', 'task:update', 'task:complete', 'task:reopen', 'task:remove', 'sync']) api.on(ev, () => { clearTimeout(I.rt); I.rt = setTimeout(() => api.ui.refreshWidgets(), 250); });
    clearInterval(I.wake); I.wake = setInterval(() => wake(), 15 * 60e3); setTimeout(() => wake(), 6000);

    const name = () => api.storage.get('name') || 'Pixel';
    const slow = () => api.storage.get('slow') || 5;
    const age = t => Math.floor((Date.now() - Math.max(t.createdAt || 0, t.lastChased || 0)) / 864e5);
    function owed() {
      const items = api.tasks.list(t => !t.done && t.owner === 'client' && t.clientId).map(t => ({ t, age: age(t) })).sort((a, b) => b.age - a.age);
      const by = new Map(); for (const x of items) { const k = x.t.clientId; if (!by.has(k)) by.set(k, []); by.get(k).push(x); }
      return { items, by, oldest: items[0] || null };
    }

    // 12×15 pixel sprite. h hair, s skin, e eye, k closed eye, w shirt, t tie, p pants, b shoes, m mug
    const PAL = { h: '#3b2a20', s: '#f2c39b', e: '#1d1c1a', k: '#7a4a32', w: '#ffffff', t: '#d4533b', p: '#2f3a5c', b: '#1d1c1a', m: '#5b5bd6' };
    const HEAD = ['....hhhh....', '...hhhhhh...', '...hsssss...', '...sesses...', '...ssssss...', '....ssss....'];
    const SLEEPY = ['....hhhh....', '...hhhhhh...', '...hsssss...', '...skssks...', '...ssssss...', '....ssss....'];
    const CARRY_HEAD = ['..s.hhhh.s..', '..shhhhhhs..', '..shsssssw..', '..wsessesw..', '..wssssssw..', '..w.ssss.w..'];
    const BODY = ['..wwwttwww..', '.swwwttwwws.', '.swwwwtwwws.', '..wwwwwwww..', '..pppppppp..', '..ppp..ppp..', '..ppp..ppp..'];
    const BODY_C = ['..wwwttwww..', '..wwwttwww..', '..wwwwtwww..', '..wwwwwwww..', '..pppppppp..', '..ppp..ppp..', '..ppp..ppp..'];
    const BODY_M = ['..wwwttwww..', '.swwwttwwsm.', '.swwwwtwwwm.', '..wwwwwwww..', '..pppppppp..', '..ppp..ppp..', '..ppp..ppp..'];
    const LEGS = [['..pp....pp..', '.bbb....bbb.'], ['...pp..pp...', '..bbb..bbb..']];
    const sprite = rows => `<svg viewBox="0 0 12 15" shape-rendering="crispEdges">${rows.map((r, y) => [...r].map((ch, x) => PAL[ch] ? `<rect x="${x}" y="${y}" width="1" height="1" fill="${PAL[ch]}"/>` : '').join('')).join('')}</svg>`;
    const frame = (state, f) => sprite([...(state === 'carry' ? CARRY_HEAD : state === 'asleep' ? SLEEPY : HEAD), ...(state === 'carry' ? BODY_C : state === 'coffee' ? BODY_M : BODY), ...LEGS[state === 'carry' ? f % 2 : 1]]);

    function draw(el) {
      const o = owed(), E = api.ui.esc, n = o.items.length;
      const sleeping = o.oldest && o.oldest.age >= slow();
      const state = !n ? 'coffee' : sleeping ? 'asleep' : 'carry';
      const boxes = Math.min(6, n), stale = o.oldest ? o.oldest.age : 0;
      const oc = o.oldest && api.clients.get(o.oldest.t.clientId);
      const tx = !n ? `<b>${E(name())}</b> has nothing to carry. Coffee break.`
        : sleeping ? `<span class="zz"><b>${E(name())}</b> fell asleep waiting on ${E(oc ? oc.name : 'a client')}</span> (${stale}d). Click to wake him.`
        : `<b>${E(name())}</b> is carrying ${n} item${n === 1 ? '' : 's'} for ${o.by.size} client${o.by.size === 1 ? '' : 's'}${stale ? ` · oldest ${stale}d` : ''}`;
      el.innerHTML = `<div class="in-w" title="What clients owe you"><div class="in-stage"><div class="in-guy ${state === 'asleep' ? 'asleep' : ''}">${frame(state, 0)}</div>${state === 'asleep' ? `<div class="in-pile" style="left:58px">${'<i class="in-box old"></i>'.repeat(boxes)}</div><div class="in-zs" style="position:absolute;left:52px;bottom:46px"><span class="in-z">z</span><span class="in-z">z</span><span class="in-z">Z</span></div>` : ''}</div><div class="in-tx">${tx}</div></div>`;
      const guy = el.querySelector('.in-guy'), stage = el.querySelector('.in-stage');
      if (state === 'carry') { const pile = document.createElement('div'); pile.className = 'in-pile'; pile.style.cssText = 'position:absolute;bottom:45px;left:11px'; pile.innerHTML = Array.from({ length: boxes }, (_, i) => `<i class="in-box ${o.items[i] && o.items[i].age >= slow() - 1 ? 'old' : ''}"></i>`).join(''); guy.appendChild(pile); }
      if (I.jump && Date.now() - I.jump < 3000) { guy.classList.add('jump'); I.jump = 0; }
      el.firstChild.onclick = () => { if (state === 'asleep') { guy.classList.remove('asleep'); guy.classList.add('jump'); setTimeout(() => chase(oc), 450); } else list(); };
      // walk: slower as the oldest item ages; coffee break = stands still
      clearInterval(I.walk);
      if (state !== 'carry' || api.ui.reducedMotion()) { guy.style.left = state === 'asleep' ? '24px' : '40%'; return; }
      let x = I.x || 10, dir = I.dir || 1, f = 0; const speed = Math.max(0.35, 1.6 - stale * 0.18);
      I.walk = setInterval(() => {
        if (!guy.isConnected) return clearInterval(I.walk);
        if (document.hidden) return;
        const max = stage.clientWidth - 40; x += dir * speed; if (x > max || x < 4) { dir *= -1; x = Math.max(4, Math.min(max, x)); }
        I.x = x; I.dir = dir; f++;
        guy.style.left = x + 'px'; guy.style.transform = dir < 0 ? 'scaleX(-1)' : '';
        if (f % 6 === 0) guy.querySelector('svg').outerHTML = frame('carry', f / 6);
      }, 50);
    }

    function chase(c) {
      if (c && window.CadenceChase) return window.CadenceChase.chase(c);
      if (c) return api.ui.navigate('client-' + c.id);
      list();
    }
    function list() {
      const o = owed(), E = api.ui.esc;
      if (!o.items.length) return api.island.show({ icon: '☕', color: '#c2771c', title: `${name()}: nothing to carry`, sub: 'No client owes you anything right now', ms: 3500 });
      api.ui.modal(`${E(name())}'s boxes`, `<p style="color:var(--muted);margin:0 0 12px">Everything your clients owe you, oldest first. Age counts from when it was added or last chased.</p><div class="in-list">${[...o.by.entries()].map(([cid, xs]) => {
        const c = api.clients.get(cid) || { name: 'Unknown', id: cid };
        return `<div class="in-cl"><h4>${E(c.name)}<button class="btn" data-chase="${E(cid)}">Chase</button></h4><ul>${xs.map(x => `<li class="${x.age >= slow() ? 'stale' : ''}">${E(x.t.title)}<small>${x.age ? x.age + 'd' : 'today'}${x.t.lastChased ? ' · chased' : ''}</small></li>`).join('')}</ul></div>`;
      }).join('')}</div>`, `<button class="btn" data-act="close-modal">Close</button>`);
      document.querySelectorAll('[data-chase]').forEach(b => b.onclick = () => { api.ui.close(); chase(api.clients.get(b.dataset.chase)); });
    }
    // wake you up: once a day per slow client
    function wake() {
      if (api.system().demo || !api.plugins.enabled('intern')) return;
      const o = owed(), seen = api.storage.get('woke') || {}, today = api.util.todayKey();
      for (const [cid, xs] of o.by) {
        if (xs[0].age < slow() || seen[cid] === today) continue;
        const c = api.clients.get(cid); if (!c) continue;
        seen[cid] = today; api.storage.set('woke', seen);
        api.island.show({ icon: '⏰', color: '#c2771c', title: `${name()} woke up: chase ${c.name}?`, sub: `“${xs[0].t.title}” · ${xs[0].age} days${xs.length > 1 ? ` · +${xs.length - 1} more` : ''}`,
          actions: [{ label: 'Chase', run: () => chase(c) }, { label: 'Later', run: () => {} }], sticky: true });
        return;   // one wake-up at a time
      }
    }
  }
});
