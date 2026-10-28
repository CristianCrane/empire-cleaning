import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type {
  AcceptOutcome,
  BillPayment,
  CleanType,
  Condition,
  NewHome,
  OfficeServicePlan,
  QuoteAsk,
  Service,
  ServiceInput,
  SignedInAccount,
} from "@empire-cleaning/models";
import { db } from "#db";
import { confirmAssignment, offerAssignment } from "#features/assignments";
import { bills, makeDueBills, setBilling } from "#features/bills";
import { findClientByEmail, createClient } from "#features/clients";
import { completeJob } from "#features/completion";
import { bookJob } from "#features/jobs";
import { savePaymentMethod, startCardForm } from "#features/payments";
import { SEEDED } from "#features/services";
import { currentPriceList } from "#features/price-list";
import {
  acceptQuote,
  askForQuote,
  offerServicePlan,
  quotes,
  saveDraft,
  sendQuote,
  startRevision,
} from "#features/quotes";
import { dayOf, timeOf } from "#services/clock";
import { properties } from "#features/properties";
import { createStaff, setUsualWeek } from "#features/staff";
import { servicePlans } from "#features/service-plans";
import { addressKey } from "../src/features/properties/address.ts";
import { api, apiAgent, signIn, testClock, testPayments } from "./harness.ts";

// shared by the tests that need Quotes asked for to work with

export const home: NewHome = {
  kind: "residential",
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

export const guestAsk = (overrides: Partial<QuoteAsk> = {}): QuoteAsk => ({
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
) => agent.post("/api/quotes/ask").send(body as object);

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
 * that need a price: a Quote a Guest asked for (with these Add-ons, by
 * name), its first Revision drafted and Sent by `byAccountId`, a card saved by the Client, and
 * acceptance recorded by the Office, which takes the Deposit.
 */
export const acceptedJob = async ({
  startsAt,
  byAccountId,
  crewSize = 1,
  depositPercent = 25,
  addOns = [],
  client = casey,
  wantsRegularService = true,
}: {
  startsAt: string;
  byAccountId: string;
  crewSize?: number;
  depositPercent?: number;
  addOns?: string[];
  client?: typeof casey;
  wantsRegularService?: boolean;
}) => {
  const list = await currentPriceList();
  const keys = list.addOns
    .filter((a) => addOns.includes(a.name))
    .map((a) => a.key);
  const receipt = await askForQuote(
    null,
    guestAsk({ contact: client, addOns: keys, wantsRegularService }),
  );
  const { quote } = await startRevision(receipt.id, "one_off", byAccountId);
  const at = new Date(startsAt);
  await saveDraft(quote.id, {
    addOns: keys,
    crewSize,
    depositPercent,
    validityDays: quote.draft!.validityDays,
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

/**
 * A home whose First Clean is Completed, so it can be offered a Service
 * Plan: a Deep Clean booked as acceptedJob() books it, at 9am on Monday 12
 * January, done at 11am that day by Cory, who reports the home's Condition
 * as `condition`. Its Quote asked for regular visits unless
 * `wantsRegularService` is false. The clock is left at 11am. Returns the
 * Quote that booked the First Clean, its Property, and its Job.
 */
export const completedFirstClean = async ({
  byAccountId,
  condition = "moderate",
  wantsRegularService,
}: {
  byAccountId: string;
  condition?: Condition;
  wantsRegularService?: boolean;
}) => {
  const cory = await createStaff({
    name: "Cory Cleaner",
    email: "cory@example.com",
    roles: ["cleaner"],
  });
  await setUsualWeek(cory.id, [8, 8, 8, 8, 8, 0, 0]);
  // a second Cleaner, so a crew of 2 has room
  const bea = await createStaff({
    name: "Bea Cleaner",
    email: "bea@example.com",
    roles: ["cleaner"],
  });
  await setUsualWeek(bea.id, [8, 8, 8, 8, 8, 0, 0]);
  const job = await acceptedJob({
    startsAt: "2026-01-12T14:00:00Z",
    byAccountId,
    wantsRegularService,
  });
  const offered = await offerAssignment(job.id, cory.id, byAccountId);
  await confirmAssignment(cory.id, offered.assignments[0]!.id);
  testClock().set(new Date("2026-01-12T16:00:00Z"));
  await completeJob(cory.id, job.id, { condition, reports: [] });

  const [quote] = await db
    .select({ id: quotes.id })
    .from(quotes)
    .where(eq(quotes.jobId, job.id));
  return {
    quoteId: quote!.id,
    propertyId: job.propertyId,
    job,
  };
};

/**
 * A Service Plan Quote for the home, offered unprompted and Sent by
 * `byAccountId`: a Standard Clean on `recurrence` from `startsAt`, at
 * moderate Condition and the Price List's Plan Discount, with no Add-ons. Or
 * every week on several weekdays, a Standard Clean from each of `startsAt`.
 */
export const sentServicePlanQuote = async ({
  propertyId,
  byAccountId,
  startsAt,
  recurrence = "weekly",
  crewSize = 1,
  depositPercent,
}: {
  propertyId: string;
  byAccountId: string;
  startsAt: string | string[];
  recurrence?: "weekly" | "fortnightly" | "four_weekly";
  crewSize?: number;
  depositPercent?: number;
}) => {
  const { quote } = await offerServicePlan(propertyId, byAccountId);
  await saveDraft(quote.id, {
    addOns: [],
    depositPercent: depositPercent ?? quote.draft!.depositPercent,
    validityDays: quote.draft!.validityDays,
    plan: {
      recurrence,
      discountPercent: quote.draft!.plan!.discountPercent,
      condition: "moderate",
      days: [startsAt].flat().map((s) => {
        const at = new Date(s);
        return {
          start: { date: dayOf(at), time: timeOf(at) },
          cleanType: "standard" as const,
          crewSize,
          override: null,
        };
      }),
    },
  });
  return sendQuote(quote.id);
};

/**
 * A Service Plan started at the home from `sentServicePlanQuote`, as the
 * Office records the Client's acceptance on their saved card. Returns the
 * plan and its first Job.
 */
export const startedServicePlan = async (
  plan: Parameters<typeof sentServicePlanQuote>[0],
) => {
  const quote = await sentServicePlanQuote(plan);
  const accepted = await acceptQuote(
    quote.id,
    {},
    { by: "office", accountId: plan.byAccountId },
  );
  if (accepted.status !== "accepted") throw new Error("not accepted");
  const [started] = await db
    .select({ id: servicePlans.id })
    .from(servicePlans)
    .where(eq(servicePlans.quoteId, quote.id));
  return { planId: started!.id, firstJob: accepted.job };
};

/**
 * Casey's weekly Standard Clean plan from 9am on Monday 19 January 2026,
 * accepted in the portal with the card saved at their First Clean, done by
 * Cory, who holds a Confirmed place on its first Job. The clock is left at
 * 11am on Monday the 12th, so its Jobs are booked up to 9 February.
 */
export const crewedServicePlan = async () => {
  const office = await signInAsOffice();
  const me = (await office.get("/api/me").expect(200)).body as SignedInAccount;
  const { propertyId } = await completedFirstClean({ byAccountId: me.id });
  const quote = await sentServicePlanQuote({
    propertyId,
    byAccountId: me.id,
    startsAt: "2026-01-19T14:00:00.000Z",
  });
  const client = await signIn(casey.email);
  const outcome = (
    await client
      .post(`/api/quotes/mine/${quote.id}/accept`)
      .send({ cleanType: "standard" })
      .expect(200)
  ).body as AcceptOutcome;
  if (outcome.status !== "accepted") throw new Error("not accepted");
  const planId = outcome.quote.servicePlanId!;

  const plan = (await office.get(`/api/service-plans/${planId}`).expect(200))
    .body as OfficeServicePlan;
  const jobId = plan.jobs[0]!.id;
  const staff = (await office.get("/api/staff").expect(200)).body as {
    id: string;
    email: string;
  }[];
  const cleanerId = staff.find((s) => s.email === "cory@example.com")!.id;
  const offered = await offerAssignment(jobId, cleanerId, me.id);
  await confirmAssignment(cleanerId, offered.assignments[0]!.id);

  return { office, client, planId, jobId, cleanerId };
};

// business premises for the Client, making them a commercial Client, who
// can be billed weekly (ADR-0016)
export const addPremises = async (clientId: string) => {
  const premises = {
    street: "200 Park Ave S",
    unit: "Floor 3",
    postcode: "10003",
  };
  await db.insert(properties).values({
    ...premises,
    clientId,
    kind: "commercial",
    premisesTypeKey: randomUUID(),
    floorArea: 4500,
    addressKey: addressKey(premises),
  });
};

/**
 * A week billed for Casey, a business now, with premises: their Deep Clean
 * at 9am on Wednesday 7 January, booked as acceptedJob() books it and done
 * by Cory at noon, goes on the Bill made on Monday the 12th. It's charged
 * automatically, or paid on its page, as `payment` says, and emailed to
 * `billingEmail` if given. With `plan`, Casey also has a weekly plan at the
 * home from Thursday the 8th, whose first Job, done that day, is on the Bill
 * too. With `failing`, its automatic Charge is declined, so it's Unpaid (and
 * the plan On Hold), and Charges keep failing until failCharges(null). The
 * clock is left at 10am on Monday the 12th; with `unbilled`, it stops before
 * then, at noon on the day the last Job was done, and no Bill is made yet.
 */
export const billedWeek = async ({
  byAccountId,
  payment = "automatic",
  billingEmail = null,
  plan = false,
  failing = false,
  unbilled = false,
}: {
  byAccountId: string;
  payment?: BillPayment;
  billingEmail?: string | null;
  plan?: boolean;
  failing?: boolean;
  unbilled?: boolean;
}) => {
  const cory = await createStaff({
    name: "Cory Cleaner",
    email: "cory@example.com",
    roles: ["cleaner"],
  });
  await setUsualWeek(cory.id, [8, 8, 8, 8, 8, 0, 0]);
  const crewed = async (jobId: string) => {
    const offered = await offerAssignment(jobId, cory.id, byAccountId);
    await confirmAssignment(cory.id, offered.assignments[0]!.id);
  };

  const job = await acceptedJob({
    startsAt: "2026-01-07T14:00:00Z",
    byAccountId,
  });
  const client = (await findClientByEmail(casey.email))!;
  await addPremises(client.id);
  await setBilling(client.id, {
    weekly: true,
    payment,
    termsDays: 14,
    billingEmail,
  });
  await crewed(job.id);
  testClock().set(new Date("2026-01-07T17:00:00Z"));
  await completeJob(cory.id, job.id, { condition: "moderate", reports: [] });

  let planId: string | null = null;
  if (plan) {
    const started = await startedServicePlan({
      propertyId: job.propertyId,
      byAccountId,
      startsAt: "2026-01-08T14:00:00Z",
    });
    planId = started.planId;
    await crewed(started.firstJob.id);
    testClock().set(new Date("2026-01-08T17:00:00Z"));
    await completeJob(cory.id, started.firstJob.id, {
      condition: "moderate",
      reports: [],
    });
  }

  if (unbilled) {
    return { clientId: client.id, billId: null, jobId: job.id, planId };
  }
  testClock().set(new Date("2026-01-12T15:00:00Z"));
  if (failing) testPayments().failCharges();
  await makeDueBills();
  const [bill] = await db
    .select({ id: bills.id })
    .from(bills)
    .where(eq(bills.clientId, client.id));
  return { clientId: client.id, billId: bill!.id, jobId: job.id, planId };
};

// changes one of the Services every install starts with, as Office Staff
// would on its page
export const setService = async (
  office: Awaited<ReturnType<typeof signInAsOffice>>,
  which: keyof typeof SEEDED,
  changes: Partial<ServiceInput>,
) => {
  const {
    key,
    id: _id,
    version: _version,
    createdAt: _createdAt,
    createdByName: _createdByName,
    ...input
  } = (await office.get(`/api/services/${SEEDED[which]}`).expect(200))
    .body as Service;
  return (
    await office
      .put(`/api/services/${key}`)
      .send({ ...input, ...changes })
      .expect(200)
  ).body as Service;
};
