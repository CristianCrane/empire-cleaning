CREATE TYPE "cancelled_by" AS ENUM('client', 'empire');--> statement-breakpoint
ALTER TYPE "job_status" ADD VALUE 'cancelled';--> statement-breakpoint
ALTER TYPE "job_status" ADD VALUE 'no_access';--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "cancelled_by" "cancelled_by";--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "cancelled_by_account" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "late_cancellation" boolean;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "no_access_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "no_access_by" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "no_access_reason" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "fee_cents" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_cancelled_by_account_accounts_id_fkey" FOREIGN KEY ("cancelled_by_account") REFERENCES "accounts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_no_access_by_staff_id_fkey" FOREIGN KEY ("no_access_by") REFERENCES "staff"("id") ON DELETE SET NULL;