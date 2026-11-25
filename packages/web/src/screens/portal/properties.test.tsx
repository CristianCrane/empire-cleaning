import { describe, expect, test } from "vitest";
import type {
  ClientUpcomingJob,
  PropertyView,
  QuoteSummary,
  ServicePlanSummary,
  UnsentQuoteSummary,
} from "@empire-cleaning/models";
import { standingOf, type PropertiesData } from "./properties.ts";

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
