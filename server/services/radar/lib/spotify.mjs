// Keeps a "Music Radar" Spotify playlist filled with the week's picks.
// One-time setup: create an app at developer.spotify.com, add redirect URI
//   <your Cadence address>/api/radar/spotify/callback   (Music Radar shows the exact address)
// (Spotify requires the app owner to have Premium for Development Mode apps.)
// set SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in the NAS .env, then click "Connect Spotify" in Music Radar.
import fs from "node:fs";
import path from "node:path";
import { DATA, API, now, DAY } from "./config.mjs";

const TOKENS = path.join(DATA, "spotify.json");
let REDIRECT = `${API}/spotify/callback`;   // Cadence: set from the request when RADAR_URL isn't configured
export const setRedirectBase = (base) => { REDIRECT = `${base}/api/radar/spotify/callback`; };
const SCOPES = "playlist-modify-private playlist-modify-public";
const load = () => { try { return JSON.parse(fs.readFileSync(TOKENS, "utf8")); } catch { return null; } };
const save = (t) => fs.writeFileSync(TOKENS, JSON.stringify(t));

export const hasSpotifyApp = () => !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
export const spotifyConnected = () => !!load()?.refresh_token;

export function authUrl() {
  return "https://accounts.spotify.com/authorize?" + new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID, response_type: "code", redirect_uri: REDIRECT, scope: SCOPES,
  });
}

async function tokenRequest(params) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64") },
    body: new URLSearchParams(params),
  });
  if (!res.ok) throw new Error(`Spotify token ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function handleCallback(code) {
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: REDIRECT });
  save({ ...load(), ...t, expires_at: Date.now() + t.expires_in * 1000 });
}

async function accessToken() {
  const t = load();
  if (!t?.refresh_token) throw new Error("Spotify not connected");
  if (t.expires_at > Date.now() + 60000) return t.access_token;
  const r = await tokenRequest({ grant_type: "refresh_token", refresh_token: t.refresh_token });
  save({ ...t, ...r, expires_at: Date.now() + r.expires_in * 1000 });
  return r.access_token;
}

async function api(method, url, body) {
  const res = await fetch("https://api.spotify.com/v1" + url, {
    method, headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Spotify ${method} ${url.split("?")[0]} → ${res.status}`);
  return res.status === 204 ? {} : res.json();
}

async function findUri(artist, title, type) {
  const q = encodeURIComponent(type === "track" ? `track:${title} artist:${artist}` : `${artist} ${title}`);
  const d = await api("GET", `/search?q=${q}&type=track&limit=1`);
  return d.tracks?.items?.[0]?.uri || null;
}

// Replace the playlist contents with picks from the last `days` days (best first).
export async function updatePlaylist(state, days = 7) {
  if (!spotifyConnected()) return null;
  const t = load();
  if (!t.playlist_id) {
    // Feb 2026 API: playlists are created via /me/playlists, contents via /items
    const pl = await api("POST", "/me/playlists", {
      name: "Music Radar", public: false, description: "Up-and-coming picks from Reddit buzz, refreshed weekly",
    });
    save({ ...load(), playlist_id: pl.id, playlist_url: pl.external_urls?.spotify });
  }
  const picks = state.picks.filter((p) => p.song && now() - p.ts < days * DAY && state.feedback[p.id] !== -1)
    .sort((a, b) => b.score - a.score).slice(0, 50);
  const uris = [];
  for (const p of picks) {
    try { const u = await findUri(p.artist, p.song, p.type); if (u && !uris.includes(u)) uris.push(u); } catch {}
  }
  await api("PUT", `/playlists/${load().playlist_id}/items`, { uris });
  return { count: uris.length, url: load().playlist_url };
}

export const playlistUrl = () => load()?.playlist_url || null;
export const redirectUri = () => REDIRECT;
