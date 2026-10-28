CREATE TABLE "care_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"order_number" text NOT NULL,
	"source" text NOT NULL,
	"email_hash" text,
	"phone_last4" text,
	"status" text NOT NULL,
	"order" jsonb NOT NULL,
	"placed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"case_id" integer,
	"session_id" text NOT NULL,
	"r2_key" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_id" integer NOT NULL,
	"kind" text NOT NULL,
	"body" text,
	"actor" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "support_email" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "care_settings" jsonb;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "order_api_key_hash" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "shiprocket_enc" text;--> statement-breakpoint
ALTER TABLE "support_cases" ADD COLUMN "order_id" text;--> statement-breakpoint
ALTER TABLE "support_cases" ADD COLUMN "order_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "care_orders" ADD CONSTRAINT "care_orders_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_attachments" ADD CONSTRAINT "case_attachments_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_attachments" ADD CONSTRAINT "case_attachments_case_id_support_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."support_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_events" ADD CONSTRAINT "case_events_case_id_support_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."support_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "care_orders_merchant_number_uq" ON "care_orders" USING btree ("merchant_id","order_number");--> statement-breakpoint
CREATE INDEX "case_attachments_case_idx" ON "case_attachments" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "case_attachments_session_idx" ON "case_attachments" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "case_attachments_created_idx" ON "case_attachments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "case_events_case_idx" ON "case_events" USING btree ("case_id","created_at");