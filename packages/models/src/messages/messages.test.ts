import { expect, test } from "vitest";
import { assignments } from "./assignments.ts";
import { bills } from "./bills.ts";
import { cancellation } from "./cancellation.ts";
import { messages } from "./index.ts";
import { jobs } from "./jobs.ts";
import { payments } from "./payments.ts";
import { plans } from "./plans.ts";
import { quotes } from "./quotes.ts";
import { reschedule } from "./reschedule.ts";

const subjects = [
  assignments,
  bills,
  cancellation,
  jobs,
  payments,
  plans,
  quotes,
  reschedule,
];

// one catalog of every subject's words: two subjects naming a string alike
// would leave one of them unread
test("no two subjects name a message alike", () => {
  const named = subjects.flatMap((s) => Object.keys(s.en));
  expect(Object.keys(messages.en)).toHaveLength(named.length);
});

test("a Service Plan's weekdays read in either language", () => {
  // Monday 9:00am, Saturday 1:00pm in New York
  const days = ["2026-01-12T14:00:00Z", "2026-01-17T18:00:00Z"];
  expect(messages.en.planDaysWhen(days)).toBe(
    "Mondays at 9:00 AM and Saturdays at 1:00 PM",
  );
  expect(messages.es.planDaysWhen(days)).toBe(
    "los lunes a las 9:00 a.m. y los sábados a la 1:00 p.m.",
  );
});
