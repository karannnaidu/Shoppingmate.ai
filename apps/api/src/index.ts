import { serve } from '@hono/node-server';
import { InMemorySessionState, type WSTransport, getAdapter } from '@shoppingmate/adapters';
import { db, schema } from '@shoppingmate/db';
import { mountWs } from '@shoppingmate/dom-harness';
import { env, logger } from '@shoppingmate/shared';
import { and, asc, eq } from 'drizzle-orm';
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
import type { HostAction, HostActionResult } from '@shoppingmate/agent';
import { conversionRoute } from './routes/conversion.js';
import { dashboardAttributionRoute } from './routes/dashboard-attribution.js';
import { healthRoute } from './routes/health.js';
import { installRoute } from './routes/install.js';
import { sessionRoute } from './routes/session.js';
import { siteGraphRoute } from './routes/siteGraph.js';
import { shopifyWebhookRoute } from './routes/webhooks/shopify.js';
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
app.route('/v1/conversion', conversionRoute);
app.route('/v1/dashboard/attribution', dashboardAttributionRoute);
app.route('/v1/install', installRoute);
app.route('/v1/session', sessionRoute);
app.route('/v1/site-graph', siteGraphRoute);
app.route('/v1/voice/token', voiceTokenRoute);
app.route('/webhooks/shopify', shopifyWebhookRoute);

// Without an explicit error handler, Hono turns any unhandled exception in a
// route (e.g. a transient Postgres/Redis connection blip in the install/session
// merchant lookup) into a bare 500 that (a) is never logged and (b) is built
// AFTER the cors() middleware ran, so it omits the Access-Control-Allow-Origin
// header. The browser then reports "No 'Access-Control-Allow-Origin' header is
// present", the widget's bootstrap aborts, and the visitor sees "Could not
// start the call" — with nothing in our logs. Re-apply the CORS header on the
// error path and log the cause so these transient failures are observable and
// the widget can read the 5xx (and retry it) instead of seeing an opaque CORS
// error.
app.onError((err, c) => {
  const origin = c.req.header('origin');
  logger.error(
    { err, method: c.req.method, path: c.req.path, origin },
    'unhandled request error',
  );
  if (origin) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Vary', 'Origin');
  }
  return c.json({ error: 'internal_error', message: 'internal server error' }, 500);
});

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

// Per-session pending host action callbacks. The widget answers
// host_action_request with host_action_result asynchronously over the same
// WS, so dispatchHostAction parks a resolver here keyed by callId.
const HOST_ACTION_TIMEOUT_MS = 5000;
const pendingHostActions = new Map<
  string,
  Map<string, { resolve: (r: HostActionResult) => void; timer: NodeJS.Timeout }>
>();
let hostActionCounter = 0;

mountAgentWs(server, {
  onMessage: async (sessionId, merchantId, raw, send) => {
    const msg = decodeWidgetMessage(raw);
    if (!msg) {
      send(encodeAgentEvent({ type: 'session_closed', reason: 'error' }));
      return;
    }

    if (msg.type === 'host_action_result') {
      const sessionPending = pendingHostActions.get(sessionId);
      const entry = sessionPending?.get(msg.callId);
      if (entry) {
        clearTimeout(entry.timer);
        sessionPending!.delete(msg.callId);
        entry.resolve(msg.result);
      }
      return;
    }

    if (msg.type === 'tour_request') {
      // The widget user accepted the soft prompt — the runtime decides what
      // to do with this hint on the next user_text turn. For now we just
      // log it; the actual tour is driven by the model's tool calls.
      logger.info({ sessionId, merchantId }, 'tour_request received from widget');
      return;
    }

    if (msg.type === 'visitor_action') {
      const session = await loadSession(redis, sessionId);
      if (!session) {
        // No active session — drop silently. visitor_action only makes sense
        // mid-conversation when the runtime can pick it up on the next user_text.
        return;
      }
      const label = msg.intentKey ?? msg.elementLabel ?? 'unknown element';
      const ts = new Date(msg.timestamp).toISOString().slice(11, 19);
      const note = `[VISITOR_CONTEXT] At ${ts} the visitor ${verbForAction(msg.action)} "${label}" on ${msg.url}.`;
      session.history.push({ role: 'user', content: note });
      await saveSession(redis, session);
      return;
    }

    if (msg.type === 'session_end') {
      await redis.del(`session:${sessionId}`);
      const sessionPending = pendingHostActions.get(sessionId);
      if (sessionPending) {
        for (const entry of sessionPending.values()) clearTimeout(entry.timer);
        pendingHostActions.delete(sessionId);
      }
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

    const dispatchHostAction = async (action: HostAction): Promise<HostActionResult> => {
      return new Promise<HostActionResult>((resolve) => {
        const callId = `ha_${++hostActionCounter}_${Date.now()}`;
        let sessionPending = pendingHostActions.get(sessionId);
        if (!sessionPending) {
          sessionPending = new Map();
          pendingHostActions.set(sessionId, sessionPending);
        }
        const timer = setTimeout(() => {
          sessionPending!.delete(callId);
          resolve({ ok: false, reason: 'timeout' });
        }, HOST_ACTION_TIMEOUT_MS);
        sessionPending.set(callId, { resolve, timer });
        send(encodeAgentEvent({ type: 'host_action_request', callId, action }));
      });
    };

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
      dispatchHostAction,
    };

    for await (const ev of runTurn(deps, merchant, session, msg)) {
      send(encodeAgentEvent(ev));
    }
  },
});

logger.info({ port: env.API_PORT }, 'agent ws mounted at /v1/widget/:sessionId/agent');

function verbForAction(a: string): string {
  switch (a) {
    case 'click': return 'clicked';
    case 'route_change': return 'navigated to';
    case 'dwell': return 'is reading';
    case 'cart_add': return 'added to cart';
    case 'form_focus': return 'started filling';
    case 'outbound_click': return 'opened external link';
    default: return 'interacted with';
  }
}

// Cap KB injection at the first 32 chunks (≈ 8K tokens at 256 tokens/chunk
// target). Bigger contexts blow Sonnet/Gemini token budgets and slow first
// token. Naïve concat is fine for Phase A — Phase 2's retrieval upgrade can
// rank chunks by relevance if quality gets thin.
const KB_CHUNK_LIMIT = 32;

async function loadPromptOpts(merchantId: string): Promise<{
  kbText?: string;
  demoMode?: boolean;
  siteGraphText?: string;
}> {
  const chunks = await db
    .select({ text: schema.brandKbChunks.text })
    .from(schema.brandKbChunks)
    .where(eq(schema.brandKbChunks.merchantId, merchantId))
    .orderBy(asc(schema.brandKbChunks.chunkIndex))
    .limit(KB_CHUNK_LIMIT);
  const kbText = chunks.length > 0 ? chunks.map((c) => c.text).join('\n\n') : undefined;
  const projection = await db.query.projectionCache.findFirst({
    where: and(
      eq(schema.projectionCache.merchantId, merchantId),
      eq(schema.projectionCache.consumer, 'sonnet_addendum'),
    ),
  });
  return {
    kbText,
    demoMode: merchantId === env.SHOPPINGMATE_DEMO_MERCHANT_ID,
    siteGraphText: projection?.output,
  };
}
