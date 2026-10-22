const test = require('node:test');
const assert = require('node:assert/strict');

const { createTransactionUI, parseNumber, normalizeNumberText } = require('../js/ui/transaction-ui.js');
const core = require('../gold-calculator.js');
const priceConverter = require('../js/core/price-converter.js');

function fakeElement(attrs = {}) {
  const listeners = {};
  return {
    value: '',
    hidden: false,
    textContent: '',
    dataset: {},
    classList: { toggle() {} },
    setAttribute() {},
    addEventListener: (type, fn) => { listeners[type] = fn; },
    click: () => listeners.click(),
    ...attrs,
  };
}

function setup() {
  const elements = {};
  for (const id of [
    'transactionMode', 'weight', 'karat', 'workmanship', 'profit', 'taxRange', 'sellDeduction',
    'buyCostsPanel', 'sellDeductionPanel', 'taxValueLabel', 'sellDeductionLabel',
  ]) {
    elements[id] = fakeElement({ id });
  }
  const adjustButtons = [
    fakeElement({ dataset: { adjustTarget: 'workmanship', adjustAmount: '5' } }),
    fakeElement({ dataset: { adjustTarget: 'profit', adjustAmount: '-1' } }),
  ];
  const chipButtons = [
    fakeElement({ dataset: { setTarget: 'weight', setValue: '20' } }),
    fakeElement({ dataset: { setTarget: 'tax', setValue: '5' } }),
  ];
  const document = {
    getElementById: (id) => elements[id],
    querySelectorAll(selector) {
      if (selector === '[data-adjust-target]') return adjustButtons;
      if (selector === '[data-set-target]') return chipButtons;
      return [];
    },
  };
  const changes = [];
  const ui = createTransactionUI({ document, core, priceConverter, onChange: (c) => changes.push(c.type) });
  return { ui, elements, adjustButtons, chipButtons, changes };
}

test('starts from the design defaults', () => {
  const { ui } = setup();
  assert.deepEqual(ui.getTransactionInput(), {
    mode: 'buy', weight: 15, karat: 21, workmanshipPerGram: 35, profitPerGram: 0, taxRate: 15, deductionRate: 0,
  });
});

test('accepts Arabic digits and separators', () => {
  assert.equal(normalizeNumberText('١٢٫٥'), '12.5');
  assert.equal(parseNumber('٣٥'), 35);
  assert.equal(parseNumber('abc'), 0);
});

test('step buttons keep decimal values instead of rounding to whole riyals', () => {
  const { elements, adjustButtons } = setup();
  elements.workmanship.value = '37.5';
  adjustButtons[0].click();
  assert.equal(elements.workmanship.value, '42.5');

  elements.profit.value = '2.25';
  adjustButtons[1].click();
  assert.equal(elements.profit.value, '1.25');
  adjustButtons[1].click();
  adjustButtons[1].click();
  assert.equal(elements.profit.value, '0');
});

test('preset chips write their value into the matching field', () => {
  const { elements, chipButtons, changes } = setup();
  chipButtons[0].click();
  chipButtons[1].click();
  assert.equal(elements.weight.value, '20');
  assert.equal(elements.taxRange.value, '5');
  assert.deepEqual(changes, ['chip', 'chip']);
});

test('restores saved inputs, caps VAT and deduction, and resets to the defaults', () => {
  const { ui, elements } = setup();
  ui.applyInput({
    mode: 'sell', karat: 18, weight: 7.256, workmanshipPerGram: 50, profitPerGram: 5, taxRate: 40, deductionRate: 80,
  });
  assert.equal(elements.transactionMode.value, 'sell');
  assert.equal(elements.karat.value, '18');
  assert.equal(elements.weight.value, '7.26');
  assert.equal(elements.taxRange.value, '25');
  assert.equal(elements.sellDeduction.value, '30');
  assert.equal(elements.buyCostsPanel.hidden, true);
  assert.equal(elements.sellDeductionPanel.hidden, false);
  assert.equal(elements.sellDeductionLabel.textContent, '30%');

  ui.resetInput();
  const input = ui.getTransactionInput();
  assert.equal(input.mode, 'buy');
  assert.equal(input.weight, 15);
  assert.equal(input.workmanshipPerGram, 35);
  assert.equal(input.taxRate, 15);
  assert.equal(elements.buyCostsPanel.hidden, false);
  assert.equal(elements.sellDeductionPanel.hidden, true);
});
