import { z } from "zod";

// messages are shown beside the Price List's fields, so they're written for
// people

const decimals = (places: number) => (value: number) =>
  Math.abs(value * 10 ** places - Math.round(value * 10 ** places)) < 1e-9;

const hours = z
  .number({ error: "Enter a number of hours" })
  .min(0, "Hours can't be negative")
  .max(24, "That's more than a day")
  .refine(decimals(2), "Use at most two decimal places");

const multiplier = z
  .number({ error: "Enter a multiplier, like 1.4" })
  .min(0.1, "A multiplier must be at least 0.1")
  .max(10, "A multiplier can't be more than 10")
  .refine(decimals(2), "Use at most two decimal places");

const percent = z
  .number({ error: "Enter a percentage" })
  .int("Use a whole percentage")
  .min(0, "A percentage can't be negative")
  .max(100, "A percentage can't be more than 100");

const taxPercent = z
  .number({ error: "Enter a tax rate" })
  .min(0, "A tax rate can't be negative")
  .max(30, "That's higher than any sales tax")
  .refine(decimals(3), "Use at most three decimal places");

const addOn = z.object({
  key: z.uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Name the Add-on")
    .max(80, "Use a shorter name"),
  hours: hours,
  taxExempt: z.boolean(),
  active: z.boolean(),
});

export const priceListSchema = z
  .object({
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
    baseHours: hours,
    bedroomHours: hours,
    bathroomHours: hours,
    extraStoreyHours: hours,
    petHours: hours,
    conditionLight: multiplier,
    conditionModerate: multiplier,
    conditionHeavy: multiplier,
    deepCleanMultiplier: multiplier,
    depositPercent: percent,
    planDiscountPercent: percent,
    quoteValidityDays: z
      .number({ error: "Enter a number of days" })
      .int("Use whole days")
      .min(1, "A Quote must stay valid for at least a day")
      .max(365, "That's longer than a year"),
    defaultCrewSize: z
      .number({ error: "Enter a number of Cleaners" })
      .int("Use a whole number of Cleaners")
      .min(1, "A crew needs at least one Cleaner")
      .max(20, "That's a very large crew"),
    taxOneOffPercent: taxPercent,
    taxServicePlanPercent: taxPercent,
    taxFeePercent: taxPercent,
    addOns: z
      .array(addOn)
      .max(50, "That's more Add-ons than the form can offer"),
  })
  .superRefine((list, ctx) => {
    // two live Add-ons with the same name would be indistinguishable on the form
    const seen = new Map<string, number>();
    list.addOns.forEach((a, i) => {
      if (!a.active) return;
      const name = a.name.toLowerCase();
      if (seen.has(name)) {
        ctx.addIssue({
          code: "custom",
          path: ["addOns", i, "name"],
          message: "Another Add-on already has this name",
        });
      }
      seen.set(name, i);
    });
  });
