import { childLogger } from '@shoppingmate/shared';

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
