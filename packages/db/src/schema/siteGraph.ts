import {
  index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { merchants } from './merchants.js';

export const crawlStatuses = ['pending', 'running', 'ok', 'failed'] as const;
export type CrawlStatus = (typeof crawlStatuses)[number];

export const pageTypes = ['home', 'pdp', 'plp', 'collection', 'policy', 'faq', 'other'] as const;
export type PageType = (typeof pageTypes)[number];

export const linkLocations = ['header', 'footer', 'body', 'breadcrumb'] as const;
export type LinkLocation = (typeof linkLocations)[number];

export const policyTypes = ['returns', 'shipping', 'privacy', 'terms'] as const;
export type PolicyType = (typeof policyTypes)[number];

export const mediaTypes = ['image', 'video', 'video_embed'] as const;
export type MediaType = (typeof mediaTypes)[number];

export const mediaSources = ['original', 'generated', 'enriched_original'] as const;
export type MediaSource = (typeof mediaSources)[number];

export const mediaRoles = ['hero', 'product', 'decorative', 'background', 'icon'] as const;
export type MediaRole = (typeof mediaRoles)[number];

export const projectionConsumers = [
  'sonnet_addendum', 'ucp_manifest', 'acp_feed', 'openkarta',
] as const;
export type ProjectionConsumer = (typeof projectionConsumers)[number];

export const visitorActions = [
  'click', 'route_change', 'dwell', 'cart_add', 'form_focus', 'outbound_click',
] as const;
export type VisitorActionType = (typeof visitorActions)[number];

export const siteCrawls = pgTable(
  'site_crawls',
  {
    id: text('id').primaryKey(),
    merchantId: text('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    status: text('status').$type<CrawlStatus>().notNull(),
    rootUrl: text('root_url').notNull(),
    pageCount: integer('page_count').notNull().default(0),
    errorSummary: text('error_summary'),
  },
  (t) => ({
    byMerchant: index('site_crawls_merchant_idx').on(t.merchantId, t.startedAt),
  }),
);

export const crawlArtifacts = pgTable(
  'crawl_artifacts',
  {
    id: text('id').primaryKey(),
    crawlId: text('crawl_id').notNull().references(() => siteCrawls.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    urlHash: text('url_hash').notNull(),
    contentType: text('content_type').notNull(),
    storageKey: text('storage_key').notNull(),
    byteSize: integer('byte_size').notNull(),
    httpStatus: integer('http_status').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    byCrawl: index('crawl_artifacts_crawl_idx').on(t.crawlId),
    uniqByCrawlUrl: uniqueIndex('crawl_artifacts_crawl_url_hash_idx').on(t.crawlId, t.urlHash),
  }),
);

export const sitePages = pgTable(
  'site_pages',
  {
    id: text('id').primaryKey(),
    merchantId: text('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    pageType: text('page_type').$type<PageType>().notNull(),
    title: text('title'),
    h1: text('h1'),
    lastSeenCrawlId: text('last_seen_crawl_id').references(() => siteCrawls.id, { onDelete: 'set null' }),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => ({
    uniqByMerchantUrl: uniqueIndex('site_pages_merchant_url_idx').on(t.merchantId, t.url),
  }),
);

export const siteNavEdges = pgTable(
  'site_nav_edges',
  {
    id: text('id').primaryKey(),
    merchantId: text('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
    fromPageId: text('from_page_id').notNull().references(() => sitePages.id, { onDelete: 'cascade' }),
    toPageId: text('to_page_id').notNull().references(() => sitePages.id, { onDelete: 'cascade' }),
    anchorText: text('anchor_text'),
    linkLocation: text('link_location').$type<LinkLocation>().notNull(),
  },
  (t) => ({
    byFrom: index('site_nav_edges_from_idx').on(t.merchantId, t.fromPageId),
    uniqEdge: uniqueIndex('site_nav_edges_unique_idx').on(t.fromPageId, t.toPageId, t.linkLocation),
  }),
);

export const pageIntents = pgTable(
  'page_intents',
  {
    id: text('id').primaryKey(),
    merchantId: text('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
    pageId: text('page_id').notNull().references(() => sitePages.id, { onDelete: 'cascade' }),
    intentKey: text('intent_key').notNull(),
    selectorHint: text('selector_hint'),
    intentMeta: jsonb('intent_meta').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => ({
    byPage: index('page_intents_page_idx').on(t.merchantId, t.pageId),
  }),
);

export const faqEntries = pgTable(
  'faq_entries',
  {
    id: text('id').primaryKey(),
    merchantId: text('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
    pageId: text('page_id').references(() => sitePages.id, { onDelete: 'set null' }),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    sourceUrl: text('source_url'),
  },
  (t) => ({
    byMerchant: index('faq_entries_merchant_idx').on(t.merchantId),
  }),
);

export const policyDocuments = pgTable(
  'policy_documents',
  {
    id: text('id').primaryKey(),
    merchantId: text('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
    pageId: text('page_id').notNull().references(() => sitePages.id, { onDelete: 'cascade' }),
    policyType: text('policy_type').$type<PolicyType>().notNull(),
    summary: text('summary').notNull(),
    fullText: text('full_text').notNull(),
  },
  (t) => ({
    byMerchantType: uniqueIndex('policy_documents_merchant_type_idx').on(t.merchantId, t.policyType),
  }),
);

export const mediaIndex = pgTable(
  'media_index',
  {
    id: text('id').primaryKey(),
    merchantId: text('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
    pageId: text('page_id').notNull().references(() => sitePages.id, { onDelete: 'cascade' }),
    mediaUrl: text('media_url').notNull(),
    mediaType: text('media_type').$type<MediaType>().notNull(),
    contentHash: text('content_hash').notNull(),
    originalAlt: text('original_alt'),
    generatedAlt: text('generated_alt'),
    source: text('source').$type<MediaSource>().notNull(),
    role: text('role').$type<MediaRole>().notNull(),
    posterFrameKey: text('poster_frame_key'),
    durationMs: integer('duration_ms'),
    captionTrackUrl: text('caption_track_url'),
    generatedAt: timestamp('generated_at', { withTimezone: true }),
  },
  (t) => ({
    byHash: uniqueIndex('media_index_hash_idx').on(t.merchantId, t.contentHash),
  }),
);

export const projectionCache = pgTable(
  'projection_cache',
  {
    merchantId: text('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
    consumer: text('consumer').$type<ProjectionConsumer>().notNull(),
    output: text('output').notNull(),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull(),
    sourceGraphVersion: integer('source_graph_version').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.merchantId, t.consumer] }),
  }),
);

export const visitorEvents = pgTable(
  'visitor_events',
  {
    id: text('id').primaryKey(),
    merchantId: text('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull(),
    action: text('action').$type<VisitorActionType>().notNull(),
    intentKey: text('intent_key'),
    url: text('url').notNull(),
    elementLabel: text('element_label'),
    ts: timestamp('ts', { withTimezone: true }).notNull(),
  },
  (t) => ({
    bySession: index('visitor_events_session_idx').on(t.merchantId, t.sessionId, t.ts),
  }),
);

export type SiteCrawlRow = typeof siteCrawls.$inferSelect;
export type CrawlArtifactRow = typeof crawlArtifacts.$inferSelect;
export type SitePageRow = typeof sitePages.$inferSelect;
export type SiteNavEdgeRow = typeof siteNavEdges.$inferSelect;
export type PageIntentRow = typeof pageIntents.$inferSelect;
export type FaqEntryRow = typeof faqEntries.$inferSelect;
export type PolicyDocumentRow = typeof policyDocuments.$inferSelect;
export type MediaIndexRow = typeof mediaIndex.$inferSelect;
export type ProjectionCacheRow = typeof projectionCache.$inferSelect;
export type VisitorEventRow = typeof visitorEvents.$inferSelect;
