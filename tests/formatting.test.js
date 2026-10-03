const test = require('node:test');
const assert = require('node:assert/strict');

const { createFormatting } = require('../js/ui/formatting.js');
const { getCopy } = require('../js/i18n/translations.js');

test('formats money and signed values without changing current output', () => {
  const ar = createFormatting('ar');
  const en = createFormatting('en');

  assert.equal(en.formatMoney(1234.5), '1,234.50');
  assert.equal(en.formatInput(518.4307884191262, 2), '518.43');
  assert.equal(en.formatInput(0, 2), '');
  assert.equal(en.formatSignedMoney(30), '+30.00 SAR');
  assert.equal(en.formatSignedMoney(-30), '−30.00 SAR');
  assert.equal(ar.formatSignedMoney(30), '+30.00 ر.س');
  assert.equal(en.formatSignedPercent(3), '+3.00%');
  assert.equal(en.formatSignedPercent(-3), '−3.00%');
});

test('formats source labels and invalid live timestamps consistently', () => {
  const formatting = createFormatting('en');
  assert.equal(formatting.sourceDisplayName('gold-api'), 'Gold API');
  assert.equal(formatting.sourceDisplayName('xaus'), 'XAUS');
  assert.equal(formatting.sourceDisplayName('other'), 'other');
  assert.equal(formatting.sourceDisplayName(''), '—');
  assert.equal(formatting.formatLiveTime('not-a-date'), '—');
});

test('Arabic and English dynamic copy expose the same contract', () => {
  const ar = getCopy('ar');
  const en = getCopy('en');
  assert.deepEqual(Object.keys(ar).sort(), Object.keys(en).sort());
  assert.deepEqual(Object.keys(ar.statuses).sort(), Object.keys(en.statuses).sort());
  assert.deepEqual(Object.keys(ar.buyLabels).sort(), Object.keys(en.buyLabels).sort());
  assert.deepEqual(Object.keys(ar.sellLabels).sort(), Object.keys(en.sellLabels).sort());

  for (const key of [
    'liveMode',
    'ounceMode',
    'ounceSarMode',
    'gramSarMode',
    'needPrice',
    'liveLoading',
    'liveReady',
    'liveStale',
    'liveCached',
    'liveUnavailable',
    'lastUpdated',
    'source',
    'buyHelp',
    'sellHelp',
    'buyQuoteLabel',
    'sellQuoteLabel',
    'comparePrompt',
  ]) {
    assert.equal(typeof ar[key], 'string');
    assert.equal(typeof en[key], 'string');
    assert.notEqual(ar[key].length, 0);
    assert.notEqual(en[key].length, 0);
  }
});

test('unsupported locale falls back to English dynamic copy', () => {
  assert.equal(getCopy('fr').liveReady, getCopy('en').liveReady);
});

test('dynamic copy excludes static or retired UI keys', () => {
  for (const locale of ['ar', 'en']) {
    const copy = getCopy(locale);
    assert.equal('manualMode' in copy, false);
    assert.equal('refresh' in copy, false);
    assert.equal('note' in copy, false);
  }
});
