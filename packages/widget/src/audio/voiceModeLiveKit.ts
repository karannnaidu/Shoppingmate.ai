import { type LiveKitHandle, connectToRoom } from '../transport/livekit.js';
import type { VoiceMode, VoiceModeState } from './voiceModeWebSpeech.js';

export function createVoiceModeLiveKit(opts: {
  wsUrl: string;
  token: string;
  roomName: string;
  onTranscriptEvent: (raw: Uint8Array) => void;
}): VoiceMode {
  let state: VoiceModeState = 'idle';
  let handle: LiveKitHandle | null = null;
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
      (async () => {
        try {
          handle = await connectToRoom({
            wsUrl: opts.wsUrl,
            token: opts.token,
            roomName: opts.roomName,
          });
          handle.onData((bytes) => opts.onTranscriptEvent(bytes));
          handle.onAgentSpeaking((speaking) => {
            if (muted) return;
            set(speaking ? 'speaking' : 'listening');
          });
          await handle.setMicEnabled(!muted);
          set(muted ? 'muted' : 'listening');
        } catch (err) {
          set('idle');
          throw err;
        }
      })().catch((err) => {
        // Fire-and-forget start() can't rethrow. Caller observes via onStateChange/getState.
        console.warn('[voiceModeLiveKit] connect failed', err);
      });
    },
    stop: () => {
      handle?.disconnect().catch(() => {});
      handle = null;
      set('idle');
    },
    speak: async () => {
      // No-op: TTS owned by the server-side voice-agent (Gemini Live).
    },
    setMuted: (m) => {
      muted = m;
      handle?.setMicEnabled(!m).catch(() => {});
      if (m) set('muted');
      else if (state === 'muted') set('listening');
    },
    getState: () => state,
    onStateChange: (cb) => {
      listeners.push(cb);
    },
  };
}
