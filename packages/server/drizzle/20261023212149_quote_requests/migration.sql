CREATE TYPE "condition" AS ENUM('light', 'moderate', 'heavy');--> statement-breakpoint
CREATE TYPE "property_type" AS ENUM('house', 'apartment', 'townhouse');--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"client_id" uuid NOT NULL,
	"type" "property_type" NOT NULL,
	"street" text NOT NULL,
	"unit" text,
	"postcode" text NOT NULL,
	"bedrooms" integer NOT NULL,
	"bathrooms" numeric(3,1) NOT NULL,
	"storeys" integer NOT NULL,
	"pets" boolean NOT NULL,
	"floor_area" integer,
	"condition" "condition" NOT NULL,
	"access_instructions" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"client_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"condition" "condition" NOT NULL,
	"wants_regular_service" boolean NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Clients from before phone numbers were collected get an empty one
ALTER TABLE "clients" ADD COLUMN "phone" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "phone" DROP DEFAULT;--> statement-breakpoint
CREATE INDEX "properties_client_id_idx" ON "properties" ("client_id");--> statement-breakpoint
CREATE INDEX "quote_requests_client_id_idx" ON "quote_requests" ("client_id");--> statement-breakpoint
CREATE INDEX "quote_requests_property_id_idx" ON "quote_requests" ("property_id");--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_client_id_clients_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_client_id_clients_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_property_id_properties_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;