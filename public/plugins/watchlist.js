/* Watch list (user, 2026-11-18: "i would love a movies to watch section"). Works in both spaces (user, same day:
   "watch Jurassic Park" should just add the film, wherever you type it); each space keeps its own list.
   - Quick add: "watch Dune" or "see Severance" adds a film or show, "play Hades" a game. Cadence finds it (TMDB for
     films and shows, TheGamesDB for games, both through the NAS) and the task gets its poster or box art, year and
     runtime. It goes in a "Watch list" area, so it stays out of your Inbox.
   - The Watch list page: posters of what's next (films and shows, then games), a search box with suggestions to add
     more, and a shelf of covers of everything you've watched and played, newest first.
   - Done means watched (or played). Got the wrong one? The task's card lists the other matches; or "Not a film" keeps
     it as an ordinary task.
   Without the keys in .env (TMDB_API_KEY, THEGAMESDB_API_KEY), or in the demo, the list still works, just without pictures.
   "This product uses the TMDB API but is not endorsed or certified by TMDB." */
(() => {
  const E = window.CadenceKit.esc;
  const css = window.CadenceKit.css;
  const FILM = '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/>';
  const norm = s => String(s || '').toLowerCase().replace(/^(the|a|an)\s+/, '').replace(/[^a-z0-9]/g, '');
  const hm = m => !m ? '' : m < 60 ? m + 'm' : Math.floor(m / 60) + 'h' + (m % 60 ? ' ' + (m % 60) + 'm' : '');

  Cadence.registerPlugin({
    id: 'watchlist', name: 'Watch list', version: '1.0.0', category: 'Life',
    description: 'Type "watch Dune" or "play Hades" in quick add: it lands in your Watch list with its poster or box art, year and runtime (from TMDB and TheGamesDB). A page of posters of what to watch next, and a shelf of everything you\'ve watched and played.',
    tagline: 'Films, shows and games to get to', color: '#7c3aed', icon: FILM,
    setup(api) {
      const nas = () => api.system().mode === 'nas';
      const ic = n => api.ui.icon(n);
      const getJson = async u => { const r = await fetch(u); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j; };
      const KIND = { film: 'film', game: 'game' };
      const isMedia = t => !!(t && t.media && t.media.kind);
      const label = m => m.kind === 'game' ? 'Game' : m.type === 'tv' ? 'Show' : 'Film';
      const facts = m => [m.year, m.type === 'tv' && m.seasons ? m.seasons + (m.seasons === 1 ? ' season' : ' seasons') : hm(m.runtime), m.platform].filter(Boolean).join(' · ');

      // the area the list lives in (made the first time something is added; renamed or removed areas are respected)
      const area = make => {
        const id = api.storage.get('area'), c = id && api.clients.get(id);
        if (c && !c.archived) return c.id;
        const same = api.clients.list().find(x => /^watch ?list$/i.test(x.name)); if (same) { api.storage.set('area', same.id); return same.id; }
        if (!make) return null;
        const n = api.clients.add('Watch list'); api.storage.set('area', n.id); return n.id;
      };

      // quick add: "watch …" / "see …" (film or show), "play …" (game), at the start
      api.parsers.add((text, r) => {
        const m = /^\s*(watch|see|play)\s+(?=\S)/i.exec(text); if (!m) return text;
        const kind = /^play$/i.test(m[1]) ? KIND.game : KIND.film;
        r.media = { kind, pending: true, verb: m[1].toLowerCase() };
        const a = area(false); if (a && !r.clientId) r.clientId = a;
        return ' ' + text.slice(m[0].length);
      });
      api.chips.add((t, preview) => {
        const m = t.media; if (!m || !m.kind) return '';
        if (preview) return `<span class="chip wq-chip">${ic(m.kind === 'game' ? 'gamepad-2' : 'film')} Watch list</span>`;
        const f = facts(m);
        return `<span class="chip wq-chip" title="${E(label(m))}${m.title && m.title !== t.title ? ': ' + E(m.title) : ''}">${ic(m.kind === 'game' ? 'gamepad-2' : 'film')} ${t.done ? (m.kind === 'game' ? 'Played' : 'Watched') : E(label(m))}${f ? ' · ' + E(f) : ''}</span>`;
      });

      // look a title up and fill the task in
      const look = async (kind, q) => {
        if (!nas()) return { off: true };
        const d = await getJson((kind === KIND.game ? 'api/gdb/find?q=' : 'api/tmdb/find?q=') + encodeURIComponent(q));
        return d;
      };
      const detail = async hit => {
        if (hit.type === 'game' || !nas()) return hit;
        try { const d = await getJson(`api/tmdb/title?type=${hit.type}&id=${hit.id}`); return d && !d.off ? { ...hit, ...d } : hit; } catch { return hit; }
      };
      const pack = (kind, h, alts) => ({ kind, type: h.type, id: h.id, title: h.title, year: h.year || '', runtime: h.runtime || 0, seasons: h.seasons || 0,
        poster: h.poster || null, genres: h.genres || [], by: h.by || [], cast: h.cast || [], overview: h.overview || '', link: h.link || (h.type !== 'game' ? `https://www.themoviedb.org/${h.type}/${h.id}` : ''),
        platform: h.platform || '', alts: (alts || []).filter(x => x.id !== h.id).slice(0, 6).map(x => ({ id: x.id, type: x.type, title: x.title, year: x.year, poster: x.poster, platform: x.platform || '' })) });
      const choose = async (id, hit) => {
        const t = api.tasks.get(id); if (!t || !t.media) return;
        const full = await detail(hit);
        api.tasks.update(id, { title: full.title, media: pack(t.media.kind, full, t.media.alts && t.media.alts.length ? [...t.media.alts, { id: t.media.id, type: t.media.type, title: t.media.title, year: t.media.year, poster: t.media.poster, platform: t.media.platform }] : []) });
      };
      const notMedia = id => { const t = api.tasks.get(id); if (!t) return; const a = area(false); api.tasks.update(id, { media: null, ...(t.wlSaid ? { title: t.wlSaid } : {}), ...(t.clientId && t.clientId === a ? { clientId: null } : {}) }); api.ui.toast('Kept as an ordinary task'); };
      // every "added" toast says where it went (user: "right now i don't know where to go")
      const SEE = { label: 'See the list', run: () => api.ui.navigate('view-watch') };
      const fill = async (t, q) => {
        const kind = t.media.kind;
        let d; try { d = await look(kind, q); } catch { d = { failed: true }; }
        if (!api.tasks.get(t.id)) return;
        const res = (d && d.results) || [];
        if (d.off || d.failed || !res.length) {
          api.tasks.update(t.id, { media: { kind, title: q, pending: false } });
          if (d.failed) api.ui.toast(`Added ${q} to your Watch list. ${kind === KIND.game ? 'TheGamesDB' : 'TMDB'} didn't answer, so it has no picture yet`, [SEE]);
          else if (!d.off) api.ui.toast(`Added to your Watch list. Nothing called "${q}" turned up, so it has no picture`, [SEE, { label: 'Not for the list', run: () => notMedia(t.id) }]);
          else api.ui.toast(`Added ${q} to your Watch list`, [SEE, { label: kind === KIND.game ? 'Not a game' : 'Not a film', run: () => notMedia(t.id) }]);
          return;
        }
        // the closest name first; otherwise how well known it is (the order the service gave)
        const hit = res.find(x => norm(x.title) === norm(q)) || res[0];
        const full = await detail(hit);
        if (!api.tasks.get(t.id)) return;
        api.tasks.update(t.id, { title: full.title, media: pack(kind, full, res) });
        const what = `${full.title}${full.year ? ' (' + full.year + ')' : ''}`;
        api.ui.toast(`Added ${what} to your Watch list`, [
          SEE, ...(res.length > 1 ? [{ label: 'Not this one', run: () => { api.ui.openTask(t.id); } }] : []),
          { label: kind === KIND.game ? 'Not a game' : 'Not a film', run: () => notMedia(t.id) }]);
      };
      api.on('task:add', t => {
        if (!t.media || !t.media.pending) return;
        // what you typed, so "Not a game" can put "play tennis" back as you wrote it
        const a = area(true); api.tasks.update(t.id, { wlSaid: `${t.media.verb || ''} ${t.title}`.trim(), ...(!t.clientId ? { clientId: a } : {}) });
        // added from Today without a date: quick add would make it due today. A film to watch isn't a to-do for today.
        if (!t.dueDate) setTimeout(() => { const n = api.tasks.get(t.id); if (n && !n.done && n.dueDate === api.util.todayKey()) api.tasks.update(t.id, { dueDate: null }); }, 0);
        fill(t, t.title);
      });

      // the task's card: poster, what it is, and the other matches
      api.taskCards.add(t => {
        const m = t.media; if (!m || !m.kind) return '';
        const by = m.by && m.by.length ? (m.type === 'tv' ? 'Created by ' : 'Directed by ') + m.by.join(', ') : '';
        return `<div class="wq-card" data-wq-task="${E(t.id)}">
          ${m.poster ? `<img class="wq-cp" src="${E(m.poster)}" alt="" loading="lazy">` : `<div class="wq-cp wq-none">${ic(m.kind === 'game' ? 'gamepad-2' : 'film')}</div>`}
          <div class="wq-ct"><b>${E(m.title || t.title)}</b><span class="muted">${E([label(m), facts(m), (m.genres || []).join(', ')].filter(Boolean).join(' · '))}</span>
            ${by ? `<span class="muted">${E(by)}${m.cast && m.cast.length ? ' · with ' + E(m.cast.slice(0, 3).join(', ')) : ''}</span>` : ''}
            ${m.overview ? `<p>${E(m.overview)}</p>` : ''}
            <div class="wq-cl">${m.link ? `<a href="${E(m.link)}" target="_blank" rel="noopener">${ic('external-link')} ${m.kind === 'game' ? 'TheGamesDB' : 'TMDB'}</a>` : ''}<button class="btn sm ghost" data-wq-not="${E(t.id)}">${m.kind === 'game' ? 'Not a game' : 'Not a film'}</button></div>
            ${m.alts && m.alts.length ? `<div class="wq-alts"><span class="muted">Not this one?</span>${m.alts.map((a, i) => `<button class="wq-alt" data-wq-alt="${i}" title="${E(a.title)}${a.year ? ' (' + E(a.year) + ')' : ''}">${a.poster ? `<img src="${E(a.poster)}" alt="" loading="lazy">` : ''}<span>${E(a.title)}${a.year ? ' <i>' + E(a.year) + '</i>' : ''}</span></button>`).join('')}</div>` : ''}
            ${m.kind !== 'game' && m.id ? '<small class="wq-credit">This product uses the TMDB API but is not endorsed or certified by TMDB.</small>' : ''}</div></div>`;
      });
      document.addEventListener('click', e => {
        const not = e.target.closest('[data-wq-not]'); if (not) { notMedia(not.dataset.wqNot); return; }
        const alt = e.target.closest('[data-wq-alt]'); if (!alt) return;
        const id = alt.closest('[data-wq-task]').dataset.wqTask, t = api.tasks.get(id), a = t && t.media && t.media.alts[+alt.dataset.wqAlt];
        if (a) { alt.disabled = true; choose(id, a); }
      });

      // the page
      const G = { q: '', kind: KIND.film, res: null, busy: false, tab: 'next', tn: { mins: 0, pick: null, seen: [] } };
      // Tonight (user, 2026-11-18): say how much time you have, get one thing from the list that fits. Films by their
      // runtime, shows by how many episodes fit, games always (play for as long as you've got). What's waited longest
      // comes up more often; "Something else" doesn't repeat until it has run out.
      const TIMES = [[45, '45 min'], [90, '1½ h'], [120, '2 h'], [180, '3 h'], [300, 'All evening']];
      function tonight(mins) {
        const seen = G.tn.seen, all = items(false).map(t => {
          const m = t.media, age = (Date.now() - (t.createdAt || Date.now())) / 86400e3;
          let fit = true, why = '', w = 1 + Math.min(age, 120) / 14;
          if (m.kind === 'game') why = `Play for ${mins >= 300 ? 'the evening' : hm(mins)}`;
          else if (m.type === 'tv') { const rt = m.runtime || 45, n = Math.floor(mins / rt); fit = n >= 1; why = n === 1 ? `One episode (${hm(rt)})` : `About ${Math.min(n, 8)} episodes`; }
          else if (m.runtime) { fit = m.runtime <= mins + 5; const left = mins - m.runtime; why = `${hm(m.runtime)}${left >= 15 && mins < 300 ? `, ${hm(left)} to spare` : ''}`; w *= 0.6 + 0.6 * Math.min(1, m.runtime / mins); }
          else { why = 'Length unknown'; w *= 0.4; }
          return { t, fit, why, w };
        }).filter(c => c.fit);
        let pool = all.filter(c => !seen.includes(c.t.id)); if (!pool.length) { G.tn.seen = []; pool = all; }
        if (!pool.length) return null;
        let r = Math.random() * pool.reduce((a, c) => a + c.w, 0);
        for (const c of pool) { if ((r -= c.w) <= 0) return c; }
        return pool[pool.length - 1];
      }
      const shortest = () => items(false).filter(t => t.media.kind !== 'game' && t.media.runtime).sort((a, b) => (a.media.type === 'tv' ? a.media.runtime : a.media.runtime) - b.media.runtime)[0];
      const tnHtml = () => {
        const T = G.tn, p = T.pick && api.tasks.get(T.pick.t.id) && !api.tasks.get(T.pick.t.id).done ? T.pick : null, m = p && p.t.media;
        const sh = !p && T.mins ? shortest() : null;
        return `<div class="wq-tn"><div class="wq-tnh"><b>${ic('popcorn')} Tonight</b><span class="muted">How much time do you have?</span>
            <div class="wq-tnt">${TIMES.map(([v, l]) => `<button class="chip${T.mins === v ? ' on' : ''}" data-wq-tn="${v}">${l}</button>`).join('')}</div></div>
          ${p ? `<div class="wq-tnp"><button class="wq-tnc" data-wq-open="${E(p.t.id)}" aria-label="Open ${E(p.t.title)}">${m.poster ? `<img src="${E(m.poster)}" alt="">` : `<span class="wq-none">${ic(m.kind === 'game' ? 'gamepad-2' : 'film')}</span>`}</button>
              <div class="wq-tnx"><span class="muted">${E(label(m))}${m.year ? ' · ' + E(m.year) : ''}</span><b>${E(p.t.title)}</b><span>${E(p.why)}</span>
                ${m.overview ? `<p class="muted">${E(m.overview.length > 180 ? m.overview.slice(0, 180) + '…' : m.overview)}</p>` : ''}
                <div class="wq-tnb"><button class="btn sm" data-wq-done="${E(p.t.id)}">${ic('check')} ${m.kind === 'game' ? 'Played it' : 'Watched it'}</button><button class="btn sm ghost" data-wq-tn="${T.mins}">${ic('shuffle')} Something else</button></div></div></div>`
            : T.mins ? `<p class="muted wq-tnn">Nothing on the list fits in ${E(TIMES.find(x => x[0] === T.mins)[1])}.${sh ? ` The shortest is ${E(sh.title)} (${E(hm(sh.media.runtime))}).` : ''}</p>` : ''}</div>`;
      };
      let timer = 0;
      const items = done => api.tasks.list(t => isMedia(t) && !!t.done === done);
      const cover = (t, done) => {
        const m = t.media;
        return `<div class="wq-it" data-id="${E(t.id)}">
          <button class="wq-pic" data-wq-open="${E(t.id)}" aria-label="Open ${E(t.title)}">${m.poster ? `<img src="${E(m.poster)}" alt="" loading="lazy">` : `<span class="wq-none">${ic(m.kind === 'game' ? 'gamepad-2' : 'film')}<b>${E(t.title)}</b></span>`}</button>
          <div class="wq-tx"><b title="${E(t.title)}">${E(t.title)}</b><span class="muted">${E(done ? (m.kind === 'game' ? 'Played ' : 'Watched ') + new Date(t.doneAt || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: new Date(t.doneAt || Date.now()).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }) : facts(m) || label(m))}</span></div>
          ${done ? '' : `<button class="btn sm wq-done" data-wq-done="${E(t.id)}">${ic('check')} ${m.kind === 'game' ? 'Played' : 'Watched'}</button>`}</div>`;
      };
      const grid = (list, done) => `<div class="wq-grid">${list.map(t => cover(t, done)).join('')}</div>`;
      const render = el => {
        const films = items(false).filter(t => t.media.kind !== 'game'), games = items(false).filter(t => t.media.kind === 'game');
        const shelf = items(true).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
        const sug = G.res && G.q ? (G.res.off ? `<p class="muted wq-hint">Press Enter to add "${E(G.q)}". Pictures need ${G.kind === KIND.game ? 'THEGAMESDB_API_KEY' : 'TMDB_API_KEY'} in .env on the NAS.</p>`
          : G.res.failed ? `<p class="muted wq-hint">Couldn't search just now. Press Enter to add "${E(G.q)}" anyway.</p>`
          : `<div class="wq-sug">${(G.res.results || []).map((h, i) => `<button class="wq-s" data-wq-add="${i}">${h.poster ? `<img src="${E(h.poster)}" alt="" loading="lazy">` : `<span class="wq-none">${ic(h.type === 'game' ? 'gamepad-2' : 'film')}</span>`}<span><b>${E(h.title)}</b><i>${E([h.type === 'tv' ? 'Show' : h.type === 'game' ? 'Game' : 'Film', h.year, h.platform].filter(Boolean).join(' · '))}</i></span></button>`).join('') || `<p class="muted wq-hint">Nothing by that name. Press Enter to add it anyway.</p>`}</div>`) : '';
        el.innerHTML = `<div class="wq">
          <div class="wq-add"><div class="wq-kind" role="tablist">${[[KIND.film, 'Film or show', 'film'], [KIND.game, 'Game', 'gamepad-2']].map(([k, l, i]) => `<button role="tab" class="${G.kind === k ? 'on' : ''}" data-wq-kind="${k}">${ic(i)} ${l}</button>`).join('')}</div>
            <input class="inp" id="wq-q" placeholder="${G.kind === KIND.game ? 'Add a game, like Hades' : 'Add a film or show, like Dune'}" value="${E(G.q)}" autocomplete="off" data-no-grammar>${G.busy ? '<span class="muted wq-busy">Looking…</span>' : ''}</div>
          ${sug}
          <div class="wq-tabs">${[['next', `Up next <i>${films.length + games.length}</i>`], ['shelf', `Watched and played <i>${shelf.length}</i>`]].map(([k, l]) => `<button class="${G.tab === k ? 'on' : ''}" data-wq-tab="${k}">${l}</button>`).join('')}</div>
          ${G.tab === 'next' && (films.length || games.length) ? tnHtml() : ''}
          ${G.tab === 'next' ? (films.length || games.length ? `${films.length ? `<h3>To watch</h3>${grid(films, false)}` : ''}${games.length ? `<h3>To play</h3>${grid(games, false)}` : ''}`
            : `<p class="muted">Nothing on the list yet. Search above, or type "watch Dune" or "play Hades" in quick add.</p>`)
            : shelf.length ? grid(shelf, true) : '<p class="muted">What you watch and play shows up here, newest first.</p>'}
          <p class="wq-credit">Films and shows from TMDB, games from TheGamesDB. This product uses the TMDB API but is not endorsed or certified by TMDB.</p></div>`;
        const q = el.querySelector('#wq-q');
        q.oninput = () => { G.q = q.value; clearTimeout(timer); if (!G.q.trim()) { G.res = null; redraw(el, true); return; }
          timer = setTimeout(async () => { const s = G.q.trim(), k = G.kind; G.busy = true; redraw(el, true);
            let d; try { d = await look(k, s); } catch { d = { failed: true }; }
            if (G.q.trim() === s && G.kind === k) { G.res = d; G.busy = false; redraw(el, true); } }, 350); };
        q.onkeydown = e => { if (e.key === 'Enter' && G.q.trim()) { e.preventDefault(); const h = G.res && G.res.results && G.res.results[0]; add(h && norm(h.title) === norm(G.q) ? h : null, el); } if (e.key === 'Escape') { G.q = ''; G.res = null; redraw(el, true); } };
        el.querySelectorAll('[data-wq-add]').forEach(b => b.onclick = () => add(G.res.results[+b.dataset.wqAdd], el));
        el.querySelectorAll('[data-wq-kind]').forEach(b => b.onclick = () => { G.kind = b.dataset.wqKind; G.res = null; redraw(el, true); if (G.q.trim()) q.dispatchEvent(new Event('input')); });
        el.querySelectorAll('[data-wq-tn]').forEach(b => b.onclick = () => { const v = +b.dataset.wqTn, T = G.tn;
          if (T.pick && v === T.mins) T.seen.push(T.pick.t.id); else T.seen = [];
          T.mins = v; T.pick = tonight(v); if (T.pick) T.seen.push(T.pick.t.id); redraw(el); });
        el.querySelectorAll('[data-wq-tab]').forEach(b => b.onclick = () => { G.tab = b.dataset.wqTab; redraw(el); });
        el.querySelectorAll('[data-wq-open]').forEach(b => b.onclick = () => api.ui.openTask(b.dataset.wqOpen));
        el.querySelectorAll('[data-wq-done]').forEach(b => b.onclick = () => { const t = api.tasks.get(b.dataset.wqDone); api.tasks.complete(b.dataset.wqDone);
          api.ui.toast(`${t && t.media.kind === 'game' ? 'Played' : 'Watched'}: on the shelf`, [{ label: 'Undo', run: () => { api.tasks.update(t.id, { done: false, doneAt: null }); } }]); });
      };
      // redraw, keeping the search box focused where you were typing
      const redraw = (el, typing) => { const q = el.querySelector('#wq-q'), at = q && q.selectionStart, had = q && document.activeElement === q; render(el);
        if (typing || had) { const n = el.querySelector('#wq-q'); if (n) { n.focus(); try { n.setSelectionRange(at ?? n.value.length, at ?? n.value.length); } catch {} } } };
      const add = async (hit, el) => {
        const kind = G.kind, q = G.q.trim(); G.q = ''; G.res = null;
        const t = api.tasks.add({ title: hit ? hit.title : q, clientId: area(true), media: hit ? pack(kind, hit, []) : { kind, title: q, pending: false } });
        redraw(el, true);
        if (hit) { const full = await detail(hit); if (api.tasks.get(t.id)) api.tasks.update(t.id, { title: full.title, media: pack(kind, full, []) }); }
        else if (nas()) fill({ ...t, media: { kind } }, q);
      };
      api.views.add({ id: 'watch', title: 'Watch list', icon: '🎬', subtitle: 'Films, shows and games to get to, and what you\'ve watched', wide: true, render: el => render(el) });
      api.commands.add({ title: 'Watch list: films, shows and games to get to', icon: 'film', run: () => api.ui.navigate('view-watch') });
      api.commands.add({ title: 'Tonight: what should I watch?', icon: 'popcorn', run: () => { G.tab = 'next'; api.ui.navigate('view-watch'); } });
      api.search.add(q => q.length < 2 ? [] : items(false).concat(items(true)).filter(t => norm(t.title).includes(norm(q))).slice(0, 5)
        .map(t => ({ title: t.title, k: t.done ? (t.media.kind === 'game' ? 'Played' : 'Watched') : 'Watch list', run: () => api.ui.openTask(t.id) })));

      css('wq-css', `
        .chip.wq-chip svg{width:12px;height:12px;vertical-align:-2px}
        .wq{max-width:1000px}
        .wq-add{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:4px 0 10px}
        .wq-add .inp{flex:1;min-width:220px}
        .wq-kind{display:flex;background:var(--hover);border-radius:var(--r,8px);padding:3px}
        .wq-kind button,.wq-tabs button{border:0;background:none;color:var(--muted);padding:6px 10px;border-radius:calc(var(--r,8px) - 2px);cursor:pointer;display:flex;gap:6px;align-items:center;font:inherit}
        .wq-kind button.on{background:var(--panel);color:var(--text)}
        .wq-kind svg{width:15px;height:15px}
        .wq-busy{font-size:13px}
        .wq-hint{margin:4px 0 14px}
        .wq-sug{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px;margin:0 0 18px}
        .wq-s{display:flex;gap:10px;align-items:center;text-align:left;border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:var(--r,8px);padding:6px;cursor:pointer;font:inherit}
        .wq-s:hover{background:var(--hover)}
        .wq-s img,.wq-s .wq-none{width:40px;height:60px;object-fit:cover;border-radius:4px;flex:none}
        .wq-s span{display:flex;flex-direction:column;min-width:0}.wq-s b{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wq-s i{font-style:normal;color:var(--muted);font-size:12.5px}
        .wq-tn{border:1px solid var(--line);border-radius:calc(var(--r,8px) + 4px);background:var(--panel);padding:12px 14px;margin:6px 0 16px}
        .wq-tnh{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
        .wq-tnh>b{display:flex;gap:6px;align-items:center;font-weight:650}.wq-tnh svg{width:16px;height:16px}
        .wq-tnt{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto}
        .wq-tnp{display:flex;gap:14px;margin-top:12px;align-items:flex-start}
        .wq-tnc{padding:0;border:0;background:var(--hover);border-radius:8px;overflow:hidden;width:92px;aspect-ratio:2/3;flex:none;cursor:pointer}
        .wq-tnc img{width:100%;height:100%;object-fit:cover;display:block}
        .wq-tnx{display:flex;flex-direction:column;gap:3px;min-width:0;font-size:13.5px}
        .wq-tnx b{font-size:17px;font-weight:650}.wq-tnx p{margin:4px 0 0;font-size:13px;line-height:1.45}
        .wq-tnb{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}.wq-tnb svg{width:14px;height:14px}
        .wq-tnn{margin:10px 0 0}
        .wq-tabs{display:flex;gap:4px;border-bottom:1px solid var(--line);margin:6px 0 14px}
        .wq-tabs button{border-radius:0;border-bottom:2px solid transparent;margin-bottom:-1px}
        .wq-tabs button.on{color:var(--text);border-bottom-color:var(--accent)}
        .wq-tabs i{font-style:normal;color:var(--faint)}
        .wq h3{font-size:13px;color:var(--muted);font-weight:600;margin:16px 0 10px}
        .wq-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:18px 14px}
        .wq-it{display:flex;flex-direction:column;gap:6px;min-width:0}
        .wq-pic{padding:0;border:0;background:var(--hover);border-radius:var(--r,8px);overflow:hidden;aspect-ratio:2/3;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.12)}
        .wq-pic img{width:100%;height:100%;object-fit:cover;display:block}
        .wq-none{display:flex;flex-direction:column;gap:8px;align-items:center;justify-content:center;height:100%;color:var(--muted);padding:10px;text-align:center;background:var(--hover)}
        .wq-none svg{width:26px;height:26px}.wq-none b{font-size:13px;color:var(--text);font-weight:600}
        .wq-tx{display:flex;flex-direction:column;min-width:0;font-size:13.5px}
        .wq-tx b{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wq-tx span{font-size:12.5px}
        .wq-done{align-self:flex-start}
        .wq-credit{font-size:12px;color:var(--muted);margin-top:28px}
        small.wq-credit{display:block;margin-top:8px}
        .wq-card{display:flex;gap:14px;margin:12px 0;padding:12px;border:1px solid var(--line);border-radius:var(--r,8px);background:var(--panel)}
        .wq-cp{width:96px;aspect-ratio:2/3;object-fit:cover;border-radius:6px;flex:none}
        .wq-ct{display:flex;flex-direction:column;gap:3px;min-width:0;font-size:13.5px}
        .wq-ct p{margin:6px 0 0;line-height:1.45}
        .wq-cl{display:flex;gap:10px;align-items:center;margin-top:8px}.wq-cl a{display:inline-flex;gap:4px;align-items:center;color:var(--accent)}.wq-cl svg{width:13px;height:13px}
        .wq-alts{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:10px}
        .wq-alt{display:flex;gap:6px;align-items:center;border:1px solid var(--line);background:none;color:var(--text);border-radius:6px;padding:3px 8px 3px 3px;cursor:pointer;font:inherit;font-size:12.5px;max-width:220px}
        .wq-alt img{width:22px;height:33px;object-fit:cover;border-radius:3px}.wq-alt span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wq-alt i{font-style:normal;color:var(--muted)}
        @media (max-width:640px){.wq-grid{grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:14px 10px}.wq-cp{width:72px}}
      `);
    }
  });
})();
