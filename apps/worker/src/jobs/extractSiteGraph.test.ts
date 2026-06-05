import { describe, expect, it, vi } from 'vitest';

// Prevent @shoppingmate/db (and its env validation) from initialising during unit tests.
vi.mock('@shoppingmate/db', () => ({
  db: {},
  schema: {
    merchants: {},
    crawlArtifacts: {},
    sitePages: { merchantId: 'merchant_id' },
    siteNavEdges: {},
    pageIntents: {},
    faqEntries: { merchantId: 'merchant_id' },
    policyDocuments: {},
    mediaIndex: {},
    projectionCache: {},
    products: {},
  },
}));

// Prevent @shoppingmate/site-graph from requiring a real DB connection.
vi.mock('@shoppingmate/site-graph', () => ({
  loadSiteGraph: vi.fn().mockResolvedValue({ pages: [], navEdges: [], intentsByPageId: new Map(), faq: [], policies: [], media: new Map() }),
  projectSonnetAddendum: vi.fn().mockReturnValue({ text: 'Brand site is being indexed; refer to BRAND CONTEXT only.', truncated: false, truncatedSections: [] }),
}));

import { runExtractSiteGraph } from './extractSiteGraph.js';

describe('runExtractSiteGraph', () => {
  it('reads crawl artifacts, runs extractor, writes pages + intents + projection, bumps version', async () => {
    const artifacts = [{
      id: 'a1', crawlId: 'c1', url: 'https://x.com/pricing', urlHash: 'h1',
      contentType: 'text/html', storageKey: 'm1/c1/pages/h1.html', byteSize: 100,
      httpStatus: 200, fetchedAt: new Date(),
    }];
    const inserts: any[] = [];
    const updates: any[] = [];
    const fakeDb = {
      query: {
        crawlArtifacts: { findMany: vi.fn().mockResolvedValue(artifacts) },
        merchants: { findFirst: vi.fn().mockResolvedValue({ id: 'm1', siteGraphVersion: 0 }) },
        sitePages: { findMany: vi.fn().mockResolvedValue([]) },
        siteNavEdges: { findMany: vi.fn().mockResolvedValue([]) },
        pageIntents: { findMany: vi.fn().mockResolvedValue([]) },
        faqEntries: { findMany: vi.fn().mockResolvedValue([]) },
        policyDocuments: { findMany: vi.fn().mockResolvedValue([]) },
        mediaIndex: { findMany: vi.fn().mockResolvedValue([]) },
      },
      insert: () => { const b: any = { values: (v: any) => { inserts.push(v); return b; }, onConflictDoUpdate: () => Promise.resolve() }; return b; },
      update: () => ({ set: (v: any) => ({ where: () => { updates.push(v); return Promise.resolve(); } }) }),
      delete: () => ({ where: () => Promise.resolve() }),
      transaction: async (fn: any) => fn({ insert: () => ({ values: (v: any) => { inserts.push(v); return Promise.resolve(); } }), update: () => ({ set: (v: any) => ({ where: () => { updates.push(v); return Promise.resolve(); } }) }) }),
    };
    const fakeExtract = vi.fn().mockResolvedValue({
      pageType: 'other', title: 'Pricing', h1: null,
      intents: [{ intentKey: 'starter card', selectorHint: '.starter' }],
      navLinks: [], faq: [], policy: null, media: [],
    });
    const fakeDownload = vi.fn().mockResolvedValue(Buffer.from('<html/>'));
    const result = await runExtractSiteGraph({
      merchantId: 'm1', crawlId: 'c1', db: fakeDb as never,
      downloadObject: fakeDownload, extractFn: fakeExtract,
      visionFn: vi.fn().mockResolvedValue('alt'),
    });
    expect(result.status).toBe('ok');
    expect(inserts.length).toBeGreaterThan(0);
    expect(updates.some((u) => u.siteGraphVersion === 1)).toBe(true);
  });
});
