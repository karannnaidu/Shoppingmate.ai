# shoppingmate.ai v0.1 — Product Roadmap

**Date:** 2026-04-30 (last revised 2026-05-01)
**Owner:** Karan (Calmosis)
**Purpose:** Single source of truth that anchors every implementation plan. If a plan drifts from this roadmap, the roadmap wins. If a feature isn't here, it isn't v0.1.

> **2026-05-01 revisions:** voice stack swapped to LiveKit + Gemini Live (see [ADR-0001](../adr/2026-05-01-voice-stack-livekit-gemini-live.md)); pricing model switched from INR flat tiers to USD consumption-based with margin floor (see [strategy §5](../strategy/2026-05-01-shoppingmate-strategy.md)); Slack-as-OS operating model added (see [docs/operating-model.md](../operating-model.md)).

---

## 1. The end goal (one paragraph)

Ship a single `<script async src="cdn.shoppingmate.ai/v1.js" data-id="SM-XXXX"></script>` snippet that any merchant pastes into their website's `<head>` to get an AI sales agent (voice + text) that talks to their visitors, autonomously builds carts, applies best-available coupons, and hands off to the merchant's native checkout. It works on Shopify, WooCommerce, Magento, BigCommerce, Wix, Squarespace, and arbitrary custom websites — without the merchant writing a single line of code. Five paying beta merchants live by end of v0.1.

---

## 2. v0.1 done-criteria

A merchant can:

1. **Install in under 60 seconds** — paste one `<script>` tag into their site.
2. **Be auto-onboarded** — shoppingmate.ai detects their platform, syncs their catalog, extracts cart/checkout/coupon selectors, and is live within ~5-8 minutes with zero merchant action.
3. **Receive a complete sale end-to-end** — visitor lands → talks (voice + text) to widget → picks variant → coupon auto-applied → taps "Pay" → redirected to merchant's native checkout → completes purchase → conversion attributed back to shoppingmate.ai.
4. **Configure their agent** through `app.shoppingmate.ai` dashboard:
   - Persona, brand voice, lead webhook
   - **Upload a Brand Knowledge Base** (PDFs, docs, FAQs, returns/shipping copy) that the agent uses verbatim
   - View conversation logs, conversion stats, catalog sync status
   - **Safety-valve override** for the rare case where our auto-detection picked the wrong trigger (see §7 reliability targets) — alert-driven, not a primary surface; overrides are permanent and locked once set
5. **See accurate billing** — flat SaaS subscription via Stripe Billing (conversation-tiered: Starter / Growth / Scale). shoppingmate.ai is **not a payment processor** — merchants keep their existing checkout and payment flow unchanged.
6. **Trust the privacy posture** — no card data ever in widget, conversation transcripts auto-expire at 24h, no cross-merchant data sharing.

If any one of these fails for the closed-beta cohort, v0.1 is not done.

---

## 3. External dependencies (imported, not built)

| Dependency                        | Purpose                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Anthropic API**                 | Sonnet 4.6 for tool-use turns + onboarding selector extraction; Haiku 4.5 for default text routing + selector resolution |
| **Google Gemini API**             | Gemini 2.5 Flash Live native audio for voice in/out (see [ADR-0001](../adr/2026-05-01-voice-stack-livekit-gemini-live.md)) |
| **LiveKit Cloud**                 | WebRTC transport for voice (replaces the original second-WebSocket-for-audio-frames pattern)     |
| **Stripe Billing**                | Consumption-based subscription + top-up packs (see §4 Phase 3 for plan structure)                |
| **Google Safe Browsing API**      | Phishing-domain check on merchant URLs                                                           |
| **OpenAI Moderation API**         | Sampled content moderation on outgoing TTS text                                                  |
| **Playwright**                    | Headless rendering for onboarding crawl + selector extraction                                    |
| **BullMQ**                        | Redis-backed background workers                                                                  |
| **uWebSockets.js**                | High-throughput WebSocket server (~10K conn/node)                                                |
| **Postgres / Redis / S3 (or R2)** | Durable / ephemeral / blob storage tiers                                                         |

---

## 4. Phase split

Each phase produces working, testable software on its own. Phases are sequenced by dependency, not calendar.

### Phase 1 — Working widget end-to-end (all platforms)

The full agent runtime, working on every supported platform, with the full voice stack. No dashboard, no billing, no recrawl/healing yet — just the rails.

**Includes:**

- gtag bundle (~120KB gzip, vanilla JS Web Component, Shadow DOM)
- Backend orchestrator (WebSocket, LLM tool-call loop, internal adapter dispatcher over the v0.1 tool surface)
- Onboarding worker (platform fingerprint, catalog sync, selector extraction → `merchant.json`)
- 7 adapters: ShopifyAdapter, WooAdapter, MagentoAdapter, BigCommerceAdapter, WixAdapter, SquarespaceAdapter, DOMAdapter
- SuggestAdapter fallback (when DOM control fails)
- Runtime selector resolver (Haiku 4.5, cached in Postgres). For DOMAdapter, `adapter_config` stores **multi-selector fallback chains per verb** so the runtime tries known alternates before invoking the resolver.
- Voice stack: LiveKit Agents (WebRTC) + Gemini 2.5 Flash Live native audio, 8 personas via voice-descriptor prompts (see [ADR-0001](../adr/2026-05-01-voice-stack-livekit-gemini-live.md))
- **Pricing discipline:** D2C-only cohort → static catalog pricing assumed. Widget cards display price from `products.price_cents` (DB-trusted). The voice agent **never speaks numeric prices** — always paraphrases and defers to what's visible on the screen.
- Coupon UX (P1): single tool `coupons.try(code)` only. Discovery + suggestion verbs are P2.
- Payment handoff: redirect to merchant's native checkout
- Conversion attribution (gtag detects post-purchase page → POST /v1/conversion)
- Postgres schema, Redis TTLs, S3 for screenshots/transcripts

**Acceptance:**
A visitor on each of (a) a dev Shopify store, (b) a dev Woo store, (c) a hand-built custom HTML site can complete a full voice-driven purchase: greet → product Q&A → cart build → coupon apply (manual code in v0.1) → redirect to native checkout → purchase → conversion event lands in Postgres. Throughout the conversation, the agent never voices a numeric price (verified by transcript review).

### Phase 2 — Self-healing + merchant dashboard

**Includes:**

- Daily recrawl worker (drift detection, smoke tests)
- Selector cache schema + LLM auto-heal flow
- `app.shoppingmate.ai` merchant dashboard (designed primary-vs-safety-valve — see §11):
  - **Primary surfaces** (every merchant uses):
    - Login + merchant signup
    - Brand Knowledge Base upload (PDFs, .docx, .md, plain text; chunked + indexed; injected into agent system prompt at session start)
    - Persona / brand voice / tone config
    - Lead webhook config
    - Conversation log viewer
    - Catalog sync status
    - Conversion / sales attribution dashboard
  - **Safety-valve surfaces** (rarely used — only when our auto-detection failed):
    - Recipe-card editor with visual element picker, per-selector test button, **permanent override locks** (`source='merchant_override'` → immune to auto-recrawl + LLM healing for that selector)
    - Override-failing alerts (email + dashboard banner + suggested-fix one-click accept; override stays locked until merchant explicitly accepts the suggestion or unlocks via "Restore auto-detected")
    - Per-product price/title override (locked, immune to recrawl, same `merchant_override` pattern as selectors; alert if override diverges from live page)
  - Override surfaces are **alert-driven, not browse-driven** — merchants land on them via notifications, not exploration. Success metric: <5% of merchants ever click into an override editor.
- **Brand KB retrieval mode:** naïve concat of all chunks into the system prompt when total ≤ 8K tokens; embedding-based top-K (k=6) fallback only when the KB exceeds the budget. Build the fallback when the first merchant trips it, not before.
- **Coupon discovery + auto-apply pipeline:**
  - New tools: `coupons.list` (returns active codes with rules) and `coupons.suggest(cart)` (server-ranked best applicable code, with reasoning)
  - Discovery sources: scrape merchant's coupon page + observed-codes table + merchant-entered codes in dashboard (locked)
  - Auto-apply policy per merchant: `ask_first` (default — agent suggests, visitor confirms) or `auto_stack_best` (silent application of the best code)
- Fraud signals: Safe Browsing API check, OpenAI moderation sampling, anomaly detection, kill-switch (suspend merchant in <30s)

**Acceptance:**
Merchant can sign up at app.shoppingmate.ai, paste their script tag, see live conversations, override a broken selector via the visual picker, and have the override survive the next daily recrawl. Kill-switch verified end-to-end.

### Phase 3 — Billing + closed beta

**Includes:**

- Cost ledger (per-conversation LLM voice + text + selector + onboarding amortized spend, per-merchant rollup)
- Per-merchant cost caps + anomaly trip wires + **margin-floor pager** (Slack `#alerts-margin` if any plan's worst-case GM dips below 70% in a rolling 7d window)
- **Stripe Billing — consumption-based, conversation-metered (revised 2026-05-01):**
  - Starter: $30 / mo, 100 conversations
  - Growth: $99 / mo, 500 conversations
  - Scale: $299 / mo, 2,000 conversations
  - Pro: $799 / mo, 10,000 conversations
  - Enterprise: custom
  - **Top-up packs replace overage billing:** 50 / 200 / 1,000 / 5,000 conversations at $19 / $59 / $199 / $799. Never expire. Auto-recharge opt-in (threshold + pack size set per merchant), hard cap 3 auto-recharges per billing period.
  - **Per-conversation hard caps (margin guarantee):** 15 turns / 3 min voice / 25 min duration. No-reply sessions and bot traffic don't count.
  - **Voice-fairness surcharge:** $0.30 per voice conversation above a 20% voice ratio in a billing period. Disclosed up front. This is the explicit mechanism that holds the 70% worst-case GM floor under voice abuse.
  - **No trial / no free tier.** Live demo on shoppingmate.ai is the trial; signup goes directly to Starter. Day-1 paid.
- Stripe Billing portal embedded in merchant dashboard (card-on-file, invoice history, plan upgrade, top-up purchase, usage meter, voice-ratio meter)
- Month-end invoice generation + mid-period overage warnings
- E2E test suite (canonical user-journey flows × 3 personas × 3 install scenarios)
- 5 paying beta merchants live: 2 Calmosis customers + 1 each from apparel / electronics / services

**Explicitly NOT in Phase 3:** no Stripe Connect, no Razorpay Routes, no take-rate / revenue-share splits, no payment-processor integration on the merchant's settlement side. shoppingmate.ai charges merchants directly for the SaaS service; the merchant's visitor-side checkout / processor / payouts are entirely unchanged.

**Acceptance:**
First $ of SaaS revenue collected. Month-end invoices reconcile to within 0.5% of cost-ledger totals. All 5 beta merchants have completed at least one shoppingmate.ai-attributed sale (visitor → merchant's native checkout → conversion event recorded), and all 5 are on a paying tier (Starter or above). **Margin gate:** measured worst-case GM across the 5-merchant cohort ≥ 70% on every plan including the voice-fairness surcharge (see strategy §5.4); if the gate fails, hold the public launch and trigger the cost-cut playbook before adding more merchants.

### Phase 4 — Cross-merchant selector recipe sharing (post-beta amortization)

First post-v0.1 amortization phase. Turns every DOM merchant's onboarding cost into a one-time donation to a shared library so the next merchants on the same template onboard for free. Pattern adopted from Anakin Holocron's wire-library model, applied to our DOM tier where it actually changes the unit economics. Depends on Phase 3 because the library needs a beta cohort (>0 merchants) to start populating.

**Includes:**

- `selector_recipes` table — `page_template_hash` PK, `selectors jsonb`, `contributed_by_merchant_id`, `hit_count`, `last_hit_at`, `created_at`, `quarantined_at`.
- Lookup-before-Sonnet in `apps/worker/src/steps/selectorExtract.ts` (Plan 3a §6.3): query `selector_recipes` by `page_template_hash` first; on hit, copy selectors → `merchants.adapter_config`, increment `hit_count`, skip the Sonnet call. On miss, run extraction as today and `INSERT` the result.
- **Smoke-test gate (mandatory before trusting a recipe):** the merchant's own smoke test must still pass with the borrowed selectors before we mark them `live`. Recipe is a *hint*, not a guarantee. Smoke fail → fall back to fresh Sonnet extraction and don't increment `hit_count`.
- **Recipe-poisoning quarantine:** if a recipe's merchants fail smoke at >20% rate over a rolling 10-merchant window, set `quarantined_at` and exclude from future lookups until manually reviewed in the dashboard. Prevents one bad donation from breaking everyone else.
- New metrics: `onboardingSelectorRecipeHit { hash, contributed_by }`, `onboardingSelectorRecipeMiss { hash }`, `onboardingSelectorRecipeContributed { hash, merchant_id }`, `selectorRecipeQuarantined { hash, fail_rate }`.
- Privacy posture: `selectors` are CSS strings derived from public page structure, not merchant content. Documented in the table comment so cross-merchant sharing is unambiguously safe.

**Acceptance:**
A second DOM merchant onboarding with a `page_template_hash` matching a prior merchant's recipe skips the Sonnet selector-extract call (verified: no `onboardingSelectorExtractCompleted` event for that merchant), passes smoke, reaches `status='live'`, and emits `onboardingSelectorRecipeHit`. Cost ledger shows $0 selector-extract spend for that merchant. Quarantine path verified by force-feeding a deliberately-broken recipe and observing it gets flagged after the threshold.

---

## 5. Dependency graph

```
[ext: OpenRouter, ElevenLabs, Whisper, Playwright, BullMQ] ──┐
                                                              │
                                                              ▼
                                                          Phase 1
                                                              │
                                                              ▼
                                                          Phase 2
                                                              │
                                                              ▼
                                                          Phase 3
                                                              │
                                                              ▼
                                                          Phase 4
```

Phases are strictly sequential. No phase ships before the prior one's acceptance criteria pass.

---

## 6. Don't-drift guardrails

These are explicit non-goals of v0.1. Any plan that adds one is rejected and parked for v0.2:

- ❌ Inline card capture (no Stripe Elements / Razorpay Standard inside the widget — shoppingmate.ai NEVER sees payment data)
- ❌ Shopify App Store listing (gtag-snippet-only install in v0.1)

- ❌ ChatGPT plugin / Gemini reception agent
- ❌ Voice cloning
- ❌ Multi-language (English-first; Hindi parked for v0.2)
- ❌ Cross-merchant identity / wallet
- ❌ Persistent visitor profiles beyond 24h
- ❌ Native mobile SDKs (iOS / Android)
- ❌ A/B testing of personas or prompts
- ❌ Multi-seat dashboard / RBAC
- ❌ Custom-CSS theming (preset themes only)
- ❌ Standalone consumer iOS app
- ❌ Heterogeneous carts inside one merchant agent
- ❌ Free SaaS tier without conversation cap
- ❌ LLM call directly from the browser (always through backend)
- ❌ Full guardrail-template authoring (only age-gate, Rx, financial in v0.1)
- ❌ Services / bookings (salons, spas, fitness, consultants) — products-only in v0.1; see v0.2 design
- ❌ Listings (apartments, real estate, rentals) — v0.2 only; see v0.2 design
- ❌ Voice agent speaking numeric prices (always paraphrase + defer to what's on screen)
- ❌ Dynamic / per-visitor pricing models (D2C static-pricing assumption; non-D2C pricing engines parked for v0.2)
- ❌ Quote-freeze / verify-before-commit price re-fetch (replaced by D2C trust + dashboard correction)
- ❌ Take-rate / revenue-share / per-transaction pricing (we are not a payment processor — merchants pay flat SaaS only; visitor money never touches us)
- ❌ Stripe Connect / Razorpay Routes / any payment-processor-side integration on the merchant's settlement (parked indefinitely — would require merchants to migrate processor accounts downstream of us, which conflicts with the "zero-friction install" promise)
- ❌ Override-as-headline-feature in dashboard (overrides exist as an alert-driven safety valve — see §7 reliability targets; if merchants need to override frequently, that's a product failure)
- ❌ Any plan or pricing change that breaches the **margin floor** (blended GM ≥ 75%, worst-case GM ≥ 70% per plan including surcharge revenue — see strategy §5.4). Breach is paged to Slack `#alerts-margin`; no exec override.
- ❌ Dropping or relaxing the **per-conversation hard caps** (15 turns / 3 min voice / 25 min duration). The caps are the margin guarantee — non-negotiable.
- ❌ Dropping or weakening the **voice-fairness surcharge** ($0.30 per voice conversation above 20% voice ratio). It's the explicit mechanism that holds the floor under voice abuse.
- ❌ Free tier or extended free trial. Day-1 paid is an invariant; the live demo on the landing page is the trial.
- ❌ Whisper / ElevenLabs / any voice stack other than LiveKit + Gemini Live without a new ADR superseding [ADR-0001](../adr/2026-05-01-voice-stack-livekit-gemini-live.md).

---

## 7. Reliability targets (the "we should be right by default" promise)

The dashboard's override surface (§4 Phase 2, §6 guardrails) exists as a **safety valve** — not a primary feature. The product promise is that merchants almost never need it. This section sets numeric targets that anchor that promise; if we miss them, we fix the product, not push more work onto merchants.

### 7.1 Why we can be right by default

The gtag in the visitor's browser is *not* trying to read the merchant's frontend code to figure out what's what. All the intelligence happens **server-side during onboarding**:

1. **Platform fingerprint (§4 Phase 1, OnboardingWorker)** — for the 6 supported platforms (Shopify, Woo, Magento, BigCommerce, Wix, Squarespace) we don't guess at all; we call the platform's documented guest-cart API. ~88% of D2C merchants land here.
2. **Vision-grounded selector extraction** — only DOMAdapter merchants (~12%) need DOM driving. We render their pages with Playwright (real Chromium, server-side), screenshot + DOM, ask Sonnet 4.6 "which element is the Add-to-Cart button?", validate with a synthetic smoke test, then cache. The widget only ever executes pre-validated selectors.
3. **Multi-selector fallback chains (§4 Phase 1)** — DOMAdapter `adapter_config` stores 2-3 candidate selectors per verb; runtime tries alternates before invoking the LLM resolver.
4. **Daily recrawl + smoke test (§4 Phase 2)** — drift is detected and auto-healed before merchants notice.

### 7.2 Numeric targets (acceptance gates for v0.1)

| Metric                                                                | Target  | Measured how                                                                                                |
| --------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| Selector accuracy on platform adapters (Shopify/Woo/Magento/BC/Wix/Sqsp) | ≥99.5%  | Synthetic cart-add succeeds on first try across the closed-beta cohort                                       |
| Selector accuracy on DOMAdapter (custom sites)                        | ≥95%    | Same metric, scoped to dom-adapter merchants                                                                |
| % of merchants who ever click into a manual override editor in 30 days | <5%     | Dashboard analytics                                                                                         |
| % of selector failures auto-healed by Haiku without merchant action    | ≥90%    | `selector_cache` rows where `source` transitioned `auto`→`llm_resolved` and next 10 turns succeeded         |
| Merchant-action time when override IS needed                          | ≤60s    | Email-alert → click "Accept suggested fix" → done; measured wall-clock                                      |
| Override-failing alert dedup window                                   | 24h     | One alert per `(merchant_id, selector_key)` per day; multi-fire = bug                                       |

### 7.3 What "miss the target" triggers

- Falling below 99.5% on platform adapters → that platform's adapter is broken; halt new beta merchants on that platform until fixed.
- Falling below 95% on DOMAdapter → expand multi-selector fallback chains, retrain extraction prompt; **do not** push merchants into manual override.
- More than 5% of merchants opening override editor → root-cause from logs (which selector_key fails most), then fix detection — never accept this as steady state.

### 7.4 What this means for the dashboard UX (Phase 2)

- **Default landing page** = conversation logs + conversion stats + Brand KB. Not "Recipe Cards."
- **No "Recipe Cards" tab in primary nav** unless an alert is active. When an alert fires, a banner appears at the top of every page: _"Your checkout-button override is failing — accept the auto-suggested fix?"_ One click to accept.
- **No "manage all selectors" browse view.** If a merchant wants to see every selector we use, that's an admin/support flow, not a self-serve dashboard surface.

---

## 8. v0.2 candidates (parked, not rejected)

- **Services & Bookings vertical** (salons, spas, fitness, consultants) + **Listings vertical** (apartments, real estate, rentals) — full design parked at `docs/superpowers/specs/2026-04-30-shoppingmate-v0.2-services-and-listings-design.md`
- **Brand-tuned voice persona ($99/mo upsell)** — dependent on Gemini's voice-clone surface maturing (see [ADR-0001](../adr/2026-05-01-voice-stack-livekit-gemini-live.md) §3 risks). Until then, 8 preset personas only.
- **Multi-language voice** (Hindi, Spanish, Portuguese, Indonesian) — gated on Gemini Live language coverage; revisit at month 9.
- Native mobile SDKs
- Standalone consumer iOS app
- A/B testing, advanced analytics, GA4 / Mixpanel exports
- Affiliate / partnership program for agencies
- Full guardrail-template library + custom-rule authoring
- Self-serve onboarding wizard for non-technical merchants
- **Wave 3 geographies (India / Brazil / Mexico / SEA)** — month 13+ only (post-default-alive). US / UK / CA / AU are v0.1 markets.

**Removed from v0.2 candidates** (now permanent non-goals — see §6 guardrails):

- ~~Inline checkout via Stripe Elements / Razorpay Standard~~ — conflicts with the "shoppingmate.ai NEVER sees payment data" promise; merchants always own the checkout step
- ~~Cross-merchant wallet / identity~~ — same reason; we are not a payment / identity layer
- ~~Take-rate / revenue-share billing~~ — would require us to become a regulated money-mover; SaaS-only forever

---

## 9. Phase status tracker

| Phase                         | Status        | Spec                                       | Plan |
| ----------------------------- | ------------- | ------------------------------------------ | ---- |
| 1 — Working widget end-to-end | In progress   | `2026-04-30-shoppingmate-phase1-design.md` | Plans 1–4 ✅ complete; Plans 5–7 pending |
| 2 — Self-healing + dashboard  | Pending       | TBD                                        | TBD  |
| 3 — Billing + closed beta     | Pending       | TBD                                        | TBD  |
| 4 — Cross-merchant selector recipe sharing | Pending | TBD                              | TBD  |

### Phase 1 sub-plan status (2026-05-03 progress log)

| Plan                                                                | Status         | Notes |
| ------------------------------------------------------------------- | -------------- | ----- |
| Plan 1 — Foundation (workspace, db, jobs, api, worker)              | ✅ Complete    | Commits through `64db3ca`. |
| Plan 2 — Provisioning (CLI + `/v1/install` + onboarding pipeline)   | ✅ Complete    | Commits through `f516457`. |
| Plan 3a — Onboarding completion (catalog + selectors + smoke)       | ✅ Complete    | Phase A+B (1-11) ✅ — `113b4ac`, `fc4dd7d`. Phase C (12-18, catalog clients) ✅ — `92ac85a`. Phase D-I (19-25, orchestrators + repo + pipeline wiring) ✅ — `4e1896d`, `ef5a144`, `0115739`, `3558ec8`, `5ad83ae`, `f747b87`. 91/91 tests pass. Acceptance tasks 26-29 (live dev stores + git tag) deferred. |
| Plan 3b — Wedge adapters (Shopify + Woo)                            | ✅ Complete    | Tasks 1-13 ✅ — `1ba0ab3`…`4f8c7e3` (13 commits). 117/117 tests pass; new `packages/adapters/` package + adapter-smoke CLI. Acceptance tasks 14-16 (live dev stores + git tag) deferred. |
| Plan 3c — Remaining platform adapters (Magento/BC/Wix/Squarespace)  | ✅ Complete    | Tasks 1-15 ✅ — `899c750`…`d8a780f` (15 commits): 4 catalog clients + dispatcher routing + detected_platform promotion + 4 new adapters + dispatcher wiring + contract test + smokeTest delegation. 162/162 tests pass. Acceptance tasks 16-18 (live stores + tag) deferred. |
| Plan 3d — DOMAdapter + WS transport + selector resolver             | ✅ Complete    | Tasks 1-15 ✅ — culminating in `d94fb77`. New `packages/dom-harness/`, JWT-gated WS at `apps/api`, selector resolver with Haiku healing, DOMAdapter wired through dispatcher. 202/202 tests pass. Acceptance tasks 16-19 (live custom site + tag) deferred. |
| Plan 3e — SuggestAdapter + auto-promotion + `set-adapter` CLI       | ✅ Complete    | Tasks 1-13 ✅ — `64e3a28`…`94c9592`. SuggestAdapter, exhaustive dispatcher (`assertNever`), `promoteToSuggest`, smokeTest auto-promotes DOM→Suggest on action_cap/override_failing/gave_up or 3 unsupported, `set-adapter` CLI, adapter-smoke handles Suggest. 230/230 tests pass. Acceptance tasks 14-15 deferred. |

**Plans 1–5 complete (2026-05-04).** Repo-wide: `pnpm typecheck` clean across all 9 workspaces; `pnpm test` 72 files / 360 tests passing; `pnpm lint` 4 pre-existing errors in quarantined slack workstream. Skipped per instructions: live dev-store acceptance runs.

**Phase 1 is NOT closed yet** — Plans 1–3 built the adapter substrate (catalog + cart + smoke); Plan 4 built the Sonnet 4.6 agent runtime that wraps it. The widget, the voice stack, and conversion attribution are still to come. Plans 5–7 below close Phase 1.

### Phase 1 closing plans (2026-05-04 — pending brainstorm + writing-plans)

| Plan                                                                         | Status        | Scope summary |
| ---------------------------------------------------------------------------- | ------------- | ------------- |
| Plan 4 — Backend agent runtime (Sonnet 4.6 tool-use loop)                    | ✅ Complete   | 31 tasks across 10 phases (A-J), commits `f20622b`…`a6aa078` (26 commits). Sonnet 4.6 tool-use loop in `apps/api/src/agent/` wrapping all 8 adapters; 7 dot-namespaced tools; heterogeneous WS event stream (say/cards/checkout_redirect/cap_warning/session_closed); per-conversation hard caps (15 turns / 3 min voice / 25 min); no-numeric-prices invariant via `stripPrices()`; 24h Redis session-resume; 8K-token history truncation; NoOpWSTransport for non-DOM adapters; recorded-fixture integration tests + `agent-replay <fixture>` CLI. 315/315 tests pass. Acceptance task 30 (live Shopify dev-store) deferred. |
| Plan 5 — Voice-first widget shell                                            | ✅ Complete   | 22 tasks across 10 phases (A-J), commits `3713425`…`6b26a98` (22 commits). Vanilla TS + Shadow DOM bundle in `packages/widget/`, 7 dot-namespaced WS protocol consumed verbatim from Plan 4, half-duplex Web Speech API audio (Plan 6 swaps for LiveKit + Gemini Live), heterogeneous transcript with inline product cards, new `POST /v1/session` endpoint mints WS tokens, `examples/host-page.html` for local smoke. Bundle size: 6.9 KB gzip (5.6% of 120 KB budget). 360/360 tests pass. Live browser smoke deferred to operator. |
| Plan 6 — Voice stack (LiveKit Cloud + Gemini 2.5 Flash Live native audio)    | ✅ Code-complete | 32 tasks across 10 phases (A-J), commits `c467b68`…`9ede242` (30 Plan 6 commits). Plan 4 runtime extracted to `packages/agent/` (zero behavior change, all tests preserved). New `apps/voice-agent/` service bridges LiveKit Cloud + Gemini 2.5 Flash Live native audio to Plan 4's `runTurn`. 8 personas mapped to Gemini prebuilt voices (aoede/leda/fenrir/kore/orus/puck/charon/zephyr). Defense-in-depth on no-numeric-prices: `stripPrices()` in postprocess + `geminiSession.speak()` rejects digits/$ + voice sysprompt forbids. Per-session caps (16 turns / 180s voice / 25min wall-clock) trip with cap-warning + session_closed dataChannel events. Per-conversation metrics ledger flushes on disconnect for cost-pilot accounting. `POST /v1/voice/token` mints scoped LiveKit JWT bound to `sm_<sessionId>`. Widget lazy-loads `livekit-client` from `cdn.shoppingmate.ai/vendor` — bundle stays at 7.6 KB gzip (6.2% of 120 KB budget) with SDK-sentinel scan asserting absence. Bootstrap tolerates 503 from `/v1/voice/token` — chat is the safety floor. Cost pilot runbook + replay CLI ready (`docs/runbooks/gemini-live-cost-pilot.md`, `apps/voice-agent/scripts/pilot-replay.ts`). Live smoke + Plan 4-bis cost pilot deferred to operator. |
| Plan 7 — Conversion attribution (gtag detect → POST /v1/conversion → ledger) | 🟡 Brainstorm | gtag detects post-purchase page, fires `/v1/conversion` with cart token + attribution window. Server reconciles to merchant's order webhook (Shopify/Woo) where available, marks the conversation as converted, surfaces revenue in the Phase 2 dashboard's stub. |

**Voice-first invariants captured 2026-05-04:**
- Voice is primary; text is fallback. Widget defaults to call-ready pill, not chat.
- Live transcript is **heterogeneous** — text bubbles + product card rows + back to text. Cards carry image, title, price, variantId, productUrl.
- Cards are tappable; tap emits the same `cartAdd` event a voice command would, so the agent stays in the loop and acknowledges aloud.
- "Any website" claim is bounded: real cart writes on Shopify/Woo/Magento/BC; DOM adapter for clean custom storefronts; Suggest (recommend + handoff) for everything else. Documented openly so beta copy doesn't overpromise.

Update this table as each spec / plan is written or implemented.

---

## 10. How to use this document

- **Before writing a plan:** check §4 for which features the plan must satisfy and §6 for what it must not include.
- **Before merging a task:** check that it contributes to a §2 done-criterion. If not, it's likely scope creep.
- **When tempted to add a feature:** check §6. If it's there, it's parked.
- **When tempted to push work onto merchants** (overrides, manual fixes): check §7. The product should be right by default; merchants are the safety valve, not the workflow.
- **When estimating effort:** §5 governs sequencing; don't promise dates that violate it.

---

## 11. Source documents

- **Phase 1 spec:** `docs/superpowers/specs/2026-04-30-shoppingmate-phase1-design.md`
- **v0.2 parked design:** `docs/superpowers/specs/2026-04-30-shoppingmate-v0.2-services-and-listings-design.md`
- **Strategy (positioning, pricing, hiring, ops):** `docs/strategy/2026-05-01-shoppingmate-strategy.md`
- **Viability analysis (risk register):** `docs/strategy/2026-05-01-shoppingmate-viability-analysis.md`
- **Voice-stack ADR:** `docs/adr/2026-05-01-voice-stack-livekit-gemini-live.md`
- **Slack-as-OS operating model:** `docs/operating-model.md`
- **Slack-driven OAuth install flow spec:** `docs/superpowers/specs/2026-05-01-slack-install-flow.md`
- **User strategic notes (historical):** `new_arch.md`
