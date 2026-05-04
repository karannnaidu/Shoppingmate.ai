// Mirrors apps/api/src/agent/types.ts and events.ts. Kept in sync via test-time
// shape parity with the runtime codec; see test/transport-codec.test.ts.

export type Mode = 'voice' | 'text';

export type CardItem = {
  image: string | null;
  title: string;
  priceFormatted: string;
  variantId: string | null;
  sku: string;
  productUrl: string;
  badges?: string[];
};

export type WidgetMessage =
  | { type: 'user_text'; sessionId: string; text: string; mode: Mode }
  | {
      type: 'card_tap';
      sessionId: string;
      action: 'cartAdd';
      variantId: string | null;
      sku: string;
      qty: number;
    }
  | { type: 'session_resume'; sessionId: string }
  | { type: 'session_end'; sessionId: string };

export type AgentEvent =
  | { type: 'thinking' }
  | { type: 'say'; text: string }
  | { type: 'cards'; items: CardItem[] }
  | { type: 'tool_result'; toolName: string; ok: boolean; summary?: string }
  | { type: 'checkout_redirect'; url: string }
  | { type: 'cap_warning'; reason: 'turns' | 'voice_ms' | 'duration_ms'; remaining: number }
  | { type: 'end_of_turn' }
  | { type: 'session_closed'; reason: 'user' | 'cap' | 'error' };

export function encodeWidgetMessage(msg: WidgetMessage): string {
  return JSON.stringify(msg);
}

export function decodeAgentEvent(raw: string): AgentEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as Record<string, unknown>;
  switch (o.type) {
    case 'thinking':
      return { type: 'thinking' };
    case 'say':
      return typeof o.text === 'string' ? { type: 'say', text: o.text } : null;
    case 'cards':
      return Array.isArray(o.items) ? { type: 'cards', items: o.items as CardItem[] } : null;
    case 'tool_result':
      if (typeof o.toolName !== 'string' || typeof o.ok !== 'boolean') return null;
      return {
        type: 'tool_result',
        toolName: o.toolName,
        ok: o.ok,
        summary: typeof o.summary === 'string' ? o.summary : undefined,
      };
    case 'checkout_redirect':
      return typeof o.url === 'string' ? { type: 'checkout_redirect', url: o.url } : null;
    case 'cap_warning':
      if (
        (o.reason !== 'turns' && o.reason !== 'voice_ms' && o.reason !== 'duration_ms') ||
        typeof o.remaining !== 'number'
      ) {
        return null;
      }
      return { type: 'cap_warning', reason: o.reason, remaining: o.remaining };
    case 'end_of_turn':
      return { type: 'end_of_turn' };
    case 'session_closed':
      if (o.reason !== 'user' && o.reason !== 'cap' && o.reason !== 'error') return null;
      return { type: 'session_closed', reason: o.reason };
    default:
      return null;
  }
}
