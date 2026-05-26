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
import { asc, eq } from 'drizzle-orm';
import { Redis } from 'ioredis';
import {
  NoOpWSTransport,
  decodeWidgetMessage,
  loadSession,
  runTurn,
  saveSession as saveSessionAgent,
} from '@shoppingmate/agent';
import { InMemorySessionState, getAdapter } from '@shoppingmate/adapters';
import { db, schema } from '@shoppingmate/db';
import { childLogger, env as sharedEnv } from '@shoppingmate/shared';
import { createBridge } from './bridge.js';
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
    // Merchant + KB queries are independent — fire in parallel to save ~150ms.
    const [merchants, kbChunks] = await Promise.all([
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
    ]);
    const merchant = merchants[0];
    if (!merchant) {
      log.warn({ merchantId: session.merchantId }, 'no merchant — closing room');
      await job.room.disconnect();
      return;
    }
    const kbText = kbChunks.length > 0 ? kbChunks.map((c) => c.text).join('\n\n') : undefined;
    const demoMode = merchant.id === sharedEnv.SHOPPINGMATE_DEMO_MERCHANT_ID;

    const voice = resolveVoiceContext(
      merchant.personaId,
      { name: merchant.name, domain: merchant.domain },
      { kbText, demoMode },
    );
    const transport = createGeminiSdkTransport();
    const gemini = createGeminiSession({
      transport,
      voiceId: voice.voiceId,
      systemInstruction: voice.systemInstruction,
    });
    // Kick off the Gemini Live WS handshake but DON'T await yet — we can
    // publish the audio track in parallel so both legs finish concurrently.
    const geminiOpen = gemini.open();

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
        const rows = await db.select().from(schema.merchants).where(eq(schema.merchants.id, id)).limit(1);
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
      loadAdapter: (m) =>
        getAdapter(m, {
          transport: new NoOpWSTransport(),
          state: new InMemorySessionState(),
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
        dataChannel.publish(msg);
      },
      closeRoom: () => {
        job.room.disconnect().catch(() => {});
      },
      interrupt: () => gemini.interrupt(),
      caps: { recordTurn: () => caps.recordTurn() },
    });

    // Visitor's widget posts host_action_result over the LiveKit data channel
    // (see widget.ts handleLiveKitData + publishWidgetMessage). Decode and
    // hand to the bridge so its pending-call promise resolves.
    job.room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
      let raw: string;
      try {
        raw = new TextDecoder().decode(payload);
      } catch {
        return;
      }
      const msg = decodeWidgetMessage(raw);
      if (!msg) return;
      if (msg.type === 'host_action_result') {
        bridge.deliverHostActionResult?.({ callId: msg.callId, result: msg.result });
      }
    });

    // Publish a local audio track so visitors hear Sage. Gemini Live native-audio
    // returns 24 kHz mono PCM16; we feed those bytes straight into AudioSource.
    // Queue 30s — Gemini emits replies in fast bursts and the default ~1s queue
    // overflows immediately, leaving every captureFrame to fail with InvalidState.
    const audioSource = new AudioSource(24_000, 1, 30_000);
    const botTrack = LocalAudioTrack.createAudioTrack('sage', audioSource);
    const publishTrackP = job.room.localParticipant?.publishTrack(
      botTrack,
      new TrackPublishOptions({ source: TrackSource.SOURCE_MICROPHONE }),
    );

    // Wait for both the Gemini WS and the audio track publish before signalling
    // ready. Either alone is insufficient: no WS = Sage can't hear; no track =
    // Sage can't be heard. Running them concurrently saves ~500ms vs sequential.
    await Promise.all([geminiOpen, publishTrackP]);

    // Tell the widget Sage is online. The widget flips its tray from
    // CONNECTING → listening immediately on this signal instead of waiting
    // for Sage's first audio frame — and we no longer inject a kickoff
    // greeting, so the visitor speaks first. That removes 2-4s of perceived
    // cold-start: greeting generation + the time Sage takes to say it.
    dataChannel.publish({ type: 'agent_ready' });

    // captureFrame returns a promise that resolves when the frame is buffered.
    // Awaiting it serializes producer→queue and prevents the burst-overflow that
    // the default fire-and-forget pattern would cause. We chain instead of
    // awaiting inline because gemini.onEvent is sync.
    let captureChain: Promise<void> = Promise.resolve();

    // Track which verticals have already had their cards shown this session.
    // Without this, every follow-up question about jewelry would re-publish
    // the same three jewelry cards — noisy and disorienting.
    const shownVerticals = new Set<string>();

    gemini.onEvent((e) => {
      if (e.type === 'final_transcript' && e.text.trim().length > 0) {
        const words = e.text.split(/\s+/).filter(Boolean).length;
        const inputSeconds = words / 3.3;
        caps.recordVoiceSeconds(inputSeconds);
        metrics.add('gemini_audio_input_seconds', inputSeconds);
        // Phase 1 design: Gemini Live owns voice conversation; the visitor's
        // transcript also goes to the widget for caption display.
        dataChannel.publish({ type: 'user_text', text: e.text });
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
      } else if (e.type === 'bot_text_partial' && e.text.trim().length > 0) {
        // Stream caption updates while the turn is still in progress. Widget
        // replaces the active agent bubble in place so text scrolls alongside
        // the audio instead of appearing only when Sage stops talking.
        dataChannel.publish({ type: 'say_partial', text: e.text });
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
        captureChain = captureChain
          .then(() => audioSource.captureFrame(frame))
          .catch((err) => log.warn({ err }, 'captureFrame failed'));
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
      log.info({ sessionId }, 'voice-agent job ended');
    });
  },
});

export default agentDefinition;

export function startWorker(): void {
  cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url) }));
}
