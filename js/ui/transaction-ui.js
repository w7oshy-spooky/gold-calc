(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldTransactionUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createTransactionUI({
    document,
    core,
    priceConverter,
    copy,
    onChange = () => {},
  }) {
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
      tax: requireElement('tax'),
      taxRange: requireElement('taxRange'),
      sellDeduction: requireElement('sellDeduction'),
      quotedTotal: requireElement('quotedTotal'),
      buyCostsPanel: requireElement('buyCostsPanel'),
      vatPanel: requireElement('vatPanel'),
      sellDeductionPanel: requireElement('sellDeductionPanel'),
      transactionHelp: requireElement('transactionHelp'),
      quotedTotalLabel: requireElement('quotedTotalLabel'),
      workmanshipLabel: requireElement('workmanshipLabel'),
      profitLabel: requireElement('profitLabel'),
      sellDeductionLabel: requireElement('sellDeductionLabel'),
      taxLabel: requireElement('taxLabel'),
      taxValueLabel: requireElement('taxValueLabel'),
    };

    const modeButtons = Array.from(document.querySelectorAll('.mode-btn'));
    const karatButtons = Array.from(document.querySelectorAll('.karat-btn'));

    function getTransactionInput() {
      return {
        mode: elements.transactionMode.value,
        weight: elements.weight.value,
        karat: elements.karat.value,
        workmanshipPerGram: elements.workmanship.value,
        profitPerGram: elements.profit.value,
        taxRate: elements.tax.value,
        deductionRate: elements.sellDeduction.value,
        quotedTotal: elements.quotedTotal.value,
      };
    }

    function setTransactionMode(mode) {
      const safeMode = core.normalizeMode(mode);
      elements.transactionMode.value = safeMode;

      modeButtons.forEach((button) => {
        const active = button.dataset.mode === safeMode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });

      const selling = safeMode === 'sell';
      elements.buyCostsPanel.hidden = selling;
      elements.vatPanel.hidden = selling;
      elements.sellDeductionPanel.hidden = !selling;
      elements.transactionHelp.textContent = selling ? copy.sellHelp : copy.buyHelp;
      elements.quotedTotalLabel.textContent = selling ? copy.sellQuoteLabel : copy.buyQuoteLabel;

      return safeMode;
    }

    function setKarat(value) {
      const karat = priceConverter.normalizeKarat(value);
      elements.karat.value = karat;
      karatButtons.forEach((button) => {
        const active = Number(button.dataset.val) === karat;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      return karat;
    }

    function adjust(id, amount) {
      const element = {
        weight: elements.weight,
        workmanship: elements.workmanship,
        profit: elements.profit,
      }[id];
      if (!element) throw new Error(`Unsupported adjustable transaction field: ${id}`);

      const current = priceConverter.sanitizeNonNegative(element.value);
      const next = Math.max(0, current + amount);
      element.value = id === 'weight' ? Number(next.toFixed(2)) : Math.round(next);
      return element.value;
    }

    function renderInputLabels() {
      const workmanship = priceConverter.sanitizeNonNegative(elements.workmanship.value);
      const profit = priceConverter.sanitizeNonNegative(elements.profit.value);
      const deduction = core.clampPercent(elements.sellDeduction.value);
      const taxRate = core.clampTaxRate(elements.tax.value);

      elements.workmanshipLabel.textContent = workmanship;
      elements.profitLabel.textContent = profit;
      elements.sellDeductionLabel.textContent = deduction;
      elements.taxLabel.textContent = taxRate;
      elements.taxValueLabel.textContent = taxRate;
      elements.taxRange.style.setProperty('--pct', `${((taxRate / 25) * 100).toFixed(1)}%`);
    }

    function sanitizeVisibleField(element, decimals = null) {
      const value = priceConverter.sanitizeNonNegative(element.value);
      if (element.value !== '') {
        const parsed = Number.parseFloat(element.value);
        if (!Number.isFinite(parsed) || parsed < 0) element.value = '0';
        else if (decimals !== null) element.value = Number(value.toFixed(decimals)).toString();
      }
      return value;
    }

    modeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const mode = setTransactionMode(button.dataset.mode);
        onChange({ type: 'mode', mode });
      });
    });

    karatButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const karat = setKarat(button.dataset.val);
        onChange({ type: 'karat', karat });
      });
    });

    elements.taxRange.addEventListener('input', (event) => {
      const rate = core.clampTaxRate(event.target.value);
      elements.tax.value = rate;
      onChange({ type: 'tax', rate });
    });

    for (const element of [elements.weight, elements.workmanship, elements.profit, elements.quotedTotal]) {
      element.addEventListener('input', () => {
        if (Number.parseFloat(element.value) < 0) element.value = '0';
        onChange({ type: 'input', id: element.id });
      });
      element.addEventListener('blur', () => {
        sanitizeVisibleField(element, 2);
        onChange({ type: 'blur', id: element.id });
      });
    }

    elements.sellDeduction.addEventListener('input', () => {
      const rate = core.clampPercent(elements.sellDeduction.value);
      const parsed = Number.parseFloat(elements.sellDeduction.value);
      if (parsed < 0 || parsed > 100) elements.sellDeduction.value = rate;
      onChange({ type: 'deduction', rate });
    });

    elements.sellDeduction.addEventListener('blur', () => {
      elements.sellDeduction.value = core.clampPercent(elements.sellDeduction.value);
      onChange({ type: 'deduction-blur', rate: Number(elements.sellDeduction.value) });
    });

    return {
      getTransactionInput,
      setTransactionMode,
      setKarat,
      adjust,
      renderInputLabels,
    };
  }

  return { createTransactionUI };
});
