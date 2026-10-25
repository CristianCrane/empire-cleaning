import type {
  NewProperty,
  QuoteRequestSubmission,
} from "@empire-cleaning/models";
import { createStaff } from "#features/staff";
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
