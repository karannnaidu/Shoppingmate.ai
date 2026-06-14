# shoppingmate — Shopify App: Engineering & App Store Listing Plan

**Date:** 2026-06-12
**Companion to:** `2026-06-12-shoppingmate-gtm-international.md`
**Goal:** Ship shoppingmate as a public Shopify app (App Store–listed), with native, reliable add-to-cart/checkout, Shopify-managed billing, and a one-click install for international wellness/DTC merchants.

---

## 0. Why a Shopify app (vs. our current script-tag widget)

| Benefit | Detail |
|---|---|
| **Reliable transactions** | Native **Cart AJAX API** on the visitor's real cart → no DOM scraping, no faked actions. |
| **One-click install** | Merchant installs from App Store / direct link; no copy-paste snippet, no allowlisting. |
| **Shopify-managed billing** | Shopify collects payment globally (cards, local methods) and pays us out → solves "how do we bill international clients." **0% Shopify revenue share on first $1M/yr**, 15% after (validate current terms). |
| **Distribution** | App Store = organic install funnel for the GTM flywheel. |
| **Trust** | "Built for Shopify" badge + App Store review = credibility for a solo unknown founder. |
| **Catalog truth** | Admin API + webhooks keep our product index exactly in sync. |

---

## 1. Architecture overview

```
                       ┌──────────────────────────────────────────┐
                       │  SHOPIFY ADMIN (merchant)                  │
                       │  ┌────────────────────────────────────┐    │
   OAuth + App Bridge  │  │ Embedded Admin App (Polaris/Remix) │    │
   session tokens      │  │  - install/OAuth                   │    │
                       │  │  - config (persona, tiers, voice)  │    │
                       │  │  - dashboard (assisted revenue)    │    │
                       │  │  - billing (App Subscription API)  │    │
                       │  └────────────────────────────────────┘    │
                       └──────────────────────────────────────────┘
                                        │  Admin GraphQL + webhooks
                                        ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  shoppingmate BACKEND (existing: apps/api + packages/agent)    │
   │   - agent runtime (Sonnet tool-loop, tools.ts)                │
   │   - catalog sync service (NEW): products → DB + search_vector │
   │   - billing/webhook handlers (NEW)                            │
   │   - voice-agent (existing, premium tier)                      │
   └──────────────────────────────────────────────────────────────┘
                                        ▲  agent WS
                                        │
   ┌──────────────────────────────────────────────────────────────┐
   │  SHOPIFY STOREFRONT (shopper)                                  │
   │  ┌──────────────────────────┐   Theme App Extension           │
   │  │ Theme App Extension       │   (app embed block) injects ↓   │
   │  │  app embed block (loader) │                                 │
   │  └──────────────────────────┘                                 │
   │  ┌──────────────────────────────────────────────┐             │
   │  │ shoppingmate widget (existing packages/widget) │            │
   │  │  + Shopify Cart Bridge (NEW):                 │             │
   │  │    cart.add/get → /cart/add.js, /cart.js      │  (native,   │
   │  │    checkout → /checkout                        │   same-     │
   │  └──────────────────────────────────────────────┘   origin)   │
   └──────────────────────────────────────────────────────────────┘
```

**Key design decision — cart runs client-side on the visitor's real cart.** The existing `ShopifyAdapter` (`packages/adapters/src/shopify.ts`) drives the Cart AJAX API server-side via a cookie jar; that risks "server cart ≠ the visitor's actual cart." For the storefront widget we instead execute cart actions **client-side in the widget** (host-action style, like `site.navigate`) against `/cart/*.js` on the shopper's own session. The agent decides *what* to add; the widget performs it on the real cart; checkout is the merchant's native `/checkout`. The server-side `ShopifyAdapter` stays as a fallback / for server-driven flows.

---

## 2. What we already have vs. what to build

| Component | Status | Action |
|---|---|---|
| Agent runtime + tool surface (`packages/agent`) | ✅ exists | Reuse; cart.add becomes a client host-action on Shopify (like site.navigate). |
| Embeddable widget (`packages/widget`) | ✅ exists | Add a **Shopify Cart Bridge** module; load via theme app extension. |
| ShopifyAdapter (Cart AJAX) | ✅ exists | Keep as fallback; primary cart path moves client-side. |
| Catalog in DB + `search_vector` | ✅ exists | Feed it from Shopify catalog sync. |
| Voice-agent | ✅ exists | Premium tier; same embed. |
| **Embedded Admin App (OAuth/Polaris/billing/dashboard)** | ❌ build | New app (Shopify CLI Remix template). |
| **Theme App Extension (app embed block)** | ❌ build | New extension that injects the widget. |
| **Catalog sync (Admin API + webhooks)** | ❌ build | New service in `apps/api`. |
| **Billing (App Subscription API)** | ❌ build | In the admin app. |
| **GDPR/compliance webhooks** | ❌ build | `customers/data_request`, `customers/redact`, `shop/redact`, `app/uninstalled`. |
| **Install-time E2E gate** | ❌ build | Smoke that completes add-to-cart on the merchant's real store before enabling transactional. |

---

## 3. Shopify integration details

### 3.1 App type & scaffolding
- **Public app** (App Store), scaffolded with **Shopify CLI** (`shopify app init`, Remix template) → gives OAuth, App Bridge, webhooks, session-token auth out of the box.
- `shopify app generate extension` → **Theme App Extension** for the storefront widget.
- Host: admin app on Railway/Vercel next to existing services.

### 3.2 OAuth & scopes (least privilege)
- `read_products` (catalog sync), `read_orders` (assisted-revenue attribution), `read_themes`/theme app extension (no write needed for app embed), `read_customers` only if required.
- Offline token (catalog sync/webhooks) + online token/session tokens (embedded admin via App Bridge).

### 3.3 Storefront widget injection
- **Theme App Extension → app embed block** (Online Store 2.0). Merchant toggles it on in Theme Editor; no Liquid edits, no ScriptTag (legacy/avoid). The block injects our widget loader with `shop` + app proxy/backend URL.
- Lazy/async load; tiny loader; widget bundle code-split → protect storefront Web Vitals (App Store performance requirement).

### 3.4 Cart & checkout (the reliable core)
- Client-side in widget via **Cart AJAX API**: `/cart/add.js` (variantId, qty), `/cart.js` (read), `/cart/change.js` (update). Operates on the shopper's real cart.
- Add-to-cart **verifies state change** (re-read `/cart.js`, confirm line + count) before the agent claims success. *Never claim an unverified action.*
- Checkout = redirect to native `/checkout` (cart already populated). We never host payment.
- Discounts via `/discount/{code}` then checkout.

### 3.5 Catalog sync
- On install: bulk pull products/variants via **Admin GraphQL** → upsert into `products` (sku, variantId, title, price, image, url) → rebuild `search_vector`.
- Subscribe webhooks: `products/create`, `products/update`, `products/delete` → keep index fresh.
- This feeds `products.search` (already DB-backed) so recommendations + price cards are correct.

### 3.6 Billing
- **App Subscription API** (`appSubscriptionCreate`) → recurring plans (Growth/Pro/Plus) + usage charges for voice (`appUsageRecord`).
- Trial days configurable; Shopify handles dunning, currency, payout.

### 3.7 Attribution (the value metric)
- `read_orders` + `orders/create` webhook → join orders to bot-assisted sessions (visitor_id) → compute **assisted revenue / conversion lift** for the dashboard. This is the retention + sales artifact.

### 3.8 Mandatory compliance
- GDPR webhooks: `customers/data_request`, `customers/redact`, `shop/redact`; plus `app/uninstalled` (cleanup + billing stop).
- Privacy policy URL, data handling doc, App Bridge latest, session-token auth, HMAC verification on all webhooks.

---

## 4. New repo structure

```
apps/
  shopify-admin/            # NEW — Remix embedded app (OAuth, Polaris UI, billing, dashboard)
    app/routes/...
    extensions/
      shoppingmate-widget/  # NEW — Theme App Extension (app embed block + loader)
  api/                      # existing — add: catalog-sync, webhooks (gdpr, products, orders), billing callbacks
  voice-agent/              # existing
packages/
  widget/                   # existing — add: src/host/shopifyCart.ts (Cart AJAX bridge)
  agent/                    # existing — cart.add as client host-action for shopify adapterType
  adapters/                 # existing — ShopifyAdapter kept as server-side fallback
  db/                       # existing — products sync target
```

---

## 5. Build milestones (sprints)

**M0 — Foundations (week 1)**
- Partner account + dev store; `shopify app init` (Remix); OAuth install working on dev store.
- Mandatory webhooks (GDPR + app/uninstalled) registered + HMAC-verified.
- *Exit:* app installs/uninstalls cleanly on a dev store; passes basic Partner checks.

**M1 — Storefront widget via theme app extension (week 1–2)**
- Theme App Extension app embed block injects the existing widget on the dev store storefront.
- Widget connects to agent backend; chat works on a real Shopify theme.
- *Exit:* widget live on dev store, answers product questions using synced catalog.

**M2 — Reliable transactions (week 2–3)**
- `packages/widget/src/host/shopifyCart.ts`: cart.add/get/update via Cart AJAX, **with verify-after**.
- `cart.add` routed as a client host-action for `adapterType === 'shopify'`.
- Checkout redirect.
- **Install-time E2E gate**: automated smoke adds a real product to cart on the store and confirms cart mutation before transactional is enabled.
- *Exit:* shopper adds to cart via the bot and sees it in the real cart + checkout. Gate green.

**M3 — Catalog sync + attribution (week 3–4)**
- Admin GraphQL bulk import + product webhooks → DB/search_vector.
- `orders/create` → assisted-revenue attribution → dashboard.
- *Exit:* dashboard shows assisted revenue / lift on the dev store.

**M4 — Admin app UX + billing (week 4–5)**
- Polaris config (persona, voice toggle, tiers), onboarding flow, dashboard.
- App Subscription billing (plans + voice usage) on dev store.
- *Exit:* full install → configure → subscribe → value-visible loop.

**M5 — Listing prep + review (week 5–7, parallel)**
- Listing assets, compliance pass (run `shopify-app-store-review` skill), performance budget, demo store + screencast.
- Submit for App Store review; iterate on feedback.

> **Pilots run in parallel from M2/M3** via direct install (see §7) — revenue does **not** wait for App Store approval.

---

## 6. App Store listing — step by step

1. **Partner account + dev store** (free). Create the app in Partner Dashboard.
2. **Scaffold & build** with Shopify CLI; develop against the dev store.
3. **Meet technical requirements:**
   - OAuth + session-token (App Bridge latest) auth; HMAC on webhooks.
   - Shopify-managed **billing** implemented.
   - GDPR mandatory webhooks implemented + responding.
   - Storefront performance: app embed lazy/async, minimal Web Vitals impact.
   - No console errors; works on a clean OS 2.0 theme.
4. **Prepare the listing page:**
   - App name, icon, tagline, long description (outcome-led: "lifts conversion").
   - Screenshots + **demo video** (the store-specific concierge in action).
   - Pricing plans (Growth/Pro/Plus + voice).
   - Categories (e.g., "Sales channels / Store design / Customer support / Merchandising").
   - Privacy policy URL, support email/URL, FAQ.
   - **Reviewer test instructions** + a demo store with the widget live.
5. **Pre-submission compliance check** — run the `shopify-app-store-review` skill against the codebase; fix flagged issues.
6. **Submit for review** → respond to Shopify feedback → **approved & listed**.
7. **Seed reviews** from pilot merchants; pursue the **"Built for Shopify"** badge (ranking boost) once stable.

> Exact requirements evolve — validate against current Shopify docs (shopify-dev MCP) and the review skill before submitting.

---

## 7. Distribution BEFORE the App Store listing (so revenue starts now)

You do **not** need App Store approval to start charging:

- **Direct/unlisted install:** a public app can be installed via its install URL while unlisted; or use **custom app** distribution per store. Either way, **Shopify-managed billing works**.
- Run **lighthouse + paid pilots** on real merchant stores via direct install during M2–M5.
- App Store listing (M5+, in review) becomes the *scalable* funnel later; pilots fund the present.

This is the key to the GTM timeline: **transactional pilots and first revenue happen weeks before the listing goes live.**

---

## 8. Reliability discipline (non-negotiable for premium buyers)

- **Verify-after-action:** every cart op re-reads `/cart.js` and confirms before the agent says "added." No claimed action without observed state-change.
- **Install-time E2E gate:** transactional features stay OFF until an automated smoke completes add-to-cart on that merchant's real store. Fail → concierge-only. This single gate prevents "it's not working" complaints.
- **Performance budget:** storefront script is async, code-split, < target KB; no layout shift; protects the merchant's Web Vitals (and our App Store standing).

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| App review rejection | Run `shopify-app-store-review` pre-check; meet billing/GDPR/perf up front; demo store + clear test steps. |
| Storefront perf hit flagged | Lazy/async loader, small bundle, measure Web Vitals before submit. |
| Cart edge cases (variants, sold-out, subscriptions) | Verify-after; handle variant selection; graceful "open product page" fallback. |
| Theme compatibility (legacy non-OS2.0) | App embed for OS2.0 (majority); fallback messaging for legacy. |
| Shopify billing revenue share | 0% on first $1M/yr (validate); price accordingly. |
| Solo bandwidth | Sequence ruthlessly; pilots via direct install while listing is in review; hire interns from first revenue. |

---

## 10. Immediate next actions

1. **Calmosis proof first** (from GTM doc) — the lift number is the input to all sales. (Calmosis is custom, not Shopify, but it's our owned proof brand.)
2. **M0–M1:** Partner account + dev store; `shopify app init`; OAuth + GDPR webhooks; theme app extension injecting the existing widget on a dev store.
3. **M2:** Shopify Cart Bridge (client-side AJAX, verify-after) + install-time E2E gate → reliable add-to-cart on a real Shopify store.
4. **In parallel:** start lighthouse pilots via direct install; begin listing assets.

> Build order optimizes for the first sellable, reliable Shopify transaction (M2) and first revenue via direct-install pilots — App Store listing follows, not blocks.
