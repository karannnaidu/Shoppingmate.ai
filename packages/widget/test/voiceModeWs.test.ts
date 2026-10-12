import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVoiceModeWs } from '../src/audio/voiceModeWs.js';

// Minimal browser fakes: a WebSocket we can drive, and an AudioContext /
// getUserMedia good enough for the voice mode's plumbing.
class FakeWS {
  static OPEN = 1;
  static last: FakeWS | null = null;
  readyState = 0;
  binaryType = '';
  sent: Array<string | ArrayBuffer> = [];
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  constructor(public url: string) {
    FakeWS.last = this;
    setTimeout(() => {
      this.readyState = 1;
      this.onopen?.();
    }, 0);
  }
  send(d: string | ArrayBuffer) {
    this.sent.push(d);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
}
const node = () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } });
class FakeCtx {
  sampleRate = 48_000;
  currentTime = 0;
  destination = {};
  audioWorklet = { addModule: vi.fn(async () => {}) };
  resume = vi.fn(async () => {});
  createGain = () => node();
  createMediaStreamDestination = () => ({ stream: {} });
  createMediaStreamSource = () => node();
  createBuffer = (_c: number, n: number, rate: number) => ({ duration: n / rate, copyToChannel: vi.fn() });
  createBufferSource = () => ({ buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null });
}

describe('WebSocket voice mode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWS);
    vi.stubGlobal('AudioContext', FakeCtx);
    vi.stubGlobal('AudioWorkletNode', class {
      port: { onmessage: unknown } = { onmessage: null };
      connect() {}
      disconnect() {}
    });
    vi.stubGlobal('Audio', class {
      autoplay = false;
      srcObject: unknown = null;
      play = () => Promise.resolve();
    });
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) },
    });
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const make = (events: string[] = []) =>
    createVoiceModeWs({
      sessionId: 'ws_t',
      url: 'wss://voice.example/v1/voice?token=x',
      onAgentEvent: (b) => events.push(new TextDecoder().decode(b)),
    });

  it('warm opens the socket; an unused one is closed after 60s', async () => {
    const vm = make();
    vm.warm?.();
    await vi.advanceTimersByTimeAsync(1);
    const ws = FakeWS.last!;
    expect(ws.readyState).toBe(1);
    await vi.advanceTimersByTimeAsync(60_500);
    expect(ws.readyState).toBe(3);
  });

  it('a tap opens the mic and sends start_voice; events, audio and barge-in flow', async () => {
    const events: string[] = [];
    const vm = make(events);
    const states: string[] = [];
    vm.onStateChange((s) => states.push(s));
    vm.start();
    await vi.advanceTimersByTimeAsync(5);
    const ws = FakeWS.last!;
    const msgs = ws.sent.filter((d): d is string => typeof d === 'string').map((s) => JSON.parse(s));
    expect(msgs.map((m) => m.type)).toContain('start_voice');
    // Agent event → forwarded to the widget.
    ws.onmessage?.({ data: JSON.stringify({ type: 'agent_ready' }) });
    expect(events[0]).toContain('agent_ready');
    vm.signalAgentReady?.();
    // Olivia's audio → speaking; first audio reports the startup timing.
    ws.onmessage?.({ data: new Int16Array(2400).buffer });
    expect(vm.getState()).toBe('speaking');
    const timing = ws.sent.filter((d): d is string => typeof d === 'string').map((s) => JSON.parse(s)).find((m) => m.type === 'voice_timing');
    expect(timing.timings).toMatchObject({ transport_ws: 1 });
    expect(timing.timings).toHaveProperty('first_audio');
    // Barge-in clears playback.
    ws.onmessage?.({ data: JSON.stringify({ type: 'audio_clear' }) });
    expect(vm.getState()).toBe('listening');
    expect(events).toHaveLength(1); // audio_clear is not forwarded
    // A started call is never idle-closed.
    await vi.advanceTimersByTimeAsync(120_000);
    expect(ws.readyState).toBe(1);
    // Server drops → call ends with a connect error the panel can show.
    const errors: string[] = [];
    vm.onError?.((e) => errors.push(e.code));
    ws.close();
    expect(vm.getState()).toBe('idle');
    expect(errors).toEqual(['connect_failed']);
  });
});
