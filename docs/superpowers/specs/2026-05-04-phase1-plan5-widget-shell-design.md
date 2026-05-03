# Plan 5 — Voice-First Widget Shell — Design Spec

**Date:** 2026-05-04
**Owner:** Karan (Calmosis) — execution by Claude Opus 4.7
**Phase:** 1 (Working widget end-to-end)
**Roadmap reference:** `docs/superpowers/roadmap.md` §4 Phase 1, §9 Plan 5 row, "Voice-first invariants captured 2026-05-04"
**Predecessors:** Plans 1–4 ✅ complete (foundation, provisioning, adapters, agent runtime)
**Successors:** Plan 6 (LiveKit + Gemini Live), Plan 7 (conversion attribution)

---

## 1. Goal (one paragraph)

Ship the production `cdn.shoppingmate.ai/v1.js` Web Component that any merchant pastes into their `<head>` to get a voice-first AI sales agent in their visitors' browsers. The widget renders the floating-pill → expanded → call/chat surfaces in `web/src/components/WidgetPreview.tsx` for real, drives the user end-to-end through Plan 4's agent runtime over the JWT-gated WebSocket, uses browser STT/TTS for voice (Plan 6 swaps in LiveKit + Gemini Live without changing the visible contract), and lands inside a 120 KB gzip budget so it adds <1 s to TTI on a 3G connection.

## 2. Why this plan exists

Plan 4 made a working agent reachable by anything that can speak the WS protocol; nothing in production speaks it yet. Plan 5 is the visitor-facing half of the v0.1 promise — without it, `Plans 1–4` are infrastructure with no users. It also unblocks dogfood: once Plan 5 ships, Karan can paste the snippet into a Calmosis test page and hold a real voice conversation against the live runtime, which is the only way to validate UX before committing to the LiveKit/Gemini cost line in Plan 6.

## 3. Done-criteria

A merchant can:

1. Paste `<script async src="https://cdn.shoppingmate.ai/v1.js" data-id="SM-XXXX"></script>` (or in dev: a local URL) into their `<head>`.
2. See the violet→cyan pill render in the bottom-right corner of every page within 200 ms of `DOMContentLoaded`.
3. Click "Talk to Sage" → grant mic permission → hold a real voice conversation against the Plan 4 runtime: Sage greets, the visitor asks for a product, Sage searches the catalog, product cards stream into the live transcript inline (image + title + price + variantId + productUrl), the visitor either taps a card or says "add the second one", Sage acknowledges, applies a coupon if applicable, and redirects to the merchant's native checkout.
4. Drop into chat as a fallback if mic is denied / unsupported / not desired.
5. Reload the page mid-conversation; the widget reconnects and replays the prior transcript.
6. See the widget never voice a numeric price (Plan 4's `stripPrices` invariant; Plan 5 verifies in tests).

A developer can:

1. `pnpm --filter @shoppingmate/widget dev` and load `examples/host-page.html` in a browser to drive the bundle against the local api server.
2. `pnpm --filter @shoppingmate/widget build` to produce `dist/v1.js` (minified IIFE, ≤120 KB gzip).
3. `pnpm test` (root) runs widget unit + component tests headlessly via vitest + happy-dom — no real browser needed.

If any of these fails for the closed-beta cohort, Plan 5 is not done.

## 4. Architecture overview

```
visitor's browser                                shoppingmate api
─────────────────                                ────────────────
<script data-id=SM-XXXX>                         POST /v1/install     (already exists)
   │                                             POST /v1/session     (NEW — mints WS token)
   ├─ bootstrap.ts                       ───────►   returns { sessionId, wsToken, wsUrl }
   │     - read data-id from script tag
   │     - read window.location.host
   │     - register install + mint session
   │     - register <shoppingmate-widget>
   │     - mount one instance (singleton)
   ▼
ShadowRoot (closed)                              WS /v1/widget/:sid/agent
   ├─ pill / expanded / call / chat panels       ◄── streams AgentEvent
   ├─ transcript: heterogeneous timeline                (say, cards, tool_result,
   │     - agent text bubbles                             checkout_redirect,
   │     - user text bubbles                              cap_warning, end_of_turn,
   │     - inline product card rows                       session_closed)
   ├─ audio: SpeechRecognition + SpeechSynthesis
   │     half-duplex: STT pauses while TTS speaks
   └─ store: tiny pub/sub (no React)             ──► sends WidgetMessage
                                                       (user_text, card_tap,
                                                        session_resume, session_end)
```

### 4.1 Decomposition

```
packages/widget/                            (new workspace)
├── src/
│   ├── index.ts                            entry: read data-attrs, bootstrap, mount once
│   ├── widget.ts                           <shoppingmate-widget> Web Component class
│   ├── bootstrap.ts                        install + session mint + WS URL assembly
│   ├── transport/
│   │   ├── ws.ts                           reconnecting WebSocket client
│   │   └── codec.ts                        encode WidgetMessage / decode AgentEvent (mirrors apps/api/src/agent/events.ts)
│   ├── audio/
│   │   ├── stt.ts                          SpeechRecognition wrapper (webkit fallback)
│   │   ├── tts.ts                          SpeechSynthesis wrapper (voice picker, queue)
│   │   └── voiceMode.ts                    half-duplex coordinator (pause STT while TTS speaks)
│   ├── state/
│   │   └── store.ts                        pub/sub store + transcript reducer
│   ├── ui/
│   │   ├── shell.ts                        shadow root setup, mode router (pill|expanded|call|chat)
│   │   ├── pill.ts                         floating pill renderer + click handlers
│   │   ├── expanded.ts                     CALL / CHAT button strip
│   │   ├── call.ts                         call panel: header, waveform, transcript, controls
│   │   ├── chat.ts                         chat panel: header, scrollback, input, quick replies
│   │   ├── transcript.ts                   heterogeneous transcript renderer (text + cards inline)
│   │   ├── cards.ts                        product card row renderer (tap → card_tap msg)
│   │   └── waveform.ts                     CSS-only animated bars (no canvas, ~1KB)
│   ├── styles/
│   │   └── shadow.css.ts                   exported as a string template, injected into shadow root
│   └── strings.ts                          all user-facing text in one file (i18n-ready)
├── scripts/
│   └── build.ts                            esbuild config: IIFE, minify, sourcemap, size-check
├── examples/
│   └── host-page.html                      static page that loads dist/v1.js for manual smoke
├── test/
│   ├── transport-ws.test.ts                ws reconnect + resume sequencing
│   ├── transport-codec.test.ts             round-trip with apps/api/src/agent/events.ts shapes
│   ├── audio-voicemode.test.ts             STT-pause-during-TTS state machine
│   ├── state-store.test.ts                 reducer: append text, append cards, on session_resume
│   ├── ui-pill.test.ts                     happy-dom: pill renders, clicks toggle mode
│   ├── ui-call.test.ts                     happy-dom: transcript renders text + cards inline
│   ├── ui-chat.test.ts                     happy-dom: input submit appends user_text msg
│   └── bootstrap.test.ts                   data-id read, install POST mocked, session mint, mount
├── package.json
├── tsconfig.json
└── vitest.config.ts

apps/api/src/routes/
└── session.ts                              NEW: POST /v1/session — mints { sessionId, wsToken, wsUrl }
                                            wired into apps/api/src/index.ts at /v1/session
```

Each file holds one responsibility. `widget.ts` (the Web Component) is the only file that touches the DOM directly outside the `ui/` folder. `transport/`, `audio/`, `state/` are framework-free and unit-tested in isolation. `ui/` files take a `state.Store` and a `shadow: ShadowRoot` and render — no global state, no hidden coupling.

### 4.2 Why a new package, not in `web/`

`web/` is the marketing/dashboard Next.js app — its build, deps, and runtime expectations are wholly different from a CDN-shipped vanilla bundle. Putting the widget there would either pull React into the merchant's page (rejected: 40+ KB minimum, conflicts with merchant's own React if any) or require a parallel build pipeline inside a Next.js app (rejected: complexity for no gain). A dedicated workspace lets us pin esbuild, run vitest in isolation, and treat `dist/v1.js` as a publishable artifact.

### 4.3 Why no framework in the bundle

A Shadow DOM + 4 mode panels + a transcript that appends DOM nodes does not need React/Vue/Lit. A 200-line vanilla store + direct `appendChild` keeps us under 30 KB before minify, well inside the 120 KB gzip budget that has to also house Tailwind-equivalent CSS. We get to use `lucide-react`-equivalent inline SVG strings (about 5 icons total), which compresses well.

## 5. The contracts

### 5.1 Visitor-side script tag

```html
<script
  async
  src="https://cdn.shoppingmate.ai/v1.js"
  data-id="SM-XXXX"
  data-api="https://api.shoppingmate.ai"   <!-- optional, defaults baked at build time -->
></script>
```

- `data-id` is required; missing → bundle no-ops with a `console.warn`.
- `data-api` overrides the API base URL — used only by dev/staging hosts.
- The script runs once. Re-mounts and SPA route-changes are handled by the Web Component lifecycle, not by re-execution.

### 5.2 New API endpoint: `POST /v1/session`

Request:
```json
{ "merchantId": "SM-XXXXXX", "domain": "merchant.example.com" }
```

Headers: same `origin`/`referer` checks as `/v1/install`.

Response 200:
```json
{
  "sessionId": "ws_01HXXXXXXX",
  "wsToken": "<base64url>.<base64url>",
  "wsUrl": "wss://api.shoppingmate.ai/v1/widget/ws_01HXXXXXXX/agent?token=..."
}
```

Errors mirror `/v1/install`: `400 invalid_body`, `403 origin_mismatch`, `403 domain_not_allowed`, `404 merchant_not_found`, `429 rate_limited`. **It does NOT check `merchant.status`** — onboarding may still be in progress. The runtime gracefully says "I'm still getting set up, please come back in a few minutes" if the catalog is empty (already handled in Plan 4 via the suggest fallback path).

Token: `signWsToken({ sessionId, merchantId, exp: now + 24h })` — 24h matches the Redis session TTL from Plan 4, so the token outlives a full session-resume window. The session ID is generated server-side via `nanoid` (already a transitive dep) prefixed with `ws_`.

### 5.3 WS protocol (already shipped in Plan 4)

The widget speaks the existing `WidgetMessage` and consumes the existing `AgentEvent` types verbatim. No protocol changes. `transport/codec.ts` is a 60-line mirror of `apps/api/src/agent/events.ts` — same shape guards, same field names. A round-trip test loads both modules and asserts shape equivalence so the contract can't drift.

### 5.4 The transcript model

The widget's UI is driven by a single ordered array of `TranscriptItem`s:

```ts
type TranscriptItem =
  | { id: string; role: 'agent'; kind: 'text'; text: string; ts: number }
  | { id: string; role: 'user';  kind: 'text'; text: string; ts: number }
  | { id: string; role: 'agent'; kind: 'cards'; items: CardItem[]; ts: number }
  | { id: string; role: 'system'; kind: 'cap_warning'; remaining: number; ts: number }
  | { id: string; role: 'system'; kind: 'closed'; reason: 'user' | 'cap' | 'error'; ts: number };
```

Reducer rules:
- `say` event → append `{role:'agent', kind:'text'}`. Multiple consecutive `say` events get **separate** bubbles (matches the segmented-say behavior of `runtime.ts`).
- `cards` event → append a single `{role:'agent', kind:'cards'}` item; cards render as a horizontally-scrollable inline row in transcript flow, not as a popover.
- `tool_result` event → suppressed from UI; only used for telemetry.
- `checkout_redirect` event → set `state.checkoutUrl`; UI shows a sticky "Pay now →" CTA above the input. Does **not** auto-redirect; visitor confirms.
- `cap_warning` → append a `system` cap_warning item rendered as a chip ("a couple minutes left").
- `session_closed` → append a `system` closed item; disable input; pill returns to a non-actionable "Conversation ended" state.
- `end_of_turn` → not stored; clears the "Sage is thinking…" indicator.

This reducer is pure (`state, event → state`) and lives in `state/store.ts`; tested without any DOM.

### 5.5 The card-tap path

```
visitor taps a product card
        │
        ▼
ui/cards.ts   ──► store.dispatch({ type:'card_tap', sku, variantId, qty:1 })
        │
        ▼
transport/ws.ts ──► sends WidgetMessage { type:'card_tap', sessionId, action:'cartAdd', sku, variantId, qty }
        │
        ▼
runtime.ts (Plan 4) ──► dispatches cart.add tool, runs micro Sonnet ack
        │
        ▼
agent stream returns: tool_result + say "Adding it now" + (eventually) checkout_redirect
        │
        ▼
transcript appends agent text bubble; checkout chip appears
```

Same code path as voice "add the second one" — the agent stays in the loop and acknowledges aloud. This is the v0.1 invariant from the roadmap.

### 5.6 Audio: half-duplex via Web Speech API

```
voiceMode.ts state machine:
       ┌─────────────┐                ┌──────────────┐
  ────►│   IDLE      │  start-call ───►│  LISTENING   │  (SpeechRecognition active)
       └─────────────┘                └──────────────┘
              ▲                              │ onresult(final)
              │                              ▼
              │                       ws.send({ type:'user_text', text, mode:'voice' })
              │                              │
       end-call                              │ AgentEvent { type:'say', text }
              │                              ▼
              │                        ┌──────────────┐
              └─────── stop ───────────┤   SPEAKING   │  (SpeechSynthesis utters segment)
                                       └──────────────┘
                                              │ onend
                                              ▼
                                       resume LISTENING
```

- TTS interruption: if `onresult(final)` fires while speaking, we stop the current utterance immediately ("barge-in"). Web Speech doesn't reliably interrupt mid-word, so we accept "interrupt at next utterance boundary" as a known limitation; document in §11 as a Plan-6-fixes-this item.
- Mute: stops SR, doesn't stop TTS. Unmute resumes SR.
- Voice picker: pick the first `voice` whose `lang` starts with `en-` and has the highest `default`/`localService` priority. Persona-tuned voice is parked for Plan 6 (Gemini's per-persona descriptors).
- Browser support gates: if `window.SpeechRecognition`/`webkitSpeechRecognition` is missing, the pill renders "Chat with Sage" and the call button is hidden. If `window.speechSynthesis` is missing, voice mode is disabled but text mode still works (silent agent). Both behaviors covered by tests.

### 5.7 Reconnect + resume

`transport/ws.ts` exponential backoff: 1s, 2s, 4s, 8s, 16s, then steady at 30s. On reconnect, send `{type:'session_resume', sessionId}` first; runtime replays prior transcript (Plan 4's `replaySession`). The widget receives a stream of `say` + `cards` events, flushes the local transcript, and re-renders from the replayed events.

Reconnect attempts are silent until the 3rd failure, then we surface a subtle "Reconnecting…" chip. After 5 failures, we surface a "Connection lost — reload to retry" message and stop trying.

### 5.8 Singleton + lifecycle

- The bundle's entry registers `customElements.define('shoppingmate-widget', WidgetElement)` once.
- It then checks `document.querySelector('shoppingmate-widget')` — if present, no-op. Else it creates one, sets `data-id` from the script tag, and `document.body.appendChild`s it.
- `WidgetElement.connectedCallback` does the install + session mint + WS connect.
- `WidgetElement.disconnectedCallback` closes the WS and stops audio.
- SPA route changes don't tear down the widget (it's outside the SPA's React root); the WS persists, conversation continues across pages on the same merchant domain.

## 6. What this plan does NOT include (defer list)

These belong to later plans. Including them here so a curious reviewer can stop wondering:

- **LiveKit + Gemini Live native audio** — Plan 6. Plan 5's audio is browser-native to validate UX cheaply.
- **8 voice personas** — Plan 6. Plan 5 picks the first `en-*` voice and ships.
- **Conversion attribution beacon** — Plan 7. Plan 5 fires `widget.opened` and `widget.checkout_redirected` telemetry but does not close the loop on actual conversions.
- **CDN deployment** — operator/infra. Plan 5 produces `dist/v1.js` and a dev story; the live cdn upload is out of scope.
- **Brand KB-aware system prompt** — Phase 2. Plan 5 widget surfaces whatever the runtime's system prompt knows (currently persona + adapter hints).
- **Multi-language UI strings** — `strings.ts` exists to make this swap trivial, but only English is shipped in v0.1.
- **Custom theming per merchant** — colors are hard-coded to match `WidgetPreview.tsx`. Theming parked for v0.2.
- **Mobile-specific SDK** — gtag-snippet works on mobile web; native SDK parked indefinitely.

## 7. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Web Speech API is Chrome/Edge-only; iOS Safari has limited support | High | Medium | Detect support; fallback to chat. Document as a "voice on Chrome/Edge for v0.1; cross-browser via Plan 6 LiveKit". |
| TTS pause-on-listen feels laggy vs full-duplex Gemini Live | High | Medium | Acceptable for validation; explicit "Plan 6 fixes this" in spec + telemetry on `widget.barge_in_attempt` to size the impact. |
| Bundle bloat past 120 KB gzip | Medium | High | Build script asserts `gzip-size dist/v1.js < 122_880`; CI fails if exceeded. Tree-shaken esbuild + zero deps in the bundle. |
| Shadow DOM CSS doesn't isolate from merchant's CSS reset (`* { all: unset }`) | Low | High | Set `:host { all: initial }` at the top of the shadow stylesheet, then re-declare every property the widget uses. |
| Merchant's CSP blocks inline audio (no `unsafe-inline`) — irrelevant since we use Web Speech, not custom audio worklets | Low | Low | Document in install instructions; no code change. |
| WS token leaks into browser history / analytics if `wsUrl` is logged | Low | Medium | Token is in URL query string (necessary for WS auth); 24h TTL caps blast radius; future Plan considers `Sec-WebSocket-Protocol` subprotocol auth. |
| `customElements.define` collides with merchant's pre-registered name | Very low | Low | Wrap in try/catch; if collision, log warn and stop. |
| Origin check rejects `localhost` during dev | Certain | Trivial | Dev `originMatches` already permits localhost when domain is localhost; verify and document. |

## 8. Testing strategy

Unit tests (vitest, no DOM):
- `transport-codec`: round-trip encode/decode against fixtures derived from `apps/api/src/agent/types.ts`. Negative cases (malformed JSON, missing fields) return null.
- `state-store`: reducer steps through a full session: open → user_text → say → cards → say → card_tap → tool_result → say → checkout_redirect → session_closed. Asserts transcript array shape after each step.
- `audio-voicemode`: state machine transitions LISTENING ↔ SPEAKING ↔ MUTED with mocked `SpeechRecognition` + `speechSynthesis`. Verifies STT pauses during TTS and resumes after.
- `transport-ws`: mocks WebSocket constructor; asserts reconnect schedule (1s/2s/4s/…), `session_resume` is sent first on reconnect, error chip after 3 failures, give-up after 5.
- `bootstrap`: mocks `document.currentScript` + `fetch`; asserts install POST + session POST happen in order, fields are extracted correctly, `<shoppingmate-widget>` is created with right attributes, second mount is a no-op.

Component tests (vitest + happy-dom):
- `ui-pill`: shadow-rooted pill renders; click toggles mode; ARIA labels present; ESC closes.
- `ui-call`: given a transcript with [agent text, cards, agent text], the rendered DOM has 3 children in order; cards row is horizontally scrollable; tapping a card dispatches card_tap.
- `ui-chat`: input submit on enter, button click, both append a user_text item; quick replies render only when transcript is empty.

No real-browser E2E tests in Plan 5 — manual `examples/host-page.html` smoke is the acceptance path, since the UX nuances (mic permission flow, real STT) need a real browser. Plan 7 will add Playwright E2E once conversion attribution gives us a meaningful end-to-end signal.

## 9. Acceptance gates

Plan 5 is complete when:

1. `pnpm typecheck` clean across all 9 workspaces (8 existing + new `@shoppingmate/widget`).
2. `pnpm test` all green; new test files cover bootstrap, transport, audio, store, and three UI panels (≥30 new tests).
3. `pnpm lint` reports only the 4 pre-existing slack-workstream errors.
4. `pnpm --filter @shoppingmate/widget build` produces `dist/v1.js`, gzipped size <120 KB, build script prints actual size.
5. `examples/host-page.html` loads in Chrome against a local api server (`pnpm --filter @shoppingmate/api dev`) and a freshly provisioned dev merchant; the operator (Karan) can hold a complete voice conversation, see cards stream into the transcript inline, tap a card, see Sage acknowledge, and end up at a `checkout_redirect` URL.
6. Roadmap §9 Plan 5 row marked ✅ Complete with commit references.
7. Memory entry `project_shoppingmate_phase1_status.md` updated.
8. Tag `phase1-plan5-widget-shell-complete` created.

Acceptance gate 5 (live smoke) is **deferrable** — same pattern as Plan 1–4 deferred-acceptance items, since it requires the operator to be at a browser with mic. The plan can ship to "code-complete" without it; Karan signs off once they've held the smoke conversation.

## 10. Sequencing — phases

Per roadmap §4 dependency-sequenced rule. 10 phases, ~32 tasks total estimated.

- **Phase A** — Workspace scaffolding (4 tasks): package.json, tsconfig, vitest config, esbuild config, root pnpm-workspace inclusion, gzip-size budget assertion.
- **Phase B** — API surface (3 tasks): `POST /v1/session` route with origin check + token mint + tests, wired into `apps/api/src/index.ts`.
- **Phase C** — Transport (4 tasks): codec (encode/decode + tests), WS client with reconnect + resume + tests.
- **Phase D** — Audio (3 tasks): STT wrapper + TTS wrapper + voiceMode coordinator + tests.
- **Phase E** — State store (2 tasks): pub/sub + transcript reducer + tests.
- **Phase F** — UI primitives (4 tasks): shadow root setup, styles module, pill renderer, expanded mode renderer.
- **Phase G** — Call panel (3 tasks): waveform, transcript renderer (text + cards inline), call panel composite + tests.
- **Phase H** — Chat panel (2 tasks): chat panel composite + input handling + tests.
- **Phase I** — Bootstrap + Web Component (3 tasks): widget element class, entry script that reads data-id and mounts, singleton enforcement.
- **Phase J** — Acceptance + close (4 tasks): examples/host-page.html, dev script, roadmap update, tag.

## 11. Source documents

- **Roadmap (this plan's parent):** `docs/superpowers/roadmap.md` §4 Phase 1 + §9 Plan 5
- **Phase 1 spec (overarching):** `docs/superpowers/specs/2026-04-30-shoppingmate-phase1-design.md`
- **Plan 4 spec (the WS contract this plan consumes):** `docs/superpowers/specs/2026-05-04-phase1-plan4-agent-runtime-design.md`
- **Plan 4 plan (where the WS endpoint, event shapes, and runtime contract live):** `docs/superpowers/plans/2026-05-04-phase1-plan4-agent-runtime.md`
- **Visual reference:** `web/src/components/WidgetPreview.tsx`
- **Voice-stack ADR (Plan 6 successor context):** `docs/adr/2026-05-01-voice-stack-livekit-gemini-live.md`
- **Strategy (positioning, pricing context):** `docs/strategy/2026-05-01-shoppingmate-strategy.md`
