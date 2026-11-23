-- When each Charge attempt was last sent to the provider, so one asked on a
-- card the Client has since replaced is looked up only once a quarter hour
-- has passed since it was last sent (#534, F13). Each one so far was sent
-- when it was asked, as far as anything recorded says
ALTER TABLE "charge_attempts" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
UPDATE "charge_attempts" SET "sent_at" = "asked_at";--> statement-breakpoint
ALTER TABLE "charge_attempts" ALTER COLUMN "sent_at" SET NOT NULL;
