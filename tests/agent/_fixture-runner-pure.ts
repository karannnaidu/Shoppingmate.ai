// Pure (vitest-free) fixture runner. Used by both:
//   - tests/agent/_fixture-runner.ts (vitest variant — wraps a `vi.fn()` queue)
//   - packages/cli/src/commands/agentReplay.ts (CLI replay — builds a queue impl by hand)
//
// Importing this file at runtime must not depend on vitest.
import { readFileSync } from 'node:fs';
import type { Adapter, AdapterResult } from '@shoppingmate/adapters';
import type { Merchant, Product } from '@shoppingmate/db';
import type { ChatToolsResult, chatTools as chatToolsType } from '@shoppingmate/shared';
import { type AgentEvent, type RunTurnDeps, type SessionState, type WidgetMessage, runTurn } from '@shoppingmate/agent';

export type FixtureSonnetResponse = {
  text: string;
  stopReason: string;
  toolCalls: Array<{ id: string; name: string; argumentsJson: string }>;
};

export type FixtureUserTurn =
  | { type: 'user_text'; text: string; mode?: 'voice' | 'text' }
  | { type: 'card_tap'; sku: string; qty: number; variantId?: string | null; action?: 'cartAdd' };

export type FixtureTurn = {
  user: FixtureUserTurn;
  sonnetResponses: FixtureSonnetResponse[];
  expectEvents: string[];
  expectNoNumericPriceInSay?: boolean;
};

export type FixtureFile = {
  merchant: Partial<Merchant>;
  initialSession: Partial<SessionState>;
  fixtureProducts?: Product[];
  adapterOverrides?: {
    cartAdd?: 'unsupported' | 'ok';
    searchProducts?: 'ok' | 'not_found';
  };
  turns: FixtureTurn[];
};

export type RunFixturePureResult = {
  events: AgentEvent[][];
  fixture: FixtureFile;
  savedSessions: SessionState[];
  recordedMetrics: Array<{
    name: string;
    tags: Record<string, string | number | boolean>;
    value?: number;
  }>;
};

function emptyCart(): {
  cartToken: string;
  lines: never[];
  subtotalCents: number;
  totalCents: number;
  currency: string;
  appliedCoupons: never[];
} {
  return {
    cartToken: 'ct',
    lines: [],
    subtotalCents: 0,
    totalCents: 0,
    currency: 'INR',
    appliedCoupons: [],
  };
}

export function loadFixture(path: string): FixtureFile {
  return JSON.parse(readFileSync(path, 'utf8')) as FixtureFile;
}

/**
 * Build a `chatTools` implementation that pulls from a per-call queue. Each
 * invocation shifts the next response off the queue. Throws if the queue is
 * exhausted (signals a fixture/runtime mismatch).
 */
export function makeQueuedChatTools(queue: ChatToolsResult[]): typeof chatToolsType {
  return async () => {
    const next = queue.shift();
    if (!next) {
      throw new Error('chatTools queue exhausted — fixture and runtime out of sync');
    }
    return next;
  };
}

/**
 * Run a fixture from disk against the real `runTurn` runtime, using the
 * caller-supplied `chatToolsImpl`. The vitest-aware sibling `runFixture`
 * wraps this and supplies a `vi.fn()`-backed impl so existing tests can keep
 * asserting on `vi.mocked(chatTools).mock.calls`.
 */
export async function runFixturePure(
  path: string,
  chatToolsImpl: typeof chatToolsType,
): Promise<RunFixturePureResult> {
  const fixture = loadFixture(path);

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

  const products = fixture.fixtureProducts ?? [];
  const overrides = fixture.adapterOverrides ?? {};

  const cartAddResult: AdapterResult<ReturnType<typeof emptyCart>> =
    overrides.cartAdd === 'unsupported'
      ? { kind: 'unsupported', reason: 'cart-less adapter' }
      : { kind: 'ok', value: emptyCart() };

  const searchResult: AdapterResult<Product[]> =
    overrides.searchProducts === 'not_found'
      ? { kind: 'ok', value: [] }
      : { kind: 'ok', value: products };

  const adapter: Adapter = {
    kind: (merchant.adapterType ?? 'shopify') as Adapter['kind'],
    searchProducts: async () => searchResult,
    getProduct: async (_ctx, sku) => ({
      kind: 'ok',
      value: products.find((p) => p.sku === sku) ?? null,
    }),
    cartAdd: async () => cartAddResult,
    cartUpdate: async () => ({ kind: 'ok', value: emptyCart() }),
    cartGet: async () => ({ kind: 'ok', value: emptyCart() }),
    couponApply: async () => ({ kind: 'ok', value: emptyCart() }),
    checkoutUrl: async () => ({ kind: 'ok', value: 'https://test.test/checkout' }),
  };

  const savedSessions: SessionState[] = [];
  const recordedMetrics: RunFixturePureResult['recordedMetrics'] = [];

  const deps: RunTurnDeps = {
    loadAdapter: () => adapter,
    saveSession: async (s) => {
      savedSessions.push(s);
    },
    recordMetric: async (name, tags, value) => {
      recordedMetrics.push({ name, tags, value });
    },
    chatToolsImpl,
  };

  const allEvents: AgentEvent[][] = [];
  let runningSession = session;

  for (const turn of fixture.turns) {
    let widgetMsg: WidgetMessage;
    if (turn.user.type === 'user_text') {
      widgetMsg = {
        type: 'user_text',
        sessionId: runningSession.sessionId,
        text: turn.user.text,
        mode: turn.user.mode ?? 'text',
      };
    } else {
      widgetMsg = {
        type: 'card_tap',
        sessionId: runningSession.sessionId,
        action: turn.user.action ?? 'cartAdd',
        variantId: turn.user.variantId ?? null,
        sku: turn.user.sku,
        qty: turn.user.qty,
      };
    }

    const events: AgentEvent[] = [];
    for await (const ev of runTurn(deps, merchant, runningSession, widgetMsg)) {
      events.push(ev);
    }
    allEvents.push(events);

    // Pull the saved session (if any) to chain turns realistically.
    const lastSave = savedSessions.at(-1);
    if (lastSave) runningSession = lastSave;
  }

  return { events: allEvents, fixture, savedSessions, recordedMetrics };
}

/**
 * Translate a fixture's `sonnetResponses` into the `ChatToolsResult` shape
 * expected by the runtime, flattened across all turns in order.
 */
export function fixtureSonnetQueue(fixture: FixtureFile): ChatToolsResult[] {
  const queue: ChatToolsResult[] = [];
  for (const turn of fixture.turns) {
    for (const r of turn.sonnetResponses) {
      queue.push({
        text: r.text,
        toolCalls: r.toolCalls.map((tc) => ({
          id: tc.id,
          name: tc.name,
          argumentsJson: tc.argumentsJson,
        })),
        stopReason: r.stopReason as 'stop' | 'tool_calls' | 'length' | 'other',
        inputTokens: 100,
        outputTokens: 20,
      });
    }
  }
  return queue;
}
