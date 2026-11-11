(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldLivePriceClient = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const LIVE_REQUEST_TIMEOUT_MS = 8000;

  function resolveApiBaseUrl({ apiBaseUrl = '', rootRef = root } = {}) {
    if (typeof apiBaseUrl === 'string' && apiBaseUrl) {
      return apiBaseUrl.replace(/\/+$/, '');
    }
    if (typeof rootRef.GOLD_CALC_API_BASE === 'string' && rootRef.GOLD_CALC_API_BASE) {
      return rootRef.GOLD_CALC_API_BASE.replace(/\/+$/, '');
    }
    // Node.js test environment has no window.location
    if (!rootRef || !rootRef.location || typeof rootRef.location !== 'object') {
      return '';
    }
    // When hosted on the Vercel backend itself, use relative /api/gold-price
    if (rootRef.location.hostname === 'gold-calc-live.vercel.app') {
      return '';
    }
    // In Capacitor, mobile APK, localhost dev, or any external static host,
    // call the live Vercel backend directly.
    return 'https://gold-calc-live.vercel.app';
  }

  function createLivePriceClient({
    fetchImpl = typeof root.fetch === 'function' ? root.fetch.bind(root) : null,
    AbortControllerImpl = typeof root.AbortController === 'function' ? root.AbortController : null,
    setTimeoutImpl = root.setTimeout ? root.setTimeout.bind(root) : setTimeout,
    clearTimeoutImpl = root.clearTimeout ? root.clearTimeout.bind(root) : clearTimeout,
    now = () => Date.now(),
    apiBaseUrl,
  } = {}) {
    const baseUrl = resolveApiBaseUrl({ apiBaseUrl, rootRef: root });

    async function fetchQuote({ force = false } = {}) {
      if (typeof fetchImpl !== 'function') throw new Error('Live price fetch is unavailable.');

      const controller = AbortControllerImpl ? new AbortControllerImpl() : null;
      const timeoutId = controller
        ? setTimeoutImpl(() => controller.abort(), LIVE_REQUEST_TIMEOUT_MS)
        : null;

      try {
        const path = force ? `/api/gold-price?refresh=${now()}` : '/api/gold-price';
        const url = `${baseUrl}${path}`;
        const response = await fetchImpl(url, {
          headers: { accept: 'application/json' },
          cache: 'no-store',
          ...(controller ? { signal: controller.signal } : {}),
        });

        if (!response.ok) throw new Error(`Live price HTTP ${response.status}`);

        const quote = await response.json();
        const price = Number(quote.priceUsdOunce);
        if (!Number.isFinite(price) || price <= 0) throw new Error('Invalid live quote');
        if (Number.isNaN(new Date(quote.updatedAt).getTime())) throw new Error('Invalid live timestamp');

        return quote;
      } finally {
        if (timeoutId !== null) clearTimeoutImpl(timeoutId);
      }
    }

    return { fetchQuote, resolveApiBaseUrl: () => baseUrl };
  }

  return { LIVE_REQUEST_TIMEOUT_MS, createLivePriceClient, resolveApiBaseUrl };
});
