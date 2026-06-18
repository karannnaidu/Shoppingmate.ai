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
