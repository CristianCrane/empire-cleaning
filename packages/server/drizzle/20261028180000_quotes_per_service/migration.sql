-- Quotes are for a Service, and Jobs and Add-ons name theirs (ADR-0018).
-- Clean Type goes: a Quote, option or Job that had one is pointed at the
-- seeded Service it stood for, a home's Standard or Deep Clean and business
-- premises' commercial cleaning, so nothing prices or reads differently.
-- Standard Clean (…01) recommends Deep Clean (…02) for a first visit, which
-- is how a home's one-off Quote offered both.
DROP INDEX "quotes_one_open_per_property_kind";--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "service_id" uuid;--> statement-breakpoint
ALTER TABLE "price_list_add_ons" ADD COLUMN "service_keys" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
ALTER TABLE "pending_deposits" ADD COLUMN "service_key" uuid;--> statement-breakpoint
ALTER TABLE "quote_revisions" ADD COLUMN "service_key" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "service_key" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "asked_service_key" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "accepted_service_key" uuid;--> statement-breakpoint
ALTER TABLE "revision_options" ADD COLUMN "service_key" uuid;--> statement-breakpoint

-- the seeded Service a Clean Type stood for at a kind of Property
CREATE TEMPORARY TABLE "clean_type_services" AS
SELECT * FROM (VALUES
	('residential'::property_kind, 'standard'::clean_type, '5e7a1c00-0000-4000-8000-000000000001'::uuid),
	('residential'::property_kind, 'deep'::clean_type, '5e7a1c00-0000-4000-8000-000000000002'::uuid),
	('commercial'::property_kind, 'standard'::clean_type, '5e7a1c00-0000-4000-8000-000000000004'::uuid),
	('commercial'::property_kind, 'deep'::clean_type, '5e7a1c00-0000-4000-8000-000000000004'::uuid)
) AS v ("kind", "clean_type", "service_key");--> statement-breakpoint

-- each option already records the Service version it priced with; on a
-- home's one-off Quote, the Deep Clean it recommended comes first
UPDATE "revision_options" o SET "service_key" = s.key
FROM "services" s WHERE s.id = o.service_id;--> statement-breakpoint
UPDATE "revision_options" o SET "position" = 1
FROM "quote_revisions" r, "quotes" q
WHERE r.id = o.revision_id AND q.id = r.quote_id AND q.kind = 'one_off'
	AND o.clean_type = 'standard'
	AND o.service_key = '5e7a1c00-0000-4000-8000-000000000001'::uuid;--> statement-breakpoint
UPDATE "revision_options" o
SET "suggested" = jsonb_set(o.suggested - 'cleanType', '{serviceName}', to_jsonb(s.name))
FROM "services" s
WHERE s.id = o.service_id AND NOT (o.suggested ? 'serviceName');--> statement-breakpoint
UPDATE "revision_options" SET "suggested" = "suggested" - 'cleanType';--> statement-breakpoint

-- a Revision is for one Service: a one-off's own, the last of its options;
-- a Service Plan's, its first day's
UPDATE "quote_revisions" r SET "service_key" = (
	SELECT o.service_key FROM "revision_options" o
	WHERE o.revision_id = r.id
	ORDER BY CASE WHEN q.kind = 'one_off' THEN -o.position ELSE o.position END
	LIMIT 1
)
FROM "quotes" q WHERE q.id = r.quote_id;--> statement-breakpoint

-- a Quote is for its latest Revision's Service, or else the Standard Clean
-- (a home's) or commercial cleaning (business premises') it was asked for
UPDATE "quotes" q SET
	"service_key" = coalesce(
		(SELECT r.service_key FROM "quote_revisions" r
		WHERE r.quote_id = q.id ORDER BY r.number DESC LIMIT 1),
		c.service_key
	),
	"asked_service_key" = CASE WHEN q.origin = 'office' THEN NULL ELSE c.service_key END,
	"accepted_service_key" = (
		SELECT a.service_key FROM "clean_type_services" a
		WHERE a.kind = p.kind AND a.clean_type = q.accepted_clean_type
	)
FROM "properties" p, "clean_type_services" c
WHERE p.id = q.property_id AND c.kind = p.kind AND c.clean_type = 'standard';--> statement-breakpoint

UPDATE "pending_deposits" d SET "service_key" = c.service_key
FROM "quotes" q, "properties" p, "clean_type_services" c
WHERE q.id = d.quote_id AND p.id = q.property_id
	AND c.kind = p.kind AND c.clean_type = d.clean_type;--> statement-breakpoint

-- A Job is of the Service version its Quote priced it with: a plan's
-- visit's option, or a one-off Quote's accepted one. Any other is of its
-- Clean Type's Service, as first seeded.
UPDATE "jobs" j SET "service_id" = o.service_id
FROM "service_plan_visits" v, "quotes" q, "revision_options" o
WHERE v.job_id = j.id AND q.id = v.quote_id
	AND o.revision_id = q.sent_revision_id AND o.position = v.position;--> statement-breakpoint
UPDATE "jobs" j SET "service_id" = o.service_id
FROM "quotes" q, "revision_options" o
WHERE j.service_id IS NULL AND q.job_id = j.id
	AND o.revision_id = q.sent_revision_id
	AND (q.kind = 'service_plan' AND o.position = 0
		OR q.kind = 'one_off' AND o.service_key = q.accepted_service_key);--> statement-breakpoint
UPDATE "jobs" j SET "service_id" = (
	SELECT s.id FROM "services" s WHERE s.key = c.service_key
	ORDER BY s.version LIMIT 1
)
FROM "properties" p, "clean_type_services" c
WHERE j.service_id IS NULL AND p.id = j.property_id
	AND c.kind = p.kind AND c.clean_type = j.clean_type;--> statement-breakpoint

-- an Add-on goes with every Service offered for the Properties it was
UPDATE "price_list_add_ons" a SET "service_keys" = array(
	SELECT DISTINCT s.key FROM "services" s
	WHERE a.offered_for = 'both' OR s.offered_for IN (a.offered_for, 'both')
	ORDER BY s.key
);--> statement-breakpoint

DROP TABLE "clean_type_services";--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "service_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pending_deposits" ALTER COLUMN "service_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_revisions" ALTER COLUMN "service_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "service_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "revision_options" ALTER COLUMN "service_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "clean_type";--> statement-breakpoint
ALTER TABLE "price_list_add_ons" DROP COLUMN "offered_for";--> statement-breakpoint
ALTER TABLE "pending_deposits" DROP COLUMN "clean_type";--> statement-breakpoint
ALTER TABLE "quotes" DROP COLUMN "accepted_clean_type";--> statement-breakpoint
ALTER TABLE "revision_options" DROP COLUMN "clean_type";--> statement-breakpoint
ALTER TABLE "revision_options" ADD PRIMARY KEY ("revision_id","position","service_key");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_one_open_one_off_per_service" ON "quotes" ("property_id","service_key") WHERE "kind" = 'one_off' and "status" in ('draft', 'sent');--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_one_open_service_plan" ON "quotes" ("property_id") WHERE "kind" = 'service_plan' and "status" in ('draft', 'sent');--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_service_id_services_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT;--> statement-breakpoint
DROP TYPE "clean_type";
