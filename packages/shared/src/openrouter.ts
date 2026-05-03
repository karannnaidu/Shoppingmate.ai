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
}): Promise<ChatToolsResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY missing');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000);
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
        messages: opts.messages,
        tools: opts.tools.length > 0 ? opts.tools : undefined,
        tool_choice: opts.tools.length > 0 ? (opts.toolChoice ?? 'auto') : undefined,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
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
    const toolCalls = (choice.message.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      argumentsJson: tc.function.arguments,
    }));
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
