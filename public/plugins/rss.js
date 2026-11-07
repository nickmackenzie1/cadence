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
    id: 'rss', name: 'Feeds', version: '1.0.0',
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
      function itemsHtml(f, data, max, grid) {
        const items = data.items.slice(0, max);
        if (f.style === 'list') return `<div class="rs-list">${items.map(listHtml).join('')}</div>`;
        if (f.style === 'cards') return `<div class="${grid ? 'rs-grid' : 'rs-crate'}">${items.map(cardHtml).join('')}</div>`;
        return `<div class="${grid ? 'rs-grid' : 'rs-crate'}">${items.map(it => recHtml(it, f)).join('')}</div>`;
      }

      /* sidebar: one slim row per feed that slowly rotates through the latest items */
      api.sidebar.add({ id: 'rss', slot: 'bottom', order: 30, render: el => {
        const list = feeds().filter(f => f.placement === 'sidebar'); if (!list.length) { el.style.display = 'none'; return; }
        el.innerHTML = list.map(f => `<a class="rs-row" data-f="${f.id}" target="_blank" rel="noopener"><span class="vin"><span class="lab"></span></span><span class="tx"><b>${E(f.title || 'Feed')}</b><span>loading…</span></span><span class="nxt" title="Next">›</span></a>`).join('');
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
          row.querySelector('.nxt').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); i++; show(true); });
          load(f).then(d => { data = d; show(); }).catch(err => { row.querySelector('.tx span').textContent = err.message; row.removeAttribute('href'); });
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
        el.innerHTML = `<div class="row" style="justify-content:flex-end;margin:-10px 0 18px"><button class="btn" id="rs-cfg">Manage feeds</button></div>` + list.map(f => `<div class="group" data-f="${f.id}"><div class="group-h">${E(f.title || f.url)}<span class="c"></span></div><div class="muted" style="padding:8px 4px;font-size:13px">Loading…</div></div>`).join('') + (list.length ? '' : '<div class="empty"><b>No feeds yet</b>Add one with Manage feeds.</div>');
        el.querySelector('#rs-cfg').onclick = manage;
        list.forEach(f => { const g = el.querySelector(`[data-f="${f.id}"]`); load(f).then(d => { g.querySelector('.c').textContent = d.items.length; g.lastElementChild.outerHTML = itemsHtml(f, d, 40, true); }).catch(e => { g.lastElementChild.textContent = e.message; }); });
      }});

      /* settings */
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
