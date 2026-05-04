# Gemini Live Cost Pilot — Runbook

**Purpose:** Produce measured $/conv with 95% CI for the Gemini Live + LiveKit voice stack. Gates the seed close per ADR-0001 §4.

## Setup

1. Stand up staging dev-store with the full Plan 6 stack:
   - `apps/api` running with `/v1/voice/token` route live (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` set).
   - `apps/voice-agent` registered as a LiveKit Agent worker (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `GEMINI_API_KEY`, `GEMINI_LIVE_MODEL=gemini-2.5-flash-live`).
   - Widget bundle deployed to staging CDN; `livekit-client` lazy-loaded from `cdn.shoppingmate.ai/vendor/livekit-client@2.7.0/...`.
   - Gemini API key + LiveKit project keys with billing visible in their consoles.
2. Seed staging Postgres with one demo merchant (`SM-PILOT0`) + ~100 catalog items + `personaId='concierge'`.
3. Confirm the widget connects, voice handoff works end-to-end (mic → Gemini STT → Sonnet → Gemini TTS → speaker).

## Pilot run

Hold 100 voice conversations against the staging widget. Mix:

- 25 greet-only (≤2 turns, ≤30s)
- 25 recommend-only (3–5 turns, ≤60s)
- 25 full purchase flow (end at `checkout_redirect`, ≤120s)
- 15 cart-then-abandon (≤90s)
- 10 barge-in heavy (interrupt agent multiple times)

Recorders: Karan + 2 contractors. Use a worksheet to log conversation type + observed quality (1–5).

## Capture

Each conversation triggers `metrics.flush()` on disconnect → ledger entry to stdout (operator pipes to S3). Schema:

```json
{
  "sessionId": "ws_xxx",
  "merchantId": "SM-PILOT0",
  "counters": {
    "gemini_audio_input_seconds": 8.2,
    "gemini_audio_output_seconds": 14.7,
    "sonnet_input_tokens": 420,
    "sonnet_output_tokens": 95
  },
  "flushedAt": 1715000000000
}
```

Save raw stdout as `pilot-2026-05-XX/raw-ledger.ndjson` in S3.

## Compute $/conv

For each ledger entry:

- `gemini_audio_cost = (input_seconds + output_seconds) * GEMINI_LIVE_PRICE_PER_SECOND`
- `sonnet_cost = input_tokens * SONNET_INPUT_PRICE + output_tokens * SONNET_OUTPUT_PRICE`
- `livekit_cost = LIVEKIT_PRICE_PER_MIN * room_minutes`
- `conv_cost = gemini_audio_cost + sonnet_cost + livekit_cost`

Use current public pricing (verified on the day of analysis from each vendor's pricing page).

## Reproducing a single conversation

If a conversation looks anomalous (high cost, weird transcript), reproduce it deterministically with the replay script:

```bash
pnpm tsx apps/voice-agent/scripts/pilot-replay.ts ./recordings/ws_xxx.json
```

Recording schema:

```json
{
  "sessionId": "ws_xxx",
  "merchantId": "SM-PILOT0",
  "personaId": "concierge",
  "turns": [{ "user_text": "looking for a moisturizer for dry skin" }, ...]
}
```

The script opens a fresh Gemini Live session, replays each turn through `createBridge`, and flushes a new ledger entry — useful for verifying that a fix moved the cost the way you expected.

## Memo

Write `docs/strategy/<YYYY-MM-DD>-gemini-live-cost-pilot.md` with:

- Mean $/conv ± 95% CI
- Distribution histogram by conv length (10s buckets)
- Voice-only vs voice-with-tools breakout
- Projected $/conv at the 3-min cap (worst case)
- Per-plan margin-floor check (Starter through Pro), including voice-fairness surcharge
- Comparison to ADR-0001 §3's $0.018 estimate

## Halt condition

If 95% CI upper bound breaches the §5.4 margin floor on ANY plan including the surcharge, **HALT seed close** and trigger the cost-cut playbook. No exec override.

## Cleanup

After the memo is published:

- Save raw ledger entries to S3 under `pilot-2026-05-XX/` for audit.
- Delete pilot LiveKit recordings within 30 days.
- Update memory `project_gemini_live_cost_pilot_result.md` with the headline number + decision.
