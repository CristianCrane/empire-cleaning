import { z } from "zod";
import { keepUnder, language } from "../../middleware/validation.ts";

// messages are shown beside the Staff screens' fields, so they're written
// for people

export const invitationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter their name")
    .max(100, keepUnder(100, "the name")),
  email: z.email("Enter an email address").trim().toLowerCase(),
  roles: z
    .array(z.enum(["cleaner", "office_staff"]))
    .min(1, "Pick at least one role")
    .transform((roles) => [...new Set(roles)]),
  // English when not given; an edit without it leaves it (ADR-0025)
  preferredLanguage: language.optional(),
});

// what the Office can change about someone after inviting them: not their
// email, which is how their Account connects (ADR-0006)
export const editStaffSchema = invitationSchema.pick({
  name: true,
  roles: true,
  preferredLanguage: true,
});

const hours = z
  .number({ error: "Enter a number of hours" })
  .min(0, "Enter 0 or more hours")
  .max(24, "That's more than 24 hours")
  .refine(
    (value) => Number.isInteger(value * 4),
    "Use quarter-hours, like 7.5 or 7.25",
  );

export const usualWeekSchema = z.object({
  usualWeek: z.array(hours).length(7, "Enter hours for every day"),
});

export const exceptionSchema = z.object({
  hours,
  note: z
    .string()
    .trim()
    .max(200, keepUnder(200, "the note"))
    .nullish()
    .transform((note) => note || null),
});
