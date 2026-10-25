-- One address is one home per Client (see features/properties/address.ts).
-- The key is filled in for existing homes with a SQL approximation of that
-- normalisation, merging any homes that now share an address: the oldest is
-- kept, with its details, and the others' Quote Requests move to it.
ALTER TABLE "properties" ADD COLUMN "address_key" text;--> statement-breakpoint
UPDATE "properties" SET "address_key" =
  btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(lower(street), '(\d)(st|nd|rd|th)\M', '\1', 'g'), '[^a-z0-9]+', ' ', 'g'), '\mstreet\M', 'st', 'g'), '\mavenue\M', 'ave', 'g'), '\mav\M', 'ave', 'g'), '\mboulevard\M', 'blvd', 'g'), '\mroad\M', 'rd', 'g'), '\mdrive\M', 'dr', 'g'), '\mplace\M', 'pl', 'g'), '\mlane\M', 'ln', 'g'), '\mcourt\M', 'ct', 'g'), '\mterrace\M', 'ter', 'g'), '\mparkway\M', 'pkwy', 'g'), '\mhighway\M', 'hwy', 'g'), '\mnorth\M', 'n', 'g'), '\msouth\M', 's', 'g'), '\meast\M', 'e', 'g'), '\mwest\M', 'w', 'g')) || '|' || btrim(regexp_replace(regexp_replace(regexp_replace(lower(coalesce(unit, '')), '\m(apt|apartment|unit|suite|ste|no)\M', '', 'g'), '\mfloor\M', 'fl', 'g'), '[^a-z0-9]+', ' ', 'g')) || '|' || btrim("postcode");--> statement-breakpoint
WITH ranked AS (
  SELECT "id",
         first_value("id") OVER w AS "keep_id",
         row_number() OVER w AS "rn"
  FROM "properties"
  WINDOW w AS (PARTITION BY "client_id", "address_key" ORDER BY "created_at", "id")
)
UPDATE "quote_requests" SET "property_id" = ranked."keep_id"
FROM ranked
WHERE "quote_requests"."property_id" = ranked."id" AND ranked."rn" > 1;--> statement-breakpoint
DELETE FROM "properties" WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", row_number() OVER (PARTITION BY "client_id", "address_key" ORDER BY "created_at", "id") AS "rn"
    FROM "properties"
  ) "ranked" WHERE "rn" > 1
);--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "address_key" SET NOT NULL;--> statement-breakpoint
DROP INDEX "properties_client_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "properties_client_id_address_key_idx" ON "properties" ("client_id","address_key");
