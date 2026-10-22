(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldTransactionUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULTS = Object.freeze({
    mode: 'buy', karat: 21, weight: '15', workmanship: '35', profit: '0', tax: 15, deduction: 0,
  });
  // Chip and stepper targets map to the field that holds their value.
  const TARGET_IDS = Object.freeze({ weight: 'weight', workmanship: 'workmanship', profit: 'profit', tax: 'taxRange' });

  const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

  // Accepts Arabic-Indic and Persian digits and Arabic separators, keeping a single decimal point.
  function normalizeNumberText(value) {
    const text = String(value ?? '')
      .replace(/[٠-٩]/g, (d) => ARABIC_DIGITS.indexOf(d))
      .replace(/[۰-۹]/g, (d) => PERSIAN_DIGITS.indexOf(d))
      .replace(/[٫،,]/g, '.')
      .replace(/[^0-9.]/g, '');
    const [whole, ...rest] = text.split('.');
    return rest.length ? `${whole}.${rest.join('')}` : whole;
  }

  function parseNumber(value) {
    const n = Number.parseFloat(normalizeNumberText(value));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function createTransactionUI({ document, core, priceConverter, onChange = () => {} }) {
    const requireElement = (id) => {
      const element = document.getElementById(id);
      if (!element) throw new Error(`Missing required transaction UI element #${id}`);
      return element;
    };

    const elements = {
      transactionMode: requireElement('transactionMode'),
      weight: requireElement('weight'),
      karat: requireElement('karat'),
      workmanship: requireElement('workmanship'),
      profit: requireElement('profit'),
      taxRange: requireElement('taxRange'),
      sellDeduction: requireElement('sellDeduction'),
      buyCostsPanel: requireElement('buyCostsPanel'),
      sellDeductionPanel: requireElement('sellDeductionPanel'),
      taxValueLabel: requireElement('taxValueLabel'),
      sellDeductionLabel: requireElement('sellDeductionLabel'),
    };
    const modeButtons = Array.from(document.querySelectorAll('.mode-btn'));
    const karatButtons = Array.from(document.querySelectorAll('.karat-btn'));
    const chipButtons = Array.from(document.querySelectorAll('[data-set-target]'));
    const adjustButtons = Array.from(document.querySelectorAll('[data-adjust-target]'));
    const fieldFor = (target) => elements[TARGET_IDS[target]];
    const roundTwo = (n) => Math.round(n * 100) / 100;

    function setMode(mode) {
      const safeMode = core.normalizeMode(mode);
      elements.transactionMode.value = safeMode;
      const buying = safeMode === 'buy';
      elements.buyCostsPanel.hidden = !buying;
      elements.sellDeductionPanel.hidden = buying;
      modeButtons.forEach((button) => {
        const active = button.dataset.mode === safeMode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      return safeMode;
    }

    function setKarat(karat) {
      const safeKarat = priceConverter.normalizeKarat(karat);
      elements.karat.value = String(safeKarat);
      karatButtons.forEach((button) => {
        const active = Number(button.dataset.val) === safeKarat;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      return safeKarat;
    }

    function getTransactionInput() {
      return {
        mode: core.normalizeMode(elements.transactionMode.value),
        weight: parseNumber(elements.weight.value),
        karat: priceConverter.normalizeKarat(elements.karat.value),
        workmanshipPerGram: parseNumber(elements.workmanship.value),
        profitPerGram: parseNumber(elements.profit.value),
        taxRate: core.clampTaxRate(elements.taxRange.value),
        deductionRate: Math.min(30, core.clampPercent(elements.sellDeduction.value)),
      };
    }

    // Keeps the percent labels and the highlighted chips in step with the current values.
    function renderInputLabels() {
      const input = getTransactionInput();
      elements.taxValueLabel.textContent = `${input.taxRate}%`;
      elements.sellDeductionLabel.textContent = `${input.deductionRate}%`;
      chipButtons.forEach((chip) => {
        const field = fieldFor(chip.dataset.setTarget);
        const active = parseNumber(field.value) === Number(chip.dataset.setValue);
        chip.classList.toggle('active', active);
        chip.setAttribute('aria-pressed', String(active));
      });
    }

    function applyInput(input = {}) {
      const has = (key) => input[key] !== undefined && input[key] !== null;
      setMode(input.mode || DEFAULTS.mode);
      setKarat(input.karat || DEFAULTS.karat);
      if (has('weight')) elements.weight.value = String(roundTwo(Number(input.weight)));
      if (has('workmanshipPerGram')) elements.workmanship.value = String(roundTwo(Number(input.workmanshipPerGram)));
      if (has('profitPerGram')) elements.profit.value = String(roundTwo(Number(input.profitPerGram)));
      if (has('taxRate')) elements.taxRange.value = String(core.clampTaxRate(input.taxRate));
      if (has('deductionRate')) elements.sellDeduction.value = String(Math.min(30, core.clampPercent(input.deductionRate)));
      renderInputLabels();
    }

    function resetInput() {
      applyInput({
        mode: DEFAULTS.mode,
        karat: DEFAULTS.karat,
        weight: DEFAULTS.weight,
        workmanshipPerGram: DEFAULTS.workmanship,
        profitPerGram: DEFAULTS.profit,
        taxRate: DEFAULTS.tax,
        deductionRate: DEFAULTS.deduction,
      });
    }

    modeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        setMode(button.dataset.mode);
        renderInputLabels();
        onChange({ type: 'mode' });
      });
    });
    karatButtons.forEach((button) => {
      button.addEventListener('click', () => {
        setKarat(button.dataset.val);
        onChange({ type: 'karat' });
      });
    });
    chipButtons.forEach((chip) => {
      chip.addEventListener('click', () => {
        fieldFor(chip.dataset.setTarget).value = chip.dataset.setValue;
        renderInputLabels();
        onChange({ type: 'chip' });
      });
    });
    adjustButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const field = fieldFor(button.dataset.adjustTarget);
        const next = Math.max(0, roundTwo(parseNumber(field.value) + Number(button.dataset.adjustAmount)));
        field.value = String(next);
        renderInputLabels();
        onChange({ type: 'adjust' });
      });
    });
    for (const id of ['weight', 'workmanship', 'profit']) {
      const field = elements[id];
      field.addEventListener('input', () => {
        const cleaned = normalizeNumberText(field.value);
        if (cleaned !== field.value) field.value = cleaned;
        renderInputLabels();
        onChange({ type: 'input' });
      });
      field.addEventListener('focus', () => {
        if (typeof field.select === 'function') field.select();
      });
    }
    for (const id of ['taxRange', 'sellDeduction']) {
      elements[id].addEventListener('input', () => {
        renderInputLabels();
        onChange({ type: 'input' });
      });
    }

    resetInput();

    return {
      getTransactionInput,
      setTransactionMode: setMode,
      setKarat,
      applyInput,
      resetInput,
      renderInputLabels,
    };
  }

  return { DEFAULTS, normalizeNumberText, parseNumber, createTransactionUI };
});
