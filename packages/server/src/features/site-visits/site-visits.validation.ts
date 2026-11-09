import { z } from "zod";
import { day, startTime } from "../../middleware/validation.ts";
import {
  conditionSchema,
  floorArea,
  homeDetailsSchema,
  officeNotes as notes,
  premisesType,
} from "../quotes/asking.validation.ts";

// the messages are shown beside the form's fields, so they're written for people

const minutes = z
  .number({ error: "Enter how long it takes, in minutes" })
  .int("Use whole minutes")
  .min(15, "Make it at least 15 minutes")
  .max(480, "Make it 8 hours or less")
  .multipleOf(15, "Use quarter hours, like 30 or 45 minutes");

// when, who visits, and for how long; moving one sends the same
export const bookingSchema = z.object({
  date: day,
  time: startTime,
  staffId: z.uuid("Pick who visits"),
  minutes: minutes.default(30),
});

export const newVisitSchema = bookingSchema.extend({
  quoteId: z.uuid("Pick the quote it's for"),
});

const officeNotes = notes.optional();

const condition = z.enum(["light", "moderate", "heavy"], {
  error: "Pick how much cleaning it needs",
});

// what a visit found at business premises: the floor area is known now
export const premisesFindingsSchema = z.object({
  premisesType,
  floorArea,
  condition,
  officeNotes,
});

// what a visit found at a home: its rooms, as asking for a Quote gives them
export const homeFindingsSchema = homeDetailsSchema.extend({
  condition: conditionSchema,
  officeNotes,
});
