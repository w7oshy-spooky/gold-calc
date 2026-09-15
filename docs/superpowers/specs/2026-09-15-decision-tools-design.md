# Gold Calculator Decision Tools Design

## Goal
Extend the bilingual gold calculator with two decision-oriented workflows without introducing a framework or external API dependency in this phase:

1. Buy / Sell mode.
2. Fair Price Checker for comparing a shop offer with the calculator's reference value.

## Scope

### Buy mode
Buy mode preserves the current jewellery purchase calculation:

- metal value = selected-karat gram price × weight
- workmanship and optional extra margin are added per gram
- VAT is applied to the configured taxable subtotal
- final total is the estimated customer purchase price

### Sell mode
Sell mode estimates the raw metal value a seller owns and the amount offered by a buyer:

- raw metal value = selected-karat gram price × weight
- no workmanship or VAT is added by default
- user enters a buyer deduction as a percentage from raw metal value
- estimated payout = raw metal value × (1 - deduction %)

The deduction is intentionally explicit rather than hidden in a hard-coded dealer spread.

### Fair Price Checker
The user may enter an actual quoted total from a shop/buyer. The checker compares it with the active mode's calculated reference total and returns:

- quoted total
- reference total
- difference in SAR
- percentage difference relative to the reference total
- status band

Buy-mode status bands:
- within ±2%: `close`
- +2% to +5%: `moderate_high`
- above +5%: `high`
- below -2%: `below_reference`

Sell-mode status bands are direction-aware because a higher payout is better for the seller:
- within ±2%: `close`
- -2% to -5%: `moderate_low`
- below -5%: `low`
- above +2%: `above_reference`

The wording must avoid claiming that a quote is definitively fair/unfair because workmanship, retailer policy, stones, promotions, tax treatment, and local spreads can differ.

## Architecture

### `gold-calculator.js`
Keep all financial calculations pure and testable. Add:

- `normalizeMode(value)` → `buy | sell`
- `clampPercent(value)` → 0..100
- `calculateGoldSale(input)`
- `calculateTransaction(input)` dispatching to buy or sell
- `compareQuote({ mode, referenceTotal, quotedTotal })`

Existing purchase behavior remains backward compatible.

### `app.js`
Manage UI state only:

- transaction mode toggle
- show/hide buy-only and sell-only controls
- call pure core functions
- update receipt labels and fair-price checker
- preserve current validation rules

### `index.html` and `en.html`
Keep the same layout and add:

- Buy / Sell segmented control near item details
- sell deduction input shown only in sell mode
- actual quote input and comparison card
- bilingual explanatory copy

### `styles.css`
Add only small state/result styles needed by the new controls. No visual redesign.

## Error handling

- negative/invalid money and weight values sanitize to zero
- percentages clamp to 0..100
- unsupported mode defaults to buy
- quote comparison returns a neutral `unavailable` result when reference or quote is zero
- no division by zero or NaN may reach the UI

## Testing

Extend Node tests to cover:

- sell calculation at 21K
- sell deduction clamping
- mode dispatch
- buy quote comparison bands
- sell quote comparison bands
- zero-reference comparison
- regression coverage for existing purchase math

## Out of scope for this phase

- live gold-price API
- shop-offer persistence/history
- PWA/service worker
- AdSense

These remain separate follow-up phases so each change can be verified independently.