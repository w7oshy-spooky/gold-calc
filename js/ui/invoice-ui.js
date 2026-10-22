(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldInvoiceUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createInvoiceUI({
    document,
    copy,
    formatting,
    onAdd = () => {},
    onRemove = () => {},
    onClear = () => {},
  }) {
    const requireElement = (id) => {
      const element = document.getElementById(id);
      if (!element) throw new Error(`Missing required invoice UI element #${id}`);
      return element;
    };

    const elements = {
      addToInvoice: requireElement('addToInvoice'),
      clearInvoice: requireElement('clearInvoice'),
      invoicePanel: requireElement('invoicePanel'),
      invoiceCount: requireElement('invoiceCount'),
      invoiceList: requireElement('invoiceList'),
      invoiceNetLabel: requireElement('invoiceNetLabel'),
      invoiceNet: requireElement('invoiceNet'),
    };

    function renderLine(line, index) {
      const item = document.createElement('li');
      item.className = 'invoice-line';
      item.dataset.mode = line.mode;

      const details = document.createElement('span');
      details.className = 'invoice-line-details';
      const modeLabel = line.mode === 'sell' ? copy.invoiceSell : copy.invoiceBuy;
      details.textContent = `${modeLabel} · ${line.weight}${copy.invoiceGramUnit === 'g' ? 'g' : ` ${copy.invoiceGramUnit}`} · ${line.karat}K`;

      const amount = document.createElement('strong');
      amount.className = 'invoice-line-amount ltr';
      amount.textContent = `${line.mode === 'sell' ? '−' : ''}${formatting.formatMoney(line.total)}`;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'invoice-remove-btn';
      remove.textContent = '✕';
      remove.setAttribute('aria-label', `${copy.invoiceRemove} ${index + 1}`);
      remove.addEventListener('click', () => onRemove(index));

      item.append(details, amount, remove);
      return item;
    }

    // The invoice card only exists while it has pieces, as in the design.
    function render(invoice) {
      const hasItems = invoice.count > 0;
      elements.invoicePanel.hidden = !hasItems;
      elements.invoiceCount.textContent = String(invoice.count);
      elements.invoiceList.replaceChildren(...invoice.lines.map(renderLine));
      if (!hasItems) return;
      elements.invoiceNetLabel.textContent = invoice.net >= 0 ? copy.invoiceNetPay : copy.invoiceNetReceive;
      elements.invoiceNet.textContent = formatting.formatMoney(Math.abs(invoice.net));
    }

    elements.addToInvoice.addEventListener('click', () => onAdd());
    elements.clearInvoice.addEventListener('click', () => onClear());

    return { render };
  }

  return { createInvoiceUI };
});
