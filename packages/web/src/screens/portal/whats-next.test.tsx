import { describe, expect, test } from "vitest";
import type {
  BillSummary,
  ClientPastJob,
  ClientSiteVisit,
  ClientUpcomingJob,
  ClientView,
  PropertyView,
  QuoteSummary,
  ServicePlanSummary,
} from "@empire-cleaning/models";
import { whatsNext, type HomeData } from "./whats-next.ts";

// Sunday 1 November 2026, 10am in New York
const NOW = new Date("2026-11-01T15:00:00Z");
// Tuesday 3 November, 9am; and the Tuesday after next
const TUESDAY = "2026-11-03T14:00:00.000Z";
const LATER = "2026-11-17T14:00:00.000Z";

const home = {
  id: "home",
  street: "12 Elm St",
  unit: "4B",
  postcode: "11375",
  accessInstructions: "Key under the mat",
} as PropertyView;
const at = {
  id: home.id,
  street: home.street,
  unit: home.unit,
  postcode: home.postcode,
};

const job = (over: Partial<ClientUpcomingJob> = {}): ClientUpcomingJob => ({
  id: "job",
  startsAt: TUESDAY,
  serviceName: "Standard Clean",
  crewSize: 2,
  hoursOnSite: 2.5,
  property: at,
  servicePlanId: null,
  movingTo: null,
  ...over,
});
const pastJob = (over: Partial<ClientPastJob> = {}): ClientPastJob => ({
  ...job({ id: "past", startsAt: "2026-10-20T13:00:00.000Z" }),
  status: "completed",
  skipped: false,
  completedAt: "2026-10-20T16:00:00.000Z",
  totalCents: 18450,
  feeCents: 0,
  unpaid: null,
  owedCents: 0,
  awaitingAnswer: 0,
  ...over,
});
const plan = (over: Partial<ServicePlanSummary> = {}): ServicePlanSummary => ({
  id: "plan",
  status: "active",
  recurrence: "fortnightly",
  days: [{ startsAt: TUESDAY, serviceName: "Standard Clean" }],
  property: at,
  nextStartsAt: TUESDAY,
  ...over,
});
const quote = (over: Partial<QuoteSummary> = {}): QuoteSummary =>
  ({
    id: "quote",
    kind: "one_off",
    status: "requested",
    service: { key: "deep", name: "Deep Clean" },
    property: home,
    headlineTotalCents: null,
    headlineServiceName: null,
    plan: null,
    proposedStartsAt: null,
    sentAt: null,
    expiresAt: null,
    siteVisit: null,
    turnDownReason: null,
    createdAt: "2026-10-31T13:00:00.000Z",
    ...over,
  }) as QuoteSummary;
const sentQuote = quote({
  status: "sent",
  headlineTotalCents: 39104,
  headlineServiceName: "Deep Clean",
  proposedStartsAt: "2026-11-08T15:00:00.000Z",
  sentAt: "2026-10-31T19:00:00.000Z",
  expiresAt: "2026-11-14T04:59:00.000Z",
});
const visit: ClientSiteVisit = {
  id: "visit",
  startsAt: "2026-11-02T19:00:00.000Z",
  minutes: 30,
  property: at,
  visitorName: "Cris Crane",
};
const bill = (over: Partial<BillSummary> = {}): BillSummary =>
  ({
    id: "bill",
    number: "EC-000041",
    payment: "on_page",
    dueOn: "2026-11-14",
    status: "due",
    totalCents: 21450,
    unpaid: null,
    ...over,
  }) as BillSummary;

const data = (over: Partial<HomeData> = {}): HomeData => ({
  client: { properties: [home] } as unknown as ClientView,
  plans: [],
  quotes: [],
  jobs: [],
  pastJobs: [],
  siteVisits: [],
  bills: [],
  paymentMethod: { label: "Visa ending 4242", savedAt: "", consentedAt: "" },
  ...over,
});

const next = (over: Partial<HomeData> = {}) => whatsNext(data(over), "en", NOW);
const tileLabels = (over: Partial<HomeData> = {}) =>
  next(over).tiles.map((s) => s.label);

describe("Home's hero, with nothing booked", () => {
  test("welcomes a Client who's asked for nothing yet", () => {
    expect(next().hero).toMatchObject({
      label: "Welcome to Empire Cleaning",
      headline: "Let's get you a quote",
      action: { label: "Request a quote" },
    });
    expect(tileLabels()).toEqual(["Your details", "Call us"]);
  });

  test("says a Quote asked for is being prepared", () => {
    const { hero, tiles } = next({ quotes: [quote()] });
    expect(hero).toMatchObject({
      label: "Your quote",
      headline: "We're working on it",
      lines: [
        "Deep Clean at 12 Elm St, 4B, 11375, asked Sat, Oct 31",
        "We'll email it to you, usually within a working day, and it shows here.",
      ],
      action: { label: "See what you asked for" },
    });
    expect(tiles[0]).toMatchObject({
      label: "How we get in",
      hint: "Key under the mat",
    });
  });

  test("says a Site Visit comes first, for premises that need one", () => {
    expect(
      next({ quotes: [quote({ siteVisit: "needed" })] }).hero,
    ).toMatchObject({
      label: "Before we quote",
      headline: "We'll call to arrange a visit",
    });
  });

  test("leads with a Quote that's ready", () => {
    const { hero, tiles } = next({ quotes: [sentQuote] });
    expect(hero).toMatchObject({
      label: "Your quote is ready",
      headline: "Deep Clean $391.04",
      lines: [
        "For Sun, Nov 8, 10:00 AM at 12 Elm St, 4B, 11375",
        "Open until Fri, Nov 13",
      ],
      action: { label: "See your quote" },
    });
    // the hero's, so not a tile too
    expect(tiles.map((s) => s.label)).toEqual([
      "How we get in",
      "Your details",
      "Call us",
    ]);
  });

  test("names the Service a one-off Quote leads with", () => {
    const standard = {
      ...sentQuote,
      headlineTotalCents: 20185,
      headlineServiceName: "Standard Clean",
    };
    expect(next({ quotes: [standard] }).hero.headline).toBe(
      "Standard Clean $201.85",
    );
  });

  test("names the last clean done, not one Skipped since", () => {
    const { hero } = next({
      pastJobs: [
        pastJob({
          id: "skipped",
          startsAt: "2026-10-27T13:00:00.000Z",
          status: "cancelled",
          skipped: true,
          completedAt: null,
          totalCents: 0,
        }),
        pastJob(),
      ],
    });
    expect(hero.lines).toEqual(["Your last clean was Tue, Oct 20."]);
  });

  test("offers a past Client a new Quote", () => {
    const { hero } = next({
      quotes: [quote({ status: "accepted" })],
      pastJobs: [pastJob()],
    });
    expect(hero).toMatchObject({
      headline: "Want us back?",
      lines: ["Your last clean was Tue, Oct 20."],
      action: { label: "Request a quote" },
    });
    expect(tileLabels({ pastJobs: [pastJob()] })).toEqual([
      "Past cleans",
      "Your details",
      "Call us",
    ]);
  });

  test("says how the last Quote ended: Expired, Declined or Turned Down", () => {
    expect(
      next({ quotes: [{ ...sentQuote, status: "expired" }] }).hero,
    ).toMatchObject({
      label: "Your quote expired",
      headline: "Deep Clean $391.04",
      lines: [
        "It was open until Fri, Nov 13. Ask again and we'll price it afresh.",
      ],
    });
    expect(
      next({ quotes: [quote({ status: "declined" })] }).hero,
    ).toMatchObject({
      headline: "Changed your mind?",
      lines: [
        "You declined our quote for Deep Clean. Ask for a new one any time.",
      ],
    });
    expect(
      next({
        quotes: [
          quote({ status: "turned_down", turnDownReason: "out_of_area" }),
        ],
      }).hero,
    ).toMatchObject({
      label: "We couldn't take this one on",
      headline: "It's outside the area we clean",
    });
  });

  test("leads with what's owed when a Service Plan is paused for it", () => {
    const paused = next({
      plans: [plan({ status: "on_hold", nextStartsAt: null })],
      pastJobs: [pastJob({ unpaid: "declined", owedCents: 18450 })],
    });
    expect(paused.hero).toMatchObject({
      label: "To pay",
      tone: "danger",
      headline: "$184.50",
      lines: [
        expect.stringContaining("Oct 20"),
        "Once it's paid, your plan carries on from its next date.",
      ],
      action: { label: "Update your card" },
    });
    // the card's Button, so not a tile too
    expect(paused.tiles.map((s) => s.label)).toEqual([
      "Past cleans",
      "Call us",
    ]);
  });

  test("says a Service Plan is paused on a payment the service is trying again", () => {
    expect(
      next({
        plans: [plan({ status: "on_hold", nextStartsAt: null })],
        pastJobs: [pastJob({ unpaid: "waiting", owedCents: 18450 })],
      }).hero,
    ).toMatchObject({
      label: "Your cleaning plan is paused",
      headline: "A payment is due",
      action: { label: "See your plan" },
    });
  });
});

describe("Home's hero, with something booked", () => {
  test("leads with the next clean and its plan", () => {
    const { hero, tiles } = next({
      plans: [plan()],
      jobs: [
        job({ servicePlanId: "plan" }),
        job({ id: "later", startsAt: LATER, servicePlanId: "plan" }),
      ],
      pastJobs: [pastJob()],
    });
    expect(hero).toMatchObject({
      label: "Your next clean",
      startsAt: TUESDAY,
      headline: "Tue, Nov 3, 9:00 AM",
      lines: [
        "Standard Clean at 12 Elm St, 4B, 11375",
        "Part of your cleaning plan, every 2 weeks",
        "2 cleaners, about 2.5 h on site",
      ],
      action: { label: "See the clean" },
    });
    expect(tiles.map((s) => [s.label, s.hint])).toEqual([
      ["Move or skip", "Your Tue, Nov 3 clean"],
      ["How we get in", "Key under the mat"],
      ["Your card", "Visa ending 4242"],
      ["Call us", "(646) 320-9076"],
    ]);
  });

  test("calls a home's first one-off clean its first", () => {
    const { hero, tiles } = next({ jobs: [job()] });
    expect(hero.label).toBe("Your first clean");
    expect(tiles[0]!.label).toBe("Move or cancel");
  });

  test("leads with a Site Visit when it's sooner", () => {
    expect(next({ jobs: [job()], siteVisits: [visit] }).hero).toMatchObject({
      label: "Your site visit",
      headline: "Mon, Nov 2, 2:00 PM",
    });
  });

  test("says a clean is today, without offering to move it", () => {
    const { hero, tiles } = next({
      jobs: [job({ startsAt: "2026-11-01T19:00:00.000Z" })],
    });
    expect(hero).toMatchObject({ label: "Today", headline: "2:00 PM" });
    expect(tiles.map((s) => s.label)).toEqual([
      "Call us",
      "How we get in",
      "Your card",
    ]);
  });

  test("tells a Client a move they asked for is waiting on us", () => {
    const { news, tiles } = next({
      jobs: [job({ movingTo: "2026-11-04T19:00:00.000Z" })],
    });
    expect(news).toEqual([
      "You asked to move your Tue, Nov 3 clean to Wed, Nov 4, 2:00 PM. We'll confirm, usually within a working day.",
    ]);
    expect(tiles[0]).toMatchObject({
      label: "Your move request",
      hint: "To Wed, Nov 4, 2:00 PM",
    });
  });
});

describe("Home's tiles: what's waiting on the Client comes first", () => {
  test("a Quote ready while something's booked", () => {
    const { tiles } = next({ jobs: [job()], quotes: [sentQuote] });
    expect(tiles[0]).toMatchObject({
      label: "See your quote",
      hint: "Deep Clean $391.04",
    });
    // never cut: a shortcut gives way, four in all
    expect(tiles.map((s) => s.label)).toEqual([
      "See your quote",
      "Move or cancel",
      "How we get in",
      "Your card",
    ]);
  });

  test("a price change to agree to", () => {
    expect(
      next({ jobs: [job()], pastJobs: [pastJob({ awaitingAnswer: 1 })] })
        .tiles[0],
    ).toMatchObject({
      label: "Review a price change",
      hint: "Your Tue, Oct 20 clean",
    });
  });

  test("a tile a kind, however many wait: the booked shortcuts keep their places", () => {
    const { tiles } = next({
      jobs: [job()],
      quotes: [
        sentQuote,
        { ...sentQuote, id: "quote-2" },
        { ...sentQuote, id: "quote-3" },
      ],
      pastJobs: [
        pastJob({ awaitingAnswer: 2 }),
        pastJob({ id: "past-2", awaitingAnswer: 1 }),
      ],
    });
    expect(tiles.map((s) => [s.label, s.hint])).toEqual([
      ["See your 3 quotes", "Deep Clean $391.04 · 2 more"],
      ["Review 3 price changes", "Your Tue, Oct 20 clean · 1 more"],
      ["Move or cancel", expect.any(String)],
      ["How we get in", "Key under the mat"],
    ]);
  });

  test("several of a kind lead to where they all are", () => {
    const { tiles } = next({
      jobs: [job()],
      quotes: [sentQuote, { ...sentQuote, id: "quote-2" }],
      pastJobs: [
        pastJob({ awaitingAnswer: 1 }),
        pastJob({ id: "past-2", awaitingAnswer: 1 }),
      ],
    });
    // both Quotes for one home: its page lists them
    expect(tiles[0]).toMatchObject({
      href: {
        to: "/portal/properties/$propertyId",
        params: { propertyId: sentQuote.property.id },
      },
    });
    // the cleans with prices to review: Cleans' Past tab
    expect(tiles[1]).toMatchObject({
      href: { to: "/portal/cleans", search: { tab: "past" } },
    });
    // Quotes for two homes: Your details lists both
    expect(
      next({
        jobs: [job()],
        quotes: [
          sentQuote,
          {
            ...sentQuote,
            id: "quote-2",
            property: { ...sentQuote.property, id: "other-home" },
          },
        ],
      }).tiles[0],
    ).toMatchObject({ href: { to: "/portal/details" } });
  });
});

describe("Home's card: what's owed first, when it asks anything of them", () => {
  test("an Unpaid clean pausing a plan, while a clean is booked", () => {
    const { hero, tiles } = next({
      plans: [plan({ status: "on_hold" })],
      jobs: [job({ servicePlanId: "plan" })],
      pastJobs: [pastJob({ unpaid: "declined", owedCents: 18450 })],
    });
    expect(hero).toMatchObject({
      label: "To pay",
      lines: [
        expect.stringContaining("Oct 20"),
        "Cleans already booked still go ahead, but we won't book any more.",
      ],
      action: { label: "Update your card" },
    });
    expect(tiles.map((s) => s.label)).not.toContain("Your card");
  });

  test("a clean waiting on the payment service asks nothing of them", () => {
    const { hero, tiles } = next({
      jobs: [job()],
      pastJobs: [pastJob({ unpaid: "waiting", owedCents: 18450 })],
    });
    expect(hero.label).toBe("Your next clean");
    expect(tiles.find((s) => s.label === "Your card")).toMatchObject({
      hint: "Visa ending 4242",
    });
  });

  test("a Bill due on its page, or Unpaid", () => {
    expect(next({ jobs: [job()], bills: [bill()] }).hero).toMatchObject({
      label: "To pay",
      headline: "$214.50",
      lines: ["Bill EC-000041 is due by Nov 14"],
      action: { label: "Pay bill EC-000041" },
    });
    expect(
      next({
        bills: [bill({ unpaid: { since: "", kind: "declined", why: null } })],
      }).hero,
    ).toMatchObject({
      tone: "danger",
      action: { label: "Pay bill EC-000041" },
    });
    // charged automatically: nothing to do
    expect(
      next({ jobs: [job()], bills: [bill({ payment: "automatic" })] }).hero
        .label,
    ).toBe("Your first clean");
  });
});
