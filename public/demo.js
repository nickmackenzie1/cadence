/* Demo mode data — a believable consultant's month: 12 clients, ~170 tasks, meetings with notes,
   a grown garden, mural strokes, links and feeds. Only used when Cadence runs with ?demo (per tab). */
window.CadenceDemo = (() => {
  let seed = 7;
  const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(R() * a.length)];
  const id = p => p + Math.floor(R() * 36 ** 6).toString(36).padStart(6, '0') + Math.floor(R() * 1296).toString(36);
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const day = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
  const COLORS = ['#5b5bd6', '#e5484d', '#12a594', '#f76b15', '#3e63dd', '#d6409f', '#30a46c', '#ad7f58', '#8e4ec6', '#0090ff', '#e54666', '#46a758'];

  const CLIENTS = [
    ['Shopify', 'shopify.com', 'Retail & e-commerce'], ['Patagonia', 'patagonia.com', 'Retail & e-commerce'], ['Lululemon', 'lululemon.com', 'Retail & e-commerce'],
    ['Mailchimp', 'mailchimp.com', 'Software & SaaS'], ['Notion', 'notion.so', 'Software & SaaS'], ['Canada Goose', 'canadagoose.com', 'Retail & e-commerce'],
    ['Tim Hortons', 'timhortons.ca', 'Food & hospitality'], ['Allbirds', 'allbirds.com', 'Retail & e-commerce'], ['Duolingo', 'duolingo.com', 'Education'],
    ['Airbnb', 'airbnb.com', 'Travel & hospitality'], ['Figma', 'figma.com', 'Software & SaaS'], ['Oatly', 'oatly.com', 'Food & hospitality']
  ];
  const MINE = ['Build {x} blueprint in Zoho CRM', 'Map {x} fields for the migration', 'Set up Zoho Books sync', 'Write Deluge script for lead assignment', 'Fix duplicate contacts workflow',
    'Send SOW for phase 2', 'Configure Zoho Desk SLA rules', 'Draft Creator app for inventory', 'Review Zoho Analytics dashboard', 'Clean up custom modules', 'Invoice for October hours',
    'Train sales team on pipelines', 'Set up webhook to Shopify', 'Document {x} automation', 'Test approval process', 'Configure territory rules', 'Prep quarterly review deck',
    'Migrate email templates', 'Build portal for customers', 'Fix broken Zoho Flow', 'Audit user roles and profiles', 'Set up Zoho Sign templates', 'Import historical deals'];
  const THEIRS = ['Send admin access to Zoho One', 'Share the current lead CSV', 'Confirm budget for phase 2', 'Get sign-off from finance', 'Send brand assets for portal', 'Book training session with the team',
    'Decide on pipeline stages', 'Provide API keys for Shopify', 'Review the SOW', 'List of users to onboard'];
  const X = ['deals', 'leads', 'quotes', 'tickets', 'onboarding', 'renewals'];
  const TIMES = [null, null, null, '09:30', '11:00', '13:00', '14:30', '16:00'];

  function build() {
    seed = 7;
    const now = Date.now(), clients = [], tasks = [], meetings = [];
    CLIENTS.forEach(([name, domain, ind], i) => clients.push({ id: id('c'), name, domain, color: COLORS[i % COLORS.length], status: i === 11 ? 'paused' : 'active', archived: false, createdAt: now - (60 - i) * 864e5,
      links: [{ label: 'Zoho CRM', url: `https://crm.zoho.com/crm/org${700000 + i * 13}/tab/Home/begin` }, { label: 'Shared drive', url: `https://drive.google.com/drive/folders/demo${i}` }] }));
    const active = clients.filter(c => c.status === 'active');
    const task = (o) => tasks.push(Object.assign({ id: id('t'), title: '', clientId: null, owner: 'me', assignee: '', dueDate: null, dueTime: null, priority: 0, tags: [], notes: '', remindMode: 'auto', remindAt: null, reminded: false, done: false, doneAt: null, createdAt: now - 20 * 864e5, meetingId: null }, o));
    const title = () => pick(MINE).replace('{x}', pick(X));

    // finished work over the last 40 days — powers the garden, mural, review and pulse
    for (let d = -40; d <= 0; d++) {
      const n = d === 0 ? 3 : (new Date(day(d)).getDay() % 6 === 0 ? Math.floor(R() * 2) : 2 + Math.floor(R() * 5));
      for (let k = 0; k < n; k++) {
        const c = pick(active), t = day(d).getTime() + (k * 47 + Math.floor(R() * 300)) * 60e3 - 3 * 3600e3;
        task({ title: title(), clientId: c.id, dueDate: ymd(day(d - (R() < .2 ? 2 : 0))), done: true, doneAt: t, createdAt: t - (2 + R() * 6) * 864e5, priority: R() < .2 ? 2 : 0 });
      }
    }
    // open work: a few overdue, a busy today, the week ahead, someday
    const open = (dOff, o = {}) => { const c = o.client || pick(active); task(Object.assign({ title: title(), clientId: c.id, dueDate: dOff == null ? null : ymd(day(dOff)), dueTime: dOff == null ? null : pick(TIMES), priority: R() < .25 ? (R() < .4 ? 3 : 2) : 0, createdAt: now - (1 + R() * 9) * 864e5 }, o)); };
    [-3, -2, -1, -1].forEach(d => open(d));
    // today: untimed, plus a couple of times still ahead of you (whatever time you open the demo)
    const h = new Date().getHours(), later = n => h + n < 23 ? String(h + n).padStart(2, '0') + ':' + (n % 2 ? '30' : '00') : null;
    for (let k = 0; k < 6; k++) open(0, { dueTime: k === 0 ? later(1) : k === 1 ? later(2) : null });
    for (let d = 1; d <= 12; d++) for (let k = 0; k < 1 + Math.floor(R() * 3); k++) open(d);
    for (let k = 0; k < 7; k++) open(null);
    task({ title: 'Weekly timesheet', dueDate: ymd(day(((5 - new Date().getDay()) + 7) % 7)), dueTime: '16:30', repeat: { unit: 'week', n: 1 } });
    task({ title: 'Inbox zero', dueDate: ymd(day(0)), repeat: { unit: 'weekday', n: 1 } });
    // waiting on clients
    active.slice(0, 8).forEach((c, i) => { const n = i < 3 ? 2 : 1; for (let k = 0; k < n; k++) task({ title: pick(THEIRS), clientId: c.id, owner: 'them', assignee: pick(['Sarah', 'Dev', 'Priya', 'Marc', 'Jen']), dueDate: ymd(day(-4 + Math.floor(R() * 9))), createdAt: now - (3 + R() * 10) * 864e5 }); });

    // meetings with notes (the last 3 weeks)
    for (let k = 0; k < 14; k++) {
      const c = pick(active), start = day(-1 - Math.floor(R() * 21)).getTime() - (2 + Math.floor(R() * 5)) * 3600e3;
      const items = tasks.filter(t => t.clientId === c.id && t.createdAt < start + 864e5).slice(0, 3);
      const m = { id: id('m'), clientId: c.id, start, end: start + (30 + Math.floor(R() * 4) * 15) * 60e3, itemIds: items.map(t => t.id),
        notes: `${c.name} — ${pick(['weekly sync', 'blueprint review', 'kickoff', 'status call', 'training'])}\n\n- Walked through the ${pick(X)} pipeline\n- ${pick(['Agreed to go live next sprint', 'Need finance sign-off before phase 2', 'Team loves the new layouts', 'Duplicate leads still coming in from forms'])}\n- Next call ${pick(['Thursday', 'next Tuesday', 'in two weeks'])}` };
      items.forEach(t => t.meetingId = m.id); meetings.push(m);
    }
    meetings.sort((a, b) => a.start - b.start);

    // momentum: XP + a grown garden from the finished tasks
    const done = tasks.filter(t => t.done).sort((a, b) => a.doneAt - b.doneAt);
    const log = done.map(t => [t.doneAt, 10 + (t.priority || 0) * 6 + (R() < .15 ? 20 : 0), t.clientId]);
    const xp = log.reduce((a, e) => a + e[1], 0);
    const pluginData = {
      momentum: { state: { xp, streak: 9, best: 14, lastDay: ymd(day(0)), ach: { first: now - 39 * 864e5, ten: now - 35 * 864e5, streak7: now - 2 * 864e5, crit: now - 20 * 864e5 }, sound: false, log, awarded: {}, crits: 11, loot: 3 } },
      calendar: { settings: { sample: true, lead: 10 } }
    };
    return { v: 1, demo: true, clients, tasks, meetings, settings: { myName: 'Alex', theme: 'light', remindLead: 10 }, disabled: ['haunted'], userPlugins: [], pluginData, activeMeeting: null, fixPrep: 1, updatedAt: now };
  }
  return { build };
})();
