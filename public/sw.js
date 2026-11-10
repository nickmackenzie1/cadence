/* Cadence service worker: shows push notifications (reminders, plugin notices) even with no Cadence tab open,
   and opens Cadence when you click one. No caching: the app always loads fresh from the NAS. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (er) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Cadence', { body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag, icon: 'favicon.svg', badge: 'favicon.svg', data: { url: d.url || '/' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) if (new URL(c.url).origin === self.location.origin) { await c.focus(); try { c.postMessage({ type: 'cadence-open', url }); } catch (er) {} return; }
    await self.clients.openWindow(url);
  })());
});
