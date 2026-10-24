// Playwright e2e on the LIVE site, 390 px and 1440 px.
// node test/e2e.live.mjs [baseUrl] [screenshotDir]
// PLAYWRIGHT_CORE can point to a playwright-core entry (defaults to the one vendored in octave-checkout).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { chromium } = await import(process.env.PLAYWRIGHT_CORE || '/home/vincent/clients/v-read/dev/octave-checkout/node_modules/playwright-core/index.mjs');
const BASE = process.argv[2] || 'https://venda.jalonel.com/';
const OUT = process.argv[3] || join(tmpdir(), 'vna-e2e');
mkdirSync(OUT, { recursive: true });
const API = (readFileSync(new URL('../docs/assets/mesure.js', import.meta.url), 'utf8').match(/https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec/) || [])[0];

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok === true ? 'PASS' : ok === null ? 'PEND' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };

async function stats() {
  try { const r = await fetch(API + '?action=stats'); const j = JSON.parse(await r.text()); return j.ok ? j : null; } catch { return null; }
}
// Our runs set octave_notrack=1, so their hits land in the excluded counters (reason notrack), never in visits.
const count = (s, page, ev) => (s && s.excluded && s.excluded[`${page} ${ev}|notrack`]) || 0;
const priceOf = async (p, id) => Number(await p.locator(`[data-testid="price-${id}"] .val`).getAttribute('data-value'));
const setVal = async (p, sel, v) => { await p.fill(sel, String(v)); await p.dispatchEvent(sel, 'change'); await p.waitForTimeout(250); };

const before = await stats();
check('GAS stats endpoint answers (owner consent given)', before ? true : null, before ? `waitlist_total=${before.waitlist_total}` : 'web app still asks for authorization');

const browser = await chromium.launch({ headless: true });
for (const [w, h, tag] of [[390, 844, 'mobile'], [1440, 900, 'desktop']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500, locale: 'pt-BR', acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  await ctx.addInitScript(() => localStorage.setItem('octave_notrack', '1'));
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  const trackPosts = [], flags = new Set(), croPosts = [], croLoads = [];
  p.on('request', (r) => { if (r.url().includes('action=track')) { const b = JSON.parse(r.postData() || '{}'); if (b.kind === 'cro') croPosts.push(b); else { trackPosts.push(b.event); flags.add(b.excluded); } } });
  p.on('response', (r) => { if (/\/assets\/cro\.js(\?|$)/.test(r.url())) croLoads.push(r.status()); });
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'networkidle' });
  // cro.js (behaviour counters + A/B): loaded, ready, no experiment on this site, nothing sent under octave_notrack=1.
  check(`[${tag}] cro.js loaded`, croLoads.includes(200), croLoads.join(','));
  check(`[${tag}] octaveCro ready, no variant drawn`, await p.evaluate(() => typeof window.octaveCro?.goal === 'function' && window.octaveCro.v('price') === undefined && ![...document.documentElement.attributes].some((a) => a.name.startsWith('data-xp-'))));
  check(`[${tag}] no horizontal scroll`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  check(`[${tag}] title`, /Calculadora Mercado Livre e Shopee 2026/.test(await p.title()));
  check(`[${tag}] canonical = ${BASE}`, (await p.getAttribute('link[rel=canonical]', 'href')) === BASE);
  check(`[${tag}] footer: Uma marca Jalonel`, (await p.locator('footer a[href="https://jalonel.com/en/"]').innerText()).trim() === 'Uma marca Jalonel');
  await p.screenshot({ path: join(OUT, `${tag}-top.png`) });

  // Case 1 (defaults): R$ 30 + 2, 0,3-0,5 kg, Clássico 14 %, Premium 19 %, Simples RBT12 120k (4 %), margin 15 %
  check(`[${tag}] case 1 ML Clássico = 60,08`, (await priceOf(p, 'mlClassico')) === 60.08);
  check(`[${tag}] case 1 ML Premium = 64,92`, (await priceOf(p, 'mlPremium')) === 64.92);
  check(`[${tag}] case 1 Shopee = 59,84`, (await priceOf(p, 'shopee')) === 59.84);
  check(`[${tag}] case 1 minimum ML Clássico = 47,50`, (await p.locator('[data-testid="min-mlClassico"]').innerText()).trim() === '47,50');
  check(`[${tag}] case 1 minimum Shopee = 48,03`, (await p.locator('[data-testid="min-shopee"]').innerText()).trim() === '48,03');

  // Case 2: MEI, DAS 82,05 / 50, cost 50, 1-1,5 kg, Premium 17 %, margin 20 %
  await setVal(p, '#cost', '50,00'); await setVal(p, '#extra', '0');
  await p.selectOption('#weightIdx', '3');
  await setVal(p, '#mlPremiumPct', '17'); await setVal(p, '#targetMargin', '20');
  await p.locator('input[name=regime][value=mei]').check({ force: true }); await p.waitForTimeout(300);
  check(`[${tag}] case 2 ML Premium = 109,20 (R$ 100-119,99 band)`, (await priceOf(p, 'mlPremium')) === 109.2);
  check(`[${tag}] case 2 Shopee = 108,55 (14 % + R$ 20)`, (await priceOf(p, 'shopee')) === 108.55);

  // Case 3: Simples RBT12 500k (6,728 %), Shopee CPF > 450 orders, cost 100 + 3, margin 10 %
  await p.locator('input[name=regime][value=simples]').check({ force: true });
  await setVal(p, '#rbt12', '500.000,00'); await setVal(p, '#cost', '100'); await setVal(p, '#extra', '3'); await setVal(p, '#targetMargin', '10');
  await p.locator('input[name=shopeeSeller][value=cpf]').check({ force: true }); await p.waitForTimeout(200);
  await p.check('#shopeeCpfOver450'); await p.waitForTimeout(300);
  check(`[${tag}] case 3 Shopee CPF = 181,90`, (await priceOf(p, 'shopee')) === 181.9);
  check(`[${tag}] case 3 Simples text`, /faixa 3/.test(await p.locator('#simplesOut').innerText()));

  // Back to case 1 + 2027 por fora, credit 100 %: ML Clássico 63,54
  await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'networkidle' });
  await p.check('#scenario2027'); await p.locator('input[name=simples2027][value=fora]').check({ force: true });
  await setVal(p, '#creditShare', '100');
  check(`[${tag}] case 4 2027 IBS/CBS por fora = 63,54`, (await priceOf(p, 'mlClassico')) === 63.54);
  await p.uncheck('#scenario2027'); await p.waitForTimeout(300);
  await setVal(p, '#currentPrice', '59,90');
  check(`[${tag}] current price block`, await p.locator('#currentBlock').isVisible());
  await p.locator('#resultado').screenshot({ path: join(OUT, `${tag}-results.png`) });

  // Downloads
  const [dx] = await Promise.all([p.waitForEvent('download'), p.click('[data-testid=dl-xlsx]')]);
  const xp = join(OUT, `${tag}.xlsx`); await dx.saveAs(xp);
  const xb = readFileSync(xp);
  check(`[${tag}] xlsx download is a ZIP`, xb[0] === 0x50 && xb[1] === 0x4b, `${xb.length} bytes`);
  try {
    execFileSync('soffice', ['--headless', '-env:UserInstallation=file://' + join(OUT, 'lo-' + tag), '--convert-to', 'csv:Text - txt - csv (StarCalc):59,34,76,1,,0,false,true,false,false,false,1', '--outdir', OUT, xp], { stdio: 'pipe', timeout: 90000 });
    const row = readFileSync(join(OUT, `${tag}-Calculadora.csv`), 'utf8').split('\n')[21];
    check(`[${tag}] xlsx recalculates in LibreOffice (row 22 = 60,08;64,92;59,84)`, /60,08.*64,92.*59,84/.test(row), row.slice(0, 80));
  } catch (e) { check(`[${tag}] xlsx recalculates in LibreOffice`, false, String(e.message).slice(0, 100)); }
  const [dc] = await Promise.all([p.waitForEvent('download'), p.click('[data-testid=dl-csv]')]);
  const cp = join(OUT, `${tag}.csv`); await dc.saveAs(cp);
  check(`[${tag}] csv download`, /Mercado Livre Clássico;47,50;60,08/.test(readFileSync(cp, 'utf8')));

  await p.click('[data-testid=copy]'); await p.waitForTimeout(400);
  const clip = await p.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  check(`[${tag}] copy result`, /Shopee: R\$ 59,84/.test(clip) || /copiado/.test(await p.locator('#toast').innerText()));
  const wa = await p.getAttribute('[data-testid=whatsapp]', 'href');
  check(`[${tag}] WhatsApp link`, wa.startsWith('https://wa.me/?text=') && decodeURIComponent(wa).includes('60,08'));

  // Waitlist: paused since 2026-10-24, the form is closed and nothing is sent
  await p.locator('#lista-ia').scrollIntoViewIfNeeded(); await p.waitForTimeout(600);
  check(`[${tag}] waitlist closed while paused`, await p.locator('[data-testid=wl-email]').isDisabled() && await p.locator('[data-testid=wl-submit]').isDisabled());
  await p.locator('#lista-ia').screenshot({ path: join(OUT, `${tag}-waitlist.png`) });
  await p.screenshot({ path: join(OUT, `${tag}-full.png`), fullPage: true });
  check(`[${tag}] tracking requests sent (view, calc, downloads, copy)`, ['view', 'calc', 'download_xlsx', 'download_csv', 'copy'].every((e) => trackPosts.includes(e)), trackPosts.join(','));
  await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(300);
  check(`[${tag}] cro.js sends nothing under octave_notrack=1`, croPosts.length === 0, String(croPosts.length));
  check(`[${tag}] every tracking hit is flagged octave_notrack`, flags.size === 1 && flags.has('notrack'), [...flags].join(','));
  check(`[${tag}] no JS errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}
await browser.close();

await new Promise((r) => setTimeout(r, 6000));
const after = await stats();
if (before && after) {
  const pg = '/';
  for (const ev of ['view', 'calc', 'download_xlsx', 'download_csv', 'copy']) check(`excluded (notrack) counter increments: ${ev}`, count(after, pg, ev) > count(before, pg, ev), `${count(before, pg, ev)} -> ${count(after, pg, ev)}`);
  check('waitlist rows unchanged (paused)', after.waitlist_total === before.waitlist_total, `${before.waitlist_total} -> ${after.waitlist_total}`);
} else check('tracking increments in the Sheet', null, 'pending owner consent of the Apps Script web app');

writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 1));
const fail = results.filter((r) => r.ok === false).length; const pend = results.filter((r) => r.ok === null).length;
console.log(`\n${results.length - fail - pend} pass, ${fail} fail, ${pend} pending. Screenshots: ${OUT}`);
process.exit(fail ? 1 : 0);
