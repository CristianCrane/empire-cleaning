import { z } from "zod";
import { daysFrom } from "../../services/clock/index.ts";

// longest range the Schedule shows at once: about two months
export const MAX_SCHEDULE_DAYS = 62;

const day = z.iso.date("Use a date like 2026-11-03");

export const rangeSchema = z
  .object({ from: day, to: day })
  .refine(({ from, to }) => from <= to, {
    path: ["to"],
    message: "The end date must be on or after the start date",
  })
  .refine(({ from, to }) => daysFrom(from, to).length <= MAX_SCHEDULE_DAYS, {
    path: ["to"],
    message: `Choose at most ${MAX_SCHEDULE_DAYS} days`,
  });

export const capacitySchema = z.object({
  date: day,
  time: z
    .string({ error: "Enter a start time" })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:30"),
  labourHours: z.coerce
    .number({ error: "Enter Labour Hours" })
    .positive("Labour Hours must be more than 0")
    .max(200, "That's more Labour Hours than any Job needs"),
  crewSize: z.coerce
    .number({ error: "Enter a Crew Size" })
    .int("Enter a whole number of Cleaners")
    .positive("A crew needs at least 1 Cleaner")
    .max(20, "That's more Cleaners than any crew needs"),
  // a booked Job being moved, so it isn't counted against itself
  jobId: z.uuid().optional(),
});
