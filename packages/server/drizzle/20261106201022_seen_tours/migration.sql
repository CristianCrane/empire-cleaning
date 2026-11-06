CREATE TABLE "seen_tours" (
	"account_id" uuid,
	"tour" text,
	"seen_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "seen_tours_pkey" PRIMARY KEY("account_id","tour")
);
--> statement-breakpoint
ALTER TABLE "seen_tours" ADD CONSTRAINT "seen_tours_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE;