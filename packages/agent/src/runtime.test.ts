import type { Merchant } from '@shoppingmate/db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type RunTurnDeps,
  pickTurnModel,
  runTurn,
  toHostAction,
  toolTelemetryTags,
} from './runtime.js';
import type { AgentEvent, SessionState } from './types.js';

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
    allowedSpeechTokens: [],
    ...overrides,
  };
}

// Alias used in new Bucket B tests — same shape, different name
function makeBaseSession(overrides: Partial<SessionState> = {}): SessionState {
  return baseSession(overrides);
}

function fakeAdapter() {
  return {
    searchProducts: async () => ({ kind: 'ok' as const, value: [] }),
    getProduct: async () => ({ kind: 'ok' as const, value: null }),
    cartAdd: async () => ({ kind: 'ok' as const, value: { cartToken: 'ct' } }),
    cartUpdate: async () => ({ kind: 'ok' as const, value: null }),
    cartGet: async () => ({ kind: 'ok' as const, value: { lines: [] } }),
    couponApply: async () => ({ kind: 'ok' as const, value: null }),
    checkoutUrl: async () => ({ kind: 'ok' as const, value: 'https://shop/checkout' }),
  } as any;
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

  it('lets Calmosis speak the Bliss Club membership price (₹299) — it has no card', async () => {
    vi.mocked(chatTools).mockResolvedValueOnce({
      text: 'Bliss Club is ₹299 for 6 months — great value.',
      toolCalls: [],
      stopReason: 'stop',
      inputTokens: 30,
      outputTokens: 8,
    });
    const calmosis = {
      id: 'SM-2SCCLZ',
      domain: 'calmosis.com',
      name: 'Calmosis',
      personaId: 'calmosis-clinician',
      adapterType: 'dom',
      siteGraphEnabled: true,
    } as unknown as Merchant;
    const events = [];
    for await (const ev of runTurn(deps, calmosis, baseSession({ merchantId: 'SM-2SCCLZ' }), {
      type: 'user_text',
      sessionId: 's-1',
      text: 'how much is bliss club?',
      mode: 'text',
    })) {
      events.push(ev);
    }
    const says = events
      .filter((e) => e.type === 'say')
      .map((e) => (e as { text: string }).text)
      .join(' ');
    expect(says).toMatch(/₹299/);
    expect(says).not.toMatch(/the price on the card/);
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

describe('runTurn — Bucket B host-action dispatch + pricing.quote', () => {
  it('populates session.allowedSpeechTokens from pricing.quote and passes them to stripPrices', async () => {
    const events: AgentEvent[] = [];
    const fakeChatTools = vi
      .fn()
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [
          {
            id: 'tc1',
            name: 'pricing.quote',
            argumentsJson: JSON.stringify({ plan_id: 'starter' }),
          },
        ],
      })
      .mockResolvedValueOnce({
        text: 'Starter is thirty dollars per month for one hundred conversations. Want to sign up?',
        toolCalls: [],
      });
    const saved: SessionState[] = [];
    const session: SessionState = makeBaseSession({
      sessionId: 's1',
      merchantId: 'SM-XPK2EN',
      allowedSpeechTokens: [],
    });
    const merchant2 = { id: 'SM-XPK2EN', name: 'shoppingmate', domain: 'shoppingmate.ai' } as any;
    for await (const ev of runTurn(
      {
        loadAdapter: () => fakeAdapter(),
        saveSession: async (s: SessionState) => {
          saved.push(s);
        },
        recordMetric: async () => {},
        chatToolsImpl: fakeChatTools as any,
        dispatchHostAction: async () => ({ ok: true as const }),
      } as any,
      merchant2,
      session,
      { type: 'user_text', sessionId: 's1', text: 'show me pricing', mode: 'voice' },
    ))
      events.push(ev as AgentEvent);

    const sayEvents = events.filter((e): e is { type: 'say'; text: string } => e.type === 'say');
    const sayText = sayEvents.map((e) => e.text).join(' ');
    expect(sayText).toContain('Starter is thirty dollars per month for one hundred conversations.');
    expect(saved.at(-1)?.allowedSpeechTokens).toContain(
      'Starter is thirty dollars per month for one hundred conversations.',
    );
  });

  it('logs a recommendation_events row when pricing.quote names a plan id', async () => {
    const fakeChatTools = vi
      .fn()
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [
          {
            id: 'tc1',
            name: 'pricing.quote',
            argumentsJson: JSON.stringify({ plan_id: 'growth' }),
          },
        ],
      })
      .mockResolvedValueOnce({
        text: 'Growth gives you more conversations.',
        toolCalls: [],
      });
    const recordRecommendation = vi.fn(async () => undefined);
    const session = makeBaseSession({ sessionId: 's-rec-1', merchantId: 'SM-XPK2EN' });
    const merchant2 = { id: 'SM-XPK2EN', name: 'shoppingmate', domain: 'shoppingmate.ai' } as any;
    for await (const _ev of runTurn(
      {
        loadAdapter: () => fakeAdapter(),
        saveSession: async () => {},
        recordMetric: async () => {},
        chatToolsImpl: fakeChatTools as any,
        recommendationStore: { recordRecommendation },
      } as any,
      merchant2,
      session,
      { type: 'user_text', sessionId: 's-rec-1', text: 'pricing for growth', mode: 'voice' },
    )) {
      /* drain */
    }
    // Flush microtasks so the fire-and-forget .catch chain resolves before assert.
    await Promise.resolve();
    expect(recordRecommendation).toHaveBeenCalledWith({
      sessionId: 's-rec-1',
      sku: 'growth',
      kind: 'mentioned',
    });
  });

  it('routes site.* tool calls through dispatchHostAction', async () => {
    const dispatched: any[] = [];
    const fakeChatTools = vi
      .fn()
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [
          { id: 'tc1', name: 'site.navigate', argumentsJson: JSON.stringify({ path: '/pricing' }) },
        ],
      })
      .mockResolvedValueOnce({ text: 'Done — pulled up pricing.', toolCalls: [] });
    const session2 = makeBaseSession({ merchantId: 'SM-XPK2EN' });
    const merchant3 = { id: 'SM-XPK2EN', name: 'shoppingmate', domain: 'shoppingmate.ai' } as any;
    for await (const _ev of runTurn(
      {
        loadAdapter: () => fakeAdapter(),
        saveSession: async () => {},
        recordMetric: async () => {},
        chatToolsImpl: fakeChatTools as any,
        dispatchHostAction: async (action: any) => {
          dispatched.push(action);
          return { ok: true as const };
        },
      } as any,
      merchant3,
      session2,
      { type: 'user_text', sessionId: 's1', text: 'show pricing', mode: 'voice' },
    )) {
      /* drain */
    }
    expect(dispatched).toEqual([{ type: 'navigate', path: '/pricing' }]);
  });

  it('emits checkout.reached when navigating to a /checkout path', async () => {
    const metrics: Array<{ name: string; tags: any }> = [];
    const fakeChatTools = vi
      .fn()
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [
          {
            id: 'tc1',
            name: 'site.navigate',
            argumentsJson: JSON.stringify({ path: '/checkout' }),
          },
        ],
      })
      .mockResolvedValueOnce({ text: 'Taking you to checkout.', toolCalls: [] });
    const session2 = makeBaseSession({ merchantId: 'SM-XPK2EN' });
    const merchant3 = { id: 'SM-XPK2EN', name: 'shoppingmate', domain: 'shoppingmate.ai' } as any;
    for await (const _ev of runTurn(
      {
        loadAdapter: () => fakeAdapter(),
        saveSession: async () => {},
        recordMetric: async (name: string, tags: any) => {
          metrics.push({ name, tags });
        },
        chatToolsImpl: fakeChatTools as any,
        dispatchHostAction: async () => ({ ok: true as const }),
      } as any,
      merchant3,
      session2,
      { type: 'user_text', sessionId: 's1', text: 'checkout please', mode: 'voice' },
    )) {
      /* drain */
    }
    expect(metrics.some((m) => m.name === 'checkout.reached' && m.tags.source === 'navigate')).toBe(
      true,
    );
  });

  it('places the order via host action and emits checkout.placed (Calmosis)', async () => {
    const metrics: Array<{ name: string; tags: any }> = [];
    const actions: any[] = [];
    const fakeChatTools = vi
      .fn()
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [{ id: 'tc1', name: 'checkout.place', argumentsJson: '{}' }],
      })
      .mockResolvedValueOnce({ text: 'Your order is placed!', toolCalls: [] });
    const calmosis = {
      id: 'SM-2SCCLZ',
      name: 'Calmosis',
      domain: 'calmosis.com',
      personaId: 'calmosis-clinician',
      adapterType: 'dom',
      siteGraphEnabled: true,
    } as any;
    for await (const _ev of runTurn(
      {
        loadAdapter: () => fakeAdapter(),
        saveSession: async () => {},
        recordMetric: async (name: string, tags: any) => {
          metrics.push({ name, tags });
        },
        chatToolsImpl: fakeChatTools as any,
        dispatchHostAction: async (a: any) => {
          actions.push(a);
          return { ok: true as const };
        },
      } as any,
      calmosis,
      makeBaseSession({ merchantId: 'SM-2SCCLZ' }),
      { type: 'user_text', sessionId: 's1', text: 'place my order', mode: 'voice' },
    )) {
      /* drain */
    }
    expect(actions.some((a) => a.type === 'checkout_place')).toBe(true);
    expect(metrics.some((m) => m.name === 'checkout.placed')).toBe(true);
  });
});

describe('pickTurnModel — cost/quality hybrid', () => {
  const orig = { ...process.env };
  afterEach(() => {
    process.env = { ...orig };
  });
  it('uses the cheap model for general chat and the precise model for checkout turns', () => {
    process.env.OPENROUTER_MODEL = 'cheap/x';
    process.env.OPENROUTER_CHECKOUT_MODEL = 'precise/y';
    const m = (text: string) =>
      ({ type: 'user_text', sessionId: 's', text, mode: 'text' }) as never;
    expect(pickTurnModel(m('tell me about sleep mantra'), undefined)).toBe('cheap/x');
    expect(pickTurnModel(m('my pincode is 560038'), undefined)).toBe('precise/y');
    expect(pickTurnModel(m('email is a@b.com'), undefined)).toBe('precise/y');
    expect(pickTurnModel(m('please check out'), undefined)).toBe('precise/y');
  });
  it('a per-session override (smoke) always wins', () => {
    process.env.OPENROUTER_MODEL = 'cheap/x';
    process.env.OPENROUTER_CHECKOUT_MODEL = 'precise/y';
    const m = { type: 'user_text', sessionId: 's', text: 'pincode 560038', mode: 'text' } as never;
    expect(pickTurnModel(m, 'smoke/z')).toBe('smoke/z');
  });
  it('stays on the precise model once in checkout, even for non-signal correction turns', () => {
    process.env.OPENROUTER_MODEL = 'cheap/x';
    process.env.OPENROUTER_CHECKOUT_MODEL = 'precise/y';
    const m = (text: string) =>
      ({ type: 'user_text', sessionId: 's', text, mode: 'text' }) as never;
    // A correction like "no, make it Pune" matches no CHECKOUT_SIGNAL keyword,
    // so without stickiness it would drop to the cheap model and botch the edit.
    expect(pickTurnModel(m('no, make it Pune'), undefined, false)).toBe('cheap/x');
    expect(pickTurnModel(m('no, make it Pune'), undefined, true)).toBe('precise/y');
  });
});

describe('toolTelemetryTags() — nav PRD Phase 0', () => {
  it('reports channel, result size, and host action type on success', () => {
    const tags = toolTelemetryTags(
      { ok: true, value: { values: { a: 'b' } } },
      'host',
      'form_read',
    );
    expect(tags).toMatchObject({ channel: 'host', actionType: 'form_read' });
    expect(tags.resultChars).toBeGreaterThan(0);
    expect(tags.resultTokensEst).toBe(Math.ceil(Number(tags.resultChars) / 4));
    expect(tags).not.toHaveProperty('failReason');
    expect(tags).not.toHaveProperty('verified');
  });
  it('reports the failure reason (or kind when there is no reason)', () => {
    expect(
      toolTelemetryTags({ ok: false, kind: 'unsupported', reason: 'not_found' }, 'host', 'click'),
    ).toMatchObject({ failReason: 'not_found' });
    expect(toolTelemetryTags({ ok: false, kind: 'retry_exhausted' }, 'adapter')).toMatchObject({
      failReason: 'retry_exhausted',
    });
  });
  it('passes through a widget-reported verified flag', () => {
    expect(
      toolTelemetryTags({ ok: true, value: { ok: true, verified: false } }, 'host', 'click'),
    ).toMatchObject({
      verified: false,
    });
  });
});

describe('runTurn() — turn + tool telemetry (nav PRD Phase 0)', () => {
  it('tags agent.tool.invoked with the channel and emits agent.turn.completed', async () => {
    vi.mocked(chatTools)
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [
          {
            id: 'c1',
            name: 'consultation.request',
            argumentsJson: JSON.stringify({ name: 'Karan', age: 32, phone: '98765 43210' }),
          },
        ],
        stopReason: 'tool_calls',
        inputTokens: 10,
        outputTokens: 5,
      })
      .mockResolvedValueOnce({
        text: 'Done.',
        toolCalls: [],
        stopReason: 'stop',
        inputTokens: 10,
        outputTokens: 5,
      });
    const recordMetric = vi.fn(async () => undefined);
    const localDeps: RunTurnDeps = {
      ...deps,
      submitConsultation: vi.fn(async () => ({ ok: true as const })),
      recordMetric,
    };
    for await (const _ev of runTurn(localDeps, merchant, baseSession(), {
      type: 'user_text',
      sessionId: 's-1',
      text: 'book a consult',
      mode: 'text',
    })) {
      // drain
    }
    expect(recordMetric).toHaveBeenCalledWith(
      'agent.tool.invoked',
      expect.objectContaining({ toolName: 'consultation.request', channel: 'server', ok: true }),
    );
    expect(recordMetric).toHaveBeenCalledWith(
      'agent.turn.completed',
      expect.objectContaining({ llmCalls: 2, toolCalls: 1, latencyMs: expect.any(Number) }),
    );
  });
});

describe('runTurn() — never silent after tools', () => {
  it('nudges once when tools ran but the model returned no text', async () => {
    vi.mocked(chatTools)
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [{ id: 't1', name: 'products.search', argumentsJson: '{"query":"sleep"}' }],
        stopReason: 'tool_calls',
        inputTokens: 1,
        outputTokens: 1,
      })
      .mockResolvedValueOnce({ text: '', toolCalls: [], stopReason: 'stop', inputTokens: 1, outputTokens: 1 })
      .mockResolvedValueOnce({ text: 'Here are a couple of options.', toolCalls: [], stopReason: 'stop', inputTokens: 1, outputTokens: 1 });
    const events: AgentEvent[] = [];
    for await (const ev of runTurn(deps, merchant, baseSession(), {
      type: 'user_text',
      sessionId: 's-1',
      text: 'help me sleep',
      mode: 'text',
    })) {
      events.push(ev);
    }
    expect(events.filter((e) => e.type === 'say').map((e) => (e as { text: string }).text)).toContain(
      'Here are a couple of options.',
    );
  });
});

describe('runTurn() — case.open (nav PRD Phase 4)', () => {
  it('validates, submits with session ids, returns a reference, and emits case.opened', async () => {
    vi.mocked(chatTools)
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [
          {
            id: 'k1',
            name: 'case.open',
            argumentsJson: JSON.stringify({
              type: 'complaint',
              summary: 'Bottle arrived broken, wants a replacement',
              details: { order_number: '10259', desired_resolution: 'replacement' },
              contact: { phone: '+91 98765 43210' },
              consent: true,
              sentiment: 'negative',
            }),
          },
        ],
        stopReason: 'tool_calls',
        inputTokens: 10,
        outputTokens: 5,
      })
      .mockResolvedValueOnce({
        text: "I'm sorry — logged it, your request number is #7.",
        toolCalls: [],
        stopReason: 'stop',
        inputTokens: 10,
        outputTokens: 5,
      });
    const submitCase = vi.fn(async () => ({ ok: true as const, id: 7 }));
    const recordMetric = vi.fn(async () => undefined);
    const localDeps: RunTurnDeps = { ...deps, submitCase, recordMetric };
    const events: AgentEvent[] = [];
    for await (const ev of runTurn(localDeps, merchant, baseSession(), {
      type: 'user_text',
      sessionId: 's-1',
      text: 'my bottle arrived broken',
      mode: 'text',
    })) {
      events.push(ev);
    }
    expect(submitCase).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'complaint',
        contactPhone: '+919876543210',
        merchantId: 'm',
        sessionId: 's-1',
        consent: true,
      }),
    );
    expect(recordMetric).toHaveBeenCalledWith(
      'case.opened',
      expect.objectContaining({ caseType: 'complaint', sentiment: 'negative' }),
    );
    expect(events.find((e) => e.type === 'tool_result')).toMatchObject({ toolName: 'case.open', ok: true });
  });

  it('uses the phone given on an EARLIER turn (history is redacted) when the case opens on "yes"', async () => {
    process.env.CASE_CAPTURE = '*';
    let saved: ReturnType<typeof baseSession> | null = null;
    const saveSession = vi.fn(async (s: ReturnType<typeof baseSession>) => {
      saved = s;
    });
    // Turn 1: visitor gives their number; model just reads it back.
    vi.mocked(chatTools).mockResolvedValueOnce({
      text: "So: order 10259 hasn't arrived — we'll reach you on the number ending 3210. Okay?",
      toolCalls: [],
      stopReason: 'stop',
      inputTokens: 1,
      outputTokens: 1,
    });
    for await (const _ of runTurn({ ...deps, saveSession }, merchant, baseSession(), {
      type: 'user_text',
      sessionId: 's-1',
      text: 'my phone is 9876543210',
      mode: 'text',
    })) {
      // drain
    }
    expect(saved).not.toBeNull();
    const s1 = saved as unknown as ReturnType<typeof baseSession> & { transientContact?: { phone?: string } };
    expect(s1.transientContact?.phone).toBe('9876543210');
    expect(JSON.stringify(s1.history)).not.toContain('9876543210'); // user turn stored redacted

    // Turn 2: "yes" → model calls case.open with an EMPTY contact.
    vi.mocked(chatTools)
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [
          {
            id: 'k3',
            name: 'case.open',
            argumentsJson: JSON.stringify({
              type: 'order_tracking',
              summary: 'Order 10259 not arrived',
              details: { order_number: '10259' },
              contact: {},
              consent: true,
            }),
          },
        ],
        stopReason: 'tool_calls',
        inputTokens: 1,
        outputTokens: 1,
      })
      .mockResolvedValueOnce({ text: 'Logged — #9.', toolCalls: [], stopReason: 'stop', inputTokens: 1, outputTokens: 1 });
    const submitCase = vi.fn(async () => ({ ok: true as const, id: 9 }));
    for await (const _ of runTurn({ ...deps, submitCase }, merchant, s1, {
      type: 'user_text',
      sessionId: 's-1',
      text: 'yes',
      mode: 'text',
    })) {
      // drain
    }
    expect(submitCase).toHaveBeenCalledWith(expect.objectContaining({ contactPhone: '9876543210' }));
    delete process.env.CASE_CAPTURE;
  });

  it('relays the missing field instead of submitting', async () => {
    vi.mocked(chatTools)
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [
          {
            id: 'k2',
            name: 'case.open',
            argumentsJson: JSON.stringify({ type: 'complaint', summary: 'Broken bottle', contact: {}, consent: true }),
          },
        ],
        stopReason: 'tool_calls',
        inputTokens: 10,
        outputTokens: 5,
      })
      .mockResolvedValueOnce({ text: 'What number can we reach you on?', toolCalls: [], stopReason: 'stop', inputTokens: 1, outputTokens: 1 });
    const submitCase = vi.fn(async () => ({ ok: true as const, id: 1 }));
    for await (const _ of runTurn({ ...deps, submitCase }, merchant, baseSession(), {
      type: 'user_text',
      sessionId: 's-1',
      text: 'broken bottle',
      mode: 'text',
    })) {
      // drain
    }
    expect(submitCase).not.toHaveBeenCalled();
  });
});

describe('runTurn() — consultation.request', () => {
  it('validates, calls submitConsultation with merged ids, and emits the metric', async () => {
    vi.mocked(chatTools)
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [
          {
            id: 'c1',
            name: 'consultation.request',
            argumentsJson: JSON.stringify({ name: 'Karan', age: 32, phone: '98765 43210' }),
          },
        ],
        stopReason: 'tool_calls',
        inputTokens: 10,
        outputTokens: 5,
      })
      .mockResolvedValueOnce({
        text: 'Done — our practitioner will reach out.',
        toolCalls: [],
        stopReason: 'stop',
        inputTokens: 10,
        outputTokens: 5,
      });
    const submitConsultation = vi.fn(async () => ({ ok: true as const }));
    const recordMetric = vi.fn(async () => undefined);
    const localDeps: RunTurnDeps = { ...deps, submitConsultation, recordMetric };
    const events: AgentEvent[] = [];
    for await (const ev of runTurn(localDeps, merchant, baseSession(), {
      type: 'user_text',
      sessionId: 's-1',
      text: 'book a doctor consult — Karan, 32, 9876543210',
      mode: 'text',
    })) {
      events.push(ev);
    }

    expect(submitConsultation).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Karan',
        age: 32,
        phone: '9876543210',
        phoneCountryCode: '+91',
        condition: null,
        merchantId: 'm',
        sessionId: 's-1',
      }),
    );
    expect(recordMetric).toHaveBeenCalledWith('consultation.requested', expect.any(Object));
    const tr = events.find(
      (e) =>
        e.type === 'tool_result' &&
        (e as { toolName?: string }).toolName === 'consultation.request',
    );
    expect(tr).toMatchObject({ ok: true });
  });

  it('re-asks (ok:false) on invalid phone without calling submit', async () => {
    vi.mocked(chatTools)
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [
          {
            id: 'c1',
            name: 'consultation.request',
            argumentsJson: JSON.stringify({ name: 'Karan', age: 32, phone: '123' }),
          },
        ],
        stopReason: 'tool_calls',
        inputTokens: 10,
        outputTokens: 5,
      })
      .mockResolvedValueOnce({
        text: 'That number is not 10 digits — can you recheck?',
        toolCalls: [],
        stopReason: 'stop',
        inputTokens: 10,
        outputTokens: 5,
      });
    const submitConsultation = vi.fn(async () => ({ ok: true as const }));
    const localDeps: RunTurnDeps = { ...deps, submitConsultation };
    const events: AgentEvent[] = [];
    for await (const ev of runTurn(localDeps, merchant, baseSession(), {
      type: 'user_text',
      sessionId: 's-1',
      text: 'book a consult',
      mode: 'text',
    })) {
      events.push(ev);
    }
    expect(submitConsultation).not.toHaveBeenCalled();
    const tr = events.find(
      (e) =>
        e.type === 'tool_result' &&
        (e as { toolName?: string }).toolName === 'consultation.request',
    );
    expect(tr).toMatchObject({ ok: false });
  });

  it('returns consultation_not_wired when no submitConsultation dep is provided', async () => {
    vi.mocked(chatTools)
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [
          {
            id: 'c1',
            name: 'consultation.request',
            argumentsJson: JSON.stringify({ name: 'Karan', age: 32, phone: '9876543210' }),
          },
        ],
        stopReason: 'tool_calls',
        inputTokens: 10,
        outputTokens: 5,
      })
      .mockResolvedValueOnce({
        text: 'ok',
        toolCalls: [],
        stopReason: 'stop',
        inputTokens: 1,
        outputTokens: 1,
      });
    const events: AgentEvent[] = [];
    for await (const ev of runTurn(deps, merchant, baseSession(), {
      type: 'user_text',
      sessionId: 's-1',
      text: 'book a consult',
      mode: 'text',
    })) {
      events.push(ev);
    }
    const tr = events.find(
      (e) =>
        e.type === 'tool_result' &&
        (e as { toolName?: string }).toolName === 'consultation.request',
    );
    expect(tr).toMatchObject({ ok: false });
  });
});

describe('toHostAction (page-control mapping)', () => {
  it('maps page.fill to form_fill with normalised fields', () => {
    const a = toHostAction('page.fill', { fields: [{ field: 'Email', value: 'a@b.com' }] });
    expect(a).toEqual({ type: 'form_fill', fields: [{ field: 'Email', value: 'a@b.com' }] });
  });
  it('maps page.read to form_read', () => {
    expect(toHostAction('page.read', {})).toEqual({ type: 'form_read', fields: undefined });
  });
  it('maps page.click to the click host action', () => {
    expect(toHostAction('page.click', { intent: 'Continue to Payment' })).toEqual({
      type: 'click',
      intent: 'Continue to Payment',
    });
  });
});
