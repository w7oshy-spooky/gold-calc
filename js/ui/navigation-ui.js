(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldNavigationUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VALID_TABS = ['market', 'auditor', 'calc', 'vault', 'all'];
  const DEFAULT_TAB = 'market';
  const STORAGE_KEY = 'gold_active_tab';

  function createNavigationUI({
    document = (typeof globalThis !== 'undefined' ? globalThis.document : null),
    window = (typeof globalThis !== 'undefined' ? globalThis.window : null),
    preferencesStore = null,
    vibrate = () => {},
    onChange = () => {},
  } = {}) {
    if (!document) throw new Error('Document is required for NavigationUI');

    const mainElement = document.querySelector('main.desktop-dashboard') || document.querySelector('main');
    const navButtons = Array.from(document.querySelectorAll('[data-tab-target]'));

    let currentTab = DEFAULT_TAB;

    function getStoredTab() {
      try {
        if (preferencesStore && typeof preferencesStore.get === 'function') {
          const val = preferencesStore.get(STORAGE_KEY);
          if (VALID_TABS.includes(val)) return val;
        }
        if (window?.localStorage) {
          const val = window.localStorage.getItem(STORAGE_KEY);
          if (VALID_TABS.includes(val)) return val;
        }
      } catch {
        // Fall back to default
      }
      return DEFAULT_TAB;
    }

    function setActiveTab(tabId, { persist = true } = {}) {
      const target = VALID_TABS.includes(tabId) ? tabId : DEFAULT_TAB;
      currentTab = target;

      if (mainElement) {
        mainElement.setAttribute('data-active-tab', target);
      }

      navButtons.forEach((btn) => {
        const isSelected = btn.dataset.tabTarget === target;
        btn.classList.toggle('active', isSelected);
        btn.setAttribute('aria-selected', String(isSelected));
      });

      if (persist) {
        try {
          if (preferencesStore && typeof preferencesStore.set === 'function') {
            preferencesStore.set(STORAGE_KEY, target);
          }
          if (window?.localStorage) {
            window.localStorage.setItem(STORAGE_KEY, target);
          }
        } catch {
          // Ignore storage errors
        }
      }

      if (typeof vibrate === 'function') vibrate();
      if (typeof onChange === 'function') onChange(target);

      // Scroll smoothly to top of main when switching tabs on mobile
      if (window && typeof window.scrollTo === 'function') {
        const isMobile = window.innerWidth < 1100;
        if (isMobile) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }

      return target;
    }

    navButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tabTarget;
        if (target) setActiveTab(target);
      });
    });

    // Initialize with stored or default tab
    const initialTab = getStoredTab();
    setActiveTab(initialTab, { persist: false });

    return {
      VALID_TABS,
      DEFAULT_TAB,
      STORAGE_KEY,
      getActiveTab: () => currentTab,
      setActiveTab,
    };
  }

  return {
    VALID_TABS,
    DEFAULT_TAB,
    STORAGE_KEY,
    createNavigationUI,
  };
});
