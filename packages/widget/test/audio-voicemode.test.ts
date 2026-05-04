import { describe, expect, it } from 'vitest';
import type { STT } from '../src/audio/stt.js';
import type { TTS } from '../src/audio/tts.js';
import { createVoiceMode } from '../src/audio/voiceMode.js';

type FakeSTT = STT & { startCalls: () => number; stopCalls: () => number };

function fakeSTT(): FakeSTT {
  let startCalls = 0;
  let stopCalls = 0;
  return {
    start: () => {
      startCalls += 1;
    },
    stop: () => {
      stopCalls += 1;
    },
    onFinal: () => {},
    onError: () => {},
    isActive: () => false,
    startCalls: () => startCalls,
    stopCalls: () => stopCalls,
  };
}

type FakeTTS = TTS & { spoke: () => string[] };

function fakeTTS(): FakeTTS {
  const spoke: string[] = [];
  return {
    speak: async (t) => {
      spoke.push(t);
    },
    cancel: () => {},
    available: () => true,
    spoke: () => spoke.slice(),
  };
}

describe('voiceMode', () => {
  it('start moves idle → listening and starts STT', () => {
    const stt = fakeSTT();
    const vm = createVoiceMode(stt, fakeTTS());
    vm.start();
    expect(vm.getState()).toBe('listening');
    expect(stt.startCalls()).toBe(1);
  });

  it('speak pauses STT during TTS and resumes after', async () => {
    const stt = fakeSTT();
    const vm = createVoiceMode(stt, fakeTTS());
    vm.start();
    await vm.speak('hello');
    expect(stt.stopCalls()).toBe(1);
    expect(stt.startCalls()).toBe(2);
    expect(vm.getState()).toBe('listening');
  });

  it('mute stops STT and prevents listening', () => {
    const stt = fakeSTT();
    const vm = createVoiceMode(stt, fakeTTS());
    vm.start();
    vm.setMuted(true);
    expect(vm.getState()).toBe('muted');
    expect(stt.stopCalls()).toBeGreaterThan(0);
  });

  it('unmute returns to listening', () => {
    const stt = fakeSTT();
    const vm = createVoiceMode(stt, fakeTTS());
    vm.start();
    vm.setMuted(true);
    vm.setMuted(false);
    expect(vm.getState()).toBe('listening');
  });

  it('stop returns to idle and clears TTS', () => {
    const stt = fakeSTT();
    const vm = createVoiceMode(stt, fakeTTS());
    vm.start();
    vm.stop();
    expect(vm.getState()).toBe('idle');
  });
});
