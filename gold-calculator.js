(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldCalculator = api;
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

  function clampTaxRate(value) {
    const n = sanitizeNonNegative(value);
    return Math.min(25, n);
  }

  function ounceUsdTo24kSar(ouncePriceUsd) {
    const price = sanitizeNonNegative(ouncePriceUsd);
    if (price <= 0) return 0;
    return (price / OUNCE_GRAMS) * USD_SAR_RATE;
  }

  function resolvePrice24k({ source, ouncePriceUsd, manualPrice24k } = {}) {
    if (source === 'ounce') return ounceUsdTo24kSar(ouncePriceUsd);
    if (source === 'manual') return sanitizeNonNegative(manualPrice24k);
    return 0;
  }

  function calculateGoldPurchase(input = {}) {
    const price24k = sanitizeNonNegative(input.price24k);
    const weight = sanitizeNonNegative(input.weight);
    const karat = normalizeKarat(input.karat);
    const workmanshipPerGram = sanitizeNonNegative(input.workmanshipPerGram);
    const profitPerGram = sanitizeNonNegative(input.profitPerGram);
    const taxRate = clampTaxRate(input.taxRate);

    const purity = karat / 24;
    const gramPrice = price24k * purity;
    const goldCost = gramPrice * weight;
    const laborCost = (workmanshipPerGram + profitPerGram) * weight;
    const subtotal = goldCost + laborCost;
    const vat = subtotal * (taxRate / 100);
    const total = subtotal + vat;

    return {
      price24k,
      weight,
      karat,
      workmanshipPerGram,
      profitPerGram,
      taxRate,
      purity,
      gramPrice,
      goldCost,
      laborCost,
      subtotal,
      vat,
      total,
    };
  }

  return {
    OUNCE_GRAMS,
    USD_SAR_RATE,
    SUPPORTED_KARATS,
    sanitizeNonNegative,
    normalizeKarat,
    clampTaxRate,
    ounceUsdTo24kSar,
    resolvePrice24k,
    calculateGoldPurchase,
  };
});