// node --test test/  (Node 18+). Hand-computed cases from the official tables read on 2026-10-13.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compute, solvePrice, breakdown, simplesEffective, taxModel } from '../docs/assets/calc.js';

const close = (a, b, eps = 0.005) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

// Case 1: cost 30 + 2, 0.3-0.5 kg, Clássico 14%, Premium 19%, Simples 4% (RBT12 120k, faixa 1), margin 15%.
const c1 = { cost: 30, extra: 2, weightIdx: 1, mlClassicoPct: 14, mlPremiumPct: 19, regime: 'simples', simplesMode: 'rbt12', rbt12: 120000, targetMargin: 15 };

test('Simples Anexo I effective rate', () => {
  close(simplesEffective(120000).effective, 4);
  close(simplesEffective(500000).effective, 6.728, 1e-9);          // (500000*9.5% - 13860)/500000
  close(simplesEffective(4000000, true).nominal, 18.9);            // 6th bracket in 2027 (LC 214)
});

test('case 1, ML Clássico: R$ 49-78,99 band, shipping R$ 8,25', () => {
  // (30+2+8.25)/(1-0.14-0.04-0.15) = 60.0746 -> 60.08
  assert.equal(solvePrice('mlClassico', 15, c1), 60.08);
  // break-even in the R$ 19-48,99 band: (30+2+6.95)/(1-0.14-0.04) = 47.50
  assert.equal(solvePrice('mlClassico', 0, c1), 47.5);
  const b = breakdown('mlClassico', 60.08, c1);
  close(b.shipping, 8.25); close(b.commission, 8.4112, 1e-6); close(b.tax, 2.4032, 1e-6);
  assert.ok(b.margin >= 15);
});

test('case 1, ML Premium', () => {
  assert.equal(solvePrice('mlPremium', 15, c1), 64.92);   // 40.25/0.62 = 64.919
  assert.equal(solvePrice('mlPremium', 0, c1), 52.28);    // 40.25/0.77 = 52.273 (R$ 19-48,99 gives 50.58, outside)
});

test('case 1, Shopee CNPJ: 20% + R$ 4,50 up to R$ 79,99', () => {
  assert.equal(solvePrice('shopee', 15, c1), 59.84);      // 36.5/0.61 = 59.836
  assert.equal(solvePrice('shopee', 0, c1), 48.03);       // 36.5/0.76 = 48.026
  const b = breakdown('shopee', 59.84, c1);
  close(b.fixed, 4.5); close(b.commission, 11.968, 1e-6);
});

// Case 2: MEI, DAS R$ 82,05 / 50 sales, cost 50, 1-1,5 kg, Premium 17%, margin 20%.
const c2 = { cost: 50, extra: 0, weightIdx: 3, mlPremiumPct: 17, regime: 'mei', meiDas: 82.05, meiUnits: 50, targetMargin: 20 };
test('case 2, MEI per-unit DAS, band jumps at R$ 79 and R$ 100', () => {
  close(taxModel(c2).b, 1.641, 1e-9);
  // R$ 79-99,99: (50+14.75+1.641)/0.63 = 105.38 (outside); R$ 100-119,99: (50+17.15+1.641)/0.63 = 109.192 -> 109.20
  assert.equal(solvePrice('mlPremium', 20, c2), 109.2);
  // Shopee R$ 100-199,99: 14% + R$ 20: (50+20+1.641)/0.66 = 108.547 -> 108.55
  assert.equal(solvePrice('shopee', 20, c2), 108.55);
});

// Case 3: Simples faixa 3 (RBT12 500k = 6.728%), Shopee CPF over 450 orders (+R$ 3), cost 100 + 3, margin 10%.
test('case 3, Shopee CPF extra R$ 3', () => {
  const c3 = { cost: 100, extra: 3, regime: 'simples', rbt12: 500000, shopeeSeller: 'cpf', shopeeCpfOver450: true, targetMargin: 10 };
  // R$ 100-199,99: (103 + 20 + 3) / (1 - 0.14 - 0.06728 - 0.10) = 181.8917 -> 181.90
  assert.equal(solvePrice('shopee', 10, c3), 181.9);
  close(breakdown('shopee', 181.9, c3).fixed, 23);
});

// Case 4: 2027 scenario, Simples faixa 1 with IBS/CBS "por fora", CBS 8.7% + IBS 0.1%, full credit on cost.
test('case 4, 2027 IBS/CBS por fora', () => {
  const c4 = { ...c1, scenario2027: true, simples2027: 'fora', cbsPct: 8.7, creditShare: 100 };
  const inside = 0.088 / 1.088;
  const das = 0.04 * (1 - 0.155);
  const b = 30 + 2 + 8.25 - 30 * inside;
  const expected = Math.ceil((b / (1 - 0.14 - das - inside - 0.15)) * 100) / 100;   // 63.54
  assert.equal(expected, 63.54);
  assert.equal(solvePrice('mlClassico', 15, c4), expected);
});

test('below R$ 19, ML shipping is at most half the price', () => {
  const b = breakdown('mlClassico', 10, { weightIdx: 0 });
  close(b.shipping, 5);         // table R$ 5,65 > 10/2
  close(breakdown('mlClassico', 15, { weightIdx: 0 }).shipping, 5.65);
});

test('Shopee CNPJ below R$ 9: fixed part is half the price', () => {
  close(breakdown('shopee', 8, {}).fixed, 4);
});

test('compute() returns three rows and picks the cheapest', () => {
  const r = compute(c1);
  assert.equal(r.rows.length, 3);
  assert.equal(r.cheapest, 'shopee');
});

test('impossible margin returns null', () => {
  assert.equal(solvePrice('shopee', 90, c1), null);
});
