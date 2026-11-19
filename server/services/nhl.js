'use strict';
/* NHL scores for the Island (user idea: Leafs on the Island, 2026-11-19). The NHL's own public feed, no key:
   api-web.nhle.com/v1/score/now (today's games, live score, clock, goals) and /v1/club-schedule/<TEAM>/week/now (the
   next game). Kept 15 s while a game is on, 10 minutes otherwise, so every open tab doesn't ask. Team names only:
   no logos are fetched. NHL_API points at a stand-in for tests. */
const { safeFetch } = require('../lib/net');

const BASE = () => process.env.NHL_API || 'https://api-web.nhle.com';
const TEAM_RE = /^[A-Z]{3}$/;
const cache = new Map();   // team → { at, v }

async function getJson(path) {
  // a test's stand-in (NHL_API set) directly; the real NHL through the public-hosts-only fetch
  if (process.env.NHL_API) { const r = await fetch(BASE() + path, { signal: AbortSignal.timeout(6000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
  const r = await safeFetch(BASE() + path, { headers: { Accept: 'application/json', 'User-Agent': 'Cadence/1 (self-hosted to-do app)' }, timeout: 6000 }, 2 * 1024 * 1024);
  return JSON.parse(r.buf.toString('utf8'));
}
const nm = x => (x && typeof x === 'object' ? x.default || Object.values(x)[0] : x) || '';
// the NHL's gameState → ours: fut (later), pre (warm-up), live, final
const stateOf = g => ({ FUT: 'fut', PRE: 'pre', LIVE: 'live', CRIT: 'live', FINAL: 'final', OFF: 'final' })[g.gameState] || 'fut';

function side(t) {
  return { abbrev: t.abbrev || '', name: nm(t.commonName) || nm(t.name) || nm(t.placeName) || t.abbrev || '', place: nm(t.placeName) || '', score: t.score ?? null, sog: t.sog ?? null };
}
// one game from score/now, seen from `team`'s side
function shape(g, team) {
  const home = g.homeTeam && g.homeTeam.abbrev === team, us = side(home ? g.homeTeam : g.awayTeam), them = side(home ? g.awayTeam : g.homeTeam);
  const pd = g.periodDescriptor || {}, clock = g.clock || {};
  const goals = (g.goals || []).map(x => ({
    key: `${x.period ?? (x.periodDescriptor || {}).number}-${x.timeInPeriod}-${x.teamAbbrev && (x.teamAbbrev.default || x.teamAbbrev)}`,
    ours: (x.teamAbbrev && (x.teamAbbrev.default || x.teamAbbrev)) === team,
    who: nm(x.name) || [nm(x.firstName), nm(x.lastName)].filter(Boolean).join(' '),
    period: x.period ?? (x.periodDescriptor || {}).number ?? null, time: x.timeInPeriod || null, strength: x.strength || null,
  }));
  return { id: g.id, state: stateOf(g), start: g.startTimeUTC || null, home, us, them,
    period: g.period ?? pd.number ?? null, periodType: pd.periodType || null, clock: clock.timeRemaining || null,
    intermission: !!clock.inIntermission, goals };
}
function nextFrom(week, team, after) {
  const g = (week.games || []).filter(x => stateOf(x) === 'fut' && Date.parse(x.startTimeUTC) > after).sort((a, b) => Date.parse(a.startTimeUTC) - Date.parse(b.startTimeUTC))[0];
  if (!g) return null;
  const home = g.homeTeam && g.homeTeam.abbrev === team, them = side(home ? g.awayTeam : g.homeTeam);
  return { id: g.id, start: g.startTimeUTC, home, them };
}

// { team, game (today's, or null), next (the next one not yet started), poll (seconds until worth asking again) }
async function now(team = 'TOR') {
  team = String(team || 'TOR').toUpperCase();
  if (!TEAM_RE.test(team)) throw Object.assign(new Error('Bad team'), { status: 400 });
  const c = cache.get(team);
  const live = c && c.v.game && (c.v.game.state === 'live' || c.v.game.state === 'pre');
  const keep = process.env.NHL_CACHE_MS != null ? +process.env.NHL_CACHE_MS : live ? 15e3 : 10 * 60e3;
  if (c && Date.now() - c.at < keep) return c.v;
  const today = await getJson('/v1/score/now');
  const g = (today.games || []).find(x => (x.homeTeam && x.homeTeam.abbrev === team) || (x.awayTeam && x.awayTeam.abbrev === team));
  const game = g ? shape(g, team) : null;
  let next = null;
  if (!game || game.state === 'final') { try { next = nextFrom(await getJson(`/v1/club-schedule/${team}/week/now`), team, Date.now()); } catch {} }
  const on = game && (game.state === 'live' || game.state === 'pre');
  const soon = game && game.state === 'fut' && Date.parse(game.start) - Date.now() < 30 * 60e3;
  const v = { team, game, next, poll: on || soon ? 20 : 600, at: new Date().toISOString() };
  cache.set(team, { at: Date.now(), v });
  return v;
}

module.exports = { now, shape, nextFrom, stateOf };
