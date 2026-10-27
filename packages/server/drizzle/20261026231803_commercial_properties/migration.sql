CREATE TYPE "offered_for" AS ENUM('homes', 'businesses', 'both');--> statement-breakpoint
CREATE TYPE "property_kind" AS ENUM('residential', 'commercial');--> statement-breakpoint
CREATE TABLE "price_list_premises_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"price_list_id" uuid NOT NULL,
	"key" uuid NOT NULL,
	"name" text NOT NULL,
	"hours_per_thousand_sq_ft" numeric(6,2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "price_list_premises_types_version_key" UNIQUE("price_list_id","key")
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "business_name" text;--> statement-breakpoint
ALTER TABLE "price_list_add_ons" ADD COLUMN "offered_for" "offered_for" DEFAULT 'homes'::"offered_for" NOT NULL;--> statement-breakpoint
ALTER TABLE "price_lists" ADD COLUMN "commercial_hourly_rate_cents" integer;--> statement-breakpoint
ALTER TABLE "price_lists" ADD COLUMN "tax_commercial_percent" numeric(6,3);--> statement-breakpoint
-- existing versions start commercial at the residential figures
UPDATE "price_lists" SET "commercial_hourly_rate_cents" = "hourly_rate_cents", "tax_commercial_percent" = "tax_one_off_percent";--> statement-breakpoint
ALTER TABLE "price_lists" ALTER COLUMN "commercial_hourly_rate_cents" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "price_lists" ALTER COLUMN "tax_commercial_percent" SET NOT NULL;--> statement-breakpoint
-- interior windows are as much a business's as a home's
UPDATE "price_list_add_ons" SET "offered_for" = 'both' WHERE lower("name") = 'interior windows';--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "kind" "property_kind" DEFAULT 'residential'::"property_kind" NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "premises_type_key" uuid;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "weekdays" integer[] DEFAULT '{}'::integer[] NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "preferred_time" text;--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "bedrooms" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "bathrooms" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "storeys" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "pets" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "condition" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_requests" ALTER COLUMN "condition" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "price_list_premises_types_price_list_id_idx" ON "price_list_premises_types" ("price_list_id");--> statement-breakpoint
ALTER TABLE "price_list_premises_types" ADD CONSTRAINT "price_list_premises_types_price_list_id_price_lists_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_kind_details" CHECK (("kind" = 'residential' and "type" is not null and "bedrooms" is not null and "bathrooms" is not null and "storeys" is not null and "pets" is not null and "condition" is not null and "premises_type_key" is null)
        or ("kind" = 'commercial' and "premises_type_key" is not null and "type" is null and "bedrooms" is null and "bathrooms" is null and "storeys" is null and "pets" is null));--> statement-breakpoint
-- every existing version gets the starting Premises Types, each with one key
-- across versions
-- (a materialised CTE, so each key is made once, not once per version)
WITH "starting" AS MATERIALIZED (
  SELECT gen_random_uuid() AS "key", "name", "hours", "position"
  FROM (VALUES ('Office', 0.5, 0), ('Retail', 0.4, 1), ('Medical', 0.8, 2), ('Other', 0.6, 3)) AS v("name", "hours", "position")
)
INSERT INTO "price_list_premises_types" ("price_list_id", "key", "name", "hours_per_thousand_sq_ft", "position")
SELECT "price_lists"."id", "starting"."key", "starting"."name", "starting"."hours", "starting"."position"
FROM "price_lists" CROSS JOIN "starting";
