import { randomUUID, createHash } from 'node:crypto';
import { db as defaultDb, schema, type PageType } from '@shoppingmate/db';
import { eq } from 'drizzle-orm';
import { loadSiteGraph, projectSonnetAddendum } from '@shoppingmate/site-graph';
import { extractStructured } from '../steps/siteGraph/extractStructured.js';
import { generateAltText, needsGeneratedAlt } from '../steps/siteGraph/vision.js';

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
  const extract = args.extractFn ?? ((opts) => extractStructured({ ...opts, llmCall: defaultLlm }));
  const visionFn = args.visionFn ?? defaultVision;
  const visionCap = args.visionCap ?? 100;

  const merchant = await db.query.merchants.findFirst({
    where: eq(schema.merchants.id, args.merchantId),
  });
  if (!merchant) return { status: 'failed', error: 'merchant not found' };

  const artifacts = await db.query.crawlArtifacts.findMany({
    where: eq(schema.crawlArtifacts.crawlId, args.crawlId),
  });

  let visionCallsUsed = 0;
  const seenHashes = new Set<string>();

  for (const art of artifacts) {
    if (!art.contentType.includes('html')) continue;
    const buf = args.downloadObject ? await args.downloadObject(art.storageKey) : Buffer.alloc(0);
    const html = buf.toString('utf-8');
    const extracted = await extract({ html, url: art.url, llmCall: defaultLlm });

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

async function defaultLlm(_prompt: string): Promise<unknown> {
  throw new Error('LLM not wired — provide extractFn arg');
}
async function defaultVision(_url: string): Promise<string> {
  throw new Error('Vision not wired — provide visionFn arg');
}
