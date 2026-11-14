/* Cadence sign-in guard: if the session runs out while the app is open, go to the login page and come back.
   Unsaved edits are safe: they're in this browser and sync up after you sign in again. */
(() => {
  if (location.protocol === 'file:') return;
  const real = window.fetch.bind(window);
  let leaving = false;
  window.fetch = async (input, init) => {
    const r = await real(input, init);
    const url = typeof input === 'string' ? input : (input && input.url) || '';
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
