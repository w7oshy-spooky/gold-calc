const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateTradeIn } = require('../gold-calculator.js');

test('calculateTradeIn enforces contract separation and ZATCA gross VAT compliance', () => {
  // Price24k = 400 SAR/g
  // New piece: 20g 21k (350 SAR/g), labor = 40 SAR/g -> subtotal = 20 * (350 + 40) = 7800 SAR
  // VAT on new purchase = 15% of 7800 = 1170 SAR -> total purchase = 8970 SAR
  // Old piece: 10g 21k (350 SAR/g), deduction = 2% -> raw = 3500, deduction = 70 SAR -> payout = 3430 SAR (0% VAT)
  // Net cash difference = 8970 - 3430 = 5540 SAR (customer pays)

  const result = calculateTradeIn({
    price24k: 400,
    newPiece: { weight: 20, karat: 21, workmanshipPerGram: 40, profitPerGram: 0, taxRate: 15 },
    oldPiece: { weight: 10, karat: 21, deductionRate: 2 },
  });

  assert.equal(result.isTradeIn, true);
  assert.equal(result.shariaCompliant, true);
  assert.equal(result.zatcaCompliant, true);

  // Contract 1: New purchase has full 15% VAT on gross
  assert.equal(result.purchaseContract.weight, 20);
  assert.equal(result.purchaseContract.subtotal, 7800);
  assert.equal(result.purchaseContract.vat, 1170);
  assert.equal(result.purchaseContract.total, 8970);

  // Contract 2: Old gold sale has 0% VAT
  assert.equal(result.saleContract.weight, 10);
  assert.equal(result.saleContract.rawMetalValue, 3500);
  assert.equal(result.saleContract.deductionValue, 70);
  assert.equal(result.saleContract.total, 3430);

  // Settlement
  assert.equal(result.settlement.newPurchaseTotal, 8970);
  assert.equal(result.settlement.oldGoldPayout, 3430);
  assert.equal(result.settlement.netCashDifference, 5540);
  assert.equal(result.settlement.action, 'customer_pays');
});

test('calculateTradeIn handles old gold payout exceeding new purchase', () => {
  // Trade-in large old piece for smaller new piece
  const result = calculateTradeIn({
    price24k: 400,
    newPiece: { weight: 5, karat: 21, workmanshipPerGram: 20, taxRate: 15 },
    oldPiece: { weight: 20, karat: 21, deductionRate: 0 },
  });

  assert.equal(result.settlement.action, 'customer_receives');
  assert.ok(result.settlement.netCashDifference < 0);
});
