import { describe, expect, test } from "vitest";
import type {
  ClientUpcomingJob,
  QuoteSummary,
  ServicePlanSummary,
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

const quote = (over: Partial<QuoteSummary> = {}) =>
  ({
    id: "quote",
    kind: "one_off",
    status: "sent",
    service: { key: "deep", name: "Deep Clean" },
    property: home,
    sentAt: "2026-10-28T14:00:00.000Z",
    createdAt: "2026-10-27T14:00:00.000Z",
    ...over,
  }) as QuoteSummary;

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
      standingOf(home, data({ plans: [plan()], quotes: [quote()] })),
    ).toEqual({
      tone: "success",
      label: "Service Plan",
      line: "Mondays at 9:00 AM",
    });
  });

  test("a plan On Hold says so", () => {
    expect(
      standingOf(home, data({ plans: [plan({ status: "on_hold" })] })).label,
    ).toBe("On Hold");
  });

  test("an Ended plan, or another home's, doesn't count", () => {
    expect(
      standingOf(
        home,
        data({
          plans: [plan({ status: "ended" }), plan({ property: elsewhere })],
        }),
      ).label,
    ).toBe("Nothing booked");
  });

  test("a Quote to answer comes before a clean booked", () => {
    expect(standingOf(home, data({ quotes: [quote()], jobs: [job] }))).toEqual({
      tone: "warning",
      label: "Quote to answer",
      line: "Deep Clean, sent Oct 28",
    });
  });

  test("the next clean booked", () => {
    expect(standingOf(home, data({ jobs: [job] }))).toEqual({
      tone: "info",
      label: "Booked",
      line: "Mon, Nov 2, 9:00 AM",
    });
  });

  test("a Quote we're preparing", () => {
    expect(
      standingOf(home, data({ quotes: [quote({ status: "draft" })] })),
    ).toEqual({
      tone: "info",
      label: "Quote asked for",
      line: "Deep Clean, asked Oct 27",
    });
  });
});
