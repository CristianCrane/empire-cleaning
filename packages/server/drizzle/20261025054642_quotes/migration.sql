CREATE TYPE "quote_status" AS ENUM('draft', 'sent', 'declined', 'expired', 'superseded');--> statement-breakpoint
CREATE TABLE "quote_options" (
	"quote_id" uuid,
	"clean_type" "clean_type",
	"suggested" jsonb NOT NULL,
	"override_cents" integer,
	"override_reason" text,
	"price_cents" integer NOT NULL,
	"tax_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"labour_hours" numeric(6,2) NOT NULL,
	CONSTRAINT "quote_options_pkey" PRIMARY KEY("quote_id","clean_type")
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"quote_request_id" uuid NOT NULL,
	"status" "quote_status" DEFAULT 'draft'::"quote_status" NOT NULL,
	"price_list_id" uuid NOT NULL,
	"crew_size" integer NOT NULL,
	"deposit_percent" integer NOT NULL,
	"validity_days" integer NOT NULL,
	"proposed_starts_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "quotes_quote_request_id_idx" ON "quotes" ("quote_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_one_sent_per_request" ON "quotes" ("quote_request_id") WHERE "status" = 'sent';--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_one_draft_per_request" ON "quotes" ("quote_request_id") WHERE "status" = 'draft';--> statement-breakpoint
ALTER TABLE "quote_options" ADD CONSTRAINT "quote_options_quote_id_quotes_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_quote_request_id_quote_requests_id_fkey" FOREIGN KEY ("quote_request_id") REFERENCES "quote_requests"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_price_list_id_price_lists_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_accounts_id_fkey" FOREIGN KEY ("created_by") REFERENCES "accounts"("id") ON DELETE SET NULL;