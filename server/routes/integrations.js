'use strict';
/* Routes: Weather (Open-Meteo), Zoho Cliq, recipe links. Each handler answers or leaves the request for the next. */
const fs = require('fs');
const { NEXT, readBody, send } = require('../lib/http');
const { safeFetch } = require('../lib/net');
const { CLIQ_FILE, CLIQ_HOSTS, cliqPost, readCliq } = require('../services/cliq');
const { wxCache } = require('../services/push');
const { readRecipe } = require('../services/recipes');

// (req, res, { url, p, leaf }) → answers the request, or returns NEXT
module.exports = async function integrationsRoutes(req, res, { url, p }) {
  if (p === '/api/weather' || p === '/api/weather/geo') {
    // Open-Meteo: free, no API key. Cached 15 min per place.
    const geo = p.endsWith('/geo');
    const u = geo ? `https://geocoding-api.open-meteo.com/v1/search?count=6&language=en&format=json&name=${encodeURIComponent(String(url.searchParams.get('q') || '').slice(0, 80))}`
      : (() => { const lat = +url.searchParams.get('lat'), lon = +url.searchParams.get('lon'), f = url.searchParams.get('units') === 'f';
          if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
          return `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&timezone=auto&forecast_days=7${f ? '&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch' : ''}`
            + '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day,precipitation&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset'; })();
    if (!u) return send(res, 400, { error: 'bad place' });
    const hit = wxCache.get(u); if (hit && Date.now() - hit.at < 15 * 60e3) return send(res, 200, hit.data);
    try { const r = await safeFetch(u, {}, 512 * 1024); const data = JSON.parse(r.buf.toString('utf8')); wxCache.set(u, { at: Date.now(), data }); if (wxCache.size > 40) wxCache.delete(wxCache.keys().next().value); return send(res, 200, data); }
    catch (e) { return hit ? send(res, 200, hit.data) : send(res, 502, { error: 'Weather unavailable: ' + e.message }); }
  }
  if (p === '/api/cliq/config' && req.method === 'GET') { const c = readCliq(); return send(res, 200, { channel: c.channel || '', dc: c.dc || 'com', hasKey: !!c.zapikey }); }
  if (p === '/api/cliq/config' && req.method === 'PUT') {
    const b = JSON.parse(await readBody(req, 4096)), c = readCliq();
    const next = { channel: String(b.channel || '').replace(/[^\w-]/g, '').slice(0, 80), dc: CLIQ_HOSTS[b.dc] ? b.dc : 'com', zapikey: b.zapikey ? String(b.zapikey).trim().slice(0, 200) : c.zapikey };
    if (b.clear) { try { fs.unlinkSync(CLIQ_FILE); } catch {} return send(res, 200, { ok: true }); }
    fs.writeFileSync(CLIQ_FILE, JSON.stringify(next)); try { fs.chmodSync(CLIQ_FILE, 0o600); } catch {} return send(res, 200, { ok: true });
  }
  if (p === '/api/cliq/post' && req.method === 'POST') {
    const b = JSON.parse(await readBody(req, 16 * 1024));
    try { await cliqPost(b.text || ''); return send(res, 200, { ok: true }); } catch (e) { return send(res, 502, { error: e.message }); }
  }
  if (p === '/api/recipe') {
    const u = String(url.searchParams.get('url') || '');
    if (!/^https?:\/\//i.test(u)) return send(res, 400, { error: 'Paste the recipe’s web address' });
    try { return send(res, 200, await readRecipe(u)); } catch (e) { return send(res, 502, { error: 'Could not read that page: ' + e.message }); }
  }
  // meeting screenshots: stored as files on the NAS, referenced by id from the meeting
  return NEXT;   // not ours
};
