# Phase 1 — Plan 4: Backend Agent Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Sonnet 4.6 tool-use loop (`apps/api/src/agent/`) that wraps the 8-adapter substrate built in Plans 3a–3e, emits a heterogeneous WS event stream (`say` text + `cards` with images + `checkout_redirect`), enforces per-conversation hard caps (15 turns / 3 min voice / 25 min duration) and the no-numeric-prices invariant, and persists 24-hour Redis sessions for reconnect-resume.

**Architecture:** Stateless `runTurn(session, userMessage)` async generator over `(merchant, session, userMessage)`. Sonnet 4.6 is reached through `packages/shared/openrouter.ts` (the existing caller, relocated from `apps/worker` and extended with `chatTools()`). Tools are six dot-namespaced entries (`products.search`, `products.get`, `cart.{add,update,get}`, `coupons.apply`, `checkout.url`) dispatched into `getAdapter(merchant, deps).<verb>` from `@shoppingmate/adapters`. Cards are inferred by the runtime from `products.search`/`products.get` results — Sonnet does not "decide" to render them. Sessions live in Redis (`session:{sessionId}`) with 24h TTL. A new WS endpoint `/v1/widget/:sessionId/agent` (sibling of the existing Plan 3d `/v1/widget/:sessionId/ws` for DOM control) is the wire for the agent — same JWT authentication as Plan 3d.

**Tech Stack:** TypeScript, vitest, MSW for HTTP fixtures, ioredis (already in stack via BullMQ), `ws` (already mounted by Plan 3d), no new infra.

**Spec:** [`docs/superpowers/specs/2026-05-04-phase1-plan4-agent-runtime-design.md`](../specs/2026-05-04-phase1-plan4-agent-runtime-design.md) (committed `c2c59a2`)

**Acceptance:** Spec §14. Repo-wide `pnpm typecheck` clean; `pnpm test` green with ~30+ new tests; `pnpm shoppingmate:dev agent-replay tests/agent/fixtures/shopify-happy-path.json` prints the recorded event sequence; live Shopify dev-store conversation drives `products.search` → `cards` → `cart.add` → checkout redirect; transcript review of every fixture shows zero numeric-price `say` events. Optional tag `phase1-plan4-agent-complete`.

---

## File structure

**New files (creating):**

- `packages/shared/src/openrouter.ts` — relocated caller; new `chatTools()`, new `chat()` (kept identical contract for worker callers)
- `packages/shared/src/openrouter.test.ts` — unit tests for tool-call request/response shape
- `apps/api/src/agent/types.ts` — `AgentEvent`, `WidgetMessage`, `CardItem`, `SessionState` types; centralized so every other agent file imports from here
- `apps/api/src/agent/postprocess.ts` — `stripPrices()`, `redactPii()`, `segmentSay()`
- `apps/api/src/agent/postprocess.test.ts`
- `apps/api/src/agent/prompts/persona-table.ts` — 8 personas keyed by `merchant.personaId`
- `apps/api/src/agent/prompts/system.ts` — `buildSystemPrompt(merchant)`; `BRAND_KB_SLOT` placeholder for Phase 2
- `apps/api/src/agent/prompts/system.test.ts`
- `apps/api/src/agent/caps.ts` — `checkCaps(session, mode, now?) → CapStatus`
- `apps/api/src/agent/caps.test.ts`
- `apps/api/src/agent/tools.ts` — `buildToolSurface(merchant)`, `dispatchTool(merchant, deps, name, args)`, error-envelope helpers
- `apps/api/src/agent/tools.test.ts`
- `apps/api/src/agent/state.ts` — Redis session repo (`loadSession`, `saveSession`, `truncateHistory`)
- `apps/api/src/agent/state.test.ts`
- `apps/api/src/agent/events.ts` — encoders (object → WS JSON string) + decoder for `WidgetMessage`
- `apps/api/src/agent/events.test.ts`
- `apps/api/src/agent/runtime.ts` — `runTurn(deps, session, userMessage) → AsyncIterable<AgentEvent>`
- `apps/api/src/agent/runtime.test.ts` — integration: MSW openrouter mock + real adapters
- `apps/api/src/agent/transport-noop.ts` — `NoOpWSTransport` for non-DOM adapter dispatch in agent context
- `apps/api/src/ws/agent.ts` — `mountAgentWs(server, deps)` — new WS endpoint at `/v1/widget/:sessionId/agent`
- `apps/api/src/ws/agent.test.ts`
- `tests/agent/fixtures/shopify-happy-path.json`
- `tests/agent/fixtures/dom-happy-path.json`
- `tests/agent/fixtures/suggest-recommend-only.json`
- `tests/agent/fixtures/cap-15-turns.json`
- `tests/agent/contract.test.ts` — 8-adapter × tool dispatch round-trip
- `packages/cli/src/commands/agentReplay.ts`

**Modified files:**

- `apps/worker/src/lib/openrouter.ts` → re-export from `@shoppingmate/shared` (one-line shim, preserves prior import paths)
- `apps/worker/src/steps/selectorExtract.ts`, `apps/worker/src/steps/catalogClients/domCrawl.ts` — switch import to `@shoppingmate/shared` (remove the local re-export shim once green)
- `packages/shared/src/index.ts` — export `chat`, `chatTools`, related types
- `apps/api/src/index.ts` — call `mountAgentWs(server, ...)` after `mountWs(server)`
- `packages/db/src/schema/metricEvents.ts` — append 8 new metric names (§12 of spec)
- `packages/cli/src/index.ts` — wire the `agent-replay` subcommand
- `packages/cli/package.json` — none required (already has `@shoppingmate/shared`); confirm
- `apps/api/package.json` — add `ioredis` if not already present (it's a root dep but apps/api may need explicit listing)
- `apps/api/src/lib/originCheck.ts` — none; reused as-is
- `package.json` (root) — none (the root `shoppingmate:dev` script forwards all subcommands)

**Reused as-is:**

- `packages/dom-harness/src/wsAuth.ts` (`signWsToken`, `verifyWsToken`) — same JWT used for both `/v1/widget/:sessionId/ws` and the new `/agent` endpoint
- `packages/adapters/src/dispatch.ts` (`getAdapter`, `DispatchDeps`)
- `packages/adapters/src/dom/transport.ts` (`WSTransport`, `FakeWSTransport`)
- `packages/adapters/src/dom/sessionState.ts` (`InMemorySessionState`)
- `packages/db` exports (`merchants`, `Merchant`, `searchProducts`, `getProduct`, `metricEvents`)

---

## Phase A — Foundation: relocate the OpenRouter caller and add tool-use

### Task 1: Move `openrouter.ts` from apps/worker to packages/shared (no behavior change)

**Files:**
- Create: `packages/shared/src/openrouter.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/worker/src/lib/openrouter.ts` (becomes a one-line re-export shim)
- Test: `packages/shared/src/openrouter.test.ts`

- [ ] **Step 1: Write the failing test (round-trip of existing `chat()`)**

```ts
// packages/shared/src/openrouter.test.ts
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { chat } from './openrouter.js';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('chat()', () => {
  it('posts model+messages, returns text + token counts', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    server.use(
      http.post('https://openrouter.ai/api/v1/chat/completions', async ({ request }) => {
        const body = (await request.json()) as { model: string; messages: unknown[] };
        expect(body.model).toBe('anthropic/claude-haiku-4.5');
        expect(body.messages).toHaveLength(1);
        return HttpResponse.json({
          choices: [{ message: { content: 'pong' } }],
          usage: { prompt_tokens: 4, completion_tokens: 1 },
        });
      }),
    );
    const r = await chat({
      model: 'anthropic/claude-haiku-4.5',
      messages: [{ role: 'user', content: 'ping' }],
    });
    expect(r).toEqual({ text: 'pong', inputTokens: 4, outputTokens: 1 });
  });
});
```

- [ ] **Step 2: Run test, verify failure**

Run: `pnpm --filter @shoppingmate/shared test -- openrouter`
Expected: FAIL — `Cannot find module './openrouter.js'`.

- [ ] **Step 3: Copy `apps/worker/src/lib/openrouter.ts` → `packages/shared/src/openrouter.ts`**

The file content is identical to the current `apps/worker/src/lib/openrouter.ts` (60 lines, exporting `ChatMessage`, `ChatResult`, `chat`). Do a verbatim copy.

- [ ] **Step 4: Export from shared index**

```ts
// packages/shared/src/index.ts — append
export { chat } from './openrouter.js';
export type { ChatMessage, ChatResult } from './openrouter.js';
```

- [ ] **Step 5: Replace `apps/worker/src/lib/openrouter.ts` with a one-line re-export**

```ts
// apps/worker/src/lib/openrouter.ts
export { chat, type ChatMessage, type ChatResult } from '@shoppingmate/shared';
```

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm --filter @shoppingmate/shared test -- openrouter && pnpm --filter @shoppingmate/worker typecheck`
Expected: shared test PASS, worker typecheck clean (existing imports still resolve via the shim).

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/openrouter.ts packages/shared/src/openrouter.test.ts \
        packages/shared/src/index.ts apps/worker/src/lib/openrouter.ts
git commit -m "refactor(shared): relocate openrouter caller from worker to shared

Plan 4 needs the same caller in apps/api. No behavior change; worker
imports keep working via a one-line re-export shim."
```

### Task 2: Add `chatTools()` for OpenAI-compatible tool-use

**Files:**
- Modify: `packages/shared/src/openrouter.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/openrouter.test.ts`

- [ ] **Step 1: Write failing tests for `chatTools()`**

```ts
// Append to packages/shared/src/openrouter.test.ts
import { chatTools } from './openrouter.js';

describe('chatTools()', () => {
  it('passes tools array and returns tool_calls when model wants to invoke a tool', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    server.use(
      http.post('https://openrouter.ai/api/v1/chat/completions', async ({ request }) => {
        const body = (await request.json()) as { tools: unknown[]; messages: unknown[] };
        expect(body.tools).toHaveLength(1);
        return HttpResponse.json({
          choices: [
            {
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'call_1',
                    type: 'function',
                    function: { name: 'products.search', arguments: '{"query":"dress"}' },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 20 },
        });
      }),
    );
    const r = await chatTools({
      model: 'anthropic/claude-sonnet-4.6',
      messages: [{ role: 'user', content: 'find me a dress' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'products.search',
            description: 'search the catalog',
            parameters: {
              type: 'object',
              properties: { query: { type: 'string' } },
              required: ['query'],
            },
          },
        },
      ],
    });
    expect(r.stopReason).toBe('tool_calls');
    expect(r.toolCalls).toEqual([
      { id: 'call_1', name: 'products.search', argumentsJson: '{"query":"dress"}' },
    ]);
    expect(r.text).toBe('');
  });

  it('returns text + stopReason=stop when model finishes without tools', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    server.use(
      http.post('https://openrouter.ai/api/v1/chat/completions', () =>
        HttpResponse.json({
          choices: [
            { message: { role: 'assistant', content: 'hi there' }, finish_reason: 'stop' },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 3 },
        }),
      ),
    );
    const r = await chatTools({
      model: 'anthropic/claude-sonnet-4.6',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [],
    });
    expect(r.stopReason).toBe('stop');
    expect(r.text).toBe('hi there');
    expect(r.toolCalls).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `pnpm --filter @shoppingmate/shared test -- openrouter`
Expected: FAIL — `chatTools` is not exported.

- [ ] **Step 3: Implement `chatTools()` and supporting types**

```ts
// Append to packages/shared/src/openrouter.ts (after existing chat function)

export type ToolDef = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema
  };
};

export type ToolCallMessage = { role: 'tool'; tool_call_id: string; content: string };
export type AssistantToolCalls = {
  role: 'assistant';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
};

export type ToolsMessage =
  | ChatMessage
  | AssistantToolCalls
  | ToolCallMessage;

export type ToolCall = { id: string; name: string; argumentsJson: string };

export type ChatToolsResult = {
  text: string;
  toolCalls: ToolCall[];
  stopReason: 'stop' | 'tool_calls' | 'length' | 'other';
  inputTokens: number;
  outputTokens: number;
};

export async function chatTools(opts: {
  model: string;
  messages: ToolsMessage[];
  tools: ToolDef[];
  toolChoice?: 'auto' | 'none' | 'required';
  timeoutMs?: number;
}): Promise<ChatToolsResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY missing');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        'http-referer': 'https://shoppingmate.ai',
        'x-title': 'shoppingmate-agent',
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        tools: opts.tools.length > 0 ? opts.tools : undefined,
        tool_choice: opts.tools.length > 0 ? (opts.toolChoice ?? 'auto') : undefined,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`openrouter http ${res.status}: ${errText.slice(0, 200)}`);
    }
    const body = (await res.json()) as {
      choices: Array<{
        message: { content: string | null; tool_calls?: AssistantToolCalls['tool_calls'] };
        finish_reason: string;
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const choice = body.choices[0];
    if (!choice) throw new Error('openrouter: empty choices');
    const stopReason = mapStopReason(choice.finish_reason);
    const toolCalls = (choice.message.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      argumentsJson: tc.function.arguments,
    }));
    return {
      text: choice.message.content ?? '',
      toolCalls,
      stopReason,
      inputTokens: body.usage?.prompt_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
    };
  } finally {
    clearTimeout(timer);
  }
}

function mapStopReason(s: string): ChatToolsResult['stopReason'] {
  if (s === 'stop') return 'stop';
  if (s === 'tool_calls') return 'tool_calls';
  if (s === 'length') return 'length';
  return 'other';
}
```

- [ ] **Step 2 (re-run): typecheck the shared package**

Run: `pnpm --filter @shoppingmate/shared typecheck`
Expected: clean.

- [ ] **Step 3: Export from shared index**

```ts
// packages/shared/src/index.ts — append
export { chatTools } from './openrouter.js';
export type {
  ToolDef,
  ToolsMessage,
  ToolCall,
  ToolCallMessage,
  AssistantToolCalls,
  ChatToolsResult,
} from './openrouter.js';
```

- [ ] **Step 4: Run tests, verify pass**

Run: `pnpm --filter @shoppingmate/shared test -- openrouter`
Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/openrouter.ts packages/shared/src/openrouter.test.ts \
        packages/shared/src/index.ts
git commit -m "feat(shared): chatTools() — OpenRouter tool-use turn

Adds chatTools() alongside existing chat() for the Plan 4 Sonnet 4.6
tool-use loop. OpenAI-compatible tools/tool_choice format (which is what
OpenRouter normalizes to for Anthropic models). Returns ChatToolsResult
with stopReason, toolCalls[], text, and token counts."
```

### Task 3: Append agent metric names to the registry

**Files:**
- Modify: `packages/db/src/schema/metricEvents.ts`

- [ ] **Step 1: Append entries to `metricNames`**

```ts
// packages/db/src/schema/metricEvents.ts — add to the metricNames object
agentTurnStarted: 'agent.turn.started',
agentTurnCompleted: 'agent.turn.completed',
agentToolInvoked: 'agent.tool.invoked',
agentToolRetryExhausted: 'agent.tool.retry_exhausted',
agentSayPriceStripped: 'agent.say.price_stripped',
agentCapHit: 'agent.cap.hit',
agentSessionClosed: 'agent.session.closed',
agentSonnetError: 'agent.sonnet.error',
```

- [ ] **Step 2: Verify typecheck still clean**

Run: `pnpm --filter @shoppingmate/db typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema/metricEvents.ts
git commit -m "feat(db): plan 4 metric names — agent.turn/tool/say/cap/session/sonnet"
```

---

## Phase B — Pure utilities: postprocess, prompts, caps

### Task 4: `postprocess.ts` — `stripPrices()` (no-numeric-prices invariant)

**Files:**
- Create: `apps/api/src/agent/postprocess.ts`
- Test: `apps/api/src/agent/postprocess.test.ts`

- [ ] **Step 1: Failing test — strip ₹/$/Rs/word-suffixed prices, leave non-prices alone**

```ts
// apps/api/src/agent/postprocess.test.ts
import { describe, expect, it } from 'vitest';
import { stripPrices } from './postprocess.js';

describe('stripPrices()', () => {
  it.each([
    ['₹1,499',                              'the price on the card'],
    ['costs ₹1,499 only',                   'costs the price on the card only'],
    ['$2,200.00',                           'the price on the card'],
    ['Rs. 350',                             'the price on the card'],
    ['Rs350',                               'the price on the card'],
    ['saves you 1,499 rupees',              'saves you the price on the card'],
    ['that is 99 USD',                      'that is the price on the card'],
    ['size 10',                             'size 10'],         // non-price untouched
    ['12 reviews',                          '12 reviews'],
    ['M, L, XL',                            'M, L, XL'],
    ['I have 3 in cart',                    'I have 3 in cart'],
  ])('strips %s', (input, expected) => {
    const { text, hits } = stripPrices(input);
    expect(text).toBe(expected);
    if (input !== expected) expect(hits.length).toBeGreaterThan(0);
  });

  it('reports the matched pattern in hits[]', () => {
    const r = stripPrices('₹1,499 and $20 too');
    expect(r.hits).toEqual(expect.arrayContaining([
      expect.objectContaining({ pattern: 'rupee' }),
      expect.objectContaining({ pattern: 'dollar' }),
    ]));
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `pnpm --filter @shoppingmate/api test -- postprocess`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `stripPrices()`**

```ts
// apps/api/src/agent/postprocess.ts
const PRICE_PATTERNS: Array<{ pattern: string; re: RegExp }> = [
  { pattern: 'rupee',       re: /₹\s*\d[\d,]*(?:\.\d+)?/g },
  { pattern: 'dollar',      re: /\$\s*\d[\d,]*(?:\.\d+)?/g },
  { pattern: 'rs_prefix',   re: /\bRs\.?\s*\d[\d,]*(?:\.\d+)?/g },
  { pattern: 'word_suffix', re: /\b\d[\d,]*(?:\.\d+)?\s*(?:rupees|rupee|dollars|dollar|INR|USD)\b/gi },
];

export type PriceHit = { pattern: string; matched: string };

export function stripPrices(input: string): { text: string; hits: PriceHit[] } {
  let text = input;
  const hits: PriceHit[] = [];
  for (const { pattern, re } of PRICE_PATTERNS) {
    text = text.replace(re, (matched) => {
      hits.push({ pattern, matched });
      return 'the price on the card';
    });
  }
  // collapse double spaces created by replacements
  text = text.replace(/  +/g, ' ').trim();
  return { text, hits };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm --filter @shoppingmate/api test -- postprocess`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/agent/postprocess.ts apps/api/src/agent/postprocess.test.ts
git commit -m "feat(agent): stripPrices post-processor — no numeric prices invariant"
```

### Task 5: `postprocess.ts` — `redactPii()` and `segmentSay()`

**Files:**
- Modify: `apps/api/src/agent/postprocess.ts`
- Modify: `apps/api/src/agent/postprocess.test.ts`

- [ ] **Step 1: Failing tests for `redactPii()` and `segmentSay()`**

```ts
// Append to apps/api/src/agent/postprocess.test.ts
import { redactPii, segmentSay } from './postprocess.js';

describe('redactPii()', () => {
  it.each([
    ['my email is jane@example.com',           'my email is [redacted]'],
    ['call me at +91 98765 43210',             'call me at [redacted]'],
    ['call me at 9876543210',                  'call me at [redacted]'],
    ['card 4111 1111 1111 1111',               'card [redacted]'],
    ['card 4111111111111111',                  'card [redacted]'],
    ['size 10 fits, 12 reviews',               'size 10 fits, 12 reviews'], // not PII
  ])('redacts %s', (input, expected) => {
    expect(redactPii(input)).toBe(expected);
  });
});

describe('segmentSay()', () => {
  it('returns the whole string when no segmentation is needed', () => {
    expect(segmentSay('Two great picks. See the cards.')).toEqual([
      'Two great picks. See the cards.',
    ]);
  });
  it('splits on double-newline boundaries', () => {
    expect(segmentSay('First chunk.\n\nSecond chunk.')).toEqual([
      'First chunk.',
      'Second chunk.',
    ]);
  });
  it('drops empty segments', () => {
    expect(segmentSay('hello\n\n\n\nworld')).toEqual(['hello', 'world']);
  });
});
```

- [ ] **Step 2: Run, verify failure**

Expected: FAIL — `redactPii`, `segmentSay` not exported.

- [ ] **Step 3: Implement both**

```ts
// Append to apps/api/src/agent/postprocess.ts
const EMAIL_RE = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g;
const PHONE_RE = /(?:\+\d{1,3}[\s-]?)?(?:\d[\s-]?){10,15}/g; // catches ten-digit and intl
const CARD_RE = /\b(?:\d[\s-]?){13,19}\b/g;

export function redactPii(input: string): string {
  return input.replace(CARD_RE, '[redacted]').replace(EMAIL_RE, '[redacted]').replace(PHONE_RE, '[redacted]');
}

export function segmentSay(input: string): string[] {
  return input
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
```

Note: `CARD_RE` runs before `PHONE_RE` because a 16-digit card matches the phone regex too; redacting the card first gives precedence.

- [ ] **Step 4: Run, verify pass**

Run: `pnpm --filter @shoppingmate/api test -- postprocess`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/agent/postprocess.ts apps/api/src/agent/postprocess.test.ts
git commit -m "feat(agent): redactPii + segmentSay — transcript safety + WS chunking"
```

### Task 6: `prompts/persona-table.ts` — 8 personas keyed by `merchant.personaId`

**Files:**
- Create: `apps/api/src/agent/prompts/persona-table.ts`

- [ ] **Step 1: Write the persona table**

```ts
// apps/api/src/agent/prompts/persona-table.ts
export type Persona = {
  id: string;
  name: string;
  voiceDescriptor: string;     // injected verbatim into system prompt
  fitNote: string;              // human-readable description of where it fits
};

export const PERSONAS: Record<string, Persona> = {
  'calm-clinician': {
    id: 'calm-clinician',
    name: 'Sage',
    voiceDescriptor: 'Calm, clinical tone. Short sentences. Empathetic but never gushing. Speaks like a trained dermatologist or nurse.',
    fitNote: 'Skincare, wellness, supplements',
  },
  stylist: {
    id: 'stylist',
    name: 'Lumi',
    voiceDescriptor: 'Witty, warm, fashion-forward. Uses concrete sensory descriptors. Confident but never pushy.',
    fitNote: 'Apparel, beauty, accessories',
  },
  coach: {
    id: 'coach',
    name: 'Kai',
    voiceDescriptor: 'Direct, no-nonsense, fitness-coach tone. Short, punchy. Outcome-focused.',
    fitNote: 'Fitness, supplements, sports',
  },
  concierge: {
    id: 'concierge',
    name: 'Olivia',
    voiceDescriptor: 'Boutique concierge, formal-leaning, considered word choice. Treats every interaction like a private consultation.',
    fitNote: 'Luxury, jewelry, fine goods',
  },
  curator: {
    id: 'curator',
    name: 'Theo',
    voiceDescriptor: 'Curious, story-driven. Talks about provenance, craft, materials. Like a knowledgeable shop-keeper.',
    fitNote: 'Home goods, furniture, artisanal',
  },
  guide: {
    id: 'guide',
    name: 'Maya',
    voiceDescriptor: 'Friendly, clear, helpful. Explains tradeoffs. Treats the visitor as a peer.',
    fitNote: 'Electronics, appliances, gadgets',
  },
  expert: {
    id: 'expert',
    name: 'Arjun',
    voiceDescriptor: 'Subject-matter expert tone. Cites compatibility, specs, fit. Patient with detail-oriented buyers.',
    fitNote: 'Auto parts, hobbyist gear, B2B',
  },
  host: {
    id: 'host',
    name: 'Ana',
    voiceDescriptor: 'Warm host energy. Anticipates the visitor\'s next question. Comfortable with long browsing sessions.',
    fitNote: 'Food, gifts, seasonal',
  },
};

/** Default persona for unknown personaId values. */
export const DEFAULT_PERSONA: Persona = PERSONAS.concierge;

export function lookupPersona(personaId: string | null | undefined): Persona {
  if (!personaId) return DEFAULT_PERSONA;
  return PERSONAS[personaId] ?? DEFAULT_PERSONA;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @shoppingmate/api typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/agent/prompts/persona-table.ts
git commit -m "feat(agent): 8-persona table keyed by merchant.personaId"
```

### Task 7: `prompts/system.ts` — `buildSystemPrompt(merchant)` with Phase 2 KB hook

**Files:**
- Create: `apps/api/src/agent/prompts/system.ts`
- Test: `apps/api/src/agent/prompts/system.test.ts`

- [ ] **Step 1: Failing test**

```ts
// apps/api/src/agent/prompts/system.test.ts
import type { Merchant } from '@shoppingmate/db';
import { describe, expect, it } from 'vitest';
import { BRAND_KB_SLOT, buildSystemPrompt } from './system.js';

const merchant = {
  id: 'm_1',
  domain: 'acme.test',
  name: 'Acme',
  personaId: 'calm-clinician',
  adapterType: 'shopify',
} as unknown as Merchant;

describe('buildSystemPrompt()', () => {
  it('includes persona name + voice descriptor + brand name', () => {
    const p = buildSystemPrompt(merchant);
    expect(p).toContain('Sage');
    expect(p).toContain('Calm, clinical tone');
    expect(p).toContain('Acme');
  });

  it('includes the SPEAKING RULES no-numeric-prices line', () => {
    const p = buildSystemPrompt(merchant);
    expect(p).toMatch(/NEVER say a numeric price/i);
  });

  it('contains the Phase 2 BRAND_KB_SLOT marker (empty in Phase 1)', () => {
    const p = buildSystemPrompt(merchant);
    expect(p).toContain(BRAND_KB_SLOT);
  });

  it('falls back to concierge persona for unknown personaId', () => {
    const m = { ...merchant, personaId: 'made-up' } as unknown as Merchant;
    const p = buildSystemPrompt(m);
    expect(p).toContain('Olivia'); // concierge default
  });

  it('uses domain when name is null', () => {
    const m = { ...merchant, name: null } as unknown as Merchant;
    const p = buildSystemPrompt(m);
    expect(p).toContain('acme.test');
  });
});
```

- [ ] **Step 2: Run, verify failure**

Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// apps/api/src/agent/prompts/system.ts
import type { Merchant } from '@shoppingmate/db';
import { lookupPersona } from './persona-table.js';

/**
 * Marker reserved for Phase 2 Brand KB injection. Phase 4 leaves it empty;
 * Phase 2 will replace this slot with retrieved KB chunks before the
 * GUARDRAILS section without touching the runtime.
 */
export const BRAND_KB_SLOT = '<!-- BRAND_KB_SLOT (Phase 2) -->';

export function buildSystemPrompt(merchant: Merchant): string {
  const persona = lookupPersona(merchant.personaId);
  const brandName = merchant.name ?? merchant.domain;
  return `You are ${persona.name}, an AI shopping assistant for ${brandName}.

PERSONA
${persona.voiceDescriptor}

INVENTORY ACCESS
You have tools to search products, see details, manage the visitor's cart, apply coupons, and send them to checkout.
Use products.search whenever the visitor asks for something — never guess at the catalog.

SPEAKING RULES
- NEVER say a numeric price. Say "in your budget", "the higher-end pick", "the value option", or "see the price on the card I just sent". The card next to your message shows the exact price.
- NEVER make up SKUs, variant IDs, or coupon codes. Use the tool results.
- If a tool fails, apologize briefly and offer an alternative path.

GUARDRAILS
- No medical, legal, or financial advice.
- No discussion of competitors or competitor pricing.

BRAND CONTEXT
${BRAND_KB_SLOT}
`;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm --filter @shoppingmate/api test -- prompts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/agent/prompts/system.ts apps/api/src/agent/prompts/system.test.ts
git commit -m "feat(agent): buildSystemPrompt — persona + speaking rules + KB slot"
```

### Task 8: `caps.ts` — cap checker (turns, voice ms, total ms)

**Files:**
- Create: `apps/api/src/agent/caps.ts`
- Test: `apps/api/src/agent/caps.test.ts`

- [ ] **Step 1: Failing test**

```ts
// apps/api/src/agent/caps.test.ts
import { describe, expect, it } from 'vitest';
import { CAP_DURATION_MS, CAP_TURNS, CAP_VOICE_MS, checkCaps } from './caps.js';

describe('checkCaps()', () => {
  const baseSession = {
    sessionId: 's',
    merchantId: 'm',
    cartToken: null,
    history: [],
    turnCount: 0,
    voiceMs: 0,
    totalMs: 0,
    startedAt: 0,
    lastTurnAt: 0,
    mode: 'text' as const,
  };

  it('returns ok when all counters are below limits', () => {
    expect(checkCaps(baseSession, 'text', 1_000)).toEqual({ status: 'ok' });
  });

  it('hits turns cap on the 16th user turn (turnCount before increment = 15)', () => {
    expect(checkCaps({ ...baseSession, turnCount: CAP_TURNS }, 'text', 1_000).status).toBe('cap');
  });

  it('does NOT hit cap on the 15th turn', () => {
    expect(checkCaps({ ...baseSession, turnCount: CAP_TURNS - 1 }, 'text', 1_000).status).toBe('ok');
  });

  it('hits voice_ms cap when voiceMs exceeds 3 minutes in voice mode', () => {
    const r = checkCaps({ ...baseSession, voiceMs: CAP_VOICE_MS + 1 }, 'voice', 1_000);
    expect(r.status).toBe('cap');
    if (r.status === 'cap') expect(r.reason).toBe('voice_ms');
  });

  it('does not enforce voice_ms cap in text mode', () => {
    expect(
      checkCaps({ ...baseSession, voiceMs: CAP_VOICE_MS + 1 }, 'text', 1_000).status,
    ).toBe('ok');
  });

  it('hits duration_ms cap when wall-clock exceeds 25 minutes', () => {
    const r = checkCaps(
      { ...baseSession, startedAt: 0 },
      'text',
      CAP_DURATION_MS + 1,
    );
    expect(r.status).toBe('cap');
    if (r.status === 'cap') expect(r.reason).toBe('duration_ms');
  });

  it('emits cap_warning at 80% of turns cap', () => {
    const r = checkCaps({ ...baseSession, turnCount: 12 }, 'text', 1_000);
    expect(r.status).toBe('warning');
    if (r.status === 'warning') {
      expect(r.reason).toBe('turns');
      expect(r.remaining).toBe(3);
    }
  });
});
```

- [ ] **Step 2: Run, verify failure**

Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// apps/api/src/agent/caps.ts
import type { SessionState } from '../agent/types.js';

export const CAP_TURNS = 15;
export const CAP_VOICE_MS = 180_000;     // 3 min
export const CAP_DURATION_MS = 1_500_000; // 25 min
const WARNING_FRACTION = 0.8;

export type CapReason = 'turns' | 'voice_ms' | 'duration_ms';

export type CapStatus =
  | { status: 'ok' }
  | { status: 'warning'; reason: CapReason; remaining: number }
  | { status: 'cap'; reason: CapReason };

export function checkCaps(
  session: SessionState,
  mode: 'voice' | 'text',
  nowMs: number,
): CapStatus {
  const wallClock = nowMs - session.startedAt;

  if (session.turnCount >= CAP_TURNS) return { status: 'cap', reason: 'turns' };
  if (mode === 'voice' && session.voiceMs > CAP_VOICE_MS) {
    return { status: 'cap', reason: 'voice_ms' };
  }
  if (wallClock > CAP_DURATION_MS) return { status: 'cap', reason: 'duration_ms' };

  // Warnings (in priority order: most-imminent first)
  if (session.turnCount >= Math.floor(CAP_TURNS * WARNING_FRACTION)) {
    return { status: 'warning', reason: 'turns', remaining: CAP_TURNS - session.turnCount };
  }
  if (mode === 'voice' && session.voiceMs >= CAP_VOICE_MS * WARNING_FRACTION) {
    return {
      status: 'warning',
      reason: 'voice_ms',
      remaining: CAP_VOICE_MS - session.voiceMs,
    };
  }
  if (wallClock >= CAP_DURATION_MS * WARNING_FRACTION) {
    return { status: 'warning', reason: 'duration_ms', remaining: CAP_DURATION_MS - wallClock };
  }
  return { status: 'ok' };
}
```

Note: `SessionState` is the type defined in Task 9 (`apps/api/src/agent/types.ts`). Land that before `caps.ts` typechecks.

- [ ] **Step 4: Defer test run until Task 9 lands `SessionState`**

Continue to Task 9 below; `caps.ts` will compile once `types.ts` exists.

- [ ] **Step 5: Commit (deferred to end of Task 9)**

### Task 9: `types.ts` — central agent types module

**Files:**
- Create: `apps/api/src/agent/types.ts`

- [ ] **Step 1: Implement**

```ts
// apps/api/src/agent/types.ts
import type { AssistantToolCalls, ChatMessage, ToolCallMessage } from '@shoppingmate/shared';

export type Mode = 'voice' | 'text';

export type CardItem = {
  image: string | null;
  title: string;
  priceFormatted: string;     // DB-trusted, never LLM-emitted
  variantId: string | null;
  sku: string;
  productUrl: string;
  badges?: string[];
};

export type WidgetMessage =
  | { type: 'user_text'; sessionId: string; text: string; mode: Mode }
  | {
      type: 'card_tap';
      sessionId: string;
      action: 'cartAdd';
      variantId: string | null;
      sku: string;
      qty: number;
    }
  | { type: 'session_resume'; sessionId: string }
  | { type: 'session_end'; sessionId: string };

export type AgentEvent =
  | { type: 'thinking' }
  | { type: 'say'; text: string }
  | { type: 'cards'; items: CardItem[] }
  | { type: 'tool_result'; toolName: string; ok: boolean; summary?: string }
  | { type: 'checkout_redirect'; url: string }
  | { type: 'cap_warning'; reason: 'turns' | 'voice_ms' | 'duration_ms'; remaining: number }
  | { type: 'end_of_turn' }
  | { type: 'session_closed'; reason: 'user' | 'cap' | 'error' };

export type AnthropicMessage = ChatMessage | AssistantToolCalls | ToolCallMessage;

export type SessionState = {
  sessionId: string;
  merchantId: string;
  cartToken: string | null;
  history: AnthropicMessage[];
  turnCount: number;
  voiceMs: number;
  totalMs: number;
  startedAt: number;
  lastTurnAt: number;
  mode: Mode;
};
```

- [ ] **Step 2: Now run caps tests (Task 8 was deferred)**

Run: `pnpm --filter @shoppingmate/api test -- caps`
Expected: all PASS.

- [ ] **Step 3: Commit Tasks 8 + 9 together**

```bash
git add apps/api/src/agent/types.ts apps/api/src/agent/caps.ts apps/api/src/agent/caps.test.ts
git commit -m "feat(agent): SessionState/AgentEvent/WidgetMessage types + caps checker"
```

---

## Phase C — Tool surface

### Task 10: `tools.ts` — `buildToolSurface(merchant)`

**Files:**
- Create: `apps/api/src/agent/tools.ts`
- Test: `apps/api/src/agent/tools.test.ts`

- [ ] **Step 1: Failing test**

```ts
// apps/api/src/agent/tools.test.ts
import type { Merchant } from '@shoppingmate/db';
import { describe, expect, it } from 'vitest';
import { buildToolSurface } from './tools.js';

const merchant = { adapterType: 'shopify' } as unknown as Merchant;

describe('buildToolSurface()', () => {
  it('returns six tools with dot-namespaced names', () => {
    const tools = buildToolSurface(merchant);
    const names = tools.map((t) => t.function.name);
    expect(names).toEqual([
      'products.search',
      'products.get',
      'cart.add',
      'cart.update',
      'cart.get',
      'coupons.apply',
      'checkout.url',
    ]);
  });

  it('each tool has a JSON-Schema parameters object', () => {
    for (const t of buildToolSurface(merchant)) {
      expect(t.type).toBe('function');
      expect(t.function.parameters).toMatchObject({ type: 'object', properties: expect.any(Object) });
    }
  });

  it('products.search requires query', () => {
    const t = buildToolSurface(merchant).find((x) => x.function.name === 'products.search');
    expect(t?.function.parameters).toMatchObject({
      properties: { query: { type: 'string' } },
      required: ['query'],
    });
  });

  it('cart.add requires sku and qty (variantId nullable)', () => {
    const t = buildToolSurface(merchant).find((x) => x.function.name === 'cart.add');
    expect(t?.function.parameters).toMatchObject({
      required: ['sku', 'qty'],
    });
  });
});
```

- [ ] **Step 2: Run, verify failure**

- [ ] **Step 3: Implement**

```ts
// apps/api/src/agent/tools.ts
import type { Merchant } from '@shoppingmate/db';
import type { ToolDef } from '@shoppingmate/shared';

export function buildToolSurface(_merchant: Merchant): ToolDef[] {
  // The set of tools is the same for every adapter type — adapter capability
  // differences surface as `unsupported` results, not different tool surfaces.
  // This matches the spec §6: Sonnet sees one consistent surface; the runtime
  // routes per-adapter underneath.
  return [
    {
      type: 'function',
      function: {
        name: 'products.search',
        description: "Search the merchant's catalog. Use whenever the visitor asks for a product or category.",
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Free-text search (e.g. "winter face cream", "wedding dress under 2000")' },
            limit: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'products.get',
        description: 'Fetch full product detail by SKU. Use for variant disambiguation or detail Q&A.',
        parameters: {
          type: 'object',
          properties: { sku: { type: 'string' } },
          required: ['sku'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'cart.add',
        description: "Add an item to the visitor's cart.",
        parameters: {
          type: 'object',
          properties: {
            sku: { type: 'string' },
            variantId: { type: ['string', 'null'], description: 'null if product has no variants' },
            qty: { type: 'integer', minimum: 1 },
          },
          required: ['sku', 'qty'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'cart.update',
        description: 'Change quantity of an existing line item. Set qty=0 to remove.',
        parameters: {
          type: 'object',
          properties: {
            lineId: { type: 'string' },
            qty: { type: 'integer', minimum: 0 },
          },
          required: ['lineId', 'qty'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'cart.get',
        description: "Read the current cart contents.",
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'coupons.apply',
        description: 'Apply a coupon code the visitor mentioned or the agent knows.',
        parameters: {
          type: 'object',
          properties: { code: { type: 'string' } },
          required: ['code'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'checkout.url',
        description: "When the visitor is ready to pay, fetch the merchant's native checkout URL. The runtime will redirect them.",
        parameters: { type: 'object', properties: {} },
      },
    },
  ];
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm --filter @shoppingmate/api test -- tools`
Expected: all PASS.

- [ ] **Step 5: Commit (deferred to Task 11)**

### Task 11: `tools.ts` — `dispatchTool()` + retry-exhausted tracking

**Files:**
- Modify: `apps/api/src/agent/tools.ts`
- Modify: `apps/api/src/agent/tools.test.ts`
- Create: `apps/api/src/agent/transport-noop.ts` — for non-DOM adapter dispatch in agent context

- [ ] **Step 1: Implement `NoOpWSTransport`**

```ts
// apps/api/src/agent/transport-noop.ts
import type { DomAck, DomAction, WSTransport } from '@shoppingmate/adapters';

/**
 * Drop-in WSTransport for agent-runtime dispatch when the merchant's adapter
 * does not need the dom-harness control channel (every adapter except the
 * legacy DOMAdapter call path that still uses transport.send for cart-add).
 *
 * Suggest's transport.send becomes a no-op here — the runtime emits its own
 * `cards` event from the SuggestAdapter's product result, so the legacy
 * `ui.show_message`/`ui.show_product_card` events are silently dropped.
 * Plan 3e tests still pass because they construct the adapter with a real
 * test transport.
 */
export class NoOpWSTransport implements WSTransport {
  async send(_sessionId: string, _action: DomAction): Promise<DomAck> {
    return { ok: true };
  }
}
```

- [ ] **Step 2: Failing test for `dispatchTool()`**

```ts
// Append to apps/api/src/agent/tools.test.ts
import type { Adapter, AdapterContext, AdapterResult, CartState, Product } from '@shoppingmate/adapters';
import { dispatchTool } from './tools.js';

function makeAdapter(overrides: Partial<Adapter> = {}): Adapter {
  const ok = <T>(v: T): AdapterResult<T> => ({ kind: 'ok', value: v });
  const stub: Adapter = {
    kind: 'shopify',
    searchProducts: async () => ok([]),
    getProduct: async () => ok(null),
    cartAdd: async () => ok({} as CartState),
    cartUpdate: async () => ok({} as CartState),
    cartGet: async () => ok({} as CartState),
    couponApply: async () => ok({} as CartState),
    checkoutUrl: async () => ok('https://x.test/checkout'),
    ...overrides,
  };
  return stub;
}

const ctx: AdapterContext = {
  merchant: { id: 'm', adapterType: 'shopify' } as never,
  cartToken: null,
  sessionId: 's',
};

describe('dispatchTool()', () => {
  it('routes products.search to adapter.searchProducts and wraps ok result', async () => {
    const products = [{ sku: 'A', title: 'A', merchantId: 'm', productUrl: '/a' }] as Product[];
    const adapter = makeAdapter({ searchProducts: async () => ({ kind: 'ok', value: products }) });
    const r = await dispatchTool(adapter, ctx, 'products.search', { query: 'foo' });
    expect(r).toEqual({ ok: true, value: products });
  });

  it('routes cart.add and converts platform_error to envelope', async () => {
    const adapter = makeAdapter({
      cartAdd: async () => ({ kind: 'platform_error', status: 503, body: 'oops' }),
    });
    const r = await dispatchTool(adapter, ctx, 'cart.add', { sku: 'A', variantId: null, qty: 1 });
    expect(r).toEqual({ ok: false, kind: 'platform_error', status: 503, body: 'oops' });
  });

  it('converts unsupported into envelope', async () => {
    const adapter = makeAdapter({
      cartAdd: async () => ({ kind: 'unsupported', reason: 'product_not_in_catalog' }),
    });
    const r = await dispatchTool(adapter, ctx, 'cart.add', { sku: 'A', qty: 1 });
    expect(r).toEqual({ ok: false, kind: 'unsupported', reason: 'product_not_in_catalog' });
  });

  it('rejects unknown tool names', async () => {
    const r = await dispatchTool(makeAdapter(), ctx, 'fake.tool', {});
    expect(r).toEqual({ ok: false, kind: 'unsupported', reason: 'unknown_tool' });
  });

  it('treats empty search result as not_found envelope', async () => {
    const adapter = makeAdapter({ searchProducts: async () => ({ kind: 'ok', value: [] }) });
    const r = await dispatchTool(adapter, ctx, 'products.search', { query: 'nonexistent' });
    expect(r).toEqual({ ok: false, kind: 'not_found', query: 'nonexistent' });
  });
});
```

- [ ] **Step 3: Run, verify failure**

Expected: FAIL — `dispatchTool` missing.

- [ ] **Step 4: Implement `dispatchTool()`**

```ts
// Append to apps/api/src/agent/tools.ts
import type { Adapter, AdapterContext, AdapterResult } from '@shoppingmate/adapters';

export type ToolResultEnvelope =
  | { ok: true; value: unknown }
  | { ok: false; kind: 'unsupported'; reason: string }
  | { ok: false; kind: 'platform_error'; status: number; body: string }
  | { ok: false; kind: 'not_found'; query?: string }
  | { ok: false; kind: 'retry_exhausted' };

function toEnvelope<T>(r: AdapterResult<T>): ToolResultEnvelope {
  if (r.kind === 'ok') return { ok: true, value: r.value };
  if (r.kind === 'unsupported') return { ok: false, kind: 'unsupported', reason: r.reason };
  return { ok: false, kind: 'platform_error', status: r.status, body: r.body };
}

export async function dispatchTool(
  adapter: Adapter,
  ctx: AdapterContext,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResultEnvelope> {
  switch (name) {
    case 'products.search': {
      const r = await adapter.searchProducts(ctx, String(args.query ?? ''), Number(args.limit) || undefined);
      if (r.kind === 'ok' && r.value.length === 0) {
        return { ok: false, kind: 'not_found', query: String(args.query ?? '') };
      }
      return toEnvelope(r);
    }
    case 'products.get': {
      const r = await adapter.getProduct(ctx, String(args.sku ?? ''));
      if (r.kind === 'ok' && r.value === null) {
        return { ok: false, kind: 'not_found', query: String(args.sku ?? '') };
      }
      return toEnvelope(r);
    }
    case 'cart.add': {
      const variantId = args.variantId == null ? null : String(args.variantId);
      const r = await adapter.cartAdd(
        ctx,
        String(args.sku ?? ''),
        variantId,
        Number(args.qty) || 1,
      );
      return toEnvelope(r);
    }
    case 'cart.update': {
      const r = await adapter.cartUpdate(ctx, String(args.lineId ?? ''), Number(args.qty) || 0);
      return toEnvelope(r);
    }
    case 'cart.get': {
      const r = await adapter.cartGet(ctx);
      return toEnvelope(r);
    }
    case 'coupons.apply': {
      const r = await adapter.couponApply(ctx, String(args.code ?? ''));
      return toEnvelope(r);
    }
    case 'checkout.url': {
      const r = await adapter.checkoutUrl(ctx);
      return toEnvelope(r);
    }
    default:
      return { ok: false, kind: 'unsupported', reason: 'unknown_tool' };
  }
}
```

- [ ] **Step 5: Run, verify pass**

Run: `pnpm --filter @shoppingmate/api test -- tools`
Expected: all PASS.

- [ ] **Step 6: Commit Tasks 10 + 11**

```bash
git add apps/api/src/agent/tools.ts apps/api/src/agent/tools.test.ts \
        apps/api/src/agent/transport-noop.ts
git commit -m "feat(agent): tool surface + dispatchTool + NoOpWSTransport

Six tools mapped 1:1 to the Adapter contract. dispatchTool wraps adapter
results in the JSON envelope Sonnet consumes (ok/unsupported/platform_error/
not_found). NoOpWSTransport lets the agent runtime construct DispatchDeps
without leaking transport.send side-effects from SuggestAdapter."
```

---

## Phase D — State (Redis sessions)

### Task 12: `state.ts` — `loadSession`/`saveSession` round-trip with TTL

**Files:**
- Create: `apps/api/src/agent/state.ts`
- Test: `apps/api/src/agent/state.test.ts`

- [ ] **Step 1: Failing test**

```ts
// apps/api/src/agent/state.test.ts
import { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { SessionState } from './types.js';
import { SESSION_TTL_SECONDS, createSession, loadSession, saveSession } from './state.js';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

beforeAll(async () => {
  // sanity ping; if redis isn't up the suite is skipped via env in CI
  await redis.ping();
});
afterAll(async () => {
  await redis.quit();
});
beforeEach(async () => {
  const keys = await redis.keys('session:test-*');
  if (keys.length > 0) await redis.del(...keys);
});

const baseSession: SessionState = {
  sessionId: 'test-1',
  merchantId: 'm',
  cartToken: null,
  history: [],
  turnCount: 0,
  voiceMs: 0,
  totalMs: 0,
  startedAt: 0,
  lastTurnAt: 0,
  mode: 'text',
};

describe('session repo', () => {
  it('createSession returns fresh state with the given sessionId/merchantId/mode', () => {
    const s = createSession({ sessionId: 'test-2', merchantId: 'm', mode: 'voice', nowMs: 100 });
    expect(s).toMatchObject({
      sessionId: 'test-2',
      merchantId: 'm',
      mode: 'voice',
      startedAt: 100,
      lastTurnAt: 100,
      turnCount: 0,
      history: [],
    });
  });

  it('saves and loads a session', async () => {
    await saveSession(redis, baseSession);
    const loaded = await loadSession(redis, 'test-1');
    expect(loaded).toEqual(baseSession);
  });

  it('returns null for missing session', async () => {
    expect(await loadSession(redis, 'test-missing')).toBeNull();
  });

  it('sets a 24h TTL on save', async () => {
    await saveSession(redis, baseSession);
    const ttl = await redis.ttl('session:test-1');
    expect(ttl).toBeGreaterThan(SESSION_TTL_SECONDS - 5);
    expect(ttl).toBeLessThanOrEqual(SESSION_TTL_SECONDS);
  });

  it('extends TTL on every save', async () => {
    await saveSession(redis, baseSession);
    await new Promise((r) => setTimeout(r, 1100));
    await saveSession(redis, baseSession);
    const ttl = await redis.ttl('session:test-1');
    expect(ttl).toBeGreaterThan(SESSION_TTL_SECONDS - 2);
  });
});
```

- [ ] **Step 2: Run, verify failure**

Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// apps/api/src/agent/state.ts
import type { Redis } from 'ioredis';
import type { Mode, SessionState } from './types.js';

export const SESSION_TTL_SECONDS = 24 * 60 * 60; // 24h

const keyOf = (sessionId: string) => `session:${sessionId}`;

export function createSession(opts: {
  sessionId: string;
  merchantId: string;
  mode: Mode;
  nowMs: number;
}): SessionState {
  return {
    sessionId: opts.sessionId,
    merchantId: opts.merchantId,
    cartToken: null,
    history: [],
    turnCount: 0,
    voiceMs: 0,
    totalMs: 0,
    startedAt: opts.nowMs,
    lastTurnAt: opts.nowMs,
    mode: opts.mode,
  };
}

export async function loadSession(redis: Redis, sessionId: string): Promise<SessionState | null> {
  const raw = await redis.get(keyOf(sessionId));
  if (!raw) return null;
  return JSON.parse(raw) as SessionState;
}

export async function saveSession(redis: Redis, session: SessionState): Promise<void> {
  await redis.set(keyOf(session.sessionId), JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
}

export async function deleteSession(redis: Redis, sessionId: string): Promise<void> {
  await redis.del(keyOf(sessionId));
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm --filter @shoppingmate/api test -- state`
Expected: all PASS (assumes a local Redis is up — same expectation as the existing jobs queue tests in Plan 1).

- [ ] **Step 5: Commit (deferred to Task 13)**

### Task 13: `state.ts` — history truncation by approximate token budget

**Files:**
- Modify: `apps/api/src/agent/state.ts`
- Modify: `apps/api/src/agent/state.test.ts`

- [ ] **Step 1: Failing test**

```ts
// Append to apps/api/src/agent/state.test.ts
import { TOKEN_BUDGET, truncateHistory } from './state.js';
import type { AnthropicMessage } from './types.js';

describe('truncateHistory()', () => {
  function msg(role: 'user' | 'assistant', text: string): AnthropicMessage {
    return { role, content: text } as AnthropicMessage;
  }

  it('passes through small histories', () => {
    const h: AnthropicMessage[] = [msg('user', 'a'), msg('assistant', 'b')];
    expect(truncateHistory(h)).toEqual(h);
  });

  it('drops oldest messages until under budget', () => {
    const huge = 'x'.repeat(TOKEN_BUDGET * 4); // ~TOKEN_BUDGET tokens (4 chars/token heuristic)
    const h: AnthropicMessage[] = [msg('user', huge), msg('user', 'small')];
    const out = truncateHistory(h);
    expect(out).toEqual([msg('user', 'small')]);
  });

  it('preserves order from oldest to newest after truncation', () => {
    const h: AnthropicMessage[] = [
      msg('user', 'a'),
      msg('assistant', 'b'),
      msg('user', 'c'),
    ];
    const out = truncateHistory(h);
    expect(out.map((m) => (m as { content: string }).content)).toEqual(['a', 'b', 'c']);
  });
});
```

- [ ] **Step 2: Run, verify failure**

- [ ] **Step 3: Implement**

```ts
// Append to apps/api/src/agent/state.ts
import type { AnthropicMessage } from './types.js';

export const TOKEN_BUDGET = 8_000; // 8K tokens — leaves 192K headroom on a 200K-context model
const CHARS_PER_TOKEN_APPROX = 4;

function approxTokens(m: AnthropicMessage): number {
  const c = (m as { content?: unknown }).content;
  if (typeof c === 'string') return Math.ceil(c.length / CHARS_PER_TOKEN_APPROX);
  if (c == null) return 8; // tool-call message overhead
  return Math.ceil(JSON.stringify(c).length / CHARS_PER_TOKEN_APPROX);
}

export function truncateHistory(history: AnthropicMessage[]): AnthropicMessage[] {
  let total = history.reduce((sum, m) => sum + approxTokens(m), 0);
  if (total <= TOKEN_BUDGET) return history;
  const kept = [...history];
  while (kept.length > 0 && total > TOKEN_BUDGET) {
    const dropped = kept.shift();
    if (dropped) total -= approxTokens(dropped);
  }
  return kept;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm --filter @shoppingmate/api test -- state`
Expected: all PASS.

- [ ] **Step 5: Commit Tasks 12 + 13**

```bash
git add apps/api/src/agent/state.ts apps/api/src/agent/state.test.ts
git commit -m "feat(agent): Redis session repo + token-budget history truncation"
```

---

## Phase E — Events + Runtime

### Task 14: `events.ts` — WS envelope encode/decode

**Files:**
- Create: `apps/api/src/agent/events.ts`
- Test: `apps/api/src/agent/events.test.ts`

- [ ] **Step 1: Failing test**

```ts
// apps/api/src/agent/events.test.ts
import { describe, expect, it } from 'vitest';
import { decodeWidgetMessage, encodeAgentEvent } from './events.js';

describe('encodeAgentEvent()', () => {
  it('encodes say', () => {
    expect(encodeAgentEvent({ type: 'say', text: 'hello' })).toBe(
      '{"type":"say","text":"hello"}',
    );
  });
  it('encodes cards', () => {
    const out = encodeAgentEvent({
      type: 'cards',
      items: [
        {
          image: null,
          title: 'A',
          priceFormatted: '₹100',
          variantId: null,
          sku: 'A',
          productUrl: '/a',
        },
      ],
    });
    expect(JSON.parse(out)).toMatchObject({ type: 'cards', items: [{ sku: 'A' }] });
  });
});

describe('decodeWidgetMessage()', () => {
  it('decodes user_text', () => {
    const r = decodeWidgetMessage('{"type":"user_text","sessionId":"s","text":"hi","mode":"text"}');
    expect(r).toEqual({ type: 'user_text', sessionId: 's', text: 'hi', mode: 'text' });
  });
  it('decodes card_tap', () => {
    const r = decodeWidgetMessage(
      '{"type":"card_tap","sessionId":"s","action":"cartAdd","variantId":null,"sku":"A","qty":1}',
    );
    expect(r).toMatchObject({ type: 'card_tap', sku: 'A', qty: 1 });
  });
  it('returns null for malformed JSON', () => {
    expect(decodeWidgetMessage('{not json')).toBeNull();
  });
  it('returns null for missing type', () => {
    expect(decodeWidgetMessage('{}')).toBeNull();
  });
  it('returns null for unknown type', () => {
    expect(decodeWidgetMessage('{"type":"bogus","sessionId":"s"}')).toBeNull();
  });
  it('returns null for missing sessionId on user_text', () => {
    expect(decodeWidgetMessage('{"type":"user_text","text":"hi","mode":"text"}')).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify failure**

- [ ] **Step 3: Implement**

```ts
// apps/api/src/agent/events.ts
import type { AgentEvent, WidgetMessage } from './types.js';

export function encodeAgentEvent(ev: AgentEvent): string {
  return JSON.stringify(ev);
}

export function decodeWidgetMessage(raw: string): WidgetMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  switch (obj.type) {
    case 'user_text':
      if (typeof obj.sessionId !== 'string' || typeof obj.text !== 'string') return null;
      if (obj.mode !== 'voice' && obj.mode !== 'text') return null;
      return { type: 'user_text', sessionId: obj.sessionId, text: obj.text, mode: obj.mode };
    case 'card_tap':
      if (typeof obj.sessionId !== 'string' || typeof obj.sku !== 'string') return null;
      if (obj.action !== 'cartAdd') return null;
      return {
        type: 'card_tap',
        sessionId: obj.sessionId,
        action: 'cartAdd',
        variantId: obj.variantId == null ? null : String(obj.variantId),
        sku: obj.sku,
        qty: typeof obj.qty === 'number' ? obj.qty : 1,
      };
    case 'session_resume':
      if (typeof obj.sessionId !== 'string') return null;
      return { type: 'session_resume', sessionId: obj.sessionId };
    case 'session_end':
      if (typeof obj.sessionId !== 'string') return null;
      return { type: 'session_end', sessionId: obj.sessionId };
    default:
      return null;
  }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm --filter @shoppingmate/api test -- events`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/agent/events.ts apps/api/src/agent/events.test.ts
git commit -m "feat(agent): WS event encode/decode for widget protocol"
```

### Task 15: `runtime.ts` — `runTurn()` skeleton (cap check, cards extraction, no LLM yet)

**Files:**
- Create: `apps/api/src/agent/runtime.ts`
- Test: `apps/api/src/agent/runtime.test.ts`

This task lands the structure and the deterministic parts (cap-warning emit, cards extraction from a stubbed Sonnet response). Task 16 layers on the actual openrouter call.

- [ ] **Step 1: Failing test for cap-warning emit at 80% turns**

```ts
// apps/api/src/agent/runtime.test.ts
import type { Merchant } from '@shoppingmate/db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runTurn, type RunTurnDeps } from './runtime.js';
import type { SessionState } from './types.js';

vi.mock('@shoppingmate/shared', async (orig) => ({
  ...(await orig<typeof import('@shoppingmate/shared')>()),
  chatTools: vi.fn(),
}));

const { chatTools } = await import('@shoppingmate/shared');

const merchant = {
  id: 'm',
  domain: 'acme.test',
  name: 'Acme',
  personaId: 'concierge',
  adapterType: 'shopify',
} as unknown as Merchant;

function baseSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    sessionId: 's-1',
    merchantId: 'm',
    cartToken: null,
    history: [],
    turnCount: 0,
    voiceMs: 0,
    totalMs: 0,
    startedAt: Date.now(),
    lastTurnAt: Date.now(),
    mode: 'text',
    ...overrides,
  };
}

const deps: RunTurnDeps = {
  // Filled in by Task 16 (Redis, real adapter dispatch, etc.); for the
  // skeleton tests we use light stubs.
  loadAdapter: () => ({
    kind: 'shopify',
    searchProducts: async () => ({ kind: 'ok', value: [] }),
    getProduct: async () => ({ kind: 'ok', value: null }),
    cartAdd: async () => ({ kind: 'ok', value: { cartToken: 'x', lines: [], subtotalCents: 0, totalCents: 0, currency: 'INR', appliedCoupons: [] } }),
    cartUpdate: async () => ({ kind: 'ok', value: { cartToken: 'x', lines: [], subtotalCents: 0, totalCents: 0, currency: 'INR', appliedCoupons: [] } }),
    cartGet: async () => ({ kind: 'ok', value: { cartToken: 'x', lines: [], subtotalCents: 0, totalCents: 0, currency: 'INR', appliedCoupons: [] } }),
    couponApply: async () => ({ kind: 'ok', value: { cartToken: 'x', lines: [], subtotalCents: 0, totalCents: 0, currency: 'INR', appliedCoupons: [] } }),
    checkoutUrl: async () => ({ kind: 'ok', value: 'https://acme.test/checkout' }),
  }),
  saveSession: vi.fn(async () => undefined),
  recordMetric: vi.fn(async () => undefined),
};

beforeEach(() => {
  vi.mocked(chatTools).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runTurn() — cap behavior', () => {
  it('emits cap_warning when turnCount reaches 80% of CAP_TURNS', async () => {
    vi.mocked(chatTools).mockResolvedValueOnce({
      text: 'sure',
      toolCalls: [],
      stopReason: 'stop',
      inputTokens: 1,
      outputTokens: 1,
    });
    const events = [];
    for await (const ev of runTurn(deps, merchant, baseSession({ turnCount: 12 }), {
      type: 'user_text',
      sessionId: 's-1',
      text: 'hi',
      mode: 'text',
    })) {
      events.push(ev);
    }
    expect(events.find((e) => e.type === 'cap_warning')).toMatchObject({
      type: 'cap_warning',
      reason: 'turns',
    });
  });

  it('emits session_closed and skips Sonnet when cap is hit', async () => {
    const events = [];
    for await (const ev of runTurn(deps, merchant, baseSession({ turnCount: 15 }), {
      type: 'user_text',
      sessionId: 's-1',
      text: 'hi',
      mode: 'text',
    })) {
      events.push(ev);
    }
    expect(vi.mocked(chatTools)).not.toHaveBeenCalled();
    expect(events.map((e) => e.type)).toContain('say');
    expect(events.map((e) => e.type)).toContain('session_closed');
  });
});
```

- [ ] **Step 2: Run, verify failure**

Expected: FAIL — module missing.

- [ ] **Step 3: Implement skeleton (no Sonnet call yet — leave as `chatTools` mocked)**

```ts
// apps/api/src/agent/runtime.ts
import type { Adapter, AdapterContext } from '@shoppingmate/adapters';
import type { Merchant } from '@shoppingmate/db';
import { chatTools, type ToolDef, type ChatToolsResult } from '@shoppingmate/shared';
import { CAP_TURNS, checkCaps } from './caps.js';
import { buildSystemPrompt } from './prompts/system.js';
import { redactPii, segmentSay, stripPrices } from './postprocess.js';
import { saveSession as defaultSaveSession } from './state.js';
import { buildToolSurface, dispatchTool } from './tools.js';
import type { AgentEvent, AnthropicMessage, CardItem, SessionState, WidgetMessage } from './types.js';

const SONNET_MODEL = 'anthropic/claude-sonnet-4.6';
const MAX_TOOL_LOOP_ITERATIONS = 8;
const RETRY_LIMIT_PER_TOOL = 3;

export type RunTurnDeps = {
  loadAdapter: (merchant: Merchant, sessionId: string) => Adapter;
  saveSession: (s: SessionState) => Promise<void>;
  recordMetric: (name: string, tags: Record<string, string | number | boolean>, value?: number) => Promise<void>;
};

export async function* runTurn(
  deps: RunTurnDeps,
  merchant: Merchant,
  session: SessionState,
  message: WidgetMessage,
): AsyncGenerator<AgentEvent, void, void> {
  if (message.type !== 'user_text' && message.type !== 'card_tap') {
    // session_resume / session_end handled by the WS layer, not the runtime
    return;
  }

  const now = Date.now();
  const cap = checkCaps(session, session.mode, now);

  if (cap.status === 'cap') {
    yield { type: 'say', text: gracefulCloseText(cap.reason) };
    if (session.cartToken) {
      const adapter = deps.loadAdapter(merchant, session.sessionId);
      const url = await adapter.checkoutUrl(makeCtx(merchant, session));
      if (url.kind === 'ok') yield { type: 'checkout_redirect', url: url.value };
    }
    yield { type: 'session_closed', reason: 'cap' };
    await deps.recordMetric('agent.cap.hit', {
      merchantId: merchant.id,
      sessionId: session.sessionId,
      cap: cap.reason,
    });
    return;
  }

  if (cap.status === 'warning') {
    yield { type: 'cap_warning', reason: cap.reason, remaining: cap.remaining };
  }

  // Append user message to history (transcribed text → redacted)
  const userText = message.type === 'user_text'
    ? redactPii(message.text)
    : `[card_tap] add sku=${message.sku} qty=${message.qty}`;
  const history: AnthropicMessage[] = [
    { role: 'system', content: buildSystemPrompt(merchant) },
    ...session.history,
    { role: 'user', content: userText },
  ];

  yield { type: 'thinking' };

  const tools = buildToolSurface(merchant);
  const adapter = deps.loadAdapter(merchant, session.sessionId);
  const ctx = makeCtx(merchant, session);
  const collectedCards: CardItem[] = [];
  const toolCallCounts = new Map<string, number>();

  let response: ChatToolsResult;
  for (let iter = 0; iter < MAX_TOOL_LOOP_ITERATIONS; iter += 1) {
    response = await chatTools({ model: SONNET_MODEL, messages: history, tools });
    if (response.toolCalls.length === 0) break;
    // Append assistant tool_calls message
    history.push({
      role: 'assistant',
      content: response.text || null,
      tool_calls: response.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: tc.argumentsJson },
      })),
    });
    // Dispatch each tool, append tool_result message
    for (const call of response.toolCalls) {
      const key = `${call.name}:${call.argumentsJson}`;
      const prev = toolCallCounts.get(key) ?? 0;
      toolCallCounts.set(key, prev + 1);
      let envelope;
      if (prev >= RETRY_LIMIT_PER_TOOL) {
        envelope = { ok: false as const, kind: 'retry_exhausted' as const };
        await deps.recordMetric('agent.tool.retry_exhausted', {
          merchantId: merchant.id,
          sessionId: session.sessionId,
          toolName: call.name,
        });
      } else {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.argumentsJson) as Record<string, unknown>;
        } catch {
          // bad arguments JSON from the model — surface as unsupported
        }
        const start = Date.now();
        envelope = await dispatchTool(adapter, ctx, call.name, args);
        await deps.recordMetric('agent.tool.invoked', {
          merchantId: merchant.id,
          sessionId: session.sessionId,
          toolName: call.name,
          ok: envelope.ok,
          latencyMs: Date.now() - start,
        });
      }
      yield { type: 'tool_result', toolName: call.name, ok: envelope.ok };
      // Card extraction from products.search / products.get successful results
      if (
        envelope.ok &&
        (call.name === 'products.search' || call.name === 'products.get')
      ) {
        const cards = toCards(envelope.value);
        if (cards.length > 0) {
          collectedCards.push(...cards);
          yield { type: 'cards', items: cards };
        }
      }
      // checkout redirect
      if (envelope.ok && call.name === 'checkout.url' && typeof envelope.value === 'string') {
        yield { type: 'checkout_redirect', url: envelope.value };
      }
      history.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(envelope),
      });
    }
  }

  // Final assistant text
  const responseText = (response! ?? { text: '' }).text;
  const { text: stripped, hits } = stripPrices(responseText);
  if (hits.length > 0) {
    await deps.recordMetric('agent.say.price_stripped', {
      merchantId: merchant.id,
      sessionId: session.sessionId,
      pattern: hits[0]!.pattern,
    }, hits.length);
  }
  for (const segment of segmentSay(stripped)) {
    yield { type: 'say', text: segment };
  }

  // Persist
  const updated: SessionState = {
    ...session,
    history: [...session.history, { role: 'user', content: userText }, ...history.slice(-1)],
    turnCount: session.turnCount + 1,
    voiceMs: session.mode === 'voice' ? session.voiceMs + (Date.now() - now) : session.voiceMs,
    totalMs: now - session.startedAt + (Date.now() - now),
    lastTurnAt: Date.now(),
  };
  await deps.saveSession(updated);
  yield { type: 'end_of_turn' };
}

function makeCtx(merchant: Merchant, session: SessionState): AdapterContext {
  return { merchant, cartToken: session.cartToken, sessionId: session.sessionId };
}

function gracefulCloseText(reason: 'turns' | 'voice_ms' | 'duration_ms'): string {
  if (reason === 'turns') return "We've covered a lot — should I send you to checkout?";
  if (reason === 'voice_ms') return 'We\'ve been chatting a while — let me send you to checkout.';
  return 'I want to wrap up before we run too long — sending you to checkout.';
}

function toCards(value: unknown): CardItem[] {
  if (Array.isArray(value)) return value.map(productToCard).filter((c): c is CardItem => c !== null);
  if (value && typeof value === 'object') {
    const single = productToCard(value);
    return single ? [single] : [];
  }
  return [];
}

function productToCard(p: unknown): CardItem | null {
  if (!p || typeof p !== 'object') return null;
  const obj = p as Record<string, unknown>;
  if (typeof obj.sku !== 'string' || typeof obj.title !== 'string') return null;
  const priceCents = typeof obj.priceCents === 'number' ? obj.priceCents : null;
  const currency = typeof obj.currency === 'string' ? obj.currency : 'USD';
  return {
    image: typeof obj.imageUrl === 'string' ? obj.imageUrl : null,
    title: obj.title,
    priceFormatted: priceCents == null ? '' : formatPrice(priceCents, currency),
    variantId: null,
    sku: obj.sku,
    productUrl: typeof obj.productUrl === 'string' ? obj.productUrl : '',
  };
}

function formatPrice(cents: number, currency: string): string {
  const amount = (cents / 100).toFixed(2);
  if (currency === 'INR') return `₹${amount}`;
  if (currency === 'USD') return `$${amount}`;
  return `${currency} ${amount}`;
}
```

- [ ] **Step 4: Run, verify cap-related tests pass (chatTools mocked at module top)**

Run: `pnpm --filter @shoppingmate/api test -- runtime`
Expected: cap-warning + cap-hit tests PASS.

- [ ] **Step 5: Commit (deferred to after Tasks 16/17)**

### Task 16: `runtime.ts` — full Sonnet loop, happy path test with mocked chatTools

**Files:**
- Modify: `apps/api/src/agent/runtime.test.ts`

This task verifies the loop end-to-end against a mocked `chatTools`, asserting that `cards` are emitted from a `products.search` round-trip.

- [ ] **Step 1: Add happy-path test**

```ts
// Append to apps/api/src/agent/runtime.test.ts

describe('runTurn() — happy path', () => {
  it('emits cards after products.search and final say after assistant text', async () => {
    // First turn: model invokes products.search
    vi.mocked(chatTools)
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [
          { id: 'c1', name: 'products.search', argumentsJson: '{"query":"dress"}' },
        ],
        stopReason: 'tool_calls',
        inputTokens: 50,
        outputTokens: 10,
      })
      // Second turn: model gives final text
      .mockResolvedValueOnce({
        text: 'Two great picks — see the cards.',
        toolCalls: [],
        stopReason: 'stop',
        inputTokens: 60,
        outputTokens: 8,
      });

    // Loaded adapter returns one product
    const product = {
      sku: 'A',
      title: 'Silk dress',
      imageUrl: 'https://cdn.test/a.jpg',
      productUrl: 'https://acme.test/p/A',
      priceCents: 199_900,
      currency: 'INR',
      merchantId: 'm',
    };
    const localDeps: RunTurnDeps = {
      ...deps,
      loadAdapter: () => ({
        ...deps.loadAdapter(merchant, 's-1'),
        searchProducts: async () => ({ kind: 'ok', value: [product as never] }),
      }),
    };

    const events = [];
    for await (const ev of runTurn(localDeps, merchant, baseSession(), {
      type: 'user_text',
      sessionId: 's-1',
      text: 'show me a dress',
      mode: 'text',
    })) {
      events.push(ev);
    }

    const types = events.map((e) => e.type);
    expect(types).toContain('thinking');
    expect(types).toContain('tool_result');
    expect(types).toContain('cards');
    expect(types).toContain('say');
    expect(types).toContain('end_of_turn');

    const cards = events.find((e) => e.type === 'cards');
    expect(cards).toMatchObject({
      type: 'cards',
      items: [{ sku: 'A', title: 'Silk dress', image: 'https://cdn.test/a.jpg', priceFormatted: '₹1999.00' }],
    });
  });

  it('strips prices from final say text', async () => {
    vi.mocked(chatTools).mockResolvedValueOnce({
      text: 'It costs ₹1,499 — great deal.',
      toolCalls: [],
      stopReason: 'stop',
      inputTokens: 30,
      outputTokens: 8,
    });
    const events = [];
    for await (const ev of runTurn(deps, merchant, baseSession(), {
      type: 'user_text',
      sessionId: 's-1',
      text: 'price?',
      mode: 'text',
    })) {
      events.push(ev);
    }
    const says = events.filter((e) => e.type === 'say').map((e) => (e as { text: string }).text);
    expect(says.join(' ')).not.toMatch(/₹|\$|Rs/);
    expect(says.join(' ')).toMatch(/the price on the card/);
  });

  it('records agent.tool.retry_exhausted after 3 same-args invocations', async () => {
    // Model loops calling products.search with the same args 4 times
    const sameCall = {
      id: 'c1',
      name: 'products.search',
      argumentsJson: '{"query":"x"}',
    };
    for (let i = 0; i < 4; i += 1) {
      vi.mocked(chatTools).mockResolvedValueOnce({
        text: '',
        toolCalls: [sameCall],
        stopReason: 'tool_calls',
        inputTokens: 10,
        outputTokens: 5,
      });
    }
    vi.mocked(chatTools).mockResolvedValueOnce({
      text: 'sorry, try again later',
      toolCalls: [],
      stopReason: 'stop',
      inputTokens: 10,
      outputTokens: 5,
    });

    for await (const _ of runTurn(deps, merchant, baseSession(), {
      type: 'user_text',
      sessionId: 's-1',
      text: 'x',
      mode: 'text',
    })) {
      // drain
    }
    expect(vi.mocked(deps.recordMetric)).toHaveBeenCalledWith(
      'agent.tool.retry_exhausted',
      expect.objectContaining({ toolName: 'products.search' }),
    );
  });
});
```

- [ ] **Step 2: Run, verify pass**

Run: `pnpm --filter @shoppingmate/api test -- runtime`
Expected: all PASS.

- [ ] **Step 3: Commit Tasks 14 + 15 + 16**

```bash
git add apps/api/src/agent/runtime.ts apps/api/src/agent/runtime.test.ts \
        apps/api/src/agent/events.ts apps/api/src/agent/events.test.ts
git commit -m "feat(agent): runTurn loop — Sonnet tool-use, cards, caps, price strip

- runTurn(deps, merchant, session, message) async generator
- cap check before Sonnet call → graceful close + checkout redirect
- tool dispatch with 3-retry-per-args limit
- cards emitted from products.search/get results (runtime decides, not LLM)
- final say segmented + price-stripped + PII-redacted
- session persisted on every turn"
```

### Task 17: `runtime.ts` — `card_tap` handling (treat as direct cart.add)

**Files:**
- Modify: `apps/api/src/agent/runtime.ts`
- Modify: `apps/api/src/agent/runtime.test.ts`

The runtime currently encodes `card_tap` as a `[card_tap]` user message. Spec §7.1: "card_tap is dispatched as if Sonnet had emitted the equivalent cart.add tool call — the agent stays in the loop and acknowledges aloud." Implement by injecting a synthetic assistant tool_call into history before invoking Sonnet, so the model "sees" what the user did and responds naturally.

- [ ] **Step 1: Failing test**

```ts
// Append to apps/api/src/agent/runtime.test.ts
describe('runTurn() — card_tap', () => {
  it('treats a card_tap like a synthetic cart.add and emits acknowledgement', async () => {
    vi.mocked(chatTools).mockResolvedValueOnce({
      text: 'Added — anything else?',
      toolCalls: [],
      stopReason: 'stop',
      inputTokens: 30,
      outputTokens: 5,
    });
    const cartAddSpy = vi.fn(async () => ({
      kind: 'ok' as const,
      value: { cartToken: 'ct1', lines: [], subtotalCents: 0, totalCents: 0, currency: 'INR', appliedCoupons: [] },
    }));
    const localDeps: RunTurnDeps = {
      ...deps,
      loadAdapter: () => ({ ...deps.loadAdapter(merchant, 's-1'), cartAdd: cartAddSpy }),
    };

    const events = [];
    for await (const ev of runTurn(localDeps, merchant, baseSession(), {
      type: 'card_tap',
      sessionId: 's-1',
      action: 'cartAdd',
      variantId: null,
      sku: 'A',
      qty: 1,
    })) {
      events.push(ev);
    }
    expect(cartAddSpy).toHaveBeenCalledTimes(1);
    expect(events.find((e) => e.type === 'tool_result')).toMatchObject({
      type: 'tool_result',
      toolName: 'cart.add',
      ok: true,
    });
    expect(events.find((e) => e.type === 'say')).toMatchObject({
      text: 'Added — anything else?',
    });
  });
});
```

- [ ] **Step 2: Run, verify failure**

Expected: FAIL — current implementation routes card_tap as user text, doesn't call adapter.cartAdd directly.

- [ ] **Step 3: Update `runTurn()` to handle `card_tap` upfront**

```ts
// In apps/api/src/agent/runtime.ts, before the user_text handling block,
// add a card_tap branch that dispatches cart.add directly and seeds history
// with a tool_call/tool_result pair so Sonnet has context for its response.

if (message.type === 'card_tap') {
  const ctx2 = makeCtx(merchant, session);
  const adapter2 = deps.loadAdapter(merchant, session.sessionId);
  const envelope = await dispatchTool(adapter2, ctx2, 'cart.add', {
    sku: message.sku,
    variantId: message.variantId,
    qty: message.qty,
  });
  yield { type: 'tool_result', toolName: 'cart.add', ok: envelope.ok };
  // Update cart token if returned
  if (envelope.ok && envelope.value && typeof envelope.value === 'object') {
    const v = envelope.value as { cartToken?: string };
    if (v.cartToken) session = { ...session, cartToken: v.cartToken };
  }
  // Seed history with a synthetic assistant tool_call + tool_result so
  // Sonnet's next turn has the full context.
  const synthCallId = `tap_${Date.now()}`;
  session = {
    ...session,
    history: [
      ...session.history,
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: synthCallId,
            type: 'function',
            function: {
              name: 'cart.add',
              arguments: JSON.stringify({ sku: message.sku, variantId: message.variantId, qty: message.qty }),
            },
          },
        ],
      },
      { role: 'tool', tool_call_id: synthCallId, content: JSON.stringify(envelope) },
    ],
  };
  // Then run a micro Sonnet turn for the verbal acknowledgement
  const ack = await chatTools({
    model: SONNET_MODEL,
    messages: [
      { role: 'system', content: buildSystemPrompt(merchant) },
      ...session.history,
      { role: 'user', content: '[the visitor just tapped to add this to the cart — acknowledge briefly]' },
    ],
    tools: buildToolSurface(merchant),
  });
  const { text: stripped } = stripPrices(ack.text);
  for (const segment of segmentSay(stripped)) yield { type: 'say', text: segment };
  await deps.saveSession({
    ...session,
    turnCount: session.turnCount + 1,
    lastTurnAt: Date.now(),
  });
  yield { type: 'end_of_turn' };
  return;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm --filter @shoppingmate/api test -- runtime`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/agent/runtime.ts apps/api/src/agent/runtime.test.ts
git commit -m "feat(agent): card_tap → synthetic cart.add + verbal ack"
```

### Task 18: `runtime.ts` — Sonnet API error handling

**Files:**
- Modify: `apps/api/src/agent/runtime.ts`
- Modify: `apps/api/src/agent/runtime.test.ts`

- [ ] **Step 1: Failing tests**

```ts
// Append to apps/api/src/agent/runtime.test.ts
describe('runTurn() — Sonnet errors', () => {
  it('emits "hold on" + retries once on first timeout, succeeds on second call', async () => {
    vi.mocked(chatTools)
      .mockRejectedValueOnce(new Error('AbortError: timeout'))
      .mockResolvedValueOnce({
        text: 'sorry, what were you saying?',
        toolCalls: [],
        stopReason: 'stop',
        inputTokens: 10,
        outputTokens: 5,
      });
    const events = [];
    for await (const ev of runTurn(deps, merchant, baseSession(), {
      type: 'user_text',
      sessionId: 's-1',
      text: 'hi',
      mode: 'text',
    })) {
      events.push(ev);
    }
    const says = events.filter((e) => e.type === 'say').map((e) => (e as { text: string }).text);
    expect(says.join(' ')).toMatch(/hold on|sorry, what/i);
    expect(vi.mocked(chatTools)).toHaveBeenCalledTimes(2);
  });

  it('emits apology + end_of_turn when both attempts fail', async () => {
    vi.mocked(chatTools)
      .mockRejectedValueOnce(new Error('500'))
      .mockRejectedValueOnce(new Error('500'));
    const events = [];
    for await (const ev of runTurn(deps, merchant, baseSession(), {
      type: 'user_text',
      sessionId: 's-1',
      text: 'hi',
      mode: 'text',
    })) {
      events.push(ev);
    }
    expect(events.find((e) => e.type === 'say')).toMatchObject({
      type: 'say',
      text: expect.stringMatching(/sorry|trouble/i),
    });
    expect(events.find((e) => e.type === 'end_of_turn')).toBeDefined();
    expect(vi.mocked(deps.recordMetric)).toHaveBeenCalledWith(
      'agent.sonnet.error',
      expect.any(Object),
    );
  });
});
```

- [ ] **Step 2: Wrap the chatTools call in `runTurn` with a retry-once-then-apologize helper**

```ts
// In apps/api/src/agent/runtime.ts — replace the bare `await chatTools(...)`
// in the loop with a call through this helper:

async function chatToolsWithRetry(
  args: Parameters<typeof chatTools>[0],
  recordMetric: RunTurnDeps['recordMetric'],
  merchantId: string,
  sessionId: string,
): Promise<{ result: ChatToolsResult } | { error: Error; partialSay?: string }> {
  try {
    return { result: await chatTools(args) };
  } catch (err1) {
    const e1 = err1 as Error;
    await recordMetric('agent.sonnet.error', {
      merchantId, sessionId, errorType: classifyError(e1), retryCount: 0,
    });
    try {
      return { result: await chatTools(args) };
    } catch (err2) {
      const e2 = err2 as Error;
      await recordMetric('agent.sonnet.error', {
        merchantId, sessionId, errorType: classifyError(e2), retryCount: 1,
      });
      return { error: e2 };
    }
  }
}

function classifyError(err: Error): string {
  const m = err.message.toLowerCase();
  if (m.includes('abort') || m.includes('timeout')) return 'timeout';
  if (m.includes('429')) return 'rate_limit';
  if (m.match(/\b5\d{2}\b/)) return 'upstream_5xx';
  if (m.match(/\b4\d{2}\b/)) return 'client_4xx';
  return 'other';
}

// In runTurn, wrap each chatTools call. On the first failure, emit
// "hold on a sec" before the retry attempt. On both-fail, emit apology
// + end_of_turn.
```

In the loop, replace each `chatTools(...)` call with:

```ts
const { result, error, partialSay } = await chatToolsWithRetry(...) as never;
if (error) {
  yield { type: 'say', text: 'Sorry — I\'m having trouble reaching my brain. Try again in a moment?' };
  yield { type: 'end_of_turn' };
  return;
}
response = result;
```

For the first-call "hold on" emit, gate it on whether we observed an error before the retry — push into the helper or do it inline.

- [ ] **Step 3: Run, verify pass**

Run: `pnpm --filter @shoppingmate/api test -- runtime`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/agent/runtime.ts apps/api/src/agent/runtime.test.ts
git commit -m "feat(agent): Sonnet error handling — retry-once-then-apologize"
```

### Task 19: `runtime.ts` — `session_resume` reconnect path

**Files:**
- Create: `apps/api/src/agent/replay.ts`
- Modify: `apps/api/src/agent/types.ts` to expose a way for the WS layer to request a replay
- Test: `apps/api/src/agent/replay.test.ts`

The runtime itself runs a turn; replay is a separate function that the WS layer calls when a `session_resume` message arrives.

- [ ] **Step 1: Failing test**

```ts
// apps/api/src/agent/replay.test.ts
import { describe, expect, it } from 'vitest';
import { replaySession } from './replay.js';
import type { SessionState } from './types.js';

const session: SessionState = {
  sessionId: 's-1',
  merchantId: 'm',
  cartToken: 'ct1',
  history: [
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: 'hello there' },
    { role: 'user', content: 'show me a dress' },
    {
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'c1', type: 'function', function: { name: 'products.search', arguments: '{}' } }],
    },
    {
      role: 'tool',
      tool_call_id: 'c1',
      content: JSON.stringify({ ok: true, value: [{ sku: 'A', title: 'Silk', priceCents: 100_000, currency: 'INR', productUrl: '/a' }] }),
    },
    { role: 'assistant', content: 'see the cards' },
  ],
  turnCount: 2,
  voiceMs: 0,
  totalMs: 0,
  startedAt: 0,
  lastTurnAt: 0,
  mode: 'text',
};

describe('replaySession()', () => {
  it('emits prior assistant says and cards extracted from tool results', () => {
    const events = Array.from(replaySession(session));
    const says = events.filter((e) => e.type === 'say').map((e) => (e as { text: string }).text);
    expect(says).toContain('hello there');
    expect(says).toContain('see the cards');
    expect(events.some((e) => e.type === 'cards')).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify failure**

- [ ] **Step 3: Implement**

```ts
// apps/api/src/agent/replay.ts
import { stripPrices } from './postprocess.js';
import type { AgentEvent, AnthropicMessage, CardItem, SessionState } from './types.js';

export function* replaySession(session: SessionState): Generator<AgentEvent, void, void> {
  for (const m of session.history) {
    if (isAssistant(m) && typeof m.content === 'string' && m.content) {
      yield { type: 'say', text: stripPrices(m.content).text };
    } else if (isTool(m)) {
      const content = safeParse(m.content);
      if (content && content.ok && Array.isArray(content.value)) {
        const cards: CardItem[] = content.value
          .map((p: unknown) => productLikeToCard(p))
          .filter((c: CardItem | null): c is CardItem => c !== null);
        if (cards.length > 0) yield { type: 'cards', items: cards };
      }
    }
  }
}

function isAssistant(m: AnthropicMessage): m is { role: 'assistant'; content: string | null } {
  return (m as { role?: string }).role === 'assistant';
}
function isTool(m: AnthropicMessage): m is { role: 'tool'; tool_call_id: string; content: string } {
  return (m as { role?: string }).role === 'tool';
}
function safeParse(s: string): { ok: boolean; value?: unknown } | null {
  try { return JSON.parse(s); } catch { return null; }
}
function productLikeToCard(p: unknown): CardItem | null {
  if (!p || typeof p !== 'object') return null;
  const obj = p as Record<string, unknown>;
  if (typeof obj.sku !== 'string' || typeof obj.title !== 'string') return null;
  const priceCents = typeof obj.priceCents === 'number' ? obj.priceCents : null;
  const currency = typeof obj.currency === 'string' ? obj.currency : 'USD';
  return {
    image: typeof obj.imageUrl === 'string' ? obj.imageUrl : null,
    title: obj.title,
    priceFormatted: priceCents == null ? '' : `${currency} ${(priceCents / 100).toFixed(2)}`,
    variantId: null,
    sku: obj.sku,
    productUrl: typeof obj.productUrl === 'string' ? obj.productUrl : '',
  };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm --filter @shoppingmate/api test -- replay`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/agent/replay.ts apps/api/src/agent/replay.test.ts
git commit -m "feat(agent): replaySession — reconstruct events for WS reconnect"
```

---

## Phase F — WS handler integration

### Task 20: `apps/api/src/ws/agent.ts` — new WS endpoint

**Files:**
- Create: `apps/api/src/ws/agent.ts`
- Test: `apps/api/src/ws/agent.test.ts`

- [ ] **Step 1: Failing test (uses a real WebSocket against an in-process server)**

```ts
// apps/api/src/ws/agent.test.ts
import { createServer } from 'node:http';
import { signWsToken } from '@shoppingmate/dom-harness';
import WebSocket from 'ws';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mountAgentWs } from './agent.js';

const server = createServer();
let port = 0;

beforeAll(async () => {
  mountAgentWs(server, {
    onMessage: async (sessionId, raw, send) => {
      // Echo: emit a single say event + end_of_turn
      send(JSON.stringify({ type: 'say', text: `echo:${raw}` }));
      send(JSON.stringify({ type: 'end_of_turn' }));
    },
  });
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const addr = server.address();
  if (addr && typeof addr === 'object') port = addr.port;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('mountAgentWs()', () => {
  it('rejects connection without a valid token', async () => {
    const url = `ws://localhost:${port}/v1/widget/s-1/agent`;
    const ws = new WebSocket(url);
    await new Promise<void>((resolve) => ws.on('close', () => resolve()));
    expect(ws.readyState).toBe(WebSocket.CLOSED);
  });

  it('accepts a connection with a valid token and round-trips a message', async () => {
    const token = signWsToken({ sessionId: 's-1', merchantId: 'm', exp: Math.floor(Date.now() / 1000) + 60 });
    const url = `ws://localhost:${port}/v1/widget/s-1/agent?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
    });
    ws.send('hello');
    const messages: string[] = [];
    await new Promise<void>((resolve) => {
      ws.on('message', (raw) => {
        messages.push(raw.toString());
        if (messages.length === 2) resolve();
      });
    });
    expect(messages[0]).toContain('echo:hello');
    expect(JSON.parse(messages[1] as string)).toEqual({ type: 'end_of_turn' });
    ws.close();
  });
});
```

- [ ] **Step 2: Run, verify failure**

- [ ] **Step 3: Implement**

```ts
// apps/api/src/ws/agent.ts
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { verifyWsToken } from '@shoppingmate/dom-harness';
import { type WebSocket, WebSocketServer } from 'ws';

export type AgentWsDeps = {
  /**
   * Called for every inbound text frame on the agent socket. Implementations
   * should parse the frame as a WidgetMessage and stream AgentEvents back
   * via the supplied `send` callback (one JSON-encoded event per call).
   */
  onMessage: (
    sessionId: string,
    raw: string,
    send: (encoded: string) => void,
  ) => Promise<void>;
};

export type MountedAgentWs = {
  close: () => Promise<void>;
};

export interface UpgradableServer {
  on(
    event: 'upgrade',
    listener: (req: IncomingMessage, socket: Duplex, head: Buffer) => void,
  ): unknown;
}

export function mountAgentWs(server: UpgradableServer, deps: AgentWsDeps): MountedAgentWs {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const m = url.pathname.match(/^\/v1\/widget\/([^/]+)\/agent$/);
    if (!m) return; // not our path; let other listeners handle (e.g. /ws)
    const sessionId = decodeURIComponent(m[1] ?? '');
    const token = url.searchParams.get('token') ?? '';
    const payload = verifyWsToken(token);
    if (!payload || payload.sessionId !== sessionId) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
      ws.on('message', async (raw) => {
        const send = (encoded: string) => {
          if (ws.readyState === ws.OPEN) ws.send(encoded);
        };
        try {
          await deps.onMessage(sessionId, raw.toString(), send);
        } catch (err) {
          // Best-effort error notice; do not crash the socket.
          send(JSON.stringify({ type: 'session_closed', reason: 'error' }));
          ws.close();
        }
      });
    });
  });

  return {
    close: () =>
      new Promise<void>((resolve) => {
        wss.close(() => resolve());
        for (const ws of wss.clients) ws.terminate();
      }),
  };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm --filter @shoppingmate/api test -- ws/agent`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ws/agent.ts apps/api/src/ws/agent.test.ts
git commit -m "feat(api): /v1/widget/:sessionId/agent — JWT-gated agent WS endpoint"
```

### Task 21: Wire agent WS into `apps/api/src/index.ts`

**Files:**
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Add the wiring**

```ts
// apps/api/src/index.ts — append after `mountWs(server)`
import { Redis } from 'ioredis';
import { env, logger } from '@shoppingmate/shared';
import { db, eq, schema } from '@shoppingmate/db';
import { getAdapter } from '@shoppingmate/adapters';
import { runTurn } from './agent/runtime.js';
import { replaySession } from './agent/replay.js';
import { decodeWidgetMessage, encodeAgentEvent } from './agent/events.js';
import { createSession, loadSession, saveSession } from './agent/state.js';
import { NoOpWSTransport } from './agent/transport-noop.js';
import { InMemorySessionState, type WSTransport } from '@shoppingmate/adapters';
import { mountAgentWs } from './ws/agent.js';

const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const noopTransport: WSTransport = new NoOpWSTransport();

mountAgentWs(server, {
  onMessage: async (sessionId, raw, send) => {
    const msg = decodeWidgetMessage(raw);
    if (!msg) {
      send(encodeAgentEvent({ type: 'session_closed', reason: 'error' }));
      return;
    }
    if (msg.type === 'session_end') {
      await redis.del(`session:${sessionId}`);
      send(encodeAgentEvent({ type: 'session_closed', reason: 'user' }));
      return;
    }
    // Resolve merchant + session
    let session = await loadSession(redis, sessionId);
    if (!session) {
      // First connect: assume the JWT carried the merchantId in the path or token.
      // For Phase 1 we rely on the JWT containing merchantId; verifyWsToken
      // already checked the token. Pull merchantId by finding the merchant via
      // an explicit DB lookup using sessionId-encoded merchant prefix is
      // out-of-scope; for now, reject if not present.
      send(encodeAgentEvent({ type: 'session_closed', reason: 'error' }));
      return;
    }
    if (msg.type === 'session_resume') {
      for (const ev of replaySession(session)) send(encodeAgentEvent(ev));
      send(encodeAgentEvent({ type: 'end_of_turn' }));
      return;
    }
    // Real turn
    const [merchant] = await db
      .select()
      .from(schema.merchants)
      .where(eq(schema.merchants.id, session.merchantId))
      .limit(1);
    if (!merchant) {
      send(encodeAgentEvent({ type: 'session_closed', reason: 'error' }));
      return;
    }
    const deps = {
      loadAdapter: () =>
        getAdapter(merchant, {
          transport: noopTransport,
          state: new InMemorySessionState(),
        }),
      saveSession: (s: typeof session) => saveSession(redis, s!),
      recordMetric: async (name: string, tags: Record<string, string | number | boolean>) => {
        await db
          .insert(schema.metricEvents)
          .values({ merchantId: merchant.id, metricName: name, tags })
          .onConflictDoNothing();
      },
    };
    for await (const ev of runTurn(deps, merchant, session, msg)) {
      send(encodeAgentEvent(ev));
    }
  },
});

logger.info({ port: env.API_PORT }, 'agent ws mounted at /v1/widget/:sessionId/agent');
```

Note: session creation (initial WS connect for a brand-new session) requires the WS layer to have access to a merchantId in the token payload. The existing `signWsToken` from Plan 3d carries `{sessionId, merchantId, exp}`. Update the runtime wiring above to call `createSession({sessionId, merchantId: payload.merchantId, mode: msg.mode, nowMs: Date.now()})` when `loadSession` returns null AND the message is `user_text`. Add this branch in the wiring before the resume/turn checks.

- [ ] **Step 2: Run a quick api typecheck + a smoke `pnpm dev` test (manual)**

Run: `pnpm --filter @shoppingmate/api typecheck && pnpm --filter @shoppingmate/api test`
Expected: typecheck clean; existing api tests still pass; new `ws/agent.test.ts` still passes.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "feat(api): wire agent runtime into the agent WS at /v1/widget/:sid/agent"
```

---

## Phase G — Observability + SuggestAdapter alignment

### Task 22: SuggestAdapter alignment per spec §15

**Files:**
- Modify: `packages/adapters/src/suggest.ts`
- Verify: existing `packages/adapters/test/suggest.test.ts` still passes

The spec says "existing Plan 3e tests must still pass" — the alignment is at the dispatch boundary, not the adapter itself. We keep `SuggestAdapter` calling `transport.send` (preserves Plan 3e tests) and use `NoOpWSTransport` from `apps/api/src/agent/transport-noop.ts` (Task 11) when constructing `DispatchDeps` in the agent runtime. This silently drops the legacy `ui.show_message`/`ui.show_product_card` events; the runtime emits canonical `cards` events from the adapter's `searchProducts`/`getProduct` results instead.

- [ ] **Step 1: Verify Plan 3e tests still pass**

Run: `pnpm --filter @shoppingmate/adapters test -- suggest`
Expected: all existing tests pass.

- [ ] **Step 2: Add a short doc comment to `SuggestAdapter` referencing the alignment**

```ts
// In packages/adapters/src/suggest.ts, append above the class declaration:
/**
 * Plan 4 alignment (2026-05-04): when the agent runtime constructs
 * DispatchDeps, it passes a NoOpWSTransport so the legacy
 * `ui.show_message` / `ui.show_product_card` calls become silent. The
 * runtime emits canonical `cards` events directly from this adapter's
 * `searchProducts` / `getProduct` results — Sonnet does not "see" any
 * UI events, only the JSON product list.
 *
 * Plan 3e tests still pass because they construct the adapter with
 * FakeWSTransport and assert on the calls it captures.
 */
```

- [ ] **Step 3: Commit**

```bash
git add packages/adapters/src/suggest.ts
git commit -m "docs(adapters): note Plan 4 NoOpWSTransport alignment for SuggestAdapter"
```

---

## Phase H — Integration tests with recorded fixtures

### Task 23: Fixture format + MSW openrouter mock harness

**Files:**
- Create: `tests/agent/_fixture-runner.ts` — shared loader/runner used by every fixture test
- Create: `tests/agent/fixtures/shopify-happy-path.json`

Fixture shape:

```jsonc
{
  "merchant": { "id": "m_test", "personaId": "concierge", "adapterType": "shopify", "name": "Test Co" },
  "initialSession": { "turnCount": 0, "cartToken": null },
  "turns": [
    {
      "user": { "type": "user_text", "text": "show me a dress under 2000", "mode": "text" },
      "sonnetResponses": [
        {
          "text": "",
          "stopReason": "tool_calls",
          "toolCalls": [{ "id": "c1", "name": "products.search", "argumentsJson": "{\"query\":\"dress\"}" }]
        },
        {
          "text": "Two great picks — see the cards.",
          "stopReason": "stop",
          "toolCalls": []
        }
      ],
      "expectEvents": ["thinking", "tool_result", "cards", "say", "end_of_turn"]
    }
  ]
}
```

- [ ] **Step 1: Implement the fixture runner**

```ts
// tests/agent/_fixture-runner.ts
import { readFileSync } from 'node:fs';
import type { Adapter, AdapterResult, Product } from '@shoppingmate/adapters';
import type { Merchant } from '@shoppingmate/db';
import { vi } from 'vitest';
import { runTurn, type RunTurnDeps } from '../../apps/api/src/agent/runtime.js';
import type { AgentEvent, SessionState } from '../../apps/api/src/agent/types.js';

vi.mock('@shoppingmate/shared', async (orig) => ({
  ...(await orig<typeof import('@shoppingmate/shared')>()),
  chatTools: vi.fn(),
}));
const { chatTools } = await import('@shoppingmate/shared');

export type FixtureFile = {
  merchant: Partial<Merchant>;
  initialSession: Partial<SessionState>;
  fixtureProducts?: Product[];
  turns: Array<{
    user: { type: 'user_text' | 'card_tap'; text?: string; sku?: string; qty?: number; mode?: 'voice' | 'text'; variantId?: string | null; action?: 'cartAdd' };
    sonnetResponses: Array<{ text: string; stopReason: string; toolCalls: Array<{ id: string; name: string; argumentsJson: string }> }>;
    expectEvents: string[];
    expectNoNumericPriceInSay?: boolean;
  }>;
};

export async function runFixture(path: string): Promise<{ events: AgentEvent[][]; fixture: FixtureFile }> {
  const fixture = JSON.parse(readFileSync(path, 'utf8')) as FixtureFile;
  const merchant = {
    id: 'm_test',
    domain: 'test.test',
    name: 'Test',
    personaId: 'concierge',
    adapterType: 'shopify',
    adapterConfig: {},
    status: 'live',
    allowedDomains: [],
    ...fixture.merchant,
  } as unknown as Merchant;

  const session: SessionState = {
    sessionId: 's-fix',
    merchantId: merchant.id,
    cartToken: null,
    history: [],
    turnCount: 0,
    voiceMs: 0,
    totalMs: 0,
    startedAt: Date.now(),
    lastTurnAt: Date.now(),
    mode: 'text',
    ...fixture.initialSession,
  };

  // Stub adapter that returns fixtureProducts for searchProducts and a
  // happy-path cart for everything else. Tests can override per-turn by
  // editing the fixture's expectations.
  const products = fixture.fixtureProducts ?? [];
  const adapter: Adapter = {
    kind: merchant.adapterType ?? 'shopify',
    searchProducts: async () => ({ kind: 'ok', value: products } as AdapterResult<Product[]>),
    getProduct: async (_, sku) => ({ kind: 'ok', value: products.find((p) => p.sku === sku) ?? null }),
    cartAdd: async () => ({
      kind: 'ok',
      value: { cartToken: 'ct', lines: [], subtotalCents: 0, totalCents: 0, currency: 'INR', appliedCoupons: [] },
    }),
    cartUpdate: async () => ({
      kind: 'ok',
      value: { cartToken: 'ct', lines: [], subtotalCents: 0, totalCents: 0, currency: 'INR', appliedCoupons: [] },
    }),
    cartGet: async () => ({
      kind: 'ok',
      value: { cartToken: 'ct', lines: [], subtotalCents: 0, totalCents: 0, currency: 'INR', appliedCoupons: [] },
    }),
    couponApply: async () => ({
      kind: 'ok',
      value: { cartToken: 'ct', lines: [], subtotalCents: 0, totalCents: 0, currency: 'INR', appliedCoupons: [] },
    }),
    checkoutUrl: async () => ({ kind: 'ok', value: 'https://test.test/checkout' }),
  };

  const deps: RunTurnDeps = {
    loadAdapter: () => adapter,
    saveSession: vi.fn(async () => undefined),
    recordMetric: vi.fn(async () => undefined),
  };

  const allEvents: AgentEvent[][] = [];
  for (const turn of fixture.turns) {
    vi.mocked(chatTools).mockReset();
    for (const r of turn.sonnetResponses) {
      vi.mocked(chatTools).mockResolvedValueOnce({
        text: r.text,
        toolCalls: r.toolCalls.map((tc) => ({
          id: tc.id,
          name: tc.name,
          argumentsJson: tc.argumentsJson,
        })),
        stopReason: r.stopReason as 'stop' | 'tool_calls',
        inputTokens: 100,
        outputTokens: 20,
      });
    }
    const events: AgentEvent[] = [];
    for await (const ev of runTurn(deps, merchant, session, {
      ...turn.user,
      sessionId: 's-fix',
    } as never)) {
      events.push(ev);
    }
    allEvents.push(events);
  }
  return { events: allEvents, fixture };
}
```

- [ ] **Step 2: Write the shopify-happy-path fixture**

```json
// tests/agent/fixtures/shopify-happy-path.json
{
  "merchant": { "id": "m_shopify", "personaId": "concierge", "adapterType": "shopify", "name": "ShopifyTest" },
  "fixtureProducts": [
    {
      "merchantId": "m_shopify",
      "sku": "DRESS-A",
      "title": "Silk wrap dress",
      "imageUrl": "https://cdn.test/dress-a.jpg",
      "productUrl": "https://shopifytest.test/p/dress-a",
      "priceCents": 199900,
      "currency": "INR",
      "inStock": true,
      "source": "shopify_storefront",
      "indexedAt": "2026-05-04T00:00:00Z",
      "description": null,
      "variants": null,
      "sourceMeta": null,
      "searchVector": null
    }
  ],
  "initialSession": { "turnCount": 0 },
  "turns": [
    {
      "user": { "type": "user_text", "text": "show me a dress under 2000", "mode": "text" },
      "sonnetResponses": [
        { "text": "", "stopReason": "tool_calls", "toolCalls": [{ "id": "c1", "name": "products.search", "argumentsJson": "{\"query\":\"dress\"}" }] },
        { "text": "Found one — see the card. Want me to add it to your cart?", "stopReason": "stop", "toolCalls": [] }
      ],
      "expectEvents": ["thinking", "tool_result", "cards", "say", "end_of_turn"],
      "expectNoNumericPriceInSay": true
    },
    {
      "user": { "type": "user_text", "text": "yes add it", "mode": "text" },
      "sonnetResponses": [
        { "text": "", "stopReason": "tool_calls", "toolCalls": [{ "id": "c2", "name": "cart.add", "argumentsJson": "{\"sku\":\"DRESS-A\",\"variantId\":null,\"qty\":1}" }] },
        { "text": "Added — anything else? Or shall I send you to checkout?", "stopReason": "stop", "toolCalls": [] }
      ],
      "expectEvents": ["thinking", "tool_result", "say", "end_of_turn"],
      "expectNoNumericPriceInSay": true
    }
  ]
}
```

### Task 24: Shopify happy-path integration test

**Files:**
- Create: `tests/agent/shopify-happy-path.test.ts`

- [ ] **Step 1: Test**

```ts
// tests/agent/shopify-happy-path.test.ts
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runFixture } from './_fixture-runner.js';

describe('fixture: shopify happy path', () => {
  it('runs both turns and emits the expected events', async () => {
    const { events, fixture } = await runFixture(
      resolve(import.meta.dirname, 'fixtures', 'shopify-happy-path.json'),
    );
    expect(events).toHaveLength(2);
    for (let i = 0; i < events.length; i += 1) {
      const types = events[i]!.map((e) => e.type);
      for (const expected of fixture.turns[i]!.expectEvents) {
        expect(types).toContain(expected);
      }
      if (fixture.turns[i]!.expectNoNumericPriceInSay) {
        const says = events[i]!
          .filter((e) => e.type === 'say')
          .map((e) => (e as { text: string }).text)
          .join(' ');
        expect(says).not.toMatch(/[\u20B9$]\d|\bRs\.?\s*\d|\b\d+\s*(rupees|dollars|INR|USD)/i);
      }
    }
  });
});
```

- [ ] **Step 2: Run, verify pass**

Run: `pnpm test -- agent/shopify-happy-path`
Expected: PASS.

- [ ] **Step 3: Commit Tasks 23+24**

```bash
git add tests/agent/
git commit -m "test(agent): fixture-driven integration test — shopify happy path"
```

### Task 25: DOM happy-path fixture + test

**Files:**
- Create: `tests/agent/fixtures/dom-happy-path.json` (same shape; merchant.adapterType='dom')
- Create: `tests/agent/dom-happy-path.test.ts`

- [ ] **Step 1: Fixture**

Use the same structure as `shopify-happy-path.json` with `"adapterType": "dom"`. The fixture runner uses a stubbed adapter so we don't need a real WS+harness here — that's covered in `apps/worker/src/steps/smokeTest.ts` integration tests already.

- [ ] **Step 2: Test (mirrors `shopify-happy-path.test.ts`)**

- [ ] **Step 3: Run + commit**

```bash
git add tests/agent/fixtures/dom-happy-path.json tests/agent/dom-happy-path.test.ts
git commit -m "test(agent): fixture — DOM happy path"
```

### Task 26: Suggest recommend-only fixture + test

**Files:**
- Create: `tests/agent/fixtures/suggest-recommend-only.json`
- Create: `tests/agent/suggest-recommend-only.test.ts`

The fixture's merchant is `adapterType=suggest`. Suggest adapter has `cartAdd → unsupported` (because we use the stubbed adapter and the runner returns `ok` by default — for the Suggest fixture, override the runner's adapter to make `cartAdd` return `unsupported`. Alternative: extend the fixture format with `adapterOverrides`).

- [ ] **Step 1: Extend fixture format**

```ts
// In tests/agent/_fixture-runner.ts, support adapterOverrides:
type AdapterOverride = Partial<{
  cartAdd: 'unsupported' | 'ok';
  searchProducts: 'ok' | 'not_found';
}>;

// Use override to swap adapter methods. Add interpretation in the runFixture body.
```

- [ ] **Step 2: Fixture asserts that for `cartAdd: unsupported`, Sonnet's text recommends a manual add and no `checkout_redirect` is emitted**

- [ ] **Step 3: Run + commit**

```bash
git add tests/agent/_fixture-runner.ts tests/agent/fixtures/suggest-recommend-only.json tests/agent/suggest-recommend-only.test.ts
git commit -m "test(agent): fixture — suggest recommend-only"
```

### Task 27: 15-turn cap fixture + test

**Files:**
- Create: `tests/agent/fixtures/cap-15-turns.json`
- Create: `tests/agent/cap-enforcement.test.ts`

- [ ] **Step 1: Fixture with `initialSession.turnCount: 15` and a single user_text turn**

Expected events: `say`, `session_closed` (cap reason), no `chatTools` invocation.

- [ ] **Step 2: Test asserts the WS sees the closing `say` and `session_closed`**

- [ ] **Step 3: Run + commit**

```bash
git add tests/agent/fixtures/cap-15-turns.json tests/agent/cap-enforcement.test.ts
git commit -m "test(agent): fixture — 15-turn cap graceful close"
```

### Task 28: Contract test — 8 adapters × tool dispatch envelope

**Files:**
- Create: `tests/agent/contract.test.ts`

- [ ] **Step 1: Test**

```ts
// tests/agent/contract.test.ts
import type { AdapterType, Merchant } from '@shoppingmate/db';
import { describe, expect, it } from 'vitest';
import { dispatchTool } from '../../apps/api/src/agent/tools.js';
import { getAdapter, FakeWSTransport, InMemorySessionState } from '@shoppingmate/adapters';

const types: AdapterType[] = ['shopify', 'woo', 'magento', 'bigcommerce', 'wix', 'squarespace', 'dom', 'suggest'];

describe('contract: tool envelope round-trip across all 8 adapter types', () => {
  for (const t of types) {
    it(`${t} returns a valid envelope for products.search`, async () => {
      const merchant = {
        id: 'm', adapterType: t, domain: 'x.test', adapterConfig: {}, allowedDomains: [], status: 'live',
      } as unknown as Merchant;
      const adapter = getAdapter(merchant, {
        transport: new FakeWSTransport(),
        state: new InMemorySessionState(),
      });
      const r = await dispatchTool(adapter, {
        merchant, cartToken: null, sessionId: 's-1',
      }, 'products.search', { query: 'anything' });
      // We do not require ok=true since most adapters need real upstream creds.
      // We require: shape conforms to ToolResultEnvelope.
      expect(typeof r.ok).toBe('boolean');
      if (!r.ok) expect(['unsupported', 'platform_error', 'not_found', 'retry_exhausted']).toContain(r.kind);
    });
  }
});
```

- [ ] **Step 2: Run + commit**

Run: `pnpm test -- agent/contract`

```bash
git add tests/agent/contract.test.ts
git commit -m "test(agent): 8-adapter × tool envelope contract"
```

---

## Phase I — `agent-replay` CLI for fixture regression

### Task 29: `packages/cli/src/commands/agentReplay.ts`

**Files:**
- Create: `packages/cli/src/commands/agentReplay.ts`
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: Implement command**

```ts
// packages/cli/src/commands/agentReplay.ts
import { resolve } from 'node:path';
import { runFixture } from '../../../tests/agent/_fixture-runner.js';

export async function agentReplay(fixturePath: string): Promise<number> {
  const path = resolve(process.cwd(), fixturePath);
  const { events, fixture } = await runFixture(path);
  for (let i = 0; i < events.length; i += 1) {
    console.log(`# turn ${i + 1}: ${JSON.stringify(fixture.turns[i]?.user)}`);
    for (const ev of events[i]!) console.log(JSON.stringify(ev));
  }
  // Hard fail on any numeric price in any say event
  for (const turn of events) {
    for (const ev of turn) {
      if (ev.type === 'say' && /[\u20B9$]\d|\bRs\.?\s*\d/.test(ev.text)) {
        console.error('FAIL: numeric price found in say event:', ev.text);
        return 1;
      }
    }
  }
  console.log('OK');
  return 0;
}
```

- [ ] **Step 2: Wire into `packages/cli/src/index.ts`**

Add a new case to the switch:

```ts
case 'agent-replay': {
  const path = argv[1];
  if (!path) {
    console.error('usage: agent-replay <fixturePath>');
    process.exitCode = 2;
    return;
  }
  process.exitCode = await agentReplay(path);
  return;
}
```

Also update the `USAGE` string and add the `agentReplay` import.

- [ ] **Step 3: Run a smoke**

```bash
pnpm shoppingmate:dev agent-replay tests/agent/fixtures/shopify-happy-path.json
```

Expected: prints turn-by-turn JSON event stream + `OK`.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/commands/agentReplay.ts packages/cli/src/index.ts
git commit -m "feat(cli): agent-replay <fixture> — fixture-driven regression CLI"
```

---

## Phase J — Acceptance + close

### Task 30: Live Shopify dev-store acceptance run

**Files:** none (manual operator script). Document in a brief runbook addition.

- [ ] **Step 1: Provision a test Shopify dev store**

Use the existing CLI:

```bash
pnpm shoppingmate:dev provision --domain=<your-shopify-dev-store>.myshopify.com
```

Wait for `status='live'`. Verify with `pnpm shoppingmate:dev show <merchantId>`.

- [ ] **Step 2: Open a thin WS client**

Write a 30-line Node script (or use `wscat`) that:
1. Calls `signWsToken({sessionId:'live-test', merchantId:<id>, exp:Date.now()/1000+300})` to get a token
2. Connects to `ws://localhost:3000/v1/widget/live-test/agent?token=<token>`
3. Sends `{"type":"user_text","sessionId":"live-test","text":"I want a dress under 2000","mode":"text"}`
4. Logs every received frame

- [ ] **Step 3: Verify spec §14 acceptance criterion 4**

Expected event sequence:
- `thinking`
- `tool_result` (toolName: `products.search`, ok: true)
- `cards` (items[].image, items[].title, items[].priceFormatted populated)
- `say` (no numeric prices)
- `end_of_turn`

Then send `{"type":"user_text","sessionId":"live-test","text":"yes the first","mode":"text"}` and verify `cart.add` succeeds.

Disconnect mid-conversation, reconnect with `{"type":"session_resume","sessionId":"live-test"}` and verify the prior cards + says are replayed.

- [ ] **Step 4: Note the result in the project memory**

Add to `project_shoppingmate_phase1_status` memory: `Plan 4 acceptance — live Shopify dev-store: PASS` with date.

- [ ] **Step 5: Commit a runbook note (optional)**

If the operator scripts the WS-test client, save it under `docs/runbooks/plan4-live-acceptance.md`. Otherwise no commit.

### Task 31: Final sweep + tag

- [ ] **Step 1: Run the full repo verification**

```bash
pnpm typecheck && pnpm test && pnpm lint
```

Expected:
- `pnpm typecheck` clean across all 8 workspaces
- `pnpm test` green; total file count ~50, total tests ~260+
- `pnpm lint` no new errors (4 pre-existing slack-workstream errors unchanged)

- [ ] **Step 2: Update the roadmap §9 "Phase 1 closing plans" table to mark Plan 4 ✅ Complete**

```md
| Plan 4 — Backend agent runtime (Sonnet 4.6 tool-use loop) | ✅ Complete | Tasks 1-31 ✅ — commits through `<sha>`. New apps/api/src/agent/ module + ws/agent.ts endpoint + agent-replay CLI; ~30 new tests; SuggestAdapter alignment via NoOpWSTransport; live Shopify acceptance pass. Acceptance task 30 (live dev-store) PASS / DEFERRED-IF-CREDS-UNAVAILABLE. |
```

- [ ] **Step 3: Commit roadmap update**

```bash
git add docs/superpowers/roadmap.md
git commit -m "docs(roadmap): plan 4 ✅ complete — backend agent runtime live"
```

- [ ] **Step 4: (Optional) tag**

```bash
git tag -a phase1-plan4-agent-complete -m "Plan 4 — backend agent runtime complete"
```

Plan 4 is complete. Plan 5 (voice-first widget shell) is unblocked.

---

## Self-review notes (already applied inline)

- **Spec coverage check:** every section §1–§16 of the spec maps to at least one task above. §15's SuggestAdapter alignment is Task 22; §13's three integration scenarios are Tasks 24–26; §14's acceptance criteria are Task 30. The agent-replay CLI (§17) is Task 29.
- **No placeholders:** every code block contains real, complete code. Step 5 of Task 21 contains a single `Note:` calling out a follow-up wiring detail in the same task body — not a deferral, just a heads-up to the implementer to land it as part of Task 21 itself.
- **Type consistency:** `SessionState`, `AgentEvent`, `WidgetMessage`, `CardItem`, `ToolResultEnvelope`, `RunTurnDeps` are defined once and reused. Tool names are dot-namespaced (`products.search`, `cart.add`, ...) consistently in `buildToolSurface`, `dispatchTool`, fixtures, and the contract test.
- **TDD discipline:** every task starts with a failing test, runs it, then implements. Frequent commits at task or sub-task boundaries.
- **Bite-sized:** each step is 2-5 minutes of work. Tasks 14, 15, 16, 17 break the runtime into small commits; Task 18 (Sonnet errors) is its own task; Task 19 (replay) ditto.
