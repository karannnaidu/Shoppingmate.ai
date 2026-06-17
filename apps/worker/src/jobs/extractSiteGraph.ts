import { randomUUID, createHash } from 'node:crypto';
import { db as defaultDb, schema, type PageType } from '@shoppingmate/db';
import { eq } from 'drizzle-orm';
import { loadSiteGraph, projectSonnetAddendum } from '@shoppingmate/site-graph';
import { extractStructured, type ExtractedNavLink } from '../steps/siteGraph/extractStructured.js';
import { generateAltText, needsGeneratedAlt } from '../steps/siteGraph/vision.js';
import { geminiExtractCall } from '../llm/geminiExtract.js';
import { geminiVisionCall } from '../llm/geminiVision.js';

export type ExtractSiteGraphArgs = {
  merchantId: string;
  crawlId: string;
  db?: typeof defaultDb;
  downloadObject?: (storageKey: string) => Promise<Buffer>;
  extractFn?: typeof extractStructured;
  visionFn?: (url: string) => Promise<string>;
  visionCap?: number;
};

export type ExtractSiteGraphResult = { status: 'ok' | 'failed'; error?: string };

export async function runExtractSiteGraph(args: ExtractSiteGraphArgs): Promise<ExtractSiteGraphResult> {
  const db = args.db ?? defaultDb;
  const extract = args.extractFn ?? ((opts) => extractStructured({ ...opts, llmCall: geminiExtractCall }));
  const visionFn = args.visionFn ?? geminiVisionCall;
  const visionCap = args.visionCap ?? 100;

  const merchant = await db.query.merchants.findFirst({
    where: eq(schema.merchants.id, args.merchantId),
  });
  if (!merchant) return { status: 'failed', error: 'merchant not found' };

  // Clear prior extraction for this merchant so re-runs are idempotent.
  // FK onDelete='cascade' on intents/policies/media handles those; faqs use 'set null', so clear explicitly.
  await db.delete(schema.faqEntries).where(eq(schema.faqEntries.merchantId, args.merchantId));
  await db.delete(schema.sitePages).where(eq(schema.sitePages.merchantId, args.merchantId));

  const artifacts = await db.query.crawlArtifacts.findMany({
    where: eq(schema.crawlArtifacts.crawlId, args.crawlId),
  });

  let visionCallsUsed = 0;
  const seenHashes = new Set<string>();
  const seenSkus = new Set<string>();
  // Two-pass nav edges: a link's target page may not be inserted yet (or at all),
  // so collect (fromPageId, links) now and resolve to toPageId after every page
  // row exists. Normalised URL → pageId map drives the resolution.
  const pageIdByUrl = new Map<string, string>();
  const navLinksByFrom: Array<{ fromPageId: string; fromUrl: string; links: ExtractedNavLink[] }> = [];
  const normalizeUrl = (raw: string): string | null => {
    try {
      const u = new URL(raw);
      const path = u.pathname.replace(/\/+$/, '') || '/';
      return `${u.protocol}//${u.host.toLowerCase()}${path}`;
    } catch {
      return null;
    }
  };

  for (const art of artifacts) {
    if (!art.contentType.includes('html')) continue;
    const buf = args.downloadObject ? await args.downloadObject(art.storageKey) : Buffer.alloc(0);
    const html = buf.toString('utf-8');
    const extracted = await extract({ html, url: art.url, llmCall: geminiExtractCall });

    const pageId = randomUUID();
    await db.insert(schema.sitePages).values({
      id: pageId,
      merchantId: args.merchantId,
      url: art.url,
      pageType: extracted.pageType as PageType,
      title: extracted.title,
      h1: extracted.h1,
      lastSeenCrawlId: args.crawlId,
      meta: {},
    });

    const normFrom = normalizeUrl(art.url);
    if (normFrom) pageIdByUrl.set(normFrom, pageId);
    if (extracted.navLinks.length > 0) {
      navLinksByFrom.push({ fromPageId: pageId, fromUrl: art.url, links: extracted.navLinks });
    }

    for (const intent of extracted.intents) {
      await db.insert(schema.pageIntents).values({
        id: randomUUID(), merchantId: args.merchantId, pageId,
        intentKey: intent.intentKey, selectorHint: intent.selectorHint, intentMeta: {},
      });
    }

    for (const faq of extracted.faq) {
      await db.insert(schema.faqEntries).values({
        id: randomUUID(), merchantId: args.merchantId, pageId,
        question: faq.question, answer: faq.answer, sourceUrl: art.url,
      });
    }

    if (extracted.policy) {
      await db.insert(schema.policyDocuments).values({
        id: randomUUID(), merchantId: args.merchantId, pageId,
        policyType: extracted.policy.policyType,
        summary: extracted.policy.summary,
        fullText: extracted.policy.fullText,
      }).onConflictDoUpdate({
        target: [schema.policyDocuments.merchantId, schema.policyDocuments.policyType],
        set: {
          pageId,
          summary: extracted.policy.summary,
          fullText: extracted.policy.fullText,
        },
      });
    }

    if (extracted.product && !seenSkus.has(extracted.product.sku)) {
      seenSkus.add(extracted.product.sku);
      const p = extracted.product;
      await db.insert(schema.products).values({
        merchantId: args.merchantId,
        sku: p.sku,
        title: p.title,
        description: p.description,
        imageUrl: p.imageUrl,
        productUrl: art.url,
        variants: null,
        priceCents: p.priceCents,
        currency: p.currency,
        inStock: p.inStock,
        source: 'site_graph',
        sourceMeta: { brand: p.brand, jsonLd: p.raw },
      }).onConflictDoUpdate({
        target: [schema.products.merchantId, schema.products.sku],
        set: {
          title: p.title,
          description: p.description,
          imageUrl: p.imageUrl,
          productUrl: art.url,
          priceCents: p.priceCents,
          currency: p.currency,
          inStock: p.inStock,
          source: 'site_graph',
          sourceMeta: { brand: p.brand, jsonLd: p.raw },
          indexedAt: new Date(),
        },
      });
    }

    for (const media of extracted.media) {
      const hash = createHash('sha256').update(media.mediaUrl).digest('hex').slice(0, 16);
      if (seenHashes.has(hash)) continue;
      seenHashes.add(hash);
      let generatedAlt: string | null = null;
      let source: 'original' | 'generated' | 'enriched_original' = 'original';
      if (needsGeneratedAlt(media) && visionCallsUsed < visionCap) {
        generatedAlt = await generateAltText({ imageUrl: media.mediaUrl, visionFn });
        if (generatedAlt) {
          source = media.originalAlt ? 'enriched_original' : 'generated';
          visionCallsUsed += 1;
        }
      }
      await db.insert(schema.mediaIndex).values({
        id: randomUUID(), merchantId: args.merchantId, pageId,
        mediaUrl: media.mediaUrl, mediaType: media.mediaType, contentHash: hash,
        originalAlt: media.originalAlt || null, generatedAlt, source,
        role: media.role, posterFrameKey: null, durationMs: null,
        captionTrackUrl: null, generatedAt: generatedAlt ? new Date() : null,
      });
    }
  }

  // Second pass: resolve each page's nav links to internal target pages and write
  // site_nav_edges (the connected "brand tree"). Links to uncrawled/external URLs
  // or self-links are skipped; the unique (from,to,location) index dedupes.
  for (const { fromPageId, fromUrl, links } of navLinksByFrom) {
    for (const link of links) {
      let abs: string | null;
      try {
        abs = new URL(link.href, fromUrl).href;
      } catch {
        continue;
      }
      const norm = normalizeUrl(abs);
      if (!norm) continue;
      const toPageId = pageIdByUrl.get(norm);
      if (!toPageId || toPageId === fromPageId) continue;
      await db
        .insert(schema.siteNavEdges)
        .values({
          id: randomUUID(),
          merchantId: args.merchantId,
          fromPageId,
          toPageId,
          anchorText: link.anchorText || null,
          linkLocation: link.location,
        })
        .onConflictDoNothing();
    }
  }

  // Project sonnet addendum and cache it
  const graph = await loadSiteGraph(db, args.merchantId);
  const projection = projectSonnetAddendum(graph);
  await db.insert(schema.projectionCache).values({
    merchantId: args.merchantId,
    consumer: 'sonnet_addendum',
    output: projection.text,
    meta: { truncated: projection.truncated, truncatedSections: projection.truncatedSections },
    generatedAt: new Date(),
    sourceGraphVersion: (merchant.siteGraphVersion ?? 0) + 1,
  }).onConflictDoUpdate({
    target: [schema.projectionCache.merchantId, schema.projectionCache.consumer],
    set: {
      output: projection.text,
      meta: { truncated: projection.truncated, truncatedSections: projection.truncatedSections },
      generatedAt: new Date(),
      sourceGraphVersion: (merchant.siteGraphVersion ?? 0) + 1,
    },
  });

  await db.update(schema.merchants)
    .set({ siteGraphVersion: (merchant.siteGraphVersion ?? 0) + 1 })
    .where(eq(schema.merchants.id, args.merchantId));

  return { status: 'ok' };
}
