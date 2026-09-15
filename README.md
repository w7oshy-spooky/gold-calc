# Gold Calculator

Bilingual Arabic and English calculator for gold jewellery pricing and used-gold sale estimates in Saudi riyals.

## Features

- Arabic: `index.html`
- English: `en.html`
- Buy mode: metal value + workmanship + optional extra margin + configurable VAT
- Sell mode: raw metal value minus an explicit buyer deduction percentage
- Shop Quote Comparison: compares an entered quote with the calculated reference total and reports the SAR and percentage difference
- Ounce-price or manual 24K-price input
- Shared calculation core: `gold-calculator.js`
- Shared UI behavior: `app.js`

The quote comparison is descriptive, not a guarantee that a shop price is fair or unfair. Real transactions can differ because of workmanship, stones, promotions, commercial policy, spreads and tax treatment.

## Tests

Run all checks with Node.js 22 or newer:

```bash
node --check gold-calculator.js
node --check app.js
node --test tests/*.test.js
```

The app does not fetch a live gold price yet. Enter the current ounce price or a manual 24K gram price. Live pricing, saved shop offers and PWA support are planned as separate follow-up phases.
