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
      karatPriceOutput: requireElement('karatPriceOutput'),
      selectedKaratLabel: requireElement('selectedKaratLabel'),
      summaryWeight: requireElement('summaryWeight'),
      summaryKarat: requireElement('summaryKarat'),
      summaryPrimaryLabel: requireElement('summaryPrimaryLabel'),
      summarySecondaryLabel: requireElement('summarySecondaryLabel'),
      summarySubtotalLabel: requireElement('summarySubtotalLabel'),
      finalAmountLabel: requireElement('finalAmountLabel'),
      summaryTaxRow: requireElement('summaryTaxRow'),
      goldCostOutput: requireElement('goldCostOutput'),
      laborCostOutput: requireElement('laborCostOutput'),
      subtotalOutput: requireElement('subtotalOutput'),
      vatOutput: requireElement('vatOutput'),
      finalTotalOutput: requireElement('finalTotalOutput'),
    };

    function render(result) {
      elements.karatPriceOutput.textContent = formatting.formatMoney(result.gramPrice);
      elements.selectedKaratLabel.textContent = result.karat;
      elements.summaryWeight.textContent = result.weight;
      elements.summaryKarat.textContent = result.karat;

      const selling = result.mode === 'sell';
      const labels = selling ? copy.sellLabels : copy.buyLabels;
      elements.summaryPrimaryLabel.textContent = labels.primary;
      elements.summarySecondaryLabel.textContent = labels.secondary;
      elements.summarySubtotalLabel.textContent = labels.subtotal;
      elements.finalAmountLabel.textContent = labels.final;
      elements.summaryTaxRow.hidden = selling;

      if (selling) {
        elements.goldCostOutput.textContent = formatting.formatMoney(result.rawMetalValue);
        elements.laborCostOutput.textContent = formatting.formatMoney(result.deductionValue);
        elements.subtotalOutput.textContent = formatting.formatMoney(result.total);
        elements.vatOutput.textContent = '0.00';
      } else {
        elements.goldCostOutput.textContent = formatting.formatMoney(result.goldCost);
        elements.laborCostOutput.textContent = formatting.formatMoney(result.laborCost);
        elements.subtotalOutput.textContent = formatting.formatMoney(result.subtotal);
        elements.vatOutput.textContent = formatting.formatMoney(result.vat);
      }

      elements.finalTotalOutput.textContent = formatting.formatMoney(result.total);
    }

    return { render };
  }

  return { createSummaryUI };
});
