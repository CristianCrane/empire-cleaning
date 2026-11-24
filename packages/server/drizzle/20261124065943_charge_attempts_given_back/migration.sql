ALTER TABLE "charge_attempts" ADD COLUMN "given_back_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "charge_attempts" ADD COLUMN "given_back_why" text;