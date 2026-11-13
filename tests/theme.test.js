const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const themeApi = require('../js/ui/theme-ui.js');

function createMockElement(tagName = 'div', attrs = {}) {
  const element = {
    tagName,
    attributes: { ...attrs },
    listeners: {},
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
  return element;
}

function createMockDocument(lang = 'ar') {
  const root = createMockElement('html', { lang });
  const toggleBtn = createMockElement('button', { id: 'themeToggle' });
  const metaColor = createMockElement('meta', { name: 'theme-color', content: '#0d0f12' });
  const metaColorScheme = createMockElement('meta', { name: 'color-scheme', content: 'light dark' });

  return {
    documentElement: root,
    getElementById: (id) => (id === 'themeToggle' ? toggleBtn : null),
    querySelector: (sel) => {
      if (sel.includes('meta[name="theme-color"]')) return metaColor;
      if (sel.includes('meta[name="color-scheme"]')) return metaColorScheme;
      return null;
    },
    _toggleBtn: toggleBtn,
    _metaColor: metaColor,
    _metaColorScheme: metaColorScheme,
  };
}

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    data,
  };
}

test('theme-ui initializes with default dark theme when no preference stored', () => {
  const doc = createMockDocument('ar');
  const storage = memoryStorage();
  const mockWindow = { localStorage: storage };

  const themeUI = themeApi.createThemeUI({
    document: doc,
    window: mockWindow,
  });

  assert.equal(themeUI.getTheme(), 'dark');
  assert.equal(doc.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(doc._metaColor.getAttribute('content'), '#0d0f12');
  assert.equal(doc._metaColorScheme.getAttribute('content'), 'dark');
  assert.equal(doc._toggleBtn.getAttribute('aria-pressed'), 'false');
  assert.match(doc._toggleBtn.getAttribute('aria-label'), /نهاري/);
});

test('theme-ui switches to light theme on toggle, sets attribute, meta and storage', () => {
  const doc = createMockDocument('ar');
  const storage = memoryStorage();
  let vibrated = false;
  let changedTheme = null;

  const themeUI = themeApi.createThemeUI({
    document: doc,
    window: { localStorage: storage },
    vibrate: () => { vibrated = true; },
    onChange: (t) => { changedTheme = t; },
  });

  const next = themeUI.toggleTheme();
  assert.equal(next, 'light');
  assert.equal(themeUI.getTheme(), 'light');
  assert.equal(doc.documentElement.getAttribute('data-theme'), 'light');
  assert.equal(doc._metaColor.getAttribute('content'), '#f7f6f2');
  assert.equal(doc._metaColorScheme.getAttribute('content'), 'light');
  assert.equal(doc._toggleBtn.getAttribute('aria-pressed'), 'true');
  assert.match(doc._toggleBtn.getAttribute('aria-label'), /ليلي/);
  assert.equal(storage.getItem(themeApi.STORAGE_KEY), 'light');
  assert.equal(vibrated, true);
  assert.equal(changedTheme, 'light');

  // Clicking the toggle button flips it back
  doc._toggleBtn.click();
  assert.equal(themeUI.getTheme(), 'dark');
  assert.equal(doc.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(doc._metaColor.getAttribute('content'), '#0d0f12');
  assert.equal(doc._metaColorScheme.getAttribute('content'), 'dark');
  assert.equal(storage.getItem(themeApi.STORAGE_KEY), 'dark');
});

test('theme-ui initializes with stored light preference', () => {
  const doc = createMockDocument('en');
  const storage = memoryStorage();
  storage.setItem(themeApi.STORAGE_KEY, 'light');

  const themeUI = themeApi.createThemeUI({
    document: doc,
    window: { localStorage: storage },
  });

  assert.equal(themeUI.getTheme(), 'light');
  assert.equal(doc.documentElement.getAttribute('data-theme'), 'light');
  assert.equal(doc._metaColor.getAttribute('content'), '#f7f6f2');
  assert.equal(doc._metaColorScheme.getAttribute('content'), 'light');
  assert.match(doc._toggleBtn.getAttribute('aria-label'), /Dark Mode/);
});

test('theme-ui supports system preference fallback when no storage is present', () => {
  const doc = createMockDocument('en');
  const mockWindow = {
    localStorage: null,
    matchMedia: (query) => ({
      matches: query.includes('light'),
      addEventListener: () => {},
    }),
  };

  const themeUI = themeApi.createThemeUI({
    document: doc,
    window: mockWindow,
  });

  assert.equal(themeUI.getTheme(), 'light');
  assert.equal(doc.documentElement.getAttribute('data-theme'), 'light');
});

test('index.html contain theme toggle button with accessible labels and icons', () => {
  for (const file of ['index.html']) {
    const html = fs.readFileSync(file, 'utf8');
    assert.match(html, /id=["']themeToggle["']/);
    assert.match(html, /class=["'][^"']*theme-toggle/);
    assert.match(html, /class=["'][^"']*theme-icon-sun/);
    assert.match(html, /class=["'][^"']*theme-icon-moon/);
  }
});

test('theme toggle stays clear of the wider Arabic language button in English', () => {
  const css = fs.readFileSync('styles.css', 'utf8');
  assert.match(css, /html\[lang=en\] \.theme-toggle\{inset-inline-end:calc\(1rem \+ 96px\)\}/);
});
