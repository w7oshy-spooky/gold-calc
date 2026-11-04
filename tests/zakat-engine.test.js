const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../gold-calculator.js');

test('calculateZakat returns zero when below Nisab', () => {
  // 100g 18k -> eq24 = 100 * 18/24 = 75g (< 85g Nisab)
  const items = [
    { weight: 100, karat: 18, category: 'investment_gold' },
  ];
  const result = core.calculateZakat({
    items,
    price24k: 400,
    exemptPersonalUse: false,
    hawlMet: true,
  });

  assert.equal(result.totalWeight, 100);
  assert.equal(result.zakatEligibleWeight24, 75);
  assert.equal(result.nisabReached, false);
  assert.equal(result.zakatDueSar, 0);
});

test('calculateZakat exempts personal jewelry when flag is true', () => {
  const items = [
    { weight: 120, karat: 21, category: 'personal_jewelry' },
  ];
  const result = core.calculateZakat({
    items,
    price24k: 400,
    exemptPersonalUse: true,
    hawlMet: true,
  });

  assert.equal(result.totalWeight, 120);
  assert.equal(result.zakatEligibleWeight24, 0);
  assert.equal(result.nisabReached, false);
  assert.equal(result.zakatDueSar, 0);
});

test('calculateZakat calculates exact 2.5% Zakat when Nisab is met and Hawl is met', () => {
  // 100g 21k -> eq24 = 100 * 21/24 = 87.5g (>= 85g Nisab)
  // Price 24k = 400 SAR
  // Zakat eligible value = 87.5 * 400 = 35,000 SAR
  // Zakat 2.5% = 35,000 * 0.025 = 875 SAR
  const items = [
    { weight: 100, karat: 21, category: 'investment_gold' },
  ];
  const result = core.calculateZakat({
    items,
    price24k: 400,
    exemptPersonalUse: true,
    hawlMet: true,
  });

  assert.equal(result.totalWeight, 100);
  assert.equal(result.zakatEligibleWeight24, 87.5);
  assert.equal(result.nisabReached, true);
  assert.equal(result.hawlMet, true);
  assert.equal(result.zakatDueGrams24, 87.5 * 0.025); // 2.1875g
  assert.equal(result.zakatDueSar, 875);
});

test('calculateZakat returns 0 SAR if Hawl is not met', () => {
  const items = [
    { weight: 100, karat: 21, category: 'investment_gold' },
  ];
  const result = core.calculateZakat({
    items,
    price24k: 400,
    exemptPersonalUse: true,
    hawlMet: false,
  });

  assert.equal(result.nisabReached, true);
  assert.equal(result.hawlMet, false);
  assert.equal(result.zakatDueSar, 0);
});
