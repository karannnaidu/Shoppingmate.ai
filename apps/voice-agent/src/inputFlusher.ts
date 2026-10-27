// Hands the visitor's words to the action layer as soon as their turn is over —
// not when Olivia finishes her spoken reply.
//
// Measured 2026-10-13 ("Please add one Green Mantra to my cart"): speech ended
// 5.2s, transcript complete 5.7s, Olivia's first audio 7.9s, Gemini turnComplete
// 11.2s (15–20s for longer replies) — and actions only started at turnComplete.
//
// Two separate signals:
// - PAUSE (`pauseMs`, 400ms): the visitor went quiet. Audio-only use: Olivia
//   plays a soft "mm-hmm". Never acts on the page.
// - FLUSH: the turn is over → hand the words to the action layer. Normally the
//   moment Olivia starts answering (Gemini's own end-of-turn decision, so actions
//   and voice always agree where the sentence ended); `quietMs` (1200ms) is only
//   a fallback. Live test with a 400ms flush: Gemini's transcript arrived in
//   3 pieces and "…Mantra to my cart" re-added Green Mantra — fragments are
//   ambiguous, and a wrong cart is worse than a slower one.
// Neither fires while the mic still carries speech (`stillSpeaking`).

export type FlushMeta = {
  /** Flushed by the quiet fallback (vs Olivia starting / turn end). */
  viaQuiet: boolean;
  /** Continues an utterance flushed moments ago (merge in the action layer). */
  continues: boolean;
};

export type InputFlusher = {
  push(text: string): void;
  /** Olivia started answering (or the turn completed): flush now. */
  flushNow(): void;
  dispose(): void;
};

export function createInputFlusher(opts: {
  quietMs?: number;
  pauseMs?: number;
  continueWindowMs?: number;
  stillSpeaking?: () => boolean;
  onPause?: () => void;
  emit: (text: string, meta: FlushMeta) => void;
}): InputFlusher {
  const quietMs = opts.quietMs ?? Number(process.env.INPUT_FLUSH_MS ?? 1200);
  const pauseMs = opts.pauseMs ?? 400;
  const continueWindowMs = opts.continueWindowMs ?? 2_500;
  let buf = '';
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let pauseTimer: ReturnType<typeof setTimeout> | null = null;
  let lastFlushAt = 0;
  const clear = () => {
    if (flushTimer) clearTimeout(flushTimer);
    if (pauseTimer) clearTimeout(pauseTimer);
    flushTimer = null;
    pauseTimer = null;
  };
  const flush = (viaQuiet: boolean) => {
    clear();
    const text = buf.trim();
    buf = '';
    if (!text) return;
    const now = Date.now();
    const continues = lastFlushAt > 0 && now - lastFlushAt < continueWindowMs;
    lastFlushAt = now;
    opts.emit(text, { viaQuiet, continues });
  };
  const armPause = () => {
    pauseTimer = setTimeout(() => {
      if (opts.stillSpeaking?.()) return armPause();
      pauseTimer = null;
      opts.onPause?.();
    }, pauseMs);
  };
  const armFlush = () => {
    flushTimer = setTimeout(() => {
      if (opts.stillSpeaking?.()) return armFlush();
      flush(true);
    }, quietMs);
  };
  return {
    push(text) {
      // A merged continuation ("…98450." + "1 2 3") needs a space; mid-word
      // pieces from the 2.5 model ("pri" + "ce") must not get one.
      buf += /[.?!,;:]$/.test(buf) && !/^\s/.test(text) ? ` ${text}` : text;
      clear();
      armPause();
      armFlush();
    },
    flushNow: () => flush(false),
    dispose() {
      clear();
      buf = '';
    },
  };
}
