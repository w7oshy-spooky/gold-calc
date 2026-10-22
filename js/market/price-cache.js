(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldPriceCache = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const LIVE_CACHE_KEY = 'gold-calc-live-quote-v1';
  const LIVE_CACHE_MAX_AGE_MS = 15 * 60 * 1000;
  // Older quotes are only offered as a clearly dated manual starting point when offline.
  const LAST_KNOWN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

  function getDefaultStorage() {
    try {
      return root.localStorage || null;
    } catch {
      return null;
    }
  }

  function createPriceCache({
    storage,
    now = () => Date.now(),
    maxAgeMs = LIVE_CACHE_MAX_AGE_MS,
  } = {}) {
    const cacheStorage = storage === undefined ? getDefaultStorage() : storage;

    function readEntry(entryMaxAgeMs) {
      try {
        if (!cacheStorage) return null;
        const cached = JSON.parse(cacheStorage.getItem(LIVE_CACHE_KEY) || 'null');
        if (!cached?.quote || !Number.isFinite(cached.storedAt)) return null;
        if (now() - cached.storedAt > entryMaxAgeMs) return null;
        const price = Number(cached.quote.priceUsdOunce);
        if (!Number.isFinite(price) || price <= 0) return null;
        return cached;
      } catch {
        return null;
      }
    }

    function readCachedQuote() {
      return readEntry(maxAgeMs)?.quote || null;
    }

    function readLastKnownQuote() {
      return readEntry(LAST_KNOWN_MAX_AGE_MS)?.quote || null;
    }

    function writeCachedQuote(quote) {
      try {
        if (!cacheStorage) return;
        cacheStorage.setItem(LIVE_CACHE_KEY, JSON.stringify({ quote, storedAt: now() }));
      } catch {}
    }

    function clearCachedQuote() {
      try {
        if (!cacheStorage) return;
        cacheStorage.removeItem(LIVE_CACHE_KEY);
      } catch {}
    }

    return { readCachedQuote, readLastKnownQuote, writeCachedQuote, clearCachedQuote };
  }

  return {
    LIVE_CACHE_KEY,
    LIVE_CACHE_MAX_AGE_MS,
    LAST_KNOWN_MAX_AGE_MS,
    createPriceCache,
  };
});
