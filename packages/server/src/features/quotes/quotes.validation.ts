import { z } from "zod";
import { day, startTime } from "../../middleware/validation.ts";
import {
  conditionSchema,
  serviceKey,
  squareFeet,
} from "./asking.validation.ts";

// the offer accepted, as the page showed it (a newer one Sent since is
// refused), and the Service chosen, by key, on a one-off Quote; a Service
// Plan Quote is accepted whole, so it needs none
export const acceptSchema = z.object({
  revisionId: z.uuid("Reload the page, then accept the quote shown"),
  serviceKey: z.uuid("Pick one of the quote's services").optional(),
});

// a Client may pay with a card entered just now: the payment form's token
export const clientAcceptSchema = acceptSchema.extend({
  paymentToken: z.string().min(1).max(255).optional(),
});

// a Service Plan Quote Office Staff offer for a Property unprompted
export const startSchema = z.object({
  propertyId: z.uuid("Pick a home"),
  kind: z.literal("service_plan", {
    error: "A one-off quote starts from what a client asks for",
  }),
});

// a Requested Quote's first Revision sets its kind, one-off unless said
// otherwise; after that it's fixed
export const startRevisionSchema = z.object({
  kind: z.enum(["one_off", "service_plan"]).optional(),
});

export const turnDownSchema = z.object({
  reason: z.enum(["out_of_area", "out_of_scope", "no_capacity"], {
    error: "Pick a reason",
  }),
});

// any price from nothing up: Office Staff have the final say (the reason
// shows where the Price List is wrong), up to $100,000, well under what a
// money column holds
const override = z
  .object({
    priceCents: z
      .number({ error: "Enter a price" })
      .int("Enter a price in dollars and cents")
      .min(0, "A price can't be below $0")
      .max(10_000_000, "That's over $100,000"),
    reason: z
      .string({ error: "Say why you're changing the suggested price" })
      .trim()
      .min(1, "Say why you're changing the suggested price")
      .max(500, "Keep the reason under 500 characters"),
  })
  .nullable();

export const CREW_SIZE = "Enter how many cleaners";

// also the Price List's default, which a new Draft starts from
export const crewSize = z
  .number({ error: CREW_SIZE })
  .int("Use a whole number of cleaners")
  .min(1, "Send at least 1 cleaner")
  .max(10, "Send at most 10 cleaners");

// a percentage of the price, a Draft's or the Price List's default
const percentOf = (what: string) =>
  z
    .number({ error: `Enter a ${what} percentage` })
    .int("Use a whole percentage")
    .min(0, `The ${what} can't be below 0%`)
    .max(100, `The ${what} can't be more than 100%`);
export const depositPercent = percentOf("deposit");
export const discountPercent = percentOf("discount");

// a clean's time, New York
const start = z
  .object({
    date: day,
    time: startTime,
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
  serviceKey,
  recurrence: z.enum(["weekly", "fortnightly", "four_weekly"], {
    error: "Pick every week, every 2 weeks or every 4 weeks",
  }),
  discountPercent,
  condition: conditionSchema,
  // a week has 7
  days: z
    .array(planDay)
    .min(1, "Pick at least one day")
    .max(7, "A week has only 7 days"),
});

// also the Price List's default, which a new Draft starts from
export const validityDays = z
  .number({ error: "Enter how many days it stays open" })
  .int("Use a whole number of days")
  .min(1, "Keep it open for at least 1 day")
  .max(90, "Keep it open for at most 90 days");

export const draftSchema = z.object({
  // a one-off Draft's Service, the Quote's once it's sent
  serviceKey: serviceKey.optional(),
  // for a Service priced by area; none follows the Property's
  area: squareFeet(1).nullable().optional(),
  addOns: z.array(z.uuid()).max(50),
  // a one-off Quote's; a Service Plan Quote's are its weekdays'
  crewSize: crewSize.optional(),
  depositPercent,
  validityDays,
  proposedStart: start.optional(),
  // by the option's Service
  overrides: z.record(z.uuid(), override).optional(),
  // a Service Plan Quote's terms, and only theirs
  plan: plan.nullable().optional(),
});
