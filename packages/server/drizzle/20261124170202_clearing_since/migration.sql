-- Since when a Bill's bank debit has been clearing, on the server's Clock,
-- as the Client's payment history shows it (#520). A Bill clearing now went
-- processing at its last write, so it starts from that.
ALTER TABLE "bills" ADD COLUMN "clearing_since" timestamp with time zone;--> statement-breakpoint
UPDATE "bills" SET "clearing_since" = "updated_at" AT TIME ZONE 'UTC' WHERE "status" = 'processing';
