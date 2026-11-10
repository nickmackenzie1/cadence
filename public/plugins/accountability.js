/* Stakes and accountability:
   - Grandma mode: overdue work earns a disappointed-grandparent guilt trip. Can read it out loud.
   - Stakes (shame escrow): put money on a task. Miss it and you owe it to a cause you can't stand. Cadence never
     holds money; it keeps the pledge and links you to pay (or to Beeminder / stickK for real enforcement).
   - Public ledger: posts your oldest overdue tasks to a Zoho Cliq channel (webhook token kept on the NAS). */
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const css = (id, text) => { if (document.getElementById(id)) return; const s = document.createElement('style'); s.id = id; s.textContent = text; document.head.appendChild(s); };
  const DAY = 864e5;
  const overdue = api => { const t0 = api.util.todayKey(); return api.tasks.list(t => !t.done && t.owner !== 'client' && t.dueDate && t.dueDate < t0).map(t => ({ t, days: Math.round((new Date(t0) - new Date(t.dueDate)) / DAY) })).sort((a, b) => b.days - a.days); };

  /* ======================= Grandma mode ======================= */
  const LINES = [
    "I'm not mad. I just thought you'd have {t} done by now. It's been {d}.",
    "Your cousin finished all of hers. Anyway. How's {t} coming along?",
    "I made soup. You can have some when {t} is done. {d} late, dear.",
    "Don't mind me, I'll just sit here and wait for {t}. I've been waiting {d}.",
    "When I was your age we did {t} the same day. Uphill. Both ways.",
    "I'm not going to say anything about {t}. I'm just going to look at you.",
    "{t}? Still? Oh, sweetheart.",
    "I told the neighbours you were very busy. Don't make me a liar about {t}.",
    "You know what would make me happy? {t}. That's all. That's the whole list.",
    "I'll be 90 next year. Do {t} while I can still see it.",
  ];
  Cadence.registerPlugin({
    id: 'grandma', name: 'Grandma mode', version: '1.0.0', category: 'Fun', spaces: ['work', 'life'],
    description: 'When work goes overdue, a disappointed grandparent drops by with a guilt trip about the oldest one. Optional: she says it out loud.',
    tagline: 'I’m not mad, I’m just disappointed', color: '#be185d',
    icon: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/><path d="M9.5 8h.01M14.5 8h.01M10 10.5c1 .7 3 .7 4 0"/>',
    settings() { window.__grandma && window.__grandma.settings(); },
    setup(api) {
      const cfg = () => Object.assign({ every: 'twice', voice: false, name: 'Grandma' }, api.storage.get('cfg') || {});
      const GAP = { daily: 20 * 36e5, twice: 5 * 36e5, nag: 2 * 36e5 };
      function visit(force) {
        const od = overdue(api); if (!od.length) return false; const c = cfg(), last = +(localStorage.getItem('cadence.grandma') || 0);
        if (!force && Date.now() - last < GAP[c.every]) return false;
        localStorage.setItem('cadence.grandma', Date.now());
        const pick = od[Math.floor(Math.random() * Math.min(3, od.length))], line = LINES[Math.floor(Math.random() * LINES.length)].replace('{t}', `“${pick.t.title}”`).replace('{d}', pick.days === 1 ? 'a whole day' : pick.days + ' days');
        const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
        api.island.show({ icon: '👵', color: '#be185d', title: `${c.name} says:`, sub: cap(line), ms: 11000, log: false, actions: [{ label: 'Okay, Grandma', run: () => { api.ui.navigate(pick.t.clientId ? 'client-' + pick.t.clientId : 'today'); setTimeout(() => api.ui.openTask(pick.t.id), 80); } }] });
        if (c.voice && 'speechSynthesis' in window) { try { const u = new SpeechSynthesisUtterance(line.replace(/[“”]/g, '')); u.rate = .88; u.pitch = 1.25; const v = speechSynthesis.getVoices().find(v => /female|samantha|victoria|karen|moira|fiona/i.test(v.name)); if (v) u.voice = v; speechSynthesis.speak(u); } catch (e) {} }
        return line;
      }
      window.__grandma = { visit, settings: () => {
        const c = cfg();
        api.ui.modal('Grandma mode', `<div class="field"><label>Her name</label><input class="inp" id="gm-n" value="${esc(c.name)}"></div>
          <div class="field"><label>How often she drops by (only when something’s overdue)</label><div class="seg" id="gm-e">${[['daily', 'Once a day'], ['twice', 'A few times a day'], ['nag', 'Every two hours']].map(([v, l]) => `<button data-v="${v}" class="${c.every === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
          <label class="xm-row"><input type="checkbox" id="gm-v" ${c.voice ? 'checked' : ''}> Say it out loud</label>`, '<button class="btn" id="gm-try" style="margin-right:auto">Visit now</button><button class="btn primary" id="gm-ok">Done</button>');
        let every = c.every; document.querySelectorAll('#gm-e button').forEach(b => b.onclick = () => { every = b.dataset.v; document.querySelectorAll('#gm-e button').forEach(x => x.classList.toggle('on', x === b)); });
        const read = () => ({ name: document.getElementById('gm-n').value.trim().slice(0, 30) || 'Grandma', every, voice: document.getElementById('gm-v').checked });
        document.getElementById('gm-try').onclick = () => { api.storage.set('cfg', read()); if (!visit(true)) api.ui.toast('Nothing overdue. She’s very proud of you.'); };
        document.getElementById('gm-ok').onclick = () => { api.storage.set('cfg', read()); api.ui.close(); };
      } };
      api.commands.add({ title: 'Grandma, come over', hint: 'Grandma mode', run: () => { if (!visit(true)) api.ui.toast('Nothing overdue. She’s very proud of you.'); } });
      clearInterval(window.__gmIv); window.__gmIv = setInterval(() => visit(false), 10 * 60e3); setTimeout(() => visit(false), 20000);
    },
  });

  /* ======================= Stakes ======================= */
  Cadence.registerPlugin({
    id: 'stakes', name: 'Stakes', version: '1.0.0', category: 'Fun', spaces: ['work', 'life'],
    description: 'Put money on a task. Miss the date and you owe it to a cause you can’t stand. Cadence never touches money: it keeps the pledge and gives you the link to pay. For real enforcement, pair it with Beeminder or stickK.',
    tagline: 'Money where your mouth is', color: '#15803d',
    icon: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    setup(api) {
      const money = n => '$' + (+n).toLocaleString();
      function stake(t) {
        const s = t.stake || {};
        api.ui.modal('Put a stake on it', `<p class="muted" style="margin:0 0 10px;font-size:13px">If “${esc(t.title)}” isn’t done by ${t.dueDate ? esc(api.util.fmtDate(t.dueDate)) : 'its due date'}, you pay. Honour system, unless you set it up in Beeminder or stickK too.</p>
          <div class="row" style="gap:8px"><div class="field" style="flex:0 0 120px"><label>Amount</label><input class="inp" id="sk-a" type="number" min="1" value="${esc(s.amount || 20)}"></div><div class="field" style="flex:1"><label>Goes to (a cause you’d hate to fund)</label><input class="inp" id="sk-c" value="${esc(s.cause || '')}" placeholder="The other team’s fan club"></div></div>
          <div class="field"><label>Payment link (optional)</label><input class="inp" id="sk-u" value="${esc(s.url || '')}" placeholder="https://…"></div>
          ${!t.dueDate ? '<div class="field"><label>Deadline</label><input class="inp" type="date" id="sk-d"></div>' : ''}
          <div class="muted" style="font-size:12px">Want it enforced for real? <a href="https://www.beeminder.com" target="_blank" rel="noopener">Beeminder</a> · <a href="https://www.stickk.com" target="_blank" rel="noopener">stickK</a></div>`,
          `${s.amount ? '<button class="btn" id="sk-off" style="margin-right:auto">Remove stake</button>' : ''}<button class="btn primary" id="sk-ok">Stake it</button>`);
        const $ = id => document.getElementById(id);
        $('sk-off') && ($('sk-off').onclick = () => { api.tasks.update(t.id, { stake: null }); api.ui.close(); });
        $('sk-ok').onclick = () => { const amount = Math.max(1, +$('sk-a').value || 0), cause = $('sk-c').value.trim(); if (!cause) return $('sk-c').focus();
          const due = t.dueDate || ($('sk-d') && $('sk-d').value); if (!due) return $('sk-d').focus();
          api.tasks.update(t.id, { stake: { amount, cause: cause.slice(0, 120), url: /^https?:\/\//.test($('sk-u').value.trim()) ? $('sk-u').value.trim() : '', at: Date.now(), status: 'live' }, ...(t.dueDate ? {} : { dueDate: due }) });
          api.ui.close(); api.island.show({ icon: '💵', color: '#15803d', title: `${money(amount)} on the line`, sub: `Miss it and it goes to ${cause}` }); };
      }
      api.taskActions.add({ label: 'Put a stake on it…', run: t => stake(t) });
      api.chips.add((t, preview) => !preview && t.stake && t.stake.status === 'live' && !t.done ? `<span class="chip sk-chip" title="Miss it and ${esc(money(t.stake.amount))} goes to ${esc(t.stake.cause)}">${api.ui.icon('wallet')}${esc(money(t.stake.amount))} at stake</span>` : '');
      api.on('task:complete', t => { if (t.stake && t.stake.status === 'live') { api.tasks.update(t.id, { stake: { ...t.stake, status: 'safe' } }); api.island.celebrate({ icon: '💵', title: `${money(t.stake.amount)} saved`, sub: `${t.stake.cause} gets nothing from you today` }); } });
      function judge() {
        const t0 = api.util.todayKey();
        for (const t of api.tasks.list(x => x.stake && x.stake.status === 'live' && !x.done && x.dueDate && x.dueDate < t0)) {
          api.tasks.update(t.id, { stake: { ...t.stake, status: 'lost', lostAt: Date.now() } });
          api.notify({ title: `You owe ${money(t.stake.amount)} to ${t.stake.cause}`, body: `“${t.title}” missed its date`, taskId: t.id });
          api.ui.modal('A deal’s a deal', `<p style="font-size:14px;margin:0 0 8px">“${esc(t.title)}” wasn’t done by ${esc(api.util.fmtDate(t.dueDate))}.</p><p style="font-size:22px;font-weight:800;margin:0 0 8px">You owe ${esc(money(t.stake.amount))} to ${esc(t.stake.cause)}.</p><p class="muted" style="font-size:12.5px;margin:0">Next time, stake less or plan more.</p>`,
            `${t.stake.url ? `<a class="btn primary" href="${esc(t.stake.url)}" target="_blank" rel="noopener">Pay up</a>` : ''}<button class="btn" data-act="close-modal">I’ll pay</button>`);
          break;
        }
      }
      window.__stakes = { stake, judge };
      setTimeout(judge, 5000); clearInterval(window.__skIv); window.__skIv = setInterval(judge, 30 * 60e3);
      css('sk-css', `.sk-chip{color:#15803d;font-weight:600}.sk-chip svg{width:12px;height:12px;margin-right:3px}`);
    },
  });

  /* ======================= Public ledger (Zoho Cliq) ======================= */
  Cadence.registerPlugin({
    id: 'ledger', name: 'Public ledger', version: '1.0.0', category: 'Fun', spaces: ['work'],
    description: 'Posts your three oldest overdue tasks to a Zoho Cliq channel every day, so your team can see them. Uses a channel webhook token that stays on the NAS.',
    tagline: 'Your overdue list, in Cliq', color: '#0891b2',
    icon: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>',
    settings() { window.__ledger && window.__ledger.settings(); },
    setup(api) {
      const cfg = () => Object.assign({ on: false, at: '09:15', name: '' }, api.storage.get('cfg') || {});
      const text = () => { const od = overdue(api).slice(0, 3), who = cfg().name || 'Me'; if (!od.length) return `${who} has nothing overdue today. Clean slate.`;
        return `*${who}'s public ledger*: the oldest overdue items\n` + od.map((x, i) => `${i + 1}. ${x.t.title} (${x.days} day${x.days === 1 ? '' : 's'} overdue)`).join('\n') + `\nHold me to it.`; };
      async function post(manual) {
        const r = await fetch('api/cliq/post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text() }) }).catch(() => null);
        const j = r ? await r.json().catch(() => ({})) : {};
        if (r && r.ok) { api.storage.set('last', new Date().toDateString()); if (manual) api.ui.toast('Posted to Cliq'); return true; }
        if (manual) { api.ui.copy(text()); api.ui.toast((j.error || 'Could not reach Cliq') + '. The text is on your clipboard instead.'); } return false;
      }
      function tick() { const c = cfg(); if (!c.on || api.storage.get('last') === new Date().toDateString()) return; const [h, m] = c.at.split(':').map(Number), now = new Date(); if (now.getHours() * 60 + now.getMinutes() >= h * 60 + m) post(false); }
      window.__ledger = { text, post, settings: async () => {
        const c = cfg(); let srv = {}; try { srv = await (await fetch('api/cliq/config')).json(); } catch (e) {}
        api.ui.modal('Public ledger · Zoho Cliq', `<label class="xm-row"><input type="checkbox" id="lg-on" ${c.on ? 'checked' : ''}> Post my oldest overdue tasks every day at <input class="inp" type="time" id="lg-at" value="${esc(c.at)}" style="width:auto;display:inline-block"></label>
          <div class="field"><label>Your name in the post</label><input class="inp" id="lg-name" value="${esc(c.name)}" placeholder="Nick"></div>
          <div class="field"><label>Cliq channel unique name</label><input class="inp" id="lg-ch" value="${esc(srv.channel || '')}" placeholder="team-standup"></div>
          <div class="row" style="gap:8px"><div class="field" style="flex:1"><label>Webhook token (zapikey)</label><input class="inp" id="lg-key" type="password" placeholder="${srv.hasKey ? 'Saved on the NAS. Paste to replace.' : 'From Cliq: Bots & Tools → Webhook tokens'}"></div>
          <div class="field" style="flex:0 0 150px"><label>Zoho data centre</label><select class="inp" id="lg-dc">${[['com', '.com (US)'], ['ca', 'Canada'], ['eu', 'EU'], ['in', 'India'], ['au', 'Australia'], ['jp', 'Japan'], ['sa', 'Saudi Arabia']].map(([v, l]) => `<option value="${v}" ${(srv.dc || 'com') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
          <div class="muted" style="font-size:12px">The token is sent to your NAS and never comes back to the browser. Preview of today’s post:</div><pre class="lg-pre">${esc(text())}</pre>`,
          '<button class="btn" id="lg-test" style="margin-right:auto">Post now</button><button class="btn primary" id="lg-ok">Save</button>');
        const $ = id => document.getElementById(id);
        const save = async () => { api.storage.set('cfg', { on: $('lg-on').checked, at: $('lg-at').value || '09:15', name: $('lg-name').value.trim().slice(0, 40) });
          await fetch('api/cliq/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: $('lg-ch').value.trim(), dc: $('lg-dc').value, zapikey: $('lg-key').value.trim() || undefined }) }).catch(() => {}); };
        $('lg-ok').onclick = async () => { await save(); api.ui.close(); api.ui.toast('Saved'); };
        $('lg-test').onclick = async () => { await save(); post(true); };
      } };
      api.commands.add({ title: 'Post my overdue list to Cliq', hint: 'Public ledger', run: () => post(true) });
      api.commands.add({ title: 'Copy my public ledger', run: () => { api.ui.copy(text()); api.ui.toast('Copied'); } });
      clearInterval(window.__lgIv); window.__lgIv = setInterval(tick, 5 * 60e3); setTimeout(tick, 15000);
      css('lg-css', `.lg-pre{white-space:pre-wrap;background:var(--hover);border-radius:10px;padding:10px;font:12.5px/1.45 var(--mono,monospace);margin:6px 0 0}`);
    },
  });
})();
