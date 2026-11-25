import { describe, expect, test } from "vitest";
import type { CardPayment } from "@empire-cleaning/models";
import { cardNotice } from "./PortalPaymentMethod.tsx";

const clean: CardPayment = {
  kind: "clean",
  id: "j1",
  cents: 5046,
  startsAt: "2026-01-04T14:00:00.000Z",
};

describe("Your card's notice", () => {
  // a press that takes a clean while the Bill beside it is left going
  // through: the list empties, as one going through asks nothing, but it
  // isn't paid (review F13)
  test("says it's going through, not paid, while part of it still is", () => {
    expect(cardNotice([], { took: [clean], goingThrough: true })).toBe(
      "goingThrough",
    );
  });

  test("says it's paid once all it tried is taken", () => {
    expect(cardNotice([], { took: [clean], goingThrough: false })).toBe("paid");
  });

  test("leads with what's still owed, whatever the last press took", () => {
    expect(cardNotice([{}], { took: [clean], goingThrough: false })).toBe(
      "owed",
    );
  });

  test("with no press, or one that took nothing, shows the card", () => {
    expect(cardNotice([], null)).toBe("card");
    expect(cardNotice([], { took: [], goingThrough: false })).toBe("card");
  });
});
