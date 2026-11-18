'use strict';
/* Live sync (user, 2026-11-17): GET /api/events is a Server-Sent Events stream. When a device saves changes
   (POST /api/sync, an older tab's PUT /api/state, synced settings in PUT /api/prefs), every open stream hears
   { kind, cursor, tab } and pulls at once, so a task added on the phone shows on the desktop within a second instead
   of at the next 20-second check. The message carries no data, only "something changed": each device still pulls
   through the normal signed-in sync. `tab` is the sending tab's id, so it can ignore its own echo.
   In the browser, one tab per browser holds the stream and passes messages to the others (core.js Live), because
   browsers allow only six connections to one server over HTTP/1.1. A comment line every 25 s keeps it open. */
const clients = new Set();
const MAX = 64;
function subscribe(req, res) {
  if (clients.size >= MAX) { const oldest = clients.values().next().value; try { oldest.end(); } catch {} clients.delete(oldest); }
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', 'X-Content-Type-Options': 'nosniff' });
  res.write('retry: 3000\n\n');
  clients.add(res);
  const drop = () => clients.delete(res);
  req.on('close', drop); res.on('error', drop);
}
function broadcast(msg) {
  const line = `data: ${JSON.stringify({ at: Date.now(), ...msg })}\n\n`;
  for (const res of clients) { try { res.write(line); } catch { clients.delete(res); } }
}
const ping = setInterval(() => { for (const res of clients) { try { res.write(': ping\n\n'); } catch { clients.delete(res); } } }, 25e3);
ping.unref();
const count = () => clients.size;
module.exports = { subscribe, broadcast, count };
