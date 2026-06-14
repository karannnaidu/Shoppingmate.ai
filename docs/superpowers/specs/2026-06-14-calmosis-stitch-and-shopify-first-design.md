# Calmosis Manual Stitch + Shopify-First — Design Spec

**Date:** 2026-06-14
**Status:** Approved (design). Companion plan to follow via writing-plans.
**Repos involved:**
- `shoppingmate` (this repo) — agent, widget, api, voice-agent
- `calmosis-v1-frontend` (Netlify, deploy from **main**) — storefront bridge
- `calmosis-v1-backend` (Railway, deploy from **staging**) — bot endpoints + pricing change

---

## Goal

Make the Calmosis (own brand, custom site) bot **transact for real** — add to cart, take the order with details collected in chat, and send the customer straight to a Cashfree payment page with an order summary — using the commerce API we already own (no DOM scraping, no faked actions). Calmosis becomes the proof brand. Then make **Shopify the primary, first-class product** and reface the company Shopify-first.

## Locked decisions

- **Approach B:** dedicated guest **bot-checkout** endpoint (no OTP). Phone is captured; Cashfree payment is the verification.
- **Pricing (site-wide):** remove the existing **5% prepaid discount**; **COD = +₹250 surcharge**; prepaid = listed price. Bot closing line: *"Pay online now and skip the ₹250 cash-on-delivery fee."*
- **Prescription products do not block payment** — proceed to pay, mention the free doctor consult; existing downstream prescription logic is untouched.
- **Custom sites (incl. Calmosis) = the only place we hand-stitch transactional for now.** All other custom sites remain voice/concierge-only (Phase 3 messaging).

---

## Phase 1 — Calmosis manual stitch

Three layers; we own all repos.

### 1. Frontend bridge — `calmosis-v1-frontend` (deploy: main)

Expose a small, stable global the widget calls instead of scraping the DOM:

```js
window.smCalmosis = {
  addToCart(sku, qty, packageType): Promise<Cart>,   // uses existing cart logic
  getCart(): Promise<Cart>,                           // items + totals
  applyCoupon(code): Promise<{ ok, cart, message }>,  // validate/apply
  navigateToPDP(sku): void,
  version: "1"
}
```

- Maps to the frontend's existing cart store / API calls (no new cart system).
- `Cart` shape: `{ items:[{sku,title,qty,packageType,priceCents,imageUrl}], subtotalCents, currency }`.
- Loaded on every storefront page (small, side-effect-free).

### 2. Backend bot endpoints — `calmosis-v1-backend` (deploy: staging)

Protected by a shared server-to-server secret (`SM_BOT_SECRET`); only the shoppingmate backend calls these.

- **`POST /api/v1/bot/quote`** — compute authoritative summary, **no order created**.
  - In: `{ cartItems:[{sku,qty,packageType}], paymentMethod:'prepaid'|'cod', couponCode? }`
  - Out: `{ subtotalCents, couponDiscountCents, comboDiscountCents, codSurchargeCents, totalCents, currency, lines:[...] , notes:[...] }`
  - Reuses existing discount logic (coupon + auto `COMBODISCOUNT`), applies **+₹250 if COD**, **no prepaid discount**.
- **`POST /api/v1/bot/checkout`** — create order + payment link.
  - In: `{ cartItems, customer:{name,phone,email}, address:{area,city,state,pincode,landmark}, paymentMethod, couponCode? }`
  - Logic: find/create user by phone → create address → create order (same amount math as quote) → prepaid: `createCashfreePaymentLink(publicId, amount, {customerName, customerPhone})`; COD: create order (`paymentStatus` per existing COD path).
  - Out: `{ orderId, summary, paymentMethod, paymentLinkUrl? , codConfirmation? }`
- **Pricing change applied to existing `createOrder` too** (site-wide): drop `amount -= 5%` prepaid; add `if (paymentMethod==='cod') amount += 25000` (paise) — exact unit confirmed against the codebase during implementation.
- **Reuse untouched:** Cashfree webhook `cashfreePaymentResponseCallback` → order-confirmation email + prescription flow.

### 3. shoppingmate agent + widget (this repo)

- **Calmosis tool set** (gated by merchant = Calmosis / a `calmosis` integration flag):
  - `cart.add`, `cart.get`, `coupon.apply` → routed to the **frontend bridge** as client host-actions (verify-after: re-read cart before the bot claims success).
  - `checkout.quote`, `checkout.create` → routed through shoppingmate **api** → calmosis backend bot endpoints (secret stays server-side; widget never holds it).
  - product explain/catalog → existing `products.search` (cards) + KB (ingredients/usage).
- **Widget UI additions:**
  - **Order-summary card** (line items, coupon/combo discount, COD fee, total) rendered from the `quote` result.
  - **Address mini-form card** (name/phone/email collected conversationally; address area/city/state/pincode/landmark via a compact form — pincodes are error-prone over voice).
  - On `checkout.create`: redirect to the Cashfree pay page (prepaid) or show COD confirmation.

### Purchase flow

ask to buy → `cart.add` (bridge) → upsell (multi-item auto-triggers `COMBODISCOUNT`) + offer coupon → "checkout" → collect name/phone/email (chat) + address (mini-form) + payment method → `checkout.quote` → **order-summary card** → confirm → `checkout.create` → Cashfree link → pay → existing webhook → email/prescription.

### Requested capabilities → mechanism

1. **Add to cart** → bridge `addToCart` (real cart, verify-after).
2. **Purchase in cart → payment** → quote → summary card → checkout → Cashfree link.
3. **Explain products/ingredients + catalog** → `products.search` cards + KB; upsell = complement suggestions.
4. **Coupon + upsell to close** → `coupon.apply` (CALM10) + `COMBODISCOUNT` nudge + "skip the ₹250 COD fee."

### Error handling

Invalid pincode/coupon/sold-out/payment-link failure → graceful fallback to normal `/checkout?step=...`. Prescription products → proceed to pay + mention free doctor consult.

### Testing / proof

- Backend unit tests for amount math: COD **+₹250**, coupon (amount & %), `COMBODISCOUNT`, **no prepaid discount**.
- **Cashfree TEST-mode E2E**: bot-driven order → test payment → webhook → confirmed order. Doubles as proof + conversion-lift instrumentation.

---

## Phase 2 — Shopify (primary product)

Architecture, M0–M5 build milestones, and listing steps = `docs/strategy/2026-06-12-shoppingmate-shopify-app-build-and-listing.md` (referenced, not duplicated).

**Karan's personal setup checklist (human-only steps):**
1. Create a **Shopify Partner account**.
2. Create a **development (test) store** in the Partner Dashboard.
3. Install **Shopify CLI**; run `shopify auth login` (interactive — run via `! shopify ...`).
4. `shopify app init` (Remix) → `shopify app dev` against the dev store.
5. Install the app on the dev store; enable the **theme app extension** (app embed) in the theme editor.
6. Add **test products**; test add-to-cart + checkout via Shopify's **Bogus/test gateway**.
7. Proceed M0→M5; run pilots via direct install before App Store approval.

---

## Phase 3 — Reface to Shopify-first

- Landing page leads with Shopify; **remove Wix/Squarespace/other-platform claims**.
- Messaging: **"Custom sites currently support the voice concierge only — cart & checkout are coming."**
- Same messaging in onboarding/product so no custom-site customer expects transactional yet.

---

## Sequencing & deploy

1. **Phase 1 (Calmosis)** first → proof + lift number.
   - `calmosis-v1-backend` ships from **staging**; `calmosis-v1-frontend` ships from **main**; shoppingmate api/widget via existing Railway/Vercel deploy.
2. **Phase 2 (Shopify)** in parallel once Phase 1 is in testing.
3. **Phase 3 (reface)** after Phase 1 validates.

## Security

- `SM_BOT_SECRET` shared between shoppingmate api and calmosis backend; bot endpoints reject unsigned calls.
- Customer PII flows widget → shoppingmate api → calmosis backend (server-to-server); secrets never in the browser.
- Rate-limit + validate `/bot/quote` and `/bot/checkout`.

## Out of scope (now)

- Real transactional for arbitrary custom sites (Phase 3 messaging = voice-only).
- OTP/login for the bot purchase (guest checkout).
- Subscriptions via bot (existing site flow only).
