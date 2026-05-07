import { serve } from '@hono/node-server';
import { InMemorySessionState, type WSTransport, getAdapter } from '@shoppingmate/adapters';
import { db, schema } from '@shoppingmate/db';
import { mountWs } from '@shoppingmate/dom-harness';
import { env, logger } from '@shoppingmate/shared';
import { asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Redis } from 'ioredis';
import {
  NoOpWSTransport,
  type SessionState,
  createSession,
  decodeWidgetMessage,
  encodeAgentEvent,
  loadSession,
  replaySession,
  runTurn,
  saveSession,
} from '@shoppingmate/agent';
import { healthRoute } from './routes/health.js';
import { installRoute } from './routes/install.js';
import { sessionRoute } from './routes/session.js';
import { slackRoute } from './routes/slack/index.js';
import { voiceTokenRoute } from './routes/voice-token.js';
import { mountAgentWs } from './ws/agent.js';

const app = new Hono();

// CORS: widget runs on merchant origins (shoppingmate.ai, *.vercel.app, brand
// shop domains). The per-route origin check still validates against the
// merchant's allowedDomains; CORS just unblocks the browser preflight.
app.use(
  '/v1/*',
  cors({
    origin: (origin) => origin ?? '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['content-type'],
    maxAge: 600,
    credentials: false,
  }),
);

app.route('/health', healthRoute);
app.route('/v1/install', installRoute);
app.route('/v1/session', sessionRoute);
app.route('/v1/slack', slackRoute);
app.route('/v1/voice/token', voiceTokenRoute);

const server = serve({ fetch: app.fetch, port: env.API_PORT }, ({ port }) => {
  logger.info({ port }, 'api listening');
});

// Plan 3d: server-side widget WebSocket. The DOMAdapter is constructed
// per-session with this transport in Plan 4 (session lifecycle); for 3d
// it's exercised by adapter-smoke + the worker DOM smoke harness.
mountWs(server);

// Plan 4 / Task 21: agent runtime WS at /v1/widget/:sessionId/agent.
// Decodes WidgetMessages, drives runTurn(), and streams AgentEvents back.
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const noopTransport: WSTransport = new NoOpWSTransport();

mountAgentWs(server, {
  onMessage: async (sessionId, merchantId, raw, send) => {
    const msg = decodeWidgetMessage(raw);
    if (!msg) {
      send(encodeAgentEvent({ type: 'session_closed', reason: 'error' }));
      return;
    }

    if (msg.type === 'session_end') {
      await redis.del(`session:${sessionId}`);
      send(encodeAgentEvent({ type: 'session_closed', reason: 'user' }));
      return;
    }

    let session = await loadSession(redis, sessionId);

    // Fresh session: only valid for user_text (visitor's first prompt).
    // session_resume / card_tap on a null session is an error — there's
    // nothing to resume or act on.
    if (!session) {
      if (msg.type !== 'user_text') {
        send(encodeAgentEvent({ type: 'session_closed', reason: 'error' }));
        return;
      }
      session = createSession({
        sessionId,
        merchantId,
        mode: msg.mode,
        nowMs: Date.now(),
      });
    }

    if (msg.type === 'session_resume') {
      for (const ev of replaySession(session)) send(encodeAgentEvent(ev));
      send(encodeAgentEvent({ type: 'end_of_turn' }));
      return;
    }

    const [merchant] = await db
      .select()
      .from(schema.merchants)
      .where(eq(schema.merchants.id, session.merchantId))
      .limit(1);
    if (!merchant) {
      send(encodeAgentEvent({ type: 'session_closed', reason: 'error' }));
      return;
    }

    const deps = {
      loadAdapter: () =>
        getAdapter(merchant, {
          transport: noopTransport,
          state: new InMemorySessionState(),
        }),
      saveSession: (s: SessionState) => saveSession(redis, s),
      recordMetric: async (name: string, tags: Record<string, string | number | boolean>) => {
        await db
          .insert(schema.metricEvents)
          .values({ merchantId: merchant.id, metricName: name, tags })
          .onConflictDoNothing();
      },
      loadPromptOpts: async (m: typeof merchant) => loadPromptOpts(m.id),
    };

    for await (const ev of runTurn(deps, merchant, session, msg)) {
      send(encodeAgentEvent(ev));
    }
  },
});

logger.info({ port: env.API_PORT }, 'agent ws mounted at /v1/widget/:sessionId/agent');

// Cap KB injection at the first 32 chunks (≈ 8K tokens at 256 tokens/chunk
// target). Bigger contexts blow Sonnet/Gemini token budgets and slow first
// token. Naïve concat is fine for Phase A — Phase 2's retrieval upgrade can
// rank chunks by relevance if quality gets thin.
const KB_CHUNK_LIMIT = 32;

async function loadPromptOpts(merchantId: string): Promise<{
  kbText?: string;
  demoMode?: boolean;
}> {
  const chunks = await db
    .select({ text: schema.brandKbChunks.text })
    .from(schema.brandKbChunks)
    .where(eq(schema.brandKbChunks.merchantId, merchantId))
    .orderBy(asc(schema.brandKbChunks.chunkIndex))
    .limit(KB_CHUNK_LIMIT);
  const kbText = chunks.length > 0 ? chunks.map((c) => c.text).join('\n\n') : undefined;
  return { kbText, demoMode: merchantId === env.SHOPPINGMATE_DEMO_MERCHANT_ID };
}
