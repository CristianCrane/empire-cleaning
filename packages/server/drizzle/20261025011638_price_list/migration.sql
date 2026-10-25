CREATE TABLE "price_list_add_ons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"price_list_id" uuid NOT NULL,
	"key" uuid NOT NULL,
	"name" text NOT NULL,
	"hours" numeric(6,2) NOT NULL,
	"tax_exempt" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "price_list_add_ons_version_key" UNIQUE("price_list_id","key")
);
--> statement-breakpoint
CREATE TABLE "price_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"version" integer UNIQUE GENERATED ALWAYS AS IDENTITY (sequence name "price_lists_version_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"placeholder" boolean DEFAULT false NOT NULL,
	"hourly_rate_cents" integer NOT NULL,
	"minimum_charge_cents" integer NOT NULL,
	"base_hours" numeric(6,2) NOT NULL,
	"bedroom_hours" numeric(6,2) NOT NULL,
	"bathroom_hours" numeric(6,2) NOT NULL,
	"extra_storey_hours" numeric(6,2) NOT NULL,
	"pet_hours" numeric(6,2) NOT NULL,
	"condition_light" numeric(6,2) NOT NULL,
	"condition_moderate" numeric(6,2) NOT NULL,
	"condition_heavy" numeric(6,2) NOT NULL,
	"deep_clean_multiplier" numeric(6,2) NOT NULL,
	"deposit_percent" integer NOT NULL,
	"plan_discount_percent" integer NOT NULL,
	"quote_validity_days" integer NOT NULL,
	"default_crew_size" integer NOT NULL,
	"tax_one_off_percent" numeric(6,3) NOT NULL,
	"tax_service_plan_percent" numeric(6,3) NOT NULL,
	"tax_fee_percent" numeric(6,3) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "quote_request_add_ons" (
	"quote_request_id" uuid,
	"add_on_key" uuid,
	CONSTRAINT "quote_request_add_ons_pkey" PRIMARY KEY("quote_request_id","add_on_key")
);
--> statement-breakpoint
CREATE INDEX "price_list_add_ons_price_list_id_idx" ON "price_list_add_ons" ("price_list_id");--> statement-breakpoint
ALTER TABLE "price_list_add_ons" ADD CONSTRAINT "price_list_add_ons_price_list_id_price_lists_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_created_by_accounts_id_fkey" FOREIGN KEY ("created_by") REFERENCES "accounts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "quote_request_add_ons" ADD CONSTRAINT "quote_request_add_ons_quote_request_id_quote_requests_id_fkey" FOREIGN KEY ("quote_request_id") REFERENCES "quote_requests"("id") ON DELETE CASCADE;