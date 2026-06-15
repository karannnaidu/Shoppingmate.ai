CREATE TABLE "consultation_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"session_id" text,
	"name" text NOT NULL,
	"age" integer NOT NULL,
	"condition" text,
	"phone_country_code" text DEFAULT '+91' NOT NULL,
	"phone" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consultation_requests" ADD CONSTRAINT "consultation_requests_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consultation_requests_merchant_created_idx" ON "consultation_requests" USING btree ("merchant_id","created_at" DESC NULLS LAST);