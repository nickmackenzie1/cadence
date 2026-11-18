/* Cadence sign-in guard: if the session runs out while the app is open, go to the login page and come back.
   Unsaved edits are safe: they're in this browser and sync up after you sign in again. */
(() => {
  if (location.protocol === 'file:') return;
  const real = window.fetch.bind(window);
  let leaving = false;
  // "Someone is using Cadence" for the NAS's background jobs (server/lib/scheduler.js): requests made within a minute
  // of a key, click or touch, or while something is playing, carry X-Cadence-Active. The automatic checks an open
  // tab makes (sync every 20 s and so on) don't, so heavy jobs still run while a tab sits open and nobody's there.
  let lastInput = 0;
  for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, () => { lastInput = Date.now(); }, { capture: true, passive: true });
  const playing = () => { try { return [...document.querySelectorAll('audio,video')].some(a => !a.paused); } catch (e) { return false; } };
  const active = () => !document.hidden && (Date.now() - lastInput < 60e3 || playing());
  window.fetch = async (input, init) => {
    const url0 = typeof input === 'string' ? input : (input && input.url) || '';
    if (/(^|\/)api\//.test(url0) && active()) try {
      if (new URL(url0, location.href).origin === location.origin) {
        const h = new Headers((init && init.headers) || (input instanceof Request ? input.headers : undefined)); h.set('X-Cadence-Active', '1');
        init = { ...(init || {}), headers: h };
      }
    } catch (e) {}
    const r = await real(input, init);
    const url = url0;
    if (r.status === 401 && !leaving && /(^|\/)api\//.test(url) && !/api\/(login|logout|whoami)/.test(url)) {
      const abs = new URL(url, location.href);
      if (abs.origin === location.origin) {
        leaving = true;
        const back = location.pathname + location.search + location.hash;
        location.replace('login?next=' + encodeURIComponent(back));
      }
    }
    return r;
  };
  window.CadenceAuth = {
    async signOut() { try { await real('api/logout', { method: 'POST' }); } catch (e) {}
      try { const r = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); r && r.active && r.active.postMessage('cadence-clear-shell'); } catch (e) {}   // drop the offline copy too
      location.replace('login'); },
  };
})();
