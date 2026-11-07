/* Feeds — a generic RSS/Atom plugin with placements and styles.
   Placements: sidebar (one slim "now spinning" row that rotates through items), home (a shelf under
   the day-at-a-glance row), or only in the Feeds view. Styles: records (vinyl that slides out of its
   sleeve and spins), cards, or a plain list. The NAS fetches and caches feeds (api/feed). */
(() => {
  const G = window.__rss = window.__rss || { cache: {} };
  if (!G.style) {
    G.style = document.createElement('style');
    G.style.textContent = `
      /* vinyl */
      .vin{position:relative;flex:none;border-radius:50%;background:repeating-radial-gradient(circle at 50% 50%,#121114 0 1.2px,#1d1b20 1.2px 2.4px);box-shadow:0 2px 8px rgba(0,0,0,.35),inset 0 0 0 1px rgba(255,255,255,.04)}
      .vin:before{content:"";position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 30deg,transparent 0 12%,rgba(255,255,255,.10) 16%,transparent 22% 60%,rgba(255,255,255,.07) 64%,transparent 70%)}
      .vin .lab{position:absolute;inset:31%;border-radius:50%;background:#c44 center/cover;box-shadow:0 0 0 1px rgba(0,0,0,.4)}
      .vin .lab:after{content:"";position:absolute;left:50%;top:50%;width:12%;height:12%;margin:-6% 0 0 -6%;border-radius:50%;background:#0d0c10}
      .vin.spin{animation:vinspin 3.2s linear infinite}
      @keyframes vinspin{to{transform:rotate(360deg)}}
      /* sidebar row */
      .rs-row{display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:10px;cursor:pointer;text-decoration:none;color:var(--text);transition:background .15s;min-width:0}
      .rs-row:hover{background:var(--hover)}
      .rs-row .vin{width:34px;height:34px;animation:vinspin 9s linear infinite}
      .rs-row:hover .vin{animation-duration:2.2s}
      .rs-row .tx{min-width:0;flex:1;line-height:1.25}
      .rs-row .tx b{display:block;font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .rs-row .tx span{display:block;font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .rs-row .tx.fade{animation:rsfade .5s ease}
      @keyframes rsfade{from{opacity:0;transform:translateY(4px)}}
      .rs-row .nxt{opacity:0;color:var(--muted);font-size:13px;padding:2px 4px;border-radius:5px;transition:opacity .15s}
      .rs-row:hover .nxt{opacity:1}.rs-row .nxt:hover{background:var(--line);color:var(--text)}
      .rs-cardmini{width:34px;height:34px;border-radius:8px;background:var(--hover) center/cover;flex:none}
      /* wall: Pinterest-style masonry, covers at their natural shape */
      .rs-wall{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));grid-auto-rows:4px;grid-auto-flow:dense;column-gap:18px}
      .rs-pin{display:block;text-decoration:none;color:var(--text);align-self:start}
      .rs-pin.big{grid-column:span 2}
      .rs-pin .ph{position:relative;border-radius:12px;overflow:hidden;background:var(--hover);box-shadow:0 1px 1px rgba(0,0,0,.04),0 6px 18px -6px rgba(40,30,10,.22);transform:translateZ(0);transition:transform .35s cubic-bezier(.2,.9,.25,1),box-shadow .35s}
      .rs-pin .ph img{display:block;width:100%;height:auto;transform:scale(1.035);transition:transform .6s cubic-bezier(.2,.9,.25,1),opacity .4s;opacity:0}
      .rs-pin .ph img.in{opacity:1}
      .rs-pin .ph:after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06);background:linear-gradient(180deg,transparent 55%,rgba(0,0,0,.42));opacity:0;transition:opacity .3s}
      .rs-pin:hover .ph{transform:translateY(-3px);box-shadow:0 2px 2px rgba(0,0,0,.04),0 16px 34px -10px rgba(40,30,10,.35)}
      .rs-pin:hover .ph img{transform:scale(1.07)}
      .rs-pin:hover .ph:after{opacity:1}
      .rs-pin .go{position:absolute;z-index:1;right:10px;bottom:10px;font-size:11.5px;font-weight:600;color:#fff;background:rgba(255,255,255,.18);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding:5px 10px;border-radius:999px;opacity:0;transform:translateY(4px);transition:all .3s}
      .rs-pin:hover .go{opacity:1;transform:none}
      .rs-pin .new{position:absolute;z-index:1;left:10px;top:10px;font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#fff;background:#e5484d;padding:3px 7px;border-radius:999px}
      .rs-pin .cap{padding:9px 4px 18px;line-height:1.3}
      .rs-pin .cap b{display:block;font-size:13px;font-weight:650}
      .rs-pin .cap span{display:block;font-size:12.5px;opacity:.85}
      .rs-pin .cap i{display:block;font-style:normal;font-size:11.5px;color:var(--muted);margin-top:2px}
      .rs-pin.big .cap b{font-size:15px}.rs-pin.big .cap span{font-size:13.5px}
      /* timeline */
      .rs-tabs{display:inline-flex;background:var(--hover);border-radius:9px;padding:2px;margin-right:auto}
      .rs-tabs button{font-size:12.5px;padding:5px 12px;border-radius:7px;color:var(--muted)}
      .rs-tabs button.on{background:var(--panel);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.08)}
      .rs-tl{position:relative;padding-left:22px}
      .rs-tl:before{content:"";position:absolute;left:6px;top:8px;bottom:8px;width:2px;background:var(--line);border-radius:2px}
      .rs-day{position:sticky;top:0;z-index:2;font-size:12px;font-weight:650;color:var(--muted);padding:14px 0 8px;background:linear-gradient(var(--bg) 70%,transparent)}
      .rs-panel .rs-day{background:linear-gradient(var(--panel) 70%,transparent)}
      .rs-day:before{content:"";position:absolute;left:-20px;top:18px;width:10px;height:10px;border-radius:50%;background:var(--panel);border:2px solid var(--muted)}
      .rs-day.new:before{border-color:#e5484d;background:#e5484d}
      .rs-ti{display:flex;gap:12px;align-items:center;padding:7px 8px;margin:0 -8px;border-radius:10px;text-decoration:none;color:var(--text);animation:rsfade .4s ease both}
      .rs-ti:hover{background:var(--hover)}
      .rs-ti img{width:52px;height:52px;border-radius:7px;object-fit:cover;flex:none;box-shadow:0 2px 8px -2px rgba(0,0,0,.25);background:var(--hover)}
      .rs-ti .tx{min-width:0;flex:1;line-height:1.3}
      .rs-ti .tx b{display:block;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .rs-ti .tx span{display:block;font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .rs-ti .t{font-size:11px;color:var(--muted);flex:none;font-variant-numeric:tabular-nums}
      .rs-ti .dot{width:7px;height:7px;border-radius:50%;background:#e5484d;flex:none}
      .rs-panel{position:fixed;z-index:70;top:10px;right:10px;bottom:10px;width:min(400px,calc(100vw - 20px));background:var(--panel);border:1px solid var(--line);border-radius:18px;box-shadow:0 30px 80px -20px rgba(0,0,0,.35);display:flex;flex-direction:column;transform:translateX(calc(100% + 30px));transition:transform .45s cubic-bezier(.2,.9,.25,1)}
      .rs-panel.on{transform:none}
      .rs-panel .hd{display:flex;align-items:center;gap:10px;padding:16px 18px 8px}
      .rs-panel .hd b{font-size:15px}.rs-panel .hd .x{margin-left:auto;font-size:18px;color:var(--muted);padding:2px 8px;border-radius:7px}.rs-panel .hd .x:hover{background:var(--hover)}
      .rs-panel .bd{flex:1;overflow:auto;padding:0 18px 18px}
      .rs-row .exp{opacity:0;color:var(--muted);font-size:12px;padding:2px 4px;border-radius:5px;transition:opacity .15s}
      .rs-row:hover .exp{opacity:1}.rs-row .exp:hover{background:var(--line);color:var(--text)}
      /* shelf / crate */
      .rs-shelf{margin:0 0 24px}
      .rs-shelf-h{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:var(--muted);padding:0 4px 10px}
      .rs-shelf-h a{color:var(--muted);text-decoration:none;margin-left:auto;font-weight:500}.rs-shelf-h a:hover{color:var(--text)}
      .rs-crate{display:flex;gap:22px;overflow-x:auto;padding:6px 4px 14px;scroll-snap-type:x mandatory;scrollbar-width:thin}
      .rs-rec{position:relative;flex:none;width:132px;scroll-snap-align:start;text-decoration:none;color:var(--text)}
      .rs-rec .wrap{position:relative;width:118px;height:118px}
      .rs-rec .vin{position:absolute;top:5px;left:5px;width:108px;height:108px;transition:transform .55s cubic-bezier(.3,1.3,.5,1)}
      .rs-rec .sl{position:absolute;inset:0;border-radius:4px;background:#ddd center/cover;box-shadow:0 1px 2px rgba(0,0,0,.15),0 8px 20px rgba(0,0,0,.18);transition:transform .45s cubic-bezier(.3,1.3,.5,1)}
      .rs-rec .sl:after{content:"";position:absolute;inset:0;border-radius:4px;background:linear-gradient(115deg,rgba(255,255,255,.22),transparent 40%,transparent 70%,rgba(0,0,0,.08))}
      .rs-rec:hover .vin{transform:translateX(40px) rotate(200deg)}
      .rs-rec:hover .sl{transform:translateX(-6px) rotate(-1.5deg)}
      .rs-rec .ar{font-size:12.5px;font-weight:650;margin-top:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .rs-rec .al{font-size:12px;color:var(--text);opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .rs-rec .dt{font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
      .rs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:26px 20px}
      .rs-grid .rs-rec{width:auto}.rs-grid .rs-rec .wrap{width:100%;height:auto;aspect-ratio:1}.rs-grid .rs-rec .vin{width:92%;height:92%;top:4%;left:4%}
      .rs-card{display:flex;flex-direction:column;gap:6px;text-decoration:none;color:var(--text);flex:none;width:220px}
      .rs-card .im{aspect-ratio:16/10;border-radius:10px;background:var(--hover) center/cover;border:1px solid var(--line)}
      .rs-card b{font-size:13px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .rs-card span{font-size:11.5px;color:var(--muted)}
      .rs-list a{display:flex;gap:10px;padding:9px 6px;border-bottom:1px solid var(--line);text-decoration:none;color:var(--text);font-size:13.5px}
      .rs-list a span{margin-left:auto;color:var(--muted);font-size:12px;white-space:nowrap}
      .rs-feedcfg{display:grid;grid-template-columns:1fr auto auto auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)}
      .rs-feedcfg .nm{min-width:0}.rs-feedcfg .nm b{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rs-feedcfg .nm small{color:var(--muted);font-size:11px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .rs-feedcfg select{padding:5px 8px}
    `;
    document.head.appendChild(G.style);
  }

  const DEFAULT = [{ id: 'f1', url: 'https://www.somethingelserecords.ca/index.rss', title: 'Something Else Records', placement: 'sidebar', style: 'records' }];
  const ago = d => { const t = Date.parse(d); if (!t) return ''; const s = (Date.now() - t) / 1000; return s < 3600 ? Math.max(1, Math.round(s / 60)) + 'm ago' : s < 86400 ? Math.round(s / 3600) + 'h ago' : s < 86400 * 30 ? Math.round(s / 86400) + 'd ago' : new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
  // "Artist - Album (details) (more)" -> parts, for record-store style titles
  const split = title => { const m = title.match(/^(.+?)\s+[-–—]\s+(.+)$/); if (!m) return { a: title, b: '', d: '' }; const det = m[2].match(/^(.*?)\s*(\(.*)$/); return det ? { a: m[1], b: det[1] || m[2], d: det[2].replace(/^\(|\)$/g, '').replace(/\)\s*\(/g, ' · ') } : { a: m[1], b: m[2], d: '' }; };

  Cadence.registerPlugin({
    id: 'rss', name: 'Feeds', version: '1.0.0', settings: () => window.__rss.manage && window.__rss.manage(), icon: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 5.5a6.5 6.5 0 016.5 6.5"/>', color: '#2a2622', category: 'Look & feel', tagline: 'Feeds as a record shelf',
    description: 'Follow RSS/Atom feeds in Cadence. Put each one in the sidebar (one slim rotating row), on the home page (a shelf), or only in the Feeds view — styled as vinyl records, cards or a list.',
    setup(api) {
      const E = api.ui.esc;
      const feeds = () => api.storage.get('feeds') || DEFAULT;
      async function load(f, force) {
        const c = G.cache[f.url]; if (c && !force && Date.now() - c.at < 15 * 60 * 1000) return c.data;
        // the NAS connection is confirmed a moment after startup — give it a few seconds
        for (let i = 0; i < 20 && api.system().mode !== 'nas'; i++) await new Promise(r => setTimeout(r, 250));
        if (api.system().mode !== 'nas') throw new Error('Feeds are fetched by your NAS');
        const r = await fetch('api/feed?url=' + encodeURIComponent(f.url) + (force ? '&refresh=1' : ''), { cache: 'no-store' });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || 'feed error');
        G.cache[f.url] = { at: Date.now(), data: j }; return j;
      }
      const recHtml = (it, f, big) => { const p = f.style === 'records' ? split(it.title) : { a: it.title, b: '', d: '' };
        return `<a class="rs-rec" href="${E(it.link)}" target="_blank" rel="noopener" title="${E(it.title)}"><div class="wrap"><div class="vin"><div class="lab" style="background-image:url('${E(it.image)}')"></div></div><div class="sl" style="background-image:url('${E(it.image)}')"></div></div><div class="ar">${E(p.a)}</div>${p.b ? `<div class="al">${E(p.b)}</div>` : ''}<div class="dt">${E(p.d || ago(it.date))}</div></a>`; };
      const cardHtml = it => `<a class="rs-card" href="${E(it.link)}" target="_blank" rel="noopener"><div class="im" style="background-image:url('${E(it.image)}')"></div><b>${E(it.title)}</b><span>${E(ago(it.date))}</span></a>`;
      const listHtml = it => `<a href="${E(it.link)}" target="_blank" rel="noopener">${E(it.title)}<span>${E(ago(it.date))}</span></a>`;
      /* wall (masonry) + timeline */
      const parts = (it, f) => f.style === 'records' ? split(it.title) : { a: it.title, b: f.title || '', d: '' };
      const seen = () => api.storage.get('seen') || 0;
      function wallHtml(f, data, max) {
        const s0 = G.prevSeen != null ? G.prevSeen : seen();
        return `<div class="rs-wall">${data.items.slice(0, max).map((it, i) => { const p = parts(it, f), fresh = s0 && it.date && new Date(it.date).getTime() > s0;
          return `<a class="rs-pin ${i % 9 === 0 ? 'big' : ''}" href="${E(it.link)}" target="_blank" rel="noopener" title="${E(it.title)}"><div class="ph">${fresh ? '<span class="new">New</span>' : ''}${it.image ? `<img src="${E(it.image)}" alt="" loading="lazy" decoding="async">` : ''}<span class="go">Open ↗</span></div><div class="cap"><b>${E(p.a)}</b>${p.b ? `<span>${E(p.b)}</span>` : ''}<i>${E(p.d || ago(it.date))}</i></div></a>`; }).join('')}</div>`;
      }
      function layoutWall(root) {
        root.querySelectorAll('.rs-wall').forEach(w => {
          const fit = pin => { const h = pin.getBoundingClientRect().height; pin.style.gridRowEnd = 'span ' + Math.ceil((h + 4) / 4); };
          w.querySelectorAll('.rs-pin').forEach(pin => { const img = pin.querySelector('img');
            if (!img) return fit(pin);
            const done = () => { img.classList.add('in'); fit(pin); };
            if (img.complete && img.naturalWidth) done(); else { pin.style.gridRowEnd = 'span 60'; img.onload = done; img.onerror = () => { img.remove(); fit(pin); }; } });
          if (!w._ro) { let last = w.clientWidth; w._ro = new ResizeObserver(() => { if (Math.abs(w.clientWidth - last) < 2) return; last = w.clientWidth; w.querySelectorAll('.rs-pin').forEach(fit); }); w._ro.observe(w); }
        });
      }
      async function timelineHtml(list) {
        const s0 = seen(), all = [];
        await Promise.all(list.map(f => load(f).then(d => d.items.forEach(it => all.push({ it, f }))).catch(() => {})));
        all.sort((a, b) => new Date(b.it.date || 0) - new Date(a.it.date || 0));
        if (!all.length) return '<div class="muted" style="font-size:13px;padding:8px 0">Nothing yet.</div>';
        const dayName = d => { if (!d) return 'Earlier'; const x = new Date(d), t = new Date(); const diff = Math.round((new Date(t.toDateString()) - new Date(x.toDateString())) / 864e5); return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff < 7 ? x.toLocaleDateString(undefined, { weekday: 'long' }) : x.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }); };
        let out = '', cur = null, n = 0;
        for (const { it, f } of all.slice(0, 150)) {
          const dn = dayName(it.date), fresh = s0 && it.date && new Date(it.date).getTime() > s0, p = parts(it, f);
          if (dn !== cur) { cur = dn; out += `<div class="rs-day ${fresh ? 'new' : ''}">${E(dn)}</div>`; }
          out += `<a class="rs-ti" href="${E(it.link)}" target="_blank" rel="noopener" style="animation-delay:${Math.min(n++, 20) * 25}ms">${it.image ? `<img src="${E(it.image)}" alt="" loading="lazy">` : ''}<div class="tx"><b>${E(p.a)}</b><span>${E([p.b, list.length > 1 ? f.title : ''].filter(Boolean).join(' · ') || p.d)}</span></div>${fresh ? '<span class="dot" title="New since your last visit"></span>' : ''}<span class="t">${it.date ? new Date(it.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}</span></a>`;
        }
        const nNew = all.filter(x => s0 && x.it.date && new Date(x.it.date).getTime() > s0).length;
        return (nNew ? `<div style="font-size:12px;color:#e5484d;font-weight:600;padding:4px 0 0">${nNew} new since your last look</div>` : '') + `<div class="rs-tl">${out}</div>`;
      }
      const markSeen = () => { G.prevSeen = seen(); api.storage.set('seen', Date.now()); };
      async function openPanel(f) {
        let p = document.querySelector('.rs-panel');
        if (!p) { p = document.createElement('div'); p.className = 'rs-panel'; document.body.appendChild(p);
          document.addEventListener('keydown', e => { if (e.key === 'Escape') p.classList.remove('on'); });
          document.addEventListener('pointerdown', e => { if (p.classList.contains('on') && !p.contains(e.target) && !e.target.closest('.rs-row')) p.classList.remove('on'); }, true); }
        const list = f ? [f] : feeds();
        p.innerHTML = `<div class="hd"><span class="vin spin" style="width:18px;height:18px"><span class="lab"></span></span><b>${E(f ? f.title || 'Feed' : 'All feeds')}</b><button class="x" title="Close">×</button></div><div class="bd"><div class="muted" style="font-size:13px">Loading…</div></div>`;
        p.querySelector('.x').onclick = () => p.classList.remove('on');
        requestAnimationFrame(() => p.classList.add('on'));
        p.querySelector('.bd').innerHTML = (`<div class="row" style="margin:4px 0 2px"><a href="#view-feeds" style="font-size:12px;color:var(--muted)">Open the wall ›</a></div>`) + await timelineHtml(list);
        markSeen();
      }
      G.openPanel = openPanel;
      // new arrivals since your last look → one Island notice per feed per session
      function announce(f, d) {
        G.told = G.told || {}; const s0 = seen(); if (!s0 || G.told[f.id]) return; G.told[f.id] = 1;
        const fresh = d.items.filter(it => it.date && new Date(it.date).getTime() > s0); if (!fresh.length) return;
        const p = parts(fresh[0], f);
        setTimeout(() => api.island.show({ image: fresh[0].image ? `<img src="${E(fresh[0].image)}" alt="">` : '', icon: fresh[0].image ? '' : '◉', title: `${fresh.length} new at ${f.title || 'your feed'}`, sub: p.b ? `${p.a} — ${p.b}` : p.a, ms: 7000,
          actions: [{ label: 'Timeline', run: () => openPanel(f) }, { label: 'Wall', run: () => api.ui.navigate('view-feeds') }] }), 9000);
      }
      function itemsHtml(f, data, max, grid) {
        const items = data.items.slice(0, max);
        if (f.style === 'list') return `<div class="rs-list">${items.map(listHtml).join('')}</div>`;
        if (f.style === 'cards') return `<div class="${grid ? 'rs-grid' : 'rs-crate'}">${items.map(cardHtml).join('')}</div>`;
        if (grid) return wallHtml(f, data, max);
        return `<div class="rs-crate">${items.map(it => recHtml(it, f)).join('')}</div>`;
      }

      /* sidebar: one slim row per feed that slowly rotates through the latest items */
      api.sidebar.add({ id: 'rss', slot: 'bottom', order: 30, render: el => {
        const list = feeds().filter(f => f.placement === 'sidebar'); if (!list.length) { el.style.display = 'none'; return; }
        el.innerHTML = list.map(f => `<a class="rs-row" data-f="${f.id}" target="_blank" rel="noopener"><span class="vin"><span class="lab"></span></span><span class="tx"><b>${E(f.title || 'Feed')}</b><span>loading…</span></span><span class="exp" title="Timeline">⤢</span><span class="nxt" title="Next">›</span></a>`).join('');
        list.forEach(f => {
          const row = el.querySelector(`[data-f="${f.id}"]`); let i = 0, data = null;
          const show = (anim) => {
            if (!data || !data.items.length) return; const it = data.items[i % data.items.length], p = f.style === 'records' ? split(it.title) : { a: it.title, b: f.title };
            row.href = it.link; row.title = it.title + (f.title ? ' — ' + f.title : '');
            const vis = row.firstElementChild;
            if (f.style === 'records') { vis.className = 'vin'; vis.innerHTML = '<span class="lab"></span>'; vis.firstChild.style.backgroundImage = `url('${it.image}')`; }
            else { vis.className = 'rs-cardmini'; vis.innerHTML = ''; vis.style.backgroundImage = it.image ? `url('${it.image}')` : ''; }
            const tx = row.querySelector('.tx'); tx.innerHTML = `<b>${E(p.a)}</b><span>${E(p.b || f.title || '')}</span>`; if (anim) { tx.classList.remove('fade'); void tx.offsetWidth; tx.classList.add('fade'); }
          };
          row.querySelector('.exp').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openPanel(f); });
          row.querySelector('.vin, .rs-cardmini') && row.firstElementChild.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openPanel(f); });
          row.querySelector('.nxt').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); i++; show(true); });
          load(f).then(d => { data = d; show(); announce(f, d); }).catch(err => { row.querySelector('.tx span').textContent = err.message; row.removeAttribute('href'); });
          clearInterval(G['t' + f.id]); G['t' + f.id] = setInterval(() => { if (!row.isConnected) return clearInterval(G['t' + f.id]); if (!row.matches(':hover')) { i++; show(true); } }, 9000);
        });
      }});

      /* home: a shelf under the day-at-a-glance row */
      api.on('render', ({ route }) => {
        if (route !== 'today') return;
        const list = feeds().filter(f => f.placement === 'home'); if (!list.length) return;
        const anchor = document.querySelector('#view .glance') || document.querySelector('#view .head'); if (!anchor || document.querySelector('#view .rs-shelf')) return;
        list.slice().reverse().forEach(f => {
          const sh = document.createElement('div'); sh.className = 'rs-shelf';
          sh.innerHTML = `<div class="rs-shelf-h">${f.style === 'records' ? '<span class="vin spin" style="width:14px;height:14px"><span class="lab"></span></span>' : ''}${E(f.title || 'Feed')}<a href="#view-feeds">All ›</a></div><div class="muted" style="font-size:12px;padding:0 4px">Loading…</div>`;
          anchor.after(sh);
          load(f).then(d => { sh.lastElementChild.outerHTML = itemsHtml(f, d, 14); }).catch(e => { sh.lastElementChild.textContent = e.message; });
        });
      });

      /* full view */
      api.views.add({ id: 'feeds', title: 'Feeds', icon: '◉', subtitle: 'Your RSS and Atom feeds', render: (el) => {
        const list = feeds();
        const mode = api.storage.get('viewMode') || 'wall';
        el.innerHTML = `<div class="row" style="justify-content:flex-end;align-items:center;margin:-10px 0 18px"><div class="rs-tabs"><button data-m="wall" class="${mode === 'wall' ? 'on' : ''}">Wall</button><button data-m="timeline" class="${mode === 'timeline' ? 'on' : ''}">Timeline</button></div><button class="btn" id="rs-cfg">Manage feeds</button></div>` + (mode === 'timeline' ? '<div id="rs-tlv" class="muted" style="font-size:13px">Loading…</div>' : list.map(f => `<div class="group" data-f="${f.id}"><div class="group-h">${E(f.title || f.url)}<span class="c"></span></div><div class="muted" style="padding:8px 4px;font-size:13px">Loading…</div></div>`).join('')) + (list.length ? '' : '<div class="empty"><b>No feeds yet</b>Add one with Manage feeds.</div>');
        el.querySelector('#rs-cfg').onclick = manage;
        el.querySelectorAll('.rs-tabs button').forEach(b => b.onclick = () => { api.storage.set('viewMode', b.dataset.m); api.ui.refresh(); });
        if (mode === 'timeline') { timelineHtml(list).then(h => { const t = el.querySelector('#rs-tlv'); if (t) { t.className = ''; t.innerHTML = h; markSeen(); } }); return; }
        let pending = list.length;
        list.forEach(f => { const g = el.querySelector(`[data-f="${f.id}"]`); load(f).then(d => { g.querySelector('.c').textContent = d.items.length; g.lastElementChild.outerHTML = itemsHtml(f, d, 40, true); layoutWall(g); }).catch(e => { g.lastElementChild.textContent = e.message; }).finally(() => { if (!--pending) markSeen(); }); });
      }});

      /* settings */
      G.manage = () => manage();
      function manage() {
        const list = feeds().map(f => ({ ...f }));
        const draw = () => {
          api.ui.modal('Feeds', `
            <div>${list.map((f, i) => `<div class="rs-feedcfg" data-i="${i}"><div class="nm"><b>${E(f.title || 'Untitled')}</b><small>${E(f.url)}</small></div>
              <select class="inp" data-k="placement">${[['sidebar', 'Sidebar'], ['home', 'Home shelf'], ['view', 'Feeds view only']].map(([v, l]) => `<option value="${v}" ${f.placement === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
              <select class="inp" data-k="style">${[['records', 'Records'], ['cards', 'Cards'], ['list', 'List']].map(([v, l]) => `<option value="${v}" ${f.style === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
              <button class="btn ghost danger" data-del="${i}">✕</button></div>`).join('') || '<div class="muted">No feeds.</div>'}</div>
            <div class="field"><label>Add a feed</label><div class="row"><input class="inp" id="rs-url" placeholder="https://example.com/feed.xml"><button class="btn" id="rs-add">Add</button></div><div class="muted" id="rs-msg" style="font-size:12px;margin-top:6px">The sidebar shows one slim row per feed; the home shelf sits under your day-at-a-glance.</div></div>`,
            `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" id="rs-save">Save</button>`, 'wide');
          document.querySelectorAll('.rs-feedcfg select').forEach(s => s.onchange = () => { list[+s.closest('[data-i]').dataset.i][s.dataset.k] = s.value; });
          document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { list.splice(+b.dataset.del, 1); draw(); });
          document.querySelector('#rs-add').onclick = async () => {
            const url = document.querySelector('#rs-url').value.trim(), msg = document.querySelector('#rs-msg'); if (!url) return;
            msg.textContent = 'Checking feed…';
            try { const d = await load({ url }, true); list.push({ id: 'f' + Date.now().toString(36), url, title: d.title || new URL(url).hostname, placement: 'view', style: d.items.some(i => i.image) ? 'cards' : 'list' }); draw(); }
            catch (e) { msg.textContent = e.message; }
          };
          document.querySelector('#rs-save').onclick = () => { api.storage.set('feeds', list); api.ui.close(); api.ui.toast('Feeds saved'); api.ui.refreshWidgets && api.ui.refreshWidgets(); api.ui.refresh(); };
        };
        draw();
      }
      api.commands.add({ title: 'Manage feeds', run: () => manage() });
    }
  });
})();
