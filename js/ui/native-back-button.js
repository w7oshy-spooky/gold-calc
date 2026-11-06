(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldNativeBackButton = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Android's back button should behave like a normal app: close the open dialog first,
  // then return to the main tab, and only then leave the app.
  function handleBack({ document, navigation, exitApp }) {
    const openModals = Array.from(document.querySelectorAll('.vault-modal-backdrop:not([hidden])'));
    if (openModals.length) {
      openModals[openModals.length - 1].hidden = true;
      return 'modal';
    }
    if (navigation && navigation.getActiveTab() !== navigation.DEFAULT_TAB) {
      navigation.setActiveTab(navigation.DEFAULT_TAB);
      return 'tab';
    }
    exitApp();
    return 'exit';
  }

  function setupBackButton({
    document = typeof globalThis !== 'undefined' ? globalThis.document : null,
    navigation = null,
    capacitor = typeof globalThis !== 'undefined' ? globalThis.Capacitor : null,
  } = {}) {
    const isNative = capacitor && typeof capacitor.isNativePlatform === 'function' && capacitor.isNativePlatform();
    const appPlugin = isNative && capacitor.Plugins && capacitor.Plugins.App;
    if (!document || !appPlugin || typeof appPlugin.addListener !== 'function') return false;
    appPlugin.addListener('backButton', () => {
      handleBack({ document, navigation, exitApp: () => appPlugin.exitApp() });
    });
    return true;
  }

  return { handleBack, setupBackButton };
});
