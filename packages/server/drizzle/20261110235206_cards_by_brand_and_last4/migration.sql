-- A card keeps its brand and last 4, worded as it's read in the reader's
-- language (#395): those saved already are split from their English label,
-- "Visa ending 4242"
ALTER TABLE "payment_methods" ADD COLUMN "brand" text;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD COLUMN "last4" text;--> statement-breakpoint
UPDATE "payment_methods" SET
  "brand" = coalesce(substring("label" from '^(.*) ending '), "label"),
  "last4" = coalesce(substring("label" from ' ending (.*)$'), '????');--> statement-breakpoint
ALTER TABLE "payment_methods" ALTER COLUMN "brand" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_methods" ALTER COLUMN "last4" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_methods" DROP COLUMN "label";
