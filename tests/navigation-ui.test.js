const test = require('node:test');
const assert = require('node:assert/strict');
const navApi = require('../js/ui/navigation-ui.js');

function createMockElement(tagName = 'div', attrs = {}) {
  const element = {
    tagName,
    attributes: { ...attrs },
    classList: new Set(),
    listeners: {},
    dataset: {},
    setAttribute(name, val) { this.attributes[name] = String(val); },
    getAttribute(name) { return this.attributes[name] ?? null; },
    addEventListener(event, fn) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(fn);
    },
    click() {
      (this.listeners['click'] || []).forEach((fn) => fn());
    },
  };
  element.classList.toggle = function (cls, force) {
    if (force === undefined) {
      if (this.has(cls)) this.delete(cls); else this.add(cls);
    } else if (force) {
      this.add(cls);
    } else {
      this.delete(cls);
    }
  };
  return element;
}

test('navigation-ui initializes with default or stored tab and switches tabs', () => {
  const main = createMockElement('main');
  const btnAuditor = createMockElement('button');
  btnAuditor.dataset.tabTarget = 'auditor';
  const btnCalc = createMockElement('button');
  btnCalc.dataset.tabTarget = 'calc';
  const btnMarket = createMockElement('button');
  btnMarket.dataset.tabTarget = 'market';

  const doc = {
    querySelector: (sel) => (sel.includes('main') ? main : null),
    querySelectorAll: (sel) => (sel.includes('data-tab-target') ? [btnAuditor, btnCalc, btnMarket] : []),
  };

  const stored = {};
  const mockStorage = {
    get: (k) => stored[k],
    set: (k, v) => { stored[k] = v; },
  };

  let vibrateCalled = false;
  let changedTab = null;

  const nav = navApi.createNavigationUI({
    document: doc,
    preferencesStore: mockStorage,
    vibrate: () => { vibrateCalled = true; },
    onChange: (t) => { changedTab = t; },
  });

  // Default is auditor
  assert.equal(nav.getActiveTab(), 'auditor');
  assert.equal(main.getAttribute('data-active-tab'), 'auditor');
  assert.ok(btnAuditor.classList.has('active'));
  assert.ok(!btnCalc.classList.has('active'));

  // Switch to calc via click
  btnCalc.click();
  assert.equal(nav.getActiveTab(), 'calc');
  assert.equal(main.getAttribute('data-active-tab'), 'calc');
  assert.ok(!btnAuditor.classList.has('active'));
  assert.ok(btnCalc.classList.has('active'));
  assert.equal(stored['gold_active_tab'], 'calc');
  assert.equal(vibrateCalled, true);
  assert.equal(changedTab, 'calc');

  // Switch to market via setActiveTab
  nav.setActiveTab('market');
  assert.equal(nav.getActiveTab(), 'market');
  assert.equal(main.getAttribute('data-active-tab'), 'market');
  assert.ok(btnMarket.classList.has('active'));
});

test('navigation-ui falls back gracefully for invalid tab', () => {
  const main = createMockElement('main');
  const doc = {
    querySelector: () => main,
    querySelectorAll: () => [],
  };

  const nav = navApi.createNavigationUI({ document: doc });
  nav.setActiveTab('invalid_nonexistent_tab');
  assert.equal(nav.getActiveTab(), 'auditor');
  assert.equal(main.getAttribute('data-active-tab'), 'auditor');
});
