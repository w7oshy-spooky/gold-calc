(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldAppLock = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'gold_app_lock';
  const RELOCK_AFTER_MS = 30 * 1000;

  // Optional biometric / device-credential lock for the native app. The website never locks.
  function createAppLock({
    document,
    capacitor = typeof globalThis !== 'undefined' ? globalThis.Capacitor : null,
    storage = (() => { try { return globalThis.localStorage; } catch (_error) { return null; } })(),
    labels = {},
    now = () => Date.now(),
  }) {
    const isNative = Boolean(capacitor && typeof capacitor.isNativePlatform === 'function' && capacitor.isNativePlatform());
    const plugins = (isNative && capacitor.Plugins) || {};
    const auth = plugins.BiometricAuth || null;
    const text = (key, fallback) => labels[key] || fallback;

    const overlay = document.getElementById('appLockScreen');
    const unlockBtn = document.getElementById('appLockUnlockBtn');
    const titleEl = document.getElementById('appLockTitle');
    const toggleRow = document.getElementById('appLockToggleRow');
    const toggle = document.getElementById('appLockToggle');
    const toggleLabel = document.getElementById('appLockToggleLabel');
    const status = document.getElementById('appLockStatus');

    let hiddenAt = 0;
    let authenticating = false;

    function read() {
      try { return Boolean(storage && storage.getItem(STORAGE_KEY) === '1'); } catch (_error) { return false; }
    }
    function write(value) {
      try {
        if (!storage) return;
        if (value) storage.setItem(STORAGE_KEY, '1');
        else storage.removeItem(STORAGE_KEY);
      } catch (_error) {
        // Storage can be unavailable.
      }
    }

    async function biometryAvailable() {
      if (!auth || typeof auth.checkBiometry !== 'function') return false;
      try {
        const info = await auth.checkBiometry();
        return Boolean(info && (info.isAvailable || info.deviceIsSecure));
      } catch (_error) {
        return false;
      }
    }

    async function authenticate() {
      if (!auth || authenticating) return false;
      authenticating = true;
      try {
        await auth.authenticate({
          reason: text('lockReason', 'افتح حاسبة الذهب'),
          cancelTitle: text('lockCancel', 'إلغاء'),
          allowDeviceCredential: true,
          androidTitle: text('lockTitle', 'التطبيق مقفل'),
        });
        return true;
      } catch (_error) {
        return false;
      } finally {
        authenticating = false;
      }
    }

    function showOverlay(visible) {
      if (overlay) overlay.hidden = !visible;
    }

    async function unlock() {
      const ok = await authenticate();
      if (ok) showOverlay(false);
      return ok;
    }

    // Lock the screen (if the user turned the lock on) and ask to unlock right away.
    async function lock() {
      if (!isNative || !read()) return 'off';
      if (!(await biometryAvailable())) {
        // The phone has no screen lock any more: never trap the user outside their own data.
        write(false);
        showOverlay(false);
        return 'unavailable';
      }
      showOverlay(true);
      return (await unlock()) ? 'unlocked' : 'locked';
    }

    async function setEnabled(enabled) {
      if (!isNative) return false;
      if (enabled) {
        if (!(await biometryAvailable())) return false;
        if (!(await authenticate())) return false;
        write(true);
      } else {
        if (read() && !(await authenticate())) return true;
        write(false);
      }
      return read();
    }

    function onAppState(isActive) {
      if (!isNative || !read()) return;
      if (!isActive) {
        hiddenAt = now();
        return;
      }
      if (hiddenAt && now() - hiddenAt >= RELOCK_AFTER_MS) lock();
      hiddenAt = 0;
    }

    async function init() {
      if (!isNative) return 'web';
      if (titleEl) titleEl.textContent = text('lockTitle', 'التطبيق مقفل');
      if (unlockBtn) {
        unlockBtn.textContent = text('lockUnlock', 'فتح القفل');
        unlockBtn.addEventListener('click', () => { unlock(); });
      }
      const available = await biometryAvailable();
      if (toggleRow && available) {
        toggleRow.hidden = false;
        if (toggleLabel) toggleLabel.textContent = text('lockToggle', 'قفل التطبيق بالبصمة أو رمز الجهاز');
        if (toggle) {
          toggle.checked = read();
          toggle.addEventListener('change', async () => {
            const wanted = toggle.checked;
            const result = await setEnabled(wanted);
            toggle.checked = result;
            if (status) status.textContent = wanted && !result ? text('lockFailed', 'تعذر تفعيل القفل') : '';
          });
        }
      }
      if (plugins.App && typeof plugins.App.addListener === 'function') {
        plugins.App.addListener('appStateChange', (state) => onAppState(Boolean(state && state.isActive)));
      }
      return lock();
    }

    return { STORAGE_KEY, init, lock, unlock, setEnabled, onAppState, isEnabled: read };
  }

  return { STORAGE_KEY, RELOCK_AFTER_MS, createAppLock };
});
