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

export const floorArea = z
  .number({ error: "Enter the floor area in sq ft" })
  .int("Use whole sq ft")
  .min(100, "That's smaller than any premises we clean")
  .max(1_000_000, "That's larger than we can clean");

export const premisesType = z.uuid("Choose the type of premises");

const homeType = z.enum(["house", "apartment", "townhouse"], {
  error: "Choose the type of home",
});

// a home's rooms, all four together
export const roomsSchema = z.object({
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z
    .number()
    .min(0.5, "A home needs at least half a bathroom")
    .max(20)
    .multipleOf(0.5, "Use whole or half bathrooms, like 1.5"),
  storeys: z.number().int().min(1).max(5),
  pets: z.boolean(),
});

const homeFloorArea = z.number().int().min(100).max(100_000).nullish();

// its rooms are optional here: the Service asked for decides whether
// they're needed (checkRooms)
export const newHomeSchema = z.object({
  kind: z.literal("residential"),
  type: homeType,
  ...address,
  ...roomsSchema.partial().shape,
  floorArea: homeFloorArea,
});

// a home's details found on a Site Visit: its rooms, as asking gives them
export const homeDetailsSchema = roomsSchema.extend({
  type: homeType,
  floorArea: homeFloorArea,
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
  // the Service asked for, by key; checked against those on offer on submit
  serviceKey: z.uuid("Choose a Service"),
  // a home's, where the Service says Condition applies (checked on submit)
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
  // for a Service priced by area, a rough idea of it; kept only for one
  area: z
    .number({ error: "Enter the area in sq ft" })
    .int("Use whole sq ft")
    .min(10, "Enter the area in sq ft")
    .max(1_000_000, "That's larger than we can take on")
    .nullish(),
  notes: z.string().trim().max(2000).nullish(),
};

type RequestFields = {
  serviceKey: string;
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

// A request's fields for its kind of Property: a home's may choose
// Add-ons (its Condition depends on the Service: checkCondition); business
// premises give, when new, the business's name, and for regular cleaning the
// weekdays and a preferred time, and state no Condition or Add-ons (a Site
// Visit finds those). Returns the problems, for the form's fields.
export const checkForKind = (
  kind: "residential" | "commercial",
  fields: RequestFields,
  { isNew }: { isNew: boolean },
) => {
  if (kind === "residential") return [];
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

const ROOMS = ["bedrooms", "bathrooms", "storeys", "pets"] as const;

// A home's rooms, as a request or correction gives them: all four, or none.
// Where the Service is priced from rooms (`needed`), a home that has none
// must give them. `at` is where they are in the request.
export const checkRooms = (
  given: Partial<Record<(typeof ROOMS)[number], unknown>> | undefined,
  { needed, at }: { needed: boolean; at: string[] },
) => {
  const missing = ROOMS.filter(
    (r) => given?.[r] === undefined || given[r] === null,
  );
  if (missing.length === 0 || (missing.length === ROOMS.length && !needed)) {
    return [];
  }
  return missing.map((r) =>
    issue(
      [...at, r],
      needed
        ? "Tell us about the home's rooms"
        : "Give all of the home's rooms, or none",
    ),
  );
};

// a home's request states its Condition where the Service asked for says
// Condition applies
export const checkCondition = (
  kind: "residential" | "commercial",
  conditionApplies: boolean,
  fields: Pick<RequestFields, "condition">,
) =>
  kind === "residential" && conditionApplies && !fields.condition
    ? [issue(["condition"], "Choose how much cleaning the home needs")]
    : [];

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

// a new Property, or one of the Client's, which, being a home without its
// rooms, may give them
const existingOrNew = z.union([
  z.object({ new: newPropertySchema }),
  z.object({ existing: z.uuid(), rooms: roomsSchema.optional() }),
]);

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
    property: existingOrNew,
  })
  .superRefine(forKind);

// the Office's own notes on a Property, never shown to the Client; empty
// clears them
export const officeNotes = z
  .string()
  .trim()
  .max(4000, "Keep the notes under 4,000 characters")
  .nullable()
  .transform((notes) => notes || null);

// the Office correcting a Property's details (the address is its identity,
// so it isn't correctable, and nor is whether it's a home); send only what
// changes
export const homeCorrectionSchema = homeDetailsSchema
  .extend({ condition: conditionSchema, officeNotes })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, "Nothing to change");

export const premisesCorrectionSchema = z
  .object({
    premisesType,
    floorArea: floorArea.nullable(),
    condition: conditionSchema,
    officeNotes,
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
    property: existingOrNew,
  })
  .refine((s) => (s.clientId === undefined) !== (s.contact === undefined), {
    path: ["clientId"],
    message: "Choose a Client, or enter a new one",
  })
  .superRefine(forKind);
