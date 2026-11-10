'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const guideApi = require('../js/ui/guide-ui.js');

function createMockElement(id, attrs = {}) {
  const listeners = {};
  return {
    id,
    hidden: true,
    attributes: { ...attrs },
    listeners,
    getAttribute(name) { return this.attributes[name] ?? null; },
    setAttribute(name, val) { this.attributes[name] = String(val); },
    addEventListener(event, fn) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
    },
    click() {
      (listeners['click'] || []).forEach((fn) => fn({ target: this }));
    },
  };
}

test('guide-ui initializes, opens, closes, and respects storage', () => {
  const guideModal = createMockElement('guideModal');
  const helpBtn = createMockElement('helpBtn');
  const openGuideLink = createMockElement('openGuideLink');
  const closeGuideModalBtn = createMockElement('closeGuideModalBtn');
  const gotItGuideBtn = createMockElement('gotItGuideBtn');
  const dontShowGuideAgain = { checked: true };
  const actionBtn = createMockElement('actionBtn', { 'data-guide-tab': 'auditor' });
  actionBtn.classList = new Set(['guide-action-btn']);

  const elements = {
    guideModal,
    helpBtn,
    openGuideLink,
    closeGuideModalBtn,
    gotItGuideBtn,
    dontShowGuideAgain,
  };

  const doc = {
    getElementById: (id) => elements[id] || null,
    querySelectorAll: (sel) => (sel.includes('guide-action-btn') ? [actionBtn] : []),
  };

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
  };

  let vibrateCount = 0;
  let selectedTab = null;

  const guide = guideApi.createGuideUI({
    document: doc,
    window: { localStorage: mockStorage, setTimeout: (fn) => fn() },
    storage: mockStorage,
    vibrate: () => { vibrateCount += 1; },
    onSelectTab: (t) => { selectedTab = t; },
  });

  // Initially auto-shown because store is empty
  assert.equal(guide.isSeen(), false);
  assert.equal(guideModal.hidden, false);

  // Close via close button without marking seen if checkbox wasn't checked
  dontShowGuideAgain.checked = false;
  closeGuideModalBtn.click();
  assert.equal(guideModal.hidden, true);
  assert.equal(guide.isSeen(), false);

  // Open via helpBtn
  helpBtn.click();
  assert.equal(guideModal.hidden, false);
  assert.equal(vibrateCount, 1);

  // Open via openGuideLink
  guideModal.hidden = true;
  openGuideLink.click();
  assert.equal(guideModal.hidden, false);

  // Got it button closes and marks seen
  gotItGuideBtn.click();
  assert.equal(guideModal.hidden, true);
  assert.equal(guide.isSeen(), true);
  assert.equal(store['gold_guide_seen'], '1');

  // Clicking an action button selects tab and closes
  guide.openGuide();
  assert.equal(guideModal.hidden, false);
  actionBtn.click();
  assert.equal(guideModal.hidden, true);
  assert.equal(selectedTab, 'auditor');
});

test('guide-ui does not auto-show if already seen', () => {
  const guideModal = createMockElement('guideModal');
  const doc = {
    getElementById: (id) => (id === 'guideModal' ? guideModal : null),
    querySelectorAll: () => [],
  };
  const mockStorage = {
    getItem: (k) => (k === 'gold_guide_seen' ? '1' : null),
    setItem: () => {},
  };

  const guide = guideApi.createGuideUI({
    document: doc,
    storage: mockStorage,
    window: { setTimeout: (fn) => fn() },
  });

  assert.equal(guide.isSeen(), true);
  assert.equal(guideModal.hidden, true);
});

test('index.html and sw.js precache guide-ui', () => {
  const indexHtml = fs.readFileSync('index.html', 'utf8');
  const swJs = fs.readFileSync('sw.js', 'utf8');

  assert.match(indexHtml, /<script src="js\/ui\/guide-ui\.js"><\/script>/);
  assert.match(swJs, /'js\/ui\/guide-ui\.js'/);
  assert.match(indexHtml, /id="guideModal"/);
  assert.match(indexHtml, /id="helpBtn"/);
  assert.match(indexHtml, /id="quickIntentCard"/);
});
