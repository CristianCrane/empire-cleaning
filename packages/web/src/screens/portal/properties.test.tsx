import { describe, expect, test } from "vitest";
import type {
  ClientUpcomingJob,
  PropertyView,
  QuoteSummary,
  ServicePlanSummary,
  UnsentQuoteSummary,
} from "@empire-cleaning/models";
import { quoteTitle, standingOf, type PropertiesData } from "./properties.ts";

const home = { id: "home", street: "", unit: null, postcode: "" };
const elsewhere = { ...home, id: "elsewhere" };

// Monday 2 November 2026, 9am in New York
const MONDAY = "2026-11-02T14:00:00.000Z";

const plan = (over: Partial<ServicePlanSummary> = {}) =>
  ({
    id: "plan",
    status: "active",
    recurrence: "weekly",
    days: [{ startsAt: MONDAY }],
    property: home,
    nextStartsAt: MONDAY,
    ...over,
  }) as ServicePlanSummary;

// a Quote they asked for, with nothing Sent yet
const quote = (over: Partial<UnsentQuoteSummary> = {}): QuoteSummary => ({
  id: "quote",
  kind: "one_off",
  status: "requested",
  origin: "client",
  asked: null,
  service: { key: "deep", name: "Deep Clean", method: "rooms" },
  client: { id: "client", name: "Dana Reyes", businessName: null },
  property: home as PropertyView,
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
  createdAt: "2026-10-27T14:00:00.000Z",
  paying: null,
  payingServiceName: null,
  bookable: null,
  ...over,
});
// one Sent to them
const sent: QuoteSummary = {
  ...quote(),
  status: "sent",
  headlineTotalCents: 39104,
  headlineServiceName: "Deep Clean",
  proposedStartsAt: "2026-11-08T15:00:00.000Z",
  sentAt: "2026-10-28T14:00:00.000Z",
  expiresAt: "2026-11-14T04:59:00.000Z",
};

const job = {
  id: "job",
  startsAt: MONDAY,
  property: home,
} as ClientUpcomingJob;

const data = (over: Partial<PropertiesData> = {}): PropertiesData => ({
  plans: [],
  quotes: [],
  jobs: [],
  ...over,
});

describe("where a Client's home stands", () => {
  test("on a plan, its weekdays", () => {
    expect(
      standingOf("en", home, data({ plans: [plan()], quotes: [sent] })),
    ).toEqual({
      tone: "success",
      label: "Cleaning plan",
      line: "Mondays at 9:00\u00a0AM",
    });
  });

  test("a plan On Hold says so", () => {
    expect(
      standingOf("en", home, data({ plans: [plan({ status: "on_hold" })] }))
        .label,
    ).toBe("Paused");
  });

  test("an Ended plan, or another home's, doesn't count", () => {
    expect(
      standingOf(
        "en",
        home,
        data({
          plans: [plan({ status: "ended" }), plan({ property: elsewhere })],
        }),
      ).label,
    ).toBe("Nothing booked");
  });

  test("a Quote ready comes before a clean booked", () => {
    expect(
      standingOf("en", home, data({ quotes: [sent], jobs: [job] })),
    ).toEqual({
      tone: "warning",
      label: "Quote ready",
      line: "Deep Clean, sent Oct 28",
    });
  });

  test("the next clean booked", () => {
    expect(standingOf("en", home, data({ jobs: [job] }))).toEqual({
      tone: "info",
      label: "Booked",
      line: "Mon, Nov 2, 9:00\u00a0AM",
    });
  });

  test("a Quote we're preparing", () => {
    expect(
      standingOf("en", home, data({ quotes: [quote({ status: "draft" })] })),
    ).toEqual({
      tone: "info",
      label: "Quote asked for",
      line: "Deep Clean, asked Oct 27",
    });
  });
});

// #534's UX design, Screen 3: a Sent Quote that waits on nothing of theirs,
// its Deposit going through, a card saved with it finishing, or its time
// filled since it was sent
type Paying = NonNullable<QuoteSummary["paying"]>;
const paying = (over: Partial<Paying> = {}): QuoteSummary =>
  ({
    ...sent,
    paying: {
      status: "goingThrough",
      serviceKey: "standard",
      depositCents: 4872,
      ...over,
    } as Paying,
    payingServiceName: "Standard Clean",
  }) as QuoteSummary;
const booking = paying({ depositCents: 0 });
const filled = { ...sent, bookable: [] } as QuoteSummary;
const asPlan = (q: QuoteSummary) =>
  ({ ...q, kind: "service_plan" }) as QuoteSummary;

describe("a home whose quote waits on nothing of theirs (#534)", () => {
  test("its Deposit going through: what it's for, calm", () => {
    expect(standingOf("en", home, data({ quotes: [paying()] }))).toEqual({
      tone: "info",
      label: "Payment pending",
      line: "Deposit for Standard Clean",
    });
    expect(
      standingOf("en", home, data({ quotes: [asPlan(paying())] })).line,
    ).toBe("Deposit for your cleaning plan");
    expect(standingOf("es", home, data({ quotes: [paying()] }))).toEqual({
      tone: "info",
      label: "Pago pendiente",
      line: "Depósito de Standard Clean",
    });
  });

  test("a card saved with nothing charged: the clean it books", () => {
    expect(standingOf("en", home, data({ quotes: [booking] }))).toEqual({
      tone: "info",
      label: "Booking pending",
      line: "Standard Clean",
    });
    expect(standingOf("es", home, data({ quotes: [asPlan(booking)] }))).toEqual(
      {
        tone: "info",
        label: "Reserva pendiente",
        line: "Su plan de limpieza",
      },
    );
  });

  test("its time filled: the sent quote's line", () => {
    expect(standingOf("en", home, data({ quotes: [filled] }))).toEqual({
      tone: "info",
      label: "Time unavailable",
      line: "Deep Clean, sent Oct 28",
    });
  });

  test("ranks after a clean booked, as it asks nothing, and after a quote that does", () => {
    expect(
      standingOf("en", home, data({ quotes: [booking], jobs: [job] })).label,
    ).toBe("Booked");
    expect(
      standingOf(
        "en",
        home,
        data({ quotes: [paying(), { ...sent, id: "other" }] }),
      ).label,
    ).toBe("Quote ready");
    // their bank waiting on them, or a payment that ended: still theirs
    expect(
      standingOf(
        "en",
        home,
        data({
          quotes: [paying({ status: "approving", until: "" } as Paying)],
        }),
      ).label,
    ).toBe("Quote ready");
    // before a quote asked for; money on its way first, as Home ranks it
    expect(
      standingOf(
        "en",
        home,
        data({ quotes: [filled, paying(), quote({ status: "requested" })] }),
      ).label,
    ).toBe("Payment pending");
    expect(
      standingOf(
        "en",
        home,
        data({ quotes: [filled, quote({ status: "requested" })] }),
      ).label,
    ).toBe("Time unavailable");
  });

  test("its row in the home's quotes names the clean it's paying for", () => {
    expect(quoteTitle("en", paying())).toBe("Quote for a Standard Clean");
    expect(quoteTitle("en", sent)).toBe("Quote for a Deep Clean");
  });
});
