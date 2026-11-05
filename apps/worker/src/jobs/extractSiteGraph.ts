import { randomUUID, createHash } from 'node:crypto';
import { db as defaultDb, schema, type CrawlStats, type PageType } from '@shoppingmate/db';
import { isPathExcluded, pageKey } from '@shoppingmate/shared';
import { and, eq, inArray, isNull, isNotNull, notInArray } from 'drizzle-orm';
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

export type ExtractSiteGraphResult = {
  status: 'ok' | 'failed';
  error?: string;
  extracted?: number;
  failed?: number;
  products?: number;
};

const MEDIA_TYPES = new Set(['image', 'video', 'video_embed']);
const MEDIA_ROLES = new Set(['hero', 'product', 'decorative', 'background', 'icon']);
const LINK_LOCATIONS = new Set(['header', 'footer', 'body', 'breadcrumb']);

/**
 * Read a finished crawl into the knowledge base.
 *
 * NON-DESTRUCTIVE (2026-11-05 Calmosis re-scan): this used to DELETE every page
 * + FAQ for the merchant first and then rebuild; the owner clicked "Re-read" 3×,
 * three extractions ran at once, collided on unique keys / one null policy body,
 * and each crash left the knowledge base nearly empty (10 of ~90 pages, the new
 * Holistic Gummy page never read, the assistant's site summary stuck at June).
 * Now: each page is upserted by URL and its children replaced, one bad page is
 * recorded and skipped, and only pages that are really gone (no longer on the
 * site, skipped by the owner, or a "page not found" shell) are pruned at the end.
 */
export async function runExtractSiteGraph(args: ExtractSiteGraphArgs): Promise<ExtractSiteGraphResult> {
  const db = args.db ?? defaultDb;
  const extract = args.extractFn ?? ((opts) => extractStructured({ ...opts, llmCall: geminiExtractCall }));
  const visionFn = args.visionFn ?? geminiVisionCall;
  const visionCap = args.visionCap ?? 100;

  const merchant = await db.query.merchants.findFirst({
    where: eq(schema.merchants.id, args.merchantId),
  });
  if (!merchant) return { status: 'failed', error: 'merchant not found' };
  const excluded = (merchant.kbExcludedPaths ?? []) as string[];

  const crawl = await db.query.siteCrawls.findFirst({ where: eq(schema.siteCrawls.id, args.crawlId) });
  const stats: CrawlStats = { ...((crawl?.stats ?? {}) as CrawlStats) };

  const artifacts = await db.query.crawlArtifacts.findMany({
    where: eq(schema.crawlArtifacts.crawlId, args.crawlId),
  });

  try {
    let visionCallsUsed = 0;
    const seenHashes = new Set<string>();
    const seenSkus = new Set<string>();
    const seenPages = new Set<string>();
    const failed: Array<{ url: string; error: string }> = [];
    // URLs whose page row must survive the prune: read OK now, or failed now
    // (keep the last good copy rather than forgetting the page).
    const keepUrls = new Set<string>();
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
    let extracted = 0;
    let productCount = 0;

    for (const art of artifacts) {
      if (!art.contentType.includes('html')) continue;
      if (isPathExcluded(art.url, excluded)) continue;
      const key = pageKey(art.url);
      if (seenPages.has(key)) continue;
      seenPages.add(key);

      try {
        const buf = args.downloadObject ? await args.downloadObject(art.storageKey) : Buffer.alloc(0);
        const html = buf.toString('utf-8');
        const page = await extract({ html, url: art.url, llmCall: geminiExtractCall });

        const [row] = await db
          .insert(schema.sitePages)
          .values({
            id: randomUUID(),
            merchantId: args.merchantId,
            url: art.url,
            pageType: page.pageType as PageType,
            title: page.title,
            h1: page.h1,
            lastSeenCrawlId: args.crawlId,
            meta: {},
          })
          .onConflictDoUpdate({
            target: [schema.sitePages.merchantId, schema.sitePages.url],
            set: {
              pageType: page.pageType as PageType,
              title: page.title,
              h1: page.h1,
              lastSeenCrawlId: args.crawlId,
            },
          })
          .returning({ id: schema.sitePages.id });
        const pageId = row!.id;
        keepUrls.add(art.url);

        // Replace this page's children (policies/nav edges are handled separately).
        await db.delete(schema.pageIntents).where(eq(schema.pageIntents.pageId, pageId));
        await db.delete(schema.faqEntries).where(eq(schema.faqEntries.pageId, pageId));
        await db.delete(schema.mediaIndex).where(eq(schema.mediaIndex.pageId, pageId));

        const normFrom = normalizeUrl(art.url);
        if (normFrom) pageIdByUrl.set(normFrom, pageId);
        const links = page.navLinks.filter(
          (l) => typeof l?.href === 'string' && LINK_LOCATIONS.has(l.location as string),
        );
        if (links.length > 0) navLinksByFrom.push({ fromPageId: pageId, fromUrl: art.url, links });

        for (const intent of page.intents) {
          if (typeof intent?.intentKey !== 'string' || !intent.intentKey.trim()) continue;
          await db.insert(schema.pageIntents).values({
            id: randomUUID(), merchantId: args.merchantId, pageId,
            intentKey: intent.intentKey, selectorHint: intent.selectorHint ?? null, intentMeta: {},
          });
        }

        for (const faq of page.faq) {
          await db.insert(schema.faqEntries).values({
            id: randomUUID(), merchantId: args.merchantId, pageId,
            question: faq.question, answer: faq.answer, sourceUrl: art.url,
          });
        }

        if (page.policy) {
          await db.insert(schema.policyDocuments).values({
            id: randomUUID(), merchantId: args.merchantId, pageId,
            policyType: page.policy.policyType,
            summary: page.policy.summary,
            fullText: page.policy.fullText,
          }).onConflictDoUpdate({
            target: [schema.policyDocuments.merchantId, schema.policyDocuments.policyType],
            set: { pageId, summary: page.policy.summary, fullText: page.policy.fullText },
          });
        }

        if (page.product && !seenSkus.has(page.product.sku)) {
          seenSkus.add(page.product.sku);
          productCount += 1;
          const p = page.product;
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

        for (const media of page.media) {
          // Skip media the extractor returned without a URL — createHash().update(null) throws.
          if (!media?.mediaUrl || typeof media.mediaUrl !== 'string') continue;
          if (!MEDIA_TYPES.has(media.mediaType) || !MEDIA_ROLES.has(media.role)) continue;
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
          // The same image can still be owned by a page kept from an earlier
          // read — never let that abort the page.
          await db.insert(schema.mediaIndex).values({
            id: randomUUID(), merchantId: args.merchantId, pageId,
            mediaUrl: media.mediaUrl, mediaType: media.mediaType, contentHash: hash,
            originalAlt: media.originalAlt || null, generatedAlt, source,
            role: media.role, posterFrameKey: null, durationMs: null,
            captionTrackUrl: null, generatedAt: generatedAlt ? new Date() : null,
          }).onConflictDoNothing();
        }
        extracted += 1;
      } catch (err) {
        keepUrls.add(art.url);
        failed.push({ url: art.url, error: (err instanceof Error ? err.message : String(err)).slice(0, 200) });
      }
    }

    // Prune pages that are really gone: not read this time (and not a failed
    // read we're keeping). Skipped-by-owner, "not found" shells, duplicate
    // spellings and pages removed from the site all land here.
    // Nothing read at all (storage/LLM outage) — fail loudly and leave the
    // last good knowledge base exactly as it was.
    if (extracted === 0 && seenPages.size > 0) {
      throw new Error(`no pages could be read (${failed[0]?.error ?? 'unknown error'})`);
    }
    const keep = [...keepUrls];
    if (keep.length > 0) {
      await db
        .delete(schema.sitePages)
        .where(and(eq(schema.sitePages.merchantId, args.merchantId), notInArray(schema.sitePages.url, keep)));
    }
    // FAQs whose page was pruned are left with page_id NULL (onDelete set null).
    await db
      .delete(schema.faqEntries)
      .where(
        and(
          eq(schema.faqEntries.merchantId, args.merchantId),
          isNull(schema.faqEntries.pageId),
          isNotNull(schema.faqEntries.sourceUrl),
        ),
      );
    // Catalog products the owner skipped (their product page is excluded).
    if (excluded.length > 0) {
      const siteProducts = await db
        .select({ sku: schema.products.sku, productUrl: schema.products.productUrl })
        .from(schema.products)
        .where(and(eq(schema.products.merchantId, args.merchantId), eq(schema.products.source, 'site_graph')));
      const drop = siteProducts.filter((p) => p.productUrl && isPathExcluded(p.productUrl, excluded)).map((p) => p.sku);
      if (drop.length > 0) {
        await db
          .delete(schema.products)
          .where(and(eq(schema.products.merchantId, args.merchantId), inArray(schema.products.sku, drop)));
      }
    }

    // Second pass: resolve each page's nav links to internal target pages and
    // rebuild site_nav_edges (the connected "brand tree").
    await db.delete(schema.siteNavEdges).where(eq(schema.siteNavEdges.merchantId, args.merchantId));
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

    await reproject(db, args.merchantId, merchant.siteGraphVersion ?? 0);

    const finalStats: CrawlStats = { ...stats, extracted, failed, products: productCount };
    await db
      .update(schema.siteCrawls)
      .set({ status: 'ok', stats: finalStats, finishedAt: new Date(), errorSummary: null })
      .where(eq(schema.siteCrawls.id, args.crawlId));
    return { status: 'ok', extracted, failed: failed.length, products: productCount };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(schema.siteCrawls)
      .set({ status: 'failed', errorSummary: msg.slice(0, 500), finishedAt: new Date() })
      .where(eq(schema.siteCrawls.id, args.crawlId));
    throw err;
  }
}

/** Rebuild the assistant's site summary from the current graph and bump the version. */
export async function reproject(db: typeof defaultDb, merchantId: string, version: number): Promise<void> {
  const graph = await loadSiteGraph(db, merchantId);
  const projection = projectSonnetAddendum(graph);
  const next = version + 1;
  await db.insert(schema.projectionCache).values({
    merchantId,
    consumer: 'sonnet_addendum',
    output: projection.text,
    meta: { truncated: projection.truncated, truncatedSections: projection.truncatedSections },
    generatedAt: new Date(),
    sourceGraphVersion: next,
  }).onConflictDoUpdate({
    target: [schema.projectionCache.merchantId, schema.projectionCache.consumer],
    set: {
      output: projection.text,
      meta: { truncated: projection.truncated, truncatedSections: projection.truncatedSections },
      generatedAt: new Date(),
      sourceGraphVersion: next,
    },
  });
  await db.update(schema.merchants).set({ siteGraphVersion: next }).where(eq(schema.merchants.id, merchantId));
}

/**
 * Owner changed what to skip on the dashboard: drop the newly-skipped pages and
 * products right away (no LLM, seconds) and refresh the assistant's summary.
 * Pages the owner UN-skipped come back on the next read (the caller queues one).
 */
export async function applyKbExclusions(args: { merchantId: string; db?: typeof defaultDb }): Promise<{ removedPages: number; removedProducts: number }> {
  const db = args.db ?? defaultDb;
  const merchant = await db.query.merchants.findFirst({ where: eq(schema.merchants.id, args.merchantId) });
  if (!merchant) return { removedPages: 0, removedProducts: 0 };
  const excluded = (merchant.kbExcludedPaths ?? []) as string[];
  const pages = await db
    .select({ id: schema.sitePages.id, url: schema.sitePages.url })
    .from(schema.sitePages)
    .where(eq(schema.sitePages.merchantId, args.merchantId));
  const dropPages = pages.filter((p) => isPathExcluded(p.url, excluded)).map((p) => p.id);
  if (dropPages.length > 0) {
    await db.delete(schema.sitePages).where(inArray(schema.sitePages.id, dropPages));
    await db
      .delete(schema.faqEntries)
      .where(
        and(
          eq(schema.faqEntries.merchantId, args.merchantId),
          isNull(schema.faqEntries.pageId),
          isNotNull(schema.faqEntries.sourceUrl),
        ),
      );
  }
  const siteProducts = await db
    .select({ sku: schema.products.sku, productUrl: schema.products.productUrl })
    .from(schema.products)
    .where(and(eq(schema.products.merchantId, args.merchantId), eq(schema.products.source, 'site_graph')));
  const dropSkus = siteProducts.filter((p) => p.productUrl && isPathExcluded(p.productUrl, excluded)).map((p) => p.sku);
  if (dropSkus.length > 0) {
    await db
      .delete(schema.products)
      .where(and(eq(schema.products.merchantId, args.merchantId), inArray(schema.products.sku, dropSkus)));
  }
  await reproject(db, args.merchantId, merchant.siteGraphVersion ?? 0);
  return { removedPages: dropPages.length, removedProducts: dropSkus.length };
}
