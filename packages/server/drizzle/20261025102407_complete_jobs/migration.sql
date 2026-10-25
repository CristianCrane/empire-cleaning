CREATE TYPE "adjustment_kind" AS ENUM('add_on_done', 'add_on_not_done', 'extra_time');--> statement-breakpoint
CREATE TYPE "adjustment_status" AS ENUM('applied', 'reported', 'dismissed', 'proposed', 'approved', 'declined', 'lapsed');--> statement-breakpoint
ALTER TYPE "job_status" ADD VALUE 'completed';--> statement-breakpoint
ALTER TYPE "charge_kind" ADD VALUE 'balance';--> statement-breakpoint
CREATE TABLE "adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"job_id" uuid NOT NULL,
	"kind" "adjustment_kind" NOT NULL,
	"add_on_key" uuid,
	"add_on_name" text,
	"hours" numeric(6,2),
	"reason" text NOT NULL,
	"status" "adjustment_status" NOT NULL,
	"worked_out_cents" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"tax_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"tax_exempt" boolean DEFAULT false NOT NULL,
	"office_reason" text,
	"reported_by" uuid,
	"reported_at" timestamp with time zone NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"proposed_at" timestamp with time zone,
	"answered_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"charge_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"gateway_ref" text NOT NULL,
	"refunded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "completed_by" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "reported_condition" "condition";--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "condition_before" "condition";--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "unpaid_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "unpaid_reason" text;--> statement-breakpoint
CREATE INDEX "adjustments_job_id_idx" ON "adjustments" ("job_id");--> statement-breakpoint
CREATE INDEX "jobs_unpaid_idx" ON "jobs" ("unpaid_since") WHERE "unpaid_since" is not null;--> statement-breakpoint
CREATE INDEX "refunds_charge_id_idx" ON "refunds" ("charge_id");--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_job_id_jobs_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_reported_by_staff_id_fkey" FOREIGN KEY ("reported_by") REFERENCES "staff"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_reviewed_by_accounts_id_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "accounts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_completed_by_staff_id_fkey" FOREIGN KEY ("completed_by") REFERENCES "staff"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_charge_id_charges_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE RESTRICT;