// Planilha .xlsx gerada no navegador, sem biblioteca: ZIP sem compressão + SpreadsheetML mínimo.
// A aba "Calculadora" usa fórmulas de verdade: o vendedor troca o custo e a planilha recalcula os preços.
import { ML_SHIPPING, ML_PRICE_BANDS, ML_PRICE_BAND_LABELS, SHOPEE_TIERS, SOURCES, CHECKED_AT } from './fees.js';
import { compute, breakdown, taxModel, normalize } from './calc.js';

/* ---------------- ZIP (store) ---------------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
export function zip(files) {
  const enc = new TextEncoder();
  const parts = []; const central = []; let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name); const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, 0, true); h.setUint16(12, 0x5021, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true);
    h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, 0, true); c.setUint16(14, 0x5021, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), name);
    off += 30 + name.length + data.length;
  }
  const csize = central.reduce((s, x) => s + x.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
  const all = [...parts, ...central, new Uint8Array(e.buffer)];
  const out = new Uint8Array(all.reduce((s, x) => s + x.length, 0)); let p = 0;
  for (const x of all) { out.set(x, p); p += x.length; }
  return out;
}

/* ---------------- SpreadsheetML ---------------- */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Styles: 0 normal, 1 bold, 2 input number, 3 money, 4 percent, 5 input money, 6 input percent, 7 header, 8 title, 9 note, 10 money bold, 11 percent bold, 12 link
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00"/></numFmts>
<fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FF0B3D91"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF555555"/><name val="Calibri"/></font><font><u/><sz val="10"/><color rgb="FF0B57D0"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF4C2"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCE8FB"/></patternFill></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="13">
<xf/>
<xf fontId="1" applyFont="1"/>
<xf fillId="2" applyFill="1"/>
<xf numFmtId="164" applyNumberFormat="1"/>
<xf numFmtId="10" applyNumberFormat="1"/>
<xf numFmtId="164" fillId="2" applyNumberFormat="1" applyFill="1"/>
<xf numFmtId="10" fillId="2" applyNumberFormat="1" applyFill="1"/>
<xf fontId="1" fillId="3" applyFont="1" applyFill="1"/>
<xf fontId="2" applyFont="1"/>
<xf fontId="3" applyFont="1" applyAlignment="1"><alignment wrapText="0"/></xf>
<xf numFmtId="164" fontId="1" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="10" fontId="1" applyNumberFormat="1" applyFont="1"/>
<xf fontId="4" applyFont="1"/>
</cellXfs>
</styleSheet>`;

function colName(n) { let s = ''; n += 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

class Sheet {
  constructor(name) { this.name = name; this.rows = new Map(); this.widths = []; }
  set(ref, cell) { const m = /^([A-Z]+)(\d+)$/.exec(ref); const r = +m[2]; if (!this.rows.has(r)) this.rows.set(r, new Map()); this.rows.get(r).set(m[1], cell); return this; }
  text(ref, v, s = 0) { return this.set(ref, { t: 's', v, s }); }
  num(ref, v, s = 0) { return this.set(ref, { t: 'n', v, s }); }
  f(ref, f, v, s = 0) { return this.set(ref, { t: typeof v === 'string' ? 'str' : 'n', f, v, s }); }
  xml() {
    const colIdx = (c) => [...c].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
    const rows = [...this.rows.keys()].sort((a, b) => a - b).map((r) => {
      const cells = [...this.rows.get(r).entries()].sort((a, b) => colIdx(a[0]) - colIdx(b[0])).map(([c, x]) => {
        const ref = c + r; const s = x.s ? ` s="${x.s}"` : '';
        if (x.f !== undefined) {
          const val = x.v === undefined || x.v === null ? '' : x.t === 'str' ? `<v>${esc(x.v)}</v>` : Number.isFinite(x.v) ? `<v>${x.v}</v>` : '';
          return `<c r="${ref}"${s}${x.t === 'str' ? ' t="str"' : ''}><f>${esc(x.f)}</f>${val}</c>`;
        }
        if (x.t === 's') return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(x.v)}</t></is></c>`;
        return `<c r="${ref}"${s}><v>${Number.isFinite(x.v) ? x.v : 0}</v></c>`;
      }).join('');
      return `<row r="${r}">${cells}</row>`;
    }).join('');
    const cols = this.widths.length ? `<cols>${this.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews>${cols}<sheetData>${rows}</sheetData></worksheet>`;
  }
}

function workbook(sheets) {
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: STYLES },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: s.xml() })),
  ];
  return zip(files);
}

/* ---------------- Conteúdo da planilha ---------------- */
const BIG = 1e9;
const ceil2 = (x) => Math.ceil(x * 100 - 1e-7) / 100;

/** Linhas do "solver" (uma por faixa de preço) com fórmulas e valores em cache. */
function mlSegments(i) {
  const s0 = ML_SHIPPING[i.weightIdx][1][0];
  const half = Math.min(19, 2 * s0);
  const T = 'Tarifas!$C$6:$J$35';
  const segs = [
    { lo: 0, hiF: 'MIN(19,2*INDEX(' + T + ',$B$6,1))', hi: half, half: true, col: 1 },
    { loF: 'MIN(19,2*INDEX(' + T + ',$B$6,1))', lo: half, hi: 19, col: 1 },
    { lo: 19, hi: 49, col: 2 }, { lo: 49, hi: 79, col: 3 }, { lo: 79, hi: 100, col: 4 }, { lo: 100, hi: 120, col: 5 },
    { lo: 120, hi: 150, col: 6 }, { lo: 150, hi: 200, col: 7, disc: true }, { lo: 200, hi: 700.01, col: 8, disc: true }, { lo: 700.01, hi: BIG, col: 8 },
  ];
  return segs;
}

export function buildXlsx(input, opts = {}) {
  const i = normalize(input);
  const res = compute(i);
  const tm = taxModel(i);
  const calc = new Sheet('Calculadora');
  calc.widths = [46, 16, 16, 16, 4, 4, 4, 12, 12, 10, 10, 10, 12, 12, 12, 12];
  calc.text('A1', 'Venda no Azul: planilha de preço e margem para Mercado Livre e Shopee', 8);
  calc.text('A2', `Tarifas oficiais lidas em ${CHECKED_AT.split('-').reverse().join('/')}. Células amarelas são editáveis; o resto recalcula sozinho. Fontes na aba Tarifas.`, 9);
  const inputs = [
    ['A4', 'Custo do produto (R$)', i.cost, 5],
    ['A5', 'Embalagem, etiqueta e outros custos por venda (R$)', i.extra, 5],
    ['A6', 'Linha de peso na aba Tarifas (1 = até 0,3 kg ... 30 = mais de 150 kg)', i.weightIdx + 1, 2],
    ['A7', 'Tarifa ML Clássico (%) da sua categoria', i.mlClassicoPct / 100, 6],
    ['A8', 'Tarifa ML Premium (%) da sua categoria', i.mlPremiumPct / 100, 6],
    ['A9', 'Desconto ML entre R$ 150 e R$ 700 (pontos percentuais)', i.mlDiscountPp, 2],
    ['A10', 'Envio ML: 1 = tabela oficial, 0 = valor manual (linha 11)', i.mlShipMode === 'manual' ? 0 : 1, 2],
    ['A11', 'Envio ML manual (R$)', i.mlShipManual, 5],
    ['A12', 'Shopee: taxa extra por item (R$ 3 se CPF com mais de 450 pedidos em 90 dias)', i.shopeeSeller === 'cpf' && i.shopeeCpfOver450 ? 3 : 0, 5],
    ['A13', 'Shopee: loja CNPJ? (1 = sim, 0 = CPF)', i.shopeeSeller === 'cnpj' ? 1 : 0, 2],
    ['A14', 'Shopee: frete pago por você (R$)', i.shopeeShip, 5],
    ['A15', 'Imposto proporcional ao preço (%)', tm.a, 6],
    ['A16', 'Imposto fixo por unidade (R$), ex.: DAS do MEI ÷ vendas do mês', tm.b, 5],
    ['A17', 'Margem líquida desejada (%)', i.targetMargin / 100, 6],
    ['A18', 'Preço para simular (R$)', i.currentPrice || res.rows[0].targetPrice || 100, 5],
  ];
  for (const [ref, label, v, s] of inputs) { calc.text(ref, label); calc.num('B' + ref.slice(1), v, s); }
  calc.text('C15', tm.label, 9);

  // Solver block: H..P. Row 21 header; ML segments rows 22-31 (Clássico & Premium share segments), Shopee rows 34-39.
  calc.text('H20', 'Cálculo por faixa de preço (não edite)', 1);
  const hdr = ['de', 'até', 'envio', 'a Clás.', 'a Prem.', 'b', 'mín Clás.', 'mín Prem.', 'alvo Clás.', 'alvo Prem.'];
  hdr.forEach((h, k) => calc.text(colName(7 + k) + '21', h, 7));
  const segs = mlSegments(i);
  const T = 'Tarifas!$C$6:$J$35';
  const tax = { a: tm.a, b: tm.b };
  const solveCell = (aRef, bRef, mRef, r, a, b, m, lo, hi) => {
    const den = 1 - a - m;
    const cand = den > 0 ? ceil2(Math.max(lo, b / den, 0.01)) : BIG;
    const v = cand < hi ? cand : BIG;
    return { f: `IF(1-${aRef}-${mRef}>0,IF(ROUNDUP(MAX(H${r},${bRef}/(1-${aRef}-${mRef}),0.01),2)<I${r},ROUNDUP(MAX(H${r},${bRef}/(1-${aRef}-${mRef}),0.01),2),${BIG}),${BIG})`, v };
  };
  segs.forEach((sg, k) => {
    const r = 22 + k;
    calc.f('H' + r, sg.loF || String(sg.lo), sg.lo, 3);
    calc.f('I' + r, sg.hiF || String(sg.hi), sg.hi, 3);
    const tableShip = i.mlShipMode === 'manual' ? i.mlShipManual : sg.half ? 0 : ML_SHIPPING[i.weightIdx][1][sg.col - 1];
    calc.f('J' + r, sg.half ? 'IF($B$10=1,0,$B$11)' : `IF($B$10=1,INDEX(${T},$B$6,${sg.col}),$B$11)`, tableShip, 3);
    const halfA = sg.half && i.mlShipMode !== 'manual' ? 0.5 : 0;
    const d = sg.disc ? i.mlDiscountPp / 100 : 0;
    const aC = Math.max(0, i.mlClassicoPct / 100 - d) + halfA + tax.a;
    const aP = Math.max(0, i.mlPremiumPct / 100 - d) + halfA + tax.a;
    const halfF = sg.half ? 'IF($B$10=1,0.5,0)' : '0';
    const dF = sg.disc ? '$B$9/100' : '0';
    calc.f('K' + r, `MAX(0,$B$7-${dF})+${halfF}+$B$15`, aC, 4);
    calc.f('L' + r, `MAX(0,$B$8-${dF})+${halfF}+$B$15`, aP, 4);
    const b = i.cost + i.extra + tableShip + tax.b;
    calc.f('M' + r, `$B$4+$B$5+J${r}+$B$16`, b, 3);
    const mc0 = solveCell('K' + r, 'M' + r, '0', r, aC, b, 0, sg.lo, sg.hi); calc.f('N' + r, mc0.f, mc0.v, 3);
    const mp0 = solveCell('L' + r, 'M' + r, '0', r, aP, b, 0, sg.lo, sg.hi); calc.f('O' + r, mp0.f, mp0.v, 3);
    const mcT = solveCell('K' + r, 'M' + r, '$B$17', r, aC, b, i.targetMargin / 100, sg.lo, sg.hi); calc.f('P' + r, mcT.f, mcT.v, 3);
    const mpT = solveCell('L' + r, 'M' + r, '$B$17', r, aP, b, i.targetMargin / 100, sg.lo, sg.hi); calc.f('Q' + r, mpT.f, mpT.v, 3);
  });
  const mlLast = 22 + segs.length - 1;
  // Shopee segments
  calc.text('H34', 'de', 7); calc.text('I34', 'até', 7); calc.text('J34', 'fixo', 7); calc.text('K34', 'a', 7); calc.text('M34', 'b', 7); calc.text('N34', 'mín', 7); calc.text('P34', 'alvo', 7);
  const shSegs = [{ lo: 0, hi: 9, half: true, pct: 0.2, fixed: 4.5, tierRow: 40 }, ...SHOPEE_TIERS.map((t, k) => ({ lo: t.min === 0 ? 9 : t.min, hi: Number.isFinite(t.max) ? t.max : BIG, pct: t.pct / 100, fixed: t.fixed, tierRow: 40 + k }))];
  shSegs.forEach((sg, k) => {
    const r = 35 + k;
    calc.f('H' + r, String(sg.lo), sg.lo, 3); calc.f('I' + r, String(sg.hi), sg.hi, 3);
    const cnpjHalf = sg.half && i.shopeeSeller === 'cnpj';
    const fixedV = (cnpjHalf ? 0 : sg.fixed) + (i.shopeeSeller === 'cpf' && i.shopeeCpfOver450 ? 3 : 0);
    calc.f('J' + r, sg.half ? `IF($B$13=1,0,Tarifas!$D$${sg.tierRow})+$B$12` : `Tarifas!$D$${sg.tierRow}+$B$12`, fixedV, 3);
    const a = sg.pct + (cnpjHalf ? 0.5 : 0) + tax.a;
    calc.f('K' + r, `Tarifas!$C$${sg.tierRow}${sg.half ? '+IF($B$13=1,0.5,0)' : ''}+$B$15`, a, 4);
    const b = i.cost + i.extra + fixedV + i.shopeeShip + tax.b;
    calc.f('M' + r, `$B$4+$B$5+J${r}+$B$14+$B$16`, b, 3);
    const m0 = solveCell('K' + r, 'M' + r, '0', r, a, b, 0, sg.lo, sg.hi); calc.f('N' + r, m0.f, m0.v, 3);
    const mT = solveCell('K' + r, 'M' + r, '$B$17', r, a, b, i.targetMargin / 100, sg.lo, sg.hi); calc.f('P' + r, mT.f, mT.v, 3);
  });
  const shLast = 35 + shSegs.length - 1;

  // Results
  calc.text('A20', 'Resultado', 7); calc.text('B20', 'ML Clássico', 7); calc.text('C20', 'ML Premium', 7); calc.text('D20', 'Shopee', 7);
  const out = (ref, rng, v) => calc.f(ref, `IF(MIN(${rng})>=${BIG},"inviável",MIN(${rng}))`, v === null ? 'inviável' : v, 10);
  const [rc, rp, rs] = res.rows;
  calc.text('A21', 'Preço mínimo (lucro zero)');
  out('B21', `N22:N${mlLast}`, rc.minPrice); out('C21', `O22:O${mlLast}`, rp.minPrice); out('D21', `N35:N${shLast}`, rs.minPrice);
  calc.text('A22', 'Preço para a margem desejada', 1);
  out('B22', `P22:P${mlLast}`, rc.targetPrice); out('C22', `Q22:Q${mlLast}`, rp.targetPrice); out('D22', `P35:P${shLast}`, rs.targetPrice);

  // Simulation at B18
  const P = i.currentPrice || res.rows[0].targetPrice || 100;
  const sim = MARKETS_SIM.map((m) => breakdown(m, P, i));
  calc.text('A24', 'Simulação ao preço da célula B18', 7); calc.text('B24', 'ML Clássico', 7); calc.text('C24', 'ML Premium', 7); calc.text('D24', 'Shopee', 7);
  const shipF = `IF($B$10=1,IF($B$18<19,MIN($B$18/2,INDEX(${T},$B$6,MATCH($B$18,Tarifas!$C$5:$J$5,1))),INDEX(${T},$B$6,MATCH($B$18,Tarifas!$C$5:$J$5,1))),$B$11)`;
  const discF = 'IF(AND($B$18>=150,$B$18<=700),$B$9/100,0)';
  const rowsSim = [
    ['Tarifa de venda / comissão', `$B$18*MAX(0,$B$7-${discF})`, `$B$18*MAX(0,$B$8-${discF})`, `$B$18*LOOKUP($B$18,Tarifas!$B$40:$B$44,Tarifas!$C$40:$C$44)`, 'commission'],
    ['Tarifa fixa por item', '0', '0', `IF(AND($B$13=1,$B$18<9),$B$18/2,LOOKUP($B$18,Tarifas!$B$40:$B$44,Tarifas!$D$40:$D$44))+$B$12`, 'fixed'],
    ['Custo de envio', shipF, shipF, '$B$14', 'shipping'],
    ['Imposto', '$B$18*$B$15+$B$16', '$B$18*$B$15+$B$16', '$B$18*$B$15+$B$16', 'tax'],
    ['Custo do produto + embalagem', '$B$4+$B$5', '$B$4+$B$5', '$B$4+$B$5', null],
  ];
  rowsSim.forEach(([label, fC, fP, fS, key], k) => {
    const r = 25 + k; calc.text('A' + r, label);
    [fC, fP, fS].forEach((f, j) => calc.f('BCD'[j] + r, f, key ? sim[j][key] : i.cost + i.extra, 3));
  });
  calc.text('A30', 'Lucro líquido por venda', 1);
  ['B', 'C', 'D'].forEach((c, j) => calc.f(c + '30', `$B$18-SUM(${c}25:${c}29)`, sim[j].profit, 10));
  calc.text('A31', 'Margem líquida', 1);
  ['B', 'C', 'D'].forEach((c, j) => calc.f(c + '31', `IF($B$18>0,${c}30/$B$18,0)`, sim[j].margin / 100, 11));
  calc.text('A33', 'Feito por Venda no Azul (READ FRANCE SAS, Paris). Calculadora, não consultoria tributária: confira com seu contador.', 9);
  calc.text('A34', 'Shopee: subsídio Pix, cupons e anúncios não entram. ML: Full, Flex, publicidade e reputação amarela/vermelha não entram.', 9);

  // Tarifas sheet
  const tar = new Sheet('Tarifas');
  tar.widths = [18, 16, 12, 12, 12, 12, 12, 12, 14, 14];
  tar.text('A1', 'Tabelas oficiais usadas (lidas em ' + CHECKED_AT.split('-').reverse().join('/') + ')', 8);
  tar.text('A2', 'Mercado Livre: custo de envio cobrado do vendedor, produtos novos, reputação verde ou sem reputação.', 1);
  tar.text('A3', SOURCES.mlEnvios.url, 12);
  tar.text('A5', 'Linha', 7); tar.text('B5', 'Peso', 7);
  ML_PRICE_BANDS.forEach((b, k) => tar.num(colName(2 + k) + '5', b, 7));
  ML_PRICE_BAND_LABELS.forEach((l, k) => tar.text(colName(2 + k) + '4', l, 9));
  ML_SHIPPING.forEach(([label, vals], k) => {
    const r = 6 + k; tar.num('A' + r, k + 1); tar.text('B' + r, label);
    vals.forEach((v, j) => tar.num(colName(2 + j) + r, v, 3));
  });
  tar.text('A36', 'Produtos de menos de R$ 19 pagam no máximo metade do preço do produto (mesma página).', 9);
  tar.text('A38', 'Shopee, a partir de 01/10/2026 (comissão já inclui a taxa de transação)', 1);
  tar.text('A39', 'Faixa', 7); tar.text('B39', 'A partir de (R$)', 7); tar.text('C39', 'Comissão', 7); tar.text('D39', 'Fixo por item (R$)', 7);
  SHOPEE_TIERS.forEach((t, k) => { const r = 40 + k; tar.text('A' + r, t.label); tar.num('B' + r, t.min); tar.num('C' + r, t.pct / 100, 4); tar.num('D' + r, t.fixed, 3); });
  tar.text('A45', 'CNPJ: abaixo de R$ 9 o fixo é metade do preço. CPF com mais de 450 pedidos em 90 dias: + R$ 3 por item.', 9);
  tar.text('A46', SOURCES.shopee.url, 12);
  tar.text('A48', 'Mercado Livre: tarifa de venda Clássico entre 10% e 14%, Premium entre 15% e 19%, conforme a categoria.', 1);
  tar.text('A49', SOURCES.mlTarifas.url, 12);
  tar.text('A50', 'Desconto em p.p. para categorias selecionadas entre R$ 150 e R$ 700: ' + SOURCES.mlDesconto.url, 9);
  tar.text('A52', 'Simples Nacional, Anexo I (LC 123/2006): ' + SOURCES.simples.url, 9);
  tar.text('A53', 'Reforma tributária 2027 (LC 214/2025, arts. 344 e 347): ' + SOURCES.lc214.url, 9);

  // Resumo sheet (values only)
  const sum = new Sheet('Resumo');
  sum.widths = [34, 16, 16, 16];
  sum.text('A1', 'Resumo do cálculo feito no site', 8);
  sum.text('A2', 'Valores fixos, para conferência. A aba Calculadora recalcula.', 9);
  sum.text('A4', '', 7); res.rows.forEach((r, k) => sum.text('BCD'[k] + '4', r.short, 7));
  const lines = [['Preço mínimo (lucro zero)', (r) => r.minPrice], ['Preço para margem de ' + i.targetMargin + '%', (r) => r.targetPrice],
    ['Comissão nesse preço', (r) => r.atTarget && r.atTarget.commission], ['Tarifa fixa', (r) => r.atTarget && r.atTarget.fixed],
    ['Envio', (r) => r.atTarget && r.atTarget.shipping], ['Imposto', (r) => r.atTarget && r.atTarget.tax], ['Lucro líquido', (r) => r.atTarget && r.atTarget.profit]];
  lines.forEach(([label, fn], k) => { const rr = 5 + k; sum.text('A' + rr, label); res.rows.forEach((r, j) => { const v = fn(r); if (v === null || v === undefined) sum.text('BCD'[j] + rr, 'inviável'); else sum.num('BCD'[j] + rr, Math.round(v * 100) / 100, 3); }); });
  sum.text('A13', 'Imposto: ' + tm.label, 9);

  if (opts.noCache) for (const row of calc.rows.values()) for (const c of row.values()) if (c.f !== undefined) c.v = null;
  return workbook([calc, tar, sum]);
}
const MARKETS_SIM = ['mlClassico', 'mlPremium', 'shopee'];

/** CSV em formato brasileiro (ponto e vírgula, vírgula decimal, BOM para o Excel). */
export function buildCsv(input) {
  const res = compute(input);
  const n = (v) => (v === null || v === undefined ? 'inviável' : (Math.round(v * 100) / 100).toFixed(2).replace('.', ','));
  const lines = [['Canal', 'Preço mínimo (R$)', `Preço p/ margem ${res.input.targetMargin}% (R$)`, 'Comissão (R$)', 'Tarifa fixa (R$)', 'Envio (R$)', 'Imposto (R$)', 'Custo + embalagem (R$)', 'Lucro líquido (R$)']];
  for (const r of res.rows) {
    const t = r.atTarget;
    lines.push([r.name, n(r.minPrice), n(r.targetPrice), n(t && t.commission), n(t && t.fixed), n(t && t.shipping), n(t && t.tax), n(t && t.cost + t.extra), n(t && t.profit)]);
  }
  lines.push([]);
  lines.push([`Tarifas oficiais lidas em ${CHECKED_AT}. Fontes: ${SOURCES.mlTarifas.url} ; ${SOURCES.mlEnvios.url} ; ${SOURCES.shopee.url}`]);
  lines.push([`Imposto: ${res.tax.label}`]);
  return '﻿' + lines.map((l) => l.map((c) => (/[;"\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(';')).join('\r\n');
}
