// Tabelas oficiais usadas pela calculadora. Cada bloco traz a fonte e a data em que a página foi lida.
// Atualize CHECKED_AT e os valores juntos; os testes (test/calc.test.mjs) conferem casos calculados à mão.

export const CHECKED_AT = '2026-10-13';

export const SOURCES = {
  mlTarifas: { url: 'https://www.mercadolivre.com.br/ajuda/870', title: 'Mercado Livre: Quanto custa vender um produto?', read: '2026-10-13' },
  mlEnvios: { url: 'https://www.mercadolivre.com.br/ajuda/40538', title: 'Mercado Livre: Custos dos Envios para MercadoLíder, reputação verde ou sem reputação', read: '2026-10-13' },
  mlDesconto: { url: 'https://www.mercadolivre.com.br/ajuda/51251', title: 'Mercado Livre: Categorias com desconto na tarifa de venda', read: '2026-10-13' },
  mlFretes: { url: 'https://www.mercadolivre.com.br/ajuda/16467', title: 'Mercado Livre: Como funcionam os fretes grátis', read: '2026-10-13' },
  shopee: { url: 'https://seller.shopee.com.br/edu/article/26839', title: 'Shopee: Política de Comissão para vendedores CNPJ e CPF (atualizada em 01/10/2026)', read: '2026-10-13' },
  simples: { url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm', title: 'Lei Complementar 123/2006, Anexo I (Comércio)', read: '2026-10-13' },
  lc214: { url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm', title: 'Lei Complementar 214/2025: arts. 344, 347, 349 e Anexo I do Simples para 2027-2028', read: '2026-10-13' },
};

// Mercado Livre: tarifa de venda por tipo de anúncio (faixa oficial; o percentual exato depende da categoria).
export const ML_RANGES = { classico: [10, 14], premium: [15, 19] };

// Mercado Livre: custo de envio cobrado do vendedor (reputação verde ou sem reputação, produtos novos).
// Colunas = faixas de preço [mínimo, máximo); linhas = peso da embalagem (maior entre físico e volumétrico).
export const ML_PRICE_BANDS = [0, 19, 49, 79, 100, 120, 150, 200];
export const ML_PRICE_BAND_LABELS = ['R$ 0 a 18,99', 'R$ 19 a 48,99', 'R$ 49 a 78,99', 'R$ 79 a 99,99', 'R$ 100 a 119,99', 'R$ 120 a 149,99', 'R$ 150 a 199,99', 'A partir de R$ 200'];
export const ML_SHIPPING = [
  ['Até 0,3 kg', [5.65, 6.85, 8.15, 12.95, 14.95, 16.95, 19.05, 21.65]],
  ['De 0,3 a 0,5 kg', [5.95, 6.95, 8.25, 13.85, 16.15, 18.15, 20.45, 23.25]],
  ['De 0,5 a 1 kg', [6.05, 7.15, 8.45, 14.45, 16.85, 19.05, 21.35, 24.45]],
  ['De 1 a 1,5 kg', [6.15, 7.35, 8.65, 14.75, 17.15, 19.45, 21.75, 25.45]],
  ['De 1,5 a 2 kg', [6.25, 7.45, 8.75, 15.05, 17.65, 19.85, 22.25, 25.55]],
  ['De 2 a 3 kg', [6.35, 8.65, 9.15, 16.45, 19.15, 21.65, 24.35, 27.05]],
  ['De 3 a 4 kg', [6.45, 8.75, 9.75, 17.85, 20.75, 23.35, 26.35, 29.25]],
  ['De 4 a 5 kg', [6.55, 8.85, 10.25, 19.75, 22.85, 26.05, 29.25, 32.45]],
  ['De 5 a 6 kg', [6.65, 8.95, 10.35, 25.95, 29.15, 33.35, 36.45, 40.85]],
  ['De 6 a 7 kg', [6.75, 9.05, 10.45, 27.55, 31.65, 36.75, 40.85, 45.25]],
  ['De 7 a 8 kg', [6.85, 9.25, 10.55, 29.45, 34.35, 39.25, 44.15, 49.35]],
  ['De 8 a 9 kg', [6.95, 9.35, 10.65, 30.25, 35.25, 40.35, 45.35, 50.75]],
  ['De 9 a 10 kg', [7.05, 9.45, 10.85, 38.25, 45.05, 51.95, 58.75, 65.85]],
  ['De 10 a 11 kg', [7.05, 9.65, 11.05, 41.65, 48.55, 55.45, 62.35, 69.35]],
  ['De 11 a 13 kg', [7.15, 10.05, 11.45, 42.55, 49.75, 56.85, 63.85, 70.95]],
  ['De 13 a 15 kg', [7.25, 10.25, 11.65, 45.55, 52.95, 60.55, 68.15, 75.65]],
  ['De 15 a 17 kg', [7.35, 10.45, 11.85, 48.95, 56.55, 64.05, 71.35, 79.35]],
  ['De 17 a 20 kg', [7.45, 10.65, 12.05, 55.15, 64.35, 73.55, 82.75, 91.95]],
  ['De 20 a 25 kg', [7.65, 11.05, 12.25, 64.55, 75.75, 85.45, 96.25, 106.85]],
  ['De 25 a 30 kg', [7.75, 11.25, 12.45, 66.45, 76.05, 86.25, 97.15, 107.85]],
  ['De 30 a 40 kg', [7.85, 11.45, 12.65, 68.35, 79.65, 89.75, 100.05, 107.95]],
  ['De 40 a 50 kg', [7.95, 11.65, 12.85, 70.95, 81.85, 92.85, 103.45, 111.65]],
  ['De 50 a 60 kg', [8.05, 11.85, 13.05, 75.55, 87.25, 99.05, 110.25, 119.05]],
  ['De 60 a 70 kg', [8.15, 12.05, 13.25, 80.95, 93.75, 105.95, 118.05, 127.45]],
  ['De 70 a 80 kg', [8.25, 12.25, 13.45, 84.65, 97.95, 110.75, 123.35, 133.15]],
  ['De 80 a 90 kg', [8.35, 12.45, 13.65, 94.05, 108.35, 122.95, 136.95, 147.85]],
  ['De 90 a 100 kg', [8.45, 12.65, 13.85, 107.45, 124.85, 140.45, 156.45, 168.85]],
  ['De 100 a 125 kg', [8.55, 12.85, 14.05, 120.15, 138.95, 156.95, 174.85, 188.85]],
  ['De 125 a 150 kg', [8.65, 12.85, 14.25, 127.45, 147.05, 166.55, 185.55, 200.35]],
  ['Mais de 150 kg', [8.75, 12.85, 14.45, 167.05, 193.35, 218.45, 243.45, 262.85]],
];
// "Os produtos de menos de R$ 19 pagam no máximo metade do preço do produto."
export const ML_HALF_PRICE_BELOW = 19;
// Desconto em pontos percentuais para categorias selecionadas, produtos entre R$ 150 e R$ 700.
export const ML_DISCOUNT_RANGE = [150, 700];

// Shopee (a partir de 01/10/2026). "O valor da taxa de comissão já contempla a taxa de transação."
// Faixas [mínimo, máximo): Até R$79,99 | R$80 a 99,99 | R$100 a 199,99 | R$200 a 499,99 | acima de R$500.
export const SHOPEE_TIERS = [
  { min: 0, max: 80, pct: 20, fixed: 4.5, label: 'Até R$ 79,99' },
  { min: 80, max: 100, pct: 14, fixed: 16, label: 'R$ 80 a 99,99' },
  { min: 100, max: 200, pct: 14, fixed: 20, label: 'R$ 100 a 199,99' },
  { min: 200, max: 500, pct: 14, fixed: 26, label: 'R$ 200 a 499,99' },
  { min: 500, max: Infinity, pct: 14, fixed: 26, label: 'Acima de R$ 500' },
];
// CNPJ: "Para produtos com preço abaixo de R$9, o adicional por item é equivalente a metade do preço do produto."
export const SHOPEE_HALF_PRICE_BELOW = 9;
// CPF com mais de 450 pedidos em 90 dias: taxa adicional de R$ 3 por item.
export const SHOPEE_CPF_EXTRA = 3;

// Simples Nacional, Anexo I (Comércio), LC 123/2006. Faixa 6 em 2027-2028: 18,90% (LC 214/2025).
export const SIMPLES_ANEXO_I = [
  { max: 180000, rate: 4.0, deduct: 0 },
  { max: 360000, rate: 7.3, deduct: 5940 },
  { max: 720000, rate: 9.5, deduct: 13860 },
  { max: 1800000, rate: 10.7, deduct: 22500 },
  { max: 3600000, rate: 14.3, deduct: 87300 },
  { max: 4800000, rate: 19.0, deduct: 378000, rate2027: 18.9 },
];
// Partilha 2027-2028 (faixas 1 a 5): CBS 15,33% e IBS 0,17% do valor do DAS. Faixa 6: CBS 34,02%, sem IBS.
export const SIMPLES_2027_SHARE = [15.5, 15.5, 15.5, 15.5, 15.5, 34.02];

// MEI: DAS fixo mensal (comércio/indústria: 5% do salário mínimo de R$ 1.621 + R$ 1 de ICMS).
export const MEI_DAS_DEFAULT = 82.05;

// Reforma tributária, 2027: IBS 0,05% estadual + 0,05% municipal (LC 214, art. 344).
// CBS = alíquota de referência fixada pelo Senado menos 0,1 p.p. (art. 347). Ainda não publicada: hipótese editável.
export const IBS_2027 = 0.1;
export const CBS_2027_HYPOTHESIS = 8.7;
