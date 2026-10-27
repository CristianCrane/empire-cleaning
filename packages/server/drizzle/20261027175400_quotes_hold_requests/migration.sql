CREATE TYPE "quote_origin" AS ENUM('client', 'caller', 'office');--> statement-breakpoint
CREATE TYPE "turn_down_reason" AS ENUM('out_of_area', 'out_of_scope', 'no_capacity');--> statement-breakpoint
CREATE TABLE "quote_add_ons" (
	"quote_id" uuid,
	"add_on_key" uuid,
	CONSTRAINT "quote_add_ons_pkey" PRIMARY KEY("quote_id","add_on_key")
);
--> statement-breakpoint
CREATE TABLE "quote_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"quote_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"price_list_id" uuid NOT NULL,
	"crew_size" integer NOT NULL,
	"deposit_percent" integer NOT NULL,
	"validity_days" integer NOT NULL,
	"proposed_starts_at" timestamp with time zone,
	"recurrence" "recurrence",
	"plan_discount_percent" integer,
	"condition" "condition",
	"sent_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revision_options" (
	"revision_id" uuid,
	"position" smallint DEFAULT 0,
	"clean_type" "clean_type",
	"starts_at" timestamp with time zone,
	"crew_size" integer NOT NULL,
	"suggested" jsonb NOT NULL,
	"override_cents" integer,
	"override_reason" text,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"price_cents" integer NOT NULL,
	"tax_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"labour_hours" numeric(6,2) NOT NULL,
	CONSTRAINT "revision_options_pkey" PRIMARY KEY("revision_id","position","clean_type")
);
--> statement-breakpoint
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_quote_request_id_quote_requests_id_fkey";--> statement-breakpoint
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_price_list_id_price_lists_id_fkey";--> statement-breakpoint
ALTER TABLE "quote_request_add_ons" DROP CONSTRAINT "quote_request_add_ons_quote_request_id_quote_requests_id_fkey";--> statement-breakpoint
DROP TABLE "quote_request_add_ons";--> statement-breakpoint
DROP TABLE "quote_requests";--> statement-breakpoint
DROP TABLE "quote_options";--> statement-breakpoint
DROP INDEX "quotes_quote_request_id_idx";--> statement-breakpoint
DROP INDEX "quotes_one_sent_per_property_kind";--> statement-breakpoint
DROP INDEX "quotes_one_draft_per_request";--> statement-breakpoint
DROP INDEX "quotes_one_plan_draft_per_property";--> statement-breakpoint
ALTER TABLE "pending_deposits" ADD COLUMN "revision_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "origin" "quote_origin" NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "wants_regular_service" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "weekdays" integer[] DEFAULT '{}'::integer[] NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "preferred_time" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "sent_revision_id" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "turned_down_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "turn_down_reason" "turn_down_reason";--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "turned_down_by" uuid;--> statement-breakpoint
ALTER TABLE "site_visits" ADD COLUMN "quote_id" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
DROP TYPE "quote_status";--> statement-breakpoint
CREATE TYPE "quote_status" AS ENUM('requested', 'draft', 'sent', 'accepted', 'declined', 'expired', 'turned_down');--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "status" SET DATA TYPE "quote_status" USING "status"::"quote_status";--> statement-breakpoint
ALTER TABLE "quotes" DROP COLUMN "quote_request_id";--> statement-breakpoint
ALTER TABLE "quotes" DROP COLUMN "price_list_id";--> statement-breakpoint
ALTER TABLE "quotes" DROP COLUMN "crew_size";--> statement-breakpoint
ALTER TABLE "quotes" DROP COLUMN "deposit_percent";--> statement-breakpoint
ALTER TABLE "quotes" DROP COLUMN "validity_days";--> statement-breakpoint
ALTER TABLE "quotes" DROP COLUMN "proposed_starts_at";--> statement-breakpoint
ALTER TABLE "quotes" DROP COLUMN "recurrence";--> statement-breakpoint
ALTER TABLE "quotes" DROP COLUMN "plan_discount_percent";--> statement-breakpoint
ALTER TABLE "quotes" DROP COLUMN "sent_at";--> statement-breakpoint
ALTER TABLE "quotes" DROP COLUMN "expires_at";--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "kind" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "kind" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "quote_revisions_number" ON "quote_revisions" ("quote_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_revisions_one_unsent" ON "quote_revisions" ("quote_id") WHERE "sent_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_one_open_per_property_kind" ON "quotes" ("property_id","kind") WHERE "status" in ('draft', 'sent');--> statement-breakpoint
CREATE INDEX "site_visits_quote_id_idx" ON "site_visits" ("quote_id");--> statement-breakpoint
ALTER TABLE "pending_deposits" ADD CONSTRAINT "pending_deposits_revision_id_quote_revisions_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "quote_revisions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quote_add_ons" ADD CONSTRAINT "quote_add_ons_quote_id_quotes_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quote_revisions" ADD CONSTRAINT "quote_revisions_quote_id_quotes_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quote_revisions" ADD CONSTRAINT "quote_revisions_price_list_id_price_lists_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "quote_revisions" ADD CONSTRAINT "quote_revisions_created_by_accounts_id_fkey" FOREIGN KEY ("created_by") REFERENCES "accounts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_sent_revision_id_quote_revisions_id_fkey" FOREIGN KEY ("sent_revision_id") REFERENCES "quote_revisions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_turned_down_by_accounts_id_fkey" FOREIGN KEY ("turned_down_by") REFERENCES "accounts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "revision_options" ADD CONSTRAINT "revision_options_revision_id_quote_revisions_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "quote_revisions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_quote_id_quotes_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_kind_set" CHECK ("kind" is not null or "status" in ('requested', 'turned_down'));