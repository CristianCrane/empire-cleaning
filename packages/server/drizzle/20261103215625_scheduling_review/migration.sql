ALTER TYPE "reschedule_status" ADD VALUE 'closed';--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "taken_off_at" timestamp with time zone;