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
import { sql } from "drizzle-orm";
import type {
  NewHome,
  NewPremises,
  QuoteAsk,
  SignedInAccount,
} from "@empire-cleaning/models";
import { db } from "#db";
import { confirmAssignment, offerAssignment } from "#features/assignments";
import { findClientByEmail } from "#features/clients";
import { completeJob } from "#features/completion";
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
import { bookSiteVisit } from "#features/site-visits";
import { SEEDED } from "#features/services";
import { createStaff, setUsualWeek } from "#features/staff";
import { addDays, dayOf, weekdayOf } from "#services/clock";
import { installFakes, signIn, testClock } from "./harness.ts";
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
const reset = () =>
  db.transaction(async (tx) => {
    await tx.execute(sql`set local session_replication_role = replica`);
    const { rows: tables } = await tx.execute<{ tablename: string }>(
      sql`select tablename from pg_tables where schemaname = 'public'`,
    );
    for (const { tablename } of tables) {
      if (keep.includes(tablename)) continue;
      await tx.execute(sql`delete from ${sql.identifier(tablename)}`);
    }
  });

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
  const [cleo] = cleaners;

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
    }: { sent: Date; validityDays?: number; startIn: number },
  ) => {
    await at(sent);
    await startRevision(id, "one_off", by);
    await saveDraft(id, {
      addOns: [],
      crewSize: 1,
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
  await startedServicePlan({
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
    await at(on(askedIn));
    const asked = await ask(
      who,
      { new: home(street, { type: "house", bedrooms: 3 }) },
      { wantsRegularService: true },
    );
    await draftAndSend(asked.id, { sent: on(askedIn), startIn: cleanedIn });
    const owner = (await findClientByEmail(who.email))!;
    const form = await startCardForm(owner);
    await savePaymentMethod(owner, form.secret);
    const accepted = await acceptQuote(
      asked.id,
      { serviceKey: SEEDED.deep },
      { by: "office", accountId: by },
    );
    if (accepted.status !== "accepted") throw new Error("not accepted");
    const job = accepted.job;
    const offered = await offerAssignment(job.id, cleo!.id, by);
    await confirmAssignment(cleo!.id, offered.assignments[0]!.id);
    await at(new Date(new Date(job.startsAt).getTime() + 6 * 3_600_000));
    await completeJob(cleo!.id, job.id, { condition: "moderate", reports: [] });
    return { propertyId: job.propertyId };
  }
}

await seed();
console.log(`seeded; sign in as ${OWNER.email} (Office) or any ${alias("…")}`);
process.exit(0);
