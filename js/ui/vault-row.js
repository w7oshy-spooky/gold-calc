(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldVaultRow = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[ch]);
  }

  // Only allow image data URLs inside src attributes.
  function safeImageSrc(value) {
    return /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value || '') ? value : '';
  }

  // HTML for one vault list row. All piece fields are escaped.
  function buildPieceRowHtml({ piece, currentVal, copy, formatting, label }) {
    const purchasePrice = Number(piece.purchasePrice) || 0;

    let profitLossHtml = '';
    if (purchasePrice > 0 && currentVal > 0) {
      const diff = currentVal - purchasePrice;
      const diffPct = ((diff / purchasePrice) * 100).toFixed(1);
      if (diff >= 0) {
        profitLossHtml = `<span class="block text-[10px] text-emerald-400 font-bold font-mono">▲ +${formatting.formatMoney(diff)} (+${diffPct}%)</span>`;
      } else {
        profitLossHtml = `<span class="block text-[10px] text-rose-400 font-bold font-mono">▼ -${formatting.formatMoney(Math.abs(diff))} (${diffPct}%)</span>`;
      }
    }

    const categoryBadge = piece.category === 'investment_gold'
      ? `<span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">${copy.vaultLabels?.investment || 'ادخار'}</span>`
      : `<span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">${copy.vaultLabels?.personal || 'زينة'}</span>`;

    let photoHtml = '';
    if (safeImageSrc(piece.imageDataUrl)) {
      photoHtml += `<img src="${safeImageSrc(piece.imageDataUrl)}" alt="${escapeHtml(piece.name)}" class="piece-thumbnail w-10 h-10 object-cover rounded-lg border border-amber-400/40 me-1.5 flex-shrink-0" title="${escapeHtml(label('viewPhotoHint', 'اضغط لعرض صورة القطعة'))}">`;
    } else {
      photoHtml += `<span class="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-700 text-amber-400 font-bold text-xs me-1.5 flex-shrink-0">${escapeHtml(piece.karat)}K</span>`;
    }

    if (piece.invoiceDataUrl) {
      photoHtml += `<button type="button" class="invoice-thumbnail-btn w-7 h-10 flex flex-col items-center justify-center rounded-md bg-slate-900 border border-amber-500/40 text-[9px] text-amber-300 font-bold me-2 hover:bg-slate-700 flex-shrink-0" title="${escapeHtml(label('viewInvoiceHint', 'اضغط لعرض الفاتورة'))}"><span>🧾</span><span class="text-[7px]">${escapeHtml(label('invoiceBadge', 'فاتورة'))}</span></button>`;
    }

    const dateStr = piece.purchaseDate ? `<span class="text-gray-400 text-[10px]"> · 📅 ${escapeHtml(piece.purchaseDate)}</span>` : '';
    const purchaseStr = purchasePrice > 0 ? `<span class="text-gray-400 text-[10px]"> · ${escapeHtml(label('rowPurchase', 'شراء: {amount}', { amount: formatting.formatMoney(purchasePrice) }))}</span>` : '';

    return `
      <div class="flex items-center min-w-0 flex-1">
        ${photoHtml}
        <div class="truncate ms-1">
          <div class="flex items-center gap-1.5">
            <p class="font-bold text-xs text-white truncate">${escapeHtml(piece.name)}</p>
            <span class="text-[10px] text-amber-400/80">👁️</span>
          </div>
          <p class="text-[10px] text-gray-400 truncate">${escapeHtml(label('rowWeightKarat', '{weight} {unit} · عيار {karat}', { weight: piece.weight, unit: copy.invoiceGramUnit || 'جرام', karat: piece.karat }))} ${categoryBadge}${dateStr}${purchaseStr}</p>
        </div>
      </div>
      <div class="text-end flex items-center gap-2 flex-shrink-0 ms-2">
        <div>
          <strong class="block text-xs font-mono text-amber-400 font-bold">${formatting.formatSar(currentVal)}</strong>
          ${profitLossHtml}
        </div>
        <button type="button" class="delete-vault-piece-btn text-gray-400 hover:text-red-400 p-1.5 text-xs rounded-lg hover:bg-rose-950/40" data-id="${escapeHtml(piece.id)}" aria-label="${escapeHtml(label('deletePiece', 'حذف القطعة'))}">✕</button>
      </div>
    `;
  }

  return { escapeHtml, safeImageSrc, buildPieceRowHtml };
});
