# Nav PRD Phase 0 — Baseline & instrumentation (plan)

PRD: `docs/superpowers/specs/2026-10-06-smart-site-navigation-and-case-capture-prd.md` § Phase 0.

## Tasks
1. `packages/agent/src/runtime.ts` — enrich the existing `agent.tool.invoked` metric (single shared chokepoint for text WS + voice bridge) via a pure helper `toolTelemetryTags(envelope, channel, hostActionType)`: `channel` (adapter|host|server), `actionType`, `failReason`, `verified` (pass-through once the widget reports it in Phase 1), `resultChars`, `resultTokensEst`.
2. Same file — emit `agent.turn.completed` `{mode, model, latencyMs, llmCalls, toolCalls}` fire-and-forget before `end_of_turn` (no added latency).
3. Tests in `runtime.test.ts`: helper unit tests + a runTurn test asserting both metrics.
4. `apps/api/scripts/nav-baseline.mjs` — aggregates metric_events for a tenant (tool ok%/p50/p95/payload/verified, host-action G1 rate, top failures, turn latency by mode).
5. `apps/api/scripts/nav-bench.mjs` — repeatable scripted WS bench (fixed Calmosis turns, simulated widget host results), because real Calmosis traffic is too thin for a statistically useful baseline (22 tool calls / 30 days).
6. Deploy api, run bench, confirm new tags land in prod metric_events.

## Known gap
Voice fast-path dispatches in `apps/voice-agent/src/agentWorker.ts` (direct `dispatchHostAction` calls that bypass `runTurn`) are not tagged. Voice tool calls routed through `runTurn` are. Revisit in Phase 1 if voice nav actions matter for G1.
