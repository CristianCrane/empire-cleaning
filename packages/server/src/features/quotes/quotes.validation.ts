import { z } from "zod";

// the Clean Type chosen, on a one-off Quote; a Service Plan Quote is
// accepted whole, so it needs none
export const acceptSchema = z.object({
  cleanType: z
    .enum(["deep", "standard"], {
      error: "Choose a Deep Clean or a Standard Clean",
    })
    .optional(),
});

// a Client may pay with a card entered just now: the payment form's token
export const clientAcceptSchema = acceptSchema.extend({
  paymentToken: z.string().min(1).max(255).optional(),
});

// a Quote for a Quote Request (a one-off Quote unless said otherwise), or a
// Service Plan Quote offered for a Property unprompted
export const startSchema = z.union(
  [
    z.object({
      quoteRequestId: z.uuid("Choose a Quote Request"),
      kind: z.enum(["one_off", "service_plan"]).default("one_off"),
    }),
    z.object({
      propertyId: z.uuid("Choose a home"),
      kind: z.literal("service_plan", {
        error: "A one-off Quote answers a Quote Request",
      }),
    }),
  ],
  { error: "Choose a Quote Request, or a home to offer a Service Plan" },
);

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
  cleanType: z.enum(["deep", "standard"], {
    error: "Choose a Deep Clean or a Standard Clean",
  }),
  crewSize,
  override,
});

const plan = z.object({
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
  overrides: z.object({ deep: override, standard: override }).optional(),
  // a Service Plan Quote's terms, and only theirs
  plan: plan.nullable().optional(),
});
