CREATE TABLE "conversation_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"visitor_id" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "recommendation_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"sku" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversion_events" ALTER COLUMN "session_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "conversion_events" ALTER COLUMN "order_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "conversion_events" ALTER COLUMN "total_cents" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "conversion_events" ALTER COLUMN "currency" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "conversion_events" ADD COLUMN "attribution_kind" text NOT NULL;--> statement-breakpoint
ALTER TABLE "conversion_events" ADD COLUMN "attribution_window_days" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "conversion_events" ADD COLUMN "match_source" text NOT NULL;--> statement-breakpoint
ALTER TABLE "conversion_events" ADD COLUMN "visitor_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "conversion_events" ADD COLUMN "line_items" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "conversion_events" ADD COLUMN "occurred_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "conversion_events" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "script_secret" text;--> statement-breakpoint
ALTER TABLE "conversation_sessions" ADD CONSTRAINT "conversation_sessions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_events" ADD CONSTRAINT "recommendation_events_session_id_conversation_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."conversation_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_sessions_merchant_visitor_ended_idx" ON "conversation_sessions" USING btree ("merchant_id","visitor_id","ended_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "recommendation_events_session_sku_idx" ON "recommendation_events" USING btree ("session_id","sku");--> statement-breakpoint
CREATE UNIQUE INDEX "conversion_events_merchant_order_kind_uniq" ON "conversion_events" USING btree ("merchant_id","order_id","attribution_kind");--> statement-breakpoint
CREATE INDEX "conversion_events_merchant_occurred_idx" ON "conversion_events" USING btree ("merchant_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "conversion_events" DROP COLUMN "ts";