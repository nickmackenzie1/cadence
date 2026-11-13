'use strict';
/* Routes: Calendar feeds: settings and events. Each handler answers or leaves the request for the next. */
const fs = require('fs');
const { NEXT, readBody, send } = require('../lib/http');
const { CAL_FILE, LOCAL_TZ, calendarEvents, icsCache, readCals } = require('../services/calendar');

// (req, res, { url, p, leaf }) → answers the request, or returns NEXT
module.exports = async function calendarRoutes(req, res, { url, p }) {
  if (p === '/api/calendar/config' && req.method === 'GET') {
    // never send the secret URLs back to the browser
    return send(res, 200, { calendars: readCals().calendars.map(c => ({ id: c.id, name: c.name, color: c.color, host: (() => { try { return new URL(c.url.replace(/^webcal:/i, 'https:')).hostname; } catch { return ''; } })() })) });
  }
  if (p === '/api/calendar/config' && req.method === 'PUT') {
    const body = JSON.parse(await readBody(req, 64 * 1024)), old = readCals().calendars;
    const cals = (body.calendars || []).slice(0, 10).map(c => ({ id: String(c.id || Date.now()).slice(0, 40), name: String(c.name || 'Calendar').slice(0, 60), color: /^#[0-9a-f]{3,8}$/i.test(c.color || '') ? c.color : '#5b5bd6', url: c.url ? String(c.url).trim() : ((old.find(o => o.id === c.id) || {}).url || '') }))
      .filter(c => /^(https?|webcal):\/\//i.test(c.url));
    fs.writeFileSync(CAL_FILE, JSON.stringify({ calendars: cals })); try { fs.chmodSync(CAL_FILE, 0o600); } catch {}
    icsCache.clear(); return send(res, 200, { ok: true, count: cals.length });
  }
  if (p === '/api/calendar/events') {
    const days = Math.min(60, Math.max(1, +url.searchParams.get('days') || 14));
    if (url.searchParams.get('refresh') === '1') icsCache.clear();
    return send(res, 200, { events: await calendarEvents(days), tz: LOCAL_TZ, at: Date.now() });
  }
  return NEXT;   // not ours
};
