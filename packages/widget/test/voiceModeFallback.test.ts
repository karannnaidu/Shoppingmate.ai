import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVoiceModeWithFallback } from '../src/audio/voiceModeFallback.js';
import type { VoiceMode, VoiceModeState } from '../src/audio/voiceModeWebSpeech.js';

function fakeMode(name: string) {
  let state: VoiceModeState = 'idle';
  const stateCbs: ((s: VoiceModeState) => void)[] = [];
  const errCbs: ((i: { code: string; message: string }) => void)[] = [];
  const m = {
    name,
    started: 0,
    stopped: 0,
    set(s: VoiceModeState) {
      state = s;
      stateCbs.forEach((cb) => cb(s));
    },
    error(code: string) {
      errCbs.forEach((cb) => cb({ code, message: code }));
    },
    mode: {
      start: () => {
        m.started++;
        m.set('connecting');
      },
      stop: () => {
        m.stopped++;
        m.set('idle');
      },
      speak: async () => {},
      setMuted: () => {},
      getState: () => state,
      onStateChange: (cb: (s: VoiceModeState) => void) => stateCbs.push(cb),
      onError: (cb: (i: { code: string; message: string }) => void) => errCbs.push(cb),
    } as VoiceMode,
  };
  return m;
}

describe('WebSocket voice with LiveKit fallback', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('switches the same call to LiveKit when the WebSocket connection fails', () => {
    const ws = fakeMode('ws');
    const lk = fakeMode('lk');
    const states: string[] = [];
    const vm = createVoiceModeWithFallback(ws.mode, () => lk.mode);
    vm.onStateChange((s) => states.push(s));
    vm.start();
    ws.error('connect_failed');
    expect(lk.started).toBe(1);
    lk.set('speaking');
    expect(vm.getState()).toBe('speaking');
    expect(states).toContain('speaking');
  });

  it('switches when no audio arrives in time, but never after audio has played', async () => {
    const ws = fakeMode('ws');
    const lk = fakeMode('lk');
    const vm = createVoiceModeWithFallback(ws.mode, () => lk.mode, { noAudioMs: 7000 });
    vm.start();
    await vi.advanceTimersByTimeAsync(7100);
    expect(lk.started).toBe(1);

    const ws2 = fakeMode('ws2');
    const lk2 = fakeMode('lk2');
    const vm2 = createVoiceModeWithFallback(ws2.mode, () => lk2.mode, { noAudioMs: 7000 });
    vm2.start();
    ws2.set('speaking');
    await vi.advanceTimersByTimeAsync(10_000);
    ws2.error('connect_failed'); // later drop mid-call: surfaced, no silent switch
    expect(lk2.started).toBe(0);
  });

  it('does not switch for a mic permission problem (LiveKit would fail too)', () => {
    const ws = fakeMode('ws');
    const lk = fakeMode('lk');
    const errors: string[] = [];
    const vm = createVoiceModeWithFallback(ws.mode, () => lk.mode);
    vm.onError?.((e) => errors.push(e.code));
    vm.start();
    ws.error('mic_denied');
    expect(lk.started).toBe(0);
    expect(errors).toEqual(['mic_denied']);
  });
});
