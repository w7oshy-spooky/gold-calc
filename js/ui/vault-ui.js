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
    const rowApi = globalThis.GoldVaultRow;
    const { escapeHtml } = rowApi;
    const el = (id) => document.getElementById(id);

    // Looks up vault text in the active language; the Arabic fallback keeps tests with partial copy working.
    const label = (key, fallback, vars = {}) => String(copy.vaultLabels?.[key] ?? fallback)
      .replace(/\{(\w+)\}/g, (match, name) => (name in vars ? vars[name] : match));

    function readImage(file, maxSize) {
      if (globalThis.GoldImageResize) {
        return globalThis.GoldImageResize.resizeImageFile(file, { maxSize, document });
      }
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    }

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
      modalHeading: document.querySelector('#vaultItemModal h3'),
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
      photoStatus: el('vaultPhotoStatus'),
      invoiceInput: el('vaultPieceInvoice'),
      invoicePreview: el('vaultInvoicePreview'),
      invoiceStatus: el('vaultInvoiceStatus'),
      status: el('vaultStatus'),
      // Details Modal
      detailModal: el('vaultDetailModal'),
      closeDetailModalBtn: el('closeVaultDetailModalBtn'),
      detailTitle: el('vaultDetailTitle'),
      detailPhotosRow: el('vaultDetailPhotosRow'),
      detailPiecePhotoBox: el('vaultDetailPiecePhotoBox'),
      detailPieceImg: el('vaultDetailPieceImg'),
      detailInvoicePhotoBox: el('vaultDetailInvoicePhotoBox'),
      detailInvoiceImg: el('vaultDetailInvoiceImg'),
      detailWeightKarat: el('vaultDetailWeightKarat'),
      detailPureWeight: el('vaultDetailPureWeight'),
      detailMarketValue: el('vaultDetailMarketValue'),
      detailProfitLoss: el('vaultDetailProfitLoss'),
      detailPurchasePrice: el('vaultDetailPurchasePrice'),
      detailPurchaseDate: el('vaultDetailPurchaseDate'),
      detailCategory: el('vaultDetailCategory'),
      editPieceBtn: el('editVaultPieceBtn'),
      deletePieceBtn: el('deleteVaultPieceBtn'),
      // Image Viewer Modal
      imageViewerModal: el('imageViewerModal'),
      imageViewerTitle: el('imageViewerTitle'),
      imageViewerImg: el('imageViewerImg'),
      closeImageViewerBtn: el('closeImageViewerBtn'),
      // Delete Confirmation Modal
      deleteConfirmModal: el('deleteConfirmModal'),
      deleteConfirmText: el('deleteConfirmText'),
      cancelDeleteBtn: el('cancelDeleteBtn'),
      confirmDeleteBtn: el('confirmDeleteBtn'),
      // Backup & Restore
      exportBackupBtn: el('exportVaultBackupBtn'),
      importBackupInput: el('importVaultBackupInput'),
      backupStatus: el('vaultBackupStatus'),
    };

    let currentPhotoDataUrl = null;
    let currentInvoiceDataUrl = null;
    let editingPieceId = null;
    let activePiece = null;
    let pendingDeletePiece = null;

    // Auto-select text on focus so user can immediately retype without cursor jumping
    [elements.weightInput, elements.priceInput].forEach((inp) => {
      if (!inp) return;
      inp.addEventListener('focus', () => {
        setTimeout(() => {
          try { inp.select(); } catch {}
        }, 10);
      });
    });

    if (elements.photoInput) {
      elements.photoInput.addEventListener('change', () => {
        const file = elements.photoInput.files?.[0];
        if (file) {
          readImage(file, 1280).then((dataUrl) => {
            currentPhotoDataUrl = dataUrl;
            if (elements.photoPreview) {
              elements.photoPreview.src = currentPhotoDataUrl;
              elements.photoPreview.hidden = false;
            }
            if (elements.photoStatus) {
              elements.photoStatus.textContent = label('photoChosen', 'تم اختيار صورة ✓');
              elements.photoStatus.className = 'text-[9px] text-emerald-400 font-bold';
            }
          }).catch(() => {});
        } else {
          currentPhotoDataUrl = null;
          if (elements.photoPreview) elements.photoPreview.hidden = true;
          if (elements.photoStatus) {
            elements.photoStatus.textContent = label('tapToChoose', 'اضغط للاختيار');
            elements.photoStatus.className = 'text-[9px] text-amber-400';
          }
        }
      });
    }

    if (elements.invoiceInput) {
      elements.invoiceInput.addEventListener('change', () => {
        const file = elements.invoiceInput.files?.[0];
        if (file) {
          readImage(file, 1600).then((dataUrl) => {
            currentInvoiceDataUrl = dataUrl;
            if (elements.invoicePreview) {
              elements.invoicePreview.src = currentInvoiceDataUrl;
              elements.invoicePreview.hidden = false;
            }
            if (elements.invoiceStatus) {
              elements.invoiceStatus.textContent = label('invoiceChosen', 'تم اختيار فاتورة ✓');
              elements.invoiceStatus.className = 'text-[9px] text-emerald-400 font-bold';
            }
          }).catch(() => {});
        } else {
          currentInvoiceDataUrl = null;
          if (elements.invoicePreview) elements.invoicePreview.hidden = true;
          if (elements.invoiceStatus) {
            elements.invoiceStatus.textContent = label('tapToChoose', 'اضغط للاختيار');
            elements.invoiceStatus.className = 'text-[9px] text-amber-400';
          }
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

        const name = elements.nameInput?.value?.trim() || label('defaultName', 'قطعة ذهب');
        const karat = Number(elements.karatSelect?.value) || 21;
        const purchasePrice = Number(elements.priceInput?.value) || 0;
        const purchaseDate = elements.dateInput?.value || '';
        const category = elements.categorySelect?.value || 'personal_jewelry';

        if (editingPieceId) {
          await vaultStore.updatePiece(editingPieceId, {
            name,
            karat,
            weight,
            purchasePrice,
            purchaseDate,
            category,
            imageDataUrl: currentPhotoDataUrl,
            invoiceDataUrl: currentInvoiceDataUrl,
          });
        } else {
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
        }

        if (elements.modal) elements.modal.hidden = true;
        if (elements.detailModal) elements.detailModal.hidden = true;
        await render();
        onChange({ type: 'vault-update' });
      });
    }

    function resetForm({ piece = null } = {}) {
      editingPieceId = piece ? piece.id : null;
      if (elements.modalHeading) {
        elements.modalHeading.textContent = piece
          ? label('editPiece', 'تعديل قطعة الذهب')
          : label('addPiece', 'إضافة قطعة ذهب للخزانة');
      }
      if (elements.nameInput) elements.nameInput.value = piece?.name || '';
      if (elements.weightInput) elements.weightInput.value = piece ? (piece.weight || '') : '';
      if (elements.priceInput) elements.priceInput.value = piece ? (piece.purchasePrice || '') : '';
      if (elements.dateInput) elements.dateInput.value = piece?.purchaseDate || '';
      if (elements.karatSelect) elements.karatSelect.value = String(piece?.karat || 21);
      if (elements.categorySelect) elements.categorySelect.value = piece?.category || 'personal_jewelry';

      currentPhotoDataUrl = piece?.imageDataUrl || null;
      if (elements.photoPreview) {
        elements.photoPreview.src = currentPhotoDataUrl || '';
        elements.photoPreview.hidden = !currentPhotoDataUrl;
      }
      if (elements.photoStatus) {
        elements.photoStatus.textContent = currentPhotoDataUrl ? label('photoSaved', 'صورة محفوظة ✓') : label('tapToChoose', 'اضغط للاختيار');
        elements.photoStatus.className = currentPhotoDataUrl ? 'text-[9px] text-emerald-400 font-bold' : 'text-[9px] text-amber-400';
      }

      currentInvoiceDataUrl = piece?.invoiceDataUrl || null;
      if (elements.invoicePreview) {
        elements.invoicePreview.src = currentInvoiceDataUrl || '';
        elements.invoicePreview.hidden = !currentInvoiceDataUrl;
      }
      if (elements.invoiceStatus) {
        elements.invoiceStatus.textContent = currentInvoiceDataUrl ? label('invoiceSaved', 'فاتورة محفوظة ✓') : label('tapToChoose', 'اضغط للاختيار');
        elements.invoiceStatus.className = currentInvoiceDataUrl ? 'text-[9px] text-emerald-400 font-bold' : 'text-[9px] text-amber-400';
      }

      if (elements.status) elements.status.textContent = '';
    }

    function openImageViewer(src, title = label('imageViewerTitle', 'معاينة الصورة')) {
      if (!elements.imageViewerModal || !elements.imageViewerImg) return;
      elements.imageViewerImg.src = src;
      if (elements.imageViewerTitle) elements.imageViewerTitle.textContent = title;
      elements.imageViewerModal.hidden = false;
    }

    if (elements.closeImageViewerBtn && elements.imageViewerModal) {
      elements.closeImageViewerBtn.addEventListener('click', () => {
        elements.imageViewerModal.hidden = true;
        if (elements.imageViewerImg) elements.imageViewerImg.src = '';
      });
    }

    if (elements.closeDetailModalBtn && elements.detailModal) {
      elements.closeDetailModalBtn.addEventListener('click', () => {
        elements.detailModal.hidden = true;
        activePiece = null;
      });
    }

    if (elements.detailPiecePhotoBox) {
      elements.detailPiecePhotoBox.addEventListener('click', () => {
        if (activePiece?.imageDataUrl) {
          openImageViewer(activePiece.imageDataUrl, label('pieceImageTitle', 'صورة القطعة: {name}', { name: activePiece.name }));
        }
      });
    }

    if (elements.detailInvoicePhotoBox) {
      elements.detailInvoicePhotoBox.addEventListener('click', () => {
        if (activePiece?.invoiceDataUrl) {
          openImageViewer(activePiece.invoiceDataUrl, label('invoiceTitle', 'فاتورة: {name}', { name: activePiece.name }));
        }
      });
    }

    if (elements.editPieceBtn) {
      elements.editPieceBtn.addEventListener('click', () => {
        if (!activePiece) return;
        elements.detailModal.hidden = true;
        resetForm({ piece: activePiece });
        elements.modal.hidden = false;
      });
    }

    if (elements.deletePieceBtn) {
      elements.deletePieceBtn.addEventListener('click', () => {
        if (!activePiece) return;
        askDeletePiece(activePiece);
      });
    }

    function askDeletePiece(piece) {
      pendingDeletePiece = piece;
      if (!elements.deleteConfirmModal) {
        if (typeof window !== 'undefined' && window.confirm && window.confirm(label('deleteConfirm', 'هل أنت متأكد من حذف قطعة «{name}»؟', { name: piece.name }))) {
          executeDelete(piece.id);
        }
        return;
      }
      if (elements.deleteConfirmText) {
        elements.deleteConfirmText.textContent = label('deleteConfirmLong', 'هل أنت متأكد من حذف قطعة «{name}» من الخزانة؟ لا يمكن التراجع عن هذا الإجراء.', { name: piece.name });
      }
      elements.deleteConfirmModal.hidden = false;
    }

    async function executeDelete(id) {
      await vaultStore.deletePiece(id);
      if (elements.deleteConfirmModal) elements.deleteConfirmModal.hidden = true;
      if (elements.detailModal) elements.detailModal.hidden = true;
      pendingDeletePiece = null;
      activePiece = null;
      await render();
      onChange({ type: 'vault-delete', id });
    }

    if (elements.confirmDeleteBtn) {
      elements.confirmDeleteBtn.addEventListener('click', async () => {
        if (pendingDeletePiece) {
          await executeDelete(pendingDeletePiece.id);
        }
      });
    }

    if (elements.cancelDeleteBtn) {
      elements.cancelDeleteBtn.addEventListener('click', () => {
        if (elements.deleteConfirmModal) elements.deleteConfirmModal.hidden = true;
        pendingDeletePiece = null;
      });
    }

    // Dismiss on backdrop click
    [elements.modal, elements.detailModal, elements.imageViewerModal, elements.deleteConfirmModal].forEach((modal) => {
      if (!modal) return;
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.hidden = true;
        }
      });
    });

    globalThis.GoldVaultBackupUI.createVaultBackupUI({
      document,
      elements,
      vaultStore,
      copy,
      label,
      render: () => render(),
      onChange,
    });

    function openPieceDetails(piece, currentVal, purity) {
      activePiece = piece;
      if (!elements.detailModal) return;

      if (elements.detailTitle) elements.detailTitle.textContent = piece.name || label('detailTitle', 'تفاصيل القطعة');
      if (elements.detailWeightKarat) {
        elements.detailWeightKarat.textContent = label('detailWeightKarat', '{weight} جم · عيار {karat}', { weight: piece.weight, karat: piece.karat });
      }
      if (elements.detailPureWeight) {
        const pure24 = (piece.weight * purity).toFixed(2);
        elements.detailPureWeight.textContent = label('detailPureWeight', '(يعادل {pure} جم ذهب خالص 24K)', { pure: pure24 });
      }
      if (elements.detailMarketValue) {
        elements.detailMarketValue.textContent = formatting.formatSar(currentVal);
      }

      const purchasePrice = Number(piece.purchasePrice) || 0;
      if (elements.detailProfitLoss) {
        if (purchasePrice > 0 && currentVal > 0) {
          const diff = currentVal - purchasePrice;
          const diffPct = ((diff / purchasePrice) * 100).toFixed(1);
          if (diff >= 0) {
            elements.detailProfitLoss.textContent = label('profit', '▲ ربح: +{amount} ر.س (+{pct}%)', { amount: formatting.formatMoney(diff), pct: diffPct });
            elements.detailProfitLoss.className = 'block text-[11px] font-mono text-emerald-400 font-bold mt-0.5';
          } else {
            elements.detailProfitLoss.textContent = label('loss', '▼ انخفاض: -{amount} ر.س ({pct}%)', { amount: formatting.formatMoney(Math.abs(diff)), pct: diffPct });
            elements.detailProfitLoss.className = 'block text-[11px] font-mono text-rose-400 font-bold mt-0.5';
          }
          elements.detailProfitLoss.hidden = false;
        } else {
          elements.detailProfitLoss.textContent = '';
          elements.detailProfitLoss.hidden = true;
        }
      }

      if (elements.detailPurchasePrice) {
        elements.detailPurchasePrice.textContent = purchasePrice > 0 ? formatting.formatSar(purchasePrice) : label('notSpecified', 'غير محدد');
      }
      if (elements.detailPurchaseDate) {
        elements.detailPurchaseDate.textContent = piece.purchaseDate || label('notSpecified', 'غير محدد');
      }
      if (elements.detailCategory) {
        if (piece.category === 'investment_gold') {
          elements.detailCategory.innerHTML = `<span class="text-emerald-400 font-bold">${escapeHtml(label('investmentDetail', '💰 ادخار واستثمار (تجب الزكاة 2.5% إذا بلغ النصاب وحال الحول)'))}</span>`;
        } else {
          elements.detailCategory.innerHTML = `<span class="text-gray-300 font-bold">${escapeHtml(label('personalDetail', '💎 زينة شخصية (معفاة من الزكاة عند الجمهور)'))}</span>`;
        }
      }

      // Photos
      const hasPhoto = Boolean(piece.imageDataUrl);
      const hasInvoice = Boolean(piece.invoiceDataUrl);

      if (elements.detailPhotosRow) {
        elements.detailPhotosRow.hidden = !(hasPhoto || hasInvoice);
      }
      if (elements.detailPiecePhotoBox && elements.detailPieceImg) {
        if (hasPhoto) {
          elements.detailPieceImg.src = piece.imageDataUrl;
          elements.detailPiecePhotoBox.hidden = false;
        } else {
          elements.detailPiecePhotoBox.hidden = true;
        }
      }
      if (elements.detailInvoicePhotoBox && elements.detailInvoiceImg) {
        if (hasInvoice) {
          elements.detailInvoiceImg.src = piece.invoiceDataUrl;
          elements.detailInvoicePhotoBox.hidden = false;
        } else {
          elements.detailInvoicePhotoBox.hidden = true;
        }
      }

      elements.detailModal.hidden = false;
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
            li.className = 'vault-piece-item flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 mb-2 cursor-pointer hover:border-amber-400/50 hover:bg-slate-800 transition';

            const purity = (piece.karat || 21) / 24;
            const currentVal = price24k > 0 ? (piece.weight * purity * price24k) : 0;
            li.innerHTML = rowApi.buildPieceRowHtml({ piece, currentVal, copy, formatting, label });

            // Row click opens details
            li.addEventListener('click', (e) => {
              if (e.target.closest('.delete-vault-piece-btn')) return;
              if (e.target.closest('.invoice-thumbnail-btn')) {
                e.stopPropagation();
                if (piece.invoiceDataUrl) openImageViewer(piece.invoiceDataUrl, label('invoiceTitle', 'فاتورة: {name}', { name: piece.name }));
                return;
              }
              if (e.target.closest('.piece-thumbnail')) {
                e.stopPropagation();
                if (piece.imageDataUrl) openImageViewer(piece.imageDataUrl, label('pieceImageTitle', 'صورة القطعة: {name}', { name: piece.name }));
                return;
              }
              openPieceDetails(piece, currentVal, purity);
            });

            const delBtn = li.querySelector('.delete-vault-piece-btn');
            if (delBtn) {
              delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                askDeletePiece(piece);
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
