import { z } from "zod";
import { keepUnder } from "../../middleware/validation.ts";

// the fee the person cancelling was shown, which must still be what it costs
const feeCents = z
  .number({ error: "Say what cancelling costs" })
  .int("Give the fee in dollars and cents")
  .min(0, "A fee can't be below $0");

export const cancelSchema = z.object({ feeCents });

export const officeCancelSchema = z.object({
  by: z.enum(["client", "empire"], {
    error: "Say who's cancelling: the client or Empire Cleaning",
  }),
  feeCents,
  reason: z
    .string()
    .trim()
    .max(500, keepUnder(500, "the reason"))
    .nullable()
    .optional()
    .transform((reason) => reason || null),
});

export const noAccessSchema = z.object({
  reason: z
    .string({ error: "Say what happened" })
    .trim()
    .min(1, "Say what happened")
    .max(500, keepUnder(500)),
});
