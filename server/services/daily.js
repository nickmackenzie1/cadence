'use strict';
/* Free daily data (user picked 2026-11-16), all fetched here on the NAS through safeFetch, cached, no keys:
   outdoors (air quality + UV from Open-Meteo, northern lights from NOAA SWPC, ISS passes from a Celestrak TLE with
   satellite.js), daily bits (Wikipedia "On this day", xkcd, Lichess daily puzzle, Hacker News), home (TheMealDB dinner
   ideas, Open Food Facts barcodes, TVmaze episodes). DAILY_BASE points every host at a fake in tests. */
const { safeFetch } = require('../lib/net');
const sat = require('../vendor/satellite.min.js');

const UA = 'Cadence/1 (self-hosted to-do app; https://github.com/nickmackenzie1/cadence)';
const BASE = process.env.DAILY_BASE ? process.env.DAILY_BASE.replace(/\/$/, '') : null;
const at = url => (BASE ? BASE + '/' + url.replace(/^https?:\/\//, '') : url);
const fetchImpl = async (url, max) => {
  if (BASE) { const r = await fetch(at(url), { headers: { 'User-Agent': UA } }); if (!r.ok) throw new Error('HTTP ' + r.status); return Buffer.from(await r.arrayBuffer()); }
  return (await safeFetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, timeout: 10000 }, max)).buf;
};
const cache = new Map();
async function cached(key, ttl, fn) {
  const c = cache.get(key);
  if (c && Date.now() - c.at < ttl) return c.v;
  try { const v = await fn(); cache.set(key, { at: Date.now(), v }); return v; }
  catch (e) { if (c) return c.v; throw e; }   // offline: the last good answer beats nothing
}
const json = async (url, max = 2 * 1024 * 1024) => JSON.parse((await fetchImpl(url, max)).toString('utf8'));
const text = async (url, max = 256 * 1024) => (await fetchImpl(url, max)).toString('utf8');
const num = (v, lo, hi) => { const n = +v; if (!isFinite(n) || n < lo || n > hi) throw Object.assign(new Error('bad coordinates'), { code: 400 }); return n; };
const MIN = 60e3, HOUR = 3600e3;

// ---------------------------------------------------------------- outdoors
const AQI = [[50, 'Good'], [100, 'Moderate'], [150, 'Poor for sensitive people'], [200, 'Poor'], [300, 'Very poor'], [Infinity, 'Hazardous']];
const UVL = [[3, 'Low'], [6, 'Moderate'], [8, 'High'], [11, 'Very high'], [Infinity, 'Extreme']];
const band = (v, list) => v == null ? null : list.find(([max]) => v < max)[1];
async function air(lat, lon) {
  return cached(`air:${lat.toFixed(2)},${lon.toFixed(2)}`, 30 * MIN, async () => {
    const d = await json(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5&hourly=uv_index,alder_pollen,birch_pollen,grass_pollen,ragweed_pollen&forecast_days=1&timezone=auto`);
    const c = d.current || {}, h = d.hourly || {};
    const max = k => { const v = (h[k] || []).filter(x => x != null); return v.length ? Math.max(...v) : null; };
    // pollen comes from the European model: outside Europe it's empty, and then we say nothing about it
    const pollen = Object.fromEntries(['alder', 'birch', 'grass', 'ragweed'].map(p => [p, max(p + '_pollen')]).filter(([, v]) => v != null && v > 0));
    const uv = max('uv_index');
    return { aqi: c.us_aqi ?? null, aqiLabel: band(c.us_aqi, AQI), pm25: c.pm2_5 ?? null, uvMax: uv == null ? null : Math.round(uv * 10) / 10, uvLabel: band(uv, UVL), pollen };
  });
}

// geomagnetic latitude (dipole approximation) and the Kp it takes to see aurora overhead/on the horizon there
const POLE = { lat: 80.7 * Math.PI / 180, lon: -72.7 * Math.PI / 180 };
function geomagLat(lat, lon) {
  const a = lat * Math.PI / 180, b = lon * Math.PI / 180;
  return Math.asin(Math.sin(a) * Math.sin(POLE.lat) + Math.cos(a) * Math.cos(POLE.lat) * Math.cos(b - POLE.lon)) * 180 / Math.PI;
}
const kpNeeded = gm => Math.max(0, Math.min(9, Math.round((66.5 - Math.abs(gm)) / 2.1)));   // ~Kp 6 at Amherstview's ~54°
async function aurora(lat, lon) {
  const rows = await cached('kp', 30 * MIN, () => json('https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json'));
  // the feed has been an array of arrays (header row first) and an array of objects; read either
  const list = (Array.isArray(rows) ? rows : []).map(r => Array.isArray(r) ? { t: r[0], kp: +r[1], kind: r[2] } : { t: r.time_tag, kp: +(r.kp ?? r.Kp), kind: r.observed })
    .filter(r => r.t && isFinite(r.kp)).map(r => ({ ...r, at: Date.parse(/Z$/.test(r.t) ? r.t : r.t.replace(' ', 'T') + 'Z') }));
  const now = Date.now(), next = list.filter(r => r.at >= now - 3 * HOUR && r.at <= now + 24 * HOUR);
  const peak = next.reduce((m, r) => (r.kp > m.kp ? r : m), { kp: 0, at: null });
  const need = kpNeeded(geomagLat(lat, lon));
  return { kpMax: peak.kp, kpAt: peak.at ? new Date(peak.at).toISOString() : null, kpNeeded: need, possible: peak.kp >= need, likely: peak.kp >= need + 1 };
}

// ISS: passes over you in the next 3 days from the latest orbit data (TLE). "visible" = it's dark where you are and
// the station is in sunlight, the only time you can see it.
function sunEci(date) {   // low-precision solar position, good to a fraction of a degree
  const jd = date.getTime() / 864e5 + 2440587.5, n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360, g = ((357.528 + 0.9856003 * n) % 360) * Math.PI / 180;
  const lam = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * Math.PI / 180, eps = (23.439 - 0.0000004 * n) * Math.PI / 180;
  const R = (1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g)) * 149597870.7;   // km
  return { x: R * Math.cos(lam), y: R * Math.cos(eps) * Math.sin(lam), z: R * Math.sin(eps) * Math.sin(lam) };
}
function sunlit(posEci, date) {   // cylindrical Earth shadow
  const s = sunEci(date), sl = Math.hypot(s.x, s.y, s.z), u = { x: s.x / sl, y: s.y / sl, z: s.z / sl };
  const dot = posEci.x * u.x + posEci.y * u.y + posEci.z * u.z;
  if (dot > 0) return true;
  const perp = Math.hypot(posEci.x - dot * u.x, posEci.y - dot * u.y, posEci.z - dot * u.z);
  return perp > 6371;
}
function sunElevation(date, obs) {
  const s = sunEci(date), gmst = sat.gstime(date);
  const look = sat.ecfToLookAngles(obs, sat.eciToEcf({ x: s.x, y: s.y, z: s.z }, gmst));
  return look.elevation * 180 / Math.PI;
}
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const compass = az => DIRS[Math.round(((az * 180 / Math.PI) % 360 + 360) % 360 / 45) % 8];
function passes(tle, lat, lon, from = new Date(), hours = 72) {
  const rec = sat.twoline2satrec(tle[0], tle[1]), obs = { latitude: lat * Math.PI / 180, longitude: lon * Math.PI / 180, height: 0.1 };
  const out = []; let cur = null;
  for (let t = from.getTime(); t < from.getTime() + hours * HOUR; t += 20e3) {
    const d = new Date(t), pv = sat.propagate(rec, d); if (!pv.position) continue;
    const look = sat.ecfToLookAngles(obs, sat.eciToEcf(pv.position, sat.gstime(d))), el = look.elevation * 180 / Math.PI;
    if (el > 10) {
      const lit = sunlit(pv.position, d), dark = sunElevation(d, obs) < -6;
      if (!cur) cur = { start: d.toISOString(), from: compass(look.azimuth), maxEl: el, visible: false };
      if (el > cur.maxEl) { cur.maxEl = el; cur.peak = d.toISOString(); }
      if (lit && dark) cur.visible = true;
      cur.end = d.toISOString(); cur.to = compass(look.azimuth);
    } else if (cur) { out.push({ ...cur, maxEl: Math.round(cur.maxEl) }); cur = null; }
  }
  if (cur) out.push({ ...cur, maxEl: Math.round(cur.maxEl) });
  return out;
}
async function iss(lat, lon) {
  const raw = await cached('tle', 12 * HOUR, () => text('https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE'));
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => /^[12] /.test(l));
  if (lines.length < 2) throw new Error('no orbit data');
  return cached(`iss:${lat.toFixed(1)},${lon.toFixed(1)}`, 30 * MIN, async () => passes(lines.slice(0, 2), lat, lon).slice(0, 12));
}
async function outdoors(q) {
  const lat = num(q.lat, -90, 90), lon = num(q.lon, -180, 180);
  const [a, b, c] = await Promise.allSettled([air(lat, lon), aurora(lat, lon), iss(lat, lon)]);
  const v = r => (r.status === 'fulfilled' ? r.value : { error: r.reason && r.reason.message });
  return { air: v(a), aurora: v(b), iss: v(c) };
}

// ---------------------------------------------------------------- daily bits
async function onThisDay() {
  const d = new Date(), mm = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return cached('otd:' + mm + dd, 6 * HOUR, async () => {
    const j = await json(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected/${mm}/${dd}`);
    return (j.selected || []).slice(0, 8).map(e => { const p = (e.pages || [])[0] || {};
      return { year: e.year, text: e.text, title: p.normalizedtitle || p.title || null, url: p.content_urls && p.content_urls.desktop && p.content_urls.desktop.page || null, image: p.thumbnail && p.thumbnail.source || null }; });
  });
}
const xkcd = () => cached('xkcd', HOUR, async () => { const j = await json('https://xkcd.com/info.0.json'); return { num: j.num, title: j.safe_title || j.title, img: j.img, alt: j.alt, url: `https://xkcd.com/${j.num}/`, date: `${j.year}-${String(j.month).padStart(2, '0')}-${String(j.day).padStart(2, '0')}` }; });
const lichess = () => cached('lichess', HOUR, async () => { const j = await json('https://lichess.org/api/puzzle/daily'); const p = j.puzzle || {};
  return { id: p.id, rating: p.rating, plays: p.plays, themes: p.themes || [], url: `https://lichess.org/training/${p.id}` }; });
const hn = () => cached('hn', 15 * MIN, async () => {
  const ids = (await json('https://hacker-news.firebaseio.com/v0/topstories.json')).slice(0, 12);
  const items = await Promise.all(ids.map(id => json(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).catch(() => null)));
  return items.filter(i => i && i.title).map(i => ({ id: i.id, title: i.title, url: i.url || `https://news.ycombinator.com/item?id=${i.id}`, score: i.score || 0, comments: i.descendants || 0, discuss: `https://news.ycombinator.com/item?id=${i.id}` }));
});

// ---------------------------------------------------------------- home
function meal(m) {
  const ingredients = [];
  for (let i = 1; i <= 20; i++) { const n = (m['strIngredient' + i] || '').trim(), q = (m['strMeasure' + i] || '').trim(); if (n) ingredients.push((q ? q + ' ' : '') + n); }
  return { id: m.idMeal, name: m.strMeal, category: m.strCategory || null, area: m.strArea || null, image: m.strMealThumb || null,
    ingredients, steps: String(m.strInstructions || '').split(/\r?\n+/).map(s => s.trim()).filter(s => s.length > 2).slice(0, 30), url: m.strSource || (m.strYoutube || null) };
}
async function meals(q) {
  const n = Math.max(1, Math.min(6, +q.n || 3)), out = [], seen = new Set();
  for (let i = 0; i < n * 2 && out.length < n; i++) {
    const j = await json('https://www.themealdb.com/api/json/v1/1/random.php');   // the free test key "1"
    const m = (j.meals || [])[0]; if (m && !seen.has(m.idMeal)) { seen.add(m.idMeal); out.push(meal(m)); }
  }
  return out;
}
async function food(q) {
  const code = String(q.code || '').replace(/\D/g, '');
  if (code.length < 6 || code.length > 14) throw Object.assign(new Error('That doesn\'t look like a barcode'), { code: 400 });
  return cached('off:' + code, 30 * 24 * HOUR, async () => {
    const j = await json(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,quantity,image_small_url,categories_tags`);
    const p = j.product; if (!p || j.status === 0) return { code, found: false };
    return { code, found: true, name: [p.brands && p.brands.split(',')[0].trim(), p.product_name].filter(Boolean).join(' ') || null, product: p.product_name || null, brand: p.brands || null, quantity: p.quantity || null, image: p.image_small_url || null };
  });
}
async function tvSearch(q) {
  const s = String(q.q || '').trim().slice(0, 80); if (s.length < 2) return [];
  const j = await cached('tvs:' + s.toLowerCase(), 6 * HOUR, () => json(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(s)}`));
  return (j || []).slice(0, 10).map(({ show: s0 }) => ({ id: s0.id, name: s0.name, network: (s0.network || s0.webChannel || {}).name || null, premiered: s0.premiered || null, status: s0.status, image: s0.image && s0.image.medium || null }));
}
async function tvUpcoming(q) {
  const ids = String(q.ids || '').split(',').map(x => +x).filter(x => x > 0).slice(0, 30);
  const shows = await Promise.all(ids.map(id => cached('tv:' + id, 3 * HOUR, () => json(`https://api.tvmaze.com/shows/${id}?embed[]=nextepisode&embed[]=previousepisode`)).catch(() => null)));
  return shows.filter(Boolean).map(s => { const e = s._embedded || {}, n = e.nextepisode, p = e.previousepisode;
    const ep = x => x && { name: x.name, season: x.season, number: x.number, airstamp: x.airstamp || (x.airdate ? x.airdate + 'T' + (x.airtime || '20:00') : null) };
    return { id: s.id, name: s.name, network: (s.network || s.webChannel || {}).name || null, image: s.image && s.image.medium || null, status: s.status, next: ep(n), last: ep(p) }; });
}

module.exports = { outdoors, onThisDay, xkcd, lichess, hn, meals, food, tvSearch, tvUpcoming, _passes: passes, _geomagLat: geomagLat, _kpNeeded: kpNeeded };
