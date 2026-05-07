import { fileURLToPath } from 'node:url';
import { type JobContext, ServerOptions, cli, defineAgent } from '@livekit/agents';
import {
  AudioFrame,
  AudioSource,
  AudioStream,
  LocalAudioTrack,
  RoomEvent,
  type RemoteAudioTrack,
  TrackKind,
  TrackPublishOptions,
  TrackSource,
} from '@livekit/rtc-node';
import { eq } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { loadSession } from '@shoppingmate/agent';
import { db, schema } from '@shoppingmate/db';
import { childLogger, env as sharedEnv } from '@shoppingmate/shared';
import { createSessionCaps } from './caps.js';
import { createDataChannel } from './dataChannel.js';
import { createMetricsLedger, defaultSink } from './metrics.js';
import { voiceEnv } from './env.js';
import { createGeminiSdkTransport } from './geminiSdkTransport.js';
import { createGeminiSession } from './geminiSession.js';
import { resolveVoiceContext } from './persona.js';

const log = childLogger({ mod: 'agent-worker' });

let _redis: Redis | null = null;
function redis(): Redis {
  if (!_redis) {
    _redis = new Redis(sharedEnv.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return _redis;
}

const agentDefinition = defineAgent({
  entry: async (job: JobContext) => {
    await job.connect();
    const roomName = job.room.name ?? '';
    const sessionId = roomName.replace(/^sm_/, '');
    log.info({ sessionId, roomName }, 'voice-agent job started');

    const session = await loadSession(redis(), sessionId);
    if (!session) {
      log.warn({ sessionId }, 'no session found — closing room');
      await job.room.disconnect();
      return;
    }
    const merchants = await db
      .select()
      .from(schema.merchants)
      .where(eq(schema.merchants.id, session.merchantId))
      .limit(1);
    const merchant = merchants[0];
    if (!merchant) {
      log.warn({ merchantId: session.merchantId }, 'no merchant — closing room');
      await job.room.disconnect();
      return;
    }

    const voice = resolveVoiceContext(merchant.personaId);
    const transport = createGeminiSdkTransport();
    const gemini = createGeminiSession({
      transport,
      voiceId: voice.voiceId,
      systemInstruction: voice.systemInstruction,
    });
    await gemini.open();

    const dataChannel = createDataChannel({
      publish: (bytes, opts) => {
        const lp = job.room.localParticipant;
        if (!lp) return;
        lp.publishData(bytes, { reliable: opts.reliable }).catch((err) =>
          log.warn({ err }, 'publishData failed'),
        );
      },
    });

    const metrics = createMetricsLedger({
      sessionId,
      merchantId: merchant.id,
      sink: defaultSink,
    });

    const caps = createSessionCaps({
      onWarn: ({ remaining }) => dataChannel.publish({ type: 'cap_warning', remaining }),
      onTrip: ({ cap }) => {
        dataChannel.publish({ type: 'session_closed', reason: `cap_${cap}` });
        job.room.disconnect().catch(() => {});
      },
    });
    caps.start();
    const tickInterval = setInterval(() => caps.tick(), 5_000);

    // Publish a local audio track so visitors hear Sage. Gemini Live native-audio
    // returns 24 kHz mono PCM16; we feed those bytes straight into AudioSource.
    const audioSource = new AudioSource(24_000, 1);
    const botTrack = LocalAudioTrack.createAudioTrack('sage', audioSource);
    await job.room.localParticipant?.publishTrack(
      botTrack,
      new TrackPublishOptions({ source: TrackSource.SOURCE_MICROPHONE }),
    );

    gemini.onEvent((e) => {
      if (e.type === 'final_transcript' && e.text.trim().length > 0) {
        const words = e.text.split(/\s+/).filter(Boolean).length;
        const inputSeconds = words / 3.3;
        caps.recordVoiceSeconds(inputSeconds);
        metrics.add('gemini_audio_input_seconds', inputSeconds);
        // Phase 1 design: native-audio model handles the conversation itself,
        // so the visitor's transcript goes straight to the widget for display.
        // The chat-bridge (with shoppingmate tools) is reserved for text mode.
        dataChannel.publish({ type: 'user_text', text: e.text });
      } else if (e.type === 'bot_text' && e.text.trim().length > 0) {
        dataChannel.publish({ type: 'say', text: e.text });
      } else if (e.type === 'audio_out') {
        const samples = e.bytes.length / 2;
        const seconds = samples / 24_000;
        caps.recordVoiceSeconds(seconds);
        metrics.add('gemini_audio_output_seconds', seconds);
        const view = new Int16Array(
          e.bytes.buffer,
          e.bytes.byteOffset,
          e.bytes.byteLength / 2,
        );
        // Copy: AudioFrame keeps the buffer; the underlying Buffer may be reused.
        const pcm = new Int16Array(view);
        const frame = new AudioFrame(pcm, 24_000, 1, samples);
        audioSource.captureFrame(frame).catch((err) =>
          log.warn({ err }, 'captureFrame failed'),
        );
      } else if (e.type === 'error') {
        log.error({ err: e.error }, 'gemini transport error');
      }
    });

    job.room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind !== TrackKind.KIND_AUDIO) return;
      const stream = new AudioStream(track as RemoteAudioTrack, 16_000, 1);
      (async () => {
        for await (const frame of stream) {
          const bytes = new Uint8Array(
            frame.data.buffer,
            frame.data.byteOffset,
            frame.data.byteLength,
          );
          gemini.pushAudio(bytes);
        }
      })().catch((err) => log.error({ err }, 'audio stream ended with error'));
    });

    job.room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const localIdentity = job.room.localParticipant?.identity;
      const remoteSpeaking = speakers.some((p) => p.identity !== localIdentity);
      if (remoteSpeaking) gemini.interrupt();
    });

    job.room.on(RoomEvent.Disconnected, () => {
      clearInterval(tickInterval);
      metrics.flush();
      gemini.close().catch(() => {});
      log.info({ sessionId }, 'voice-agent job ended');
    });
  },
});

export default agentDefinition;

export function startWorker(): void {
  cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url) }));
}
