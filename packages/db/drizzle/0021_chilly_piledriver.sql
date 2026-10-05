CREATE TABLE "site_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"page_type" text NOT NULL,
	"url_pattern" text NOT NULL,
	"skeleton" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recipes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sample_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"screenshots" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'fresh' NOT NULL,
	"drift_reports" integer DEFAULT 0 NOT NULL,
	"verify_failures" integer DEFAULT 0 NOT NULL,
	"last_drift_at" timestamp with time zone,
	"scan_trigger" text,
	"scanned_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_templates" ADD CONSTRAINT "site_templates_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "site_templates_merchant_type_idx" ON "site_templates" USING btree ("merchant_id","page_type");--> statement-breakpoint
CREATE INDEX "site_templates_merchant_idx" ON "site_templates" USING btree ("merchant_id");