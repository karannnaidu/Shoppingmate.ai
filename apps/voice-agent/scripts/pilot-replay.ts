import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { InMemorySessionState, getAdapter } from '@shoppingmate/adapters';
import { NoOpWSTransport, loadSession, runTurn, saveSession } from '@shoppingmate/agent';
import { db, schema } from '@shoppingmate/db';
import { childLogger, env as sharedEnv } from '@shoppingmate/shared';
import { createBridge } from '../src/bridge.js';
import { createGeminiSdkTransport } from '../src/geminiSdkTransport.js';
import { createGeminiSession } from '../src/geminiSession.js';
import { createMetricsLedger, defaultSink } from '../src/metrics.js';
import { resolveVoiceContext } from '../src/persona.js';

const log = childLogger({ mod: 'pilot-replay' });

type Recording = {
  sessionId: string;
  merchantId: string;
  personaId: string;
  turns: { user_text: string }[];
};

async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) {
    console.error('usage: pilot-replay <recorded-session.json>');
    process.exit(1);
  }
  const recording = JSON.parse(readFileSync(path, 'utf8')) as Recording;

  const redis = new Redis(sharedEnv.REDIS_URL, { maxRetriesPerRequest: null });
  const session = await loadSession(redis, recording.sessionId);
  if (!session) throw new Error(`session ${recording.sessionId} not found`);
  const [merchant] = await db
    .select()
    .from(schema.merchants)
    .where(eq(schema.merchants.id, recording.merchantId))
    .limit(1);
  if (!merchant) throw new Error(`merchant ${recording.merchantId} not found`);

  const voice = resolveVoiceContext(recording.personaId);
  const transport = createGeminiSdkTransport();
  const gemini = createGeminiSession({
    transport,
    voiceId: voice.voiceId,
    systemInstruction: voice.systemInstruction,
  });
  await gemini.open();

  const metrics = createMetricsLedger({
    sessionId: recording.sessionId,
    merchantId: recording.merchantId,
    sink: defaultSink,
  });

  gemini.onEvent((e) => {
    if (e.type === 'audio_out') {
      metrics.add('gemini_audio_output_seconds', e.bytes.length / (24_000 * 2));
    }
    if (e.type === 'final_transcript') {
      const words = e.text.split(/\s+/).filter(Boolean).length;
      metrics.add('gemini_audio_input_seconds', words / 3.3);
    }
  });

  const bridge = createBridge({
    sessionId: recording.sessionId,
    merchantId: recording.merchantId,
    runTurn,
    loadMerchant: async () => merchant,
    loadSession: async () => session,
    saveSession: (s) => saveSession(redis, s),
    recordMetric: async () => {},
    loadAdapter: (m) =>
      getAdapter(m, {
        transport: new NoOpWSTransport(),
        state: new InMemorySessionState(),
      }),
    speak: (text) => gemini.speak(text),
    publishData: () => {},
    closeRoom: () => {},
    interrupt: () => gemini.interrupt(),
    caps: { recordTurn: () => {} },
  });

  for (const t of recording.turns) {
    log.info({ user_text: t.user_text }, 'replaying turn');
    await bridge.handleUserText(t.user_text);
  }

  await gemini.close();
  metrics.flush();
  await redis.quit();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
