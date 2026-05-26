// Mirrors packages/agent/src/types.ts and events.ts. Kept in sync via test-time
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
  | { type: 'session_end'; sessionId: string }
  | { type: 'host_action_result'; callId: string; result: HostActionResult }
  | { type: 'tour_request' }
  | { type: 'start_voice'; sessionId: string }
  | { type: 'visitor_action';
      sessionId: string;
      action: 'click' | 'route_change' | 'dwell' | 'cart_add' | 'form_focus' | 'outbound_click';
      intentKey: string | null;
      url: string;
      elementLabel: string | null;
      timestamp: number;
    };

export type AgentEvent =
  | { type: 'thinking' }
  | { type: 'say'; text: string }
  // Streaming caption update while Sage is still talking. The text is the full
  // running transcript so far, so the widget can replace its active bubble in
  // place rather than appending. A final 'say' event arrives at turn end.
  | { type: 'say_partial'; text: string }
  // Server-side ASR transcript of the visitor's own speech, echoed back from
  // the voice-agent so the widget can render it in the call transcript.
  | { type: 'user_text'; text: string }
  | { type: 'cards'; items: CardItem[] }
  | { type: 'tool_result'; toolName: string; ok: boolean; summary?: string }
  | { type: 'checkout_redirect'; url: string }
  | { type: 'cap_warning'; reason: 'turns' | 'voice_ms' | 'duration_ms'; remaining: number }
  | { type: 'end_of_turn' }
  | { type: 'session_closed'; reason: 'user' | 'cap' | 'error' }
  | { type: 'host_action_request'; callId: string; action: HostAction }
  | { type: 'persona_swap'; personaId: string }
  | { type: 'agent_warmed' }
  | { type: 'agent_ready' };

export type HostAction =
  | { type: 'navigate'; path: string }
  | { type: 'scroll_to'; intent: string }
  | { type: 'highlight'; intent: string; durationMs?: number }
  | { type: 'click'; intent: string }
  | { type: 'point_at'; intent: string }
  | { type: 'demo_click'; intent: string };

export type HostActionResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'stale_target' | 'cross_origin' | 'route_not_found' | 'timeout' };

function isValidHostAction(a: any): a is HostAction {
  if (!a || typeof a.type !== 'string') return false;
  switch (a.type) {
    case 'navigate':
      return typeof a.path === 'string';
    case 'scroll_to':
    case 'highlight':
    case 'click':
    case 'point_at':
    case 'demo_click':
      return typeof a.intent === 'string';
    default:
      return false;
  }
}

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
    case 'say_partial':
      return typeof o.text === 'string' ? { type: 'say_partial', text: o.text } : null;
    case 'user_text':
      return typeof o.text === 'string' ? { type: 'user_text', text: o.text } : null;
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
    case 'host_action_request': {
      if (typeof o.callId !== 'string' || !o.action) return null;
      const a = o.action as any;
      if (!isValidHostAction(a)) return null;
      return { type: 'host_action_request', callId: o.callId, action: a };
    }
    case 'persona_swap':
      return typeof o.personaId === 'string' ? { type: 'persona_swap', personaId: o.personaId } : null;
    case 'agent_warmed':
      return { type: 'agent_warmed' };
    case 'agent_ready':
      return { type: 'agent_ready' };
    default:
      return null;
  }
}
