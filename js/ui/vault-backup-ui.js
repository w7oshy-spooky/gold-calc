(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldVaultBackupUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Wires the vault backup export / restore buttons.
  function createVaultBackupUI({
    document,
    elements,
    vaultStore,
    copy,
    label,
    render,
    onChange,
    saveFile = (options) => globalThis.GoldNativeFile.saveFile(options),
  }) {
    // Backup Export
    if (elements.exportBackupBtn && vaultStore) {
      elements.exportBackupBtn.addEventListener('click', async () => {
        try {
          const pieces = await vaultStore.getAllPieces();
          if (!pieces || pieces.length === 0) {
            if (elements.backupStatus) {
              elements.backupStatus.textContent = copy.vaultLabels?.backupEmpty || 'الخزانة فارغة لا توجد قطع لتصديرها';
              elements.backupStatus.className = 'text-[10px] text-center text-amber-400 font-bold mt-1.5 min-h-[1rem]';
            }
            return;
          }

          const backupJson = await vaultStore.exportBackup();
          const dateStr = new Date().toISOString().slice(0, 10);
          const result = await saveFile({
            filename: `gold-vault-backup-${dateStr}.json`,
            text: backupJson,
            mimeType: 'application/json;charset=utf-8',
            title: label('backupShareTitle', 'نسخة الخزانة الاحتياطية'),
            document,
          });
          if (result.cancelled) return;

          if (elements.backupStatus) {
            elements.backupStatus.textContent = copy.vaultLabels?.backupExported || 'تم تصدير النسخة الاحتياطية بنجاح ✓';
            elements.backupStatus.className = 'text-[10px] text-center text-emerald-400 font-bold mt-1.5 min-h-[1rem]';
            setTimeout(() => {
              if (elements.backupStatus) elements.backupStatus.textContent = '';
            }, 4000);
          }
        } catch (err) {
          if (elements.backupStatus) {
            elements.backupStatus.textContent = label('backupFailed', 'حدث خطأ أثناء تصدير النسخة ⚠️');
            elements.backupStatus.className = 'text-[10px] text-center text-rose-400 font-bold mt-1.5 min-h-[1rem]';
          }
        }
      });
    }

    // Backup Import
    if (elements.importBackupInput && vaultStore) {
      elements.importBackupInput.addEventListener('change', async () => {
        const file = elements.importBackupInput.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const content = e.target.result;
            const imported = await vaultStore.importBackup(content, { merge: true });
            await render();
            onChange({ type: 'vault-imported', count: imported.length });

            if (elements.backupStatus) {
              const template = copy.vaultLabels?.backupRestored || 'تمت استعادة {count} قطعة بنجاح ✓';
              elements.backupStatus.textContent = template.replace('{count}', imported.length);
              elements.backupStatus.className = 'text-[10px] text-center text-emerald-400 font-bold mt-1.5 min-h-[1rem]';
              setTimeout(() => {
                if (elements.backupStatus) elements.backupStatus.textContent = '';
              }, 4000);
            }
          } catch (err) {
            if (elements.backupStatus) {
              elements.backupStatus.textContent = copy.vaultLabels?.backupInvalid || 'ملف النسخة الاحتياطية غير صالح أو تالف ⚠️';
              elements.backupStatus.className = 'text-[10px] text-center text-rose-400 font-bold mt-1.5 min-h-[1rem]';
            }
          } finally {
            elements.importBackupInput.value = '';
          }
        };
        reader.readAsText(file);
      });
    }
  }

  return { createVaultBackupUI };
});
