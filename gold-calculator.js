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

  function calculateGoldSale(input = {}) {
    const price24k = sanitizeNonNegative(input.price24k);
    const weight = sanitizeNonNegative(input.weight);
    const karat = normalizeKarat(input.karat);
    const deductionRate = clampPercent(input.deductionRate);

    const purity = karat / 24;
    const gramPrice = price24k * purity;
    const rawMetalValue = gramPrice * weight;
    const deductionValue = rawMetalValue * (deductionRate / 100);
    const total = rawMetalValue - deductionValue;

    return {
      price24k,
      weight,
      karat,
      deductionRate,
      purity,
      gramPrice,
      rawMetalValue,
      deductionValue,
      total,
    };
  }

  function calculateTransaction(input = {}) {
    const mode = normalizeMode(input.mode);
    if (mode === 'sell') return { mode, ...calculateGoldSale(input) };
    return { mode, ...calculateGoldPurchase(input) };
  }

  function compareQuote({ mode, referenceTotal, quotedTotal } = {}) {
    const safeMode = normalizeMode(mode);
    const reference = sanitizeNonNegative(referenceTotal);
    const quote = sanitizeNonNegative(quotedTotal);

    if (reference <= 0 || quote <= 0) {
      return {
        available: false,
        difference: 0,
        differencePct: 0,
        status: 'unavailable',
      };
    }

    const difference = quote - reference;
    const differencePct = (difference / reference) * 100;
    const absDifferencePct = Math.abs(differencePct);
    let status;

    if (absDifferencePct <= 2) {
      status = 'close';
    } else if (safeMode === 'sell') {
      if (differencePct < -5) status = 'low';
      else if (differencePct < -2) status = 'moderate_low';
      else status = 'above_reference';
    } else {
      if (differencePct > 5) status = 'high';
      else if (differencePct > 2) status = 'moderate_high';
      else status = 'below_reference';
    }

    return {
      available: true,
      difference,
      differencePct,
      status,
    };
  }

  return {
    OUNCE_GRAMS,
    USD_SAR_RATE,
    SUPPORTED_KARATS,
    sanitizeNonNegative,
    normalizeKarat,
    normalizeMode,
    clampTaxRate,
    clampPercent,
    ounceUsdTo24kSar,
    ounceSarToUsd,
    ounceSarTo24kSar,
    gramSarTo24kSar,
    gramSarToOunceSar,
    gramSarToOunceUsd,
    resolvePrice24k,
    deriveMarketPrices,
    calculateGoldPurchase,
    calculateGoldSale,
    calculateTransaction,
    compareQuote,
  };
});