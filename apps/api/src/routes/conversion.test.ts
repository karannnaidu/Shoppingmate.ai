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
    const recordMetric = vi.fn();
    const out = await handleConversionIngest({
      rawBody: validBody,
      hmacHeader: '',
      lookupMerchantSecret: async () => secret,
      attribute: vi.fn(),
      recordMetric,
    });
    expect(out.status).toBe(401);
    expect(out.body.error).toBe('auth_failed');
    expect(recordMetric).not.toHaveBeenCalled();
  });

  it('rejects bad HMAC', async () => {
    const recordMetric = vi.fn();
    const out = await handleConversionIngest({
      rawBody: validBody,
      hmacHeader: 'definitely-wrong',
      lookupMerchantSecret: async () => secret,
      attribute: vi.fn(),
      recordMetric,
    });
    expect(out.status).toBe(401);
    expect(recordMetric).not.toHaveBeenCalled();
  });

  it('rejects unknown merchant', async () => {
    const recordMetric = vi.fn();
    const out = await handleConversionIngest({
      rawBody: validBody,
      hmacHeader: computeHmac(validBody, 'whatever'),
      lookupMerchantSecret: async () => null,
      attribute: vi.fn(),
      recordMetric,
    });
    expect(out.status).toBe(404);
    expect(out.body.error).toBe('merchant_unknown');
    expect(recordMetric).not.toHaveBeenCalled();
  });

  it('accepts valid HMAC and invokes attribute()', async () => {
    const attribute = vi.fn().mockResolvedValue({ wrote: ['influenced'], skipped: [], missReason: null });
    const out = await handleConversionIngest({
      rawBody: validBody,
      hmacHeader: computeHmac(validBody, secret),
      lookupMerchantSecret: async () => secret,
      attribute,
      recordMetric: vi.fn(),
    });
    expect(out.status).toBe(200);
    expect(out.body.wrote).toEqual(['influenced']);
    expect(attribute).toHaveBeenCalledOnce();
    const [order] = attribute.mock.calls[0]!;
    expect(order.merchantId).toBe('m1');
    expect(order.matchSource).toBe('gtag');
  });

  it('passes matchSource=cod through to attribute() for COD orders', async () => {
    const codBody = JSON.stringify({
      merchantId: 'm1',
      orderId: 'ord-cod-1',
      totalCents: 25000,
      currency: 'INR',
      visitorId: 'v1',
      occurredAt: '2026-06-14T10:00:00Z',
      lineItems: [{ sku: 'CALM-1', quantity: 1, priceCents: 25000 }],
      matchSource: 'cod',
    });
    const attribute = vi.fn().mockResolvedValue({ wrote: ['assisted'], skipped: [], missReason: null });
    const out = await handleConversionIngest({
      rawBody: codBody,
      hmacHeader: computeHmac(codBody, secret),
      lookupMerchantSecret: async () => secret,
      attribute,
      recordMetric: vi.fn(),
    });
    expect(out.status).toBe(200);
    const [order] = attribute.mock.calls[0]!;
    expect(order.matchSource).toBe('cod');
    expect(order.totalCents).toBe(25000);
  });

  it('returns 400 on malformed body', async () => {
    const bad = '{not json';
    const out = await handleConversionIngest({
      rawBody: bad,
      hmacHeader: computeHmac(bad, secret),
      lookupMerchantSecret: async () => secret,
      attribute: vi.fn(),
      recordMetric: vi.fn(),
    });
    expect(out.status).toBe(400);
  });

  it('returns 400 on invalid totalCents', async () => {
    const body = JSON.stringify({
      merchantId: 'm1',
      orderId: 'ord-1',
      totalCents: 'abc',
      currency: 'USD',
      visitorId: 'v1',
      occurredAt: '2026-05-27T10:00:00Z',
      lineItems: [],
    });
    const out = await handleConversionIngest({
      rawBody: body,
      hmacHeader: computeHmac(body, secret),
      lookupMerchantSecret: async () => secret,
      attribute: vi.fn(),
      recordMetric: vi.fn(),
    });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('invalid_amount');
  });

  it('returns 400 on invalid occurredAt', async () => {
    const body = JSON.stringify({
      merchantId: 'm1',
      orderId: 'ord-1',
      totalCents: 5000,
      currency: 'USD',
      visitorId: 'v1',
      occurredAt: 'not-a-date',
      lineItems: [],
    });
    const out = await handleConversionIngest({
      rawBody: body,
      hmacHeader: computeHmac(body, secret),
      lookupMerchantSecret: async () => secret,
      attribute: vi.fn(),
      recordMetric: vi.fn(),
    });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('invalid_occurred_at');
  });

  it('returns 500 when attribute() throws', async () => {
    const out = await handleConversionIngest({
      rawBody: validBody,
      hmacHeader: computeHmac(validBody, secret),
      lookupMerchantSecret: async () => secret,
      attribute: vi.fn().mockRejectedValue(new Error('db down')),
      recordMetric: vi.fn(),
    });
    expect(out.status).toBe(500);
    expect(out.body.error).toBe('internal');
  });

  it('returns 500 when lookupMerchantSecret throws', async () => {
    const out = await handleConversionIngest({
      rawBody: validBody,
      hmacHeader: 'whatever',
      lookupMerchantSecret: async () => { throw new Error('db down'); },
      attribute: vi.fn(),
      recordMetric: vi.fn(),
    });
    expect(out.status).toBe(500);
    expect(out.body.error).toBe('internal');
  });

  it('emits conversionIngested per wrote[] entry on success', async () => {
    const recordMetric = vi.fn().mockResolvedValue(undefined);
    const attribute = vi.fn().mockResolvedValue({ wrote: ['influenced'], skipped: [], missReason: null });
    const out = await handleConversionIngest({
      rawBody: validBody,
      hmacHeader: computeHmac(validBody, secret),
      lookupMerchantSecret: async () => secret,
      attribute,
      recordMetric,
    });
    expect(out.status).toBe(200);
    expect(recordMetric).toHaveBeenCalledOnce();
    expect(recordMetric).toHaveBeenCalledWith({
      merchantId: 'm1',
      metricName: 'conversion.ingested',
      tags: { source: 'gtag', kind: 'influenced' },
    });
  });

  it('emits conversionMissDuplicate per skipped[] entry', async () => {
    const recordMetric = vi.fn().mockResolvedValue(undefined);
    const attribute = vi.fn().mockResolvedValue({ wrote: [], skipped: ['influenced'], missReason: null });
    const out = await handleConversionIngest({
      rawBody: validBody,
      hmacHeader: computeHmac(validBody, secret),
      lookupMerchantSecret: async () => secret,
      attribute,
      recordMetric,
    });
    expect(out.status).toBe(200);
    expect(recordMetric).toHaveBeenCalledOnce();
    expect(recordMetric).toHaveBeenCalledWith({
      merchantId: 'm1',
      metricName: 'conversion.miss.duplicate',
      tags: { source: 'gtag', kind: 'influenced' },
    });
  });
});
