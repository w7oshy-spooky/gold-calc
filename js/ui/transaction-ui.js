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
    const adjustButtons = Array.from(document.querySelectorAll('[data-adjust-target][data-adjust-amount]'));
    const countryVatButtons = Array.from(document.querySelectorAll('.country-vat-btn'));
    const laborTaxButtons = Array.from(document.querySelectorAll('.tax-mode-btn'));
    const bullionNotice = document.getElementById ? document.getElementById('bullionNotice') : null;
    let invoiceActive = false;
    let currentCountry = 'sa';
    let lastJewelryTaxRate = 15;
    let currentLaborTaxMode = 'exclusive';

    function renderQuoteLabel() {
      const selling = elements.transactionMode.value === 'sell';
      elements.quotedTotalLabel.textContent = invoiceActive
        ? copy.invoiceQuoteLabel
        : selling ? copy.sellQuoteLabel : copy.buyQuoteLabel;
    }

    // With invoice items the shop quote is compared against the invoice net instead of one piece.
    function setInvoiceActive(active) {
      invoiceActive = Boolean(active);
      renderQuoteLabel();
    }

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
        country: currentCountry,
        laborTaxMode: currentLaborTaxMode,
        workmanshipTaxInclusive: currentLaborTaxMode === 'inclusive',
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
      renderQuoteLabel();

      return safeMode;
    }

    function syncCountryButtons(activeCountry) {
      countryVatButtons.forEach((btn) => {
        const active = btn.dataset.country === activeCountry;
        btn.classList.toggle('active', active);
        btn.classList.toggle('border-amber-400', active);
        btn.classList.toggle('bg-amber-400/10', active);
        btn.classList.toggle('text-amber-300', active);
        btn.classList.toggle('border-slate-700', !active);
        btn.classList.toggle('bg-slate-800', !active);
        btn.classList.toggle('text-slate-300', !active);
      });
    }

    function setCountry(countryCode) {
      currentCountry = (countryCode || 'sa').toLowerCase();
      const matchedBtn = countryVatButtons.find((btn) => btn.dataset.country === currentCountry);
      const rates = core.COUNTRY_VAT_RATES || { sa: 15, ae: 5, bh: 10, om: 5, kw: 0, qa: 0, eg: 14 };
      const rate = matchedBtn ? Number(matchedBtn.dataset.vat) : (rates[currentCountry] ?? 15);

      if (rate > 0) lastJewelryTaxRate = rate;

      if (Number(elements.karat.value) === 24) {
        setTaxRate(0);
        if (bullionNotice) bullionNotice.hidden = false;
      } else {
        setTaxRate(rate);
      }
      syncCountryButtons(currentCountry);
      return currentCountry;
    }

    function setTaxRate(rate) {
      const clamped = core.clampTaxRate(rate);
      elements.tax.value = clamped;
      elements.taxRange.value = clamped;
      renderInputLabels();
      return clamped;
    }

    function setLaborTaxMode(mode) {
      currentLaborTaxMode = mode === 'inclusive' ? 'inclusive' : 'exclusive';
      laborTaxButtons.forEach((btn) => {
        const active = btn.dataset.laborTax === currentLaborTaxMode;
        btn.classList.toggle('active', active);
        btn.classList.toggle('bg-amber-400', active);
        btn.classList.toggle('text-slate-900', active);
        btn.classList.toggle('text-gray-400', !active);
      });
      return currentLaborTaxMode;
    }

    function setKarat(value) {
      const karat = priceConverter.normalizeKarat(value);
      const previousKarat = Number(elements.karat.value);
      elements.karat.value = karat;
      karatButtons.forEach((button) => {
        const active = Number(button.dataset.val) === karat;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });

      if (karat === 24) {
        if (Number(elements.tax.value) > 0) {
          lastJewelryTaxRate = Number(elements.tax.value);
        }
        setTaxRate(0);
        if (bullionNotice) bullionNotice.hidden = false;
      } else {
        if (bullionNotice) bullionNotice.hidden = true;
        if (previousKarat === 24 && Number(elements.tax.value) === 0) {
          setTaxRate(lastJewelryTaxRate || 15);
        }
      }
      syncCountryButtons(currentCountry);

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
      element.value = Number(next.toFixed(2));
      return element.value;
    }

    function setNumericField(element, value) {
      const n = Number(value);
      if (value === undefined || value === null || !Number.isFinite(n) || n < 0) return;
      element.value = Number(n.toFixed(2));
    }

    function applyInput(values = {}) {
      if (values.mode !== undefined) setTransactionMode(values.mode);
      if (values.karat !== undefined) setKarat(values.karat);
      setNumericField(elements.weight, values.weight);
      setNumericField(elements.workmanship, values.workmanshipPerGram);
      setNumericField(elements.profit, values.profitPerGram);
      if (values.country !== undefined) {
        setCountry(values.country);
      } else {
        syncCountryButtons(currentCountry);
      }
      if (values.taxRate !== undefined) {
        const rate = core.clampTaxRate(values.taxRate);
        elements.tax.value = rate;
        elements.taxRange.value = rate;
        if (Number(elements.karat.value) !== 24 && rate > 0) lastJewelryTaxRate = rate;
      }
      if (values.laborTaxMode !== undefined) setLaborTaxMode(values.laborTaxMode);
      if (values.deductionRate !== undefined) {
        elements.sellDeduction.value = core.clampPercent(values.deductionRate);
      }
      if (values.quotedTotal !== undefined) elements.quotedTotal.value = values.quotedTotal;
    }

    // The static page markup carries the default values; capture them before any restore.
    const defaults = getTransactionInput();

    function resetInput() {
      applyInput(defaults);
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

    adjustButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.dataset.adjustTarget;
        const amount = Number(button.dataset.adjustAmount);
        if (!Number.isFinite(amount)) throw new Error(`Invalid adjustment amount for ${id}`);
        const value = adjust(id, amount);
        onChange({ type: 'adjust', id, value });
      });
    });

    elements.taxRange.addEventListener('input', (event) => {
      const rate = core.clampTaxRate(event.target.value);
      elements.tax.value = rate;
      if (Number(elements.karat.value) !== 24 && rate > 0) lastJewelryTaxRate = rate;
      onChange({ type: 'tax', rate });
    });

    countryVatButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const country = button.dataset.country || 'sa';
        setCountry(country);
        onChange({ type: 'country', country: currentCountry, rate: Number(elements.tax.value) });
      });
    });

    laborTaxButtons.forEach((button) => {
      button.addEventListener('click', () => {
        setLaborTaxMode(button.dataset.laborTax);
        onChange({ type: 'labor-tax-mode', mode: currentLaborTaxMode });
      });
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
      setCountry,
      setTaxRate,
      setLaborTaxMode,
      applyInput,
      resetInput,
      setInvoiceActive,
      renderInputLabels,
    };
  }

  return { createTransactionUI };
});
