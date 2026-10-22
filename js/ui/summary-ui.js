(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldSummaryUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createSummaryUI({ document, copy, formatting }) {
    const requireElement = (id) => {
      const element = document.getElementById(id);
      if (!element) throw new Error(`Missing required summary UI element #${id}`);
      return element;
    };

    const elements = {
      finalAmountLabel: requireElement('finalAmountLabel'),
      summaryWeight: requireElement('summaryWeight'),
      summaryKarat: requireElement('summaryKarat'),
      finalTotalOutput: requireElement('finalTotalOutput'),
      summaryRows: requireElement('summaryRows'),
    };

    function rowsFor(result) {
      const money = formatting.formatMoney;
      if (result.mode === 'sell') {
        const labels = copy.sellLabels;
        return [
          [labels.primary, money(result.rawMetalValue)],
          [`${labels.secondary} ${result.deductionRate}%`, `−${money(result.deductionValue)}`],
        ];
      }
      const labels = copy.buyLabels;
      return [
        [labels.primary, money(result.goldCost)],
        [labels.secondary, money(result.laborCost)],
        [`${labels.vat} ${result.taxRate}%`, money(result.vat)],
      ];
    }

    function render(result) {
      const labels = result.mode === 'sell' ? copy.sellLabels : copy.buyLabels;
      elements.finalAmountLabel.textContent = labels.final;
      elements.summaryWeight.textContent = result.weight;
      elements.summaryKarat.textContent = result.karat;
      elements.finalTotalOutput.textContent = formatting.formatMoney(result.total);

      elements.summaryRows.replaceChildren(
        ...rowsFor(result).map(([label, value]) => {
          const row = document.createElement('span');
          row.className = 'result-row';
          const name = document.createElement('span');
          name.className = 'result-row-label';
          name.textContent = label;
          const amount = document.createElement('span');
          amount.className = 'result-row-value ltr';
          amount.textContent = value;
          row.append(name, amount);
          return row;
        }),
      );
    }

    return { render, rowsFor };
  }

  return { createSummaryUI };
});
