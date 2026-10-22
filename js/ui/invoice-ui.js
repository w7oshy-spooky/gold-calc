(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldInvoiceUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STATUS_CLEAR_MS = 3000;

  function createInvoiceUI({
    document,
    copy,
    formatting,
    onAdd = () => {},
    onRemove = () => {},
    onClear = () => {},
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
  }) {
    const requireElement = (id) => {
      const element = document.getElementById(id);
      if (!element) throw new Error(`Missing required invoice UI element #${id}`);
      return element;
    };

    const elements = {
      addToInvoice: requireElement('addToInvoice'),
      clearInvoice: requireElement('clearInvoice'),
      invoiceStatus: requireElement('invoiceStatus'),
      invoiceCount: requireElement('invoiceCount'),
      invoiceEmpty: requireElement('invoiceEmpty'),
      invoiceList: requireElement('invoiceList'),
      invoiceTotals: requireElement('invoiceTotals'),
      invoiceBuyRow: requireElement('invoiceBuyRow'),
      invoiceBuyTotal: requireElement('invoiceBuyTotal'),
      invoiceSellRow: requireElement('invoiceSellRow'),
      invoiceSellTotal: requireElement('invoiceSellTotal'),
      invoiceNetLabel: requireElement('invoiceNetLabel'),
      invoiceNet: requireElement('invoiceNet'),
      summaryInvoiceRow: requireElement('summaryInvoiceRow'),
      summaryInvoiceLabel: requireElement('summaryInvoiceLabel'),
      summaryInvoiceNet: requireElement('summaryInvoiceNet'),
    };
    let statusTimer = null;

    function showStatus(message, state = 'ok') {
      elements.invoiceStatus.textContent = message;
      elements.invoiceStatus.dataset.state = state;
      if (statusTimer !== null) clearTimeoutImpl(statusTimer);
      statusTimer = setTimeoutImpl(() => {
        elements.invoiceStatus.textContent = '';
        statusTimer = null;
      }, STATUS_CLEAR_MS);
    }

    function netLabel(net) {
      return net >= 0 ? copy.invoiceNetPay : copy.invoiceNetReceive;
    }

    function renderLine(line, index) {
      const item = document.createElement('li');
      item.className = 'invoice-line';
      item.dataset.mode = line.mode;

      const details = document.createElement('span');
      details.className = 'invoice-line-details';
      const modeLabel = line.mode === 'sell' ? copy.invoiceSell : copy.invoiceBuy;
      details.textContent = `${index + 1}. ${modeLabel} · ${line.weight} ${copy.invoiceGramUnit} · ${copy.invoiceKarat} ${line.karat}`;

      const amount = document.createElement('strong');
      amount.className = 'invoice-line-amount';
      amount.textContent = `${line.mode === 'sell' ? '−' : ''}${formatting.formatSar(line.total)}`;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'invoice-remove-btn';
      remove.textContent = '✕';
      remove.setAttribute('aria-label', `${copy.invoiceRemove} ${index + 1}`);
      remove.addEventListener('click', () => onRemove(index));

      item.append(details, amount, remove);
      return item;
    }

    function render(invoice) {
      const hasItems = invoice.count > 0;
      elements.invoiceCount.textContent = String(invoice.count);
      elements.invoiceEmpty.hidden = hasItems;
      elements.invoiceTotals.hidden = !hasItems;
      elements.clearInvoice.disabled = !hasItems;
      elements.summaryInvoiceRow.hidden = !hasItems;
      elements.invoiceList.replaceChildren(...invoice.lines.map(renderLine));

      if (!hasItems) return;

      elements.invoiceBuyRow.hidden = invoice.buyTotal <= 0;
      elements.invoiceSellRow.hidden = invoice.sellTotal <= 0;
      elements.invoiceBuyTotal.textContent = formatting.formatSar(invoice.buyTotal);
      elements.invoiceSellTotal.textContent = `−${formatting.formatSar(invoice.sellTotal)}`;
      elements.invoiceNetLabel.textContent = netLabel(invoice.net);
      elements.invoiceNet.textContent = formatting.formatSar(Math.abs(invoice.net));
      elements.summaryInvoiceLabel.textContent = `${copy.invoiceTitle} (${invoice.count}) · ${netLabel(invoice.net)}`;
      elements.summaryInvoiceNet.textContent = formatting.formatMoney(Math.abs(invoice.net));
    }

    elements.addToInvoice.addEventListener('click', () => onAdd());
    elements.clearInvoice.addEventListener('click', () => onClear());

    return { render, showStatus };
  }

  return { createInvoiceUI };
});
