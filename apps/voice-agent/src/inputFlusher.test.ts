import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type FlushMeta, createInputFlusher } from './inputFlusher.js';

describe('input flusher', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const collect = () => {
    const out: Array<{ text: string } & FlushMeta> = [];
    return { out, emit: (text: string, meta: FlushMeta) => out.push({ text, ...meta }) };
  };

  it('acts the moment Olivia starts answering (Gemini decided the turn ended)', () => {
    const c = collect();
    const f = createInputFlusher({ emit: c.emit });
    f.push(' Please add one green mantra to my cart.');
    vi.advanceTimersByTime(300);
    f.flushNow();
    vi.advanceTimersByTime(3000);
    expect(c.out).toEqual([{ text: 'Please add one green mantra to my cart.', viaQuiet: false, continues: false }]);
  });

  it('a 400ms pause only triggers the "mm-hmm" — it never acts on half a sentence', () => {
    const c = collect();
    const pauses: number[] = [];
    const f = createInputFlusher({ quietMs: 1200, pauseMs: 400, onPause: () => pauses.push(Date.now()), emit: c.emit });
    f.push(' Please add one green');
    vi.advanceTimersByTime(900); // mid-sentence pause
    expect(pauses).toHaveLength(1);
    expect(c.out).toEqual([]);
    f.push(' mantra to my cart.');
    f.flushNow();
    expect(c.out.map((o) => o.text)).toEqual(['Please add one green mantra to my cart.']);
  });

  it('falls back to acting after quietMs if Olivia never starts', () => {
    const c = collect();
    const f = createInputFlusher({ quietMs: 1200, emit: c.emit });
    f.push(' hello?');
    vi.advanceTimersByTime(1250);
    expect(c.out).toEqual([{ text: 'hello?', viaQuiet: true, continues: false }]);
  });

  it('never pauses or flushes while the mic still hears speech', () => {
    const c = collect();
    const pauses: number[] = [];
    let speaking = true;
    const f = createInputFlusher({ quietMs: 1200, pauseMs: 400, stillSpeaking: () => speaking, onPause: () => pauses.push(1), emit: c.emit });
    f.push(' Please add one');
    vi.advanceTimersByTime(3000);
    expect(pauses).toEqual([]);
    expect(c.out).toEqual([]);
    speaking = false;
    vi.advanceTimersByTime(1300);
    expect(pauses).toEqual([1]);
    expect(c.out.map((o) => o.text)).toEqual(['Please add one']);
  });

  it('words right after a flush are marked as a continuation', () => {
    const c = collect();
    const f = createInputFlusher({ continueWindowMs: 2500, emit: c.emit });
    f.push(' Add the sleep drops');
    f.flushNow();
    f.push(' and the dog one');
    f.flushNow();
    vi.advanceTimersByTime(5000);
    f.push(' thanks');
    f.flushNow();
    expect(c.out.map((o) => o.continues)).toEqual([false, true, false]);
  });
});
