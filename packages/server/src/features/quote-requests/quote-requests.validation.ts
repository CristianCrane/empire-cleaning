import { z } from "zod";

// the messages are shown beside the form's fields, so they're written for people

const phone = z
  .string()
  .trim()
  .refine(
    (value) => value.replace(/\D/g, "").length >= 10,
    "Enter a phone number with its area code",
  );

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  email: z.email("Enter a full email address, like name@example.com"),
  phone,
});

const address = {
  street: z.string().trim().min(1, "Enter the street address").max(200),
  unit: z.string().trim().max(50).nullish(),
  postcode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Enter a 5-digit ZIP code"),
  accessInstructions: z.string().trim().max(2000).nullish(),
};

const floorArea = z
  .number({ error: "Enter the floor area in sq ft" })
  .int("Use whole sq ft")
  .min(100, "That's smaller than any premises we clean")
  .max(1_000_000, "That's larger than we can clean");

const premisesType = z.uuid("Choose the type of premises");

export const newHomeSchema = z.object({
  kind: z.literal("residential"),
  type: z.enum(["house", "apartment", "townhouse"], {
    error: "Choose the type of home",
  }),
  ...address,
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z
    .number()
    .min(0.5, "A home needs at least half a bathroom")
    .max(20)
    .multipleOf(0.5, "Use whole or half bathrooms, like 1.5"),
  storeys: z.number().int().min(1).max(5),
  pets: z.boolean(),
  floorArea: z.number().int().min(100).max(100_000).nullish(),
});

export const newPremisesSchema = z.object({
  kind: z.literal("commercial"),
  ...address,
  premisesType,
  floorArea: floorArea.nullish(),
});

export const newPropertySchema = z.discriminatedUnion(
  "kind",
  [newHomeSchema, newPremisesSchema],
  { error: "Choose a home or business premises" },
);

export const conditionSchema = z.enum(["light", "moderate", "heavy"], {
  error: "Choose how much cleaning the home needs",
});

// Everything a request may say. Which of it applies depends on the kind of
// Property: `forKind` checks a new one's here, and recordRequest an existing
// one's once it's found.
const request = {
  // a home's
  condition: conditionSchema.optional(),
  // the Add-ons chosen, by key; checked against the Price List on submit
  addOns: z.array(z.uuid()).max(50).optional(),
  // business premises'
  businessName: z
    .string()
    .trim()
    .max(200, "Use a shorter business name")
    .nullish(),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  preferredTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time")
    .nullish(),
  wantsRegularService: z.boolean(),
  notes: z.string().trim().max(2000).nullish(),
};

type RequestFields = {
  condition?: z.infer<typeof conditionSchema>;
  addOns?: string[];
  businessName?: string | null;
  weekdays?: number[];
  preferredTime?: string | null;
  wantsRegularService: boolean;
};

const issue = (path: (string | number)[], message: string) => ({
  code: "custom" as const,
  path,
  message,
  input: undefined,
});

// A request's fields for its kind of Property: a home's states its
// Condition and may choose Add-ons; business premises give, when new, the
// business's name, and for regular cleaning the weekdays and a preferred
// time, and state no Condition or Add-ons (a Site Visit finds those).
// Returns the problems, for the form's fields.
export const checkForKind = (
  kind: "residential" | "commercial",
  fields: RequestFields,
  { isNew }: { isNew: boolean },
) => {
  if (kind === "residential") {
    return fields.condition
      ? []
      : [issue(["condition"], "Choose how much cleaning the home needs")];
  }
  const problems = [];
  if (isNew && !fields.businessName) {
    problems.push(issue(["businessName"], "Enter the business's name"));
  }
  if (fields.condition) {
    problems.push(
      issue(["condition"], "Business premises' Condition is found on a visit"),
    );
  }
  if (fields.addOns?.length) {
    problems.push(
      issue(["addOns"], "Extras for business premises are agreed on a visit"),
    );
  }
  if (fields.wantsRegularService) {
    if (!fields.weekdays?.length) {
      problems.push(issue(["weekdays"], "Choose the days you want cleaned"));
    }
    if (!fields.preferredTime) {
      problems.push(issue(["preferredTime"], "Choose a time"));
    }
  }
  return problems;
};

// a new Property's request has the fields its kind needs
const forKind = (
  submission: RequestFields & {
    property: { new: { kind: "residential" | "commercial" } } | object;
  },
  ctx: z.RefinementCtx,
) => {
  if (!("new" in submission.property)) return;
  for (const problem of checkForKind(submission.property.new.kind, submission, {
    isNew: true,
  })) {
    ctx.addIssue(problem);
  }
};

// a Guest: full contact details and a new Property
export const guestSubmission = z
  .object({
    ...request,
    contact: contactSchema,
    property: z.object({ new: newPropertySchema }),
  })
  .superRefine(forKind);

// a signed-in Account not yet connected to a Client: its proven email is used
export const accountSubmission = z
  .object({
    ...request,
    contact: contactSchema.omit({ email: true }),
    property: z.object({ new: newPropertySchema }),
  })
  .superRefine(forKind);

// a Client: no contact details; a new Property or one of their own
export const clientSubmission = z
  .object({
    ...request,
    property: z.union([
      z.object({ new: newPropertySchema }),
      z.object({ existing: z.uuid() }),
    ]),
  })
  .superRefine(forKind);

// the Office correcting a Property's details (the address is its identity,
// so it isn't correctable, and nor is whether it's a home); send only what
// changes
export const homeCorrectionSchema = newHomeSchema
  .pick({
    type: true,
    bedrooms: true,
    bathrooms: true,
    storeys: true,
    pets: true,
    floorArea: true,
  })
  .extend({ condition: conditionSchema })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, "Nothing to change");

export const premisesCorrectionSchema = z
  .object({
    premisesType,
    floorArea: floorArea.nullable(),
    condition: conditionSchema,
  })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, "Nothing to change");

// Office Staff entering a caller's request (#34): an existing Client, or a
// new one whose email is optional; a new Property or one of the Client's
export const officeSubmission = z
  .object({
    ...request,
    clientId: z.uuid().optional(),
    contact: contactSchema
      .extend({
        email: z
          .email("Enter a full email address, like name@example.com")
          .nullish(),
      })
      .optional(),
    property: z.union([
      z.object({ new: newPropertySchema }),
      z.object({ existing: z.uuid() }),
    ]),
  })
  .refine((s) => (s.clientId === undefined) !== (s.contact === undefined), {
    path: ["clientId"],
    message: "Choose a Client, or enter a new one",
  })
  .superRefine(forKind);
