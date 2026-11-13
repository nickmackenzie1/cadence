'use strict';
/* Calendars: iCal (.ics) feeds to events, with recurrence and time zones. Calendar URLs stay on the NAS. */
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config');
const { safeFetch } = require('../lib/net');

// ---- calendars: iCal (.ics) feeds -> events, with recurrence + time zones. URLs stay on the NAS. ----
const CAL_FILE = path.join(DATA_DIR, 'calendars.json');
const icsCache = new Map();
const WINTZ = { 'Eastern Standard Time': 'America/New_York', 'Central Standard Time': 'America/Chicago', 'Mountain Standard Time': 'America/Denver', 'Pacific Standard Time': 'America/Los_Angeles', 'Atlantic Standard Time': 'America/Halifax', 'Newfoundland Standard Time': 'America/St_Johns', 'GMT Standard Time': 'Europe/London', 'W. Europe Standard Time': 'Europe/Berlin', 'Romance Standard Time': 'Europe/Paris', 'Central Europe Standard Time': 'Europe/Budapest', 'India Standard Time': 'Asia/Kolkata', 'AUS Eastern Standard Time': 'Australia/Sydney', 'UTC': 'UTC' };
const LOCAL_TZ = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
function tzOffset(ms, tz) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms)).map(x => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ms;
  } catch { return 0; }
}
function zoned(y, mo, d, h, mi, s, tz) { const g = Date.UTC(y, mo, d, h, mi, s); let t = g - tzOffset(g, tz); t = g - tzOffset(t, tz); return t; }
function readCals() { try { return JSON.parse(fs.readFileSync(CAL_FILE, 'utf8')); } catch { return { calendars: [] }; } }
function parseICS(text) {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const evs = []; let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = { props: {}, exdate: [] }; continue; }
    if (line === 'END:VEVENT') { if (cur) evs.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = line.indexOf(':'); if (i < 0) continue;
    const head = line.slice(0, i), val = line.slice(i + 1), [name, ...ps] = head.split(';');
    const params = Object.fromEntries(ps.map(p => { const [k, v] = p.split('='); return [k.toUpperCase(), (v || '').replace(/^"|"$/g, '')]; }));
    const key = name.toUpperCase();
    if (key === 'EXDATE') cur.exdate.push(...val.split(',').map(v => ({ v, params })));
    else if (key === 'ATTENDEE') (cur.att = cur.att || []).push({ v: val, params });
    else cur.props[key] = { v: val, params };
  }
  return evs;
}
const unesc = s => String(s || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim();
function icsTime(p) {
  if (!p) return null;
  const v = p.v.trim(), m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/); if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2] - 1, +m[3]];
  if (!m[4] || p.params.VALUE === 'DATE') return { allDay: true, wall: [y, mo, d, 0, 0, 0], tz: LOCAL_TZ, ms: zoned(y, mo, d, 0, 0, 0, LOCAL_TZ) };
  const wall = [y, mo, d, +m[4], +m[5], +(m[6] || 0)];
  if (m[7]) return { allDay: false, wall, tz: 'UTC', ms: Date.UTC(...wall) };
  const tz = WINTZ[p.params.TZID] || p.params.TZID || LOCAL_TZ;
  return { allDay: false, wall, tz, ms: zoned(...wall, tz) };
}
const DAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
function expand(ev, from, to) {
  const st = icsTime(ev.props.DTSTART); if (!st) return [];
  const en = icsTime(ev.props.DTEND); const dur = en ? en.ms - st.ms : (st.allDay ? 864e5 : 30 * 60e3);
  const rule = ev.props.RRULE && Object.fromEntries(ev.props.RRULE.v.split(';').map(kv => kv.split('=')));
  const ex = new Set(ev.exdate.map(e => { const t = icsTime(e); return t && t.ms; }).filter(Boolean));
  if (!rule) return st.ms + dur >= from && st.ms <= to ? [st.ms] : [];
  const freq = rule.FREQ, interval = +(rule.INTERVAL || 1), count = rule.COUNT ? +rule.COUNT : Infinity;
  const until = rule.UNTIL ? (icsTime({ v: rule.UNTIL, params: {} }) || {}).ms : Infinity;
  const byday = rule.BYDAY ? rule.BYDAY.split(',').map(x => DAYS[x.slice(-2)]).filter(x => x != null) : null;
  const [y0, m0, d0, h, mi, s] = st.wall, out = []; let n = 0;
  const at = (y, mo, d) => zoned(y, mo, d, h, mi, s, st.tz);
  const day0 = Date.UTC(y0, m0, d0);
  const push = ms => { if (ms < st.ms) return true; if (ms > until || n >= count) return false; n++; if (!ex.has(ms) && ms + dur >= from && ms <= to) out.push(ms); return ms <= to; };
  for (let k = 0; k < 2000; k++) {
    let cont = true;
    if (freq === 'DAILY') { const t = new Date(day0 + k * interval * 864e5); cont = push(at(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())); }
    else if (freq === 'WEEKLY') {
      const wk = day0 - new Date(day0).getUTCDay() * 864e5 + k * interval * 7 * 864e5;
      for (const dw of (byday || [new Date(day0).getUTCDay()]).slice().sort()) { const t = new Date(wk + dw * 864e5); if (!(cont = push(at(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())))) break; }
    } else if (freq === 'MONTHLY') { const t = new Date(Date.UTC(y0, m0 + k * interval, 1)); const dim = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); const dd = +(rule.BYMONTHDAY || d0); if (dd <= dim) cont = push(at(t.getUTCFullYear(), t.getUTCMonth(), dd)); }
    else if (freq === 'YEARLY') { cont = push(at(y0 + k * interval, m0, d0)); }
    else break;
    if (!cont) break;
  }
  return out;
}
async function calendarEvents(days) {
  const from = Date.now() - 864e5, to = Date.now() + days * 864e5, out = [];
  for (const cal of readCals().calendars) {
    if (!cal.url) continue;
    let text; const hit = icsCache.get(cal.url);
    if (hit && Date.now() - hit.at < 10 * 60e3) text = hit.text;
    else { try { const r = await safeFetch(cal.url.replace(/^webcal:/i, 'https:'), {}, 8 * 1024 * 1024); text = r.buf.toString('utf8'); icsCache.set(cal.url, { at: Date.now(), text }); } catch (e) { if (hit) text = hit.text; else { out.push({ error: true, cal: cal.id, message: e.message }); continue; } } }
    const evs = parseICS(text), overrides = new Map();
    for (const ev of evs) if (ev.props['RECURRENCE-ID']) { const t = icsTime(ev.props['RECURRENCE-ID']); if (t) overrides.set((ev.props.UID || {}).v + '|' + t.ms, ev); }
    for (const ev of evs) {
      if (ev.props['RECURRENCE-ID']) continue;
      const uid = (ev.props.UID || {}).v || Math.random().toString(36);
      for (const ms of expand(ev, from, to)) {
        const e = overrides.get(uid + '|' + ms) || ev;
        if (/CANCELLED/i.test((e.props.STATUS || {}).v || '')) continue;
        const st = icsTime(e.props.DTSTART), en = icsTime(e.props.DTEND), base = e === ev ? ms : st.ms;
        const dur = en && st ? en.ms - st.ms : (st && st.allDay ? 864e5 : 30 * 60e3);
        const desc = unesc((e.props.DESCRIPTION || {}).v), loc = unesc((e.props.LOCATION || {}).v);
        const join = ((desc + ' ' + loc).match(/https:\/\/[^\s<>"]*(zoom\.us\/[jw]\/|meet\.google\.com\/|teams\.microsoft\.com\/l\/meetup-join|webex\.com\/)[^\s<>"]*/i) || [])[0] || '';
        out.push({ id: uid + '@' + base, cal: cal.id, title: unesc((e.props.SUMMARY || {}).v) || '(no title)', start: base, end: base + dur, allDay: !!(st && st.allDay),
          location: loc.slice(0, 200), join, description: desc.slice(0, 600),
          attendees: (e.att || []).map(a => ({ email: a.v.replace(/^mailto:/i, '').toLowerCase(), name: a.params.CN || '' })).slice(0, 40),
          organizer: ((e.props.ORGANIZER || {}).v || '').replace(/^mailto:/i, '').toLowerCase() });
      }
    }
  }
  return out.sort((a, b) => (a.start || 0) - (b.start || 0));
}

module.exports = { CAL_FILE, DAYS, LOCAL_TZ, WINTZ, calendarEvents, expand, icsCache, icsTime, parseICS, readCals, tzOffset, unesc, zoned };
