import { z } from "zod";
import { catalog } from "@empire-cleaning/models";
import { keepUnder, say } from "../../middleware/validation.ts";

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

// a Cleaner's, in the request's language, tú in Spanish (ADR-0025)
const noAccessWords = catalog({
  en: { SAY_WHAT_HAPPENED: "Say what happened" },
  es: { SAY_WHAT_HAPPENED: "Cuenta qué pasó" },
});

export const noAccessSchema = z.object({
  reason: z
    .string(say(noAccessWords, "SAY_WHAT_HAPPENED"))
    .trim()
    .min(1, say(noAccessWords, "SAY_WHAT_HAPPENED"))
    .max(500, keepUnder(500)),
});
