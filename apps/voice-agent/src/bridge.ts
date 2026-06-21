import type {
  AgentEvent,
  HostAction,
  HostActionResult,
  RecommendationStore,
  RunTurnDeps,
  SessionState,
  SystemPromptOpts,
  WidgetMessage,
} from '@shoppingmate/agent';
import type { Adapter } from '@shoppingmate/adapters';
import type { Merchant } from '@shoppingmate/db';
import { childLogger } from '@shoppingmate/shared';
import { DEMO_TOUR_ENABLED } from './env.js';

const log = childLogger({ mod: 'bridge' });

export type DataChannelMessage =
  | { type: 'user_text'; text: string }
  | { type: 'say'; text: string }
  | { type: 'say_partial'; text: string }
  | { type: 'cards'; items: unknown[] }
  | { type: 'checkout_redirect'; url: string }
  | { type: 'cap_warning'; remaining: number }
  | { type: 'session_closed'; reason: string }
  | { type: 'host_action_request'; callId: string; action: HostAction }
  | { type: 'persona_swap'; personaId: string }
  | { type: 'agent_warmed' }
  | { type: 'agent_ready' };

export type BridgeDeps = {
  sessionId: string;
  merchantId: string;
  runTurn: (
    deps: RunTurnDeps,
    merchant: Merchant,
    session: SessionState,
    msg: WidgetMessage,
  ) => AsyncGenerator<AgentEvent, void, void>;
  loadMerchant: (id: string) => Promise<Merchant>;
  loadSession: (sessionId: string) => Promise<SessionState>;
  saveSession: (s: SessionState) => Promise<void>;
  recordMetric: (
    name: string,
    tags: Record<string, string | number | boolean>,
    value?: number,
  ) => Promise<void>;
  loadAdapter: (m: Merchant, sid: string) => Adapter;
  // Brand KB + site-graph map + demo flag for the side-channel system prompt.
  // Without this the side-channel Sonnet runs blind — no product names (so it
  // searches with terms that don't match the catalog → not_found → no cards/no
  // price) and no site map (so site.navigate guesses paths). The text-chat path
  // passes this; voice must too. See apps/api loadPromptOpts.
  loadPromptOpts?: (m: Merchant) => Promise<SystemPromptOpts>;
  speak: (text: string) => Promise<void>;
  publishData: (msg: DataChannelMessage) => void;
  closeRoom: () => void;
  interrupt: () => void;
  caps?: { recordTurn: () => void };
  // Optional sink for recommendation_events. Threaded into RunTurnDeps so the
  // chat tool-loop can fire-and-forget rows when the model names a SKU.
  recommendationStore?: RecommendationStore;
  // Persist + notify boundary for consultation.request — threaded into RunTurnDeps.
  submitConsultation?: RunTurnDeps['submitConsultation'];
};

export type Bridge = {
  handleUserText: (text: string) => Promise<void>;
  // Record what the VOICE (Gemini) actually said, so the side-channel executor
  // reasons over the real dialogue. See voiceHistory in createBridge.
  noteAssistantTurn: (text: string) => void;
  handleBargeIn: () => void;
  dispatchHostAction?: (action: HostAction) => Promise<HostActionResult>;
  deliverHostActionResult?: (msg: { callId: string; result: HostActionResult }) => void;
  // Phase 4 — stash a live-signal steer line computed after a completed voice
  // turn; applied to session.liveSignal right before the NEXT runTurn.
  setLiveSignal: (s: string | undefined) => void;
};

const HOST_ACTION_TIMEOUT_MS = 5000;

export function createBridge(deps: BridgeDeps): Bridge {
  let aborted = false;
  // Voice has TWO brains: Gemini Live speaks to the visitor; this side-channel
  // executor is what actually calls the tools (cart/checkout/navigate). Gemini's
  // spoken turns are recorded here (via noteAssistantTurn) and the visitor's
  // turns in handleUserText, so the executor's history mirrors the REAL spoken
  // conversation. Without this it only sees the visitor's fragmented utterances
  // ("8105791728", "Bangalore 560037") with no idea which question each answers
  // — so it can't assemble a checkout.fill and the form never gets filled while
  // Gemini cheerfully says "order placed". The executor's own (suppressed)
  // replies are intentionally NOT recorded — Gemini's are the canonical voice.
  const voiceHistory: SessionState['history'] = [];
  // Phase 4 — live-signal steer for the next turn's system prompt. Set by the
  // worker's post-turn classifier; consumed in handleUserText before runTurn.
  let pendingLiveSignal: string | undefined;
  const pending = new Map<
    string,
    { resolve: (r: HostActionResult) => void; timer: ReturnType<typeof setTimeout> }
  >();
  let hostActionCounter = 0;

  const api: Bridge = {
    async handleUserText(text) {
      aborted = false;
      deps.caps?.recordTurn();
      deps.publishData({ type: 'user_text', text });

      log.info(
        { sessionId: deps.sessionId, merchantId: deps.merchantId, demoTourEnabled: DEMO_TOUR_ENABLED },
        'bridge: handleUserText start',
      );
      const merchant = await deps.loadMerchant(deps.merchantId);
      const session = await deps.loadSession(deps.sessionId);
      // Run the executor over the REAL spoken conversation (Gemini's turns +
      // the visitor's turns), not the persisted/own-reply history which diverges
      // from what the visitor actually heard. Drop any leading assistant turns
      // (e.g. the kickoff greeting) so the message list starts with a user turn.
      // runTurn appends this `text` itself, so history holds everything BEFORE it.
      let prior = [...voiceHistory];
      while (prior.length > 0 && prior[0]?.role === 'assistant') prior = prior.slice(1);
      session.history = prior;
      // Phase 4 — fold the live-signal steer (computed after the prior turn) into
      // this turn's system prompt. runtime.ts passes session.liveSignal into
      // buildSystemPrompt. Best-effort hint only; undefined leaves prompt unchanged.
      session.liveSignal = pendingLiveSignal || undefined;
      voiceHistory.push({ role: 'user', content: text });
      const widgetMsg: WidgetMessage = {
        type: 'user_text',
        sessionId: deps.sessionId,
        text,
        mode: 'voice',
      };

      const hostActionsEnabled = DEMO_TOUR_ENABLED || merchant.siteGraphEnabled;
      const runDeps: RunTurnDeps = {
        loadAdapter: deps.loadAdapter,
        saveSession: deps.saveSession,
        recordMetric: deps.recordMetric,
        loadPromptOpts: deps.loadPromptOpts,
        dispatchHostAction: hostActionsEnabled
          ? (action) => api.dispatchHostAction!(action)
          : undefined,
        recommendationStore: deps.recommendationStore,
        submitConsultation: deps.submitConsultation,
      };

      log.info({ sessionId: deps.sessionId }, 'bridge: starting runTurn');
      let eventCount = 0;
      try {
        for await (const event of deps.runTurn(runDeps, merchant, session, widgetMsg)) {
          eventCount++;
          log.info(
            { sessionId: deps.sessionId, eventType: event.type, idx: eventCount },
            'bridge: runTurn event',
          );
          if (aborted) {
            log.info(
              { sessionId: deps.sessionId },
              'bridge: abort flag set, dropping remaining events',
            );
            return;
          }
          await routeEvent(event, deps);
        }
        log.info({ sessionId: deps.sessionId, totalEvents: eventCount }, 'bridge: runTurn complete');
      } catch (err) {
        log.error({ err, sessionId: deps.sessionId }, 'runTurn failed in bridge');
        deps.publishData({ type: 'session_closed', reason: 'error' });
        deps.closeRoom();
      }
    },
    noteAssistantTurn(text) {
      const t = text.trim();
      if (t.length > 0) voiceHistory.push({ role: 'assistant', content: t });
    },
    setLiveSignal(s) {
      pendingLiveSignal = s || undefined;
    },
    handleBargeIn() {
      aborted = true;
      deps.interrupt();
      deps
        .recordMetric('voice.barge_in_succeeded', { sessionId: deps.sessionId })
        .catch(() => {});
    },
    dispatchHostAction(action) {
      return new Promise<HostActionResult>((resolve) => {
        const callId = `ha_${++hostActionCounter}_${Date.now()}`;
        log.info(
          { sessionId: deps.sessionId, callId, actionType: action.type },
          'bridge: dispatchHostAction publish',
        );
        const timer = setTimeout(() => {
          pending.delete(callId);
          log.warn({ sessionId: deps.sessionId, callId }, 'bridge: host action timed out');
          resolve({ ok: false, reason: 'timeout' });
        }, HOST_ACTION_TIMEOUT_MS);
        pending.set(callId, { resolve, timer });
        deps.publishData({ type: 'host_action_request', callId, action });
      });
    },
    deliverHostActionResult({ callId, result }) {
      const entry = pending.get(callId);
      if (!entry) return;
      clearTimeout(entry.timer);
      pending.delete(callId);
      entry.resolve(result);
    },
  };

  return api;
}

async function routeEvent(event: AgentEvent, deps: BridgeDeps): Promise<void> {
  switch (event.type) {
    case 'say':
      deps.publishData({ type: 'say', text: event.text });
      await deps.speak(event.text);
      return;
    case 'cards':
      deps.publishData({ type: 'cards', items: event.items });
      return;
    case 'checkout_redirect':
      deps.publishData({ type: 'checkout_redirect', url: event.url });
      return;
    case 'cap_warning':
      deps.publishData({ type: 'cap_warning', remaining: event.remaining });
      return;
    case 'session_closed':
      deps.publishData({ type: 'session_closed', reason: event.reason });
      deps.closeRoom();
      return;
    case 'host_action_request':
      // No-op: the actual publish happens inside dispatchHostAction (called from runtime).
      // This case exists so the AgentEvent union exhausts cleanly without falling into default-warn.
      return;
    case 'persona_swap':
      deps.publishData({ type: 'persona_swap', personaId: event.personaId });
      return;
    case 'thinking':
    case 'tool_result':
    case 'end_of_turn':
      return;
    default: {
      const t = (event as { type: string }).type;
      log.debug({ type: t }, 'bridge: ignoring unknown event');
    }
  }
}
