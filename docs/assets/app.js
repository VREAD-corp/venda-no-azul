import { ML_SHIPPING, SIMPLES_ANEXO_I, SIMPLES_2027_SHARE, CHECKED_AT } from './fees.js';
import { DEFAULTS, compute, simplesEffective, fmt, pct } from './calc.js';

const $ = (s) => document.querySelector(s);
const form = $('#f');
const STORE = 'vna-inputs-v1';
const CONSENT_VERSION = 'v1-2026-10-13';
const track = (e) => { try { window.vnaTrack && window.vnaTrack(e); } catch (x) { /* ignore */ } };

/** "120.000,50" -> 120000.5 ; "30,5" -> 30.5 ; "30.5" -> 30.5 ; "1.200" -> 1200 */
export function parseBR(v) {
  let s = String(v == null ? '' : v).trim().replace(/[R$\s%]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  return Number(s);
}
const brl = (x) => 'R$\u00a0' + fmt(x);
const money = (x) => fmt(x);

// Weight options
const wsel = $('#weightIdx');
ML_SHIPPING.forEach(([label], i) => { const o = document.createElement('option'); o.value = i; o.textContent = label; wsel.appendChild(o); });
wsel.value = String(DEFAULTS.weightIdx);

const NUMERIC = ['cost', 'extra', 'mlClassicoPct', 'mlPremiumPct', 'mlShipManual', 'shopeeShip', 'meiDas', 'meiUnits', 'rbt12', 'simplesPct', 'outroPct', 'outroPisCofins', 'cbsPct', 'creditShare', 'targetMargin', 'currentPrice'];

function readState() {
  const fd = new FormData(form);
  const s = {};
  for (const k of NUMERIC) { const v = parseBR(fd.get(k)); s[k] = Number.isFinite(v) ? v : (k === 'currentPrice' ? 0 : DEFAULTS[k]); }
  s.weightIdx = Number(fd.get('weightIdx') || 0);
  s.mlDiscountPp = Number(fd.get('mlDiscountPp') || 0);
  s.mlShipMode = fd.get('mlShipMode') || 'auto';
  s.shopeeSeller = fd.get('shopeeSeller') || 'cnpj';
  s.shopeeCpfOver450 = $('#shopeeCpfOver450').checked;
  s.regime = fd.get('regime') || 'simples';
  s.simplesMode = $('#simplesManual').checked ? 'manual' : 'rbt12';
  s.scenario2027 = $('#scenario2027').checked;
  s.simples2027 = fd.get('simples2027') || 'dentro';
  return s;
}

function saveRaw() {
  try {
    const raw = {};
    for (const el of form.elements) {
      if (!el.name && !el.id) continue;
      const key = el.id || el.name;
      if (el.type === 'radio') { if (el.checked) raw['r:' + el.name] = el.value; } else if (el.type === 'checkbox') raw[key] = el.checked; else raw[key] = el.value;
    }
    localStorage.setItem(STORE, JSON.stringify(raw));
  } catch (e) { /* storage blocked: fine */ }
}
function restoreRaw() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { raw = null; }
  if (!raw || typeof raw !== 'object') return;
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith('r:')) { const el = form.querySelector(`input[type=radio][name="${CSS.escape(k.slice(2))}"][value="${CSS.escape(String(v))}"]`); if (el) el.checked = true; continue; }
    const el = document.getElementById(k);
    if (!el || !form.contains(el)) continue;
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
  }
}

function toggle(id, show) { const el = document.getElementById(id); if (el) el.classList.toggle('hidden', !show); }

function updateVisibility(s) {
  toggle('mlShipManualWrap', s.mlShipMode === 'manual');
  toggle('cpfWrap', s.shopeeSeller === 'cpf');
  toggle('reg-mei', s.regime === 'mei');
  toggle('reg-simples', s.regime === 'simples');
  toggle('reg-outro', s.regime === 'outro');
  toggle('simplesPctWrap', s.simplesMode === 'manual');
  toggle('s2027', s.scenario2027);
  toggle('s2027-simples', s.regime === 'simples');
  toggle('s2027-rates', s.regime !== 'mei' && (s.regime === 'outro' || s.simples2027 === 'fora'));
}

function simplesText(s) {
  if (s.simplesMode === 'manual') return `Alíquota informada: ${pct(s.simplesPct)}.`;
  if (s.rbt12 > SIMPLES_ANEXO_I[SIMPLES_ANEXO_I.length - 1].max) return 'Acima de R$ 4,8 milhões a empresa sai do Simples. Use "Outro".';
  const r = simplesEffective(s.rbt12, s.scenario2027);
  return `Anexo I, faixa ${r.idx + 1}: alíquota nominal ${pct(r.nominal)}, efetiva ${pct(Math.round(r.effective * 100) / 100)}.`;
}

let lastResult = null;
let usedOnce = false;

function render() {
  const s = readState();
  updateVisibility(s);
  $('#simplesOut').textContent = simplesText(s);
  const res = compute(s);
  lastResult = res;
  const s2027 = $('#s2027Out');
  if (s.scenario2027) {
    s2027.textContent = s.regime === 'mei' ? 'MEI: o DAS continua fixo em 2027, sem mudança no cálculo.'
      : s.regime === 'simples' && s.simples2027 === 'dentro' ? `Tudo no DAS: alíquota do Anexo I igual nas faixas 1 a 5; ${pct(SIMPLES_2027_SHARE[0])} do DAS passa a ser CBS e IBS.`
        : res.tax.label + '.';
  }
  $('#resTitle').textContent = `Preço para lucrar ${pct(res.input.targetMargin)} sobre a venda`;

  const prices = $('#prices');
  prices.innerHTML = '';
  for (const r of res.rows) {
    const div = document.createElement('div');
    div.className = 'price' + (r.id === res.cheapest ? ' best' : '');
    div.dataset.testid = 'price-' + r.id;
    if (r.targetPrice === null) {
      div.innerHTML = `<span class="mk">${r.name}</span><span class="val neg">sem preço</span><span class="sub">Com esses custos a margem pedida não fecha neste canal.</span>`;
    } else {
      div.innerHTML = `<span class="mk">${r.name}${r.id === res.cheapest ? '<span class="tagbest">menor preço</span>' : ''}</span>` +
        `<span class="val" data-value="${r.targetPrice}">${brl(r.targetPrice)}</span>` +
        `<span class="sub">Lucro de ${brl(r.atTarget.profit)} por venda · preço mínimo ${r.minPrice === null ? 'n/d' : brl(r.minPrice)}</span>`;
    }
    prices.appendChild(div);
  }

  const cols = res.rows;
  const cell = (r, f) => (r.atTarget ? f(r.atTarget, r) : 'n/d');
  const rowsHtml = [
    ['Preço de venda', (b) => money(b.price)],
    ['Tarifa', (b) => `${money(b.commission)}<small>${pct(b.commissionPct)}</small>`],
    ['Fixo por item', (b) => money(b.fixed)],
    ['Envio', (b) => money(b.shipping)],
    ['Imposto', (b) => money(b.tax)],
    ['Produto + embalagem', (b) => money(b.cost + b.extra)],
  ].map(([label, f]) => `<tr><td>${label}</td>${cols.map((r) => `<td>${cell(r, f)}</td>`).join('')}</tr>`).join('');
  const totalHtml = `<tr class="total"><td>Lucro líquido</td>${cols.map((r) => `<td class="${r.atTarget && r.atTarget.profit < 0 ? 'neg' : ''}">${cell(r, (b) => money(b.profit))}</td>`).join('')}</tr>` +
    `<tr><td>Margem</td>${cols.map((r) => `<td>${cell(r, (b) => pct(Math.round(b.margin * 10) / 10))}</td>`).join('')}</tr>` +
    `<tr><td>Preço mínimo (lucro zero)</td>${cols.map((r) => `<td data-testid="min-${r.id}">${r.minPrice === null ? 'n/d' : money(r.minPrice)}</td>`).join('')}</tr>`;
  $('#cmp').innerHTML = `<thead><tr><th>Em R$, no preço com margem</th>${cols.map((r) => `<th>${r.short}</th>`).join('')}</tr></thead><tbody>${rowsHtml}${totalHtml}</tbody>`;

  if (res.input.currentPrice > 0) {
    toggle('currentBlock', true);
    const nowRows = [
      ['Você recebe do canal', (b) => money(b.receive)],
      ['Imposto', (b) => money(b.tax)],
      ['Lucro líquido', (b) => `<b class="${b.profit < 0 ? 'neg' : 'pos'}">${money(b.profit)}</b>`],
      ['Margem', (b) => `<span class="${b.profit < 0 ? 'neg' : ''}">${pct(Math.round(b.margin * 10) / 10)}</span>`],
    ].map(([label, f]) => `<tr><td>${label}</td>${cols.map((r) => `<td data-testid="now-${r.id}">${f(r.atCurrent)}</td>`).join('')}</tr>`).join('');
    $('#cmpNow').innerHTML = `<thead><tr><th>Em R$, vendendo a ${money(res.input.currentPrice)}</th>${cols.map((r) => `<th>${r.short}</th>`).join('')}</tr></thead><tbody>${nowRows}</tbody>`;
  } else toggle('currentBlock', false);

  $('#taxline').textContent = 'Imposto: ' + res.tax.label + '.';
  const best = res.rows.find((r) => r.id === res.cheapest);
  $('#miniTxt').innerHTML = best ? `Menor preço: ${best.short} <b>${brl(best.targetPrice)}</b>` : 'Margem não fecha com esses custos';
  $('#wa').href = 'https://wa.me/?text=' + encodeURIComponent(shareText(res));
  saveRaw();
}

function shareText(res) {
  const i = res.input;
  const lines = [`Venda no Azul: produto de ${brl(i.cost)} + ${brl(i.extra)} de embalagem, margem de ${pct(i.targetMargin)}`];
  for (const r of res.rows) lines.push(`• ${r.name}: ${r.targetPrice === null ? 'margem não fecha' : brl(r.targetPrice) + ` (mínimo ${r.minPrice === null ? 'n/d' : brl(r.minPrice)})`}`);
  lines.push(`Imposto: ${res.tax.label}.`);
  lines.push(`Tarifas oficiais de ${CHECKED_AT.split('-').reverse().join('/')}. Calcule o seu: ${location.origin}${location.pathname}`);
  return lines.join('\n');
}

let timer = null;
form.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 120); if (!usedOnce) { usedOnce = true; track('calc'); } });
form.addEventListener('change', () => { render(); if (!usedOnce) { usedOnce = true; track('calc'); } });

const toast = (msg) => { const t = $('#toast'); t.textContent = msg; clearTimeout(toast.t); toast.t = setTimeout(() => { t.textContent = ''; }, 4000); };

$('#copy').addEventListener('click', async () => {
  const text = shareText(lastResult);
  try { await navigator.clipboard.writeText(text); toast('Resultado copiado. Cole onde quiser.'); } catch (e) {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Resultado copiado.'); } catch (x) { toast('Não deu para copiar: selecione o texto manualmente.'); }
    ta.remove();
  }
  track('copy');
});
$('#wa').addEventListener('click', () => track('whatsapp'));

function download(bytes, name, type) {
  const blob = new Blob([bytes], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
$('#dlXlsx').addEventListener('click', async () => {
  const { buildXlsx } = await import('./xlsx.js');
  download(buildXlsx(readState()), 'planilha-precificacao-mercado-livre-shopee-2026.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  toast('Planilha baixada. As células amarelas são editáveis.');
  track('download_xlsx');
});
$('#dlCsv').addEventListener('click', async () => {
  const { buildCsv } = await import('./xlsx.js');
  download(buildCsv(readState()), 'precificacao-mercado-livre-shopee-2026.csv', 'text/csv;charset=utf-8');
  toast('CSV baixado.');
  track('download_csv');
});

// Mobile bar: visible while the results card is off screen.
const minibar = $('#minibar');
if ('IntersectionObserver' in window) {
  let resultsVisible = false; let calcVisible = true;
  const upd = () => minibar.classList.toggle('show', !resultsVisible && calcVisible);
  new IntersectionObserver((e) => { resultsVisible = e[0].isIntersecting; upd(); }).observe($('#resultado'));
  new IntersectionObserver((e) => { calcVisible = e[0].isIntersecting; upd(); }).observe($('#f'));
  let wlSeen = false;
  new IntersectionObserver((e) => { if (!wlSeen && e[0].isIntersecting) { wlSeen = true; track('waitlist_open'); } }, { threshold: 0.4 }).observe($('#wlForm'));
}

// Waitlist SA-BR-01
const wl = $('#wlForm');
wl.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const msg = $('#wlMsg');
  const email = $('#wlEmail').value.trim();
  msg.className = 'wl-msg';
  if (!/^[^\s@<>()",;:]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,}$/.test(email)) { msg.classList.add('err'); msg.textContent = 'Confira o e-mail.'; $('#wlEmail').focus(); return; }
  if (!$('#wlConsent').checked) { msg.classList.add('err'); msg.textContent = 'Marque a caixa de consentimento para entrar na lista.'; return; }
  const btn = wl.querySelector('button[type=submit]');
  btn.disabled = true; msg.textContent = 'Enviando…';
  const q = new URLSearchParams(location.search);
  const body = {
    action: 'waitlist', email, volume: $('#wlVolume').value, marketplace: $('#wlMarket').value,
    consent: true, consent_version: CONSENT_VERSION, hp: wl.elements.website.value,
    page: location.pathname, ref_domain: document.referrer.split('/')[2] || '', utm_source: q.get('utm_source') || '',
    device: innerWidth < 768 ? 'mobile' : 'desktop',
  };
  try {
    const r = await fetch(window.VNA_API + '?action=waitlist', { method: 'POST', credentials: 'omit', body: JSON.stringify(body) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'erro');
    msg.classList.add('ok');
    msg.textContent = j.already ? 'Esse e-mail já estava na lista. Avisaremos quando o teste abrir.' : 'Pronto, você está na lista. Avisaremos por e-mail quando o teste abrir.';
    wl.reset();
  } catch (e) {
    msg.classList.add('err');
    msg.textContent = 'Não deu certo agora. Tente de novo em instantes ou escreva para octave@vread.fr.';
  } finally { btn.disabled = false; }
});

restoreRaw();
render();
