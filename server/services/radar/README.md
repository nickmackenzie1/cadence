# 📡 Music Radar

Scans music subreddits for up-and-coming artists, songs and albums, tracks what's rising,
and gives you an RSS feed, a dashboard, phone alerts, a weekly digest and a Spotify playlist.

## Quick start

```bash
npm install            # optional: local chart libraries so the dashboard works offline
node radar.mjs         # one scan (takes a few minutes; be patient with Reddit's rate limits)
node server.mjs        # dashboard → http://127.0.0.1:8787   feed → http://127.0.0.1:8787/feed.xml
```

Needs Node 18+. Everything is stored in the `data/` folder.

## Commands

| Command | What it does | How often |
|---|---|---|
| `node radar.mjs` | Scan subreddits, read comments, score, add new picks to the feed, send spike alerts | Every 4–6 hours |
| `node digest.mjs` | Weekly digest, subreddit suggestions, track-record check, Spotify playlist refresh | Weekly |
| `node backfill.mjs` | Pull years of old posts from the Reddit archive for "Over the years" | Once (resumable) |
| `node server.mjs` | Dashboard, feed, 👍/👎 buttons, Spotify connect | Leave running |

Backfill options: `--subs listentothis,indieheads --from 2015 --samples 3 --ai`

## Scheduling

**Mac/Linux** (`crontab -e`):
```
0 */6 * * *  cd /path/to/music-radar && node radar.mjs >> data/radar.log 2>&1
30 9 * * 0   cd /path/to/music-radar && node digest.mjs >> data/radar.log 2>&1
```
**Windows**: Task Scheduler → Create Basic Task → program `node`, arguments `radar.mjs`, start in the folder.

Keep `node server.mjs` running (or start it at login) so the 👍/👎 links in the feed work.

## Optional keys (set as environment variables)

Everything works without them; each one unlocks more.

| Variable | Unlocks | Get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude reads posts + comments: better artist/genre extraction, "sounds like" pairs, scene names, comment mood, artists recommended in comments, nicer blurbs and digest | console.anthropic.com |
| `LASTFM_API_KEY` | Real listener counts (small-but-buzzing gets boosted, huge acts dropped), track record | last.fm/api/account/create |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | More reliable Reddit access (anonymous access often gets blocked) | reddit.com/prefs/apps → "script" app |
| `NTFY_TOPIC` | Phone alerts when an artist spikes, plus the weekly digest | Install the ntfy app, subscribe to a hard-to-guess topic name |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Auto-updated "Music Radar" playlist | developer.spotify.com → create app, redirect URI `http://127.0.0.1:8787/spotify/callback`, then click "Connect Spotify" on the dashboard. Spotify requires the app owner to have Premium. |

Other settings: `RADAR_MODEL` (default `claude-haiku-5-5`), `PORT`, `RADAR_URL`, `RADAR_ALERT_MIN` (spike alert threshold), `RADAR_DATA` (data folder).

## How scoring works

For each artist in the last 72 hours:
- **Heat**: upvotes and comments, decayed by age, plus upvote velocity. Posts from subreddits that usually find artists first count more.
- **Spread**: mentioned in several subreddits gives a big boost. Artists recommended in comments count as weaker mentions.
- **Fresh** releases get +20%. **Comment mood**: backlash sinks a pick, love lifts it.
- **Size** (with Last.fm): under 20k listeners ×1.5 … over 5M dropped.
- **Your taste**: genres and subs you 👍 get up to ×1.8, 👎 down to ×0.5; artists people compare to ones you liked get ×1.3.

## Test it without Reddit

```bash
RADAR_DATA=/tmp/radar-sim node test/simulate.mjs
RADAR_DATA=/tmp/radar-sim node server.mjs
```
This fakes two weeks of runs plus ten years of archive data so you can see every chart filled in.

On Windows PowerShell, set variables like this instead: `$env:RADAR_DATA="C:\temp\radar-sim"; node test/simulate.mjs`
(and the same way for API keys, e.g. `$env:ANTHROPIC_API_KEY="sk-..."`).
