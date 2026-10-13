import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVoiceModeWs } from '../src/audio/voiceModeWs.js';

// Minimal browser fakes: a WebSocket we can drive, an AudioContext with
// worklets, and getUserMedia — enough to exercise the voice mode's logic.
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
const workletNodes: FakeWorkletNode[] = [];
class FakeWorkletNode {
  posted: unknown[] = [];
  port = {
    onmessage: null as ((e: { data: unknown }) => void) | null,
    postMessage: (m: unknown) => this.posted.push(m),
  };
  constructor(_c: unknown, public name: string) {
    workletNodes.push(this);
  }
  connect() {}
  disconnect() {}
}
const gain = () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } });
class FakeCtx {
  sampleRate = 48_000;
  destination = {};
  audioWorklet = { addModule: vi.fn(async () => {}) };
  resume = vi.fn(async () => {});
  createGain = () => gain();
  createMediaStreamSource = () => gain();
}
const player = () => workletNodes.find((n) => n.name === 'sm-play')!;
const jsonSent = (ws: FakeWS) => ws.sent.filter((d): d is string => typeof d === 'string').map((s) => JSON.parse(s));

describe('WebSocket voice mode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    workletNodes.length = 0;
    vi.stubGlobal('WebSocket', FakeWS);
    vi.stubGlobal('AudioContext', FakeCtx);
    vi.stubGlobal('AudioWorkletNode', FakeWorkletNode);
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

  it('warm opens the socket and builds the audio graph; an unused socket closes after 60s', async () => {
    const vm = make();
    vm.warm?.();
    await vi.advanceTimersByTimeAsync(5);
    expect(FakeWS.last!.readyState).toBe(1);
    expect(player()).toBeTruthy(); // jitter-buffered player ready before the tap
    await vi.advanceTimersByTimeAsync(60_500);
    expect(FakeWS.last!.readyState).toBe(3);
  });

  it('stays CONNECTING until Olivia is audible, then flows audio, barge-in and timings', async () => {
    const events: string[] = [];
    const vm = make(events);
    vm.start();
    await vi.advanceTimersByTimeAsync(5);
    const ws = FakeWS.last!;
    await vi.waitFor(() => expect(jsonSent(ws).map((m) => m.type)).toContain('start_voice'));
    // Server ready is NOT "connected" yet.
    vm.signalAgentReady?.();
    expect(vm.getState()).toBe('connecting');
    // Audio arrives → handed to the player (as float samples).
    ws.onmessage?.({ data: new Int16Array(2400).buffer });
    expect(player().posted.some((m) => m instanceof Float32Array)).toBe(true);
    // Player starts sounding → now connected + speaking, first_audio reported.
    player().port.onmessage?.({ data: { t: 'playing', stutters: 0, preMs: 150 } });
    expect(vm.getState()).toBe('speaking');
    const timing = jsonSent(ws).find((m) => m.type === 'voice_timing');
    expect(timing.timings).toMatchObject({ transport_ws: 1 });
    expect(timing.timings).toHaveProperty('first_audio');
    // Agent events are forwarded; audio_clear empties the player instead.
    ws.onmessage?.({ data: JSON.stringify({ type: 'say', text: 'Hi' }) });
    ws.onmessage?.({ data: JSON.stringify({ type: 'audio_clear' }) });
    expect(events).toHaveLength(1);
    expect(player().posted).toContain('clear');
    expect(vm.getState()).toBe('listening');
    // A started call is never idle-closed; a server drop ends it with an error.
    await vi.advanceTimersByTimeAsync(120_000);
    expect(ws.readyState).toBe(1);
    const errors: string[] = [];
    vm.onError?.((e) => errors.push(e.code));
    ws.close();
    expect(vm.getState()).toBe('idle');
    expect(errors).toEqual(['connect_failed']);
  });

  it('falls back to listening if no audio ever arrives', async () => {
    const vm = make();
    vm.start();
    await vi.advanceTimersByTimeAsync(5);
    vm.signalAgentReady?.();
    await vi.advanceTimersByTimeAsync(8_100);
    expect(vm.getState()).toBe('listening');
  });
});
