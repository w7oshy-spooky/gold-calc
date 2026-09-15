# Gold Calculator Decision Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Buy/Sell transaction modes and a bilingual Fair Price Checker while keeping calculations pure, deterministic, and framework-free.

**Architecture:** Extend `gold-calculator.js` with pure sale and quote-comparison functions. `app.js` remains the UI adapter and dispatches by transaction mode. Arabic and English pages receive equivalent controls and copy, with only minimal CSS additions.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Node.js built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-15-decision-tools-design.md`

## Global Constraints

- No framework or runtime dependency.
- Existing purchase calculations must remain backward compatible.
- Invalid numeric inputs sanitize to safe values; percentages clamp to 0..100.
- Arabic and English must remain feature-equivalent.
- Financial classification copy must be descriptive, not a guarantee of fairness.
- Live-price APIs, persistence, PWA, and AdSense are out of scope.

---

### Task 1: Pure sale and comparison engine

**Files:**
- Modify: `gold-calculator.js`
- Modify: `tests/gold-calculator.test.js`

**Interfaces:**
- Produces: `normalizeMode(value)`, `clampPercent(value)`, `calculateGoldSale(input)`, `calculateTransaction(input)`, `compareQuote(input)`.

- [ ] **Step 1: Write failing tests** for a 21K sale, 10% buyer deduction, deduction clamping, mode dispatch, buy comparison bands, sell comparison bands, and zero-reference handling.
- [ ] **Step 2: Run** `node --test tests/gold-calculator.test.js` and confirm the new tests fail because the new functions do not exist.
- [ ] **Step 3: Implement minimal pure functions** in `gold-calculator.js`. Sale math must use raw metal value and explicit deduction only; quote comparison must return `{ available, difference, differencePct, status }`.
- [ ] **Step 4: Run** `node --test tests/gold-calculator.test.js` and confirm all old and new tests pass.
- [ ] **Step 5: Commit** with `feat: add buy sell calculation engine`.

### Task 2: Transaction-mode UI behavior

**Files:**
- Modify: `app.js`
- Modify: `index.html`
- Modify: `en.html`

**Interfaces:**
- Consumes: `calculateTransaction`, `compareQuote`, `normalizeMode`, `clampPercent`.
- Produces UI state for `transactionMode`, `sellDeduction`, `quotedTotal`, and comparison outputs.

- [ ] **Step 1: Add HTML controls** for Buy/Sell mode, sell deduction, and quoted total to both language pages with matching IDs.
- [ ] **Step 2: Add UI logic** that shows workmanship/VAT in buy mode, shows deduction in sell mode, and updates the bottom receipt labels/value source.
- [ ] **Step 3: Add Fair Price Checker rendering** for difference SAR, difference %, and localized status copy.
- [ ] **Step 4: Run syntax checks** with `node --check app.js` and re-run the calculation tests.
- [ ] **Step 5: Commit** with `feat: add bilingual transaction decision UI`.

### Task 3: Styling and regression verification

**Files:**
- Modify: `styles.css`
- Modify: `README.md`

**Interfaces:**
- No new calculation interfaces.

- [ ] **Step 1: Add minimal styles** for transaction segmented buttons, hidden mode panels, and quote-status states without redesigning the page.
- [ ] **Step 2: Update README** to document Buy/Sell and Fair Price Checker behavior and limitations.
- [ ] **Step 3: Run full verification:** `node --check gold-calculator.js`, `node --check app.js`, `node --test tests/gold-calculator.test.js`.
- [ ] **Step 4: Verify HTML parity**: both pages contain transaction mode, sell deduction, quoted total, comparison result, language switch, and shared scripts.
- [ ] **Step 5: Review branch diff** against `main`, open a PR, and require CI success before merge.