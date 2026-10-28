-- Services replace Clean Types (ADR-0018). The four every install starts
-- with are made from the Price List in force, with the keys the server
-- knows them by, so every existing price comes out the same.
CREATE TYPE "pricing_method" AS ENUM('rooms', 'area');--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"key" uuid NOT NULL,
	"version" integer UNIQUE GENERATED ALWAYS AS IDENTITY (sequence name "services_version_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"offered_for" "offered_for" NOT NULL,
	"method" "pricing_method" NOT NULL,
	"multiplier" numeric(6,2),
	"hours_per_thousand_sq_ft" numeric(6,2),
	"hourly_rate_cents" integer NOT NULL,
	"minimum_charge_cents" integer NOT NULL,
	"tax_one_off_percent" numeric(6,3) NOT NULL,
	"tax_plan_percent" numeric(6,3),
	"condition_applies" boolean NOT NULL,
	"can_recur" boolean NOT NULL,
	"needs_site_visit" boolean NOT NULL,
	"first_visit_service_key" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE INDEX "services_key_idx" ON "services" ("key");--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_created_by_accounts_id_fkey" FOREIGN KEY ("created_by") REFERENCES "accounts"("id") ON DELETE SET NULL;--> statement-breakpoint

-- commercial cleaning's hours per 1,000 sq ft are the first Premises Type's
-- (an office, to start with); each Premises Type becomes a multiplier on them
CREATE TEMPORARY TABLE "services_base" AS
SELECT
	l.*,
	coalesce(
		(SELECT t.hours_per_thousand_sq_ft FROM price_list_premises_types t
		WHERE t.price_list_id = l.id ORDER BY t.position LIMIT 1),
		0.5
	) AS area_base_hours
FROM price_lists l ORDER BY l.version DESC LIMIT 1;--> statement-breakpoint

INSERT INTO "services" (
	"key", "name", "description", "offered_for", "method", "multiplier",
	"hours_per_thousand_sq_ft", "hourly_rate_cents", "minimum_charge_cents",
	"tax_one_off_percent", "tax_plan_percent", "condition_applies", "can_recur",
	"needs_site_visit", "first_visit_service_key", "position"
)
SELECT v.* FROM "services_base" b CROSS JOIN LATERAL (VALUES
	('5e7a1c00-0000-4000-8000-000000000001'::uuid, 'Standard Clean',
		'The regular upkeep that keeps a clean home feeling that way.',
		'homes'::offered_for, 'rooms'::pricing_method, 1::numeric, NULL::numeric,
		b.hourly_rate_cents, b.minimum_charge_cents, b.tax_one_off_percent,
		b.tax_service_plan_percent, true, true, false,
		'5e7a1c00-0000-4000-8000-000000000002'::uuid, 0),
	('5e7a1c00-0000-4000-8000-000000000002'::uuid, 'Deep Clean',
		'A top-to-bottom clean, inside cabinets, behind appliances and everywhere in between.',
		'homes'::offered_for, 'rooms'::pricing_method, b.deep_clean_multiplier, NULL::numeric,
		b.hourly_rate_cents, b.minimum_charge_cents, b.tax_one_off_percent,
		b.tax_service_plan_percent, true, true, false, NULL::uuid, 1),
	('5e7a1c00-0000-4000-8000-000000000003'::uuid, 'Commercial cleaning',
		'Workspaces, kitchens and restrooms kept clean for your team and visitors.',
		'businesses'::offered_for, 'area'::pricing_method, NULL::numeric, b.area_base_hours,
		b.commercial_hourly_rate_cents, b.minimum_charge_cents, b.tax_commercial_percent,
		b.tax_commercial_percent, true, true, true,
		'5e7a1c00-0000-4000-8000-000000000004'::uuid, 2),
	('5e7a1c00-0000-4000-8000-000000000004'::uuid, 'Commercial deep clean',
		'A thorough clean of business premises, top to bottom.',
		'businesses'::offered_for, 'area'::pricing_method, NULL::numeric,
		round(b.area_base_hours * b.deep_clean_multiplier, 2),
		b.commercial_hourly_rate_cents, b.minimum_charge_cents, b.tax_commercial_percent,
		b.tax_commercial_percent, true, true, true, NULL::uuid, 3)
) AS v;--> statement-breakpoint

ALTER TABLE "price_list_premises_types" ADD COLUMN "multiplier" numeric(6,2);--> statement-breakpoint
UPDATE "price_list_premises_types" SET "multiplier" =
	round("hours_per_thousand_sq_ft" / coalesce((SELECT area_base_hours FROM "services_base"), 0.5), 2);--> statement-breakpoint
ALTER TABLE "price_list_premises_types" ALTER COLUMN "multiplier" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "price_list_premises_types" DROP COLUMN "hours_per_thousand_sq_ft";--> statement-breakpoint

-- each Revision option was priced with the Service its Clean Type stands for
ALTER TABLE "revision_options" ADD COLUMN "service_id" uuid;--> statement-breakpoint
UPDATE "revision_options" o SET "service_id" = s.id
FROM "quote_revisions" r, "quotes" q, "properties" p, "services" s
WHERE r.id = o.revision_id AND q.id = r.quote_id AND p.id = q.property_id
	AND s.key = CASE
		WHEN p.kind = 'commercial' AND o.clean_type = 'deep' THEN '5e7a1c00-0000-4000-8000-000000000004'::uuid
		WHEN p.kind = 'commercial' THEN '5e7a1c00-0000-4000-8000-000000000003'::uuid
		WHEN o.clean_type = 'deep' THEN '5e7a1c00-0000-4000-8000-000000000002'::uuid
		ELSE '5e7a1c00-0000-4000-8000-000000000001'::uuid
	END;--> statement-breakpoint
ALTER TABLE "revision_options" ALTER COLUMN "service_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "revision_options" ADD CONSTRAINT "revision_options_service_id_services_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT;--> statement-breakpoint

DROP TABLE "services_base";--> statement-breakpoint
ALTER TABLE "price_lists" DROP COLUMN "hourly_rate_cents";--> statement-breakpoint
ALTER TABLE "price_lists" DROP COLUMN "commercial_hourly_rate_cents";--> statement-breakpoint
ALTER TABLE "price_lists" DROP COLUMN "minimum_charge_cents";--> statement-breakpoint
ALTER TABLE "price_lists" DROP COLUMN "deep_clean_multiplier";--> statement-breakpoint
ALTER TABLE "price_lists" DROP COLUMN "tax_one_off_percent";--> statement-breakpoint
ALTER TABLE "price_lists" DROP COLUMN "tax_service_plan_percent";--> statement-breakpoint
ALTER TABLE "price_lists" DROP COLUMN "tax_commercial_percent";
