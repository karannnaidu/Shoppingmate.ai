// Hands the visitor's words to the action layer as soon as they've finished
// speaking — not when Olivia finishes her spoken reply.
//
// Measured 2026-10-13 ("Please add one Green Mantra to my cart"): speech ended
// 5.2s, transcript complete 5.7s, Olivia's first audio 7.9s, Gemini turnComplete
// 11.2s (15–20s for longer replies) — and actions only started at turnComplete.
// Gemini never sends the transcription `finished` flag, so we flush when no new
// words have arrived for `quietMs`, or the moment Olivia starts answering.
//
// The quiet window is short (400ms) for speed. If the visitor was only pausing,
// the next words come out marked `continues` so the action layer replaces the
// half-sentence with the whole one (and Olivia can "mm-hmm" in the pause).

export type FlushMeta = {
  /** Flushed because the visitor went quiet (vs Olivia starting / turn end). */
  viaQuiet: boolean;
  /** Continues an utterance that was flushed after a short pause moments ago. */
  continues: boolean;
};

export type InputFlusher = {
  /** A new piece of the visitor's transcript arrived. */
  push(text: string): void;
  /** Olivia started answering (or the turn completed): flush now. */
  flushNow(): void;
  /** Drop pending text and timers (session closing). */
  dispose(): void;
};

export function createInputFlusher(opts: {
  quietMs?: number;
  continueWindowMs?: number;
  emit: (text: string, meta: FlushMeta) => void;
}): InputFlusher {
  const quietMs = opts.quietMs ?? Number(process.env.INPUT_FLUSH_MS ?? 400);
  const continueWindowMs = opts.continueWindowMs ?? 2_500;
  let buf = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastQuietFlushAt = 0;
  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  const flush = (viaQuiet: boolean) => {
    clear();
    const text = buf.trim();
    buf = '';
    if (!text) return;
    const now = Date.now();
    const continues = lastQuietFlushAt > 0 && now - lastQuietFlushAt < continueWindowMs;
    lastQuietFlushAt = viaQuiet ? now : 0;
    opts.emit(text, { viaQuiet, continues });
  };
  return {
    push(text) {
      buf += text;
      clear();
      timer = setTimeout(() => flush(true), quietMs);
    },
    flushNow: () => flush(false),
    dispose() {
      clear();
      buf = '';
    },
  };
}
