// Calendars on a timer (2026-11-18): events are expanded in a worker thread and kept, so requests don't parse.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('the worker gives the same events as the main thread, and a second read is served from what was kept', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cadence-cal-'));
  try {
    const out = execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', '-e', `
      const fs = require('fs'), path = require('path');
      const url = 'https://calendar.example.com/x.ics';
      fs.writeFileSync(path.join(process.env.DATA_DIR, 'calendars.json'), JSON.stringify({ calendars: [{ id: 'w', name: 'Work', url }] }));
      const C = require('./server/services/calendar.js');
      const d = new Date(Date.now() + 2 * 864e5), p = n => String(n).padStart(2, '0');
      const day = d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate());
      const ics = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:a1', 'SUMMARY:Standup', 'DTSTART:' + day + 'T140000Z', 'DTEND:' + day + 'T141500Z', 'RRULE:FREQ=DAILY;COUNT=5', 'END:VEVENT',
        'BEGIN:VEVENT', 'UID:b2', 'SUMMARY:Review', 'DTSTART:' + day + 'T180000Z', 'DTEND:' + day + 'T190000Z', 'LOCATION:https://zoom.us/j/123', 'END:VEVENT', 'END:VCALENDAR'].join('\\r\\n');
      C.icsCache.set(url, { at: Date.now(), text: ics });
      (async () => {
        const t0 = Date.now(), a = await C.calendarEvents(14);
        const main = C.eventsFrom({ id: 'w' }, ics, Date.now() - 864e5, Date.now() + 60 * 864e5);
        const t1 = Date.now(), b = await C.calendarEvents(14), kept = Date.now() - t1;
        console.log(JSON.stringify({ n: a.length, titles: [...new Set(a.map(e => e.title))].sort(), same: JSON.stringify(a.map(e => e.id)) === JSON.stringify(main.sort((x, y) => x.start - y.start).map(e => e.id)), kept, again: b.length, join: (a.find(e => e.title === 'Review') || {}).join }));
        process.exit(0);
      })();`], { env: { ...process.env, DATA_DIR: dir }, cwd: process.cwd() }).toString();
    const r = JSON.parse(out.trim().split('\n').pop());
    expect(r.titles).toEqual(['Review', 'Standup']);
    expect(r.n).toBe(6);
    expect(r.same).toBe(true);
    expect(r.again).toBe(6);
    expect(r.kept).toBeLessThan(20);
    expect(r.join).toBe('https://zoom.us/j/123');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('feeds are parsed in a worker thread, with the same result as the main thread', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cadence-feed-'));
  try {
    const out = execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', '-e', `
      const F = require('./server/services/feeds.js'), { parseFeed } = require('./server/lib/feedparse');
      const xml = '<?xml version="1.0"?><rss version="2.0"><channel><title>Blog</title>' + Array.from({ length: 40 }, (_, i) => '<item><title>Post ' + i + ' &amp; more</title><link>https://example.com/' + i + '</link><pubDate>Mon, 0' + (1 + i % 9) + ' Jan 2024 10:00:00 GMT</pubDate></item>').join('') + '</channel></rss>';
      F.parseOff(xml, 'https://example.com/feed').then(d => { console.log(JSON.stringify({ same: JSON.stringify(d) === JSON.stringify(parseFeed(xml, 'https://example.com/feed')), n: d.items.length, t: d.items[0].title })); process.exit(0); });`],
      { env: { ...process.env, DATA_DIR: dir }, cwd: process.cwd() }).toString();
    const r = JSON.parse(out.trim().split('\n').pop());
    expect(r).toEqual({ same: true, n: 40, t: 'Post 0 & more' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
