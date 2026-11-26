-- When the Client last turned a Job's or Bill's payment down at their bank
-- (#534's critical review C14), read only while its unpaid_reason says so.
-- No backfill: that reason is new in the same change, so no row holds it.
ALTER TABLE "bills" ADD COLUMN "refused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "refused_at" timestamp with time zone;
