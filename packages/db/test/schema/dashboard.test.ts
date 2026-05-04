import { describe, expect, it } from 'vitest';
import {
  merchantOwners,
  brandKbDocuments,
  brandKbChunks,
  alerts,
  stripeEvents,
} from '../../src/schema/dashboard';

describe('dashboard schema', () => {
  it('merchantOwners has composite key columns', () => {
    expect(merchantOwners.userId).toBeDefined();
    expect(merchantOwners.merchantId).toBeDefined();
    expect(merchantOwners.role).toBeDefined();
  });

  it('brandKbDocuments has all columns', () => {
    expect(brandKbDocuments.id).toBeDefined();
    expect(brandKbDocuments.merchantId).toBeDefined();
    expect(brandKbDocuments.filename).toBeDefined();
    expect(brandKbDocuments.mimeType).toBeDefined();
    expect(brandKbDocuments.sizeBytes).toBeDefined();
    expect(brandKbDocuments.storageUrl).toBeDefined();
    expect(brandKbDocuments.status).toBeDefined();
    expect(brandKbDocuments.enabled).toBeDefined();
  });

  it('brandKbChunks has all columns', () => {
    expect(brandKbChunks.id).toBeDefined();
    expect(brandKbChunks.documentId).toBeDefined();
    expect(brandKbChunks.merchantId).toBeDefined();
    expect(brandKbChunks.chunkIndex).toBeDefined();
    expect(brandKbChunks.text).toBeDefined();
    expect(brandKbChunks.tokenCount).toBeDefined();
  });

  it('alerts has all columns', () => {
    expect(alerts.id).toBeDefined();
    expect(alerts.merchantId).toBeDefined();
    expect(alerts.kind).toBeDefined();
    expect(alerts.severity).toBeDefined();
    expect(alerts.payload).toBeDefined();
    expect(alerts.acknowledgedAt).toBeDefined();
    expect(alerts.resolvedAt).toBeDefined();
  });

  it('stripeEvents has idempotency columns', () => {
    expect(stripeEvents.id).toBeDefined();
    expect(stripeEvents.type).toBeDefined();
    expect(stripeEvents.receivedAt).toBeDefined();
    expect(stripeEvents.processedAt).toBeDefined();
    expect(stripeEvents.payload).toBeDefined();
  });
});
