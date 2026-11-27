import type { CardPayment, CardRetried } from "@empire-cleaning/models";
import { retryUnpaidBillsFor } from "../bills/bills.ts";
import { retryUnpaidJobsFor } from "../completion/completion.ts";
import { WAITING_ON_PROVIDER } from "./money.ts";
import type { CardTried } from "./unpaid.ts";

// Tries again everything a Client's saved Payment Method failed to take:
// their Unpaid Jobs, then their automatic Bills; says how each went
export const retryUnpaidFor = async (clientId: string) => [
  ...(await retryUnpaidJobsFor(clientId)),
  ...(await retryUnpaidBillsFor(clientId)),
];

// the payment one was for, at an amount
const at = (r: CardTried, cents: number): CardPayment =>
  r.kind === "clean"
    ? { kind: "clean", id: r.id, startsAt: r.startsAt, cents }
    : { kind: "bill", id: r.id, number: r.number, cents };

// still to come by us: one the payment service left waiting, processing
// or out of reach, which we try again ourselves (Payment pending), so it
// may yet be taken (critical review C10), at what's still owed of it, so
// Your card names it, listed there or not (review F20). Not one that
// failed on our side, which nothing tries again by itself (C12)
const waitingOf = (r: CardTried): CardPayment[] =>
  "errored" in r ||
  r.failure === null ||
  !WAITING_ON_PROVIDER.includes(r.failure)
    ? []
    : [at(r, r.leftCents)];

// what trying them again took, as Your card says it: each payment's money
// taken, the rest of one failing included (critical review C11), and each
// still to come by us
export const tookOf = (retried: CardTried[]): CardRetried => ({
  took: retried.filter((r) => r.takenCents > 0).map((r) => at(r, r.takenCents)),
  goingThrough: retried.flatMap(waitingOf),
});
