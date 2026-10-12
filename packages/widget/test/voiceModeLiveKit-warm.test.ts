import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Fake LiveKit room handle; records what the voice mode does with it.
const rooms: Array<{
  published: string[];
  disconnected: boolean;
  speaking?: (s: boolean) => void;
}> = [];
vi.mock('../src/transport/livekit.js', () => ({
  connectToRoom: vi.fn(async () => {
    const r = { published: [] as string[], disconnected: false, speaking: undefined as ((s: boolean) => void) | undefined };
    rooms.push(r);
    return {
      setMicEnabled: async () => {},
      setAgentAudioMuted: () => {},
      onData: () => {},
      onAgentSpeaking: (cb: (s: boolean) => void) => {
        r.speaking = cb;
      },
      onReconnected: () => {},
      publishData: async (b: Uint8Array) => {
        r.published.push(new TextDecoder().decode(b));
      },
      disconnect: async () => {
        r.disconnected = true;
      },
    };
  }),
}));

import { createVoiceModeLiveKit } from '../src/audio/voiceModeLiveKit.js';

const make = () =>
  createVoiceModeLiveKit({ sessionId: 'ws_test', wsUrl: 'wss://x', token: 't', roomName: 'sm_ws_test', onTranscriptEvent: () => {} });
const flush = () => vi.advanceTimersByTimeAsync(0);

describe('voiceModeLiveKit warm-on-intent', () => {
  beforeEach(() => {
    rooms.length = 0;
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('drops a warmed room nobody used after 60s (LiveKit bills connected minutes)', async () => {
    const vm = make();
    vm.warm?.();
    await flush();
    expect(rooms).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(59_000);
    expect(rooms[0]!.disconnected).toBe(false);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(rooms[0]!.disconnected).toBe(true);
    // Intent again → a fresh room.
    vm.warm?.();
    await flush();
    expect(rooms).toHaveLength(2);
  });

  it('renewed interest keeps the room; a started call is never dropped', async () => {
    const vm = make();
    vm.warm?.();
    await flush();
    await vi.advanceTimersByTimeAsync(50_000);
    vm.warm?.(); // hovered again
    await vi.advanceTimersByTimeAsync(50_000);
    expect(rooms[0]!.disconnected).toBe(false);
    vm.start();
    await flush();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(rooms[0]!.disconnected).toBe(false);
  });

  it('reports tap → room → mic → ready → first audio once per call', async () => {
    const vm = make();
    vm.start(); // cold tap: no warm room yet
    await flush();
    vm.signalAgentReady?.();
    rooms[0]!.speaking?.(true);
    await flush();
    const timing = rooms[0]!.published.map((s) => JSON.parse(s)).find((m) => m.type === 'voice_timing');
    expect(timing.timings).toMatchObject({ was_warm: 0 });
    for (const k of ['room_connected', 'mic_on', 'agent_ready', 'first_audio']) expect(timing.timings).toHaveProperty(k);
    rooms[0]!.speaking?.(true);
    await flush();
    expect(rooms[0]!.published.filter((s) => s.includes('voice_timing'))).toHaveLength(1);
  });
});
