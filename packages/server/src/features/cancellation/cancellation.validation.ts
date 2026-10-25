import { z } from "zod";

// the fee the person cancelling was shown, which must still be what it costs
const feeCents = z
  .number({ error: "Say what cancelling costs" })
  .int("Give the fee in whole cents")
  .min(0, "A fee can't be below $0");

export const cancelSchema = z.object({ feeCents });

export const officeCancelSchema = z.object({
  by: z.enum(["client", "empire"], {
    error: "Say whether the Client or Empire Cleaning is cancelling",
  }),
  feeCents,
  reason: z
    .string()
    .trim()
    .max(500, "Keep the reason under 500 characters")
    .nullable()
    .optional()
    .transform((reason) => reason || null),
});

export const noAccessSchema = z.object({
  reason: z
    .string({ error: "Say what happened" })
    .trim()
    .min(1, "Say what happened")
    .max(500, "Keep it under 500 characters"),
});
