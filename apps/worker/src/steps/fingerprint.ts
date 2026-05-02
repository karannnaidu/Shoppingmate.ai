import { detectPlatform } from './fingerprintRules/index.js';
import type { FingerprintResult } from './fingerprintRules/index.js';

const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2MB
const FETCH_TIMEOUT_MS = 5_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; ShoppingmateBot/0.1; +https://shoppingmate.ai/bot)';

export async function fingerprint(domain: string): Promise<FingerprintResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`https://${domain}/`, {
      method: 'GET',
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*' },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`fetch failed: ${res.status}`);
    }

    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });

    const reader = res.body?.getReader();
    if (!reader) return detectPlatform('', headers);

    const decoder = new TextDecoder('utf-8');
    let html = '';
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      html += decoder.decode(value, { stream: true });
      if (bytes >= MAX_BODY_BYTES) {
        reader.cancel().catch(() => {});
        break;
      }
    }
    html += decoder.decode();

    return detectPlatform(html, headers);
  } finally {
    clearTimeout(timer);
  }
}
