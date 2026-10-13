// Behaviour of docs/assets/mesure.js in a fake browser (bots, webdriver, prerender, octave_notrack, DNT).
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../docs/assets/mesure.js', import.meta.url), 'utf8');
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const GOOGLEBOT = 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

function run({ ua = CHROME, webdriver = false, search = '', store = {}, prerendering = false, visibility = 'visible', dnt = '' } = {}) {
  const sent = [], listeners = {};
  const doc = {
    referrer: 'https://www.google.com/', prerendering, visibilityState: visibility,
    addEventListener: (k, f) => { (listeners[k] ||= []).push(f); }, removeEventListener: (k, f) => { listeners[k] = (listeners[k] || []).filter((g) => g !== f); },
  };
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const ctx = {
    navigator: { userAgent: ua, webdriver, doNotTrack: dnt }, document: doc, localStorage: ls, innerWidth: 1200, URLSearchParams, JSON, Date, String,
    location: { hostname: 'outils.vread.fr', pathname: '/venda-no-azul/', search },
    fetch: (u, o) => { sent.push(JSON.parse(o.body)); assert.equal(o.credentials, 'omit'); return Promise.resolve(); },
  };
  ctx.window = ctx;
  vm.runInNewContext(src, ctx);
  const fire = (k) => (listeners[k] || []).slice().forEach((f) => f({}));
  return { sent, store, fire, doc, ctx };
}

test('a normal visit is counted and the user agent is never sent', () => {
  const r = run();
  assert.deepEqual(r.sent.map((b) => b.event), ['view']);
  assert.ok(r.sent.every((b) => !('excluded' in b)));
  assert.ok(!JSON.stringify(r.sent).includes('Chrome'));
  r.ctx.vnaTrack('calc');
  assert.equal(r.sent[1].event, 'calc');
});

test('webdriver, crawlers and headless browsers are flagged, not counted as visits', () => {
  assert.ok(run({ webdriver: true }).sent.every((b) => b.excluded === 'webdriver'));
  const g = run({ ua: GOOGLEBOT });
  assert.ok(g.sent.length && g.sent.every((b) => b.excluded === 'bot'));
  assert.ok(!JSON.stringify(g.sent).includes('Googlebot'));
  assert.equal(g.ctx.VNA_EXCLUDED, 'bot');
  assert.ok(run({ ua: CHROME.replace('Chrome/', 'HeadlessChrome/') }).sent.every((b) => b.excluded === 'bot'));
});

test('octave_notrack=1 (query, remembered; =0 clears) flags our own tests', () => {
  let r = run({ search: '?octave_notrack=1' });
  assert.ok(r.sent.length && r.sent.every((b) => b.excluded === 'notrack'));
  assert.equal(r.store.octave_notrack, '1');
  assert.ok(run({ store: { octave_notrack: '1' } }).sent.every((b) => b.excluded === 'notrack'));
  r = run({ search: '?octave_notrack=0', store: { octave_notrack: '1' } });
  assert.ok(r.sent.every((b) => !('excluded' in b)) && !('octave_notrack' in r.store));
});

test('Do Not Track: nothing at all', () => { assert.equal(run({ dnt: '1' }).sent.length, 0); });

test('prerendered pages count only once opened', () => {
  let r = run({ prerendering: true });
  assert.equal(r.sent.length, 0);
  r.fire('prerenderingchange');
  assert.deepEqual(r.sent.map((b) => b.event), ['view']);
  r = run({ visibility: 'prerender' });
  assert.equal(r.sent.length, 0);
  r.doc.visibilityState = 'visible'; r.fire('visibilitychange'); r.fire('visibilitychange');
  assert.equal(r.sent.length, 1);
});
