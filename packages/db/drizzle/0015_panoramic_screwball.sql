CREATE TABLE "visitor_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"visitor_id" text NOT NULL,
	"identity" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"top_intents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"needs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"objections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"products_of_interest" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_outcome" text,
	"last_drop_stage" text,
	"session_count" integer DEFAULT 0 NOT NULL,
	"lifetime_value_cents" integer DEFAULT 0 NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visitor_profiles" ADD CONSTRAINT "visitor_profiles_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "visitor_profiles_merchant_visitor" ON "visitor_profiles" USING btree ("merchant_id","visitor_id");--> statement-breakpoint
CREATE INDEX "visitor_profiles_merchant" ON "visitor_profiles" USING btree ("merchant_id");