import { z } from "zod";

// the Service chosen, by key, on a one-off Quote; a Service Plan Quote is
// accepted whole, so it needs none
export const acceptSchema = z.object({
  serviceKey: z.uuid("Choose one of the Quote's Services").optional(),
});

// a Client may pay with a card entered just now: the payment form's token
export const clientAcceptSchema = acceptSchema.extend({
  paymentToken: z.string().min(1).max(255).optional(),
});

// a Service Plan Quote Office Staff offer for a Property unprompted
export const startSchema = z.object({
  propertyId: z.uuid("Choose a home"),
  kind: z.literal("service_plan", {
    error: "A one-off Quote starts from what a Client asks for",
  }),
});

// a Requested Quote's first Revision sets its kind, one-off unless said
// otherwise; after that it's fixed
export const startRevisionSchema = z.object({
  kind: z.enum(["one_off", "service_plan"]).optional(),
});

export const turnDownSchema = z.object({
  reason: z.enum(["out_of_area", "out_of_scope", "no_capacity"], {
    error: "Choose why: out of area, out of scope or no capacity",
  }),
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

const crewSize = z
  .number({ error: "Enter a Crew Size" })
  .int("Crew Size is a whole number")
  .min(1, "Send at least 1 person")
  .max(10, "Send at most 10 people");

// a clean's time, New York
const start = z
  .object({
    date: z.iso.date("Use a date like 2026-11-03"),
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:30"),
  })
  .nullable();

// one of a Service Plan's weekdays, with its own visit (ADR-0013)
const planDay = z.object({
  start,
  crewSize,
  override,
});

const plan = z.object({
  // every day's
  serviceKey: z.uuid("Choose a Service"),
  recurrence: z.enum(["weekly", "fortnightly", "four_weekly"], {
    error: "Choose every week, every 2 weeks or every 4 weeks",
  }),
  discountPercent: z
    .number({ error: "Enter a Plan Discount percentage" })
    .int("Use a whole percentage")
    .min(0, "The Plan Discount can't be below 0%")
    .max(100, "The Plan Discount can't be more than 100%"),
  condition: z.enum(["light", "moderate", "heavy"], {
    error: "Choose light, moderate or heavy",
  }),
  // a week has 7
  days: z
    .array(planDay)
    .min(1, "Give the plan at least one weekday")
    .max(7, "A week has only 7 days"),
});

export const draftSchema = z.object({
  // a one-off Quote's Service
  serviceKey: z.uuid("Choose a Service").optional(),
  // for a Service priced by area; none follows the Property's
  area: z
    .number({ error: "Enter the area in sq ft" })
    .int("Use whole sq ft")
    .min(1, "Enter the area in sq ft")
    .max(1_000_000, "That's larger than we can take on")
    .nullable()
    .optional(),
  addOns: z.array(z.uuid()).max(50),
  // a one-off Quote's; a Service Plan Quote's are its weekdays'
  crewSize: crewSize.optional(),
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
  proposedStart: start.optional(),
  // by the option's Service
  overrides: z.record(z.uuid(), override).optional(),
  // a Service Plan Quote's terms, and only theirs
  plan: plan.nullable().optional(),
});
