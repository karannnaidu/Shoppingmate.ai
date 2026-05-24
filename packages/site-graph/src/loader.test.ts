import { describe, expect, it, vi } from 'vitest';
import { loadSiteGraph } from './loader.js';

describe('loadSiteGraph', () => {
  it('returns an empty graph when merchant has no pages', async () => {
    const fakeDb = {
      query: {
        sitePages: { findMany: vi.fn().mockResolvedValue([]) },
        siteNavEdges: { findMany: vi.fn().mockResolvedValue([]) },
        pageIntents: { findMany: vi.fn().mockResolvedValue([]) },
        faqEntries: { findMany: vi.fn().mockResolvedValue([]) },
        policyDocuments: { findMany: vi.fn().mockResolvedValue([]) },
        mediaIndex: { findMany: vi.fn().mockResolvedValue([]) },
        merchants: { findFirst: vi.fn().mockResolvedValue({ id: 'm1', siteGraphVersion: 0 }) },
      },
    };
    const graph = await loadSiteGraph(fakeDb as never, 'm1');
    expect(graph.merchantId).toBe('m1');
    expect(graph.pages).toEqual([]);
    expect(graph.intentsByPageId.size).toBe(0);
  });

  it('groups intents by pageId', async () => {
    const fakeDb = {
      query: {
        sitePages: { findMany: vi.fn().mockResolvedValue([
          { id: 'p1', url: '/pricing', pageType: 'other', title: 'Pricing', h1: null, meta: {} },
        ]) },
        siteNavEdges: { findMany: vi.fn().mockResolvedValue([]) },
        pageIntents: { findMany: vi.fn().mockResolvedValue([
          { pageId: 'p1', intentKey: 'starter card', selectorHint: '.starter', intentMeta: {} },
          { pageId: 'p1', intentKey: 'signup', selectorHint: '#signup', intentMeta: {} },
        ]) },
        faqEntries: { findMany: vi.fn().mockResolvedValue([]) },
        policyDocuments: { findMany: vi.fn().mockResolvedValue([]) },
        mediaIndex: { findMany: vi.fn().mockResolvedValue([]) },
        merchants: { findFirst: vi.fn().mockResolvedValue({ id: 'm1', siteGraphVersion: 3 }) },
      },
    };
    const graph = await loadSiteGraph(fakeDb as never, 'm1');
    expect(graph.version).toBe(3);
    expect(graph.intentsByPageId.get('p1')?.length).toBe(2);
  });
});
