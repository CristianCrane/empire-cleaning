import { z } from "zod";

export const acceptSchema = z.object({
  cleanType: z.enum(["deep", "standard"], {
    error: "Choose a Deep Clean or a Standard Clean",
  }),
});

export const startSchema = z.object({
  quoteRequestId: z.uuid("Choose a Quote Request"),
});

// no lower bound but nothing: Office Staff have the final say (the reason
// shows where the Price List is wrong)
const override = z
  .object({
    priceCents: z
      .number({ error: "Enter a price" })
      .int("Enter a price in whole cents")
      .min(0, "A price can't be below $0"),
    reason: z
      .string({ error: "Say why you're changing the Suggested Price" })
      .trim()
      .min(1, "Say why you're changing the Suggested Price")
      .max(500, "Keep the reason under 500 characters"),
  })
  .nullable();

export const draftSchema = z.object({
  addOns: z.array(z.uuid()).max(50),
  crewSize: z
    .number({ error: "Enter a Crew Size" })
    .int("Crew Size is a whole number")
    .min(1, "Send at least 1 person")
    .max(10, "Send at most 10 people"),
  depositPercent: z
    .number({ error: "Enter a Deposit percentage" })
    .int("Use a whole percentage")
    .min(0, "The Deposit can't be below 0%")
    .max(100, "The Deposit can't be more than 100%"),
  validityDays: z
    .number({ error: "Enter how many days it's valid for" })
    .int("Use a whole number of days")
    .min(1, "Valid for at least 1 day")
    .max(90, "Valid for at most 90 days"),
  proposedStart: z
    .object({
      date: z.iso.date("Use a date like 2026-11-03"),
      time: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:30"),
    })
    .nullable(),
  overrides: z.object({ deep: override, standard: override }),
});
