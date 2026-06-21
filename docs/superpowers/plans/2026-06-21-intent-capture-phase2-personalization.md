# Intent Capture — Phase 2: Cross-Session Personalization

> **For agentic workers:** execute task-by-task (subagent-driven). TDD where a pure function exists.

**Goal:** A returning visitor's profile is loaded at session start and baked into the system instruction (voice) + system prompt (text), so the bot opens already knowing who they are and what they came for.

**Architecture:** Profile is loaded ONCE at session start (not per turn), summarized by a pure `buildVisitorSummary`, and injected into the prompt builders. The text WS gains a `visitorId` (plumbed via the `user_text` frame) so it can BOTH read and write profiles — Phase 1 deferred the text-path upsert; Phase 2 enables it. This also makes the full returning-visitor loop testable headlessly.

**Tech stack:** TS monorepo, Gemini Live (voice systemInstruction), OpenRouter (text), Drizzle/Postgres.

Terrain (verified file:line):
- `buildVoiceSystemInstruction(persona, brand?, opts)` `packages/agent/src/prompts/voice-instructions.ts:54`; opts `VoiceInstructionOpts` lines 42-52; sections concat ~line 70-92; voice call site `apps/voice-agent/src/agentWorker.ts:329` via `resolveVoiceContext` (`apps/voice-agent/src/persona.ts:30`); `session.visitorId` available (`agentWorker.ts:313`).
- `buildSystemPrompt(merchant, opts)` `packages/agent/src/prompts/system.ts:33`; `SystemPromptOpts` lines 8-19; called `packages/agent/src/runtime.ts:227,286`; `promptOpts = await deps.loadPromptOpts(merchant)` `runtime.ts:155`; impl `apps/api/src/index.ts:341`.
- Text WS `onMessage(sessionId, merchantId, raw, send)` (`apps/api/src/ws/agent.ts:16`); text session created `apps/api/src/index.ts:206-217` (no visitorId); `SessionState.visitorId?` `packages/agent/src/types.ts:70`.
- `ProfileRow` `packages/db/src/repos/visitorProfileRepo.ts:6-12`; `loadVisitorProfile(merchantId, visitorId)`, `upsertVisitorProfile(...)`.
- Widget already computes `visitorId` (`packages/widget/src/bootstrap.ts:69`) and sends it to `/v1/voice/token` but NOT to text frames.

---

### Task 1: `buildVisitorSummary` pure function

**Files:** Create `packages/agent/src/visitor-summary.ts` + `.test.ts`; export from `packages/agent/src/index.ts`.

Imports `ProfileRow` from `@shoppingmate/db` (agent already depends on db). Returns a compact (<~90 word) summary string for prompt injection, or `''` when `profile` is null or `sessionCount < 1` (so first-time visitors add nothing).

```ts
import type { ProfileRow } from '@shoppingmate/db';

const money = (cents: number) => (cents > 0 ? `₹${Math.round(cents / 100)}` : null);

// Compact returning-visitor brief baked into the system prompt/instruction.
// Empty string for unknown/first-time visitors so nothing is injected.
export function buildVisitorSummary(profile: ProfileRow | null): string {
  if (!profile || profile.sessionCount < 1) return '';
  const id = profile.identity ?? {};
  const bits: string[] = [];
  const who = id.name ? `${id.name}${id.city ? ` from ${id.city}` : ''}` : 'A returning visitor';
  bits.push(`${who} (visit #${profile.sessionCount + 1}).`);
  if (profile.topIntents.length) bits.push(`Past intent: ${profile.topIntents.slice(0, 3).join(', ')}.`);
  if (profile.needs.length) bits.push(`Cares about: ${profile.needs.slice(0, 4).join(', ')}.`);
  if (profile.productsOfInterest.length) bits.push(`Looked at: ${profile.productsOfInterest.slice(0, 4).join(', ')}.`);
  if (profile.objections.length) bits.push(`Hesitations: ${profile.objections.slice(0, 3).join(', ')}.`);
  if (profile.lastOutcome) bits.push(`Last time they ${profile.lastOutcome}${profile.lastDropStage ? ` (stopped at ${profile.lastDropStage})` : ''}.`);
  const ltv = money(profile.lifetimeValueCents);
  if (ltv) bits.push(`Lifetime spend ${ltv}.`);
  return bits.join(' ');
}
```

Test (`visitor-summary.test.ts`): (a) null → `''`; (b) sessionCount 0 → `''`; (c) a full profile → string contains the name, an intent, and the last outcome. Run: `npx vitest run packages/agent/src/visitor-summary.test.ts`.

---

### Task 2: bake summary into VOICE instruction

**Files:** `packages/agent/src/prompts/voice-instructions.ts` (+ existing test file if present).

Add `visitorSummary?: string` to `VoiceInstructionOpts`. In the section-assembly array, when `opts.visitorSummary` is non-empty, insert a section RIGHT AFTER the guardrails section (so it's high-priority context the bot opens with):
```
RETURNING VISITOR — personalize warmly, do not re-ask what you already know:
${opts.visitorSummary}
```
Add/extend a unit test asserting the returned instruction includes the summary text when provided, and does not include the "RETURNING VISITOR" header when `visitorSummary` is absent/empty.

---

### Task 3: bake summary into TEXT prompt

**Files:** `packages/agent/src/prompts/system.ts` (+ test).

Add `visitorSummaryText?: string` to `SystemPromptOpts`. Insert, when non-empty, a section near the top of the prompt (after the brand summary, before the KB slot):
```
RETURNING VISITOR — personalize warmly, do not re-ask what you already know:
${opts.visitorSummaryText}
```
Unit test: prompt includes the summary when provided; absent when empty.

---

### Task 4: plumb `visitorId` through the text WS

**Files:** `packages/agent/src/types.ts` (WidgetMessage user_text), `packages/agent/src/events.ts` (decode), `apps/api/src/index.ts` (createSession), widget send sites (`packages/widget/src/**` where `user_text` is sent).

- Add optional `visitorId?: string` to the `user_text` `WidgetMessage` variant and ensure `decodeWidgetMessage` preserves it.
- In `apps/api/src/index.ts` where the text session is created (`createSession({sessionId, merchantId, mode, nowMs})`, ~line 211), pass `visitorId: msg.visitorId` (msg is the user_text frame). So `session.visitorId` is set for text.
- Widget: include `visitorId` (from `getOrCreateVisitorId()`) in every `user_text` frame it sends. Find the widget's send-user-text path and thread the already-known visitorId in.
- TDD the decode: a `user_text` frame with `visitorId` decodes with it preserved; without it still decodes (optional).

---

### Task 5: load profile at session start + enable text upsert

**Files:** `apps/voice-agent/src/agentWorker.ts`, `apps/voice-agent/src/persona.ts`, `apps/api/src/index.ts`, `packages/agent/src/runtime.ts`.

VOICE:
- In `agentWorker.ts` before the `resolveVoiceContext` call (~line 329): if `session.visitorId`, `const vp = await loadVisitorProfile(merchant.id, visitorId); const visitorSummary = buildVisitorSummary(vp);` (best-effort, wrap in try/catch → ''). Log `personalization: returning visitor` when `vp` found (sessionCount).
- Thread `visitorSummary` through `resolveVoiceContext` → `buildVoiceSystemInstruction` opts.

TEXT:
- In `apps/api/src/index.ts`: change `loadPromptOpts(merchantId)` to also accept `visitorId?: string` and, when present, `loadVisitorProfile` + `buildVisitorSummary` → return `visitorSummaryText`. Update the `deps.loadPromptOpts` wiring so `runtime.ts` passes `session.visitorId`. In `runtime.ts:155`, change `deps.loadPromptOpts(merchant)` → `deps.loadPromptOpts(merchant, session.visitorId)` and update the `RunTurnDeps` type. (Loads once per turn — acceptable; one indexed query.)
- Enable the deferred text-path upsert: in the `session_end` handler (`apps/api/src/index.ts` ~line 159), after the profiler resolves, if `session?.visitorId` (load session before deletion OR capture visitorId when recorder is created), call `upsertVisitorProfile(merchantId, visitorId, record, {outcome, attributedCents})`. NOTE: the session is `redis.del`'d at the top of session_end — capture `visitorId` BEFORE deletion (load the session first, read visitorId, then proceed). Update the Phase 1 deferral comment.

Builds: `pnpm --filter @shoppingmate/api... --filter @shoppingmate/voice-agent... build`.

---

### Task 6: deploy + PROVE with logs (headless returning-visitor loop)

- Apply nothing new to DB (no schema change). Deploy api + voice-agent (`railway up --service ...`). Rebuild + deploy widget/web (Vercel) so the text frames carry visitorId.
- Proof script `apps/api/scripts/prove-personalization-prod.mjs`: pick a fixed `visitorId`. (1) Run text convo #1 with clear intent/identity → session_end → poll prod DB until a `visitor_profiles` row exists for that visitor. (2) Run text convo #2 as the SAME visitorId → assert the bot's first reply shows returning-visitor awareness AND/OR read the prod log line. (3) Print the visitor_profiles row + both conversationCompleted intents. Success = profile row written by text path (proves Task 5 upsert) + sessionCount increments to 2 (proves merge across text sessions) + personalization present in convo #2.
