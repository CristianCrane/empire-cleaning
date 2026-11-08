import { z } from "zod";
import { day, startTime } from "../../middleware/validation.ts";
import { daysFrom } from "../../services/clock/index.ts";

// longest range the Schedule shows at once: about two months
const MAX_SCHEDULE_DAYS = 62;

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
  time: startTime,
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
