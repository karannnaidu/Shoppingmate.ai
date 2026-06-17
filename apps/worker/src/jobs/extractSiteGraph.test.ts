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

  it('writes site_nav_edges for links that resolve to another crawled page', async () => {
    const artifacts = [
      { id: 'a1', crawlId: 'c1', url: 'https://x.com/', urlHash: 'h1', contentType: 'text/html', storageKey: 'k1', byteSize: 1, httpStatus: 200, fetchedAt: new Date() },
      { id: 'a2', crawlId: 'c1', url: 'https://x.com/shop', urlHash: 'h2', contentType: 'text/html', storageKey: 'k2', byteSize: 1, httpStatus: 200, fetchedAt: new Date() },
    ];
    const navEdgeInserts: any[] = [];
    const fakeDb = {
      query: {
        crawlArtifacts: { findMany: vi.fn().mockResolvedValue(artifacts) },
        merchants: { findFirst: vi.fn().mockResolvedValue({ id: 'm1', siteGraphVersion: 0 }) },
      },
      // Track which table each insert targets by tagging via a Proxy-free shim:
      // schema.siteNavEdges is the {} object; we detect it by reference.
      insert: (table: any) => {
        const isNavEdge = table === navEdgeTable;
        const b: any = {
          values: (v: any) => { if (isNavEdge) navEdgeInserts.push(v); return b; },
          onConflictDoUpdate: () => Promise.resolve(),
          onConflictDoNothing: () => Promise.resolve(),
        };
        return b;
      },
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
      delete: () => ({ where: () => Promise.resolve() }),
    };
    // Bind the siteNavEdges table reference the production code uses.
    const { schema } = await import('@shoppingmate/db');
    const navEdgeTable = schema.siteNavEdges;
    const fakeExtract = vi
      .fn()
      // home page links to /shop in the header
      .mockResolvedValueOnce({ pageType: 'home', title: 'Home', h1: null, intents: [], navLinks: [{ anchorText: 'Shop', href: '/shop', location: 'header' }], faq: [], policy: null, media: [] })
      // shop page has no nav links
      .mockResolvedValueOnce({ pageType: 'plp', title: 'Shop', h1: null, intents: [], navLinks: [], faq: [], policy: null, media: [] });
    const result = await runExtractSiteGraph({
      merchantId: 'm1', crawlId: 'c1', db: fakeDb as never,
      downloadObject: vi.fn().mockResolvedValue(Buffer.from('<html/>')),
      extractFn: fakeExtract,
      visionFn: vi.fn().mockResolvedValue('alt'),
    });
    expect(result.status).toBe('ok');
    expect(navEdgeInserts).toHaveLength(1);
    expect(navEdgeInserts[0]).toMatchObject({ merchantId: 'm1', anchorText: 'Shop', linkLocation: 'header' });
    expect(navEdgeInserts[0].fromPageId).not.toBe(navEdgeInserts[0].toPageId);
  });
});
