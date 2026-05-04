import { Composio } from '@composio/core';

let _composio: Composio | null = null;

function getComposio(): Composio {
  if (_composio) return _composio;
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) throw new Error('COMPOSIO_API_KEY is not set');
  _composio = new Composio({ apiKey });
  return _composio;
}

export const composio = new Proxy({} as Composio, {
  get(_target, prop) {
    const c = getComposio();
    const v = (c as unknown as Record<string | symbol, unknown>)[prop];
    return typeof v === 'function' ? (v as (...args: unknown[]) => unknown).bind(c) : v;
  },
});

/**
 * Initiates a Shopify OAuth connection via Composio.
 *
 * SDK shape (v0.1.55):
 *   composio.connectedAccounts.initiate(userId, authConfigId, options?)
 *   Returns ConnectionRequest with { id, redirectUrl?, waitForConnection() }
 *
 * Note: `data` / `merchant_id` is not part of CreateConnectedAccountOptions in this SDK
 * version. Pass merchant_id metadata via callbackUrl query param or store it separately.
 * TODO(E.2): embed merchant_id in callbackUrl search params so the webhook handler can
 * correlate the connection back to the merchant row.
 */
export async function startShopifyConnection(args: { userId: string; merchantId: string }) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const authConfigId = process.env.COMPOSIO_SHOPIFY_AUTH_CONFIG_ID!;
  const callbackUrl = `${baseUrl}/api/webhooks/composio?merchant_id=${encodeURIComponent(args.merchantId)}`;

  const result = await composio.connectedAccounts.initiate(args.userId, authConfigId, {
    callbackUrl,
  });

  return { authUrl: result.redirectUrl ?? '', connectionId: result.id };
}

export async function getConnection(id: string) {
  return composio.connectedAccounts.get(id);
}
