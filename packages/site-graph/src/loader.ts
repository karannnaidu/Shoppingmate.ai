import type { DB } from '@shoppingmate/db';
import { emptyGraph, type SiteGraph, type PageIntent } from './types.js';

export async function loadSiteGraph(db: DB, merchantId: string): Promise<SiteGraph> {
  const [merchant, pageRows, edgeRows, intentRows, faqRows, policyRows, mediaRows] = await Promise.all([
    db.query.merchants.findFirst({ where: (m, { eq }) => eq(m.id, merchantId) }),
    db.query.sitePages.findMany({ where: (p, { eq }) => eq(p.merchantId, merchantId) }),
    db.query.siteNavEdges.findMany({ where: (e, { eq }) => eq(e.merchantId, merchantId) }),
    db.query.pageIntents.findMany({ where: (i, { eq }) => eq(i.merchantId, merchantId) }),
    db.query.faqEntries.findMany({ where: (f, { eq }) => eq(f.merchantId, merchantId) }),
    db.query.policyDocuments.findMany({ where: (p, { eq }) => eq(p.merchantId, merchantId) }),
    db.query.mediaIndex.findMany({ where: (m, { eq }) => eq(m.merchantId, merchantId) }),
  ]);

  const graph = emptyGraph(merchantId, merchant?.siteGraphVersion ?? 0);

  graph.pages = pageRows.map((p) => ({
    id: p.id,
    url: p.url,
    pageType: p.pageType,
    title: p.title,
    h1: p.h1,
    meta: p.meta,
  }));

  graph.navEdges = edgeRows.map((e) => ({
    fromPageId: e.fromPageId,
    toPageId: e.toPageId,
    anchorText: e.anchorText,
    linkLocation: e.linkLocation,
  }));

  const intentMap = new Map<string, PageIntent[]>();
  for (const i of intentRows) {
    const list = intentMap.get(i.pageId) ?? [];
    list.push({ intentKey: i.intentKey, selectorHint: i.selectorHint, meta: i.intentMeta });
    intentMap.set(i.pageId, list);
  }
  graph.intentsByPageId = intentMap;

  graph.faq = faqRows.map((f) => ({
    question: f.question,
    answer: f.answer,
    pageId: f.pageId,
    sourceUrl: f.sourceUrl,
  }));

  graph.policies = policyRows.map((p) => ({
    policyType: p.policyType,
    summary: p.summary,
    pageId: p.pageId,
  }));

  for (const m of mediaRows) {
    graph.media.set(m.contentHash, {
      mediaUrl: m.mediaUrl,
      contentHash: m.contentHash,
      originalAlt: m.originalAlt,
      generatedAlt: m.generatedAlt,
      role: m.role,
    });
  }

  return graph;
}
