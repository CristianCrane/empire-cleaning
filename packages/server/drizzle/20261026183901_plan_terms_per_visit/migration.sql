ALTER TABLE "service_plan_visits" ADD COLUMN "quote_id" uuid;--> statement-breakpoint
-- every visit so far was generated on its plan's one Quote
UPDATE "service_plan_visits" SET "quote_id" = "service_plans"."quote_id" FROM "service_plans" WHERE "service_plans"."id" = "service_plan_visits"."service_plan_id";--> statement-breakpoint
ALTER TABLE "service_plan_visits" ALTER COLUMN "quote_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "service_plan_visits" DROP CONSTRAINT "service_plan_visits_one_per_day";--> statement-breakpoint
ALTER TABLE "service_plan_visits" ADD CONSTRAINT "service_plan_visits_one_per_day" UNIQUE("service_plan_id","quote_id","due_on");--> statement-breakpoint
ALTER TABLE "service_plan_visits" ADD CONSTRAINT "service_plan_visits_quote_id_quotes_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT;
