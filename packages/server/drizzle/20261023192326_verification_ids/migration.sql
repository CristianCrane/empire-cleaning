ALTER TABLE "verifications" ALTER COLUMN "id" SET DATA TYPE text USING "id"::text;--> statement-breakpoint
ALTER TABLE "verifications" ALTER COLUMN "id" DROP DEFAULT;