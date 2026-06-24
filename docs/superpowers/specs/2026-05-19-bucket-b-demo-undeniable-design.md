# Bucket B — Demo-Undeniable Design

**Date:** 2026-05-19
**Owner:** Karan
**Bucket:** B (Demo-undeniable) per `docs/go-to-production.md`
**Status:** Approved 2026-05-19 — proceeding to implementation plan

---

## 1. Goal

Turn the existing Sage voice bot on `shoppingmate.ai` from a passive talker into an active tour guide that navigates, scrolls, highlights, clicks, and speaks exact prices — without hallucinating numbers, without breaking accessibility, and without leaking the capability onto customer sites yet.

**Done when:** a visitor on `shoppingmate.ai` accepts a soft tour prompt, Sage walks them through a 3-beat tour (features → persona switch → pricing → signup), voices the canonical Starter price verbatim, the visitor says "sign me up" and the bot clicks the real signup button — all driven by the host page's accessibility tree, all gated to the demo merchant.

## 2. Non-goals

- ❌ Host-action tools on customer sites (Bucket C)
- ❌ Click confirmation patterns (Bucket C — needed when blast radius isn't zero)
- ❌ Multi-language tour (English-first per roadmap §6)
- ❌ Mobile-specific tour layout (deferred until traffic justifies)
- ❌ A/B tour variants (forbidden in v0.1 per roadmap §6)
- ❌ Voice clone / per-brand persona ($99 upsell, parked v0.2)
- ❌ Conversion attribution for tour signups (Bucket A / Plan 7)

## 3. Architecture

```
                 ┌──────────────────────────────────┐
                 │  visitor on shoppingmate.ai      │
                 └────────────────┬─────────────────┘
                                  │ speaks / silent timer
                                  ▼
                 ┌──────────────────────────────────┐
                 │  packages/widget (Shadow DOM)    │
                 │  • soft-prompt bubble UI         │
                 │  • AXTreeReader on host DOM      │
                 │  • host-action executor          │
                 └────────────────┬─────────────────┘
                                  │ LiveKit data channel
                                  ▼
                 ┌──────────────────────────────────┐
                 │  apps/voice-agent (LiveKit room) │
                 │  ↕ Gemini 2.5 Flash Live audio   │
                 └────────────────┬─────────────────┘
                                  │ runTurn()
                                  ▼
                 ┌──────────────────────────────────┐
                 │  packages/agent  (Sonnet 4.6)    │
                 │  • demo-merchant gate            │
                 │  • new tools: site.*, pricing.*  │
                 │  • tour state machine            │
                 └──────────────────────────────────┘
```

All new code is gated by `merchantId === SHOPPINGMATE_DEMO_MERCHANT_ID` (env-configurable, defaults to `SM-XPK2EN`). Gate already exists in `packages/agent/src/runtime.ts` from the `demoMode` branch.

## 4. Components

### 4.1 `packages/agent/src/tools.ts` — new tools

Add 5 tools, all demo-gated:

| Tool | Purpose |
|------|---------|
| `site.navigate({ path })` | Same-origin nav; prefers Next.js router, falls back to `window.location.href` |
| `site.scroll_to({ intent })` | AX-tree → `scrollIntoView({ behavior: 'smooth' })` |
| `site.highlight({ intent, duration_ms })` | AX-tree → overlay pulse ring, auto-remove after duration |
| `site.click({ intent })` | AX-tree → `element.click()`. No confirmation (demo-only). |
| `pricing.quote({ plan_id })` | Server-formatted speech string + structured card + HMAC sig. Never returns raw digits in `speech`. |

### 4.2 `packages/agent/src/demo-tour.ts` — tour state machine

Exports `tour.start({ beat? })` tool + internal state machine. Three beats, each interruptible:

**Beat 1 — Features (~25s):** `site.navigate('/')` → `site.scroll_to('features section')` → 3× `site.highlight` cycles (voice, personas, install) with narration between each.

**Beat 2 — Persona switch (~20s):** `voice.persona_swap('stylist')` → say in Stella voice → `voice.persona_swap('calm-clinician')` → back to Sage.

**Beat 3 — Pricing + signup (~30s):** `site.navigate('/pricing')` → `site.scroll_to('plan grid')` → `site.highlight('starter plan card')` → `pricing.quote('starter')` → narrate verbatim → on visitor confirm → `site.click('signup button')`.

**Interruption handling:** visitor speech pauses the tour at the current beat's action boundary. After Sage answers, she offers: resume / skip ahead / end.

### 4.3 `packages/agent/src/pricing/speech.ts` — server-side number formatter

```ts
function formatPlanSpeech(plan: Plan): string
```

Uses internal `numberToWords` table (0-9999, ~40 lines) — covers all 4 plan prices (30, 99, 299, 799) and all 4 conv counts (100, 500, 2000, 10000). Output template:

> `"{PlanName} is {priceWords} dollars per month for {convWords} conversations."`

Source of truth for plan data: load from `merchants.config.pricing` at boot (NOT inline constants) so prod prices update without redeploy.

### 4.4 `packages/agent/src/postprocess.ts` — `stripPrices` bypass

Extend signature:
```ts
stripPrices(text: string, allowedSpeechTokens?: Set<string>): { text, hits }
```

Bypass logic: if a span of `text` is an exact substring match of any allowed token, that span is excluded from scrubbing. Free-form LLM rephrases still get stripped because they don't match the canonical string.

Runtime populates `session.allowedSpeechTokens` when `pricing.quote` returns; tokens are cleared at session end.

### 4.5 `apps/voice-agent/src/geminiSession.ts` — mirror bypass

Current behavior: `speak(text)` rejects any string containing digit/currency patterns. Extend to accept a per-session allowed-tokens set and mirror the same exact-match bypass.

### 4.6 `packages/widget/src/host/ax-tree.ts` — accessibility tree reader

```ts
export function resolveIntent(intent: string): HTMLElement | null
```

Algorithm:
1. Walk host `document` DOM (widget runs in host JS context — same `document`).
2. Compute accessible name per [W3C AccName 1.2](https://www.w3.org/TR/accname-1.2/): `aria-labelledby` → `aria-label` → associated `<label>` → `alt`/`title` → text content.
3. Build candidate list: `{ element, role, accessibleName, visible }`.
4. Score each candidate against intent via 3-signal blend:
   - **Role match** — intent contains "button"/"link"/"section"/"card" → bonus on matching role.
   - **Name token overlap** — Jaccard similarity between intent tokens (lowercased, stopword-filtered) and accessible-name tokens.
   - **Position bias** — nav intents score nav region higher; "card" intents score `[role=group]` + `<article>` higher.
5. Return highest-scoring visible candidate, or `null` if best score < 0.4.

No external libraries. Implemented in plain TS within the existing widget bundle (must stay under 120 KB gzip budget).

### 4.7 `packages/widget/src/host/actions.ts` — action executor

```ts
export async function executeHostAction(action: HostAction): Promise<HostActionResult>
```

Handles four action types. Failure modes:
- AX-tree miss → `{ ok: false, reason: 'not_found' }`
- Element resolved but stale at fire time → `{ ok: false, reason: 'stale_target' }`
- Navigate to 404 path → `{ ok: false, reason: 'route_not_found' }`

### 4.8 `packages/widget/src/ui/soft-prompt.ts` — first-load tour offer

After 5s of silence on initial widget mount, render a small bubble: "Want a quick tour?" with accept/dismiss. Accept → emits a control event `tour_request` over the data channel → agent starts beat 1. Dismiss → bubble hides; never re-shown that session.

Reactive-only mode: if dismissed or ignored 30s past mount, no further prompts. Visitor can still tap the call pill or speak to engage.

### 4.9 `web/src/components/**` — ARIA labels on marketing site

Add `aria-label` + `data-tour-stop` markers to existing sections:
- `<section aria-label="Features" data-tour-stop="features">`
- `<section aria-label="Personas" data-tour-stop="personas">`
- `<section aria-label="Plan grid" data-tour-stop="pricing">`
- `<button aria-label="Sign up" data-tour-stop="signup">`
- Individual feature cards: `aria-label="Voice card"`, `"Personas card"`, `"Install card"`
- Plan cards: `aria-label="Starter plan card"`, etc.

No visual changes. Pure markup pass — also improves accessibility score and AI crawler comprehension as a side benefit.

## 5. Data flow — example: visitor says "show me pricing"

```
1. Gemini Live STT  → "show me pricing"
2. voice-agent  → runTurn(merchant=SM-XPK2EN, message="show me pricing")
3. agent (Sonnet) decides:
     site.navigate({ path: '/pricing' })
     site.scroll_to({ intent: 'plan grid' })
     site.highlight({ intent: 'starter plan card' })
     pricing.quote({ plan_id: 'starter' })
4. runtime dispatches each tool:
   - site.* → emits `host_action` data-channel event to widget
   - widget executes, returns `host_action_result`
   - pricing.quote → server formats speech, signs, returns { speech, card, sig }
   - runtime adds speech to session.allowedSpeechTokens
5. agent next turn picks the speech verbatim into `say`:
     "Starter is thirty dollars per month for one hundred conversations."
6. stripPrices(text, allowedTokens) → matches allowed token → passes through
7. geminiSession.speak(text, allowedTokens) → matches → passes through
8. Visitor hears the canonical, server-formatted number.
```

## 6. Failure handling matrix

| Failure | Behavior |
|---------|----------|
| AX-tree returns no match for intent | Agent receives `not_found`, retries with broader intent or apologizes ("I can't find that — want me to read it instead?") |
| Element stale at action fire (DOM mutated) | Agent re-resolves, retries once |
| Same-origin nav to nonexistent route | Agent acknowledges, offers alternative |
| Persona swap mid-tour stalls (Gemini Live config delay) | Tour pauses 1-2s, Sage resumes; documented expected behavior |
| LLM rephrases `pricing.quote.speech` ("Starter costs $30") | `stripPrices` strips → "Starter costs the price on the card" — degraded but not wrong. Logged via `pricing.quote.rephrased_blocked` metric |
| Plan price changes in DB but tour data stale | Pricing source is `merchants.config.pricing` loaded at boot — next deploy picks up. Acceptable lag. |
| Visitor opts out of tour, no further prompts in session | Soft prompt hidden; reactive-only mode |
| Tour completes, visitor wants to redo it | Visitor can say "show me again" → agent calls `tour.start({ beat: 1 })` |

## 7. Testing

**Unit (~30 tests):**
- `packages/agent/src/pricing/speech.test.ts`
- `packages/agent/src/postprocess.test.ts` (extended bypass cases)
- `packages/agent/src/tools.test.ts` (extended for new tools)
- `packages/agent/src/demo-tour.test.ts`
- `packages/widget/src/host/ax-tree.test.ts`
- `packages/widget/src/host/actions.test.ts`

**Integration (~10 tests):**
- `packages/agent/src/demo-tour.integration.test.ts` — full 3-beat tour against recorded LLM fixture + fake host page (happy-dom)

**Manual smoke:**
- `docs/runbooks/2026-05-19-bucket-b-acceptance.md` — 8-step checklist; covered in §9 of this spec

## 8. Rollout

Six phases, ~4 days total engineering, each safely shippable:

| Phase | What | Effort | Risk |
|-------|------|--------|------|
| B.1 | ARIA labels added to marketing site (pure markup) | ~2h | None |
| B.2 | Widget host modules (`ax-tree.ts`, `actions.ts`) — not yet wired | ~1d | Bundle-size only |
| B.3 | Agent tools + demo gate + stripPrices bypass + gemini bypass | ~1d | Bypass logic correctness |
| B.4 | Tour state machine + soft prompt UI | ~1d | Interruption edge cases |
| B.5 | Wire end-to-end on Vercel preview + run smoke | ~½d | Real-world AX-tree resolution |
| B.6 | Production deploy behind `SHOPPINGMATE_DEMO_TOUR_ENABLED` flag, 48h monitoring | ~½d | Live LLM behavior tuning |

**Metrics tracked from B.6 onward:**
- `demo.tour_offered` — soft prompt shown
- `demo.tour_accepted` — visitor clicked accept
- `demo.tour_completed` — reached beat 3 end
- `demo.tour_interrupted` — visitor spoke mid-tour
- `demo.tour_signup_clicked` — visitor reached `site.click('signup button')`
- `pricing.quote.called` — tool invoked
- `pricing.quote.rephrased_blocked` — LLM tried to rephrase, stripPrices saved us

## 9. Acceptance — 8-step manual smoke

| # | Action | Expected |
|---|--------|----------|
| 1 | Load `shoppingmate.ai`, wait 5s | Soft prompt bubble appears |
| 2 | Click "Yes, show me" | Beat 1 runs: scroll to features, 3 highlights with narration |
| 3 | Interrupt during beat 1 ("wait, how does install work?") | Tour pauses; Sage answers; asks "want me to continue?" |
| 4 | Say "continue" | Beat 2: voice swap to Stella, back to Sage |
| 5 | Tour completes beat 3 | At /pricing, Starter card highlighted, Sage voices exact price |
| 6 | Inspect transcript log | Voiced price exactly matches `formatPlanSpeech('starter')` — no rephrase, no hallucination |
| 7 | Say "sign me up" | `site.click('signup button')` fires; signup modal opens |
| 8 | Reload page, ignore prompt for 30s | No re-prompt; reactive-only mode active |

**Bucket B is complete when:** all 30+ unit tests pass, all 10 integration tests pass, all 8 manual smoke steps pass against production, and 24h metrics show `tour_offered → accepted` ≥ 30% AND `pricing.quote.rephrased_blocked` ≤ 5%. Then cut `git tag bucket-b-demo-undeniable-complete`.

## 10. Generalization path to Bucket C

The same 7 modules (5 tools + ax-tree + actions) are the foundation for Bucket C. To unlock for customer sites later, three additions are required (Bucket C scope):

1. **Click safety layer** — visual + delay confirmation pattern, or verbal confirm, configurable per-merchant.
2. **`pricing.quote` backed by live merchant catalog** — Shopify/Woo API or OpenKarta `/v0/quote` instead of `merchants.config.pricing`.
3. **AX-tree fallback** — Stagehand-style runtime grounding when merchant site has weak ARIA markup.

~80% of Bucket B code is reused in Bucket C. The demo merchant proves the architecture; Bucket C generalizes it with safety rails.

---

**Approved 2026-05-19. Proceeding to implementation plan via writing-plans skill.**
