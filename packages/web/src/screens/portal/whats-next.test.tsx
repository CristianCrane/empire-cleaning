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
  unpaid: false,
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

const next = (over: Partial<HomeData> = {}) => whatsNext(data(over), NOW);
const shortcutLabels = (over: Partial<HomeData> = {}) =>
  next(over).shortcuts.map((s) => s.label);

describe("Home's hero, with nothing booked", () => {
  test("welcomes a Client who's asked for nothing yet", () => {
    expect(next().hero).toMatchObject({
      label: "Welcome to Empire Cleaning",
      headline: "Let's get you a Quote",
      action: { label: "Request a Quote" },
    });
    expect(shortcutLabels()).toEqual(["Your details", "Call us"]);
  });

  test("says a Quote asked for is being prepared", () => {
    const { hero, shortcuts } = next({ quotes: [quote()] });
    expect(hero).toMatchObject({
      label: "We're preparing your Quote",
      headline: "Usually within a working day",
      lines: [
        "Deep Clean at 12 Elm St, 4B, 11375, asked Sat, Oct 31",
        "We email it to you, and it shows here.",
      ],
      action: { label: "See what you asked for" },
    });
    expect(shortcuts[0]).toMatchObject({
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
    const { hero, notices } = next({ quotes: [sentQuote] });
    expect(hero).toMatchObject({
      label: "Your Quote is ready",
      headline: "Deep Clean $391.04",
      lines: [
        "For Sun, Nov 8, 10:00 AM at 12 Elm St, 4B, 11375",
        "Open until Fri, Nov 13",
      ],
      action: { label: "See your Quote" },
    });
    expect(notices).toEqual([]);
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
      action: { label: "Request a Quote" },
    });
    expect(shortcutLabels({ pastJobs: [pastJob()] })).toEqual([
      "Past cleans",
      "Your details",
      "Call us",
    ]);
  });

  test("says how the last Quote ended: Expired, Declined or Turned Down", () => {
    expect(
      next({ quotes: [{ ...sentQuote, status: "expired" }] }).hero,
    ).toMatchObject({
      label: "Your Quote expired",
      headline: "Deep Clean $391.04",
      lines: [
        "It was open until Fri, Nov 13. Ask again and we'll price it afresh.",
      ],
    });
    expect(
      next({ quotes: [quote({ status: "declined" })] }).hero,
    ).toMatchObject({
      headline: "Changed your mind?",
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

  test("says a Service Plan is paused until it's paid", () => {
    const paused = next({
      plans: [plan({ status: "on_hold", nextStartsAt: null })],
      pastJobs: [pastJob({ unpaid: true })],
    });
    expect(paused.hero).toMatchObject({
      label: "Your Service Plan is paused",
      tone: "warning",
      headline: "Update your card to carry on",
      action: { label: "Update your card" },
    });
    // said once, in the hero
    expect(paused.notices).toEqual([]);
    expect(paused.shortcuts.map((s) => s.label)).toEqual([
      "Update your card",
      "Past cleans",
      "Call us",
    ]);
  });
});

describe("Home's hero, with something booked", () => {
  test("leads with the next clean, its plan, and what comes after", () => {
    const { hero, after, shortcuts } = next({
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
        "Part of your Service Plan, every 2 weeks",
        "2 Cleaners, about 2.5 h on site",
      ],
      action: { label: "See the clean" },
    });
    expect(after).toBe("After that: Standard Clean, Tue, Nov 17, 9:00 AM");
    expect(shortcuts.map((s) => [s.label, s.hint])).toEqual([
      ["Move or skip", "Your Tue, Nov 3 clean"],
      ["How we get in", "Key under the mat"],
      ["Your card", "Visa ending 4242"],
      ["Call us", "(646) 320-9076"],
    ]);
  });

  test("calls a home's first one-off clean its first", () => {
    const { hero, shortcuts } = next({ jobs: [job()] });
    expect(hero.label).toBe("Your first clean");
    expect(shortcuts[0]!.label).toBe("Move or cancel");
  });

  test("leads with a Site Visit when it's sooner", () => {
    expect(next({ jobs: [job()], siteVisits: [visit] }).hero).toMatchObject({
      label: "Your Site Visit",
      headline: "Mon, Nov 2, 2:00 PM",
    });
  });

  test("says a clean is today, without offering to move it", () => {
    const { hero, shortcuts } = next({
      jobs: [job({ startsAt: "2026-11-01T19:00:00.000Z" })],
    });
    expect(hero).toMatchObject({ label: "Today", headline: "2:00 PM" });
    expect(shortcuts.map((s) => s.label)).toEqual([
      "Call us",
      "How we get in",
      "Your card",
    ]);
  });

  test("tells a Client a move they asked for is waiting on us", () => {
    const { news, shortcuts } = next({
      jobs: [job({ movingTo: "2026-11-04T19:00:00.000Z" })],
    });
    expect(news).toEqual([
      "You asked to move your Tue, Nov 3 clean to Wed, Nov 4, 2:00 PM. We'll confirm, usually within a working day.",
    ]);
    expect(shortcuts[0]).toMatchObject({
      label: "Your move request",
      hint: "To Wed, Nov 4, 2:00 PM",
    });
  });
});

describe("Home's Notices: what's waiting on the Client", () => {
  test("a Quote ready while something's booked", () => {
    expect(next({ jobs: [job()], quotes: [sentQuote] }).notices).toEqual([
      expect.objectContaining({
        text: "Your Quote is ready: Deep Clean $391.04.",
        action: "See your Quote",
      }),
    ]);
  });

  test("an extra to agree to", () => {
    expect(
      next({ jobs: [job()], pastJobs: [pastJob({ awaitingAnswer: 1 })] })
        .notices,
    ).toEqual([
      expect.objectContaining({
        text: "Your Tue, Oct 20 clean needs your OK on an extra.",
        action: "Review it",
      }),
    ]);
  });

  test("an Unpaid clean pausing a plan is one Notice", () => {
    const { notices, hero, shortcuts } = next({
      plans: [plan({ status: "on_hold" })],
      jobs: [job({ servicePlanId: "plan" })],
      pastJobs: [pastJob({ unpaid: true })],
    });
    expect(notices).toEqual([
      expect.objectContaining({
        text: "We couldn't charge for your Tue, Oct 20 clean. Your Service Plan books no new cleans until it's paid.",
        action: "Update your card",
      }),
    ]);
    expect(hero.label).toBe("Your next clean");
    expect(shortcuts[2]).toMatchObject({ label: "Update your card" });
  });

  test("a Bill due on its page, or Unpaid", () => {
    expect(next({ jobs: [job()], bills: [bill()] }).notices).toEqual([
      expect.objectContaining({
        text: "Bill EC-000041, $214.50, is due by Sat, Nov 14.",
        action: "Pay the Bill",
      }),
    ]);
    expect(
      next({ bills: [bill({ unpaid: { since: "", reason: "" } })] }).notices[0],
    ).toMatchObject({ action: "See the Bill" });
    // charged automatically: nothing to do
    expect(next({ bills: [bill({ payment: "automatic" })] }).notices).toEqual(
      [],
    );
  });
});
