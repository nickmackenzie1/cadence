/* Client intel (Work): what's going on with each client, on their page.
   News (no AI): Google News headlines that actually mention the client, fetched and cached by your NAS. Per client you
   can set the search, words to exclude (for a client called "Apple": fruit, pie) or turn news off.
   Research (AI, optional): reads the client's website (homepage + about page, fetched by the NAS) together with the
   headlines and what Cadence knows, and writes a brief: what they do, at a glance, recent happenings, people, and
   things worth mentioning in the next meeting. Saved on the client. It's told to leave things out rather than guess. */
Cadence.registerPlugin({
  id: 'client-intel', name: 'Client intel', version: '1.0.0', category: 'Clients', spaces: ['work'],
  description: 'News about each client on their page (Google News, filtered to headlines that actually mention them), and an optional AI research brief from their website and the news: what they do, recent happenings, and talking points for your next meeting.',
  tagline: 'News and a research brief on every client', color: '#0a84ff',
  icon: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/><path d="M8 11h6M11 8v6"/>',
  setup(api) {
    const E = api.ui.esc, I = n => api.ui.icon ? api.ui.icon(n) : '';
    const cfg = id => Object.assign({ q: '', exclude: '', off: false }, (api.storage.get('cfg') || {})[id] || {});
    const setCfg = (id, v) => { const all = api.storage.get('cfg') || {}; all[id] = v; api.storage.set('cfg', all); };
    const mem = {};
    const ago = d => { const t = Date.parse(d); if (!t) return ''; const s = (Date.now() - t) / 1000; return s < 3600 ? Math.max(1, Math.round(s / 60)) + 'm' : s < 86400 ? Math.round(s / 3600) + 'h' : s < 86400 * 60 ? Math.round(s / 86400) + 'd' : new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
    const root = c => (c.domain || '').split('.')[0];

    async function news(c, force) {
      const k = c.id, m = mem[k]; if (m && !force && Date.now() - m.at < 30 * 60e3) return m.items;
      const cf = cfg(c.id), q = cf.q || `"${c.name}"${c.domain ? ` OR "${c.domain}"` : ''}`;
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-CA&gl=CA&ceid=CA:en`;
      const r = await fetch('api/feed?ttl=60&url=' + encodeURIComponent(url) + (force ? '&refresh=1' : ''), { cache: 'no-store' });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'news unavailable');
      const names = [c.name.toLowerCase(), root(c).toLowerCase()].filter(x => x && x.length > 2), ex = cf.exclude.toLowerCase().split(',').map(x => x.trim()).filter(Boolean), seen = new Set();
      const items = (j.items || []).map(it => { const m2 = it.title.match(/^(.*)\s+-\s+([^-]+)$/); return { title: m2 ? m2[1] : it.title, source: m2 ? m2[2] : '', link: it.link, date: it.date }; })
        .filter(it => { const t = it.title.toLowerCase(); if (cf.q ? false : !names.some(n => t.includes(n))) return false; if (ex.some(w => t.includes(w))) return false; const key = t.replace(/[^a-z0-9]+/g, ' ').slice(0, 60); if (seen.has(key)) return false; seen.add(key); return true; })
        .sort((a, b) => Date.parse(b.date || 0) - Date.parse(a.date || 0)).slice(0, 12);
      mem[k] = { at: Date.now(), items }; const last = api.storage.get('last') || {}; last[k] = items.slice(0, 6); api.storage.set('last', last);
      return items;
    }

    /* ---------- AI research ---------- */
    async function research(c) {
      if (!api.ai || !api.ai.json) throw new Error('AI isn’t set up on your NAS');
      const j = api.island.progress('ci-' + c.id, `Researching ${c.name}`, { sub: 'Reading their website and the news' });
      let site = { pages: [] }; if (c.domain) { try { site = await (await fetch('api/sitetext?d=' + encodeURIComponent(c.domain))).json(); } catch (e) {} }
      let heads = []; try { heads = (await news(c)).slice(0, 10); } catch (e) {}
      const tasks = api.tasks.list(t => t.clientId === c.id && !t.done).slice(0, 12).map(t => t.title);
      const prompt = `You are preparing a consultant (Zoho implementation partner) for work with a client. Use ONLY the sources below plus well-established public facts you are confident about. If something isn't supported, use null or leave the list empty. Never invent people, numbers or events.

Client: ${c.name}${c.domain ? ` (${c.domain})` : ''}
What Cadence knows: ${c.description || 'nothing yet'}${c.industry ? `; industry: ${c.industry}` : ''}
Open work with them: ${tasks.join('; ') || 'none'}

Website text:
${site.pages.map(p => `[${p.url}] ${p.text}`).join('\n\n').slice(0, 9000) || '(not available)'}

Recent headlines:
${heads.map(h => `- ${h.title} (${h.source}, ${h.date})`).join('\n') || '(none)'}

Return JSON: {"what": "2 sentences on what they do and for whom", "glance": {"size": string|null, "hq": string|null, "founded": string|null, "model": string|null}, "products": [up to 5 short names], "recent": [up to 3 short items from the headlines or site, each with a date if known], "people": [{"name","role"} only if named in the sources], "talking": [3 to 5 specific, friendly things worth mentioning or asking in the next meeting, tied to their business and Zoho where it fits], "watch": [up to 2 things to be careful about, or empty]}`;
      try {
        const out = await api.ai.json(prompt, { modelTier: 'smart' });
        if (!out || !out.what) throw new Error('No answer');
        const rs = { at: Date.now(), what: String(out.what).slice(0, 400), glance: out.glance || {}, products: (out.products || []).slice(0, 5), recent: (out.recent || []).slice(0, 3), people: (out.people || []).slice(0, 5), talking: (out.talking || []).slice(0, 5), watch: (out.watch || []).slice(0, 2), sources: site.pages.map(p => p.url).concat(heads.slice(0, 3).map(h => h.link)) };
        api.clients.update(c.id, { research: rs }); j.done({ title: `${c.name}: brief ready`, sub: `${rs.talking.length} talking points` });
        return rs;
      } catch (e) { j.dismiss && j.dismiss(); throw e; }
    }

    /* ---------- on the client page ---------- */
    function card(c) {
      const cf = cfg(c.id), rs = c.research, pal = (c.brand && c.brand.palette) || [];
      const last = (api.storage.get('last') || {})[c.id] || [];
      const brief = rs ? `<div class="ci-what">${E(rs.what)}</div>
          <div class="ci-glance">${Object.entries({ Size: rs.glance.size, HQ: rs.glance.hq, Founded: rs.glance.founded, Model: rs.glance.model }).filter(([, v]) => v).map(([k, v]) => `<span><em>${k}</em>${E(v)}</span>`).join('')}${(rs.products || []).map(p => `<span class="pr">${E(p)}</span>`).join('')}</div>
          ${rs.talking.length ? `<div class="ci-h">${I('message-circle') || ''}Worth mentioning next time</div><ul class="ci-talk">${rs.talking.map(t => `<li>${E(t)}</li>`).join('')}</ul>` : ''}
          ${rs.recent.length ? `<div class="ci-h">Recently</div><ul>${rs.recent.map(t => `<li>${E(typeof t === 'string' ? t : t.text || JSON.stringify(t))}</li>`).join('')}</ul>` : ''}
          ${rs.people.length ? `<div class="ci-h">People</div><div class="ci-people">${rs.people.map(p => `<span><b>${E(p.name)}</b>${p.role ? ' · ' + E(p.role) : ''}</span>`).join('')}</div>` : ''}
          ${rs.watch.length ? `<div class="ci-h">Careful</div><ul class="ci-watch">${rs.watch.map(t => `<li>${E(t)}</li>`).join('')}</ul>` : ''}
          <div class="ci-foot">Researched ${E(ago(new Date(rs.at).toUTCString()))} ago${pal.length ? `<span class="ci-pal">${pal.slice(0, 5).map(x => `<i style="background:${E(x)}"></i>`).join('')}</span>` : ''}<button class="ci-link" data-ci="research">Refresh</button></div>`
        : `<div class="ci-empty">${api.ai ? `<p>Get a short brief from their website and the news: what they do, what’s new, and things worth mentioning next time.</p><button class="btn primary" data-ci="research">Research with AI</button>` : '<p class="muted">Add an Anthropic API key on your NAS to get an AI research brief here.</p>'}</div>`;
      return `<section class="ci" data-cid="${E(c.id)}">
        <div class="ci-card ci-brief"><div class="ci-top"><b>About ${E(c.name)}</b>${c.hasBanner && c.domain ? `<img class="ci-ban" src="api/banner?d=${encodeURIComponent(c.domain)}" alt="" onerror="this.remove()">` : ''}</div>${brief}</div>
        <div class="ci-card ci-news"><div class="ci-top"><b>In the news</b><span><button class="ci-link" data-ci="refresh" title="Refresh">${I('refresh-cw') || 'Refresh'}</button><button class="ci-link" data-ci="cfg" title="News settings for this client">${I('settings') || 'Settings'}</button></span></div>
          <div class="ci-list">${cf.off ? '<p class="muted">News is off for this client.</p>' : last.length ? list(last) : '<p class="muted">Looking…</p>'}</div></div>
      </section>`;
    }
    const list = items => items.length ? items.slice(0, 6).map(it => `<a class="ci-item" href="${E(it.link)}" target="_blank" rel="noopener"><span>${E(it.title)}</span><em>${E(it.source)}${it.source && it.date ? ' · ' : ''}${E(ago(it.date))}</em></a>`).join('') : '<p class="muted">No recent news mentions them. Try a different search in the settings.</p>';
    function mount(c) {
      const hero = document.querySelector('#view .c-hero'); if (!hero || document.querySelector('#view .ci')) return;
      const cols = document.querySelector('#view .cols');   // below the work, so the page still opens on the tasks
      (cols || hero).insertAdjacentHTML('afterend', card(c));
      const el = document.querySelector('#view .ci'), cf = cfg(c.id);
      if (!cf.off) news(c).then(items => { const l = el.querySelector('.ci-list'); if (l && l.isConnected) l.innerHTML = list(items); }).catch(e => { const l = el.querySelector('.ci-list'); if (l) l.innerHTML = `<p class="muted">${E(e.message)}</p>`; });
      el.onclick = async e => { const b = e.target.closest('[data-ci]'); if (!b) return; const a = b.dataset.ci;
        if (a === 'research') { b.disabled = true; b.textContent = 'Researching…'; try { await research(api.clients.get(c.id)); api.ui.refresh(); } catch (err) { api.ui.toast(err.message); b.disabled = false; b.textContent = 'Research with AI'; } }
        if (a === 'refresh') { el.querySelector('.ci-list').innerHTML = '<p class="muted">Looking…</p>'; news(c, true).then(items => el.querySelector('.ci-list').innerHTML = list(items)).catch(err => el.querySelector('.ci-list').innerHTML = `<p class="muted">${E(err.message)}</p>`); }
        if (a === 'cfg') settings(c); };
    }
    function settings(c) {
      const cf = cfg(c.id);
      api.ui.modal(`News about ${c.name}`, `<div class="field"><label>Search</label><input class="inp" id="ci-q" value="${E(cf.q)}" placeholder='"${E(c.name)}"${c.domain ? ` OR "${E(c.domain)}"` : ''}'><div class="muted" style="font-size:12px;margin-top:6px">Leave empty for the default. With a custom search every result is kept; otherwise only headlines that mention ${E(c.name)}.</div></div>
        <div class="field"><label>Leave out headlines containing</label><input class="inp" id="ci-x" value="${E(cf.exclude)}" placeholder="comma-separated, e.g. recipe, fruit"></div>
        <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ci-off" ${cf.off ? 'checked' : ''}> No news for this client</label>`,
        `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="ci-save">Save</button>`);
      document.getElementById('ci-save').onclick = () => { setCfg(c.id, { q: document.getElementById('ci-q').value.trim(), exclude: document.getElementById('ci-x').value.trim(), off: document.getElementById('ci-off').checked }); delete mem[c.id]; api.ui.close(); api.ui.refresh(); };
    }
    api.on('render', ({ route }) => { if (!route || !route.startsWith('client-')) return; const c = api.clients.get(route.slice(7)); if (c && c.kind !== 'project') mount(c); });
    api.clientActions.add({ label: 'Research with AI', run: async (c) => { try { await research(c); api.ui.refresh(); } catch (e) { api.ui.toast(e.message); } } });
    api.widgets.add({ id: 'news', title: 'Client news', icon: 'newspaper', size: 'm', spaces: ['work'], description: 'Latest headlines about your clients.', render: el => {
      const last = api.storage.get('last') || {}, rows = [];
      for (const c of api.clients.list()) for (const it of (last[c.id] || []).slice(0, 2)) rows.push({ c, it });
      rows.sort((a, b) => Date.parse(b.it.date || 0) - Date.parse(a.it.date || 0));
      el.innerHTML = rows.length ? `<div class="dw-list">${rows.slice(0, 8).map(({ c, it }) => `<a class="dw-row" href="${E(it.link)}" target="_blank" rel="noopener">${api.ui.avatar(c, 18)}<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${E(it.title)}</span><em>${E(ago(it.date))}</em></a>`).join('')}</div>` : '<div class="dw-empty">Open a client to fetch their news.</div>';
    } });

    if (!document.getElementById('ci-css')) { const st = document.createElement('style'); st.id = 'ci-css'; st.textContent = `
      .ci{display:grid;grid-template-columns:1.25fr 1fr;gap:14px;margin:22px 0}
      @media (max-width:1000px){.ci{grid-template-columns:1fr}}
      .ci-card{border:1px solid var(--line);border-radius:var(--r-xl);background:var(--panel);padding:14px 16px;min-width:0}
      .ci-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}.ci-top b{font-size:14px}.ci-top span{display:flex;gap:2px}
      .ci-ban{height:28px;max-width:120px;object-fit:cover;border-radius:var(--r-s);opacity:.9}
      .ci-what{font-size:14px;line-height:1.55;margin-bottom:10px}
      .ci-glance{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}.ci-glance span{font-size:12px;padding:3px 9px;border-radius:999px;background:var(--hover)}.ci-glance em{font-style:normal;color:var(--muted);margin-right:5px}.ci-glance .pr{background:var(--accent-soft);color:var(--accent);font-weight:600}
      .ci-h{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin:10px 0 4px}
      .ci ul{margin:0;padding-left:18px;font-size:13px;line-height:1.55}.ci-talk li::marker{color:var(--accent)}.ci-watch li::marker{color:var(--danger)}
      .ci-people{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:13px}.ci-people span{color:var(--muted)}.ci-people b{color:var(--text);font-weight:600}
      .ci-foot{display:flex;align-items:center;gap:10px;margin-top:12px;font-size:12px;color:var(--faint)}.ci-pal{display:flex;gap:3px}.ci-pal i{width:12px;height:12px;border-radius:3px}
      .ci-link{font-size:12px;color:var(--muted);padding:3px 6px;border-radius:var(--r-s)}.ci-link:hover{background:var(--hover);color:var(--text)}.ci-foot .ci-link{margin-left:auto}
      .ci-empty p{margin:0 0 10px;color:var(--muted);font-size:13px;line-height:1.5}
      .ci-list{display:flex;flex-direction:column}
      .ci-item{display:flex;flex-direction:column;gap:2px;padding:7px 4px;border-radius:var(--r-m);text-decoration:none;color:var(--text)}.ci-item+.ci-item{border-top:1px solid var(--line)}.ci-item:hover{background:var(--hover)}
      .ci-item span{font-size:13px;line-height:1.4}.ci-item em{font-style:normal;font-size:12px;color:var(--faint)}
    `; document.head.appendChild(st); }
  }
});
