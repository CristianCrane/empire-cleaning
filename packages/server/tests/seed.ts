// Dev seed: Staff, Clients and Quotes in every state, dated around today, so
// every screen has real data to look at. The test site's demo for the owner
// too: real-looking people and addresses across Queens, a week of regular
// cleans with their Cleaners, and a business billed weekly.
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
  Weekday,
} from "@empire-cleaning/models";
import { db } from "#db";
import {
  confirmAssignment,
  officeJob,
  offerAssignment,
  releaseAssignment,
} from "#features/assignments";
import {
  bills,
  makeDueBills,
  recordOutsidePayment,
  setBilling,
} from "#features/bills";
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
  quotes,
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
import {
  bookSiteVisit,
  recordFindingsWithoutVisit,
} from "#features/site-visits";
import { SEEDED } from "#features/services";
import { jobs } from "#features/jobs";
import {
  generateServicePlanJobs,
  servicePlans,
  servicePlanVisits,
} from "#features/service-plans";
import { createStaff, setUsualWeek } from "#features/staff";
import { addDays, atTime, dayOf, weekdayOf } from "#services/clock";
import { installFakes, signIn, testClock, testPayments } from "./harness.ts";
import { sentServicePlanQuote, startedServicePlan } from "./fixtures.ts";
import { addTesters } from "./testers.ts";

const OWNER = {
  email: process.env.SEED_OWNER_EMAIL ?? "empirecleaningproservices@gmail.com",
  name: "Jennifer",
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
const mondayOf = (day: string) => addDays(day, -weekdayOf(day));

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
  phone: `(718) 555-0${phones++}`,
});

const home = (
  street: string,
  postcode: string,
  over: Partial<NewHome> = {},
): NewHome => ({
  kind: "residential",
  type: "apartment",
  street,
  unit: null,
  postcode,
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
  await at(on(-40));

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
    ["maria", "Maria Gonzalez"],
    ["luz", "Luz Herrera"],
    ["daniela", "Daniela Cruz"],
  ] as const) {
    const member = await createStaff({
      email: alias(tag),
      name,
      roles: ["cleaner"],
    });
    await setUsualWeek(member.id, [8, 8, 8, 8, 8, 0, 0]);
    cleaners.push(member);
  }
  const [maria, luz, daniela] = cleaners;
  if (process.env.APP_MODE === "test") await addTesters();

  const list = await currentPriceList();
  const officeType = list.premisesTypes[0]!.key;
  const premises = (street: string, postcode: string): NewPremises => ({
    kind: "commercial",
    street,
    unit: null,
    postcode,
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
      time = "09:00",
      crewSize = 1,
      addOns = [],
    }: {
      sent: Date;
      validityDays?: number;
      startIn: number;
      time?: string;
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
      proposedStart: { ...weekdayFrom(startIn), time },
      overrides: {},
    });
    return sendQuote(id);
  };

  // ---- Requested ----
  await at(on(-3));
  await ask(
    contact("priya", "Priya Shah"),
    {
      new: home("214-15 42nd Ave", "11361", {
        type: "house",
        bedrooms: 3,
        storeys: 2,
      }),
    },
    {
      condition: "heavy",
      notes: "Moving out at the end of the month; the landlord inspects after.",
    },
  );

  await at(on(-2));
  const park = await ask(
    contact("park", "Lee Park"),
    { new: premises("1-50 50th Ave", "11101") },
    { businessName: "Park & Co Law", condition: undefined },
  );
  await bookSiteVisit(
    { quoteId: park.id, staffId: maria!.id, minutes: 60, ...weekdayFrom(2) },
    by,
  );

  // ---- Draft: a caller's, being written ----
  await at(on(-1));
  const ana = await enterCallerAsk(by, {
    contact: contact("ana", "Ana Lima"),
    property: {
      new: home("62-14 Saunders St", "11374", {
        type: "townhouse",
        storeys: 2,
        pets: true,
      }),
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
    new: home("45-21 Bell Blvd", "11361", {
      type: "house",
      bedrooms: 4,
      bathrooms: 2,
    }),
  });
  // expires tomorrow
  await draftAndSend(sam.id, { sent: on(-6), startIn: 10, time: "11:00" });

  await at(on(-4));
  const jo = await ask(
    contact("jo", "Jo Wright"),
    { new: home("35-20 Leverich St", "11372", { unit: "3F" }) },
    { condition: "light" },
  );
  await draftAndSend(jo.id, { sent: on(-2), startIn: 11, time: "14:00" });

  await at(on(-5));
  const kim = await ask(contact("kim", "Kim Osei"), {
    new: home("83-40 Abingdon Rd", "11415", { type: "house" }),
  });
  await draftAndSend(kim.id, { sent: on(-3), startIn: 12, time: "10:00" });
  // a new Revision being drafted on the Sent Quote
  await at(on(-1));
  await startRevision(kim.id, "one_off", by);

  // ---- Expired lately ----
  await at(on(-18));
  const ruth = await ask(
    contact("ruth", "Ruth Adler"),
    {
      new: home("11 Arleigh Rd", "11021", {
        type: "house",
        bedrooms: 5,
        bathrooms: 3,
      }),
    },
    { condition: "heavy" },
  );
  await draftAndSend(ruth.id, { sent: on(-16), startIn: -5 });

  await at(on(-27));
  const chris = await ask(contact("chris", "Chris Vo"), {
    new: home("30-58 32nd St", "11102", { unit: "2" }),
  });
  await draftAndSend(chris.id, {
    sent: on(-25),
    validityDays: 5,
    startIn: -15,
  });

  // ---- Turned Down: closed, so only on the Client's page ----
  await at(on(-4));
  const gail = await ask(contact("gail", "Gail Turner"), {
    new: home("14 Palisade Ave", "10701"),
  });
  await turnDownQuote(gail.id, "out_of_area", by);

  // ---- a First Clean done, then a Service Plan offered unprompted ----
  const max = contact("max", "Max Rivera");
  const firstClean = await firstCleanDone(
    max,
    home("69-10 Yellowstone Blvd", "11375", { unit: "5J" }),
    -20,
    -12,
  );
  await at(on(-2));
  await sentServicePlanQuote({
    propertyId: firstClean.propertyId,
    byAccountId: by,
    startsAt: atTime(weekdayFrom(10).date, "13:00").toISOString(),
    recurrence: "fortnightly",
  });

  // ---- on a Service Plan, its next clean Skipped (below) ----
  const nina = contact("nina", "Nina Brooks");
  const ninaHouse = home("71-15 Juno St", "11375", {
    type: "house",
    bedrooms: 3,
  });
  const ninaHome = await firstCleanDone(nina, ninaHouse, -28, -21);
  await at(on(-14));
  const ninaPlan = await startedServicePlan({
    propertyId: ninaHome.propertyId,
    byAccountId: by,
    startsAt: `${weekdayFrom(3).date}T14:00:00Z`,
  });

  // ---- regulars: plans a few weeks old, their Cleaner on every clean, the
  // cleans so far done, so the weeks behind and ahead are full: today's
  // Schedule, a Cleaner's Next up, a Client's history ----
  const regulars: { planId: string; cleanerId: string }[] = [];
  const regular = async (
    who: ReturnType<typeof contact>,
    house: NewHome,
    cleanerId: string,
    {
      startIn,
      time,
      recurrence = "weekly",
    }: {
      startIn: number;
      time: string;
      recurrence?: "weekly" | "fortnightly";
    },
  ) => {
    const { propertyId } = await firstCleanDone(
      who,
      house,
      startIn - 16,
      startIn - 9,
      cleanerId,
    );
    await at(on(startIn - 5));
    const { planId } = await startedServicePlan({
      propertyId,
      byAccountId: by,
      startsAt: atTime(weekdayFrom(startIn).date, time).toISOString(),
      recurrence,
    });
    await workPlan(planId, cleanerId);
    regulars.push({ planId, cleanerId });
  };
  await regular(
    contact("helen", "Helen Kowalski"),
    home("69-50 Exeter St", "11375", { type: "house", bedrooms: 3 }),
    maria!.id,
    { startIn: -28, time: "09:00" },
  );
  await regular(
    contact("thompson", "Marcus Thompson"),
    home("32-11 81st St", "11370", {
      type: "house",
      bedrooms: 4,
      bathrooms: 2,
      pets: true,
    }),
    luz!.id,
    { startIn: -26, time: "13:00", recurrence: "fortnightly" },
  );
  await regular(
    contact("sofia", "Sofia Papadopoulos"),
    home("23-15 31st Rd", "11106", { unit: "2R" }),
    daniela!.id,
    { startIn: -25, time: "10:00" },
  );

  // ---- a business billed weekly: a cleaning every week after hours, its
  // Bills paid by check, and last week's due ----
  await at(on(-30));
  const bellWho = contact("bell", "Rachel Bell");
  const bellAsk = await ask(
    bellWho,
    { new: premises("214-02 41st Ave", "11361") },
    {
      businessName: "Bell Blvd Pediatrics",
      condition: undefined,
      wantsRegularService: true,
      weekdays: [weekdayOf(weekdayFrom(-21).date) as Weekday],
      preferredTime: "18:00",
    },
  );
  const [bellQuote] = await db
    .select({ propertyId: quotes.propertyId })
    .from(quotes)
    .where(eq(quotes.id, bellAsk.id));
  await recordFindingsWithoutVisit(
    bellQuote!.propertyId,
    {
      premisesType: officeType,
      floorArea: 2400,
      condition: "moderate",
      officeNotes:
        "Waiting room, four exam rooms and the front desk. The night guard lets us in.",
    },
    by,
  );
  await at(on(-27));
  const { quote: bellDraft } = await startRevision(
    bellAsk.id,
    "service_plan",
    by,
  );
  await saveDraft(bellAsk.id, {
    addOns: [],
    depositPercent: bellDraft.draft!.depositPercent,
    validityDays: 7,
    plan: {
      serviceKey: SEEDED.commercial,
      recurrence: "weekly",
      discountPercent: bellDraft.draft!.plan!.discountPercent,
      condition: "moderate",
      days: [
        {
          start: { date: weekdayFrom(-21).date, time: "18:00" },
          crewSize: 1,
          override: null,
        },
      ],
    },
  });
  await sendQuote(bellAsk.id);
  const bell = (await findClientByEmail(bellWho.email))!;
  await at(on(-25));
  await saveCard(bell);
  const bellAccepted = await acceptQuote(
    bellAsk.id,
    {},
    { by: "office", accountId: by },
  );
  if (bellAccepted.status !== "accepted") throw new Error("not accepted");
  const [bellPlan] = await db
    .select({ id: servicePlans.id })
    .from(servicePlans)
    .where(eq(servicePlans.quoteId, bellAsk.id));
  await at(new Date(`${mondayOf(addDays(today, -21))}T14:00:00Z`));
  await setBilling(bell.id, {
    weekly: true,
    payment: "on_page",
    termsDays: 14,
    billingEmail: alias("bell-billing"),
  });
  // its cleans so far, done by Luz, each Bill made the Monday after
  await workPlan(bellPlan!.id, luz!.id, true);
  const bellBills = await db
    .select({ id: bills.id })
    .from(bills)
    .where(eq(bills.clientId, bell.id))
    .orderBy(asc(bills.weekStart));
  // all but the latest paid by check, a few days after each
  for (const [i, bill] of bellBills.slice(0, -1).entries()) {
    await at(on(-12 + i * 7));
    await recordOutsidePayment(bill.id, {
      byAccountId: by,
      note: `Check #${1041 + i}`,
    });
  }
  regulars.push({ planId: bellPlan!.id, cleanerId: luz!.id });

  // ---- Jobs in every state the Office's Job page shows ----
  const [firstAddOn, secondAddOn] = list.addOns;

  // booked, nobody Offered yet, and its place not yet open to Cleaners
  await bookedJob(
    contact("olga", "Olga Petrova"),
    home("98-41 64th Rd", "11374", { type: "house", bedrooms: 3 }),
    -3,
    12,
  );

  // a crew of two: one Confirmed, one Released, so a place is open to free
  // Cleaners; the Client asked to move it once, and was turned down
  const pair = await bookedJob(
    contact("pete", "Pete Morales"),
    home("25-11 Crescent St", "11102", { type: "house", bedrooms: 4 }),
    -10,
    7,
    { crewSize: 2 },
  );
  await at(on(-8));
  await confirm(pair.id, luz!.id);
  const danielaPlace = await confirm(pair.id, daniela!.id);
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
  await releaseAssignment(daniela!.id, danielaPlace);

  // the Client has asked to move it, waiting on the Office
  const moving = await bookedJob(
    contact("rosa", "Rosa Diaz"),
    home("61-20 188th St", "11365", { type: "house", bedrooms: 3 }),
    -9,
    5,
  );
  await confirm(moving.id, maria!.id);
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
    contact("grace", "Grace Lee"),
    home("40-22 Little Neck Pkwy", "11363", { type: "house", bedrooms: 3 }),
    -12,
    -4,
    { addOns: [firstAddOn!.key] },
  );
  await confirm(adjusted.id, maria!.id);
  await at(after(adjusted, 4));
  await completeJob(maria!.id, adjusted.id, {
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
    home("88-10 Elmhurst Ave", "11373", { type: "house", bedrooms: 3 }),
    -15,
    -6,
  );
  await confirm(unpaid.id, maria!.id);
  await at(after(unpaid, 4));
  testPayments().failCharges();
  await completeJob(maria!.id, unpaid.id, {
    condition: "moderate",
    reports: [],
  });
  testPayments().failCharges(null);

  // cancelled for the Client the evening before: a Late Cancellation
  const late = await bookedJob(
    contact("uma", "Uma Shah"),
    home("192-04 46th Ave", "11358", { type: "house", bedrooms: 3 }),
    -14,
    -2,
  );
  await confirm(late.id, luz!.id);
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
    home("248-10 Union Tpke", "11426", { type: "house", bedrooms: 3 }),
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
    home("102-17 Queens Blvd", "11375", { unit: "6B" }),
    -9,
    -1,
  );
  await confirm(locked.id, maria!.id);
  await at(after(locked, 1));
  await recordNoAccess(
    maria!.id,
    locked.id,
    "Nobody answered the door, and the phone went to voicemail.",
  );

  // a place Offered, not yet answered
  const offered = await bookedJob(
    contact("erin", "Erin Ford"),
    home("21-40 Steinway St", "11105", { type: "house", bedrooms: 3 }),
    -4,
    14,
  );
  await at(on(-1));
  await offerAssignment(offered.id, maria!.id, by);

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

  regulars.push({ planId: ninaPlan.planId, cleanerId: daniela!.id });

  // the regulars' cleans booked as far ahead as the server books them, each
  // with its Cleaner
  await at(realNow);
  await generateServicePlanJobs();
  for (const { planId, cleanerId } of regulars) {
    for (const job of await planJobs(planId)) {
      if (job.startsAt > realNow && job.status === "booked") {
        await confirm(job.id, cleanerId);
      }
    }
  }

  // the fake gateway's payers and cards would fail against the real Stripe
  // sandbox; Clients enter a test card on their first payment instead
  await db.execute(sql`delete from payment_methods`);
  await db.execute(sql`delete from payers`);

  await stamp();

  async function saveCard(
    client: NonNullable<Awaited<ReturnType<typeof findClientByEmail>>>,
  ) {
    const form = await startCardForm(client);
    await savePaymentMethod(client, form.secret);
  }

  // a plan's cleans so far, Confirmed by the Cleaner two days before and
  // done that day; billed, each week's Bill made the Monday after
  async function workPlan(planId: string, cleanerId: string, billed = false) {
    for (const job of await planJobs(planId)) {
      if (job.startsAt.getTime() > realNow.getTime() - 6 * 3_600_000) break;
      await at(after(job, -48));
      await confirm(job.id, cleanerId);
      await at(after(job, 3));
      await completeJob(cleanerId, job.id, {
        condition: "moderate",
        reports: [],
      });
      const monday = addDays(mondayOf(dayOf(job.startsAt)), 7);
      if (billed && monday <= today) {
        await at(new Date(`${monday}T15:00:00Z`));
        await makeDueBills();
      }
    }
  }

  async function firstCleanDone(
    who: ReturnType<typeof contact>,
    house: NewHome,
    askedIn: number,
    cleanedIn: number,
    cleanerId = maria!.id,
  ) {
    const job = await bookedJob(who, house, askedIn, cleanedIn, {}, true);
    await confirm(job.id, cleanerId);
    await at(after(job, 6));
    await completeJob(cleanerId, job.id, {
      condition: "moderate",
      reports: [],
    });
    return { propertyId: job.propertyId };
  }

  // a home asked about `askedIn` days from today, its Quote accepted by
  // phone for a Deep Clean on the first weekday from `startIn`
  async function bookedJob(
    who: ReturnType<typeof contact>,
    house: NewHome,
    askedIn: number,
    startIn: number,
    terms: { crewSize?: number; addOns?: string[] } = {},
    wantsRegularService = false,
  ) {
    await at(on(askedIn));
    const asked = await ask(who, { new: house }, { wantsRegularService });
    await draftAndSend(asked.id, { sent: on(askedIn), startIn, ...terms });
    await saveCard((await findClientByEmail(who.email))!);
    const accepted = await acceptQuote(
      asked.id,
      { serviceKey: SEEDED.deep },
      { by: "office", accountId: by },
    );
    if (accepted.status !== "accepted") throw new Error("not accepted");
    return accepted.job;
  }

  // Offers a Cleaner a place, which they Confirm: their Assignment's id. A
  // regular's Cleaner is Offered the plan's next cleans already
  async function confirm(jobId: string, staffId: string) {
    const theirs = (job: Awaited<ReturnType<typeof officeJob>>) =>
      job.assignments.find(
        (a) =>
          a.staff.id === staffId &&
          (a.status === "offered" || a.status === "confirmed"),
      );
    const place =
      theirs(await officeJob(jobId)) ??
      theirs(await offerAssignment(jobId, staffId, by))!;
    if (place.status === "offered") await confirmAssignment(staffId, place.id);
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
