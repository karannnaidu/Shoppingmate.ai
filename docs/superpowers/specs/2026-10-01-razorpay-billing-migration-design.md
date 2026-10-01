# Razorpay Billing Migration — Design Spec

_Date: 2026-10-01 · Status: approved design, pending implementation plan_
_Replaces the Stripe billing rail in `web/` with Razorpay (INR + international cards)._

---

## 1. Goal & scope

Move shoppingmate's external billing rail from **Stripe → Razorpay**, mirroring the current
structure in the `web/` Next.js app. Razorpay becomes the **sole active** billing rail for both
INR and international cards (via Razorpay International activation). Stripe code is left **dormant**
(not deleted) for one release so we can roll back; it is removed in a follow-up once Razorpay is
proven in production.

**Out of scope:** the Shopify App Store app's *managed* billing (that stays Shopify-native);
customer migration (we assume no live Stripe subscribers exist yet — clean cutover); any change to
plan quotas, voice surcharge logic, or auto-recharge semantics.

**Decision inputs (from brainstorming):**
- Currency/markets: **INR + international cards** (requires Razorpay International activation — a
  business/KYC prerequisite, not code).
- Orchestration: **in-code API routes**, mirroring the current Stripe handlers. No n8n.

---

## 2. Concept mapping (Stripe → Razorpay)

| Today (Stripe) | Razorpay | Notes |
|---|---|---|
| `Price` (recurring) | **Plan** (`plans.create`) | pre-created; `plan_xxx` ids go in env |
| subscription Checkout Session → `url` | **Subscription** (`subscriptions.create`) → `short_url` | preserves redirect pattern; no frontend change |
| one-time payment Checkout → `url` | **Payment Link** (`paymentLink.create`) → `short_url` | amount inline; no pre-created price objects |
| **Billing Portal** (`portal-session`) | ❌ none | build in-app manage/cancel UI |
| `invoices.list` | `invoices.all({ subscription_id })` | invoices table on billing page |
| `webhooks.constructEvent` | `validateWebhookSignature(rawBody, sig, secret)` | HMAC-SHA256, **separate** webhook secret |
| `checkout.session.completed` (subscription) | `subscription.activated` | create merchant + owner |
| `checkout.session.completed` (payment) | `payment_link.paid` | credit `topupBalance` |
| `invoice.payment_failed` | `subscription.pending` / `payment.failed` | → `billingStatus = past_due` + alert |
| `customer.subscription.deleted` | `subscription.cancelled` / `subscription.completed` | → `billingStatus = canceled` |

**Idempotency:** Razorpay webhook bodies have no top-level event id. Key idempotency on the
**`X-Razorpay-Event-Id`** request header.

---

## 3. Architecture / components

All code lives in `web/` (Next.js), mirroring the existing billing layout. Each unit has one
purpose and a defined interface.

### 3.1 `web/src/lib/razorpay.ts` (new)
- Lazy-initialised Razorpay client behind the same `Proxy` pattern as `lib/stripe.ts` (so
  `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` are read at call time, not import time — keeps tests and
  build clean when env is absent).
- `PLAN_IDS = { starter, growth, scale }` read from env.
- `TOPUP_AMOUNTS: Record<TopupKey, { amount: number; label: string }>` — charge amount in the
  smallest currency unit (paise/cents). Reuses the existing `TopupKey` union + the price table in
  `app/billing/page.tsx`.
- `TOPUP_QTYS: Record<TopupKey, number>` — carried over verbatim from `lib/stripe.ts`; the number
  of conversations to credit to `topupBalance` when a pack is paid (used by the webhook, §3.5).
- Re-export `validateWebhookSignature` from the SDK for the webhook route.
- `BILLING_CURRENCY` (env, default `USD`) used for plan + payment-link currency.

### 3.2 `web/src/app/api/billing/checkout-session/route.ts` (swap)
- Create a Razorpay customer (`customers.create({ email, notes:{ user_id }})`).
- Create a subscription: `subscriptions.create({ plan_id: PLAN_IDS.starter, total_count: 12,
  customer_notify: 1, notes:{ user_id }})`.
- Return `{ url: subscription.short_url }`. Frontend unchanged.

### 3.3 `web/src/app/api/billing/topup/route.ts` (swap)
- Validate `topup_key` (unchanged zod enum).
- Create a Payment Link: `paymentLink.create({ amount, currency, customer, notify, reference_id,
  notes:{ user_id, topup_key, merchant_id }})`.
- Return `{ url: paymentLink.short_url }`.

### 3.4 `web/src/app/api/billing/cancel/route.ts` (new — replaces `portal-session`)
- Razorpay has no hosted portal. This route calls
  `subscriptions.cancel(razorpaySubscriptionId, { cancel_at_cycle_end: true })` for the session's
  merchant, returns `{ ok: true }`.
- `portal-session/route.ts` is deleted; its "Manage billing" button is replaced by an in-app
  **Manage plan** card (cancel now / at cycle end; change-plan is a later iteration — cancel +
  re-subscribe for v1).

### 3.5 `web/src/app/api/webhooks/razorpay/route.ts` (new)
- Read raw body + `X-Razorpay-Signature` + `X-Razorpay-Event-Id`.
- `validateWebhookSignature(rawBody, sig, RAZORPAY_WEBHOOK_SECRET)` → 400 on mismatch.
- Idempotency via `razorpay_events` table keyed on event-id header (same insert/`processedAt`
  pattern as the Stripe handler).
- Handle: `subscription.activated` (create merchant + owner, as the current sub branch does),
  `payment_link.paid` (credit `topupBalance`), `subscription.pending`/`payment.failed`
  (`past_due` + `payment_failed` alert), `subscription.cancelled`/`subscription.completed`
  (`canceled`).

### 3.6 `web/src/app/app/billing/page.tsx` (edit)
- Invoices via `invoices.all({ subscription_id, count: 12 })`; map to the existing row shape
  (amounts already in smallest unit — reuse `/100` render).
- "Manage billing" button → posts to `/api/billing/cancel` (Manage plan card).

### 3.7 `packages/db` (schema + migration)
- `merchants`: add `razorpay_customer_id` (text, unique, nullable) and
  `razorpay_subscription_id` (text, unique, nullable). Keep `stripe_customer_id` /
  `stripe_subscription_id` dormant. Reuse `billingStatus`, `topupBalance`, auto-recharge columns.
- New `razorpay_events` table: `{ id (event-id, PK), type, receivedAt, processedAt, payload }` —
  mirror of `stripe_events`. `stripe_events` kept dormant.
- One Drizzle migration; `drizzle-kit` version per `reference_dev_environment_quirks`.

### 3.8 Plan-creation script (new — `web/scripts/create-razorpay-plans.ts` or `apps/api/scripts/`)
- One-off: creates the 3 Razorpay plans (`period: 'monthly'`, `interval: 1`, item amount/currency
  per the `PLAN_QUOTA` prices) and prints the `plan_xxx` ids to paste into env. Idempotent-ish:
  logs existing ids if re-run guard is set. Run once per Razorpay account (test + live).

---

## 4. Data flow

**Subscribe (onboarding):** dashboard → `POST /api/billing/checkout-session` → create customer +
subscription → redirect to `short_url` (Razorpay hosted mandate/auth) → shopper authorises →
Razorpay fires `subscription.activated` → webhook creates merchant + owner, `billingStatus=active`.

**Top-up:** billing page form → `POST /api/billing/topup` → create Payment Link → redirect to
`short_url` → pay → `payment_link.paid` → webhook credits `topupBalance` (via `TOPUP_QTYS`).

**Failure/cancel:** `payment.failed`/`subscription.pending` → `past_due` + critical alert;
`subscription.cancelled` → `canceled`.

---

## 5. Error handling
- Missing env (`RAZORPAY_*`) → the lazy client throws a clear error; routes return 500, never leak
  keys.
- Webhook signature mismatch → 400, no DB write.
- Duplicate webhook (same event-id) → short-circuit `{ ok: true, idempotent: true }`.
- Razorpay API hiccup in the billing page invoice fetch → degrade gracefully (empty invoices), same
  as the app home screen's defensive pattern.

---

## 6. Testing
- Mirror the existing `*.test.ts` with Razorpay mocks, same green bar:
  - `lib/razorpay.test.ts` — client proxy + env guard + amount/plan maps.
  - `api/billing/checkout-session/route.test.ts` — subscription created, `short_url` returned.
  - `api/billing/topup/route.test.ts` — payment link created, `short_url` returned, bad key → 400.
  - `api/webhooks/razorpay/route.test.ts` — signature verify, idempotency, each event branch.
- TDD: write tests first (per `feedback_prove_with_logs` + test-driven-development skill).
- **Before cutover:** capture a live Razorpay *test-mode* smoke log (subscribe → activated webhook →
  topup → paid webhook) as proof, per `feedback_prove_with_logs`.

---

## 7. Env & secrets (wired as references, never committed)
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`,
`RAZORPAY_PLAN_STARTER`, `RAZORPAY_PLAN_GROWTH`, `RAZORPAY_PLAN_SCALE`,
`BILLING_CURRENCY` (default `USD`). Set on Vercel (web) + the relevant service.

---

## 8. Business prerequisites (operator, not code)
1. **Rotate the live keys** that were pasted into chat (compromised by exposure).
2. **Razorpay International activation** (KYC) — gates non-INR card acceptance.
3. Run the plan-creation script (§3.8) → paste the 3 `plan_xxx` ids into env.
4. Create a **Webhook** in the Razorpay dashboard → `/api/webhooks/razorpay`, subscribe
   `subscription.activated`, `subscription.pending`, `subscription.cancelled`,
   `subscription.completed`, `payment.failed`, `payment_link.paid` → copy the webhook secret into
   `RAZORPAY_WEBHOOK_SECRET`.

---

## 9. Rollback
Stripe code + columns remain dormant for one release. Rollback = point env/routes back to Stripe.
Delete Stripe files + columns in a follow-up PR once Razorpay is verified in production.
