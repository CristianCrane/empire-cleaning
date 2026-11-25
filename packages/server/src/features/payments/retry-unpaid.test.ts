import { describe, expect, test } from "vitest";
import { tookOf } from "./retry-unpaid.ts";

// critical review C11: settleJob can record money an earlier try
// took (recordTakenEarlier: balance.ts, `chargedCents: found…`) and then fail
// to take the rest (`settled.failure = charged.reason`), so retryJob returns
// takenCents > 0 beside a failure. tookOf counts what was taken, so the 409
// says "We took $X, but not the rest"
describe("what a retry took", () => {
  test("counts money taken for a payment whose rest failed (critical review C11)", () => {
    const took = tookOf([
      {
        kind: "clean",
        id: "j1",
        startsAt: "2026-01-19T14:00:00.000Z",
        takenCents: 3000,
        failure: "card_declined",
      },
    ]).took;
    expect(took.reduce((sum, p) => sum + p.cents, 0)).toBe(3000);
  });
});
