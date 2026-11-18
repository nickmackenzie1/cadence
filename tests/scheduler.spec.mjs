// The scheduler (server/lib/scheduler.js): heavy jobs take turns, quiet ones wait while you're using Cadence,
// jobs can go again sooner or stop, failures are kept, and the Problems page lists the NAS's background work.
import { test, expect } from '@playwright/test';
import { spawnSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

test('heavy jobs take turns, quiet jobs wait while in use, again/done/errors are kept', () => {
  const out = spawnSync(process.execPath, ['-e', `
    const S = require('./server/lib/scheduler.js'), log = [], sleep = ms => new Promise(r => setTimeout(r, ms));
    let inA = 0, overlap = false, bRuns = 0, cRuns = 0;
    const heavy = name => async () => { inA++; if (inA > 1) overlap = true; log.push(name + '+'); await sleep(120); log.push(name + '-'); inA--; };
    S.add('a', heavy('a'), { heavy: true, every: 60000, first: 0 });
    S.add('b', async () => { bRuns++; await heavy('b')(); return bRuns < 3 ? { again: 0 } : { done: true, note: 'all done' }; }, { heavy: true, every: 60000, first: 0 });
    S.add('quiet', () => { cRuns++; }, { quiet: true, every: 60000, first: 0 });
    S.add('bad', () => { throw new Error('nope'); }, { every: 60000, first: 0, retry: 60000 });
    S.touch();   // someone is using Cadence: the quiet job waits
    setTimeout(() => {
      const L = Object.fromEntries(S.list().map(j => [j.name, j]));
      console.log(JSON.stringify({ overlap, bRuns, cRuns, b: L.b.state, bNote: L.b.last.note, quiet: L.quiet.state, quietWhy: L.quiet.waiting, bad: L.bad.last, badFails: L.bad.fails }));
      process.exit(0);
    }, 1800);
  `], { env: { ...process.env, SCHEDULER_TICK: '50', QUIET_MS: '5000' }, encoding: 'utf8' });
  expect(out.status, out.stderr).toBe(0);
  const r = JSON.parse(out.stdout.trim().split('\n').pop());
  expect(r.overlap).toBe(false);                 // never two heavy jobs at once
  expect(r.bRuns).toBe(3);                       // { again: 0 } ran it again straight away, { done: true } stopped it
  expect(r.b).toBe('finished'); expect(r.bNote).toBe('all done');
  expect(r.cRuns).toBe(0); expect(r.quiet).toBe('waiting'); expect(r.quietWhy).toMatch(/while you use/);
  expect(r.bad.ok).toBe(false); expect(r.bad.error).toBe('nope'); expect(r.badFails).toBe(1);
});

test('a quiet job runs once nobody has been using Cadence for a while', () => {
  const out = spawnSync(process.execPath, ['-e', `
    const S = require('./server/lib/scheduler.js'); let n = 0;
    S.add('q', () => { n++; }, { quiet: true, every: 60000, first: 0 });
    S.touch();
    setTimeout(() => { const before = n; setTimeout(() => { console.log(JSON.stringify({ before, after: n })); process.exit(0); }, 700); }, 200);
  `], { env: { ...process.env, SCHEDULER_TICK: '50', QUIET_MS: '400' }, encoding: 'utf8' });
  expect(out.status, out.stderr).toBe(0);
  const r = JSON.parse(out.stdout.trim().split('\n').pop());
  expect(r.before).toBe(0); expect(r.after).toBe(1);
});

test('the Problems page lists the background work on the NAS', async ({ page }) => {
  const PORT = await freePort(), dir = mkdtempSync(join(tmpdir(), 'cadence-jobs-'));
  const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir }, stdio: 'ignore' });
  const B = `http://localhost:${PORT}`;
  try {
    for (let i = 0; i < 150; i++) { try { if ((await fetch(B + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
    const jobs = await (await fetch(B + '/api/jobs')).json();
    expect(jobs.map(j => j.name)).toEqual(expect.arrayContaining(['db-upkeep', 'feeds', 'reminders']));
    await expect.poll(async () => { const r = await fetch(B + '/api/radar/jobs'); return r.ok ? (await r.json()).map(j => j.name) : []; }, { timeout: 25000 }).toContain('radar-scan');
    await page.goto(B + '/#view-problems');
    await expect(page.locator('.pr-jh')).toHaveText('Background work', { timeout: 15000 });
    await expect(page.locator('.pr-jobs li', { hasText: 'Database upkeep' })).toBeVisible();
    await expect(page.locator('.pr-jobs li', { hasText: 'Music Radar: scans' })).toContainText('Music side');
    // requests carry X-Cadence-Active only right after you do something, not from an idle open tab
    const seen = [];
    page.on('request', r => { if (r.url().includes('/api/jobs')) seen.push(!!r.headers()['x-cadence-active']); });
    await page.evaluate(() => fetch('api/jobs'));
    await page.mouse.click(5, 5);
    await page.evaluate(() => fetch('api/jobs'));
    await expect.poll(() => seen.length).toBeGreaterThanOrEqual(2);
    expect(seen.slice(-2)).toEqual([false, true]);
  } finally { server.kill(); rmSync(dir, { recursive: true, force: true }); }
});
