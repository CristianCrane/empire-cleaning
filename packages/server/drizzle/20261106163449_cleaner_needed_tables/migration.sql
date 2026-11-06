ALTER TABLE "open_place_digests" RENAME TO "cleaner_needed_digests";--> statement-breakpoint
ALTER TABLE "open_place_emails" RENAME TO "cleaner_needed_emails";--> statement-breakpoint
ALTER TABLE "open_place_passes" RENAME TO "cleaner_needed_passes";--> statement-breakpoint
ALTER INDEX "assignments_one_place_per_staff" RENAME TO "assignments_once_per_crew";--> statement-breakpoint
ALTER TABLE "cleaner_needed_digests" RENAME CONSTRAINT "open_place_digests_staff_id_staff_id_fkey" TO "cleaner_needed_digests_staff_id_staff_id_fkey";--> statement-breakpoint
ALTER TABLE "cleaner_needed_emails" RENAME CONSTRAINT "open_place_emails_job_id_jobs_id_fkey" TO "cleaner_needed_emails_job_id_jobs_id_fkey";--> statement-breakpoint
ALTER TABLE "cleaner_needed_emails" RENAME CONSTRAINT "open_place_emails_staff_id_staff_id_fkey" TO "cleaner_needed_emails_staff_id_staff_id_fkey";--> statement-breakpoint
ALTER TABLE "cleaner_needed_passes" RENAME CONSTRAINT "open_place_passes_job_id_jobs_id_fkey" TO "cleaner_needed_passes_job_id_jobs_id_fkey";--> statement-breakpoint
ALTER TABLE "cleaner_needed_passes" RENAME CONSTRAINT "open_place_passes_staff_id_staff_id_fkey" TO "cleaner_needed_passes_staff_id_staff_id_fkey";--> statement-breakpoint
ALTER TABLE "cleaner_needed_emails" RENAME CONSTRAINT "open_place_emails_pkey" TO "cleaner_needed_emails_pkey";--> statement-breakpoint
ALTER TABLE "cleaner_needed_passes" RENAME CONSTRAINT "open_place_passes_pkey" TO "cleaner_needed_passes_pkey";--> statement-breakpoint
ALTER TABLE "cleaner_needed_digests" RENAME CONSTRAINT "open_place_digests_pkey" TO "cleaner_needed_digests_pkey";
