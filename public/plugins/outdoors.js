/* Outside (user picked 2026-11-16): air quality, UV, pollen (where there's data), northern lights tonight, and when
   the space station passes over where you can see it. All fetched by the NAS (api/daily/outdoors). Uses the place set
   in Weather, or Amherstview. Two quiet Island notes, each at most once: northern lights possible tonight (after 4 pm),
   and a visible space station pass about to start. */
(() => {
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const HOME = { name: 'Amherstview', lat: 44.22, lon: -76.66 };
  const place = () => { try { const w = JSON.parse(localStorage.getItem('cadence.weather') || 'null'); if (w && w.place && isFinite(w.place.lat)) return w.place; } catch (e) {} return HOME; };
  const time = iso => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const dayTime = iso => { const d = new Date(iso), t = new Date(), tm = new Date(t); tm.setDate(t.getDate() + 1);
    const same = (a, b) => a.toDateString() === b.toDateString();
    return (same(d, t) ? 'Tonight' : same(d, tm) ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short' })) + ' ' + time(iso); };
  const high = el => el >= 60 ? 'high overhead' : el >= 30 ? 'halfway up' : 'low';

  Cadence.registerPlugin({
    id: 'outdoors', name: 'Outside', version: '1.0.0', category: 'Info', color: '#0ea5e9',
    icon: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    tagline: 'Air, UV, northern lights and the space station, for where you are.',
    description: 'Air quality and UV for today, pollen where it\'s measured, whether the northern lights might show tonight, and when the space station passes over where you can see it. Uses the place from Weather (or Amherstview). Free data, fetched by your NAS.',
    setup(api) {
      const G = { d: null, at: 0, busy: null };
      const cfg = () => Object.assign({ aurora: true, iss: true }, api.storage.get('cfg') || {});
      const load = (force) => {
        if (api.system().mode !== 'nas') return Promise.resolve(null);
        if (!force && G.d && Date.now() - G.at < 20 * 60e3) return Promise.resolve(G.d);
        if (G.busy) return G.busy;
        const p = place();
        G.busy = fetch(`api/daily/outdoors?lat=${p.lat}&lon=${p.lon}`).then(r => r.ok ? r.json() : null).then(d => { if (d) { G.d = d; G.at = Date.now(); } return d; }).catch(() => null).finally(() => { G.busy = null; api.ui.refreshWidgets && api.ui.refreshWidgets(); });
        return G.busy;
      };
      const visiblePasses = d => (d && d.iss && Array.isArray(d.iss) ? d.iss.filter(x => x.visible && Date.parse(x.end) > Date.now()) : []);
      const lines = d => {
        if (!d) return '<p class="muted">Loading…</p>';
        const out = [], a = d.air || {}, au = d.aurora || {}, ip = visiblePasses(d)[0];
        if (a.aqi != null) out.push(['wind', 'Air', `${E(a.aqiLabel)} <span class="muted">(AQI ${a.aqi})</span>`]);
        if (a.uvMax != null) out.push(['sun', 'UV today', `${E(a.uvLabel)} <span class="muted">(max ${a.uvMax})</span>`]);
        const pol = Object.entries(a.pollen || {}).filter(([, v]) => v >= 10).sort((x, y) => y[1] - x[1]);
        if (pol.length) out.push(['flower-2', 'Pollen', pol.slice(0, 2).map(([k]) => k).join(', ')]);
        if (au.kpMax != null) out.push(['sparkles', 'Northern lights', au.possible ? `${au.likely ? 'Good chance' : 'Possible'} tonight <span class="muted">(Kp ${au.kpMax} forecast, about ${au.kpNeeded} needed here)</span>` : `Unlikely tonight <span class="muted">(Kp ${au.kpMax})</span>`]);
        if (Array.isArray(d.iss)) out.push(['satellite', 'Space station', ip ? `${E(dayTime(ip.start))}, from the ${E(ip.from)}, ${high(ip.maxEl)}` : 'No visible passes in the next 3 days']);
        return out.length ? `<ul class="od-l">${out.map(([i, k, v]) => `<li>${api.ui.icon(i)}<b>${k}</b><span>${v}</span></li>`).join('')}</ul>` : '<p class="muted">Nothing to show right now.</p>';
      };

      api.widgets.add({ id: 'outside', title: 'Outside', icon: 'sun', size: 'm', description: 'Air, UV, northern lights and the space station.', render: el => {
        if (api.system().mode !== 'nas') { el.innerHTML = '<p class="muted">Needs the NAS.</p>'; return; }
        el.innerHTML = `<div class="od"><small class="muted">${E(place().name || '')}</small>${lines(G.d)}</div>`;
        load();
      } });
      api.views.add({ id: 'outside', title: 'Outside', icon: '☀️', subtitle: 'Air, UV, northern lights and the space station', render: el => {
        const d = G.d, all = d && Array.isArray(d.iss) ? d.iss.filter(x => Date.parse(x.end) > Date.now()) : [];
        el.innerHTML = `<div class="od od-v"><p class="muted">For ${E(place().name || 'your place')} · set the place in Weather</p>${lines(d)}
          ${all.length ? `<h3>Space station passes, next 3 days</h3><p class="muted">You can only see it when it's dark where you are and the station is in sunlight: those are marked.</p>
            <ul class="od-p">${all.map(x => `<li class="${x.visible ? 'on' : ''}"><b>${E(dayTime(x.start))}</b><span>from the ${E(x.from)} to the ${E(x.to)}, up to ${x.maxEl}°</span><span class="muted">${x.visible ? 'visible' : 'not visible (daylight or in shadow)'}</span></li>`).join('')}</ul>` : ''}
          <h3>Notes</h3>
          <label class="od-c"><input type="checkbox" id="od-au" ${cfg().aurora ? 'checked' : ''}> Tell me when the northern lights might show tonight</label>
          <label class="od-c"><input type="checkbox" id="od-is" ${cfg().iss ? 'checked' : ''}> Tell me a few minutes before a visible space station pass</label>
          <p class="muted od-src">Air and UV: Open-Meteo. Northern lights: NOAA Space Weather Prediction Center. Station orbit: Celestrak.</p></div>`;
        const set = (k, v) => api.storage.set('cfg', Object.assign(cfg(), { [k]: v }));
        el.querySelector('#od-au').onchange = e => set('aurora', e.target.checked);
        el.querySelector('#od-is').onchange = e => set('iss', e.target.checked);
        if (!d) load().then(() => { if (api.ui.currentRoute() === 'view-outside') api.ui.refresh(); });
      } });

      // quiet notes: each one once (remembered by day / by pass)
      const tick = async () => {
        const d = await load(); if (!d || !api.island || !api.island.notify) return;
        const seen = api.storage.get('seen') || {}, today = api.util.todayKey(), c = cfg();
        if (c.aurora && d.aurora && d.aurora.possible && new Date().getHours() >= 16 && seen.aurora !== today) {
          seen.aurora = today; api.island.notify({ icon: 'sparkles', title: 'Northern lights might show tonight', sub: `Kp ${d.aurora.kpMax} is forecast. Look north once it's properly dark, away from lights.` });
        }
        const p = visiblePasses(d).find(x => { const m = (Date.parse(x.start) - Date.now()) / 60e3; return m > 0 && m <= 10; });
        if (c.iss && p && seen.iss !== p.start) {
          seen.iss = p.start; api.island.notify({ icon: 'satellite', title: `The space station passes over at ${time(p.start)}`, sub: `Look ${p.from}: it rises to ${p.maxEl}° and looks like a bright, steady star moving across the sky.` });
        }
        api.storage.set('seen', seen);
      };
      const t = setInterval(tick, 3 * 60e3); setTimeout(tick, 15000);

      const css = document.createElement('style');
      css.textContent = `.od-l{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}
        .od-l li{display:grid;grid-template-columns:18px 118px 1fr;align-items:baseline;gap:8px;font-size:13px} .od-l li svg{width:16px;height:16px;color:var(--muted);align-self:center}
        .od-v{max-width:720px} .od-v h3{margin:18px 0 4px;font-size:15px}
        .od-p{list-style:none;padding:0;margin:6px 0;display:flex;flex-direction:column;gap:4px} .od-p li{display:grid;grid-template-columns:150px 1fr auto;gap:10px;font-size:13px;padding:4px 6px;border-radius:6px}
        .od-p li.on{background:var(--accent-soft)} .od-c{display:flex;gap:8px;align-items:center;font-size:13px;margin:4px 0} .od-src{font-size:12px;margin-top:12px}`;
      document.head.appendChild(css);
      return () => { clearInterval(t); css.remove(); };
    },
  });
})();
