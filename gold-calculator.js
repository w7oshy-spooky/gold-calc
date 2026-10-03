(function (root, factory) {
  const converter = typeof module === 'object' && module.exports
    ? require('./js/core/price-converter.js')
    : root.GoldPriceConverter;
  const api = factory(converter);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldCalculator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (converter) {
  'use strict';

  if (!converter) throw new Error('GoldPriceConverter is required.');

  const { sanitizeNonNegative, normalizeKarat } = converter;

  function normalizeMode(value) {
    return value === 'sell' ? 'sell' : 'buy';
  }

  function clampTaxRate(value) {
    const n = sanitizeNonNegative(value);
    return Math.min(25, n);
  }

  function clampPercent(value) {
    const n = sanitizeNonNegative(value);
    return Math.min(100, n);
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
    normalizeMode,
    clampTaxRate,
    clampPercent,
    calculateGoldPurchase,
    calculateGoldSale,
    calculateTransaction,
    compareQuote,
  };
});
