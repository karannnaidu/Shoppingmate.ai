import type { JobContext } from '@livekit/agents';
import {
  AudioFrame,
  AudioSource,
  AudioStream,
  LocalAudioTrack,
  type RemoteAudioTrack,
  RoomEvent,
  TrackKind,
  TrackPublishOptions,
  TrackSource,
} from '@livekit/rtc-node';
import { childLogger } from '@shoppingmate/shared';

const log = childLogger({ mod: 'voice-room' });

/**
 * What a voice call needs from its transport. Two implementations:
 * LiveKit (createLiveKitVoiceRoom) and our own WebSocket (wsServer.ts) —
 * the call logic in runVoiceSession is the same for both.
 */
export type VoiceRoom = {
  transport: 'livekit' | 'ws';
  sessionId: string;
  /** JSON message to the widget (agent events). */
  publishData(bytes: Uint8Array): void;
  /** JSON messages from the widget (start_voice, host_action_result, …). */
  onData(cb: (bytes: Uint8Array) => void): void;
  /** Make the bot's audio output ready (LiveKit: publish the track). */
  prepareAudioOut(): Promise<void>;
  /** Bot audio out: 24 kHz mono PCM16. Resolves once queued. */
  playAudio(pcm: Int16Array): Promise<void>;
  /** Barge-in: drop bot audio not yet heard. */
  clearAudio(): void;
  /** Visitor mic in: 16 kHz mono PCM16 bytes. */
  onMicAudio(cb: (bytes: Uint8Array) => void): void;
  /** LiveKit only: visitor started talking (active speaker). */
  onVisitorSpeaking(cb: () => void): void;
  disconnect(): Promise<void>;
  onDisconnected(cb: () => void): void;
  /** Awaited before the process/connection is torn down. */
  addShutdownCallback(cb: () => Promise<void>): void;
};

export function createLiveKitVoiceRoom(job: JobContext): VoiceRoom {
  const roomName = job.room.name ?? '';
  // Gemini Live native-audio returns 24 kHz mono PCM16. Queue 30s — Gemini
  // emits replies in fast bursts and the default ~1s queue overflows.
  const audioSource = new AudioSource(24_000, 1, 30_000);
  return {
    transport: 'livekit',
    sessionId: roomName.replace(/^sm_/, ''),
    publishData(bytes) {
      const lp = job.room.localParticipant;
      if (!lp) return;
      lp.publishData(bytes, { reliable: true }).catch((err) => log.warn({ err }, 'publishData failed'));
    },
    onData(cb) {
      job.room.on(RoomEvent.DataReceived, (payload: Uint8Array) => cb(payload));
    },
    async prepareAudioOut() {
      const botTrack = LocalAudioTrack.createAudioTrack('sage', audioSource);
      await job.room.localParticipant?.publishTrack(
        botTrack,
        new TrackPublishOptions({ source: TrackSource.SOURCE_MICROPHONE }),
      );
    },
    playAudio(pcm) {
      return audioSource.captureFrame(new AudioFrame(pcm, 24_000, 1, pcm.length));
    },
    clearAudio() {
      audioSource.clearQueue();
    },
    onMicAudio(cb) {
      const subscribed = new WeakSet<object>();
      const pipe = (track: RemoteAudioTrack, identity: string) => {
        if (subscribed.has(track as unknown as object)) return;
        subscribed.add(track as unknown as object);
        log.info({ participantIdentity: identity, sid: track.sid }, 'subscribing to mic track');
        const stream = new AudioStream(track, 16_000, 1);
        (async () => {
          for await (const frame of stream) {
            cb(new Uint8Array(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength));
          }
        })().catch((err) => log.error({ err }, 'audio stream ended with error'));
      };
      job.room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind !== TrackKind.KIND_AUDIO) return;
        pipe(track as RemoteAudioTrack, participant.identity);
      });
      // TrackSubscribed fires only for NEW subscriptions — catch any mic track
      // that landed before this handler attached.
      for (const participant of job.room.remoteParticipants.values()) {
        for (const pub of participant.trackPublications.values()) {
          const track = pub.track;
          if (track && track.kind === TrackKind.KIND_AUDIO) pipe(track as RemoteAudioTrack, participant.identity);
        }
      }
    },
    onVisitorSpeaking(cb) {
      job.room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const localIdentity = job.room.localParticipant?.identity;
        if (speakers.some((p) => p.identity !== localIdentity)) cb();
      });
    },
    disconnect() {
      return job.room.disconnect();
    },
    onDisconnected(cb) {
      job.room.on(RoomEvent.Disconnected, () => cb());
    },
    addShutdownCallback(cb) {
      job.addShutdownCallback(cb);
    },
  };
}
