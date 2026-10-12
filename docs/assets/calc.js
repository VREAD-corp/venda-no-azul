// Motor de cálculo da Venda no Azul. Sem dependências e sem DOM: roda no navegador e no Node (testes).
import {
  ML_PRICE_BANDS, ML_SHIPPING, ML_HALF_PRICE_BELOW, ML_DISCOUNT_RANGE,
  SHOPEE_TIERS, SHOPEE_HALF_PRICE_BELOW, SHOPEE_CPF_EXTRA,
  SIMPLES_ANEXO_I, SIMPLES_2027_SHARE, IBS_2027,
} from './fees.js';

export const DEFAULTS = {
  cost: 30, extra: 2, weightIdx: 1,
  mlShipMode: 'auto', mlShipManual: 0,
  mlClassicoPct: 14, mlPremiumPct: 19, mlDiscountPp: 0,
  shopeeSeller: 'cnpj', shopeeCpfOver450: false, shopeeShip: 0,
  regime: 'simples', meiDas: 82.05, meiUnits: 50,
  simplesMode: 'rbt12', rbt12: 120000, simplesPct: 4,
  outroPct: 12, outroPisCofins: 3.65,
  scenario2027: false, simples2027: 'dentro', cbsPct: 8.7, creditShare: 0,
  targetMargin: 15, currentPrice: 0,
};

export const MARKETS = [
  { id: 'mlClassico', name: 'Mercado Livre Clássico', short: 'ML Clássico' },
  { id: 'mlPremium', name: 'Mercado Livre Premium', short: 'ML Premium' },
  { id: 'shopee', name: 'Shopee', short: 'Shopee' },
];

const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

export function normalize(input) {
  const i = { ...DEFAULTS, ...(input || {}) };
  for (const k of Object.keys(DEFAULTS)) if (typeof DEFAULTS[k] === 'number') i[k] = Math.max(0, num(i[k], DEFAULTS[k]));
  i.weightIdx = Math.min(ML_SHIPPING.length - 1, Math.floor(i.weightIdx));
  i.targetMargin = Math.min(i.targetMargin, 95);
  i.shopeeCpfOver450 = !!i.shopeeCpfOver450;
  i.scenario2027 = !!i.scenario2027;
  return i;
}

/** Simples Nacional, Anexo I: alíquota efetiva = (RBT12 × alíquota nominal − parcela a deduzir) / RBT12. */
export function simplesEffective(rbt12, year2027 = false) {
  const idx = simplesBracket(rbt12);
  const b = SIMPLES_ANEXO_I[idx];
  const nominal = year2027 && b.rate2027 ? b.rate2027 : b.rate;
  if (!(rbt12 > 0)) return { idx, nominal, effective: nominal };
  return { idx, nominal, effective: ((rbt12 * nominal) / 100 - b.deduct) / rbt12 * 100 };
}
export function simplesBracket(rbt12) {
  const i = SIMPLES_ANEXO_I.findIndex((b) => rbt12 <= b.max);
  return i < 0 ? SIMPLES_ANEXO_I.length - 1 : i;
}

/** Imposto por unidade = a × preço + b. Retorna também um texto curto com a regra aplicada. */
export function taxModel(input) {
  const i = normalize(input);
  const t = (i.cbsPct + IBS_2027) / 100;        // CBS + IBS em 2027 (cobrados "por fora")
  const inside = t / (1 + t);                    // parte do preço final que é CBS/IBS
  const credit = i.cost * (i.creditShare / 100) * inside;
  if (i.regime === 'mei') {
    const units = Math.max(1, i.meiUnits);
    return { a: 0, b: i.meiDas / units, label: `MEI: DAS de R$ ${fmt(i.meiDas)} dividido por ${units} vendas no mês` + (i.scenario2027 ? ' (o MEI continua com DAS fixo em 2027)' : '') };
  }
  if (i.regime === 'simples') {
    let eff; let idx;
    if (i.simplesMode === 'manual') { eff = i.simplesPct; idx = simplesBracket(i.rbt12); } else { const s = simplesEffective(i.rbt12, i.scenario2027); eff = s.effective; idx = s.idx; }
    if (i.scenario2027 && i.simples2027 === 'fora') {
      const das = eff * (1 - SIMPLES_2027_SHARE[idx] / 100);
      return { a: das / 100 + inside, b: -credit, label: `2027, IBS/CBS por fora: DAS de ${pct(das)} + CBS ${pct(i.cbsPct)} e IBS ${pct(IBS_2027)} por fora` + (credit > 0 ? ` − crédito de R$ ${fmt(credit)}` : '') };
    }
    return { a: eff / 100, b: 0, label: `Simples Nacional: alíquota efetiva de ${pct(eff)}` + (i.scenario2027 ? ' (2027: CBS e IBS dentro do DAS)' : '') };
  }
  const base = i.scenario2027 ? Math.max(0, i.outroPct - i.outroPisCofins) : i.outroPct;
  if (i.scenario2027) return { a: base / 100 + inside, b: -credit, label: `2027: ${pct(base)} sem PIS/Cofins + CBS ${pct(i.cbsPct)} e IBS ${pct(IBS_2027)} por fora` + (credit > 0 ? ` − crédito de R$ ${fmt(credit)}` : '') };
  return { a: base / 100, b: 0, label: `Impostos de ${pct(base)} sobre o preço` };
}

export function mlShipping(price, input) {
  const i = normalize(input);
  if (i.mlShipMode === 'manual') return i.mlShipManual;
  let col = 0;
  for (let k = 0; k < ML_PRICE_BANDS.length; k++) if (price >= ML_PRICE_BANDS[k]) col = k;
  const v = ML_SHIPPING[i.weightIdx][1][col];
  return price < ML_HALF_PRICE_BELOW ? Math.min(v, price / 2) : v;
}

export function shopeeTier(price) {
  return SHOPEE_TIERS.find((t) => price >= t.min && price < t.max) || SHOPEE_TIERS[SHOPEE_TIERS.length - 1];
}

/** Detalhamento de uma venda ao preço `price` em um marketplace. Valores em R$ por unidade. */
export function breakdown(market, price, input) {
  const i = normalize(input);
  const p = Math.max(0, num(price));
  let commissionPct; let fixed = 0; let shipping = 0;
  if (market === 'shopee') {
    const tier = shopeeTier(p);
    commissionPct = tier.pct;
    fixed = i.shopeeSeller === 'cnpj' && p < SHOPEE_HALF_PRICE_BELOW ? p / 2 : tier.fixed;
    if (i.shopeeSeller === 'cpf' && i.shopeeCpfOver450) fixed += SHOPEE_CPF_EXTRA;
    shipping = i.shopeeShip;
  } else {
    commissionPct = market === 'mlPremium' ? i.mlPremiumPct : i.mlClassicoPct;
    if (i.mlDiscountPp > 0 && p >= ML_DISCOUNT_RANGE[0] && p <= ML_DISCOUNT_RANGE[1]) commissionPct = Math.max(0, commissionPct - i.mlDiscountPp);
    shipping = mlShipping(p, i);
  }
  const commission = (p * commissionPct) / 100;
  const tm = taxModel(i);
  const tax = tm.a * p + tm.b;
  const profit = p - i.cost - i.extra - commission - fixed - shipping - tax;
  return { market, price: p, commissionPct, commission, fixed, shipping, tax, cost: i.cost, extra: i.extra, profit, margin: p > 0 ? (profit / p) * 100 : 0, receive: p - commission - fixed - shipping };
}

/** Pontos onde alguma tarifa muda de regra. Entre dois pontos o custo total é linear no preço. */
export function breakpoints(market, input) {
  const i = normalize(input);
  const pts = new Set([0]);
  if (market === 'shopee') {
    SHOPEE_TIERS.forEach((t) => pts.add(t.min));
    if (i.shopeeSeller === 'cnpj') pts.add(SHOPEE_HALF_PRICE_BELOW);
  } else {
    if (i.mlShipMode !== 'manual') {
      ML_PRICE_BANDS.forEach((b) => pts.add(b));
      const half = 2 * ML_SHIPPING[i.weightIdx][1][0];
      if (half < ML_HALF_PRICE_BELOW) pts.add(half);
    }
    if (i.mlDiscountPp > 0) { pts.add(ML_DISCOUNT_RANGE[0]); pts.add(ML_DISCOUNT_RANGE[1] + 0.01); }
  }
  return [...pts].sort((x, y) => x - y);
}

/**
 * Menor preço (em centavos inteiros) que deixa a margem líquida >= `marginPct` % do preço.
 * marginPct = 0 dá o preço mínimo (lucro zero). Retorna null se nenhum preço atinge a margem.
 */
export function solvePrice(market, marginPct, input) {
  const i = normalize(input);
  const m = marginPct / 100;
  const pts = breakpoints(market, i);
  const total = (p) => { const b = breakdown(market, p, i); return p - b.profit; };
  let best = null;
  for (let k = 0; k < pts.length; k++) {
    const lo = pts[k];
    const hi = k + 1 < pts.length ? pts[k + 1] : Infinity;
    const p1 = lo + (Number.isFinite(hi) ? Math.min(0.001, (hi - lo) / 4) : 0.001);
    const p2 = Number.isFinite(hi) ? (lo + hi) / 2 : lo + 1000;
    const a = (total(p2) - total(p1)) / (p2 - p1);
    const b = total(p1) - a * p1;
    const den = 1 - a - m;
    if (den <= 1e-9) continue;
    let c = Math.max(lo, b / den, 0.01);
    c = Math.ceil(c * 100 - 1e-7) / 100;
    if (!(c < hi)) continue;
    const chk = breakdown(market, c, i);
    if (chk.profit + 1e-9 < m * c) { c = r2(c + 0.01); if (!(c < hi) || breakdown(market, c, i).profit + 1e-9 < m * c) continue; }
    if (best === null || c < best) best = c;
  }
  return best;
}

/** Resultado completo para os três canais. */
export function compute(input) {
  const i = normalize(input);
  const tm = taxModel(i);
  const rows = MARKETS.map((mk) => {
    const minPrice = solvePrice(mk.id, 0, i);
    const targetPrice = solvePrice(mk.id, i.targetMargin, i);
    return {
      ...mk,
      minPrice,
      targetPrice,
      atTarget: targetPrice === null ? null : breakdown(mk.id, targetPrice, i),
      atCurrent: i.currentPrice > 0 ? breakdown(mk.id, i.currentPrice, i) : null,
    };
  });
  const valid = rows.filter((r) => r.targetPrice !== null);
  const cheapest = valid.length ? valid.reduce((x, y) => (y.targetPrice < x.targetPrice ? y : x)) : null;
  return { input: i, tax: tm, rows, cheapest: cheapest && cheapest.id };
}

export function fmt(x) {
  return Number(x).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function pct(x) {
  return Number(x).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%';
}
