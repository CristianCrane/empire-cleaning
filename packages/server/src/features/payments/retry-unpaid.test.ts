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
        leftCents: 2000,
        failure: "card_declined",
      },
    ]).took;
    expect(took.reduce((sum, p) => sum + p.cents, 0)).toBe(3000);
  });

  // review F20: Your card names what's still going through from this,
  // listed there or not, so each one waiting comes named at what it
  // still owes; one that failed on our side isn't waiting (C12)
  test("names each payment still going through, at what it still owes", () => {
    const clean = {
      kind: "clean" as const,
      id: "j1",
      startsAt: "2026-01-19T14:00:00.000Z",
    };
    const bill = { kind: "bill" as const, id: "b1", number: "EC-000001" };
    expect(
      tookOf([
        { ...clean, takenCents: 1000, leftCents: 4000, failure: "processing" },
        { ...bill, takenCents: 0, leftCents: 0, failure: null },
        { ...bill, id: "b2", takenCents: 0, failure: "x", errored: true },
      ]).goingThrough,
    ).toEqual([{ ...clean, cents: 4000 }]);
  });
});
