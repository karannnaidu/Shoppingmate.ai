# Dashboard Billing Redesign — Credit Model

**Date:** 2026-10-05
**Status:** Approved design (brainstorm) — ready for implementation plan
**Owner:** Karan + Claude
**Rail:** Razorpay (live — [[project_razorpay_billing_migration]]). Shopify App Store billing is parked (not active; code kept).

## 1. Problem

The billing page mixes three incompatible models — a conversation **quota**, a **voice surcharge** (`$0.30 × voice convos`), prepaid **top-up credits**, and **auto-recharge** — on top of the real Razorpay **subscription**. It's confusing, and every action button is a native HTML `<form>` posting to a route that returns JSON, so nothing redirects to Razorpay (dead buttons) and top-up fails parsing (`invalid topup_key`). Separately, login sessions don't persist.

## 2. The model (one unit: credits)

- **1 conversation = 1 credit**, text or voice. Cost is averaged across text+voice, so there is **no separate voice surcharge**.
- Each **plan is a Razorpay subscription** including a **monthly credit allowance**:

| Plan | Price/mo | Credits/mo | Cost @ full (≈$0.10/convo) | Gross margin |
|---|---|---|---|---|
| Starter | $30 | 100 | $10 | ~67% |
| Growth | $99 | 350 | $35 | ~65% |
| Scale | $299 | 1,000 | $100 | ~67% |

  Cost basis (verified): text ≈ $0.05/convo, voice ≈ $0.15/convo, blended ≈ $0.10 (~50% voice). If usage skews heavily voice the margin compresses toward ~50% — revisit numbers once the real voice ratio is known.
- **Top-ups** = one-time credit purchases (Razorpay payment link), priced at a flat **$0.30/credit** (~67% margin): **100 = $30, 500 = $150, 1,000 = $300**. Top-up credits **carry over** between cycles.
- **Consumption emails** at **50%, 75%, 100%** of the monthly allowance (Resend), once per threshold per cycle; the 100% email prompts a top-up.
- **At 0 remaining credits** (allowance + top-up balance exhausted) → **pause** the assistant: new conversations are refused until the merchant tops up or the cycle resets. (Confirmed: pause, not grace.)
- **No auto-recharge / auto-debit in v1** — the emails are the prompt; top-ups are manual. The existing auto-recharge code stays (UI removed), per "don't remove code" ([[feedback_dont_remove_code]]).

## 3. Credit accounting

- `allowance = PLAN_CREDITS[plan]` (starter 100 / growth 350 / scale 1000).
- `consumedThisCycle` = count of `conversationCompleted` metric events for the merchant in the current cycle.
- `remaining = allowance + topupBalance − consumedThisCycle` (allowance drawn first, then top-up balance).
- **Cycle = calendar month** for v1 (simple, mirrors the voice-cap approach). Refine to the Razorpay subscription period (`current_start`/`current_end`) later. Flagged as a known approximation.
- **Pause** when `remaining ≤ 0`.

## 4. Changes

### 4a. web/ — billing UI, routes, session, emails
- **`app/app/billing/page.tsx`** — redesign to: **Your plan** (name, price, credits/mo, renewal, Change-plan/Cancel) → **Credits this cycle** (single meter `used / allowance` + `Top-up balance: N`) → **Buy credits** (top-up packs) → **Invoices** → **Transactions**. Remove the voice-surcharge line, the dual quota bars, and the auto-recharge form.
- **Transactions section (new)** — a **collapsible, scrollable** panel listing **all attempted payments, success and failure**, newest first (date · type [subscription renewal / top-up] · amount · status [success/failed]). Collapsed by default; internal scroll (max-height) so a long history doesn't blow out the page. Source = our `razorpay_events` table keyed to the merchant (see §4b migration), so it reflects exactly what Razorpay reported to us — including `payment.failed`.
- **Route fixes (content-negotiate):** for a native form POST (not `application/json`), parse `req.formData()` and respond with a **303 redirect**; for JSON/fetch callers keep the JSON response (so tests + programmatic callers are unchanged):
  - `api/billing/checkout-session` → 303 to subscription `short_url`.
  - `api/billing/topup` → parse form body, 303 to payment-link `short_url`.
  - `api/billing/cancel` → 303 back to `/app/billing`.
- **`lib/razorpay.ts`** — reprice `TOPUP_AMOUNTS`/`TOPUP_QTYS` to 100/500/1000 at $0.30/credit.
- **`lib/auth.ts`** — add better-auth **`nextCookies()`** plugin (from `better-auth/next-js`) as the **last** plugin → fixes session persistence (root cause: sessions are created in DB but the cookie isn't persisted without it).
- **Consumption emails** — a Resend sender + per-cycle threshold tracking (store which of 50/75/100% were sent this cycle to avoid duplicates, e.g. a `credit_alerts_sent` jsonb/text column on `merchants` keyed by cycle).

### 4b. api/ — credit enforcement gate
- **`config/credits.ts`** (new) — `PLAN_CREDITS = { starter:100, growth:350, scale:1000 }` + `getCreditAllowance(plan)`.
- **`lib/creditUsage.ts`** (new) — `getConsumedThisCycle(merchantId)` (count `conversationCompleted` since cycle start) + `getRemainingCredits(merchant)`.
- **Gate at conversation start** — in the session-creation path (`POST /v1/session`, which both text and voice use) refuse with a `credits_exhausted` response when `remaining ≤ 0`, behind an env flag (e.g. `CREDIT_GATE_ENABLED`) so it stays dormant until ready. Widget shows a paused/unavailable state.
- **Email trigger** — at conversation end (where `conversationCompleted` is recorded), compute consumption % and, on crossing a new threshold, enqueue the 50/75/100% email.

### 4b-ii. Transaction log data (webhook → merchant linkage)
- Add **`razorpay_events.merchant_id`** (nullable text, additive migration) and populate it in `api/webhooks/razorpay/route.ts` whenever the event resolves to a merchant (via `subscription_id`/`customer_id`/`notes.merchant_id` already handled there). This makes `razorpay_events` queryable per-merchant for the Transactions section. Existing rows stay null (pre-linkage); new attempts are attributed.

### 4c. Keep (do NOT remove)
- Shopify voice-minute-cap code (`apps/api/src/config/plans.ts`, `lib/voiceUsage.ts`, voice-token gate) — parked ([[project_shopify_pricing_caps]]).
- Dormant Stripe billing code.
- Auto-recharge code (`app/app/billing/actions.ts`, `merchants.autoRecharge*` columns) — UI removed, code retained.

## 5. Testing & smoke (required — "all func working")
- Unit: credit config + allowance; consumed/remaining calc; each route's form-POST→303 and JSON→JSON branches; topup form-body parsing; email threshold-crossing (fires once per threshold).
- Smoke every billing button on a real logged-in session: **Subscribe → Razorpay hosted page**, **Buy top-up → Razorpay payment link**, **Cancel → returns to billing**, **Invoices render**, **Transactions panel expands/scrolls and shows a failed + a successful attempt**, and the **session persists** across navigations after login.

## 6. Open items / notes
- Cycle = calendar month in v1; refine to the subscription's billing period.
- Credit-alert dedupe storage (new `merchants.credit_alerts_sent`) — add via a new additive migration.
- `topupBalance` is consumed after the monthly allowance; resets never (carries over); allowance "resets" implicitly via the cycle window on `consumedThisCycle`.
- The credit gate (`CREDIT_GATE_ENABLED`) and the pause UX in the widget ship together; keep the flag off until both are verified.
