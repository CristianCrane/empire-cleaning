ALTER TABLE "charge_attempts" ADD COLUMN "processing_by" text;--> statement-breakpoint
-- What each processing attempt is finishing by (#534): a Bill's processing
-- was only ever its bank debit; any other, an off-session Charge, a card.
-- One approving that its bank was finishing (bank_finishing_at) was a card
-- approved, or paying a Bill, and so is processing by card now. Its status
-- is read as text: on a new database every migration runs in one
-- transaction, where the enum value an earlier one added can't be used yet
-- (Postgres 55P04).
UPDATE "charge_attempts" SET "processing_by" = CASE WHEN "request"->>'call' = 'bill' THEN 'bank' ELSE 'card' END WHERE "status" = 'processing';--> statement-breakpoint
UPDATE "charge_attempts" SET "status" = 'processing', "processing_by" = 'card' WHERE "status"::text = 'approving' AND "bank_finishing_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "charge_attempts" DROP COLUMN "bank_finishing_at";
