CREATE TYPE "assignment_status" AS ENUM('offered', 'confirmed', 'released');--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"job_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"status" "assignment_status" DEFAULT 'offered'::"assignment_status" NOT NULL,
	"offered_at" timestamp with time zone NOT NULL,
	"answered_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "assignments_job_id_idx" ON "assignments" ("job_id");--> statement-breakpoint
CREATE INDEX "assignments_staff_id_idx" ON "assignments" ("staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assignments_one_place_per_staff" ON "assignments" ("job_id","staff_id") WHERE "status" <> 'released';--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_job_id_jobs_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT;