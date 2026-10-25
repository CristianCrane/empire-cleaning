import type {
  CleanType,
  NewProperty,
  QuoteRequestSubmission,
} from "@empire-cleaning/models";
import { db } from "#db";
import { findClientByEmail, createClient } from "#features/clients";
import { bookJob } from "#features/jobs";
import { savePaymentMethod, startCardForm } from "#features/payments";
import { currentPriceList } from "#features/price-list";
import { submitQuoteRequest } from "#features/quote-requests";
import {
  acceptQuote,
  saveDraft,
  sendQuote,
  startDraft,
} from "#features/quotes";
import { dayOf, timeOf } from "#services/clock";
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

// a booked Job at a home of its own, put on the Schedule directly, for tests
// about the Schedule rather than about accepting a Quote
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

/**
 * A Deep Clean booked the way the business books them, for tests about Jobs
 * that need a price: a Guest's Quote Request (with these Add-ons, by name),
 * Quoted and Sent by `byAccountId`, a card saved by the Client, and
 * acceptance recorded by the Office, which takes the Deposit.
 */
export const acceptedJob = async ({
  startsAt,
  byAccountId,
  crewSize = 1,
  depositPercent = 25,
  addOns = [],
  client = casey,
}: {
  startsAt: string;
  byAccountId: string;
  crewSize?: number;
  depositPercent?: number;
  addOns?: string[];
  client?: typeof casey;
}) => {
  const list = await currentPriceList();
  const keys = list.addOns
    .filter((a) => addOns.includes(a.name))
    .map((a) => a.key);
  const receipt = await submitQuoteRequest(
    null,
    guestRequest({ contact: client, addOns: keys }),
  );
  const { quote } = await startDraft(receipt.id, byAccountId);
  const at = new Date(startsAt);
  await saveDraft(quote.id, {
    addOns: keys,
    crewSize,
    depositPercent,
    validityDays: quote.validityDays,
    proposedStart: { date: dayOf(at), time: timeOf(at) },
    overrides: { deep: null, standard: null },
  });
  await sendQuote(quote.id);

  const owner = (await findClientByEmail(client.email))!;
  const form = await startCardForm(owner);
  await savePaymentMethod(owner, form.secret);
  const accepted = await acceptQuote(
    quote.id,
    { cleanType: "deep" },
    { by: "office", accountId: byAccountId },
  );
  if (accepted.status !== "accepted") throw new Error("not accepted");
  return accepted.job;
};
