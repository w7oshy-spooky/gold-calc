const test = require('node:test');
const assert = require('node:assert/strict');

const { createTransactionUI } = require('../js/ui/transaction-ui.js');
const core = require('../gold-calculator.js');
const priceConverter = require('../js/core/price-converter.js');
const { getCopy } = require('../js/i18n/translations.js');

function fakeElement(attrs = {}) {
  const listeners = {};
  return {
    value: '',
    hidden: false,
    textContent: '',
    dataset: {},
    style: { setProperty() {} },
    classList: { toggle() {} },
    setAttribute() {},
    addEventListener: (type, fn) => { listeners[type] = fn; },
    click: () => listeners.click(),
    ...attrs,
  };
}

function setup() {
  const values = {
    transactionMode: 'buy', weight: '15', karat: '21', workmanship: '35', profit: '0',
    tax: '15', taxRange: '15', sellDeduction: '0', quotedTotal: '',
  };
  const elements = {};
  for (const id of [
    'transactionMode', 'weight', 'karat', 'workmanship', 'profit', 'tax', 'taxRange', 'sellDeduction',
    'quotedTotal', 'buyCostsPanel', 'vatPanel', 'sellDeductionPanel', 'transactionHelp', 'quotedTotalLabel',
    'workmanshipLabel', 'profitLabel', 'sellDeductionLabel', 'taxLabel', 'taxValueLabel',
  ]) {
    elements[id] = fakeElement({ id, value: values[id] ?? '' });
  }
  const adjustButtons = [
    fakeElement({ dataset: { adjustTarget: 'workmanship', adjustAmount: '5' } }),
    fakeElement({ dataset: { adjustTarget: 'profit', adjustAmount: '-1' } }),
  ];
  const document = {
    getElementById: (id) => elements[id],
    querySelectorAll: (selector) => (selector.startsWith('[data-adjust-target]') ? adjustButtons : []),
  };
  const ui = createTransactionUI({ document, core, priceConverter, copy: getCopy('en') });
  return { ui, elements, adjustButtons };
}

test('step buttons keep decimal values instead of rounding to whole riyals', () => {
  const { elements, adjustButtons } = setup();
  elements.workmanship.value = '37.5';
  adjustButtons[0].click();
  assert.equal(String(elements.workmanship.value), '42.5');

  elements.profit.value = '2.25';
  adjustButtons[1].click();
  assert.equal(String(elements.profit.value), '1.25');
});

test('restores saved inputs and resets to the page defaults', () => {
  const { ui, elements } = setup();
  ui.applyInput({
    mode: 'sell', karat: 18, weight: 7.256, workmanshipPerGram: 50, profitPerGram: 5, taxRate: 40, deductionRate: 4,
  });
  assert.equal(elements.transactionMode.value, 'sell');
  assert.equal(elements.karat.value, 18);
  assert.equal(String(elements.weight.value), '7.26');
  assert.equal(String(elements.workmanship.value), '50');
  assert.equal(elements.tax.value, 25);
  assert.equal(elements.taxRange.value, 25);
  assert.equal(elements.sellDeduction.value, 4);
  assert.equal(elements.buyCostsPanel.hidden, true);

  elements.quotedTotal.value = '9000';
  ui.resetInput();
  const input = ui.getTransactionInput();
  assert.equal(input.mode, 'buy');
  assert.equal(String(input.weight), '15');
  assert.equal(String(input.workmanshipPerGram), '35');
  assert.equal(String(input.taxRate), '15');
  assert.equal(input.quotedTotal, '');
  assert.equal(elements.buyCostsPanel.hidden, false);
});
