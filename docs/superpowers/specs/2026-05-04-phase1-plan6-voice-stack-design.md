# Plan 6 — Voice Stack (LiveKit Cloud + Gemini 2.5 Flash Live) — Design Spec

**Date:** 2026-05-04
**Owner:** Karan (Calmosis) — execution by Claude Opus 4.7
**Phase:** 1 (Working widget end-to-end)
**Roadmap reference:** `docs/superpowers/roadmap.md` §4 Phase 1, §9 Plan 6 row, "Voice-first invariants captured 2026-05-04"
**ADR reference:** `docs/adr/2026-05-01-voice-stack-livekit-gemini-live.md`
**Predecessors:** Plans 1–5 ✅ complete (foundation, provisioning, adapters, agent runtime, voice-first widget shell)
**Successors:** Plan 7 (conversion attribution)

---

## 1. Goal (one paragraph)

Swap the widget's Plan 5 simulated audio (Web Speech API) for the production voice stack specified in ADR-0001: LiveKit Cloud (WebRTC transport) + Gemini 2.5 Flash Live (native audio in/out, persona-voiced TTS). Cognition stays exactly as Plan 4 left it — every voice turn round-trips through Sonnet 4.6's tool-use loop in `@shoppingmate/agent`. Plan 6 adds a thin Node service (`apps/voice-agent/`) that joins the visitor's LiveKit room as the bot peer, owns the Gemini Live session, and bridges visitor STT text into `runTurn(...)` and the runtime's `say` events back into Gemini TTS. Widget bundle stays under the 120 KB gzip budget by lazy-loading `livekit-client` from a CDN on first call-start, with graceful fallback to chat mode whenever any voice dependency fails. The plan also produces the Plan 4-bis cost pilot — 100 production-shaped conversations on a staging dev store — which is the seed-close gate for the §5.4 margin floor.

## 2. Why this plan exists

Five reasons, each documented elsewhere in the repo:

1. **Browser coverage.** Plan 5's Web Speech API works only on Chrome/Edge desktop; iOS Safari + Firefox lose voice silently and degrade to chat. v0.1 promises voice on "any visitor on any merchant site" — shipping with ~40% of mobile traffic muted is a broken promise. (Plan 5 spec §7 risk row #1.)
2. **Latency.** Whisper-style 3-hop pipelines (which Web Speech approximates) measured 2.1–2.8 s per voice turn in dry-runs. The "feels human" target is sub-1.5 s. Gemini Live native audio collapses STT + TTS into one round trip → 800 ms–1.2 s. (ADR-0001 §2.)
3. **Barge-in.** Web Speech can't reliably interrupt mid-utterance; Plan 5 §6.6 + §11 explicitly defers full-duplex barge-in to Plan 6. Real conversations need it; LiveKit + Gemini Live deliver it.
4. **Personas.** v0.1 promises 8 personas via voice-descriptor prompts (roadmap §4 Phase 1). Web Speech uses whatever robotic voice the OS ships. Plan 5 picks the first `en-*` voice and ships; Plan 6 ships the actual eight personas mapped to Gemini's prebuilt voice library.
5. **Margin floor + seed-close blocker.** ADR-0001 §3 modeled worst-case GM ≥ 70% per plan against Gemini Live's ~$0.018/voice-conv estimate. The single RED in the GREEN viability verdict (`project_shoppingmate_viability.md`) is "Gemini Live cost unverified at scale." Plan 6 produces the measured $/conv with 95% CI on 100 real conversations — that number replaces the estimate everywhere and gates the seed term sheet.

## 3. Done-criteria

A merchant's visitor can:

1. Click "Talk to Sage", grant mic permission, and connect to the LiveKit room within ~500 ms (cold) or ~150 ms (warm cache).
2. Hold a complete voice conversation against the Plan 4 runtime: greet → product Q&A → cart build → coupon apply → redirect to merchant's native checkout. End-to-end latency from end-of-utterance to first audio of agent reply ≤ 1.5 s p50, ≤ 2.5 s p95.
3. Interrupt the agent mid-sentence (full-duplex barge-in) and have the agent stop within ~200 ms.
4. Hear one of 8 personas — voice descriptor + Gemini voice ID resolved from `merchant.config.persona_id` at session-open.
5. Never hear a numeric price spoken (Plan 4's `stripPrices()` invariant + Gemini Live system instruction belt-and-braces; verified by transcript review of every pilot conversation).
6. Be hard-capped at 15 turns / 3 min cumulative voice / 25 min wall-clock — `cap_warning` chip at the 13th turn, `session_closed{reason:'cap'}` on the 16th.
7. Fall back gracefully to chat mode if mic is denied, LiveKit Cloud is unreachable, Gemini Live errors mid-call, or the lazy-loaded `livekit-client` SDK fails to load. No silent failures — every degradation surfaces a visible chip.

A developer can:

1. `pnpm --filter @shoppingmate/voice-agent dev` to register a worker against the LiveKit Cloud staging project and serve a real voice peer.
2. `pnpm --filter @shoppingmate/widget build` and confirm `dist/v1.js` is ≤120 KB gzip and contains zero bytes of `livekit-client` (lazy-load only).
3. `pnpm test` (root) runs all unit + integration tests headlessly, including the bridge round-trip and the persona-voice-descriptor coverage, with no LiveKit/Gemini network calls.
4. `pnpm --filter @shoppingmate/voice-agent pilot-replay <s3-key>` replays a recorded LiveKit room session against Gemini Live for cost reproducibility.

A finance/founder reviewer can:

5. Read `docs/strategy/2026-05-XX-gemini-live-cost-pilot.md` and see measured $/conv, 95% CI, distribution by conv length, voice-only vs voice-with-tools breakout, and a per-plan margin-floor check.

If any of (1)–(5) on the visitor side, (1)–(4) on the developer side, or (5) on the finance side fails, Plan 6 is not done.

## 4. Architecture overview

```
visitor browser              LiveKit Cloud (SFU)          apps/voice-agent (Node)        apps/api  (existing)
─────────────────            ───────────────────          ──────────────────────────    ─────────────────────
<shoppingmate-widget>
  voiceModeLiveKit.ts                                     LiveKit Agents JS worker      POST /v1/install
   │                                                      ┌────────────────────────┐    POST /v1/session
   │ start() ──► fetch /v1/voice/token ──────────────────►│ /v1/voice/token (NEW)  │    POST /v1/voice/token (NEW
   │ dynamic-import livekit-client                        │   mints LK access JWT  │      → mints LiveKit JWT
   │ Room.connect(wsUrl, token) ◄═══ WebRTC signalling ═══│   (24h TTL, scoped)    │       scoped to sessionId)
   │      ║                                               └────────────────────────┘
   │      ║ audio frames (Opus)        on participant_join, voice-agent
   │      ║◄══════════════════════════►joins same room, attaches Gemini
   │      ║                            Live session as the bot peer
   │      ║                                                  │
   │      ║                            Gemini 2.5 Flash Live │
   │      ║                            ─ STT (audio in)      │
   │      ║                            ─ TTS (audio out)     │
   │      ║                            ─ persona voice desc  │
   │      ║                            ─ NO reasoning, NO    │
   │      ║                                tool use          │
   │      ║                                                  │
   │      ║       data-channel: say/cards/checkout_redirect  │
   │      ║◄═════════════════════════════════════════════════│   (Plan 4 events;
   │      ║                                                  │    widget reuses store)
   │      ║                                                  │
   │      ║ STT final text  ────────►  runTurn(text)  ──────►│ in-process import of
   │                                   (Plan 4 runtime)      │ packages/agent (extracted
   │                                   ─ Sonnet 4.6 picks    │  from apps/api/src/agent
   │                                     tool                │  in Phase A — no behavior change)
   │                                   ─ tools execute       │
   │                                   ─ stripPrices() reply │
   │                                   ─ caps enforced       │
   │                                   ─ emits say/cards     │
   │                                                  │
   │                                                  ▼
   │                            voice-agent feeds reply text
   │                            into Gemini Live → audio out
```

### 4.1 The seven invariants

These are non-negotiable for Plan 6 and bound every implementation choice:

1. **Audio path = Gemini Live only.** Gemini handles STT, TTS, and persona voicing. It never reasons, never picks tools, never responds without going through Sonnet first.
2. **Cognition path = Plan 4 runtime, unchanged.** Every voice turn calls `runTurn(text)` from `@shoppingmate/agent`. Same tools, same caps, same `stripPrices()`, same persona system prompt. No voice-only code path for tool decisions.
3. **Voice-agent is a thin bridge.** Target ≤ 600 LoC across `agentWorker.ts` + `geminiSession.ts` + `bridge.ts` + `dataChannel.ts` + `persona.ts`. No business logic; if it grows, the wrong thing is being added.
4. **Widget retains WS to api for chat mode.** Voice mode uses LiveKit room (audio + data channel). Chat mode uses the existing Plan 4 WS untouched. Plan 5's chat-only code path is preserved verbatim.
5. **`packages/widget/src/audio/voiceMode.ts` public surface unchanged.** `start/stop/speak/setMuted/onStateChange/getState` remain. Plan 5's UI consumers (`ui/call.ts`) do not move; only the internals swap from Web Speech to LiveKit via a factory.
6. **Fallback chain is explicit.** No mic / mic denied / LiveKit connect fails / `livekit-client` lazy-load fails / Gemini session errors → degrade to chat with a visible chip. No silent failures.
7. **Plan 4-bis cost pilot is a deliverable.** Memo at `docs/strategy/2026-05-XX-gemini-live-cost-pilot.md` with measured $/conv 95% CI on 100 real conversations. Gates the seed close per ADR-0001 §4.

### 4.2 Decomposition

```
packages/agent/                            (NEW — extraction, no behavior change)
├── src/
│   ├── runtime.ts                         ◄── moved from apps/api/src/agent/runtime.ts
│   ├── state.ts                           ◄── moved
│   ├── caps.ts                            ◄── moved
│   ├── events.ts                          ◄── moved
│   ├── types.ts                           ◄── moved
│   ├── tools.ts                           ◄── moved
│   ├── postprocess.ts                     ◄── moved (stripPrices)
│   ├── transport-noop.ts                  ◄── moved
│   ├── replay.ts                          ◄── moved
│   ├── prompts/
│   │   ├── system.ts                      ◄── moved
│   │   └── persona-table.ts               ◄── moved + EXTENDED (voice descriptors)
│   └── index.ts                           NEW barrel — exports runTurn, types, persona helpers
├── test/                                  ◄── 50+ existing tests moved verbatim
├── package.json                           name: @shoppingmate/agent
└── tsconfig.json

apps/api/                                  (MODIFIED)
├── src/
│   ├── agent/                             DELETED — re-exports from @shoppingmate/agent
│   ├── routes/
│   │   ├── session.ts                     EXISTING (no change)
│   │   └── voice-token.ts                 NEW — POST /v1/voice/token mints LiveKit JWT
│   └── ws/                                EXISTING (no change — chat mode keeps using this)

apps/voice-agent/                          (NEW workspace)
├── src/
│   ├── index.ts                           bootstrap: register LiveKit Agents worker, env validation
│   ├── agentWorker.ts                     LiveKit Agents JobContext handler — one job per Room join
│   ├── geminiSession.ts                   Gemini 2.5 Flash Live native-audio session wrapper
│   ├── bridge.ts                          STT text → @shoppingmate/agent runTurn → reply → Gemini TTS
│   ├── dataChannel.ts                     publishes say/cards/checkout_redirect/cap_warning to room data channel
│   ├── persona.ts                         maps personaId → Gemini voice descriptor
│   ├── env.ts                             LIVEKIT_URL, LIVEKIT_API_KEY/SECRET, GEMINI_API_KEY, etc.
│   └── metrics.ts                         per-conv ledger entries (audio_seconds, gemini_tokens, sonnet_turns)
├── test/
│   ├── bridge.test.ts                     STT-text → runTurn (mocked) → TTS-text round trip + barge-in
│   ├── persona.test.ts                    8 personas → 8 valid Gemini voice descriptors
│   ├── dataChannel.test.ts                say/cards events serialize to room messages
│   ├── geminiSession.test.ts              session lifecycle: open, partial transcripts, finalize, interrupt, close
│   └── agentWorker.integration.test.ts    full job lifecycle against mocked Room + mocked Gemini
├── scripts/
│   └── pilot-replay.ts                    replays a recorded LiveKit room session for cost-pilot analysis
├── package.json                           name: @shoppingmate/voice-agent
├── tsconfig.json
└── Dockerfile                             so this can run as its own process in prod (operator concern)

packages/widget/                           (MODIFIED — Plan 5 surface preserved)
├── src/
│   ├── audio/
│   │   ├── voiceMode.ts                   EXISTING — unchanged public surface
│   │   ├── voiceModeWebSpeech.ts          Plan 5's existing impl, RENAMED for clarity
│   │   ├── voiceModeLiveKit.ts            NEW — LiveKit + dynamic-imported livekit-client
│   │   ├── voiceModeFactory.ts            NEW — picks LiveKit by default, honors VITE_VOICE_STACK override
│   │   ├── stt.ts                         EXISTING — used only by Web Speech fallback
│   │   └── tts.ts                         EXISTING — used only by Web Speech fallback
│   ├── transport/
│   │   ├── ws.ts                          EXISTING (chat mode)
│   │   └── livekit.ts                     NEW — thin wrapper over livekit-client room
│   ├── bootstrap.ts                       MODIFIED — POSTs /v1/voice/token alongside install + session
│   └── ui/
│       └── call.ts                        MODIFIED — call control buttons trigger voiceModeLiveKit
```

### 4.3 Why a separate `apps/voice-agent/` workspace

- **Crash isolation:** LiveKit Agents holds long-lived WebRTC peers; if a Gemini session hangs we restart this one process, not the HTTP API.
- **Scaling profile:** voice-agent is bound by concurrent calls; api is request-bound. Different scaling axes, different node sizes.
- **Deployment topology:** ops can place voice-agent in regions closer to LiveKit Cloud edges without affecting api.
- **Test boundaries:** voice-agent's tests mock LiveKit + Gemini; api's tests don't need to know either exists.

### 4.4 Why extract `apps/api/src/agent/` → `packages/agent/` first

- Voice-agent imports `runTurn` directly. No anti-pattern of importing from another app's `src/`.
- Plan 4's tests move with the code; the extraction is a refactor with zero behavior change. CI gates on all 360 tests staying green.
- Future Plan 7 (conversion attribution) and the dashboard backend will both want runtime imports — extraction is leverage that pays off twice more.
- Done as Phase A of Plan 6 sequencing; a single tag (`phase1-plan6-phaseA-agent-extracted`) marks the safe rollback point.

## 5. The contracts

### 5.1 New API endpoint: `POST /v1/voice/token`

Request:
```json
{ "sessionId": "ws_01HXXXXXXX", "merchantId": "SM-XXXXXX" }
```

Headers: same `origin`/`referer` checks as `/v1/install` and `/v1/session`. The `sessionId` must exist and belong to the requesting `merchantId` (look up via the existing session store).

Response 200:
```json
{
  "wsUrl": "wss://shoppingmate.livekit.cloud",
  "roomName": "sm_ws_01HXXXXXXX",
  "token": "<LiveKit JWT, 24h TTL>",
  "personaId": "sage"
}
```

The JWT grants `can_publish: true`, `can_subscribe: true`, scoped to `roomName` only. No cross-merchant or cross-session token reuse possible. TTL matches the Plan 4 Redis session TTL so a long pause + reconnect works without re-minting.

Errors mirror `/v1/session`: `400 invalid_body`, `403 origin_mismatch`, `403 session_mismatch`, `404 session_not_found`, `429 rate_limited`. The route does NOT check `merchant.status` — onboarding may still be in progress; the runtime degrades gracefully.

### 5.2 LiveKit room conventions

- Room name: `sm_<sessionId>` (1:1 with widget session). Idle rooms auto-close after 15 minutes (LiveKit Cloud default suffices).
- Two participants per room: one human (widget identity = `visitor_<sessionId>`), one bot (voice-agent identity = `agent_<sessionId>`).
- Audio tracks: visitor publishes one mic track; voice-agent publishes one TTS track. Both Opus, 48 kHz mono, ~32 kbps.
- Data channel: voice-agent publishes JSON-encoded `AgentEvent`s (matching `@shoppingmate/agent`'s `events.ts` shapes). Reliable delivery (`reliable: true` on `LocalParticipant.publishData`).

### 5.3 Voice-agent ↔ runtime contract

Voice-agent imports `@shoppingmate/agent` and calls:

```ts
import { runTurn } from '@shoppingmate/agent';

await runTurn({
  sessionId,
  merchantId,
  userText,
  deps: { ...standardDeps, transport: dataChannelTransport },
  onEvent: (event) => {
    switch (event.type) {
      case 'say':              dataChannelPublish(event); ttsQueue.push(event.text); break;
      case 'cards':             dataChannelPublish(event); break;
      case 'checkout_redirect': dataChannelPublish(event); break;
      case 'cap_warning':       dataChannelPublish(event); break;
      case 'tool_result':       /* swallow — telemetry only */; break;
      case 'end_of_turn':       ttsQueue.flush(); break;
      case 'session_closed':    dataChannelPublish(event); closeRoom(); break;
    }
  },
});
```

`dataChannelTransport` is voice-agent's implementation of Plan 4's `WSTransport` interface — for DOM/Suggest tool calls, voice-agent forwards `dom.*` events to the widget over the same data channel. (DOM-driven merchants may use voice; the dispatcher routes correctly.)

### 5.4 Per-turn flow (concrete timing)

```
t=0     visitor presses mic; widget calls voiceModeLiveKit.start()
t+50ms  widget connects to LiveKit room (cached after first call)
t+100   voice-agent already in the room; opens Gemini Live session pre-warmed
        with persona voice descriptor + system prompt fragment
t+200   visitor speaks: "do you have running shoes in size 10?"
        audio frames stream visitor → LiveKit → voice-agent → Gemini Live (~50ms)
t+400   Gemini Live emits partial transcripts (used only for "Sage is hearing you" UI tick)
t+900   Gemini Live emits FINAL transcript: "do you have running shoes in size 10"
        voice-agent.bridge.ts catches finalize event:
          1. publish data-channel msg { type:'user_text', text } → widget transcript
          2. await runTurn({ text, sessionId, deps })
          3. as runTurn streams events: say → publish + queue for TTS;
             cards/checkout_redirect/cap_warning → publish only;
             end_of_turn → flush TTS queue
          4. Sonnet returns first say chunk at ~t+1300
t+1400  voice-agent feeds first say text → Gemini Live as agent turn
        Gemini Live streams synthesized audio back into the room
t+1500  visitor hears Sage's first words. Total: 1.3 s end-of-utterance to first audio.
```

**Why no intent classifier:** every voice turn round-trips through Sonnet. Cheap (~$0.005/turn × 15-turn cap = $0.075/conv), preserves Plan 4's tool-use accuracy, eliminates a class of bugs ("Gemini answered without checking the catalog"). ADR §3's "one audio round trip" stays true — only the audio pipeline is collapsed.

### 5.5 Barge-in (full-duplex)

LiveKit + Gemini Live give us proper mid-utterance interrupts:

- Gemini Live exposes `session.interrupt()` — call it the moment we detect visitor voice activity above the noise threshold while we're mid-TTS.
- voice-agent listens for `voice_activity_started` on the visitor track. If currently speaking, sends `interrupt()`, drops the queued say tail, marks the turn truncated in the transcript ("Sage was interrupted").
- We do NOT cancel the in-flight Sonnet `runTurn`; its remaining say events are dropped silently (Sonnet's reply is best-effort anyway; the visitor's next utterance is what matters).
- Plan 5's "interrupt at utterance boundary" limitation is gone. Telemetry: `voice.barge_in_succeeded`.

### 5.6 Mute / hold / end-call

- `voiceMode.setMuted(true)` → widget mutes the local mic track (`Room.localParticipant.setMicrophoneEnabled(false)`). Voice-agent sees the track go silent; Gemini's session stays open but produces no transcripts. No turn timer ticks.
- Unmute resumes mic; conversation continues from where it was.
- "End call" closes the room from the widget side; voice-agent observes `participant_disconnected`, closes the Gemini session, emits `session_closed{reason:'user'}` via WS-to-api so chat-mode resume works, and shuts down the job.

### 5.7 Hard caps (margin guarantee — non-negotiable per roadmap §6)

| Cap | Where measured | Trip action |
|---|---|---|
| 15 turns | counted on each STT-final event | publish `cap_warning` at 13; on 16th, publish `session_closed{reason:'cap'}`, close room |
| 3 min cumulative voice (Gemini Live audio in+out seconds) | metered against cost ledger | same — close room with `reason:'cap'` |
| 25 min wall-clock since session_open | timer | same — close room with `reason:'cap'` |

No bypass flag, no merchant override. Roadmap §6 invariant. Caps logic is shared with Plan 4's `caps.ts` (now `@shoppingmate/agent/caps`); voice-agent applies the same module to its turn/audio counters.

### 5.8 Persona voicing — 8 personas, descriptor-driven

Persona is read once at session-open from `merchant.config.persona_id` (default: `sage`). voice-agent passes:

```ts
geminiSession.open({
  voiceId: persona.voice.geminiVoiceId,
  systemInstruction: [
    persona.systemPromptFragment,                              // existing Plan 4 persona text
    `Voice cadence: ${persona.voice.descriptor}`,              // new Plan 6 line
    'Never speak numeric prices. Paraphrase and refer to what is on screen.',
  ].join('\n\n'),
});
```

The 8 personas (already in Plan 4): `sage` (default), `harper`, `nova`, `atlas`, `ember`, `iris`, `kai`, `ren`. Plan 6 ships one Gemini voice mapping per persona. A/B between two personas on the demo store is an acceptance task; full A/B framework is roadmap §6 non-goal.

**Defense-in-depth on numeric prices:** the instruction lives in two places — Plan 4's `stripPrices()` post-processor strips numerics from Sonnet's `say` text before it ever reaches voice-agent, AND Gemini Live's system instruction tells the model not to speak numerics if any leak through. A unit test asserts no numeric price reaches `geminiSession.speak()` by construction.

### 5.9 Widget ↔ LiveKit (lazy-load + fallback)

- Initial widget bundle does NOT include `livekit-client`. Build script greps `dist/v1.js` for the literal string `livekit-client` and fails CI if found.
- `voiceModeLiveKit.start()` does:
  ```ts
  // Exact version pinned at build time via env (e.g. @2.5.7). Never floating range.
  const { Room } = await import(/* webpackIgnore: true */ `${LIVEKIT_CDN_BASE}/livekit-client@${LIVEKIT_CLIENT_VERSION}/dist/livekit-client.esm.min.js`);
  ```
- Self-hosted on `cdn.shoppingmate.ai/vendor/` (Q2 = A) — no third-party CDN dependency in the production hot path. Operator publishes one extra file per pinned version at deploy time. Version bumps are deliberate plan items, not floating.
- Lazy-load failure (network, CSP, CDN down) → widget calls `onLazyLoadFailed()` → `voiceModeFactory` returns null → UI surfaces "Voice unavailable — switching to chat" toast → chat mode opens via existing WS path.
- First-call cold latency target: ≤ 500 ms (lazy-load + connect + Gemini session pre-warm). Subsequent calls in the same browser session: ≤ 150 ms (SDK cached, room state warm).

### 5.10 Fallback chain — every failure has a defined path

| Failure | Detection | User experience |
|---|---|---|
| LiveKit Cloud unreachable | widget's `Room.connect()` rejects within 5 s | toast: "Voice unavailable — switching to chat", widget enters chat mode via existing WS path |
| `livekit-client` lazy-load fails | dynamic-import rejects | same toast, same fallback |
| Gemini Live session errors mid-call | voice-agent catches, publishes `session_closed{reason:'error'}`, closes room | widget shows "Sage hit a snag — let's continue in chat", switches to chat mode mid-conversation; transcript is preserved (Plan 4 session resume) |
| Mic permission denied | widget catches `NotAllowedError` before LiveKit connect | call button disables, chat opens automatically; one-time hint: "We need mic access for voice. You can still chat with Sage." |
| Sonnet `runTurn` errors (Plan 4 path) | voice-agent catches, falls back to Gemini speaking a fixed apology line | "Sorry, I'm having trouble — try once more?" (no Sonnet retry inside voice path; user retry is the retry) |
| voice-agent process crashes | LiveKit room emits `participant_disconnected` for bot peer; widget shows "reconnecting"; supervisord restarts voice-agent within 5 s; widget retries connect once | one beat of dead air, then resumes |

No silent degradation. Every failure either recovers or surfaces a visible chip. Telemetry on every branch: `voice.fallback_to_chat{reason}`, `voice.barge_in_succeeded`, `voice.cap_tripped{cap}`, `voice.session_resume_via_chat`.

## 6. Plan 4-bis — Gemini Live cost pilot

A separate deliverable from the code, but owned by Plan 6's acceptance gates. Per ADR-0001 §4 and the viability RED:

- **Setup:** stand up one staging dev-store with the full Plan 6 stack live. Provision a "pilot" LiveKit project + Gemini API key with billing visible.
- **Run:** 100 production-shaped voice conversations against this store. Karan + 2 contractors hold real conversations with varied length and tool flows: greet-only, recommend-only, full purchase, cart-then-abandon, barge-in heavy, persona switches.
- **Measure:** for each conv, capture `gemini_audio_input_seconds`, `gemini_audio_output_seconds`, `sonnet_input_tokens`, `sonnet_output_tokens`, `livekit_minutes_billed`. Compute $/conv from current public pricing. Captured by `apps/voice-agent/src/metrics.ts` and exported to S3.
- **Report:** memo at `docs/strategy/<YYYY-MM-DD>-gemini-live-cost-pilot.md` (date filled in when pilot completes) with: mean $/conv, 95% CI, distribution by conv length, voice-only vs voice-with-tools breakout, projected $/conv at the 3-min cap. Compare to ADR-0001 §3's $0.018 estimate. Per-plan margin-floor check (Starter through Pro) including the voice-fairness surcharge.
- **Halt condition:** if the upper bound of the 95% CI breaches the §5.4 margin floor on any plan including the surcharge, **HALT seed close** and trigger the cost-cut playbook before adding more merchants.
- **Owner:** Karan; voice-agent ships `scripts/pilot-replay.ts` which replays a recorded LiveKit room from S3 against Gemini Live so the cost is reproducible (audit trail).

This pilot is the seed-close gate. No clever mitigation, no estimation — measured number from real traffic only.

## 7. What this plan does NOT include (defer list)

- **LiveKit self-host** — Cloud-only for v0.1; revisit at ~500 paying merchants (ADR-0001 §3 risks).
- **Brand-tuned voice cloning** ($99/mo upsell) — parked until Gemini's voice-clone surface matures (ADR-0001 §3 + roadmap §8).
- **Multi-language voice** — English-only in v0.1 (roadmap §6 + §8).
- **A/B testing of personas** — manual A/B on demo store only; framework is roadmap §6 non-goal.
- **Conversion attribution** — Plan 7 owns it; voice-agent emits the same `checkout_redirect` event the chat path does, no special voice-attribution code.
- **Dashboard surfacing of voice analytics** — Phase 2.
- **CDN deployment of `livekit-client`** — operator/infra. Plan 6 names the URL; the upload is out of scope.
- **Brand KB-aware system prompt** — Phase 2 owns Brand KB upload + injection.

## 8. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Gemini Live $/conv exceeds margin floor (the RED) | Medium | High | Plan 4-bis pilot is the gate. If breached: shorten cap to 2 min voice, raise voice-fairness surcharge, or drop to Gemini Flash + ElevenLabs hybrid (new ADR). |
| LiveKit Cloud regional outage | Low | High | Fallback to chat is automatic + visible. Voice unavailable ≠ widget broken. |
| `livekit-client` SDK breaking change between minor versions | Medium | Medium | Pin to exact version in the lazy-load URL; CI runs against pinned. Upgrade is a deliberate plan item. |
| Bridge logic swallows say events between Gemini and Sonnet | Medium | High | Bridge has a single `onEvent` switch with exhaustive `assertNever` (same pattern as Plan 4 dispatcher). Test asserts every event type takes a path. |
| Persona voice descriptors don't render distinctly enough on Gemini's prebuilt voice library | Medium | Low | A/B on demo store at acceptance; if two personas are indistinguishable, ship as "voice variant A/B" until the brand-tuned upsell ships. |
| Bundle size regression from voice changes | Low | Medium | Build asserts ≤120 KB gzip + greps for `livekit-client` in `dist/v1.js`. CI fails on either. |
| Cost-pilot recordings leak PII (visitor voice) | Medium | High | Pilot recordings stored in S3 with merchant-scoped IAM; deleted 30 d after pilot memo published. Documented in pilot runbook. |
| Voice-agent process holds zombie Gemini sessions on crash | Medium | Medium | Each session opens with a 30-min hard TTL inside Gemini's API; supervisord restart picks up clean state. |
| Numeric price leaks past `stripPrices()` AND Gemini's instruction | Very low | High | Unit test asserts no numeric in `geminiSession.speak()` input by construction (regex check on every call). Test fails the build. |
| Double caps (Plan 4 + voice-agent both enforce) | Low | Low | Plan 4's caps run inside `runTurn`; voice-agent's caps wrap session-level (audio seconds + wall-clock). Different axes, no conflict; documented in `caps.ts` comments. |

## 9. Testing strategy

**Unit (vitest, no LiveKit / no Gemini network):**
- `bridge.test.ts` — STT-final → mocked `runTurn` → say events route to mocked Gemini TTS + mocked data channel in correct order. Includes barge-in path: visitor activity mid-TTS → `interrupt()` called, queued say tail dropped.
- `persona.test.ts` — all 8 personas resolve to a non-empty `geminiVoiceId` + `descriptor`; system instruction always contains the price-paraphrase line.
- `dataChannel.test.ts` — say/cards/checkout_redirect/cap_warning serialize round-trip against `@shoppingmate/agent`'s `events.ts` shape guards.
- `geminiSession.test.ts` — open/finalize/interrupt/close lifecycle against a mocked Gemini Live transport. Asserts no numeric price ever passed to `geminiSession.speak()` (defense-in-depth invariant).
- `caps.test.ts` (in `apps/voice-agent/`) — 13th turn emits cap_warning, 16th emits session_closed; 3-min audio cumulative trips identically; 25-min wall-clock trips identically.

**Integration (Node, mocked LiveKit + mocked Gemini):**
- `agentWorker.integration.test.ts` — full job lifecycle: simulated Room join → bridge wired → 3-turn fixture conversation → cards event → checkout_redirect → session_closed. Same recorded-fixture pattern Plan 4 uses for `runtime.test.ts`.

**Widget (vitest + happy-dom, mocked LiveKit room):**
- `voiceModeLiveKit.test.ts` — start/stop/speak/setMuted call into a mocked `Room`; state transitions match the existing voiceMode contract; failure paths fall back to chat (4 fallback modes covered).
- `voiceModeFactory.test.ts` — picks LiveKit by default; honors `VITE_VOICE_STACK=web-speech` override; LiveKit dynamic-import failure → falls back to chat mode (NOT to Web Speech in production; the Web Speech impl stays for dev only).

**No real-browser E2E in Plan 6.** The Plan 4-bis cost pilot is the live integration test. Plan 7 adds Playwright once conversion attribution gives a meaningful end-to-end signal.

**Plan 4 regression guard:** the extraction `apps/api/src/agent/` → `packages/agent/` must pass all 360 existing tests with zero modification beyond import paths. CI fails if any test diff includes anything other than `from '@shoppingmate/agent'` swaps.

## 10. Acceptance gates

Plan 6 is **code-complete** when:

1. `pnpm typecheck` clean across all 11 workspaces (9 existing + new `@shoppingmate/voice-agent` + new `@shoppingmate/agent`).
2. `pnpm test` all green; ≥40 new tests across voice-agent + widget + agent persona extension; Plan 4's 360 tests preserved unchanged.
3. `pnpm lint` reports only the 4 pre-existing slack-workstream errors.
4. `pnpm --filter @shoppingmate/widget build` produces `dist/v1.js` ≤120 KB gzip; `livekit-client` confirmed absent from the bundle (build script greps and fails if found).
5. `pnpm --filter @shoppingmate/voice-agent build` produces a runnable `dist/index.js`; `pnpm --filter @shoppingmate/voice-agent dev` connects to LiveKit Cloud staging and registers as a worker (smoke).
6. Roadmap §9 Plan 6 row marked ✅ Complete with commit references.
7. Memory `project_shoppingmate_phase1_status.md` updated.
8. Tag `phase1-plan6-voice-stack-complete` created.

Plan 6 is **release-ready** (gates the seed close) when, additionally:

9. **Live smoke** — Karan holds a complete voice conversation against a Plan 6 staging stack: greet → product Q&A → cart build → coupon apply → checkout redirect, with at least one mid-turn barge-in and one persona switch (`sage` → `harper`). No numeric prices spoken (transcript review).
10. **Plan 4-bis pilot complete** — 100-conv pilot run, memo published at `docs/strategy/<YYYY-MM-DD>-gemini-live-cost-pilot.md` (date set when pilot completes), $/conv 95% CI upper bound clears the §5.4 margin floor on every plan including the voice-fairness surcharge. Memory entry `project_gemini_live_cost_pilot_result.md` written.

Gates 9–10 are deferrable to operator (same pattern as Plans 1–5 deferred acceptance), but **must complete before Phase 2 starts** and **must complete before seed term sheet signing**.

## 11. Sequencing — phases

10 phases, ~38 tasks total. Each phase ends with `pnpm typecheck && pnpm test` green and a commit.

- **Phase A — Extract `packages/agent/`** (5 tasks): create workspace, move files, rewrite imports across `apps/api/`, update `tsconfig.references`, all 360 tests stay green. **Zero behavior change.** Tag `phase1-plan6-phaseA-agent-extracted`.
- **Phase B — Persona voice descriptors** (3 tasks): extend `Persona` type with `voice` field, add Gemini voice mapping for all 8 personas, update persona tests.
- **Phase C — `apps/voice-agent/` scaffolding** (4 tasks): workspace + tsconfig + vitest + Dockerfile stub, env validation, dependency on `@shoppingmate/agent` + `@livekit/agents` + `@google/generative-ai` (Live SDK), package.json scripts (`dev`, `build`, `test`).
- **Phase D — Gemini Live session wrapper** (3 tasks): `geminiSession.ts` with open/speak/interrupt/close + tests against mocked transport.
- **Phase E — The bridge** (4 tasks): `bridge.ts` wiring STT-final → `runTurn` → say-routing → TTS, including barge-in handler. Most novel code, biggest test surface.
- **Phase F — Data channel + LiveKit Agents worker** (3 tasks): `dataChannel.ts` event publisher, `agentWorker.ts` JobContext handler, integration test against mocked Room.
- **Phase G — Caps + metrics** (3 tasks): caps enforcement (turns / voice-seconds / wall-clock), `metrics.ts` ledger entries for the cost pilot.
- **Phase H — `POST /v1/voice/token` route in apps/api** (3 tasks): route handler, LiveKit JWT minting, origin/session checks, tests.
- **Phase I — Widget integration** (5 tasks): `transport/livekit.ts` wrapper, `voiceModeLiveKit.ts`, `voiceModeFactory.ts`, `bootstrap.ts` mints voice token, `ui/call.ts` wires to factory. Bundle-size assertion stays at <120 KB gzip; `livekit-client` must NOT be bundled. Fallback-to-chat tests cover all four failure modes from §5.10.
- **Phase J — Cost pilot prep + acceptance close** (5 tasks): `pilot-replay.ts` script, pilot runbook at `docs/runbooks/gemini-live-cost-pilot.md`, roadmap §9 update, memory `project_shoppingmate_phase1_status.md` update, tag `phase1-plan6-voice-stack-complete`. The pilot itself is operator work (Karan + contractors), tracked separately as a deferred-acceptance task.

## 12. Source documents

- **Roadmap (this plan's parent):** `docs/superpowers/roadmap.md` §4 Phase 1 + §9 Plan 6
- **ADR (the source of truth for the voice-stack choice):** `docs/adr/2026-05-01-voice-stack-livekit-gemini-live.md`
- **Plan 5 spec (the widget shell this plan extends):** `docs/superpowers/specs/2026-05-04-phase1-plan5-widget-shell-design.md`
- **Plan 4 spec (the runtime this plan reuses):** `docs/superpowers/specs/2026-05-04-phase1-plan4-agent-runtime-design.md`
- **Phase 1 spec (overarching):** `docs/superpowers/specs/2026-04-30-shoppingmate-phase1-design.md`
- **Strategy (margin floor §5.4):** `docs/strategy/2026-05-01-shoppingmate-strategy.md`
- **Viability (the RED on Gemini Live cost):** `docs/strategy/2026-05-01-shoppingmate-viability-analysis.md`
- **Operating model (Slack-as-OS, where margin alerts page):** `docs/operating-model.md`
