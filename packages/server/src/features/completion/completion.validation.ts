import { z } from "zod";
import { catalog } from "@empire-cleaning/models";
import { keepUnder, say } from "../../middleware/validation.ts";

// what a Cleaner marking a Job done is told beside its fields, in the
// request's language, tú in Spanish (ADR-0025); the Office's, below, stay
// English
const words = catalog({
  en: {
    SAY_CONDITION: "Say how the home was: light, moderate or heavy",
    SAY_WHY: "Say why",
    CHOOSE_EXTRA: "Choose an extra",
    HOW_MANY_HOURS: "Enter how many more hours",
    AT_MOST: "At most 24 more hours",
    QUARTER_HOURS: "Use quarter hours, like 1.25",
  },
  es: {
    SAY_CONDITION: "Di cómo estaba la casa: ligera, moderada o intensa",
    SAY_WHY: "Di por qué",
    CHOOSE_EXTRA: "Elige un adicional",
    HOW_MANY_HOURS: "Escribe cuántas horas más",
    AT_MOST: "Como mucho 24 horas más",
    QUARTER_HOURS: "Usa cuartos de hora, como 1.25",
  },
});

const condition = z.enum(
  ["light", "moderate", "heavy"],
  say(words, "SAY_CONDITION"),
);

const reason = z
  .string(say(words, "SAY_WHY"))
  .trim()
  .min(1, say(words, "SAY_WHY"))
  .max(500, keepUnder(500, "the reason"));

const addOnKey = z.uuid(say(words, "CHOOSE_EXTRA"));

const report = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("add_on_done"), addOnKey, reason }),
  z.object({ kind: z.literal("add_on_not_done"), addOnKey, reason }),
  z.object({
    kind: z.literal("extra_time"),
    hours: z
      .number(say(words, "HOW_MANY_HOURS"))
      .positive(say(words, "HOW_MANY_HOURS"))
      .max(24, say(words, "AT_MOST"))
      .refine((h) => Number.isInteger(h * 4), say(words, "QUARTER_HOURS")),
    reason,
  }),
]);

export const completionSchema = z.object({
  condition,
  reports: z.array(report).max(20),
});

const price = z
  .number({ error: "Enter a price" })
  .int("Enter a price like 12.50")
  .min(0, "A price can't be below $0");

const officeReason = z
  .string()
  .trim()
  .min(1, "Say why you're changing the price")
  .max(500, keepUnder(500, "the reason"));

export const proposalSchema = z
  .object({
    priceCents: price.nullable().optional(),
    reason: officeReason.nullable().optional(),
  })
  .refine((p) => p.priceCents == null || p.reason, {
    path: ["reason"],
    message: "Say why you're changing the price",
  });

export const dismissalSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(500, keepUnder(500, "the reason"))
    .nullable()
    .optional(),
});

export const correctionSchema = z.object({
  priceCents: price,
  reason: officeReason,
});

export const conditionSchema = z.object({ condition });
