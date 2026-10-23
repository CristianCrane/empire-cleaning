CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account_id" uuid UNIQUE,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account_id" uuid UNIQUE,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"roles" text[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- ADR-0006: roles move off Accounts onto Staff and Client records. Records are
-- connected only to Accounts whose email is proven; the rest are created
-- unconnected and connect when their person signs up.
INSERT INTO "staff" ("account_id", "name", "email", "roles")
SELECT CASE WHEN "email_verified" THEN "id" END, "name", "email",
       array_remove("roles", 'client')
FROM "accounts"
WHERE "roles" && ARRAY['cleaner', 'office_staff'];--> statement-breakpoint
INSERT INTO "clients" ("account_id", "name", "email")
SELECT CASE WHEN "email_verified" THEN "id" END, "name", "email"
FROM "accounts"
WHERE 'client' = ANY("roles");--> statement-breakpoint
-- Accounts are now only created by signing up, so one whose email was never
-- proven shouldn't exist; it would also block that email signing up by Google
DELETE FROM "accounts" WHERE NOT "email_verified";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "roles";--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL;