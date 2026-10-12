// Builds the .xlsx without cached values, lets LibreOffice recalculate it, and compares with calc.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildXlsx, buildCsv } from '../docs/assets/xlsx.js';
import { compute } from '../docs/assets/calc.js';

const cases = [
  { cost: 30, extra: 2, weightIdx: 1, mlClassicoPct: 14, mlPremiumPct: 19, regime: 'simples', rbt12: 120000, targetMargin: 15, currentPrice: 60.08 },
  { cost: 50, extra: 0, weightIdx: 3, mlPremiumPct: 17, regime: 'mei', meiDas: 82.05, meiUnits: 50, targetMargin: 20, currentPrice: 109.2 },
  { cost: 100, extra: 3, regime: 'simples', rbt12: 500000, shopeeSeller: 'cpf', shopeeCpfOver450: true, targetMargin: 10, mlDiscountPp: 3, currentPrice: 181.9 },
  { cost: 4, extra: 0.5, weightIdx: 0, regime: 'outro', outroPct: 10, targetMargin: 5, currentPrice: 12 },
];

function recalc(bytes) {
  const dir = mkdtempSync(join(tmpdir(), 'vna-xlsx-'));
  writeFileSync(join(dir, 'p.xlsx'), bytes);
  execFileSync('soffice', ['--headless', '-env:UserInstallation=file://' + join(dir, 'lo'), '--convert-to', 'csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,false,false,false,1', '--outdir', dir, join(dir, 'p.xlsx')], { stdio: 'pipe', timeout: 90000 });
  return readFileSync(join(dir, 'p-Calculadora.csv'), 'utf8').split('\n').map((l) => [...l.matchAll(/("([^"]*)"|[^,]*)(,|$)/g)].map((m) => (m[2] !== undefined ? m[2] : m[1])));
}

for (const [k, c] of cases.entries()) {
  test(`xlsx formulas match calc.js, case ${k + 1}`, () => {
    const rows = recalc(buildXlsx(c, { noCache: true }));
    const r = compute(c);
    const cell = (ref) => { const m = /^([A-Z])(\d+)$/.exec(ref); return rows[+m[2] - 1][m[1].charCodeAt(0) - 65]; };
    const want = (v) => (v === null ? 'inviável' : v);
    const near = (got, exp, ref) => { if (exp === 'inviável') return assert.equal(got.replace(/"/g, ''), exp, ref); assert.ok(Math.abs(parseFloat(String(got).replace(',', '.')) - exp) < 0.006, `${ref}: ${got} vs ${exp}`); };
    near(cell('B21'), want(r.rows[0].minPrice), 'B21'); near(cell('C21'), want(r.rows[1].minPrice), 'C21'); near(cell('D21'), want(r.rows[2].minPrice), 'D21');
    near(cell('B22'), want(r.rows[0].targetPrice), 'B22'); near(cell('C22'), want(r.rows[1].targetPrice), 'C22'); near(cell('D22'), want(r.rows[2].targetPrice), 'D22');
    near(cell('B30'), r.rows[0].atCurrent.profit, 'B30'); near(cell('C30'), r.rows[1].atCurrent.profit, 'C30'); near(cell('D30'), r.rows[2].atCurrent.profit, 'D30');
  });
}

test('csv has BOM, semicolons and three channels', () => {
  const s = buildCsv(cases[0]);
  assert.equal(s.charCodeAt(0), 0xfeff);
  assert.match(s, /Mercado Livre Clássico;47,50;60,08;/);
  assert.match(s, /Shopee;48,03;59,84;/);
});
