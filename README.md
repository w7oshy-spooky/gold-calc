# Gold Calculator

Bilingual Arabic and English calculator for gold jewellery pricing and used-gold sale estimates in Saudi riyals.

## Features

- Arabic: `index.html`
- English: `en.html`
- Live XAU/USD spot mode is the default price source
- Primary live provider: Gold API; automatic fallback: XAUS
- Live quote status, upstream timestamp, refresh button and 24K / 22K / 21K / 18K SAR-per-gram reference prices
- A recent live quote is cached locally for up to 15 minutes; if both providers fail and no recent cache exists, the UI falls back to manual ounce entry
- Manual ounce-price and manual 24K-price modes remain available
- Buy mode: metal value + workmanship + optional extra margin + configurable VAT
- Sell mode: raw metal value minus an explicit buyer deduction percentage
- Shop Quote Comparison: compares an entered quote with the calculated reference total and reports the SAR and percentage difference
- Shared calculation core: `gold-calculator.js`
- Live quote normalization: `live-gold.js`
- Vercel Function: `api/gold-price.js`
- Shared UI behavior: `app.js`

Live spot quotes are indicative raw-gold references, not guaranteed shop execution prices. Real transactions can differ because of bid/ask spreads, workmanship, stones, promotions, commercial policy and tax treatment.

## Tests

Run all checks with Node.js 22 or newer:

```bash
node --check gold-calculator.js
node --check live-gold.js
node --check api/gold-price.js
node --check app.js
node --test tests/*.test.js
```

No live-price API key is required for the current providers. The Vercel Function keeps provider-specific response formats out of the browser UI and allows the upstream source to be changed later without rewriting the calculator.
