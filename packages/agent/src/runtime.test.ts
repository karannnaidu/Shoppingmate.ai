import type { Merchant } from '@shoppingmate/db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type RunTurnDeps, runTurn } from './runtime.js';
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
  loadAdapter: () => ({
    kind: 'shopify',
    searchProducts: async () => ({ kind: 'ok', value: [] }),
    getProduct: async () => ({ kind: 'ok', value: null }),
    cartAdd: async () => ({
      kind: 'ok',
      value: {
        cartToken: 'x',
        lines: [],
        subtotalCents: 0,
        totalCents: 0,
        currency: 'INR',
        appliedCoupons: [],
      },
    }),
    cartUpdate: async () => ({
      kind: 'ok',
      value: {
        cartToken: 'x',
        lines: [],
        subtotalCents: 0,
        totalCents: 0,
        currency: 'INR',
        appliedCoupons: [],
      },
    }),
    cartGet: async () => ({
      kind: 'ok',
      value: {
        cartToken: 'x',
        lines: [],
        subtotalCents: 0,
        totalCents: 0,
        currency: 'INR',
        appliedCoupons: [],
      },
    }),
    couponApply: async () => ({
      kind: 'ok',
      value: {
        cartToken: 'x',
        lines: [],
        subtotalCents: 0,
        totalCents: 0,
        currency: 'INR',
        appliedCoupons: [],
      },
    }),
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

describe('runTurn() — happy path', () => {
  it('emits cards after products.search and final say after assistant text', async () => {
    vi.mocked(chatTools)
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [{ id: 'c1', name: 'products.search', argumentsJson: '{"query":"dress"}' }],
        stopReason: 'tool_calls',
        inputTokens: 50,
        outputTokens: 10,
      })
      .mockResolvedValueOnce({
        text: 'Two great picks — see the cards.',
        toolCalls: [],
        stopReason: 'stop',
        inputTokens: 60,
        outputTokens: 8,
      });

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
      items: [
        {
          sku: 'A',
          title: 'Silk dress',
          image: 'https://cdn.test/a.jpg',
          priceFormatted: '\u20B91999.00',
        },
      ],
    });
  });

  it('strips prices from final say text', async () => {
    vi.mocked(chatTools).mockResolvedValueOnce({
      text: 'It costs \u20B91,499 — great deal.',
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
    expect(says.join(' ')).not.toMatch(/\u20B9|\$|Rs/);
    expect(says.join(' ')).toMatch(/the price on the card/);
  });

  it('records agent.tool.retry_exhausted after 3 same-args invocations', async () => {
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

  it('persists user message + final assistant text to session.history', async () => {
    vi.mocked(chatTools).mockResolvedValueOnce({
      text: 'Hello there.',
      toolCalls: [],
      stopReason: 'stop',
      inputTokens: 10,
      outputTokens: 5,
    });
    const saveSession = vi.fn(async () => undefined);
    const localDeps: RunTurnDeps = { ...deps, saveSession };

    for await (const _ of runTurn(localDeps, merchant, baseSession(), {
      type: 'user_text',
      sessionId: 's-1',
      text: 'hi there',
      mode: 'text',
    })) {
      // drain
    }

    expect(saveSession).toHaveBeenCalledTimes(1);
    const firstCall = saveSession.mock.calls[0];
    if (!firstCall) throw new Error('saveSession not called');
    const saved = firstCall[0];
    expect(saved.history).toEqual([
      { role: 'user', content: 'hi there' },
      { role: 'assistant', content: 'Hello there.' },
    ]);
    expect(saved.turnCount).toBe(1);
  });
});

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
      value: {
        cartToken: 'ct1',
        lines: [],
        subtotalCents: 0,
        totalCents: 0,
        currency: 'INR',
        appliedCoupons: [],
      },
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
