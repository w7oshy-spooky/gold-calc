'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { handleBack, setupBackButton } = require('../js/ui/native-back-button.js');

function fakeDocument(modals) {
  return { querySelectorAll: () => modals.filter((m) => !m.hidden) };
}
function fakeNav(tab) {
  return { DEFAULT_TAB: 'market', getActiveTab: () => tab, setActiveTab(t) { tab = t; this.set = t; } };
}

test('back closes the topmost open dialog first', () => {
  const a = { hidden: false };
  const b = { hidden: false };
  let exited = false;
  assert.equal(handleBack({ document: fakeDocument([a, b]), navigation: fakeNav('calc'), exitApp: () => { exited = true; } }), 'modal');
  assert.equal(b.hidden, true);
  assert.equal(a.hidden, false);
  assert.equal(exited, false);
});

test('back returns to the main tab, then exits', () => {
  const nav = fakeNav('vault');
  let exited = 0;
  const exitApp = () => { exited += 1; };
  assert.equal(handleBack({ document: fakeDocument([]), navigation: nav, exitApp }), 'tab');
  assert.equal(nav.set, 'market');
  assert.equal(handleBack({ document: fakeDocument([]), navigation: fakeNav('market'), exitApp }), 'exit');
  assert.equal(exited, 1);
});

test('setup does nothing outside the native app', () => {
  assert.equal(setupBackButton({ document: {}, capacitor: null }), false);
  assert.equal(setupBackButton({ document: {}, capacitor: { isNativePlatform: () => false } }), false);
});

test('setup registers a backButton listener in the native app', () => {
  const events = [];
  const capacitor = { isNativePlatform: () => true, Plugins: { App: { addListener: (n) => events.push(n), exitApp() {} } } };
  assert.equal(setupBackButton({ document: {}, capacitor }), true);
  assert.deepEqual(events, ['backButton']);
});
