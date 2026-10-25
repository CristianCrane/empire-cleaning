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
  labourHours: z.coerce
    .number({ error: "Enter Labour Hours" })
    .positive("Labour Hours must be more than 0")
    .max(200, "That's more Labour Hours than any Job needs"),
});
