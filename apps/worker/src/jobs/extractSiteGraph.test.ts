import { describe, expect, it, vi } from 'vitest';

// Prevent @shoppingmate/db (and its env validation) from initialising during unit tests.
// Each table is a tagged object so the fake db can tell which table a write hit.
vi.mock('@shoppingmate/db', () => {
  const t = (name: string) => ({ _t: name, id: `${name}.id`, merchantId: `${name}.merchant_id`, url: `${name}.url`, pageId: `${name}.page_id`, sku: `${name}.sku`, source: `${name}.source`, productUrl: `${name}.product_url`, sourceUrl: `${name}.source_url`, startedAt: `${name}.started_at`, policyType: `${name}.policy_type`, consumer: `${name}.consumer` });
  return {
    db: {},
    schema: {
      merchants: t('merchants'),
      siteCrawls: t('siteCrawls'),
      crawlArtifacts: t('crawlArtifacts'),
      sitePages: t('sitePages'),
      siteNavEdges: t('siteNavEdges'),
      pageIntents: t('pageIntents'),
      faqEntries: t('faqEntries'),
      policyDocuments: t('policyDocuments'),
      mediaIndex: t('mediaIndex'),
      projectionCache: t('projectionCache'),
      products: t('products'),
    },
  };
});

// Prevent @shoppingmate/site-graph from requiring a real DB connection.
vi.mock('@shoppingmate/site-graph', () => ({
  loadSiteGraph: vi.fn().mockResolvedValue({ pages: [], navEdges: [], intentsByPageId: new Map(), faq: [], policies: [], media: new Map() }),
  projectSonnetAddendum: vi.fn().mockReturnValue({ text: 'SITE MAP', truncated: false, truncatedSections: [] }),
}));

import { applyKbExclusions, runExtractSiteGraph } from './extractSiteGraph.js';

type Op = { op: 'insert' | 'update' | 'delete' | 'select'; table: string; values?: any; set?: any };

function makeDb(opts: { artifacts: any[]; merchant?: any; selectRows?: Record<string, any[]> }) {
  const ops: Op[] = [];
  let n = 0;
  const builder = (op: Op['op'], table: string) => {
    const b: any = {
      values(v: any) { ops.push({ op, table, values: v }); return b; },
      set(v: any) { ops.push({ op, table, set: v }); return b; },
      from(tbl: any) { table = tbl._t; return b; },
      where() { if (op === 'delete') ops.push({ op, table }); return b; },
      orderBy() { return b; },
      limit() { return b; },
      onConflictDoUpdate() { return b; },
      onConflictDoNothing() { return b; },
      returning() { n += 1; return Promise.resolve([{ id: `page-${n}` }]); },
      then(res: any, rej: any) {
        return Promise.resolve(op === 'select' ? (opts.selectRows?.[table] ?? []) : undefined).then(res, rej);
      },
    };
    return b;
  };
  const db = {
    query: {
      crawlArtifacts: { findMany: vi.fn().mockResolvedValue(opts.artifacts) },
      merchants: { findFirst: vi.fn().mockResolvedValue(opts.merchant ?? { id: 'm1', siteGraphVersion: 0, kbExcludedPaths: [] }) },
      siteCrawls: { findFirst: vi.fn().mockResolvedValue({ id: 'c1', stats: { discovered: [] } }) },
    },
    insert: (t: any) => builder('insert', t._t),
    update: (t: any) => builder('update', t._t),
    delete: (t: any) => builder('delete', t._t),
    select: () => builder('select', ''),
  };
  return { db, ops };
}

const art = (url: string, i: number) => ({
  id: `a${i}`, crawlId: 'c1', url, urlHash: `h${i}`, contentType: 'text/html', storageKey: `k${i}`,
  byteSize: 1, httpStatus: 200, fetchedAt: new Date(),
});
const page = (over: Record<string, unknown> = {}) => ({
  pageType: 'other', title: 'T', h1: null, intents: [], navLinks: [], faq: [], policy: null, media: [], product: null, ...over,
});

describe('runExtractSiteGraph', () => {
  it('upserts pages (never wipes first), writes the projection, bumps version, marks the read ok', async () => {
    const { db, ops } = makeDb({ artifacts: [art('https://x.com/pricing', 1)] });
    const result = await runExtractSiteGraph({
      merchantId: 'm1', crawlId: 'c1', db: db as never,
      downloadObject: vi.fn().mockResolvedValue(Buffer.from('<html/>')),
      extractFn: vi.fn().mockResolvedValue(page({ intents: [{ intentKey: 'starter card', selectorHint: '.starter' }] })),
      visionFn: vi.fn().mockResolvedValue('alt'),
    });
    expect(result).toMatchObject({ status: 'ok', extracted: 1, failed: 0 });
    // The only site_pages delete is the end-of-run prune, AFTER the page upsert.
    const firstPageDelete = ops.findIndex((o) => o.op === 'delete' && o.table === 'sitePages');
    const firstPageInsert = ops.findIndex((o) => o.op === 'insert' && o.table === 'sitePages');
    expect(firstPageInsert).toBeGreaterThanOrEqual(0);
    expect(firstPageDelete).toBeGreaterThan(firstPageInsert);
    expect(ops.some((o) => o.op === 'insert' && o.table === 'pageIntents')).toBe(true);
    expect(ops.some((o) => o.op === 'insert' && o.table === 'projectionCache')).toBe(true);
    expect(ops.some((o) => o.op === 'update' && o.set?.siteGraphVersion === 1)).toBe(true);
    expect(ops.find((o) => o.op === 'update' && o.table === 'siteCrawls')?.set).toMatchObject({ status: 'ok', stats: { extracted: 1 } });
  });

  // 2026-11-05: one page with a null policy body failed the whole Calmosis re-scan.
  it('one bad page is recorded and skipped — the rest of the site is still learned', async () => {
    const { db, ops } = makeDb({ artifacts: [art('https://x.com/a', 1), art('https://x.com/b', 2)] });
    const extractFn = vi.fn()
      .mockRejectedValueOnce(new Error('null value in column "full_text"'))
      .mockResolvedValueOnce(page());
    const result = await runExtractSiteGraph({
      merchantId: 'm1', crawlId: 'c1', db: db as never,
      downloadObject: vi.fn().mockResolvedValue(Buffer.from('<html/>')),
      extractFn, visionFn: vi.fn(),
    });
    expect(result).toMatchObject({ status: 'ok', extracted: 1, failed: 1 });
    const crawlUpdate = ops.find((o) => o.op === 'update' && o.table === 'siteCrawls')!.set;
    expect(crawlUpdate.stats.failed).toEqual([{ url: 'https://x.com/a', error: 'null value in column "full_text"' }]);
  });

  it('skips owner-excluded pages and duplicate spellings', async () => {
    const { db } = makeDb({
      artifacts: [art('https://x.com/blog/post', 1), art('https://x.com/about', 2), art('https://x.com/about/', 3)],
      merchant: { id: 'm1', siteGraphVersion: 2, kbExcludedPaths: ['/blog/'] },
    });
    const extractFn = vi.fn().mockResolvedValue(page());
    await runExtractSiteGraph({
      merchantId: 'm1', crawlId: 'c1', db: db as never,
      downloadObject: vi.fn().mockResolvedValue(Buffer.from('<html/>')), extractFn, visionFn: vi.fn(),
    });
    expect(extractFn.mock.calls.map((c) => c[0].url)).toEqual(['https://x.com/about']);
  });

  it('keeps the last good knowledge base when nothing at all could be read', async () => {
    const { db, ops } = makeDb({ artifacts: [art('https://x.com/a', 1)] });
    await expect(
      runExtractSiteGraph({
        merchantId: 'm1', crawlId: 'c1', db: db as never,
        downloadObject: vi.fn().mockRejectedValue(new Error('r2 down')),
        extractFn: vi.fn(), visionFn: vi.fn(),
      }),
    ).rejects.toThrow('no pages could be read');
    expect(ops.some((o) => o.op === 'delete' && o.table === 'sitePages')).toBe(false);
    expect(ops.find((o) => o.op === 'update' && o.table === 'siteCrawls')?.set.status).toBe('failed');
  });

  it('an older read stops (without pruning) once a newer read exists', async () => {
    const urls = Array.from({ length: 12 }, (_, i) => art(`https://x.com/p${i}`, i));
    const { db, ops } = makeDb({ artifacts: urls });
    const extractFn = vi.fn().mockResolvedValue(page());
    const out = await runExtractSiteGraph({
      merchantId: 'm1', crawlId: 'c1', db: db as never,
      downloadObject: vi.fn().mockResolvedValue(Buffer.from('<html/>')), extractFn, visionFn: vi.fn(),
      isSuperseded: vi.fn().mockResolvedValue(true),
    });
    expect(out.status).toBe('superseded');
    expect(extractFn).toHaveBeenCalledTimes(4);
    expect(ops.some((o) => o.op === 'delete' && o.table === 'sitePages')).toBe(false);
  });

  it('writes site_nav_edges for links that resolve to another crawled page', async () => {
    const { db, ops } = makeDb({ artifacts: [art('https://x.com/', 1), art('https://x.com/shop', 2)] });
    const extractFn = vi.fn().mockImplementation(async ({ url }: { url: string }) =>
      url === 'https://x.com/'
        ? page({ pageType: 'home', navLinks: [
            { anchorText: 'Shop', href: '/shop', location: 'header' },
            { anchorText: 'Ext', href: 'https://other.com/x', location: 'footer' },
          ] })
        : page({ pageType: 'plp' }),
    );
    await runExtractSiteGraph({
      merchantId: 'm1', crawlId: 'c1', db: db as never,
      downloadObject: vi.fn().mockResolvedValue(Buffer.from('<html/>')), extractFn, visionFn: vi.fn(),
    });
    const edges = ops.filter((o) => o.op === 'insert' && o.table === 'siteNavEdges').map((o) => o.values);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ anchorText: 'Shop', linkLocation: 'header', fromPageId: 'page-1', toPageId: 'page-2' });
  });

  it('upserts a product found on a product page', async () => {
    const { db, ops } = makeDb({ artifacts: [art('https://x.com/shop/holistic-gummy/', 1)] });
    await runExtractSiteGraph({
      merchantId: 'm1', crawlId: 'c1', db: db as never,
      downloadObject: vi.fn().mockResolvedValue(Buffer.from('<html/>')),
      extractFn: vi.fn().mockResolvedValue(page({
        pageType: 'pdp',
        product: { sku: 'holistic-gummy', title: 'Holistic Gummy', description: 'd', imageUrl: null, priceCents: 450000, currency: 'INR', inStock: null, brand: 'Calmosis', raw: {} },
      })),
      visionFn: vi.fn(),
    });
    const prod = ops.find((o) => o.op === 'insert' && o.table === 'products')?.values;
    expect(prod).toMatchObject({ sku: 'holistic-gummy', title: 'Holistic Gummy', productUrl: 'https://x.com/shop/holistic-gummy/', source: 'site_graph' });
  });
});

describe('applyKbExclusions', () => {
  it('drops skipped pages + products right away and refreshes the summary', async () => {
    const { db, ops } = makeDb({
      artifacts: [],
      merchant: { id: 'm1', siteGraphVersion: 4, kbExcludedPaths: ['/blog/', '/shop/old-thing'] },
      selectRows: {
        sitePages: [
          { id: 'p1', url: 'https://x.com/blog/a' },
          { id: 'p2', url: 'https://x.com/shop/holistic-gummy/' },
        ],
        products: [
          { sku: 'old-thing', productUrl: 'https://x.com/shop/old-thing/' },
          { sku: 'holistic-gummy', productUrl: 'https://x.com/shop/holistic-gummy/' },
        ],
      },
    });
    const out = await applyKbExclusions({ merchantId: 'm1', db: db as never });
    expect(out).toEqual({ removedPages: 1, removedProducts: 1 });
    expect(ops.some((o) => o.op === 'update' && o.set?.siteGraphVersion === 5)).toBe(true);
  });
});
