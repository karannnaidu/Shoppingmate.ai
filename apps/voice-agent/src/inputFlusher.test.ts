import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInputFlusher } from './inputFlusher.js';

describe('input flusher (act on the visitor’s words as soon as they stop)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('emits the whole utterance once no new words arrive for quietMs', () => {
    const out: string[] = [];
    const f = createInputFlusher({ quietMs: 700, emit: (t) => out.push(t) });
    for (const piece of [' Ple', 'ase', ' add', ' one', ' green', ' man', 'tra', ' to', ' my cart.']) {
      f.push(piece);
      vi.advanceTimersByTime(250); // words keep coming every ~250ms
    }
    expect(out).toEqual([]);
    vi.advanceTimersByTime(500);
    expect(out).toEqual(['Please add one green mantra to my cart.']);
  });

  it('flushes immediately when Olivia starts answering', () => {
    const out: string[] = [];
    const f = createInputFlusher({ quietMs: 700, emit: (t) => out.push(t) });
    f.push(' Add the sleep drops');
    f.flushNow();
    expect(out).toEqual(['Add the sleep drops']);
    vi.advanceTimersByTime(1000);
    expect(out).toHaveLength(1); // no double emit
  });

  it('late words after a flush go out as a continuation; empty input emits nothing', () => {
    const out: string[] = [];
    const f = createInputFlusher({ quietMs: 700, emit: (t) => out.push(t) });
    f.push(' Add one green');
    vi.advanceTimersByTime(800);
    f.push(' mantra please');
    f.flushNow();
    f.flushNow();
    expect(out).toEqual(['Add one green', 'mantra please']);
    f.push('   ');
    vi.advanceTimersByTime(800);
    expect(out).toHaveLength(2);
  });
});
