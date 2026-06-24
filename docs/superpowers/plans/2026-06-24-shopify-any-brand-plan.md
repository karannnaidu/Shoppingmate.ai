# Implementation plan — shoppingmate on any Shopify store

**Spec:** `docs/superpowers/specs/2026-06-24-shopify-any-brand-design.md`
**Approach:** Build in repo with unit/integration tests (mocked Shopify); Calmosis path untouched; gate everything on `merchant.platform === 'shopify'`. Go-live needs the 3 merchant handoffs (custom-app token + script tag).

Legend: ☐ todo · ✅ done. Each phase ends green (typecheck + tests) before the next.

---

## Phase 0 — Data model + config
- ☐ Add `shopifyDomain`, `shopifyAdminTokenEnc` to `merchants` schema + migration.
- ☐ Token encryption helper (reuse existing secret/HMAC util or AES-GCM with an env key) in `packages/db` or `packages/shared`.
- ☐ `isShopify(merchant)` helper + `merchantCanMutateCart` returns true for shopify.

## Phase 1 — Spec 1: Shopify transactional foundation  ✅ DONE (commit on feat/shopify-any-brand)
- ✅ `packages/widget/src/shopifyCart.ts`: `shopifyCartAdd/Get/SetQty/Clear/ApplyCoupon` via Cart AJAX; each verify-after-read; return `HostActionResult` (cart_get → `values:{count,items,subtotal}`).
- ✅ Platform routing in `packages/widget/src/host/actions.ts` (`setHostPlatform` + `window.Shopify` auto-detect) → cart actions route to `shopifyCart` on Shopify, custom hooks otherwise.
- ✅ `open_cart` → `/cart` nav on Shopify. Calmosis-only `checkout_fill/place/state` already gated off for non-Calmosis.
- ✅ Bootstrap threads `platform` from the install response into `setHostPlatform`.
- ✅ Tests: 9 new (add+verify, sold-out, non-numeric ref, get mapping, clear, coupon, routing). 141 widget tests green.
- ☐ (deferred to Phase 4) Native-checkout instruction (bot → `/checkout`) is a PROMPT concern.

> **Discovery (2026-06-24):** much Shopify plumbing ALREADY exists and is reusable:
> `apps/worker/src/steps/catalogClients/shopify.ts` (catalog client), `apps/api/src/routes/webhooks/shopify.ts` (+orders attribution via `services/attributeOrder.ts`), `packages/adapters/src/shopify.ts` (adapter), `apps/worker/src/handlers/onboarding.ts` (platform detection), `web/src/app/api/composio/connect-shopify/route.ts`, and `merchants.platform` enum. Phases 2–3 are mostly **wire-up + generalize**, not greenfield — must reconcile with these before editing.

## Phase 2 — Spec 2a: Catalog sync (Admin GraphQL)
- ☐ `packages/adapters/src/shopifyAdmin.ts` (or extend `shopify.ts`): Admin GraphQL client using per-merchant token; `bulkPullProducts()` → {title, descriptionHtml→text, priceRange, featuredImage, variants[{id, sku, price, title}], tags, collections}.
- ☐ `apps/worker` job `syncShopifyCatalog`: upsert into `products` (populate numeric `variantId`, sku, price, image, tags). Idempotent.
- ☐ Webhook handlers in `apps/api`: `products/create|update|delete` → upsert/delete product rows (HMAC-verified).
- ☐ Variant resolution: generic `resolveVariant(merchant, ref)` — Calmosis → `normalizeCalmosisSku`; shopify → fuzzy match `ref` against synced product titles/SKUs → `variantId`. Wire into `cart.add` dispatch.
- ☐ Tests: mock Admin GraphQL payload → assert product rows + variant ids; webhook upsert/delete; variant fuzzy match.

## Phase 3 — Spec 2b: Brand-data auto-crawl + generation
- ☐ `syncShopifyBrand` job: crawl shop home + `/policies/*` + linked About/FAQ/shipping/returns pages (reuse `crawlSite`).
- ☐ `generateBrandProfile(merchant, crawledText, collections)`: one LLM call → `{brand_summary, brand_categories}` in Calmosis's shape; persist to `merchants`.
- ☐ KB ingest: chunk + store crawled FAQ/policy/education pages → `brand_kb_chunks` (reuse `ingestKbDoc`).
- ☐ Site graph: run existing `extractSiteGraph` over crawled pages.
- ☐ Tests: mock crawl text + LLM → assert summary/categories persisted, KB chunked, categories drive industry detection.

## Phase 4 — Spec 2c: Prompt generalization (de-Calmosis)
- ☐ Refactor `packages/agent/src/prompts/system.ts` + `voice-instructions.ts`: extract Calmosis-hardcoded blocks behind `isCalmosisStitch`; add generic brand-parameterized equivalents (opening line from brandName+summary; transactional flow for any `merchantCanMutateCart`; usage info from KB only).
- ☐ Industry feature auto-detection helpers: `brandHasConsultation(merchant)` (health/wellness categories or KB keywords), `brandHasSubscription(merchant)` (subscription product types/tags). Include the consultation/contact + membership-upsell blocks only when detected.
- ☐ Generic checkout instruction for shopify: "drive them to the checkout page; Shopify handles payment" (no fill/place).
- ☐ Tests: snapshot generated system + voice prompts for synthetic brands — (a) apparel (no consultation, no dosage, native checkout), (b) supplements (consultation on), (c) Calmosis (unchanged); assert tool surface matches.

## Phase 5 — Spec 3: Attribution + onboarding UX
- ☐ `orders/create` webhook → reuse conversion attribution (visitor→session→recommended SKU); record `conversion.ingested`.
- ☐ Dashboard onboarding page (`web`): connect form (domain + token), trigger sync, show sync/crawl status, copy-paste widget snippet.
- ☐ Tests: webhook attribution; onboarding route happy-path (mocked).

## Phase 6 — Verification + deploy
- ☐ Full typecheck + all package test suites green.
- ☐ Deploy api + worker + voice-agent (Railway) + web/widget (Vercel).
- ☐ Write `docs/runbooks/shopify-onboarding.md` — the 3 merchant steps + scopes.
- ☐ Hand off: provide a checklist for connecting a real store; live smoke once a store+token is supplied.

---

## Sequencing notes
- Phases 1→4 are the critical path to "bot works on a Shopify store with its own data". 5 adds revenue proof. 6 ships.
- Each phase is independently testable with mocked Shopify; no live store needed until Phase 6 handoff.
- Calmosis regression guard: its 243 agent / 52 voice / 132 widget tests must stay green throughout.
