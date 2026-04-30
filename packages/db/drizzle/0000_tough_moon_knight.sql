CREATE TABLE "billing_ledger" (
	"merchant_id" text NOT NULL,
	"period" date NOT NULL,
	"conversations_count" integer DEFAULT 0 NOT NULL,
	"voice_minutes" numeric DEFAULT '0' NOT NULL,
	"conversion_value_cents" bigint DEFAULT 0 NOT NULL,
	"llm_cost_usd" numeric DEFAULT '0' NOT NULL,
	"stt_cost_usd" numeric DEFAULT '0' NOT NULL,
	"tts_cost_usd" numeric DEFAULT '0' NOT NULL,
	CONSTRAINT "billing_ledger_merchant_id_period_pk" PRIMARY KEY("merchant_id","period")
);
--> statement-breakpoint
CREATE TABLE "conversion_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"session_id" text NOT NULL,
	"order_id" text,
	"total_cents" integer,
	"currency" text,
	"ts" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" text PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"platform" text,
	"platform_confidence" numeric,
	"status" text NOT NULL,
	"adapter_type" text NOT NULL,
	"adapter_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cart_url_template" text,
	"checkout_url" text,
	"coupon_field_selector" text,
	"policy_urls" jsonb,
	"persona_id" text DEFAULT 'concierge' NOT NULL,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_indexed_at" timestamp with time zone,
	CONSTRAINT "merchants_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"merchant_id" text NOT NULL,
	"sku" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"image_url" text,
	"product_url" text NOT NULL,
	"variants" jsonb,
	"price_cents" integer,
	"currency" text,
	"in_stock" boolean,
	"indexed_at" timestamp with time zone,
	"source" text,
	CONSTRAINT "products_merchant_id_sku_pk" PRIMARY KEY("merchant_id","sku")
);
--> statement-breakpoint
CREATE TABLE "selector_cache" (
	"merchant_id" text NOT NULL,
	"page_template_hash" text NOT NULL,
	"selector_key" text NOT NULL,
	"resolved_selector" text NOT NULL,
	"source" text NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"last_tested_at" timestamp with time zone,
	"last_test_passed" boolean,
	CONSTRAINT "selector_cache_merchant_id_page_template_hash_selector_key_pk" PRIMARY KEY("merchant_id","page_template_hash","selector_key")
);
--> statement-breakpoint
CREATE TABLE "metric_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"metric_name" text NOT NULL,
	"value" numeric DEFAULT '1' NOT NULL,
	"tags" jsonb,
	"ts" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_ledger" ADD CONSTRAINT "billing_ledger_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversion_events" ADD CONSTRAINT "conversion_events_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selector_cache" ADD CONSTRAINT "selector_cache_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_events" ADD CONSTRAINT "metric_events_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "metric_events_merchant_metric_ts_idx" ON "metric_events" USING btree ("merchant_id","metric_name","ts" DESC NULLS LAST);