CREATE TYPE "clean_type" AS ENUM('standard', 'deep');--> statement-breakpoint
CREATE TYPE "job_status" AS ENUM('booked');--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"property_id" uuid NOT NULL,
	"clean_type" "clean_type" NOT NULL,
	"status" "job_status" DEFAULT 'booked'::"job_status" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"labour_hours" numeric(6,2) NOT NULL,
	"crew_size" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_availability_exceptions" (
	"staff_id" uuid,
	"date" date,
	"hours" numeric(4,2) NOT NULL,
	"note" text,
	CONSTRAINT "staff_availability_exceptions_pkey" PRIMARY KEY("staff_id","date")
);
--> statement-breakpoint
CREATE TABLE "staff_usual_hours" (
	"staff_id" uuid,
	"weekday" integer,
	"hours" numeric(4,2) NOT NULL,
	CONSTRAINT "staff_usual_hours_pkey" PRIMARY KEY("staff_id","weekday")
);
--> statement-breakpoint
CREATE INDEX "jobs_starts_at_idx" ON "jobs" ("starts_at");--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_property_id_properties_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "staff_availability_exceptions" ADD CONSTRAINT "staff_availability_exceptions_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "staff_usual_hours" ADD CONSTRAINT "staff_usual_hours_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE;