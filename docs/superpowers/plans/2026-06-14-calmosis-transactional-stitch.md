# Calmosis Transactional Stitch — Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the Calmosis bot transact for real — add to cart, collect details in chat, show an order summary, and send the customer to a Cashfree payment page — using the owned commerce API (no DOM scraping).

**Architecture:** Frontend bridge (`window.smCalmosis`) drives the real Zustand cart. A new secret-guarded backend `/api/v1/bot/*` (quote + checkout) computes authoritative totals and mints Cashfree payment links, reusing existing order/coupon/Cashfree internals. shoppingmate's agent calls the bridge (cart) client-side and the bot endpoints server-side (secret stays on the server).

**Tech Stack:** Backend: Express, Prisma (MongoDB), Cashfree, yarn4, TS (NodeNext, `@/*`). Frontend: Vite, React 18, Zustand. shoppingmate: pnpm monorepo (agent/widget/api), vitest.

**Repos & deploy:**
- `calmosis-v1-backend` → push **staging** (auto-deploy)
- `calmosis-v1-frontend` → push **main** (Netlify)
- `shoppingmate` → Railway (`railway up --service api`) + Vercel (widget via web)

**Pricing change (site-wide):** remove prepaid 5% discount; add ₹250 COD surcharge.

---

## Pre-flight (do once)

- [ ] **P1: Get working git clones on the right branches.** The `~/Downloads/calmosis-v1-*-main` folders are zip extracts. Clone fresh:

```bash
cd ~/Downloads
gh repo clone karannnaidu/calmosis-v1-backend calmosis-be && cd calmosis-be && git checkout staging || git checkout -b staging
cd ~/Downloads && gh repo clone karannnaidu/calmosis-v1-frontend calmosis-fe && cd calmosis-fe && git checkout main
```
Expected: two clones; backend on `staging`, frontend on `main`.

- [ ] **P2: Generate a shared secret.** `SM_BOT_SECRET` = a long random string. Add it to: backend env (Railway/host) + shoppingmate api env. Record it in the secret store, not in git.

---

## File structure

**calmosis-v1-backend**
- Create `src/utils/orderTotals.ts` — pure `computeOrderTotals()` (DRY, unit-testable, no DB).
- Create `src/middleware/auth.ts` addition — `isBotSecretAuthenticated`.
- Create `src/routes/bot/index.ts` — router.
- Create `src/routes/bot/handlers.ts` — `botQuote`, `botCheckout`.
- Create `src/routes/bot/payloads.ts` — zod schemas.
- Modify `src/routes/index.ts` — mount `/bot`.
- Modify `src/routes/order/handlers.ts:361-363` — use `computeOrderTotals` (removes 5% prepaid, adds COD +250).
- Create `src/utils/orderTotals.test.ts` — unit tests (add vitest).

**calmosis-v1-frontend**
- Create `src/bridge/smCalmosis.ts` — the `window.smCalmosis` bridge.
- Modify `src/main.tsx` — import the bridge (side-effect) to register the global.

**shoppingmate**
- Modify `packages/agent/src/tools.ts` — Calmosis tool surface (cart.add/get, coupon.apply as host actions; checkout.quote/create).
- Modify `packages/agent/src/runtime.ts` — route the new host actions + checkout tools.
- Modify `apps/api/src/index.ts` — proxy routes to Calmosis bot endpoints (server-side secret).
- Modify `packages/widget/src/host/*` + UI — `smCalmosis` host actions + order-summary card + address mini-form.
- Modify `packages/agent/src/prompts/system.ts` — Calmosis purchase-flow guidance.

---

## Workstream A — Calmosis backend (deploy: staging)

### Task A1: Pure order-totals helper (DRY + testable)

**Files:** Create `src/utils/orderTotals.ts`, `src/utils/orderTotals.test.ts`

- [ ] **A1.1 Write the failing test** (`src/utils/orderTotals.test.ts`):

```ts
import { describe, it, expect } from "vitest";
import { computeOrderTotals } from "./orderTotals";

const lines = [{ sku: "peace-mantra", qty: 1, basePrice: 4500, discountPct: 0 }];

describe("computeOrderTotals", () => {
  it("prepaid is listed price (no 5% discount)", () => {
    const t = computeOrderTotals({ lines, paymentMethod: "prepaid" });
    expect(t.total).toBe(4500);
    expect(t.codSurcharge).toBe(0);
  });
  it("cod adds flat 250", () => {
    const t = computeOrderTotals({ lines, paymentMethod: "cod" });
    expect(t.codSurcharge).toBe(250);
    expect(t.total).toBe(4750);
  });
  it("percentage coupon applies before COD surcharge", () => {
    const t = computeOrderTotals({ lines, paymentMethod: "cod", coupon: { type: "percentage", value: 10 } });
    expect(t.couponDiscount).toBe(450);
    expect(t.total).toBe(4500 - 450 + 250);
  });
  it("amount coupon subtracts rupees (tax-grossed) before COD", () => {
    const t = computeOrderTotals({ lines, paymentMethod: "prepaid", coupon: { type: "amount", value: 100 }, taxRate: 12 });
    expect(t.total).toBe(4500 - Math.floor(100 + 0.12 * 100));
  });
  it("combo discount applies when >1 item or qty>1", () => {
    const t = computeOrderTotals({ lines: [{ sku: "a", qty: 2, basePrice: 1000, discountPct: 0 }], paymentMethod: "prepaid", comboPct: 10 });
    expect(t.comboDiscount).toBe(200);
    expect(t.total).toBe(1800);
  });
});
```

- [ ] **A1.2 Add vitest** to backend: `yarn add -D vitest` and add `"test": "vitest run"` to `package.json` scripts.
- [ ] **A1.3 Run, expect fail:** `yarn test` → FAIL (computeOrderTotals not found).
- [ ] **A1.4 Implement** `src/utils/orderTotals.ts` (mirrors the math in `order/handlers.ts:279-390`, minus prepaid 5%, plus COD +250):

```ts
export type TotalsLine = { sku: string; qty: number; basePrice: number; discountPct: number };
export type CouponInput = { type: "percentage" | "amount"; value: number } | null;
export type TotalsInput = {
  lines: TotalsLine[];
  paymentMethod: "prepaid" | "cod";
  coupon?: CouponInput;
  comboPct?: number;       // COMBODISCOUNT % when active
  taxRate?: number;        // default 12
  codSurchargeRs?: number; // default 250
};
export type Totals = {
  subtotal: number; couponDiscount: number; comboDiscount: number;
  codSurcharge: number; total: number; currency: "INR";
};

export function computeOrderTotals(i: TotalsInput): Totals {
  const taxRate = i.taxRate ?? 12;
  const codSurchargeRs = i.codSurchargeRs ?? 250;
  const subtotal = i.lines.reduce((s, l) => s + l.qty * (l.basePrice - (l.basePrice * (l.discountPct || 0)) / 100), 0);
  let amount = subtotal;

  let couponDiscount = 0;
  if (i.coupon) {
    if (i.coupon.type === "amount") {
      couponDiscount = Math.floor(i.coupon.value + (taxRate / 100) * i.coupon.value);
    } else {
      couponDiscount = (i.coupon.value / 100) * amount;
    }
    amount -= couponDiscount;
  }

  // NOTE: prepaid 5% discount intentionally REMOVED (prepaid = listed price).

  let comboDiscount = 0;
  const comboApplicable = i.lines.filter((l) => l.sku !== "bliss-club").some((l) => l.qty > 1) || i.lines.filter((l) => l.sku !== "bliss-club").length > 1;
  if (comboApplicable && i.comboPct && i.comboPct > 0 && i.comboPct <= 100) {
    comboDiscount = (i.comboPct / 100) * amount;
    amount -= comboDiscount;
  }

  const codSurcharge = i.paymentMethod === "cod" ? codSurchargeRs : 0;
  amount += codSurcharge;

  return {
    subtotal: round2(subtotal), couponDiscount: round2(couponDiscount),
    comboDiscount: round2(comboDiscount), codSurcharge, total: round2(amount), currency: "INR",
  };
}
const round2 = (n: number) => Number(n.toFixed(2));
```

- [ ] **A1.5 Run, expect pass:** `yarn test` → PASS (5 tests).
- [ ] **A1.6 Commit:** `git add src/utils/orderTotals.ts src/utils/orderTotals.test.ts package.json && git commit -m "feat(orders): pure computeOrderTotals (prepaid=listed, COD +250)"`

### Task A2: Apply pricing change to existing createOrder

**Files:** Modify `src/routes/order/handlers.ts` (lines ~361-390)

- [ ] **A2.1** Replace the prepaid block `if (paymentMethod === "prepaid") { amount -= (5/100)*amount; }` (lines 361-363) with a COD surcharge: `if (paymentMethod === "cod") { amount += 250; }`. Leave the existing coupon (342-360) and combo (372-388) logic in place (the new helper mirrors them; we keep handlers.ts behavior identical except the pricing swap to minimize risk).
- [ ] **A2.2** Manual check: read the surrounding lines and confirm `amount` is in rupees and `amount = Number(amount.toFixed(2))` still runs after. No automated test (DB-bound handler); covered by E2E (D1).
- [ ] **A2.3 Commit:** `git add src/routes/order/handlers.ts && git commit -m "fix(orders): prepaid=listed price, COD +Rs250 (site-wide pricing)"`

### Task A3: Bot secret middleware

**Files:** Modify `src/middleware/auth.ts`

- [ ] **A3.1** Add:

```ts
export const isBotSecretAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  const secret = req.headers["sm-bot-secret"];
  if (!process.env.SM_BOT_SECRET || secret !== process.env.SM_BOT_SECRET) return res.sendStatus(403);
  return next();
};
```
(match the import style/types used by `isWhatsappAuthenticated` in the same file.)

- [ ] **A3.2 Commit:** `git add src/middleware/auth.ts && git commit -m "feat(auth): SM_BOT_SECRET header guard for bot routes"`

### Task A4: Bot quote + checkout endpoints

**Files:** Create `src/routes/bot/payloads.ts`, `src/routes/bot/handlers.ts`, `src/routes/bot/index.ts`; modify `src/routes/index.ts`

- [ ] **A4.1 payloads** (`src/routes/bot/payloads.ts`):

```ts
import z from "zod";
const cartItem = z.object({ sku: z.string(), qty: z.number().int().positive(), packageType: z.enum(["trial", "weekly", "monthly"]).default("monthly") });
export const botQuotePayload = z.object({ cartItems: z.array(cartItem).min(1), paymentMethod: z.enum(["prepaid", "cod"]), couponCode: z.string().optional() });
export const botCheckoutPayload = botQuotePayload.extend({
  customer: z.object({ name: z.string().min(1), phone: z.string().min(8), email: z.string().email() }),
  address: z.object({ area: z.string().min(1), city: z.string().min(1), state: z.string().min(1), pincode: z.number().int(), landmark: z.string().optional() }),
});
```

- [ ] **A4.2 handlers** (`src/routes/bot/handlers.ts`): `botQuote` loads products by sku, builds `TotalsLine[]` (basePrice=product.price, discountPct=product.discount?.[packageType]), looks up coupon (reuse coupon lookup) + COMBODISCOUNT (`prisma.coupon.findFirst({where:{code:"COMBODISCOUNT"}})`), calls `computeOrderTotals`, returns the summary + line details. `botCheckout` does the same, then: upsert user by phone (create with name/email if absent), create address, `getNewPublicId("order")`, create order (items, amount=totals.total, addressId, userId, couponId, paymentMethod, paymentStatus: cod→"PAYMENT_SUCCESS" else "pending"), then prepaid → `createCashfreePaymentLink(publicId, total, {customerName, customerPhone})` → return `{orderId, summary, paymentMethod, paymentLinkUrl}`; cod → return `{orderId, summary, paymentMethod, codConfirmation:true}`. Reuse helpers from `@/utils` and `@/utils/cashfree`. Wrap in `handleError`.

- [ ] **A4.3 router** (`src/routes/bot/index.ts`):

```ts
import { Router } from "express";
import { isBotSecretAuthenticated } from "@/middleware/auth";
import { botQuote, botCheckout } from "./handlers";
const router = Router();
router.post("/quote", isBotSecretAuthenticated, botQuote);
router.post("/checkout", isBotSecretAuthenticated, botCheckout);
export default router;
```

- [ ] **A4.4 mount** in `src/routes/index.ts`: `import botRouter from "./bot"; router.use("/bot", botRouter);`
- [ ] **A4.5 Typecheck:** `yarn exec tsc --noEmit` → clean.
- [ ] **A4.6 Commit:** `git add src/routes/bot src/routes/index.ts && git commit -m "feat(bot): guest quote + checkout endpoints (Cashfree)"`

### Task A5: Deploy backend to staging

- [ ] **A5.1** Ensure `SM_BOT_SECRET`, `CASHFREE_*`, `FRONTEND_URL`, `BACKEND_URL` set on the backend host (staging env).
- [ ] **A5.2** `git push origin staging` → triggers staging deploy. Confirm health + that `/api/v1/bot/quote` returns 403 without the secret, 200 with it.

---

## Workstream B — Calmosis frontend bridge (deploy: main)

### Task B1: smCalmosis bridge

**Files:** Create `src/bridge/smCalmosis.ts`; modify `src/main.tsx`

- [ ] **B1.1** `src/bridge/smCalmosis.ts`:

```ts
import { useCartStore } from "@/store/cart";
import { useGlobalStore } from "@/store/global";
// Map an SKU to a BasicCartItem using product data already in the store/catalog.
async function addToCart(sku: string, qty = 1, packageType: "trial" | "weekly" | "monthly" = "monthly") {
  const store = useCartStore.getState();
  // BasicCartItem requires name/price/discount; fetch from the catalog the app already loads.
  const product = await fetchProductBySku(sku); // implement against the app's product API/query
  store.addItem({ sku, name: product.name, price: product.price, discount: product.discount, variant: "", flavour: "", packageType, quantity: qty });
  return getCart();
}
function getCart() {
  const items = useCartStore.getState().items;
  return { items: items.map((i) => ({ sku: i.sku, name: i.name, qty: i.quantity, packageType: i.packageType, price: i.price })) };
}
function applyCoupon(code: string) { /* validate via /coupon/:code, set useGlobalStore.setSelectedCoupon */ }
function navigateToPDP(sku: string) { window.location.assign(`/shop/${sku}`); }
declare global { interface Window { smCalmosis?: any } }
if (typeof window !== "undefined") window.smCalmosis = { addToCart, getCart, applyCoupon, navigateToPDP, version: "1" };
```
(`fetchProductBySku` uses the same product query the catalog pages use — wire to the existing product API/React-Query key during implementation.)

- [ ] **B1.2** In `src/main.tsx`, add `import "./bridge/smCalmosis";` near the top (side-effect registers the global).
- [ ] **B1.3 Build:** `npm run build` → succeeds.
- [ ] **B1.4 Commit + deploy:** `git add src/bridge/smCalmosis.ts src/main.tsx && git commit -m "feat(bridge): window.smCalmosis cart bridge for shoppingmate" && git push origin main` (Netlify deploys).
- [ ] **B1.5 Verify:** on calmosis.com, console `window.smCalmosis.version === "1"`; `await window.smCalmosis.addToCart("peace-mantra",1)` adds to the real cart.

---

## Workstream C — shoppingmate agent + widget + api

### Task C1: API proxy to Calmosis bot endpoints

**Files:** Modify `apps/api/src/index.ts` (add two routes)

- [ ] **C1.1** Add `POST /v1/calmosis/quote` and `POST /v1/calmosis/checkout` that forward the body to `${CALMOSIS_BACKEND_URL}/api/v1/bot/{quote,checkout}` with header `sm-bot-secret: ${SM_BOT_SECRET}` and return the JSON. Validate tenant = Calmosis. Env: `CALMOSIS_BACKEND_URL`, `SM_BOT_SECRET`.
- [ ] **C1.2 Commit:** `git commit -m "feat(api): proxy to Calmosis bot quote/checkout"`

### Task C2: Calmosis tool surface + routing

**Files:** Modify `packages/agent/src/tools.ts`, `packages/agent/src/runtime.ts`

- [ ] **C2.1** Add a Calmosis tool set: `cart.add`, `cart.get`, `coupon.apply` (client host-actions to `window.smCalmosis`), `checkout.quote`, `checkout.create` (server → api proxy). Gate by `merchant.id === 'SM-2SCCLZ'` (or a `calmosisStitch` flag).
- [ ] **C2.2** In runtime, route `cart.*`/`coupon.apply` as host actions (like `site.navigate`) and `checkout.*` via a server call to the api proxy. Add unit tests in `tools.test.ts` asserting the Calmosis surface includes the new tools.
- [ ] **C2.3 Run:** `npx vitest run packages/agent` → green. Commit.

### Task C3: Widget host actions + UI cards

**Files:** Modify `packages/widget/src/host/actions.ts`, add `packages/widget/src/ui/orderSummary.ts`, `packages/widget/src/ui/addressForm.ts`, wire in `widget.ts`/`store.ts`

- [ ] **C3.1** Implement host actions calling `window.smCalmosis.{addToCart,getCart,applyCoupon}` with verify-after (re-read cart).
- [ ] **C3.2** Order-summary card (renders quote: lines, coupon/combo, COD fee, total) + address mini-form card (area/city/state/pincode/landmark) that emits a widget message with collected details.
- [ ] **C3.3** On `checkout.create` result, redirect to `paymentLinkUrl` (prepaid) or show COD confirmation.
- [ ] **C3.4** Tests for the new message types/codec; `npx vitest run packages/widget` → green. Commit.

### Task C4: Agent purchase-flow prompt

**Files:** Modify `packages/agent/src/prompts/system.ts`

- [ ] **C4.1** Add Calmosis purchase guidance: search → recommend/upsell → add to cart → collect name/phone/email (chat) + address (mini-form) + payment method → quote (show summary) → confirm → checkout. Closing line: "Pay online now and skip the ₹250 cash-on-delivery fee." Never quote totals the bot computed itself — only show the `quote` result. Add a system.test.ts assertion. Commit.

### Task C5: Deploy shoppingmate

- [ ] **C5.1** Set `CALMOSIS_BACKEND_URL` + `SM_BOT_SECRET` on the api service (Railway). `railway up --service api`.
- [ ] **C5.2** Rebuild + deploy widget (web prebuild → Vercel) per `reference_deploy_mechanics`.

---

## Workstream D — End-to-end + go-live

- [ ] **D1: Cashfree TEST-mode E2E.** On calmosis.com (staging backend + main frontend + deployed widget), talk to the bot: add Peace Mantra → upsell second item (combo) → apply CALM10 → checkout (prepaid) → confirm order-summary card matches backend quote → pay on Cashfree test page → webhook → order shows PAYMENT_SUCCESS + confirmation email. Repeat for COD (verify +₹250).
- [ ] **D2: Capture proof** — order id(s), the summary card, payment success. This is the lift-instrumentation baseline.
- [ ] **D3: Flip to production Cashfree** once test passes; smoke one real low-value order.

---

## Self-review notes

- Spec coverage: add-to-cart (B1/C3), purchase→payment (A4/C3), explain+catalog (existing products.search + KB), coupon+upsell+combo (A1/A4/C2), COD +250 & no prepaid discount (A1/A2), prescription non-blocking (reuses existing flow — bot proceeds to pay). Covered.
- Money units: rupees throughout (matches backend). COD surcharge = `+250` rupees.
- Secret guard on both bot routes; secret never reaches the browser (api proxies).
- Open risk to confirm during exec: exact `fetchProductBySku` wiring on the frontend, and matching `createOrder`'s order-create field set in `botCheckout`.
