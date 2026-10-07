CREATE TABLE "brand_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"user_email" text,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"transcript" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"ops_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_tickets" ADD CONSTRAINT "brand_tickets_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brand_tickets_merchant_created" ON "brand_tickets" USING btree ("merchant_id","created_at");--> statement-breakpoint
CREATE INDEX "brand_tickets_status" ON "brand_tickets" USING btree ("status","created_at");