import type { AssistantToolCalls, ChatMessage, ToolCallMessage } from '@shoppingmate/shared';
import type { HostAction, HostActionResult } from './host-actions.js';

export type Mode = 'voice' | 'text';

export type CardItem = {
  image: string | null;
  title: string;
  priceFormatted: string; // DB-trusted, never LLM-emitted
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
  | {
      type: 'visitor_action';
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
  | { type: 'say_partial'; text: string }
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

export type AnthropicMessage = ChatMessage | AssistantToolCalls | ToolCallMessage;

export type SessionState = {
  sessionId: string;
  merchantId: string;
  cartToken: string | null;
  history: AnthropicMessage[];
  turnCount: number;
  voiceMs: number;
  totalMs: number;
  startedAt: number;
  lastTurnAt: number;
  mode: Mode;
  allowedSpeechTokens: string[];
  // Stable per-visitor id sourced from the widget's localStorage
  // (`sm_visitor_id`). Optional because Task 13 wires the widget→token →
  // session path; until then voice sessions fall back to `anon_<sessionId>`
  // at the openSession call-site, which never matches a real Shopify cart
  // attribute so attribution naturally skips these sessions.
  visitorId?: string;
};
