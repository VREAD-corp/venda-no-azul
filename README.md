# Venda no Azul

**Paused since 24/10/2026** (founders' decision, Jalonel refocus): noindex, banner, requests closed; tracking kept.

A free price and margin calculator for Mercado Livre and Shopee sellers in Brazil (2026 fee tables, MEI / Simples Nacional, 2027 CBS/IBS scenario), with a downloadable .xlsx "planilha" that keeps live formulas. It is a Jalonel brand site operated by READ FRANCE SAS (Paris) and built and maintained by Octave, the company's AI agent. Venture SA-BR-03 in `octave-global-ventures`.

- Live: https://venda.jalonel.com/ (brand Jalonel, a brand of READ FRANCE SAS; GitHub Pages custom domain, `docs/CNAME`). The old URLs redirect there (301). Contact: contact@jalonel.com. `mesure.js`, `cro.js` (`data-hosts`) and the backend's `OWN_HOSTS_` accept only `venda.jalonel.com`; `docs/assets/cro.js` is vendored byte-identical from octave-checkout `gas/web/jalonel/cro.js` (Jalonel copy, no default host; `test/cro.check.mjs` is its Jalonel check).
- 2026-10-16: moved to https://venda.jalonel.com/ (brand Jalonel, a brand of READ FRANCE SAS)
- `docs/`: the static site (GitHub Pages, main:/docs). `assets/fees.js` holds every official table with its source URL and the date it was read; `assets/calc.js` is the pure engine; `assets/xlsx.js` writes the spreadsheet (stored ZIP, no library).
- `gas/`: the Apps Script web app (bound to its own Sheet, scope `spreadsheets.currentonly`). It handles the anonymous daily counters (`track`; hits flagged by `mesure.js` as crawler/headless user agent, `navigator.webdriver` or `octave_notrack=1` go to the `Exclus` tab by reason, and prerendered pages count only once opened), the SA-BR-01 waitlist (`waitlist`) and aggregated stats (`stats`, no personal data; behaviour data only through the keyed `cro`). `src/Cro.js` (vendored byte-identical from octave-checkout) adds the behaviour and A/B counters of `docs/assets/cro.js` (`track` with `kind: 'cro'` → tabs `Comportement` / `Experiences`, daily totals only), the key-protected summary `cro` and `cro_init` (POST, stores the key's SHA-256 once). No A/B experiment runs on this site (`CRO_EXPERIMENTS_ = {}`, no `OCTAVE_XP`). Deploy with `clasp push && clasp deploy -i <deploymentId>`.
- `test/`: `npm test` runs the hand-computed cases from the official tables, then recalculates the .xlsx in LibreOffice and compares it with the engine. `test/e2e.live.mjs` runs Playwright against the live URL at 390 px and 1440 px. It sets `octave_notrack=1` in localStorage so its hits only move the excluded counters. `test/mesure.test.mjs` checks the snippet's bot, webdriver, prerender and opt-out rules. `test/cro.site.test.mjs` checks the cro.js wiring on every page and the backend settings; `npm test` also runs the shared `cro.check.mjs` / `cro-gas.check.mjs` on the vendored files.

## Updating fees
1. Re-read the pages listed in `SOURCES` (fees.js). ML help pages need a JS-rendering browser; the Shopee tiers are images in article 26839.
2. Change the values and `CHECKED_AT`, then update the expected numbers in `test/calc.test.mjs` by hand.
3. Run `npm test`, push, and resubmit the URL to IndexNow.
