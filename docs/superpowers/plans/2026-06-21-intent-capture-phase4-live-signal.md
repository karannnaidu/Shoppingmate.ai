# Intent Capture — Phase 4: Live In-Session Signal

**Goal:** A lightweight classifier runs DURING a conversation and emits a live signal (intent, urgency, top objection, named need) that steers the next turn (voice + text), plus an event-driven spoken nudge for voice on a strong signal.

**Architecture:** After each user turn, a cheap LLM classifier runs over the conversation-so-far → a compact signal. The signal's steer line is stashed in `session.liveSignal` and injected into the next turn's system prompt (the existing per-turn prompt build), so the executor acts on it — same low-risk mechanism for voice and text. A pure `nextNudge` decision gates an at-most-once-per-N-turns spoken nudge via the existing voice grounding channel (`ground()`/`gemini.speak`), **behind env flag `LIVE_NUDGE_ENABLED` (default off)** to protect the live bot until a human voice test passes. Everything best-effort (try/catch) — a classifier failure NEVER breaks a turn.

**Tech stack:** OpenRouter cheap `chat()` (json, maxTokens 256), Gemini Live `speak`, drizzle session in Redis.

Verified hooks (file:line): text turn loop `apps/api/src/index.ts:334-346` (`recorder.addTurn('user')` + `runTurn` loop); `recorder.snapshot(): TranscriptTurn[]`; `SessionState` `packages/agent/src/types.ts:58-85` (add `liveSignal?`); per-turn prompt build `packages/agent/src/runtime.ts:288-291` (`buildSystemPrompt(merchant, promptOpts)` — runtime has `session`, so it can pass `liveSignal`); voice turn boundary `apps/voice-agent/src/agentWorker.ts:775-909` (final_transcript/bot_text); grounding `ground(instruction)` → `gemini.speak` `agentWorker.ts:615-616`; voice executor `apps/voice-agent/src/bridge.ts:98-161` (`handleUserText` → `runTurn`); cheap chat `packages/shared/src/openrouter.ts` `chat({model,messages,responseFormat,maxTokens})`. No existing signal plumbing (additive).

---

### Task 1: live-signal classifier + nudge decision (pure-ish) + tests

**Files:** Create `packages/agent/src/live-signal.ts` + `live-signal.test.ts`; export from `packages/agent/src/index.ts`.

```ts
import type { ChatFn } from './checkout-extract.js';

export type LiveSignal = {
  intent: string;
  urgency: 'low' | 'medium' | 'high';
  objection: string | null;
  need: string | null;
};

const EMPTY: LiveSignal = { intent: 'browsing', urgency: 'low', objection: null, need: null };

const SYS = `You read the LAST few turns of a live shopping chat and output ONE compact JSON object: {intent, urgency, objection, need}.
- intent: short tag for what they want right now (e.g. browsing, comparing, ready_to_buy, price_check, support).
- urgency: "low" | "medium" | "high" — high = clear buy intent OR an active objection to resolve NOW.
- objection: the single biggest blocker they're voicing right now (e.g. price, delivery_time, trust, dosage), or null.
- need: the single concrete thing they want (a product, info, or outcome), or null.
Base it ONLY on the conversation. No prose, JSON only.`;

// Cheap per-turn classifier. Self-safe: returns a low-urgency empty signal on any failure.
export async function classifyLiveSignal(transcript: string, chat: ChatFn): Promise<LiveSignal> {
  try {
    const { text } = await chat([
      { role: 'system', content: SYS },
      { role: 'user', content: `Conversation so far:\n${transcript}\n\nReturn the JSON now.` },
    ]);
    const s = text.indexOf('{');
    const e = text.lastIndexOf('}');
    if (s < 0 || e <= s) return { ...EMPTY };
    const p = JSON.parse(text.slice(s, e + 1)) as Partial<LiveSignal>;
    const urgency = p.urgency === 'high' || p.urgency === 'medium' ? p.urgency : 'low';
    return {
      intent: typeof p.intent === 'string' && p.intent ? p.intent : 'browsing',
      urgency,
      objection: typeof p.objection === 'string' && p.objection ? p.objection : null,
      need: typeof p.need === 'string' && p.need ? p.need : null,
    };
  } catch {
    return { ...EMPTY };
  }
}

// Compact one-line steer for the next turn's system prompt. '' when nothing useful.
export function signalSteerLine(sig: LiveSignal): string {
  if (sig.urgency === 'low' && !sig.objection && !sig.need) return '';
  const bits = [`intent=${sig.intent}`, `urgency=${sig.urgency}`];
  if (sig.objection) bits.push(`objection=${sig.objection}`);
  if (sig.need) bits.push(`wants=${sig.need}`);
  return bits.join(' · ');
}

export type NudgeState = { lastNudgeTurn: number };
// Decide whether to fire ONE spoken nudge this turn. Fires only on a strong signal
// (high urgency with an objection, or high-urgency ready-to-buy) and at most once
// per 3 turns. Returns the line to speak, or null.
export function nextNudge(sig: LiveSignal, currentTurn: number, state: NudgeState): string | null {
  if (currentTurn - state.lastNudgeTurn < 3) return null;
  if (sig.urgency !== 'high') return null;
  if (sig.objection) return `The visitor has a live ${sig.objection} concern — address it head-on in one warm sentence and offer the next step.`;
  if (/buy|ready|purchase|checkout|order/i.test(sig.intent)) return `The visitor is ready to buy — proactively move them toward checkout now.`;
  return null;
}
```

Tests: classifyLiveSignal parses valid JSON (mock chat returning a json string) → fields; unparseable → EMPTY low. signalSteerLine: low+empty → ''; with objection → contains 'objection='. nextNudge: returns null within 3 turns of last; null when urgency!=='high'; returns objection line on high+objection past throttle; returns buy line on high ready_to_buy. Run `npx vitest run packages/agent/src/live-signal.test.ts`.

---

### Task 2: SessionState.liveSignal + prompt injection

**Files:** `packages/agent/src/types.ts`, `packages/agent/src/prompts/system.ts`, `packages/agent/src/prompts/voice-instructions.ts`, `packages/agent/src/runtime.ts`.

- `types.ts`: add `liveSignal?: string;` to `SessionState`.
- `system.ts`: add `liveSignal?: string;` to `SystemPromptOpts`; build `liveSignalBlock = opts.liveSignal?.trim() ? \`\nLIVE SIGNAL (this turn — act on it): ${opts.liveSignal.trim()}\n\` : ''` and interpolate it right AFTER the returningVisitorBlock in BOTH the non-demo prompt and the demo prompt (pass it into `demoSystemPrompt` like returningVisitorBlock).
- `voice-instructions.ts`: add `liveSignal?: string;` to `VoiceInstructionOpts`; push a `LIVE SIGNAL (act on it): ${opts.liveSignal}` section right after the returning-visitor section when non-empty.
- `runtime.ts`: at the `buildSystemPrompt(merchant, promptOpts)` call sites (the card-tap and user_text history builds), pass `{ ...promptOpts, liveSignal: session.liveSignal }` (runtime has `session`). Update both call sites.
- Extend system.test.ts + voice-instructions.test.ts with one assertion each: a `liveSignal` opt appears in output; absent when empty.

---

### Task 3: TEXT path — classify each turn, stash signal

**Files:** `apps/api/src/index.ts`.

- Build a module-scope `classifierChat: ChatFn` (mirror `profileChat`, `maxTokens: 256`).
- After the `runTurn` loop completes for a `user_text` turn (after line ~346), best-effort (try/catch, fire-and-forget is fine but must persist before next turn — do it awaited at end of handler OR set on session and `saveSession`): run `classifyLiveSignal(recorder.snapshot().map(t=>\`${t.role}: ${t.content}\`).join('\n'), classifierChat)`, compute `signalSteerLine`, set `session.liveSignal = steer` (or clear when ''), and `saveSession(redis, session)`. So the NEXT turn's prompt (built in runtime via session.liveSignal) carries it. Log `live signal` at info with the steer line when non-empty.
- Guard: only classify when there are ≥2 user turns (skip the very first). Keep it from blocking the response — classify AFTER events are sent to the user.

---

### Task 4: VOICE path — steer + (flagged) spoken nudge

**Files:** `apps/voice-agent/src/agentWorker.ts` (and/or `bridge.ts`).

- Build `classifierChat` (reuse `extractChat`'s model; maxTokens 256) — or reuse extractChat directly.
- After a full turn completes (after `recorder.addTurn('agent', clean)` / `bridge.noteAssistantTurn(clean)` in the bot_text handler), best-effort: classify on `recorder.snapshot()`, set `session.liveSignal = signalSteerLine(sig)` so the executor's next `runTurn` injects it (the bridge's session is the one runTurn reads). Keep a local `let liveTurn = 0; const nudgeState = { lastNudgeTurn: 0 }` incremented per completed turn.
- Spoken nudge (GATED): `if (process.env.LIVE_NUDGE_ENABLED === '1') { const n = nextNudge(sig, liveTurn, nudgeState); if (n) { nudgeState.lastNudgeTurn = liveTurn; ground(n); } }`. Default off → no behavior change to the live bot. Wrap everything in try/catch; a failure logs and is swallowed.
- If the simplest place to set `session.liveSignal` is inside `bridge.ts` (it owns the session passed to runTurn), do it there; otherwise ensure the session object the bridge uses gets the field before the next `handleUserText`.

Builds: `pnpm --filter @shoppingmate/agent build` then `pnpm --filter @shoppingmate/api... --filter @shoppingmate/voice-agent... build`.

---

### Task 5: deploy + PROVE

- Deploy api + voice-agent (Railway). `LIVE_NUDGE_ENABLED` left unset (nudge off).
- PROVE headless (text): a proof script drives a text conversation that first browses, then voices a clear objection ("that's too expensive"); assert that (a) after the objection turn the prod log / a returned debug shows `session.liveSignal` set with `objection=`, and (b) the bot's subsequent reply addresses the objection. Since session.liveSignal isn't directly observable via the WS, prove via: (1) unit tests (classifier + nudge gating + steer line), and (2) a live text convo where the bot demonstrably pivots to handle the stated objection after it's raised (capture replies). Optionally add a temporary debug: emit the steer line in a server log and grep it (the api logs `live signal`).
- Note in the proof output that the voice spoken-nudge path is built but FLAG-GATED (default off) pending a human voice smoke; the steering (prompt injection) is active for voice too.
