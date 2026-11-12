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
    quotedTotal = 0,
  } = {}) {
    const safeGross = sanitizeNonNegative(grossWeight);
    const safeStone = hasStones ? sanitizeNonNegative(stoneWeight) : 0;
    const netGoldWeight = Math.max(0, safeGross - safeStone);
    const safeKarat = normalizeKarat(karat);
    const purity = safeKarat / 24;
    const gramPrice = sanitizeNonNegative(price24k) * purity;
    const laborPerGram = sanitizeNonNegative(workmanshipPerGram) + sanitizeNonNegative(profitPerGram);
    const safeTaxRate = clampTaxRate(taxRate);
    const safeQuote = sanitizeNonNegative(quotedTotal);

    let grossTotal = 0;
    let pureGoldTotal = 0;
    let stonePremiumPaid = 0;
    let ratePerGram = 0;

    if (safeQuote > 0 && safeGross > 0) {
      ratePerGram = safeQuote / safeGross;
      grossTotal = safeQuote;
      pureGoldTotal = netGoldWeight * ratePerGram;
      stonePremiumPaid = safeStone * ratePerGram;
    } else {
      const grossGramRate = (gramPrice + laborPerGram) * (1 + safeTaxRate / 100);
      ratePerGram = grossGramRate;
      grossTotal = safeGross * grossGramRate;
      pureGoldTotal = netGoldWeight * grossGramRate;
      stonePremiumPaid = safeStone * grossGramRate;
    }

    const goldRatio = safeGross > 0 ? (netGoldWeight / safeGross) * 100 : 100;
    const stoneRatio = safeGross > 0 ? (safeStone / safeGross) * 100 : 0;
    const exceedsZirconLimit = stoneRatio > 5;

    return {
      hasStones: Boolean(hasStones),
      grossWeight: safeGross,
      stoneWeight: safeStone,
      netGoldWeight,
      ratePerGram,
      goldRatio,
      stoneRatio,
      stonePremiumPaid,
      pureGoldTotal,
      grossTotal,
      exceedsZirconLimit,
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

  const BENCHMARK_RANGES = Object.freeze({
    plain: { min: 15, max: 25 },
    gulf: { min: 25, max: 45 },
    italian: { min: 45, max: 80 },
    luxury: { min: 80, max: 150 },
  });

  const JEWELRY_PIECE_FAMILIES = Object.freeze({
    ring_earring: {
      id: 'ring_earring',
      icon: '💍',
      tiers: [
        { maxWeight: 3, min: 35, max: 55, tierKey: 'light' },
        { maxWeight: 6, min: 25, max: 40, tierKey: 'medium' },
        { maxWeight: Infinity, min: 20, max: 30, tierKey: 'heavy' },
      ],
    },
    bangle: {
      id: 'bangle',
      icon: '⭕',
      tiers: [
        { maxWeight: 15, min: 25, max: 35, tierKey: 'light' },
        { maxWeight: 35, min: 18, max: 28, tierKey: 'medium' },
        { maxWeight: Infinity, min: 15, max: 22, tierKey: 'heavy' },
      ],
    },
    chain: {
      id: 'chain',
      icon: '📿',
      tiers: [
        { maxWeight: 5, min: 35, max: 55, tierKey: 'light' },
        { maxWeight: 15, min: 25, max: 40, tierKey: 'medium' },
        { maxWeight: Infinity, min: 18, max: 28, tierKey: 'heavy' },
      ],
    },
    set_bridal: {
      id: 'set_bridal',
      icon: '👑',
      tiers: [
        { maxWeight: 30, min: 35, max: 55, tierKey: 'light' },
        { maxWeight: 70, min: 28, max: 45, tierKey: 'medium' },
        { maxWeight: Infinity, min: 22, max: 38, tierKey: 'heavy' },
      ],
    },
    bullion: {
      id: 'bullion',
      icon: '🪙',
      tiers: [
        { maxWeight: 5, min: 18, max: 35, tierKey: 'small' },
        { maxWeight: 50, min: 10, max: 18, tierKey: 'medium' },
        { maxWeight: Infinity, min: 4, max: 10, tierKey: 'large' },
      ],
    },
  });

  function inferLaborBenchmark({ pieceFamily = 'general', weight = 0, karat = 21 } = {}) {
    const family = JEWELRY_PIECE_FAMILIES[pieceFamily];
    const safeWeight = Math.max(0, Number(weight) || 0);
    const safeKarat = Number(karat) || 21;

    if (!family) {
      const min = safeKarat === 18 ? 35 : 25;
      const max = safeKarat === 18 ? 70 : 45;
      return { min, max, tierKey: 'standard', pieceFamily: 'general', icon: '⚖️' };
    }

    const tier = family.tiers.find((t) => safeWeight <= t.maxWeight) || family.tiers[family.tiers.length - 1];
    let min = tier.min;
    let max = tier.max;

    if (safeKarat === 18 && pieceFamily !== 'bullion') {
      min += 10;
      max += 15;
    }

    return {
      min,
      max,
      defaultLabor: Math.round((min + max) / 2),
      tierKey: tier.tierKey,
      pieceFamily,
      icon: family.icon,
    };
  }

  const NISAB_GOLD_24K_GRAMS = 85;

  function generateBargainingAdvice({ audit, targetCategory = null, pieceFamily = null } = {}) {
    if (!audit || !audit.available) {
      return { available: false };
    }

    let category = targetCategory && BENCHMARK_RANGES[targetCategory]
      ? targetCategory
      : (audit.benchmarkCategory === 'below_spot' ? 'plain' : audit.benchmarkCategory);

    let range;
    let inferred = null;

    if (pieceFamily && JEWELRY_PIECE_FAMILIES[pieceFamily]) {
      inferred = inferLaborBenchmark({
        pieceFamily,
        weight: audit.weight,
        karat: audit.karat,
      });
      range = { min: inferred.min, max: inferred.max };
      category = pieceFamily;
    } else {
      range = BENCHMARK_RANGES[category] || BENCHMARK_RANGES.gulf;
    }

    const rawMetalCost = audit.rawMetalCost;
    const weight = audit.weight;
    const taxRate = audit.taxRate;
    const vatMultiplier = 1 + (taxRate / 100);

    const minFairLabor = range.min * weight;
    const maxFairLabor = range.max * weight;
    const minFairPrice = (rawMetalCost + minFairLabor) * vatMultiplier;
    const maxFairPrice = (rawMetalCost + maxFairLabor) * vatMultiplier;
    const suggestedOffer = (minFairPrice + maxFairPrice) / 2;

    const laborPerGram = audit.laborPerGram;
    let verdictKey = 'fair';
    let adviceTemplateKey = 'advice_fair';

    if (pieceFamily && inferred) {
      if (laborPerGram <= range.min) {
        verdictKey = 'great_deal';
        adviceTemplateKey = 'advice_great_deal';
      } else if (laborPerGram <= range.max) {
        verdictKey = 'fair';
        adviceTemplateKey = 'advice_fair';
      } else if (laborPerGram <= range.max * 1.3) {
        verdictKey = 'moderate_high';
        adviceTemplateKey = 'advice_negotiate_moderate';
      } else {
        verdictKey = 'overpriced';
        adviceTemplateKey = 'advice_negotiate_high';
      }
    } else {
      if (laborPerGram <= 25) {
        verdictKey = 'great_deal';
        adviceTemplateKey = 'advice_great_deal';
      } else if (laborPerGram <= 45) {
        verdictKey = 'fair';
        adviceTemplateKey = 'advice_fair';
      } else if (laborPerGram <= 80) {
        verdictKey = 'moderate_high';
        adviceTemplateKey = 'advice_negotiate_moderate';
      } else {
        verdictKey = 'overpriced';
        adviceTemplateKey = 'advice_negotiate_high';
      }
    }

    const potentialSavings = Math.max(0, audit.quotedTotal - maxFairPrice);

    return {
      available: true,
      quotedTotal: audit.quotedTotal,
      rawMetalCost,
      weight,
      laborPerGram,
      targetBenchmark: category,
      pieceFamily: pieceFamily || null,
      inferredTier: inferred ? inferred.tierKey : null,
      minFairLaborPerGram: range.min,
      maxFairLaborPerGram: range.max,
      minFairPrice,
      maxFairPrice,
      suggestedOffer,
      potentialSavings,
      verdictKey,
      adviceTemplateKey,
    };
  }

  function calculateZakat({ items = [], price24k = 0, exemptPersonalUse = true, hawlMet = true } = {}) {
    const safePrice24k = sanitizeNonNegative(price24k);
    const itemList = Array.isArray(items) ? items : [];

    let totalWeight = 0;
    let zakatEligibleWeight24 = 0;
    let totalMarketValueSar = 0;

    for (const item of itemList) {
      const weight = sanitizeNonNegative(item.weight);
      const karat = normalizeKarat(item.karat);
      const category = item.category || 'personal_jewelry';
      const purity = karat / 24;
      const eq24 = weight * purity;
      const marketVal = eq24 * safePrice24k;

      totalWeight += weight;
      totalMarketValueSar += marketVal;

      const isExempt = exemptPersonalUse && category === 'personal_jewelry';
      if (!isExempt) {
        zakatEligibleWeight24 += eq24;
      }
    }

    const nisabReached = zakatEligibleWeight24 >= NISAB_GOLD_24K_GRAMS;
    const isObligatory = nisabReached && Boolean(hawlMet) && safePrice24k > 0;
    const zakatDueGrams24 = isObligatory ? (zakatEligibleWeight24 * 0.025) : 0;
    const zakatDueSar = isObligatory ? (zakatDueGrams24 * safePrice24k) : 0;

    return {
      totalWeight,
      zakatEligibleWeight24,
      nisabGrams24: NISAB_GOLD_24K_GRAMS,
      nisabReached,
      hawlMet: Boolean(hawlMet),
      exemptPersonalUse: Boolean(exemptPersonalUse),
      totalMarketValueSar,
      zakatDueGrams24,
      zakatDueSar,
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
    generateBargainingAdvice,
    calculateZakat,
    BENCHMARK_RANGES,
    JEWELRY_PIECE_FAMILIES,
    inferLaborBenchmark,
    NISAB_GOLD_24K_GRAMS,
    COUNTRY_VAT_RATES,
    defaultTaxRateForKarat,
  };
});
