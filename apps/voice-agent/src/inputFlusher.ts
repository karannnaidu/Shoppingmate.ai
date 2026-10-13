// Hands the visitor's words to the action layer as soon as they've finished
// speaking — not when Olivia finishes her spoken reply.
//
// Measured 2026-10-13 ("Please add one Green Mantra to my cart"): speech ended
// 5.2s, transcript complete 5.7s, Olivia's first audio 7.9s, Gemini turnComplete
// 11.2s (15–20s for longer replies) — and actions only started at turnComplete,
// so the cart updated long after Olivia said "added it". Gemini never sends the
// transcription `finished` flag, so we flush when no new words have arrived for
// `quietMs`, or the moment Olivia starts answering (her turn means theirs ended).
// Words that arrive after a flush are flushed again as a continuation.

export type InputFlusher = {
  /** A new piece of the visitor's transcript arrived. */
  push(text: string): void;
  /** Olivia started answering (or the turn completed): flush now. */
  flushNow(): void;
  /** Drop pending text and timers (session closing). */
  dispose(): void;
};

export function createInputFlusher(opts: { quietMs?: number; emit: (text: string) => void }): InputFlusher {
  const quietMs = opts.quietMs ?? Number(process.env.INPUT_FLUSH_MS ?? 700);
  let buf = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  const flush = () => {
    clear();
    const text = buf.trim();
    buf = '';
    if (text) opts.emit(text);
  };
  return {
    push(text) {
      buf += text;
      clear();
      timer = setTimeout(flush, quietMs);
    },
    flushNow: flush,
    dispose() {
      clear();
      buf = '';
    },
  };
}
