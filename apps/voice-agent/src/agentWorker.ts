import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { type JobContext, ServerOptions, cli, defineAgent } from '@livekit/agents';
import { InMemorySessionState, getAdapter } from '@shoppingmate/adapters';
import {
  type HostActionResult,
  NoOpWSTransport,
  type RecommendationStore,
  type SessionStore,
  buildVisitorSummary,
  createConversationRecorder,
  decodeWidgetMessage,
  extractConversationProfile,
  loadSession,
  runTurn,
  saveSession as saveSessionAgent,
  stripToolSyntax,
} from '@shoppingmate/agent';
import {
  type ChatFn,
  classifyLiveSignal,
  extractCheckoutDetails,
  extractContactDetails,
  nextNudge,
  signalSteerLine,
} from '@shoppingmate/agent';
import {
  db,
  loadBrandPlaybook,
  loadVisitorProfile,
  schema,
  submitConsultationRequest,
  submitSupportCase,
  upsertVisitorProfile,
} from '@shoppingmate/db';
import { chat, childLogger, env as sharedEnv } from '@shoppingmate/shared';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { createBridge } from './bridge.js';
import { createSessionCaps } from './caps.js';
import { createDataChannel } from './dataChannel.js';
import { type VoiceRoom, createLiveKitVoiceRoom } from './voiceRoom.js';
import { voiceEnv } from './env.js';
import { createGeminiSdkTransport } from './geminiSdkTransport.js';
import { createGeminiSession } from './geminiSession.js';
import { createMetricsLedger, defaultSink } from './metrics.js';
import { alertExecutorExhausted } from './opsAlert.js';
import { resolveVoiceContext } from './persona.js';

const log = childLogger({ mod: 'agent-worker' });
// Mic loudness (PCM16 RMS, ~-27 dBFS) that counts as the visitor speaking over
// the cached greeting. Mic audio is already noise-suppressed (Krisp / RNNoise).
const GREETING_BARGE_RMS = Number(process.env.GREETING_BARGE_RMS ?? 1500);

// Detects a clear "take me to checkout" intent in a voice transcript. Used to
// navigate deterministically (independent of the side-channel LLM + abort flag)
// so the page actually moves when the bot says it's heading to checkout. Kept
// strict to avoid false navigations on passing mentions ("what's the checkout
// process?" → false). Exported for unit testing.
export function wantsCheckoutNavigation(text: string): boolean {
  const t = (text ?? '').trim().toLowerCase();
  if (!t) return false;
  // Passing/question mentions should NOT navigate.
  if (/\b(what|how|when|where|why|is|does|do|can i|the)\b.*\bcheck\s?out\b.*\?/.test(t))
    return false;
  return (
    /^check\s?out[.!?]*$/.test(t) ||
    /\bcheck\s?out\b\s*(now|please)\b/.test(t) ||
    /\b(take me to|go to|proceed to|proceed|head to|bring me to|let'?s|ready to|want to|wanna|can we|move to|navigate to)\b[\s\w']*\bcheck\s?out\b/.test(
      t,
    )
  );
}

// Detects the visitor confirming they want the order PLACED (after details were
// collected). Used to run deterministic checkout completion. Broad on purpose —
// false positives are safe because completion re-validates the details and only
// places when all are present; it asks for what's missing otherwise. Covers
// English + common Hindi/Hinglish affirmatives.
export function wantsOrderConfirmation(text: string): boolean {
  const t = (text ?? '').trim().toLowerCase();
  if (!t) return false;
  if (t.includes('?')) return false; // a question isn't a confirmation
  return (
    /\b(place|confirm|complete|finalize|finalise|submit)\b.*\border\b/.test(t) ||
    /\b(place|confirm|complete)\s+it\b/.test(t) ||
    /\b(go ahead|proceed|do it|that'?s correct|looks good|all correct|that is correct|sounds good)\b/.test(
      t,
    ) ||
    /\b(yes|yeah|yep|sure|haan|haa|ha|bilkul|theek hai|thik hai|kar do|kardo|kar dijiye|place kar)\b[\s,.!]*(please|pls|go|placeit|kar do|do it)?\s*$/.test(
      t,
    ) ||
    /^(yes|yeah|yep|yup|sure|ok|okay|haan|haa|bilkul|theek hai|thik hai)[\s,.!]*$/.test(t)
  );
}

// Detects that the visitor is in the checkout / detail-giving phase — a phone or
// pincode (6+ digit run), an email, or delivery/order words. Opens the gate for
// deterministic order completion so a later "yes" actually places the order
// (the visitor often goes straight to giving details, never saying "checkout").
export function hasCheckoutSignal(text: string): boolean {
  const t = (text ?? '').trim().toLowerCase();
  if (!t) return false;
  return (
    /\d{6,}/.test(t.replace(/[\s-]/g, '')) ||
    /@|\bgmail\b|\bat\s+gmail\b|\bdot\s+com\b/.test(t) ||
    /\b(delivery|deliver to|address|pin\s?code|pincode|shipping|ship to|place (the |my )?order|my order|complete (the |my )?order)\b/.test(
      t,
    )
  );
}

// Gemini sometimes voices the "SYSTEM:" label of a grounding message, so the
// caption reads "system Great, I'm applying…" (live 2026-10-06). Drop a bare
// "system" at the start of a sentence before captions/recording.
export function stripSystemEcho(text: string): string {
  return (text ?? '').replace(/(^|[.!?]\s+)(?:system|SYSTEM):?\s+(?=[A-Z])/g, '$1');
}

// The visitor explicitly asks the bot to fill in their details ("help fill up my
// details", "fill it in for me") — run the real, validated fill (it asks for
// whatever is missing instead of pretending).
export function wantsDetailsFilled(text: string): boolean {
  const t = (text ?? '').trim().toLowerCase();
  if (!t) return false;
  return (
    /\bfill\b.{0,20}\b(details|detail|form|it|them|everything|up)\b/.test(t) ||
    /\bfill (it )?(in|out)\b/.test(t)
  );
}

// Gemini claiming the visitor has SAVED details / details from a previous visit.
// Only true details come from the returning-visitor brief; anything else is
// invented and gets corrected.
export function claimsSavedDetails(text: string): boolean {
  const t = (text ?? '').toLowerCase();
  if (!t) return false;
  return (
    /\b(saved|on file|from (your|the) (last|previous) (visit|order|time)|previous visit|last time)\b.{0,40}\b(number|address|details|phone|email)\b/.test(
      t,
    ) ||
    /\b(number|address|details|phone|email)\b.{0,30}\b(on file|(we|i) (have|already have) (it )?saved|you saved|from (your|the) (last|previous) (visit|order))\b/.test(
      t,
    )
  );
}

// Maps a "show me / open / take me to <product> page" utterance to its product
// path so we can navigate DETERMINISTICALLY (the executor's site.navigate is
// flaky — Gemini narrates "taking you there" but the page may not move). Returns
// null when there's no clear product+navigation intent (e.g. "buy peace mantra"
// is an add-to-cart intent, not navigation).
const PRODUCT_NAV: Array<[RegExp, string]> = [
  [/\bpeace\s*mantra\b/, 'peace-mantra'],
  [/\bsleep\s*mantra\b/, 'sleep-mantra'],
  [/\bgreen\s*mantra\b/, 'green-mantra'],
  [/\bdog\s*mantra\b/, 'dog-mantra'],
];
export function productNavPath(text: string): string | null {
  const t = (text ?? '').trim().toLowerCase();
  if (!t) return null;
  const navIntent =
    /\b(show|see|view|open|go to|take me to|bring me to|pull up|navigate to|look at|check out the)\b/.test(
      t,
    ) || /\bpage\b/.test(t);
  if (!navIntent) return null;
  for (const [re, sku] of PRODUCT_NAV) if (re.test(t)) return `/shop/${sku}`;
  return null;
}

// Detects the visitor wanting to send a "Contact us" / inquiry message (the
// contact form), as opposed to a doctor consultation. Opens contact-fill mode.
export function wantsContactForm(text: string): boolean {
  const t = (text ?? '').trim().toLowerCase();
  if (!t) return false;
  return (
    /\b(send|submit|fill)[\s\w']*\b(message|inquiry|enquiry|query|contact form)\b/.test(t) ||
    /\b(contact form|contact us|contact page|get in touch|send us a message|reach out to)\b/.test(
      t,
    ) ||
    /\b(inquiry|enquiry)\b/.test(t)
  );
}

// Detects the bot (Gemini) narrating that it's PLACING the order ("putting your
// order through, one moment"). This is the reliable trigger for deterministic
// completion: the user's confirmation can be in any language / garbled by STT,
// but Gemini's placement line is instructed and consistent. We complete on THIS
// rather than trying to regex-match a multilingual "yes".
export function geminiSignalsPlacement(text: string): boolean {
  const t = (text ?? '').toLowerCase();
  if (!t) return false;
  // The bot can phrase "I'm filling that in" many ways — match them broadly
  // (gated by mode, so over-matching just runs the validated fill).
  return (
    /\bputting\b[\s\w']*\b(order|through)\b/.test(t) ||
    /\bplacing\b[\s\w']*\border\b/.test(t) ||
    /\border\b[\s\w']*\bthrough\b/.test(t) ||
    /\bputting it through\b/.test(t) ||
    /\bplace (your |the )?order now\b/.test(t) ||
    /\bfill(ing)?\b.{0,25}\b(form|details)\b/.test(t) || // "fill out the form", "filling in your details"
    /\bfill(ing)?\b.{0,15}\bin\b/.test(t) || // "fill that in", "filling it in"
    /\bfill (out|in)\b/.test(t) ||
    /\bfilling that in\b/.test(t) ||
    // Past-tense claims ("your details filled on the checkout page", "re-submitting
    // your details") — run the real fill so the claim is either made true or
    // corrected by the SYSTEM outcome.
    /\b(details|form)\b.{0,25}\bfilled\b/.test(t) ||
    /\bre-?submitting\b/.test(t)
  );
}

let _redis: Redis | null = null;
function redis(): Redis {
  if (!_redis) {
    _redis = new Redis(sharedEnv.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return _redis;
}

// Default Postgres binding for the SessionStore boundary declared in
// @shoppingmate/agent. Used by the voice worker to write conversation_sessions
// rows on job start (openSession) and Disconnected (closeSession). Attribution
// (apps/api/src/services/attributeOrder.ts) joins these rows by visitor_id +
// merchant_id when a Shopify order webhook lands.
const sessionStore: SessionStore = {
  openSession: async ({ sessionId, merchantId, visitorId }) => {
    await db
      .insert(schema.conversationSessions)
      .values({ id: sessionId, merchantId, visitorId })
      .onConflictDoNothing();
  },
  closeSession: async ({ sessionId }) => {
    // Guard against LiveKit redelivering Disconnected: a second update would
    // shift ended_at later, breaking the attribution index ordering
    // (merchant_id, visitor_id, ended_at DESC NULLS LAST).
    await db
      .update(schema.conversationSessions)
      .set({ endedAt: new Date() })
      .where(
        and(
          eq(schema.conversationSessions.id, sessionId),
          isNull(schema.conversationSessions.endedAt),
        ),
      );
  },
};

// Default Postgres binding for the RecommendationStore boundary declared in
// @shoppingmate/agent. Used by the tool-loop side-channel in voice mode to log
// recommendation_events rows when the model names a SKU (today: pricing.quote
// plan ids). attributeOrder joins these rows by session_id when a Shopify
// webhook lands. FK is to conversation_sessions(id) ON DELETE CASCADE, so a
// row inserted before openSession commits will fail — see Task 12 concern.
const recommendationStore: RecommendationStore = {
  recordRecommendation: async ({ sessionId, sku, kind }) => {
    await db.insert(schema.recommendationEvents).values({ sessionId, sku, kind });
  },
};

// Mirrors TOUR_VERTICAL_KEYWORDS in packages/agent/src/runtime.ts. Duplicated
// here because voice-agent doesn't go through the chat tool-loop, so when the
// visitor speaks a vertical we need to detect + surface cards locally.
const VERTICAL_KEYWORDS: Record<string, string[]> = {
  'dog food': ['dog food', 'dog', 'kibble', 'puppy', 'pet food'],
  apparel: ['apparel', 'clothing', 'shirt', 'jeans', 'sweater', 'hoodie', 'trouser'],
  jewelry: ['jewelry', 'jewellery', 'ring', 'earring', 'necklace', 'bracelet', 'pendant'],
  electronics: ['electronics', 'headphone', 'webcam', 'keyboard', 'ssd', 'lamp', 'gadget'],
  supplements: ['supplement', 'vitamin', 'protein', 'omega', 'magnesium', 'greens'],
};

function matchVertical(text: string): string | null {
  const q = text.toLowerCase();
  if (!q) return null;
  for (const [vertical, keywords] of Object.entries(VERTICAL_KEYWORDS)) {
    if (keywords.some((k) => q.includes(k))) return vertical;
  }
  return null;
}

function formatPrice(cents: number | null, currency: string | null): string {
  if (cents == null) return '';
  const cur = currency ?? 'USD';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(cents / 100);
}

async function publishShowcaseCards(
  merchantId: string,
  vertical: string,
  dataChannel: { publish: (msg: { type: 'cards'; items: unknown[] }) => void },
): Promise<void> {
  const rows = await db
    .select({
      sku: schema.products.sku,
      title: schema.products.title,
      imageUrl: schema.products.imageUrl,
      productUrl: schema.products.productUrl,
      priceCents: schema.products.priceCents,
      currency: schema.products.currency,
      sourceMeta: schema.products.sourceMeta,
    })
    .from(schema.products)
    .where(eq(schema.products.merchantId, merchantId))
    .limit(40);
  // sourceMeta.vertical filter is applied in JS — schema stores it as jsonb
  // and the showcase set is small (~25 rows), so no need for a JSON path query.
  const matched = rows
    .filter((r) => {
      const meta = r.sourceMeta as { vertical?: string } | null;
      return meta?.vertical === vertical;
    })
    .slice(0, 3)
    .map((r) => ({
      image: r.imageUrl,
      title: r.title,
      priceFormatted: formatPrice(r.priceCents, r.currency),
      variantId: null,
      sku: r.sku,
      productUrl: r.productUrl,
    }));
  if (matched.length > 0) {
    dataChannel.publish({ type: 'cards', items: matched });
  }
}

/**
 * One voice call, independent of transport (LiveKit room or our own
 * WebSocket — see voiceRoom.ts / wsServer.ts).
 */
export async function runVoiceSession(
  room: VoiceRoom,
  t: { tEntry: number; tConnected: number },
): Promise<void> {
    const { tEntry, tConnected } = t;
    const sessionId = room.sessionId;
    log.info({ sessionId, transport: room.transport, ms_connect: tConnected - tEntry }, 'voice-agent job started');

    const session = await loadSession(redis(), sessionId);
    if (!session) {
      log.warn({ sessionId }, 'no session found — closing room');
      await room.disconnect();
      return;
    }
    // Merchant + KB + site-graph projection are independent — fire in parallel to save ~150ms.
    const [merchants, kbChunks, projection] = await Promise.all([
      db
        .select()
        .from(schema.merchants)
        .where(eq(schema.merchants.id, session.merchantId))
        .limit(1),
      db
        .select({ text: schema.brandKbChunks.text })
        .from(schema.brandKbChunks)
        .where(eq(schema.brandKbChunks.merchantId, session.merchantId))
        .orderBy(asc(schema.brandKbChunks.chunkIndex))
        .limit(24), // ~6K tokens; native-audio model is smaller-context than Sonnet
      db.query.projectionCache.findFirst({
        where: and(
          eq(schema.projectionCache.merchantId, session.merchantId),
          eq(schema.projectionCache.consumer, 'sonnet_addendum'),
        ),
      }),
    ]);
    const merchant = merchants[0];
    if (!merchant) {
      log.warn({ merchantId: session.merchantId }, 'no merchant — closing room');
      await room.disconnect();
      return;
    }

    // Write the conversation_sessions row that attribution joins against on
    // Shopify order webhooks. Fire-and-forget: a DB hiccup must not kill the
    // worker — at worst we lose one row of attribution coverage. anon_<sid>
    // visitor id is intentional; it never matches a real Shopify cart
    // attribute, so attribution naturally skips these sessions until
    // Task 13 wires the widget→token→session visitor id path end-to-end.
    const visitorId = session.visitorId ?? `anon_${sessionId}`;
    sessionStore
      .openSession({ sessionId, merchantId: merchant.id, visitorId })
      .catch((err) => log.warn({ err, sessionId }, 'openSession failed'));

    // Accumulates turns + funnel/outcome flags so we can emit a single
    // conversationCompleted metric on Disconnect. The dashboard's
    // conversations-repo / kpi-repo read tags.transcript from that event —
    // without this emit those pages and the Conversations KPI stay empty.
    const recorder = createConversationRecorder({ sessionId, startMs: Date.now() });

    const kbChunkText = kbChunks.length > 0 ? kbChunks.map((c) => c.text).join('\n\n') : '';
    const siteGraphText = projection?.output ?? '';
    const kbText =
      [kbChunkText, siteGraphText].filter((s) => s.trim().length > 0).join('\n\n') || undefined;
    const demoMode = merchant.id === sharedEnv.SHOPPINGMATE_DEMO_MERCHANT_ID;

    // Cross-session personalization: load the returning-visitor profile and fold
    // a compact brief into the system instruction. Best-effort — a DB miss or
    // first-time visitor leaves visitorSummary='' and the prompt is unchanged.
    // Guard on session.visitorId (NOT the anon fallback) so anon sessions, which
    // never have a profile, don't issue a pointless query.
    let visitorSummary = '';
    try {
      if (session.visitorId) {
        const vp = await loadVisitorProfile(merchant.id, session.visitorId);
        visitorSummary = buildVisitorSummary(vp);
        if (vp)
          log.info(
            { sessionId, visitorId, sessionCount: vp.sessionCount },
            'personalization: returning visitor (voice)',
          );
        // PII-DIAG (Phase 0, remove after root-cause confirmed): see apps/api index.ts.
        const _id = (vp?.identity ?? {}) as Record<string, unknown>;
        log.info(
          {
            evt: 'pii_diag',
            phase: 'load',
            source: 'voice',
            sessionId,
            requestedVisitorId: session.visitorId,
            loadedVisitorId: vp?.visitorId ?? null,
            sessionCount: vp?.sessionCount ?? 0,
            injectedPii: Boolean(visitorSummary),
            has: {
              name: Boolean(_id.name),
              phone: Boolean(_id.phone),
              email: Boolean(_id.email),
              address: Boolean(_id.address),
            },
          },
          'PII-DIAG load',
        );
      }
    } catch (err) {
      log.warn({ err, sessionId }, 'visitor profile load failed (voice)');
    }

    // Data-driven brand selling-playbook: fold the data-derived guidance into
    // the voice system instruction. Best-effort — a DB miss or no playbook leaves
    // it undefined and the prompt is unchanged.
    const pb = await loadBrandPlaybook(merchant.id).catch(() => null);

    const voice = resolveVoiceContext(
      merchant.personaId,
      { name: merchant.name, domain: merchant.domain, platform: merchant.platform, businessType: merchant.businessType },
      {
        kbText,
        demoMode,
        brandSummary: merchant.brandSummary ?? undefined,
        brandCategories: merchant.brandCategories ?? undefined,
        visitorSummary,
        brandPlaybook: pb?.playbook,
      },
    );

    const dataChannel = createDataChannel({
      publish: (bytes) => room.publishData(bytes),
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
        room.disconnect().catch(() => {});
      },
    });
    caps.start();
    const tickInterval = setInterval(() => caps.tick(), 5_000);

    // Phase A: get the bot's audio output ready now (LiveKit: publish the empty
    // track) so the room is ready the instant the visitor clicks. Gemini Live
    // native-audio returns 24 kHz mono PCM16, pushed once Phase B opens.
    await room.prepareAudioOut();
    const tWarmed = Date.now();

    // Phase A done: signal the widget that the room is ready (LK + track up).
    // Widget can fade pre-click UI, but the call still waits for agent_ready
    // (Phase B = Gemini WS open) before flipping to 'listening'.
    dataChannel.publish({ type: 'agent_warmed' });
    log.info(
      {
        sessionId,
        ms_warm_total: tWarmed - tEntry,
        ms_connect: tConnected - tEntry,
        ms_db_setup: tWarmed - tConnected,
      },
      'agent_warmed published',
    );

    // Single DataReceived handler for the room. Dispatches by message type:
    // - start_voice (Phase A→B trigger): resolves the gate promise once.
    // - host_action_result: routes to the bridge (only valid after Phase B).
    // We use mutable refs because the bridge is created in Phase B, but the
    // listener must be installed early to avoid missing start_voice events.
    let bridgeRef: import('./bridge.js').Bridge | null = null;
    let resolveStartVoice: (() => void) | null = null;
    const startVoiceP = new Promise<void>((resolve) => {
      resolveStartVoice = resolve;
    });
    room.onData((payload: Uint8Array) => {
      let raw: string;
      try {
        raw = new TextDecoder().decode(payload);
      } catch {
        return;
      }
      const msg = decodeWidgetMessage(raw);
      if (!msg) return;
      if (msg.type === 'start_voice') {
        resolveStartVoice?.();
        resolveStartVoice = null;
        return;
      }
      if (msg.type === 'voice_timing') {
        // Widget-side call startup (tap → mic → ready → first audio), so we
        // can see where a slow first call actually spends its time.
        log.info({ sessionId, ...msg.timings }, 'voice startup timing');
        void db
          .insert(schema.metricEvents)
          .values({ merchantId: merchant.id, metricName: 'voiceStartup', tags: { session_id: sessionId, ...msg.timings } })
          .onConflictDoNothing()
          .catch(() => {});
        return;
      }
      if (msg.type === 'host_action_result' && bridgeRef) {
        bridgeRef.deliverHostActionResult?.({ callId: msg.callId, result: msg.result });
      }
    });

    // Phase B: wait for the widget's `start_voice` message before opening the
    // Gemini Live WS. This prevents burning Gemini $$ on visitors who land on
    // the page but never click the call button. Gemini WS handshake (~100-300ms)
    // is the only remaining cost on the click → listening path.
    // Watchdog: if no click soon, close the room. Was 5 min, and rooms were
    // warmed on every page view — 78 of 84 sat idle for the full 5 min, billed
    // by LiveKit. The widget now warms only on intent and drops an unused room
    // after 60s itself; this is the server-side backstop.
    const warmIdleMs = Number(process.env.VOICE_WARM_IDLE_MS ?? 75_000);
    const startVoiceTimeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error(`start_voice timeout (${Math.round(warmIdleMs / 1000)}s)`)), warmIdleMs),
    );
    const goLiveP = Promise.race([startVoiceP, startVoiceTimeout]);

    // PRE-GREET (default on): measured 2026-10-12, Gemini took ~5.8s after the
    // tap to produce the first word of its greeting (Gemini open itself ~0.1s).
    // Rooms are now warmed only on visitor intent, so open Gemini and generate
    // the greeting during warm-up, HOLDING its audio + captions until the tap —
    // then it plays at once. Unused greetings are dropped with the room.
    // VOICE_PREGREET=off restores open-on-tap.
    const pregreet = process.env.VOICE_PREGREET !== 'off';
    let live = !pregreet;
    const heldMsgs: Parameters<typeof dataChannel.publish>[0][] = [];
    const heldFrames: Int16Array[] = [];
    const rawPublish = dataChannel.publish.bind(dataChannel);
    dataChannel.publish = (msg) => {
      if (live) rawPublish(msg);
      else heldMsgs.push(msg);
    };
    let tStartVoice = 0;
    if (!pregreet) {
      try {
        await goLiveP;
      } catch (err) {
        log.warn({ sessionId, err: (err as Error).message }, 'no start_voice received — closing');
        clearInterval(tickInterval);
        await room.disconnect();
        return;
      }
      tStartVoice = Date.now();
    }
    // GREETING CACHE: even pre-generated, a greeting takes Gemini ~3–5s, so a
    // visitor who taps right away still waits. For first-time visitors the
    // greeting is the same for a brand + voice + prompt, so keep its audio for a
    // day and replay it on the tap; Gemini is told it already said it (tested:
    // with live input a seeded history turn is ignored, the instruction isn't).
    // Returning visitors (greeted by name) and VOICE_GREETING_CACHE=off skip it.
    const kickoff = demoMode
      ? 'The visitor just opened voice mode on shoppingmate.ai. Greet them warmly in one short sentence and offer the demo tour: pick a vertical (dog food, apparel, jewelry, electronics, or supplements).'
      : `The visitor just connected on the ${merchant.name ?? 'store'} site. Open the conversation now: greet them warmly and introduce yourself exactly as your instructions say, then ask how you can help. Keep it to a sentence or two — do not wait for them to speak first.`;
    // Real-device test 2026-10-13: returning visitors (personal greeting, never
    // cached) waited 8–27s for a live-generated greeting. Now EVERY caller gets
    // the cached generic greeting instantly; a returning visitor is welcomed
    // back by name in Olivia's next reply. Only generic greetings (first-time
    // visitors) are ever written to the cache — never one with a name in it.
    const greetCacheable = pregreet && process.env.VOICE_GREETING_CACHE !== 'off';
    const returning = visitorSummary.trim().length > 0;
    const genericInstruction = returning
      ? resolveVoiceContext(
          merchant.personaId,
          { name: merchant.name, domain: merchant.domain, platform: merchant.platform, businessType: merchant.businessType },
          {
            kbText,
            demoMode,
            brandSummary: merchant.brandSummary ?? undefined,
            brandCategories: merchant.brandCategories ?? undefined,
            brandPlaybook: pb?.playbook,
          },
        ).systemInstruction
      : voice.systemInstruction;
    const greetKey = `sm:greet:v1:${merchant.id}:${voice.voiceId}:${createHash('sha1')
      .update(`${genericInstruction}\n${kickoff}`)
      .digest('hex')}`;
    let cachedGreeting: { text: string; pcm: Buffer } | null = null;
    // While the cached greeting is playing (epoch ms it ends), for barge-in.
    let greetingUntil = 0;
    let lastVisitorSpeechAt = 0;
    let lastAudioOutAt = 0;
    if (greetCacheable) {
      try {
        const raw = await redis().get(greetKey);
        if (raw) {
          const g = JSON.parse(raw) as { text?: string; pcm?: string };
          if (g.text && g.pcm) cachedGreeting = { text: g.text, pcm: Buffer.from(g.pcm, 'base64') };
        }
      } catch (err) {
        log.warn({ err: (err as Error).message }, 'greeting cache read failed');
      }
    }
    // While generating a cacheable greeting, collect its audio to store.
    let greetCapture: { chunks: Buffer[]; bytes: number } | null =
      greetCacheable && !returning && !cachedGreeting ? { chunks: [], bytes: 0 } : null;
    const geminiInstruction = cachedGreeting
      ? `${voice.systemInstruction}\n\nCALL ALREADY STARTED: you opened this call by saying exactly: "${cachedGreeting.text}" — the visitor has heard it. Do NOT greet or introduce yourself again; reply directly to what they say next.${
          returning
            ? ' They are a RETURNING VISITOR (see above): in your next reply, briefly and warmly show you remember them (by name if known) — without greeting again.'
            : ''
        }`
      : voice.systemInstruction;
    const tGeminiOpenStart = Date.now();

    const transport = createGeminiSdkTransport();
    const gemini = createGeminiSession({
      transport,
      voiceId: voice.voiceId,
      systemInstruction: geminiInstruction,
      // On an unexpected Gemini reconnect, hand the fresh session the LAST ~12
      // turns so it resumes the conversation seamlessly. Capped on purpose — the
      // full transcript is what overflowed and triggered the reconnect.
      getResumeContext: () =>
        recorder
          .snapshot()
          .slice(-12)
          .map((t) => `${t.role === 'user' ? 'Visitor' : 'You'}: ${t.content}`)
          .join('\n'),
    });
    await gemini.open();
    const tReady = Date.now();

    // Side-channel runtime: while Gemini Live owns the conversation audio,
    // we run the chat tool-loop in parallel on every visitor utterance so
    // host_action tools (site.navigate / site.scroll_to / site.highlight /
    // pricing.quote) can actually drive the browser from voice mode.
    // We drop the runtime's say/say_partial events — Gemini already speaks
    // and captions — and only forward tool-action events to the widget.
    const recordMetric = async (
      name: string,
      tags: Record<string, string | number | boolean>,
    ): Promise<void> => {
      await db
        .insert(schema.metricEvents)
        .values({ merchantId: merchant.id, metricName: name, tags })
        .onConflictDoNothing();
    };
    // Set from REAL page actions (any route to /checkout — the executor's
    // site.navigate included), so the deterministic checkout gate opens even
    // when the visitor never literally said "checkout". Declared before the
    // bridge so its publishData closure can set it safely.
    const flowState = { checkoutReached: false };
    // The visitor actually has saved details on file only if the returning-
    // visitor brief carries them; anything else Gemini says about "saved
    // details" is invented and must be corrected.
    const hasSavedDetails = /\b(phone|address|pincode|saved checkout)\b/i.test(visitorSummary);
    let savedClaimCorrected = false;
    const bridge = createBridge({
      sessionId,
      merchantId: merchant.id,
      runTurn,
      loadMerchant: async (id) => {
        const rows = await db
          .select()
          .from(schema.merchants)
          .where(eq(schema.merchants.id, id))
          .limit(1);
        if (!rows[0]) throw new Error(`merchant not found: ${id}`);
        return rows[0];
      },
      loadSession: async (sid) => {
        const s = await loadSession(redis(), sid);
        if (!s) throw new Error(`session not found: ${sid}`);
        return s;
      },
      saveSession: (s) => saveSessionAgent(redis(), s),
      recordMetric,
      // The side-channel executor (OpenRouter) failed this turn. Gemini may have
      // already optimistically said "added it" — ground it with the truth so it
      // corrects instead of lying. 'exhausted' = out-of-credits 402: also record a
      // dedicated metric + error log so the outage is visible immediately (it has
      // silently broken cart/checkout for days before). Top up restores it.
      onExecutorError: (kind) => {
        void gemini
          .speak(
            kind === 'exhausted'
              ? 'SYSTEM: the action system is temporarily unavailable, so nothing was added, filled, or placed this turn. Warmly tell the visitor you hit a brief technical issue completing that and ask them to try again in a moment. Do NOT claim anything was added, placed, or done.'
              : "SYSTEM: that action didn't go through. Honestly tell the visitor you couldn't complete it just now and offer to try again. Do NOT claim anything was added, placed, or done.",
          )
          .catch((err) => log.warn({ err, sessionId }, 'executor-error grounding failed'));
        if (kind === 'exhausted') {
          log.error(
            { sessionId, merchantId: merchant.id },
            'OpenRouter executor EXHAUSTED (402 insufficient credits) — tools are down until topped up: https://openrouter.ai/settings/credits',
          );
          void recordMetric('agent.executor.exhausted', {
            sessionId,
            merchantId: merchant.id,
            provider: 'openrouter',
          }).catch(() => {});
          void alertExecutorExhausted(merchant.id, sessionId).catch(() => {});
        }
      },
      submitCase: (c) => submitSupportCase(c),
      submitConsultation: (req) =>
        submitConsultationRequest({
          merchantId: req.merchantId,
          sessionId: req.sessionId,
          name: req.name,
          age: req.age,
          condition: req.condition,
          phoneCountryCode: req.phoneCountryCode,
          phone: req.phone,
        }),
      loadAdapter: (m) =>
        getAdapter(m, {
          transport: new NoOpWSTransport(),
          state: new InMemorySessionState(),
        }),
      // Feed the side-channel Sonnet the same brand KB + site map the text-chat
      // path gets, so it searches the catalog with real product names (cards +
      // price render) and navigates with real paths instead of guessing.
      loadPromptOpts: async () => ({
        kbText: kbChunkText.trim().length > 0 ? kbChunkText : undefined,
        siteGraphText: siteGraphText.trim().length > 0 ? siteGraphText : undefined,
        demoMode,
      }),
      speak: async () => {
        // No-op: Gemini Live owns voice output. If we forward runtime `say`
        // text into gemini.speak, Gemini answers twice (once autonomously,
        // once for the injected text). Captions for Sage already stream
        // via outputAudioTranscription.
      },
      publishData: (msg) => {
        // Suppress runtime say/say_partial — Gemini's transcript is the
        // canonical caption. Forward everything else (host_action_request,
        // cards, persona_swap, checkout_redirect, cap_warning, session_closed).
        if (msg.type === 'say' || msg.type === 'say_partial' || msg.type === 'user_text') return;
        // Mark funnel/outcome from the bot's host actions for conversationCompleted.
        if (msg.type === 'host_action_request') {
          if (msg.action.type === 'cart_add') recorder.markCartAdd();
          if (msg.action.type === 'navigate' && String(msg.action.path).includes('/checkout')) {
            recorder.markCheckoutReached();
            flowState.checkoutReached = true;
          }
        }
        if (msg.type === 'checkout_redirect') recorder.markCheckoutReached();
        dataChannel.publish(msg);
      },
      closeRoom: () => {
        room.disconnect().catch(() => {});
      },
      interrupt: () => gemini.interrupt(),
      caps: { recordTurn: () => caps.recordTurn() },
      recommendationStore,
    });
    bridgeRef = bridge;

    // Kickoff greeting: Gemini Live native-audio is purely reactive — left alone
    // it waits for the visitor to speak first. Visitors expect the bot to greet
    // them the moment the call connects, so inject a one-shot trigger (a user
    // turn) that makes it open the conversation per its system instructions.
    // Fire-and-forget so a hiccup never blocks the session.
    // (kickoff text is defined above, next to the greeting cache.) A cached
    // greeting replaces it — Gemini already "said" it via its instructions.
    if (!cachedGreeting) gemini.speak(kickoff).catch((err) => log.warn({ err }, 'kickoff greeting failed'));

    // captureFrame returns a promise that resolves when the frame is buffered.
    // Awaiting it serializes producer→queue and prevents the burst-overflow that
    // the default fire-and-forget pattern would cause. We chain instead of
    // awaiting inline because gemini.onEvent is sync.
    let captureChain: Promise<void> = Promise.resolve();
    let tFirstAudio = 0;

    // The visitor tapped Call: tell the widget the bot is online (it flips
    // CONNECTING → listening on this), then release anything held during
    // pre-greet — captions first, then the greeting audio, in order.
    const goLive = () => {
      live = true;
      if (!tStartVoice) tStartVoice = Date.now();
      rawPublish({ type: 'agent_ready' });
      if (cachedGreeting) {
        // Replay the cached greeting: caption + transcript now, audio below.
        rawPublish({ type: 'say', text: cachedGreeting.text });
        recorder.addTurn('agent', cachedGreeting.text);
        bridge.noteAssistantTurn(cachedGreeting.text);
        const samplesPerFrame = 2_400; // 100 ms at 24 kHz
        const pcm = new Int16Array(
          cachedGreeting.pcm.buffer.slice(cachedGreeting.pcm.byteOffset, cachedGreeting.pcm.byteOffset + cachedGreeting.pcm.byteLength),
        );
        for (let i = 0; i < pcm.length; i += samplesPerFrame) {
          const slice = pcm.slice(i, i + samplesPerFrame);
          heldFrames.push(slice);
        }
        tFirstAudio = tFirstAudio || Date.now();
        // Our server — not Gemini — is speaking the cached greeting, so
        // Gemini's own barge-in can't stop it; the mic check below does.
        greetingUntil = Date.now() + Math.round((pcm.length / 24_000) * 1000) + 500;
      }
      for (const m of heldMsgs.splice(0)) rawPublish(m);
      for (const f of heldFrames.splice(0)) {
        captureChain = captureChain
          .then(() => room.playAudio(f))
          .catch((err) => log.warn({ err }, 'captureFrame failed'));
      }
      log.info(
        {
          sessionId,
          pregreet,
          ms_total: tReady - tEntry,
          ms_warm: tWarmed - tEntry,
          ms_idle: tStartVoice - tWarmed,
          ms_gemini_open: tReady - tGeminiOpenStart,
          // How long the greeting took to generate, and whether it was ready
          // before the tap (then the visitor hears it immediately).
          greeting_cached: cachedGreeting !== null,
          ms_greeting_generated: tFirstAudio ? tFirstAudio - tReady : null,
          greeting_ready_at_tap: tFirstAudio > 0 && tFirstAudio <= tStartVoice,
        },
        'agent_ready published',
      );
    };
    if (pregreet) {
      goLiveP.then(goLive, (err) => {
        log.warn({ sessionId, err: (err as Error).message }, 'no start_voice received — closing');
        clearInterval(tickInterval);
        gemini.close().catch(() => {});
        room.disconnect().catch(() => {});
      });
    } else {
      goLive();
    }

    // Track which verticals have already had their cards shown this session.
    // Without this, every follow-up question about jewelry would re-publish
    // the same three jewelry cards — noisy and disorienting.
    const shownVerticals = new Set<string>();

    // ── Deterministic, state-grounded voice checkout ─────────────────────────
    // Voice has two brains (Gemini speaks; the side-channel executor drives
    // tools), and the executor is unreliable at deciding to call checkout.fill.
    // So on a confirmation we DON'T trust either LLM: we read the whole spoken
    // transcript, extract+validate the details, then drive navigate → fill →
    // place as real host actions and tell Gemini the REAL outcome. Gemini's
    // prompt forbids claiming "filled"/"placed" until it gets one of these
    // system messages — that kills the fake "your order's in" with an empty form.
    let checkoutEntered = false;
    let orderPlaced = false;
    let completingOrder = false;
    // Phase 4 — live in-session signal state. liveTurn counts completed assistant
    // turns; nudgeState rate-limits the (flag-gated) spoken nudge.
    let liveTurn = 0;
    const nudgeState = { lastNudgeTurn: 0 };
    // Contact-us / inquiry form (separate from checkout + consultation).
    let contactMode = false;
    let contactFilled = false;
    const checkoutModel =
      process.env.OPENROUTER_CHECKOUT_MODEL ??
      process.env.OPENROUTER_MODEL ??
      'anthropic/claude-sonnet-4.6';
    const extractChat: ChatFn = (messages) =>
      // Tiny structured reply (7 short fields) — cap output so OpenRouter doesn't
      // reserve credit for the model's 64K default and 402 on a low balance.
      chat({ model: checkoutModel, messages, responseFormat: 'json', maxTokens: 512 });
    // Inject a one-shot grounding message Gemini will voice to the visitor. It's
    // sent as a turn Gemini responds to (same channel as the kickoff greeting).
    const ground = (instruction: string) =>
      gemini.speak(instruction).catch((err) => log.warn({ err }, 'grounding speak failed'));
    // Fill the page NOW; only pay a wait if the inputs aren't mounted yet
    // (form_fill returns not-ok), then retry once. Avoids a fixed pre-fill delay
    // on every fill when the page is already up (the common case — the bot
    // navigated earlier). data-sm-field resolution is a direct lookup, so this is
    // fast and does not "crawl" the DOM.
    const fillFormWithRetry = async (fields: Array<{ field: string; value: string }>) => {
      const dispatch = bridge.dispatchHostAction!;
      let fill = await dispatch({ type: 'form_fill', fields });
      if (!fill.ok) {
        await new Promise((r) => setTimeout(r, 600));
        fill = await dispatch({ type: 'form_fill', fields });
      }
      return fill;
    };

    async function completeOrder() {
      const dispatch = bridge.dispatchHostAction;
      if (completingOrder || orderPlaced || !dispatch) return;
      completingOrder = true;
      log.info({ sessionId }, 'order completion: start');
      try {
        const transcript = recorder
          .snapshot()
          .map((t) => `${t.role === 'user' ? 'Visitor' : 'Calmio'}: ${t.content}`)
          .join('\n');
        // Email-optional: voice STT can't reliably spell emails, so we don't
        // block on it — the visitor types/confirms email on the page. We require
        // name/phone/address/pincode (what voice CAN capture); city/state are NOT
        // required — the checkout page derives them from the pincode.
        const extracted = await extractCheckoutDetails(transcript, extractChat, {
          requireEmail: false,
        });
        log.info(
          { sessionId, ok: extracted.ok, reason: extracted.ok ? undefined : extracted.reason },
          'order completion: extraction result',
        );
        if (!extracted.ok) {
          ground(
            `We can't fill the order yet — ${extracted.reason} Ask the visitor for that now in their language; do NOT say the order is filled or placed.`,
          );
          return;
        }
        const d = extracted.details;
        // Fill the REAL checkout form via page.fill (DOM) — the mechanism that
        // actually populates the inputs (the event-based brand hook filled
        // nothing in practice). Resolution is by the stable data-sm-field anchors
        // on the inputs. Filling the pincode triggers the page's own city/state
        // lookup, so those derive automatically. We do NOT place by voice — the
        // visitor reviews + taps Pay on the page (and adds email if we couldn't
        // catch it). Bonus: once filled, the order is completable on-screen even
        // if the voice session later drops.
        await dispatch({ type: 'navigate', path: '/checkout' }).catch(() => undefined);
        const fillFields: Array<{ field: string; value: string }> = [
          { field: 'name', value: d.name },
          { field: 'phone', value: d.phone },
          { field: 'address', value: d.address },
          { field: 'pincode', value: d.pincode },
        ];
        if (d.email) fillFields.push({ field: 'email', value: d.email });
        const fill = await fillFormWithRetry(fillFields);
        const filledVals = (fill as { values?: Record<string, string> }).values ?? {};
        log.info(
          {
            sessionId,
            ok: fill.ok,
            filled: fill.ok ? filledVals : undefined,
            reason: fill.ok ? undefined : (fill as { reason?: string }).reason,
          },
          'order completion: fill result',
        );
        // Same telemetry as executor tools so the owner's conversation timeline
        // shows this fill (and whether it really worked).
        void recordMetric('agent.tool.invoked', {
          sessionId,
          toolName: 'checkout.fill',
          ok: fill.ok,
          channel: 'host',
          ...(fill.ok
            ? {}
            : { failReason: String((fill as { reason?: string }).reason ?? 'unknown') }),
        }).catch(() => {});
        if (!fill.ok) {
          ground(
            `The details did NOT get filled on the page (reason: ${(fill as { reason?: string }).reason}). Tell the visitor honestly it didn't go through and offer to try again — do NOT say it's filled or placed.`,
          );
          return;
        }
        orderPlaced = true; // handed off to the page — don't re-fill on later confirmations
        recorder.markCheckoutReached();
        // Read back what's ACTUALLY in the form (not our memory) so the bot is
        // state-grounded. Fall back to the validated values if the field key
        // wasn't echoed.
        const shownName = filledVals.name || d.name;
        const shownPhone = filledVals.phone || d.phone;
        const shownAddress = filledVals.address || d.address;
        const hasEmail = (filledVals.email || d.email).length > 0;
        ground(
          `The checkout form on screen now shows: name ${shownName}, phone ${shownPhone}, address ${shownAddress}, pincode ${d.pincode} (city/state fill in from the pincode). ` +
            (hasEmail
              ? `Tell the visitor warmly it's all filled in — ask them to glance over it on screen and tap "Place Order" to pay (card, UPI, or Cash on Delivery on the secure page). `
              : `Their EMAIL is the only thing still blank (voice can't catch emails reliably). Tell them everything else is filled in on screen, and ask them to type their email in the email box on the page, then tap "Place Order" to pay. `) +
            `Do NOT say the order is already placed — they complete it by tapping on the page.`,
        );
      } catch (err) {
        log.warn({ err, sessionId }, 'voice checkout fill failed');
        ground(
          `Something went wrong filling the order. Apologize briefly and offer to try again — do NOT say it's filled or placed.`,
        );
      } finally {
        completingOrder = false;
      }
    }

    // Deterministic "Contact us" / inquiry form fill — same page.fill approach as
    // checkout, different fields. The visitor reviews + taps Send Message.
    async function completeContactForm() {
      const dispatch = bridge.dispatchHostAction;
      if (completingOrder || contactFilled || !dispatch) return;
      completingOrder = true;
      log.info({ sessionId }, 'contact fill: start');
      try {
        const transcript = recorder
          .snapshot()
          .map((t) => `${t.role === 'user' ? 'Visitor' : 'Calmio'}: ${t.content}`)
          .join('\n');
        const extracted = await extractContactDetails(transcript, extractChat);
        log.info(
          { sessionId, ok: extracted.ok, reason: extracted.ok ? undefined : extracted.reason },
          'contact fill: extraction result',
        );
        if (!extracted.ok) {
          ground(
            `We can't fill the contact form yet — ${extracted.reason} Ask the visitor for that now in their language; do NOT say the message is sent.`,
          );
          return;
        }
        const c = extracted.details;
        await dispatch({ type: 'navigate', path: '/contact' }).catch(() => undefined);
        const fields: Array<{ field: string; value: string }> = [
          { field: 'name', value: c.name },
          { field: 'mobile', value: c.mobile },
        ];
        if (c.email) fields.push({ field: 'email', value: c.email });
        if (c.subject) fields.push({ field: 'subject', value: c.subject });
        if (c.message) fields.push({ field: 'message', value: c.message });
        const fill = await fillFormWithRetry(fields);
        const vals = (fill as { values?: Record<string, string> }).values ?? {};
        log.info(
          {
            sessionId,
            ok: fill.ok,
            filled: fill.ok ? vals : undefined,
            reason: fill.ok ? undefined : (fill as { reason?: string }).reason,
          },
          'contact fill: fill result',
        );
        if (!fill.ok) {
          ground(
            `The contact form did NOT get filled (reason: ${(fill as { reason?: string }).reason}). Tell the visitor honestly and offer to try again — do NOT say it's sent.`,
          );
          return;
        }
        contactFilled = true;
        const needEmail = (vals.email || c.email).length === 0;
        const needMsg = c.message.length === 0;
        ground(
          `The contact form on screen is now filled: name ${c.name}, mobile ${c.mobile}${c.subject ? `, subject ${c.subject}` : ''}. ` +
            (needEmail || needMsg
              ? `Still blank: ${[needEmail ? 'their email' : '', needMsg ? 'the message' : ''].filter(Boolean).join(' and ')} — ask them to type ${needEmail && needMsg ? 'those' : 'that'} in on the page. Then tell them to tap "Send Message". `
              : `Tell the visitor it's all filled in on screen — ask them to review it and tap "Send Message" to send. `) +
            `Do NOT say the message is already sent — they send it by tapping Send Message on the page.`,
        );
      } catch (err) {
        log.warn({ err, sessionId }, 'contact form fill failed');
        ground(
          `Something went wrong filling the contact form. Apologize briefly and offer to try again — do NOT say it's sent.`,
        );
      } finally {
        completingOrder = false;
      }
    }

    gemini.onEvent((e) => {
      if (e.type === 'final_transcript' && e.text.trim().length > 0) {
        const words = e.text.split(/\s+/).filter(Boolean).length;
        const inputSeconds = words / 3.3;
        caps.recordVoiceSeconds(inputSeconds);
        metrics.add('gemini_audio_input_seconds', inputSeconds);
        // Phase 1 design: Gemini Live owns voice conversation; the visitor's
        // transcript also goes to the widget for caption display.
        dataChannel.publish({ type: 'user_text', text: e.text });
        recorder.addTurn('user', e.text);
        // Side-channel: route the visitor's text through the chat tool-loop
        // so host_action tools can navigate / scroll / quote pricing while
        // Gemini speaks naturally over the top. The bridge's `say` events
        // are suppressed (Gemini's transcript is the canonical caption).
        const turnDone = bridge
          .handleUserText(e.text)
          .catch((err) => log.warn({ err }, 'bridge.handleUserText failed'));
        // Demo tour: when Sage is on shoppingmate.ai itself and the visitor
        // names a vertical, surface 3 showcase cards directly. Belt-and-
        // suspenders next to the bridge tool-loop in case Sonnet picks a
        // different action.
        if (demoMode) {
          const vertical = matchVertical(e.text);
          if (vertical && !shownVerticals.has(vertical)) {
            shownVerticals.add(vertical);
            void publishShowcaseCards(merchant.id, vertical, dataChannel).catch((err) =>
              log.warn({ err, vertical }, 'showcase card lookup failed'),
            );
          }
        }
        // Belt-and-suspenders: when the visitor clearly asks to go to checkout,
        // navigate DETERMINISTICALLY — independent of the side-channel LLM's tool
        // decision and the runTurn abort flag (a barge-in could drop a pending
        // site.navigate). This kills the "I'm taking you to checkout" / "still on
        // the shop page" divergence: Gemini narrates it AND the page actually moves.
        // Navigating to /checkout when already there is a client-router no-op.
        if (
          merchant.siteGraphEnabled &&
          bridge.dispatchHostAction &&
          wantsCheckoutNavigation(e.text)
        ) {
          const dispatch = bridge.dispatchHostAction;
          // Run AFTER the executor turn so any cart.add from THIS same utterance
          // ("add green mantra and check me out") has landed before we read the
          // cart. Then GATE the checkout navigation on the REAL cart so we never
          // strand the visitor on an empty checkout (0 items can't be ordered —
          // the exact "add failed → empty checkout" bug). On an unavailable read
          // we fall back to navigating, so a read hiccup never regresses the flow.
          void turnDone.then(async () => {
            const cart = await dispatch({ type: 'cart_get' }).catch(
              () => ({ ok: false, reason: 'timeout' }) as HostActionResult,
            );
            const count = cart.ok ? Number(cart.values?.count ?? '0') : Number.NaN;
            if (count === 0) {
              ground(
                "SYSTEM: the cart is empty, so checkout can't open. Warmly tell the visitor there's nothing in the cart yet and ask which product they'd like to add first. Do NOT say you're taking them to checkout, and do NOT claim anything was added.",
              );
              return;
            }
            checkoutEntered = true;
            await dispatch({ type: 'navigate', path: '/checkout' }).catch((err) =>
              log.warn({ err }, 'deterministic checkout nav failed'),
            );
          });
        }
        // Belt-and-suspenders product-page nav: "show me the peace mantra page"
        // navigates deterministically even if the executor's site.navigate misses.
        if (merchant.siteGraphEnabled && bridge.dispatchHostAction) {
          const productPath = productNavPath(e.text);
          if (productPath) {
            void bridge
              .dispatchHostAction({ type: 'navigate', path: productPath })
              .catch((err) => log.warn({ err }, 'deterministic product nav failed'));
          }
        }
        // Open the completion gate as soon as the visitor is giving checkout
        // details (phone/email/pincode/address/order) — they often skip "take me
        // to checkout" and go straight to dictating details.
        if (merchant.siteGraphEnabled && hasCheckoutSignal(e.text)) checkoutEntered = true;
        // The visitor wants to send a Contact-us / inquiry message → fill that
        // form instead of checkout (and instead of the doctor consultation).
        if (merchant.siteGraphEnabled && wantsContactForm(e.text)) contactMode = true;
        // Deterministic, state-grounded completion on a confirmation. Route to
        // the contact form if we're in contact mode, else to checkout. Safe to
        // over-trigger: incomplete details just ask for what's missing.
        if (
          merchant.siteGraphEnabled &&
          (wantsOrderConfirmation(e.text) || wantsDetailsFilled(e.text))
        ) {
          if (contactMode && !contactFilled) {
            log.info({ sessionId, text: e.text }, 'contact fill: confirmation detected → filling');
            void completeContactForm();
          } else if ((checkoutEntered || flowState.checkoutReached) && !orderPlaced) {
            log.info(
              { sessionId, text: e.text },
              'order completion: confirmation detected → completing',
            );
            void completeOrder();
          }
        }
      } else if (e.type === 'bot_text_partial' && e.text.trim().length > 0) {
        // Stream caption updates while the turn is still in progress. Widget
        // replaces the active agent bubble in place so text scrolls alongside
        // the audio instead of appearing only when Sage stops talking.
        // Gemini owns this text autonomously and (despite the prompt rule)
        // sometimes leaks tool-call syntax like `cart.add(sku='peace-mantra')`
        // — strip it before it reaches the caption. The prompt-only defense has
        // regressed before; this is the durable guard for the visible leak.
        const partial = stripToolSyntax(e.text);
        if (partial.trim().length > 0) dataChannel.publish({ type: 'say_partial', text: partial });
      } else if (e.type === 'bot_text' && e.text.trim().length > 0) {
        const clean = stripSystemEcho(stripToolSyntax(e.text));
        if (greetCapture) {
          // First completed turn = the greeting. Store it for the next callers.
          const g = greetCapture;
          greetCapture = null;
          const pcm = Buffer.concat(g.chunks);
          if (clean.trim() && pcm.length > 24_000 && pcm.length < 3_000_000) {
            redis()
              .set(greetKey, JSON.stringify({ text: clean.trim(), pcm: pcm.toString('base64') }), 'EX', 30 * 86_400)
              .then(() => log.info({ sessionId, bytes: pcm.length }, 'greeting cached'))
              .catch((err) => log.warn({ err: (err as Error).message }, 'greeting cache write failed'));
          }
        }
        if (clean.trim().length > 0) {
          dataChannel.publish({ type: 'say', text: clean });
          recorder.addTurn('agent', clean);
          // Feed Gemini's spoken turn to the side-channel executor so it reasons
          // over the real dialogue (and can map answers→fields for checkout.fill).
          bridge.noteAssistantTurn(clean);
          // Phase 4 — live signal (best-effort, never blocks the call). Classify
          // the spoken conversation-so-far, steer the NEXT runTurn's prompt, and
          // (only when LIVE_NUDGE_ENABLED=1) optionally speak one proactive nudge.
          void (async () => {
            try {
              liveTurn += 1;
              const snap = recorder.snapshot();
              if (snap.filter((t) => t.role === 'user').length < 2) return;
              const transcript = snap.map((t) => `${t.role}: ${t.content}`).join('\n');
              const sig = await classifyLiveSignal(transcript, extractChat);
              const steer = signalSteerLine(sig);
              bridge.setLiveSignal(steer || undefined);
              if (steer) log.info({ sessionId, steer }, 'live signal (voice)');
              if (process.env.LIVE_NUDGE_ENABLED === '1') {
                const n = nextNudge(sig, liveTurn, nudgeState);
                if (n) {
                  nudgeState.lastNudgeTurn = liveTurn;
                  ground(n);
                  log.info({ sessionId }, 'live nudge spoken');
                }
              }
            } catch (err) {
              log.warn({ err, sessionId }, 'live signal (voice) failed');
            }
          })();
          // The contact form is the only flow that asks for a "subject" / "message"
          // — if the bot asks for those, we're filling the contact form, not
          // checkout (even though a phone number set checkoutEntered).
          if (
            merchant.siteGraphEnabled &&
            /\b(subject|your message|what is this about|message you)\b/i.test(clean)
          ) {
            contactMode = true;
          }
          // Reliable completion trigger: when Gemini narrates that it's placing
          // the order ("putting your order through, one moment"), run the real
          // deterministic completion. More robust than matching the visitor's
          // multilingual "yes" — and it's exactly when Gemini is about to wait
          // for the system outcome, so it stays silent until we ground it.
          // Gemini invented "your saved number/address" with nothing on file
          // (live 2026-10-06: no profile loaded, store had no saved address) —
          // correct it immediately, once, so it collects details instead.
          if (!hasSavedDetails && !savedClaimCorrected && claimsSavedDetails(clean)) {
            savedClaimCorrected = true;
            log.warn({ sessionId }, 'voice: invented saved details → correcting');
            ground(
              'SYSTEM: Correction — this visitor has NO saved details on file (no saved phone, email or address). Apologize briefly for the mix-up, then ask for their full name, phone number, email, delivery address and pincode. Never mention saved details again, and do NOT say anything is filled.',
            );
          }
          if (merchant.siteGraphEnabled && geminiSignalsPlacement(clean)) {
            if (contactMode && !contactFilled) {
              log.info({ sessionId }, 'contact fill: placement narration detected → filling');
              void completeContactForm();
            } else if ((checkoutEntered || flowState.checkoutReached) && !orderPlaced) {
              log.info(
                { sessionId },
                'order completion: placement narration detected → completing',
              );
              void completeOrder();
            }
          }
        }
      } else if (e.type === 'audio_out') {
        const samples = e.bytes.length / 2;
        const seconds = samples / 24_000;
        caps.recordVoiceSeconds(seconds);
        metrics.add('gemini_audio_output_seconds', seconds);
        const view = new Int16Array(e.bytes.buffer, e.bytes.byteOffset, e.bytes.byteLength / 2);
        // Copy: the transport keeps the buffer; the underlying Buffer may be reused.
        const pcm = new Int16Array(view);
        if (!tFirstAudio) tFirstAudio = Date.now();
        // Reply latency: visitor's last loud mic audio → Gemini's first reply audio.
        if (lastVisitorSpeechAt && Date.now() - lastAudioOutAt > 1500) {
          log.info({ sessionId, ms_reply: Date.now() - lastVisitorSpeechAt, transport: room.transport }, 'reply latency');
          lastVisitorSpeechAt = 0;
        }
        lastAudioOutAt = Date.now();
        if (greetCapture && greetCapture.bytes < 3_000_000) {
          greetCapture.chunks.push(Buffer.from(e.bytes));
          greetCapture.bytes += e.bytes.length;
        }
        // Pre-greet: hold the greeting until the visitor actually taps Call.
        if (!live) {
          heldFrames.push(pcm);
          return;
        }
        captureChain = captureChain
          .then(() => room.playAudio(pcm))
          .catch((err) => log.warn({ err }, 'captureFrame failed'));
      } else if (e.type === 'interrupted') {
        // A cut-off greeting must never be cached.
        greetCapture = null;
        // Visitor barged in. Two things must happen for it to feel like a real
        // conversation: (1) drop bot audio still queued in the AudioSource so
        // Sage stops talking AT ONCE instead of finishing the buffered reply,
        // and (2) abort the in-flight executor turn so it doesn't keep producing
        // 'say' events and resume speaking right after.
        try {
          room.clearAudio();
        } catch (err) {
          log.warn({ err }, 'clearQueue on interrupt failed');
        }
        bridge.handleBargeIn();
        captureChain = Promise.resolve();
      } else if (e.type === 'error') {
        log.error({ err: e.error }, 'gemini transport error');
      }
    });

    // Visitor's mic → Gemini (16 kHz PCM16), from whichever transport. While the
    // cached greeting plays, ~200 ms of clear speech cuts it off (real-device
    // feedback: "I can't interrupt it during the greeting").
    let loudMs = 0;
    room.onMicAudio((bytes) => {
      gemini.pushAudio(bytes);
      const aligned = bytes.byteOffset % 2 === 0 ? bytes : bytes.slice();
      const s = new Int16Array(aligned.buffer, aligned.byteOffset, aligned.byteLength >> 1);
      let sum = 0;
      for (let i = 0; i < s.length; i++) sum += (s[i] as number) * (s[i] as number);
      const rms = Math.sqrt(sum / Math.max(1, s.length));
      if (rms > GREETING_BARGE_RMS) lastVisitorSpeechAt = Date.now();
      if (!greetingUntil || Date.now() > greetingUntil) return;
      const ms = s.length / 16;
      loudMs = rms > GREETING_BARGE_RMS ? loudMs + ms : Math.max(0, loudMs - ms);
      if (loudMs >= 200) {
        greetingUntil = 0;
        loudMs = 0;
        heldFrames.length = 0;
        room.clearAudio();
        log.info({ sessionId, rms: Math.round(rms) }, 'visitor interrupted the greeting');
      }
    });
    room.onVisitorSpeaking(() => gemini.interrupt());

    // Emit the conversation record in an AWAITED shutdown callback — NOT
    // fire-and-forget in Disconnected. The per-job worker tears down right after
    // the room ends, so a fire-and-forget DB write loses the race and never
    // lands (this is why the dashboard showed ZERO conversations despite heavy
    // voice traffic — mid-call metrics persist because the worker is alive then,
    // but the end-of-call record didn't). addShutdownCallback is awaited by the
    // agents runtime, so the insert is guaranteed to complete before exit.
    let recordEmitted = false;
    const emitConversationRecord = async () => {
      if (recordEmitted) return;
      recordEmitted = true;
      const tags = recorder.finish({ mode: 'voice', nowMs: Date.now() });
      // Nothing was said — a pre-warm/abandoned connection that never became a
      // real call. Don't create an empty conversation row.
      // Also skip a pre-greeted room nobody called on (greeting generated, never heard).
      if (tags.turns === 0 || !live) return;
      // Intent enrichment is BEST-EFFORT and BOUNDED (4s): it must never block or
      // delay the conversation record. On timeout/failure we still emit the row
      // (without intent), so the dashboard always gets the conversation.
      const transcriptText = tags.transcript.map((t) => `${t.role}: ${t.content}`).join('\n');
      try {
        const profiled = await Promise.race([
          extractConversationProfile(
            transcriptText,
            {
              cartAdds: tags.cart_adds,
              checkoutReached: tags.checkout_reached,
              purchased: tags.outcome === 'purchased',
              mode: 'voice',
            },
            extractChat,
          ),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
        ]);
        if (profiled) tags.intent = profiled.record;
      } catch (err) {
        log.warn({ err, sessionId }, 'intent profiling failed; emitting record without intent');
      }
      try {
        await db
          .insert(schema.metricEvents)
          .values({ merchantId: merchant.id, metricName: 'conversationCompleted', tags });
        await db.insert(schema.metricEvents).values({
          merchantId: merchant.id,
          metricName: 'voiceConversation',
          tags: { session_id: sessionId },
        });
        if (tags.intent && session.visitorId) {
          await upsertVisitorProfile(merchant.id, visitorId, tags.intent, {
            outcome: tags.outcome,
            attributedCents: tags.attributed_cents,
          });
          // PII-DIAG (Phase 0, remove after root-cause confirmed): which silo this
          // session wrote into + which identity fields. Compare against what the
          // visitor actually said vs what the bot spoke (write-amplification check).
          const _wid = (tags.intent.identity ?? {}) as Record<string, unknown>;
          log.info(
            {
              evt: 'pii_diag',
              phase: 'write',
              source: 'voice',
              sessionId,
              visitorId,
              wrote: {
                name: Boolean(_wid.name),
                phone: Boolean(_wid.phone),
                email: Boolean(_wid.email),
                address: Boolean(_wid.address),
              },
            },
            'PII-DIAG write',
          );
        }
        log.info(
          { sessionId, turns: tags.turns, intent: tags.intent?.intent },
          'conversationCompleted emitted',
        );
      } catch (err) {
        log.error({ err, sessionId }, 'conversationCompleted insert failed');
      }
    };
    room.addShutdownCallback(emitConversationRecord);

    room.onDisconnected(() => {
      clearInterval(tickInterval);
      metrics.flush();
      gemini.close().catch(() => {});
      // Closing the row is best-effort — the attribution path treats a null
      // ended_at as "still active" and sorts those ahead of ended rows.
      sessionStore
        .closeSession({ sessionId })
        .catch((err) => log.warn({ err, sessionId }, 'closeSession failed'));
      log.info({ sessionId }, 'voice-agent job ended');
    });
}

const agentDefinition = defineAgent({
  entry: async (job: JobContext) => {
    const tEntry = Date.now();
    await job.connect();
    await runVoiceSession(createLiveKitVoiceRoom(job), { tEntry, tConnected: Date.now() });
  },
});

export default agentDefinition;

export function startWorker(): void {
  cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url) }));
}
