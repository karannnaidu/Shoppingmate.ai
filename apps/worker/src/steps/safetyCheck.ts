import { childLogger } from '@shoppingmate/shared';

const log = childLogger({ step: 'safetyCheck' });
const API_URL = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';
const TIMEOUT_MS = 3_000;
const MAX_ATTEMPTS = 3;

export type SafetyResult = { kind: 'clean' } | { kind: 'flagged'; threatType: string };

export async function safetyCheck(domain: string): Promise<SafetyResult> {
  // Read process.env directly so test scopes can null the key without
  // re-importing the validated env (which envalid parses once at load).
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
  if (!apiKey) {
    log.warn({ domain }, 'GOOGLE_SAFE_BROWSING_API_KEY missing; skipping check (degraded)');
    return { kind: 'clean' };
  }

  const body = {
    client: { clientId: 'shoppingmate', clientVersion: '0.1.0' },
    threatInfo: {
      threatTypes: [
        'MALWARE',
        'SOCIAL_ENGINEERING',
        'UNWANTED_SOFTWARE',
        'POTENTIALLY_HARMFUL_APPLICATION',
      ],
      platformTypes: ['ANY_PLATFORM'],
      threatEntryTypes: ['URL'],
      threatEntries: [{ url: `https://${domain}/` }, { url: `http://${domain}/` }],
    },
  };

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`safe browsing http ${res.status}`);
      const json = (await res.json()) as { matches?: Array<{ threatType: string }> };
      if (json.matches && json.matches.length > 0) {
        const threatType = json.matches[0]?.threatType ?? 'UNKNOWN';
        return { kind: 'flagged', threatType };
      }
      return { kind: 'clean' };
    } catch (err) {
      lastErr = err;
      log.warn({ domain, attempt, err: (err as Error).message }, 'safe browsing call failed');
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(
    `safety check failed after ${MAX_ATTEMPTS} attempts: ${
      (lastErr as Error)?.message ?? 'unknown'
    }`,
  );
}
