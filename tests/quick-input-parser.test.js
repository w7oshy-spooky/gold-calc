const test = require('node:test');
const assert = require('node:assert/strict');
const parser = require('../js/core/quick-input-parser.js');

test('normalizes eastern arabic digits and arabic decimal separators', () => {
  assert.equal(parser.normalizeDigits('١٢٣٤٥٦٧٨٩٠'), '1234567890');
  assert.equal(parser.normalizeSeparators('٦٫٥'), '6.5');
  assert.equal(parser.normalizeSeparators('١،٢٠٠'), '1200');
  assert.equal(parser.normalizeSeparators('12,50'), '12.50');
});

test('parses natural Arabic sentence with karat, weight and price', () => {
  const result = parser.parseQuickInput('خاتم عيار 21 وزنه 6.5 جرام بـ 2800 ريال');
  assert.equal(result.success, true);
  assert.equal(result.karat, 21);
  assert.equal(result.weight, 6.5);
  assert.equal(result.quotedTotal, 2800);
  assert.equal(result.hasStones, false);
});

test('parses eastern Arabic digits with stones mention', () => {
  const result = parser.parseQuickInput('سلسال عيار ١٨ وزن ٣٫٢ جم بسعر ١٢٠٠ ر.س وفيه فصوص');
  assert.equal(result.success, true);
  assert.equal(result.karat, 18);
  assert.equal(result.weight, 3.2);
  assert.equal(result.quotedTotal, 1200);
  assert.equal(result.hasStones, true);
});

test('parses english input with compact format', () => {
  const result = parser.parseQuickInput('22k bangle 12.4g 4500 sar');
  assert.equal(result.success, true);
  assert.equal(result.karat, 22);
  assert.equal(result.weight, 12.4);
  assert.equal(result.quotedTotal, 4500);
  assert.equal(result.hasStones, false);
});

test('parses input with zircon mention and western digits', () => {
  const result = parser.parseQuickInput('طقم عيار 21 وزن 25.4 جرام مع زركون بسعر 10500 ريال');
  assert.equal(result.success, true);
  assert.equal(result.karat, 21);
  assert.equal(result.weight, 25.4);
  assert.equal(result.quotedTotal, 10500);
  assert.equal(result.hasStones, true);
});

test('gracefully handles empty or non-string input', () => {
  const empty = parser.parseQuickInput('');
  assert.equal(empty.success, false);
  assert.equal(empty.karat, null);
  assert.equal(empty.weight, null);
  assert.equal(empty.quotedTotal, null);

  const nonString = parser.parseQuickInput(null);
  assert.equal(nonString.success, false);
});
