# Calmosis Brand Dashboard — "Genuine Paid Product" Design

**Date:** 2026-06-15
**Status:** Approved design, pending implementation plan
**Owner:** Karan (karan@calmosis.com)

## Goal

The Calmosis team logs into the existing `/app` dashboard as a merchant and sees:

1. **Real live metrics** — non-zero numbers driven by the live Calmosis bot.
2. **A conversion / order ledger** — every bot-influenced or bot-placed order with attribution.
3. **Full conversation transcripts** — verbatim turn-by-turn record of every visitor conversation, with the bot's actions (recommendations, cart adds, checkout nav, order) interleaved.
4. **A funnel view** — landing → cart → checkout → purchase, framed as the uplift the bot drives (add-to-cart and direct-to-checkout).
5. **A near-real-time live view** — "happening now": active conversations and conversions ticking up today.

And: **every existing Phase 2 dashboard feature is verified working with real evidence.**

## Approach

**Extend the shared `/app` dashboard in place** (chosen over a Calmosis-only throwaway page or a full event-sourced rebuild). Calmosis logs in as a merchant; every new feature benefits all future brands. We borrow one idea from event-sourcing: the new `conversation_turns` table is append-only, so it doubles as the foundation of an audit log later without committing to a full rebuild now.

White-label theming, PDF export, and SSE are explicitly **out of scope** this round (YAGNI). Live view uses ~10s polling.

## Current-state findings (verified 2026-06-15)

- **Dashboard exists**: `web/src/app/app/` has Home, Conversations, Revenue, Knowledge, Diagnostics, Billing, Settings, Site-graph. KPIs computed in `web/src/lib/kpi-repo.ts` from `metricEvents` + `conversionEvents`.
- **Event tables exist**: `metricEvents`, `conversionEvents`, `recommendationEvents`, `conversationSessions`, `visitorEvents`.
- **Voice agent emits**: `conversationSessions`, `recommendationEvents`, some `metricEvents` (`apps/voice-agent/src/agentWorker.ts`).
- **GAP 1 — no transcripts**: `conversationSessions` stores only `id/merchant/visitor/startedAt/endedAt`. No verbatim message/turn storage anywhere.
- **GAP 2 — no COD conversions**: `conversionEvents.matchSource` only supports `'shopify_webhook' | 'gtag'` (`apps/api/src/routes/conversion.ts`, `apps/api/src/services/attributeOrder.ts`). Calmosis's COD/cart.add flow never writes a conversion.
- **GAP 3 — no funnel capture**: `cart_add`, `open_cart`, `site.navigate('/checkout')`, `checkout.url` flow through the API WS handler (`apps/api/src/index.ts`) and the agent tool loop (`packages/agent/src/tools.ts`) but are not recorded as funnel metrics.
- **Host actions available** (`packages/agent/src/host-actions.ts`): `navigate`, `cart_add`, `open_cart`, `cart_set_qty`, `apply_coupon`, plus `checkout.url` tool.

## Components

### Component 1 — Verification baseline (do first)

Establish that Phase 2 works before extending it.

- Run `cd web && pnpm vitest run` (expect 71/71 green; record actual).
- Live smoke each `/app` page + the auth → magic-link → session → billing flow against prod (per the 2026-05-04 acceptance runbook).
- Confirm a **Calmosis merchant record + owner login** exists (`merchants` + `merchant_owners`). If the owner mapping is missing, create it so the team can sign in. Reconcile tenant id (memory cites `SM-XPK2EN`; check scripts default to `SM-2SCCLZ` — determine the live Calmosis id of record).
- **Deliverable:** a short verification report with real command output and per-page status.

### Component 2 — Conversation capture / transcripts (backend, net-new)

**Refined during planning (DRY):** the dashboard already has a fully-built Conversations list page, drill-down detail, and a transcript reader (`web/src/lib/conversations-repo.ts` `getConversation` reads `tags.transcript`). But **nothing emits the `conversationCompleted` metric event** those readers depend on — so the Conversations page, the "Conversations" KPI, and transcripts are all silently empty today. Rather than add a new `conversation_turns` table + new transcripts page, we **emit the missing `conversationCompleted` event** at session end with the tags the existing reader expects. This lights up transcripts AND fixes the empty Conversations page/KPI in one move.

**Emission tags** on `conversationCompleted` (read by `conversations-repo`):
`session_id`, `mode` (`voice`|`text`), `duration_sec`, `turns`, `outcome` (`purchased`|`abandoned`), `attributed_cents`, `transcript` (array of `{role, content, timestamp}`).

**Shared helper:** `packages/agent/src/conversationRecorder.ts` — `createConversationRecorder()` with `addTurn(role, content)`, `markCartAdd()`, `markCheckoutReached()`, `markPurchased(cents)`, and `finish({mode}) => tags`. Unit-tested in isolation.

**Emission sites:**
- Voice agent (`apps/voice-agent/src/agentWorker.ts`): accumulate visitor turns from `final_transcript`, bot turns from `bot_text`; on `RoomEvent.Disconnected`, emit `conversationCompleted`.
- Text chat (`apps/api/src/index.ts`): accumulate visitor `user_text` + streamed bot `say` text per turn; on `session_end`, emit `conversationCompleted`.

Capture is best-effort and must never block or fail the conversation (wrap in try/catch, log on failure).

### Component 3 — Bot funnel + conversion capture (backend, net-new)

**Funnel metrics** — emit `metricEvents` at the API WS choke point (`apps/api/src/index.ts`, where `host_action_result` and tool results are visible):
- `cart.add` — on a successful `cart_add` host action (tags: `sku`, `qty`).
- `checkout.reached` — on `site.navigate` to a `/checkout` path **or** a `checkout.url` tool call (tags: `source: 'navigate' | 'checkout_url'`).
- (`conversationCompleted` / `voiceConversation` already emitted — reused for the funnel's first stage alongside `conversation_sessions` counts.)

**COD conversion** — extend `conversionEvents.matchSource` union to include `'cod'`. When the bot completes a COD order (order host-action / order-confirmation signal in the Calmosis stitch), write a `conversionEvents` row: `attributionKind: 'assisted'`, `matchSource: 'cod'`, `lineItems` + `totalCents` from the cart, `sessionId` set. Existing Shopify/gtag paths untouched. Idempotent on the existing `(merchant, order, kind)` unique index.

### Component 4 — Audit page (`/app/audit`, frontend)

Two tabs sharing a date-range filter:

- **Conversions ledger** — table of `conversionEvents`: date, order id, attribution kind, amount, source (COD/Shopify/gtag), line items (expandable), link to the originating session. CSV export of the filtered rows.
- **Transcripts** — list of `conversation_sessions` (visitor, started, duration, #turns, outcome) → drill-down to the full turn-by-turn transcript from `conversation_turns`, with recommendations / cart-adds / checkout-nav / order interleaved inline.

New repo `web/src/lib/audit-repo.ts` (ledger query + transcript query) following existing repo patterns. Reuse `ConversationsTable`-style components.

### Component 5 — Funnel surface (frontend)

A funnel widget (on Home and/or the Audit page) computed from `metricEvents` + `conversionEvents` over the selected window:

`Conversations → Cart adds → Checkout reached → Purchases`

with absolute counts and step-to-step conversion rates, labeled as bot-driven. New function in `kpi-repo.ts` (or a `funnel-repo.ts`) aggregating the metric names above.

### Component 6 — Live view (frontend)

Auto-refreshing panel (client component polling a `/api/live` route every ~10s):
- Active conversations now (sessions with `endedAt IS NULL`).
- Conversions today (count + amount, ticking up).
- Latest N events (recent turns / cart adds / orders).

Polling first; SSE deferred.

## Data flow

```
Visitor ⇄ Widget ⇄ API WS (apps/api/src/index.ts) ⇄ agent runTurn / tools
   │                        │
   │                        ├─ conversation_sessions  (start/end)
   │                        ├─ conversation_turns     (NEW: every turn)
   │                        ├─ recommendation_events  (existing)
   │                        ├─ metric_events          (+ NEW cart.add, checkout.reached)
   │                        └─ conversion_events       (+ NEW match_source='cod')
   │
   └─ Voice path: agentWorker.ts emits the same session/turn/metric rows.

Dashboard (/app): server components read via repos →
   kpi-repo (KPIs + funnel) · conversations-repo · audit-repo (ledger + transcripts)
   /api/live (polled) → live panel
```

## Error handling

- All new emission is best-effort: wrapped in try/catch, never blocks or fails a conversation or host action. Failures logged, not surfaced to the visitor.
- COD conversion write is idempotent on `(merchant, order, kind)`; duplicate order signals are no-ops.
- Dashboard reads tolerate empty data (zero-state UI) so pages render before data accrues.
- `/api/live` is gated by the existing dashboard session; returns merchant-scoped data only.

## Testing

- **Unit/route (vitest, `// @vitest-environment node` pattern):**
  - `audit-repo`: ledger query + transcript query shape.
  - funnel aggregation in `kpi-repo`/`funnel-repo`.
  - COD conversion writer: writes row, idempotent on duplicate.
  - transcript emission helper: best-effort, swallows errors.
- **Live smoke (prove real data):** drive a real Calmosis bot conversation (recommend → cart.add → checkout nav → COD order), then confirm `conversation_turns`, `cart.add`/`checkout.reached` metrics, and a `match_source='cod'` conversion all land, and that `/app/audit` + funnel + live panel render them. Capture logs (per "prove with logs" preference).
- **Existing suite:** keep `web` vitest green (71/71 + new tests).

## Out of scope (YAGNI this round)

- White-label theming / per-brand branding (chose reuse-and-log-in).
- PDF export (CSV only).
- Full event-sourced `audit_log` rebuild.
- SSE / WebSocket push for live view (polling instead).
- Auto-recharge "3 per period" enforcement (tracked separately in Phase 2.5).
