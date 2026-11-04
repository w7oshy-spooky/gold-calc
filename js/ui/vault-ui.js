(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldVaultUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createVaultUI({
    document,
    vaultStore,
    core,
    formatting,
    copy,
    getPrice24k = () => 0,
    onChange = () => {},
  } = {}) {
    const el = (id) => document.getElementById(id);

    const elements = {
      section: el('vaultSection'),
      totalWeight: el('vaultTotalWeight'),
      marketValue: el('vaultMarketValue'),
      zakatNotice: el('vaultZakatNotice'),
      zakatAmount: el('vaultZakatAmount'),
      list: el('vaultList'),
      emptyMsg: el('vaultEmptyMsg'),
      openModalBtn: el('openVaultModalBtn'),
      modal: el('vaultItemModal'),
      closeModalBtn: el('closeVaultModalBtn'),
      saveBtn: el('saveVaultPieceBtn'),
      // Form inputs inside modal
      nameInput: el('vaultPieceName'),
      karatSelect: el('vaultPieceKarat'),
      weightInput: el('vaultPieceWeight'),
      priceInput: el('vaultPiecePrice'),
      dateInput: el('vaultPieceDate'),
      categorySelect: el('vaultPieceCategory'),
      photoInput: el('vaultPiecePhoto'),
      photoPreview: el('vaultPhotoPreview'),
      invoiceInput: el('vaultPieceInvoice'),
      invoicePreview: el('vaultInvoicePreview'),
      status: el('vaultStatus'),
    };

    let currentPhotoDataUrl = null;
    let currentInvoiceDataUrl = null;

    // Auto-select text on focus so user can immediately retype without cursor jumping
    [elements.weightInput, elements.priceInput].forEach((inp) => {
      if (!inp) return;
      inp.addEventListener('focus', () => {
        setTimeout(() => {
          try { inp.select(); } catch {}
        }, 10);
      });
    });

    if (elements.photoInput && elements.photoPreview) {
      elements.photoInput.addEventListener('change', () => {
        const file = elements.photoInput.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            currentPhotoDataUrl = e.target.result;
            elements.photoPreview.src = currentPhotoDataUrl;
            elements.photoPreview.hidden = false;
          };
          reader.readAsDataURL(file);
        } else {
          currentPhotoDataUrl = null;
          elements.photoPreview.hidden = true;
        }
      });
    }

    if (elements.invoiceInput && elements.invoicePreview) {
      elements.invoiceInput.addEventListener('change', () => {
        const file = elements.invoiceInput.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            currentInvoiceDataUrl = e.target.result;
            elements.invoicePreview.src = currentInvoiceDataUrl;
            elements.invoicePreview.hidden = false;
          };
          reader.readAsDataURL(file);
        } else {
          currentInvoiceDataUrl = null;
          elements.invoicePreview.hidden = true;
        }
      });
    }

    if (elements.openModalBtn && elements.modal) {
      elements.openModalBtn.addEventListener('click', () => {
        resetForm();
        elements.modal.hidden = false;
        setTimeout(() => {
          elements.weightInput?.focus();
        }, 50);
      });
    }

    if (elements.closeModalBtn && elements.modal) {
      elements.closeModalBtn.addEventListener('click', () => {
        elements.modal.hidden = true;
      });
    }

    if (elements.saveBtn && vaultStore) {
      elements.saveBtn.addEventListener('click', async () => {
        const weight = Number(elements.weightInput?.value) || 0;
        if (weight <= 0) {
          if (elements.status) elements.status.textContent = copy.invoiceNeedsWeight || 'أدخل وزنًا أكبر من صفر';
          return;
        }

        const name = elements.nameInput?.value || 'قطعة ذهب';
        const karat = Number(elements.karatSelect?.value) || 21;
        const purchasePrice = Number(elements.priceInput?.value) || 0;
        const purchaseDate = elements.dateInput?.value || '';
        const category = elements.categorySelect?.value || 'personal_jewelry';

        await vaultStore.addPiece({
          name,
          karat,
          weight,
          purchasePrice,
          purchaseDate,
          category,
          imageDataUrl: currentPhotoDataUrl,
          invoiceDataUrl: currentInvoiceDataUrl,
        });

        if (elements.modal) elements.modal.hidden = true;
        await render();
        onChange({ type: 'vault-update' });
      });
    }

    function resetForm() {
      if (elements.nameInput) elements.nameInput.value = '';
      if (elements.weightInput) elements.weightInput.value = '';
      if (elements.priceInput) elements.priceInput.value = '';
      if (elements.dateInput) elements.dateInput.value = '';
      if (elements.karatSelect) elements.karatSelect.value = '21';
      if (elements.categorySelect) elements.categorySelect.value = 'personal_jewelry';
      if (elements.photoInput) elements.photoInput.value = '';
      if (elements.photoPreview) {
        elements.photoPreview.src = '';
        elements.photoPreview.hidden = true;
      }
      if (elements.invoiceInput) elements.invoiceInput.value = '';
      if (elements.invoicePreview) {
        elements.invoicePreview.src = '';
        elements.invoicePreview.hidden = true;
      }
      currentPhotoDataUrl = null;
      currentInvoiceDataUrl = null;
      if (elements.status) elements.status.textContent = '';
    }

    async function render() {
      if (!vaultStore) return;
      const pieces = await vaultStore.getAllPieces();
      const price24k = typeof getPrice24k === 'function' ? getPrice24k() : 0;

      const zakatData = core.calculateZakat
        ? core.calculateZakat({ items: pieces, price24k, exemptPersonalUse: true, hawlMet: true })
        : { totalWeight: 0, zakatDueSar: 0, nisabReached: false };

      if (elements.totalWeight) {
        elements.totalWeight.textContent = `${zakatData.totalWeight.toFixed(2)} ${copy.invoiceGramUnit || 'جرام'}`;
      }

      if (elements.marketValue) {
        elements.marketValue.textContent = formatting.formatSar(zakatData.totalMarketValueSar || 0);
      }

      if (elements.zakatNotice) {
        if (zakatData.nisabReached) {
          elements.zakatNotice.hidden = false;
          if (elements.zakatAmount) {
            elements.zakatAmount.textContent = formatting.formatSar(zakatData.zakatDueSar || 0);
          }
        } else {
          elements.zakatNotice.hidden = true;
        }
      }

      if (elements.list && elements.emptyMsg) {
        if (pieces.length === 0) {
          elements.emptyMsg.hidden = false;
          elements.list.innerHTML = '';
        } else {
          elements.emptyMsg.hidden = true;
          elements.list.innerHTML = '';

          pieces.forEach((piece) => {
            const li = document.createElement('li');
            li.className = 'vault-piece-item flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 mb-2';

            const purity = (piece.karat || 21) / 24;
            const currentVal = price24k > 0 ? (piece.weight * purity * price24k) : 0;
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
            if (piece.imageDataUrl) {
              photoHtml += `<img src="${piece.imageDataUrl}" alt="${piece.name}" class="w-10 h-10 object-cover rounded-lg border border-amber-400/40 me-1.5 flex-shrink-0" title="صورة القطعة">`;
            } else {
              photoHtml += `<span class="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-700 text-amber-400 font-bold text-xs me-1.5 flex-shrink-0">${piece.karat}K</span>`;
            }

            if (piece.invoiceDataUrl) {
              photoHtml += `<a href="${piece.invoiceDataUrl}" target="_blank" rel="noopener" class="w-7 h-10 flex flex-col items-center justify-center rounded-md bg-slate-900 border border-amber-500/40 text-[9px] text-amber-300 font-bold me-2 hover:bg-slate-800 flex-shrink-0" title="عرض الفاتورة"><span>🧾</span><span class="text-[7px]">فاتورة</span></a>`;
            }

            const dateStr = piece.purchaseDate ? `<span class="text-gray-400 text-[10px]"> · 📅 ${piece.purchaseDate}</span>` : '';
            const purchaseStr = purchasePrice > 0 ? `<span class="text-gray-400 text-[10px]"> · شراء: ${formatting.formatMoney(purchasePrice)}</span>` : '';

            li.innerHTML = `
              <div class="flex items-center min-w-0">
                ${photoHtml}
                <div class="truncate">
                  <p class="font-bold text-xs text-white truncate">${piece.name}</p>
                  <p class="text-[10px] text-gray-400">${piece.weight} ${copy.invoiceGramUnit || 'جرام'} · عيار ${piece.karat} ${categoryBadge}${dateStr}${purchaseStr}</p>
                </div>
              </div>
              <div class="text-end flex items-center gap-2 flex-shrink-0 ms-2">
                <div>
                  <strong class="block text-xs font-mono text-amber-400 font-bold">${formatting.formatSar(currentVal)}</strong>
                  ${profitLossHtml}
                </div>
                <button type="button" class="delete-vault-piece-btn text-gray-400 hover:text-red-400 p-1 text-xs" data-id="${piece.id}" aria-label="حذف القطعة">✕</button>
              </div>
            `;

            const delBtn = li.querySelector('.delete-vault-piece-btn');
            if (delBtn) {
              delBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await vaultStore.deletePiece(piece.id);
                await render();
                onChange({ type: 'vault-delete', id: piece.id });
              });
            }

            elements.list.appendChild(li);
          });
        }
      }
    }

    return {
      render,
      resetForm,
    };
  }

  return { createVaultUI };
});
