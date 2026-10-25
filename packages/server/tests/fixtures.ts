import type {
  CleanType,
  NewProperty,
  QuoteRequestSubmission,
} from "@empire-cleaning/models";
import { db } from "#db";
import { createClient } from "#features/clients";
import { bookJob } from "#features/jobs";
import { properties } from "#features/properties";
import { createStaff } from "#features/staff";
import { addressKey } from "../src/features/properties/address.ts";
import { api, apiAgent, signIn } from "./harness.ts";

// shared by the tests that need Quote Requests to work with

export const home: NewProperty = {
  type: "apartment",
  street: "41-12 Austin St",
  unit: "4B",
  postcode: "11375",
  bedrooms: 2,
  bathrooms: 1.5,
  storeys: 1,
  pets: true,
  floorArea: null,
  accessInstructions: "Ring 4B; the doorman has a key.",
};

export const casey = {
  name: "Casey Client",
  email: "casey@example.com",
  phone: "(646) 555-0100",
};

export const guestRequest = (
  overrides: Partial<QuoteRequestSubmission> = {},
): QuoteRequestSubmission => ({
  contact: casey,
  property: { new: home },
  condition: "moderate",
  wantsRegularService: true,
  notes: null,
  ...overrides,
});

export const submit = (
  body: unknown,
  agent: ReturnType<typeof apiAgent> | ReturnType<typeof api> = api(),
) => agent.post("/api/quote-requests").send(body as object);

export const signInAsOffice = async () => {
  await createStaff({
    email: "olive@example.com",
    name: "Olive Owner",
    roles: ["office_staff"],
  });
  return signIn("olive@example.com");
};

// a booked Job at a home of its own. Nothing in the API books Jobs until
// accepting a Quote (#8), so tests put them on the Schedule directly.
let homes = 0;
export const bookedJob = async ({
  startsAt,
  labourHours,
  crewSize = 2,
  cleanType = "deep",
}: {
  startsAt: string;
  labourHours: number;
  crewSize?: number;
  cleanType?: CleanType;
}) => {
  homes += 1;
  const client = await createClient({
    email: `client${homes}@example.com`,
    name: `Client ${homes}`,
    phone: casey.phone,
  });
  const [property] = await db
    .insert(properties)
    .values({
      ...home,
      street: `${homes} Austin St`,
      clientId: client.id,
      condition: "moderate",
      addressKey: addressKey({ ...home, street: `${homes} Austin St` }),
    })
    .returning();
  return bookJob({
    propertyId: property!.id,
    startsAt: new Date(startsAt),
    labourHours,
    crewSize,
    cleanType,
  });
};
