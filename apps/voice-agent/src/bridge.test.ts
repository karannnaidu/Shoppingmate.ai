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
});
