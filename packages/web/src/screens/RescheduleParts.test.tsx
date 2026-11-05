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
    expect(costForClient("late_cancellation", 5046, oneOff)).toMatch(
      /Deposit is kept as the fee, and the full price is charged when it's done\.$/,
    );
    expect(costForClient("late_cancellation", 5046, plan)).toMatch(
      /\$50\.46 fee \(the same as your plan's Deposit\), charged with the price when it's done\.$/,
    );
    expect(costForOffice("late_cancellation", 5046, plan)).toMatch(
      /the plan's Deposit amount, is charged with the price on completion\.$/,
    );
  });

  test("goes on that week's Bill, for a Client billed weekly", () => {
    expect(costForClient("late_cancellation", 5046, weeklyOneOff)).toMatch(
      /Deposit is kept as the fee, and the full price goes on your Bill for that week\.$/,
    );
    expect(costForClient("late_cancellation", 5046, weeklyPlan)).toMatch(
      /\$50\.46 fee \(the same as your plan's Deposit\), which goes on your Bill for that week with the price\.$/,
    );
    expect(costForOffice("late_cancellation", 5046, weeklyOneOff)).toMatch(
      /Deposit is kept as the fee and the full price goes on that week's Bill\.$/,
    );
    expect(costForOffice("late_cancellation", 5046, weeklyPlan)).toMatch(
      /the plan's Deposit amount, goes on that week's Bill with the price\.$/,
    );
  });
});
