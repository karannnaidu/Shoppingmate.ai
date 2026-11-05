ALTER TABLE "merchants" ADD COLUMN "kb_excluded_paths" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "site_crawls" ADD COLUMN "stats" jsonb;