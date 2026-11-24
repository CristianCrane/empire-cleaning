-- A Bill processing has the time its bank debit started (#534's review F15):
-- #520's migration dated those processing then by their last write, and this
-- dates any a server from before #520 made processing since, the same way.
UPDATE "bills" SET "clearing_since" = "updated_at" AT TIME ZONE 'UTC' WHERE "status" = 'processing' AND "clearing_since" IS NULL;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_processing_since" CHECK ("status" <> 'processing' OR "clearing_since" IS NOT NULL);