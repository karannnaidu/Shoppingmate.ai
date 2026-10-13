import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type FlushMeta, createInputFlusher } from './inputFlusher.js';

describe('input flusher (act on the visitor’s words as soon as they stop)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const collect = () => {
    const out: Array<{ text: string } & FlushMeta> = [];
    return { out, emit: (text: string, meta: FlushMeta) => out.push({ text, ...meta }) };
  };

  it('emits the whole utterance once no new words arrive for quietMs', () => {
    const c = collect();
    const f = createInputFlusher({ quietMs: 400, emit: c.emit });
    for (const piece of [' Ple', 'ase', ' add', ' one', ' green', ' man', 'tra', ' to', ' my cart.']) {
      f.push(piece);
      vi.advanceTimersByTime(250);
    }
    expect(c.out).toEqual([]);
    vi.advanceTimersByTime(200);
    expect(c.out).toEqual([{ text: 'Please add one green mantra to my cart.', viaQuiet: true, continues: false }]);
  });

  it('flushes immediately when Olivia starts answering, once', () => {
    const c = collect();
    const f = createInputFlusher({ quietMs: 400, emit: c.emit });
    f.push(' Add the sleep drops');
    f.flushNow();
    vi.advanceTimersByTime(1000);
    expect(c.out).toEqual([{ text: 'Add the sleep drops', viaQuiet: false, continues: false }]);
  });

  it('marks words after a short pause as a continuation of the cut-off phrase', () => {
    const c = collect();
    const f = createInputFlusher({ quietMs: 400, continueWindowMs: 2500, emit: c.emit });
    f.push(' Add one green');
    vi.advanceTimersByTime(450); // paused mid-sentence → flushed early
    f.push(' mantra please');
    vi.advanceTimersByTime(450);
    expect(c.out).toEqual([
      { text: 'Add one green', viaQuiet: true, continues: false },
      { text: 'mantra please', viaQuiet: true, continues: true },
    ]);
  });

  it('a new sentence long after the last, or after Olivia spoke, is not a continuation', () => {
    const c = collect();
    const f = createInputFlusher({ quietMs: 400, continueWindowMs: 2500, emit: c.emit });
    f.push(' Hi');
    vi.advanceTimersByTime(450);
    vi.advanceTimersByTime(5000);
    f.push(' Show me sleep drops');
    vi.advanceTimersByTime(450);
    f.push(' and the dog one');
    f.flushNow(); // Olivia began → not quiet
    f.push(' thanks');
    vi.advanceTimersByTime(450);
    expect(c.out.map((o) => o.continues)).toEqual([false, false, true, false]);
  });
});
