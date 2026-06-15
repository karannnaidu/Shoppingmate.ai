import { childLogger } from './logger.js';

const log = childLogger({ lib: 'openrouter' });
const URL = 'https://openrouter.ai/api/v1/chat/completions';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type ChatResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
};

export async function chat(opts: {
  model: string;
  messages: ChatMessage[];
  responseFormat?: 'json' | 'text';
  timeoutMs?: number;
}): Promise<ChatResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY missing');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000);
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        'http-referer': 'https://shoppingmate.ai',
        'x-title': 'shoppingmate-onboarding',
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        ...(opts.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`openrouter http ${res.status}: ${errText.slice(0, 200)}`);
    }
    const body = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      text: body.choices[0]?.message?.content ?? '',
      inputTokens: body.usage?.prompt_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
    };
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'openrouter call failed');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export type ToolDef = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema
  };
};

export type ToolCallMessage = { role: 'tool'; tool_call_id: string; content: string };
export type AssistantToolCalls = {
  role: 'assistant';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
};

export type ToolsMessage = ChatMessage | AssistantToolCalls | ToolCallMessage;

export type ToolCall = { id: string; name: string; argumentsJson: string };

export type ChatToolsResult = {
  text: string;
  toolCalls: ToolCall[];
  stopReason: 'stop' | 'tool_calls' | 'length' | 'other';
  inputTokens: number;
  outputTokens: number;
};

export async function chatTools(opts: {
  model: string;
  messages: ToolsMessage[];
  tools: ToolDef[];
  toolChoice?: 'auto' | 'none' | 'required';
  timeoutMs?: number;
  /** Cap on output tokens per turn. Bounded by default so OpenRouter does not
   *  reserve credit for the model's full default output (e.g. 64K on Sonnet),
   *  which 402s the request when the account balance is low. A shopping reply
   *  plus tool calls fits comfortably under this. */
  maxTokens?: number;
}): Promise<ChatToolsResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY missing');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000);
  // Some upstream providers (Bedrock/Vertex) reject dots in tool names — they
  // require ^[a-zA-Z0-9_-]{1,128}$. Normalize on the wire (`.` → `_`) and
  // reverse the substitution on the way back so dispatchTool() and the rest
  // of the runtime keep their canonical dotted names.
  const wireTools = opts.tools.map((t) => ({
    ...t,
    function: { ...t.function, name: t.function.name.replace(/\./g, '_') },
  }));
  const wireMessages = opts.messages.map((m) => {
    if (m.role === 'assistant' && 'tool_calls' in m && m.tool_calls) {
      return {
        ...m,
        tool_calls: m.tool_calls.map((tc) => ({
          ...tc,
          function: { ...tc.function, name: tc.function.name.replace(/\./g, '_') },
        })),
      };
    }
    return m;
  });
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        'http-referer': 'https://shoppingmate.ai',
        'x-title': 'shoppingmate-agent',
      },
      body: JSON.stringify({
        model: opts.model,
        messages: wireMessages,
        tools: wireTools.length > 0 ? wireTools : undefined,
        tool_choice: wireTools.length > 0 ? (opts.toolChoice ?? 'auto') : undefined,
        max_tokens: opts.maxTokens ?? 2048,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      log.warn(
        { status: res.status, body: errText.slice(0, 500), model: opts.model },
        'chatTools http error',
      );
      throw new Error(`openrouter http ${res.status}: ${errText.slice(0, 200)}`);
    }
    const body = (await res.json()) as {
      choices: Array<{
        message: { content: string | null; tool_calls?: AssistantToolCalls['tool_calls'] };
        finish_reason: string;
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const choice = body.choices[0];
    if (!choice) throw new Error('openrouter: empty choices');
    const stopReason = mapStopReason(choice.finish_reason);
    // Map underscore tool names back to canonical dotted form so dispatchTool
    // (which switches on `products.search`, `cart.add`, etc.) works unchanged.
    const knownToolNames = new Set(wireTools.map((t) => t.function.name));
    const toolCalls = (choice.message.tool_calls ?? []).map((tc) => {
      const wire = tc.function.name;
      const canonical = knownToolNames.has(wire) ? wire.replace(/_/g, '.') : wire;
      return { id: tc.id, name: canonical, argumentsJson: tc.function.arguments };
    });
    return {
      text: choice.message.content ?? '',
      toolCalls,
      stopReason,
      inputTokens: body.usage?.prompt_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
    };
  } finally {
    clearTimeout(timer);
  }
}

function mapStopReason(s: string): ChatToolsResult['stopReason'] {
  if (s === 'stop') return 'stop';
  if (s === 'tool_calls') return 'tool_calls';
  if (s === 'length') return 'length';
  return 'other';
}
