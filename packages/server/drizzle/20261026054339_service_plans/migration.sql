CREATE TYPE "service_plan_status" AS ENUM('active', 'on_hold', 'ended');--> statement-breakpoint
CREATE TABLE "service_plan_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"service_plan_id" uuid NOT NULL,
	"due_on" date NOT NULL,
	"job_id" uuid UNIQUE,
	"generated_at" timestamp with time zone NOT NULL,
	"skipped_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_plan_visits_one_per_day" UNIQUE("service_plan_id","due_on")
);
--> statement-breakpoint
CREATE TABLE "service_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"property_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL UNIQUE,
	"status" "service_plan_status" DEFAULT 'active'::"service_plan_status" NOT NULL,
	"recurrence" "recurrence" NOT NULL,
	"clean_type" "clean_type" NOT NULL,
	"labour_hours" numeric(6,2) NOT NULL,
	"crew_size" integer NOT NULL,
	"first_starts_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"started_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "charges" ADD COLUMN "service_plan_id" uuid;--> statement-breakpoint
ALTER TABLE "charges" ALTER COLUMN "job_id" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "charges_service_plan_id_idx" ON "charges" ("service_plan_id");--> statement-breakpoint
CREATE INDEX "service_plan_visits_unplaced_idx" ON "service_plan_visits" ("generated_at") WHERE "job_id" is null and "skipped_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "service_plans_one_per_property" ON "service_plans" ("property_id") WHERE "status" <> 'ended';--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_service_plan_id_service_plans_id_fkey" FOREIGN KEY ("service_plan_id") REFERENCES "service_plans"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "service_plan_visits" ADD CONSTRAINT "service_plan_visits_service_plan_id_service_plans_id_fkey" FOREIGN KEY ("service_plan_id") REFERENCES "service_plans"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "service_plan_visits" ADD CONSTRAINT "service_plan_visits_job_id_jobs_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "service_plans" ADD CONSTRAINT "service_plans_property_id_properties_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "service_plans" ADD CONSTRAINT "service_plans_quote_id_quotes_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "service_plans" ADD CONSTRAINT "service_plans_started_by_accounts_id_fkey" FOREIGN KEY ("started_by") REFERENCES "accounts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_job_or_service_plan" CHECK (("job_id" is null) <> ("service_plan_id" is null));