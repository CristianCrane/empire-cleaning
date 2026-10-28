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
  offeredFor: z.enum(["homes", "businesses", "both"], {
    error: "Choose who the Add-on is offered to",
  }),
  active: z.boolean(),
});

const premisesType = z.object({
  key: z.uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Name the Premises Type")
    .max(80, "Use a shorter name"),
  multiplier,
  active: z.boolean(),
});

// two live items with the same name would be indistinguishable on the form
const uniqueNames =
  (field: "addOns" | "premisesTypes", message: string) =>
  (
    list: Record<typeof field, { name: string; active: boolean }[]>,
    ctx: z.RefinementCtx,
  ) => {
    const seen = new Set<string>();
    list[field].forEach((item, i) => {
      if (!item.active) return;
      const name = item.name.toLowerCase();
      if (seen.has(name)) {
        ctx.addIssue({ code: "custom", path: [field, i, "name"], message });
      }
      seen.add(name);
    });
  };

export const priceListSchema = z
  .object({
    conditionLight: multiplier,
    conditionModerate: multiplier,
    conditionHeavy: multiplier,
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
    taxFeePercent: taxPercent,
    addOns: z
      .array(addOn)
      .max(50, "That's more Add-ons than the form can offer"),
    premisesTypes: z
      .array(premisesType)
      .max(50, "That's more Premises Types than the form can offer")
      .refine(
        (types) => types.some((t) => t.active),
        "Offer at least one Premises Type",
      ),
  })
  .superRefine(uniqueNames("addOns", "Another Add-on already has this name"))
  .superRefine(
    uniqueNames("premisesTypes", "Another Premises Type already has this name"),
  );
