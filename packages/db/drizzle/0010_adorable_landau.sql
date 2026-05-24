CREATE TABLE "crawl_artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"crawl_id" text NOT NULL,
	"url" text NOT NULL,
	"url_hash" text NOT NULL,
	"content_type" text NOT NULL,
	"storage_key" text NOT NULL,
	"byte_size" integer NOT NULL,
	"http_status" integer NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faq_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"page_id" text,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"source_url" text
);
--> statement-breakpoint
CREATE TABLE "media_index" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"page_id" text NOT NULL,
	"media_url" text NOT NULL,
	"media_type" text NOT NULL,
	"content_hash" text NOT NULL,
	"original_alt" text,
	"generated_alt" text,
	"source" text NOT NULL,
	"role" text NOT NULL,
	"poster_frame_key" text,
	"duration_ms" integer,
	"caption_track_url" text,
	"generated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "page_intents" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"page_id" text NOT NULL,
	"intent_key" text NOT NULL,
	"selector_hint" text,
	"intent_meta" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"page_id" text NOT NULL,
	"policy_type" text NOT NULL,
	"summary" text NOT NULL,
	"full_text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projection_cache" (
	"merchant_id" text NOT NULL,
	"consumer" text NOT NULL,
	"output" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"source_graph_version" integer NOT NULL,
	CONSTRAINT "projection_cache_merchant_id_consumer_pk" PRIMARY KEY("merchant_id","consumer")
);
--> statement-breakpoint
CREATE TABLE "site_crawls" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"root_url" text NOT NULL,
	"page_count" integer DEFAULT 0 NOT NULL,
	"error_summary" text
);
--> statement-breakpoint
CREATE TABLE "site_nav_edges" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"from_page_id" text NOT NULL,
	"to_page_id" text NOT NULL,
	"anchor_text" text,
	"link_location" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"url" text NOT NULL,
	"page_type" text NOT NULL,
	"title" text,
	"h1" text,
	"last_seen_crawl_id" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visitor_events" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"session_id" text NOT NULL,
	"action" text NOT NULL,
	"intent_key" text,
	"url" text NOT NULL,
	"element_label" text,
	"ts" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "site_graph_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "site_graph_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "crawl_artifacts" ADD CONSTRAINT "crawl_artifacts_crawl_id_site_crawls_id_fk" FOREIGN KEY ("crawl_id") REFERENCES "public"."site_crawls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq_entries" ADD CONSTRAINT "faq_entries_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq_entries" ADD CONSTRAINT "faq_entries_page_id_site_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."site_pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_index" ADD CONSTRAINT "media_index_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_index" ADD CONSTRAINT "media_index_page_id_site_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."site_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_intents" ADD CONSTRAINT "page_intents_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_intents" ADD CONSTRAINT "page_intents_page_id_site_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."site_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_documents" ADD CONSTRAINT "policy_documents_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_documents" ADD CONSTRAINT "policy_documents_page_id_site_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."site_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projection_cache" ADD CONSTRAINT "projection_cache_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_crawls" ADD CONSTRAINT "site_crawls_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_nav_edges" ADD CONSTRAINT "site_nav_edges_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_nav_edges" ADD CONSTRAINT "site_nav_edges_from_page_id_site_pages_id_fk" FOREIGN KEY ("from_page_id") REFERENCES "public"."site_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_nav_edges" ADD CONSTRAINT "site_nav_edges_to_page_id_site_pages_id_fk" FOREIGN KEY ("to_page_id") REFERENCES "public"."site_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_pages" ADD CONSTRAINT "site_pages_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_pages" ADD CONSTRAINT "site_pages_last_seen_crawl_id_site_crawls_id_fk" FOREIGN KEY ("last_seen_crawl_id") REFERENCES "public"."site_crawls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_events" ADD CONSTRAINT "visitor_events_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crawl_artifacts_crawl_idx" ON "crawl_artifacts" USING btree ("crawl_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crawl_artifacts_crawl_url_hash_idx" ON "crawl_artifacts" USING btree ("crawl_id","url_hash");--> statement-breakpoint
CREATE INDEX "faq_entries_merchant_idx" ON "faq_entries" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_index_hash_idx" ON "media_index" USING btree ("merchant_id","content_hash");--> statement-breakpoint
CREATE INDEX "page_intents_page_idx" ON "page_intents" USING btree ("merchant_id","page_id");--> statement-breakpoint
CREATE UNIQUE INDEX "policy_documents_merchant_type_idx" ON "policy_documents" USING btree ("merchant_id","policy_type");--> statement-breakpoint
CREATE INDEX "site_crawls_merchant_idx" ON "site_crawls" USING btree ("merchant_id","started_at");--> statement-breakpoint
CREATE INDEX "site_nav_edges_from_idx" ON "site_nav_edges" USING btree ("merchant_id","from_page_id");--> statement-breakpoint
CREATE UNIQUE INDEX "site_nav_edges_unique_idx" ON "site_nav_edges" USING btree ("from_page_id","to_page_id","link_location");--> statement-breakpoint
CREATE UNIQUE INDEX "site_pages_merchant_url_idx" ON "site_pages" USING btree ("merchant_id","url");--> statement-breakpoint
CREATE INDEX "visitor_events_session_idx" ON "visitor_events" USING btree ("merchant_id","session_id","ts");