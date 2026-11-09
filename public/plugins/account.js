/* Account: sign out (only when a password is set on the NAS) */
Cadence.registerPlugin({
  id: 'account', name: 'Account', version: '1.0.0', category: 'System',
  description: 'Sign out of Cadence on this device. Appears when login is turned on (APP_PASSWORD on the NAS).',
  tagline: 'Sign out of this device', color: '#4b4b5a',
  icon: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l5-5-5-5"/><path d="M15 12H4"/>',
  setup(api) {
    // registered always (health arrives after setup); checks login state when run
    api.commands.add({ title: 'Sign out', hint: 'This device', run: api => {
      const h = api.system().health;
      if (!h || !h.auth) return api.ui.toast('Login is off. Set APP_PASSWORD on the NAS to turn it on.');
      window.CadenceAuth && window.CadenceAuth.signOut();
    } });
  }
});
