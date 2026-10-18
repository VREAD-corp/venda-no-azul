/**
 * Venda no Azul: backend Apps Script (web app, executes as the owner, anonymous access).
 * Operated by READ FRANCE SAS (Paris). Bound to its own spreadsheet; it needs only
 * the `spreadsheets.currentonly` scope.
 *
 * Actions (POST text/plain JSON, so no CORS preflight; or GET with the same fields):
 *  - track     cookieless anonymous counters (no IP, no user agent, no identifier), aggregated per day
 *              into the `Stats` tab, never one row per hit. Same approach as octave-checkout/Track.js.
 *              A hit flagged `excluded` by mesure.js (crawler or headless user agent, navigator.webdriver,
 *              or our own tests with octave_notrack=1) goes to the `Exclus` tab by reason instead.
 *  - waitlist  SA-BR-01 waitlist ("Responda perguntas do Mercado Livre com IA"): e-mail + 2 optional
 *              answers + explicit consent, one row per e-mail in the `ListaEspera` tab.
 *  - track with kind 'cro'  the once-per-page batch of cro.js (aggregate behaviour + A/B counters, src/Cro.js,
 *              vendored byte-identical from octave-checkout) into the `Comportement` / `Experiences` tabs.
 *  - cro       aggregated behaviour and A/B summary (key: Script Property CRO_KEY_SHA256, never in git).
 *  - cro_init  (POST only) stores the SHA-256 of the read key once; refuses afterwards.
 *  - stats     (GET, public) today's aggregated counters (counted and excluded, views raw vs filtered) and
 *              the number of waitlist rows. No personal data; behaviour data is read only through `cro`.
 * Helpers end with "_" so they cannot be called through google.script.run.
 */

var SITE_ = 'venda-no-azul';
var EVENTS_ = ['view', 'calc', 'copy', 'whatsapp', 'download_csv', 'download_xlsx', 'waitlist_open'];
var SERVER_EVENTS_ = ['waitlist_signup'];
var STATS_TAB_ = 'Stats';
var STATS_HEADER_ = ['date', 'site', 'page', 'event', 'source', 'medium', 'campaign', 'count', 'mobile', 'desktop', 'updated_at'];
var STATS_KEYS_ = 7;
var EXCL_TAB_ = 'Exclus';
var EXCL_HEADER_ = ['date', 'site', 'page', 'event', 'reason', 'count', 'mobile', 'desktop', 'updated_at'];
var EXCL_KEYS_ = 5;
// Decided in the browser (the user agent is never sent); 'legacy' = a hit without v, i.e. from a cached pre-filter
// mesure.js, which search-engine renderers keep using.
var EXCL_REASONS_ = ['webdriver', 'bot', 'notrack', 'legacy'];
var WL_TAB_ = 'ListaEspera';
var WL_HEADER_ = ['created_at', 'email', 'volume', 'marketplace', 'consent_version', 'page', 'source'];
var OWN_HOSTS_ = ['venda.jalonel.com'];
var EMAIL_RE_ = /^[^\s@<>()",;:]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,}$/;
var CONSENT_VERSIONS_ = ['v1-2026-10-13'];
var VOLUMES_ = ['', 'ate5', '5a20', '20a50', 'mais50'];
var MARKETS_ = ['', 'ml', 'shopee', 'ambos'];
var RATE_TRACK_ = 300;   // hits per minute, all pages
var RATE_WL_ = 20;       // sign-ups per minute

// cro.js behaviour counters and A/B results (src/Cro.js): same spreadsheet, same day boundary as Stats.
var CRO_SITES_ = [SITE_];
var CRO_EXPERIMENTS_ = {}; // {expId: [variants]}: add an entry when the site's OCTAVE_XP config starts an experiment
var CRO_TZ_ = 'America/Sao_Paulo';
function croBook_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function doGet(e) { return route_((e && e.parameter) || {}, false); }

function doPost(e) {
  var raw = e && e.postData && e.postData.contents;
  var body = {};
  if (raw) {
    try { body = JSON.parse(raw); } catch (err) { return json_({ ok: false, error: 'bad_json' }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json_({ ok: false, error: 'bad_json' });
  }
  var params = (e && e.parameter) || {};
  if (!body.action && params.action) body.action = params.action;
  return route_(body, true);
}

function route_(req, post) {
  try {
    switch (String(req.action || '')) {
      case 'track': return json_(req.kind === 'cro' ? croTrack_(req) : track_(req));
      case 'cro': return json_(croAction_(req));
      case 'cro_init': return json_(post ? croInit_(req) : { ok: false, error: 'method_not_allowed' });
      case 'waitlist': return json_(waitlist_(req));
      case 'stats': return json_(stats_());
      default: return json_({ ok: false, error: 'unknown_action' });
    }
  } catch (err) {
    if (err && err.userError) return json_({ ok: false, error: err.code });
    console.error(String((err && err.stack) || err));
    return json_({ ok: false, error: 'server_error' });
  }
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function userError_(code) { var e = new Error(code); e.userError = true; e.code = code; return e; }
function now_() { return new Date(); }
function day_(d) { return Utilities.formatDate(d, 'America/Sao_Paulo', 'yyyy-MM-dd'); }
/** Text cell that a spreadsheet will never interpret as a formula, number or date. */
function txt_(v) { var s = String(v === undefined || v === null ? '' : v); return /^[=+\-@0-9]/.test(s) ? "'" + s : s; }
function cell_(v) { return v instanceof Date ? day_(v) : String(v === undefined || v === null ? '' : v); }

function tab_(name, header) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function token_(v, max) {
  if (v === undefined || v === null) return '';
  return String(v).toLowerCase().replace(/[^a-z0-9._ -]+/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function page_(p) {
  p = String(p === undefined || p === null ? '' : p).slice(0, 300).toLowerCase().replace(/[?#].*$/, '');
  if (!/^\/[a-z0-9\/._%~-]*$/.test(p)) throw userError_('bad_request');
  p = p.replace(/^\/venda-no-azul(?=\/|$)/, '') || '/';
  return p.replace(/\/index\.html$/, '/').replace(/\/{2,}/g, '/').slice(0, 80) || '/';
}

function rateOk_(kind, limit) {
  var cache = CacheService.getScriptCache();
  var k = 'rate:' + kind + ':' + Math.floor(now_().getTime() / 60000);
  var n = Number(cache.get(k) || 0);
  if (n >= limit) return false;
  cache.put(k, String(n + 1), 120);
  return true;
}

function source_(req) {
  var ref = String(req.ref_domain || '').toLowerCase().replace(/^www\./, '');
  if (ref && !/^[a-z0-9.-]{1,100}$/.test(ref)) ref = '';
  if (OWN_HOSTS_.indexOf(ref) >= 0) ref = '(interno)';
  return token_(req.utm_source, 50) || ref || '(direto)';
}

/* ------------------------------------------------------------------ */
/* Tracking                                                            */
/* ------------------------------------------------------------------ */

function track_(req) {
  var event = String(req.event || '');
  if (EVENTS_.indexOf(event) < 0) throw userError_('bad_request');
  if (req.ts !== undefined && req.ts !== null && req.ts !== '') {
    var ts = Number(req.ts);
    if (!isFinite(ts) || Math.abs(ts - now_().getTime()) > 2 * 86400 * 1000) throw userError_('bad_request');
  }
  var hit = {
    date: day_(now_()), site: SITE_, page: page_(req.page), event: event, source: source_(req),
    medium: token_(req.utm_medium, 30), campaign: token_(req.utm_campaign, 50),
    device: req.device === 'mobile' || req.device === 'desktop' ? req.device : '',
  };
  var reason = req.v ? excludedReason_(req) : 'legacy';
  if (!rateOk_('track', RATE_TRACK_)) return { ok: false, error: 'rate_limited' };
  withLock_(function () { if (reason) incrementExcluded_(hit, reason); else increment_(hit); });
  return { ok: true };
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) throw userError_('busy');
  try { return fn(); } finally { lock.releaseLock(); }
}

/** '' for a visit, else why the hit is not one (unknown flags count as 'bot'). */
function excludedReason_(req) {
  if (!req.excluded) return '';
  return EXCL_REASONS_.indexOf(String(req.excluded)) >= 0 ? String(req.excluded) : 'bot';
}

/** Caller holds the lock. Increments the day's counter row for this key, or appends it. */
function increment_(h) {
  incrementRow_(STATS_TAB_, STATS_HEADER_, STATS_KEYS_, [h.date, h.site, h.page, h.event, h.source, h.medium, h.campaign], h.device);
}

/** Caller holds the lock. Same daily counters for hits that are not visits, keyed by reason. */
function incrementExcluded_(h, reason) {
  incrementRow_(EXCL_TAB_, EXCL_HEADER_, EXCL_KEYS_, [h.date, h.site, h.page, h.event, reason], h.device);
}

function incrementRow_(name, header, nKeys, keys, device) {
  var sh = tab_(name, header);
  var key = keys.join('\u001f');
  var h = { date: keys[0], device: device };
  var last = sh.getLastRow();
  var row = 0;
  var n = Math.min(Math.max(last - 1, 0), 2000);
  if (n > 0) {
    var vals = sh.getRange(last - n + 1, 1, n, nKeys).getValues();
    for (var i = vals.length - 1; i >= 0; i--) {
      if (cell_(vals[i][0]) < h.date) break;
      if (vals[i].map(cell_).join('\u001f') === key) { row = last - n + 1 + i; break; }
    }
  }
  if (!row) {
    sh.appendRow(keys.map(txt_).concat([1, h.device === 'mobile' ? 1 : 0, h.device === 'desktop' ? 1 : 0, now_().toISOString()]));
  } else {
    var c = sh.getRange(row, nKeys + 1, 1, 3).getValues()[0];
    sh.getRange(row, nKeys + 1, 1, 4).setValues([[Number(c[0] || 0) + 1,
      Number(c[1] || 0) + (h.device === 'mobile' ? 1 : 0), Number(c[2] || 0) + (h.device === 'desktop' ? 1 : 0), now_().toISOString()]]);
  }
}

/* ------------------------------------------------------------------ */
/* Waitlist SA-BR-01                                                   */
/* ------------------------------------------------------------------ */

function waitlist_(req) {
  if (req.hp) return { ok: true };                       // honeypot: pretend success, store nothing
  var email = String(req.email || '').trim().toLowerCase();
  if (!EMAIL_RE_.test(email) || email.length > 254) throw userError_('bad_email');
  if (req.consent !== true || CONSENT_VERSIONS_.indexOf(String(req.consent_version)) < 0) throw userError_('consent_required');
  var volume = String(req.volume || ''); if (VOLUMES_.indexOf(volume) < 0) volume = '';
  var market = String(req.marketplace || ''); if (MARKETS_.indexOf(market) < 0) market = '';
  var page = page_(req.page || '/');
  if (!rateOk_('wl', RATE_WL_)) throw userError_('rate_limited');
  return withLock_(function () {
    var sh = tab_(WL_TAB_, WL_HEADER_);
    var last = sh.getLastRow();
    if (last > 1) {
      var emails = sh.getRange(2, 2, last - 1, 1).getValues();
      for (var i = 0; i < emails.length; i++) if (String(emails[i][0]).replace(/^'/, '') === email) return { ok: true, already: true };
    }
    sh.appendRow([now_().toISOString(), txt_(email), volume, market, String(req.consent_version), txt_(page), txt_(source_(req))]);
    var sh2 = { date: day_(now_()), site: SITE_, page: page, event: 'waitlist_signup', source: '(servidor)', medium: '', campaign: '',
      device: req.device === 'mobile' || req.device === 'desktop' ? req.device : '' };
    var reason = excludedReason_(req);
    if (reason) incrementExcluded_(sh2, reason); else increment_(sh2);
    return { ok: true };
  });
}

/* ------------------------------------------------------------------ */
/* Aggregated stats (no personal data)                                 */
/* ------------------------------------------------------------------ */

function stats_() {
  var date = day_(now_());
  var sh = tab_(STATS_TAB_, STATS_HEADER_);
  var last = sh.getLastRow();
  var out = {};
  var n = Math.min(Math.max(last - 1, 0), 5000);
  if (n > 0) {
    var vals = sh.getRange(last - n + 1, 1, n, STATS_HEADER_.length).getValues();
    for (var i = 0; i < vals.length; i++) {
      if (cell_(vals[i][0]) !== date) continue;
      var k = cell_(vals[i][2]).replace(/^'/, '') + ' ' + vals[i][3];
      out[k] = (out[k] || 0) + Number(vals[i][7] || 0);
    }
  }
  var excluded = {}, views = { counted: 0, excluded: 0 };
  Object.keys(out).forEach(function (k) { if (/ view$/.test(k)) views.counted += out[k]; });
  var ex = tab_(EXCL_TAB_, EXCL_HEADER_);
  var m = Math.min(Math.max(ex.getLastRow() - 1, 0), 5000);
  if (m > 0) {
    ex.getRange(ex.getLastRow() - m + 1, 1, m, EXCL_HEADER_.length).getValues().forEach(function (r) {
      if (cell_(r[0]) !== date) return;
      var k = cell_(r[2]).replace(/^'/, '') + ' ' + r[3] + '|' + r[4];
      excluded[k] = (excluded[k] || 0) + Number(r[5] || 0);
      if (r[3] === 'view') views.excluded += Number(r[5] || 0);
    });
  }
  views.raw = views.counted + views.excluded;
  var wl = tab_(WL_TAB_, WL_HEADER_);
  return { ok: true, day: date, counters: out, excluded: excluded, views: views, waitlist_total: Math.max(wl.getLastRow() - 1, 0), events: EVENTS_.concat(SERVER_EVENTS_) };
}

/** Run once from the editor (or let the first request do it): creates both tabs with headers. */
function setup() {
  tab_(STATS_TAB_, STATS_HEADER_);
  tab_(EXCL_TAB_, EXCL_HEADER_);
  tab_(WL_TAB_, WL_HEADER_);
  var first = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sheet1') || SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Página1') || SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Feuille 1');
  if (first && SpreadsheetApp.getActiveSpreadsheet().getSheets().length > 2) SpreadsheetApp.getActiveSpreadsheet().deleteSheet(first);
  return 'ok';
}
