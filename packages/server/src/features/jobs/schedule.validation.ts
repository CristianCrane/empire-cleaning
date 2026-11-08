import { z } from "zod";
import { day, startTime } from "../../middleware/validation.ts";
import { daysFrom } from "../../services/clock/index.ts";

// longest range the Schedule shows at once: about two months
const MAX_SCHEDULE_DAYS = 62;

export const rangeSchema = z
  .object({ from: day, to: day })
  .refine(({ from, to }) => from <= to, {
    path: ["to"],
    message: "Pick an end date after the start date",
  })
  .refine(({ from, to }) => daysFrom(from, to).length <= MAX_SCHEDULE_DAYS, {
    path: ["to"],
    message: `Pick ${MAX_SCHEDULE_DAYS} days or fewer`,
  });

export const capacitySchema = z.object({
  date: day,
  time: startTime,
  labourHours: z.coerce
    .number({ error: "Enter the cleaning hours" })
    .positive("Enter more than 0 hours")
    .max(200, "That's too many hours. Check the number"),
  crewSize: z.coerce
    .number({ error: "Enter how many cleaners" })
    .int("Enter a whole number")
    .positive("Enter at least 1")
    .max(20, "That's too many cleaners. Check the number"),
  // a booked Job being moved, so it isn't counted against itself
  jobId: z.uuid().optional(),
});
