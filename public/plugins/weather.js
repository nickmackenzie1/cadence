/* Weather: current conditions and a 7-day forecast from Open-Meteo (free, no API key), fetched by the NAS.
   Shows up in the sidebar dock, as a dashboard widget, and as a short line under Today's greeting
   ("4° and cloudy · rain likely around 3 PM"). Other plugins (camping planner) can call window.CadenceWeather.get(). */
(() => {
  // WMO weather codes -> words + Lucide icon
  const WMO = c => c === 0 ? ['Clear', 'sun'] : c <= 2 ? ['Partly cloudy', 'cloud-sun'] : c === 3 ? ['Cloudy', 'cloud'] : c <= 48 ? ['Fog', 'cloud-fog'] : c <= 57 ? ['Drizzle', 'cloud-drizzle']
    : c <= 67 ? ['Rain', 'cloud-rain'] : c <= 77 ? ['Snow', 'cloud-snow'] : c <= 82 ? ['Showers', 'cloud-rain'] : c <= 86 ? ['Snow showers', 'cloud-snow'] : ['Thunderstorms', 'cloud-lightning'];
  const G = window.__wx = window.__wx || { data: null, at: 0 };
  Cadence.registerPlugin({
    id: 'weather', name: 'Weather', version: '1.0.0', category: 'Widgets', spaces: ['work', 'life'],
    description: 'Current weather and a 7-day forecast for your town, in the sidebar, on the dashboard and under Today’s greeting. From Open-Meteo through your NAS, no API key needed.',
    tagline: 'Today and the week ahead', color: '#0ea5e9',
    icon: '<path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.947 12.65a4 4 0 0 0-5.925-4.128"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>',
    settings() { G.settings && G.settings(); },
    setup(api) {
      const esc = window.CadenceKit.esc;
      // one place for both spaces: stored in this browser and in the Work doc
      const opts = () => { let v = null; try { v = JSON.parse(localStorage.getItem('cadence.weather') || 'null'); } catch (e) {} return Object.assign({ place: null, units: 'c', today: true }, v || {}); };
      const setOpts = o => { try { localStorage.setItem('cadence.weather', JSON.stringify(Object.assign(opts(), o))); } catch (e) {} G.data = null; G.at = 0; load(true); };
      const ic = (n, cls = '') => api.ui.icon(n, cls);
      let busy = null;
      async function load(force) {
        const o = opts(); if (!o.place || api.system().mode !== 'nas') return null;
        if (!force && G.data && Date.now() - G.at < 15 * 60e3 && G.key === o.place.lat + ',' + o.place.lon + o.units) return G.data;
        if (busy) return busy;
        busy = fetch(`api/weather?lat=${o.place.lat}&lon=${o.place.lon}&units=${o.units}`).then(r => r.ok ? r.json() : null).then(d => { if (d && d.current) { G.data = d; G.at = Date.now(); G.key = o.place.lat + ',' + o.place.lon + o.units; api.ui.refreshWidgets && api.ui.refreshWidgets(); api.ui.refreshSide && api.ui.refreshSide(); paintToday(); } return d; }).catch(() => null).finally(() => { busy = null; });
        return busy;
      }
      window.CadenceWeather = { get: () => load(false), wmo: WMO, place: () => opts().place };
      const deg = v => Math.round(v) + '°';
      // "rain likely around 3 PM" from the next hours
      function headsUp(d) {
        const h = d.hourly; if (!h) return ''; const now = Date.now();
        for (let i = 0; i < h.time.length; i++) { const t = new Date(h.time[i]).getTime(); if (t < now - 36e5) continue; if (t > now + 12 * 36e5) break;
          if ((h.precipitation_probability[i] || 0) >= 60) { const w = WMO(h.weather_code[i])[0].toLowerCase(); return `${/snow/.test(w) ? 'snow' : 'rain'} likely around ${new Date(t).toLocaleTimeString([], { hour: 'numeric' })}`; } }
        return '';
      }
      function line(d) { const c = d.current, [w] = WMO(c.weather_code); const hu = headsUp(d); return `${deg(c.temperature_2m)} and ${w.toLowerCase()}${hu ? ' · ' + hu : ''}`; }

      function sidebar(el) {
        const o = opts();
        if (!o.place) { el.innerHTML = `<button class="wx-set">${ic('cloud-sun')} Set your town for weather</button>`; el.querySelector('button').onclick = () => G.settings(); return; }
        const d = G.data; if (!d) { el.innerHTML = `<div class="wx-row muted">${ic('cloud')} Loading weather…</div>`; load(); return; }
        const c = d.current, [w, i] = WMO(c.weather_code), day = d.daily;
        el.innerHTML = `<div class="wx-row" title="${esc(o.place.name)}">${ic(c.is_day ? i : (i === 'sun' ? 'moon' : i === 'cloud-sun' ? 'cloud-moon' : i), 'wx-ic')}<b>${deg(c.temperature_2m)}</b><span>${esc(w)}</span><span class="wx-hl">${deg(day.temperature_2m_max[0])} / ${deg(day.temperature_2m_min[0])}</span></div>`;
        el.querySelector('.wx-row').onclick = () => G.detail();
      }
      function widget(el) {
        const o = opts();
        if (!o.place) { el.innerHTML = `<div class="wx-w empty"><button class="btn" id="wx-go">Set your town</button></div>`; el.querySelector('#wx-go').onclick = () => G.settings(); return; }
        const d = G.data; if (!d) { el.innerHTML = '<div class="wx-w muted" style="padding:14px">Loading weather…</div>'; load(); return; }
        const c = d.current, [w, i] = WMO(c.weather_code), dy = d.daily;
        el.innerHTML = `<div class="wx-w"><div class="wx-now">${ic(i, 'wx-big')}<div><b>${deg(c.temperature_2m)}</b><span>${esc(w)} · feels ${deg(c.apparent_temperature)}</span><span class="muted">${esc(o.place.name)}</span></div></div>
          <div class="wx-days">${dy.time.slice(0, 7).map((t, k) => `<div><span>${k === 0 ? 'Today' : new Date(t + 'T12:00').toLocaleDateString([], { weekday: 'short' })}</span>${ic(WMO(dy.weather_code[k])[1])}<b>${deg(dy.temperature_2m_max[k])}</b><i>${deg(dy.temperature_2m_min[k])}</i>${dy.precipitation_probability_max[k] >= 30 ? `<em>${dy.precipitation_probability_max[k]}%</em>` : '<em></em>'}</div>`).join('')}</div></div>`;
      }
      function paintToday() {
        if (!opts().today || api.ui.currentRoute() !== 'today' || !G.data) return;
        const sub = document.querySelector('#view .head .sub'); if (!sub || sub.querySelector('.wx-line')) return;
        const s = document.createElement('span'); s.className = 'wx-line'; s.innerHTML = ` · ${ic(WMO(G.data.current.weather_code)[1])}${esc(line(G.data))}`; sub.appendChild(s);
      }
      G.detail = () => { const d = G.data; if (!d) return; const el = document.createElement('div'); widget(el); api.ui.modal(`Weather · ${esc(opts().place.name)}`, el.innerHTML, '<button class="btn" id="wx-cfg" style="margin-right:auto">Change town</button><button class="btn primary" data-act="close-modal">Done</button>'); document.getElementById('wx-cfg').onclick = () => G.settings(); };
      G.settings = () => {
        const o = opts();
        api.ui.modal('Weather', `<div class="field"><label>Your town</label><input class="inp" id="wx-q" placeholder="Toronto" value="${esc(o.place ? o.place.name : '')}"><div id="wx-res" class="wx-res"></div></div>
          <div class="field"><label>Units</label><div class="seg" id="wx-u"><button data-v="c" class="${o.units === 'c' ? 'on' : ''}">°C</button><button data-v="f" class="${o.units === 'f' ? 'on' : ''}">°F</button></div></div>
          <label class="xm-row"><input type="checkbox" id="wx-today" ${o.today ? 'checked' : ''}> Show the weather under Today’s greeting</label>
          <div class="muted" style="font-size:12px;margin-top:8px">Forecasts from Open-Meteo (open-meteo.com), fetched by your NAS. No account or key.</div>`,
          '<button class="btn primary" id="wx-done">Done</button>');
        const $ = id => document.getElementById(id); let t = 0, pick = o.place, units = o.units;
        $('wx-q').oninput = () => { clearTimeout(t); t = setTimeout(async () => { const q = $('wx-q').value.trim(); if (q.length < 2) return; const r = await fetch('api/weather/geo?q=' + encodeURIComponent(q)).then(x => x.json()).catch(() => ({}));
          $('wx-res').innerHTML = (r.results || []).map((p, k) => `<button data-k="${k}">${esc(p.name)}<span>${esc([p.admin1, p.country].filter(Boolean).join(', '))}</span></button>`).join('') || '<span class="muted">No places found</span>';
          $('wx-res').querySelectorAll('button').forEach(b => b.onclick = () => { const p = r.results[+b.dataset.k]; pick = { name: p.name + (p.admin1 ? ', ' + p.admin1 : ''), lat: p.latitude, lon: p.longitude }; $('wx-q').value = pick.name; $('wx-res').innerHTML = ''; }); }, 300); };
        document.querySelectorAll('#wx-u button').forEach(b => b.onclick = () => { units = b.dataset.v; document.querySelectorAll('#wx-u button').forEach(x => x.classList.toggle('on', x === b)); });
        $('wx-done').onclick = () => { setOpts({ place: pick, units, today: $('wx-today').checked }); api.ui.close(); };
      };

      api.sidebar.add({ id: 'weather', slot: 'top', order: 14, title: 'Weather', render: sidebar });
      api.widgets.add({ id: 'forecast', title: 'Weather', icon: 'cloud-sun', size: 'm', description: 'Now and the next 7 days for your town.', render: widget });
      api.commands.add({ title: 'Weather', hint: 'Forecast for your town', run: () => G.data ? G.detail() : G.settings() });
      api.on('render', () => setTimeout(paintToday, 0));
      clearInterval(G.iv); G.iv = setInterval(() => load(true), 20 * 60e3);
      load();

      if (!document.getElementById('wx-css')) {
        const st = document.createElement('style'); st.id = 'wx-css';
        st.textContent = `
        .wx-row{display:flex;align-items:center;gap:7px;padding:6px 8px;border-radius:9px;cursor:pointer;font-size:13px}.wx-row:hover{background:var(--hover)}
        .wx-row b{font-size:15px}.wx-row span{color:var(--muted)}.wx-row .wx-hl{margin-left:auto;font-size:11.5px}
        .wx-ic{width:18px;height:18px;color:#f59e0b}
        .wx-set{display:flex;align-items:center;gap:6px;background:none;border:1px dashed var(--line);border-radius:9px;padding:6px 8px;color:var(--muted);font:12.5px Inter,system-ui;cursor:pointer;width:100%}
        .wx-w{padding:4px 2px}.wx-w.empty{display:flex;align-items:center;justify-content:center;min-height:90px}
        .wx-now{display:flex;align-items:center;gap:12px;margin-bottom:12px}.wx-now b{font:800 30px/1 ui-rounded,system-ui;display:block}.wx-now span{display:block;font-size:12.5px}
        .wx-big{width:44px;height:44px;color:#f59e0b}
        .wx-days{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center}
        .wx-days div{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11.5px}.wx-days span{color:var(--muted)}.wx-days svg{width:18px;height:18px;color:var(--muted)}
        .wx-days i{font-style:normal;color:var(--muted)}.wx-days em{font-style:normal;font-size:10.5px;color:#0ea5e9;min-height:13px}
        .wx-line svg{width:14px;height:14px;vertical-align:-2px;margin:0 4px 0 2px;color:#f59e0b}
        .wx-res{display:flex;flex-direction:column;gap:2px;margin-top:6px}.wx-res button{text-align:left;background:none;border:1px solid var(--line);border-radius:8px;padding:6px 9px;cursor:pointer;color:var(--text);font:13px Inter,system-ui}
        .wx-res button span{color:var(--muted);margin-left:6px;font-size:12px}.wx-res button:hover{background:var(--hover)}`;
        document.head.appendChild(st);
      }
    },
  });
})();
