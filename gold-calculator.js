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

  const COUNTRY_VAT_RATES = Object.freeze({
    sa: 15,
    ae: 5,
    bh: 10,
    om: 5,
    kw: 0,
    qa: 0,
    eg: 14,
  });

  function defaultTaxRateForKarat(karat, baseRate = 15) {
    if (normalizeKarat(karat) === 24) return 0;
    return clampTaxRate(baseRate);
  }

  function calculateGoldPurchase(input = {}) {
    const price24k = sanitizeNonNegative(input.price24k);
    const weight = sanitizeNonNegative(input.weight);
    const karat = normalizeKarat(input.karat);
    const rawWorkmanship = sanitizeNonNegative(input.workmanshipPerGram);
    const rawProfit = sanitizeNonNegative(input.profitPerGram);
    const isLaborInclusive = Boolean(input.workmanshipTaxInclusive || input.laborTaxMode === 'inclusive');

    const resolvedTax = input.taxRate !== undefined && input.taxRate !== null && input.taxRate !== ''
      ? clampTaxRate(input.taxRate)
      : defaultTaxRateForKarat(karat, 15);
    const taxRate = clampTaxRate(resolvedTax);

    const vatFactor = 1 + (taxRate / 100);
    const workmanshipPerGram = isLaborInclusive && taxRate > 0 ? (rawWorkmanship / vatFactor) : rawWorkmanship;
    const profitPerGram = isLaborInclusive && taxRate > 0 ? (rawProfit / vatFactor) : rawProfit;

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
      rawWorkmanshipPerGram: rawWorkmanship,
      rawProfitPerGram: rawProfit,
      laborTaxMode: isLaborInclusive ? 'inclusive' : 'exclusive',
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

  // Prices every invoice line at the same market price. Buy lines add to what the
  // customer pays and sell lines (old gold traded in) are subtracted from it.
  function calculateInvoice({ price24k, items } = {}) {
    const lines = (Array.isArray(items) ? items : []).map((item) =>
      calculateTransaction({ ...item, price24k }),
    );
    let buyTotal = 0;
    let sellTotal = 0;
    let buyWeight = 0;
    let sellWeight = 0;

    for (const line of lines) {
      if (line.mode === 'sell') {
        sellTotal += line.total;
        sellWeight += line.weight;
      } else {
        buyTotal += line.total;
        buyWeight += line.weight;
      }
    }

    return {
      lines,
      count: lines.length,
      buyTotal,
      sellTotal,
      buyWeight,
      sellWeight,
      net: buyTotal - sellTotal,
    };
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

  function auditCounterQuote({ price24k, karat, weight, quotedTotal, taxRate = 15, quoteIncludesVat = true } = {}) {
    const safePrice24k = sanitizeNonNegative(price24k);
    const safeKarat = normalizeKarat(karat);
    const safeWeight = sanitizeNonNegative(weight);
    const safeQuote = sanitizeNonNegative(quotedTotal);
    const safeTaxRate = clampTaxRate(taxRate);

    if (safePrice24k <= 0 || safeWeight <= 0 || safeQuote <= 0) {
      return { available: false, reason: 'insufficient_inputs' };
    }

    const subtotal = quoteIncludesVat ? safeQuote / (1 + safeTaxRate / 100) : safeQuote;
    const vat = quoteIncludesVat ? (safeQuote - subtotal) : (subtotal * (safeTaxRate / 100));
    const grossTotal = quoteIncludesVat ? safeQuote : (subtotal + vat);
    const purity = safeKarat / 24;
    const gramPrice = safePrice24k * purity;
    const rawMetalCost = gramPrice * safeWeight;
    const laborCost = subtotal - rawMetalCost;
    const laborPerGram = safeWeight > 0 ? laborCost / safeWeight : 0;
    const laborPct = subtotal > 0 ? (laborCost / subtotal) * 100 : 0;

    let benchmarkCategory = 'luxury';
    if (laborPerGram < 0) benchmarkCategory = 'below_spot';
    else if (laborPerGram <= 25) benchmarkCategory = 'plain';
    else if (laborPerGram <= 45) benchmarkCategory = 'gulf';
    else if (laborPerGram <= 80) benchmarkCategory = 'italian';

    return {
      available: true,
      price24k: safePrice24k,
      karat: safeKarat,
      weight: safeWeight,
      quotedTotal: grossTotal, quoteIncludesVat,
      taxRate: safeTaxRate,
      purity,
      gramPrice,
      rawMetalCost,
      subtotal,
      vat,
      laborCost,
      laborPerGram,
      laborPct,
      benchmarkCategory,
    };
  }

  function calculateStoneDeduction({
    grossWeight,
    stoneWeight,
    hasStones = false,
    price24k,
    karat,
    workmanshipPerGram = 0,
    profitPerGram = 0,
    taxRate = 15,
  } = {}) {
    const safeGross = sanitizeNonNegative(grossWeight);
    const safeStone = hasStones ? sanitizeNonNegative(stoneWeight) : 0;
    const netGoldWeight = Math.max(0, safeGross - safeStone);
    const safeKarat = normalizeKarat(karat);
    const purity = safeKarat / 24;
    const gramPrice = sanitizeNonNegative(price24k) * purity;
    const laborPerGram = sanitizeNonNegative(workmanshipPerGram) + sanitizeNonNegative(profitPerGram);
    const safeTaxRate = clampTaxRate(taxRate);
    const grossGramRate = (gramPrice + laborPerGram) * (1 + safeTaxRate / 100);

    const stonePremiumPaid = safeStone * grossGramRate;
    const pureGoldTotal = netGoldWeight * grossGramRate;
    const goldRatio = safeGross > 0 ? (netGoldWeight / safeGross) * 100 : 100;

    return {
      hasStones: Boolean(hasStones),
      grossWeight: safeGross,
      stoneWeight: safeStone,
      netGoldWeight,
      goldRatio,
      stonePremiumPaid,
      pureGoldTotal,
      hasResaleWarning: safeStone > 0,
    };
  }

  function calculateTradeIn({
    price24k,
    newPiece = { weight: 0, karat: 21, workmanshipPerGram: 0, profitPerGram: 0, taxRate: 15 },
    oldPiece = { weight: 0, karat: 21, deductionRate: 0 },
  } = {}) {
    const purchase = calculateGoldPurchase({ ...newPiece, price24k });
    const sale = calculateGoldSale({ ...oldPiece, price24k });

    const netPayable = purchase.total - sale.total;

    return {
      isTradeIn: true,
      shariaCompliant: true,
      zatcaCompliant: true,
      purchaseContract: {
        weight: purchase.weight,
        karat: purchase.karat,
        subtotal: purchase.subtotal,
        vat: purchase.vat,
        total: purchase.total,
      },
      saleContract: {
        weight: sale.weight,
        karat: sale.karat,
        rawMetalValue: sale.rawMetalValue,
        deductionValue: sale.deductionValue,
        total: sale.total,
      },
      settlement: {
        newPurchaseTotal: purchase.total,
        oldGoldPayout: sale.total,
        netCashDifference: netPayable,
        action: netPayable > 0 ? 'customer_pays' : netPayable < 0 ? 'customer_receives' : 'even',
      },
    };
  }

  return {
    normalizeMode,
    clampTaxRate,
    clampPercent,
    calculateGoldPurchase,
    calculateGoldSale,
    calculateTransaction,
    calculateInvoice,
    compareQuote,
    auditCounterQuote,
    calculateStoneDeduction,
    calculateTradeIn,
    COUNTRY_VAT_RATES,
    defaultTaxRateForKarat,
  };
});
