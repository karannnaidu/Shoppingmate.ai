import { stripPrices } from './postprocess.js';
import type { AgentEvent, AnthropicMessage, CardItem, SessionState } from './types.js';

export function* replaySession(session: SessionState): Generator<AgentEvent, void, void> {
  for (const m of session.history) {
    if (isAssistant(m) && typeof m.content === 'string' && m.content) {
      yield { type: 'say', text: stripPrices(m.content).text };
    } else if (isTool(m)) {
      const content = safeParse(m.content);
      if (content && content.ok && Array.isArray(content.value)) {
        const cards: CardItem[] = content.value
          .map((p: unknown) => productLikeToCard(p))
          .filter((c: CardItem | null): c is CardItem => c !== null);
        if (cards.length > 0) yield { type: 'cards', items: cards };
      }
    }
  }
}

function isAssistant(m: AnthropicMessage): m is Extract<AnthropicMessage, { role: 'assistant' }> {
  return (m as { role?: string }).role === 'assistant';
}

function isTool(m: AnthropicMessage): m is Extract<AnthropicMessage, { role: 'tool' }> {
  return (m as { role?: string }).role === 'tool';
}

function safeParse(s: string): { ok: boolean; value?: unknown } | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function productLikeToCard(p: unknown): CardItem | null {
  if (!p || typeof p !== 'object') return null;
  const obj = p as Record<string, unknown>;
  if (typeof obj.sku !== 'string' || typeof obj.title !== 'string') return null;
  const priceCents = typeof obj.priceCents === 'number' ? obj.priceCents : null;
  const currency = typeof obj.currency === 'string' ? obj.currency : 'USD';
  return {
    image: typeof obj.imageUrl === 'string' ? obj.imageUrl : null,
    title: obj.title,
    priceFormatted: priceCents == null ? '' : `${currency} ${(priceCents / 100).toFixed(2)}`,
    variantId: null,
    sku: obj.sku,
    productUrl: typeof obj.productUrl === 'string' ? obj.productUrl : '',
  };
}
