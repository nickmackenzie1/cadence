/* Hockey on the Island (user idea, 2026-11-19: "Leafs scores on the Island; a goal flashes the Island with our own
   horn sound"). Off until switched on (⌘K "Hockey on the Island…", or this plugin's settings). While your team plays,
   the Island holds the score and the clock; a goal for your team lifts the Island in team blue with a short horn
   made right here in the browser (no sound file, no logos, team names only). Goals against just update the score.
   No horn during a meeting, or when the sound is off. Scores come from the NAS (/api/nhl), which asks the NHL. */
(() => {
  const KEY = 'cadence.hockey';
  const TEAMS = [['ANA', 'Anaheim Ducks'], ['BOS', 'Boston Bruins'], ['BUF', 'Buffalo Sabres'], ['CGY', 'Calgary Flames'], ['CAR', 'Carolina Hurricanes'],
    ['CHI', 'Chicago Blackhawks'], ['COL', 'Colorado Avalanche'], ['CBJ', 'Columbus Blue Jackets'], ['DAL', 'Dallas Stars'], ['DET', 'Detroit Red Wings'],
    ['EDM', 'Edmonton Oilers'], ['FLA', 'Florida Panthers'], ['LAK', 'Los Angeles Kings'], ['MIN', 'Minnesota Wild'], ['MTL', 'Montréal Canadiens'],
    ['NSH', 'Nashville Predators'], ['NJD', 'New Jersey Devils'], ['NYI', 'New York Islanders'], ['NYR', 'New York Rangers'], ['OTT', 'Ottawa Senators'],
    ['PHI', 'Philadelphia Flyers'], ['PIT', 'Pittsburgh Penguins'], ['SJS', 'San Jose Sharks'], ['SEA', 'Seattle Kraken'], ['STL', 'St. Louis Blues'],
    ['TBL', 'Tampa Bay Lightning'], ['TOR', 'Toronto Maple Leafs'], ['UTA', 'Utah Mammoth'], ['VAN', 'Vancouver Canucks'], ['VGK', 'Vegas Golden Knights'],
    ['WSH', 'Washington Capitals'], ['WPG', 'Winnipeg Jets']];
  const H = window.__hockey = window.__hockey || {};
  const cfg = () => { try { return Object.assign({ on: false, team: 'TOR', sound: true }, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { return { on: false, team: 'TOR', sound: true }; } };
  const save = p => { try { localStorage.setItem(KEY, JSON.stringify(Object.assign(cfg(), p))); } catch {} };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ord = n => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : 'OT';
  const when = g => g.state === 'pre' ? 'Warm-up' : g.intermission ? `${ord(g.period)} intermission` : g.periodType === 'SO' ? 'Shootout' : `${g.periodType === 'OT' ? 'OT' : ord(g.period)}${g.clock ? ' ' + g.clock : ''}`;

  // ---- our own horn: two detuned low saw chords through a soft filter, about two seconds ----
  function horn() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const ac = H.ac = H.ac || new AC(); if (ac.state === 'suspended') ac.resume();
      const t0 = ac.currentTime + 0.02, out = ac.createGain(), lp = ac.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t0); lp.Q.value = 0.7;
      out.gain.setValueAtTime(0.0001, t0); out.gain.exponentialRampToValueAtTime(0.16, t0 + 0.12);
      out.gain.setValueAtTime(0.16, t0 + 1.6); out.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.3);
      lp.connect(out); out.connect(ac.destination);
      for (const [f, d] of [[110, -6], [110, 6], [138.6, 0], [164.8, -4], [220, 3]]) {
        const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d;
        o.connect(lp); o.start(t0); o.stop(t0 + 2.4);
      }
    } catch {}
  }

  function pill(g) {
    const us = `<b>${esc(g.us.abbrev)} ${g.us.score ?? 0}</b>`, them = `${esc(g.them.abbrev)} ${g.them.score ?? 0}`;
    return { html: `<span class="isl-ico" style="--ic:#1d4f91">${window.LUCIDE && window.LUCIDE.goal ? `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${window.LUCIDE.goal}</svg>` : ''}</span>
      <span class="isl-t">${g.home ? `${them} · ${us}` : `${us} · ${them}`}</span><span class="isl-right">${esc(when(g))}</span>`, minW: 200 };
  }

  async function tick(api) {
    clearTimeout(H.t);
    const c = cfg();
    if (!c.on) { if (window.CadenceIsland) window.CadenceIsland.clear('hockey'); return; }
    let d = null;
    try { const r = await fetch('api/nhl?team=' + encodeURIComponent(c.team), { cache: 'no-store' }); if (r.ok) d = await r.json(); } catch {}
    const g = d && d.game, I = window.CadenceIsland;
    if (I && g && (g.state === 'live' || g.state === 'pre')) I.live('hockey', { prio: 4, view: () => pill(g) });
    else if (I) I.clear('hockey');
    if (g) seen(api, g, c);
    H.last = d;
    H.t = setTimeout(() => tick(api), Math.max(15, (d && d.poll) || 600) * 1000);
  }
  // goals and the final whistle, once each (remembered per game, so a reload doesn't sound the horn again)
  function seen(api, g, c) {
    const k = 'cadence.hockey.g.' + g.id;
    let was; try { was = JSON.parse(localStorage.getItem(k) || 'null'); } catch { was = null; }
    const now = { us: g.us.score ?? 0, them: g.them.score ?? 0, final: g.state === 'final' };
    try { localStorage.setItem(k, JSON.stringify(now)); } catch {}
    if (!was) return;                       // first look at this game: no fanfare for goals already scored
    const I = window.CadenceIsland; if (!I) return;
    if (now.us > was.us) {
      const goal = g.goals.filter(x => x.ours).slice(-1)[0];
      I.show({ key: 'hockey-goal', title: `${g.us.name} goal`, sub: `${goal && goal.who ? goal.who + ' · ' : ''}${g.us.abbrev} ${now.us}, ${g.them.abbrev} ${now.them}`,
        color: '#4a8fe0', ms: 7000 });
      if (c.sound && !H.meeting && !document.hidden) horn();
    }
    if (now.final && !was.final) {
      const won = now.us > now.them;
      I.show({ key: 'hockey-final', title: won ? `${g.us.name} won ${now.us}–${now.them}` : `Final: ${g.us.abbrev} ${now.us}, ${g.them.abbrev} ${now.them}`, sub: won ? `against the ${g.them.name}` : null, color: won ? '#4a8fe0' : '', ms: 6000 });
    }
    // tidy: keep the last 20 games
    try { Object.keys(localStorage).filter(x => x.startsWith('cadence.hockey.g.')).sort().slice(0, -20).forEach(x => localStorage.removeItem(x)); } catch {}
  }

  function settings(api) {
    const c = cfg();
    api.ui.modal('Hockey on the Island', `<p class="muted" style="margin:0 0 12px">While your team plays, the Island shows the score and the clock. A goal for your team lifts the Island with a short horn.</p>
      <label style="display:flex;gap:10px;align-items:center;padding:6px 0"><input type="checkbox" id="hk-on" ${c.on ? 'checked' : ''}> Show games on the Island</label>
      <label style="display:flex;gap:10px;align-items:center;padding:6px 0">Team <select id="hk-team">${TEAMS.map(([a, n]) => `<option value="${a}" ${a === c.team ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label style="display:flex;gap:10px;align-items:center;padding:6px 0"><input type="checkbox" id="hk-snd" ${c.sound ? 'checked' : ''}> Horn when your team scores <button class="btn sm" id="hk-try" type="button">Try it</button></label>
      <p class="muted" style="margin:10px 0 0;font-size:12px">Scores from the NHL's public feed. No horn during meetings.</p>`,
      `<button class="btn primary" id="hk-save">Done</button>`);
    document.getElementById('hk-try').onclick = horn;
    document.getElementById('hk-save').onclick = () => {
      save({ on: document.getElementById('hk-on').checked, team: document.getElementById('hk-team').value, sound: document.getElementById('hk-snd').checked });
      api.ui.close(); tick(api);
    };
  }

  Cadence.registerPlugin({
    id: 'hockey', name: 'Hockey on the Island', version: '1.0.0', category: 'Fun', color: '#1d4f91',
    icon: '<path d="M12 13V2l8 4-8 4" /><path d="M20.561 10.222a9 9 0 1 1-12.55-5.29" /><path d="M8.002 9.997a5 5 0 1 0 8.9 2.02" />',
    tagline: 'Your team’s score on the Island (off until you switch it on)',
    description: 'While your NHL team plays (the Leafs to start), the Island shows the score and the clock. A goal for your team lifts the Island with a short horn made in the browser. Off until you switch it on.',
    settings,
    setup(api) {
      H.api = api;
      api.on('meeting:start', () => { H.meeting = true; });
      api.on('meeting:end', () => { H.meeting = false; });
      api.commands.add({ title: 'Hockey on the Island…', icon: 'goal', hint: cfg().on ? 'On' : 'Off', run: () => settings(api) });
      window.CadenceHockey = { horn, settings: () => settings(api), tick: () => tick(api), cfg };
      tick(api);
    },
  });
})();
