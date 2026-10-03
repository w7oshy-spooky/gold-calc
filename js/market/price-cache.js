(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldPriceCache = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const LIVE_CACHE_KEY = 'gold-calc-live-quote-v1';
  const LIVE_CACHE_MAX_AGE_MS = 15 * 60 * 1000;

  function createPriceCache({
    storage = root.localStorage,
    now = () => Date.now(),
    maxAgeMs = LIVE_CACHE_MAX_AGE_MS,
  } = {}) {
    function readCachedQuote() {
      try {
        if (!storage) return null;
        const cached = JSON.parse(storage.getItem(LIVE_CACHE_KEY) || 'null');
        if (!cached?.quote || !Number.isFinite(cached.storedAt)) return null;
        if (now() - cached.storedAt > maxAgeMs) return null;
        const price = Number(cached.quote.priceUsdOunce);
        if (!Number.isFinite(price) || price <= 0) return null;
        return cached.quote;
      } catch {
        return null;
      }
    }

    function writeCachedQuote(quote) {
      try {
        if (!storage) return;
        storage.setItem(LIVE_CACHE_KEY, JSON.stringify({ quote, storedAt: now() }));
      } catch {}
    }

    function clearCachedQuote() {
      try {
        if (!storage) return;
        storage.removeItem(LIVE_CACHE_KEY);
      } catch {}
    }

    return { readCachedQuote, writeCachedQuote, clearCachedQuote };
  }

  return {
    LIVE_CACHE_KEY,
    LIVE_CACHE_MAX_AGE_MS,
    createPriceCache,
  };
});
