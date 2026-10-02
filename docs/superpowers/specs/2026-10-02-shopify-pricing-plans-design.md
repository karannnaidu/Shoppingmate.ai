# shoppingmate — Shopify App Store Pricing Design

**Date:** 2026-10-02
**Status:** Approved design (brainstorm) — ready for implementation plan
**Owner:** Karan (CEO mode) + Claude
**Relates to:** `shoppingmate/docs/GO-LIVE.md` STEP 5; `shoppingmate/app/routes/app.jsx` (billing gate)

## 1. Goal

Set the pricing for the shoppingmate Shopify App Store app so that:

- **Text chat is unlimited** (it is cheap and already margin-positive).
- **Voice is the metered, revenue-bearing line** ("pay for calls").
- Pricing stays **at least 70% above AI/infra cost** (the founder's stated floor — the literal
  "1.7× cost" reading, i.e. a ≥41% gross margin as the *floor*; the design targets materially
  higher via the base fee).

## 2. Cost basis (verified, Oct 2026 list prices)

All-in **voice COGS ≈ $0.05 / minute**:

| Component | Rate | Source |
|---|---|---|
| Gemini 2.5 Flash native-audio (`gemini-2.5-flash-native-audio-latest`) | ~$0.015/min | audio in $3 / out $12 per 1M tok, 25 tok/s — ai.google.dev/gemini-api/docs/pricing |
| LiveKit Cloud (`@livekit/agents`: agent $0.01/min + connection ~$0.0005/min) | ~$0.011/min | livekit.com/pricing |
| Text executor on every voice turn (Claude Haiku 4.5 via OpenRouter; Sonnet 4.6 on checkout turns) | ~$0.02/min | OpenRouter; prod `OPENROUTER_MODEL=anthropic/claude-haiku-4.5` |

- **Real average call length = 2.1 min** (measured: Calmosis `conversation_sessions`, 44 sessions/30d)
  → **~$0.10 of COGS per typical call**.
- **Text chat ≈ $0.03–0.10 / conversation** (Haiku) — absorbed into the base fee as "unlimited."
- Prod already runs the Haiku executor (the strategy doc's #1 margin fix), so COGS is in the
  post-fix target band ($0.10–0.25/call).

Assumptions / caveats:
- Rates are list prices; actual cost varies with talk ratio, call length, and tool usage.
- `OPENROUTER_CHECKOUT_MODEL` is unset in prod, so checkout turns fall back to Sonnet 4.6 — a
  minor cost bump already included in the ~$0.02/min executor figure.

## 3. Pricing model (decided)

**Shape:** base fee + included voice-minutes + overage. (Chosen over pure pay-per-call and over
flat-capped tiers because it yields predictable MRR, covers the unlimited-text subsidy + fixed
infra, and protects margin regardless of usage mix.)

**Billing unit:** per **minute** (the system already meters voice in seconds via
`recordVoiceSeconds`). Marketed as "calls," billed by the minute under the hood — a 6-min call
costs ~3× a 2-min call, so per-minute protects margin where per-call flat would not.

**Currency:** USD. The Shopify App Store bills in USD; ICP is US/UK/AU D2C. Calmosis/India dogfood
stays on the separate Razorpay path (`feat/razorpay-billing`), out of scope here.

### Plans

| Plan | Price/mo | Unlimited text | Voice-min included | ≈ calls @2min | Overage (metered phase) | COGS @ full use | Gross margin @ full |
|---|---|---|---|---|---|---|---|
| **Starter** | **$29** | ✓ | 200 | ~100 | $0.10/min | $10 | **66%** |
| **Growth** | **$99** | ✓ | 800 | ~400 | $0.10/min | $40 | **60%** |
| **Scale** | **$299** | ✓ | 2,600 | ~1,300 | $0.10/min | $130 | **57%** |

- **Overage = $0.10/min flat = 2× cost (50% gross margin)** — clears the 1.7× floor with cushion
  for the text subsidy. Applies only once metered overage ships (Phase 2).
- Margins shown are the worst case (every included minute burned); light users are far more
  profitable because the base fee is fixed.
- Optional annual billing = 10× monthly (2 months free) — improves cash + retention. Nice-to-have,
  not required for v1.

### Spike protection (differentiator — strategy doc §risks)

- Default **monthly usage cap = 3× included minutes** per plan; merchant can raise it. No silent
  runaway bills (directly attacks the Gorgias/Rep "bill shock" complaint).
- Existing per-call caps remain: 6-min speech (`VOICE_SECONDS_TRIP`), 30-min wall-clock.

## 4. Implementation phasing (decided: ship A now, build B next)

Shopify "Managed Pricing" is now **Shopify App Pricing** and supports usage-based charges via the
**App Events API** (define a meter in the Partner Dashboard; app sends usage events; Shopify
aggregates + invoices). The legacy **Billing API** ("manual pricing") also supports it via
`appSubscriptionCreate` (recurring + usage line + capped amount) + `appUsageRecordCreate`.

### Phase A — v1 go-live (no code beyond config) — SHIP FIRST

- Create three **flat recurring** plans in the Partner Dashboard: Starter $29, Growth $99,
  Scale $299.
- Each plan enforces a **hard monthly voice-minute cap** (200 / 800 / 2,600). When a merchant hits
  the cap, **voice pauses** for the rest of the cycle; **text stays unlimited**.
- Matches the current `app.jsx` managed-pricing redirect. Unblocks GO-LIVE STEP 5 submission.
- Enforcement of the cap is the only code touch: the voice-agent/API must refuse to start a voice
  call once the merchant's month-to-date metered minutes ≥ the plan cap (we already meter minutes;
  we need to aggregate per merchant per billing cycle and gate call start). If this is not yet
  wired, Phase A ships with the cap as a **soft/advisory** limit and the hard gate lands with
  Phase B. (Implementation plan to resolve which.)

### Phase B — metered overage (fast-follow)

- Define a `voice_minutes` meter (App Events API) **or** add a usage line via the Billing API.
- Emit metered voice-minutes from the existing metering (`recordVoiceSeconds` → per-merchant,
  per-cycle usage events / `appUsageRecordCreate`).
- Rework the `app.jsx` billing gate to the subscription-with-usage model; apply the 3× usage cap.
- Switch plans from "hard cap" to "included + $0.10/min overage."

## 5. Out of scope

- Value-based pricing (a slice of assisted revenue) — revisit once STEP 6 `read_orders` +
  conversion attribution ship. Cost-plus is the v1 floor.
- Razorpay / direct (non-Shopify) billing — separate track.
- Annual plans — optional, can be added any time in the Partner Dashboard.

## 6. Open questions for the implementation plan

1. Does the backend already aggregate metered voice-minutes **per merchant per billing cycle**, or
   is that new? (Determines whether Phase A's cap is hard or advisory.)
2. Where is the voice-call start gated (`app.jsx`? `api`? `voice-agent`?) so the cap can refuse a
   call cleanly with a merchant-facing message?
3. App Events API meter vs Billing API usage line for Phase B — pick based on whether the app is on
   new App Pricing or legacy managed pricing (confirm in Partner Dashboard).
