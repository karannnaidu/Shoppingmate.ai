CREATE TABLE "brand_playbooks" (
	"merchant_id" text PRIMARY KEY NOT NULL,
	"playbook" text NOT NULL,
	"based_on_count" integer DEFAULT 0 NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_playbooks" ADD CONSTRAINT "brand_playbooks_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;