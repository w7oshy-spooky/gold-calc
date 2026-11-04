const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../gold-calculator.js');

test('generateBargainingAdvice returns unavailable for missing inputs', () => {
  const result = core.generateBargainingAdvice({ audit: null });
  assert.equal(result.available, false);

  const unavailableAudit = core.auditCounterQuote({ price24k: 0, weight: 0, quotedTotal: 0 });
  const result2 = core.generateBargainingAdvice({ audit: unavailableAudit });
  assert.equal(result2.available, false);
});

test('generateBargainingAdvice calculates fair price range and potential savings correctly', () => {
  // 10g 21k piece, price24k = 400 SAR
  // Purity = 21/24 = 0.875
  // Gram price = 350 SAR
  // Raw metal cost = 3,500 SAR
  // Quoted total = 5,200 SAR (incl 15% VAT)
  // Subtotal = 5200 / 1.15 = 4521.739 SAR
  // Labor cost = 4521.739 - 3500 = 1021.739 SAR
  // Labor per gram = 102.17 SAR/g -> luxury / overpriced
  const audit = core.auditCounterQuote({
    price24k: 400,
    karat: 21,
    weight: 10,
    quotedTotal: 5200,
    taxRate: 15,
    quoteIncludesVat: true,
  });

  // Calculate advice with targetBenchmark = 'gulf' (25 - 45 SAR/g)
  const advice = core.generateBargainingAdvice({ audit, targetCategory: 'gulf' });
  assert.equal(advice.available, true);
  assert.equal(advice.targetBenchmark, 'gulf');
  assert.equal(advice.verdictKey, 'overpriced');
  assert.equal(advice.adviceTemplateKey, 'advice_negotiate_high');

  // Min fair: (3500 + 250) * 1.15 = 3750 * 1.15 = 4312.50 SAR
  assert.equal(Math.round(advice.minFairPrice * 100) / 100, 4312.5);
  // Max fair: (3500 + 450) * 1.15 = 3950 * 1.15 = 4542.50 SAR
  assert.equal(Math.round(advice.maxFairPrice * 100) / 100, 4542.5);
  // Potential savings = 5200 - 4542.5 = 657.5 SAR
  assert.equal(Math.round(advice.potentialSavings * 100) / 100, 657.5);
});

test('generateBargainingAdvice assigns great_deal verdict for low labor', () => {
  const audit = core.auditCounterQuote({
    price24k: 400,
    karat: 21,
    weight: 10,
    quotedTotal: 4200,
    taxRate: 15,
  });
  // Subtotal = 4200/1.15 = 3652.17. Raw = 3500. Labor = 152.17. Labor/g = 15.21 SAR/g (< 25)
  const advice = core.generateBargainingAdvice({ audit });
  assert.equal(advice.available, true);
  assert.equal(advice.verdictKey, 'great_deal');
  assert.equal(advice.adviceTemplateKey, 'advice_great_deal');
  assert.equal(advice.potentialSavings, 0);
});
