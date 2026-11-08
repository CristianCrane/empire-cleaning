import { z } from "zod";
import { keepUnder, startTime } from "../../middleware/validation.ts";

// the messages are shown beside the form's fields, so they're written for people

const phone = z
  .string()
  .trim()
  .refine(
    (value) => value.replace(/\D/g, "").length >= 10,
    "Enter a phone number with its area code",
  );

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter your name")
    .max(100, "Use a shorter name"),
  email: z.email("Enter a full email address, like name@example.com"),
  phone,
});

const address = {
  street: z
    .string()
    .trim()
    .min(1, "Enter the street address")
    .max(200, "Use a shorter street address"),
  unit: z.string().trim().max(50, "Use a shorter unit").nullish(),
  postcode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Enter a 5-digit ZIP code"),
  accessInstructions: z.string().trim().max(2000, keepUnder(2000)).nullish(),
};

const AREA = "Enter the area in sq ft";

// an area in sq ft: a place's floor area, an ask's rough idea of the area
// to price a Service on, or a Draft's
export const squareFeet = (min: number, tooSmall = AREA, max = 1_000_000) =>
  z
    .number({ error: AREA })
    .int("Use whole sq ft")
    .min(min, tooSmall)
    .max(max, "That's bigger than we can take on");

export const floorArea = squareFeet(
  100,
  "That's smaller than any place we clean",
);

export const premisesType = z.uuid("Pick a type of business");

const homeType = z.enum(["house", "apartment", "townhouse"], {
  error: "Pick the type of home",
});

// a home's rooms, all four together
const roomsSchema = z.object({
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z
    .number()
    .min(0.5, "A home needs at least half a bathroom")
    .max(20)
    .multipleOf(0.5, "Use whole or half bathrooms, like 1.5"),
  storeys: z.number().int().min(1).max(5),
  pets: z.boolean(),
});

const homeFloorArea = squareFeet(
  100,
  "That's smaller than any home we clean",
  100_000,
).nullish();

// its rooms are optional here: the Service asked for decides whether
// they're needed (checkRooms)
const newHomeSchema = z.object({
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

const newPremisesSchema = z.object({
  kind: z.literal("commercial"),
  ...address,
  premisesType,
  floorArea: floorArea.nullish(),
});

const newPropertySchema = z.discriminatedUnion(
  "kind",
  [newHomeSchema, newPremisesSchema],
  { error: "Pick a home or a business" },
);

const CONDITION = "Pick how much cleaning the home needs";

// also a Service Plan's
export const conditionSchema = z.enum(["light", "moderate", "heavy"], {
  error: CONDITION,
});

// also a Draft's
export const serviceKey = z.uuid("Pick a service");

// Everything a request may say. Which of it applies depends on the kind of
// Property: `forKind` checks a new one's here, and recordRequest an existing
// one's once it's found.
const request = {
  // the Service asked for, by key; checked against those on offer on submit
  serviceKey,
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
  preferredTime: startTime.nullish(),
  wantsRegularService: z.boolean(),
  // for a Service priced by area, a rough idea of it; kept only for one
  area: squareFeet(10).nullish(),
  notes: z.string().trim().max(2000, keepUnder(2000, "the notes")).nullish(),
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
      issue(["condition"], "We check a business's condition on our visit"),
    );
  }
  if (fields.addOns?.length) {
    problems.push(
      issue(["addOns"], "We agree a business's extras on our visit"),
    );
  }
  if (fields.wantsRegularService) {
    if (!fields.weekdays?.length) {
      problems.push(issue(["weekdays"], "Pick the days you want cleaned"));
    }
    if (!fields.preferredTime) {
      problems.push(issue(["preferredTime"], "Pick a start time"));
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
        : "Fill in all of the home's rooms, or none",
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
    ? [issue(["condition"], CONDITION)]
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

// a campaign tag, as a link gives it; an empty one is none
const utm = z
  .string()
  .trim()
  .max(100)
  .nullish()
  .transform((tag) => tag || null);

// where a Guest asked from on the landing site (#185)
const sourceSchema = z.object({
  page: z.string().trim().startsWith("/").max(200),
  utmSource: utm,
  utmMedium: utm,
  utmCampaign: utm,
});

// a Guest: full contact details and a new Property, and where on the
// landing site they asked from
export const guestSubmission = z
  .object({
    ...request,
    contact: contactSchema,
    property: z.object({ new: newPropertySchema }),
    source: sourceSchema.optional(),
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
  .max(4000, keepUnder(4000, "the notes"))
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
    message: "Pick a client, or add a new one",
  })
  .superRefine(forKind);
