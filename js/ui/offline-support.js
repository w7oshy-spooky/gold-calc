(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldOfflineSupport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // The website registers the service worker so it works offline.
  // The Capacitor app already ships every file inside the app, so a service worker there only
  // risks serving stale copies; remove any left over from an earlier version instead.
  async function registerOfflineSupport({
    navigatorRef = typeof navigator !== 'undefined' ? navigator : null,
    capacitor = typeof globalThis !== 'undefined' ? globalThis.Capacitor : null,
  } = {}) {
    const serviceWorker = navigatorRef && navigatorRef.serviceWorker;
    if (!serviceWorker) return 'unsupported';

    try {
      if (capacitor && typeof capacitor.isNativePlatform === 'function' && capacitor.isNativePlatform()) {
        const registrations = await serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
        return 'native';
      }
      await serviceWorker.register('sw.js');
      return 'registered';
    } catch (_error) {
      return 'failed';
    }
  }

  return { registerOfflineSupport };
});
