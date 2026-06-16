import type { Adapter, AdapterContext } from '@shoppingmate/adapters';
import type { Merchant } from '@shoppingmate/db';
import { type ChatToolsResult, chatTools } from '@shoppingmate/shared';
import { checkCaps } from './caps.js';
import type { HostAction, HostActionResult } from './host-actions.js';
import { redactPii, segmentSay, stripPrices, stripToolSyntax } from './postprocess.js';
import { validateConsultationRequest } from './consultation.js';
import { type SystemPromptOpts, buildSystemPrompt } from './prompts/system.js';
import { type ToolResultEnvelope, buildToolSurface, dispatchTool, isCalmosisStitch } from './tools.js';
import type {
  AgentEvent,
  AnthropicMessage,
  CardItem,
  SessionState,
  WidgetMessage,
} from './types.js';

// Cost/quality hybrid. General chat uses the cheap model (OPENROUTER_MODEL, e.g.
// Haiku); checkout turns — where the visitor dictates contact details that must
// be captured accurately — use the precise model (OPENROUTER_CHECKOUT_MODEL,
// default Sonnet). A per-session override (smoke runs) takes precedence so
// smoke stays cheap. Both env-overridable; no code change to retune.
const CHECKOUT_SIGNAL = /\b\d{6,}\b|@[\w.-]+\.\w|\b(check\s?out|place (the |my )?order|delivery address|pin\s?code)\b/i;

export function pickTurnModel(message: WidgetMessage, sessionModel: string | undefined): string {
  if (sessionModel) return sessionModel;
  const cheap = process.env.OPENROUTER_MODEL ?? 'anthropic/claude-sonnet-4.6';
  const precise = process.env.OPENROUTER_CHECKOUT_MODEL ?? 'anthropic/claude-sonnet-4.6';
  return message.type === 'user_text' && CHECKOUT_SIGNAL.test(message.text) ? precise : cheap;
}
const MAX_TOOL_LOOP_ITERATIONS = 8;
const RETRY_LIMIT_PER_TOOL = 3;

/**
 * Persistence boundary for conversation_sessions rows. The default Postgres
 * binding lives in apps/voice-agent/src/agentWorker.ts (Plan 7 Task 11). Kept
 * out of runTurn — runtime is per-message; session lifecycle is per-job in the
 * voice worker (and per-WS in the chat path, see apps/api).
 */
export type SessionStore = {
  openSession: (args: {
    sessionId: string;
    merchantId: string;
    visitorId: string;
  }) => Promise<void>;
  closeSession: (args: { sessionId: string }) => Promise<void>;
};

/**
 * Persistence boundary for recommendation_events rows. Wired in Task 12 from
 * the voice/chat surfaces that emit cards (`mentioned` | `highlighted`) and
 * card_tap (`clicked`). Exported here so call-sites import a single shape.
 */
export type RecommendationStore = {
  recordRecommendation: (args: {
    sessionId: string;
    sku: string;
    kind: 'mentioned' | 'highlighted' | 'clicked';
  }) => Promise<void>;
};

/**
 * Map a tool name + args to a recommendation row. Returns null when the tool
 * call does not name a SKU we should attribute against (e.g. products.search
 * is the model exploring, not recommending). Currently only pricing.quote
 * carries a SKU-shaped arg in its schema — site.highlight and site.click take
 * `intent`, not `sku`. Kept file-private; the tool→SKU mapping is a runtime
 * concern, not a public API.
 */
function extractSkuFromToolCall(
  toolName: string,
  args: Record<string, unknown>,
): { sku: string; kind: 'mentioned' | 'highlighted' | 'clicked' } | null {
  if (toolName === 'pricing.quote' && typeof args.plan_id === 'string' && args.plan_id.length > 0) {
    return { sku: args.plan_id, kind: 'mentioned' };
  }
  if (toolName === 'site.highlight' && typeof args.sku === 'string' && args.sku.length > 0) {
    return { sku: args.sku, kind: 'highlighted' };
  }
  if (toolName === 'site.click' && typeof args.sku === 'string' && args.sku.length > 0) {
    return { sku: args.sku, kind: 'clicked' };
  }
  return null;
}

export type RunTurnDeps = {
  loadAdapter: (merchant: Merchant, sessionId: string) => Adapter;
  saveSession: (s: SessionState) => Promise<void>;
  recordMetric: (
    name: string,
    tags: Record<string, string | number | boolean>,
    value?: number,
  ) => Promise<void>;
  // Optional override for chatTools — used by fixture-driven CLI replay so the
  // runner can inject a queued mock impl without depending on vitest's module
  // mocking. Defaults to the shared `chatTools` import (which existing tests
  // continue to mock via `vi.mock('@shoppingmate/shared')`).
  chatToolsImpl?: typeof chatTools;
  // Optional fetcher for system-prompt opts (KB text, demo-mode flag). When
  // omitted, buildSystemPrompt runs with no KB text and demoMode=false — the
  // pre-Phase-2 behavior tests rely on.
  loadPromptOpts?: (merchant: Merchant) => Promise<SystemPromptOpts>;
  // Optional dispatcher for site.* host actions (navigations, scrolls, etc.).
  // When omitted, site.* calls return an unsupported envelope.
  dispatchHostAction?: (action: HostAction) => Promise<HostActionResult>;
  // Optional sink for recommendation_events. When the model invokes a tool
  // that names a SKU (pricing.quote plan id today; site.highlight / site.click
  // when they grow `sku` args), runTurn fire-and-forgets a row through here
  // so attributeOrder can join assisted attribution on Shopify webhooks.
  recommendationStore?: RecommendationStore;
  // Persist + notify boundary for consultation.request (Calmosis). Wired in
  // apps/api (text) and apps/voice-agent (voice). When omitted the tool returns
  // an unsupported envelope (dev guard; never in prod).
  submitConsultation?: (req: {
    name: string;
    age: number;
    condition: string | null;
    phoneCountryCode: string;
    phone: string;
    merchantId: string;
    sessionId: string;
  }) => Promise<{ ok: true } | { ok: false; reason: string }>;
};

export async function* runTurn(
  deps: RunTurnDeps,
  merchant: Merchant,
  session: SessionState,
  message: WidgetMessage,
): AsyncGenerator<AgentEvent, void, void> {
  if (message.type !== 'user_text' && message.type !== 'card_tap') {
    return;
  }

  const callChatTools = deps.chatToolsImpl ?? chatTools;
  const promptOpts = deps.loadPromptOpts ? await deps.loadPromptOpts(merchant) : {};
  // Default to Sonnet; a session may carry a cheap-model override for smoke runs.
  const turnModel = pickTurnModel(message, session.model);
  const now = Date.now();
  const cap = checkCaps(session, session.mode, now);

  if (cap.status === 'cap') {
    yield { type: 'say', text: gracefulCloseText(cap.reason) };
    if (session.cartToken) {
      const adapter = deps.loadAdapter(merchant, session.sessionId);
      const url = await adapter.checkoutUrl(makeCtx(merchant, session));
      if (url.kind === 'ok') yield { type: 'checkout_redirect', url: url.value };
    }
    yield { type: 'session_closed', reason: 'cap' };
    await deps.recordMetric('agent.cap.hit', {
      merchantId: merchant.id,
      sessionId: session.sessionId,
      cap: cap.reason,
    });
    return;
  }

  if (cap.status === 'warning') {
    yield { type: 'cap_warning', reason: cap.reason, remaining: cap.remaining };
  }

  if (message.type === 'card_tap') {
    const ctx2 = makeCtx(merchant, session);
    const adapter2 = deps.loadAdapter(merchant, session.sessionId);
    const envelope = await dispatchTool(adapter2, ctx2, 'cart.add', {
      sku: message.sku,
      variantId: message.variantId,
      qty: message.qty,
    });
    yield { type: 'tool_result', toolName: 'cart.add', ok: envelope.ok };
    let cardTapSession: SessionState = session;
    if (envelope.ok && envelope.value && typeof envelope.value === 'object') {
      const v = envelope.value as { cartToken?: string };
      if (v.cartToken) cardTapSession = { ...cardTapSession, cartToken: v.cartToken };
    }
    const synthCallId = `tap_${Date.now()}`;
    cardTapSession = {
      ...cardTapSession,
      history: [
        ...cardTapSession.history,
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: synthCallId,
              type: 'function',
              function: {
                name: 'cart.add',
                arguments: JSON.stringify({
                  sku: message.sku,
                  variantId: message.variantId,
                  qty: message.qty,
                }),
              },
            },
          ],
        },
        { role: 'tool', tool_call_id: synthCallId, content: JSON.stringify(envelope) },
      ],
    };
    const ackArgs = {
      model: turnModel,
      messages: [
        { role: 'system' as const, content: buildSystemPrompt(merchant, promptOpts) },
        ...cardTapSession.history,
        {
          role: 'user' as const,
          content: '[the visitor just tapped to add this to the cart — acknowledge briefly]',
        },
      ],
      tools: buildToolSurface(merchant),
    };
    let ack: ChatToolsResult | undefined;
    let ackFirstFailed = false;
    try {
      ack = await callChatTools(ackArgs);
    } catch (err1) {
      const e1 = err1 as Error;
      ackFirstFailed = true;
      await deps.recordMetric('agent.sonnet.error', {
        merchantId: merchant.id,
        sessionId: session.sessionId,
        errorType: classifyError(e1),
        retryCount: 0,
      });
      try {
        ack = await callChatTools(ackArgs);
      } catch (err2) {
        const e2 = err2 as Error;
        await deps.recordMetric('agent.sonnet.error', {
          merchantId: merchant.id,
          sessionId: session.sessionId,
          errorType: classifyError(e2),
          retryCount: 1,
        });
        yield {
          type: 'say',
          text: "Sorry — I'm having trouble reaching my brain. Try again in a moment?",
        };
        yield { type: 'end_of_turn' };
        return;
      }
    }
    if (ackFirstFailed) {
      yield { type: 'say', text: 'Hold on a sec…' };
    }
    const { text: stripped } = stripPrices(stripToolSyntax(ack.text));
    for (const segment of segmentSay(stripped)) yield { type: 'say', text: segment };
    await deps.saveSession({
      ...cardTapSession,
      turnCount: cardTapSession.turnCount + 1,
      lastTurnAt: Date.now(),
    });
    yield { type: 'end_of_turn' };
    return;
  }

  // Transient PII: the model needs the visitor's raw words this turn (so it can
  // read a dictated phone number into consultation.request), but we never PERSIST
  // raw PII — stored history keeps the redacted form.
  const redactedUserText = redactPii(message.text);
  const history: AnthropicMessage[] = [
    { role: 'system', content: buildSystemPrompt(merchant, promptOpts) },
    ...session.history,
    { role: 'user', content: message.text },
  ];

  yield { type: 'thinking' };

  const tools = buildToolSurface(merchant);
  const adapter = deps.loadAdapter(merchant, session.sessionId);
  const ctx = makeCtx(merchant, session);
  const collectedCards: CardItem[] = [];
  const toolCallCounts = new Map<string, number>();
  const accumulatedAllowedTokens: string[] = [...session.allowedSpeechTokens];
  // Bliss Club is a membership with no product card, so the bot must be allowed
  // to speak its price (₹299) directly — otherwise stripPrices() rewrites it to
  // the misleading "the price on the card" (there is no card for the membership).
  if (isCalmosisStitch(merchant)) {
    accumulatedAllowedTokens.push('₹299', '299');
  }

  let response: ChatToolsResult | undefined;
  for (let iter = 0; iter < MAX_TOOL_LOOP_ITERATIONS; iter += 1) {
    let attemptResult: ChatToolsResult | undefined;
    let firstFailed = false;
    try {
      attemptResult = await callChatTools({ model: turnModel, messages: history, tools });
    } catch (err1) {
      const e1 = err1 as Error;
      firstFailed = true;
      await deps.recordMetric('agent.sonnet.error', {
        merchantId: merchant.id,
        sessionId: session.sessionId,
        errorType: classifyError(e1),
        retryCount: 0,
      });
      try {
        attemptResult = await callChatTools({ model: turnModel, messages: history, tools });
      } catch (err2) {
        const e2 = err2 as Error;
        await deps.recordMetric('agent.sonnet.error', {
          merchantId: merchant.id,
          sessionId: session.sessionId,
          errorType: classifyError(e2),
          retryCount: 1,
        });
        yield {
          type: 'say',
          text: "Sorry — I'm having trouble reaching my brain. Try again in a moment?",
        };
        yield { type: 'end_of_turn' };
        return;
      }
    }
    if (firstFailed) {
      yield { type: 'say', text: 'Hold on a sec…' };
    }
    response = attemptResult;
    if (response.toolCalls.length === 0) break;
    history.push({
      role: 'assistant',
      content: response.text || null,
      tool_calls: response.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: tc.argumentsJson },
      })),
    });
    for (const call of response.toolCalls) {
      const key = `${call.name}:${call.argumentsJson}`;
      const prev = toolCallCounts.get(key) ?? 0;
      toolCallCounts.set(key, prev + 1);
      let envelope: ToolResultEnvelope;
      if (prev >= RETRY_LIMIT_PER_TOOL) {
        envelope = { ok: false, kind: 'retry_exhausted' };
        await deps.recordMetric('agent.tool.retry_exhausted', {
          merchantId: merchant.id,
          sessionId: session.sessionId,
          toolName: call.name,
        });
      } else {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.argumentsJson) as Record<string, unknown>;
        } catch {
          // bad arguments JSON from the model — surface as unsupported via dispatchTool
        }
        const start = Date.now();
        const isCalmosisCart =
          isCalmosisStitch(merchant) &&
          (call.name === 'cart.add' ||
            call.name === 'cart.open' ||
            call.name === 'cart.update' ||
            call.name === 'cart.clear' ||
            call.name === 'coupon.apply' ||
            call.name === 'checkout.fill' ||
            call.name === 'checkout.place' ||
            call.name === 'checkout.state');
        if (call.name === 'consultation.request') {
          const v = validateConsultationRequest(args);
          if (!v.ok) {
            envelope = { ok: false, kind: 'unsupported', reason: v.reason };
          } else if (!deps.submitConsultation) {
            envelope = { ok: false, kind: 'unsupported', reason: 'consultation_not_wired' };
          } else {
            const res = await deps.submitConsultation({
              ...v.value,
              merchantId: merchant.id,
              sessionId: session.sessionId,
            });
            envelope = res.ok
              ? { ok: true, value: { submitted: true } }
              : { ok: false, kind: 'unsupported', reason: res.reason };
            if (res.ok) {
              await deps.recordMetric('consultation.requested', {
                merchantId: merchant.id,
                sessionId: session.sessionId,
              });
            }
          }
          // NOTE: the shared `agent.tool.invoked` emit below fires for this tool too.
        } else if (
          call.name === 'site.navigate' ||
          call.name === 'site.scroll_to' ||
          call.name === 'site.highlight' ||
          call.name === 'site.click' ||
          call.name === 'site.point_at' ||
          call.name === 'site.demo_click' ||
          isCalmosisCart
        ) {
          if (!deps.dispatchHostAction) {
            envelope = { ok: false, kind: 'unsupported', reason: 'host_action_dispatcher_missing' };
          } else {
            const action = toHostAction(call.name, args);
            const result = await deps.dispatchHostAction(action);
            envelope = result.ok
              ? { ok: true, value: result }
              : { ok: false, kind: 'unsupported', reason: result.reason };
            // Funnel metrics — emitted at the shared dispatch chokepoint so both
            // the text WS and the voice bridge inherit them. Only on success so
            // the funnel reflects real bot-driven cart/checkout progress.
            if (result.ok) {
              if (action.type === 'cart_add') {
                await deps.recordMetric('cart.add', {
                  merchantId: merchant.id,
                  sessionId: session.sessionId,
                  sku: action.sku,
                  qty: action.qty,
                });
              }
              if (action.type === 'navigate' && action.path.includes('/checkout')) {
                await deps.recordMetric('checkout.reached', {
                  merchantId: merchant.id,
                  sessionId: session.sessionId,
                  source: 'navigate',
                });
              }
              if (action.type === 'checkout_place') {
                await deps.recordMetric('checkout.placed', {
                  merchantId: merchant.id,
                  sessionId: session.sessionId,
                });
              }
            }
          }
        } else {
          envelope = await dispatchTool(adapter, ctx, call.name, args);
        }
        if (envelope.ok && call.name === 'pricing.quote') {
          const v = envelope.value as { speech?: string };
          if (typeof v.speech === 'string') {
            accumulatedAllowedTokens.push(v.speech);
          }
        }
        if (call.name === 'pricing.quote') {
          await deps.recordMetric('pricing.quote.called', {
            merchantId: merchant.id,
            sessionId: session.sessionId,
            planId: String(args.plan_id ?? 'unknown'),
          });
        }
        // Log recommendation_events on intent (not outcome): the model named
        // a SKU to the visitor whether or not the envelope succeeded. Fire-
        // and-forget so a DB hiccup never blocks the tool loop — observability
        // for these losses lands in Task 18.
        const rec = extractSkuFromToolCall(call.name, args);
        if (rec && deps.recommendationStore) {
          void deps.recommendationStore
            .recordRecommendation({ sessionId: session.sessionId, sku: rec.sku, kind: rec.kind })
            .catch(() => {});
        }
        await deps.recordMetric('agent.tool.invoked', {
          merchantId: merchant.id,
          sessionId: session.sessionId,
          toolName: call.name,
          ok: envelope.ok,
          latencyMs: Date.now() - start,
        });
      }
      yield { type: 'tool_result', toolName: call.name, ok: envelope.ok };
      if (envelope.ok && (call.name === 'products.search' || call.name === 'products.get')) {
        const cards = toCards(envelope.value);
        if (cards.length > 0) {
          collectedCards.push(...cards);
          yield { type: 'cards', items: cards };
        }
        // Demo-mode tour tracking: when shoppingmate.ai's own widget is in
        // demoMode and the visitor picks a vertical, the model issues a
        // products.search whose query matches a known vertical keyword. This
        // is the cleanest signal we have for "tour engagement" without adding
        // a new agent tool.
        if (promptOpts.demoMode && call.name === 'products.search' && cards.length > 0) {
          const vertical = matchTourVertical(call.argumentsJson);
          if (vertical) {
            await deps.recordMetric('agent.demo.tour_started', {
              merchantId: merchant.id,
              sessionId: session.sessionId,
              vertical,
              cardsShown: cards.length,
            });
          }
        }
      }
      if (envelope.ok && call.name === 'checkout.url' && typeof envelope.value === 'string') {
        await deps.recordMetric('checkout.reached', {
          merchantId: merchant.id,
          sessionId: session.sessionId,
          source: 'checkout_url',
        });
        yield { type: 'checkout_redirect', url: envelope.value };
      }
      history.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(envelope),
      });
    }
  }

  const responseText = response?.text ?? '';
  const { text: stripped, hits } = stripPrices(stripToolSyntax(responseText), new Set(accumulatedAllowedTokens));
  const firstHit = hits[0];
  if (firstHit) {
    await deps.recordMetric(
      'agent.say.price_stripped',
      {
        merchantId: merchant.id,
        sessionId: session.sessionId,
        pattern: firstHit.pattern,
      },
      hits.length,
    );
  }
  if (accumulatedAllowedTokens.length > 0 && hits.length > 0) {
    await deps.recordMetric(
      'pricing.quote.rephrased_blocked',
      { merchantId: merchant.id, sessionId: session.sessionId },
      hits.length,
    );
  }
  for (const segment of segmentSay(stripped)) {
    yield { type: 'say', text: segment };
  }

  const finalAssistant: AnthropicMessage = { role: 'assistant', content: responseText };
  const updated: SessionState = {
    ...session,
    history: [...session.history, { role: 'user', content: redactedUserText }, finalAssistant],
    turnCount: session.turnCount + 1,
    voiceMs: session.mode === 'voice' ? session.voiceMs + (Date.now() - now) : session.voiceMs,
    totalMs: Date.now() - session.startedAt,
    lastTurnAt: Date.now(),
    allowedSpeechTokens: accumulatedAllowedTokens,
  };
  await deps.saveSession(updated);
  yield { type: 'end_of_turn' };
}

function makeCtx(merchant: Merchant, session: SessionState): AdapterContext {
  return { merchant, cartToken: session.cartToken, sessionId: session.sessionId };
}

// Verticals available in the SM-XPK2EN showcase catalog. Matching is loose
// because the model often paraphrases the visitor's choice ("dog food" →
// "kibble for dogs", "supplements" → "vitamins"). Returns the canonical
// vertical name for metric tagging, or null if the search wasn't a tour pick.
const TOUR_VERTICAL_KEYWORDS: Record<string, string[]> = {
  'dog food': ['dog food', 'dog', 'kibble', 'puppy', 'pet food'],
  apparel: ['apparel', 'clothing', 'shirt', 'jeans', 'sweater', 'hoodie', 'trouser'],
  jewelry: ['jewelry', 'jewellery', 'ring', 'earring', 'necklace', 'bracelet', 'pendant'],
  electronics: ['electronics', 'headphone', 'webcam', 'keyboard', 'ssd', 'lamp', 'gadget'],
  supplements: ['supplement', 'vitamin', 'protein', 'omega', 'magnesium', 'greens'],
};

function matchTourVertical(argumentsJson: string): string | null {
  let q = '';
  try {
    const args = JSON.parse(argumentsJson) as { query?: unknown };
    if (typeof args.query === 'string') q = args.query.toLowerCase();
  } catch {
    return null;
  }
  if (!q) return null;
  for (const [vertical, keywords] of Object.entries(TOUR_VERTICAL_KEYWORDS)) {
    if (keywords.some((k) => q.includes(k))) return vertical;
  }
  return null;
}

function classifyError(err: Error): string {
  const m = err.message.toLowerCase();
  if (m.includes('abort') || m.includes('timeout')) return 'timeout';
  if (m.includes('429')) return 'rate_limit';
  if (m.match(/\b5\d{2}\b/)) return 'upstream_5xx';
  if (m.match(/\b4\d{2}\b/)) return 'client_4xx';
  return 'other';
}

function gracefulCloseText(reason: 'turns' | 'voice_ms' | 'duration_ms'): string {
  if (reason === 'turns') return "We've covered a lot — should I send you to checkout?";
  if (reason === 'voice_ms') return "We've been chatting a while — let me send you to checkout.";
  return 'I want to wrap up before we run too long — sending you to checkout.';
}

function toCards(value: unknown): CardItem[] {
  if (Array.isArray(value)) {
    return value.map(productToCard).filter((c): c is CardItem => c !== null);
  }
  if (value && typeof value === 'object') {
    const single = productToCard(value);
    return single ? [single] : [];
  }
  return [];
}

function productToCard(p: unknown): CardItem | null {
  if (!p || typeof p !== 'object') return null;
  const obj = p as Record<string, unknown>;
  if (typeof obj.sku !== 'string' || typeof obj.title !== 'string') return null;
  const priceCents = typeof obj.priceCents === 'number' ? obj.priceCents : null;
  const currency = typeof obj.currency === 'string' ? obj.currency : 'USD';
  return {
    image: typeof obj.imageUrl === 'string' ? obj.imageUrl : null,
    title: obj.title,
    priceFormatted: priceCents == null ? '' : formatPrice(priceCents, currency),
    variantId: null,
    sku: obj.sku,
    productUrl: typeof obj.productUrl === 'string' ? obj.productUrl : '',
  };
}

function formatPrice(cents: number, currency: string): string {
  const amount = (cents / 100).toFixed(2);
  if (currency === 'INR') return `\u20B9${amount}`;
  if (currency === 'USD') return `$${amount}`;
  return `${currency} ${amount}`;
}

function toHostAction(name: string, args: Record<string, unknown>): HostAction {
  switch (name) {
    case 'site.navigate':
      return { type: 'navigate', path: String(args.path ?? '') };
    case 'site.scroll_to':
      return { type: 'scroll_to', intent: String(args.intent ?? '') };
    case 'site.highlight':
      return {
        type: 'highlight',
        intent: String(args.intent ?? ''),
        durationMs: typeof args.duration_ms === 'number' ? args.duration_ms : undefined,
      };
    case 'site.click':
      return { type: 'click', intent: String(args.intent ?? '') };
    case 'site.point_at':
      return { type: 'point_at', intent: String(args.intent ?? '') };
    case 'site.demo_click':
      return { type: 'demo_click', intent: String(args.intent ?? '') };
    case 'cart.add':
      return { type: 'cart_add', sku: String(args.sku ?? ''), qty: Number(args.qty) || 1 };
    case 'cart.open':
      return { type: 'open_cart' };
    case 'cart.update':
      return { type: 'cart_set_qty', sku: String(args.sku ?? ''), qty: Math.max(0, Number(args.qty) || 0) };
    case 'cart.clear':
      return { type: 'cart_clear' };
    case 'coupon.apply':
      return { type: 'apply_coupon', code: String(args.code ?? '') };
    case 'checkout.fill':
      return {
        type: 'checkout_fill',
        details: {
          name: String(args.name ?? ''),
          phone: String(args.phone ?? ''),
          email: String(args.email ?? ''),
          address: String(args.address ?? ''),
          city: String(args.city ?? ''),
          state: String(args.state ?? ''),
          pincode: String(args.pincode ?? ''),
          payment: args.payment === 'prepaid' ? 'prepaid' : 'cod',
        },
      };
    case 'checkout.place':
      return { type: 'checkout_place' };
    case 'checkout.state':
      return { type: 'checkout_state' };
    default:
      throw new Error(`toHostAction: unknown site tool ${name}`);
  }
}
