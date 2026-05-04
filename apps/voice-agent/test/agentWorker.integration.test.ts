import { describe, expect, it, vi } from 'vitest';
import type { AgentEvent } from '@shoppingmate/agent';
import { type BridgeDeps, type DataChannelMessage, createBridge } from '../src/bridge.js';

// Integration test exercises the bridge surface end-to-end with mocked
// runTurn + mocked speak/publish — i.e. the same surface agentWorker
// wires together. Real LiveKit + Gemini are out of scope (mocked).

describe('voice-agent integration: 3-turn fixture conversation', () => {
  it('end-to-end: greet → recommend → cart-add → checkout_redirect', async () => {
    const published: DataChannelMessage[] = [];
    const spoken: string[] = [];
    let runCallCount = 0;
    const fixtureTurns: AgentEvent[][] = [
      [
        { type: 'say', text: 'Hi, welcome.' },
        { type: 'end_of_turn' },
      ],
      [
        { type: 'say', text: 'Here are some options.' },
        {
          type: 'cards',
          items: [
            {
              image: null,
              title: 'A',
              priceFormatted: '$10',
              variantId: null,
              sku: 'A',
              productUrl: 'https://shop.example/a',
            },
          ],
        },
        { type: 'end_of_turn' },
      ],
      [
        { type: 'say', text: 'Adding it now. Tap pay when ready.' },
        { type: 'checkout_redirect', url: 'https://shop.example/cart' },
        { type: 'end_of_turn' },
      ],
    ];

    const deps: BridgeDeps = {
      sessionId: 'ws_int',
      merchantId: 'SM-INT001',
      runTurn: vi.fn(async function* () {
        const turn = fixtureTurns[runCallCount++];
        for (const e of turn ?? []) yield e;
      }) as unknown as BridgeDeps['runTurn'],
      loadMerchant: vi.fn().mockResolvedValue({ id: 'SM-INT001' }),
      loadSession: vi.fn().mockResolvedValue({ sessionId: 'ws_int' }),
      saveSession: vi.fn().mockResolvedValue(undefined),
      recordMetric: vi.fn().mockResolvedValue(undefined),
      loadAdapter: vi.fn(),
      speak: vi.fn(async (t: string) => {
        spoken.push(t);
      }),
      publishData: (m: DataChannelMessage) => {
        published.push(m);
      },
      closeRoom: vi.fn(),
      interrupt: vi.fn(),
    };
    const bridge = createBridge(deps);

    await bridge.handleUserText('hi');
    await bridge.handleUserText('show me running shoes');
    await bridge.handleUserText('add the first one');

    expect(spoken).toEqual([
      'Hi, welcome.',
      'Here are some options.',
      'Adding it now. Tap pay when ready.',
    ]);
    expect(published.filter((m) => m.type === 'user_text').length).toBe(3);
    expect(published.filter((m) => m.type === 'say').length).toBe(3);
    expect(published.filter((m) => m.type === 'cards').length).toBe(1);
    expect(published.filter((m) => m.type === 'checkout_redirect').length).toBe(1);
  });
});
