(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldMarketUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SOURCES = Object.freeze(['live', 'ounce-usd', 'ounce-sar', 'gram-sar']);

  function createMarketUI({
    document,
    locale,
    copy,
    formatting,
    priceConverter,
    onChange = () => {},
    onRefresh = () => {},
  }) {
    const requireElement = (id) => {
      const element = document.getElementById(id);
      if (!element) throw new Error(`Missing required market UI element #${id}`);
      return element;
    };

    const elements = {
      priceSource: requireElement('priceSource'),
      ounceUsdInputPanel: requireElement('ounceUsdInputPanel'),
      ouncePriceUSD: requireElement('ouncePriceUSD'),
      ounceSarInputPanel: requireElement('ounceSarInputPanel'),
      ouncePriceSAR: requireElement('ouncePriceSAR'),
      gramSarInputPanel: requireElement('gramSarInputPanel'),
      gramPriceSAR: requireElement('gramPriceSAR'),
      gramInputKarat: requireElement('gramInputKarat'),
      marketPrice: requireElement('marketPrice'),
      priceModeHelp: requireElement('priceModeHelp'),
      priceWarning: requireElement('priceWarning'),
      marketEquivalentPanel: requireElement('marketEquivalentPanel'),
      equivalentOunceUSD: requireElement('equivalentOunceUSD'),
      equivalentOunceSAR: requireElement('equivalentOunceSAR'),
      equivalentGram24: requireElement('equivalentGram24'),
      equivalentGram22: requireElement('equivalentGram22'),
      equivalentGram21: requireElement('equivalentGram21'),
      equivalentGram18: requireElement('equivalentGram18'),
      livePricePanel: requireElement('livePricePanel'),
      liveRefresh: requireElement('liveRefresh'),
      livePriceStatus: requireElement('livePriceStatus'),
      liveUpdatedAt: requireElement('liveUpdatedAt'),
      liveKarat24: requireElement('liveKarat24'),
      liveKarat22: requireElement('liveKarat22'),
      liveKarat21: requireElement('liveKarat21'),
      liveKarat18: requireElement('liveKarat18'),
    };

    const sourceButtons = Array.from(document.querySelectorAll('.source-btn'));
    const gramKaratButtons = Array.from(document.querySelectorAll('.gram-karat-btn'));
    const sarLabel = locale === 'ar' ? 'ر.س' : 'SAR';
    const gramLabel = locale === 'ar' ? 'ر.س/ج' : 'SAR/g';

    function setPriceSource(source) {
      const safeSource = SOURCES.includes(source) ? source : 'live';
      elements.priceSource.value = safeSource;

      sourceButtons.forEach((button) => {
        const active = button.dataset.source === safeSource;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });

      const liveMode = safeSource === 'live';
      const ounceUsdMode = safeSource === 'ounce-usd';
      const ounceSarMode = safeSource === 'ounce-sar';
      const gramSarMode = safeSource === 'gram-sar';

      elements.ounceUsdInputPanel.hidden = !(liveMode || ounceUsdMode);
      elements.ounceSarInputPanel.hidden = !ounceSarMode;
      elements.gramSarInputPanel.hidden = !gramSarMode;
      elements.ouncePriceUSD.readOnly = liveMode;
      elements.marketPrice.readOnly = true;
      elements.livePricePanel.hidden = !liveMode;
      elements.priceModeHelp.textContent = liveMode
        ? copy.liveMode
        : ounceUsdMode
          ? copy.ounceMode
          : ounceSarMode
            ? copy.ounceSarMode
            : copy.gramSarMode;

      return safeSource;
    }

    function setGramInputKarat(value) {
      const karat = priceConverter.normalizeKarat(value);
      elements.gramInputKarat.value = karat;
      gramKaratButtons.forEach((button) => {
        const active = Number(button.dataset.gramKarat) === karat;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      return karat;
    }

    function getMarketInput() {
      return {
        source: elements.priceSource.value,
        ouncePriceUsd: elements.ouncePriceUSD.value,
        ouncePriceSar: elements.ouncePriceSAR.value,
        gramPriceSar: elements.gramPriceSAR.value,
        gramKarat: elements.gramInputKarat.value,
      };
    }

    function getPriceSource() {
      return elements.priceSource.value;
    }

    function renderMarketEquivalents(prices) {
      const available = prices.gram24kSar > 0;
      elements.marketEquivalentPanel.hidden = !available;

      if (!available) {
        elements.marketPrice.value = '';
        for (const element of [
          elements.equivalentOunceUSD,
          elements.equivalentOunceSAR,
          elements.equivalentGram24,
          elements.equivalentGram22,
          elements.equivalentGram21,
          elements.equivalentGram18,
        ]) {
          element.textContent = '—';
        }
        return;
      }

      elements.marketPrice.value = formatting.formatInput(prices.gram24kSar, 2);
      elements.equivalentOunceUSD.textContent = formatting.formatMoney(prices.ounceUsd);
      elements.equivalentOunceSAR.textContent = `${formatting.formatMoney(prices.ounceSar)} ${sarLabel}`;
      elements.equivalentGram24.textContent = `${formatting.formatMoney(prices.gram24kSar)} ${gramLabel}`;
      elements.equivalentGram22.textContent = `${formatting.formatMoney(prices.gram22kSar)} ${gramLabel}`;
      elements.equivalentGram21.textContent = `${formatting.formatMoney(prices.gram21kSar)} ${gramLabel}`;
      elements.equivalentGram18.textContent = `${formatting.formatMoney(prices.gram18kSar)} ${gramLabel}`;
    }

    function renderLiveKaratPrices(priceUsdOunce) {
      const prices = priceConverter.deriveMarketPrices({
        source: 'ounce-usd',
        ouncePriceUsd: priceUsdOunce,
      });
      elements.liveKarat24.textContent = `${formatting.formatMoney(prices.gram24kSar)} ${gramLabel}`;
      elements.liveKarat22.textContent = `${formatting.formatMoney(prices.gram22kSar)} ${gramLabel}`;
      elements.liveKarat21.textContent = `${formatting.formatMoney(prices.gram21kSar)} ${gramLabel}`;
      elements.liveKarat18.textContent = `${formatting.formatMoney(prices.gram18kSar)} ${gramLabel}`;
    }

    function renderLiveStatus(quote, state) {
      if (state === 'loading') {
        elements.livePriceStatus.textContent = copy.liveLoading;
        elements.livePriceStatus.dataset.state = 'loading';
        elements.liveUpdatedAt.textContent = '—';
      } else if (state === 'cached') {
        elements.livePriceStatus.textContent = copy.liveCached;
        elements.livePriceStatus.dataset.state = 'cached';
        elements.liveUpdatedAt.textContent =
          `${copy.lastUpdated}: ${formatting.formatLiveTime(quote.updatedAt)} · ${copy.source}: ${formatting.sourceDisplayName(quote.source)}`;
      } else if (state === 'error') {
        elements.livePriceStatus.textContent = copy.liveUnavailable;
        elements.livePriceStatus.dataset.state = 'error';
        elements.liveUpdatedAt.textContent = '—';
      } else {
        elements.livePriceStatus.textContent = quote?.stale ? copy.liveStale : copy.liveReady;
        elements.livePriceStatus.dataset.state = quote?.stale ? 'stale' : 'live';
        elements.liveUpdatedAt.textContent =
          `${copy.lastUpdated}: ${formatting.formatLiveTime(quote.updatedAt)} · ${copy.source}: ${formatting.sourceDisplayName(quote.source)}`;
      }

      const dot = elements.livePricePanel.querySelector('.live-dot');
      if (dot) dot.dataset.state = elements.livePriceStatus.dataset.state;
    }

    function setLiveQuoteInput(priceUsdOunce) {
      elements.ouncePriceUSD.value = formatting.formatInput(Number(priceUsdOunce), 2);
    }

    function clearLiveQuoteInput() {
      elements.ouncePriceUSD.value = '';
    }

    function setLiveRefreshDisabled(disabled) {
      elements.liveRefresh.disabled = Boolean(disabled);
    }

    function showWarning(message) {
      elements.priceWarning.textContent = message;
      elements.priceWarning.classList.add('warning-text');
    }

    function clearWarning() {
      elements.priceWarning.textContent = '';
      elements.priceWarning.classList.remove('warning-text');
    }

    function sanitizeMarketField(element) {
      const value = priceConverter.sanitizeNonNegative(element.value);
      if (element.value !== '') {
        const parsed = Number.parseFloat(element.value);
        if (!Number.isFinite(parsed) || parsed < 0) element.value = '0';
        else element.value = Number(value.toFixed(2)).toString();
      }
    }

    sourceButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const source = setPriceSource(button.dataset.source);
        onChange({ type: 'source', source });
      });
    });

    gramKaratButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const karat = setGramInputKarat(button.dataset.gramKarat);
        onChange({ type: 'gram-karat', karat });
      });
    });

    elements.liveRefresh.addEventListener('click', () => onRefresh());

    elements.ouncePriceUSD.addEventListener('input', () => {
      if (getPriceSource() === 'live') return;
      if (Number.parseFloat(elements.ouncePriceUSD.value) < 0) elements.ouncePriceUSD.value = '0';
      if (getPriceSource() === 'ounce-usd') onChange({ type: 'input', source: 'ounce-usd' });
    });

    elements.ouncePriceSAR.addEventListener('input', () => {
      if (Number.parseFloat(elements.ouncePriceSAR.value) < 0) elements.ouncePriceSAR.value = '0';
      if (getPriceSource() === 'ounce-sar') onChange({ type: 'input', source: 'ounce-sar' });
    });

    elements.gramPriceSAR.addEventListener('input', () => {
      if (Number.parseFloat(elements.gramPriceSAR.value) < 0) elements.gramPriceSAR.value = '0';
      if (getPriceSource() === 'gram-sar') onChange({ type: 'input', source: 'gram-sar' });
    });

    for (const [element, source] of [
      [elements.ouncePriceUSD, 'ounce-usd'],
      [elements.ouncePriceSAR, 'ounce-sar'],
      [elements.gramPriceSAR, 'gram-sar'],
    ]) {
      element.addEventListener('blur', () => {
        if (source === 'ounce-usd' && getPriceSource() === 'live') return;
        sanitizeMarketField(element);
        if (getPriceSource() === source) onChange({ type: 'blur', source });
      });
    }

    return {
      getMarketInput,
      getPriceSource,
      setPriceSource,
      setGramInputKarat,
      renderMarketEquivalents,
      renderLiveStatus,
      renderLiveKaratPrices,
      setLiveQuoteInput,
      clearLiveQuoteInput,
      setLiveRefreshDisabled,
      showWarning,
      clearWarning,
    };
  }

  return { SOURCES, createMarketUI };
});
