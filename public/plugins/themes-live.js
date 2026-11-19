/* Live themes (user, 2026-11-18: "lets do some amazing themes with all the apis we have now … all of them"): themes
   that change by themselves from what THING already knows.
     Record of the day (your Discogs shelf), KEXP live (who's on air and what's playing), Movie night (the last film
     in your Letterboxd diary, pictures from TMDB), Weather window (Amherstview's weather drives the effects and the
     sky), Game shelf (fanart from your games on TheGamesDB, a different one each day), and Seasons (picks the
     season's theme by itself: Halloween, Late fall, Winter, Spring, Camping; fireworks when today's list is done).
   Pictures come through the NAS (api/img, api/tmdb, api/gdb, api/commons) so their colours can be read. Nothing here
   draws or copies anyone's artwork: covers, stills and photos are shown as they are, with credit. */
(() => {
  const T = window.CadenceThemes; if (!T) return;
  const R = t => T.register(t);
  const V = 'vendor/themes/fonts/';
  const root = document.documentElement;
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const ic = n => (window.LUCIDE && window.LUCIDE[n]) ? `<svg class="lu" viewBox="0 0 24 24" aria-hidden="true">${window.LUCIDE[n]}</svg>` : '';
  const getJ = u => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null);
  const via = u => !u ? '' : /^(api\/|\/api\/|data:|blob:)/.test(u) ? u : 'api/img?url=' + encodeURIComponent(u);
  const phone = () => matchMedia('(max-width: 640px)').matches;
  const day = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60e3) / 86400e3);

  // colours from a picture, set on the page; undone by the returned function
  function colorsFrom(src, { only } = {}) {
    let live = true; const set = [];
    const im = new Image(); im.onload = () => { if (!live) return; try { const v = T.paletteOf(im); for (const [k, val] of Object.entries(v)) if (!only || only.includes(k)) { root.style.setProperty(k, val); set.push(k); } } catch (e) {} };
    im.src = via(src);
    return () => { live = false; for (const k of set) root.style.removeProperty(k); };
  }
  // a picture behind everything: blurred and dimmed, or sharp and dimmed
  function backdrop(src, { blur = 0, dim = 0.6 } = {}) {
    const b = el('div', 'lt-back'); b.setAttribute('aria-hidden', 'true');
    b.style.cssText = `position:fixed;inset:${blur ? '-60px' : '0'};z-index:-1;pointer-events:none;background:linear-gradient(color-mix(in srgb,var(--bg) ${Math.round(dim * 100)}%,transparent),color-mix(in srgb,var(--bg) ${Math.round(dim * 100)}%,transparent)),url("${String(via(src)).replace(/["\\]/g, '')}") center/cover no-repeat;${blur ? `filter:blur(${blur}px) saturate(1.2)` : ''};transition:opacity 1.2s;opacity:0`;
    document.body.prepend(b); const im = new Image(); im.onload = () => { b.style.opacity = '1'; }; im.src = via(src);
    return () => b.remove();
  }
  // a small card in the corner (not on phones, where space is short)
  function card(cls, html) {
    const c = el('div', 'lt-card ' + cls, html); if (phone()) c.hidden = true; document.body.appendChild(c); return c;
  }
  const BASE_CSS = `:skin .app,:skin .main{background:transparent}:skin body{background-color:var(--bg)}
    .lt-card{position:fixed;right:16px;bottom:34px;z-index:5;max-width:300px;display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:14px;
      background:color-mix(in srgb,var(--panel) 88%,transparent);border:1px solid var(--line);box-shadow:0 10px 30px rgba(0,0,0,.28);backdrop-filter:blur(10px);color:var(--text);font-size:13px;line-height:1.35}
    .lt-card a{color:inherit}.lt-card .lt-k{font-size:11px;color:var(--muted)}.lt-card b{display:block}.lt-card .muted{color:var(--muted)}
    .lt-card .lt-btn{margin-top:6px;font:inherit;font-size:12px;padding:3px 9px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--text);cursor:pointer;display:inline-flex;align-items:center;gap:4px}
    .lt-card .lt-btn:hover{border-color:var(--accent)}.lt-card .lu{width:14px;height:14px}
    html:has(> #pc-mini:not([hidden]):not(.pc-tuck)) .lt-card{bottom:96px}`;
  const css = more => BASE_CSS + (more || '');
  const loadSt = () => { try { const d = window.CadenceWorkDoc && window.CadenceWorkDoc(); if (d) return d; return JSON.parse(localStorage.getItem('cadence.v1') || '{}'); } catch (e) { return {}; } };

  /* ---------------- Record of the day: one record from your Discogs shelf, a different one each morning ---------------- */
  R({ id: 'record-of-the-day', name: 'Record of the day', category: 'Live', tagline: 'One record from your Discogs collection each morning: its cover behind everything, its colours on the app, the sleeve in the corner.',
    vars: { '--ambient': 'off', '--bg': '#17130f', '--panel': 'rgba(32,27,22,.86)', '--side': 'rgba(16,13,10,.9)', '--text': '#f3ece2', '--muted': '#b9ad9c', '--faint': '#7c7264', '--line': 'rgba(243,236,226,.14)', '--hover': 'rgba(243,236,226,.06)', '--accent': '#e0a458', '--accent-soft': 'rgba(224,164,88,.16)', '--on-accent': '#1a1006', '--r': '12px' },
    preview: { bg: 'radial-gradient(circle at 70% 60%,#111 0 18%,#2a2420 19% 21%,#111 22% 30%,transparent 31%),linear-gradient(135deg,#5b3a2a,#17130f)', panel: '#201b16', side: '#100d0a', text: '#f3ece2', accent: '#e0a458', line: '#3a322a' },
    css: css(`.lt-rec .lt-sleeve{position:relative;width:76px;height:76px;flex:none}.lt-rec .lt-sleeve img{position:relative;z-index:1;width:76px;height:76px;border-radius:4px;object-fit:cover;box-shadow:0 4px 14px rgba(0,0,0,.4)}
      .lt-rec .lt-disc{position:absolute;top:4px;left:28px;width:68px;height:68px;border-radius:50%;background:radial-gradient(circle,var(--accent) 0 14%,#111 15% 18%,#1c1c1c 19% 100%);box-shadow:0 2px 8px rgba(0,0,0,.4);transition:transform .6s}
      .lt-rec:hover .lt-disc{transform:translateX(18px) rotate(40deg)}.lt-rec{padding-right:30px}`),
    enhance(ctx) {
      let live = true; const undo = [];
      getJ('api/radar/discogs').then(d => {
        if (!live) return;
        if (!d || d.off) { const c = card('lt-rec', `<div><span class="lt-k">Record of the day</span><b>Connect Discogs to see your records here</b><button class="lt-btn" data-lt="keys">${ic('settings')}Settings → Connections</button></div>`);
          c.querySelector('[data-lt=keys]').onclick = () => ctx.api && ctx.api.ui.openSettings('connections'); undo.push(() => c.remove()); return; }
        if (d.pending || !d.shelf) { const c = card('lt-rec', `<div><span class="lt-k">Record of the day</span><b>Copying your Discogs collection</b><span class="muted">Your record shows up in a minute or two.</span></div>`); undo.push(() => c.remove()); return; }
        const r = d.shelf, cover = r.cover || r.thumb;
        if (cover) { undo.push(backdrop(cover, { blur: 46, dim: 0.5 }), colorsFrom(cover)); }
        const c = card('lt-rec', `<a class="lt-sleeve" href="https://www.discogs.com/release/${+r.rid}" target="_blank" rel="noopener" title="Open on Discogs"><span class="lt-disc"></span>${cover ? `<img src="${E(via(cover))}" alt="">` : ''}</a>
          <div><span class="lt-k">Pulled from your shelf today</span><b>${E(r.title)}</b><span class="muted">${E(r.artist)}${r.year ? ' · ' + E(r.year) : ''}${r.format ? ' · ' + E(r.format) : ''}</span>
          ${window.CadencePreview ? `<button class="lt-btn" data-lt="play">${ic('play')}Play a preview</button>` : ''}</div>`);
        const pb = c.querySelector('[data-lt=play]'); if (pb) pb.onclick = () => window.CadencePreview.playAll([{ artist: r.artist, title: r.title }]);
        undo.push(() => c.remove());
      });
      return () => { live = false; undo.forEach(f => f()); };
    } });

  /* ---------------- KEXP live: KEXP's look, who's on air, what's playing, the accent from the cover ---------------- */
  const KX_FONTS = [{ family: 'Oswald', src: V + 'oswald-latin-600-normal.woff2', weight: 600 }, { family: 'IBM Plex Sans', src: V + 'ibm-plex-sans-latin-400-normal.woff2', weight: 400 }, { family: 'IBM Plex Sans', src: V + 'ibm-plex-sans-latin-700-normal.woff2', weight: 700 }];
  R({ id: 'kexp-live', name: 'KEXP live', category: 'Live', site: 'kexp.org', tagline: "KEXP's orange on near-black. The DJ on air right now in the corner, the song playing, and the accent from its cover.",
    fonts: KX_FONTS, font: '"IBM Plex Sans",system-ui,sans-serif',
    vars: { '--ambient': 'off', '--bg': '#141414', '--panel': '#1d1d1d', '--side': '#0d0d0d', '--text': '#f4f1ea', '--muted': '#aaa59b', '--faint': '#6f6b64', '--line': '#2d2d2d', '--hover': '#252525', '--accent': '#f05a28', '--accent-soft': 'rgba(240,90,40,.16)', '--on-accent': '#140700', '--r': '4px' },
    preview: { bg: '#141414', panel: '#1d1d1d', side: '#0d0d0d', text: '#f4f1ea', accent: '#f05a28', line: '#2d2d2d', r: '4px' },
    css: css(`:skin .head h1,:skin .c-hero h1,:skin .side .brand b{font-family:Oswald,Impact,sans-serif;text-transform:uppercase;letter-spacing:.01em;font-weight:600}
      :skin .head h1{font-size:34px}:skin .nav a.on,:skin .nav-item.on{box-shadow:inset 3px 0 0 var(--accent)}
      .lt-kx{flex-direction:column;align-items:stretch;width:290px}.lt-kx .lt-row{display:flex;gap:10px;align-items:center}
      .lt-kx .lt-dj{display:flex}.lt-kx .lt-dj img{width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid var(--accent);margin-right:-10px;background:#222}
      .lt-kx .lt-cov{width:44px;height:44px;border-radius:3px;object-fit:cover;flex:none;background:#222}
      .lt-kx .lt-on{font-family:Oswald,Impact,sans-serif;text-transform:uppercase;font-size:12px;letter-spacing:.06em;color:var(--accent);display:flex;align-items:center;gap:6px}
      .lt-kx .lt-on i{width:7px;height:7px;border-radius:50%;background:var(--accent);display:inline-block}`),
    enhance() {
      let live = true, last = '', offCol = null, t = 0;
      const c = card('lt-kx', `<div class="lt-on"><i></i>On the air at KEXP</div><div class="lt-row lt-show"><span class="muted">Checking who's on…</span></div><div class="lt-row lt-song"></div>`);
      const tick = async () => {
        if (!live) return; clearTimeout(t); t = setTimeout(tick, document.hidden ? 120e3 : 30e3);
        const n = await getJ('api/radio/now?id=kexp'); if (!live || !n) return;
        const s = n.show;
        c.querySelector('.lt-show').innerHTML = s ? `${(s.hosts || []).some(h => h.image) ? `<span class="lt-dj">${s.hosts.filter(h => h.image).slice(0, 3).map(h => `<img src="${E(via(h.image))}" alt="" onerror="this.remove()">`).join('')}</span>` : ''}
          <div style="margin-left:${(s.hosts || []).some(h => h.image) ? 10 : 0}px"><b>${E(s.program || 'KEXP')}</b><span class="muted">${(s.hosts || []).length ? 'with ' + E(s.hosts.map(h => h.name).join(' & ')) : ''}</span></div>` : '<span class="muted">KEXP 90.3, Seattle</span>';
        c.querySelector('.lt-song').innerHTML = n.airbreak ? '<span class="muted">Between songs: the DJ is talking</span>'
          : `${n.art ? `<img class="lt-cov" src="${E(via(n.art))}" alt="">` : ''}<div><b>${E(n.song || '')}</b><span class="muted">${E(n.artist || '')}${n.album ? ' · ' + E(n.album) : ''}</span>
             <button class="lt-btn" data-lt="listen">${ic('radio')}Listen live</button></div>`;
        const lb = c.querySelector('[data-lt=listen]'); if (lb) lb.onclick = () => window.CadenceRadio && window.CadenceRadio.play('kexp');
        if (n.art && n.art !== last) { last = n.art; if (offCol) offCol(); offCol = colorsFrom(n.art, { only: ['--accent', '--accent-soft'] }); }
      };
      tick(); const vis = () => { if (!document.hidden) tick(); }; document.addEventListener('visibilitychange', vis);
      return () => { live = false; clearTimeout(t); document.removeEventListener('visibilitychange', vis); if (offCol) offCol(); c.remove(); };
    } });

  /* ---------------- Movie night: the last film in your Letterboxd diary ---------------- */
  R({ id: 'movie-night', name: 'Movie night', category: 'Live', tagline: 'The last film you logged on Letterboxd: its picture from TMDB behind everything and its colours on the app.',
    vars: { '--ambient': 'off', '--bg': '#0f1114', '--panel': 'rgba(22,25,30,.86)', '--side': 'rgba(10,11,14,.9)', '--text': '#eef0f3', '--muted': '#a7adb7', '--faint': '#6b717c', '--line': 'rgba(238,240,243,.13)', '--hover': 'rgba(238,240,243,.06)', '--accent': '#40bcf4', '--accent-soft': 'rgba(64,188,244,.16)', '--on-accent': '#04131b', '--r': '10px' },
    preview: { bg: 'linear-gradient(160deg,#202a3a,#0f1114 70%)', panel: '#16191e', side: '#0a0b0e', text: '#eef0f3', accent: '#40bcf4', line: '#2a2f37' },
    css: css(`.lt-mv img{width:54px;height:80px;border-radius:4px;object-fit:cover;flex:none;box-shadow:0 4px 12px rgba(0,0,0,.4)}.lt-mv .lt-st{color:var(--accent);letter-spacing:1px}`),
    enhance() {
      let live = true; const undo = [];
      (async () => {
        const feeds = (((loadSt().pluginData || {}).rss || {}).feeds || []).filter(f => /letterboxd\.com/i.test(f.url || ''));
        if (!feeds.length) { const c = card('lt-mv', `<div><span class="lt-k">Movie night</span><b>Add your Letterboxd diary in Feeds</b><span class="muted">Its address is letterboxd.com/your-name/rss/</span></div>`); undo.push(() => c.remove()); return; }
        const f = await getJ('api/feed?url=' + encodeURIComponent(feeds[0].url)); if (!live) return;
        const it = f && (f.items || []).find(x => x.film && x.film.title) || (f && f.items || [])[0]; if (!it) return;
        const fm = it.film || { title: it.title, year: '' };
        const a = await getJ(`api/tmdb/art?type=movie&q=${encodeURIComponent(fm.title)}&year=${encodeURIComponent(fm.year || '')}`); if (!live) return;
        const pic = a && a.backdrops && a.backdrops[day() % a.backdrops.length];
        if (pic) undo.push(backdrop(pic, { dim: 0.62 }), colorsFrom(pic)); else if (it.image) undo.push(backdrop(it.image, { blur: 40, dim: 0.55 }), colorsFrom(it.image));
        const st = fm.rating ? '★'.repeat(Math.floor(fm.rating)) + (fm.rating % 1 ? '½' : '') : '';
        const c = card('lt-mv', `${it.image ? `<a href="${E(it.link)}" target="_blank" rel="noopener"><img src="${E(via(it.image))}" alt=""></a>` : ''}<div><span class="lt-k">Last on your Letterboxd</span><b>${E(fm.title)}${fm.year ? ` <span class="muted">(${E(fm.year)})</span>` : ''}</b>${st ? `<span class="lt-st">${st}</span>` : ''}
          ${pic ? `<span class="muted" style="display:block;font-size:11px;margin-top:4px">Picture from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.</span>` : a && a.off ? '<span class="muted" style="display:block;font-size:11px">Connect TMDB in Settings → Connections for the film\'s pictures.</span>' : ''}</div>`);
        undo.push(() => c.remove());
      })();
      return () => { live = false; undo.forEach(f => f()); };
    } });

  /* ---------------- Weather window: the real weather outside drives the effects and the sky ---------------- */
  // Amherstview when no town is set in Weather (HANDOFF: the user's town)
  const HOME = { lat: 44.2206, lon: -76.6627, name: 'Amherstview' };
  const wxKind = c => c == null ? 'clear' : c >= 95 ? 'storm' : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'snow' : (c >= 51 && c <= 67) || (c >= 80 && c <= 82) ? 'rain' : c === 45 || c === 48 ? 'fog' : c >= 2 ? 'cloud' : 'clear';
  const lastWx = () => { try { return JSON.parse(localStorage.getItem('cadence.wxwin') || 'null'); } catch (e) { return null; } };
  async function weatherNow() {
    let d = null; try { if (window.CadenceWeather && window.CadenceWeather.place()) d = await window.CadenceWeather.get(); } catch (e) {}
    if (!d || !d.current) d = await getJ(`api/weather?lat=${HOME.lat}&lon=${HOME.lon}`);
    if (d && d.current) try { localStorage.setItem('cadence.wxwin', JSON.stringify({ code: d.current.weather_code, day: d.current.is_day, at: Date.now() })); } catch (e) {}
    return d;
  }
  // the sky: dawn, day, dusk or night, greyer when it's cloudy, snow-white when it snows
  function sky(kind, isDay) {
    const h = new Date().getHours(), part = !isDay ? 'night' : h < 9 ? 'dawn' : h >= 17 ? 'dusk' : 'day';
    const P = { night: ['#0d1420', '#141d2c', '#0a0f18', '#e6ecf5', '#9aa7ba', '#8fb8ff'], dawn: ['#2a2230', '#352a3a', '#1f1925', '#f6ece8', '#c2aeb0', '#ffb07a'],
      day: ['#e9eef3', '#f8fafc', '#dce4ec', '#1c2733', '#5d6b7a', '#2f7fd1'], dusk: ['#2b1f2e', '#382837', '#1f1621', '#f7e9e4', '#c7a9a8', '#ff8a5c'] }[part];
    let [bg, panel, side, text, muted, accent] = P;
    if (kind === 'cloud' || kind === 'rain' || kind === 'fog') { if (part === 'day') { bg = '#dfe3e7'; panel = '#f3f5f7'; side = '#d3d8dd'; accent = '#4f7894'; } else { bg = '#1a1e24'; panel = '#22272e'; side = '#14171c'; accent = '#8fb0c8'; } }
    if (kind === 'snow' && part === 'day') { bg = '#eef3f8'; panel = '#ffffff'; side = '#e2eaf2'; accent = '#3a78b5'; }
    const dark = part !== 'day';
    return { '--bg': bg, '--panel': `color-mix(in srgb,${panel} 86%,transparent)`, '--side': `color-mix(in srgb,${side} 90%,transparent)`, '--text': text, '--muted': muted, '--faint': dark ? '#6c778a' : '#8a96a3',
      '--line': dark ? 'rgba(230,236,245,.13)' : 'rgba(28,39,51,.12)', '--hover': dark ? 'rgba(230,236,245,.06)' : 'rgba(28,39,51,.05)', '--accent': accent, '--accent-soft': `color-mix(in srgb,${accent} 18%,transparent)`, '--on-accent': dark ? '#0b0f16' : '#fff' };
  }
  const leafCss = `.lt-leaf{position:fixed;top:-30px;z-index:23;pointer-events:none;color:#c8743a;opacity:.85;animation:lt-fall linear forwards}.lt-leaf .lu{width:100%;height:100%}
    @keyframes lt-fall{to{transform:translate(var(--dx),110vh) rotate(var(--rot))}}
    .lt-fog{position:fixed;inset:0;z-index:22;pointer-events:none;background:radial-gradient(60% 40% at 20% 70%,rgba(220,225,230,.32),transparent 70%),radial-gradient(50% 35% at 80% 40%,rgba(220,225,230,.26),transparent 70%);animation:lt-drift 40s ease-in-out infinite alternate}
    @keyframes lt-drift{to{transform:translateX(6%)}}`;
  R({ id: 'weather-window', name: 'Weather window', category: 'Live', tagline: "The weather outside your window: rain, snow, fog and falling leaves when it's really happening, and the sky's colour for the time of day.",
    commons: () => { const w = lastWx(), k = wxKind(w && w.code), m = new Date().getMonth(); return 'Lake Ontario ' + (k === 'snow' || m === 0 || m === 1 || m === 11 ? 'winter' : k === 'fog' ? 'fog' : w && !w.day ? 'night' : 'shore'); },
    vars: sky('clear', true), preview: { bg: 'linear-gradient(180deg,#8fb8e8,#e9eef3 70%)', panel: '#f8fafc', side: '#dce4ec', text: '#1c2733', accent: '#2f7fd1', line: '#cfd8e1' },
    css: css(leafCss + `.lt-wx .lu{width:28px;height:28px;color:var(--accent)}`),
    enhance() {
      let live = true, t = 0; const set = [];
      const c = card('lt-wx', `<span class="lt-i"></span><div><span class="lt-k">Outside</span><b class="lt-t">Looking out the window…</b></div>`);
      const paint = async () => {
        if (!live) return; clearTimeout(t); t = setTimeout(paint, 15 * 60e3);
        const d = await weatherNow(); if (!live || !d || !d.current) return;
        const cur = d.current, k = wxKind(cur.weather_code), v = sky(k, cur.is_day);
        for (const [n, val] of Object.entries(v)) { root.style.setProperty(n, val); set.push(n); }
        const W = window.CadenceWeather && window.CadenceWeather.wmo ? window.CadenceWeather.wmo(cur.weather_code) : null;
        c.querySelector('.lt-i').innerHTML = ic(W ? W[1] : k === 'snow' ? 'snowflake' : k === 'rain' ? 'cloud-rain' : k === 'fog' ? 'cloud-fog' : k === 'cloud' ? 'cloud' : cur.is_day ? 'sun' : 'moon');
        c.querySelector('.lt-t').textContent = `${Math.round(cur.temperature_2m)}° · ${W ? W[0] : k}`;
        document.dispatchEvent(new CustomEvent('lt:weather', { detail: { kind: k, wind: cur.wind_speed_10m || 0 } }));
      };
      paint();
      return () => { live = false; clearTimeout(t); for (const n of set) root.style.removeProperty(n); c.remove(); };
    },
    // the motion: off with the Effects setting or reduced motion
    effects({ layer }) {
      let fog = null, leafT = 0, kind = (wxKind((lastWx() || {}).code)), wind = 10;
      const FX = window.CadenceFX;
      const leaf = () => { const m = new Date().getMonth(); if ((m >= 8 && m <= 10) && (kind === 'cloud' || kind === 'clear' || kind === 'rain')) {
        const l = el('span', 'lt-leaf', ic('leaf')), s = 14 + Math.random() * 14; l.style.cssText += `left:${Math.random() * 100}vw;width:${s}px;height:${s}px;--dx:${(wind / 2 + Math.random() * 30 - 10) | 0}vw;--rot:${(Math.random() * 720 - 360) | 0}deg;animation-duration:${9 + Math.random() * 8}s;color:${['#c8743a', '#d9a441', '#a8452c', '#b8892f'][Math.random() * 4 | 0]}`;
        layer.appendChild(l); setTimeout(() => l.remove(), 18000); }
        leafT = setTimeout(leaf, 2500 + Math.random() * 5000); };
      const show = () => {
        if (FX) FX.want('theme-weather', kind === 'snow' ? { snow: true, wind: wind / 40 } : kind === 'rain' ? { rain: 2, wind: wind / 40 } : kind === 'storm' ? { rain: 4, storm: true, wind: wind / 30 } : null);
        if (kind === 'fog' && !fog) { fog = el('div', 'lt-fog'); layer.appendChild(fog); } else if (kind !== 'fog' && fog) { fog.remove(); fog = null; }
      };
      const on = e => { kind = e.detail.kind; wind = e.detail.wind; show(); };
      document.addEventListener('lt:weather', on); show(); leaf();
      return () => { document.removeEventListener('lt:weather', on); clearTimeout(leafT); if (FX) FX.want('theme-weather', null); };
    } });

  /* ---------------- Game shelf: your games' fanart from TheGamesDB, a different game each day ---------------- */
  const SHELF_KEY = 'cadence.gameShelf';
  const shelf = () => { try { const l = JSON.parse(localStorage.getItem(SHELF_KEY) || 'null'); if (Array.isArray(l) && l.length) return l; } catch (e) {} return ['The Legend of Zelda: Breath of the Wild', 'Portal 2', 'Half-Life 2', 'Stardew Valley', 'Hades', 'Celeste']; };
  const shelfTheme = () => { const l = shelf(), g = l[day() % l.length];
    return { id: 'game-shelf', name: 'Game shelf', category: 'Live', tagline: `Fanart and the title logo from one of your games each day (today: ${g}). Pictures from TheGamesDB.`, game: { title: g },
      vars: { '--ambient': 'off', '--bg': '#101317', '--panel': 'rgba(18,22,28,.8)', '--side': 'rgba(10,12,16,.88)', '--text': '#eef1f5', '--muted': '#a4acb8', '--faint': '#6a727e', '--line': 'rgba(238,241,245,.14)', '--hover': 'rgba(238,241,245,.06)', '--accent': '#7cc4ff', '--accent-soft': 'rgba(124,196,255,.16)', '--on-accent': '#04121f', '--r': '8px' },
      preview: { bg: 'linear-gradient(135deg,#2a3a5a,#101317 70%)', panel: '#12161c', side: '#0a0c10', text: '#eef1f5', accent: '#7cc4ff', line: '#2a3039' },
      css: css(`.lt-gs textarea{width:240px;min-height:110px;font:inherit;font-size:12px;background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:6px}`),
      enhance() {
        const c = card('lt-gs', `<div><span class="lt-k">Game shelf · today</span><b>${E(g)}</b><button class="lt-btn" data-lt="edit">${ic('gamepad-2')}Your games</button></div>`);
        c.querySelector('[data-lt=edit]').onclick = () => {
          c.innerHTML = `<div><span class="lt-k">One game per line, as TheGamesDB names it</span><textarea>${E(shelf().join('\n'))}</textarea><br><button class="lt-btn" data-lt="save">${ic('check')}Save</button></div>`;
          c.querySelector('[data-lt=save]').onclick = () => { const l = c.querySelector('textarea').value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 60);
            try { localStorage.setItem(SHELF_KEY, JSON.stringify(l)); } catch (e) {} R(shelfTheme()); };
        };
        return () => c.remove();
      } }; };
  R(shelfTheme());

  /* ---------------- the season themes: Winter, Spring, Camping (and Halloween gets a photo) ---------------- */
  const want = (key, o) => { if (window.CadenceFX) window.CadenceFX.want(key, o); return () => window.CadenceFX && window.CadenceFX.want(key, null); };
  R({ id: 'winter', name: 'Winter', category: 'Seasonal', tagline: 'Snow falling and settling on the edges of things, cold blue light, and a credited photo of a snowy Ontario wood.', commons: 'snowy forest Ontario',
    vars: { '--ambient': 'off', '--bg': '#e8eef4', '--panel': 'rgba(255,255,255,.86)', '--side': 'rgba(226,234,242,.9)', '--text': '#1b2733', '--muted': '#5a6878', '--faint': '#8b97a5', '--line': 'rgba(27,39,51,.12)', '--hover': 'rgba(27,39,51,.05)', '--accent': '#3a78b5', '--accent-soft': 'rgba(58,120,181,.14)', '--on-accent': '#fff', '--r': '12px' },
    preview: { bg: 'linear-gradient(180deg,#cfdceb,#f4f7fa)', panel: '#ffffff', side: '#e2eaf2', text: '#1b2733', accent: '#3a78b5', line: '#d2dbe5' },
    css: css(''), effects: () => want('theme-winter', { snow: true, wind: 0.2 }) });
  R({ id: 'spring', name: 'Spring', category: 'Seasonal', tagline: 'A soft spring shower now and then, fresh greens and blossom pinks, and a credited photo of trees in flower.', commons: 'spring blossom trees',
    vars: { '--ambient': 'off', '--bg': '#f1f5ee', '--panel': 'rgba(255,255,255,.88)', '--side': 'rgba(230,240,226,.9)', '--text': '#1e2a1f', '--muted': '#5c6b5d', '--faint': '#8d9a8e', '--line': 'rgba(30,42,31,.12)', '--hover': 'rgba(30,42,31,.05)', '--accent': '#d0557e', '--accent-soft': 'rgba(208,85,126,.14)', '--on-accent': '#fff', '--client': '#3f9a52', '--r': '14px' },
    preview: { bg: 'linear-gradient(180deg,#f7d9e3,#f1f5ee 70%)', panel: '#ffffff', side: '#e6f0e2', text: '#1e2a1f', accent: '#d0557e', line: '#d7e2d3' },
    css: css(''), effects: () => { let on = false, t = 0; const flip = () => { on = !on; want('theme-spring', on ? { rain: 1, wind: 0.1 } : null); t = setTimeout(flip, on ? 40e3 : 120e3); }; t = setTimeout(flip, 8e3); return () => { clearTimeout(t); want('theme-spring', null); }; } });
  R({ id: 'camping', name: 'Camping', category: 'Seasonal', tagline: 'Night at the campsite: a credited photo of the woods, stars overhead, embers drifting up from the fire. Add your own cricket sound if you like.', commons: 'campsite tent forest night',
    fonts: [{ family: 'Patrick Hand', src: V + 'patrick-hand-latin-400-normal.woff2' }],
    vars: { '--ambient': 'off', '--bg': '#0f1612', '--panel': 'rgba(22,30,25,.86)', '--side': 'rgba(10,15,12,.9)', '--text': '#efe9db', '--muted': '#b2ab98', '--faint': '#757062', '--line': 'rgba(239,233,219,.13)', '--hover': 'rgba(239,233,219,.06)', '--accent': '#f0a04b', '--accent-soft': 'rgba(240,160,75,.16)', '--on-accent': '#1b0f02', '--client': '#8fc27a', '--r': '10px' },
    preview: { bg: 'radial-gradient(circle at 50% 110%,#f0a04b 0 8%,transparent 30%),linear-gradient(180deg,#0b1220,#0f1612 70%)', panel: '#161e19', side: '#0a0f0c', text: '#efe9db', accent: '#f0a04b', line: '#2b342e' },
    css: css(`:skin .head h1{font-family:"Patrick Hand",cursive;font-size:36px}
      :skin body::before{content:"";position:fixed;inset:0 0 50% 0;z-index:-1;pointer-events:none;background-image:radial-gradient(1px 1px at 12% 20%,#fff,transparent),radial-gradient(1px 1px at 33% 8%,#fff,transparent),radial-gradient(1.5px 1.5px at 58% 16%,#fff,transparent),radial-gradient(1px 1px at 77% 6%,#fff,transparent),radial-gradient(1px 1px at 90% 26%,#fff,transparent),radial-gradient(1px 1px at 45% 30%,#fff,transparent);opacity:.7}
      .lt-ember{position:fixed;bottom:-10px;width:4px;height:4px;border-radius:50%;background:#ffb35c;box-shadow:0 0 8px 2px rgba(255,140,40,.7);pointer-events:none;z-index:23;animation:lt-rise linear forwards}
      @keyframes lt-rise{0%{opacity:0}10%{opacity:1}100%{transform:translate(var(--dx),-70vh);opacity:0}}`),
    effects({ layer }) { let t = 0; const ember = () => { const e = el('span', 'lt-ember'); e.style.cssText += `left:${45 + Math.random() * 14}vw;--dx:${(Math.random() * 16 - 8) | 0}vw;animation-duration:${5 + Math.random() * 4}s`; layer.appendChild(e); setTimeout(() => e.remove(), 9500); t = setTimeout(ember, 500 + Math.random() * 1200); }; ember(); return () => clearTimeout(t); } });

  /* ---------------- Seasons: the season's theme, picked by itself; fireworks when today's list is done ---------------- */
  const seasonOf = d => { const m = d.getMonth(); return m === 9 ? 'halloween' : m === 10 ? 'late-fall' : m === 11 || m <= 1 ? 'winter' : m <= 4 ? 'spring' : 'camping'; };
  const target = T.list().find(t => t.id === seasonOf(new Date())) || T.list().find(t => t.id === 'winter');
  if (target) {
    const { id, name, tagline, category, ...rest } = target;
    R({ ...rest, id: 'seasons', name: 'Seasons', category: 'Seasonal', tagline: `Changes with the time of year by itself: Halloween, Late fall, Winter, Spring, then Camping for summer. Right now: ${name}. Fireworks when today's list is done.`,
      css: String(rest.css || '').split(`html[data-skin="${id}"]`).join(':skin'),
      effects(ctx) {
        const off = rest.effects ? rest.effects(ctx) : null;
        const done = () => setTimeout(() => {
          const api = ctx.api; if (!api || !api.tasks) return;
          const n = new Date(), today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`, left = api.tasks.list().filter(t => !t.done && t.dueDate && t.dueDate <= today);
          if (left.length) return;
          window.CadenceFX && window.CadenceFX.world().then(w => { if (!w) return; [0, 500, 1100].forEach((ms, i) => setTimeout(() => w.firework(innerWidth * (0.3 + 0.2 * i), innerHeight * 0.95), ms)); });
        }, 400);
        document.addEventListener('cadence:task-complete', done);
        return () => { document.removeEventListener('cadence:task-complete', done); if (typeof off === 'function') off(); };
      } });
  }
})();
