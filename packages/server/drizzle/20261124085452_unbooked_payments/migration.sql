ALTER TABLE "charge_attempts" ADD COLUMN "given_back_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "charge_attempts" ADD COLUMN "bank_finishing_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pending_deposits" ADD COLUMN "unbooked_why" text;