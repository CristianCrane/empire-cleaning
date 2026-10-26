ALTER TABLE "quote_requests" ADD COLUMN "entered_by" uuid;--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_entered_by_accounts_id_fkey" FOREIGN KEY ("entered_by") REFERENCES "accounts"("id") ON DELETE SET NULL;