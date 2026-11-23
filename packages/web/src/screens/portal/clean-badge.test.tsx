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
        }}
      />,
    );
  expect((await bill("waiting")).container.textContent).toBe("Payment pending");
  expect((await bill("declined")).container.textContent).toBe("Unpaid");
});
