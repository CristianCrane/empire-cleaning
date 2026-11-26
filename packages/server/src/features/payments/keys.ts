import type { ChargeAttempt, RefundAttempt } from "./payments.schema.ts";

// The idempotency key each payment the server asks for carries (ADR-0022):
// asked again with its key, the provider does it once. Built only here, so
// what a key names, and that no two kinds of payment share one, is decided
// in one place.
export const idempotencyKey = {
  // one per Charge attempt, however often it's asked; the provider also
  // finds it by this, after it forgets the key
  charge: ({ kind, forId, id }: Pick<ChargeAttempt, "kind" | "forId" | "id">) =>
    `${kind}:${forId}:${id}`,
  // one per refund attempt, as a Charge attempt's
  refund: ({ forId, id }: Pick<RefundAttempt, "forId" | "id">) =>
    `refund:${forId}:${id}`,
  // a Deposit given back: once per Charge, as all of it is
  givingBack: (chargeId: string) => `give-back:${chargeId}`,
};
