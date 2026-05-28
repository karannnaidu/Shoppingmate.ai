import { describe, expect, it, vi } from 'vitest';
import { handleConversionIngest, computeHmac } from './conversion.js';

describe('POST /v1/conversion handler', () => {
  const secret = 'shh-secret';
  const validBody = JSON.stringify({
    merchantId: 'm1',
    orderId: 'ord-1',
    totalCents: 5000,
    currency: 'USD',
    visitorId: 'v1',
    occurredAt: '2026-05-27T10:00:00Z',
    lineItems: [{ sku: 'SKU-A', quantity: 1, priceCents: 5000 }],
  });

  it('rejects missing HMAC header', async () => {
    const out = await handleConversionIngest({
      rawBody: validBody,
      hmacHeader: '',
      lookupMerchantSecret: async () => secret,
      attribute: vi.fn(),
    });
    expect(out.status).toBe(401);
    expect(out.body.error).toBe('auth_failed');
  });

  it('rejects bad HMAC', async () => {
    const out = await handleConversionIngest({
      rawBody: validBody,
      hmacHeader: 'definitely-wrong',
      lookupMerchantSecret: async () => secret,
      attribute: vi.fn(),
    });
    expect(out.status).toBe(401);
  });

  it('rejects unknown merchant', async () => {
    const out = await handleConversionIngest({
      rawBody: validBody,
      hmacHeader: computeHmac(validBody, 'whatever'),
      lookupMerchantSecret: async () => null,
      attribute: vi.fn(),
    });
    expect(out.status).toBe(404);
    expect(out.body.error).toBe('merchant_unknown');
  });

  it('accepts valid HMAC and invokes attribute()', async () => {
    const attribute = vi.fn().mockResolvedValue({ wrote: ['influenced'], skipped: [], missReason: null });
    const out = await handleConversionIngest({
      rawBody: validBody,
      hmacHeader: computeHmac(validBody, secret),
      lookupMerchantSecret: async () => secret,
      attribute,
    });
    expect(out.status).toBe(200);
    expect(out.body.wrote).toEqual(['influenced']);
    expect(attribute).toHaveBeenCalledOnce();
    const [order] = attribute.mock.calls[0]!;
    expect(order.merchantId).toBe('m1');
    expect(order.matchSource).toBe('gtag');
  });

  it('returns 400 on malformed body', async () => {
    const bad = '{not json';
    const out = await handleConversionIngest({
      rawBody: bad,
      hmacHeader: computeHmac(bad, secret),
      lookupMerchantSecret: async () => secret,
      attribute: vi.fn(),
    });
    expect(out.status).toBe(400);
  });
});
