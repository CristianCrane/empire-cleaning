-- A Bill paid on its page is a Charge attempt, as a saved card's is (#534):
-- when one ended dates a payment that didn't go through, and the payment a
-- Bill's page started is the attempt's, not the Bill's. Bills' attempts end
-- from here on; one that ended before has no date, and none of them was a
-- page payment.
ALTER TABLE "charge_attempts" ADD COLUMN "ended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bills" DROP COLUMN "payment_ref";
