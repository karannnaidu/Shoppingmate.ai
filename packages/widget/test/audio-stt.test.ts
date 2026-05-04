import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSTT } from '../src/audio/stt.js';

class FakeRecognition {
  static lastInstance: FakeRecognition | null = null;
  continuous = false;
  interimResults = false;
  lang = 'en-US';
  // biome-ignore lint/suspicious/noExplicitAny: test stub for SpeechRecognition event
  onresult: ((ev: any) => void) | null = null;
  // biome-ignore lint/suspicious/noExplicitAny: test stub for SpeechRecognition event
  onerror: ((ev: any) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  stopped = false;
  constructor() {
    FakeRecognition.lastInstance = this;
  }
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
    this.onend?.();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeRecognition.lastInstance = null;
});

describe('createSTT', () => {
  it('returns null when SpeechRecognition is unavailable', () => {
    vi.stubGlobal('SpeechRecognition', undefined);
    vi.stubGlobal('webkitSpeechRecognition', undefined);
    expect(createSTT()).toBeNull();
  });

  it('uses webkitSpeechRecognition fallback', () => {
    vi.stubGlobal('SpeechRecognition', undefined);
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
    const stt = createSTT();
    expect(stt).not.toBeNull();
  });

  it('emits final transcripts via onFinal', () => {
    vi.stubGlobal('SpeechRecognition', FakeRecognition);
    const finals: string[] = [];
    const stt = createSTT();
    if (!stt) throw new Error('expected STT');
    stt.onFinal((t) => finals.push(t));
    stt.start();
    const inst = FakeRecognition.lastInstance;
    if (!inst) throw new Error('no recognition instance');
    inst.onresult?.({
      results: [{ 0: { transcript: 'hello there' }, isFinal: true, length: 1 }],
    });
    expect(finals).toEqual(['hello there']);
  });

  it('start/stop are idempotent', () => {
    vi.stubGlobal('SpeechRecognition', FakeRecognition);
    const stt = createSTT();
    if (!stt) throw new Error('expected STT');
    stt.start();
    stt.start();
    const inst = FakeRecognition.lastInstance;
    if (!inst) throw new Error('no recognition instance');
    expect(inst.started).toBe(true);
    stt.stop();
    stt.stop();
    expect(inst.stopped).toBe(true);
  });
});
