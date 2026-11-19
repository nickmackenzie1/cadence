/* Cadence service worker.
   1. Push notifications (reminders, plugin notices) even with no THING tab open; clicking one opens Cadence.
   2. Offline app shell (2026-11-13): a copy of the app itself (the page, bundle.js, styles, icons, fonts, vendor files)
      so THING opens when the NAS can't be reached, from the data this browser already keeps; it syncs when you're
      back. Your data is never cached here, and /api/* always goes to the network.
      - the page: network first, the saved copy only when the network fails (a sign-in redirect is passed through and
        never saved)
      - bundle.js?v=<hash>: saved once per version (its URL changes when the code does); old versions are dropped
      - everything else from the app: served from the copy at once, refreshed in the background */
const SHELL = 'cadence-shell-1';   // keep the name: changing it drops every device's offline copy
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('cadence-shell-') && k !== SHELL) await caches.delete(k);
  await self.clients.claim();
})()));

const isPage = req => req.mode === 'navigate';
const okToKeep = res => res && res.ok && res.type === 'basic' && !res.redirected;
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== self.location.origin) return;
  const path = url.pathname.replace(/^.*?(\/api\/)/, '$1');
  if (path.startsWith('/api/') || /\/(login|login\.html|sw\.js)$/.test(url.pathname)) return;   // live only
  if (req.headers.has('range') || /\.(mp3|m4a|aac|ogg|opus|wav|mp4|webm)$/i.test(url.pathname)) return;   // audio/video: let the browser stream it

  if (isPage(req)) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (okToKeep(res) && /text\/html/.test(res.headers.get('content-type') || '')) { const c = await caches.open(SHELL); await c.put('__page', res.clone()); }
        return res;
      } catch (err) {
        const hit = await caches.match('__page');
        return hit || new Response('<!doctype html><meta name=viewport content="width=device-width"><body style="font-family:system-ui;padding:2rem"><h2>Can’t reach THING</h2><p>This device hasn’t saved an offline copy yet. Open THING once while you’re on your home network, then it will open here too.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  if (/\/bundle\.js$/.test(url.pathname)) {
    e.respondWith((async () => {
      const c = await caches.open(SHELL), hit = await c.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (okToKeep(res)) {
          // keep this version's bundles, drop older versions
          const v = url.searchParams.get('v');
          for (const k of await c.keys()) { const u = new URL(k.url); if (/\/bundle\.js$/.test(u.pathname) && u.searchParams.get('v') !== v) await c.delete(k); }
          await c.put(req, res.clone());
        }
        return res;
      } catch (err) {
        // offline and this exact selection wasn't saved: any saved bundle of the same version will do
        for (const k of await c.keys()) { const u = new URL(k.url); if (/\/bundle\.js$/.test(u.pathname) && u.searchParams.get('v') === url.searchParams.get('v') && !u.searchParams.has('only')) return c.match(k); }
        throw err;
      }
    })());
    return;
  }

  // the rest of the app: from the copy at once, refreshed behind the scenes
  e.respondWith((async () => {
    const c = await caches.open(SHELL), hit = await c.match(req);
    if (hit) { e.waitUntil(fetch(req).then(res => okToKeep(res) ? c.put(req, res) : null).catch(() => {})); return hit; }
    // Not saved yet: one download per address however many ask at once, saved before anyone gets it (2026-11-17).
    // Harper's 20 MB engine is asked for by the page and by Harper's worker together; two downloads saving to the same
    // place cut each other off ("WebAssembly compilation aborted"). The first asker gets the response, the rest the copy.
    let p = inflight.get(req.url);
    if (!p) {
      p = fetch(req).then(async res => { if (okToKeep(res)) { try { await c.put(req, res.clone()); } catch (er) {} } return res; }).catch(() => null);
      inflight.set(req.url, p); p.finally(() => inflight.delete(req.url));
      return (await p) || new Response('', { status: 504 });
    }
    await p;
    return (await c.match(req)) || fetch(req).catch(() => new Response('', { status: 504 }));
  })());
});
const inflight = new Map();

// a newer version of this file takes over at once (install → skipWaiting, activate → claim)
self.addEventListener('message', e => { if (e.data === 'cadence-clear-shell') e.waitUntil(caches.delete(SHELL)); });

self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (er) { d = { body: e.data && e.data.text() }; }
  const noEmoji = x => String(x || '').replace(/\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*\s?/gu, '').trim();   // no emoji anywhere (user, 2026-11-18)
  e.waitUntil(self.registration.showNotification(noEmoji(d.title) || 'THING', { body: noEmoji(d.body), tag: d.tag || undefined, renotify: !!d.tag, icon: 'favicon.svg', badge: 'favicon.svg', data: { url: d.url || '/' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) if (new URL(c.url).origin === self.location.origin) { await c.focus(); try { c.postMessage({ type: 'cadence-open', url }); } catch (er) {} return; }
    await self.clients.openWindow(url);
  })());
});
