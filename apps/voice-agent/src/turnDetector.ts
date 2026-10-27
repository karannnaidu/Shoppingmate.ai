// Our own end-of-turn detection for Gemini Live (automatic activity detection
// OFF). Measured 2026-10-27 on calmosis.com: Gemini's built-in VAD took 2.7–5s
// to reply after the visitor stopped, dropped a short "Hello?" after the
// greeting, and in a noisy room merged/split sentences (caption WER 23–48%).
// With explicit activityStart/activityEnd from here, gemini-3.1-flash-live
// replies 0.7–1.1s after the turn ends and its transcript is near-exact.
//
// Energy detector on the (noise-suppressed) mic: adaptive noise floor, ~80ms of
// speech opens a turn (sending ~300ms of pre-roll so the first syllable isn't
// clipped), `endSilenceMs` of quiet closes it. While Olivia is speaking, opening
// needs louder input so her own echo can't interrupt her. The WS widget already
// gates non-speech to true zeros, so there the floor sits at the minimum.

export type TurnEndReason = 'silence' | 'max';

export type TurnDetector = {
  /** One mic frame, 16 kHz mono PCM16. */
  push(frame: Uint8Array): void;
  /** Turn currently open. */
  active(): boolean;
  /** Forget the open turn (e.g. the Gemini session is reconnecting). */
  reset(): void;
  /** Pause tolerance for the current/next turn (dictation gets longer). */
  setEndSilenceMs(ms: number): void;
};

export function createTurnDetector(opts: {
  onStart: (preroll: Uint8Array[], info: { rms: number }) => void;
  onAudio: (frame: Uint8Array) => void;
  onEnd: (reason: TurnEndReason, info: { turnMs: number; peakRms: number }) => void;
  isBotSpeaking?: () => boolean;
  /** Speech needed to open a turn. */
  startMs?: number;
  /** Quiet that closes a turn (pause tolerance). */
  endSilenceMs?: number;
  prerollMs?: number;
  /** Absolute minimum PCM16 RMS that counts as speech. */
  minRms?: number;
  /** Speech = RMS above floor × this. */
  floorMult?: number;
  /** Extra factor to OPEN a turn while Olivia is speaking. */
  duckMult?: number;
  /** Speech needed to open a turn while Olivia is speaking (echo guard: her
   *  own voice leaking back through a phone speaker comes in short bursts). */
  startMsWhileBot?: number;
  maxTurnMs?: number;
}): TurnDetector {
  const startMs = opts.startMs ?? 80;
  const baseEndSilenceMs = opts.endSilenceMs ?? 500;
  let endSilenceMs = baseEndSilenceMs;
  const prerollMs = opts.prerollMs ?? 300;
  const minRms = opts.minRms ?? 250;
  const floorMult = opts.floorMult ?? 3;
  const duckMult = opts.duckMult ?? 3;
  const startMsWhileBot = opts.startMsWhileBot ?? 240;
  const maxTurnMs = opts.maxTurnMs ?? 30_000;
  // Floor rises toward steady noise with this time constant; falls fast.
  const riseTauMs = 4_000;

  let floor = 0;
  let open = false;
  let speechRunMs = 0;
  let silenceMs = 0;
  let turnMs = 0;
  let ring: { f: Uint8Array; ms: number }[] = [];
  let ringMs = 0;
  let peakRms = 0;

  const rmsOf = (frame: Uint8Array) => {
    const aligned = frame.byteOffset % 2 === 0 ? frame : frame.slice();
    const s = new Int16Array(aligned.buffer, aligned.byteOffset, aligned.byteLength >> 1);
    let sum = 0;
    for (let i = 0; i < s.length; i++) sum += (s[i] as number) * (s[i] as number);
    return { rms: Math.sqrt(sum / Math.max(1, s.length)), ms: (s.length / 16_000) * 1000 };
  };

  return {
    push(frame) {
      const { rms, ms } = rmsOf(frame);
      if (ms <= 0) return;
      if (rms < floor) floor = floor * 0.7 + rms * 0.3;
      else floor += (rms - floor) * Math.min(1, ms / riseTauMs);
      const thr = Math.max(minRms, floor * floorMult);
      const speech = rms > thr;

      if (!open) {
        ring.push({ f: frame, ms });
        ringMs += ms;
        while (ring.length > 1 && ringMs - (ring[0] as { ms: number }).ms >= prerollMs + startMs) {
          ringMs -= (ring.shift() as { ms: number }).ms;
        }
        const bot = opts.isBotSpeaking?.() ?? false;
        const opens = rms > thr * (bot ? duckMult : 1);
        speechRunMs = opens ? speechRunMs + ms : 0;
        if (speechRunMs >= (bot ? Math.max(startMs, startMsWhileBot) : startMs)) {
          open = true;
          silenceMs = 0;
          turnMs = speechRunMs;
          const preroll = ring.map((r) => r.f);
          ring = [];
          ringMs = 0;
          speechRunMs = 0;
          peakRms = rms;
          opts.onStart(preroll, { rms });
        }
        return;
      }

      opts.onAudio(frame);
      turnMs += ms;
      if (rms > peakRms) peakRms = rms;
      silenceMs = speech ? 0 : silenceMs + ms;
      if (silenceMs >= endSilenceMs || turnMs >= maxTurnMs) {
        open = false;
        silenceMs = 0;
        opts.onEnd(turnMs >= maxTurnMs ? 'max' : 'silence', { turnMs, peakRms });
        turnMs = 0;
      }
    },
    active: () => open,
    setEndSilenceMs(ms) {
      endSilenceMs = ms > 0 ? ms : baseEndSilenceMs;
    },
    reset() {
      open = false;
      speechRunMs = 0;
      silenceMs = 0;
      turnMs = 0;
      ring = [];
      ringMs = 0;
    },
  };
}
