import { encodeWidgetMessage } from '../transport/codec.js';
import { type LiveKitHandle, connectToRoom } from '../transport/livekit.js';
import type { VoiceMode, VoiceModeState } from './voiceModeWebSpeech.js';

export function createVoiceModeLiveKit(opts: {
  sessionId: string;
  wsUrl: string;
  token: string;
  roomName: string;
  onTranscriptEvent: (raw: Uint8Array) => void;
}): VoiceMode {
  let state: VoiceModeState = 'idle';
  let handle: LiveKitHandle | null = null;
  let warmingP: Promise<LiveKitHandle> | null = null;
  let muted = false;
  let sageHasJoined = false;
  const listeners: ((s: VoiceModeState) => void)[] = [];
  const set = (s: VoiceModeState) => {
    if (state === s) return;
    state = s;
    for (const cb of listeners) cb(s);
  };

  // Pre-connect to the room without enabling the mic. Idempotent — repeated
  // calls share the same in-flight connect promise. The voice-agent dispatch
  // begins as soon as we join the room, so by the time the visitor clicks,
  // Phase A (room + audio track) has typically already completed.
  const warm = (): Promise<LiveKitHandle> => {
    if (handle) return Promise.resolve(handle);
    if (warmingP) return warmingP;
    warmingP = (async () => {
      const h = await connectToRoom({
        wsUrl: opts.wsUrl,
        token: opts.token,
        roomName: opts.roomName,
      });
      h.onData((bytes) => opts.onTranscriptEvent(bytes));
      h.onAgentSpeaking((speaking) => {
        if (muted) return;
        if (speaking) sageHasJoined = true;
        if (!sageHasJoined) return;
        set(speaking ? 'speaking' : 'listening');
      });
      handle = h;
      return h;
    })();
    warmingP.catch(() => {
      warmingP = null;
    });
    return warmingP;
  };

  return {
    warm: () => {
      warm().catch((err) => console.warn('[voiceModeLiveKit] warm failed', err));
    },
    start: () => {
      if (state !== 'idle') return;
      // Stay 'connecting' until agent_ready arrives. Phase B (Gemini WS open)
      // is the only remaining cost on the click→listening path.
      set('connecting');
      sageHasJoined = false;
      (async () => {
        try {
          const h = await warm();
          await h.setMicEnabled(!muted);
          // Signal Phase B start. The voice-agent has been idling since
          // agent_warmed; this triggers gemini.open(). It responds with
          // agent_ready when the WS handshake completes.
          const startMsg = new TextEncoder().encode(
            encodeWidgetMessage({ type: 'start_voice', sessionId: opts.sessionId }),
          );
          await h.publishData(startMsg);
          if (muted) set('muted');
        } catch (err) {
          set('idle');
          throw err;
        }
      })().catch((err) => {
        console.warn('[voiceModeLiveKit] start failed', err);
      });
    },
    stop: () => {
      handle?.disconnect().catch(() => {});
      handle = null;
      warmingP = null;
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
      // Phase B done: Gemini WS is open and Sage is online. Flip CONNECTING →
      // listening. If the visitor muted during connect, honor that — muted UI
      // takes priority over listening.
      sageHasJoined = true;
      if (state === 'connecting') set(muted ? 'muted' : 'listening');
    },
    publishData: async (bytes) => {
      if (!handle) return;
      await handle.publishData(bytes);
    },
  };
}
