import type { VoiceMode, VoiceModeState } from './voiceModeWebSpeech.js';

// Our WebSocket voice first; if a call can't get going on it (connection
// fails, or no audio within the connect window) that same call switches to
// LiveKit by itself, so a visitor never gets a dead call. Once a call has had
// audio on the primary, it stays there.

export function createVoiceModeWithFallback(
  primary: VoiceMode,
  makeFallback: () => VoiceMode | null,
  opts: { noAudioMs?: number; onSwitch?: (reason: string) => void } = {},
): VoiceMode {
  let active = primary;
  let fallback: VoiceMode | null = null;
  let switched = false;
  let hadAudio = false;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  const stateCbs: ((s: VoiceModeState) => void)[] = [];
  const errorCbs: ((i: { code: string; message: string }) => void)[] = [];
  const noAudioMs = opts.noAudioMs ?? 7_000;

  const clearWatch = () => {
    if (watchdog) clearTimeout(watchdog);
    watchdog = null;
  };
  const switchToFallback = (reason: string) => {
    if (switched) return;
    const fb = makeFallback();
    if (!fb) return;
    switched = true;
    clearWatch();
    fallback = fb;
    opts.onSwitch?.(reason);
    try {
      primary.stop();
    } catch {
      /* ignore */
    }
    fb.onStateChange((s) => stateCbs.forEach((cb) => cb(s)));
    fb.onError?.((i) => errorCbs.forEach((cb) => cb(i)));
    active = fb;
    fb.start();
  };

  primary.onStateChange((s) => {
    if (active !== primary) return;
    if (s === 'speaking') {
      hadAudio = true;
      clearWatch();
    }
    stateCbs.forEach((cb) => cb(s));
  });
  primary.onError?.((info) => {
    if (active !== primary) return;
    // Only a connection problem before any audio is worth switching for;
    // mic permission errors would fail on LiveKit too.
    if (!hadAudio && info.code === 'connect_failed' && !switched) {
      switchToFallback(info.code);
      return;
    }
    errorCbs.forEach((cb) => cb(info));
  });

  return {
    warm: () => active.warm?.(),
    start: () => {
      hadAudio = false;
      active.start();
      if (active === primary && !switched) {
        clearWatch();
        watchdog = setTimeout(() => {
          if (!hadAudio && active === primary && primary.getState() === 'connecting') switchToFallback('no_audio');
        }, noAudioMs);
      }
    },
    stop: () => {
      clearWatch();
      active.stop();
    },
    speak: (t) => active.speak(t),
    setMuted: (m) => active.setMuted(m),
    getState: () => active.getState(),
    onStateChange: (cb) => {
      stateCbs.push(cb);
    },
    onError: (cb) => {
      errorCbs.push(cb);
    },
    signalAgentReady: () => active.signalAgentReady?.(),
    publishData: async (b) => {
      await active.publishData?.(b);
    },
  };
}
