CREATE TABLE "insight_counters" (
	"merchant_id" text NOT NULL,
	"day" date NOT NULL,
	"metric" text NOT NULL,
	"dim_key" text NOT NULL,
	"count" bigint DEFAULT 0 NOT NULL,
	"total" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insight_pageviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"session_id" text NOT NULL,
	"page_type" text NOT NULL,
	"path" text NOT NULL,
	"device" text NOT NULL,
	"summary" jsonb NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insight_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"week_start" date NOT NULL,
	"summary" text NOT NULL,
	"at_risk" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"fixes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"facts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"emailed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "insight_counters" ADD CONSTRAINT "insight_counters_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_pageviews" ADD CONSTRAINT "insight_pageviews_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_reports" ADD CONSTRAINT "insight_reports_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "insight_counters_uniq" ON "insight_counters" USING btree ("merchant_id","day","metric","dim_key");--> statement-breakpoint
CREATE INDEX "insight_counters_merchant_metric_day" ON "insight_counters" USING btree ("merchant_id","metric","day");--> statement-breakpoint
CREATE INDEX "insight_pageviews_merchant_created" ON "insight_pageviews" USING btree ("merchant_id","created_at");--> statement-breakpoint
CREATE INDEX "insight_pageviews_session" ON "insight_pageviews" USING btree ("merchant_id","session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "insight_reports_merchant_week" ON "insight_reports" USING btree ("merchant_id","week_start");