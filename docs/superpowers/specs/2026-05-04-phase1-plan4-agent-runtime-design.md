# Phase 1 — Plan 4: Backend Agent Runtime (Sonnet 4.6 tool-use loop)

**Status:** Design
**Date:** 2026-05-04
**Parent spec:** [`2026-04-30-shoppingmate-phase1-design.md`](./2026-04-30-shoppingmate-phase1-design.md)
**Prior plans:** 3a (catalog/selectors/smoke), 3b (Adapter interface + Shopify/Woo), 3c (Magento/BC/Wix/SQ), 3d (DOMAdapter + WS transport + selector resolver), 3e (SuggestAdapter + dispatcher exhaustiveness)
**Successor plans:** 5 (voice-first widget shell), 6 (LiveKit + Gemini Live audio), 7 (conversion attribution)

---

## 1. Goal

Build the **conversational agent runtime** that turns the existing 8-adapter substrate into a working sales agent. After Plan 4, the system can hold a multi-turn shopping conversation — taking either text or transcribed voice input — make tool calls into the appropriate adapter, return product cards with images for the widget to render, and emit speech-ready response text. This is the engine; Plans 5–6 build the surfaces (text widget, voice stack) that consume it.

Plan 4 delivers:

1. **A new `apps/api/src/agent/` module** containing the Sonnet 4.6 tool-use loop, tool registry, post-processors, and per-session runtime state.
2. **A widget event protocol** over the existing JWT-gated WS — heterogeneous stream of `say` / `cards` / `tool_result` / `checkout_redirect` / lifecycle events.
3. **Six tools mapped 1:1 to the existing `Adapter` contract** so Sonnet can drive `getAdapter(merchant).{searchProducts|getProduct|cartAdd|cartUpdate|cartGet|couponApply|checkoutUrl}`.
4. **Per-conversation hard caps** (15 turns / 3 min voice / 25 min duration) wired into the runtime — these are the margin guarantees from roadmap §4 Phase 3 and **must** be enforceable at runtime, not in billing.
5. **The no-numeric-prices invariant** (roadmap §4 Phase 1) enforced as a `say`-text post-processor — agent never voices ₹/$/numeric prices; cards render the DB-trusted price visually.
6. **Redis-backed session state** with 24h TTL matching the privacy posture in §2.6.

After Plan 4, you can drive a full shopping conversation against a real merchant via a thin WS test client. The widget UI in Plan 5 then becomes the consumer-grade surface; Plan 6 swaps the widget's STT/TTS for LiveKit + Gemini Live native audio.

## 2. Decomposition (parent context)

| Plan | Scope | Status |
|---|---|---|
| 1 | Foundation (workspace, db, jobs, api, worker) | done |
| 2 | Provisioning (CLI + `/v1/install` + onboarding pipeline) | done |
| 3a–3e | Onboarding completion + 8 adapters | done |
| **4** | **Backend agent runtime (Sonnet tool-use loop)** | **this spec** |
| 5 | Voice-first widget shell (gtag.js bundle, simulated audio) | pending |
| 6 | Voice stack (LiveKit Cloud + Gemini 2.5 Flash Live) | pending |
| 7 | Conversion attribution | pending |

## 3. Non-goals (explicit for Plan 4)

- **No real audio I/O.** Plan 4 takes `user_text` from the widget. Plan 5 layers browser STT/TTS on top; Plan 6 replaces it with LiveKit + Gemini Live. The runtime sees text only — voice metadata (e.g., `voiceMs` accrual) is signalled by the widget in the message envelope.
- **No Brand Knowledge Base injection.** That's Phase 2 (roadmap §4). Leave a clean hook in the system-prompt builder so Phase 2 can plug a chunk-injector in without touching the runtime.
- **No coupon discovery or `coupons.suggest`.** Phase 1 P1 verb is `couponApply` only (roadmap §4 Phase 1). The runtime does not surface `list`/`suggest` tools to Sonnet.
- **No streaming partial `say` chunks.** Sonnet returns a complete turn's text, runtime emits one `say` event per text segment. Mid-response streaming is a Plan 6 latency optimization, deferred to keep Plan 4 simple.
- **No persistent visitor profiles.** Sessions are anonymous; cartToken survives reconnects within the 24h TTL window only. Cross-session identity is parked indefinitely (roadmap §6 guardrails).
- **No multi-language.** English only; Hindi parked for v0.2 (roadmap §6).
- **No A/B testing of personas or system prompts** (roadmap §6).
- **No direct LLM call from the browser** — all Sonnet traffic flows through `apps/api` (roadmap §6).

## 4. Architecture

```
Widget (Plan 5/6)
   │  WS message: { type: "user_text", text, sessionId, mode: "voice"|"text" }
   ▼
apps/api WS handler (existing, Plan 3d)
   │
   ▼
apps/api/src/agent/runtime.ts ── runTurn(session, userMessage)
   │
   ├──► 1. cap check (15-turn / 3-min-voice / 25-min hard caps)
   │       fail → emit closing say + checkout_redirect, end session
   │
   ├──► 2. load session.history from Redis, append user message
   │
   ├──► 3. Sonnet 4.6 turn (via packages/shared/openrouter.ts)
   │       tools = buildToolSurface(merchant)
   │       loop until model returns text-only stop:
   │         - if tool_use: dispatch to getAdapter(merchant).<verb>
   │             retry up to 3x on transient error
   │             feed result back as tool_result content block
   │         - if text: continue loop or break
   │
   ├──► 4. post-process say text
   │       - strip numeric prices (₹, $, "Rs", "$1,499", etc.)
   │       - moderation sample (OpenAI Moderation API, 1-in-N rate per roadmap §3)
   │       - segment into one or more say events
   │
   ├──► 5. emit event stream over WS to widget
   │       say → cards (if cartAdd/searchProducts result) → tool_result → end_of_turn
   │
   └──► 6. persist updated history + cartToken + counters back to Redis
```

**Key design point:** the runtime is a **pure function over `(merchant, session, userMessage)`** producing an event stream. It does not hold WS connections itself; the existing WS handler (`apps/api/src/ws/`) drives it and forwards events. This keeps the runtime testable in isolation and reusable later (e.g., a Slack-channel adapter, an internal CLI for staff).

## 5. Module layout (new code in `apps/api/src/agent/`)

```
apps/api/src/agent/
  runtime.ts            # runTurn(session, userMessage) → AsyncIterable<AgentEvent>
  tools.ts              # buildToolSurface(merchant) → Anthropic.Tool[]
                        # dispatchTool(merchant, name, args, deps) → ToolResult
  events.ts             # AgentEvent discriminated union, WS envelope encoders
  state.ts              # Redis session repo: load/save/extend TTL
  caps.ts               # checkCaps(session, mode) → ok | { reason, gracefulMessage }
  postprocess.ts        # stripPrices(text), segmentSay(text)
  prompts/
    system.ts           # buildSystemPrompt(merchant) — persona, brand voice, no-prices invariant
    persona-table.ts    # 8 personas (Sage, Lumi, etc.) — Plan 5 will theme widget; Plan 4 wires the prompt
  tests/
    runtime.test.ts
    tools.test.ts
    caps.test.ts
    postprocess.test.ts
    state.test.ts
```

Sonnet client: extend `packages/shared/openrouter.ts` (used by Plans 3a/3d for selector extract + heal) with a `chatTools()` method returning the Anthropic tool-use response shape. **Do not introduce a parallel Anthropic SDK** — single OpenRouter caller keeps observability and cost-ledger plumbing in one place.

## 6. Tool surface (the contract Sonnet sees)

Six tools, all 1:1 mappings to the existing `Adapter` contract from `packages/adapters/src/types.ts`. Tool names are dot-namespaced for Sonnet readability:

| Tool name | Adapter method | Purpose |
|---|---|---|
| `products.search` | `searchProducts(query, limit)` | "what's hot", "do you have X", "show me dresses under ₹2K" |
| `products.get` | `getProduct(productId)` | variant disambiguation, detail Q&A |
| `cart.add` | `cartAdd(sku, variantId, qty)` | primary action |
| `cart.update` | `cartUpdate(lineId, qty)` | "change to size M", "remove the second one" |
| `cart.get` | `cartGet()` | "what's in my cart" |
| `coupons.apply` | `couponApply(code)` | apply a code visitor mentions or agent knows |
| `checkout.url` | `checkoutUrl()` | "I'm ready to pay" → emit `checkout_redirect` |

**Tool result envelope.** Every tool returns to Sonnet as JSON:

```ts
{ ok: true, value: <adapter return> }       // success
{ ok: false, kind: "unsupported", reason }  // adapter signalled it can't
{ ok: false, kind: "platform_error", status, body }   // upstream failure
{ ok: false, kind: "not_found", query }     // empty result
```

Sonnet decides recovery from the error JSON — no special-case handler in the runtime. **Hard cap: 3 retries per tool per turn** to prevent loops; on the 4th invocation of the same tool with the same args, runtime injects a synthetic `{ ok: false, kind: "retry_exhausted" }` result so Sonnet stops trying.

**`products.search` and `products.get` results carry the card payload** — `{ image, title, price_cents, variantId, productUrl, badges? }`. The runtime's tool-call inspector watches for these and emits a `cards` event to the widget alongside Sonnet's natural-language response. (Sonnet doesn't need to decide whether to "show cards" — it just tries to be helpful, and the runtime decides product results map to visible cards.)

## 7. Widget event protocol

### 7.1 Widget → Runtime

```ts
type WidgetMessage =
  | { type: "user_text"; sessionId: string; text: string; mode: "voice" | "text" }
  | { type: "card_tap"; sessionId: string; action: "cartAdd"; variantId: string; sku: string; qty: number }
  | { type: "session_resume"; sessionId: string }      // reconnect mid-conversation
  | { type: "session_end"; sessionId: string }         // user closed widget
```

`mode` tells the runtime whether to accrue `voiceMs` against the cap (Plan 6 will set `mode: "voice"`; Plan 5's simulated audio sets `mode: "text"` initially). `card_tap` is dispatched as if Sonnet had emitted the equivalent `cart.add` tool call — the agent stays in the loop and acknowledges aloud ("Added — anything else?").

### 7.2 Runtime → Widget event stream

```ts
type AgentEvent =
  | { type: "thinking" }
  | { type: "say"; text: string }                     // post-processed, no numeric prices
  | { type: "cards"; items: CardItem[] }              // inline in transcript
  | { type: "tool_result"; toolName: string; ok: boolean; summary?: string }   // observability hint
  | { type: "checkout_redirect"; url: string }
  | { type: "cap_warning"; reason: "turns" | "voice_ms" | "duration_ms"; remaining: number }
  | { type: "end_of_turn" }
  | { type: "session_closed"; reason: "user" | "cap" | "error" }

type CardItem = {
  image: string         // CDN-hosted product image URL
  title: string
  priceFormatted: string  // "₹1,499" — DB-trusted, not LLM-generated
  variantId: string
  sku: string
  productUrl: string
  badges?: string[]     // "fragrance-free", "new", "low stock" — Phase 2 fills these
}
```

Card images for Phase 1 come from `products.image_url` synced during Plan 3a's `catalogSync` step. If a card has no image (rare, edge case in catalog gaps), widget falls back to a placeholder; runtime does not block emit.

## 8. Session state (Redis)

```ts
// Key: session:{sessionId}
type SessionState = {
  sessionId: string
  merchantId: string
  cartToken: string | null            // platform-specific cart handle (Shopify cart ID, Woo cart hash, etc.)
  history: AnthropicMessage[]         // full Sonnet message history, truncated by token budget
  turnCount: number                   // increments per user-initiated turn
  voiceMs: number                     // accrues only when widget signals mode: "voice"
  totalMs: number                     // wall-clock from session start
  startedAt: number                   // epoch ms
  lastTurnAt: number                  // for stale-session GC
  mode: "voice" | "text"              // last-known input mode (for reconnects)
}
```

**TTL = 24h** matching the transcript-expiry promise (roadmap §2.6). On every turn the runtime extends the TTL via Redis `EXPIRE`. After 24h of inactivity the session is gone — visitor reconnect starts fresh.

**History truncation.** Token-budget-driven, not turn-count-driven: keep the last N messages where the cumulative token count fits in 8K (leaves 192K headroom for tool definitions and current turn). Older history is dropped silently. This keeps the cap predictable and the cost bounded.

**No PII in transcripts.** A redactor runs over user text before persisting to history: email regex, phone regex, 16-digit number regex (card numbers) → `[redacted]`. Card data should never reach the widget anyway (the agent never asks for it — visitor pays at the merchant's native checkout per roadmap §2), but defense in depth.

## 9. System prompt structure

```
You are {persona.name}, an AI shopping assistant for {merchant.brand_name}.

PERSONA
{persona.voice_descriptor}    // e.g. "Calm, clinical tone. Short sentences. Empathetic but never gushing."

INVENTORY ACCESS
You have tools to search products, see details, manage the visitor's cart, apply coupons, and send them to checkout.
Use products.search whenever the visitor asks for something — never guess at the catalog.

SPEAKING RULES
- NEVER say a numeric price. Say "in your budget", "the higher-end pick", "the value option", or "see the price on the card I just sent". The card next to your message shows the exact price.
- NEVER make up SKUs, variant IDs, or coupon codes. Use the tool results.
- If a tool fails, apologize briefly and offer an alternative path.

GUARDRAILS
- {age_gate_block}     // Phase 1 supports age-gate, Rx, financial — only insert if merchant.guardrails has them
- No medical, legal, or financial advice.
- No discussion of competitors or competitor pricing.

BRAND CONTEXT
{merchant.brand_blurb}    // hardcoded short blurb in Phase 1; Plan 2 dashboard will let merchants edit. Brand KB injection is Phase 2.
```

**Why no Brand KB hook now:** roadmap §4 Phase 2 owns the upload + chunk + retrieve flow. Plan 4 leaves the system-prompt builder structured so a Phase 2 task can drop in a `{brand_kb_chunk}` slot without rewriting the runtime. Concretely: `buildSystemPrompt(merchant)` reads from `merchant.brand_blurb` only in Phase 1; Phase 2 will read from a future `brand_kb_index_id` and concat retrieved chunks before the GUARDRAILS section.

## 10. Caps & invariants enforced at runtime

### 10.1 Per-conversation hard caps (roadmap §4 Phase 3 — margin guarantee)

| Cap | Limit | Action when hit |
|---|---|---|
| Turns | 15 user-initiated turns | Emit `say`: "We've covered a lot — should I send you to checkout?" then `checkout_redirect` if cart non-empty, else `session_closed` |
| Voice ms | 180_000 (3 min) | Same graceful close as turns cap |
| Total ms | 1_500_000 (25 min wall clock) | Same graceful close |

`cap_warning` events fire at 80% of each cap so the widget can show subtle UI hints. Caps are **non-negotiable and not configurable per-merchant** in Phase 1 (roadmap §6 guardrails).

### 10.2 No-numeric-prices invariant (roadmap §4 Phase 1)

A `stripPrices(text: string)` post-processor runs on every Sonnet response before emit. Patterns:

- `₹\d[\d,]*(\.\d+)?`
- `\$\d[\d,]*(\.\d+)?`
- `Rs\.?\s*\d[\d,]*`
- `\d[\d,]*\s*(rupees|dollars|INR|USD)`
- standalone numbers when context suggests price (heuristic: number adjacent to product noun) — flag for review, don't strip

When a price-like substring is found, replace with `"the price on the card"` or just elide. **Test invariant:** transcript review on every fixture conversation in CI must show zero numeric prices in `say` events.

### 10.3 Bot / no-reply session detection

Sessions with `turnCount === 0` after 30s, or `voiceMs === 0` after 60s in voice mode, are marked `bot_or_idle` and excluded from cap enforcement / billing meter (per roadmap §4 Phase 3 — "no-reply sessions and bot traffic don't count"). Detection runs on `session_end` or 24h TTL expiry, whichever first.

## 11. Error handling

### 11.1 Tool errors

Every adapter error shape (`unsupported`, `platform_error`, `not_found`) is JSON-encoded and fed back to Sonnet as a `tool_result` content block. Sonnet has been instructed in the system prompt to apologize briefly and offer alternatives. **Runtime does not special-case any error type** beyond the 3-retry cap.

### 11.2 Sonnet API errors

| Failure | Handling |
|---|---|
| Timeout (>30s for text turn, >5s for voice turn — voice latency budget) | Emit `say: "hold on a sec"`, retry once with same history, on second timeout emit apology + `end_of_turn` |
| 429 rate limit | Same as timeout but with exponential backoff |
| 5xx / network | Same as timeout |
| 4xx other | Log, emit apology `say`, `end_of_turn` (do not retry — usually a malformed tool definition) |

### 11.3 Widget transport drops

Session state lives in Redis, not in the WS handler. On widget reconnect with `session_resume`, the runtime loads the session by id, replays the last `cards` and `say` events from history (so the visitor sees the conversation context), then accepts new `user_text` against the same history. This preserves the cart and the conversation across flaky mobile networks.

## 12. Observability

New metric registry entries (matches the `metric_names` convention from Plan 3a):

```
agentTurnStarted          { merchantId, sessionId, mode }
agentTurnCompleted        { merchantId, sessionId, mode, durationMs, toolCalls, sayChunks }
agentToolInvoked          { merchantId, sessionId, toolName, ok, latencyMs }
agentToolRetryExhausted   { merchantId, sessionId, toolName }
agentSayPriceStripped     { merchantId, sessionId, pattern }   // alert if > 0.5% of turns
agentCapHit               { merchantId, sessionId, cap }
agentSessionClosed        { merchantId, sessionId, reason }
agentSonnetError          { merchantId, sessionId, errorType, retryCount }
```

`agentSayPriceStripped` is a quality canary — if the post-processor is firing on >0.5% of turns, the system prompt isn't holding the line and we revisit the prompt before relying on the post-processor as a safety net.

## 13. Testing strategy

### 13.1 Unit (no LLM, no network)

- `tools.test.ts` — buildToolSurface produces correct schema for each adapter type, dispatchTool routes to the right adapter method, error envelope encoding round-trips.
- `caps.test.ts` — 15-turn cap fires on turn 15 not 14, voice-ms accrues only in voice mode, graceful close emits expected event sequence.
- `postprocess.test.ts` — stripPrices catches all 4 currency patterns, leaves non-price numbers alone ("size 10", "12 reviews").
- `state.test.ts` — Redis save/load round-trip, history truncation respects token budget, TTL extends on save, redactor strips email/phone/card.

### 13.2 Integration (MSW-mocked OpenRouter + real adapter dispatch)

Drive `runTurn` against:
- Shopify adapter (with msw-mocked storefront API) — happy path search → cart → checkout
- DOM adapter (with the existing dom-harness fake-gtag) — same conversation
- Suggest adapter — recommend-only path, no cart writes

Each scenario uses **recorded fixture conversations**: a JSON file with the user-text turns and the expected sequence of agent events. Sonnet responses are also recorded fixtures (replayed by the OpenRouter mock) — no live LLM calls in CI. Adding a new fixture is one file; this lets us regression-test conversational behavior cheaply.

### 13.3 Contract test

A single test that for each of the 8 adapter types (shopify, woo, magento, bigcommerce, wix, squarespace, dom, suggest): calls every tool, asserts the `tool_result` shape conforms to the documented envelope. This is the wire contract Sonnet relies on.

### 13.4 What we're NOT testing in CI

- **Live LLM calls.** Cost + flakiness. We do them manually pre-merge for any prompt change via a `pnpm shoppingmate:dev agent-replay <fixture>` CLI subcommand (build it as part of this plan).
- **Real WebSocket transport.** Tested at the `apps/api/src/ws/` layer (Plan 3d). Plan 4 tests the runtime in isolation.

## 14. Acceptance criteria

A new operator running through these steps from a clean checkout sees:

1. **`pnpm test` green** including all new agent suites; total test count grows by ~30+.
2. **`pnpm typecheck` clean** across all 8 workspaces (apps/api gains the agent module — no new workspace).
3. **`pnpm shoppingmate:dev agent-replay tests/agent/fixtures/shopify-happy-path.json`** runs the recorded conversation against the runtime and prints the expected event sequence — including `say` events with no numeric prices, `cards` events with image URLs, a final `checkout_redirect`.
4. **A live test against a provisioned Shopify dev store** (using the existing CLI from Plan 2): operator opens a small WS client, sends `{type: "user_text", text: "I want a dress under 2000"}`, sees Sonnet drive `products.search`, receives `cards` with images + a `say` like "Two great picks — see the cards. Want me to add the first one?", sends `{type: "user_text", text: "yes the first"}`, sees `cart.add` succeed and a `say` confirmation. Cart token persists across a simulated WS drop + reconnect.
5. **No-numeric-prices invariant verified** by grepping the recorded transcript output for ₹/$/Rs — zero hits in the agent `say` text, prices visible only on the cards.

## 15. Open questions / explicit deferrals

- **Streaming partial `say`.** Deferred to Plan 6. If voice latency is a problem we revisit.
- **Tool-call parallelism.** Sonnet 4.6 supports parallel tool calls; Plan 4 dispatches them serially for simplicity. Revisit only if a measured latency win exists.
- **`ui.show_message` / `ui.show_product_card` from Plan 3e.** SuggestAdapter currently sends those event types directly through the dispatch deps' `transport`. Plan 4 supersedes that protocol — SuggestAdapter's tool results return cards in the same envelope as other adapters, and the runtime emits `cards` events uniformly. Plan 4 implementation includes a SuggestAdapter refactor task to align it with the new contract; existing Plan 3e tests must still pass.

## 16. Why this design over alternatives

**Why Sonnet for both modes (not Haiku for text, Sonnet for voice)?** The moment a text user types "add the second one" we need tool-use. A forked Haiku/Sonnet path doubles the surface area to test, doubles the prompt-engineering load, and saves at most ~$0.005 per turn. Single-model runtime is the right call for Phase 1; revisit when text volume justifies the optimization.

**Why event stream, not request/response?** A single shopping turn produces multiple natural artifacts: thinking signal, product cards, narrative text, optional checkout redirect. Forcing them into one response payload couples the renderer to the runtime. Event stream lets the widget render incrementally — first the cards land, then the agent narrates them, then UI hints.

**Why cards as a separate event from `say`?** Voice mode reads `say` aloud and renders `cards` visually in the transcript. If they were the same event the widget would have to parse markdown for product references, and the voice agent might end up reading "image: cdn.shoppingmate.ai/..." aloud. Separation is cleaner.

**Why Redis session, not in-memory?** Multi-instance `apps/api` deployments need shared session state for reconnect-resume to work. Redis is already in the stack (BullMQ); no new dependency.

**Why no LLM SDK abstraction?** We use OpenRouter (already wired in `packages/shared/openrouter.ts`) so the runtime is one provider away from Anthropic-direct or Bedrock if we ever switch. Adding an `LlmProvider` interface now is YAGNI per CLAUDE.md guidance.

---

## 17. Hand-off to the implementation plan

After this spec is approved, the writing-plans skill produces a task-by-task implementation plan at `docs/superpowers/plans/2026-05-04-phase1-plan4-agent-runtime.md`. Expected task shape:

1. Bootstrap `apps/api/src/agent/` directory + types module
2. Extend `packages/shared/openrouter.ts` with `chatTools()` method
3. `state.ts` — Redis session repo + tests
4. `tools.ts` — tool surface builder + dispatcher + tests
5. `caps.ts` — cap checker + graceful close + tests
6. `postprocess.ts` — price stripper + redactor + tests
7. `prompts/` — system prompt builder + 8 personas
8. `runtime.ts` — runTurn loop + integration tests against MSW + recorded fixtures
9. `events.ts` + WS handler integration in `apps/api/src/ws/`
10. SuggestAdapter alignment task (per §15 deferral)
11. `agent-replay` CLI subcommand for fixture-driven regression
12. Live Shopify dev-store acceptance run
13. Update `metric_names` registry, run typecheck/test/lint, commit, optional `phase1-plan4-agent-complete` git tag

Each task shippable as its own commit. Subagent-driven execution recommended (per memory: this approach delivered Plans 3a–3e cleanly).
