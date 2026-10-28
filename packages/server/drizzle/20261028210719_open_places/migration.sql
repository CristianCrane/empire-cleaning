CREATE TABLE "open_place_digests" (
	"staff_id" uuid PRIMARY KEY,
	"day" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "open_place_emails" (
	"job_id" uuid,
	"staff_id" uuid,
	"emailed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "open_place_emails_pkey" PRIMARY KEY("job_id","staff_id")
);
--> statement-breakpoint
CREATE TABLE "open_place_passes" (
	"job_id" uuid,
	"staff_id" uuid,
	"passed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "open_place_passes_pkey" PRIMARY KEY("job_id","staff_id")
);
--> statement-breakpoint
ALTER TABLE "open_place_digests" ADD CONSTRAINT "open_place_digests_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "open_place_emails" ADD CONSTRAINT "open_place_emails_job_id_jobs_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "open_place_emails" ADD CONSTRAINT "open_place_emails_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "open_place_passes" ADD CONSTRAINT "open_place_passes_job_id_jobs_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "open_place_passes" ADD CONSTRAINT "open_place_passes_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE;