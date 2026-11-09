import { z } from "zod";
import { keepUnder } from "../../middleware/validation.ts";

const condition = z.enum(["light", "moderate", "heavy"], {
  error: "Say how the home was: light, moderate or heavy",
});

const reason = z
  .string({ error: "Say why" })
  .trim()
  .min(1, "Say why")
  .max(500, keepUnder(500, "the reason"));

const report = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("add_on_done"),
    addOnKey: z.uuid("Choose an extra"),
    reason,
  }),
  z.object({
    kind: z.literal("add_on_not_done"),
    addOnKey: z.uuid("Choose an extra"),
    reason,
  }),
  z.object({
    kind: z.literal("extra_time"),
    hours: z
      .number({ error: "Enter how many more hours" })
      .positive("Enter how many more hours")
      .max(24, "At most 24 more hours")
      .refine((h) => Number.isInteger(h * 4), "Use quarter hours, like 1.25"),
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
