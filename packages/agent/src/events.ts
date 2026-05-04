import type { AgentEvent, WidgetMessage } from './types.js';

export function encodeAgentEvent(ev: AgentEvent): string {
  return JSON.stringify(ev);
}

export function decodeWidgetMessage(raw: string): WidgetMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  switch (obj.type) {
    case 'user_text':
      if (typeof obj.sessionId !== 'string' || typeof obj.text !== 'string') return null;
      if (obj.mode !== 'voice' && obj.mode !== 'text') return null;
      return { type: 'user_text', sessionId: obj.sessionId, text: obj.text, mode: obj.mode };
    case 'card_tap':
      if (typeof obj.sessionId !== 'string' || typeof obj.sku !== 'string') return null;
      if (obj.action !== 'cartAdd') return null;
      return {
        type: 'card_tap',
        sessionId: obj.sessionId,
        action: 'cartAdd',
        variantId: obj.variantId == null ? null : String(obj.variantId),
        sku: obj.sku,
        qty: typeof obj.qty === 'number' ? obj.qty : 1,
      };
    case 'session_resume':
      if (typeof obj.sessionId !== 'string') return null;
      return { type: 'session_resume', sessionId: obj.sessionId };
    case 'session_end':
      if (typeof obj.sessionId !== 'string') return null;
      return { type: 'session_end', sessionId: obj.sessionId };
    default:
      return null;
  }
}
