# Calmosis Voice Assistant — Reliability Hardening & One-Pass Verification

**Date:** 2026-06-22
**Goal:** Consolidate every voice/checkout/dashboard fix made in scattered patches this session into one design, confirm what's shipped, close the few remaining items, and verify the whole thing in a **single end-to-end pass** instead of whack-a-mole.
**Baseline / rollback:** tag `v0.1.0-stable` (commit `53bcdb9`). Each change below is revertible to it.
**Constraint:** voice can't be tested headlessly — §4 is a human-run protocol on a real call + the dashboard.

---

## 1. Architecture recap (so the fixes make sense)

Voice is **two brains**: **Gemini Live** (native audio) hears the visitor and speaks; a **side-channel executor** (OpenRouter, via the bridge) runs the tool-loop (cart/checkout/navigate). The widget joins a LiveKit room; the voice-agent worker is dispatched per room and opens Gemini on `start_voice`. The Calmosis storefront exposes `__shoppingmate*__` hooks (cart/checkout/state/place); the dashboard reads `conversationCompleted` metric rows + `visitor_profiles` + `conversion_events`.

Failure classes we hit: session death (no reconnect), end-of-call record lost (teardown race), VAD too deaf (no barge-in, dropped words), context overflow (1008), and attribution gaps.

---

## 2. Status matrix — everything touched this session

| # | Issue | Fix | Where | Shipped | Verified by you |
|---|-------|-----|-------|---------|-----------------|
| A | Bot silent after greeting | re-send `start_voice` on LiveKit reconnect | widget `voiceModeLiveKit`/`livekit.ts` | ✅ | ☐ |
| B | 1008 crash mid-call kills bot | Gemini session auto-reconnect + re-ground last ~12 turns | voice-agent `geminiSdkTransport` | ✅ | partial (saw reconnect fire) |
| C | 1008 "Operation not implemented" every ~1min | `GEMINI_CONTEXT_COMPRESSION=off` (env) | Railway voice-agent | ✅ | ☐ |
| D | Dashboard shows 0 conversations despite traffic | emit `conversationCompleted` in awaited `addShutdownCallback` | voice-agent worker | ✅ (8 recorded since 13:27) | partial |
| E | Can't interrupt / "doesn't listen while talking" | VAD `START=HIGH`, `prefixPadding 300`, `END=LOW`; wire `bridge.handleBargeIn()` on interrupt | voice-agent | ✅ | ☐ |
| F | Mute doesn't stop the bot talking | `setAgentAudioMuted` on mute | widget | ✅ | ☐ |
| G | Stuck on shop page, never reaches checkout | navigate to `/checkout` immediately on intent | agent prompts | ✅ | ☐ |
| H | Email voice-loop / per-field re-confirm | collect-then-confirm-once; email = capture-once, page is truth | agent prompts | ✅ | ☐ |
| I | Re-collects details for a returning visitor | profiler captures address+state; `buildVisitorSummary` surfaces saved details; checkout reuses+confirms | agent | ✅ | ☐ |
| J | Logged-in user re-asked for address | `checkout.state` returns logged-in+saved → bot skips collect; prompt honors it | storefront bridge + prompt | partial (bridge exists; confirm it fires) | ☐ |
| K | Catalog "missing" Peace/Dog; Bliss no card | broad ask → `products.search('mantra')` shows all 4 cards | agent prompt | ✅ (data + search + images verified healthy) | ☐ |
| L | Audience: no detail on click | `/app/audience/[visitorId]` detail page (phone/email/address/intents) | web | ✅ | ☐ |
| M | ASR mishears accent/email | lean audio (Krisp+AGC off by default), VAD onset padding; email via page typing | widget + prompt | partial — **Gemini-ASR-bound; not fully solvable** | ☐ |
| N | Conversions ledger empty | order→`/v1/conversion` POST (HMAC) | **Calmosis backend — NOT done** | ☐ (see §3) | ☐ |
| O | Old conversation links 404 | sessions pre-13:27 were never recorded; make page degrade gracefully | web | ☐ (minor, §3) | ☐ |
| P | Reload loses in-call context | in-call reconnect re-grounds; full reload-resume not built | — | deferred | — |

**Net:** A–L + K shipped; M is inherent (mitigated); N, O are the remaining buildable items; P deferred.

---

## 3. Remaining design + implementation

### 3.1 Conversion attribution (N) — make revenue verifiable
**Why:** the only metric that proves ROI (assisted/influenced revenue + the Audit ledger), and each row links to the transcript so a conversion is *verifiable* (visitor_id → matched conversation → readable transcript; "assisted" = bot recommended the bought SKU). No conversation match → not attributed (never over-claims). Forward-only.
**Pieces:**
1. **shoppingmate:** generate + set `merchants.scriptSecret` for `SM-2SCCLZ` (HMAC key). *(me)*
2. **frontend (`calmosis-fe`):** include `sm_visitor_id` (localStorage) in the order payload so the backend can attribute. *(me → Netlify)*
3. **backend (`calmosis-be` → Heroku `calmosisv2`):** on order placed (COD/paid), POST `/v1/conversion` with `X-SM-Signature = base64(hmacSHA256(body, SHOPPINGMATE_CONVERSION_SECRET))`, body `{merchantId, orderId, visitorId, totalCents, currency, lineItems[{sku,quantity,priceCents}], matchSource:'cod', occurredAt}`. Stage on a non-live branch; *you* set the Heroku env var + verify checkout still works. *(me code + you deploy/verify)*
**Guardrail:** never block/break order placement on the POST (fire-and-forget, try/catch).

### 3.2 Graceful missing-transcript (O)
`/app/conversations/[id]`: when `getConversation` returns null, render "Transcript not available (this conversation predates recording, or wasn't captured)" instead of a hard 404. *(me, web — low risk)*

### 3.3 Email accuracy (M) — accept the limit
Voice email is Gemini-ASR-bound. Decision: **don't voice-capture email** — the bot captures once, leaves it for the visitor to type on the checkout page (already the source of truth). No further code; this is a product stance to confirm.

---

## 4. One-pass verification protocol (run on a real call + dashboard)

Do this as ONE session on calmosis.com (hard-refresh first to get the latest widget). Tick each; note failures with what you heard/saw.

**Voice call — connection & conversation**
- [ ] V1 Tap call → greeting plays within a couple seconds.
- [ ] V2 **Barge-in:** talk over the greeting → bot stops and listens (doesn't finish talking).
- [ ] V3 **ASR:** say 2–3 normal sentences → the on-screen transcript matches what you said (note any garble).
- [ ] V4 **Mute:** mute mid-reply → bot's voice goes silent immediately; unmute → resumes.
- [ ] V5 **Long call:** keep talking 2–3 min → no dead silence; if it blips it recovers (no permanent death).
- [ ] V6 **Reconnect:** toggle airplane mode briefly / background the tab, return → bot still responds (re-greets is OK).

**Checkout**
- [ ] C1 "add green mantra and check me out" → lands on the **/checkout page** immediately (not stuck on shop).
- [ ] C2 Guest: bot collects details in one flow, **doesn't re-ask the email**, confirms once, fills the form on screen.
- [ ] C3 **Returning visitor** (same browser, 2nd call): bot greets by name and **offers to reuse saved details** instead of re-collecting.
- [ ] C4 **Logged-in user:** bot recognizes you're signed in and uses your **saved address** (doesn't ask for it again).
- [ ] C5 Bot proactively says it's filled / asks you to review + Place Order (without you asking "is it done?").

**Catalog**
- [ ] K1 "what do you sell / show me your products" → **all four Mantra cards** appear (Peace, Sleep, Green, Dog).
- [ ] K2 Ask about Bliss Club → its card appears with image.

**Dashboard (after the calls)**
- [ ] D1 Home → "Voice recorded today" ticks up; the call appears in Conversations.
- [ ] D2 Open the conversation → transcript loads (no 404).
- [ ] D3 Audience → your visitor listed; click → phone/email/address + intents shown.
- [ ] D4 Intents page → distribution/needs/objections reflect the calls.
- [ ] (after §3.1) D5 Audit → the order appears, click → opens its conversation.

**On pass:** tag `v0.2.0-voice-verified`. **On any fail:** file the exact step + symptom; fix against the matrix; re-run only that section.

---

## 5. Sequence
1. §3.2 graceful-404 (me, low risk, now).
2. §3.1 prep: scriptSecret + frontend visitorId (me); backend POST staged (me) + you set Heroku env.
3. You run §4 once, top to bottom.
4. Fix any ✗, re-verify, tag `v0.2.0-voice-verified`.
