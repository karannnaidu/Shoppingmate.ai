import { readFileSync } from 'node:fs';
import { vi } from 'vitest';
import type { Adapter, AdapterResult } from '@shoppingmate/adapters';
import type { Merchant, Product } from '@shoppingmate/db';
import { runTurn, type RunTurnDeps } from '../../apps/api/src/agent/runtime.js';
import type { AgentEvent, SessionState, WidgetMessage } from '../../apps/api/src/agent/types.js';

vi.mock('@shoppingmate/shared', async (orig) => ({
  ...(await orig<typeof import('@shoppingmate/shared')>()),
  chatTools: vi.fn(),
}));

const { chatTools } = await import('@shoppingmate/shared');

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

export type RunFixtureResult = {
  events: AgentEvent[][];
  fixture: FixtureFile;
  chatToolsMock: ReturnType<typeof vi.mocked<typeof chatTools>>;
  saveSessionMock: ReturnType<typeof vi.fn>;
  recordMetricMock: ReturnType<typeof vi.fn>;
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

export async function runFixture(path: string): Promise<RunFixtureResult> {
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

  const saveSessionMock = vi.fn(async () => undefined);
  const recordMetricMock = vi.fn(async () => undefined);

  const deps: RunTurnDeps = {
    loadAdapter: () => adapter,
    saveSession: saveSessionMock,
    recordMetric: recordMetricMock,
  };

  const chatToolsMock = vi.mocked(chatTools);
  chatToolsMock.mockReset();

  const allEvents: AgentEvent[][] = [];
  let runningSession = session;

  for (const turn of fixture.turns) {
    for (const r of turn.sonnetResponses) {
      chatToolsMock.mockResolvedValueOnce({
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
    const lastSave = saveSessionMock.mock.calls.at(-1);
    if (lastSave) {
      runningSession = lastSave[0] as SessionState;
    }
  }

  return {
    events: allEvents,
    fixture,
    chatToolsMock,
    saveSessionMock,
    recordMetricMock,
  };
}
