import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type AgentSocket, connectAgentWs } from '../src/transport/ws.js';

class MockWs {
  static instances: MockWs[] = [];
  readyState = 0;
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  sent: string[] = [];
  constructor(public url: string) {
    MockWs.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.onclose?.(new CloseEvent('close'));
  }
  open() {
    this.readyState = 1;
    this.onopen?.(new Event('open'));
  }
  message(s: string) {
    this.onmessage?.(new MessageEvent('message', { data: s }));
  }
  fail() {
    this.onerror?.(new Event('error'));
    this.readyState = 3;
    this.onclose?.(new CloseEvent('close'));
  }
}

beforeEach(() => {
  MockWs.instances = [];
  vi.stubGlobal('WebSocket', MockWs);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('connectAgentWs', () => {
  it('opens with the supplied URL and forwards events', () => {
    const events: string[] = [];
    const sock: AgentSocket = connectAgentWs('wss://api/test', {
      sessionId: 'ws_a',
      onEvent: (raw) => events.push(raw),
      onStatus: () => {},
    });
    expect(MockWs.instances).toHaveLength(1);
    const first = MockWs.instances[0];
    if (!first) throw new Error('no instance');
    first.open();
    first.message('{"type":"say","text":"hi"}');
    expect(events).toEqual(['{"type":"say","text":"hi"}']);
    sock.close();
  });

  it('reconnects with exponential backoff and sends session_resume on reconnect', () => {
    const statuses: string[] = [];
    const sock = connectAgentWs('wss://api/test', {
      sessionId: 'ws_a',
      onEvent: () => {},
      onStatus: (s) => statuses.push(s),
    });
    const first = MockWs.instances[0];
    if (!first) throw new Error('no instance');
    first.open();
    statuses.length = 0;
    first.fail();
    expect(statuses).toContain('reconnecting');
    vi.advanceTimersByTime(1000);
    expect(MockWs.instances).toHaveLength(2);
    const second = MockWs.instances[1];
    if (!second) throw new Error('no second instance');
    second.open();
    expect(second.sent[0]).toBe(
      JSON.stringify({ type: 'session_resume', sessionId: 'ws_a' }),
    );
    sock.close();
  });

  it('gives up after 5 failures', () => {
    const statuses: string[] = [];
    connectAgentWs('wss://api/test', {
      sessionId: 'ws_a',
      onEvent: () => {},
      onStatus: (s) => statuses.push(s),
    });
    for (let i = 0; i < 5; i += 1) {
      const last = MockWs.instances.at(-1);
      if (!last) throw new Error('no instance to fail');
      last.fail();
      vi.advanceTimersByTime(60_000);
    }
    expect(statuses).toContain('disconnected');
  });
});
