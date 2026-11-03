CREATE TYPE "charge_attempt_status" AS ENUM('pending', 'processing', 'taken', 'failed', 'given_back');--> statement-breakpoint
CREATE TYPE "refund_attempt_status" AS ENUM('pending', 'made', 'refused');--> statement-breakpoint
CREATE TABLE "charge_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"kind" "charge_kind" NOT NULL,
	"for_id" uuid NOT NULL,
	"request" jsonb NOT NULL,
	"status" "charge_attempt_status" DEFAULT 'pending'::"charge_attempt_status" NOT NULL,
	"amount_cents" integer NOT NULL,
	"gateway_ref" text,
	"reason" text,
	"asked_at" timestamp with time zone NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"for_id" uuid NOT NULL,
	"charge_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"item" text,
	"job_id" uuid,
	"credit_bill_id" uuid,
	"status" "refund_attempt_status" DEFAULT 'pending'::"refund_attempt_status" NOT NULL,
	"gateway_ref" text,
	"reason" text,
	"asked_at" timestamp with time zone NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "job_id" uuid;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "credit_bill_id" uuid;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "failed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pending_deposits" ADD COLUMN "changing_plan_id" uuid;--> statement-breakpoint
CREATE INDEX "charge_attempts_for_idx" ON "charge_attempts" ("kind","for_id");--> statement-breakpoint
CREATE INDEX "refund_attempts_for_idx" ON "refund_attempts" ("for_id");--> statement-breakpoint
CREATE INDEX "refunds_job_id_idx" ON "refunds" ("job_id");--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_job_id_jobs_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_credit_bill_id_bills_id_fkey" FOREIGN KEY ("credit_bill_id") REFERENCES "bills"("id") ON DELETE RESTRICT;