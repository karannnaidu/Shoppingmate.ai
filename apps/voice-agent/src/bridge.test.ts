import { describe, expect, it, vi } from 'vitest';
import type { AgentEvent } from '@shoppingmate/agent';
import { type BridgeDeps, createBridge } from './bridge.js';

function fakeRunTurn(events: AgentEvent[]) {
  return vi.fn(async function* () {
    for (const e of events) yield e;
  });
}

const baseDeps = (): BridgeDeps => ({
  sessionId: 'ws_test',
  merchantId: 'SM-AAAAAA',
  runTurn: fakeRunTurn([
    { type: 'say', text: 'Hi there.' },
    { type: 'end_of_turn' },
  ]) as unknown as BridgeDeps['runTurn'],
  loadMerchant: vi.fn().mockResolvedValue({ id: 'SM-AAAAAA' }),
  loadSession: vi.fn().mockResolvedValue({ sessionId: 'ws_test' }),
  saveSession: vi.fn().mockResolvedValue(undefined),
  recordMetric: vi.fn().mockResolvedValue(undefined),
  loadAdapter: vi.fn(),
  speak: vi.fn().mockResolvedValue(undefined),
  publishData: vi.fn(),
  closeRoom: vi.fn(),
  interrupt: vi.fn(),
});

describe('createBridge — STT-final → runTurn → say → speak', () => {
  it('on user_text final, calls runTurn and speaks each say event', async () => {
    const deps = baseDeps();
    const bridge = createBridge(deps);
    await bridge.handleUserText('hello sage');
    expect(deps.runTurn).toHaveBeenCalledOnce();
    expect(deps.speak).toHaveBeenCalledWith('Hi there.');
  });

  it('forwards loadPromptOpts into runTurn deps (side-channel gets brand KB + site map)', async () => {
    // Regression for 2026-06-08: the voice bridge ran the side-channel Sonnet
    // with no KB/site map, so it searched the catalog with terms that never
    // matched (not_found → no cards → no price) and guessed nav paths.
    const loadPromptOpts = vi.fn().mockResolvedValue({ kbText: 'KB', siteGraphText: 'MAP' });
    const capture = vi.fn(async function* () {
      yield { type: 'end_of_turn' } as AgentEvent;
    });
    const deps: BridgeDeps = {
      ...baseDeps(),
      loadPromptOpts,
      runTurn: capture as unknown as BridgeDeps['runTurn'],
    };
    const bridge = createBridge(deps);
    await bridge.handleUserText('what does Sleep Mantra cost');
    const runDeps = capture.mock.calls[0]![0] as { loadPromptOpts?: unknown };
    expect(runDeps.loadPromptOpts).toBe(loadPromptOpts);
  });

  it('publishes user_text event to data channel for transcript', async () => {
    const deps = baseDeps();
    const bridge = createBridge(deps);
    await bridge.handleUserText('hello sage');
    expect(deps.publishData).toHaveBeenCalledWith({ type: 'user_text', text: 'hello sage' });
  });

  it('publishes say events to data channel (transcript)', async () => {
    const deps = baseDeps();
    const bridge = createBridge(deps);
    await bridge.handleUserText('hi');
    expect(deps.publishData).toHaveBeenCalledWith({ type: 'say', text: 'Hi there.' });
  });

  it('routes an executor_error event to onExecutorError (so the worker grounds Gemini honestly)', async () => {
    const onExecutorError = vi.fn();
    const deps: BridgeDeps = {
      ...baseDeps(),
      onExecutorError,
      runTurn: fakeRunTurn([
        { type: 'executor_error', kind: 'exhausted' },
        { type: 'say', text: "Sorry — I'm having trouble reaching my brain." },
        { type: 'end_of_turn' },
      ]) as unknown as BridgeDeps['runTurn'],
    };
    const bridge = createBridge(deps);
    await bridge.handleUserText('add green mantra');
    expect(onExecutorError).toHaveBeenCalledWith('exhausted');
  });

  it('feeds Gemini’s spoken turns into the executor history (real dialogue, not blind utterances)', async () => {
    const histories: Array<Array<{ role: string; content: string }>> = [];
    const capture = vi.fn(async function* (_d: unknown, _m: unknown, session: { history?: unknown }) {
      histories.push(JSON.parse(JSON.stringify(session.history ?? [])));
      yield { type: 'end_of_turn' } as AgentEvent;
    });
    const deps: BridgeDeps = {
      ...baseDeps(),
      loadSession: vi.fn().mockResolvedValue({ sessionId: 'ws_test', history: [] }),
      runTurn: capture as unknown as BridgeDeps['runTurn'],
    };
    const bridge = createBridge(deps);
    bridge.noteAssistantTurn("What's your phone number?");
    await bridge.handleUserText('9876543210');
    bridge.noteAssistantTurn('And your email?');
    await bridge.handleUserText('test@example.com');

    // The 2nd executor turn must see the prior answer AND Gemini's question, so
    // it can map "test@example.com" → email (the bug: it saw only utterances).
    const second = histories[1]!;
    expect(second).toContainEqual({ role: 'user', content: '9876543210' });
    expect(second).toContainEqual({ role: 'assistant', content: 'And your email?' });
    // Leading assistant turns are dropped so the list starts with a user turn.
    expect(second[0]!.role).toBe('user');
  });

  it('does NOT speak() events of type cards/checkout_redirect/cap_warning', async () => {
    const deps: BridgeDeps = {
      ...baseDeps(),
      runTurn: fakeRunTurn([
        { type: 'cards', items: [] },
        { type: 'checkout_redirect', url: 'https://x' },
        { type: 'cap_warning', reason: 'turns', remaining: 2 },
        { type: 'end_of_turn' },
      ]) as unknown as BridgeDeps['runTurn'],
    };
    const bridge = createBridge(deps);
    await bridge.handleUserText('show me');
    expect(deps.speak).not.toHaveBeenCalled();
    expect(deps.publishData).toHaveBeenCalledWith({ type: 'cards', items: [] });
    expect(deps.publishData).toHaveBeenCalledWith({
      type: 'checkout_redirect',
      url: 'https://x',
    });
    expect(deps.publishData).toHaveBeenCalledWith({ type: 'cap_warning', remaining: 2 });
  });

  it('on session_closed event, calls closeRoom', async () => {
    const deps: BridgeDeps = {
      ...baseDeps(),
      runTurn: fakeRunTurn([{ type: 'session_closed', reason: 'cap' }]) as unknown as BridgeDeps['runTurn'],
    };
    const bridge = createBridge(deps);
    await bridge.handleUserText('done');
    expect(deps.closeRoom).toHaveBeenCalledOnce();
  });

  it('handleBargeIn calls interrupt and aborts the current run', async () => {
    let resolveSpeakA: () => void = () => {};
    const speakAPromise = new Promise<void>((r) => {
      resolveSpeakA = r;
    });
    const interruptCalls: number[] = [];
    const speak = vi.fn(async (text: string) => {
      if (text === 'long thought A') {
        await speakAPromise;
      }
    });
    const deps: BridgeDeps = {
      ...baseDeps(),
      runTurn: vi.fn(async function* () {
        yield { type: 'say', text: 'long thought A' };
        yield { type: 'say', text: 'long thought B (should be skipped)' };
        yield { type: 'end_of_turn' };
      }) as unknown as BridgeDeps['runTurn'],
      speak,
      interrupt: vi.fn(() => {
        interruptCalls.push(Date.now());
      }),
    };
    const bridge = createBridge(deps);
    const handleP = bridge.handleUserText('start');
    setTimeout(() => {
      bridge.handleBargeIn();
      resolveSpeakA();
    }, 5);
    await handleP;
    expect(interruptCalls.length).toBe(1);
    expect(speak.mock.calls.map((c) => c[0])).toEqual(['long thought A']);
  });

  it('on runTurn throw, publishes session_closed{error} and closes room', async () => {
    const deps: BridgeDeps = {
      ...baseDeps(),
      runTurn: vi.fn(async function* () {
        throw new Error('sonnet exploded');
      }) as unknown as BridgeDeps['runTurn'],
    };
    const bridge = createBridge(deps);
    await bridge.handleUserText('go');
    expect(deps.publishData).toHaveBeenCalledWith({ type: 'session_closed', reason: 'error' });
    expect(deps.closeRoom).toHaveBeenCalledOnce();
  });

  it('pipelines: speak(N) starts before runTurn yields N+1', async () => {
    const speakOrder: string[] = [];
    const yieldOrder: string[] = [];
    const deps: BridgeDeps = {
      ...baseDeps(),
      runTurn: vi.fn(async function* () {
        yieldOrder.push('first');
        yield { type: 'say', text: 'first' };
        yieldOrder.push('second');
        yield { type: 'say', text: 'second' };
        yield { type: 'end_of_turn' };
      }) as unknown as BridgeDeps['runTurn'],
      speak: vi.fn(async (text: string) => {
        speakOrder.push(`speak:${text}`);
        yieldOrder.push(`spoke:${text}`);
      }),
    };
    const bridge = createBridge(deps);
    await bridge.handleUserText('go');
    expect(speakOrder).toEqual(['speak:first', 'speak:second']);
    expect(yieldOrder).toEqual(['first', 'spoke:first', 'second', 'spoke:second']);
  });
});

describe('bridge.dispatchHostAction()', () => {
  it('publishes a host_action_request to the data channel and resolves with the matching result', async () => {
    const deps = baseDeps();
    const bridge = createBridge(deps);
    const promise = bridge.dispatchHostAction!({ type: 'navigate', path: '/pricing' });
    const calls = (deps.publishData as ReturnType<typeof vi.fn>).mock.calls;
    const haCall = calls.find((c) => (c[0] as { type: string }).type === 'host_action_request');
    expect(haCall).toBeDefined();
    const msg = haCall![0] as { type: string; callId: string; action: unknown };
    expect(msg).toMatchObject({
      type: 'host_action_request',
      action: { type: 'navigate', path: '/pricing' },
    });
    bridge.deliverHostActionResult!({ callId: msg.callId, result: { ok: true } });
    const result = await promise;
    expect(result).toEqual({ ok: true });
  });

  it('times out a host action after 5 seconds with reason: timeout', async () => {
    vi.useFakeTimers();
    const deps = baseDeps();
    const bridge = createBridge(deps);
    const promise = bridge.dispatchHostAction!({ type: 'click', intent: 'signup button' });
    vi.advanceTimersByTime(6000);
    const result = await promise;
    expect(result).toEqual({ ok: false, reason: 'timeout' });
    vi.useRealTimers();
  });
});

describe('bridge — continuation after a short pause', () => {
  // runTurn that "thinks" (waits) and then adds to cart via the host-action dep.
  function slowCartRunTurn(seen: string[], gate: Promise<void>) {
    return vi.fn(async function* (runDeps: { dispatchHostAction?: (a: unknown) => Promise<{ ok: boolean; reason?: string }> }, _m: unknown, _s: unknown, msg: { text: string }) {
      seen.push(msg.text);
      await gate;
      const sku = /dog/i.test(msg.text) ? 'dog-mantra' : 'green-mantra';
      const r = await runDeps.dispatchHostAction?.({ type: 'cart_add', sku, qty: 1 });
      seen.push(`dispatch:${r?.ok ? 'ok' : r?.reason}`);
      yield { type: 'end_of_turn' } as AgentEvent;
    });
  }

  it('withdraws the half-sentence and runs the whole one — the page is touched once', async () => {
    const seen: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const deps: BridgeDeps = {
      ...baseDeps(),
      loadMerchant: vi.fn().mockResolvedValue({ id: 'SM-AAAAAA', siteGraphEnabled: true }),
      runTurn: slowCartRunTurn(seen, gate) as unknown as BridgeDeps['runTurn'],
    };
    const bridge = createBridge(deps);
    bridge.dispatchHostAction = vi.fn().mockResolvedValue({ ok: true });
    const first = bridge.handleUserText('Please add one green');
    await new Promise((r) => setTimeout(r, 0));
    const second = bridge.handleUserText('mantra to my cart', { continues: true });
    await new Promise((r) => setTimeout(r, 0));
    release();
    await Promise.all([first, second]);
    expect(seen).toContain('Please add one green mantra to my cart');
    expect(seen.filter((s) => s === 'dispatch:ok')).toHaveLength(1);
    expect(seen).toContain('dispatch:superseded');
  });

  it('if the half-sentence already acted, the rest runs as a normal follow-up', async () => {
    const seen: string[] = [];
    const deps: BridgeDeps = {
      ...baseDeps(),
      loadMerchant: vi.fn().mockResolvedValue({ id: 'SM-AAAAAA', siteGraphEnabled: true }),
      runTurn: slowCartRunTurn(seen, Promise.resolve()) as unknown as BridgeDeps['runTurn'],
    };
    const bridge = createBridge(deps);
    bridge.dispatchHostAction = vi.fn().mockResolvedValue({ ok: true });
    await bridge.handleUserText('Add the sleep drops');
    await bridge.handleUserText('and the dog one', { continues: true });
    expect(seen).toEqual(['Add the sleep drops', 'dispatch:ok', 'and the dog one', 'dispatch:ok']);
  });
});

describe('bridge — duplicate cart-add safety net', () => {
  const cartRunTurn = (seen: string[]) =>
    vi.fn(async function* (runDeps: { dispatchHostAction?: (a: unknown) => Promise<{ ok: boolean; reason?: string }> }) {
      const r = await runDeps.dispatchHostAction?.({ type: 'cart_add', sku: 'green-mantra', qty: 1 });
      seen.push(r?.ok ? 'added' : `blocked:${r?.reason}`);
      yield { type: 'end_of_turn' } as AgentEvent;
    });
  const make = (seen: string[]) => {
    const bridge = createBridge({
      ...baseDeps(),
      loadMerchant: vi.fn().mockResolvedValue({ id: 'SM-AAAAAA', siteGraphEnabled: true }),
      runTurn: cartRunTurn(seen) as unknown as BridgeDeps['runTurn'],
    });
    bridge.dispatchHostAction = vi.fn().mockResolvedValue({ ok: true });
    return bridge;
  };

  it('blocks adding the same product again moments later unless they ask for more', async () => {
    const seen: string[] = [];
    const bridge = make(seen);
    await bridge.handleUserText('Please add one green');
    await bridge.handleUserText('Mantra to my cart.');
    await bridge.handleUserText('Add another one please');
    expect(seen).toEqual(['added', 'blocked:duplicate', 'added']);
  });
});

describe('createBridge — case.open outcome reaches the voice model', () => {
  it('passes the reference on success and the reason on failure', async () => {
    const onCaseResult = vi.fn();
    const deps: BridgeDeps = {
      ...baseDeps(),
      onCaseResult,
      runTurn: fakeRunTurn([
        { type: 'tool_result', toolName: 'case.open', ok: false, summary: 'need a phone number or email' },
        { type: 'tool_result', toolName: 'case.open', ok: true, summary: '#31' },
        { type: 'tool_result', toolName: 'products.search', ok: true },
        { type: 'end_of_turn' },
      ]) as unknown as BridgeDeps['runTurn'],
    };
    await createBridge(deps).handleUserText('book a demo meeting');
    expect(onCaseResult.mock.calls).toEqual([
      [false, 'need a phone number or email'],
      [true, '#31'],
    ]);
  });
});
