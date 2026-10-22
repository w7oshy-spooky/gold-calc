(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldMarketUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SOURCES = Object.freeze(['live', 'ounce-usd', 'ounce-sar', 'gram-sar']);
  // Each manual source keeps its own entry, so switching sources never loses what was typed.
  const MANUAL_FIELD = Object.freeze({ 'ounce-usd': 'ouncePriceUsd', 'ounce-sar': 'ouncePriceSar', 'gram-sar': 'gramPriceSar' });
  const UNIT_KEY = Object.freeze({ 'ounce-usd': 'ounceUsd', 'ounce-sar': 'ounceSar', 'gram-sar': 'gramSar' });
  const KARAT_CELLS = Object.freeze([24, 22, 21, 18]);

  function normalizeNumberText(value) {
    const text = String(value ?? '')
      .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .replace(/[٫،,]/g, '.')
      .replace(/[^0-9.]/g, '');
    const [whole, ...rest] = text.split('.');
    return rest.length ? `${whole}.${rest.join('')}` : whole;
  }

  function createMarketUI({ document, copy, formatting, priceConverter, onChange = () => {}, onRefresh = () => {} }) {
    const requireElement = (id) => {
      const element = document.getElementById(id);
      if (!element) throw new Error(`Missing required market UI element #${id}`);
      return element;
    };

    const elements = {
      priceSource: requireElement('priceSource'),
      livePricePanel: requireElement('livePricePanel'),
      liveRefresh: requireElement('liveRefresh'),
      livePriceStatus: requireElement('livePriceStatus'),
      liveUpdatedAt: requireElement('liveUpdatedAt'),
      manualPanel: requireElement('manualPanel'),
      manualUnit: requireElement('manualUnit'),
      manualPrice: requireElement('manualPrice'),
      gramKaratPanel: requireElement('gramKaratPanel'),
      gramInputKarat: requireElement('gramInputKarat'),
      priceWarning: requireElement('priceWarning'),
      equivOunceUsd: requireElement('equivOunceUsd'),
      equivOunceSar: requireElement('equivOunceSar'),
    };
    for (const karat of KARAT_CELLS) elements[`equivKarat${karat}`] = requireElement(`equivKarat${karat}`);

    const sourceButtons = Array.from(document.querySelectorAll('.source-btn'));
    const gramKaratButtons = Array.from(document.querySelectorAll('[data-gram-karat]'));
    const equivalentCells = Array.from(document.querySelectorAll('.price-cell[data-karat]'));

    const manual = { ouncePriceUsd: '', ouncePriceSar: '', gramPriceSar: '' };
    let liveUsd = 0;

    const toNumber = (text) => priceConverter.sanitizeNonNegative(normalizeNumberText(text));

    function getPriceSource() {
      return SOURCES.includes(elements.priceSource.value) ? elements.priceSource.value : 'live';
    }

    function showManualValue() {
      const field = MANUAL_FIELD[getPriceSource()];
      elements.manualPrice.value = field ? manual[field] : '';
    }

    function setPriceSource(source) {
      const safeSource = SOURCES.includes(source) ? source : 'live';
      const isLive = safeSource === 'live';
      elements.priceSource.value = safeSource;
      sourceButtons.forEach((button) => {
        const active = button.dataset.source === safeSource;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      elements.livePricePanel.hidden = !isLive;
      elements.manualPanel.hidden = isLive;
      elements.gramKaratPanel.hidden = safeSource !== 'gram-sar';
      if (!isLive) elements.manualUnit.textContent = copy.units[UNIT_KEY[safeSource]];
      if (!isLive) elements.manualPrice.placeholder = safeSource === 'gram-sar' ? elements.manualPrice.dataset.placeholder || '' : '';
      showManualValue();
      return safeSource;
    }

    function setGramInputKarat(karat) {
      const safeKarat = priceConverter.normalizeKarat(karat);
      elements.gramInputKarat.value = String(safeKarat);
      gramKaratButtons.forEach((button) => {
        const active = Number(button.dataset.gramKarat) === safeKarat;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      return safeKarat;
    }

    function getMarketInput() {
      const source = getPriceSource();
      return {
        source,
        // LIVE feeds the ounce-USD conversion with the latest quote.
        ouncePriceUsd: source === 'live' ? liveUsd : toNumber(manual.ouncePriceUsd),
        ouncePriceSar: toNumber(manual.ouncePriceSar),
        gramPriceSar: toNumber(manual.gramPriceSar),
        gramKarat: priceConverter.normalizeKarat(elements.gramInputKarat.value),
      };
    }

    // Only what the user typed: the live feed value is never persisted as a manual entry.
    function getManualValues() {
      return {
        ouncePriceUsd: toNumber(manual.ouncePriceUsd),
        ouncePriceSar: toNumber(manual.ouncePriceSar),
        gramPriceSar: toNumber(manual.gramPriceSar),
        gramKarat: priceConverter.normalizeKarat(elements.gramInputKarat.value),
      };
    }

    function setManualValue(field, value) {
      manual[field] = formatting.formatInput(Number(value), 2);
      showManualValue();
    }

    function applyManualInput(input = {}) {
      for (const field of Object.values(MANUAL_FIELD)) {
        manual[field] = input[field] > 0 ? formatting.formatInput(Number(input[field]), 2) : '';
      }
      setGramInputKarat(input.gramKarat || 24);
      showManualValue();
    }

    function resetManualInput() {
      applyManualInput({});
    }

    function setLiveQuoteInput(priceUsdOunce) {
      const price = Number(priceUsdOunce);
      liveUsd = Number.isFinite(price) && price > 0 ? price : 0;
    }

    function clearLiveQuoteInput() {
      liveUsd = 0;
    }

    function renderMarketEquivalents(prices, selectedKarat) {
      const money = (value) => (value > 0 ? formatting.formatMoney(value) : '—');
      elements.equivOunceUsd.textContent = money(prices.ounceUsd);
      elements.equivOunceSar.textContent = money(prices.ounceSar);
      elements.equivKarat24.textContent = money(prices.gram24kSar);
      elements.equivKarat22.textContent = money(prices.gram22kSar);
      elements.equivKarat21.textContent = money(prices.gram21kSar);
      elements.equivKarat18.textContent = money(prices.gram18kSar);
      equivalentCells.forEach((cell) => {
        cell.classList.toggle('selected', Number(cell.dataset.karat) === Number(selectedKarat));
      });
    }

    function renderLiveStatus(quote, state) {
      const status = elements.livePriceStatus;
      const updated = (q) => `${copy.lastUpdated}: ${formatting.formatLiveTime(q.updatedAt)} · ${copy.source}: ${formatting.sourceDisplayName(q.source)}`;
      if (state === 'loading') {
        status.textContent = copy.liveLoading;
        status.dataset.state = 'loading';
        elements.liveUpdatedAt.textContent = '';
      } else if (state === 'cached') {
        status.textContent = copy.liveCached;
        status.dataset.state = 'cached';
        elements.liveUpdatedAt.textContent = updated(quote);
      } else if (state === 'error') {
        status.textContent = copy.liveUnavailable;
        status.dataset.state = 'error';
        elements.liveUpdatedAt.textContent = '';
      } else {
        status.textContent = quote?.stale ? copy.liveStale : copy.liveReady;
        status.dataset.state = quote?.stale ? 'stale' : 'live';
        elements.liveUpdatedAt.textContent = updated(quote);
      }
      const dot = elements.livePricePanel.querySelector('.live-dot');
      if (dot) dot.dataset.state = status.dataset.state;
    }

    function setLiveRefreshDisabled(disabled) {
      elements.liveRefresh.disabled = Boolean(disabled);
    }

    function showWarning(message) {
      elements.priceWarning.textContent = message;
    }

    function clearWarning() {
      elements.priceWarning.textContent = '';
    }

    sourceButtons.forEach((button) => {
      button.addEventListener('click', () => onChange({ type: 'source', source: button.dataset.source }));
    });
    gramKaratButtons.forEach((button) => {
      button.addEventListener('click', () => {
        setGramInputKarat(button.dataset.gramKarat);
        onChange({ type: 'gram-karat' });
      });
    });
    elements.manualPrice.addEventListener('input', () => {
      const cleaned = normalizeNumberText(elements.manualPrice.value);
      if (cleaned !== elements.manualPrice.value) elements.manualPrice.value = cleaned;
      const field = MANUAL_FIELD[getPriceSource()];
      if (field) manual[field] = cleaned;
      onChange({ type: 'manual' });
    });
    elements.liveRefresh.addEventListener('click', () => onRefresh());

    setPriceSource(getPriceSource());
    setGramInputKarat(elements.gramInputKarat.value);

    return {
      getMarketInput,
      getManualValues,
      getPriceSource,
      setPriceSource,
      setGramInputKarat,
      setManualValue,
      applyManualInput,
      resetManualInput,
      renderMarketEquivalents,
      renderLiveStatus,
      setLiveQuoteInput,
      clearLiveQuoteInput,
      setLiveRefreshDisabled,
      showWarning,
      clearWarning,
    };
  }

  return { createMarketUI };
});
