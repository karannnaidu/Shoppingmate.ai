import { fileURLToPath } from 'node:url';
import { type JobContext, ServerOptions, cli, defineAgent } from '@livekit/agents';
import { AudioStream, RoomEvent, type RemoteAudioTrack, TrackKind } from '@livekit/rtc-node';
import { eq } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { InMemorySessionState, getAdapter } from '@shoppingmate/adapters';
import { NoOpWSTransport, loadSession, runTurn, saveSession } from '@shoppingmate/agent';
import { db, schema } from '@shoppingmate/db';
import { childLogger, env as sharedEnv } from '@shoppingmate/shared';
import { createBridge } from './bridge.js';
import { createSessionCaps } from './caps.js';
import { createDataChannel } from './dataChannel.js';
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

    const caps = createSessionCaps({
      onWarn: ({ remaining }) => dataChannel.publish({ type: 'cap_warning', remaining }),
      onTrip: ({ cap }) => {
        dataChannel.publish({ type: 'session_closed', reason: `cap_${cap}` });
        job.room.disconnect().catch(() => {});
      },
    });
    caps.start();
    const tickInterval = setInterval(() => caps.tick(), 5_000);

    const bridge = createBridge({
      sessionId,
      merchantId: merchant.id,
      runTurn,
      loadMerchant: async () => merchant,
      loadSession: async () => session,
      saveSession: (s) => saveSession(redis(), s),
      recordMetric: async () => {
        // Phase G fills this with real ledger writes.
      },
      loadAdapter: (m) =>
        getAdapter(m, {
          transport: new NoOpWSTransport(),
          state: new InMemorySessionState(),
        }),
      speak: (text) => gemini.speak(text),
      publishData: (msg) => dataChannel.publish(msg),
      closeRoom: () => {
        job.room.disconnect().catch(() => {});
      },
      interrupt: () => gemini.interrupt(),
      caps,
    });

    gemini.onEvent((e) => {
      if (e.type === 'final_transcript' && e.text.trim().length > 0) {
        const words = e.text.split(/\s+/).filter(Boolean).length;
        caps.recordVoiceSeconds(words / 3.3);
        bridge.handleUserText(e.text).catch((err) => {
          log.error({ err }, 'bridge.handleUserText threw');
        });
      } else if (e.type === 'audio_out') {
        const seconds = e.bytes.length / (24_000 * 2);
        caps.recordVoiceSeconds(seconds);
        log.debug({ bytes: e.bytes.length }, 'gemini audio_out');
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
      if (remoteSpeaking) bridge.handleBargeIn();
    });

    job.room.on(RoomEvent.Disconnected, () => {
      clearInterval(tickInterval);
      gemini.close().catch(() => {});
      log.info({ sessionId }, 'voice-agent job ended');
    });
  },
});

export default agentDefinition;

export function startWorker(): void {
  cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url) }));
}
