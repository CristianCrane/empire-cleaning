import { z } from "zod";

export const rescheduleSchema = z.object({
  date: z.iso.date("Choose a day"),
  time: z
    .string({ error: "Choose a start time" })
    .regex(/^\d{2}:\d{2}$/, "Choose a start time"),
  // the cost the person asking was shown, which must still be what it costs
  cost: z.enum(["free", "free_late", "late_cancellation"], {
    error: "Say what moving costs",
  }),
});

export const turnDownSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(500, "Keep the reason under 500 characters")
    .nullable()
    .optional()
    .transform((reason) => reason || null),
});

// a new time Office Staff move a Job to, New York
export const moveSchema = z.object({
  date: z.iso.date("Choose a day"),
  time: z
    .string({ error: "Choose a start time" })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a start time"),
});
