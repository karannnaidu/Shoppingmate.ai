ALTER TABLE "products" ALTER COLUMN "indexed_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "indexed_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "source" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "catalog_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "smoke_passed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "source_meta" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', coalesce(title,'')), 'A') || setweight(to_tsvector('simple', coalesce(description,'')), 'B')) STORED;--> statement-breakpoint
CREATE INDEX "products_search_idx" ON "products" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "products_merchant_indexed_idx" ON "products" USING btree ("merchant_id","indexed_at" DESC NULLS LAST);