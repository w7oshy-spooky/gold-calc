(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldPreferencesStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const PREFERENCES_KEY = 'gold-calc-preferences-v1';
  const SOURCES = Object.freeze(['live', 'ounce-usd', 'ounce-sar', 'gram-sar']);
  const KARATS = Object.freeze([18, 21, 22, 24]);
  const NUMERIC_FIELDS = Object.freeze([
    'weight',
    'workmanshipPerGram',
    'profitPerGram',
    'taxRate',
    'deductionRate',
    'ouncePriceUsd',
    'ouncePriceSar',
    'gramPriceSar',
  ]);
  const NUMERIC_LIMITS = Object.freeze({ taxRate: 25, deductionRate: 100 });

  function getDefaultStorage() {
    try {
      return root.localStorage || null;
    } catch {
      return null;
    }
  }

  // Drops anything that is not a known field with a valid value, so a
  // corrupted or hand-edited entry can never break the calculator.
  function sanitizePreferences(raw) {
    if (!raw || typeof raw !== 'object') return {};
    const prefs = {};

    if (raw.mode === 'buy' || raw.mode === 'sell') prefs.mode = raw.mode;
    if (SOURCES.includes(raw.source)) prefs.source = raw.source;

    for (const field of ['karat', 'gramKarat']) {
      const karat = Number(raw[field]);
      if (KARATS.includes(karat)) prefs[field] = karat;
    }

    for (const field of NUMERIC_FIELDS) {
      if (raw[field] === undefined || raw[field] === null || raw[field] === '') continue;
      const n = Number(raw[field]);
      if (!Number.isFinite(n) || n < 0) continue;
      const limit = NUMERIC_LIMITS[field];
      prefs[field] = limit === undefined ? n : Math.min(limit, n);
    }

    return prefs;
  }

  function createPreferencesStore({ storage } = {}) {
    const prefsStorage = storage === undefined ? getDefaultStorage() : storage;

    function read() {
      try {
        if (!prefsStorage) return {};
        return sanitizePreferences(JSON.parse(prefsStorage.getItem(PREFERENCES_KEY) || 'null'));
      } catch {
        return {};
      }
    }

    function write(preferences) {
      try {
        if (!prefsStorage) return;
        prefsStorage.setItem(PREFERENCES_KEY, JSON.stringify(sanitizePreferences(preferences)));
      } catch {}
    }

    function clear() {
      try {
        if (!prefsStorage) return;
        prefsStorage.removeItem(PREFERENCES_KEY);
      } catch {}
    }

    return { read, write, clear };
  }

  return { PREFERENCES_KEY, sanitizePreferences, createPreferencesStore };
});
