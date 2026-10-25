import { z } from "zod";

// messages are shown beside the Staff screens' fields, so they're written
// for people

export const invitationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter their name")
    .max(100, "Use a shorter name"),
  email: z.email("Enter an email address").trim().toLowerCase(),
  roles: z
    .array(z.enum(["cleaner", "office_staff"]))
    .min(1, "Choose at least one role")
    .transform((roles) => [...new Set(roles)]),
});

const hours = z
  .number({ error: "Enter a number of hours" })
  .min(0, "Hours can't be negative")
  .max(24, "That's more than a day")
  .refine(
    (value) => Number.isInteger(value * 4),
    "Use quarter-hours, like 7.5 or 7.25",
  );

export const usualWeekSchema = z.object({
  usualWeek: z.array(hours).length(7, "Give hours for all seven days"),
});

export const isoDate = z.iso.date("Enter a date");

export const exceptionSchema = z.object({
  hours,
  note: z
    .string()
    .trim()
    .max(200, "Use a shorter note")
    .nullish()
    .transform((note) => note || null),
});
