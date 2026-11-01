const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateStoneDeduction } = require('../gold-calculator.js');

test('calculateStoneDeduction returns 100% gold ratio when hasStones is false', () => {
  const result = calculateStoneDeduction({
    grossWeight: 10,
    stoneWeight: 2,
    hasStones: false,
    price24k: 400,
    karat: 21,
    workmanshipPerGram: 30,
    taxRate: 15,
  });

  assert.equal(result.hasStones, false);
  assert.equal(result.grossWeight, 10);
  assert.equal(result.stoneWeight, 0);
  assert.equal(result.netGoldWeight, 10);
  assert.equal(result.goldRatio, 100);
  assert.equal(result.stonePremiumPaid, 0);
  assert.equal(result.hasResaleWarning, false);
});

test('calculateStoneDeduction accurately calculates stone premium paid and gold ratio', () => {
  // Gross = 15g, stones = 3g -> Net gold = 12g (80%)
  // Karat 18: Purity = 18/24 = 0.75. Price24k = 400 -> gramPrice = 300 SAR
  // Labor = 50 SAR -> gross rate before tax = 350 SAR -> with 15% tax = 402.5 SAR/g
  // Stone premium paid = 3 * 402.5 = 1207.5 SAR
  // Pure gold total = 12 * 402.5 = 4830 SAR
  const result = calculateStoneDeduction({
    grossWeight: 15,
    stoneWeight: 3,
    hasStones: true,
    price24k: 400,
    karat: 18,
    workmanshipPerGram: 50,
    taxRate: 15,
  });

  assert.equal(result.hasStones, true);
  assert.equal(result.grossWeight, 15);
  assert.equal(result.stoneWeight, 3);
  assert.equal(result.netGoldWeight, 12);
  assert.equal(result.goldRatio, 80);
  assert.ok(Math.abs(result.stonePremiumPaid - 1207.5) < 1e-4);
  assert.ok(Math.abs(result.pureGoldTotal - 4830) < 1e-4);
  assert.equal(result.hasResaleWarning, true);
});

test('calculateStoneDeduction clamps stone weight to not exceed gross weight', () => {
  const result = calculateStoneDeduction({
    grossWeight: 5,
    stoneWeight: 8,
    hasStones: true,
    price24k: 400,
    karat: 21,
  });

  assert.equal(result.netGoldWeight, 0);
  assert.equal(result.goldRatio, 0);
});
