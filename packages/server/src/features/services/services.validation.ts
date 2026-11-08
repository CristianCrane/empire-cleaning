import { z } from "zod";
import { hours, taxPercent } from "../price-list/price-list.validation.ts";

// messages are shown beside the Service's fields, so they're written for
// people

export const serviceSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Enter a name")
      .max(80, "Use a shorter name"),
    description: z.string().trim().max(300, "Keep it to a sentence or two"),
    offeredFor: z.enum(["homes", "businesses", "both"], {
      error: "Pick who it's for",
    }),
    method: z.enum(["rooms", "area"], {
      error: "Pick how it's priced",
    }),
    roomHours: z
      .object({
        baseHours: hours,
        bedroomHours: hours,
        bathroomHours: hours,
        extraStoreyHours: hours,
        petHours: hours,
      })
      .nullable(),
    hoursPerThousandSqFt: hours.min(0.01, "Enter more than 0 hours").nullable(),
    hourlyRateCents: z
      .number({ error: "Enter an hourly rate" })
      .int()
      .min(100, "The hourly rate must be at least $1")
      .max(100_000, "That's over $1,000 an hour"),
    minimumChargeCents: z
      .number({ error: "Enter a minimum price" })
      .int()
      .min(0, "The minimum price can't be below $0")
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
    if (s.method === "rooms" && s.roomHours === null) {
      require("roomHours", "Enter how long each part of a home takes");
    }
    if (s.method === "area" && s.hoursPerThousandSqFt === null) {
      require("hoursPerThousandSqFt", "Enter a number of hours");
    }
    // homes are described by their rooms; business premises aren't
    if (s.method === "rooms" && s.offeredFor !== "homes") {
      require("offeredFor", "To offer it to businesses, price it by area");
    }
    if (s.canRecur && s.taxPlanPercent === null) {
      require("taxPlanPercent", "Enter a tax rate");
    }
  })
  // a figure for the other method, or a plan rate for a Service that can't
  // recur, would only mislead
  .transform((s) => ({
    ...s,
    roomHours: s.method === "rooms" ? s.roomHours : null,
    hoursPerThousandSqFt: s.method === "area" ? s.hoursPerThousandSqFt : null,
    taxPlanPercent: s.canRecur ? s.taxPlanPercent : null,
  }));
