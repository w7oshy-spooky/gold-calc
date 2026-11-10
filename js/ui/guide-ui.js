(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldGuideUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'gold_guide_seen';

  function createGuideUI({
    document = (typeof globalThis !== 'undefined' ? globalThis.document : null),
    window = (typeof globalThis !== 'undefined' ? globalThis.window : null),
    storage = null,
    vibrate = () => {},
    onSelectTab = () => {},
  } = {}) {
    if (!document) throw new Error('Document is required for GuideUI');

    const storageAdapter = storage || (window?.localStorage ? window.localStorage : null);

    const guideModal = document.getElementById('guideModal');
    const helpBtn = document.getElementById('helpBtn');
    const openGuideLink = document.getElementById('openGuideLink');
    const closeGuideModalBtn = document.getElementById('closeGuideModalBtn');
    const gotItGuideBtn = document.getElementById('gotItGuideBtn');
    const dontShowCheckbox = document.getElementById('dontShowGuideAgain');
    const guideActionBtns = Array.from(document.querySelectorAll('.guide-action-btn[data-guide-tab]'));

    function isSeen() {
      try {
        return Boolean(storageAdapter && storageAdapter.getItem(STORAGE_KEY));
      } catch {
        return false;
      }
    }

    function markSeen() {
      try {
        if (storageAdapter) storageAdapter.setItem(STORAGE_KEY, '1');
      } catch {}
    }

    function openGuide({ vibrate: shouldVibrate = false } = {}) {
      if (!guideModal) return;
      guideModal.hidden = false;
      if (shouldVibrate && typeof vibrate === 'function') vibrate();
    }

    function closeGuide({ persist = true } = {}) {
      if (!guideModal) return;
      guideModal.hidden = true;
      if (persist || (dontShowCheckbox && dontShowCheckbox.checked)) {
        markSeen();
      }
    }

    if (helpBtn) {
      helpBtn.addEventListener('click', () => {
        openGuide({ vibrate: true });
      });
    }

    if (openGuideLink) {
      openGuideLink.addEventListener('click', () => {
        openGuide({ vibrate: true });
      });
    }

    if (closeGuideModalBtn) {
      closeGuideModalBtn.addEventListener('click', () => {
        closeGuide({ persist: false });
      });
    }

    if (gotItGuideBtn) {
      gotItGuideBtn.addEventListener('click', () => {
        closeGuide({ persist: true });
      });
    }

    if (guideModal) {
      guideModal.addEventListener('click', (e) => {
        if (e.target === guideModal) {
          closeGuide({ persist: false });
        }
      });
    }

    guideActionBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-guide-tab');
        closeGuide({ persist: true });
        if (typeof onSelectTab === 'function' && tab) {
          onSelectTab(tab);
        }
      });
    });

    function checkAutoShow() {
      if (!isSeen() && guideModal) {
        if (window && typeof window.setTimeout === 'function') {
          window.setTimeout(() => {
            if (guideModal && guideModal.hidden) openGuide();
          }, 350);
        } else {
          openGuide();
        }
      }
    }

    checkAutoShow();

    return {
      STORAGE_KEY,
      isSeen,
      markSeen,
      openGuide,
      closeGuide,
      checkAutoShow,
    };
  }

  return { createGuideUI };
});
