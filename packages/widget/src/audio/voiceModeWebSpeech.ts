import type { STT } from './stt.js';
import type { TTS } from './tts.js';

export type VoiceModeState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'muted';

export type VoiceMode = {
  start: () => void;
  stop: () => void;
  speak: (text: string) => Promise<void>;
  setMuted: (m: boolean) => void;
  getState: () => VoiceModeState;
  onStateChange: (cb: (s: VoiceModeState) => void) => void;
  // Implementations that own an outbound channel (LiveKit data channel) can
  // route widget→agent messages back. Web-speech mode no-ops since it has
  // no transport. Used by host_action_result in voice mode so the result
  // lands in the voice-agent's bridge, not the api WS.
  publishData?: (bytes: Uint8Array) => Promise<void>;
};

export function createVoiceMode(stt: STT | null, tts: TTS): VoiceMode {
  let state: VoiceModeState = 'idle';
  let muted = false;
  const listeners: ((s: VoiceModeState) => void)[] = [];
  const set = (s: VoiceModeState) => {
    if (state === s) return;
    state = s;
    for (const cb of listeners) cb(s);
  };
  return {
    start: () => {
      if (state !== 'idle') return;
      if (muted) {
        set('muted');
        return;
      }
      stt?.start();
      set('listening');
    },
    stop: () => {
      stt?.stop();
      tts.cancel();
      set('idle');
    },
    speak: async (text) => {
      if (state === 'idle') return;
      stt?.stop();
      set('speaking');
      await tts.speak(text);
      if (muted) {
        set('muted');
      } else {
        stt?.start();
        set('listening');
      }
    },
    setMuted: (m) => {
      muted = m;
      if (m) {
        stt?.stop();
        if (state === 'listening') set('muted');
      } else if (state === 'muted') {
        stt?.start();
        set('listening');
      }
    },
    getState: () => state,
    onStateChange: (cb) => {
      listeners.push(cb);
    },
  };
}
