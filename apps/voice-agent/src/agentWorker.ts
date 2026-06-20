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
import { and, asc, eq, isNull } from 'drizzle-orm';
import { Redis } from 'ioredis';
import {
  NoOpWSTransport,
  createConversationRecorder,
  decodeWidgetMessage,
  loadSession,
  runTurn,
  saveSession as saveSessionAgent,
  stripToolSyntax,
  type RecommendationStore,
  type SessionStore,
} from '@shoppingmate/agent';
import { InMemorySessionState, getAdapter } from '@shoppingmate/adapters';
import { db, schema, submitConsultationRequest } from '@shoppingmate/db';
import { type ChatFn, extractCheckoutDetails, extractContactDetails } from '@shoppingmate/agent';
import { chat, childLogger, env as sharedEnv } from '@shoppingmate/shared';
import { createBridge } from './bridge.js';
import { createSessionCaps } from './caps.js';
import { createDataChannel } from './dataChannel.js';
import { createMetricsLedger, defaultSink } from './metrics.js';
import { voiceEnv } from './env.js';
import { createGeminiSdkTransport } from './geminiSdkTransport.js';
import { createGeminiSession } from './geminiSession.js';
import { resolveVoiceContext } from './persona.js';

const log = childLogger({ mod: 'agent-worker' });

// Detects a clear "take me to checkout" intent in a voice transcript. Used to
// navigate deterministically (independent of the side-channel LLM + abort flag)
// so the page actually moves when the bot says it's heading to checkout. Kept
// strict to avoid false navigations on passing mentions ("what's the checkout
// process?" → false). Exported for unit testing.
export function wantsCheckoutNavigation(text: string): boolean {
  const t = (text ?? '').trim().toLowerCase();
  if (!t) return false;
  // Passing/question mentions should NOT navigate.
  if (/\b(what|how|when|where|why|is|does|do|can i|the)\b.*\bcheck\s?out\b.*\?/.test(t)) return false;
  return (
    /^check\s?out[.!?]*$/.test(t) ||
    /\bcheck\s?out\b\s*(now|please)\b/.test(t) ||
    /\b(take me to|go to|proceed to|proceed|head to|bring me to|let'?s|ready to|want to|wanna|can we|move to|navigate to)\b[\s\w']*\bcheck\s?out\b/.test(t)
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
    /\b(go ahead|proceed|do it|that'?s correct|looks good|all correct|that is correct|sounds good)\b/.test(t) ||
    /\b(yes|yeah|yep|sure|haan|haa|ha|bilkul|theek hai|thik hai|kar do|kardo|kar dijiye|place kar)\b[\s,.!]*(please|pls|go|placeit|kar do|do it)?\s*$/.test(t) ||
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
    /\b(contact form|contact us|contact page|get in touch|send us a message|reach out to)\b/.test(t) ||
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
  return (
    /\bputting\b[\s\w']*\b(order|through)\b/.test(t) ||
    /\bplacing\b[\s\w']*\border\b/.test(t) ||
    /\border\b[\s\w']*\bthrough\b/.test(t) ||
    /\bputting it through\b/.test(t) ||
    /\bplace (your |the )?order now\b/.test(t) ||
    // New page-confirm flow: the bot says "filling that in for you now, one
    // moment" before it waits for the fill result.
    /\bfilling\b[\s\w']*\b(that|this|it|your|the|details|in)\b/.test(t) ||
    /\bfill(ing)?\b[\s\w']*\bin (for|on the page|now)\b/.test(t)
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

const agentDefinition = defineAgent({
  entry: async (job: JobContext) => {
    const tEntry = Date.now();
    await job.connect();
    const tConnected = Date.now();
    const roomName = job.room.name ?? '';
    const sessionId = roomName.replace(/^sm_/, '');
    log.info({ sessionId, roomName, ms_connect: tConnected - tEntry }, 'voice-agent job started');

    const session = await loadSession(redis(), sessionId);
    if (!session) {
      log.warn({ sessionId }, 'no session found — closing room');
      await job.room.disconnect();
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
      await job.room.disconnect();
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
    const kbText = [kbChunkText, siteGraphText].filter((s) => s.trim().length > 0).join('\n\n') || undefined;
    const demoMode = merchant.id === sharedEnv.SHOPPINGMATE_DEMO_MERCHANT_ID;

    const voice = resolveVoiceContext(
      merchant.personaId,
      { name: merchant.name, domain: merchant.domain },
      {
        kbText,
        demoMode,
        brandSummary: merchant.brandSummary ?? undefined,
        brandCategories: merchant.brandCategories ?? undefined,
      },
    );

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
    // Queue 30s — Gemini emits replies in fast bursts and the default ~1s queue
    // overflows immediately, leaving every captureFrame to fail with InvalidState.
    // Phase A: publish the empty track now so the room is ready the instant the
    // visitor clicks. Gemini-bound audio frames are pushed once Phase B opens.
    const audioSource = new AudioSource(24_000, 1, 30_000);
    const botTrack = LocalAudioTrack.createAudioTrack('sage', audioSource);
    const publishTrackP = job.room.localParticipant?.publishTrack(
      botTrack,
      new TrackPublishOptions({ source: TrackSource.SOURCE_MICROPHONE }),
    );
    await publishTrackP;
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
    job.room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
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
      if (msg.type === 'host_action_result' && bridgeRef) {
        bridgeRef.deliverHostActionResult?.({ callId: msg.callId, result: msg.result });
      }
    });

    // Phase B: wait for the widget's `start_voice` message before opening the
    // Gemini Live WS. This prevents burning Gemini $$ on visitors who land on
    // the page but never click the call button. Gemini WS handshake (~100-300ms)
    // is the only remaining cost on the click → listening path.
    // Watchdog: if no click within 5 min, close the room to free the worker.
    const startVoiceTimeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('start_voice timeout (300s)')), 300_000),
    );
    try {
      await Promise.race([startVoiceP, startVoiceTimeout]);
    } catch (err) {
      log.warn({ sessionId, err: (err as Error).message }, 'no start_voice received — closing');
      clearInterval(tickInterval);
      await job.room.disconnect();
      return;
    }
    const tStartVoice = Date.now();

    const transport = createGeminiSdkTransport();
    const gemini = createGeminiSession({
      transport,
      voiceId: voice.voiceId,
      systemInstruction: voice.systemInstruction,
    });
    await gemini.open();
    const tReady = Date.now();

    // Side-channel runtime: while Gemini Live owns the conversation audio,
    // we run the chat tool-loop in parallel on every visitor utterance so
    // host_action tools (site.navigate / site.scroll_to / site.highlight /
    // pricing.quote) can actually drive the browser from voice mode.
    // We drop the runtime's say/say_partial events — Gemini already speaks
    // and captions — and only forward tool-action events to the widget.
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
      recordMetric: async (name, tags) => {
        await db
          .insert(schema.metricEvents)
          .values({ merchantId: merchant.id, metricName: name, tags })
          .onConflictDoNothing();
      },
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
          }
        }
        if (msg.type === 'checkout_redirect') recorder.markCheckoutReached();
        dataChannel.publish(msg);
      },
      closeRoom: () => {
        job.room.disconnect().catch(() => {});
      },
      interrupt: () => gemini.interrupt(),
      caps: { recordTurn: () => caps.recordTurn() },
      recommendationStore,
    });
    bridgeRef = bridge;

    // Tell the widget the bot is online. The widget flips its tray from
    // CONNECTING → listening immediately on this signal instead of waiting
    // for the first audio frame.
    dataChannel.publish({ type: 'agent_ready' });

    // Kickoff greeting: Gemini Live native-audio is purely reactive — left alone
    // it waits for the visitor to speak first. Visitors expect the bot to greet
    // them the moment the call connects, so inject a one-shot trigger (a user
    // turn) that makes it open the conversation per its system instructions.
    // Fire-and-forget so a hiccup never blocks the session.
    const kickoff = demoMode
      ? 'The visitor just opened voice mode on shoppingmate.ai. Greet them warmly in one short sentence and offer the demo tour: pick a vertical (dog food, apparel, jewelry, electronics, or supplements).'
      : `The visitor just connected on the ${merchant.name ?? 'store'} site. Open the conversation now: greet them warmly and introduce yourself exactly as your instructions say, then ask how you can help. Keep it to a sentence or two — do not wait for them to speak first.`;
    gemini.speak(kickoff).catch((err) => log.warn({ err }, 'kickoff greeting failed'));
    log.info(
      {
        sessionId,
        ms_total: tReady - tEntry,
        ms_warm: tWarmed - tEntry,
        ms_idle: tStartVoice - tWarmed,
        ms_gemini_open: tReady - tStartVoice,
      },
      'agent_ready published',
    );

    // captureFrame returns a promise that resolves when the frame is buffered.
    // Awaiting it serializes producer→queue and prevents the burst-overflow that
    // the default fire-and-forget pattern would cause. We chain instead of
    // awaiting inline because gemini.onEvent is sync.
    let captureChain: Promise<void> = Promise.resolve();

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
    // Contact-us / inquiry form (separate from checkout + consultation).
    let contactMode = false;
    let contactFilled = false;
    const checkoutModel =
      process.env.OPENROUTER_CHECKOUT_MODEL ?? process.env.OPENROUTER_MODEL ?? 'anthropic/claude-sonnet-4.6';
    const extractChat: ChatFn = (messages) =>
      // Tiny structured reply (7 short fields) — cap output so OpenRouter doesn't
      // reserve credit for the model's 64K default and 402 on a low balance.
      chat({ model: checkoutModel, messages, responseFormat: 'json', maxTokens: 512 });
    // Inject a one-shot grounding message Gemini will voice to the visitor. It's
    // sent as a turn Gemini responds to (same channel as the kickoff greeting).
    const ground = (instruction: string) =>
      gemini.speak(instruction).catch((err) => log.warn({ err }, 'grounding speak failed'));

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
        // name/phone/address/city/state/pincode (what voice CAN capture).
        const extracted = await extractCheckoutDetails(transcript, extractChat, { requireEmail: false });
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
        // Let the checkout route mount its inputs before we fill them.
        await new Promise((r) => setTimeout(r, 700));
        const fillFields: Array<{ field: string; value: string }> = [
          { field: 'name', value: d.name },
          { field: 'phone', value: d.phone },
          { field: 'address', value: d.address },
          { field: 'pincode', value: d.pincode },
        ];
        if (d.email) fillFields.push({ field: 'email', value: d.email });
        const fill = await dispatch({ type: 'form_fill', fields: fillFields });
        const filledVals = (fill as { values?: Record<string, string> }).values ?? {};
        log.info(
          { sessionId, ok: fill.ok, filled: fill.ok ? filledVals : undefined, reason: fill.ok ? undefined : (fill as { reason?: string }).reason },
          'order completion: fill result',
        );
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
        await new Promise((r) => setTimeout(r, 700));
        const fields: Array<{ field: string; value: string }> = [
          { field: 'name', value: c.name },
          { field: 'mobile', value: c.mobile },
        ];
        if (c.email) fields.push({ field: 'email', value: c.email });
        if (c.subject) fields.push({ field: 'subject', value: c.subject });
        if (c.message) fields.push({ field: 'message', value: c.message });
        const fill = await dispatch({ type: 'form_fill', fields });
        const vals = (fill as { values?: Record<string, string> }).values ?? {};
        log.info(
          { sessionId, ok: fill.ok, filled: fill.ok ? vals : undefined, reason: fill.ok ? undefined : (fill as { reason?: string }).reason },
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
        bridge
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
        if (merchant.siteGraphEnabled && bridge.dispatchHostAction && wantsCheckoutNavigation(e.text)) {
          checkoutEntered = true;
          void bridge
            .dispatchHostAction({ type: 'navigate', path: '/checkout' })
            .catch((err) => log.warn({ err }, 'deterministic checkout nav failed'));
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
        if (merchant.siteGraphEnabled && wantsOrderConfirmation(e.text)) {
          if (contactMode && !contactFilled) {
            log.info({ sessionId, text: e.text }, 'contact fill: confirmation detected → filling');
            void completeContactForm();
          } else if (checkoutEntered && !orderPlaced) {
            log.info({ sessionId, text: e.text }, 'order completion: confirmation detected → completing');
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
        const clean = stripToolSyntax(e.text);
        if (clean.trim().length > 0) {
          dataChannel.publish({ type: 'say', text: clean });
          recorder.addTurn('agent', clean);
          // Feed Gemini's spoken turn to the side-channel executor so it reasons
          // over the real dialogue (and can map answers→fields for checkout.fill).
          bridge.noteAssistantTurn(clean);
          // Reliable completion trigger: when Gemini narrates that it's placing
          // the order ("putting your order through, one moment"), run the real
          // deterministic completion. More robust than matching the visitor's
          // multilingual "yes" — and it's exactly when Gemini is about to wait
          // for the system outcome, so it stays silent until we ground it.
          if (merchant.siteGraphEnabled && geminiSignalsPlacement(clean)) {
            if (contactMode && !contactFilled) {
              log.info({ sessionId }, 'contact fill: placement narration detected → filling');
              void completeContactForm();
            } else if (checkoutEntered && !orderPlaced) {
              log.info({ sessionId }, 'order completion: placement narration detected → completing');
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
        // Copy: AudioFrame keeps the buffer; the underlying Buffer may be reused.
        const pcm = new Int16Array(view);
        const frame = new AudioFrame(pcm, 24_000, 1, samples);
        captureChain = captureChain
          .then(() => audioSource.captureFrame(frame))
          .catch((err) => log.warn({ err }, 'captureFrame failed'));
      } else if (e.type === 'interrupted') {
        // Visitor barged in — drop bot audio still queued in the AudioSource so
        // Sage stops talking at once instead of finishing the buffered reply.
        try {
          audioSource.clearQueue();
        } catch (err) {
          log.warn({ err }, 'clearQueue on interrupt failed');
        }
        captureChain = Promise.resolve();
      } else if (e.type === 'error') {
        log.error({ err: e.error }, 'gemini transport error');
      }
    });

    const subscribedTracks = new WeakSet<object>();
    const pipeMic = (track: RemoteAudioTrack, participantIdentity: string) => {
      if (subscribedTracks.has(track as unknown as object)) return;
      subscribedTracks.add(track as unknown as object);
      log.info({ participantIdentity, sid: track.sid }, 'subscribing to mic track');
      const stream = new AudioStream(track, 16_000, 1);
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
    };

    job.room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
      if (track.kind !== TrackKind.KIND_AUDIO) return;
      pipeMic(track as RemoteAudioTrack, participant.identity);
    });

    // Catch tracks that were already subscribed before this handler attached.
    // RoomEvent.TrackSubscribed fires only for *new* subscriptions, so if the
    // visitor's mic track lands during the awaits between job.connect() and
    // here, the event is missed and Gemini never gets any audio in.
    for (const participant of job.room.remoteParticipants.values()) {
      for (const pub of participant.trackPublications.values()) {
        const track = pub.track;
        if (track && track.kind === TrackKind.KIND_AUDIO) {
          pipeMic(track as RemoteAudioTrack, participant.identity);
        }
      }
    }

    job.room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const localIdentity = job.room.localParticipant?.identity;
      const remoteSpeaking = speakers.some((p) => p.identity !== localIdentity);
      if (remoteSpeaking) gemini.interrupt();
    });

    job.room.on(RoomEvent.Disconnected, () => {
      clearInterval(tickInterval);
      metrics.flush();
      gemini.close().catch(() => {});
      // Fire-and-forget: a DB hiccup must not surface as an unhandled
      // rejection in the worker. Closing the row is best-effort — the
      // attribution path treats a null ended_at as "still active" and
      // sorts those ahead of ended rows when ranking sessions by recency.
      sessionStore
        .closeSession({ sessionId })
        .catch((err) => log.warn({ err, sessionId }, 'closeSession failed'));
      // Emit conversationCompleted (with transcript) so the dashboard's
      // Conversations page, transcript drill-down, and Conversations KPI light
      // up. Plus a voiceConversation marker for the voice-ratio KPI. Best-effort.
      const tags = recorder.finish({ mode: 'voice', nowMs: Date.now() });
      db.insert(schema.metricEvents)
        .values({ merchantId: merchant.id, metricName: 'conversationCompleted', tags })
        .then(() =>
          db.insert(schema.metricEvents).values({
            merchantId: merchant.id,
            metricName: 'voiceConversation',
            tags: { session_id: sessionId },
          }),
        )
        .catch((err) => log.warn({ err, sessionId }, 'conversationCompleted emit failed'));
      log.info({ sessionId }, 'voice-agent job ended');
    });
  },
});

export default agentDefinition;

export function startWorker(): void {
  cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url) }));
}
