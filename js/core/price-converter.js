(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldPriceConverter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const OUNCE_GRAMS = 31.1034768;
  const USD_SAR_RATE = 3.75;
  const SUPPORTED_KARATS = Object.freeze([18, 21, 22, 24]);

  function sanitizeNonNegative(value) {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  function normalizeKarat(value) {
    const n = Number.parseFloat(value);
    return SUPPORTED_KARATS.includes(n) ? n : 21;
  }

  function ounceUsdTo24kSar(ouncePriceUsd) {
    const price = sanitizeNonNegative(ouncePriceUsd);
    if (price <= 0) return 0;
    return (price / OUNCE_GRAMS) * USD_SAR_RATE;
  }

  function ounceSarToUsd(ouncePriceSar) {
    const price = sanitizeNonNegative(ouncePriceSar);
    if (price <= 0) return 0;
    return price / USD_SAR_RATE;
  }

  function ounceSarTo24kSar(ouncePriceSar) {
    const price = sanitizeNonNegative(ouncePriceSar);
    if (price <= 0) return 0;
    return price / OUNCE_GRAMS;
  }

  function gramSarTo24kSar(gramPriceSar, karat) {
    const price = sanitizeNonNegative(gramPriceSar);
    if (price <= 0) return 0;
    const normalizedKarat = normalizeKarat(karat);
    return price * (24 / normalizedKarat);
  }

  function gramSarToOunceSar(gramPriceSar, karat) {
    const price24k = gramSarTo24kSar(gramPriceSar, karat);
    if (price24k <= 0) return 0;
    return price24k * OUNCE_GRAMS;
  }

  function gramSarToOunceUsd(gramPriceSar, karat) {
    const ounceSar = gramSarToOunceSar(gramPriceSar, karat);
    if (ounceSar <= 0) return 0;
    return ounceSar / USD_SAR_RATE;
  }

  function resolvePrice24k({
    source,
    ouncePriceUsd,
    ouncePriceSar,
    gramPriceSar,
    gramKarat,
    manualPrice24k,
  } = {}) {
    if (source === 'live' || source === 'ounce' || source === 'ounce-usd') {
      return ounceUsdTo24kSar(ouncePriceUsd);
    }
    if (source === 'ounce-sar') return ounceSarTo24kSar(ouncePriceSar);
    if (source === 'gram-sar') return gramSarTo24kSar(gramPriceSar, gramKarat);
    if (source === 'manual') return sanitizeNonNegative(manualPrice24k);
    return 0;
  }

  function deriveMarketPrices(input = {}) {
    const gram24kSar = resolvePrice24k(input);
    if (gram24kSar <= 0) {
      return {
        ounceUsd: 0,
        ounceSar: 0,
        gram24kSar: 0,
        gram22kSar: 0,
        gram21kSar: 0,
        gram18kSar: 0,
      };
    }

    const ounceSar = gram24kSar * OUNCE_GRAMS;
    return {
      ounceUsd: ounceSar / USD_SAR_RATE,
      ounceSar,
      gram24kSar,
      gram22kSar: gram24kSar * (22 / 24),
      gram21kSar: gram24kSar * (21 / 24),
      gram18kSar: gram24kSar * (18 / 24),
    };
  }

  return {
    OUNCE_GRAMS,
    USD_SAR_RATE,
    SUPPORTED_KARATS,
    sanitizeNonNegative,
    normalizeKarat,
    ounceUsdTo24kSar,
    ounceSarToUsd,
    ounceSarTo24kSar,
    gramSarTo24kSar,
    gramSarToOunceSar,
    gramSarToOunceUsd,
    resolvePrice24k,
    deriveMarketPrices,
  };
});
