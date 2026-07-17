ALTER TABLE "brand_kb_documents" ADD COLUMN IF NOT EXISTS "extracted_text" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "widget_position" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "widget_size" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "widget_accent" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "widget_label" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "widget_greeting" text;