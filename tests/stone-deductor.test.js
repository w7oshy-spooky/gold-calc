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

test('calculateStoneDeduction separates price with stones vs price for pure gold only from quoted total', () => {
  // Quote is 4000 SAR for a 10g piece containing 2g stones (net gold 8g, 20% stones)
  // Rate = 4000 / 10 = 400 SAR/g
  // Gross total (if stones counted as gold) = 4000 SAR
  // Pure gold only (without stones) = 8 * 400 = 3200 SAR
  // Premium paid for stones at gold rate = 2 * 400 = 800 SAR
  const result = calculateStoneDeduction({
    grossWeight: 10,
    stoneWeight: 2,
    hasStones: true,
    quotedTotal: 4000,
    price24k: 400,
    karat: 21,
  });

  assert.equal(result.grossWeight, 10);
  assert.equal(result.stoneWeight, 2);
  assert.equal(result.netGoldWeight, 8);
  assert.equal(result.grossTotal, 4000);
  assert.equal(result.pureGoldTotal, 3200);
  assert.equal(result.stonePremiumPaid, 800);
  assert.equal(result.pureGoldTotal + result.stonePremiumPaid, result.grossTotal);
  assert.equal(result.goldRatio, 80);
  assert.equal(result.stoneRatio, 20);
  assert.equal(result.exceedsZirconLimit, true);
});

test('calculateStoneDeduction flags Saudi 5% zircon limit correctly', () => {
  // 10g total with 0.3g stones = 3% <= 5% limit
  const withinLimit = calculateStoneDeduction({
    grossWeight: 10,
    stoneWeight: 0.3,
    hasStones: true,
    price24k: 400,
    karat: 21,
  });
  assert.equal(withinLimit.exceedsZirconLimit, false);

  // 10g total with 0.8g stones = 8% > 5% limit
  const overLimit = calculateStoneDeduction({
    grossWeight: 10,
    stoneWeight: 0.8,
    hasStones: true,
    price24k: 400,
    karat: 21,
  });
  assert.equal(overLimit.exceedsZirconLimit, true);
});

