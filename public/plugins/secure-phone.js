/* Secure address on the phone (2026-11-24, from the app review): iPhones only run the offline app (service worker),
   notifications and motion (Tilt) on a secure (https) address. A phone opening THING on plain http gets a calm note,
   at most once a day, and a short guide: download THING's certificate (served by the NAS at ca.crt), trust it in
   Settings, then open the https address. If the NAS isn't serving https yet, it says so and where to look.
   Also in the palette: "Set up the secure address on this phone". */
(() => {
  const phone = () => matchMedia('(hover: none) and (pointer: coarse)').matches;
  const KEY = 'cadence.secureNote';
  async function health() { try { return await (await fetch('api/health', { cache: 'no-store' })).json(); } catch { return {}; } }
  async function guide(api) {
    const h = await health(), host = location.hostname, port = h.httpsPort || 8443, url = `https://${host}${port === 443 ? '' : ':' + port}/`;
    const steps = h.httpsReady ? `
      <ol class="sp-steps">
        <li><b>Download THING's certificate.</b> <a class="btn" href="ca.crt" download>Download certificate</a><br><span class="muted">Safari asks to allow a configuration profile: choose Allow.</span></li>
        <li><b>Install it.</b> Open the Settings app: "Profile Downloaded" is near the top. Tap it, then Install.</li>
        <li><b>Trust it.</b> Settings → General → About → Certificate Trust Settings, and turn on THING's certificate.</li>
        <li><b>Open the secure address.</b> <a class="btn pri" href="${url}">Open ${host}:${port}</a><br><span class="muted">If THING is on your Home Screen, add it again from there (Share → Add to Home Screen) and remove the old icon. Your tasks come back from the NAS.</span></li>
      </ol>` : `
      <p>The NAS isn't serving THING's secure address yet. The deploy task sets it up by itself (tls.sh makes a certificate in certs/ on the NAS).</p>
      <p class="muted">On the NAS, look in deploy.log for lines starting "tls:". They say what went wrong, for example the NAS's processor or a missing download. Once it works, http opens the secure address on its own.</p>`;
    api.ui.modal('Set up this phone', `<style>.sp-steps{padding-left:18px;display:grid;gap:12px;margin:8px 0}.sp-steps .btn{margin-top:6px;display:inline-block}</style>
      <p>This phone is using THING's plain address (http). On an iPhone, the offline app (edit away from home, sync when you're back), notifications and Tilt only work on the secure address (https).</p>${steps}`);
  }
  Cadence.registerPlugin({
    id: 'secure-phone', name: 'Secure address on phones', version: '1.0.0', category: 'System', spaces: ['work', 'life'],
    description: "On a phone using THING's plain (http) address, explains how to switch to the secure one, so offline use, notifications and Tilt work.",
    setup(api) {
      api.commands.add({ title: 'Set up the secure address on this phone', icon: 'shield', run: api => guide(api) });
      if (!phone() || window.isSecureContext || api.system().demo) return;
      const day = new Date().toISOString().slice(0, 10);
      try { if (localStorage.getItem(KEY) === day) return; localStorage.setItem(KEY, day); } catch {}
      setTimeout(() => {
        const o = { title: 'Use the secure address on this phone', sub: 'For offline use, notifications and Tilt', ms: 9000, actions: [{ label: 'Show me', run: () => guide(api) }] };
        if (window.CadenceIsland) window.CadenceIsland.show(o); else api.ui.toast(o.title);
      }, 12000);
    }
  });
})();
