ALTER TABLE "service_plans" ADD COLUMN "ended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "service_plans" ADD COLUMN "ended_by" uuid;--> statement-breakpoint
ALTER TABLE "service_plans" ADD CONSTRAINT "service_plans_ended_by_accounts_id_fkey" FOREIGN KEY ("ended_by") REFERENCES "accounts"("id") ON DELETE SET NULL;