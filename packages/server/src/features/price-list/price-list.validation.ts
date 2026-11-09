import { z } from "zod";
import { keepUnder } from "../../middleware/validation.ts";
import {
  crewSize,
  depositPercent,
  discountPercent,
  validityDays,
} from "../quotes/quotes.validation.ts";

// messages are shown beside the Price List's fields, so they're written for
// people

const decimals = (places: number) => (value: number) =>
  Math.abs(value * 10 ** places - Math.round(value * 10 ** places)) < 1e-9;

export const hours = z
  .number({ error: "Enter a number of hours" })
  .min(0, "Hours can't be negative")
  .max(24, "That's more than a day")
  .refine(decimals(2), "Use at most two decimal places");

const multiplier = z
  .number({ error: "Enter a multiplier, like 1.4" })
  .min(0.1, "A multiplier must be at least 0.1")
  .max(10, "A multiplier can't be more than 10")
  .refine(decimals(2), "Use at most two decimal places");

export const taxPercent = z
  .number({ error: "Enter a tax rate" })
  .min(0, "A tax rate can't be negative")
  .max(30, "That's higher than any sales tax")
  .refine(decimals(3), "Use at most three decimal places");

const addOn = z.object({
  key: z.uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Enter a name")
    .max(80, keepUnder(80, "the name")),
  hours: hours,
  taxExempt: z.boolean(),
  serviceKeys: z
    .array(z.uuid(), { error: "Pick the services it goes with" })
    .min(1, "Pick at least one service it goes with"),
  active: z.boolean(),
});

const premisesType = z.object({
  key: z.uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Enter a name")
    .max(80, keepUnder(80, "the name")),
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
    depositPercent,
    planDiscountPercent: discountPercent,
    // a new Draft's, so within what a Draft can have
    quoteValidityDays: validityDays,
    defaultCrewSize: crewSize,
    taxFeePercent: taxPercent,
    addOns: z.array(addOn).max(50, "That's too many extras. Remove some"),
    premisesTypes: z
      .array(premisesType)
      .max(50, "That's too many types of business. Remove some")
      .refine(
        (types) => types.some((t) => t.active),
        "Offer at least one type of business",
      ),
  })
  .superRefine(uniqueNames("addOns", "Another extra already has this name"))
  .superRefine(
    uniqueNames(
      "premisesTypes",
      "Another type of business already has this name",
    ),
  );
