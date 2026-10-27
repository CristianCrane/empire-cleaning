-- a Service Plan Quote has an option for each of its weekdays (ADR-0013), each
-- with its own first clean and crew
ALTER TABLE "quote_options" ADD COLUMN "position" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_options" ADD COLUMN "starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quote_options" ADD COLUMN "crew_size" integer;--> statement-breakpoint
-- every Quote so far has one crew, and a Service Plan Quote one weekday, its
-- proposed time's
UPDATE "quote_options" SET "crew_size" = "quotes"."crew_size", "starts_at" = CASE WHEN "quotes"."kind" = 'service_plan' THEN "quotes"."proposed_starts_at" END FROM "quotes" WHERE "quotes"."id" = "quote_options"."quote_id";--> statement-breakpoint
ALTER TABLE "quote_options" ALTER COLUMN "crew_size" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_options" DROP CONSTRAINT "quote_options_pkey";--> statement-breakpoint
ALTER TABLE "quote_options" ADD CONSTRAINT "quote_options_pkey" PRIMARY KEY ("quote_id","position","clean_type");--> statement-breakpoint
-- every visit so far is on its Quote's one weekday
ALTER TABLE "service_plan_visits" ADD COLUMN "position" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
-- a plan's visit was a copy of its Quote's: its Clean Type, Labour Hours and
-- crew are its option's, and its first Job's time that option's first clean,
-- which is the Quote's proposed time
ALTER TABLE "service_plans" DROP COLUMN "clean_type";--> statement-breakpoint
ALTER TABLE "service_plans" DROP COLUMN "labour_hours";--> statement-breakpoint
ALTER TABLE "service_plans" DROP COLUMN "crew_size";--> statement-breakpoint
ALTER TABLE "service_plans" DROP COLUMN "first_starts_at";
