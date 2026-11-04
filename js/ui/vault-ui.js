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
      categorySelect: el('vaultPieceCategory'),
      photoInput: el('vaultPiecePhoto'),
      photoPreview: el('vaultPhotoPreview'),
      status: el('vaultStatus'),
    };

    let currentPhotoDataUrl = null;

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

    if (elements.openModalBtn && elements.modal) {
      elements.openModalBtn.addEventListener('click', () => {
        resetForm();
        elements.modal.hidden = false;
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
        const category = elements.categorySelect?.value || 'personal_jewelry';

        await vaultStore.addPiece({
          name,
          karat,
          weight,
          purchasePrice,
          category,
          imageDataUrl: currentPhotoDataUrl,
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
      if (elements.karatSelect) elements.karatSelect.value = '21';
      if (elements.categorySelect) elements.categorySelect.value = 'personal_jewelry';
      if (elements.photoInput) elements.photoInput.value = '';
      if (elements.photoPreview) {
        elements.photoPreview.src = '';
        elements.photoPreview.hidden = true;
      }
      currentPhotoDataUrl = null;
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

            const photoHtml = piece.imageDataUrl
              ? `<img src="${piece.imageDataUrl}" alt="${piece.name}" class="w-10 h-10 object-cover rounded-lg border border-amber-400/40 me-2.5 flex-shrink-0">`
              : `<span class="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-700 text-amber-400 font-bold text-xs me-2.5 flex-shrink-0">${piece.karat}K</span>`;

            const purity = (piece.karat || 21) / 24;
            const currentVal = price24k > 0 ? (piece.weight * purity * price24k) : 0;
            const categoryBadge = piece.category === 'investment_gold'
              ? `<span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">${copy.vaultLabels?.investment || 'ادخار'}</span>`
              : `<span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">${copy.vaultLabels?.personal || 'زينة'}</span>`;

            li.innerHTML = `
              <div class="flex items-center min-w-0">
                ${photoHtml}
                <div class="truncate">
                  <p class="font-bold text-xs text-white truncate">${piece.name}</p>
                  <p class="text-[10px] text-gray-400">${piece.weight} ${copy.invoiceGramUnit || 'جرام'} · عيار ${piece.karat} ${categoryBadge}</p>
                </div>
              </div>
              <div class="text-end flex items-center gap-2 flex-shrink-0 ms-2">
                <div>
                  <strong class="block text-xs font-mono text-amber-400 font-bold">${formatting.formatSar(currentVal)}</strong>
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
