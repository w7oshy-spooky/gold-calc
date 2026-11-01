const test = require('node:test');
const assert = require('node:assert/strict');

const { auditCounterQuote } = require('../gold-calculator.js');

test('auditCounterQuote rejects insufficient inputs gracefully', () => {
  assert.deepEqual(auditCounterQuote({ price24k: 0, karat: 21, weight: 10, quotedTotal: 3000 }), {
    available: false,
    reason: 'insufficient_inputs',
  });
  assert.deepEqual(auditCounterQuote({ price24k: 400, karat: 21, weight: 0, quotedTotal: 3000 }), {
    available: false,
    reason: 'insufficient_inputs',
  });
  assert.deepEqual(auditCounterQuote({ price24k: 400, karat: 21, weight: 10, quotedTotal: 0 }), {
    available: false,
    reason: 'insufficient_inputs',
  });
});

test('auditCounterQuote correctly deconstructs quote into raw gold, ZATCA VAT, and labor', () => {
  // 10g 21k, price24k = 400 SAR/g -> 21k gram price = 350 SAR/g -> raw metal = 3,500 SAR
  // Quoted total = 4,600 SAR with 15% VAT
  // subtotal = 4600 / 1.15 = 4000 SAR
  // VAT = 600 SAR
  // Labor cost = 4000 - 3500 = 500 SAR
  // Labor per gram = 500 / 10 = 50 SAR/g -> Category: italian (45.01 - 80)
  const result = auditCounterQuote({
    price24k: 400,
    karat: 21,
    weight: 10,
    quotedTotal: 4600,
    taxRate: 15,
  });

  assert.equal(result.available, true);
  assert.equal(result.price24k, 400);
  assert.equal(result.karat, 21);
  assert.equal(result.weight, 10);
  assert.equal(result.quotedTotal, 4600);
  assert.equal(result.taxRate, 15);
  assert.equal(result.gramPrice, 350);
  assert.equal(result.rawMetalCost, 3500);
  assert.equal(Math.round(result.subtotal), 4000);
  assert.equal(Math.round(result.vat), 600);
  assert.equal(Math.round(result.laborCost), 500);
  assert.ok(Math.abs(result.laborPerGram - 50) < 1e-4);
  assert.equal(result.benchmarkCategory, 'italian');
});

test('auditCounterQuote correctly assigns all benchmark categories', () => {
  // Below spot: Quoted 3000 SAR when raw metal is 3500 SAR
  const belowSpot = auditCounterQuote({
    price24k: 400,
    karat: 21,
    weight: 10,
    quotedTotal: 3000,
    taxRate: 15,
  });
  assert.equal(belowSpot.benchmarkCategory, 'below_spot');

  // Plain / bullion casting (<= 25 SAR/g):
  // raw metal = 3500 SAR. Labor = 200 SAR (20 SAR/g) -> subtotal = 3700 SAR -> total = 3700 * 1.15 = 4255 SAR
  const plain = auditCounterQuote({
    price24k: 400,
    karat: 21,
    weight: 10,
    quotedTotal: 4255,
    taxRate: 15,
  });
  assert.equal(plain.benchmarkCategory, 'plain');

  // Gulf / Bahraini (25.01 - 45 SAR/g):
  // Labor = 350 SAR (35 SAR/g) -> subtotal = 3850 SAR -> total = 3850 * 1.15 = 4427.5 SAR
  const gulf = auditCounterQuote({
    price24k: 400,
    karat: 21,
    weight: 10,
    quotedTotal: 4427.5,
    taxRate: 15,
  });
  assert.equal(gulf.benchmarkCategory, 'gulf');

  // Luxury / high-end (> 80 SAR/g):
  // Labor = 1000 SAR (100 SAR/g) -> subtotal = 4500 SAR -> total = 4500 * 1.15 = 5175 SAR
  const luxury = auditCounterQuote({
    price24k: 400,
    karat: 21,
    weight: 10,
    quotedTotal: 5175,
    taxRate: 15,
  });
  assert.equal(luxury.benchmarkCategory, 'luxury');
});
