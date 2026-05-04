ALTER TABLE "merchants" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "plan" text DEFAULT 'starter' NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "billing_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "persona" jsonb;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "lead_webhook_url" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "knowledge_base_status" text DEFAULT 'empty' NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "last_widget_ping" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "topup_balance" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "auto_recharge_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "auto_recharge_threshold" integer;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "auto_recharge_pack_size" integer;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_stripe_customer_id_unique" UNIQUE("stripe_customer_id");--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id");