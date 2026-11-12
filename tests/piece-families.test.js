const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const core = require('../gold-calculator.js');
const parser = require('../js/core/quick-input-parser.js');

test('JEWELRY_PIECE_FAMILIES defines all expected piece categories', () => {
  assert.ok(core.JEWELRY_PIECE_FAMILIES);
  const families = Object.keys(core.JEWELRY_PIECE_FAMILIES);
  assert.deepEqual(families.sort(), ['bangle', 'bullion', 'chain', 'ring_earring', 'set_bridal']);
});

test('inferLaborBenchmark classifies bangles correctly across weight tiers', () => {
  // Light bangle (<= 15g)
  const light = core.inferLaborBenchmark({ pieceFamily: 'bangle', weight: 10, karat: 21 });
  assert.equal(light.tierKey, 'light');
  assert.equal(light.min, 25);
  assert.equal(light.max, 35);

  // Medium bangle (15g - 35g)
  const medium = core.inferLaborBenchmark({ pieceFamily: 'bangle', weight: 25, karat: 21 });
  assert.equal(medium.tierKey, 'medium');
  assert.equal(medium.min, 18);
  assert.equal(medium.max, 28);

  // Heavy bangle (> 35g)
  const heavy = core.inferLaborBenchmark({ pieceFamily: 'bangle', weight: 50, karat: 21 });
  assert.equal(heavy.tierKey, 'heavy');
  assert.equal(heavy.min, 15);
  assert.equal(heavy.max, 22);
});

test('inferLaborBenchmark classifies rings and earrings correctly across weight tiers', () => {
  // Light ring / earring (<= 3g)
  const light = core.inferLaborBenchmark({ pieceFamily: 'ring_earring', weight: 2, karat: 21 });
  assert.equal(light.tierKey, 'light');
  assert.equal(light.min, 35);
  assert.equal(light.max, 55);

  // Medium ring (3g - 6g)
  const medium = core.inferLaborBenchmark({ pieceFamily: 'ring_earring', weight: 4.5, karat: 21 });
  assert.equal(medium.tierKey, 'medium');
  assert.equal(medium.min, 25);
  assert.equal(medium.max, 40);

  // Heavy ring (> 6g)
  const heavy = core.inferLaborBenchmark({ pieceFamily: 'ring_earring', weight: 8, karat: 21 });
  assert.equal(heavy.tierKey, 'heavy');
  assert.equal(heavy.min, 20);
  assert.equal(heavy.max, 30);
});

test('inferLaborBenchmark applies karat 18 adjustment for intricate jewelry pieces', () => {
  // 21k light ring: 35-55
  const k21 = core.inferLaborBenchmark({ pieceFamily: 'ring_earring', weight: 2, karat: 21 });
  // 18k light ring: +10 min, +15 max -> 45-70
  const k18 = core.inferLaborBenchmark({ pieceFamily: 'ring_earring', weight: 2, karat: 18 });
  assert.equal(k18.min, k21.min + 10);
  assert.equal(k18.max, k21.max + 15);
});

test('generateBargainingAdvice tailors fair price and verdict to piece family', () => {
  // 50g 21k bangles quoted at 45 SAR/g labor (which is overpriced for heavy bangles: fair is 15-22 SAR/g)
  // Raw 21k gold = 350 SAR/g -> 50g * 350 = 17,500 SAR
  // Labor = 50g * 45 = 2,250 SAR. Subtotal = 19,750 SAR. Total incl 15% VAT = 22,712.50 SAR
  const audit = core.auditCounterQuote({
    price24k: 400,
    karat: 21,
    weight: 50,
    quotedTotal: 22712.5,
    taxRate: 15,
  });

  const advice = core.generateBargainingAdvice({ audit, pieceFamily: 'bangle' });
  assert.equal(advice.available, true);
  assert.equal(advice.pieceFamily, 'bangle');
  assert.equal(advice.inferredTier, 'heavy');
  assert.equal(advice.minFairLaborPerGram, 15);
  assert.equal(advice.maxFairLaborPerGram, 22);
  assert.equal(advice.verdictKey, 'overpriced');
  assert.ok(advice.potentialSavings > 1000);
});

test('quick-input-parser detects piece family keywords accurately', () => {
  assert.equal(parser.parseQuickInput('خاتم عيار 21 وزنه 4 جم بـ 1800').pieceFamily, 'ring_earring');
  assert.equal(parser.parseQuickInput('حلق ناعم عيار 18 وزن 2 جم').pieceFamily, 'ring_earring');
  assert.equal(parser.parseQuickInput('طقم بناجر وزن 45 جرام بسعر 18000').pieceFamily, 'bangle');
  assert.equal(parser.parseQuickInput('غوايش كويتي عيار 21 وزن 30 جم').pieceFamily, 'bangle');
  assert.equal(parser.parseQuickInput('سلسلة عيار 18 وزن 5 جم').pieceFamily, 'chain');
  assert.equal(parser.parseQuickInput('طقم شبكة عيار 21 وزن 60 جم').pieceFamily, 'set_bridal');
  assert.equal(parser.parseQuickInput('سبيكة 10 جرام عيار 24').pieceFamily, 'bullion');
  assert.equal(parser.parseQuickInput('جنيه ذهب جورجي 8 جم').pieceFamily, 'bullion');
});

test('index.html contains piece family group and buttons', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /id=["']pieceFamilyGroup["']/);
  assert.match(html, /data-family=["']ring_earring["']/);
  assert.match(html, /data-family=["']bangle["']/);
  assert.match(html, /data-family=["']chain["']/);
  assert.match(html, /data-family=["']set_bridal["']/);
  assert.match(html, /data-family=["']bullion["']/);
});

test('inferLaborBenchmark provides fair defaultLabor per gram for calculator auto-fill', () => {
  const lightRing = core.inferLaborBenchmark({ pieceFamily: 'ring_earring', weight: 2, karat: 21 });
  assert.equal(lightRing.defaultLabor, 45);

  const heavyBangle = core.inferLaborBenchmark({ pieceFamily: 'bangle', weight: 50, karat: 21 });
  assert.equal(heavyBangle.defaultLabor, 19);

  const medBullion = core.inferLaborBenchmark({ pieceFamily: 'bullion', weight: 20, karat: 24 });
  assert.equal(medBullion.defaultLabor, 14);
});
