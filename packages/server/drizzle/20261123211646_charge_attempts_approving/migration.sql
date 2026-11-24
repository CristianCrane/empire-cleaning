-- A Deposit waiting on the Client's bank is an open attempt, "approving",
-- so nothing else that moves money on its Quote starts meanwhile (#534,
-- F15, Q1). On its own, as a new enum value can't be used in the
-- transaction that adds it. Attempts stored failed with "needs_approval"
-- before this stay so: nothing is live yet to carry over
ALTER TYPE "charge_attempt_status" ADD VALUE 'approving' BEFORE 'taken';
