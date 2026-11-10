import { describe, expect, test } from "vitest";
import { NO_CARD, UNREACHABLE } from "./money.ts";
import { LATE, NOT_SETTLED, whyNotPaid } from "./unpaid.ts";

describe("why a payment didn't go through", () => {
  test("a decline worth naming says what's wrong", () => {
    expect(whyNotPaid("en", "expired_card")).toEqual({
      kind: "declined",
      why: "the card has expired",
    });
    expect(whyNotPaid("en", "insufficient_funds")).toEqual({
      kind: "declined",
      why: "there wasn't enough money in the account",
    });
  });

  test("any other decline, or a code we don't know, only didn't go through", () => {
    for (const code of ["card_declined", "stolen_card", "canceled", "x"]) {
      expect(whyNotPaid("en", code)).toEqual({ kind: "declined", why: null });
    }
  });

  test("ours say what to do: wait, add a card, or pay the Bill", () => {
    expect(whyNotPaid("en", UNREACHABLE).kind).toBe("waiting");
    expect(whyNotPaid("en", "processing").kind).toBe("waiting");
    expect(whyNotPaid("en", NOT_SETTLED).kind).toBe("waiting");
    expect(whyNotPaid("en", NO_CARD).kind).toBe("no_card");
    expect(whyNotPaid("en", LATE).kind).toBe("late");
  });
});

describe("why, in the reader's language (ADR-0025)", () => {
  test("a Spanish reader reads it in Spanish", () => {
    expect(whyNotPaid("es", "expired_card")).toEqual({
      kind: "declined",
      why: "la tarjeta venció",
    });
    expect(whyNotPaid("es", "card_declined").why).toBeNull();
  });
});
