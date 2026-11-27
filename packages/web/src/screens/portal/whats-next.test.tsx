import { describe, expect, test } from "vitest";
import type {
  BillSummary,
  ClientPastJob,
  ClientSiteVisit,
  ClientUpcomingJob,
  ClientView,
  OfferedQuoteSummary,
  PropertyView,
  QuoteSummary,
  ServicePlanSummary,
  Unpaid,
  UnpaidKind,
  UnsentQuoteSummary,
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
  city: "Forest Hills",
  postcode: "11375",
  accessInstructions: "Key under the mat",
} as PropertyView;
const at = {
  id: home.id,
  street: home.street,
  unit: home.unit,
  city: home.city,
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
// a past clean's payment that didn't go through, of a kind
const unpaid = (kind: UnpaidKind): Unpaid => ({
  since: "2026-10-20T16:00:00.000Z",
  kind,
  why: null,
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
  waiting: [],
  noAccess: null,
  ...over,
});
// a price change proposed to them: 1 more hour, answered by Wednesday the
// 4th, 10am
type Change = ClientPastJob["waiting"][number];
const change = (over: Partial<Change> = {}): Change => ({
  id: "change",
  kind: "extra_time",
  addOnName: null,
  hours: 1,
  totalCents: 5988,
  lapsesAt: "2026-11-04T15:00:00.000Z",
  ...over,
});
const changes = (n: number) =>
  Array.from({ length: n }, (_, i) => change({ id: `change-${i}` }));
const plan = (over: Partial<ServicePlanSummary> = {}): ServicePlanSummary => ({
  id: "plan",
  status: "active",
  recurrence: "fortnightly",
  days: [{ startsAt: TUESDAY, serviceName: "Standard Clean" }],
  property: at,
  nextStartsAt: TUESDAY,
  ...over,
});
// a Quote they asked for, with nothing Sent yet
const quote = (over: Partial<UnsentQuoteSummary> = {}): QuoteSummary => ({
  id: "quote",
  kind: "one_off",
  status: "requested",
  origin: "client",
  asked: null,
  service: { key: "deep", name: "Deep Clean", method: "rooms" },
  client: { id: "client", name: "Dana Reyes", businessName: null },
  property: home,
  homePlanId: null,
  headlineTotalCents: null,
  headlineServiceName: null,
  plan: null,
  proposedStartsAt: null,
  sentAt: null,
  expiresAt: null,
  drafting: false,
  siteVisit: null,
  turnDownReason: null,
  createdAt: "2026-10-31T13:00:00.000Z",
  paying: null,
  payingServiceName: null,
  bookable: null,
  ...over,
});
// one with an offer: Sent, or Accepted, Declined or Expired since
const offered = (
  over: Partial<OfferedQuoteSummary> = {},
): OfferedQuoteSummary => ({
  ...quote(),
  status: "sent",
  headlineTotalCents: 39104,
  headlineServiceName: "Deep Clean",
  proposedStartsAt: "2026-11-08T15:00:00.000Z",
  sentAt: "2026-10-31T19:00:00.000Z",
  expiresAt: "2026-11-14T04:59:00.000Z",
  plan: null,
  ...over,
});
const sentQuote = offered();
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
        "For Sun, Nov 8, 10:00\u00a0AM",
        "At 12 Elm St, 4B, 11375",
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
    const standard = offered({
      headlineTotalCents: 20185,
      headlineServiceName: "Standard Clean",
    });
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
      quotes: [offered({ status: "accepted" })],
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
      next({ quotes: [offered({ status: "expired" })] }).hero,
    ).toMatchObject({
      label: "Your quote expired",
      headline: "Deep Clean $391.04",
      lines: [
        "It was open until Fri, Nov 13. Ask again and we'll price it afresh.",
      ],
    });
    expect(
      next({ quotes: [offered({ status: "declined" })] }).hero,
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
      pastJobs: [pastJob({ unpaid: unpaid("declined"), owedCents: 18450 })],
    });
    expect(paused.hero).toMatchObject({
      label: "To pay",
      tone: "danger",
      headline: "$184.50",
      lines: ["Until it's paid, we won't book more cleans on your plan."],
      action: { label: "Update your card" },
    });
    // why, above it, once
    expect(paused.why).toEqual({
      tone: "danger",
      lead: "We couldn't take payment for your Oct 20 clean.",
    });
    expect(paused.asks).toBe(true);
    // the card's Button, so not a tile too
    expect(paused.tiles.map((s) => s.label)).toEqual([
      "Past cleans",
      "Call us",
    ]);
  });

  test("says a Service Plan is paused on a payment the service is trying again, calmly, as there's nothing to do", () => {
    const { hero, why, asks } = next({
      plans: [plan({ status: "on_hold", nextStartsAt: null })],
      pastJobs: [pastJob({ unpaid: unpaid("waiting"), owedCents: 18450 })],
    });
    expect(hero).toMatchObject({
      label: "Your cleaning plan",
      tone: "info",
      headline: "Standard Clean, every 2 weeks",
      lines: [
        "Nothing's booked until it goes through. Then your plan carries on from its next date.",
      ],
      action: { label: "See your plan" },
    });
    expect(why).toEqual({
      tone: "info",
      lead: "Your cleaning plan is paused.",
      more: "A payment on it is pending. Nothing you need to do.",
    });
    // nothing asked of them: Request a quote stays
    expect(asks).toBe(false);
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
      headline: "Tue, Nov 3, 9:00\u00a0AM",
      lines: [
        "Standard Clean at 12 Elm St, 4B, 11375",
        "Part of your cleaning plan, every 2 weeks",
        "2½ h",
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
      headline: "Mon, Nov 2, 2:00\u00a0PM",
    });
  });

  test("says a clean is today, without offering to move it", () => {
    const { hero, tiles } = next({
      jobs: [job({ startsAt: "2026-11-01T19:00:00.000Z" })],
    });
    expect(hero).toMatchObject({ label: "Today", headline: "2:00\u00a0PM" });
    expect(tiles.map((s) => s.label)).toEqual([
      "Call us",
      "How we get in",
      "Your card",
    ]);
  });

  test("tells a Client a move they asked for is waiting on us, once", () => {
    const { news, tiles } = next({
      jobs: [job({ movingTo: "2026-11-04T19:00:00.000Z" })],
    });
    expect(news).toEqual([
      "You asked to move your Tue, Nov 3 clean to Wed, Nov 4, 2:00\u00a0PM. We'll confirm, usually within a working day.",
    ]);
    // the news says it: no tile says it again, nor offers another move
    expect(tiles.map((t) => t.label)).toEqual([
      "How we get in",
      "Your card",
      "Call us",
    ]);
  });
});

describe("Home's card: what waits on the Client leads (#493)", () => {
  test("a price change to answer, nothing booked or a clean booked: the card does it, an alert says why", () => {
    for (const jobs of [[], [job()]]) {
      const { hero, why, asks, tiles } = next({
        jobs,
        pastJobs: [pastJob({ waiting: changes(1) })],
      });
      expect(hero).toMatchObject({
        label: "A price change to answer",
        tone: "warning",
        headline: "$59.88 more",
        lines: [],
        action: {
          label: "Review the price change",
          href: { to: "/portal/jobs/$jobId", params: { jobId: "past" } },
        },
      });
      expect(why).toEqual({
        tone: "warning",
        lead: "The crew needed 1 more hour on your Tue, Oct 20 clean.",
        more: "Please answer by Wed, Nov 4.",
      });
      // Request a quote stands aside, and no tile says it again
      expect(asks).toBe(true);
      expect(tiles.map((s) => s.id)).not.toContain("review");
    }
  });

  test("an Add-on done on the day, and several price changes at once", () => {
    expect(
      next({
        pastJobs: [
          pastJob({
            waiting: [
              change({
                kind: "add_on_done",
                addOnName: "Inside the oven",
                hours: null,
                totalCents: 2178,
              }),
            ],
          }),
        ],
      }).why?.lead,
    ).toBe("The crew also did Inside the oven on your Tue, Oct 20 clean.");
    const several = next({
      pastJobs: [
        pastJob({ waiting: changes(1) }),
        pastJob({
          id: "past-2",
          waiting: [change({ lapsesAt: "2026-11-03T15:00:00.000Z" })],
        }),
      ],
    });
    expect(several.hero).toMatchObject({
      label: "2 price changes to answer",
      headline: "$119.76 more",
      action: {
        label: "Review the price changes",
        href: { to: "/portal/cleans", search: { tab: "past" } },
      },
    });
    // the earliest answer wanted
    expect(several.why).toEqual({
      tone: "warning",
      lead: "2 price changes on your cleans need your answer.",
      more: "Please answer the first by Tue, Nov 3.",
    });
  });

  test("what's owed comes first, the price change a tile with what it adds and by when", () => {
    const { hero, tiles } = next({
      jobs: [job()],
      pastJobs: [
        pastJob({
          unpaid: unpaid("declined"),
          owedCents: 18450,
          waiting: changes(1),
        }),
      ],
    });
    expect(hero).toMatchObject({ label: "To pay", headline: "$184.50" });
    expect(tiles[0]).toMatchObject({
      label: "Review a price change",
      hint: "$59.88 more, answer by Wed, Nov 4",
    });
  });

  test("the morning a crew couldn't get in: how we get in, with what happened above it", () => {
    const lockedOut = (recordedAt: string) =>
      pastJob({
        status: "no_access",
        startsAt: "2026-11-01T14:00:00.000Z",
        completedAt: null,
        totalCents: 0,
        feeCents: 6806,
        noAccess: {
          recordedAt,
          reason: "The code didn't open the door",
          feeCents: 6806,
        },
      });
    const { hero, why, asks, tiles } = next({
      plans: [plan()],
      pastJobs: [lockedOut("2026-11-01T14:20:00.000Z")],
    });
    expect(hero).toMatchObject({
      label: "How we get in",
      tone: "warning",
      headline: "Key under the mat",
      action: {
        label: "Check how we get in",
        href: {
          to: "/portal/properties/$propertyId",
          params: { propertyId: "home" },
        },
      },
    });
    expect(why).toEqual({
      tone: "warning",
      lead: "The crew came at 9:20\u00a0AM today, but couldn't get in: \"The code didn't open the door\".",
      more: "As with a late cancellation, your $68.06 deposit is kept as the fee.",
    });
    expect(asks).toBe(true);
    expect(tiles.map((s) => s.id)).not.toContain("getIn");
    // with a clean booked there, the card says how we get in: no tile
    // says it again; with the next clean at another home, its tile stays
    const other = {
      ...home,
      id: "other",
      street: "3 Oak Ave",
      accessInstructions: "Ring 2",
    };
    const twoHomes = (property: typeof at) =>
      next({
        client: { properties: [home, other] } as unknown as ClientView,
        jobs: [job({ property })],
        pastJobs: [lockedOut("2026-11-01T14:20:00.000Z")],
      }).tiles.find((s) => s.id === "getIn");
    expect(twoHomes(at)).toBeUndefined();
    expect(twoHomes({ ...at, id: "other", street: "3 Oak Ave" })).toMatchObject(
      { label: "How we get in", hint: "Ring 2" },
    );
    expect(
      whatsNext(
        data({
          plans: [plan()],
          pastJobs: [lockedOut("2026-11-01T18:20:00.000Z")],
        }),
        "es",
        // at 1 o'clock, so "a la"; now after it, as the server stamps it
        new Date("2026-11-01T19:00:00Z"),
      ).why?.lead,
    ).toBe(
      'El equipo llegó hoy a la 1:20\u00a0p.m., pero no pudo entrar: "The code didn\'t open the door".',
    );
    // the day after, the clean's page says it
    expect(
      next({
        plans: [plan()],
        pastJobs: [lockedOut("2026-10-31T14:20:00.000Z")],
      }).hero.label,
    ).toBe("Your cleaning plan");
  });

  test("a Quote ready leads, even with a clean booked", () => {
    const { hero, asks, tiles } = next({
      jobs: [job()],
      quotes: [sentQuote],
    });
    expect(hero).toMatchObject({
      label: "Your quote is ready",
      action: { label: "See your quote" },
    });
    // a usual step: Request a quote stays
    expect(asks).toBe(false);
    expect(tiles.map((s) => s.label)).toEqual([
      "Move or cancel",
      "How we get in",
      "Your card",
      "Call us",
    ]);
  });
});

describe("Home's tiles: what else waits on the Client comes first", () => {
  test("a tile a kind, however many wait: the booked shortcuts keep their places", () => {
    const { tiles } = next({
      jobs: [job()],
      bills: [bill()],
      quotes: [
        sentQuote,
        { ...sentQuote, id: "quote-2" },
        { ...sentQuote, id: "quote-3" },
      ],
      pastJobs: [
        pastJob({ waiting: changes(2) }),
        pastJob({ id: "past-2", waiting: changes(1) }),
      ],
    });
    expect(tiles.map((s) => [s.label, s.hint])).toEqual([
      ["See your 3 quotes", "Deep Clean $391.04\u00a0·\u00a02 more"],
      ["Review 3 price changes", "$179.64 more, answer by Wed, Nov 4"],
      ["Move or cancel", expect.any(String)],
      ["How we get in", "Key under the mat"],
    ]);
  });

  test("several of a kind lead to where they all are", () => {
    const { tiles } = next({
      jobs: [job()],
      bills: [bill()],
      quotes: [sentQuote, { ...sentQuote, id: "quote-2" }],
      pastJobs: [
        pastJob({ waiting: changes(1) }),
        pastJob({ id: "past-2", waiting: changes(1) }),
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
        bills: [bill()],
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

// #534's UX design, Screen 2: a quote's Deposit payment, and a quote whose
// time filled. The Standard Clean, $194.89, its deposit $48.72, on a quote
// that also offers the Deep Clean
type Paying = NonNullable<QuoteSummary["paying"]>;
const standard = offered({
  headlineTotalCents: 19489,
  headlineServiceName: "Standard Clean",
  bookable: ["standard", "deep"],
});
const paid = (
  paying: Partial<Paying> & Pick<Paying, "status">,
  over: Partial<OfferedQuoteSummary> = {},
): OfferedQuoteSummary =>
  offered({
    ...standard,
    paying: { serviceKey: "standard", depositCents: 4872, ...paying } as Paying,
    payingServiceName: "Standard Clean",
    ...over,
  });
const going = paid({ status: "goingThrough" });
const FOR = ["For Sun, Nov 8, 10:00 AM", "At 12 Elm St, 4B, 11375"];
const ON = "on Sun, Nov 8, 10:00 AM at 12 Elm St, 4B, 11375";
const NEW_QUOTE = "We'll send you a new quote for another time.";
const planQuote = (
  over: Partial<OfferedQuoteSummary> = {},
): OfferedQuoteSummary =>
  offered({
    ...standard,
    kind: "service_plan",
    plan: {
      recurrence: "weekly",
      days: [
        { startsAt: standard.proposedStartsAt, serviceName: "Standard Clean" },
        { startsAt: "2026-11-10T15:00:00.000Z", serviceName: "Standard Clean" },
      ],
    },
    bookable: ["sunday", "tuesday"],
    ...over,
  });
const fullyBooked = offered({ ...standard, bookable: [] });
const refunded = (
  why: "no_room" | "revised" | "closed",
  over: Partial<OfferedQuoteSummary> = {},
) => paid({ status: "refunded", at: "", why } as Paying, over);

describe("Home, while a quote's deposit is going through (#534)", () => {
  test("a state card that asks nothing: what's paid, for which clean, and when", () => {
    const { hero, why, asks, news, tiles } = next({ quotes: [going] });
    expect(hero).toMatchObject({
      label: "Payment pending",
      tone: "info",
      headline: "$48.72",
      lines: ["Deposit for Standard Clean · Nothing you need to do.", ...FOR],
      action: { label: "See your quote", secondary: true },
    });
    expect(why).toBeUndefined();
    expect(asks).toBe(false);
    expect(news).toEqual([]);
    // it waits on nothing of theirs, so it's no quote to answer
    expect(tiles.map((s) => s.label)).not.toContain("See your quote");
  });

  test("a plan's names the plan, and its first clean", () => {
    expect(
      next({ quotes: [{ ...planQuote(), paying: going.paying }] }).hero.lines,
    ).toEqual([
      "Deposit for your cleaning plan · Nothing you need to do.",
      ...FOR,
    ]);
  });

  test("a card their bank is approving, with nothing charged (0%): Booking pending", () => {
    const card = paid({ status: "goingThrough", depositCents: 0 });
    expect(next({ quotes: [card] }).hero).toMatchObject({
      label: "Booking pending",
      headline: "Standard Clean $194.89",
      lines: [...FOR, "We'll email you as soon as your clean is booked."],
    });
    expect(next({ jobs: [job()], quotes: [card] }).news).toEqual([
      `Your bank is finishing approving your card for the Standard Clean ${ON}. We'll email you as soon as it's booked, usually within half an hour.`,
    ]);
  });

  test("under something booked or ready, it's News naming the quote", () => {
    const pending = `Your deposit for the Standard Clean ${ON} is pending. We'll email you as soon as it's booked, usually within half an hour.`;
    const booked = next({ jobs: [job()], quotes: [going] });
    expect(booked.hero.label).toBe("Your first clean");
    expect(booked.news).toEqual([pending]);
    // another quote ready is the card, and no tile counts this one
    const ready = next({ quotes: [going, { ...sentQuote, id: "quote-2" }] });
    expect(ready.hero).toMatchObject({
      label: "Your quote is ready",
      headline: "Deep Clean $391.04",
    });
    expect(ready.news).toEqual([pending]);
    expect(ready.tiles.map((s) => s.label)).not.toContain("See your quote");
    // a plan's names its home
    expect(
      next({
        jobs: [job()],
        quotes: [{ ...planQuote(), paying: going.paying }],
      }).news,
    ).toEqual([
      "Your deposit for your cleaning plan at 12 Elm St, 4B, 11375 is pending. We'll email you as soon as it's booked, usually within half an hour.",
    ]);
  });

  test("in Spanish", () => {
    const { hero } = whatsNext(data({ quotes: [going] }), "es", NOW);
    expect(hero).toMatchObject({
      label: "Pago pendiente",
      lines: [
        "Depósito de Standard Clean · No tiene que hacer nada.",
        expect.any(String),
        "En 12 Elm St, 4B, 11375",
      ],
      action: { label: "Ver su cotización" },
    });
    expect(
      whatsNext(data({ jobs: [job()], quotes: [going] }), "es", NOW).news,
    ).toEqual([
      "Su depósito de la Standard Clean del dom, 8 de nov, 10:00 a.m. en 12 Elm St, 4B, 11375 está pendiente. Le enviaremos un correo en cuanto quede reservada, normalmente en menos de media hora.",
    ]);
  });
});

describe("Home, as a quote's deposit waits on their bank or ends unbooked (#534)", () => {
  test("their bank waiting on them: still their quote to answer, with a line saying so", () => {
    const { hero } = next({
      quotes: [
        { ...sentQuote, id: "quote-2" },
        paid({ status: "approving", until: "" }),
      ],
    });
    // among quotes ready, the one with a payment leads
    expect(hero).toMatchObject({
      label: "Your quote is ready",
      headline: "Standard Clean $194.89",
      lines: [
        ...FOR,
        "Open until Fri, Nov 13",
        "Your bank hasn't approved your payment yet.",
      ],
      action: { label: "See your quote" },
    });
    expect(
      next({
        quotes: [paid({ status: "approving", until: "", depositCents: 0 })],
      }).hero.lines[3],
    ).toBe("Your bank hasn't approved your card yet.");
  });

  test("didn't go through, or wasn't approved: an alert over its card, or News under what asks", () => {
    const failed = paid({
      status: "failed",
      at: "",
      why: "the card has expired",
    });
    expect(next({ quotes: [failed] }).why).toEqual({
      tone: "danger",
      lead: "Your payment for Standard Clean didn't go through (the card has expired).",
    });
    expect(
      next({ quotes: [paid({ status: "notApproved", at: "" })] }).why,
    ).toEqual({
      tone: "info",
      lead: "Your payment for Standard Clean wasn't approved, so nothing was taken.",
    });
    const asked = next({
      pastJobs: [pastJob({ waiting: changes(1) })],
      quotes: [failed],
    });
    expect(asked.hero.label).toBe("A price change to answer");
    expect(asked.news).toEqual([
      `Your payment for the Standard Clean ${ON} didn't go through (the card has expired).`,
    ]);
    // a plan's names its home, and a card saved with nothing charged says so
    expect(
      next({
        quotes: [{ ...planQuote(), paying: failed.paying }],
      }).why?.lead,
    ).toBe(
      "Your payment for your cleaning plan at 12 Elm St, 4B, 11375 didn't go through (the card has expired).",
    );
    expect(
      next({
        quotes: [paid({ status: "notApproved", at: "", depositCents: 0 })],
      }).why?.lead,
    ).toBe(
      "Your card for Standard Clean wasn't approved, so nothing was booked.",
    );
  });

  test("refunded as the quote was updated, or its time filled for it while another fits: over the quote ready", () => {
    expect(next({ quotes: [refunded("revised")] }).why).toEqual({
      tone: "info",
      lead: "We've refunded your deposit for Standard Clean.",
      more: "Your quote was updated while your bank was approving the payment.",
    });
    // the server leads its headline with what can still be booked
    const fits = refunded("no_room", {
      bookable: ["deep"],
      headlineTotalCents: 39104,
      headlineServiceName: "Deep Clean",
    });
    const { hero, why } = next({ quotes: [fits] });
    expect(hero).toMatchObject({
      label: "Your quote is ready",
      headline: "Deep Clean $391.04",
    });
    expect(why).toEqual({
      tone: "info",
      lead: "We've refunded your deposit for Standard Clean.",
      more: "That time filled up for it while your bank was approving the payment. The Deep Clean can still be booked then.",
    });
    // a quote ready leads over a clean booked, so only what asks puts it
    // in News
    const asks = { pastJobs: [pastJob({ waiting: changes(1) })] };
    expect(next({ ...asks, quotes: [refunded("revised")] }).news).toEqual([
      `We've refunded your deposit for the Standard Clean ${ON}, as your quote was updated while your bank was approving the payment. Please take a look at what's changed.`,
    ]);
    expect(next({ ...asks, quotes: [fits] }).news).toEqual([
      `We've refunded your deposit for the Standard Clean ${ON}, as that time filled up for it while your bank was approving the payment. The Deep Clean can still be booked then.`,
    ]);
  });

  test("refunded on a quote now closed: over how it ended, while that's Home's card", () => {
    const expired = refunded("closed", { status: "expired" });
    expect(next({ quotes: [expired] })).toMatchObject({
      hero: { label: "Your quote expired" },
      why: {
        tone: "info",
        lead: "We've refunded your deposit for Standard Clean.",
        more: "Your quote expired while your bank was approving the payment.",
      },
    });
    // its card says why: the money's what's new
    // a Turned Down quote has no offer (models' UnsentQuoteSummary)
    const turnedDown = quote({
      status: "turned_down",
      turnDownReason: "out_of_area",
      paying: refunded("closed").paying,
      payingServiceName: "Standard Clean",
    });
    expect(next({ quotes: [turnedDown] }).why).toEqual({
      tone: "info",
      lead: "We've refunded your deposit for Standard Clean.",
    });
    // Home is about what's ahead: the quote's page and Payments keep it
    const later = next({ jobs: [job()], quotes: [expired] });
    expect([later.why, later.news]).toEqual([undefined, []]);
  });

  test("a card saved with nothing charged and never used says what wasn't booked", () => {
    const updated = refunded("revised");
    const card = {
      ...updated,
      paying: { ...updated.paying!, depositCents: 0 },
    } as QuoteSummary;
    expect(next({ quotes: [card] }).why).toEqual({
      tone: "info",
      lead: "Your Standard Clean wasn't booked.",
      more: "Your quote was updated while your bank was approving your card.",
    });
  });
});

describe("Home, with a quote whose time filled since it was sent (#534)", () => {
  // what comes next leads, large, and the badge doesn't say "booked", as
  // beside their clean it read as their clean booked (UX review U1)
  test("a state card, not a quote to answer: what comes next, then which time filled", () => {
    const { hero, tiles } = next({ quotes: [fullyBooked] });
    expect(hero).toMatchObject({
      label: "Time unavailable",
      tone: "info",
      headline: "We'll send a new quote",
      lines: [
        "Sun, Nov 8, 10:00\u00a0AM has filled up, so your quote for Standard Clean can't be accepted.",
        "At 12 Elm St, 4B, 11375",
      ],
      action: { label: "See your quote", secondary: true },
    });
    expect(tiles.map((s) => s.label)).not.toContain("See your quote");
    // a payment waiting on their bank can't book it: the card says what's true
    expect(
      next({
        quotes: [paid({ status: "approving", until: "" }, { bookable: [] })],
      }).hero.label,
    ).toBe("Time unavailable");
  });

  test("a plan's names the days, not one time, and its home", () => {
    expect(next({ quotes: [planQuote({ bookable: [] })] }).hero.lines).toEqual([
      "One of the days your plan starts on has filled up, so its quote can't be accepted.",
      "At 12 Elm St, 4B, 11375",
    ]);
    // a change to the plan they have: its new days
    expect(
      next({
        quotes: [planQuote({ bookable: [], homePlanId: "plan" })],
      }).hero.lines[0],
    ).toBe(
      "One of the new days for your plan has filled up, so the change can't be accepted. Your plan stays as it is.",
    );
  });

  test("under something ahead of it, News naming the quote", () => {
    expect(next({ jobs: [job()], quotes: [fullyBooked] }).news).toEqual([
      `Sun, Nov 8, 10:00 AM has filled up, so your quote for Standard Clean at 12 Elm St, 4B, 11375 can't be accepted. ${NEW_QUOTE}`,
    ]);
    expect(
      next({ jobs: [job()], quotes: [planQuote({ bookable: [] })] }).news,
    ).toEqual([
      `One of the days your cleaning plan at 12 Elm St, 4B, 11375 starts on has filled up, so its quote can't be accepted. ${NEW_QUOTE}`,
    ]);
    expect(
      next({
        jobs: [job()],
        quotes: [planQuote({ bookable: [], homePlanId: "plan" })],
      }).news,
    ).toEqual([
      "One of the new days for your cleaning plan at 12 Elm St, 4B, 11375 has filled up, so the change can't be accepted. Your plan stays as it is, and we'll send you a new quote for another time.",
    ]);
  });

  test("a deposit refunded as it filled: an alert over its card, or its News in place of the card's", () => {
    const filled = refunded("no_room", { bookable: [] });
    expect(next({ quotes: [filled] })).toMatchObject({
      hero: { label: "Time unavailable" },
      why: {
        tone: "info",
        lead: "We've refunded your deposit for Standard Clean.",
        more: "That time filled up while your bank was approving the payment.",
      },
    });
    expect(next({ jobs: [job()], quotes: [filled] }).news).toEqual([
      `We've refunded your deposit for the Standard Clean ${ON}, as that time filled up while your bank was approving the payment. ${NEW_QUOTE}`,
    ]);
  });

  test("a deposit going through leads it, as money on its way is what they came to check", () => {
    const { hero, news } = next({
      quotes: [
        going,
        { ...fullyBooked, id: "quote-2", headlineServiceName: "Deep Clean" },
      ],
    });
    expect(hero.label).toBe("Payment pending");
    expect(news).toEqual([
      `Sun, Nov 8, 10:00 AM has filled up, so your quote for Deep Clean at 12 Elm St, 4B, 11375 can't be accepted. ${NEW_QUOTE}`,
    ]);
  });
});

describe("Home's card: what's owed first, when it asks anything of them", () => {
  test("an Unpaid clean pausing a plan, while a clean is booked", () => {
    const { hero, tiles } = next({
      plans: [plan({ status: "on_hold" })],
      jobs: [job({ servicePlanId: "plan" })],
      pastJobs: [pastJob({ unpaid: unpaid("declined"), owedCents: 18450 })],
    });
    expect(hero).toMatchObject({
      label: "To pay",
      lines: ["Until it's paid, we won't book more cleans on your plan."],
      action: { label: "Update your card" },
    });
    expect(tiles.map((s) => s.label)).not.toContain("Your card");
  });

  test("an Unpaid clean pausing a plan, with only another visit booked", () => {
    // the same line, booked or not: it says nothing of what's booked
    const { hero } = next({
      plans: [plan({ status: "on_hold", nextStartsAt: null })],
      siteVisits: [visit],
      pastJobs: [pastJob({ unpaid: unpaid("declined"), owedCents: 18450 })],
    });
    expect(hero).toMatchObject({
      label: "To pay",
      lines: ["Until it's paid, we won't book more cleans on your plan."],
    });
  });

  test("a clean waiting on the payment service asks nothing of them", () => {
    const { hero, tiles } = next({
      jobs: [job()],
      pastJobs: [pastJob({ unpaid: unpaid("waiting"), owedCents: 18450 })],
    });
    expect(hero.label).toBe("Your next clean");
    expect(tiles.find((s) => s.label === "Your card")).toMatchObject({
      hint: "Visa ending 4242",
    });
  });

  test("a Bill due on its page, or Unpaid", () => {
    // simply due, the usual: its line says when, with no alert
    const due = next({ jobs: [job()], bills: [bill()] });
    expect(due.hero).toMatchObject({
      label: "To pay",
      headline: "$214.50",
      lines: ["Bill EC-000041 is due by Sat, Nov 14"],
      action: { label: "Pay the bill" },
    });
    expect(due.why).toBeUndefined();
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
