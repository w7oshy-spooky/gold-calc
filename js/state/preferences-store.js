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
  const INVOICE_FIELDS = Object.freeze([
    'weight',
    'workmanshipPerGram',
    'profitPerGram',
    'taxRate',
    'deductionRate',
  ]);
  const MAX_INVOICE_ITEMS = 50;

  function getDefaultStorage() {
    try {
      return root.localStorage || null;
    } catch {
      return null;
    }
  }

  function sanitizeNumber(value, limit) {
    if (value === undefined || value === null || value === '') return undefined;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return undefined;
    return limit === undefined ? n : Math.min(limit, n);
  }

  function sanitizeInvoiceItem(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const karat = Number(raw.karat);
    const weight = sanitizeNumber(raw.weight);
    if (!KARATS.includes(karat) || !(weight > 0)) return null;

    const item = { mode: raw.mode === 'sell' ? 'sell' : 'buy', karat };
    for (const field of INVOICE_FIELDS) {
      const value = sanitizeNumber(raw[field], NUMERIC_LIMITS[field]);
      item[field] = value === undefined ? 0 : value;
    }
    return item;
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
      const value = sanitizeNumber(raw[field], NUMERIC_LIMITS[field]);
      if (value !== undefined) prefs[field] = value;
    }

    if (Array.isArray(raw.invoice)) {
      const invoice = raw.invoice.map(sanitizeInvoiceItem).filter(Boolean).slice(0, MAX_INVOICE_ITEMS);
      if (invoice.length > 0) prefs.invoice = invoice;
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

  return {
    PREFERENCES_KEY,
    MAX_INVOICE_ITEMS,
    sanitizeInvoiceItem,
    sanitizePreferences,
    createPreferencesStore,
  };
});
