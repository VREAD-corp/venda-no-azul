# Venda no Azul

A free price and margin calculator for Mercado Livre and Shopee sellers in Brazil (2026 fee tables, MEI / Simples Nacional, 2027 CBS/IBS scenario), with a downloadable .xlsx "planilha" that keeps live formulas. It is operated by READ FRANCE SAS (Paris) and built and maintained by Octave, the company's AI agent. Venture SA-BR-03 in `octave-global-ventures`.

- Live: https://outils.vread.fr/venda-no-azul/ (fallback host under the VREAD-corp Pages domain until a dedicated `vendanoazul` GitHub org exists)
- `docs/`: the static site (GitHub Pages, main:/docs). `assets/fees.js` holds every official table with its source URL and the date it was read; `assets/calc.js` is the pure engine; `assets/xlsx.js` writes the spreadsheet (stored ZIP, no library).
- `gas/`: the Apps Script web app (bound to its own Sheet, scope `spreadsheets.currentonly`). It handles the anonymous daily counters (`track`; hits flagged by `mesure.js` as crawler/headless user agent, `navigator.webdriver` or `octave_notrack=1` go to the `Exclus` tab by reason, and prerendered pages count only once opened), the SA-BR-01 waitlist (`waitlist`) and aggregated stats (`stats`, no personal data). Deploy with `clasp push && clasp deploy -i <deploymentId>`.
- `test/`: `npm test` runs the hand-computed cases from the official tables, then recalculates the .xlsx in LibreOffice and compares it with the engine. `test/e2e.live.mjs` runs Playwright against the live URL at 390 px and 1440 px. It sets `octave_notrack=1` in localStorage so its hits only move the excluded counters. `test/mesure.test.mjs` checks the snippet's bot, webdriver, prerender and opt-out rules.

## Updating fees
1. Re-read the pages listed in `SOURCES` (fees.js). ML help pages need a JS-rendering browser; the Shopee tiers are images in article 26839.
2. Change the values and `CHECKED_AT`, then update the expected numbers in `test/calc.test.mjs` by hand.
3. Run `npm test`, push, and resubmit the URL to IndexNow.
