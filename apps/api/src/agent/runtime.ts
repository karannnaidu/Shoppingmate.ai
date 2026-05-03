import type { Adapter, AdapterContext } from '@shoppingmate/adapters';
import type { Merchant } from '@shoppingmate/db';
import { chatTools, type ChatToolsResult } from '@shoppingmate/shared';
import { checkCaps } from './caps.js';
import { redactPii, segmentSay, stripPrices } from './postprocess.js';
import { buildSystemPrompt } from './prompts/system.js';
import { buildToolSurface, dispatchTool, type ToolResultEnvelope } from './tools.js';
import type {
  AgentEvent,
  AnthropicMessage,
  CardItem,
  SessionState,
  WidgetMessage,
} from './types.js';

const SONNET_MODEL = 'anthropic/claude-sonnet-4.6';
const MAX_TOOL_LOOP_ITERATIONS = 8;
const RETRY_LIMIT_PER_TOOL = 3;

export type RunTurnDeps = {
  loadAdapter: (merchant: Merchant, sessionId: string) => Adapter;
  saveSession: (s: SessionState) => Promise<void>;
  recordMetric: (
    name: string,
    tags: Record<string, string | number | boolean>,
    value?: number,
  ) => Promise<void>;
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
    const ack = await chatTools({
      model: SONNET_MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt(merchant) },
        ...cardTapSession.history,
        {
          role: 'user',
          content: '[the visitor just tapped to add this to the cart — acknowledge briefly]',
        },
      ],
      tools: buildToolSurface(merchant),
    });
    const { text: stripped } = stripPrices(ack.text);
    for (const segment of segmentSay(stripped)) yield { type: 'say', text: segment };
    await deps.saveSession({
      ...cardTapSession,
      turnCount: cardTapSession.turnCount + 1,
      lastTurnAt: Date.now(),
    });
    yield { type: 'end_of_turn' };
    return;
  }

  const userText = redactPii(message.text);
  const history: AnthropicMessage[] = [
    { role: 'system', content: buildSystemPrompt(merchant) },
    ...session.history,
    { role: 'user', content: userText },
  ];

  yield { type: 'thinking' };

  const tools = buildToolSurface(merchant);
  const adapter = deps.loadAdapter(merchant, session.sessionId);
  const ctx = makeCtx(merchant, session);
  const collectedCards: CardItem[] = [];
  const toolCallCounts = new Map<string, number>();

  let response: ChatToolsResult | undefined;
  for (let iter = 0; iter < MAX_TOOL_LOOP_ITERATIONS; iter += 1) {
    response = await chatTools({ model: SONNET_MODEL, messages: history, tools });
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
        envelope = await dispatchTool(adapter, ctx, call.name, args);
        await deps.recordMetric('agent.tool.invoked', {
          merchantId: merchant.id,
          sessionId: session.sessionId,
          toolName: call.name,
          ok: envelope.ok,
          latencyMs: Date.now() - start,
        });
      }
      yield { type: 'tool_result', toolName: call.name, ok: envelope.ok };
      if (
        envelope.ok &&
        (call.name === 'products.search' || call.name === 'products.get')
      ) {
        const cards = toCards(envelope.value);
        if (cards.length > 0) {
          collectedCards.push(...cards);
          yield { type: 'cards', items: cards };
        }
      }
      if (
        envelope.ok &&
        call.name === 'checkout.url' &&
        typeof envelope.value === 'string'
      ) {
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
  const { text: stripped, hits } = stripPrices(responseText);
  if (hits.length > 0) {
    await deps.recordMetric(
      'agent.say.price_stripped',
      {
        merchantId: merchant.id,
        sessionId: session.sessionId,
        pattern: hits[0]!.pattern,
      },
      hits.length,
    );
  }
  for (const segment of segmentSay(stripped)) {
    yield { type: 'say', text: segment };
  }

  const finalAssistant: AnthropicMessage = { role: 'assistant', content: responseText };
  const updated: SessionState = {
    ...session,
    history: [
      ...session.history,
      { role: 'user', content: userText },
      finalAssistant,
    ],
    turnCount: session.turnCount + 1,
    voiceMs:
      session.mode === 'voice'
        ? session.voiceMs + (Date.now() - now)
        : session.voiceMs,
    totalMs: Date.now() - session.startedAt,
    lastTurnAt: Date.now(),
  };
  await deps.saveSession(updated);
  yield { type: 'end_of_turn' };
}

function makeCtx(merchant: Merchant, session: SessionState): AdapterContext {
  return { merchant, cartToken: session.cartToken, sessionId: session.sessionId };
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
