CREATE TABLE "razorpay_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"payload" jsonb
);
--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "razorpay_customer_id" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "razorpay_subscription_id" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_razorpay_customer_id_unique" UNIQUE("razorpay_customer_id");--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_razorpay_subscription_id_unique" UNIQUE("razorpay_subscription_id");