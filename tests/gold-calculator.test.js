const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OUNCE_GRAMS,
  USD_SAR_RATE,
  ounceUsdTo24kSar,
  calculateGoldPurchase,
  sanitizeNonNegative,
  normalizeKarat,
  clampTaxRate,
} = require('../gold-calculator.js');

test('uses troy ounce grams and SAR peg constants', () => {
  assert.equal(OUNCE_GRAMS, 31.1034768);
  assert.equal(USD_SAR_RATE, 3.75);
});

test('converts ounce USD to 24K SAR per gram without early rounding', () => {
  const result = ounceUsdTo24kSar(4300);
  assert.ok(Math.abs(result - 518.4307884191262) < 1e-9);
});

test('invalid or non-positive ounce price converts to zero', () => {
  assert.equal(ounceUsdTo24kSar(''), 0);
  assert.equal(ounceUsdTo24kSar(0), 0);
  assert.equal(ounceUsdTo24kSar(-10), 0);
  assert.equal(ounceUsdTo24kSar('abc'), 0);
});

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

test('unsupported karat falls back to 21K', () => {
  assert.equal(normalizeKarat(19), 21);
  assert.equal(normalizeKarat('22'), 22);
});

test('tax rate is clamped to the supported 0-25 range', () => {
  assert.equal(clampTaxRate(-2), 0);
  assert.equal(clampTaxRate(15), 15);
  assert.equal(clampTaxRate(99), 25);
  assert.equal(clampTaxRate('abc'), 0);
});

test('sanitizeNonNegative handles blanks, NaN and valid decimals', () => {
  assert.equal(sanitizeNonNegative(''), 0);
  assert.equal(sanitizeNonNegative('abc'), 0);
  assert.equal(sanitizeNonNegative(-1), 0);
  assert.equal(sanitizeNonNegative('12.5'), 12.5);
});

test('price source is explicit: ounce mode ignores manual 24K input', () => {
  const { resolvePrice24k } = require('../gold-calculator.js');
  const result = resolvePrice24k({
    source: 'ounce',
    ouncePriceUsd: 4300,
    manualPrice24k: 999,
  });
  assert.ok(Math.abs(result - ounceUsdTo24kSar(4300)) < 1e-12);
});

test('price source is explicit: manual mode ignores ounce input', () => {
  const { resolvePrice24k } = require('../gold-calculator.js');
  assert.equal(resolvePrice24k({
    source: 'manual',
    ouncePriceUsd: 4300,
    manualPrice24k: 520.25,
  }), 520.25);
});

test('unknown price source resolves to zero instead of guessing', () => {
  const { resolvePrice24k } = require('../gold-calculator.js');
  assert.equal(resolvePrice24k({ source: 'other', ouncePriceUsd: 4300, manualPrice24k: 520 }), 0);
});