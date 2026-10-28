import { z } from "zod";

// messages are shown beside the Service's fields, so they're written for
// people

const decimals = (places: number) => (value: number) =>
  Math.abs(value * 10 ** places - Math.round(value * 10 ** places)) < 1e-9;

const taxPercent = z
  .number({ error: "Enter a tax rate" })
  .min(0, "A tax rate can't be negative")
  .max(30, "That's higher than any sales tax")
  .refine(decimals(3), "Use at most three decimal places");

export const serviceSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name the Service")
      .max(80, "Use a shorter name"),
    description: z.string().trim().max(300, "Keep it to a sentence or two"),
    offeredFor: z.enum(["homes", "businesses", "both"], {
      error: "Choose who the Service is offered to",
    }),
    method: z.enum(["rooms", "area"], {
      error: "Choose how the Service is priced",
    }),
    multiplier: z
      .number({ error: "Enter a multiplier, like 1.6" })
      .min(0.1, "A multiplier must be at least 0.1")
      .max(10, "A multiplier can't be more than 10")
      .refine(decimals(2), "Use at most two decimal places")
      .nullable(),
    hoursPerThousandSqFt: z
      .number({ error: "Enter a number of hours" })
      .min(0.01, "The work takes some time")
      .max(24, "That's more than a day")
      .refine(decimals(2), "Use at most two decimal places")
      .nullable(),
    hourlyRateCents: z
      .number({ error: "Enter an hourly rate" })
      .int()
      .min(100, "The hourly rate must be at least $1")
      .max(100_000, "That's over $1,000 an hour"),
    minimumChargeCents: z
      .number({ error: "Enter a Minimum Charge" })
      .int()
      .min(0, "The Minimum Charge can't be negative")
      .max(1_000_000, "That's over $10,000"),
    taxOneOffPercent: taxPercent,
    taxPlanPercent: taxPercent.nullable(),
    conditionApplies: z.boolean(),
    canRecur: z.boolean(),
    needsSiteVisit: z.boolean(),
    firstVisitServiceKey: z.uuid().nullable(),
    active: z.boolean(),
  })
  .superRefine((s, ctx) => {
    const require = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    // each method has its own figure, and only that one
    if (s.method === "rooms" && s.multiplier === null) {
      require("multiplier", "Enter a multiplier, like 1.6");
    }
    if (s.method === "area" && s.hoursPerThousandSqFt === null) {
      require("hoursPerThousandSqFt", "Enter a number of hours");
    }
    // homes are described by their rooms; business premises aren't
    if (s.method === "rooms" && s.offeredFor !== "homes") {
      require("offeredFor", "Price it by area to offer it for business premises");
    }
    if (s.canRecur && s.taxPlanPercent === null) {
      require("taxPlanPercent", "Enter a tax rate");
    }
  })
  // a figure for the other method, or a plan rate for a Service that can't
  // recur, would only mislead
  .transform((s) => ({
    ...s,
    multiplier: s.method === "rooms" ? s.multiplier : null,
    hoursPerThousandSqFt: s.method === "area" ? s.hoursPerThousandSqFt : null,
    taxPlanPercent: s.canRecur ? s.taxPlanPercent : null,
  }));
