CREATE TYPE "site_visit_status" AS ENUM('booked', 'done', 'cancelled');--> statement-breakpoint
CREATE TABLE "site_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"property_id" uuid NOT NULL,
	"status" "site_visit_status" DEFAULT 'booked'::"site_visit_status" NOT NULL,
	"staff_id" uuid,
	"starts_at" timestamp with time zone,
	"minutes" integer DEFAULT 30 NOT NULL,
	"booked_at" timestamp with time zone NOT NULL,
	"booked_by" uuid,
	"done_at" timestamp with time zone,
	"recorded_by" uuid,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "site_visits_visited" CHECK ("status" = 'done' or ("staff_id" is not null and "starts_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "office_notes" text;--> statement-breakpoint
CREATE INDEX "site_visits_starts_at_idx" ON "site_visits" ("starts_at");--> statement-breakpoint
CREATE INDEX "site_visits_property_id_idx" ON "site_visits" ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "site_visits_one_booked_per_property" ON "site_visits" ("property_id") WHERE "status" = 'booked';--> statement-breakpoint
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_property_id_properties_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_booked_by_accounts_id_fkey" FOREIGN KEY ("booked_by") REFERENCES "accounts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_recorded_by_accounts_id_fkey" FOREIGN KEY ("recorded_by") REFERENCES "accounts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_cancelled_by_accounts_id_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "accounts"("id") ON DELETE SET NULL;