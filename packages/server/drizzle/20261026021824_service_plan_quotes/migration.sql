CREATE TYPE "quote_kind" AS ENUM('one_off', 'service_plan');--> statement-breakpoint
CREATE TYPE "recurrence" AS ENUM('weekly', 'fortnightly', 'four_weekly');--> statement-breakpoint
DROP INDEX "quotes_one_sent_per_request";--> statement-breakpoint
ALTER TABLE "quote_options" ADD COLUMN "discount_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "property_id" uuid;--> statement-breakpoint
-- every Quote so far answers a Quote Request: it is for that request's home
UPDATE "quotes" SET "property_id" = "quote_requests"."property_id" FROM "quote_requests" WHERE "quote_requests"."id" = "quotes"."quote_request_id";--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "property_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "kind" "quote_kind" DEFAULT 'one_off'::"quote_kind" NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "recurrence" "recurrence";--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "plan_discount_percent" integer;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "condition" "condition";--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "quote_request_id" DROP NOT NULL;--> statement-breakpoint
DROP INDEX "quotes_one_draft_per_request";--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_one_draft_per_request" ON "quotes" ("quote_request_id") WHERE "status" = 'draft' and "quote_request_id" is not null;--> statement-breakpoint
CREATE INDEX "quotes_property_id_idx" ON "quotes" ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_one_sent_per_property_kind" ON "quotes" ("property_id","kind") WHERE "status" = 'sent';--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_one_plan_draft_per_property" ON "quotes" ("property_id") WHERE "status" = 'draft' and "kind" = 'service_plan';--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_property_id_properties_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;