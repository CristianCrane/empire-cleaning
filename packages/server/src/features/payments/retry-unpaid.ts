import { retryUnpaidBillsFor } from "../bills/bills.ts";
import { retryUnpaidJobsFor } from "../completion/completion.ts";

// Tries again everything a Client's saved Payment Method failed to take:
// their Unpaid Jobs, then their automatic Bills; says how each went
export const retryUnpaidFor = async (clientId: string) => [
  ...(await retryUnpaidJobsFor(clientId)),
  ...(await retryUnpaidBillsFor(clientId)),
];
