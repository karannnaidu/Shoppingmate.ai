ALTER TABLE "selector_cache" ADD COLUMN "override_locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "selector_cache" ADD COLUMN "suggested_replacement" text;--> statement-breakpoint
ALTER TABLE "selector_cache" ADD COLUMN "alert_sent_at" timestamp with time zone;