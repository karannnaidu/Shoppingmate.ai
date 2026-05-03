import type { AssistantToolCalls, ChatMessage, ToolCallMessage } from '@shoppingmate/shared';

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
};
