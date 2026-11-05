(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldThemeUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'gold_theme';
  const THEME_LIGHT = 'light';
  const THEME_DARK = 'dark';

  function createThemeUI({
    document = (typeof globalThis !== 'undefined' ? globalThis.document : null),
    window = (typeof globalThis !== 'undefined' ? globalThis.window : null),
    preferencesStore = null,
    vibrate = () => {},
    onChange = () => {},
  } = {}) {
    if (!document) throw new Error('Document is required for ThemeUI');

    const toggleButton = document.getElementById('themeToggle');
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    const isArabic = (document.documentElement?.getAttribute && document.documentElement.getAttribute('lang') === 'ar') || document.documentElement?.lang === 'ar';

    function getSystemTheme() {
      try {
        if (window && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
          return THEME_LIGHT;
        }
      } catch {}
      return THEME_DARK;
    }

    function getStoredTheme() {
      try {
        if (window?.localStorage) {
          const val = window.localStorage.getItem(STORAGE_KEY);
          if (val === THEME_LIGHT || val === THEME_DARK) return val;
        }
        if (preferencesStore && typeof preferencesStore.read === 'function') {
          const prefs = preferencesStore.read();
          if (prefs.theme === THEME_LIGHT || prefs.theme === THEME_DARK) return prefs.theme;
        }
      } catch {}
      return getSystemTheme();
    }

    function applyTheme(theme, { persist = true } = {}) {
      const activeTheme = theme === THEME_LIGHT ? THEME_LIGHT : THEME_DARK;
      const rootElem = document.documentElement;
      if (rootElem) {
        rootElem.setAttribute('data-theme', activeTheme);
      }

      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', activeTheme === THEME_LIGHT ? '#f7f6f2' : '#0d0f12');
      }

      if (toggleButton) {
        const isLight = activeTheme === THEME_LIGHT;
        toggleButton.setAttribute('aria-pressed', String(isLight));
        const labelText = isArabic
          ? (isLight ? 'التبديل إلى الوضع الليلي' : 'التبديل إلى الوضع النهاري')
          : (isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode');
        toggleButton.setAttribute('title', labelText);
        toggleButton.setAttribute('aria-label', labelText);
      }

      if (persist) {
        try {
          if (window?.localStorage) {
            window.localStorage.setItem(STORAGE_KEY, activeTheme);
          }
          if (preferencesStore && typeof preferencesStore.read === 'function' && typeof preferencesStore.write === 'function') {
            const current = preferencesStore.read();
            preferencesStore.write({ ...current, theme: activeTheme });
          }
        } catch {}
      }

      if (typeof onChange === 'function') onChange(activeTheme);
      return activeTheme;
    }

    function toggleTheme() {
      const current = (document.documentElement && document.documentElement.getAttribute('data-theme')) || THEME_DARK;
      const next = current === THEME_LIGHT ? THEME_DARK : THEME_LIGHT;
      if (typeof vibrate === 'function') vibrate();
      return applyTheme(next, { persist: true });
    }

    if (toggleButton) {
      toggleButton.addEventListener('click', toggleTheme);
    }

    try {
      if (window?.matchMedia) {
        const mql = window.matchMedia('(prefers-color-scheme: light)');
        const handleSchemeChange = (e) => {
          const hasManualPreference = window?.localStorage?.getItem(STORAGE_KEY);
          if (!hasManualPreference) {
            applyTheme(e.matches ? THEME_LIGHT : THEME_DARK, { persist: false });
          }
        };
        if (mql.addEventListener) mql.addEventListener('change', handleSchemeChange);
        else if (mql.addListener) mql.addListener(handleSchemeChange);
      }
    } catch {}

    const initial = getStoredTheme();
    applyTheme(initial, { persist: false });

    return {
      THEME_LIGHT,
      THEME_DARK,
      STORAGE_KEY,
      getTheme: () => (document.documentElement && document.documentElement.getAttribute('data-theme')) || THEME_DARK,
      setTheme: (t) => applyTheme(t, { persist: true }),
      toggleTheme,
    };
  }

  return {
    THEME_LIGHT,
    THEME_DARK,
    STORAGE_KEY,
    createThemeUI,
  };
});
