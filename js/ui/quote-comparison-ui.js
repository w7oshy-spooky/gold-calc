(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldQuoteComparisonUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createQuoteComparisonUI({ document, copy, formatting }) {
    const requireElement = (id) => {
      const element = document.getElementById(id);
      if (!element) throw new Error(`Missing required quote comparison UI element #${id}`);
      return element;
    };

    const status = requireElement('comparisonStatus');
    const difference = requireElement('comparisonDifference');
    const percent = requireElement('comparisonPercent');

    function render(comparison) {
      if (!comparison.available) {
        status.textContent = copy.comparePrompt;
        status.dataset.status = 'unavailable';
        difference.textContent = '—';
        percent.textContent = '—';
        return;
      }

      status.textContent = copy.statuses[comparison.status] || copy.comparePrompt;
      status.dataset.status = comparison.status;
      difference.textContent = formatting.formatSignedMoney(comparison.difference);
      percent.textContent = formatting.formatSignedPercent(comparison.differencePct);
    }

    return { render };
  }

  return { createQuoteComparisonUI };
});
