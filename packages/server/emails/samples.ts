import type { Clean } from "../src/services/email/blocks.ts";
import type { Settled } from "../src/features/completion/balance.ts";

// sample data the previews share; not itself an email (no default export)

export const client = { name: "Casey Client", email: "casey@example.com" };
export const cleaner = "Cory Cleaner";
export const address = "41-12 Austin St, 4B, 11375";
export const jobId = "8b175f41-4cb2-481c-af0c-260413da69da";

export const monday = new Date("2026-01-12T14:00:00Z");
export const wednesday = new Date("2026-01-14T15:30:00Z");

export const clean: Clean = {
  service: "Deep Clean",
  address,
  startsAt: monday,
};

export const settled: Settled = {
  chargedCents: 0,
  refundedCents: 0,
  failure: null,
  becameUnpaid: false,
  paymentMethod: "Visa ending 4242",
  plan: null,
  billed: false,
};
