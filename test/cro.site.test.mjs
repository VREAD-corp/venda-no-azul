// cro.js wiring on every page of the site, and the backend's CRO settings (no price test on this site).
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const mesure = read('docs/assets/mesure.js');
const API = mesure.match(/https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec/)[0];
const HOSTS = JSON.parse('[' + mesure.match(/\[('[^\]]+')\]\.indexOf\(l\.hostname\)/)[1].replace(/'/g, '"') + ']');
const PAGES = fs.readdirSync(new URL('../docs/', import.meta.url)).filter((f) => f.endsWith('.html') && !/^google[0-9a-f]+\.html$/.test(f));

test('every page loads cro.js (classic script, same backend and hosts as mesure.js, before mesure.js and app.js)', () => {
  assert.ok(PAGES.includes('index.html') && PAGES.includes('privacidade.html'));
  for (const f of PAGES) {
    const html = read('docs/' + f);
    const tag = (html.match(/<script src="assets\/cro\.js"[^>]*><\/script>/) || [])[0];
    assert.ok(tag, f + ': cro.js tag');
    assert.ok(!/type="module"/.test(tag), f + ': classic script');
    assert.match(tag, /data-site="venda-no-azul"/);
    assert.equal(tag.match(/data-api="([^"]+)"/)[1], API, f + ': same Apps Script as mesure.js');
    assert.deepEqual(tag.match(/data-hosts="([^"]+)"/)[1].split(' '), HOSTS, f + ': same hosts as mesure.js');
    assert.ok(html.indexOf(tag) < html.indexOf('assets/mesure.js'), f + ': before mesure.js');
    if (html.includes('assets/app.js')) assert.ok(html.indexOf(tag) < html.indexOf('assets/app.js'), f + ': before app.js');
    assert.ok(!html.includes('OCTAVE_XP'), f + ': no experiment configured (the site has no price test)');
  }
});

test('index: measurable sections, FAQ ids, named forms, CTA selector', () => {
  const html = read('docs/index.html');
  for (const s of ['hero', 'calculadora', 'resultado']) assert.match(html, new RegExp(`data-section="${s}"`));
  for (const s of ['o-que-entra', 'tarifas-2026', 'cbs-2027', 'lista-ia', 'perguntas']) assert.match(html, new RegExp(`<section[^>]* id="${s}"`));
  assert.equal((html.match(/<details>/g) || []).length, 0, 'every FAQ item has an id');
  assert.match(html, /<form id="calc"/); assert.match(html, /<form id="wlForm"/);
  assert.match(html, /data-cta="\.btn"/);
});

test('goals: waitlist on a successful response, download on xlsx and CSV', () => {
  const app = read('docs/assets/app.js');
  assert.match(app, /if \(!j\.ok\) throw[^\n]*\n\s*window\.octaveCro && window\.octaveCro\.goal\('waitlist'\)/);
  assert.equal((app.match(/goal\('download'\)/g) || []).length, 2);
});

test('without OCTAVE_XP no variant is drawn, nothing is stored, octaveCro is ready', () => {
  const src = read('docs/assets/cro.js');
  const html = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  const session = {};
  const ctx = {
    document: { currentScript: { dataset: { site: 'venda-no-azul', api: API, hosts: HOSTS.join(' ') } }, readyState: 'complete', documentElement: html, querySelectorAll: () => [], addEventListener() {} },
    navigator: { userAgent: 'Mozilla/5.0 Chrome/141', webdriver: false }, location: { hostname: 'outils.vread.fr', pathname: '/venda-no-azul/', search: '?octave_notrack=1' },
    sessionStorage: { getItem: (k) => session[k] ?? null, setItem: (k, v) => { session[k] = v; } }, localStorage: { getItem: () => null },
    URLSearchParams, addEventListener() {}, fetch: () => { throw new Error('nothing is sent under octave_notrack=1'); },
  };
  ctx.window = ctx;
  vm.runInNewContext(src, ctx);
  assert.equal(typeof ctx.octaveCro.goal, 'function');
  assert.equal(ctx.octaveCro.v('price'), undefined);
  ctx.octaveCro.goal('waitlist');
  assert.deepEqual(session, {}); assert.deepEqual(html.attrs, {});
});

test('backend: CRO settings and routes', () => {
  const code = read('gas/src/Code.js');
  assert.match(code, /var CRO_SITES_ = \[SITE_\];/);
  assert.match(code, /var SITE_ = 'venda-no-azul';/);
  assert.match(code, /var CRO_EXPERIMENTS_ = \{\};/);
  assert.match(code, /var CRO_TZ_ = 'America\/Sao_Paulo';/);
  assert.match(code, /function croBook_\(\)/);
  assert.match(code, /case 'track': return json_\(req\.kind === 'cro' \? croTrack_\(req\) : track_\(req\)\);/);
  assert.match(code, /case 'cro': return json_\(croAction_\(req\)\);/);
  assert.match(code, /case 'cro_init': return json_\(post \? croInit_\(req\)/);
  assert.match(code, /cro: croSummary_\(date, date\)/);
});
