import { describe, expect, test } from "vitest";
import { costForClient, costForOffice } from "./RescheduleParts.tsx";

// a one-off Job and a plan Job, for a Client charged per clean or billed
// weekly (ADR-0016)
const oneOff = { servicePlanId: null, weeklyBill: null };
const weeklyOneOff = { servicePlanId: null, weeklyBill: "automatic" as const };
const plan = { servicePlanId: "plan", weeklyBill: null };
const weeklyPlan = { servicePlanId: "plan", weeklyBill: "on_page" as const };

describe("a second Late Reschedule's fee (#244 #5)", () => {
  test("is charged when the clean is done, for a Client charged per clean", () => {
    expect(costForClient("en", "late_cancellation", 5046, oneOff)).toMatch(
      /deposit is kept as a late cancellation fee, and the full price is charged when the clean is done\.$/,
    );
    expect(costForClient("en", "late_cancellation", 5046, plan)).toMatch(
      /\$50\.46 late cancellation fee, which is charged with the price when the clean is done\.$/,
    );
    expect(costForOffice("late_cancellation", 5046, plan)).toMatch(
      /\$50\.46 late cancellation fee, charged with the price when it's done\.$/,
    );
  });

  test("goes on that week's Bill, for a Client billed weekly", () => {
    expect(
      costForClient("en", "late_cancellation", 5046, weeklyOneOff),
    ).toMatch(
      /deposit is kept as a late cancellation fee, and the full price goes on your bill for that week\.$/,
    );
    expect(costForClient("en", "late_cancellation", 5046, weeklyPlan)).toMatch(
      /\$50\.46 late cancellation fee, which goes on your bill for that week with the price\.$/,
    );
    expect(costForOffice("late_cancellation", 5046, weeklyOneOff)).toMatch(
      /deposit is kept as a late cancellation fee, and the full price goes on that week's bill\.$/,
    );
    expect(costForOffice("late_cancellation", 5046, weeklyPlan)).toMatch(
      /\$50\.46 late cancellation fee, on that week's bill with the price\.$/,
    );
  });
});
