import type { AgentEvent, WidgetMessage } from './types.js';
import type { HostActionResult } from './host-actions.js';

export function encodeAgentEvent(ev: AgentEvent): string {
  return JSON.stringify(ev);
}

function parseHostActionResult(value: unknown): HostActionResult | null {
  if (!value || typeof value !== 'object') return null;
  const o = value as Record<string, unknown>;
  if (o.ok === true) return { ok: true };
  if (o.ok === false && typeof o.reason === 'string') {
    const reasons: HostActionResult extends { reason: infer R } ? R[] : never = [
      'not_found',
      'stale_target',
      'cross_origin',
      'route_not_found',
      'timeout',
    ] as never;
    if ((reasons as readonly string[]).includes(o.reason)) {
      return { ok: false, reason: o.reason as Exclude<HostActionResult, { ok: true }>['reason'] };
    }
  }
  return null;
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
    case 'host_action_result': {
      if (typeof obj.callId !== 'string') return null;
      const result = parseHostActionResult(obj.result);
      if (!result) return null;
      return { type: 'host_action_result', callId: obj.callId, result };
    }
    case 'tour_request':
      return { type: 'tour_request' };
    case 'start_voice':
      if (typeof obj.sessionId !== 'string') return null;
      return { type: 'start_voice', sessionId: obj.sessionId };
    case 'visitor_action': {
      if (typeof obj.sessionId !== 'string') return null;
      const ACTIONS = ['click', 'route_change', 'dwell', 'cart_add', 'form_focus', 'outbound_click'] as const;
      if (typeof obj.action !== 'string' || !(ACTIONS as readonly string[]).includes(obj.action)) return null;
      if (typeof obj.url !== 'string') return null;
      if (typeof obj.timestamp !== 'number') return null;
      return {
        type: 'visitor_action',
        sessionId: obj.sessionId,
        action: obj.action as (typeof ACTIONS)[number],
        intentKey: typeof obj.intentKey === 'string' ? obj.intentKey : null,
        url: obj.url,
        elementLabel: typeof obj.elementLabel === 'string' ? obj.elementLabel : null,
        timestamp: obj.timestamp,
      };
    }
    default:
      return null;
  }
}
