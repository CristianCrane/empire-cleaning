-- A Service priced by area is priced on an area kept on the Revision, not
-- the Property's floor area (ADR-0018). Sent Revisions were priced on the
-- floor area as it was, which only a Site Visit changes, so they take it
-- as it is now; Drafts follow the Property until Office Staff type one.
ALTER TABLE "quote_revisions" ADD COLUMN "area" integer;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "area" integer;--> statement-breakpoint
UPDATE "quote_revisions" r SET "area" = p."floor_area"
FROM "quotes" q, "properties" p, "services" s
WHERE q."id" = r."quote_id" AND p."id" = q."property_id"
	AND s."key" = r."service_key" AND s."method" = 'area'
	AND r."sent_at" IS NOT NULL;--> statement-breakpoint
-- each option's breakdown records the area it was priced on: the floor area
-- for a Service priced by area, none for one priced from a home's rooms
UPDATE "revision_options" o SET "suggested" = o."suggested" || jsonb_build_object(
	'area', CASE WHEN s."method" = 'area' THEN p."floor_area" END
)
FROM "quote_revisions" r, "quotes" q, "properties" p, "services" s
WHERE r."id" = o."revision_id" AND q."id" = r."quote_id"
	AND p."id" = q."property_id" AND s."id" = o."service_id";--> statement-breakpoint

-- Painting, as a placeholder for the owner to correct, at the end of the
-- list. A fresh install has no Services yet and makes them all on first
-- read, Painting among them.
INSERT INTO "services" (
	"key", "name", "description", "offered_for", "method",
	"hours_per_thousand_sq_ft", "hourly_rate_cents", "minimum_charge_cents",
	"tax_one_off_percent", "tax_plan_percent", "condition_applies", "can_recur",
	"needs_site_visit", "first_visit_service_key", "position"
)
SELECT '5e7a1c00-0000-4000-8000-000000000005'::uuid, 'Painting',
	'Walls, ceilings and trim painted cleanly, with the room left as we found it.',
	'both'::offered_for, 'area'::pricing_method,
	8, 6000, 30000, c."tax_one_off_percent", NULL, false, false, true, NULL,
	(SELECT max("position") + 1 FROM "services")
FROM (
	SELECT "tax_one_off_percent" FROM "services"
	WHERE "key" = '5e7a1c00-0000-4000-8000-000000000004'
	ORDER BY "version" DESC LIMIT 1
) c
WHERE NOT EXISTS (
	SELECT 1 FROM "services" WHERE "key" = '5e7a1c00-0000-4000-8000-000000000005'
);
