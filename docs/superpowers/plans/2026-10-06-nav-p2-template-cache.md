# Nav PRD Phase 2 — Template site-map cache + drift self-healing (plan)

PRD § Phase 2. Flag: `NAV_TEMPLATE_CACHE` (api: serve templates + accept drift; widget only uses templates when the API returns any).

## Key design decision — what a "template fingerprint" is
A per-page hash would change on every product (titles, prices). Instead each template stores a **skeleton**: the normalized `role|name` keys present on **every** sampled page of that type (e.g. `button|add to cart`, `spinbutton|quantity`, `link|shop`). Product-specific text drops out of the intersection automatically. At runtime the widget computes its page's keys and the **coverage** = |skeleton ∩ live| / |skeleton|.
- coverage ≥ 0.7 → page matches the template (cache hit).
- URL matches the template's pattern but coverage < 0.7 → **drift** (site changed) → report.

## DB (migration 0021, `packages/db/src/schema/siteTemplates.ts`)
`site_templates`: id, merchant_id, page_type, url_pattern (regex source), skeleton (jsonb string[]), recipes (jsonb), sample_urls (text[]), screenshots (jsonb {desktop, mobile} storage keys — reused by Phase 8 heatmaps), status (fresh|stale|scanning), drift_reports int, verify_failures int, scanned_at, updated_at. Unique (merchant_id, page_type).

## Widget
- `host/fingerprint.ts`: `snapshotKeys()` (shared normalization), `matchTemplate(keys, path, templates)` → {template, coverage, drift}.
- Expose `window.__shoppingmateNav__ = { keys, snapshot }` from the bundle (no data-id needed) so the crawler uses the SAME code.
- On `page_snapshot`: lazily fetch `/v1/site-templates/:merchantId` once per session; if matched, prepend `[template] <type> (<coverage>%) · recipes…` and collapse static chrome (header/footer nav links that are in the skeleton) into one line — the payload win; if drift, POST `/v1/site-templates/:merchantId/drift` once per template per session.

## API (`apps/api/src/routes/siteTemplates.ts`)
- `GET /v1/site-templates/:merchantId` → fresh/stale templates (skeleton, recipes, urlPattern), cache headers.
- `POST /v1/site-templates/:merchantId/drift` {templateId, coverage, url, sessionId, kind: drift|verify} → Redis set per template of distinct sessions; ≥3 drift sessions or ≥2 verify failures → status `stale` + enqueue scan for that page type (rate limit 1 scan / template / 6 h).

## Worker
- `worker.Dockerfile`: install Chromium for Playwright.
- Queue `site-template-scan` (`packages/jobs`), job `runScanSiteTemplates({merchantId, pageType?})`: pick ≤3 sample URLs per page type from `site_pages` (fallback: URL heuristics from home links), load each in Playwright with the live widget bundle injected (merchant's own widget script blocked so no sessions are created), collect keys, intersect → skeleton, derive recipes (add-to-cart / buy-now / variant group / quantity / checkout), screenshot desktop + mobile (full page, R2), upsert template.
- Weekly cron re-scan for site-graph merchants.

## Dashboard
- `/app/site-graph`: "Site scan" card — templates (type, last scanned, status), "Re-scan my site" button (`POST /api/site-templates/rescan` → queue), plain-language notice when a drift-triggered re-scan happened.

## Acceptance
Calmosis scanned (home, plp, pdp templates); live widget reports matched template on PDP; payload drops; simulated drift (coverage < 0.7 from a mutated page) → stale → re-scan → fresh, all visible in logs.
