// Dev seed: Staff, Clients and Quotes in every state, dated around today, so
// every screen has real data to look at.
// Runs the real domain code with the clock, payments and email faked: no
// email is sent while seeding. Everyone's email is a +alias of the owner's,
// so magic links reach one inbox.
//
//   pnpm db:seed [--reset]
//
// The owner, made Office Staff, is SEED_OWNER_EMAIL (the business inbox by
// default); sign up with it, before or after seeding.
//
// Refuses to run on a database that already has Staff. With --reset it
// first deletes everything but Accounts and the Price List, so whoever has
// signed up stays signed up.
import { asc, eq, sql } from "drizzle-orm";
import type {
  NewHome,
  NewPremises,
  QuoteAsk,
  SignedInAccount,
} from "@empire-cleaning/models";
import { db } from "#db";
import {
  confirmAssignment,
  officeJob,
  offerAssignment,
  releaseAssignment,
} from "#features/assignments";
import {
  cancelJob,
  cancelTermsOf,
  recordNoAccess,
} from "#features/cancellation";
import { findClientByEmail } from "#features/clients";
import { completeJob, proposeAdjustment } from "#features/completion";
import { savePaymentMethod, startCardForm } from "#features/payments";
import { currentPriceList } from "#features/price-list";
import {
  acceptQuote,
  askForQuote,
  enterCallerAsk,
  saveDraft,
  sendQuote,
  startRevision,
  turnDownQuote,
} from "#features/quotes";
import {
  requestReschedule,
  rescheduleTermsOf,
  turnDownReschedule,
} from "#features/reschedule";
import { bookSiteVisit } from "#features/site-visits";
import { SEEDED } from "#features/services";
import { jobs } from "#features/jobs";
import { servicePlanVisits } from "#features/service-plans";
import { createStaff, setUsualWeek } from "#features/staff";
import { addDays, dayOf, weekdayOf } from "#services/clock";
import { installFakes, signIn, testClock, testPayments } from "./harness.ts";
import { sentServicePlanQuote, startedServicePlan } from "./fixtures.ts";

const OWNER = {
  email: process.env.SEED_OWNER_EMAIL ?? "empirecleaningproservices@gmail.com",
  name: "Cris Crane",
};
const alias = (tag: string) => OWNER.email.replace("@", `+${tag}@`);

const realNow = new Date();
const today = dayOf(realNow);
// an instant on the day `days` from today, mid-morning in New York
const on = (days: number, utcTime = "15:00") =>
  new Date(`${addDays(today, days)}T${utcTime}:00Z`);
// the first weekday on or after `days` from today, at 9am
const weekdayFrom = (days: number) => {
  let day = addDays(today, days);
  while (weekdayOf(day) > 4) day = addDays(day, 1);
  return { date: day, time: "09:00" };
};

// created_at and updated_at come from the database's own clock, so each move
// of the fake clock first stamps the rows made since the last move with the
// fake time they were made at
let stampedTo: Date | null = null;
const stamp = async () => {
  const { rows: tables } = await db.execute<{ table_name: string }>(
    sql`select table_name from information_schema.columns
        where table_schema = 'public' and column_name = 'created_at'`,
  );
  const fake = testClock().now();
  if (stampedTo) {
    for (const { table_name } of tables) {
      const { rows: hasUpdated } = await db.execute(
        sql`select 1 from information_schema.columns where table_schema = 'public'
            and table_name = ${table_name} and column_name = 'updated_at'`,
      );
      const t = sql.identifier(table_name);
      await db.execute(
        hasUpdated.length > 0
          ? sql`update ${t} set created_at = ${fake}, updated_at = ${fake} where created_at > ${stampedTo}`
          : sql`update ${t} set created_at = ${fake} where created_at > ${stampedTo}`,
      );
    }
  }
  const { rows } = await db.execute<{ now: Date }>(
    sql`select clock_timestamp() as now`,
  );
  stampedTo = new Date(rows[0]!.now);
};
const at = async (when: Date) => {
  await stamp();
  testClock().set(when);
};

// everything but Accounts (and their sign-in records), the Price List and
// the Services
const keep = [
  "accounts",
  "account_identities",
  "sessions",
  "verifications",
  "price_lists",
  "price_list_add_ons",
  "price_list_premises_types",
  "services",
];
// emptied together in one statement, so their foreign keys between each
// other don't matter, and without the superuser rights a hosted database
// doesn't give (the test site's on Render). The kept tables point only at
// each other, never at these.
const reset = async () => {
  const { rows: tables } = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  const emptied = tables
    .map(({ tablename }) => tablename)
    .filter((table) => !keep.includes(table));
  await db.execute(
    sql`truncate table ${sql.join(
      emptied.map((table) => sql.identifier(table)),
      sql`, `,
    )}`,
  );
};

let phones = 100;
const contact = (tag: string, name: string) => ({
  name,
  email: alias(tag),
  phone: `(646) 555-0${phones++}`,
});

const home = (street: string, over: Partial<NewHome> = {}): NewHome => ({
  kind: "residential",
  type: "apartment",
  street,
  unit: null,
  postcode: "11375",
  bedrooms: 2,
  bathrooms: 1,
  storeys: 1,
  pets: false,
  floorArea: null,
  accessInstructions: null,
  ...over,
});

const ask = (
  who: ReturnType<typeof contact>,
  property: QuoteAsk["property"],
  over: Partial<QuoteAsk> = {},
) =>
  askForQuote(null, {
    contact: who,
    property,
    serviceKey:
      "new" in property && property.new.kind === "commercial"
        ? SEEDED.commercial
        : SEEDED.standard,
    condition: "moderate",
    wantsRegularService: false,
    notes: null,
    ...over,
  } satisfies QuoteAsk);

async function seed() {
  if (process.argv.includes("--reset")) await reset();
  const { rows } = await db.execute<{ n: number }>(
    sql`select count(*)::int as n from staff`,
  );
  if (rows[0]!.n > 0) {
    throw new Error("Staff exist already: reset the dev database first");
  }

  installFakes();
  await at(on(-30));

  // ---- Staff ----
  // connects the owner's Account if they've signed up already; otherwise
  // signs them up, so Quotes can name them (a later Google sign-in with the
  // same email joins that Account: trusted linking)
  const owner = await createStaff({ ...OWNER, roles: ["office_staff"] });
  const by =
    owner.accountId ??
    (
      (await (await signIn(OWNER.email)).get("/api/me").expect(200))
        .body as SignedInAccount
    ).id;

  const cleaners = [];
  for (const [tag, name] of [
    ["cleo", "Cleo Cleaner"],
    ["ben", "Ben Cleaner"],
    ["dev", "Dev Cleaner"],
  ] as const) {
    const member = await createStaff({
      email: alias(tag),
      name,
      roles: ["cleaner"],
    });
    await setUsualWeek(member.id, [8, 8, 8, 8, 8, 0, 0]);
    cleaners.push(member);
  }
  const [cleo, ben, dev] = cleaners;

  const list = await currentPriceList();
  const officeType = list.premisesTypes[0]!.key;
  const premises = (street: string): NewPremises => ({
    kind: "commercial",
    street,
    unit: null,
    postcode: "11101",
    premisesType: officeType,
    floorArea: null,
  });

  // a one-off Draft for the Quote, priced as suggested, then Sent at `sent`
  const draftAndSend = async (
    id: string,
    {
      sent,
      validityDays = 7,
      startIn,
      crewSize = 1,
      addOns = [],
    }: {
      sent: Date;
      validityDays?: number;
      startIn: number;
      crewSize?: number;
      addOns?: string[];
    },
  ) => {
    await at(sent);
    await startRevision(id, "one_off", by);
    await saveDraft(id, {
      addOns,
      crewSize,
      depositPercent: 25,
      validityDays,
      proposedStart: weekdayFrom(startIn),
      overrides: {},
    });
    return sendQuote(id);
  };

  // ---- Requested ----
  await at(on(-3));
  await ask(
    contact("priya", "Priya Shah"),
    {
      new: home("12 Elm St", { type: "house", bedrooms: 3, storeys: 2 }),
    },
    { condition: "heavy", notes: "Moving out at the end of the month." },
  );

  await at(on(-5));
  await ask(
    contact("ortiz", "Dana Ortiz"),
    { new: premises("400 Market St") },
    {
      businessName: "Ortiz Dental",
      condition: undefined,
      wantsRegularService: true,
      weekdays: [0, 3],
      preferredTime: "18:00",
    },
  );

  await at(on(-2));
  const park = await ask(
    contact("park", "Lee Park"),
    { new: premises("88 Broad St") },
    { businessName: "Park & Co Law", condition: undefined },
  );
  await bookSiteVisit(
    { quoteId: park.id, staffId: cleo!.id, minutes: 60, ...weekdayFrom(2) },
    by,
  );

  await at(new Date(realNow.getTime() - 2 * 3_600_000));
  await ask(
    contact("tom", "Tom Becker"),
    { new: home("7 Birch Ave", { bedrooms: 1 }) },
    { condition: "light", wantsRegularService: true },
  );

  // ---- Draft: a caller's, being written ----
  await at(on(-1));
  const ana = await enterCallerAsk(by, {
    contact: contact("ana", "Ana Lima"),
    property: {
      new: home("31 Cedar Ct", { type: "townhouse", storeys: 2, pets: true }),
    },
    serviceKey: SEEDED.standard,
    condition: "moderate",
    wantsRegularService: false,
    notes: "Called in; wants a price before her parents visit.",
  });
  await startRevision(ana.id, "one_off", by);
  await saveDraft(ana.id, {
    addOns: [],
    crewSize: 2,
    depositPercent: 25,
    validityDays: 7,
    proposedStart: weekdayFrom(6),
    overrides: {},
  });

  // ---- Sent ----
  await at(on(-8));
  const sam = await ask(contact("sam", "Sam Ng"), {
    new: home("5 Oak Ln", { type: "house", bedrooms: 4, bathrooms: 2 }),
  });
  // expires tomorrow
  await draftAndSend(sam.id, { sent: on(-6), startIn: 10 });

  await at(on(-4));
  const jo = await ask(
    contact("jo", "Jo Wright"),
    { new: home("220 Pine St", { unit: "3F" }) },
    { condition: "light" },
  );
  await draftAndSend(jo.id, { sent: on(-2), startIn: 9 });

  await at(on(-5));
  const kim = await ask(contact("kim", "Kim Osei"), {
    new: home("3 Willow Way", { type: "house" }),
  });
  await draftAndSend(kim.id, { sent: on(-3), startIn: 8 });
  // a new Revision being drafted on the Sent Quote
  await at(on(-1));
  await startRevision(kim.id, "one_off", by);

  // ---- Expired lately ----
  await at(on(-18));
  const ruth = await ask(
    contact("ruth", "Ruth Adler"),
    { new: home("64 Spruce Rd", { type: "house", bedrooms: 5, bathrooms: 3 }) },
    { condition: "heavy" },
  );
  await draftAndSend(ruth.id, { sent: on(-16), startIn: -5 });

  await at(on(-27));
  const chris = await ask(contact("chris", "Chris Vo"), {
    new: home("9 Mill St", { unit: "2" }),
  });
  await draftAndSend(chris.id, {
    sent: on(-25),
    validityDays: 5,
    startIn: -15,
  });

  // ---- Turned Down: closed, so only on the Client's page ----
  await at(on(-4));
  const gail = await ask(contact("gail", "Gail Turner"), {
    new: home("1 Far Away Rd", { postcode: "10701" }),
  });
  await turnDownQuote(gail.id, "out_of_area", by);

  // ---- a First Clean done, then a Service Plan offered unprompted ----
  const max = contact("max", "Max Rivera");
  const firstClean = await firstCleanDone(max, "19 Maple Dr", -20, -12);
  await at(on(-2));
  await sentServicePlanQuote({
    propertyId: firstClean.propertyId,
    byAccountId: by,
    startsAt: `${weekdayFrom(9).date}T14:00:00Z`,
    recurrence: "fortnightly",
  });

  // ---- on a Service Plan, asking again: a plan change ----
  const nina = contact("nina", "Nina Brooks");
  const ninaHome = await firstCleanDone(nina, "50 Aspen Pl", -28, -21);
  await at(on(-14));
  const ninaPlan = await startedServicePlan({
    propertyId: ninaHome.propertyId,
    byAccountId: by,
    startsAt: `${weekdayFrom(3).date}T14:00:00Z`,
  });
  await at(on(-1));
  await ask(
    nina,
    { new: home("50 Aspen Pl", { type: "house", bedrooms: 3 }) },
    { wantsRegularService: true, notes: "Could we add a second day?" },
  );

  // ---- Jobs in every state the Office's Job page shows ----
  const [firstAddOn, secondAddOn] = list.addOns;

  // booked, nobody Offered yet, and its place not yet open to Cleaners
  await bookedJob(contact("olga", "Olga Petrova"), "8 Birch Ln", -3, 12);

  // a crew of two: one Confirmed, one Released, so a place is open to free
  // Cleaners; the Client asked to move it once, and was turned down
  const pair = await bookedJob(
    contact("pete", "Pete Ortiz"),
    "77 Cedar St",
    -10,
    7,
    { crewSize: 2 },
  );
  await at(on(-8));
  await confirm(pair.id, ben!.id);
  const devPlace = await confirm(pair.id, dev!.id);
  await at(on(-5));
  await requestReschedule(
    pair.id,
    { date: weekdayFrom(8).date, time: "13:00" },
    {
      cost: (await rescheduleTermsOf(pair))!.cost,
      byAccountId: null,
      byClient: true,
    },
  );
  await at(on(-4));
  await turnDownReschedule(pair.id, "We're fully booked that afternoon.", by);
  await at(on(-2));
  await releaseAssignment(dev!.id, devPlace);

  // the Client has asked to move it, waiting on the Office
  const moving = await bookedJob(
    contact("rosa", "Rosa Diaz"),
    "12 Elm Ct",
    -9,
    5,
  );
  await confirm(moving.id, cleo!.id);
  await at(on(-1));
  await requestReschedule(
    moving.id,
    { date: weekdayFrom(13).date, time: "11:00" },
    {
      cost: (await rescheduleTermsOf(moving))!.cost,
      byAccountId: null,
      byClient: true,
    },
  );

  // Completed with an Adjustment of each kind: one taken off at once, an
  // increase to review, and one proposed to the Client
  const adjusted = await bookedJob(
    contact("sam", "Sam Lee"),
    "30 Pine Ave",
    -12,
    -4,
    { addOns: [firstAddOn!.key] },
  );
  await confirm(adjusted.id, cleo!.id);
  await at(after(adjusted, 4));
  await completeJob(cleo!.id, adjusted.id, {
    condition: "heavy",
    reports: [
      {
        kind: "add_on_not_done",
        addOnKey: firstAddOn!.key,
        reason: "It was in use",
      },
      {
        kind: "add_on_done",
        addOnKey: secondAddOn!.key,
        reason: "The Client asked for it on the day",
      },
      { kind: "extra_time", hours: 1, reason: "Heavier than quoted" },
    ],
  });
  await at(after(adjusted, 24));
  const extra = (await officeJob(adjusted.id)).completion!.adjustments.find(
    (a) => a.kind === "extra_time",
  )!;
  await proposeAdjustment(adjusted.id, extra.id, {}, by);

  // Completed, but the Balance couldn't be charged
  const unpaid = await bookedJob(
    contact("tia", "Tia Moore"),
    "5 Oak Rd",
    -15,
    -6,
  );
  await confirm(unpaid.id, cleo!.id);
  await at(after(unpaid, 4));
  testPayments().failCharges();
  await completeJob(cleo!.id, unpaid.id, {
    condition: "moderate",
    reports: [],
  });
  testPayments().failCharges(null);

  // cancelled for the Client the evening before: a Late Cancellation
  const late = await bookedJob(
    contact("uma", "Uma Shah"),
    "21 Willow Way",
    -14,
    -2,
  );
  await confirm(late.id, ben!.id);
  await at(after(late, -14));
  await cancelJob(late.id, {
    by: "client",
    feeCents: (await cancelTermsOf(late))!.client.feeCents,
    reason: null,
    byAccountId: by,
    byClient: false,
  });

  // cancelled by Empire Cleaning, refunded in full
  const ours = await bookedJob(
    contact("vic", "Vic Hale"),
    "64 Spruce Rd",
    -10,
    6,
  );
  await at(on(-1));
  await cancelJob(ours.id, {
    by: "empire",
    feeCents: (await cancelTermsOf(ours))!.empire.feeCents,
    reason: "A Cleaner is off sick and nobody can cover.",
    byAccountId: by,
    byClient: false,
  });

  // the Cleaner couldn't get in
  const locked = await bookedJob(
    contact("wes", "Wes Grant"),
    "3 Hazel St",
    -9,
    -1,
  );
  await confirm(locked.id, cleo!.id);
  await at(after(locked, 1));
  await recordNoAccess(
    cleo!.id,
    locked.id,
    "Nobody answered the door, and the phone went to voicemail.",
  );

  // a place Offered, not yet answered
  const offered = await bookedJob(
    contact("xena", "Xena Ford"),
    "40 Poplar Ave",
    -4,
    14,
  );
  await at(on(-1));
  await offerAssignment(offered.id, ben!.id, by);

  // Nina's second plan clean, Skipped: the plan carries on
  const [, ninaSecond] = await planJobs(ninaPlan.planId);
  await at(on(-1));
  await cancelJob(ninaSecond!.id, {
    by: "client",
    feeCents: (await cancelTermsOf(ninaSecond!))!.client.feeCents,
    reason: null,
    byAccountId: by,
    byClient: false,
  });

  // a plan clean cancelled late, whose fee couldn't be charged
  const yara = contact("yara", "Yara Kim");
  const yaraHome = await firstCleanDone(yara, "9 Laurel Ct", -35, -30);
  await at(on(-20));
  const yaraPlan = await startedServicePlan({
    propertyId: yaraHome.propertyId,
    byAccountId: by,
    startsAt: `${weekdayFrom(-13).date}T14:00:00Z`,
    recurrence: "fortnightly",
  });
  await at(after(yaraPlan.firstJob, -10));
  testPayments().failCharges();
  await cancelJob(yaraPlan.firstJob.id, {
    by: "client",
    feeCents: (await cancelTermsOf(yaraPlan.firstJob))!.client.feeCents,
    reason: null,
    byAccountId: by,
    byClient: false,
  });
  testPayments().failCharges(null);

  // the fake gateway's payers and cards would fail against the real Stripe
  // sandbox; Clients enter a test card on their first payment instead
  await db.execute(sql`delete from payment_methods`);
  await db.execute(sql`delete from payers`);

  await stamp();

  async function firstCleanDone(
    who: ReturnType<typeof contact>,
    street: string,
    askedIn: number,
    cleanedIn: number,
  ) {
    const job = await bookedJob(who, street, askedIn, cleanedIn, {}, true);
    await confirm(job.id, cleo!.id);
    await at(after(job, 6));
    await completeJob(cleo!.id, job.id, { condition: "moderate", reports: [] });
    return { propertyId: job.propertyId };
  }

  // a house asked about `askedIn` days from today, its Quote accepted by
  // phone for a Deep Clean on the first weekday from `startIn`
  async function bookedJob(
    who: ReturnType<typeof contact>,
    street: string,
    askedIn: number,
    startIn: number,
    terms: { crewSize?: number; addOns?: string[] } = {},
    wantsRegularService = false,
  ) {
    await at(on(askedIn));
    const asked = await ask(
      who,
      { new: home(street, { type: "house", bedrooms: 3 }) },
      { wantsRegularService },
    );
    await draftAndSend(asked.id, { sent: on(askedIn), startIn, ...terms });
    const owner = (await findClientByEmail(who.email))!;
    const form = await startCardForm(owner);
    await savePaymentMethod(owner, form.secret);
    const accepted = await acceptQuote(
      asked.id,
      { serviceKey: SEEDED.deep },
      { by: "office", accountId: by },
    );
    if (accepted.status !== "accepted") throw new Error("not accepted");
    return accepted.job;
  }

  // Offers a Cleaner a place, which they Confirm: their Assignment's id
  async function confirm(jobId: string, staffId: string) {
    const offered = await offerAssignment(jobId, staffId, by);
    const place = offered.assignments.find(
      (a) => a.staff.id === staffId && a.status === "offered",
    )!;
    await confirmAssignment(staffId, place.id);
    return place.id;
  }
}

// some hours after a Job starts (before it, if negative)
const after = (job: { startsAt: Date }, hours: number) =>
  new Date(job.startsAt.getTime() + hours * 3_600_000);

// a Service Plan's Jobs, soonest first
const planJobs = async (planId: string) =>
  (
    await db
      .select({ job: jobs })
      .from(jobs)
      .innerJoin(servicePlanVisits, eq(servicePlanVisits.jobId, jobs.id))
      .where(eq(servicePlanVisits.servicePlanId, planId))
      .orderBy(asc(jobs.startsAt))
  ).map((row) => row.job);

await seed();
console.log(`seeded; sign in as ${OWNER.email} (Office) or any ${alias("…")}`);
process.exit(0);
