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

export const newPropertySchema = z.object({
  type: z.enum(["house", "apartment", "townhouse"], {
    error: "Choose the type of home",
  }),
  street: z.string().trim().min(1, "Enter the street address").max(200),
  unit: z.string().trim().max(50).nullish(),
  postcode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Enter a 5-digit ZIP code"),
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z
    .number()
    .min(0.5, "A home needs at least half a bathroom")
    .max(20)
    .multipleOf(0.5, "Use whole or half bathrooms, like 1.5"),
  storeys: z.number().int().min(1).max(5),
  pets: z.boolean(),
  floorArea: z.number().int().min(100).max(100_000).nullish(),
  accessInstructions: z.string().trim().max(2000).nullish(),
});

export const conditionSchema = z.enum(["light", "moderate", "heavy"], {
  error: "Choose how much cleaning the home needs",
});

const request = {
  condition: conditionSchema,
  wantsRegularService: z.boolean(),
  // the Add-ons chosen, by key; checked against the Price List on submit
  addOns: z.array(z.uuid()).max(50).optional(),
  notes: z.string().trim().max(2000).nullish(),
};

// a Guest: full contact details and a new Property
export const guestSubmission = z.object({
  ...request,
  contact: contactSchema,
  property: z.object({ new: newPropertySchema }),
});

// a signed-in Account not yet connected to a Client: its proven email is used
export const accountSubmission = z.object({
  ...request,
  contact: contactSchema.omit({ email: true }),
  property: z.object({ new: newPropertySchema }),
});

// a Client: no contact details; a new Property or one of their own
export const clientSubmission = z.object({
  ...request,
  property: z.union([
    z.object({ new: newPropertySchema }),
    z.object({ existing: z.uuid() }),
  ]),
});

// the Office correcting a home's details (the address is its identity, so it
// isn't correctable); send only what changes
export const propertyCorrectionSchema = newPropertySchema
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
  });
