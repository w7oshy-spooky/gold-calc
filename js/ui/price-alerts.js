(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldPriceAlerts = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'gold_price_alerts';
  const KARATS = [24, 22, 21, 18];
  const DIRECTIONS = ['above', 'below'];
  const MAX_ALERTS = 5;

  function priceForKarat(price24k, karat) {
    return price24k * (karat / 24);
  }

  function sanitizeAlert(raw) {
    const karat = Number(raw && raw.karat);
    const target = Number(raw && raw.target);
    if (!KARATS.includes(karat) || !DIRECTIONS.includes(raw && raw.direction)) return null;
    if (!Number.isFinite(target) || target <= 0) return null;
    return {
      id: String(raw.id || `a${Date.now()}${Math.floor(Math.random() * 1000)}`),
      karat,
      direction: raw.direction,
      target: Math.round(target * 100) / 100,
      triggeredAt: Number(raw.triggeredAt) || 0,
    };
  }

  function loadAlerts(storage) {
    try {
      const parsed = JSON.parse((storage && storage.getItem(STORAGE_KEY)) || '[]');
      return Array.isArray(parsed) ? parsed.map(sanitizeAlert).filter(Boolean).slice(0, MAX_ALERTS) : [];
    } catch (_error) {
      return [];
    }
  }

  function saveAlerts(storage, alerts) {
    try {
      if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(alerts));
    } catch (_error) {
      // Storage can be unavailable.
    }
  }

  // Alerts that have not fired yet and whose condition is met at the current 24K gram price.
  function findTriggered(alerts, price24k) {
    if (!(price24k > 0)) return [];
    return alerts.filter((alert) => {
      if (alert.triggeredAt) return false;
      const price = priceForKarat(price24k, alert.karat);
      return alert.direction === 'above' ? price >= alert.target : price <= alert.target;
    });
  }

  function createPriceAlerts({
    document,
    storage = (() => { try { return globalThis.localStorage; } catch (_error) { return null; } })(),
    capacitor = typeof globalThis !== 'undefined' ? globalThis.Capacitor : null,
    labels = {},
    now = () => Date.now(),
  }) {
    const text = (key, fallback, vars = {}) => String(labels[key] || fallback)
      .replace(/\{(\w+)\}/g, (_m, name) => (name in vars ? vars[name] : `{${name}}`));
    const el = (id) => document.getElementById(id);
    const listEl = el('priceAlertList');
    const formEl = el('priceAlertForm');
    const karatEl = el('priceAlertKarat');
    const directionEl = el('priceAlertDirection');
    const targetEl = el('priceAlertTarget');
    const statusEl = el('priceAlertStatus');
    const toastEl = el('priceAlertToast');

    let alerts = loadAlerts(storage);
    let toastTimer = null;

    const isNative = Boolean(capacitor && typeof capacitor.isNativePlatform === 'function' && capacitor.isNativePlatform());
    const notifications = (isNative && capacitor.Plugins && capacitor.Plugins.LocalNotifications) || null;

    function describe(alert) {
      const key = alert.direction === 'above' ? 'alertAbove' : 'alertBelow';
      const fallback = alert.direction === 'above'
        ? 'عيار {karat} وصل إلى {target} ر.س/جرام أو أعلى'
        : 'عيار {karat} نزل إلى {target} ر.س/جرام أو أقل';
      return text(key, fallback, { karat: alert.karat, target: alert.target.toFixed(2) });
    }

    function render() {
      if (!listEl) return;
      listEl.innerHTML = '';
      alerts.forEach((alert) => {
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px]';
        const span = document.createElement('span');
        span.className = alert.triggeredAt ? 'text-gray-500 line-through' : 'text-gray-200';
        span.textContent = `${alert.triggeredAt ? '✓ ' : '🔔 '}${describe(alert)}`;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'text-rose-400 font-bold px-2';
        btn.textContent = '✕';
        btn.setAttribute('aria-label', text('alertRemove', 'حذف التنبيه'));
        btn.addEventListener('click', () => remove(alert.id));
        li.append(span, btn);
        listEl.appendChild(li);
      });
    }

    function remove(id) {
      alerts = alerts.filter((alert) => alert.id !== id);
      saveAlerts(storage, alerts);
      render();
    }

    async function ensureNotificationPermission() {
      if (!notifications) return;
      try {
        const current = await notifications.checkPermissions();
        if (current && current.display === 'prompt') await notifications.requestPermissions();
      } catch (_error) {
        // The in-app message still works without notification permission.
      }
    }

    async function add({ karat, direction, target }) {
      if (alerts.length >= MAX_ALERTS) return { ok: false, reason: 'limit' };
      const alert = sanitizeAlert({ karat, direction, target });
      if (!alert) return { ok: false, reason: 'invalid' };
      alerts.push(alert);
      saveAlerts(storage, alerts);
      render();
      await ensureNotificationPermission();
      return { ok: true, alert };
    }

    function showToast(message) {
      if (!toastEl) return;
      toastEl.textContent = message;
      toastEl.hidden = false;
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toastEl.hidden = true; }, 8000);
    }

    async function notify(message) {
      showToast(message);
      if (!notifications) return;
      try {
        await notifications.schedule({
          notifications: [{
            id: Math.floor(now() % 2147483647),
            title: text('alertTitle', 'تنبيه سعر الذهب'),
            body: message,
            schedule: { at: new Date(now() + 500) },
          }],
        });
      } catch (_error) {
        // Ignore: the in-app message was already shown.
      }
    }

    // Called with the current 24K gram price (SAR) every time a live quote arrives.
    function check(price24k) {
      const hits = findTriggered(alerts, price24k);
      if (!hits.length) return hits;
      hits.forEach((alert) => { alert.triggeredAt = now(); });
      saveAlerts(storage, alerts);
      render();
      notify(hits.map(describe).join(' • '));
      return hits;
    }

    function init() {
      if (formEl) {
        formEl.addEventListener('submit', async (event) => {
          event.preventDefault();
          const result = await add({
            karat: karatEl && karatEl.value,
            direction: directionEl && directionEl.value,
            target: targetEl && targetEl.value,
          });
          if (statusEl) {
            statusEl.textContent = result.ok ? ''
              : result.reason === 'limit'
                ? text('alertLimit', 'الحد الأقصى {max} تنبيهات', { max: MAX_ALERTS })
                : text('alertInvalid', 'أدخل سعرًا صحيحًا');
          }
          if (result.ok && targetEl) targetEl.value = '';
        });
      }
      render();
    }

    return { init, add, remove, check, render, getAlerts: () => alerts.slice() };
  }

  return { STORAGE_KEY, KARATS, MAX_ALERTS, priceForKarat, sanitizeAlert, loadAlerts, saveAlerts, findTriggered, createPriceAlerts };
});
