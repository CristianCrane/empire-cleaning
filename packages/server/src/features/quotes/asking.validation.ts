import { z } from "zod";
import { catalog } from "@empire-cleaning/models";
import { currentLanguage } from "#services/request";
import {
  keepUnder,
  pickerWords,
  say,
  startTime,
} from "../../middleware/validation.ts";

// the messages are shown beside the form's fields, so they're written for
// people, in the language of the request (ADR-0025): the Quote form's in
// English and Spanish. The Office's own (corrections, a caller's ask) are
// English
const words = catalog({
  en: {
    phone: "Enter a phone number with its area code",
    name: "Enter your name",
    email: "Enter a full email address, like name@example.com",
    street: "Enter the street address",
    zip: "Enter a 5-digit ZIP code",
    area: "Enter the area in sq ft",
    wholeFeet: "Use whole sq ft",
    tooBig: "That's bigger than we can take on",
    smallerThanAnyPlace: "That's smaller than any place we clean",
    smallerThanAnyHome: "That's smaller than any home we clean",
    premisesType: "Pick a type of business",
    homeType: "Pick the type of home",
    halfBathroom: "A home needs at least half a bathroom",
    wholeOrHalf: "Use whole or half bathrooms, like 1.5",
    kind: "Pick a home or a business",
    condition: "Pick how much cleaning the home needs",
    service: "Pick a service",
    businessName: "Enter the business's name",
    noCondition: "We check a business's condition on our visit",
    noExtras: "We agree a business's extras on our visit",
    days: "Pick the days you want cleaned",
    rooms: "Tell us about the home's rooms",
    allRoomsOrNone: "Fill in all of the home's rooms, or none",
  },
  es: {
    phone: "Escriba un número de teléfono con su código de área",
    name: "Escriba su nombre",
    email: "Escriba un correo electrónico completo, como nombre@ejemplo.com",
    street: "Escriba la dirección",
    zip: "Escriba un código postal de 5 dígitos",
    area: "Escriba el área en pies cuadrados",
    wholeFeet: "Use pies cuadrados enteros",
    tooBig: "Es más grande de lo que podemos atender",
    smallerThanAnyPlace: "Es más pequeño que cualquier lugar que limpiamos",
    smallerThanAnyHome: "Es más pequeña que cualquier casa que limpiamos",
    premisesType: "Elija un tipo de negocio",
    homeType: "Elija el tipo de casa",
    halfBathroom: "Una casa necesita al menos medio baño",
    wholeOrHalf: "Use baños enteros o medios, como 1.5",
    kind: "Elija una casa o un negocio",
    condition: "Elija cuánta limpieza necesita la casa",
    service: "Elija un servicio",
    businessName: "Escriba el nombre del negocio",
    noCondition: "Revisamos el estado de un negocio en nuestra visita",
    noExtras: "Los adicionales de un negocio los acordamos en nuestra visita",
    days: "Elija los días en que quiere que limpiemos",
    rooms: "Cuéntenos cómo son los cuartos de la casa",
    allRoomsOrNone: "Complete todos los cuartos de la casa, o ninguno",
  },
});

const email = z.email(say(words, "email"));

const phone = z
  .string()
  .trim()
  .refine(
    (value) => value.replace(/\D/g, "").length >= 10,
    say(words, "phone"),
  );

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, say(words, "name"))
    .max(100, keepUnder(100, "the name")),
  email,
  phone,
});

const address = {
  street: z
    .string()
    .trim()
    .min(1, say(words, "street"))
    .max(200, keepUnder(200, "the street address")),
  unit: z.string().trim().max(50, keepUnder(50, "the unit")).nullish(),
  postcode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, say(words, "zip")),
  accessInstructions: z.string().trim().max(2000, keepUnder(2000)).nullish(),
};

// an area in sq ft: a place's floor area, an ask's rough idea of the area
// to price a Service on, or a Draft's
export const squareFeet = (
  min: number,
  tooSmall: "area" | "smallerThanAnyPlace" | "smallerThanAnyHome" = "area",
  max = 1_000_000,
) =>
  z
    .number(say(words, "area"))
    .int(say(words, "wholeFeet"))
    .min(min, say(words, tooSmall))
    .max(max, say(words, "tooBig"));

export const floorArea = squareFeet(100, "smallerThanAnyPlace");

export const premisesType = z.uuid(say(words, "premisesType"));

const homeType = z.enum(
  ["house", "apartment", "townhouse"],
  say(words, "homeType"),
);

// a home's rooms, all four together
const roomsSchema = z.object({
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z
    .number()
    .min(0.5, say(words, "halfBathroom"))
    .max(20)
    .multipleOf(0.5, say(words, "wholeOrHalf")),
  storeys: z.number().int().min(1).max(5),
  pets: z.boolean(),
});

const homeFloorArea = squareFeet(100, "smallerThanAnyHome", 100_000).nullish();

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
  say(words, "kind"),
);

// also a Service Plan's
export const conditionSchema = z.enum(
  ["light", "moderate", "heavy"],
  say(words, "condition"),
);

// also a Draft's
export const serviceKey = z.uuid(say(words, "service"));

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
    .max(200, keepUnder(200, "the business name"))
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

// a problem found once the request is read, in its language
const issue = (
  path: (string | number)[],
  key: keyof (typeof words)["en"] | "pickStartTime",
) => ({
  code: "custom" as const,
  path,
  message:
    key === "pickStartTime"
      ? pickerWords[currentLanguage()].pickStartTime
      : words[currentLanguage()][key],
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
    problems.push(issue(["businessName"], "businessName"));
  }
  if (fields.condition) {
    problems.push(issue(["condition"], "noCondition"));
  }
  if (fields.addOns?.length) {
    problems.push(issue(["addOns"], "noExtras"));
  }
  if (fields.wantsRegularService) {
    if (!fields.weekdays?.length) {
      problems.push(issue(["weekdays"], "days"));
    }
    if (!fields.preferredTime) {
      problems.push(issue(["preferredTime"], "pickStartTime"));
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
    issue([...at, r], needed ? "rooms" : "allRoomsOrNone"),
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
    ? [issue(["condition"], "condition")]
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
        email: email.nullish(),
      })
      .optional(),
    property: existingOrNew,
  })
  .refine((s) => (s.clientId === undefined) !== (s.contact === undefined), {
    path: ["clientId"],
    message: "Pick a client, or add a new one",
  })
  .superRefine(forKind);
