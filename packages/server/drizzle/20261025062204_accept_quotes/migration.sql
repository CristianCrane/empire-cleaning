CREATE TYPE "charge_kind" AS ENUM('deposit');--> statement-breakpoint
ALTER TYPE "quote_status" ADD VALUE 'accepted' BEFORE 'declined';--> statement-breakpoint
CREATE TABLE "charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"job_id" uuid NOT NULL,
	"kind" "charge_kind" NOT NULL,
	"amount_cents" integer NOT NULL,
	"gateway_ref" text NOT NULL,
	"charged_at" timestamp with time zone NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"client_id" uuid PRIMARY KEY,
	"gateway_ref" text NOT NULL,
	"label" text NOT NULL,
	"saved_at" timestamp with time zone NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "booked_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "accepted_clean_type" "clean_type";--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "job_id" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "accepted_by" uuid;--> statement-breakpoint
CREATE INDEX "charges_job_id_idx" ON "charges" ("job_id");--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_job_id_jobs_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_client_id_clients_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_job_id_jobs_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_accepted_by_accounts_id_fkey" FOREIGN KEY ("accepted_by") REFERENCES "accounts"("id") ON DELETE SET NULL;