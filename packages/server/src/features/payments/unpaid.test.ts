import { describe, expect, test } from "vitest";
import { NO_CARD, UNREACHABLE } from "./money.ts";
import { LATE, NOT_SETTLED, whyNotPaid } from "./unpaid.ts";

describe("why a payment didn't go through", () => {
  test("a decline worth naming says what's wrong", () => {
    expect(whyNotPaid("expired_card")).toEqual({
      kind: "declined",
      why: "the card has expired",
    });
    expect(whyNotPaid("insufficient_funds")).toEqual({
      kind: "declined",
      why: "there wasn't enough money in the account",
    });
  });

  test("any other decline, or a code we don't know, only didn't go through", () => {
    for (const code of ["card_declined", "stolen_card", "canceled", "x"]) {
      expect(whyNotPaid(code)).toEqual({ kind: "declined", why: null });
    }
  });

  test("ours say what to do: wait, add a card, or pay the Bill", () => {
    expect(whyNotPaid(UNREACHABLE).kind).toBe("waiting");
    expect(whyNotPaid("processing").kind).toBe("waiting");
    expect(whyNotPaid(NOT_SETTLED).kind).toBe("waiting");
    expect(whyNotPaid(NO_CARD).kind).toBe("no_card");
    expect(whyNotPaid(LATE).kind).toBe("late");
  });
});
