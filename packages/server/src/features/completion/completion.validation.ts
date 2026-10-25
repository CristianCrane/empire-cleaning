import { z } from "zod";

const condition = z.enum(["light", "moderate", "heavy"], {
  error: "Say how the home was: light, moderate or heavy",
});

const reason = z
  .string({ error: "Say why" })
  .trim()
  .min(1, "Say why")
  .max(500, "Keep the reason under 500 characters");

const report = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("add_on_done"),
    addOnKey: z.uuid("Choose an Add-on"),
    reason,
  }),
  z.object({
    kind: z.literal("add_on_not_done"),
    addOnKey: z.uuid("Choose an Add-on"),
    reason,
  }),
  z.object({
    kind: z.literal("extra_time"),
    hours: z
      .number({ error: "Enter the extra hours" })
      .positive("Enter the extra hours")
      .max(24, "At most 24 extra hours")
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
  .int("Enter a price in whole cents")
  .min(0, "A price can't be below $0");

const officeReason = z
  .string()
  .trim()
  .min(1, "Say why you're changing the price")
  .max(500, "Keep the reason under 500 characters");

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
  reason: z.string().trim().max(500).nullable().optional(),
});

export const correctionSchema = z.object({
  priceCents: price,
  reason: officeReason,
});

export const conditionSchema = z.object({ condition });
