import { getOrCreateVisitorId } from './identity.js';
import { setHostPlatform } from './host/actions.js';
import { injectShopifyCartAttribute } from './shopifyCart.js';

export type BootstrapInput = {
  apiBase: string;
  merchantId: string;
  domain: string;
};

export type VoiceBootstrap = {
  wsUrl: string;
  roomName: string;
  token: string;
  personaId: string;
};

export type BootstrapResult =
  | {
      kind: 'ok';
      sessionId: string;
      wsUrl: string;
      merchantStatus: string;
      personaId: string | null;
      /** Dashboard-configured launcher placement (one of the widget position
       *  classes), or null to keep the host/default placement. */
      widgetPosition: string | null;
      voice: VoiceBootstrap | null;
      visitorId: string;
    }
  | { kind: 'err'; reason: string };

// Backoff schedule for transient bootstrap failures. Each entry is the delay
// (ms) BEFORE the corresponding retry, so this yields up to 3 total attempts.
const RETRY_DELAYS_MS = [200, 500] as const;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// The widget bootstrap is a 3-call chain (install → session → voice/token). A
// single transient API failure on any of them used to abort the whole chain,
// leaving voice unconfigured so clicking Call failed with "Could not start the
// call". Those failures are intermittent (a brief edge 502 or an unhandled
// handler exception that Hono turns into a CORS-headerless 500 the browser
// reports as a CORS error), so a small retry recovers transparently.
//
// Retry policy: retry on a thrown error (network/CORS/connection) or a 5xx
// status. Never retry a 4xx — those are deterministic rejections (403 origin
// mismatch, 404 unknown merchant) that a retry can't fix.
async function fetchRetry(url: string, init: RequestInit): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status >= 500 && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt] ?? 0);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt] ?? 0);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export async function bootstrap(input: BootstrapInput): Promise<BootstrapResult> {
  try {
    const visitorId = getOrCreateVisitorId();
    const installRes = await fetchRetry(`${input.apiBase}/v1/install`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        merchantId: input.merchantId,
        domain: input.domain,
        userAgent: navigator.userAgent,
        referrer: document.referrer || null,
      }),
    });
    if (!installRes.ok) return { kind: 'err', reason: `install_${installRes.status}` };
    const installBody = (await installRes.json()) as {
      status: string;
      personaId?: string | null;
      platform?: string | null;
      widgetPosition?: string | null;
    };

    // Route the bot's cart host-actions to the Shopify Cart AJAX bridge (vs the
    // custom __shoppingmate*__ hooks) based on the merchant's platform.
    setHostPlatform(installBody.platform ?? null);

    // Fire-and-forget: stamp visitor id onto Shopify cart attributes so the
    // orders/create webhook can attribute the conversion. No-op on other platforms.
    void injectShopifyCartAttribute({ visitorId, platform: installBody.platform ?? 'custom' });

    const sessionRes = await fetchRetry(`${input.apiBase}/v1/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ merchantId: input.merchantId, domain: input.domain }),
    });
    if (!sessionRes.ok) return { kind: 'err', reason: `session_${sessionRes.status}` };
    const sessionBody = (await sessionRes.json()) as { sessionId: string; wsUrl: string };

    let voice: VoiceBootstrap | null = null;
    try {
      const vRes = await fetchRetry(`${input.apiBase}/v1/voice/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionBody.sessionId,
          merchantId: input.merchantId,
          visitorId,
        }),
      });
      if (vRes.ok) {
        voice = (await vRes.json()) as VoiceBootstrap;
      } else {
        console.warn('[shoppingmate] voice unavailable — status', vRes.status);
      }
    } catch (err) {
      console.warn('[shoppingmate] voice unavailable —', err);
    }

    return {
      kind: 'ok',
      sessionId: sessionBody.sessionId,
      wsUrl: sessionBody.wsUrl,
      merchantStatus: installBody.status,
      personaId: installBody.personaId ?? voice?.personaId ?? null,
      widgetPosition: installBody.widgetPosition ?? null,
      voice,
      visitorId,
    };
  } catch (err) {
    return { kind: 'err', reason: err instanceof Error ? err.message : 'network' };
  }
}
