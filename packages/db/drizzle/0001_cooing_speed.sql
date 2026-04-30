CREATE TABLE "install_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"merchant_id" text,
	"domain" text NOT NULL,
	"source_ip" text NOT NULL,
	"user_agent" text NOT NULL,
	"referer" text,
	"outcome" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchants" ALTER COLUMN "adapter_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "allowed_domains" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "last_install_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "last_fingerprinted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "safety_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "install_attempts" ADD CONSTRAINT "install_attempts_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "install_attempts_merchant_created_idx" ON "install_attempts" USING btree ("merchant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "install_attempts_source_ip_created_idx" ON "install_attempts" USING btree ("source_ip","created_at" DESC NULLS LAST);