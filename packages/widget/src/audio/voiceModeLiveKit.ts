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
  let sageHasJoined = false;
  const listeners: ((s: VoiceModeState) => void)[] = [];
  const set = (s: VoiceModeState) => {
    if (state === s) return;
    state = s;
    for (const cb of listeners) cb(s);
  };
  return {
    start: () => {
      if (state !== 'idle') return;
      // Stay 'connecting' until Sage's first audio arrives. The LiveKit WS
      // handshake + setMicEnabled finish in ~500ms, but the agent dispatch +
      // voice-agent boot + Gemini Live greeting takes another 5–10s on cold
      // start. Without this the tray flips to "CONNECTED / listening" the
      // instant LK acks, and the visitor speaks into a dead room for 10s
      // before Sage actually joins. The agent-speaking signal is the only
      // honest "Sage is online" trigger we have.
      set('connecting');
      sageHasJoined = false;
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
            // First time Sage's audio is detected → cold start is over.
            // Treat speaking=true as the canonical 'online' signal even if a
            // later speaking=false would normally flip us to listening.
            if (speaking) sageHasJoined = true;
            if (!sageHasJoined) return; // suppress false 'listening' from local mic activity
            set(speaking ? 'speaking' : 'listening');
          });
          await handle.setMicEnabled(!muted);
          // Note: we deliberately do NOT set('listening') here. The state
          // stays 'connecting' until onAgentSpeaking fires with speaking=true
          // (Sage's first audio frame arrived). If the visitor mutes during
          // the cold start, surface that immediately so the mic UI is correct.
          if (muted) set('muted');
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
    signalAgentReady: () => {
      // The voice-agent has finished its cold start (Gemini WS open + audio
      // track published). Flip CONNECTING → listening immediately so the
      // tray stops lying. If the visitor muted during the connect window,
      // honor that — the muted display takes priority over listening.
      sageHasJoined = true;
      if (state === 'connecting') set(muted ? 'muted' : 'listening');
    },
    publishData: async (bytes) => {
      if (!handle) return;
      await handle.publishData(bytes);
    },
  };
}
