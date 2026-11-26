import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { BillStatusBadge } from "../BillParts.tsx";
import { said } from "../words.ts";
import { cleanBadge, type CleanState } from "./clean-badge.tsx";

const done: CleanState = {
  status: "completed",
  unpaid: null,
  priceChange: false,
  skipped: false,
  moveAsked: false,
};
const badge = async (clean: Partial<CleanState>) =>
  (await render(<>{cleanBadge(said.en, { ...done, ...clean }, true)}</>))
    .container.textContent;

// the state waiting on the Client first: a payment we try again ourselves
// asks nothing, so what does goes ahead of it
describe("a clean's badge", () => {
  test("a payment that failed comes first", async () => {
    expect(await badge({ unpaid: "declined", priceChange: true })).toBe(
      "Unpaid",
    );
  });

  // #534 Q7: theirs to do, and no failure
  test("a payment their bank wants them to approve needs approval, first", async () => {
    expect(await badge({ unpaid: "approve", priceChange: true })).toBe(
      "Needs approval",
    );
  });

  test("a price change to OK comes before a payment we try again", async () => {
    expect(await badge({ unpaid: "waiting", priceChange: true })).toBe(
      "Needs your OK",
    );
  });

  test("a payment we try again ourselves is only payment pending", async () => {
    expect(await badge({ unpaid: "waiting" })).toBe("Payment pending");
    expect(await badge({ unpaid: "waiting", status: "no_access" })).not.toBe(
      "Payment pending",
    );
  });
});

test("a Bill we try again ourselves says the same as a clean", async () => {
  const bill = (kind: "waiting" | "declined") =>
    render(
      <BillStatusBadge
        bill={{
          status: "due",
          totalCents: 100,
          unpaid: { kind, why: null, since: "" },
          paying: null,
        }}
      />,
    );
  expect((await bill("waiting")).container.textContent).toBe("Payment pending");
  expect((await bill("declined")).container.textContent).toBe("Unpaid");
});

// #534 Q7: theirs to approve, in each reader's words
test("a Bill the Client's bank wants them to approve says so to each", async () => {
  const bill = (forClient: boolean) =>
    render(
      <BillStatusBadge
        bill={{
          status: "due",
          totalCents: 100,
          unpaid: { kind: "approve", why: null, since: "" },
          paying: null,
        }}
        forClient={forClient}
      />,
    );
  expect((await bill(true)).container.textContent).toBe("Needs approval");
  expect((await bill(false)).container.textContent).toBe("Client to approve");
});
