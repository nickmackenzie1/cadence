/* Inbox scanner (Life): paste an email (or drop the .eml file) from school, the hockey club, swim lessons… and get a
   short recap, the action items, and the dates worth putting in the calendar. Rule-based, works with no AI; with AI
   on the NAS there's a "Tidy with AI" pass. (Reading a mailbox directly comes later; credentials would live on the NAS.) */
(() => {
  const esc = window.CadenceKit.esc;
  const css = window.CadenceKit.css;
  const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
  const WD = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };
  const CATS = [['School', /\b(school|teacher|class|classroom|grade \d|principal|field trip|report card|homework|pta|parent council|kindergarten|lunch program)\b/i],
    ['Sports', /\b(hockey|soccer|swim|practice|tournament|game|coach|team|rink|arena|jersey|skate|dance|gymnastics|karate|baseball|basketball)\b/i],
    ['Programs', /\b(camp|program|registration|register|session|lessons|workshop|club|library|recreation|rec centre)\b/i],
    ['Health', /\b(doctor|dentist|clinic|appointment|vaccin|prescription|pharmacy)\b/i]];
  const ACT = /\b(please|remember to|don['’]t forget|must|need to|needs to|required|deadline|due|sign(ed)?|return|bring|register|rsvp|pay|payment|submit|complete|fill out|permission|consent|by (monday|tuesday|wednesday|thursday|friday|\w+ \d))\b/i;
  function parseEml(raw) {
    const [head, ...rest] = raw.split(/\r?\n\r?\n/); const h = k => ((head.match(new RegExp('^' + k + ':\\s*(.+(?:\\r?\\n\\s+.+)*)', 'im')) || [])[1] || '').replace(/\r?\n\s+/g, ' ');
    let body = rest.join('\n\n'); const b = (head.match(/boundary="?([^";\r\n]+)/i) || [])[1];
    if (b) { const parts = body.split('--' + b); const pl = parts.find(p => /content-type:\s*text\/plain/i.test(p)) || parts.find(p => /content-type:\s*text\/html/i.test(p)) || parts[1] || ''; const [ph, ...pb] = pl.split(/\r?\n\r?\n/); body = pb.join('\n\n'); if (/quoted-printable/i.test(ph)) body = qp(body); if (/base64/i.test(ph)) try { body = decodeURIComponent(escape(atob(body.replace(/\s+/g, '')))); } catch (e) {} if (/text\/html/i.test(ph)) body = body.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, ' '); }
    else if (/quoted-printable/i.test(head)) body = qp(body);
    return { subject: h('Subject'), from: h('From'), date: h('Date'), body };
  }
  const qp = s => s.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (m, x) => String.fromCharCode(parseInt(x, 16)));
  function dates(text, base = new Date()) {
    const out = [], y0 = base.getFullYear(), sentences = text.replace(/^\s*(hi|hello|hey|dear|good (morning|afternoon|evening))\b[^\n,!]*[,!]?\s*\n/i, '').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z])/);
    for (const s of sentences) {
      let d = null, m;
      if ((m = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/i))) d = new Date(+(m[3] || y0), MON[m[1].toLowerCase().slice(0, 4) === 'sept' ? 'sept' : m[1].toLowerCase().slice(0, 3)], +m[2]);
      else if ((m = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*/i))) d = new Date(y0, MON[m[2].toLowerCase().slice(0, 3)], +m[1]);
      else if ((m = s.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) { const yy = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : y0; d = new Date(yy, +m[1] - 1, +m[2]); }
      else if ((m = s.match(/\b(?:this|next|on)?\s*(sun|mon|tues?|wed|thur?s?|fri|sat)[a-z]*day\b/i))) { const w = WD[m[1].toLowerCase()]; d = new Date(base); d.setHours(0, 0, 0, 0); let k = (w - d.getDay() + 7) % 7 || 7; if (/next/i.test(m[0]) && k < 7) k += 7; d.setDate(d.getDate() + k); }
      else if (/\btomorrow\b/i.test(s)) { d = new Date(base); d.setDate(d.getDate() + 1); }
      if (!d || isNaN(d)) continue;
      if (!/\d{4}/.test(s) && d < new Date(base.getFullYear(), base.getMonth(), base.getDate() - 30)) d.setFullYear(d.getFullYear() + 1);
      const tm = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/i); let time = null;
      if (tm) { let h = +tm[1] % 12; if (/p/i.test(tm[3])) h += 12; time = String(h).padStart(2, '0') + ':' + (tm[2] || '00'); }
      out.push({ date: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), time, text: s.trim().slice(0, 220) });
    }
    return out.slice(0, 12);
  }
  function scan(mail) {
    const body = mail.body.replace(/\r/g, '').replace(/\n>.*$/gm, '').split(/\n-- \n|\nSent from my|\nOn .+ wrote:/)[0];
    const all = `${mail.subject}\n${body}`, cat = (CATS.find(([, re]) => re.test(all)) || ['Other'])[0];
    const sents = body.replace(/^\s*(hi|hello|hey|dear|good (morning|afternoon|evening))\b[^\n,!]*[,!]?\s*\n/i, '').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 20 && !/^(hi|hello|dear|good (morning|afternoon)|thanks|thank you|regards|best|cheers|sincerely)\b/i.test(s));
    const actions = sents.filter(s => ACT.test(s)).slice(0, 8).map(s => { const ds = dates(s); return { text: s.replace(/^(please|also|and|just a reminder( that)?|reminder:?)\s*,?\s*/i, '').replace(/^./, c => c.toUpperCase()).slice(0, 200), date: ds[0] && ds[0].date, time: ds[0] && ds[0].time }; });
    const events = dates(body).filter(e => !actions.some(a => a.text && e.text.includes(a.text.slice(5, 40))));
    return { cat, recap: sents.filter(s => !ACT.test(s)).slice(0, 2).join(' ').slice(0, 320) || sents.slice(0, 2).join(' ').slice(0, 320), actions, events };
  }
  window.__scanMail = { scan, parseEml, dates };

  Cadence.registerPlugin({
    id: 'inbox-scan', name: 'Inbox scanner', version: '1.0.0', category: 'Life', spaces: ['life', 'work'],
    description: 'Paste an email from school, sports or a program (or drop the .eml) and get a short recap, the action items and the dates, ready to add as tasks.',
    tagline: 'School and club emails, boiled down', color: '#2563eb',
    icon: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    setup(api) {
      const hist = () => api.storage.get('hist') || [];
      function render(el, res, mail) {
        const area = api.clients.list().find(c => c.name.toLowerCase() === (res.cat === 'Sports' || res.cat === 'School' || res.cat === 'Programs' ? 'family' : res.cat.toLowerCase()));
        el.innerHTML = `<div class="is-res"><div class="is-h"><span class="is-cat">${esc(res.cat)}</span><b>${esc(mail.subject || 'Email')}</b>${mail.from ? `<em>${esc(mail.from.replace(/<.*>/, '').trim())}</em>` : ''}</div>
          ${res.recap ? `<p class="is-recap">${esc(res.recap)}</p>` : ''}
          ${res.actions.length ? `<div class="sect">Action items</div>${res.actions.map((a, i) => `<label class="is-it"><input type="checkbox" data-a="${i}" checked><span>${esc(a.text)}</span>${a.date ? `<em>${esc(api.util.fmtDate(a.date))}${a.time ? ' · ' + esc(api.util.fmtTime(a.time)) : ''}</em>` : ''}</label>`).join('')}` : ''}
          ${res.events.length ? `<div class="sect">Dates</div>${res.events.map((e, i) => `<label class="is-it"><input type="checkbox" data-e="${i}" ${res.actions.length ? '' : 'checked'}><span>${esc(e.text)}</span><em>${esc(api.util.fmtDate(e.date))}${e.time ? ' · ' + esc(api.util.fmtTime(e.time)) : ''}</em></label>`).join('')}` : ''}
          ${!res.actions.length && !res.events.length ? '<p class="muted">Nothing to do in this one. Probably safe to archive.</p>' : `<div class="is-go"><button class="btn primary" id="is-add">Add selected as tasks</button>${area ? `<span class="muted">to ${esc(area.name)}</span>` : ''}${api.ai ? '<button class="btn" id="is-ai">Tidy with AI</button>' : ''}</div>`}</div>`;
        const $ = id => el.querySelector('#' + id);
        $('is-add') && ($('is-add').onclick = () => { let n = 0;
          el.querySelectorAll('[data-a]:checked').forEach(c => { const a = res.actions[+c.dataset.a]; api.tasks.add({ title: a.text.replace(/\.$/, '').slice(0, 140), dueDate: a.date || null, dueTime: a.time || null, clientId: area ? area.id : null, notes: `From: ${mail.subject}`, tags: [res.cat.toLowerCase()] }); n++; });
          el.querySelectorAll('[data-e]:checked').forEach(c => { const e = res.events[+c.dataset.e]; api.tasks.add({ title: e.text.replace(/\.$/, '').slice(0, 140), dueDate: e.date, dueTime: e.time, clientId: area ? area.id : null, notes: `From: ${mail.subject}`, tags: [res.cat.toLowerCase(), 'event'] }); n++; });
          api.ui.toast(`${n} task${n === 1 ? '' : 's'} added`); });
        $('is-ai') && ($('is-ai').onclick = async () => { $('is-ai').textContent = 'Thinking…'; try { const j = await api.ai.json(`From this email, return JSON {recap: string (2 sentences, plain), actions: [{text, date: "YYYY-MM-DD"|null, time: "HH:MM"|null}], events: [{text, date, time}]}. Today is ${api.util.todayKey()}.\nSubject: ${mail.subject}\n\n${mail.body.slice(0, 6000)}`);
          if (j && j.actions) render(el, { cat: res.cat, recap: j.recap || res.recap, actions: j.actions || [], events: j.events || [] }, mail); } catch (e) { api.ui.toast('AI pass failed: ' + e.message); } });
      }
      function view(el) {
        el.innerHTML = `<div class="is-in"><input class="inp" id="is-s" placeholder="Subject (optional)"><textarea class="inp" id="is-t" rows="9" placeholder="Paste the email here, or drop the .eml file"></textarea><div class="row" style="gap:8px"><button class="btn primary" id="is-go">Scan</button><span class="muted" style="font-size:12px">Nothing leaves this page unless you press “Tidy with AI”.</span></div></div><div id="is-out"></div>
          ${hist().length ? `<div class="sect">Recently scanned</div>${hist().slice(0, 8).map(h => `<div class="is-hist"><span class="is-cat">${esc(h.cat)}</span>${esc(h.subject || '(no subject)')}<em>${new Date(h.at).toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${h.n} item${h.n === 1 ? '' : 's'}</em></div>`).join('')}` : ''}`;
        const go = (mail) => { const res = scan(mail); render(el.querySelector('#is-out'), res, mail); api.storage.set('hist', [{ at: Date.now(), subject: mail.subject, cat: res.cat, n: res.actions.length + res.events.length }, ...hist()].slice(0, 30)); };
        el.querySelector('#is-go').onclick = () => { const raw = el.querySelector('#is-t').value; if (!raw.trim()) return; const mail = /^[\w-]+:\s.+\n(?:[\w-]+:.*\n|\s.+\n)*\n/m.test(raw.slice(0, 2000)) && /^(from|subject|date|received|return-path):/im.test(raw.slice(0, 400)) ? parseEml(raw) : { subject: el.querySelector('#is-s').value.trim(), from: '', body: raw }; go(mail); };
        const ta = el.querySelector('#is-t'); ta.addEventListener('dragover', e => e.preventDefault()); ta.addEventListener('drop', async e => { const f = e.dataTransfer.files[0]; if (!f) return; e.preventDefault(); go(parseEml(await f.text())); });
      }
      api.views.add({ id: 'scan', title: 'Inbox scanner', icon: '📥', subtitle: 'Paste a school, sports or program email. Get the recap, the to-dos and the dates.', render: view });
      api.commands.add({ title: 'Scan an email', hint: 'Recap, action items, dates', run: () => api.ui.navigate('view-scan') });
      css('is-css', `.is-in{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}.is-res{border:1px solid var(--line);border-radius:14px;padding:14px;background:var(--panel);margin-bottom:16px}
        .is-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.is-h b{font-size:15px}.is-h em{font-style:normal;color:var(--muted);font-size:12.5px}
        .is-cat{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;background:color-mix(in srgb,#2563eb 14%,transparent);color:#2563eb;border-radius:999px;padding:2px 8px}
        .is-recap{font-size:14px;line-height:1.5;margin:10px 0}.is-it{display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--line);font-size:13.5px;cursor:pointer}.is-it span{flex:1}.is-it em{font-style:normal;font-size:12px;color:var(--accent);white-space:nowrap}
        .is-go{display:flex;align-items:center;gap:10px;margin-top:12px}.is-hist{display:flex;gap:8px;align-items:center;font-size:13px;padding:6px 0;border-bottom:1px solid var(--line)}.is-hist em{margin-left:auto;font-style:normal;color:var(--muted);font-size:12px}`);
    },
  });
})();
