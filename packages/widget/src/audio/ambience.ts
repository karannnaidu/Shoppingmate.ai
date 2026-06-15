// Very subtle synthesized "office room tone" played during a live call so it
// feels like a real call rather than a dead-silent line. Asset-free: a looped
// buffer of low-passed brown-ish noise (gentle HVAC/room hum), kept very quiet.
//
// SWITCH: pass `enabled=false` (or set data-ambience="off" on the widget element,
// see widget.ts) to disable entirely. Easy to remove later if unwanted.

export type Ambience = { start: () => void; stop: () => void };

const NOOP: Ambience = { start: () => {}, stop: () => {} };

export function createAmbience(enabled: boolean): Ambience {
  if (!enabled || typeof window === 'undefined') return NOOP;
  const AC: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return NOOP;

  let ctx: AudioContext | null = null;
  let src: AudioBufferSourceNode | null = null;

  return {
    start() {
      if (ctx) return; // already running — idempotent
      try {
        ctx = new AC();
        // 2s of brown-ish noise (integrated white noise = low rumble), looped.
        const len = Math.floor(ctx.sampleRate * 2);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) {
          const white = Math.random() * 2 - 1;
          last = (last + 0.02 * white) / 1.02;
          data[i] = last * 3.5;
        }
        src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 900; // muffled, distant room tone
        const gain = ctx.createGain();
        gain.gain.value = 0.02; // very, very light
        src.connect(lp).connect(gain).connect(ctx.destination);
        src.start();
        // The Call tap is a user gesture, so resume() is permitted on mobile.
        void ctx.resume?.().catch(() => {});
      } catch {
        this.stop();
      }
    },
    stop() {
      try {
        src?.stop();
      } catch {
        /* already stopped */
      }
      src = null;
      try {
        void ctx?.close();
      } catch {
        /* ignore */
      }
      ctx = null;
    },
  };
}
