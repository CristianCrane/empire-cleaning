import { z } from "zod";
import { day, startTime } from "../../middleware/validation.ts";

export const rescheduleSchema = z.object({
  date: day,
  time: startTime,
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
  date: day,
  time: startTime,
});
