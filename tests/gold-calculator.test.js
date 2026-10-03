const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateGoldPurchase,
  calculateGoldSale,
  calculateTransaction,
  compareQuote,
  normalizeMode,
  clampTaxRate,
  clampPercent,
} = require('../gold-calculator.js');

const { ounceUsdTo24kSar } = require('../js/core/price-converter.js');

test('calculates a normal 21K purchase correctly', () => {
  const result = calculateGoldPurchase({
    price24k: ounceUsdTo24kSar(4300),
    weight: 15,
    karat: 21,
    workmanshipPerGram: 35,
    profitPerGram: 20,
    taxRate: 15,
  });

  assert.ok(Math.abs(result.gramPrice - 453.6269398667354) < 1e-9);
  assert.ok(Math.abs(result.goldCost - 6804.404098001031) < 1e-9);
  assert.ok(Math.abs(result.laborCost - 825) < 1e-9);
  assert.ok(Math.abs(result.subtotal - 7629.404098001031) < 1e-9);
  assert.ok(Math.abs(result.vat - 1144.4106147001546) < 1e-9);
  assert.ok(Math.abs(result.total - 8773.814712701185) < 1e-9);
});

test('negative numeric inputs are sanitized to zero', () => {
  const result = calculateGoldPurchase({
    price24k: -500,
    weight: -15,
    karat: 21,
    workmanshipPerGram: -35,
    profitPerGram: -20,
    taxRate: -15,
  });

  assert.equal(result.price24k, 0);
  assert.equal(result.weight, 0);
  assert.equal(result.workmanshipPerGram, 0);
  assert.equal(result.profitPerGram, 0);
  assert.equal(result.taxRate, 0);
  assert.equal(result.total, 0);
});

test('tax rate is clamped to the supported 0-25 range', () => {
  assert.equal(clampTaxRate(-2), 0);
  assert.equal(clampTaxRate(15), 15);
  assert.equal(clampTaxRate(99), 25);
  assert.equal(clampTaxRate('abc'), 0);
});

test('normalizes transaction mode and clamps generic percentages', () => {
  assert.equal(normalizeMode('sell'), 'sell');
  assert.equal(normalizeMode('other'), 'buy');
  assert.equal(clampPercent(-5), 0);
  assert.equal(clampPercent(10.5), 10.5);
  assert.equal(clampPercent(120), 100);
});

test('calculates a 21K sale with explicit buyer deduction', () => {
  const result = calculateGoldSale({
    price24k: ounceUsdTo24kSar(4300),
    weight: 15,
    karat: 21,
    deductionRate: 10,
  });

  assert.ok(Math.abs(result.gramPrice - 453.6269398667354) < 1e-9);
  assert.ok(Math.abs(result.rawMetalValue - 6804.404098001031) < 1e-9);
  assert.ok(Math.abs(result.deductionValue - 680.4404098001031) < 1e-9);
  assert.ok(Math.abs(result.total - 6123.963688200928) < 1e-9);
});

test('sale deduction rate is clamped to 0-100', () => {
  assert.equal(calculateGoldSale({ price24k: 500, weight: 10, karat: 24, deductionRate: -1 }).deductionRate, 0);
  assert.equal(calculateGoldSale({ price24k: 500, weight: 10, karat: 24, deductionRate: 150 }).deductionRate, 100);
});

test('calculateTransaction dispatches by normalized mode', () => {
  const buy = calculateTransaction({ mode: 'buy', price24k: 500, weight: 1, karat: 24, taxRate: 0 });
  const sell = calculateTransaction({ mode: 'sell', price24k: 500, weight: 1, karat: 24, deductionRate: 10 });

  assert.equal(buy.mode, 'buy');
  assert.equal(buy.total, 500);
  assert.equal(sell.mode, 'sell');
  assert.equal(sell.total, 450);
});

test('buy quote comparison uses close, moderate_high, high and below_reference bands', () => {
  assert.equal(compareQuote({ mode: 'buy', referenceTotal: 1000, quotedTotal: 1020 }).status, 'close');
  assert.equal(compareQuote({ mode: 'buy', referenceTotal: 1000, quotedTotal: 1050 }).status, 'moderate_high');
  assert.equal(compareQuote({ mode: 'buy', referenceTotal: 1000, quotedTotal: 1051 }).status, 'high');
  assert.equal(compareQuote({ mode: 'buy', referenceTotal: 1000, quotedTotal: 970 }).status, 'below_reference');
});

test('sell quote comparison is direction-aware for the seller', () => {
  assert.equal(compareQuote({ mode: 'sell', referenceTotal: 1000, quotedTotal: 990 }).status, 'close');
  assert.equal(compareQuote({ mode: 'sell', referenceTotal: 1000, quotedTotal: 970 }).status, 'moderate_low');
  assert.equal(compareQuote({ mode: 'sell', referenceTotal: 1000, quotedTotal: 940 }).status, 'low');
  assert.equal(compareQuote({ mode: 'sell', referenceTotal: 1000, quotedTotal: 1030 }).status, 'above_reference');
});

test('quote comparison reports difference values and handles unavailable inputs', () => {
  const result = compareQuote({ mode: 'buy', referenceTotal: 1000, quotedTotal: 1030 });
  assert.equal(result.available, true);
  assert.equal(result.difference, 30);
  assert.equal(result.differencePct, 3);

  assert.deepEqual(compareQuote({ mode: 'buy', referenceTotal: 0, quotedTotal: 1030 }), {
    available: false,
    difference: 0,
    differencePct: 0,
    status: 'unavailable',
  });
});