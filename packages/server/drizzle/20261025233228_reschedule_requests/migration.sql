CREATE TYPE "reschedule_cost" AS ENUM('free', 'free_late', 'late_cancellation');--> statement-breakpoint
CREATE TYPE "reschedule_status" AS ENUM('pending', 'confirmed', 'turned_down', 'withdrawn');--> statement-breakpoint
CREATE TABLE "reschedule_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"job_id" uuid NOT NULL,
	"status" "reschedule_status" DEFAULT 'pending'::"reschedule_status" NOT NULL,
	"from_starts_at" timestamp with time zone NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"cost" "reschedule_cost" NOT NULL,
	"fee_cents" integer NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"requested_by" uuid,
	"by_client" boolean NOT NULL,
	"answered_at" timestamp with time zone,
	"answered_by" uuid,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "reschedule_fee_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "reschedule_requests_job_id_idx" ON "reschedule_requests" ("job_id");--> statement-breakpoint
CREATE INDEX "reschedule_requests_starts_at_idx" ON "reschedule_requests" ("starts_at") WHERE "status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "reschedule_requests_one_pending_per_job" ON "reschedule_requests" ("job_id") WHERE "status" = 'pending';--> statement-breakpoint
ALTER TABLE "reschedule_requests" ADD CONSTRAINT "reschedule_requests_job_id_jobs_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reschedule_requests" ADD CONSTRAINT "reschedule_requests_requested_by_accounts_id_fkey" FOREIGN KEY ("requested_by") REFERENCES "accounts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "reschedule_requests" ADD CONSTRAINT "reschedule_requests_answered_by_accounts_id_fkey" FOREIGN KEY ("answered_by") REFERENCES "accounts"("id") ON DELETE SET NULL;