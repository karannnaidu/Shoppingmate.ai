CREATE TABLE "support_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"session_id" text,
	"visitor_id" text,
	"type" text NOT NULL,
	"summary" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"contact_name" text,
	"contact_phone" text,
	"contact_email" text,
	"consent" boolean DEFAULT false NOT NULL,
	"urgency" text DEFAULT 'normal' NOT NULL,
	"sentiment" text DEFAULT 'neutral' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_cases_merchant_created_idx" ON "support_cases" USING btree ("merchant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "support_cases_merchant_status_idx" ON "support_cases" USING btree ("merchant_id","status");